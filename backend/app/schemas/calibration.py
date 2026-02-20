"""
Pydantic схемы для калибровки.

Валидация данных калибровочной последовательности
и ответов с профилем пользователя.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class Landmark(BaseModel):
    """Одна точка MediaPipe Pose."""

    x: float = Field(..., ge=0.0, le=1.0, description="Координата X (0-1)")
    y: float = Field(..., ge=0.0, le=1.0, description="Координата Y (0-1)")
    z: float = Field(0.0, description="Координата Z (глубина)")


class CalibrationRequest(BaseModel):
    """
    Запрос на калибровку.

    Содержит 5 повторений упражнения для анализа биомеханики.
    Каждое повторение — последовательность кадров с 33 точками тела.
    """

    user_id: str = Field(
        ...,
        description="Supabase Auth User ID",
        min_length=1,
        max_length=255,
    )
    exercise_type: str = Field(
        ...,
        description="Тип упражнения: squat или deadlift",
    )
    pose_sequence: List[List[Dict[str, Landmark]]] = Field(
        ...,
        description="Повторения упражнения, каждое — список кадров с 33 точками",
        min_length=1,
    )

    @field_validator("exercise_type")
    @classmethod
    def validate_exercise_type(cls, v: str) -> str:
        """Проверяет, что тип упражнения допустимый."""
        allowed = {"squat", "deadlift"}
        if v.lower() not in allowed:
            raise ValueError(f"exercise_type должен быть одним из: {allowed}")
        return v.lower()


class CalibrationProfileResponse(BaseModel):
    """Ответ с данными профиля калибровки."""

    id: UUID
    user_id: str
    exercise_type: str
    anthropometry: Dict[str, Any]
    baseline_metrics: Dict[str, Any]
    safe_ranges: Dict[str, Any]
    movement_patterns: Dict[str, Any]
    recommendations: List[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CalibrationResponse(BaseModel):
    """Полный ответ после калибровки."""

    calibration_completed: bool = True
    user_id: str
    exercise_type: str
    profile: Dict[str, Any]
    recommendations: List[str]
