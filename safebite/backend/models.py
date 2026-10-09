"""
models.py - Database tables for SafeBite.

This file defines the two tables the backend uses right now:

    users  -> one row per account (email + hashed password)
    scans  -> one row per barcode a user scans, linked to that user

Each table is written as a Python class. Flask-SQLAlchemy reads these
classes and creates the matching tables in PostgreSQL, so we never have
to write CREATE TABLE statements by hand.
"""

from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

# The shared database object. app.py connects it to the Flask app with
# database.init_app(app), and every model below inherits from database.Model.
database = SQLAlchemy()


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def get_current_utc_time():
    """Return the current time in UTC.

    We always store times in UTC so the data is the same no matter which
    time zone the server or the user is in. The phone converts it to the
    user's local time when it displays it.
    """
    return datetime.now(timezone.utc)


def format_timestamp_as_iso(timestamp):
    """Turn a datetime into an ISO-8601 string that always includes a time zone.

    Example output: "2026-10-09T20:15:00+00:00"

    PostgreSQL keeps the time zone on saved timestamps, but SQLite (used in
    the automated tests) drops it. If the time zone is missing, we add UTC
    back so the phone always receives the same format.
    """
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    return timestamp.isoformat()


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------

class User(database.Model):
    """One SafeBite account."""

    __tablename__ = "users"

    # Unique number for each user. PostgreSQL assigns it automatically.
    id = database.Column(database.Integer, primary_key=True)

    # Email is unique so two accounts can't share one. index=True makes
    # looking a user up by email (which happens on every login) fast.
    email = database.Column(database.String(255), unique=True, nullable=False, index=True)

    # We never store the real password, only a one-way hash of it.
    # See set_password() below.
    password_hash = database.Column(database.String(255), nullable=False)

    # When the account was created.
    created_at = database.Column(
        database.DateTime(timezone=True), default=get_current_utc_time, nullable=False
    )

    # Lets us write user.scans to get every scan this user made.
    # cascade="all, delete-orphan" means deleting a user also deletes
    # their scans, so no scans are left pointing at a missing user.
    scans = database.relationship(
        "Scan", backref="user", lazy=True, cascade="all, delete-orphan"
    )

    def set_password(self, plain_text_password):
        """Hash the password and store only the hash.

        A hash is a one-way scramble. It's easy to make from the password but
        practically impossible to turn back into the password, so even if the
        database leaked, the real passwords wouldn't.
        """
        self.password_hash = generate_password_hash(plain_text_password)

    def check_password(self, plain_text_password):
        """Return True if the typed password matches the stored hash."""
        return check_password_hash(self.password_hash, plain_text_password)

    def to_dict(self):
        """Return the user as a dictionary that can be sent to the app as JSON.

        The password hash is deliberately left out. It should never leave
        the server.
        """
        return {
            "id": self.id,
            "email": self.email,
            "created_at": format_timestamp_as_iso(self.created_at),
        }


class Scan(database.Model):
    """One barcode that a user scanned."""

    __tablename__ = "scans"

    # Unique number for each scan.
    id = database.Column(database.Integer, primary_key=True)

    # Which user made this scan. ForeignKey links it to users.id, so the
    # database won't allow a scan for a user that doesn't exist.
    # index=True makes "get all scans for this user" fast.
    user_id = database.Column(
        database.Integer, database.ForeignKey("users.id"), nullable=False, index=True
    )

    # The number read from the barcode, e.g. "041196910759".
    # Stored as text, not a number, because barcodes can start with zeros.
    barcode = database.Column(database.String(128), nullable=False)

    # The barcode format reported by the camera, e.g. "upc_a" or "ean13".
    # Optional, since it isn't needed to identify the product.
    barcode_type = database.Column(database.String(32), nullable=True)

    # When the scan happened.
    scanned_at = database.Column(
        database.DateTime(timezone=True), default=get_current_utc_time, nullable=False
    )

    def to_dict(self):
        """Return the scan as a dictionary that can be sent to the app as JSON."""
        return {
            "id": self.id,
            "barcode": self.barcode,
            "barcode_type": self.barcode_type,
            "scanned_at": format_timestamp_as_iso(self.scanned_at),
        }

