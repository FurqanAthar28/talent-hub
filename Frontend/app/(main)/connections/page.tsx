"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../api/client";

type RelationshipStatus =
  | "none"
  | "connected"
  | "sent_pending"
  | "sent_accepted"
  | "sent_rejected"
  | "received_pending"
  | "received_accepted"
  | "received_rejected";

type ConnectionUser = {
  id: number;
  fullName: string;
  email: string;
  headline: string;
  location: string;
  connectionStatus: RelationshipStatus;
  requestId: number | null;
  requestStatus: "pending" | "accepted" | "rejected" | null;
};

type ConnectionRequest = {
  id: number;
  sender: number;
  receiver: number;
  sender_name: string;
  sender_email: string;
  sender_headline: string;
  sender_location: string;
  receiver_name: string;
  receiver_email: string;
  receiver_headline: string;
  receiver_location: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

type Tab = "discover" | "connections" | "received" | "sent";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getStatusLabel(status: RelationshipStatus | ConnectionRequest["status"]) {
  const labels: Record<string, string> = {
    none: "Not connected",
    connected: "Connected",
    pending: "Pending",
    accepted: "Accepted",
    rejected: "Declined",
    sent_pending: "Request sent",
    sent_accepted: "Accepted",
    sent_rejected: "Declined",
    received_pending: "Awaiting response",
    received_accepted: "Accepted",
    received_rejected: "Ignored",
  };

  return labels[status] || "Not connected";
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

async function readResponseMessage(res: Response) {
  try {
    const data = await res.json();
    return data.message || data.error || "Request failed.";
  } catch {
    return "Request failed.";
  }
}

export default function ConnectionsPage() {
  const router = useRouter();

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
      await apiFetch("/accounts/me");

      const [usersRes, receivedRes, sentRes, connectionsRes] = await Promise.all([
        apiFetch("/connections/users"),
        apiFetch("/connections/pending"),
        apiFetch("/connections/sent"),
        apiFetch("/connections/my-connections"),
      ]);

      if (!usersRes.ok || !receivedRes.ok || !sentRes.ok || !connectionsRes.ok) {
        setNotice("Some network information could not be loaded. Please try again.");
      }

      if (usersRes.ok) setAllUsers(await usersRes.json());
      if (receivedRes.ok) setReceivedRequests(await receivedRes.json());
      if (sentRes.ok) setSentRequests(await sentRes.json());
      if (connectionsRes.ok) setConnections(await connectionsRes.json());
    } catch {
      setNotice("Unable to load your network right now.");
    } finally {
      setLoading(false);
    }
  }, []);

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
      const res = await apiFetch("/connections/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId }),
      });

      if (!res.ok) {
        setNotice(await readResponseMessage(res));
        return;
      }

      setNotice("Connection request sent.");
      await loadData();
    } catch {
      setNotice("Unable to send connection request.");
    } finally {
      setActionLoading("");
    }
  }

  async function updateReceivedRequest(requestId: number, action: "accept" | "reject") {
    const actionKey = `${action}-${requestId}`;
    setActionLoading(actionKey);
    setNotice("");

    try {
      const res = await apiFetch(`/connections/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });

      if (!res.ok) {
        setNotice(await readResponseMessage(res));
        return;
      }

      setNotice(action === "accept" ? "Connection request accepted." : "Request ignored.");
      await loadData();
    } catch {
      setNotice("Unable to update connection request.");
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
        <button type="button" className="btn-outline btn-sm" disabled>
          Connected
        </button>
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
            {actionLoading === acceptKey ? "Accepting..." : "Accept"}
          </button>

          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => updateReceivedRequest(user.requestId as number, "reject")}
            disabled={actionLoading === acceptKey || actionLoading === rejectKey}
          >
            {actionLoading === rejectKey ? "Ignoring..." : "Ignore"}
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
        {actionLoading === connectKey ? "Sending..." : "Connect"}
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
                  {getStatusLabel(user.connectionStatus)}
                </span>
              </div>

              <div className="connection-headline">
                {user.headline || "Professional"}
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
              View
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
                  {getStatusLabel(request.status)}
                </span>
              </div>

              <div className="connection-headline">
                {headline || "Professional"}
              </div>

              {location && <div className="connection-location">{location}</div>}
              <div className="connection-location">{email}</div>

              <div className="request-meta">
                {isReceived ? "Received" : "Sent"} {getRequestDate(request.created_at)}
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
                  {actionLoading === acceptKey ? "Accepting..." : "Accept"}
                </button>

                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => updateReceivedRequest(request.id, "reject")}
                  disabled={actionLoading === acceptKey || actionLoading === rejectKey}
                >
                  {actionLoading === rejectKey ? "Ignoring..." : "Ignore"}
                </button>
              </>
            ) : (
              <button type="button" className="btn-outline btn-sm" disabled>
                {getStatusLabel(request.status)}
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
        <div className="container">Loading your network...</div>
      </div>
    );
  }

  return (
    <div className="app-main">
      <div className="container">
        <div className="network-header">
          <div>
            <h1 className="text-lg mb-1">My Network</h1>
            <p className="muted">Manage connection requests and discover professionals.</p>
          </div>
        </div>

        {notice && <div className="notice-banner">{notice}</div>}

        <div className="tab-nav">
          <button
            type="button"
            className={`tab-btn ${activeTab === "discover" ? "active" : ""}`}
            onClick={() => setActiveTab("discover")}
          >
            Discover
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === "connections" ? "active" : ""}`}
            onClick={() => setActiveTab("connections")}
          >
            Connections ({connections.length})
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === "received" ? "active" : ""}`}
            onClick={() => setActiveTab("received")}
          >
            Received ({receivedRequests.length})
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === "sent" ? "active" : ""}`}
            onClick={() => setActiveTab("sent")}
          >
            Sent ({sentRequests.length})
          </button>
        </div>

        {activeTab === "discover" && (
          <>
            <div className="card mb-3">
              <div className="card-body">
                <input
                  type="text"
                  placeholder="Search by name, email, headline, or location..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            <div className="connections-grid">
              {discoverList.length === 0
                ? renderEmptyState("No professionals match your search.")
                : discoverList.map((user) => renderUserCard(user))}
            </div>
          </>
        )}

        {activeTab === "connections" && (
          <div className="connections-grid">
            {connections.length === 0
              ? renderEmptyState("You do not have any connections yet.")
              : connections.map((user) => renderUserCard(user))}
          </div>
        )}

        {activeTab === "received" && (
          <div className="connections-grid">
            {receivedRequests.length === 0
              ? renderEmptyState("No received requests yet.")
              : receivedRequests.map((request) => renderRequestCard(request, "received"))}
          </div>
        )}

        {activeTab === "sent" && (
          <div className="connections-grid">
            {sentRequests.length === 0
              ? renderEmptyState("No sent requests yet.")
              : sentRequests.map((request) => renderRequestCard(request, "sent"))}
          </div>
        )}
      </div>
    </div>
  );
}