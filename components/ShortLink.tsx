"use client";

import { useEffect } from "react";
import { followShortLink, SHORT_LINKS, type ShortLinkPath } from "./track";
import { BODY, INK } from "./site";

// The page behind a short link (whatyouate.app/play, /tt, /yt, /ig, /fb). The site is a static export, so there are no
// server redirects: this page counts the visit (components/track.ts), then replaces the address with the real page.
// Without JavaScript the meta refresh moves on after 3 seconds, and the link is there if both fail. Both carry ?src= so
// the visit still gets its source on the page it lands on.
export default function ShortLink({ from }: { from: ShortLinkPath }) {
  const link = SHORT_LINKS[from];
  const fallback = `${link.to}?src=${link.source}`;
  useEffect(() => {
    followShortLink(from);
  }, [from]);
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center px-6 text-center">
      <meta httpEquiv="refresh" content={`3;url=${fallback}`} />
      <p className="text-[17px] font-semibold" style={{ color: INK }}>Taking you to {link.label}…</p>
      <a href={fallback} className="mt-3 text-[15px] underline" style={{ color: BODY }}>
        Tap here if nothing happens
      </a>
    </main>
  );
}
