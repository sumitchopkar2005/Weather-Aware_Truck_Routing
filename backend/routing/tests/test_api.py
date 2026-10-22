from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from routing.services.mapbox import MapboxError
from routing.views import _route_result


@pytest.fixture
def client():
    return APIClient()


def trip_payload():
    return {
        "origin": "Denver, CO",
        "destination": "Salt Lake City, UT",
        "departure_date": (date.today() + timedelta(days=1)).isoformat(),
        "departure_time": "08:00",
        "load_weight": 40000,
        "checkpoint_interval": 25,
    }


def route_fixture():
    return {
        "distance": 160934.4,
        "duration": 7200,
        "name": "I-80",
        "geometry": {
            "type": "LineString",
            "coordinates": [[-104.99, 39.74], [-104, 40], [-103, 40.5]],
        },
    }


@pytest.mark.django_db
def test_analyze_route_returns_expected_response(client):
    with (
        patch("routing.views.geocode", side_effect=[([-104.99, 39.74], "Denver"), ([-103, 40.5], "Destination")]),
        patch("routing.views.directions", return_value=[route_fixture()]),
        patch(
            "routing.views.fetch_weather",
            return_value={
                "wind_mph": 10,
                "rain_in_per_hour": 0,
                "snow_in_per_hour": 0,
                "forecast_time": "2026-10-22T08:00",
            },
        ),
        patch("routing.views.fetch_corridor_weather", return_value=[]),
    ):
        response = client.post(reverse("route-analyze"), trip_payload(), format="json")

    assert response.status_code == 200
    body = response.json()
    assert len(body["routes"]) == 1
    assert body["routes"][0]["checkpoints"][0]["distance_miles"] == 0
    assert body["recommended_route_id"] == "route-1"
    assert "weather_corridor" in body["routes"][0]


def test_route_result_builds_risk_corridor_from_provider_samples():
    departure = datetime(2026, 10, 22, 8, tzinfo=timezone.utc)
    corridor_response = [
        {
            "longitude": -104.99,
            "latitude": 39.74,
            "forecast": [
                {
                    "wind_mph": 40,
                    "rain_in_per_hour": 0,
                    "snow_in_per_hour": 0,
                    "forecast_time": departure.isoformat(),
                    "available": True,
                }
            ],
        }
    ]
    with (
        patch(
            "routing.views.fetch_weather",
            return_value={
                "wind_mph": 10,
                "rain_in_per_hour": 0,
                "snow_in_per_hour": 0,
                "forecast_time": departure.isoformat(),
                "available": True,
            },
        ),
        patch(
            "routing.views.fetch_corridor_weather",
            return_value=corridor_response,
        ),
    ):
        result = _route_result(
            route_fixture(),
            0,
            25,
            departure,
            40000,
        )

    sample = result["weather_corridor"]["samples"][0]
    assert result["weather_corridor"]["metric"] == "risk_score"
    assert sample["forecasts"][0]["risk"] == "High"
    assert sample["forecasts"][0]["risk_score"] == 3


@pytest.mark.django_db
def test_analyze_route_rejects_invalid_input(client):
    payload = trip_payload()
    payload["load_weight"] = 0

    response = client.post(reverse("route-analyze"), payload, format="json")

    assert response.status_code == 400
    assert "load_weight" in response.json()


@pytest.mark.django_db
def test_analyze_route_calculates_nonzero_severe_miles_when_weather_requires_it(
    client,
):
    payload = trip_payload()
    payload["load_weight"] = 40001

    with (
        patch(
            "routing.views.geocode",
            side_effect=[
                ([-104.99, 39.74], "Denver"),
                ([-103, 40.5], "Destination"),
            ],
        ),
        patch("routing.views.directions", return_value=[route_fixture()]),
        patch(
            "routing.views.fetch_weather",
            return_value={
                "wind_mph": 40,
                "rain_in_per_hour": 0,
                "snow_in_per_hour": 0,
                "forecast_time": "2026-10-22T08:00",
            },
        ),
        patch("routing.views.fetch_corridor_weather", return_value=[]),
    ):
        response = client.post(reverse("route-analyze"), payload, format="json")

    route = response.json()["routes"][0]
    assert route["severe_risk_miles"] > 0
    assert route["high_risk_miles"] == 0


@pytest.mark.django_db
def test_analyze_route_surfaces_provider_failure(client):
    with patch("routing.views.geocode", side_effect=MapboxError("Location unavailable.")):
        response = client.post(reverse("route-analyze"), trip_payload(), format="json")

    assert response.status_code == 502
    assert response.json()["detail"] == "Location unavailable."


@pytest.mark.django_db
def test_delhi_to_jaipur_uses_returned_route(client):
    payload = trip_payload()
    payload.update({"origin": "Delhi", "destination": "Jaipur"})

    with (
        patch(
            "routing.views.geocode",
            side_effect=[
                ([77.21, 28.61], "Delhi"),
                ([75.78, 26.91], "Jaipur"),
            ],
        ),
        patch("routing.views.directions", return_value=[route_fixture()]),
        patch(
            "routing.views.fetch_weather",
            return_value={
                "wind_mph": 10,
                "rain_in_per_hour": 0,
                "snow_in_per_hour": 0,
                "forecast_time": "2026-10-22T08:00",
            },
        ),
        patch("routing.views.fetch_corridor_weather", return_value=[]),
    ):
        response = client.post(reverse("route-analyze"), payload, format="json")

    assert response.status_code == 200
    assert response.json()["routes"][0]["geometry"] == route_fixture()["geometry"]


@pytest.mark.django_db
def test_delhi_to_new_york_reports_no_route(client):
    payload = trip_payload()
    payload.update({"origin": "Delhi", "destination": "New York"})

    with (
        patch(
            "routing.views.geocode",
            side_effect=[
                ([77.21, 28.61], "Delhi"),
                ([-74.0, 40.71], "New York"),
            ],
        ),
        patch(
            "routing.views.directions",
            side_effect=MapboxError(
                "No drivable route was found between these locations.",
                code="no_route",
                status_code=422,
            ),
        ),
        patch("routing.views.fetch_corridor_weather", return_value=[]),
    ):
        response = client.post(reverse("route-analyze"), payload, format="json")

    assert response.status_code == 422
    assert response.json() == {
        "detail": "No drivable route was found between these locations.",
        "code": "no_route",
    }


@pytest.mark.django_db
def test_same_origin_and_destination_is_rejected(client):
    payload = trip_payload()
    payload.update({"origin": "Delhi", "destination": "Delhi"})

    response = client.post(reverse("route-analyze"), payload, format="json")

    assert response.status_code == 400
    assert "Origin and destination" in str(response.json())
