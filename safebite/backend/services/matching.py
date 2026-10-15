"""
matching.py - Compares a product's ingredients to what the user avoids.

It gives back one of four verdicts plus the reasons why:

    avoid      something in the ingredients is on the user's list
    caution    a "may contain" warning, or the ingredient info is missing
    safe       full ingredient list and nothing on it matches
    unchecked  the user hasn't added anything to avoid yet

If we're not sure, we go with Caution instead of Safe.
"""

import re
import unicodedata

# the four verdicts
VERDICT_AVOID = "avoid"
VERDICT_CAUTION = "caution"
VERDICT_SAFE = "safe"
VERDICT_UNCHECKED = "unchecked"

# each reason gets a level so the app knows what color to make it
# ("info" is just a note that doesn't change the verdict)
LEVEL_AVOID = "avoid"
LEVEL_CAUTION = "caution"
LEVEL_SAFE = "safe"
LEVEL_INFO = "info"

# how the product lookup went
LOOKUP_OK = "ok"  # we have the product info
LOOKUP_FAILED = "failed"  # couldn't reach Open Food Facts
LOOKUP_NOT_ATTEMPTED = "not_attempted"  # an old scan that never got looked up

# limits for triggers people type in themselves
MIN_CUSTOM_TRIGGER_LENGTH = 2
MAX_CUSTOM_TRIGGER_LENGTH = 40
MAX_TRIGGERS_PER_USER = 40

# typed triggers can only have letters, numbers, spaces, hyphens, and apostrophes
CUSTOM_TRIGGER_PATTERN = re.compile(r"^[a-z0-9][a-z0-9 '\-]*$")

# phrases that start a "may contain" warning on a label
# anything after one of these is a Caution instead of an Avoid
MAY_CONTAIN_PATTERN = re.compile(
    r"\b("
    r"may contain|may also contain|might contain|can contain|"
    r"contains? traces? of|traces? of|"
    r"(?:made|manufactured|processed|produced|packaged|packed) (?:in|on|at) "
    r"(?:a )?(?:facility|plant|equipment|shared equipment|the same equipment|a shared facility)"
    r")"
)


# the preset triggers people can tap on in the Profile tab
# each one has:
#   key            what gets saved in the database, like "milk"
#   label          what the app shows, like "Milk"
#   describes_as   used in messages, like "Contains whey (a milk ingredient)"
#   terms          other names to look for in the ingredients
#   not_terms      look-alikes to ignore, like "cocoa butter" for milk
#   allergen_tags  Open Food Facts' tags for the same thing
TRIGGER_GROUPS = [
    {
        "title": "Common allergens",
        "subtitle": "The nine major food allergens in the U.S.",
        "triggers": [
            {
                "key": "milk",
                "label": "Milk",
                "describes_as": "a milk ingredient",
                "terms": [
                    "milk", "whey", "casein", "caseinate", "sodium caseinate",
                    "lactose", "lactalbumin", "lactoglobulin", "butter",
                    "buttermilk", "butterfat", "cream", "cheese", "yogurt",
                    "yoghurt", "ghee", "curds", "kefir", "milk solids",
                    "milk powder", "nonfat dry milk",
                ],
                "not_terms": [
                    "cocoa butter", "shea butter", "peanut butter", "almond butter",
                    "cashew butter", "nut butter", "sunflower butter", "seed butter",
                    "apple butter", "coconut milk", "coconut cream", "cream of coconut",
                    "almond milk", "oat milk", "soy milk", "soymilk", "rice milk",
                    "cashew milk", "cream of tartar", "butternut", "milk thistle",
                ],
                "allergen_tags": ["en:milk"],
            },
            {
                "key": "eggs",
                "label": "Eggs",
                "describes_as": "an egg ingredient",
                "terms": [
                    "egg", "egg white", "egg yolk", "albumen", "ovalbumin",
                    "ovomucoid", "lysozyme", "mayonnaise", "meringue", "eggnog",
                ],
                "not_terms": ["eggplant"],
                "allergen_tags": ["en:eggs"],
            },
            {
                "key": "peanuts",
                "label": "Peanuts",
                "describes_as": "a peanut ingredient",
                "terms": ["peanut", "groundnut", "arachis oil", "monkey nut"],
                "not_terms": [],
                "allergen_tags": ["en:peanuts"],
            },
            {
                "key": "tree_nuts",
                "label": "Tree nuts",
                "describes_as": "a tree nut",
                "terms": [
                    "almond", "brazil nut", "cashew", "chestnut", "filbert",
                    "hazelnut", "macadamia", "pecan", "pine nut", "pistachio",
                    "walnut", "praline", "marzipan",
                ],
                "not_terms": ["water chestnut"],
                "allergen_tags": ["en:nuts"],
            },
            {
                "key": "soy",
                "label": "Soy",
                "describes_as": "a soy ingredient",
                "terms": [
                    "soy", "soya", "soybean", "edamame", "tofu", "tempeh",
                    "miso", "shoyu", "tamari",
                ],
                "not_terms": [],
                "allergen_tags": ["en:soybeans"],
            },
            {
                "key": "gluten",
                "label": "Wheat & gluten",
                "describes_as": "a gluten grain",
                "terms": [
                    "wheat", "gluten", "barley", "rye", "malt", "spelt",
                    "semolina", "durum", "farina", "farro", "kamut", "triticale",
                    "bulgur", "couscous", "seitan", "einkorn", "emmer",
                ],
                "not_terms": ["buckwheat", "gluten free", "gluten-free"],
                "allergen_tags": ["en:gluten"],
            },
            {
                "key": "fish",
                "label": "Fish",
                "describes_as": "a fish ingredient",
                "terms": [
                    "fish", "fish sauce", "fish oil", "anchovy", "anchovies",
                    "catfish", "cod", "flounder", "haddock", "hake", "halibut",
                    "herring", "mackerel", "mahi mahi", "pollock", "salmon",
                    "sardine", "snapper", "swordfish", "tilapia", "trout",
                    "tuna", "surimi",
                ],
                "not_terms": [],
                "allergen_tags": ["en:fish"],
            },
            {
                "key": "shellfish",
                "label": "Shellfish",
                "describes_as": "a shellfish ingredient",
                "terms": [
                    "shellfish", "shrimp", "prawn", "crab", "lobster",
                    "crawfish", "crayfish", "krill", "langoustine", "scampi",
                    "clam", "mussel", "oyster", "scallop", "squid", "calamari",
                    "octopus",
                ],
                "not_terms": ["oyster mushroom", "crab apple"],
                "allergen_tags": ["en:crustaceans", "en:molluscs"],
            },
            {
                "key": "sesame",
                "label": "Sesame",
                "describes_as": "a sesame ingredient",
                "terms": ["sesame", "tahini", "benne", "gingelly"],
                "not_terms": [],
                "allergen_tags": ["en:sesame-seeds"],
            },
        ],
    },
    {
        "title": "Sugars and sweeteners",
        "subtitle": "Often watched with diabetes.",
        "triggers": [
            {
                "key": "added_sugars",
                "label": "Added sugars",
                "describes_as": "an added sugar or fast-digesting carb",
                "terms": [
                    "sugar", "cane sugar", "brown sugar", "invert sugar",
                    "dextrose", "glucose", "fructose", "sucrose", "maltose",
                    "corn syrup", "high fructose corn syrup", "glucose syrup",
                    "rice syrup", "maple syrup", "golden syrup", "syrup",
                    "honey", "agave", "molasses", "treacle", "maltodextrin",
                    "evaporated cane juice", "cane juice",
                    "fruit juice concentrate", "caramel",
                ],
                "not_terms": [
                    "sugar alcohol", "no sugar added", "no added sugar",
                    "sugar free", "sugar-free", "sugar snap",
                ],
                "allergen_tags": [],
            },
            {
                "key": "artificial_sweeteners",
                "label": "Artificial sweeteners",
                "describes_as": "an artificial sweetener",
                "terms": [
                    "sucralose", "aspartame", "saccharin", "acesulfame",
                    "neotame", "advantame", "cyclamate",
                ],
                "not_terms": [],
                "allergen_tags": [],
            },
            {
                "key": "sugar_alcohols",
                "label": "Sugar alcohols",
                "describes_as": "a sugar alcohol",
                "terms": [
                    "sorbitol", "mannitol", "xylitol", "maltitol", "erythritol",
                    "isomalt", "lactitol",
                ],
                "not_terms": [],
                "allergen_tags": [],
            },
        ],
    },
    {
        "title": "Commonly reported IBD triggers",
        "subtitle": "Triggers vary a lot from person to person. Pick only what affects you.",
        "triggers": [
            {
                "key": "lactose",
                "label": "Lactose (dairy)",
                "describes_as": "a dairy ingredient with lactose",
                "terms": [
                    "lactose", "milk", "whey", "cream", "cheese", "yogurt",
                    "yoghurt", "buttermilk", "ice cream", "milk solids",
                    "milk powder", "nonfat dry milk",
                ],
                "not_terms": [
                    "cocoa butter", "coconut milk", "coconut cream",
                    "cream of coconut", "almond milk", "oat milk", "soy milk",
                    "soymilk", "rice milk", "cashew milk", "cream of tartar",
                    "lactose free", "lactose-free", "milk thistle",
                ],
                "allergen_tags": ["en:milk"],
            },
            {
                "key": "garlic_onion",
                "label": "Garlic & onion",
                "describes_as": "garlic or onion",
                "terms": [
                    "garlic", "onion", "shallot", "leek", "scallion",
                    "garlic powder", "onion powder",
                ],
                "not_terms": [],
                "allergen_tags": [],
            },
            {
                "key": "spicy_peppers",
                "label": "Spicy peppers",
                "describes_as": "a spicy pepper",
                "terms": [
                    "chili", "chile", "chilli", "cayenne", "jalapeno",
                    "habanero", "chipotle", "serrano", "sriracha", "capsaicin",
                    "red pepper flakes", "crushed red pepper", "hot sauce",
                ],
                "not_terms": [],
                "allergen_tags": [],
            },
            {
                "key": "caffeine",
                "label": "Caffeine",
                "describes_as": "a source of caffeine",
                "terms": [
                    "caffeine", "coffee", "espresso", "guarana", "yerba mate",
                    "green tea", "black tea", "matcha", "kola nut",
                ],
                "not_terms": [],
                "allergen_tags": [],
            },
            {
                "key": "carrageenan",
                "label": "Carrageenan",
                "describes_as": "a thickener",
                "terms": ["carrageenan"],
                "not_terms": [],
                "allergen_tags": [],
            },
        ],
    },
]


# lets us grab a preset by its key, like PRESET_TRIGGERS["milk"]
PRESET_TRIGGERS = {
    trigger["key"]: trigger
    for group in TRIGGER_GROUPS
    for trigger in group["triggers"]
}


def get_catalog_for_app():
    """Gets the presets in groups, with just the key and label the app needs."""
    return [
        {
            "title": group["title"],
            "subtitle": group["subtitle"],
            "triggers": [
                {"key": trigger["key"], "label": trigger["label"]}
                for trigger in group["triggers"]
            ],
        }
        for group in TRIGGER_GROUPS
    ]


def normalize_text(text):
    """Cleans up text so it's easy to search."""
    # lowercase it and strip accents (so "jalapeño" matches "jalapeno")
    text = unicodedata.normalize("NFKD", text.lower())
    text = "".join(character for character in text if not unicodedata.combining(character))
    # Open Food Facts writes allergens like "_milk_", so drop the underscores
    text = text.replace("_", " ")
    # squash extra spaces down to one
    return re.sub(r"\s+", " ", text).strip()


def clean_trigger_name(raw_name):
    """Cleans up a trigger name from the app, or gives back None if it's not allowed."""
    if not isinstance(raw_name, str):
        return None

    # check for a preset key first, before the underscores get turned into spaces
    lowercase_name = raw_name.strip().lower()
    if lowercase_name in PRESET_TRIGGERS:
        return lowercase_name

    cleaned_name = normalize_text(raw_name)

    # if they typed a preset's name (like "Peanuts"), use that preset
    for key, trigger in PRESET_TRIGGERS.items():
        if cleaned_name == trigger["label"].lower():
            return key

    # otherwise make sure it's a reasonable length and only has allowed characters
    if not (MIN_CUSTOM_TRIGGER_LENGTH <= len(cleaned_name) <= MAX_CUSTOM_TRIGGER_LENGTH):
        return None
    if not CUSTOM_TRIGGER_PATTERN.match(cleaned_name):
        return None
    return cleaned_name


def get_trigger_details(trigger_name):
    """Gets a trigger's info. Typed ones like "garlic" just search for themselves."""
    if trigger_name in PRESET_TRIGGERS:
        return PRESET_TRIGGERS[trigger_name]
    return {
        "key": trigger_name,
        "label": trigger_name.capitalize(),
        "describes_as": None,
        "terms": [trigger_name],
        "not_terms": [],
        "allergen_tags": [],
    }


def get_trigger_label(trigger_name):
    """Gets the name to show for a trigger, like "added_sugars" -> "Added sugars"."""
    return get_trigger_details(trigger_name)["label"]


def split_off_may_contain_section(ingredients_text):
    """Splits a label into the real ingredients and the "may contain" part."""
    may_contain_match = MAY_CONTAIN_PATTERN.search(ingredients_text)
    if may_contain_match is None:
        return ingredients_text, ""
    split_position = may_contain_match.start()
    return ingredients_text[:split_position], ingredients_text[split_position:]


def find_matching_term(text, trigger):
    """Looks for any of the trigger's names in the text and gives back the first one found."""
    # take out the look-alikes first, so "cocoa butter" doesn't count as butter
    for not_term in trigger["not_terms"]:
        not_term_pattern = r"\b" + re.escape(not_term) + r"(?:s|es)?\b"
        text = re.sub(not_term_pattern, " ", text)

    # check the longest names first, so we say "corn syrup" instead of just "syrup"
    # (\b means whole words only, and s/es lets "egg" match "eggs")
    for term in sorted(trigger["terms"], key=len, reverse=True):
        term_pattern = r"\b" + re.escape(term) + r"(?:s|es)?\b"
        term_match = re.search(term_pattern, text)
        if term_match:
            return term_match.group(0)
    return None


def describe_match(matched_term, trigger):
    """Builds the end of a message, like "whey (a milk ingredient)"."""
    describes_as = trigger["describes_as"]
    # skip the explanation if the word already says it, like "milk"
    if describes_as and matched_term != trigger["label"].lower():
        return f"{matched_term} ({describes_as})"
    return matched_term


def evaluate_product(product, trigger_names, lookup_status=LOOKUP_OK):
    """Works out the verdict and reasons for one product and one user."""
    avoid_reasons = []
    caution_reasons = []

    # first, check if anything's wrong with the product info itself
    data_problems = []
    has_ingredients = False

    if product is None:
        if lookup_status == LOOKUP_FAILED:
            data_problems.append(
                "Couldn't reach the food database right now. Check the label yourself."
            )
        else:
            data_problems.append(
                "This scan hasn't been checked yet. Scan it again to look it up."
            )
    elif not product.was_found:
        data_problems.append(
            "This product isn't in the food database yet. Check the label yourself."
        )
    elif not product.ingredients_text:
        data_problems.append(
            "No ingredient list is available for this product. Check the label yourself."
        )
    else:
        has_ingredients = True
        if not product.ingredients_in_english:
            data_problems.append(
                "The ingredient list isn't in English, so some ingredients may be missed."
            )

    # no triggers yet, so there's nothing to check against
    if not trigger_names:
        reasons = [{
            "level": LEVEL_INFO,
            "message": "Add the ingredients you avoid in your Profile to get a verdict.",
        }]
        reasons += [{"level": LEVEL_INFO, "message": problem} for problem in data_problems]
        return {"verdict": VERDICT_UNCHECKED, "reasons": reasons}

    # any data problems count as a Caution
    caution_reasons.extend(data_problems)

    # now check each trigger against the product
    if product is not None and product.was_found:
        ingredients_section, may_contain_section = ("", "")
        if has_ingredients:
            ingredients_section, may_contain_section = split_off_may_contain_section(
                normalize_text(product.ingredients_text)
            )

        listed_allergens = set(product.allergen_tags or [])
        may_contain_allergens = set(product.may_contain_tags or [])

        for trigger_name in trigger_names:
            trigger = get_trigger_details(trigger_name)

            # is it in the actual ingredients? -> Avoid
            matched_term = find_matching_term(ingredients_section, trigger)
            if matched_term:
                avoid_reasons.append(f"Contains {describe_match(matched_term, trigger)}")
                continue

            # does Open Food Facts list it as an allergen? -> Avoid
            if listed_allergens & set(trigger["allergen_tags"]):
                avoid_reasons.append(f"Listed as an allergen: {trigger['label']}")
                continue

            # is it in a "may contain" warning? -> Caution
            matched_term = find_matching_term(may_contain_section, trigger)
            if matched_term:
                caution_reasons.append(
                    f"Label says it may contain {describe_match(matched_term, trigger)}"
                )
                continue

            # does Open Food Facts say it might have traces? -> Caution
            if may_contain_allergens & set(trigger["allergen_tags"]):
                caution_reasons.append(f"May contain traces of {trigger['label'].lower()}")

    # put Avoid reasons first, then Caution
    reasons = [{"level": LEVEL_AVOID, "message": message} for message in avoid_reasons]
    reasons += [{"level": LEVEL_CAUTION, "message": message} for message in caution_reasons]

    # the most serious one wins
    if avoid_reasons:
        verdict = VERDICT_AVOID
    elif caution_reasons:
        verdict = VERDICT_CAUTION
    else:
        verdict = VERDICT_SAFE
        trigger_count = len(trigger_names)
        if trigger_count == 1:
            safe_message = "Your 1 trigger wasn't found in the ingredients."
        else:
            safe_message = f"None of your {trigger_count} triggers were found in the ingredients."
        reasons.append({"level": LEVEL_SAFE, "message": safe_message})

    return {"verdict": verdict, "reasons": reasons}
