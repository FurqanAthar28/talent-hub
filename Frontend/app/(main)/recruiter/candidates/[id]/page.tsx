"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import {
  getRecruiterCandidate,
  type RecruiterCandidate,
} from "@/app/services/recruiter/candidates";

export default function RecruiterCandidateDetailsPage() {
  const params = useParams<{ id: string }>();
  const [candidate, setCandidate] = useState<RecruiterCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCandidate() {
      try {
        const data = await getRecruiterCandidate(params.id);
        setCandidate(data);
        setError("");
      } catch {
        setCandidate(null);
        setError("This candidate profile could not be loaded.");
      } finally {
        setLoading(false);
      }
    }

    void loadCandidate();
  }, [params.id]);

  if (loading) {
    return (
      <main className="page-shell recruiter-ats-page">
        <section className="ats-empty-state">
          <h2>Loading candidate...</h2>
          <p>Fetching candidate profile details.</p>
        </section>
      </main>
    );
  }

  if (error || !candidate) {
    return (
      <main className="page-shell recruiter-ats-page">
        <section className="ats-empty-state">
          <h2>Candidate not found</h2>
          <p>{error || "This candidate profile could not be loaded."}</p>
          <Link href="/recruiter/candidates" className="btn-primary">
            Back to Candidates
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell recruiter-ats-page">
      <Link href="/recruiter/candidates" className="btn-secondary recruiter-back-link">
        Back to Candidates
      </Link>

      <section className="recruiter-page-header">
        <div>
          <p className="eyebrow">Candidate Profile</p>
          <h1>{candidate.fullName}</h1>
          <p className="page-description">
            {candidate.headline || "No headline added yet"}
          </p>
        </div>

        {candidate.openToWork && (
          <span className="status-pill success">Open to work</span>
        )}
      </section>

      <section className="ats-candidate-card">
        <h2>Profile Summary</h2>

        <p className="ats-candidate-location">
          {candidate.location || "Location not added"}
        </p>

        <p className="ats-candidate-summary">
          {candidate.bio || "No bio added yet."}
        </p>

        <div className="ats-skill-list">
          {candidate.skills.length > 0 ? (
            candidate.skills.map((skill) => (
              <span key={skill} className="skill-pill">
                {skill}
              </span>
            ))
          ) : (
            <span className="muted-text">No skills added yet</span>
          )}
        </div>

        <div className="candidate-stats">
          <span>{candidate.projectsCount} projects</span>
          <span>{candidate.experiencesCount} experiences</span>
        </div>
      </section>
    </main>
  );
}
