"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  getDashboardData,
  type DashboardData,
} from "@/app/services/dashboard";

import CandidateDashboard from "./components/candidate/CandidateDashboard";
import DashboardError from "./components/common/DashboardError";
import DashboardLoading from "./components/common/DashboardLoading";
import RecruiterDashboardSection from "./components/recruiter/RecruiterDashboardSection";

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
      <DashboardError
        message={error || "Dashboard data was not found."}
      />
    );
  }

  const isRecruiter = dashboardData.role === "recruiter";
  const firstName = dashboardData.fullName.split(" ")[0] || dashboardData.fullName;

  return (
    <main className="page-shell">
      <header className="dashboard-hero">
        <div>
          <p className="eyebrow">{isRecruiter ? "Recruiter workspace" : "Professional dashboard"}</p>
          <h1>Welcome back, {firstName}</h1>
          <p>
            {isRecruiter
              ? "Find candidates, manage conversations, and keep your hiring network active."
              : "Strengthen your profile, grow your network, and stay ready for new opportunities."}
          </p>
        </div>

        <div className="dashboard-hero-actions">
          <Link href="/profile" className="btn-outline">
            View Profile
          </Link>

          <Link href="/profile/edit#information" className="btn-primary">
            Improve Profile
          </Link>
        </div>
      </header>

      <section className="dashboard-content">
        {isRecruiter ? (
          <RecruiterDashboardSection />
        ) : (
          <CandidateDashboard data={dashboardData} />
        )}
      </section>
    </main>
  );
}
