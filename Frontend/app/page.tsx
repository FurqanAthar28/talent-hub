import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-page">
      <nav className="home-navbar">
        <div className="home-logo">
          <span className="logo-box">P</span>
          <span>ProfessionalHub</span>
        </div>

        <div className="home-nav-actions">
          <Link href="/signin" className="btn-outline">
            Sign In
          </Link>
          <Link href="/signup" className="btn-primary">
            Sign Up
          </Link>
        </div>
      </nav>

      <section className="home-hero-clean">
        <div className="home-hero-content">
          <span className="hero-badge">Professional Networking Platform</span>

          <h1>Connect, showcase, and grow professionally.</h1>

          <p>
            ProfessionalHub helps users build a professional profile, connect
            with other professionals, showcase skills, and share projects in one
            simple platform.
          </p>

          <div className="hero-actions">
            <Link href="/signup" className="btn-primary">
              Get Started
            </Link>
            <Link href="/signin" className="btn-outline">
              Sign In
            </Link>
          </div>
        </div>

        <div className="home-preview-card">
          <div className="preview-banner"></div>

          <div className="preview-body">
            <div className="preview-avatar">A</div>

            <h3>Professional Profile</h3>
            <p>Your current headline</p>

            <div className="preview-stats">
              <div>
                <strong>1</strong>
                <span>Connection</span>
              </div>

              <div>
                <strong>6</strong>
                <span>Skills</span>
              </div>

              <div>
                <strong>1</strong>
                <span>Experience</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-features-clean">
        <div className="feature-card">
          <h3>Build Network</h3>
          <p>Send and manage professional connection requests.</p>
        </div>

        <div className="feature-card">
          <h3>Showcase Profile</h3>
          <p>Display your headline, bio, skills, and experience.</p>
        </div>

        <div className="feature-card">
          <h3>Share Projects</h3>
          <p>Add projects to present your practical work.</p>
        </div>
      </section>
    </main>
  );
}
