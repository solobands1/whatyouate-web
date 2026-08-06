import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Reveal from "../../components/Reveal";
import Menu from "../../components/Menu";
import { INK, BODY, DownloadButton } from "../../components/site";

export const metadata: Metadata = {
  title: "Our mission | WhatYouAte",
  description:
    "Helping people understand how food and daily habits actually make them feel, and making that easy enough to keep up.",
};

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 text-[17px] leading-[1.75]" style={{ color: BODY }}>
      {children}
    </p>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-16 text-[clamp(23px,3.1vw,31px)] font-bold leading-[1.2] tracking-[-0.03em]">
      {children}
    </h2>
  );
}

const QUESTIONS = [
  "Why am I exhausted after this meal?",
  "Which foods give me steady energy?",
  "What sets off the brain fog and the bloating?",
  "Am I actually getting better over time?",
];

export default function About() {
  return (
    <div className="min-h-screen overflow-x-clip">
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-[68rem] items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/icon-512.png" alt="" width={30} height={30} className="rounded-[8px] ring-1 ring-black/5" priority />
            <span className="text-[16px] font-semibold tracking-[-0.015em]">WhatYouAte</span>
          </Link>
          <Menu />
        </div>
      </header>

      <main className="px-6 pt-32 sm:pt-36">
        <div className="mx-auto max-w-[42rem]">
          <Reveal>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#8FA3C0" }}>
              Our mission
            </p>
            <h1 className="mt-5 text-balance text-[clamp(32px,5vw,52px)] font-bold leading-[1.08] tracking-[-0.04em]">
              Help people understand how food and habits make them feel
            </h1>

            <P>
              Not how many calories it contained. How it made them feel. Nutrition apps
              have spent a decade getting very good at counting, and almost no time on the
              question people actually ask, which is why some days go well and others do
              not.
            </P>

            <P>
              WhatYouAte exists to close that gap, and to make closing it light enough that
              an ordinary, busy person can keep it up.
            </P>
          </Reveal>

          <Reveal>
            <H>The questions worth answering</H>
            <ul className="mt-6 flex flex-col gap-3">
              {QUESTIONS.map((q) => (
                <li key={q} className="flex gap-3.5 text-[17px] leading-[1.6]" style={{ color: INK }}>
                  <span className="mt-[9px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: "#6FA8FF" }} />
                  {q}
                </li>
              ))}
            </ul>
            <P>
              They sound simple. Answering them needs a few things written down together:
              what you ate, how much water you drank, whether you slept well or moved
              much, and how the day actually went. Almost nothing asks for that last
              part, which is why these questions usually go unanswered.
            </P>
            <P>
              That gap is not academic. Fatigue, brain fog, restless sleep and digestion
              that comes and goes are ordinary complaints, and the honest answer for most
              people is that nobody has ever shown them their own pattern.
            </P>
          </Reveal>

          <Reveal>
            <H>So the app asks for all of it</H>
            <P>
              Logging a meal takes seconds, and water and activity take a couple of taps. The nightly
              check-in takes a minute and covers energy, sleep, mood, stress and
              digestion. From there your AI coach looks for
              what lines up, like the foods that tend to turn up before your low energy
              days, or the time of day your energy dips most often.
            </P>
            <P>
              The aim was never perfect records. It is awareness, built from your own days
              rather than from generic advice about what people in general should eat.
            </P>
          </Reveal>

          <Reveal>
            <H>What we will not do</H>
            <P>
              We will not colour your day red for eating a bag of chips. No guilt trips, no
              lectures, no calorie count dressed up as a moral verdict. You log what you
              ate, you see what it seems to do to your week, and you get on with your day.
            </P>
          </Reveal>

          <Reveal>
            <H>It will tell you when it is not sure</H>
            <P>
              This is the part most apps skip. Your AI coach works from real counts out of
              your own logs, and calls what it finds an association rather than a cause,
              because that is what it is. When there is not enough to go on yet, it tells
              you, instead of spinning a story out of very little.
            </P>
            <P>
              None of it is medical advice, and it is not trying to be. It is a record of
              your own days, read back to you honestly.
            </P>
          </Reveal>

          <Reveal>
            <H>Small on purpose</H>
            <P>
              Habits run three or five days, because something you can
              finish beats something you abandon in week two. Everything here is sized to survive
              a normal, busy week. That part is deliberate.
            </P>
          </Reveal>

          <Reveal>
            <div className="mt-20 rounded-3xl bg-white/70 px-8 py-10 ring-1 ring-[#16233B]/[0.06] backdrop-blur-sm">
              <h2 className="text-[20px] font-semibold tracking-[-0.02em]" style={{ color: INK }}>
                Independent, and updated often
              </h2>
              <P>
                There is no diet company behind this and nothing to sell you beyond the
                app itself, so there is no reason to tell you anything but the truth.
                Updates go out often, and when someone says a thing is wrong, confusing
                or missing, that is usually what gets built next.
              </P>
              <a
                href="mailto:hello@minimul.app"
                className="mt-6 inline-flex text-[16px] font-semibold"
                style={{ color: "#2F6FC4" }}
              >
                Get in touch
              </a>
            </div>
          </Reveal>

          <Reveal>
            <div className="mt-20 flex flex-col items-center gap-5 text-center">
              <h2 className="text-balance text-[clamp(24px,3.4vw,34px)] font-bold leading-[1.15] tracking-[-0.03em]">
                Give it a week. See how you feel.
              </h2>
              <DownloadButton />
            </div>
          </Reveal>
        </div>
      </main>

      <footer className="px-6 pb-14 pt-24">
        <div className="mx-auto flex max-w-[64rem] flex-col items-center gap-5 text-center">
          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[14px]" style={{ color: BODY }}>
            <Link href="/" className="transition hover:opacity-70">Home</Link>
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
