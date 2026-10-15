// HistoryScreen.js - the History tab. Shows your recent scans with their verdicts.
// tap a row to see why, or pull down to refresh.

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../api";
import { colors, reasonColors } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import VerdictBadge from "../components/VerdictBadge";

// what the backend sends when your login isn't valid
const UNAUTHORIZED_STATUS = 401;

// the icon next to each reason (same ones as ScanResult.js)
const REASON_ICONS = {
  avoid: "close-circle",
  caution: "alert-circle",
  safe: "checkmark-circle",
  info: "information-circle",
};

// turns the backend's time into something like "Oct 15, 1:15 PM"
function formatScanTime(isoTimestamp) {
  return new Date(isoTimestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// the name to show for a scan ("Unknown product" if it wasn't found)
function getDisplayName(scan) {
  if (scan.product?.was_found) {
    return scan.product.name || "Unnamed product";
  }
  return "Unknown product";
}

// session is who's logged in, onSessionExpired logs them out,
// and onOpenScanner switches to the Scan tab
export default function HistoryScreen({ session, onSessionExpired, onOpenScanner }) {
  // the scans, newest first
  const [recentScans, setRecentScans] = useState([]);

  // true while it first loads
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // true while you pull down to refresh
  const [isRefreshing, setIsRefreshing] = useState(false);

  // error message if loading fails
  const [loadErrorMessage, setLoadErrorMessage] = useState("");

  // which row is open (or null)
  const [expandedScanId, setExpandedScanId] = useState(null);

  // gets the scans from the backend
  const loadScans = useCallback(async () => {
    try {
      const { scans } = await api.getRecentScans(session.loginToken);
      setRecentScans(scans);
      setLoadErrorMessage("");
    } catch (requestError) {
      if (requestError.statusCode === UNAUTHORIZED_STATUS) {
        onSessionExpired();
        return;
      }
      setLoadErrorMessage(requestError.message);
    }
  }, [session.loginToken, onSessionExpired]);

  // load them when the tab opens
  useEffect(() => {
    loadScans().finally(() => setIsFirstLoad(false));
  }, [loadScans]);

  // pull down to refresh
  async function handleRefresh() {
    setIsRefreshing(true);
    await loadScans();
    setIsRefreshing(false);
  }

  // tap a row to open it, tap again to close it
  function toggleExpandedRow(scanId) {
    setExpandedScanId(expandedScanId === scanId ? null : scanId);
  }

  // draws one row
  function renderScanRow({ item: scan }) {
    const isExpanded = scan.id === expandedScanId;

    return (
      <Pressable
        style={styles.row}
        onPress={() => toggleExpandedRow(scan.id)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityHint="Shows why it got this verdict"
      >
        <View style={styles.rowMain}>
          {scan.product?.image_url ? (
            <Image source={{ uri: scan.product.image_url }} style={styles.thumbnail} />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
              <Ionicons name="fast-food-outline" size={20} color={colors.textSecondary} />
            </View>
          )}

          <View style={styles.rowTextGroup}>
            <Text style={styles.productName} numberOfLines={1}>
              {getDisplayName(scan)}
            </Text>
            <Text style={styles.rowDetails} numberOfLines={1}>
              {scan.product?.brand ? `${scan.product.brand} · ` : ""}
              {formatScanTime(scan.scanned_at)}
            </Text>
          </View>

          <VerdictBadge verdict={scan.verdict} />
        </View>

        {/* the reasons, only for the open row */}
        {isExpanded ? (
          <View style={styles.reasonsBox}>
            {scan.reasons.map((reason, reasonIndex) => (
              <View key={reasonIndex} style={styles.reasonRow}>
                <Ionicons
                  name={REASON_ICONS[reason.level] ?? REASON_ICONS.info}
                  size={16}
                  color={reasonColors[reason.level] ?? reasonColors.info}
                  style={styles.reasonIcon}
                />
                <Text style={styles.reasonText}>{reason.message}</Text>
              </View>
            ))}
            <Text style={styles.barcodeText}>Barcode {scan.barcode}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScreenHeader
        title="History"
        subtitle="Tap a scan to see why. Verdicts update when you change your profile."
      />

      {isFirstLoad ? (
        <ActivityIndicator color={colors.brandTeal} style={styles.firstLoadSpinner} />
      ) : (
        // FlatList only draws what's on screen, so long lists stay fast
        <FlatList
          data={recentScans}
          keyExtractor={(scan) => String(scan.id)} // each row needs its own key
          renderItem={renderScanRow}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.brandTeal}
            />
          }
          ListHeaderComponent={
            loadErrorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{loadErrorMessage}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            loadErrorMessage ? null : (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={40} color={colors.textSecondary} />
                <Text style={styles.emptyTitle}>No scans yet</Text>
                <Text style={styles.emptyMessage}>
                  Products you check will show up here with their verdicts.
                </Text>
                <Pressable style={styles.emptyButton} onPress={onOpenScanner}>
                  <Text style={styles.emptyButtonText}>Scan something</Text>
                </Pressable>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBackground,
  },
  firstLoadSpinner: {
    marginTop: 40,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10, // space between rows
    flexGrow: 1, // lets the "no scans yet" message sit in the middle
  },

  // rows
  row: {
    backgroundColor: colors.surfaceWhite,
    borderRadius: 14,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  rowMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surfaceWhite,
  },
  thumbnailPlaceholder: {
    backgroundColor: colors.surfaceTint,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTextGroup: {
    flex: 1, // fill the space between the picture and the badge
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  rowDetails: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // the reasons when a row is open
  reasonsBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    gap: 6,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  reasonIcon: {
    marginTop: 2, // lines the icon up with the text
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  barcodeText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // "no scans yet" and error messages
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 60,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 6,
  },
  emptyMessage: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: "center",
  },
  emptyButton: {
    marginTop: 12,
    backgroundColor: colors.brandTeal,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  emptyButtonText: {
    color: colors.surfaceWhite,
    fontSize: 16,
    fontWeight: "700",
  },
  errorBox: {
    backgroundColor: colors.errorBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  errorText: {
    color: colors.errorText,
    fontSize: 14,
    lineHeight: 20,
  },
});
