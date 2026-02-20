"""
Модель тренировки.

Хранит историю тренировок с оценками техники по каждому повторению.
"""

import uuid
from datetime import datetime


from sqlalchemy import String, Integer, Float, DateTime, JSON, func, Index, Uuid, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Workout(Base):
    """
    Запись о тренировке.

    Хранит результаты одной тренировочной сессии:
    количество повторений, оценки техники и длительность.
    """

    __tablename__ = "workouts"

    __table_args__ = (
        Index("ix_workout_user_id", "user_id"),
        Index("ix_workout_exercise_type", "exercise_type"),
        Index("ix_workout_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        doc="Уникальный идентификатор тренировки",
    )
    user_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("users.id"),
        nullable=False,
        doc="Supabase Auth User ID",
    )
    exercise_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        doc="Тип упражнения: squat или deadlift",
    )
    reps_completed: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        doc="Количество выполненных повторений",
    )
    technique_scores: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        doc="Массив оценок техники по каждому повторению [0.0-1.0]",
    )
    duration_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        doc="Длительность тренировки в секундах",
    )
    average_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
        doc="Средняя оценка техники за тренировку",
    )
    notes: Mapped[str] = mapped_column(
        String(1000),
        nullable=True,
        doc="Заметки о тренировке",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        doc="Дата тренировки",
    )

    # Связь с пользователем
    user = relationship("User", back_populates="workouts")

    def __repr__(self) -> str:
        return (
            f"<Workout(id={self.id}, user_id={self.user_id}, "
            f"exercise={self.exercise_type}, reps={self.reps_completed})>"
        )
