type SkillsOverviewCardProps = {
  skillsCount: number;
};

export default function SkillsOverviewCard({
  skillsCount,
}: SkillsOverviewCardProps) {
  return (
    <article className="dashboard-card">
      <span className="card-label">Professional Skills</span>

      <h2>{skillsCount}</h2>

      <p>
        Skills help recruiters understand your strengths and match you with
        better opportunities.
      </p>
    </article>
  );
}