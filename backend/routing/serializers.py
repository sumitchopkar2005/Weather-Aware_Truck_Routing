from datetime import datetime, timezone
from rest_framework import serializers

class TripRequestSerializer(serializers.Serializer):
    origin = serializers.CharField(max_length=200)
    destination = serializers.CharField(max_length=200)
    departure_date = serializers.DateField()
    departure_time = serializers.TimeField()
    load_weight = serializers.FloatField(min_value=0.01)
    checkpoint_interval = serializers.ChoiceField(choices=(10, 25, 50))

    def validate(self, attrs):
        if attrs["origin"].strip().casefold() == attrs["destination"].strip().casefold():
            raise serializers.ValidationError(
                "Origin and destination must be different locations."
            )
        departure = datetime.combine(
            attrs["departure_date"],
            attrs["departure_time"],
            tzinfo=timezone.utc,
        )
        if departure < datetime.now(timezone.utc).replace(microsecond=0):
            raise serializers.ValidationError("Departure must be in the future.")
        return attrs
