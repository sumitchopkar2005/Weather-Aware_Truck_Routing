import { RISK_COLORS, RISK_ORDER } from "../../utils/risk";

const labels = [...RISK_ORDER, "Unknown"];

export default function RiskLegend() {
  return (
    <div
      className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-600"
      aria-label="Risk legend"
    >
      {labels.map((risk) => (
        <span key={risk} className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: RISK_COLORS[risk] }}
          />
          {risk}
        </span>
      ))}
    </div>
  );
}
