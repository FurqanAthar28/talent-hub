import { apiFetch } from "../api/client";
import type { UiContent } from "../api/ui-content";
import type { DashboardActivity, DashboardUser } from "../../types/dashboard";

type DashboardProfileResponse = Omit<
  DashboardUser,
  | "id"
  | "role"
  | "recruiterVerificationStatus"
  | "recruiterVerificationNote"
> & {
  id: number | string;
  role?: DashboardUser["role"];
  recruiterVerificationStatus?: DashboardUser["recruiterVerificationStatus"];
  recruiterVerificationNote?: string;
};

type DashboardProfileUpdateResponse = {
  openToWork?: boolean;
  profileCompletion?: number;
  missingFields?: string[];
};

function mapDashboardUser(profileData: DashboardProfileResponse): DashboardUser {
  return {
    id: String(profileData.id),
    role: profileData.role || "candidate",
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
    companyName: profileData.companyName || "",
    companyWebsite: profileData.companyWebsite || "",
    companyLocation: profileData.companyLocation || "",
    hiringTitle: profileData.hiringTitle || "",
    adminTitle: profileData.adminTitle || "",
    recruiterVerificationStatus:
      profileData.recruiterVerificationStatus || "approved",
    recruiterVerificationNote: profileData.recruiterVerificationNote || "",
    cvUrl: profileData.cvUrl || "",
    missingFields: profileData.missingFields || [],
    skillsCount: profileData.skillsCount || 0,
    projectsCount: profileData.projectsCount || 0,
    experiencesCount: profileData.experiencesCount || 0,
    connectionsCount: profileData.connectionsCount || 0,
  };
}

export async function fetchDashboardSummary(uiContent: UiContent) 
{
  const [profileResponse, activitiesResponse] = await Promise.all([
    apiFetch(uiContent.apiProfileMe),
    apiFetch(uiContent.apiProfileActivities),
  ]);

  if (!profileResponse.ok) {
    throw new Error(uiContent.dashboardUnableToLoad);
  }

  const profileData = (await profileResponse.json()) as DashboardProfileResponse;
  const activities = activitiesResponse.ok
    ? ((await activitiesResponse.json()) as DashboardActivity[])
    : [];

  return {
    user: mapDashboardUser(profileData),
    activities,
  };
}

export async function updateDashboardOpenToWork(
  uiContent: UiContent,
  openToWork: boolean
) {
  const response = await apiFetch(uiContent.apiProfileUpdate, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ openToWork }),
  });

  if (!response.ok) {
    throw new Error(uiContent.dashboardOpenToWorkUpdateFailed);
  }

  return (await response.json()) as DashboardProfileUpdateResponse;
}
