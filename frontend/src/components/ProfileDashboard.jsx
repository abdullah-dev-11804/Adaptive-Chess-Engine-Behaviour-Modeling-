import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function ProfileDashboard({
  profile,
  pieColors,
  formatNumber,
  formatPercent,
  onViewProofs,
  onViewFeedback,
}) {
  const phaseData = useMemo(() => {
    if (!profile?.phase_breakdown) return [];
    return [
      {
        name: "Opening",
        value: profile.phase_breakdown.opening_avg_cpl || 0,
      },
      {
        name: "Middlegame",
        value: profile.phase_breakdown.middlegame_avg_cpl || 0,
      },
      {
        name: "Endgame",
        value: profile.phase_breakdown.endgame_avg_cpl || 0,
      },
    ];
  }, [profile]);

  const mistakeData = useMemo(() => {
    if (!profile) return [];
    return [
      { name: "Inaccuracy", value: profile.inaccuracy_rate || 0 },
      { name: "Mistake", value: profile.mistake_rate || 0 },
      { name: "Blunder", value: profile.blunder_rate || 0 },
    ];
  }, [profile]);

  const openingData = useMemo(() => {
    if (!profile?.opening_preferences) return [];
    return profile.opening_preferences.map((name, index) => ({
      name,
      value: 5 - index,
    }));
  }, [profile]);

  return (
    <div className="dashboard">
      <section className="panel overview">
        <h2>Overview</h2>
        <div className="card-row">
          <div className="stat-card">
            <span>Games analyzed</span>
            <strong>{profile.games_analyzed}</strong>
          </div>
          <div className="stat-card">
            <span>Average CPL</span>
            <strong>{formatNumber(profile.avg_cpl)}</strong>
          </div>
          <div className="stat-card">
            <span>Blunder rate</span>
            <strong>{formatPercent(profile.blunder_rate)}</strong>
          </div>
          <div className="stat-card">
            <span>Weak phase</span>
            <strong>{profile.weak_phase}</strong>
          </div>
        </div>
      </section>

      <section className="panel charts">
        <div className="chart-card">
          <h3>Phase CPL</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={phaseData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#2f5d62" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Error Rates</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mistakeData}>
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip formatter={(v) => formatPercent(v)} />
              <Bar dataKey="value" fill="#c4552d" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Top Openings</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={openingData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                {openingData.map((entry, index) => (
                  <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="opening-list">
            {profile.opening_preferences.map((opening) => (
              <span key={opening} className="chip">
                {opening}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="panel style-panel">
        <h2>Style Summary</h2>
        <div className="chip-row">
          <span className={`chip ${profile.style?.early_queen ? "chip-on" : "chip-off"}`}>
            Early queen
          </span>
          <span className={`chip ${profile.style?.late_castling ? "chip-on" : "chip-off"}`}>
            Late castling
          </span>
          <span className={`chip ${profile.style?.aggressive ? "chip-on" : "chip-off"}`}>
            Aggressive
          </span>
        </div>
      </section>

      <section className="panel actions">
        <h2>Next</h2>
        <div className="button-row">
          <button className="primary" onClick={onViewProofs}>
            See proof positions
          </button>
          <button className="ghost" onClick={onViewFeedback}>
            See feedback
          </button>
        </div>
      </section>
    </div>
  );
}
