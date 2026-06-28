import { apiFetch } from "../api/client";

export type DashboardData = {
  fullName: string;
  headline: string;
  profileCompletion: number;
  openToWork: boolean;
  skillsCount: number;
  projectsCount: number;
  experiencesCount: number;
};

export type RecruiterDashboardData = {
  availableProfessionalsCount: number;
  myConnectionsCount: number;
  pendingRequestsCount: number;
};

export type AdminDashboardData = {
  totalUsers: number;
  activeUsers: number;
  recruiters: number;
  totalConnections: number;
};

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error("Failed to load dashboard data.");
  }

  return response.json();
}

function getArrayLength(data: unknown): number {
  if (Array.isArray(data)) return data.length;

  if (
    data &&
    typeof data === "object" &&
    "results" in data &&
    Array.isArray((data as { results: unknown[] }).results)
  ) {
    return (data as { results: unknown[] }).results.length;
  }

  return 0;
}

export async function getDashboardData(): Promise<DashboardData> {
  const [profileRes, skillsRes, projectsRes, experiencesRes] =
    await Promise.all([
      apiFetch("/profiles/me/"),
      apiFetch("/profiles/skills/"),
      apiFetch("/profiles/projects/"),
      apiFetch("/profiles/experiences/"),
    ]);

  const profile = await readJson<any>(profileRes);
  const skills = await readJson<unknown>(skillsRes);
  const projects = await readJson<unknown>(projectsRes);
  const experiences = await readJson<unknown>(experiencesRes);

  return {
    fullName: profile.fullName || "User",
    headline: profile.headline || "Manage your professional profile.",
    profileCompletion:
      profile.profileCompletion ?? profile.profile_completion ?? 0,
    openToWork: profile.openToWork ?? profile.open_to_work ?? false,
    skillsCount: getArrayLength(skills),
    projectsCount: getArrayLength(projects),
    experiencesCount: getArrayLength(experiences),
  };
}

export async function getRecruiterDashboardData(): Promise<RecruiterDashboardData> {
  const [usersRes, connectionsRes, pendingRes] = await Promise.all([
    apiFetch("/connections/users/"),
    apiFetch("/connections/my-connections/"),
    apiFetch("/connections/pending/"),
  ]);

  const users = await readJson<unknown>(usersRes);
  const connections = await readJson<unknown>(connectionsRes);
  const pending = await readJson<unknown>(pendingRes);

  return {
    availableProfessionalsCount: getArrayLength(users),
    myConnectionsCount: getArrayLength(connections),
    pendingRequestsCount: getArrayLength(pending),
  };
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [statsRes, connectionsRes] = await Promise.all([
    apiFetch("/accounts/admin/stats/", undefined, {
      redirectOnUnauthorized: false,
    }),
    apiFetch("/connections/admin/connections/", undefined, {
      redirectOnUnauthorized: false,
    }),
  ]);

  const stats = statsRes.ok ? await statsRes.json() : {};
  const connections = connectionsRes.ok ? await connectionsRes.json() : [];

  return {
    totalUsers: stats.totalUsers ?? stats.total_users ?? 0,
    activeUsers: stats.activeUsers ?? stats.active_users ?? 0,
    recruiters: stats.recruiters ?? stats.totalRecruiters ?? stats.total_recruiters ?? 0,
    totalConnections:
      stats.totalConnections ??
      stats.total_connections ??
      getArrayLength(connections),
  };
}