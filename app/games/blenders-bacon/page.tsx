import type { Metadata, Viewport } from "next";
import BlendersBacon from "@/components/games/BlendersBacon";

// Set up as a full-screen web app: no zoom, fills the notch area, and "Add to Home Screen" opens it like an app.
// No Safari App Store banner here (same as the other games): the game-over card has its own "Get WhatYouAte" button.
export const metadata: Metadata = {
  title: "Blenders & Bacon | WhatYouAte",
  description: "A free food race for two. Roll the die, ride the blenders up the pantry, dodge the bacon. Play the computer, pass one phone, or play live by room code.",
  alternates: { canonical: "/games/blenders-bacon" },
  manifest: "/games/blenders-bacon.webmanifest",
  appleWebApp: { capable: true, title: "Blenders & Bacon", statusBarStyle: "default" },
  // Link previews show this game (public/og/game-blenders-bacon.png, drawn by ~/dev/whatyouate-marketing/games/og.py).
  openGraph: {
    title: "Play Blenders & Bacon With Me",
    description: "Race me up the pantry. Blenders whirl you up, bacon slides you down. No app needed, free in your browser.",
    siteName: "WhatYouAte",
    type: "website",
    url: "https://whatyouate.app/games/blenders-bacon",
    images: [{ url: "/og/game-blenders-bacon.png", width: 1200, height: 630, alt: "Blenders & Bacon, a free WhatYouAte game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Play Blenders & Bacon With Me",
    description: "Race me up the pantry. Blenders whirl you up, bacon slides you down. No app needed, free in your browser.",
    images: ["/og/game-blenders-bacon.png"],
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

export default function BlendersBaconPage() {
  return <BlendersBacon />;
}
