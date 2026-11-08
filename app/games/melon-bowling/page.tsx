import type { Metadata, Viewport } from "next";
import MelonBowling from "@/components/games/MelonBowling";

// Set up as a full-screen web app: no zoom, fills the notch area, and "Add to Home Screen" opens it like an app.
// No Safari App Store banner here: it can't be resized or timed, and on a small phone it eats into the board.
// The hub page has it, and the game-over card has its own "Get WhatYouAte" button.
export const metadata: Metadata = {
  title: "Melon Bowling | WhatYouAte",
  description: "A free food game. Roll a watermelon down the kitchen counter at ten soda and juice bottles, with real bowling scoring. Play the computer or a friend.",
  alternates: { canonical: "/games/melon-bowling" },
  manifest: "/games/melon-bowling.webmanifest",
  appleWebApp: { capable: true, title: "Melon Bowling", statusBarStyle: "default" },
  // Link previews show this game (public/og/game-<slug>.png, drawn by ~/dev/whatyouate-marketing/games/og.py), so invites and score shares look like it.
  openGraph: {
    title: "Play Melon Bowling With Me",
    description: "Roll a watermelon at soda bottles. Bowl me live, no app needed. Free in your browser.",
    siteName: "WhatYouAte",
    type: "website",
    url: "https://whatyouate.app/games/melon-bowling",
    images: [{ url: "/og/game-melon-bowling.png", width: 1200, height: 630, alt: "Melon Bowling, a free WhatYouAte game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Play Melon Bowling With Me",
    description: "Roll a watermelon at soda bottles. Bowl me live, no app needed. Free in your browser.",
    images: ["/og/game-melon-bowling.png"],
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

export default function MelonBowlingPage() {
  return <MelonBowling />;
}
