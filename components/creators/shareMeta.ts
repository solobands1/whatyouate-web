import type { Metadata } from "next";

// Link previews for the creator program. The site-wide preview (app/layout.tsx) sells the app; when a
// creator shares a program page, the preview should sell the program instead.
const PROGRAM_TITLE = "WhatYouAte Creators Program";
const PROGRAM_DESCRIPTION =
  "Earn 30% commission on every subscriber you bring in, for a full year. Your followers get their first month free.";

export function creatorShareMeta(path: string): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      title: PROGRAM_TITLE,
      description: PROGRAM_DESCRIPTION,
      url: `https://whatyouate.app${path}`,
      siteName: "WhatYouAte",
      type: "website",
      locale: "en_CA",
      images: [{ url: "/og-creators.png", width: 1200, height: 630, alt: "Earn 30% for a full year with the WhatYouAte Creators Program." }],
    },
    twitter: {
      card: "summary_large_image",
      title: PROGRAM_TITLE,
      description: PROGRAM_DESCRIPTION,
      images: ["/og-creators.png"],
    },
  };
}

// The follower share page (whatyouate.app/c/CODE). The site is pre-built, so the preview can't name the
// creator or the code; it sells the free month.
const FOLLOWER_TITLE = "Get Your First Month Of WhatYouAte Free";
const FOLLOWER_DESCRIPTION =
  "A creator you follow sent you a free month of WhatYouAte Pro. See which foods give you energy and which ones drag you down.";

export const followerShareMeta: Pick<Metadata, "openGraph" | "twitter"> = {
  openGraph: {
    title: FOLLOWER_TITLE,
    description: FOLLOWER_DESCRIPTION,
    siteName: "WhatYouAte",
    type: "website",
    locale: "en_CA",
    images: [{ url: "/og-v2.png", width: 1200, height: 630, alt: "WhatYouAte. Know why you feel the way you do." }],
  },
  twitter: {
    card: "summary_large_image",
    title: FOLLOWER_TITLE,
    description: FOLLOWER_DESCRIPTION,
    images: ["/og-v2.png"],
  },
};
