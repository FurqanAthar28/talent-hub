"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchUiContent,
  getUiContentErrorMessage,
  type UiContent,
} from "../../api/ui-content";
import {
  fetchAuthenticatedUser,
  fetchNetworkData,
  readApiMessage,
  sendConnectionInvite,
  updateConnectionRequest,
  type ConnectionRequest,
  type ConnectionUser,
} from "../../services/connections";
import { startConversation } from "../../services/messages";

// ====================== TYPES ======================
type Tab = "discover" | "connections" | "received" | "sent";

// ====================== HELPER FUNCTIONS ======================
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getStatusText(status: string, ui: UiContent): string {
  const statusMap: Record<string, string> = {
    connected: ui.connectionStatusConnected,
    pending: ui.connectionStatusPending,
    accepted: ui.connectionStatusAccepted,
    rejected: ui.connectionStatusDeclined,
    sent_pending: ui.connectionStatusRequestSent,
    received_pending: ui.connectionStatusAwaitingResponse,
  };
  return statusMap[status] || ui.connectionStatusNotConnected || "Not Connected";
}

function getStatusClass(status: string): string {
  if (status.includes("connected") || status.includes("accepted")) return "status-badge status-success";
  if (status.includes("rejected")) return "status-badge status-muted";
  if (status.includes("pending")) return "status-badge status-warning";
  return "status-badge";
}

function formatRequestTime(createdAt: string): string {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(new Date(createdAt));
}

function getRequestUser(request: ConnectionRequest, direction: "sender" | "receiver"): ConnectionUser {
  const isSender = direction === "sender";

  return {
    id: isSender ? request.sender : request.receiver,
    fullName: isSender ? request.sender_name : request.receiver_name,
    email: isSender ? request.sender_email : request.receiver_email,
    headline: isSender ? request.sender_headline : request.receiver_headline,
    location: isSender ? request.sender_location : request.receiver_location,
    connectionStatus: "connected",
    requestId: null,
    requestStatus: "accepted",
  };
}

function getTabLabel(tab: Tab, ui: UiContent) {
  if (tab === "discover") return ui.connectionDiscover || "Discover";
  if (tab === "connections") return ui.connections || "Connections";
  if (tab === "received") return ui.connectionReceived || "Received";
  return ui.connectionSent || "Sent";
}

function EmptyNetworkState({ message }: { message: string }) {
  return (
    <div className="network-empty">
      <div className="network-empty-mark">+</div>
      <p>{message}</p>
    </div>
  );
}

// ====================== REUSABLE COMPONENTS ======================

// Card for users in Discover and Connections tab
const UserCard = memo(function UserCard({
  user,
  ui,
  actionLoadingKey,
  onConnect,
  onRequestAction,
  onMessage,
  onViewProfile,
}: {
  user: ConnectionUser;
  ui: UiContent;
  actionLoadingKey: string;
  onConnect: (id: number) => void;
  onRequestAction: (id: number, action: "accept" | "reject") => void;
  onMessage: (id: number) => void;
  onViewProfile: (id: number) => void;
}) {
  const isActionLoading = actionLoadingKey !== "";
  const isPending = user.connectionStatus === "sent_pending";
  const isConnected = user.connectionStatus === "connected";

  return (
    <article className="connection-card">
      <div className="connection-top">
        <div className="connection-avatar">{getInitials(user.fullName)}</div>

        <div className="connection-info">
          <div className="connection-name-row">
            <button
              type="button"
              className="connection-name-link"
              onClick={() => onViewProfile(user.id)}
            >
              {user.fullName}
            </button>
            <span className={getStatusClass(user.connectionStatus)}>
              {getStatusText(user.connectionStatus, ui)}
            </span>
          </div>
          <div className="connection-headline">{user.headline || ui.professionalFallback || "Professional"}</div>
          {user.location && <div className="connection-location">{user.location}</div>}
        </div>
      </div>

      <div className="connection-actions">
        {isConnected ? (
          <>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => onViewProfile(user.id)}
            >
              {ui.viewProfile || "View"}
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => onMessage(user.id)}
              disabled={isActionLoading}
            >
              {ui.message || "Message"}
            </button>
          </>
        ) : user.connectionStatus === "received_pending" && user.requestId ? (
          <ReceivedRequestButtons
            requestId={user.requestId}
            ui={ui}
            actionLoadingKey={actionLoadingKey}
            onAction={onRequestAction}
          />
        ) : (
          <>
            {isPending ? (
              <button type="button" className="btn-outline btn-sm" disabled>
                {ui.connectionStatusRequestSent || "Pending"}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => onConnect(user.id)}
                disabled={isActionLoading}
              >
                {actionLoadingKey === `connect-${user.id}` ? ui.connectionSending : ui.connectionConnect || "Connect"}
              </button>
            )}
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => onViewProfile(user.id)}
          >
            {ui.viewProfile || "View"}
          </button>
          </>
        )}
      </div>
    </article>
  );
});

// Buttons for accepting/rejecting requests (reused)
function ReceivedRequestButtons({
  requestId,
  ui,
  actionLoadingKey,
  onAction,
}: {
  requestId: number;
  ui: UiContent;
  actionLoadingKey: string;
  onAction: (id: number, action: "accept" | "reject") => void;
}) {
  const acceptKey = `accept-${requestId}`;
  const rejectKey = `reject-${requestId}`;
  const isActionLoading =
    actionLoadingKey === acceptKey ||
    actionLoadingKey === rejectKey ||
    actionLoadingKey === `request-${requestId}`;

  return (
    <>
      <button
        type="button"
        className="btn-primary btn-sm"
        onClick={() => onAction(requestId, "accept")}
        disabled={isActionLoading}
      >
        {actionLoadingKey === acceptKey ? ui.connectionAccepting : ui.connectionAccept || "Accept"}
      </button>
      <button
        type="button"
        className="btn-outline btn-sm"
        onClick={() => onAction(requestId, "reject")}
        disabled={isActionLoading}
      >
        {actionLoadingKey === rejectKey ? ui.connectionIgnoring : ui.connectionIgnore || "Ignore"}
      </button>
    </>
  );
}

// Card for Received/Sent Requests
const RequestCard = memo(function RequestCard({
  request,
  direction,
  ui,
  actionLoadingKey,
  onAction,
}: {
  request: ConnectionRequest;
  direction: "received" | "sent";
  ui: UiContent;
  actionLoadingKey: string;
  onAction: (id: number, action: "accept" | "reject") => void;
}) {
  const isReceived = direction === "received";
  const name = isReceived ? request.sender_name : request.receiver_name;
  const headline = isReceived ? request.sender_headline : request.receiver_headline;
  const location = isReceived ? request.sender_location : request.receiver_location;

  return (
    <article className="connection-card connection-request-card">
      <div className="connection-top">
        <div className="connection-avatar">{getInitials(name)}</div>
        <div className="connection-info">
          <div className="connection-name-row">
            <div className="connection-name">{name}</div>
            <span className={getStatusClass(request.status)}>
              {getStatusText(request.status, ui)}
            </span>
          </div>
          <div className="connection-headline">{headline || ui.professionalFallback || "Professional"}</div>
          {location && <div className="connection-location">{location}</div>}
          <div className="request-meta">
            {isReceived ? ui.connectionReceived || "Received" : ui.connectionSent || "Sent"} {formatRequestTime(request.created_at)}
          </div>
        </div>
      </div>

      <div className="connection-actions">
        {isReceived && request.status === "pending" ? (
          <ReceivedRequestButtons
            requestId={request.id}
            ui={ui}
            actionLoadingKey={actionLoadingKey}
            onAction={onAction}
          />
        ) : (
          <button type="button" className="btn-outline btn-sm" disabled>
            {getStatusText(request.status, ui)}
          </button>
        )}
      </div>
    </article>
  );
});

// ====================== MAIN COMPONENT ======================
export default function ConnectionsPage() {
  const router = useRouter();

  const [ui, setUi] = useState<UiContent>({});
  const [activeTab, setActiveTab] = useState<Tab>("discover");

  const [allUsers, setAllUsers] = useState<ConnectionUser[]>([]);
  const [connections, setConnections] = useState<ConnectionUser[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<ConnectionRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<ConnectionRequest[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");

  // Load data from server
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setNotice("");

    try {
      const uiContent = await fetchUiContent();
      setUi(uiContent);

      const user = await fetchAuthenticatedUser();
      if (user.isStaff || user.role === "admin") {
        router.replace(uiContent.routeAdmin);
        return;
      }

      const data = await fetchNetworkData();
      setAllUsers(data.users);
      setConnections(data.connections);
      setReceivedRequests(data.receivedRequests);
      setSentRequests(data.sentRequests);
    } catch (error) {
      console.error(error);
      setNotice(getUiContentErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  // Action Handlers
  const handleConnect = useCallback(async (userId: number) => {
    setActionLoading(`connect-${userId}`);
    setNotice("");
    try {
      const res = await sendConnectionInvite(userId);
      if (res.ok) {
        const request = (await res.json()) as ConnectionRequest;
        setAllUsers((currentUsers) =>
          currentUsers.map((user) =>
            user.id === userId
              ? {
                  ...user,
                  connectionStatus: "sent_pending",
                  requestId: request.id,
                  requestStatus: "pending",
                }
              : user
          )
        );
        setSentRequests((currentRequests) => [request, ...currentRequests]);
        setNotice(ui.connectionRequestSent || "Request sent successfully");
      } else {
        setNotice(await readApiMessage(res, ui.connectionRequestFailed));
      }
    } catch {
      setNotice(ui.connectionUnableToSend || "Failed to send request");
    } finally {
      setActionLoading("");
    }
  }, [ui.connectionRequestFailed, ui.connectionRequestSent, ui.connectionUnableToSend]);

  const handleRequestAction = useCallback(async (requestId: number, action: "accept" | "reject") => {
    setActionLoading(`${action}-${requestId}`);
    setNotice("");
    try {
      const res = await updateConnectionRequest(requestId, action);
      if (res.ok) {
        const request = receivedRequests.find((currentRequest) => currentRequest.id === requestId);
        const requesterId = request?.sender;

        setReceivedRequests((currentRequests) =>
          currentRequests.filter((currentRequest) => currentRequest.id !== requestId)
        );

        if (request && action === "accept") {
          const connectedUser = getRequestUser(request, "sender");

          setConnections((currentConnections) => {
            if (currentConnections.some((user) => user.id === connectedUser.id)) {
              return currentConnections;
            }

            return [connectedUser, ...currentConnections];
          });
        }

        if (requesterId) {
          setAllUsers((currentUsers) =>
            currentUsers.map((user) =>
              user.id === requesterId
                ? {
                    ...user,
                    connectionStatus: action === "accept" ? "connected" : "none",
                    requestId: null,
                    requestStatus: action === "accept" ? "accepted" : "rejected",
                  }
                : user
            )
          );
        }

        setNotice(action === "accept" ? ui.connectionRequestAccepted : ui.connectionRequestIgnored);
      } else {
        setNotice(await readApiMessage(res, ui.connectionRequestFailed || "Action failed"));
      }
    } catch {
      setNotice(ui.connectionUnableToUpdate || "Failed to update request");
    } finally {
      setActionLoading("");
    }
  }, [
    receivedRequests,
    ui.connectionRequestAccepted,
    ui.connectionRequestFailed,
    ui.connectionRequestIgnored,
    ui.connectionUnableToUpdate,
  ]);

  const handleMessage = useCallback(async (userId: number) => {
    setActionLoading(`message-${userId}`);
    try {
      const conversation = await startConversation(ui, userId);
      router.push(`${ui.routeMessages}?conversation=${conversation.id}`);
    } catch {
      setNotice("Failed to start conversation");
    } finally {
      setActionLoading("");
    }
  }, [router, ui]);

  const handleViewProfile = useCallback(
    (userId: number) => {
      router.push(`/profile/${userId}`);
    },
    [router]
  );

  const getUserActionLoadingKey = useCallback(
    (user: ConnectionUser) => {
      const requestActionKey =
        user.requestId &&
        (actionLoading === `accept-${user.requestId}` ||
          actionLoading === `reject-${user.requestId}`)
          ? actionLoading
          : "";

      if (requestActionKey) return requestActionKey;

      if (
        actionLoading === `connect-${user.id}` ||
        actionLoading === `message-${user.id}`
      ) {
        return actionLoading;
      }

      return "";
    },
    [actionLoading]
  );

  // Filter users for search
  const filteredUsers = useMemo(() => allUsers.filter((user) => {
    const text = `${user.fullName} ${user.email} ${user.headline || ""} ${user.location || ""}`;
    return text.toLowerCase().includes(searchTerm.toLowerCase());
  }), [allUsers, searchTerm]);

  const filteredConnections = useMemo(() => connections.filter((user) => {
    const text = `${user.fullName} ${user.email} ${user.headline || ""} ${user.location || ""}`;
    return text.toLowerCase().includes(searchTerm.toLowerCase());
  }), [connections, searchTerm]);

  const visibleRequests = activeTab === "received" ? receivedRequests : receivedRequests.slice(0, 2);
  const tabs: Tab[] = ["discover", "connections", "received", "sent"];

  if (isLoading) return <div className="app-main"><div className="container">Loading...</div></div>;

  return (
    <div className="app-main">
      <div className="container">
        <div className="network-layout">
          <aside className="network-sidebar">
            <div className="network-sidebar-card">
              <h2>{ui.myNetwork || "My Network"}</h2>
              <p>{ui.connectionIntro || "Build and manage your professional network."}</p>

              <div className="network-summary-list">
                {tabs.map((tab) => {
                  const count =
                    tab === "discover"
                      ? allUsers.length
                      : tab === "connections"
                        ? connections.length
                        : tab === "received"
                          ? receivedRequests.length
                          : sentRequests.length;

                  return (
                    <button
                      type="button"
                      key={tab}
                      className={`network-summary-item ${activeTab === tab ? "active" : ""}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      <span>{getTabLabel(tab, ui)}</span>
                      <strong>{count}</strong>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <main className="network-content">
            <div className="network-page-header">
              <div>
                <h1>{getTabLabel(activeTab, ui)}</h1>
                <p className="muted">
                  {activeTab === "discover" && "People you may want to connect with."}
                  {activeTab === "connections" && "People already in your network."}
                  {activeTab === "received" && "Invitations waiting for your response."}
                  {activeTab === "sent" && "Invitations you have sent."}
                </p>
              </div>

              <div className="network-header-stats">
                <span>{connections.length} {ui.connections || "connections"}</span>
                <span>{receivedRequests.length} pending</span>
              </div>
            </div>

            {notice && <div className="notice-banner network-notice">{notice}</div>}

            {receivedRequests.length > 0 && activeTab !== "sent" && (
              <section className="network-section">
                <div className="network-section-header">
                  <div>
                    <h2>{ui.connectionReceived || "Invitations"}</h2>
                    <p>{receivedRequests.length} pending invitation{receivedRequests.length === 1 ? "" : "s"}</p>
                  </div>
                  {activeTab !== "received" && (
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      onClick={() => setActiveTab("received")}
                    >
                      Manage all
                    </button>
                  )}
                </div>

                <div className="connections-grid network-invitations-grid">
                  {visibleRequests.map((req) => (
                    <RequestCard
                      key={req.id}
                      request={req}
                      direction="received"
                      ui={ui}
                      actionLoadingKey={
                        actionLoading === `accept-${req.id}` ||
                        actionLoading === `reject-${req.id}`
                          ? actionLoading
                          : ""
                      }
                      onAction={handleRequestAction}
                    />
                  ))}
                </div>
              </section>
            )}

            {(activeTab === "discover" || activeTab === "connections") && (
              <div className="network-search-card">
                <input
                  type="text"
                  placeholder={ui.connectionSearchPlaceholder || "Search by name, headline, or location"}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="search-input"
                />
              </div>
            )}

            {activeTab !== "received" && (
            <section className="network-section">
              <div className="network-section-header">
                <div>
                  <h2>{getTabLabel(activeTab, ui)}</h2>
                  <p>
                    {activeTab === "discover" && `${filteredUsers.length} profile${filteredUsers.length === 1 ? "" : "s"}`}
                    {activeTab === "connections" && `${filteredConnections.length} connection${filteredConnections.length === 1 ? "" : "s"}`}
                    {activeTab === "sent" && `${sentRequests.length} sent invitation${sentRequests.length === 1 ? "" : "s"}`}
                  </p>
                </div>
              </div>

              {activeTab === "discover" && (
                <div className="connections-grid">
                  {filteredUsers.length === 0 ? (
                    <EmptyNetworkState message="No people match your search." />
                  ) : (
                    filteredUsers.map((user) => (
                      <UserCard
                        key={user.id}
                        user={user}
                        ui={ui}
                        actionLoadingKey={getUserActionLoadingKey(user)}
                        onConnect={handleConnect}
                        onRequestAction={handleRequestAction}
                        onMessage={handleMessage}
                        onViewProfile={handleViewProfile}
                      />
                    ))
                  )}
                </div>
              )}

              {activeTab === "connections" && (
                <div className="connections-grid">
                  {filteredConnections.length === 0 ? (
                    <EmptyNetworkState message="No connections found." />
                  ) : (
                    filteredConnections.map((user) => (
                      <UserCard
                        key={user.id}
                        user={user}
                        ui={ui}
                        actionLoadingKey={getUserActionLoadingKey(user)}
                        onConnect={handleConnect}
                        onRequestAction={handleRequestAction}
                        onMessage={handleMessage}
                        onViewProfile={handleViewProfile}
                      />
                    ))
                  )}
                </div>
              )}

              {activeTab === "sent" && (
                <div className="connections-grid">
                  {sentRequests.length === 0 ? (
                    <EmptyNetworkState message="No sent invitations." />
                  ) : (
                    sentRequests.map((req) => (
                      <RequestCard
                        key={req.id}
                        request={req}
                        direction="sent"
                        ui={ui}
                        actionLoadingKey=""
                        onAction={handleRequestAction}
                      />
                    ))
                  )}
                </div>
              )}
            </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
