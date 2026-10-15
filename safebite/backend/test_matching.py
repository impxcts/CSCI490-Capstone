"""
test_matching.py - Tests for the matching engine (Avoid / Caution / Safe).

Run with:  pytest

Calling something Safe when it isn't is the worst bug this app could have,
so every rule in services/matching.py gets a test here.
"""

from models import Product
from services import matching


def make_product(ingredients_text="", allergen_tags=None, may_contain_tags=None,
                 was_found=True, ingredients_in_english=True):
    """Makes a fake product to test with (it never gets saved)."""
    return Product(
        barcode="0000",
        was_found=was_found,
        name="Test product",
        ingredients_text=ingredients_text,
        ingredients_in_english=ingredients_in_english,
        allergen_tags=allergen_tags or [],
        may_contain_tags=may_contain_tags or [],
    )


def get_messages(result):
    """Grabs just the reason messages from a result."""
    return [reason["message"] for reason in result["reasons"]]


# ----- Avoid -----

def test_hidden_milk_ingredient_is_avoid():
    # whey is a milk ingredient, so this should get flagged
    product = make_product("Sugar, wheat flour, whey, salt")
    result = matching.evaluate_product(product, ["milk"])

    assert result["verdict"] == matching.VERDICT_AVOID
    assert "Contains whey (a milk ingredient)" in get_messages(result)


def test_plural_and_accented_words_still_match():
    assert matching.evaluate_product(make_product("Eggs, flour"), ["eggs"])["verdict"] == "avoid"
    assert matching.evaluate_product(make_product("Jalapeño peppers"), ["spicy_peppers"])["verdict"] == "avoid"


def test_open_food_facts_underscore_markers_are_handled():
    # Open Food Facts writes allergens like "_milk_"
    result = matching.evaluate_product(make_product("Cocoa, _milk_ powder"), ["milk"])
    assert result["verdict"] == matching.VERDICT_AVOID


def test_listed_allergen_tag_is_avoid_even_without_matching_text():
    product = make_product("Chocolate (cocoa, sugar)", allergen_tags=["en:milk"])
    result = matching.evaluate_product(product, ["milk"])

    assert result["verdict"] == matching.VERDICT_AVOID
    assert "Listed as an allergen: Milk" in get_messages(result)


def test_longer_term_is_reported_first():
    # should say "corn syrup", not just "syrup"
    result = matching.evaluate_product(make_product("Water, corn syrup"), ["added_sugars"])
    assert result["reasons"][0]["message"].startswith("Contains corn syrup")


def test_custom_trigger_matches_itself():
    result = matching.evaluate_product(make_product("Salt, garlic powder"), ["garlic"])
    assert result["verdict"] == matching.VERDICT_AVOID
    assert "Contains garlic" in get_messages(result)


# ----- look-alikes that should NOT get flagged -----

def test_cocoa_butter_and_coconut_milk_are_not_dairy():
    product = make_product("Sugar, cocoa butter, coconut milk")
    assert matching.evaluate_product(product, ["milk"])["verdict"] == matching.VERDICT_SAFE


def test_buckwheat_is_not_wheat_and_maltodextrin_is_not_malt():
    product = make_product("Buckwheat flour, maltodextrin")
    assert matching.evaluate_product(product, ["gluten"])["verdict"] == matching.VERDICT_SAFE


def test_water_chestnut_is_not_a_tree_nut():
    product = make_product("Water chestnuts, soy sauce")
    assert matching.evaluate_product(product, ["tree_nuts"])["verdict"] == matching.VERDICT_SAFE


# ----- Caution -----

def test_may_contain_warning_is_caution_not_avoid():
    product = make_product("Oats, sugar. May contain peanuts and tree nuts.")
    result = matching.evaluate_product(product, ["peanuts"])

    assert result["verdict"] == matching.VERDICT_CAUTION
    # no "(a peanut ingredient)" here since "peanuts" already says it
    assert "Label says it may contain peanuts" in get_messages(result)


def test_shared_facility_warning_is_caution():
    product = make_product("Rice, salt. Made in a facility that also processes sesame.")
    assert matching.evaluate_product(product, ["sesame"])["verdict"] == matching.VERDICT_CAUTION


def test_trace_tag_is_caution():
    product = make_product("Rice, salt", may_contain_tags=["en:soybeans"])
    result = matching.evaluate_product(product, ["soy"])
    assert result["verdict"] == matching.VERDICT_CAUTION


def test_missing_data_is_caution_never_safe():
    not_found = make_product(was_found=False)
    no_ingredients = make_product(ingredients_text="")
    not_english = make_product("Sucre, farine de blé", ingredients_in_english=False)

    for product in (not_found, no_ingredients, not_english):
        assert matching.evaluate_product(product, ["milk"])["verdict"] == matching.VERDICT_CAUTION

    lookup_failed = matching.evaluate_product(None, ["milk"], matching.LOOKUP_FAILED)
    assert lookup_failed["verdict"] == matching.VERDICT_CAUTION


def test_avoid_beats_caution():
    product = make_product("Milk, sugar. May contain peanuts.")
    result = matching.evaluate_product(product, ["milk", "peanuts"])

    assert result["verdict"] == matching.VERDICT_AVOID
    # both reasons still show up, Avoid first
    assert [reason["level"] for reason in result["reasons"]] == ["avoid", "caution"]


# ----- Safe and unchecked -----

def test_safe_explains_what_was_checked():
    result = matching.evaluate_product(make_product("Rice, water, salt"), ["milk", "eggs"])

    assert result["verdict"] == matching.VERDICT_SAFE
    assert "None of your 2 triggers were found in the ingredients." in get_messages(result)

    # and it reads right with just one trigger
    one_trigger = matching.evaluate_product(make_product("Rice, water, salt"), ["milk"])
    assert "Your 1 trigger wasn't found in the ingredients." in get_messages(one_trigger)


def test_no_triggers_means_unchecked():
    result = matching.evaluate_product(make_product("Milk"), [])
    assert result["verdict"] == matching.VERDICT_UNCHECKED


# ----- cleaning up trigger names -----

def test_every_preset_key_survives_cleanup():
    # keys with underscores like "tree_nuts" shouldn't turn into "tree nuts"
    for preset_key in matching.PRESET_TRIGGERS:
        assert matching.clean_trigger_name(preset_key) == preset_key


def test_clean_trigger_name():
    assert matching.clean_trigger_name("milk") == "milk"
    # typing a preset's name turns it into that preset
    assert matching.clean_trigger_name("Peanuts") == "peanuts"
    assert matching.clean_trigger_name("Added sugars") == "added_sugars"
    # typed names get cleaned up
    assert matching.clean_trigger_name("  Red-40 ") == "red-40"
    # junk gets rejected
    assert matching.clean_trigger_name("<script>") is None
    assert matching.clean_trigger_name("x") is None
    assert matching.clean_trigger_name(42) is None
