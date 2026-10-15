// CameraScanner.js - the live camera with a green frame to aim at.
// it calls onBarcodeScanned whenever it spots a barcode.

import { StyleSheet, Text, View } from "react-native";
import { CameraView } from "expo-camera";

import { colors } from "../theme";

// barcode types used on groceries (plus QR, which is handy for testing)
const SUPPORTED_BARCODE_TYPES = ["upc_a", "upc_e", "ean13", "ean8", "code128", "qr"];

// onBarcodeScanned gets { type, data } ("data" is the barcode number)
export default function CameraScanner({ onBarcodeScanned }) {
  return (
    <>
      <CameraView
        style={StyleSheet.absoluteFill} // fill the whole panel
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: SUPPORTED_BARCODE_TYPES }}
        onBarcodeScanned={onBarcodeScanned}
      />
      {/* the green frame on top of the camera */}
      <View style={styles.viewfinderFrame} pointerEvents="none" />
      <Text style={styles.scanHint}>Line up the barcode inside the frame</Text>
    </>
  );
}

const styles = StyleSheet.create({
  viewfinderFrame: {
    width: "78%",
    height: "26%", // wide and short like a barcode
    borderWidth: 3,
    borderColor: colors.brandMint,
    borderRadius: 14,
  },
  scanHint: {
    position: "absolute", // sits on top of the camera near the bottom
    bottom: 18,
    color: colors.surfaceWhite,
    backgroundColor: colors.scanHintBackground,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    fontSize: 13,
    overflow: "hidden", // needed for rounded corners on iPhone
  },
});
