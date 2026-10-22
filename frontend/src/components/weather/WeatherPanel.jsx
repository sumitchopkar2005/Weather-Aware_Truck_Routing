import { Wind, CloudRain, Snowflake } from "lucide-react";
import { RISK_COLORS } from "../../utils/risk";
import RiskLegend from "./RiskLegend";

export default function WeatherPanel({
  route,
  departure,
  forecastOffset = 0,
}) {
  if (!route) return null;
  const focusTime =
    new Date(departure || route.checkpoints[0]?.arrival_time || 0).getTime() +
    forecastOffset * 60 * 60 * 1000;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-900">Weather checkpoints</h2>
          <p className="text-sm text-slate-500">
            {route.name} · {route.checkpoint_count} checkpoints
          </p>
          <p className="text-xs text-blue-600">
            Forecast focus: +{forecastOffset} hours from departure
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-bold"
          style={{
            background: `${RISK_COLORS[route.highest_risk]}20`,
            color: RISK_COLORS[route.highest_risk],
          }}
        >
          {route.highest_risk} peak
        </span>
      </div>

      <div className="mt-4">
        <RiskLegend />
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Each row is a checkpoint on the selected route. Values are matched to
        the nearest hourly forecast at the truck&apos;s estimated arrival time.
        Unavailable values indicate missing measurements, not safe conditions.
      </p>
      {route.weather_coverage_percent === 0 && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
          Forecast data is unavailable for all checkpoint arrival times. This
          usually means the departure or final arrival is outside the current
          provider forecast window; the route has not been treated as safe.
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[650px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-2 py-2 font-bold">Distance / ETA</th>
              <th className="px-2 py-2 font-bold">Temp</th>
              <th className="px-2 py-2 font-bold">Wind</th>
              <th className="px-2 py-2 font-bold">Rain</th>
              <th className="px-2 py-2 font-bold">Total precip.</th>
              <th className="px-2 py-2 font-bold">Snow</th>
              <th className="px-2 py-2 font-bold">Risk</th>
            </tr>
          </thead>
          <tbody>
            {route.checkpoints.map((point) => {
              const distanceFromFocus = Math.abs(
                new Date(point.arrival_time).getTime() - focusTime,
              );
              const focused = distanceFromFocus < 30 * 60 * 1000;

              return (
                <tr
                  key={`${route.id}-${point.distance_miles}`}
                  className={`border-b border-slate-100 ${
                    focused ? "bg-blue-50" : ""
                  }`}
                >
                  <td className="px-2 py-3 font-semibold text-slate-800">
                    {point.distance_miles.toFixed(1)} mi
                    <span className="block font-normal text-slate-500">
                      {new Date(point.arrival_time).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-slate-600">
                    {point.weather.temperature_f ?? "Unavailable"}°F
                  </td>
                  <td className="px-2 py-3 text-slate-600">
                    <Wind size={13} className="mr-1 inline" />
                    {point.weather.wind_mph ?? "Unavailable"} mph
                  </td>
                  <td className="px-2 py-3 text-slate-600">
                    <CloudRain size={13} className="mr-1 inline" />
                    {point.weather.rain_in_per_hour ?? "Unavailable"} in/h
                  </td>
                  <td className="px-2 py-3 text-slate-600">
                    {point.weather.precipitation_in_per_hour ?? "Unavailable"}{" "}
                    in/h
                  </td>
                  <td className="px-2 py-3 text-slate-600">
                    <Snowflake size={13} className="mr-1 inline" />
                    {point.weather.snow_in_per_hour ?? "Unavailable"} in/h
                  </td>
                  <td
                    className="px-2 py-3 font-bold"
                    style={{
                      color: RISK_COLORS[point.risk] || RISK_COLORS.Unknown,
                    }}
                  >
                    {point.risk}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
