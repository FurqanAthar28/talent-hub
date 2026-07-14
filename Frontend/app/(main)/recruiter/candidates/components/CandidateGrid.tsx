import type { RecruiterCandidate } from "@/app/services/recruiter/candidates";
import CandidateCard from "./CandidateCard";

type CandidateGridProps = {
  candidates: RecruiterCandidate[];
};

export default function CandidateGrid({
  candidates,
}: CandidateGridProps) {
  return (
    <section className="ats-candidate-grid">
      {candidates.map((candidate) => (
        <CandidateCard
          key={candidate.id}
          candidate={candidate}
        />
      ))}
    </section>
  );
}