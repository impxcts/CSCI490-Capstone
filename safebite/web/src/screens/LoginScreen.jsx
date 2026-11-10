// Log in, or flip to "create account" with the link at the bottom.

import { useState } from "react";
import { login, register } from "../api";

export default function LoginScreen({ onLogIn }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault(); // stop the page from reloading
    setError("");
    try {
      // Flask checks the email and password, and sends back an error if something's wrong
      const data = isSignUp ? await register(email, password) : await login(email, password);
      onLogIn(data, isSignUp);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="login">
      <h1 className="logo">SafeBite</h1>
      <p className="muted">Know what's safe to eat before you take a bite.</p>

      <form onSubmit={handleSubmit}>
        <h2>{isSignUp ? "Create your account" : "Welcome back"}</h2>

        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="button">{isSignUp ? "Create account" : "Log in"}</button>
      </form>

      <button className="link" onClick={() => setIsSignUp(!isSignUp)}>
        {isSignUp ? "Already have an account? Log in" : "New here? Create an account"}
      </button>
    </div>
  );
}
