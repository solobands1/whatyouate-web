"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BODY } from "../site";

/** On Join, a way back for people who came from the example dashboard (?from=example). */
export default function BackToExample() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(new URLSearchParams(window.location.search).get("from") === "example");
  }, []);
  if (!show) return null;
  return (
    <Link href="/creators/example" className="mb-6 inline-flex items-center gap-1.5 text-[14px] font-semibold transition hover:opacity-70" style={{ color: BODY }}>
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 12L6 8l4-4" />
      </svg>
      Back to Example Dashboard
    </Link>
  );
}
