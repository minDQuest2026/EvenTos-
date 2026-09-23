import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Ticket, ScanLine, LogOut, User, ShieldCheck } from "lucide-react";

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="brand-logo">
          <div className="logo-badge">
            <Ticket className="icon-pulse" size={20} />
          </div>
          <span className="brand-name">FGL 2026</span>
          <span className="brand-subtitle">Entry Pass</span>
        </Link>

        <div className="nav-actions">
          {user ? (
            <>
              {user.role === "AUDIENCE" && (
                <Link to="/attendee/pass" className="nav-link">
                  <Ticket size={16} /> My Pass
                </Link>
              )}
              {(user.role === "GATE_STAFF" || user.role === "ADMIN") && (
                <Link to="/gate" className="nav-link">
                  <ScanLine size={16} /> Gate Scanner
                </Link>
              )}

              <div className="user-profile-badge">
                <div className="avatar-circle">
                  {user.role === "AUDIENCE" ? <User size={14} /> : <ShieldCheck size={14} />}
                </div>
                <div className="user-info-text">
                  <span className="user-name">{user.name}</span>
                  <span className={`role-pill role-${user.role.toLowerCase()}`}>
                    {user.role.replace("_", " ")}
                  </span>
                </div>
              </div>

              <button onClick={handleLogout} className="btn-logout" title="Switch / Logout">
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary-sm">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
