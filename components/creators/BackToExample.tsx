"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BODY } from "../site";

/** On Join, a way back for people who came from the example dashboard (?from=example). */
export default function BackToExample() {
  // null: not from the example. Otherwise where to go back to: the Creator Kit card (&back=kit) or the top.
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("from") !== "example") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHref(p.get("back") === "kit" ? "/creators/example?view=perks#kit" : "/creators/example");
  }, []);
  if (!href) return null;
  return (
    <Link href={href} className="mb-6 inline-flex items-center gap-1.5 text-[14px] font-semibold transition hover:opacity-70" style={{ color: BODY }}>
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 12L6 8l4-4" />
      </svg>
      Back To Example Dashboard
    </Link>
  );
}
