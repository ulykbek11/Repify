"""
API эндпоинты тренировок.

GET /api/workouts/{user_id} — история тренировок
POST /api/workouts — создать запись о тренировке
GET /api/workouts/stats/{user_id} — статистика
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func

from app.database import get_db
from app.models.workout import Workout
from app.models.user import User
from app.schemas.workout import (
    WorkoutCreate,
    WorkoutResponse,
    WorkoutStatsResponse,
    ExerciseStats,
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/workouts", tags=["Тренировки"])


@router.get(
    "/stats/{user_id}",
    response_model=WorkoutStatsResponse,
    summary="Статистика тренировок",
    description="Общая и по-упражненческая статистика пользователя.",
)
async def get_workout_stats(
    user_id: str,
    db: Session = Depends(get_db),
) -> WorkoutStatsResponse:
    """
    Получает статистику тренировок пользователя.

    Группирует по типу упражнения: total_workouts, total_reps,
    average_score, best_score, last_workout.

    Args:
        user_id: ID пользователя.
        db: Сессия базы данных.

    Returns:
        Статистика по упражнениям.
    """
    try:
        workouts = (
            db.query(Workout)
            .filter(Workout.user_id == user_id)
            .all()
        )

        if not workouts:
            return WorkoutStatsResponse(
                user_id=user_id,
                total_workouts=0,
                total_reps=0,
                overall_average_score=0.0,
                by_exercise=[],
            )

        # Группируем по типу упражнения
        exercise_data: dict = {}
        for w in workouts:
            if w.exercise_type not in exercise_data:
                exercise_data[w.exercise_type] = {
                    "workouts": [],
                    "total_reps": 0,
                    "scores": [],
                }
            exercise_data[w.exercise_type]["workouts"].append(w)
            exercise_data[w.exercise_type]["total_reps"] += w.reps_completed
            if w.average_score > 0:
                exercise_data[w.exercise_type]["scores"].append(w.average_score)

        by_exercise = []
        total_reps = 0
        all_scores = []

        for ex_type, data in exercise_data.items():
            scores = data["scores"]
            avg_score = sum(scores) / len(scores) if scores else 0.0
            best_score = max(scores) if scores else 0.0
            last_workout = max(w.created_at for w in data["workouts"])
            total_reps += data["total_reps"]
            all_scores.extend(scores)

            by_exercise.append(ExerciseStats(
                exercise_type=ex_type,
                total_workouts=len(data["workouts"]),
                total_reps=data["total_reps"],
                average_score=round(avg_score, 2),
                best_score=round(best_score, 2),
                last_workout=last_workout,
            ))

        overall_avg = sum(all_scores) / len(all_scores) if all_scores else 0.0

        return WorkoutStatsResponse(
            user_id=user_id,
            total_workouts=len(workouts),
            total_reps=total_reps,
            overall_average_score=round(overall_avg, 2),
            by_exercise=by_exercise,
        )

    except Exception as e:
        logger.error(f"Ошибка получения статистики: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Внутренняя ошибка при получении статистики",
        )


@router.get(
    "/{user_id}",
    response_model=list[WorkoutResponse],
    summary="История тренировок",
    description="Список тренировок пользователя с фильтрацией по типу.",
)
async def get_workouts(
    user_id: str,
    exercise_type: Optional[str] = Query(
        None,
        description="Фильтр по типу упражнения: squat или deadlift",
    ),
    limit: int = Query(50, ge=1, le=200, description="Максимум записей"),
    offset: int = Query(0, ge=0, description="Смещение"),
    db: Session = Depends(get_db),
) -> list[WorkoutResponse]:
    """
    Получает историю тренировок пользователя.

    Поддерживает фильтрацию по типу упражнения и пагинацию.

    Args:
        user_id: ID пользователя.
        exercise_type: Фильтр по типу (опционально).
        limit: Максимум записей.
        offset: Смещение для пагинации.
        db: Сессия базы данных.

    Returns:
        Список тренировок.
    """
    try:
        query = db.query(Workout).filter(Workout.user_id == user_id)

        if exercise_type:
            et = exercise_type.lower()
            if et not in {"squat", "deadlift"}:
                raise HTTPException(
                    status_code=400,
                    detail="exercise_type должен быть squat или deadlift",
                )
            query = query.filter(Workout.exercise_type == et)

        workouts = (
            query.order_by(Workout.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        return [WorkoutResponse.model_validate(w) for w in workouts]

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Ошибка получения тренировок: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Внутренняя ошибка при получении тренировок",
        )


@router.post(
    "/",
    response_model=WorkoutResponse,
    status_code=201,
    summary="Сохранить тренировку",
    description="Создаёт запись о завершённой тренировке.",
)
async def create_workout(
    request: WorkoutCreate,
    db: Session = Depends(get_db),
) -> WorkoutResponse:
    """
    Создаёт запись о тренировке.

    Автоматически рассчитывает average_score из technique_scores.

    Args:
        request: Данные тренировки.
        db: Сессия базы данных.

    Returns:
        Созданная запись тренировки.

    Raises:
        HTTPException 400: Невалидные данные.
        HTTPException 500: Внутренняя ошибка.
    """
    try:
        # Обеспечиваем наличие пользователя
        existing_user = db.query(User).filter(User.id == request.user_id).first()
        if not existing_user:
            new_user = User(id=request.user_id)
            db.add(new_user)
            db.flush()

        # Рассчитываем среднюю оценку
        avg_score = 0.0
        if request.technique_scores:
            avg_score = sum(request.technique_scores) / len(request.technique_scores)

        workout = Workout(
            user_id=request.user_id,
            exercise_type=request.exercise_type,
            reps_completed=request.reps_completed,
            technique_scores=request.technique_scores,
            duration_seconds=request.duration_seconds,
            average_score=round(avg_score, 2),
            notes=request.notes,
        )

        db.add(workout)
        db.commit()
        db.refresh(workout)

        logger.info(
            f"Тренировка создана: {workout.id} "
            f"(user={request.user_id}, {request.exercise_type}, "
            f"{request.reps_completed} повторений, avg_score={avg_score:.2f})"
        )

        return WorkoutResponse.model_validate(workout)

    except Exception as e:
        db.rollback()
        logger.error(f"Ошибка создания тренировки: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Внутренняя ошибка при сохранении тренировки",
        )
