import pytest
from routing.risk_engine import assess_checkpoint, classify_rain, classify_snow, classify_wind, rank_routes

@pytest.mark.parametrize("value,expected", [(24.9, "Low"), (25, "Moderate"), (34.9, "Moderate"), (35, "High"), (44.9, "High"), (45, "Severe"), (54.9, "Severe"), (55, "No Travel")])
def test_wind_thresholds(value, expected):
    assert classify_wind(value, 10000).category == expected

@pytest.mark.parametrize("value,expected", [(0.099, "Low"), (0.10, "Moderate"), (0.249, "Moderate"), (0.25, "High"), (0.499, "High"), (0.50, "Severe"), (1.0, "Severe"), (1.01, "No Travel")])
def test_rain_thresholds(value, expected):
    assert classify_rain(value).category == expected

@pytest.mark.parametrize("value,expected", [(0.499, "Low"), (0.5, "Moderate"), (0.999, "Moderate"), (1.0, "High"), (1.999, "High"), (2.0, "Severe"), (3.0, "Severe"), (3.01, "No Travel")])
def test_snow_thresholds(value, expected):
    assert classify_snow(value).category == expected

def test_load_dependent_rules():
    assert classify_wind(45, 30000).category == "Severe"
    assert classify_wind(45, 30001).category == "No Travel"
    assert classify_wind(35, 40000).category == "High"
    assert classify_wind(35, 40001).category == "Severe"

def test_missing_weather_is_incomplete():
    result = assess_checkpoint(None, None, None, 10000)
    assert result["risk"] == "Unknown"
    assert result["incomplete"] is True

def test_route_ranking_uses_severe_then_high_then_average_then_duration():
    base = {"has_no_travel": False, "incomplete_weather": False}
    routes = [
        {**base, "id": "slow", "severe_risk_miles": 1, "high_risk_miles": 0, "average_risk_score": 1, "duration_seconds": 100},
        {**base, "id": "fast", "severe_risk_miles": 0, "high_risk_miles": 2, "average_risk_score": 4, "duration_seconds": 1},
        {**base, "id": "best", "severe_risk_miles": 0, "high_risk_miles": 1, "average_risk_score": 2, "duration_seconds": 50},
    ]
    assert rank_routes(routes) == ("best", True)
