import type { Metadata } from "next";
import BioPage from "../../components/BioPage";

// TikTok's bio link: whatyouate.app/tt. A landing page with three buttons (the app, the games, the creator program);
// see components/BioPage.tsx. Kept out of search and out of the sitemap.
export const metadata: Metadata = {
  title: "WhatYouAte",
  robots: { index: false, follow: false },
};

export default function TtBioPage() {
  return <BioPage from="/tt" />;
}
