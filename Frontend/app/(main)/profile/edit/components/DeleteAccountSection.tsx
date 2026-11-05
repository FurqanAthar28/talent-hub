"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { postJson } from "../../../../api/client";
import { MESSAGES } from "../../../../config/messages";
import { API_ROUTES } from "../../../../config/apiRoutes";
import { ROUTES } from "../../../../config/routes";
import { useCurrentUser } from "../../../CurrentUserContext";

/**
 * "Delete my account" box, shown at the bottom of the Edit Profile page.
 *
 * Two safety steps, so nobody deletes their account by accident:
 *   1. First click only OPENS the box.
 *   2. They must type their password and press the red button.
 *
 * This is its own <form>, OUTSIDE the main profile form, so pressing
 * Enter here can never save (or delete) the wrong thing.
 *
 * Deleting is SOFT: the account is hidden right away, and the person can
 * restore it from the sign-in page for `deletionGraceDays` days. After that
 * a daily job deletes it for good (Backend: purge_deleted_accounts).
 */
export default function DeleteAccountSection() {
  const { deletionGraceDays } = useCurrentUser();

  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  // Django's "Deleted. You can restore it until ..." once it's done.
  const [doneMessage, setDoneMessage] = useState("");

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deleting) return; // no double clicks
    setError("");

    if (!password) {
      setError("Please type your password.");
      return;
    }

    setDeleting(true);

    try {
      // postJson: a wrong password (401) is NOT treated as "logged out".
      const result = await postJson(API_ROUTES.ACCOUNTS.DELETE_ACCOUNT, { password });

      if (!result.ok) {
        setError(result.message || "Unable to delete your account.");
        return;
      }

      // Hidden now, and the login cookies were cleared. Say how to undo it.
      setDoneMessage(result.message || "Your account is deleted.");
    } catch {
      setError(MESSAGES.COMMON.SERVER_UNREACHABLE);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section id="delete-account" className="form-section">
      <div className="form-section-header">
        <p className="eyebrow">Danger zone</p>
        <h2>Delete my account</h2>
        <p>
          {`Your profile is hidden from everyone right away. Changed your mind? Sign in within ${deletionGraceDays} days and choose "Restore my account". After that, your profile, CV, connections and messages are deleted for good.`}
        </p>
      </div>

      {doneMessage ? (
        <div className="auth-restore" role="status">
          <p>{doneMessage}</p>
          <Link href={ROUTES.HOME} className="btn-outline">
            Go to the home page
          </Link>
        </div>
      ) : !open ? (
        <button
          type="button"
          className="btn-danger-outline"
          onClick={() => setOpen(true)}
        >
          Delete my account
        </button>
      ) : (
        <form onSubmit={handleDelete}>
          <div className="form-group">
            <label htmlFor="delete-account-password">
              Type your password to confirm
            </label>
            <input
              id="delete-account-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="edit-profile-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={deleting}
              onClick={() => {
                setOpen(false);
                setPassword("");
                setError("");
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn-danger-outline" disabled={deleting}>
              {deleting ? "Deleting..." : "Delete my account"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
