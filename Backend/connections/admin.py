"""Show connection and message tables in the Django admin site (/admin/)."""

from django.contrib import admin

from .models import Connection, ConnectionRequest, Conversation, Message


@admin.register(Connection)
class ConnectionAdmin(admin.ModelAdmin):
    list_display = ("user", "connected_user", "created_at")
    list_select_related = ("user", "connected_user")


@admin.register(ConnectionRequest)
class ConnectionRequestAdmin(admin.ModelAdmin):
    list_display = ("sender", "receiver", "status", "created_at")
    list_filter = ("status",)
    list_select_related = ("sender", "receiver")


# Conversations and messages are NOT added here on purpose: they are
# private. Admins can read them through the logged admin API instead.
