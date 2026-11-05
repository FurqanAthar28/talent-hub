"use client";

/**
 * Messages page: my chats on the left, the open chat in the middle,
 * and details about the other person on the right.
 *
 * LIVE UPDATES
 * Every few seconds (LIVE_REFRESH_INTERVAL_MS) we ask Django for new
 * messages, but only while this browser tab is visible.
 *
 * TWO TRAPS THIS PAGE AVOIDS
 * 1. Switching chats: an answer for chat A can arrive after you opened
 *    chat B. We check "is this still the open chat?" before showing it.
 * 2. Sending: a background refresh that started BEFORE you sent a message
 *    doesn't contain it yet. We throw such out-of-date answers away, so
 *    your new message never flickers out of view.
 */

import Link from "next/link";
import { ArrowLeft, MessageSquare, SendHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { errorText } from "../../api/client";
import { Avatar, EmptyState, Notice, Page } from "../../components/ui";
import { LIVE_REFRESH_INTERVAL_MS } from "../../config/constants";
import { MESSAGES } from "../../config/messages";
import { ROUTES } from "../../config/routes";
import { useUiContent } from "../../hooks/useUiContent";
import {
  fetchConversationMessages,
  fetchConversations,
  sendConversationMessage,
  type Conversation,
  type Message,
} from "../../services/messages";
import { isAdmin, useCurrentUser } from "../CurrentUserContext";
import styles from "./messages.module.css";

// ====================== HELPER FUNCTIONS ======================
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

/** One chat in the list on the left. */
function ConversationItem({
  conversation,
  isActive,
  onSelect,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: number) => void;
}) {
  const preview = conversation.lastMessage || conversation.participantHeadline || "Say hello";
  const unread = conversation.unreadCount > 0;

  return (
    <li>
      <button
        type="button"
        className={[styles.conversation, isActive ? styles.conversationActive : "", unread ? styles.unread : ""].join(" ")}
        aria-current={isActive ? "true" : undefined}
        onClick={() => onSelect(conversation.id)}
      >
        <Avatar name={conversation.participantName} size={42} />
        <span className={styles.conversationMain}>
          <span className={styles.conversationTop}>
            <span className={styles.conversationName}>{conversation.participantName}</span>
            <span className={styles.conversationTime}>
              {formatConversationTime(conversation.lastMessageAt || conversation.updated_at)}
            </span>
          </span>
          <span className={styles.conversationBottom}>
            <span className={styles.conversationPreview}>{preview}</span>
            {unread && (
              <span className={styles.unreadCount} aria-label={`${conversation.unreadCount} unread`}>
                {conversation.unreadCount}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

/** About the person, on the right (big screens only). */
function ParticipantPanel({ conversation }: { conversation: Conversation }) {
  return (
    <aside className={styles.details} aria-label="About this person">
      <Avatar name={conversation.participantName} size={72} />
      <p className={styles.detailsName}>{conversation.participantName}</p>
      <p className={styles.detailsHeadline}>{conversation.participantHeadline || "Professional"}</p>
      <div className={styles.detailsActions}>
        <Link href={ROUTES.USER_PROFILE(conversation.participantId)} className="btn-outline">
          View profile
        </Link>
      </div>
    </aside>
  );
}

/** One message. Mine are purple, on the right. */
function MessageBubble({ message }: { message: Message }) {
  return (
    <div className={`${styles.bubbleRow} ${message.isMine ? styles.bubbleRowMine : ""}`}>
      <div className={`${styles.bubble} ${message.isMine ? styles.bubbleMine : ""}`}>
        {message.body}
        <time className={styles.bubbleTime} dateTime={message.created_at}>
          {formatMessageTime(message.created_at)}
        </time>
      </div>
    </div>
  );
}

// ====================== MAIN PAGE ======================
export default function MessagesPage() {
  const router = useRouter();
  const text = useUiContent();
  const me = useCurrentUser(); // loaded once by the layout

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [conversationQuery, setConversationQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  // Phones show one part at a time: the chat list, or the open chat.
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");

  // Refs hold values that the background refresh reads. Changing a ref
  // does NOT redraw the page, and the refresh always sees the newest value.
  const activeIdRef = useRef<number | null>(null); // the chat that is open right now
  const lastSendTimeRef = useRef(0); // when I last sent a message (trap 2)

  const messageListRef = useRef<HTMLDivElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  // The search box above the chat list filters chats in the browser.
  const filteredConversations = useMemo(() => {
    const query = conversationQuery.trim().toLowerCase();
    if (!query) return conversations;

    return conversations.filter((conversation) =>
      [
        conversation.participantName,
        conversation.participantEmail,
        conversation.participantHeadline,
        conversation.lastMessage,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [conversationQuery, conversations]);

  /**
   * Load the messages of one chat.
   * quiet = true for the background refresh (no "Loading..." and no error banner).
   */
  const loadMessages = useCallback(async (conversationId: number, quiet = false) => {
    const startedAt = Date.now();
    if (!quiet) setThreadLoading(true);

    try {
      const list = await fetchConversationMessages(conversationId);

      // Trap 1: the user opened another chat while we waited.
      if (activeIdRef.current !== conversationId) return;
      // Trap 2: I sent a message after this request started, so this list is old.
      if (lastSendTimeRef.current > startedAt) return;

      setMessages((previous) => (areMessagesEqual(previous, list) ? previous : list));

      // Django marked these as read, so clear this chat's unread number too.
      setConversations((previous) =>
        previous.some((c) => c.id === conversationId && c.unreadCount > 0)
          ? previous.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
          : previous
      );
    } catch (error) {
      if (quiet) {
        console.warn("Live refresh failed:", error);
      } else {
        setNotice(errorText(error, MESSAGES.MESSAGES.LOAD_FAILED));
      }
    } finally {
      if (!quiet && activeIdRef.current === conversationId) setThreadLoading(false);
    }
  }, []);

  /** Open a chat: remember it, empty the old messages, load the new ones. */
  const openConversation = useCallback(
    (conversationId: number) => {
      activeIdRef.current = conversationId; // the ref changes right away...
      setActiveId(conversationId); // ...the state on the next redraw
      setMessages([]);
      void loadMessages(conversationId);
    },
    [loadMessages]
  );

  // First load: get my chats and open one.
  useEffect(() => {
    // Admins read chats on the admin page instead.
    if (isAdmin(me)) {
      router.replace(ROUTES.ADMIN);
      return;
    }

    let pageIsOpen = true;

    async function loadPage() {
      try {
        const list = await fetchConversations();
        if (!pageIsOpen) return;
        setConversations(list);

        // Open the chat named in the address ("?conversation=5"), or the newest one.
        const wantedId = Number(new URLSearchParams(window.location.search).get("conversation"));
        const firstId = list.some((c) => c.id === wantedId) ? wantedId : list[0]?.id;
        if (firstId) openConversation(firstId);
      } catch (error) {
        if (pageIsOpen) setNotice(errorText(error, MESSAGES.MESSAGES.LOAD_FAILED));
      } finally {
        if (pageIsOpen) setIsLoading(false);
      }
    }

    void loadPage();

    return () => {
      pageIsOpen = false;
    };
  }, [router, openConversation, me]);

  // Live refresh: every few seconds, and when you come back to this tab.
  useEffect(() => {
    if (isLoading) return; // wait for the first load

    let pageIsOpen = true;
    let refreshRunning = false; // never run two refreshes at the same time

    async function refresh() {
      if (document.visibilityState === "hidden" || refreshRunning) return;
      refreshRunning = true;

      try {
        const startedAt = Date.now();
        const freshList = await fetchConversations();

        if (pageIsOpen && lastSendTimeRef.current < startedAt) {
          setConversations((previous) =>
            areConversationsEqual(previous, freshList) ? previous : freshList
          );
        }

        const openId = activeIdRef.current;
        if (pageIsOpen && openId) await loadMessages(openId, true);
      } catch (error) {
        console.warn("Live refresh failed:", error);
      } finally {
        refreshRunning = false;
      }
    }

    const timer = window.setInterval(refresh, LIVE_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      pageIsOpen = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [isLoading, loadMessages]);

  // Scroll to the newest message whenever the list changes.
  useEffect(() => {
    // Scroll the MESSAGE BOX (not the whole page) to the newest message.
    const list = messageListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  // Put the cursor in the message box when a chat opens.
  useEffect(() => {
    if (activeId) messageInputRef.current?.focus();
  }, [activeId]);

  function selectConversation(conversationId: number) {
    setMobileView("thread");
    if (conversationId === activeId) {
      messageInputRef.current?.focus();
      return;
    }
    setNotice("");
    openConversation(conversationId);
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = draft.trim();
    const conversationId = activeId;
    if (!conversationId || isSending || !body) return; // nothing to send, or already sending

    setIsSending(true);
    setNotice("");

    try {
      const newMessage = await sendConversationMessage(conversationId, body);
      lastSendTimeRef.current = Date.now(); // trap 2: older refreshes are now out of date

      if (activeIdRef.current === conversationId) {
        setMessages((previous) => [...previous, newMessage]);
      }

      // Show it as the chat's last message, and move the chat to the top.
      setConversations((previous) => {
        const chat = previous.find((c) => c.id === conversationId);
        if (!chat) return previous;

        const updated = {
          ...chat,
          lastMessage: newMessage.body,
          lastMessageAt: newMessage.created_at,
          updated_at: newMessage.created_at,
        };
        return [updated, ...previous.filter((c) => c.id !== conversationId)];
      });

      setDraft("");
    } catch (error) {
      setNotice(errorText(error, MESSAGES.MESSAGES.SEND_FAILED));
    } finally {
      setIsSending(false);
      messageInputRef.current?.focus();
    }
  }

  if (isLoading) {
    return (
      <Page title={text("messages", "Messages")}>
        <p className="muted">{text("loading", "Loading...")}</p>
      </Page>
    );
  }

  return (
    <Page
      title={text("messages", "Messages")}
      subtitle={text("messageIntro", "Chat with the people in your network.")}
    >
      {notice && <Notice tone="error">{notice}</Notice>}

      <div className={styles.layout} data-view={mobileView}>
        {/* ---------- Left: my chats ---------- */}
        <aside className={styles.sidebar} aria-label={text("messageInbox", "Inbox")}>
          <div className={styles.sidebarHeader}>
            <input
              type="search"
              className={styles.search}
              value={conversationQuery}
              onChange={(event) => setConversationQuery(event.target.value)}
              placeholder="Search messages"
              aria-label="Search messages"
            />
          </div>

          {filteredConversations.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={conversationQuery ? "No chats match your search" : "No conversations yet"}
              text={
                conversationQuery
                  ? "Try another name or word."
                  : text("messageNoConversations", "Start a chat from a connection's profile.")
              }
              action={
                !conversationQuery && (
                  <Link href={ROUTES.CONNECTIONS} className="btn-primary">
                    Go to my network
                  </Link>
                )
              }
            />
          ) : (
            <ul className={styles.conversationList}>
              {filteredConversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isActive={activeId === conversation.id}
                  onSelect={selectConversation}
                />
              ))}
            </ul>
          )}
        </aside>

        {/* ---------- Middle: the open chat ---------- */}
        <section className={styles.thread} aria-label="Conversation">
          {activeConversation ? (
            <>
              <header className={styles.threadHeader}>
                <button
                  type="button"
                  className={styles.backButton}
                  onClick={() => setMobileView("list")}
                  aria-label="Back to all chats"
                >
                  <ArrowLeft size={20} aria-hidden="true" />
                </button>
                <Avatar name={activeConversation.participantName} size={40} />
                <div className={styles.threadPerson}>
                  <Link
                    href={ROUTES.USER_PROFILE(activeConversation.participantId)}
                    className={styles.threadName}
                  >
                    {activeConversation.participantName}
                  </Link>
                  <span className={styles.threadHeadline}>
                    {activeConversation.participantHeadline || "Professional"}
                  </span>
                </div>
              </header>

              <div className={styles.messageList} ref={messageListRef} aria-live="polite">
                {threadLoading ? (
                  <p className="muted">Loading messages...</p>
                ) : messages.length === 0 ? (
                  <div className={styles.centered}>
                    <EmptyState
                      icon={MessageSquare}
                      title="No messages yet"
                      text={text("messageEmptyThread", "Send a message to start the conversation.")}
                    />
                  </div>
                ) : (
                  messages.map((message) => <MessageBubble key={message.id} message={message} />)
                )}
              </div>

              <form className={styles.composer} onSubmit={handleSendMessage}>
                <textarea
                  ref={messageInputRef}
                  className={styles.composerInput}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    // Enter sends. Shift+Enter makes a new line.
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={text("messagePlaceholder", "Write a message...")}
                  aria-label="Message"
                  rows={1}
                />
                <button type="submit" className={styles.sendButton} disabled={isSending || !draft.trim()}>
                  <SendHorizontal size={16} aria-hidden="true" />
                  {isSending ? text("messageSending", "Sending...") : text("messageSend", "Send")}
                </button>
              </form>
            </>
          ) : (
            <div className={styles.centered}>
              <EmptyState
                icon={MessageSquare}
                title="Pick a conversation"
                text={text("messageSelectConversation", "Choose a chat on the left to read and reply.")}
              />
            </div>
          )}
        </section>

        {/* ---------- Right: about the person ---------- */}
        {activeConversation && <ParticipantPanel conversation={activeConversation} />}
      </div>
    </Page>
  );
}
