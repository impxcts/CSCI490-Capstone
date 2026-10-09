"""
app.py - The SafeBite backend API, built with Flask.

The phone app never talks to the database directly. Instead it sends HTTP
requests to the routes in this file, and these routes read and write the
database. That keeps all the rules (like "you can only see your own scans")
on the server, where users can't change them.

Routes:
    GET  /api/health     Is the server running?
    POST /api/register   Create an account. Returns a login token.
    POST /api/login      Check email + password. Returns a login token.
    GET  /api/me         Who is logged in?              (login required)
    POST /api/scans      Save a scanned barcode.        (login required)
    GET  /api/scans      List my most recent scans.     (login required)

To start the server:  python app.py
"""

import os
import re
from datetime import timedelta

from dotenv import load_dotenv
from flask import Blueprint, Flask, jsonify, request
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt_identity,
    jwt_required,
)

from models import Scan, User, database

# Read private settings (database address, secret key) from backend/.env
# into environment variables. If there's no .env file, the defaults in
# create_app() below are used instead.
load_dotenv()


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

# A simple check that an email looks like "something@something.something".
# It doesn't prove the email exists; it just catches obvious typos.
EMAIL_FORMAT_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Shortest password allowed when creating an account.
MIN_PASSWORD_LENGTH = 8

# Longest barcode we'll save. Real product barcodes are 8-14 digits, so
# this leaves plenty of room while blocking junk data.
MAX_BARCODE_LENGTH = 128

# Longest barcode type we'll save. Matches the column size in models.py.
MAX_BARCODE_TYPE_LENGTH = 32

# How many scans GET /api/scans returns.
RECENT_SCANS_LIMIT = 20

# How long a login lasts before the user has to log in again.
LOGIN_TOKEN_LIFETIME = timedelta(days=7)

# Port the server runs on. Not Flask's usual 5000, because macOS uses
# port 5000 for AirPlay Receiver.
DEFAULT_PORT = 5001

# A Blueprint is a group of routes. Putting all routes under "/api" keeps
# them separate from anything else the server might serve later.
api_routes = Blueprint("api", __name__, url_prefix="/api")


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def error_response(message, status_code):
    """Build an error reply in the one shape the app expects: {"error": "..."}.

    Every error uses this shape so the app only has to handle one format,
    and it can show the message directly to the user.
    """
    return jsonify({"error": message}), status_code


def read_email_and_password_from_request():
    """Pull the email and password out of the JSON the app sent.

    The email is trimmed and lowercased so "Sam@Example.com " and
    "sam@example.com" count as the same account. The password is left
    exactly as typed, since spaces and capitals matter in passwords.
    """
    # silent=True returns None instead of crashing if the body isn't JSON.
    request_body = request.get_json(silent=True) or {}
    email = str(request_body.get("email", "")).strip().lower()
    password = str(request_body.get("password", ""))
    return email, password


def login_success_response(user, status_code=200):
    """Create a login token for this user and send it back with their info.

    The token (a JWT) is a signed pass that says "this is user #5". The app
    sends it with every later request, so the server knows who is asking
    without needing the password again. It's signed with JWT_SECRET_KEY,
    so it can't be forged or edited without that key.
    """
    login_token = create_access_token(identity=str(user.id))
    return jsonify({"token": login_token, "user": user.to_dict()}), status_code


def get_logged_in_user():
    """Look up the user whose login token came with this request.

    Only works inside a route marked @jwt_required(). Returns None if the
    account was deleted after the token was issued.
    """
    user_id = int(get_jwt_identity())
    return database.session.get(User, user_id)


# ---------------------------------------------------------------------------
# Routes that don't need a login
# ---------------------------------------------------------------------------

@api_routes.get("/health")
def health_check():
    """Let anyone check that the server is up. Useful for troubleshooting."""
    return jsonify({"status": "ok"})


@api_routes.post("/register")
def register():
    """Create a new account and log the user in right away."""
    email, password = read_email_and_password_from_request()

    # The app checks these too, but the server must check again, since
    # anyone can send requests to the server without using the app.
    if not EMAIL_FORMAT_PATTERN.match(email):
        return error_response("Enter a valid email address.", 400)

    if len(password) < MIN_PASSWORD_LENGTH:
        return error_response(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters.", 400
        )

    existing_user = User.query.filter_by(email=email).first()
    if existing_user is not None:
        # 409 = "Conflict": this email is already taken.
        return error_response(
            "An account with that email already exists. Log in instead.", 409
        )

    new_user = User(email=email)
    new_user.set_password(password)  # stores only the hash
    database.session.add(new_user)
    database.session.commit()  # actually writes the row to the database

    # 201 = "Created".
    return login_success_response(new_user, status_code=201)


@api_routes.post("/login")
def login():
    """Check an email and password, and return a login token if they match."""
    email, password = read_email_and_password_from_request()
    user = User.query.filter_by(email=email).first()

    # We give the same message whether the email or the password is wrong.
    # Different messages would let someone use the login form to find out
    # which emails have SafeBite accounts.
    if user is None or not user.check_password(password):
        # 401 = "Unauthorized".
        return error_response("Email or password is incorrect.", 401)

    return login_success_response(user)


# ---------------------------------------------------------------------------
# Routes that need a login
# @jwt_required() rejects any request without a valid login token before
# the function even runs.
# ---------------------------------------------------------------------------

@api_routes.get("/me")
@jwt_required()
def get_current_user():
    """Return the logged-in user. The app uses this to check a saved login."""
    user = get_logged_in_user()
    if user is None:
        return error_response("Account not found. Log in again.", 401)
    return jsonify({"user": user.to_dict()})


@api_routes.post("/scans")
@jwt_required()
def save_scan():
    """Save one scanned barcode to the logged-in user's history."""
    user = get_logged_in_user()
    if user is None:
        return error_response("Account not found. Log in again.", 401)

    request_body = request.get_json(silent=True) or {}
    barcode = str(request_body.get("barcode", "")).strip()

    # The barcode type is optional. Trim it to fit the database column,
    # and store None (empty) instead of an empty string.
    barcode_type = str(request_body.get("barcode_type", "")).strip()
    barcode_type = barcode_type[:MAX_BARCODE_TYPE_LENGTH] or None

    if not barcode:
        return error_response("No barcode was sent.", 400)

    if len(barcode) > MAX_BARCODE_LENGTH:
        return error_response("That barcode is too long to save.", 400)

    # The user comes from the login token, never from the request body.
    # That way nobody can save scans into someone else's account.
    new_scan = Scan(user_id=user.id, barcode=barcode, barcode_type=barcode_type)
    database.session.add(new_scan)
    database.session.commit()

    return jsonify({"scan": new_scan.to_dict()}), 201


@api_routes.get("/scans")
@jwt_required()
def list_recent_scans():
    """Return the logged-in user's most recent scans, newest first."""
    user = get_logged_in_user()
    if user is None:
        return error_response("Account not found. Log in again.", 401)

    recent_scans = (
        Scan.query.filter_by(user_id=user.id)  # only this user's scans
        # Newest first. Sorting by id too breaks ties if two scans
        # happen at the exact same moment.
        .order_by(Scan.scanned_at.desc(), Scan.id.desc())
        .limit(RECENT_SCANS_LIMIT)
        .all()
    )
    return jsonify({"scans": [scan.to_dict() for scan in recent_scans]})


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

def create_app(config_overrides=None):
    """Build and configure the Flask app.

    config_overrides lets the automated tests swap in a temporary database
    and a test secret key without touching the real settings.
    """
    flask_app = Flask(__name__)

    # Where the database is. Comes from .env, or falls back to a local
    # PostgreSQL database named "safebite".
    flask_app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL", "postgresql://localhost/safebite"
    )

    # The secret used to sign login tokens. Anyone with this key could
    # create fake logins, so the real one lives in .env, never on GitHub.
    flask_app.config["JWT_SECRET_KEY"] = os.environ.get(
        "JWT_SECRET_KEY", "dev-only-secret-change-me-before-any-real-deployment"
    )
    flask_app.config["JWT_ACCESS_TOKEN_EXPIRES"] = LOGIN_TOKEN_LIFETIME

    if config_overrides:
        flask_app.config.update(config_overrides)

    database.init_app(flask_app)
    token_manager = JWTManager(flask_app)

    # By default, Flask-JWT-Extended reports token problems in its own
    # format. These three functions make them use our {"error": ...} format
    # instead, with messages a user can understand.
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

    # Create the users and scans tables if they don't exist yet.
    # Tables that already exist (and their data) are left alone.
    with flask_app.app_context():
        database.create_all()

    return flask_app


# This only runs when you start the file directly with "python app.py",
# not when the tests import it.
if __name__ == "__main__":
    port = int(os.environ.get("PORT", DEFAULT_PORT))

    # host="0.0.0.0" means "accept connections from other devices on the
    # network", so your phone can reach the server over Wi-Fi. Without it,
    # only the laptop itself could connect.
    # debug=True reloads the server when you save a file and shows detailed
    # errors. Turn it off before deploying anywhere public.
    create_app().run(host="0.0.0.0", port=port, debug=True)

