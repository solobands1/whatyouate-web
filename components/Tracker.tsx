"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { onDocumentClick, pageView } from "./track";

// Mounted once in the root layout. Counts the visit and game opens on each page change, and listens for App Store taps.
// Renders nothing. See components/track.ts for what is counted (daily totals only, nothing about the visitor).
export default function Tracker() {
  const pathname = usePathname();
  useEffect(() => {
    pageView(pathname ?? "/");
  }, [pathname]);
  useEffect(() => {
    // Capture phase, so the campaign is added to the link before the browser follows it.
    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, []);
  return null;
}
