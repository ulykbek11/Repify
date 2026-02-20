"""
API эндпоинты анализа техники и подсчёта повторений.

POST /api/analyze-technique — анализ текущего кадра
POST /api/count-rep — подсчёт повторений (по кадру)
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.technique import (
    TechniqueAnalysisRequest,
    TechniqueAnalysisResponse,
    TechniqueError,
    TechniqueMetrics,
    RepCountRequest,
    RepCountResponse,
)
from app.services.technique_analyzer import TechniqueAnalyzer
from app.services.rep_counter_service import RepCounter


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Анализ техники"])


@router.post(
    "/analyze-technique",
    response_model=TechniqueAnalysisResponse,
    summary="Анализ техники упражнения",
    description=(
        "Анализирует технику на основе текущего кадра MediaPipe "
        "и персонализированного профиля пользователя."
    ),
)
async def analyze_technique(
    request: TechniqueAnalysisRequest,
    db: Session = Depends(get_db),
) -> TechniqueAnalysisResponse:
    """
    Анализирует технику одного кадра упражнения.

    Сравнивает текущее выполнение с личным baseline пользователя.
    Требует предварительной калибровки.

    Args:
        request: Данные кадра с 33 точками MediaPipe.
        db: Сессия базы данных.

    Returns:
        Оценка техники, список ошибок и фидбэк.

    Raises:
        HTTPException 404: Нет калибровочного профиля.
        HTTPException 400: Невалидные данные.
        HTTPException 500: Внутренняя ошибка.
    """
    print(f">>> [API] /analyze-technique: user={request.user_id}, exercise={request.exercise_type}, landmarks={len(request.landmarks)}")

    # --- Защита: проверка количества точек ---
    if len(request.landmarks) < 33:
        print(f">>> [API] ОТКАЗ: landmarks={len(request.landmarks)} < 33")
        raise HTTPException(
            status_code=400,
            detail=f"Недостаточно точек для анализа: получено {len(request.landmarks)}, требуется 33.",
        )

    try:
        print(">>> [API] Вызываю TechniqueAnalyzer.analyze()...")
        result = TechniqueAnalyzer.analyze(
            db=db,
            user_id=request.user_id,
            exercise_type=request.exercise_type,
            landmarks=request.landmarks,
        )
        print(f">>> [API] Анализ завершён, score={result['technique_score']}")

        response = TechniqueAnalysisResponse(
            technique_score=result["technique_score"],
            errors=[TechniqueError(**e) for e in result["errors"]],
            feedback=result["feedback"],
            metrics=TechniqueMetrics(**result["metrics"]),
        )
        print(">>> [API] /analyze-technique: ответ отправлен.")
        return response

    except ValueError as e:
        error_msg = str(e)
        # Если ошибка связана с отсутствием калибровки — 404
        if "калибровку" in error_msg.lower() or "calibration" in error_msg.lower():
            raise HTTPException(status_code=404, detail=error_msg)
        raise HTTPException(status_code=400, detail=error_msg)

    except KeyError as e:
        logger.warning(f"Отсутствует landmark: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Отсутствует точка тела: {e}. Убедитесь, что передаются все 33 точки MediaPipe.",
        )

    except Exception as e:
        logger.error(f"Ошибка анализа техники: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Внутренняя ошибка при анализе техники",
        )


@router.post(
    "/count-rep",
    response_model=RepCountResponse,
    summary="Подсчёт повторений",
    description=(
        "Обрабатывает один кадр для подсчёта повторений "
        "с помощью конечного автомата."
    ),
)
async def count_rep(
    request: RepCountRequest,
    db: Session = Depends(get_db),
) -> RepCountResponse:
    """
    Обрабатывает один кадр для подсчёта повторений.

    State machine отслеживает фазы движения
    и считает полные повторения.

    Args:
        request: Данные кадра с 33 точками MediaPipe.
        db: Сессия базы данных.

    Returns:
        Информация о текущем повторении и фазе.

    Raises:
        HTTPException 404: Нет калибровочного профиля.
        HTTPException 400: Невалидные данные.
        HTTPException 500: Внутренняя ошибка.
    """
    print(f">>> [API] /count-rep: user={request.user_id}, exercise={request.exercise_type}, landmarks={len(request.landmarks)}")

    # --- Защита: проверка количества точек ---
    if len(request.landmarks) < 33:
        print(f">>> [API] ОТКАЗ: landmarks={len(request.landmarks)} < 33")
        raise HTTPException(
            status_code=400,
            detail=f"Недостаточно точек для подсчёта: получено {len(request.landmarks)}, требуется 33.",
        )

    try:
        print(">>> [API] Вызываю RepCounter.process_frame()...")
        result = RepCounter.process_frame(
            db=db,
            user_id=request.user_id,
            exercise_type=request.exercise_type,
            landmarks=request.landmarks,
        )
        print(f">>> [API] Подсчёт завершён, reps={result['total_reps']}, phase={result['current_phase']}")

        response = RepCountResponse(**result)
        print(">>> [API] /count-rep: ответ отправлен.")
        return response

    except ValueError as e:
        error_msg = str(e)
        if "калибровку" in error_msg.lower() or "calibration" in error_msg.lower():
            raise HTTPException(status_code=404, detail=error_msg)
        raise HTTPException(status_code=400, detail=error_msg)

    except KeyError as e:
        logger.warning(f"Отсутствует landmark: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Отсутствует точка тела: {e}",
        )

    except Exception as e:
        logger.error(f"Ошибка подсчёта повторений: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Внутренняя ошибка при подсчёте повторений",
        )
