import Link from "next/link";

import { APP_CONFIG } from "@/app/config/app";
import styles from "./brand.module.css";

/**
 * The app's logo: a "P" mark + the name. Used in the top menu, on the
 * landing page and on the sign-in pages, so it is the same everywhere.
 */
export default function BrandLogo({ href, size = "md" }: { href: string; size?: "md" | "lg" }) {
  return (
    <Link href={href} className={`${styles.logo} ${size === "lg" ? styles.logoLarge : ""}`}>
      <span className={styles.mark} aria-hidden="true">
        P
      </span>
      <span>{APP_CONFIG.NAME}</span>
    </Link>
  );
}
