"use client";

/**
 * My jobs (recruiters): post a job, edit it, close it when it's filled,
 * reopen it, or delete it. Hidden jobs show the admin's reason.
 *
 * Only approved recruiters can post: Django checks, and the form shows its
 * message ("Only approved recruiters can post jobs.") to anyone else.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, Plus } from "lucide-react";

import { errorText } from "@/app/api/client";
import { useConfirm } from "@/app/components/ui/ConfirmDialog";
import { EmptyState, Notice, Page, Panel, Tabs } from "@/app/components/ui";
import { ROUTES } from "@/app/config/routes";
import { deleteJob, getMyJobs, updateJob, type Job } from "@/app/services/jobs";
import { useCurrentUser } from "../../CurrentUserContext";
import JobCard from "../components/JobCard";
import JobFormModal from "../components/JobFormModal";
import styles from "../jobs.module.css";

type View = "open" | "closed";

export default function MyJobsPage() {
  const router = useRouter();
  const me = useCurrentUser();
  const { confirm, dialog } = useConfirm();

  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [view, setView] = useState<View>("open");
  const [editing, setEditing] = useState<Job | "new" | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const isRecruiter = me.role === "recruiter";

  useEffect(() => {
    if (!isRecruiter) {
      router.replace(ROUTES.JOBS); // only recruiters have their own jobs
      return;
    }
    getMyJobs()
      .then(setJobs)
      .catch((problem: unknown) => {
        setJobs([]);
        setMessage({ tone: "error", text: errorText(problem, "Couldn't load your jobs.") });
      });
  }, [isRecruiter, router]);

  if (!isRecruiter) return null;

  const openJobs = (jobs ?? []).filter((job) => job.status === "open");
  const closedJobs = (jobs ?? []).filter((job) => job.status === "closed");
  const shown = view === "open" ? openJobs : closedJobs;

  function replace(updated: Job) {
    setJobs((list) => {
      const rest = (list ?? []).filter((job) => job.id !== updated.id);
      return [updated, ...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }

  async function run(job: Job, work: () => Promise<void>) {
    if (busyId !== null) return;
    setBusyId(job.id);
    setMessage(null);
    try {
      await work();
    } catch (problem) {
      setMessage({ tone: "error", text: errorText(problem, "That didn't work. Please try again.") });
    } finally {
      setBusyId(null);
    }
  }

  function setStatus(job: Job, status: Job["status"]) {
    void run(job, async () => {
      replace(await updateJob(job.id, { status }));
      setMessage({
        tone: "success",
        text: status === "closed" ? `"${job.title}" is closed. Candidates no longer see it.` : `"${job.title}" is open again.`,
      });
    });
  }

  async function handleDelete(job: Job) {
    const answer = await confirm({
      title: `Delete "${job.title}"?`,
      text: "It's removed for good. If you might hire for it again, close it instead.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!answer.confirmed) return;
    void run(job, async () => {
      await deleteJob(job.id);
      setJobs((list) => (list ?? []).filter((item) => item.id !== job.id));
      setMessage({ tone: "success", text: "Job deleted." });
    });
  }

  return (
    <Page
      title="My jobs"
      subtitle="Post the roles you're hiring for. Candidates find them on the Jobs page and on your profile."
      actions={
        <>
          <Link href={ROUTES.JOBS} className="btn-outline">
            Browse all jobs
          </Link>
          <button type="button" className="btn-primary" onClick={() => setEditing("new")}>
            <Plus size={16} aria-hidden="true" /> Post a job
          </button>
        </>
      }
    >
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <Tabs
        label="Which jobs"
        active={view}
        onChange={setView}
        items={[
          { id: "open", label: "Open", count: openJobs.length },
          { id: "closed", label: "Closed", count: closedJobs.length },
        ]}
      />

      <div style={{ marginTop: 16 }}>
        {jobs === null ? (
          <p className="muted">Loading...</p>
        ) : shown.length === 0 ? (
          <Panel>
            <EmptyState
              icon={BriefcaseBusiness}
              title={view === "open" ? "No open jobs" : "No closed jobs"}
              text={
                view === "open"
                  ? "Post your first job so candidates know what you're hiring for."
                  : "Jobs you close when they're filled are kept here. You can reopen them."
              }
              action={
                view === "open" ? (
                  <button type="button" className="btn-primary" onClick={() => setEditing("new")}>
                    Post a job
                  </button>
                ) : undefined
              }
            />
          </Panel>
        ) : (
          <ul className={styles.list}>
            {shown.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                showStatus
                footer={
                  <>
                    {job.hiddenByAdmin && (
                      <p className={styles.hiddenNote}>
                        An admin hid this job{job.hiddenReason ? `: ${job.hiddenReason}` : "."} Fix it, then message an
                        admin to show it again.
                      </p>
                    )}
                    <div className={styles.manageActions}>
                      <button
                        type="button"
                        className="btn-outline btn-sm"
                        disabled={busyId === job.id}
                        onClick={() => setEditing(job)}
                      >
                        Edit
                      </button>
                      {job.status === "open" ? (
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          disabled={busyId === job.id}
                          onClick={() => setStatus(job, "closed")}
                        >
                          Close (filled)
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          disabled={busyId === job.id}
                          onClick={() => setStatus(job, "open")}
                        >
                          Reopen
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-danger-outline btn-sm"
                        disabled={busyId === job.id}
                        onClick={() => void handleDelete(job)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                }
              />
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <JobFormModal
          job={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            replace(saved);
            setView(saved.status === "open" ? "open" : "closed");
            setMessage({ tone: "success", text: editing === "new" ? `"${saved.title}" is posted.` : "Job saved." });
            setEditing(null);
          }}
        />
      )}
      {dialog}
    </Page>
  );
}
