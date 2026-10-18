"""Deterministic, rule-based exercise analysis.

Works from per-frame joint angles (see ``pose_features.build_frames``). It is
used when no Gemini key is configured, when Gemini fails, and as the reference
implementation in tests. Output has the same shape as the Gemini analyzer.

The exercises, their counting signal, thresholds and form checks are declared
in ``exercises.py`` (squat, deadlift, bench press, overhead press, push-up,
pull-up, row, lunge, Romanian deadlift, bicep curl, plank, hip thrust, dip, lat
pulldown). All thresholds are heuristics, not validated on labelled video.

Repetitions are found with a small state machine over the smoothed signal:
rest position -> excursion past the ``enter`` angle -> back to rest. Squat uses
the knee angle (enter 130, full depth 105), deadlift the hip angle (enter 125,
lockout 165). The plank is a timed hold and is scored on body-line angle.
"""

import math
import statistics
from typing import Any, Dict, List, Optional

from app.services.exercise_messages import EX_MESSAGES
from app.services.exercises import RepContext, SPECS, Spec
from app.services.pose_features import hip_offset_from_line

TOP_ANGLE = 160.0
MIN_CONFIDENCE = 0.3

MESSAGES: Dict[str, Dict[str, str]] = {
    "en": {
        "no_data": "Not enough usable pose data in the video.",
        "no_data_tip": "Film from the side, keep the whole body in frame and make sure the lighting is good.",
        "no_reps": "No complete repetition was detected.",
        "no_reps_tip": "Start from a standing position, perform the full movement and return to standing.",
        "err_depth": "Depth was too shallow on {n} of {total} reps.",
        "err_lean": "Excessive forward lean of the torso on {n} of {total} reps.",
        "err_knees": "Knees travelled far past the toes on {n} of {total} reps.",
        "err_heels": "Heels came off the floor on {n} of {total} reps.",
        "err_lockout": "Incomplete lockout at the top on {n} of {total} reps.",
        "err_hips_low": "Hips started too low on {n} of {total} reps; this turned the lift into a squat.",
        "ok_depth": "Good squat depth on {n} of {total} reps.",
        "ok_lean": "Torso stayed upright through the movement.",
        "ok_heels": "Heels stayed planted.",
        "ok_lockout": "Full hip extension at the top of every rep.",
        "ok_consistent": "Very consistent range of motion between reps.",
        "tip_depth": "Sit back and down until your thighs are at least parallel to the floor.",
        "tip_lean": "Keep your chest up and brace your core; push the knees out as you descend.",
        "tip_knees": "Shift your weight to the mid-foot and send the hips back first.",
        "tip_heels": "Keep your weight over the mid-foot; work on ankle mobility if heels keep lifting.",
        "tip_lockout": "Finish each rep by squeezing the glutes until your hips are fully extended.",
        "tip_hips_low": "Start with the hips higher; a deadlift is a hinge, not a squat.",
        "tip_good": "Solid technique. Add load gradually and keep the same control.",
        "calib_long": "Long femur relative to the shin (ratio {r}); more forward torso lean is normal for you.",
        "calib_short": "Short femur relative to the shin (ratio {r}); an upright torso is natural for you.",
        "calib_avg": "Average thigh to shin proportions (ratio {r}).",
        "calib_unknown": "Body proportions could not be measured.",
    },
    "ru": {
        "no_data": "В видео недостаточно данных о позе.",
        "no_data_tip": "Снимайте сбоку, держите все тело в кадре и проверьте освещение.",
        "no_reps": "Ни одного полного повторения не обнаружено.",
        "no_reps_tip": "Начните из положения стоя, выполните движение полностью и вернитесь в стойку.",
        "err_depth": "Недостаточная глубина в {n} из {total} повторений.",
        "err_lean": "Сильный наклон корпуса вперед в {n} из {total} повторений.",
        "err_knees": "Колени сильно выходят за носки в {n} из {total} повторений.",
        "err_heels": "Пятки отрываются от пола в {n} из {total} повторений.",
        "err_lockout": "Неполное разгибание вверху в {n} из {total} повторений.",
        "err_hips_low": "Таз в начале слишком низко в {n} из {total} повторений, тяга превращается в присед.",
        "ok_depth": "Хорошая глубина приседа в {n} из {total} повторений.",
        "ok_lean": "Корпус остается прямым на протяжении движения.",
        "ok_heels": "Пятки остаются на полу.",
        "ok_lockout": "Полное разгибание таза вверху в каждом повторении.",
        "ok_consistent": "Очень стабильная амплитуда между повторениями.",
        "tip_depth": "Садитесь назад и вниз, пока бедра не станут параллельны полу.",
        "tip_lean": "Держите грудь поднятой, напрягите корпус и разводите колени при спуске.",
        "tip_knees": "Перенесите вес на середину стопы и сначала отводите таз назад.",
        "tip_heels": "Держите вес над серединой стопы; поработайте над подвижностью голеностопа.",
        "tip_lockout": "Завершайте повторение, сжимая ягодицы до полного разгибания таза.",
        "tip_hips_low": "Начинайте с более высоким тазом: становая тяга - это наклон, а не присед.",
        "tip_good": "Хорошая техника. Добавляйте вес постепенно и сохраняйте контроль.",
        "calib_long": "Длинное бедро относительно голени (соотношение {r}); больший наклон корпуса для вас нормален.",
        "calib_short": "Короткое бедро относительно голени (соотношение {r}); прямой корпус для вас естественен.",
        "calib_avg": "Средние пропорции бедра и голени (соотношение {r}).",
        "calib_unknown": "Пропорции тела определить не удалось.",
    },
}


def _msg(language: str, key: str, exercise: Optional[str] = None, **kw: Any) -> str:
    """Exercise specific text first, then the shared (squat / deadlift) table."""
    specific = EX_MESSAGES.get(exercise or "", {}).get(language, {})
    if key in specific:
        return specific[key].format(**kw)
    return MESSAGES.get(language, MESSAGES["en"])[key].format(**kw)


def has_message(language: str, key: str, exercise: Optional[str] = None) -> bool:
    return key in EX_MESSAGES.get(exercise or "", {}).get(language, {}) or key in MESSAGES.get(language, {})


def _smooth(values: List[Optional[float]], window: int = 5) -> List[Optional[float]]:
    out: List[Optional[float]] = []
    half = window // 2
    for i in range(len(values)):
        chunk = [v for v in values[max(0, i - half): i + half + 1] if v is not None]
        out.append(sum(chunk) / len(chunk) if chunk else None)
    return out


def _usable(frame: Dict[str, Any], required: Optional[tuple] = None) -> bool:
    conf = frame.get("confidence") or {}
    if required:
        conf = {k: v for k, v in conf.items() if k in required}
    return bool(conf) and sum(conf.values()) / len(conf) >= MIN_CONFIDENCE


def segment_reps(
    signal: List[Optional[float]], enter: float, rest: float = TOP_ANGLE, mode: str = "dip"
) -> List[Dict[str, int]]:
    """Find repetitions as rest -> excursion past ``enter`` -> rest cycles of ``signal``.

    ``dip`` signals start high and dive below ``enter``; ``peak`` signals start low
    and rise above ``enter``. The returned ``bottom`` is the index of the extreme.
    """
    if mode == "peak":  # mirror the signal so one state machine serves both
        signal = [None if v is None else -v for v in signal]
        rest, enter = -rest, -enter
    reps: List[Dict[str, int]] = []
    state = "wait_top"
    start = bottom = 0
    bottom_val = math.inf
    for i, v in enumerate(signal):
        if v is None:
            continue
        if state == "wait_top":
            if v >= rest:
                state, start = "up", i
        elif state == "up":
            if v >= rest:
                start = i
            elif v < enter:
                state, bottom, bottom_val = "down", i, v
        elif state == "down":
            if v < bottom_val:
                bottom, bottom_val = i, v
            if v >= rest:
                reps.append({"start": start, "bottom": bottom, "end": i})
                state, start, bottom_val = "up", i, math.inf
    return reps


def _proportions(frames: List[Dict[str, Any]]) -> Optional[float]:
    for f in frames:
        j = f.get("joints", {})
        if not all(k in j for k in ("hip", "knee", "ankle")) or not _usable(f):
            continue
        knee_angle = f.get("angles", {}).get("knee_angle", 0)
        if knee_angle < 165:
            continue
        thigh = ((j["hip"]["x"] - j["knee"]["x"]) ** 2 + (j["hip"]["y"] - j["knee"]["y"]) ** 2) ** 0.5
        shank = ((j["ankle"]["x"] - j["knee"]["x"]) ** 2 + (j["ankle"]["y"] - j["knee"]["y"]) ** 2) ** 0.5
        if shank > 0:
            return thigh / shank
    return None


def _spec_for(exercise: str) -> Spec:
    return SPECS.get(exercise) or SPECS["squat"]


def deepest_frame(frames: List[Dict[str, Any]], exercise: str) -> Optional[Dict[str, Any]]:
    """Frame at the extreme of the movement: used for the pose preview in the UI.

    Lowest signal angle for ``dip`` exercises, highest for ``peak`` exercises and
    the frame with the most bent body line for the plank.
    """
    spec = _spec_for(exercise)
    if spec.mode == "hold":
        held = [f for f in frames if _in_plank(f, spec)]
        return min(held, key=lambda f: f["angles"]["body_line"]) if held else None  # the weakest moment
    candidates = [f for f in frames if spec.signal in f.get("angles", {}) and _usable(f, spec.required)]
    if not candidates:
        return None
    pick = max if spec.mode == "peak" else min
    return pick(candidates, key=lambda f: f["angles"][spec.signal])


def analyze_local(
    exercise: str, frames: List[Dict[str, Any]], language: str = "en"
) -> Dict[str, Any]:
    language = language if language in MESSAGES else "en"
    spec = _spec_for(exercise)
    ex = spec.id
    if spec.mode == "hold":
        return _analyze_hold(spec, frames, language)

    usable = [f for f in frames if _usable(f, spec.required) and spec.signal in f.get("angles", {})]
    if len(usable) < 3:
        return _empty(spec, language, "no_data", "no_data_tip")

    signal = _smooth([f["angles"].get(spec.signal) if _usable(f, spec.required) else None for f in frames])
    reps = segment_reps(signal, spec.enter, spec.rest, spec.mode)
    if not reps:
        return _empty(spec, language, "no_reps", "no_reps_tip")

    ratio = _proportions(frames) if spec.calibrate else None
    base = {"heel_y": next((f["joints"]["heel"]["y"] for f in frames if "heel" in f.get("joints", {})), None)}

    details: List[Dict[str, Any]] = []
    flags = {c.key: 0 for c in spec.checks}

    for n, rep in enumerate(reps, start=1):
        ctx = RepContext(spec, frames, signal, rep, base)
        issues: List[str] = []
        penalty = 0.0
        for check in spec.checks:
            cost = check.fn(ctx)
            if cost:
                issues.append(check.key)
                penalty += cost
                flags[check.key] += 1
        details.append(
            {
                "index": n,
                "min_angle": round(ctx.value, 1),
                "score": round(max(0.0, 100.0 - penalty)),
                "issues": issues,
                # Coaching text for the checks this repetition failed, in the requested language.
                "issue_tips": [_msg(language, f"tip_{k}", ex) for k in issues if has_message(language, f"tip_{k}", ex)],
            }
        )

    total = len(reps)
    score = round(sum(d["score"] for d in details) / total)

    order = [c.key for c in spec.checks]
    errors = [_msg(language, f"err_{k}", ex, n=flags[k], total=total) for k in order if flags[k]]
    errors = errors[:3]

    strengths: List[str] = []
    for k in order:
        template = EX_MESSAGES.get(ex, {}).get("en", MESSAGES["en"]).get(f"ok_{k}")
        if template is None:
            continue
        if "{n}" in template:  # count style: "good on n of total reps"
            if total - flags[k] > 0:
                strengths.append(_msg(language, f"ok_{k}", ex, n=total - flags[k], total=total))
        elif not flags[k]:
            strengths.append(_msg(language, f"ok_{k}", ex))
    mins = [d["min_angle"] for d in details]
    if total >= 3 and statistics.pstdev(mins) < 8:
        strengths.append(_msg(language, "ok_consistent"))

    tip_key = next((k for k in order if flags[k]), None)
    coach_tip = _msg(language, f"tip_{tip_key}", ex) if tip_key else _msg(language, "tip_good")

    if not spec.calibrate:
        notes = ""
    elif ratio is None:
        notes = _msg(language, "calib_unknown")
    else:
        r = f"{ratio:.2f}"
        notes = _msg(language, "calib_long" if ratio > 1.1 else "calib_short" if ratio < 0.9 else "calib_avg", r=r)

    return {
        "exercise": ex,
        "signal": spec.signal,
        "mode": "reps",
        "total_reps": total,
        "score": score,
        "errors": errors,
        "strengths": strengths,
        "coach_tip": coach_tip,
        "calibration_notes": notes,
        "rep_details": details,
        "engine": "local",
    }


# --- plank (timed hold) -----------------------------------------------------

PLANK_MIN_TORSO_LEAN = 55.0   # shoulder-hip line must be close to horizontal
PLANK_LINE_OK = 160.0         # shoulder-hip-ankle angle at or above this counts as straight
PLANK_FLAG_SHARE = 0.25       # an issue is reported when it covers this share of the hold
PLANK_MIN_HOLD_S = 10.0
PLANK_INTERVAL_S = 5.0


def _in_plank(frame: Dict[str, Any], spec: Spec) -> bool:
    ang = frame.get("angles", {})
    return (
        _usable(frame, spec.required)
        and "body_line" in ang
        and ang.get("torso_lean", 0) >= PLANK_MIN_TORSO_LEAN
    )


def _plank_shoulders_off(frame: Dict[str, Any]) -> bool:
    """Shoulder not stacked over the supporting elbow (forearm plank) or wrist (high plank)."""
    j = frame.get("joints", {})
    if not all(k in j for k in ("shoulder", "elbow", "wrist")):
        return False
    elbow_angle = frame.get("angles", {}).get("elbow_angle", 90)
    support = j["wrist"] if elbow_angle > 140 else j["elbow"]
    upper = math.hypot(j["shoulder"]["x"] - j["elbow"]["x"], j["shoulder"]["y"] - j["elbow"]["y"])
    return upper > 0 and abs(j["shoulder"]["x"] - support["x"]) > 0.4 * upper


def _analyze_hold(spec: Spec, frames: List[Dict[str, Any]], language: str) -> Dict[str, Any]:
    ex = spec.id
    held = [(i, f) for i, f in enumerate(frames) if _in_plank(f, spec)]
    if len(held) < 3:
        return _empty(spec, language, "no_plank", "no_plank_tip", hold=True)

    def dt_ms(i: int) -> float:
        cur, nxt = frames[i].get("t_ms"), frames[i + 1].get("t_ms") if i + 1 < len(frames) else None
        if cur is not None and nxt is not None and 0 < nxt - cur <= 250:
            return nxt - cur
        return 33.0

    weights = [dt_ms(i) for i, _ in held]
    total_ms = sum(weights)
    hold_s = total_ms / 1000.0

    sag_ms = pike_ms = shoulder_ms = bad_ms = 0.0
    flags_per_frame = []
    for (i, f), w in zip(held, weights):
        line = f["angles"]["body_line"]
        offset = hip_offset_from_line(f["joints"])
        sag = line < PLANK_LINE_OK and offset is not None and offset > 0
        pike = line < PLANK_LINE_OK and offset is not None and offset < 0
        off = _plank_shoulders_off(f)
        sag_ms += w * sag
        pike_ms += w * pike
        shoulder_ms += w * off
        bad = sag or pike or off
        bad_ms += w * bad
        flags_per_frame.append(bad)

    sag_share, pike_share, shoulder_share = sag_ms / total_ms, pike_ms / total_ms, shoulder_ms / total_ms
    errors: List[str] = []
    issues: List[str] = []
    if sag_share >= PLANK_FLAG_SHARE:
        issues.append("sag")
        errors.append(_msg(language, "err_sag", ex, pct=round(sag_share * 100)))
    if pike_share >= PLANK_FLAG_SHARE:
        issues.append("pike")
        errors.append(_msg(language, "err_pike", ex, pct=round(pike_share * 100)))
    if shoulder_share >= 0.5:
        issues.append("shoulders")
        errors.append(_msg(language, "err_shoulders", ex))
    if hold_s < PLANK_MIN_HOLD_S:
        issues.append("short")
        errors.append(_msg(language, "err_short", ex, s=f"{hold_s:.0f}"))

    strengths: List[str] = []
    if "sag" not in issues and "pike" not in issues:
        strengths.append(_msg(language, "ok_line", ex))
    if hold_s >= PLANK_MIN_HOLD_S:
        strengths.append(_msg(language, "ok_hold", ex, s=f"{hold_s:.0f}"))
    if "shoulders" not in issues:
        strengths.append(_msg(language, "ok_shoulders", ex))

    score = round(100 * (1 - bad_ms / total_ms))
    if "short" in issues:
        score -= 10
    score = max(0, min(100, score))

    # one score per 5 seconds of holding, so the user sees where the form broke
    intervals: List[Dict[str, Any]] = []
    acc_ms = acc_bad = 0.0
    for bad, w in zip(flags_per_frame, weights):
        acc_ms += w
        acc_bad += w * bad
        if acc_ms >= PLANK_INTERVAL_S * 1000:
            intervals.append({"index": len(intervals) + 1, "score": round(100 * (1 - acc_bad / acc_ms))})
            acc_ms = acc_bad = 0.0
    if acc_ms >= 1500:
        intervals.append({"index": len(intervals) + 1, "score": round(100 * (1 - acc_bad / acc_ms))})

    tip_key = issues[0] if issues else None
    coach_tip = _msg(language, f"tip_{tip_key}", ex) if tip_key else _msg(language, "tip_good")
    return {
        "exercise": ex,
        "signal": spec.signal,
        "mode": "hold",
        "total_reps": 0,
        "hold_seconds": round(hold_s, 1),
        "intervals": intervals,
        "score": score,
        "errors": errors[:3],
        "strengths": strengths,
        "coach_tip": coach_tip,
        "calibration_notes": "",
        "rep_details": [],
        "engine": "local",
    }


def _empty(spec: Spec, language: str, err: str, tip: str, hold: bool = False) -> Dict[str, Any]:
    return {
        "exercise": spec.id,
        "signal": spec.signal,
        "mode": "hold" if hold else "reps",
        "total_reps": 0,
        **({"hold_seconds": 0.0, "intervals": []} if hold else {}),
        "score": 0,
        "errors": [_msg(language, err, spec.id)],
        "strengths": [],
        "coach_tip": _msg(language, tip, spec.id),
        "calibration_notes": "",
        "rep_details": [],
        "engine": "local",
    }
