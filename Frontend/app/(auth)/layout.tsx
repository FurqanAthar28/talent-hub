import type { ReactNode } from "react";

/**
 * Layout for the sign-in / sign-up pages.
 * Each page already has its own <main>, and a page may only have ONE <main>,
 * so this layout just shows the page as it is.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
