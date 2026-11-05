"use client";

/**
 * An admin's own profile: who they are, AND what they do for the platform.
 *
 *   Dark header   -> name, title, buttons, and 12 weeks of activity
 *   Main column   -> waiting for you (approve recruiters here), your impact, recent actions
 *   Side column   -> about, admin tools (links into the admin page), account
 *
 * Everything is real: it comes from the admin's own lines in the audit log
 * (GET /api/admin/me/) and the user list. Nothing is made up for show.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  Flame,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Link2,
  LogIn,
  MailCheck,
  MapPin,
  MessagesSquare,
  PenLine,
  Power,
  PowerOff,
  ShieldCheck,
  Trash2,
  Type,
  Unlink,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { errorText } from "@/app/api/client";
import { Avatar, Notice, Panel } from "@/app/components/ui";
import { ROUTES } from "@/app/config/routes";
import { useUiContent } from "@/app/hooks/useUiContent";
import * as adminApi from "@/app/services/admin";
import type { Profile } from "@/app/services/profiles";
import { formatRelativeTime } from "@/app/utils/time";
import type { AdminMe, AdminUser } from "../../../admin/types";
import ActivityGrid from "./ActivityGrid";
import styles from "./adminProfile.module.css";

// How many waiting recruiters to show here (the rest are on the admin page).
const WAITING_PREVIEW = 3;

/** A link into one tab of the admin page, e.g. /admin?tab=users */
const adminTab = (tab: string) => `${ROUTES.ADMIN}?tab=${tab}`;

// One icon per kind of audit-log line (codes from Backend/admin_panel/views.py).
const ACTION_ICONS: Record<string, LucideIcon> = {
  recruiter_verification_changed: UserCheck,
  user_activated: Power,
  user_deactivated: PowerOff,
  role_changed: ShieldCheck,
  connection_created: Link2,
  connection_removed: Unlink,
  ui_content_updated: Type,
  conversation_viewed: MessagesSquare,
  account_deleted: Trash2,
};

const TOOLS = [
  { tab: "overview", icon: UserCheck, title: "Recruiter approvals", text: "Approve or reject new recruiters" },
  { tab: "users", icon: Users, title: "Users and roles", text: "Switch accounts on or off, change roles" },
  { tab: "connections", icon: Link2, title: "Connections", text: "Connect two people, or remove a connection" },
  { tab: "texts", icon: Type, title: "Page texts", text: "Change the app's wording without code" },
  { tab: "activity", icon: LayoutDashboard, title: "Activity log", text: "Everything every admin changed" },
];

const monthYear = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** The admin's numbers, and the recruiters waiting for approval. */
async function fetchAdminData() {
  const [me, users] = await Promise.all([adminApi.getMyAdminProfile(), adminApi.getUsers()]);
  const waiting = users.filter(
    (user) => user.role === "recruiter" && user.recruiterVerificationStatus === "pending"
  );
  return { me, waiting };
}

type Props = {
  profile: Profile;
};

export default function AdminProfile({ profile }: Props) {
  const text = useUiContent();

  const [me, setMe] = useState<AdminMe | null>(null);
  const [waiting, setWaiting] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [approvingId, setApprovingId] = useState<number | null>(null);

  useEffect(() => {
    let pageIsOpen = true;
    fetchAdminData()
      .then((data) => {
        if (!pageIsOpen) return;
        setMe(data.me);
        setWaiting(data.waiting);
      })
      .catch((loadError: unknown) => {
        if (pageIsOpen) setError(errorText(loadError, "Couldn't load your admin numbers."));
      });
    return () => {
      pageIsOpen = false;
    };
  }, []);

  async function approve(user: AdminUser) {
    if (approvingId !== null) return;
    setApprovingId(user.id);
    setNotice("");
    setError("");

    try {
      await adminApi.setRecruiterVerification(user.id, "approved");
      setNotice(`${user.fullName || user.email} is approved and can now search candidates.`);
      // Reload, so your numbers and the grid go up straight away.
      const data = await fetchAdminData();
      setMe(data.me);
      setWaiting(data.waiting);
    } catch (approveError) {
      setError(errorText(approveError, "Couldn't approve this recruiter."));
    } finally {
      setApprovingId(null);
    }
  }

  const title = profile.adminTitle || "Platform admin";
  const activityTotal = me ? me.activity.reduce((sum, day) => sum + day.count, 0) : 0;

  return (
    <div className={styles.page}>
      {/* ---------- Header ---------- */}
      <section className={styles.band} aria-label="Admin profile summary">
        <div className={styles.identity}>
          <span className={styles.avatarRing}>
            <Avatar name={profile.fullName || "?"} size={84} />
          </span>

          <div className={styles.identityMain}>
            <span className={styles.roleBadge}>
              <ShieldCheck size={14} aria-hidden="true" />
              Admin
            </span>
            <h1 className={styles.name}>{profile.fullName}</h1>
            <p className={styles.title}>{title}</p>
            {profile.headline && <p className={styles.headline}>{profile.headline}</p>}

            <ul className={styles.bandMeta}>
              {profile.location && (
                <li>
                  <MapPin size={15} aria-hidden="true" />
                  {profile.location}
                </li>
              )}
              {me && (
                <li>
                  <CalendarDays size={15} aria-hidden="true" />
                  Admin since {monthYear.format(new Date(me.memberSince))}
                </li>
              )}
            </ul>

            <div className={styles.bandActions}>
              <Link href={ROUTES.ADMIN} className={styles.bandPrimary}>
                <LayoutDashboard size={16} aria-hidden="true" />
                Open admin page
              </Link>
              <Link href={ROUTES.PROFILE_EDIT} className={styles.bandSecondary}>
                <PenLine size={16} aria-hidden="true" />
                {text("editProfile", "Edit profile")}
              </Link>
            </div>
          </div>
        </div>

        <div className={styles.activity}>
          <p className={styles.activityTitle}>
            {me ? plural(activityTotal, "action", "actions") : "Your activity"}
            <span> in the last 12 weeks</span>
          </p>
          {me ? (
            <>
              <ActivityGrid days={me.activity} />
              <p className={styles.activityFacts}>
                {me.streak > 0 && (
                  <span>
                    <Flame size={15} aria-hidden="true" />
                    {plural(me.streak, "day", "days")} in a row
                  </span>
                )}
                <span>Active on {plural(me.activeDays, "day", "days")}</span>
              </p>
            </>
          ) : (
            <div className={styles.gridPlaceholder} aria-hidden="true" />
          )}
        </div>
      </section>

      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}

      <div className={styles.columns}>
        {/* ---------- Main column ---------- */}
        <div className={styles.stack}>
          <Panel
            flush
            title={
              waiting.length === 0
                ? "Nothing is waiting for you"
                : `${plural(waiting.length, "recruiter is", "recruiters are")} waiting for approval`
            }
            hint="Approved recruiters can search candidates and send messages."
            actions={
              waiting.length > WAITING_PREVIEW && (
                <Link href={adminTab("overview")} className="btn-outline btn-sm">
                  See all {waiting.length}
                </Link>
              )
            }
          >
            {waiting.length === 0 ? (
              <div className={styles.allClear}>
                <span className={styles.allClearIcon}>
                  <CheckCheck size={20} aria-hidden="true" />
                </span>
                <p>You&apos;re all caught up. New recruiters will show up here as soon as they verify their email.</p>
              </div>
            ) : (
              <ul className={styles.rows}>
                {waiting.slice(0, WAITING_PREVIEW).map((user) => (
                  <li key={user.id} className={styles.row}>
                    <Avatar name={user.fullName || user.email} size={40} />
                    <div className={styles.rowMain}>
                      <span className={styles.rowTitle}>{user.fullName || user.email}</span>
                      <span className={styles.rowText}>
                        {user.email}, joined {shortDate.format(new Date(user.date_joined))}
                      </span>
                    </div>
                    <div className={styles.rowActions}>
                      <Link href={adminTab("overview")} className="btn-outline btn-sm">
                        Review
                      </Link>
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        onClick={() => approve(user)}
                        disabled={approvingId !== null}
                      >
                        {approvingId === user.id ? "Approving..." : "Approve"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Your impact" hint="Everything you've done as an admin, since day one.">
            {me ? (
              <dl className={styles.impact}>
                <Impact icon={UserCheck} value={me.impact.recruitersApproved} label="Recruiters approved" />
                <Impact icon={Users} value={me.impact.accountsManaged} label="Accounts managed" />
                <Impact icon={Link2} value={me.impact.connectionsMade} label="People connected" />
                <Impact icon={Type} value={me.impact.textsEdited} label="Page texts edited" />
                <Impact icon={PowerOff} value={me.impact.recruitersRejected} label="Recruiters turned down" />
                <Impact icon={LayoutDashboard} value={me.impact.totalActions} label="Actions in total" />
              </dl>
            ) : (
              <div className={styles.blockPlaceholder} aria-hidden="true" />
            )}
          </Panel>

          <Panel
            flush
            title="Your recent actions"
            actions={
              <Link href={adminTab("activity")} className="btn-outline btn-sm">
                Full log
              </Link>
            }
          >
            {me && me.recent.length === 0 ? (
              <div className={styles.allClear}>
                <span className={styles.allClearIcon}>
                  <Inbox size={20} aria-hidden="true" />
                </span>
                <p>Nothing yet. When you approve someone or change a setting, it shows up here.</p>
              </div>
            ) : (
              <ol className={styles.rows}>
                {(me?.recent ?? []).map((log) => {
                  const Icon = ACTION_ICONS[log.action] ?? ShieldCheck;
                  return (
                    <li key={log.id} className={styles.row}>
                      <span className={styles.actionIcon}>
                        <Icon size={17} aria-hidden="true" />
                      </span>
                      <div className={styles.rowMain}>
                        <span className={styles.rowTitle}>{log.description}</span>
                        {log.targetUserName && <span className={styles.rowText}>For {log.targetUserName}</span>}
                      </div>
                      <time className={styles.rowTime} dateTime={log.createdAt}>
                        {formatRelativeTime(log.createdAt)}
                      </time>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </div>

        {/* ---------- Side column ---------- */}
        <div className={styles.stack}>
          <Panel title="About">
            {profile.bio ? (
              <p className={styles.bio}>{profile.bio}</p>
            ) : (
              <p className={styles.muted}>
                Add a short bio so recruiters and candidates know who is looking after the platform.{" "}
                <Link href={ROUTES.PROFILE_EDIT}>Add a bio</Link>
              </p>
            )}
          </Panel>

          <Panel flush title="Admin tools">
            <ul className={styles.tools}>
              {TOOLS.map(({ tab, icon: Icon, title: toolTitle, text: toolText }) => (
                <li key={tab}>
                  <Link href={adminTab(tab)} className={styles.tool}>
                    <span className={styles.toolIcon}>
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className={styles.toolMain}>
                      <span className={styles.toolTitle}>
                        {toolTitle}
                        {tab === "overview" && waiting.length > 0 && (
                          <span className={styles.count}>{waiting.length}</span>
                        )}
                      </span>
                      <span className={styles.toolText}>{toolText}</span>
                    </span>
                    <ArrowUpRight size={16} className={styles.toolArrow} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Account">
            <ul className={styles.account}>
              <li>
                <MailCheck size={17} aria-hidden="true" />
                <span>
                  <span className={styles.accountLabel}>Email, verified</span>
                  {profile.email}
                </span>
              </li>
              <li>
                <LogIn size={17} aria-hidden="true" />
                <span>
                  <span className={styles.accountLabel}>Last sign-in</span>
                  {me?.lastSignIn ? formatRelativeTime(me.lastSignIn) : "This is your first sign-in"}
                </span>
              </li>
              <li>
                <KeyRound size={17} aria-hidden="true" />
                <span>
                  <span className={styles.accountLabel}>Password</span>
                  <Link href={ROUTES.FORGOT_PASSWORD}>Change password</Link>
                </span>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** One number in "Your impact". */
function Impact({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className={styles.impactItem}>
      <dt>
        <Icon size={16} aria-hidden="true" />
        {label}
      </dt>
      <dd className={value === 0 ? styles.impactZero : undefined}>{value.toLocaleString("en")}</dd>
    </div>
  );
}
