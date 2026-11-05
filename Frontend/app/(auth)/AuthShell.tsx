import type { ReactNode } from "react";

import BrandLogo from "@/app/components/brand/BrandLogo";
import ProductPreview from "@/app/components/marketing/ProductPreview";
import styles from "@/app/components/marketing/marketing.module.css";
import { ROUTES } from "@/app/config/routes";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

/**
 * The frame around sign-in, sign-up, verify email and forgot password.
 *
 *   Big screens:  [ logo + one sentence + product picture ] [ the form ]
 *   Phones:       [ logo ] then the form (the picture is hidden)
 */
export default function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className={styles.auth}>
      <aside className={styles.authAside}>
        <BrandLogo href={ROUTES.HOME} />
        {/* The sentence and the picture stay together, in the middle. */}
        <div className={styles.authAsideMiddle}>
          <p className={styles.authAsideText}>Show recruiters what you can build.</p>
          <ProductPreview />
        </div>
        <p className={styles.authAsideNote}>
          Build your profile, connect with people in your field, and get found by recruiters.
        </p>
      </aside>

      <main className={styles.authMain}>
        <div className={styles.authForm}>
          <div className={styles.authMobileLogo}>
            <BrandLogo href={ROUTES.HOME} />
          </div>
          <h1 className={styles.authTitle}>{title}</h1>
          <p className={styles.authSubtitle}>{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
