import React, { useState } from "react";
import { Chessboard } from "react-chessboard";

export default function ProofPositions({ proofPositions, startFen }) {
  const [selectedProof, setSelectedProof] = useState(null);
  const [selectedFen, setSelectedFen] = useState("");

  const handleSelectProof = (proof) => {
    const fen = (proof?.fen || "").trim();
    setSelectedProof(proof);
    setSelectedFen(fen);
  };

  const openLichess = (fen) => {
    if (!fen) return;
    const url = `https://lichess.org/analysis/${encodeURIComponent(fen)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyFen = async (fen) => {
    if (!fen) return;
    try {
      await navigator.clipboard.writeText(fen);
    } catch {
      window.prompt("Copy FEN:", fen);
    }
  };

  return (
    <div className="proofs">
      <section className="panel">
        <h2>Proof Positions</h2>
        <p className="muted">These are the worst moves ranked by centipawn loss.</p>
        <div className="proof-grid">
          <div className="proof-list">
            {proofPositions.map((proof, index) => (
              <div
                key={`${proof.fen}-${index}`}
                className={`proof-card ${selectedProof === proof ? "active" : ""}`}
              >
                <div className="proof-meta">
                  <span>Move {proof.move_number}</span>
                  <span className={`label ${proof.label}`}>{proof.label}</span>
                </div>
                <div className="proof-body">
                  <strong>{proof.played_move}</strong>
                  <span>{proof.cpl} CPL</span>
                  <span>{proof.phase}</span>
                  <span>{proof.opening || "Unknown opening"}</span>
                </div>
                <div className="proof-actions">
                  <button className="ghost" onClick={() => handleSelectProof(proof)}>
                    View position
                  </button>
                  <button className="ghost" onClick={() => copyFen(proof.fen)}>
                    Copy FEN
                  </button>
                  <button className="ghost" onClick={() => openLichess(proof.fen)}>
                    Open in Lichess
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="proof-board">
            <div className="board-sticky">
              <h3>Position Viewer</h3>
              <Chessboard
                key={selectedFen || startFen}
                options={{
                  position: selectedFen || startFen,
                  allowDragging: false,
                  animationDurationInMs: 200,
                }}
              />
              {!selectedFen && (
                <p className="muted">Select a proof position to load the board.</p>
              )}
            </div>
            {selectedProof && (
              <div className="board-meta">
                <p>
                  Played move: <strong>{selectedProof.played_move}</strong>
                </p>
                <p>
                  Best move: <strong>{selectedProof.best_move || "n/a"}</strong>
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
