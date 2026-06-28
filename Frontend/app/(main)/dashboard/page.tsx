"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchUiContent, type UiContent } from "../../api/ui-content";
import ProjectsSection from "../../components/ProjectsSection";
import SkillsSection from "../../components/SkillsSection";
import ExperienceSection from "../../components/ExperienceSection";
import DashboardStats from "./components/DashboardStats";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  fetchDashboardSummary,
  updateDashboardOpenToWork,
} from "../../services/dashboard";
import { buildMediaUrl } from "../../utils/media";
import type { DashboardActivity, DashboardUser } from "../../../types/dashboard";

function formatUiText(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template
  );
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const now = new Date();

  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInSeconds < 60) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
  if (diffInHours < 24) return `${diffInHours} hr ago`;
  if (diffInDays === 1) return "Yesterday";
  if (diffInDays < 7) return `${diffInDays} days ago`;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function DashboardLoadingState() {
  return (
    <div className="app-main">
      <div className="container">
        <div className="card">
          <div className="card-body text-center">
            <p className="muted">Loading dashboard...</p>
          </div>
        </div>

        <div className="dashboard-stats mt-2">
          <div className="dashboard-stat-card">
            <h3>...</h3>
            <p>Loading</p>
          </div>

          <div className="dashboard-stat-card">
            <h3>...</h3>
            <p>Loading</p>
          </div>

          <div className="dashboard-stat-card">
            <h3>...</h3>
            <p>Loading</p>
          </div>

          <div className="dashboard-stat-card">
            <h3>...</h3>
            <p>Loading</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [showContactModal, setShowContactModal] = useState(false);
  const [activities, setActivities] = useState<DashboardActivity[]>([]);
  const [uiContent, setUiContent] = useState<UiContent>({});
  const [toggleError, setToggleError] = useState("");
  const [toggleSaving, setToggleSaving] = useState(false);

  const loadProfileSummary = useCallback(async () => {
    setDashboardError("");

    try {
      const uiContentData = await fetchUiContent();
      setUiContent(uiContentData);

      const dashboardSummary = await fetchDashboardSummary(uiContentData);
      setUser(dashboardSummary.user);
      setActivities(dashboardSummary.activities);
    } catch (error) {
      console.error("Failed to load dashboard profile summary:", error);
      setDashboardError(error instanceof Error ? error.message : "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfileSummary();
  }, [loadProfileSummary]);

  async function toggleOpenToWork() {
    if (!user || toggleSaving) return;

    const previousStatus = user.openToWork;
    const newStatus = !previousStatus;

    setToggleSaving(true);
    setToggleError("");
    setUser((prev) => (prev ? { ...prev, openToWork: newStatus } : prev));

    try {
      const updatedProfile = await updateDashboardOpenToWork(uiContent, newStatus);

      setUser((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          openToWork: updatedProfile.openToWork ?? newStatus,
          profileCompletion:
            updatedProfile.profileCompletion ?? prev.profileCompletion,
          missingFields: updatedProfile.missingFields ?? prev.missingFields,
        };
      });
    } catch (error) {
      console.error("Failed to update open-to-work status:", error);
      setUser((prev) => (prev ? { ...prev, openToWork: previousStatus } : prev));
      setToggleError(uiContent.dashboardOpenToWorkUpdateFailed);
    } finally {
      setToggleSaving(false);
    }
  }

  const handleSkillsUpdate = useCallback((skills: string[]) => {
    setUser((prev) => {
      if (!prev || prev.skillsCount === skills.length) return prev;
      return { ...prev, skillsCount: skills.length };
    });
  }, []);

  const handleProjectCountChange = useCallback((count: number) => {
    setUser((prev) => {
      if (!prev || prev.projectsCount === count) return prev;
      return { ...prev, projectsCount: count };
    });
  }, []);

  const handleExperienceCountChange = useCallback((count: number) => {
    setUser((prev) => {
      if (!prev || prev.experiencesCount === count) return prev;
      return { ...prev, experiencesCount: count };
    });
  }, []);

  if (loading) {
    return <DashboardLoadingState />;
  }

  if (dashboardError) {
    return (
      <div className="app-main">
        <div className="container">
          <div className="card">
            <div className="card-body text-center">
              <p className="form-error">{dashboardError}</p>
              <button
                type="button"
                className="btn-primary mt-2"
                onClick={() => router.replace(uiContent.routeSignin)}
              >
                {uiContent.backToSignin}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const userInitial =
    user.fullName?.charAt(0).toUpperCase() || uiContent.avatarFallbackInitial;

  const isCandidate = user.role === "candidate";
  const isRecruiter = user.role === "recruiter";
  const isAdmin = user.role === "admin";

  const roleLabel = isAdmin
    ? uiContent.adminProfile
    : isRecruiter
      ? uiContent.recruiterProfile
      : uiContent.candidateProfile;

  const cvUrl = user.cvUrl
    ? buildMediaUrl(uiContent.apiMediaPrefix, user.cvUrl)
    : "";

  return (
    <div className="app-main">
      <div className="container">
        <div className="dashboard-header">
          <div>
            <h1>
              {isAdmin
                ? uiContent.adminDashboard
                : isRecruiter
                  ? uiContent.recruiterDashboard
                  : uiContent.candidateDashboard}
            </h1>
            <p>
              {formatUiText(
                isAdmin
                  ? uiContent.adminDashboardIntro
                  : isRecruiter
                    ? uiContent.recruiterDashboardIntro
                    : uiContent.candidateDashboardIntro,
                { name: user.fullName }
              )}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">{uiContent.dashboardActions}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuLabel>{uiContent.profile}</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Link href={uiContent.routeProfile}>{uiContent.profile}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link href={uiContent.routeProfileEdit}>
                    {uiContent.editProfile}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                {isCandidate && (
                  <DropdownMenuItem>
                    <Link href={uiContent.routeConnections}>
                      {uiContent.myNetwork}
                    </Link>
                  </DropdownMenuItem>
                )}

                {isAdmin && (
                  <DropdownMenuItem>
                    <Link href={uiContent.routeAdmin}>{uiContent.admin}</Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="main-grid">
          <aside>
            <div className="card">
              <div className="profile-banner-sm">
                <div className="profile-avatar-wrap-center">
                  <div className="profile-avatar-sm">{userInitial}</div>
                </div>
              </div>

              <div className="card-body text-center profile-sidebar-body">
                <h3>{user.fullName}</h3>
                <p className="text-sm muted">
                  {user.headline || uiContent.addProfessionalHeadline}
                </p>
                <div className="role-badge">{roleLabel}</div>
              </div>

              <div className="divider"></div>

              <div className="card-body text-sm">
                {isCandidate && (
                  <>
                    <div className="flex-between mb-2">
                      <span className="muted">{uiContent.profileViewers}</span>
                      <span className="font-semibold">{user.profileViewers}</span>
                    </div>

                    <Link
                      href={uiContent.routeConnections}
                      className="flex-between mb-2"
                    >
                      <span className="muted">{uiContent.connections}</span>
                      <span className="font-semibold">
                        {user.connectionsCount}
                      </span>
                    </Link>
                  </>
                )}

                {isRecruiter && (
                  <>
                    <div className="flex-between mb-2">
                      <span className="muted">{uiContent.companyName}</span>
                      <span className="font-semibold">
                        {user.companyName || uiContent.notAdded}
                      </span>
                    </div>

                    <div className="flex-between mb-2">
                      <span className="muted">{uiContent.hiringTitle}</span>
                      <span className="font-semibold">
                        {user.hiringTitle || uiContent.notAdded}
                      </span>
                    </div>
                  </>
                )}

                {isAdmin && (
                  <div className="flex-between mb-2">
                    <span className="muted">{uiContent.adminTitle}</span>
                    <span className="font-semibold">
                      {user.adminTitle || uiContent.adminTitlePlaceholder}
                    </span>
                  </div>
                )}

                <div className="flex-between mb-2">
                  <span className="muted">{uiContent.adminStatus}</span>
                  <span className="font-semibold">
                    {isCandidate
                      ? user.openToWork
                        ? uiContent.openToWork
                        : uiContent.notLooking
                      : isRecruiter
                        ? user.companyName || uiContent.recruiter
                        : user.adminTitle || uiContent.adminRole}
                  </span>
                </div>
              </div>
            </div>
          </aside>

          <main>
            <div className="card">
              <div className="profile-banner">
                <div className="profile-avatar-wrap">
                  <div className="profile-avatar">{userInitial}</div>
                </div>
              </div>

              <div className="profile-info">
                <h1>{user.fullName}</h1>

                <p className="profile-headline">
                  {user.headline || uiContent.addYourProfessionalHeadline}
                </p>

                <div className="role-badge">{roleLabel}</div>

                <div className="profile-meta">
                  {user.location && <span>{user.location}</span>}

                  <button
                    type="button"
                    onClick={() => setShowContactModal(true)}
                    className="link-button"
                  >
                    {isCandidate
                      ? uiContent.contactInfo
                      : isRecruiter
                        ? uiContent.companyContact
                        : uiContent.adminInfo}
                  </button>
                </div>

                {user.bio && <p className="mt-2">{user.bio}</p>}

                <div className="mt-2 flex gap-2 profile-actions-row">
                  {isCandidate && (
                    <button
                      type="button"
                      className={user.openToWork ? "btn-primary" : "btn-outline"}
                      onClick={toggleOpenToWork}
                      disabled={toggleSaving}
                    >
                      {toggleSaving
                        ? uiContent.adminUpdating
                        : user.openToWork
                          ? uiContent.openToWork
                          : uiContent.setOpenToWork}
                    </button>
                  )}

                  <Link href={uiContent.routeProfileEdit} className="btn-outline">
                    {uiContent.editProfile}
                  </Link>

                  {isCandidate && (
                    <Link href={uiContent.routeConnections} className="btn-outline">
                      {uiContent.myNetwork}
                    </Link>
                  )}

                  {isAdmin && (
                    <Link href={uiContent.routeAdmin} className="btn-outline">
                      {uiContent.adminDashboard}
                    </Link>
                  )}
                </div>

                {toggleError && (
                  <p className="form-error text-sm mt-1">{toggleError}</p>
                )}
              </div>
            </div>

            <DashboardStats user={user} uiContent={uiContent} />

            {isCandidate && (
              <>
                <ProjectsSection
                  onCountChange={handleProjectCountChange}
                  onProfileChange={loadProfileSummary}
                />

                <ExperienceSection
                  onCountChange={handleExperienceCountChange}
                  onProfileChange={loadProfileSummary}
                />
              </>
            )}

            {isRecruiter && (
              <>
                {user.recruiterVerificationStatus !== "approved" && (
                  <div className="notice-banner">
                    {user.recruiterVerificationStatus === "pending"
                      ? uiContent.recruiterVerificationPendingNotice
                      : uiContent.recruiterVerificationRejectedNotice}
                  </div>
                )}

                <div className="card">
                  <div className="card-header">
                    <h3>{uiContent.companyInformation}</h3>
                  </div>

                  <div className="card-body profile-detail-list">
                    <div>
                      <span>{uiContent.companyName}</span>
                      <strong>{user.companyName || uiContent.notAdded}</strong>
                    </div>

                    <div>
                      <span>{uiContent.hiringTitle}</span>
                      <strong>{user.hiringTitle || uiContent.notAdded}</strong>
                    </div>

                    <div>
                      <span>{uiContent.companyLocation}</span>
                      <strong>
                        {user.companyLocation || uiContent.notAdded}
                      </strong>
                    </div>
                  </div>
                </div>
              </>
            )}

            {isAdmin && (
              <div className="card">
                <div className="card-header">
                  <h3>{uiContent.adminWorkspace}</h3>
                </div>

                <div className="card-body">
                  <Link href={uiContent.routeAdmin} className="quick-link">
                    {uiContent.openAdminDashboard}
                  </Link>
                </div>
              </div>
            )}

            {isCandidate && (
              <div className="card">
                <div className="card-header">
                  <h3>{uiContent.activity}</h3>
                </div>

                <div className="card-body">
                  {activities.length > 0 ? (
                    <div className="activity-list">
                      {activities.map((activity) => (
                        <div key={activity.id} className="mb-2 text-sm">
                          <div className="font-semibold">{activity.title}</div>
                          <div className="text-xs muted">
                            {formatRelativeTime(activity.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center muted text-sm">
                      {uiContent.emptyActivity}
                    </p>
                  )}
                </div>
              </div>
            )}
          </main>

          <aside>
            {isCandidate && (
              <SkillsSection
                onProfileChange={loadProfileSummary}
                onUpdate={handleSkillsUpdate}
              />
            )}

            {isCandidate && (
              <div className="card">
                <div className="card-header">
                  <h3>{uiContent.professionalProfiles}</h3>
                </div>

                <div className="card-body">
                  {user.linkedinUrl ? (
                    <a
                      href={user.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="quick-link"
                    >
                      {uiContent.linkedin}
                    </a>
                  ) : (
                    <Link href={uiContent.routeProfileEdit} className="quick-link">
                      {uiContent.addLinkedin}
                    </Link>
                  )}

                  {user.githubUrl ? (
                    <a
                      href={user.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="quick-link"
                    >
                      {uiContent.github}
                    </a>
                  ) : (
                    <Link href={uiContent.routeProfileEdit} className="quick-link">
                      {uiContent.addGithub}
                    </Link>
                  )}

                  {user.portfolioUrl ? (
                    <a
                      href={user.portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="quick-link"
                    >
                      {uiContent.portfolio}
                    </a>
                  ) : (
                    <Link href={uiContent.routeProfileEdit} className="quick-link">
                      {uiContent.addPortfolio}
                    </Link>
                  )}

                  {user.cvUrl ? (
                    <a
                      href={cvUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="quick-link"
                    >
                      {uiContent.viewCv}
                    </a>
                  ) : (
                    <Link href={uiContent.routeProfileEdit} className="quick-link">
                      {uiContent.uploadCv}
                    </Link>
                  )}
                </div>
              </div>
            )}

            {isRecruiter && user.companyWebsite && (
              <div className="card">
                <div className="card-header">
                  <h3>{uiContent.companyWebsite}</h3>
                </div>

                <div className="card-body">
                  <a
                    href={user.companyWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="quick-link"
                  >
                    {uiContent.companyWebsite}
                  </a>
                </div>
              </div>
            )}

            {isCandidate && (
              <div className="card">
                <div className="card-body">
                  <div className="text-center">
                    <div className="font-semibold mb-1">
                      {uiContent.profileCompletion}
                    </div>

                    <progress
                      className="progress-bar"
                      value={user.profileCompletion}
                      max={100}
                    />

                    <div className="text-sm muted mt-1">
                      {user.profileCompletion}% {uiContent.complete}
                    </div>

                    {user.missingFields.length > 0 && (
                      <div className="mt-2 text-left">
                        <p className="text-sm font-semibold mb-1">
                          {uiContent.completeTheseNext}
                        </p>

                        <ul className="text-sm muted profile-missing-list">
                          {user.missingFields.map((field) => (
                            <li key={field}>{field}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {user.profileCompletion < 100 && (
                      <Link
                        href={uiContent.routeProfileEdit}
                        className="btn-outline btn-sm mt-2"
                      >
                        {uiContent.completeProfile}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>

        {showContactModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowContactModal(false)}
          >
            <div
              className="modal-content"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{uiContent.contactInfo}</h3>

                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setShowContactModal(false)}
                >
                  x
                </button>
              </div>

              <div className="modal-body">
                <div className="contact-item">
                  <span className="contact-label">{uiContent.email}</span>
                  <a href={`mailto:${user.email}`} className="contact-value">
                    {user.email}
                  </a>
                </div>

                {user.linkedinUrl && (
                  <div className="contact-item">
                    <span className="contact-label">{uiContent.linkedin}</span>
                    <a
                      href={user.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="contact-value"
                    >
                      {user.linkedinUrl.replace("https://", "")}
                    </a>
                  </div>
                )}

                {user.githubUrl && (
                  <div className="contact-item">
                    <span className="contact-label">{uiContent.github}</span>
                    <a
                      href={user.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="contact-value"
                    >
                      {user.githubUrl.replace("https://", "")}
                    </a>
                  </div>
                )}

                {user.portfolioUrl && (
                  <div className="contact-item">
                    <span className="contact-label">{uiContent.portfolio}</span>
                    <a
                      href={user.portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="contact-value"
                    >
                      {user.portfolioUrl.replace("https://", "")}
                    </a>
                  </div>
                )}

                {user.location && (
                  <div className="contact-item">
                    <span className="contact-label">{uiContent.location}</span>
                    <span className="contact-value">{user.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}