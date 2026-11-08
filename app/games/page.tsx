import type { Metadata } from "next";
import Link from "next/link";
import Menu from "../../components/Menu";
import Social from "../../components/Social";
import Logo from "../../components/Logo";
import { INK, BODY, FAINT, DownloadButton, appStoreLink } from "../../components/site";
import { GAMES, type Game } from "../../components/games/catalog";

// "Choose Your Game": one card per game in components/games/catalog.ts. Tapping a card opens that game full screen.
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

function GameCard({ g }: { g: Game }) {
  return (
    <Link
      href={`/games/${g.slug}`}
      className="group flex items-center gap-5 rounded-[28px] bg-white p-5 ring-1 ring-[#16233B]/[0.06] transition duration-200 hover:-translate-y-0.5 sm:gap-7 sm:p-6"
      style={{ boxShadow: "0 30px 60px -30px rgba(16,42,86,0.40)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/games/cards/${g.slug}.jpg`} alt={`${g.name} game`} width={124} height={124}
        className="h-[104px] w-[104px] shrink-0 rounded-[22px] object-cover ring-1 ring-[#16233B]/[0.06] sm:h-[124px] sm:w-[124px]" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: INK }}>{g.name}</h3>
          {g.multiplayer ? (
            <span className="rounded-full bg-[#e3effe] px-2.5 py-0.5 text-[12px] font-semibold text-[#3f7fd6]">Play with a friend</span>
          ) : g.daily ? (
            <span className="rounded-full bg-[#fff4d6] px-2.5 py-0.5 text-[12px] font-semibold text-[#8a5a00]">New challenge daily</span>
          ) : null}
        </div>
        <p className="mt-1.5 text-[15px] leading-[1.55]" style={{ color: BODY }}>{g.tagline}</p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[14px] font-semibold text-white transition group-hover:opacity-90" style={{ background: "#3f7fd6" }}>
          Play ▸
        </span>
      </div>
    </Link>
  );
}

function Section({ title, body, games }: { title: string; body: string; games: Game[] }) {
  if (!games.length) return null;
  return (
    <section className="mt-12">
      <h2 className="text-[clamp(22px,3vw,28px)] font-bold tracking-[-0.03em]" style={{ color: INK }}>{title}</h2>
      <p className="mt-1 text-[15px]" style={{ color: BODY }}>{body}</p>
      <div className="mt-5 grid gap-5">
        {games.map((g) => <GameCard key={g.slug} g={g} />)}
      </div>
    </section>
  );
}

export default function Games() {
  return (
    <div className="min-h-screen overflow-x-clip">
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

      <main className="px-6 pt-32 sm:pt-36">
        <div className="mx-auto max-w-[44rem]">
          <p className="text-center text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: FAINT }}>
            Free food games
          </p>
          <h1 className="mt-5 text-balance text-center text-[clamp(34px,5.4vw,56px)] font-bold leading-[1.06] tracking-[-0.04em]">
            Choose Your Game
          </h1>
          <p className="mx-auto mt-5 max-w-[40ch] text-balance text-center text-[17px] leading-[1.65]" style={{ color: BODY }}>
            Quick food games with a new challenge every day. Can you top the scoreboard?
          </p>

          <Section title="Multiplayer" body="Play a friend live with a room code, or pass one phone back and forth." games={GAMES.filter((g) => g.multiplayer)} />
          <Section title="Play Solo" body="A new challenge every day, and a scoreboard to climb." games={GAMES.filter((g) => !g.multiplayer)} />

          <div className="mt-5 grid gap-5">
            <div className="flex items-center justify-center rounded-[28px] border-2 border-dashed border-[#16233B]/[0.10] px-6 py-8 text-center">
              <p className="text-[15px] font-medium" style={{ color: FAINT }}>More games coming soon</p>
            </div>
          </div>

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
