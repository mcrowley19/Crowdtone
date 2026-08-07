import type { Metadata } from "next";
import "./globals.css";
import "./features.css";
import "./dashboard.css";
import "./landing.css";

// Open Graph images have to be absolute URLs. Vercel supplies the deployment
// host at build time; NEXT_PUBLIC_SITE_URL overrides it for a custom domain.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Crowdtone",
  description:
    "Reads the comments on a public YouTube video and writes back a plan: what to make next, what to fix, and a clearer thumbnail.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="no-js">
      <head>
        {/* Drop the no-js guard as early as possible so reveals can animate. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.remove('no-js')",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
