import Link from "next/link";
import { Briefcase, FolderGit2, MapPin } from "lucide-react";

import { Avatar, Badge } from "@/app/components/ui";
import { ROUTES } from "@/app/config/routes";
import type { RecruiterCandidate } from "@/app/services/recruiter/candidates";
import styles from "../candidates.module.css";

// Show this many skills, then "+3 more".
const VISIBLE_SKILLS = 5;

/** One candidate in the results list: who, where, top skills, and a button. */
export default function CandidateCard({ candidate }: { candidate: RecruiterCandidate }) {
  const visibleSkills = candidate.skills.slice(0, VISIBLE_SKILLS);
  const hiddenCount = candidate.skills.length - visibleSkills.length;
  const profileLink = ROUTES.RECRUITER_CANDIDATE(candidate.id);

  return (
    <li className={styles.candidate}>
      <Avatar name={candidate.fullName} size={48} />

      <div>
        <Link href={profileLink} className={styles.name}>
          {candidate.fullName}
          {candidate.openToWork && <Badge tone="success">Open to work</Badge>}
        </Link>
        <p className={styles.headline}>{candidate.headline || "No headline yet"}</p>

        <div className={styles.meta}>
          {candidate.location && (
            <span className={styles.metaItem}>
              <MapPin size={13} aria-hidden="true" />
              {candidate.location}
            </span>
          )}
          <span className={styles.metaItem}>
            <FolderGit2 size={13} aria-hidden="true" />
            {candidate.projectsCount} {candidate.projectsCount === 1 ? "project" : "projects"}
          </span>
          <span className={styles.metaItem}>
            <Briefcase size={13} aria-hidden="true" />
            {candidate.experiencesCount} {candidate.experiencesCount === 1 ? "job" : "jobs"}
          </span>
        </div>

        {candidate.bio && <p className={styles.bio}>{candidate.bio}</p>}

        {visibleSkills.length > 0 && (
          <div className={styles.skills}>
            {visibleSkills.map((skill) => (
              <span key={skill} className={styles.skill}>
                {skill}
              </span>
            ))}
            {hiddenCount > 0 && <span className={`${styles.skill} ${styles.skillMore}`}>+{hiddenCount} more</span>}
          </div>
        )}
      </div>

      <Link href={profileLink} className={`btn-outline btn-sm ${styles.candidateAction}`}>
        View profile
      </Link>
    </li>
  );
}
