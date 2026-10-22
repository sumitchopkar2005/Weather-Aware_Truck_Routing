import logging
from time import perf_counter
from datetime import datetime, timezone
from functools import lru_cache

import requests

logger = logging.getLogger(__name__)

MM_TO_INCH = 1 / 25.4
CM_TO_INCH = 1 / 2.54


class WeatherProviderError(Exception):
    pass


def _parse_hour(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _value_at(values, index):
    if not isinstance(values, list) or index >= len(values):
        return None
    return values[index]


def _to_inches(value, conversion):
    return None if value is None else value * conversion


def _empty_weather(reason):
    return {
        "wind_mph": None,
        "rain_in_per_hour": None,
        "precipitation_in_per_hour": None,
        "snow_in_per_hour": None,
        "temperature_f": None,
        "forecast_time": None,
        "available": False,
        "unavailable_reason": reason,
    }


def _weather_from_hourly(hourly, forecast_times, target):
    if not forecast_times:
        return _empty_weather("Weather provider returned no hourly data.")
    if target < forecast_times[0] or target > forecast_times[-1]:
        return _empty_weather(
            "Checkpoint ETA is outside the available forecast period.",
        )
    index = min(
        range(len(forecast_times)),
        key=lambda item: abs(forecast_times[item] - target),
    )
    rain_mm = _value_at(hourly.get("rain"), index)
    precipitation_mm = _value_at(hourly.get("precipitation"), index)
    snowfall_cm = _value_at(hourly.get("snowfall"), index)
    weather = {
        "wind_mph": _value_at(hourly.get("wind_speed_10m"), index),
        "rain_in_per_hour": _to_inches(rain_mm, MM_TO_INCH),
        "precipitation_in_per_hour": _to_inches(precipitation_mm, MM_TO_INCH),
        "snow_in_per_hour": _to_inches(snowfall_cm, CM_TO_INCH),
        "temperature_f": _value_at(hourly.get("temperature_2m"), index),
        "forecast_time": forecast_times[index].isoformat(),
    }
    weather["available"] = all(
        weather[field] is not None
        for field in (
            "wind_mph",
            "rain_in_per_hour",
            "precipitation_in_per_hour",
            "snow_in_per_hour",
            "temperature_f",
        )
    )
    if not weather["available"]:
        weather["unavailable_reason"] = (
            "One or more requested forecast measurements were missing."
        )
    return weather


def _request_params(latitudes, longitudes):
    return {
        "latitude": ",".join(f"{value:.6f}" for value in latitudes),
        "longitude": ",".join(f"{value:.6f}" for value in longitudes),
        "hourly": "rain,precipitation,snowfall,temperature_2m,wind_speed_10m",
        "wind_speed_unit": "mph",
        "temperature_unit": "fahrenheit",
        "precipitation_unit": "mm",
        "snowfall_unit": "cm",
        "forecast_days": 10,
        "timezone": "UTC",
    }


@lru_cache(maxsize=512)
def fetch_weather(latitude, longitude, arrival):
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": (
            "rain,precipitation,snowfall,temperature_2m,wind_speed_10m"
        ),
        "wind_speed_unit": "mph",
        "temperature_unit": "fahrenheit",
        "precipitation_unit": "mm",
        "snowfall_unit": "cm",
        # The frontend accepts departures up to seven days ahead. Ten forecast
        # days leaves room for long routes to reach their final checkpoints.
        "forecast_days": 10,
        "timezone": "UTC",
    }

    started_at = perf_counter()
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        logger.warning("Open-Meteo request failed: %s", exc)
        raise WeatherProviderError("Weather provider request failed.") from exc
    except ValueError as exc:
        logger.warning("Open-Meteo returned invalid JSON")
        raise WeatherProviderError(
            "Weather provider returned an invalid response.",
        ) from exc
    logger.info(
        "open_meteo_checkpoint_completed duration_ms=%.1f",
        (perf_counter() - started_at) * 1000,
    )

    # This log contains forecast data only; the request does not include secrets.
    logger.debug("Open-Meteo raw response for %.4f,%.4f: %s", latitude, longitude, payload)

    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    if not times:
        raise WeatherProviderError("Weather provider returned no hourly data.")

    try:
        forecast_times = [_parse_hour(value) for value in times]
    except (TypeError, ValueError) as exc:
        raise WeatherProviderError(
            "Weather provider returned invalid forecast timestamps.",
        ) from exc

    target = arrival.astimezone(timezone.utc)
    weather = _weather_from_hourly(hourly, forecast_times, target)
    logger.debug(
        "Open-Meteo parsed checkpoint weather: target=%s forecast=%s values=%s",
        target.isoformat(),
        weather["forecast_time"],
        weather,
    )
    return weather


@lru_cache(maxsize=64)
def fetch_corridor_weather(coordinates, forecast_times):
    """Fetch hourly weather for route samples in one multi-coordinate request."""
    if not coordinates or not forecast_times:
        return []
    latitudes = [point[1] for point in coordinates]
    longitudes = [point[0] for point in coordinates]
    started_at = perf_counter()
    try:
        response = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params=_request_params(latitudes, longitudes),
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        logger.warning("Open-Meteo corridor request failed: %s", exc)
        raise WeatherProviderError("Weather provider request failed.") from exc
    except ValueError as exc:
        logger.warning("Open-Meteo corridor returned invalid JSON")
        raise WeatherProviderError(
            "Weather provider returned an invalid response.",
        ) from exc
    logger.info(
        "open_meteo_corridor_completed coordinates=%d hours=%d duration_ms=%.1f",
        len(coordinates),
        len(forecast_times),
        (perf_counter() - started_at) * 1000,
    )

    payloads = payload if isinstance(payload, list) else [payload]
    results = []
    for index, point in enumerate(coordinates):
        location_payload = payloads[index] if index < len(payloads) else {}
        hourly = location_payload.get("hourly") or {}
        raw_times = hourly.get("time") or []
        try:
            available_times = [_parse_hour(value) for value in raw_times]
        except (TypeError, ValueError):
            available_times = []
        forecast = [
            _weather_from_hourly(
                hourly,
                available_times,
                target.astimezone(timezone.utc),
            )
            for target in forecast_times
        ]
        results.append(
            {
                "longitude": point[0],
                "latitude": point[1],
                "forecast": forecast,
            }
        )
    return results
