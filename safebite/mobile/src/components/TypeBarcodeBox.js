// TypeBarcodeBox.js - the "type a barcode" box, for when the camera can't read one.
// it checks what they typed, then hands a clean barcode to onSubmit.

import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors } from "../theme";
import { panelStyles } from "./PanelMessage";

// product barcodes are 8 to 14 digits long
const MIN_TYPED_BARCODE_LENGTH = 8;
const MAX_TYPED_BARCODE_LENGTH = 14;

// onSubmit gets the cleaned-up barcode
export default function TypeBarcodeBox({ onSubmit }) {
  // what they typed, and an error message if it's not a real barcode
  const [typedBarcode, setTypedBarcode] = useState("");
  const [typedBarcodeError, setTypedBarcodeError] = useState("");

  // runs when they tap "Check barcode" or hit search on the keyboard
  function handleSubmit() {
    // take out any spaces or dashes they typed
    const cleanedBarcode = typedBarcode.replace(/[\s-]/g, "");

    if (!/^\d+$/.test(cleanedBarcode)) {
      setTypedBarcodeError("Use only the numbers printed under the barcode.");
      return;
    }
    if (
      cleanedBarcode.length < MIN_TYPED_BARCODE_LENGTH ||
      cleanedBarcode.length > MAX_TYPED_BARCODE_LENGTH
    ) {
      setTypedBarcodeError(
        `Barcodes are ${MIN_TYPED_BARCODE_LENGTH} to ${MAX_TYPED_BARCODE_LENGTH} digits long.`
      );
      return;
    }

    setTypedBarcodeError("");
    onSubmit(cleanedBarcode);
  }

  return (
    <View style={styles.typingContent}>
      <Text style={panelStyles.panelTitle}>Type the barcode</Text>
      <Text style={panelStyles.panelMessage}>
        Enter the numbers printed under the barcode lines.
      </Text>
      <TextInput
        style={styles.barcodeInput}
        value={typedBarcode}
        onChangeText={setTypedBarcode}
        placeholder="e.g. 041196910759"
        placeholderTextColor={colors.textSecondary}
        keyboardType="number-pad"
        maxLength={20}
        autoFocus
        onSubmitEditing={handleSubmit}
        returnKeyType="search"
        accessibilityLabel="Barcode number"
      />
      {typedBarcodeError ? (
        <Text style={styles.typedBarcodeError} accessibilityLiveRegion="polite">
          {typedBarcodeError}
        </Text>
      ) : null}
      <Pressable style={panelStyles.lightButton} onPress={handleSubmit}>
        <Text style={panelStyles.lightButtonText}>Check barcode</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  typingContent: {
    width: "100%",
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 6,
  },
  barcodeInput: {
    width: "100%",
    backgroundColor: colors.surfaceWhite,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    letterSpacing: 2,
    textAlign: "center",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  typedBarcodeError: {
    color: "#FFB4AB", // light red so it shows up on the dark panel
    fontSize: 14,
    textAlign: "center",
    marginBottom: 6,
  },
});
