"use client";

/**
 * The frame around every signed-in page: the top menu + the page itself.
 *
 * It does 3 jobs:
 *   1. Asks Django "who is signed in?" once, and shares the answer with
 *      every page (see CurrentUserContext.tsx).
 *   2. Sends you to the sign-in page if your login has run out
 *      (apiFetch announces this with `unauthorizedEventName`).
 *   3. Shows the menu, with the right links for your role.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { apiFetch, unauthorizedEventName } from "../api/client";
import { API_ROUTES } from "../config/apiRoutes";
import { MESSAGES } from "../config/messages";
import { ROUTES } from "../config/routes";
import BrandLogo from "../components/brand/BrandLogo";
import { useUiContent } from "../hooks/useUiContent";
import { CurrentUserContext, isAdmin, type CurrentUser } from "./CurrentUserContext";

/** "Ali Khan" -> "AK" */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function MainLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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

  const admin = isAdmin(user);

  // "Profile" stays highlighted on /profile/edit too.
  // (Someone else's profile, /profile/5, is not "my" profile.)
  function isActive(href: string) {
    if (href === ROUTES.PROFILE) {
      return pathname === ROUTES.PROFILE || pathname.startsWith(ROUTES.PROFILE_EDIT);
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  // The menu, in order. `show` decides who sees each link.
  const menu = [
    { href: ROUTES.DASHBOARD, label: text("home", "Home"), show: !admin },
    { href: ROUTES.CONNECTIONS, label: text("myNetwork", "My network"), show: !admin },
    { href: ROUTES.RECRUITER_CANDIDATES, label: "Candidates", show: user.role === "recruiter" },
    { href: ROUTES.MESSAGES, label: text("messages", "Messages"), show: !admin },
    { href: ROUTES.PROFILE, label: "Profile", show: !admin },
    { href: ROUTES.ADMIN, label: text("admin", "Admin"), show: admin },
  ];

  return (
    <CurrentUserContext.Provider value={user}>
      <header className="app-header">
        <div className="container">
          <div className="app-header-inner">
            <BrandLogo href={admin ? ROUTES.ADMIN : ROUTES.DASHBOARD} />

            <nav className="nav" aria-label="Main menu">
              {menu
                .filter((item) => item.show)
                .map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={isActive(item.href) ? "active" : ""}
                    aria-current={isActive(item.href) ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                ))}
            </nav>

            {/* Kept apart from the menu, so on phones the menu can scroll
                sideways while these stay put (see .nav-account in globals.css). */}
            <div className="nav-account">
              {/* role="img" + aria-label: screen readers say the full name, not "AK". */}
              <div
                className="nav-user-chip"
                role="img"
                aria-label={user.fullName || user.email}
                title={user.fullName || user.email}
              >
                <span>{getInitials(user.fullName || user.email || "U")}</span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="nav-logout"
                disabled={loggingOut}
              >
                {loggingOut ? text("loggingOut", "Logging out...") : text("logout", "Logout")}
              </button>
            </div>
          </div>
        </div>
      </header>

      {children}
    </CurrentUserContext.Provider>
  );
}
