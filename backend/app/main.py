"""
MotionQ AI Fitness Trainer — FastAPI Backend.

Точка входа приложения. Настраивает CORS, маршруты, Swagger UI.
"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine

# Must be imported BEFORE create_all so SQLAlchemy registers all table definitions
import app.models  # noqa: F401

from app.api.calibration import router as calibration_router
from app.api.analysis import router as analysis_router
from app.api.workouts import router as workouts_router
from app.api.frontend_compat import router as frontend_compat_router


# Настройка логирования
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Create all tables on startup (idempotent — safe to call if they already exist)."""
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ensured")
    yield


app = FastAPI(
    lifespan=lifespan,
    title="MotionQ AI Fitness Trainer",
    description=(
        "Персонализированный AI фитнес тренер с анализом техники и подсчётом повторений.\n\n"
        "**Поддерживаемые упражнения:** Приседания (squat) и Становая тяга (deadlift)\n\n"
        "**Философия:** Персонализация, не универсальные стандарты. "
        "Каждый человек уникален — анализ сравнивает с ЛИЧНЫМ baseline пользователя."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


# CORS для React Native / Expo
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    content_type = request.headers.get("content-type", "")
    print(f"\n📥 Incoming: {request.method} {request.url}")
    print(f"   Client: {request.client}")

    # НЕ читаем тело для multipart/file-upload — иначе 33MB виснет в памяти
    if "multipart" not in content_type:
        body_bytes = await request.body()
        print(f"   Body: {len(body_bytes)} bytes")
        if body_bytes and len(body_bytes) < 500:
            print(f"   Body preview: {body_bytes[:500].decode('utf-8', errors='replace')}")
    else:
        print(f"   Content-Type: {content_type} (file upload, body not read)")

    response = await call_next(request)
    elapsed = (time.time() - start) * 1000
    print(f"📤 Response: {response.status_code} ({elapsed:.0f}ms) ← {request.method} {request.url.path}")
    return response


# Подключение маршрутов
# Frontend compat router FIRST — перехватывает /api/calibrate, /api/count-reps,
# /api/profile/{user_id}/exists и /api/analyze-technique (с pose_sequence)
app.include_router(frontend_compat_router)
app.include_router(calibration_router)
app.include_router(workouts_router)


@app.get("/", tags=["Health"])
async def health_check() -> dict:
    """
    Проверка работоспособности сервера.

    Returns:
        Статус сервера и версия API.
    """
    return {
        "status": "ok",
        "service": "MotionQ AI Fitness Trainer",
        "version": "1.0.0",
        "exercises": ["squat", "deadlift"],
    }


@app.get("/health", tags=["Health"])
async def health() -> dict:
    """
    Детальная проверка здоровья сервера.

    Returns:
        Статус компонентов.
    """
    return {
        "status": "healthy",
        "components": {
            "api": "ok",
            "database": "ok",
        },
    }


logger.info("MotionQ AI Fitness Trainer запущен")
logger.info(f"CORS origins: {settings.cors_origins_list}")
logger.info(f"Debug mode: {settings.debug}")
