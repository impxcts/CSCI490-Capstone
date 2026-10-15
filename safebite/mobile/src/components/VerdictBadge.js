// VerdictBadge.js - the little colored verdict pill in History, like "✕ Avoid"

import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { verdictStyles } from "../theme";

// verdict is "avoid", "caution", "safe", or "unchecked"
export default function VerdictBadge({ verdict }) {
  // use "unchecked" if we get something we don't recognize
  const style = verdictStyles[verdict] ?? verdictStyles.unchecked;

  return (
    <View
      style={[styles.badge, { backgroundColor: style.backgroundColor }]}
      // screen readers say it as one thing, like "Verdict: Avoid"
      accessible
      accessibilityLabel={`Verdict: ${style.label}`}
    >
      <Ionicons name={style.icon} size={14} color={style.textColor} />
      <Text style={[styles.label, { color: style.textColor }]}>{style.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row", // icon and text side by side
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999, // fully rounded ends
    alignSelf: "flex-start", // only as wide as its content
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
  },
});
