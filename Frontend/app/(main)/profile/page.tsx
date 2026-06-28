"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../api/client";
import { fetchUiContent, type UiContent } from "../../api/ui-content";
import { buildMediaUrl } from "../../utils/media";

type Experience = {
  id: number;
  title: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string;
  current: boolean;
  description: string;
};

type User = {
  id: string;
  role: "candidate" | "recruiter" | "admin";
  fullName: string;
  email: string;
  headline: string;
  location: string;
  bio: string;
  skills: { id: number; name: string }[];
  projects: { id: number; title: string }[];
  experiences: Experience[];
  connections: { id: number }[];
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  companyName: string;
  companyWebsite: string;
  companyLocation: string;
  hiringTitle: string;
  adminTitle: string;
  profileCompletion?: number;
  profileViewers?: number;
  openToWork?: boolean;
  cvUrl?: string;
};

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [uiContent, setUiContent] = useState<UiContent>({});

  const loadUser = useCallback(async () => {
    let signinRoute = "";

    try {
      const uiContentData = await fetchUiContent();
      signinRoute = uiContentData.routeSignin;
      setUiContent(uiContentData);

      const [profileRes, experienceRes, skillsRes, projectsRes] =
        await Promise.all([
          apiFetch(uiContentData.apiProfileMe),
          apiFetch(uiContentData.apiProfileExperiences),
          apiFetch(uiContentData.apiProfileSkills),
          apiFetch(uiContentData.apiProfileProjects),
        ]);

      if (!profileRes.ok) {
        router.push(uiContentData.routeSignin);
        return;
      }

      const profile = await profileRes.json();
      const experienceData = experienceRes.ok ? await experienceRes.json() : [];
      const skillsData = skillsRes.ok ? await skillsRes.json() : [];
      const projectsData = projectsRes.ok ? await projectsRes.json() : [];

      const mappedUser: User = {
        id: String(profile.id),
        role: profile.role ?? "candidate",
        fullName: profile.fullName ?? "",
        email: profile.email ?? "",
        headline: profile.headline ?? "",
        location: profile.location ?? "",
        bio: profile.bio ?? "",
        skills: skillsData,
        projects: projectsData,
        experiences: experienceData,
        connections: [],
        linkedinUrl: profile.linkedinUrl ?? "",
        githubUrl: profile.githubUrl ?? "",
        portfolioUrl: profile.portfolioUrl ?? "",
        companyName: profile.companyName ?? "",
        companyWebsite: profile.companyWebsite ?? "",
        companyLocation: profile.companyLocation ?? "",
        hiringTitle: profile.hiringTitle ?? "",
        adminTitle: profile.adminTitle ?? "",
        profileCompletion: profile.profileCompletion ?? 0,
        profileViewers: profile.profileViewers ?? 0,
        openToWork: profile.openToWork ?? false,
        cvUrl: profile.cvUrl ?? "",
      };

      setUser(mappedUser);
      setExperiences(experienceData);
    } catch (error) {
      console.error("Failed to load profile page data:", error);
      if (signinRoute) {
        router.push(signinRoute);
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    async function loadInitialUser() {
      await loadUser();
    }

    loadInitialUser();
  }, [loadUser]);

  if (loading) {
    return (
      <div className="app-main">
        <div className="container">{uiContent.loading}</div>
      </div>
    );
  }

  if (!user) return null;

  const userInitial =
    user.fullName?.charAt(0).toUpperCase() || uiContent.avatarFallbackInitial;
  const cvUrl = user.cvUrl ? buildMediaUrl(uiContent.apiMediaPrefix, user.cvUrl) : "";
  const roleLabel =
    user.role === "admin"
      ? uiContent.adminProfile
      : user.role === "recruiter"
        ? uiContent.recruiterProfile
        : uiContent.candidateProfile;

  return (
    <div className="app-main">
      <div className="container">
        <div className="profile-grid">
          <main>
            <div className="card">
              <div className="profile-banner">
                <div className="profile-avatar-wrap">
                  <div className="profile-avatar">{userInitial}</div>
                </div>
              </div>

              <div className="profile-info">
                <div className="profile-header-row">
                  <div>
                    <h1 className="profile-name">{user.fullName}</h1>

                    <p className="profile-headline">
                      {user.headline || uiContent.professionalFallback}
                    </p>

                    <div className="role-badge">{roleLabel}</div>

                    {user.location && (
                      <p className="profile-location">{user.location}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push(uiContent.routeProfileEdit)}
                    className="btn-primary"
                  >
                    {uiContent.editProfile}
                  </button>
                </div>

                {user.bio && <p className="profile-bio">{user.bio}</p>}

                {user.role === "recruiter" && (
                  <p className="profile-bio">{uiContent.recruiterProfileHint}</p>
                )}

                {user.role === "admin" && (
                  <p className="profile-bio">{uiContent.adminProfileHint}</p>
                )}
              </div>

              {user.role === "candidate" ? (
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-value">
                      {user.connections?.length || 0}
                    </span>
                    <span className="stat-label">{uiContent.connections}</span>
                  </div>

                  <div className="stat-item">
                    <span className="stat-value">
                      {user.projects?.length || 0}
                    </span>
                    <span className="stat-label">{uiContent.projects}</span>
                  </div>

                  <div className="stat-item">
                    <span className="stat-value">
                      {user.skills?.length || 0}
                    </span>
                    <span className="stat-label">{uiContent.skills}</span>
                  </div>
                </div>
              ) : user.role === "recruiter" ? (
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-value">
                      {user.companyName || uiContent.recruiter}
                    </span>
                    <span className="stat-label">{uiContent.companyName}</span>
                  </div>

                  <div className="stat-item">
                    <span className="stat-value">{user.hiringTitle || "-"}</span>
                    <span className="stat-label">{uiContent.hiringTitle}</span>
                  </div>
                </div>
              ) : (
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-value">
                      {user.adminTitle || uiContent.adminRole}
                    </span>
                    <span className="stat-label">{uiContent.adminTitle}</span>
                  </div>

                  <div className="stat-item">
                    <span className="stat-value">{uiContent.admin}</span>
                    <span className="stat-label">{uiContent.adminDashboard}</span>
                  </div>
                </div>
              )}
            </div>

            {user.role === "candidate" && experiences.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3>{uiContent.experience}</h3>
                </div>

                <div className="card-body">
                  {experiences.map((experience) => (
                    <div key={experience.id} className="mb-2">
                      <p className="font-semibold">{experience.title}</p>

                      <p className="text-sm">{experience.company}</p>

                      <p className="text-sm muted">
                        {experience.start_date || uiContent.startDateFallback} -{" "}
                        {experience.current
                          ? uiContent.present
                          : experience.end_date || uiContent.endDateFallback}
                      </p>

                      {experience.location && (
                        <p className="text-sm muted">{experience.location}</p>
                      )}

                      {experience.description && (
                        <p className="text-sm mt-1">
                          {experience.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {user.role === "recruiter" && (
              <div className="card">
                <div className="card-header">
                  <h3>{uiContent.companyInformation}</h3>
                </div>

                <div className="card-body profile-detail-list">
                  {user.companyName && (
                    <div>
                      <span>{uiContent.companyName}</span>
                      <strong>{user.companyName}</strong>
                    </div>
                  )}
                  {user.hiringTitle && (
                    <div>
                      <span>{uiContent.hiringTitle}</span>
                      <strong>{user.hiringTitle}</strong>
                    </div>
                  )}
                  {user.companyLocation && (
                    <div>
                      <span>{uiContent.companyLocation}</span>
                      <strong>{user.companyLocation}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {user.role === "admin" && (
              <div className="card">
                <div className="card-header">
                  <h3>{uiContent.adminProfile}</h3>
                </div>

                <div className="card-body profile-detail-list">
                  <div>
                    <span>{uiContent.adminTitle}</span>
                    <strong>{user.adminTitle || uiContent.adminRole}</strong>
                  </div>
                </div>
              </div>
            )}
          </main>

          <aside>
            {user.role === "candidate" && user.skills && user.skills.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3>{uiContent.skills}</h3>
                </div>

                <div className="card-body">
                  <div className="skill-badges">
                    {user.skills.map((skill) => (
                      <span key={skill.id} className="badge">
                        {skill.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-header">
                <h3>
                  {user.role === "recruiter"
                    ? uiContent.recruiterContact
                    : user.role === "admin"
                      ? uiContent.adminContact
                      : uiContent.contact}
                </h3>
              </div>

              <div className="card-body">
                {user.role === "candidate" && user.linkedinUrl && (
                  <a
                    href={user.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 mb-2 text-sm"
                  >
                    {uiContent.linkedin}
                  </a>
                )}

                {user.role === "candidate" && user.githubUrl && (
                  <a
                    href={user.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 mb-2 text-sm"
                  >
                    {uiContent.github}
                  </a>
                )}

                {user.role === "candidate" && user.portfolioUrl && (
                  <a
                    href={user.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 text-sm"
                  >
                    {uiContent.portfolio}
                  </a>
                )}

                {user.role === "recruiter" && user.companyWebsite && (
                  <a
                    href={user.companyWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 text-sm"
                  >
                    {uiContent.companyWebsite}
                  </a>
                )}
              </div>
            </div>

            {user.role === "candidate" && user.cvUrl && (
              <div className="card">
                <div className="card-header">
                  <h3>{uiContent.cv}</h3>
                </div>

                <div className="card-body">
                  <a
                    href={cvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="quick-link"
                  >
                    {uiContent.viewCv}
                  </a>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
