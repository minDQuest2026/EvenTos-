import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, Sparkles, Upload, Terminal, RefreshCw } from "lucide-react";

export function QRScanner({ onScan, disabled = false }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [manualToken, setManualToken] = useState("");
  const [inputMode, setInputMode] = useState("camera"); // 'camera' or 'manual'
  const html5QrCodeRef = useRef(null);
  const scannerContainerId = "qr-reader-viewport";

  useEffect(() => {
    if (inputMode !== "camera") {
      stopCamera();
      return;
    }

    let isMounted = true;

    async function startCamera() {
      try {
        setCameraError(null);
        const scanner = new Html5Qrcode(scannerContainerId);
        html5QrCodeRef.current = scanner;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        };

        await scanner.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            if (!disabled && isMounted) {
              onScan(decodedText);
            }
          },
          () => {
            // scan failure callback (ignored for frame-by-frame)
          }
        );

        if (isMounted) {
          setCameraActive(true);
        }
      } catch (err) {
        console.warn("Camera start warning/fallback:", err);
        if (isMounted) {
          setCameraActive(false);
          setCameraError(err?.message || "Camera access unavailable in this environment.");
          setInputMode("manual");
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [inputMode]);

  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.error("Error stopping scanner:", e);
      }
    }
    setCameraActive(false);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    onScan(manualToken.trim());
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5QrCode = new Html5Qrcode("qr-file-reader-dummy");
      const decodedText = await html5QrCode.scanFile(file, true);
      onScan(decodedText);
    } catch (err) {
      alert("No valid QR code found in uploaded image: " + err.message);
    }
  };

  return (
    <div className="scanner-card">
      <div className="scanner-mode-tabs">
        <button
          type="button"
          className={`tab-btn ${inputMode === "camera" ? "active" : ""}`}
          onClick={() => setInputMode("camera")}
          id="tab-camera"
        >
          <Camera size={16} /> Camera Scanner
        </button>
        <button
          type="button"
          className={`tab-btn ${inputMode === "manual" ? "active" : ""}`}
          onClick={() => setInputMode("manual")}
          id="tab-manual"
        >
          <Terminal size={16} /> Token Input / Upload
        </button>
      </div>

      {inputMode === "camera" && (
        <div className="camera-feed-container">
          <div id={scannerContainerId} className="scanner-viewport"></div>
          {cameraActive && (
            <div className="scanner-overlay">
              <div className="reticle-box">
                <div className="reticle-corner top-left"></div>
                <div className="reticle-corner top-right"></div>
                <div className="reticle-corner bottom-left"></div>
                <div className="reticle-corner bottom-right"></div>
                <div className="laser-line"></div>
              </div>
              <p className="scanner-hint">Align Attendee QR within target box</p>
            </div>
          )}

          {cameraError && (
            <div className="camera-error-banner">
              <CameraOff size={24} className="text-rose" />
              <div>
                <h4>Camera Not Available</h4>
                <p>{cameraError}</p>
                <p className="text-muted text-xs">Switched to Manual Token / Image Upload mode below.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {inputMode === "manual" && (
        <div className="manual-scan-box">
          <form onSubmit={handleManualSubmit} className="manual-form">
            <label htmlFor="token-input" className="form-label">
              Paste Signed QR Token:
            </label>
            <div className="input-group">
              <textarea
                id="token-input"
                className="input-textarea"
                rows={4}
                placeholder="FGL1.eyJ2IjoxLCJldmVudCI6IkZHTC0yMDI2Ii...AbCdEf..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="form-actions-row">
              <button
                type="submit"
                className="btn-primary"
                disabled={disabled || !manualToken.trim()}
                id="submit-redeem-btn"
              >
                {disabled ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />}
                Verify & Redeem Token
              </button>

              <label className="btn-secondary file-upload-btn">
                <Upload size={16} /> Upload QR Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                  id="qr-file-input"
                />
              </label>
            </div>
          </form>
          <div id="qr-file-reader-dummy" style={{ display: "none" }}></div>
        </div>
      )}
    </div>
  );
}

export default QRScanner;
