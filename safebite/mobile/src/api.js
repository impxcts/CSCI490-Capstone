// api.js - all the requests the app sends to the backend.
// screens call the functions in `api` at the bottom instead of using fetch() directly

import { API_URL } from "./config";

// give up after 12 seconds so the app doesn't spin forever
const REQUEST_TIMEOUT_MS = 12000;

// sends one request to the backend and gives back the JSON it returns
// if something goes wrong it throws an error with a message we can show the user
async function sendRequest(path, { method = "GET", requestBody, loginToken } = {}) {
  // lets us cancel the request if it takes too long
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  let serverResponse;
  try {
    serverResponse = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        // add the login token if we have one, so the backend knows who we are
        ...(loginToken ? { Authorization: `Bearer ${loginToken}` } : {}),
      },
      body: requestBody ? JSON.stringify(requestBody) : undefined,
      signal: timeoutController.signal,
    });
  } catch {
    // we never heard back (server's off, wrong Wi-Fi, or it timed out)
    const networkError = new Error(
      `Can't reach the server at ${API_URL}. Check that Flask is running and your phone is on the same Wi-Fi as your laptop.`
    );
    networkError.isNetworkError = true;
    throw networkError;
  } finally {
    // stop the timer either way
    clearTimeout(timeoutId);
  }

  // read the JSON (or use an empty object if it's not valid JSON)
  const responseBody = await serverResponse.json().catch(() => ({}));

  // anything that's not a 200-something is an error
  if (!serverResponse.ok) {
    // the backend sends errors as {"error": "message"}
    const serverError = new Error(
      responseBody.error || `Request failed (${serverResponse.status}).`
    );
    serverError.statusCode = serverResponse.status;
    throw serverError;
  }

  return responseBody;
}

// the functions the screens use, one for each backend route
export const api = {
  // create an account -> { token, user }
  register: (email, password) =>
    sendRequest("/api/register", {
      method: "POST",
      requestBody: { email, password },
    }),

  // log in -> { token, user }
  login: (email, password) =>
    sendRequest("/api/login", {
      method: "POST",
      requestBody: { email, password },
    }),

  // check who a saved token belongs to -> { user }
  getCurrentUser: (loginToken) => sendRequest("/api/me", { loginToken }),

  // look up a barcode, check it, and save it -> { scan } (with product, verdict, and reasons)
  checkBarcode: (loginToken, barcode, barcodeType) =>
    sendRequest("/api/scans", {
      method: "POST",
      loginToken,
      // the backend calls it barcode_type
      requestBody: { barcode, barcode_type: barcodeType },
    }),

  // get recent scans with verdicts -> { scans }
  getRecentScans: (loginToken) => sendRequest("/api/scans", { loginToken }),

  // get the user's triggers and the preset options -> { triggers, catalog }
  getProfile: (loginToken) => sendRequest("/api/profile", { loginToken }),

  // replace the user's whole trigger list -> { triggers, catalog }
  saveProfile: (loginToken, triggerNames) =>
    sendRequest("/api/profile", {
      method: "PUT",
      loginToken,
      requestBody: { triggers: triggerNames },
    }),

  // find similar products that are safe for this user -> { swaps, message }
  getSaferSwaps: (loginToken, barcode) =>
    sendRequest(`/api/products/${encodeURIComponent(barcode)}/swaps`, { loginToken }),
};
