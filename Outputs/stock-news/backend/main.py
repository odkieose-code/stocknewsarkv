from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, update, delete, or_
from datetime import datetime, timedelta
from typing import Optional
import traceback
import httpx

from app.core.config import settings
from app.core.database import engine, AsyncSessionLocal
from app.models import Base, News
from app.api import router
from app.services.crawlers.naver import NaverFinanceCrawler
from app.services.deduplication import NewsDeduplicator, preprocess_text

scheduler = AsyncIOScheduler()


async def run_crawl():
    try:
        print(">>> 크롤링 시작...", flush=True)
        crawler = NaverFinanceCrawler()
        items = await crawler.crawl()
        print(f">>> 크롤링 완료: {len(items)}개", flush=True)
        if not items:
            return

        async with AsyncSessionLocal() as db:
            cutoff = datetime.utcnow() - timedelta(hours=24)
            result = await db.execute(
                select(News.id, News.title, News.content)
                .where(News.crawled_at >= cutoff)
                .where(News.is_duplicate == False)
            )
            rows = result.all()
            existing_ids = [r.id for r in rows]
            existing_texts = [preprocess_text(r.title, r.content or "") for r in rows]
            deduplicator = NewsDeduplicator()
            saved = 0

            for item in items:
                try:
                    # ── 빈 title 저장 방지 ─────────────────────────────
                    if not item.title or len(item.title.strip()) < 8:
                        print(f">>> 빈 제목 스킵: {item.url[:60]}", flush=True)
                        continue

                    # TF-IDF 중복 검사
                    new_text = preprocess_text(item.title, item.content or "")
                    dup = deduplicator.check_duplicate(new_text, existing_texts, existing_ids)
                    if dup.is_duplicate:
                        print(f">>> 중복 스킵: {item.title[:30]}", flush=True)
                        continue

                    summary = None
                    sentiment = "neutral"
                    importance_score = 50.0
                    sector = getattr(item, "sector", None)
                    beneficiary_stocks = []
                    affected_stocks = []

                    try:
                        from app.services.ai_analyzer import get_analyzer
                        analyzer = get_analyzer()
                        analysis = await analyzer.analyze(
                            title=item.title,
                            content=item.content or "",
                            source=item.source,
                            published_at=item.published_at.isoformat(),
                        )
                        if analysis:
                            if not analysis.is_finance_related:
                                print(f">>> 비금융 스킵: {item.title[:30]}", flush=True)
                                continue
                            if analysis.archive_decision == "DISMISS":
                                print(f">>> DISMISS 스킵: {item.title[:30]}", flush=True)
                                continue
                            summary = analysis.summary
                            sentiment = analysis.sentiment
                            importance_score = analysis.importance_score
                            sector = analysis.sector or sector
                            beneficiary_stocks = analysis.beneficiary_stocks or []
                            affected_stocks = analysis.affected_stocks or []
                    except Exception as e:
                        print(f">>> AI 스킵: {e}", flush=True)

                    news = News(
                        title=item.title,
                        url=item.url,
                        source=item.source,
                        published_at=item.published_at,
                        content=item.content or "",
                        summary=summary,
                        sentiment=sentiment,
                        sector=sector,
                        thumbnail=getattr(item, "thumbnail", None),
                        importance_score=importance_score,
                        beneficiary_stocks=beneficiary_stocks,
                        affected_stocks=affected_stocks,
                        is_duplicate=False,
                    )
                    db.add(news)
                    existing_texts.append(new_text)
                    existing_ids.append(0)
                    saved += 1

                except Exception as e:
                    print(f">>> 뉴스 처리 오류: {e}", flush=True)
                    traceback.print_exc()

            await db.commit()
            print(f">>> DB 저장 완료: {saved}개", flush=True)

    except Exception as e:
        print(f">>> 크롤링 오류: {e}", flush=True)
        traceback.print_exc()


async def run_batch_dedup(hours: int = 24):
    print(f">>> 배치 중복 정리 시작 (최근 {hours}시간)...", flush=True)
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(News.id, News.title, News.content)
            .where(News.crawled_at >= cutoff)
            .order_by(News.published_at.asc())
        )
        rows = result.all()
        if not rows:
            print(">>> 정리할 뉴스 없음", flush=True)
            return
        ids = [r.id for r in rows]
        texts = [preprocess_text(r.title, r.content or "") for r in rows]
        deduplicator = NewsDeduplicator()
        duplicates = deduplicator.batch_find_duplicates(texts, ids)
        for dup_id, orig_id, score in duplicates:
            await db.execute(
                update(News).where(News.id == dup_id)
                .values(is_duplicate=True, original_news_id=orig_id, similarity_score=score)
            )
        await db.commit()
        print(f">>> 배치 중복 정리 완료: {len(duplicates)}건", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    scheduler.add_job(run_crawl, "interval", minutes=settings.CRAWL_INTERVAL_MINUTES)
    scheduler.add_job(run_batch_dedup, "cron", hour=3, minute=0)
    scheduler.start()
    await run_crawl()
    yield
    scheduler.shutdown()


app = FastAPI(title=settings.APP_NAME, version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


# ── Admin 엔드포인트 (app/api/admin.py 없이 직접 정의) ────
@app.get("/admin/clear-news")
async def clear_news():
    async with AsyncSessionLocal() as db:
        await db.execute(delete(News))
        await db.commit()
    return {"status": "뉴스 전체 삭제 완료"}


@app.get("/admin/crawl-now")
async def crawl_now():
    import asyncio
    asyncio.create_task(run_crawl())
    return {"status": "크롤링 시작됨"}


@app.get("/admin/clear-empty-titles")
async def clear_empty_titles():
    """제목이 비어있거나 8자 미만인 뉴스를 DB에서 삭제"""
    async with AsyncSessionLocal() as db:
        all_news = await db.execute(select(News.id, News.title))
        to_delete = [r.id for r in all_news.all() if not r.title or len(r.title.strip()) < 8]
        if to_delete:
            await db.execute(delete(News).where(News.id.in_(to_delete)))
            await db.commit()
            return {"status": f"빈 제목 뉴스 {len(to_delete)}건 삭제 완료"}
    return {"status": "삭제할 뉴스 없음"}


@app.get("/api/timeline")
async def get_timeline(
    keyword: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    hours: int = Query(72),
):
    if not keyword and not sector:
        return JSONResponse({"error": "keyword 또는 sector를 입력하세요."}, status_code=400)
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    async with AsyncSessionLocal() as db:
        q = (
            select(News.id, News.title, News.url, News.source,
                   News.published_at, News.importance_score,
                   News.sentiment, News.sector, News.summary, News.thumbnail)
            .where(News.published_at >= cutoff)
            .where(News.is_duplicate == False)
            .order_by(News.published_at.asc())
        )
        if sector:
            q = q.where(News.sector == sector)
        if keyword:
            q = q.where(or_(
                News.title.ilike(f"%{keyword}%"),
                News.summary.ilike(f"%{keyword}%"),
            ))
        rows = (await db.execute(q)).all()
    return {
        "keyword": keyword, "sector": sector, "hours": hours, "total": len(rows),
        "items": [{
            "id": r.id, "title": r.title, "url": r.url, "source": r.source,
            "published_at": r.published_at.isoformat(),
            "importance_score": r.importance_score, "sentiment": r.sentiment,
            "sector": r.sector, "summary": r.summary, "thumbnail": r.thumbnail,
        } for r in rows],
    }


@app.get("/admin/batch-dedup")
async def trigger_batch_dedup(hours: int = Query(24)):
    import asyncio
    asyncio.create_task(run_batch_dedup(hours))
    return {"status": f"배치 중복 정리 시작 (최근 {hours}시간)"}
        return {"status": "삭제할 뉴스 없음"}


TICKER_SYMBOLS_MAP = {
    "KOSPI":   "^KS11",
    "KOSDAQ":  "^KQ11",
    "USD/KRW": "KRW=X",
    "S&P500":  "^GSPC",
    "NASDAQ":  "^IXIC",
    "WTI":     "CL=F",
    "BTC/USD": "BTC-USD",
}

@app.get("/api/ticker")
async def get_ticker():
    results = []
    headers = {"User-Agent": "Mozilla/5.0"}
    async with httpx.AsyncClient(timeout=8.0) as client:
        for label, symbol in TICKER_SYMBOLS_MAP.items():
            try:
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=5d"
                r = await client.get(url, headers=headers)
                data = r.json()
                result = data["chart"]["result"][0]
                closes = result["indicators"]["quote"][0]["close"]
                closes = [c for c in closes if c is not None]
                price = closes[-1] if len(closes) >= 1 else None
                prev  = closes[-2] if len(closes) >= 2 else None
                chg   = ((price - prev) / prev * 100) if price and prev else None
                if label == "USD/KRW":
                    value = f"{price:.1f}" if price else "--"
                elif "BTC" in label:
                    value = f"{price:,.0f}" if price else "--"
                else:
                    value = f"{price:.2f}" if price else "--"
                results.append({
                    "label": label,
                    "value": value,
                    "change": f"{chg:+.2f}%" if chg is not None else "",
                    "up": (chg >= 0) if chg is not None else None,
                })
            except Exception:
                results.append({"label": label, "value": "--", "change": "", "up": None})
    return results


@app.get("/health")
async def health_check():
    from app.services.ai_analyzer import UsageMonitor
    return {"status": "healthy", "ai_calls_today": UsageMonitor.today_count()}
