import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "../../components/Reveal";
import Shell, { Card, Eyebrow, PrimaryButton, SecondaryButton, CREATOR_EMAIL, TrialTag } from "../../components/creators/Shell";
import { INK, BODY } from "../../components/site";

export const metadata: Metadata = {
  title: "Creators | WhatYouAte",
  description:
    "Share WhatYouAte with your followers. Earn 30% of every subscription you bring in for a full year, plus $1 for every signup in your first month.",
};

const STEPS = [
  {
    title: "Join and Pick Your Creator Code",
    body: "Sign up in a minute and choose a code your followers will remember, like your name or handle.",
  },
  {
    title: "Share It Your Way",
    body: "Post about the app and put your link in your bio. Followers who enter your code in the app get their first month free. Your Creator Kit has captions, post ideas, videos and images ready to go.",
  },
  {
    title: "Get Paid Every Month",
    body: "Track your signups and earnings in your dashboard. Payouts go out monthly by Interac e-Transfer in Canada, or by bank deposit through Wise everywhere else.",
  },
];

const FAQ = [
  {
    q: "Is there a follower minimum?",
    a: "No. If you talk about food, energy, gut health or feeling better, you're a good fit.",
  },
  {
    q: "What do my followers get?",
    a: "Their first month of WhatYouAte Pro free. They enter your code when they sign up in the app and can start their free month straight away. After that it's the regular monthly price unless they cancel. Your link shows them the code and takes them to the App Store.",
  },
  {
    q: "Do I get the app free?",
    a: "Yes. You get 3 months of WhatYouAte Pro free when you join, and a free year once 3 of your followers have each paid for 2 months, or bought a yearly plan. Neither one renews, so you're never charged.",
  },
  {
    q: "When do I get paid?",
    a: "Once a month. Each month's earnings are paid out at the start of the month after next, once any refunds have cleared. October's earnings are paid on December 1.",
  },
  {
    q: "How do I get paid?",
    a: "Creators in Canada earn and are paid in Canadian dollars by Interac e-Transfer. Everyone else earns and is paid in US dollars, by bank deposit straight to your account, sent through Wise. You don't need a Wise account.",
  },
  {
    q: "Can I see who used my code?",
    a: "No. To protect your followers' privacy, your dashboard shows totals only: code uses, signups, paid subscribers and earnings.",
  },
  {
    q: "Do I have to live in Canada or the US?",
    a: "No. Creators anywhere can join. Outside Canada, you're paid in USD by bank deposit, sent through Wise.",
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

// What a creator's dashboard looks like, with the same example numbers as /creators/example
// (components/creators/ExampleDashboard.tsx). Built in code so it stays sharp and matches the real one.
function DashboardPreview() {
  return (
    <div className="mt-14 flex justify-center">
      <div
        className="w-full max-w-[360px] rounded-[28px] bg-white/90 p-5 ring-1 ring-[#16233B]/[0.06]"
        style={{ boxShadow: "0 30px 60px -30px rgba(16,42,86,0.35)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] font-medium" style={{ color: BODY }}>Your Creator Code</p>
            <div className="mb-1 mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <p className="text-[22px] font-bold tracking-[0.04em]" style={{ color: INK }}>YOURCODE</p>
              <TrialTag small />
            </div>
            <p className="text-[13px]" style={{ color: BODY }}>whatyouate.app/c/YOURCODE</p>
          </div>
          <span className="rounded-full bg-[#EEF5FE] px-2.5 py-1 text-[11px] font-semibold text-[#2F6FC4]">Example</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["This Month", "$99.13"],
            ["Signups", "35"],
            ["Subscribers", "18"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl px-3 py-2.5 ring-1 ring-[#16233B]/[0.06]">
              <p className="text-[11px] font-medium" style={{ color: BODY }}>{label}</p>
              <p className="mt-0.5 text-[18px] font-bold tracking-[-0.02em]" style={{ color: INK }}>{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-2xl px-4 py-3.5 text-white" style={{ background: "linear-gradient(135deg, #6FA8FF 0%, #3F7FD6 100%)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">Recurring Each Month</p>
          <p className="mt-0.5 text-[20px] font-bold tracking-[-0.02em]">
            about $55 <span className="text-[13px] font-semibold text-white/85">a month</span>
          </p>
          <p className="text-[12px] text-white/85">From your subscribers, without posting again.</p>
        </div>
      </div>
    </div>
  );
}

const FOLLOWER_GETS = [
  {
    title: "A Month of Pro, Free",
    body: "Everything in WhatYouAte Pro for their first month: the food and feeling connections, daily coaching and their full nutrition picture.",
  },
  {
    title: "Easy to Claim",
    body: "They enter your code when they sign up, or from Profile in their first week. Your link shows them the code.",
  },
  {
    title: "No Surprises",
    body: "After the free month it's the regular monthly price unless they cancel, and they can cancel anytime in Settings.",
  },
];

// A small version of the app's "Your First Month Is Free" screen (components/CreatorOffer.tsx in the app).
// The outline and the all-round shadow keep its top edge as clear as the bottom on the pale page.
function FollowerOfferMock() {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-full max-w-[300px] rounded-[26px] bg-white px-6 py-7 text-center ring-1 ring-[#16233B]/[0.09]"
        style={{ boxShadow: "0 2px 10px rgba(16,42,86,0.08), 0 24px 50px -24px rgba(16,42,86,0.35)" }}
      >
        <img src="/icon-512.png" alt="" className="mx-auto h-12 w-12 rounded-[13px]" />
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2F6FC4]">Your code · YOURCODE</p>
        <p className="mt-1.5 text-[19px] font-bold tracking-[-0.02em]" style={{ color: INK }}>Your First Month Is Free</p>
        <p className="mt-2 text-[13px] leading-[1.55]" style={{ color: BODY }}>
          Get everything in WhatYouAte Pro free for a month.
        </p>
        <div className="mt-5 rounded-xl bg-[#6FA8FF] py-3 text-[14px] font-semibold text-white">Start My Free Month</div>
        <p className="mt-2.5 text-[10.5px] leading-[1.5]" style={{ color: "#8FA3C0" }}>
          Free for 1 month, then the regular monthly price. Cancel anytime in Settings.
        </p>
        <p className="mt-2 text-[13px] font-medium" style={{ color: BODY }}>Not now, start with 7 days free</p>
      </div>
      <p className="mt-3 text-[12.5px]" style={{ color: "#8FA3C0" }}>What your followers see in the app</p>
    </div>
  );
}

function DashboardPitch() {
  return (
    <div className="mx-auto mt-7 max-w-[30rem] text-center">
      <p className="text-[16px] leading-[1.7]" style={{ color: BODY }}>
        Your dashboard keeps everything in one place: your code and link, signups, subscribers, what you&apos;ve
        earned and when you&apos;ll be paid. No spreadsheets, no chasing payments.
      </p>
      <Link
        href="/creators/example"
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-full px-7 py-[15px] text-[15px] font-semibold tracking-[-0.01em] text-white transition duration-200 hover:-translate-y-0.5"
        style={{ background: "linear-gradient(135deg, #6FA8FF 0%, #3F7FD6 100%)" }}
      >
        See Example Dashboard
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 4l4 4-4 4" />
        </svg>
      </Link>
      <p className="mt-3 text-[12.5px]" style={{ color: "#8FA3C0" }}>Example only. What you earn depends on your audience.</p>
    </div>
  );
}

export default function Creators() {
  return (
    <Shell>
      {/* Sits a little closer to the header than the shell's default top padding. */}
      <Reveal className="-mt-8 sm:-mt-12">
        <Eyebrow>Creators</Eyebrow>
        <h1 className="mt-5 text-balance text-[clamp(34px,5.4vw,56px)] font-bold leading-[1.06] tracking-[-0.04em]">
          Share WhatYouAte
          <br />
          Earn For a Full Year
        </h1>
        <p className="mt-6 text-[18px] leading-[1.7]" style={{ color: BODY }}>
          Earn 30% of every subscription you bring in for 12 months, plus $1 for every signup in your first month.
          Your followers get their first month free.
        </p>
        <p className="mt-3 text-[13px]" style={{ color: "#8FA3C0" }}>
          Signups count once the new user has used the app on 3 days in their first week. See{" "}
          <Link href="/creators/terms" className="underline underline-offset-2">program terms</Link>.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <PrimaryButton href="/creators/join">Join The Program</PrimaryButton>
          <SecondaryButton href="/creators/login">Log In</SecondaryButton>
        </div>
      </Reveal>

      <Reveal>
        <DashboardPreview />
        <DashboardPitch />
      </Reveal>

      <Section title="What Your Followers Get">
        <div className="mt-7 grid items-center gap-8 sm:grid-cols-[1fr_300px]">
          <Card className="divide-y divide-[#16233B]/[0.06]">
            {FOLLOWER_GETS.map((g) => (
              <div key={g.title} className="flex gap-4 px-5 py-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white" style={{ background: "linear-gradient(135deg, #6FA8FF 0%, #3F7FD6 100%)" }}>
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                </span>
                <div>
                  <p className="text-[15.5px] font-semibold" style={{ color: INK }}>{g.title}</p>
                  <p className="mt-1 text-[14px] leading-[1.6]" style={{ color: BODY }}>{g.body}</p>
                </div>
              </div>
            ))}
          </Card>
          <FollowerOfferMock />
        </div>
      </Section>

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
            <span className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: INK }}>about $28</span>
          </div>
          <div className="flex items-baseline justify-between gap-6 px-6 py-5">
            <span className="text-[16px]" style={{ color: INK }}>Each Monthly Subscriber</span>
            <span className="text-right">
              <span className="block text-[20px] font-bold tracking-[-0.02em]" style={{ color: INK }}>about $3.30</span>
              <span className="block whitespace-nowrap text-[13px]" style={{ color: BODY }}>a month, up to a year</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-6 px-6 py-5">
            <span className="text-[16px]" style={{ color: INK }}>Each Signup in Your First Month</span>
            <span className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: INK }}>$1</span>
          </div>
        </Card>
        <p className="mt-3 text-[13px] leading-[1.6]" style={{ color: "#8FA3C0" }}>
          Estimates in US dollars, based on current prices. You earn 30% of each subscription for its first 12 months, after Apple&apos;s fee. Creators in Canada earn in Canadian dollars: about $38 per yearly subscriber, about $4.50 a month per monthly subscriber, and $1 per signup.
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
          <PrimaryButton href="/creators/join">Join The Program</PrimaryButton>
          <p className="text-[14px]" style={{ color: INK }}>
            Questions? <a href={`mailto:${CREATOR_EMAIL}`} className="font-semibold underline underline-offset-2" style={{ color: INK }}>{CREATOR_EMAIL}</a>
          </p>
        </div>
      </Reveal>
    </Shell>
  );
}
