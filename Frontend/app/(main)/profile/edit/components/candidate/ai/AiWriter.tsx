/**
 * "Write with AI" for the headline and bio boxes.
 *
 * One click asks for everything at once: 3 headlines and 2 bios. Picking an
 * option only fills the box, so the candidate can edit it. NOTHING is saved
 * until they press "Save changes".
 *
 * If the AI fails, only this small part shows a message. The form still works.
 */

import { useState, type ReactNode } from "react";

import { apiFetch, getApiMessage, readJson } from "../../../../../../api/client";
import { API_ROUTES } from "../../../../../../config/apiRoutes";
import styles from "../../../edit.module.css";

export type AiField = "headline" | "bio";

type AiOptions = {
  headlines: string[];
  bios: { short: string; long: string };
};

const UNAVAILABLE_MESSAGE = "AI is unavailable right now.";

export function useAiWriter(fillBox: (field: AiField, text: string) => void) {
  const [options, setOptions] = useState<AiOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Which button was clicked, so the error appears next to it.
  const [clickedField, setClickedField] = useState<AiField>("headline");

  async function generate(field: AiField) {
    if (loading) return;

    setClickedField(field);
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch(API_ROUTES.AI.HEADLINE_BIO, { method: "POST" });
      const data = await readJson(response);

      if (response.ok) {
        setOptions(data as unknown as AiOptions);
      } else if (response.status >= 500) {
        setError(UNAVAILABLE_MESSAGE);
      } else {
        // For example: "You've used all 10 AI uses for today."
        setError(getApiMessage(data) || UNAVAILABLE_MESSAGE);
      }
    } catch {
      setError(UNAVAILABLE_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  return { options, loading, error, clickedField, generate, fillBox };
}

export type AiWriter = ReturnType<typeof useAiWriter>;

type RowProps = {
  ai?: AiWriter; // only candidates get it
  field: AiField;
  children: ReactNode;
};

/** The box's label, with the "Write with AI" button beside it. */
export function AiLabelRow({ ai, field, children }: RowProps) {
  if (!ai) return <>{children}</>;

  return (
    <div className={styles.aiLabelRow}>
      {children}
      {/* type="button": without it, this button would submit (save) the form. */}
      <button
        type="button"
        className="btn-outline btn-sm"
        disabled={ai.loading}
        onClick={() => void ai.generate(field)}
      >
        {ai.loading ? "Writing..." : "Write with AI"}
      </button>
    </div>
  );
}

type OptionsProps = {
  ai?: AiWriter;
  field: AiField;
  currentValue: string; // what's in the box now, to mark the option in use
};

/** The options to choose from. They appear below the box. */
export function AiOptionList({ ai, field, currentValue }: OptionsProps) {
  if (!ai) return null;

  const showError = ai.error && ai.clickedField === field;

  const choices =
    field === "headline"
      ? ai.options?.headlines.map((text) => ({ label: "", text }))
      : ai.options && [
          { label: "Short", text: ai.options.bios.short },
          { label: "Longer", text: ai.options.bios.long },
        ];

  return (
    <div aria-live="polite">
      {showError && <p className={styles.aiError}>{ai.error}</p>}

      {choices && (
        <div className={styles.aiOptions}>
          <p className={styles.aiHint}>
            Pick one to fill the box, then edit it if you like. Check that it&apos;s accurate:
            nothing is saved until you press Save changes.
          </p>

          {choices.map((choice) => (
            <button
              key={choice.text}
              type="button"
              className={styles.aiOption}
              aria-pressed={currentValue === choice.text}
              onClick={() => ai.fillBox(field, choice.text)}
            >
              {choice.label && <span className={styles.aiOptionLabel}>{choice.label}</span>}
              {choice.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
