from django.db import migrations


UI_CONTENT = {
    "connectionAccept": "Accept",
    "connectionAccepted": "Accepted",
    "connectionAccepting": "Accepting...",
    "connectionConnect": "Connect",
    "connectionDiscover": "Discover",
    "connectionIgnoring": "Ignoring...",
    "connectionIgnore": "Ignore",
    "connectionIntro": "Manage connection requests and discover professionals.",
    "connectionLoading": "Loading your network...",
    "connectionNoConnections": "You do not have any connections yet.",
    "connectionNoReceivedRequests": "No received requests yet.",
    "connectionNoSearchResults": "No professionals match your search.",
    "connectionNoSentRequests": "No sent requests yet.",
    "connectionReceived": "Received",
    "connectionRequestAccepted": "Connection request accepted.",
    "connectionRequestFailed": "Request failed.",
    "connectionRequestIgnored": "Request ignored.",
    "connectionRequestSent": "Connection request sent.",
    "connectionSearchPlaceholder": "Search by name, email, headline, or location...",
    "connectionSending": "Sending...",
    "connectionSent": "Sent",
    "connectionStatusAccepted": "Accepted",
    "connectionStatusAwaitingResponse": "Awaiting response",
    "connectionStatusConnected": "Connected",
    "connectionStatusDeclined": "Declined",
    "connectionStatusIgnored": "Ignored",
    "connectionStatusNotConnected": "Not connected",
    "connectionStatusPending": "Pending",
    "connectionStatusRequestSent": "Request sent",
    "connectionUnableToLoad": "Unable to load your network right now.",
    "connectionUnableToSend": "Unable to send connection request.",
    "connectionUnableToUpdate": "Unable to update connection request.",
    "logoutSuccess": "Logged out successfully",
    "viewProfile": "View",
}


def seed_ui_content(apps, schema_editor):
    ui_content = apps.get_model("app_config", "UiContent")

    for key, value in UI_CONTENT.items():
        ui_content.objects.update_or_create(
            key=key,
            defaults={"value": value},
        )


def remove_seeded_ui_content(apps, schema_editor):
    ui_content = apps.get_model("app_config", "UiContent")
    ui_content.objects.filter(key__in=UI_CONTENT.keys()).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("app_config", "0014_seed_recruiter_verification_ui_content"),
    ]

    operations = [
        migrations.RunPython(seed_ui_content, remove_seeded_ui_content),
    ]
