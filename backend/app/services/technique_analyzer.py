"""
Анализатор техники упражнений.

Сравнивает текущую технику пользователя с его ЛИЧНЫМ baseline
из калибровочного профиля. Не использует универсальные стандарты —
каждый человек оценивается относительно своей анатомии.

Приседания: глубина, наклон, симметрия, вальгус, баланс.
Становая тяга: спина, позиция штанги, плечи, бёдра, траектория.
"""

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.calibration import CalibrationProfile
from app.utils.pose_math import (
    calculate_torso_lean,
    calculate_back_angle,
    get_average_knee_angle,
    get_average_hip_angle,
    get_knee_angle,
    check_knee_valgus,
    check_knees_over_toes,
    calculate_symmetry,
    is_balance_stable,
    get_bar_position_estimate,
    midpoint,
    detect_heel_rise,
)


logger = logging.getLogger(__name__)


class TechniqueAnalyzer:
    """
    Анализатор техники с персонализацией.

    Требует калибровочный профиль. Сравнивает текущее выполнение
    с личными baseline-показателями пользователя.
    """

    @staticmethod
    def _extract_landmarks(
        landmarks: Dict[str, Any]
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
    def _analyze_squat(
        cls,
        landmarks: Dict[str, Dict[str, float]],
        profile: CalibrationProfile,
    ) -> Dict[str, Any]:
        """
        Анализ техники приседаний.

        Проверки:
        1. Глубина: knee_angle vs natural_squat_depth (±15°)
        2. Наклон корпуса: torso_lean vs natural_torso_lean (±10°)
        3. Симметрия: разница лево/право (< max_asymmetry)
        4. Колени за носками: knee.x ≈ ankle.x (±0.1)
        5. Вальгус: расстояние между коленями >= между лодыжками
        6. Баланс: центр масс над стопами

        Args:
            landmarks: 33 точки текущего кадра.
            profile: Калибровочный профиль пользователя.

        Returns:
            Результат анализа с оценкой, ошибками и метриками.
        """
        errors: List[Dict[str, Any]] = []
        penalty = 0.0

        baseline = profile.baseline_metrics
        safe = profile.safe_ranges

        # === Текущие метрики ===
        knee_angle = get_average_knee_angle(landmarks)
        torso_lean = calculate_torso_lean(landmarks)
        hip_angle = get_average_hip_angle(landmarks)
        symmetry = calculate_symmetry(landmarks, "knee")

        natural_depth = baseline.get("natural_squat_depth", 90.0)
        natural_lean = baseline.get("natural_torso_lean", 30.0)

        # === 1. Глубина приседа ===
        depth_min = safe.get("depth_min", natural_depth - 15)
        depth_max = safe.get("depth_max", natural_depth + 15)

        # Проверяем только если пользователь в фазе приседа (колени согнуты)
        if knee_angle < 140:
            if knee_angle < depth_min - 10:
                penalty += 0.15
                errors.append({
                    "error_type": "excessive_depth",
                    "severity": "medium",
                    "message": (
                        f"Слишком глубоко ({knee_angle:.0f}°). "
                        f"Ваш безопасный диапазон: {depth_min:.0f}-{depth_max:.0f}°"
                    ),
                    "current_value": round(knee_angle, 1),
                    "expected_range": f"{depth_min:.0f}-{depth_max:.0f}°",
                })
            elif knee_angle > depth_max + 5:
                # Недосед — пользователь не достигает своей целевой глубины
                severity = "high" if knee_angle > depth_max + 20 else "medium"
                penalty += 0.15 if severity == "high" else 0.12
                errors.append({
                    "error_type": "insufficient_depth",
                    "severity": severity,
                    "message": (
                        f"Недостаточная глубина ({knee_angle:.0f}°). "
                        f"Ваша цель: {natural_depth:.0f}° "
                        f"(диапазон {depth_min:.0f}–{depth_max:.0f}°). "
                        "Приседайте глубже: работайте над подвижностью голеностопа "
                        "и укреплением ягодичных мышц."
                    ),
                    "current_value": round(knee_angle, 1),
                    "expected_range": f"{depth_min:.0f}–{depth_max:.0f}°",
                })

        # === 2. Наклон корпуса ===
        lean_min = safe.get("torso_lean_min", max(0, natural_lean - 10))
        lean_max = safe.get("torso_lean_max", natural_lean + 10)

        if torso_lean > lean_max + 5:
            severity = "high" if torso_lean > lean_max + 15 else "medium"
            penalty += 0.20 if severity == "high" else 0.10
            errors.append({
                "error_type": "excessive_forward_lean",
                "severity": severity,
                "message": (
                    f"Сильный наклон вперёд ({torso_lean:.0f}°). "
                    f"Ваша норма: {natural_lean:.0f}° (±10°). "
                    f"Возможно, слабые квадрицепсы или жёсткий голеностоп."
                ),
                "current_value": round(torso_lean, 1),
                "expected_range": f"{lean_min:.0f}-{lean_max:.0f}°",
            })

        # === 3. Симметрия ===
        max_asym = safe.get("max_asymmetry", 10.0)

        if symmetry > max_asym:
            severity = "high" if symmetry > max_asym * 1.5 else "medium"
            penalty += 0.15 if severity == "high" else 0.08
            errors.append({
                "error_type": "asymmetry",
                "severity": severity,
                "message": (
                    f"Асимметрия коленей: {symmetry:.1f}° "
                    f"(допустимо до {max_asym:.0f}°). "
                    f"Распределяйте вес равномерно."
                ),
                "current_value": round(symmetry, 1),
                "expected_range": f"< {max_asym:.0f}°",
            })

        # === 4. Колени за носками ===
        knees_over = check_knees_over_toes(landmarks, tolerance=0.1)
        if any(knees_over.values()):
            sides = [s for s, v in knees_over.items() if v]
            penalty += 0.08
            errors.append({
                "error_type": "knees_over_toes",
                "severity": "low",
                "message": (
                    f"Колени выходят за носки ({', '.join(sides)}). "
                    f"Отводите таз назад при приседании."
                ),
                "current_value": None,
                "expected_range": "Колени на уровне носков",
            })

        # === 5. Вальгус коленей ===
        if check_knee_valgus(landmarks):
            valgus_tendency = baseline.get("knee_valgus_tendency", False)
            severity = "medium" if valgus_tendency else "high"
            penalty += 0.12 if severity == "high" else 0.08
            message = (
                "Колени заваливаются внутрь. Разводите колени наружу по направлению стоп."
            )
            if valgus_tendency:
                message += " (Это ваша природная склонность — работайте над укреплением ягодичных.)"
            errors.append({
                "error_type": "knee_valgus",
                "severity": severity,
                "message": message,
                "current_value": None,
                "expected_range": "Колени над стопами",
            })

        # === 6. Баланс ===
        if not is_balance_stable(landmarks, tolerance=0.15):
            penalty += 0.05
            errors.append({
                "error_type": "balance",
                "severity": "low",
                "message": "Небольшое отклонение баланса. Контролируйте центр тяжести.",
                "current_value": None,
                "expected_range": "Центр масс над стопами",
            })

        # === 7. Отрыв пяток ===
        # Определяем только в фазе приседа, чтобы не ложно срабатывать в стойке
        if knee_angle < 140:
            standing_heel_drop = baseline.get("standing_heel_drop", 0.01)
            heel = detect_heel_rise(landmarks, standing_heel_drop)
            if heel["left"] or heel["right"]:
                lifted_sides = [s for s in ("left", "right") if heel[s]]
                max_lift = max(heel.get("left_lift", 0.0), heel.get("right_lift", 0.0))
                severity = "high" if max_lift > 0.06 else "medium"
                penalty += 0.18 if severity == "high" else 0.12
                errors.append({
                    "error_type": "heel_rise",
                    "severity": severity,
                    "message": (
                        f"Отрыв пяток ({', '.join(lifted_sides)}). "
                        "Ограниченная подвижность голеностопа или слабые разгибатели бедра. "
                        "Используйте подпятники или работайте над растяжкой икроножных мышц."
                    ),
                    "current_value": round(max_lift, 3),
                    "expected_range": "Пятки плотно на полу",
                })

        # === Финальная оценка ===
        score = max(0.0, min(1.0, 1.0 - penalty))

        # === Фидбэк ===
        if score >= 0.9:
            feedback = "Отличная техника! ✅"
        elif score >= 0.75:
            feedback = "Хорошая техника, небольшие замечания 💪"
        elif score >= 0.5:
            feedback = "Есть ошибки, требуется коррекция ⚠️"
        else:
            feedback = "Серьёзные ошибки в технике! Скорректируйте выполнение ❌"

        return {
            "technique_score": round(score, 2),
            "errors": errors,
            "feedback": feedback,
            "metrics": {
                "knee_angle": round(knee_angle, 1),
                "hip_angle": round(hip_angle, 1),
                "torso_angle": round(torso_lean, 1),
                "back_angle": None,
                "symmetry": round(symmetry, 1),
            },
        }

    @classmethod
    def _analyze_deadlift(
        cls,
        landmarks: Dict[str, Dict[str, float]],
        profile: CalibrationProfile,
    ) -> Dict[str, Any]:
        """
        Анализ техники становой тяги.

        Проверки:
        1. Спина: back_angle прямая vs baseline
        2. Позиция штанги: близко к голеням
        3. Плечи: над штангой или чуть впереди
        4. Бёдра: hip_angle vs natural_hip_hinge_angle
        5. Колени: не выходят за носки в стартовой позиции
        6. Траектория: штанга вертикально вдоль ног

        Args:
            landmarks: 33 точки текущего кадра.
            profile: Калибровочный профиль пользователя.

        Returns:
            Результат анализа с оценкой, ошибками и метриками.
        """
        errors: List[Dict[str, Any]] = []
        penalty = 0.0

        baseline = profile.baseline_metrics
        safe = profile.safe_ranges

        # === Текущие метрики ===
        knee_angle = get_average_knee_angle(landmarks)
        hip_angle = get_average_hip_angle(landmarks)
        back_angle = calculate_back_angle(landmarks)
        torso_lean = calculate_torso_lean(landmarks)

        nat_back = baseline.get("natural_back_angle", 170.0)
        nat_hip = baseline.get("natural_start_hip_angle", 80.0)

        # === 1. Спина ===
        back_min = safe.get("back_angle_min", 150.0)

        if back_angle < back_min:
            deviation = back_min - back_angle
            severity = "high" if deviation > 15 else "medium"
            penalty += 0.25 if severity == "high" else 0.12
            errors.append({
                "error_type": "rounded_back",
                "severity": severity,
                "message": (
                    f"Округление спины ({back_angle:.0f}°). "
                    f"Ваш безопасный минимум: {back_min:.0f}°. "
                    f"Держите грудь вперёд и спину прямой!"
                ),
                "current_value": round(back_angle, 1),
                "expected_range": f"> {back_min:.0f}°",
            })

        # === 2. Позиция штанги (приблизительно по кистям) ===
        bar_pos = get_bar_position_estimate(landmarks)
        if bar_pos:
            mid_ankle = midpoint(landmarks["left_ankle"], landmarks["right_ankle"])
            bar_offset = abs(bar_pos["x"] - mid_ankle["x"])

            if bar_offset > 0.08:
                penalty += 0.10
                errors.append({
                    "error_type": "bar_too_far",
                    "severity": "medium",
                    "message": (
                        "Штанга далеко от тела. "
                        "Держите штангу максимально близко к голеням."
                    ),
                    "current_value": round(bar_offset, 3),
                    "expected_range": "< 0.08 (нормализованные координаты)",
                })

        # === 3. Плечи над штангой ===
        if bar_pos:
            mid_shoulder = midpoint(
                landmarks["left_shoulder"], landmarks["right_shoulder"]
            )
            # Плечи должны быть примерно над штангой или чуть впереди
            shoulder_offset = mid_shoulder["x"] - bar_pos["x"]

            if abs(shoulder_offset) > 0.1:
                penalty += 0.08
                direction = "далеко впереди" if shoulder_offset > 0 else "далеко позади"
                errors.append({
                    "error_type": "shoulder_position",
                    "severity": "medium",
                    "message": (
                        f"Плечи {direction} штанги. "
                        f"Плечи должны быть над штангой в начале тяги."
                    ),
                    "current_value": round(shoulder_offset, 3),
                    "expected_range": "±0.1",
                })

        # === 4. Бёдра ===
        hip_min = safe.get("hip_angle_min", nat_hip - 15)
        hip_max = safe.get("hip_angle_max", nat_hip + 15)

        if hip_angle < hip_min - 10:
            penalty += 0.08
            errors.append({
                "error_type": "hips_too_low",
                "severity": "medium",
                "message": (
                    f"Таз слишком низко ({hip_angle:.0f}°). "
                    f"Ваша норма: {nat_hip:.0f}° (±15°). "
                    f"Это не приседание — сохраняйте позицию тяги."
                ),
                "current_value": round(hip_angle, 1),
                "expected_range": f"{hip_min:.0f}-{hip_max:.0f}°",
            })
        elif hip_angle > hip_max + 10:
            penalty += 0.08
            errors.append({
                "error_type": "hips_too_high",
                "severity": "medium",
                "message": (
                    f"Таз слишком высоко ({hip_angle:.0f}°). "
                    f"Ваша норма: {nat_hip:.0f}° (±15°). "
                    f"Слишком большая нагрузка на спину."
                ),
                "current_value": round(hip_angle, 1),
                "expected_range": f"{hip_min:.0f}-{hip_max:.0f}°",
            })

        # === 5. Колени за носками ===
        knees_over = check_knees_over_toes(landmarks, tolerance=0.08)
        if any(knees_over.values()):
            sides = [s for s, v in knees_over.items() if v]
            penalty += 0.05
            errors.append({
                "error_type": "knees_over_toes",
                "severity": "low",
                "message": (
                    f"Колени выходят за носки ({', '.join(sides)}). "
                    f"В становой тяге голени близки к вертикали."
                ),
                "current_value": None,
                "expected_range": "Голени вертикальны",
            })

        # === 6. Чрезмерный наклон ===
        max_lean = safe.get("max_torso_lean", 70.0)
        if torso_lean > max_lean:
            penalty += 0.10
            errors.append({
                "error_type": "excessive_lean",
                "severity": "medium",
                "message": (
                    f"Чрезмерный наклон корпуса ({torso_lean:.0f}°). "
                    f"Ваш максимум: {max_lean:.0f}°."
                ),
                "current_value": round(torso_lean, 1),
                "expected_range": f"< {max_lean:.0f}°",
            })

        # === Финальная оценка ===
        score = max(0.0, min(1.0, 1.0 - penalty))

        # === Фидбэк ===
        if score >= 0.9:
            feedback = "Отличная техника тяги! ✅"
        elif score >= 0.75:
            feedback = "Хорошая техника, минимальные замечания 💪"
        elif score >= 0.5:
            feedback = "Есть ошибки в технике тяги ⚠️"
        else:
            feedback = "Серьёзные ошибки! Риск травмы спины ❌"

        return {
            "technique_score": round(score, 2),
            "errors": errors,
            "feedback": feedback,
            "metrics": {
                "knee_angle": round(knee_angle, 1),
                "hip_angle": round(hip_angle, 1),
                "torso_angle": round(torso_lean, 1),
                "back_angle": round(back_angle, 1),
                "symmetry": round(calculate_symmetry(landmarks, "hip"), 1),
            },
        }

    @classmethod
    def analyze(
        cls,
        db: Session,
        user_id: str,
        exercise_type: str,
        landmarks: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Анализирует технику одного кадра.

        Требует предварительной калибровки — без неё возвращает ошибку 404.

        Args:
            db: Сессия базы данных.
            user_id: ID пользователя.
            exercise_type: Тип упражнения.
            landmarks: 33 точки MediaPipe текущего кадра.

        Returns:
            Результат анализа.

        Raises:
            ValueError: Если нет калибровочного профиля.
        """
        # Получаем калибровочный профиль
        print(f">>> [SERVICE] TechniqueAnalyzer.analyze(): user={user_id}, exercise={exercise_type}, landmarks={len(landmarks)}")
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
        print(f">>> [SERVICE] Конвертировано {len(lm)} точек")

        if exercise_type == "squat":
            print(">>> [SERVICE] Запускаю анализ приседания...")
            result = cls._analyze_squat(lm, profile)
        elif exercise_type == "deadlift":
            print(">>> [SERVICE] Запускаю анализ становой тяги...")
            result = cls._analyze_deadlift(lm, profile)
        else:
            raise ValueError(f"Неизвестный тип упражнения: {exercise_type}")

        print(f">>> [SERVICE] Анализ завершён: score={result['technique_score']}, errors={len(result['errors'])}")
        return result
