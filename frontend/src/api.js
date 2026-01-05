import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

export const uploadPGN = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return await axios.post(`${API_BASE}/games/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const trainModel = async (userId) => {
  const formData = new FormData();
  formData.append("user_id", userId);
  return await axios.post(`${API_BASE}/model/train`, formData);
};

export const predictMove = async (fen) => {
  return await axios.post(`${API_BASE}/model/predict`, { fen });
};

export const analyzeAndStore = async () => {
  return await axios.post(`${API_BASE}/analysis/analyze_and_store`);
};

export const listAnalyses = async () => {
  return await axios.get(`${API_BASE}/analysis/analyses`);
};

export const fetchChessComGames = async (username) => {
  return await axios.post(`${API_BASE}/games/fetch/chesscom`, {
    username: username.trim(),
  });
};

export const getProfile = async (username) => {
  return await axios.get(`${API_BASE}/profile/${username}`);
};

export const getFeedback = async (username) => {
  return await axios.get(`${API_BASE}/feedback/${username}`);
};


export const analyzeMove = async (payload) => {
  return await axios.post(`${API_BASE}/analyze/move`, payload);
};


export const listPgnGames = async (username, limit = 20) => {
  return await axios.get(`${API_BASE}/games/pgn/${username}/games`, {
    params: { limit },
  });
};

export const getPgnGameMoves = async (username, index) => {
  return await axios.get(`${API_BASE}/games/pgn/${username}/moves`, {
    params: { index },
  });
};
