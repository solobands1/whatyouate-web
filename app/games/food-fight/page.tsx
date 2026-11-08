import type { Metadata, Viewport } from "next";
import FoodFight from "@/components/games/FoodFight";

// Set up as a full-screen web app: no zoom, fills the notch area, and "Add to Home Screen" opens it like an app.
// No Safari App Store banner here: it can't be resized or timed, and on a small phone it eats into the board.
// The hub page has it, and the game-over card has its own "Get WhatYouAte" button.
export const metadata: Metadata = {
  title: "Food Fight | WhatYouAte",
  description: "A free food game. Throw apples, watermelons and blueberries at the other picnic basket. Play the computer or a friend.",
  alternates: { canonical: "/games/food-fight" },
  manifest: "/games/food-fight.webmanifest",
  appleWebApp: { capable: true, title: "Food Fight", statusBarStyle: "default" },
  // Link previews show this game (public/og/game-<slug>.png, drawn by ~/dev/whatyouate-marketing/games/og.py), so invites and score shares look like it.
  openGraph: {
    title: "Play Food Fight With Me",
    description: "Lob food at each other's picnic basket. Play me live, no app needed. Free in your browser.",
    siteName: "WhatYouAte",
    type: "website",
    url: "https://whatyouate.app/games/food-fight",
    images: [{ url: "/og/game-food-fight.png", width: 1200, height: 630, alt: "Food Fight, a free WhatYouAte game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Play Food Fight With Me",
    description: "Lob food at each other's picnic basket. Play me live, no app needed. Free in your browser.",
    images: ["/og/game-food-fight.png"],
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

export default function FoodFightPage() {
  return <FoodFight />;
}
