from pydantic_settings import BaseSettings
from typing import Optional, List

class Settings(BaseSettings):
    APP_NAME: str = "Stock News Curation"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://localhost/stocknews"

    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    AI_PROVIDER: str = "openai"

    CRAWL_INTERVAL_MINUTES: int = 10

    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    def get_cors_origins(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"

settings = Settings()
