from bs4 import BeautifulSoup
from datetime import datetime
from typing import List, Optional
import re

from .base import BaseCrawler, NewsItem

# 네이버 증권 전체 카테고리 (8개 전부)
NAVER_CATEGORIES = {
    "국내증시":   "https://finance.naver.com/news/news_list.naver?mode=LSS2D&section_id=101&section_id2=261",
    "종목분석":   "https://finance.naver.com/news/news_list.naver?mode=LSS2D&section_id=101&section_id2=260",
    "시황·전망":  "https://finance.naver.com/news/news_list.naver?mode=LSS2D&section_id=101&section_id2=258",
    "공시·메시지":"https://finance.naver.com/news/news_list.naver?mode=LSS2D&section_id=101&section_id2=259",
    "해외증시":   "https://finance.naver.com/news/news_list.naver?mode=LSS2D&section_id=101&section_id2=262",
    "기업일반":   "https://finance.naver.com/news/news_list.naver?mode=LSS2D&section_id=101&section_id2=265",
    "채권·선물":  "https://finance.naver.com/news/news_list.naver?mode=LSS2D&section_id=101&section_id2=263",
    "공모·메자닌":"https://finance.naver.com/news/news_list.naver?mode=LSS2D&section_id=101&section_id2=264",
}

# 카테고리별 수집 수 (중요도 반영)
CATEGORY_LIMITS = {
    "국내증시":    8,
    "종목분석":    8,
    "시황·전망":   8,
    "공시·메시지": 6,
    "해외증시":    6,
    "기업일반":    5,
    "채권·선물":   4,
    "공모·메자닌": 3,
}  # 총 최대 48개/회

# fallback_title로 쓰기엔 너무 짧거나 의미없는 텍스트 패턴
_INVALID_TITLE_PATTERNS = re.compile(
    r"^(더보기|more|view|read|\.\.\.|\[.*?\]|\d+)$", re.IGNORECASE
)

def _is_valid_title(text: str) -> bool:
    """제목으로 쓸 수 있는 충분한 길이와 내용인지 검사"""
    if not text or len(text) < 8:
        return False
    if _INVALID_TITLE_PATTERNS.match(text.strip()):
        return False
    return True


class NaverFinanceCrawler(BaseCrawler):
    BASE_URL = "https://finance.naver.com"

    async def crawl(self) -> List[NewsItem]:
        news_items = []
        seen_urls: set = set()

        for category, url in NAVER_CATEGORIES.items():
            limit = CATEGORY_LIMITS.get(category, 5)
            try:
                html = await self.fetch(url)
                if not html:
                    continue

                soup = BeautifulSoup(html, "html.parser")
                links = []

                for a in soup.find_all("a", href=True):
                    href = a["href"]
                    if "news_read" in href or "article_id" in href:
                        if not href.startswith("http"):
                            href = f"{self.BASE_URL}{href}"
                        title_text = a.get_text(strip=True)
                        # fallback_title이 유효한 경우만 수집
                        # (유효하지 않아도 상세 페이지에서 og:title로 복구 시도)
                        if href not in seen_urls and len(title_text) > 3:
                            seen_urls.add(href)
                            links.append((title_text, href, category))

                print(f">>> [{category}] {len(links)}개 링크 (수집: {limit})", flush=True)

                for title_text, href, cat in links[:limit]:
                    item = await self._fetch_detail(title_text, href, cat)
                    if item:
                        news_items.append(item)

            except Exception as e:
                print(f">>> 카테고리 오류 [{category}]: {e}", flush=True)

        print(f">>> 최종 수집: {len(news_items)}개", flush=True)
        return news_items

    async def _fetch_detail(self, fallback_title: str, href: str, category: str) -> Optional[NewsItem]:
        detail_html = await self.fetch(href)
        title = fallback_title
        content = ""
        published_at = datetime.now()
        source = "네이버증권"
        thumbnail = None
        detail_soup = None

        if detail_html:
            detail_soup = BeautifulSoup(detail_html, "html.parser")

            # ── 제목: og:title 최우선 (JS 렌더링 없이도 메타태그는 서버에서 내려줌)
            og_title = detail_soup.find("meta", property="og:title")
            if og_title and og_title.get("content"):
                t = og_title["content"].strip()
                # " - 네이버 뉴스" 같은 suffix 제거
                t = re.sub(r"\s*[-|]\s*(네이버\s*뉴스|Naver\s*News).*$", "", t, flags=re.IGNORECASE).strip()
                if _is_valid_title(t):
                    title = t

            # og:title 실패 시 DOM 셀렉터 순차 시도
            if not _is_valid_title(title) or title == fallback_title:
                for sel in [
                    "h2.media_end_head_headline",
                    ".media_end_head_headline",
                    "#title_area span",
                    ".articleSubject",
                    "h2", "h3",
                ]:
                    elem = detail_soup.select_one(sel)
                    if elem:
                        t = elem.get_text(strip=True)
                        if _is_valid_title(t):
                            title = t
                            break

            # 출처 (언론사명 추출)
            for sel in [
                ".media_end_head_top a",
                ".press_logo img",
                "a.nclicks\\(art\\.src\\)",
                ".article_info .source",
            ]:
                try:
                    elem = detail_soup.select_one(sel)
                    if elem:
                        src = elem.get("alt") or elem.get_text(strip=True)
                        if src and len(src) > 1:
                            source = src
                            break
                except Exception:
                    pass

            # og:image 썸네일 우선
            og = detail_soup.find("meta", property="og:image")
            if og and og.get("content"):
                thumbnail = og["content"]
            else:
                img = detail_soup.select_one(".end_photo_org img, .articlePhoto img, #img1")
                if img and img.get("src"):
                    thumbnail = img["src"]

            # 본문
            for sel in ["#dic_area", ".newsct_article", ".articleCont", ".article_body"]:
                elem = detail_soup.select_one(sel)
                if elem:
                    content = elem.get_text(strip=True)
                    break

            # 발행시간
            for sel in [
                ".media_end_head_info_datestamp_time",
                "._ARTICLE_DATE_TIME",
                ".article_info em",
                "span.t11",
            ]:
                elem = detail_soup.select_one(sel)
                if elem:
                    published_at = self._parse_datetime(elem)
                    break

        # 최종 title 유효성 검사: 8자 미만이면 저장 안 함
        if not _is_valid_title(title):
            print(f">>> 제목 없음 스킵: {href[:60]}", flush=True)
            return None

        item = NewsItem(
            title=title,
            content=content[:5000],
            url=href,
            source=source,
            published_at=published_at,
            related_stocks=self._extract_stock_codes(detail_soup) if detail_soup else [],
        )
        item.thumbnail = thumbnail
        item.sector = category
        return item

    def _parse_datetime(self, elem) -> datetime:
        if not elem:
            return datetime.now()
        text = elem.get_text(strip=True)
        for pattern in [
            r"(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})",
            r"(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})",
        ]:
            match = re.search(pattern, text)
            if match:
                g = match.groups()
                try:
                    return datetime(int(g[0]), int(g[1]), int(g[2]), int(g[3]), int(g[4]))
                except Exception:
                    pass
        return datetime.now()

    def _extract_stock_codes(self, soup) -> List[str]:
        stocks = []
        for link in soup.select("a[href*='code=']"):
            match = re.search(r"code=(\d{6})", link.get("href", ""))
            if match:
                stocks.append(match.group(1))
        return list(set(stocks))
