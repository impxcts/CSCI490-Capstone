"""
app.py - All the API routes for SafeBite.

The phone app sends requests here, and these routes read and write the
database. To start the server, run:  python app.py
"""

import os
import re
from datetime import timedelta
from functools import wraps

from dotenv import load_dotenv
from flask import Blueprint, Flask, jsonify, request
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt_identity,
    jwt_required,
)
from flask_migrate import Migrate, stamp, upgrade
from sqlalchemy import inspect

from models import Product, Scan, Trigger, User, database
from services import food_lookup, matching
from services.food_lookup import get_product

# load the settings from the .env file (database address, secret key, etc.)
load_dotenv()

# quick check that an email looks like name@something.com
EMAIL_FORMAT_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

MIN_PASSWORD_LENGTH = 8
MAX_BARCODE_LENGTH = 128  # real barcodes are way shorter, this just blocks junk
MAX_BARCODE_TYPE_LENGTH = 32
RECENT_SCANS_LIMIT = 20  # how many scans the history shows
LOGIN_TOKEN_LIFETIME = timedelta(days=7)  # how long you stay logged in
DEFAULT_PORT = 5001  # not 5000, because Macs use that one for AirPlay
MAX_SWAPS = 3  # how many safer swaps to suggest
MAX_SWAP_CATEGORIES_TO_TRY = 2  # the product's most specific category, then one step up

# the migrations folder (next to this file, so it works no matter where you run it from)
MIGRATIONS_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migrations")

# the migrations that match how the database looked before we used migrations
REVISION_FIRST_TABLES = "0001_first_tables"  # just users and scans
REVISION_TRIGGERS_AND_PRODUCTS = "0002_triggers_and_products"  # the midterm MVP tables

# handles database migrations (changing tables without starting the database over)
migrate = Migrate()

# groups all our routes under /api
api_routes = Blueprint("api", __name__, url_prefix="/api")


def error_response(message, status_code):
    """Sends back an error in the {"error": "..."} format the app expects."""
    return jsonify({"error": message}), status_code


def read_email_and_password_from_request():
    """Grabs the email and password from what the app sent."""
    # silent=True means we get None instead of a crash if it isn't JSON
    request_body = request.get_json(silent=True) or {}
    # clean up the email so "Sam@Example.com " and "sam@example.com" match
    email = str(request_body.get("email", "")).strip().lower()
    password = str(request_body.get("password", ""))
    return email, password


def login_success_response(user, status_code=200):
    """Makes a login token for the user and sends it back with their info."""
    login_token = create_access_token(identity=str(user.id))
    return jsonify({"token": login_token, "user": user.to_dict()}), status_code


def get_logged_in_user():
    """Figures out who's logged in from the token they sent."""
    user_id = int(get_jwt_identity())
    return database.session.get(User, user_id)


def login_required(route_function):
    """Put this on any route that needs a login. It hands the route the logged-in user.

    This used to be the same few lines copied at the top of every route,
    so now it lives in one place.
    """
    @wraps(route_function)
    @jwt_required()  # blocks the request if there's no valid login token
    def route_with_user(*args, **kwargs):
        user = get_logged_in_user()
        # the token is fine but the account is gone (like if it got deleted)
        if user is None:
            return error_response("Account not found. Log in again.", 401)
        return route_function(user, *args, **kwargs)

    return route_with_user


def get_trigger_names(user):
    """Gets the list of things this user avoids, like ["milk", "garlic"]."""
    user_triggers = Trigger.query.filter_by(user_id=user.id).order_by(Trigger.id).all()
    return [trigger.name for trigger in user_triggers]


def build_profile_response(user):
    """Sends back the user's triggers plus all the preset options."""
    return jsonify({
        "triggers": get_trigger_names(user),
        "catalog": matching.get_catalog_for_app(),
    })


def build_scan_details(scan, product, trigger_names, lookup_status):
    """Puts a scan, its product, and its verdict together for the app."""
    scan_details = scan.to_dict()
    scan_details["product"] = product.to_dict() if product is not None else None
    # the verdict gets worked out fresh every time from the user's current triggers
    scan_details.update(matching.evaluate_product(product, trigger_names, lookup_status))
    return scan_details


# ----- routes you can use without logging in -----

@api_routes.get("/health")
def health_check():
    """Just says the server is running."""
    return jsonify({"status": "ok"})


@api_routes.post("/register")
def register():
    """Creates a new account and logs them in."""
    email, password = read_email_and_password_from_request()

    # the app checks these too, but we double check here
    if not EMAIL_FORMAT_PATTERN.match(email):
        return error_response("Enter a valid email address.", 400)

    if len(password) < MIN_PASSWORD_LENGTH:
        return error_response(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters.", 400
        )

    # make sure the email isn't already taken
    existing_user = User.query.filter_by(email=email).first()
    if existing_user is not None:
        return error_response(
            "An account with that email already exists. Log in instead.", 409
        )

    # save the new user (only the password hash gets stored)
    new_user = User(email=email)
    new_user.set_password(password)
    database.session.add(new_user)
    database.session.commit()

    return login_success_response(new_user, status_code=201)


@api_routes.post("/login")
def login():
    """Checks the email and password and logs them in if they match."""
    email, password = read_email_and_password_from_request()
    user = User.query.filter_by(email=email).first()

    # same message either way, so nobody can use this to find out who has an account
    if user is None or not user.check_password(password):
        return error_response("Email or password is incorrect.", 401)

    return login_success_response(user)


# ----- routes that need you to be logged in -----
# @login_required makes sure there's a valid login and passes in the user

@api_routes.get("/me")
@login_required
def get_current_user(user):
    """Sends back who's logged in. The app uses this to check a saved login."""
    return jsonify({"user": user.to_dict()})


@api_routes.post("/scans")
@login_required
def save_scan(user):
    """Looks up a scanned barcode, checks it against the user's triggers, and saves it."""
    request_body = request.get_json(silent=True) or {}
    barcode = str(request_body.get("barcode", "")).strip()

    # barcode type is optional, so save None if it's empty
    barcode_type = str(request_body.get("barcode_type", "")).strip()
    barcode_type = barcode_type[:MAX_BARCODE_TYPE_LENGTH] or None

    if not barcode:
        return error_response("No barcode was sent.", 400)

    if len(barcode) > MAX_BARCODE_LENGTH:
        return error_response("That barcode is too long to save.", 400)

    # get the product info (None means Open Food Facts couldn't be reached)
    product = get_product(barcode)
    lookup_status = matching.LOOKUP_OK if product is not None else matching.LOOKUP_FAILED

    # save the scan under whoever's logged in
    new_scan = Scan(user_id=user.id, barcode=barcode, barcode_type=barcode_type)
    database.session.add(new_scan)
    database.session.commit()

    scan_details = build_scan_details(new_scan, product, get_trigger_names(user), lookup_status)
    return jsonify({"scan": scan_details}), 201


@api_routes.get("/scans")
@login_required
def list_recent_scans(user):
    """Sends back the user's most recent scans with verdicts, newest first."""
    recent_scans = (
        Scan.query.filter_by(user_id=user.id)  # only this user's scans
        .order_by(Scan.scanned_at.desc(), Scan.id.desc())  # newest first
        .limit(RECENT_SCANS_LIMIT)
        .all()
    )

    # grab all the saved products for these scans in one go
    scanned_barcodes = {scan.barcode for scan in recent_scans}
    saved_products = Product.query.filter(Product.barcode.in_(scanned_barcodes)).all()
    products_by_barcode = {product.barcode: product for product in saved_products}

    # add the product and verdict to each scan
    trigger_names = get_trigger_names(user)
    scan_list = []
    for scan in recent_scans:
        product = products_by_barcode.get(scan.barcode)
        lookup_status = matching.LOOKUP_OK if product else matching.LOOKUP_NOT_ATTEMPTED
        scan_list.append(build_scan_details(scan, product, trigger_names, lookup_status))

    return jsonify({"scans": scan_list})


@api_routes.get("/profile")
@login_required
def get_profile(user):
    """Sends back the user's triggers and the preset options."""
    return build_profile_response(user)


@api_routes.put("/profile")
@login_required
def update_profile(user):
    """Replaces the user's whole trigger list with the one the app sent."""
    request_body = request.get_json(silent=True) or {}
    requested_triggers = request_body.get("triggers")
    if not isinstance(requested_triggers, list):
        return error_response("Send your triggers as a list.", 400)

    # clean up each name and skip duplicates
    cleaned_trigger_names = []
    for raw_name in requested_triggers:
        cleaned_name = matching.clean_trigger_name(raw_name)
        if cleaned_name is None:
            return error_response(
                f'"{raw_name}" can\'t be added. Use letters, numbers, spaces, '
                f"or hyphens, {matching.MIN_CUSTOM_TRIGGER_LENGTH}-"
                f"{matching.MAX_CUSTOM_TRIGGER_LENGTH} characters long.",
                400,
            )
        if cleaned_name not in cleaned_trigger_names:
            cleaned_trigger_names.append(cleaned_name)

    if len(cleaned_trigger_names) > matching.MAX_TRIGGERS_PER_USER:
        return error_response(
            f"You can add up to {matching.MAX_TRIGGERS_PER_USER} triggers.", 400
        )

    # delete the old list and save the new one
    Trigger.query.filter_by(user_id=user.id).delete()
    for trigger_name in cleaned_trigger_names:
        database.session.add(Trigger(user_id=user.id, name=trigger_name))
    database.session.commit()

    return build_profile_response(user)


@api_routes.get("/products/<barcode>/swaps")
@login_required
def find_safer_swaps(user, barcode):
    """Finds similar products that are Safe for this user (like other chocolate spreads)."""
    trigger_names = get_trigger_names(user)
    if not trigger_names:
        return jsonify({
            "swaps": [],
            "message": "Add what you avoid in your Profile first, so we know what's safe for you.",
        })

    product = get_product(barcode)
    if product is None:
        return error_response("Couldn't reach the food database. Try again in a minute.", 503)

    # we need to know what kind of product it is to find similar ones
    category_names = product.category_names or []
    if not product.was_found or not category_names:
        return jsonify({
            "swaps": [],
            "message": "We don't know what kind of product this is, so we can't suggest swaps.",
        })

    swaps = []
    # start with the most specific category, then try one step more general
    for category_name in reversed(category_names[-MAX_SWAP_CATEGORIES_TO_TRY:]):
        try:
            similar_products = food_lookup.search_similar_products(
                category_name, exclude_barcode=barcode
            )
        except food_lookup.FoodLookupError:
            return error_response("Couldn't reach the food database. Try again in a minute.", 503)

        # keep the ones that come back Safe with this user's triggers
        for similar_product in similar_products:
            result = matching.evaluate_product(similar_product, trigger_names)
            if result["verdict"] == matching.VERDICT_SAFE:
                swaps.append(similar_product.to_dict())
            if len(swaps) == MAX_SWAPS:
                break

        # found some, so no need to search again
        if swaps:
            break

    message = "" if swaps else "Couldn't find a similar product that's safe for you yet."
    return jsonify({"swaps": swaps, "message": message})


# ----- setting up the app -----

def use_psycopg2_driver(database_url):
    """Tells SQLAlchemy to use the psycopg2 driver for PostgreSQL.

    Newer SQLAlchemy versions look for a different driver by default and crash
    without this. Anything that isn't PostgreSQL (like SQLite) is left alone.
    """
    for plain_prefix in ("postgresql://", "postgres://"):
        if database_url.startswith(plain_prefix):
            return "postgresql+psycopg2://" + database_url[len(plain_prefix):]
    return database_url


def create_app(config_overrides=None):
    """Sets up the Flask app. The tests pass in config_overrides to use a test database."""
    flask_app = Flask(__name__)

    # where the database is (from .env, or a local "safebite" database)
    flask_app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL", "postgresql://localhost/safebite"
    )

    # the secret key that signs login tokens (the real one goes in .env)
    flask_app.config["JWT_SECRET_KEY"] = os.environ.get(
        "JWT_SECRET_KEY", "dev-only-secret-change-me-before-any-real-deployment"
    )
    flask_app.config["JWT_ACCESS_TOKEN_EXPIRES"] = LOGIN_TOKEN_LIFETIME

    if config_overrides:
        flask_app.config.update(config_overrides)

    flask_app.config["SQLALCHEMY_DATABASE_URI"] = use_psycopg2_driver(
        flask_app.config["SQLALCHEMY_DATABASE_URI"]
    )

    database.init_app(flask_app)
    token_manager = JWTManager(flask_app)

    # these make login token errors use our {"error": ...} format too
    @token_manager.unauthorized_loader
    def handle_missing_token(reason):
        return error_response("You need to log in first.", 401)

    @token_manager.invalid_token_loader
    def handle_invalid_token(reason):
        return error_response("Your login is invalid. Log in again.", 401)

    @token_manager.expired_token_loader
    def handle_expired_token(token_header, token_payload):
        return error_response("Your login expired. Log in again.", 401)

    flask_app.register_blueprint(api_routes)

    # hook up migrations (the files that build and change the tables)
    # render_as_batch lets migrations change columns on SQLite too (used by the tests)
    migrate.init_app(flask_app, database, directory=MIGRATIONS_FOLDER, render_as_batch=True)

    return flask_app


def prepare_database(flask_app):
    """Gets the database up to date by running any migrations that haven't run yet."""
    with flask_app.app_context():
        existing_tables = set(inspect(database.engine).get_table_names())

        # databases made before we used migrations don't know which ones already
        # happened, so mark the ones that match the tables that are already there
        if "alembic_version" not in existing_tables:
            if {"triggers", "products"} <= existing_tables:
                stamp(revision=REVISION_TRIGGERS_AND_PRODUCTS)
            elif "users" in existing_tables:
                stamp(revision=REVISION_FIRST_TABLES)

        # run whatever's left (on a brand new database, that's all of them)
        upgrade()


# only runs when you start this file with "python app.py"
if __name__ == "__main__":
    port = int(os.environ.get("PORT", DEFAULT_PORT))

    flask_app = create_app()
    prepare_database(flask_app)

    # 0.0.0.0 lets your phone connect over Wi-Fi, not just the laptop
    # debug=True restarts the server when you save a file
    flask_app.run(host="0.0.0.0", port=port, debug=True)
