import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If attendee tries to access gate, redirect to pass; if gate staff tries to access pass, redirect to gate
    if (user.role === "AUDIENCE") {
      return <Navigate to="/attendee/pass" replace />;
    } else {
      return <Navigate to="/gate" replace />;
    }
  }

  return children;
}

export default ProtectedRoute;
