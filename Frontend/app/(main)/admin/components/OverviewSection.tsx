"use client";

/**
 * The admin's first screen, in the order an admin needs it:
 *   1. "Needs your attention"  -> people waiting, open reports, problem accounts, deletions ending soon
 *   2. Four key numbers         -> each with a this-week-vs-last-week trend
 *   3. Sign-ups per day         -> and who joined (candidates vs recruiters)
 *   4. Recent admin actions     -> and every platform number, folded away
 */

import { ArrowRight, CircleAlert, Clock, Flag, ShieldOff, TrendingDown, TrendingUp, UserCheck } from "lucide-react";

import { Avatar, cx } from "@/app/components/ui";
import { displayName } from "@/app/services/admin";
import type { UserFilter } from "../accountActions";
import { CHART_DAYS, ENDING_SOON_DAYS, TREND_DAYS, type Insights, type Trend } from "../insights";
import type { SectionId } from "../sections";
import type { AdminAuditLog, AdminStats, AdminUser } from "../types";
import styles from "../overview.module.css";
import { DailyBars, Sparkline, SplitBar } from "./Charts";
import StatsSection from "./StatsSection";

type TextFn = (key: string, fallback: string) => string;

type Props = {
  insights: Insights;
  stats: AdminStats | null;
  recentLogs: AdminAuditLog[];
  openReports: number; // reports no admin has handled yet
  text: TextFn;
  onReview: (user: AdminUser) => void;
  onOpen: (section: SectionId) => void;
  onOpenUsers: (filter: UserFilter) => void;
  formatDate: (value: string | null) => string;
};

// How many faces the attention card shows before "+3".
const FACES = 4;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "+12% vs last week", "No change", or "5 this week" when last week was empty. */
function TrendChip({ trend }: { trend: Trend }) {
  if (trend.change === null) {
    return <span className={styles.trendFlat}>{trend.current} in the last {TREND_DAYS} days</span>;
  }
  if (trend.change === 0) return <span className={styles.trendFlat}>Same as last week</span>;
  const up = trend.change > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={up ? styles.trendUp : styles.trendDown}>
      <Icon size={14} aria-hidden="true" />
      {up ? "+" : ""}
      {trend.change}% vs last week
    </span>
  );
}

/** Time since, in words: "just now", "3 h ago", "2 d ago", then the date. */
function timeAgo(value: string, formatDate: (value: string | null) => string) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days} d ago` : formatDate(value);
}

export default function OverviewSection({
  insights,
  stats,
  recentLogs,
  openReports,
  text,
  onReview,
  onOpen,
  onOpenUsers,
  formatDate,
}: Props) {
  const { waiting, problemAccounts, endingSoon } = insights;
  const allClear = waiting.length === 0 && openReports === 0 && problemAccounts === 0 && endingSoon.length === 0;
  const next = waiting[0];

  return (
    <div className={styles.overview}>
      {/* 1. Needs your attention: the first card on the page, with a colored edge. */}
      <section className={styles.attention} aria-labelledby="attention-title">
        <div className={styles.attentionMain}>
          {waiting.length > 0 ? (
            <>
              <h2 id="attention-title" className={styles.attentionTitle}>
                {plural(waiting.length, "person is", "people are")} waiting for your approval
              </h2>
              <p className={styles.attentionText}>
                They can&apos;t appear in search, connect or message anyone until you decide.
              </p>
              <div className={styles.faces}>
                <span className={styles.faceStack}>
                  {waiting.slice(0, FACES).map((user) => (
                    <Avatar key={user.id} name={displayName(user)} size={36} />
                  ))}
                </span>
                <span className={styles.faceNames}>
                  {waiting
                    .slice(0, 2)
                    .map((user) => displayName(user))
                    .join(", ")}
                  {waiting.length > 2 ? ` and ${waiting.length - 2} more` : ""}
                </span>
              </div>
              <div className={styles.attentionActions}>
                <button type="button" className={styles.inkPrimary} onClick={() => onReview(next)}>
                  <UserCheck size={18} aria-hidden="true" />
                  Review {displayName(next).split(" ")[0]}
                </button>
                <button type="button" className={styles.inkGhost} onClick={() => onOpen("approvals")}>
                  See everyone waiting
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 id="attention-title" className={styles.attentionTitle}>
                {allClear ? "You're all caught up" : "Nobody is waiting for approval"}
              </h2>
              <p className={styles.attentionText}>
                {allClear
                  ? "No approvals, no open reports, no problem accounts, no deletions ending soon. New sign-ups will show up here."
                  : "New candidates and recruiters will show up here. A few things still need a look:"}
              </p>
            </>
          )}
        </div>

        {(openReports > 0 || problemAccounts > 0 || endingSoon.length > 0) && (
          <ul className={styles.attentionSide}>
            {openReports > 0 && (
              <li>
                <button type="button" onClick={() => onOpen("reports")}>
                  <Flag size={18} aria-hidden="true" />
                  <span>
                    <strong>{plural(openReports, "open report", "open reports")}</strong> from users
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </li>
            )}
            {problemAccounts > 0 && (
              <li>
                <button type="button" onClick={() => onOpenUsers("suspended")}>
                  <ShieldOff size={18} aria-hidden="true" />
                  <span>
                    <strong>{plural(problemAccounts, "account", "accounts")}</strong> suspended or banned
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </li>
            )}
            {endingSoon.length > 0 && (
              <li>
                <button type="button" onClick={() => onOpenUsers("deleted")}>
                  <Clock size={18} aria-hidden="true" />
                  <span>
                    <strong>{plural(endingSoon.length, "deletion", "deletions")}</strong> become permanent within{" "}
                    {ENDING_SOON_DAYS} days
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </li>
            )}
          </ul>
        )}
      </section>

      {/* 2. Key numbers. */}
      <section className={styles.kpis} aria-label="Key numbers">
        <article className={styles.kpi}>
          <span className={styles.kpiLabel}>Members</span>
          <strong className={styles.kpiValue}>{insights.members}</strong>
          <TrendChip trend={insights.signupTrend} />
          <Sparkline values={insights.memberLine} />
          <span className={styles.kpiHint}>Approved candidates and recruiters</span>
        </article>

        <article className={styles.kpi}>
          <span className={styles.kpiLabel}>New sign-ups</span>
          <strong className={styles.kpiValue}>{insights.signupTrend.current}</strong>
          <TrendChip trend={insights.signupTrend} />
          <Sparkline values={insights.signups.map((day) => day.count)} />
          <span className={styles.kpiHint}>In the last {TREND_DAYS} days</span>
        </article>

        <article className={styles.kpi}>
          <span className={styles.kpiLabel}>Connections</span>
          <strong className={styles.kpiValue}>{stats?.connections ?? insights.connectionLine.at(-1) ?? 0}</strong>
          <TrendChip trend={insights.connectionTrend} />
          <Sparkline values={insights.connectionLine} />
          <span className={styles.kpiHint}>Pairs of people connected</span>
        </article>

        <article className={cx(styles.kpi, waiting.length > 0 && styles.kpiWarn)}>
          <span className={styles.kpiLabel}>Waiting for approval</span>
          <strong className={styles.kpiValue}>{waiting.length}</strong>
          <span className={styles.trendFlat}>
            {insights.actionsThisWeek} admin {insights.actionsThisWeek === 1 ? "action" : "actions"} this week
          </span>
          <button type="button" className={styles.kpiLink} onClick={() => onOpen("approvals")}>
            Open approvals <ArrowRight size={14} aria-hidden="true" />
          </button>
        </article>
      </section>

      {/* 3. Growth. */}
      <div className={styles.charts}>
        <section className={styles.card} aria-labelledby="signups-title">
          <div className={styles.cardHead}>
            <h2 id="signups-title">Sign-ups per day</h2>
            <span className={styles.cardMeta}>Last {CHART_DAYS} days</span>
          </div>
          <DailyBars days={insights.signups} noun={["sign-up", "sign-ups"]} />
        </section>

        <section className={styles.card} aria-labelledby="roles-title">
          <div className={styles.cardHead}>
            <h2 id="roles-title">Who&apos;s in the network</h2>
          </div>
          <SplitBar
            parts={[
              { label: "Candidates", value: insights.roles.candidates },
              { label: "Recruiters", value: insights.roles.recruiters },
            ]}
          />
          <p className={styles.cardNote}>Only approved, active people are counted.</p>
        </section>
      </div>

      {/* 4. What admins did lately. */}
      <section className={styles.card} aria-labelledby="recent-title">
        <div className={styles.cardHead}>
          <h2 id="recent-title">Recent admin actions</h2>
          <button type="button" className={styles.textButton} onClick={() => onOpen("activity")}>
            See the full log <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
        {recentLogs.length === 0 ? (
          <p className={styles.cardNote}>
            <CircleAlert size={16} aria-hidden="true" /> Nothing yet. Approvals, role changes and suspensions will be listed here.
          </p>
        ) : (
          <ol className={styles.timeline}>
            {recentLogs.map((log) => (
              <li key={log.id}>
                <span className={styles.timelineDot} aria-hidden="true" />
                <span className={styles.timelineText}>
                  {log.description}
                  <small>by {log.actorName || log.actorEmail || "the system"}</small>
                </span>
                <time dateTime={log.createdAt}>{timeAgo(log.createdAt, formatDate)}</time>
              </li>
            ))}
          </ol>
        )}
      </section>

      {stats && (
        <details className={styles.allNumbers}>
          <summary>All platform numbers</summary>
          <StatsSection stats={stats} text={text} />
        </details>
      )}
    </div>
  );
}
