# Repify devlog

A short, human-readable history of how Repify got to where it is. It is written
from the git history; see `git log` for the full detail.

## 2026-10-24: Result replay

- The result screen on the web now replays the analysed video with the detected
  landmarks, the skeleton and live joint angles drawn on top, so you can see
  exactly which part of the rep the feedback refers to (PR #5).

## 2026-10-18: Rebuild, open source and live camera

- **Backend:** refactored into a stateless analysis API with a local fallback
  analyzer, and packaged to run as a Vercel Python function (MediaPipe slimmed
  to about 300 MB). CORS allows Vercel preview URLs.
- **Exercises:** analysis now covers 14 exercises, including bench press,
  overhead press, push-up, pull-up, row, lunge, Romanian deadlift, curl, plank,
  hip thrust, dip and lat pulldown.
- **App:** the Expo client was rebuilt around the working analysis flow.
  On the web, poses are extracted in the browser with MediaPipe Tasks Vision and
  only the landmarks are sent to the backend, followed by a fast, bounded Gemini
  call. Upload progress is shown under the upload button.
- **Live camera:** the web app gained a live camera mode; framing cues now count
  the head and no longer get stuck on the initial "no person" state. Samples,
  demo mode and local fake accounts were removed.
- **Open source:** MIT license, `CONTRIBUTING.md`, `docs/ADDING_EXERCISES.md`,
  pinned dependencies, ESLint, a GitHub Actions CI workflow (backend lint and
  tests on Python 3.11 and 3.12, app lint, tests and web export), and a README
  with screenshots and a GIF of the live camera flow.
- Cleanup: dead experiments, debug scripts and committed OS artifacts removed.

## 2026-02: First release

- Initial Repify release with the first Expo frontend, camera capture and a
  backend that moved to Gemini-based technique feedback over several iterations.
