"""
Модель пользователя.

Минимальная модель — аутентификация через Supabase Auth.
Хранит только ID для связи с калибровками и тренировками.
"""

import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    """
    Пользователь приложения.

    Аутентификация происходит через Supabase Auth.
    Эта модель связывает Supabase user_id с данными о тренировках.
    """

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(255),
        primary_key=True,
        doc="Supabase Auth User ID",
    )
    email: Mapped[str] = mapped_column(
        String(255),
        nullable=True,
        doc="Email пользователя (опционально, из Supabase)",
    )
    display_name: Mapped[str] = mapped_column(
        String(255),
        nullable=True,
        doc="Отображаемое имя пользователя",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        doc="Дата регистрации",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        doc="Дата последнего обновления",
    )

    # Связи
    calibration_profiles: Mapped[list["CalibrationProfile"]] = relationship(
        "CalibrationProfile",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    workouts: Mapped[list["Workout"]] = relationship(
        "Workout",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email})>"
