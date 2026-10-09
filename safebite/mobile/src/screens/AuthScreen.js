/**
 * AuthScreen.js - The login and create-account screen.
 *
 * One screen handles both, with a link at the bottom to switch between
 * "Log in" mode and "Create account" mode. When the server accepts the
 * email and password, this screen calls onLoginSuccess (from App.js),
 * which saves the login and switches to the scanner.
 */

import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../api";
import { API_URL } from "../config";
import { colors } from "../theme";

// Shortest password allowed. Must match MIN_PASSWORD_LENGTH in backend/app.py.
const MIN_PASSWORD_LENGTH = 8;

// The two modes this screen can be in.
const LOGIN_MODE = "login";
const REGISTER_MODE = "register";

/**
 * @param {function} onLoginSuccess  Called with { token, user } after a
 *                                   successful login or sign-up.
 */
export default function AuthScreen({ onLoginSuccess }) {
  // Which form we're showing: LOGIN_MODE or REGISTER_MODE.
  const [formMode, setFormMode] = useState(LOGIN_MODE);

  // What the user has typed into each box.
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  // True while waiting for the server. Disables the form so the user
  // can't submit twice.
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The error message to show under the form, or "" for none.
  const [errorMessage, setErrorMessage] = useState("");

  const isRegisterMode = formMode === REGISTER_MODE;

  // Runs when the user taps the main button or presses "go" on the keyboard.
  async function handleSubmit() {
    setErrorMessage(""); // clear any old error

    const trimmedEmail = emailInput.trim();

    // Check obvious mistakes on the phone first, so the user gets instant
    // feedback without waiting on the network. The server checks all of
    // this again, since it can't trust the app alone.
    if (!trimmedEmail || !passwordInput) {
      setErrorMessage("Enter your email and password.");
      return;
    }
    if (isRegisterMode && passwordInput.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const loginResult = isRegisterMode
        ? await api.register(trimmedEmail, passwordInput)
        : await api.login(trimmedEmail, passwordInput);

      // App.js saves the login and switches to the scanner. This screen
      // disappears, so we don't need to set isSubmitting back to false.
      await onLoginSuccess(loginResult);
    } catch (requestError) {
      // The message comes from api.js or the server and is written for
      // users to read, e.g. "Email or password is incorrect."
      setErrorMessage(requestError.message);
      setIsSubmitting(false);
    }
  }

  // Flip between "Log in" and "Create account".
  function toggleFormMode() {
    setFormMode(isRegisterMode ? LOGIN_MODE : REGISTER_MODE);
    setErrorMessage("");
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* On iPhone, push the form up when the keyboard opens so the
          password box and button aren't hidden behind it. */}
      <KeyboardAvoidingView
        style={styles.fillSpace}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* ScrollView lets small phones scroll if the keyboard takes up
            too much room. "handled" lets taps reach the buttons while the
            keyboard is open. */}
        <ScrollView
          contentContainerStyle={styles.formContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* App name and tagline */}
          <View style={styles.brandSection}>
            <Text style={styles.appName}>SafeBite</Text>
            <Text style={styles.tagline}>
              Know what's safe to eat before you take a bite.
            </Text>
          </View>

          <Text style={styles.formHeading}>
            {isRegisterMode ? "Create your account" : "Welcome back"}
          </Text>

          {/* Email box */}
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.textInput}
            value={emailInput}
            onChangeText={setEmailInput}
            placeholder="you@example.com"
            placeholderTextColor={colors.textSecondary}
            // Emails shouldn't be auto-capitalized or auto-corrected.
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            // These let the phone offer saved emails and passwords.
            textContentType="emailAddress"
            autoComplete="email"
            editable={!isSubmitting}
          />

          {/* Password box */}
          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.textInput}
            value={passwordInput}
            onChangeText={setPasswordInput}
            placeholder={isRegisterMode ? "At least 8 characters" : "Your password"}
            placeholderTextColor={colors.textSecondary}
            secureTextEntry // shows dots instead of the letters
            // "newPassword" lets the phone suggest a strong password when
            // signing up; "password" fills in a saved one when logging in.
            textContentType={isRegisterMode ? "newPassword" : "password"}
            autoComplete={isRegisterMode ? "new-password" : "current-password"}
            // Pressing "go" on the keyboard submits the form.
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
            editable={!isSubmitting}
          />

          {/* Error message, only shown when there is one. accessibilityLiveRegion
              makes Android screen readers announce it when it appears. */}
          {errorMessage ? (
            <View style={styles.errorBox} accessibilityLiveRegion="polite">
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Main button. Shows a spinner while waiting for the server. */}
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              // Fade the button while it's pressed or while submitting.
              (pressed || isSubmitting) && styles.primaryButtonFaded,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            accessibilityRole="button"
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.surfaceWhite} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isRegisterMode ? "Create account" : "Log in"}
              </Text>
            )}
          </Pressable>

          {/* Link to switch between logging in and creating an account */}
          <Pressable
            onPress={toggleFormMode}
            disabled={isSubmitting}
            style={styles.switchModeButton}
            accessibilityRole="button"
          >
            <Text style={styles.switchModeText}>
              {isRegisterMode
                ? "Already have an account? Log in"
                : "New to SafeBite? Create an account"}
            </Text>
          </Pressable>

          {/* Shows where the app is looking for the backend. Very helpful
              when troubleshooting "Can't reach the server" errors. */}
          <Text style={styles.serverAddressNote}>Server: {API_URL}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBackground,
  },
  fillSpace: {
    flex: 1,
  },
  // flexGrow + justifyContent center the form vertically on tall phones.
  formContainer: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
  },
  brandSection: {
    marginBottom: 40,
  },
  appName: {
    fontSize: 44,
    fontWeight: "800",
    color: colors.brandDark,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 22,
  },
  formHeading: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: colors.surfaceWhite,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16, // 16 or larger stops iPhones from zooming in on focus
    color: colors.textPrimary,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: colors.errorBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.errorText,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: colors.brandTeal,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52, // keeps the button the same height when the spinner shows
  },
  primaryButtonFaded: {
    opacity: 0.8,
  },
  primaryButtonText: {
    color: colors.surfaceWhite,
    fontSize: 16,
    fontWeight: "700",
  },
  switchModeButton: {
    paddingVertical: 16, // a bigger tap target than the text alone
    alignItems: "center",
  },
  switchModeText: {
    color: colors.brandTeal,
    fontSize: 15,
    fontWeight: "600",
  },
  serverAddressNote: {
    textAlign: "center",
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 24,
  },
});
