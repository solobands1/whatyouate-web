import type { Metadata, Viewport } from "next";
import FoodFling from "@/components/games/FoodFling";

// Set up as a full-screen web app: no zoom, fills the notch area, and "Add to Home Screen" opens it like an app.
// No Safari App Store banner here: it can't be resized or timed, and on a small phone it eats into the board.
// The hub page has it, and the game-over card has its own "Get WhatYouAte" button.
export const metadata: Metadata = {
  title: "Food Fling | WhatYouAte",
  description: "A free food game. Fling fruit at towers of junk food and knock every snack off its shelf with three throws.",
  alternates: { canonical: "/games/food-fling" },
  manifest: "/games/food-fling.webmanifest",
  appleWebApp: { capable: true, title: "Food Fling", statusBarStyle: "default" },
  // Link previews show this game (public/og/game-<slug>.png, drawn by ~/dev/whatyouate-marketing/games/og.py), so invites and score shares look like it.
  openGraph: {
    title: "Food Fling: Can You Beat My Score?",
    description: "Fling fruit at towers of junk food. Three throws a level. Free in your browser.",
    siteName: "WhatYouAte",
    type: "website",
    url: "https://whatyouate.app/games/food-fling",
    images: [{ url: "/og/game-food-fling.png", width: 1200, height: 630, alt: "Food Fling, a free WhatYouAte game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Food Fling: Can You Beat My Score?",
    description: "Fling fruit at towers of junk food. Three throws a level. Free in your browser.",
    images: ["/og/game-food-fling.png"],
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

export default function FoodFlingPage() {
  return <FoodFling />;
}
