# SafeBite

SafeBite is a mobile app I'm building for my capstone project. The idea is
simple: you scan a food product's barcode, and the app tells you whether it
has anything in it that could trigger your health condition, like IBD,
diabetes, or a food allergy. Eventually it will also save a list of foods
that are safe for you and suggest recipes made only from ingredients you can
actually eat.

**Where things stand right now:** I have a working prototype where you can
create an account, log in, scan a barcode with your phone's camera, and have
your scans saved to a database. Ingredient lookup and trigger matching are
what I'm working on next for the midterm MVP.

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
- [Next feature: ingredient lookup](#next-feature-ingredient-lookup)
- [Roadmap](#roadmap)
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

- **Create an account and log in.** You stay logged in even after closing
  the app.
- **Scan barcodes** with the phone camera. It reads the barcode types used
  on grocery products (UPC-A, UPC-E, EAN-13, EAN-8, Code 128).
- **Scan history.** Every scan is saved to your account and shows up in a
  "Recent scans" list. Since it's stored in the database, it's still there
  if you log out and back in.

### Planned for the midterm MVP

- **Ingredient lookup:** show the product's name and ingredients after a
  scan.
- **Health profile:** pick your conditions and add the ingredients you need
  to avoid.
- **Match and flag:** compare the ingredients to your profile and show
  **Avoid**, **Caution**, or **Safe**, plus *which* ingredient caused it.

### Planned after midterm

- A **safe foods list** you can save products to.
- **Recipe suggestions** that leave out your triggers.
- **Manual entry** for when a product can't be found.

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
| Ingredient data (next) | Open Food Facts API | It's a free, open food database you can search by barcode, and it doesn't need an API key. Still testing how good its coverage is. |

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

1. The camera reads the barcode.
2. The camera actually reads the same barcode many times per second, so the
   app uses a "lock" to only save it once.
3. The app sends the barcode and your token to Flask.
4. Flask figures out who you are from the token and saves the scan under
   your account in PostgreSQL.
5. The app shows "Saved to your history" and adds it to your list.

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
│   ├── test_app.py        10 automated tests
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
        └── screens/
            ├── AuthScreen.js      Login and create account
            └── ScannerScreen.js   Camera, scan result, and recent scans
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

You should see `Running on http://0.0.0.0:5001`. If your Mac asks whether
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

All 10 tests should pass. They use a temporary database, so they don't touch
real data. They check:

- Sign-up rules (valid email, password at least 8 characters, no duplicate
  emails)
- Logging in with the right and wrong password
- That you can't use protected routes without logging in
- Saving scans and listing them in the right order
- That one user can't see another user's scans

When I build the matching engine, it's going to need a lot more tests,
because telling someone a product is **Safe** when it isn't would be the worst
possible bug in this app.

---

## API routes

| Method | Route | Login needed? | What it does |
|---|---|---|---|
| GET | `/api/health` | No | Checks that the server is running |
| POST | `/api/register` | No | Creates an account and returns a token |
| POST | `/api/login` | No | Logs in and returns a token |
| GET | `/api/me` | Yes | Returns the logged-in user |
| POST | `/api/scans` | Yes | Saves a scanned barcode |
| GET | `/api/scans` | Yes | Returns your 20 most recent scans |

Errors always come back as `{"error": "message"}`, so the app can just show
the message to the user.

---

## Database

There are two tables right now:

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

Tables I'm planning to add later: `products` (cached ingredient info),
`triggers` (each user's ingredients to avoid), `ingredient_synonyms` (other
names for the same ingredient, like whey for milk), `saved_foods`, and
`recipes`.

---

## Next feature: ingredient lookup

This is what I'm building next. When you scan a barcode, the app will show
the product's name and ingredients instead of just the barcode number.

**Why this is next:** everything else in the MVP depends on having ingredient
data. It's also the biggest thing I don't know yet, which is how many real
products the database actually has.

**What I'm going to use:**

- **Open Food Facts API** for the product data. It's free, doesn't need a
  key, and asks apps to identify themselves in each request, so SafeBite will
  send its name and a contact email.
- **Python's `requests` library** in Flask to call the API.
- **A new `products` table** in PostgreSQL to save each product after the
  first lookup, so scanning it again is faster.
- **An updated result card** in `ScannerScreen.js` to show the name and
  ingredients, or "We couldn't find this product."
- **pytest with fake API responses**, so the tests don't need internet.

**How I'll know it's done:**

- I can scan a real product and see its name and ingredients on my phone.
- Products that aren't found show a clear message instead of crashing.
- There are tests for found, not found, and missing ingredient lists.
- I'll scan around 20 products from my own kitchen and keep track of how many
  are found, so I know if I need a backup plan like manual entry.

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
- [ ] Ingredient lookup with Open Food Facts
- [ ] Health profile screen
- [ ] Ingredient synonyms
- [ ] Match and flag (Avoid / Caution / Safe with reasons)
- [ ] Tests for the matching logic

### Phase 3: After midterm
- [ ] Safe foods list
- [ ] Recipe suggestions
- [ ] Manual entry
- [ ] Delete account option
- [ ] Credit Open Food Facts in the app

### Phase 4: Final
- [ ] Put the backend on a cloud host with HTTPS
- [ ] Standalone app build so demos don't depend on Wi-Fi
- [ ] Test it with people who actually have chronic illnesses
- [ ] Accessibility check (screen readers, text size, contrast)

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
- **Security shortcuts in the prototype:** it uses plain `http` instead of
  `https`, there's no limit on login attempts, and there's no password reset
  yet. These need to be fixed before real people use it.

---

## Use of AI tools

I used AI tools, including **Anthropic's Claude Opus** and **OpenAI's
models**, to build quick prototypes and test ideas before committing to
changes in the actual project. The starter prototype in this repo (login,
scanner, and scan history) was generated with AI help, and I'm setting it up,
reading through it, and testing it before building on top of it.

I also used AI to compare technical options (like SQLite vs PostgreSQL), check
that the technical claims in my proposal were accurate, and help draft my
proposal, pitch deck, and this README.

The decisions about what to keep, change, or drop are mine, and I'm
responsible for understanding and testing everything that goes into the
final project.

---

## Credits

- **Author:** [Your name]
- **Course:** [Course name and number], [Semester and year]
- **Instructor:** [Instructor name]

Thanks to [Open Food Facts](https://world.openfoodfacts.org) for building a
free, open food database, and to everyone living with a chronic illness who
deals with this every day.

