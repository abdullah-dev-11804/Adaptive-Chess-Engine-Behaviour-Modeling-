import React, { useState } from "react";
import { fetchChessComGames, uploadPGN, getProfile } from "../api";

export default function HomePanel({
  username,
  setUsername,
  hasProfile,
  onProfileBuilt,
  onViewProfile,
}) {
  const [platform, setPlatform] = useState("chess.com");
  const [fetchStatus, setFetchStatus] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [profileStatus, setProfileStatus] = useState("");

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
      onProfileBuilt(res.data);
      setProfileStatus("Profile generated.");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setProfileStatus(detail ? `Profile failed: ${detail}` : "Profile failed.");
    }
  };

  return (
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
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
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
          Builds the profile or returns the cached JSON if it already exists.
        </p>
        <button className="primary" onClick={handleBuildProfile}>
          Build behavior profile
        </button>
        {profileStatus && <p className="status">{profileStatus}</p>}
        {hasProfile && (
          <button className="ghost" onClick={onViewProfile}>
            View profile dashboard
          </button>
        )}
      </section>
    </div>
  );
}
