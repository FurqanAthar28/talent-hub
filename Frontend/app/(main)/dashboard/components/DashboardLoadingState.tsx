export default function DashboardLoadingState() {
  return (
    <div className="app-main">
      <div className="container">
        <div className="card">
          <div className="card-body text-center">
            <p className="muted">Loading dashboard...</p>
          </div>
        </div>

        <div className="dashboard-stats mt-2">
          <div className="dashboard-stat-card">
            <h3>...</h3>
            <p>Loading</p>
          </div>
          <div className="dashboard-stat-card">
            <h3>...</h3>
            <p>Loading</p>
          </div>
          <div className="dashboard-stat-card">
            <h3>...</h3>
            <p>Loading</p>
          </div>
          <div className="dashboard-stat-card">
            <h3>...</h3>
            <p>Loading</p>
          </div>
        </div>
      </div>
    </div>
  );
}