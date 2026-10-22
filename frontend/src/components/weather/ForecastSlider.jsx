import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";

export default function ForecastSlider({ departure, route, onChange }) {
  const [hours, setHours] = useState(0);
  const availableTimes = useMemo(
    () =>
      route?.weather_corridor?.samples?.[0]?.forecasts
        ?.map((forecast) => forecast.forecast_time)
        .filter(Boolean) || [],
    [route],
  );
  const maxHours = Math.min(48, Math.max(0, availableTimes.length - 1));

  useEffect(() => {
    setHours(0);
    onChange?.(0);
  }, [route?.id, departure, onChange]);

  const selected = departure
    ? new Date(new Date(departure).getTime() + hours * 3600000)
    : null;
  const selectedProviderTime =
    availableTimes[Math.min(hours, availableTimes.length - 1)];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-900">Forecast corridor</h2>
          <p className="mt-1 text-sm text-slate-500">
            Explore the real provider forecast along the selected route.
          </p>
        </div>
        <Clock3 className="text-blue-600" size={20} />
      </div>

      <input
        aria-label="Forecast offset in hours"
        className="mt-5 w-full accent-blue-600"
        type="range"
        min="0"
        max={maxHours}
        value={hours}
        onChange={(event) => {
          const nextHours = Number(event.target.value);
          setHours(nextHours);
          onChange?.(nextHours);
        }}
      />

      <div className="mt-2 flex justify-between text-xs font-semibold text-slate-500">
        <span>Trip reference</span>
        <span>
          +{hours} hours
          {selected ? ` · ${selected.toLocaleString()}` : ""}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
        <span>Displayed forecast: {selectedProviderTime ? new Date(selectedProviderTime).toLocaleString() : "Unavailable"}</span>
        <span className="risk-heatmap-legend"><i className="low" /> Low</span>
        <span className="risk-heatmap-legend"><i className="moderate" /> Moderate</span>
        <span className="risk-heatmap-legend"><i className="high" /> High</span>
        <span className="risk-heatmap-legend"><i className="severe" /> Severe / No Travel</span>
      </div>
      <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        The map heat layer uses real Open-Meteo hourly measurements sampled at
        route coordinates. Unavailable forecast points are omitted, not
        interpolated or treated as safe. Risk colors represent the score from
        1 (Low) to 5 (No Travel).
      </p>
    </section>
  );
}
