// The live camera. It keeps looking at the video until it finds a barcode,
// then calls onScan with the numbers and turns the camera off.
// The ZXing library does the actual barcode reading.

import { useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function Camera({ onScan, onError }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let camera = null; // what we use to turn the camera off
    let done = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } }, // the back camera on a phone
        videoRef.current,
        (result) => {
          if (result && !done) {
            done = true;
            onScan(result.getText());
          }
        }
      )
      .then((controls) => (camera = controls))
      .catch(onError); // camera blocked or missing

    // turn the camera off when this goes away
    return () => {
      done = true;
      camera?.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="camera">
      {/* playsInline + muted stop iPhones from opening the video full screen */}
      <video ref={videoRef} playsInline muted />
      <div className="frame" />
      <p className="hint">Line up the barcode inside the box</p>
    </div>
  );
}
