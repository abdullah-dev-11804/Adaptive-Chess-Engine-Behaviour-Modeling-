import React, { useState } from "react";
import { uploadPGN } from "../api";

function UploadForm() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");

  const handleUpload = async () => {
    if (!file) return setStatus("Please select a file first.");
    setStatus("Uploading...");
    try {
      const res = await uploadPGN(file);
      setStatus(res.data.message);
    } catch (err) {
      setStatus("Error uploading file.");
    }
  };

  return (
    <div className="card">
      <h3>📁 Upload PGN File</h3>
      <input type="file" accept=".pgn" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload}>Upload</button>
      <p>{status}</p>
    </div>
  );
}

export default UploadForm;
