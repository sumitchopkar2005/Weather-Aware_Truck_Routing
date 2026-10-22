# API documentation

## `GET /health/`

Returns `{ "status": "ok", "service": "weather-truck-routing" }`.

## `POST /api/v1/routes/analyze/`

The request accepts `origin`, `destination`, `departure_date`, `departure_time`, positive `load_weight`, and `checkpoint_interval` (`10`, `25`, or `50`). The backend geocodes both locations, requests Mapbox alternatives, samples each returned geometry, and queries Open-Meteo for hourly forecast fields.

Errors are returned as JSON with `detail`. Validation errors use standard Django REST Framework field errors. Provider failures use HTTP 502.

