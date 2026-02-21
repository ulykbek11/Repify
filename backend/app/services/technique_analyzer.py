"""
Анализатор техники упражнений.

Камера снимает СБОКУ — поэтому анализируются ТОЛЬКО показатели,
видимые в сагиттальной (боковой) плоскости:
  ✅ Knee angle       — угол колена (глубина)
  ✅ Hip angle        — угол таза
  ✅ Spine flexion    — сгибание спины (rohanx01: изменение длины плечо→таз)
  ✅ Knee forward     — колени за носками (rohanx01: arctan метод)
  ✅ Squat depth      — достаточная глубина
  ✅ Torso lean       — наклон корпуса вперёд

  ❌ Knee valgus      — невидимо сбоку
  ❌ Balance / CoM    — ненадёжно сбоку

Использует LEFT сторону тела (left_hip, left_knee, left_ankle)
как основную — оптимально для съёмки сбоку.

Работает как С калибровочным профилем (персонализированные пороги),
так и БЕЗ него (универсальные пороги из rohanx01 / SquatUniversity).
"""

import logging
import math
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.calibration import CalibrationProfile
from app.utils.pose_math import (
    calculate_torso_lean,
    calculate_back_angle,
    get_knee_angle,
    get_hip_angle,
    get_average_knee_angle,
    get_average_hip_angle,
    midpoint,
    distance_3d,
)


logger = logging.getLogger(__name__)


# =============================================================================
# Универсальные пороги (без калибровки)
# rohanx01 / SquatUniversity / LearnOpenCV
# =============================================================================

# Приседания — универсальные
SQUAT_DEPTH_GOOD      = 100.0   # knee_angle < 100° = параллель и ниже ✅
SQUAT_DEPTH_PARTIAL   = 120.0   # 100–120° = частичное приседание
SQUAT_DEPTH_SHALLOW   = 140.0   # > 140° = недосед
SQUAT_STANDING        = 155.0   # > 155° = стоит

TORSO_LEAN_MAX        = 45.0    # > 45° = чрезмерный наклон вперёд
TORSO_LEAN_CRITICAL   = 60.0    # > 60° = критический наклон

SPINE_FLEX_THRESHOLD  = 0.88    # Если текущая длина спины < 88% от стоячей → сгибание
KNEE_FORWARD_ANGLE    = 44.0    # rohanx01: если arctan угол < 44° → колено выдвинуто
HIP_KNEE_AWESOME      = 20.0    # rohanx01: если hip-knee angle < 20° → отличная глубина

# Становая тяга — универсальные
DL_BACK_MIN           = 150.0   # back_angle < 150° = округление спины
DL_HIP_HINGE_MAX      = 70.0    # torso_lean > 70° = чрезмерный наклон


class TechniqueAnalyzer:
    """
    Анализатор техники упражнений.

    Работает с калибровочным профилем и без него.
    Использует LEFT сторону тела для расчётов (боковая съёмка).
    """

    @staticmethod
    def _extract_landmarks(
        landmarks: Dict[str, Any]
    ) -> Dict[str, Dict[str, float]]:
        """Конвертирует landmarks из Pydantic/dict в простой словарь {name: {x,y,z}}."""
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

    # =========================================================================
    # Вспомогательные методы — rohanx01 алгоритмы
    # =========================================================================

    @staticmethod
    def _spine_flexion(
        lm: Dict[str, Dict[str, float]],
        reference_spine_length: Optional[float],
    ) -> Dict[str, Any]:
        """
        rohanx01 `back_slacking`: сравнивает текущую длину позвоночника
        (середина_плеч → середина_бёдер) с эталоном стоячей позиции.

        Если текущая длина < reference * SPINE_FLEX_THRESHOLD → сгибание.
        """
        mid_shoulder = midpoint(lm["left_shoulder"], lm["right_shoulder"])
        mid_hip = midpoint(lm["left_hip"], lm["right_hip"])
        current_length = distance_3d(mid_shoulder, mid_hip)

        if reference_spine_length and reference_spine_length > 0:
            ratio = current_length / reference_spine_length
            flexion = ratio < SPINE_FLEX_THRESHOLD
            severity = "high" if ratio < 0.80 else "medium"
            reduction_pct = round((1.0 - ratio) * 100, 1)
        else:
            # Без эталона используем торс-наклон как прокси
            torso_lean = calculate_torso_lean(lm)
            flexion = torso_lean > TORSO_LEAN_MAX
            severity = "high" if torso_lean > TORSO_LEAN_CRITICAL else "medium"
            reduction_pct = 0.0

        print(f"   🦴 Spine: current_len={current_length:.4f}, ref={reference_spine_length}, flexion={flexion}")
        return {"detected": flexion, "severity": severity, "reduction_pct": reduction_pct}

    @staticmethod
    def _knee_forward_check(lm: Dict[str, Dict[str, float]]) -> Dict[str, Any]:
        """
        rohanx01 `knee_over_toes`: колено выдвигается за носок.

        Метод: `angle = |arctan2(hip.y - knee.y, hip.x - knee.x) * 180/pi|`
        Если angle < KNEE_FORWARD_ANGLE (44°) И knee.x > foot_index.x → колено за носком.

        Использует LEFT сторону (боковая камера).
        """
        try:
            hip   = lm["left_hip"]
            knee  = lm["left_knee"]
            foot  = lm["left_foot_index"]

            angle = abs(math.degrees(
                math.atan2(hip["y"] - knee["y"], hip["x"] - knee["x"])
            ))
            # В боковой проекции left.x увеличивается вперёд (или назад — зависит от стороны)
            knee_past_foot = knee["x"] > foot["x"]
            detected = angle < KNEE_FORWARD_ANGLE and knee_past_foot

            print(f"   👣 Knee forward: angle={angle:.1f}°, knee.x={knee['x']:.3f} > foot.x={foot['x']:.3f} → {detected}")
            return {"detected": detected, "angle": round(angle, 1)}
        except KeyError:
            return {"detected": False, "angle": 0.0}

    @staticmethod
    def _depth_check(lm: Dict[str, Dict[str, float]], target_depth: float) -> Dict[str, Any]:
        """
        Проверяет глубину приседа по колену (LEFT сторона) и hip-knee углу (rohanx01).

        rohanx01 `ensure_proper_depth`:
            hip_knee_angle = |arctan2(hip.y - knee.y, hip.x - knee.x) * 180/pi|
            Если < 20° → «Awesome Depth»

        Комбинируем с joint angle для надёжности.
        """
        try:
            knee_angle = get_knee_angle(lm, "left")

            hip  = lm["left_hip"]
            knee = lm["left_knee"]
            hip_knee_angle = abs(math.degrees(
                math.atan2(hip["y"] - knee["y"], hip["x"] - knee["x"])
            ))

            awesome_depth = hip_knee_angle < HIP_KNEE_AWESOME

            if knee_angle < SQUAT_DEPTH_GOOD:
                status = "excellent"
                issue = False
            elif knee_angle < SQUAT_DEPTH_PARTIAL:
                status = "partial"
                issue = knee_angle > target_depth + 10
            elif knee_angle < SQUAT_DEPTH_SHALLOW:
                status = "shallow"
                issue = True
            else:
                status = "standing"
                issue = False  # Ещё не приседал — не считаем ошибкой

            print(f"   📐 Depth: knee={knee_angle:.1f}°, hip_knee={hip_knee_angle:.1f}°, awesome={awesome_depth}, status={status}")
            return {
                "knee_angle": round(knee_angle, 1),
                "hip_knee_angle": round(hip_knee_angle, 1),
                "awesome_depth": awesome_depth,
                "status": status,
                "issue": issue,
            }
        except KeyError:
            return {"knee_angle": 180.0, "status": "standing", "issue": False, "awesome_depth": False, "hip_knee_angle": 90.0}

    @staticmethod
    def _torso_lean_check(lm: Dict[str, Dict[str, float]], max_lean: float) -> Dict[str, Any]:
        """Угол наклона корпуса от вертикали. > max_lean = ошибка."""
        try:
            lean = calculate_torso_lean(lm)
            detected = lean > max_lean
            severity = "high" if lean > max_lean + 15 else "medium"
            print(f"   🏋️  Torso lean: {lean:.1f}° (max={max_lean}°), detected={detected}")
            return {"detected": detected, "angle": round(lean, 1), "severity": severity}
        except KeyError:
            return {"detected": False, "angle": 0.0, "severity": "low"}

    # =========================================================================
    # Основные методы анализа
    # =========================================================================

    @classmethod
    def _analyze_squat_universal(
        cls,
        lm: Dict[str, Dict[str, float]],
        reference_spine_length: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Анализ приседания БЕЗ калибровки.

        Универсальные пороги + rohanx01 алгоритмы.
        Проверяет только то, что ВИДНО при боковой съёмке.
        """
        errors: List[Dict[str, Any]] = []
        penalty = 0.0

        knee_angle = get_knee_angle(lm, "left")
        hip_angle  = get_hip_angle(lm,  "left")
        torso_lean = calculate_torso_lean(lm)

        print(f"   📊 Left knee={knee_angle:.1f}°, hip={hip_angle:.1f}°, torso={torso_lean:.1f}°")

        # Анализируем только во время приседа (не в стойке)
        in_squat_phase = knee_angle < SQUAT_STANDING

        # === 1. Spine flexion (rohanx01 back_slacking) ===
        spine = cls._spine_flexion(lm, reference_spine_length)
        if spine["detected"] and in_squat_phase:
            penalty += 0.20 if spine["severity"] == "high" else 0.12
            reduction_msg = f" (укорочение {spine['reduction_pct']}%)" if spine["reduction_pct"] > 0 else ""
            errors.append({
                "error_type": "spine_flexion",
                "severity": spine["severity"],
                "message": (
                    f"Сгибание спины{reduction_msg}. "
                    "Держите грудь вперёд, взгляд прямо. "
                    "Работайте над укреплением разгибателей позвоночника."
                ),
            })

        # === 2. Torso lean ===
        torso = cls._torso_lean_check(lm, TORSO_LEAN_MAX)
        if torso["detected"] and in_squat_phase:
            penalty += 0.20 if torso["severity"] == "high" else 0.10
            errors.append({
                "error_type": "excessive_forward_lean",
                "severity": torso["severity"],
                "message": (
                    f"Сильный наклон вперёд ({torso['angle']:.0f}°, норма < {TORSO_LEAN_MAX:.0f}°). "
                    "Возможные причины: слабые квадрицепсы или ограниченная подвижность голеностопа. "
                    "Работайте над растяжкой икроножных мышц."
                ),
            })

        # === 3. Squat depth ===
        depth = cls._depth_check(lm, target_depth=SQUAT_DEPTH_GOOD)
        if depth["issue"] and depth["status"] in ("shallow", "partial"):
            severity = "high" if depth["status"] == "shallow" else "medium"
            penalty += 0.15 if severity == "high" else 0.08
            errors.append({
                "error_type": "insufficient_depth",
                "severity": severity,
                "message": (
                    f"Недостаточная глубина ({depth['knee_angle']:.0f}°, цель < {SQUAT_DEPTH_GOOD:.0f}°). "
                    "Приседайте до параллели бёдер с полом. "
                    "Работайте над подвижностью голеностопа."
                ),
            })
        elif depth["awesome_depth"]:
            print("   ✅ Отличная глубина!")

        # === 4. Knee forward (rohanx01 knee_over_toes) ===
        knee_fwd = cls._knee_forward_check(lm)
        if knee_fwd["detected"] and in_squat_phase:
            penalty += 0.08
            errors.append({
                "error_type": "knee_over_toes",
                "severity": "low",
                "message": (
                    "Колено выходит за носок. "
                    "Отводите таз назад при приседании, "
                    "удерживайте вес на пятках."
                ),
            })

        # === Финальный score ===
        score = round(max(0.0, min(1.0, 1.0 - penalty)), 2)

        if score >= 0.9:
            feedback = "Отличная техника! ✅"
        elif score >= 0.75:
            feedback = "Хорошая техника, небольшие замечания 💪"
        elif score >= 0.5:
            feedback = "Есть ошибки, требуется коррекция ⚠️"
        else:
            feedback = "Серьёзные ошибки в технике! ❌"

        print(f"   🎯 Score: {score} ({len(errors)} ошибок), feedback: {feedback}")
        return {
            "technique_score": score,
            "errors": errors,
            "feedback": feedback,
            "metrics": {
                "knee_angle": round(knee_angle, 1),
                "hip_angle":  round(hip_angle, 1),
                "torso_angle": round(torso_lean, 1),
                "back_angle": None,
                "symmetry": None,
            },
        }

    @classmethod
    def _analyze_squat(
        cls,
        lm: Dict[str, Dict[str, float]],
        profile: CalibrationProfile,
    ) -> Dict[str, Any]:
        """
        Анализ приседания С калибровочным профилем.

        Персонализированные пороги из личного baseline + rohanx01 алгоритмы.
        Только показатели, видимые при БОКОВОЙ съёмке.
        """
        errors: List[Dict[str, Any]] = []
        penalty = 0.0

        baseline = profile.baseline_metrics
        safe     = profile.safe_ranges

        knee_angle = get_knee_angle(lm, "left")
        hip_angle  = get_hip_angle(lm, "left")
        torso_lean = calculate_torso_lean(lm)

        natural_depth = baseline.get("natural_squat_depth", SQUAT_DEPTH_GOOD)
        natural_lean  = baseline.get("natural_torso_lean", TORSO_LEAN_MAX)
        spine_ref     = baseline.get("reference_spine_length", None)

        depth_min = safe.get("depth_min", natural_depth - 15)
        depth_max = safe.get("depth_max", natural_depth + 15)
        lean_max  = safe.get("torso_lean_max", natural_lean + 10)

        print(f"   📊 [calibrated] Left knee={knee_angle:.1f}°, hip={hip_angle:.1f}°, torso={torso_lean:.1f}°")
        print(f"   📏 Baseline: depth={natural_depth:.1f}°, lean={natural_lean:.1f}°")

        in_squat_phase = knee_angle < SQUAT_STANDING

        # === 1. Spine flexion (rohanx01) ===
        spine = cls._spine_flexion(lm, spine_ref)
        if spine["detected"] and in_squat_phase:
            penalty += 0.20 if spine["severity"] == "high" else 0.12
            errors.append({
                "error_type": "spine_flexion",
                "severity": spine["severity"],
                "message": (
                    f"Сгибание спины. Держите грудь вперёд, взгляд прямо."
                ),
            })

        # === 2. Torso lean (персонализированный порог) ===
        if torso_lean > lean_max + 5 and in_squat_phase:
            severity = "high" if torso_lean > lean_max + 15 else "medium"
            penalty += 0.20 if severity == "high" else 0.10
            errors.append({
                "error_type": "excessive_forward_lean",
                "severity": severity,
                "message": (
                    f"Наклон вперёд ({torso_lean:.0f}°). "
                    f"Ваша норма ≤ {lean_max:.0f}°. "
                    "Возможно, слабые квадрицепсы или жёсткий голеностоп."
                ),
            })

        # === 3. Squat depth ===
        if in_squat_phase:
            if knee_angle > 110.0:
                severity = "high" if knee_angle > 125.0 else "medium"
                penalty += 0.15 if severity == "high" else 0.10
                errors.append({
                    "error_type": "insufficient_depth",
                    "severity": severity,
                    "message": (
                        f"Недостаточная глубина ({knee_angle:.0f}°). "
                        "Приседайте ниже, до параллели бёдер с полом."
                    ),
                })

        # === 4. Knee forward (rohanx01) ===
        knee_fwd = cls._knee_forward_check(lm)
        if knee_fwd["detected"] and in_squat_phase:
            penalty += 0.08
            errors.append({
                "error_type": "knee_over_toes",
                "severity": "low",
                "message": "Колено выходит за носок. Отводите таз назад при приседании.",
            })

        score = round(max(0.0, min(1.0, 1.0 - penalty)), 2)

        if score >= 0.9:
            feedback = "Отличная техника! ✅"
        elif score >= 0.75:
            feedback = "Хорошая техника, небольшие замечания 💪"
        elif score >= 0.5:
            feedback = "Есть ошибки, требуется коррекция ⚠️"
        else:
            feedback = "Серьёзные ошибки в технике! ❌"

        print(f"   🎯 [calibrated] Score={score}, errors={len(errors)}")
        return {
            "technique_score": score,
            "errors": errors,
            "feedback": feedback,
            "metrics": {
                "knee_angle": round(knee_angle, 1),
                "hip_angle":  round(hip_angle, 1),
                "torso_angle": round(torso_lean, 1),
                "back_angle": None,
                "symmetry": None,
            },
        }

    @classmethod
    def _analyze_deadlift(
        cls,
        lm: Dict[str, Dict[str, float]],
        profile: Optional[CalibrationProfile],
    ) -> Dict[str, Any]:
        """
        Анализ становой тяги — боковая съёмка.

        Проверяет: прямую спину, наклон корпуса, позицию бёдер.
        """
        errors: List[Dict[str, Any]] = []
        penalty = 0.0

        back_angle = calculate_back_angle(lm)
        torso_lean = calculate_torso_lean(lm)
        hip_angle  = get_hip_angle(lm, "left")
        knee_angle = get_knee_angle(lm, "left")

        print(f"   📊 Deadlift: back={back_angle:.1f}°, torso={torso_lean:.1f}°, hip={hip_angle:.1f}°")

        back_min  = DL_BACK_MIN
        lean_max  = DL_HIP_HINGE_MAX
        nat_hip   = 80.0

        if profile:
            back_min  = profile.safe_ranges.get("back_angle_min", DL_BACK_MIN)
            lean_max  = profile.safe_ranges.get("max_torso_lean", DL_HIP_HINGE_MAX)
            nat_hip   = profile.baseline_metrics.get("natural_start_hip_angle", 80.0)

        # === 1. Spine (back angle) ===
        if back_angle < back_min:
            deviation = back_min - back_angle
            severity = "high" if deviation > 15 else "medium"
            penalty += 0.25 if severity == "high" else 0.12
            errors.append({
                "error_type": "rounded_back",
                "severity": severity,
                "message": (
                    f"Округление спины ({back_angle:.0f}°, норма > {back_min:.0f}°). "
                    "Держите грудь вперёд и спину прямой!"
                ),
            })

        # === 2. Spine flexion (rohanx01) ===
        spine = cls._spine_flexion(lm, None)
        if spine["detected"]:
            penalty += 0.15
            errors.append({
                "error_type": "spine_flexion",
                "severity": spine["severity"],
                "message": "Горб в спине. Держите нейтральный позвоночник.",
            })

        # === 3. Torso lean ===
        if torso_lean > lean_max:
            penalty += 0.10
            errors.append({
                "error_type": "excessive_lean",
                "severity": "medium",
                "message": (
                    f"Чрезмерный наклон корпуса ({torso_lean:.0f}°, норма < {lean_max:.0f}°)."
                ),
            })

        # === 4. Бёдра (только с профилем) ===
        if profile:
            safe = profile.safe_ranges
            hip_min = safe.get("hip_angle_min", nat_hip - 15)
            hip_max = safe.get("hip_angle_max", nat_hip + 15)

            if hip_angle < hip_min - 10:
                penalty += 0.08
                errors.append({
                    "error_type": "hips_too_low",
                    "severity": "medium",
                    "message": (
                        f"Таз слишком низко ({hip_angle:.0f}°). "
                        f"Норма: {nat_hip:.0f}° (±15°)."
                    ),
                })
            elif hip_angle > hip_max + 10:
                penalty += 0.08
                errors.append({
                    "error_type": "hips_too_high",
                    "severity": "medium",
                    "message": (
                        f"Таз слишком высоко ({hip_angle:.0f}°). "
                        f"Норма: {nat_hip:.0f}° (±15°)."
                    ),
                })

        score = round(max(0.0, min(1.0, 1.0 - penalty)), 2)

        if score >= 0.9:
            feedback = "Отличная техника тяги! ✅"
        elif score >= 0.75:
            feedback = "Хорошая техника, минимальные замечания 💪"
        elif score >= 0.5:
            feedback = "Есть ошибки в технике тяги ⚠️"
        else:
            feedback = "Серьёзные ошибки! Риск травмы спины ❌"

        print(f"   🎯 Deadlift score={score}, errors={len(errors)}")
        return {
            "technique_score": score,
            "errors": errors,
            "feedback": feedback,
            "metrics": {
                "knee_angle": round(knee_angle, 1),
                "hip_angle":  round(hip_angle, 1),
                "torso_angle": round(torso_lean, 1),
                "back_angle": round(back_angle, 1),
                "symmetry": None,
            },
        }

    # =========================================================================
    # Публичный API
    # =========================================================================

    @classmethod
    def analyze(
        cls,
        db: Session,
        user_id: str,
        exercise_type: str,
        landmarks: Dict[str, Any],
        reference_spine_length: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Анализирует технику одного кадра.

        Работает БЕЗ калибровки (universal thresholds) и С профилем.
        Больше НЕ бросает ValueError при отсутствии профиля.

        Args:
            db: Сессия БД.
            user_id: ID пользователя.
            exercise_type: "squat" или "deadlift".
            landmarks: 33 точки MediaPipe.
            reference_spine_length: Длина позвоночника в стойке (для spine flexion).
        """
        print(f"\n🔍 [TechniqueAnalyzer.analyze]")
        print(f"   user={user_id}, exercise={exercise_type}")
        print(f"   landmarks keys: {list(landmarks.keys())[:8]}... ({len(landmarks)} total)")

        lm = cls._extract_landmarks(landmarks)
        print(f"   ✅ Converted {len(lm)} landmarks")

        # Ищем калибровочный профиль — если нет, работаем с universal thresholds
        profile = (
            db.query(CalibrationProfile)
            .filter(
                CalibrationProfile.user_id == user_id,
                CalibrationProfile.exercise_type == exercise_type,
            )
            .first()
        )
        print(f"   📋 Calibration profile: {'found' if profile else 'NOT found — using universal thresholds'}")

        if exercise_type == "squat":
            if profile:
                result = cls._analyze_squat(lm, profile)
            else:
                result = cls._analyze_squat_universal(lm, reference_spine_length)
        elif exercise_type == "deadlift":
            result = cls._analyze_deadlift(lm, profile)
        else:
            raise ValueError(f"Неизвестный тип упражнения: {exercise_type}")

        print(f"   ✅ Analysis done: score={result['technique_score']}, errors={len(result['errors'])}")
        return result
