import type { Metadata, Viewport } from "next";
import BerryPong from "@/components/games/BerryPong";

// Set up as a full-screen web app: no zoom, fills the notch area, and "Add to Home Screen" opens it like an app.
// No Safari App Store banner here (same as the other games): the game-over card has its own "Get WhatYouAte" button.
export const metadata: Metadata = {
  title: "Berry Pong | WhatYouAte",
  description: "A free flicking game for two. Flick blueberries into the other side's cereal bowls. Play the computer, pass one phone, or play live by room code.",
  alternates: { canonical: "/games/berry-pong" },
  manifest: "/games/berry-pong.webmanifest",
  appleWebApp: { capable: true, title: "Berry Pong", statusBarStyle: "default" },
  // Link previews show this game (public/og/game-berry-pong.png, drawn by ~/dev/whatyouate-marketing/games/og.py).
  openGraph: {
    title: "Play Berry Pong With Me",
    description: "Flick blueberries into my cereal bowls before I sink yours. No app needed, free in your browser.",
    siteName: "WhatYouAte",
    type: "website",
    url: "https://whatyouate.app/games/berry-pong",
    images: [{ url: "/og/game-berry-pong.png", width: 1200, height: 630, alt: "Berry Pong, a free WhatYouAte game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Play Berry Pong With Me",
    description: "Flick blueberries into my cereal bowls before I sink yours. No app needed, free in your browser.",
    images: ["/og/game-berry-pong.png"],
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

export default function BerryPongPage() {
  return <BerryPong />;
}
