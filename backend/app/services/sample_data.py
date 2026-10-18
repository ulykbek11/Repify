"""Synthetic side-view squat/deadlift pose sequences for demos and tests.

A simple planar skeleton (ankle -> knee -> hip -> shoulder) is driven by a
knee/hip angle trajectory, then exposed as 33 MediaPipe-style landmarks.
No video is involved, so the output is explicitly *synthetic*.
"""

import math
from typing import Dict, List

ANKLE = (0.45, 0.88)
SHANK, THIGH, TORSO = 0.22, 0.24, 0.28


def _smooth_step(t: float) -> float:
    return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, t)))


def _skeleton(knee_angle: float, lean_deg: float, shank_lean_deg: float) -> Dict[str, tuple]:
    """Forward kinematics of a person facing right (positive x)."""
    a = math.radians(shank_lean_deg)
    knee = (ANKLE[0] + SHANK * math.sin(a), ANKLE[1] - SHANK * math.cos(a))
    # direction knee -> ankle, then rotate by the knee angle to get knee -> hip
    base = math.atan2(ANKLE[1] - knee[1], ANKLE[0] - knee[0])
    options = []
    for sign in (1, -1):
        phi = base + sign * math.radians(knee_angle)
        options.append((knee[0] + THIGH * math.cos(phi), knee[1] + THIGH * math.sin(phi)))
    hip = min(options, key=lambda p: p[0])  # hips travel backwards
    lean = math.radians(lean_deg)
    shoulder = (hip[0] + TORSO * math.sin(lean), hip[1] - TORSO * math.cos(lean))
    return {
        "ankle": ANKLE,
        "knee": knee,
        "hip": hip,
        "shoulder": shoulder,
        "heel": (ANKLE[0] - 0.03, ANKLE[1] + 0.015),
        "foot_index": (ANKLE[0] + 0.08, ANKLE[1] + 0.015),
    }


def _landmarks(joints: Dict[str, tuple]) -> List[Dict[str, float]]:
    from app.services.pose_features import LANDMARK_NAMES

    head = (joints["shoulder"][0] + 0.03, joints["shoulder"][1] - 0.08)
    out = []
    for name in LANDMARK_NAMES:
        base = name.replace("left_", "").replace("right_", "")
        if base in joints:
            x, y = joints[base]
            vis = 0.99
        elif base in ("nose", "eye", "ear", "eye_inner", "eye_outer", "mouth"):
            x, y, vis = head[0], head[1], 0.9
        else:  # arms etc.: hang near the shoulder
            x, y, vis = joints["shoulder"][0] + 0.02, joints["shoulder"][1] + 0.12, 0.8
        out.append({"x": round(x, 4), "y": round(y, 4), "z": 0.0, "visibility": vis})
    return out


def generate_pose_sequence(exercise: str = "squat", depths=None, fps_frames: int = 30):
    """Return frames in the frontend format: ``[{"landmarks": [...], "timestamp": ms}]``.

    ``depths`` are the minimum knee angles per repetition. The defaults give one
    deep, one shallow and one medium squat so the analyzer has something to say.
    """
    is_deadlift = exercise == "deadlift"
    depths = depths or ([95, 100, 98] if is_deadlift else [88, 118, 100])
    frames: List[Dict] = []

    def add(knee: float, lean: float, shank: float):
        frames.append(
            {"landmarks": _landmarks(_skeleton(knee, lean, shank)), "timestamp": len(frames) * 33}
        )

    for _ in range(8):  # standing at the start
        add(172, 4, 2)
    for depth in depths:
        span = 172 - depth
        for phase in (0, 1):  # 0 = down, 1 = up
            for i in range(fps_frames):
                t = _smooth_step(i / (fps_frames - 1))
                k = 172 - span * (t if phase == 0 else 1 - t)
                progress = (172 - k) / 85
                if is_deadlift:
                    add(172 - (172 - k) * 0.5, 4 + progress * 70, progress * 8)
                else:
                    add(k, 4 + progress * 38, progress * 28)
        for _ in range(4):
            add(172, 4, 2)
    return frames
