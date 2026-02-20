"""
Тесты математических утилит (pose_math.py).

Проверяют точность вычислений углов, расстояний,
наклона корпуса и детекции вальгуса.
"""

import math
import pytest

from app.utils.pose_math import (
    calculate_angle,
    distance_3d,
    midpoint,
    calculate_torso_lean,
    calculate_back_angle,
    get_knee_angle,
    get_hip_angle,
    get_average_knee_angle,
    check_knee_valgus,
    check_knees_over_toes,
    calculate_symmetry,
    is_balance_stable,
    calculate_center_of_mass,
)


# =============================================================================
# Тестовые данные: стандартная поза стоя
# =============================================================================

STANDING_LANDMARKS = {
    "nose": {"x": 0.5, "y": 0.1, "z": 0.0},
    "left_eye_inner": {"x": 0.48, "y": 0.09, "z": 0.0},
    "left_eye": {"x": 0.47, "y": 0.09, "z": 0.0},
    "left_eye_outer": {"x": 0.46, "y": 0.09, "z": 0.0},
    "right_eye_inner": {"x": 0.52, "y": 0.09, "z": 0.0},
    "right_eye": {"x": 0.53, "y": 0.09, "z": 0.0},
    "right_eye_outer": {"x": 0.54, "y": 0.09, "z": 0.0},
    "left_ear": {"x": 0.45, "y": 0.1, "z": 0.0},
    "right_ear": {"x": 0.55, "y": 0.1, "z": 0.0},
    "mouth_left": {"x": 0.48, "y": 0.12, "z": 0.0},
    "mouth_right": {"x": 0.52, "y": 0.12, "z": 0.0},
    "left_shoulder": {"x": 0.4, "y": 0.25, "z": 0.0},
    "right_shoulder": {"x": 0.6, "y": 0.25, "z": 0.0},
    "left_elbow": {"x": 0.35, "y": 0.4, "z": 0.0},
    "right_elbow": {"x": 0.65, "y": 0.4, "z": 0.0},
    "left_wrist": {"x": 0.35, "y": 0.55, "z": 0.0},
    "right_wrist": {"x": 0.65, "y": 0.55, "z": 0.0},
    "left_pinky": {"x": 0.34, "y": 0.57, "z": 0.0},
    "right_pinky": {"x": 0.66, "y": 0.57, "z": 0.0},
    "left_index": {"x": 0.35, "y": 0.57, "z": 0.0},
    "right_index": {"x": 0.65, "y": 0.57, "z": 0.0},
    "left_thumb": {"x": 0.36, "y": 0.56, "z": 0.0},
    "right_thumb": {"x": 0.64, "y": 0.56, "z": 0.0},
    "left_hip": {"x": 0.45, "y": 0.5, "z": 0.0},
    "right_hip": {"x": 0.55, "y": 0.5, "z": 0.0},
    "left_knee": {"x": 0.45, "y": 0.7, "z": 0.0},
    "right_knee": {"x": 0.55, "y": 0.7, "z": 0.0},
    "left_ankle": {"x": 0.45, "y": 0.9, "z": 0.0},
    "right_ankle": {"x": 0.55, "y": 0.9, "z": 0.0},
    "left_heel": {"x": 0.44, "y": 0.92, "z": 0.0},
    "right_heel": {"x": 0.56, "y": 0.92, "z": 0.0},
    "left_foot_index": {"x": 0.45, "y": 0.95, "z": 0.0},
    "right_foot_index": {"x": 0.55, "y": 0.95, "z": 0.0},
}


# =============================================================================
# Тесты: calculate_angle
# =============================================================================

class TestCalculateAngle:
    """Тесты вычисления угла между тремя точками."""

    def test_right_angle(self) -> None:
        """Прямой угол 90°."""
        a = {"x": 0.0, "y": 0.0, "z": 0.0}
        b = {"x": 0.0, "y": 1.0, "z": 0.0}
        c = {"x": 1.0, "y": 1.0, "z": 0.0}

        angle = calculate_angle(a, b, c)
        assert abs(angle - 90.0) < 0.01, f"Ожидалось 90°, получено {angle}°"

    def test_straight_angle(self) -> None:
        """Развёрнутый угол 180°."""
        a = {"x": 0.0, "y": 0.0, "z": 0.0}
        b = {"x": 1.0, "y": 0.0, "z": 0.0}
        c = {"x": 2.0, "y": 0.0, "z": 0.0}

        angle = calculate_angle(a, b, c)
        assert abs(angle - 180.0) < 0.01, f"Ожидалось 180°, получено {angle}°"

    def test_acute_angle(self) -> None:
        """Острый угол 45°."""
        a = {"x": 1.0, "y": 0.0, "z": 0.0}
        b = {"x": 0.0, "y": 0.0, "z": 0.0}
        c = {"x": 1.0, "y": 1.0, "z": 0.0}

        angle = calculate_angle(a, b, c)
        assert abs(angle - 45.0) < 0.01, f"Ожидалось 45°, получено {angle}°"

    def test_coincident_points_raises(self) -> None:
        """Совпадающие точки → ValueError."""
        a = {"x": 0.0, "y": 0.0, "z": 0.0}
        b = {"x": 0.0, "y": 0.0, "z": 0.0}
        c = {"x": 1.0, "y": 0.0, "z": 0.0}

        with pytest.raises(ValueError):
            calculate_angle(a, b, c)

    def test_3d_angle(self) -> None:
        """Угол в 3D пространстве."""
        a = {"x": 1.0, "y": 0.0, "z": 0.0}
        b = {"x": 0.0, "y": 0.0, "z": 0.0}
        c = {"x": 0.0, "y": 1.0, "z": 0.0}

        angle = calculate_angle(a, b, c)
        assert abs(angle - 90.0) < 0.01

    def test_missing_z_defaults_to_zero(self) -> None:
        """Отсутствие z координаты → используется 0."""
        a = {"x": 0.0, "y": 0.0}
        b = {"x": 0.0, "y": 1.0}
        c = {"x": 1.0, "y": 1.0}

        angle = calculate_angle(a, b, c)
        assert abs(angle - 90.0) < 0.01


# =============================================================================
# Тесты: distance_3d
# =============================================================================

class TestDistance3D:
    """Тесты евклидова расстояния."""

    def test_unit_distance(self) -> None:
        """Расстояние = 1 по оси X."""
        a = {"x": 0.0, "y": 0.0, "z": 0.0}
        b = {"x": 1.0, "y": 0.0, "z": 0.0}

        assert abs(distance_3d(a, b) - 1.0) < 0.01

    def test_diagonal_distance(self) -> None:
        """Диагональ единичного куба = sqrt(3)."""
        a = {"x": 0.0, "y": 0.0, "z": 0.0}
        b = {"x": 1.0, "y": 1.0, "z": 1.0}

        expected = math.sqrt(3)
        assert abs(distance_3d(a, b) - expected) < 0.01

    def test_same_point(self) -> None:
        """Расстояние до самой себя = 0."""
        a = {"x": 0.5, "y": 0.5, "z": 0.5}
        assert abs(distance_3d(a, a)) < 0.001


# =============================================================================
# Тесты: midpoint
# =============================================================================

class TestMidpoint:
    """Тесты средней точки."""

    def test_midpoint_simple(self) -> None:
        """Средняя точка между (0,0) и (2,2)."""
        a = {"x": 0.0, "y": 0.0, "z": 0.0}
        b = {"x": 2.0, "y": 2.0, "z": 0.0}

        mid = midpoint(a, b)
        assert abs(mid["x"] - 1.0) < 0.001
        assert abs(mid["y"] - 1.0) < 0.001

    def test_midpoint_same_point(self) -> None:
        """Средняя точка совпадающих точек = та же точка."""
        a = {"x": 0.5, "y": 0.5, "z": 0.0}
        mid = midpoint(a, a)
        assert abs(mid["x"] - 0.5) < 0.001


# =============================================================================
# Тесты: телесные метрики
# =============================================================================

class TestBodyMetrics:
    """Тесты метрик тела."""

    def test_torso_lean_standing(self) -> None:
        """В стоячем положении наклон корпуса ~ 0°."""
        lean = calculate_torso_lean(STANDING_LANDMARKS)
        assert lean < 10.0, f"Стоя наклон должен быть < 10°, получено {lean}°"

    def test_knee_angle_standing(self) -> None:
        """В стоячем положении колено ~ 180° (выпрямлено)."""
        angle = get_knee_angle(STANDING_LANDMARKS, "left")
        assert angle > 150.0, f"Стоя колено должно быть > 150°, получено {angle}°"

    def test_hip_angle_standing(self) -> None:
        """В стоячем положении таз ~ 180° (выпрямлен)."""
        angle = get_hip_angle(STANDING_LANDMARKS, "left")
        assert angle > 150.0, f"Стоя таз должен быть > 150°, получено {angle}°"

    def test_average_knee_angle(self) -> None:
        """Средний угол коленей — среднее левого и правого."""
        avg = get_average_knee_angle(STANDING_LANDMARKS)
        left = get_knee_angle(STANDING_LANDMARKS, "left")
        right = get_knee_angle(STANDING_LANDMARKS, "right")

        expected = (left + right) / 2
        assert abs(avg - expected) < 0.01

    def test_no_valgus_standing(self) -> None:
        """В стоячем положении вальгуса нет."""
        # Колени и лодыжки на одной ширине
        assert not check_knee_valgus(STANDING_LANDMARKS)

    def test_valgus_detected(self) -> None:
        """Вальгус обнаруживается, когда колени ближе друг к другу."""
        valgus_landmarks = {**STANDING_LANDMARKS}
        # Сдвигаем колени внутрь
        valgus_landmarks["left_knee"] = {"x": 0.49, "y": 0.7, "z": 0.0}
        valgus_landmarks["right_knee"] = {"x": 0.51, "y": 0.7, "z": 0.0}

        assert check_knee_valgus(valgus_landmarks)

    def test_symmetry_standing(self) -> None:
        """Симметричная поза → асимметрия ~ 0°."""
        sym = calculate_symmetry(STANDING_LANDMARKS, "knee")
        assert sym < 5.0, f"Симметричная поза: асимметрия {sym}° > 5°"

    def test_balance_standing(self) -> None:
        """В стоячем положении баланс стабильный."""
        assert is_balance_stable(STANDING_LANDMARKS)


# =============================================================================
# Тесты: knees over toes
# =============================================================================

class TestKneesOverToes:
    """Тесты выхода коленей за носки."""

    def test_knees_not_over_toes_standing(self) -> None:
        """Стоя колени не выходят за носки."""
        result = check_knees_over_toes(STANDING_LANDMARKS)
        assert not result["left"]
        assert not result["right"]


# =============================================================================
# Тесты: back angle
# =============================================================================

class TestBackAngle:
    """Тесты угла спины."""

    def test_back_angle_standing(self) -> None:
        """Стоя спина прямая — угол близок к 180°."""
        angle = calculate_back_angle(STANDING_LANDMARKS)
        assert angle > 150.0, f"Стоя спина должна быть > 150°, получено {angle}°"
