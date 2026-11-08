import type { Metadata, Viewport } from "next";
import PatsLawnmower from "@/components/games/PatsLawnmower";

// A private game for family and friends: not in the games list, the menu, the sitemap or robots.txt, and kept out of
// search. Link previews show the game's own drawing (public/og/pat.png), never a photo of the property.
const DESC = "Help Pat finish the lawn before the cat gets in the way.";
export const metadata: Metadata = {
  title: "Pat's Lawnmower",
  description: DESC,
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  openGraph: {
    title: "Pat's Lawnmower",
    description: DESC,
    type: "website",
    url: "https://whatyouate.app/games/pat",
    images: [{ url: "/og/pat.png", width: 1200, height: 630, alt: "Pat's Lawnmower: Pat on an orange lawn tractor mowing stripes, with the grey cat nearby" }],
  },
  twitter: { card: "summary_large_image", title: "Pat's Lawnmower", description: DESC, images: ["/og/pat.png"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#eef6e3",
};

export default function PatPage() {
  return <PatsLawnmower />;
}
