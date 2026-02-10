"""
Calibration Analyzer - Определение анатомических пропорций пользователя
"""
import cv2
import numpy as np
import math
from typing import Dict, Any, List, Tuple
from .analyzer import BaseAnalyzer, create_safe_response


class ValidationError(Exception):
    """Ошибка валидации калибровки"""
    pass


class CalibrationAnalyzer(BaseAnalyzer):
    """
    Анализатор для калибровки пользователя.
    Определяет анатомические пропорции и подвижность на основе 5 приседаний.
    """
    
    def __init__(self):
        super().__init__()
        self.REQUIRED_REPS = 5
        self.MIN_CONFIDENCE = 0.5
        
        # Данные для сбора
        self.measurements: List[Dict] = []
        self.rep_count = 0
        self.stage = "up"
        self.min_angle_in_rep = 180
        self.bottom_frame_captured = False
        
        # Thresholds for state machine
        self.DOWN_THRESHOLD = 100
        self.UP_THRESHOLD = 160
        
    def reset(self):
        self.measurements = []
        self.rep_count = 0
        self.stage = "up"
        self.min_angle_in_rep = 180
        self.bottom_frame_captured = False
        
    def _calculate_distance(self, p1, p2) -> float:
        """Евклидово расстояние между двумя точками"""
        return math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2)
    
    def _validate_camera_angle(self, landmarks) -> Tuple[bool, str]:
        """
        Проверяет, что камера расположена сбоку.
        Если оба плеча хорошо видны - скорее всего камера спереди.
        """
        left_shoulder = landmarks[11]
        right_shoulder = landmarks[12]
        left_hip = landmarks[23]
        right_hip = landmarks[24]
        
        # Visibility check
        shoulder_vis_diff = abs(left_shoulder.visibility - right_shoulder.visibility)
        hip_vis_diff = abs(left_hip.visibility - right_hip.visibility)
        
        # Если оба плеча видны одинаково хорошо - камера спереди/сзади
        if shoulder_vis_diff < 0.2 and left_shoulder.visibility > 0.7 and right_shoulder.visibility > 0.7:
            return False, "Камера должна быть сбоку. Пожалуйста, поверните телефон."
        
        # Расстояние между плечами (в нормализованных координатах)
        shoulder_distance = abs(left_shoulder.x - right_shoulder.x)
        hip_distance = abs(left_hip.x - right_hip.x)
        
        # При виде сбоку плечи/бедра перекрываются (маленькое расстояние)
        if shoulder_distance > 0.15 and hip_distance > 0.15:
            return False, "Камера должна быть сбоку. Пожалуйста, поверните телефон."
            
        return True, "OK"
    
    def _capture_bottom_measurements(self, landmarks) -> Dict:
        """
        Захватывает измерения в нижней точке приседа.
        """
        # Выбираем более видимую сторону
        l_vis = landmarks[23].visibility
        r_vis = landmarks[24].visibility
        
        if l_vis > r_vis:
            shoulder = landmarks[11]
            hip = landmarks[23]
            knee = landmarks[25]
            ankle = landmarks[27]
            heel = landmarks[29]
            toe = landmarks[31]
        else:
            shoulder = landmarks[12]
            hip = landmarks[24]
            knee = landmarks[26]
            ankle = landmarks[28]
            heel = landmarks[30]
            toe = landmarks[32]
        
        # Длины сегментов (в нормализованных координатах)
        femur_len = self._calculate_distance(hip, knee)
        tibia_len = self._calculate_distance(knee, ankle)
        torso_len = self._calculate_distance(shoulder, hip)
        
        # Подвижность голеностопа: насколько пятка поднимается
        # Чем меньше heel_lift, тем лучше подвижность
        heel_lift = toe.y - heel.y  # Положительное = пятка выше носка
        
        # Подвижность бедра: минимальный угол колена
        knee_angle = self.calculate_angle(hip, knee, ankle)
        
        # Насколько колено выходит вперед относительно носка
        knee_forward = knee.x - toe.x  # Положительное = колено впереди носка
        
        # Наклон корпуса
        torso_lean = abs(shoulder.x - hip.x) / max(abs(shoulder.y - hip.y), 0.01)
        
        return {
            "femur_len": femur_len,
            "tibia_len": tibia_len,
            "torso_len": torso_len,
            "heel_lift": heel_lift,
            "min_knee_angle": knee_angle,
            "knee_forward": knee_forward,
            "torso_lean": torso_lean
        }
    
    def process_calibration_frame(self, frame) -> Dict[str, Any]:
        """
        Обрабатывает один кадр для калибровки.
        Возвращает статус и данные.
        """
        results, image = self.process_frame(frame)
        
        if not results.pose_landmarks:
            return {
                "status": "no_pose",
                "message": "Встаньте в кадр",
                "reps": self.rep_count,
                "required_reps": self.REQUIRED_REPS
            }
        
        landmarks = results.pose_landmarks.landmark
        
        # Проверка ракурса
        angle_ok, angle_msg = self._validate_camera_angle(landmarks)
        if not angle_ok:
            return {
                "status": "wrong_angle",
                "message": angle_msg,
                "reps": self.rep_count,
                "required_reps": self.REQUIRED_REPS
            }
        
        # Выбираем более видимую сторону для угла
        l_vis = landmarks[23].visibility
        r_vis = landmarks[24].visibility
        
        if l_vis > r_vis:
            hip, knee, ankle = landmarks[23], landmarks[25], landmarks[27]
        else:
            hip, knee, ankle = landmarks[24], landmarks[26], landmarks[28]
        
        knee_angle = self.calculate_angle(hip, knee, ankle)
        
        # State machine для подсчета повторений
        if self.stage == "up":
            if knee_angle < self.DOWN_THRESHOLD:
                self.stage = "down"
                self.min_angle_in_rep = knee_angle
                self.bottom_frame_captured = False
        
        elif self.stage == "down":
            # Обновляем минимальный угол
            if knee_angle < self.min_angle_in_rep:
                self.min_angle_in_rep = knee_angle
                
            # Захватываем измерения в самой нижней точке
            if not self.bottom_frame_captured and knee_angle < 95:
                measurements = self._capture_bottom_measurements(landmarks)
                self.measurements.append(measurements)
                self.bottom_frame_captured = True
            
            # Подъем
            if knee_angle > self.UP_THRESHOLD:
                self.stage = "up"
                self.rep_count += 1
                
                # Если не захватили в нижней точке, захватываем сейчас
                if not self.bottom_frame_captured:
                    measurements = self._capture_bottom_measurements(landmarks)
                    self.measurements.append(measurements)
        
        # Проверка завершения
        if self.rep_count >= self.REQUIRED_REPS:
            return {
                "status": "complete",
                "message": "Калибровка завершена!",
                "reps": self.rep_count,
                "required_reps": self.REQUIRED_REPS,
                "biomechanics": self._calculate_final_biomechanics()
            }
        
        return {
            "status": "recording",
            "message": f"Осталось {self.REQUIRED_REPS - self.rep_count} приседаний",
            "reps": self.rep_count,
            "required_reps": self.REQUIRED_REPS,
            "current_angle": int(knee_angle),
            "stage": self.stage
        }
    
    def _calculate_final_biomechanics(self) -> Dict[str, Any]:
        """
        Рассчитывает финальные биомеханические параметры на основе всех измерений.
        """
        if not self.measurements:
            return self._get_default_biomechanics()
        
        # Усредняем все измерения
        avg = {}
        keys = self.measurements[0].keys()
        for key in keys:
            values = [m[key] for m in self.measurements if m.get(key) is not None]
            avg[key] = np.mean(values) if values else 0
        
        # Рассчитываем соотношения
        femur_to_tibia = avg["femur_len"] / max(avg["tibia_len"], 0.01)
        torso_to_leg = avg["torso_len"] / max(avg["femur_len"] + avg["tibia_len"], 0.01)
        
        # Оценка подвижности (1-10)
        # Ankle mobility: меньше heel_lift = лучше
        ankle_mobility = max(1, min(10, 10 - (avg["heel_lift"] * 100)))
        
        # Hip mobility: меньше min_knee_angle = лучше
        hip_mobility = max(1, min(10, (120 - avg["min_knee_angle"]) / 5 + 5))
        
        # Quality score (1-5)
        quality = min(5, len(self.measurements))
        
        # Генерация персональных порогов
        thresholds = self._generate_thresholds(femur_to_tibia, torso_to_leg, ankle_mobility)
        
        # Интерпретация
        body_type = self._interpret_body_type(femur_to_tibia, torso_to_leg)
        
        return {
            "biomechanics": {
                "femur_to_tibia_ratio": round(femur_to_tibia, 2),
                "torso_to_leg_ratio": round(torso_to_leg, 2),
                "ankle_mobility_score": round(ankle_mobility, 1),
                "hip_mobility_score": round(hip_mobility, 1)
            },
            "thresholds": thresholds,
            "quality_score": quality,
            "body_type": body_type
        }
    
    def _generate_thresholds(self, femur_ratio: float, torso_ratio: float, ankle_mobility: float) -> Dict:
        """
        Генерирует персональные пороги для анализа техники.
        """
        # База
        max_torso_lean = 45  # градусы
        min_depth_angle = 100
        max_knee_forward = 0.05  # нормализованные координаты
        
        # Корректировка под длинное бедро
        if femur_ratio > 1.15:
            max_torso_lean += 10  # Разрешаем больший наклон
            max_knee_forward += 0.03  # Колени могут выходить дальше
        
        # Корректировка под короткий торс
        if torso_ratio < 0.4:
            max_torso_lean += 5
        
        # Корректировка под плохую подвижность голеностопа
        if ankle_mobility < 5:
            max_knee_forward -= 0.02  # Меньше выход коленей
            min_depth_angle += 5  # Меньше глубина
        
        return {
            "max_torso_lean_deg": round(max_torso_lean),
            "min_depth_angle": round(min_depth_angle),
            "max_knee_forward": round(max_knee_forward, 3),
            "max_heel_lift": 0.08 if ankle_mobility > 7 else 0.12
        }
    
    def _interpret_body_type(self, femur_ratio: float, torso_ratio: float) -> Dict:
        """
        Интерпретирует тип телосложения для пользователя.
        """
        femur_type = "длинное" if femur_ratio > 1.15 else ("короткое" if femur_ratio < 0.95 else "среднее")
        torso_type = "длинный" if torso_ratio > 0.5 else ("короткий" if torso_ratio < 0.4 else "средний")
        
        return {
            "femur": femur_type,
            "torso": torso_type,
            "description": f"Бедро: {femur_type}, Корпус: {torso_type}"
        }
    
    def _get_default_biomechanics(self) -> Dict:
        """Возвращает дефолтные значения если калибровка не удалась"""
        return {
            "biomechanics": {
                "femur_to_tibia_ratio": 1.0,
                "torso_to_leg_ratio": 0.45,
                "ankle_mobility_score": 7,
                "hip_mobility_score": 7
            },
            "thresholds": {
                "max_torso_lean_deg": 50,
                "min_depth_angle": 100,
                "max_knee_forward": 0.05,
                "max_heel_lift": 0.10
            },
            "quality_score": 0,
            "body_type": {
                "femur": "среднее",
                "torso": "средний",
                "description": "Стандартные параметры (калибровка не выполнена)"
            }
        }
    
    def analyze_video(self, video_path: str) -> Dict[str, Any]:
        """
        Анализирует видео для калибровки.
        Вызывает ValidationError при проблемах.
        """
        self.reset()
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValidationError("Не удалось открыть видео файл")
        
        frame_count = 0
        angle_validated = False
        
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                frame_count += 1
                
                # Пропускаем каждый 2-й кадр для скорости
                if frame_count % 2 != 0:
                    continue
                
                result = self.process_calibration_frame(frame)
                
                # Проверка ракурса на первых кадрах
                if not angle_validated:
                    if result["status"] == "wrong_angle":
                        raise ValidationError(result["message"])
                    elif result["status"] == "recording":
                        angle_validated = True
                
                # Проверка завершения
                if result["status"] == "complete":
                    return result["biomechanics"]
            
            # Проверка количества повторений
            if self.rep_count < self.REQUIRED_REPS:
                raise ValidationError(f"Недостаточно приседаний: {self.rep_count}/{self.REQUIRED_REPS}")
            
            return self._calculate_final_biomechanics()
            
        finally:
            cap.release()
