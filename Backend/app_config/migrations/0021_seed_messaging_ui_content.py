from django.db import migrations


UI_CONTENT = {
    "apiConversations": "/connections/conversations",
    "apiConversationMessagesSuffix": "/messages",
    "apiStartConversation": "/connections/conversations/start",
    "routeMessages": "/messages",
    "message": "Message",
    "messages": "Messages",
    "messageInbox": "Inbox",
    "messageIntro": "Message people you are connected with.",
    "messageNoConversations": "No conversations yet.",
    "messageSelectConversation": "Select a conversation to read messages.",
    "messagePlaceholder": "Write a message...",
    "messageSend": "Send",
    "messageSending": "Sending...",
    "messageUnableToLoad": "Unable to load messages right now.",
    "messageUnableToSend": "Unable to send message.",
    "messageConversationNotFound": "Conversation not found.",
    "messageStartFailed": "Unable to start conversation.",
    "messageOnlyConnections": "You can only message your connections.",
    "messageEmptyThread": "No messages yet. Start the conversation.",
    "messageUnread": "unread",
}


def seed_messaging_ui_content(apps, schema_editor):
    ui_content = apps.get_model("app_config", "UiContent")

    for key, value in UI_CONTENT.items():
        ui_content.objects.update_or_create(key=key, defaults={"value": value})


class Migration(migrations.Migration):
    dependencies = [
        ("app_config", "0020_seed_profile_edit_ui_content"),
    ]

    operations = [
        migrations.RunPython(
            seed_messaging_ui_content,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
