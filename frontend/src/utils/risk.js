export const RISK_COLORS = {
  Low: "#16a34a",
  Moderate: "#eab308",
  High: "#f97316",
  Severe: "#dc2626",
  "No Travel": "#7f1d1d",
  Unknown: "#64748b",
};

export const RISK_ORDER = ["Low", "Moderate", "High", "Severe", "No Travel"];

export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
