"""
Сервис калибровки.

Анализирует 5 повторений упражнения для создания персонализированного
биомеханического профиля пользователя.

Философия: каждый человек уникален. Длинное бедро = больший наклон корпуса,
короткие руки = иная стартовая позиция в тяге, жёсткий голеностоп =
ограниченная глубина приседа. Мы изучаем ИХ движение, а не навязываем
универсальные стандарты.
"""

import logging
import uuid
from typing import Any, Dict, List, Optional

import numpy as np
from sqlalchemy.orm import Session

from app.models.calibration import CalibrationProfile
from app.models.user import User
from app.utils.pose_math import (
    calculate_angle,
    distance_3d,
    midpoint,
    calculate_torso_lean,
    calculate_back_angle,
    get_knee_angle,
    get_hip_angle,
    get_average_knee_angle,
    get_average_hip_angle,
    check_knee_valgus,
    calculate_symmetry,
    estimate_segment_length,
)


logger = logging.getLogger(__name__)


class CalibrationService:
    """
    Сервис персонализированной калибровки.

    Обрабатывает калибровочные последовательности для приседаний и становой тяги,
    создавая индивидуальный профиль биомеханики пользователя.
    """

    @staticmethod
    def _extract_landmarks_dict(
        frame: Dict[str, Any]
    ) -> Dict[str, Dict[str, float]]:
        """
        Преобразует кадр из формата Pydantic в словарь координат.

        Args:
            frame: Кадр с точками MediaPipe (ключ → {x, y, z}).

        Returns:
            Словарь {landmark_name: {x, y, z}}.
        """
        result = {}
        for name, point in frame.items():
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

    @staticmethod
    def _find_bottom_frame_squat(
        rep_frames: List[Dict[str, Dict[str, float]]]
    ) -> Dict[str, Dict[str, float]]:
        """
        Находит кадр с максимальной глубиной приседа (минимальный угол колена).

        Args:
            rep_frames: Список кадров одного повторения.

        Returns:
            Кадр в нижней точке приседа.
        """
        min_angle = 999.0
        bottom_frame = rep_frames[0]

        for frame in rep_frames:
            try:
                angle = get_average_knee_angle(frame)
                if angle < min_angle:
                    min_angle = angle
                    bottom_frame = frame
            except (KeyError, ValueError):
                continue

        return bottom_frame

    @staticmethod
    def _find_bottom_frame_deadlift(
        rep_frames: List[Dict[str, Dict[str, float]]]
    ) -> Dict[str, Dict[str, float]]:
        """
        Находит кадр в нижней позиции становой тяги (минимальный угол таза).

        Args:
            rep_frames: Список кадров одного повторения.

        Returns:
            Кадр в стартовой/нижней позиции тяги.
        """
        min_angle = 999.0
        bottom_frame = rep_frames[0]

        for frame in rep_frames:
            try:
                angle = get_average_hip_angle(frame)
                if angle < min_angle:
                    min_angle = angle
                    bottom_frame = frame
            except (KeyError, ValueError):
                continue

        return bottom_frame

    @classmethod
    def _calibrate_squat(
        cls,
        pose_sequence: List[List[Dict[str, Any]]]
    ) -> Dict[str, Any]:
        """
        Калибровка приседаний.

        Анализирует 5 повторений для определения:
        - Пропорций тела (длина бедра, голени, соотношение)
        - Естественной глубины приседа
        - Наклона корпуса
        - Склонности к вальгусу
        - Асимметрии

        Args:
            pose_sequence: 5 повторений — каждое список кадров с landmarks.

        Returns:
            Словарь с anthropometry, baseline_metrics, safe_ranges,
            movement_patterns, recommendations.
        """
        # Собираем метрики из каждого повторения
        print(f">>> [SERVICE] _calibrate_squat(): обработка {len(pose_sequence)} повторений...")
        depths: List[float] = []
        torso_leans: List[float] = []
        hip_angles: List[float] = []
        symmetries: List[float] = []
        valgus_counts: int = 0
        femur_lengths: List[float] = []
        tibia_lengths: List[float] = []
        heel_drops: List[float] = []   # foot_index.y - heel.y в стойке (база для определения отрыва пятки)

        for rep_raw_frames in pose_sequence:
            # Конвертируем кадры
            rep_frames = [cls._extract_landmarks_dict(f) for f in rep_raw_frames]

            if not rep_frames:
                continue

            # Находим нижнюю точку
            bottom = cls._find_bottom_frame_squat(rep_frames)

            try:
                # Глубина приседа — средний угол колена в нижней точке
                depth = get_average_knee_angle(bottom)
                depths.append(depth)

                # Наклон корпуса
                lean = calculate_torso_lean(bottom)
                torso_leans.append(lean)

                # Угол в тазу
                hip = get_average_hip_angle(bottom)
                hip_angles.append(hip)

                # Асимметрия коленей
                sym = calculate_symmetry(bottom, "knee")
                symmetries.append(sym)

                # Вальгус
                if check_knee_valgus(bottom):
                    valgus_counts += 1

                # Длины сегментов (используем стоячий кадр — первый или последний)
                standing = rep_frames[0]
                femur = estimate_segment_length(
                    standing["left_hip"], standing["left_knee"]
                )
                tibia = estimate_segment_length(
                    standing["left_knee"], standing["left_ankle"]
                )
                femur_lengths.append(femur)
                tibia_lengths.append(tibia)

                # Базовое расстояние пятка→носок в стойке (для детекции отрыва пятки)
                # В MediaPipe Y направлено вниз, поэтому foot_index.y > heel.y в норме
                for side in ("left", "right"):
                    fi_key = f"{side}_foot_index"
                    heel_key = f"{side}_heel"
                    if fi_key in standing and heel_key in standing:
                        drop = standing[fi_key]["y"] - standing[heel_key]["y"]
                        heel_drops.append(drop)

            except (KeyError, ValueError, ZeroDivisionError) as e:
                logger.warning(f"Ошибка при обработке повторения: {e}")
                continue

        if not depths:
            raise ValueError("Не удалось обработать ни одного повторения")

        print(f">>> [SERVICE] _calibrate_squat(): обработано {len(depths)} повторений, вычисляю медианы...")

        # Используем медиану — устойчива к выбросам
        natural_depth = float(np.median(depths))
        natural_lean = float(np.median(torso_leans))
        natural_hip = float(np.median(hip_angles))
        avg_symmetry = float(np.mean(symmetries)) if symmetries else 0.0
        avg_femur = float(np.median(femur_lengths)) if femur_lengths else 0.0
        avg_tibia = float(np.median(tibia_lengths)) if tibia_lengths else 0.0
        # Базовое смещение пятки в стойке; используется как эталон при детекции отрыва
        standing_heel_drop = float(np.median(heel_drops)) if heel_drops else 0.01

        # Соотношение бедро/голень — влияет на естественный наклон корпуса
        femur_tibia_ratio = (avg_femur / avg_tibia) if avg_tibia > 0 else 1.0

        # Генерация безопасных диапазонов НА ОСНОВЕ ЛИЧНЫХ ПОКАЗАТЕЛЕЙ
        # Диапазон ±15° от естественной глубины — персонально
        safe_depth_min = max(30.0, natural_depth - 15.0)
        safe_depth_max = min(180.0, natural_depth + 15.0)

        # Диапазон наклона ±10° — учитывает пропорции тела
        safe_lean_min = max(0.0, natural_lean - 10.0)
        safe_lean_max = min(90.0, natural_lean + 10.0)

        # Рекомендации на основе пропорций
        recommendations: List[str] = []

        if femur_tibia_ratio > 1.15:
            recommendations.append(
                f"Длинное бедро (соотношение {femur_tibia_ratio:.2f}) — "
                f"ваш естественный наклон корпуса {natural_lean:.0f}° является нормой. "
                f"Не пытайтесь держать спину вертикально."
            )

        if natural_depth > 100:
            recommendations.append(
                f"Ваша естественная глубина приседа {natural_depth:.0f}° — "
                f"возможно ограничена подвижностью голеностопа. "
                f"Работайте над подвижностью для увеличения глубины."
            )
        elif natural_depth < 80:
            recommendations.append(
                f"Отличная глубина приседа ({natural_depth:.0f}°) — "
                f"у вас хорошая подвижность. Контролируйте технику."
            )

        if avg_symmetry > 5.0:
            recommendations.append(
                f"Обнаружена асимметрия {avg_symmetry:.1f}° между левым и правым коленом. "
                f"Обратите внимание на равномерное распределение нагрузки."
            )

        # Вычисляем 비율 вальгуса к общему количеству (вместо жесткого >3)
        completed_reps = len(depths)
        if completed_reps > 0 and (valgus_counts / completed_reps) >= 0.5:
            recommendations.append(
                f"Склонность к вальгусу коленей (обнаружен в {valgus_counts}/{completed_reps} повторениях). "
                f"Рекомендуется укреплять среднюю ягодичную мышцу."
            )

        recommendations.append(
            f"Оптимальная глубина приседа для вас: {safe_depth_min:.0f}-{safe_depth_max:.0f}°"
        )

        print(">>> [SERVICE] _calibrate_squat(): расчёт завершён успешно.")
        return {
            "anthropometry": {
                "femur_length": round(avg_femur, 4),
                "tibia_length": round(avg_tibia, 4),
                "femur_tibia_ratio": round(femur_tibia_ratio, 3),
            },
            "baseline_metrics": {
                "natural_squat_depth": round(natural_depth, 1),
                "natural_torso_lean": round(natural_lean, 1),
                "natural_hip_angle": round(natural_hip, 1),
                "knee_valgus_tendency": (valgus_counts / len(depths)) >= 0.5 if depths else False,
                "asymmetry_percentage": round(avg_symmetry, 1),
                "standing_heel_drop": round(standing_heel_drop, 4),
            },
            "safe_ranges": {
                "depth_min": round(safe_depth_min, 1),
                "depth_max": round(safe_depth_max, 1),
                "torso_lean_min": round(safe_lean_min, 1),
                "torso_lean_max": round(safe_lean_max, 1),
                "max_asymmetry": round(max(avg_symmetry * 1.5, 10.0), 1),
            },
            "movement_patterns": {
                "depths_per_rep": [round(d, 1) for d in depths],
                "torso_leans_per_rep": [round(l, 1) for l in torso_leans],
                "consistency_score": round(
                    1.0 - min(float(np.std(depths)) / 20.0, 1.0), 2
                ),
            },
            "recommendations": recommendations,
        }

    @classmethod
    def _calibrate_deadlift(
        cls,
        pose_sequence: List[List[Dict[str, Any]]]
    ) -> Dict[str, Any]:
        """
        Калибровка становой тяги.

        Анализирует 5 повторений для определения:
        - Длины рук, торса, ног
        - Естественной стартовой позиции
        - Угла наклона таза (hip hinge)
        - Угла спины
        - Ширины хвата

        Args:
            pose_sequence: 5 повторений — каждое список кадров с landmarks.

        Returns:
            Словарь с anthropometry, baseline_metrics, safe_ranges,
            movement_patterns, recommendations.
        """
        print(f">>> [SERVICE] _calibrate_deadlift(): обработка {len(pose_sequence)} повторений...")
        start_knee_angles: List[float] = []
        start_hip_angles: List[float] = []
        back_angles: List[float] = []
        hip_hinge_angles: List[float] = []
        arm_lengths: List[float] = []
        torso_lengths: List[float] = []
        leg_lengths: List[float] = []
        grip_widths: List[float] = []

        for rep_raw_frames in pose_sequence:
            rep_frames = [cls._extract_landmarks_dict(f) for f in rep_raw_frames]

            if not rep_frames:
                continue

            # Нижняя позиция — стартовая
            bottom = cls._find_bottom_frame_deadlift(rep_frames)
            standing = rep_frames[-1] if len(rep_frames) > 1 else rep_frames[0]

            try:
                # Углы в стартовой позиции
                knee_angle = get_average_knee_angle(bottom)
                start_knee_angles.append(knee_angle)

                hip_angle = get_average_hip_angle(bottom)
                start_hip_angles.append(hip_angle)

                # Угол спины
                back_ang = calculate_back_angle(bottom)
                back_angles.append(back_ang)

                # Hip hinge — насколько наклоняется таз
                hip_hinge = calculate_torso_lean(bottom)
                hip_hinge_angles.append(hip_hinge)

                # Антропометрия (из стоячей позиции)
                # Длина руки: плечо → локоть → кисть
                arm_upper = estimate_segment_length(
                    standing["left_shoulder"], standing["left_elbow"]
                )
                arm_lower = estimate_segment_length(
                    standing["left_elbow"], standing["left_wrist"]
                )
                arm_lengths.append(arm_upper + arm_lower)

                # Длина торса: середина плеч → середина бёдер
                mid_sh = midpoint(standing["left_shoulder"], standing["right_shoulder"])
                mid_hp = midpoint(standing["left_hip"], standing["right_hip"])
                torso_len = distance_3d(mid_sh, mid_hp)
                torso_lengths.append(torso_len)

                # Длина ног: таз → колено → лодыжка
                femur = estimate_segment_length(
                    standing["left_hip"], standing["left_knee"]
                )
                tibia = estimate_segment_length(
                    standing["left_knee"], standing["left_ankle"]
                )
                leg_lengths.append(femur + tibia)

                # Ширина хвата относительно плеч
                shoulder_width = abs(
                    standing["left_shoulder"]["x"] - standing["right_shoulder"]["x"]
                )
                wrist_width = abs(
                    bottom["left_wrist"]["x"] - bottom["right_wrist"]["x"]
                )
                if shoulder_width > 0:
                    grip_widths.append(wrist_width / shoulder_width)

            except (KeyError, ValueError, ZeroDivisionError) as e:
                logger.warning(f"Ошибка при обработке повторения: {e}")
                continue

        if not start_knee_angles:
            raise ValueError("Не удалось обработать ни одного повторения")

        print(f">>> [SERVICE] _calibrate_deadlift(): обработано {len(start_knee_angles)} повторений, вычисляю медианы...")

        # Медианы — устойчивы к выбросам
        nat_start_knee = float(np.median(start_knee_angles))
        nat_start_hip = float(np.median(start_hip_angles))
        nat_back_angle = float(np.median(back_angles))
        nat_hip_hinge = float(np.median(hip_hinge_angles))
        avg_arm = float(np.median(arm_lengths)) if arm_lengths else 0.0
        avg_torso = float(np.median(torso_lengths)) if torso_lengths else 0.0
        avg_leg = float(np.median(leg_lengths)) if leg_lengths else 0.0
        avg_grip = float(np.median(grip_widths)) if grip_widths else 1.0

        # Безопасные диапазоны на основе ЛИЧНЫХ показателей
        safe_back_min = max(140.0, nat_back_angle - 15.0)
        safe_back_max = 180.0

        safe_hip_min = max(30.0, nat_start_hip - 15.0)
        safe_hip_max = min(180.0, nat_start_hip + 15.0)

        # Рекомендации
        recommendations: List[str] = []

        arm_to_torso = (avg_arm / avg_torso) if avg_torso > 0 else 1.0

        if arm_to_torso < 0.85:
            recommendations.append(
                f"Короткие руки (соотношение рука/торс: {arm_to_torso:.2f}) — "
                f"вам нужно наклоняться ниже, чтобы достать штангу. "
                f"Это нормально для вашей анатомии."
            )
        elif arm_to_torso > 1.1:
            recommendations.append(
                f"Длинные руки (соотношение рука/торс: {arm_to_torso:.2f}) — "
                f"преимущество для становой тяги! Меньший наклон корпуса."
            )

        if nat_back_angle < 160:
            recommendations.append(
                f"Угол спины {nat_back_angle:.0f}° — следите за прямой спиной. "
                f"Рекомендуется укреплять разгибатели позвоночника."
            )
        else:
            recommendations.append(
                f"Отличное положение спины ({nat_back_angle:.0f}°). Продолжайте в том же духе!"
            )

        recommendations.append(
            f"Ваша естественная стартовая позиция: колени {nat_start_knee:.0f}°, "
            f"таз {nat_start_hip:.0f}°, наклон {nat_hip_hinge:.0f}°"
        )

        return {
            "anthropometry": {
                "arm_length": round(avg_arm, 4),
                "torso_length": round(avg_torso, 4),
                "leg_length": round(avg_leg, 4),
                "arm_to_torso_ratio": round(arm_to_torso, 3),
                "grip_width_ratio": round(avg_grip, 3),
            },
            "baseline_metrics": {
                "natural_start_knee_angle": round(nat_start_knee, 1),
                "natural_start_hip_angle": round(nat_start_hip, 1),
                "natural_back_angle": round(nat_back_angle, 1),
                "natural_hip_hinge_angle": round(nat_hip_hinge, 1),
            },
            "safe_ranges": {
                "back_angle_min": round(safe_back_min, 1),
                "back_angle_max": round(safe_back_max, 1),
                "hip_angle_min": round(safe_hip_min, 1),
                "hip_angle_max": round(safe_hip_max, 1),
                "max_torso_lean": round(min(nat_hip_hinge + 15.0, 80.0), 1),
            },
            "movement_patterns": {
                "start_knee_angles_per_rep": [round(a, 1) for a in start_knee_angles],
                "start_hip_angles_per_rep": [round(a, 1) for a in start_hip_angles],
                "back_angles_per_rep": [round(a, 1) for a in back_angles],
                "consistency_score": round(
                    1.0 - min(float(np.std(start_hip_angles)) / 20.0, 1.0), 2
                ),
            },
            "recommendations": recommendations,
        }

    @classmethod
    def process_calibration(
        cls,
        db: Session,
        user_id: str,
        exercise_type: str,
        pose_sequence: List[List[Dict[str, Any]]],
    ) -> Dict[str, Any]:
        """
        Главный метод калибровки.

        Обрабатывает 5 повторений, создаёт/обновляет профиль в БД,
        возвращает результат с рекомендациями.

        Args:
            db: Сессия базы данных.
            user_id: ID пользователя Supabase.
            exercise_type: Тип упражнения (squat/deadlift).
            pose_sequence: 5 повторений с кадрами.

        Returns:
            Словарь с результатами калибровки.

        Raises:
            ValueError: Если данные невалидны.
        """
        logger.info(
            f"Калибровка {exercise_type} для пользователя {user_id}: "
            f"{len(pose_sequence)} повторений"
        )
        print(f">>> [SERVICE] process_calibration(): user={user_id}, exercise={exercise_type}, reps={len(pose_sequence)}")

        # Валидация количества повторений
        if not pose_sequence:
            raise ValueError("Требуется как минимум 1 повторение для калибровки")
        
        reps_count = len(pose_sequence)

        # Обеспечиваем наличие пользователя в БД
        print(">>> [SERVICE] Запрос к User в БД...")
        existing_user = db.query(User).filter(User.id == user_id).first()
        if not existing_user:
            print(">>> [SERVICE] Пользователь не найден, создаю...")
            new_user = User(id=user_id)
            db.add(new_user)
            db.flush()
        else:
            print(">>> [SERVICE] Пользователь найден в БД.")

        # Выполняем калибровку в зависимости от типа упражнения
        print(f">>> [SERVICE] Запускаю калибровку {exercise_type}...")
        if exercise_type == "squat":
            calibration_data = cls._calibrate_squat(pose_sequence)
        elif exercise_type == "deadlift":
            calibration_data = cls._calibrate_deadlift(pose_sequence)
        else:
            raise ValueError(
                f"Неизвестный тип упражнения: {exercise_type}. "
                f"Допустимые: squat, deadlift"
            )

        # Создаём или обновляем профиль в БД
        print(">>> [SERVICE] Запрос к профилю калибровки в БД...")
        existing_profile = (
            db.query(CalibrationProfile)
            .filter(
                CalibrationProfile.user_id == user_id,
                CalibrationProfile.exercise_type == exercise_type,
            )
            .first()
        )

        if existing_profile:
            existing_profile.anthropometry = calibration_data["anthropometry"]
            existing_profile.baseline_metrics = calibration_data["baseline_metrics"]
            existing_profile.safe_ranges = calibration_data["safe_ranges"]
            existing_profile.movement_patterns = calibration_data["movement_patterns"]
            existing_profile.recommendations = calibration_data["recommendations"]
            existing_profile.calibration_reps_count = reps_count
            profile = existing_profile
            logger.info(f"Обновлён профиль калибровки {profile.id}")
        else:
            profile = CalibrationProfile(
                user_id=user_id,
                exercise_type=exercise_type,
                anthropometry=calibration_data["anthropometry"],
                baseline_metrics=calibration_data["baseline_metrics"],
                safe_ranges=calibration_data["safe_ranges"],
                movement_patterns=calibration_data["movement_patterns"],
                recommendations=calibration_data["recommendations"],
                calibration_reps_count=reps_count,
            )
            db.add(profile)
            logger.info(f"Создан новый профиль калибровки для {user_id}/{exercise_type}")

        print(">>> [SERVICE] Cохраняю профиль в БД (commit)...")
        db.commit()
        db.refresh(profile)
        print(">>> [SERVICE] process_calibration(): расчёт завершён успешно.")

        return {
            "calibration_completed": True,
            "user_id": user_id,
            "exercise_type": exercise_type,
            "profile": {
                "id": str(profile.id),
                "anthropometry": calibration_data["anthropometry"],
                "baseline_metrics": calibration_data["baseline_metrics"],
                "safe_ranges": calibration_data["safe_ranges"],
                "movement_patterns": calibration_data["movement_patterns"],
            },
            "recommendations": calibration_data["recommendations"],
        }

    @staticmethod
    def get_profile(
        db: Session,
        user_id: str,
        exercise_type: str,
    ) -> Optional[CalibrationProfile]:
        """
        Получает профиль калибровки из БД.

        Args:
            db: Сессия базы данных.
            user_id: ID пользователя.
            exercise_type: Тип упражнения.

        Returns:
            CalibrationProfile или None если не найден.
        """
        return (
            db.query(CalibrationProfile)
            .filter(
                CalibrationProfile.user_id == user_id,
                CalibrationProfile.exercise_type == exercise_type,
            )
            .first()
        )
