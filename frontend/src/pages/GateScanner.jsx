import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { QRScanner } from "../components/QRScanner.jsx";
import confetti from "canvas-confetti";
import {
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Scan,
  Shield,
  Clock,
  MapPin,
  User,
  ArrowRight,
  History,
  RotateCcw
} from "lucide-react";

export function GateScanner() {
  const { user } = useAuth();
  const [gateId, setGateId] = useState("gate-1");
  const [gates, setGates] = useState([{ id: "gate-1", name: "Gate 1 (Main Entrance)" }]);
  const [processing, setProcessing] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { type: 'success' | 'error', message, details }
  const [recentScans, setRecentScans] = useState([]);
  const [autoResetTimer, setAutoResetTimer] = useState(null);

  useEffect(() => {
    api.getGates()
      .then((res) => {
        if (res?.gates?.length) {
          setGates(res.gates);
        }
      })
      .catch((e) => {
        console.warn("Using fallback gates:", e.message);
      });
  }, []);

  const handleScan = async (scannedToken) => {
    if (processing || !scannedToken) return;

    setProcessing(true);
    if (autoResetTimer) {
      clearTimeout(autoResetTimer);
      setAutoResetTimer(null);
    }

    try {
      const response = await api.redeemPass({
        qrToken: scannedToken,
        gateId
      });

      // Entry Approved!
      const successData = {
        type: "success",
        message: response.message || "ENTRY APPROVED",
        attendee: response.attendee,
        gate: response.gate || gateId,
        entryTime: response.entryTime || new Date().toISOString()
      };

      setScanResult(successData);

      // Trigger festive visual effect
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 }
        });
      } catch (e) {}

      // Add to recent activity
      setRecentScans((prev) => [
        {
          id: Date.now(),
          type: "success",
          name: response.attendee?.name || "Attendee",
          roll: response.attendee?.rollNumber || "",
          time: new Date().toLocaleTimeString(),
          gate: response.gate || gateId
        },
        ...prev.slice(0, 9)
      ]);

      // Auto reset after 5 seconds
      const timer = setTimeout(() => {
        resetScanner();
      }, 5000);
      setAutoResetTimer(timer);

    } catch (err) {
      // Entry Denied
      const errMessage = err.message || "ENTRY DENIED";
      const errorData = {
        type: "error",
        message: errMessage,
        details: err.data?.details || null,
        code: err.data?.code || "DENIED"
      };

      setScanResult(errorData);

      setRecentScans((prev) => [
        {
          id: Date.now(),
          type: "error",
          name: "Denied Attempt",
          reason: errMessage,
          time: new Date().toLocaleTimeString(),
          gate: gateId
        },
        ...prev.slice(0, 9)
      ]);

      // Auto reset after 4 seconds
      const timer = setTimeout(() => {
        resetScanner();
      }, 4000);
      setAutoResetTimer(timer);

    } finally {
      setProcessing(false);
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    if (autoResetTimer) {
      clearTimeout(autoResetTimer);
      setAutoResetTimer(null);
    }
  };

  return (
    <div className="gate-scanner-container">
      <div className="scanner-layout-grid">
        {/* Left / Main: Scanner & Live Result */}
        <div className="scanner-main-panel">
          {/* Header Controls */}
          <div className="gate-controls-bar">
            <div className="gate-select-group">
              <MapPin size={18} className="text-emerald" />
              <label htmlFor="gate-select" className="gate-label">
                Active Gate:
              </label>
              <select
                id="gate-select"
                className="gate-select-dropdown"
                value={gateId}
                onChange={(e) => setGateId(e.target.value)}
                disabled={processing}
              >
                {gates.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="staff-indicator-pill">
              <Shield size={14} className="text-cyan" />
              <span>Staff: {user?.name || "Gate Staff"}</span>
            </div>
          </div>

          {/* Scanner Viewport or Result State */}
          {!scanResult ? (
            <div className="scanner-active-box">
              <QRScanner onScan={handleScan} disabled={processing} />
              <div className="scan-status-ticker" id="scan-waiting-ticker">
                <Scan size={16} className="spin-slow text-emerald" />
                <span>Waiting for scan... Point camera or paste token</span>
              </div>
            </div>
          ) : scanResult.type === "success" ? (
            /* SUCCESS BANNER */
            <div className="result-card result-approved" id="result-approved-banner">
              <div className="result-icon-circle approved">
                <CheckCircle2 size={64} />
              </div>

              <h1 className="result-title-approved" id="scan-approved-title">
                ✅ {scanResult.message}
              </h1>

              <div className="result-attendee-card">
                <div className="res-row">
                  <span className="res-label">Attendee:</span>
                  <span className="res-val text-bold" id="result-attendee-name">
                    {scanResult.attendee?.name}
                  </span>
                </div>
                <div className="res-row">
                  <span className="res-label">Roll Number:</span>
                  <span className="res-val text-mono" id="result-attendee-roll">
                    {scanResult.attendee?.rollNumber}
                  </span>
                </div>
                <div className="res-row">
                  <span className="res-label">Redemption Gate:</span>
                  <span className="res-val">{scanResult.gate}</span>
                </div>
                <div className="res-row">
                  <span className="res-label">Entry Time:</span>
                  <span className="res-val text-mono">
                    {new Date(scanResult.entryTime).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <div className="result-actions">
                <button
                  onClick={resetScanner}
                  className="btn-next-scan-approved"
                  id="btn-scan-next-approved"
                >
                  <RotateCcw size={16} /> Scan Next Attendee
                </button>
              </div>
            </div>
          ) : (
            /* ERROR / REJECTION BANNER */
            <div className="result-card result-denied" id="result-denied-banner">
              <div className="result-icon-circle denied">
                <XCircle size={64} />
              </div>

              <h1 className="result-title-denied" id="scan-denied-title">
                ❌ ENTRY DENIED
              </h1>

              <p className="result-reason-text" id="scan-denied-reason">
                {scanResult.message}
              </p>

              {scanResult.details?.firstEntry && (
                <div className="previous-redemption-info">
                  <div className="info-title">Redemption Details:</div>
                  <div className="info-item">
                    First entry recorded at:{" "}
                    <strong>{new Date(scanResult.details.firstEntry).toLocaleTimeString()}</strong>
                  </div>
                  {scanResult.details.gate && (
                    <div className="info-item">
                      At Gate: <strong>{scanResult.details.gate}</strong>
                    </div>
                  )}
                </div>
              )}

              <div className="result-actions">
                <button
                  onClick={resetScanner}
                  className="btn-next-scan-denied"
                  id="btn-scan-next-denied"
                >
                  <RotateCcw size={16} /> Scan Next Attendee
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Live Activity Feed */}
        <div className="scanner-side-panel">
          <div className="side-card">
            <div className="side-card-header">
              <History size={16} />
              <h3>Recent Scan Activity</h3>
            </div>

            <div className="activity-list" id="activity-list">
              {recentScans.length === 0 ? (
                <p className="text-muted text-sm py-4 text-center">
                  No scan attempts recorded yet during this session.
                </p>
              ) : (
                recentScans.map((scan) => (
                  <div key={scan.id} className={`activity-item item-${scan.type}`}>
                    <div className="activity-icon">
                      {scan.type === "success" ? (
                        <CheckCircle2 size={16} className="text-emerald" />
                      ) : (
                        <XCircle size={16} className="text-rose" />
                      )}
                    </div>
                    <div className="activity-info">
                      <div className="activity-primary">
                        <span className="activity-name">{scan.name}</span>
                        <span className="activity-time">{scan.time}</span>
                      </div>
                      <div className="activity-secondary">
                        {scan.type === "success" ? (
                          <span className="text-emerald text-xs">Roll: {scan.roll} • {scan.gate}</span>
                        ) : (
                          <span className="text-rose text-xs">{scan.reason}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GateScanner;
