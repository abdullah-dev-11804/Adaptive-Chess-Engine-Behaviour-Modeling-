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
