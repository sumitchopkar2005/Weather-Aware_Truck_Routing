import React from "react";
import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import "./index.css";
import App from "./App";

const RouteMap = lazy(() => import("./components/map/RouteMap"));

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={<div className="map-loading-state">Loading map tools...</div>}>
      <App RouteMap={RouteMap} />
    </Suspense>
  </React.StrictMode>,
);
