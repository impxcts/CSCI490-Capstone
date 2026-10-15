"""
test_migrations.py - Tests for the database migrations.

Run with:  pytest

Makes sure the migrations build the same tables as models.py, and that
databases made before we used migrations get upgraded without losing data.
"""

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from flask_migrate import upgrade
from sqlalchemy import inspect, text

from app import (
    REVISION_FIRST_TABLES,
    REVISION_TRIGGERS_AND_PRODUCTS,
    create_app,
    prepare_database,
)
from models import database


@pytest.fixture
def flask_app(tmp_path):
    """An app hooked up to an empty throwaway database."""
    return create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'test.db'}",
        "JWT_SECRET_KEY": "test-secret-key-that-is-long-enough-for-hs256",
    })


def make_old_style_database(flask_app, revision):
    """Builds the tables up to a migration, then forgets which migrations ran,
    which is exactly what a database made with the old create_all() looked like.
    """
    with flask_app.app_context():
        upgrade(revision=revision)
        with database.engine.begin() as connection:
            connection.execute(text("DROP TABLE alembic_version"))


def test_migrations_build_the_same_tables_as_the_models(flask_app):
    prepare_database(flask_app)

    with flask_app.app_context(), database.engine.connect() as connection:
        differences = compare_metadata(MigrationContext.configure(connection), database.metadata)

    # nothing missing or extra
    assert differences == []


def test_old_prototype_database_gets_upgraded_and_keeps_its_data(flask_app):
    make_old_style_database(flask_app, REVISION_FIRST_TABLES)
    with flask_app.app_context(), database.engine.begin() as connection:
        connection.execute(text(
            "INSERT INTO users (email, password_hash, created_at) "
            "VALUES ('old@example.com', 'hash', '2026-09-22 12:00:00')"
        ))

    prepare_database(flask_app)

    with flask_app.app_context(), database.engine.connect() as connection:
        table_names = set(inspect(connection).get_table_names())
        emails = connection.execute(text("SELECT email FROM users")).scalars().all()

    assert {"users", "scans", "triggers", "products"} <= table_names
    assert emails == ["old@example.com"]


def test_mvp_database_gets_the_new_column_and_keeps_its_data(flask_app):
    make_old_style_database(flask_app, REVISION_TRIGGERS_AND_PRODUCTS)
    with flask_app.app_context(), database.engine.begin() as connection:
        connection.execute(text(
            "INSERT INTO products (barcode, was_found, ingredients_in_english, allergen_tags, "
            "may_contain_tags, fetched_at) VALUES ('123', 1, 1, '[]', '[]', '2026-10-15 12:00:00')"
        ))

    prepare_database(flask_app)

    with flask_app.app_context(), database.engine.connect() as connection:
        column_names = [column["name"] for column in inspect(connection).get_columns("products")]
        barcodes = connection.execute(text("SELECT barcode FROM products")).scalars().all()

    assert "category_names" in column_names
    assert barcodes == ["123"]


def test_running_it_twice_is_fine(flask_app):
    prepare_database(flask_app)
    prepare_database(flask_app)
