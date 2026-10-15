// AuthScreen.js - the login screen. It does both "Log in" and "Create account",
// with a link at the bottom to switch between them.

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

// shortest password allowed (same as the backend)
const MIN_PASSWORD_LENGTH = 8;

// the two modes this screen can be in
const LOGIN_MODE = "login";
const REGISTER_MODE = "register";

// onLoginSuccess comes from App.js and runs once they're logged in
export default function AuthScreen({ onLoginSuccess }) {
  // which form we're showing
  const [formMode, setFormMode] = useState(LOGIN_MODE);

  // what's typed in each box
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  // true while we wait for the server (stops double taps)
  const [isSubmitting, setIsSubmitting] = useState(false);

  // error message to show, or "" for none
  const [errorMessage, setErrorMessage] = useState("");

  const isRegisterMode = formMode === REGISTER_MODE;

  // runs when they tap the button or hit "go" on the keyboard
  async function handleSubmit() {
    setErrorMessage(""); // clear any old error

    const trimmedEmail = emailInput.trim();

    // catch easy mistakes right away (the server double checks these too)
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

      // let App.js know they're logged in (and whether it's a brand new account)
      await onLoginSuccess({ ...loginResult, isNewAccount: isRegisterMode });
    } catch (requestError) {
      // show what went wrong, like "Email or password is incorrect."
      setErrorMessage(requestError.message);
      setIsSubmitting(false);
    }
  }

  // switch between "Log in" and "Create account"
  function toggleFormMode() {
    setFormMode(isRegisterMode ? LOGIN_MODE : REGISTER_MODE);
    setErrorMessage("");
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* moves the form up when the keyboard opens on iPhone */}
      <KeyboardAvoidingView
        style={styles.fillSpace}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* lets small phones scroll, and lets buttons work while the keyboard is open */}
        <ScrollView
          contentContainerStyle={styles.formContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* app name and tagline */}
          <View style={styles.brandSection}>
            <Text style={styles.appName}>SafeBite</Text>
            <Text style={styles.tagline}>
              Know what's safe to eat before you take a bite.
            </Text>
          </View>

          <Text style={styles.formHeading}>
            {isRegisterMode ? "Create your account" : "Welcome back"}
          </Text>

          {/* email box */}
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.textInput}
            value={emailInput}
            onChangeText={setEmailInput}
            placeholder="you@example.com"
            placeholderTextColor={colors.textSecondary}
            // no auto-capitals or autocorrect for emails
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            // lets the phone fill in saved emails
            textContentType="emailAddress"
            autoComplete="email"
            editable={!isSubmitting}
          />

          {/* password box */}
          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.textInput}
            value={passwordInput}
            onChangeText={setPasswordInput}
            placeholder={isRegisterMode ? "At least 8 characters" : "Your password"}
            placeholderTextColor={colors.textSecondary}
            secureTextEntry // shows dots instead of the letters
            // lets the phone suggest or fill in passwords
            textContentType={isRegisterMode ? "newPassword" : "password"}
            autoComplete={isRegisterMode ? "new-password" : "current-password"}
            // hitting "go" on the keyboard submits
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
            editable={!isSubmitting}
          />

          {/* error message, only if there is one */}
          {errorMessage ? (
            <View style={styles.errorBox} accessibilityLiveRegion="polite">
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* main button (shows a spinner while waiting) */}
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              // fade it while pressed or loading
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

          {/* link to switch modes */}
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

          {/* shows the server address, handy if it can't connect */}
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
  // centers the form up and down
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
    fontSize: 16, // 16+ stops iPhones from zooming in when you tap the box
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
    minHeight: 52, // keeps the button the same size when the spinner shows
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
    paddingVertical: 16, // makes it easier to tap
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
