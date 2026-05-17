import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "WhatYouAte — AI Nutrition & Macro Tracker",
  description: "Log meals in seconds. Understand your body. Feel the difference. AI-powered food logging for iPhone.",
  openGraph: {
    title: "WhatYouAte — AI Nutrition & Macro Tracker",
    description: "Log meals in seconds. Understand your body. Feel the difference.",
    url: "https://whatyouate.app",
    siteName: "WhatYouAte",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
