"use client";

// Shared pieces for every game on whatyouate.app/games, so each new game gets the same phone layout, header and
// back button, help popup, scoreboard, join form, game-over card and fact strip without copying them.
// A game supplies its own canvas and rules; everything around the board comes from here.
// Scores go through the game_* functions in supabase/games.sql (app repo). One sign-up covers every game.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { sb } from "@/components/creators/api";
import { appStoreLink, APP_STORE_ID } from "@/components/site";

export type Mode = "daily" | "endless";
export type Player = { token: string; name: string };
export type Run = { score: number; drops: number; ms: number };   // drops: the game's count of moves (drops, foods eaten)
export type Posted = { rank: number | null; total: number };
export type Toast = { title: string; body: string; img: string };

// ── helpers ────────────────────────────────────────────────────────────────
export function mulberry32(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function torontoDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date()); }   // YYYY-MM-DD
export function dailyNumber(since: string) { return Math.floor((Date.parse(torontoDate()) - Date.parse(since)) / 86400000) + 1; }
/** Same seed for everyone today; `salt` keeps two games from sharing a sequence. */
export function dailySeed(salt = 0) { return Number(torontoDate().replace(/-/g, "")) ^ salt; }
export function readBest(key: string) { try { return Number(localStorage.getItem(key) || 0); } catch { return 0; } }
export function saveBest(key: string, v: number) { try { localStorage.setItem(key, String(v)); } catch {} }
export const foodPng = (code: string) => `/games/foods/${code}.png`;
export const emoji = (code: string) => String.fromCodePoint(parseInt(code, 16));
export function loadImages(codes: string[]) { return codes.map(c => { const i = new Image(); i.src = foodPng(c); return i; }); }

/** Shares with the phone's share sheet, or copies on desktop. Returns true when it copied. */
export async function shareText(text: string) {
  try { if (navigator.share) { await navigator.share({ text }); return false; } await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** Sizes a canvas to fit the board area (width AND height, minus the fact strip if the game has one): no scrolling
 *  on any phone. Action games pass reserve 0: no strip, a bigger board, and the end fact goes on the game-over card. */
export function fitCanvas(canvas: HTMLCanvasElement, wrap: HTMLElement, W: number, H: number, onSize: (s: { w: number; h: number }) => void, reserve = STRIP) {
  const ctx = canvas.getContext("2d")!;
  const resize = () => {
    const s = Math.min(wrap.clientWidth / W, (wrap.clientHeight - reserve) / H), dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${W * s}px`; canvas.style.height = `${H * s}px`; onSize({ w: W * s, h: H * s });
    canvas.width = Math.round(W * s * dpr); canvas.height = Math.round(H * s * dpr);
    ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
  };
  resize(); window.addEventListener("resize", resize);
  const ro = new ResizeObserver(resize); ro.observe(wrap);
  return { ctx, toLocal: (clientX: number) => { const r = canvas.getBoundingClientRect(); return ((clientX - r.left) / r.width) * W; },
    stop: () => { window.removeEventListener("resize", resize); ro.disconnect(); } };
}
const STRIP = 64;   // room kept under the board for the fact strip

// ── hooks ──────────────────────────────────────────────────────────────────
/** A web app, not a page: no scrolling, no pull-to-refresh, no bounce. */
export function useNoScroll() {
  useEffect(() => {
    const h = document.documentElement, b = document.body, prev = [h.style.overflow, b.style.overflow, h.style.overscrollBehavior];
    h.style.overflow = "hidden"; b.style.overflow = "hidden"; h.style.overscrollBehavior = "none";
    return () => { h.style.overflow = prev[0]; b.style.overflow = prev[1]; h.style.overscrollBehavior = prev[2]; };
  }, []);
}

/** The "How to play" popup: opens by itself on a first visit, and from the ⓘ button after that. */
export function useHelp(game: string) {
  const key = `${game}-seen-help`;
  const [open, setOpen] = useState(false);
  const oldKey = `${game.replace(/-/g, "")}-seen-help`;   // Snack Merge's first key, so returning players aren't shown it again
  useEffect(() => { try { if (!localStorage.getItem(key) && !localStorage.getItem(oldKey)) setOpen(true); } catch { setOpen(true); } }, [key, oldKey]);
  return { open, show: () => setOpen(true), close: () => { setOpen(false); try { localStorage.setItem(key, "1"); } catch {} } };
}

const PLAYER_KEY = "wya-games-player", OLD_PLAYER_KEY = "snackmerge-player";   // Snack Merge kept it under its own name first
export function usePlayer() {
  const [player, setPlayer] = useState<Player | null>(null);
  useEffect(() => { try { const v = localStorage.getItem(PLAYER_KEY) ?? localStorage.getItem(OLD_PLAYER_KEY); if (v) setPlayer(JSON.parse(v)); } catch {} }, []);
  const save = (p: Player) => { setPlayer(p); try { localStorage.setItem(PLAYER_KEY, JSON.stringify(p)); } catch {} };
  return [player, save] as const;
}

/** Posts finished runs for a signed-up player and looks up where they landed. */
export function useScores(game: string, mode: Mode, player: Player | null) {
  const [final, setFinal] = useState<Run | null>(null);
  const [posted, setPosted] = useState<Posted | null>(null);
  const apiMode = mode === "daily" ? "daily" : "free", board = mode === "daily" ? "today" : "week";
  const post = async (token: string, f: Run) => {
    if (f.score <= 0) return;
    const { data } = await sb().rpc("game_submit_score", { p_token: token, p_game: game, p_mode: apiMode, p_score: f.score, p_drops: f.drops, p_duration_ms: Math.round(f.ms) });
    if (!data?.ok) return;
    const { data: r } = await sb().rpc("game_my_rank", { p_token: token, p_game: game, p_board: board });
    setPosted({ rank: r?.rank ?? null, total: r?.total ?? 0 });
  };
  const finish = (f: Run) => { setFinal(f); setPosted(null); if (player) post(player.token, f); };
  const reset = () => { setFinal(null); setPosted(null); };
  return { final, posted, finish, post, reset, board };
}

// ── layout ─────────────────────────────────────────────────────────────────
export function GameScreen({ children }: { children: ReactNode }) {
  useNoScroll();
  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-b from-[#e3effe] via-[#f0f6fe] to-[#6fa8ff] text-[#101b2e]"
      style={{ paddingTop: "max(env(safe-area-inset-top), 10px)", paddingBottom: "max(env(safe-area-inset-bottom), 10px)", paddingLeft: 12, paddingRight: 12 }}>
      <div className="mx-auto flex h-full w-full max-w-[440px] flex-col">{children}</div>
    </main>
  );
}

export function GameHeader({ title, mode, onMode, onBoard, onHelp }: { title: string; mode: Mode; onMode: (m: Mode) => void; onBoard: () => void; onHelp: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <a href="/games" aria-label="All games" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-[#3f7fd6]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
      </a>
      <h1 className="text-lg font-bold leading-tight tracking-tight">{title}</h1>
      <div className="ml-auto flex shrink-0 rounded-full bg-white/70 p-0.5 text-xs font-semibold">
        {(["daily", "endless"] as Mode[]).map(m => (
          <button key={m} onClick={() => onMode(m)} className={`rounded-full px-3 py-1.5 ${mode === m ? "bg-[#3f7fd6] text-white" : "text-[#3f7fd6]"}`}>
            {m === "daily" ? "Today" : "Free Play"}
          </button>
        ))}
      </div>
      <button onClick={onBoard} aria-label="Scoreboard" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 text-base">🏆</button>
      <button onClick={onHelp} aria-label="How to play" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 text-sm font-bold text-[#3f7fd6]">i</button>
    </div>
  );
}

/** The board area: fills the space left on screen, keeping room for the fact strip underneath. */
export function BoardArea({ wrapRef, size, children, reserve = STRIP }: { wrapRef: React.RefObject<HTMLDivElement | null>; size: { w: number; h: number }; children: ReactNode; reserve?: number }) {
  return (
    <div ref={wrapRef} className="mt-2 flex min-h-0 flex-1 items-start justify-center touch-none select-none" style={{ paddingBottom: reserve }}>
      <div className="relative" style={{ width: size.w, height: size.h }}>{children}</div>
    </div>
  );
}

/** Food facts slide in under the board, never over it; they go away on their own after 5s (unless sticky), or with the ×. */
export function FactStrip({ toast, onDismiss, width, idle, sticky = false }: { toast: Toast | null; onDismiss: () => void; width: number; idle: ReactNode; sticky?: boolean }) {
  const dismiss = useRef(onDismiss); dismiss.current = onDismiss;   // games re-render often; keep the 5s timer steady
  useEffect(() => { if (!toast || sticky) return; const t = setTimeout(() => dismiss.current(), 5000); return () => clearTimeout(t); }, [toast, sticky]);
  return (
    <div className="pointer-events-none absolute inset-x-0 flex justify-center px-3" style={{ bottom: "max(env(safe-area-inset-bottom), 10px)" }}>
      <div className="pointer-events-auto w-full max-w-[440px]" style={{ maxWidth: width || undefined }}>
        {toast ? (
          <div className="flex items-start gap-2 rounded-2xl bg-white/95 px-3 py-2 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foodPng(toast.img)} alt="" className="mt-0.5 h-7 w-7" />
            <div className="min-w-0 flex-1"><div className="text-xs font-bold text-[#3f7fd6]">{toast.title}</div><div className="text-[13px] leading-snug">{toast.body}</div></div>
            <button onClick={onDismiss} aria-label="Dismiss" className="-mr-1 -mt-1 h-8 w-8 shrink-0 rounded-full text-lg leading-none text-[#5a6b85]">×</button>
          </div>
        ) : <div className="flex h-[52px] items-center justify-center">{idle}</div>}
      </div>
    </div>
  );
}

// ── popups ─────────────────────────────────────────────────────────────────
export function Modal({ onClose, children, z = "z-20" }: { onClose: () => void; children: ReactNode; z?: string }) {
  return (
    <div className={`absolute inset-0 ${z} flex items-center justify-center bg-[#101b2e]/50 p-5`} onClick={onClose}>
      <div className="flex max-h-full w-full max-w-[380px] flex-col overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl [@media(max-height:700px)]:p-4" onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

export function HelpModal({ steps, children, onClose }: { steps: ReactNode[]; children?: ReactNode; onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      <div className="text-center text-xl font-bold">How To Play</div>
      <ol className="mt-3 space-y-2 text-[15px] leading-snug">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e3effe] text-sm font-bold text-[#3f7fd6]">{i + 1}</span><span>{s}</span></li>
        ))}
      </ol>
      {children}
      <button onClick={onClose} className="mt-5 w-full shrink-0 rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Let&apos;s play</button>
    </Modal>
  );
}

/** The Today / Free Play explainer every daily game shows in its help popup. */
export function ModesHelp({ today, free }: { today: string; free: string }) {
  return (
    <div className="mt-4 space-y-1.5 text-sm">
      <p><b>Today:</b> {today}</p>
      <p><b>Free Play:</b> {free}</p>
    </div>
  );
}

/** The end-of-game card. `fact` (for games with no fact strip) shows one fact in a small card underneath it. */
export function GameOver({ label, headline, score, best, mode, posted, joined, campaign, pitch, copied, fact, onBoard, onJoin, onAgain, onShare }: {
  label: string; headline?: string; score: number; best: number; mode: Mode; posted: Posted | null; joined: boolean; campaign: string; pitch: string;
  copied: boolean; fact?: Toast | null; onBoard: () => void; onJoin: () => void; onAgain: () => void; onShare: () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[22px] bg-[#101b2e]/45 p-3">
      <div className="min-h-0 w-full shrink overflow-y-auto rounded-3xl bg-white p-4 text-center shadow-2xl">
        <div className="text-sm font-semibold text-[#5a6b85]">{label}</div>
        {headline && <div className="mt-1 text-base font-bold">{headline}</div>}
        <div className="mt-0.5 text-4xl font-bold leading-tight tabular-nums">{score.toLocaleString()}</div>
        <div className="text-sm text-[#5a6b85]">{score >= best && score > 0 ? "New best!" : `Best: ${best.toLocaleString()}`}</div>
        {posted?.rank ? (
          <button onClick={onBoard} className="mt-3 w-full rounded-2xl bg-[#e3effe] px-3 py-2 text-sm font-semibold text-[#3f7fd6]">
            🏆 You&apos;re #{posted.rank} of {posted.total} {mode === "daily" ? "today" : "this week"} · See scoreboard
          </button>
        ) : !joined && score > 0 ? (
          <button onClick={onJoin} className="mt-3 w-full rounded-2xl bg-[#fff4d6] px-3 py-2 text-sm font-semibold text-[#8a5a00]">
            🏆 Put your score on the scoreboard
          </button>
        ) : null}
        <div className="mt-3 flex gap-2">
          <button onClick={onAgain} className="flex-1 rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Play again</button>
          <button onClick={onShare} className="flex-1 rounded-full bg-[#e3effe] py-3 font-semibold text-[#3f7fd6]">{copied ? "Copied!" : "Share"}</button>
        </div>
        <p className="mt-3 text-[13px] leading-snug text-[#5a6b85]">{pitch}</p>
        <a href={appStoreLink(campaign)} className="mt-2 inline-block rounded-full bg-[#101b2e] px-5 py-2.5 text-sm font-semibold text-white">Get WhatYouAte</a>
      </div>
      {fact && (
        <div className="flex w-full shrink-0 items-start gap-2 rounded-2xl bg-white/95 px-3 py-2 text-left shadow-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foodPng(fact.img)} alt="" className="mt-0.5 h-7 w-7" />
          <div className="min-w-0 flex-1"><div className="text-xs font-bold text-[#3f7fd6]">{fact.title}</div><div className="text-[13px] leading-snug">{fact.body}</div></div>
        </div>
      )}
    </div>
  );
}

const NAME_ERRORS: Record<string, string> = {
  name_short: "Your name needs at least 2 characters.", name_long: "Keep your name to 20 characters.",
  name_characters: "Use letters, numbers, spaces, dots, dashes or underscores.", name_blocked: "Pick a different name.",
  name_reserved: "That name is reserved. Pick another.", email: "That email doesn't look right.",
};

/** One sign-up for every game. The news box is separate and unticked (CASL); joining never depends on it. */
export function JoinForm({ onClose, onJoined }: { onClose: () => void; onJoined: (p: Player) => void }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [updates, setUpdates] = useState(false);   // "someone beat your score" emails left out for now (Dillon: it'd get annoying)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const submit = async () => {
    setBusy(true); setErr("");
    const { data, error } = await sb().rpc("game_register", { p_name: name, p_email: email, p_notify: false, p_marketing: updates });
    setBusy(false);
    if (error || !data?.ok) { setErr(NAME_ERRORS[data?.error] ?? "Something went wrong. Try again."); return; }
    onJoined({ token: data.token, name: data.name });
  };
  return (
    <Modal onClose={onClose} z="z-30">
      <div className="text-center text-xl font-bold">Join The Scoreboard</div>
      <p className="mt-1 text-center text-sm text-[#5a6b85]">Your name shows on the board. Your email never does.</p>
      <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#5a6b85]">Name</label>
      <input value={name} onChange={e => setName(e.target.value)} maxLength={20} placeholder="e.g. SnackKing" className="mt-1 w-full rounded-xl border border-[#d6e2f5] px-3 py-2.5 text-base outline-none focus:border-[#3f7fd6]" />
      <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-[#5a6b85]">Email</label>
      <input value={email} onChange={e => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" className="mt-1 w-full rounded-xl border border-[#d6e2f5] px-3 py-2.5 text-base outline-none focus:border-[#3f7fd6]" />
      <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={updates} onChange={e => setUpdates(e.target.checked)} className="mt-0.5 h-4 w-4" />Send me WhatYouAte news, new games and food tips</label>
      {err && <p className="mt-3 text-sm font-semibold text-[#d64545]">{err}</p>}
      <button disabled={busy} onClick={submit} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white disabled:opacity-60">{busy ? "Adding you..." : "Add me to the board"}</button>
      <p className="mt-3 text-center text-[11px] text-[#5a6b85]">You can unsubscribe any time. See our <a href="/privacy" className="underline">privacy policy</a>.</p>
    </Modal>
  );
}

type Row = { rank: number; name: string; score: number };
export function Scoreboard({ game, token, initial, todayNote, onClose, onJoin }: { game: string; token?: string; initial: string; todayNote: string; onClose: () => void; onJoin: () => void }) {
  const [tab, setTab] = useState(initial); const [rows, setRows] = useState<Row[] | null>(null);
  const [mine, setMine] = useState<{ rank: number | null; score?: number; total?: number } | null>(null);
  useEffect(() => {
    let live = true; setRows(null); setMine(null);
    (async () => {
      const { data } = await sb().rpc("game_leaderboard", { p_game: game, p_board: tab, p_limit: 50 });
      if (live) setRows((data as Row[]) ?? []);
      if (token) { const { data: m } = await sb().rpc("game_my_rank", { p_token: token, p_game: game, p_board: tab }); if (live) setMine(m); }
    })();
    return () => { live = false; };
  }, [game, tab, token]);
  const tabs: [string, string][] = [["today", "Today"], ["week", "This Week"], ["all", "All-Time"]];
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#101b2e]/50 p-4" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-[400px] flex-col rounded-3xl bg-white p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><div className="text-xl font-bold">🏆 Scoreboard</div>
          <button onClick={onClose} aria-label="Close" className="h-8 w-8 rounded-full text-xl text-[#5a6b85]">×</button></div>
        <div className="mt-2 flex rounded-full bg-[#f0f6fe] p-0.5 text-xs font-semibold">
          {tabs.map(([k, label]) => (<button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-full py-1.5 ${tab === k ? "bg-[#3f7fd6] text-white" : "text-[#3f7fd6]"}`}>{label}</button>))}
        </div>
        <p className="mt-2 text-center text-[11px] text-[#5a6b85]">{tab === "today" ? todayNote : tab === "week" ? "Best Free Play scores since Monday." : "Best Free Play scores ever."}</p>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
          {rows === null ? <p className="py-6 text-center text-sm text-[#5a6b85]">Loading...</p>
            : rows.length === 0 ? <p className="py-6 text-center text-sm text-[#5a6b85]">No scores yet. Be the first!</p>
            : rows.map(r => (
              <div key={r.rank} className={`flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm ${mine?.rank === r.rank ? "bg-[#e3effe] font-semibold" : ""}`}>
                <span className="w-7 text-right tabular-nums text-[#5a6b85]">{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</span>
                <span className="min-w-0 flex-1 truncate">{r.name}</span><span className="tabular-nums font-semibold">{r.score.toLocaleString()}</span>
              </div>))}
        </div>
        <div className="mt-2 border-t border-[#e3effe] pt-2 text-center text-sm">
          {token ? (mine?.rank ? <span>You&apos;re <b>#{mine.rank}</b> of {mine.total} with <b>{mine.score?.toLocaleString()}</b></span> : <span className="text-[#5a6b85]">Play a round to get on this board.</span>)
            : <button onClick={onJoin} className="font-semibold text-[#3f7fd6]">Join The Scoreboard →</button>}
        </div>
      </div>
    </div>
  );
}

/** Everything a game needs around its board, wired up: player, scores, popups. The game renders <Popups/>. */
export function useGameShell(game: string, mode: Mode) {
  const [player, savePlayer] = usePlayer();
  const scores = useScores(game, mode, player);
  const help = useHelp(game);
  const [joinOpen, setJoinOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const finishRef = useRef(scores.finish); finishRef.current = scores.finish;   // the game loop always calls the latest
  const share = async (text: string) => { if (await shareText(text)) { setCopied(true); setTimeout(() => setCopied(false), 2000); } };
  // the pause button, plus an automatic pause when you switch apps or lock the phone mid-run (see PauseButton)
  const [held, setHeld] = useState(false);
  useEffect(() => { const f = () => { if (document.hidden) setHeld(true); }; document.addEventListener("visibilitychange", f); return () => document.removeEventListener("visibilitychange", f); }, []);
  const prize = usePrize();
  const paused = help.open || joinOpen || boardOpen || held || prize.step !== null;
  return { game, player, savePlayer, scores, help, joinOpen, setJoinOpen, boardOpen, setBoardOpen, copied, share, finishRef, paused, held, setHeld, prize };
}
export type Shell = ReturnType<typeof useGameShell>;

/** A small pause button for real-time games (put it in the score row). `active` = a run is going. */
export function PauseButton({ shell, active }: { shell: Shell; active: boolean }) {
  const { held, setHeld } = shell;
  useEffect(() => { if (!active && held) setHeld(false); }, [active, held, setHeld]);   // nothing to pause between runs
  return (
    <button onClick={() => setHeld(true)} aria-label="Pause" disabled={!active}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 text-[#3f7fd6] transition ${active ? "" : "opacity-0"}`}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1.5" y="1" width="3" height="10" rx="1" /><rect x="7.5" y="1" width="3" height="10" rx="1" /></svg>
    </button>
  );
}

/** The "Paused" card over the board (put it inside BoardArea). */
export function PausedCard({ shell, active }: { shell: Shell; active: boolean }) {
  if (!active || !shell.held) return null;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[22px] bg-[#101b2e]/45 p-4">
      <div className="w-full max-w-[280px] rounded-3xl bg-white p-5 text-center shadow-2xl">
        <div className="text-xl font-bold">Paused</div>
        <button onClick={() => shell.setHeld(false)} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Resume</button>
      </div>
    </div>
  );
}

/** The join form and scoreboard, opened from the 🏆 button or the game-over card. Joining posts the run just played. */
export function ShellPopups({ shell, game, todayNote }: { shell: Shell; game: string; todayNote: string }) {
  const { player, savePlayer, scores, joinOpen, setJoinOpen, boardOpen, setBoardOpen, prize } = shell;
  return (
    <>
      {prize.step && <PrizeCard shell={shell} />}
      {joinOpen && <JoinForm onClose={() => setJoinOpen(false)} onJoined={async (p) => {
        savePlayer(p); setJoinOpen(false); if (scores.final) await scores.post(p.token, scores.final);
        if (!prize.step) setBoardOpen(true);                // joining to claim a prize goes back to the prize card
      }} />}
      {boardOpen && <Scoreboard game={game} token={player?.token} initial={scores.board} todayNote={todayNote}
        onClose={() => setBoardOpen(false)} onJoin={() => { setBoardOpen(false); setJoinOpen(true); }} />}
    </>
  );
}

// ── daily logo prize ───────────────────────────────────────────────────────
// Once a day (per device, across every game) a gold WhatYouAte logo floats across the board for a few seconds.
// Catch it, join the scoreboard if you haven't, answer the skill-testing question, and get a one-time App Store
// code for 30 days of Pro. The server (supabase/games_prize.sql) holds the switch, the daily cap (3) and the
// one-prize-per-person rule; the logo only shows while it's on and prizes are left today.
const PRIZE_DAY_KEY = "wya-prize-chance", PRIZE_WON_KEY = "wya-prize-won";
type PrizeStep = "caught" | "claiming" | "won" | "gone" | "tried" | "error";
function usePrize() {
  const [armed, setArmed] = useState(false);          // the logo may show this session
  const [step, setStep] = useState<PrizeStep | null>(null);
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    try { if (localStorage.getItem(PRIZE_WON_KEY) || localStorage.getItem(PRIZE_DAY_KEY) === torontoDate()) return; } catch { return; }
    sb().rpc("game_prize_status").then(({ data }) => { if (data?.on && data.left > 0) setArmed(true); });
  }, []);
  const used = () => { setArmed(false); try { localStorage.setItem(PRIZE_DAY_KEY, torontoDate()); } catch {} };
  return { armed, used, step, setStep, code, setCode };
}

/** The floating logo. Put it inside BoardArea; `active` = a run is going (it waits for real play time). */
export function PrizeLogo({ shell, active }: { shell: Shell; active: boolean }) {
  const { prize } = shell, armed = prize.armed;
  const [show, setShow] = useState<{ y: number; fromLeft: boolean } | null>(null);
  const wait = useRef(6000 + Math.random() * 24000);   // 6 to 30 seconds of play
  const used = useRef(prize.used); used.current = prize.used;   // games re-render often; keep the countdown running
  useEffect(() => {
    if (!armed || !active || show) return;
    const t = setInterval(() => {
      wait.current -= 250;
      if (wait.current <= 0) { clearInterval(t); used.current(); setShow({ y: 18 + Math.random() * 45, fromLeft: Math.random() < 0.5 }); }
    }, 250);
    return () => clearInterval(t);
  }, [armed, active, show]);
  useEffect(() => { if (!show) return; const t = setTimeout(() => setShow(null), 3200); return () => clearTimeout(t); }, [show]);
  if (!show) return null;
  return (
    <button aria-label="Catch the WhatYouAte logo"
      onPointerDown={e => { e.stopPropagation(); e.preventDefault(); setShow(null); prize.setStep("caught"); }}
      className="absolute z-[5] flex h-[72px] w-[72px] items-center justify-center rounded-full"
      style={{ top: `${show.y}%`, animation: `wya-prize-${show.fromLeft ? "ltr" : "rtl"} 3.2s linear forwards`,
        background: "radial-gradient(circle, #ffe9a8 0%, #f5c542 60%, #d99a17 100%)", boxShadow: "0 0 0 4px rgba(255,255,255,0.8), 0 0 28px 8px rgba(245,197,66,0.75)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-512.png" alt="" className="h-[50px] w-[50px] rounded-[12px]" />
      <style>{`@keyframes wya-prize-ltr { 0% { left: -80px; transform: translateY(0) } 50% { transform: translateY(-18px) } 100% { left: calc(100% + 8px); transform: translateY(0) } }
        @keyframes wya-prize-rtl { 0% { left: calc(100% + 8px); transform: translateY(0) } 50% { transform: translateY(-18px) } 100% { left: -80px; transform: translateY(0) } }`}</style>
    </button>
  );
}

function PrizeCard({ shell }: { shell: Shell }) {
  const { prize, player, setJoinOpen } = shell;
  const [q] = useState(() => { const a = 3 + Math.floor(Math.random() * 7), b = 2 + Math.floor(Math.random() * 7), c = 1 + Math.floor(Math.random() * 9); return { text: `${a} × ${b} + ${c}`, answer: a * b + c }; });
  const [answer, setAnswer] = useState(""); const [wrong, setWrong] = useState(false); const [copied, setCopied] = useState(false);
  const close = () => prize.setStep(null);
  const claim = async () => {
    if (Number(answer.trim()) !== q.answer) { setWrong(true); return; }
    if (!player) return;
    prize.setStep("claiming");
    const { data, error } = await sb().rpc("game_prize_claim", { p_token: player.token, p_game: shell.game });
    if (error || !data) { prize.setStep("error"); return; }
    if (data.ok) { prize.setCode(data.code); prize.setStep("won"); try { localStorage.setItem(PRIZE_WON_KEY, "1"); } catch {} return; }
    prize.setStep(data.error === "tried_today" ? "tried" : data.error === "gone" || data.error === "off" ? "gone" : "error");
  };
  const step = prize.step;
  return (
    <Modal onClose={step === "claiming" ? () => {} : close} z="z-30">
      <div className="text-center text-4xl">🎉</div>
      {step === "caught" && (<>
        <div className="mt-1 text-center text-xl font-bold">You Caught Today&apos;s Logo!</div>
        <p className="mt-1 text-center text-sm text-[#5a6b85]">Claim a free month of WhatYouAte Pro on iPhone.</p>
        {!player ? (<>
          <p className="mt-4 text-center text-sm">First, join the scoreboard so we know who won.</p>
          <button onClick={() => setJoinOpen(true)} className="mt-3 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Join to claim</button>
        </>) : (<>
          <label className="mt-4 block text-center text-sm">One quick question to claim it: what&apos;s <b>{q.text}</b>?</label>
          <input value={answer} onChange={e => { setAnswer(e.target.value); setWrong(false); }} inputMode="numeric" autoFocus
            className="mx-auto mt-2 block w-28 rounded-xl border border-[#d6e2f5] px-3 py-2.5 text-center text-lg outline-none focus:border-[#3f7fd6]" />
          {wrong && <p className="mt-2 text-center text-sm font-semibold text-[#d64545]">Not quite. Try again.</p>}
          <button onClick={claim} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Claim my free month</button>
        </>)}
        <p className="mt-3 text-center text-[11px] text-[#5a6b85]">One prize per person, 3 a day. <a href="/games/prize-rules" target="_blank" className="underline">Rules</a></p>
      </>)}
      {step === "claiming" && <p className="mt-3 text-center text-sm text-[#5a6b85]">Checking...</p>}
      {step === "won" && prize.code && (<>
        <div className="mt-1 text-center text-xl font-bold">Your Free Month</div>
        <p className="mt-1 text-center text-sm text-[#5a6b85]">30 days of WhatYouAte Pro. Save this code: it works once.</p>
        <div className="mt-4 rounded-2xl bg-[#f0f6fe] px-3 py-3 text-center font-mono text-lg font-bold tracking-wider">{prize.code}</div>
        <button onClick={async () => { try { await navigator.clipboard.writeText(prize.code!); setCopied(true); } catch {} }} className="mt-2 w-full rounded-full bg-[#e3effe] py-2.5 text-sm font-semibold text-[#3f7fd6]">{copied ? "Copied!" : "Copy code"}</button>
        <a href={`https://apps.apple.com/redeem?ctx=offercodes&id=${APP_STORE_ID}&code=${encodeURIComponent(prize.code)}`} className="mt-2 block w-full rounded-full bg-[#101b2e] py-3 text-center font-semibold text-white">Redeem in the App Store</a>
        <button onClick={close} className="mt-2 w-full py-2 text-sm font-semibold text-[#5a6b85]">Back to the game</button>
      </>)}
      {(step === "gone" || step === "tried" || step === "error") && (<>
        <div className="mt-1 text-center text-xl font-bold">{step === "gone" ? "Today's Prizes Are Gone" : step === "tried" ? "You've Had Today's Chance" : "Something Went Wrong"}</div>
        <p className="mt-2 text-center text-sm text-[#5a6b85]">{step === "gone" ? "Nice catch, but all 3 of today's prizes were claimed. The logo's back tomorrow." : step === "tried" ? "One try a day. The logo's back tomorrow." : "We couldn't check your prize. Try again in a moment."}</p>
        <button onClick={close} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Back to the game</button>
      </>)}
    </Modal>
  );
}
