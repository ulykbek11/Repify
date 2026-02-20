"""
Модель профиля калибровки.

Хранит персонализированные биомеханические данные пользователя
для каждого типа упражнения отдельно.
"""

import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, JSON, func, UniqueConstraint, Index, Uuid, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CalibrationProfile(Base):
    """
    Профиль калибровки пользователя.

    Каждый пользователь имеет отдельный профиль для каждого типа упражнения.
    Содержит:
    - anthropometry: пропорции тела (длины сегментов, соотношения)
    - baseline_metrics: естественные показатели движения
    - safe_ranges: безопасные диапазоны углов ДЛЯ ЭТОГО человека
    - movement_patterns: характерные паттерны движения
    - recommendations: персональные рекомендации
    """

    __tablename__ = "calibration_profiles"

    __table_args__ = (
        UniqueConstraint("user_id", "exercise_type", name="uq_user_exercise"),
        Index("ix_calibration_user_id", "user_id"),
        Index("ix_calibration_exercise_type", "exercise_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        doc="Уникальный идентификатор профиля",
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
    anthropometry: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
        doc="Антропометрические данные: длины сегментов, пропорции",
    )
    baseline_metrics: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
        doc="Базовые показатели движения: углы, глубина, наклон",
    )
    safe_ranges: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
        doc="Безопасные диапазоны углов для этого пользователя",
    )
    movement_patterns: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
        doc="Паттерны движения: скорость, траектория",
    )
    recommendations: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        doc="Персональные рекомендации на основе калибровки",
    )
    calibration_reps_count: Mapped[int] = mapped_column(
        nullable=False,
        default=5,
        doc="Количество повторений использованных для калибровки",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        doc="Дата создания профиля",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        doc="Дата последнего обновления",
    )

    # Связь с пользователем
    user = relationship("User", back_populates="calibration_profiles")

    def __repr__(self) -> str:
        return (
            f"<CalibrationProfile(id={self.id}, user_id={self.user_id}, "
            f"exercise_type={self.exercise_type})>"
        )
