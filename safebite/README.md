# SafeBite

SafeBite is a mobile app I'm building for my capstone project. The idea is
simple: you scan a food product's barcode, and the app tells you whether it
has anything in it that could trigger your health condition, like IBD,
diabetes, or a food allergy. Eventually it will also save a list of foods
that are safe for you and suggest recipes made only from ingredients you can
actually eat.

**Where things stand right now (midterm MVP):** you can create an account,
pick what you need to avoid, and scan a product (or type its barcode). The app
looks up the ingredients and tells you **Avoid**, **Caution**, or **Safe**,
with the exact ingredient that caused it. If something's a no, it can suggest
**safer swaps**: similar products that are safe for you. Every scan is saved to
your history. Next up are a safe foods list and recipe suggestions.

> **Note:** SafeBite is meant to make reading labels faster, not to replace
> them or give medical advice. Always check the actual label, and talk to
> your doctor or dietitian about what you should avoid.

---

## Table of contents

- [Why I'm building this](#why-im-building-this)
- [Who it's for](#who-its-for)
- [Features](#features)
- [Tech stack](#tech-stack)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [How to run it](#how-to-run-it)
- [Running it on campus Wi-Fi](#running-it-on-campus-wi-fi)
- [Testing](#testing)
- [API routes](#api-routes)
- [Database](#database)
- [How a verdict is decided](#how-a-verdict-is-decided)
- [Trying it out](#trying-it-out)
- [Roadmap](#roadmap)
- [Code review feedback](#code-review-feedback)
- [Problems I've run into](#problems-ive-run-into)
- [Limitations](#limitations)
- [Use of AI tools](#use-of-ai-tools)
- [Credits](#credits)

---

## Why I'm building this

I live with a chronic illness, and one of the most tiring parts of it isn't
the illness itself. It's never being fully sure what I can eat. Grocery
shopping means picking up every product, reading through ingredient names I
don't recognize, and trying to remember which things caused problems before.
If I get it wrong, it's not just a bad meal. It can mean a reaction or days of
a flare.

When I was first diagnosed, I spent a lot of time researching, and I found
out that tons of people deal with the same thing, just with different trigger
foods. That's why I wanted to build one app that works for different
conditions instead of just mine. The core idea is the same for everyone: scan
a product, compare it to *your* list of triggers, and explain the result.

I also want to keep working on this after the semester ends, because it's
something I would actually use every week.

---

## Who it's for

- People with **IBD** (Crohn's disease or ulcerative colitis). Triggers are
  really personal with IBD, so the app lets you build your own list instead
  of assuming anything.
- People with **diabetes** who want to catch added sugars hiding under other
  names, like dextrose or corn syrup.
- People with **food allergies or intolerances** who need to catch an
  ingredient every single time.
- People who were **just diagnosed** and feel overwhelmed at the store.
  Honestly, this is who I most want to help.

It's **not** a medical tool. It won't tell you what your condition requires,
calculate carbs or insulin, or help in an emergency.

---

## Features

### Working now

- **Accounts.** Create an account and log in. You stay logged in even after
  closing the app.
- **Health profile.** Tap chips to pick what you avoid, grouped into the nine
  major allergens, sugars and sweeteners (often watched with diabetes), and
  commonly reported IBD triggers. You can also type in your own, like
  "cinnamon." Changes save automatically.
- **Scanning.** Point the camera at a barcode (UPC-A, UPC-E, EAN-13, EAN-8,
  Code 128), or type the numbers if the barcode won't scan.
- **Ingredient lookup.** The backend looks up the product in Open Food Facts
  and shows its name, brand, photo, and full ingredient list.
- **Match and flag.** Each scan gets a verdict, **Avoid**, **Caution**, or
  **Safe**, with the exact reason, like "Contains whey (a milk ingredient)."
  It catches ingredients hiding under other names and treats "may contain"
  warnings as Caution.
- **History.** Every scan is saved with its verdict. Tap one to see why. If
  you change your profile, your old scans get re-checked automatically.
- **New users start on their profile**, so they set up what they avoid before
  their first scan.
- **Safer swaps.** On an Avoid or Caution, tap "Find safer swaps" to see
  similar products (same kind of food) that come back Safe for you. Tap one to
  check it yourself. This was my classmate Miguel's suggestion from code review.

### Planned after midterm

- A **safe foods list** you can save products to.
- **Recipe suggestions** that leave out your triggers.
- **Typing in an ingredient list** for products that aren't in the database.

### Stretch goals (if I have time)

- Reading the ingredient list from a **photo of the label** for products
  that aren't in the database.
- **Multiple profiles**, so a parent could manage a profile for their kid.

---

## Tech stack

### Languages

- **JavaScript** for the mobile app
- **Python** for the backend
- **SQL** for the database (mostly handled for me by SQLAlchemy)

### What I'm using and why

| Part | What I'm using | Why I picked it |
|---|---|---|
| Mobile app | React Native with Expo (SDK 57) | React is what I'm most comfortable with, and React Native lets one codebase run on both iPhone and Android. Expo makes it easy to test on my real phone with the Expo Go app. |
| Camera | expo-camera | It has barcode scanning built in and works in Expo Go without extra setup. |
| Saving the login | expo-secure-store | It keeps the login token in the phone's encrypted keychain instead of regular storage. |
| Backend | Python with Flask | I've used Python in a personal project and a few classes, and Flask is simple to build an API with. |
| Database | PostgreSQL 17 | It's a standard choice for a server database that handles lots of users at the same time. |
| Database code | Flask-SQLAlchemy | I can define tables as Python classes instead of writing raw SQL. |
| Logins | Flask-JWT-Extended | After you log in, the app gets a token, so the password only gets sent once. |
| Password safety | Werkzeug (comes with Flask) | Passwords are stored as one-way hashes, never as the actual password. |
| Settings | python-dotenv | Keeps private settings, like my secret key, in a `.env` file that doesn't go on GitHub. |
| Testing | pytest | Runs automated tests on the backend. |
| Ingredient data | Open Food Facts API | It's a free, open food database you can search by barcode, and it doesn't need an API key. |
| Calling Open Food Facts | requests (Python) | The standard way to call another website's API from Python. |
| Icons | @expo/vector-icons (Ionicons) | Comes with Expo, so the tab bar and verdict icons work in Expo Go with no setup. |
| Database changes | Flask-Migrate (Alembic) | Lets me change tables without wiping the database. Each change is a small file in `backend/migrations/`. |

### Other software I use

- **Node.js and npm** to run Expo and install the app's packages
- **Homebrew** to install things on my Mac
- **Expo Go** on my phone to run the app while developing
- **Git and GitHub** for version control
- **Terminal** and a code editor

---

## How it works

The project has three parts that talk to each other:

```
 Phone app  ──── requests ────▶  Flask backend  ──── SQL ────▶  PostgreSQL
(React Native) ◀── responses ───   (Python)     ◀─── data ────   (database)
```

The phone never talks to the database directly. Everything goes through
Flask. That's on purpose: Flask is where the rules live, like "you can only
see your own scans." If the app could talk to the database directly, someone
could mess with the app and see other people's data.

### What happens when you log in

1. You type your email and password.
2. The app sends them to Flask.
3. Flask checks the password against the hash stored in the database.
4. If it matches, Flask sends back a **token**, which is basically a signed
   pass that says "this is user #3." It expires after 7 days.
5. The app saves the token in the phone's keychain and sends it along with
   every request after that, so Flask always knows who's asking.

### What happens when you scan something

1. The camera reads the barcode (or you type it in).
2. The camera actually reads the same barcode many times per second, so the
   app uses a "lock" to only check it once.
3. The app sends the barcode and your token to Flask.
4. Flask checks the `products` table. If it's never seen this barcode, it asks
   Open Food Facts and saves the answer, so the next scan of that product is
   instant.
5. The matching engine (`services/matching.py`) compares the ingredients to
   your triggers and decides Avoid, Caution, or Safe.
6. Flask saves the scan under your account and sends everything back.
7. The app shows the verdict, the reasons, and the product.

### How the app finds my laptop

On your phone, "localhost" means the phone itself, not your laptop, so the
app can't just use `localhost` to find the backend. Instead, `config.js`
borrows the laptop address Expo already uses to send the app to the phone and
switches the port to 5001. That way I don't have to type my IP address in
every time it changes.

---

## Project structure

```
safebite/
├── README.md              This file
├── HOW_IT_WORKS.md        A longer explanation of how the prototype works
├── .gitignore             Keeps secrets and installed packages off GitHub
│
├── backend/               Python + Flask server
│   ├── app.py             All the API routes and the server setup
│   ├── models.py          The database tables and password hashing
│   ├── migrations/        Every change to the tables, in order
│   ├── services/
│   │   ├── matching.py    The match and flag engine and preset triggers
│   │   └── food_lookup.py Looks up and searches Open Food Facts
│   ├── test_app.py        Tests for the API routes
│   ├── test_matching.py   Tests for every verdict rule
│   ├── test_food_lookup.py Tests for reading Open Food Facts responses
│   ├── test_migrations.py Tests that migrations build the right tables
│   ├── requirements.txt   Python packages to install
│   └── .env.example       Template for private settings
│
└── mobile/                React Native app
    ├── App.js             Checks if you're logged in and picks the screen
    ├── index.js           Where the app starts
    ├── app.json           Expo settings and the camera permission message
    ├── package.json       JavaScript packages
    └── src/
        ├── api.js         Every request the app sends to the backend
        ├── config.js      Figures out the backend's address
        ├── theme.js       Colors
        ├── components/
        │   ├── ScanResult.js      Verdict banner, product, reasons, ingredients
        │   ├── SaferSwaps.js      "Find safer swaps" and the list of swaps
        │   ├── CameraScanner.js   The live camera and aiming frame
        │   ├── TypeBarcodeBox.js  The "type a barcode" box
        │   ├── PanelMessage.js    Messages on the dark scan panel
        │   ├── TabBar.js          Scan / History / Profile tabs
        │   ├── VerdictBadge.js    Small colored verdict pill
        │   └── ScreenHeader.js    Title at the top of each tab
        └── screens/
            ├── AuthScreen.js      Login and create account
            ├── ScannerScreen.js   Camera or typed barcode, then the result
            ├── HistoryScreen.js   Past scans with verdicts
            └── ProfileScreen.js   What you avoid, plus your account
```

---

## How to run it

These steps are for a Mac, since that's what I'm using.

### What you need first

- [Homebrew](https://brew.sh)
- Node, Python, and PostgreSQL:
  ```bash
  brew install node python postgresql@17
  ```
- The **Expo Go** app on your phone (App Store or Google Play)

### One-time setup

**1. Start PostgreSQL and make the database**

```bash
brew services start postgresql@17
$(brew --prefix postgresql@17)/bin/createdb safebite
```

If `createdb` says it can't connect to the server, PostgreSQL isn't running
yet. Run `brew services list` and make sure `postgresql@17` says "started."

**2. Set up the backend**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Then make a secret key and paste it into `.env` as `JWT_SECRET_KEY`:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
open -e .env
```

While `.env` is open, set `OPEN_FOOD_FACTS_CONTACT` to your email. Open Food
Facts asks every app to include a contact so they can reach you if something
goes wrong.

**3. Install the app's packages**

```bash
cd ../mobile
npm install
```

### Every time you run it

You need two Terminal windows.

**Window 1: database and backend**

```bash
brew services start postgresql@17
cd backend
source .venv/bin/activate
python app.py
```

On startup it runs any database migrations that haven't run yet, so you'll
see a few `Running upgrade` lines the first time. Then you should see
`Running on http://0.0.0.0:5001`. If your Mac asks whether
Python can accept incoming connections, click **Allow**, or your phone won't
be able to reach it.

(It runs on port 5001 instead of Flask's usual 5000 because Macs use port
5000 for AirPlay.)

**Window 2: the app**

```bash
cd mobile
npx expo start
```

**On your phone:** scan the QR code with the Camera app (iPhone) or with Expo
Go (Android). Your phone and laptop need to be on the same Wi-Fi.

### If PostgreSQL won't cooperate

For a quick demo, you can use SQLite instead. In `backend/.env`, put a `#` in
front of the PostgreSQL `DATABASE_URL` line and remove the `#` from the
SQLite line under it. Everything else works the same. I'm only using this as
a backup, since PostgreSQL is the actual plan.

---

## Running it on campus Wi-Fi

This was a big problem for me. University Wi-Fi blocks devices from
connecting to each other, so my phone couldn't reach my laptop. That breaks
both loading the app and talking to the backend.

**What works: phone hotspot.** Turn on your phone's hotspot, connect your
laptop to it, then restart both Terminal windows. The phone and laptop are
now on their own network, and the app finds the new address on its own. No
code changes needed. This is what I'm planning to use for demos.

**Backup: tunnels.** If a hotspot isn't an option, tunnels let the phone reach
the laptop through the internet instead:

1. Install the tools once:
   ```bash
   brew install cloudflared
   npm i -g @expo/ngrok
   ```
2. Start the backend like normal.
3. In another window, run `cloudflared tunnel --url http://localhost:5001`
   and copy the `https://...trycloudflare.com` address it prints.
4. Start the app with that address pasted in:
   ```bash
   EXPO_PUBLIC_API_URL=https://your-address.trycloudflare.com npx expo start --tunnel --clear
   ```
   The `--clear` matters. Expo caches this setting, so without it the app
   can keep using an old address.

The tunnel address changes every time you restart `cloudflared`, so you have
to paste the new one in each time. (You can also type it into
`MANUAL_BACKEND_URL` in `mobile/src/config.js` instead.) Tunnels can also be
slow or drop, so I'd still use the hotspot if possible.

**Long-term fix:** before the final presentation, I want to put the backend
on a cloud host and build the app as a standalone install, so it doesn't need
my laptop at all.

---

## Testing

```bash
cd backend
source .venv/bin/activate
pytest
```

All 59 tests should pass. They use a temporary database and a fake Open Food
Facts, so they don't touch real data or need the internet. They check:

- **Accounts:** sign-up rules, logging in with the right and wrong password,
  and that you can't use protected routes without logging in.
- **The matching engine:** every verdict rule, including hidden names (whey
  counts as milk), look-alikes that *shouldn't* match (cocoa butter isn't
  dairy, buckwheat isn't wheat), "may contain" warnings, and missing or
  non-English data always giving Caution instead of Safe.
- **Profiles:** saving, cleaning up names, and rejecting bad input.
- **Scanning:** verdicts come back with each scan, products are only looked up
  once, history updates when the profile changes, and a scan still saves if
  Open Food Facts is down.
- **Open Food Facts:** reading their response format, "not found," network
  errors, and searching for similar products.
- **Safer swaps:** only Safe products get suggested, it tries a broader
  category if nothing's safe, and it handles no profile, unknown products, and
  the search being down.
- **Migrations:** they build exactly the same tables as `models.py`, and older
  databases get upgraded without losing any data.

The matching tests are the most important ones, because telling someone a
product is **Safe** when it isn't would be the worst possible bug in this app.

---

## API routes

| Method | Route | Login needed? | What it does |
|---|---|---|---|
| GET | `/api/health` | No | Checks that the server is running |
| POST | `/api/register` | No | Creates an account and returns a token |
| POST | `/api/login` | No | Logs in and returns a token |
| GET | `/api/me` | Yes | Returns the logged-in user |
| GET | `/api/profile` | Yes | Your triggers, plus the preset options to pick from |
| PUT | `/api/profile` | Yes | Replaces your list of triggers |
| POST | `/api/scans` | Yes | Looks up a barcode, checks it against your triggers, and saves it |
| GET | `/api/scans` | Yes | Your 20 most recent scans, each with a verdict |
| GET | `/api/products/<barcode>/swaps` | Yes | Up to 3 similar products that are Safe for you |

Errors always come back as `{"error": "message"}`, so the app can just show
the message to the user.

---

## Database

There are four tables:

**users**

| Column | What it stores |
|---|---|
| `id` | Unique number for each user |
| `email` | The user's email (has to be unique) |
| `password_hash` | A hash of the password, not the real password |
| `created_at` | When the account was made |

**scans**

| Column | What it stores |
|---|---|
| `id` | Unique number for each scan |
| `user_id` | Which user scanned it |
| `barcode` | The barcode number |
| `barcode_type` | The barcode format, like `upc_a` |
| `scanned_at` | When it was scanned |

**triggers**

| Column | What it stores |
|---|---|
| `id` | Unique number for each trigger |
| `user_id` | Which user avoids it |
| `name` | A preset key like `milk`, or the user's own text like `cinnamon` |
| `created_at` | When it was added |

**products** (saved answers from Open Food Facts)

| Column | What it stores |
|---|---|
| `barcode` | The barcode (the table's main key) |
| `was_found` | Whether Open Food Facts had the product |
| `name`, `brand` | What the product is |
| `ingredients_text` | The full ingredient list |
| `ingredients_in_english` | Whether the list is in English |
| `allergen_tags` | Allergens Open Food Facts lists, like `en:milk` |
| `may_contain_tags` | "May contain" warnings, like `en:peanuts` |
| `image_url` | A small photo of the front of the package |
| `category_names` | What kind of food it is, general to specific, like `["Spreads", "Hazelnut spreads"]` (used for safer swaps) |
| `fetched_at` | When it was looked up |

Verdicts aren't stored. They're worked out every time from the saved product
and your current triggers, so your history always matches your profile. The
other names for each ingredient (like whey for milk) live in
`services/matching.py` instead of a table, because they're the same for every
user.

Tables I'm planning to add later: `saved_foods` and `recipes`.

### Changing the database (migrations)

The tables are built by **migrations** (Flask-Migrate), not all at once. Each
file in `backend/migrations/versions/` is one change, in order:

1. `0001_first_tables`: users and scans (the prototype)
2. `0002_triggers_and_products`: triggers and products (the midterm MVP)
3. `0003_product_categories`: adds `category_names` for safer swaps

`python app.py` runs any that haven't run yet, so pulling new code never means
starting the database over. Databases made before I added migrations get
recognized automatically, and the missing steps get added on top.

When I change a table in `models.py`, I make a new migration:

```bash
cd backend
source .venv/bin/activate
flask --app app db migrate -m "say what changed"
```

Then I look over the new file in `migrations/versions/` before running the
server. `flask --app app db check` tells you if the models and migrations
don't match.

---

## How a verdict is decided

This happens in `backend/services/matching.py`. Two rules guide everything:

1. **When unsure, say Caution, not Safe.** Missing a trigger is way worse than
   showing an extra warning.
2. **Always explain why**, so the person can make the final call.

| Verdict | When it's given |
|---|---|
| **Avoid** | An ingredient matches one of your triggers, or Open Food Facts lists it as an allergen. |
| **Caution** | The label says "may contain" or "made in a facility with" one of your triggers, or the product isn't in the database, has no ingredient list, or the list isn't in English. |
| **Safe** | There's a complete ingredient list and nothing on it matches your triggers. |
| **Not checked** | You haven't added any triggers yet. |

**How matching works:** each preset trigger has a list of other names it can
show up under. For example, milk also matches whey, casein, butter, and
cheese. Some triggers also have look-alikes to ignore first, like "cocoa
butter" (not dairy), "coconut milk," "buckwheat" (not wheat), and "water
chestnut" (not a tree nut). Words are matched whole, so "malt" doesn't match
"maltodextrin," and plurals work, so "egg" also matches "eggs."

These lists are a good start, not a complete medical reference.

---

## Trying it out

Here's a quick walkthrough that shows every feature:

1. **Create an account.** You land on your profile. Pick a few triggers, like
   Milk and Wheat & gluten, and type in one of your own.
2. **Scan something with milk or wheat** to get an **Avoid**, with the exact
   ingredient named.
3. **Scan something plain**, like rice cakes, to get **Safe**.
4. **Tap "Type a barcode instead"** and enter a made-up barcode, like
   `99999999999`. It isn't in the database, so you get **Caution**.
5. **Open History** and tap a scan to see why it got its verdict.
6. **Remove a trigger** in your profile, then go back to History. The verdicts
   update right away.
7. **On an Avoid, tap "Find safer swaps"** to see similar products that are
   Safe for you, then tap one to check it.

---

## Roadmap

### Phase 1: Prototype
- [x] Accounts with hashed passwords and login tokens
- [x] Barcode scanning with the phone camera
- [x] Saving scans to PostgreSQL
- [x] Backend tests
- [ ] Get the prototype running on my own phone
- [ ] Read through and understand every file
- [ ] Push it to GitHub

### Phase 2: Midterm MVP
- [x] Ingredient lookup with Open Food Facts
- [x] Health profile screen
- [x] Ingredient synonyms
- [x] Match and flag (Avoid / Caution / Safe with reasons)
- [x] Tests for the matching logic
- [x] Type a barcode when it won't scan
- [x] Tab navigation and a History screen with verdicts
- [x] Credit Open Food Facts in the app

### Phase 3: After midterm
- [ ] Safe foods list
- [ ] Recipe suggestions
- [ ] Type in an ingredient list for products that aren't in the database
- [ ] Delete account option
- [x] Safer swaps (from code review)
- [x] Code review cleanup: `.gitignore`, one login helper, smaller scanner
  files, database migrations

### Phase 4: Final
- [ ] Put the backend on a cloud host with HTTPS
- [ ] Standalone app build so demos don't depend on Wi-Fi
- [ ] Test it with people who actually have chronic illnesses
- [ ] Accessibility check (screen readers, text size, contrast)

---

## Code review feedback

My classmate Miguel reviewed the project. Here's what he suggested and what I
changed:

| Miguel's suggestion | What I did |
|---|---|
| Add a `.gitignore` for `.env`, `node_modules`, and `.venv` before anything private gets committed | The project has one (it's a hidden file, so it didn't show up in my GitHub upload). I made it stricter and added the steps below to make sure it's actually in the repo. |
| The routes that need a login all start with the same few lines to look up the user | Moved them into one `@login_required` helper in `app.py`. Now each route just gets the user handed to it. |
| Split `ScannerScreen.js` into smaller components before adding ingredient results | Pulled out `CameraScanner`, `TypeBarcodeBox`, and `PanelMessage`. `ScannerScreen.js` now just keeps track of which step it's on. |
| Use Flask-Migrate so changing the database doesn't mean starting over | Added it, with migrations that match how the tables actually grew. Old databases upgrade automatically and keep their data. |
| Feature idea: when something's flagged, show similar products that are safe | Built it as **safer swaps**. |

### Making sure secrets stay off GitHub

`.gitignore` starts with a dot, so Finder and GitHub's drag-and-drop upload
both skip it. Upload with git instead, from the `safebite` folder:

```bash
git add .gitignore
git status        # .env, node_modules, and .venv should NOT be listed
git commit -m "Add .gitignore"
git push
```

To check whether a secret already got uploaded:

```bash
git ls-files | grep -E "\.env$|node_modules|\.venv"
```

If that prints `backend/.env`, remove it with `git rm --cached backend/.env`,
commit, and make a new `JWT_SECRET_KEY`, since the old one is still in the
repo's history.

---

## Problems I've run into

**PostgreSQL wasn't running.** When I first tried to create the database, I
got an error saying it couldn't connect to the server. I thought installing
PostgreSQL also started it, but it doesn't. You have to run
`brew services start postgresql@17` first.

**University Wi-Fi blocks phone-to-laptop connections.** This is why the
"Running it on campus Wi-Fi" section exists. I learned that the problem isn't
Expo itself. Any app that needs to reach a server on my laptop would have the
same problem, so the real fix is changing how the phone reaches the laptop.

**SQLite vs PostgreSQL.** I originally thought about using SQLite because I've
used it before, but I learned SQLite is a single file that isn't really made
for lots of users writing to it at the same time over a network. PostgreSQL
is the standard choice for a multi-user backend, so I switched to that.

**A library update broke the database connection.** SQLAlchemy 2.1 changed
which PostgreSQL driver it uses by default, so a fresh install crashed with
"No module named 'psycopg'." The fix was to name the driver explicitly in
`create_app()`, so it works no matter which version gets installed.

**PostgreSQL kept being a pain when tables changed.** Before migrations, a new
table or column meant either hoping `create_all()` would handle it (it only
adds new tables, never new columns) or wiping the database. Flask-Migrate
fixed that. Each change is now a small file, and the server applies whatever
hasn't run yet.

**Some presets were saving as the wrong thing.** Text cleanup turns
underscores into spaces (Open Food Facts writes allergens like `_milk_`), but
it was also running on preset keys, so `garlic_onion` got saved as "garlic
onion" and only matched that exact phrase. Clicking through the app caught
it. Now presets are checked before cleanup, and there's a test that checks
every preset.

---

## Limitations

- **The data can be wrong.** Open Food Facts is filled in by volunteers, and
  companies change their recipes. The label in your hand is always the final
  answer.
- **"May contain" warnings are optional** in the U.S., so a product without
  one isn't guaranteed to be free of cross-contact.
- **It only knows what you tell it.** If a trigger isn't in your profile, the
  app can't flag it.
- **It checks if an ingredient is there, not how much.** It won't count carbs
  or sugar grams.
- **The ingredient name lists aren't complete.** They cover the common names,
  but a rare name for an ingredient could be missed.
- **Security shortcuts in the prototype:** it uses plain `http` instead of
  `https`, there's no limit on login attempts, and there's no password reset
  yet. These need to be fixed before real people use it.

---

## Use of AI tools

I used AI tools, including **Anthropic's Claude Opus** and **OpenAI's
models**, to build quick prototypes and test ideas before committing to
changes in the actual project. The starter prototype in this repo (login,
scanner, and scan history), the midterm MVP features (ingredient lookup,
health profile, match and flag, and the new screens), and the changes from my
code review (safer swaps, migrations, and the cleanup) were built with AI help.
I'm setting them up, reading through them, and testing them myself.

I also used AI to compare technical options (like SQLite vs PostgreSQL), check
that the technical claims in my proposal were accurate, and help draft my
proposal, pitch deck, and this README.

The decisions about what to keep, change, or drop are mine, and I'm
responsible for understanding and testing everything that goes into the
final project.

---

## Credits

- **Author:** Jesse Ortiz
- **Course:** CSCI 490 Capstone, [Semester and year]
- **Code review:** Miguel
- **Instructor:** [Instructor name]

Thanks to [Open Food Facts](https://world.openfoodfacts.org) for building a
free, open food database, and to everyone living with a chronic illness who
deals with this every day.
