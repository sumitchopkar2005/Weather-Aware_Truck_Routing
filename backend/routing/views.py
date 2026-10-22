import logging
from time import perf_counter
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.throttling import ScopedRateThrottle
from .serializers import TripRequestSerializer
from .risk_engine import assess_checkpoint, rank_routes
from .services.geometry import sample_geometry
from .services.mapbox import MapboxError, directions, geocode
from .services.open_meteo import (
    WeatherProviderError,
    fetch_corridor_weather,
    fetch_weather,
)

logger = logging.getLogger(__name__)

def _analyze_checkpoint(point, route_duration, departure, load_weight):
    arrival = departure + timedelta(seconds=route_duration * point["distance_miles"] / max(point["route_distance"], 1))
    try:
        weather = fetch_weather(point["latitude"], point["longitude"], arrival)
        assessment = assess_checkpoint(weather["wind_mph"], weather["rain_in_per_hour"], weather["snow_in_per_hour"], load_weight)
    except WeatherProviderError as exc:
        weather = {
            "wind_mph": None,
            "rain_in_per_hour": None,
            "precipitation_in_per_hour": None,
            "snow_in_per_hour": None,
            "temperature_f": None,
            "forecast_time": None,
            "available": False,
            "unavailable_reason": str(exc),
        }
        assessment = assess_checkpoint(None, None, None, load_weight)
    return {**point, "arrival_time": arrival.isoformat(), "weather": weather, **assessment}

def _route_result(route, index, interval, departure, load_weight):
    distance_miles = route["distance"] / 1609.344
    points = sample_geometry(route["geometry"]["coordinates"], interval)
    for point in points:
        point["route_distance"] = distance_miles
    with ThreadPoolExecutor(max_workers=min(8, max(1, len(points)))) as executor:
        checkpoints = list(executor.map(lambda p: _analyze_checkpoint(p, route["duration"], departure, load_weight), points))
    corridor_points = sample_geometry(
        route["geometry"]["coordinates"],
        min(interval, 25),
    )
    corridor_coordinates = tuple(
        (point["longitude"], point["latitude"]) for point in corridor_points
    )
    corridor_times = tuple(
        departure + timedelta(hours=hour) for hour in range(49)
    )
    try:
        corridor_weather = fetch_corridor_weather(
            corridor_coordinates,
            corridor_times,
        )
    except WeatherProviderError as exc:
        logger.warning("Weather corridor unavailable: %s", exc)
        corridor_weather = [
            {
                "longitude": point["longitude"],
                "latitude": point["latitude"],
                "forecast": [
                    {
                        "wind_mph": None,
                        "rain_in_per_hour": None,
                        "precipitation_in_per_hour": None,
                        "snow_in_per_hour": None,
                        "temperature_f": None,
                        "forecast_time": None,
                        "available": False,
                        "unavailable_reason": str(exc),
                    }
                    for _ in corridor_times
                ],
            }
            for point in corridor_points
        ]
    heatmap_samples = []
    for point, weather_point in zip(corridor_points, corridor_weather):
        forecasts = []
        for weather in weather_point["forecast"]:
            assessment = assess_checkpoint(
                weather["wind_mph"],
                weather["rain_in_per_hour"],
                weather["snow_in_per_hour"],
                load_weight,
            )
            forecasts.append(
                {
                    "forecast_time": weather["forecast_time"],
                    "weather": weather,
                    "risk": assessment["risk"],
                    "risk_score": assessment["risk_score"],
                }
            )
        heatmap_samples.append(
            {
                "distance_miles": point["distance_miles"],
                "longitude": point["longitude"],
                "latitude": point["latitude"],
                "forecasts": forecasts,
            }
        )
    segment_lengths = [checkpoints[i + 1]["distance_miles"] - checkpoints[i]["distance_miles"] for i in range(len(checkpoints) - 1)]
    miles = {risk: 0.0 for risk in ("Low", "Moderate", "High", "Severe", "No Travel")}
    scores = []
    for checkpoint, segment in zip(checkpoints, segment_lengths):
        if checkpoint["risk"] in miles:
            miles[checkpoint["risk"]] += segment
        if checkpoint["risk_score"] is not None:
            scores.append(checkpoint["risk_score"])
    incomplete = any(point["incomplete"] for point in checkpoints)
    unavailable_reasons = [
        point["weather"].get("unavailable_reason")
        for point in checkpoints
        if point["weather"].get("unavailable_reason")
    ]
    return {
        "id": f"route-{index + 1}", "name": f"Route {index + 1}", "geometry": route["geometry"],
        "distance_miles": distance_miles, "duration_seconds": route["duration"],
        "duration_minutes": round(route["duration"] / 60), "summary": route.get("name") or "Driving route",
        "estimated_arrival": (departure + timedelta(seconds=route["duration"])).isoformat(),
        "checkpoints": checkpoints, "checkpoint_count": len(checkpoints),
        "low_risk_miles": miles["Low"], "moderate_risk_miles": miles["Moderate"],
        "high_risk_miles": miles["High"], "severe_risk_miles": miles["Severe"],
        "no_travel_miles": miles["No Travel"], "average_risk_score": sum(scores) / len(scores) if scores else None,
        "highest_risk": max((point["risk"] for point in checkpoints), key=lambda value: ("Unknown", "Low", "Moderate", "High", "Severe", "No Travel").index(value), default="Unknown"),
        "incomplete_weather": incomplete, "weather_coverage_percent": round(100 * sum(not p["incomplete"] for p in checkpoints) / len(checkpoints)) if checkpoints else 0,
        "weather_unavailable_count": sum(
            not point["weather"].get("available", False) for point in checkpoints
        ),
        "weather_unavailable_reason": (
            unavailable_reasons[0] if unavailable_reasons else None
        ),
        "has_no_travel": any(point["risk"] == "No Travel" for point in checkpoints),
        "weather_corridor": {
            "metric": "risk_score",
            "unit": "risk score (1 Low to 5 No Travel)",
            "forecast_start": departure.isoformat(),
            "forecast_hours": 48,
            "sample_interval_miles": min(interval, 25),
            "samples": heatmap_samples,
        },
    }

class AnalyzeRouteView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "route_analysis"

    def post(self, request):
        started_at = perf_counter()
        serializer = TripRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            origin, origin_name = geocode(data["origin"])
            destination, destination_name = geocode(data["destination"])
            routes = directions(origin, destination)
        except MapboxError as exc:
            logger.warning(
                "Route analysis provider failure: code=%s message=%s",
                exc.code,
                str(exc),
            )
            return Response(
                {"detail": str(exc), "code": exc.code},
                status=exc.status_code,
            )
        if not routes:
            logger.warning("Route analysis returned no routes from Mapbox")
            return Response(
                {
                    "detail": (
                        "No drivable route was returned for these locations. "
                        "Try a supported driving corridor."
                    ),
                    "code": "no_route",
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        departure = datetime.combine(data["departure_date"], data["departure_time"], tzinfo=timezone.utc)
        results = [_route_result(route, index, data["checkpoint_interval"], departure, data["load_weight"]) for index, route in enumerate(routes)]
        recommended_id, qualified = rank_routes(results)
        recommended_route = next(
            (route for route in results if route["id"] == recommended_id),
            None,
        )
        recommendation_reason = (
            "Selected using severe-risk miles, high-risk miles, average risk, then travel time."
            if qualified
            else "No route is fully assessed and free of No Travel conditions; review all warnings before traveling."
        )
        response = Response({
            "trip": {**data, "origin": origin_name, "destination": destination_name, "departure": departure.isoformat()},
            "origin": {"name": origin_name, "longitude": origin[0], "latitude": origin[1]},
            "destination": {"name": destination_name, "longitude": destination[0], "latitude": destination[1]},
            "routes": results, "recommended_route_id": recommended_id, "has_qualified_recommendation": qualified,
            "recommendation": {
                "route_id": recommended_route["id"] if recommended_route else None,
                "reason": recommendation_reason,
            },
            "limitations": ["Travel time uses the routing provider's duration and does not include live traffic.", "Weather values are matched to the nearest hourly Open-Meteo forecast.", "Segment risk miles use the risk at the checkpoint at the start of each segment."],
        })
        logger.info(
            "route_analysis_completed routes=%d duration_ms=%.1f corridor_samples=%d",
            len(results),
            (perf_counter() - started_at) * 1000,
            sum(
                len(route["weather_corridor"]["samples"])
                for route in results
            ),
        )
        return response
