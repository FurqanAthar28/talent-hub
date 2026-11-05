/**
 * The numbers behind the admin Overview: trends, daily sign-ups, role mix.
 *
 * Everything is worked out here, in the browser, from lists the admin page
 * already loaded (users, connections, admin actions). No extra requests.
 * Plain functions, no React: easy to read and easy to test.
 */

import { accountState, daysLeft, isNetworkUser, isWaitingForApproval } from "@/app/services/admin";
import type { AdminAuditLog, AdminConnection, AdminUser } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many days the sign-ups chart and the sparklines show. */
export const CHART_DAYS = 14;
/** "This week" vs "last week" for the trend arrows. */
export const TREND_DAYS = 7;
/** A deletion "ends soon" when it becomes permanent within this many days. */
export const ENDING_SOON_DAYS = 7;

/** Midnight (local time) at the start of `date`'s day. */
function startOfDay(date: Date): number {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

export type Day = { start: number; label: string; count: number };

/** One entry per day for the last `days` days (oldest first), counting `dates` that fall on each. */
export function perDay(dates: (string | null)[], days = CHART_DAYS, now = new Date()): Day[] {
  const today = startOfDay(now);
  const buckets: Day[] = Array.from({ length: days }, (_, index) => {
    const start = today - (days - 1 - index) * DAY_MS;
    const label = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(start);
    return { start, label, count: 0 };
  });
  const first = buckets[0].start;

  for (const value of dates) {
    if (!value) continue;
    const day = startOfDay(new Date(value));
    if (day < first || day > today) continue;
    buckets[Math.round((day - first) / DAY_MS)].count += 1;
  }
  return buckets;
}

export type Trend = { current: number; previous: number; change: number | null };

/**
 * Last 7 days vs the 7 days before. `change` is a percent, or null when
 * there's nothing to compare with (0 last week: "+100%" would be silly).
 */
export function weekTrend(dates: (string | null)[], now = new Date()): Trend {
  const end = now.getTime();
  const weekStart = end - TREND_DAYS * DAY_MS;
  const previousStart = weekStart - TREND_DAYS * DAY_MS;
  let current = 0;
  let previous = 0;

  for (const value of dates) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (time > weekStart && time <= end) current += 1;
    else if (time > previousStart && time <= weekStart) previous += 1;
  }
  const change = previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
  return { current, previous, change };
}

/** A running total per day (for the "members" sparkline). */
export function runningTotal(dates: (string | null)[], days = CHART_DAYS, now = new Date()): number[] {
  const daily = perDay(dates, days, now);
  const before = dates.filter((value) => value && new Date(value).getTime() < daily[0].start).length;
  let total = before;
  return daily.map((day) => (total += day.count));
}

export type Insights = {
  members: number; // approved, active candidates + recruiters
  waiting: AdminUser[];
  problemAccounts: number; // suspended + banned
  endingSoon: AdminUser[]; // deleted accounts that become permanent within ENDING_SOON_DAYS
  signups: Day[];
  signupTrend: Trend;
  memberLine: number[];
  connectionTrend: Trend;
  connectionLine: number[];
  roles: { candidates: number; recruiters: number };
  actionsThisWeek: number;
};

export function buildInsights(users: AdminUser[], connections: AdminConnection[], logs: AdminAuditLog[]): Insights {
  const people = users.filter((user) => user.role !== "admin");
  const joined = people.map((user) => user.date_joined);
  const connected = connections.map((connection) => connection.createdAt);
  const network = people.filter(isNetworkUser);

  return {
    members: network.length,
    waiting: users.filter(isWaitingForApproval),
    problemAccounts: users.filter((user) => ["suspended", "banned"].includes(accountState(user))).length,
    endingSoon: users.filter(
      (user) => accountState(user) === "deleted" && user.restoreUntil && daysLeft(user.restoreUntil) <= ENDING_SOON_DAYS
    ),
    signups: perDay(joined),
    signupTrend: weekTrend(joined),
    memberLine: runningTotal(network.map((user) => user.date_joined)),
    connectionTrend: weekTrend(connected),
    connectionLine: runningTotal(connected),
    roles: {
      candidates: network.filter((user) => user.role === "candidate").length,
      recruiters: network.filter((user) => user.role === "recruiter").length,
    },
    actionsThisWeek: weekTrend(logs.map((log) => log.createdAt)).current,
  };
}
