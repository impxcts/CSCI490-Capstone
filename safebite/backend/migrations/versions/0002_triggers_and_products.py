"""triggers and products tables (the midterm MVP)

Revision ID: 0002_triggers_and_products
Revises: 0001_first_tables
Create Date: 2026-10-15
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic
revision = "0002_triggers_and_products"
down_revision = "0001_first_tables"
branch_labels = None
depends_on = None


def upgrade():
    # what each user wants to avoid
    op.create_table(
        "triggers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="unique_trigger_per_user"),
    )
    op.create_index("ix_triggers_user_id", "triggers", ["user_id"], unique=False)

    # product info we got from Open Food Facts
    op.create_table(
        "products",
        sa.Column("barcode", sa.String(length=128), nullable=False),
        sa.Column("was_found", sa.Boolean(), nullable=False),
        sa.Column("name", sa.String(length=300), nullable=True),
        sa.Column("brand", sa.String(length=300), nullable=True),
        sa.Column("ingredients_text", sa.Text(), nullable=True),
        sa.Column("ingredients_in_english", sa.Boolean(), nullable=False),
        sa.Column("allergen_tags", sa.JSON(), nullable=False),
        sa.Column("may_contain_tags", sa.JSON(), nullable=False),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("barcode"),
    )


def downgrade():
    op.drop_table("products")
    op.drop_index("ix_triggers_user_id", table_name="triggers")
    op.drop_table("triggers")
