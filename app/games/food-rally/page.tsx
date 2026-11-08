import type { Metadata, Viewport } from "next";
import FoodRally from "@/components/games/FoodRally";

// Set up as a full-screen web app: no zoom, fills the notch area, and "Add to Home Screen" opens it like an app.
// No Safari App Store banner here: it can't be resized or timed, and on a small phone it eats into the board.
// The hub page has it, and the game-over card has its own "Get WhatYouAte" button.
export const metadata: Metadata = {
  title: "Food Rally | WhatYouAte",
  description: "A free food game. Race little food cars round six kitchen courses. Play the computer, a friend live, or on one phone.",
  alternates: { canonical: "/games/food-rally" },
  manifest: "/games/food-rally.webmanifest",
  appleWebApp: { capable: true, title: "Food Rally", statusBarStyle: "default" },
  // Link previews show this game (public/og/game-<slug>.png, drawn by ~/dev/whatyouate-marketing/games/og.py), so invites and score shares look like it.
  openGraph: {
    title: "Play Food Rally With Me",
    description: "Race a carrot, a donut or a watermelon round the kitchen. Race me live, no app needed. Free in your browser.",
    siteName: "WhatYouAte",
    type: "website",
    url: "https://whatyouate.app/games/food-rally",
    images: [{ url: "/og/game-food-rally.png", width: 1200, height: 630, alt: "Food Rally, a free WhatYouAte game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Play Food Rally With Me",
    description: "Race a carrot, a donut or a watermelon round the kitchen. Race me live, no app needed. Free in your browser.",
    images: ["/og/game-food-rally.png"],
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

export default function FoodRallyPage() {
  return <FoodRally />;
}
