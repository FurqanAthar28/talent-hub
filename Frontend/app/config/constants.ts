export const MAX_CV_FILE_SIZE_MB = 5;
export const MAX_CV_FILE_SIZE_BYTES = MAX_CV_FILE_SIZE_MB * 1024 * 1024;
export const CV_MIME_TYPE = "application/pdf";
// Must match the backend password rules (Django MinimumLengthValidator = 8).
export const MIN_PASSWORD_LENGTH = 8;

export const LIVE_REFRESH_INTERVAL_MS = 3000;

export const USER_ROLES = {
  CANDIDATE: "candidate",
  RECRUITER: "recruiter",
} as const;

// The login cookie names. They MUST match JWT_ACCESS_COOKIE and
// JWT_REFRESH_COOKIE in Backend/config/settings.py.
// (These cookies are httpOnly: JavaScript in the browser can't read them,
// but proxy.ts runs on the server, where it can check they exist.)
export const AUTH_COOKIES = {
  ACCESS: "access_token",
  REFRESH: "refresh_token",
} as const;

// How long a "Done! Taking you to sign in..." message stays before we move on.
export const REDIRECT_DELAY_MS = 1500;

// Email codes are always 6 digits. Must match OtpField in Backend/accounts/serializers.py.
export const OTP_LENGTH = 6;

// Search boxes wait this long after the LAST key press before asking Django,
// so typing "Django" sends 1 request instead of 6.
export const SEARCH_DEBOUNCE_MS = 400;

// ---------- Approval (candidates and recruiters) ----------
// Must match Profile.APPROVAL_* and Profile.REJECTION_* in Backend/profiles/models.py

export type ApprovalStatus = "pending" | "approved" | "rejected";
/** Must match Profile.ACCOUNT_* in Backend/profiles/models.py. "Deleted" isn't one: see deletedAt. */
export type AccountStatus = "active" | "suspended" | "banned";
export type RejectionReason = "email_not_verifiable" | "company_not_verifiable";

/** What each "not approved" reason means, in words the person understands. */
export const REJECTION_REASON_TEXT: Record<RejectionReason, { title: string; fix: string }> = {
  email_not_verifiable: {
    title: "We couldn't verify your email",
    fix: "Make sure your email and profile details are real and match your LinkedIn, then send your profile again.",
  },
  company_not_verifiable: {
    title: "We couldn't verify your company",
    fix: "Add your company's real name and website (and your current job title), then send your profile again.",
  },
};

// ---------- Recruiter company + "Hiring for" ----------
// Must match Profile.COMPANY_SIZE_CHOICES, WORK_STYLE_CHOICES and
// HIRING_LEVEL_CHOICES in Backend/profiles/models.py

export const COMPANY_SIZES = [
  { value: "1-10", label: "1-10 people" },
  { value: "11-50", label: "11-50 people" },
  { value: "51-200", label: "51-200 people" },
  { value: "201-1000", label: "201-1,000 people" },
  { value: "1000+", label: "1,000+ people" },
] as const;

export const WORK_STYLES = [
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
] as const;

export const HIRING_LEVELS = [
  { value: "intern", label: "Internship" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead / Manager" },
] as const;

// Must match the limits in Backend/profiles/serializers.py
export const COMPANY_ABOUT_MAX_LENGTH = 1000;
export const MAX_HIRING_ROLES = 10;
export const MAX_HIRING_SKILLS = 20;
export const MAX_HIRING_LOCATIONS = 10;
export const LIST_ITEM_MAX_LENGTH = 60;

/** "hybrid" -> "Hybrid", using one of the lists above. Unknown values are shown as they are. */
export function choiceLabel(options: readonly { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

// ---------- Job posts ----------
// Must match Job.TYPE_CHOICES and the limits in Backend/jobs/models.py

export const JOB_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
] as const;

export const JOB_TITLE_MAX_LENGTH = 120;
export const JOB_DESCRIPTION_MAX_LENGTH = 5000;
export const JOB_SALARY_MAX_LENGTH = 100;
export const JOB_MAX_SKILLS = 15;
