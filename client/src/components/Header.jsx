// client / src / components / Header.jsx;

// client/src/components/Header.jsx
// client/src/components/Header.jsx
// client/src/components/Header.jsx
// client/src/components/Header.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import "../styles/Header.css";

function Header() {
  const { isAuthed, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success("You have been logged out successfully!");
    setTimeout(() => {
      navigate("/"); // Redirect to Home page after toast
    }, 300);
  };

  return (
    <header className="header">
      <div className="header__container">
        <Link to="/" className="header__logo">
          <span className="logo-text">Sublynk</span>
        </Link>

        <nav className="header__nav">
          {isAuthed ? (
            <>
              <Link to="/dashboard" className="header__link">
                Dashboard
              </Link>
              <button
                type="button"
                className="header__link header__logout"
                onClick={handleLogout}
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="header__link header__link--login">
                Log In
              </Link>
              <Link to="/signup" className="header__link header__button">
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;
