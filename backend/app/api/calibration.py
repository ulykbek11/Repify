"""
API эндпоинты калибровки.

POST /api/calibration/start — запуск калибровки (5 повторений)
GET /api/calibration/{user_id}/{exercise_type} — получение профиля
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.calibration import (
    CalibrationRequest,
    CalibrationResponse,
    CalibrationProfileResponse,
)
from app.services.calibration_service import CalibrationService


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/calibration", tags=["Калибровка"])


@router.post(
    "/start",
    response_model=CalibrationResponse,
    summary="Запуск калибровки",
    description=(
        "Обрабатывает 5 повторений упражнения для создания "
        "персонализированного биомеханического профиля."
    ),
)
async def start_calibration(
    request: CalibrationRequest,
    db: Session = Depends(get_db),
) -> CalibrationResponse:
    """
    Запускает процесс калибровки.

    Анализирует повторения упражнения, измеряет пропорции тела и характеристики
    движения, создаёт персональный профиль с безопасными диапазонами.

    Args:
        request: Данные калибровки с повторениями.
        db: Сессия базы данных.

    Returns:
        Результат калибровки с профилем и рекомендациями.

    Raises:
        HTTPException 400: Невалидные данные.
        HTTPException 500: Внутренняя ошибка.
    """
    print(f">>> [API] /calibration/start: user={request.user_id}, exercise={request.exercise_type}, reps={len(request.pose_sequence)}")

    # --- Защита: проверка landmarks в каждом кадре ---
    for rep_idx, rep_frames in enumerate(request.pose_sequence):
        for frame_idx, frame in enumerate(rep_frames):
            if len(frame) < 33:
                print(f">>> [API] ОТКАЗ: rep={rep_idx}, frame={frame_idx}, landmarks={len(frame)} < 33")
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Недостаточно точек для калибровки: "
                        f"rep={rep_idx}, frame={frame_idx}, "
                        f"получено {len(frame)}, требуется 33."
                    ),
                )

    try:
        print(">>> [API] Вызываю CalibrationService.process_calibration()...")
        result = CalibrationService.process_calibration(
            db=db,
            user_id=request.user_id,
            exercise_type=request.exercise_type,
            pose_sequence=request.pose_sequence,
        )
        print(f">>> [API] Калибровка завершена: completed={result.get('calibration_completed')}")
        print(">>> [API] /calibration/start: ответ отправлен.")
        return CalibrationResponse(**result)

    except ValueError as e:
        logger.warning(f"Ошибка валидации калибровки: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error(f"Неожиданная ошибка при калибровке: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Внутренняя ошибка сервера при калибровке",
        )


@router.get(
    "/{user_id}/{exercise_type}",
    response_model=CalibrationProfileResponse,
    summary="Получить профиль калибровки",
    description="Возвращает профиль калибровки для пользователя и упражнения.",
)
async def get_calibration_profile(
    user_id: str,
    exercise_type: str,
    db: Session = Depends(get_db),
) -> CalibrationProfileResponse:
    """
    Получает профиль калибровки пользователя.

    Args:
        user_id: ID пользователя Supabase.
        exercise_type: Тип упражнения (squat/deadlift).
        db: Сессия базы данных.

    Returns:
        Профиль калибровки.

    Raises:
        HTTPException 400: Недопустимый тип упражнения.
        HTTPException 404: Профиль калибровки не найден.
    """
    print(f">>> [API] GET /calibration/{user_id}/{exercise_type}")
    allowed_types = {"squat", "deadlift"}
    exercise_type_lower = exercise_type.lower()

    if exercise_type_lower not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"exercise_type должен быть одним из: {allowed_types}",
        )

    try:
        profile = CalibrationService.get_profile(
            db=db,
            user_id=user_id,
            exercise_type=exercise_type_lower,
        )

        if not profile:
            raise HTTPException(
                status_code=404,
                detail=f"Пройдите калибровку для {exercise_type_lower}",
            )

        return CalibrationProfileResponse.model_validate(profile)

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Ошибка получения профиля: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Внутренняя ошибка сервера",
        )
