"use client";

import { useEffect, useState } from "react";
import {
  getRecruiterDashboardData,
  type RecruiterDashboardData,
} from "../../../services/dashboard";

export default function RecruiterDashboardSection() {
  const [data, setData] = useState<RecruiterDashboardData | null>(null);

  useEffect(() => {
    async function loadRecruiterData() {
      try {
        const recruiterData = await getRecruiterDashboardData();
        setData(recruiterData);
      } catch {
        setData(null);
      }
    }

    loadRecruiterData();
  }, []);

  return (
    <section className="dashboard-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Recruiter</p>
          <h2>Recruiter workspace</h2>
        </div>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card">
          <span className="card-label">Candidates</span>
          <h3>{data?.availableProfessionalsCount ?? 0} professionals</h3>
          <p>Find candidates by skills, location, and profile details.</p>
        </article>

        <article className="dashboard-card">
          <span className="card-label">Connections</span>
          <h3>{data?.myConnectionsCount ?? 0} connections</h3>
          <p>You have {data?.pendingRequestsCount ?? 0} pending requests.</p>
        </article>
      </div>
    </section>
  );
}