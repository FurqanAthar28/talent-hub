"use client";

/**
 * Shown when a page crashes while running in the browser (a bug, or bad
 * data from the server). Before, Next.js showed "Application error: a
 * client-side exception has occurred", which told the user nothing.
 *
 * "Try again" re-draws the page without a full reload.
 */

import Link from "next/link";
import { useEffect } from "react";

import StatusPage from "./components/status/StatusPage";
import { ROUTES } from "./config/routes";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep the details for the developer (browser console / server logs).
    console.error("Page crashed:", error);
  }, [error]);

  return (
    <StatusPage
      code="Oops"
      title="Something went wrong on this page"
      text="It's a problem on our side, not something you did. Try again, or go back to your dashboard."
    >
      <button type="button" className="btn-primary" onClick={reset}>
        Try again
      </button>
      <Link href={ROUTES.DASHBOARD} className="btn-outline">
        Go to your dashboard
      </Link>
    </StatusPage>
  );
}
