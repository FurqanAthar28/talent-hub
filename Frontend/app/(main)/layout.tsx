"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch, unauthorizedEventName } from "../api/client";
import {
  fetchUiContent,
  getUiContentErrorMessage,
  type UiContent,
} from "../api/ui-content";
import { API_ROUTES } from "../config/apiRoutes";
import { ROUTES } from "../config/routes";

type AuthUser = {
  id: number;
  email: string;
  username: string;
  fullName: string;
  isStaff: boolean;
  role?: string;
};

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [uiContent, setUiContent] = useState<UiContent>({});
  const [loggingOut, setLoggingOut] = useState(false);
  const [loadError, setLoadError] = useState("");

  const routeSignin = uiContent.routeSignin || ROUTES.SIGNIN;
  const routeDashboard = uiContent.routeDashboard || ROUTES.DASHBOARD;
  const routeAdmin = uiContent.routeAdmin || ROUTES.ADMIN;
  const routeConnections = uiContent.routeConnections || ROUTES.CONNECTIONS;
  const routeMessages = uiContent.routeMessages || ROUTES.MESSAGES;
  const routeProfile = uiContent.routeProfile || ROUTES.PROFILE;

  useEffect(() => {
    async function checkUser() {
      try {
        const uiContentData = await fetchUiContent();
        setUiContent(uiContentData);

        const res = await apiFetch(API_ROUTES.ACCOUNTS.ME);

        if (!res.ok) {
          router.push(uiContentData.routeSignin || ROUTES.SIGNIN);
          return;
        }

        const data = await res.json();
        setUser(data);
      } catch (error) {
        console.error("Failed to load authenticated user:", error);
        setLoadError(getUiContentErrorMessage(error));
      } finally {
        setLoading(false);
      }
    }

    checkUser();
  }, [router]);

  useEffect(() => {
    function redirectToSignin() {
      router.replace(routeSignin);
    }

    window.addEventListener(unauthorizedEventName, redirectToSignin);

    return () => {
      window.removeEventListener(unauthorizedEventName, redirectToSignin);
    };
  }, [router, routeSignin]);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await apiFetch(API_ROUTES.ACCOUNTS.LOGOUT, { method: "POST" });
    } catch (error) {
      console.error("Failed to log out:", error);
    } finally {
      router.push(routeSignin);
    }
  }

  if (loading) return null;
  if (loadError) {
    return (
      <div className="app-main">
        <div className="container">
          <div className="card">
            <div className="card-body text-center">
              <p className="form-error">{loadError}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!user) return null;

  const userRole = user.role || (user.isStaff ? "admin" : "user");
  const isAdmin = userRole === "admin";
  const isRecruiter = userRole === "recruiter";
  const initials = (user.fullName || user.email || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <header className="app-header">
        <div className="container">
          <div className="app-header-inner">
            <Link
              href={isAdmin ? routeAdmin : routeDashboard}
              className="brand"
            >
              <span className="brand-mark">in</span>
              <span>{uiContent.appName || "ProfessionalHub"}</span>
            </Link>

            <nav className="nav">
              {!isAdmin && (
                <Link
                  href={routeDashboard}
                  className={pathname === routeDashboard ? "active" : ""}
                >
                  {uiContent.home || "Home"}
                </Link>
              )}

              {!isAdmin && (
                <Link
                  href={routeConnections}
                  className={pathname === routeConnections ? "active" : ""}
                >
                  {uiContent.myNetwork || "My Network"}
                </Link>
              )}

              {isRecruiter && (
                <Link
                  href="/recruiter/candidates"
                  className={pathname.startsWith("/recruiter/candidates") ? "active" : ""}
                >
                  Candidates
                </Link>
              )}

              {!isAdmin && (
                <Link
                  href={routeMessages}
                  className={pathname === routeMessages ? "active" : ""}
                >
                  {uiContent.messages || "Messages"}
                </Link>
              )}

              {!isAdmin && (
                <Link
                  href={routeProfile}
                  className={pathname === routeProfile ? "active" : ""}
                >
                  Profile
                </Link>
              )}

              {isAdmin && (
                <Link
                  href={routeAdmin}
                  className={pathname === routeAdmin ? "active" : ""}
                >
                  {uiContent.admin || "Admin"}
                </Link>
              )}

              <div className="nav-user-chip" aria-label={user.fullName || user.email}>
                <span>{initials}</span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="nav-logout"
                disabled={loggingOut}
              >
                {loggingOut
                  ? uiContent.loggingOut || "Logging out..."
                  : uiContent.logout || "Logout"}
              </button>
            </nav>
          </div>
        </div>
      </header>

      {children}
    </>
  );
}
