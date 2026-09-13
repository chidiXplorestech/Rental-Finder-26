from dataclasses import dataclass, field
from typing import Any

import httpx


@dataclass
class SearchDocument:
    url: str
    title: str
    snippets: list[str]
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def text(self) -> str:
        return " ".join([self.title, *self.snippets]).strip()


class SearchProviderNotConfigured(RuntimeError):
    pass


class BraveLlmContextSearch:
    """Server-side live web discovery using Brave's LLM Context search endpoint.

    The endpoint returns source URLs plus pre-extracted chunks, so discovery does
    not require scraping search-engine HTML pages or exposing the API token to
    the browser.
    """

    endpoint = "https://api.search.brave.com/res/v1/llm/context"

    def __init__(self, api_key: str):
        self.api_key = api_key.strip()

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    async def search(self, query: str, maximum_urls: int = 20) -> list[SearchDocument]:
        if not self.configured:
            raise SearchProviderNotConfigured("BRAVE_SEARCH_API_KEY is not configured")

        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": self.api_key,
            "User-Agent": "NottsRentalTracker/0.2 (+live-web-discovery)",
        }
        params = {
            "q": query,
            "country": "GB",
            "search_lang": "en",
            "count": min(50, max(1, maximum_urls)),
            "maximum_number_of_urls": min(50, max(1, maximum_urls)),
            "maximum_number_of_tokens": 12000,
            "maximum_number_of_tokens_per_url": 2500,
            "context_threshold_mode": "lenient",
            "safesearch": "moderate",
        }
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            response = await client.get(self.endpoint, params=params, headers=headers)
            response.raise_for_status()
            payload = response.json()

        rows = payload.get("grounding", {}).get("generic") or []
        documents: list[SearchDocument] = []
        seen: set[str] = set()
        for row in rows:
            url = (row.get("url") or "").strip()
            if not url or url in seen:
                continue
            seen.add(url)
            documents.append(
                SearchDocument(
                    url=url,
                    title=(row.get("title") or "Untitled listing").strip(),
                    snippets=[s.strip() for s in (row.get("snippets") or []) if isinstance(s, str) and s.strip()],
                    raw=row,
                )
            )
        return documents
