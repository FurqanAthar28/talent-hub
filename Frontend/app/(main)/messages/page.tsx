"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchUiContent, type UiContent } from "../../api/ui-content";
import {
  fetchConversationMessages,
  fetchConversations,
  sendConversationMessage,
  type Conversation,
  type Message,
} from "../../services/messages";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

const LIVE_REFRESH_INTERVAL_MS = 3000;

export default function MessagesPage() {
  const [uiContent, setUiContent] = useState<UiContent>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const activeConversationIdRef = useRef<number | null>(null);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ||
    null;

  const loadMessages = useCallback(
    async (
      content: UiContent,
      conversationId: number,
      options: { showLoading?: boolean; showErrors?: boolean } = {}
    ) => {
      const { showLoading = true, showErrors = true } = options;

      if (showLoading) {
        setThreadLoading(true);
        setNotice("");
      }

      try {
        const messageData = await fetchConversationMessages(content, conversationId);
        setMessages(messageData);
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? { ...conversation, unreadCount: 0 }
              : conversation
          )
        );
      } catch (error) {
        console.error("Failed to load conversation messages:", error);
        if (showErrors) {
          setNotice(content.messageUnableToLoad);
        }
      } finally {
        if (showLoading) {
          setThreadLoading(false);
        }
      }
    },
    []
  );

  const loadConversations = useCallback(async () => {
    try {
      const content = await fetchUiContent();
      setUiContent(content);

      const conversationData = await fetchConversations(content);
      setConversations(conversationData);

      const requestedId =
        typeof window !== "undefined"
          ? Number(new URLSearchParams(window.location.search).get("conversation"))
          : 0;
      const firstConversationId = conversationData[0]?.id || null;
      const selectedId = conversationData.some(
        (conversation) => conversation.id === requestedId
      )
        ? requestedId
        : firstConversationId;

      setActiveConversationId(selectedId);

      if (selectedId) {
        await loadMessages(content, selectedId);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
      setNotice(uiContent.messageUnableToLoad);
    } finally {
      setLoading(false);
    }
  }, [loadMessages, uiContent.messageUnableToLoad]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (!uiContent.apiConversations || loading) return;

    let stopped = false;

    async function refreshLiveMessages() {
      if (document.visibilityState === "hidden") return;

      try {
        const conversationData = await fetchConversations(uiContent);
        if (stopped) return;

        setConversations(conversationData);

        const selectedId =
          activeConversationIdRef.current || conversationData[0]?.id || null;

        if (!activeConversationIdRef.current && selectedId) {
          setActiveConversationId(selectedId);
          activeConversationIdRef.current = selectedId;
        }

        if (selectedId) {
          await loadMessages(uiContent, selectedId, {
            showLoading: false,
            showErrors: false,
          });
        }
      } catch (error) {
        console.error("Failed to refresh live messages:", error);
      }
    }

    const intervalId = window.setInterval(
      refreshLiveMessages,
      LIVE_REFRESH_INTERVAL_MS
    );
    window.addEventListener("focus", refreshLiveMessages);
    document.addEventListener("visibilitychange", refreshLiveMessages);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshLiveMessages);
      document.removeEventListener("visibilitychange", refreshLiveMessages);
    };
  }, [loadMessages, loading, uiContent]);

  async function selectConversation(conversationId: number) {
    setActiveConversationId(conversationId);
    await loadMessages(uiContent, conversationId);
  }

  async function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeConversationId || sending || !draft.trim()) return;

    setSending(true);
    setNotice("");

    try {
      const message = await sendConversationMessage(
        uiContent,
        activeConversationId,
        draft
      );
      setMessages((current) => [...current, message]);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === activeConversationId
            ? {
                ...conversation,
                lastMessage: message.body,
                lastMessageAt: message.created_at,
                updated_at: message.created_at,
              }
            : conversation
        )
      );
      setDraft("");
    } catch (error) {
      console.error("Failed to send message:", error);
      setNotice(error instanceof Error ? error.message : uiContent.messageUnableToSend);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="app-main">
        <div className="container">{uiContent.loading}</div>
      </div>
    );
  }

  return (
    <div className="app-main">
      <div className="container">
        <div className="network-header">
          <div>
            <h1 className="text-lg mb-1">{uiContent.messages}</h1>
            <p className="muted">{uiContent.messageIntro}</p>
          </div>
        </div>

        {notice && <div className="notice-banner">{notice}</div>}

        <div className="messages-layout">
          <aside className="messages-sidebar card">
            <div className="card-header">
              <h3>{uiContent.messageInbox}</h3>
            </div>

            <div className="messages-conversation-list">
              {conversations.length === 0 ? (
                <div className="empty-state">
                  <p>{uiContent.messageNoConversations}</p>
                </div>
              ) : (
                conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    className={`message-conversation ${
                      activeConversationId === conversation.id ? "active" : ""
                    }`}
                    onClick={() => selectConversation(conversation.id)}
                  >
                    <span className="connection-avatar">
                      {getInitials(conversation.participantName)}
                    </span>
                    <span className="message-conversation-main">
                      <span className="message-conversation-title">
                        {conversation.participantName}
                      </span>
                      <span className="message-conversation-preview">
                        {conversation.lastMessage || conversation.participantHeadline}
                      </span>
                    </span>
                    {conversation.unreadCount > 0 && (
                      <span className="status-badge status-warning">
                        {conversation.unreadCount} {uiContent.messageUnread}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </aside>

          <main className="messages-thread card">
            {activeConversation ? (
              <>
                <div className="card-header message-thread-header">
                  <div>
                    <h3>{activeConversation.participantName}</h3>
                    <p className="text-sm muted">
                      {activeConversation.participantHeadline ||
                        activeConversation.participantEmail}
                    </p>
                  </div>
                </div>

                <div className="message-list">
                  {threadLoading ? (
                    <p className="text-center muted text-sm">{uiContent.loading}</p>
                  ) : messages.length === 0 ? (
                    <div className="empty-state">
                      <p>{uiContent.messageEmptyThread}</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`message-bubble-row ${message.isMine ? "mine" : ""}`}
                      >
                        <div className="message-bubble">
                          <p>{message.body}</p>
                          <span>{formatMessageTime(message.created_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form className="message-compose" onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={uiContent.messagePlaceholder}
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={sending || !draft.trim()}
                  >
                    {sending ? uiContent.messageSending : uiContent.messageSend}
                  </button>
                </form>
              </>
            ) : (
              <div className="empty-state">
                <p>{uiContent.messageSelectConversation}</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
