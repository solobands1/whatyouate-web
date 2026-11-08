import type { Metadata, Viewport } from "next";
import PeaTanks from "@/components/games/PeaTanks";

// Set up as a full-screen web app: no zoom, fills the notch area, and "Add to Home Screen" opens it like an app.
// No Safari App Store banner here: it can't be resized or timed, and on a small phone it eats into the board.
// The hub page has it, and the game-over card has its own "Get WhatYouAte" button.
export const metadata: Metadata = {
  title: "Pea Tanks | WhatYouAte",
  description: "A free food game. Drive a lunchbox around the kitchen table and fire peas. Play the computer, a friend live, or on one phone.",
  alternates: { canonical: "/games/pea-tanks" },
  manifest: "/games/pea-tanks.webmanifest",
  appleWebApp: { capable: true, title: "Pea Tanks", statusBarStyle: "default" },
  // Link previews show this game (public/og/game-<slug>.png, drawn by ~/dev/whatyouate-marketing/games/og.py), so invites and score shares look like it.
  openGraph: {
    title: "Play Pea Tanks With Me",
    description: "Drive, dodge and fire peas around the kitchen table. Play me live, no app needed. Free in your browser.",
    siteName: "WhatYouAte",
    type: "website",
    url: "https://whatyouate.app/games/pea-tanks",
    images: [{ url: "/og/game-pea-tanks.png", width: 1200, height: 630, alt: "Pea Tanks, a free WhatYouAte game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Play Pea Tanks With Me",
    description: "Drive, dodge and fire peas around the kitchen table. Play me live, no app needed. Free in your browser.",
    images: ["/og/game-pea-tanks.png"],
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

export default function PeaTanksPage() {
  return <PeaTanks />;
}
