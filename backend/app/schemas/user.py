"""
Pydantic схемы пользователя.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    """Схема создания пользователя."""

    id: str = Field(
        ...,
        description="Supabase Auth User ID",
        min_length=1,
        max_length=255,
    )
    email: Optional[str] = Field(
        None,
        description="Email пользователя",
        max_length=255,
    )
    display_name: Optional[str] = Field(
        None,
        description="Отображаемое имя",
        max_length=255,
    )


class UserResponse(BaseModel):
    """Схема ответа с данными пользователя."""

    id: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
