"""
Integration tests for frontend-compat API endpoints.
Uses httpx.AsyncClient with ASGI transport (no running server required).
"""

import math

import pytest
import pytest_asyncio
import httpx
from httpx import ASGITransport

from app.main import app

BASE_URL = "http://localhost:8000"
USER_ID = "3207f5e4-cf36-4854-99db-d3857588b927"


# =============================================================================
# Pose data generation
# =============================================================================
#
# MediaPipe landmark indices (frontend_compat._landmarks_array_to_dict):
#   23 = left_hip   24 = right_hip
#   25 = left_knee  26 = right_knee
#   27 = left_ankle 28 = right_ankle
#
# Knee angle = calculate_angle(hip, knee, ankle)  [angle at knee vertex]
#
# STANDING keyframe — collinear points → angle ≈ 180°
# BOTTOM keyframe   — bent knee      → angle ≈ 117°  (< full_threshold 130°)
#
# Verification (bottom, left side):
#   hip=(0.48,0.60), knee=(0.38,0.73), ankle=(0.45,0.88)
#   vec_ba = (0.10, -0.13),  vec_bc = (0.07, 0.15)
#   cos(θ) = -0.0125 / (0.1640 * 0.1655) ≈ -0.461  →  θ ≈ 117°

# Joint landmark positions for the two extreme keyframes
_STAND: dict[int, tuple[float, float]] = {
    23: (0.45, 0.40),  # left_hip
    24: (0.55, 0.40),  # right_hip
    25: (0.45, 0.65),  # left_knee
    26: (0.55, 0.65),  # right_knee
    27: (0.45, 0.88),  # left_ankle
    28: (0.55, 0.88),  # right_ankle
}

_BOTTOM: dict[int, tuple[float, float]] = {
    23: (0.48, 0.60),  # left_hip  — drops as body lowers
    24: (0.52, 0.60),  # right_hip
    25: (0.38, 0.73),  # left_knee  — travels forward
    26: (0.62, 0.73),  # right_knee
    27: (0.45, 0.88),  # left_ankle — stays grounded
    28: (0.55, 0.88),  # right_ankle
}

# Fixed positions for the remaining 27 landmarks (realistic but unchanging)
_FIXED: dict[int, tuple[float, float]] = {
    0:  (0.50, 0.05),                                          # nose
    1:  (0.48, 0.05), 2: (0.47, 0.05), 3: (0.46, 0.05),      # left eye
    4:  (0.52, 0.05), 5: (0.53, 0.05), 6: (0.54, 0.05),      # right eye
    7:  (0.45, 0.06), 8: (0.55, 0.06),                        # ears
    9:  (0.48, 0.08), 10: (0.52, 0.08),                       # mouth
    11: (0.40, 0.22), 12: (0.60, 0.22),                       # shoulders
    13: (0.35, 0.35), 14: (0.65, 0.35),                       # elbows
    15: (0.32, 0.48), 16: (0.68, 0.48),                       # wrists
    17: (0.31, 0.50), 18: (0.69, 0.50),                       # pinkys
    19: (0.31, 0.49), 20: (0.69, 0.49),                       # indexes
    21: (0.32, 0.49), 22: (0.68, 0.49),                       # thumbs
    29: (0.44, 0.92), 30: (0.56, 0.92),                       # heels
    31: (0.45, 0.96), 32: (0.55, 0.96),                       # foot indexes
}


def _frame(t: float, ts: float) -> dict:
    """
    Build one MediaPipe-format frame.

    t=0.0 → standing (knee ≈ 180°)
    t=1.0 → squat bottom (knee ≈ 117°)
    """
    lms = []
    for i in range(33):
        if i in _STAND:
            sx, sy = _STAND[i]
            bx, by = _BOTTOM[i]
            x = sx + (bx - sx) * t
            y = sy + (by - sy) * t
        else:
            x, y = _FIXED.get(i, (0.5, 0.5))
        lms.append({"x": x, "y": y, "z": 0.0, "visibility": 0.95})
    return {"landmarks": lms, "timestamp": ts}


def _squat_sequence(n: int, cycles: float = 1.0) -> list:
    """
    Generate n frames covering `cycles` full squat repetitions.

    Uses a cosine envelope so angles transition smoothly:
        standing → bottom → standing   (one cycle)

    cycles=1  → 1 rep  (for count-reps test)
    cycles=5  → 5 reps (for calibration test, gives 5 detectable minima)
    """
    return [
        _frame(
            t=(1.0 - math.cos(i / n * cycles * 2.0 * math.pi)) / 2.0,
            ts=float(i * 33),
        )
        for i in range(n)
    ]


# =============================================================================
# Fixtures
# =============================================================================

@pytest_asyncio.fixture
async def client():
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app),
        base_url=BASE_URL,
    ) as c:
        yield c


# =============================================================================
# Tests
# =============================================================================

@pytest.mark.asyncio
async def test_profile_exists_returns_200(client):
    resp = await client.get(f"/api/profile/{USER_ID}/exists")
    assert resp.status_code == 200
    body = resp.json()
    assert "exists" in body
    assert isinstance(body["exists"], bool)
    assert body["user_id"] == USER_ID


@pytest.mark.asyncio
async def test_calibrate_returns_success(client):
    # 150 frames, 5 clear squat cycles → _split_into_reps detects 5 minima
    # satisfies the >= 15 frame guard and the exactly-5-reps requirement
    payload = {
        "user_id": USER_ID,
        "exercise": "squats",
        "pose_sequence": _squat_sequence(n=150, cycles=5),
    }
    resp = await client.post("/api/calibrate", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("success") is True


@pytest.mark.asyncio
async def test_count_reps_returns_one_rep(client):
    # 60 frames, 1 squat cycle: knee angle 180° → 117° → 180°
    # The minimum (~117°) is below full_threshold (130°) → full_reps == 1
    payload = {
        "user_id": USER_ID,
        "exercise": "squats",
        "pose_sequence": _squat_sequence(n=60, cycles=1),
    }
    resp = await client.post("/api/count-reps", json=payload)
    assert resp.status_code == 200
    body = resp.json()

    for key in ("total_reps", "full_reps", "partial_reps", "consistency_score", "fatigue_analysis"):
        assert key in body, f"Missing key: {key}"

    assert body["full_reps"] + body["partial_reps"] == body["total_reps"]
    assert body["total_reps"] == 1
    assert body["full_reps"] == 1
