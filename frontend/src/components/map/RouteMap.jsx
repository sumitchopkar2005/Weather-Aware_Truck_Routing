import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { AlertTriangle, MapPinned } from "lucide-react";
import { RISK_COLORS } from "../../utils/risk";

const MAP_STYLE = "mapbox://styles/mapbox/light-v11";
const ROUTE_COLORS = ["#2563eb", "#7c3aed", "#0891b2"];

function isConfiguredToken(token) {
  return Boolean(token) && !/^(your_|replace_with_)/i.test(token);
}

function createCheckpointPopup(point) {
  const container = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = `${point.risk} checkpoint`;
  container.appendChild(title);

  const details = [
    `Distance: ${point.distance_miles.toFixed(1)} mi`,
    `ETA: ${new Date(point.arrival_time).toLocaleString()}`,
    `Wind: ${point.weather.wind_mph ?? "Unknown"} mph`,
    `Rain: ${point.weather.rain_in_per_hour ?? "Unknown"} in/h`,
    `Snow: ${point.weather.snow_in_per_hour ?? "Unknown"} in/h`,
    `Risk: ${point.risk}`,
  ];

  details.forEach((detail) => {
    const line = document.createElement("div");
    line.textContent = detail;
    container.appendChild(line);
  });

  return new mapboxgl.Popup({ offset: 12 }).setDOMContent(container);
}

export default function RouteMap({
  data,
  selectedRouteId,
  onSelect,
  forecastOffset = 0,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const layerIdsRef = useRef([]);
  const layerHandlersRef = useRef([]);
  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [heatmapAvailable, setHeatmapAvailable] = useState(false);
  const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
  const tokenConfigured = isConfiguredToken(token);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !tokenConfigured) {
      return undefined;
    }

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-98, 39],
      zoom: 3,
      attributionControl: true,
    });

    const handleMapError = (event) => {
      const message =
        event.error?.message ||
        "Mapbox could not load the map style or map tiles.";
      setMapError(message);
    };

    const handleMapLoad = () => {
      setMapReady(true);
      setMapError("");
    };

    const handleResize = () => map.resize();
    map.on("error", handleMapError);
    map.once("load", handleMapLoad);
    window.addEventListener("resize", handleResize);
    mapRef.current = map;

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      map.off("error", handleMapError);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [token, tokenConfigured]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !data) {
      return undefined;
    }
    setHeatmapAvailable(false);

    layerIdsRef.current.forEach((layerId) => {
      layerHandlersRef.current
        .filter(([, registeredLayerId]) => registeredLayerId === layerId)
        .forEach(([event, registeredLayerId, handler]) =>
          map.off(event, registeredLayerId, handler),
        );
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(layerId)) {
        map.removeSource(layerId);
      }
    });
    layerHandlersRef.current = [];
    layerIdsRef.current = [];
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const bounds = new mapboxgl.LngLatBounds();

    data.routes.forEach((route, index) => {
      const layerId = `route-line-${route.id}`;
      const routeColor = ROUTE_COLORS[index % ROUTE_COLORS.length];
      const selected = route.id === selectedRouteId;

      route.geometry.coordinates.forEach((coordinate) =>
        bounds.extend(coordinate),
      );

      map.addSource(layerId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: { routeId: route.id },
          geometry: route.geometry,
        },
      });
      map.addLayer({
        id: layerId,
        type: "line",
        source: layerId,
        paint: {
          "line-color": routeColor,
          "line-width": selected ? 7 : 4,
          "line-opacity": selected ? 1 : 0.62,
        },
      });
      const handleClick = () => onSelect(route.id);
      const handleMouseEnter = () => {
        map.getCanvas().style.cursor = "pointer";
      };
      const handleMouseLeave = () => {
        map.getCanvas().style.cursor = "";
      };
      map.on("click", layerId, handleClick);
      map.on("mouseenter", layerId, handleMouseEnter);
      map.on("mouseleave", layerId, handleMouseLeave);
      layerHandlersRef.current.push(
        ["click", layerId, handleClick],
        ["mouseenter", layerId, handleMouseEnter],
        ["mouseleave", layerId, handleMouseLeave],
      );
      layerIdsRef.current.push(layerId);
    });

    const selectedRoute = data.routes.find(
      (route) => route.id === selectedRouteId,
    );
    const corridor = selectedRoute?.weather_corridor;
    if (corridor?.samples?.length) {
      const target = new Date(
        new Date(data.trip.departure).getTime() +
          forecastOffset * 60 * 60 * 1000,
      );
      const features = corridor.samples
        .map((sample) => {
          const forecast = sample.forecasts
            .filter((item) => item.forecast_time && item.weather?.available)
            .sort(
              (a, b) =>
                Math.abs(new Date(a.forecast_time) - target) -
                Math.abs(new Date(b.forecast_time) - target),
            )[0];
          if (!forecast?.risk_score) return null;
          return {
            type: "Feature",
            properties: {
              riskScore: forecast.risk_score,
              risk: forecast.risk,
              distanceMiles: sample.distance_miles,
            },
            geometry: {
              type: "Point",
              coordinates: [sample.longitude, sample.latitude],
            },
          };
        })
        .filter(Boolean);
      setHeatmapAvailable(features.length > 0);
      const heatmapSourceId = `weather-risk-${selectedRoute.id}`;
      const heatmapLayerId = `${heatmapSourceId}-heatmap`;
      map.addSource(heatmapSourceId, {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });
      map.addLayer({
        id: heatmapLayerId,
        type: "circle",
        source: heatmapSourceId,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            7,
            12,
            15,
          ],
          "circle-color": [
            "match",
            ["get", "riskScore"],
            1,
            "#22c55e",
            2,
            "#eab308",
            3,
            "#f97316",
            4,
            "#ef4444",
            5,
            "#450a0a",
            "#64748b",
          ],
          "circle-opacity": 0.78,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
      });
      layerIdsRef.current.push(heatmapLayerId, heatmapSourceId);
    }

    [data.origin, data.destination].forEach((point, index) => {
      const marker = new mapboxgl.Marker({
        color: index === 0 ? "#2563eb" : "#dc2626",
      })
        .setLngLat([point.longitude, point.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 12 }).setText(
            index === 0 ? `Origin: ${point.name}` : `Destination: ${point.name}`,
          ),
        )
        .addTo(map);
      markersRef.current.push(marker);
    });

    data.routes.forEach((route) => {
      route.checkpoints.forEach((point) => {
        const distanceFromForecast = Math.abs(
          new Date(point.arrival_time).getTime() -
            new Date(data.trip.departure).getTime() -
            forecastOffset * 60 * 60 * 1000,
        );
        const marker = new mapboxgl.Marker({
          color: RISK_COLORS[point.risk] || RISK_COLORS.Unknown,
          scale: distanceFromForecast < 30 * 60 * 1000 ? 1 : 0.7,
        })
          .setLngLat([point.longitude, point.latitude])
          .setPopup(createCheckpointPopup(point))
          .addTo(map);
        markersRef.current.push(marker);
      });
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 50, duration: 500 });
    }
    map.resize();

    return () => {
      layerIdsRef.current.forEach((layerId) => {
        layerHandlersRef.current
          .filter(([, registeredLayerId]) => registeredLayerId === layerId)
          .forEach(([event, registeredLayerId, handler]) =>
            map.off(event, registeredLayerId, handler),
          );
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
        if (map.getSource(layerId)) {
          map.removeSource(layerId);
        }
      });
      layerIdsRef.current = [];
      layerHandlersRef.current = [];
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [data, forecastOffset, mapReady, onSelect, selectedRouteId]);

  const message = !tokenConfigured
    ? "Configure VITE_MAPBOX_PUBLIC_TOKEN in frontend/.env and restart Vite."
    : mapError || "Mapbox map could not load. Check the public token and network access.";

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-2xl bg-slate-200">
      <div ref={containerRef} className="absolute inset-0" />
      {data && mapReady && !mapError && !heatmapAvailable && (
        <div className="absolute left-4 top-4 z-10 rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs font-semibold text-amber-900 shadow-sm">
          Weather-risk heatmap unavailable for this forecast time. Checkpoint
          values remain marked as unavailable.
        </div>
      )}
      {(!tokenConfigured || mapError) && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-200/95 p-6 text-center">
          <div className="max-w-sm rounded-xl bg-white p-5 shadow-lg">
            {tokenConfigured ? (
              <AlertTriangle className="mx-auto text-red-600" size={40} />
            ) : (
              <MapPinned className="mx-auto text-blue-600" size={40} />
            )}
            <p className="mt-3 text-sm font-semibold text-slate-800">
              {tokenConfigured ? "Map unavailable" : "Map configuration required"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
