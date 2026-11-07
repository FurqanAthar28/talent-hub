/**
 * One job in a list: title, company, the key facts, skills and the start of
 * the description. The whole card is a link to the job's page.
 * `footer` (optional) adds buttons under it, e.g. Edit / Close on "My jobs".
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { BriefcaseBusiness, Clock, MapPin, Wallet } from "lucide-react";

import { Avatar, Badge } from "@/app/components/ui";
import { HIRING_LEVELS, JOB_TYPES, WORK_STYLES, choiceLabel } from "@/app/config/constants";
import { ROUTES } from "@/app/config/routes";
import { postedAgo, type Job } from "@/app/services/jobs";
import styles from "../jobs.module.css";

/** "Hybrid · Lahore", or just "Remote". */
export function jobPlace(job: Pick<Job, "workStyle" | "location">) {
  return [choiceLabel(WORK_STYLES, job.workStyle), job.location].filter(Boolean).join(" · ");
}

/** "Full-time · Senior". An internship is already a level, so it isn't said twice. */
export function jobKind(job: Pick<Job, "employmentType" | "experienceLevel">) {
  const type = choiceLabel(JOB_TYPES, job.employmentType);
  const level = choiceLabel(HIRING_LEVELS, job.experienceLevel);
  return type === level ? type : `${type} · ${level}`;
}

export function JobFacts({ job }: { job: Job }) {
  return (
    <div className={styles.facts}>
      <span>
        <MapPin size={14} aria-hidden="true" />
        {jobPlace(job)}
      </span>
      <span>
        <BriefcaseBusiness size={14} aria-hidden="true" />
        {jobKind(job)}
      </span>
      {job.salary && (
        <span>
          <Wallet size={14} aria-hidden="true" />
          {job.salary}
        </span>
      )}
    </div>
  );
}

export default function JobCard({ job, footer, showStatus = false }: { job: Job; footer?: ReactNode; showStatus?: boolean }) {
  const company = job.recruiter.companyName || job.recruiter.name;

  return (
    <li className={styles.card}>
      <Link href={ROUTES.JOB(job.id)} className={styles.cardLink}>
        <div className={styles.cardTop}>
          <Avatar name={company} size={44} />
          <div className={styles.cardMain}>
            <h2 className={styles.title}>{job.title}</h2>
            <p className={styles.company}>
              {company}
              {job.recruiter.companyIndustry ? ` · ${job.recruiter.companyIndustry}` : ""}
            </p>
          </div>
          <span className={styles.posted}>
            <Clock size={12} aria-hidden="true" /> {postedAgo(job.createdAt)}
          </span>
        </div>
      </Link>

      {showStatus && (job.status === "closed" || job.hiddenByAdmin) && (
        <div className={styles.tags}>
          {job.status === "closed" && <Badge tone="neutral">Closed</Badge>}
          {job.hiddenByAdmin && <Badge tone="danger">Hidden by an admin</Badge>}
        </div>
      )}

      <JobFacts job={job} />

      {job.skills.length > 0 && (
        <div className={styles.tags}>
          {job.skills.map((skill) => (
            <span key={skill} className={styles.tag}>
              {skill}
            </span>
          ))}
        </div>
      )}

      <p className={styles.snippet}>{job.description}</p>

      {footer}
    </li>
  );
}
