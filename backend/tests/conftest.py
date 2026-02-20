"""
Shared pytest fixtures for all tests.

Uses an isolated in-memory SQLite database so tests never touch
the real motionq.db and tables are always present.

Execution order per test:
  test_engine (session-scoped) → create_all once
  db_session  (function-scoped) → one session per test, rolled back after
  override_get_db (autouse)     → swaps FastAPI's get_db for the test session
"""

import pytest
import pytest_asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app

# Import all models so SQLAlchemy registers every table with Base.metadata.
# Use explicit names — bare `import app.models` would shadow the FastAPI `app`
# instance imported above, causing AttributeError on dependency_overrides.
from app.models import User, CalibrationProfile, Workout  # noqa: F401

TEST_DATABASE_URL = "sqlite:///:memory:"


# ---------------------------------------------------------------------------
# Engine — created once for the whole test session
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


# ---------------------------------------------------------------------------
# DB session — one per test, always rolled back so tests stay independent
# ---------------------------------------------------------------------------

@pytest.fixture
def db_session(test_engine):
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestSession()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


# ---------------------------------------------------------------------------
# Dependency override — replaces get_db in the running FastAPI app
# autouse=True means this fixture is active for every test automatically
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def override_get_db(db_session):
    def _get_db_override():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _get_db_override
    yield
    app.dependency_overrides.clear()
