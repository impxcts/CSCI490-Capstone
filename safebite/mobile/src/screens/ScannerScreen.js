// ScannerScreen.js - the Scan tab. Scan a barcode with the camera (or type it in),
// then it shows the verdict for that product.
// this file keeps track of which step we're on; the pieces it shows live in components/

import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../api";
import { colors } from "../theme";
import CameraScanner from "../components/CameraScanner";
import PanelMessage from "../components/PanelMessage";
import ScanResult from "../components/ScanResult";
import ScreenHeader from "../components/ScreenHeader";
import TypeBarcodeBox from "../components/TypeBarcodeBox";

// what we save as the barcode type when someone types it in
const TYPED_BARCODE_TYPE = "typed";

// what we save as the barcode type when someone taps a safer swap
const SWAP_BARCODE_TYPE = "swap";

// what the backend sends when your login isn't valid
const UNAUTHORIZED_STATUS = 401;

// the steps the screen goes through: ready -> checking -> done (or failed)
const STEP = {
  READY: "ready",
  CHECKING: "checking",
  DONE: "done",
  FAILED: "failed",
};

// session is who's logged in, onSessionExpired logs them out,
// and onOpenProfile switches to the Profile tab
export default function ScannerScreen({ session, onSessionExpired, onOpenProfile }) {
  // whether we're allowed to use the camera, and a function to ask for it
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // which step we're on
  const [currentStep, setCurrentStep] = useState(STEP.READY);

  // the barcode we're checking right now
  const [barcodeBeingChecked, setBarcodeBeingChecked] = useState("");

  // the result from the backend
  const [checkedScan, setCheckedScan] = useState(null);

  // what went wrong, if it failed
  const [checkErrorMessage, setCheckErrorMessage] = useState("");

  // true when showing the "type a barcode" box instead of the camera
  const [isTypingBarcode, setIsTypingBarcode] = useState(false);

  // the camera sees the same barcode a bunch of times per second,
  // so this lock makes sure we only check it once
  // (a ref updates instantly, unlike state)
  const isScanLockedRef = useRef(false);

  // sends a barcode to the backend and shows the result
  // (used by the camera, the typing box, and tapping a safer swap)
  async function checkBarcode(barcode, barcodeType) {
    setBarcodeBeingChecked(barcode);
    setCurrentStep(STEP.CHECKING);

    try {
      const { scan } = await api.checkBarcode(session.loginToken, barcode, barcodeType);
      setCheckedScan(scan);
      setCurrentStep(STEP.DONE);
    } catch (requestError) {
      // login expired, so log them out
      if (requestError.statusCode === UNAUTHORIZED_STATUS) {
        onSessionExpired();
        return;
      }
      setCheckErrorMessage(requestError.message);
      setCurrentStep(STEP.FAILED);
    }
  }

  // runs whenever the camera spots a barcode ("data" is the number)
  function handleBarcodeScanned({ type: barcodeType, data: barcodeValue }) {
    // ignore it if we're already checking one
    if (isScanLockedRef.current) {
      return;
    }
    isScanLockedRef.current = true;
    checkBarcode(barcodeValue, barcodeType);
  }

  // "Scan another" or "Try again": reset everything to scan again
  function resetForNextScan() {
    setCheckedScan(null);
    setCheckErrorMessage("");
    setCurrentStep(STEP.READY);
    isScanLockedRef.current = false;
  }

  // done: show the full result
  if (currentStep === STEP.DONE && checkedScan) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.resultScrollContent}>
          <ScanResult
            scan={checkedScan}
            session={session}
            onSessionExpired={onSessionExpired}
            onScanAnother={resetForNextScan}
            onOpenProfile={onOpenProfile}
            onCheckSwap={(swapBarcode) => checkBarcode(swapBarcode, SWAP_BARCODE_TYPE)}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // every other step uses the same header and dark panel
  let panelContent;

  if (currentStep === STEP.CHECKING) {
    panelContent = (
      <PanelMessage
        showSpinner
        title="Checking ingredients…"
        message={`Barcode ${barcodeBeingChecked}`}
      />
    );
  } else if (currentStep === STEP.FAILED) {
    panelContent = (
      <PanelMessage
        iconName="cloud-offline-outline"
        title="Couldn't check that barcode"
        message={checkErrorMessage}
        buttonLabel="Try again"
        onButtonPress={resetForNextScan}
      />
    );
  } else if (isTypingBarcode) {
    panelContent = (
      <TypeBarcodeBox onSubmit={(typedBarcode) => checkBarcode(typedBarcode, TYPED_BARCODE_TYPE)} />
    );
  } else if (!cameraPermission) {
    // still checking camera permission
    panelContent = <ActivityIndicator color={colors.surfaceWhite} />;
  } else if (!cameraPermission.granted) {
    // no camera permission yet, so ask for it
    panelContent = (
      <PanelMessage
        iconName="camera-outline"
        title="Camera access needed"
        message="SafeBite uses your camera to read product barcodes."
        buttonLabel="Allow camera"
        onButtonPress={requestCameraPermission}
      />
    );
  } else {
    // ready to scan
    panelContent = <CameraScanner onBarcodeScanned={handleBarcodeScanned} />;
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScreenHeader
        title="Scan"
        subtitle="Check a product against everything you avoid."
      />

      <View style={styles.panel}>{panelContent}</View>

      {/* the camera / typing switch (only while ready to scan) */}
      {currentStep === STEP.READY ? (
        <Pressable
          style={styles.modeSwitch}
          onPress={() => setIsTypingBarcode(!isTypingBarcode)}
          accessibilityRole="button"
        >
          <Ionicons
            name={isTypingBarcode ? "camera-outline" : "keypad-outline"}
            size={18}
            color={colors.brandTeal}
          />
          <Text style={styles.modeSwitchText}>
            {isTypingBarcode ? "Use the camera instead" : "Type a barcode instead"}
          </Text>
        </Pressable>
      ) : (
        // keeps the panel the same size while checking
        <View style={styles.modeSwitchSpacer} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBackground,
  },
  resultScrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // the dark panel the camera and messages sit in
  panel: {
    flex: 1, // take up all the space between the header and the switch
    marginHorizontal: 16,
    borderRadius: 22,
    overflow: "hidden", // rounds the camera's corners
    backgroundColor: colors.brandDark,
    justifyContent: "center",
    alignItems: "center",
  },

  // the camera / typing switch
  modeSwitch: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16,
  },
  modeSwitchText: {
    color: colors.brandTeal,
    fontSize: 15,
    fontWeight: "600",
  },
  modeSwitchSpacer: {
    height: 54, // same height as the switch
  },
});
