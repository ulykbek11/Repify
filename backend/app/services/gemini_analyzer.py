"""Gemini-backed exercise analysis.

The model receives compact per-frame joint data (not video) and returns a JSON
verdict: repetition count, score, errors, strengths and a coaching tip.
"""

import json
import logging
from typing import Any, Dict, List, Optional

from app.config import settings

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

    return f"""You are a strength-training biomechanics coach.
Analyse the "{exercise}" recorded from a {camera_angle} camera. {height}

Calibration: from the frames where the person stands upright (knee and hip angle near 170-180),
estimate the thigh/shin proportion. A long femur makes more forward torso lean normal, not an error.

Repetition counting: knee_angle (hip-knee-ankle) near 180 means standing, below ~100 is a deep squat.
hip_angle (shoulder-hip-knee) is the hinge angle. A repetition is a full cycle: top (>160), bottom, top (>160).
Ignore frames whose confidence is below 0.5. Do not count unfinished movements.

Technique checks visible from the side: depth, torso lean, knees relative to toes, heels on the floor,
spine neutrality. Do NOT judge knee valgus (not visible from the side).

DATA:
{json.dumps(payload)}

Reply with strict JSON only, no markdown:
{{"total_reps": int, "score": int 0-100, "errors": [at most 3 short plain-language strings],
"strengths": [strings], "coach_tip": string, "calibration_notes": string}}
Write all strings in {lang}."""


def analyze_with_gemini(
    exercise: str,
    camera_angle: str,
    frames: List[Dict[str, Any]],
    user_height_cm: Optional[int] = None,
    language: str = "en",
) -> Dict[str, Any]:
    if not is_configured():
        raise GeminiError("GEMINI_API_KEY is not set")

    # Keep the prompt bounded for long videos.
    step = max(1, len(frames) // 1500)
    prompt = build_prompt(exercise, camera_angle, frames[::step], user_height_cm, language)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1, response_mime_type="application/json"
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
