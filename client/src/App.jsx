// client/src/App.jsx
// client/src/App.jsx
// client/src/App.jsx
import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Lazy loading
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Upload = lazy(() => import("./pages/Upload"));
const Requests = lazy(() => import("./pages/Requests"));
const Forum = lazy(() => import("./pages/Forum"));

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<div className="loading-screen">Loading...</div>}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/forum" element={<Forum />} />
            </Route>

            {/* 404 Fallback */}
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>

        {/* Toast Notifications */}
        <ToastContainer position="top-right" autoClose={3000} />
      </Router>
    </AuthProvider>
  );
}

export default App;
