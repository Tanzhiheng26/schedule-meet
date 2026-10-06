import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "schedule-meet",
  description: "Find a meeting time that works for everyone, then send the calendar invitation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            schedule<span>·</span>meet
          </Link>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
