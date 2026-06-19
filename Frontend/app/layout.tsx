import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "ProfessionalHub",
  description: "Connect and grow your professional network",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}