"""Geometry helpers that turn raw pose landmarks into joint angles.

Coordinates are MediaPipe-normalised image coordinates: x to the right, y DOWN,
both in [0, 1]. All angles are in degrees.
"""

import math
from typing import Any, Dict, List, Optional

# MediaPipe Pose returns 33 landmarks in this fixed order.
LANDMARK_NAMES = [
    "nose", "left_eye_inner", "left_eye", "left_eye_outer",
    "right_eye_inner", "right_eye", "right_eye_outer",
    "left_ear", "right_ear", "mouth_left", "mouth_right",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_pinky", "right_pinky",
    "left_index", "right_index", "left_thumb", "right_thumb",
    "left_hip", "right_hip", "left_knee", "right_knee",
    "left_ankle", "right_ankle", "left_heel", "right_heel",
    "left_foot_index", "right_foot_index",
]

# Joints used by the analysis (one body side is picked per video).
ANALYSIS_JOINTS = ["shoulder", "elbow", "wrist", "hip", "knee", "ankle", "heel", "foot_index"]
# Midline landmarks that are not tied to a body side (used for the chin-over-bar check).
CENTER_JOINTS = ["nose"]

Point = Dict[str, float]


def angle_at(a: Point, b: Point, c: Point) -> float:
    """Angle at vertex ``b`` between rays b->a and b->c, in degrees (0-180)."""
    bax, bay = a["x"] - b["x"], a["y"] - b["y"]
    bcx, bcy = c["x"] - b["x"], c["y"] - b["y"]
    norm = math.hypot(bax, bay) * math.hypot(bcx, bcy)
    if norm == 0:
        return 0.0
    cosine = max(-1.0, min(1.0, (bax * bcx + bay * bcy) / norm))
    return math.degrees(math.acos(cosine))


def torso_lean(shoulder: Point, hip: Point) -> float:
    """Inclination of the hip->shoulder line from vertical (0 = upright, 90 = horizontal)."""
    dx = abs(shoulder["x"] - hip["x"])
    dy = hip["y"] - shoulder["y"]  # positive when the shoulder is above the hip
    return max(0.0, min(90.0, math.degrees(math.atan2(dx, dy)))) if dy != 0 else 90.0


def landmarks_to_named(landmarks: List[Dict[str, float]]) -> Dict[str, Point]:
    """Convert an ordered landmark list into ``{name: {x, y, z, visibility}}``."""
    named: Dict[str, Point] = {}
    for name, lm in zip(LANDMARK_NAMES, landmarks):
        named[name] = {
            "x": lm["x"],
            "y": lm["y"],
            "z": lm.get("z", 0.0),
            "visibility": lm.get("visibility", 0.0),
        }
    return named


def visible_side(frame: Dict[str, Point]) -> str:
    """Return ``left`` or ``right``: the body side the camera sees best."""

    def mean_visibility(side: str) -> float:
        values = [
            frame[f"{side}_{j}"].get("visibility", 0.0)
            for j in ANALYSIS_JOINTS
            if f"{side}_{j}" in frame
        ]
        return sum(values) / len(values) if values else 0.0

    return "left" if mean_visibility("left") >= mean_visibility("right") else "right"


def build_frames(
    frames: List[Dict[str, Point]],
    side: Optional[str] = None,
    timestamps: Optional[List[Optional[float]]] = None,
) -> List[Dict[str, Any]]:
    """Reduce full-body frames to the analysis payload: one side, joints + angles.

    ``timestamps`` (milliseconds, one per frame) are kept as ``t_ms`` so hold
    exercises such as the plank can be timed.
    """
    if not frames:
        return []
    side = side or visible_side(frames[0])
    out: List[Dict[str, Any]] = []
    for idx, frame in enumerate(frames):
        joints: Dict[str, Dict[str, float]] = {}
        confidence: Dict[str, float] = {}
        for joint in ANALYSIS_JOINTS:
            pt = frame.get(f"{side}_{joint}")
            if pt is None:
                continue
            vis = round(pt.get("visibility", 0.0), 3)
            joints[joint] = {"x": round(pt["x"], 4), "y": round(pt["y"], 4), "visibility": vis}
            confidence[joint] = vis

        for joint in CENTER_JOINTS:  # side independent, not part of the confidence average
            pt = frame.get(joint)
            if pt is not None:
                joints[joint] = {
                    "x": round(pt["x"], 4), "y": round(pt["y"], 4),
                    "visibility": round(pt.get("visibility", 0.0), 3),
                }

        angles: Dict[str, float] = {}
        if all(j in joints for j in ("shoulder", "elbow", "wrist")):
            angles["elbow_angle"] = round(angle_at(joints["shoulder"], joints["elbow"], joints["wrist"]), 1)
        if all(j in joints for j in ("shoulder", "hip", "ankle")):
            angles["body_line"] = round(angle_at(joints["shoulder"], joints["hip"], joints["ankle"]), 1)
        if all(j in joints for j in ("hip", "knee", "ankle")):
            angles["knee_angle"] = round(angle_at(joints["hip"], joints["knee"], joints["ankle"]), 1)
        if all(j in joints for j in ("shoulder", "hip", "knee")):
            angles["hip_angle"] = round(angle_at(joints["shoulder"], joints["hip"], joints["knee"]), 1)
            angles["torso_lean"] = round(torso_lean(joints["shoulder"], joints["hip"]), 1)
        entry: Dict[str, Any] = {"frame_idx": idx, "joints": joints, "angles": angles, "confidence": confidence}
        if timestamps is not None and idx < len(timestamps) and timestamps[idx] is not None:
            entry["t_ms"] = float(timestamps[idx])
        out.append(entry)
    return out


def hip_offset_from_line(joints: Dict[str, Dict[str, float]]) -> Optional[float]:
    """Signed vertical distance of the hip from the shoulder-ankle line.

    Image y points down, so a positive value means the hip is BELOW the line
    (sagging) and a negative value means it is above it (piking). Returns None
    when a joint is missing or the line is vertical.
    """
    if not all(k in joints for k in ("shoulder", "hip", "ankle")):
        return None
    sh, hip, an = joints["shoulder"], joints["hip"], joints["ankle"]
    dx = an["x"] - sh["x"]
    if abs(dx) < 1e-6:
        return None
    line_y = sh["y"] + (hip["x"] - sh["x"]) * (an["y"] - sh["y"]) / dx
    return hip["y"] - line_y
