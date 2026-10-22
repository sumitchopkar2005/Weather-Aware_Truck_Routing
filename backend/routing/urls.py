from django.urls import path
from .views import AnalyzeRouteView

urlpatterns = [path("routes/analyze/", AnalyzeRouteView.as_view(), name="route-analyze")]

