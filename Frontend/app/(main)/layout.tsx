"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "../api/client";
import { fetchUiContent, type UiContent } from "../api/ui-content";
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

  const routeSignin = uiContent.routeSignin || ROUTES.SIGNIN;
  const routeDashboard = uiContent.routeDashboard || ROUTES.DASHBOARD;
  const routeAdmin = uiContent.routeAdmin || ROUTES.ADMIN;
  const routeConnections = uiContent.routeConnections || ROUTES.CONNECTIONS;
  const routeMessages = uiContent.routeMessages || ROUTES.MESSAGES;

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
        router.push(ROUTES.SIGNIN);
      } finally {
        setLoading(false);
      }
    }

    checkUser();
  }, [router]);

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
  if (!user) return null;

  const userRole = user.role || (user.isStaff ? "admin" : "user");
  const isAdmin = userRole === "admin";
  const isRecruiter = userRole === "recruiter";

  return (
    <>
      <header className="app-header">
        <div className="container">
          <div className="app-header-inner">
            <Link
              href={isAdmin ? routeAdmin : routeDashboard}
              className="brand"
            >
              {uiContent.appName || "ProfessionalHub"}
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

              {isRecruiter && (
                <Link
                  href={routeConnections}
                  className={pathname === routeConnections ? "active" : ""}
                >
                  {uiContent.myNetwork || "My Network"}
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

              {isAdmin && (
                <Link
                  href={routeAdmin}
                  className={pathname === routeAdmin ? "active" : ""}
                >
                  {uiContent.admin || "Admin"}
                </Link>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="btn-outline"
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