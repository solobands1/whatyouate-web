"use client";

import { useEffect, useRef } from "react";

/**
 * Drifts its children as they cross the viewport. Movement is tied to scroll
 * position rather than time, so it reads as depth instead of animation.
 *
 * Everything is opt-in and additive: with JS off, reduced motion on, or the
 * observer unavailable, the content simply sits still.
 */
export default function Parallax({
  children,
  speed = 30,
  className = "",
}: {
  children: React.ReactNode;
  /** Pixels of travel across a full viewport pass. Negative drifts the other way. */
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let active = false;

    const apply = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // -1 just below the fold, +1 just above the top
      const progress = 1 - (r.top + r.height / 2) / (vh / 2 + r.height / 2);
      const clamped = Math.max(-1, Math.min(1, progress));
      el.style.transform = `translate3d(0, ${(-clamped * speed).toFixed(2)}px, 0)`;
    };

    const onScroll = () => {
      if (!active || raf) return;
      raf = requestAnimationFrame(apply);
    };

    const io = new IntersectionObserver(([e]) => {
      active = e.isIntersecting;
      if (active) apply();
    });
    io.observe(el);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [speed]);

  return (
    <div ref={ref} className={className} style={{ willChange: "transform" }}>
      {children}
    </div>
  );
}
