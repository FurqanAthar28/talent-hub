from rest_framework import serializers
from .models import Connection, ConnectionRequest


class ConnectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Connection
        fields = "__all__"


class ConnectionRequestSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_email = serializers.EmailField(source="sender.email", read_only=True)
    sender_headline = serializers.SerializerMethodField()
    sender_location = serializers.SerializerMethodField()
    receiver_name = serializers.SerializerMethodField()
    receiver_email = serializers.EmailField(source="receiver.email", read_only=True)
    receiver_headline = serializers.SerializerMethodField()
    receiver_location = serializers.SerializerMethodField()

    class Meta:
        model = ConnectionRequest
        fields = [
            "id",
            "sender",
            "receiver",
            "sender_name",
            "sender_email",
            "sender_headline",
            "sender_location",
            "receiver_name",
            "receiver_email",
            "receiver_headline",
            "receiver_location",
            "status",
            "created_at",
        ]

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.email

    def get_receiver_name(self, obj):
        return obj.receiver.get_full_name() or obj.receiver.email

    def get_sender_headline(self, obj):
        profile = getattr(obj.sender, "profile", None)
        return profile.headline if profile else ""

    def get_receiver_headline(self, obj):
        profile = getattr(obj.receiver, "profile", None)
        return profile.headline if profile else ""

    def get_sender_location(self, obj):
        profile = getattr(obj.sender, "profile", None)
        return profile.location if profile else ""

    def get_receiver_location(self, obj):
        profile = getattr(obj.receiver, "profile", None)
        return profile.location if profile else ""
