from datetime import datetime, timezone
from unittest.mock import Mock, patch

import pytest

from routing.services.open_meteo import fetch_corridor_weather, fetch_weather


def provider_response():
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "hourly_units": {
            "rain": "mm",
            "precipitation": "mm",
            "snowfall": "cm",
            "temperature_2m": "°F",
            "wind_speed_10m": "mp/h",
        },
        "hourly": {
            "time": [
                "2026-10-22T08:00",
                "2026-10-22T09:00",
                "2026-10-22T10:00",
            ],
            "rain": [0, 2.54, None],
            "precipitation": [0, 5.08, 1],
            "snowfall": [0, 2.54, None],
            "temperature_2m": [70, 71, 72],
            "wind_speed_10m": [8, 12, 16],
        },
    }
    return response


@pytest.fixture(autouse=True)
def clear_weather_cache():
    fetch_weather.cache_clear()
    fetch_corridor_weather.cache_clear()
    yield
    fetch_weather.cache_clear()
    fetch_corridor_weather.cache_clear()


def test_weather_requests_required_variables_and_converts_units():
    arrival = datetime(2026, 10, 22, 9, 10, tzinfo=timezone.utc)

    with patch(
        "routing.services.open_meteo.requests.get",
        return_value=provider_response(),
    ) as request:
        weather = fetch_weather(32.73, 74.87, arrival)

    params = request.call_args.kwargs["params"]
    assert params["hourly"] == (
        "rain,precipitation,snowfall,temperature_2m,wind_speed_10m"
    )
    assert params["precipitation_unit"] == "mm"
    assert params["snowfall_unit"] == "cm"
    assert weather["rain_in_per_hour"] == pytest.approx(0.1)
    assert weather["precipitation_in_per_hour"] == pytest.approx(0.2)
    assert weather["snow_in_per_hour"] == pytest.approx(1.0)
    assert weather["temperature_f"] == 71
    assert weather["wind_mph"] == 12


def test_weather_matches_nearest_checkpoint_eta_not_current_hour():
    arrival = datetime(2026, 10, 22, 9, 40, tzinfo=timezone.utc)

    with patch(
        "routing.services.open_meteo.requests.get",
        return_value=provider_response(),
    ):
        weather = fetch_weather(20.94, 78.96, arrival)

    assert weather["forecast_time"] == "2026-10-22T10:00:00+00:00"
    assert weather["wind_mph"] == 16
    assert weather["rain_in_per_hour"] is None
    assert weather["snow_in_per_hour"] is None
    assert weather["available"] is False


def test_weather_preserves_zero_and_marks_missing_values_unavailable():
    arrival = datetime(2026, 10, 22, 8, 0, tzinfo=timezone.utc)

    with patch(
        "routing.services.open_meteo.requests.get",
        return_value=provider_response(),
    ):
        weather = fetch_weather(32.73, 74.87, arrival)

    assert weather["available"] is True
    assert weather["rain_in_per_hour"] == 0
    assert weather["snow_in_per_hour"] == 0


def test_weather_outside_forecast_window_is_unavailable():
    arrival = datetime(2026, 10, 22, 7, 0, tzinfo=timezone.utc)

    with patch(
        "routing.services.open_meteo.requests.get",
        return_value=provider_response(),
    ):
        weather = fetch_weather(32.73, 74.87, arrival)

    assert weather["available"] is False
    assert weather["wind_mph"] is None
    assert "outside" in weather["unavailable_reason"]


def test_corridor_weather_generates_real_timestamped_samples_and_converts_units():
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = [
        {
            "hourly": {
                "time": [
                    "2026-10-22T08:00",
                    "2026-10-22T09:00",
                ],
                "rain": [2.54, 0],
                "precipitation": [5.08, 0],
                "snowfall": [2.54, 0],
                "temperature_2m": [70, 71],
                "wind_speed_10m": [30, 12],
            },
        },
    ]
    with patch(
        "routing.services.open_meteo.requests.get",
        return_value=response,
    ) as request:
        samples = fetch_corridor_weather(
            ((74.87, 32.73),),
            (
                datetime(2026, 10, 22, 8, 20, tzinfo=timezone.utc),
                datetime(2026, 10, 22, 10, tzinfo=timezone.utc),
            ),
        )

    params = request.call_args.kwargs["params"]
    assert params["latitude"] == "32.730000"
    assert params["longitude"] == "74.870000"
    assert samples[0]["forecast"][0]["forecast_time"] == (
        "2026-10-22T08:00:00+00:00"
    )
    assert samples[0]["forecast"][0]["rain_in_per_hour"] == pytest.approx(0.1)
    assert samples[0]["forecast"][0]["snow_in_per_hour"] == pytest.approx(1.0)
    assert samples[0]["forecast"][1]["available"] is False
    assert "outside" in samples[0]["forecast"][1]["unavailable_reason"]


def test_corridor_weather_preserves_missing_measurements_as_unavailable():
    response = Mock()
    response.raise_for_status.return_value = None
    response.json.return_value = {
        "hourly": {
            "time": ["2026-10-22T08:00"],
            "rain": [None],
            "precipitation": [0],
            "snowfall": [0],
            "temperature_2m": [70],
            "wind_speed_10m": [12],
        },
    }
    with patch(
        "routing.services.open_meteo.requests.get",
        return_value=response,
    ):
        samples = fetch_corridor_weather(
            ((74.87, 32.73),),
            (datetime(2026, 10, 22, 8, tzinfo=timezone.utc),),
        )

    weather = samples[0]["forecast"][0]
    assert weather["rain_in_per_hour"] is None
    assert weather["precipitation_in_per_hour"] == 0
    assert weather["available"] is False
