import Link from "next/link";

const actions = [
  {
    title: "Complete Profile",
    description: "Update headline, location, bio, and professional links.",
    href: "/profile/edit",
    button: "Edit Profile",
  },
  {
    title: "Manage Resume",
    description: "Upload or replace your latest resume.",
    href: "/profile/edit#resume",
    button: "Resume",
  },
  {
    title: "Add Skills",
    description: "Add your technical and professional skills.",
    href: "/profile/edit#skills",
    button: "Skills",
  },
  {
    title: "Add Projects",
    description: "Showcase practical work and portfolio projects.",
    href: "/profile/edit#projects",
    button: "Projects",
  },
  {
    title: "Add Experience",
    description: "Add work, internship, or freelance experience.",
    href: "/profile/edit#experience",
    button: "Experience",
  },
  {
    title: "Grow Network",
    description: "Connect with professionals and recruiters.",
    href: "/connections",
    button: "Discover",
  },
  {
    title: "Messages",
    description: "View and reply to professional conversations.",
    href: "/messages",
    button: "Inbox",
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