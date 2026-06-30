"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "../api/client";
import { fetchUiContent, type UiContent } from "../api/ui-content";

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

  useEffect(() => {
    async function checkUser() {
      let signinRoute = "";

      try {
        const uiContentData = await fetchUiContent();
        signinRoute = uiContentData.routeSignin;
        setUiContent(uiContentData);

        const res = await apiFetch(uiContentData.apiAccountsMe);

        if (!res.ok) {
          router.push(uiContentData.routeSignin);
          return;
        }

        const data = await res.json();
        setUser(data);
      } catch (error) {
        console.error("Failed to load authenticated user:", error);

        if (signinRoute) {
          router.push(signinRoute);
        }
      } finally {
        setLoading(false);
      }
    }

    checkUser();
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await apiFetch(uiContent.apiAccountsLogout, { method: "POST" });
    } catch (error) {
      console.error("Failed to log out:", error);
    } finally {
      router.push(uiContent.routeSignin);
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
            <Link href={uiContent.routeDashboard} className="brand">
              {uiContent.appName}
            </Link>

            <nav className="nav">
              <Link
                href={uiContent.routeDashboard}
                className={pathname === uiContent.routeDashboard ? "active" : ""}
              >
                {uiContent.home}
              </Link>

              {!isAdmin && (
                <Link
                  href={uiContent.routeProfile}
                  className={pathname === uiContent.routeProfile ? "active" : ""}
                >
                  {uiContent.profile}
                </Link>
              )}

              {(isRecruiter ) && (
                <Link
                  href={uiContent.routeConnections}
                  className={
                    pathname === uiContent.routeConnections ? "active" : ""
                  }
                >
                  {uiContent.myNetwork}
                </Link>
              )}

              {!isAdmin && (
                <Link
                  href={uiContent.routeMessages}
                  className={
                    pathname === uiContent.routeMessages ? "active" : ""
                  }
                >
                  {uiContent.messages}
                </Link>
              )}

              {isAdmin && (
                <Link
                  href={uiContent.routeAdmin}
                  className={pathname === uiContent.routeAdmin ? "active" : ""}
                >
                  {uiContent.admin}
                </Link>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="btn-outline"
                disabled={loggingOut}
              >
                {loggingOut ? uiContent.loggingOut : uiContent.logout}
              </button>
            </nav>
          </div>
        </div>
      </header>

      {children}
    </>
  );
}