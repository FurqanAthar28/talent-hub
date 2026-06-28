"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../../api/client";
import { fetchUiContent, type UiContent } from "../../../api/ui-content";
import { buildMediaUrl } from "../../../utils/media";

type UserProfile = {
  id: string;
  role: "candidate" | "recruiter" | "admin";
  fullName: string;
  email: string;
  headline: string;
  location: string;
  bio: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  companyName: string;
  companyWebsite: string;
  companyLocation: string;
  hiringTitle: string;
  adminTitle: string;
  cvUrl: string;
};

type Skill = {
  id: number;
  name: string;
};

type Project = {
  id: number;
  title: string;
  description: string;
  tech_stack: string[];
  github_url: string;
};

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

type ConnectionUser = {
  id: number;
  fullName: string;
  email: string;
};

type AuthenticatedUser = {
  id: number;
  isStaff: boolean;
  role?: "candidate" | "recruiter" | "admin";
};

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [connections, setConnections] = useState<ConnectionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [connectLoading, setConnectLoading] = useState(false);
  const [uiContent, setUiContent] = useState<UiContent>({});
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);

  const loadProfile = useCallback(
    async (userId: string) => {
      setNotice("");

      try {
        const uiContentData = await fetchUiContent();
        setUiContent(uiContentData);

        const meRes = await apiFetch("/accounts/me");
        const authenticatedUser = (await meRes.json()) as AuthenticatedUser;
        const currentViewerIsAdmin =
          authenticatedUser.isStaff || authenticatedUser.role === "admin";
        setViewerIsAdmin(currentViewerIsAdmin);

        if (String(userId) === String(authenticatedUser.id)) {
          router.push(uiContentData.routeProfile);
          return;
        }

        const [profileRes, skillsRes, projectsRes, experiencesRes] =
          await Promise.all([
            apiFetch(`/profiles/${userId}`),
            apiFetch(`/profiles/${userId}/skills`),
            apiFetch(`/profiles/${userId}/projects`),
            apiFetch(`/profiles/${userId}/experiences`),
          ]);

        if (!profileRes.ok) {
          router.push(uiContentData.routeConnections);
          return;
        }

        await apiFetch(`/profiles/${userId}/view`, {
          method: "POST",
        });

        const profile = await profileRes.json();

        setUser({
          id: userId,
          role: profile.role ?? "candidate",
          fullName: profile.fullName || "",
          email: profile.email || "",
          headline: profile.headline || "",
          location: profile.location || "",
          bio: profile.bio || "",
          linkedinUrl: profile.linkedinUrl || "",
          githubUrl: profile.githubUrl || "",
          portfolioUrl: profile.portfolioUrl || "",
          companyName: profile.companyName || "",
          companyWebsite: profile.companyWebsite || "",
          companyLocation: profile.companyLocation || "",
          hiringTitle: profile.hiringTitle || "",
          adminTitle: profile.adminTitle || "",
          cvUrl: profile.cvUrl || "",
        });

        if (skillsRes.ok) {
          setSkills(await skillsRes.json());
        }

        if (projectsRes.ok) {
          setProjects(await projectsRes.json());
        }

        if (experiencesRes.ok) {
          setExperiences(await experiencesRes.json());
        }

        if (!currentViewerIsAdmin) {
          const connectionsRes = await apiFetch("/connections/my-connections");
          if (!connectionsRes.ok) return;
          setConnections(await connectionsRes.json());
        }
      } catch (error) {
        console.error("Failed to load public profile:", error);
        setNotice("Unable to load this profile.");
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

useEffect(() => {
  async function loadInitialProfile() {
    await loadProfile(String(params.id));
  }

  loadInitialProfile();
}, [params.id, loadProfile]);

  async function handleConnect() {
    if (!user || connectLoading) return;

    setConnectLoading(true);
    setNotice("");

    try {
      const res = await apiFetch("/connections/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiverId: user.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setNotice(data.message || "Could not send connection request.");
        return;
      }

      setNotice("Connection request sent.");
    } catch (error) {
      console.error("Failed to send profile connection request:", error);
      setNotice("Something went wrong while sending request.");
    } finally {
      setConnectLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="app-main">
        <div className="container">
          <div className="text-center mt-4">{uiContent.loading}</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-main">
        <div className="container">
          {notice && <div className="notice-banner">{notice}</div>}
        </div>
      </div>
    );
  }

  const userInitial = user.fullName?.charAt(0).toUpperCase() || "U";
  const cvUrl = user.cvUrl ? buildMediaUrl(uiContent.apiMediaPrefix, user.cvUrl) : "";

  const isConnected = connections.some(
    (connection) => String(connection.id) === String(user.id)
  );
  const isCandidate = user.role === "candidate";
  const canUseConnections = !viewerIsAdmin && user.role !== "admin";
  const roleLabel =
    user.role === "admin"
      ? uiContent.adminProfile
      : user.role === "recruiter"
        ? uiContent.recruiterProfile
        : uiContent.candidateProfile;

  return (
    <div className="app-main">
      <div className="container">
        {notice && <div className="notice-banner">{notice}</div>}

        <div className="profile-grid">
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
                  {user.headline || uiContent.professionalFallback}
                </p>

                <div className="role-badge">{roleLabel}</div>

                <div className="profile-meta">
                  {user.location && <span>{user.location}</span>}
                </div>

                {user.bio && <p className="mt-2">{user.bio}</p>}

                {canUseConnections && (
                  <div className="mt-2 flex gap-2">
                    {isConnected ? (
                      <button type="button" className="btn-outline" disabled>
                        Connected
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleConnect}
                        disabled={connectLoading}
                      >
                        {connectLoading ? "Sending..." : "Connect"}
                      </button>
                    )}

                    <Link href="/connections" className="btn-outline">
                      Back to Network
                    </Link>
                  </div>
                )}
              </div>

              <div className="stats-grid">
                {isCandidate ? (
                  <>
                    {canUseConnections && (
                      <div className="stat-item">
                        <span className="stat-value">{connections.length}</span>
                        <span className="stat-label">{uiContent.connections}</span>
                      </div>
                    )}

                    <div className="stat-item">
                      <span className="stat-value">{projects.length}</span>
                      <span className="stat-label">{uiContent.projects}</span>
                    </div>

                    <div className="stat-item">
                      <span className="stat-value">{skills.length}</span>
                      <span className="stat-label">{uiContent.skills}</span>
                    </div>
                  </>
                ) : (
                  <div className="stat-item">
                    <span className="stat-value">
                      {user.role === "recruiter"
                        ? user.companyName || uiContent.recruiter
                        : user.adminTitle || uiContent.adminRole}
                    </span>
                    <span className="stat-label">
                      {user.role === "recruiter"
                        ? uiContent.companyName
                        : uiContent.adminTitle}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {isCandidate && experiences.length > 0 && (
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

            {isCandidate && projects.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3>{uiContent.projects}</h3>
                </div>

                <div className="card-body">
                  {projects.map((project) => (
                    <div key={project.id} className="project-item mb-2">
                      <p className="font-semibold">{project.title}</p>

                      {project.description && (
                        <p className="text-sm muted">{project.description}</p>
                      )}

                      {project.tech_stack.length > 0 && (
                        <div className="skill-tags mt-1">
                          {project.tech_stack.map((tech) => (
                            <span key={tech} className="skill-tag">
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}

                      {project.github_url && (
                        <a
                          href={project.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm"
                        >
                          View on GitHub
                        </a>
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
            {isCandidate && skills.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3>{uiContent.skills}</h3>
                </div>

                <div className="card-body">
                  <div className="skill-tags">
                    {skills.map((skill) => (
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
                {isCandidate && user.linkedinUrl && (
                  <a
                    href={user.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 mb-2 text-sm"
                >
                    {uiContent.linkedin}
                  </a>
                )}

                {isCandidate && user.githubUrl && (
                  <a
                    href={user.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 mb-2 text-sm"
                >
                    {uiContent.github}
                  </a>
                )}

                {isCandidate && user.portfolioUrl && (
                  <a
                    href={user.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 mb-2 text-sm"
                >
                    {uiContent.portfolio}
                  </a>
                )}

                {user.role === "recruiter" && user.companyWebsite && (
                  <a
                    href={user.companyWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 mb-2 text-sm"
                  >
                    {uiContent.companyWebsite}
                  </a>
                )}

                {isCandidate && user.cvUrl && (
                  <a
                    href={cvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 text-sm"
                  >
                    {uiContent.viewCv}
                  </a>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
