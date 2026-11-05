import { apiFetch, getApiMessage, readJson } from "@/app/api/client";
import { API_ROUTES } from "@/app/config/apiRoutes";

/** One candidate card, as Django's recruiter API sends it. */
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

/**
 * Stop with Django's own message (for example "Only approved recruiters
 * can search candidates.") so the page can show the real reason.
 */
async function throwIfFailed(response: Response, fallback: string) {
  if (response.ok) return;

  const data = await readJson(response);
  throw new Error(getApiMessage(data) || fallback);
}

/**
 * Search candidates. Empty filters are left out of the address.
 * `signal` lets the page cancel this search when a newer one starts.
 */
export async function getRecruiterCandidates(
  filters: RecruiterCandidateFilters = {},
  signal?: AbortSignal
): Promise<{ results: RecruiterCandidate[]; count: number; next: string | null; previous: string | null }> {
  const params = new URLSearchParams();

  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.skill?.trim()) params.set("skill", filters.skill.trim());
  if (filters.location?.trim()) params.set("location", filters.location.trim());
  if (typeof filters.openToWork === "boolean") {
    params.set("open_to_work", String(filters.openToWork));
  }

  const query = params.toString();
  const response = await apiFetch(
    `${API_ROUTES.RECRUITER.CANDIDATES}${query ? `?${query}` : ""}`,
    { signal }
  );
  await throwIfFailed(response, "Failed to load candidates.");

  const data = await response.json() as {
    results?: RecruiterCandidate[];
    count?: number;
    next?: string | null;
    previous?: string | null;
  };
  return {
    results: Array.isArray(data.results) ? data.results : [],
    count: typeof data.count === "number" ? data.count : 0,
    next: data.next ?? null,
    previous: data.previous ?? null,
  };
}

export async function getRecruiterCandidate(
  candidateId: string
): Promise<RecruiterCandidate> {
  const response = await apiFetch(API_ROUTES.RECRUITER.CANDIDATE(candidateId));
  await throwIfFailed(response, "Failed to load this candidate.");

  return (await response.json()) as RecruiterCandidate;
}
