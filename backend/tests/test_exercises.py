"""Rule-based analysis of every supported exercise, using synthetic landmark sequences."""

import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import exercises as registry
from app.services.exercise_messages import EX_MESSAGES
from app.services.local_analyzer import analyze_local, deepest_frame, has_message, segment_reps
from app.services.pose_features import build_frames, landmarks_to_named
from app.services.sample_data import (
    DEFAULT_DEPTHS, GOOD_DEPTHS, SAMPLE_EXERCISES, generate_pose_sequence,
)

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[2]

ALL = list(registry.SPECS)
REP_EXERCISES = [e for e in ALL if registry.SPECS[e].mode != "hold"]


def analyze(exercise, depths=None, faults=None, rest=None, language="en", **kw):
    seq = generate_pose_sequence(exercise, depths, faults, rest, **kw)
    frames = build_frames(
        [landmarks_to_named(f["landmarks"]) for f in seq], timestamps=[f["timestamp"] for f in seq]
    )
    return analyze_local(exercise, frames, language), frames


def issues_of(result):
    return [d["issues"] for d in result["rep_details"]]


def test_registry_has_fourteen_exercises_and_sample_for_each():
    assert len(ALL) == 14
    assert set(ALL) == set(SAMPLE_EXERCISES)
    for spec in registry.SPECS.values():
        assert spec.camera == "side" and spec.camera_note
        assert spec.mode in ("dip", "peak", "hold")


@pytest.mark.parametrize("exercise", [e for e in ALL if e not in ("squat", "deadlift")])
@pytest.mark.parametrize("language", ["en", "ru"])
def test_every_check_has_error_and_tip_text(exercise, language):
    spec = registry.SPECS[exercise]
    texts = EX_MESSAGES[exercise][language]
    keys = ["sag", "pike", "shoulders", "short"] if spec.mode == "hold" else [c.key for c in spec.checks]
    for key in keys:
        assert f"err_{key}" in texts and f"tip_{key}" in texts, (exercise, key)
    assert set(EX_MESSAGES[exercise]["en"]) == set(EX_MESSAGES[exercise]["ru"])  # EN and RU stay in sync


@pytest.mark.parametrize("exercise", ["squat", "deadlift"])
def test_legacy_check_texts_exist(exercise):
    for check in registry.SPECS[exercise].checks:
        for language in ("en", "ru"):
            assert has_message(language, f"err_{check.key}", exercise)
            assert has_message(language, f"tip_{check.key}", exercise)


@pytest.mark.parametrize("exercise", REP_EXERCISES)
def test_good_form_counts_three_reps_without_errors(exercise):
    result, _ = analyze(exercise, GOOD_DEPTHS[exercise])
    assert result["total_reps"] == 3, result
    assert result["errors"] == []
    assert result["score"] >= 95
    assert result["strengths"]
    assert result["exercise"] == exercise and result["signal"] == registry.SPECS[exercise].signal


# (exercise, fault, depths, expected issue)
FAULTS = [
    ("bench_press", "forearm", [50, 50, 50], "forearm"),  # the tilted forearm also lengthens the elbow angle
    ("overhead_press", "lean", None, "lean"),
    ("overhead_press", "stack", None, "stack"),
    ("push_up", "sag", None, "sag"),
    ("push_up", "pike", None, "pike"),
    ("pull_up", "swing", None, "swing"),
    ("dip", "lean", None, "lean"),
    ("row", "upright", None, "upright"),
    ("row", "momentum", None, "momentum"),
    ("lunge", "lean", None, "lean"),
    ("lunge", "knees", None, "knees"),
    ("romanian_deadlift", "knees", None, "knees"),
    ("romanian_deadlift", "bar", None, "bar"),
    ("bicep_curl", "elbows", None, "elbows"),
    ("bicep_curl", "swing", None, "swing"),
    ("hip_thrust", "shins", None, "shins"),
    ("lat_pulldown", "lean", None, "lean"),
    ("lat_pulldown", "momentum", None, "momentum"),
]


@pytest.mark.parametrize("exercise,fault,depths,expected", FAULTS)
def test_form_fault_is_flagged_on_every_rep(exercise, fault, depths, expected):
    result, _ = analyze(exercise, depths or GOOD_DEPTHS[exercise], faults={fault})
    assert result["total_reps"] == 3
    assert all(expected in issues for issues in issues_of(result)), result["rep_details"]
    assert result["errors"] and result["score"] < 95
    assert result["coach_tip"]


@pytest.mark.parametrize("exercise", [e for e in REP_EXERCISES if e not in ("squat", "deadlift", "lunge")])
def test_default_sample_has_one_weak_rep(exercise):
    result, _ = analyze(exercise)
    assert result["total_reps"] == 3
    assert issues_of(result)[:2] == [[], []]
    assert issues_of(result)[2]  # the third default rep is deliberately weak
    assert 0 < result["score"] < 100


@pytest.mark.parametrize("exercise,rest,expected", [
    ("bench_press", 152, "lockout"), ("push_up", 152, "lockout"), ("dip", 152, "lockout"),
    ("bicep_curl", 152, "extend"), ("pull_up", 152, "hang"), ("lat_pulldown", 152, "stretch"),
])
def test_incomplete_extension_at_the_start_position(exercise, rest, expected):
    result, _ = analyze(exercise, GOOD_DEPTHS[exercise], rest=rest)
    assert result["total_reps"] == 3
    assert all(expected in issues for issues in issues_of(result))


def test_range_checks_on_shallow_reps():
    assert "rom" in issues_of(analyze("bench_press", [100, 100, 100])[0])[0]
    assert "chin" in issues_of(analyze("pull_up", [105, 105, 105])[0])[0]
    assert "lockout" in issues_of(analyze("overhead_press", [155, 155, 155])[0])[0]
    assert "lockout" in issues_of(analyze("hip_thrust", [164, 164, 164])[0])[0]
    assert "depth" in issues_of(analyze("lunge", [118, 118, 118])[0])[0]


def test_segment_reps_supports_dip_and_peak_signals():
    dip = [170, 120, 80, 120, 170, 120, 85, 120, 170]
    assert [r["bottom"] for r in segment_reps(dip, enter=110, rest=150)] == [2, 6]
    peak = [60, 120, 170, 120, 60, 120, 172, 120, 60]
    reps = segment_reps(peak, enter=145, rest=115, mode="peak")
    assert [r["bottom"] for r in reps] == [2, 6]  # bottom is the extreme, here the highest point
    assert segment_reps([60, 100, 130, 100, 60], enter=145, rest=115, mode="peak") == []


@pytest.mark.parametrize("exercise", REP_EXERCISES)
def test_no_motion_means_no_reps(exercise):
    result, _ = analyze(exercise, [GOOD_DEPTHS[exercise][0]] * 3)
    assert result["total_reps"] == 3
    assert analyze_local(exercise, [], "en")["total_reps"] == 0
    seq = generate_pose_sequence(exercise, GOOD_DEPTHS[exercise])[:6]  # only the start position
    frames = build_frames([landmarks_to_named(f["landmarks"]) for f in seq])
    assert analyze_local(exercise, frames, "en")["total_reps"] == 0


@pytest.mark.parametrize("exercise", ALL)
def test_russian_feedback_for_every_exercise(exercise):
    result, _ = analyze(exercise, language="ru")
    assert result["errors"] or result["strengths"]
    for text in result["errors"] + result["strengths"] + [result["coach_tip"]]:
        assert re.search("[а-яА-Я]", text), text


@pytest.mark.parametrize("exercise", ALL)
def test_pose_preview_frame_exists(exercise):
    _, frames = analyze(exercise)
    frame = deepest_frame(frames, exercise)
    assert frame and frame["joints"]


def test_preview_frame_is_the_extreme_of_the_movement():
    _, frames = analyze("bench_press", [80, 82, 84])
    assert deepest_frame(frames, "bench_press")["angles"]["elbow_angle"] < 90
    _, frames = analyze("overhead_press", [172, 172, 172])
    assert deepest_frame(frames, "overhead_press")["angles"]["elbow_angle"] > 165


# --- plank ---------------------------------------------------------------

def test_plank_good_hold_is_timed_from_timestamps():
    result, _ = analyze("plank", faults=(), hold_seconds=14)
    assert result["mode"] == "hold" and result["total_reps"] == 0
    assert result["hold_seconds"] == pytest.approx(14, abs=0.5)  # the 6 standing frames are not counted
    assert result["errors"] == [] and result["score"] == 100
    assert [i["score"] for i in result["intervals"]] == [100, 100, 100]


@pytest.mark.parametrize("fault,expected", [("sag", "Hips sagged"), ("pike", "piked"), ("shoulders", "Shoulders were not stacked")])
def test_plank_form_faults(fault, expected):
    result, _ = analyze("plank", faults={fault})
    assert any(expected in e for e in result["errors"]), result["errors"]
    assert result["score"] < 50


def test_plank_form_that_breaks_late_scores_in_between():
    result, _ = analyze("plank")  # the demo plank sags in its last third
    assert 0 < result["score"] < 100
    scores = [i["score"] for i in result["intervals"]]
    assert scores[0] == 100 and scores[-1] < 50


def test_short_plank_and_missing_plank():
    short, _ = analyze("plank", faults=(), hold_seconds=6)
    assert any("only" in e for e in short["errors"]) and short["hold_seconds"] < 10
    standing = build_frames([landmarks_to_named(f["landmarks"]) for f in generate_pose_sequence("squat")])
    none = analyze_local("plank", standing, "en")
    assert none["mode"] == "hold" and none["hold_seconds"] == 0 and "not detected" in none["errors"][0]


# --- names and API -------------------------------------------------------

@pytest.mark.parametrize("raw,expected", [
    ("squats", "squat"), ("Squat", "squat"), ("deadlifts", "deadlift"), ("Romanian deadlift", "romanian_deadlift"),
    ("RDL", "romanian_deadlift"), ("bench press", "bench_press"), ("Жим лёжа", "bench_press"),
    ("overhead press", "overhead_press"), ("push-ups", "push_up"), ("pull ups", "pull_up"),
    ("подтягивания", "pull_up"), ("barbell row", "row"), ("bent-over row", "row"), ("lunges", "lunge"),
    ("hammer curl", "bicep_curl"), ("Plank", "plank"), ("hip thrust", "hip_thrust"), ("dips", "dip"),
    ("lat pulldown", "lat_pulldown"), ("планка", "plank"), ("становая тяга", "deadlift"),
    ("lat_pulldown", "lat_pulldown"), ("dip", "dip"),
])
def test_exercise_name_aliases(raw, expected):
    assert registry.normalize_exercise(raw) == expected


def test_unknown_and_ambiguous_names():
    assert registry.normalize_exercise("juggling") is None
    assert registry.normalize_exercise("narrow stance") is None  # "row" must start a word
    assert client.post("/api/analyze", json={"exercise": "juggling", "pose_sequence": []}).status_code == 422


def test_exercises_endpoint_lists_camera_and_checks():
    body = client.get("/api/exercises").json()
    assert [e["id"] for e in body] == ALL
    bench = next(e for e in body if e["id"] == "bench_press")
    assert bench["camera"] == "side" and bench["signal"] == "elbow_angle" and "forearm" in bench["checks"]
    assert client.get("/health").json()["exercises"] == ALL


@pytest.mark.parametrize("exercise", ALL)
def test_sample_analysis_endpoint_for_every_exercise(exercise):
    body = client.get(f"/api/sample-analysis?exercise={exercise}&language=en").json()
    assert body["synthetic"] is True and body["exercise"] == exercise
    assert body["pose_preview"]["joints"] and body["engine"] == "local"
    if exercise == "plank":
        assert body["hold_seconds"] > 10
    else:
        assert body["total_reps"] == 3


def test_analyze_endpoint_keeps_timestamps_for_the_plank():
    seq = generate_pose_sequence("plank", faults=(), hold_seconds=12)
    body = client.post("/api/analyze", json={"exercise": "Plank", "pose_sequence": seq}).json()
    assert body["mode"] == "hold" and body["hold_seconds"] == pytest.approx(12, abs=0.5)


def test_analyze_endpoint_for_a_new_exercise_in_russian():
    seq = generate_pose_sequence("pull_up")
    body = client.post("/api/analyze", json={"exercise": "подтягивания", "pose_sequence": seq, "language": "ru"}).json()
    assert body["total_reps"] == 3 and body["exercise"] == "pull_up"
    assert any("подбородок" in e.lower() for e in body["errors"])


# --- docs and app stay in sync ---------------------------------------------

def test_readme_lists_every_exercise():
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    for exercise in ALL:
        assert f"`{exercise}`" in readme, exercise


def test_app_has_texts_for_every_exercise():
    strings = (ROOT / "frontend/src/i18n/strings.js").read_text(encoding="utf-8")
    for exercise in ALL:
        for key in (f"home.{exercise}", f"home.{exercise}Desc", f"exercise.camera.{exercise}", f"exercise.checks.{exercise}"):
            assert strings.count(f"'{key}'") == 2, key  # once in English, once in Russian


def test_bundled_samples_match_the_backend():
    import json
    bundled = json.loads((ROOT / "frontend/src/data/samples.json").read_text(encoding="utf-8"))
    for exercise in ALL:
        for language in ("en", "ru"):
            live = client.get(f"/api/sample-analysis?exercise={exercise}&language={language}").json()
            assert bundled[exercise][language] == live, f"run backend/scripts/export_samples.py ({exercise}/{language})"


def test_gemini_prompt_describes_the_exercise():
    from app.services.gemini_analyzer import build_prompt

    push_up = build_prompt("push_up", "side_profile", [], None, "en")
    assert "elbow angle" in push_up and "sag" in push_up and "below 115" in push_up
    ohp = build_prompt("overhead_press", "side_profile", [], None, "ru")
    assert "above 145" in ohp and "Russian" in ohp
    plank = build_prompt("plank", "side_profile", [], None, "en")
    assert "timed hold" in plank and "t_ms" in plank


def test_cors_regex_allows_vercel_previews_only(monkeypatch):
    import importlib
    import app.config as config
    import app.main as main

    monkeypatch.setenv("CORS_ORIGIN_REGEX", r"^https://repify(-[a-z0-9-]+)?-ulykbeks-projects(-[a-z0-9]+)?\.vercel\.app$")
    monkeypatch.setenv("CORS_ORIGINS", "https://repify.vercel.app")
    importlib.reload(config)
    importlib.reload(main)
    try:
        c = TestClient(main.app)
        ok = c.get("/health", headers={"Origin": "https://repify-git-fix-repify-working-ulykbeks-projects-8101f40c.vercel.app"})
        assert ok.headers.get("access-control-allow-origin") == "https://repify-git-fix-repify-working-ulykbeks-projects-8101f40c.vercel.app"
        assert c.get("/health", headers={"Origin": "https://repify.vercel.app"}).headers.get("access-control-allow-origin")
        assert not c.get("/health", headers={"Origin": "https://evil.vercel.app"}).headers.get("access-control-allow-origin")
    finally:
        monkeypatch.undo()
        importlib.reload(config)
        importlib.reload(main)
