import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#6FA8FF",
};

const TITLE = "WhatYouAte — Eat. Reflect. Feel better.";
/** Shown above the domain in link previews. The card already carries the
 *  wordmark and the domain sits right underneath, so the brand is not
 *  repeated a third time here. */
const SHARE_TITLE = "Eat | Reflect | Feel Better";
const DESCRIPTION =
  "Find the link between what you eat and how you feel. Log a meal in seconds, check in for a minute at night, and your coach shows you what lines up.";

export const metadata: Metadata = {
  metadataBase: new URL("https://whatyouate.app"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: SHARE_TITLE,
    description: DESCRIPTION,
    url: "https://whatyouate.app",
    siteName: "WhatYouAte",
    type: "website",
    locale: "en_CA",
    images: [
      {
        url: "/og-v2.png",
        width: 1200,
        height: 630,
        alt: "WhatYouAte. Know why you feel the way you do.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: DESCRIPTION,
    images: ["/og-v2.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
