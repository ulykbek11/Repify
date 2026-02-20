"""
Pydantic схемы для валидации запросов и ответов.
"""

from app.schemas.user import UserCreate, UserResponse
from app.schemas.calibration import (
    CalibrationRequest,
    CalibrationResponse,
    CalibrationProfileResponse,
)
from app.schemas.technique import (
    TechniqueAnalysisRequest,
    TechniqueAnalysisResponse,
    RepCountRequest,
    RepCountResponse,
)
from app.schemas.workout import (
    WorkoutCreate,
    WorkoutResponse,
    WorkoutStatsResponse,
)

__all__ = [
    "UserCreate",
    "UserResponse",
    "CalibrationRequest",
    "CalibrationResponse",
    "CalibrationProfileResponse",
    "TechniqueAnalysisRequest",
    "TechniqueAnalysisResponse",
    "RepCountRequest",
    "RepCountResponse",
    "WorkoutCreate",
    "WorkoutResponse",
    "WorkoutStatsResponse",
]
