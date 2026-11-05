"use client";

/**
 * FormModal: the pop-up window with a form inside, used by
 * "Add/Edit project" and "Add/Edit experience".
 *
 * It takes care of the parts both pop-ups need:
 *   - a real <form>, so pressing Enter saves
 *   - the Escape key and the dark background close it (but not while saving)
 *   - the error message and the Save / Cancel buttons
 * Each pop-up only has to pass in its own input boxes (`children`).
 *
 * WHY createPortal?
 * These sections sit INSIDE the big "edit profile" <form>, and HTML does not
 * allow a form inside a form (the browser gets confused about which one
 * Enter should send). createPortal draws the pop-up at the end of <body>
 * instead, outside the big form.
 */

import { useEffect, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

type FormModalProps = {
  eyebrow: string;
  title: string;
  error: string;
  saving: boolean;
  saveLabel: string;
  canSave: boolean;
  onSave: () => void;
  onClose: () => void;
  children: ReactNode;
};

export default function FormModal({
  eyebrow,
  title,
  error,
  saving,
  saveLabel,
  canSave,
  onSave,
  onClose,
  children,
}: FormModalProps) {
  // Close with the Escape key. The "return" removes the listener again
  // when the pop-up closes.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [saving, onClose]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // don't reload the page
    // React still passes events from a portal up to the parent components,
    // so stop here: this must NOT also save the big profile form.
    event.stopPropagation();
    if (canSave && !saving) onSave();
  }

  function closeUnlessSaving() {
    if (!saving) onClose();
  }

  return createPortal(
    <div className="modal-overlay" onClick={closeUnlessSaving}>
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-modal-title"
        // A click INSIDE the window must not reach the background and close it.
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h3 id="form-modal-title">{title}</h3>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={closeUnlessSaving}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit} noValidate>
          {children}

          {error && (
            <p className="form-error text-sm" role="alert">
              {error}
            </p>
          )}

          <div className="modal-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={!canSave || saving}
            >
              {saving ? "Saving..." : saveLabel}
            </button>

            <button
              type="button"
              className="btn-outline"
              onClick={closeUnlessSaving}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
