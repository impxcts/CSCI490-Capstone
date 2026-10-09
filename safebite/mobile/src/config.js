/**
 * config.js - Figures out where the Flask backend is.
 *
 * The problem: on your phone, "localhost" means the phone itself, not
 * your laptop. So the app can't just call http://localhost:5001.
 *
 * The fix: Expo already knows your laptop's Wi-Fi address, because that's
 * how it sends the app to your phone. We borrow that address and swap in
 * the port Flask runs on (5001). That way you never have to type your
 * laptop's IP address, even when it changes.
 */

import Constants from "expo-constants";

// The port Flask runs on. Must match DEFAULT_PORT in backend/app.py.
const BACKEND_PORT = 5001;

// Set this when the automatic guess won't work, for example when using a
// tunnel (npx expo start --tunnel) on university Wi-Fi.
//
// Two ways to set it:
//   1. Type the address here:
//        const MANUAL_BACKEND_URL = "https://your-address.trycloudflare.com";
//   2. Or leave this file alone and start Expo with it instead:
//        EXPO_PUBLIC_API_URL=https://your-address.trycloudflare.com npx expo start --tunnel
//
// Leave it as null to use the automatic guess.
const MANUAL_BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || null;

/**
 * Build the backend address from the laptop address Expo is using.
 *
 * Constants.expoConfig.hostUri looks like "192.168.1.23:8081", where 8081
 * is Expo's own port. We keep the IP and replace the port with Flask's.
 */
function guessBackendUrl() {
  const expoHostAddress = Constants.expoConfig?.hostUri;

  // No host address happens when running on a simulator on the same laptop,
  // where "localhost" really does mean the laptop.
  if (!expoHostAddress) {
    return `http://localhost:${BACKEND_PORT}`;
  }

  const laptopIpAddress = expoHostAddress.split(":")[0];
  return `http://${laptopIpAddress}:${BACKEND_PORT}`;
}

// The address every request in api.js is sent to. The manual address wins
// if one is set; otherwise we use the automatic guess.
export const API_URL = MANUAL_BACKEND_URL ?? guessBackendUrl();
