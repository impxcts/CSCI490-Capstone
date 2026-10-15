// SaferSwaps.js - the "Safer swaps" card on a result that's Avoid or Caution.
// tap the button and it finds similar products with nothing from your avoid list.
// tap a swap to check it for real (it shows up in your history too).

import { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { api } from "../api";
import { colors } from "../theme";
import VerdictBadge from "./VerdictBadge";

// what the backend sends when your login isn't valid
const UNAUTHORIZED_STATUS = 401;

// where the search is at
const SEARCH_STATUS = {
  IDLE: "idle",
  SEARCHING: "searching",
  DONE: "done",
  FAILED: "failed",
};

// barcode is the product we're finding swaps for, session is who's logged in,
// onSessionExpired logs them out, and onCheckSwap checks a swap's barcode
export default function SaferSwaps({ barcode, session, onSessionExpired, onCheckSwap }) {
  const [searchStatus, setSearchStatus] = useState(SEARCH_STATUS.IDLE);
  const [swaps, setSwaps] = useState([]);

  // a message from the backend when there's nothing to show, or what went wrong
  const [message, setMessage] = useState("");

  // asks the backend for swaps
  async function findSwaps() {
    setSearchStatus(SEARCH_STATUS.SEARCHING);
    try {
      const result = await api.getSaferSwaps(session.loginToken, barcode);
      setSwaps(result.swaps);
      setMessage(result.message);
      setSearchStatus(SEARCH_STATUS.DONE);
    } catch (requestError) {
      if (requestError.statusCode === UNAUTHORIZED_STATUS) {
        onSessionExpired();
        return;
      }
      setMessage(requestError.message);
      setSearchStatus(SEARCH_STATUS.FAILED);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Safer swaps</Text>
      <Text style={styles.subtitle}>Similar products with nothing from your avoid list.</Text>

      {/* before searching, or after a failed search: the button */}
      {searchStatus === SEARCH_STATUS.IDLE || searchStatus === SEARCH_STATUS.FAILED ? (
        <>
          {searchStatus === SEARCH_STATUS.FAILED ? (
            <Text style={styles.errorText}>{message}</Text>
          ) : null}
          <Pressable style={styles.findButton} onPress={findSwaps} accessibilityRole="button">
            <Ionicons name="swap-horizontal" size={18} color={colors.brandTeal} />
            <Text style={styles.findButtonText}>
              {searchStatus === SEARCH_STATUS.FAILED ? "Try again" : "Find safer swaps"}
            </Text>
          </Pressable>
        </>
      ) : null}

      {/* while searching */}
      {searchStatus === SEARCH_STATUS.SEARCHING ? (
        <View style={styles.searchingRow}>
          <ActivityIndicator color={colors.brandTeal} />
          <Text style={styles.searchingText}>Looking for similar products…</Text>
        </View>
      ) : null}

      {/* nothing found */}
      {searchStatus === SEARCH_STATUS.DONE && swaps.length === 0 ? (
        <Text style={styles.emptyText}>{message}</Text>
      ) : null}

      {/* the swaps */}
      {searchStatus === SEARCH_STATUS.DONE && swaps.length > 0 ? (
        <View style={styles.swapList}>
          {swaps.map((swap) => (
            <Pressable
              key={swap.barcode}
              style={styles.swapRow}
              onPress={() => onCheckSwap(swap.barcode)}
              accessibilityRole="button"
              accessibilityHint="Checks this product and adds it to your history"
            >
              {swap.image_url ? (
                <Image source={{ uri: swap.image_url }} style={styles.swapImage} />
              ) : (
                <View style={[styles.swapImage, styles.swapImagePlaceholder]}>
                  <Ionicons name="fast-food-outline" size={18} color={colors.textSecondary} />
                </View>
              )}
              <View style={styles.swapTextGroup}>
                <Text style={styles.swapName} numberOfLines={2}>
                  {swap.name || "Unnamed product"}
                </Text>
                {swap.brand ? <Text style={styles.swapBrand}>{swap.brand}</Text> : null}
              </View>
              <VerdictBadge verdict="safe" />
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          ))}
          <Text style={styles.hintText}>Tap one to check it yourself.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceWhite,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // the button
  findButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.brandTeal,
  },
  findButtonText: {
    color: colors.brandTeal,
    fontSize: 15,
    fontWeight: "700",
  },

  // searching, empty, and error messages
  searchingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
  },
  searchingText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.errorText,
    marginTop: 10,
  },

  // the list of swaps
  swapList: {
    marginTop: 8,
  },
  swapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  swapImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.surfaceWhite,
  },
  swapImagePlaceholder: {
    backgroundColor: colors.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
  },
  swapTextGroup: {
    flex: 1, // fill the space between the picture and the badge
  },
  swapName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  swapBrand: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },
  hintText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
  },
});
