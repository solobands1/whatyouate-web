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
const DESCRIPTION =
  "Find the link between what you eat and how you feel. Log a meal in seconds, check in for a minute at night, and your coach shows you what lines up.";

export const metadata: Metadata = {
  metadataBase: new URL("https://whatyouate.app"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://whatyouate.app",
    siteName: "WhatYouAte",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
