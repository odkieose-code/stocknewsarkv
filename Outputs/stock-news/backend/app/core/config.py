from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Stock News Curation"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://localhost/stocknews"

    # AI APIs
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    AI_PROVIDER: str = "openai"  # "openai" or "anthropic"

    # Crawling
    CRAWL_INTERVAL_MINUTES: int = 10

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"


settings = Settings()
