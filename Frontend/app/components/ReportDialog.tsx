"use client";

/**
 * The "Report" box: pick a reason, optionally say more, send.
 * Used on someone's profile, on a message in a chat, and on a job post.
 *
 * HOW TO USE
 *   const [reporting, setReporting] = useState<ReportTarget | null>(null);
 *   ...
 *   {reporting && <ReportDialog target={reporting} name="Ali" onClose={() => setReporting(null)} />}
 *
 * After sending it shows Django's thank-you sentence, then the person closes it.
 * Built on <dialog>, like ConfirmDialog: Esc closes it and focus stays inside.
 */

import { useEffect, useId, useRef, useState } from "react";
import { CircleCheck } from "lucide-react";

import { errorText } from "../api/client";
import {
  REPORT_DETAILS_MAX_LENGTH,
  REPORT_REASONS,
  sendReport,
  type ReportReasonValue,
  type ReportTarget,
} from "../services/reports";
import styles from "./report.module.css";

type Props = {
  target: ReportTarget;
  /** The person's name, for the title ("Report Ali Khan"). */
  name: string;
  /** For a message: a short copy of it, so they see what they report. */
  messagePreview?: string;
  /** For a job: its title, shown the same way. */
  jobTitle?: string;
  onClose: () => void;
};

/** What the box talks about, e.g. "Why are you reporting this job?" */
const WHAT: Record<ReportTarget["kind"], string> = {
  profile: "this profile",
  message: "this message",
  job: "this job",
};

export default function ReportDialog({ target, name, messagePreview, jobTitle, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const detailsId = useId();

  const [reason, setReason] = useState<ReportReasonValue | "">("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [thanks, setThanks] = useState("");

  useEffect(() => {
    const element = dialogRef.current;
    if (element && !element.open) element.showModal();
  }, []);

  const detailsMissing = reason === "other" && details.trim() === "";
  const canSend = reason !== "" && !detailsMissing && !sending;

  async function handleSend() {
    if (!canSend || !reason) return;
    setSending(true);
    setError("");
    try {
      setThanks(await sendReport(target, reason, details.trim()));
    } catch (problem) {
      setError(errorText(problem, "Couldn't send the report. Please try again."));
    } finally {
      setSending(false);
    }
  }

  const what = WHAT[target.kind];
  const title =
    target.kind === "job"
      ? "Report this job"
      : target.kind === "message"
        ? `Report a message from ${name}`
        : `Report ${name}`;
  const preview = target.kind === "job" ? jobTitle : messagePreview;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose(); // click outside the box
      }}
    >
      {thanks ? (
        <div className={styles.box}>
          <div className={styles.done}>
            <CircleCheck size={36} aria-hidden="true" />
            <h2 id={titleId} className={styles.title}>
              Report sent
            </h2>
            <p className={styles.text}>{thanks}</p>
            <p className={styles.small}>{`${name} won't know who reported them.`}</p>
          </div>
          <div className={styles.actions}>
            <button type="button" className="btn-primary" onClick={onClose} autoFocus>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form
          className={styles.box}
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
        >
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <p className={styles.text}>
            {`Tell the admins what's wrong with ${what}. ${name} won't know who reported them.`}
          </p>

          {preview && <blockquote className={styles.quote}>{preview}</blockquote>}

          <fieldset className={styles.reasons}>
            <legend>Why are you reporting {what}?</legend>
            {REPORT_REASONS.map((option) => (
              <label key={option.value} className={styles.reason}>
                <input
                  type="radio"
                  name="report-reason"
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>

          <div className={styles.details}>
            <label htmlFor={detailsId}>
              Tell us more {reason === "other" ? "(needed)" : "(optional)"}
            </label>
            <textarea
              id={detailsId}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={REPORT_DETAILS_MAX_LENGTH}
              rows={3}
              placeholder="What happened? Links or examples help."
            />
            <span className={styles.counter}>
              {details.length}/{REPORT_DETAILS_MAX_LENGTH}
            </span>
          </div>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <div className={styles.actions}>
            <button type="button" className="btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!canSend}>
              {sending ? "Sending..." : "Send report"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
