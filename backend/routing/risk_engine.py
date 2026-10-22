from dataclasses import dataclass
from typing import Optional

RISK_ORDER = ("Low", "Moderate", "High", "Severe", "No Travel")
RISK_SCORE = {risk: index + 1 for index, risk in enumerate(RISK_ORDER)}

@dataclass(frozen=True)
class Hazard:
    name: str
    value: Optional[float]
    category: str

def classify_wind(mph: Optional[float], load_weight: float) -> Hazard:
    if mph is None:
        return Hazard("Wind", None, "Unknown")
    if mph >= 55:
        category = "No Travel"
    elif mph >= 45 and load_weight > 30000:
        category = "No Travel"
    elif mph >= 45:
        category = "Severe"
    elif mph >= 35 and load_weight > 40000:
        category = "Severe"
    elif mph >= 35:
        category = "High"
    elif mph >= 25:
        category = "Moderate"
    else:
        category = "Low"
    return Hazard("Wind", mph, category)

def classify_rain(inches_per_hour: Optional[float]) -> Hazard:
    if inches_per_hour is None:
        return Hazard("Rain", None, "Unknown")
    if inches_per_hour > 1.0:
        category = "No Travel"
    elif inches_per_hour >= 0.5:
        category = "Severe"
    elif inches_per_hour >= 0.25:
        category = "High"
    elif inches_per_hour >= 0.10:
        category = "Moderate"
    else:
        category = "Low"
    return Hazard("Rain", inches_per_hour, category)

def classify_snow(inches_per_hour: Optional[float]) -> Hazard:
    if inches_per_hour is None:
        return Hazard("Snow", None, "Unknown")
    if inches_per_hour > 3.0:
        category = "No Travel"
    elif inches_per_hour >= 2.0:
        category = "Severe"
    elif inches_per_hour >= 1.0:
        category = "High"
    elif inches_per_hour >= 0.5:
        category = "Moderate"
    else:
        category = "Low"
    return Hazard("Snow", inches_per_hour, category)

def assess_checkpoint(wind_mph, rain_in_per_hour, snow_in_per_hour, load_weight):
    hazards = [
        classify_wind(wind_mph, load_weight),
        classify_rain(rain_in_per_hour),
        classify_snow(snow_in_per_hour),
    ]
    known = [h for h in hazards if h.category != "Unknown"]
    final = max(known, key=lambda h: RISK_SCORE[h.category]).category if known else "Unknown"
    dominant = next((h.name for h in hazards if h.category == final), None)
    return {
        "risk": final,
        "risk_score": RISK_SCORE.get(final),
        "dominant_hazard": dominant,
        "hazards": [{"name": h.name, "value": h.value, "category": h.category} for h in hazards],
        "incomplete": len(known) != len(hazards),
    }

def rank_routes(routes):
    eligible = [route for route in routes if not route["has_no_travel"] and not route["incomplete_weather"]]
    pool = eligible or [route for route in routes if not route["has_no_travel"]] or routes
    ranked = sorted(pool, key=lambda route: (
        route["severe_risk_miles"], route["high_risk_miles"],
        route["average_risk_score"] if route["average_risk_score"] is not None else float("inf"),
        route["duration_seconds"],
    ))
    return ranked[0]["id"] if ranked else None, bool(eligible)

