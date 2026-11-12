import type { Metadata } from "next";
import ShortLink from "../../../components/ShortLink";

// Bio link: whatyouate.app/ig/app. Counts the visit, then goes on (see components/ShortLink.tsx and SHORT_LINKS in
// components/track.ts). Kept out of search and out of the sitemap.
export const metadata: Metadata = {
  title: "Get The App | WhatYouAte",
  robots: { index: false, follow: false },
};

export default function IgAppShortLinkPage() {
  return <ShortLink from="/ig/app" />;
}
