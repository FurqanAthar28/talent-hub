"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "../../api/client";
import { fetchUiContent, type UiContent } from "../../api/ui-content";
import StatsSection from "./components/StatsSection";
import AuditLogsSection from "./components/AuditLogsSection";
import ConnectionsSection from "./components/ConnectionsSection";
import UsersSection from "./components/UsersSection";

import type {
  AdminStats,
  AdminUser,
  AdminConnection,
  AdminAuditLog,
  AuthUser,
} from "./types";

function formatDate(value: string | null) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getRecruiterVerificationLabel(user: AdminUser, uiContent: UiContent) {
  if (user.role !== "recruiter") return "-";

  if (user.recruiterVerificationStatus === "pending") {
    return uiContent.adminRecruiterPending;
  }

  if (user.recruiterVerificationStatus === "approved") {
    return uiContent.adminRecruiterApproved;
  }

  if (user.recruiterVerificationStatus === "rejected") {
    return uiContent.adminRecruiterRejected;
  }

  return "-";
}

export default function AdminPage() {
  const [uiContent, setUiContent] = useState<UiContent>({});
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [roleLoading, setRoleLoading] = useState<number | null>(null);
  const [verificationLoading, setVerificationLoading] = useState<number | null>(
    null
  );
  const [connections, setConnections] = useState<AdminConnection[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [firstUserId, setFirstUserId] = useState("");
  const [secondUserId, setSecondUserId] = useState("");
  const [connectionSaving, setConnectionSaving] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState<number | null>(
    null
  );
  const [canViewAdmin, setCanViewAdmin] = useState(false);

  const loadAdminData = useCallback(
    async (clearNotice = true) => {
      setLoading(true);
      if (clearNotice) setNotice("");

      try {
        const uiContentData = await fetchUiContent();
        setUiContent(uiContentData);

        const meRes = await apiFetch(uiContentData.apiAccountsMe);

        if (!meRes.ok) {
          setCanViewAdmin(false);
          setNotice(uiContentData.adminAccessDenied);
          return;
        }

        const currentUser = (await meRes.json()) as AuthUser;

        if (!currentUser.isStaff) {
          setCanViewAdmin(false);
          setNotice(uiContentData.adminAccessDenied);
          return;
        }

        setCanViewAdmin(true);

        const [statsRes, usersRes, connectionsRes, auditLogsRes] =
          await Promise.all([
            apiFetch(uiContentData.apiAdminStats),
            apiFetch(uiContentData.apiAdminUsers),
            apiFetch(uiContentData.apiAdminConnections),
            apiFetch(uiContentData.apiAdminAuditLogs),
          ]);

        if (
          !statsRes.ok ||
          !usersRes.ok ||
          !connectionsRes.ok ||
          !auditLogsRes.ok
        ) {
          setNotice(uiContentData.adminUnableToLoad);
          return;
        }

        setStats(await statsRes.json());
        setUsers(await usersRes.json());
        setConnections(await connectionsRes.json());
        setAuditLogs(await auditLogsRes.json());
      } catch (error) {
        console.error("Failed to load admin data:", error);
        setCanViewAdmin(false);
        setNotice(uiContent.adminUnableToLoad);
      } finally {
        setLoading(false);
      }
    },
    [uiContent.adminUnableToLoad]
  );

  useEffect(() => {
    async function loadInitialAdminData() {
      await loadAdminData();
    }

    loadInitialAdminData();
  }, [loadAdminData]);

  const filteredUsers = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    if (!normalizedSearchTerm) return users;

    return users.filter((user) => {
      return (
        user.fullName.toLowerCase().includes(normalizedSearchTerm) ||
        user.email.toLowerCase().includes(normalizedSearchTerm)
      );
    });
  }, [searchTerm, users]);

  const networkUsers = useMemo(() => {
    return users.filter((user) => {
      return (
        user.is_active &&
        !user.is_staff &&
        (user.role === "candidate" ||
          (user.role === "recruiter" &&
            user.recruiterVerificationStatus === "approved"))
      );
    });
  }, [users]);

  async function updateUserStatus(user: AdminUser) {
    setActionLoading(user.id);
    setNotice("");

    try {
      const res = await apiFetch(`${uiContent.apiAdminUsers}/${user.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      const data = await res.json();

      if (!res.ok) {
        setNotice(data.message);
        return;
      }

      setUsers((previousUsers) =>
        previousUsers.map((currentUser) =>
          currentUser.id === user.id ? data : currentUser
        )
      );

      setNotice(data.message || uiContent.adminUserStatusUpdated);
      await loadAdminData(false);
    } catch (error) {
      console.error("Failed to update user status:", error);
      setNotice(uiContent.adminUnableToLoad);
    } finally {
      setActionLoading(null);
    }
  }

  async function updateUserRole(user: AdminUser, role: AdminUser["role"]) {
    if (role === user.role) {
      setNotice(uiContent.adminNoChangeRequired);
      return;
    }

    setRoleLoading(user.id);
    setNotice("");

    try {
      const res = await apiFetch(
        `${uiContent.apiAdminUsers}/${user.id}/${uiContent.apiAdminUserRoleSuffix}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setNotice(data.message);
        return;
      }

      setUsers((previousUsers) =>
        previousUsers.map((currentUser) =>
          currentUser.id === user.id ? data : currentUser
        )
      );

      setNotice(data.message || uiContent.adminUserRoleUpdated);
      await loadAdminData(false);
    } catch (error) {
      console.error("Failed to update user role:", error);
      setNotice(uiContent.adminUnableToLoad);
    } finally {
      setRoleLoading(null);
    }
  }

  async function updateRecruiterVerification(
    user: AdminUser,
    status: "approved" | "rejected"
  ) {
    if (status === user.recruiterVerificationStatus) {
      setNotice(uiContent.adminNoChangeRequired);
      return;
    }

    setVerificationLoading(user.id);
    setNotice("");

    try {
      const res = await apiFetch(
        `${uiContent.apiAdminUsers}/${user.id}/${uiContent.apiAdminRecruiterVerificationSuffix}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setNotice(data.message || uiContent.adminRecruiterVerificationInvalidRole);
        return;
      }

      setUsers((previousUsers) =>
        previousUsers.map((currentUser) =>
          currentUser.id === user.id ? data : currentUser
        )
      );
      setNotice(uiContent.adminRecruiterVerificationUpdated);
      await loadAdminData(false);
    } catch (error) {
      console.error("Failed to update recruiter verification:", error);
      setNotice(uiContent.adminUnableToLoad);
    } finally {
      setVerificationLoading(null);
    }
  }

  async function createManagedConnection() {
    setNotice("");

    if (!firstUserId || !secondUserId || firstUserId === secondUserId) {
      setNotice(uiContent.adminInvalidConnectionUsers);
      return;
    }

    setConnectionSaving(true);

    try {
      const res = await apiFetch(uiContent.apiAdminConnectUsers, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(firstUserId),
          connectedUserId: Number(secondUserId),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setNotice(data.message || uiContent.adminInvalidConnectionUsers);
        return;
      }

      setNotice(uiContent.adminConnectionCreated);
      setFirstUserId("");
      setSecondUserId("");
      await loadAdminData(false);
    } catch (error) {
      console.error("Failed to create managed connection:", error);
      setNotice(uiContent.adminUnableToLoad);
    } finally {
      setConnectionSaving(false);
    }
  }

  async function disconnectManagedConnection(connection: AdminConnection) {
    setNotice("");
    setDisconnectLoading(connection.id);

    try {
      const res = await apiFetch(uiContent.apiAdminDisconnectUsers, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: connection.userId,
          connectedUserId: connection.connectedUserId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setNotice(data.message || uiContent.adminUnableToLoad);
        return;
      }

      setNotice(uiContent.adminConnectionRemoved);
      await loadAdminData(false);
    } catch (error) {
      console.error("Failed to disconnect managed connection:", error);
      setNotice(uiContent.adminUnableToLoad);
    } finally {
      setDisconnectLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="app-main">
        <div className="container">{uiContent.loading}</div>
      </div>
    );
  }

  if (!canViewAdmin) {
    return (
      <div className="app-main">
        <div className="container">
          <div className="card">
            <div className="card-body text-center">
              <p className="form-error">{notice}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-main">
      <div className="container">
        <div className="dashboard-header">
          <h1>{uiContent.adminDashboard}</h1>
          <p>{uiContent.adminIntro}</p>
        </div>

        {notice && <div className="form-error mb-2">{notice}</div>}

        {stats && <StatsSection stats={stats} uiContent={uiContent} />}

        <ConnectionsSection
          uiContent={uiContent}
          networkUsers={networkUsers}
          connections={connections}
          firstUserId={firstUserId}
          secondUserId={secondUserId}
          setFirstUserId={setFirstUserId}
          setSecondUserId={setSecondUserId}
          connectionSaving={connectionSaving}
          disconnectLoading={disconnectLoading}
          createManagedConnection={createManagedConnection}
          disconnectManagedConnection={disconnectManagedConnection}
          formatDate={formatDate}
        />

        <AuditLogsSection
          uiContent={uiContent}
          auditLogs={auditLogs}
          formatDate={formatDate}
        />

        <UsersSection
          uiContent={uiContent}
          users={filteredUsers}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          actionLoading={actionLoading}
          roleLoading={roleLoading}
          verificationLoading={verificationLoading}
          updateUserStatus={updateUserStatus}
          updateUserRole={updateUserRole}
          updateRecruiterVerification={updateRecruiterVerification}
          formatDate={formatDate}
          getRecruiterVerificationLabel={getRecruiterVerificationLabel}
        />
      </div>
    </div>
  );
}