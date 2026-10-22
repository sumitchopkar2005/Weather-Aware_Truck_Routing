from routing.services.geometry import sample_geometry


def test_sample_geometry_includes_endpoints_and_interval():
    points = sample_geometry([[-105, 40], [-104, 40]], 25)

    assert points[0]["distance_miles"] == 0
    assert points[-1]["distance_miles"] > 50
    assert points[-1]["longitude"] == -104
    assert all(
        previous["distance_miles"] < current["distance_miles"]
        for previous, current in zip(points, points[1:])
    )
