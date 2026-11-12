"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BackToOwner, Card } from "./Shell";
import { ownerAttribution, sb, type AttributionDay, type OwnerAttribution as Attribution } from "./api";
import { BODY, INK } from "../site";
import { GAMES } from "../games/catalog";

// The owner's website attribution page (/creators/owner/attribution): where website visits come from and what those
// visitors do. Everything comes from owner_attribution in the app repo's supabase/attribution.sql, which only owners can
// call; the counts are sent by components/track.ts. Until that file is installed, the page says so instead of erroring.

const FAINT = "#8FA3C0";
const BLUE = "#2F6FC4";
const LINE = "#16233B14";

const SOURCE_LABEL: Record<string, string> = {
  tiktok: "TikTok Bio Link",
  youtube: "YouTube Bio Link",
  instagram: "Instagram Bio Link",
  facebook: "Facebook Link",
  video: "Game Video End Card",
  "tiktok-video": "Game Video, TikTok",
  "youtube-video": "Game Video, YouTube",
  "instagram-video": "Game Video, Instagram",
  share: "Shared Links",
  google: "Google",
  "other-search": "Other Search",
  direct: "Direct Or Unknown",
  other: "Other Sites",
};
const SOURCE_NOTE: Record<string, string> = {
  tiktok: "whatyouate.app/tt, or a visit from TikTok",
  youtube: "whatyouate.app/yt, or a visit from YouTube",
  instagram: "whatyouate.app/ig, or a visit from Instagram",
  facebook: "whatyouate.app/fb, or a visit from Facebook",
  video: "Typed whatyouate.app/play from a video",
  share: "Score and room links people sent",
  direct: "Typed the address, a bookmark, or an app that hides where people came from",
};

type Days = 7 | 30 | 90;
const WINDOWS: Days[] = [7, 30, 90];

const n = (v: number) => v.toLocaleString("en-CA");
const rate = (v: number | null | undefined) => (v == null ? "" : `${v < 10 ? v.toFixed(1) : Math.round(v)}%`);
const shortDate = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
const gameName = (slug: string) => GAMES.find((g) => g.slug === slug)?.name ?? (slug === "other" ? "Other Game Pages" : slug);

type State = "loading" | "ready" | "notOwner" | "notInstalled" | "error";

export default function OwnerAttribution() {
  const router = useRouter();
  const [days, setDays] = useState<Days>(30);
  const [data, setData] = useState<Attribution | null>(null);
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (d: Days) => {
    const { data: session } = await sb().auth.getSession();
    if (!session.session) {
      router.replace(`/creators/login?next=${encodeURIComponent("/creators/owner/attribution")}`);
      return;
    }
    setBusy(true);
    try {
      setData(await ownerAttribution(d));
      setState("ready");
    } catch (e) {
      const err = e as { message?: string; code?: string };
      const text = `${err?.code ?? ""} ${err?.message ?? ""}`;
      // PostgREST answers PGRST202 for a function it doesn't know (attribution.sql not run yet).
      setState(/not_owner/.test(text) ? "notOwner" : /PGRST202|Could not find the function|42883|does not exist/.test(text) ? "notInstalled" : "error");
    }
    setBusy(false);
  }, [router]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(days);
  }, [load, days]);

  if (state === "loading" && !data) return <p className="py-24 text-center text-[15px]" style={{ color: BODY }}>Loading…</p>;
  if (state !== "ready" || !data) {
    const copy = {
      notOwner: ["Not Allowed", "This page is only for the program's owners."],
      notInstalled: [
        "Install attribution.sql To See This",
        "This page reads from a function that isn't in the database yet. Paste supabase/attribution.sql from the app repo into the Supabase SQL editor and run it, then refresh.",
      ],
      error: ["Couldn't Load", "Something went wrong loading website traffic. Try again in a moment."],
      loading: ["", ""],
      ready: ["", ""],
    }[state];
    return (
      <div className="-mt-6 sm:-mt-10 mx-auto max-w-[44rem]">
        <BackToOwner />
        <Card className="mt-3 px-7 py-9 text-center">
          <h1 className="text-[22px] font-bold tracking-[-0.03em]" style={{ color: INK }}>{copy[0]}</h1>
          <p className="mt-3 text-[15.5px] leading-[1.6]" style={{ color: BODY }}>{copy[1]}</p>
          {state !== "notOwner" && (
            <button type="button" onClick={() => { setState("loading"); load(days); }} className="mt-5 text-[14px] font-semibold" style={{ color: BLUE }}>
              Refresh
            </button>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="-mt-6 sm:-mt-10">
      <div className="mx-auto max-w-[65rem]">
        <BackToOwner />
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[clamp(28px,4.4vw,40px)] font-bold leading-[1.1] tracking-[-0.04em]">Attribution</h1>
            <p className="mt-1 text-[14px]" style={{ color: BODY }}>
              Where website visits come from, and what those visitors do.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-[12.5px]" style={{ color: FAINT }}>
              {busy ? "Loading…" : `Updated ${new Date(data.generatedAt).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}`}
            </span>
            <div className="flex rounded-full bg-white p-1 ring-1 ring-[#16233B]/[0.08]" role="tablist" aria-label="Time window">
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  type="button"
                  role="tab"
                  aria-selected={days === w}
                  onClick={() => setDays(w)}
                  className="rounded-full px-3 py-1.5 text-[13px] font-semibold transition"
                  style={days === w ? { background: INK, color: "#fff" } : { color: BODY }}
                >
                  {w} Days
                </button>
              ))}
            </div>
            <button type="button" onClick={() => load(days)} className="text-[14px] font-semibold" style={{ color: BLUE }}>Refresh</button>
          </div>
        </div>

        <Totals data={data} />
        <Sources data={data} />
        <Daily data={data} />
        <TopGames data={data} />
        <HowToRead />
      </div>
    </div>
  );
}

// ---- Big numbers --------------------------------------------------------------------------

function Totals({ data }: { data: Attribution }) {
  const t = data.totals;
  const tiles: { label: string; value: string; note?: string }[] = [
    { label: "Visits", value: n(t.visit), note: "One per browser session" },
    { label: "Game Opens", value: n(t.game_open) },
    { label: "Game Plays", value: n(t.game_play), note: t.game_open ? `${rate((100 * t.game_play) / t.game_open)} of opens finished a round` : undefined },
    { label: "App Store Taps", value: n(t.app_click) },
    { label: "Tap Rate", value: t.tapRate == null ? "None yet" : rate(t.tapRate), note: "App Store taps per 100 visits" },
    { label: "Shares", value: n(t.share), note: "Taps on a game's Share button" },
  ];
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {tiles.map((x) => (
        <div key={x.label} className="rounded-2xl bg-white/80 px-4 py-3.5 ring-1 ring-[#16233B]/[0.06]">
          <p className="text-[12px] font-medium" style={{ color: BODY }}>{x.label}</p>
          <p className="text-[26px] font-bold leading-[1.25] tracking-[-0.03em] tabular-nums" style={{ color: INK }}>{x.value}</p>
          {x.note && <p className="mt-0.5 text-[12px] leading-[1.35]" style={{ color: FAINT }}>{x.note}</p>}
        </div>
      ))}
    </div>
  );
}

// ---- By source ----------------------------------------------------------------------------

function Sources({ data }: { data: Attribution }) {
  const rows = data.sources;
  const cols = ["Source", "Visits", "Game Opens", "Game Plays", "App Store Taps", "Tap Rate"];
  const cell = "border-b border-[#16233B]/[0.06] px-2.5 py-2.5 first:pl-5 last:pr-5";
  return (
    <Card className="mt-6 overflow-hidden">
      <div className="px-5 pt-5 sm:px-7 sm:pt-6">
        <h2 className="text-[19px] font-bold tracking-[-0.02em]" style={{ color: INK }}>By Source</h2>
        <p className="text-[13px]" style={{ color: BODY }}>Each visit keeps its source for the whole visit, so its game plays and App Store taps count here too.</p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-[13px]">
          <thead>
            <tr style={{ color: FAINT }}>
              {cols.map((c, i) => (
                <th key={c} className={`border-b border-[#16233B]/[0.06] px-2.5 pb-2.5 font-semibold first:pl-5 last:pr-5 ${i ? "text-right" : "text-left"}`}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody style={{ color: INK }}>
            {rows.map((r) => (
              <tr key={r.source}>
                <td className={cell}>
                  <p className="font-semibold">{SOURCE_LABEL[r.source] ?? r.source}</p>
                  {SOURCE_NOTE[r.source] && <p className="text-[11.5px]" style={{ color: FAINT }}>{SOURCE_NOTE[r.source]}</p>}
                </td>
                <td className={`${cell} text-right tabular-nums font-semibold`}>{n(r.visit)}</td>
                <td className={`${cell} text-right tabular-nums`}>{n(r.game_open)}</td>
                <td className={`${cell} text-right tabular-nums`}>{n(r.game_play)}</td>
                <td className={`${cell} text-right tabular-nums`}>{n(r.app_click)}</td>
                <td className={`${cell} text-right tabular-nums`} style={r.tapRate == null ? { color: FAINT } : undefined}>{r.tapRate == null ? "No visits" : rate(r.tapRate)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={cols.length} className="px-4 py-6 text-center" style={{ color: BODY }}>Nothing counted in the last {data.days} days yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---- Per day ------------------------------------------------------------------------------

// Three small charts instead of one with three scales: visits, plays and App Store taps are very different sizes.
function Daily({ data }: { data: Attribution }) {
  const charts: { key: keyof Omit<AttributionDay, "day">; label: string }[] = [
    { key: "visit", label: "Visits" },
    { key: "game_play", label: "Game Plays" },
    { key: "app_click", label: "App Store Taps" },
  ];
  return (
    <Card className="mt-6 px-5 py-5 sm:px-7 sm:py-6">
      <h2 className="text-[19px] font-bold tracking-[-0.02em]" style={{ color: INK }}>Last {data.days} Days</h2>
      <p className="text-[13px]" style={{ color: BODY }}>Per day, Toronto time.</p>
      <div className="mt-4 grid gap-6 md:grid-cols-3">
        {charts.map((c) => (
          <MiniBars key={c.key} label={c.label} days={data.daily} pick={(d) => d[c.key]} />
        ))}
      </div>
    </Card>
  );
}

function MiniBars({ label, days, pick }: { label: string; days: AttributionDay[]; pick: (d: AttributionDay) => number }) {
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
          {shown ? `${dayLabel(shown.day)}: ${n(pick(shown))}` : `${n(total)} in ${days.length} days`}
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
        <span>{days[0] ? shortDate(days[0].day) : ""}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

// ---- Games --------------------------------------------------------------------------------

function TopGames({ data }: { data: Attribution }) {
  const games = data.games.filter((g) => g.opens || g.plays || g.appClicks || g.shares);
  const most = Math.max(1, ...games.map((g) => g.opens));
  return (
    <Card className="mt-6 px-5 py-5 sm:px-7 sm:py-6">
      <h2 className="text-[19px] font-bold tracking-[-0.02em]" style={{ color: INK }}>Top Games</h2>
      <p className="text-[13px]" style={{ color: BODY }}>Most opened first. A play is the first finished round in a visit.</p>
      {!games.length && <p className="mt-4 text-[14px]" style={{ color: BODY }}>No game opens in the last {data.days} days yet.</p>}
      <ul className="mt-4 space-y-3">
        {games.map((g) => (
          <li key={g.slug}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13.5px]">
              <span className="font-semibold" style={{ color: INK }}>{gameName(g.slug)}</span>
              <span className="tabular-nums text-[12.5px]" style={{ color: BODY }}>
                <b style={{ color: INK }}>{n(g.opens)}</b> opens · {n(g.plays)} plays{g.opens ? ` (${rate((100 * g.plays) / g.opens)})` : ""} · {n(g.appClicks)} App Store taps · {n(g.shares)} shares
              </span>
            </div>
            <div className="mt-1 h-[8px] rounded-full" style={{ background: "#16233B0A" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.max((100 * g.opens) / most, g.opens ? 2 : 0)}%`, background: BLUE }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---- Note ---------------------------------------------------------------------------------

function HowToRead() {
  return (
    <Card className="mt-6 px-5 py-5 sm:px-7 sm:py-6">
      <h2 className="text-[19px] font-bold tracking-[-0.02em]" style={{ color: INK }}>How To Read This</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13.5px] leading-[1.55]" style={{ color: BODY }}>
        <li>These are website counts only. They show who reached the site and tapped through to the App Store, not who installed.</li>
        <li>
          Installs per campaign show in App Store Connect (Acquisition, then Campaigns) once the provider token is added to the
          site. Each App Store link carries the page and the source, like games-snack-merge-tiktok, so the names there line up
          with the sources here.
        </li>
        <li>
          Tap Rate is App Store taps for every 100 visits from that source. 5% means 1 in 20 visitors tapped through. Compare
          sources with it: a small source with a high rate is worth more posts.
        </li>
        <li>A rate from only a handful of visits jumps around a lot. Wait for at least 50 visits before reading much into it.</li>
        <li>Nothing about visitors is stored: no cookies, accounts or addresses. Just a count per day.</li>
      </ul>
    </Card>
  );
}
