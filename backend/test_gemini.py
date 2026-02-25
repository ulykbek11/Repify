from app.config import settings
from app.services.gemini_analyzer import analyze_workout

print(settings.gemini_api_key)

try:
    pose_sequence = [{"left_knee": {"x": 0.5, "y": 0.5, "z": 0.5}, "left_hip": {"x": 0.5, "y": 0.5, "z": 0.5}}]
    res = analyze_workout(pose_sequence, None)
    print("RES:", res)
except Exception as e:
    print("ERR:", e)
