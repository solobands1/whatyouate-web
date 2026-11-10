"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./Shell";
import { ownerUsage, sb, syncSubscriptions, type OwnerUsage as Usage, type UsageFlag, type UsageFunnel, type UsageStatus, type UsageUser, type UsageDay } from "./api";
import { BODY, INK } from "../site";

// The owner's app usage page (/creators/owner/usage): how many people use the app, how far each one has got, when they
// last logged, and where people stop. Everything comes from owner_usage in the app repo's supabase/owner_usage.sql,
// which only owners can call. Until that file is installed, the page says so instead of erroring.

const FAINT = "#8FA3C0";
const BLUE = "#2F6FC4";
const RED = "#C2410C";
const LINE = "#16233B14";

const STATUS: Record<UsageStatus, { label: string; fg: string; bg: string; note: string }> = {
  not_started: { label: "Not Started", fg: "#5A6B85", bg: "#F1F4F9", note: "No meal logged yet" },
  free_window: { label: "Free Window", fg: "#2F6FC4", bg: "#EEF5FE", note: "Logging, free window still open" },
  free_ended: { label: "Free Window Over", fg: "#B45309", bg: "#FEF6E7", note: "Free window ended, no Apple trial" },
  trial: { label: "Apple Trial", fg: "#6D28D9", bg: "#F3EFFE", note: "In Apple's free trial" },
  subscribed: { label: "Paying", fg: "#15803D", bg: "#E7F6EC", note: "Paying subscriber" },
  cancelled_active: { label: "Cancelled", fg: "#C2410C", bg: "#FDF0E8", note: "Turned off renewal, still has access" },
  billing_issue: { label: "Billing Problem", fg: "#B91C1C", bg: "#FDECEC", note: "Apple couldn't charge them" },
  expired: { label: "Expired", fg: "#7A8599", bg: "#F1F4F9", note: "Trial or subscription ended" },
};
const STATUS_ORDER: UsageStatus[] = ["not_started", "free_window", "free_ended", "trial", "subscribed", "cancelled_active", "billing_issue", "expired"];

const STAGES = ["Signed Up", "Finished Onboarding", "Logged A Meal", "Did A Check-In", "Came Back Next Day", "Built Their Picture", "Started Apple Trial", "Paying"];

// Why each group is worth a personal email, in the order they matter most.
const FLAGS: Record<UsageFlag, { label: string; why: string }> = {
  trial_ending: { label: "Trial Ends Soon", why: "Apple trial ends within 2 days and they used the app in the last 3. A quick hello before it renews." },
  paying_quiet: { label: "Paying, Quiet 7 Days", why: "Paying but nothing logged for a week. Worth checking in before they cancel." },
  paywall_no_trial: { label: "Hit Paywall, No Trial", why: "Their free window ended in the last week and they didn't start a trial. Ask what held them back." },
  no_meal_day3: { label: "No Meal By Day 3", why: "Finished onboarding 3 or more days ago and never logged a meal. Ask if something got in the way." },
  never_onboarded: { label: "Never Finished Onboarding", why: "Made an account but stopped during onboarding." },
  still_logging_day7: { label: "Still Logging At Day 7", why: "Signed up 1 to 4 weeks ago and still logging. Good people to ask for feedback or a review." },
};
const FLAG_ORDER: UsageFlag[] = ["trial_ending", "paying_quiet", "paywall_no_trial", "no_meal_day3", "never_onboarded", "still_logging_day7"];

// The sentence under the funnel for the step where the most people stop (the step they never reached).
const DROP_TEXT: Record<number, (pct: string) => string> = {
  2: (p) => `Most people stop during onboarding: ${p} never finish it.`,
  3: (p) => `Most people stop after onboarding: ${p} never log a meal.`,
  4: (p) => `Most people stop after their first meal: ${p} never do a check-in or come back.`,
  5: (p) => `Most people stop after day one: ${p} never come back on a second day.`,
  6: (p) => `Most people stop before their picture is built: ${p} never log 5 different days.`,
  7: (p) => `Most people stop at the paywall: ${p} build their picture but never start a trial.`,
  8: (p) => `Most people stop during the trial: ${p} start one but never pay.`,
};

type Window = "7" | "30" | "90" | "all";
const WINDOWS: { key: Window; label: string }[] = [
  { key: "7", label: "7 Days" },
  { key: "30", label: "30 Days" },
  { key: "90", label: "90 Days" },
  { key: "all", label: "All Time" },
];

// ---- Formatting ---------------------------------------------------------------------------

const n = (v: number) => v.toLocaleString("en-CA");
const pct = (v: number | null | undefined) => (v == null ? "" : `${Math.round(v)}%`);
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
const fullDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
/** "Just now", "3h ago", "Yesterday", "4d ago", then a date. */
function ago(iso: string | null) {
  if (!iso) return "Never";
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins < 60) return "Just now";
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  const days = Math.floor(mins / 1440);
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days}d ago`;
  return shortDate(iso);
}
const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
function statusLabel(u: Pick<UsageUser, "status" | "periodType">) {
  if (u.status === "cancelled_active" && u.periodType === "TRIAL") return "Trial Cancelled";
  return STATUS[u.status]?.label ?? u.status;
}

// ---- Page ---------------------------------------------------------------------------------

type State = "loading" | "ready" | "notOwner" | "notInstalled" | "error";

export default function OwnerUsage() {
  const router = useRouter();
  const [data, setData] = useState<Usage | null>(null);
  const [state, setState] = useState<State>("loading");

  const load = useCallback(async () => {
    const { data: session } = await sb().auth.getSession();
    if (!session.session) {
      router.replace(`/creators/login?next=${encodeURIComponent("/creators/owner/usage")}`);
      return;
    }
    try {
      setData(await ownerUsage(30));
      setState("ready");
    } catch (e) {
      const err = e as { message?: string; code?: string };
      const text = `${err?.code ?? ""} ${err?.message ?? ""}`;
      // PostgREST answers PGRST202 for a function it doesn't know (owner_usage.sql not run yet).
      setState(/not_owner/.test(text) ? "notOwner" : /PGRST202|Could not find the function|42883|does not exist/.test(text) ? "notInstalled" : "error");
    }
  }, [router]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (state === "loading") return <p className="py-24 text-center text-[15px]" style={{ color: BODY }}>Loading…</p>;
  if (state !== "ready" || !data) {
    const copy = {
      notOwner: ["Not Allowed", "This page is only for the program's owners."],
      notInstalled: [
        "Install owner_usage.sql To See This",
        "This page reads from functions that aren't in the database yet. Paste supabase/owner_usage.sql from the app repo into the Supabase SQL editor and run it, then refresh.",
      ],
      error: ["Couldn't Load", "Something went wrong loading app usage. Try again in a moment."],
      loading: ["", ""],
      ready: ["", ""],
    }[state];
    return (
      <div className="-mt-6 sm:-mt-10 mx-auto max-w-[44rem]">
        <a href="/creators/owner" className="text-[14px] font-semibold" style={{ color: BLUE }}>‹ Owner</a>
        <Card className="mt-3 px-7 py-9 text-center">
          <h1 className="text-[22px] font-bold tracking-[-0.03em]" style={{ color: INK }}>{copy[0]}</h1>
          <p className="mt-3 text-[15.5px] leading-[1.6]" style={{ color: BODY }}>{copy[1]}</p>
          {state !== "notOwner" && (
            <button type="button" onClick={() => { setState("loading"); load(); }} className="mt-5 text-[14px] font-semibold" style={{ color: BLUE }}>
              Refresh
            </button>
          )}
        </Card>
      </div>
    );
  }

  const s = data.summary;
  return (
    <div className="-mt-6 sm:-mt-10">
      <div className="mx-auto max-w-[65rem]">
        <a href="/creators/owner" className="text-[14px] font-semibold" style={{ color: BLUE }}>‹ Owner</a>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[clamp(28px,4.4vw,40px)] font-bold leading-[1.1] tracking-[-0.04em]">Users</h1>
            <p className="mt-1 text-[14px]" style={{ color: BODY }}>
              Who uses the app, how far each person has got, and where people stop.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[12.5px]" style={{ color: FAINT }}>Updated {new Date(s.generatedAt).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}</span>
            <SyncButton onDone={load} />
            <button type="button" onClick={() => load()} className="text-[14px] font-semibold" style={{ color: BLUE }}>Refresh</button>
          </div>
        </div>

        <Totals s={s} />
        <Funnel funnels={data.funnels} />
        <Daily days={data.daily} />
        <FollowUps users={data.users} />
      </div>
      <UserTable users={data.users} />
    </div>
  );
}

// ---- Sync from RevenueCat ----------------------------------------------------------------
// The RevenueCat webhook saves trials and payments as they happen; this catches up on everyone at once.

function SyncButton({ onDone }: { onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setNote(null);
    const r = await syncSubscriptions();
    if (r.ok) {
      const c = r.counts ?? {};
      const parts = (["subscribed", "trial", "cancelled_active", "billing_issue", "expired"] as const).filter((k) => c[k]).map((k) => `${c[k]} ${STATUS[k].label.toLowerCase()}`);
      setNote(`Checked ${r.checked ?? 0}${parts.length ? `: ${parts.join(", ")}` : ", no subscriptions yet"}${r.failed ? ` (${r.failed} couldn't be checked)` : ""}`);
      await onDone();
    } else setNote(r.error ?? "Sync didn't work. Try again in a moment.");
    setBusy(false);
  };
  return (
    <span className="flex items-center gap-3">
      {note && <span className="text-[12.5px]" style={{ color: BODY }}>{note}</span>}
      <button type="button" onClick={run} disabled={busy} className="text-[14px] font-semibold disabled:opacity-50" style={{ color: BLUE }}>
        {busy ? "Syncing…" : "Sync From RevenueCat"}
      </button>
    </span>
  );
}

// ---- Big numbers --------------------------------------------------------------------------

function Totals({ s }: { s: Usage["summary"] }) {
  const tiles: { label: string; value: number; note?: string }[] = [
    { label: "Total Users", value: s.totalUsers, note: s.internal ? `Not counting ${s.internal} staff or test account${s.internal === 1 ? "" : "s"}` : undefined },
    { label: "Active Today", value: s.activeToday, note: "Logged anything today" },
    { label: "Active, Last 7 Days", value: s.active7d, note: s.totalUsers ? `${pct((100 * s.active7d) / s.totalUsers)} of everyone` : undefined },
    { label: "Active, Last 30 Days", value: s.active30d },
    { label: "Signups, Last 7 Days", value: s.signups7d, note: `${n(s.signups30d)} in 30 days · ${n(s.signupsToday)} today` },
    { label: "Meals Logged Today", value: s.mealsToday, note: `${n(s.meals7d)} in the last 7 days` },
  ];
  const statuses = STATUS_ORDER.filter((k) => (s.byStatus[k] ?? 0) > 0);
  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl bg-white/80 px-4 py-3.5 ring-1 ring-[#16233B]/[0.06]">
            <p className="text-[12px] font-medium" style={{ color: BODY }}>{t.label}</p>
            <p className="text-[26px] font-bold leading-[1.25] tracking-[-0.03em] tabular-nums" style={{ color: INK }}>{n(t.value)}</p>
            {t.note && <p className="mt-0.5 text-[12px] leading-[1.35]" style={{ color: FAINT }}>{t.note}</p>}
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl bg-white/80 px-4 py-3.5 ring-1 ring-[#16233B]/[0.06]">
        <p className="text-[12px] font-medium" style={{ color: BODY }}>Where Everyone Is Now</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {statuses.map((k) => (
            <span key={k} title={STATUS[k].note} className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold" style={{ background: STATUS[k].bg, color: STATUS[k].fg }}>
              {STATUS[k].label}
              <span className="tabular-nums" style={{ color: INK }}>{n(s.byStatus[k] ?? 0)}</span>
            </span>
          ))}
          {!statuses.length && <span className="text-[13px]" style={{ color: BODY }}>No users yet.</span>}
        </div>
        {s.siteOnly > 0 && (
          <p className="mt-2 text-[12px]" style={{ color: FAINT }}>
            {s.siteOnly} account{s.siteOnly === 1 ? "" : "s"} made on the creator website and never opened the app {s.siteOnly === 1 ? "isn't" : "aren't"} counted anywhere.
          </p>
        )}
      </div>
    </>
  );
}

// ---- Funnel -------------------------------------------------------------------------------

function Funnel({ funnels }: { funnels: Usage["funnels"] }) {
  const [win, setWin] = useState<Window>("30");
  const [hover, setHover] = useState<number | null>(null);
  const f: UsageFunnel = funnels[win];
  const start = f.stages[0]?.reached ?? 0;
  const drop = f.biggestDrop ? f.stages.find((st) => st.n === f.biggestDrop) : null;
  const dropPrev = drop ? f.stages.find((st) => st.n === drop.n - 1) : null;
  const headline = !start
    ? `Nobody signed up ${win === "all" ? "yet" : `in the last ${win} days`}.`
    : drop && dropPrev
      ? `${DROP_TEXT[drop.n]?.(pct(100 - (drop.keptPct ?? 0))) ?? ""} (${n(drop.lost)} of ${n(dropPrev.reached)} people)`
      : "Nobody has dropped off yet.";

  return (
    <Card className="mt-6 px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-bold tracking-[-0.02em]" style={{ color: INK }}>Funnel</h2>
          <p className="text-[13px]" style={{ color: BODY }}>
            Everyone who signed up {win === "all" ? "so far" : `in the last ${win} days`}, by how far they&apos;ve got.
          </p>
        </div>
        <div className="flex rounded-full bg-white p-1 ring-1 ring-[#16233B]/[0.08]" role="tablist" aria-label="Signed up in">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              role="tab"
              aria-selected={win === w.key}
              onClick={() => setWin(w.key)}
              className="rounded-full px-3 py-1.5 text-[13px] font-semibold transition"
              style={win === w.key ? { background: INK, color: "#fff" } : { color: BODY }}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 rounded-2xl px-4 py-3 text-[15px] font-semibold leading-[1.45]" style={{ background: drop ? "#FDF0E8" : "#EEF5FE", color: INK }}>
        {headline}
      </p>

      <div className="mt-5 space-y-0">
        {f.stages.map((st, i) => {
          const isDrop = drop?.n === st.n;
          const width = start ? Math.max((100 * st.reached) / start, st.reached ? 1.5 : 0) : 0;
          return (
            <div key={st.key}>
              {i > 0 && (
                <div className="flex items-center gap-3 py-1 sm:pl-[188px]">
                  <span className="text-[12px] tabular-nums" style={{ color: isDrop ? RED : FAINT, fontWeight: isDrop ? 700 : 500 }}>
                    {st.lost > 0 ? `↓ ${n(st.lost)} stopped here (${pct(100 - (st.keptPct ?? 0))} lost, ${pct(st.keptPct)} kept)` : start ? "↓ Nobody lost" : ""}
                  </span>
                </div>
              )}
              <div
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[176px_1fr_92px]"
                onMouseEnter={() => setHover(st.n)}
                onMouseLeave={() => setHover(null)}
              >
                <p className="text-[13.5px] font-semibold" style={{ color: INK }}>
                  <span className="mr-1.5 tabular-nums" style={{ color: FAINT }}>{st.n}</span>
                  {st.label}
                </p>
                <p className="text-right text-[13.5px] tabular-nums sm:order-last" style={{ color: INK }}>
                  <span className="font-bold">{n(st.reached)}</span>
                  <span className="ml-1.5 text-[12px]" style={{ color: FAINT }}>{pct(st.ofStartPct)}</span>
                </p>
                <div className="relative col-span-2 h-[22px] rounded-[6px] sm:col-span-1" style={{ background: "#16233B0A" }}>
                  <div
                    className="h-full rounded-[6px] transition-[width] duration-300"
                    style={{ width: `${width}%`, background: isDrop ? "#E07A3F" : hover === st.n ? "#245BA6" : BLUE }}
                  />
                  {hover === st.n && start > 0 && (
                    <div className="pointer-events-none absolute left-2 top-[26px] z-10 rounded-xl bg-[#101B2E] px-3 py-2 text-[12px] leading-[1.45] text-white shadow-lg">
                      <p className="font-semibold">{st.label}</p>
                      <p>{n(st.reached)} of {n(start)} reached this step or further</p>
                      {st.n > 1 && <p>{n(st.didIt)} actually did it</p>}
                    </div>
                  )}
                </div>
              </div>
              {st.n > 3 && st.didIt !== st.reached && start > 0 && (
                <p className="mt-0.5 text-[12px] sm:pl-[188px]" style={{ color: FAINT }}>
                  {n(st.didIt)} did this; {st.didIt < st.reached ? `${n(st.reached - st.didIt)} skipped it and went further` : `${n(st.didIt - st.reached)} of them skipped an earlier step`}.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {f.recent > 0 && win !== "7" && (
        <p className="mt-4 text-[12.5px]" style={{ color: FAINT }}>
          {n(f.recent)} of these signed up in the last week, so they may not have had time to reach the later steps.
        </p>
      )}
      {win === "7" && start > 0 && (
        <p className="mt-4 text-[12.5px]" style={{ color: FAINT }}>
          Everyone here signed up in the last week. Building the picture takes at least 5 days, so the later steps fill in over time.
        </p>
      )}
    </Card>
  );
}

// ---- Last 30 days -------------------------------------------------------------------------

// Three small charts side by side instead of one with three scales: signups, active people and meals are very different sizes.
function Daily({ days }: { days: UsageDay[] }) {
  const charts: { key: keyof Omit<UsageDay, "day">; label: string }[] = [
    { key: "signups", label: "Signups" },
    { key: "active", label: "Active Users" },
    { key: "meals", label: "Meals Logged" },
  ];
  return (
    <Card className="mt-6 px-5 py-5 sm:px-7 sm:py-6">
      <h2 className="text-[19px] font-bold tracking-[-0.02em]" style={{ color: INK }}>Last 30 Days</h2>
      <p className="text-[13px]" style={{ color: BODY }}>Per day. Activity is counted on each person&apos;s own local day.</p>
      <div className="mt-4 grid gap-6 md:grid-cols-3">
        {charts.map((c) => (
          <MiniBars key={c.key} label={c.label} days={days} pick={(d) => d[c.key]} />
        ))}
      </div>
    </Card>
  );
}

function MiniBars({ label, days, pick }: { label: string; days: UsageDay[]; pick: (d: UsageDay) => number }) {
  const [hover, setHover] = useState<number | null>(null);
  const values = days.map(pick);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const shown = hover != null ? days[hover] : null;
  // Gridline at a round number near the top.
  const step = max <= 5 ? 1 : max <= 10 ? 5 : Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-semibold" style={{ color: INK }}>{label}</p>
        <p className="text-[12px] tabular-nums" style={{ color: shown ? INK : FAINT }}>
          {shown ? `${dayLabel(shown.day)}: ${n(pick(shown))}` : `${n(total)} in 30 days`}
        </p>
      </div>
      <div className="relative mt-5 h-[96px]" onMouseLeave={() => setHover(null)}>
        <div className="absolute inset-x-0 top-0 border-t border-dashed" style={{ borderColor: LINE }} />
        <span className="absolute right-0 top-[-14px] text-[10.5px] leading-none tabular-nums" style={{ color: FAINT }}>{n(top)}</span>
        <div className="absolute inset-x-0 bottom-0 border-t" style={{ borderColor: "#16233B26" }} />
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {days.map((d, i) => {
            const v = values[i];
            return (
              <div
                key={d.day}
                className="flex h-full flex-1 items-end"
                onMouseEnter={() => setHover(i)}
                onTouchStart={() => setHover(i)}
                aria-label={`${dayLabel(d.day)}: ${v}`}
              >
                <div
                  className="w-full rounded-t-[3px]"
                  style={{ height: v ? `${Math.max((100 * v) / top, 3)}%` : 0, background: hover === i ? "#245BA6" : BLUE, opacity: hover == null || hover === i ? 1 : 0.55 }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10.5px]" style={{ color: FAINT }}>
        <span>{days[0] ? shortDate(`${days[0].day}T12:00:00`) : ""}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

// ---- Follow-ups ---------------------------------------------------------------------------

function FollowUps({ users }: { users: UsageUser[] }) {
  const [copied, setCopied] = useState<UsageFlag | null>(null);
  const groups = FLAG_ORDER.map((flag) => ({ flag, people: users.filter((u) => !u.internal && u.flags.includes(flag)) })).filter((g) => g.people.length);
  return (
    <Card className="mt-6 px-5 py-5 sm:px-7 sm:py-6">
      <h2 className="text-[19px] font-bold tracking-[-0.02em]" style={{ color: INK }}>People To Follow Up With</h2>
      <p className="text-[13px]" style={{ color: BODY }}>A short personal email from you goes a long way at these moments.</p>
      {!groups.length && <p className="mt-4 text-[14px]" style={{ color: BODY }}>Nobody right now.</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {groups.map(({ flag, people }) => (
          <div key={flag} className="rounded-2xl bg-white/80 px-4 py-3.5 ring-1 ring-[#16233B]/[0.06]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14.5px] font-bold" style={{ color: INK }}>
                {FLAGS[flag].label} <span className="ml-1 tabular-nums" style={{ color: FAINT }}>{people.length}</span>
              </p>
              <button
                type="button"
                className="shrink-0 text-[13px] font-semibold"
                style={{ color: BLUE }}
                onClick={async () => {
                  await navigator.clipboard?.writeText(people.map((p) => p.email).join(", ")).catch(() => {});
                  setCopied(flag);
                  setTimeout(() => setCopied((c) => (c === flag ? null : c)), 2000);
                }}
              >
                {copied === flag ? "Copied" : "Copy Emails"}
              </button>
            </div>
            <p className="mt-0.5 text-[12.5px] leading-[1.45]" style={{ color: BODY }}>{FLAGS[flag].why}</p>
            <ul className="mt-2 divide-y divide-[#16233B]/[0.06]">
              {people.slice(0, 12).map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-3 py-1.5 text-[13px]">
                  <span className="min-w-0">
                    <span className="font-semibold" style={{ color: INK }}>{p.name}</span>{" "}
                    <a href={`mailto:${p.email}`} className="break-all" style={{ color: BLUE }}>{p.email}</a>
                  </span>
                  <span className="shrink-0 text-[12px]" style={{ color: FAINT }}>
                    {flag === "trial_ending" && p.expiresAt ? `ends ${ago(p.expiresAt).replace(" ago", "")}`.replace("ends Just now", "ends today") : `joined ${p.daysSinceSignup}d ago`}
                  </span>
                </li>
              ))}
              {people.length > 12 && <li className="py-1.5 text-[12.5px]" style={{ color: FAINT }}>and {people.length - 12} more (Copy Emails has everyone)</li>}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---- Users table --------------------------------------------------------------------------

type Col = { key: string; label: string; num?: boolean; sort: (u: UsageUser) => number | string; title?: string };
const time = (iso: string | null) => (iso ? new Date(iso).getTime() : -Infinity);
const COLS: Col[] = [
  { key: "name", label: "Person", sort: (u) => u.name.toLowerCase() },
  { key: "signedUp", label: "Signed Up", sort: (u) => time(u.signedUpAt) },
  { key: "stage", label: "Furthest Step", num: true, sort: (u) => u.stage },
  { key: "status", label: "Status", sort: (u) => STATUS_ORDER.indexOf(u.status) },
  { key: "today", label: "Today", num: true, sort: (u) => u.logsToday, title: "Things logged today: meals, check-ins, water, workouts, weight" },
  { key: "week", label: "7 Days", num: true, sort: (u) => u.logs7d, title: "Things logged in the last 7 days" },
  { key: "meals", label: "Meals", num: true, sort: (u) => u.totalMeals, title: "Meals logged, all time" },
  { key: "lastMeal", label: "Last Meal", sort: (u) => time(u.lastMealAt) },
  { key: "lastActive", label: "Last Active", sort: (u) => time(u.lastActivityAt) },
  { key: "checkIn", label: "Check-In Today", sort: (u) => Number(u.reflectedToday) * 1000 + u.reflections },
  { key: "push", label: "Push", sort: (u) => Number(u.pushEnabled) },
  { key: "flags", label: "Flags", sort: (u) => u.flags.length },
];

function UserTable({ users }: { users: UsageUser[] }) {
  const [query, setQuery] = useState("");
  const [showInternal, setShowInternal] = useState(false);
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: "lastActive", desc: true });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const col = COLS.find((c) => c.key === sort.key) ?? COLS[8];
    return users
      .filter((u) => showInternal || !u.internal)
      .filter((u) => !q || [u.name, u.email, u.code ?? "", statusLabel(u), STAGES[u.stage - 1] ?? "", ...u.flags.map((f) => FLAGS[f]?.label ?? f)].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => {
        const x = col.sort(a), y = col.sort(b);
        const c = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number);
        return (sort.desc ? -c : c) || time(b.lastActivityAt) - time(a.lastActivityAt) || a.name.localeCompare(b.name);
      });
  }, [users, query, showInternal, sort]);
  const internalCount = users.filter((u) => u.internal).length;
  const by = (key: string) => setSort((s) => ({ key, desc: s.key === key ? !s.desc : !["name", "status"].includes(key) }));

  return (
    <>
      <div className="mx-auto mt-9 flex max-w-[65rem] flex-wrap items-center justify-between gap-3 lg:max-w-none">
        <h2 className="text-[19px] font-bold tracking-[-0.02em]" style={{ color: INK }}>
          Everyone <span className="ml-1 text-[15px] tabular-nums" style={{ color: FAINT }}>{rows.length}</span>
        </h2>
        <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 sm:w-auto">
          {internalCount > 0 && (
            <label className="flex items-center gap-2 text-[13px]" style={{ color: BODY }}>
              <input type="checkbox" checked={showInternal} onChange={(e) => setShowInternal(e.target.checked)} />
              Show staff and test accounts ({internalCount})
            </label>
          )}
          <button type="button" onClick={() => downloadCsv(rows)} className="text-[14px] font-semibold" style={{ color: BLUE }}>
            Download CSV
          </button>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, status or flag"
            className="w-full rounded-full bg-white px-4 py-2 text-[14px] ring-1 ring-[#16233B]/[0.1] outline-none focus:ring-2 focus:ring-[#6FA8FF] sm:w-72"
            style={{ color: INK }}
          />
        </div>
      </div>

      {/* Phones and small tablets get stacked cards with a sort menu; the full table needs a laptop's width. */}
      <div className="mx-auto mt-3 max-w-[65rem] lg:hidden">
        <select
          value={`${sort.key}:${sort.desc ? "desc" : "asc"}`}
          onChange={(e) => {
            const [key, dir] = e.target.value.split(":");
            setSort({ key, desc: dir === "desc" });
          }}
          className="mb-3 w-full rounded-full bg-white px-4 py-2 text-[14px] font-semibold ring-1 ring-[#16233B]/[0.1]"
          style={{ color: INK }}
          aria-label="Sort by"
        >
          {COLS.flatMap((c) => [
            <option key={`${c.key}d`} value={`${c.key}:desc`}>Sort: {c.label} {c.key === "name" ? "(Z to A)" : "(highest or newest first)"}</option>,
            <option key={`${c.key}a`} value={`${c.key}:asc`}>Sort: {c.label} {c.key === "name" ? "(A to Z)" : "(lowest or oldest first)"}</option>,
          ])}
        </select>
        <Card className="divide-y divide-[#16233B]/[0.06]">
          {rows.map((u) => (
            <PhoneRow key={u.id} u={u} />
          ))}
          {!rows.length && <p className="px-5 py-6 text-center text-[14px]" style={{ color: BODY }}>{users.length ? "Nobody matches that search." : "No users yet."}</p>}
        </Card>
      </div>

      <Card className="mt-3 hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr style={{ color: FAINT }}>
              {COLS.map((c) => (
                <th key={c.key} className={`border-b border-[#16233B]/[0.06] px-2.5 pb-2.5 pt-4 font-semibold first:pl-5 last:pr-5 ${c.num ? "text-right" : "text-left"}`} title={c.title}>
                  <button type="button" onClick={() => by(c.key)} className="whitespace-nowrap font-semibold hover:text-[#101B2E]" style={sort.key === c.key ? { color: INK } : undefined}>
                    {c.label}
                    <span className="ml-1 inline-block w-2" aria-hidden>{sort.key === c.key ? (sort.desc ? "↓" : "↑") : ""}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ color: INK }}>
            {rows.map((u) => (
              <Row key={u.id} u={u} />
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={COLS.length} className="px-4 py-6 text-center" style={{ color: BODY }}>{users.length ? "Nobody matches that search." : "No users yet."}</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function StatusPill({ u }: { u: UsageUser }) {
  const st = STATUS[u.status];
  const until = u.expiresAt && ["trial", "subscribed", "cancelled_active", "billing_issue"].includes(u.status) ? `${u.status === "subscribed" && u.willRenew ? "renews" : "until"} ${shortDate(u.expiresAt)}` : null;
  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex w-fit whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: st?.bg, color: st?.fg }} title={st?.note}>
        {statusLabel(u)}
      </span>
      {until && <span className="mt-0.5 text-[11.5px]" style={{ color: FAINT }}>{until}</span>}
      {u.status === "free_window" && u.freeEndsAt && <span className="mt-0.5 text-[11.5px]" style={{ color: FAINT }}>until {shortDate(u.freeEndsAt)}</span>}
    </span>
  );
}

function Tags({ u }: { u: UsageUser }) {
  return (
    <span className="flex flex-wrap gap-1">
      {u.internal && <span className="rounded-full bg-[#F1F4F9] px-2 py-0.5 text-[11px] font-semibold" style={{ color: BODY }}>Staff Or Test</span>}
      {u.flags.map((f) => (
        <span
          key={f}
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold leading-[1.35]"
          style={f === "still_logging_day7" ? { background: "#E7F6EC", color: "#15803D" } : { background: "#FDF0E8", color: RED }}
          title={FLAGS[f]?.why}
        >
          {FLAGS[f]?.label ?? f}
        </span>
      ))}
    </span>
  );
}

function Row({ u }: { u: UsageUser }) {
  const st = STATUS[u.status];
  const cell = "border-b border-[#16233B]/[0.06] px-2.5 py-2.5 align-top first:pl-5 last:pr-5";
  return (
    <tr style={{ background: `${st?.bg ?? "#fff"}99` }} className={u.internal ? "opacity-60" : undefined}>
      <td className={`${cell} min-w-[190px]`} style={{ boxShadow: `inset 3px 0 0 ${st?.fg ?? FAINT}` }}>
        <p className="font-semibold">{u.name}</p>
        <a href={`mailto:${u.email}`} className="break-all text-[12px]" style={{ color: BODY }}>{u.email}</a>
        {u.code && <p className="text-[11.5px]" style={{ color: FAINT }}>Code {u.code}</p>}
      </td>
      <td className={`${cell} whitespace-nowrap`}>
        <p>{fullDate(u.signedUpAt)}</p>
        <p className="text-[11.5px]" style={{ color: FAINT }}>{u.daysSinceSignup === 0 ? "today" : `${u.daysSinceSignup}d ago`}</p>
      </td>
      <td className={`${cell} whitespace-nowrap text-right`}>
        <p>{STAGES[u.stage - 1]}</p>
        <p className="text-[11.5px] tabular-nums" style={{ color: FAINT }}>step {u.stage} of 8</p>
      </td>
      <td className={cell}><StatusPill u={u} /></td>
      <td className={`${cell} text-right tabular-nums ${u.logsToday ? "font-semibold" : ""}`} style={u.logsToday ? undefined : { color: FAINT }}>{u.logsToday}</td>
      <td className={`${cell} text-right tabular-nums`} style={u.logs7d ? undefined : { color: FAINT }}>{u.logs7d}</td>
      <td className={`${cell} text-right tabular-nums`}>{n(u.totalMeals)}</td>
      <td className={`${cell} whitespace-nowrap`} title={u.lastMealAt ? new Date(u.lastMealAt).toLocaleString("en-CA") : undefined} style={u.lastMealAt ? undefined : { color: FAINT }}>{ago(u.lastMealAt)}</td>
      <td className={`${cell} whitespace-nowrap`} title={u.lastActivityAt ? new Date(u.lastActivityAt).toLocaleString("en-CA") : undefined} style={u.lastActivityAt ? undefined : { color: FAINT }}>{ago(u.lastActivityAt)}</td>
      <td className={`${cell} whitespace-nowrap`}>
        {u.reflectedToday ? <span className="font-semibold" style={{ color: "#15803D" }}>Yes</span> : <span style={{ color: FAINT }}>No</span>}
        <span className="ml-1 text-[11.5px]" style={{ color: FAINT }}>({u.reflections} total)</span>
      </td>
      <td className={`${cell} whitespace-nowrap`} style={u.pushEnabled ? undefined : { color: FAINT }}>{u.pushEnabled ? "On" : "Off"}</td>
      <td className={`${cell} min-w-[120px] max-w-[170px]`}><Tags u={u} /></td>
    </tr>
  );
}

function PhoneRow({ u }: { u: UsageUser }) {
  const st = STATUS[u.status];
  return (
    <div className={`px-5 py-3.5 ${u.internal ? "opacity-60" : ""}`} style={{ boxShadow: `inset 3px 0 0 ${st?.fg ?? FAINT}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold" style={{ color: INK }}>{u.name}</p>
          <a href={`mailto:${u.email}`} className="block truncate text-[12.5px]" style={{ color: BODY }}>{u.email}</a>
        </div>
        <StatusPill u={u} />
      </div>
      <p className="mt-1.5 text-[12.5px]" style={{ color: BODY }}>
        <span className="font-semibold" style={{ color: INK }}>{STAGES[u.stage - 1]}</span> · joined {u.daysSinceSignup === 0 ? "today" : `${u.daysSinceSignup}d ago`}
      </p>
      <p className="text-[12.5px]" style={{ color: BODY }}>
        Last meal {ago(u.lastMealAt).toLowerCase()} · active {ago(u.lastActivityAt).toLowerCase()} · {u.logsToday} today, {u.logs7d} this week · {n(u.totalMeals)} meal{u.totalMeals === 1 ? "" : "s"}
      </p>
      {(u.flags.length > 0 || u.internal) && <div className="mt-1.5"><Tags u={u} /></div>}
    </div>
  );
}

// ---- CSV ----------------------------------------------------------------------------------

function downloadCsv(rows: UsageUser[]) {
  const cols: [string, (u: UsageUser) => string | number | boolean | null][] = [
    ["Name", (u) => u.name],
    ["Email", (u) => u.email],
    ["Signed Up", (u) => u.signedUpAt],
    ["Days Since Signup", (u) => u.daysSinceSignup],
    ["Furthest Step", (u) => `${u.stage} ${STAGES[u.stage - 1]}`],
    ["Status", (u) => statusLabel(u)],
    ["Product", (u) => u.productId],
    ["Status Until", (u) => u.expiresAt],
    ["Will Renew", (u) => u.willRenew],
    ["Logs Today", (u) => u.logsToday],
    ["Logs Last 7 Days", (u) => u.logs7d],
    ["Meals Today", (u) => u.mealsToday],
    ["Total Meals", (u) => u.totalMeals],
    ["First Meal", (u) => u.firstMealAt],
    ["Last Meal", (u) => u.lastMealAt],
    ["Last Active", (u) => u.lastActivityAt],
    ["Days Active", (u) => u.activeDays],
    ["Check-Ins", (u) => u.reflections],
    ["Checked In Today", (u) => u.reflectedToday],
    ["Picture Built", (u) => u.coreAt],
    ["Free Window Ends", (u) => u.freeEndsAt],
    ["Push", (u) => u.pushEnabled],
    ["Creator Code", (u) => u.code],
    ["Staff Or Test", (u) => u.internal],
    ["Flags", (u) => u.flags.map((f) => FLAGS[f]?.label ?? f).join("; ")],
  ];
  const esc = (v: string | number | boolean | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.map((c) => c[0]).join(","), ...rows.map((u) => cols.map((c) => esc(c[1](u))).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `whatyouate-users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
