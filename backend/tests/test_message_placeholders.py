"""Consistency checks for the EN/RU feedback catalogs.

The analyzers fill these strings with ``str.format``. A placeholder that exists
in one language but not the other, or a typo such as ``{totl}``, would only show
up as a ``KeyError`` (or a silently missing number) for users of that language,
so these tests compare the placeholders of every message pair up front.
"""

import string

import pytest

from app.services.exercise_messages import EX_MESSAGES
from app.services.local_analyzer import MESSAGES

_FORMATTER = string.Formatter()

# Values for every placeholder the catalogs are allowed to use.
# r is the femur-to-shin ratio in the squat calibration notes.
SAMPLE_VALUES = {"n": 2, "total": 3, "pct": 40, "s": 12, "r": 1.05}

# The plank is a timed hold rather than a rep count, so its strings speak in
# seconds and percentages instead of "n of total reps".
TIMED_EXERCISES = {"plank"}


def placeholders(text):
    return {field for _, field, _, _ in _FORMATTER.parse(text) if field is not None}


def _catalog_pairs():
    yield "squat/deadlift", MESSAGES
    for exercise, catalog in EX_MESSAGES.items():
        yield exercise, catalog


@pytest.mark.parametrize("name,catalog", list(_catalog_pairs()), ids=lambda v: v if isinstance(v, str) else "")
def test_en_and_ru_use_the_same_placeholders(name, catalog):
    for key, en_text in catalog["en"].items():
        assert key in catalog["ru"], f"{name}: '{key}' has no Russian text"
        assert placeholders(en_text) == placeholders(catalog["ru"][key]), f"{name}: placeholders differ for '{key}'"


@pytest.mark.parametrize("name,catalog", list(_catalog_pairs()), ids=lambda v: v if isinstance(v, str) else "")
def test_every_message_formats_with_known_placeholders(name, catalog):
    for language in ("en", "ru"):
        for key, text in catalog[language].items():
            assert placeholders(text) <= set(SAMPLE_VALUES), f"{name}/{language}: unknown placeholder in '{key}'"
            text.format(**SAMPLE_VALUES)


@pytest.mark.parametrize("exercise", sorted(set(EX_MESSAGES) - TIMED_EXERCISES))
def test_rep_based_errors_report_n_of_total(exercise):
    for key, text in EX_MESSAGES[exercise]["en"].items():
        if key.startswith("err_"):
            assert placeholders(text) == {"n", "total"}, f"{exercise}: '{key}' should say 'on n of total reps'"
        if key.startswith("ok_"):
            # With {n} the strength is a count, so it needs the total too.
            assert placeholders(text) in (set(), {"n", "total"}), f"{exercise}: '{key}'"
