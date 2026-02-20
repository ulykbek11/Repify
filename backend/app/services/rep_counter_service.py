"""
Счётчик повторений с конечным автоматом (State Machine).

Отдельная state machine для приседаний и становой тяги.
Использует персонализированные пороги из калибровочного профиля.

Хранит состояние в памяти per-user/per-exercise для поддержки
непрерывного потока кадров во время тренировки.
"""

import logging
from typing import Any, Dict, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.calibration import CalibrationProfile
from app.utils.pose_math import (
    get_average_knee_angle,
    get_average_hip_angle,
    get_bar_position_estimate,
)


logger = logging.getLogger(__name__)


# =============================================================================
# Фазы приседаний
# =============================================================================
SQUAT_STANDING = "STANDING"
SQUAT_GOING_DOWN = "SQUATTING_DOWN"
SQUAT_BOTTOM = "BOTTOM"
SQUAT_GOING_UP = "STANDING_UP"

# =============================================================================
# Фазы становой тяги
# =============================================================================
DL_STANDING = "STANDING"
DL_SETUP = "SETUP"
DL_LIFTING = "LIFTING"
DL_LOCKOUT = "LOCKOUT"
DL_LOWERING = "LOWERING"


class RepCounter:
    """
    Счётчик повторений на основе конечного автомата.

    Хранит состояние каждого пользователя+упражнения в памяти.
    Использует персонализированные пороги из калибровки.
    """

    # Глобальное хранилище состояний: {(user_id, exercise_type): state_dict}
    _states: Dict[Tuple[str, str], Dict[str, Any]] = {}

    @classmethod
    def _get_state(cls, user_id: str, exercise_type: str) -> Dict[str, Any]:
        """
        Получает или создаёт состояние для пользователя.

        Args:
            user_id: ID пользователя.
            exercise_type: Тип упражнения.

        Returns:
            Словарь состояния с phase, reps, предыдущими значениями.
        """
        key = (user_id, exercise_type)
        if key not in cls._states:
            initial_phase = SQUAT_STANDING if exercise_type == "squat" else DL_STANDING
            cls._states[key] = {
                "phase": initial_phase,
                "reps": 0,
                "prev_angle": 180.0,
                "prev_bar_y": 0.0,
                "min_angle_in_rep": 180.0,
                "max_bar_y_in_rep": 0.0,
            }
        return cls._states[key]

    @classmethod
    def reset(cls, user_id: str, exercise_type: str) -> None:
        """
        Сбрасывает счётчик повторений для пользователя.

        Args:
            user_id: ID пользователя.
            exercise_type: Тип упражнения.
        """
        key = (user_id, exercise_type)
        if key in cls._states:
            del cls._states[key]
        logger.info(f"Сброс счётчика: {user_id}/{exercise_type}")

    @classmethod
    def _extract_landmarks(
        cls, landmarks: Dict[str, Any]
    ) -> Dict[str, Dict[str, float]]:
        """
        Преобразует landmarks из формата Pydantic в простой словарь.

        Args:
            landmarks: Точки MediaPipe.

        Returns:
            Словарь {name: {x, y, z}}.
        """
        result = {}
        for name, point in landmarks.items():
            if hasattr(point, "x"):
                result[name] = {"x": point.x, "y": point.y, "z": getattr(point, "z", 0.0)}
            elif isinstance(point, dict):
                result[name] = {
                    "x": point["x"],
                    "y": point["y"],
                    "z": point.get("z", 0.0),
                }
            else:
                result[name] = {"x": 0.0, "y": 0.0, "z": 0.0}
        return result

    @classmethod
    def _process_squat(
        cls,
        state: Dict[str, Any],
        landmarks: Dict[str, Dict[str, float]],
        profile: CalibrationProfile,
    ) -> Dict[str, Any]:
        """
        State machine для приседаний.

        STANDING (knee > 120°)
        ↓ knee < 120°
        SQUATTING_DOWN
        ↓ knee < user's natural_depth + 10°
        BOTTOM (достиг глубины)
        ↓ knee > user's natural_depth + 10°
        STANDING_UP
        ↓ knee > 120°
        STANDING ← +1 повторение

        Args:
            state: Текущее состояние автомата.
            landmarks: 33 точки текущего кадра.
            profile: Калибровочный профиль пользователя.

        Returns:
            Результат: rep_counted, total_reps, current_phase, key_angle.
        """
        knee_angle = get_average_knee_angle(landmarks)
        rep_counted = False

        # Персонализированный порог глубины
        natural_depth = profile.baseline_metrics.get("natural_squat_depth", 90.0)
        depth_threshold = natural_depth + 10.0

        # Пороги фаз
        standing_threshold = 140.0  # Выше этого = стоит
        going_down_threshold = 130.0  # Начало приседания

        phase = state["phase"]

        if phase == SQUAT_STANDING:
            if knee_angle < going_down_threshold:
                state["phase"] = SQUAT_GOING_DOWN
                state["min_angle_in_rep"] = knee_angle
                logger.debug(f"SQUAT: STANDING → SQUATTING_DOWN (knee={knee_angle:.1f}°)")

        elif phase == SQUAT_GOING_DOWN:
            state["min_angle_in_rep"] = min(state["min_angle_in_rep"], knee_angle)
            if knee_angle < depth_threshold:
                state["phase"] = SQUAT_BOTTOM
                logger.debug(f"SQUAT: SQUATTING_DOWN → BOTTOM (knee={knee_angle:.1f}°)")

        elif phase == SQUAT_BOTTOM:
            state["min_angle_in_rep"] = min(state["min_angle_in_rep"], knee_angle)
            if knee_angle > depth_threshold:
                state["phase"] = SQUAT_GOING_UP
                logger.debug(f"SQUAT: BOTTOM → STANDING_UP (knee={knee_angle:.1f}°)")

        elif phase == SQUAT_GOING_UP:
            if knee_angle > standing_threshold:
                state["phase"] = SQUAT_STANDING
                state["reps"] += 1
                rep_counted = True
                logger.info(
                    f"SQUAT: повторение #{state['reps']} "
                    f"(мин. угол: {state['min_angle_in_rep']:.1f}°)"
                )
                state["min_angle_in_rep"] = 180.0

        state["prev_angle"] = knee_angle

        return {
            "rep_counted": rep_counted,
            "total_reps": state["reps"],
            "current_phase": state["phase"],
            "key_angle": round(knee_angle, 1),
        }

    @classmethod
    def _process_deadlift(
        cls,
        state: Dict[str, Any],
        landmarks: Dict[str, Dict[str, float]],
        profile: CalibrationProfile,
    ) -> Dict[str, Any]:
        """
        State machine для становой тяги.

        STANDING (hip > 160°)
        ↓ hip < 120° (наклонился к штанге)
        SETUP (в стартовой позиции)
        ↓ hip > 120° && bar.y увеличивается
        LIFTING (тянет вверх)
        ↓ hip > 160° && bar.y максимальна
        LOCKOUT (встал со штангой)
        ↓ hip < 120° (опускает)
        LOWERING
        ↓ bar.y минимальна → STANDING ← +1 повторение

        Args:
            state: Текущее состояние автомата.
            landmarks: 33 точки текущего кадра.
            profile: Калибровочный профиль пользователя.

        Returns:
            Результат: rep_counted, total_reps, current_phase, key_angle.
        """
        hip_angle = get_average_hip_angle(landmarks)
        rep_counted = False

        # Позиция штанги (кисти рук)
        bar_pos = get_bar_position_estimate(landmarks)
        bar_y = bar_pos["y"] if bar_pos else 0.5

        # Персонализированные пороги
        nat_hip = profile.baseline_metrics.get("natural_start_hip_angle", 80.0)

        # Пороги фаз
        standing_threshold = 155.0  # Стоит прямо
        setup_threshold = 130.0  # Наклон к штанге
        lockout_threshold = 155.0  # Полное выпрямление

        phase = state["phase"]

        if phase == DL_STANDING:
            if hip_angle < setup_threshold:
                state["phase"] = DL_SETUP
                state["max_bar_y_in_rep"] = bar_y
                logger.debug(f"DEADLIFT: STANDING → SETUP (hip={hip_angle:.1f}°)")

        elif phase == DL_SETUP:
            # В MediaPipe ось Y направлена ВНИЗ: bar.y уменьшается при подъёме
            if hip_angle > setup_threshold and bar_y < state.get("prev_bar_y", bar_y):
                state["phase"] = DL_LIFTING
                logger.debug(f"DEADLIFT: SETUP → LIFTING (hip={hip_angle:.1f}°)")
            state["max_bar_y_in_rep"] = max(state.get("max_bar_y_in_rep", 0), bar_y)

        elif phase == DL_LIFTING:
            if hip_angle > lockout_threshold:
                state["phase"] = DL_LOCKOUT
                logger.debug(f"DEADLIFT: LIFTING → LOCKOUT (hip={hip_angle:.1f}°)")

        elif phase == DL_LOCKOUT:
            if hip_angle < setup_threshold:
                state["phase"] = DL_LOWERING
                logger.debug(f"DEADLIFT: LOCKOUT → LOWERING (hip={hip_angle:.1f}°)")

        elif phase == DL_LOWERING:
            # Штанга вернулась вниз (bar_y увеличился ≈ на уровне начала)
            if bar_y > state.get("max_bar_y_in_rep", 0) * 0.85 or hip_angle > standing_threshold:
                state["phase"] = DL_STANDING
                state["reps"] += 1
                rep_counted = True
                logger.info(f"DEADLIFT: повторение #{state['reps']}")
                state["max_bar_y_in_rep"] = 0.0

        state["prev_bar_y"] = bar_y
        state["prev_angle"] = hip_angle

        return {
            "rep_counted": rep_counted,
            "total_reps": state["reps"],
            "current_phase": state["phase"],
            "key_angle": round(hip_angle, 1),
        }

    @classmethod
    def process_frame(
        cls,
        db: Session,
        user_id: str,
        exercise_type: str,
        landmarks: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Обрабатывает один кадр для подсчёта повторений.

        Требует калибровочный профиль для персонализированных порогов.

        Args:
            db: Сессия базы данных.
            user_id: ID пользователя.
            exercise_type: Тип упражнения (squat/deadlift).
            landmarks: 33 точки MediaPipe текущего кадра.

        Returns:
            Словарь с rep_counted, total_reps, current_phase, key_angle.

        Raises:
            ValueError: Если нет калибровочного профиля.
        """
        # Получаем профиль калибровки
        print(f">>> [SERVICE] RepCounter.process_frame(): user={user_id}, exercise={exercise_type}, landmarks={len(landmarks)}")
        print(">>> [SERVICE] Запрос к профилю калибровки...")
        profile = (
            db.query(CalibrationProfile)
            .filter(
                CalibrationProfile.user_id == user_id,
                CalibrationProfile.exercise_type == exercise_type,
            )
            .first()
        )
        print(f">>> [SERVICE] Профиль найден: {profile is not None}")

        if not profile:
            raise ValueError(
                f"Пройдите калибровку для {exercise_type}. "
                f"Отправьте POST /api/calibration/start"
            )

        # Конвертируем landmarks
        print(">>> [SERVICE] Конвертирую landmarks...")
        lm = cls._extract_landmarks(landmarks)

        # Получаем состояние
        state = cls._get_state(user_id, exercise_type)
        print(f">>> [SERVICE] Текущее состояние: phase={state['phase']}, reps={state['reps']}")

        if exercise_type == "squat":
            print(">>> [SERVICE] Обрабатываю кадр (squat)...")
            result = cls._process_squat(state, lm, profile)
        elif exercise_type == "deadlift":
            print(">>> [SERVICE] Обрабатываю кадр (deadlift)...")
            result = cls._process_deadlift(state, lm, profile)
        else:
            raise ValueError(f"Неизвестный тип упражнения: {exercise_type}")

        print(f">>> [SERVICE] Кадр обработан: phase={result['current_phase']}, reps={result['total_reps']}, counted={result['rep_counted']}")
        return result
