import type { Metadata } from "next";
import ShortLink from "../../../components/ShortLink";

// Bio link: whatyouate.app/yt/creators. Counts the visit, then goes on (see components/ShortLink.tsx and SHORT_LINKS in
// components/track.ts). Kept out of search and out of the sitemap.
export const metadata: Metadata = {
  title: "Creators Program | WhatYouAte",
  robots: { index: false, follow: false },
};

export default function YtCreatorsShortLinkPage() {
  return <ShortLink from="/yt/creators" />;
}
