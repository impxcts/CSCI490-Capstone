// Talks to the Flask backend.
// Every function here matches a route in backend/app.py.

async function request(path, { method = "GET", body, token } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        // the login token tells Flask who we are
        Authorization: token ? `Bearer ${token}` : "",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Can't reach the server. Is `npm run dev` still running?");
  }

  // Flask always answers with JSON. If we can't read it, Flask is probably off.
  const data = await response.json().catch(() => null);
  if (data === null) {
    throw new Error("Can't reach Flask. Is `python app.py` running?");
  }

  if (!response.ok) {
    const error = new Error(data.error || "Something went wrong.");
    error.status = response.status; // 401 means the login expired
    throw error;
  }
  return data;
}

export const register = (email, password) =>
  request("/api/register", { method: "POST", body: { email, password } });

export const login = (email, password) =>
  request("/api/login", { method: "POST", body: { email, password } });

export const getMe = (token) => request("/api/me", { token });

export const checkBarcode = (token, barcode, type) =>
  request("/api/scans", { method: "POST", token, body: { barcode, barcode_type: type } });

export const getScans = (token) => request("/api/scans", { token });

export const getProfile = (token) => request("/api/profile", { token });

export const saveProfile = (token, triggers) =>
  request("/api/profile", { method: "PUT", token, body: { triggers } });

export const getSwaps = (token, barcode) => request(`/api/products/${barcode}/swaps`, { token });
