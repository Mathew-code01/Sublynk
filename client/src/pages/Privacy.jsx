

// client/src/pages/Privacy.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import "../styles/Page.css";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <section className="page">
      {/* Back button */}
      <button className="back-button" onClick={() => navigate(-1)}>
        <FiArrowLeft /> Back
      </button>

      <h1 className="page-title">Privacy Policy</h1>
      <p className="page-text">
        Your privacy is important to us. This Privacy Policy explains how
        Sublynk collects, uses, and protects your information when you use our
        platform.
      </p>
      <h2 className="page-subtitle">Information We Collect</h2>
      <p className="page-text">
        We may collect personal details like your name, email address, and usage
        data when you interact with our services.
      </p>
      <h2 className="page-subtitle">How We Use Your Data</h2>
      <p className="page-text">
        Your information helps us improve Sublynk, provide customer support, and
        keep our services secure.
      </p>
    </section>
  );
};

export default Privacy;
