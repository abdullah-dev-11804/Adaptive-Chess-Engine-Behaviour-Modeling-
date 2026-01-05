export function formatPercent(value) {
  if (typeof value !== "number") return "0.0%";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatNumber(value) {
  if (value === null || value === undefined) return "0";
  return Number(value).toFixed(2);
}
