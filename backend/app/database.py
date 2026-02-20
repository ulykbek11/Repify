"""
Подключение к базе данных через SQLAlchemy 2.0.

Создаёт engine, sessionmaker и Base для моделей.
"""

from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


connect_args = {}
engine_kwargs = {}

if "sqlite" in settings.database_url:
    connect_args["check_same_thread"] = False
    connect_args["timeout"] = 5  # SQLite: таймаут 5 секунд
else:
    # PostgreSQL / другие: таймаут подключения и пула
    connect_args["connect_timeout"] = 5
    engine_kwargs["pool_timeout"] = 5
    engine_kwargs["pool_recycle"] = 300

print(f">>> [DB] Engine создан: {settings.database_url[:50]}...")

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    echo=settings.debug,
    connect_args=connect_args,
    **engine_kwargs,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


class Base(DeclarativeBase):
    """Базовый класс для всех моделей SQLAlchemy."""
    pass


def get_db() -> Generator[Session, None, None]:
    """
    Генератор сессии базы данных для Dependency Injection в FastAPI.

    Yields:
        Session: Сессия SQLAlchemy для работы с БД.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
