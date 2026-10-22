from math import atan2, cos, radians, sin, sqrt

def haversine_miles(a, b):
    lat1, lon1 = a
    lat2, lon2 = b
    radius = 3958.8
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    value = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return radius * 2 * atan2(sqrt(value), sqrt(1 - value))

def sample_geometry(coordinates, interval_miles):
    if len(coordinates) < 2:
        return []
    points = [(coordinates[0][1], coordinates[0][0])]
    distances = [0.0]
    for previous, current in zip(points, [(p[1], p[0]) for p in coordinates[1:]]):
        distances.append(distances[-1] + haversine_miles(previous, current))
        points.append(current)
    total = distances[-1]
    targets = [0.0]
    distance = interval_miles
    while distance < total:
        targets.append(distance)
        distance += interval_miles
    if total > 0:
        targets.append(total)
    result = []
    for target in targets:
        segment = next((i for i in range(1, len(distances)) if distances[i] >= target), len(distances) - 1)
        start_distance, end_distance = distances[segment - 1], distances[segment]
        fraction = 0 if end_distance == start_distance else (target - start_distance) / (end_distance - start_distance)
        start, end = points[segment - 1], points[segment]
        result.append({"distance_miles": target, "longitude": start[1] + (end[1] - start[1]) * fraction, "latitude": start[0] + (end[0] - start[0]) * fraction})
    return result

