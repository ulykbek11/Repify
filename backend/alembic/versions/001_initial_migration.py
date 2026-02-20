"""001 Initial Migration — создание таблиц

Revision ID: 001
Revises: None
Create Date: 2025-02-17

Создаёт таблицы:
- users: пользователи (связаны с Supabase Auth)
- calibration_profiles: персонализированные профили калибровки
- workouts: история тренировок
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Создание таблиц."""

    # === Users ===
    op.create_table(
        "users",
        sa.Column("id", sa.String(255), primary_key=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    # === Calibration Profiles ===
    op.create_table(
        "calibration_profiles",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", sa.String(255), nullable=False),
        sa.Column("exercise_type", sa.String(50), nullable=False),
        sa.Column("anthropometry", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("baseline_metrics", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("safe_ranges", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("movement_patterns", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("recommendations", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column("calibration_reps_count", sa.Integer(), nullable=False, server_default="5"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "exercise_type", name="uq_user_exercise"),
    )
    op.create_index("ix_calibration_user_id", "calibration_profiles", ["user_id"])
    op.create_index("ix_calibration_exercise_type", "calibration_profiles", ["exercise_type"])

    # === Workouts ===
    op.create_table(
        "workouts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", sa.String(255), nullable=False),
        sa.Column("exercise_type", sa.String(50), nullable=False),
        sa.Column("reps_completed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("technique_scores", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("average_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("notes", sa.String(1000), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_workout_user_id", "workouts", ["user_id"])
    op.create_index("ix_workout_exercise_type", "workouts", ["exercise_type"])
    op.create_index("ix_workout_created_at", "workouts", ["created_at"])


def downgrade() -> None:
    """Удаление таблиц."""
    op.drop_table("workouts")
    op.drop_table("calibration_profiles")
    op.drop_table("users")
