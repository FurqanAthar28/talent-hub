"use client";

/**
 * The frame around every signed-in page: the top menu + the page itself.
 *
 * It does 3 jobs:
 *   1. Asks Django "who is signed in?" once, and shares the answer with
 *      every page (see CurrentUserContext.tsx).
 *   2. Sends you to the sign-in page if your login has run out
 *      (apiFetch announces this with `unauthorizedEventName`).
 *   3. Shows the top bar (components/TopBar.tsx), with the right links for your role.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { apiFetch, unauthorizedEventName } from "../api/client";
import { API_ROUTES } from "../config/apiRoutes";
import { MESSAGES } from "../config/messages";
import { ROUTES } from "../config/routes";
import { useUiContent } from "../hooks/useUiContent";
import TopBar from "./components/TopBar";
import { CurrentUserContext, type CurrentUser } from "./CurrentUserContext";

export default function MainLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const text = useUiContent();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  // 1. Who is signed in?
  useEffect(() => {
    let pageIsOpen = true;

    async function loadUser() {
      try {
        const response = await apiFetch(API_ROUTES.ACCOUNTS.ME);

        if (!response.ok) {
          router.replace(ROUTES.SIGNIN);
          return;
        }

        const data = (await response.json()) as CurrentUser;
        if (pageIsOpen) setUser(data);
      } catch (error) {
        console.error("Failed to load the signed-in user:", error);
        if (pageIsOpen) setLoadError(MESSAGES.COMMON.SERVER_UNREACHABLE);
      }
    }

    void loadUser();

    return () => {
      pageIsOpen = false;
    };
  }, [router]);

  // 2. Login ran out somewhere in the app -> go to sign in.
  useEffect(() => {
    function goToSignin() {
      router.replace(ROUTES.SIGNIN);
    }

    window.addEventListener(unauthorizedEventName, goToSignin);
    return () => window.removeEventListener(unauthorizedEventName, goToSignin);
  }, [router]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await apiFetch(API_ROUTES.ACCOUNTS.LOGOUT, { method: "POST" });
    } catch (error) {
      console.error("Failed to log out:", error);
    } finally {
      // replace (not push): the Back button can't return to a private page.
      router.replace(ROUTES.SIGNIN);
    }
  }

  if (loadError) {
    return (
      <div className="app-main">
        <div className="container">
          <div className="card">
            <div className="card-body text-center">
              <p className="form-error" role="alert">
                {loadError}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-main">
        <div className="container">{text("loading", "Loading...")}</div>
      </div>
    );
  }

  return (
    <CurrentUserContext.Provider value={user}>
      <TopBar user={user} text={text} loggingOut={loggingOut} onLogout={handleLogout} />
      {children}
    </CurrentUserContext.Provider>
  );
}
