# Architecture and operational notes

The frontend owns presentation and sends a single analysis request. The backend owns provider credentials, input validation, geometry sampling, forecast matching, risk classification, metrics, and recommendation. This prevents private credentials from reaching the browser and ensures every route uses the same deterministic business rules.

Weather requests are performed concurrently per route, with an eight-request worker limit. Provider timeouts are surfaced as incomplete checkpoint data. An incomplete value is never converted to zero or classified as Low.

