import React from "react";
import UploadForm from "./components/UploadForm";
import TrainModel from "./components/TrainModel";
import ChessBoardUI from "./components/ChessBoardUI";
import "./App.css";
import AnalysisPanel from "./components/AnalysisPanel";

function App() {
  return (
    <div className="container">
      <h1>Adaptive Chess Engine ♟️</h1>
      <UploadForm />
      <TrainModel />
      <ChessBoardUI />
      <AnalysisPanel />
    </div>
  );
}

export default App;
