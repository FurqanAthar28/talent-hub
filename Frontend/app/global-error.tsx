"use client";

/**
 * The last safety net: used only if the ROOT layout itself crashes
 * (app/error.tsx can't help then, because it lives inside that layout).
 * It must draw its own <html> and <body>.
 */

import { useEffect } from "react";

import StatusPage from "./components/status/StatusPage";
import "./globals.css";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("App crashed:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <StatusPage
          code="Oops"
          title="The app couldn't load"
          text="Something went wrong on our side. Please try again in a moment."
        >
          <button type="button" className="btn-primary" onClick={reset}>
            Try again
          </button>
        </StatusPage>
      </body>
    </html>
  );
}
