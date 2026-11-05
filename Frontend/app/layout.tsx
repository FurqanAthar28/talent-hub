import type { Metadata } from "next";
import type { ReactNode } from "react";

import { APP_CONFIG } from "./config/app";
import "./globals.css";

/**
 * The browser tab title and search-engine description for every page.
 * A page can set its own title (for example "Messages"); the template
 * turns it into "Messages | ProfessionalHub".
 */
export const metadata: Metadata = {
  title: {
    default: APP_CONFIG.NAME,
    template: `%s | ${APP_CONFIG.NAME}`,
  },
  description: APP_CONFIG.DESCRIPTION,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
