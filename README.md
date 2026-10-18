# Repify

AI feedback on squat and deadlift technique from a single side-view video.

Film a set, and Repify finds your body landmarks, converts them into joint angles, counts the repetitions and tells you what to fix: depth, torso lean, knee travel, heel lift, lockout. The app runs on iOS, Android and the web (Expo / React Native), and speaks English and Russian.

| Sign in | Train | Result | Result (RU) | History (RU) |
|---|---|---|---|---|
| ![Sign in](docs/screenshots/01-sign-in.png) | ![Train](docs/screenshots/02-train.png) | ![Result](docs/screenshots/03-result.png) | ![Result in Russian](docs/screenshots/04-result-ru.png) | ![History in Russian](docs/screenshots/05-history-ru.png) |

The result screen draws the detected pose at the lowest point of the movement. The screenshots above come from the built-in synthetic sample (see [Demo without a video](#demo-without-a-video)).

## How it works

```
 Expo app (iOS / Android / web)                FastAPI backend
 ------------------------------                -----------------------------------------------
 pick or record a video      --- video ---->   /api/extract-poses
                                                 OpenCV frame sampling -> MediaPipe Pose
                                               <-- 33 landmarks per frame --
 pose sequence               --- JSON ----->   /api/analyze
                                                 landmarks -> side selection -> knee/hip/torso angles
                                                 Gemini (if GEMINI_API_KEY is set)
                                                   -> otherwise / on failure: local rule-based analyzer
 score, reps, issues, tips   <-- JSON ------   reps, score, errors, strengths, coach tip, pose preview
 history stored on the device
```

- **Pose estimation:** MediaPipe Pose (33 landmarks) on the server, frames downscaled to 640x480.
- **Biomechanics:** angles at the knee (hip-knee-ankle) and hip (shoulder-hip-knee), torso inclination, knee position relative to the toes, heel height.
- **Rep counting:** a small state machine over the smoothed angle signal (standing, descent below a threshold, return to standing).
- **Two analysis engines behind one response schema:**
  - *Local analyzer* (`backend/app/services/local_analyzer.py`): deterministic rules, no network, unit tested. It is the default.
  - *Gemini* (`gemini_analyzer.py`): receives compact joint data (not video) and returns a JSON verdict in the user's language. If the call fails, the API falls back to the local analyzer.
- **Personalisation:** the thigh to shin ratio is measured from the standing frames, so long-femur lifters are not penalised for extra forward lean.
- **Accounts:** Supabase Auth when configured, otherwise a local demo account (no server). Workout history is kept on the device.

## Tech stack

| Layer | Tools |
|---|---|
| App | Expo SDK 54, React Native 0.81, React Navigation 7, react-native-svg, lucide icons, expo-image-picker |
| i18n | Small context-based dictionary (`frontend/src/i18n`), EN and RU, language persisted on the device |
| Backend | Python 3.11, FastAPI, Pydantic v2, MediaPipe 0.10.14, OpenCV, google-genai |
| Auth | Supabase Auth (optional) |
| Tests | pytest (14 tests: geometry, rep segmentation, scoring, API, Gemini fallback) |

## Run it locally

### 1. Backend

Python 3.11 is required, because MediaPipe 0.10.14 has no wheels for newer interpreters.

```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # optional: add GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000
pytest                          # run the tests
```

Open http://localhost:8000/docs for the API. `GET /health` reports which engine is active.

Or with Docker: `docker build -t repify-api backend && docker run -p 8000:8000 repify-api`.

### 2. App

```bash
cd frontend
cp .env.example .env            # set EXPO_PUBLIC_API_URL (use your LAN IP on a phone)
npm install
npx expo start                  # press w for web, or scan the QR code with Expo Go
```

Production web build: `npm run build:web` (output in `frontend/dist`).

## Demo without a video

On the **Train** tab, **Try a sample analysis** calls `GET /api/sample-analysis`. The backend generates a synthetic side-view squat set (three reps: deep, shallow, medium) and runs it through the same angle, rep-counting and scoring code as a real upload. The result is labelled as synthetic in the UI. Use it to try the app without filming anything.

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | backend | Optional. Enables Gemini analysis. Without it the local analyzer is used. |
| `GEMINI_MODEL` | backend | Defaults to `gemini-2.5-flash`. |
| `CORS_ORIGINS` | backend | Comma-separated browser origins allowed to call the API. |
| `MAX_UPLOAD_MB` | backend | Upload limit for `/api/extract-poses` (default 60). |
| `EXPO_PUBLIC_API_URL` | app | Backend base URL. |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | app | Optional. Enables real accounts. |

## Deploying

- **Backend:** any container host (Render, Railway, Fly.io) using `backend/Dockerfile`. Set `CORS_ORIGINS` to the web app's origin and optionally `GEMINI_API_KEY`.
- **Web app:** Vercel with root directory `frontend` (`frontend/vercel.json` is included). Set `EXPO_PUBLIC_API_URL` to the backend URL.
- **Mobile:** EAS Build (`eas build`) once a backend URL is available.

## Limitations

- Analysis assumes a single person filmed from the side with the whole body in frame. Knee valgus and spine rounding cannot be judged from this angle.
- Thresholds in the local analyzer are reasonable heuristics, not validated against coach-labelled data.
- The pipeline has been verified end to end on a still image of a person and on synthetic sequences; it has not been validated on a set of real lifting videos.
- The API has no authentication or rate limiting. Put it behind your own gateway before exposing it publicly.
- This is a portfolio project, not medical or professional coaching advice.

## Project history

The project went through several iterations: an ML-model experiment for technique classification, Python scripts for calibration and rep counting, a first web client, and then the React Native rewrite with Gemini. The legacy code (calibration service, WebSocket test client, plan generator, leaderboard, SQL models) was removed from `main` in this cleanup and is preserved on the branch [`archive/pre-portfolio-cleanup`](../../tree/archive/pre-portfolio-cleanup).

## Repository layout

```
backend/    FastAPI service, analyzers, tests, Dockerfile
frontend/   Expo app (screens, i18n, API client, auth)
docs/       screenshots
```
