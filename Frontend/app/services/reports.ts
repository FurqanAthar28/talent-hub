/**
 * Reporting a profile, a message or a job to the admins ("/api/reports/").
 * Django checks everything again (not yourself, only messages from your own
 * chats, only jobs you can see, one open report per thing).
 */

import { apiFetch, getApiMessage, readJson } from "../api/client";
import { API_ROUTES } from "../config/apiRoutes";

// Must match Report.REASON_CHOICES in Backend/reports/models.py
export const REPORT_REASONS = [
  { value: "fake_profile", label: "Fake profile or impersonation" },
  { value: "spam", label: "Spam" },
  { value: "scam", label: "Scam or fake job offer" },
  { value: "harassment", label: "Harassment or hate" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReasonValue = (typeof REPORT_REASONS)[number]["value"];

// Must match Report.DETAILS_MAX_LENGTH in Django.
export const REPORT_DETAILS_MAX_LENGTH = 500;

// Must match CreateReportSerializer in Backend/reports/serializers.py.
// For a job, Django works out the reported person itself (the job's recruiter)
// and only checks that reportedUserId matches it.
export type ReportTarget =
  | { kind: "profile"; reportedUserId: number }
  | { kind: "message"; reportedUserId: number; messageId: number }
  | { kind: "job"; reportedUserId: number; jobId: number };

/** Send a report. Gives back Django's thank-you sentence, or throws its error message. */
export async function sendReport(target: ReportTarget, reason: ReportReasonValue, details: string): Promise<string> {
  const response = await apiFetch(API_ROUTES.REPORTS.CREATE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...target, reason, details }),
  });
  const data = await readJson(response);
  const message = getApiMessage(data);

  if (!response.ok) throw new Error(message || "Couldn't send the report. Please try again.");
  return message || "Thanks. An admin will look at your report.";
}
