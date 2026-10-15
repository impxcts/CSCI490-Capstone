// App.js - the main component. It decides whether to show the login
// screen or the three tabs (Scan, History, Profile), and keeps track of who's logged in.

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { api } from "./src/api";
import { colors } from "./src/theme";
import TabBar from "./src/components/TabBar";
import AuthScreen from "./src/screens/AuthScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import ScannerScreen from "./src/screens/ScannerScreen";

// the name we save the login token under on the phone
const LOGIN_TOKEN_STORAGE_KEY = "safebite_token";

// what the backend sends when your login isn't valid
const UNAUTHORIZED_STATUS = 401;

// the tab names (same as the keys in TabBar.js)
const SCAN_TAB = "scan";
const HISTORY_TAB = "history";
const PROFILE_TAB = "profile";

export default function App() {
  // who's logged in: { loginToken, user }, or null if nobody
  const [currentSession, setCurrentSession] = useState(null);

  // true while we check for a saved login when the app opens
  const [isCheckingSavedLogin, setIsCheckingSavedLogin] = useState(true);

  // which tab is showing
  const [activeTab, setActiveTab] = useState(SCAN_TAB);

  // when the app opens, check if there's a saved login and if it still works
  useEffect(() => {
    async function restoreSavedLogin() {
      try {
        const savedLoginToken = await SecureStore.getItemAsync(LOGIN_TOKEN_STORAGE_KEY);

        if (savedLoginToken) {
          const { user } = await api.getCurrentUser(savedLoginToken);
          setCurrentSession({ loginToken: savedLoginToken, user });
        }
      } catch (requestError) {
        // if the token's bad or expired, delete it
        // (if it's just a network problem, keep it so they stay logged in)
        if (requestError.statusCode === UNAUTHORIZED_STATUS) {
          await SecureStore.deleteItemAsync(LOGIN_TOKEN_STORAGE_KEY).catch(() => {});
        }
      } finally {
        setIsCheckingSavedLogin(false);
      }
    }

    restoreSavedLogin();
  }, []); // [] means this only runs once

  // runs after logging in or signing up
  const handleLoginSuccess = useCallback(async ({ token, user, isNewAccount }) => {
    // save the token in the phone's secure storage
    await SecureStore.setItemAsync(LOGIN_TOKEN_STORAGE_KEY, token);

    // new accounts start on Profile so they can set up what they avoid
    setActiveTab(isNewAccount ? PROFILE_TAB : SCAN_TAB);
    setCurrentSession({ loginToken: token, user });
  }, []);

  // runs when they log out (or their login stops working)
  const handleLogout = useCallback(async () => {
    await SecureStore.deleteItemAsync(LOGIN_TOKEN_STORAGE_KEY).catch(() => {});
    setCurrentSession(null);
    setActiveTab(SCAN_TAB);
  }, []);

  // shortcuts for screens to jump to another tab
  const openScanTab = useCallback(() => setActiveTab(SCAN_TAB), []);
  const openProfileTab = useCallback(() => setActiveTab(PROFILE_TAB), []);

  // pick what to show
  let currentScreen;

  if (isCheckingSavedLogin) {
    // loading spinner
    currentScreen = (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.brandTeal} />
      </View>
    );
  } else if (!currentSession) {
    // not logged in
    currentScreen = <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  } else {
    // logged in: show whichever tab is picked
    // (switching tabs reloads them, so History and Profile always have fresh data)
    let activeTabScreen;
    if (activeTab === HISTORY_TAB) {
      activeTabScreen = (
        <HistoryScreen
          session={currentSession}
          onSessionExpired={handleLogout}
          onOpenScanner={openScanTab}
        />
      );
    } else if (activeTab === PROFILE_TAB) {
      activeTabScreen = (
        <ProfileScreen
          session={currentSession}
          onSessionExpired={handleLogout}
          onLogout={handleLogout}
        />
      );
    } else {
      activeTabScreen = (
        <ScannerScreen
          session={currentSession}
          onSessionExpired={handleLogout}
          onOpenProfile={openProfileTab}
        />
      );
    }

    currentScreen = (
      <View style={styles.tabLayout}>
        <View style={styles.tabContent}>{activeTabScreen}</View>
        <TabBar activeTab={activeTab} onSelectTab={setActiveTab} />
      </View>
    );
  }

  return (
    // keeps content out from under the notch and status bar
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {currentScreen}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // centers the loading spinner
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.screenBackground,
  },
  // the tab screen sits on top of the tab bar
  tabLayout: {
    flex: 1,
    backgroundColor: colors.screenBackground,
  },
  tabContent: {
    flex: 1,
  },
});
