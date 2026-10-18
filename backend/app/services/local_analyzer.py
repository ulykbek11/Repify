"""Deterministic, rule-based exercise analysis.

Works from per-frame joint angles (see ``pose_features.build_frames``). It is
used when no Gemini key is configured, when Gemini fails, and as the reference
implementation in tests. Output has the same shape as the Gemini analyzer.

Heuristics (side-view camera):
* Squat: signal is the knee angle. A repetition is a descent below 130 degrees
  from a standing position (>= 160) and back up. Depth is "full" at <= 105 degrees.
* Deadlift: signal is the hip angle (shoulder-hip-knee), same state machine with a
  125 degree threshold, plus a lockout check at the top.
"""

import statistics
from typing import Any, Dict, List, Optional

TOP_ANGLE = 160.0
SQUAT_ENTER = 130.0
SQUAT_FULL_DEPTH = 105.0
DEADLIFT_ENTER = 125.0
DEADLIFT_LOCKOUT = 165.0
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


def _msg(language: str, key: str, **kw: Any) -> str:
    table = MESSAGES.get(language, MESSAGES["en"])
    return table[key].format(**kw)


def _smooth(values: List[Optional[float]], window: int = 5) -> List[Optional[float]]:
    out: List[Optional[float]] = []
    half = window // 2
    for i in range(len(values)):
        chunk = [v for v in values[max(0, i - half): i + half + 1] if v is not None]
        out.append(sum(chunk) / len(chunk) if chunk else None)
    return out


def _usable(frame: Dict[str, Any]) -> bool:
    conf = frame.get("confidence") or {}
    return bool(conf) and sum(conf.values()) / len(conf) >= MIN_CONFIDENCE


def segment_reps(signal: List[Optional[float]], enter: float) -> List[Dict[str, int]]:
    """Find repetitions as top -> below ``enter`` -> top cycles of ``signal``."""
    reps: List[Dict[str, int]] = []
    state = "wait_top"
    start = bottom = 0
    bottom_val = 999.0
    for i, v in enumerate(signal):
        if v is None:
            continue
        if state == "wait_top":
            if v >= TOP_ANGLE:
                state, start = "up", i
        elif state == "up":
            if v >= TOP_ANGLE:
                start = i
            elif v < enter:
                state, bottom, bottom_val = "down", i, v
        elif state == "down":
            if v < bottom_val:
                bottom, bottom_val = i, v
            if v >= TOP_ANGLE:
                reps.append({"start": start, "bottom": bottom, "end": i})
                state, start, bottom_val = "up", i, 999.0
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


def deepest_frame(frames: List[Dict[str, Any]], exercise: str) -> Optional[Dict[str, Any]]:
    """Frame with the lowest signal angle: used for the pose preview in the UI."""
    key = "hip_angle" if exercise == "deadlift" else "knee_angle"
    candidates = [f for f in frames if key in f.get("angles", {}) and _usable(f)]
    return min(candidates, key=lambda f: f["angles"][key]) if candidates else None


def analyze_local(
    exercise: str, frames: List[Dict[str, Any]], language: str = "en"
) -> Dict[str, Any]:
    language = language if language in MESSAGES else "en"
    is_deadlift = exercise == "deadlift"
    key = "hip_angle" if is_deadlift else "knee_angle"
    enter = DEADLIFT_ENTER if is_deadlift else SQUAT_ENTER

    usable = [f for f in frames if _usable(f) and key in f.get("angles", {})]
    if len(usable) < 3:
        return _empty(language, "no_data", "no_data_tip")

    signal = _smooth([f["angles"].get(key) if _usable(f) else None for f in frames])
    reps = segment_reps(signal, enter)
    if not reps:
        return _empty(language, "no_reps", "no_reps_tip")

    ratio = _proportions(frames)
    base_heel = next((f["joints"]["heel"]["y"] for f in frames if "heel" in f.get("joints", {})), None)

    details: List[Dict[str, Any]] = []
    flags = {"depth": 0, "lean": 0, "knees": 0, "heels": 0, "lockout": 0, "hips_low": 0}

    for n, rep in enumerate(reps, start=1):
        bf = frames[rep["bottom"]]
        j, ang = bf.get("joints", {}), bf.get("angles", {})
        issues: List[str] = []
        penalty = 0.0
        min_signal = signal[rep["bottom"]] or 0.0

        if is_deadlift:
            top_hip = max(
                (frames[i]["angles"].get("hip_angle", 0) for i in range(rep["bottom"], rep["end"] + 1)),
                default=0,
            )
            if top_hip < DEADLIFT_LOCKOUT:
                issues.append("lockout")
                penalty += min(20.0, (DEADLIFT_LOCKOUT - top_hip) * 1.5)
            if ang.get("knee_angle", 180) < 85:
                issues.append("hips_low")
                penalty += 12
        else:
            if min_signal > SQUAT_FULL_DEPTH:
                issues.append("depth")
                penalty += min(35.0, 5.0 + (min_signal - SQUAT_FULL_DEPTH) * 1.5)
            if ang.get("torso_lean", 0) > 60:
                issues.append("lean")
                penalty += 10
            if all(k in j for k in ("knee", "foot_index", "heel")):
                facing = 1 if j["foot_index"]["x"] >= j["heel"]["x"] else -1
                if (j["knee"]["x"] - j["foot_index"]["x"]) * facing > 0.04:
                    issues.append("knees")
                    penalty += 6
            if base_heel is not None and "heel" in j and base_heel - j["heel"]["y"] > 0.025:
                issues.append("heels")
                penalty += 10

        for issue in issues:
            flags[issue] += 1
        details.append(
            {
                "index": n,
                "min_angle": round(min_signal, 1),
                "score": round(max(0.0, 100.0 - penalty)),
                "issues": issues,
            }
        )

    total = len(reps)
    score = round(sum(d["score"] for d in details) / total)

    order = ["lockout", "hips_low"] if is_deadlift else ["depth", "lean", "knees", "heels"]
    errors = [_msg(language, f"err_{k}", n=flags[k], total=total) for k in order if flags[k]]
    errors = errors[:3]

    strengths: List[str] = []
    if is_deadlift:
        if not flags["lockout"]:
            strengths.append(_msg(language, "ok_lockout"))
    else:
        if total - flags["depth"] > 0:
            strengths.append(_msg(language, "ok_depth", n=total - flags["depth"], total=total))
        if not flags["lean"]:
            strengths.append(_msg(language, "ok_lean"))
        if not flags["heels"]:
            strengths.append(_msg(language, "ok_heels"))
    mins = [d["min_angle"] for d in details]
    if total >= 3 and statistics.pstdev(mins) < 8:
        strengths.append(_msg(language, "ok_consistent"))

    tip_key = next((k for k in order if flags[k]), None)
    coach_tip = _msg(language, f"tip_{tip_key}") if tip_key else _msg(language, "tip_good")

    if ratio is None:
        notes = _msg(language, "calib_unknown")
    else:
        r = f"{ratio:.2f}"
        notes = _msg(language, "calib_long" if ratio > 1.1 else "calib_short" if ratio < 0.9 else "calib_avg", r=r)

    return {
        "total_reps": total,
        "score": score,
        "errors": errors,
        "strengths": strengths,
        "coach_tip": coach_tip,
        "calibration_notes": notes,
        "rep_details": details,
        "engine": "local",
    }


def _empty(language: str, err: str, tip: str) -> Dict[str, Any]:
    return {
        "total_reps": 0,
        "score": 0,
        "errors": [_msg(language, err)],
        "strengths": [],
        "coach_tip": _msg(language, tip),
        "calibration_notes": "",
        "rep_details": [],
        "engine": "local",
    }
