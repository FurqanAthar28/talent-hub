import { apiFetch } from "../api/client";
import type { UiContent } from "../api/ui-content";

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

type ApiMessageResponse = {
  message?: string;
};

export async function readMessageApiError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as ApiMessageResponse;
    return data.message || fallback;
  } catch (error) {
    console.error("Failed to read message API error:", error);
    return fallback;
  }
}

export async function fetchConversations(uiContent: UiContent) {
  const response = await apiFetch(uiContent.apiConversations);

  if (!response.ok) {
    throw new Error(uiContent.messageUnableToLoad);
  }

  return (await response.json()) as Conversation[];
}

export async function startConversation(uiContent: UiContent, userId: number) {
  const response = await apiFetch(uiContent.apiStartConversation, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    throw new Error(await readMessageApiError(response, uiContent.messageStartFailed));
  }

  return (await response.json()) as Conversation;
}

export async function fetchConversationMessages(
  uiContent: UiContent,
  conversationId: number
) {
  const response = await apiFetch(
    `${uiContent.apiConversations}/${conversationId}${uiContent.apiConversationMessagesSuffix}`
  );

  if (!response.ok) {
    throw new Error(uiContent.messageUnableToLoad);
  }

  return (await response.json()) as Message[];
}

export async function sendConversationMessage(
  uiContent: UiContent,
  conversationId: number,
  body: string
) {
  const response = await apiFetch(
    `${uiContent.apiConversations}/${conversationId}${uiContent.apiConversationMessagesSuffix}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }
  );

  if (!response.ok) {
    throw new Error(await readMessageApiError(response, uiContent.messageUnableToSend));
  }

  return (await response.json()) as Message;
}
