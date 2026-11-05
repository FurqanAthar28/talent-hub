import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import styles from "../../dashboard.module.css";

export type Shortcut = {
  icon: LucideIcon;
  title: string;
  text: string;
  href: string;
};

/** A short list of places to go next, each with one line saying why. */
export default function ShortcutList({ title, shortcuts }: { title: string; shortcuts: Shortcut[] }) {
  return (
    <section className={styles.panel} aria-labelledby="shortcuts-title">
      <h2 id="shortcuts-title" className={styles.panelTitle}>
        {title}
      </h2>

      <ul className={styles.links}>
        {shortcuts.map((shortcut) => {
          const Icon = shortcut.icon;
          return (
            <li key={shortcut.href}>
              <Link href={shortcut.href} className={styles.linkRow}>
                <span className={styles.linkIcon}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span>
                  <span className={styles.linkTitle}>{shortcut.title}</span>
                  <span className={styles.linkText}>{shortcut.text}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
