"""
Compatibility API — эндпоинты, соответствующие запросам фронтенда.

Остались только:
- /api/analyze (Единый анализ через Gemini)
- /api/profile/{user_id}/exists
- /api/extract-poses (Извлечение ключевых точек из видео)
"""

import logging
import os
import shutil
import tempfile
import cv2
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.calibration import CalibrationProfile
from app.services.video_processor import VideoProcessor
from app.services.gemini_analyzer import analyze_exercise

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Frontend Compatibility"])

# =============================================================================
# Pydantic models
# =============================================================================

class FrontendLandmark(BaseModel):
    x: float
    y: float
    z: float = 0.0
    visibility: float = 0.0

class FrontendFrame(BaseModel):
    landmarks: List[FrontendLandmark]
    timestamp: Optional[float] = None

class UnifiedAnalyzeRequest(BaseModel):
    user_id: str
    exercise: str = "squats"
    pose_sequence: List[FrontendFrame]
    user_height_cm: Optional[int] = None
    camera_angle: str = "side_profile"

# =============================================================================
# MediaPipe 33 landmark индексы → имена
# =============================================================================

MEDIAPIPE_LANDMARK_NAMES = [
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

def _normalize_exercise(raw: str) -> str:
    raw = raw.lower().strip()
    if raw in ("squats", "squat", "присед", "приседания"):
        return "squat"
    if raw in ("deadlifts", "deadlift", "тяга", "становая"):
        return "deadlift"
    return "squat"

def _landmarks_array_to_dict(landmarks: List[FrontendLandmark]) -> Dict[str, Dict[str, float]]:
    result = {}
    for i, lm in enumerate(landmarks):
        if i < len(MEDIAPIPE_LANDMARK_NAMES):
            name = MEDIAPIPE_LANDMARK_NAMES[i]
            result[name] = {"x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility}
    return result

# Ключевые суставы для анализа - мы передаем только их
_ANALYSIS_JOINTS = ["hip", "knee", "ankle", "shoulder", "heel", "foot_index"]

def _determine_visible_side(frame: Dict[str, Dict[str, float]]) -> str:
    left_vis = []
    right_vis = []
    for joint in _ANALYSIS_JOINTS:
        l_key = f"left_{joint}"
        r_key = f"right_{joint}"
        if l_key in frame and "visibility" in frame[l_key]:
            left_vis.append(frame[l_key]["visibility"])
        if r_key in frame and "visibility" in frame[r_key]:
            right_vis.append(frame[r_key]["visibility"])

    avg_left = sum(left_vis) / len(left_vis) if left_vis else 0
    avg_right = sum(right_vis) / len(right_vis) if right_vis else 0
    return "left" if avg_left >= avg_right else "right"

import math

def _calculate_angle(p1: Dict[str, float], p2: Dict[str, float], p3: Dict[str, float]) -> float:
    """
    Вычисляет угол между тремя точками (p1 -> p2 -> p3).
    p2 - вершина угла.
    Возвращает угол в градусах (0-180).
    """
    # Вектор BA (p2 -> p1)
    ba_x = p1["x"] - p2["x"]
    ba_y = p1["y"] - p2["y"]
    
    # Вектор BC (p2 -> p3)
    bc_x = p3["x"] - p2["x"]
    bc_y = p3["y"] - p2["y"]
    
    # Скалярное произведение
    dot_product = ba_x * bc_x + ba_y * bc_y
    
    # Длины векторов
    len_ba = math.sqrt(ba_x**2 + ba_y**2)
    len_bc = math.sqrt(bc_x**2 + bc_y**2)
    
    if len_ba * len_bc == 0:
        return 0.0
        
    # Косинус угла
    cosine = dot_product / (len_ba * len_bc)
    
    # Ограничиваем диапазон для acos [-1, 1]
    cosine = max(-1.0, min(1.0, cosine))
    
    angle_rad = math.acos(cosine)
    return math.degrees(angle_rad)


def _build_gemini_payload(frames: List[Dict[str, Dict[str, float]]], exercise_type: str) -> List[Dict[str, Any]]:
    print(f"\n🔧 [BUILD_PAYLOAD] Формирую payload для Gemini из {len(frames)} кадров")
    side = _determine_visible_side(frames[0]) if frames else "left"
    print(f"   👁️  Видимая сторона: {side}")

    gemini_frames = []
    for idx, frame in enumerate(frames):
        joints = {}
        confidence = {}
        
        # Извлекаем координаты
        for joint in _ANALYSIS_JOINTS:
            key = f"{side}_{joint}"
            if key in frame:
                pt = frame[key]
                joints[joint] = {
                    "x": round(pt["x"], 4),
                    "y": round(pt["y"], 4),
                    "visibility": round(pt.get("visibility", 0), 3),
                }
                confidence[joint] = round(pt.get("visibility", 0), 3)

        # Вычисляем углы, если есть необходимые точки
        angles = {}
        if "hip" in joints and "knee" in joints and "ankle" in joints:
            knee_angle = _calculate_angle(joints["hip"], joints["knee"], joints["ankle"])
            angles["knee_angle"] = round(knee_angle, 1)
            
        if "shoulder" in joints and "hip" in joints and "knee" in joints:
            hip_angle = _calculate_angle(joints["shoulder"], joints["hip"], joints["knee"])
            angles["hip_angle"] = round(hip_angle, 1)

        gemini_frames.append({
            "frame_idx": idx,
            "joints": joints,
            "angles": angles,
            "confidence": confidence,
        })
    print(f"   ✅ Формирование сырых данных для Gemini завершено")
    return gemini_frames


# =============================================================================
# Эндпоинты
# =============================================================================

@router.post(
    "/analyze",
    summary="Единый анализ сырых данных через Gemini AI",
)
async def analyze_unified(request: UnifiedAnalyzeRequest) -> Dict[str, Any]:
    import time as _time

    print(f"\n{'='*60}")
    print(f"📥 [/api/analyze] НОВЫЙ ЗАПРОС КО ГЕМИНИ")
    print(f"   user_id: {request.user_id}")
    print(f"   exercise: {request.exercise}")

    if not request.user_id or request.user_id.strip() == "":
        raise HTTPException(status_code=400, detail="user_id не может быть пустым")

    try:
        exercise_type = _normalize_exercise(request.exercise)
        t0 = _time.time()
        
        frames = []
        for frame in request.pose_sequence:
            if len(frame.landmarks) >= 33:
                frames.append(_landmarks_array_to_dict(frame.landmarks))
                
        if len(frames) < 3:
            raise HTTPException(status_code=400, detail="Недостаточно кадров для анализа.")

        # Мы создаем чистый сырой слепок только необходимых координат для Gemini
        gemini_frames = _build_gemini_payload(frames, exercise_type)
        
        result = analyze_exercise(
            exercise=exercise_type,
            camera_angle=request.camera_angle,
            frames=gemini_frames,
            user_height_cm=request.user_height_cm,
        )
        
        total_elapsed = (_time.time() - t0) * 1000
        print(f"\n✅ [/api/analyze] ЗАВЕРШЕНО за {total_elapsed:.0f}ms")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analyze error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/profile/{user_id}/exists",
    summary="Проверить наличие калибровочного профиля",
)
async def check_profile_exists(user_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    profile = db.query(CalibrationProfile).filter(CalibrationProfile.user_id == user_id).first()
    return {"exists": profile is not None, "user_id": user_id}


@router.post(
    "/extract-poses",
    summary="Извлечь позы из видео",
)
async def extract_poses_frontend(video: UploadFile = File(...)) -> Dict[str, Any]:
    print(f">>> [UPLOAD] Начало загрузки видео: {video.filename}")
    temp_file_path = None
    try:
        temp_fd, temp_file_path = tempfile.mkstemp(suffix=".mp4")
        with os.fdopen(temp_fd, 'wb') as f:
            shutil.copyfileobj(video.file, f, length=1024 * 1024)
            
        cap = cv2.VideoCapture(temp_file_path)
        if not cap.isOpened():
            return JSONResponse(status_code=400, content={"error": "Invalid video format"})
        cap.release()

        processor = VideoProcessor()
        # Выборочный анализ для Gemini: стараемся получить около 30 FPS
        # Лимит увеличен до 3000 кадров (поддержка длинных видео)
        backend_frames = processor.extract_poses(temp_file_path, target_fps=30, target_frames=3000)
        
        if not backend_frames:
            raise ValueError("В видео не найдены люди или кадры")

        frontend_frames = []
        for idx, b_frame in enumerate(backend_frames):
            lm_list = []
            for name in MEDIAPIPE_LANDMARK_NAMES:
                val = b_frame.get(name, {"x": 0.0, "y": 0.0, "z": 0.0, "visibility": 0.0})
                lm_list.append({
                    "x": val["x"],
                    "y": val["y"],
                    "z": val.get("z", 0.0),
                    "visibility": val.get("visibility", 0.0)
                })
            frontend_frames.append({
                "landmarks": lm_list,
                "timestamp": idx * 33
            })

        return {"pose_sequence": frontend_frames}

    except Exception as e:
        logger.error(f"Ошибка процессинга видео: {e}", exc_info=True)
        return JSONResponse(status_code=400, content={"error": str(e)})
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
