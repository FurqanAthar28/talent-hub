"use client";

/**
 * A box that turns what you type into chips: type "Backend Engineer",
 * press Enter (or a comma), and it becomes a chip with an × to remove it.
 *
 * - `suggestions` (optional) show as a dropdown while typing (a <datalist>).
 * - Repeats are ignored (upper/lower case doesn't matter), like in Django.
 * - Stops at `max` items, and each item at `maxLength` characters.
 */

import { useId, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

import styles from "./recruiter.module.css";

type Props = {
  id: string;
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  max: number;
  maxLength: number;
  placeholder?: string;
  suggestions?: string[];
};

export default function TagInput({ id, label, hint, values, onChange, max, maxLength, placeholder, suggestions }: Props) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const hintId = useId();
  const full = values.length >= max;

  function add(raw: string) {
    const item = raw.replace(/\s+/g, " ").trim().slice(0, maxLength);
    setDraft("");
    if (!item || full) return;
    if (values.some((value) => value.toLowerCase() === item.toLowerCase())) return;
    onChange([...values, item]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault(); // Enter must not submit the whole form
      add(draft);
    } else if (event.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1)); // empty box + Backspace removes the last chip
    }
  }

  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <div className={styles.tagBox}>
        {values.map((value) => (
          <span key={value} className={styles.chip}>
            {value}
            <button
              type="button"
              className={styles.chipRemove}
              onClick={() => onChange(values.filter((item) => item !== value))}
              aria-label={`Remove ${value}`}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          className={styles.tagInput}
          value={draft}
          onChange={(event) => {
            // A pasted "a, b, c" becomes three chips.
            const text = event.target.value;
            if (text.includes(",")) {
              text.split(",").slice(0, -1).forEach(add);
              setDraft(text.split(",").at(-1) ?? "");
            } else {
              setDraft(text);
            }
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => add(draft)}
          placeholder={full ? `Up to ${max}` : placeholder}
          disabled={full}
          maxLength={maxLength}
          list={suggestions?.length ? listId : undefined}
          aria-describedby={hintId}
        />
      </div>
      {suggestions?.length ? (
        <datalist id={listId}>
          {suggestions
            .filter((option) => !values.some((value) => value.toLowerCase() === option.toLowerCase()))
            .map((option) => (
              <option key={option} value={option} />
            ))}
        </datalist>
      ) : null}
      <p id={hintId} className={styles.fieldHint}>
        {hint ? `${hint} ` : ""}Press Enter to add. {values.length}/{max}
      </p>
    </div>
  );
}

/** A row of on/off chips for a short fixed list (work style, experience level). */
export function ChoiceChips({
  legend,
  options,
  values,
  onChange,
}: {
  legend: string;
  options: readonly { value: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset className={`form-group ${styles.choiceGroup}`}>
      <legend>{legend}</legend>
      <div className={styles.choices}>
        {options.map((option) => {
          const on = values.includes(option.value);
          return (
            <label key={option.value} className={`${styles.choice} ${on ? styles.choiceOn : ""}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={() =>
                  // Keep the options' own order, whatever order they were clicked in.
                  onChange(
                    options
                      .map((item) => item.value)
                      .filter((value) => (value === option.value ? !on : values.includes(value)))
                  )
                }
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
