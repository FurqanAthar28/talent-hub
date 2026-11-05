import type { Metadata } from "next";
import Link from "next/link";

import StatusPage from "./components/status/StatusPage";
import { ROUTES } from "./config/routes";

/** Shown for any address that doesn't exist (and for notFound() calls). */
export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="This page doesn't exist"
      text="The link may be old, or the address may have a typo. Your account and data are fine."
    >
      <Link href={ROUTES.DASHBOARD} className="btn-primary">
        Go to your dashboard
      </Link>
      <Link href={ROUTES.HOME} className="btn-outline">
        Home page
      </Link>
    </StatusPage>
  );
}
