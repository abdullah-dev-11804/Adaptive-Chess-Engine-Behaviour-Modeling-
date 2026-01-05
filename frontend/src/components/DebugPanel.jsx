import React from "react";

export default function DebugPanel({ logs, onClear }) {
  return (
    <div className="debug-panel">
      <div className="debug-header">
        <h3>Debug Log</h3>
        <button className="ghost" onClick={onClear}>
          Clear
        </button>
      </div>
      {logs.length === 0 ? (
        <p className="muted">No debug entries yet.</p>
      ) : (
        <div className="debug-list">
          {logs.map((entry, index) => (
            <div key={`${entry.time}-${index}`} className="debug-row">
              <span>{entry.time}</span>
              <span>{entry.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
