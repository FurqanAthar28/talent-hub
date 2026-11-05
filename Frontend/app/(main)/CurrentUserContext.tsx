"use client";

/**
 * The signed-in user, shared with every page inside (main).
 *
 * The layout asks Django "who am I?" ONCE and puts the answer here.
 * Any page can then read it with:
 *   const me = useCurrentUser();
 *
 * Before, the layout AND the messages, connections and profile pages each
 * asked Django the same question again.
 */

import { createContext, useContext } from "react";

export type CurrentUser = {
  id: number;
  email: string;
  fullName: string;
  role: "candidate" | "recruiter" | "admin";
};

/**
 * Is this user an APP admin? Only the role decides (same rule as Django's
 * IsAppAdmin). Django staff/superusers are a separate thing for developers.
 */
export function isAdmin(user: CurrentUser): boolean {
  return user.role === "admin";
}

export const CurrentUserContext = createContext<CurrentUser | null>(null);

export function useCurrentUser(): CurrentUser {
  const user = useContext(CurrentUserContext);

  // The layout only shows pages AFTER the user has loaded, so this can only
  // happen if a page is used outside the (main) layout by mistake.
  if (!user) {
    throw new Error("useCurrentUser() must be used inside the (main) layout.");
  }

  return user;
}
