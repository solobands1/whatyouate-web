import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import Tracker from "../components/Tracker";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#6FA8FF",
};

const TITLE = "WhatYouAte | Eat. Reflect. Feel Better";
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
    // No url here: pages inherit this preview, and it would point every one of them at the homepage.
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
  // Declared here rather than as app/favicon.ico + app/icon.png, because Next adds a file-based favicon.ico to every
  // page and nothing can take it off. Declared, a section can replace them: the owner pages use their own icon
  // (app/creators/owner/layout.tsx). Same files and sizes as before, served from public/.
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon", sizes: "16x16" },
      { url: "/icon.png", type: "image/png", sizes: "64x64" },
    ],
    // Home screen icon when the site is saved to a phone: the app's own App Store icon (a full square; iOS rounds it).
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  appleWebApp: { title: "WhatYouAte" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} antialiased`}>
      <body>
        {children}
        <Tracker />
      </body>
    </html>
  );
}
