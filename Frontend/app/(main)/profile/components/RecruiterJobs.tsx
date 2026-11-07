"use client";

/**
 * "Open jobs" on a recruiter's profile: the jobs candidates can see right now.
 * Not shown at all when the viewer can't browse jobs (e.g. still waiting for
 * approval), so the profile never shows an error box for it.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { Panel } from "@/app/components/ui";
import { ROUTES } from "@/app/config/routes";
import { getJobs, postedAgo, type Job } from "@/app/services/jobs";
import { jobPlace } from "../../jobs/components/JobCard";
import styles from "./profile.module.css";

export default function RecruiterJobs({ recruiterUserId, isMine }: { recruiterUserId: number; isMine: boolean }) {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getJobs({ recruiter: recruiterUserId }, controller.signal)
      .then(setJobs)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [recruiterUserId]);

  if (failed || jobs === null) return null;
  if (jobs.length === 0 && !isMine) return null;

  return (
    <Panel
      title="Open jobs"
      actions={
        isMine ? (
          <Link href={ROUTES.MY_JOBS} className={styles.panelLink}>
            Manage
          </Link>
        ) : undefined
      }
    >
      {jobs.length === 0 ? (
        <p className={styles.muted}>
          No open jobs. <Link href={ROUTES.MY_JOBS}>Post a job</Link> so candidates see what you&apos;re hiring for.
        </p>
      ) : (
        <ul className={styles.jobList}>
          {jobs.map((job) => (
            <li key={job.id}>
              <Link href={ROUTES.JOB(job.id)} className={styles.jobRow}>
                <strong>{job.title}</strong>
                <span>
                  {jobPlace(job)} · posted {postedAgo(job.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
