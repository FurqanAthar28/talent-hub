"use client";

/**
 * "My network" page, with 4 tabs:
 *   Discover    -> everyone I could connect with
 *   Connections -> people I'm already connected to
 *   Received    -> requests waiting for MY answer
 *   Sent        -> requests I sent
 *
 * ONE ACTION AT A TIME
 * While one button is working (connect, accept, message...), every action
 * button is switched off. `busyAction` remembers which one is running, for
 * example "accept-12", so only THAT button says "Accepting...".
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, MapPin, Send, UserPlus, Users } from "lucide-react";

import { errorText } from "../../api/client";
import { Avatar, Badge, EmptyState, Notice, Page, Panel, Tabs, ui } from "../../components/ui";
import { MESSAGES } from "../../config/messages";
import { ROUTES } from "../../config/routes";
import { useUiContent } from "../../hooks/useUiContent";
import {
  fetchNetworkData,
  sendConnectionInvite,
  updateConnectionRequest,
  type ConnectionRequest,
  type ConnectionUser,
} from "../../services/connections";
import { startConversation } from "../../services/messages";
import { isAdmin, useCurrentUser } from "../CurrentUserContext";
import styles from "./connections.module.css";

type Tab = "discover" | "connections" | "received" | "sent";
type RequestAction = "accept" | "reject";
type TextFn = (key: string, fallback: string) => string;

const TABS: Tab[] = ["discover", "connections", "received", "sent"];

// How many invitations to preview on the other tabs.
const INVITATION_PREVIEW_COUNT = 2;

// ====================== SMALL HELPERS ======================

/** The words and color for a relationship, e.g. "Request sent" in amber. */
function statusBadge(status: string, text: TextFn) {
  switch (status) {
    case "connected":
    case "accepted":
      return <Badge tone="success">{text("connectionStatusConnected", "Connected")}</Badge>;
    case "pending":
      return <Badge tone="warning">{text("connectionStatusPending", "Pending")}</Badge>;
    case "rejected":
      return <Badge tone="neutral">{text("connectionStatusDeclined", "Declined")}</Badge>;
    case "sent_pending":
      return <Badge tone="warning">{text("connectionStatusRequestSent", "Request sent")}</Badge>;
    case "received_pending":
      return <Badge tone="accent">{text("connectionStatusAwaitingResponse", "Wants to connect")}</Badge>;
    default:
      return null;
  }
}

/** "Mar 3, 3:45 PM" */
function formatRequestTime(createdAt: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

/** Does this person match the search box? */
function matchesSearch(user: ConnectionUser, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  return [user.fullName, user.email, user.headline, user.location]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

/** Turn a request I accepted into a "connection" row for the sender. */
function senderAsConnection(request: ConnectionRequest): ConnectionUser {
  return {
    id: request.sender,
    fullName: request.sender_name,
    email: request.sender_email,
    headline: request.sender_headline,
    location: request.sender_location,
    connectionStatus: "connected",
    requestId: null,
    requestStatus: "accepted",
  };
}

// ====================== SMALL COMPONENTS ======================

/** Accept / Ignore buttons for a request someone sent me. */
function ReceivedRequestButtons({
  requestId,
  busyAction,
  text,
  onAction,
}: {
  requestId: number;
  busyAction: string;
  text: TextFn;
  onAction: (requestId: number, action: RequestAction) => void;
}) {
  return (
    <>
      <button
        type="button"
        className="btn-outline btn-sm"
        onClick={() => onAction(requestId, "reject")}
        disabled={busyAction !== ""}
      >
        {busyAction === `reject-${requestId}`
          ? text("connectionIgnoring", "Ignoring...")
          : text("connectionIgnore", "Ignore")}
      </button>
      <button
        type="button"
        className="btn-primary btn-sm"
        onClick={() => onAction(requestId, "accept")}
        disabled={busyAction !== ""}
      >
        {busyAction === `accept-${requestId}`
          ? text("connectionAccepting", "Accepting...")
          : text("connectionAccept", "Accept")}
      </button>
    </>
  );
}

/** Name (links to their profile), headline and city. Shared by both row types. */
function PersonInfo({
  id,
  name,
  headline,
  location,
  extra,
  text,
}: {
  id: number;
  name: string;
  headline: string;
  location: string;
  extra?: React.ReactNode;
  text: TextFn;
}) {
  return (
    <div className={ui.rowMain}>
      <Link href={ROUTES.USER_PROFILE(id)} className={ui.rowTitle}>
        {name}
      </Link>
      <span className={ui.rowText}>{headline || text("professionalFallback", "Professional")}</span>
      <div className={styles.meta}>
        {location && (
          <span className={styles.metaItem}>
            <MapPin size={13} aria-hidden="true" />
            {location}
          </span>
        )}
        {extra}
      </div>
    </div>
  );
}

/** One person in Discover / Connections, with the right button for them. */
function PersonRow({
  user,
  busyAction,
  text,
  onConnect,
  onRequestAction,
  onMessage,
}: {
  user: ConnectionUser;
  busyAction: string;
  text: TextFn;
  onConnect: (userId: number) => void;
  onRequestAction: (requestId: number, action: RequestAction) => void;
  onMessage: (userId: number) => void;
}) {
  const isBusy = busyAction !== "";
  const status = user.connectionStatus;

  let actions: React.ReactNode;
  if (status === "connected") {
    actions = (
      <button type="button" className="btn-outline btn-sm" onClick={() => onMessage(user.id)} disabled={isBusy}>
        {busyAction === `message-${user.id}` ? "Opening..." : text("message", "Message")}
      </button>
    );
  } else if (status === "received_pending" && user.requestId) {
    actions = (
      <ReceivedRequestButtons requestId={user.requestId} busyAction={busyAction} text={text} onAction={onRequestAction} />
    );
  } else if (status === "sent_pending") {
    actions = (
      <button type="button" className="btn-outline btn-sm" disabled>
        {text("connectionStatusRequestSent", "Request sent")}
      </button>
    );
  } else {
    actions = (
      <button type="button" className="btn-primary btn-sm" onClick={() => onConnect(user.id)} disabled={isBusy}>
        {busyAction === `connect-${user.id}` ? text("connectionSending", "Sending...") : text("connectionConnect", "Connect")}
      </button>
    );
  }

  return (
    <li className={ui.row}>
      <Avatar name={user.fullName} size={44} />
      <PersonInfo
        id={user.id}
        name={user.fullName}
        headline={user.headline}
        location={user.location}
        // Only "Connected" needs a label: for pending requests the button already says it.
        extra={status === "connected" ? statusBadge(status, text) : null}
        text={text}
      />
      <div className={ui.rowActions}>{actions}</div>
    </li>
  );
}

/** One request (Invitations / Sent). */
function RequestRow({
  request,
  direction,
  busyAction,
  text,
  onAction,
}: {
  request: ConnectionRequest;
  direction: "received" | "sent";
  busyAction: string;
  text: TextFn;
  onAction: (requestId: number, action: RequestAction) => void;
}) {
  // A received request shows the SENDER; a sent one shows the RECEIVER.
  const isReceived = direction === "received";
  const person = isReceived
    ? { id: request.sender, name: request.sender_name, headline: request.sender_headline, location: request.sender_location }
    : { id: request.receiver, name: request.receiver_name, headline: request.receiver_headline, location: request.receiver_location };

  return (
    <li className={ui.row}>
      <Avatar name={person.name} size={44} />
      <PersonInfo
        {...person}
        text={text}
        extra={<span>{`${isReceived ? "Received" : "Sent"} ${formatRequestTime(request.created_at)}`}</span>}
      />
      <div className={ui.rowActions}>
        {isReceived && request.status === "pending" ? (
          <ReceivedRequestButtons requestId={request.id} busyAction={busyAction} text={text} onAction={onAction} />
        ) : (
          statusBadge(request.status, text)
        )}
      </div>
    </li>
  );
}

// ====================== THE PAGE ======================

export default function ConnectionsPage() {
  const router = useRouter();
  const text = useUiContent();
  const me = useCurrentUser(); // loaded once by the layout

  const [activeTab, setActiveTab] = useState<Tab>("discover");

  const [allUsers, setAllUsers] = useState<ConnectionUser[]>([]);
  const [connections, setConnections] = useState<ConnectionUser[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<ConnectionRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<ConnectionRequest[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(""); // "" = nothing running

  // First load.
  useEffect(() => {
    // Admins manage the network on the admin page instead.
    if (isAdmin(me)) {
      router.replace(ROUTES.ADMIN);
      return;
    }

    let pageIsOpen = true;

    async function loadPage() {
      try {
        const data = await fetchNetworkData();
        if (!pageIsOpen) return;

        setAllUsers(data.users);
        setConnections(data.connections);
        setReceivedRequests(data.receivedRequests);
        setSentRequests(data.sentRequests);
      } catch (error) {
        if (pageIsOpen) setNotice(errorText(error, MESSAGES.NETWORK.LOAD_FAILED));
      } finally {
        if (pageIsOpen) setIsLoading(false);
      }
    }

    void loadPage();

    return () => {
      pageIsOpen = false;
    };
  }, [router, me]);

  /** Change one person's status in the Discover list. */
  function updateUser(userId: number, changes: Partial<ConnectionUser>) {
    setAllUsers((users) => users.map((user) => (user.id === userId ? { ...user, ...changes } : user)));
  }

  async function handleConnect(userId: number) {
    if (busyAction) return;
    setBusyAction(`connect-${userId}`);
    setNotice("");

    try {
      const request = await sendConnectionInvite(userId);

      updateUser(userId, {
        connectionStatus: "sent_pending",
        requestId: request.id,
        requestStatus: "pending",
      });

      // Django may RE-OPEN an old request (same id), so replace it instead of
      // adding it twice.
      setSentRequests((requests) => [request, ...requests.filter((r) => r.id !== request.id)]);
      setNotice(text("connectionRequestSent", MESSAGES.NETWORK.REQUEST_SENT));
    } catch (error) {
      setNotice(errorText(error, MESSAGES.NETWORK.REQUEST_FAILED));
    } finally {
      setBusyAction("");
    }
  }

  async function handleRequestAction(requestId: number, action: RequestAction) {
    if (busyAction) return;
    setBusyAction(`${action}-${requestId}`);
    setNotice("");

    try {
      await updateConnectionRequest(requestId, action);

      const request = receivedRequests.find((r) => r.id === requestId);
      setReceivedRequests((requests) => requests.filter((r) => r.id !== requestId));

      if (request) {
        if (action === "accept") {
          const newConnection = senderAsConnection(request);
          setConnections((list) =>
            list.some((user) => user.id === newConnection.id) ? list : [newConnection, ...list]
          );
        }

        updateUser(request.sender, {
          connectionStatus: action === "accept" ? "connected" : "none",
          requestId: null,
          requestStatus: action === "accept" ? "accepted" : "rejected",
        });
      }

      setNotice(
        action === "accept"
          ? text("connectionRequestAccepted", MESSAGES.NETWORK.ACCEPTED)
          : text("connectionRequestIgnored", MESSAGES.NETWORK.IGNORED)
      );
    } catch (error) {
      setNotice(errorText(error, MESSAGES.NETWORK.UPDATE_FAILED));
    } finally {
      setBusyAction("");
    }
  }

  async function handleMessage(userId: number) {
    if (busyAction) return;
    setBusyAction(`message-${userId}`);
    setNotice("");

    try {
      const conversation = await startConversation(userId);
      router.push(`${ROUTES.MESSAGES}?conversation=${conversation.id}`);
      // (no setBusyAction("") here: we are leaving the page)
    } catch (error) {
      setNotice(errorText(error, MESSAGES.MESSAGES.START_FAILED));
      setBusyAction("");
    }
  }

  function tabLabel(tab: Tab) {
    if (tab === "discover") return text("connectionDiscover", "Discover");
    if (tab === "connections") return text("connections", "Connections");
    if (tab === "received") return text("connectionReceived", "Received");
    return text("connectionSent", "Sent");
  }

  const tabCounts: Record<Tab, number> = {
    discover: allUsers.length,
    connections: connections.length,
    received: receivedRequests.length,
    sent: sentRequests.length,
  };

  const filteredUsers = allUsers.filter((user) => matchesSearch(user, searchTerm));
  const filteredConnections = connections.filter((user) => matchesSearch(user, searchTerm));

  // On the Received tab show all invitations; elsewhere just a preview.
  const visibleRequests =
    activeTab === "received"
      ? receivedRequests
      : receivedRequests.slice(0, INVITATION_PREVIEW_COUNT);

  // The same props for every person row.
  const personRowProps = {
    busyAction,
    text,
    onConnect: handleConnect,
    onRequestAction: handleRequestAction,
    onMessage: handleMessage,
  };

  if (isLoading) {
    return (
      <main className={ui.page}>
        <p className="muted">{text("loading", "Loading...")}</p>
      </main>
    );
  }

  const tabItems = TABS.map((tab) => ({ id: tab, label: tabLabel(tab), count: tabCounts[tab] }));
  const showSearch = activeTab === "discover" || activeTab === "connections";
  const showInvitationPreview =
    receivedRequests.length > 0 && (activeTab === "discover" || activeTab === "connections");

  return (
    <Page
      title={text("myNetwork", "My network")}
      subtitle={text("connectionIntro", "Grow your network and answer invitations.")}
    >
      <div className={ui.stack}>
        {notice && <Notice>{notice}</Notice>}

        {/* Invitations come first: they're waiting for an answer. */}
        {showInvitationPreview && (
          <Panel
            flush
            title={
              receivedRequests.length === 1
                ? "1 person wants to connect"
                : `${receivedRequests.length} people want to connect`
            }
            actions={
              receivedRequests.length > INVITATION_PREVIEW_COUNT && (
                <button type="button" className="btn-outline btn-sm" onClick={() => setActiveTab("received")}>
                  See all
                </button>
              )
            }
          >
            <ul className={ui.list}>
              {visibleRequests.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  direction="received"
                  busyAction={busyAction}
                  text={text}
                  onAction={handleRequestAction}
                />
              ))}
            </ul>
          </Panel>
        )}

        <section className={`${ui.panel} ${ui.panelFlush}`} aria-label="People">
          <div className={styles.toolbar}>
            <Tabs items={tabItems} active={activeTab} onChange={setActiveTab} label="Network lists" />
            {showSearch && (
              <input
                type="search"
                className={styles.search}
                placeholder={text("connectionSearchPlaceholder", "Search by name or city")}
                aria-label="Search people"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            )}
          </div>

          {activeTab === "discover" &&
            (filteredUsers.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title={searchTerm ? "No one matches your search" : "No one to suggest yet"}
                text={searchTerm ? "Try a different name, job title or city." : "New members will show up here."}
              />
            ) : (
              <ul className={ui.list}>
                {filteredUsers.map((user) => (
                  <PersonRow key={user.id} user={user} {...personRowProps} />
                ))}
              </ul>
            ))}

          {activeTab === "connections" &&
            (filteredConnections.length === 0 ? (
              <EmptyState
                icon={Users}
                title={searchTerm ? "No connections match your search" : "No connections yet"}
                text="Connect with people from Discover. Once they accept, they appear here."
                action={
                  !searchTerm && (
                    <button type="button" className="btn-primary" onClick={() => setActiveTab("discover")}>
                      Find people
                    </button>
                  )
                }
              />
            ) : (
              <ul className={ui.list}>
                {filteredConnections.map((user) => (
                  <PersonRow key={user.id} user={user} {...personRowProps} />
                ))}
              </ul>
            ))}

          {activeTab === "received" &&
            (receivedRequests.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No invitations right now"
                text="When someone asks to connect, you can accept or ignore it here."
              />
            ) : (
              <ul className={ui.list}>
                {receivedRequests.map((request) => (
                  <RequestRow
                    key={request.id}
                    request={request}
                    direction="received"
                    busyAction={busyAction}
                    text={text}
                    onAction={handleRequestAction}
                  />
                ))}
              </ul>
            ))}

          {activeTab === "sent" &&
            (sentRequests.length === 0 ? (
              <EmptyState
                icon={Send}
                title="You haven't sent any requests"
                text="Requests you send from Discover appear here with their status."
              />
            ) : (
              <ul className={ui.list}>
                {sentRequests.map((request) => (
                  <RequestRow
                    key={request.id}
                    request={request}
                    direction="sent"
                    busyAction={busyAction}
                    text={text}
                    onAction={handleRequestAction}
                  />
                ))}
              </ul>
            ))}
        </section>
      </div>
    </Page>
  );
}
