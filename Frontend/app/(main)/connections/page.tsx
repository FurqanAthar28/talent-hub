"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchUiContent, type UiContent } from "../../api/ui-content";
import {
  fetchAuthenticatedUser,
  fetchNetworkData,
  readApiMessage,
  sendConnectionInvite,
  updateConnectionRequest,
  type ConnectionRequest,
  type ConnectionUser,
  type RelationshipStatus,
} from "../../services/connections";
import { startConversation } from "../../services/messages";

type Tab = "discover" | "connections" | "received" | "sent";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getStatusLabel(
  status: RelationshipStatus | ConnectionRequest["status"],
  uiContent: UiContent
) {
  const labels: Record<string, string> = {
    none: uiContent.connectionStatusNotConnected,
    connected: uiContent.connectionStatusConnected,
    pending: uiContent.connectionStatusPending,
    accepted: uiContent.connectionStatusAccepted,
    rejected: uiContent.connectionStatusDeclined,
    sent_pending: uiContent.connectionStatusRequestSent,
    sent_accepted: uiContent.connectionStatusAccepted,
    sent_rejected: uiContent.connectionStatusDeclined,
    received_pending: uiContent.connectionStatusAwaitingResponse,
    received_accepted: uiContent.connectionStatusAccepted,
    received_rejected: uiContent.connectionStatusIgnored,
  };

  return labels[status] || uiContent.connectionStatusNotConnected;
}

function getStatusClass(status: RelationshipStatus | ConnectionRequest["status"]) {
  if (status === "connected" || status === "accepted" || status === "sent_accepted") {
    return "status-badge status-success";
  }

  if (status === "rejected" || status === "sent_rejected" || status === "received_rejected") {
    return "status-badge status-muted";
  }

  if (status === "pending" || status === "sent_pending" || status === "received_pending") {
    return "status-badge status-warning";
  }

  return "status-badge";
}

function getRequestDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function ConnectionsPage() {
  const router = useRouter();

  const [uiContent, setUiContent] = useState<UiContent>({});
  const [activeTab, setActiveTab] = useState<Tab>("discover");
  const [allUsers, setAllUsers] = useState<ConnectionUser[]>([]);
  const [connections, setConnections] = useState<ConnectionUser[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<ConnectionRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<ConnectionRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");

  const loadData = useCallback(async (showPageLoading = false) => {
    if (showPageLoading) {
      setNotice("");
      setLoading(true);
    }

    try {
      const uiContentData = await fetchUiContent();
      setUiContent(uiContentData);
      const currentUser = await fetchAuthenticatedUser();

      if (currentUser.isStaff || currentUser.role === "admin") {
        router.replace(uiContentData.routeAdmin);
        return;
      }

      const networkData = await fetchNetworkData();
      setAllUsers(networkData.users);
      setReceivedRequests(networkData.receivedRequests);
      setSentRequests(networkData.sentRequests);
      setConnections(networkData.connections);
    } catch (error) {
      console.error("Failed to load network data:", error);
      setNotice(uiContent.connectionUnableToLoad);
    } finally {
      setLoading(false);
    }
  }, [router, uiContent.connectionUnableToLoad]);

useEffect(() => {
  async function loadInitialData() {
    await loadData(true);
  }

  loadInitialData();
}, [loadData]);

  async function sendConnectionRequest(receiverId: number) {
    const actionKey = `connect-${receiverId}`;
    setActionLoading(actionKey);
    setNotice("");

    try {
      const res = await sendConnectionInvite(receiverId);

      if (!res.ok) {
        setNotice(await readApiMessage(res, uiContent.connectionRequestFailed));
        return;
      }

      setNotice(uiContent.connectionRequestSent);
      await loadData();
    } catch (error) {
      console.error("Failed to send connection request:", error);
      setNotice(uiContent.connectionUnableToSend);
    } finally {
      setActionLoading("");
    }
  }

  async function updateReceivedRequest(requestId: number, action: "accept" | "reject") {
    const actionKey = `${action}-${requestId}`;
    setActionLoading(actionKey);
    setNotice("");

    try {
      const res = await updateConnectionRequest(requestId, action);

      if (!res.ok) {
        setNotice(await readApiMessage(res, uiContent.connectionRequestFailed));
        return;
      }

      setNotice(
        action === "accept"
          ? uiContent.connectionRequestAccepted
          : uiContent.connectionRequestIgnored
      );
      await loadData();
    } catch (error) {
      console.error("Failed to update connection request:", error);
      setNotice(uiContent.connectionUnableToUpdate);
    } finally {
      setActionLoading("");
    }
  }

  async function messageConnection(userId: number) {
    const actionKey = `message-${userId}`;
    setActionLoading(actionKey);
    setNotice("");

    try {
      const conversation = await startConversation(uiContent, userId);
      router.push(`${uiContent.routeMessages}?conversation=${conversation.id}`);
    } catch (error) {
      console.error("Failed to start message conversation:", error);
      setNotice(error instanceof Error ? error.message : uiContent.messageStartFailed);
    } finally {
      setActionLoading("");
    }
  }

  const discoverList = allUsers.filter((user) => {
    const text = `${user.fullName} ${user.email} ${user.headline} ${user.location}`;
    return text.toLowerCase().includes(searchTerm.toLowerCase());
  });

  function renderUserActions(user: ConnectionUser) {
    if (user.connectionStatus === "connected") {
      return (
        <>
          <button type="button" className="btn-outline btn-sm" disabled>
            {uiContent.connectionStatusConnected}
          </button>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => messageConnection(user.id)}
            disabled={actionLoading === `message-${user.id}`}
          >
            {uiContent.message}
          </button>
        </>
      );
    }

    if (user.connectionStatus === "received_pending" && user.requestId) {
      const acceptKey = `accept-${user.requestId}`;
      const rejectKey = `reject-${user.requestId}`;

      return (
        <>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => updateReceivedRequest(user.requestId as number, "accept")}
            disabled={actionLoading === acceptKey || actionLoading === rejectKey}
          >
            {actionLoading === acceptKey
              ? uiContent.connectionAccepting
              : uiContent.connectionAccept}
          </button>

          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => updateReceivedRequest(user.requestId as number, "reject")}
            disabled={actionLoading === acceptKey || actionLoading === rejectKey}
          >
            {actionLoading === rejectKey
              ? uiContent.connectionIgnoring
              : uiContent.connectionIgnore}
          </button>
        </>
      );
    }

    if (
      user.connectionStatus === "sent_pending" ||
      user.connectionStatus === "sent_rejected" ||
      user.connectionStatus === "received_rejected"
    ) {
      return null;
    }

    const connectKey = `connect-${user.id}`;

    return (
      <button
        type="button"
        className="btn-primary btn-sm"
        onClick={() => sendConnectionRequest(user.id)}
        disabled={actionLoading === connectKey}
      >
        {actionLoading === connectKey
          ? uiContent.connectionSending
          : uiContent.connectionConnect}
      </button>
    );
  }

  function renderUserCard(user: ConnectionUser) {
    return (
      <div key={user.id} className="card">
        <div className="connection-card">
          <div className="connection-top">
            <div className="connection-avatar">{getInitials(user.fullName)}</div>

            <div className="connection-info">
              <div className="connection-name-row">
                <div className="connection-name">{user.fullName}</div>
                <span className={getStatusClass(user.connectionStatus)}>
                  {getStatusLabel(user.connectionStatus, uiContent)}
                </span>
              </div>

              <div className="connection-headline">
                {user.headline || uiContent.professionalFallback}
              </div>

              {user.location && (
                <div className="connection-location">{user.location}</div>
              )}

              <div className="connection-location">{user.email}</div>
            </div>
          </div>

          <div className="connection-actions">
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => router.push(`/profile/${user.id}`)}
            >
              {uiContent.viewProfile}
            </button>

            {renderUserActions(user)}
          </div>
        </div>
      </div>
    );
  }

  function renderRequestCard(request: ConnectionRequest, direction: "received" | "sent") {
    const isReceived = direction === "received";
    const name = isReceived ? request.sender_name : request.receiver_name;
    const email = isReceived ? request.sender_email : request.receiver_email;
    const headline = isReceived ? request.sender_headline : request.receiver_headline;
    const location = isReceived ? request.sender_location : request.receiver_location;
    const acceptKey = `accept-${request.id}`;
    const rejectKey = `reject-${request.id}`;

    return (
      <div key={request.id} className="card">
        <div className="connection-card">
          <div className="connection-top">
            <div className="connection-avatar">{getInitials(name)}</div>

            <div className="connection-info">
              <div className="connection-name-row">
                <div className="connection-name">{name}</div>
                <span className={getStatusClass(request.status)}>
                  {getStatusLabel(request.status, uiContent)}
                </span>
              </div>

              <div className="connection-headline">
                {headline || uiContent.professionalFallback}
              </div>

              {location && <div className="connection-location">{location}</div>}
              <div className="connection-location">{email}</div>

              <div className="request-meta">
                {isReceived ? uiContent.connectionReceived : uiContent.connectionSent}{" "}
                {getRequestDate(request.created_at)}
              </div>
            </div>
          </div>

          <div className="connection-actions">
            {isReceived && request.status === "pending" ? (
              <>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => updateReceivedRequest(request.id, "accept")}
                  disabled={actionLoading === acceptKey || actionLoading === rejectKey}
                >
                  {actionLoading === acceptKey
                    ? uiContent.connectionAccepting
                    : uiContent.connectionAccept}
                </button>

                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => updateReceivedRequest(request.id, "reject")}
                  disabled={actionLoading === acceptKey || actionLoading === rejectKey}
                >
                  {actionLoading === rejectKey
                    ? uiContent.connectionIgnoring
                    : uiContent.connectionIgnore}
                </button>
              </>
            ) : (
              <button type="button" className="btn-outline btn-sm" disabled>
                {getStatusLabel(request.status, uiContent)}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderEmptyState(message: string) {
    return (
      <div className="empty-state">
        <p>{message}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-main">
        <div className="container">{uiContent.connectionLoading}</div>
      </div>
    );
  }

  return (
    <div className="app-main">
      <div className="container">
        <div className="network-header">
          <div>
            <h1 className="text-lg mb-1">{uiContent.myNetwork}</h1>
            <p className="muted">{uiContent.connectionIntro}</p>
          </div>
        </div>

        {notice && <div className="notice-banner">{notice}</div>}

        <div className="tab-nav">
          <button
            type="button"
            className={`tab-btn ${activeTab === "discover" ? "active" : ""}`}
            onClick={() => setActiveTab("discover")}
          >
            {uiContent.connectionDiscover}
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === "connections" ? "active" : ""}`}
            onClick={() => setActiveTab("connections")}
          >
            {uiContent.connections} ({connections.length})
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === "received" ? "active" : ""}`}
            onClick={() => setActiveTab("received")}
          >
            {uiContent.connectionReceived} ({receivedRequests.length})
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === "sent" ? "active" : ""}`}
            onClick={() => setActiveTab("sent")}
          >
            {uiContent.connectionSent} ({sentRequests.length})
          </button>
        </div>

        {activeTab === "discover" && (
          <>
            <div className="card mb-3">
              <div className="card-body">
                <input
                  type="text"
                  placeholder={uiContent.connectionSearchPlaceholder}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            <div className="connections-grid">
              {discoverList.length === 0
                ? renderEmptyState(uiContent.connectionNoSearchResults)
                : discoverList.map((user) => renderUserCard(user))}
            </div>
          </>
        )}

        {activeTab === "connections" && (
          <div className="connections-grid">
            {connections.length === 0
              ? renderEmptyState(uiContent.connectionNoConnections)
              : connections.map((user) => renderUserCard(user))}
          </div>
        )}

        {activeTab === "received" && (
          <div className="connections-grid">
            {receivedRequests.length === 0
              ? renderEmptyState(uiContent.connectionNoReceivedRequests)
              : receivedRequests.map((request) => renderRequestCard(request, "received"))}
          </div>
        )}

        {activeTab === "sent" && (
          <div className="connections-grid">
            {sentRequests.length === 0
              ? renderEmptyState(uiContent.connectionNoSentRequests)
              : sentRequests.map((request) => renderRequestCard(request, "sent"))}
          </div>
        )}
      </div>
    </div>
  );
}
