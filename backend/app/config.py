from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://rentals:rentals@db:5432/rentals"
    cors_origins: str = "http://localhost:3000"
    poll_interval_seconds: int = 720
    traveltime_app_id: str = ""
    traveltime_api_key: str = ""
    permitted_feed_urls: str = ""
    brave_search_api_key: str = ""
    search_results_per_query: int = 20
    search_stale_after_seconds: int = 129600
    direct_verify_allowed_domains: str = ""
    city_centre_lat: float = 52.9533
    city_centre_lng: float = -1.1500

    @property
    def cors_origin_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

    @property
    def feed_urls(self) -> list[str]:
        return [x.strip() for x in self.permitted_feed_urls.split(",") if x.strip()]

    @property
    def direct_verify_domains(self) -> list[str]:
        return [x.strip().lower() for x in self.direct_verify_allowed_domains.split(",") if x.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
