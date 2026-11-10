# SafeBite (web version)

This is me trying out SafeBite as a plain React website instead of an Expo
app. It uses the same Flask backend, so if you make an account here, it
works in the phone app too (and the other way around).

It's all in this `web/` folder, so the Expo app in `mobile/` doesn't change.

## What it can do

Pretty much everything the phone app does:

- Sign up and log in
- Pick what you avoid on the Profile tab
- Scan a barcode with your camera, or just type it in
- See Avoid / Caution / Safe and why
- Find safer swaps
- Look back at your history

## How to run it

You need two Terminal windows.

**Window 1:** start Flask like normal
```bash
cd ~/Downloads/safebite/backend
source .venv/bin/activate
python app.py
```

**Window 2:** start the website
```bash
cd ~/Downloads/safebite/web
npm install     # just the first time
npm run dev
```

Then go to **http://localhost:5173** in your browser. Your laptop's webcam
works for scanning.

Press Control + C in each window to stop.

## Using it on your phone

Phones only let websites use the camera on `https`, so run this instead:
```bash
npm run dev:https
```
Open the `Network:` address it prints (something like
`https://172.20.10.2:5173`) on your phone. You'll get a scary-looking
security warning. That's just because the certificate is homemade, so tap
through it.

Heads up: your phone and laptop still need to be on the same network
(my hotspot, since campus Wi-Fi blocks this).

## What's in here

```
web/
├── vite.config.js        sends /api requests to Flask
└── src/
    ├── App.jsx           login check + the three tabs
    ├── api.js            every call to the backend
    ├── styles.css        all the styling
    ├── screens/
    │   ├── LoginScreen.jsx
    │   ├── ScanScreen.jsx
    │   ├── HistoryScreen.jsx
    │   └── ProfileScreen.jsx
    └── components/
        ├── Camera.jsx        the live camera + barcode reading
        ├── ScanResult.jsx    the result page (and safer swaps)
        └── VerdictBadge.jsx  the little Avoid / Safe label
```

## Expo vs. plain React

The main differences I ran into:

- **Tags:** Expo uses `<View>` and `<Text>`. On the web it's just `<div>`,
  `<p>`, and `<button>`.
- **Styles:** instead of `StyleSheet.create` in every file, there's one
  normal CSS file.
- **Camera:** Expo has `expo-camera`. On the web I used a library called
  ZXing to read barcodes from the video.
- **Login:** the phone keeps your login in its secure keychain. The website
  just uses `localStorage`, which is fine for testing but not for a real launch.
- **Finding the backend:** no IP addresses to mess with. Vite passes
  anything starting with `/api` along to Flask.

## Stuff that's not great yet

- Scanning in a browser is a little slower than the phone app. Hold the
  barcode still and close to the camera.
- It only runs on my laptop right now. Putting it online would mean
  hosting both this and the backend somewhere.
