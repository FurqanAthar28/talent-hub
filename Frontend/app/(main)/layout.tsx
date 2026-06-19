"use client";

import Link from "next/link";
import { apiFetch } from "../api/client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type AuthUser = {
  id: number;
  email: string;
  username: string;
  fullName: string;
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
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function checkUser() {
      try {
        const res = await apiFetch("/accounts/me");

        if (!res.ok) {
          router.push("/signin");
          return;
        }

        const data = await res.json();
        setUser(data);
      } catch {
        router.push("/signin");
      } finally {
        setLoading(false);
      }
    }

    checkUser();
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await apiFetch("/accounts/logout", { method: "POST" });
    } finally {
      router.push("/signin");
    }
  }

  if (loading) return null;
  if (!user) return null;

  return (
    <>
      <header className="app-header">
        <div className="container">
          <div className="app-header-inner">
            <Link href="/dashboard" className="brand">
              ProfessionalHub
            </Link>

            <nav className="nav">
              <Link
                href="/dashboard"
                className={pathname === "/dashboard" ? "active" : ""}
              >
                Home
              </Link>

              <Link
                href="/profile"
                className={pathname === "/profile" ? "active" : ""}
              >
                Profile
              </Link>

              <Link
                href="/connections"
                className={pathname === "/connections" ? "active" : ""}
              >
                My Network
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="btn-outline"
                disabled={loggingOut}
              >
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </nav>
          </div>
        </div>
      </header>

      {children}
    </>
  );
}
