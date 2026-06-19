"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../../api/client";

type UserProfile = {
  id: string;
  fullName: string;
  email: string;
  headline: string;
  location: string;
  bio: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
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

  const loadProfile = useCallback(
    async (userId: string) => {
      setNotice("");

      try {
        const meRes = await apiFetch("/accounts/me");
        const authenticatedUser = await meRes.json();

        if (String(userId) === String(authenticatedUser.id)) {
          router.push("/profile");
          return;
        }

        const [profileRes, skillsRes, projectsRes, experiencesRes, connectionsRes] =
          await Promise.all([
            apiFetch(`/profiles/${userId}`),
            apiFetch(`/profiles/${userId}/skills`),
            apiFetch(`/profiles/${userId}/projects`),
            apiFetch(`/profiles/${userId}/experiences`),
            apiFetch("/connections/my-connections"),
          ]);

        if (!profileRes.ok) {
          router.push("/connections");
          return;
        }

        await apiFetch(`/profiles/${userId}/view`, {
          method: "POST",
        });

        const profile = await profileRes.json();

        setUser({
          id: userId,
          fullName: profile.fullName || "",
          email: profile.email || "",
          headline: profile.headline || "",
          location: profile.location || "",
          bio: profile.bio || "",
          linkedinUrl: profile.linkedinUrl || "",
          githubUrl: profile.githubUrl || "",
          portfolioUrl: profile.portfolioUrl || "",
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

        if (connectionsRes.ok) {
          setConnections(await connectionsRes.json());
        }
      } catch {
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
    } catch {
      setNotice("Something went wrong while sending request.");
    } finally {
      setConnectLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="app-main">
        <div className="container">
          <div className="text-center mt-4">Loading...</div>
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
  const cvUrl = user.cvUrl
    ? user.cvUrl.startsWith("http")
      ? user.cvUrl
      : `/api/backend/media/${user.cvUrl}`
    : "";

  const isConnected = connections.some(
    (connection) => String(connection.id) === String(user.id)
  );

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
                  {user.headline || "Professional"}
                </p>

                <div className="profile-meta">
                  {user.location && <span>{user.location}</span>}
                </div>

                {user.bio && <p className="mt-2">{user.bio}</p>}

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
              </div>

              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-value">{connections.length}</span>
                  <span className="stat-label">Connections</span>
                </div>

                <div className="stat-item">
                  <span className="stat-value">{projects.length}</span>
                  <span className="stat-label">Projects</span>
                </div>

                <div className="stat-item">
                  <span className="stat-value">{skills.length}</span>
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

            {projects.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3>Projects</h3>
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
          </main>

          <aside>
            {skills.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3>Skills</h3>
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
                    className="flex gap-2 mb-2 text-sm"
                  >
                    Portfolio
                  </a>
                )}

                {user.cvUrl && (
                  <a
                    href={cvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-2 text-sm"
                  >
                    View CV
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