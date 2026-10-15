"""
test_app.py - Tests for the API routes.

Run with:  pytest

Every test gets its own empty test database, so your real data is never touched.
"""

import pytest

from app import create_app, prepare_database
from models import Product, database
from services import food_lookup

# a test account we use over and over
TEST_EMAIL = "sam@example.com"
TEST_PASSWORD = "goodpassword"

# barcodes our fake Open Food Facts knows about
CHOCOLATE_BARCODE = "3017620422003"
UNKNOWN_BARCODE = "999999999999"
OUTAGE_BARCODE = "500500500500"

# what the fake Open Food Facts sends back for the chocolate spread
FAKE_CHOCOLATE_PRODUCT = {
    "name": "Hazelnut spread",
    "brand": "Test Brand",
    "ingredients_text": "Sugar, palm oil, hazelnuts, skimmed milk powder, cocoa",
    "ingredients_in_english": True,
    "allergen_tags": ["en:milk", "en:nuts"],
    "may_contain_tags": [],
    "image_url": None,
    "category_names": ["Spreads", "Sweet spreads", "Hazelnut spreads"],
}

# products the fake search sends back as "similar" to the chocolate spread
FAKE_SIMILAR_PRODUCTS = {
    "111111111111": {"name": "Milk-free hazelnut spread", "ingredients_text": "Hazelnuts, sugar, cocoa"},
    "222222222222": {"name": "Classic hazelnut spread", "ingredients_text": "Sugar, hazelnuts, skim milk"},
    "333333333333": {"name": "Sunflower seed spread", "ingredients_text": "Sunflower seeds, salt"},
}


# ----- setup -----

@pytest.fixture(autouse=True)
def fake_open_food_facts(monkeypatch):
    """Swaps in a fake Open Food Facts so the tests don't need the internet.

    autouse=True means every test gets this automatically. It also keeps a
    list of every barcode looked up, so we can check caching.
    """
    looked_up_barcodes = []

    def fake_fetch(barcode):
        looked_up_barcodes.append(barcode)
        if barcode == CHOCOLATE_BARCODE:
            return dict(FAKE_CHOCOLATE_PRODUCT)
        if barcode == OUTAGE_BARCODE:
            raise food_lookup.FoodLookupError("pretend the internet is down")
        return None  # not found

    monkeypatch.setattr(food_lookup, "fetch_from_open_food_facts", fake_fetch)
    return looked_up_barcodes


@pytest.fixture(autouse=True)
def fake_search(monkeypatch):
    """Swaps in a fake Open Food Facts search for the safer swaps tests.

    Keeps a list of the categories searched, so tests can check them.
    """
    searched_categories = []

    def fake_search_similar_products(category_name, exclude_barcode):
        searched_categories.append(category_name)
        similar_products = []
        for barcode, fields in FAKE_SIMILAR_PRODUCTS.items():
            product = Product(
                barcode=barcode, was_found=True, name=fields["name"],
                ingredients_text=fields["ingredients_text"], ingredients_in_english=True,
                allergen_tags=[], may_contain_tags=[], category_names=["Hazelnut spreads"],
            )
            similar_products.append(product)
        return similar_products

    monkeypatch.setattr(food_lookup, "search_similar_products", fake_search_similar_products)
    return searched_categories


@pytest.fixture
def test_client(tmp_path):
    """Gives each test a fake "phone" that can send requests to the API."""
    flask_app = create_app(
        {
            "TESTING": True,
            # a throwaway SQLite database instead of the real one
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'test.db'}",
            "JWT_SECRET_KEY": "test-secret-key-that-is-long-enough-for-hs256",
        }
    )

    # build the tables by running the migrations, just like the real server does
    prepare_database(flask_app)

    # hand the client to the test, then clean up after
    with flask_app.test_client() as client:
        yield client

    with flask_app.app_context():
        database.drop_all()


def register_user(client, email=TEST_EMAIL, password=TEST_PASSWORD):
    """Makes an account and gives back the server's response."""
    return client.post("/api/register", json={"email": email, "password": password})


def get_token_for_new_user(client, email=TEST_EMAIL):
    """Makes an account and gives back just its login token."""
    return register_user(client, email=email).get_json()["token"]


def auth_header(login_token):
    """Builds the header that proves who's logged in."""
    return {"Authorization": f"Bearer {login_token}"}


# ----- health check -----

def test_health_check_reports_ok(test_client):
    response = test_client.get("/api/health")
    assert response.get_json() == {"status": "ok"}


# ----- creating an account -----

def test_register_returns_token_and_user(test_client):
    response = register_user(test_client)
    response_body = response.get_json()

    assert response.status_code == 201
    assert response_body["token"]
    assert response_body["user"]["email"] == TEST_EMAIL
    # the password should never get sent back
    assert "password" not in str(response_body["user"])


def test_register_cleans_up_email(test_client):
    # extra spaces and capital letters get cleaned up
    response = register_user(test_client, email="  Sam@Example.COM ")
    assert response.get_json()["user"]["email"] == TEST_EMAIL


def test_register_rejects_bad_email_and_short_password(test_client):
    assert register_user(test_client, email="not-an-email").status_code == 400
    assert register_user(test_client, password="short").status_code == 400


def test_register_rejects_duplicate_email(test_client):
    register_user(test_client)
    second_attempt = register_user(test_client)
    assert second_attempt.status_code == 409


# ----- logging in -----

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

    # both should give the exact same message
    assert wrong_password.get_json()["error"] == unknown_email.get_json()["error"]


# ----- login tokens -----

def test_me_requires_a_valid_token(test_client):
    # no token
    assert test_client.get("/api/me").status_code == 401
    # a fake token
    assert test_client.get("/api/me", headers=auth_header("garbage")).status_code == 401

    # a real token works
    login_token = get_token_for_new_user(test_client)
    response = test_client.get("/api/me", headers=auth_header(login_token))
    assert response.status_code == 200
    assert response.get_json()["user"]["email"] == TEST_EMAIL


# ----- scans -----

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

    # newest one should be first
    assert [scan["barcode"] for scan in saved_scans] == ["4006381333931", "012345678905"]
    assert saved_scans[1]["barcode_type"] == "upc_a"
    # times should always have the UTC time zone on them
    assert saved_scans[0]["scanned_at"].endswith("+00:00")


def test_users_cannot_see_each_others_scans(test_client):
    alice_token = get_token_for_new_user(test_client, email="alice@example.com")
    bob_token = get_token_for_new_user(test_client, email="bob@example.com")

    test_client.post("/api/scans", json={"barcode": "111"}, headers=auth_header(alice_token))

    # Bob shouldn't see Alice's scan
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


# ----- health profile -----

def save_triggers(client, login_token, trigger_names):
    """Saves a list of triggers and gives back the response."""
    return client.put(
        "/api/profile", json={"triggers": trigger_names}, headers=auth_header(login_token)
    )


def test_profile_starts_empty_and_includes_presets(test_client):
    login_token = get_token_for_new_user(test_client)
    profile = test_client.get("/api/profile", headers=auth_header(login_token)).get_json()

    assert profile["triggers"] == []
    preset_keys = [
        trigger["key"] for group in profile["catalog"] for trigger in group["triggers"]
    ]
    assert "milk" in preset_keys and "added_sugars" in preset_keys


def test_saving_profile_cleans_up_and_removes_duplicates(test_client):
    login_token = get_token_for_new_user(test_client)
    response = save_triggers(test_client, login_token, ["milk", "Garlic", "garlic", "Peanuts"])

    assert response.status_code == 200
    assert response.get_json()["triggers"] == ["milk", "garlic", "peanuts"]

    # saving again replaces the whole list
    save_triggers(test_client, login_token, ["eggs"])
    profile = test_client.get("/api/profile", headers=auth_header(login_token)).get_json()
    assert profile["triggers"] == ["eggs"]


def test_saving_profile_rejects_bad_input(test_client):
    login_token = get_token_for_new_user(test_client)
    assert save_triggers(test_client, login_token, ["<script>"]).status_code == 400
    assert save_triggers(test_client, login_token, "milk").status_code == 400


def test_profile_requires_login(test_client):
    assert test_client.get("/api/profile").status_code == 401


# ----- scanning with lookups and verdicts -----

def scan_barcode(client, login_token, barcode):
    """Scans a barcode and gives back the scan details."""
    response = client.post(
        "/api/scans", json={"barcode": barcode, "barcode_type": "ean13"},
        headers=auth_header(login_token),
    )
    assert response.status_code == 201
    return response.get_json()["scan"]


def test_scan_looks_up_product_and_flags_triggers(test_client):
    login_token = get_token_for_new_user(test_client)
    save_triggers(test_client, login_token, ["milk", "tree_nuts"])

    scan = scan_barcode(test_client, login_token, CHOCOLATE_BARCODE)

    assert scan["product"]["name"] == "Hazelnut spread"
    assert scan["verdict"] == "avoid"
    messages = [reason["message"] for reason in scan["reasons"]]
    assert "Contains milk powder (a milk ingredient)" in messages
    assert "Contains hazelnuts (a tree nut)" in messages


def test_scan_without_profile_is_unchecked(test_client):
    login_token = get_token_for_new_user(test_client)
    scan = scan_barcode(test_client, login_token, CHOCOLATE_BARCODE)
    assert scan["verdict"] == "unchecked"


def test_unknown_product_is_caution(test_client):
    login_token = get_token_for_new_user(test_client)
    save_triggers(test_client, login_token, ["milk"])

    scan = scan_barcode(test_client, login_token, UNKNOWN_BARCODE)
    assert scan["product"]["was_found"] is False
    assert scan["verdict"] == "caution"


def test_lookup_outage_is_caution_and_still_saves_scan(test_client):
    login_token = get_token_for_new_user(test_client)
    save_triggers(test_client, login_token, ["milk"])

    scan = scan_barcode(test_client, login_token, OUTAGE_BARCODE)
    assert scan["product"] is None
    assert scan["verdict"] == "caution"

    # the scan still gets saved even though the lookup failed
    history = test_client.get("/api/scans", headers=auth_header(login_token)).get_json()["scans"]
    assert history[0]["barcode"] == OUTAGE_BARCODE


def test_products_are_only_looked_up_once(test_client, fake_open_food_facts):
    login_token = get_token_for_new_user(test_client)
    scan_barcode(test_client, login_token, CHOCOLATE_BARCODE)
    scan_barcode(test_client, login_token, CHOCOLATE_BARCODE)

    # the second scan should use the saved copy
    assert fake_open_food_facts.count(CHOCOLATE_BARCODE) == 1


def test_history_verdicts_follow_profile_changes(test_client):
    login_token = get_token_for_new_user(test_client)
    save_triggers(test_client, login_token, ["eggs"])
    scan_barcode(test_client, login_token, CHOCOLATE_BARCODE)

    def latest_verdict():
        history = test_client.get("/api/scans", headers=auth_header(login_token)).get_json()
        return history["scans"][0]["verdict"]

    # no eggs in it, so it's safe... until we add milk
    assert latest_verdict() == "safe"
    save_triggers(test_client, login_token, ["eggs", "milk"])
    assert latest_verdict() == "avoid"


def test_postgres_addresses_use_the_installed_driver():
    from app import use_psycopg2_driver

    assert use_psycopg2_driver("postgresql://localhost/safebite") == (
        "postgresql+psycopg2://localhost/safebite"
    )
    assert use_psycopg2_driver("sqlite:///dev.db") == "sqlite:///dev.db"


def test_multi_word_presets_save_as_presets(test_client):
    # presets with underscores should stay as presets
    login_token = get_token_for_new_user(test_client)
    response = save_triggers(test_client, login_token, ["garlic_onion", "tree_nuts", "added_sugars"])
    assert response.get_json()["triggers"] == ["garlic_onion", "tree_nuts", "added_sugars"]


# ----- safer swaps -----

def get_swaps(client, login_token, barcode=CHOCOLATE_BARCODE):
    """Asks for safer swaps and gives back the response."""
    return client.get(f"/api/products/{barcode}/swaps", headers=auth_header(login_token))


def test_swaps_only_suggest_products_that_are_safe_for_you(test_client, fake_search):
    login_token = get_token_for_new_user(test_client)
    save_triggers(test_client, login_token, ["milk"])

    response = get_swaps(test_client, login_token)
    swap_names = [swap["name"] for swap in response.get_json()["swaps"]]

    # the one with milk gets left out
    assert response.status_code == 200
    assert swap_names == ["Milk-free hazelnut spread", "Sunflower seed spread"]
    # it searched the most specific category
    assert fake_search == ["Hazelnut spreads"]


def test_swaps_try_a_more_general_category_if_nothing_is_safe(test_client, fake_search):
    login_token = get_token_for_new_user(test_client)
    # every fake similar product has something on this list
    save_triggers(test_client, login_token, ["milk", "tree_nuts", "sugar_alcohols", "salt"])

    response = get_swaps(test_client, login_token)

    assert response.get_json()["swaps"] == []
    assert response.get_json()["message"]
    assert fake_search == ["Hazelnut spreads", "Sweet spreads"]


def test_swaps_need_a_profile_first(test_client):
    login_token = get_token_for_new_user(test_client)
    response = get_swaps(test_client, login_token)
    assert response.get_json()["swaps"] == []
    assert "Profile" in response.get_json()["message"]


def test_swaps_for_an_unknown_product(test_client):
    login_token = get_token_for_new_user(test_client)
    save_triggers(test_client, login_token, ["milk"])
    response = get_swaps(test_client, login_token, barcode=UNKNOWN_BARCODE)
    assert response.get_json()["swaps"] == []


def test_swaps_when_the_search_is_down(test_client, monkeypatch):
    def broken_search(category_name, exclude_barcode):
        raise food_lookup.FoodLookupError("pretend the internet is down")

    monkeypatch.setattr(food_lookup, "search_similar_products", broken_search)
    login_token = get_token_for_new_user(test_client)
    save_triggers(test_client, login_token, ["milk"])

    assert get_swaps(test_client, login_token).status_code == 503


def test_swaps_require_login(test_client):
    assert test_client.get(f"/api/products/{CHOCOLATE_BARCODE}/swaps").status_code == 401
