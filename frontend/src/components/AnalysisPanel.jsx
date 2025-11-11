import React, { useState } from "react";
import { analyzeAndStore, listAnalyses } from "../api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function AnalysisPanel() {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);

  const runAnalysis = async () => {
    const res = await analyzeAndStore();
    setSummary(res.data);
    const hist = await listAnalyses();
    setHistory(hist.data);
  };

  return (
    <div className="card">
      <h3>📊 Post-game Analysis</h3>
      <button onClick={runAnalysis}>Analyze Last Uploaded Game</button>

      {summary && (
        <>
          <p><b>File:</b> {summary.file}</p>
          <p><b>Accuracy:</b> {summary.accuracy}% |
             <b> Inacc:</b> {summary.inaccuracies} |
             <b> Mistakes:</b> {summary.mistakes} |
             <b> Blunders:</b> {summary.blunders}
          </p>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={[
                { name: "Inacc", count: summary.inaccuracies },
                { name: "Mistake", count: summary.mistakes },
                { name: "Blunder", count: summary.blunders },
              ]}>
                <XAxis dataKey="name" /><YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {history.length > 0 && (
        <>
          <h4>Recent Analyses</h4>
          <ul style={{ textAlign: "left" }}>
            {history.map(h => (
              <li key={h.id}>
                #{h.id} • {h.filename} • Acc {h.accuracy}% • B {h.blunders}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
