"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getDashboardData, type DashboardData } from "../../services/dashboard";

import DashboardError from "./components/DashboardError";
import DashboardLoading from "./components/DashboardLoading";
import DashboardOverview from "./components/DashboardOverview";
import DashboardQuickActions from "./components/DashboardQuickActions";
import RecruiterDashboardSection from "./components/RecruiterDashboardSection";

export default function DashboardPage() {
  const router = useRouter();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const data = await getDashboardData();

        if (data.role === "admin") {
          router.replace("/admin");
          return;
        }

        setDashboardData(data);
      } catch {
        setError(
          "Unable to load dashboard data. Please refresh and try again.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, [router]);

  if (isLoading) {
    return <DashboardLoading />;
  }

  if (error || !dashboardData) {
    return (
      <DashboardError message={error || "Dashboard data was not found."} />
    );
  }

  const isRecruiter = dashboardData.role === "recruiter";

  return (
    <main className="page-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">ProfessionalHub Dashboard</p>
          <h1>Welcome back, {dashboardData.fullName}</h1>
          <p>
            Manage your profile, improve your visibility, and keep your
            professional network active.
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/profile" className="btn-outline">
            View Profile
          </Link>
          <Link href="/profile/edit#information" className="btn-primary">
            Improve Profile
          </Link>
        </div>
      </header>

      <section className="dashboard-content">
        <DashboardOverview data={dashboardData} />

        <DashboardQuickActions />

        {isRecruiter && <RecruiterDashboardSection />}
      </section>
    </main>
  );
}

