/**
 * ScannerScreen.js - The main screen once you're logged in.
 *
 * Top to bottom, it shows:
 *   1. A header with the app name, your email, and a "Log out" link
 *   2. A panel that shows one of three things:
 *        - a request for camera permission (if not granted yet)
 *        - the live camera, ready to scan
 *        - the result of the last scan, with a "Scan another" button
 *   3. A list of your most recent scans, loaded from the backend
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../api";
import { colors } from "../theme";

// Barcode formats found on grocery packaging. QR is included because it's
// handy for testing (you can scan a QR code off a computer screen).
const SUPPORTED_BARCODE_TYPES = ["upc_a", "upc_e", "ean13", "ean8", "code128", "qr"];

// Keep this many scans in the on-screen list. Matches RECENT_SCANS_LIMIT
// in backend/app.py.
const MAX_SCANS_SHOWN = 20;

// HTTP status the backend sends when the login token is missing or invalid.
const UNAUTHORIZED_STATUS = 401;

// The states a scan result can be in, used to pick the message to show.
const SAVE_STATUS = {
  SAVING: "saving",
  SAVED: "saved",
  FAILED: "failed",
};

/**
 * Turn an ISO timestamp from the backend into something readable,
 * like "Oct 9, 1:15 PM", in the phone's own time zone.
 */
function formatScanTime(isoTimestamp) {
  const scanDate = new Date(isoTimestamp);
  return scanDate.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * @param {object}   session    { loginToken, user } for the logged-in user
 * @param {function} onLogout   Logs the user out (from App.js)
 */
export default function ScannerScreen({ session, onLogout }) {
  // cameraPermission is null while loading, then { granted: true/false }.
  // requestCameraPermission shows the phone's "Allow camera?" popup.
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // The last scan's result: { barcode, barcodeType, saveStatus, errorMessage },
  // or null when the camera should be showing.
  const [latestScanResult, setLatestScanResult] = useState(null);

  // The user's recent scans, newest first, as sent by the backend.
  const [recentScans, setRecentScans] = useState([]);

  // True until the recent scans list has loaded the first time.
  const [isLoadingRecentScans, setIsLoadingRecentScans] = useState(true);

  // The camera reports the same barcode many times per second while it's
  // in view. This "lock" makes sure we only save the first one.
  // We use a ref instead of state because a ref changes instantly, while
  // a state update waits for the next render, which is slow enough for a
  // second copy of the scan to sneak through.
  const isScanLockedRef = useRef(false);

  // Shared error handling for every request on this screen. If the server
  // says the login is no longer valid, log the user out. Either way, return
  // the message so it can be shown.
  const handleRequestError = useCallback(
    (requestError) => {
      if (requestError.statusCode === UNAUTHORIZED_STATUS) {
        onLogout();
      }
      return requestError.message;
    },
    [onLogout]
  );

  // Load the user's recent scans when the screen opens.
  useEffect(() => {
    // If the user leaves this screen (for example, logs out) before the
    // request finishes, we must not update state on a screen that's gone.
    // This flag tracks whether the screen is still showing.
    let isScreenStillShowing = true;

    api
      .getRecentScans(session.loginToken)
      .then((responseBody) => {
        if (isScreenStillShowing) {
          setRecentScans(responseBody.scans);
        }
      })
      .catch(handleRequestError)
      .finally(() => {
        if (isScreenStillShowing) {
          setIsLoadingRecentScans(false);
        }
      });

    // React runs this "cleanup" function when the screen goes away.
    return () => {
      isScreenStillShowing = false;
    };
  }, [session.loginToken, handleRequestError]);

  // Called by the camera every time it recognizes a barcode.
  // "type" is the format (e.g. "upc_a"); "data" is the barcode number.
  async function handleBarcodeScanned({ type: barcodeType, data: barcodeValue }) {
    // Ignore repeats while we're already handling a scan.
    if (isScanLockedRef.current) {
      return;
    }
    isScanLockedRef.current = true;

    // Hide the camera and show the result card right away, while saving.
    setLatestScanResult({
      barcode: barcodeValue,
      barcodeType,
      saveStatus: SAVE_STATUS.SAVING,
    });

    try {
      const { scan: savedScan } = await api.saveScan(
        session.loginToken,
        barcodeValue,
        barcodeType
      );

      // Put the new scan at the top of the list, keeping the list short.
      setRecentScans((previousScans) =>
        [savedScan, ...previousScans].slice(0, MAX_SCANS_SHOWN)
      );

      setLatestScanResult({
        barcode: barcodeValue,
        barcodeType,
        saveStatus: SAVE_STATUS.SAVED,
      });
    } catch (requestError) {
      setLatestScanResult({
        barcode: barcodeValue,
        barcodeType,
        saveStatus: SAVE_STATUS.FAILED,
        errorMessage: handleRequestError(requestError),
      });
    }
  }

  // "Scan another" button: clear the result and unlock the scanner.
  function resetForNextScan() {
    setLatestScanResult(null);
    isScanLockedRef.current = false;
  }

  // Decide what goes in the camera panel.
  let cameraPanelContent;

  if (!cameraPermission) {
    // Still finding out whether we have camera access.
    cameraPanelContent = <ActivityIndicator color={colors.surfaceWhite} />;
  } else if (!cameraPermission.granted) {
    // No camera access yet: explain why we need it and ask.
    cameraPanelContent = (
      <View style={styles.centeredContent}>
        <Text style={styles.panelTitle}>Camera access needed</Text>
        <Text style={styles.panelMessage}>
          SafeBite uses your camera to read product barcodes.
        </Text>
        <Pressable style={styles.lightButton} onPress={requestCameraPermission}>
          <Text style={styles.lightButtonText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  } else if (latestScanResult) {
    // Just scanned something: show the result instead of the camera.
    cameraPanelContent = (
      <ScanResultCard scanResult={latestScanResult} onScanAnother={resetForNextScan} />
    );
  } else {
    // Ready to scan: show the live camera with a frame to aim at.
    cameraPanelContent = (
      <>
        <CameraView
          style={StyleSheet.absoluteFill} // fill the whole panel
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: SUPPORTED_BARCODE_TYPES }}
          onBarcodeScanned={handleBarcodeScanned}
        />
        {/* The mint-colored frame drawn over the camera.
            pointerEvents="none" lets touches pass through to the camera. */}
        <View style={styles.viewfinderFrame} pointerEvents="none" />
        <Text style={styles.scanHint}>Line up a product barcode inside the frame</Text>
      </>
    );
  }

  return (
    // Leave out the bottom edge so the scan list can run behind the
    // home indicator and use the full screen height.
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTextGroup}>
          <Text style={styles.appName}>SafeBite</Text>
          {/* numberOfLines={1} cuts off long emails with "..." */}
          <Text style={styles.loggedInEmail} numberOfLines={1}>
            {session.user.email}
          </Text>
        </View>
        {/* hitSlop makes the tap area bigger than the text itself. */}
        <Pressable onPress={onLogout} hitSlop={10} accessibilityRole="button">
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      {/* Camera panel */}
      <View style={styles.cameraPanel}>{cameraPanelContent}</View>

      {/* Recent scans list */}
      <View style={styles.recentScansSection}>
        <Text style={styles.sectionTitle}>Recent scans</Text>

        {isLoadingRecentScans ? (
          <ActivityIndicator color={colors.brandTeal} style={styles.listSpinner} />
        ) : (
          // FlatList only draws the rows that are on screen, so it stays
          // fast even with long lists.
          <FlatList
            data={recentScans}
            keyExtractor={(scan) => String(scan.id)} // each row needs a unique key
            contentContainerStyle={recentScans.length === 0 && styles.emptyListContainer}
            ListEmptyComponent={
              <Text style={styles.emptyListMessage}>
                No scans yet. Point your camera at a barcode to save your first one.
              </Text>
            }
            renderItem={({ item: scan }) => (
              <View style={styles.scanRow}>
                <Text style={styles.scanRowBarcode}>{scan.barcode}</Text>
                <Text style={styles.scanRowDetails}>
                  {scan.barcode_type || "barcode"} · {formatScanTime(scan.scanned_at)}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

/**
 * The card shown in the camera panel after a scan.
 *
 * @param {object}   scanResult     { barcode, barcodeType, saveStatus, errorMessage }
 * @param {function} onScanAnother  Clears the result and shows the camera again
 */
function ScanResultCard({ scanResult, onScanAnother }) {
  // Pick the status message based on where the save is at.
  const statusMessages = {
    [SAVE_STATUS.SAVING]: "Saving to your history…",
    [SAVE_STATUS.SAVED]: "Saved to your history",
    [SAVE_STATUS.FAILED]: scanResult.errorMessage,
  };
  const statusMessage = statusMessages[scanResult.saveStatus];

  const isSaving = scanResult.saveStatus === SAVE_STATUS.SAVING;

  return (
    <View style={styles.centeredContent}>
      <Text style={styles.resultLabel}>Scanned</Text>

      {/* selectable lets the user long-press to copy the barcode. */}
      <Text style={styles.resultBarcode} selectable>
        {scanResult.barcode}
      </Text>
      <Text style={styles.resultBarcodeType}>{scanResult.barcodeType}</Text>

      <Text
        style={[
          styles.resultStatus,
          scanResult.saveStatus === SAVE_STATUS.SAVED && styles.resultStatusSaved,
          scanResult.saveStatus === SAVE_STATUS.FAILED && styles.resultStatusFailed,
        ]}
      >
        {statusMessage}
      </Text>

      {/* Disabled while saving, so the user can't start a new scan before
          this one finishes. */}
      <Pressable
        style={styles.lightButton}
        onPress={onScanAnother}
        disabled={isSaving}
        accessibilityRole="button"
      >
        <Text style={styles.lightButtonText}>Scan another</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBackground,
  },

  // --- Header ---
  header: {
    flexDirection: "row", // put the text and the "Log out" link side by side
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerTextGroup: {
    flex: 1, // take up all the space the "Log out" link doesn't need
    marginRight: 12,
  },
  appName: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.brandDark,
    letterSpacing: -0.5,
  },
  loggedInEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.brandTeal,
  },

  // --- Camera panel ---
  cameraPanel: {
    height: "46%", // a bit under half the screen; the scan list gets the rest
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: "hidden", // clips the camera feed to the rounded corners
    backgroundColor: colors.brandDark,
    justifyContent: "center",
    alignItems: "center",
  },
  viewfinderFrame: {
    width: "78%",
    height: "38%", // wide and short, like a barcode
    borderWidth: 3,
    borderColor: colors.brandMint,
    borderRadius: 14,
  },
  scanHint: {
    position: "absolute", // float over the camera near the bottom
    bottom: 16,
    color: colors.surfaceWhite,
    backgroundColor: colors.scanHintBackground,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    fontSize: 13,
    overflow: "hidden", // needed for rounded corners on Text in iOS
  },
  centeredContent: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  panelTitle: {
    color: colors.surfaceWhite,
    fontSize: 19,
    fontWeight: "700",
    marginBottom: 8,
  },
  panelMessage: {
    color: colors.lightTealText,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
  },

  // --- Scan result card ---
  resultLabel: {
    color: colors.lightTealText,
    fontSize: 14,
    fontWeight: "600",
  },
  resultBarcode: {
    color: colors.surfaceWhite,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 6,
    textAlign: "center",
  },
  resultBarcodeType: {
    color: colors.lightTealText,
    fontSize: 13,
    marginTop: 4,
  },
  resultStatus: {
    color: colors.surfaceWhite,
    fontSize: 15,
    marginTop: 16,
    marginBottom: 22,
    textAlign: "center",
    lineHeight: 21,
  },
  resultStatusSaved: {
    color: colors.brandMint,
    fontWeight: "700",
  },
  resultStatusFailed: {
    color: colors.errorTextOnDark,
  },
  lightButton: {
    backgroundColor: colors.surfaceWhite,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 26,
  },
  lightButtonText: {
    color: colors.brandDark,
    fontSize: 16,
    fontWeight: "700",
  },

  // --- Recent scans list ---
  recentScansSection: {
    flex: 1, // fill the rest of the screen below the camera panel
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  listSpinner: {
    marginTop: 24,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  emptyListMessage: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
  },
  scanRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, // the thinnest line the screen can draw
    borderBottomColor: colors.borderLight,
  },
  scanRowBarcode: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  scanRowDetails: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
