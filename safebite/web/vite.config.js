// Vite settings.
// The proxy sends anything starting with /api over to Flask on port 5001,
// so the website and the backend look like one address to the browser.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig(({ mode }) => ({
  // `npm run dev:https` turns on https (phones only allow the camera on https)
  plugins: mode === "https" ? [react(), basicSsl()] : [react()],
  server: {
    host: true, // lets your phone open it too
    proxy: { "/api": "http://localhost:5001" },
  },
}));
