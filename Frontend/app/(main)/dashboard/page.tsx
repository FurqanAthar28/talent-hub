"use client";

import { useEffect, useState } from "react";
import {
 getDashboardData,
 type DashboardData,
} from "../../services/dashboard";
import DashboardOverview from "./components/DashboardOverview";
import DashboardHeader from "./components/DashboardHeader";
import DashboardProfileCard from "./components/DashboardProfileCard";
import DashboardStats from "./components/DashboardStats";
import DashboardSidebar from "./components/DashboardSidebar";
import DashboardRightSidebar from "./components/DashboardRightSidebar";
import RecruiterDashboardSection from "./components/RecruiterDashboardSection";
import AdminDashboardSection from "./components/AdminDashboardSection";

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const data = await getDashboardData();
        setDashboardData(data);
      } catch {
        setError("Unable to load dashboard data.");
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (isLoading) {
    return (
      <main className="page-shell">
        <p>Loading dashboard...</p>
      </main>
    );
  }

  if (error || !dashboardData) {
    return (
      <main className="page-shell">
        <p>{error || "Dashboard data was not found."}</p>
      </main>
    );
  }

  const isRecruiter = dashboardData.user.role === "recruiter";
  const isAdmin = dashboardData.user.role === "admin";

  return (
    <main className="page-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Welcome back, {dashboardData.user.fullName}</h1>
          <p>{dashboardData.user.headline}</p>
        </div>
      </section>

      <DashboardOverview data={dashboardData} />

      {(isRecruiter || isAdmin) && <RecruiterDashboardSection />}

      {isAdmin && <AdminDashboardSection />}
    </main>
  );
}