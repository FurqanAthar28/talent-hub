"use client";

/**
 * The "Review" window: everything an admin needs to approve a candidate or
 * recruiter, in one place (used on the admin page AND the admin profile).
 *
 *   1. Django's automatic checks, each with a tick or a cross.
 *      Required ones must pass before Approve works; warnings need judgement.
 *   2. Links to open the LinkedIn profile, the CV and the full profile.
 *   3. Candidates: "I opened their LinkedIn and it matches" (LinkedIn blocks
 *      automatic checks, so a person confirms it).
 *   4. Approve, or "Not approved" with one of the 2 fixed reasons.
 *
 * Built on <dialog>, like ConfirmDialog: Esc closes, focus stays inside.
 */

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, UserRound, XCircle } from "lucide-react";

import { backendUrl, errorText } from "@/app/api/client";
import { Avatar, Badge, cx } from "@/app/components/ui";
import { API_ROUTES } from "@/app/config/apiRoutes";
import type { RejectionReason } from "@/app/config/constants";
import { ROUTES } from "@/app/config/routes";
import * as adminApi from "@/app/services/admin";
import type { AdminUser, ApprovalReview as Review } from "../types";
import styles from "./review.module.css";

type Props = {
  user: AdminUser;
  onClose: () => void;
  /** Called with Django's updated user after Approve / Not approved. */
  onDecided: (updated: AdminUser, message: string) => void;
};

export default function ApprovalReview({ user, onClose, onDecided }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const name = adminApi.displayName(user);

  const [review, setReview] = useState<Review | null>(null);
  const [loadError, setLoadError] = useState("");
  const [linkedinChecked, setLinkedinChecked] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<RejectionReason | "">("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Open as a modal window.
  useEffect(() => {
    const element = dialogRef.current;
    if (element && !element.open) element.showModal();
  }, []);

  // Load the checks for this person.
  useEffect(() => {
    let isOpen = true;
    adminApi
      .getApprovalReview(user.id)
      .then((data) => {
        if (isOpen) setReview(data);
      })
      .catch((error: unknown) => {
        if (isOpen) setLoadError(errorText(error, "Couldn't load the checks."));
      });
    return () => {
      isOpen = false;
    };
  }, [user.id]);

  const linkedinCheck = review?.checks.find((item) => item.key === "linkedin_format");
  const approveReady = Boolean(review?.canApprove) && (!review?.needsLinkedinCheck || linkedinChecked);

  // Why Approve is greyed out, in plain words (shown when you point at it).
  let approveHint: string | undefined;
  if (review && !review.canApprove) approveHint = "Every required check must pass first";
  else if (review?.needsLinkedinCheck && !linkedinChecked) approveHint = "Open their LinkedIn and tick the box first";

  async function decide(decision: adminApi.ApprovalDecision) {
    if (saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const updated = await adminApi.decideApproval(user.id, decision);
      onDecided(
        updated,
        decision.status === "approved"
          ? `${name} is approved and can now use the network.`
          : `${name} was marked as not approved. They can fix their profile and send it again.`
      );
    } catch (error) {
      setSaveError(errorText(error, "That didn't work. Please try again."));
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <div className={styles.box}>
        <header className={styles.header}>
          <Avatar name={name} size={48} />
          <div className={styles.who}>
            <h2 id={titleId} className={styles.title}>
              Review {name}
            </h2>
            <p className={styles.meta}>
              <Badge tone="neutral">{user.role === "recruiter" ? "Recruiter" : "Candidate"}</Badge>
              <span>{user.email}</span>
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close" disabled={saving}>
            <XCircle size={22} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.links}>
          <Link href={ROUTES.USER_PROFILE(user.id)} target="_blank" className={styles.link}>
            <UserRound size={16} aria-hidden="true" /> Full profile
          </Link>
          {user.role === "candidate" && (
            <a href={backendUrl(API_ROUTES.PROFILES.USER_CV(user.id))} target="_blank" rel="noreferrer" className={styles.link}>
              <FileText size={16} aria-hidden="true" /> Open CV
            </a>
          )}
          {linkedinCheck?.detail && (
            <a href={linkedinCheck.detail} target="_blank" rel="noreferrer noopener" className={styles.link}>
              <ExternalLink size={16} aria-hidden="true" /> Open LinkedIn
            </a>
          )}
        </div>

        {loadError && <p className="form-error">{loadError}</p>}
        {!review && !loadError && <p className={styles.loading}>Running the checks...</p>}

        {review && (
          <ul className={styles.checks}>
            {review.checks.map((item) => (
              <li
                key={item.key}
                className={cx(styles.check, item.passed ? styles.pass : item.required ? styles.fail : styles.warn)}
              >
                {item.passed ? (
                  <CheckCircle2 size={18} aria-label="Passed" />
                ) : item.required ? (
                  <XCircle size={18} aria-label="Failed" />
                ) : (
                  <AlertTriangle size={18} aria-label="Warning" />
                )}
                <span className={styles.checkText}>
                  <span>{item.label}</span>
                  {!item.passed && item.detail && <span className={styles.detail}>{item.detail}</span>}
                </span>
                {!item.passed && <span className={styles.tag}>{item.required ? "Required" : "Check by hand"}</span>}
              </li>
            ))}
          </ul>
        )}

        {review?.needsLinkedinCheck && (
          <label className={styles.confirm}>
            <input
              type="checkbox"
              checked={linkedinChecked}
              onChange={(event) => setLinkedinChecked(event.target.checked)}
            />
            I opened their LinkedIn: it works and matches the name and headline.
          </label>
        )}

        {rejecting && review && (
          <fieldset className={styles.reasons}>
            <legend>Why not? They will see this reason.</legend>
            {review.rejectionReasons.map((option) => (
              <label key={option.value} className={styles.reason}>
                <input
                  type="radio"
                  name="reason"
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
        )}

        {saveError && (
          <p className="form-error" role="alert">
            {saveError}
          </p>
        )}

        <footer className={styles.actions}>
          {rejecting ? (
            <>
              <button type="button" className="btn-outline" onClick={() => setRejecting(false)} disabled={saving}>
                Back
              </button>
              <button
                type="button"
                className={cx("btn-primary", styles.danger)}
                disabled={saving || !reason}
                onClick={() => reason && decide({ status: "rejected", reason })}
              >
                {saving ? "Saving..." : "Mark as not approved"}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-outline" onClick={() => setRejecting(true)} disabled={saving || !review}>
                Not approved...
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving || !approveReady}
                onClick={() => decide({ status: "approved", linkedinChecked })}
                title={approveHint}
              >
                {saving ? "Approving..." : "Approve"}
              </button>
            </>
          )}
        </footer>
      </div>
    </dialog>
  );
}
