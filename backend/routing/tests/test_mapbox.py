from unittest.mock import Mock, patch

import pytest
import requests
from django.test import override_settings

from routing.services.mapbox import MapboxError, directions


def response(status_code, payload):
    result = Mock()
    result.status_code = status_code
    result.ok = status_code < 400
    result.text = ""
    result.json.return_value = payload
    return result


@override_settings(MAPBOX_ACCESS_TOKEN="test-token")
def test_directions_maps_no_route_code_to_actionable_error():
    with patch(
        "routing.services.mapbox.requests.get",
        return_value=response(200, {"code": "NoRoute", "routes": []}),
    ):
        with pytest.raises(MapboxError, match="No drivable route"):
            directions([77.21, 28.61], [-74.0, 40.71])


@override_settings(MAPBOX_ACCESS_TOKEN="test-token")
def test_directions_maps_timeout_without_exposing_request_details():
    with patch(
        "routing.services.mapbox.requests.get",
        side_effect=requests.Timeout("secret-token-not-for-users"),
    ):
        with pytest.raises(MapboxError, match="timed out"):
            directions([77.21, 28.61], [75.78, 26.91])
