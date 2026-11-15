import type { Metadata } from "next";
import type { ReactNode } from "react";

// The owner pages get their own tab icon (the WhatYouAte tile with a bar chart instead of the plate), so the owner
// dashboard is easy to tell apart from the site and the app. Setting `icons` here replaces the site's icons (declared
// in app/layout.tsx) for these pages only.
export const metadata: Metadata = {
  icons: {
    icon: [{ url: "/owner-icon.png", type: "image/png", sizes: "64x64" }],
  },
};

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return children;
}
