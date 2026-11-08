import type { Metadata, Viewport } from "next";
import BerryDash from "@/components/games/BerryDash";

// Set up as a full-screen web app: no zoom, fills the notch area, and "Add to Home Screen" opens it like an app.
// No Safari App Store banner here: it can't be resized or timed, and on a small phone it eats into the board.
// The hub page has it, and the game-over card has its own "Get WhatYouAte" button.
export const metadata: Metadata = {
  title: "Berry Dash | WhatYouAte",
  description: "A free food game. Run a strawberry along the kitchen counter, jump the salt shaker, duck the bees and grab blueberries. Watch out for candy.",
  alternates: { canonical: "/games/berry-dash" },
  manifest: "/games/berry-dash.webmanifest",
  appleWebApp: { capable: true, title: "Berry Dash", statusBarStyle: "default" },
  // Link previews show this game (public/og/game-<slug>.png, drawn by ~/dev/whatyouate-marketing/games/og.py), so invites and score shares look like it.
  openGraph: {
    title: "Berry Dash: Can You Beat My Score?",
    description: "Run the kitchen counter. Jump, duck and grab the blueberries. Free in your browser.",
    siteName: "WhatYouAte",
    type: "website",
    url: "https://whatyouate.app/games/berry-dash",
    images: [{ url: "/og/game-berry-dash.png", width: 1200, height: 630, alt: "Berry Dash, a free WhatYouAte game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Berry Dash: Can You Beat My Score?",
    description: "Run the kitchen counter. Jump, duck and grab the blueberries. Free in your browser.",
    images: ["/og/game-berry-dash.png"],
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

export default function BerryDashPage() {
  return <BerryDash />;
}
