import React, { useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import {
  analyzeMove,
  analyzeMoveDeep,
  explainMove,
  predictMove,
  listPgnGames,
  getPgnGameMoves,
} from "../api";
import DebugPanel from "./DebugPanel";

export default function LiveAnalysis({ username, startFen }) {
  const liveGameRef = useRef(new Chess());
  const [liveFen, setLiveFen] = useState(startFen);
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
  const [reviewFen, setReviewFen] = useState(startFen);
  const [reviewMoveIndex, setReviewMoveIndex] = useState(0);
  const [reviewResult, setReviewResult] = useState(null);

  const [deepStatus, setDeepStatus] = useState("");
  const [deepResult, setDeepResult] = useState(null);
  const [deepExplanation, setDeepExplanation] = useState("");
  const [deepContext, setDeepContext] = useState(null);

  const [debugLogs, setDebugLogs] = useState([]);

  const addDebug = (message) => {
    const time = new Date().toLocaleTimeString();
    setDebugLogs((prev) => [...prev, { time, message }].slice(-50));
  };

  const clearDebug = () => {
    setDebugLogs([]);
  };

  const resetDeep = () => {
    setDeepStatus("");
    setDeepResult(null);
    setDeepExplanation("");
    setDeepContext(null);
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
    resetDeep();
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
    setDeepContext({ fen: fenBefore, move: moveUci });
    setDeepResult(null);
    setDeepExplanation("");
    setDeepStatus("");
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
      resetDeep();
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
    resetDeep();
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
      resetDeep();
      setReviewStatus("");
      addDebug("Review: skipping opponent move.");
      return;
    }

    setDeepContext({ fen: fenBefore, move: moveUci });
    setDeepResult(null);
    setDeepExplanation("");
    setDeepStatus("");

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

  const handleDeepAnalysis = async (useAi) => {
    if (!deepContext) {
      setDeepStatus("Make a move to analyze.");
      return;
    }
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setDeepStatus("Enter a username to analyze moves.");
      return;
    }
    setDeepStatus(useAi ? "Requesting AI explanation..." : "Running deep analysis...");
    setDeepExplanation("");

    try {
      if (useAi) {
        const res = await explainMove({
          username: cleanUsername,
          fen: deepContext.fen,
          move: deepContext.move,
        });
        setDeepResult(res.data?.analysis || null);
        setDeepExplanation(res.data?.explanation || "");
        addDebug("Deep: AI explanation generated.");
      } else {
        const res = await analyzeMoveDeep({
          username: cleanUsername,
          fen: deepContext.fen,
          move: deepContext.move,
        });
        setDeepResult(res.data || null);
        addDebug("Deep: analysis complete.");
      }
      setDeepStatus("");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setDeepStatus(detail ? `Deep analysis failed: ${detail}` : "Deep analysis failed.");
      addDebug(`Deep: failed (${detail || "unknown error"}).`);
    }
  };

  return (
    <div className="live">
      <section className="panel live-panel">
        <div className="live-toggle">
          <button
            className={liveMode === "play" ? "primary" : "ghost"}
            onClick={() => { setLiveMode("play"); resetDeep(); }}
          >
            Play & Analyze
          </button>
          <button
            className={liveMode === "review" ? "primary" : "ghost"}
            onClick={() => { setLiveMode("review"); resetDeep(); }}
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
                <span className="muted">Username: {username.trim() || "not set"}</span>
              </div>
              <Chessboard
                options={{
                  position: liveFen || startFen,
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
                  <div className="deep-actions">
                    <button className="ghost" onClick={() => handleDeepAnalysis(false)}>
                      Deep analysis
                    </button>
                    <button className="primary" onClick={() => handleDeepAnalysis(true)}>
                      Explain this move (AI)
                    </button>
                  </div>
                  {deepStatus && <p className="status">{deepStatus}</p>}
                  {deepResult && (
                    <div className="deep-card">
                      <div className="deep-lines">
                        <p>
                          <strong>Best move:</strong> {deepResult.best_move || "n/a"}
                        </p>
                        <p>
                          <strong>Best line:</strong>{" "}
                          {(deepResult.best_line || []).join(" ") || "n/a"}
                        </p>
                        <p>
                          <strong>Played line:</strong>{" "}
                          {(deepResult.played_line || []).join(" ") || "n/a"}
                        </p>
                      </div>
                      <div className="deep-eval">
                        <span>Eval best: {deepResult.eval_best}</span>
                        <span>Eval played: {deepResult.eval_played}</span>
                        <span>Delta: {deepResult.eval_delta}</span>
                      </div>
                      {deepExplanation && <p className="deep-explain">{deepExplanation}</p>}
                    </div>
                  )}
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
                  position: reviewFen || startFen,
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
                  <div className="deep-actions">
                    <button className="ghost" onClick={() => handleDeepAnalysis(false)}>
                      Deep analysis
                    </button>
                    <button className="primary" onClick={() => handleDeepAnalysis(true)}>
                      Explain this move (AI)
                    </button>
                  </div>
                  {deepStatus && <p className="status">{deepStatus}</p>}
                  {deepResult && (
                    <div className="deep-card">
                      <div className="deep-lines">
                        <p>
                          <strong>Best move:</strong> {deepResult.best_move || "n/a"}
                        </p>
                        <p>
                          <strong>Best line:</strong>{" "}
                          {(deepResult.best_line || []).join(" ") || "n/a"}
                        </p>
                        <p>
                          <strong>Played line:</strong>{" "}
                          {(deepResult.played_line || []).join(" ") || "n/a"}
                        </p>
                      </div>
                      <div className="deep-eval">
                        <span>Eval best: {deepResult.eval_best}</span>
                        <span>Eval played: {deepResult.eval_played}</span>
                        <span>Delta: {deepResult.eval_delta}</span>
                      </div>
                      {deepExplanation && <p className="deep-explain">{deepExplanation}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <DebugPanel logs={debugLogs} onClear={clearDebug} />
      </section>
    </div>
  );
}
