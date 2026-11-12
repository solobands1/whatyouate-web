import type { Metadata } from "next";
import ShortLink from "../../components/ShortLink";

// Short link: whatyouate.app/play. Counts the visit, then goes on (see components/ShortLink.tsx). Kept out of search
// and out of the sitemap.
export const metadata: Metadata = {
  title: "Food Games | WhatYouAte",
  robots: { index: false, follow: false },
};

export default function PlayShortLinkPage() {
  return <ShortLink from="/play" />;
}
