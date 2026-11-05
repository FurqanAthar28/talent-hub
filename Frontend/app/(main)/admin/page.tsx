"use client";

/**
 * Admin area, in 6 sections (listed in sections.ts; the frame is AdminShell):
 *   Overview     -> what needs you, key numbers with trends, sign-ups chart, recent actions
 *   Approvals    -> everyone waiting, oldest first
 *   Users        -> every account: role, approval, suspend / ban / delete / restore
 *   Connections  -> connect two people by hand, or remove a connection
 *   Activity log -> everything admins changed
 *   Page texts   -> edit the app's wording without code
 *
 * The open section is kept in the address (/admin?tab=users), so Refresh
 * and shared links land in the same place.
 *
 * AFTER EACH ACTION
 * We update the changed item from Django's answer, then quietly refresh only
 * the numbers and the activity log. (Before, every click reloaded ALL the
 * data and replaced the page with "Loading", losing your place and search.)
 *
 * SAFETY
 * Suspending, banning, deleting, changing a role, turning someone down and
 * removing a connection all ask first, in the app's own confirm box
 * (useConfirm), not the browser's plain pop-up. Suspend, ban and delete
 * also ask for a reason (the person sees it when they try to sign in).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { errorText } from "../../api/client";
import { clearUiContentCache } from "../../api/ui-content";
import { Notice } from "../../components/ui";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { ROUTES } from "../../config/routes";
import { useUiContent } from "../../hooks/useUiContent";
import * as adminApi from "../../services/admin";
import { ACCOUNT_ACTION_TEXT, REASON_MAX_LENGTH, USER_FILTERS, type UserFilter } from "./accountActions";
import { isAdmin, useCurrentUser } from "../CurrentUserContext";
import AdminShell from "./components/AdminShell";
import ApprovalsSection from "./components/ApprovalsSection";
import AuditLogsSection from "./components/AuditLogsSection";
import OverviewSection from "./components/OverviewSection";
import { buildInsights } from "./insights";
import { sectionFromAddress, showSectionInAddress, type SectionId } from "./sections";
import ConnectionsSection from "./components/ConnectionsSection";
import UiContentSection from "./components/UiContentSection";
import ApprovalReview from "./components/ApprovalReview";
import UsersSection from "./components/UsersSection";
import type { AdminAuditLog, AdminConnection, AdminStats, AdminUiContentItem, AdminUser } from "./types";

type Message = { tone: "success" | "error"; text: string } | null;

// How many recent actions the Overview shows.
const RECENT_ACTIVITY_COUNT = 5;

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
  const { confirm, dialog } = useConfirm();

  const [tab, setTab] = useState<SectionId>("overview");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Message>(null);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [connections, setConnections] = useState<AdminConnection[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [texts, setTexts] = useState<AdminUiContentItem[]>([]);

  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const [textSearch, setTextSearch] = useState("");
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const [firstUserId, setFirstUserId] = useState("");
  const [secondUserId, setSecondUserId] = useState("");

  // What is running right now (so only that button says "Saving...").
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [savingTextKey, setSavingTextKey] = useState<string | null>(null);
  // The person whose approval Review window is open (null = closed).
  const [reviewing, setReviewing] = useState<AdminUser | null>(null);

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
        setTab((current) => sectionFromAddress() ?? current);
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

  /** Suspend, ban, delete or undo one: always asks first (and asks for a reason where needed). */
  async function handleAccountAction(user: AdminUser, action: adminApi.AccountAction) {
    const name = adminApi.displayName(user);
    const words = ACCOUNT_ACTION_TEXT[action];
    const answer = await confirm({
      title: words.title(name),
      text: words.text(me.deletionGraceDays),
      confirmLabel: words.confirmLabel,
      tone: words.tone,
      note: words.reason
        ? {
            label: "Reason (they will see this)",
            placeholder: "e.g. The company details couldn't be confirmed",
            maxLength: REASON_MAX_LENGTH,
            required: true,
          }
        : undefined,
    });
    if (!answer.confirmed) return;

    void runUserAction(user, () => adminApi.runAccountAction(user.id, action, answer.note), `${words.label}: done.`);
  }

  async function handleChangeRole(user: AdminUser, role: AdminUser["role"]) {
    if (role === user.role) return;

    const name = adminApi.displayName(user);
    const answer = await confirm({
      title: `Make ${name} a ${role}?`,
      text:
        role === "admin"
          ? "Admins have full control: they can approve, suspend, ban and delete every account."
          : `They will see the app as a ${role} from their next page load.`,
      confirmLabel: `Make ${role}`,
      tone: role === "admin" ? "danger" : "primary",
    });
    if (!answer.confirmed) return;

    void runUserAction(user, () => adminApi.setUserRole(user.id, role), `${name} is now a ${role}.`);
  }

  /** The Review window saved a decision: show it in the list and the numbers. */
  function handleDecided(updated: AdminUser, doneMessage: string) {
    setReviewing(null);
    replaceUser(updated);
    setMessage({ tone: "success", text: doneMessage });
    void refreshSummary();
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
    const answer = await confirm({
      title: "Remove this connection?",
      text: `${connection.userName} and ${connection.connectedUserName} will no longer be connected or able to message each other. They can connect again later.`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!answer.confirmed) return;

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

  // Search first, then the status filter; the filter counts follow the search.
  const searchedUsers = useMemo(
    () => users.filter((user) => matches(userSearch, user.fullName, user.email)),
    [users, userSearch]
  );

  const filterCounts = useMemo(() => {
    const counts = Object.fromEntries(USER_FILTERS.map((option) => [option.value, 0])) as Record<UserFilter, number>;
    for (const user of searchedUsers) {
      counts.all += 1;
      counts[adminApi.accountState(user)] += 1;
      if (adminApi.isWaitingForApproval(user)) counts.waiting += 1;
    }
    return counts;
  }, [searchedUsers]);

  const filteredUsers = useMemo(
    () =>
      searchedUsers.filter((user) => {
        if (userFilter === "all") return true;
        if (userFilter === "waiting") return adminApi.isWaitingForApproval(user);
        return adminApi.accountState(user) === userFilter;
      }),
    [searchedUsers, userFilter]
  );

  const insights = useMemo(() => buildInsights(users, connections, auditLogs), [users, connections, auditLogs]);
  const { waiting } = insights;

  // Only people who may use the network can be connected.
  const networkUsers = useMemo(() => users.filter(adminApi.isNetworkUser), [users]);

  const filteredTexts = useMemo(
    () => texts.filter((item) => matches(textSearch, item.key, item.value)),
    [texts, textSearch]
  );

  if (!canView) return null;

  /** Open a section: remember it in the address and start at the top. */
  function openSection(id: SectionId) {
    setTab(id);
    setMessage(null);
    showSectionInAddress(id);
    window.scrollTo({ top: 0 });
  }

  /** Overview shortcuts like "2 accounts suspended" open Users with that filter. */
  function openUsers(filter: UserFilter) {
    setUserSearch("");
    setUserFilter(filter);
    openSection("users");
  }

  async function reloadAll() {
    setLoading(true);
    try {
      const [newUsers, newConnections] = await Promise.all([adminApi.getUsers(), adminApi.getConnections()]);
      setUsers(newUsers);
      setConnections(newConnections);
      await refreshSummary();
    } catch (error) {
      setMessage({ tone: "error", text: errorText(error, "Couldn't refresh the admin data.") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell
      active={tab}
      onChange={openSection}
      counts={{ approvals: waiting.length }}
      adminName={me.fullName || me.email}
      actions={
        <button type="button" className="btn-outline btn-sm" onClick={reloadAll} disabled={loading}>
          <RefreshCw size={15} aria-hidden="true" />
          <span>{loading ? "Loading..." : "Refresh"}</span>
        </button>
      }
    >
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {loading && users.length === 0 ? (
        <p className="muted">{text("loading", "Loading...")}</p>
      ) : (
        <>
          {tab === "overview" && (
            <OverviewSection
              insights={insights}
              stats={stats}
              recentLogs={auditLogs.slice(0, RECENT_ACTIVITY_COUNT)}
              text={text}
              onReview={setReviewing}
              onOpen={openSection}
              onOpenUsers={openUsers}
              formatDate={formatDate}
            />
          )}

          {tab === "approvals" && (
            <ApprovalsSection waiting={waiting} onReview={setReviewing} formatDate={formatDate} />
          )}

          {tab === "users" && (
            <UsersSection
              text={text}
              users={filteredUsers}
              totalCount={users.length}
              searchTerm={userSearch}
              setSearchTerm={setUserSearch}
              filter={userFilter}
              setFilter={setUserFilter}
              filterCounts={filterCounts}
              myId={me.id}
              busyUserId={busyUserId}
              onAccountAction={handleAccountAction}
              onChangeRole={handleChangeRole}
              onReview={setReviewing}
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
            <AuditLogsSection title={`${auditLogs.length} recorded actions`} auditLogs={auditLogs} formatDate={formatDate} />
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
      {dialog}
      {reviewing && (
        <ApprovalReview user={reviewing} onClose={() => setReviewing(null)} onDecided={handleDecided} />
      )}
    </AdminShell>
  );
}
