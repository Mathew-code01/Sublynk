// client/src/pages/Signup.jsx

// client/src/pages/Signup.jsx

// client/src/pages/Signup.jsx
// client/src/pages/Signup.jsx
// client/src/pages/Signup.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import "../styles/Signup.css";

function Signup() {
  const navigate = useNavigate();
  const { login } = useAuth(); // auto-login after signup (optional)
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
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
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
            />
            <input
              name="email"
              type="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
            />
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
