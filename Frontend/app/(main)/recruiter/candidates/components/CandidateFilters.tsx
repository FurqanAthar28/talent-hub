type CandidateFiltersProps = {
  skillFilter: string;
  locationFilter: string;
  openToWorkOnly: boolean;
  onSkillChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onOpenToWorkChange: (value: boolean) => void;
  onClearFilters: () => void;
};

export default function CandidateFilters({
  skillFilter,
  locationFilter,
  openToWorkOnly,
  onSkillChange,
  onLocationChange,
  onOpenToWorkChange,
  onClearFilters,
}: CandidateFiltersProps) {
  return (
    <section className="ats-filters">
      <div className="ats-filter-group">
        <label htmlFor="skill-filter">Skill</label>

        <input
          id="skill-filter"
          type="text"
          className="form-input"
          placeholder="Python, Django, React..."
          value={skillFilter}
          onChange={(event) => onSkillChange(event.target.value)}
        />
      </div>

      <div className="ats-filter-group">
        <label htmlFor="location-filter">Location</label>

        <input
          id="location-filter"
          type="text"
          className="form-input"
         placeholder="City, Country | Remote | Hybrid"
          value={locationFilter}
          onChange={(event) => onLocationChange(event.target.value)}
        />
      </div>

      <div className="ats-filter-group ats-filter-checkbox">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={openToWorkOnly}
            onChange={(event) =>
              onOpenToWorkChange(event.target.checked)
            }
          />

          <span>Open to work only</span>
        </label>
      </div>

      <div className="ats-filter-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClearFilters}
        >
          Clear Filters
        </button>
      </div>
    </section>
  );
}