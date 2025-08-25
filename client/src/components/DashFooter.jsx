// client/src/components/DashFooter.jsx

// client/src/components/DashFooter.jsx
// client/src/components/DashFooter.jsx

import React from "react";
import "../styles/DashFooter.css";
import { FiArrowUpRight } from "react-icons/fi";

const DashFooter = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="dash-footer">
      <p>© {new Date().getFullYear()} Sublynk. All rights reserved.</p>

      <div className="footer-links">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/contact">Contact</a>
        <button onClick={scrollToTop} className="footer-scroll-top">
          Back to Top <FiArrowUpRight />
        </button>
      </div>

      <p className="footer-credit">
        Made with <span className="heart">❤️</span> by the Sublynk Team
      </p>
    </footer>
  );
};

export default DashFooter;
