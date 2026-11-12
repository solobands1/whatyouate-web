import type { Metadata } from "next";
import ShortLink from "../../components/ShortLink";

// Short link: whatyouate.app/fb. Counts the visit, then goes on (see components/ShortLink.tsx). Kept out of search
// and out of the sitemap.
export const metadata: Metadata = {
  title: "WhatYouAte | WhatYouAte",
  robots: { index: false, follow: false },
};

export default function FbShortLinkPage() {
  return <ShortLink from="/fb" />;
}
