"""Synthetic side-view pose sequences, one builder per exercise. Unit-test fixtures only: not part of the app.

A simple planar skeleton is driven by a joint-angle trajectory (knee or hip angle
for squat and deadlift, elbow or hip angle for the other lifts, a steady body
line for the plank), then exposed as 33 MediaPipe-style landmarks. No video is
involved, so the output is explicitly synthetic.

``faults`` switch on a deliberate technique error (for example ``"sag"`` for the
push-up) so tests can exercise each form check.
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

    head = joints.get("nose") or (joints["shoulder"][0] + 0.03, joints["shoulder"][1] - 0.08)
    out = []
    for name in LANDMARK_NAMES:
        base = name.replace("left_", "").replace("right_", "")
        if base in joints:
            x, y = joints[base]
            vis = 0.99
        elif base in ("nose", "eye", "ear", "eye_inner", "eye_outer", "mouth"):
            x, y, vis = head[0], head[1], 0.9
        elif base == "elbow":  # squat / deadlift: arms hang straight down from the shoulder
            x, y, vis = joints["shoulder"][0] + 0.02, joints["shoulder"][1] + 0.12, 0.8
        else:  # wrists and hands
            x, y, vis = joints["shoulder"][0] + 0.03, joints["shoulder"][1] + 0.24, 0.8
        out.append({"x": round(x, 4), "y": round(y, 4), "z": 0.0, "visibility": vis})
    return out


def _generate_legacy(exercise: str = "squat", depths=None, fps_frames: int = 30):
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


# ---------------------------------------------------------------------------
# geometry helpers: angles are degrees clockwise from "up", y points down
# ---------------------------------------------------------------------------

L_SHANK, L_THIGH, L_TORSO, L_UPPER, L_FORE = 0.22, 0.24, 0.28, 0.15, 0.14


def _pt(origin, theta, length):
    r = math.radians(theta)
    return (origin[0] + length * math.sin(r), origin[1] - length * math.cos(r))


def _theta(a, b):
    return math.degrees(math.atan2(b[0] - a[0], -(b[1] - a[1])))


def _bend(a, b, length, angle, pick):
    """Point c at ``length`` from b so that the angle a-b-c equals ``angle``; ``pick`` chooses a side."""
    base = _theta(b, a)
    return pick([_pt(b, base + angle, length), _pt(b, base - angle, length)])


def _two_bone(root, end, l1, l2, pick):
    """Middle joint of a two-bone chain whose ends are ``root`` and ``end``."""
    d = math.hypot(end[0] - root[0], end[1] - root[1])
    d = min(d, l1 + l2 - 1e-6)
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    h = math.sqrt(max(l1 * l1 - a * a, 0.0))
    ux, uy = (end[0] - root[0]) / d, (end[1] - root[1]) / d
    mx, my = root[0] + a * ux, root[1] + a * uy
    return pick([(mx - h * uy, my + h * ux), (mx + h * uy, my - h * ux)])


def _right(opts):
    return max(opts, key=lambda p: p[0])


def _left(opts):
    return min(opts, key=lambda p: p[0])


def _up(opts):
    return min(opts, key=lambda p: p[1])


def _down(opts):
    return max(opts, key=lambda p: p[1])


def _forearm_up_arm(shoulder, e, tilt=0.0, mirror=False):
    """Arm whose forearm stays vertical (bar overhead): elbow angle ``e``, forearm tilted by ``tilt``."""
    sign = -1 if mirror else 1
    elbow = (shoulder[0] + sign * L_UPPER * math.sin(math.radians(e)), shoulder[1] + L_UPPER * math.cos(math.radians(e)))
    wrist = _pt(elbow, sign * tilt, L_FORE)
    return elbow, wrist


def _feet(ankle):
    return (ankle[0] - 0.03, ankle[1] + 0.015), (ankle[0] + 0.08, ankle[1] + 0.015)


def _standing(lean=3.0):
    ankle = (0.45, 0.88)
    knee = _pt(ankle, 0, L_SHANK)
    hip = _pt(knee, 0, L_THIGH)
    shoulder = _pt(hip, lean, L_TORSO)
    return ankle, knee, hip, shoulder


def _joints(**kw):
    heel, toe = _feet(kw["ankle"])
    kw.setdefault("heel", heel)
    kw.setdefault("foot_index", toe)
    return kw


def _pose_ohp(s, prog, faults):
    lean = 3 - (25 if "lean" in faults else 0) * prog
    ankle, knee, hip, shoulder = _standing(lean)
    elbow, wrist = _forearm_up_arm(shoulder, s, 35 * prog if "stack" in faults else 0)
    return _joints(ankle=ankle, knee=knee, hip=hip, shoulder=shoulder, elbow=elbow, wrist=wrist,
                   nose=(shoulder[0] + 0.03, shoulder[1] - 0.11))


def _pose_curl(s, prog, faults):
    lean = 3 + (22 if "swing" in faults else 0) * prog
    ankle, knee, hip, shoulder = _standing(lean)
    theta_u = 180 - (40 if "elbows" in faults else 5) * prog
    elbow = _pt(shoulder, theta_u, L_UPPER)
    wrist = _pt(elbow, theta_u - (180 - s), L_FORE)
    return _joints(ankle=ankle, knee=knee, hip=hip, shoulder=shoulder, elbow=elbow, wrist=wrist,
                   nose=(shoulder[0] + 0.03, shoulder[1] - 0.11))


def _pose_bench(s, prog, faults):
    shoulder = (0.30, 0.60)
    hip = (shoulder[0] + L_TORSO, shoulder[1])
    knee = _bend(shoulder, hip, L_THIGH, 125, _up)
    ankle = _bend(hip, knee, L_SHANK, 95, _down)
    elbow, wrist = _forearm_up_arm(shoulder, s, 40 * prog if "forearm" in faults else 0)
    return _joints(ankle=ankle, knee=knee, hip=hip, shoulder=shoulder, elbow=elbow, wrist=wrist,
                   nose=(shoulder[0] - 0.08, shoulder[1] - 0.02))


def _pose_pushup(s, prog, faults):
    wrist = (0.62, 0.83)
    d = math.sqrt(L_UPPER ** 2 + L_FORE ** 2 - 2 * L_UPPER * L_FORE * math.cos(math.radians(s)))
    shoulder = (wrist[0], wrist[1] - d)
    elbow = _two_bone(shoulder, wrist, L_UPPER, L_FORE, _left)
    ankle = (0.15, 0.84)
    hip = (shoulder[0] + 0.55 * (ankle[0] - shoulder[0]), shoulder[1] + 0.55 * (ankle[1] - shoulder[1]))
    if "sag" in faults:
        hip = (hip[0], hip[1] + 0.07)
    if "pike" in faults:
        hip = (hip[0], hip[1] - 0.07)
    knee = ((hip[0] + ankle[0]) / 2, (hip[1] + ankle[1]) / 2)
    return _joints(ankle=ankle, knee=knee, hip=hip, shoulder=shoulder, elbow=elbow, wrist=wrist,
                   nose=(shoulder[0] + 0.07, shoulder[1] - 0.05))


def _pose_pullup(s, prog, faults):
    wrist = (0.5, 0.10)
    d = math.sqrt(L_UPPER ** 2 + L_FORE ** 2 - 2 * L_UPPER * L_FORE * math.cos(math.radians(s)))
    shoulder = (wrist[0], wrist[1] + d)
    elbow = _two_bone(shoulder, wrist, L_UPPER, L_FORE, _right)
    sway = (30 if "swing" in faults else 0) * prog
    hip = _pt(shoulder, 180 - sway, L_TORSO)
    knee = _pt(hip, 180 - sway, L_THIGH)
    ankle = _pt(knee, 215, L_SHANK)
    return _joints(ankle=ankle, knee=knee, hip=hip, shoulder=shoulder, elbow=elbow, wrist=wrist,
                   nose=(shoulder[0] + 0.03, shoulder[1] - 0.14))


def _pose_dip(s, prog, faults):
    wrist = (0.5, 0.50)
    d = math.sqrt(L_UPPER ** 2 + L_FORE ** 2 - 2 * L_UPPER * L_FORE * math.cos(math.radians(s)))
    shoulder = (wrist[0], wrist[1] - d)
    elbow = _two_bone(shoulder, wrist, L_UPPER, L_FORE, _left)
    lean = 20 + (40 if "lean" in faults else 0) * prog
    hip = _pt(shoulder, 180 + lean, L_TORSO)
    knee = _pt(hip, 180, L_THIGH)
    ankle = _pt(knee, 230, L_SHANK)
    return _joints(ankle=ankle, knee=knee, hip=hip, shoulder=shoulder, elbow=elbow, wrist=wrist,
                   nose=(shoulder[0] + 0.03, shoulder[1] - 0.12))


def _pose_row(s, prog, faults):
    if "upright" in faults:
        lean = 18.0
    elif "momentum" in faults:
        lean = 55 - 17 * prog
    else:
        lean = 55.0
    ankle = (0.45, 0.88)
    knee = _pt(ankle, 6, L_SHANK)
    hip = _pt(knee, 6 + 180 + 165, L_THIGH)
    shoulder = _pt(hip, lean, L_TORSO)
    theta = 180 - s
    elbow = (shoulder[0] - L_UPPER * math.sin(math.radians(theta)), shoulder[1] + L_UPPER * math.cos(math.radians(theta)))
    wrist = (elbow[0], elbow[1] + L_FORE)
    return _joints(ankle=ankle, knee=knee, hip=hip, shoulder=shoulder, elbow=elbow, wrist=wrist,
                   nose=_pt(shoulder, lean + 35, 0.11))


def _pose_rdl(s, prog, faults):
    ankle = (0.45, 0.88)
    knee = _pt(ankle, 6, L_SHANK)
    k = 168 - (68 if "knees" in faults else 18) * prog
    theta_t = 6 + 180 + k
    hip = _pt(knee, theta_t, L_THIGH)
    lean = theta_t + 180 - s
    shoulder = _pt(hip, lean, L_TORSO)
    elbow = (shoulder[0], shoulder[1] + L_UPPER)
    wrist = (elbow[0], elbow[1] + L_FORE)
    if "bar" in faults:
        wrist = (wrist[0] + 0.2 * prog, wrist[1])
        elbow = (elbow[0] + 0.1 * prog, elbow[1])
    return _joints(ankle=ankle, knee=knee, hip=hip, shoulder=shoulder, elbow=elbow, wrist=wrist,
                   nose=_pt(shoulder, lean + 20, 0.11))


def _pose_hip_thrust(s, prog, faults):
    shoulder = (0.30, 0.60)
    phi = -22 + 32 * prog
    hip = (shoulder[0] + L_TORSO * math.cos(math.radians(phi)), shoulder[1] - L_TORSO * math.sin(math.radians(phi)))
    knee = _bend(shoulder, hip, L_THIGH, s, _up)
    ankle = _bend(hip, knee, L_SHANK, 140 if "shins" in faults else 90, _down)
    elbow = (shoulder[0] + 0.1, shoulder[1] + 0.07)
    wrist = (hip[0], hip[1] - 0.02)
    return _joints(ankle=ankle, knee=knee, hip=hip, shoulder=shoulder, elbow=elbow, wrist=wrist,
                   nose=(shoulder[0] - 0.07, shoulder[1] - 0.03))


def _pose_pulldown(s, prog, faults):
    if "lean" in faults:
        lean = 8 + 32 * prog
    elif "momentum" in faults:
        lean = 8 + 20 * prog
    else:
        lean = 8.0
    hip = (0.40, 0.65)
    shoulder = _pt(hip, -lean, L_TORSO)
    knee = _bend(shoulder, hip, L_THIGH, 100, _right)
    ankle = _bend(hip, knee, L_SHANK, 95, _down)
    elbow, wrist = _forearm_up_arm(shoulder, s, 0, mirror=True)
    return _joints(ankle=ankle, knee=knee, hip=hip, shoulder=shoulder, elbow=elbow, wrist=wrist,
                   nose=(shoulder[0] + 0.03, shoulder[1] - 0.11))


def _pose_lunge(s, prog, faults):
    lean = 6 + (40 if "lean" in faults else 0) * prog
    shank = prog * (42 if "knees" in faults else 12)
    return _skeleton(s, lean, shank)


# builder, resting angle, default reps (one weak rep so tests have a weak rep to find), good reps
BUILDERS = {
    "overhead_press": (_pose_ohp, 65, [170, 172, 152], [172, 172, 172]),
    "bicep_curl": (_pose_curl, 172, [45, 50, 80], [45, 48, 46]),
    "bench_press": (_pose_bench, 172, [80, 85, 108], [80, 82, 84]),
    "push_up": (_pose_pushup, 172, [80, 85, 112], [80, 82, 84]),
    "pull_up": (_pose_pullup, 172, [50, 55, 95], [50, 52, 54]),
    "dip": (_pose_dip, 172, [80, 85, 112], [80, 82, 84]),
    "row": (_pose_row, 172, [78, 82, 110], [78, 80, 82]),
    "romanian_deadlift": (_pose_rdl, 172, [100, 104, 128], [100, 102, 104]),
    "hip_thrust": (_pose_hip_thrust, 115, [172, 174, 165], [173, 174, 175]),
    "lat_pulldown": (_pose_pulldown, 172, [80, 85, 106], [80, 82, 84]),
}
LUNGE = (_pose_lunge, 172, [92, 98, 118], [92, 94, 96])

DEFAULT_DEPTHS = {"squat": [88, 118, 100], "deadlift": [95, 100, 98]}
DEFAULT_DEPTHS.update({k: v[2] for k, v in BUILDERS.items()})
DEFAULT_DEPTHS["lunge"] = LUNGE[2]
GOOD_DEPTHS = {"squat": [90, 92, 91], "deadlift": [95, 100, 98]}
GOOD_DEPTHS.update({k: v[3] for k, v in BUILDERS.items()})
GOOD_DEPTHS["lunge"] = LUNGE[3]
DEFAULT_FAULTS = {"plank": {"sag_late"}}  # the default plank loses its line in the last third
FIXTURE_EXERCISES = list(DEFAULT_DEPTHS) + ["plank"]


def _plank_pose(faults, progress):
    shoulder, elbow, wrist = (0.65, 0.62), (0.65, 0.80), (0.79, 0.80)
    if "shoulders" in faults:
        elbow, wrist = (0.45, 0.80), (0.60, 0.80)
    ankle = (0.12, 0.80)
    hip = (shoulder[0] + 0.5 * (ankle[0] - shoulder[0]), shoulder[1] + 0.5 * (ankle[1] - shoulder[1]))
    if "sag" in faults:
        hip = (hip[0], hip[1] + 0.08)
    if "sag_late" in faults:
        hip = (hip[0], hip[1] + 0.08 * max(0.0, (progress - 0.6) / 0.15 if progress < 0.75 else 1.0))
    if "pike" in faults:
        hip = (hip[0], hip[1] - 0.08)
    knee = ((hip[0] + ankle[0]) / 2, (hip[1] + ankle[1]) / 2)
    return _joints(ankle=ankle, knee=knee, hip=hip, shoulder=shoulder, elbow=elbow, wrist=wrist,
                   nose=(shoulder[0] + 0.07, shoulder[1] - 0.03))


def _generate_plank(faults, hold_seconds, fps=30):
    frames: List[Dict] = []

    def add(joints):
        frames.append({"landmarks": _landmarks(joints), "timestamp": len(frames) * round(1000 / fps)})

    standing = _skeleton(172, 4, 2)
    for _ in range(6):  # getting ready: standing, not yet in position
        add(standing)
    n = int(hold_seconds * fps)
    for i in range(n):
        add(_plank_pose(faults, i / max(n - 1, 1)))
    return frames


def _generate_reps(exercise, depths, faults, rest, fps_frames):
    builder, default_rest, _defaults, _good = BUILDERS.get(exercise) or LUNGE
    rest = default_rest if rest is None else rest
    frames: List[Dict] = []

    def add(s, prog):
        frames.append({"landmarks": _landmarks(builder(s, prog, faults)), "timestamp": len(frames) * 33})

    for _ in range(8):
        add(rest, 0.0)
    for depth in depths:
        span = rest - depth
        for phase in (0, 1):  # 0 = toward the extreme, 1 = back to rest
            for i in range(fps_frames):
                t = _smooth_step(i / (fps_frames - 1))
                t = t if phase == 0 else 1 - t
                add(rest - span * t, t)
        for _ in range(4):
            add(rest, 0.0)
    return frames


def generate_pose_sequence(exercise: str = "squat", depths=None, faults=None, rest=None,
                           fps_frames: int = 30, hold_seconds: float = 14.0):
    """Return frames in the frontend format: ``[{"landmarks": [...], "timestamp": ms}]``.

    ``depths`` are the extreme signal angles per repetition (minimum for most
    lifts, maximum for the overhead press and hip thrust); the defaults include
    one weak repetition so the analyzer has something to report. ``rest`` is the
    start / end angle, ``faults`` a set of deliberate form errors. The plank
    ignores ``depths`` and holds for ``hold_seconds``.
    """
    faults = set(DEFAULT_FAULTS.get(exercise, ()) if faults is None else faults)
    if exercise == "plank":
        return _generate_plank(faults, hold_seconds)
    if exercise in ("squat", "deadlift"):
        return _generate_legacy(exercise, depths, fps_frames)
    if exercise not in BUILDERS and exercise != "lunge":
        raise ValueError(f"Unknown exercise: {exercise}")
    return _generate_reps(exercise, depths or DEFAULT_DEPTHS[exercise], faults, rest, fps_frames)
