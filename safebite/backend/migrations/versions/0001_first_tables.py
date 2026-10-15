"""the first tables: users and scans (the prototype)

Revision ID: 0001_first_tables
Revises:
Create Date: 2026-09-22
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic
revision = "0001_first_tables"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # accounts
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # every barcode someone scanned
    op.create_table(
        "scans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("barcode", sa.String(length=128), nullable=False),
        sa.Column("barcode_type", sa.String(length=32), nullable=True),
        sa.Column("scanned_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scans_user_id", "scans", ["user_id"], unique=False)


def downgrade():
    # undo it, newest table first
    op.drop_index("ix_scans_user_id", table_name="scans")
    op.drop_table("scans")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
