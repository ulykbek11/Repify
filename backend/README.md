# MotionQ AI Fitness Trainer — Backend

Персонализированный AI фитнес тренер с анализом техники и подсчётом повторений.

**Поддерживаемые упражнения:** Приседания (squat) и Становая тяга (deadlift)

## Философия

**Персонализация, не универсальные стандарты:**

- Длинное бедро → ДОЛЖЕН больше наклоняться (физика)
- Короткие руки → иная техника становой тяги (анатомия)
- Жёсткий голеностоп → не может глубоко приседать (ограничения)
- Анализ сравнивает с ЛИЧНЫМ baseline пользователя, не с "90° для всех"

## Технологии

- **FastAPI** — HTTP API
- **SQLAlchemy 2.0** — ORM (Mapped, mapped_column)
- **Alembic** — миграции БД
- **PostgreSQL** (Supabase) — база данных
- **Pydantic v2** — валидация данных
- **NumPy** — математические вычисления
- **MediaPipe** — 33 точки тела (обработка на фронтенде)

## Структура проекта

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app, CORS, роутеры
│   ├── config.py            # Pydantic Settings (.env)
│   ├── database.py          # SQLAlchemy engine, Base, get_db()
│   ├── models/
│   │   ├── user.py          # User (Supabase Auth ID)
│   │   ├── calibration.py   # CalibrationProfile (JSON поля)
│   │   └── workout.py       # Workout (история)
│   ├── schemas/
│   │   ├── user.py          # UserCreate, UserResponse
│   │   ├── calibration.py   # CalibrationRequest/Response
│   │   ├── technique.py     # AnalysisRequest/Response, RepCount
│   │   └── workout.py       # WorkoutCreate/Response/Stats
│   ├── services/
│   │   ├── calibration_service.py  # Калибровка биомеханики
│   │   ├── technique_analyzer.py   # Анализ техники
│   │   └── rep_counter_service.py  # State Machine подсчёт
│   ├── api/
│   │   ├── calibration.py   # POST /start, GET /{user_id}
│   │   ├── analysis.py      # POST /analyze-technique, /count-rep
│   │   └── workouts.py      # CRUD тренировок + статистика
│   └── utils/
│       └── pose_math.py     # Математика: углы, расстояния
├── alembic/
│   ├── env.py
│   └── versions/
│       └── 001_initial_migration.py
├── tests/
│   ├── test_pose_math.py
│   ├── test_calibration.py
│   └── test_analysis.py
├── alembic.ini
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

## Установка

### 1. Клонирование и настройка окружения

```bash
cd backend

# Создание виртуального окружения
python -m venv venv

# Активация (Windows)
venv\Scripts\activate

# Активация (Linux/macOS)
source venv/bin/activate

# Установка зависимостей
pip install -r requirements.txt
```

### 2. Настройка переменных окружения

```bash
# Копирование примера
cp .env.example .env

# Заполните .env вашими данными:
# DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres
# SUPABASE_URL=https://PROJECT.supabase.co
# SUPABASE_SERVICE_KEY=your_key
```

### 3. Миграции базы данных

```bash
# Применение миграций
alembic upgrade head
```

### 4. Запуск сервера

```bash
# Режим разработки
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Документация

После запуска доступна по адресу:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## API Endpoints

### Health Check

```
GET /           → {"status": "ok", "service": "MotionQ AI Fitness Trainer"}
GET /health     → {"status": "healthy", "components": {...}}
```

### Калибровка

```
POST /api/calibration/start
GET  /api/calibration/{user_id}/{exercise_type}
```

**Калибровка (POST):**
```json
{
  "user_id": "supabase-user-id",
  "exercise_type": "squat",
  "pose_sequence": [
    [кадры с тренировки]
  ]
}
```

**Ответ:**
```json
{
  "calibration_completed": true,
  "user_id": "...",
  "exercise_type": "squat",
  "profile": {
    "anthropometry": {
      "femur_length": 0.2015,
      "tibia_length": 0.2000,
      "femur_tibia_ratio": 1.008
    },
    "baseline_metrics": {
      "natural_squat_depth": 85.3,
      "natural_torso_lean": 28.2
    },
    "safe_ranges": {
      "depth_min": 70.3,
      "depth_max": 100.3
    }
  },
  "recommendations": [
    "Оптимальная глубина приседа для вас: 70-100°"
  ]
}
```

### Анализ техники

```
POST /api/analyze-technique
```

**Запрос:**
```json
{
  "user_id": "supabase-user-id",
  "exercise_type": "squat",
  "landmarks": {
    "nose": {"x": 0.5, "y": 0.2, "z": 0.0},
    "left_shoulder": {"x": 0.4, "y": 0.4, "z": 0.0},
    ...
  }
}
```

**Ответ:**
```json
{
  "technique_score": 0.95,
  "errors": [],
  "feedback": "Отличная техника! ✅",
  "metrics": {
    "knee_angle": 85.3,
    "hip_angle": 78.5,
    "torso_angle": 29.1,
    "symmetry": 2.3
  }
}
```

### Подсчёт повторений

```
POST /api/count-rep
```

**Ответ:**
```json
{
  "rep_counted": true,
  "total_reps": 1,
  "current_phase": "STANDING",
  "key_angle": 165.2
}
```

### Тренировки

```
GET  /api/workouts/{user_id}?exercise_type=squat&limit=50&offset=0
POST /api/workouts/
GET  /api/workouts/stats/{user_id}
```

## Тестирование

```bash
# Запуск всех тестов
pytest tests/ -v

# Только математика
pytest tests/test_pose_math.py -v

# Только калибровка
pytest tests/test_calibration.py -v

# Только анализ
pytest tests/test_analysis.py -v
```

## Как это работает

### 1. Калибровка (обязательный первый шаг)

1. Пользователь делает несколько повторений упражнения перед камерой
2. Фронтенд извлекает или отправляет видео на бэкенд для извлечения 33 точек тела для каждого кадра
3. Бэкенд анализирует пропорции тела и характеристики движения
4. Создаётся персональный профиль с безопасными диапазонами

### 2. Анализ техники (в реальном времени)

1. Каждый кадр с камеры отправляется на бэкенд
2. Бэкенд сравнивает текущую позу с ЛИЧНЫМ baseline
3. Возвращает оценку 0-1, список ошибок и подсказки

### 3. Подсчёт повторений

1. State machine отслеживает фазы движения
2. Приседания: STANDING → SQUATTING_DOWN → BOTTOM → STANDING_UP → STANDING (+1)
3. Тяга: STANDING → SETUP → LIFTING → LOCKOUT → LOWERING → STANDING (+1)

### 4. История тренировок

1. После завершения тренировки — сохранение в БД
2. Статистика по упражнениям: кол-во тренировок, повторений, средний балл

## Лицензия

MIT
