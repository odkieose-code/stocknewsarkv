from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()


class News(Base):
    __tablename__ = "news"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    url = Column(String(1000), unique=True, nullable=False)
    source = Column(String(100), nullable=False)
    published_at = Column(DateTime, nullable=False)
    crawled_at = Column(DateTime, default=datetime.utcnow)

    is_duplicate = Column(Boolean, default=False)
    original_news_id = Column(Integer, nullable=True)
    similarity_score = Column(Float, nullable=True)

    importance_score = Column(Float, nullable=True)
    sentiment = Column(String(20), nullable=True)
    sentiment_score = Column(Float, nullable=True)
    sector = Column(String(50), nullable=True)
    thumbnail = Column(String(1000), nullable=True)
    summary = Column(String(500), nullable=True)

    beneficiary_stocks = Column(JSON, nullable=True)
    affected_stocks = Column(JSON, nullable=True)

    is_analyzed = Column(Boolean, default=False)


class Stock(Base):
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    sector = Column(String(50), nullable=True)


class TrendingKeyword(Base):
    __tablename__ = "trending_keywords"

    id = Column(Integer, primary_key=True, index=True)
    keyword = Column(String(100), nullable=False)
    count = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
