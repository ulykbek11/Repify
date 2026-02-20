"""
Compatibility API — эндпоинты, соответствующие запросам фронтенда.

Фронтенд отправляет данные в другом формате чем основной API.
Этот модуль транслирует запросы фронтенда в формат сервисов.

Эндпоинты:
  POST /api/calibrate   — калибровка (фронтенд-формат)
  GET  /api/profile/{user_id}/exists — проверка наличия профиля
  POST /api/count-reps  — подсчёт повторений (pose_sequence, не одиночный кадр)
  POST /api/analyze-technique — полный анализ (pose_sequence, не одиночный кадр)
"""

import logging
import math
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
import os
import tempfile
import uuid

from app.database import get_db
from app.models.calibration import CalibrationProfile
from app.models.user import User
from app.services.calibration_service import CalibrationService
from app.services.technique_analyzer import TechniqueAnalyzer
from app.services.rep_counter_service import RepCounter
from app.services.video_processor import VideoProcessor
from app.utils.pose_math import (
    get_average_knee_angle,
    get_average_hip_angle,
    calculate_torso_lean,
    calculate_back_angle,
    calculate_symmetry,
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Frontend Compatibility"])


# =============================================================================
# Pydantic models для фронтенд-формата
# =============================================================================

class FrontendLandmark(BaseModel):
    x: float
    y: float
    z: float = 0.0
    visibility: float = 0.0


class FrontendFrame(BaseModel):
    landmarks: List[FrontendLandmark]
    timestamp: Optional[float] = None


class CalibrateRequest(BaseModel):
    user_id: str
    exercise: str = "squats"
    pose_sequence: List[FrontendFrame]
    user_metadata: Optional[Dict[str, Any]] = None


class AnalyzeRequest(BaseModel):
    user_id: str
    exercise: str = "squats"
    pose_sequence: List[FrontendFrame]


class RepCountRequest(BaseModel):
    user_id: str
    exercise: str = "squats"
    pose_sequence: List[FrontendFrame]


# =============================================================================
# MediaPipe 33 landmark индексы → имена
# =============================================================================

MEDIAPIPE_LANDMARK_NAMES = [
    "nose",
    "left_eye_inner", "left_eye", "left_eye_outer",
    "right_eye_inner", "right_eye", "right_eye_outer",
    "left_ear", "right_ear",
    "mouth_left", "mouth_right",
    "left_shoulder", "right_shoulder",
    "left_elbow", "right_elbow",
    "left_wrist", "right_wrist",
    "left_pinky", "right_pinky",
    "left_index", "right_index",
    "left_thumb", "right_thumb",
    "left_hip", "right_hip",
    "left_knee", "right_knee",
    "left_ankle", "right_ankle",
    "left_heel", "right_heel",
    "left_foot_index", "right_foot_index",
]


def _normalize_exercise(raw: str) -> str:
    """Нормализует тип упражнения: squats → squat, deadlifts → deadlift."""
    raw = raw.lower().strip()
    if raw in ("squats", "squat", "присед", "приседания"):
        return "squat"
    if raw in ("deadlifts", "deadlift", "тяга", "становая"):
        return "deadlift"
    return "squat"


def _landmarks_array_to_dict(
    landmarks: List[FrontendLandmark],
) -> Dict[str, Dict[str, float]]:
    """
    Конвертирует массив из 33 landmarks (фронтенд) в словарь (бэкенд).

    Фронтенд отправляет MediaPipe landmarks как массив из 33 объектов {x, y, z}.
    Бэкенд использует словарь {name: {x, y, z}}.
    """
    result = {}
    for i, lm in enumerate(landmarks):
        if i < len(MEDIAPIPE_LANDMARK_NAMES):
            name = MEDIAPIPE_LANDMARK_NAMES[i]
            result[name] = {"x": lm.x, "y": lm.y, "z": lm.z}
    return result


def _split_into_reps(
    frames: List[Dict[str, Dict[str, float]]],
    exercise_type: str,
) -> List[List[Dict[str, Dict[str, float]]]]:
    """
    Разбивает непрерывный поток кадров на отдельные повторения.
    Находит пики и впадины в ключевом угле.
    """
    if len(frames) < 10:
        return [frames]

    # Ключевой угол для определения фаз
    angles = []
    for f in frames:
        try:
            if exercise_type == "squat":
                angles.append(get_average_knee_angle(f))
            else:
                angles.append(get_average_hip_angle(f))
        except (KeyError, ValueError):
            angles.append(180.0)

    # Находим минимумы (нижние точки повторений)
    min_indices = []
    for i in range(2, len(angles) - 2):
        if (angles[i] < angles[i - 1] and angles[i] < angles[i - 2] and
                angles[i] < angles[i + 1] and angles[i] < angles[i + 2]):
            # Минимум должен быть достаточно глубоким
            if angles[i] < 140:
                min_indices.append(i)

    # Убираем минимумы, которые слишком близко друг к другу
    if min_indices:
        filtered = [min_indices[0]]
        min_gap = max(10, len(frames) // 10)
        for idx in min_indices[1:]:
            if idx - filtered[-1] >= min_gap:
                filtered.append(idx)
        min_indices = filtered

    # Разбиваем по минимумам
    if len(min_indices) >= 2:
        reps = []
        for i in range(len(min_indices)):
            if i == 0:
                start = 0
            else:
                start = (min_indices[i - 1] + min_indices[i]) // 2

            if i == len(min_indices) - 1:
                end = len(frames)
            else:
                end = (min_indices[i] + min_indices[i + 1]) // 2

            reps.append(frames[start:end])
        return reps

    # Если 1 повторение
    return [frames]


def _median_smooth(angles: List[float], window: int = 5) -> List[float]:
    """
    Медианное сглаживание угловых данных.

    Устойчиво к выбросам (спайкам) в отличие от простого усреднения.
    Подход аналогичен Good-GYM: медиана + фильтр выбросов.
    """
    import numpy as np
    out = angles.copy()
    for i in range(window, len(angles) - window):
        window_vals = np.array(angles[i - window:i + window + 1])
        median = float(np.median(window_vals))
        std = float(np.std(window_vals))
        # Убираем выбросы — точки дальше 2σ от медианы
        filtered = window_vals[np.abs(window_vals - median) <= 2 * std]
        out[i] = float(np.mean(filtered)) if len(filtered) > 0 else median
    return out


def _count_reps_from_sequence(
    frames: List[Dict[str, Dict[str, float]]],
    exercise_type: str,
    profile: Optional[CalibrationProfile] = None,
) -> Dict[str, Any]:
    """
    Подсчитывает повторения из полной последовательности кадров.

    Использует двухфазный автомат (Good-GYM-подход) + медианное сглаживание.
    Пороги берутся из калибровочного профиля пользователя.

    Алгоритм:
      - stage="up"  когда угол > up_threshold  (стоит)
      - stage="down" когда угол < down_threshold (нижняя точка)
      - Повторение засчитывается при переходе "down" → "up"
    """
    import numpy as np

    if not frames:
        return {
            "total_reps": 0,
            "full_reps": 0,
            "partial_reps": 0,
            "consistency_score": 0.0,
            "fatigue_analysis": {"detected": False},
        }

    # Вычисляем ключевой угол для каждого кадра
    raw_angles: List[float] = []
    for f in frames:
        try:
            if exercise_type == "squat":
                raw_angles.append(get_average_knee_angle(f))
            else:
                raw_angles.append(get_average_hip_angle(f))
        except (KeyError, ValueError):
            raw_angles.append(180.0)

    # Медианное сглаживание (окно 5, как в Good-GYM)
    smoothed = _median_smooth(raw_angles, window=5)

    # Пороги из калибровки или разумные значения по умолчанию
    # Good-GYM для приседаний: up_angle=160, down_angle=110
    if exercise_type == "squat":
        up_threshold = 155.0  # стоит прямо
        if profile:
            natural_depth = profile.baseline_metrics.get("natural_squat_depth", 95.0)
            # Нижний порог — чуть выше естественной глубины (≈полное повторение)
            down_threshold = natural_depth + 15.0
            # Частичное повторение — не достигает полной глубины, но согнулось
            partial_down_threshold = natural_depth + 30.0
        else:
            down_threshold = 110.0       # Good-GYM default
            partial_down_threshold = 130.0
    else:
        up_threshold = 155.0
        if profile:
            natural_hip = profile.baseline_metrics.get("natural_start_hip_angle", 80.0)
            down_threshold = natural_hip + 15.0
            partial_down_threshold = natural_hip + 30.0
        else:
            down_threshold = 100.0
            partial_down_threshold = 120.0

    # Двухфазный автомат
    stage: Optional[str] = None
    full_reps = 0
    partial_reps = 0
    rep_depths: List[float] = []       # минимальные углы каждого повторения
    min_angle_in_rep = 180.0

    for angle in smoothed:
        if angle > up_threshold:
            if stage == "down":
                # Завершено полное повторение — засчитываем
                if min_angle_in_rep < down_threshold:
                    full_reps += 1
                elif min_angle_in_rep < partial_down_threshold:
                    partial_reps += 1
                rep_depths.append(min_angle_in_rep)
                min_angle_in_rep = 180.0
            stage = "up"
        elif angle < partial_down_threshold:
            # Вошли в фазу приседа (любая глубина ниже частичного порога)
            min_angle_in_rep = min(min_angle_in_rep, angle)
            stage = "down"
            # Детектор недоседа: если подъем начался не достигнув down_threshold
            # Это логически можно проверить при выходе из `down`.
        elif stage == "down":
            # Продолжаем отслеживать минимум пока не встали
            min_angle_in_rep = min(min_angle_in_rep, angle)

    total_reps = full_reps + partial_reps

    # Оценка консистентности
    consistency = 0.85
    if len(rep_depths) >= 2:
        std = float(np.std(rep_depths))
        consistency = max(0.0, min(1.0, 1.0 - std / 30.0))

    # Анализ усталости
    fatigue: Dict[str, Any] = {"detected": False}
    if len(rep_depths) >= 3:
        half = len(rep_depths) // 2
        avg_first = float(np.mean(rep_depths[:half]))
        avg_second = float(np.mean(rep_depths[half:]))
        # Если во второй половине глубина уменьшилась (угол вырос), это усталость
        if avg_second > avg_first + 5:
            fatigue = {
                "detected": True,
                "message": "Глубина снижается к концу подхода — признак усталости",
            }

    return {
        "total_reps": total_reps,
        "full_reps": full_reps,
        "partial_reps": partial_reps,
        "consistency_score": round(consistency, 2),
        "fatigue_analysis": fatigue,
    }


def _analyze_technique_from_sequence(
    frames: List[Dict[str, Dict[str, float]]],
    exercise_type: str,
    profile: Optional[CalibrationProfile],
) -> Dict[str, Any]:
    """
    Анализирует технику из полной последовательности кадров.

    Находит ключевые кадры (нижняя точка каждого повторения)
    и анализирует их. Возвращает усреднённый результат.
    """
    if not frames:
        return {
            "overall_score": 0,
            "quality_breakdown": {},
            "personalized_feedback": {"areas_to_improve": []},
            "comparison_to_calibration": {},
        }

    # Анализируем кадры с минимальным углом (ключевые)
    scores = []
    all_errors = []

    # Берём каждый N-й кадр для анализа (не каждый кадр для производительности)
    step = max(1, len(frames) // 30)
    key_frames = frames[::step]

    for frame in key_frames:
        try:
            if profile:
                result = TechniqueAnalyzer._analyze_squat(frame, profile) \
                    if exercise_type == "squat" \
                    else TechniqueAnalyzer._analyze_deadlift(frame, profile)
                scores.append(result["technique_score"])
                all_errors.extend(result.get("errors", []))
            else:
                # Без калибровки — базовый анализ по углам
                if exercise_type == "squat":
                    knee = get_average_knee_angle(frame)
                    lean = calculate_torso_lean(frame)
                    score = 0.8
                    if knee < 60:
                        score -= 0.2
                    if lean > 50:
                        score -= 0.15
                    scores.append(max(0, score))
                else:
                    back = calculate_back_angle(frame)
                    score = 0.8
                    if back < 150:
                        score -= 0.2
                    scores.append(max(0, score))
        except (KeyError, ValueError):
            continue
            
        # Реализация детектора "Отрыва пяток"
        if exercise_type == "squat":
            try:
                left_foot = frame.get("left_foot_index")
                left_heel = frame.get("left_heel")
                right_foot = frame.get("right_foot_index")
                right_heel = frame.get("right_heel")
                
                # Check absolute positions if expected a baseline
                if left_foot and left_heel and right_foot and right_heel:
                    left_diff = left_foot["y"] - left_heel["y"]
                    right_diff = right_foot["y"] - right_heel["y"]
                    
                    if profile:
                        base_left = profile.baseline_metrics.get("heel_foot_diff_left", left_diff)
                        base_right = profile.baseline_metrics.get("heel_foot_diff_right", right_diff)
                        # Если разница стала значительно меньше, значит пятка поднялась (y-координаты уменьшаются вверх)
                        if (base_left - left_diff > 0.05) or (base_right - right_diff > 0.05):
                            all_errors.append({
                                "error_type": "heel_rise",
                                "message": "Опора потеряна: не отрывай пятки от пола!",
                                "severity": "high"
                            })
            except Exception:
                pass
                
        # Реализация детектора "Недоседа"
        if exercise_type == "squat" and profile:
            knee = get_average_knee_angle(frame)
            natural_depth = profile.baseline_metrics.get("natural_squat_depth", 95.0)
            if knee > natural_depth + 20.0:
                all_errors.append({
                    "error_type": "insufficient_depth", 
                    "message": "Недосед: садись глубже до параллели.",
                    "severity": "medium"
                })

    avg_score = sum(scores) / len(scores) if scores else 0.5
    overall_score = round(avg_score * 100)

    # Deduplicate errors by type
    seen_errors = set()
    unique_errors = []
    for err in all_errors:
        et = err.get("error_type", "")
        if et not in seen_errors:
            seen_errors.add(et)
            unique_errors.append(err)

    # Build quality breakdown
    breakdown = {}
    if exercise_type == "squat":
        depth_errors = [e for e in unique_errors if e.get("error_type") in (
            "excessive_depth", "insufficient_depth"
        )]
        knee_errors = [e for e in unique_errors if e.get("error_type") in (
            "knee_valgus", "knees_over_toes"
        )]
        back_errors = [e for e in unique_errors if e.get("error_type") in (
            "excessive_forward_lean",
        )]
        balance_errors = [e for e in unique_errors if e.get("error_type") in (
            "balance", "asymmetry"
        )]
        heel_errors = [e for e in unique_errors if e.get("error_type") in (
            "heel_rise",
        )]

        breakdown["depth"] = {
            "score": max(0, 20 - len(depth_errors) * 5),
            "feedback": depth_errors[0]["message"] if depth_errors else "Глубина в норме ✅",
        }
        breakdown["knee_alignment"] = {
            "score": max(0, 20 - len(knee_errors) * 5),
            "feedback": knee_errors[0]["message"] if knee_errors else "Колени в правильной позиции ✅",
        }
        breakdown["back_position"] = {
            "score": max(0, 20 - len(back_errors) * 5),
            "feedback": back_errors[0]["message"] if back_errors else "Спина в правильном положении ✅",
        }
        breakdown["balance"] = {
            "score": max(0, 20 - len(balance_errors) * 5),
            "feedback": balance_errors[0]["message"] if balance_errors else "Баланс стабильный ✅",
        }
        breakdown["foot_position"] = {
            "score": max(0, 20 - len(heel_errors) * 10),
            "feedback": heel_errors[0]["message"] if heel_errors else "Пятки на полу ✅",
        }
    else:
        back_errors = [e for e in unique_errors if e.get("error_type") in ("rounded_back",)]
        hip_errors = [e for e in unique_errors if e.get("error_type") in ("hips_too_low", "hips_too_high")]
        bar_errors = [e for e in unique_errors if e.get("error_type") in ("bar_too_far", "shoulder_position")]

        breakdown["back_position"] = {
            "score": max(0, 25 - len(back_errors) * 8),
            "feedback": back_errors[0]["message"] if back_errors else "Спина прямая ✅",
        }
        breakdown["hip_hinge"] = {
            "score": max(0, 25 - len(hip_errors) * 8),
            "feedback": hip_errors[0]["message"] if hip_errors else "Позиция бёдер в норме ✅",
        }
        breakdown["bar_path"] = {
            "score": max(0, 25 - len(bar_errors) * 8),
            "feedback": bar_errors[0]["message"] if bar_errors else "Траектория штанги оптимальна ✅",
        }

    # Personalized feedback
    areas_to_improve = [e["message"] for e in unique_errors[:3]]
    strengths = []
    if overall_score >= 80:
        strengths.append("Хорошая общая техника")
    if not any(e.get("severity") == "high" for e in unique_errors):
        strengths.append("Нет критических ошибок")

    return {
        "overall_score": overall_score,
        "quality_breakdown": breakdown,
        "personalized_feedback": {
            "areas_to_improve": areas_to_improve,
            "strengths": strengths,
        },
        "comparison_to_calibration": {
            "has_profile": profile is not None,
        },
    }


# =============================================================================
# Эндпоинты
# =============================================================================

@router.get(
    "/profile/{user_id}/exists",
    summary="Проверить наличие калибровочного профиля",
)
async def check_profile_exists(
    user_id: str,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Проверяет, есть ли калибровочный профиль у пользователя."""
    profile = (
        db.query(CalibrationProfile)
        .filter(CalibrationProfile.user_id == user_id)
        .first()
    )
    return {"exists": profile is not None, "user_id": user_id}


@router.post(
    "/calibrate",
    summary="Калибровка (фронтенд-формат)",
)
async def calibrate_frontend(
    request: CalibrateRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Калибровка в формате фронтенда.

    Принимает pose_sequence как массив кадров (каждый с 33 landmarks).
    Автоматически разбивает на 5 повторений и вызывает CalibrationService.
    """
    try:
        print(f">>> [API] /calibrate: user={request.user_id}, exercise={request.exercise}, frames={len(request.pose_sequence)}")
        exercise_type = _normalize_exercise(request.exercise)

        # Конвертируем массив landmarks → словарь
        print(">>> [API] Конвертирую кадры...")
        frames = []
        for frame in request.pose_sequence:
            if len(frame.landmarks) >= 33:
                frames.append(_landmarks_array_to_dict(frame.landmarks))

        if len(frames) < 15:
            raise ValueError(f"Недостаточно кадров: {len(frames)}. Нужно минимум 15.")

        logger.info(f"Калибровка: {len(frames)} кадров, exercise={exercise_type}")

        # Разбиваем на повторения
        print(f">>> [API] Разбиваю {len(frames)} кадров на повторения...")
        reps = _split_into_reps(frames, exercise_type)

        if not reps:
            reps = [frames]
        print(f">>> [API] Обнаружено {len(reps)} повторений")

        # Вызываем калибровку
        print(">>> [API] Вызываю CalibrationService.process_calibration()...")
        result = CalibrationService.process_calibration(
            db=db,
            user_id=request.user_id,
            exercise_type=exercise_type,
            pose_sequence=reps,
        )
        print(">>> [API] /calibrate: ответ отправлен.")

        return {
            "success": True,
            **result,
        }

    except ValueError as e:
        logger.warning(f"Ошибка калибровки: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error(f"Ошибка калибровки: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/count-reps",
    summary="Подсчёт повторений (фронтенд-формат)",
)
async def count_reps_frontend(
    request: RepCountRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Подсчитывает повторения из всей последовательности кадров.

    Отличается от /count-rep (единичный кадр) тем, что принимает
    всю видео-последовательность и анализирует целиком.
    """
    try:
        print(f">>> [API] /count-reps: user={request.user_id}, exercise={request.exercise}, frames={len(request.pose_sequence)}")
        exercise_type = _normalize_exercise(request.exercise)

        frames = []
        for frame in request.pose_sequence:
            if len(frame.landmarks) >= 33:
                frames.append(_landmarks_array_to_dict(frame.landmarks))

        if not frames:
            return {
                "total_reps": 0,
                "full_reps": 0,
                "partial_reps": 0,
                "consistency_score": 0.0,
                "fatigue_analysis": {"detected": False},
            }

        # Загружаем профиль для персонализированных порогов глубины
        print(">>> [API] Запрос к профилю...")
        profile = (
            db.query(CalibrationProfile)
            .filter(
                CalibrationProfile.user_id == request.user_id,
                CalibrationProfile.exercise_type == exercise_type,
            )
            .first()
        )

        print(f">>> [API] Подсчёт повторений из {len(frames)} кадров...")
        result = _count_reps_from_sequence(frames, exercise_type, profile)
        print(f">>> [API] /count-reps: reps={result['total_reps']}, ответ отправлен.")
        return result

    except Exception as e:
        logger.error(f"Ошибка подсчёта: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/analyze-technique",
    summary="Анализ техники (фронтенд-формат)",
)
async def analyze_technique_frontend(
    request: AnalyzeRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Анализирует технику из всей последовательности кадров.

    Использует калибровочный профиль если есть.
    Работает и без профиля (с базовым анализом).
    """
    try:
        print(f">>> [API] /analyze-technique (compat): user={request.user_id}, exercise={request.exercise}, frames={len(request.pose_sequence)}")
        exercise_type = _normalize_exercise(request.exercise)

        frames = []
        for frame in request.pose_sequence:
            if len(frame.landmarks) >= 33:
                frames.append(_landmarks_array_to_dict(frame.landmarks))

        if not frames:
            return {
                "overall_score": 0,
                "quality_breakdown": {},
                "personalized_feedback": {"areas_to_improve": ["Нет данных для анализа"]},
                "comparison_to_calibration": {},
            }

        # Пробуем получить профиль калибровки
        print(">>> [API] Запрос к профилю...")
        profile = (
            db.query(CalibrationProfile)
            .filter(
                CalibrationProfile.user_id == request.user_id,
                CalibrationProfile.exercise_type == exercise_type,
            )
            .first()
        )

        print(f">>> [API] Анализ техники из {len(frames)} кадров...")
        result = _analyze_technique_from_sequence(frames, exercise_type, profile)
        print(f">>> [API] /analyze-technique (compat): score={result.get('overall_score')}, ответ отправлен.")
        return result

    except Exception as e:
        logger.error(f"Ошибка анализа: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post(
    "/extract-poses",
    summary="Извлечь позы из видео",
)
async def extract_poses_frontend(
    video: UploadFile = File(...)
) -> Dict[str, Any]:
    """
    Новый эндпоинт для видео экстракции MediaPipe.
    Использует потоковое сохранение и выборочный анализ кадров.
    """
    import shutil
    print(f">>> [UPLOAD] Начало загрузки: {video.filename}")
    print(f">>> [FILE] Received: {video.filename}, Size: {video.size} bytes, Type: {video.content_type}")
    temp_file_path = None
    try:
        # Потоковое сохранение — не загружаем весь файл в RAM
        temp_fd, temp_file_path = tempfile.mkstemp(suffix=".mp4")
        with os.fdopen(temp_fd, 'wb') as f:
            shutil.copyfileobj(video.file, f, length=1024 * 1024)  # 1MB chunks
        print(f">>> [UPLOAD] Файл сохранён: {temp_file_path}")

        import cv2
        from fastapi.responses import JSONResponse
        
        cap = cv2.VideoCapture(temp_file_path)
        if not cap.isOpened():
            print(">>> [ERROR] OpenCV could not open the video file!")
            return JSONResponse(status_code=400, content={"error": "Invalid video format"})
        
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        cap.release()
        print(f">>> [VIDEO] total_frames={total_frames}, fps={fps}")

        processor = VideoProcessor()
        # Выборочный анализ: ~40 кадров из всего видео
        backend_frames = processor.extract_poses(temp_file_path, target_frames=40)
        
        if not backend_frames:
            print(">>> [DEBUG] No poses found in first 50 frames")
            raise ValueError("В видео не найдены люди или кадры")

        # Frontend expects its own format
        frontend_frames = []
        for idx, b_frame in enumerate(backend_frames):
            lm_list = []
            for name in MEDIAPIPE_LANDMARK_NAMES:
                val = b_frame.get(name, {"x": 0.0, "y": 0.0, "z": 0.0, "visibility": 0.0})
                lm_list.append({
                    "x": val["x"],
                    "y": val["y"],
                    "z": val["z"],
                    "visibility": val.get("visibility", 0.0)
                })
            frontend_frames.append({
                "landmarks": lm_list,
                "timestamp": idx * 33
            })

        return {"pose_sequence": frontend_frames}

    except Exception as e:
        print(f">>> [CRITICAL] {str(e)}")
        logger.error(f"Ошибка процессинга видео MediaPipe: {e}", exc_info=True)
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"error": str(e)})
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
