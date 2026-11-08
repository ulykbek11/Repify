# Testing guide

How the Repify test suites are organised and how to run them. Counts below come from `pytest --collect-only` (235 backend tests) and the `test(` cases in `frontend/tests` (16 app tests) at the time of writing.

## Running

### Backend

```bash
cd backend
pip install -r requirements-dev.txt     # runtime deps + pytest, httpx, ruff
pytest -q                               # whole suite (pytest.ini sets testpaths = tests)
pytest tests/test_exercises.py -q       # one file
pytest tests/ -q -k "plank"             # tests whose name matches a keyword
ruff check --select E9,F app tests      # the same syntax/unused-name lint CI runs
```

Python 3.11 is what production uses (MediaPipe 0.10.14 has no wheels for newer interpreters). CI also runs the suite on 3.12.

### App

```bash
cd frontend
npm install
npm test                                # node:test on tests/ (live camera framing, rep counter, result replay)
npm run lint
npm run build:web                       # Expo web export; CI sets EXPO_PUBLIC_API_URL to a dummy value
```

## Isolation: no video, no network, no database

The backend suite never opens a video file or talks to Gemini, MediaPipe or a database:

- Landmark sequences come from `tests/synthetic_poses.py`, which builds a planar side-view skeleton from a joint-angle trajectory and exposes it as 33 MediaPipe-style landmarks. A `faults` argument turns on a deliberate technique error so each form check can be exercised.
- HTTP tests use FastAPI's `TestClient`. Gemini is only involved when a test stubs it (for example `test_gemini_failure_falls_back_to_local` monkeypatches a failing `analyze_with_gemini`, and `test_gemini_response_parsing` feeds a JSON string to `parse_response`).
- `pytest.ini` only sets `testpaths = tests`. There is no `conftest.py`.

The app tests import the pure helpers in `frontend/src/lib` (`framing.js`, `liveCounter.js`, `replay.js`) and never start Expo or open a camera.

## Shared helpers

| File | Purpose |
|------|---------|
| `backend/tests/synthetic_poses.py` | One builder per exercise (`generate_pose_sequence`, `GOOD_DEPTHS`, `FIXTURE_EXERCISES`). Used by the analysis, exercise and extending tests; not part of the app. |

`test_extending.py` registers a temporary exercise through `registry.register` and unregisters it in a fixture teardown, so the documented path in [ADDING_EXERCISES.md](ADDING_EXERCISES.md) stays working.

## What each file covers

### Backend (`pytest`, 235 tests)

| File | Tests | Area |
|------|------:|------|
| `test_analysis.py` | 15 | Geometry basics (`angle_at`, `torso_lean`), squat and deadlift local analysis, language fallback, `/health` and `/api/analyze` round-trip and validation, Gemini fallback and response parsing |
| `test_exercises.py` | 169 | All 14 exercises: registry, EN/RU texts, good form (3 reps, no errors), injected faults, range and lockout checks, plank timing, name aliases, `/api/exercises` and `/api/analyze` coverage, README and app string sync, CORS preview regex |
| `test_extending.py` | 7 | Registering a custom exercise end to end: analysis, aliases, unregister, rejected ids and missing messages |
| `test_message_placeholders.py` | 37 | Every EN/RU pair uses the same, known `str.format` placeholders; rep-based errors mention `n` of `total` |
| `test_pose_geometry.py` | 7 | `hip_offset_from_line` sign convention (image y points down), `visible_side`, `build_frames` edge cases |

`test_exercises.py` and `test_message_placeholders.py` are parametrised over exercises and languages, which is why their counts are larger than the number of `def test_` functions.

### App (`npm test`, 16 tests)

| File | Tests | Area |
|------|------:|------|
| `live.test.js` | 11 | Framing cues (nobody, cutoff, hidden joint, too far, a deep squat that is not "too far", front view), luma/dark-room check, squat signal angle, dip and peak rep counters matching the server thresholds |
| `replay.test.js` | 5 | Result replay helpers: `nearestPose`, `angleAt`, `frameAngles` for squat and arm exercises, `dominantSide` |

## Adding a test

1. Backend: put it in the file matching the area above, or add `tests/test_<area>.py` with a one-line module docstring. Build poses with `generate_pose_sequence` rather than inventing landmark lists by hand, and stub Gemini with `monkeypatch` instead of calling the real API.
2. When you add an exercise, follow [ADDING_EXERCISES.md](ADDING_EXERCISES.md): a `Spec`, EN and RU messages, a synthetic pose builder, app strings, and tests. `test_registry_has_fourteen_exercises_and_a_fixture_for_each` and `test_app_has_texts_for_every_exercise` will fail until those pieces exist.
3. App: add a `test(...)` case in `frontend/tests` next to the helper you changed. The runner is Node's built-in test runner (`node --test tests/`).
4. Run the new file alone, then the matching suite (and `ruff check --select E9,F app tests` for backend changes) before pushing.
