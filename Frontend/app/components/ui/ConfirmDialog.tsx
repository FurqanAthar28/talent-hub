"use client";

/**
 * "Are you sure?" boxes, in the app's own style (instead of the browser's
 * plain window.confirm / window.prompt pop-ups).
 *
 * HOW TO USE
 *   const { confirm, dialog } = useConfirm();
 *   ...
 *   const answer = await confirm({ title: "Suspend Ali?", text: "...", confirmLabel: "Suspend", tone: "danger" });
 *   if (!answer.confirmed) return;
 *   ...
 *   return <>{...page...}{dialog}</>;
 *
 * Add `note: { label: "Reason" }` to ask for a short text too; it comes back as answer.note.
 *
 * Built on the browser's <dialog> element, so keyboard users get the right
 * behaviour for free: focus stays inside, Esc cancels, screen readers
 * announce it as a dialog.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { cx } from "./index";
import styles from "./confirm.module.css";

export type ConfirmOptions = {
  title: string;
  text: string;
  confirmLabel: string;
  /** "danger" = red button, for things that take something away. */
  tone?: "danger" | "primary";
  /** Ask for a short text as well (e.g. a reason). */
  note?: { label: string; placeholder?: string; maxLength: number; required?: boolean };
};

export type ConfirmAnswer = { confirmed: boolean; note: string };

type Request = ConfirmOptions & { resolve: (answer: ConfirmAnswer) => void };

export function useConfirm() {
  const [request, setRequest] = useState<Request | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<ConfirmAnswer>((resolve) => setRequest({ ...options, resolve })),
    []
  );

  const dialog = request ? (
    <ConfirmDialog
      // A new key per question, so the note box starts empty every time.
      key={`${request.title}-${request.confirmLabel}`}
      {...request}
      onClose={(answer) => {
        request.resolve(answer);
        setRequest(null);
      }}
    />
  ) : null;

  return { confirm, dialog };
}

function ConfirmDialog({
  title,
  text,
  confirmLabel,
  tone = "primary",
  note,
  onClose,
}: ConfirmOptions & { onClose: (answer: ConfirmAnswer) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [noteText, setNoteText] = useState("");
  const titleId = useId();
  const textId = useId();
  const noteId = useId();

  // Open as a "modal": the page behind can't be clicked until this closes.
  useEffect(() => {
    const element = dialogRef.current;
    if (element && !element.open) element.showModal();
  }, []);

  const noteMissing = Boolean(note?.required) && noteText.trim() === "";

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={textId}
      // Esc key: the browser fires "cancel". Treat it as "No".
      onCancel={(event) => {
        event.preventDefault();
        onClose({ confirmed: false, note: "" });
      }}
      // A click on the dark area outside the box also means "No".
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose({ confirmed: false, note: "" });
      }}
    >
      <form
        method="dialog"
        className={styles.box}
        onSubmit={(event) => {
          event.preventDefault();
          if (!noteMissing) onClose({ confirmed: true, note: noteText.trim() });
        }}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p id={textId} className={styles.text}>
          {text}
        </p>

        {note && (
          <div className={styles.note}>
            <label htmlFor={noteId}>{note.label}</label>
            <textarea
              id={noteId}
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder={note.placeholder}
              maxLength={note.maxLength}
              rows={3}
              autoFocus
            />
            <span className={styles.counter}>
              {noteText.length}/{note.maxLength}
            </span>
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className="btn-outline"
            onClick={() => onClose({ confirmed: false, note: "" })}
            autoFocus={!note}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={cx("btn-primary", tone === "danger" && styles.danger)}
            disabled={noteMissing}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
