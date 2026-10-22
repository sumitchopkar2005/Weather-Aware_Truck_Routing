from django.http import JsonResponse
from django.urls import path

def health(request):
    return JsonResponse({"status": "ok", "service": "weather-truck-routing"})

urlpatterns = [path("", health)]

