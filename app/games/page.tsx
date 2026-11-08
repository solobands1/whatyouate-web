import type { Metadata } from "next";
import Link from "next/link";
import Menu from "../../components/Menu";
import Social from "../../components/Social";
import Logo from "../../components/Logo";
import { INK, BODY, FAINT, APP_STORE_ID, DownloadButton, appStoreLink } from "../../components/site";
import { GAMES } from "../../components/games/catalog";

// "Choose Your Game": one card per game in components/games/catalog.ts. Tapping a card opens that game full screen.
export const metadata: Metadata = {
  title: "Food Games | WhatYouAte",
  description: "Quick, free food games you can play in your browser. A new challenge every day, a real scoreboard, and a food fact with every level.",
  alternates: { canonical: "/games" },
  itunes: { appId: APP_STORE_ID },
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

export default function Games() {
  return (
    <div className="min-h-screen overflow-x-clip">
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-[68rem] items-center justify-between px-6 py-6">
          <Link href="/">
            <Logo priority />
          </Link>
          <Menu />
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
            Quick games, a real food fact with every level, and a new challenge every day.
          </p>

          <div className="mt-12 grid gap-5">
            {GAMES.map((g) => (
              <Link
                key={g.slug}
                href={`/games/${g.slug}`}
                className="group flex items-center gap-5 rounded-[28px] bg-white p-5 ring-1 ring-[#16233B]/[0.06] transition duration-200 hover:-translate-y-0.5 sm:gap-7 sm:p-6"
                style={{ boxShadow: "0 30px 60px -30px rgba(16,42,86,0.40)" }}
              >
                <div
                  className="grid h-[104px] w-[104px] shrink-0 grid-cols-2 place-items-center gap-1 rounded-[22px] p-3 sm:h-[124px] sm:w-[124px]"
                  style={{ background: g.tint }}
                >
                  {g.foods.slice(0, 4).map((c) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={c} src={`/games/foods/${c}.png`} alt="" className="h-9 w-9 sm:h-11 sm:w-11" />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[22px] font-bold tracking-[-0.02em]" style={{ color: INK }}>{g.name}</h2>
                    {g.daily && (
                      <span className="rounded-full bg-[#fff4d6] px-2.5 py-0.5 text-[12px] font-semibold text-[#8a5a00]">
                        New challenge daily
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[15px] leading-[1.55]" style={{ color: BODY }}>{g.tagline}</p>
                  <span
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[14px] font-semibold text-white transition group-hover:opacity-90"
                    style={{ background: "#3f7fd6" }}
                  >
                    Play ▸
                  </span>
                </div>
              </Link>
            ))}

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
