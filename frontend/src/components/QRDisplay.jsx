import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Shield, Sparkles } from "lucide-react";

export function QRDisplay({ qrToken, status }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!qrToken) return;
    navigator.clipboard.writeText(qrToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isRedeemed = status === "REDEEMED";
  const isActive = status === "ACTIVE";

  return (
    <div className="qr-container-card">
      <div className={`qr-wrapper ${isRedeemed ? "qr-dimmed" : ""}`}>
        {qrToken ? (
          <div className="qr-box">
            <QRCodeSVG
              value={qrToken}
              size={230}
              level="M"
              includeMargin={true}
              bgColor="#ffffff"
              fgColor={isRedeemed ? "#6b7280" : "#0a0d14"}
            />
            {isRedeemed && (
              <div className="qr-overlay-used">
                <div className="used-badge-stamp">ALREADY USED</div>
              </div>
            )}
          </div>
        ) : (
          <div className="qr-placeholder">Generating Pass...</div>
        )}
      </div>

      <div className="qr-actions-row">
        <div className="security-tag">
          <Shield size={14} className="text-emerald" />
          <span>Ed25519 Cryptographically Signed</span>
        </div>

        <button
          onClick={handleCopy}
          className={`btn-copy-token ${copied ? "copied" : ""}`}
          title="Copy raw signed QR token for testing"
          id="copy-token-btn"
        >
          {copied ? (
            <>
              <Check size={14} /> Copied Token
            </>
          ) : (
            <>
              <Copy size={14} /> Copy Token
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default QRDisplay;
