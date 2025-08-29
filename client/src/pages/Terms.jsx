// client/src/pages/Terms.jsx
// client/src/pages/Terms.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import "../styles/Page.css";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <section className="page">
      {/* Back button */}
      <button className="back-button" onClick={() => navigate(-1)}>
        <FiArrowLeft /> Back
      </button>

      <h1 className="page-title">Terms of Service</h1>
      <p className="page-text">
        By using Sublynk, you agree to the following terms and conditions.
        Please read carefully before using our services.
      </p>
      <h2 className="page-subtitle">Use of Service</h2>
      <p className="page-text">
        You may not misuse Sublynk for unlawful purposes, interfere with our
        platform, or violate intellectual property rights.
      </p>
      <h2 className="page-subtitle">Account Responsibility</h2>
      <p className="page-text">
        You are responsible for safeguarding your account and any activity under
        it. Notify us immediately if you suspect unauthorized access.
      </p>
    </section>
  );
};

export default Terms;
