import { Type } from "lucide-react";

import { EmptyState, ui } from "@/app/components/ui";
import type { AdminUiContentItem } from "../types";
import styles from "../admin.module.css";

type TextFn = (key: string, fallback: string) => string;

type Props = {
  text: TextFn;
  items: AdminUiContentItem[];
  totalCount: number;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  draftValues: Record<string, string>;
  setDraftValue: (key: string, value: string) => void;
  savingKey: string | null;
  onSave: (item: AdminUiContentItem) => void;
};

/** Edit the texts shown in the app (buttons, messages, emails) without code. */
export default function UiContentSection({
  text,
  items,
  totalCount,
  searchTerm,
  setSearchTerm,
  draftValues,
  setDraftValue,
  savingKey,
  onSave,
}: Props) {
  return (
    <section className={`${ui.panel} ${ui.panelFlush}`} aria-label="Page texts">
      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.search}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={text("adminUiContentSearchPlaceholder", "Search texts")}
          aria-label="Search texts"
        />
        <span className={styles.count}>
          {items.length === totalCount ? `${totalCount} texts` : `${items.length} of ${totalCount} texts`}
        </span>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Type} title={text("adminNoUiContent", "No texts found")} text="Try another word." />
      ) : (
        <ul className={ui.list}>
          {items.map((item) => {
            const draft = draftValues[item.key] ?? item.value;
            const changed = draft !== item.value;
            return (
              <li key={item.key} className={styles.textRow}>
                <label htmlFor={`text-${item.key}`} className={styles.textKey}>
                  {item.key}
                </label>
                <textarea
                  id={`text-${item.key}`}
                  className={styles.textarea}
                  value={draft}
                  onChange={(event) => setDraftValue(item.key, event.target.value)}
                  rows={Math.min(4, Math.max(1, Math.ceil(draft.length / 70)))}
                />
                <button
                  type="button"
                  className={changed ? "btn-primary btn-sm" : "btn-outline btn-sm"}
                  onClick={() => onSave(item)}
                  disabled={!changed || savingKey === item.key}
                >
                  {savingKey === item.key ? "Saving..." : "Save"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
