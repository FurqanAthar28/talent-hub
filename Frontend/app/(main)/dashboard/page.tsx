import DashboardOverview from "./components/DashboardOverview";
import RecruiterDashboardSection  from './components/RecruiterDashboardSection';
import AdminDashboardSection  from './components/AdminDashboardSection';

export default function DashboardPage() {
  return (
    <main className="page-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Welcome back</h1>
          <p>
            Manage your profile, track activity, and review platform insights.
          </p>
        </div>
      </section>

      <DashboardOverview />
      <RecruiterDashboardSection />
      <AdminDashboardSection />
    </main>
  );
}