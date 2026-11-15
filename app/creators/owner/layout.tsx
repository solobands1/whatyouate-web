import type { Metadata } from "next";
import type { ReactNode } from "react";

// The owner pages get their own icon (the WhatYouAte tile with a bar chart instead of the plate), so the owner
// dashboard is easy to tell apart from the site and the app: in the browser tab, and on a phone home screen when saved
// as a web app (apple-touch-icon for iOS, plus a small manifest that opens straight to the owner dashboard). Setting
// `icons` here replaces the site's icons (declared in app/layout.tsx) for these pages only.
export const metadata: Metadata = {
  icons: {
    icon: [{ url: "/owner-icon.png", type: "image/png", sizes: "64x64" }],
    apple: [{ url: "/owner-apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  manifest: "/owner.webmanifest",
  appleWebApp: { capable: true, title: "WYA Owner", statusBarStyle: "default" },
};

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return children;
}
