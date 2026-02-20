"""
Pydantic схемы для тренировок.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class WorkoutCreate(BaseModel):
    """Схема создания записи о тренировке."""

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
    reps_completed: int = Field(
        ...,
        ge=0,
        description="Количество выполненных повторений",
    )
    technique_scores: List[float] = Field(
        default_factory=list,
        description="Оценки техники по каждому повторению [0.0-1.0]",
    )
    duration_seconds: int = Field(
        ...,
        ge=0,
        description="Длительность тренировки (секунды)",
    )
    notes: Optional[str] = Field(
        None,
        description="Заметки о тренировке",
        max_length=1000,
    )

    @field_validator("exercise_type")
    @classmethod
    def validate_exercise_type(cls, v: str) -> str:
        """Проверяет допустимый тип упражнения."""
        allowed = {"squat", "deadlift"}
        if v.lower() not in allowed:
            raise ValueError(f"exercise_type должен быть одним из: {allowed}")
        return v.lower()

    @field_validator("technique_scores")
    @classmethod
    def validate_scores(cls, v: List[float]) -> List[float]:
        """Проверяет, что все оценки в диапазоне 0.0-1.0."""
        for i, score in enumerate(v):
            if not 0.0 <= score <= 1.0:
                raise ValueError(
                    f"Оценка #{i+1} = {score} вне диапазона 0.0-1.0"
                )
        return v


class WorkoutResponse(BaseModel):
    """Ответ с данными о тренировке."""

    id: UUID
    user_id: str
    exercise_type: str
    reps_completed: int
    technique_scores: List[float]
    duration_seconds: int
    average_score: float
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ExerciseStats(BaseModel):
    """Статистика по одному типу упражнения."""

    exercise_type: str
    total_workouts: int
    total_reps: int
    average_score: float
    best_score: float
    last_workout: Optional[datetime] = None


class WorkoutStatsResponse(BaseModel):
    """Ответ со статистикой тренировок пользователя."""

    user_id: str
    total_workouts: int
    total_reps: int
    overall_average_score: float
    by_exercise: List[ExerciseStats]
