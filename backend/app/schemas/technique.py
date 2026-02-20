"""
Pydantic схемы для анализа техники и подсчёта повторений.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

from app.schemas.calibration import Landmark


class TechniqueAnalysisRequest(BaseModel):
    """
    Запрос на анализ техники одного кадра.

    Содержит 33 точки MediaPipe Pose для текущего кадра.
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
    landmarks: Dict[str, Landmark] = Field(
        ...,
        description="33 точки MediaPipe Pose",
    )

    @field_validator("exercise_type")
    @classmethod
    def validate_exercise_type(cls, v: str) -> str:
        """Проверяет, что тип упражнения допустимый."""
        allowed = {"squat", "deadlift"}
        if v.lower() not in allowed:
            raise ValueError(f"exercise_type должен быть одним из: {allowed}")
        return v.lower()


class TechniqueError(BaseModel):
    """Описание конкретной ошибки техники."""

    error_type: str = Field(..., description="Тип ошибки")
    severity: str = Field(
        ...,
        description="Серьёзность: low, medium, high",
    )
    message: str = Field(..., description="Описание ошибки")
    current_value: Optional[float] = Field(
        None, description="Текущее значение"
    )
    expected_range: Optional[str] = Field(
        None, description="Ожидаемый диапазон"
    )


class TechniqueMetrics(BaseModel):
    """Текущие метрики техники."""

    knee_angle: Optional[float] = Field(None, description="Угол в колене")
    hip_angle: Optional[float] = Field(None, description="Угол в тазу")
    torso_angle: Optional[float] = Field(None, description="Наклон корпуса")
    back_angle: Optional[float] = Field(None, description="Угол спины")
    symmetry: Optional[float] = Field(None, description="Асимметрия (градусы)")


class TechniqueAnalysisResponse(BaseModel):
    """Ответ с результатами анализа техники."""

    technique_score: float = Field(
        ..., ge=0.0, le=1.0, description="Оценка техники (0.0-1.0)"
    )
    errors: List[TechniqueError] = Field(
        default_factory=list, description="Список обнаруженных ошибок"
    )
    feedback: str = Field(..., description="Главная подсказка пользователю")
    metrics: TechniqueMetrics = Field(
        ..., description="Текущие метрики углов"
    )


class RepCountRequest(BaseModel):
    """Запрос на подсчёт повторений (один кадр)."""

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
    landmarks: Dict[str, Landmark] = Field(
        ...,
        description="33 точки MediaPipe Pose",
    )

    @field_validator("exercise_type")
    @classmethod
    def validate_exercise_type(cls, v: str) -> str:
        """Проверяет, что тип упражнения допустимый."""
        allowed = {"squat", "deadlift"}
        if v.lower() not in allowed:
            raise ValueError(f"exercise_type должен быть одним из: {allowed}")
        return v.lower()


class RepCountResponse(BaseModel):
    """Ответ с данными о подсчёте повторений."""

    rep_counted: bool = Field(
        ..., description="Было ли засчитано повторение"
    )
    total_reps: int = Field(
        ..., ge=0, description="Общее количество повторений"
    )
    current_phase: str = Field(
        ..., description="Текущая фаза движения"
    )
    key_angle: float = Field(
        ..., description="Ключевой угол (колено для squat, таз для deadlift)"
    )
