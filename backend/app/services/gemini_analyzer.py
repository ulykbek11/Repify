"""
Gemini AI Analyzer — единый сервис анализа упражнений.

Заменяет ручные скрипты калибровки, подсчёта повторений и анализа техники.
Gemini получает сырые данные поз и самостоятельно:
  1. Проводит мини-калибровку из первых кадров (стоячая позиция)
  2. Считает повторения
  3. Анализирует технику с учётом индивидуальных пропорций
"""

import json
import logging
from typing import Dict, Any, List, Optional

import google.generativeai as genai
from app.config import settings

logger = logging.getLogger(__name__)

genai.configure(api_key=settings.gemini_api_key)


def analyze_exercise(
    exercise: str,
    camera_angle: str,
    frames: List[Dict[str, Any]],
    user_height_cm: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Единый анализ упражнения через Gemini AI.

    Args:
        exercise: Тип упражнения (squat, deadlift)
        camera_angle: Ракурс камеры (side_profile)
        frames: Покадровые данные — joints (x,y,z,visibility), angles, confidence
        user_height_cm: Рост пользователя в см (опционально)

    Returns:
        Dict с total_reps, score, errors, strengths, coach_tip, calibration_notes
    """
    print(f"\n{'='*60}")
    print(f"🤖 [GEMINI] Начинаю анализ упражнения")
    print(f"   📋 Упражнение: {exercise}")
    print(f"   📷 Ракурс: {camera_angle}")
    print(f"   📏 Рост: {user_height_cm or 'не указан'} см")
    print(f"   🎞️  Кадров получено: {len(frames)}")

    if not frames:
        print("   ❌ Нет кадров для анализа!")
        return {
            "total_reps": 0,
            "score": 0,
            "errors": ["Нет данных для анализа"],
            "strengths": [],
            "coach_tip": "Убедитесь, что камера записывает движение",
            "calibration_notes": ""
        }

    # Логируем первый кадр для отладки
    first = frames[0]
    print(f"\n   📊 Кадр #0 (превью):")
    if "confidence" in first:
        low_conf = {k: v for k, v in first["confidence"].items() if v < 0.5}
        if low_conf:
            print(f"      ⚠️  Низкая уверенность: {low_conf}")
        else:
            print(f"      ✅ Все переданные точки (ключевые) с хорошей уверенностью")

    # Подсчёт кадров с низкой уверенностью
    low_conf_frames = 0
    for f in frames:
        if "confidence" in f:
            if any(v < 0.5 for v in f["confidence"].values()):
                low_conf_frames += 1
    if low_conf_frames > 0:
        print(f"   ⚠️  Кадров с низкой уверенностью: {low_conf_frames}/{len(frames)}")

    # Формируем payload для Gemini
    # Увеличиваем лимит до 3000 кадров (поддержка длинных видео, ~100 сек при 30 FPS)
    step = max(1, len(frames) // 3000)
    sampled_frames = frames[::step]
    print(f"\n   🔄 Семплирование: {len(sampled_frames)} кадров (шаг={step})")

    payload = {
        "exercise": exercise,
        "camera_angle": camera_angle,
        "total_frames": len(frames),
        "sampled_frames": len(sampled_frames),
        "frames": sampled_frames,
    }
    if user_height_cm:
        payload["user_height_cm"] = user_height_cm

    payload_json = json.dumps(payload, ensure_ascii=False)
    print(f"   📦 Размер payload: {len(payload_json)} символов")

    # Сохраняем payload в файл для отладки
    try:
        with open("last_payload.json", "w", encoding="utf-8") as f:
            f.write(payload_json)
        print(f"   💾 Payload сохранен в файл: last_payload.json")
    except Exception as e:
        print(f"   ⚠️ Не удалось сохранить payload в файл: {e}")

    # Строим prompt
    height_info = f"Рост пользователя: {user_height_cm} см." if user_height_cm else "Рост не указан — работай с относительными координатами."

    prompt = f"""Ты — профессиональный спортивный биомеханик и тренер по силовым упражнениям.

ЗАДАЧА: Проанализируй данные упражнения "{exercise}" с камеры ({camera_angle}).

{height_info}

ИНСТРУКЦИЯ ПО КАЛИБРОВКЕ (мини-калибровка из первых кадров):
1. Найди кадры, где человек стоит прямо (максимальные углы в коленях и тазу ≈ 170-180°)
2. По этим кадрам определи:
   - Длину сегментов: Плечо→Таз, Таз→Колено, Колено→Голеностоп (в относительных координатах)
   - Отношение бедра к голени (если > 1.1 — длинное бедро, нужен больший наклон корпуса)
   - Тип телосложения: long_femur / short_femur / average
3. ВАЖНО: Если у человека длинное бедро — больший наклон корпуса вперёд это НОРМА, а не ошибка!

ИНСТРУКЦИЯ ПО ПОДСЧЁТУ ПОВТОРЕНИЙ:
1. Используй переданные значения углов (angles):
   - knee_angle (угол в колене: таз-колено-лодыжка). ~180° = стоим прямо. < 90° = глубокий сед.
   - hip_angle (угол в тазу: плечо-таз-колено). ~180° = стоим прямо.
2. Повторение = полный цикл:
   - Старт: knee_angle > 160°
   - Нижняя точка: knee_angle < 100° (или ниже, зависит от индивидуальной гибкости)
   - Финиш: knee_angle > 160°
3. Не считай незавершённые движения.
4. Учитывай confidence score — если < 0.5, кадр ненадёжный.

ИНСТРУКЦИЯ ПО АНАЛИЗУ ТЕХНИКИ:
Проверяй ТОЛЬКО то, что видно при боковой съёмке:
✅ Глубина приседа (используй knee_angle)
✅ Наклон корпуса (используй hip_angle и его соотношение с knee_angle)
✅ Положение коленей относительно носков (по оси X)
✅ Пятки на полу (heel.y vs стартовая позиция)
✅ Прямая спина (torso_angle стабильность)
❌ НЕ анализируй вальгус коленей (невидимо сбоку)

ДАННЫЕ:
{payload_json}

ОТВЕТЬ СТРОГО В ФОРМАТЕ JSON (без markdown, без ```):
{{
  "total_reps": int,
  "score": int (0-100, комплексная оценка техники),
  "errors": ["массив строк, максимум 3 ошибки, простым языком на русском, без градусов"],
  "strengths": ["массив строк, что пользователь делает правильно, на русском"],
  "coach_tip": "строка — одна главная рекомендация тренера на русском",
  "calibration_notes": "строка — краткое описание пропорций пользователя на русском (тип телосложения, особенности)"
}}"""

    print(f"\n   🚀 Отправляю запрос в Gemini...")

    try:
        # СТРОГО gemini-2.5-flash по требованию пользователя
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(temperature=0.1),
            request_options={"timeout": 600.0}
        )

        raw_text = response.text.strip()
        print(f"   ✅ Gemini ответил ({len(raw_text)} символов)")
        print(f"   📄 Сырой ответ (первые 500 символов):")
        print(f"   {raw_text[:500]}")

        # Очистка от markdown обёрток
        clean_text = raw_text
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.startswith("```"):
            clean_text = clean_text[3:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
        clean_text = clean_text.strip()

        result = json.loads(clean_text)

        # Валидация обязательных полей
        result.setdefault("total_reps", 0)
        result.setdefault("score", 0)
        result.setdefault("errors", [])
        result.setdefault("strengths", [])
        result.setdefault("coach_tip", "")
        result.setdefault("calibration_notes", "")

        print(f"\n   🏋️ РЕЗУЛЬТАТ:")
        print(f"      Повторений: {result['total_reps']}")
        print(f"      Оценка: {result['score']}/100")
        print(f"      Ошибок: {len(result['errors'])}")
        print(f"      Сильные стороны: {len(result['strengths'])}")
        print(f"      Совет тренера: {result['coach_tip'][:80]}...")
        print(f"      Калибровка: {result['calibration_notes'][:80]}...")
        print(f"{'='*60}\n")

        return result

    except json.JSONDecodeError as e:
        print(f"   ❌ Ошибка парсинга JSON от Gemini: {e}")
        print(f"   📄 Сырой текст: {raw_text[:300]}")
        logger.error(f"Gemini JSON parse error: {e}, raw: {raw_text[:200]}")
        raise ValueError(f"Gemini вернул невалидный JSON: {e}")

    except Exception as e:
        print(f"   ❌ Ошибка Gemini API: {e}")
        logger.error(f"Gemini API error: {e}")
        raise ValueError(f"Gemini API ошибка: {e}")
