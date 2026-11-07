/**
 * Job posts ("/api/jobs/"): browse, read one, and (recruiters) post, edit,
 * close, reopen and delete their own. Django checks every rule again.
 * Each function throws an Error with Django's own message when it fails.
 */

import { apiFetch, getApiMessage, readJson } from "../api/client";
import { API_ROUTES } from "../config/apiRoutes";

// Must match JobSerializer in Backend/jobs/serializers.py
export type Job = {
  id: number;
  title: string;
  employmentType: string; // JOB_TYPES value
  workStyle: string; // WORK_STYLES value
  experienceLevel: string; // HIRING_LEVELS value
  location: string;
  salary: string;
  description: string;
  skills: string[];
  status: "open" | "closed";
  hiddenByAdmin: boolean; // only true for the owner and admins
  hiddenReason: string; // only sent to the owner and admins
  createdAt: string;
  updatedAt: string;
  recruiter: {
    id: number; // USER id: links to /profile/<id>
    name: string;
    title: string;
    companyName: string;
    companyIndustry: string;
    companyWebsite: string;
  };
  isMine: boolean;
};

/** What the "Post a job" form sends. */
export type JobInput = {
  title: string;
  employmentType: string;
  workStyle: string;
  experienceLevel: string;
  location: string;
  salary: string;
  description: string;
  skills: string[];
};

export type JobFilters = {
  q?: string;
  type?: string;
  workStyle?: string;
  level?: string;
  recruiter?: number;
};

async function request<T>(path: string, init?: RequestInit, fallback = "Something went wrong with jobs."): Promise<T> {
  const response = await apiFetch(path, init);
  if (response.status === 204) return undefined as T;
  const data = await readJson(response);
  if (!response.ok) throw new Error(getApiMessage(data) || fallback);
  return data as T;
}

function json(method: "POST" | "PATCH", body: object): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

/** Open jobs, newest first. Empty filters are left out of the address. */
export async function getJobs(filters: JobFilters = {}, signal?: AbortSignal): Promise<Job[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && String(value).trim() !== "") params.set(key, String(value).trim());
  }
  const query = params.toString();
  const data = await request<unknown>(`${API_ROUTES.JOBS.LIST}${query ? `?${query}` : ""}`, { signal }, "Couldn't load jobs.");
  return Array.isArray(data) ? (data as Job[]) : [];
}

export const getJob = (jobId: number | string) =>
  request<Job>(API_ROUTES.JOBS.DETAIL(jobId), undefined, "This job isn't available.");

export async function getMyJobs(): Promise<Job[]> {
  const data = await request<unknown>(API_ROUTES.JOBS.MINE, undefined, "Couldn't load your jobs.");
  return Array.isArray(data) ? (data as Job[]) : [];
}

export const createJob = (input: JobInput) =>
  request<Job>(API_ROUTES.JOBS.LIST, json("POST", input), "Couldn't post the job.");

export const updateJob = (jobId: number, changes: Partial<JobInput> & { status?: Job["status"] }) =>
  request<Job>(API_ROUTES.JOBS.DETAIL(jobId), json("PATCH", changes), "Couldn't save the job.");

export const deleteJob = (jobId: number) =>
  request<void>(API_ROUTES.JOBS.DETAIL(jobId), { method: "DELETE" }, "Couldn't delete the job.");

/** "3 days ago", "today". */
export function postedAgo(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}
