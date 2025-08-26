// client/src/components/DashHeader.jsx

// client/src/components/DashHeader.jsx
// client/src/components/DashHeader.jsx
// client/src/components/DashHeader.jsx
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "../styles/DashHeader.css";

const DashHeader = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const menuRef = useRef(null);
  const toggleBtnRef = useRef(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        toggleBtnRef.current &&
        !toggleBtnRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // Show the logout modal
  const handleLogoutClick = () => setShowLogoutModal(true);

  // Confirm logout
  const confirmLogout = () => {
    logout();
    toast.success("You have been logged out successfully!");
    setShowLogoutModal(false);
    setTimeout(() => navigate("/"), 300); // Redirect to Home with toast delay
  };

  // Cancel logout
  const cancelLogout = () => setShowLogoutModal(false);

  return (
    <>
      <header className="dash-header">
        <div className="dash-header-container">
          <h1 className="dash-title">Sublynk</h1>

          <span className="dash-greeting">
            Hi {user?.username || user?.email}!
          </span>

          <button
            ref={toggleBtnRef}
            className="dash-menu-toggle"
            onClick={toggleMenu}
          >
            {menuOpen ? "✕" : "☰"}
          </button>

          <nav ref={menuRef} className={`dash-nav ${menuOpen ? "open" : ""}`}>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/upload">Upload</Link>
            <Link to="/requests">Requests</Link>
            <Link to="/forum">Forum</Link>
            <button onClick={handleLogoutClick} className="logout-btn">
              Logout
            </button>
          </nav>
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="logout-modal-backdrop">
          <div className="logout-modal">
            <h3>Are you sure you want to log out?</h3>
            <div className="logout-modal-buttons">
              <button className="confirm" onClick={confirmLogout}>
                Yes
              </button>
              <button className="cancel" onClick={cancelLogout}>
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DashHeader;
