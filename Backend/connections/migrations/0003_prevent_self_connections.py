from django.db import migrations, models


def remove_self_relationships(apps, schema_editor):
    connection = apps.get_model("connections", "Connection")
    connection_request = apps.get_model("connections", "ConnectionRequest")

    connection.objects.filter(user_id=models.F("connected_user_id")).delete()
    connection_request.objects.filter(sender_id=models.F("receiver_id")).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("connections", "0002_conversation_message"),
    ]

    operations = [
        migrations.RunPython(remove_self_relationships, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="connection",
            constraint=models.CheckConstraint(
                condition=~models.Q(user_id=models.F("connected_user_id")),
                name="connection_no_self_connection",
            ),
        ),
        migrations.AddConstraint(
            model_name="connectionrequest",
            constraint=models.CheckConstraint(
                condition=~models.Q(sender_id=models.F("receiver_id")),
                name="connection_request_no_self_request",
            ),
        ),
    ]
