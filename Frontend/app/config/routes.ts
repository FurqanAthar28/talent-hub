/**
 * Every PAGE address of the website in ONE place.
 * (Backend addresses live in apiRoutes.ts.)
 */
type Id = number | string;

export const ROUTES = {
  HOME: "/",

  // --- Signed-out pages ---
  SIGNIN: "/signin",
  SIGNUP: "/signup",
  VERIFY_EMAIL: "/verify-email",
  FORGOT_PASSWORD: "/forgot-password",

  // --- Signed-in pages ---
  DASHBOARD: "/dashboard",
  PROFILE: "/profile",
  PROFILE_EDIT: "/profile/edit",
  USER_PROFILE: (userId: Id) => `/profile/${userId}`,
  CONNECTIONS: "/connections",
  MESSAGES: "/messages",
  JOBS: "/jobs",
  JOB: (jobId: Id) => `/jobs/${jobId}`,
  MY_JOBS: "/jobs/manage", // a recruiter's own jobs
  RECRUITER_CANDIDATES: "/recruiter/candidates",
  RECRUITER_CANDIDATE: (userId: Id) => `/recruiter/candidates/${userId}`,
  ADMIN: "/admin",
};

/**
 * Page addresses that need you to be signed in.
 * proxy.ts sends signed-out visitors from these to the sign-in page.
 */
export const PRIVATE_PATH_PREFIXES = [
  ROUTES.DASHBOARD,
  ROUTES.PROFILE,
  ROUTES.CONNECTIONS,
  ROUTES.MESSAGES,
  ROUTES.JOBS,
  ROUTES.RECRUITER_CANDIDATES,
  ROUTES.ADMIN,
];

/**
 * Where to go after signing in, from "?next=/messages".
 *
 * We only accept addresses on OUR site (starting with one "/").
 * Otherwise a bad link like "/signin?next=https://evil.com" could send
 * people to another website right after they type their password.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) {
    return ROUTES.DASHBOARD;
  }

  // Browsers treat "//evil.com" and "/\evil.com" as OTHER websites too.
  const isOurPage =
    next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\");

  return isOurPage ? next : ROUTES.DASHBOARD;
}
