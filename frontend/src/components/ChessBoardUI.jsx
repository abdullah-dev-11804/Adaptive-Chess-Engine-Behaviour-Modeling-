import React, { useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { predictMove } from "../api";
import Swal from "sweetalert2";

export default function ChessBoardUI() {
  const chessGameRef = useRef(new Chess());
  const chessGame = chessGameRef.current;

  const [chessPosition, setChessPosition] = useState(chessGame.fen());
  const [moveFrom, setMoveFrom] = useState("");
  const [optionSquares, setOptionSquares] = useState({});

  // make a random AI move (we’ll replace this with backend later)
  async function makeAIMove() {
    try {
      const res = await predictMove(chessGame.fen());
      const aiMove = res.data.move;
      if (aiMove) {
        chessGame.move(aiMove);
        setChessPosition(chessGame.fen());
      }
    } catch (err) {
      console.error("AI move error:", err);
    }
  }

  // handle piece drop (drag-drop)
  function onPieceDrop({ sourceSquare, targetSquare }) {
    if (!targetSquare) return false;
    try {
      chessGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
      setChessPosition(chessGame.fen());
      setMoveFrom("");
      setOptionSquares({});
      setTimeout(makeAIMove, 500);
      return true;
    } catch {
      return false;
    }
  }

  // handle click-click movement
  function onSquareClick({ square, piece }) {
    if (!moveFrom && piece) {
      // select piece
      const moves = chessGame.moves({ square, verbose: true });
      if (moves.length === 0) return;
      const highlight = {};
      for (const m of moves) {
        highlight[m.to] = {
          background:
            chessGame.get(m.to) &&
            chessGame.get(m.to).color !== chessGame.get(square).color
              ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
              : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
          borderRadius: "50%",
        };
      }
      highlight[square] = { background: "rgba(255,255,0,0.4)" };
      setOptionSquares(highlight);
      setMoveFrom(square);
      return;
    }

    // try to move
    const moves = chessGame.moves({ square: moveFrom, verbose: true });
    const found = moves.find((m) => m.from === moveFrom && m.to === square);
    if (!found) {
      setMoveFrom("");
      setOptionSquares({});
      return;
    }

    try {
      chessGame.move({ from: moveFrom, to: square, promotion: "q" });
      setChessPosition(chessGame.fen());
      setMoveFrom("");
      setOptionSquares({});
      setTimeout(makeAIMove, 500);
    } catch {
      setMoveFrom("");
      setOptionSquares({});
    }
  }

  // Board options object (v5+ API)
  const chessboardOptions = {
    id: "adaptive-board",
    position: chessPosition,
    onPieceDrop,
    onSquareClick,
    squareStyles: optionSquares,
    showNotation: true,
  };

    if (chessGame.isGameOver()) {
        if (chessGame.isCheckmate()) {
            const winner = chessGame.turn() === "w" ? "Black" : "White";
            Swal.fire({
            icon: "success",
            title: `${winner} wins!`,
            text: "Checkmate!",
            timer: 2500,
            showConfirmButton: false,
            });
        } else if (chessGame.isDraw()) {
            Swal.fire({
            icon: "info",
            title: "Game Drawn",
            text: "It's a stalemate!",
            timer: 2000,
            showConfirmButton: false,
            });
        }
    }

  return (
    <div className="card">
      <h3>♟️ Play Against Your AI Twin</h3>
      <Chessboard options={chessboardOptions} />
    </div>
  );
}
