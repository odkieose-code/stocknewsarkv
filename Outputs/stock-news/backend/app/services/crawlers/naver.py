from typing import Optional
from bs4 import BeautifulSoup
from datetime import datetime
from typing import List
import re

from .base import BaseCrawler, NewsItem


class NaverFinanceCrawler(BaseCrawler):
    """네이버 증권 뉴스 크롤러"""

    BASE_URL = "https://finance.naver.com"
    NEWS_LIST_URL = f"{BASE_URL}/news/mainnews.naver"

    async def crawl(self) -> List[NewsItem]:
        news_items = []

        html = await self.fetch(self.NEWS_LIST_URL)
        if not html:
            return news_items

        soup = BeautifulSoup(html, "html.parser")
        articles = soup.select("ul.newsList li")

        for article in articles[:20]:  # 최근 20개
            try:
                news_item = await self._parse_article(article)
                if news_item:
                    news_items.append(news_item)
            except Exception as e:
                print(f"Error parsing article: {e}")
                continue

        return news_items

    async def _parse_article(self, article) -> Optional[NewsItem]:
        # 제목과 링크
        title_elem = article.select_one("a")
        if not title_elem:
            return None

        title = title_elem.get_text(strip=True)
        href = title_elem.get("href", "")

        if not href.startswith("http"):
            href = f"{self.BASE_URL}{href}"

        # 상세 페이지에서 본문 가져오기
        detail_html = await self.fetch(href)
        if not detail_html:
            return None

        detail_soup = BeautifulSoup(detail_html, "html.parser")

        # 본문 추출
        content_elem = detail_soup.select_one(".articleCont, .article_body, #content")
        content = content_elem.get_text(strip=True) if content_elem else ""

        # 발행 시간
        time_elem = detail_soup.select_one(".article_info, .info, time")
        published_at = self._parse_datetime(time_elem)

        # 관련 종목 추출
        related_stocks = self._extract_stock_codes(detail_soup)

        return NewsItem(
            title=title,
            content=content[:5000],  # 최대 5000자
            url=href,
            source="네이버증권",
            published_at=published_at,
            related_stocks=related_stocks
        )

    def _parse_datetime(self, elem) -> datetime:
        if not elem:
            return datetime.now()

        text = elem.get_text(strip=True)
        # 다양한 형식 처리
        patterns = [
            r"(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})",
            r"(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})",
        ]

        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                groups = match.groups()
                return datetime(
                    int(groups[0]), int(groups[1]), int(groups[2]),
                    int(groups[3]), int(groups[4])
                )

        return datetime.now()

    def _extract_stock_codes(self, soup) -> List[str]:
        stocks = []
        stock_links = soup.select("a[href*='code=']")

        for link in stock_links:
            href = link.get("href", "")
            match = re.search(r"code=(\d{6})", href)
            if match:
                stocks.append(match.group(1))

        return list(set(stocks))
