"use client";

/**
 * Every job recruiters posted (open, closed, hidden), newest first.
 * An admin can hide a job that breaks the rules (with a reason the recruiter
 * sees) or show it again. Hiding never deletes anything.
 */

import Link from "next/link";
import { Briefcase, ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar, Badge, EmptyState, cx } from "@/app/components/ui";
import { ROUTES } from "@/app/config/routes";
import { postedAgo, type Job } from "@/app/services/jobs";
import { jobKind, jobPlace } from "../../jobs/components/JobCard";
import styles from "../users.module.css";
import reportStyles from "../reports.module.css";

type Filter = "all" | "open" | "hidden" | "closed";

type Props = {
  jobs: Job[] | null; // null = loading
  busyJobId: number | null;
  onSetHidden: (job: Job, hidden: boolean) => void;
};

const matchesFilter = (job: Job, filter: Filter) =>
  filter === "all" ||
  (filter === "hidden" && job.hiddenByAdmin) ||
  (filter === "open" && job.status === "open" && !job.hiddenByAdmin) ||
  (filter === "closed" && job.status === "closed");

export default function JobsSection({ jobs, busyJobId, onSetHidden }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const searched = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (jobs ?? []).filter(
      (job) =>
        !query ||
        [job.title, job.recruiter.name, job.recruiter.companyName, job.location].join(" ").toLowerCase().includes(query)
    );
  }, [jobs, search]);

  if (jobs === null) return <p className="muted">Loading jobs...</p>;

  const shown = searched.filter((job) => matchesFilter(job, filter));
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "open", label: "Live" },
    { id: "hidden", label: "Hidden" },
    { id: "closed", label: "Closed" },
  ];

  return (
    <div className={reportStyles.section}>
      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, recruiter or company"
              aria-label="Search jobs"
            />
          </label>
          <span className={styles.count}>{jobs.length} jobs posted</span>
        </div>
        <div className={styles.filters} role="group" aria-label="Which jobs">
          {filters.map((option) => (
            <button
              key={option.id}
              type="button"
              className={cx(styles.filter, filter === option.id && styles.filterOn)}
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
              <span className={styles.filterCount}>{searched.filter((job) => matchesFilter(job, option.id)).length}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className={styles.panel}>
          <EmptyState icon={Briefcase} title="No jobs here" text="Jobs recruiters post show up in this list." />
        </div>
      ) : (
        <ol className={reportStyles.list}>
          {shown.map((job) => {
            const busy = busyJobId === job.id;
            return (
              <li key={job.id} className={cx(reportStyles.card, busy && reportStyles.cardBusy)}>
                <div className={reportStyles.top}>
                  <div className={reportStyles.tags}>
                    {job.hiddenByAdmin ? (
                      <Badge tone="danger">Hidden</Badge>
                    ) : job.status === "open" ? (
                      <Badge tone="success">Live</Badge>
                    ) : (
                      <Badge tone="neutral">Closed</Badge>
                    )}
                    <span className={reportStyles.kind}>
                      {jobKind(job)} · {jobPlace(job)}
                    </span>
                  </div>
                  <span className={reportStyles.when}>Posted {postedAgo(job.createdAt)}</span>
                </div>

                <div className={reportStyles.person}>
                  <Avatar name={job.recruiter.companyName || job.recruiter.name} size={40} />
                  <div className={reportStyles.personText}>
                    <strong>{job.title}</strong>
                    <span>
                      {job.recruiter.name}
                      {job.recruiter.companyName ? ` · ${job.recruiter.companyName}` : ""}
                    </span>
                  </div>
                </div>

                {job.hiddenByAdmin && job.hiddenReason && (
                  <p className={reportStyles.details}>
                    <span className={reportStyles.label}>Hidden because:</span> {job.hiddenReason}
                  </p>
                )}

                <div className={reportStyles.bottom}>
                  <Link href={ROUTES.JOB(job.id)} className={reportStyles.profileLink} target="_blank" rel="noopener noreferrer">
                    Open job <ExternalLink size={13} aria-hidden="true" />
                  </Link>
                  <div className={reportStyles.actions}>
                    {busy && <span className={reportStyles.saving}>Saving...</span>}
                    <Link
                      href={ROUTES.USER_PROFILE(job.recruiter.id)}
                      className="btn-outline btn-sm"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Recruiter
                    </Link>
                    {job.hiddenByAdmin ? (
                      <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={() => onSetHidden(job, false)}>
                        Show again
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-danger-outline btn-sm"
                        disabled={busy}
                        onClick={() => onSetHidden(job, true)}
                      >
                        Hide
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
