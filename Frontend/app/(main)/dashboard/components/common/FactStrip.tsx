import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import styles from "../../dashboard.module.css";

export type Fact = {
  icon: LucideIcon;
  value: string | number;
  label: string;
  href?: string; // if set, the whole fact is a link
  positive?: boolean; // shows the value in green (e.g. "Open to work")
};

/** A row of 3 short facts, like "12 · people viewed your profile". */
export default function FactStrip({ facts }: { facts: Fact[] }) {
  return (
    <section className={`${styles.panel} ${styles.facts}`} aria-label="Your numbers">
      {facts.map((fact) => {
        const Icon = fact.icon;
        const content = (
          <>
            <Icon className={styles.factIcon} size={20} aria-hidden="true" />
            <span>
              <span
                className={[
                  styles.factValue,
                  typeof fact.value === "string" ? styles.factValueText : "",
                  fact.positive ? styles.factPositive : "",
                ].join(" ")}
              >
                {fact.value}
              </span>
              <span className={styles.factLabel}>{fact.label}</span>
            </span>
          </>
        );

        return fact.href ? (
          <Link key={fact.label} href={fact.href} className={styles.fact}>
            {content}
          </Link>
        ) : (
          <div key={fact.label} className={styles.fact}>
            {content}
          </div>
        );
      })}
    </section>
  );
}
