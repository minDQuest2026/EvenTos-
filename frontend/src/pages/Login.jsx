import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { User, Shield, KeyRound, Ticket, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";

export function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [devUsers, setDevUsers] = useState([
    {
      id: "user-attendee-1",
      name: "Arshal",
      email: "arshal@test.local",
      rollNumber: "2025BCY0026",
      role: "AUDIENCE"
    },
    {
      id: "user-gate-1",
      name: "Gate Staff 1",
      email: "gate1@test.local",
      role: "GATE_STAFF"
    },
    {
      id: "user-admin-1",
      name: "Admin",
      email: "admin@test.local",
      role: "ADMIN"
    }
  ]);
  const [selectedUserId, setSelectedUserId] = useState("user-attendee-1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Attempt fetching live seeded users from backend
    api.getDevUsers()
      .then((res) => {
        if (res?.users?.length) {
          setDevUsers(res.users);
        }
      })
      .catch((err) => {
        console.log("Using default fallback dev users list:", err.message);
      });
  }, []);

  const handleLogin = async (userIdToLogin) => {
    const targetId = userIdToLogin || selectedUserId;
    setLoading(true);
    setError(null);

    try {
      const loggedInUser = await login(targetId);
      const from = location.state?.from?.pathname;

      if (from) {
        navigate(from, { replace: true });
      } else if (loggedInUser.role === "AUDIENCE") {
        navigate("/attendee/pass", { replace: true });
      } else {
        navigate("/gate", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Login failed. Ensure backend is running on port 5000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        <div className="login-header">
          <div className="event-pill">
            <Sparkles size={14} className="icon-sparkle" /> Freshers Got Latent 2026
          </div>
          <h1 className="login-title">QR Entry Portal</h1>
          <p className="login-subtitle">
            Select a test profile to simulate attendee pass viewing or gate staff redemption.
          </p>
        </div>

        {error && (
          <div className="alert-error" id="login-error-msg">
            {error}
          </div>
        )}

        <div className="profile-selector-section">
          <label className="section-label">Select Test User:</label>

          <div className="profile-cards-grid">
            {devUsers.map((u) => {
              const isSelected = selectedUserId === u.id;
              const isAudience = u.role === "AUDIENCE";

              return (
                <div
                  key={u.id}
                  className={`profile-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedUserId(u.id)}
                  id={`user-card-${u.id}`}
                >
                  <div className="profile-card-header">
                    <div className="profile-avatar">
                      {isAudience ? <User size={20} /> : <Shield size={20} />}
                    </div>
                    <span className={`role-badge role-${u.role.toLowerCase()}`}>
                      {u.role.replace("_", " ")}
                    </span>
                  </div>

                  <div className="profile-info">
                    <h3 className="profile-name">{u.name}</h3>
                    {u.rollNumber && <span className="profile-meta">Roll: {u.rollNumber}</span>}
                    <span className="profile-email">{u.email}</span>
                  </div>

                  <div className="profile-action-indicator">
                    {isSelected ? (
                      <CheckCircle2 size={18} className="text-emerald" />
                    ) : (
                      <div className="radio-circle"></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="login-cta-section">
          <button
            type="button"
            className="btn-login-primary"
            onClick={() => handleLogin(selectedUserId)}
            disabled={loading}
            id="login-btn"
          >
            {loading ? "Signing in..." : "Continue to Portal"}
            <ArrowRight size={18} />
          </button>
        </div>

        <div className="dev-notice-banner">
          <KeyRound size={14} />
          <span>Development Mode — Ed25519 Cryptographic Verification Enabled</span>
        </div>
      </div>
    </div>
  );
}

export default Login;
