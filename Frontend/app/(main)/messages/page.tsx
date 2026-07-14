"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "../../api/client";
import {
  fetchUiContent,
  getUiContentErrorMessage,
  type UiContent,
} from "../../api/ui-content";
import { LIVE_REFRESH_INTERVAL_MS } from "../../config/constants";
import {
  fetchConversationMessages,
  fetchConversations,
  sendConversationMessage,
  type Conversation,
  type Message,
} from "../../services/messages";

type AuthUser = {
  id: number;
  fullName: string;
  isStaff: boolean;
  role?: string;
};

// ====================== HELPER FUNCTIONS ======================
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatMessageTime(dateString: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function formatConversationTime(dateString: string | null): string {
  if (!dateString) return "";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(dateString));
}

function areConversationsEqual(current: Conversation[], next: Conversation[]) {
  if (current.length !== next.length) return false;

  return current.every((conversation, index) => {
    const nextConversation = next[index];

    return (
      conversation.id === nextConversation.id &&
      conversation.participantName === nextConversation.participantName &&
      conversation.participantHeadline === nextConversation.participantHeadline &&
      conversation.lastMessage === nextConversation.lastMessage &&
      conversation.lastMessageAt === nextConversation.lastMessageAt &&
      conversation.unreadCount === nextConversation.unreadCount &&
      conversation.updated_at === nextConversation.updated_at
    );
  });
}

function areMessagesEqual(current: Message[], next: Message[]) {
  if (current.length !== next.length) return false;

  return current.every((message, index) => {
    const nextMessage = next[index];

    return (
      message.id === nextMessage.id &&
      message.body === nextMessage.body &&
      message.isMine === nextMessage.isMine &&
      message.read_at === nextMessage.read_at &&
      message.created_at === nextMessage.created_at
    );
  });
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: number) => void;
}) {
  const preview = conversation.lastMessage || conversation.participantHeadline || conversation.participantEmail;

  return (
    <button
      type="button"
      className={`message-conversation ${isActive ? "active" : ""}`}
      onClick={() => onSelect(conversation.id)}
    >
      <span className="connection-avatar">
        {getInitials(conversation.participantName)}
      </span>

      <span className="message-conversation-main">
        <span className="message-conversation-title">
          {conversation.participantName}
        </span>
        <span className="message-conversation-preview">
          {preview}
        </span>
      </span>

      <span className="message-conversation-meta">
        <span>{formatConversationTime(conversation.lastMessageAt || conversation.updated_at)}</span>
        {conversation.unreadCount > 0 && (
          <strong>{conversation.unreadCount}</strong>
        )}
      </span>
    </button>
  );
}

function ParticipantPanel({ conversation }: { conversation: Conversation }) {
  return (
    <aside className="messages-profile-panel">
      <div className="messages-profile-card">
        <span className="messages-profile-avatar">
          {getInitials(conversation.participantName)}
        </span>
        <h2>{conversation.participantName}</h2>
        <p>{conversation.participantHeadline || "Professional"}</p>
        <span>{conversation.participantEmail}</span>

        <div className="messages-profile-actions">
          <Link href={`/profile/${conversation.participantId}`} className="btn-primary">
            View profile
          </Link>
          <Link href="/connections" className="btn-outline">
            Network
          </Link>
        </div>
      </div>

      <div className="messages-profile-card messages-context-card">
        <h3>Conversation</h3>
        <div>
          <span>Status</span>
          <strong>Active</strong>
        </div>
        <div>
          <span>Last activity</span>
          <strong>{formatConversationTime(conversation.lastMessageAt || conversation.updated_at) || "New"}</strong>
        </div>
      </div>
    </aside>
  );
}

function EmptyMessagesState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="messages-empty-state">
      <span>in</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  return (
    <div className={`message-bubble-row ${message.isMine ? "mine" : ""}`}>
      <div className="message-bubble">
        {!message.isMine && (
          <span className="message-sender-name">{message.senderName}</span>
        )}
        <p>{message.body}</p>
        <span className="message-time">{formatMessageTime(message.created_at)}</span>
      </div>
    </div>
  );
}

function MessageThreadHeader({ conversation }: { conversation: Conversation }) {
  return (
    <div className="message-thread-header">
      <div className="message-thread-person">
        <span className="connection-avatar">
          {getInitials(conversation.participantName)}
        </span>
        <div>
          <h3>{conversation.participantName}</h3>
          <p className="text-sm muted">
            {conversation.participantHeadline || conversation.participantEmail}
          </p>
        </div>
      </div>
      <Link href={`/profile/${conversation.participantId}`} className="btn-outline btn-sm">
        View profile
      </Link>
    </div>
  );
}

// ====================== MAIN PAGE ======================
export default function MessagesPage() {
  const router = useRouter();

  // State
  const [ui, setUi] = useState<UiContent>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [conversationQuery, setConversationQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Refs
  const activeConversationIdRef = useRef<number | null>(null);
  const messageListEndRef = useRef<HTMLDivElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);

  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;
  const filteredConversations = useMemo(() => {
    const query = conversationQuery.trim().toLowerCase();

    if (!query) return conversations;

    return conversations.filter((conversation) => {
      const searchable = [
        conversation.participantName,
        conversation.participantEmail,
        conversation.participantHeadline,
        conversation.lastMessage,
      ].join(" ").toLowerCase();

      return searchable.includes(query);
    });
  }, [conversationQuery, conversations]);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messageListEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Focus input field
  const focusInput = useCallback(() => {
    messageInputRef.current?.focus();
  }, []);

  // Load messages for a specific conversation
  const loadMessages = useCallback(async (
    uiContent: UiContent,
    conversationId: number,
    showLoading = true
  ) => {
    if (showLoading) setThreadLoading(true);

    try {
      const messageData = await fetchConversationMessages(uiContent, conversationId);
      setMessages(prev => areMessagesEqual(prev, messageData) ? prev : messageData);

      // Mark as read
      setConversations(prev => {
        let changed = false;

        const next = prev.map(conv => {
          if (conv.id !== conversationId || conv.unreadCount === 0) return conv;
          changed = true;
          return { ...conv, unreadCount: 0 };
        });

        return changed ? next : prev;
      });
    } catch (error) {
      console.error("Failed to load messages:", error);
      setNotice(uiContent.messageUnableToLoad || "Failed to load messages");
    } finally {
      if (showLoading) setThreadLoading(false);
    }
  }, []);

  // Load everything when page opens
  const loadInitialData = useCallback(async () => {
    try {
      const uiContent = await fetchUiContent();
      setUi(uiContent);

      const meRes = await apiFetch(uiContent.apiAccountsMe);
      if (!meRes.ok) {
        router.replace(uiContent.routeSignin);
        return;
      }

      const currentUser = (await meRes.json()) as AuthUser;

      if (currentUser.isStaff || currentUser.role === "admin") {
        router.replace(uiContent.routeAdmin);
        return;
      }

      const conversationList = await fetchConversations(uiContent);
      setConversations(conversationList);

      // Select conversation from URL or first one
      const urlConversationId = Number(new URLSearchParams(window.location.search).get("conversation"));
      const firstId = conversationList[0]?.id || null;
      const selectedId = conversationList.some(c => c.id === urlConversationId)
        ? urlConversationId
        : firstId;

      setActiveConversationId(selectedId);

      if (selectedId) {
        await loadMessages(uiContent, selectedId);
      }
    } catch (error) {
      console.error(error);
      setNotice(getUiContentErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [router, loadMessages]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadInitialData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadInitialData]);

  // Auto scroll when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto focus input when conversation changes
  useEffect(() => {
    if (activeConversationId) focusInput();
  }, [activeConversationId, focusInput]);

  // Live refresh (polling)
  useEffect(() => {
    if (!ui.apiConversations || isLoading) return;

    let isCancelled = false;

    const refresh = async () => {
      if (document.visibilityState === "hidden") return;

      try {
        const freshConversations = await fetchConversations(ui);
        if (isCancelled) return;
        setConversations(prev => areConversationsEqual(prev, freshConversations) ? prev : freshConversations);

        const currentId = activeConversationIdRef.current || freshConversations[0]?.id || null;

        if (currentId) {
          await loadMessages(ui, currentId, false);
        }
      } catch (error) {
        console.error("Live refresh failed:", error);
      }
    };

    const interval = setInterval(refresh, LIVE_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      isCancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [ui, isLoading, loadMessages]);

  // Update ref when active conversation changes
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // Select a conversation
  const selectConversation = async (conversationId: number) => {
    if (conversationId === activeConversationId) {
      focusInput();
      return;
    }

    setActiveConversationId(conversationId);
    await loadMessages(ui, conversationId);
  };

  // Send a new message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!activeConversationId || isSending || !trimmed) return;

    setIsSending(true);
    setNotice("");

    try {
      const newMessage = await sendConversationMessage(ui, activeConversationId, trimmed);

      setMessages(prev => [...prev, newMessage]);

      setConversations(prev =>
        prev.map(conv =>
          conv.id === activeConversationId
            ? {
                ...conv,
                lastMessage: newMessage.body,
                lastMessageAt: newMessage.created_at,
                updated_at: newMessage.created_at,
              }
            : conv
        )
      );

      setDraft("");
      focusInput();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : ui.messageUnableToSend);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="app-main">
        <div className="container">{ui.loading || "Loading..."}</div>
      </div>
    );
  }

  return (
    <div className="app-main">
      <div className="container">
        <div className="messages-page-header">
          <div>
            <h1>{ui.messages || "Messaging"}</h1>
            <p className="muted">{ui.messageIntro}</p>
          </div>
        </div>

        {notice && <div className="notice-banner">{notice}</div>}

        <div className="messages-layout">
          {/* Sidebar - Conversation List */}
          <aside className="messages-sidebar">
            <div className="messages-sidebar-header">
              <h2>{ui.messageInbox || "Inbox"}</h2>
              <span>{conversations.length}</span>
            </div>

            <div className="messages-search">
              <input
                type="search"
                value={conversationQuery}
                onChange={(event) => setConversationQuery(event.target.value)}
                placeholder="Search messages"
                aria-label="Search messages"
              />
            </div>

            <div className="messages-conversation-list">
              {filteredConversations.length === 0 ? (
                <EmptyMessagesState
                  title={conversationQuery ? "No conversations found" : "No conversations yet"}
                  description={conversationQuery ? "Try another name, email, or message." : ui.messageNoConversations || "Start a conversation from your network."}
                />
              ) : (
                filteredConversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isActive={activeConversationId === conv.id}
                    onSelect={selectConversation}
                  />
                ))
              )}
            </div>
          </aside>

          {/* Main Chat Area */}
          <main className="messages-thread">
            {activeConversation ? (
              <>
                <MessageThreadHeader conversation={activeConversation} />

                <div className="message-list">
                  {threadLoading ? (
                    <p className="text-center muted">Loading messages...</p>
                  ) : messages.length === 0 ? (
                    <EmptyMessagesState
                      title="No messages yet"
                      description={ui.messageEmptyThread || "Send a message to start the conversation."}
                    />
                  ) : (
                    messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
                  )}
                  <div ref={messageListEndRef} />
                </div>

                <form className="message-compose" onSubmit={handleSendMessage}>
                  <textarea
                    ref={messageInputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder={ui.messagePlaceholder}
                    disabled={isSending}
                    rows={1}
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isSending || !draft.trim()}
                  >
                    {isSending ? ui.messageSending : ui.messageSend}
                  </button>
                </form>
              </>
            ) : (
              <EmptyMessagesState
                title="Select a conversation"
                description={ui.messageSelectConversation || "Choose a message from your inbox to continue."}
              />
            )}
          </main>

          {activeConversation ? (
            <ParticipantPanel conversation={activeConversation} />
          ) : (
            <aside className="messages-profile-panel">
              <EmptyMessagesState
                title="Conversation details"
                description="Select a conversation to see profile context."
              />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
