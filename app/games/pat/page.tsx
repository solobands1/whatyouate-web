import type { Metadata, Viewport } from "next";
import MovePat from "./MovePat";

// Pat's Lawnmower now lives on its own site (minimul.app/pat). This old address only forwards there, carrying Pat's
// saved progress (MovePat). Kept out of search. To be removed once Pat has moved over.
const DESC = "Help Pat finish the lawn before the cat gets in the way.";
export const metadata: Metadata = {
  title: "Pat's Lawnmower",
  description: DESC,
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  openGraph: {
    title: "Pat's Lawnmower",
    description: DESC,
    type: "website",
    url: "https://minimul.app/pat",
    images: [{ url: "/og/pat.png", width: 1200, height: 630, alt: "Pat's Lawnmower: Pat on an orange lawn tractor mowing stripes, with Willy The Cat nearby" }],
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
  return <MovePat />;
}
