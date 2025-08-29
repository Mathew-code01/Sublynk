// client/src/pages/Contact.jsx
// client/src/pages/Contact.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { toast } from "react-toastify";
import "../styles/Page.css";

const Contact = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;

    const data = {
      name: form[0].value,
      email: form[1].value,
      message: form[2].value,
    };

    setLoading(true); // start loading

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();
      if (result.success) {
        toast.success("✅ Message sent successfully!");
        form.reset();
      } else {
        toast.error("❌ Failed to send message.");
      }
    } catch (err) {
      toast.error("⚠️ Server error. Try again later.");
    } finally {
      setLoading(false); // stop loading
    }
  };

  return (
    <section className="page">
      <button className="back-button" onClick={() => navigate(-1)}>
        <FiArrowLeft /> Back
      </button>

      <h1 className="page-title">Contact Us</h1>
      <p className="page-text">
        Have questions or need support? Reach out to us anytime.
      </p>

      <div className="contact-info">
        <p>
          Email:{" "}
          <a href="mailto:Mathewoloyede100@gmail.com">support@sublynk.com</a>
        </p>
        <p>Phone: +234 (906) 569-2168</p>
        <p>Location: Lagos, Nigeria</p>
      </div>

      <form className="contact-form" onSubmit={handleSubmit}>
        <input type="text" placeholder="Your Name" required />
        <input type="email" placeholder="Your Email" required />
        <textarea placeholder="Your Message" rows="4" required></textarea>

        <button type="submit" disabled={loading}>
          {loading ? (
            <>
              Sending...
              <span className="spinner"></span>
            </>
          ) : (
            "Send Message"
          )}
        </button>
      </form>
    </section>
  );
};

export default Contact;
