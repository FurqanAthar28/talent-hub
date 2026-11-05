/**
 * Shared building blocks for the signed-in pages.
 * Every page uses these, so every page looks like it belongs to the same app.
 *
 *   <Page title="My network" subtitle="..." actions={<button/>}> ... </Page>
 *   <Panel title="Invitations" hint="2 waiting"> ... </Panel>
 *   <Avatar name="Ali Khan" size={48} />
 *   <Badge tone="success">Open to work</Badge>
 *   <EmptyState icon={Users} title="No connections yet" text="..." />
 *   <Tabs items={[...]} active="sent" onChange={setTab} />
 *   <Notice tone="error">Something went wrong</Notice>
 */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import styles from "./ui.module.css";

/** Join class names, skipping empty ones. */
export function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------

type PageProps = {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  narrow?: boolean; // for forms: a thinner page reads more easily
  children: ReactNode;
};

/** The frame of a page: title, short line under it, buttons on the right. */
export function Page({ title, subtitle, actions, narrow, children }: PageProps) {
  return (
    <main className={cx(styles.page, narrow && styles.pageNarrow)}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{title}</h1>
          {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={styles.pageActions}>{actions}</div>}
      </header>
      {children}
    </main>
  );
}

// ---------------------------------------------------------------------------

type PanelProps = {
  title?: string;
  hint?: ReactNode;
  actions?: ReactNode;
  flush?: boolean; // no inner padding (for lists that go edge to edge)
  id?: string;
  className?: string;
  children: ReactNode;
};

/** A plain white box with an optional title row. */
export function Panel({ title, hint, actions, flush, id, className, children }: PanelProps) {
  const titleId = id ? `${id}-title` : undefined;

  return (
    <section
      id={id}
      className={cx(styles.panel, flush && styles.panelFlush, className)}
      aria-labelledby={title ? titleId : undefined}
    >
      {(title || actions) && (
        <div className={styles.panelHeader}>
          <div>
            {title && (
              <h2 id={titleId} className={styles.panelTitle}>
                {title}
              </h2>
            )}
            {hint && <p className={styles.panelHint}>{hint}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------

const AVATAR_TONES = [
  styles.tone0,
  styles.tone1,
  styles.tone2,
  styles.tone3,
  styles.tone4,
  styles.tone5,
];

/** "Ali Khan" -> "AK" */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/**
 * Initials in a colored circle. The SAME name always gets the SAME color,
 * so people are easy to recognise in lists.
 */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  // A tiny "hash": add up the letter codes, pick one of 6 colors.
  const sum = [...name].reduce((total, letter) => total + letter.charCodeAt(0), 0);
  const tone = AVATAR_TONES[sum % AVATAR_TONES.length];

  return (
    <span
      className={cx(styles.avatar, tone)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}

// ---------------------------------------------------------------------------

type BadgeTone = "success" | "warning" | "danger" | "neutral" | "accent";

const BADGE_TONES: Record<BadgeTone, string> = {
  success: styles.badgeSuccess,
  warning: styles.badgeWarning,
  danger: styles.badgeDanger,
  neutral: styles.badgeNeutral,
  accent: styles.badgeAccent,
};

/** A small status label, like "Open to work" or "Pending". */
export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={cx(styles.badge, BADGE_TONES[tone])}>{children}</span>;
}

// ---------------------------------------------------------------------------

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: ReactNode;
};

/** What to show when a list is empty: what it is, and what to do next. */
export function EmptyState({ icon: Icon, title, text, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>
        <Icon size={22} aria-hidden="true" />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      {text && <p className={styles.emptyText}>{text}</p>}
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------

export type TabItem<Id extends string> = { id: Id; label: string; count?: number };

type TabsProps<Id extends string> = {
  items: TabItem<Id>[];
  active: Id;
  onChange: (id: Id) => void;
  label: string; // what the tabs are for, read by screen readers
};

/** A row of tabs. The active one is underlined in purple. */
export function Tabs<Id extends string>({ items, active, onChange, label }: TabsProps<Id>) {
  return (
    <div className={styles.tabs} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === active}
          className={cx(styles.tab, item.id === active && styles.tabActive)}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.count !== undefined && <span className={styles.tabCount}>{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

type NoticeProps = { tone?: "info" | "success" | "error"; children: ReactNode };

/** A message across the top of a page, e.g. "Request sent." */
export function Notice({ tone = "info", children }: NoticeProps) {
  return (
    <div
      className={cx(
        styles.notice,
        tone === "success" && styles.noticeSuccess,
        tone === "error" && styles.noticeError
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

/** The shared class names, for pages that need rows, stacks or columns. */
export { styles as ui };
