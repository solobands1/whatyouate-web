import Image from "next/image";
import Link from "next/link";
import Reveal from "../components/Reveal";
import Parallax from "../components/Parallax";
import PhoneMock from "../components/PhoneMock";
import {
  APP_STORE_URL, INK, BODY, FAINT,
  DownloadButton, UiCard, SectionHeading, AppleHealthMark,
} from "../components/site";

const STEPS = [
  { n: "01", t: "Eat", d: "Snap a photo, scan a barcode, say it out loud, or just type it. No weighing, no measuring." },
  { n: "02", t: "Reflect", d: "One minute before bed on your energy, sleep, mood, stress and digestion." },
  { n: "03", t: "Feel better", d: "Your coach reads both and tells you what it notices, one small change at a time." },
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-clip">

      {/* ── NAV ─────────────────────────────────────────────── */}
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-[68rem] items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2.5">
            <Image src="/icon-512.png" alt="" width={30} height={30} className="rounded-[8px] ring-1 ring-black/5" priority />
            <span className="text-[16px] font-semibold tracking-[-0.015em]">WhatYouAte</span>
          </div>
          <a
            href={APP_STORE_URL}
            className="rounded-full px-5 py-2.5 text-[14px] font-semibold text-white transition hover:opacity-90"
            style={{ background: INK }}
          >
            Download
          </a>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="relative px-6 pt-32 sm:pt-36">
        <div className="mx-auto max-w-[52rem] text-center">
          <h1 className="text-balance text-[clamp(40px,6.6vw,74px)] font-bold leading-[1.03] tracking-[-0.04em]">
            Know why you feel the way you do
          </h1>
          <p className="mx-auto mt-7 max-w-[44ch] text-[clamp(17px,2vw,20px)] leading-[1.62]" style={{ color: BODY }}>
            Your food, your energy, and the link between them. One minute a night is
            all it takes.
          </p>
          <div className="mt-9 flex flex-col items-center gap-4">
            <DownloadButton />
            <p className="text-[13.5px] font-medium" style={{ color: FAINT }}>
              Free on iPhone · 7 day Pro trial · No commitment
            </p>
          </div>
        </div>

        {/* The device carries "this is an app"; the lifted card carries the
            headline's promise. One in front of the other, as a composition. */}
        <div className="relative mx-auto mt-16 w-full max-w-[58rem] pb-20 sm:mt-20 sm:pb-28">
          <Parallax speed={-20}>
            <Reveal>
              <PhoneMock
                src="/screenshots/patterns-2026.png"
                alt="The Patterns screen in WhatYouAte"
                priority
                className="mx-auto w-[64%] max-w-[300px] sm:w-[42%] sm:max-w-[330px]"
              />
            </Reveal>
          </Parallax>

          <Parallax
            speed={30}
            className="mt-8 sm:absolute sm:bottom-[6%] sm:left-0 sm:mt-0 sm:w-[46%] lg:w-[42%]"
          >
            <Reveal delay={0.14}>
              <UiCard
                src="/ui/food-feeling.png"
                alt="Your lower-energy days have more often followed fried or greasy food the night before"
                width={1104} height={261} tilt={-2.5} lift="lg"
              />
            </Reveal>
          </Parallax>

          <Parallax
            speed={18}
            className="mt-6 sm:absolute sm:right-0 sm:top-[16%] sm:mt-0 sm:w-[40%] lg:w-[36%]"
          >
            <Reveal delay={0.2}>
              <UiCard
                src="/ui/streak-week.png"
                alt="This week, a fourteen night reflection streak"
                width={1208} height={493} tilt={2.5} lift="md"
              />
            </Reveal>
          </Parallax>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-[68rem]">
          <Reveal>
            <SectionHeading
              eyebrow="How it works"
              title="Three small things, every day"
              body="Nothing to weigh, nothing to plan. The whole loop takes about a minute."
            />
          </Reveal>
          <div className="mt-14 grid gap-10 sm:mt-16 sm:grid-cols-3 sm:gap-12">
            {STEPS.map((s, i) => (
              <Reveal key={s.t} delay={0.08 * i}>
                <div className="text-center sm:text-left">
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold"
                    style={{ background: "rgba(111,168,255,0.14)", color: "#3C7AD4" }}
                  >
                    {s.n}
                  </span>
                  <h3 className="mt-5 text-[21px] font-semibold tracking-[-0.02em]">{s.t}</h3>
                  <p className="mx-auto mt-3 max-w-[34ch] text-[15.5px] leading-[1.68] sm:mx-0" style={{ color: BODY }}>
                    {s.d}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── COACH ───────────────────────────────────────────── */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto grid max-w-[64rem] items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <SectionHeading
              center={false}
              eyebrow="Your coach"
              title="It reads your week, not a template"
              body="No generic tips. It spots a pattern in your own days, suggests one small change, and tells you plainly when it does not have enough to go on yet."
            />
          </Reveal>
          <Parallax speed={22}>
            <Reveal delay={0.08}>
              <UiCard src="/ui/coach-nudge.png" alt="A coach nudge in WhatYouAte" width={1104} height={390} tilt={1.2} lift="lg" />
            </Reveal>
          </Parallax>
        </div>
      </section>

      {/* ── PATTERNS ────────────────────────────────────────── */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto grid max-w-[64rem] items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <Parallax speed={-20} className="lg:order-2">
            <Reveal>
              <UiCard src="/ui/energy-dips.png" alt="When your energy dips, across your last nine nights" width={1208} height={488} tilt={-1.4} lift="lg" />
            </Reveal>
          </Parallax>
          <Reveal delay={0.08} className="lg:order-1">
            <SectionHeading
              center={false}
              eyebrow="What you start to see"
              title="Real counts from your own nights"
              body="Not vague encouragement. Actual numbers, drawn from what you logged, and labelled as associations rather than causes."
            />
          </Reveal>
        </div>
      </section>

      {/* ── HABITS ──────────────────────────────────────────── */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto grid max-w-[64rem] items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <SectionHeading
              center={false}
              eyebrow="Habits"
              title="Small enough to actually finish"
              body="Three days at a time, built around what you said you want to feel better about. A glass of water in the afternoon. A walk after lunch."
            />
          </Reveal>
          <Parallax speed={24}>
            <Reveal delay={0.08}>
              <UiCard src="/ui/habit-builder.png" alt="The Habit Builder card in WhatYouAte" width={1200} height={702} tilt={1.4} lift="lg" />
            </Reveal>
          </Parallax>
        </div>
      </section>

      {/* ── THE REST OF THE DAY ─────────────────────────────── */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-[64rem]">
          <Reveal>
            <SectionHeading
              eyebrow="The rest of the day"
              title="Water, movement and sleep, in the same place"
              body="Energy is never only about food. Log water and activity in a tap, note how you slept in your nightly check-in, and let it all sit alongside your meals."
            />
          </Reveal>

          {/* The wide, short water bar spans the top; the two taller cards sit
              beneath it, so nothing is forced into a column it does not fit. */}
          <div className="mt-14 sm:mt-16">
            <Parallax speed={-14}>
              <Reveal>
                <UiCard
                  src="/ui/water.png"
                  alt="Water intake for the day"
                  width={1152} height={230} lift="md"
                  className="mx-auto w-full max-w-[38rem]"
                />
              </Reveal>
            </Parallax>
            <div className="mt-8 grid gap-8 sm:mt-10 sm:grid-cols-2 sm:gap-10">
              <Parallax speed={14}>
                <Reveal delay={0.06}>
                  <UiCard src="/ui/recent-activity.png" alt="Recent food and activity for the day" width={1208} height={595} tilt={-1} lift="md" />
                </Reveal>
              </Parallax>
              <Parallax speed={20}>
                <Reveal delay={0.12}>
                  <UiCard src="/ui/micronutrients.png" alt="Micronutrients grouped by what they do for you" width={1208} height={630} tilt={1} lift="md" />
                </Reveal>
              </Parallax>
            </div>
          </div>

          <Reveal delay={0.1}>
            <div className="mx-auto mt-14 flex max-w-[30rem] items-center justify-center gap-3.5 rounded-2xl bg-white/80 px-6 py-5 shadow-[0_18px_40px_-22px_rgba(16,42,86,0.45)] ring-1 ring-[#16233B]/[0.06] backdrop-blur-sm">
              <AppleHealthMark size={44} />
              <p className="text-[15px] font-medium" style={{ color: INK }}>
                Works with Apple Health
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── PROMISE ─────────────────────────────────────────── */}
      <section className="px-6 py-16 sm:py-24">
        <Reveal>
          <div className="mx-auto max-w-[40rem] text-center">
            <h2 className="text-balance text-[clamp(26px,3.8vw,40px)] font-bold leading-[1.2] tracking-[-0.03em]">
              No red warnings. No guilt trips. No lecture about a cheeseburger.
            </h2>
            <p className="mx-auto mt-6 max-w-[44ch] text-[17px] leading-[1.72]" style={{ color: "#334A6B" }}>
              Built for ordinary days, not for chasing numbers. Log it, see what it does
              to your week, and get on with your day.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="px-6 pb-24 pt-16 sm:pb-32 sm:pt-24">
        <Reveal>
          <div className="mx-auto flex max-w-[36rem] flex-col items-center gap-6 text-center">
            <h2 className="text-balance text-[clamp(30px,4.6vw,50px)] font-bold leading-[1.08] tracking-[-0.035em] text-white">
              Give it a week. See how you feel.
            </h2>
            <p className="max-w-[36ch] text-[17px] leading-[1.7] text-white/85">
              Download free and start with your next meal.
            </p>
            <DownloadButton tone="light" className="mt-2" />
            <p className="text-[13.5px] font-medium text-white/70">7 day Pro trial · Cancel anytime</p>
          </div>
        </Reveal>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="px-6 pb-14">
        <div className="mx-auto flex max-w-[64rem] flex-col items-center gap-5 text-center">
          <div className="flex items-center gap-2">
            <Image src="/icon.png" alt="" width={22} height={22} className="rounded-[6px]" />
            <span className="text-[14px] font-semibold tracking-[-0.015em] text-white">WhatYouAte</span>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[14px] text-white/80">
            <Link href="/privacy" className="transition hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="transition hover:text-white">Terms of Use</Link>
            <a href="mailto:hello@minimul.app" className="transition hover:text-white">Support</a>
          </nav>
          <span className="text-[13px] text-white/60">
            © {new Date().getFullYear()} WhatYouAte. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
