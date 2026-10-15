// ProfileScreen.js - the Profile tab. Tap chips to pick what you avoid, or type in your own.
// changes save right away, and there's also your account info and a log out button.

import { useEffect, useRef, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../api";
import { colors } from "../theme";
import ScreenHeader from "../components/ScreenHeader";

// what the backend sends when your login isn't valid
const UNAUTHORIZED_STATUS = 401;

// rules for typed-in triggers (same as the backend)
const MIN_CUSTOM_TRIGGER_LENGTH = 2;
const MAX_CUSTOM_TRIGGER_LENGTH = 40;
const CUSTOM_TRIGGER_PATTERN = /^[a-z0-9][a-z0-9 '-]*$/;

// how saving is going, shown under the title
const SAVE_STATUS = {
  IDLE: "idle",
  SAVING: "saving",
  SAVED: "saved",
  FAILED: "failed",
};

// capitalizes the first letter, so "garlic" shows as "Garlic"
function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// session is who's logged in, onSessionExpired logs them out if their login stops working,
// and onLogout runs when they tap "Log out"
export default function ProfileScreen({ session, onSessionExpired, onLogout }) {
  // the preset options, in groups
  const [triggerCatalog, setTriggerCatalog] = useState([]);

  // everything they avoid, like ["milk", "garlic"]
  const [selectedTriggers, setSelectedTriggers] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadErrorMessage, setLoadErrorMessage] = useState("");

  const [saveStatus, setSaveStatus] = useState(SAVE_STATUS.IDLE);
  const [saveErrorMessage, setSaveErrorMessage] = useState("");

  // the "add your own" box
  const [customTriggerInput, setCustomTriggerInput] = useState("");
  const [customTriggerError, setCustomTriggerError] = useState("");

  // the last list that saved, so we can go back to it if a save fails
  const lastSavedTriggersRef = useRef([]);

  // counts saves, so if they tap fast we only use the newest one's result
  const latestSaveNumberRef = useRef(0);

  // load the profile when the tab opens
  useEffect(() => {
    let isScreenStillShowing = true;

    api
      .getProfile(session.loginToken)
      .then((profile) => {
        if (!isScreenStillShowing) return;
        setTriggerCatalog(profile.catalog);
        setSelectedTriggers(profile.triggers);
        lastSavedTriggersRef.current = profile.triggers;
      })
      .catch((requestError) => {
        if (requestError.statusCode === UNAUTHORIZED_STATUS) {
          onSessionExpired();
          return;
        }
        if (isScreenStillShowing) setLoadErrorMessage(requestError.message);
      })
      .finally(() => {
        if (isScreenStillShowing) setIsLoading(false);
      });

    // stop updating if they leave the tab before it loads
    return () => {
      isScreenStillShowing = false;
    };
  }, [session.loginToken, onSessionExpired]);

  // all the preset keys, so we can tell which triggers they typed themselves
  const presetKeys = new Set(
    triggerCatalog.flatMap((group) => group.triggers.map((trigger) => trigger.key))
  );
  const customTriggers = selectedTriggers.filter((name) => !presetKeys.has(name));

  // show the new list right away, then save it
  async function saveTriggers(newTriggerList) {
    setSelectedTriggers(newTriggerList);
    setSaveStatus(SAVE_STATUS.SAVING);
    setSaveErrorMessage("");

    latestSaveNumberRef.current += 1;
    const thisSaveNumber = latestSaveNumberRef.current;

    try {
      const savedProfile = await api.saveProfile(session.loginToken, newTriggerList);
      lastSavedTriggersRef.current = savedProfile.triggers;

      // a newer save already started, so skip this one
      if (thisSaveNumber !== latestSaveNumberRef.current) return;

      // use the server's version (it might have cleaned up a name, like "Peanuts" -> "peanuts")
      setSelectedTriggers(savedProfile.triggers);
      setSaveStatus(SAVE_STATUS.SAVED);
    } catch (requestError) {
      if (requestError.statusCode === UNAUTHORIZED_STATUS) {
        onSessionExpired();
        return;
      }
      if (thisSaveNumber !== latestSaveNumberRef.current) return;

      // go back to the last list that saved
      setSelectedTriggers(lastSavedTriggersRef.current);
      setSaveStatus(SAVE_STATUS.FAILED);
      setSaveErrorMessage(requestError.message);
    }
  }

  // tapping a chip turns it on or off
  function toggleTrigger(triggerName) {
    const newTriggerList = selectedTriggers.includes(triggerName)
      ? selectedTriggers.filter((name) => name !== triggerName)
      : [...selectedTriggers, triggerName];
    saveTriggers(newTriggerList);
  }

  // the "Add" button for typed-in triggers
  function addCustomTrigger() {
    const cleanedName = customTriggerInput.trim().toLowerCase().replace(/\s+/g, " ");

    if (
      cleanedName.length < MIN_CUSTOM_TRIGGER_LENGTH ||
      cleanedName.length > MAX_CUSTOM_TRIGGER_LENGTH
    ) {
      setCustomTriggerError(
        `Use ${MIN_CUSTOM_TRIGGER_LENGTH} to ${MAX_CUSTOM_TRIGGER_LENGTH} characters.`
      );
      return;
    }
    if (!CUSTOM_TRIGGER_PATTERN.test(cleanedName)) {
      setCustomTriggerError("Use letters, numbers, spaces, or hyphens.");
      return;
    }
    if (selectedTriggers.includes(cleanedName)) {
      setCustomTriggerError("That's already on your list.");
      return;
    }

    setCustomTriggerError("");
    setCustomTriggerInput("");
    saveTriggers([...selectedTriggers, cleanedName]);
  }

  // the little status line under the title
  const triggerCount = selectedTriggers.length;
  const triggerCountText =
    triggerCount === 0
      ? "Nothing on your list yet"
      : `${triggerCount} ${triggerCount === 1 ? "thing" : "things"} on your avoid list`;
  const saveStatusText = {
    [SAVE_STATUS.IDLE]: "",
    [SAVE_STATUS.SAVING]: " · Saving…",
    [SAVE_STATUS.SAVED]: " · Saved",
    [SAVE_STATUS.FAILED]: "",
  }[saveStatus];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {/* moves things up when the keyboard opens on iPhone */}
      <KeyboardAvoidingView
        style={styles.fillSpace}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader
            title="Your profile"
            subtitle="Pick everything you need to avoid. Every scan is checked against this list."
          />

          {isLoading ? (
            <ActivityIndicator color={colors.brandTeal} style={styles.loadingSpinner} />
          ) : loadErrorMessage ? (
            <View style={[styles.messageBox, styles.errorBox]}>
              <Text style={styles.errorText}>{loadErrorMessage}</Text>
            </View>
          ) : (
            <>
              {/* how many triggers + save status */}
              <View style={styles.statusRow} accessibilityLiveRegion="polite">
                <Ionicons
                  name={triggerCount > 0 ? "shield-checkmark" : "shield-outline"}
                  size={18}
                  color={colors.brandTeal}
                />
                <Text style={styles.statusText}>
                  {triggerCountText}
                  {saveStatusText}
                </Text>
              </View>
              {saveStatus === SAVE_STATUS.FAILED ? (
                <View style={[styles.messageBox, styles.errorBox]}>
                  <Text style={styles.errorText}>
                    Couldn't save that change. {saveErrorMessage}
                  </Text>
                </View>
              ) : null}

              {/* a card for each group of presets */}
              {triggerCatalog.map((group) => (
                <View key={group.title} style={styles.card}>
                  <Text style={styles.cardTitle}>{group.title}</Text>
                  <Text style={styles.cardSubtitle}>{group.subtitle}</Text>
                  <View style={styles.chipWrap}>
                    {group.triggers.map((trigger) => (
                      <TriggerChip
                        key={trigger.key}
                        label={trigger.label}
                        isSelected={selectedTriggers.includes(trigger.key)}
                        onPress={() => toggleTrigger(trigger.key)}
                      />
                    ))}
                  </View>
                </View>
              ))}

              {/* the "your own" card */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Your own</Text>
                <Text style={styles.cardSubtitle}>
                  Anything else you react to, like a specific ingredient.
                </Text>
                <View style={styles.addRow}>
                  <TextInput
                    style={styles.addInput}
                    value={customTriggerInput}
                    onChangeText={setCustomTriggerInput}
                    placeholder="e.g. garlic"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={MAX_CUSTOM_TRIGGER_LENGTH}
                    onSubmitEditing={addCustomTrigger}
                    returnKeyType="done"
                    accessibilityLabel="Ingredient to avoid"
                  />
                  <Pressable
                    style={styles.addButton}
                    onPress={addCustomTrigger}
                    accessibilityRole="button"
                  >
                    <Text style={styles.addButtonText}>Add</Text>
                  </Pressable>
                </View>
                {customTriggerError ? (
                  <Text style={styles.inlineErrorText}>{customTriggerError}</Text>
                ) : null}
                {customTriggers.length > 0 ? (
                  <View style={styles.chipWrap}>
                    {customTriggers.map((triggerName) => (
                      <TriggerChip
                        key={triggerName}
                        label={capitalize(triggerName)}
                        isSelected
                        showRemoveIcon
                        onPress={() => toggleTrigger(triggerName)}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            </>
          )}

          {/* account */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account</Text>
            <Text style={styles.cardSubtitle}>Logged in as {session.user.email}</Text>
            <Pressable style={styles.logoutButton} onPress={onLogout} accessibilityRole="button">
              <Ionicons name="log-out-outline" size={18} color={colors.errorText} />
              <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
          </View>

          {/* about */}
          <Text style={styles.aboutText}>
            SafeBite helps you read labels faster. It isn't medical advice, so always
            check the label and follow your care team's guidance. Product information
            comes from Open Food Facts, under the Open Database License.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// one tappable chip: teal with a checkmark when picked, white with a plus when not
function TriggerChip({ label, isSelected, showRemoveIcon = false, onPress }) {
  let iconName = isSelected ? "checkmark" : "add";
  if (showRemoveIcon) iconName = "close";

  return (
    <Pressable
      style={[styles.chip, isSelected ? styles.chipSelected : styles.chipUnselected]}
      onPress={onPress}
      // screen readers treat it like a checkbox
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={showRemoveIcon ? `Remove ${label}` : label}
      hitSlop={4}
    >
      <Ionicons
        name={iconName}
        size={16}
        color={isSelected ? colors.surfaceWhite : colors.brandTeal}
      />
      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
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
  scrollContent: {
    paddingBottom: 32,
  },
  loadingSpinner: {
    marginTop: 40,
  },

  // status line
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brandTeal,
  },

  // cards
  card: {
    backgroundColor: colors.surfaceWhite,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // chips
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap", // go to a new line when the row is full
    gap: 8,
    marginTop: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  chipUnselected: {
    backgroundColor: colors.surfaceWhite,
    borderColor: colors.borderLight,
  },
  chipSelected: {
    backgroundColor: colors.brandTeal,
    borderColor: colors.brandTeal,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  chipTextSelected: {
    color: colors.surfaceWhite,
  },

  // the "add your own" box
  addRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  addInput: {
    flex: 1,
    backgroundColor: colors.screenBackground,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16, // 16+ stops iPhones from zooming in when you tap the box
    color: colors.textPrimary,
  },
  addButton: {
    backgroundColor: colors.brandTeal,
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  addButtonText: {
    color: colors.surfaceWhite,
    fontSize: 16,
    fontWeight: "700",
  },
  inlineErrorText: {
    color: colors.errorText,
    fontSize: 14,
    marginTop: 6,
  },

  // messages
  messageBox: {
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  errorBox: {
    backgroundColor: colors.errorBackground,
  },
  errorText: {
    color: colors.errorText,
    fontSize: 14,
    lineHeight: 20,
  },

  // account and about
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  logoutText: {
    color: colors.errorText,
    fontSize: 16,
    fontWeight: "600",
  },
  aboutText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    paddingHorizontal: 24,
    marginTop: 4,
  },
});
