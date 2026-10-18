import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Reveal from "../../components/Reveal";
import Shell, { Card, Eyebrow, PrimaryButton, SecondaryButton, CREATOR_EMAIL } from "../../components/creators/Shell";
import { INK, BODY } from "../../components/site";

export const metadata: Metadata = {
  title: "Creators | WhatYouAte",
  description:
    "Share WhatYouAte with your followers. Earn 30% of every subscription you bring in for a full year, plus $1 for every signup in your first month.",
};

const STEPS = [
  {
    title: "Join and Pick Your Code",
    body: "Sign up in a minute and choose a code your followers will remember, like SARAH.",
  },
  {
    title: "Share It Your Way",
    body: "Post about the app and put your link in your bio. Anyone who uses your code gets their first month free. Your creator kit has captions, post ideas and app images ready to go.",
  },
  {
    title: "Get Paid Every Month",
    body: "Track your signups and earnings in your dashboard. Payouts go out monthly by Interac e-Transfer in Canada, or by PayPal or Wise everywhere else.",
  },
];

const FAQ = [
  {
    q: "Is there a follower minimum?",
    a: "No. If you talk about food, energy, gut health or feeling better, you're a good fit.",
  },
  {
    q: "What do my followers get?",
    a: "Their first month free when they enter your code in the app, or open your link.",
  },
  {
    q: "When do I get paid?",
    a: "Once a month. Each month's earnings are paid out at the start of the month after next, once any refunds have cleared. October's earnings are paid on December 1.",
  },
  {
    q: "How do I get paid?",
    a: "Creators in Canada earn and are paid in Canadian dollars by Interac e-Transfer. Everyone else earns and is paid in US dollars by PayPal or Wise, whichever you prefer.",
  },
  {
    q: "Can I see who used my code?",
    a: "No. To protect your followers' privacy, your dashboard shows totals only: code uses, signups, paid subscribers and earnings.",
  },
  {
    q: "Do I have to live in Canada or the US?",
    a: "No. Creators anywhere can join. Outside Canada, you're paid in USD by PayPal or Wise.",
  },
  {
    q: "Can I change my code later?",
    a: "Yes, any time. Your old code keeps working, so anything you've already posted still counts.",
  },
  {
    q: "Does it cost anything to join?",
    a: "No. It's free to join, and you can leave whenever you like.",
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <h2 className="mt-20 text-[clamp(23px,3.1vw,31px)] font-bold leading-[1.2] tracking-[-0.03em]">{title}</h2>
      {children}
    </Reveal>
  );
}

export default function Creators() {
  return (
    <Shell>
      <Reveal>
        <Eyebrow>Creators</Eyebrow>
        <h1 className="mt-5 text-balance text-[clamp(34px,5.4vw,56px)] font-bold leading-[1.06] tracking-[-0.04em]">
          Share WhatYouAte. Earn for a Full Year.
        </h1>
        <p className="mt-6 text-[18px] leading-[1.7]" style={{ color: BODY }}>
          Earn 30% of every subscription you bring in for 12 months, plus $1 for every signup in your first month.
          Your followers get their first month free.
        </p>
        <p className="mt-3 text-[13px]" style={{ color: "#8FA3C0" }}>
          Signups count once the new user is active for 3 days. See{" "}
          <Link href="/creators/terms" className="underline underline-offset-2">program terms</Link>.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <PrimaryButton href="/creators/join">Join the program</PrimaryButton>
          <SecondaryButton href="/creators/login">Log in</SecondaryButton>
        </div>
      </Reveal>

      <Reveal>
        <div className="mt-16 flex justify-center">
          <Image
            src="/device/iphone-patterns.webp"
            alt="The WhatYouAte Patterns screen"
            width={1500}
            height={2614}
            className="h-auto w-[230px] sm:w-[260px]"
            style={{ filter: "drop-shadow(0 30px 50px rgba(16,42,86,0.25))" }}
          />
        </div>
      </Reveal>

      <Section title="How It Works">
        <div className="mt-7 flex flex-col gap-4">
          {STEPS.map((s, i) => (
            <Card key={s.title} className="flex gap-5 px-6 py-6">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
                style={{ background: "#6FA8FF" }}
              >
                {i + 1}
              </span>
              <div>
                <h3 className="text-[17px] font-semibold tracking-[-0.02em]" style={{ color: INK }}>{s.title}</h3>
                <p className="mt-1.5 text-[15.5px] leading-[1.65]" style={{ color: BODY }}>{s.body}</p>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="What You Earn">
        <Card className="mt-7 divide-y divide-[#16233B]/[0.06]">
          <div className="flex items-baseline justify-between gap-6 px-6 py-5">
            <span className="text-[16px]" style={{ color: INK }}>Each Yearly Subscriber</span>
            <span className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: INK }}>about $25</span>
          </div>
          <div className="flex items-baseline justify-between gap-6 px-6 py-5">
            <span className="text-[16px]" style={{ color: INK }}>Each Monthly Subscriber</span>
            <span className="text-right">
              <span className="block text-[20px] font-bold tracking-[-0.02em]" style={{ color: INK }}>about $3</span>
              <span className="block whitespace-nowrap text-[13px]" style={{ color: BODY }}>a month, up to a year</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-6 px-6 py-5">
            <span className="text-[16px]" style={{ color: INK }}>Each Signup in Your First Month</span>
            <span className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: INK }}>$1</span>
          </div>
        </Card>
        <p className="mt-3 text-[13px] leading-[1.6]" style={{ color: "#8FA3C0" }}>
          Estimates in US dollars, based on current prices. You earn 30% of each subscription for its first 12 months, after Apple&apos;s fee. Creators in Canada earn in Canadian dollars: about $35 per yearly subscriber, about $4 a month per monthly subscriber, and $1 per signup.
        </p>
      </Section>

      <Section title="What We Ask">
        <ul className="mt-6 flex flex-col gap-3">
          {[
            "Use the app yourself first, so you have something real to share.",
            "Say it's sponsored, with #ad or a paid partnership label.",
            "Tag @whatyouate.app on Instagram and @whatyouate on TikTok, and invite @whatyouate.app as a collaborator on Instagram.",
            "Talk about your own experience. No claims that the app treats or cures anything.",
          ].map((t) => (
            <li key={t} className="flex gap-3.5 text-[17px] leading-[1.6]" style={{ color: INK }}>
              <span className="mt-[9px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: "#6FA8FF" }} />
              {t}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Common Questions">
        <div className="mt-6 flex flex-col gap-3">
          {FAQ.map((f) => (
            <Card key={f.q} className="px-6 py-1">
              <details className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold tracking-[-0.01em]" style={{ color: INK }}>
                  {f.q}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BODY} strokeWidth="2.2" strokeLinecap="round" className="shrink-0 transition group-open:rotate-45">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </summary>
                <p className="mt-3 text-[15.5px] leading-[1.65]" style={{ color: BODY }}>{f.a}</p>
              </details>
            </Card>
          ))}
        </div>
      </Section>

      <Reveal>
        <div className="mt-20 flex flex-col items-center gap-5 text-center">
          <h2 className="text-balance text-[clamp(24px,3.4vw,34px)] font-bold leading-[1.15] tracking-[-0.03em]">
            Ready to Start?
          </h2>
          <PrimaryButton href="/creators/join">Join the program</PrimaryButton>
          <p className="text-[14px]" style={{ color: INK }}>
            Questions? <a href={`mailto:${CREATOR_EMAIL}`} className="font-semibold underline underline-offset-2" style={{ color: INK }}>{CREATOR_EMAIL}</a>
          </p>
        </div>
      </Reveal>
    </Shell>
  );
}
