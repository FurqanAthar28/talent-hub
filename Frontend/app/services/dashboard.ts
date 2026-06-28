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

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error("Failed to load dashboard data.");
  }

  return response.json();
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
  const skills = await readJson<any[]>(skillsRes);
  const projects = await readJson<any[]>(projectsRes);
  const experiences = await readJson<any[]>(experiencesRes);

  return {
    fullName: profile.fullName || "User",
    headline: profile.headline || "Manage your professional profile.",
    profileCompletion:
      profile.profileCompletion ?? profile.profile_completion ?? 0,
    openToWork: profile.openToWork ?? profile.open_to_work ?? false,
    skillsCount: skills.length,
    projectsCount: projects.length,
    experiencesCount: experiences.length,
  };
}