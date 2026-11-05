"""
The rules of the network, written in ONE place.

Before, "who is allowed to use connections" was written 3 different ways,
and they didn't agree. Now every file asks this module.

WHAT'S IN HERE
1. Who can use connections      -> network_users(), is_network_user()
2. Connecting and disconnecting -> are_connected(), connect_users(), disconnect_users(),
                                   network_connections() (each pair once, for counts and lists)
3. Relationship labels          -> get_relationships()
4. Conversations                -> get_or_create_conversation()
"""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F, Q

from profiles.models import Profile

from .models import Connection, ConnectionRequest, Conversation

User = get_user_model()


# =============================================================================
# 1. WHO CAN USE CONNECTIONS
# =============================================================================


def network_users():
    """
    All users who can connect and message:
    - account switched on (active),
    - not staff/admin,
    - a candidate or a recruiter that an admin has APPROVED.
      (Waiting or "not approved" people can edit their profile, nothing more.)
    """
    return User.objects.filter(
        is_active=True,
        is_staff=False,
        is_superuser=False,
        profile__role__in=[Profile.ROLE_CANDIDATE, Profile.ROLE_RECRUITER],
        profile__approval_status=Profile.APPROVAL_APPROVED,
    )


def is_network_user(user):
    """
    Can this ONE user use connections?
    It reuses network_users(), so the rule can never be different.
    """
    return network_users().filter(pk=user.pk).exists()


# =============================================================================
# 2. CONNECTING AND DISCONNECTING
# =============================================================================


def requests_between(user_a, user_b):
    """Every connection request between two people, in BOTH directions."""
    return ConnectionRequest.objects.filter(
        Q(sender=user_a, receiver=user_b) | Q(sender=user_b, receiver=user_a)
    )


def are_connected(user_a, user_b):
    return Connection.objects.filter(user=user_a, connected_user=user_b).exists()


def connect_users(user_a, user_b):
    """
    Make two people connected. We save TWO rows (A->B and B->A).
    `transaction.atomic` = both rows are saved, or neither.
    """
    with transaction.atomic():
        first_created = Connection.objects.get_or_create(user=user_a, connected_user=user_b)[1]
        Connection.objects.get_or_create(user=user_b, connected_user=user_a)
        return first_created


def network_connections():
    """
    Every connection between two network users, each pair ONCE.

    A connection is saved as 2 rows (A->B and B->A); `user_id < connected_user_id`
    keeps one of them. The admin numbers AND the admin list both use this,
    so they always agree. (Before, the number counted every row, even for
    switched-off people, so it could say 1 while the list showed 0.)
    """
    people = network_users()
    return Connection.objects.filter(
        user_id__lt=F("connected_user_id"),
        user__in=people,
        connected_user__in=people,
    )


def disconnect_users(user_a, user_b):
    """
    Remove a connection (both rows) AND the old requests between them.
    Removing the old requests is important: otherwise an old "accepted"
    request made the app say "you are already connected", and the two
    people could never connect again.

    Returns True if they were connected.
    """
    with transaction.atomic():
        deleted_count, _details = Connection.objects.filter(
            Q(user=user_a, connected_user=user_b) | Q(user=user_b, connected_user=user_a)
        ).delete()
        requests_between(user_a, user_b).delete()

    return deleted_count > 0


# =============================================================================
# 3. RELATIONSHIP LABELS ("connected", "sent_pending", ...)
# =============================================================================

NO_RELATIONSHIP = {"connectionStatus": "none", "requestId": None, "requestStatus": None}


def get_relationships(current_user, other_user_ids):
    """
    For a LIST of users, work out how each one relates to current_user.

    Returns a dict like:
        {7: {"connectionStatus": "connected", "requestId": None, ...},
         9: {"connectionStatus": "sent_pending", "requestId": 31, ...}}

    Before, this asked the database up to 3 questions PER USER
    (300 users = 900 queries). Now it asks 2 questions in total.
    """
    other_user_ids = list(other_user_ids)

    # Question 1: which of them am I connected to?
    connected_ids = set(
        Connection.objects.filter(
            user=current_user,
            connected_user_id__in=other_user_ids,
        ).values_list("connected_user_id", flat=True)
    )

    # Question 2: every request between me and any of them.
    requests = ConnectionRequest.objects.filter(
        Q(sender=current_user, receiver_id__in=other_user_ids)
        | Q(receiver=current_user, sender_id__in=other_user_ids)
    )
    sent = {}  # other user id -> request I sent them
    received = {}  # other user id -> request they sent me
    for request in requests:
        if request.sender_id == current_user.id:
            sent[request.receiver_id] = request
        else:
            received[request.sender_id] = request

    # Now decide each label, in the same order of importance as before:
    # connected > a request I sent > a request I received > nothing.
    relationships = {}
    for user_id in other_user_ids:
        if user_id in connected_ids:
            relationships[user_id] = {
                "connectionStatus": "connected",
                "requestId": None,
                "requestStatus": ConnectionRequest.STATUS_ACCEPTED,
            }
        elif user_id in sent:
            request = sent[user_id]
            relationships[user_id] = {
                "connectionStatus": f"sent_{request.status}",
                "requestId": request.id,
                "requestStatus": request.status,
            }
        elif user_id in received:
            request = received[user_id]
            relationships[user_id] = {
                "connectionStatus": f"received_{request.status}",
                "requestId": request.id,
                "requestStatus": request.status,
            }
        else:
            relationships[user_id] = NO_RELATIONSHIP

    return relationships


# =============================================================================
# 4. CONVERSATIONS
# =============================================================================


def get_or_create_conversation(user_a, user_b):
    """
    Find the chat between two people, or start one.
    The smaller id always goes in participant_one, so (A, B) and (B, A)
    find the SAME chat.
    """
    if user_a.id < user_b.id:
        first, second = user_a, user_b
    else:
        first, second = user_b, user_a

    conversation, _created = Conversation.objects.get_or_create(
        participant_one=first,
        participant_two=second,
    )
    return conversation
