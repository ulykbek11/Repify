"""Write the built-in sample analyses (every exercise, English and Russian) for the app.

The app uses them in demo mode, when no backend is configured. Run from the
``backend`` folder after changing the analyzer or the synthetic poses::

    python scripts/export_samples.py

A test fails when ``frontend/src/data/samples.json`` is out of date.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services.exercises import EXERCISE_IDS  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "frontend" / "src" / "data" / "samples.json"


def main() -> None:
    client = TestClient(app)
    data = {
        exercise: {
            language: client.get(f"/api/sample-analysis?exercise={exercise}&language={language}").json()
            for language in ("en", "ru")
        }
        for exercise in EXERCISE_IDS
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
