type CandidateSearchBarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
};

export default function CandidateSearchBar({
  searchQuery,
  onSearchChange,
}: CandidateSearchBarProps) {
  return (
    <section className="dashboard-section">
      <div className="form-group">
        <label htmlFor="candidate-search">Search candidates</label>
        <input
          id="candidate-search"
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search candidates..."
        />
      </div>
    </section>
  );
}