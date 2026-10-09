/**
 * api.js - Every request the app sends to the Flask backend.
 *
 * All requests go through one function, sendRequest(), so they all handle
 * timeouts, login tokens, and errors the same way. Screens never call
 * fetch() directly; they call the functions in the `api` object at the
 * bottom of this file.
 */

import { API_URL } from "./config";

// Give up on a request after this many milliseconds (8 seconds), so the
// app shows an error instead of spinning forever if the server is down.
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Send one request to the backend and return the JSON it sends back.
 *
 * @param {string} path         The route, e.g. "/api/login"
 * @param {object} options
 * @param {string} options.method      "GET" or "POST" (default "GET")
 * @param {object} options.requestBody Data to send as JSON (optional)
 * @param {string} options.loginToken  The user's login token (optional)
 *
 * If something goes wrong, this throws an Error whose message can be shown
 * to the user. The error also has extra fields screens can check:
 *   error.isNetworkError  true if the server couldn't be reached at all
 *   error.statusCode      the HTTP status, e.g. 401 for "not logged in"
 */
async function sendRequest(path, { method = "GET", requestBody, loginToken } = {}) {
  // AbortController lets us cancel the request if it takes too long.
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  let serverResponse;
  try {
    serverResponse = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        // Only add the login header when we have a token. The backend reads
        // it to figure out which user is asking.
        ...(loginToken ? { Authorization: `Bearer ${loginToken}` } : {}),
      },
      body: requestBody ? JSON.stringify(requestBody) : undefined,
      signal: timeoutController.signal,
    });
  } catch {
    // fetch() only throws when no response came back at all: the server
    // isn't running, the phone can't reach the laptop, or we timed out.
    const networkError = new Error(
      `Can't reach the server at ${API_URL}. Check that Flask is running and your phone is on the same Wi-Fi as your laptop.`
    );
    networkError.isNetworkError = true;
    throw networkError;
  } finally {
    // Always cancel the timer, whether the request worked or not.
    clearTimeout(timeoutId);
  }

  // Read the JSON the server sent. If it isn't valid JSON for some reason,
  // fall back to an empty object instead of crashing.
  const responseBody = await serverResponse.json().catch(() => ({}));

  // serverResponse.ok is true for status codes 200-299 (success).
  if (!serverResponse.ok) {
    // Our backend always sends errors as {"error": "message"}, written so
    // they can be shown to the user as-is.
    const serverError = new Error(
      responseBody.error || `Request failed (${serverResponse.status}).`
    );
    serverError.statusCode = serverResponse.status;
    throw serverError;
  }

  return responseBody;
}

/**
 * The functions screens use to talk to the backend. Each one matches a
 * route in backend/app.py.
 */
export const api = {
  /** Create an account. Resolves to { token, user }. */
  register: (email, password) =>
    sendRequest("/api/register", {
      method: "POST",
      requestBody: { email, password },
    }),

  /** Log in. Resolves to { token, user }. */
  login: (email, password) =>
    sendRequest("/api/login", {
      method: "POST",
      requestBody: { email, password },
    }),

  /** Check who a saved token belongs to. Resolves to { user }. */
  getCurrentUser: (loginToken) => sendRequest("/api/me", { loginToken }),

  /** Save a scanned barcode. Resolves to { scan }. */
  saveScan: (loginToken, barcode, barcodeType) =>
    sendRequest("/api/scans", {
      method: "POST",
      loginToken,
      // The backend uses snake_case names (barcode_type), so we convert here.
      requestBody: { barcode, barcode_type: barcodeType },
    }),

  /** Get the user's most recent scans, newest first. Resolves to { scans }. */
  getRecentScans: (loginToken) => sendRequest("/api/scans", { loginToken }),
};
