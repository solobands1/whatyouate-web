import type { Metadata, Viewport } from "next";
import SnackMerge from "@/components/games/SnackMerge";

// Set up as a full-screen web app: no zoom, fills the notch area, and "Add to Home Screen" opens it like an app.
// No Safari App Store banner here: it can't be resized or timed, and on a small phone it eats into the board.
// The hub page has it, and the game-over card has its own "Get WhatYouAte" button.
export const metadata: Metadata = {
  title: "Snack Merge | WhatYouAte",
  description: "A free food merge game. Match two foods to grow them, reach the Power Bowl, and top today's scoreboard.",
  alternates: { canonical: "/games/snack-merge" },
  manifest: "/games/snack-merge.webmanifest",
  appleWebApp: { capable: true, title: "Snack Merge", statusBarStyle: "default" },
  // Link previews show this game (public/og/game-<slug>.png, drawn by ~/dev/whatyouate-marketing/games/og.py), so invites and score shares look like it.
  openGraph: {
    title: "Snack Merge: Can You Beat My Score?",
    description: "Match two foods to grow them. Can you reach the Power Bowl? Free in your browser.",
    siteName: "WhatYouAte",
    type: "website",
    url: "https://whatyouate.app/games/snack-merge",
    images: [{ url: "/og/game-snack-merge.png", width: 1200, height: 630, alt: "Snack Merge, a free WhatYouAte game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Snack Merge: Can You Beat My Score?",
    description: "Match two foods to grow them. Can you reach the Power Bowl? Free in your browser.",
    images: ["/og/game-snack-merge.png"],
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

export default function SnackMergePage() {
  return <SnackMerge />;
}
