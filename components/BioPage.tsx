"use client";

import Link from "next/link";
import { useEffect } from "react";
import { bioVisit, type ShortLinkPath } from "./track";
import { APP_STORE_URL, BODY, INK } from "./site";

// The landing page behind a single bio link (TikTok allows one): the app, the games and the creator program as three
// buttons. Opening it marks the visit as coming from that app (components/track.ts, bioVisit), so the App Store tap and
// any page opened from here count for it on the owner dashboard. The App Store button gets its campaign ("bio-tiktok")
// and its tap counted by the site-wide click listener.
const shadow = "0 14px 32px -12px rgba(10,32,74,0.35)";
const BLUE = "#3F7FD6";

// Line icons (Lucide, ISC licence), drawn in the brand blue on the white buttons
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      {children}
    </svg>
  );
}
const GamepadIcon = () => (
  <Icon>
    <line x1="6" x2="10" y1="11" y2="11" /><line x1="8" x2="8" y1="9" y2="13" /><line x1="15" x2="15.01" y1="12" y2="12" /><line x1="18" x2="18.01" y1="10" y2="10" />
    <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
  </Icon>
);
const VideoIcon = () => (
  <Icon>
    <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" /><rect x="2" y="6" width="14" height="12" rx="2" />
  </Icon>
);
const pill = "flex w-full items-center justify-center gap-2.5 rounded-full px-7 py-[17px] text-[16px] font-semibold tracking-[-0.01em] transition duration-200 active:translate-y-px";

export default function BioPage({ from }: { from: ShortLinkPath }) {
  useEffect(() => {
    bioVisit(from);
  }, [from]);
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="w-full max-w-[380px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-512.png" alt="" width={88} height={88} className="mx-auto rounded-[22px]" style={{ boxShadow: shadow }} />
        <h1 className="mt-5 text-[28px] font-bold tracking-[-0.03em]" style={{ color: INK }}>WhatYouAte</h1>
        <p className="mt-1.5 text-[15px] leading-snug" style={{ color: BODY }}>Know why you feel the way you do</p>

        <div className="mt-8 flex flex-col gap-3">
          <a href={APP_STORE_URL} data-wya-ct="bio" className={pill} style={{ background: INK, color: "#FFFFFF", boxShadow: "0 14px 32px -12px rgba(16,27,46,0.55)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="shrink-0" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            Get The App
          </a>
          <Link href="/games" className={pill} style={{ background: "#FFFFFF", color: INK, boxShadow: shadow }}>
            <GamepadIcon /> Play Free Games
          </Link>
          <Link href="/creators" className={pill} style={{ background: "#FFFFFF", color: INK, boxShadow: shadow }}>
            <VideoIcon /> Creator Program
          </Link>
        </div>

        <Link href="/" className="mt-8 inline-block text-[14px] font-medium underline-offset-4 hover:underline" style={{ color: BODY }}>
          whatyouate.app
        </Link>
      </div>
    </main>
  );
}
