"""
test_app.py - Automated tests for the SafeBite API.

Run them with:  pytest

Each test gets a brand-new, empty SQLite database in a temporary folder,
so the tests never touch your real PostgreSQL data, and one test can't
affect another.
"""

import pytest

from app import create_app
from models import database

# Sample account details reused across the tests.
TEST_EMAIL = "sam@example.com"
TEST_PASSWORD = "goodpassword"


# ---------------------------------------------------------------------------
# Test setup
# ---------------------------------------------------------------------------

@pytest.fixture
def test_client(tmp_path):
    """Give each test a fake "phone" that can send requests to the API.

    A pytest fixture runs before each test that asks for it by name.
    tmp_path is a temporary folder pytest creates and deletes for us.
    """
    flask_app = create_app(
        {
            "TESTING": True,
            # A throwaway SQLite file instead of the real database.
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'test.db'}",
            "JWT_SECRET_KEY": "test-secret-key-that-is-long-enough-for-hs256",
        }
    )

    # "yield" hands the client to the test. Code after it runs once the
    # test is done, to clean up.
    with flask_app.test_client() as client:
        yield client

    with flask_app.app_context():
        database.drop_all()


def register_user(client, email=TEST_EMAIL, password=TEST_PASSWORD):
    """Create an account through the API and return the server's response."""
    return client.post("/api/register", json={"email": email, "password": password})


def get_token_for_new_user(client, email=TEST_EMAIL):
    """Create an account and return just its login token."""
    return register_user(client, email=email).get_json()["token"]


def auth_header(login_token):
    """Build the header the app sends to prove who is logged in."""
    return {"Authorization": f"Bearer {login_token}"}


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

def test_health_check_reports_ok(test_client):
    response = test_client.get("/api/health")
    assert response.get_json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# Creating an account
# ---------------------------------------------------------------------------

def test_register_returns_token_and_user(test_client):
    response = register_user(test_client)
    response_body = response.get_json()

    assert response.status_code == 201
    assert response_body["token"]
    assert response_body["user"]["email"] == TEST_EMAIL
    # The password (or its hash) must never be sent back to the app.
    assert "password" not in str(response_body["user"])


def test_register_cleans_up_email(test_client):
    # Extra spaces and capital letters should be removed.
    response = register_user(test_client, email="  Sam@Example.COM ")
    assert response.get_json()["user"]["email"] == TEST_EMAIL


def test_register_rejects_bad_email_and_short_password(test_client):
    assert register_user(test_client, email="not-an-email").status_code == 400
    assert register_user(test_client, password="short").status_code == 400


def test_register_rejects_duplicate_email(test_client):
    register_user(test_client)
    second_attempt = register_user(test_client)
    assert second_attempt.status_code == 409


# ---------------------------------------------------------------------------
# Logging in
# ---------------------------------------------------------------------------

def test_login_succeeds_and_fails_correctly(test_client):
    register_user(test_client)

    correct_login = test_client.post(
        "/api/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert correct_login.status_code == 200
    assert correct_login.get_json()["token"]

    wrong_password = test_client.post(
        "/api/login", json={"email": TEST_EMAIL, "password": "nope-nope"}
    )
    unknown_email = test_client.post(
        "/api/login", json={"email": "who@example.com", "password": TEST_PASSWORD}
    )
    assert wrong_password.status_code == 401
    assert unknown_email.status_code == 401

    # Both failures must give the exact same message, so the login form
    # can't reveal which emails have accounts.
    assert wrong_password.get_json()["error"] == unknown_email.get_json()["error"]


# ---------------------------------------------------------------------------
# Login token checks
# ---------------------------------------------------------------------------

def test_me_requires_a_valid_token(test_client):
    # No token at all.
    assert test_client.get("/api/me").status_code == 401
    # A made-up token.
    assert test_client.get("/api/me", headers=auth_header("garbage")).status_code == 401

    # A real token works.
    login_token = get_token_for_new_user(test_client)
    response = test_client.get("/api/me", headers=auth_header(login_token))
    assert response.status_code == 200
    assert response.get_json()["user"]["email"] == TEST_EMAIL


# ---------------------------------------------------------------------------
# Scans
# ---------------------------------------------------------------------------

def test_save_and_list_scans(test_client):
    login_token = get_token_for_new_user(test_client)

    first_scan = test_client.post(
        "/api/scans",
        json={"barcode": "012345678905", "barcode_type": "upc_a"},
        headers=auth_header(login_token),
    )
    test_client.post(
        "/api/scans", json={"barcode": "4006381333931"}, headers=auth_header(login_token)
    )
    assert first_scan.status_code == 201

    saved_scans = test_client.get(
        "/api/scans", headers=auth_header(login_token)
    ).get_json()["scans"]

    # Newest scan should come first.
    assert [scan["barcode"] for scan in saved_scans] == ["4006381333931", "012345678905"]
    assert saved_scans[1]["barcode_type"] == "upc_a"
    # Times should always include the UTC time zone.
    assert saved_scans[0]["scanned_at"].endswith("+00:00")


def test_users_cannot_see_each_others_scans(test_client):
    alice_token = get_token_for_new_user(test_client, email="alice@example.com")
    bob_token = get_token_for_new_user(test_client, email="bob@example.com")

    test_client.post("/api/scans", json={"barcode": "111"}, headers=auth_header(alice_token))

    bobs_scans = test_client.get(
        "/api/scans", headers=auth_header(bob_token)
    ).get_json()["scans"]
    assert bobs_scans == []


def test_save_scan_rejects_missing_or_huge_barcode(test_client):
    login_token = get_token_for_new_user(test_client)

    missing_barcode = test_client.post(
        "/api/scans", json={}, headers=auth_header(login_token)
    )
    huge_barcode = test_client.post(
        "/api/scans", json={"barcode": "9" * 200}, headers=auth_header(login_token)
    )
    assert missing_barcode.status_code == 400
    assert huge_barcode.status_code == 400

