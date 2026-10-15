"""
models.py - The database tables.

    users     -> accounts (email + hashed password)
    scans     -> every barcode someone scanned
    triggers  -> the ingredients each user wants to avoid
    products  -> product info we got from Open Food Facts

Each class below is a table. If you change one, make a migration so the
database gets updated too (see the migrations/ folder and the README).
"""

from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

# the database object every table uses
database = SQLAlchemy()


def get_current_utc_time():
    """Gets the current time in UTC (the phone converts it to local time)."""
    return datetime.now(timezone.utc)


def format_timestamp_as_iso(timestamp):
    """Turns a time into text like "2026-10-09T20:15:00+00:00"."""
    # SQLite drops the time zone, so add UTC back if it's missing
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    return timestamp.isoformat()


class User(database.Model):
    """One account."""

    __tablename__ = "users"

    id = database.Column(database.Integer, primary_key=True)

    # unique so two accounts can't share an email
    email = database.Column(database.String(255), unique=True, nullable=False, index=True)

    # we only ever store a hash of the password, never the real thing
    password_hash = database.Column(database.String(255), nullable=False)

    created_at = database.Column(
        database.DateTime(timezone=True), default=get_current_utc_time, nullable=False
    )

    # lets us do user.scans, and deletes their scans if the user gets deleted
    scans = database.relationship(
        "Scan", backref="user", lazy=True, cascade="all, delete-orphan"
    )

    def set_password(self, plain_text_password):
        """Hashes the password and saves the hash."""
        self.password_hash = generate_password_hash(plain_text_password)

    def check_password(self, plain_text_password):
        """Checks if a typed password matches the saved hash."""
        return check_password_hash(self.password_hash, plain_text_password)

    def to_dict(self):
        """Turns the user into a dictionary to send to the app (no password hash)."""
        return {
            "id": self.id,
            "email": self.email,
            "created_at": format_timestamp_as_iso(self.created_at),
        }


class Scan(database.Model):
    """One barcode someone scanned."""

    __tablename__ = "scans"

    id = database.Column(database.Integer, primary_key=True)

    # which user scanned it
    user_id = database.Column(
        database.Integer, database.ForeignKey("users.id"), nullable=False, index=True
    )

    # saved as text, not a number, since barcodes can start with 0
    barcode = database.Column(database.String(128), nullable=False)

    # the barcode format, like "upc_a" or "ean13"
    barcode_type = database.Column(database.String(32), nullable=True)

    scanned_at = database.Column(
        database.DateTime(timezone=True), default=get_current_utc_time, nullable=False
    )

    def to_dict(self):
        """Turns the scan into a dictionary to send to the app."""
        return {
            "id": self.id,
            "barcode": self.barcode,
            "barcode_type": self.barcode_type,
            "scanned_at": format_timestamp_as_iso(self.scanned_at),
        }


class Trigger(database.Model):
    """One thing a user avoids, either a preset like "milk" or their own like "garlic"."""

    __tablename__ = "triggers"

    # stops a user from adding the same trigger twice
    __table_args__ = (
        database.UniqueConstraint("user_id", "name", name="unique_trigger_per_user"),
    )

    id = database.Column(database.Integer, primary_key=True)

    # which user it belongs to
    user_id = database.Column(
        database.Integer, database.ForeignKey("users.id"), nullable=False, index=True
    )

    # the preset key or whatever the user typed, all lowercase
    name = database.Column(database.String(60), nullable=False)

    created_at = database.Column(
        database.DateTime(timezone=True), default=get_current_utc_time, nullable=False
    )


class Product(database.Model):
    """Product info from Open Food Facts, saved so we only look it up once."""

    __tablename__ = "products"

    # the barcode is the product's ID
    barcode = database.Column(database.String(128), primary_key=True)

    # False if Open Food Facts didn't have it
    was_found = database.Column(database.Boolean, nullable=False, default=False)

    name = database.Column(database.String(300), nullable=True)
    brand = database.Column(database.String(300), nullable=True)

    # the full ingredient list from the label
    ingredients_text = database.Column(database.Text, nullable=True)

    # non-English lists get a Caution, since we only know English ingredient names
    ingredients_in_english = database.Column(database.Boolean, nullable=False, default=True)

    # allergens like ["en:milk"] and "may contain" warnings like ["en:peanuts"]
    allergen_tags = database.Column(database.JSON, nullable=False, default=list)
    may_contain_tags = database.Column(database.JSON, nullable=False, default=list)

    # link to a small photo of the package
    image_url = database.Column(database.String(500), nullable=True)

    # what kind of product it is, from general to specific, like
    # ["Spreads", "Sweet spreads", "Chocolate spreads"] (used to find safer swaps)
    # None means we looked it up before we started saving categories
    category_names = database.Column(database.JSON, nullable=True)

    # when we last looked it up
    fetched_at = database.Column(
        database.DateTime(timezone=True), default=get_current_utc_time, nullable=False
    )

    def to_dict(self):
        """Turns the product into a dictionary to send to the app."""
        return {
            "barcode": self.barcode,
            "was_found": self.was_found,
            "name": self.name,
            "brand": self.brand,
            "ingredients_text": self.ingredients_text,
            "image_url": self.image_url,
        }
