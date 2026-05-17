"use client";

import { useEffect, useRef } from "react";

const pillars = [
  {
    label: "Snap or type",
    sub: "Describe your meal however feels natural. Photo, text, or voice.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
  {
    label: "AI does the rest",
    sub: "No barcodes. No measuring. No databases. Just results in seconds.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    label: "See your day",
    sub: "A clear breakdown of what you ate, in plain language. No jargon.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    label: "Spot patterns",
    sub: "Over time, understand what makes you feel good and what does not.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
];

export default function PillarGrid() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "-40px" }
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mx-auto max-w-3xl grid grid-cols-2 md:grid-cols-4 gap-4">
      {pillars.map((p, i) => (
        <div
          key={p.label}
          ref={(el) => { refs.current[i] = el; }}
          className="pillar flex flex-col items-center text-center gap-3 px-3 py-5"
          style={{ transitionDelay: `${i * 0.1}s` }}
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-full text-[#6FA8FF]" style={{ background: "rgba(111,168,255,0.22)", border: "1.5px solid rgba(111,168,255,0.4)" }}>
            {p.icon}
          </div>
          <p className="text-[13px] font-semibold text-white leading-tight">{p.label}</p>
          <p className="text-[12px] text-white/45 leading-relaxed">{p.sub}</p>
        </div>
      ))}
    </div>
  );
}
