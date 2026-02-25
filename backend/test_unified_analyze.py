"""
Тест #2: проверяем какие именно углы бэкенд вычисляет из наших данных,
и пропускаем через Gemini с корректными данными глубокого приседа.
"""
import requests
import json
import math
import time
import sys
sys.path.insert(0, ".")

from app.utils.pose_math import get_knee_angle, get_hip_angle, calculate_torso_lean

API_URL = "http://localhost:8000"


def make_standing_landmarks():
    """Стоячая позиция — углы ~170°+"""
    return {
        "left_shoulder": {"x": 0.50, "y": 0.25, "z": -0.08},
        "right_shoulder": {"x": 0.50, "y": 0.25, "z": 0.08},
        "left_hip":      {"x": 0.50, "y": 0.50, "z": -0.06},
        "right_hip":     {"x": 0.50, "y": 0.50, "z": 0.06},
        "left_knee":     {"x": 0.50, "y": 0.72, "z": -0.04},
        "right_knee":    {"x": 0.50, "y": 0.72, "z": 0.04},
        "left_ankle":    {"x": 0.50, "y": 0.92, "z": -0.02},
        "right_ankle":   {"x": 0.50, "y": 0.92, "z": 0.02},
        "left_heel":     {"x": 0.49, "y": 0.94, "z": -0.01},
        "right_heel":    {"x": 0.51, "y": 0.94, "z": 0.01},
        "left_foot_index":  {"x": 0.52, "y": 0.94, "z": -0.03},
        "right_foot_index": {"x": 0.52, "y": 0.94, "z": 0.03},
    }


def make_squat_bottom_landmarks():
    """Нижняя точка приседа — колено ~85-90°, таз ~90°"""
    return {
        "left_shoulder": {"x": 0.42, "y": 0.45, "z": -0.08},  # наклон вперёд
        "right_shoulder": {"x": 0.42, "y": 0.45, "z": 0.08},
        "left_hip":      {"x": 0.50, "y": 0.75, "z": -0.06},  # таз сильно опущен
        "right_hip":     {"x": 0.50, "y": 0.75, "z": 0.06},
        "left_knee":     {"x": 0.60, "y": 0.75, "z": -0.04},  # колено сильно вперёд
        "right_knee":    {"x": 0.60, "y": 0.75, "z": 0.04},
        "left_ankle":    {"x": 0.50, "y": 0.92, "z": -0.02},
        "right_ankle":   {"x": 0.50, "y": 0.92, "z": 0.02},
        "left_heel":     {"x": 0.49, "y": 0.94, "z": -0.01},
        "right_heel":    {"x": 0.51, "y": 0.94, "z": 0.01},
        "left_foot_index":  {"x": 0.52, "y": 0.94, "z": -0.03},
        "right_foot_index": {"x": 0.52, "y": 0.94, "z": 0.03},
    }


def lerp_landmarks(a, b, t):
    """Интерполяция между двумя наборами landmarks"""
    result = {}
    for key in a:
        result[key] = {
            "x": a[key]["x"] + (b[key]["x"] - a[key]["x"]) * t,
            "y": a[key]["y"] + (b[key]["y"] - a[key]["y"]) * t,
            "z": a[key]["z"] + (b[key]["z"] - a[key]["z"]) * t,
        }
    return result


def landmarks_to_frontend_frame(lm, visibility=0.95):
    """Конвертирует landmark dict в фронтенд-формат (массив 33 точек)"""
    NAMES = [
        "nose", "left_eye_inner", "left_eye", "left_eye_outer",
        "right_eye_inner", "right_eye", "right_eye_outer",
        "left_ear", "right_ear", "mouth_left", "mouth_right",
        "left_shoulder", "right_shoulder",
        "left_elbow", "right_elbow", "left_wrist", "right_wrist",
        "left_pinky", "right_pinky", "left_index", "right_index",
        "left_thumb", "right_thumb",
        "left_hip", "right_hip", "left_knee", "right_knee",
        "left_ankle", "right_ankle", "left_heel", "right_heel",
        "left_foot_index", "right_foot_index",
    ]
    
    arr = []
    for name in NAMES:
        if name in lm:
            pt = lm[name]
            arr.append({
                "x": pt["x"], "y": pt["y"], "z": pt["z"],
                "visibility": visibility
            })
        else:
            arr.append({"x": 0.5, "y": 0.5, "z": 0.0, "visibility": 0.3})
    
    return {"landmarks": arr, "timestamp": None}


def test_angles_first():
    """Шаг 1: проверяем углы"""
    print("=" * 60)
    print("📐 ШАГ 1: Проверка вычисления углов из pose_math")
    print("=" * 60)
    
    standing = make_standing_landmarks()
    bottom = make_squat_bottom_landmarks()
    
    print("\n🧍 Стоячая позиция:")
    print(f"   Knee angle:  {get_knee_angle(standing, 'left'):.1f}°")
    print(f"   Hip angle:   {get_hip_angle(standing, 'left'):.1f}°")
    print(f"   Torso lean:  {calculate_torso_lean(standing):.1f}°")
    
    print("\n🏋️ Нижняя точка приседа:")
    print(f"   Knee angle:  {get_knee_angle(bottom, 'left'):.1f}°")
    print(f"   Hip angle:   {get_hip_angle(bottom, 'left'):.1f}°")
    print(f"   Torso lean:  {calculate_torso_lean(bottom):.1f}°")
    
    # Промежуточные точки
    print("\n📈 Интерполяция (phases):")
    for t in [0.0, 0.25, 0.5, 0.75, 1.0]:
        interp = lerp_landmarks(standing, bottom, t)
        ka = get_knee_angle(interp, 'left')
        ha = get_hip_angle(interp, 'left')
        tl = calculate_torso_lean(interp)
        print(f"   t={t:.2f}: knee={ka:.1f}°, hip={ha:.1f}°, torso={tl:.1f}°")


def test_unified_api():
    """Шаг 2: отправляем правильные данные на /api/analyze"""
    print("\n" + "=" * 60)
    print("🧪 ШАГ 2: Тест /api/analyze с правильными данными")
    print("=" * 60)
    
    standing = make_standing_landmarks()
    bottom = make_squat_bottom_landmarks()
    
    frames = []
    
    # 5 стоячих кадров (калибровка)
    for _ in range(5):
        frames.append(landmarks_to_frontend_frame(standing, visibility=0.95))
    
    # 3 повторения
    for rep in range(3):
        # Спуск: 6 шагов
        for i in range(1, 7):
            t = i / 6.0
            lm = lerp_landmarks(standing, bottom, t)
            frames.append(landmarks_to_frontend_frame(lm, visibility=0.93))
        
        # Нижняя точка: 2 кадра
        for _ in range(2):
            frames.append(landmarks_to_frontend_frame(bottom, visibility=0.90))
        
        # Подъём: 5 шагов
        for i in range(1, 6):
            t = 1.0 - (i / 5.0)
            lm = lerp_landmarks(standing, bottom, t)
            frames.append(landmarks_to_frontend_frame(lm, visibility=0.94))
        
        # Стоя между повторениями: 2 кадра
        for _ in range(2):
            frames.append(landmarks_to_frontend_frame(standing, visibility=0.95))
    
    print(f"\n📊 Сгенерировано: {len(frames)} кадров (5 калибровочных + 3 рипа)")
    
    payload = {
        "user_id": "test_user_456",
        "exercise": "squats",
        "pose_sequence": frames,
        "user_height_cm": 178,
        "camera_angle": "side_profile"
    }
    
    print(f"   Размер payload: {len(json.dumps(payload))} байт")
    print(f"\n🚀 Отправка POST {API_URL}/api/analyze...")
    t0 = time.time()
    
    try:
        response = requests.post(
            f"{API_URL}/api/analyze",
            json=payload,
            timeout=120
        )
        elapsed = time.time() - t0
        
        print(f"   ⏱️  Время ответа: {elapsed:.1f}с")
        print(f"   📡 Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n{'='*60}")
            print(f"✅ GEMINI AI РЕЗУЛЬТАТ:")
            print(f"{'='*60}")
            print(f"   🔢 Повторений: {result.get('total_reps', '?')}")
            print(f"   📊 Оценка техники: {result.get('score', '?')}/100")
            print(f"   ❌ Ошибки:")
            for err in result.get('errors', []):
                print(f"      • {err}")
            print(f"   ✅ Сильные стороны:")
            for s in result.get('strengths', []):
                print(f"      • {s}")
            print(f"   💡 Совет тренера: {result.get('coach_tip', '?')}")
            print(f"   🧬 Калибровка: {result.get('calibration_notes', '?')}")
        else:
            print(f"\n❌ ОШИБКА {response.status_code}:")
            print(response.text)
    
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
    
    print("=" * 60)


if __name__ == "__main__":
    test_angles_first()
    test_unified_api()
