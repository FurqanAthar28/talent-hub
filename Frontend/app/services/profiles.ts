/**
 * Loading profiles (mine, or someone else's) with their skills,
 * projects and work experience.
 */

import type { Experience } from "../(main)/profile/edit/components/candidate/experience/experienceTypes";
import type { Project } from "../(main)/profile/edit/components/candidate/projects/projectTypes";
import { apiFetch, getApiMessage, readJson } from "../api/client";
import { API_ROUTES } from "../config/apiRoutes";
import type { ApprovalStatus, RejectionReason } from "../config/constants";
import type { RelationshipStatus } from "./connections";
import type { Skill } from "./skills";

export type ProfileRole = "candidate" | "recruiter" | "admin";

/** A profile as Django sends it (see ProfileSerializer in Backend/profiles). */
export type Profile = {
  id: number; // the PROFILE's id (not the user's id)
  role: ProfileRole;
  fullName: string;
  email: string; // "" unless it's my own profile (or I'm staff)
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
  // Recruiters: about the company (all optional)
  companyAbout: string;
  companyIndustry: string;
  companySize: string; // "" or one of COMPANY_SIZES (config/constants.ts)
  companyLinkedinUrl: string;
  workStyles: string[]; // WORK_STYLES values, e.g. ["hybrid", "remote"]
  // Recruiters: "Hiring for"
  hiringNow: boolean;
  hiringRoles: string[];
  hiringSkills: string[];
  hiringLocations: string[];
  hiringLevels: string[]; // HIRING_LEVELS values
  adminTitle: string;
  cvUrl: string; // "" if there is no CV, or I may not see it
  openToWork: boolean;
  profileCompletion: number;
  profileViewers: number;
  skillsCount: number;
  projectsCount: number;
  experiencesCount: number;
  connectionsCount: number;

  // "Is my profile ready?" Django decides the items for each role.
  completionChecklist: ChecklistItem[];
  missingFields: string[];

  // Candidates AND recruiters wait for an admin's approval.
  // The reason and the missing list are only sent to the person themselves.
  approvalStatus: ApprovalStatus;
  rejectionReason: RejectionReason | "";
  approvalMissing: string[]; // what to add before an admin can approve

  // Only on SOMEONE ELSE's profile: how I am related to them.
  connectionStatus?: RelationshipStatus;
  requestId?: number | null;
};

/** One item of the profile checklist, e.g. { label: "CV", done: false }. */
export type ChecklistItem = {
  label: string;
  done: boolean;
};

/** A profile plus its 3 lists, everything a profile page shows. */
export type ProfileDetails = {
  profile: Profile;
  skills: Skill[];
  projects: Project[];
  experiences: Experience[];
};

/** Stop with Django's message (or the fallback) when the request failed. */
async function throwIfFailed(response: Response, fallback: string) {
  if (response.ok) return;

  const data = await readJson(response);
  throw new Error(getApiMessage(data) || fallback);
}

/** A list from Django, or [] if that one list failed (the page still works). */
async function listOrEmpty<Item>(response: Response): Promise<Item[]> {
  if (!response.ok) return [];

  const data: unknown = await response.json();
  return Array.isArray(data) ? (data as Item[]) : [];
}

/** Load 4 things at the same time: the profile and its 3 lists. */
async function loadDetails(addresses: {
  profile: string;
  skills: string;
  projects: string;
  experiences: string;
}): Promise<ProfileDetails> {
  const [profileRes, skillsRes, projectsRes, experiencesRes] = await Promise.all([
    apiFetch(addresses.profile),
    apiFetch(addresses.skills),
    apiFetch(addresses.projects),
    apiFetch(addresses.experiences),
  ]);

  await throwIfFailed(profileRes, "This profile could not be loaded.");

  return {
    profile: (await profileRes.json()) as Profile,
    skills: await listOrEmpty<Skill>(skillsRes),
    projects: await listOrEmpty<Project>(projectsRes),
    experiences: await listOrEmpty<Experience>(experiencesRes),
  };
}

export function fetchMyProfileDetails(): Promise<ProfileDetails> {
  return loadDetails({
    profile: API_ROUTES.PROFILES.ME,
    skills: API_ROUTES.PROFILES.SKILLS,
    projects: API_ROUTES.PROFILES.PROJECTS,
    experiences: API_ROUTES.PROFILES.EXPERIENCES,
  });
}

/** Someone else's profile, found by their USER id. */
export function fetchUserProfileDetails(userId: string): Promise<ProfileDetails> {
  return loadDetails({
    profile: API_ROUTES.PROFILES.USER(userId),
    skills: API_ROUTES.PROFILES.USER_SKILLS(userId),
    projects: API_ROUTES.PROFILES.USER_PROJECTS(userId),
    experiences: API_ROUTES.PROFILES.USER_EXPERIENCES(userId),
  });
}

/**
 * Tell Django "I looked at this profile" (for the "who viewed me" count).
 * If it fails, nothing breaks, so we only log it.
 */
export function trackProfileView(userId: string): void {
  apiFetch(API_ROUTES.PROFILES.TRACK_VIEW(userId), { method: "POST" }).catch((error: unknown) =>
    console.warn("Couldn't record the profile view:", error)
  );
}

/** "Not approved" -> fixed my profile -> send it to the admins again. Gives back my updated profile. */
export async function resubmitForApproval(): Promise<Profile> {
  const response = await apiFetch(API_ROUTES.PROFILES.RESUBMIT, { method: "POST" });
  await throwIfFailed(response, "Couldn't send your profile. Please try again.");
  return (await response.json()) as Profile;
}
