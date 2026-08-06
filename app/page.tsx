import Image from "next/image";
import Link from "next/link";
import Reveal from "../components/Reveal";
import Parallax from "../components/Parallax";
import Menu from "../components/Menu";
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
          <Menu />
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="relative px-6 pb-4 pt-28 sm:pb-6 sm:pt-32">
        <div className="mx-auto max-w-[52rem] text-center">
          <h1 className="text-balance text-[clamp(40px,6.6vw,74px)] font-bold leading-[1.03] tracking-[-0.04em]">
            Know why you feel the way you do
          </h1>
          <p className="mx-auto mt-7 max-w-[44ch] text-[clamp(17px,2vw,20px)] leading-[1.62]" style={{ color: BODY }}>
            Food, sleep, movement and mood, read together. Logging takes seconds,
            and your coach turns what it finds into one small habit at a time.
          </p>
          <div className="mt-9 flex flex-col items-center gap-4">
            <DownloadButton />
            <p className="text-[13.5px] font-medium" style={{ color: FAINT }}>
              Free on iPhone · 7 day Pro trial · No commitment
            </p>
          </div>
        </div>

        {/* Device fades into the wash at its base, with one lifted card
            crossing it the way Bevel lets the watch break the phone. */}
        <div className="relative mx-auto mt-10 w-full max-w-[60rem] sm:mt-12">
          <Parallax speed={-18}>
            <Reveal>
              <Image
                src="/device/iphone-home.png"
                alt="The WhatYouAte home screen"
                width={1500}
                height={2614}
                priority
                className="mx-auto block w-[78%] max-w-[360px] sm:w-[46%] sm:max-w-[430px]"
              />
            </Reveal>
          </Parallax>

          <Parallax
            speed={34}
            className="-mt-10 sm:absolute sm:bottom-[26%] sm:left-[2%] sm:mt-0 sm:w-[42%] lg:w-[38%]"
          >
            <Reveal delay={0.16}>
              <UiCard
                src="/ui/food-feeling.png"
                alt="Your lower-energy days have more often followed fried or greasy food the night before"
                width={1104} height={261} tilt={-2.5} lift="lg"
              />
            </Reveal>
          </Parallax>

          <Parallax
            speed={16}
            className="mt-6 sm:absolute sm:right-[2%] sm:top-[16%] sm:mt-0 sm:w-[26%] lg:w-[23%]"
          >
            <Reveal delay={0.24}>
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
      <section className="px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-[68rem]">
          <Reveal>
            <SectionHeading
              eyebrow="How it works"
              title="Three small things, every day"
              body="Nothing to weigh, nothing to plan. Logging takes seconds and the nightly check-in takes a minute."
            />
          </Reveal>
          <div className="mt-12 grid gap-10 sm:mt-14 sm:grid-cols-3 sm:gap-12">
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
      <section className="px-6 py-14 sm:py-20">
        <div className="mx-auto grid max-w-[64rem] items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <SectionHeading
              center={false}
              eyebrow="Your coach"
              title="It reads your week, not a template"
              body="No generic tips. It spots a pattern in your own days, suggests one small change, and tells you plainly when it does not have enough to go on yet."
            />
          </Reveal>
          <Parallax speed={12}>
            <Reveal delay={0.08}>
              <UiCard src="/ui/coach-nudge.png" alt="A coach nudge in WhatYouAte" width={1104} height={390} tilt={1.2} lift="lg" />
            </Reveal>
          </Parallax>
        </div>
      </section>

      {/* ── PATTERNS ────────────────────────────────────────── */}
      <section className="px-6 py-14 sm:py-20">
        <div className="mx-auto grid max-w-[64rem] items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Parallax speed={-12} className="-mt-8 sm:-mt-10 lg:order-2 lg:-mt-36">
            <Reveal>
              <UiCard src="/ui/energy-dips.png" alt="When your energy dips, across your last nine nights" width={1208} height={488} tilt={-1.4} lift="lg" />
            </Reveal>
          </Parallax>
          <Reveal delay={0.08} className="lg:order-1">
            <SectionHeading
              center={false}
              eyebrow="What you start to see"
              title="Real counts from your own nights"
              body="Not vague encouragement. Real counts from your own week, like which time of day your energy dips most, always labelled as associations rather than causes."
            />
          </Reveal>
        </div>
      </section>

      {/* ── HABITS ──────────────────────────────────────────── */}
      <section className="px-6 py-14 sm:py-20">
        <div className="mx-auto grid max-w-[64rem] items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <SectionHeading
              center={false}
              eyebrow="Habits"
              title="Small enough to actually finish"
              body="Each habit runs three or five days and is built around what you said you want to feel better about. A glass of water in the afternoon. A walk after lunch."
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
      <section className="px-6 py-14 sm:py-20">
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
          <div className="mt-12 sm:mt-14">
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
            <div className="mx-auto mt-14 flex max-w-[34rem] flex-col items-center gap-4 rounded-3xl bg-white/45 px-8 py-9 text-center shadow-[0_28px_60px_-28px_rgba(16,42,86,0.5)] ring-1 ring-[#16233B]/[0.06] backdrop-blur-sm sm:flex-row sm:gap-6 sm:text-left">
              <AppleHealthMark size={68} />
              <div>
                <p className="text-[17px] font-semibold tracking-[-0.015em]" style={{ color: INK }}>
                  Works with Apple Health
                </p>
                <p className="mt-1.5 text-[15px] leading-[1.6]" style={{ color: BODY }}>
                  Steps, workouts and sleep come across on their own, so your coach sees
                  the whole picture without you typing any of it in.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── PROMISE ─────────────────────────────────────────── */}
      <section className="px-6 py-14 sm:py-20">
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
      <section className="px-6 pb-24 pt-14 sm:pb-28 sm:pt-20">
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
