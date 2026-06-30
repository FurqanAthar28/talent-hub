import type { DashboardData } from "../../../services/dashboard";
import PortfolioStrengthCard from "./cards/PortfolioStrengthCard";
import SkillsOverviewCard from "./cards/SkillsOverviewCard";
import ProfileCompletionCard from "./cards/ProfileCompletionCard"; 

type DashboardOverviewProps = {
  data: DashboardData;
};

export default function DashboardOverview({ data }: DashboardOverviewProps) {
  return (
    <section className="dashboard-grid">
      <ProfileCompletionCard data={data} />

      <SkillsOverviewCard skillsCount={data.skillsCount} />

      <PortfolioStrengthCard
        projectsCount={data.projectsCount}
        experiencesCount={data.experiencesCount}
      />
    </section>
  );
}