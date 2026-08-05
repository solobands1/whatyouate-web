import Image from "next/image";
import Link from "next/link";
import Reveal from "../components/Reveal";
import { APP_STORE_URL, DEEP, LIGHT, DownloadButton, Phone, UiCard, Eyebrow } from "../components/site";

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F8FAFC] text-[#16233B]">

      {/* ── NAV ───────────────────────────────────────────────── */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <Image src="/icon-512.png" alt="" width={34} height={34} className="rounded-[9px]" priority />
            <span className="text-[16px] font-semibold tracking-[-0.01em] text-white">WhatYouAte</span>
          </div>
          <a
            href={APP_STORE_URL}
            className="rounded-full border border-white/35 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/10"
          >
            Download
          </a>
        </div>
      </header>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-5 pb-24 pt-28 sm:px-8 sm:pb-32 sm:pt-32" style={{ background: DEEP }}>
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">

          <div className="text-center lg:text-left">
            <Reveal>
              <h1 className="mx-auto max-w-[19ch] text-[clamp(38px,7vw,64px)] font-bold leading-[1.04] tracking-[-0.035em] text-white lg:mx-0">
                Know why you feel the way you do
              </h1>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="mx-auto mt-6 max-w-[46ch] text-[clamp(16px,2.2vw,19px)] leading-[1.65] text-white/85 lg:mx-0">
                Your food, your energy, and the link between them. Log a meal in seconds,
                check in for a minute at night, and your coach shows you what lines up.
              </p>
            </Reveal>
            <Reveal delay={0.14}>
              <div className="mt-9 flex flex-col items-center gap-3 lg:items-start">
                <DownloadButton tone="light" />
                <p className="text-[13px] font-medium text-white/70">
                  Free to download · 7 day Pro trial · iPhone
                </p>
              </div>
            </Reveal>
          </div>

          {/* Phone with one real insight lifted out of it */}
          <Reveal delay={0.12}>
            <div className="relative mx-auto w-full max-w-[290px] sm:max-w-[330px] lg:max-w-none lg:pl-10">
              <Phone src="/screenshots/patterns-2026.png" alt="The Patterns screen in WhatYouAte" priority />
              <UiCard
                src="/ui/food-feeling.png"
                alt="Your lower-energy days have more often followed fried or greasy food the night before"
                width={1104}
                height={261}
                lift="lg"
                className="absolute -bottom-10 -left-4 w-[108%] max-w-none sm:-left-8 lg:-left-16"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────── */}
      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 max-w-[16ch] text-[clamp(28px,4.5vw,44px)] font-bold leading-[1.1] tracking-[-0.03em]">
              Three small things, every day
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-8 sm:mt-16 sm:grid-cols-3 sm:gap-10">
            {[
              { n: "Eat", d: "Snap a photo, scan a barcode, say it out loud, or just type it. No weighing, no measuring." },
              { n: "Reflect", d: "One minute before bed on your energy, sleep, mood, stress and digestion." },
              { n: "Feel better", d: "Your coach reads both and tells you what it notices, one small change at a time." },
            ].map((s, i) => (
              <Reveal key={s.n} delay={0.06 * i}>
                <div className="flex flex-col gap-3">
                  <span className="text-[13px] font-semibold text-[#6FA8FF]">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="text-[22px] font-semibold tracking-[-0.02em]">{s.n}</h3>
                  <p className="text-[15px] leading-[1.65] text-[#54637C]">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── THE COACH ─────────────────────────────────────────── */}
      <section className="px-5 py-20 sm:px-8 sm:py-28" style={{ background: DEEP }}>
        <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <Eyebrow onDark>Your coach</Eyebrow>
            <h2 className="mt-3 max-w-[15ch] text-[clamp(28px,4.5vw,44px)] font-bold leading-[1.1] tracking-[-0.03em] text-white">
              It reads your week, not a template
            </h2>
            <p className="mt-5 max-w-[44ch] text-[16px] leading-[1.7] text-white/80">
              No generic tips. It spots a pattern in your own days, suggests one small
              change, and tells you plainly when it does not have enough to go on yet.
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <UiCard src="/ui/coach-nudge.png" alt="A coach nudge in WhatYouAte" width={1104} height={390} lift="lg" />
          </Reveal>
        </div>
      </section>

      {/* ── WHAT YOU SEE ──────────────────────────────────────── */}
      <section className="px-5 py-20 sm:px-8 sm:py-28" style={{ background: LIGHT }}>
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <Eyebrow>What you start to see</Eyebrow>
            <h2 className="mt-3 max-w-[18ch] text-[clamp(28px,4.5vw,44px)] font-bold leading-[1.1] tracking-[-0.03em]">
              Real counts from your own nights
            </h2>
            <p className="mt-5 max-w-[52ch] text-[16px] leading-[1.7] text-[#54637C]">
              Not vague encouragement. Actual numbers, drawn from what you logged, and
              labelled as associations rather than causes.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:mt-14 sm:grid-cols-2 sm:gap-8">
            <Reveal>
              <UiCard src="/ui/energy-dips.png" alt="When your energy dips, across your last nine nights" width={1208} height={488} />
            </Reveal>
            <Reveal delay={0.08}>
              <UiCard src="/ui/streak-week.png" alt="This week, a fourteen night reflection streak" width={1208} height={493} />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── HABITS ────────────────────────────────────────────── */}
      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
          <Reveal className="lg:order-2">
            <Eyebrow>Habits</Eyebrow>
            <h2 className="mt-3 max-w-[15ch] text-[clamp(28px,4.5vw,44px)] font-bold leading-[1.1] tracking-[-0.03em]">
              Small enough to actually finish
            </h2>
            <p className="mt-5 max-w-[44ch] text-[16px] leading-[1.7] text-[#54637C]">
              Three days at a time, built around what you said you want to feel better
              about. A glass of water in the afternoon. A walk after lunch.
            </p>
          </Reveal>
          <Reveal delay={0.08} className="lg:order-1">
            <UiCard src="/ui/habit-builder.png" alt="The Habit Builder card in WhatYouAte" width={1200} height={702} lift="lg" />
          </Reveal>
        </div>
      </section>

      {/* ── THE PROMISE ───────────────────────────────────────── */}
      <section className="px-5 py-20 sm:px-8 sm:py-24" style={{ background: LIGHT }}>
        <Reveal>
          <p className="mx-auto max-w-[26ch] text-center text-[clamp(24px,4vw,38px)] font-semibold leading-[1.25] tracking-[-0.025em]">
            No red warnings. No guilt trips. No lecture about a cheeseburger.
          </p>
          <p className="mx-auto mt-6 max-w-[46ch] text-center text-[16px] leading-[1.7] text-[#54637C]">
            Built for ordinary days, not for chasing numbers. Log it, see what it does to
            your week, and get on with your day.
          </p>
        </Reveal>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="px-5 py-24 sm:px-8 sm:py-32" style={{ background: DEEP }}>
        <Reveal>
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
            <h2 className="max-w-[16ch] text-[clamp(30px,5vw,50px)] font-bold leading-[1.08] tracking-[-0.03em] text-white">
              Give it a week. See how you feel.
            </h2>
            <p className="max-w-[40ch] text-[16px] leading-[1.7] text-white/80">
              Download free and start with your next meal.
            </p>
            <DownloadButton tone="light" className="mt-2" />
            <p className="text-[13px] font-medium text-white/70">7 day Pro trial · No commitment</p>
          </div>
        </Reveal>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="px-5 py-12 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2">
            <Image src="/icon.png" alt="" width={22} height={22} className="rounded-[6px]" />
            <span className="text-[14px] font-semibold tracking-[-0.01em]">WhatYouAte</span>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-7 gap-y-2 text-[14px] text-[#54637C]">
            <Link href="/privacy" className="transition hover:text-[#16233B]">Privacy Policy</Link>
            <Link href="/terms" className="transition hover:text-[#16233B]">Terms of Use</Link>
            <a href="mailto:hello@minimul.app" className="transition hover:text-[#16233B]">Support</a>
          </nav>
          <span className="text-[13px] text-[#8296B0]">
            © {new Date().getFullYear()} WhatYouAte. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
