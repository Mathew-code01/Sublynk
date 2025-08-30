// client/src/pages/Signup.jsx

// client/src/pages/Signup.jsx

// client/src/pages/Signup.jsx
// client/src/pages/Signup.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import "../styles/Signup.css";
import { API_BASE_URL } from "../api/config";

// import icons
import { FaEye, FaEyeSlash } from "react-icons/fa";

function Signup() {
  const navigate = useNavigate();
  const { login } = useAuth(); // auto-login after signup (optional)
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Signup failed.");
      } else {
        toast.success("Signup successful!");
        // auto-login
        if (data.token && data.user) {
          login(data.token, data.user);
          navigate("/dashboard", { replace: true });
        } else {
          navigate("/login");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error during signup.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-overlay" />
      <div className="signup-content">
        <div className="signup-left">
          <h1>Join Sublynk</h1>
          <p>Create a free account to manage subtitles.</p>
        </div>
        <div className="signup-form-box">
          <h2>Create Account</h2>
          <form onSubmit={handleSubmit}>
            <input
              name="email"
              type="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <input
              name="username"
              placeholder="Username"
              value={formData.username}
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
              {submitting ? "Signing up..." : "Sign Up"}
            </button>
          </form>
          <p className="form-footer">
            Already have an account? <Link to="/login">Log In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;
