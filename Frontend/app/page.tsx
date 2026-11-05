import Link from "next/link";
import { Check } from "lucide-react";

import BrandLogo from "./components/brand/BrandLogo";
import ProductPreview from "./components/marketing/ProductPreview";
import styles from "./components/marketing/marketing.module.css";
import { APP_CONFIG } from "./config/app";
import { ROUTES } from "./config/routes";

// What each kind of user can do. Plain words, no buzzwords.
const FOR_CANDIDATES = [
  "Show your skills, projects and work experience on one profile.",
  "See exactly what's missing before recruiters look at you.",
  "Share your CV only with people you choose to connect with.",
];

const FOR_RECRUITERS = [
  "Search candidates by skill, city, or who is open to work.",
  "Open a candidate's projects, experience and CV in one place.",
  "Connect and message candidates without leaving the app.",
];

function AudienceList({ items }: { items: string[] }) {
  return (
    <ul className={styles.audienceList}>
      {items.map((item) => (
        <li key={item}>
          <Check size={18} aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/** The public front page. Signed-in visitors use the dashboard instead. */
export default function HomePage() {
  return (
    <div className={styles.landing}>
      <nav className={styles.landingNav} aria-label="Main">
        <BrandLogo href={ROUTES.HOME} size="lg" />
        <div className={styles.landingNavActions}>
          <Link href={ROUTES.SIGNIN} className="btn-outline">
            Sign in
          </Link>
          <Link href={ROUTES.SIGNUP} className="btn-primary">
            Create account
          </Link>
        </div>
      </nav>

      <main>
        <section className={styles.hero}>
          <div>
            <h1 className={styles.heroTitle}>Show recruiters what you can build.</h1>
            <p className={styles.heroText}>
              {`${APP_CONFIG.NAME} turns your skills, projects and experience into one clear profile, and helps recruiters find the people they're looking for.`}
            </p>
            <div className={styles.heroActions}>
              <Link href={ROUTES.SIGNUP} className="btn-primary">
                Create your profile
              </Link>
              <Link href={ROUTES.SIGNIN} className="btn-outline">
                Sign in
              </Link>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <ProductPreview />
          </div>
        </section>

        <section className={styles.audiences}>
          <div className={styles.audiencesInner}>
            <div>
              <h2 className={styles.audienceTitle}>For candidates</h2>
              <p className={styles.audienceText}>Get your profile ready, then get found.</p>
              <AudienceList items={FOR_CANDIDATES} />
            </div>
            <div>
              <h2 className={styles.audienceTitle}>For recruiters</h2>
              <p className={styles.audienceText}>Find people by what they can actually do.</p>
              <AudienceList items={FOR_RECRUITERS} />
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        © {new Date().getFullYear()} {APP_CONFIG.NAME}
      </footer>
    </div>
  );
}
