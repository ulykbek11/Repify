"""The documented path for adding an exercise (docs/ADDING_EXERCISES.md) works end to end."""

import pytest

from app.services import exercises as registry
from app.services.exercises import Check, Spec, _lockout, _range_short
from app.services.local_analyzer import analyze_local
from app.services.pose_features import build_frames, landmarks_to_named
from tests.synthetic_poses import generate_pose_sequence

MESSAGES = {
    "en": {
        "err_rom": "The bar stopped too high on {n} of {total} reps.",
        "tip_rom": "Touch the chest.",
        "err_lockout": "No lockout on {n} of {total} reps.",
        "tip_lockout": "Finish with straight arms.",
    },
    "ru": {
        "err_rom": "Штанга остановилась слишком высоко в {n} из {total} повторений.",
        "tip_rom": "Касайтесь груди.",
        "err_lockout": "Нет разгибания в {n} из {total} повторений.",
        "tip_lockout": "Заканчивайте с прямыми руками.",
    },
}


def make_spec(exercise_id="close_grip_bench", rom_limit=95):
    return Spec(
        exercise_id, "side", "Side view from the side of the bench.",
        "elbow_angle", "dip", 150, 110, ("shoulder", "elbow", "wrist"),
        (Check("rom", _range_short(rom_limit)), Check("lockout", _lockout("elbow_angle", 160))),
        signal_label="elbow angle",
    )


@pytest.fixture
def custom():
    spec = registry.register(make_spec(), MESSAGES, aliases=("close grip bench", "узкий жим"))
    yield spec
    registry.unregister(spec.id)


def bench_frames(depths):
    seq = generate_pose_sequence("bench_press", depths, faults=set())
    return build_frames([landmarks_to_named(f["landmarks"]) for f in seq], timestamps=[f["timestamp"] for f in seq])


def test_registered_exercise_is_analyzed_and_localized(custom):
    assert custom.id in registry.EXERCISE_IDS
    frames = bench_frames([90, 100, 90])
    en = analyze_local(custom.id, frames, "en")
    assert en["total_reps"] == 3
    assert any("stopped too high" in e for e in en["errors"])  # the 100 degree rep misses the 95 limit
    ru = analyze_local(custom.id, frames, "ru")
    assert any("слишком высоко" in e for e in ru["errors"])


def test_registered_exercise_is_exposed_and_resolvable(custom):
    assert registry.normalize_exercise("Close grip bench press") == custom.id
    assert registry.normalize_exercise("узкий жим лёжа") == custom.id
    assert registry.normalize_exercise("bench press") == "bench_press"  # built-ins keep working
    assert custom.id in [d["id"] for d in registry.describe()]


def test_unregister_restores_the_registry():
    before = list(registry.EXERCISE_IDS)
    registry.register(make_spec("tmp_ex"), MESSAGES, aliases=("tmp ex",))
    registry.unregister("tmp_ex")
    assert registry.EXERCISE_IDS == before
    assert registry.normalize_exercise("tmp ex") is None


@pytest.mark.parametrize("bad", [
    lambda: make_spec("Not-Snake"),
    lambda: make_spec("squat"),  # duplicate id
])
def test_register_rejects_bad_ids(bad):
    with pytest.raises(ValueError):
        registry.register(bad(), MESSAGES)
    assert "Not-Snake" not in registry.SPECS


def test_register_requires_messages_for_every_check():
    incomplete = {"en": {"err_rom": "x", "tip_rom": "y"}, "ru": MESSAGES["ru"]}
    with pytest.raises(ValueError, match="Missing en messages"):
        registry.register(make_spec("tmp_ex2"), incomplete)
    assert "tmp_ex2" not in registry.SPECS
    assert "tmp_ex2" not in registry.EXERCISE_IDS


def test_register_rejects_unknown_mode():
    spec = Spec("tmp_ex3", "side", "n", "elbow_angle", "wobble", 150, 110, ("elbow",))
    with pytest.raises(ValueError, match="mode"):
        registry.register(spec)
