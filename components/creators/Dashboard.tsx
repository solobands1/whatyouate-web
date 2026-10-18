"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CREATOR_EMAIL } from "./Shell";
import { SAMPLE_CREATOR as C, SAMPLE_STATS as S, PAYOUT_LABEL, currencyFor, money } from "./sample";
import { BODY, INK } from "../site";

const HOOKS = [
  "I tracked what I ate and how I felt for two weeks. Here's what lined up.",
  "Why I stopped guessing my trigger foods.",
  "The lunch that was wrecking my afternoons.",
  "What I eat in a day, and how I actually felt after.",
];

const KIT = [
  { label: "App screenshots", note: "Home, patterns and insights", files: ["/screenshots/home-2026.png", "/screenshots/patterns-2026.png", "/screenshots/insights.png"] },
  { label: "App icon", note: "PNG, 512 x 512", files: ["/icon-512.png"] },
];

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
  const cur = currencyFor(C.country);
  const link = `whatyouate.app/c/${C.code}`;
  const first = C.name.split(" ")[0];

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#8FA3C0" }}>Creator dashboard</p>
          <h1 className="mt-3 text-[clamp(28px,4.4vw,40px)] font-bold leading-[1.1] tracking-[-0.04em]">Hi {first}</h1>
        </div>
        <div className="flex shrink-0 gap-4 pt-1 text-[14px] font-semibold">
          <Link href="/creators/profile" style={{ color: "#2F6FC4" }}>Profile</Link>
          <Link href="/creators" style={{ color: BODY }}>Log out</Link>
        </div>
      </div>

      {/* Code and share link */}
      <Card className="mt-7 px-6 py-6">
        <p className="text-[13px] font-medium" style={{ color: BODY }}>Your code</p>
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

      <div className="mt-4 rounded-2xl px-5 py-3.5 text-[14px] leading-[1.55]" style={{ background: "#E6F0FE", color: "#1E4E8C" }}>
        <strong>First-month bonus:</strong> you also earn $1 for every signup until November 2.
      </div>

      {/* This month */}
      <SectionTitle right={<span className="text-[13px]" style={{ color: "#8FA3C0" }}>{S.month.label}</span>}>This month</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Code uses" value={String(S.month.codeUses)} />
        <Stat label="Signups that count" value={String(S.month.qualified)} hint="Active 3 days or more" />
        <Stat label="New paid subscribers" value={String(S.month.newPaid)} />
        <Stat label="Earned so far" value={money(S.month.bonus + S.month.commission, cur).replace(` ${cur}`, "")} hint={cur} />
      </div>
      <p className="mt-3 text-[13px]" style={{ color: BODY }}>
        {money(S.month.bonus, cur)} from signups, {money(S.month.commission, cur)} from subscriptions.
      </p>

      {/* Weekly */}
      <SectionTitle>Code uses by week</SectionTitle>
      <Card className="px-5 pb-4 pt-5">
        <WeeklyChart />
        <p className="mt-3 text-[12px]" style={{ color: "#8FA3C0" }}>This week so far is shown lighter.</p>
      </Card>

      {/* Payout */}
      <SectionTitle>Next payout</SectionTitle>
      <Card className="px-6 py-5">
        <p className="text-[14px] font-medium" style={{ color: BODY }}>{S.nextPayout.date}</p>
        <p className="mt-1 text-[28px] font-bold tracking-[-0.03em]" style={{ color: INK }}>
          about {money(S.nextPayout.estimate, cur).replace(` ${cur}`, "")}
          <span className="ml-1.5 text-[14px] font-medium" style={{ color: BODY }}>{cur}</span>
        </p>
        <p className="mt-2 text-[14px] leading-[1.55]" style={{ color: BODY }}>
          By {PAYOUT_LABEL[C.payoutMethod]} to {C.payoutEmail}. Covers October, once refunds have cleared.
          {cur === "CAD" ? " Converted from USD on the day it's paid." : ""}
        </p>
      </Card>

      {/* All time */}
      <SectionTitle>All time</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <Stat small label="Paid subs" value={String(S.allTime.paidSubs)} />
        <Stat small label="Earned" value={money(S.allTime.earned, cur).replace(` ${cur}`, "")} />
        <Stat small label="Paid out" value={money(S.allTime.paidOut, cur).replace(` ${cur}`, "")} />
      </div>

      {/* Creator kit */}
      <SectionTitle>Creator kit</SectionTitle>
      <Card className="divide-y divide-[#16233B]/[0.06]">
        {KIT.map((k) => (
          <div key={k.label} className="flex items-center justify-between gap-4 px-6 py-4">
            <div>
              <p className="text-[15.5px] font-semibold" style={{ color: INK }}>{k.label}</p>
              <p className="text-[13px]" style={{ color: BODY }}>{k.note}</p>
            </div>
            <div className="flex shrink-0 gap-3 text-[14px] font-semibold">
              {k.files.map((f, i) => (
                <a key={f} href={f} download style={{ color: "#2F6FC4" }}>
                  {k.files.length > 1 ? `${i + 1}` : "Download"}
                </a>
              ))}
            </div>
          </div>
        ))}
        <details className="group px-6 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[15.5px] font-semibold" style={{ color: INK }}>
            Ideas for your posts
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BODY} strokeWidth="2.2" strokeLinecap="round" className="transition group-open:rotate-45">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </summary>
          <ul className="mt-3 flex flex-col gap-2.5">
            {HOOKS.map((h) => (
              <li key={h} className="text-[14.5px] leading-[1.55]" style={{ color: BODY }}>&ldquo;{h}&rdquo;</li>
            ))}
          </ul>
          <p className="mt-3 text-[13.5px] leading-[1.55]" style={{ color: BODY }}>
            Use the app for a week or two first, so you have real patterns to show. Keep it in your own words.
          </p>
        </details>
        <div className="px-6 py-4 text-[14px] leading-[1.6]" style={{ color: BODY }}>
          <strong style={{ color: INK }}>The two rules:</strong> label posts as sponsored (#ad or paid partnership), and
          never say the app treats or cures anything.{" "}
          <Link href="/creators/terms" className="font-semibold" style={{ color: "#2F6FC4" }}>Program terms</Link>
        </div>
      </Card>

      <p className="mt-10 text-center text-[14px]" style={{ color: INK }}>
        Questions? <a href={`mailto:${CREATOR_EMAIL}`} className="font-semibold underline underline-offset-2" style={{ color: INK }}>{CREATOR_EMAIL}</a>
      </p>
    </div>
  );
}
