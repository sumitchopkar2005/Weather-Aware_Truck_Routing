from django.urls import include, path

urlpatterns = [
    path("health/", include("routing.health_urls")),
    path("api/v1/", include("routing.urls")),
]

