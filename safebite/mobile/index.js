/**
 * index.js - Where the app starts.
 *
 * Expo runs this file first. Its only job is to tell Expo which component
 * is the root of the app (App.js). Everything else starts from there.
 */

import { registerRootComponent } from "expo";

import App from "./App";

// Registers App as the root component. This works the same whether the
// app is running in Expo Go or as a standalone build.
registerRootComponent(App);
