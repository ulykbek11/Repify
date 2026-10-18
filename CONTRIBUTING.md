# Contributing to Repify

Thanks for helping. Small, focused pull requests are easiest to review.

## Setup

```bash
# backend (Python 3.11 or 3.12)
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt

# app (Node 20+)
cd frontend && npm install
```

## Checks (the same ones CI runs)

```bash
cd backend
ruff check --select E9,F app tests
pytest -q

cd ../frontend
npm run lint
npm test
npm run build:web
```

## Adding or tuning an exercise

Follow [docs/ADDING_EXERCISES.md](docs/ADDING_EXERCISES.md) for the full walkthrough with a worked example. In short: add a `Spec` with its checks, EN and RU messages, a synthetic pose builder for the test fixtures, the app strings, and tests.

If you change a threshold, say where it comes from (a coaching source, or your own labelled clips). Thresholds are heuristics today, so evidence is welcome.

## Pull requests

- Keep the existing tests green and add tests for new behaviour.
- Do not commit secrets, `.env` files, videos or model weights (they are git-ignored).
- UI text goes through `frontend/src/i18n/strings.js` in both English and Russian.
- Describe what you changed and how you checked it; screenshots help for UI changes.
