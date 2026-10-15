"""
test_food_lookup.py - Tests for reading Open Food Facts' responses.

Run with:  pytest

These use fake responses, so they don't need the internet.
"""

import pytest
import requests

from app import create_app, prepare_database
from models import Product, database
from services import food_lookup


class FakeResponse:
    """Pretends to be what requests.get() gives back."""

    def __init__(self, status_code, body):
        self.status_code = status_code
        self.body = body

    def json(self):
        return self.body


def use_fake_response(monkeypatch, status_code, body):
    """Makes requests.get return a fake response, and keeps track of what got sent."""
    sent_requests = []

    def fake_get(url, params=None, headers=None, timeout=None):
        sent_requests.append({"url": url, "params": params, "headers": headers, "timeout": timeout})
        return FakeResponse(status_code, body)

    monkeypatch.setattr(food_lookup.requests, "get", fake_get)
    return sent_requests


def test_reads_a_found_product(monkeypatch):
    sent_requests = use_fake_response(monkeypatch, 200, {
        "status": 1,
        "product": {
            "product_name": "Granola",
            "brands": "Good Oats,Good Oats Co",
            "ingredients_text": "Avoine, sucre",
            "ingredients_text_en": "Oats, sugar, _milk_ powder",
            "allergens_tags": ["en:milk"],
            "traces_tags": ["en:nuts"],
            "lang": "fr",
            "image_front_small_url": "https://images.example/granola.jpg",
        },
    })

    product_fields = food_lookup.fetch_from_open_food_facts("123456789012")

    assert product_fields["name"] == "Granola"
    assert product_fields["brand"] == "Good Oats"  # just the first brand
    # the English list should win over the French one
    assert product_fields["ingredients_text"] == "Oats, sugar, _milk_ powder"
    assert product_fields["ingredients_in_english"] is True
    assert product_fields["allergen_tags"] == ["en:milk"]
    assert product_fields["may_contain_tags"] == ["en:nuts"]

    # we should say who we are and not wait forever
    assert sent_requests[0]["headers"]["User-Agent"].startswith("SafeBite/")
    assert sent_requests[0]["timeout"] == food_lookup.LOOKUP_TIMEOUT_SECONDS


def test_non_english_label_is_marked(monkeypatch):
    use_fake_response(monkeypatch, 200, {
        "status": 1,
        "product": {"product_name": "Biscuits", "ingredients_text": "Farine de blé", "lang": "fr"},
    })
    product_fields = food_lookup.fetch_from_open_food_facts("123")
    assert product_fields["ingredients_in_english"] is False


def test_not_found_returns_none(monkeypatch):
    # they can say "not found" with a 404...
    use_fake_response(monkeypatch, 404, {"status": 0, "status_verbose": "product not found"})
    assert food_lookup.fetch_from_open_food_facts("999") is None

    # ...or with status 0
    use_fake_response(monkeypatch, 200, {"status": 0, "status_verbose": "product not found"})
    assert food_lookup.fetch_from_open_food_facts("999") is None


def test_server_errors_raise_lookup_error(monkeypatch):
    use_fake_response(monkeypatch, 503, {})
    with pytest.raises(food_lookup.FoodLookupError):
        food_lookup.fetch_from_open_food_facts("123")


def test_network_errors_raise_lookup_error(monkeypatch):
    def broken_get(*args, **kwargs):
        raise requests.ConnectionError("no internet")

    monkeypatch.setattr(food_lookup.requests, "get", broken_get)
    with pytest.raises(food_lookup.FoodLookupError):
        food_lookup.fetch_from_open_food_facts("123")


def test_contact_email_goes_in_user_agent(monkeypatch):
    monkeypatch.setenv("OPEN_FOOD_FACTS_CONTACT", "student@example.edu")
    assert food_lookup.build_user_agent() == "SafeBite/0.1 (student@example.edu)"


def test_categories_get_saved(monkeypatch):
    use_fake_response(monkeypatch, 200, {
        "status": 1,
        "product": {
            "product_name": "Granola",
            "ingredients_text": "Oats",
            "categories_tags_en": ["Breakfasts", "Cereals", "Granolas"],
        },
    })
    product_fields = food_lookup.fetch_from_open_food_facts("123")
    assert product_fields["category_names"] == ["Breakfasts", "Cereals", "Granolas"]


# ----- searching for similar products (used for safer swaps) -----

@pytest.fixture
def app_with_database(tmp_path):
    """Search saves what it finds, so these tests need a (throwaway) database."""
    flask_app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'test.db'}",
        "JWT_SECRET_KEY": "test-secret-key-that-is-long-enough-for-hs256",
    })
    prepare_database(flask_app)
    with flask_app.app_context():
        yield flask_app


def test_search_finds_similar_products_and_saves_them(monkeypatch, app_with_database):
    sent_requests = use_fake_response(monkeypatch, 200, {
        "count": 5,
        "products": [
            {"code": "999", "product_name": "The one we scanned", "ingredients_text": "Sugar"},
            {"code": "111", "product_name": "Spread A", "ingredients_text": "Hazelnuts, cocoa"},
            {"code": "111", "product_name": "Spread A again", "ingredients_text": "Hazelnuts"},
            {"code": "222", "product_name": "No ingredients listed"},
            {"code": "not-a-barcode", "product_name": "Junk", "ingredients_text": "Stuff"},
            {"code": "333", "product_name": "Spread B", "ingredients_text": "Sunflower seeds"},
        ],
    })

    similar_products = food_lookup.search_similar_products("Hazelnut spreads", exclude_barcode="999")

    # skips the scanned one, repeats, junk barcodes, and ones without ingredients
    assert [product.name for product in similar_products] == ["Spread A", "Spread B"]
    # they got saved, so scanning one later is instant
    assert database.session.get(Product, "333").name == "Spread B"

    # searched the right category, in the US, and said who we are
    sent_settings = sent_requests[0]
    assert sent_settings["params"]["categories_tags_en"] == "Hazelnut spreads"
    assert sent_settings["params"]["countries_tags_en"] == food_lookup.SWAP_SEARCH_COUNTRY
    assert sent_settings["headers"]["User-Agent"].startswith("SafeBite/")


def test_search_errors_raise_lookup_error(monkeypatch, app_with_database):
    use_fake_response(monkeypatch, 503, {})
    with pytest.raises(food_lookup.FoodLookupError):
        food_lookup.search_similar_products("Hazelnut spreads", exclude_barcode="999")
