// app/(main)/recruiter/candidates/components/EmptyCandidates.tsx

type EmptyCandidatesProps = {
  onClearFilters: () => void;
};

export default function EmptyCandidates({ onClearFilters }: EmptyCandidatesProps) {
  return (
    <section className="card empty-state">
      <h2>No candidates found</h2>
      <p>
        Try changing your search, skill, location, or open-to-work filters.
      </p>

      <button type="button" className="secondary-button" onClick={onClearFilters}>
        Clear filters
      </button>
    </section>
  );
}