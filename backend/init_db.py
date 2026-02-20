"""
Initialize the SQLite database.
"""
from app.database import engine, Base
from app.models.user import User
from app.models.calibration import CalibrationProfile
from app.models.workout import Workout

def init_db():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

if __name__ == "__main__":
    init_db()
