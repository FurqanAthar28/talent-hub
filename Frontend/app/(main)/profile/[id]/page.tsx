"use client";

/**
 * Someone else's profile, for example /profile/42 (42 = their USER id).
 *
 * The button depends on how I am related to them (Django tells us in
 * profile.connectionStatus):
 *   connected        -> "Message"
 *   sent_pending     -> "Request sent" (switched off)
 *   received_pending -> "Accept"
 *   anything else    -> "Connect"
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { UserX } from "lucide-react";

import { errorText } from "../../../api/client";
import { EmptyState, Notice, Panel, ui } from "../../../components/ui";
import { MESSAGES } from "../../../config/messages";
import { ROUTES } from "../../../config/routes";
import { useUiContent } from "../../../hooks/useUiContent";
import {
  sendConnectionInvite,
  updateConnectionRequest,
  type RelationshipStatus,
} from "../../../services/connections";
import { startConversation } from "../../../services/messages";
import {
  fetchUserProfileDetails,
  trackProfileView,
  type ProfileDetails,
} from "../../../services/profiles";
import { isAdmin, useCurrentUser } from "../../CurrentUserContext";
import ProfileView from "../components/ProfileView";

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const userId = params.id; // the person's USER id, from the address
  const me = useCurrentUser();
  const text = useUiContent();

  const [details, setDetails] = useState<ProfileDetails | null>(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false); // a button is working

  const isMyOwnProfile = String(me.id) === userId;

  useEffect(() => {
    // My own id? Show my own profile page instead.
    if (isMyOwnProfile) {
      router.replace(ROUTES.PROFILE);
      return;
    }

    let pageIsOpen = true;

    fetchUserProfileDetails(userId)
      .then((data) => {
        if (!pageIsOpen) return;
        setDetails(data);
        trackProfileView(userId); // after it loaded, so "not found" isn't counted
      })
      .catch((error: unknown) => {
        if (pageIsOpen) setLoadError(errorText(error, "This profile could not be loaded."));
      });

    return () => {
      pageIsOpen = false;
    };
  }, [userId, isMyOwnProfile, router]);

  /** Update the relationship after a button worked, so the right button shows. */
  function setRelationship(connectionStatus: RelationshipStatus, requestId: number | null) {
    setDetails((current) =>
      current
        ? { ...current, profile: { ...current.profile, connectionStatus, requestId } }
        : current
    );
  }

  /** Run one button's work: one at a time, and show Django's message if it fails. */
  async function runAction(work: () => Promise<void>, fallbackError: string) {
    if (busy) return;
    setBusy(true);
    setNotice("");

    try {
      await work();
    } catch (error) {
      setNotice(errorText(error, fallbackError));
    } finally {
      setBusy(false);
    }
  }

  function handleConnect() {
    void runAction(async () => {
      const request = await sendConnectionInvite(Number(userId));
      setRelationship("sent_pending", request.id);
      setNotice(text("connectionRequestSent", MESSAGES.NETWORK.REQUEST_SENT));
    }, MESSAGES.NETWORK.REQUEST_FAILED);
  }

  function handleAccept(requestId: number) {
    void runAction(async () => {
      await updateConnectionRequest(requestId, "accept");
      setRelationship("connected", null);
      setNotice(text("connectionRequestAccepted", MESSAGES.NETWORK.ACCEPTED));
    }, MESSAGES.NETWORK.UPDATE_FAILED);
  }

  function handleMessage() {
    void runAction(async () => {
      const conversation = await startConversation(Number(userId));
      router.push(`${ROUTES.MESSAGES}?conversation=${conversation.id}`);
    }, MESSAGES.MESSAGES.START_FAILED);
  }

  if (loadError) {
    return (
      <main className={ui.page}>
        <Panel>
          <EmptyState
            icon={UserX}
            title="Profile not found"
            text={`${loadError} The account may have been removed or switched off.`}
            action={
              <Link href={ROUTES.CONNECTIONS} className="btn-primary">
                Back to network
              </Link>
            }
          />
        </Panel>
      </main>
    );
  }

  if (!details) {
    return (
      <main className={ui.page}>
        <p className="muted">{text("loading", "Loading...")}</p>
      </main>
    );
  }

  const { profile } = details;

  // Admins don't use connections, and nobody connects with an admin.
  const canUseConnections = !isAdmin(me) && profile.role !== "admin";

  function connectionButton() {
    const status = profile.connectionStatus ?? "none";

    if (status === "connected") {
      return (
        <button type="button" className="btn-primary" onClick={handleMessage} disabled={busy}>
          {busy ? "Opening..." : text("message", "Message")}
        </button>
      );
    }

    if (status === "sent_pending") {
      return (
        <button type="button" className="btn-outline" disabled>
          {text("connectionStatusRequestSent", "Request sent")}
        </button>
      );
    }

    if (status === "received_pending" && profile.requestId) {
      const requestId = profile.requestId;
      return (
        <button
          type="button"
          className="btn-primary"
          onClick={() => handleAccept(requestId)}
          disabled={busy}
        >
          {busy ? text("connectionAccepting", "Accepting...") : text("connectionAccept", "Accept request")}
        </button>
      );
    }

    return (
      <button type="button" className="btn-primary" onClick={handleConnect} disabled={busy}>
        {busy ? text("connectionSending", "Sending...") : text("connectionConnect", "Connect")}
      </button>
    );
  }

  return (
    <main className={ui.page}>
        {notice && <Notice>{notice}</Notice>}

        <ProfileView
          {...details}
          isMine={false}
          actions={
            canUseConnections ? (
              <>
                {connectionButton()}
                <Link href={ROUTES.CONNECTIONS} className="btn-outline">
                  Back to network
                </Link>
              </>
            ) : undefined
          }
        />
    </main>
  );
}
