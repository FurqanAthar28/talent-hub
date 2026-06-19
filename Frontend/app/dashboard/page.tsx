"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../api/client";
import ProjectsSection from "../components/ProjectsSection";
import SkillsSection from "../components/SkillsSection";
import ExperienceSection from "../components/ExperienceSection";
import type { DashboardActivity, DashboardUser } from "../../types/dashboard";

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [showContactModal, setShowContactModal] = useState(false);
  const [activities, setActivities] = useState<DashboardActivity[]>([]);
  const [toggleError, setToggleError] = useState("");
  const [toggleSaving, setToggleSaving] = useState(false);

  const loadProfileSummary = useCallback(async () => {
    setDashboardError("");

    try {
      const [profileRes, activitiesRes] = await Promise.all([
        apiFetch("/profiles/me"),
        apiFetch("/profiles/activities"),
      ]);

      if (!profileRes.ok) {
        setDashboardError("Unable to load profile data.");
        setLoading(false);
        return;
      }

      const profileData = await profileRes.json();

      setUser({
        id: String(profileData.id),
        fullName: profileData.fullName || "",
        email: profileData.email || "",
        headline: profileData.headline || "",
        location: profileData.location || "",
        bio: profileData.bio || "",
        profileCompletion: profileData.profileCompletion || 0,
        profileViewers: profileData.profileViewers || 0,
        openToWork: profileData.openToWork || false,
        linkedinUrl: profileData.linkedinUrl || "",
        githubUrl: profileData.githubUrl || "",
        portfolioUrl: profileData.portfolioUrl || "",
        cvUrl: profileData.cvUrl || "",
        missingFields: profileData.missingFields || [],
        skillsCount: profileData.skillsCount || 0,
        projectsCount: profileData.projectsCount || 0,
        experiencesCount: profileData.experiencesCount || 0,
        connectionsCount: profileData.connectionsCount || 0,
      });

      if (activitiesRes.ok) {
        setActivities(await activitiesRes.json());
      }
    } catch {
      setDashboardError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }, []);

 
useEffect(() => {
  async function loadInitialProfileSummary() {
    await loadProfileSummary();
  }

  loadInitialProfileSummary();
}, [loadProfileSummary]);

  async function toggleOpenToWork() {
    if (!user || toggleSaving) return;

    const previousStatus = user.openToWork;
    const newStatus = !previousStatus;

    setToggleSaving(true);
    setToggleError("");
    setUser((prev) => (prev ? { ...prev, openToWork: newStatus } : prev));

    try {
      const res = await apiFetch("/profiles/me/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openToWork: newStatus }),
      });

      if (!res.ok) {
        setUser((prev) =>
          prev ? { ...prev, openToWork: previousStatus } : prev
        );
        setToggleError("Failed to update status. Please try again.");
        return;
      }

      const updatedProfile = await res.json();

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
    } catch {
      setUser((prev) =>
        prev ? { ...prev, openToWork: previousStatus } : prev
      );
      setToggleError("Unable to connect to server.");
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
    return (
      <div className="app-main">
        <div className="container">
          <div className="text-center mt-4">Loading your dashboard...</div>
        </div>
      </div>
    );
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
                onClick={() => router.replace("/signin")}
              >
                Back to Sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const userInitial = user.fullName?.charAt(0).toUpperCase() || "U";

  const cvUrl = user.cvUrl
    ? user.cvUrl.startsWith("http")
      ? user.cvUrl
      : `/api/backend/media/${user.cvUrl}`
    : "";

  return (
    <div className="app-main">
      <div className="container">
        <div className="dashboard-header">
          <h1>Dashboard</h1>
          <p>
            Welcome back, {user.fullName}. Manage your professional profile and
            grow your network.
          </p>
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
                  {user.headline || "Add a professional headline"}
                </p>
              </div>

              <div className="divider"></div>

              <div className="card-body text-sm">
                <div className="flex-between mb-2">
                  <span className="muted">Profile viewers</span>
                  <span className="font-semibold">{user.profileViewers}</span>
                </div>

                <Link href="/connections" className="flex-between mb-2">
                  <span className="muted">Connections</span>
                  <span className="font-semibold">{user.connectionsCount}</span>
                </Link>

                <div className="flex-between mb-2">
                  <span className="muted">Status</span>
                  <span className="font-semibold">
                    {user.openToWork ? "Open to Work" : "Not Looking"}
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
                  {user.headline || "Add your professional headline"}
                </p>

                <div className="profile-meta">
                  {user.location && <span>{user.location}</span>}

                  <button
                    type="button"
                    onClick={() => setShowContactModal(true)}
                    className="link-button"
                  >
                    Contact info
                  </button>
                </div>

                {user.bio && <p className="mt-2">{user.bio}</p>}

                <div className="mt-2 flex gap-2 profile-actions-row">
                  <button
                    type="button"
                    className={user.openToWork ? "btn-primary" : "btn-outline"}
                    onClick={toggleOpenToWork}
                    disabled={toggleSaving}
                  >
                    {toggleSaving
                      ? "Updating..."
                      : user.openToWork
                        ? "Open to Work"
                        : "Set Open to Work"}
                  </button>

                  <Link href="/profile/edit" className="btn-outline">
                    Edit profile
                  </Link>

                  <Link href="/connections" className="btn-outline">
                    My Network
                  </Link>
                </div>

                {toggleError && (
                  <p className="form-error text-sm mt-1">{toggleError}</p>
                )}
              </div>
            </div>

            <div className="dashboard-stats">
              <div className="dashboard-stat-card">
                <h3>{user.connectionsCount}</h3>
                <p>Connections</p>
              </div>

              <div className="dashboard-stat-card">
                <h3>{user.projectsCount}</h3>
                <p>Projects</p>
              </div>

              <div className="dashboard-stat-card">
                <h3>{user.skillsCount}</h3>
                <p>Skills</p>
              </div>

              <div className="dashboard-stat-card">
                <h3>{user.profileCompletion}%</h3>
                <p>Profile Completion</p>
              </div>
            </div>

            <ProjectsSection
              onCountChange={handleProjectCountChange}
              onProfileChange={loadProfileSummary}
            />

            <ExperienceSection
              onCountChange={handleExperienceCountChange}
              onProfileChange={loadProfileSummary}
            />

            <div className="card">
              <div className="card-header">
                <h3>Activity</h3>
              </div>

              <div className="card-body">
                {activities.length > 0 ? (
                  <div className="activity-list">
                    {activities.map((activity) => (
                      <div key={activity.id} className="mb-2 text-sm">
                        <div>{activity.title}</div>
                        <div className="text-xs muted">
                          {new Date(activity.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center muted text-sm">
                    Your activity will appear here when you update your profile,
                    add projects, or connect with professionals.
                  </p>
                )}
              </div>
            </div>
          </main>

          <aside>
            <SkillsSection
              onProfileChange={loadProfileSummary}
              onUpdate={handleSkillsUpdate}
            />

            <div className="card">
              <div className="card-header">
                <h3>Professional Profiles</h3>
              </div>

              <div className="card-body">
                {user.linkedinUrl ? (
                  <a
                    href={user.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="quick-link"
                  >
                    LinkedIn
                  </a>
                ) : (
                  <Link href="/profile/edit" className="quick-link">
                    Add LinkedIn
                  </Link>
                )}

                {user.githubUrl ? (
                  <a
                    href={user.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="quick-link"
                  >
                    GitHub
                  </a>
                ) : (
                  <Link href="/profile/edit" className="quick-link">
                    Add GitHub
                  </Link>
                )}

                {user.portfolioUrl ? (
                  <a
                    href={user.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="quick-link"
                  >
                    Portfolio
                  </a>
                ) : (
                  <Link href="/profile/edit" className="quick-link">
                    Add Portfolio
                  </Link>
                )}

                {user.cvUrl ? (
                  <a
                    href={cvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="quick-link"
                  >
                    View CV
                  </a>
                ) : (
                  <Link href="/profile/edit" className="quick-link">
                    Upload CV
                  </Link>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div className="text-center">
                  <div className="font-semibold mb-1">Profile Completion</div>

                  <progress
                    className="progress-bar"
                    value={user.profileCompletion}
                    max={100}
                  />

                  <div className="text-sm muted mt-1">
                    {user.profileCompletion}% complete
                  </div>

                  {user.missingFields.length > 0 && (
                    <div className="mt-2 text-left">
                      <p className="text-sm font-semibold mb-1">
                        Complete these next:
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
                      href="/profile/edit"
                      className="btn-outline btn-sm mt-2"
                    >
                      Complete Profile
                    </Link>
                  )}
                </div>
              </div>
            </div>
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
                <h3>Contact Info</h3>

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
                  <span className="contact-label">Email</span>
                  <a href={`mailto:${user.email}`} className="contact-value">
                    {user.email}
                  </a>
                </div>

                {user.linkedinUrl && (
                  <div className="contact-item">
                    <span className="contact-label">LinkedIn</span>
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
                    <span className="contact-label">GitHub</span>
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
                    <span className="contact-label">Portfolio</span>
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
                    <span className="contact-label">Location</span>
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