"""Repify API: pose extraction and exercise-technique analysis."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.analysis import router as analysis_router
from app.config import settings
from app.services import gemini_analyzer
from app.services.exercises import EXERCISE_IDS

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)

app = FastAPI(
    title="Repify API",
    description="Pose extraction (MediaPipe) and technique analysis for 14 exercises (Gemini or local rules).",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(analysis_router)


@app.get("/", tags=["health"])
@app.get("/health", tags=["health"])
async def health() -> dict:
    return {
        "status": "ok",
        "service": "repify-api",
        "version": app.version,
        "exercises": EXERCISE_IDS,
        "engine": "gemini" if gemini_analyzer.is_configured() else "local",
    }
