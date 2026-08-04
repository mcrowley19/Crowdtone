import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AudienceSignal — comments in, next video out",
  description:
    "Pull real YouTube comments, cluster them into themes, and get a ranked next-video brief, concrete fixes, and regenerated thumbnails.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
