import { ShieldCheck, AlertTriangle, Clock3 } from "lucide-react";
import { formatDate, formatDuration, RISK_COLORS } from "../../utils/risk";

export default function RouteCard({ route, recommended, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-2xl border p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        recommended
          ? "border-blue-500 bg-blue-50/60 shadow-md"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-950">{route.name}</h3>
            {recommended && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                Recommended
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">{route.summary || "Mapbox driving route"}</p>
        </div>
        {route.has_no_travel ? (
          <AlertTriangle className="text-red-700" size={20} />
        ) : (
          <ShieldCheck className="text-emerald-600" size={20} />
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
        <div>
          <span className="muted">Distance</span>
          <strong className="text-base">{route.distance_miles.toFixed(1)} mi</strong>
        </div>
        <div>
          <span className="muted">Travel time</span>
          <strong className="text-base">{formatDuration(route.duration_seconds)}</strong>
        </div>
        <div>
          <span className="muted">Arrival</span>
          <strong className="text-base">{formatDate(route.estimated_arrival)}</strong>
        </div>
        <div>
          <span className="muted">Weather coverage</span>
          <strong className="text-base">{route.weather_coverage_percent}%</strong>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-red-100 px-3 py-1.5 text-red-700">
          Severe {route.severe_risk_miles.toFixed(1)} mi
        </span>
        <span className="rounded-full bg-orange-100 px-3 py-1.5 text-orange-700">
          High {route.high_risk_miles.toFixed(1)} mi
        </span>
        <span
          style={{ color: RISK_COLORS[route.highest_risk] }}
          className="rounded-full bg-slate-100 px-2 py-1"
        >
          {route.highest_risk}
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>Risk profile</span>
          <span>
            Average {route.average_risk_score?.toFixed(2) ?? "Unknown"}
          </span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="bg-green-600"
            style={{
              width: `${(route.low_risk_miles / route.distance_miles) * 100}%`,
            }}
          />
          <div
            className="bg-yellow-500"
            style={{
              width: `${(route.moderate_risk_miles / route.distance_miles) * 100}%`,
            }}
          />
          <div
            className="bg-orange-500"
            style={{
              width: `${(route.high_risk_miles / route.distance_miles) * 100}%`,
            }}
          />
          <div
            className="bg-red-600"
            style={{
              width: `${(route.severe_risk_miles / route.distance_miles) * 100}%`,
            }}
          />
          <div
            className="bg-red-950"
            style={{
              width: `${(route.no_travel_miles / route.distance_miles) * 100}%`,
            }}
          />
        </div>
      </div>

      {route.incomplete_weather && (
        <p className="mt-3 flex items-start gap-1 text-xs font-medium text-amber-700">
          <Clock3 size={14} />
          <span>
            {route.weather_coverage_percent === 0
              ? route.weather_unavailable_reason ||
                "Weather is unavailable for the checkpoint arrival times."
              : `${route.weather_unavailable_count} checkpoint${
                  route.weather_unavailable_count === 1 ? "" : "s"
                } have incomplete weather data.`}
          </span>
        </p>
      )}
    </button>
  );
}
