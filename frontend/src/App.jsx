import React, { useState } from "react";
import "./App.css";
import HomePanel from "./components/HomePanel";
import ProfileDashboard from "./components/ProfileDashboard";
import ProofPositions from "./components/ProofPositions";
import FeedbackPanel from "./components/FeedbackPanel";
import LiveAnalysis from "./components/LiveAnalysis";
import { START_FEN, PIE_COLORS } from "./constants";
import { formatNumber, formatPercent } from "./utils/formatters";

function App() {
  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState(null);
  const [activeView, setActiveView] = useState("home");

  const handleProfileBuilt = (data) => {
    setProfile(data);
    setActiveView("profile");
  };

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-text">
          <p className="eyebrow">Adaptive Chess Engine</p>
          <h1>Behavior Profile Builder</h1>
          <p className="subtitle">
            A guided workflow to fetch games, build a behavior model, and
            surface proof positions and feedback.
          </p>
          <div className="nav">
            <button
              className={`nav-button ${activeView === "home" ? "active" : ""}`}
              onClick={() => setActiveView("home")}
            >
              Home
            </button>
            <button
              className={`nav-button ${activeView === "profile" ? "active" : ""}`}
              onClick={() => setActiveView("profile")}
              disabled={!profile}
            >
              Profile
            </button>
            <button
              className={`nav-button ${activeView === "proofs" ? "active" : ""}`}
              onClick={() => setActiveView("proofs")}
              disabled={!profile}
            >
              Proof Positions
            </button>
            <button
              className={`nav-button ${activeView === "feedback" ? "active" : ""}`}
              onClick={() => setActiveView("feedback")}
              disabled={!profile}
            >
              Feedback
            </button>
            <button
              className={`nav-button ${activeView === "live" ? "active" : ""}`}
              onClick={() => setActiveView("live")}
            >
              Live Analysis
            </button>
          </div>
        </div>
        <div className="hero-panel">
          <div className="hero-card">
            <h3>Quick Start</h3>
            <ol>
              <li>Fetch games or upload PGN.</li>
              <li>Build the profile once.</li>
              <li>Review proofs and feedback.</li>
            </ol>
          </div>
          <div className="hero-chip">
            {profile ? "Profile ready" : "Awaiting profile"}
          </div>
        </div>
      </header>

      <main className="content">
        {activeView === "home" && (
          <HomePanel
            username={username}
            setUsername={setUsername}
            hasProfile={!!profile}
            onProfileBuilt={handleProfileBuilt}
            onViewProfile={() => setActiveView("profile")}
          />
        )}

        {activeView === "profile" && profile && (
          <ProfileDashboard
            profile={profile}
            pieColors={PIE_COLORS}
            formatNumber={formatNumber}
            formatPercent={formatPercent}
            onViewProofs={() => setActiveView("proofs")}
            onViewFeedback={() => setActiveView("feedback")}
          />
        )}

        {activeView === "proofs" && profile && (
          <ProofPositions
            proofPositions={profile.profile_proofs || []}
            startFen={START_FEN}
          />
        )}

        {activeView === "feedback" && profile && (
          <FeedbackPanel username={username} />
        )}

        {activeView === "live" && (
          <LiveAnalysis username={username} startFen={START_FEN} />
        )}
      </main>
    </div>
  );
}

export default App;
