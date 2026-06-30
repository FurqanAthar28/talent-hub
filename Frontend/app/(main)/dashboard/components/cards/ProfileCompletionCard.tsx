import Link from "next/link";
import type { DashboardData } from "../../../../services/dashboard";

type ProfileCompletionCardProps = {
  data: DashboardData;
};

export default function ProfileCompletionCard({
  data,
}: ProfileCompletionCardProps) {
  return (
    <article className="dashboard-card profile-completion-card">
      <span className="card-label">Profile Completion</span>

      <div className="completion-header">
        <h2>{data.profileCompletion}%</h2>

        <span
          className={
            data.openToWork
              ? "status-badge status-success"
              : "status-badge status-muted"
          }
        >
          {data.openToWork ? "Open to Work" : "Not Looking"}
        </span>
      </div>

      <progress
        className="progress-bar"
        value={data.profileCompletion}
        max={100}
      />

      <p>
        Complete your profile to improve recruiter visibility and search
        ranking.
      </p>

      <Link href="/profile/edit" className="btn-primary btn-full">
        Improve Profile
      </Link>
    </article>
  );
}