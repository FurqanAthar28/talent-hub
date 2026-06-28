"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchUiContent, type UiContent } from "../../api/ui-content";
import ProjectsSection from "../../components/ProjectsSection";
import DashboardActivityCard from "./components/DashboardActivity";
import ExperienceSection from "../../components/ExperienceSection";
import DashboardContactModal from "./components/DashboardContactModal";
import DashboardHeader from "./components/DashboardHeader";
import DashboardLoadingState from "./components/DashboardLoadingState";
import DashboardRightSidebar from "./components/DashboardRightSidebar";
import DashboardProfileCard from "./components/DashboardProfileCard";
import DashboardSidebar from "./components/DashboardSidebar";
import DashboardStats from "./components/DashboardStats";
import {
  fetchDashboardSummary,
  updateDashboardOpenToWork,
} from "../../services/dashboard";
import { buildMediaUrl } from "../../utils/media";
import type {
  DashboardActivity,
  DashboardUser,
} from "../../../types/dashboard";

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
      const updatedProfile = await updateDashboardOpenToWork(
        uiContent,
        newStatus,
      );

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
      setUser((prev) =>
        prev ? { ...prev, openToWork: previousStatus } : prev,
      );
      setToggleError(uiContent.dashboardOpenToWorkUpdateFailed);
    } finally {
      setToggleSaving(false);
    }
  }

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
        <DashboardHeader user={user} uiContent={uiContent} />

        <div className="main-grid">
          <DashboardSidebar user={user} uiContent={uiContent} />

          <main>
            <DashboardProfileCard
              user={user}
              uiContent={uiContent}
              userInitial={userInitial}
              roleLabel={roleLabel}
              toggleSaving={toggleSaving}
              toggleError={toggleError}
              onOpenContactModal={() => setShowContactModal(true)}
              onToggleOpenToWork={toggleOpenToWork}
            />

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
              <DashboardActivityCard
                activities={activities}
                uiContent={uiContent}
              />
            )}
          </main>

          <DashboardRightSidebar
            user={user}
            uiContent={uiContent}
            cvUrl={cvUrl}
          />
        </div>

        {showContactModal && (
          <DashboardContactModal
            user={user}
            uiContent={uiContent}
            onClose={() => setShowContactModal(false)}
          />
        )}
      </div>
    </div>
  );
}
