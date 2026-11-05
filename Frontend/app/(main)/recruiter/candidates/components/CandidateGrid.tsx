import { ui } from "@/app/components/ui";
import type { RecruiterCandidate } from "@/app/services/recruiter/candidates";
import CandidateCard from "./CandidateCard";

/** The list of results. (Rows are quicker to scan than a grid of cards.) */
export default function CandidateGrid({ candidates }: { candidates: RecruiterCandidate[] }) {
  return (
    <ul className={ui.list}>
      {candidates.map((candidate) => (
        <CandidateCard key={candidate.id} candidate={candidate} />
      ))}
    </ul>
  );
}
