"use client";

import { useEffect, useState } from "react";
import {
  getAdminDashboardData,
  type AdminDashboardData,
} from "../../../services/dashboard";

export default function AdminDashboardSection() {
  const [data, setData] = useState<AdminDashboardData | null>(null);

  useEffect(() => {
    async function loadAdminData() {
      try {
        const adminData = await getAdminDashboardData();
        setData(adminData);
      } catch {
        setData(null);
      }
    }

    loadAdminData();
  }, []);

  return (
    <section className="dashboard-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Platform overview</h2>
        </div>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card">
          <span className="card-label">Users</span>
          <h3>{data?.totalUsers ?? 0} total users</h3>
          <p>{data?.activeUsers ?? 0} users are currently active.</p>
        </article>

        <article className="dashboard-card">
          <span className="card-label">Platform</span>
          <h3>{data?.totalConnections ?? 0} connections</h3>
          <p>{data?.recruiters ?? 0} recruiter accounts on the platform.</p>
        </article>
      </div>
    </section>
  );
}