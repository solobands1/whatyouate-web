import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Reveal from "../../components/Reveal";
import Menu from "../../components/Menu";
import { INK, BODY, DownloadButton } from "../../components/site";

export const metadata: Metadata = {
  title: "About WhatYouAte",
  description:
    "Why WhatYouAte exists: a food and feeling journal built for ordinary days, not for chasing numbers.",
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
    <h2 className="mt-16 text-[clamp(24px,3.2vw,32px)] font-bold leading-[1.2] tracking-[-0.03em]">
      {children}
    </h2>
  );
}

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
            <h1 className="text-balance text-[clamp(34px,5.4vw,56px)] font-bold leading-[1.06] tracking-[-0.04em]">
              Why this app exists
            </h1>

            <P>
              Most food apps are built for people who already enjoy tracking. They assume
              you want to weigh things, hit targets, and treat eating as a scoreboard.
              That genuinely works for some people. For most of us it lasts about a week,
              and then the guilt starts doing the talking.
            </P>

            <P>
              This one starts somewhere else. It starts with the fact that some days you
              feel great, other days you are flat by two in the afternoon, and it is
              surprisingly hard to say why.
            </P>
          </Reveal>

          <Reveal>
            <H>Who it is for</H>
            <P>
              Ordinary days. Not athletes chasing macros, not anyone optimising a
              physique. If you have ever wondered why your energy fell off a cliff after
              lunch, or why some weeks feel steadier than others, that is the person this
              was built for.
            </P>
          </Reveal>

          <Reveal>
            <H>What it will not do</H>
            <P>
              It will not colour your day red for eating a cheeseburger. It will not
              lecture you, guilt you, or dress a calorie count up as a moral verdict. You
              log what you ate, you see what it seems to do to your week, and you get on
              with your day.
            </P>
          </Reveal>

          <Reveal>
            <H>It says when it does not know</H>
            <P>
              This is the part most apps skip. Your coach works from real counts drawn
              from your own logs, and it labels what it finds as associations rather than
              causes, because that is what they are. When there is not enough to go on
              yet, it says so plainly instead of inventing a story from three data points.
            </P>
            <P>
              An app that admits uncertainty is easier to trust when it does have
              something useful to tell you.
            </P>
          </Reveal>

          <Reveal>
            <H>Small on purpose</H>
            <P>
              A meal takes seconds to log. The nightly check-in takes a minute. Habits run
              three days, not thirty, because something you can actually finish beats
              something you abandon on day four. None of that is an accident. Every part
              of it is sized to survive a normal, busy week.
            </P>
          </Reveal>

          <Reveal>
            <div className="mt-20 rounded-3xl bg-white/70 px-8 py-10 ring-1 ring-[#16233B]/[0.06] backdrop-blur-sm">
              <h2 className="text-[20px] font-semibold tracking-[-0.02em]" style={{ color: INK }}>
                Still being built
              </h2>
              <P>
                WhatYouAte is developed independently and changes often. If something is
                wrong, confusing, or missing, saying so genuinely does change what gets
                built next.
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
