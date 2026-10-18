"""HTTP API: pose extraction and exercise analysis."""

import logging
import os
import shutil
import tempfile
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.config import settings
from app.services import gemini_analyzer
from app.services import exercises as exercise_registry
from app.services.local_analyzer import analyze_local, deepest_frame
from app.services.pose_features import build_frames, landmarks_to_named

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["analysis"])


class Landmark(BaseModel):
    x: float
    y: float
    z: float = 0.0
    visibility: float = 0.0


class Frame(BaseModel):
    landmarks: List[Landmark]
    timestamp: Optional[float] = None


class AnalyzeRequest(BaseModel):
    user_id: Optional[str] = None
    exercise: str = "squats"
    pose_sequence: List[Frame]
    user_height_cm: Optional[int] = Field(default=None, ge=80, le=250)
    camera_angle: str = "side_profile"
    language: str = "en"


def normalize_exercise(raw: str) -> str:
    """Map a free-form name ("squats", "Bench press", "подтягивания") to an exercise id."""
    exercise = exercise_registry.normalize_exercise(raw)
    if exercise is None:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown exercise '{raw}'. Supported: {', '.join(exercise_registry.EXERCISE_IDS)}",
        )
    return exercise


def run_analysis(
    exercise: str,
    pose_sequence: List[Frame],
    camera_angle: str = "side_profile",
    user_height_cm: Optional[int] = None,
    language: str = "en",
) -> Dict[str, Any]:
    """Frames -> angles -> Gemini (if configured) or the local analyzer."""
    valid = [f for f in pose_sequence if len(f.landmarks) >= 33]
    named = [landmarks_to_named([lm.model_dump() for lm in f.landmarks]) for f in valid]
    if len(named) < 3:
        raise HTTPException(status_code=400, detail="At least 3 frames with 33 landmarks are required")

    frames = build_frames(named, timestamps=[f.timestamp for f in valid])
    result: Optional[Dict[str, Any]] = None
    if gemini_analyzer.is_configured():
        try:
            result = gemini_analyzer.analyze_with_gemini(exercise, camera_angle, frames, user_height_cm, language)
        except gemini_analyzer.GeminiError as exc:
            logger.warning("Falling back to the local analyzer: %s", exc)
    if result is None:
        result = analyze_local(exercise, frames, language)

    preview = deepest_frame(frames, exercise)
    result["pose_preview"] = (
        {"joints": preview["joints"], "angles": preview["angles"], "frame_idx": preview["frame_idx"]}
        if preview
        else None
    )
    result["frames_analyzed"] = len(frames)
    spec = exercise_registry.SPECS[exercise]
    result.setdefault("exercise", exercise)
    result.setdefault("signal", spec.signal)
    result.setdefault("mode", "hold" if spec.mode == "hold" else "reps")
    return result


@router.post("/analyze", summary="Analyse a pose sequence")
async def analyze(request: AnalyzeRequest) -> Dict[str, Any]:
    return run_analysis(
        normalize_exercise(request.exercise),
        request.pose_sequence,
        request.camera_angle,
        request.user_height_cm,
        request.language,
    )


@router.get("/exercises", summary="Supported exercises, camera view and what is checked")
async def list_exercises() -> List[Dict[str, Any]]:
    return exercise_registry.describe()


@router.post("/extract-poses", summary="Extract MediaPipe poses from a video")
async def extract_poses(video: UploadFile = File(...)) -> Dict[str, Any]:
    from app.services.pose_features import LANDMARK_NAMES
    from app.services.video_processor import VideoProcessor

    limit = settings.max_upload_mb * 1024 * 1024
    fd, path = tempfile.mkstemp(suffix=".mp4")
    try:
        size = 0
        with os.fdopen(fd, "wb") as out:
            while chunk := await video.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(status_code=413, detail=f"Video larger than {settings.max_upload_mb} MB")
                out.write(chunk)

        try:
            poses = VideoProcessor().extract_poses(path)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        if not poses:
            raise HTTPException(status_code=422, detail="No person detected in the video")

        zero = {"x": 0.0, "y": 0.0, "z": 0.0, "visibility": 0.0}
        return {
            "pose_sequence": [
                {"landmarks": [p.get(n, zero) for n in LANDMARK_NAMES], "timestamp": p.get("_t_ms", i * 33)}
                for i, p in enumerate(poses)
            ]
        }
    finally:
        if os.path.exists(path):
            os.remove(path)
