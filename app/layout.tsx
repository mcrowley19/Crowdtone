import type { Metadata } from "next";
import "./globals.css";
import "./features.css";

export const metadata: Metadata = {
  title: "AudienceSignal",
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
