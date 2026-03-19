"""
AI 뉴스 분석 모듈 - 3단계 거름망 구조

1단계: 룰 기반 사전 필터 (AI 호출 없음)
2단계: AI 경량 트리아지 (제목만, 배치 처리)
3단계: AI 정밀 분석 (ARCHIVE 판정분만, 본문 포함)
"""

import json
import asyncio
import logging
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from openai import AsyncOpenAI
from anthropic import AsyncAnthropic

from app.core.config import settings

logger = logging.getLogger(__name__)

# ══ 카테고리/섹터 통일 라벨 ══════════════════════════════════
VALID_CATEGORIES = {"실적", "정책", "수급", "매크로", "섹터", "종목", "IPO·공시", "테마", "기타"}
VALID_SECTORS = {"반도체", "2차전지", "바이오", "AI", "금융", "자동차", "유통", "에너지", "건설", "엔터", "방산", "조선", "기타"}

# ══ 1단계: 룰 기반 사전 필터 ════════════════════════════════
import re as _re

DISMISS_PATTERNS = [
    r"포토|화보|영상|동영상",
    r"광고|제공|스폰서|협찬",
    r"부고|동정",
    r"오늘의\s*운세|날씨|기상",
    r"연예|스포츠|축구|야구|골프|올림픽",
    r"커뮤니티|독자제보|사연",
    r"드라마|영화|아이돌|콘서트",
]

BOOST_PATTERNS = [
    r"긴급|속보|단독|특보",
    r"실적|영업이익|매출|순이익|어닝",
    r"금리|기준금리|인상|인하|FOMC",
    r"상장|IPO|공모|유상증자",
    r"인수|합병|M&A",
    r"제재|규제|과징금",
    r"급등|급락|상한가|하한가|신고가|신저가",
]

FINANCE_KEYWORDS = [
    "코스피", "코스닥", "주가", "주식", "증권", "상장", "공시", "매출", "영업이익",
    "금리", "환율", "달러", "연준", "Fed", "FOMC", "한국은행",
    "ETF", "IPO", "M&A", "유상증자", "배당", "실적", "어닝",
    "반도체", "배터리", "바이오", "HBM", "파운드리",
]

SOURCE_TIERS: List[Tuple[List[str], int, float]] = [
    (["공시", "거래소", "KRX", "한국은행", "금감원"], 100, 1.2),
    (["한경", "매경", "이데일리", "한국경제", "매일경제", "연합뉴스", "뉴스1"], 90, 1.0),
    (["조선", "중앙", "동아", "네이버증권", "머니투데이", "파이낸셜뉴스"], 70, 0.8),
]
DEFAULT_TIER = (40, 0.5)


def rule_filter(title: str, content: str = "") -> Tuple[str, bool]:
    """
    1단계 룰 필터
    Returns: ("DISMISS"|"PASS", is_boosted)
    """
    text = title + " " + content[:200]
    for pattern in DISMISS_PATTERNS:
        if _re.search(pattern, text):
            return "DISMISS", False
    is_boosted = any(_re.search(p, text) for p in BOOST_PATTERNS)
    if False:  # 금융키워드 체크 비활성화
        return "DISMISS", False
    return "PASS", is_boosted


# ══ Tier / 신선도 ════════════════════════════════════════════
def get_source_tier(source: str) -> Tuple[int, float]:
    for keywords, score, weight in SOURCE_TIERS:
        if any(k in source for k in keywords):
            return score, weight
    return DEFAULT_TIER


def get_freshness_decay(published_at: str) -> float:
    try:
        dt = datetime.fromisoformat(published_at)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        hours = (datetime.now(timezone.utc) - dt).total_seconds() / 3600
    except Exception:
        hours = 6
    if hours <= 1:  return 1.0
    if hours <= 6:  return 0.9
    if hours <= 24: return 0.7
    if hours <= 48: return 0.5
    return 0.3


# ══ 사용량 모니터 ════════════════════════════════════════════
class UsageMonitor:
    _calls: dict = {}
    DAILY_LIMIT = 500

    @classmethod
    def check_and_increment(cls):
        today = datetime.utcnow().date()
        cls._calls[today] = cls._calls.get(today, 0) + 1
        if cls._calls[today] > cls.DAILY_LIMIT:
            logger.warning(f"[UsageMonitor] 한도 초과: {cls._calls[today]}/{cls.DAILY_LIMIT}")
            return False
        return True

    @classmethod
    def today_count(cls):
        return cls._calls.get(datetime.utcnow().date(), 0)


# ══ 데이터 클래스 ════════════════════════════════════════════
@dataclass
class AnalysisResult:
    importance_score: float = 50.0
    archive_decision: str = "DISPLAY"
    category: str = "기타"
    sector: str = "기타"
    sentiment: str = "neutral"
    sentiment_score: float = 0.0
    summary: str = ""
    beneficiary_stocks: List[dict] = field(default_factory=list)
    affected_stocks: List[dict] = field(default_factory=list)
    investor_note: dict = field(default_factory=dict)
    is_finance_related: bool = True


@dataclass
class DuplicateResult:
    is_duplicate: bool = False
    similarity_score: float = 0.0
    reason: str = ""
    recommendation: str = "keep_both"


# ══ JSON 추출 ════════════════════════════════════════════════
def _extract_json(text: str) -> dict:
    m = re.search(r"```json\s*([\s\S]+?)\s*```", text)
    if m:
        return json.loads(m.group(1))
    s, e = text.find("{"), text.rfind("}") + 1
    if s == -1 or e == 0:
        raise ValueError("JSON not found")
    return json.loads(text[s:e])


# ══ 2단계: 트리아지 프롬프트 (배치) ══════════════════════════
PROMPT_TRIAGE = """당신은 주식 투자 뉴스 큐레이터입니다.
타겟 사용자: 주린이~중급 개인 투자자.

아래 뉴스 제목들을 보고 각각 판정해주세요.

## ARCHIVE 기준 (개인 투자자 매매 판단에 실질적 영향)
- 종목/섹터 실적 발표, 어닝 서프라이즈/쇼크
- 정책·규제 변화 (금리, 세제, 산업 정책)
- 수급 이슈 (외국인/기관 대규모 매매, 공매도)
- 글로벌 매크로 (미국 CPI, FOMC, 환율 급변)
- M&A, IPO, 유상증자, 대규모 투자
- 섹터 테마 촉발 이벤트

## DISMISS 기준
- 단순 시황 요약 (이미 지표로 확인 가능)
- 의견·칼럼·전망 (팩트 아닌 것)
- 이미 알려진 사실의 단순 반복
- 개인 투자자와 무관한 기관 내부 소식

## 입력
{titles_json}

## 출력 (JSON array만, 다른 텍스트 없이)
[
  {{"idx": 0, "decision": "ARCHIVE", "category": "실적", "priority": "HIGH"}},
  {{"idx": 1, "decision": "DISMISS", "reason": "단순시황"}},
  ...
]

## category (ARCHIVE인 경우, 반드시 아래 중 하나)
실적 | 정책 | 수급 | 매크로 | 섹터 | 종목 | IPO·공시 | 테마 | 기타

## priority (ARCHIVE인 경우)
HIGH: 즉시 확인 필요 | MID: 오늘 중 확인 | LOW: 참고용

애매하면 ARCHIVE로 판정. JSON만 출력."""


# ══ 3단계: 정밀 분석 프롬프트 ════════════════════════════════
PROMPT_DETAIL = """당신은 한국 주식시장 전문 애널리스트입니다.
타겟 독자: 주린이~중급 개인 투자자 (쉬운 표현 선호).

## 뉴스
제목: {title}
본문: {content}
출처: {source}
발행: {published_at}

## 분석 지시

### 중요도 (0-100)
- 시장 파급력 (30%): 코스피 전체? 특정 섹터? 개별 종목?
- 투자 시의성 (30%): 즉시 대응? 중장기 참고?
- 정보 희소성 (20%): 새로운 팩트? 이미 알려진 내용?
- 신뢰도 (20%): 공식 발표? 루머?

### 카테고리 (하나만)
실적 | 정책 | 수급 | 매크로 | 섹터 | 종목 | IPO·공시 | 테마 | 기타

### 섹터 (하나만)
반도체 | 2차전지 | 바이오 | AI | 금융 | 자동차 | 유통 | 에너지 | 건설 | 엔터 | 방산 | 조선 | 기타

### 감성
direction: positive / neutral / negative
score: -100 ~ +100

### 한줄 요약 (30자 이내, 팩트/수치 중심)

### 수혜주 / 피해주 (각 최대 3개, 실제 상장 종목만)
- code: 6자리 숫자 (모르면 null)
- impact: 상 / 중 / 하
- reason: 20자 이내

### 투자 포인트
- why_important: 1문장
- caution: 1문장

## 출력 (JSON만, 다른 텍스트 없이)
{{
  "importance_score": 85,
  "category": "실적",
  "sector": "반도체",
  "sentiment": {{"direction": "positive", "score": 72}},
  "summary": "삼성전자 Q1 영업이익 6.6조 달성했다",
  "beneficiary_stocks": [{{"name": "삼성전자", "code": "005930", "impact": "상", "reason": "실적 직접 수혜"}}],
  "affected_stocks": [],
  "investor_note": {{
    "why_important": "반도체 업황 회복 신호",
    "caution": "일회성 요인 포함 여부 확인 필요"
  }}
}}"""


# ══ Market Pulse 배치 프롬프트 ═══════════════════════════════
PROMPT_MARKET_PULSE = """당신은 한국 주식시장 데일리 브리핑 작성자입니다.
타겟: 주린이~중급 개인 투자자.

## 오늘의 아카이브 뉴스
{news_json}

## 출력 (JSON만)
{{
  "market_mood": "cautious_optimistic",
  "mood_summary": "시장 분위기 한 줄 요약",
  "hot_sectors": [
    {{"sector": "반도체", "direction": "positive", "news_count": 4, "reason": "실적 서프라이즈"}}
  ],
  "key_themes": [
    {{"theme": "AI 반도체 수요", "news_count": 4, "trend": "accelerating"}}
  ],
  "top_beneficiary_stocks": [
    {{"name": "SK하이닉스", "code": "000660", "mention_count": 5, "consensus_impact": "상", "key_reason": "HBM 수요 확대"}}
  ],
  "daily_takeaway": "오늘의 핵심 2문장 이내"
}}

market_mood 선택지: strong_bullish | bullish | cautious_optimistic | neutral | cautious_pessimistic | bearish | strong_bearish
hot_sectors 최대 5개 | top_beneficiary_stocks 최대 10개 | JSON만 출력"""


# ══ 분석기 베이스 ════════════════════════════════════════════
class BaseAIAnalyzer(ABC):
    MAX_RETRIES = 3
    RETRY_DELAY = 2.0

    @abstractmethod
    async def _call(self, prompt: str) -> str:
        pass

    async def _call_with_retry(self, prompt: str) -> Optional[dict]:
        for attempt in range(self.MAX_RETRIES):
            try:
                return _extract_json(await self._call(prompt))
            except Exception as e:
                logger.warning(f"[AI 재시도 {attempt+1}/{self.MAX_RETRIES}] {e}")
                if attempt < self.MAX_RETRIES - 1:
                    await asyncio.sleep(self.RETRY_DELAY * (attempt + 1))
        return None

    async def triage_batch(self, titles: List[dict]) -> List[dict]:
        """2단계: 제목 배치 트리아지 (10~20개 한 번에)"""
        if not titles:
            return []
        if not UsageMonitor.check_and_increment():
            return [{"idx": i, "decision": "ARCHIVE"} for i in range(len(titles))]
        prompt = PROMPT_TRIAGE.format(titles_json=json.dumps(titles, ensure_ascii=False))
        try:
            text = await self._call(prompt)
            # array JSON 파싱
            m = re.search(r"\[[\s\S]+\]", text)
            if m:
                return json.loads(m.group(0))
        except Exception as e:
            logger.warning(f"[트리아지 실패] {e}")
        return [{"idx": i, "decision": "ARCHIVE"} for i in range(len(titles))]

    async def analyze(
        self,
        title: str,
        content: str,
        source: str = "네이버증권",
        published_at: str = "",
    ) -> Optional[AnalysisResult]:
        """3단계: 정밀 분석"""

        # 1단계 룰 필터
        rule_result, is_boosted = rule_filter(title, content)
        if rule_result == "DISMISS":
            logger.info(f"[룰필터 DISMISS] {title[:40]}")
            return AnalysisResult(
                importance_score=10, archive_decision="DISMISS",
                is_finance_related=False,
            )

        if not UsageMonitor.check_and_increment():
            return None

        # 3단계 정밀 분석
        ai = await self._call_with_retry(
            PROMPT_DETAIL.format(
                title=title,
                content=content[:2000],
                source=source,
                published_at=published_at or datetime.utcnow().isoformat(),
            )
        )
        if not ai:
            return None

        # 카테고리/섹터 검증
        category = ai.get("category", "기타")
        if category not in VALID_CATEGORIES:
            category = "기타"
        sector = ai.get("sector", "기타")
        if sector not in VALID_SECTORS:
            sector = "기타"

        # 점수 계산
        score = float(ai.get("importance_score", 50))
        _, tier_weight = get_source_tier(source)
        freshness = get_freshness_decay(published_at or datetime.utcnow().isoformat())
        score = min(score * tier_weight * freshness, 100.0)
        if is_boosted:
            score = min(score + 10, 100.0)

        decision = "DISMISS" if score < 50 else "ARCHIVE"

        senti_obj = ai.get("sentiment", {})
        if isinstance(senti_obj, str):
            direction = senti_obj
            senti_score = 0.0
        else:
            direction = senti_obj.get("direction", "neutral")
            senti_score = float(senti_obj.get("score", 0))

        return AnalysisResult(
            importance_score=round(score, 2),
            archive_decision=decision,
            category=category,
            sector=sector,
            sentiment=direction,
            sentiment_score=senti_score,
            summary=ai.get("summary", ""),
            beneficiary_stocks=ai.get("beneficiary_stocks", []),
            affected_stocks=ai.get("affected_stocks", []),
            investor_note=ai.get("investor_note", {}),
            is_finance_related=True,
        )

    async def generate_market_pulse(self, news_list: List[dict]) -> Optional[dict]:
        """Market Pulse 배치 생성"""
        if not news_list:
            return None
        if not UsageMonitor.check_and_increment():
            return None
        prompt = PROMPT_MARKET_PULSE.format(
            news_json=json.dumps(news_list[:50], ensure_ascii=False)
        )
        return await self._call_with_retry(prompt)

    async def check_duplicate_ai(self, title_a, content_a, title_b, content_b):
        if not UsageMonitor.check_and_increment():
            return None
        prompt = f"""두 뉴스가 실질적으로 동일한 내용인지 판별하세요.
뉴스A: {title_a}\n{content_a[:500]}
뉴스B: {title_b}\n{content_b[:500]}
JSON만 출력: {{"is_duplicate":false,"similarity_score":0,"reason":"","recommendation":"keep_both"}}"""
        data = await self._call_with_retry(prompt)
        if not data:
            return None
        return DuplicateResult(
            is_duplicate=bool(data.get("is_duplicate", False)),
            similarity_score=float(data.get("similarity_score", 0)),
            reason=data.get("reason", ""),
            recommendation=data.get("recommendation", "keep_both"),
        )


# ══ 구현체 ══════════════════════════════════════════════════
class OpenAIAnalyzer(BaseAIAnalyzer):
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = "gpt-4o-mini"

    async def _call(self, prompt: str) -> str:
        r = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        return r.choices[0].message.content


class ClaudeAnalyzer(BaseAIAnalyzer):
    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = "claude-haiku-4-5-20251001"

    async def _call(self, prompt: str) -> str:
        r = await self.client.messages.create(
            model=self.model, max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        return r.content[0].text


def get_analyzer():
    if settings.AI_PROVIDER == "anthropic" and settings.ANTHROPIC_API_KEY:
        return ClaudeAnalyzer()
    elif settings.OPENAI_API_KEY:
        return OpenAIAnalyzer()
    raise ValueError("AI API 키가 설정되지 않았습니다.")
