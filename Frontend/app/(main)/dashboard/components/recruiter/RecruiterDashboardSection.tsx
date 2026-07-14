"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getRecruiterDashboardData,
  type RecruiterDashboardData,
} from "@/app/services/dashboard";

export default function RecruiterDashboardSection() {
  const [data, setData] = useState<RecruiterDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRecruiterData() {
      try {
        const recruiterData = await getRecruiterDashboardData();
        setData(recruiterData);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    loadRecruiterData();
  }, []);

  if (loading) {
    return <p>Loading recruiter dashboard...</p>;
  }

  return (
    <div className="dashboard-linkedin-layout dashboard-home-layout recruiter-dashboard-layout">
      <aside className="dashboard-profile-panel">
        <div className="dashboard-profile-cover" />
        <div className="dashboard-profile-body">
          <div className="dashboard-avatar">HR</div>
          <h2>Hiring workspace</h2>
          <p>Search candidates, grow your hiring network, and continue conversations.</p>
          <span className="status-badge status-success">Recruiter</span>
        </div>

        <div className="dashboard-panel-list">
          <div>
            <span>Available candidates</span>
            <strong>{data?.availableProfessionalsCount ?? 0}</strong>
          </div>
          <div>
            <span>Connections</span>
            <strong>{data?.myConnectionsCount ?? 0}</strong>
          </div>
        </div>
      </aside>

      <section className="dashboard-main-column">
        <article className="dashboard-work-card">
          <div className="dashboard-work-header">
            <div>
              <p className="eyebrow">Candidate pipeline</p>
              <h2>Find and contact qualified professionals</h2>
            </div>
            <strong>{data?.availableProfessionalsCount ?? 0}</strong>
          </div>

          <p className="muted">
            Review candidate profiles, connect with relevant professionals, and move promising conversations into messages.
          </p>

          <div className="dashboard-recruiter-actions">
            <Link href="/recruiter/candidates" className="btn-primary">
              Search candidates
            </Link>
            <Link href="/connections" className="btn-outline">
              Manage network
            </Link>
          </div>
        </article>

        <section className="dashboard-section dashboard-signal-section">
          <div className="section-header dashboard-section-header">
            <div>
              <p className="eyebrow">Activity</p>
              <h2>Recruiter signals</h2>
            </div>
          </div>

          <div className="dashboard-signal-grid">
            <div>
              <span>Candidates</span>
              <strong>{data?.availableProfessionalsCount ?? 0}</strong>
            </div>
            <div>
              <span>Connections</span>
              <strong>{data?.myConnectionsCount ?? 0}</strong>
            </div>
            <div>
              <span>Pending requests</span>
              <strong>{data?.pendingRequestsCount ?? 0}</strong>
            </div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="section-header dashboard-section-header">
            <div>
              <p className="eyebrow">Hiring actions</p>
              <h2>Keep recruiting work moving</h2>
            </div>
          </div>

          <div className="dashboard-action-list">
            <Link href="/recruiter/candidates" className="dashboard-action-row">
              <span>Search by skill, location, and candidate profile details</span>
              <strong>Find talent</strong>
            </Link>
            <Link href="/connections" className="dashboard-action-row">
              <span>Accept invitations and grow your recruiter network</span>
              <strong>Network</strong>
            </Link>
            <Link href="/messages" className="dashboard-action-row">
              <span>Continue active hiring conversations</span>
              <strong>Inbox</strong>
            </Link>
            <Link href="/profile/edit#company" className="dashboard-action-row">
              <span>Keep your company and hiring profile accurate</span>
              <strong>Edit profile</strong>
            </Link>
          </div>
        </section>
      </section>
    </div>
  );
}
