"use client";

/**
 * Admin page, in 5 tabs:
 *   Overview     -> numbers, recruiters waiting for approval, recent admin actions
 *   Users        -> every account: role, switch on/off, approve recruiters
 *   Connections  -> connect two people by hand, or remove a connection
 *   Activity log -> everything admins changed
 *   Page texts   -> edit the app's wording without code
 *
 * AFTER EACH ACTION
 * We update the changed item from Django's answer, then quietly refresh only
 * the numbers and the activity log. (Before, every click reloaded ALL the
 * data and replaced the page with "Loading", losing your place and search.)
 *
 * SAFETY
 * Switching an account off, and changing a role, ask "Are you sure?" first.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";

import { errorText } from "../../api/client";
import { clearUiContentCache } from "../../api/ui-content";
import { Avatar, EmptyState, Notice, Page, Panel, Tabs, ui } from "../../components/ui";
import { ROUTES } from "../../config/routes";
import { useUiContent } from "../../hooks/useUiContent";
import * as adminApi from "../../services/admin";
import { isAdmin, useCurrentUser } from "../CurrentUserContext";
import styles from "./admin.module.css";
import AuditLogsSection from "./components/AuditLogsSection";
import ConnectionsSection from "./components/ConnectionsSection";
import StatsSection from "./components/StatsSection";
import UiContentSection from "./components/UiContentSection";
import UsersSection, { VerificationBadge } from "./components/UsersSection";
import type { AdminAuditLog, AdminConnection, AdminStats, AdminUiContentItem, AdminUser } from "./types";

const TABS = ["overview", "users", "connections", "activity", "texts"] as const;
type Tab = (typeof TABS)[number];

/** The tab named in the address (/admin?tab=users), so other pages can link straight to it. */
function tabFromAddress(): Tab | null {
  const wanted = new URLSearchParams(window.location.search).get("tab");
  return TABS.find((tab) => tab === wanted) ?? null;
}
type Message = { tone: "success" | "error"; text: string } | null;

// How many recent actions the Overview shows.
const RECENT_ACTIVITY_COUNT = 5;
// Django accepts notes up to this length.
const MAX_NOTE_LENGTH = 255;

function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

/** Does this text contain the search words? (case doesn't matter) */
function matches(search: string, ...values: string[]) {
  const query = search.trim().toLowerCase();
  return !query || values.join(" ").toLowerCase().includes(query);
}

export default function AdminPage() {
  const router = useRouter();
  const text = useUiContent();
  const me = useCurrentUser();

  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Message>(null);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [connections, setConnections] = useState<AdminConnection[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [texts, setTexts] = useState<AdminUiContentItem[]>([]);

  const [userSearch, setUserSearch] = useState("");
  const [textSearch, setTextSearch] = useState("");
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const [firstUserId, setFirstUserId] = useState("");
  const [secondUserId, setSecondUserId] = useState("");

  // What is running right now (so only that button says "Saving...").
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [savingTextKey, setSavingTextKey] = useState<string | null>(null);

  const canView = isAdmin(me);

  // First load: everything at once.
  useEffect(() => {
    if (!canView) {
      router.replace(ROUTES.DASHBOARD); // not an admin: go to your own dashboard
      return;
    }

    let pageIsOpen = true;

    Promise.all([
      adminApi.getStats(),
      adminApi.getUsers(),
      adminApi.getConnections(),
      adminApi.getAuditLogs(),
      adminApi.getUiContentItems(),
    ])
      .then(([newStats, newUsers, newConnections, newLogs, newTexts]) => {
        if (!pageIsOpen) return;
        // Open the tab named in the address (?tab=users), if any.
        setTab((current) => tabFromAddress() ?? current);
        setStats(newStats);
        setUsers(newUsers);
        setConnections(newConnections);
        setAuditLogs(newLogs);
        setTexts(newTexts);
      })
      .catch((error: unknown) => {
        if (pageIsOpen) setMessage({ tone: "error", text: errorText(error, "Couldn't load the admin data.") });
      })
      .finally(() => {
        if (pageIsOpen) setLoading(false);
      });

    return () => {
      pageIsOpen = false;
    };
  }, [canView, router]);

  /** After an action: refresh the numbers and the log, quietly. */
  const refreshSummary = useCallback(async () => {
    try {
      const [newStats, newLogs] = await Promise.all([adminApi.getStats(), adminApi.getAuditLogs()]);
      setStats(newStats);
      setAuditLogs(newLogs);
    } catch (error) {
      console.warn("Couldn't refresh the admin numbers:", error);
    }
  }, []);

  /** Put Django's updated user into the list. */
  function replaceUser(updated: AdminUser) {
    setUsers((list) => list.map((user) => (user.id === updated.id ? updated : user)));
  }

  /** Run one user action: one at a time, with a clear success or error message. */
  async function runUserAction(user: AdminUser, work: () => Promise<AdminUser & { message?: string }>, done: string) {
    if (busyUserId !== null) return;
    setBusyUserId(user.id);
    setMessage(null);

    try {
      const updated = await work();
      replaceUser(updated);
      setMessage({ tone: "success", text: updated.message || done });
      void refreshSummary();
    } catch (error) {
      setMessage({ tone: "error", text: errorText(error, "That didn't work. Please try again.") });
    } finally {
      setBusyUserId(null);
    }
  }

  function handleToggleActive(user: AdminUser) {
    const name = user.fullName || user.email;
    if (user.is_active && !window.confirm(`Switch off ${name}'s account? They won't be able to sign in.`)) return;

    void runUserAction(
      user,
      () => adminApi.setUserActive(user.id, !user.is_active),
      user.is_active ? `${name} was switched off.` : `${name} was switched on.`
    );
  }

  function handleChangeRole(user: AdminUser, role: AdminUser["role"]) {
    if (role === user.role) return;

    const name = user.fullName || user.email;
    const warning = role === "admin" ? " Admins can see and change everything." : "";
    if (!window.confirm(`Make ${name} a ${role}?${warning}`)) return;

    void runUserAction(user, () => adminApi.setUserRole(user.id, role), `${name} is now a ${role}.`);
  }

  function handleVerify(user: AdminUser, status: "approved" | "rejected") {
    const name = user.fullName || user.email;
    let note = "";

    if (status === "rejected") {
      // The recruiter sees this note on their dashboard, so they know what to fix.
      const answer = window.prompt(`Why is ${name} not approved? They will see this note.`, "");
      if (answer === null) return; // Cancel pressed
      note = answer.trim().slice(0, MAX_NOTE_LENGTH);
    }

    void runUserAction(
      user,
      () => adminApi.setRecruiterVerification(user.id, status, note),
      status === "approved" ? `${name} is approved.` : `${name} was not approved.`
    );
  }

  async function handleConnect() {
    if (connecting) return;
    setConnecting(true);
    setMessage(null);

    try {
      const created = await adminApi.connectUsers(Number(firstUserId), Number(secondUserId));
      setConnections((list) => [created, ...list]);
      setFirstUserId("");
      setSecondUserId("");
      setMessage({ tone: "success", text: text("adminConnectionCreated", "The two people are now connected.") });
      void refreshSummary();
    } catch (error) {
      setMessage({ tone: "error", text: errorText(error, "Couldn't connect them.") });
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect(connection: AdminConnection) {
    if (removingId !== null) return;
    if (!window.confirm(`Remove the connection between ${connection.userName} and ${connection.connectedUserName}?`)) return;

    setRemovingId(connection.id);
    setMessage(null);

    try {
      await adminApi.disconnectUsers(connection.userId, connection.connectedUserId);
      setConnections((list) => list.filter((item) => item.id !== connection.id));
      setMessage({ tone: "success", text: text("adminConnectionRemoved", "Connection removed.") });
      void refreshSummary();
    } catch (error) {
      setMessage({ tone: "error", text: errorText(error, "Couldn't remove the connection.") });
    } finally {
      setRemovingId(null);
    }
  }

  async function handleSaveText(item: AdminUiContentItem) {
    const value = textDrafts[item.key] ?? item.value;
    setSavingTextKey(item.key);
    setMessage(null);

    try {
      const saved = await adminApi.updateUiContentItem(item.key, value);
      setTexts((list) => list.map((current) => (current.key === item.key ? { ...current, value: saved.value } : current)));
      setTextDrafts((drafts) => {
        const next = { ...drafts };
        delete next[item.key];
        return next;
      });
      clearUiContentCache(); // other pages load the new wording
      setMessage({ tone: "success", text: `Saved "${item.key}".` });
      void refreshSummary();
    } catch (error) {
      setMessage({ tone: "error", text: errorText(error, "Couldn't save this text.") });
    } finally {
      setSavingTextKey(null);
    }
  }

  // ---------- Lists for the tabs ----------

  const filteredUsers = useMemo(
    () => users.filter((user) => matches(userSearch, user.fullName, user.email)),
    [users, userSearch]
  );

  const pendingRecruiters = useMemo(
    () => users.filter((user) => user.role === "recruiter" && user.recruiterVerificationStatus === "pending"),
    [users]
  );

  // Only people who may use the network can be connected.
  const networkUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.is_active &&
          !user.is_staff &&
          (user.role === "candidate" || (user.role === "recruiter" && user.recruiterVerificationStatus === "approved"))
      ),
    [users]
  );

  const filteredTexts = useMemo(
    () => texts.filter((item) => matches(textSearch, item.key, item.value)),
    [texts, textSearch]
  );

  if (!canView) return null;

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "users" as const, label: text("adminUsers", "Users"), count: users.length },
    { id: "connections" as const, label: "Connections", count: connections.length },
    { id: "activity" as const, label: "Activity log" },
    { id: "texts" as const, label: "Page texts", count: texts.length },
  ];

  return (
    <Page
      title={text("adminDashboard", "Admin")}
      subtitle={text("adminIntro", "Manage accounts, approve recruiters and keep the platform tidy.")}
    >
      <div className={styles.tabsBar}>
        <Tabs items={tabs} active={tab} onChange={setTab} label="Admin sections" />
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {loading ? (
        <p className="muted">{text("loading", "Loading...")}</p>
      ) : (
        <>
          {tab === "overview" && (
            <div className={ui.stack}>
              {/* The one thing that needs an admin's decision comes first. */}
              <Panel
                flush
                title={
                  pendingRecruiters.length === 0
                    ? "No recruiters waiting for approval"
                    : `${pendingRecruiters.length} ${pendingRecruiters.length === 1 ? "recruiter is" : "recruiters are"} waiting for approval`
                }
                hint="Approved recruiters can search candidates and send messages."
              >
                {pendingRecruiters.length === 0 ? (
                  <EmptyState icon={UserCheck} title="All caught up" text="New recruiters will appear here." />
                ) : (
                  <ul className={ui.list}>
                    {pendingRecruiters.map((user) => (
                      <li key={user.id} className={ui.row}>
                        <Avatar name={user.fullName || user.email} size={40} />
                        <div className={ui.rowMain}>
                          <span className={ui.rowTitle}>{user.fullName || user.email}</span>
                          <span className={ui.rowText}>
                            {user.email}, joined {formatDate(user.date_joined)}
                          </span>
                        </div>
                        <VerificationBadge user={user} text={text} />
                        <div className={ui.rowActions}>
                          <button
                            type="button"
                            className="btn-outline btn-sm"
                            onClick={() => handleVerify(user, "rejected")}
                            disabled={busyUserId === user.id}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            className="btn-primary btn-sm"
                            onClick={() => handleVerify(user, "approved")}
                            disabled={busyUserId === user.id}
                          >
                            Approve
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {stats && <StatsSection stats={stats} text={text} />}

              <AuditLogsSection
                title="Recent admin actions"
                auditLogs={auditLogs.slice(0, RECENT_ACTIVITY_COUNT)}
                formatDate={formatDate}
              />
            </div>
          )}

          {tab === "users" && (
            <UsersSection
              text={text}
              users={filteredUsers}
              totalCount={users.length}
              searchTerm={userSearch}
              setSearchTerm={setUserSearch}
              busyUserId={busyUserId}
              onToggleActive={handleToggleActive}
              onChangeRole={handleChangeRole}
              onVerify={handleVerify}
              formatDate={formatDate}
            />
          )}

          {tab === "connections" && (
            <ConnectionsSection
              text={text}
              networkUsers={networkUsers}
              connections={connections}
              firstUserId={firstUserId}
              secondUserId={secondUserId}
              setFirstUserId={setFirstUserId}
              setSecondUserId={setSecondUserId}
              saving={connecting}
              removingId={removingId}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              formatDate={formatDate}
            />
          )}

          {tab === "activity" && (
            <AuditLogsSection title="Everything admins changed" auditLogs={auditLogs} formatDate={formatDate} />
          )}

          {tab === "texts" && (
            <UiContentSection
              text={text}
              items={filteredTexts}
              totalCount={texts.length}
              searchTerm={textSearch}
              setSearchTerm={setTextSearch}
              draftValues={textDrafts}
              setDraftValue={(key, value) => setTextDrafts((drafts) => ({ ...drafts, [key]: value }))}
              savingKey={savingTextKey}
              onSave={handleSaveText}
            />
          )}
        </>
      )}
    </Page>
  );
}
