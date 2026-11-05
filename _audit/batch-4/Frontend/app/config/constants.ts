export const MAX_CV_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const CV_MIME_TYPE = "application/pdf";
// Must match the backend password rules (Django MinimumLengthValidator = 8).
export const MIN_PASSWORD_LENGTH = 8;

export const LIVE_REFRESH_INTERVAL_MS = 3000;

export const USER_ROLES = {
  CANDIDATE: "candidate",
  RECRUITER: "recruiter",
} as const;