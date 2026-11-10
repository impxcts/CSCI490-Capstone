// The Scan tab. Turn on the camera (or type a barcode), then see the result.

import { useState } from "react";
import { checkBarcode } from "../api";
import Camera from "../components/Camera";
import ScanResult from "../components/ScanResult";

export default function ScanScreen({ token, goToProfile }) {
  const [cameraOn, setCameraOn] = useState(false);
  const [typed, setTyped] = useState("");
  const [checking, setChecking] = useState(false);
  const [scan, setScan] = useState(null); // the result from Flask
  const [error, setError] = useState("");

  async function check(barcode, type) {
    setCameraOn(false);
    setChecking(true);
    setError("");
    try {
      const data = await checkBarcode(token, barcode, type);
      setScan(data.scan);
    } catch (err) {
      setError(err.message);
    }
    setChecking(false);
  }

  function handleTypedSubmit(event) {
    event.preventDefault();
    check(typed.replaceAll(" ", ""), "typed"); // people sometimes type spaces
  }

  if (scan) {
    return (
      <div className="screen">
        <ScanResult
          scan={scan}
          token={token}
          goToProfile={goToProfile}
          onCheckSwap={(barcode) => check(barcode, "swap")}
          onScanAnother={() => {
            setScan(null);
            setTyped("");
          }}
        />
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>Scan</h1>
      <p className="muted">Check a product against everything you avoid.</p>

      <div className="panel">
        {checking ? (
          <p>Checking ingredients…</p>
        ) : cameraOn ? (
          <Camera
            onScan={(barcode) => check(barcode, "camera")}
            onError={() => {
              setCameraOn(false);
              setError("The camera didn't start. Allow camera access, or type the barcode below.");
            }}
          />
        ) : (
          <button className="button light" onClick={() => setCameraOn(true)}>
            Turn on camera
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <form className="type-barcode" onSubmit={handleTypedSubmit}>
        <input
          inputMode="numeric"
          placeholder="Or type a barcode"
          aria-label="Barcode number"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <button className="button small">Check</button>
      </form>
    </div>
  );
}
