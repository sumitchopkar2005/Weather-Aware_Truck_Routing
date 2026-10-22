import { useMemo, useRef, useState } from "react";
import Header from "./components/layout/Header";
import TripForm from "./components/forms/TripForm";
import RouteCard from "./components/routes/RouteCard";
import WeatherPanel from "./components/weather/WeatherPanel";
import ForecastSlider from "./components/weather/ForecastSlider";
import { analyzeTrip } from "./services/api";
import {
  beginAnalysis,
  completeAnalysis,
  failAnalysis,
  initialAnalysisState,
} from "./services/analysisState";
import { formatDuration } from "./utils/risk";
import {
  AlertTriangle,
  Clock3,
  CloudRain,
  Gauge,
  Map,
  Route,
  ShieldCheck,
  Timer,
} from "lucide-react";

function getErrorMessage(error) {
  if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError") {
    return "";
  }
  return (
    error?.response?.data?.detail ||
    "Unable to analyze this trip. Check the backend and provider configuration."
  );
}

export default function App({ RouteMap }) {
  const [analysis, setAnalysis] = useState(initialAnalysisState);
  const [forecastOffset, setForecastOffset] = useState(0);
  const [lastPayload, setLastPayload] = useState(null);
  const requestSequence = useRef(0);
  const abortController = useRef(null);

  const submit = async (payload) => {
    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;
    const requestId = ++requestSequence.current;

    setAnalysis((state) => beginAnalysis(state, requestId));
    setForecastOffset(0);
    setLastPayload(payload);

    try {
      const result = await analyzeTrip(payload, controller.signal);
      setAnalysis((state) => completeAnalysis(state, requestId, result));
    } catch (error) {
      const message = getErrorMessage(error);
      if (message) {
        setAnalysis((state) => failAnalysis(state, requestId, message));
      }
    } finally {
      if (requestSequence.current === requestId) {
        abortController.current = null;
      }
    }
  };

  const { data, selectedRouteId, error, loading } = analysis;
  const route = useMemo(
    () =>
      data?.routes.find((item) => item.id === selectedRouteId) ||
      data?.routes[0],
    [data, selectedRouteId],
  );

  const summaryCards = [
    [
      "Recommended",
      data?.has_qualified_recommendation ? route?.name : "Safety review",
    ],
    ["Distance", route ? `${route.distance_miles.toFixed(1)} mi` : "—"],
    ["Travel time", route ? formatDuration(route.duration_seconds) : "—"],
    [
      "Weather coverage",
      route ? `${route.weather_coverage_percent}%` : "—",
    ],
  ];

  return (
    <div className="min-h-screen bg-[#f4f7fb]">
      <Header loading={loading} error={error} />
      <main className="dashboard-shell">
        <section className="hero-copy">
          <div>
            <p className="eyebrow">Operations dashboard</p>
            <h1>Plan every mile with weather intelligence.</h1>
            <p className="hero-description">
              Evaluate route safety, forecast exposure, and arrival conditions
              before your truck leaves the yard.
            </p>
          </div>
          <div className="hero-badge">
            <ShieldCheck size={18} />
            Safety-first route analysis
          </div>
        </section>

        <TripForm onSubmit={submit} loading={loading} />

        {error && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            <span>{error}</span>
            {lastPayload && (
              <button
                type="button"
                className="shrink-0 rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white hover:bg-red-800"
                onClick={() => submit(lastPayload)}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl bg-white p-8 text-center text-sm font-medium text-slate-600">
            Analyzing the new trip. Previous results have been cleared.
          </div>
        )}

        {!loading && !data && !error && (
          <div className="empty-state">
            <Route size={30} />
            Enter an origin and destination to generate route and weather
            results.
          </div>
        )}

        {data && !loading && (
          <>
            <section className="summary-grid">
              {summaryCards.map(([label, value], index) => {
                const icons = [ShieldCheck, Map, Timer, Clock3];
                const Icon = icons[index];
                return (
                  <div key={label} className="summary-card">
                    <div className="summary-card-icon">
                      <Icon size={19} />
                    </div>
                    <div>
                      <p>{label}</p>
                      <strong>{value}</strong>
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="secondary-summary-grid">
              <div className="secondary-summary-card">
                <CloudRain size={20} />
                <div>
                  <p>Severe-risk miles</p>
                  <strong>{route?.severe_risk_miles.toFixed(1)} mi</strong>
                  <span>Estimated segment distance</span>
                </div>
              </div>
              <div className="secondary-summary-card">
                <AlertTriangle size={20} />
                <div>
                  <p>High-risk miles</p>
                  <strong>{route?.high_risk_miles.toFixed(1)} mi</strong>
                  <span>Estimated segment distance</span>
                </div>
              </div>
              <div className="secondary-summary-card">
                <Gauge size={20} />
                <div>
                  <p>Average risk score</p>
                  <strong>{route?.average_risk_score?.toFixed(2) ?? "Unavailable"}</strong>
                  <span>Low 1 · No Travel 5</span>
                </div>
              </div>
            </section>

            {!data.has_qualified_recommendation && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <strong>No route qualifies as a fully assessed safe recommendation.</strong>{" "}
                {route?.weather_coverage_percent === 0
                  ? "Weather forecasts are unavailable for this trip’s checkpoint times. Choose an earlier departure or try again after checking the forecast window."
                  : "Review No Travel conditions and the incomplete weather coverage before traveling."}
              </div>
            )}

            <div className="workspace-grid">
              <section className="route-column">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Available options</p>
                    <h2>Route comparison</h2>
                  </div>
                  <span>{data.routes.length} route{data.routes.length === 1 ? "" : "s"}</span>
                </div>
                <p className="section-description">
                  Routes rank by severe-risk miles, high-risk miles, average
                  risk, and then travel time.
                </p>
                <div className="space-y-3">
                  {data.routes.map((item) => (
                    <RouteCard
                      key={item.id}
                      route={item}
                      recommended={item.id === data.recommended_route_id}
                      onSelect={() =>
                        setAnalysis((state) => ({
                          ...state,
                          selectedRouteId: item.id,
                        }))
                      }
                    />
                  ))}
                </div>
              </section>
              <section className="map-column">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Live route geometry</p>
                    <h2>Weather-aware map</h2>
                  </div>
                  <span className="map-key"><i /> Selected route</span>
                </div>
                <RouteMap
                  data={data}
                  selectedRouteId={selectedRouteId}
                  onSelect={(routeId) =>
                    setAnalysis((state) => ({
                      ...state,
                      selectedRouteId: routeId,
                    }))
                  }
                  forecastOffset={forecastOffset}
                />
              </section>
            </div>

            <section className="content-panel">
              <WeatherPanel
                route={route}
                departure={data.trip.departure}
                forecastOffset={forecastOffset}
              />
            </section>

            <section className="content-panel">
              <ForecastSlider
                departure={data.trip.departure}
                route={route}
                onChange={setForecastOffset}
              />
            </section>

            {data.recommendation?.reason && (
              <div className="content-panel text-sm text-slate-700">
                <strong>Recommendation rationale:</strong>{" "}
                {data.recommendation.reason}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
