import React, { useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

export default function UploadForm() {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("");

  const fetchChessComGames = async () => {
    if (!username) {
      alert("Enter Chess.com username");
      return;
    }

    setStatus("Fetching games from Chess.com...");

    try {
      const res = await axios.post(`${API_BASE}/games/fetch/chesscom`, {
        username: username.trim(),
      });

      setStatus(
        `Fetched ${res.data.gamesImported} games successfully`
      );
    } catch (err) {
      console.error(err);
      const detail = err?.response?.data?.detail;
      setStatus(detail ? `Failed to fetch games: ${detail}` : "Failed to fetch games");
    }
  };

  return (
    <div className="card">
      <h3>♟️ Import Games</h3>

      {/* Existing upload still works */}
      <input type="file" accept=".pgn" />

      <hr />

      <h4>Fetch from Chess.com</h4>
      <input
        type="text"
        placeholder="Chess.com username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <br />
      <button onClick={fetchChessComGames}>
        Fetch Games
      </button>

      {status && <p>{status}</p>}
    </div>
  );
}
