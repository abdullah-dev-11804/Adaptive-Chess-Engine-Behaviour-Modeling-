import React, { useMemo, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import {
  fetchChessComGames,
  uploadPGN,
  getProfile,
  getFeedback,
  analyzeMove,
  predictMove,
  listPgnGames,
  getPgnGameMoves,
} from "./api";
import "./App.css";

const PIE_COLORS = ["#c4552d", "#2f5d62", "#d1a054", "#6d6875", "#355070"];
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function formatPercent(value) {
  if (typeof value !== "number") return "0.0%";
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value) {
  if (value === null || value === undefined) return "0";
  return Number(value).toFixed(2);
}

function App() {
  const [username, setUsername] = useState("");
  const [platform, setPlatform] = useState("chess.com");
  const [fetchStatus, setFetchStatus] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [profile, setProfile] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [activeView, setActiveView] = useState("home");
  const [selectedProof, setSelectedProof] = useState(null);
  const [selectedFen, setSelectedFen] = useState("");
  const liveGameRef = useRef(new Chess());
  const [liveFen, setLiveFen] = useState(START_FEN);
  const [liveStatus, setLiveStatus] = useState("");
  const [liveResult, setLiveResult] = useState(null);
  const [liveMode, setLiveMode] = useState("play");
  const [reviewGames, setReviewGames] = useState([]);
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewGameIndex, setReviewGameIndex] = useState(null);
  const [reviewMoves, setReviewMoves] = useState([]);
  const [reviewHeaders, setReviewHeaders] = useState(null);
  const [reviewUserColor, setReviewUserColor] = useState(null);
  const reviewGameRef = useRef(new Chess());
  const [reviewFen, setReviewFen] = useState(START_FEN);
  const [reviewMoveIndex, setReviewMoveIndex] = useState(0);
  const [reviewResult, setReviewResult] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);

  const proofPositions = profile?.profile_proofs || [];

  const phaseData = useMemo(() => {
    if (!profile?.phase_breakdown) return [];
    return [
      {
        name: "Opening",
        value: profile.phase_breakdown.opening_avg_cpl || 0,
      },
      {
        name: "Middlegame",
        value: profile.phase_breakdown.middlegame_avg_cpl || 0,
      },
      {
        name: "Endgame",
        value: profile.phase_breakdown.endgame_avg_cpl || 0,
      },
    ];
  }, [profile]);

  const mistakeData = useMemo(() => {
    if (!profile) return [];
    return [
      { name: "Inaccuracy", value: profile.inaccuracy_rate || 0 },
      { name: "Mistake", value: profile.mistake_rate || 0 },
      { name: "Blunder", value: profile.blunder_rate || 0 },
    ];
  }, [profile]);

  const openingData = useMemo(() => {
    if (!profile?.opening_preferences) return [];
    return profile.opening_preferences.map((name, index) => ({
      name,
      value: 5 - index,
    }));
  }, [profile]);

  const handleFetchGames = async () => {
    if (!username.trim()) {
      setFetchStatus("Enter a username first.");
      return;
    }

    if (platform !== "chess.com") {
      setFetchStatus("Only Chess.com is supported right now.");
      return;
    }

    setFetchStatus("Fetching archives...");
    try {
      const res = await fetchChessComGames(username.trim());
      const filePath = res.data?.file || "uploads file";
      setFetchStatus(
        `Downloaded ${res.data?.gamesImported || 0} games. Saved to ${filePath}.`
      );
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setFetchStatus(detail ? `Fetch failed: ${detail}` : "Fetch failed.");
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadStatus("Uploading PGN...");
    try {
      await uploadPGN(file);
      setUploadStatus(`Uploaded ${file.name}. You can now build a profile.`);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setUploadStatus(detail ? `Upload failed: ${detail}` : "Upload failed.");
    }
  };

  const handleBuildProfile = async () => {
    if (!username.trim()) {
      setProfileStatus("Enter a username first.");
      return;
    }
    setProfileStatus("Building profile. This can take a few minutes...");
    try {
      const res = await getProfile(username.trim());
      setProfile(res.data);
      setProfileStatus("Profile generated.");
      setActiveView("profile");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setProfileStatus(detail ? `Profile failed: ${detail}` : "Profile failed.");
    }
  };

  const handleLoadFeedback = async () => {
    if (!username.trim()) {
      return;
    }
    try {
      const res = await getFeedback(username.trim());
      setFeedback(res.data);
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
    }
  };

  const openLichess = (fen) => {
    if (!fen) return;
    const url = `https://lichess.org/analysis/${encodeURIComponent(fen)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSelectProof = (proof) => {
    const fen = (proof?.fen || "").trim();
    setSelectedProof(proof);
    setSelectedFen(fen);
  };

  const copyFen = async (fen) => {
    if (!fen) return;
    try {
      await navigator.clipboard.writeText(fen);
    } catch {
      window.prompt("Copy FEN:", fen);
    }
  };

  const addDebug = (message) => {
    const time = new Date().toLocaleTimeString();
    setDebugLogs((prev) => [...prev, { time, message }].slice(-50));
  };

  const clearDebug = () => {
    setDebugLogs([]);
  };

  const uciToMove = (uci) => {
    const move = {
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
    };
    if (uci.length > 4) {
      move.promotion = uci[4];
    }
    return move;
  };

  const handleLiveReset = () => {
    const game = liveGameRef.current;
    game.reset();
    setLiveFen(game.fen());
    setLiveStatus("");
    setLiveResult(null);
    addDebug("Live: board reset.");
  };

  const handleLiveMove = ({ sourceSquare, targetSquare }) => {
    if (!targetSquare) return false;
    const game = liveGameRef.current;
    const fenBefore = game.fen();
    const move = game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q",
    });
    if (!move) {
      addDebug("Live: illegal move.");
      return false;
    }
    addDebug(`Live: user move ${move.from}${move.to}${move.promotion || ""}.`);
    setLiveFen(game.fen());
    setLiveResult(null);

    const moveUci = `${move.from}${move.to}${move.promotion || ""}`;
    const cleanUsername = username.trim();
    const processLiveMove = async () => {
      let analysisFailed = false;
      if (cleanUsername) {
        setLiveStatus("Analyzing move...");
        try {
          const res = await analyzeMove({
            username: cleanUsername,
            fen: fenBefore,
            move: moveUci,
          });
          setLiveResult(res.data);
          setLiveStatus("");
          addDebug(`Live: analysis ${res.data?.label || "ok"} (${res.data?.cpl} CPL).`);
        } catch (err) {
          const detail = err?.response?.data?.detail;
          setLiveStatus(detail ? `Analysis failed: ${detail}` : "Analysis failed.");
          analysisFailed = true;
          addDebug(`Live: analysis failed (${detail || "unknown error"}).`);
        }
      } else {
        setLiveStatus("Enter a username to analyze moves.");
        addDebug("Live: username missing for analysis.");
      }

      try {
        const engineRes = await predictMove(game.fen());
        const aiMove = engineRes.data?.move;
        if (aiMove) {
          let applied = game.move(aiMove);
          if (!applied && (aiMove.length === 4 || aiMove.length === 5)) {
            applied = game.move(uciToMove(aiMove));
          }
          if (applied) {
            setLiveFen(game.fen());
            addDebug(`Live: engine reply ${aiMove}.`);
          }
        }
      } catch {
        if (!analysisFailed && cleanUsername) {
          setLiveStatus("Engine reply failed.");
        }
        addDebug("Live: engine reply failed.");
      }
    };

    void processLiveMove();

    return true;
  };

  const handleLoadGames = async () => {
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setReviewStatus("Enter a username to load games.");
      addDebug("Review: username missing for games list.");
      return;
    }
    setReviewStatus("Loading games...");
    try {
      const res = await listPgnGames(cleanUsername, 20);
      setReviewGames(res.data?.games || []);
      setReviewStatus("");
      addDebug(`Review: loaded ${res.data?.games?.length || 0} games.`);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setReviewStatus(detail ? `Failed to load games: ${detail}` : "Failed to load games.");
      addDebug(`Review: load games failed (${detail || "unknown error"}).`);
    }
  };

  const handleSelectGame = async (index) => {
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setReviewStatus("Enter a username to load games.");
      addDebug("Review: username missing for game select.");
      return;
    }
    if (Number.isNaN(index)) {
      return;
    }
    setReviewStatus("Loading game...");
    try {
      const res = await getPgnGameMoves(cleanUsername, index);
      setReviewMoves(res.data?.moves || []);
      setReviewHeaders(res.data?.headers || null);
      setReviewUserColor(res.data?.user_color || null);
      setReviewGameIndex(index);
      const game = reviewGameRef.current;
      game.reset();
      setReviewFen(game.fen());
      setReviewMoveIndex(0);
      setReviewResult(null);
      setReviewStatus("");
      addDebug(`Review: loaded game ${index + 1} with ${res.data?.moves?.length || 0} moves.`);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setReviewStatus(detail ? `Failed to load game: ${detail}` : "Failed to load game.");
      addDebug(`Review: load game failed (${detail || "unknown error"}).`);
    }
  };

  const handleReviewPrev = () => {
    if (reviewMoveIndex <= 0) return;
    const game = reviewGameRef.current;
    game.undo();
    setReviewMoveIndex(reviewMoveIndex - 1);
    setReviewFen(game.fen());
    setReviewResult(null);
    setReviewStatus("");
    addDebug("Review: step back one move.");
  };

  const handleReviewNext = async () => {
    if (!reviewMoves.length) {
      setReviewStatus("Select a game to begin.");
      addDebug("Review: no game selected.");
      return;
    }
    if (reviewMoveIndex >= reviewMoves.length) return;

    const game = reviewGameRef.current;
    const moveUci = reviewMoves[reviewMoveIndex];
    const fenBefore = game.fen();
    const applied = game.move(uciToMove(moveUci));
    if (!applied) {
      setReviewStatus("Failed to apply move from PGN.");
      addDebug(`Review: failed to apply move ${moveUci}.`);
      return;
    }
    setReviewMoveIndex(reviewMoveIndex + 1);
    setReviewFen(game.fen());
    addDebug(`Review: applied move ${moveUci}.`);

    const shouldAnalyze = reviewUserColor
      ? (reviewUserColor === "white" ? reviewMoveIndex % 2 === 0 : reviewMoveIndex % 2 === 1)
      : true;

    if (!shouldAnalyze) {
      setReviewResult(null);
      setReviewStatus("");
      addDebug("Review: skipping opponent move.");
      return;
    }

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setReviewStatus("Enter a username to analyze moves.");
      setReviewResult(null);
      addDebug("Review: username missing for analysis.");
      return;
    }

    setReviewStatus("Analyzing move...");
    try {
      const res = await analyzeMove({
        username: cleanUsername,
        fen: fenBefore,
        move: moveUci,
      });
      setReviewResult(res.data);
      setReviewStatus("");
      addDebug(`Review: analysis ${res.data?.label || "ok"} (${res.data?.cpl} CPL).`);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setReviewStatus(detail ? `Analysis failed: ${detail}` : "Analysis failed.");
      addDebug(`Review: analysis failed (${detail || "unknown error"}).`);
    }
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
              onClick={() => {
                setActiveView("feedback");
                if (!feedback) {
                  handleLoadFeedback();
                }
              }}
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
          <div className="grid">
            <section className="panel">
              <h2>1) Landing</h2>
              <div className="field-row">
                <label>Username</label>
                <input
                  type="text"
                  placeholder="talhahahaa"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="field-row">
                <label>Platform</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  <option value="chess.com">Chess.com</option>
                  <option value="lichess" disabled>
                    Lichess (coming soon)
                  </option>
                </select>
              </div>
              <button className="primary" onClick={handleFetchGames}>
                Fetch games
              </button>
              {fetchStatus && <p className="status">{fetchStatus}</p>}
            </section>

            <section className="panel">
              <h2>Upload PGN Instead</h2>
              <p className="muted">
                If you already have a PGN file, upload it and skip fetch.
              </p>
              <input type="file" accept=".pgn" onChange={handleUpload} />
              {uploadStatus && <p className="status">{uploadStatus}</p>}
            </section>

            <section className="panel">
              <h2>2) Build Profile</h2>
              <p className="muted">
                Builds the profile or returns the cached JSON if it already
                exists.
              </p>
              <button className="primary" onClick={handleBuildProfile}>
                Build behavior profile
              </button>
              {profileStatus && <p className="status">{profileStatus}</p>}
              {profile && (
                <button className="ghost" onClick={() => setActiveView("profile")}>
                  View profile dashboard
                </button>
              )}
            </section>
          </div>
        )}

        {activeView === "profile" && profile && (
          <div className="dashboard">
            <section className="panel overview">
              <h2>Overview</h2>
              <div className="card-row">
                <div className="stat-card">
                  <span>Games analyzed</span>
                  <strong>{profile.games_analyzed}</strong>
                </div>
                <div className="stat-card">
                  <span>Average CPL</span>
                  <strong>{formatNumber(profile.avg_cpl)}</strong>
                </div>
                <div className="stat-card">
                  <span>Blunder rate</span>
                  <strong>{formatPercent(profile.blunder_rate)}</strong>
                </div>
                <div className="stat-card">
                  <span>Weak phase</span>
                  <strong>{profile.weak_phase}</strong>
                </div>
              </div>
            </section>

            <section className="panel charts">
              <div className="chart-card">
                <h3>Phase CPL</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={phaseData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2f5d62" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-card">
                <h3>Error Rates</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={mistakeData}>
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                    <Tooltip formatter={(v) => formatPercent(v)} />
                    <Bar dataKey="value" fill="#c4552d" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-card">
                <h3>Top Openings</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={openingData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                      {openingData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="opening-list">
                  {profile.opening_preferences.map((opening) => (
                    <span key={opening} className="chip">
                      {opening}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            <section className="panel style-panel">
              <h2>Style Summary</h2>
              <div className="chip-row">
                <span className={`chip ${profile.style?.early_queen ? "chip-on" : "chip-off"}`}>
                  Early queen
                </span>
                <span className={`chip ${profile.style?.late_castling ? "chip-on" : "chip-off"}`}>
                  Late castling
                </span>
                <span className={`chip ${profile.style?.aggressive ? "chip-on" : "chip-off"}`}>
                  Aggressive
                </span>
              </div>
            </section>

            <section className="panel actions">
              <h2>Next</h2>
              <div className="button-row">
                <button className="primary" onClick={() => setActiveView("proofs")}>
                  See proof positions
                </button>
                <button className="ghost" onClick={() => {
                  setActiveView("feedback");
                  if (!feedback) {
                    handleLoadFeedback();
                  }
                }}>
                  See feedback
                </button>
              </div>
            </section>
          </div>
        )}

        {activeView === "proofs" && profile && (
          <div className="proofs">
            <section className="panel">
              <h2>Proof Positions</h2>
              <p className="muted">
                These are the worst moves ranked by centipawn loss.
              </p>
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
                      key={selectedFen || "start"}
                      options={{
                        position: selectedFen || START_FEN,
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
        )}

        {activeView === "live" && (
          <div className="live">
            <section className="panel live-panel">
              <div className="live-toggle">
                <button
                  className={liveMode === "play" ? "primary" : "ghost"}
                  onClick={() => setLiveMode("play")}
                >
                  Play & Analyze
                </button>
                <button
                  className={liveMode === "review" ? "primary" : "ghost"}
                  onClick={() => setLiveMode("review")}
                >
                  Review past game
                </button>
              </div>

              {liveMode === "play" && (
                <div className="live-grid">
                  <div className="live-board">
                    <h2>Live Move Analysis</h2>
                    <p className="muted">
                      Play a move and get instant feedback without storing anything.
                    </p>
                    <div className="live-controls">
                      <button className="ghost" onClick={handleLiveReset}>
                        Reset board
                      </button>
                      <span className="muted">
                        Username: {username.trim() || "not set"}
                      </span>
                    </div>
                    <Chessboard
                      options={{
                        position: liveFen || START_FEN,
                        onPieceDrop: handleLiveMove,
                        allowDragging: true,
                        animationDurationInMs: 200,
                      }}
                    />
                  </div>
                  <div className="live-result">
                    <h3>Move Feedback</h3>
                    {liveStatus && <p className="status">{liveStatus}</p>}
                    {!liveStatus && !liveResult && (
                      <p className="muted">Make a move to analyze it.</p>
                    )}
                    {liveResult && (
                      <div className="live-card">
                        <div className="feedback-head">
                          <span className={`label ${liveResult.label}`}>{liveResult.label}</span>
                          <span>{liveResult.cpl} CPL</span>
                          <span>{liveResult.phase}</span>
                        </div>
                        <p className="muted">
                          {liveResult.matches_profile_weakness
                            ? "Matches your known weak phase."
                            : "Not a typical weakness based on your profile."}
                        </p>
                        <div className="suggested-list">
                          <h4>Suggested good moves</h4>
                          <div className="chip-row">
                            {(liveResult.suggested_good_moves || []).length > 0 ? (
                              liveResult.suggested_good_moves.map((move) => (
                                <span key={move} className="chip">
                                  {move}
                                </span>
                              ))
                            ) : (
                              <span className="muted">No suggestions available.</span>
                            )}
                          </div>
                        </div>
                        {liveResult.feedback && <p>{liveResult.feedback}</p>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {liveMode === "review" && (
                <div className="review-grid">
                  <div className="review-board">
                    <h2>Review Past Game</h2>
                    <p className="muted">
                      Select a game, then step through moves to analyze them.
                    </p>
                    <div className="review-controls">
                      <button className="ghost" onClick={handleLoadGames}>
                        Load games
                      </button>
                      <select
                        value={reviewGameIndex ?? ""}
                        onChange={(e) => handleSelectGame(Number(e.target.value))}
                      >
                        <option value="" disabled>
                          Select a game
                        </option>
                        {reviewGames.map((game) => (
                          <option key={game.index} value={game.index}>
                            #{game.index + 1} {game.white} vs {game.black} {game.result}
                          </option>
                        ))}
                      </select>
                      <button
                        className="ghost"
                        onClick={handleReviewPrev}
                        disabled={reviewMoveIndex === 0}
                      >
                        Prev
                      </button>
                      <button
                        className="ghost"
                        onClick={handleReviewNext}
                        disabled={reviewMoveIndex >= reviewMoves.length}
                      >
                        Next
                      </button>
                    </div>
                    {reviewHeaders && (
                      <div className="review-meta">
                        <span>{reviewHeaders.white} vs {reviewHeaders.black}</span>
                        <span>{reviewHeaders.result}</span>
                        <span>{reviewHeaders.opening || reviewHeaders.eco || "Opening unknown"}</span>
                      </div>
                    )}
                    {reviewUserColor === null && reviewMoves.length > 0 && (
                      <p className="muted">
                        Username not found in this game; analyzing all moves.
                      </p>
                    )}
                    {reviewStatus && <p className="status">{reviewStatus}</p>}
                    <Chessboard
                      key={reviewFen}
                      options={{
                        position: reviewFen || START_FEN,
                        allowDragging: false,
                        animationDurationInMs: 200,
                      }}
                    />
                    <div className="review-progress">
                      Move {reviewMoveIndex} / {reviewMoves.length}
                    </div>
                  </div>
                  <div className="review-result">
                    <h3>Move Feedback</h3>
                    {!reviewResult && !reviewStatus && (
                      <p className="muted">Step through the game to see feedback.</p>
                    )}
                    {reviewResult && (
                      <div className="live-card">
                        <div className="feedback-head">
                          <span className={`label ${reviewResult.label}`}>{reviewResult.label}</span>
                          <span>{reviewResult.cpl} CPL</span>
                          <span>{reviewResult.phase}</span>
                        </div>
                        <p className="muted">
                          {reviewResult.matches_profile_weakness
                            ? "Matches your known weak phase."
                            : "Not a typical weakness based on your profile."}
                        </p>
                        <div className="suggested-list">
                          <h4>Suggested good moves</h4>
                          <div className="chip-row">
                            {(reviewResult.suggested_good_moves || []).length > 0 ? (
                              reviewResult.suggested_good_moves.map((move) => (
                                <span key={move} className="chip">
                                  {move}
                                </span>
                              ))
                            ) : (
                              <span className="muted">No suggestions available.</span>
                            )}
                          </div>
                        </div>
                        {reviewResult.feedback && <p>{reviewResult.feedback}</p>}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="debug-panel">
                <div className="debug-header">
                  <h3>Debug Log</h3>
                  <button className="ghost" onClick={clearDebug}>
                    Clear
                  </button>
                </div>
                {debugLogs.length === 0 ? (
                  <p className="muted">No debug entries yet.</p>
                ) : (
                  <div className="debug-list">
                    {debugLogs.map((entry, index) => (
                      <div key={`${entry.time}-${index}`} className="debug-row">
                        <span>{entry.time}</span>
                        <span>{entry.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeView === "feedback" && profile && (
          <div className="feedback">
            <section className="panel">
              <h2>Feedback</h2>
              <p className="muted">
                Personalized explanations tied to your proof positions.
              </p>
              {!feedback && (
                <button className="primary" onClick={handleLoadFeedback}>
                  Load feedback
                </button>
              )}
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
        )}
      </main>
    </div>
  );
}

export default App;
