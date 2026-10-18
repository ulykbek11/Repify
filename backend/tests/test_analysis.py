import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import gemini_analyzer
from app.services.local_analyzer import analyze_local, segment_reps
from app.services.pose_features import (
    angle_at, build_frames, landmarks_to_named, torso_lean, LANDMARK_NAMES,
)
from app.services.sample_data import generate_pose_sequence

client = TestClient(app)


def named_sequence(exercise="squat", depths=None):
    return [landmarks_to_named(f["landmarks"]) for f in generate_pose_sequence(exercise, depths)]


def test_angle_at_right_angle_and_straight_line():
    assert angle_at({"x": 0, "y": 1}, {"x": 0, "y": 0}, {"x": 1, "y": 0}) == pytest.approx(90)
    assert angle_at({"x": -1, "y": 0}, {"x": 0, "y": 0}, {"x": 1, "y": 0}) == pytest.approx(180)
    assert angle_at({"x": 0, "y": 0}, {"x": 0, "y": 0}, {"x": 1, "y": 0}) == 0.0


def test_torso_lean_upright_and_tilted():
    assert torso_lean({"x": 0.5, "y": 0.2}, {"x": 0.5, "y": 0.5}) == pytest.approx(0)
    assert torso_lean({"x": 0.8, "y": 0.2}, {"x": 0.5, "y": 0.5}) == pytest.approx(45)


def test_sample_has_33_landmarks_and_sane_angles():
    frames = build_frames(named_sequence())
    assert all(len(f["landmarks"]) == len(LANDMARK_NAMES) for f in generate_pose_sequence())
    knees = [f["angles"]["knee_angle"] for f in frames]
    assert max(knees) > 165 and min(knees) < 95


def test_segment_reps_counts_cycles_and_ignores_partial_dips():
    sig = [170, 120, 90, 120, 170, 140, 170, 100, 170]
    reps = segment_reps(sig, enter=130)
    assert len(reps) == 2  # the dip to 140 never goes below the threshold
    assert reps[0]["bottom"] == 2


def test_local_analyzer_counts_three_reps_and_flags_shallow_one():
    result = analyze_local("squat", build_frames(named_sequence()), "en")
    assert result["total_reps"] == 3
    assert result["engine"] == "local"
    shallow = [d for d in result["rep_details"] if "depth" in d["issues"]]
    assert [d["index"] for d in shallow] == [2]
    assert any("shallow" in e for e in result["errors"])
    assert 0 < result["score"] < 100


def test_local_analyzer_rewards_good_squats():
    result = analyze_local("squat", build_frames(named_sequence(depths=[90, 92, 91])), "en")
    assert result["total_reps"] == 3
    assert not any("shallow" in e for e in result["errors"])
    assert result["score"] >= 85
    assert result["strengths"]


def test_local_analyzer_language_switch():
    ru = analyze_local("squat", build_frames(named_sequence()), "ru")
    assert any("глубин" in e.lower() for e in ru["errors"])
    unknown = analyze_local("squat", build_frames(named_sequence()), "de")
    assert any("shallow" in e for e in unknown["errors"])  # falls back to English


def test_local_analyzer_deadlift():
    result = analyze_local("deadlift", build_frames(named_sequence("deadlift")), "en")
    assert result["total_reps"] == 3


def test_local_analyzer_handles_no_person_and_no_motion():
    assert analyze_local("squat", [], "en")["total_reps"] == 0
    standing = build_frames(named_sequence(depths=[171, 171, 171]))
    assert analyze_local("squat", standing, "en")["total_reps"] == 0


def test_health_reports_engine():
    body = client.get("/health").json()
    assert body["status"] == "ok" and body["engine"] in ("local", "gemini")


def test_sample_analysis_endpoint():
    body = client.get("/api/sample-analysis?exercise=squat&language=en").json()
    assert body["total_reps"] == 3 and body["synthetic"] is True
    assert body["pose_preview"]["angles"]["knee_angle"] < 95
    assert client.get("/api/sample-analysis?exercise=bench").status_code == 422


def test_analyze_endpoint_roundtrip_and_validation():
    seq = generate_pose_sequence("squat")
    ok = client.post("/api/analyze", json={"exercise": "squats", "pose_sequence": seq, "language": "ru"})
    assert ok.status_code == 200 and ok.json()["total_reps"] == 3
    too_short = client.post("/api/analyze", json={"exercise": "squat", "pose_sequence": seq[:2]})
    assert too_short.status_code == 400
    bad_height = client.post("/api/analyze", json={"pose_sequence": seq, "user_height_cm": 5})
    assert bad_height.status_code == 422


def test_gemini_failure_falls_back_to_local(monkeypatch):
    monkeypatch.setattr(gemini_analyzer.settings, "gemini_api_key", "fake")

    def boom(*a, **k):
        raise gemini_analyzer.GeminiError("quota")

    monkeypatch.setattr(gemini_analyzer, "analyze_with_gemini", boom)
    body = client.get("/api/sample-analysis").json()
    assert body["engine"] == "local" and body["total_reps"] == 3


def test_gemini_response_parsing():
    parsed = gemini_analyzer.parse_response('```json\n{"total_reps": 4, "score": 80}\n```')
    assert parsed["total_reps"] == 4 and parsed["errors"] == []
    with pytest.raises(gemini_analyzer.GeminiError):
        gemini_analyzer.parse_response("not json")
