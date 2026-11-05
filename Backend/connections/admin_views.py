"""
Admin-only endpoints for connections and messages.

(Listing, connecting and disconnecting users is done by the admin_panel
app, "/api/admin/...". Only the private-message tools live here.)
"""

from django.db.models import Count, OuterRef, Subquery
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import AdminActionLog
from profiles.permissions import IsAppAdmin

from .models import Conversation, Message
from .serializers import (
    AdminConversationDetailSerializer,
    AdminConversationSerializer,
)


def admin_conversations():
    """All chats, with the newest message and the message count added by the database."""
    newest_message = Message.objects.filter(conversation=OuterRef("pk")).order_by("-created_at")

    return Conversation.objects.select_related(
        "participant_one",
        "participant_two",
    ).annotate(
        last_message_body=Subquery(newest_message.values("body")[:1]),
        last_message_at=Subquery(newest_message.values("created_at")[:1]),
        message_count=Count("messages"),
    )


@api_view(["GET"])
@permission_classes([IsAppAdmin])
def admin_conversations_view(request):
    conversations = admin_conversations().order_by("-updated_at")
    return Response(AdminConversationSerializer(conversations, many=True).data)


@api_view(["GET"])
@permission_classes([IsAppAdmin])
def admin_conversation_detail_view(request, conversation_id):
    """
    Read a private conversation.
    Because these are private messages, every time an admin opens one we
    write it in the admin log, so there is a record of who read what.
    """
    conversation = get_object_or_404(admin_conversations(), id=conversation_id)

    AdminActionLog.objects.create(
        actor=request.user,
        target_user=conversation.participant_one,
        action="conversation_viewed",
        description="Viewed a private conversation",
        metadata={
            "conversation_id": conversation.id,
            "participant_ids": [conversation.participant_one_id, conversation.participant_two_id],
        },
    )

    return Response(AdminConversationDetailSerializer(conversation).data)
