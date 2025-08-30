// client/src/pages/Login.jsx

// client/src/pages/Login.jsx

// client/src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import "../styles/Login.css";
import { API_BASE_URL } from "../api/config";

// import icons
import { FaEye, FaEyeSlash } from "react-icons/fa";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Login failed.");
      } else {
        login(data.token, data.user);
        toast.success("Logged in!");
        const dest = location.state?.from?.pathname || "/dashboard";
        navigate(dest, { replace: true });
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error during login.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-overlay" />
      <div className="login-content">
        <div className="login-left">
          <h1>Welcome Back</h1>
          <p>Log in to continue.</p>
        </div>
        <div className="login-form-box">
          <h2>Log In</h2>
          <form onSubmit={handleSubmit}>
            <input
              name="email"
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
            />

            {/* Password Input with Toggle */}
            <div className="password-field">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <bu
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </bu>
            </div>

            <button type="submit" disabled={submitting}>
              {submitting ? "Logging in..." : "Log In"}
            </button>
          </form>
          <p className="form-footer">
            <Link to="/forgot-password">Forgot password?</Link> |{" "}
            <Link to="/signup">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
