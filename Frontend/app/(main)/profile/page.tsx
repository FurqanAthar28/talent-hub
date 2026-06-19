"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../api/client";

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

  const loadUser = useCallback(async () => {
    try {
      const [profileRes, experienceRes, skillsRes, projectsRes, connectionsRes] =
        await Promise.all([
          apiFetch("/profiles/me"),
          apiFetch("/profiles/experiences"),
          apiFetch("/profiles/skills"),
          apiFetch("/profiles/projects"),
          apiFetch("/connections/my-connections"),
        ]);

      if (!profileRes.ok) {
        router.push("/signin");
        return;
      }

      const profile = await profileRes.json();
      const experienceData = experienceRes.ok ? await experienceRes.json() : [];
      const skillsData = skillsRes.ok ? await skillsRes.json() : [];
      const projectsData = projectsRes.ok ? await projectsRes.json() : [];
      const connectionsData = connectionsRes.ok
        ? await connectionsRes.json()
        : [];

      const mappedUser: User = {
        id: String(profile.id),
        fullName: profile.fullName || "",
        email: profile.email || "",
        headline: profile.headline || "",
        location: profile.location || "",
        bio: profile.bio || "",
        skills: skillsData,
        projects: projectsData,
        experiences: experienceData,
        connections: connectionsData,
        linkedinUrl: profile.linkedinUrl || "",
        githubUrl: profile.githubUrl || "",
        portfolioUrl: profile.portfolioUrl || "",
        profileCompletion: profile.profileCompletion || 0,
        profileViewers: profile.profileViewers || 0,
        openToWork: profile.openToWork || false,
        cvUrl: profile.cvUrl || "",
      };

      setUser(mappedUser);
      setExperiences(experienceData);
    } catch {
      router.push("/signin");
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
        <div className="container">Loading...</div>
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
                      {user.headline || "Professional"}
                    </p>

                    {user.location && (
                      <p className="profile-location">{user.location}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push("/profile/edit")}
                    className="btn-primary"
                  >
                    Edit Profile
                  </button>
                </div>

                {user.bio && <p className="profile-bio">{user.bio}</p>}
              </div>

              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-value">
                    {user.connections?.length || 0}
                  </span>
                  <span className="stat-label">Connections</span>
                </div>

                <div className="stat-item">
                  <span className="stat-value">
                    {user.projects?.length || 0}
                  </span>
                  <span className="stat-label">Projects</span>
                </div>

                <div className="stat-item">
                  <span className="stat-value">
                    {user.skills?.length || 0}
                  </span>
                  <span className="stat-label">Skills</span>
                </div>
              </div>
            </div>

            {experiences.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3>Experience</h3>
                </div>

                <div className="card-body">
                  {experiences.map((experience) => (
                    <div key={experience.id} className="mb-2">
                      <p className="font-semibold">{experience.title}</p>

                      <p className="text-sm">{experience.company}</p>

                      <p className="text-sm muted">
                        {experience.start_date || "Start date"} -{" "}
                        {experience.current
                          ? "Present"
                          : experience.end_date || "End date"}
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
          </main>

          <aside>
            {user.skills && user.skills.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3>Skills</h3>
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
                <h3>Contact</h3>
              </div>

              <div className="card-body">
                {user.linkedinUrl && (
                  <a
                    href={user.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 mb-2 text-sm"
                  >
                    LinkedIn
                  </a>
                )}

                {user.githubUrl && (
                  <a
                    href={user.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 mb-2 text-sm"
                  >
                    GitHub
                  </a>
                )}

                {user.portfolioUrl && (
                  <a
                    href={user.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 text-sm"
                  >
                    Portfolio
                  </a>
                )}
              </div>
            </div>

            {user.cvUrl && (
              <div className="card">
                <div className="card-header">
                  <h3>CV</h3>
                </div>

                <div className="card-body">
                  <a
                    href={cvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="quick-link"
                  >
                    View CV
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