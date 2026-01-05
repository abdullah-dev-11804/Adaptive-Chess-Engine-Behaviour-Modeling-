import React, { useState } from "react";
import { getFeedback } from "../api";

export default function FeedbackPanel({ username }) {
  const [feedback, setFeedback] = useState(null);
  const [status, setStatus] = useState("");

  const handleLoadFeedback = async () => {
    if (!username.trim()) {
      setStatus("Enter a username to load feedback.");
      return;
    }
    setStatus("Loading feedback...");
    try {
      const res = await getFeedback(username.trim());
      setFeedback(res.data);
      setStatus("");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setFeedback({
        username,
        feedback: [
          {
            move_number: "-",
            played_move: "-",
            label: "error",
            feedback: detail || "Failed to load feedback.",
          },
        ],
      });
      setStatus("");
    }
  };

  return (
    <div className="feedback">
      <section className="panel">
        <h2>Feedback</h2>
        <p className="muted">Personalized explanations tied to your proof positions.</p>
        {!feedback && (
          <button className="primary" onClick={handleLoadFeedback}>
            Load feedback
          </button>
        )}
        {status && <p className="status">{status}</p>}
        {feedback?.feedback && (
          <div className="feedback-list">
            {feedback.feedback.map((item, index) => (
              <div key={`${item.move_number}-${index}`} className="feedback-card">
                <div className="feedback-head">
                  <span>Move {item.move_number}</span>
                  <span className={`label ${item.label}`}>{item.label}</span>
                  <span>{item.played_move}</span>
                </div>
                <p>{item.feedback}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
