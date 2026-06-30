type PortfolioStrengthCardProps = {
  projectsCount: number;
  experiencesCount: number;
};

export default function PortfolioStrengthCard({
  projectsCount,
  experiencesCount,
}: PortfolioStrengthCardProps) {
  return (
    <article className="dashboard-card">
      <span className="card-label">Portfolio Strength</span>

      <h2>{projectsCount} Projects</h2>

      <p>
        {experiencesCount} experience entries support your professional profile.
      </p>
    </article>
  );
}