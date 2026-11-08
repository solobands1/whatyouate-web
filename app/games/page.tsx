import type { Metadata } from "next";
import SnackMerge from "@/components/games/SnackMerge";

// Hidden for now: not linked anywhere, left out of the sitemap, and kept out of search (robots.ts + noindex).
export const metadata: Metadata = {
  title: "Snack Merge | WhatYouAte",
  description: "Match two foods to grow them. Reach the Power Bowl.",
  robots: { index: false, follow: false },
};

export default function GamesPage() {
  return <SnackMerge />;
}
