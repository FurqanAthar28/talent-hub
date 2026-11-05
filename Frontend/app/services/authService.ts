import { apiFetch } from "../api/client";
import { API_ROUTES } from "../config/apiRoutes";

/**
 * Create a new account.
 *
 * `data` is FormData (not JSON) because sign-up can include a CV file.
 * We don't set "Content-Type" ourselves: the browser adds the correct
 * one for FormData automatically.
 */
export function signupUser(data: FormData): Promise<Response> {
  return apiFetch(
    API_ROUTES.ACCOUNTS.SIGNUP,
    {
      method: "POST",
      body: data,
    },
    // A failed sign-up is not a "logged out" problem, so don't redirect.
    { redirectOnUnauthorized: false }
  );
}
