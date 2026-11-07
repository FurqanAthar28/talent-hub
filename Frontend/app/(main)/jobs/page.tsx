"use client";

/**
 * Jobs: every open job, newest first, with a search box and 3 filters.
 * Same search pattern as the recruiter's candidate search: the boxes update
 * at once, Django is asked only after typing pauses, and an old answer can
 * never replace a newer one (AbortController).
 *
 * Recruiters also get a "My jobs" button to post and manage their own.
 */

import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState, Notice, Page, Panel } from "@/app/components/ui";
import { HIRING_LEVELS, JOB_TYPES, SEARCH_DEBOUNCE_MS, WORK_STYLES } from "@/app/config/constants";
import { ROUTES } from "@/app/config/routes";
import { useDebouncedValue } from "@/app/hooks/useDebouncedValue";
import { getJobs, type Job } from "@/app/services/jobs";
import { useCurrentUser } from "../CurrentUserContext";
import JobCard from "./components/JobCard";
import styles from "./jobs.module.css";

const NO_FILTERS = { q: "", type: "", workStyle: "", level: "" };

export default function JobsPage() {
  const me = useCurrentUser();
  const [filters, setFilters] = useState(NO_FILTERS);
  const debounced = useDebouncedValue(filters, SEARCH_DEBOUNCE_MS);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getJobs(debounced, controller.signal)
      .then((results) => {
        setJobs(results);
        setError("");
      })
      .catch((problem: unknown) => {
        if (controller.signal.aborted) return;
        setJobs([]);
        setError(problem instanceof Error ? problem.message : "Couldn't load jobs.");
      });
    return () => controller.abort();
  }, [debounced]);

  const set = (key: keyof typeof NO_FILTERS, value: string) => setFilters((previous) => ({ ...previous, [key]: value }));
  const filtering = Object.values(filters).some((value) => value.trim() !== "");

  return (
    <Page
      title="Jobs"
      subtitle="Open roles from approved recruiters. Like one? Connect with the recruiter or send them a message."
      actions={
        me.role === "recruiter" ? (
          <Link href={ROUTES.MY_JOBS} className="btn-primary">
            My jobs
          </Link>
        ) : undefined
      }
    >
      <div className={styles.filters}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Search</span>
          <input
            type="search"
            className={`${styles.input} ${styles.inputSearch}`}
            value={filters.q}
            onChange={(event) => set("q", event.target.value)}
            placeholder="Job title, company, skill or city"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Job type</span>
          <select className={styles.input} value={filters.type} onChange={(event) => set("type", event.target.value)}>
            <option value="">Any</option>
            {JOB_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Work style</span>
          <select className={styles.input} value={filters.workStyle} onChange={(event) => set("workStyle", event.target.value)}>
            <option value="">Any</option>
            {WORK_STYLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Level</span>
          <select className={styles.input} value={filters.level} onChange={(event) => set("level", event.target.value)}>
            <option value="">Any</option>
            {HIRING_LEVELS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {jobs === null ? (
        <p className="muted">Loading jobs...</p>
      ) : jobs.length === 0 ? (
        !error && (
          <Panel>
            <EmptyState
              icon={BriefcaseBusiness}
              title={filtering ? "No jobs match" : "No open jobs yet"}
              text={
                filtering
                  ? "Try fewer filters or a different word."
                  : "When recruiters post jobs, they show up here."
              }
              action={
                filtering ? (
                  <button type="button" className="btn-outline" onClick={() => setFilters(NO_FILTERS)}>
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          </Panel>
        )
      ) : (
        <>
          <div className={styles.resultLine}>
            <span>
              {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
            </span>
            {filtering && (
              <button type="button" className={styles.linkButton} onClick={() => setFilters(NO_FILTERS)}>
                Clear filters
              </button>
            )}
          </div>
          <ul className={styles.list}>
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}
