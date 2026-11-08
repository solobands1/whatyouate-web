import type { Metadata, Viewport } from "next";
import KitchenGolf from "@/components/games/KitchenGolf";

// Set up as a full-screen web app: no zoom, fills the notch area, and "Add to Home Screen" opens it like an app.
// No Safari App Store banner here: it can't be resized or timed, and on a small phone it eats into the board.
// The hub page has it, and the game-over card has its own "Get WhatYouAte" button.
export const metadata: Metadata = {
  title: "Kitchen Golf | WhatYouAte",
  description: "A free food game. Putt a meatball round kitchen mini golf holes: the sink, spatula ramps, a spinning mixer. Play the computer or a friend.",
  alternates: { canonical: "/games/kitchen-golf" },
  manifest: "/games/kitchen-golf.webmanifest",
  appleWebApp: { capable: true, title: "Kitchen Golf", statusBarStyle: "default" },
  // Link previews show this game (public/og/game-<slug>.png, drawn by ~/dev/whatyouate-marketing/games/og.py), so invites and score shares look like it.
  openGraph: {
    title: "Play Kitchen Golf With Me",
    description: "Mini golf with a meatball, round the kitchen sink. Play me live, no app needed. Free in your browser.",
    siteName: "WhatYouAte",
    type: "website",
    url: "https://whatyouate.app/games/kitchen-golf",
    images: [{ url: "/og/game-kitchen-golf.png", width: 1200, height: 630, alt: "Kitchen Golf, a free WhatYouAte game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Play Kitchen Golf With Me",
    description: "Mini golf with a meatball, round the kitchen sink. Play me live, no app needed. Free in your browser.",
    images: ["/og/game-kitchen-golf.png"],
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

export default function KitchenGolfPage() {
  return <KitchenGolf />;
}
