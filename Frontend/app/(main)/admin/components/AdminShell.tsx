"use client";

/**
 * The frame of the admin area:
 *   desktop -> a dark sidebar on the left (sticky), the section on the right
 *   phone   -> the section full width, and a bottom bar with the main
 *              sections + "More" (Activity log, Page texts)
 *
 * It only draws the frame. Which section is open lives in the admin page.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal, ShieldCheck, X } from "lucide-react";

import { Avatar, cx } from "@/app/components/ui";
import { SECTION_GROUPS, SECTIONS, sectionById, type SectionId } from "../sections";
import styles from "../shell.module.css";

type Props = {
  active: SectionId;
  onChange: (id: SectionId) => void;
  /** Small numbers next to a section, e.g. { approvals: 3 }. */
  counts: Partial<Record<SectionId, number>>;
  adminName: string;
  /** Buttons on the right of the section title. */
  actions?: ReactNode;
  children: ReactNode;
};

export default function AdminShell({ active, onChange, counts, adminName, actions, children }: Props) {
  const section = sectionById(active);
  const [moreOpen, setMoreOpen] = useState(false);
  const sheetRef = useRef<HTMLDialogElement>(null);

  // The "More" sheet is a real <dialog>: Escape closes it and focus stays inside.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    if (moreOpen && !sheet.open) sheet.showModal();
    if (!moreOpen && sheet.open) sheet.close();
  }, [moreOpen]);

  function go(id: SectionId) {
    setMoreOpen(false);
    onChange(id);
  }

  const count = (id: SectionId) => {
    const value = counts[id];
    return value ? <span className={styles.navCount}>{value}</span> : null;
  };

  const phoneSections = SECTIONS.filter((item) => item.onPhone);
  const moreSections = SECTIONS.filter((item) => !item.onPhone);
  const moreIsActive = moreSections.some((item) => item.id === active);

  return (
    <div className={styles.shell}>
      <aside className={styles.rail} aria-label="Admin">
        <div className={styles.identity}>
          <Avatar name={adminName} size={40} />
          <div className={styles.identityText}>
            <strong>{adminName}</strong>
            <span>
              <ShieldCheck size={13} aria-hidden="true" /> Super admin
            </span>
          </div>
        </div>

        <nav aria-label="Admin sections">
          {SECTION_GROUPS.map((group) => (
            <div key={group} className={styles.navGroup}>
              <span className={styles.navHeading}>{group}</span>
              {SECTIONS.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon;
                const isActive = item.id === active;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cx(styles.navItem, isActive && styles.navItemActive)}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => go(item.id)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                    {count(item.id)}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>{section.label}</h1>
            <p className={styles.intro}>{section.intro}</p>
          </div>
          {actions && <div className={styles.headerActions}>{actions}</div>}
        </header>
        {children}
      </main>

      {/* Phones: the bottom bar. */}
      <nav className={styles.bottomBar} aria-label="Admin sections">
        {phoneSections.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              className={cx(styles.barItem, isActive && styles.barItemActive)}
              aria-current={isActive ? "page" : undefined}
              onClick={() => go(item.id)}
            >
              <span className={styles.barIcon}>
                <Icon size={20} aria-hidden="true" />
                {counts[item.id] ? <span className={styles.barDot}>{counts[item.id]}</span> : null}
              </span>
              {item.label}
            </button>
          );
        })}
        <button
          type="button"
          className={cx(styles.barItem, moreIsActive && styles.barItemActive)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
        >
          <span className={styles.barIcon}>
            <MoreHorizontal size={20} aria-hidden="true" />
          </span>
          More
        </button>
      </nav>

      <dialog
        ref={sheetRef}
        className={styles.sheet}
        aria-label="More admin sections"
        onClose={() => setMoreOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setMoreOpen(false); // tap outside the sheet
        }}
      >
        <div className={styles.sheetHead}>
          <strong>More</strong>
          <button type="button" className={styles.sheetClose} onClick={() => setMoreOpen(false)} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {moreSections.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={cx(styles.sheetItem, item.id === active && styles.sheetItemActive)}
              onClick={() => go(item.id)}
            >
              <Icon size={20} aria-hidden="true" />
              <span>
                <strong>{item.label}</strong>
                <small>{item.intro}</small>
              </span>
            </button>
          );
        })}
      </dialog>
    </div>
  );
}
