from rest_framework import serializers


class RejectSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500)
