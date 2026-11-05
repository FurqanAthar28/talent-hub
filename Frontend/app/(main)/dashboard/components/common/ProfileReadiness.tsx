import Link from "next/link";
import { Check, PenLine } from "lucide-react";
import type { CSSProperties } from "react";

import type { ChecklistItem } from "@/app/services/profiles";
import { actionForChecklistItem, linkForChecklistItem } from "../../checklistLinks";
import styles from "../../dashboard.module.css";

type ProfileReadinessProps = {
  percent: number;
  checklist: ChecklistItem[];
  audience: string; // who looks at this profile: "recruiters" or "candidates"
};

/**
 * "Your profile is 64% ready": a bar made of the REAL checklist items
 * (Headline, Bio, CV...). Done pieces are filled in. Every missing item
 * is a link straight to the right place on the edit page.
 */
export default function ProfileReadiness({ percent, checklist, audience }: ProfileReadinessProps) {
  const missing = checklist.filter((item) => !item.done);
  const doneCount = checklist.length - missing.length;
  const isComplete = missing.length === 0;

  return (
    <section className={`${styles.panel} ${styles.readiness}`} aria-labelledby="readiness-title">
      <h2 id="readiness-title" className={styles.readinessTitle}>
        {isComplete ? "Your profile is complete" : `Your profile is ${percent}% ready for ${audience}`}
      </h2>
      <p className={styles.readinessMeta}>
        {isComplete
          ? `All ${checklist.length} items are done. Keep it up to date as things change.`
          : `${doneCount} of ${checklist.length} items done. Complete profiles show up higher in searches.`}
      </p>

      {/* --count tells the CSS how many pieces the bar has. */}
      <ol className={styles.checklist} style={{ "--count": checklist.length } as CSSProperties}>
        {checklist.map((item) => (
          <li
            key={item.label}
            className={`${styles.checkItem} ${item.done ? styles.checkItemDone : ""}`}
          >
            <span className={styles.checkLabel}>
              {item.done && <Check size={12} aria-hidden="true" />}
              {item.label}
              <span className="sr-only">{item.done ? " (done)" : " (missing)"}</span>
            </span>
          </li>
        ))}
      </ol>

      {!isComplete && (
        <div className={styles.missing}>
          <span className={styles.missingLabel}>Still missing:</span>
          {missing.map((item) => (
            <Link key={item.label} href={linkForChecklistItem(item.label)} className={styles.chip}>
              <PenLine size={14} aria-hidden="true" />
              {actionForChecklistItem(item.label)}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
