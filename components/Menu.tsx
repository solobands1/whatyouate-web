"use client";

import { useEffect, useRef, useState } from "react";
import { APP_STORE_URL, INK } from "./site";

const LINKS = [
  { label: "About us", href: "#", soon: true },
  { label: "Support", href: "mailto:hello@minimul.app" },
];

export default function Menu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 ring-1 ring-[#16233B]/[0.08] backdrop-blur transition hover:bg-white"
        style={{ boxShadow: "0 8px 22px -12px rgba(16,42,86,0.45)" }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round">
          {open ? (
            <>
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </>
          ) : (
            <>
              <path d="M4 8h16" />
              <path d="M4 16h16" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 w-56 overflow-hidden rounded-2xl bg-white/95 p-2 ring-1 ring-[#16233B]/[0.08] backdrop-blur"
          style={{ boxShadow: "0 24px 50px -18px rgba(16,42,86,0.35)" }}
        >
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              role="menuitem"
              aria-disabled={l.soon || undefined}
              onClick={(e) => {
                if (l.soon) e.preventDefault();
                else setOpen(false);
              }}
              className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-[15px] font-medium transition ${
                l.soon ? "cursor-default text-[#9AAAC2]" : "text-[#16233B] hover:bg-[#F0F6FD]"
              }`}
            >
              {l.label}
              {l.soon && <span className="text-[11px] font-semibold uppercase tracking-wider">Soon</span>}
            </a>
          ))}

          <a
            href={APP_STORE_URL}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1.5 flex items-center justify-center gap-2 rounded-xl px-3.5 py-3 text-[15px] font-semibold text-white transition hover:opacity-90"
            style={{ background: INK }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            Download
          </a>
        </div>
      )}
    </div>
  );
}
