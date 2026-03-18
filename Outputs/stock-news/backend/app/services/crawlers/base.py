from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional
import httpx
import asyncio


@dataclass
class NewsItem:
    title: str
    content: str
    url: str
    source: str
    published_at: datetime
    related_stocks: Optional[List[str]] = None


class BaseCrawler(ABC):
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
        self.rate_limit_delay = 1.0  # seconds between requests

    @abstractmethod
    async def crawl(self) -> List[NewsItem]:
        pass

    async def fetch(self, url: str) -> Optional[str]:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers, timeout=30.0)
                response.raise_for_status()
                await asyncio.sleep(self.rate_limit_delay)
                return response.text
            except Exception as e:
                print(f"Error fetching {url}: {e}")
                return None
