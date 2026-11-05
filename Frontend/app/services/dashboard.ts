/**
 * Everything the dashboard shows comes from these functions.
 */

import { apiFetch, getApiMessage, readJson } from "../api/client";
import { API_ROUTES } from "../config/apiRoutes";
import type { Profile } from "./profiles";

/** What the recruiter dashboard shows. Django counts these for us. */
export type RecruiterSummary = {
  candidatesCount: number;
  connectionsCount: number;
  pendingRequestsCount: number;
};

/** One line of "recent activity", e.g. "Added skill: Django". */
export type Activity = {
  id: number;
  title: string;
  created_at: string;
};

/** Stop with Django's message (or the fallback) when the request failed. */
async function throwIfFailed(response: Response, fallback: string) {
  if (response.ok) return;

  const data = await readJson(response);
  throw new Error(getApiMessage(data) || fallback);
}

/** My profile, with the counts and the checklist the dashboard needs. */
export async function getDashboardData(): Promise<Profile> {
  const response = await apiFetch(API_ROUTES.PROFILES.ME);
  await throwIfFailed(response, "Unable to load your dashboard.");

  return (await response.json()) as Profile;
}

/** My 10 newest activity lines. An empty list if they can't be loaded. */
export async function getRecentActivity(): Promise<Activity[]> {
  try {
    const response = await apiFetch(API_ROUTES.PROFILES.ACTIVITIES);
    if (!response.ok) return [];

    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as Activity[]) : [];
  } catch {
    return []; // the dashboard still works without it
  }
}

/**
 * One small request for 3 numbers.
 * (Before, we downloaded every user, connection and request just to count them.)
 */
export async function getRecruiterSummary(): Promise<RecruiterSummary> {
  const response = await apiFetch(API_ROUTES.RECRUITER.SUMMARY);
  await throwIfFailed(response, "Unable to load your recruiter numbers.");

  return (await response.json()) as RecruiterSummary;
}
