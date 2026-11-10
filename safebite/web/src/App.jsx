// The top of the app.
// If you're not logged in, it shows the login screen.
// If you are, it shows the three tabs: Scan, History, Profile.

import { useEffect, useState } from "react";
import { getMe } from "./api";
import LoginScreen from "./screens/LoginScreen";
import ScanScreen from "./screens/ScanScreen";
import HistoryScreen from "./screens/HistoryScreen";
import ProfileScreen from "./screens/ProfileScreen";

const TABS = ["Scan", "History", "Profile"];

export default function App() {
  // the saved login token (the browser remembers it in localStorage)
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("Scan");

  // when the page opens with a saved token, ask Flask who it belongs to
  useEffect(() => {
    if (token && !user) {
      getMe(token)
        .then((data) => setUser(data.user))
        .catch(logOut); // token is too old, so log out
    }
  }, [token, user]);

  function logIn(data, isNewAccount) {
    localStorage.setItem("token", data.token);
    setToken(data.token);
    setUser(data.user);
    // new accounts go to Profile first to pick what they avoid
    setTab(isNewAccount ? "Profile" : "Scan");
  }

  function logOut() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setTab("Scan");
  }

  if (!token) {
    return <LoginScreen onLogIn={logIn} />;
  }
  if (!user) {
    return <p className="loading">Loading…</p>;
  }

  return (
    <div className="app">
      <main>
        {tab === "Scan" && <ScanScreen token={token} goToProfile={() => setTab("Profile")} />}
        {tab === "History" && <HistoryScreen token={token} />}
        {tab === "Profile" && <ProfileScreen token={token} user={user} onLogOut={logOut} />}
      </main>

      <nav className="tabs">
        {TABS.map((name) => (
          <button key={name} className={tab === name ? "tab active" : "tab"} onClick={() => setTab(name)}>
            {name}
          </button>
        ))}
      </nav>
    </div>
  );
}
