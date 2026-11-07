"use client";

/**
 * One job, e.g. /jobs/12: the full description on the left, and who is
 * hiring on the right with a button to their profile (where Connect /
 * Message live). There's no "apply" form on purpose: candidates talk to the
 * recruiter directly, through the normal network rules.
 *
 * Anyone but the recruiter and admins can report the job (scam, fake job...).
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, Clock, Flag, Globe, MapPin, Wallet } from "lucide-react";

import { errorText } from "@/app/api/client";
import ReportDialog from "@/app/components/ReportDialog";
import { Avatar, EmptyState, Notice, Panel, ui } from "@/app/components/ui";
import { ROUTES } from "@/app/config/routes";
import { getJob, postedAgo, type Job } from "@/app/services/jobs";
import { isAdmin, useCurrentUser } from "../../CurrentUserContext";
import { jobKind, jobPlace } from "../components/JobCard";
import styles from "../jobs.module.css";

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const me = useCurrentUser();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [reporting, setReporting] = useState(false); // the Report box is open

  useEffect(() => {
    let pageIsOpen = true;
    getJob(id)
      .then((data) => {
        if (pageIsOpen) setJob(data);
      })
      .catch((problem: unknown) => {
        if (pageIsOpen) setError(errorText(problem, "This job isn't available."));
      });
    return () => {
      pageIsOpen = false;
    };
  }, [id]);

  if (error) {
    return (
      <main className={ui.page}>
        <Panel>
          <EmptyState
            icon={BriefcaseBusiness}
            title="Job not found"
            text={`${error} It may have been closed or removed.`}
            action={
              <Link href={ROUTES.JOBS} className="btn-primary">
                See all jobs
              </Link>
            }
          />
        </Panel>
      </main>
    );
  }

  if (!job) {
    return (
      <main className={ui.page}>
        <p className="muted">Loading...</p>
      </main>
    );
  }

  const company = job.recruiter.companyName || job.recruiter.name;
  // Admins act from the admin page instead, and nobody reports their own job (Django checks too).
  const canReport = !job.isMine && !isAdmin(me);

  return (
    <main className={ui.page}>
      <div className={ui.stack}>
        <Link href={job.isMine ? ROUTES.MY_JOBS : ROUTES.JOBS} className={styles.linkButton}>
          <ArrowLeft size={14} aria-hidden="true" /> {job.isMine ? "My jobs" : "All jobs"}
        </Link>

        {job.hiddenByAdmin && (
          <Notice tone="error">
            An admin hid this job, so candidates can&apos;t see it.
            {job.hiddenReason ? ` Reason: ${job.hiddenReason}` : ""}
          </Notice>
        )}
        {job.status === "closed" && <Notice>This job is closed. Candidates can&apos;t see it.</Notice>}

        <section className={`${ui.panel}`} aria-label="Job summary">
          <div className={styles.cardTop}>
            <Avatar name={company} size={56} />
            <div className={styles.cardMain}>
              <h1 className={styles.title} style={{ fontSize: 24 }}>
                {job.title}
              </h1>
              <p className={styles.company}>{company}</p>
            </div>
            <span className={styles.posted}>
              <Clock size={12} aria-hidden="true" /> Posted {postedAgo(job.createdAt)}
            </span>
          </div>
          {job.skills.length > 0 && (
            <div className={styles.tags} style={{ marginTop: 14 }}>
              {job.skills.map((skill) => (
                <span key={skill} className={styles.tag}>
                  {skill}
                </span>
              ))}
            </div>
          )}
        </section>

        <div className={ui.columns}>
          <Panel title="About the job">
            <p className={styles.description}>{job.description}</p>
          </Panel>

          <div className={ui.stack}>
            <Panel title="Details">
              <div className={styles.factsGrid}>
                <span className={styles.factRow}>
                  <MapPin size={16} aria-hidden="true" />
                  {jobPlace(job)}
                </span>
                <span className={styles.factRow}>
                  <BriefcaseBusiness size={16} aria-hidden="true" />
                  {jobKind(job)}
                </span>
                {job.salary && (
                  <span className={styles.factRow}>
                    <Wallet size={16} aria-hidden="true" />
                    {job.salary}
                  </span>
                )}
              </div>
            </Panel>

            <Panel title="Hiring">
              <div className={styles.recruiterHead}>
                <Avatar name={job.recruiter.name} size={44} />
                <div>
                  <strong>{job.recruiter.name}</strong>
                  <span>{[job.recruiter.title, job.recruiter.companyName].filter(Boolean).join(" at ")}</span>
                </div>
              </div>
              {job.isMine ? (
                <div className={styles.sideButtons}>
                  <Link href={ROUTES.MY_JOBS} className="btn-primary">
                    Edit in My jobs
                  </Link>
                </div>
              ) : (
                <>
                  <div className={styles.sideButtons}>
                    <Link href={ROUTES.USER_PROFILE(job.recruiter.id)} className="btn-primary">
                      View recruiter &amp; connect
                    </Link>
                    {job.recruiter.companyWebsite && (
                      <a href={job.recruiter.companyWebsite} target="_blank" rel="noopener noreferrer" className="btn-outline">
                        <Globe size={15} aria-hidden="true" /> Company website
                      </a>
                    )}
                  </div>
                  <p className={styles.hint}>
                    Connect with {job.recruiter.name.split(" ")[0]}, then message them about this job.
                  </p>
                  {canReport && (
                    <div className={styles.sideButtons}>
                      <button type="button" className="btn-outline btn-sm" onClick={() => setReporting(true)}>
                        <Flag size={14} aria-hidden="true" /> Report job
                      </button>
                    </div>
                  )}
                </>
              )}
            </Panel>
          </div>
        </div>
      </div>

      {reporting && (
        <ReportDialog
          target={{ kind: "job", reportedUserId: job.recruiter.id, jobId: job.id }}
          name={job.recruiter.name}
          jobTitle={job.title}
          onClose={() => setReporting(false)}
        />
      )}
    </main>
  );
}
