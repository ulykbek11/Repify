"""
Тесты анализатора техники.

Проверяют корректность работы TechniqueAnalyzer
для приседаний и становой тяги с разными позами.
"""

import pytest
from unittest.mock import MagicMock

from app.services.technique_analyzer import TechniqueAnalyzer
from app.models.calibration import CalibrationProfile


# =============================================================================
# Фикстуры: профили калибровки
# =============================================================================

def _make_squat_profile() -> CalibrationProfile:
    """Создаёт мок-профиль калибровки для приседаний."""
    profile = MagicMock(spec=CalibrationProfile)
    profile.exercise_type = "squat"
    profile.baseline_metrics = {
        "natural_squat_depth": 90.0,
        "natural_torso_lean": 25.0,
        "natural_hip_angle": 80.0,
        "knee_valgus_tendency": False,
        "asymmetry_percentage": 3.0,
    }
    profile.safe_ranges = {
        "depth_min": 75.0,
        "depth_max": 105.0,
        "torso_lean_min": 15.0,
        "torso_lean_max": 35.0,
        "max_asymmetry": 10.0,
    }
    return profile


def _make_deadlift_profile() -> CalibrationProfile:
    """Создаёт мок-профиль калибровки для становой тяги."""
    profile = MagicMock(spec=CalibrationProfile)
    profile.exercise_type = "deadlift"
    profile.baseline_metrics = {
        "natural_start_knee_angle": 120.0,
        "natural_start_hip_angle": 80.0,
        "natural_back_angle": 170.0,
        "natural_hip_hinge_angle": 45.0,
    }
    profile.safe_ranges = {
        "back_angle_min": 155.0,
        "back_angle_max": 180.0,
        "hip_angle_min": 65.0,
        "hip_angle_max": 95.0,
        "max_torso_lean": 60.0,
    }
    return profile


# =============================================================================
# Тестовые данные
# =============================================================================

def _make_good_squat_frame() -> dict:
    """Кадр хорошего приседа: колени ~ 85°, корпус умеренно наклонён."""
    return {
        "nose": {"x": 0.52, "y": 0.2, "z": 0.0},
        "left_eye_inner": {"x": 0.5, "y": 0.19, "z": 0.0},
        "left_eye": {"x": 0.49, "y": 0.19, "z": 0.0},
        "left_eye_outer": {"x": 0.48, "y": 0.19, "z": 0.0},
        "right_eye_inner": {"x": 0.54, "y": 0.19, "z": 0.0},
        "right_eye": {"x": 0.55, "y": 0.19, "z": 0.0},
        "right_eye_outer": {"x": 0.56, "y": 0.19, "z": 0.0},
        "left_ear": {"x": 0.47, "y": 0.2, "z": 0.0},
        "right_ear": {"x": 0.57, "y": 0.2, "z": 0.0},
        "mouth_left": {"x": 0.5, "y": 0.22, "z": 0.0},
        "mouth_right": {"x": 0.54, "y": 0.22, "z": 0.0},
        "left_shoulder": {"x": 0.42, "y": 0.35, "z": 0.0},
        "right_shoulder": {"x": 0.62, "y": 0.35, "z": 0.0},
        "left_elbow": {"x": 0.37, "y": 0.5, "z": 0.0},
        "right_elbow": {"x": 0.67, "y": 0.5, "z": 0.0},
        "left_wrist": {"x": 0.37, "y": 0.6, "z": 0.0},
        "right_wrist": {"x": 0.67, "y": 0.6, "z": 0.0},
        "left_pinky": {"x": 0.36, "y": 0.62, "z": 0.0},
        "right_pinky": {"x": 0.68, "y": 0.62, "z": 0.0},
        "left_index": {"x": 0.37, "y": 0.62, "z": 0.0},
        "right_index": {"x": 0.67, "y": 0.62, "z": 0.0},
        "left_thumb": {"x": 0.38, "y": 0.61, "z": 0.0},
        "right_thumb": {"x": 0.66, "y": 0.61, "z": 0.0},
        "left_hip": {"x": 0.44, "y": 0.6, "z": 0.0},
        "right_hip": {"x": 0.56, "y": 0.6, "z": 0.0},
        "left_knee": {"x": 0.43, "y": 0.75, "z": 0.0},
        "right_knee": {"x": 0.57, "y": 0.75, "z": 0.0},
        "left_ankle": {"x": 0.45, "y": 0.9, "z": 0.0},
        "right_ankle": {"x": 0.55, "y": 0.9, "z": 0.0},
        "left_heel": {"x": 0.44, "y": 0.92, "z": 0.0},
        "right_heel": {"x": 0.56, "y": 0.92, "z": 0.0},
        "left_foot_index": {"x": 0.45, "y": 0.95, "z": 0.0},
        "right_foot_index": {"x": 0.55, "y": 0.95, "z": 0.0},
    }


def _make_standing_frame() -> dict:
    """Кадр стоячего положения."""
    return {
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
# Тесты приседания
# =============================================================================

class TestSquatAnalysis:
    """Тесты анализа техники приседаний."""

    def test_good_squat_high_score(self) -> None:
        """Хороший присед → высокая оценка."""
        profile = _make_squat_profile()
        landmarks = _make_good_squat_frame()

        result = TechniqueAnalyzer._analyze_squat(landmarks, profile)

        assert result["technique_score"] >= 0.5
        assert isinstance(result["errors"], list)
        assert isinstance(result["feedback"], str)
        assert "knee_angle" in result["metrics"]

    def test_standing_frame_no_errors(self) -> None:
        """Стоячее положение → без ошибок глубины."""
        profile = _make_squat_profile()
        landmarks = _make_standing_frame()

        result = TechniqueAnalyzer._analyze_squat(landmarks, profile)

        # В стоячем положении не должно быть ошибки excessive_depth
        depth_errors = [e for e in result["errors"] if e["error_type"] == "excessive_depth"]
        assert len(depth_errors) == 0

    def test_analysis_returns_metrics(self) -> None:
        """Анализ возвращает метрики."""
        profile = _make_squat_profile()
        landmarks = _make_good_squat_frame()

        result = TechniqueAnalyzer._analyze_squat(landmarks, profile)

        metrics = result["metrics"]
        assert metrics["knee_angle"] is not None
        assert metrics["torso_angle"] is not None
        assert metrics["symmetry"] is not None

    def test_valgus_detected_with_narrow_knees(self) -> None:
        """Вальгус обнаруживается при узких коленях."""
        profile = _make_squat_profile()
        landmarks = _make_good_squat_frame()

        # Сужаем колени, чтобы вызвать вальгус
        landmarks["left_knee"] = {"x": 0.49, "y": 0.75, "z": 0.0}
        landmarks["right_knee"] = {"x": 0.51, "y": 0.75, "z": 0.0}

        result = TechniqueAnalyzer._analyze_squat(landmarks, profile)

        valgus_errors = [e for e in result["errors"] if e["error_type"] == "knee_valgus"]
        assert len(valgus_errors) > 0


# =============================================================================
# Тесты становой тяги
# =============================================================================

class TestDeadliftAnalysis:
    """Тесты анализа техники становой тяги."""

    def test_standing_deadlift_returns_result(self) -> None:
        """Стоячее положение → результат с метриками."""
        profile = _make_deadlift_profile()
        landmarks = _make_standing_frame()

        result = TechniqueAnalyzer._analyze_deadlift(landmarks, profile)

        assert "technique_score" in result
        assert 0.0 <= result["technique_score"] <= 1.0
        assert isinstance(result["errors"], list)
        assert "back_angle" in result["metrics"]

    def test_deadlift_feedback_present(self) -> None:
        """Есть фидбэк для пользователя."""
        profile = _make_deadlift_profile()
        landmarks = _make_standing_frame()

        result = TechniqueAnalyzer._analyze_deadlift(landmarks, profile)

        assert len(result["feedback"]) > 0

    def test_deadlift_score_range(self) -> None:
        """Оценка в диапазоне 0-1."""
        profile = _make_deadlift_profile()
        landmarks = _make_standing_frame()

        result = TechniqueAnalyzer._analyze_deadlift(landmarks, profile)

        assert 0.0 <= result["technique_score"] <= 1.0
