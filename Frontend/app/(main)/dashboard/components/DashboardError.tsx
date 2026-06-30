type DashboardErrorProps = {
  message: string;
};

export default function DashboardError({
  message,
}: DashboardErrorProps) {
  return (
    <main className="page-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Something went wrong</h1>
          <p>{message}</p>
        </div>
      </section>
    </main>
  );
}