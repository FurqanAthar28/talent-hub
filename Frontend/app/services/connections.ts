import { apiFetch } from "../api/client";

export type RelationshipStatus =
  | "none"
  | "connected"
  | "sent_pending"
  | "sent_accepted"
  | "sent_rejected"
  | "received_pending"
  | "received_accepted"
  | "received_rejected";

export type ConnectionRequestStatus = "pending" | "accepted" | "rejected";

export type ConnectionUser = {
  id: number;
  fullName: string;
  email: string;
  headline: string;
  location: string;
  connectionStatus: RelationshipStatus;
  requestId: number | null;
  requestStatus: ConnectionRequestStatus | null;
};

export type ConnectionRequest = {
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
  status: ConnectionRequestStatus;
  created_at: string;
};

export type AuthUser = {
  isStaff: boolean;
  role?: "candidate" | "recruiter" | "admin";
};

type ApiMessageResponse = {
  message?: string;
  error?: string;
};

export type NetworkData = {
  users: ConnectionUser[];
  receivedRequests: ConnectionRequest[];
  sentRequests: ConnectionRequest[];
  connections: ConnectionUser[];
};

export async function readApiMessage(
  response: Response,
  fallbackMessage: string
) {
  try {
    const data = (await response.json()) as ApiMessageResponse;
    return data.message || data.error || fallbackMessage;
  } catch (error) {
    console.error("Failed to read API response message:", error);
    return fallbackMessage;
  }
}

export async function fetchAuthenticatedUser() {
  const response = await apiFetch("/accounts/me");

  if (!response.ok) {
    throw new Error("Unable to verify authenticated user.");
  }

  return (await response.json()) as AuthUser;
}

export async function fetchNetworkData(): Promise<NetworkData> {
  const [usersResponse, receivedResponse, sentResponse, connectionsResponse] =
    await Promise.all([
      apiFetch("/connections/users"),
      apiFetch("/connections/pending"),
      apiFetch("/connections/sent"),
      apiFetch("/connections/my-connections"),
    ]);

  if (
    !usersResponse.ok ||
    !receivedResponse.ok ||
    !sentResponse.ok ||
    !connectionsResponse.ok
  ) {
    throw new Error("Unable to load network data.");
  }

  const [users, receivedRequests, sentRequests, connections] = await Promise.all([
    usersResponse.json() as Promise<ConnectionUser[]>,
    receivedResponse.json() as Promise<ConnectionRequest[]>,
    sentResponse.json() as Promise<ConnectionRequest[]>,
    connectionsResponse.json() as Promise<ConnectionUser[]>,
  ]);

  return {
    users,
    receivedRequests,
    sentRequests,
    connections,
  };
}

export async function sendConnectionInvite(receiverId: number) {
  return apiFetch("/connections/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receiverId }),
  });
}

export async function updateConnectionRequest(
  requestId: number,
  action: "accept" | "reject"
) {
  return apiFetch(`/connections/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
}
