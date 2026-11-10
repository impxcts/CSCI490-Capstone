// The History tab. Every scan, newest first. Click one to see why.
// Flask re-checks old scans against your current profile each time this loads.

import { useEffect, useState } from "react";
import { getScans } from "../api";
import VerdictBadge from "../components/VerdictBadge";

export default function HistoryScreen({ token }) {
  const [scans, setScans] = useState(null); // null = still loading
  const [openId, setOpenId] = useState(null); // which scan is opened up
  const [error, setError] = useState("");

  useEffect(() => {
    getScans(token)
      .then((data) => setScans(data.scans))
      .catch((err) => setError(err.message));
  }, [token]);

  if (error) return <p className="error screen">{error}</p>;
  if (!scans) return <p className="loading">Loading…</p>;

  return (
    <div className="screen">
      <h1>History</h1>
      {scans.length === 0 && <p className="muted">No scans yet. Go scan something!</p>}

      {scans.map((scan) => (
        <div key={scan.id} className="card">
          <button className="row" onClick={() => setOpenId(openId === scan.id ? null : scan.id)}>
            <span>
              {scan.product.was_found ? scan.product.name : "Unknown product"}
              <span className="muted small"> · {new Date(scan.scanned_at).toLocaleDateString()}</span>
            </span>
            <VerdictBadge verdict={scan.verdict} />
          </button>

          {openId === scan.id && (
            <ul>
              {scan.reasons.map((reason, i) => (
                <li key={i}>{reason.message}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
