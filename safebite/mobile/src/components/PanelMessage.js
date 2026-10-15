// PanelMessage.js - a message in the middle of the dark scan panel, like
// "Checking ingredients…" or "Camera access needed", with an optional button.

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../theme";

// iconName shows an icon, or showSpinner shows a loading spinner instead.
// buttonLabel + onButtonPress add a button at the bottom (both optional)
export default function PanelMessage({
  iconName,
  showSpinner = false,
  title,
  message,
  buttonLabel,
  onButtonPress,
}) {
  return (
    <View style={styles.centeredContent}>
      {showSpinner ? (
        <ActivityIndicator size="large" color={colors.surfaceWhite} />
      ) : iconName ? (
        <Ionicons name={iconName} size={40} color={colors.lightTealText} />
      ) : null}
      <Text style={panelStyles.panelTitle}>{title}</Text>
      {message ? <Text style={panelStyles.panelMessage}>{message}</Text> : null}
      {buttonLabel ? (
        <Pressable style={panelStyles.lightButton} onPress={onButtonPress}>
          <Text style={panelStyles.lightButtonText}>{buttonLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centeredContent: {
    alignItems: "center",
    paddingHorizontal: 28,
    gap: 6,
  },
});

// text and button styles for the dark panel (TypeBarcodeBox uses these too)
export const panelStyles = StyleSheet.create({
  panelTitle: {
    color: colors.surfaceWhite,
    fontSize: 19,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },
  panelMessage: {
    color: colors.lightTealText,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 12,
  },
  lightButton: {
    backgroundColor: colors.surfaceWhite,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 28,
    marginTop: 6,
  },
  lightButtonText: {
    color: colors.brandDark,
    fontSize: 16,
    fontWeight: "700",
  },
});
