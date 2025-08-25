// client/src/components/ProtectedRoute.jsx
// client/src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/ProtectedRoute.css";

export default function ProtectedRoute() {
  const { isAuthed, loading } = useAuth();
  const location = useLocation();

  // Show loading screen while checking authentication
  if (loading)
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading, please wait...</p>
      </div>
    );

  // If not authed and trying to access protected routes, redirect to home (not login)
  if (!isAuthed) {
    if (
      location.pathname.startsWith("/dashboard") ||
      location.pathname.startsWith("/upload") ||
      location.pathname.startsWith("/requests") ||
      location.pathname.startsWith("/forum")
    ) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />; // renders nested route if authed
}
