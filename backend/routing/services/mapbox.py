import logging
from time import perf_counter

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class MapboxError(Exception):
    def __init__(self, message, *, code="provider_error", status_code=502):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def _provider_error(response, action):
    try:
        payload = response.json()
    except ValueError:
        payload = {}

    provider_code = payload.get("code") or f"http_{response.status_code}"
    provider_message = payload.get("message") or response.text[:200]
    logger.error(
        "Mapbox %s failed: status=%s code=%s message=%s",
        action,
        response.status_code,
        provider_code,
        provider_message,
    )

    if response.status_code in (401, 403):
        return MapboxError(
            "Mapbox authorization failed. Check the configured server token.",
            code="unauthorized",
            status_code=502,
        )
    return MapboxError(
        f"Mapbox {action} failed ({provider_code}).",
        code=provider_code.lower(),
        status_code=502,
    )


def _request(url, params, action, timeout):
    started_at = perf_counter()
    try:
        response = requests.get(url, params=params, timeout=timeout)
    except requests.Timeout as exc:
        logger.error("Mapbox %s timed out: %s", action, exc)
        raise MapboxError(
            f"Mapbox {action} timed out. Try again shortly.",
            code="timeout",
            status_code=504,
        ) from exc
    except requests.RequestException as exc:
        logger.error("Mapbox %s request failed: %s", action, exc)
        raise MapboxError(
            f"Mapbox {action} could not be reached.",
            code="network_error",
            status_code=502,
        ) from exc

    if not response.ok:
        raise _provider_error(response, action)
    logger.info(
        "mapbox_request_completed action=%s status=%s duration_ms=%.1f",
        action,
        response.status_code,
        (perf_counter() - started_at) * 1000,
    )
    try:
        return response.json()
    except ValueError as exc:
        logger.error("Mapbox %s returned invalid JSON", action)
        raise MapboxError(
            f"Mapbox {action} returned an invalid response.",
            code="invalid_response",
            status_code=502,
        ) from exc


def geocode(query):
    if not settings.MAPBOX_ACCESS_TOKEN:
        raise MapboxError(
            "MAPBOX_ACCESS_TOKEN is not configured on the backend.",
            code="missing_token",
        )
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{requests.utils.quote(query)}.json"
    payload = _request(
        url,
        {"access_token": settings.MAPBOX_ACCESS_TOKEN, "limit": 1},
        "geocoding",
        10,
    )
    features = payload.get("features", [])
    if not features:
        raise MapboxError(
            f"No location was found for “{query}”. Check the spelling and try again.",
            code="location_not_found",
            status_code=422,
        )
    return features[0]["center"], features[0].get("place_name", query)


def directions(origin, destination):
    if not settings.MAPBOX_ACCESS_TOKEN:
        raise MapboxError(
            "MAPBOX_ACCESS_TOKEN is not configured on the backend.",
            code="missing_token",
        )
    coordinates = f"{origin[0]},{origin[1]};{destination[0]},{destination[1]}"
    url = f"https://api.mapbox.com/directions/v5/mapbox/driving/{coordinates}"
    payload = _request(
        url,
        {
            "access_token": settings.MAPBOX_ACCESS_TOKEN,
            "alternatives": "true",
            "geometries": "geojson",
            "overview": "full",
            "steps": "false",
        },
        "route generation",
        15,
    )
    routes = payload.get("routes", [])
    provider_code = payload.get("code")
    if not routes and provider_code == "NoRoute":
        raise MapboxError(
            "No drivable route was found between these locations. Try nearby "
            "cities or a supported driving corridor.",
            code="no_route",
            status_code=422,
        )
    return routes[:3]
