from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models import News
from app.api.schemas import (
    NewsListResponse, NewsListItem, NewsDetail,
    BeneficiaryStockItem, TrendingKeywordItem, SectorCount
)

router = APIRouter(prefix="/api", tags=["news"])


@router.get("/news", response_model=NewsListResponse)
async def get_news_list(
    db: AsyncSession = Depends(get_db),
    sector: Optional[str] = None,
    sentiment: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """뉴스 목록 조회 (중요도순, 중복 제외)"""

    query = select(News).where(News.is_duplicate == False)

    if sector:
        query = query.where(News.sector == sector)
    if sentiment:
        query = query.where(News.sentiment == sentiment)
    if date_from:
        query = query.where(News.published_at >= date_from)
    if date_to:
        query = query.where(News.published_at <= date_to)

    # 중요도 순 정렬
    query = query.order_by(desc(News.importance_score), desc(News.published_at))

    # 전체 개수
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    # 페이지네이션
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    news_items = result.scalars().all()

    return NewsListResponse(
        items=[NewsListItem.model_validate(n) for n in news_items],
        total=total or 0,
        page=page,
        page_size=page_size
    )


@router.get("/news/{news_id}", response_model=NewsDetail)
async def get_news_detail(
    news_id: int,
    db: AsyncSession = Depends(get_db)
):
    """뉴스 상세 조회"""

    query = select(News).where(News.id == news_id)
    result = await db.execute(query)
    news = result.scalar_one_or_none()

    if not news:
        raise HTTPException(status_code=404, detail="News not found")

    return NewsDetail.model_validate(news)


@router.get("/stocks/beneficiary", response_model=list[BeneficiaryStockItem])
async def get_beneficiary_stocks(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(10, ge=1, le=50)
):
    """오늘 뉴스 기반 수혜주 목록"""

    cutoff = datetime.now() - timedelta(hours=24)

    query = select(News).where(
        News.published_at >= cutoff,
        News.is_duplicate == False,
        News.beneficiary_stocks.isnot(None)
    )

    result = await db.execute(query)
    news_items = result.scalars().all()

    # 수혜주 집계
    stock_map = {}
    for news in news_items:
        if not news.beneficiary_stocks:
            continue

        for stock in news.beneficiary_stocks:
            name = stock.get("name", "")
            if name not in stock_map:
                stock_map[name] = {
                    "name": name,
                    "code": stock.get("code"),
                    "mention_count": 0,
                    "impacts": [],
                    "reasons": []
                }
            stock_map[name]["mention_count"] += 1
            stock_map[name]["impacts"].append(stock.get("impact", "중"))
            if stock.get("reason"):
                stock_map[name]["reasons"].append(stock["reason"])

    # 언급 횟수 순 정렬
    sorted_stocks = sorted(
        stock_map.values(),
        key=lambda x: x["mention_count"],
        reverse=True
    )[:limit]

    return [
        BeneficiaryStockItem(
            name=s["name"],
            code=s["code"],
            mention_count=s["mention_count"],
            avg_impact=max(set(s["impacts"]), key=s["impacts"].count) if s["impacts"] else "중",
            reasons=list(set(s["reasons"]))[:3]
        )
        for s in sorted_stocks
    ]


@router.get("/keywords/trending", response_model=list[TrendingKeywordItem])
async def get_trending_keywords(
    db: AsyncSession = Depends(get_db),
    hours: int = Query(1, ge=1, le=24),
    limit: int = Query(10, ge=1, le=30)
):
    """최근 N시간 급상승 키워드"""

    since = datetime.now() - timedelta(hours=hours)

    query = select(News.title).where(
        News.published_at >= since,
        News.is_duplicate == False
    )

    result = await db.execute(query)
    titles = [r[0] for r in result.fetchall()]

    # 간단한 키워드 추출 (실제로는 형태소 분석 필요)
    word_count = {}
    for title in titles:
        words = title.split()
        for word in words:
            if len(word) >= 2:
                word_count[word] = word_count.get(word, 0) + 1

    sorted_words = sorted(word_count.items(), key=lambda x: x[1], reverse=True)[:limit]

    return [
        TrendingKeywordItem(keyword=word, count=count)
        for word, count in sorted_words
    ]


@router.get("/sectors", response_model=list[SectorCount])
async def get_sector_counts(
    db: AsyncSession = Depends(get_db)
):
    """섹터별 뉴스 카운트"""

    cutoff = datetime.now() - timedelta(hours=24)

    query = select(
        News.sector,
        func.count(News.id).label("count")
    ).where(
        News.published_at >= cutoff,
        News.is_duplicate == False,
        News.sector.isnot(None)
    ).group_by(News.sector).order_by(desc("count"))

    result = await db.execute(query)
    rows = result.fetchall()

    return [
        SectorCount(sector=row[0], count=row[1])
        for row in rows
    ]
