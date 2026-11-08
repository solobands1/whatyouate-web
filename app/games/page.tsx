import type { Metadata, Viewport } from "next";
import SnackMerge from "@/components/games/SnackMerge";

// Hidden for now: not linked anywhere, left out of the sitemap, and kept out of search (robots.ts + noindex).
// Set up as a full-screen web app: no zoom, fills the notch area, and "Add to Home Screen" opens it like an app.
export const metadata: Metadata = {
  title: "Snack Merge | WhatYouAte",
  description: "Match two foods to grow them. Reach the Power Bowl.",
  robots: { index: false, follow: false },
  manifest: "/games/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Snack Merge", statusBarStyle: "default" },
  // Link previews describe the games section as a whole, since more games are planned.
  openGraph: {
    title: "WhatYouAte Food Games",
    description: "Quick, free food games. Can you top the scoreboard?",
    siteName: "WhatYouAte",
    type: "website",
    url: "https://whatyouate.app/games",
    images: [{ url: "/og-games.png", width: 1200, height: 630, alt: "WhatYouAte Food Games" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "WhatYouAte Food Games",
    description: "Quick, free food games. Can you top the scoreboard?",
    images: ["/og-games.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#e3effe",
};

export default function GamesPage() {
  return <SnackMerge />;
}
