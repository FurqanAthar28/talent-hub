"""
Tests for connections and messages. Run them with:

    python manage.py test connections
"""

from unittest import mock

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import connection as db_connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from profiles.models import Profile

from .models import Connection, ConnectionRequest
from .throttles import ConnectionRequestThrottle, MessageThrottle


class NetworkTests(TestCase):
    def make_user(self, email, role=Profile.ROLE_CANDIDATE, approved=True):
        user = User.objects.create_user(email, email, "S3cure-pass!", first_name=email.split("@")[0])
        Profile.objects.create(
            user=user,
            role=role,
approval_status=(
                Profile.APPROVAL_APPROVED if approved else Profile.APPROVAL_PENDING
            ),
        )
        return user

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def setUp(self):
        cache.clear()  # rate-limit counters start at zero for every test
        self.ali = self.make_user("ali@example.com")
        self.sara = self.make_user("sara@example.com")
        self.ali_client = self.client_for(self.ali)
        self.sara_client = self.client_for(self.sara)

    def connect(self):
        """Ali asks, Sara accepts."""
        response = self.ali_client.post("/api/connections/send/", {"receiverId": self.sara.pk}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        request_id = response.json()["id"]
        response = self.sara_client.post("/api/connections/accept/", {"requestId": request_id}, format="json")
        self.assertEqual(response.status_code, 200, response.content)

    def start_chat(self):
        response = self.ali_client.post("/api/connections/conversations/start/", {"userId": self.sara.pk}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()["id"]

    # ----- who can use the network -----

    def test_admins_and_unapproved_recruiters_are_kept_out(self):
        admin = self.make_user("boss@example.com", role=Profile.ROLE_ADMIN)
        pending_recruiter = self.make_user("rec@example.com", role=Profile.ROLE_RECRUITER, approved=False)

        response = self.client_for(admin).get("/api/connections/users/")
        self.assertEqual(response.status_code, 403)
        self.assertIn("message", response.json())

        listed_ids = [user["id"] for user in self.ali_client.get("/api/connections/users/").json()]
        self.assertIn(self.sara.pk, listed_ids)
        self.assertNotIn(admin.pk, listed_ids)
        self.assertNotIn(pending_recruiter.pk, listed_ids)

    # ----- privacy -----

    def test_people_waiting_for_approval_cant_use_the_network(self):
        waiting = self.client_for(self.make_user("new@example.com", approved=False))
        self.assertEqual(waiting.get("/api/connections/users/").status_code, 403)
        people = [user["email"] for user in self.ali_client.get("/api/connections/users/").json()]
        self.assertNotIn("new@example.com", people)  # and nobody sees them in the list

    def test_email_only_visible_to_connections(self):
        sara_row = self.ali_client.get("/api/connections/users/").json()[0]
        self.assertEqual(sara_row["email"], "")

        self.connect()
        sara_row = self.ali_client.get("/api/connections/users/").json()[0]
        self.assertEqual(sara_row["connectionStatus"], "connected")
        self.assertEqual(sara_row["email"], "sara@example.com")

    # ----- speed -----

    def test_people_list_does_not_slow_down_with_more_users(self):
        for number in range(3):
            self.make_user(f"user{number}@example.com")
        with CaptureQueriesContext(db_connection) as few_users:
            self.ali_client.get("/api/connections/users/")

        for number in range(3, 23):
            self.make_user(f"user{number}@example.com")
        with CaptureQueriesContext(db_connection) as many_users:
            self.ali_client.get("/api/connections/users/")

        # Same number of queries for 5 people or 25 people.
        self.assertEqual(len(few_users), len(many_users))

    # ----- requests -----

    def test_full_request_flow(self):
        self.connect()
        self.assertEqual(Connection.objects.count(), 2)  # A->B and B->A
        my_connections = self.ali_client.get("/api/connections/my-connections/").json()
        self.assertEqual([user["id"] for user in my_connections], [self.sara.pk])

        response = self.ali_client.post("/api/connections/send/", {"receiverId": self.sara.pk}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["message"], "You are already connected")

    def test_users_can_reconnect_after_admin_disconnects_them(self):
        self.connect()
        admin = self.make_user("boss@example.com", role=Profile.ROLE_ADMIN)
        response = self.client_for(admin).post(
            "/api/admin/disconnect-users/",
            {"userId": self.ali.pk, "connectedUserId": self.sara.pk},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(ConnectionRequest.objects.exists())

        # Before the fix this said "You are already connected" forever.
        response = self.ali_client.post("/api/connections/send/", {"receiverId": self.sara.pk}, format="json")
        self.assertEqual(response.status_code, 201, response.content)

    def test_cannot_accept_someone_elses_request(self):
        other = self.make_user("other@example.com")
        response = self.ali_client.post("/api/connections/send/", {"receiverId": self.sara.pk}, format="json")
        request_id = response.json()["id"]
        response = self.client_for(other).post("/api/connections/accept/", {"requestId": request_id}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Connection.objects.exists())

    # ----- messages -----

    def test_messaging_flow_and_unread_count(self):
        self.connect()
        chat_id = self.start_chat()
        url = f"/api/connections/conversations/{chat_id}/messages/"

        self.assertEqual(self.ali_client.post(url, {"body": "  Hi Sara!  "}, format="json").status_code, 201)

        chats = self.sara_client.get("/api/connections/conversations/").json()
        self.assertEqual(chats[0]["lastMessage"], "Hi Sara!")
        self.assertEqual(chats[0]["unreadCount"], 1)

        self.sara_client.get(url)  # Sara reads it
        chats = self.sara_client.get("/api/connections/conversations/").json()
        self.assertEqual(chats[0]["unreadCount"], 0)

    def test_bad_messages_are_rejected(self):
        self.connect()
        url = f"/api/connections/conversations/{self.start_chat()}/messages/"
        empty = self.ali_client.post(url, {"body": "   "}, format="json")
        too_long = self.ali_client.post(url, {"body": "x" * 2001}, format="json")
        self.assertEqual(empty.status_code, 400)
        self.assertIn("empty", empty.json()["message"])
        self.assertEqual(too_long.status_code, 400)

    def test_cannot_message_after_disconnect(self):
        self.connect()
        url = f"/api/connections/conversations/{self.start_chat()}/messages/"
        Connection.objects.all().delete()

        self.assertEqual(self.ali_client.post(url, {"body": "Still there?"}, format="json").status_code, 403)
        self.assertEqual(self.ali_client.get(url).status_code, 200)  # old messages still readable

    def test_sending_messages_too_fast_is_limited_but_reading_is_not(self):
        self.connect()
        url = f"/api/connections/conversations/{self.start_chat()}/messages/"  # 1 (new chat)

        with mock.patch.object(MessageThrottle, "THROTTLE_RATES", {"message": "3/min"}):
            for text in ("one", "two"):  # 2 and 3
                self.assertEqual(self.ali_client.post(url, {"body": text}, format="json").status_code, 201)
            response = self.ali_client.post(url, {"body": "spam"}, format="json")  # 4: too many
            self.assertEqual(response.status_code, 429)
            self.assertIn("message", response.json())  # a friendly text for the page

            self.assertEqual(self.ali_client.get(url).status_code, 200)  # reading still works
            # Sara has her own counter, so Ali's spam never blocks her.
            self.assertEqual(self.sara_client.post(url, {"body": "hi"}, format="json").status_code, 201)

    def test_connection_requests_are_limited(self):
        with mock.patch.object(ConnectionRequestThrottle, "THROTTLE_RATES", {"connection_request": "1/hour"}):
            first = self.ali_client.post("/api/connections/send/", {"receiverId": self.sara.pk}, format="json")
            self.assertEqual(first.status_code, 201)
            other = self.make_user("omar@example.com")
            second = self.ali_client.post("/api/connections/send/", {"receiverId": other.pk}, format="json")
            self.assertEqual(second.status_code, 429)

    def test_strangers_cannot_read_a_chat(self):
        self.connect()
        chat_id = self.start_chat()
        stranger = self.client_for(self.make_user("eve@example.com"))
        response = stranger.get(f"/api/connections/conversations/{chat_id}/messages/")
        self.assertEqual(response.status_code, 404)

    def test_admins_cannot_read_private_chats(self):
        self.connect()
        chat_id = self.start_chat()
        admin = self.client_for(self.make_user("boss@example.com", role=Profile.ROLE_ADMIN))
        # The old "read any chat" addresses are gone (admins see reported messages only).
        self.assertEqual(admin.get("/api/connections/admin/conversations/").status_code, 404)
        self.assertEqual(admin.get(f"/api/connections/admin/conversations/{chat_id}/").status_code, 404)
        # And the normal chat address only works for the two people in it.
        self.assertEqual(admin.get(f"/api/connections/conversations/{chat_id}/messages/").status_code, 403)
