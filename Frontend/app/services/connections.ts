/**
 * Talking to Django about my network: people, connection requests, connections.
 * Each function throws an Error with Django's own message when something
 * goes wrong, so the page can simply show `error.message`.
 */

import { apiFetch, getApiMessage, readJson } from "../api/client";
import { API_ROUTES } from "../config/apiRoutes";
import { MESSAGES } from "../config/messages";

/** How I am related to someone. "sent_pending" = I asked, they haven't answered. */
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

export type NetworkData = {
  users: ConnectionUser[];
  receivedRequests: ConnectionRequest[];
  sentRequests: ConnectionRequest[];
  connections: ConnectionUser[];
};

/** Stop with Django's message (or the fallback) when the request failed. */
async function throwIfFailed(response: Response, fallback: string) {
  if (response.ok) return;

  const data = await readJson(response);
  throw new Error(getApiMessage(data) || fallback);
}

/** POST some JSON and stop if Django says no. */
async function postOrThrow(path: string, body: object, fallback: string) {
  const response = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await throwIfFailed(response, fallback);
  return response;
}

/** Load the 4 lists at the same time (faster than one after another). */
export async function fetchNetworkData(): Promise<NetworkData> {
  const responses = await Promise.all([
    apiFetch(API_ROUTES.CONNECTIONS.USERS),
    apiFetch(API_ROUTES.CONNECTIONS.PENDING),
    apiFetch(API_ROUTES.CONNECTIONS.SENT),
    apiFetch(API_ROUTES.CONNECTIONS.MY_CONNECTIONS),
  ]);

  for (const response of responses) {
    await throwIfFailed(response, MESSAGES.NETWORK.LOAD_FAILED);
  }

  const [users, receivedRequests, sentRequests, connections] = await Promise.all(
    responses.map((response) => response.json())
  );

  return {
    users: users as ConnectionUser[],
    receivedRequests: receivedRequests as ConnectionRequest[],
    sentRequests: sentRequests as ConnectionRequest[],
    connections: connections as ConnectionUser[],
  };
}

/** Ask someone to connect. Gives back the (new or re-opened) request. */
export async function sendConnectionInvite(receiverId: number): Promise<ConnectionRequest> {
  const response = await postOrThrow(
    API_ROUTES.CONNECTIONS.SEND,
    { receiverId },
    MESSAGES.NETWORK.REQUEST_FAILED
  );
  return (await response.json()) as ConnectionRequest;
}

/** Accept or ignore a request someone sent me. */
export async function updateConnectionRequest(
  requestId: number,
  action: "accept" | "reject"
): Promise<void> {
  const address =
    action === "accept" ? API_ROUTES.CONNECTIONS.ACCEPT : API_ROUTES.CONNECTIONS.REJECT;

  await postOrThrow(address, { requestId }, MESSAGES.NETWORK.UPDATE_FAILED);
}
