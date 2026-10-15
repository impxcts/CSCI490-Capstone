// config.js - figures out where the backend is

import Constants from "expo-constants";

// the port Flask runs on (same as DEFAULT_PORT in backend/app.py)
const BACKEND_PORT = 5001;

// if the automatic guess doesn't work (like when using a tunnel), you can set the
// address yourself by starting Expo with EXPO_PUBLIC_API_URL=https://... npx expo start
const MANUAL_BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || null;

// on the phone, "localhost" means the phone, not your laptop.
// so we use the laptop address Expo already knows (like "192.168.1.23:8081")
// and swap Expo's port for Flask's
function guessBackendUrl() {
  const expoHostAddress = Constants.expoConfig?.hostUri;

  // no address means we're on a simulator on the same laptop, so localhost works
  if (!expoHostAddress) {
    return `http://localhost:${BACKEND_PORT}`;
  }

  const laptopIpAddress = expoHostAddress.split(":")[0];
  return `http://${laptopIpAddress}:${BACKEND_PORT}`;
}

// the address every request gets sent to
export const API_URL = MANUAL_BACKEND_URL ?? guessBackendUrl();
