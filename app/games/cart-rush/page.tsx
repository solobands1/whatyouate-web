import type { Metadata, Viewport } from "next";
import CartRush from "@/components/games/CartRush";

// Set up as a full-screen web app: no zoom, fills the notch area, and "Add to Home Screen" opens it like an app.
// No Safari App Store banner here: it can't be resized or timed, and on a small phone it eats into the board.
// The hub page has it, and the game-over card has its own "Get WhatYouAte" button.
export const metadata: Metadata = {
  title: "Cart Rush | WhatYouAte",
  description: "A free food game. Push your cart up the aisle, grab what's on the recipe card and dodge the spills.",
  alternates: { canonical: "/games/cart-rush" },
  manifest: "/games/cart-rush.webmanifest",
  appleWebApp: { capable: true, title: "Cart Rush", statusBarStyle: "default" },
  // Link previews describe the games section as a whole, since more games are planned.
  openGraph: {
    title: "WhatYouAte Food Games",
    description: "Quick, free food games. Can you top the scoreboard?",
    siteName: "WhatYouAte",
    type: "website",
    url: "https://whatyouate.app/games/cart-rush",
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

export default function CartRushPage() {
  return <CartRush />;
}
