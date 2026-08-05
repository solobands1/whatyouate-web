"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll reveal that fails safe.
 *
 * The markup ships visible. Only once JS is running, and only for blocks that
 * start below the fold, do we hide and then animate them in. The hidden state
 * used to live in CSS, which meant any hiccup in the observer left whole
 * sections invisible on a page whose only job is to be read.
 */
export default function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Already on screen: leave it be rather than flashing it out and back in.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    el.classList.add("reveal");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.style.transitionDelay = `${delay}s`;
        el.classList.add("reveal-visible");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
