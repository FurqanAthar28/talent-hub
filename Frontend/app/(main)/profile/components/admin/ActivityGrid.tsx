/**
 * 12 weeks of admin work, one small square per day (like a contribution graph).
 * Darker square = more actions that day. Columns are weeks, rows are Mon..Sun.
 *
 * The numbers come from Django (GET /api/admin/me/), already one entry per day.
 */

import type { CSSProperties } from "react";

import { cx } from "@/app/components/ui";
import styles from "./adminProfile.module.css";

type Day = { date: string; count: number };

// How many shades a busy day can have (0 = nothing that day).
const LEVELS = 4;
const LEVEL_CLASSES = [styles.level0, styles.level1, styles.level2, styles.level3, styles.level4];

const dayFormat = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** "2026-11-03" -> a Date at midnight UTC (Django counts days in UTC). */
function utcDate(isoDay: string) {
  return new Date(`${isoDay}T00:00:00Z`);
}

/** 0 for a quiet day, otherwise 1..4 compared with the busiest day. */
function levelFor(count: number, busiest: number) {
  if (count === 0 || busiest === 0) return 0;
  return Math.max(1, Math.ceil((count / busiest) * LEVELS));
}

function describe(day: Day) {
  const when = dayFormat.format(utcDate(day.date));
  if (day.count === 0) return `No actions on ${when}`;
  return `${day.count} ${day.count === 1 ? "action" : "actions"} on ${when}`;
}

export default function ActivityGrid({ days }: { days: Day[] }) {
  if (days.length === 0) return null;

  const busiest = Math.max(...days.map((day) => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);

  // Empty spots before the first day, so every row is one weekday (Monday on top).
  const mondayFirst = (utcDate(days[0].date).getUTCDay() + 6) % 7;

  return (
    <figure className={styles.gridFigure}>
      {/* role="img" + label: a screen reader hears one summary, not 84 squares. */}
      <div
        className={styles.grid}
        role="img"
        aria-label={`${total} admin actions in the last ${Math.round(days.length / 7)} weeks`}
      >
        {Array.from({ length: mondayFirst }, (_, index) => (
          <span key={`gap-${index}`} className={styles.cellGap} />
        ))}
        {days.map((day, index) => (
          <span
            key={day.date}
            className={cx(styles.cell, LEVEL_CLASSES[levelFor(day.count, busiest)])}
            // The squares appear one week after another (see .cell in the CSS).
            style={{ "--week": Math.floor((index + mondayFirst) / 7) } as CSSProperties}
            title={describe(day)}
          />
        ))}
      </div>

      <figcaption className={styles.gridCaption}>
        <span>12 weeks ago</span>
        <span className={styles.legend} aria-hidden="true">
          Less
          {LEVEL_CLASSES.map((levelClass) => (
            <span key={levelClass} className={cx(styles.cell, styles.legendCell, levelClass)} />
          ))}
          More
        </span>
        <span>Today</span>
      </figcaption>
    </figure>
  );
}
