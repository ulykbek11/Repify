"""API маршруты."""

from app.api.calibration import router as calibration_router
from app.api.analysis import router as analysis_router
from app.api.workouts import router as workouts_router

__all__ = ["calibration_router", "analysis_router", "workouts_router"]
