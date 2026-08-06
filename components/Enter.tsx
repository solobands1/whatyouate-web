"use client";

import { useEffect, useRef } from "react";

/**
 * Entrance animation for content that is already on screen at load.
 *
 * Reveal deliberately skips anything above the fold, so the hero never moved.
 * This does the opposite job: it runs once on mount, staggered, so the phone
 * and the cards lifted off it assemble instead of arriving all at once.
 *
 * Same fail-safe contract as Reveal. The markup ships visible and is only
 * hidden once JS is running, so a broken script leaves a readable page rather
 * than a blank one.
 */
export default function Enter({
  children,
  className = "",
  delay = 0,
  from = "up",
  duration = 0.9,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  from?: "up" | "left" | "right";
  duration?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    el.style.setProperty("--enter-delay", `${delay}s`);
    el.style.setProperty("--enter-dur", `${duration}s`);
    el.classList.add("enter", `enter-${from}`);

    // Two frames: one for the browser to accept the hidden state, one to
    // start the transition from it. A single frame lands them in the same
    // style recalculation and the element simply appears.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => el.classList.add("enter-in"))
    );
  }, [delay, from, duration]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
