import type { Metadata } from "next";
import Link from "next/link";
import Menu from "../../components/Menu";
import Social from "../../components/Social";
import Logo from "../../components/Logo";
import { INK, BODY, DownloadButton, appStoreLink } from "../../components/site";
import { GAMES, type Game } from "../../components/games/catalog";
import type { ReactNode } from "react";
import { preload } from "react-dom";
import { GAME_FONT_CSS } from "../../components/games/gameFont";
import { KIT_CSS } from "../../components/games/look";
import { CalendarIcon, PlayersIcon, PlayIcon, SparkleIcon } from "../../components/games/icons";

// "Choose Your Game": a game launcher, one poster tile per game in components/games/catalog.ts. Tapping a tile opens that
// game full screen. The tiles, badges and Play buttons use the games' own frame look (components/games/look.ts).
// No Safari App Store banner (two banners looked cluttered): a small Get App button sits in the header instead.
export const metadata: Metadata = {
  title: "Food Games | WhatYouAte",
  description: "Quick, free food games you can play in your browser. A new challenge every day and a real scoreboard.",
  alternates: { canonical: "/games" },
  openGraph: {
    title: "WhatYouAte Food Games",
    description: "Quick, free food games. Can you top the scoreboard?",
    siteName: "WhatYouAte",
    type: "website",
    url: "https://whatyouate.app/games",
    images: [{ url: "/og-games.png", width: 1200, height: 630, alt: "WhatYouAte Food Games" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "WhatYouAte Food Games",
    description: "Quick, free food games. Can you top the scoreboard?",
    images: ["/og-games.png"],
  },
};

// A tile in the launcher: the game's poster, a badge on its bottom edge, the name in the display face, and a chunky Play.
const HUB_CSS = `
.hub-tile { background: #ffffff; border-radius: 28px;
  box-shadow: 0 0 0 1px rgba(111,168,255,0.18), 0 26px 60px -30px rgba(31,70,140,0.45); transition: transform 120ms ease-out, box-shadow 120ms ease-out; }
.hub-tile:active { transform: scale(0.985); }
.hub-tile:active .wk-go { background: #5E9BF7; }
@media (hover: hover) { .hub-tile:hover { transform: translateY(-3px); } .hub-tile:hover img { transform: scale(1.04); } }
.hub-tile:focus-visible { outline: 4px solid #FFC21F; outline-offset: 5px; }
`;

function GameCard({ g }: { g: Game }) {
  return (
    <Link href={`/games/${g.slug}`} className="hub-tile group flex flex-col p-2 pb-3 sm:p-2.5 sm:pb-3.5">
      <div className="relative">
        <div className="overflow-hidden rounded-[17px] shadow-[inset_0_0_0_1px_rgba(14,31,69,0.08)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/games/cards/${g.slug}.jpg`} alt={`${g.name} game`} width={480} height={480}
            className="block aspect-square w-full object-cover transition-transform duration-300" />
        </div>
        {g.multiplayer ? (
          <span className="wk-tag absolute -bottom-3 left-1/2 flex h-[26px] -translate-x-1/2 items-center gap-1.5 bg-[#6FA8FF] px-3 text-[13px] leading-none shadow-[0_8px_18px_-10px_rgba(79,136,232,0.9)]">
            <PlayersIcon size={15} />2 Player
          </span>
        ) : g.daily ? (
          <span className="wk-tag absolute -bottom-3 left-1/2 flex h-[26px] -translate-x-1/2 items-center gap-1 bg-[#EAF2FF] px-2.5 text-[11.5px] leading-none text-[#4F88E8] shadow-[0_0_0_2px_#fff] sm:text-[13px]">
            <CalendarIcon size={13} />New Challenge Daily
          </span>
        ) : null}
      </div>
      <h3 className="wk-f mt-5 px-1 text-[20px] leading-[1.05] text-[#0E1F45] sm:text-[23px]">{g.name}</h3>
      <p className="mt-1.5 line-clamp-3 px-1 text-[12.5px] leading-snug text-[#5A6B85] sm:line-clamp-none sm:text-[14px]">{g.tagline}</p>
      <span className="mt-auto block pt-3">
        <span className="wk-btn wk-go h-[42px] text-[18px] sm:h-[46px] sm:text-[20px]"><PlayIcon size={15} />Play</span>
      </span>
    </Link>
  );
}

function Section({ title, body, icon, games, children }: { title: string; body: string; icon: ReactNode; games: Game[]; children?: ReactNode }) {
  if (!games.length) return null;
  return (
    <section className="mt-12 sm:mt-16">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#DDEBFF] text-[#4F88E8]">{icon}</span>
        <div className="min-w-0">
          <h2 className="wk-f text-[28px] leading-none text-[#0E1F45] sm:text-[32px]">{title}</h2>
          <p className="mt-1 text-[14px] leading-snug" style={{ color: BODY }}>{body}</p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-5 sm:gap-y-7 lg:grid-cols-4">
        {games.map((g) => <GameCard key={g.slug} g={g} />)}
        {children}
      </div>
    </section>
  );
}

export default function Games() {
  preload("/fonts/LilitaOne-Regular.ttf", { as: "font", type: "font/ttf", crossOrigin: "anonymous" });
  return (
    <div className="min-h-screen overflow-x-clip">
      <style>{GAME_FONT_CSS + KIT_CSS + HUB_CSS}</style>
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-[68rem] items-center justify-between px-6 py-6">
          <Link href="/">
            <Logo priority />
          </Link>
          <div className="flex items-center gap-2.5">
            <a
              href={appStoreLink("games-header")}
              className="flex h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold text-white transition hover:opacity-90"
              style={{ background: INK, boxShadow: "0 8px 22px -12px rgba(16,42,86,0.45)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Get App
            </a>
            <Menu />
          </div>
        </div>
      </header>

      <main className="px-4 pt-28 sm:px-6 sm:pt-36">
        <div className="mx-auto max-w-[44rem] text-center">
          <p className="wk-f inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6F86A8]">
            Free Food Games
          </p>
          <h1 className="wk-f mt-5 text-balance text-[clamp(40px,10.5vw,72px)] leading-[1.03] text-[#101B2E] tracking-[-0.04em]">
            Choose Your Game
          </h1>
          <p className="mx-auto mt-5 max-w-[36ch] text-balance text-[16px] leading-[1.6] sm:text-[17px]" style={{ color: BODY }}>
            Quick food games with a new challenge every day. Can you top the scoreboard?
          </p>
        </div>

        <div className="mx-auto max-w-[68rem]">
          <Section title="Multiplayer" body="Play a friend live with a room code, or pass one phone back and forth."
            icon={<PlayersIcon size={24} />} games={GAMES.filter((g) => g.multiplayer)} />
          <Section title="Play Solo" body="A new challenge every day, and a scoreboard to climb."
            icon={<CalendarIcon size={22} />} games={GAMES.filter((g) => !g.multiplayer)}>
            <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[24px] border-[2.5px] border-dashed border-[#16336C]/25 bg-white/40 px-4 py-8 text-center lg:col-span-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e3edfc] text-[#3F7FD6]"><SparkleIcon size={26} /></span>
              <p className="wk-f mt-3 text-[18px] leading-tight text-[#16336C] sm:text-[20px]">More Games Coming Soon</p>
            </div>
          </Section>
        </div>

        <div className="mx-auto max-w-[44rem]">
          <div className="mt-20 text-center">
            <h2 className="text-balance text-[clamp(24px,3.4vw,32px)] font-bold leading-[1.2] tracking-[-0.03em]">
              Ever wonder why some meals leave you tired?
            </h2>
            <p className="mx-auto mt-4 max-w-[44ch] text-[17px] leading-[1.7]" style={{ color: BODY }}>
              WhatYouAte connects what you eat to how you feel, so you can see which meals give you energy and which ones drain it.
            </p>
            <div className="mt-7 flex justify-center">
              <DownloadButton href={appStoreLink("games-hub")} />
            </div>
          </div>
        </div>
      </main>

      <footer className="px-6 pb-14 pt-24">
        <div className="mx-auto flex max-w-[64rem] flex-col items-center gap-5 text-center">
          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[14px]" style={{ color: BODY }}>
            <Link href="/" className="transition hover:opacity-70">Home</Link>
            <Link href="/about" className="transition hover:opacity-70">About</Link>
            <Link href="/creators" className="transition hover:opacity-70">Creators</Link>
            <Link href="/privacy" className="transition hover:opacity-70">Privacy Policy</Link>
            <Link href="/terms" className="transition hover:opacity-70">Terms of Use</Link>
            <a href="mailto:support@whatyouate.app" className="transition hover:opacity-70">Support</a>
          </nav>
          <div style={{ color: BODY }}>
            <Social />
          </div>
          <span className="text-[13px]" style={{ color: "#9CADC6" }}>
            © {new Date().getFullYear()} WhatYouAte. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
