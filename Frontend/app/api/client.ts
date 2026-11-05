/**
 * apiFetch: the ONE function the whole app uses to call the backend.
 *
 * It does three jobs for you, so pages don't have to:
 *   1. Adds the CSRF token to requests that change data (POST, PUT, PATCH, DELETE).
 *   2. If the login has expired (401), quietly gets a new one and tries again.
 *   3. If that also fails, tells the app "the user is logged out"
 *      (the main layout listens for this and goes to the sign-in page).
 *
 * The login tokens themselves live in httpOnly cookies. JavaScript can't
 * read them, and doesn't need to: the browser sends them by itself.
 */

import { API_ROUTES } from "../config/apiRoutes";

type ApiFetchOptions = {
  redirectOnUnauthorized?: boolean;
};

export const unauthorizedEventName = "talenthub:unauthorized";

const PROXY_PREFIX = "/api/backend";
const CSRF_COOKIE_NAME = "csrftoken";

// Requests that change data need a CSRF token. Reading data (GET) does not.
const METHODS_THAT_NEED_CSRF = ["POST", "PUT", "PATCH", "DELETE"];

// For these, a 401 just means "wrong password" or "really logged out",
// so we must NOT try to refresh the login.
const PATHS_THAT_SKIP_REFRESH = [
  API_ROUTES.ACCOUNTS.SIGNIN,
  API_ROUTES.ACCOUNTS.REFRESH,
  API_ROUTES.ACCOUNTS.LOGOUT,
];

/**
 * Turn a backend path into an address the browser can open, for example
 * "/profiles/42/cv/" -> "/api/backend/profiles/42/cv".
 * apiFetch uses it, and so do links (like "View CV").
 *
 * Why drop the last "/"? Next.js redirects "/api/backend/x/" to
 * "/api/backend/x" (one extra trip for EVERY call). Our proxy route adds the
 * "/" back before calling Django, so Django still gets "/api/x/".
 */
export function backendUrl(path: string): string {
  const [pathPart, query] = path.split("?", 2);
  const withSlash = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  const withoutEndSlash = withSlash.replace(/\/+$/, "");
  const queryPart = query ? `?${query}` : "";

  return `${PROXY_PREFIX}${withoutEndSlash}${queryPart}`;
}

/** Read one cookie by name. Returns "" if it isn't there. */
function readCookie(name: string): string {
  const match = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.split("=")[1]) : "";
}

/** Get the CSRF token. If we don't have the cookie yet, ask Django for one. */
async function getCsrfToken(): Promise<string> {
  let token = readCookie(CSRF_COOKIE_NAME);

  if (!token) {
    await fetch(backendUrl(API_ROUTES.ACCOUNTS.CSRF), {
      credentials: "include",
    });
    token = readCookie(CSRF_COOKIE_NAME);
  }

  return token;
}

// If 5 requests fail at the same moment, we only want ONE refresh call,
// not 5. So we remember the refresh that is already running and share it.
let refreshInProgress: Promise<boolean> | null = null;

/** Ask Django for a new access token. Returns true if it worked. */
function refreshLogin(): Promise<boolean> {
  if (!refreshInProgress) {
    refreshInProgress = fetch(backendUrl(API_ROUTES.ACCOUNTS.REFRESH), {
      method: "POST",
      credentials: "include",
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshInProgress = null;
      });
  }

  return refreshInProgress;
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  apiOptions: ApiFetchOptions = {}
) {
  const { redirectOnUnauthorized = true } = apiOptions;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const method = (options.method ?? "GET").toUpperCase();

  // Build and send the request. We may need to send it twice (after a
  // refresh), so this is a small function we can call again.
  async function send() {
    const headers = new Headers(options.headers);

    if (METHODS_THAT_NEED_CSRF.includes(method)) {
      headers.set("X-CSRFToken", await getCsrfToken());
    }

    return fetch(backendUrl(normalizedPath), {
      ...options,
      headers,
      credentials: "include",
    });
  }

  let response = await send();

  // 401 = "not logged in". Maybe the 30-minute access token just ran out.
  // Try to refresh it once, then send the same request again.
  if (
    response.status === 401 &&
    !PATHS_THAT_SKIP_REFRESH.includes(normalizedPath)
  ) {
    const refreshed = await refreshLogin();

    if (refreshed) {
      response = await send();
    }
  }

  // Still 401? The user really is logged out.
  if (redirectOnUnauthorized && response.status === 401) {
    window.dispatchEvent(new Event(unauthorizedEventName));
  }

  return response;
}

// ---------------------------------------------------------------------------
// Small helpers for reading Django's answers
// ---------------------------------------------------------------------------

/** The JSON Django sends back, for example {"message": "Saved"}. */
export type ApiData = Record<string, unknown>;

/**
 * Read the JSON body of an answer.
 * Gives {} instead of crashing when there is no JSON, for example an
 * HTML error page when Django is down, or an empty "204 No Content".
 */
export async function readJson(response: Response): Promise<ApiData> {
  try {
    const value: unknown = await response.json();
    return value && typeof value === "object" ? (value as ApiData) : {};
  } catch {
    return {};
  }
}

/**
 * The text to show the user from Django's answer.
 * Our Django always puts it in "message" (see config/exception_handler.py).
 * Returns "" if there is none, so you can write: getApiMessage(data) || "Fallback".
 */
export function getApiMessage(data: ApiData): string {
  if (typeof data.message === "string") return data.message;
  if (typeof data.detail === "string") return data.detail;
  return "";
}

/**
 * POST some JSON to Django and read the answer, in one step.
 * Used by the sign-in, verify-email and forgot-password pages.
 *
 * A 401 here means "wrong password" or "wrong code", not "logged out",
 * so we don't send the user to the sign-in page.
 */
export async function postJson(path: string, body: unknown) {
  const response = await apiFetch(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    { redirectOnUnauthorized: false }
  );

  const data = await readJson(response);
  return { ok: response.ok, data, message: getApiMessage(data) };
}

/**
 * The text inside a caught error, or `fallback`.
 * Use it in "catch (error)" blocks: setError(errorText(error, "Couldn't save.")).
 */
export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
