import { apiFetch } from "@/app/api/client";

export type RecruiterCandidate = {
  id: number;
  fullName: string;
  headline: string;
  location: string;
  bio: string;
  openToWork: boolean;
  skills: string[];
  projectsCount: number;
  experiencesCount: number;
};

export type RecruiterCandidateFilters = {
  search?: string;
  skill?: string;
  location?: string;
  openToWork?: boolean;
};

export async function getRecruiterCandidates(
  filters: RecruiterCandidateFilters = {}
): Promise<RecruiterCandidate[]> {
  const params = new URLSearchParams();

  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.skill?.trim()) params.set("skill", filters.skill.trim());
  if (filters.location?.trim()) params.set("location", filters.location.trim());

  if (typeof filters.openToWork === "boolean") {
    params.set("open_to_work", String(filters.openToWork));
  }

  const query = params.toString();
  const res = await apiFetch(`/recruiter/candidates/${query ? `?${query}` : ""}`);

  if (!res.ok) {
    throw new Error("Failed to load recruiter candidates");
  }

  return res.json();
}

export async function getRecruiterCandidate(
  candidateId: string
): Promise<RecruiterCandidate> {
  const res = await apiFetch(`/recruiter/candidates/${candidateId}/`);

  if (!res.ok) {
    throw new Error("Failed to load recruiter candidate");
  }

  return res.json();
}
