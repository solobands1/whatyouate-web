"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DashboardView } from "./Dashboard";
import type { Dash } from "./api";
import { BODY, INK } from "../site";

// Made-up numbers for /creators/example: a US creator three months in, at a believable rate (about 1 in
// 4 signups subscribe). Followers' first month is free, so monthly subscribers only start paying the
// month after they join; the numbers follow that. Keep the landing page preview card in step.
//   Month 1: 30 signups ($30 bonus), 2 yearly subscribers ($56.10). Earned $86.10, paid out this month.
//   Month 2: 27 signups. 6 of month 1's free months convert ($19.86) and 1 yearly ($28.05). Earned $47.91.
//   Month 3: 35 signups, 9 new subscribers (7 of month 2's free months, 2 yearly) plus 6 renewals. Earned
//   $99.13. Free year earned (well over 3 followers with 2 paid months or a year).
const MONTHLY = 3.31; // 30% of $12.99 after Apple's 15%
const YEARLY = 28.05; // 30% of $109.99 after Apple's 15%

function exampleDash(now: Date): Dash {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const first = (offset: number) => new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const name = (offset: number, opts: Intl.DateTimeFormatOptions) => first(offset).toLocaleDateString("en-US", opts);
  const ym = (offset: number) => {
    const d = first(offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const joined = new Date(first(-2).getTime() + 3 * 86400000);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekly = [6, 9, 14, 21, 11].map((uses, i) => {
    const w = new Date(monday.getTime() - (4 - i) * 7 * 86400000);
    return { week: w.toLocaleDateString("en-US", { month: "short", day: "numeric" }), uses };
  });
  const r = (n: number) => Math.round(n * 100) / 100;
  const m1 = { bonus: 30, commission: r(2 * YEARLY) };
  const m2 = { bonus: 0, commission: r(6 * MONTHLY + YEARLY) };
  const m3 = { bonus: 0, commission: r(7 * MONTHLY + 2 * YEARLY + 6 * MONTHLY) };
  const paid = r(m1.bonus + m1.commission);
  return {
    creator: {
      name: "Alex",
      email: "you@example.com",
      instagram: "yourhandle",
      tiktok: "",
      country: "US",
      currency: "USD",
      payoutMethod: "wise",
      payoutEmail: "you@example.com",
      code: "YOURCODE",
      status: "active",
      joined: day(joined),
      bonusEnds: day(new Date(joined.getTime() + 30 * 86400000)),
      oldCodes: [],
    },
    // Over 3 followers have paid 2 months or a year by now, so the free year is earned.
    pro: { threeMonths: "EXAMPLEPROCODE0000", year: "EXAMPLEYEARCODE000", unlocked: true, paying: 3 },
    month: { label: name(0, { month: "long" }), codeUses: 52, qualified: 35, newPaid: 9, bonus: m3.bonus, commission: m3.commission },
    allTime: { paidSubs: 18, earned: r(paid + m2.commission + m3.commission), paidOut: paid },
    nextPayout: { date: name(1, { month: "long", day: "numeric" }), covers: name(-1, { month: "long" }), estimate: m2.commission },
    recurring: { monthly: r(13 * MONTHLY + (5 * YEARLY) / 12), active: 18 },
    // Some of this month's 35 signups started their free month and haven't paid yet.
    freeMonth: 8,
    statement: [
      { month: ym(-2), codeUses: 41, signups: 30, newPaid: 2, bonus: m1.bonus, commission: m1.commission, paid: 0, paidOn: "" },
      { month: ym(-1), codeUses: 38, signups: 27, newPaid: 7, bonus: 0, commission: m2.commission, paid: 0, paidOn: "" },
      { month: ym(0), codeUses: 52, signups: 35, newPaid: 9, bonus: 0, commission: m3.commission, paid, paidOn: day(first(0)) },
    ],
    weekly,
  };
}

export default function ExampleDashboard() {
  const d = useMemo(() => exampleDash(new Date()), []);
  return (
    // Sits higher than other creator pages: the shell's top padding is sized for a page title.
    <div className="-mt-8 sm:-mt-16">
      <Link href="/creators" className="mb-3 inline-flex items-center gap-1.5 text-[14px] font-semibold transition hover:opacity-70" style={{ color: BODY }}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 12L6 8l4-4" />
        </svg>
        Back to Creators
      </Link>
      <div
        className="mb-2 flex items-center justify-between gap-3 rounded-2xl bg-white/80 py-2 pl-4 pr-2 ring-1 ring-[#16233B]/[0.06]"
        style={{ boxShadow: "0 10px 24px -18px rgba(16,42,86,0.3)" }}
      >
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold leading-[1.3] text-[#2F6FC4]">Example Dashboard</p>
          <p className="text-[12.5px] leading-[1.35]" style={{ color: BODY }}>What you&apos;ll see when you sign up.</p>
        </div>
        <Link
          href="/creators/join?from=example"
          className="shrink-0 rounded-full px-4 py-2 text-[13.5px] font-semibold text-white transition hover:opacity-90"
          style={{ background: INK }}
        >
          Join
        </Link>
      </div>
      <DashboardView d={d} preview />
    </div>
  );
}
