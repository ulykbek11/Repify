"""
Конфигурация приложения.

Загружает настройки из .env файла через pydantic-settings.
"""

from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки приложения, загружаемые из переменных окружения."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Database
    database_url: str = "sqlite:///./motionq.db"

    # Supabase
    supabase_url: str = ""
    supabase_service_key: str = ""

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True

    # CORS
    cors_origins: str = "*"

    @property
    def cors_origins_list(self) -> List[str]:
        """Возвращает список CORS origins из строки через запятую."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
