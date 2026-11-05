import type { ReactNode } from "react";

import BrandLogo from "@/app/components/brand/BrandLogo";
import { ROUTES } from "@/app/config/routes";
import styles from "./status.module.css";

/**
 * A full-page message with our logo: used for "Page not found" (404) and
 * "Something went wrong". Before, Next.js showed its own plain black-and-white
 * page, which looked like the site was broken.
 */
export default function StatusPage({
  code,
  title,
  text,
  children,
}: {
  code: string; // the big faded number, e.g. "404"
  title: string;
  text: string;
  children: ReactNode; // the buttons
}) {
  return (
    <main className={styles.page}>
      <BrandLogo href={ROUTES.HOME} />
      <div className={styles.card}>
        <p className={styles.code} aria-hidden="true">
          {code}
        </p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>{text}</p>
        <div className={styles.actions}>{children}</div>
      </div>
    </main>
  );
}
