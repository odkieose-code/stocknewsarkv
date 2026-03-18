from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional
import json

from openai import AsyncOpenAI
from anthropic import AsyncAnthropic

from app.core.config import settings


@dataclass
class StockInfo:
    name: str
    code: Optional[str]
    impact: str  # 상/중/하
    reason: str


@dataclass
class AnalysisResult:
    importance_score: float
    sentiment: str
    sentiment_score: float
    sector: str
    summary: str
    beneficiary_stocks: List[StockInfo]
    affected_stocks: List[StockInfo]


class BaseAIAnalyzer(ABC):
    @abstractmethod
    async def analyze(self, title: str, content: str) -> AnalysisResult:
        pass


class OpenAIAnalyzer(BaseAIAnalyzer):
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = "gpt-4-turbo-preview"

    async def analyze(self, title: str, content: str) -> AnalysisResult:
        prompt = self._build_prompt(title, content)

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3
        )

        result = json.loads(response.choices[0].message.content)
        return self._parse_result(result)

    def _build_prompt(self, title: str, content: str) -> str:
        return f"""당신은 주식 시장 전문 애널리스트입니다.

아래 뉴스 기사를 분석해주세요.

## 뉴스
제목: {title}
본문: {content[:3000]}

## 분석 요청
1. 중요도 점수 (0-100): 시장 영향력, 긴급성, 신뢰도 종합
2. 감성: positive/neutral/negative
3. 감성 점수: -100 ~ 100
4. 섹터: 반도체/2차전지/바이오/AI/금융/자동차/유통/에너지/건설/엔터/기타
5. 한 줄 요약 (30자 이내)
6. 수혜주/피해주 (각 최대 3개)

## 출력 형식 (JSON)
{{
  "importance_score": 85,
  "sentiment": "positive",
  "sentiment_score": 72,
  "sector": "반도체",
  "summary": "한 줄 요약",
  "beneficiary_stocks": [
    {{"name": "종목명", "code": "종목코드", "impact": "상", "reason": "이유"}}
  ],
  "affected_stocks": [
    {{"name": "종목명", "code": "종목코드", "impact": "중", "reason": "이유"}}
  ]
}}"""

    def _parse_result(self, data: dict) -> AnalysisResult:
        return AnalysisResult(
            importance_score=data.get("importance_score", 50),
            sentiment=data.get("sentiment", "neutral"),
            sentiment_score=data.get("sentiment_score", 0),
            sector=data.get("sector", "기타"),
            summary=data.get("summary", ""),
            beneficiary_stocks=[
                StockInfo(**s) for s in data.get("beneficiary_stocks", [])
            ],
            affected_stocks=[
                StockInfo(**s) for s in data.get("affected_stocks", [])
            ]
        )


class ClaudeAnalyzer(BaseAIAnalyzer):
    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = "claude-3-sonnet-20240229"

    async def analyze(self, title: str, content: str) -> AnalysisResult:
        prompt = self._build_prompt(title, content)

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        )

        # JSON 추출
        text = response.content[0].text
        json_start = text.find("{")
        json_end = text.rfind("}") + 1
        result = json.loads(text[json_start:json_end])

        return self._parse_result(result)

    def _build_prompt(self, title: str, content: str) -> str:
        # OpenAI와 동일한 프롬프트 사용
        return OpenAIAnalyzer._build_prompt(self, title, content)

    def _parse_result(self, data: dict) -> AnalysisResult:
        return OpenAIAnalyzer._parse_result(self, data)


def get_analyzer() -> BaseAIAnalyzer:
    """설정에 따라 적절한 AI 분석기 반환"""
    if settings.AI_PROVIDER == "anthropic" and settings.ANTHROPIC_API_KEY:
        return ClaudeAnalyzer()
    elif settings.OPENAI_API_KEY:
        return OpenAIAnalyzer()
    else:
        raise ValueError("No AI API key configured")
