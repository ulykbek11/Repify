"""Exercise registry for the rule-based analyzer.

Every exercise is described by a :class:`Spec`: which joint-angle signal counts
repetitions, where a repetition starts and ends, how far it has to go, and a
list of form checks. All numbers below are HEURISTICS chosen from common
coaching cues and checked on synthetic landmark sequences. They have not been
validated against coach-labelled video. Angles are in degrees, lengths are
fractions of the image size (MediaPipe normalised coordinates, y points down).

Signal modes
* ``dip``  - the signal starts high (``rest``) and a repetition is an excursion
  below ``enter`` (squat, bench press, push-up, pull-up, curl ...).
* ``peak`` - the signal starts low (``rest``) and a repetition is an excursion
  above ``enter`` (overhead press, hip thrust).
"""

import math
import re
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Tuple

Joint = Dict[str, float]


def _dist(a: Joint, b: Joint) -> float:
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


REST_LOOKAROUND = 15  # frames (about half a second at 30 fps)


class RepContext:
    """Everything a form check may look at for one repetition."""

    def __init__(self, spec: "Spec", frames: List[Dict[str, Any]], signal: List[Optional[float]],
                 rep: Dict[str, int], base: Dict[str, Any]):
        self.spec = spec
        self.frames = frames
        self.rep = rep
        self.base = base
        self.start_frame = frames[rep["start"]]
        self.ext_frame = frames[rep["bottom"]]  # the extreme of the movement (lowest or highest point)
        self.j: Dict[str, Joint] = self.ext_frame.get("joints", {})
        self.ang: Dict[str, float] = self.ext_frame.get("angles", {})
        self.value: float = signal[rep["bottom"]] or 0.0
        self.segment = frames[rep["start"]: rep["end"] + 1]
        # ``start`` and ``end`` are the first frames at the rest threshold, not the true
        # start / end position, so lockout checks look a little further on both sides.
        self.wide = frames[max(0, rep["start"] - REST_LOOKAROUND): rep["end"] + 1 + REST_LOOKAROUND]
        self.after = frames[rep["bottom"]: rep["end"] + 1 + REST_LOOKAROUND]

    def shortfall(self, limit: float) -> float:
        """How far the extreme fell short of ``limit`` (positive = not far enough)."""
        return self.value - limit if self.spec.mode == "dip" else limit - self.value

    def angles(self, key: str, frames: Optional[List[Dict[str, Any]]] = None) -> List[float]:
        return [f["angles"][key] for f in (frames if frames is not None else self.segment) if key in f.get("angles", {})]

    def joint_values(self, name: str, axis: str) -> List[float]:
        return [f["joints"][name][axis] for f in self.segment if name in f.get("joints", {})]

    def torso_len(self) -> Optional[float]:
        if "shoulder" in self.j and "hip" in self.j:
            return _dist(self.j["shoulder"], self.j["hip"])
        return None


CheckFn = Callable[[RepContext], Optional[float]]


@dataclass(frozen=True)
class Check:
    key: str
    fn: CheckFn  # returns a score penalty when the rule is violated, otherwise None


@dataclass(frozen=True)
class Spec:
    id: str
    camera: str                  # camera view required for a trustworthy 2D reading
    camera_note: str
    signal: str                  # angle key that counts repetitions
    mode: str                    # "dip" | "peak" | "hold"
    rest: float                  # angle that marks the start / end position
    enter: float                 # angle that has to be crossed to count a repetition
    required: Tuple[str, ...]    # joints that must be visible
    checks: Tuple[Check, ...] = ()
    calibrate: bool = False      # report thigh/shin proportions
    signal_label: str = ""       # human description of the counting signal (docs)


# ---------------------------------------------------------------------------
# check helpers
# ---------------------------------------------------------------------------

def _range_short(limit: float, cap: float = 35.0) -> CheckFn:
    """Extreme of the movement did not reach ``limit`` degrees."""
    def fn(ctx: RepContext) -> Optional[float]:
        short = ctx.shortfall(limit)
        return min(cap, 5.0 + short * 1.5) if short > 0 else None
    return fn


def _lockout(angle_key: str, limit: float, cap: float = 20.0) -> CheckFn:
    """The angle never reached ``limit`` while returning to the start position."""
    def fn(ctx: RepContext) -> Optional[float]:
        values = ctx.angles(angle_key, ctx.after)
        if not values:
            return None
        top = max(values)
        return min(cap, (limit - top) * 1.5) if top < limit else None
    return fn


def _extension(angle_key: str, limit: float, cap: float = 15.0) -> CheckFn:
    """The angle never reached ``limit`` anywhere in the repetition (start or end)."""
    def fn(ctx: RepContext) -> Optional[float]:
        values = ctx.angles(angle_key, ctx.wide)
        if not values:
            return None
        top = max(values)
        return min(cap, (limit - top) * 1.5) if top < limit else None
    return fn


def _lean_over(limit: float, penalty: float = 10.0) -> CheckFn:
    def fn(ctx: RepContext) -> Optional[float]:
        return penalty if ctx.ang.get("torso_lean", 0) > limit else None
    return fn


def _lean_range(limit: float, penalty: float = 10.0) -> CheckFn:
    """Torso angle changed by more than ``limit`` degrees during the repetition (momentum)."""
    def fn(ctx: RepContext) -> Optional[float]:
        leans = ctx.angles("torso_lean")
        return penalty if leans and max(leans) - min(leans) > limit else None
    return fn


def _knee_travel(limit: float, penalty: float) -> CheckFn:
    """Knee ahead of the toes by more than ``limit`` (fraction of image width)."""
    def fn(ctx: RepContext) -> Optional[float]:
        j = ctx.j
        if all(k in j for k in ("knee", "foot_index", "heel")):
            facing = 1 if j["foot_index"]["x"] >= j["heel"]["x"] else -1
            if (j["knee"]["x"] - j["foot_index"]["x"]) * facing > limit:
                return penalty
        return None
    return fn


def _heels(ctx: RepContext) -> Optional[float]:
    base_heel = ctx.base.get("heel_y")
    if base_heel is not None and "heel" in ctx.j and base_heel - ctx.j["heel"]["y"] > 0.025:
        return 10.0
    return None


def _hips_low(ctx: RepContext) -> Optional[float]:
    return 12.0 if ctx.ang.get("knee_angle", 180) < 85 else None


def _forearm_vertical(ctx: RepContext) -> Optional[float]:
    j = ctx.j
    if all(k in j for k in ("elbow", "wrist")):
        forearm = _dist(j["elbow"], j["wrist"])
        if forearm > 0 and abs(j["wrist"]["x"] - j["elbow"]["x"]) > 0.5 * forearm:
            return 10.0
    return None


def _bar_over_shoulders(ctx: RepContext) -> Optional[float]:
    torso = ctx.torso_len()
    j = ctx.j
    if torso and "wrist" in j and "shoulder" in j and abs(j["wrist"]["x"] - j["shoulder"]["x"]) > 0.3 * torso:
        return 10.0
    return None


def _body_line(sag: bool) -> CheckFn:
    """Push-up: hips sagging (``sag``) or piking while the shoulder-hip-ankle line is bent."""
    from app.services.pose_features import hip_offset_from_line

    def fn(ctx: RepContext) -> Optional[float]:
        worst = None
        for f in ctx.segment:
            line = f.get("angles", {}).get("body_line")
            if line is not None and (worst is None or line < worst[0]):
                worst = (line, f)
        if worst is None or worst[0] >= 160:
            return None
        offset = hip_offset_from_line(worst[1]["joints"])
        if offset is None or (offset > 0) != sag:
            return None
        return min(20.0, 6.0 + (160 - worst[0]) * 0.8)
    return fn


def _chin_over_bar(ctx: RepContext) -> Optional[float]:
    j = ctx.j
    if "nose" in j and "wrist" in j and j["nose"].get("visibility", 0) > 0.3:
        return 12.0 if j["nose"]["y"] > j["wrist"]["y"] + 0.02 else None
    return None


def _hip_sway(ctx: RepContext) -> Optional[float]:
    xs = ctx.joint_values("hip", "x")
    torso = ctx.torso_len()
    return 10.0 if xs and torso and max(xs) - min(xs) > 0.35 * torso else None


def _row_upright(ctx: RepContext) -> Optional[float]:
    return 10.0 if ctx.ang.get("torso_lean", 90) < 30 else None


def _row_momentum(ctx: RepContext) -> Optional[float]:
    start = ctx.wide[0].get("angles", {}).get("torso_lean")  # torso angle at the start position
    now = ctx.ang.get("torso_lean")
    return 10.0 if start is not None and now is not None and abs(now - start) > 15 else None


def _knees_bent(ctx: RepContext) -> Optional[float]:
    return 12.0 if ctx.ang.get("knee_angle", 180) < 130 else None


def _bar_close(ctx: RepContext) -> Optional[float]:
    j = ctx.j
    if all(k in j for k in ("wrist", "knee", "hip")):
        thigh = _dist(j["hip"], j["knee"])
        if thigh > 0 and abs(j["wrist"]["x"] - j["knee"]["x"]) > 0.8 * thigh:
            return 8.0
    return None


def _elbow_drift(ctx: RepContext) -> Optional[float]:
    j = ctx.j
    if all(k in j for k in ("shoulder", "elbow")):
        upper = _dist(j["shoulder"], j["elbow"])
        if upper > 0 and abs(j["elbow"]["x"] - j["shoulder"]["x"]) > 0.45 * upper:
            return 10.0
    return None


def _shins(ctx: RepContext) -> Optional[float]:
    k = ctx.ang.get("knee_angle")
    return 8.0 if k is not None and not 75 <= k <= 110 else None


def _deadlift_lockout(ctx: RepContext) -> Optional[float]:
    return _lockout("hip_angle", 165.0)(ctx)


# ---------------------------------------------------------------------------
# registry
# ---------------------------------------------------------------------------

ELBOW_JOINTS = ("shoulder", "elbow", "wrist")
LEG_JOINTS = ("hip", "knee", "ankle")

SPECS: Dict[str, Spec] = {}


def _add(spec: Spec) -> None:
    SPECS[spec.id] = spec


_add(Spec(
    "squat", "side", "Side view at hip height, whole body and feet in frame.",
    "knee_angle", "dip", 160, 130, LEG_JOINTS + ("shoulder",),
    (Check("depth", _range_short(105)), Check("lean", _lean_over(60)),
     Check("knees", _knee_travel(0.04, 6.0)), Check("heels", _heels)),
    calibrate=True, signal_label="knee angle (hip-knee-ankle)",
))
_add(Spec(
    "deadlift", "side", "Side view at hip height, bar and feet in frame.",
    "hip_angle", "dip", 160, 125, LEG_JOINTS + ("shoulder",),
    (Check("lockout", _deadlift_lockout), Check("hips_low", _hips_low)),
    calibrate=True, signal_label="hip angle (shoulder-hip-knee)",
))
_add(Spec(
    "bench_press", "side", "Side view from the side of the bench at bar height, arm and bar in frame.",
    "elbow_angle", "dip", 150, 110, ELBOW_JOINTS,
    (Check("rom", _range_short(95)), Check("lockout", _lockout("elbow_angle", 160)),
     Check("forearm", _forearm_vertical)),
    signal_label="elbow angle (shoulder-elbow-wrist)",
))
_add(Spec(
    "overhead_press", "side", "Side view at chest height, bar path and the whole body in frame.",
    "elbow_angle", "peak", 115, 145, ELBOW_JOINTS + ("hip",),
    (Check("lockout", _range_short(165)), Check("lean", _lean_over(15)),
     Check("stack", _bar_over_shoulders)),
    signal_label="elbow angle, repetition = rack position to lockout",
))
_add(Spec(
    "push_up", "side", "Side view at floor level, head to feet in frame.",
    "elbow_angle", "dip", 150, 115, ELBOW_JOINTS + ("hip", "ankle"),
    (Check("depth", _range_short(100)), Check("lockout", _lockout("elbow_angle", 160)),
     Check("sag", _body_line(True)), Check("pike", _body_line(False))),
    signal_label="elbow angle (shoulder-elbow-wrist)",
))
_add(Spec(
    "pull_up", "side", "Side view (a front view counts reps but weakens the chin and swing checks); bar and whole body in frame.",
    "elbow_angle", "dip", 150, 110, ELBOW_JOINTS + ("hip",),
    (Check("rom", _range_short(90)), Check("chin", _chin_over_bar),
     Check("hang", _extension("elbow_angle", 160, 15.0)), Check("swing", _hip_sway)),
    signal_label="elbow angle, repetition = dead hang to top",
))
_add(Spec(
    "row", "side", "Side view at hip height, hinge position and bar path in frame.",
    "elbow_angle", "dip", 150, 115, ELBOW_JOINTS + ("hip",),
    (Check("rom", _range_short(100)), Check("upright", _row_upright), Check("momentum", _row_momentum)),
    signal_label="elbow angle, repetition = arms extended to bar at the torso",
))
_add(Spec(
    "lunge", "side", "Side view at hip height, both feet in frame.",
    "knee_angle", "dip", 160, 125, LEG_JOINTS + ("shoulder",),
    (Check("depth", _range_short(105)), Check("lean", _lean_over(30)),
     Check("knees", _knee_travel(0.06, 6.0))),
    calibrate=True, signal_label="knee angle of the leg nearest to the camera",
))
_add(Spec(
    "romanian_deadlift", "side", "Side view at hip height, bar and feet in frame.",
    "hip_angle", "dip", 160, 135, LEG_JOINTS + ("shoulder", "wrist"),
    (Check("depth", _range_short(115, 25.0)), Check("knees", _knees_bent),
     Check("lockout", _lockout("hip_angle", 165)), Check("bar", _bar_close)),
    calibrate=True, signal_label="hip angle (shoulder-hip-knee)",
))
_add(Spec(
    "bicep_curl", "side", "Side view at chest height, whole arm and torso in frame.",
    "elbow_angle", "dip", 150, 90, ELBOW_JOINTS + ("hip",),
    (Check("rom", _range_short(65)), Check("extend", _extension("elbow_angle", 160, 15.0)),
     Check("elbows", _elbow_drift), Check("swing", _lean_range(12))),
    signal_label="elbow angle (shoulder-elbow-wrist)",
))
_add(Spec(
    "plank", "side", "Side view at floor level, head to feet in frame; hold at least 10 seconds.",
    "body_line", "hold", 0, 0, ("shoulder", "hip", "ankle"),
    signal_label="body line angle (shoulder-hip-ankle), hold time",
))
_add(Spec(
    "hip_thrust", "side", "Side view at hip height, bench, hips and feet in frame.",
    "hip_angle", "peak", 145, 160, LEG_JOINTS + ("shoulder",),
    (Check("lockout", _range_short(170)), Check("shins", _shins)),
    signal_label="hip angle, repetition = hips down to full extension",
))
_add(Spec(
    "dip", "side", "Side view at chest height, arms and torso in frame.",
    "elbow_angle", "dip", 150, 115, ELBOW_JOINTS + ("hip",),
    (Check("depth", _range_short(100)), Check("lockout", _lockout("elbow_angle", 160)),
     Check("lean", _lean_over(50, 8.0))),
    signal_label="elbow angle (shoulder-elbow-wrist)",
))
_add(Spec(
    "lat_pulldown", "side", "Side view at shoulder height, arm, bar and torso in frame.",
    "elbow_angle", "dip", 150, 110, ELBOW_JOINTS + ("hip",),
    (Check("rom", _range_short(100)), Check("stretch", _extension("elbow_angle", 160, 15.0)),
     Check("lean", _lean_over(35)), Check("momentum", _lean_range(15, 8.0))),
    signal_label="elbow angle, repetition = arms extended overhead to bar at the chest",
))

EXERCISE_IDS: List[str] = list(SPECS)

# Names and phrases accepted by the API, mapped to exercise ids. Longer phrases
# are tested first so "romanian deadlift" is not read as "deadlift".
_ALIASES: List[Tuple[str, str]] = [
    ("romanian", "romanian_deadlift"), ("rdl", "romanian_deadlift"), ("румын", "romanian_deadlift"),
    ("hip thrust", "hip_thrust"), ("hip_thrust", "hip_thrust"), ("ягодичн", "hip_thrust"),
    ("overhead", "overhead_press"), ("shoulder press", "overhead_press"), ("ohp", "overhead_press"),
    ("military", "overhead_press"), ("жим стоя", "overhead_press"), ("жим над головой", "overhead_press"),
    ("bench", "bench_press"), ("жим лежа", "bench_press"), ("жим лёжа", "bench_press"),
    ("push-up", "push_up"), ("push up", "push_up"), ("pushup", "push_up"), ("push_up", "push_up"),
    ("отжиман", "push_up"),
    ("pull-up", "pull_up"), ("pull up", "pull_up"), ("pullup", "pull_up"), ("pull_up", "pull_up"),
    ("chin-up", "pull_up"), ("chin up", "pull_up"), ("chinup", "pull_up"), ("подтягиван", "pull_up"),
    ("pulldown", "lat_pulldown"), ("pull-down", "lat_pulldown"), ("pull down", "lat_pulldown"),
    ("lat_", "lat_pulldown"), ("верхн", "lat_pulldown"), ("тяга верхнего", "lat_pulldown"),
    ("row", "row"), ("тяга в наклоне", "row"), ("тяга штанги в наклоне", "row"),
    ("lunge", "lunge"), ("выпад", "lunge"),
    ("curl", "bicep_curl"), ("bicep", "bicep_curl"), ("бицепс", "bicep_curl"), ("сгибание рук", "bicep_curl"),
    ("plank", "plank"), ("планк", "plank"),
    ("dip", "dip"), ("брусья", "dip"), ("отжимания на брусьях", "dip"),
    ("deadlift", "deadlift"), ("тяг", "deadlift"),
    ("squat", "squat"), ("присед", "squat"),
]


def normalize_exercise(raw: str) -> Optional[str]:
    """Map a free-form exercise name to a registry id, or None if unknown."""
    text = re.sub(r"\s+", " ", (raw or "").lower().strip())
    if text in SPECS:
        return text
    for needle, ex in _ALIASES:
        # the needle has to start a word, so "row" does not match "narrow"
        if re.search(r"(?<![a-zа-яё])" + re.escape(needle), text):
            return ex
    return None


def describe() -> List[Dict[str, Any]]:
    """Public description of the registry (served by ``GET /api/exercises``)."""
    return [
        {
            "id": s.id,
            "camera": s.camera,
            "camera_note": s.camera_note,
            "signal": s.signal,
            "signal_label": s.signal_label,
            "mode": s.mode,
            "checks": [c.key for c in s.checks] if s.mode != "hold" else ["sag", "pike", "shoulders", "short"],
        }
        for s in SPECS.values()
    ]
