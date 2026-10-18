# Adding an exercise

An exercise is data plus a few small functions. Everything the analyzer needs lives in
[`backend/app/services/exercises.py`](../backend/app/services/exercises.py); feedback text lives in
[`exercise_messages.py`](../backend/app/services/exercise_messages.py).

## 1. Describe it with a `Spec`

```python
Spec(
    id,            # snake_case, e.g. "close_grip_bench"
    camera,        # "side"
    camera_note,   # filming advice shown in the app
    signal,        # angle key that counts reps: knee_angle, hip_angle, elbow_angle, body_line
    mode,          # "dip": starts high, rep = excursion below `enter` (squat, curl)
                   # "peak": starts low, rep = excursion above `enter` (overhead press)
                   # "hold": timed hold (plank)
    rest,          # angle of the start / end position
    enter,         # angle that must be crossed for a rep to count
    required,      # joints that must be visible, e.g. ("shoulder", "elbow", "wrist")
    checks,        # tuple of Check(key, fn)
    signal_label="human description of the signal",
)
```

A `Check` is a key plus a function `fn(ctx: RepContext) -> Optional[float]` that returns a score
penalty when the rule is violated and `None` otherwise. `RepContext` gives you the repetition's
extreme frame (`ctx.j` joints, `ctx.ang` angles, `ctx.value` signal value), the whole segment
(`ctx.segment`), the frames around it (`ctx.wide`, `ctx.after`) and the set baseline (`ctx.base`).

Reusable check builders already exist: `_range_short(limit)` (did not reach the depth target),
`_lockout(angle, limit)` (did not finish straight), `_extension(...)`, `_lean_over(limit)`,
`_lean_range(limit)` (momentum), `_knee_travel(...)`. Write your own for anything else.

## 2. Write the messages (EN and RU)

For every check key you need `err_<key>` and `tip_<key>`, and optionally `ok_<key>` for the
"what went well" list. `{n}` and `{total}` are filled with the number of bad reps and total reps.

```python
MESSAGES = {
    "en": {"err_rom": "The bar stopped too high on {n} of {total} reps.", "tip_rom": "Touch the chest.", ...},
    "ru": {"err_rom": "Штанга остановилась слишком высоко в {n} из {total} повторений.", "tip_rom": "Касайтесь груди.", ...},
}
```

## 3. Register it

Built-in exercises are added with `_add(Spec(...))` in `exercises.py` and their messages go in
`EX_MESSAGES`. From your own module or a test you can use the public helper, which validates the
spec and the messages and raises `ValueError` if something is missing:

```python
from app.services import exercises as registry
registry.register(spec, MESSAGES, aliases=("close grip bench", "узкий жим"))
```

`aliases` let `POST /api/analyze` resolve free-form names. The new id is then returned by
`GET /health` and `GET /api/exercises`.

## Worked example: close-grip bench press

```python
from app.services.exercises import Check, Spec, _lockout, _range_short

spec = Spec(
    "close_grip_bench", "side", "Side view from the side of the bench at bar height.",
    "elbow_angle", "dip", 150, 110, ("shoulder", "elbow", "wrist"),
    (Check("rom", _range_short(95)), Check("lockout", _lockout("elbow_angle", 160))),
    signal_label="elbow angle (shoulder-elbow-wrist)",
)
```

Reps count when the elbow goes from 150 degrees or more to below 110 and back. A rep that never gets
under 95 degrees triggers `rom` with a penalty that grows with the shortfall (capped at 35); a rep
that does not return to 160 degrees triggers `lockout`. This is exactly what
[`backend/tests/test_extending.py`](../backend/tests/test_extending.py) registers and analyzes; copy it as a template.

## 4. Test it

Generate a synthetic landmark sequence, run it through the analyzer, and assert on the output:

```python
seq = generate_pose_sequence("bench_press", [90, 100, 90], faults=set())   # elbow minimum per rep
frames = build_frames([landmarks_to_named(f["landmarks"]) for f in seq], timestamps=[f["timestamp"] for f in seq])
result = analyze_local("close_grip_bench", frames, "en")
assert result["total_reps"] == 3 and "stopped too high" in result["errors"][0]
```

Test fixtures live in [`backend/tests/synthetic_poses.py`](../backend/tests/synthetic_poses.py) (test code only,
not part of the app). A brand new movement needs its own builder: a function `(signal_value, progress, faults) -> joints`
registered in the `BUILDERS` table together with a resting angle, default reps and good reps. Existing tests then check
every registered exercise (text for every check in EN and RU), so a missing message fails loudly.

## 5. Make it appear in the app

1. `frontend/src/data/exercises.js`: add the id to a group in `EXERCISE_GROUPS` and an icon in `EXERCISE_ICONS`.
2. `frontend/src/i18n/strings.js`, both languages: `home.<id>`, `home.<id>Desc`, `exercise.camera.<id>`, `exercise.checks.<id>`. A test checks that these keys exist.
3. Add a row to the exercise table in the README.

## Tuning an existing threshold

Change the number in the `Spec` or the check builder, run `pytest -q`, and note in the pull request where the new value comes from. Thresholds are heuristics, not validated on labelled video, so evidence (a source or labelled clips) is the best justification.
