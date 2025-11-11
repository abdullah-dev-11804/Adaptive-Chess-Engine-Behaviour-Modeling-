import React, { useState } from "react";
import { trainModel } from "../api";

function TrainModel() {
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);

  const handleTrain = async () => {
    setStatus("Fine-tuning Maia-2 model...");
    setProgress(0);

    // Fake progress bar
    let interval = setInterval(() => {
      setProgress((old) => {
        if (old >= 100) {
          clearInterval(interval);
          setStatus("✅ Training complete!");
          return 100;
        }
        return old + 10;
      });
    }, 500);

    try {
      await trainModel("demo_user");
    } catch (err) {
      setStatus("Error during training.");
      clearInterval(interval);
    }
  };

  return (
    <div className="card">
      <h3>🧠 Train Personalized Model</h3>
      <button onClick={handleTrain}>Train Model</button>
      <div className="progress">
        <div className="bar" style={{ width: `${progress}%` }}></div>
      </div>
      <p>{status}</p>
    </div>
  );
}

export default TrainModel;
