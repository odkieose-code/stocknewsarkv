from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class StockSchema(BaseModel):
    name: str
    code: Optional[str] = None
    impact: str
    reason: str


class NewsBase(BaseModel):
    title: str
    url: str
    source: str
    published_at: datetime


class NewsListItem(NewsBase):
    id: int
    importance_score: Optional[float] = None
    sentiment: Optional[str] = None
    sector: Optional[str] = None
    summary: Optional[str] = None

    class Config:
        from_attributes = True


class NewsDetail(NewsBase):
    id: int
    content: str
    importance_score: Optional[float] = None
    sentiment: Optional[str] = None
    sentiment_score: Optional[float] = None
    sector: Optional[str] = None
    summary: Optional[str] = None
    beneficiary_stocks: Optional[List[StockSchema]] = None
    affected_stocks: Optional[List[StockSchema]] = None

    class Config:
        from_attributes = True


class NewsListResponse(BaseModel):
    items: List[NewsListItem]
    total: int
    page: int
    page_size: int


class BeneficiaryStockItem(BaseModel):
    name: str
    code: Optional[str] = None
    mention_count: int
    avg_impact: str
    reasons: List[str]


class TrendingKeywordItem(BaseModel):
    keyword: str
    count: int


class SectorCount(BaseModel):
    sector: str
    count: int
