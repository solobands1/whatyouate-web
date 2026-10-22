"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CREATOR_EMAIL, TrialTag } from "./Shell";
import CreatorNav from "./CreatorNav";
import Gate from "./Gate";
import { redeemLink, type Dash } from "./api";
import RedeemQr, { useDevice } from "./RedeemQr";
import { PAYOUT_LABEL, longDate, money } from "./shared";
import { BODY, INK } from "../site";

// Month-by-month earnings and payouts, for the creator's own records and taxes.
function downloadStatement(cur: string, statement: Dash["statement"]) {
  const head = ["Month", "Code uses", "Signups that count", "New paid subscribers", `Signup bonus (${cur})`, `Subscription earnings (${cur})`, `Total earned (${cur})`, `Paid (${cur})`, "Paid on"];
  const rows = statement.map((r) => [r.month, r.codeUses, r.signups, r.newPaid, r.bonus.toFixed(2), r.commission.toFixed(2), (r.bonus + r.commission).toFixed(2), r.paid.toFixed(2), r.paidOn]);
  const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "whatyouate-creator-statement.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

function CopyButton({ text, label, small = false }: { text: string; label: string; small?: boolean }) {
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
      className={`rounded-full font-semibold transition hover:opacity-90 ${small ? "px-4 py-2.5 text-[13.5px]" : "flex-1 px-5 py-3 text-[14.5px]"}`}
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

function WeeklyChart({ weekly }: { weekly: Dash["weekly"] }) {
  const max = Math.max(1, ...weekly.map((w) => w.uses));
  return (
    <div className="flex items-end gap-3 px-1">
      {weekly.map((w, i) => {
        const h = Math.max(4, Math.round((w.uses / max) * 100));
        const last = i === weekly.length - 1;
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

// The creator's own free Pro, through Apple offer codes: 3 months once their first signup qualifies,
// a year once 3 of their followers have each paid for 2 months or bought a year.
function FreePro({ pro, preview = false }: { pro: Dash["pro"]; preview?: boolean }) {
  const code = pro.year ?? pro.threeMonths;
  const device = useDevice();
  return (
    <Card className="mt-4 px-6 py-5">
      <p className="text-[17px] font-bold tracking-[-0.02em]" style={{ color: INK }}>
        {pro.year ? "You Earned a Free Year of Pro" : "Your Free Pro"}
      </p>
      {code ? (
        <>
          <p className="mt-1 text-[14px] leading-[1.6]" style={{ color: BODY }}>
            {pro.year
              ? "Three of your followers are sticking with it. Here's a year of WhatYouAte Pro, on us."
              : "3 months of WhatYouAte Pro, so you can use the app for real before you post about it."}
          </p>
          <p className="mt-3 font-mono text-[18px] font-semibold tracking-[0.06em]" style={{ color: INK }}>{code}</p>
          <p className="mt-1 text-[12.5px]" style={{ color: BODY }}>
            This code is for you, not your followers. It gives you free Pro.
          </p>
          {preview ? (
            <span className="mt-4 inline-flex rounded-full px-5 py-3 text-[14.5px] font-semibold text-white" style={{ background: INK }}>
              Redeem In The App Store
            </span>
          ) : device === "otherPhone" ? (
            <p className="mt-4 text-[14px] leading-[1.6]" style={{ color: INK }}>
              Apple codes only work on an iPhone. Open this page on your iPhone to redeem it.
            </p>
          ) : (
            <a
              href={redeemLink(code)}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-full px-5 py-3 text-[14.5px] font-semibold text-white transition hover:opacity-90"
              style={{ background: INK }}
            >
              Redeem In The App Store
            </a>
          )}
          {!preview && device === "computer" && <RedeemQr url={redeemLink(code)} />}
          <p className="mt-3 text-[12.5px] leading-[1.55]" style={{ color: "#8FA3C0" }}>
            Redeem it within a few weeks. It doesn&apos;t renew, so you won&apos;t be charged anything when it ends.
            {pro.year && pro.threeMonths && " If your 3 free months are still running, redeem this after they end."} Or
            redeem it by hand: in the App Store app, tap your profile picture, then Redeem Gift Card or Code.
          </p>
        </>
      ) : pro.unlocked ? (
        <p className="mt-1 text-[14px] leading-[1.6]" style={{ color: BODY }}>
          Your first signup unlocked 3 months of WhatYouAte Pro. Your code is on its way and will show up here
          within a day.
        </p>
      ) : (
        <p className="mt-1 text-[14px] leading-[1.6]" style={{ color: BODY }}>
          <span className="font-semibold" style={{ color: INK }}>Unlocks with your first signup.</span> Once someone
          uses your code and is active in the app on 3 days, you get 3 months of WhatYouAte Pro free.
        </p>
      )}
      {!pro.year && (
        <p className="mt-4 border-t border-[#16233B]/[0.06] pt-3 text-[14px] leading-[1.55]" style={{ color: BODY }}>
          <span className="font-semibold" style={{ color: INK }}>A free year:</span> once 3 of your followers have each paid for 2
          months, or bought a yearly plan.{" "}
          {Math.min(pro.paying, 3)} of 3 so far.
        </p>
      )}
    </Card>
  );
}

export default function Dashboard() {
  return <Gate>{(d) => <DashboardView d={d} />}</Gate>;
}

/** Where the money goes: e-Transfers go to an email, Wise emails a link to collect bank details. */
function payoutTo(C: Dash["creator"]) {
  return C.payoutMethod === "wise"
    ? `By bank deposit through Wise. Wise emails ${C.payoutEmail} to collect your bank details.`
    : `By ${PAYOUT_LABEL[C.payoutMethod]} to ${C.payoutEmail}.`;
}

/** The dashboard itself. `preview` is the example page (/creators/example): no tabs, nothing redeemable. */
export function DashboardView({ d, preview = false }: { d: Dash; preview?: boolean }) {
  const C = d.creator;
  const S = d;
  const bonusActive = new Date(C.bonusEnds + "T23:59:59") >= new Date();
  // A worked example for the payout row: last month's earnings and the month they're paid in.
  const payNow = (() => {
    const now = new Date(); const m = (k: number) => new Date(now.getFullYear(), now.getMonth() + k, 1).toLocaleDateString("en-CA", { month: "long" });
    return { earned: `${m(-1)}'s`, paid: m(1) };
  })();
  const cur = C.currency;
  const link = `whatyouate.app/c/${C.code}`;
  const first = C.name.split(" ")[0];
  // New creators start on Code & Perks (their numbers are all zero); once the code has been used,
  // the dashboard opens on their numbers.
  const active = S.allTime.earned > 0 || S.statement.some((r) => r.codeUses > 0) || S.weekly.some((w) => w.uses > 0);
  const [view, setView] = useState<"numbers" | "perks">(preview || active ? "numbers" : "perks");

  // The switch side lives in the address (?view=perks) so Back returns to the same side, and #kit
  // scrolls to the Creator Kit card (coming back from Join on the example dashboard).
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("view");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (v === "numbers" || v === "perks") setView(v);
    if (window.location.hash === "#kit") {
      setTimeout(() => document.getElementById("kit")?.scrollIntoView({ block: "center" }), 60);
    }
  }, []);
  const choose = (v: "numbers" | "perks") => {
    setView(v);
    const url = new URL(window.location.href);
    url.searchParams.set("view", v);
    url.hash = "";
    window.history.replaceState(null, "", url);
  };

  return (
    <div>
      {!preview && <CreatorNav />}
      <h1 className="mt-8 text-[clamp(28px,4.4vw,40px)] font-bold leading-[1.1] tracking-[-0.04em]">Hi {first}</h1>

      {/* A segmented switch: a white thumb slides behind the selected side. */}
      <div role="tablist" className="relative mt-6 grid grid-cols-2 rounded-full bg-[#16233B]/[0.07] p-1">
        <span
          aria-hidden="true"
          className="absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-full bg-white transition-transform duration-300 ease-out"
          style={{
            transform: view === "perks" ? "translateX(100%)" : "translateX(0)",
            boxShadow: "0 1px 2px rgba(16,42,86,0.12), 0 4px 12px -4px rgba(16,42,86,0.18)",
          }}
        />
        {(
          [
            ["numbers", "Your Numbers"],
            ["perks", "Code & Perks"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => choose(v)}
            className="relative z-10 rounded-full py-2.5 text-[14px] font-semibold tracking-[-0.01em] transition-colors"
            style={{ color: view === v ? INK : BODY }}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "numbers" ? (
        <>
      {/* Code at a glance, for copying while checking numbers */}
      <Card className="mt-6 flex items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[12px] font-medium" style={{ color: BODY }}>Your Creator Code</p>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className="truncate text-[20px] font-bold tracking-[0.04em]" style={{ color: INK }}>{C.code}</p>
            <TrialTag small />
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <CopyButton text={`https://${link}`} label="Copy Link" small />
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
        {/* The signup bonus only runs in a creator's first month, so after that just show subscriptions. */}
        {S.month.bonus + S.month.commission === 0
          ? "Nothing yet this month. Share your link to get your first signups."
          : bonusActive || S.month.bonus > 0
          ? `${money(S.month.bonus, cur)} from signups, ${money(S.month.commission, cur)} from subscriptions.`
          : `${money(S.month.commission, cur)} from subscriptions.`}
      </p>

      {/* Followers trying Pro right now: started the free month, not paying yet */}
      <Card className="mt-4 flex items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-[13px] font-medium" style={{ color: BODY }}>In Their Free Month</p>
          <p className="mt-0.5 text-[13px] leading-[1.5]" style={{ color: "#8FA3C0" }}>
            {S.freeMonth > 0
              ? "Trying Pro now. They start paying when their free month ends."
              : "Followers trying Pro for free will show up here."}
          </p>
        </div>
        <p className="shrink-0 text-[26px] font-bold tracking-[-0.03em]" style={{ color: INK }}>{S.freeMonth ?? 0}</p>
      </Card>

      {/* Payout */}
      <SectionTitle>Next Payout</SectionTitle>
      <Card className="px-6 py-5">
        {S.nextPayout.estimate > 0 ? (
          <>
            <p className="text-[14px] font-medium" style={{ color: BODY }}>{S.nextPayout.date}</p>
            <p className="mt-1 text-[28px] font-bold tracking-[-0.03em]" style={{ color: INK }}>
              about {money(S.nextPayout.estimate, cur).replace(` ${cur}`, "")}{" "}
              <span className="ml-1.5 text-[14px] font-medium" style={{ color: BODY }}>{cur}</span>
            </p>
            <p className="mt-2 text-[14px] leading-[1.55]" style={{ color: BODY }}>
              {payoutTo(C)} Covers earnings through {S.nextPayout.covers}, once refunds have cleared.
            </p>
          </>
        ) : (
          <>
            <p className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: INK }}>No payout yet</p>
            <p className="mt-1.5 text-[14px] leading-[1.55]" style={{ color: BODY }}>
              Payouts go out on the 1st of each month, once you&apos;ve earned $10. {payoutTo(C)}
            </p>
          </>
        )}
      </Card>

      {/* Recurring */}
      <div
        className="mt-5 rounded-3xl px-6 py-5 text-white"
        style={{ background: "linear-gradient(135deg, #6FA8FF 0%, #3F7FD6 100%)", boxShadow: "0 18px 40px -22px rgba(47,111,196,0.7)" }}
      >
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white/80">Recurring Each Month</p>
        {S.recurring.active > 0 ? (
          <>
            <p className="mt-1 text-[30px] font-bold tracking-[-0.03em]">
              about {money(S.recurring.monthly, cur).replace(` ${cur}`, "")}{" "}
              <span className="text-[15px] font-semibold text-white/85">{cur} a month</span>
            </p>
            <p className="mt-1 text-[14px] leading-[1.55] text-white/85">
              From your {S.recurring.active} active subscriber{S.recurring.active === 1 ? "" : "s"}, without posting again.
              Each one keeps earning you for their first 12 months.
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-[22px] font-bold tracking-[-0.02em]">Starts with your first subscriber</p>
            <p className="mt-1 text-[14px] leading-[1.55] text-white/85">
              Each one keeps earning you every month for their first 12 months, without you posting again.
            </p>
          </>
        )}
      </div>

      {/* Weekly */}
      <SectionTitle>Code Uses by Week</SectionTitle>
      <Card className="px-5 pb-4 pt-5">
        <WeeklyChart weekly={S.weekly} />
        <p className="mt-3 text-[12px]" style={{ color: "#8FA3C0" }}>
          {S.weekly.some((w) => w.uses > 0) ? "This week so far is shown lighter." : "Each week's code uses will show here."}
        </p>
      </Card>



      {/* All time */}
      <SectionTitle>All Time</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <Stat small label="Subscribers" value={String(S.allTime.paidSubs)} />
        <Stat small label="Earned" value={money(S.allTime.earned, cur).replace(` ${cur}`, "")} />
        <Stat small label="Paid Out" value={money(S.allTime.paidOut, cur).replace(` ${cur}`, "")} />
      </div>

      {/* Payout history */}
      <SectionTitle>Payout History</SectionTitle>
      <Card className="px-6 py-5">
        {S.statement.some((r) => r.paid > 0) ? (
          <div className="divide-y divide-[#16233B]/[0.06]">
            {S.statement.filter((r) => r.paid > 0).reverse().map((r) => (
              <div key={r.month} className="flex items-baseline justify-between py-2.5 text-[14.5px]">
                <span style={{ color: BODY }}>{longDate(r.paidOn)}</span>
                <span className="font-semibold" style={{ color: INK }}>{money(r.paid, cur)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[14.5px] leading-[1.55]" style={{ color: BODY }}>
            Your first payout will show here after {S.nextPayout.date}.
          </p>
        )}
        <button
          type="button"
          onClick={() => downloadStatement(cur, S.statement)}
          className="mt-4 text-[14px] font-semibold"
          style={{ color: "#2F6FC4" }}
        >
          Download Statement (CSV)
        </button>
      </Card>

        </>
      ) : (
        <>
      {/* Code and share link */}
      <Card className="mt-6 px-6 py-6">
        <p className="text-[13px] font-medium" style={{ color: BODY }}>Your Creator Code</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-[30px] font-bold tracking-[0.04em]" style={{ color: INK }}>{C.code}</p>
          <TrialTag />
        </div>
        <p className="mt-2.5 text-[15px]" style={{ color: BODY }}>
          Your link: <span className="font-semibold" style={{ color: INK }}>{link}</span>
        </p>
        <div className="mt-5 flex gap-2.5">
          <CopyButton text={`https://${link}`} label="Copy Link" />
          <CopyButton text={C.code} label="Copy Code" />
        </div>
        <p className="mt-4 text-[13.5px] leading-[1.55]" style={{ color: BODY }}>
          Followers who enter your code in the app get their first month of WhatYouAte Pro free, then the regular
          price unless they cancel. Your link shows them the code.
        </p>
      </Card>

      <FreePro pro={d.pro} preview={preview} />

      <Link
        id="kit"
        href={preview ? "/creators/join?from=example&back=kit" : "/creators/kit"}
        className="mt-4 flex items-center justify-between gap-4 rounded-3xl px-6 py-5 text-white transition hover:-translate-y-0.5"
        style={{ background: "linear-gradient(135deg, #6FA8FF 0%, #3F7FD6 100%)", boxShadow: "0 18px 40px -22px rgba(47,111,196,0.7)" }}
      >
        <div>
          <p className="text-[17px] font-bold tracking-[-0.02em]">Creator Kit</p>
          <p className="mt-1 text-[14px] leading-[1.5] text-white/85">Captions with your code, post ideas, videos, logos and screenshots.</p>
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
            body: `One post can keep paying you. When someone subscribes with your code, you earn 30% of their subscription for their first 12 months, after Apple's fee. That's about ${cur === "CAD" ? "$38 CAD" : "$28 USD"} for each yearly subscriber, or about ${cur === "CAD" ? "$4.50 CAD" : "$3.30 USD"} every month a monthly subscriber sticks around.`,
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

        </>
      )}

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
