// What you see after a scan: the verdict, the product, why, and safer swaps.

import { useState } from "react";
import { getSwaps } from "../api";
import VerdictBadge, { VERDICT_NAMES } from "./VerdictBadge";

export default function ScanResult({ scan, token, onScanAnother, onCheckSwap, goToProfile }) {
  const product = scan.product;
  const [swaps, setSwaps] = useState(null); // null = haven't looked yet
  const [swapMessage, setSwapMessage] = useState("");

  async function findSwaps() {
    setSwapMessage("Looking…");
    try {
      const data = await getSwaps(token, scan.barcode);
      setSwaps(data.swaps);
      setSwapMessage(data.message);
    } catch (err) {
      setSwapMessage(err.message);
    }
  }

  // only offer swaps when there's a problem with a product we know about
  const showSwaps = product.was_found && (scan.verdict === "avoid" || scan.verdict === "caution");

  return (
    <div className="result">
      <div className={`banner ${scan.verdict}`}>{VERDICT_NAMES[scan.verdict]}</div>

      <div className="card product">
        {product.image_url && <img src={product.image_url} alt="" />}
        <div>
          <h2>{product.was_found ? product.name : "Unknown product"}</h2>
          {product.brand && <p className="muted">{product.brand}</p>}
          <p className="muted small">Barcode {scan.barcode}</p>
        </div>
      </div>

      <div className="card">
        <h3>Why</h3>
        <ul>
          {scan.reasons.map((reason, i) => (
            <li key={i}>{reason.message}</li>
          ))}
        </ul>
        {product.ingredients_text && (
          <details>
            <summary>Ingredients</summary>
            <p className="muted small">{product.ingredients_text.replaceAll("_", "")}</p>
          </details>
        )}
      </div>

      {showSwaps && (
        <div className="card">
          <h3>Safer swaps</h3>
          {swaps === null && (
            <button className="button outline" onClick={findSwaps}>
              Find safer swaps
            </button>
          )}
          {swapMessage && (!swaps || swaps.length === 0) && <p className="muted">{swapMessage}</p>}
          {swaps?.map((swap) => (
            <button key={swap.barcode} className="row" onClick={() => onCheckSwap(swap.barcode)}>
              <span>
                {swap.name}
                {swap.brand && <span className="muted small"> · {swap.brand}</span>}
              </span>
              <VerdictBadge verdict="safe" />
            </button>
          ))}
        </div>
      )}

      {scan.verdict === "unchecked" && (
        <button className="button" onClick={goToProfile}>
          Set up my profile
        </button>
      )}
      <button className="button" onClick={onScanAnother}>
        Scan another
      </button>

      <p className="muted small center">Info from Open Food Facts. Always check the label.</p>
    </div>
  );
}
