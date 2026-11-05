/**
 * Talking to Django about chats ("conversations") and their messages.
 * Each function throws an Error with Django's own message when something
 * goes wrong, so the page can simply show `error.message`.
 */

import { apiFetch, getApiMessage, readJson } from "../api/client";
import { API_ROUTES } from "../config/apiRoutes";
import { MESSAGES } from "../config/messages";

export type Conversation = {
  id: number;
  participantId: number;
  participantName: string;
  participantEmail: string;
  participantHeadline: string;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
  updated_at: string;
};

export type Message = {
  id: number;
  conversation: number;
  sender: number;
  senderName: string;
  body: string;
  isMine: boolean;
  read_at: string | null;
  created_at: string;
};

/** Stop with Django's message (or the fallback) when the request failed. */
async function throwIfFailed(response: Response, fallback: string) {
  if (response.ok) return;

  const data = await readJson(response);
  throw new Error(getApiMessage(data) || fallback);
}

/** All my chats, newest first. */
export async function fetchConversations(): Promise<Conversation[]> {
  const response = await apiFetch(API_ROUTES.CONNECTIONS.CONVERSATIONS);
  await throwIfFailed(response, MESSAGES.MESSAGES.LOAD_FAILED);

  return (await response.json()) as Conversation[];
}

/** Open (or re-open) a chat with one of my connections. */
export async function startConversation(userId: number): Promise<Conversation> {
  const response = await apiFetch(API_ROUTES.CONNECTIONS.START_CONVERSATION, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  await throwIfFailed(response, MESSAGES.MESSAGES.START_FAILED);

  return (await response.json()) as Conversation;
}

/** Every message in one chat. (Django also marks the other person's as read.) */
export async function fetchConversationMessages(conversationId: number): Promise<Message[]> {
  const response = await apiFetch(API_ROUTES.CONNECTIONS.CONVERSATION_MESSAGES(conversationId));
  await throwIfFailed(response, MESSAGES.MESSAGES.LOAD_FAILED);

  return (await response.json()) as Message[];
}

export async function sendConversationMessage(
  conversationId: number,
  body: string
): Promise<Message> {
  const response = await apiFetch(API_ROUTES.CONNECTIONS.CONVERSATION_MESSAGES(conversationId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  await throwIfFailed(response, MESSAGES.MESSAGES.SEND_FAILED);

  return (await response.json()) as Message;
}
