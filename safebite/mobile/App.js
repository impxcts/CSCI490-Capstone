/**
 * App.js - The root of the app.
 *
 * This component decides which screen to show:
 *   - A loading spinner while it checks for a saved login
 *   - The scanner, if someone is logged in
 *   - The login screen, if no one is
 *
 * It also owns the logged-in user's "session" (their login token and
 * account info) and hands it down to the screens that need it.
 */

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { api } from "./src/api";
import { colors } from "./src/theme";
import AuthScreen from "./src/screens/AuthScreen";
import ScannerScreen from "./src/screens/ScannerScreen";

// The name the login token is saved under in the phone's secure storage.
const LOGIN_TOKEN_STORAGE_KEY = "safebite_token";

// HTTP status the backend sends when a login token is missing or invalid.
const UNAUTHORIZED_STATUS = 401;

export default function App() {
  // The logged-in user's session: { loginToken, user }, or null if
  // nobody is logged in.
  const [currentSession, setCurrentSession] = useState(null);

  // True while we're checking for a saved login when the app first opens.
  const [isCheckingSavedLogin, setIsCheckingSavedLogin] = useState(true);

  // Runs once when the app opens. If a login token was saved last time,
  // ask the server whether it's still valid. If it is, skip the login
  // screen and go straight to the scanner.
  useEffect(() => {
    async function restoreSavedLogin() {
      try {
        const savedLoginToken = await SecureStore.getItemAsync(LOGIN_TOKEN_STORAGE_KEY);

        if (savedLoginToken) {
          const { user } = await api.getCurrentUser(savedLoginToken);
          setCurrentSession({ loginToken: savedLoginToken, user });
        }
      } catch (requestError) {
        // The server says the token is bad or expired, so throw it away.
        // For other errors (like no network), keep the token so the user
        // isn't logged out just because the server was briefly unreachable.
        if (requestError.statusCode === UNAUTHORIZED_STATUS) {
          await SecureStore.deleteItemAsync(LOGIN_TOKEN_STORAGE_KEY).catch(() => {});
        }
      } finally {
        // Whatever happened, stop showing the loading spinner.
        setIsCheckingSavedLogin(false);
      }
    }

    restoreSavedLogin();
  }, []); // The empty [] means "only run once, when the app first opens".

  // Called by the login screen after a successful login or sign-up.
  // useCallback keeps this the same function between re-renders, so the
  // screens that receive it don't re-run their effects unnecessarily.
  const handleLoginSuccess = useCallback(async ({ token, user }) => {
    // SecureStore saves to the iOS Keychain / Android Keystore, which is
    // encrypted, instead of plain storage other apps could read.
    await SecureStore.setItemAsync(LOGIN_TOKEN_STORAGE_KEY, token);
    setCurrentSession({ loginToken: token, user });
  }, []);

  // Called when the user taps "Log out", or when the server rejects their
  // token. Deleting the token means they'll see the login screen next time.
  const handleLogout = useCallback(async () => {
    await SecureStore.deleteItemAsync(LOGIN_TOKEN_STORAGE_KEY).catch(() => {});
    setCurrentSession(null);
  }, []);

  // Pick which screen to show.
  let currentScreen;
  if (isCheckingSavedLogin) {
    currentScreen = (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.brandTeal} />
      </View>
    );
  } else if (currentSession) {
    currentScreen = <ScannerScreen session={currentSession} onLogout={handleLogout} />;
  } else {
    currentScreen = <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    // SafeAreaProvider lets screens keep their content clear of the
    // notch, status bar, and home indicator on every phone.
    <SafeAreaProvider>
      {/* Dark status bar icons, since our background is light. */}
      <StatusBar style="dark" />
      {currentScreen}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // Centers the spinner on the screen.
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.screenBackground,
  },
});
