"""
food_lookup.py - Looks up products in Open Food Facts.

Open Food Facts is a free food database you can search by barcode, no API
key needed. We save every product we get back in the products table, so
each one only gets looked up once.
"""

import os
from datetime import datetime, timedelta, timezone

import requests

from models import Product, database

OPEN_FOOD_FACTS_URL = "https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
OPEN_FOOD_FACTS_SEARCH_URL = "https://world.openfoodfacts.org/api/v2/search"

# only ask for the stuff we actually use
REQUESTED_FIELDS = ",".join([
    "product_name",
    "product_name_en",
    "brands",
    "ingredients_text",
    "ingredients_text_en",
    "allergens_tags",
    "traces_tags",
    "lang",
    "image_front_small_url",
    "categories_tags_en",
])

LOOKUP_TIMEOUT_SECONDS = 6  # give up if a barcode lookup takes longer than this
SEARCH_TIMEOUT_SECONDS = 5  # same for searches (we might do two in a row)
NOT_FOUND_RECHECK_AFTER = timedelta(days=1)  # try "not found" products again after a day

# how many similar products to grab per search when looking for swaps
SWAP_SEARCH_PAGE_SIZE = 30

# only suggest swaps sold in this country (set to None to search everywhere)
SWAP_SEARCH_COUNTRY = "United States"

# longest values we'll save (same as the column sizes in models.py)
MAX_NAME_LENGTH = 300
MAX_IMAGE_URL_LENGTH = 500


class FoodLookupError(Exception):
    """Happens when we can't reach Open Food Facts or get back something weird."""


def build_user_agent():
    """Tells Open Food Facts who we are, which they ask every app to do."""
    contact = os.environ.get("OPEN_FOOD_FACTS_CONTACT", "").strip()
    if contact:
        return f"SafeBite/0.1 ({contact})"
    return "SafeBite/0.1 (student capstone project)"


def shorten(text, max_length):
    """Cuts text down to fit in the database, or gives back None if it's empty."""
    if not text:
        return None
    return str(text).strip()[:max_length] or None


def parse_product_data(product_data):
    """Pulls the parts we need out of one product from Open Food Facts."""
    # use the English ingredient list if there is one,
    # otherwise use whatever language it's in and remember that
    english_ingredients = (product_data.get("ingredients_text_en") or "").strip()
    any_language_ingredients = (product_data.get("ingredients_text") or "").strip()
    label_language = product_data.get("lang") or "en"

    if english_ingredients:
        ingredients_text = english_ingredients
        ingredients_in_english = True
    elif any_language_ingredients:
        ingredients_text = any_language_ingredients
        ingredients_in_english = label_language == "en"
    else:
        ingredients_text = None
        ingredients_in_english = True

    # sometimes there's more than one brand, like "Kraft,Kraft Heinz", so just use the first
    first_brand = (product_data.get("brands") or "").split(",")[0]

    return {
        "name": shorten(
            product_data.get("product_name_en") or product_data.get("product_name"),
            MAX_NAME_LENGTH,
        ),
        "brand": shorten(first_brand, MAX_NAME_LENGTH),
        "ingredients_text": ingredients_text,
        "ingredients_in_english": ingredients_in_english,
        "allergen_tags": list(product_data.get("allergens_tags") or []),
        "may_contain_tags": list(product_data.get("traces_tags") or []),
        "image_url": shorten(product_data.get("image_front_small_url"), MAX_IMAGE_URL_LENGTH),
        "category_names": list(product_data.get("categories_tags_en") or []),
    }


def fetch_from_open_food_facts(barcode):
    """Asks Open Food Facts about a barcode.

    Gives back the product info, or None if they don't have it.
    """
    try:
        response = requests.get(
            OPEN_FOOD_FACTS_URL.format(barcode=barcode),
            params={"fields": REQUESTED_FIELDS},
            headers={"User-Agent": build_user_agent()},
            timeout=LOOKUP_TIMEOUT_SECONDS,
        )
    except requests.RequestException as network_error:
        raise FoodLookupError(f"Couldn't reach Open Food Facts: {network_error}") from network_error

    # 404 means they don't have it
    if response.status_code == 404:
        return None
    if response.status_code != 200:
        raise FoodLookupError(f"Open Food Facts returned status {response.status_code}")

    try:
        response_body = response.json()
    except ValueError as parse_error:
        raise FoodLookupError("Open Food Facts sent back something that isn't JSON") from parse_error

    # status 1 means found, 0 means not found
    product_data = response_body.get("product")
    if response_body.get("status") != 1 or not product_data:
        return None

    return parse_product_data(product_data)


def is_recent(timestamp, max_age):
    """Checks if a time was less than max_age ago."""
    # SQLite drops the time zone, so add UTC back if it's missing
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - timestamp < max_age


def save_found_product(barcode, product_fields):
    """Saves (or updates) a product we found. You still need to commit after."""
    saved_product = database.session.get(Product, barcode)
    if saved_product is None:
        saved_product = Product(barcode=barcode)
        database.session.add(saved_product)

    saved_product.was_found = True
    for field_name, value in product_fields.items():
        setattr(saved_product, field_name, value)
    saved_product.fetched_at = datetime.now(timezone.utc)
    return saved_product


def get_product(barcode):
    """Gets the product for a barcode, only asking Open Food Facts if we need to.

    Gives back None if we have nothing saved and couldn't reach Open Food Facts.
    """
    # food barcodes are all numbers, so skip looking up anything else (like QR codes)
    if not barcode.isdigit():
        return Product(barcode=barcode, was_found=False, allergen_tags=[], may_contain_tags=[])

    saved_product = database.session.get(Product, barcode)

    # use our saved copy if it's complete, or if we checked recently and it wasn't there
    # (products saved before we started saving categories get looked up again)
    if saved_product is not None:
        has_everything = saved_product.was_found and saved_product.category_names is not None
        recently_not_found = (
            not saved_product.was_found
            and is_recent(saved_product.fetched_at, NOT_FOUND_RECHECK_AFTER)
        )
        if has_everything or recently_not_found:
            return saved_product

    try:
        product_fields = fetch_from_open_food_facts(barcode)
    except FoodLookupError:
        # couldn't reach them, so use the old saved copy if we have one
        return saved_product

    if product_fields is None:
        # they don't have it, so remember that
        if saved_product is None:
            saved_product = Product(barcode=barcode)
            database.session.add(saved_product)
        saved_product.was_found = False
        saved_product.allergen_tags = []
        saved_product.may_contain_tags = []
        saved_product.fetched_at = datetime.now(timezone.utc)
    else:
        saved_product = save_found_product(barcode, product_fields)

    database.session.commit()
    return saved_product


def search_similar_products(category_name, exclude_barcode):
    """Finds other products in the same category, like other "Chocolate spreads".

    Gives back a list of Products (each one gets saved, so scanning it later
    is instant). Skips the product we started from, and anything without an
    ingredient list, since we can't call those safe.
    """
    search_settings = {
        "categories_tags_en": category_name,
        "fields": REQUESTED_FIELDS + ",code",
        "page_size": SWAP_SEARCH_PAGE_SIZE,
        "sort_by": "unique_scans_n",  # most scanned first, so people will recognize them
    }
    if SWAP_SEARCH_COUNTRY:
        search_settings["countries_tags_en"] = SWAP_SEARCH_COUNTRY

    try:
        response = requests.get(
            OPEN_FOOD_FACTS_SEARCH_URL,
            params=search_settings,
            headers={"User-Agent": build_user_agent()},
            timeout=SEARCH_TIMEOUT_SECONDS,
        )
    except requests.RequestException as network_error:
        raise FoodLookupError(f"Couldn't reach Open Food Facts: {network_error}") from network_error

    if response.status_code != 200:
        raise FoodLookupError(f"Open Food Facts search returned status {response.status_code}")

    try:
        response_body = response.json()
    except ValueError as parse_error:
        raise FoodLookupError("Open Food Facts sent back something that isn't JSON") from parse_error

    similar_products = []
    seen_barcodes = {exclude_barcode}
    for product_data in response_body.get("products") or []:
        barcode = str(product_data.get("code") or "").strip()

        # skip junk barcodes, repeats, and the product we started from
        if not barcode.isdigit() or barcode in seen_barcodes:
            continue
        seen_barcodes.add(barcode)

        product_fields = parse_product_data(product_data)
        if not product_fields["ingredients_text"]:
            continue

        similar_products.append(save_found_product(barcode, product_fields))

    database.session.commit()
    return similar_products
