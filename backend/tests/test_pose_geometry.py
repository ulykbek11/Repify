"""Unit tests for the small geometry helpers in ``pose_features``.

These pin down the sign conventions (image y points down) and the edge cases
(missing joints, vertical lines, empty input) that the exercise checks rely on.
"""

import pytest

from app.services.pose_features import (
    ANALYSIS_JOINTS,
    build_frames,
    hip_offset_from_line,
    visible_side,
)


def _pt(x, y, vis=0.9):
    return {"x": x, "y": y, "visibility": vis}


# --- hip_offset_from_line ---------------------------------------------------

def test_hip_on_the_line_has_zero_offset():
    joints = {"shoulder": _pt(0.2, 0.4), "hip": _pt(0.5, 0.5), "ankle": _pt(0.8, 0.6)}
    assert hip_offset_from_line(joints) == pytest.approx(0.0, abs=1e-9)


def test_sagging_hip_is_positive_and_piked_hip_is_negative():
    base = {"shoulder": _pt(0.2, 0.5), "ankle": _pt(0.8, 0.5)}
    sag = hip_offset_from_line({**base, "hip": _pt(0.5, 0.58)})   # lower in the image
    pike = hip_offset_from_line({**base, "hip": _pt(0.5, 0.42)})  # higher in the image
    assert sag == pytest.approx(0.08)
    assert pike == pytest.approx(-0.08)


def test_offset_is_none_for_missing_joint_or_vertical_line():
    assert hip_offset_from_line({"shoulder": _pt(0.2, 0.5), "hip": _pt(0.5, 0.5)}) is None
    vertical = {"shoulder": _pt(0.5, 0.2), "hip": _pt(0.5, 0.5), "ankle": _pt(0.5, 0.9)}
    assert hip_offset_from_line(vertical) is None


# --- visible_side -----------------------------------------------------------

def _frame(left_vis, right_vis):
    frame = {}
    for joint in ANALYSIS_JOINTS:
        frame[f"left_{joint}"] = _pt(0.4, 0.5, left_vis)
        frame[f"right_{joint}"] = _pt(0.6, 0.5, right_vis)
    return frame


def test_visible_side_picks_the_better_seen_side():
    assert visible_side(_frame(0.9, 0.3)) == "left"
    assert visible_side(_frame(0.2, 0.8)) == "right"


def test_visible_side_tie_and_empty_frame_default_to_left():
    assert visible_side(_frame(0.5, 0.5)) == "left"
    assert visible_side({}) == "left"


# --- build_frames -----------------------------------------------------------

def test_build_frames_empty_input():
    assert build_frames([]) == []


def test_build_frames_skips_missing_timestamps_and_angles():
    frame = {"left_shoulder": _pt(0.5, 0.3), "left_elbow": _pt(0.5, 0.45), "left_wrist": _pt(0.5, 0.6)}
    out = build_frames([frame, frame], side="left", timestamps=[0, None])
    assert out[0]["t_ms"] == 0.0
    assert "t_ms" not in out[1]
    # Only the arm is present: elbow angle is computed, leg/torso angles are not.
    assert out[0]["angles"] == {"elbow_angle": 180.0}
    assert set(out[0]["confidence"]) == {"shoulder", "elbow", "wrist"}
