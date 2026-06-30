import Link from "next/link";

const actions = [
  {
    title: "Complete Your Profile",
    description:
      "Improve your profile information and increase profile completion.",
    href: "/profile/edit",
    button: "Continue",
  },
  {
    title: "Manage Resume",
    description:
      "Upload or replace your latest resume so recruiters see your updated CV.",
    href: "/profile/edit#resume",
    button: "Resume",
  },
  {
    title: "Grow Your Network",
    description:
      "Connect with professionals and recruiters to expand your opportunities.",
    href: "/connections",
    button: "Discover",
  },
  {
    title: "Messages",
    description:
      "View and reply to conversations from your professional network.",
    href: "/messages",
    button: "Open Inbox",
  },
];

export default function DashboardQuickActions() {
  return (
    <section className="dashboard-section">
      <div className="section-header">
        <p className="eyebrow">Quick Actions</p>
        <h2>Continue where you left off</h2>
        <p className="muted">
          Common actions to help you keep your profile active and professional.
        </p>
      </div>

      <div className="dashboard-grid">
        {actions.map((action) => (
          <article key={action.title} className="dashboard-card">
            <h3>{action.title}</h3>
            <p>{action.description}</p>

            <Link href={action.href} className="btn-primary">
              {action.button}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}