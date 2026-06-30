// app/(main)/admin/components/UsersSection.tsx
"use client";

import type { Dispatch, SetStateAction } from "react";

import type { UiContent } from "../../../api/ui-content";
import type { AdminUser } from "../types";

type Props = {
  uiContent: UiContent;
  users: AdminUser[];
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  actionLoading: number | null;
  roleLoading: number | null;
  verificationLoading: number | null;
  updateUserStatus: (user: AdminUser) => Promise<void>;
  updateUserRole: (user: AdminUser, role: AdminUser["role"]) => Promise<void>;
  updateRecruiterVerification: (
    user: AdminUser,
    status: "approved" | "rejected"
  ) => Promise<void>;
  formatDate: (value: string | null) => string;
  getRecruiterVerificationLabel: (
    user: AdminUser,
    uiContent: UiContent
  ) => string;
};

export default function UsersSection({
  uiContent,
  users,
  searchTerm,
  setSearchTerm,
  actionLoading,
  roleLoading,
  verificationLoading,
  updateUserStatus,
  updateUserRole,
  updateRecruiterVerification,
  formatDate,
  getRecruiterVerificationLabel,
}: Props) {
  return (
    <div className="card">
      <div className="card-header flex-between">
        <h3>{uiContent.adminUsers}</h3>

        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={uiContent.adminSearchPlaceholder}
          className="admin-search-input"
        />
      </div>

      <div className="card-body">
        {users.length === 0 ? (
          <p className="text-center muted">{uiContent.adminNoUsers}</p>
        ) : (
          <div className="admin-user-list">
            {users.map((user) => (
              <div key={user.id} className="admin-user-row">
                <div>
                  <div className="font-semibold">{user.fullName}</div>
                  <div className="text-sm muted">{user.email}</div>
                </div>

                <div className="text-sm">
                  <div>{uiContent.adminJoined}</div>
                  <div className="muted">{formatDate(user.date_joined)}</div>
                </div>

                <div className="text-sm">
                  <div>{uiContent.adminLastLogin}</div>
                  <div className="muted">{formatDate(user.last_login)}</div>
                </div>

                <div className="text-sm">
                  <div>{uiContent.adminProfileCompletion}</div>
                  <div className="muted">{user.profileCompletion}%</div>
                </div>

                <div className="text-sm">
                  <div>{uiContent.adminContent}</div>
                  <div className="muted">
                    {user.skillsCount} / {user.projectsCount} /{" "}
                    {user.experiencesCount}
                  </div>
                </div>

                <div className="text-sm">
                  <div>{uiContent.adminRole}</div>
                  <select
                    value={user.role}
                    onChange={(event) =>
                      updateUserRole(user, event.target.value as AdminUser["role"])
                    }
                    disabled={roleLoading === user.id}
                  >
                    <option value="candidate">{uiContent.candidate}</option>
                    <option value="recruiter">{uiContent.recruiter}</option>
                    <option value="admin">{uiContent.adminRole}</option>
                  </select>
                </div>

                <div className="text-sm">
                  <div>{uiContent.adminRecruiterVerification}</div>
                  <div className="muted">
                    {getRecruiterVerificationLabel(user, uiContent)}
                  </div>

                  {user.role === "recruiter" && (
                    <div className="admin-inline-actions">
                      <button
                        type="button"
                        className="btn-outline btn-sm"
                        onClick={() =>
                          updateRecruiterVerification(user, "approved")
                        }
                        disabled={
                          verificationLoading === user.id ||
                          user.recruiterVerificationStatus === "approved"
                        }
                      >
                        {verificationLoading === user.id
                          ? uiContent.adminVerifyingRecruiter
                          : uiContent.adminApproveRecruiter}
                      </button>

                      <button
                        type="button"
                        className="btn-outline btn-sm"
                        onClick={() =>
                          updateRecruiterVerification(user, "rejected")
                        }
                        disabled={
                          verificationLoading === user.id ||
                          user.recruiterVerificationStatus === "rejected"
                        }
                      >
                        {verificationLoading === user.id
                          ? uiContent.adminVerifyingRecruiter
                          : uiContent.adminRejectRecruiter}
                      </button>
                    </div>
                  )}
                </div>

                <div className="text-sm">
                  <div>{uiContent.adminStatus}</div>
                  <div className="muted">
                    {user.is_active
                      ? uiContent.adminActive
                      : uiContent.adminInactive}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={actionLoading === user.id}
                  onClick={() => updateUserStatus(user)}
                >
                  {actionLoading === user.id
                    ? uiContent.adminUpdating
                    : user.is_active
                      ? uiContent.adminDeactivate
                      : uiContent.adminActivate}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}