"""save each product's categories (for safer swaps)

Revision ID: 0003_product_categories
Revises: 0002_triggers_and_products
Create Date: 2026-10-15
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic
revision = "0003_product_categories"
down_revision = "0002_triggers_and_products"
branch_labels = None
depends_on = None


def upgrade():
    # add the new column (empty for products we already saved, so those get looked up again)
    with op.batch_alter_table("products") as batch_op:
        batch_op.add_column(sa.Column("category_names", sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table("products") as batch_op:
        batch_op.drop_column("category_names")
