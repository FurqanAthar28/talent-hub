import Link from "next/link";

import type { RecruiterCandidate } from "@/app/services/recruiter/candidates";

type CandidateCardProps = {
  candidate: RecruiterCandidate;
};

export default function CandidateCard({ candidate }: CandidateCardProps) {
  const visibleSkills = candidate.skills.slice(0, 5);
  const remainingSkillsCount = candidate.skills.length - visibleSkills.length;

  return (
    <article className="ats-candidate-card">
      <div className="ats-candidate-top">
        <div className="ats-candidate-identity">
          <div className="ats-candidate-avatar">
            {candidate.fullName.charAt(0).toUpperCase()}
          </div>

          <div>
            <h2>{candidate.fullName}</h2>
            <p>{candidate.headline || "No headline added yet"}</p>
          </div>
        </div>

        {candidate.openToWork && (
          <span className="status-pill success">Open to work</span>
        )}
      </div>

      <div className="ats-candidate-location">
        {candidate.location || "Location not added"}
      </div>

      <p className="ats-candidate-summary">
        {candidate.bio || "No bio added yet."}
      </p>

      <div className="ats-skill-list">
        {visibleSkills.length > 0 ? (
          <>
            {visibleSkills.map((skill) => (
              <span key={skill} className="skill-pill">
                {skill}
              </span>
            ))}

            {remainingSkillsCount > 0 && (
              <span className="skill-pill">+{remainingSkillsCount} more</span>
            )}
          </>
        ) : (
          <span className="muted-text">No skills added yet</span>
        )}
      </div>

      <div className="ats-candidate-footer">
        <div className="candidate-stats">
          <span>{candidate.projectsCount} projects</span>
          <span>{candidate.experiencesCount} experiences</span>
        </div>

        <Link
          href={`/recruiter/candidates/${candidate.id}`}
          className="btn-primary"
        >
          View Profile
        </Link>
      </div>
    </article>
  );
}
