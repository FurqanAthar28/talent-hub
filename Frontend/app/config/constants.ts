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
