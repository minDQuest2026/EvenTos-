import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Navbar from "./components/Navbar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import AttendeePass from "./pages/AttendeePass.jsx";
import GateScanner from "./pages/GateScanner.jsx";

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "AUDIENCE") return <Navigate to="/attendee/pass" replace />;
  return <Navigate to="/gate" replace />;
}

export function App() {
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/attendee/pass"
            element={
              <ProtectedRoute allowedRoles={["AUDIENCE", "ADMIN"]}>
                <AttendeePass />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gate"
            element={
              <ProtectedRoute allowedRoles={["GATE_STAFF", "ADMIN"]}>
                <GateScanner />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
