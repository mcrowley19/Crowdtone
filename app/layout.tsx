import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AudienceSignal",
  description:
    "Reads the comments on a public YouTube video and writes back a plan: what to make next, what to fix, and a clearer thumbnail.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
