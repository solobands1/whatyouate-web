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
  { n: "01", t: "Log", d: "Snap a photo, scan a barcode, say it out loud, or just type it. Water and activity take a tap." },
  { n: "02", t: "Reflect", d: "One minute before bed on your energy, sleep, mood, stress and digestion." },
  { n: "03", t: "Feel better", d: "Your coach finds what keeps turning up before your best days and your worst, then suggests what to try next." },
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
          <p className="mx-auto mt-6 max-w-[46ch] text-balance text-[clamp(16px,2vw,20px)] leading-[1.58] sm:max-w-[46rem]" style={{ color: BODY }}>
            Log food, water, sleep and movement in seconds. Your coach reads them
            against how you felt, shows you the patterns, and suggests one small change.
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
            className="mt-6 sm:absolute sm:right-[1%] sm:top-[24%] sm:mt-0 sm:w-[30%] lg:w-[27%]"
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
              body="Nothing to weigh, nothing to plan, and nothing you have to give up."
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

      {/* ── LOGGING ─────────────────────────────────────────── */}
      <section className="px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-[64rem]">
          <Reveal>
            <SectionHeading
              eyebrow="Logging"
              title="Fast enough that you actually keep it up"
              body="Snap a photo, scan a barcode, say it out loud, or type it in plain words. Water, activity, how you feel and the nightly check-in are just as easy to log."
            />
          </Reveal>
          <div className="mt-12 grid items-center gap-8 sm:mt-14 lg:grid-cols-2 lg:gap-14">
            <Parallax speed={-14}>
              <Reveal>
                <UiCard src="/ui/log-ways.png" alt="Log food by photo, manual add, barcode or quick add" width={1272} height={750} tilt={-1.2} lift="lg" />
              </Reveal>
            </Parallax>
            <Parallax speed={16}>
              <Reveal delay={0.08}>
                <UiCard src="/ui/log-result.png" alt="A logged cheeseburger and fries, with portion size" width={1143} height={917} tilt={1.2} lift="lg" className="mx-auto w-[80%] lg:w-[86%]" />
              </Reveal>
            </Parallax>
          </div>
          <Reveal delay={0.12}>
            <p className="mx-auto mt-10 max-w-[46ch] text-center text-[16px] leading-[1.7]" style={{ color: BODY }}>
              Log a cheeseburger and you get the numbers, a portion you can adjust, and
              nothing else. No warning colour, no comment.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── COACH ───────────────────────────────────────────── */}
      <section className="px-6 py-14 sm:py-20">
        <div className="mx-auto grid max-w-[64rem] items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <SectionHeading
              center={false}
              eyebrow="Your coach"
              title="Advice built from your week, not everyone else's"
              body="Your coach works from what is actually in your logs, points out what keeps lining up, and tells you when there is not enough there yet to make a suggestion. You always know where you stand."
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
          <Parallax speed={-12} className="-mt-16 sm:-mt-20 lg:order-2 lg:-mt-36">
            <Reveal>
              <UiCard src="/ui/energy-dips.png" alt="When your energy dips, across your last nine nights" width={1208} height={488} tilt={-1.4} lift="lg" />
            </Reveal>
          </Parallax>
          <Reveal delay={0.08} className="mt-8 lg:order-1 lg:mt-0">
            <SectionHeading
              center={false}
              eyebrow="What you start to see"
              title="Real counts from your own nights"
              body="Your patterns come from what you actually logged, like the time of day your energy dips most often, or the food that keeps turning up before a rough night. Counted, not guessed."
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
              body="Each habit runs three or five days and is built around what you said you want to feel better about. Small changes like a glass of water in the afternoon or a walk after lunch can make a real difference."
            />
          </Reveal>
          <Parallax speed={24}>
            <Reveal delay={0.08}>
              <UiCard src="/ui/habit-builder.png" alt="The Habit Builder card in WhatYouAte" width={1200} height={702} tilt={1.4} lift="lg" />
            </Reveal>
          </Parallax>
        </div>
      </section>

      {/* ── IS IT WORKING ───────────────────────────────────── */}
      <section className="px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-[64rem]">
          <Reveal>
            <SectionHeading
              eyebrow="Is it working"
              title="You find out whether it actually helped"
              body="Weeks get compared to the ones before them, and every habit you keep is checked against how you felt. When a change is helping, your coach says so. When it is too early to tell, it says so just as plainly."
            />
          </Reveal>
          <div className="mt-12 grid items-center gap-8 sm:mt-14 lg:grid-cols-2 lg:gap-14">
            <Parallax speed={-14}>
              <Reveal>
                <UiCard src="/ui/compared-week.png" alt="Sleep improved, energy improved, stress held steady" width={1196} height={478} tilt={-1.2} lift="lg" />
              </Reveal>
            </Parallax>
            <Parallax speed={16}>
              <Reveal delay={0.08}>
                <UiCard src="/ui/changes-helping.png" alt="Habits you kept, and whether they seem to be helping" width={1204} height={642} tilt={1.2} lift="lg" />
              </Reveal>
            </Parallax>
          </div>
        </div>
      </section>

      {/* ── THE REST OF THE DAY ─────────────────────────────── */}
      <section className="px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-[64rem]">
          <Reveal>
            <SectionHeading
              eyebrow="The rest of the day"
              title="Water, movement and sleep, in the same place"
              body="Energy is never only about food. Log water and activity in a tap and note how you slept in your nightly check-in. WhatYouAte lays it all out in one place and makes its suggestions from your own patterns."
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
            <p className="mx-auto max-w-[46ch] text-[clamp(19px,2.4vw,23px)] leading-[1.6]" style={{ color: "#22385C" }}>
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
            <p className="text-[13.5px] font-medium text-white/75">
              Free to download. Pro is $17.99 a month or $149.99 a year, after a 7 day
              free trial. Cancel anytime.
            </p>
            <p className="mt-3 max-w-[42ch] text-[13.5px] leading-[1.6] text-white/60">
              Your logs are yours. We do not sell your data, we do not advertise against
              it, and you can delete your account and everything in it whenever you like.
            </p>
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
            <Link href="/about" className="transition hover:text-white">About</Link>
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
