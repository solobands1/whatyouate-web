import Image from "next/image";
import Link from "next/link";
import Reveal from "../components/Reveal";
import {
  APP_STORE_URL, SKY, TINT, DEEP, INK, BODY,
  DownloadButton, UiCard, Eyebrow, SectionHeading,
} from "../components/site";

const STEPS = [
  { n: "01", t: "Eat", d: "Snap a photo, scan a barcode, say it out loud, or just type it. No weighing, no measuring." },
  { n: "02", t: "Reflect", d: "One minute before bed on your energy, sleep, mood, stress and digestion." },
  { n: "03", t: "Feel better", d: "Your coach reads both and tells you what it notices, one small change at a time." },
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-clip" style={{ background: "#F7FAFD", color: INK }}>

      {/* ── NAV ─────────────────────────────────────────────── */}
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-[68rem] items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2.5">
            <Image src="/icon-512.png" alt="" width={32} height={32} className="rounded-[9px] shadow-sm" priority />
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
      <section className="relative px-6 pb-8 pt-32 sm:pt-36" style={{ background: SKY }}>
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
            <p className="text-[13.5px] font-medium" style={{ color: "#8FA3C0" }}>
              Free on iPhone · 7 day Pro trial · No commitment
            </p>
          </div>
        </div>

        {/* Lifted app UI instead of a phone mockup. The two cards are offset on
            opposite edges so they read as a deliberate composition rather than
            one card accidentally sitting on top of another. */}
        <div className="relative mx-auto mt-14 w-full max-w-[54rem] pb-14 sm:mt-16 sm:pb-[17%]">
          <Reveal>
            <UiCard
              src="/ui/food-feeling.png"
              alt="Your lower-energy days have more often followed fried or greasy food the night before"
              width={1104}
              height={261}
              tilt={-2}
              lift="lg"
              priority
              className="z-20 w-full sm:w-[60%]"
            />
          </Reveal>
          <Reveal delay={0.12}>
            <UiCard
              src="/ui/streak-week.png"
              alt="This week, a fourteen night reflection streak"
              width={1208}
              height={493}
              tilt={2}
              lift="md"
              className="z-10 mt-7 w-full sm:absolute sm:right-0 sm:bottom-0 sm:mt-0 sm:w-[52%]"
            />
          </Reveal>
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
              <Reveal key={s.t} delay={0.07 * i}>
                <div className="text-center sm:text-left">
                  <span className="text-[12px] font-semibold tracking-[0.16em]" style={{ color: "#9CC0F0" }}>{s.n}</span>
                  <h3 className="mt-3 text-[21px] font-semibold tracking-[-0.02em]">{s.t}</h3>
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
      <section className="px-6 py-20 sm:py-28" style={{ background: TINT }}>
        <div className="mx-auto grid max-w-[64rem] items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <SectionHeading
              center={false}
              eyebrow="Your coach"
              title="It reads your week, not a template"
              body="No generic tips. It spots a pattern in your own days, suggests one small change, and tells you plainly when it does not have enough to go on yet."
            />
          </Reveal>
          <Reveal delay={0.08}>
            <UiCard src="/ui/coach-nudge.png" alt="A coach nudge in WhatYouAte" width={1104} height={390} tilt={1.2} lift="lg" />
          </Reveal>
        </div>
      </section>

      {/* ── PATTERNS ────────────────────────────────────────── */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-[64rem]">
          <Reveal>
            <SectionHeading
              eyebrow="What you start to see"
              title="Real counts from your own nights"
              body="Not vague encouragement. Actual numbers, drawn from what you logged, and labelled as associations rather than causes."
            />
          </Reveal>
          <div className="mt-14 grid items-start gap-8 sm:mt-16 sm:grid-cols-2 sm:gap-10">
            <Reveal>
              <UiCard src="/ui/energy-dips.png" alt="When your energy dips, across your last nine nights" width={1208} height={488} tilt={-1} />
            </Reveal>
            <Reveal delay={0.08}>
              <UiCard src="/ui/habit-builder.png" alt="The Habit Builder card in WhatYouAte" width={1200} height={702} tilt={1} className="sm:mt-10" />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── PROMISE ─────────────────────────────────────────── */}
      <section className="px-6 py-20 sm:py-28" style={{ background: TINT }}>
        <Reveal>
          <div className="mx-auto max-w-[40rem] text-center">
            <h2 className="text-balance text-[clamp(26px,3.8vw,40px)] font-bold leading-[1.2] tracking-[-0.03em]">
              No red warnings. No guilt trips. No lecture about a cheeseburger.
            </h2>
            <p className="mx-auto mt-6 max-w-[44ch] text-[17px] leading-[1.72]" style={{ color: BODY }}>
              Built for ordinary days, not for chasing numbers. Log it, see what it does
              to your week, and get on with your day.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="px-6 py-24 sm:py-32" style={{ background: DEEP }}>
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
      <footer className="px-6 py-14">
        <div className="mx-auto flex max-w-[64rem] flex-col items-center gap-5 text-center">
          <div className="flex items-center gap-2">
            <Image src="/icon.png" alt="" width={22} height={22} className="rounded-[6px]" />
            <span className="text-[14px] font-semibold tracking-[-0.015em]">WhatYouAte</span>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[14px]" style={{ color: BODY }}>
            <Link href="/privacy" className="transition hover:opacity-70">Privacy Policy</Link>
            <Link href="/terms" className="transition hover:opacity-70">Terms of Use</Link>
            <a href="mailto:hello@minimul.app" className="transition hover:opacity-70">Support</a>
          </nav>
          <span className="text-[13px]" style={{ color: "#9CADC6" }}>
            © {new Date().getFullYear()} WhatYouAte. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
