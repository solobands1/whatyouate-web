import type { Metadata, Viewport } from "next";
import SugarShowdown from "@/components/games/SugarShowdown";

// Set up as a full-screen web app: no zoom, fills the notch area, and "Add to Home Screen" opens it like an app.
// No Safari App Store banner here: it can't be resized or timed, and on a small phone it eats into the board.
// The hub page has it, and the game-over card has its own "Get WhatYouAte" button.
export const metadata: Metadata = {
  title: "Sugar Showdown | WhatYouAte",
  description: "A free food quiz. Two foods, one question: which has more sugar? Play today's 10, or go head to head with a friend.",
  alternates: { canonical: "/games/sugar-showdown" },
  manifest: "/games/sugar-showdown.webmanifest",
  appleWebApp: { capable: true, title: "Sugar Showdown", statusBarStyle: "default" },
  // Link previews describe the games section as a whole, since more games are planned.
  openGraph: {
    title: "WhatYouAte Food Games",
    description: "Quick, free food games. Can you top the scoreboard?",
    siteName: "WhatYouAte",
    type: "website",
    url: "https://whatyouate.app/games/sugar-showdown",
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

export default function SugarShowdownPage() {
  return <SugarShowdown />;
}
