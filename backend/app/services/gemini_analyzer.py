"""Gemini-backed exercise analysis.

The model receives compact per-frame joint data (not video) and returns a JSON
verdict: repetition count, score, errors, strengths and a coaching tip.
"""

import json
import logging
from typing import Any, Dict, List, Optional

from app.config import settings
from app.services.exercises import SPECS

logger = logging.getLogger(__name__)

LANGUAGE_NAMES = {"en": "English", "ru": "Russian"}


class GeminiError(RuntimeError):
    pass


def is_configured() -> bool:
    return bool(settings.gemini_api_key)


def build_prompt(
    exercise: str,
    camera_angle: str,
    frames: List[Dict[str, Any]],
    user_height_cm: Optional[int],
    language: str,
) -> str:
    payload: Dict[str, Any] = {
        "exercise": exercise,
        "camera_angle": camera_angle,
        "total_frames": len(frames),
        "frames": frames,
    }
    if user_height_cm:
        payload["user_height_cm"] = user_height_cm
    lang = LANGUAGE_NAMES.get(language, "English")
    height = f"User height: {user_height_cm} cm." if user_height_cm else "User height unknown."

    spec = SPECS.get(exercise)
    if spec is None:
        guidance = "Judge the technique from the joint angles."
    elif spec.mode == "hold":
        guidance = (
            "This is a timed hold, not a repetition exercise. Report total_reps as 0. "
            "Judge the straightness of the shoulder-hip-ankle line (body_line close to 180 is straight, "
            "hips sagging or piking below ~160 is a fault) and whether the shoulders stay over the elbows. "
            "Use t_ms (milliseconds) to time the hold and mention the hold time in strengths or errors."
        )
    else:
        direction = (
            f"falls from about {spec.rest:.0f} (start position) below {spec.enter:.0f}"
            if spec.mode == "dip"
            else f"rises from about {spec.rest:.0f} (start position) above {spec.enter:.0f}"
        )
        guidance = (
            f"Count repetitions with {spec.signal_label}: a repetition is a full cycle in which the signal "
            f"{direction} and returns to the start position. Required camera view: {spec.camera}. "
            f"Typical form checks for this exercise: {', '.join(c.key for c in spec.checks)}."
        )

    return f"""You are a strength-training biomechanics coach.
Analyse the "{exercise}" recorded from a {camera_angle} camera. {height}

{guidance}
Joint names are for the body side the camera sees best. knee_angle is hip-knee-ankle, hip_angle is
shoulder-hip-knee, elbow_angle is shoulder-elbow-wrist, body_line is shoulder-hip-ankle and torso_lean is the
torso inclination from vertical. Image y points down.
For squat, deadlift, Romanian deadlift and lunge, estimate the thigh/shin proportion from the upright frames:
a long femur makes more forward torso lean normal, not an error.
Ignore frames whose confidence is below 0.5. Do not count unfinished movements.
Do NOT judge what a single side view cannot show (knee valgus, elbow flare, spinal rounding).

DATA:
{json.dumps(payload)}

Reply with strict JSON only, no markdown:
{{"total_reps": int, "score": int 0-100, "errors": [at most 3 short plain-language strings],
"strengths": [strings], "coach_tip": string, "calibration_notes": string}}
Write all strings in {lang}."""


MAX_PROMPT_FRAMES = 150


def analyze_with_gemini(
    exercise: str,
    camera_angle: str,
    frames: List[Dict[str, Any]],
    user_height_cm: Optional[int] = None,
    language: str = "en",
) -> Dict[str, Any]:
    if not is_configured():
        raise GeminiError("GEMINI_API_KEY is not set")

    # Keep the prompt small: a few hundred frames are plenty for rep counting, and a short prompt keeps
    # the call fast enough for a serverless request.
    step = max(1, len(frames) // MAX_PROMPT_FRAMES)
    prompt = build_prompt(exercise, camera_angle, frames[::step], user_height_cm, language)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(timeout=settings.gemini_timeout_s * 1000),
        )
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json",
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        result = parse_response(response.text or "")
    except GeminiError:
        raise
    except Exception as exc:  # network, quota, SDK errors
        logger.warning("Gemini request failed: %s", exc)
        raise GeminiError(str(exc)) from exc

    result["engine"] = "gemini"
    return result


def parse_response(text: str) -> Dict[str, Any]:
    clean = text.strip()
    if clean.startswith("```"):
        clean = clean.strip("`")
        if clean.startswith("json"):
            clean = clean[4:]
    try:
        data = json.loads(clean.strip())
    except json.JSONDecodeError as exc:
        raise GeminiError(f"Gemini returned invalid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise GeminiError("Gemini returned an unexpected JSON shape")
    data.setdefault("total_reps", 0)
    data.setdefault("score", 0)
    data.setdefault("errors", [])
    data.setdefault("strengths", [])
    data.setdefault("coach_tip", "")
    data.setdefault("calibration_notes", "")
    data.setdefault("rep_details", [])
    return data
