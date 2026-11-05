"use client";

/**
 * A recruiter's quick summary of one candidate.
 * "View full profile" opens their whole profile (projects, experience, CV).
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { ArrowLeft, MapPin, UserX } from "lucide-react";

import { errorText } from "@/app/api/client";
import { Avatar, Badge, EmptyState, Panel, ui } from "@/app/components/ui";
import {
  getRecruiterCandidate,
  type RecruiterCandidate,
} from "@/app/services/recruiter/candidates";
import { ROUTES } from "../../../../config/routes";
import styles from "../candidates.module.css";

export default function RecruiterCandidateDetailsPage() {
  const params = useParams<{ id: string }>();
  const [candidate, setCandidate] = useState<RecruiterCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let pageIsOpen = true;

    async function loadCandidate() {
      try {
        const data = await getRecruiterCandidate(params.id);
        if (!pageIsOpen) return;
        setCandidate(data);
        setError("");
      } catch (loadError) {
        if (!pageIsOpen) return;
        setCandidate(null);
        // Django's own reason, e.g. "Only approved recruiters can search candidates."
        setError(errorText(loadError, "This candidate profile could not be loaded."));
      } finally {
        if (pageIsOpen) setLoading(false);
      }
    }

    void loadCandidate();

    return () => {
      pageIsOpen = false;
    };
  }, [params.id]);

  if (loading) {
    return (
      <main className={ui.page}>
        <p className="muted">Loading candidate...</p>
      </main>
    );
  }

  if (error || !candidate) {
    return (
      <main className={ui.page}>
        <Panel>
          <EmptyState
            icon={UserX}
            title="Candidate not found"
            text={error || "This candidate profile could not be loaded."}
            action={
              <Link href={ROUTES.RECRUITER_CANDIDATES} className="btn-primary">
                Back to candidates
              </Link>
            }
          />
        </Panel>
      </main>
    );
  }

  return (
    <main className={ui.page}>
      <div className={ui.stack}>
        <Link href={ROUTES.RECRUITER_CANDIDATES} className={styles.clearButton}>
          <ArrowLeft size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
          Back to candidates
        </Link>

        {/* ---------- Who they are ---------- */}
        <section className={ui.panel} aria-label="Candidate summary">
          <div className={styles.summaryHeader}>
            <Avatar name={candidate.fullName} size={72} />
            <div className={styles.summaryMain}>
              <h1 className={styles.summaryName}>{candidate.fullName}</h1>
              <p className={styles.headline}>{candidate.headline || "No headline yet"}</p>
              <div className={styles.meta}>
                {candidate.location && (
                  <span className={styles.metaItem}>
                    <MapPin size={14} aria-hidden="true" />
                    {candidate.location}
                  </span>
                )}
                {candidate.openToWork && <Badge tone="success">Open to work</Badge>}
              </div>
              <div className={styles.summaryActions}>
                {/* The full profile has projects, experience and the CV. */}
                <Link href={ROUTES.USER_PROFILE(candidate.id)} className="btn-primary">
                  View full profile and CV
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className={ui.columns}>
          <div className={ui.stack}>
            <Panel title="About">
              <p className={styles.headline}>{candidate.bio || "This candidate hasn't added a bio yet."}</p>
            </Panel>

            <Panel title="Skills">
              {candidate.skills.length > 0 ? (
                <div className={styles.skills}>
                  {candidate.skills.map((skill) => (
                    <span key={skill} className={styles.skill}>
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted">No skills added yet.</p>
              )}
            </Panel>
          </div>

          <Panel title="At a glance">
            <div className={styles.facts}>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Projects</span>
                <strong>{candidate.projectsCount}</strong>
              </div>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Work experience</span>
                <strong>{candidate.experiencesCount}</strong>
              </div>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Skills</span>
                <strong>{candidate.skills.length}</strong>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}
