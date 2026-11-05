"use client";

/**
 * "Your profile is waiting for approval" / "wasn't approved", at the top of
 * the candidate AND recruiter dashboards.
 *
 *   Waiting  -> what an admin checks, and what's still missing (with a link to add it)
 *   Rejected -> the reason (one of 2 fixed reasons), how to fix it, and
 *               a "Send for review again" button
 *
 * Nothing is shown once the person is approved.
 */

import Link from "next/link";
import { useState } from "react";
import { Hourglass, ShieldAlert } from "lucide-react";

import { errorText } from "@/app/api/client";
import { REJECTION_REASON_TEXT } from "@/app/config/constants";
import { ROUTES } from "@/app/config/routes";
import { resubmitForApproval, type Profile } from "@/app/services/profiles";
import styles from "../../dashboard.module.css";

export default function ApprovalStatus({ profile, className = "" }: { profile: Profile; className?: string }) {
  // Start from the profile; after "Send again" we show Django's new answer.
  const [current, setCurrent] = useState(profile);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (current.approvalStatus === "approved") return null;

  const rejected = current.approvalStatus === "rejected";
  const reason = rejected && current.rejectionReason ? REJECTION_REASON_TEXT[current.rejectionReason] : null;
  const missing = current.approvalMissing ?? [];
  const who = current.role === "recruiter" ? "recruiter account" : "profile";

  async function sendAgain() {
    if (sending) return;
    setSending(true);
    setError("");
    try {
      setCurrent(await resubmitForApproval());
    } catch (sendError) {
      setError(errorText(sendError, "Couldn't send your profile. Please try again."));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className={`${styles.panel} ${styles.status} ${className}`} role="status">
      <span className={`${styles.statusIcon} ${rejected ? styles.statusIconBad : ""}`}>
        {rejected ? <ShieldAlert size={22} aria-hidden="true" /> : <Hourglass size={22} aria-hidden="true" />}
      </span>

      <div>
        <h2 className={styles.searchTitle}>
          {rejected ? reason?.title ?? `Your ${who} wasn't approved` : `Your ${who} is waiting for approval`}
        </h2>
        <p className={styles.readinessMeta}>
          {rejected
            ? reason?.fix ?? "Update your profile, then send it again."
            : current.role === "recruiter"
              ? "An admin checks every recruiter and their company. Candidate search and messaging open as soon as you're approved."
              : "An admin checks every new profile so recruiters only see real people. You'll appear in search and can connect as soon as you're approved."}
        </p>

        {missing.length > 0 && (
          <div className={styles.statusNote}>
            <strong>Add these first, so an admin can approve you:</strong> {missing.join(", ")}.{" "}
            <Link href={ROUTES.PROFILE_EDIT}>Complete your profile</Link>
          </div>
        )}

        {rejected && (
          <div className={styles.statusActions}>
            <Link href={ROUTES.PROFILE_EDIT} className="btn-outline btn-sm">
              Edit profile
            </Link>
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={sendAgain}
              disabled={sending || missing.length > 0}
            >
              {sending ? "Sending..." : "Send for review again"}
            </button>
          </div>
        )}

        {error && (
          <p className="form-error mt-2" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
