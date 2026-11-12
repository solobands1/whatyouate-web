import type { Metadata } from "next";
import ShortLink from "../../../components/ShortLink";

// Bio link: whatyouate.app/ig/play. Counts the visit, then goes on (see components/ShortLink.tsx and SHORT_LINKS in
// components/track.ts). Kept out of search and out of the sitemap.
export const metadata: Metadata = {
  title: "Food Games | WhatYouAte",
  robots: { index: false, follow: false },
};

export default function IgPlayShortLinkPage() {
  return <ShortLink from="/ig/play" />;
}
