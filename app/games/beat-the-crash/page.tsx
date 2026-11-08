import type { Metadata, Viewport } from "next";
import BeatTheCrash from "@/components/games/BeatTheCrash";

// Set up as a full-screen web app: no zoom, fills the notch area, and "Add to Home Screen" opens it like an app.
// No Safari App Store banner here: it can't be resized or timed, and on a small phone it eats into the board.
// The hub page has it, and the game-over card has its own "Get WhatYouAte" button.
export const metadata: Metadata = {
  title: "Beat The Crash | WhatYouAte",
  description: "A free food game. Eat your way from 7am to 10pm without crashing: real food keeps you steady, sugar spikes then crashes.",
  alternates: { canonical: "/games/beat-the-crash" },
  manifest: "/games/beat-the-crash.webmanifest",
  appleWebApp: { capable: true, title: "Beat The Crash", statusBarStyle: "default" },
  // Link previews show this game (public/og/game-<slug>.png, drawn by ~/dev/whatyouate-marketing/games/og.py), so invites and score shares look like it.
  openGraph: {
    title: "Beat The Crash: Can You Beat My Score?",
    description: "Eat your way to 10pm without crashing. Real food keeps you steady. Free in your browser.",
    siteName: "WhatYouAte",
    type: "website",
    url: "https://whatyouate.app/games/beat-the-crash",
    images: [{ url: "/og/game-beat-the-crash.png", width: 1200, height: 630, alt: "Beat The Crash, a free WhatYouAte game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Beat The Crash: Can You Beat My Score?",
    description: "Eat your way to 10pm without crashing. Real food keeps you steady. Free in your browser.",
    images: ["/og/game-beat-the-crash.png"],
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

export default function BeatTheCrashPage() {
  return <BeatTheCrash />;
}
