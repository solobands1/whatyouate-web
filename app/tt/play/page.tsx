import type { Metadata } from "next";
import ShortLink from "../../../components/ShortLink";

// Bio link: whatyouate.app/tt/play. Counts the visit, then goes on (see components/ShortLink.tsx and SHORT_LINKS in
// components/track.ts). Kept out of search and out of the sitemap.
export const metadata: Metadata = {
  title: "Food Games | WhatYouAte",
  robots: { index: false, follow: false },
};

export default function TtPlayShortLinkPage() {
  return <ShortLink from="/tt/play" />;
}
