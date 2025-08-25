// client/src/pages/Home.jsx

// client/src/pages/Home.jsx
// client/src/pages/Home.jsx
// client/src/pages/Home.jsx
import React from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import heroImage from "../assets/Sublynk-logo (2).png";
import "../styles/Home.css";
import youtubeIcon from "../assets/youtube.svg";
import netflixIcon from "../assets/netflix.svg";
import vlcIcon from "../assets/vlcmediaplayer.svg";
import kodiIcon from "../assets/kodi.svg";
import { useAuth } from "../context/AuthContext";

function Home() {
  const { isAuthed, user } = useAuth();

  return (
    <>
      {/* Global site header (contains auth-aware nav) */}
      <Header />

      {/* 🧲 Marquee */}
      <div className="marquee-wrapper">
        <div className="marquee">
          <p>
            🎬 Fast subtitle downloads&nbsp;&nbsp;•&nbsp;&nbsp;🌍 Multi-language
            support&nbsp;&nbsp;•&nbsp;&nbsp;🔐 Sync and track subtitle
            history&nbsp;&nbsp;•&nbsp;&nbsp;⚡ Instant
            updates&nbsp;&nbsp;•&nbsp;&nbsp;💬 Subtitle previews
          </p>
          <p aria-hidden="true">
            🎬 Fast subtitle downloads&nbsp;&nbsp;•&nbsp;&nbsp;🌍 Multi-language
            support&nbsp;&nbsp;•&nbsp;&nbsp;🔐 Sync and track subtitle
            history&nbsp;&nbsp;•&nbsp;&nbsp;⚡ Instant
            updates&nbsp;&nbsp;•&nbsp;&nbsp;💬 Subtitle previews
          </p>
        </div>
      </div>

      <main className="home">
        {/* 🚀 Hero Section */}
        <section className="home__hero">
          <div className="home__text">
            <h1 className="home__title">
              Subtitle Smarter with <span>Sublynk</span>
            </h1>
            <p className="home__description">
              Instantly fetch, manage, and sync subtitles for your favorite
              movies, YouTube videos, and more.
            </p>

            {/* Optional small greeting when logged in */}
            {isAuthed && (
              <p className="home__greeting">
                Hi {user?.name || user?.email}! Ready to find subtitles?
              </p>
            )}

            <ul className="home__features">
              <li>🎬 Fast subtitle downloads</li>
              <li>🌍 Multi-language support</li>
              <li>🔐 Account & subtitle history</li>
            </ul>
            <div className="home__buttons">
              {isAuthed ? (
                <Link to="/dashboard" className="home__btn home__btn--primary">
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/signup" className="home__btn home__btn--primary">
                    Get Started Free
                  </Link>
                  <Link to="/login" className="home__btn home__btn--secondary">
                    Already a member?
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="home__image">
            <img src={heroImage} alt="Sublynk Illustration" />
          </div>
        </section>

        {/* 📊 Statistics */}
        <section className="home__stats">
          <div className="stat">
            <h3>5,000+</h3>
            <p>Subtitles Fetched Daily</p>
          </div>
          <div className="stat">
            <h3>80+</h3>
            <p>Languages Supported</p>
          </div>
          <div className="stat">
            <h3>100%</h3>
            <p>Free for Individuals</p>
          </div>
        </section>

        {/* 💡 Feature Cards */}
        <section className="home__features-section">
          <div className="feature-card">
            <h3>Fast Downloads</h3>
            <p>Download subtitles in seconds with accurate timing.</p>
          </div>
          <div className="feature-card">
            <h3>Multi-language Support</h3>
            <p>Over 80 languages supported for international users.</p>
          </div>
          <div className="feature-card">
            <h3>Subtitle History</h3>
            <p>Track and re-download past subtitle files easily.</p>
          </div>
        </section>

        {/* 📦 Use Cases */}
        <section className="home__use-cases">
          <h2>Perfect For</h2>
          <ul className="use-case-list">
            <li>🎓 Students & Researchers</li>
            <li>🎥 Film Buffs & Movie Collectors</li>
            <li>📺 YouTube Creators & Influencers</li>
            <li>🌐 Language Learners & Translators</li>
          </ul>
        </section>

        {/* 💻 Supported Platforms */}
        <section className="home__platforms">
          <h2>Works With</h2>
          <div className="platform-logos">
            <div className="platform-logo">
              <img src={youtubeIcon} alt="YouTube" />
              <p>YouTube</p>
            </div>
            <div className="platform-logo">
              <img src={netflixIcon} alt="Netflix" />
              <p>Netflix</p>
            </div>
            <div className="platform-logo">
              <img src={vlcIcon} alt="VLC Player" />
              <p>VLC</p>
            </div>
            <div className="platform-logo">
              <img src={kodiIcon} alt="Kodi" />
              <p>Kodi</p>
            </div>
          </div>
        </section>

        {/* 💬 Testimonials */}
        <section className="home__testimonials">
          <h2>What Our Users Say</h2>
          <div className="testimonial">
            <p>
              "Sublynk has made subtitle fetching effortless. The interface is
              clean and fast!"
            </p>
            <p>- Sarah J., Film Buff</p>
          </div>
          <div className="testimonial">
            <p>
              "I love how it supports Yoruba and Igbo subtitles. Game changer
              for Nollywood fans!"
            </p>
            <p>- Daniel A., Educator</p>
          </div>
        </section>

        {/* 🧭 Final CTA */}
        <section className="home__final-cta">
          <h2>Ready to Get Subtitles Instantly?</h2>
          <p>Join thousands of users already subtitle smarter with Sublynk.</p>
          {isAuthed ? (
            <Link to="/dashboard" className="home__btn home__btn--primary">
              Open Dashboard
            </Link>
          ) : (
            <Link to="/signup" className="home__btn home__btn--primary">
              Start Now – It’s Free
            </Link>
          )}
        </section>
      </main>

      <Footer />
    </>
  );
}

export default Home;
