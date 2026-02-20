"""
Математические утилиты для работы с позой тела.

Все функции работают с координатами MediaPipe (33 точки тела).
Координаты нормализованы в диапазоне 0-1.
"""

import math
from typing import Any, Dict, Optional

import numpy as np


# =============================================================================
# Константы MediaPipe Pose Landmarks
# =============================================================================

LANDMARK_NAMES = [
    "nose", "left_eye_inner", "left_eye", "left_eye_outer",
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


def calculate_angle(
    a: Dict[str, float],
    b: Dict[str, float],
    c: Dict[str, float]
) -> float:
    """
    Вычисляет угол в точке b между лучами ba и bc (градусы 0-180).

    Используется для измерения углов суставов:
    - Колено: бедро → колено → лодыжка
    - Таз: плечо → таз → колено
    - Локоть: плечо → локоть → кисть

    Args:
        a: Первая точка {x, y, z}.
        b: Вершина угла {x, y, z}.
        c: Третья точка {x, y, z}.

    Returns:
        Угол в градусах (0-180).

    Raises:
        ValueError: Если любые две точки совпадают.
    """
    vec_ba = np.array([a["x"] - b["x"], a["y"] - b["y"], a.get("z", 0) - b.get("z", 0)])
    vec_bc = np.array([c["x"] - b["x"], c["y"] - b["y"], c.get("z", 0) - b.get("z", 0)])

    norm_ba = np.linalg.norm(vec_ba)
    norm_bc = np.linalg.norm(vec_bc)

    if norm_ba < 1e-10 or norm_bc < 1e-10:
        raise ValueError("Точки не должны совпадать — невозможно вычислить угол")

    cos_angle = np.dot(vec_ba, vec_bc) / (norm_ba * norm_bc)
    # Ограничиваем для защиты от ошибок округления
    cos_angle = np.clip(cos_angle, -1.0, 1.0)

    angle_rad = np.arccos(cos_angle)
    return float(np.degrees(angle_rad))


def distance_3d(a: Dict[str, float], b: Dict[str, float]) -> float:
    """
    Евклидово расстояние между двумя 3D точками.

    Args:
        a: Первая точка {x, y, z}.
        b: Вторая точка {x, y, z}.

    Returns:
        Расстояние (float >= 0).
    """
    dx = a["x"] - b["x"]
    dy = a["y"] - b["y"]
    dz = a.get("z", 0) - b.get("z", 0)
    return math.sqrt(dx * dx + dy * dy + dz * dz)


def midpoint(a: Dict[str, float], b: Dict[str, float]) -> Dict[str, float]:
    """
    Вычисляет среднюю точку между двумя точками.

    Args:
        a: Первая точка {x, y, z}.
        b: Вторая точка {x, y, z}.

    Returns:
        Средняя точка {x, y, z}.
    """
    return {
        "x": (a["x"] + b["x"]) / 2,
        "y": (a["y"] + b["y"]) / 2,
        "z": (a.get("z", 0) + b.get("z", 0)) / 2,
    }


def calculate_torso_lean(landmarks: Dict[str, Dict[str, float]]) -> float:
    """
    Угол наклона корпуса от вертикали.

    Измеряет угол между вектором середина_плеч→середина_бёдер
    и вертикальной осью. 0° = идеально вертикально.

    Args:
        landmarks: Словарь 33 точек MediaPipe {name: {x, y, z}}.

    Returns:
        Угол наклона в градусах (0 = вертикально, 90 = горизонтально).
    """
    mid_shoulder = midpoint(landmarks["left_shoulder"], landmarks["right_shoulder"])
    mid_hip = midpoint(landmarks["left_hip"], landmarks["right_hip"])

    # Вектор от бёдер к плечам (направление корпуса)
    dx = mid_shoulder["x"] - mid_hip["x"]
    # В MediaPipe ось Y направлена ВНИЗ, поэтому плечи имеют меньший y чем бёдра
    dy = mid_hip["y"] - mid_shoulder["y"]

    if abs(dy) < 1e-10:
        return 90.0

    # Угол от вертикали: arctan(горизонтальное_отклонение / вертикальная_высота)
    angle = math.degrees(math.atan2(abs(dx), dy))
    return max(0.0, min(angle, 90.0))


def calculate_back_angle(landmarks: Dict[str, Dict[str, float]]) -> float:
    """
    Угол спины для становой тяги.

    Измеряет угол между тремя точками: середина_плеч → середина_бёдер → середина_колен.
    180° = спина полностью прямая (в одной линии с бёдрами).
    Значения < 180° указывают на округление спины.

    Args:
        landmarks: Словарь 33 точек MediaPipe.

    Returns:
        Угол спины в градусах (обычно 150-180°).
    """
    mid_shoulder = midpoint(landmarks["left_shoulder"], landmarks["right_shoulder"])
    mid_hip = midpoint(landmarks["left_hip"], landmarks["right_hip"])
    mid_knee = midpoint(landmarks["left_knee"], landmarks["right_knee"])

    return calculate_angle(mid_shoulder, mid_hip, mid_knee)


def get_knee_angle(landmarks: Dict[str, Dict[str, float]], side: str = "left") -> float:
    """
    Угол в коленном суставе.

    Args:
        landmarks: Словарь 33 точек MediaPipe.
        side: Сторона тела — "left" или "right".

    Returns:
        Угол в колене (градусы). ~180° = выпрямлено, ~90° = глубокий присед.
    """
    hip = landmarks[f"{side}_hip"]
    knee = landmarks[f"{side}_knee"]
    ankle = landmarks[f"{side}_ankle"]
    return calculate_angle(hip, knee, ankle)


def get_hip_angle(landmarks: Dict[str, Dict[str, float]], side: str = "left") -> float:
    """
    Угол в тазобедренном суставе.

    Измеряется как угол плечо → таз → колено.

    Args:
        landmarks: Словарь 33 точек MediaPipe.
        side: Сторона тела — "left" или "right".

    Returns:
        Угол в тазу (градусы). ~180° = стоя прямо, ~90° = глубокий наклон.
    """
    shoulder = landmarks[f"{side}_shoulder"]
    hip = landmarks[f"{side}_hip"]
    knee = landmarks[f"{side}_knee"]
    return calculate_angle(shoulder, hip, knee)


def get_average_knee_angle(landmarks: Dict[str, Dict[str, float]]) -> float:
    """
    Средний угол обоих коленей.

    Args:
        landmarks: Словарь 33 точек MediaPipe.

    Returns:
        Средний угол коленей в градусах.
    """
    left = get_knee_angle(landmarks, "left")
    right = get_knee_angle(landmarks, "right")
    return (left + right) / 2


def get_average_hip_angle(landmarks: Dict[str, Dict[str, float]]) -> float:
    """
    Средний угол обоих тазобедренных суставов.

    Args:
        landmarks: Словарь 33 точек MediaPipe.

    Returns:
        Средний угол тазобедренных суставов в градусах.
    """
    left = get_hip_angle(landmarks, "left")
    right = get_hip_angle(landmarks, "right")
    return (left + right) / 2


def check_knee_valgus(landmarks: Dict[str, Dict[str, float]]) -> bool:
    """
    Проверка вальгуса коленей (заваливание внутрь).

    Вальгус определяется, когда расстояние между коленями
    МЕНЬШЕ расстояния между лодыжками — колени сближаются.

    Args:
        landmarks: Словарь 33 точек MediaPipe.

    Returns:
        True если обнаружен вальгус коленей.
    """
    knee_distance = abs(landmarks["left_knee"]["x"] - landmarks["right_knee"]["x"])
    ankle_distance = abs(landmarks["left_ankle"]["x"] - landmarks["right_ankle"]["x"])

    # Вальгус: колени ближе друг к другу, чем лодыжки
    # Добавляем 5% допуск для нормальных колебаний
    return knee_distance < ankle_distance * 0.95


def check_knees_over_toes(
    landmarks: Dict[str, Dict[str, float]],
    tolerance: float = 0.1
) -> Dict[str, bool]:
    """
    Проверяет, выходят ли колени за носки.

    В MediaPipe координата X растёт вправо.
    Для фронтальной камеры проверяем по оси X (горизонтальное положение).
    Для боковой — тоже работает, т.к. колено может выдвигаться вперёд.

    Args:
        landmarks: Словарь 33 точек MediaPipe.
        tolerance: Допустимое отклонение (в нормализованных координатах).

    Returns:
        Словарь {"left": bool, "right": bool} — True если колено за носком.
    """
    result = {}
    for side in ["left", "right"]:
        knee_x = landmarks[f"{side}_knee"]["x"]
        toe_x = landmarks[f"{side}_foot_index"]["x"]

        # Колено выходит за носок, если оно дальше на tolerance
        result[side] = abs(knee_x - toe_x) > tolerance

    return result


def calculate_symmetry(
    landmarks: Dict[str, Dict[str, float]],
    joint: str = "knee"
) -> float:
    """
    Вычисляет асимметрию между левой и правой стороной тела.

    Args:
        landmarks: Словарь 33 точек MediaPipe.
        joint: Тип сустава — "knee" или "hip".

    Returns:
        Абсолютная разница углов в градусах (0 = идеальная симметрия).
    """
    if joint == "knee":
        left = get_knee_angle(landmarks, "left")
        right = get_knee_angle(landmarks, "right")
    elif joint == "hip":
        left = get_hip_angle(landmarks, "left")
        right = get_hip_angle(landmarks, "right")
    else:
        raise ValueError(f"Неизвестный сустав: {joint}. Используйте 'knee' или 'hip'.")

    return abs(left - right)


def estimate_segment_length(
    point_a: Dict[str, float],
    point_b: Dict[str, float]
) -> float:
    """
    Оценивает длину сегмента тела (в нормализованных координатах).

    Используется для антропометрии: длина бедра, голени, руки.

    Args:
        point_a: Проксимальная точка сегмента.
        point_b: Дистальная точка сегмента.

    Returns:
        Длина сегмента (нормализованная).
    """
    return distance_3d(point_a, point_b)


def calculate_center_of_mass(landmarks: Dict[str, Dict[str, float]]) -> Dict[str, float]:
    """
    Упрощённый расчёт центра масс тела.

    Использует среднее положение ключевых точек:
    плечи, бёдра, колени, лодыжки — взвешенные по приблизительной массе сегментов.

    Args:
        landmarks: Словарь 33 точек MediaPipe.

    Returns:
        Приблизительный центр масс {x, y, z}.
    """
    # Весовые коэффициенты приблизительно отражают распределение массы
    weighted_points = [
        (landmarks["left_shoulder"], 0.1),
        (landmarks["right_shoulder"], 0.1),
        (landmarks["left_hip"], 0.2),
        (landmarks["right_hip"], 0.2),
        (landmarks["left_knee"], 0.1),
        (landmarks["right_knee"], 0.1),
        (landmarks["left_ankle"], 0.05),
        (landmarks["right_ankle"], 0.05),
        (midpoint(landmarks["left_shoulder"], landmarks["left_hip"]), 0.05),
        (midpoint(landmarks["right_shoulder"], landmarks["right_hip"]), 0.05),
    ]

    total_weight = sum(w for _, w in weighted_points)
    cx = sum(p["x"] * w for p, w in weighted_points) / total_weight
    cy = sum(p["y"] * w for p, w in weighted_points) / total_weight
    cz = sum(p.get("z", 0) * w for p, w in weighted_points) / total_weight

    return {"x": cx, "y": cy, "z": cz}


def is_balance_stable(
    landmarks: Dict[str, Dict[str, float]],
    tolerance: float = 0.15
) -> bool:
    """
    Проверяет, находится ли центр масс над опорой (стопами).

    Args:
        landmarks: Словарь 33 точек MediaPipe.
        tolerance: Допуск отклонения (нормализованные координаты).

    Returns:
        True если баланс стабильный.
    """
    com = calculate_center_of_mass(landmarks)
    mid_foot = midpoint(
        midpoint(landmarks["left_ankle"], landmarks["left_foot_index"]),
        midpoint(landmarks["right_ankle"], landmarks["right_foot_index"]),
    )

    horizontal_offset = abs(com["x"] - mid_foot["x"])
    return horizontal_offset <= tolerance


def get_bar_position_estimate(landmarks: Dict[str, Dict[str, float]]) -> Optional[Dict[str, float]]:
    """
    Оценка позиции штанги для становой тяги.

    Штанга приблизительно находится на уровне кистей рук.
    Используется среднее положение запястий.

    Args:
        landmarks: Словарь 33 точек MediaPipe.

    Returns:
        Приблизительная позиция штанги {x, y, z} или None.
    """
    left_wrist = landmarks.get("left_wrist")
    right_wrist = landmarks.get("right_wrist")

    if not left_wrist or not right_wrist:
        return None

    return midpoint(left_wrist, right_wrist)


def detect_heel_rise(
    landmarks: Dict[str, Dict[str, float]],
    standing_heel_drop: float = 0.01,
    threshold: float = 0.035,
) -> Dict[str, Any]:
    """
    Определяет отрыв пятки во время приседания.

    Принцип: в MediaPipe ось Y направлена вниз.
    Когда пятка на полу: foot_index.y ≈ heel.y (оба у основания кадра).
    Когда пятка отрывается: heel.y уменьшается (поднимается вверх),
    а foot_index остаётся внизу → разница (foot_index.y - heel.y) растёт.

    Args:
        landmarks: Словарь 33 точек MediaPipe.
        standing_heel_drop: Эталонное значение (foot_index.y - heel.y) из стойки
            при калибровке. Берётся из baseline_metrics["standing_heel_drop"].
        threshold: Минимальное превышение эталона для признания отрыва (0.035 ≈ 3.5%).

    Returns:
        Словарь:
            "left"       — bool, отрыв левой пятки
            "right"      — bool, отрыв правой пятки
            "left_lift"  — float, величина подъёма левой пятки
            "right_lift" — float, величина подъёма правой пятки
    """
    result: Dict[str, Any] = {"left": False, "right": False, "left_lift": 0.0, "right_lift": 0.0}

    for side in ("left", "right"):
        fi_key = f"{side}_foot_index"
        heel_key = f"{side}_heel"

        if fi_key not in landmarks or heel_key not in landmarks:
            continue

        # Расстояние от носка до пятки по вертикали (в нормализованных координатах)
        current_drop = landmarks[fi_key]["y"] - landmarks[heel_key]["y"]
        # Превышение над эталоном стойки = величина подъёма пятки
        lift = current_drop - standing_heel_drop

        result[f"{side}_lift"] = round(lift, 3)
        result[side] = lift > threshold

    return result
