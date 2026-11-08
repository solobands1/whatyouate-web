import type { Metadata, Viewport } from "next";
import FridgeRaid from "@/components/games/FridgeRaid";

// Set up as a full-screen web app: no zoom, fills the notch area, and "Add to Home Screen" opens it like an app.
// No Safari App Store banner here: it can't be resized or timed, and on a small phone it eats into the board.
// The hub page has it, and the game-over card has its own "Get WhatYouAte" button.
export const metadata: Metadata = {
  title: "Fridge Raid | WhatYouAte",
  description: "A free food game for two. Hide your snacks in the fridge and guess where your friend hid theirs. Play the computer, pass one phone, or play live by room code.",
  alternates: { canonical: "/games/fridge-raid" },
  manifest: "/games/fridge-raid.webmanifest",
  appleWebApp: { capable: true, title: "Fridge Raid", statusBarStyle: "default" },
  // Link previews show this game (public/og/game-<slug>.png, drawn by ~/dev/whatyouate-marketing/games/og.py), so invites and score shares look like it.
  openGraph: {
    title: "Play Fridge Raid With Me",
    description: "Hide your snacks, hunt for mine. Play me live, no app needed. Free in your browser.",
    siteName: "WhatYouAte",
    type: "website",
    url: "https://whatyouate.app/games/fridge-raid",
    images: [{ url: "/og/game-fridge-raid.png", width: 1200, height: 630, alt: "Fridge Raid, a free WhatYouAte game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Play Fridge Raid With Me",
    description: "Hide your snacks, hunt for mine. Play me live, no app needed. Free in your browser.",
    images: ["/og/game-fridge-raid.png"],
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

export default function FridgeRaidPage() {
  return <FridgeRaid />;
}
