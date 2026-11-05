"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { postJson } from "../../../../api/client";
import { MESSAGES } from "../../../../config/messages";
import { API_ROUTES } from "../../../../config/apiRoutes";
import { ROUTES } from "../../../../config/routes";

/**
 * "Delete my account" box, shown at the bottom of the Edit Profile page.
 *
 * Two safety steps, so nobody deletes their account by accident:
 *   1. First click only OPENS the box.
 *   2. They must type their password and press the red button.
 *
 * This is its own <form>, OUTSIDE the main profile form, so pressing
 * Enter here can never save (or delete) the wrong thing.
 */
export default function DeleteAccountSection() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

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

      // The account is gone and the login cookies were cleared.
      router.replace(ROUTES.HOME);
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
          This permanently deletes your account, profile, CV, connections and
          messages. It cannot be undone.
        </p>
      </div>

      {!open ? (
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
              {deleting ? "Deleting..." : "Permanently delete my account"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
