type RecruiterCandidatesToolbarProps = {
  totalCandidates: number;
  activeFiltersCount: number;
  onClearFilters: () => void;
};

export default function RecruiterCandidatesToolbar({
  totalCandidates,
  activeFiltersCount,
  onClearFilters,
}: RecruiterCandidatesToolbarProps) {
  return (
    <section className="ats-toolbar">
      <div>
        <p className="eyebrow">Recruiter ATS</p>
        <h1>Find Candidates</h1>
        <p className="page-description">
          Search, filter, and review candidates using backend-powered recruiter tools.
        </p>
      </div>

      <div className="ats-toolbar-actions">
        <div className="ats-stat-pill">
          <strong>{totalCandidates}</strong>
          <span>matched candidates</span>
        </div>

        {activeFiltersCount > 0 && (
          <button className="secondary-button" onClick={onClearFilters}>
            Clear {activeFiltersCount} filter
            {activeFiltersCount > 1 ? "s" : ""}
          </button>
        )}
      </div>
    </section>
  );
}