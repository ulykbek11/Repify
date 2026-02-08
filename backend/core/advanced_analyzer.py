import math

class AdvancedAnalyzer:
    
    def detect_shallow_squat(self, landmarks, knee_angle, phase):
        """
        Неглубокий присед - определяется по минимальному углу колена во время нижней фазы.
        Вызывается каждый кадр, но имеет смысл только в фазе 'down'.
        
        Returns:
            float: 0.0-1.0 confidence score
        """
        if not phase or phase.lower() != "down":
            return 0.0
        
        # Оценка глубины по углу колена:
        # < 90° - глубокий присед (отлично)
        # 90-100° - параллель (хорошо)
        # 100-110° - чуть выше параллели (приемлемо, но не идеально)
        # 110-120° - явно недоприсед (suspicion 0.6-0.8)
        # > 120° - критический недоприсед (suspicion 0.9-1.0)
        
        if knee_angle >= 125:
            return 0.95  # Очень высокая уверенность в ошибке
        elif knee_angle >= 115:
            return 0.85  # Высокая уверенность
        elif knee_angle >= 105:
            return 0.65  # Средняя уверенность
        elif knee_angle >= 95:
            return 0.4   # Низкая уверенность (почти норма)
        
        return 0.0  # Глубина достаточная
    
    def detect_heel_lift(self, landmarks, phase):
        """
        НОВАЯ ЛОГИКА: Пятка поднимается над носком.
        В норме: пятка НИЖЕ или на уровне носка.
        При отрыве: пятка ВЫШЕ носка.
        """
        if not phase or phase.lower() != "down":
            return 0.0
        
        max_suspicion = 0.0
        
        for i in [0, 1]:  # Обе ноги
            # Indices based on MediaPipe Pose:
            # 23-24: Hip, 25-26: Knee, 27-28: Ankle, 29-30: Heel, 31-32: Toe
            
            heel = landmarks[29 + i]   # Пятка 
            toe = landmarks[31 + i]    # Носок 
            ankle = landmarks[27 + i]  # Голеностоп 
            knee = landmarks[25 + i]   # Колено 
            
            # Visibility check to avoid noise from invisible legs
            if hasattr(knee, 'visibility') and knee.visibility < 0.5:
                continue
            
            # === ГЛАВНОЕ УСЛОВИЕ: Высота пятки относительно носка ===
            # MediaPipe Y increases downwards.
            # Heel Y < Toe Y means Heel is higher in image (closer to top).
            # heel_lift = toe.y - heel.y > 0 -> Heel is higher.
            
            heel_lift = toe.y - heel.y 
            
            # Смягченные условия (Relaxed Thresholds v2)
            if heel_lift > 0.12:  # Пятка на 12%+ выше носка
                max_suspicion = max(max_suspicion, 0.95)
            elif heel_lift > 0.10:
                max_suspicion = max(max_suspicion, 0.7)
            elif heel_lift > 0.08:
                max_suspicion = max(max_suspicion, 0.5)
            
            # === ДОПОЛНИТЕЛЬНО: Колено слишком впереди голеностопа ===
            # Use abs to support both left/right facing
            knee_forward = abs(knee.x - ankle.x)
            ankle_heel_distance = abs(ankle.x - heel.x)
            
            # Если колено впереди голеностопа больше чем длина стопы
            if ankle_heel_distance > 0.01:
                forward_ratio = knee_forward / ankle_heel_distance
                if forward_ratio > 3.0:  # Колено впереди на 300% длины стопы
                    # Снижаем вес этого фактора, так как колени за носки - это часто норма
                    max_suspicion = max(max_suspicion, 0.4)
        
        return max_suspicion
    
    def detect_torso_lean(self, landmarks, phase):
        """
        НОВАЯ ЛОГИКА: Угол наклона корпуса от вертикали.
        Корпус = линия от бедра до плеча.
        """
        if not phase or phase.lower() != "down":
            return 0.0
        
        # Центры плеч и бедер
        shoulder_x = (landmarks[11].x + landmarks[12].x) / 2
        shoulder_y = (landmarks[11].y + landmarks[12].y) / 2
        hip_x = (landmarks[23].x + landmarks[24].x) / 2
        hip_y = (landmarks[23].y + landmarks[24].y) / 2
        
        # Вектор корпуса
        vertical = abs(shoulder_y - hip_y)
        horizontal = abs(shoulder_x - hip_x)
        
        if vertical < 0.05:  # Защита от ошибок детекции
            return 0.0
        
        # === УГОЛ НАКЛОНА ===
        # tan(угол) = горизонталь / вертикаль
        # В норме: корпус почти вертикален (угол < 15°)
        
        lean_ratio = horizontal / vertical
        
        # Смягченные пороги (Relaxed Thresholds v3)
        if lean_ratio > 1.5:  # Экстремальный наклон (было 1.2)
            return 0.95
        elif lean_ratio > 1.2: # Сильный наклон (было 1.0)
            return 0.75
        elif lean_ratio > 1.0: # Умеренный наклон (было 0.8)
            return 0.5
        
        return 0.0
