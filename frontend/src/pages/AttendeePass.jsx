import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { QRDisplay } from "../components/QRDisplay.jsx";
import {
  Ticket,
  Calendar,
  MapPin,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  UserCheck
} from "lucide-react";

export function AttendeePass() {
  const { user } = useAuth();
  const [passData, setPassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchPass = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await api.getPass("FGL-2026");
      setPassData(data);
    } catch (err) {
      setError(err.message || "Failed to load entry pass");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPass();
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case "ACTIVE":
        return (
          <div className="status-badge status-active" id="ticket-status-badge">
            <span className="pulse-dot"></span>
            <CheckCircle size={15} />
            <span>ACTIVE PASS</span>
          </div>
        );
      case "REDEEMED":
        return (
          <div className="status-badge status-redeemed" id="ticket-status-badge">
            <XCircle size={15} />
            <span>ALREADY USED</span>
          </div>
        );
      case "BLOCKED":
        return (
          <div className="status-badge status-blocked" id="ticket-status-badge">
            <AlertTriangle size={15} />
            <span>BLOCKED</span>
          </div>
        );
      case "REVOKED":
        return (
          <div className="status-badge status-revoked" id="ticket-status-badge">
            <AlertTriangle size={15} />
            <span>REVOKED</span>
          </div>
        );
      case "EXPIRED":
        return (
          <div className="status-badge status-expired" id="ticket-status-badge">
            <AlertTriangle size={15} />
            <span>EXPIRED</span>
          </div>
        );
      default:
        return (
          <div className="status-badge" id="ticket-status-badge">
            <span>{status}</span>
          </div>
        );
    }
  };

  return (
    <div className="pass-page-container">
      <div className="pass-wrapper">
        <div className="pass-header-actions">
          <span className="breadcrumb-text">Official Digital Entry Pass</span>
          <button
            onClick={() => fetchPass(true)}
            className="btn-refresh"
            disabled={refreshing || loading}
            title="Refresh ticket state"
            id="refresh-pass-btn"
          >
            <RefreshCw size={14} className={refreshing ? "spin" : ""} />
            {refreshing ? "Syncing..." : "Refresh Pass"}
          </button>
        </div>

        {loading ? (
          <div className="pass-loading-card">
            <RefreshCw size={32} className="spin text-emerald" />
            <p>Verifying attendee credentials & generating secure pass...</p>
          </div>
        ) : error ? (
          <div className="pass-error-card">
            <AlertTriangle size={36} className="text-rose" />
            <h3>Unable to Issue Entry Pass</h3>
            <p className="error-description">{error}</p>
            <button onClick={() => fetchPass(false)} className="btn-primary-sm">
              Try Again
            </button>
          </div>
        ) : passData ? (
          <div className="ticket-card" id="attendee-pass-card">
            {/* Ticket Header */}
            <div className="ticket-card-header">
              <div className="event-branding">
                <div className="event-tag">
                  <Sparkles size={13} /> {passData.event?.code || "FGL-2026"}
                </div>
                <h2 className="event-name">{passData.event?.name || "Freshers Got Latent 2026"}</h2>
              </div>
              <div className="ticket-status-container">
                {getStatusBadge(passData.status)}
              </div>
            </div>

            {/* Ticket Perforation Notch */}
            <div className="ticket-divider">
              <div className="notch notch-left"></div>
              <div className="notch-line"></div>
              <div className="notch notch-right"></div>
            </div>

            {/* Attendee Info Section */}
            <div className="ticket-attendee-details">
              <div className="detail-item">
                <span className="detail-label">ATTENDEE NAME</span>
                <span className="detail-value text-bold" id="attendee-name">
                  {passData.attendee?.name || user?.name || "Arshal"}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">ROLL NUMBER</span>
                <span className="detail-value text-mono" id="attendee-roll">
                  {passData.attendee?.rollNumber || user?.rollNumber || "2025BCY0026"}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">TICKET ID</span>
                <span className="detail-value text-mono text-xs">
                  {passData.ticketCode ? passData.ticketCode.slice(0, 13) + "..." : passData.ticketId}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">ENTRY ACCESS</span>
                <span className="detail-value text-emerald">General Admission</span>
              </div>
            </div>

            {/* QR Code Presentation */}
            <div className="ticket-qr-section">
              <QRDisplay qrToken={passData.qrToken} status={passData.status} />
              <p className="qr-instruction-text">
                Show this QR at the entry gate. Single use only.
              </p>
            </div>

            {/* Ticket Footer Security Info */}
            <div className="ticket-card-footer">
              <div className="footer-security-row">
                <div className="sec-chip">
                  <UserCheck size={12} />
                  <span>Verified Attendee</span>
                </div>
                <div className="sec-chip">
                  <ShieldCheck size={12} />
                  <span>One-Time Redemption</span>
                </div>
              </div>
              <p className="footer-notice">
                Pass is strictly non-transferable. Once scanned and redeemed at the gate, duplicate entries will be immediately denied.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default AttendeePass;
