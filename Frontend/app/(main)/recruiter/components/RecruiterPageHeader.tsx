type RecruiterPageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  total: number;
  totalLabel: string;
  activeFilters?: number;
  onClearFilters?: () => void;
};

export default function RecruiterPageHeader({
  eyebrow,
  title,
  description,
  total,
  totalLabel,
  activeFilters = 0,
  onClearFilters,
}: RecruiterPageHeaderProps) {
  return (
    <section className="recruiter-page-header">
      <div className="recruiter-page-header__content">
        <p className="eyebrow">{eyebrow}</p>

        <h1>{title}</h1>

        <p className="page-description">
          {description}
        </p>
      </div>

      <div className="recruiter-page-header__actions">
        <div className="recruiter-stat-card">
          <strong>{total}</strong>
          <span>{totalLabel}</span>
        </div>

        {activeFilters > 0 && onClearFilters && (
          <button
            className="btn btn-secondary"
            onClick={onClearFilters}
          >
            Clear {activeFilters} filter
            {activeFilters > 1 ? "s" : ""}
          </button>
        )}
      </div>
    </section>
  );
}