"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CREATOR_EMAIL } from "./Shell";
import CreatorNav from "./CreatorNav";
import { SAMPLE_STATS as S, PAYOUT_LABEL, currencyFor, money } from "./sample";
import { useCreator, longDate } from "./store";
import { BODY, INK } from "../site";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {}
      }}
      className="flex-1 rounded-full px-5 py-3 text-[14.5px] font-semibold transition hover:opacity-90"
      style={{ background: copied ? "#15803D" : INK, color: "#fff" }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function Stat({ label, value, hint, small = false }: { label: string; value: string; hint?: string; small?: boolean }) {
  return (
    <div className={`rounded-2xl bg-white ring-1 ring-[#16233B]/[0.06] ${small ? "px-4 py-3.5" : "px-5 py-4"}`}>
      <p className="text-[13px] font-medium" style={{ color: BODY }}>{label}</p>
      <p className={`mt-1 font-bold tracking-[-0.03em] ${small ? "text-[20px]" : "text-[26px]"}`} style={{ color: INK }}>{value}</p>
      {hint && <p className="mt-0.5 text-[12px]" style={{ color: "#8FA3C0" }}>{hint}</p>}
    </div>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-10 flex items-baseline justify-between">
      <h2 className="text-[19px] font-bold tracking-[-0.02em]" style={{ color: INK }}>{children}</h2>
      {right}
    </div>
  );
}

function WeeklyChart() {
  const max = Math.max(1, ...S.weekly.map((w) => w.uses));
  return (
    <div className="flex items-end gap-3 px-1">
      {S.weekly.map((w, i) => {
        const h = Math.max(4, Math.round((w.uses / max) * 100));
        const last = i === S.weekly.length - 1;
        return (
          <div key={w.week} className="flex flex-1 flex-col items-center gap-2">
            <span className="text-[12px] font-semibold" style={{ color: w.uses ? INK : "#B4C3D8" }}>{w.uses}</span>
            <div className="flex h-28 w-full items-end">
              <div className="w-full rounded-lg" style={{ height: `${h}%`, background: last ? "#B9D4FA" : "#6FA8FF" }} />
            </div>
            <span className="whitespace-nowrap text-[11px]" style={{ color: "#8FA3C0" }}>{w.week}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const C = useCreator();
  const bonusActive = new Date(C.bonusEnds + "T23:59:59") >= new Date();
  // A worked example for the payout row: last month's earnings and the month they're paid in.
  const payNow = (() => {
    const now = new Date(); const m = (k: number) => new Date(now.getFullYear(), now.getMonth() + k, 1).toLocaleDateString("en-CA", { month: "long" });
    return { earned: `${m(-1)}'s`, paid: m(1) };
  })();
  const cur = currencyFor(C.country);
  const link = `whatyouate.app/c/${C.code}`;
  const first = C.name.split(" ")[0];

  return (
    <div>
      <CreatorNav />
      <h1 className="mt-8 text-[clamp(28px,4.4vw,40px)] font-bold leading-[1.1] tracking-[-0.04em]">Hi {first}</h1>

      {/* Code and share link */}
      <Card className="mt-7 px-6 py-6">
        <p className="text-[13px] font-medium" style={{ color: BODY }}>Your Code</p>
        <p className="mt-1 text-[40px] font-bold tracking-[0.04em]" style={{ color: INK }}>{C.code}</p>
        <p className="mt-1 text-[15px]" style={{ color: BODY }}>
          Your link: <span className="font-semibold" style={{ color: INK }}>{link}</span>
        </p>
        <div className="mt-5 flex gap-2.5">
          <CopyButton text={`https://${link}`} label="Copy link" />
          <CopyButton text={C.code} label="Copy code" />
        </div>
        <p className="mt-4 text-[13.5px] leading-[1.55]" style={{ color: BODY }}>
          Anyone who uses your code or link gets their first month free.
        </p>
      </Card>

      <Link
        href="/creators/kit"
        className="mt-4 flex items-center justify-between gap-4 rounded-3xl px-6 py-5 text-white transition hover:-translate-y-0.5"
        style={{ background: "linear-gradient(135deg, #6FA8FF 0%, #3F7FD6 100%)", boxShadow: "0 18px 40px -22px rgba(47,111,196,0.7)" }}
      >
        <div>
          <p className="text-[17px] font-bold tracking-[-0.02em]">Creator Kit</p>
          <p className="mt-1 text-[14px] leading-[1.5] text-white/85">Captions with your code, post ideas, what to say and app screenshots.</p>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>

      {/* How you earn */}
      <SectionTitle>How You Earn</SectionTitle>
      <Card className="divide-y divide-[#16233B]/[0.06]">
        {[
          {
            big: "30%",
            title: "30% of Every Subscription, for a Full Year",
            body: `One post can keep paying you. When someone subscribes with your code, you earn 30% of their subscription for their first 12 months, after Apple's fee. That's about ${cur === "CAD" ? "$35 CAD" : "$25 USD"} for each yearly subscriber, or about ${cur === "CAD" ? "$4 CAD" : "$3 USD"} every month a monthly subscriber sticks around.`,
          },
          {
            big: "$1",
            title: "A Head Start: $1 for Every New User",
            body: bonusActive
              ? `For your first month, until ${longDate(C.bonusEnds)}, everyone who tries the app with your code earns you $1 ${cur}, even if they never subscribe. They just need to use it on 3 different days in their first week.`
              : `Your first-month bonus ended on ${longDate(C.bonusEnds)}. You still earn 30% of every subscription.`,
          },
          {
            big: "cal",
            title: "Paid Every Month",
            body: `Your earnings land on the 1st of each month by ${PAYOUT_LABEL[C.payoutMethod]}${cur === "CAD" ? ", in Canadian dollars" : ", in US dollars"}. Each payment covers the month before last, so refunds have time to clear: ${payNow.earned} earnings arrive ${payNow.paid} 1. Anything under $10 rolls into your next payment.`,
          },
        ].map((r) => (
          <div key={r.title} className="flex gap-4 px-5 py-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[16px] font-bold tracking-[-0.02em] text-white"
              style={{ background: "linear-gradient(135deg, #6FA8FF 0%, #3F7FD6 100%)" }}
            >
              {r.big === "cal" ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
                  <path d="M3.5 10h17M8 3v4M16 3v4" />
                </svg>
              ) : (
                r.big
              )}
            </span>
            <div>
              <p className="text-[15.5px] font-semibold leading-[1.35]" style={{ color: INK }}>{r.title}</p>
              <p className="mt-1 text-[14px] leading-[1.6]" style={{ color: BODY }}>{r.body}</p>
            </div>
          </div>
        ))}
        <div className="px-5 py-3.5">
          <Link href="/creators/terms" className="text-[14px] font-semibold" style={{ color: "#2F6FC4" }}>Full program terms</Link>
        </div>
      </Card>

      {/* This month */}
      <SectionTitle right={<span className="text-[13px]" style={{ color: "#8FA3C0" }}>{S.month.label}</span>}>This Month</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Code Uses" value={String(S.month.codeUses)} />
        <Stat label="Signups That Count" value={String(S.month.qualified)} hint="Active on 3 days in their first week" />
        <Stat label="New Paid Subscribers" value={String(S.month.newPaid)} />
        <Stat label="Earned So Far" value={money(S.month.bonus + S.month.commission, cur).replace(` ${cur}`, "")} hint={cur} />
      </div>
      <p className="mt-3 text-[13px]" style={{ color: BODY }}>
        {money(S.month.bonus, cur)} from signups, {money(S.month.commission, cur)} from subscriptions.
      </p>

      {/* Weekly */}
      <SectionTitle>Code Uses by Week</SectionTitle>
      <Card className="px-5 pb-4 pt-5">
        <WeeklyChart />
        <p className="mt-3 text-[12px]" style={{ color: "#8FA3C0" }}>This week so far is shown lighter.</p>
      </Card>

      {/* Payout */}
      <SectionTitle>Next Payout</SectionTitle>
      <Card className="px-6 py-5">
        <p className="text-[14px] font-medium" style={{ color: BODY }}>{S.nextPayout.date}</p>
        <p className="mt-1 text-[28px] font-bold tracking-[-0.03em]" style={{ color: INK }}>
          about {money(S.nextPayout.estimate, cur).replace(` ${cur}`, "")}
          <span className="ml-1.5 text-[14px] font-medium" style={{ color: BODY }}>{cur}</span>
        </p>
        <p className="mt-2 text-[14px] leading-[1.55]" style={{ color: BODY }}>
          By {PAYOUT_LABEL[C.payoutMethod]} to {C.payoutEmail}. Covers October, once refunds have cleared.
        </p>
      </Card>

      {/* All time */}
      <SectionTitle>All Time</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <Stat small label="Paid Subs" value={String(S.allTime.paidSubs)} />
        <Stat small label="Earned" value={money(S.allTime.earned, cur).replace(` ${cur}`, "")} />
        <Stat small label="Paid Out" value={money(S.allTime.paidOut, cur).replace(` ${cur}`, "")} />
      </div>

      {/* Payout history */}
      <SectionTitle>Payout History</SectionTitle>
      <Card className="px-6 py-5">
        <p className="text-[14.5px] leading-[1.55]" style={{ color: BODY }}>
          Your first payout will show here after December 1.
        </p>
      </Card>

      <p className="mt-6 text-[13.5px] leading-[1.6]" style={{ color: BODY }}>
        Label every post as sponsored, and never say the app treats or cures anything.{" "}
        <Link href="/creators/terms" className="font-semibold" style={{ color: "#2F6FC4" }}>Program terms</Link>
      </p>

      <p className="mt-10 text-center text-[14px]" style={{ color: INK }}>
        Questions? <a href={`mailto:${CREATOR_EMAIL}`} className="font-semibold underline underline-offset-2" style={{ color: INK }}>{CREATOR_EMAIL}</a>
      </p>
    </div>
  );
}
