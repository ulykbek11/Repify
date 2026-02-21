"""
Счётчик повторений с конечным автоматом (State Machine).

Работает БЕЗ калибровочного профиля (universal thresholds)
и С профилем (персонализированные пороги).

Использует LEFT сторону тела (боковая съёмка).

State machine приседаний:
  STANDING (knee > 140°)
  ↓ knee < 130°
  SQUATTING_DOWN
  ↓ knee < depth_threshold (100° universal, или personal)
  BOTTOM
  ↓ knee > depth_threshold
  STANDING_UP
  ↓ knee > 140°
  STANDING ← +1 повторение ✅
"""

import logging
from typing import Any, Dict, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.calibration import CalibrationProfile
from app.utils.pose_math import (
    get_knee_angle,
    get_hip_angle,
    get_average_knee_angle,
    get_average_hip_angle,
    get_bar_position_estimate,
)


logger = logging.getLogger(__name__)

# =============================================================================
# Универсальные пороги (без калибровки)
# =============================================================================
UNIVERSAL_SQUAT_DEPTH     = 100.0   # Нижняя точка
UNIVERSAL_SQUAT_STANDING  = 150.0   # Стоит прямо
UNIVERSAL_SQUAT_GOING_DOWN = 140.0  # Начало приседа

UNIVERSAL_DL_SETUP        = 130.0   # Наклон к штанге
UNIVERSAL_DL_LOCKOUT      = 155.0   # Стоит со штангой

# =============================================================================
# Фазы
# =============================================================================
SQUAT_STANDING   = "STANDING"
SQUAT_GOING_DOWN = "SQUATTING_DOWN"
SQUAT_BOTTOM     = "BOTTOM"
SQUAT_GOING_UP   = "STANDING_UP"

DL_STANDING  = "STANDING"
DL_SETUP     = "SETUP"
DL_LIFTING   = "LIFTING"
DL_LOCKOUT   = "LOCKOUT"
DL_LOWERING  = "LOWERING"


class RepCounter:
    """
    Счётчик повторений на основе конечного автомата.

    Хранит состояние per-user/per-exercise в памяти.
    Работает с профилем и без профиля.
    """

    _states: Dict[Tuple[str, str], Dict[str, Any]] = {}

    @classmethod
    def _get_state(cls, user_id: str, exercise_type: str) -> Dict[str, Any]:
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
        key = (user_id, exercise_type)
        if key in cls._states:
            del cls._states[key]
        print(f"🔄 [RepCounter] Сброс: {user_id}/{exercise_type}")

    @classmethod
    def _extract_landmarks(cls, landmarks: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
        result = {}
        for name, point in landmarks.items():
            if hasattr(point, "x"):
                result[name] = {"x": point.x, "y": point.y, "z": getattr(point, "z", 0.0)}
            elif isinstance(point, dict):
                result[name] = {"x": point["x"], "y": point["y"], "z": point.get("z", 0.0)}
            else:
                result[name] = {"x": 0.0, "y": 0.0, "z": 0.0}
        return result

    @classmethod
    def _process_squat(
        cls,
        state: Dict[str, Any],
        lm: Dict[str, Dict[str, float]],
        profile: Optional[CalibrationProfile],
    ) -> Dict[str, Any]:
        """
        State machine для приседаний.

        Использует LEFT колено (боковая камера).
        Пороги из профиля или универсальные.
        """
        # LEFT knee (боковая съёмка)
        knee_angle = get_knee_angle(lm, "left")
        rep_counted = False

        # Пороги — из профиля или universal
        if profile:
            natural_depth = profile.baseline_metrics.get("natural_squat_depth", UNIVERSAL_SQUAT_DEPTH)
            depth_threshold   = natural_depth
            standing_threshold = UNIVERSAL_SQUAT_STANDING
            going_down_threshold = UNIVERSAL_SQUAT_GOING_DOWN
        else:
            depth_threshold   = UNIVERSAL_SQUAT_DEPTH        # 100°
            standing_threshold = UNIVERSAL_SQUAT_STANDING    # 150°
            going_down_threshold = UNIVERSAL_SQUAT_GOING_DOWN # 140°

        phase = state["phase"]
        prev_phase = phase

        if phase == SQUAT_STANDING:
            if knee_angle < going_down_threshold:
                state["phase"] = SQUAT_GOING_DOWN
                state["min_angle_in_rep"] = knee_angle

        elif phase == SQUAT_GOING_DOWN:
            state["min_angle_in_rep"] = min(state["min_angle_in_rep"], knee_angle)
            if knee_angle < depth_threshold:
                state["phase"] = SQUAT_BOTTOM

        elif phase == SQUAT_BOTTOM:
            state["min_angle_in_rep"] = min(state["min_angle_in_rep"], knee_angle)
            if knee_angle > depth_threshold:
                state["phase"] = SQUAT_GOING_UP

        elif phase == SQUAT_GOING_UP:
            if knee_angle > standing_threshold:
                state["phase"] = SQUAT_STANDING
                state["reps"] += 1
                rep_counted = True
                print(
                    f"🔢 [RepCounter] SQUAT rep #{state['reps']} "
                    f"(мин. угол: {state['min_angle_in_rep']:.1f}°)"
                )
                state["min_angle_in_rep"] = 180.0

        if prev_phase != state["phase"]:
            print(f"   ↔️  Phase: {prev_phase} → {state['phase']} (knee={knee_angle:.1f}°)")

        if rep_counted:
            print(f"   🔥 Засчитано повторение! Итого: {state['reps']}")

        # Print for every frame unconditionally
        print(f"   📸 Кадр: knee_angle={knee_angle:.1f}, state={state['phase']}")

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
        lm: Dict[str, Dict[str, float]],
        profile: Optional[CalibrationProfile],
    ) -> Dict[str, Any]:
        """State machine для становой тяги."""
        hip_angle = get_hip_angle(lm, "left")
        rep_counted = False

        bar_pos = get_bar_position_estimate(lm)
        bar_y   = bar_pos["y"] if bar_pos else 0.5

        if profile:
            nat_hip = profile.baseline_metrics.get("natural_start_hip_angle", 80.0)
        else:
            nat_hip = 80.0

        setup_threshold   = UNIVERSAL_DL_SETUP
        lockout_threshold = UNIVERSAL_DL_LOCKOUT
        standing_threshold = UNIVERSAL_DL_LOCKOUT

        phase = state["phase"]

        if phase == DL_STANDING:
            if hip_angle < setup_threshold:
                state["phase"] = DL_SETUP
                state["max_bar_y_in_rep"] = bar_y

        elif phase == DL_SETUP:
            if hip_angle > setup_threshold and bar_y < state.get("prev_bar_y", bar_y):
                state["phase"] = DL_LIFTING
            state["max_bar_y_in_rep"] = max(state.get("max_bar_y_in_rep", 0), bar_y)

        elif phase == DL_LIFTING:
            if hip_angle > lockout_threshold:
                state["phase"] = DL_LOCKOUT

        elif phase == DL_LOCKOUT:
            if hip_angle < setup_threshold:
                state["phase"] = DL_LOWERING

        elif phase == DL_LOWERING:
            if bar_y > state.get("max_bar_y_in_rep", 0) * 0.85 or hip_angle > standing_threshold:
                state["phase"] = DL_STANDING
                state["reps"] += 1
                rep_counted = True
                print(f"🔢 [RepCounter] DEADLIFT rep #{state['reps']}")
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

        НЕ требует калибровочный профиль — использует universal thresholds если нет.

        Args:
            db: Сессия БД.
            user_id: ID пользователя.
            exercise_type: "squat" или "deadlift".
            landmarks: 33 точки MediaPipe текущего кадра.
        """
        print(f"\n🔄 [RepCounter.process_frame]")
        print(f"   user={user_id}, exercise={exercise_type}, landmarks={len(landmarks)}")

        # Пробуем получить профиль — без него тоже работаем
        profile = (
            db.query(CalibrationProfile)
            .filter(
                CalibrationProfile.user_id == user_id,
                CalibrationProfile.exercise_type == exercise_type,
            )
            .first()
        )
        print(f"   📋 Profile: {'found' if profile else 'NOT found — using universal thresholds'}")

        lm = cls._extract_landmarks(landmarks)
        state = cls._get_state(user_id, exercise_type)
        print(f"   📍 State: phase={state['phase']}, reps={state['reps']}")

        if exercise_type == "squat":
            result = cls._process_squat(state, lm, profile)
        elif exercise_type == "deadlift":
            result = cls._process_deadlift(state, lm, profile)
        else:
            raise ValueError(f"Неизвестный тип упражнения: {exercise_type}")

        print(f"   ✅ Done: phase={result['current_phase']}, reps={result['total_reps']}, counted={result['rep_counted']}")
        return result
