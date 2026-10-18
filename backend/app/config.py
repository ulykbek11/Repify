"""Application settings, loaded from environment variables or a .env file."""

from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    # Gemini is optional. Without a key the deterministic local analyzer is used.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    debug: bool = False

    # Comma-separated list of allowed origins for browsers.
    cors_origins: str = (
        "http://localhost:8081,http://localhost:19006,http://localhost:3000,http://localhost:8082"
    )

    # Upload limit for /api/extract-poses.
    max_upload_mb: int = 60

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
