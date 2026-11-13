"use client";

// Shared pieces for every game on whatyouate.app/games, so each new game gets the same phone layout, header and
// back button, help popup, scoreboard, join form, game-over card and fact strip without copying them.
// A game supplies its own canvas and rules; everything around the board comes from here.
// Scores go through the game_* functions in supabase/games.sql (app repo). One sign-up covers every game.
// The look (KIT_CSS, in ./look) matches Fridge Raid and Kitchen Golf: the Lilita One display face for titles, labels, numbers
// and buttons, light panels with a navy edge and a chunky lip, and buttons with a darker bottom lip. Geist stays for
// sentences. Class names are prefixed wk- so a game can restyle a card through a wrapper.
// Sound: every game plays through ./sfx (one shared on/off setting) and shows the same SoundButton at the right-hand end
// of its score row. The shell keeps the sound quiet while a popup is open, the PauseButton while paused, and GameOver
// once the end sting has played.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { preload } from "react-dom";
import { sb } from "@/components/creators/api";
import { appStoreLink, APP_STORE_ID } from "@/components/site";
import { tagShareText, track, trackGamePlay } from "@/components/track";
import { GAME_FONT_CSS, HUD_FONT } from "./gameFont";
import { KIT_CSS } from "./look";
import { BackIcon, CheckIcon, CloseIcon, InfoIcon, MedalIcon, PauseIcon, PlayIcon, ReplayIcon, ShareIcon, SoundIcon, StarIcon, TrophyIcon } from "./icons";
import { sfx } from "./sfx";
import { drawHint as drawSharedHint, type HintDir } from "./hint";

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
  const finish = (f: Run) => { setFinal(f); setPosted(null); trackGamePlay(game); if (player) post(player.token, f); };   // first finished round this session counts as a play
  const reset = () => { setFinal(null); setPosted(null); };
  return { final, posted, finish, post, reset, board };
}

// ── look ───────────────────────────────────────────────────────────────────
// KIT_CSS (./look) holds the classes; GameScreen puts it on the page.
export { KIT_CSS };

/** A popup's title bar: navy, display face, across the top of a panel. */
function Plate({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`wk-plate flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-center text-[21px] leading-tight ${className}`}>{children}</div>;
}

/** A panel over the board (put it inside BoardArea): the darkened board behind, a light card with a navy edge in front.
 *  `title` puts a navy title bar across the top. Games use it for their own cards so they match the kit's. */
export function OverlayCard({ children, title, max = "max-w-[320px]", z = "z-10", soft = false, className = "" }: {
  children: ReactNode; title?: ReactNode; max?: string; z?: string; soft?: boolean; className?: string;
}) {
  return (
    <div className={`${soft ? "wk-backdrop-soft" : "wk-backdrop"} absolute inset-0 ${z} wk-raise flex items-center justify-center rounded-[22px] p-4`}>
      <div className={`wk-panel wk-pop flex max-h-full w-full ${max} flex-col overflow-hidden text-center`}>
        {title && <Plate>{title}</Plate>}
        <div className={`min-h-0 overflow-y-auto px-5 pb-5 ${title ? "pt-4" : "pt-5"} [@media(max-height:700px)]:px-4 [@media(max-height:700px)]:pb-4 ${className}`}>{children}</div>
      </div>
    </div>
  );
}

// Class names for a game's own buttons and card text, so they match the kit's. Add sizes and margins with Tailwind.
export const UI = {
  btn: "wk-btn wk-blue",          // the main action
  btn2: "wk-btn wk-light",        // a second choice
  go: "wk-btn wk-go",             // start, ready, play
  navy: "wk-btn wk-navy",
  link: "wk-link",                // a quiet text button (Back, Leave, Cancel)
  title: "wk-f text-[25px] leading-tight text-[#101B2E]",
  label: "wk-f text-[15px] leading-tight tracking-[0.04em] text-[#4F88E8]",
  big: "wk-f leading-none tabular-nums text-[#101B2E]",
  input: "wk-input",
} as const;

// ── layout ─────────────────────────────────────────────────────────────────
export function GameScreen({ children }: { children: ReactNode }) {
  useNoScroll();
  preload("/fonts/LilitaOne-Regular.ttf", { as: "font", type: "font/ttf", crossOrigin: "anonymous" });
  return (
    <main onContextMenu={e => { const el = e.target as HTMLElement; if (!el.closest("input, textarea, [contenteditable=true]")) e.preventDefault(); }}
      className="wk-game fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-b from-[#e3effe] via-[#f0f6fe] to-[#6fa8ff] text-[#101b2e]"
      style={{ paddingTop: "max(env(safe-area-inset-top), 10px)", paddingBottom: "max(env(safe-area-inset-bottom), 10px)", paddingLeft: 12, paddingRight: 12 }}>
      <style>{GAME_FONT_CSS + KIT_CSS}</style>
      <div className="mx-auto flex h-full w-full max-w-[440px] flex-col">{children}</div>
    </main>
  );
}

export function GameHeader({ title, mode, onMode, onBoard, onHelp }: { title: string; mode: Mode; onMode: (m: Mode) => void; onBoard: () => void; onHelp: () => void }) {
  const round = "wk-round h-[32px] w-[32px] shrink-0 min-[390px]:h-[34px] min-[390px]:w-[34px]";
  return (
    <div className="flex h-[40px] shrink-0 items-center gap-1.5">
      <a href="/games" aria-label="All games" className={round}><BackIcon size={17} /></a>
      <h1 className="wk-f line-clamp-2 min-w-0 flex-1 pl-0.5 text-[19px] leading-[0.95] text-[#101B2E] [text-shadow:0_2px_0_rgba(255,255,255,0.95)] min-[390px]:text-[21px]">{title}</h1>
      <div className="wk-seg h-[32px] shrink-0 text-[13px] min-[390px]:h-[34px] min-[390px]:text-[13.5px]">
        {(["daily", "endless"] as Mode[]).map(m => (
          <button key={m} onClick={() => onMode(m)} aria-pressed={mode === m} className="px-2.5 min-[390px]:px-[11px]">
            {m === "daily" ? "Today" : "Free Play"}
          </button>
        ))}
      </div>
      <button onClick={onBoard} aria-label="Scoreboard" className={round}><TrophyIcon size={21} /></button>
      <button onClick={onHelp} aria-label="How to play" className={`${round} text-[#4F88E8]`}><InfoIcon size={16} /></button>
    </div>
  );
}

/** The score row under the header: `HudStat` chips either side, a `HudTag` in the middle. */
export const HUD_ROW = "mt-2 flex h-[40px] shrink-0 items-center justify-between gap-1.5";

/** One number in a game's score row: a small label over a display-face number, on a navy chip (blue or red for a player). */
export function HudStat({ label, value, align = "left", tone = "navy", className = "" }: {
  label: ReactNode; value: ReactNode; align?: "left" | "right"; tone?: "navy" | "blue" | "red"; className?: string;
}) {
  return (
    <div className={`wk-hud ${tone !== "navy" ? `wk-hud-${tone}` : ""} flex h-[38px] min-w-[58px] max-w-[132px] shrink-0 flex-col justify-center gap-[3px] px-2.5 ${align === "right" ? "items-end text-right" : "items-start"} ${className}`}>
      <span className="wk-hud-label block max-w-full truncate">{label}</span>
      <span className="wk-f flex items-center gap-1 text-[19px] leading-none tabular-nums">{value}</span>
    </div>
  );
}

/** The middle of a score row: a chunky pill in the game's colour for its status (or light, for plain info). */
export function HudTag({ children, color, light = false, className = "" }: { children: ReactNode; color?: string; light?: boolean; className?: string }) {
  // On a narrow phone with big scores the words can run out of room: step the size down a little (to 12px at the least)
  // before cutting them off. Checked after every render, since the numbers either side change as you play.
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.fontSize = "";
    for (let px = 13.5; px >= 12 && el.scrollWidth > el.clientWidth + 0.5; px -= 0.5) el.style.fontSize = `${px}px`;
  });
  return (
    <div className={`wk-tag ${light ? "wk-tag-light" : ""} flex h-[28px] min-w-0 items-center justify-center truncate px-3 text-[14px] leading-none ${className}`}
      style={light ? undefined : { backgroundColor: color ?? "#3F7FD6" }}>
      <span ref={ref} className="truncate">{children}</span>
    </div>
  );
}

/** A game's start screen over the board: which challenge, the game's name, how to play, and a big Tap To Start.
 *  The whole board is the button, so a tap anywhere starts. */
export function StartCard({ label, title, how, onStart }: { label: string; title: string; how: ReactNode; onStart: () => void }) {
  return (
    <button onClick={onStart} className="wk-backdrop-soft wk-raise absolute inset-0 flex items-center justify-center rounded-[22px] p-5">
      <span className="wk-panel wk-pop flex w-full max-w-[300px] flex-col overflow-hidden text-center">
        <span className="wk-plate block px-4 py-2 text-[17px] leading-tight">{label}</span>
        <span className="flex flex-col items-center px-5 pb-5 pt-3.5">
          <span className="wk-f text-[32px] leading-none text-[#101B2E] tracking-[-0.03em]">{title}</span>
          <span className="mt-2 text-[14px] leading-snug text-[#41526e]">{how}</span>
          <span className="wk-btn wk-go wk-pulse mt-4 h-[54px] w-full text-[23px]">Tap To Start</span>
        </span>
      </span>
    </button>
  );
}

/** A first-move hint drawn on a game's canvas ("Drag Back To Throw"): the shared WhatYouAte hint pill (./hint). `w` is
 *  kept for older callers and ignored: the pill sizes itself to its words. */
export function drawHintPill(c: CanvasRenderingContext2D, cx: number, y: number, label: string, t: number, _w?: number, dir: HintDir = "left") {
  void _w;
  drawSharedHint(c, cx, y, label, t, dir);
}

/** The board area: fills the space left on screen, keeping room for the fact strip underneath. */
export function BoardArea({ wrapRef, size, children, reserve = STRIP }: { wrapRef: React.RefObject<HTMLDivElement | null>; size: { w: number; h: number }; children: ReactNode; reserve?: number }) {
  return (
    <div ref={wrapRef} className="mt-2 flex min-h-0 flex-1 items-start justify-center touch-none select-none" style={{ paddingBottom: reserve }}>
      <div className="relative" style={{ width: size.w, height: size.h }}>{children}</div>
    </div>
  );
}

/** One food fact on a small card (the fact strip, the game-over card). */
function FactCard({ fact, onDismiss, className = "" }: { fact: Toast; onDismiss?: () => void; className?: string }) {
  return (
    <div className={`wk-card flex items-start gap-2.5 px-3 py-2 text-left ${className}`}>
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef4ff]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foodPng(fact.img)} alt="" className="h-7 w-7" />
      </span>
      <div className="min-w-0 flex-1"><div className="wk-f text-[14px] capitalize leading-tight text-[#4F88E8]">{fact.title}</div><div className="mt-0.5 text-[13px] leading-snug text-[#24324d]">{fact.body}</div></div>
      {onDismiss && <button onClick={onDismiss} aria-label="Dismiss" className="-mr-1 -mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8a9ab3]"><CloseIcon size={13} /></button>}
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
        {toast ? <FactCard fact={toast} onDismiss={onDismiss} />
          : <div className="flex h-[52px] items-center justify-center">{idle}</div>}
      </div>
    </div>
  );
}

// ── popups ─────────────────────────────────────────────────────────────────
/** A popup over the whole game. `title` (optional) puts a navy title bar across the top. */
export function Modal({ onClose, children, z = "z-20", title }: { onClose: () => void; children: ReactNode; z?: string; title?: ReactNode }) {
  return (
    <div className={`wk-backdrop wk-raise absolute inset-0 ${z} flex items-center justify-center p-5`} onClick={onClose}>
      <div className="wk-panel wk-pop flex max-h-full w-full max-w-[380px] flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {title && <Plate className="text-[23px]">{title}</Plate>}
        <div className={`flex min-h-0 flex-col overflow-y-auto px-5 pb-5 ${title ? "pt-4" : "pt-5"} [@media(max-height:700px)]:px-4 [@media(max-height:700px)]:pb-4`}>{children}</div>
      </div>
    </div>
  );
}

export function HelpModal({ steps, children, onClose }: { steps: ReactNode[]; children?: ReactNode; onClose: () => void }) {
  return (
    <Modal onClose={onClose} title="How To Play">
      <ol className="space-y-2.5 text-[15px] leading-snug text-[#24324d]">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3"><span className="wk-step mt-[-1px] flex h-[26px] w-[26px] shrink-0 items-center justify-center text-[15px]">{i + 1}</span><span>{s}</span></li>
        ))}
      </ol>
      {children}
      <button onClick={onClose} className="wk-btn wk-go mt-5 h-[52px] w-full shrink-0 text-[21px]"><PlayIcon size={17} />Let&apos;s Play</button>
    </Modal>
  );
}

/** The Today / Free Play explainer every daily game shows in its help popup. */
export function ModesHelp({ today, free }: { today: string; free: string }) {
  const row = (tag: string, cls: string, text: string) => (
    <div className="flex items-start gap-2.5">
      <span className={`wk-f mt-[1px] w-[74px] shrink-0 rounded-full py-[3px] text-center text-[13px] leading-tight ${cls}`}>{tag}</span>
      <p className="min-w-0 flex-1 text-[14px] leading-snug text-[#24324d] first-letter:uppercase">{text}</p>
    </div>
  );
  return (
    <div className="mt-4 space-y-2 rounded-2xl bg-[#eaf1fd] p-3">
      {row("Today", "bg-[#DDEBFF] text-[#4F88E8]", today)}
      {row("Free Play", "bg-[#5A95F5] text-white shadow-[0_2px_0_#3F78DB]", free)}
    </div>
  );
}

/** The end-of-game card. `fact` (for games with no fact strip) shows one fact in a small card underneath it.
 *  `extra` (optional) goes right under the Play again / Share buttons, e.g. a link to another way to play. */
export function GameOver({ label, headline, score, best, mode, posted, joined, campaign, pitch, copied, fact, extra, onBoard, onJoin, onAgain, onShare }: {
  label: string; headline?: string; score: number; best: number; mode: Mode; posted: Posted | null; joined: boolean; campaign: string; pitch: string;
  copied: boolean; fact?: Toast | null; extra?: ReactNode; onBoard: () => void; onJoin: () => void; onAgain: () => void; onShare: () => void;
}) {
  const newBest = score >= best && score > 0;
  useEffect(() => { sfx.hold("game-over", true, false); return () => sfx.hold("game-over", false); }, []);   // the end sting rings out; nothing new starts
  // Sized to fit a phone's board (about 350 x 530) with every row showing and a fact underneath, without scrolling.
  return (
    <div className="wk-backdrop absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 rounded-[22px] p-3">
      <div className="wk-panel wk-pop flex min-h-0 w-full max-w-[360px] shrink flex-col overflow-hidden text-center">
        <Plate className="py-1.5 text-[17px]">{label}</Plate>
        <div className="min-h-0 overflow-y-auto px-4 pb-3 pt-2.5">
          {headline && <div className="wk-f relative z-[1] text-[18px] leading-tight text-[#101B2E] capitalize">{headline}</div>}
          <div className="relative mx-auto flex justify-center">
            {newBest && <span aria-hidden className="wk-rays pointer-events-none absolute left-1/2 top-1/2 -ml-[90px] -mt-[80px] h-[180px] w-[180px] rounded-full" />}
            <div className="wk-f wk-pop relative text-[52px] leading-[1.04] tabular-nums text-[#101B2E] [animation-delay:120ms] tracking-[-0.03em]">{score.toLocaleString()}</div>
          </div>
          {newBest ? (
            <div className="relative mt-0.5 flex items-center justify-center gap-1.5">
              <StarIcon size={17} className="-rotate-12" />
              <span className="wk-best px-6 py-[4px] text-[15px] leading-none">New Best!</span>
              <StarIcon size={17} className="rotate-12" />
            </div>
          ) : (
            <div className="mt-0.5 flex justify-center">
              <span className="flex items-center gap-1.5 rounded-full bg-[#e3edfc] px-3 py-[3px] text-[#41526e]">
                <span className="text-[10.5px] font-extrabold uppercase tracking-[0.08em]">Best</span>
                <span className="wk-f text-[15px] leading-none tabular-nums text-[#101B2E]">{best.toLocaleString()}</span>
              </span>
            </div>
          )}
          {posted?.rank ? (
            <button onClick={onBoard} className="wk-btn wk-light mt-3 h-[48px] w-full justify-start gap-2.5 px-3.5 text-left">
              <TrophyIcon size={24} className="shrink-0" />
              <span className="flex min-w-0 flex-col items-start">
                <span className="max-w-full truncate text-[16px] leading-tight">You&apos;re #{posted.rank} Of {posted.total} {mode === "daily" ? "Today" : "This Week"}</span>
                <span className="text-[12px] leading-tight text-[#6b7c97]">See Scoreboard</span>
              </span>
              <BackIcon size={15} className="ml-auto shrink-0 rotate-180 text-[#4F88E8]" />
            </button>
          ) : !joined && score > 0 ? (
            <button onClick={onJoin} className="wk-btn wk-go wk-pulse mt-3 h-[48px] w-full text-[17px]">
              <TrophyIcon size={23} className="shrink-0" />Put My Score On The Board
            </button>
          ) : null}
          <div className="mt-2.5 flex gap-2.5">
            <button onClick={onAgain} className="wk-btn wk-blue h-[46px] flex-1 text-[18px]"><ReplayIcon size={17} className="shrink-0" />Play Again</button>
            <button onClick={onShare} className="wk-btn wk-light h-[46px] flex-1 text-[18px]"><ShareIcon size={17} className="shrink-0" />{copied ? "Copied!" : "Share"}</button>
          </div>
          {extra}
          <div className="mt-3 border-t-2 border-dashed border-[#d5e2f6] pt-2">
            <p className="text-[12px] leading-snug text-[#5a6b85]">{pitch}</p>
            <a href={appStoreLink(campaign)} className="wk-btn wk-navy mx-auto mt-1.5 h-[36px] w-fit gap-2 rounded-[13px] pl-1 pr-3.5 text-[14px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-512.png" alt="" className="h-[28px] w-[28px] rounded-[9px]" />Get WhatYouAte
            </a>
          </div>
        </div>
      </div>
      {fact && <FactCard fact={fact} className="w-full max-w-[360px] shrink-0" />}
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
  const label = "wk-f mt-3 block text-[14px] leading-tight tracking-[0.03em] text-[#101B2E]";
  return (
    <Modal onClose={onClose} z="z-30" title={<><TrophyIcon size={26} />Join The Scoreboard</>}>
      <p className="text-center text-sm text-[#5a6b85]">Your name shows on the board. Your email never does.</p>
      <label className={`${label} mt-4`}>Name</label>
      <input value={name} onChange={e => setName(e.target.value)} maxLength={20} placeholder="e.g. SnackKing" className="wk-input mt-1.5 w-full px-3 py-2.5 text-base" />
      <label className={label}>Email</label>
      <input value={email} onChange={e => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" className="wk-input mt-1.5 w-full px-3 py-2.5 text-base" />
      <label className="mt-3.5 flex items-start gap-2.5 text-sm text-[#24324d]"><input type="checkbox" checked={updates} onChange={e => setUpdates(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#3F7FD6]" />Send me WhatYouAte news, new games and food tips</label>
      {err && <p className="mt-3 text-sm font-semibold text-[#d64545]">{err}</p>}
      <button disabled={busy} onClick={submit} className="wk-btn wk-blue mt-4 h-[50px] w-full shrink-0 text-[19px]">{busy ? "Adding You..." : "Add Me To The Board"}</button>
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
  const podium = ["bg-[#fff4cc] shadow-[inset_0_0_0_1.5px_#f4d46a]", "bg-[#eef2f8] shadow-[inset_0_0_0_1.5px_#cdd7e5]", "bg-[#fdeadb] shadow-[inset_0_0_0_1.5px_#efc29d]"];
  return (
    <div className="wk-backdrop wk-raise absolute inset-0 z-30 flex items-center justify-center p-4" onClick={onClose}>
      <div className="wk-panel wk-pop flex max-h-full w-full max-w-[400px] flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="wk-plate relative flex shrink-0 items-center justify-center gap-2 px-12 py-2.5 text-[23px] leading-tight">
          <TrophyIcon size={28} />Scoreboard
          <button onClick={onClose} aria-label="Close" className="wk-round absolute right-2.5 top-1/2 h-[32px] w-[32px] -translate-y-1/2"><CloseIcon size={13} /></button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
          <div className="wk-seg h-[36px] shrink-0 text-[14.5px]">
            {tabs.map(([k, label]) => (<button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className="flex-1 basis-0">{label}</button>))}
          </div>
          <p className="mt-2 text-center text-[11px] leading-snug text-[#5a6b85]">{tab === "today" ? todayNote : tab === "week" ? "Best Free Play scores since Monday." : "Best Free Play scores ever."}</p>
          <div className="-mx-1 mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto px-1 py-0.5">
            {rows === null ? <p className="wk-f py-8 text-center text-[16px] text-[#8a9ab3]">Loading...</p>
              : rows.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <TrophyIcon size={40} className="opacity-90" />
                  <p className="wk-f mt-2 text-[17px] text-[#101B2E]">No scores yet. Be the first!</p>
                </div>
              )
              : rows.map(r => {
                const me = mine?.rank === r.rank, top = r.rank <= 3;
                return (
                  <div key={r.rank} className={`flex h-[44px] items-center gap-2.5 rounded-2xl px-2 ${me ? "bg-[#d9e8ff] shadow-[inset_0_0_0_2px_#3F7FD6]" : top ? podium[r.rank - 1] : r.rank % 2 ? "bg-white/70" : ""}`}>
                    <span className="flex w-[30px] shrink-0 justify-center">
                      {top ? <MedalIcon rank={r.rank as 1 | 2 | 3} size={30} />
                        : <span className="wk-f flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-[#e3ebf8] px-1 text-[14px] leading-none tabular-nums text-[#5a6b85]">{r.rank}</span>}
                    </span>
                    <span className={`wk-f min-w-0 flex-1 truncate leading-tight ${top ? "text-[17px]" : "text-[16px]"} ${me ? "text-[#1f4fa8]" : "text-[#101B2E]"}`}>{r.name}</span>
                    <span className={`wk-f shrink-0 tabular-nums leading-none ${top ? "text-[19px]" : "text-[17px]"} ${me ? "text-[#1f4fa8]" : "text-[#101B2E]"}`}>{r.score.toLocaleString()}</span>
                  </div>);
              })}
          </div>
          <div className="mt-3 shrink-0 text-center">
            {token ? (mine?.rank
              ? <div className="wk-hud flex h-[42px] items-center justify-center gap-1.5 px-3 text-[14px]"><span className="text-[#5A6B85]">You&apos;re</span><span className="wk-f text-[19px] leading-none">#{mine.rank}</span><span className="text-[#5A6B85]">of {mine.total} with</span><span className="wk-f text-[19px] leading-none tabular-nums">{mine.score?.toLocaleString()}</span></div>
              : <p className="text-sm text-[#5a6b85]">Play a round to get on this board.</p>)
              : <button onClick={onJoin} className="wk-btn wk-blue h-[46px] w-full text-[18px]">Join The Scoreboard</button>}
          </div>
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
  // Links in the message get ?via=share so visits from them count as shares (components/track.ts). Every tap on Share is counted.
  const share = async (text: string) => { track("share"); if (await shareText(tagShareText(text))) { setCopied(true); setTimeout(() => setCopied(false), 2000); } };
  // the pause button, plus an automatic pause when you switch apps or lock the phone mid-run (see PauseButton). Only while
  // a Pause button is showing: a game without one (Snack Merge, Food Fling) has no Paused card to get out of.
  const [held, setHeld] = useState(false);
  const pausers = useRef(0);   // Pause buttons showing right now, each during a run
  const countPause = useCallback((d: number) => { pausers.current += d; }, []);
  useEffect(() => { const f = () => { if (document.hidden && pausers.current > 0) setHeld(true); }; document.addEventListener("visibilitychange", f); return () => document.removeEventListener("visibilitychange", f); }, []);
  const prize = usePrize();
  const paused = help.open || joinOpen || boardOpen || held || prize.step !== null;
  const popup = help.open || joinOpen || boardOpen || prize.step !== null;   // the pause itself is the PauseButton's (it knows when a run is going)
  useEffect(() => { sfx.hold("popup", popup); }, [popup]);
  useEffect(() => () => sfx.hold("popup", false), []);
  return { game, player, savePlayer, scores, help, joinOpen, setJoinOpen, boardOpen, setBoardOpen, copied, share, finishRef, paused, held, setHeld, countPause, prize };
}
export type Shell = ReturnType<typeof useGameShell>;

/** A small pause button for real-time games (put it in the score row). `active` = a run is going. */
export function PauseButton({ shell, active }: { shell: Shell; active: boolean }) {
  const { held, setHeld, countPause } = shell;
  useEffect(() => { if (!active && held) setHeld(false); }, [active, held, setHeld]);   // nothing to pause between runs
  useEffect(() => { if (!active) return; countPause(1); return () => countPause(-1); }, [active, countPause]);   // lets switching apps pause the run
  const id = useId();
  useEffect(() => { sfx.hold(`pause${id}`, active && held); return () => sfx.hold(`pause${id}`, false); }, [id, active, held]);   // quiet while paused
  return (
    <button onClick={() => setHeld(true)} aria-label="Pause" disabled={!active}
      className={`wk-round h-[34px] w-[34px] shrink-0 ${active ? "" : "pointer-events-none opacity-0"}`}>
      <PauseIcon size={14} />
    </button>
  );
}

/** Is sound on? The one setting every game shares (./sfx), kept in step across games and tabs. */
export function useSoundOn() { return useSyncExternalStore(sfx.subscribe, sfx.getOn, () => true); }

/** The speaker button: the same white round button in every game, always the last thing at the right of the score row.
 *  Sound is on until the player turns it off, and off in one game is off in all of them. */
export function SoundButton({ className = "" }: { className?: string }) {
  const on = useSoundOn();
  return (
    <button onClick={() => sfx.setOn(!on)} aria-label="Sound" aria-pressed={on} data-sound={on ? "on" : "off"}
      className={`wk-round h-[34px] w-[34px] shrink-0 ${className}`}>
      <SoundIcon on={on} size={19} />
    </button>
  );
}

// ── ways to play (games with a computer, a same-phone and a live mode) ─────
// The start card offers the three (PlayChoices); the slim ModeRow under the header says which one you're in, with Change
// to go back to the start card (LeaveCard asks first mid-game); end cards get a quiet ChangeModeLink. Kitchen Golf's
// start card is the model.

/** The row under the header: the way you're playing, a small Change button, and the SoundButton in its standard spot. */
export function ModeRow({ label, onChange }: { label: string; onChange?: () => void }) {
  return (
    <div className="mt-2 flex h-[40px] shrink-0 items-center gap-1.5" data-mode-row>
      <div className="flex min-w-0 flex-1 items-center gap-2 pl-1">
        <span className="wk-f min-w-0 truncate text-[16px] leading-none text-[#101B2E] [text-shadow:0_1px_0_rgba(255,255,255,0.9)]">{label}</span>
        {onChange && <button onClick={onChange} className="wk-tag wk-tag-light flex h-[26px] shrink-0 items-center px-3 text-[13.5px] leading-none">Change</button>}
      </div>
      <SoundButton />
    </div>
  );
}

/** The ways to play on a start card: a big Play The Computer (left out when `onCpu` is), then Play A Friend and Same Phone. */
export function PlayChoices({ onCpu, onFriend, onPhone }: { onCpu?: () => void; onFriend: () => void; onPhone: () => void }) {
  return (
    <>
      {onCpu && <button onClick={onCpu} className="wk-btn wk-go wk-pulse mt-4 h-[54px] w-full text-[22px]"><PlayIcon size={19} />Play The Computer</button>}
      <div className={`${onCpu ? "mt-2.5" : "mt-3"} flex gap-2.5`}>
        <button onClick={onFriend} className="wk-btn wk-light h-[46px] flex-1 text-[16px]">Play A Friend</button>
        <button onClick={onPhone} className="wk-btn wk-light h-[46px] flex-1 text-[16px]">Same Phone</button>
      </div>
    </>
  );
}

/** Asked before Change drops a game in progress (put it inside BoardArea). `live` says the friend will be told. */
export function LeaveCard({ live = false, onLeave, onStay }: { live?: boolean; onLeave: () => void; onStay: () => void }) {
  return (
    <OverlayCard title="Leave This Game?" max="max-w-[300px]" z="z-30">
      <p className="text-[14px] leading-snug text-[#5a6b85]">{live ? "You'll leave the room, and your friend will see you've gone." : "This game ends here, and it won't count."}</p>
      <div className="mt-4 flex gap-2.5">
        <button onClick={onLeave} className="wk-btn wk-light h-[48px] flex-1 text-[17px]">Leave</button>
        <button onClick={onStay} className="wk-btn wk-blue h-[48px] flex-1 text-[17px]">Keep Playing</button>
      </div>
    </OverlayCard>
  );
}

/** A quiet link for game-over and rematch cards, back to the start card's choices. */
export function ChangeModeLink({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return <button onClick={onClick} className={`wk-link w-full py-1.5 text-[14px] ${className}`}>Change Game Mode</button>;
}

/** Live matches: the "Get Ready" card both players see before the first game (put it inside BoardArea). A short how-to,
 *  both names with a tick once they're ready, and a big I'm Ready button. `ready` is [you, your friend]. */
export function ReadyCard({ steps, me, friend, ready, onReady, onLeave, title = "Get Ready" }: {
  steps: ReactNode[]; me: string; friend: string; ready: [boolean, boolean]; onReady: () => void; onLeave: () => void; title?: string;
}) {
  const seat = (name: ReactNode, ok: boolean, color: string, waiting?: boolean) => (
    <div className="flex h-[36px] items-center gap-2.5 rounded-xl bg-white px-2.5 shadow-[0_0_0_1px_#E3EDFB]">
      <span className="h-3.5 w-3.5 shrink-0 rounded-full shadow-[inset_0_-2px_0_rgba(0,0,0,0.18)]" style={{ background: color }} />
      <span className={`wk-f min-w-0 flex-1 truncate text-left text-[16px] leading-tight ${waiting ? "text-[#8a9ab3]" : "text-[#101B2E]"}`}>{name}</span>
      {ok ? <span className="wk-tag wk-tag-light flex shrink-0 items-center gap-1 py-[3px] pl-1.5 pr-2.5 text-[13px] leading-none"><CheckIcon size={12} />Ready</span>
        : waiting ? <span className="flex shrink-0 gap-1 pr-1">{[0, 1, 2].map(k => <span key={k} className="wk-dot h-1.5 w-1.5 rounded-full bg-[#6FA8FF]" style={{ animationDelay: `${k * 0.2}s` }} />)}</span> : null}
    </div>
  );
  return (
    <OverlayCard title={title} max="max-w-[330px]" className="pb-3!">
      <ol className="space-y-1.5 text-left text-[13.5px] leading-snug text-[#24324d]">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5"><span className="wk-step flex h-[21px] w-[21px] shrink-0 items-center justify-center text-[12.5px]">{i + 1}</span><span>{s}</span></li>
        ))}
      </ol>
      <div className="mt-3 space-y-1.5 rounded-2xl bg-[#EAF2FF] p-1.5">
        {seat(me, ready[0], "#6FA8FF")}
        {seat(ready[1] ? friend : `Waiting For ${friend}...`, ready[1], "#FF7A93", !ready[1])}
      </div>
      <button onClick={onReady} disabled={ready[0]} className={`wk-btn ${ready[0] ? "wk-light" : "wk-go"} mt-3.5 h-[52px] w-full text-[22px] disabled:opacity-100 disabled:[filter:none]`}>
        {ready[0] ? <><CheckIcon size={20} />You&apos;re Ready</> : "I'm Ready"}
      </button>
      <button onClick={onLeave} className="wk-link mt-1.5 w-full py-1.5 text-[15px]">Leave</button>
    </OverlayCard>
  );
}

/** The "Paused" card over the board (put it inside BoardArea). */
export function PausedCard({ shell, active }: { shell: Shell; active: boolean }) {
  if (!active || !shell.held) return null;
  return (
    <OverlayCard title="Paused" max="max-w-[270px]">
      <div className="flex justify-center">
        <span className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[#e3edfc] text-[#101B2E] shadow-[inset_0_-3px_0_#c5d6f1]"><PauseIcon size={26} /></span>
      </div>
      <button onClick={() => shell.setHeld(false)} className="wk-btn wk-go mt-4 h-[52px] w-full text-[21px]"><PlayIcon size={18} />Resume</button>
    </OverlayCard>
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
// The prize isn't installed yet (supabase/games_prize.sql). Until it is, game pages don't ask the database about it at
// all; flip this to true at launch (after the SQL is run and codes are loaded).
const PRIZE_LIVE = false;
type PrizeStep = "caught" | "claiming" | "won" | "gone" | "tried" | "error";
function usePrize() {
  const [armed, setArmed] = useState(false);          // the logo may show this session
  const [step, setStep] = useState<PrizeStep | null>(null);
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    if (!PRIZE_LIVE) return;
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
        background: "radial-gradient(circle at 40% 32%, #fff3c4 0%, #FFE65C 38%, #FFB618 78%, #d99a17 100%)",
        boxShadow: "0 0 0 3px #ffffff, 0 0 0 5.5px #B86E00, 0 5px 0 4px #8a5200, 0 0 30px 10px rgba(255,214,60,0.75)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-512.png" alt="" className="h-[48px] w-[48px] rounded-[12px] shadow-[0_2px_0_rgba(138,82,0,0.5)]" />
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
  const title = step === "caught" ? "You Caught Today's Logo!" : step === "claiming" ? "One Moment" : step === "won" ? "Your Free Month"
    : step === "gone" ? "Today's Prizes Are Gone" : step === "tried" ? "You've Had Today's Chance" : "Something Went Wrong";
  return (
    <Modal onClose={step === "claiming" ? () => {} : close} z="z-30" title={title}>
      <div className="flex justify-center">
        <span className="flex h-[64px] w-[64px] items-center justify-center rounded-full"
          style={{ background: "radial-gradient(circle at 40% 32%, #fff3c4 0%, #FFE65C 40%, #FFB618 85%)", boxShadow: "0 0 0 3px #B86E00, 0 4px 0 3px #8a5200" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-512.png" alt="" className="h-[42px] w-[42px] rounded-[10px]" />
        </span>
      </div>
      {step === "caught" && (<>
        <p className="mt-3 text-center text-sm text-[#5a6b85]">Claim a free month of WhatYouAte Pro on iPhone.</p>
        {!player ? (<>
          <p className="mt-4 text-center text-sm">First, join the scoreboard so we know who won.</p>
          <button onClick={() => setJoinOpen(true)} className="wk-btn wk-blue mt-3 h-[50px] w-full text-[19px]">Join To Claim</button>
        </>) : (<>
          <label className="mt-4 block text-center text-sm">One quick question to claim it: what&apos;s <b>{q.text}</b>?</label>
          <input value={answer} onChange={e => { setAnswer(e.target.value); setWrong(false); }} inputMode="numeric" autoFocus
            className="wk-input wk-f mx-auto mt-2 block w-28 px-3 py-2 text-center text-[22px]" />
          {wrong && <p className="mt-2 text-center text-sm font-semibold text-[#d64545]">Not quite. Try again.</p>}
          <button onClick={claim} className="wk-btn wk-go mt-4 h-[52px] w-full text-[20px]">Claim My Free Month</button>
        </>)}
        <p className="mt-3 text-center text-[11px] text-[#5a6b85]">One prize per person, 3 a day. <a href="/games/prize-rules" target="_blank" className="underline">Rules</a></p>
      </>)}
      {step === "claiming" && <p className="wk-f mt-3 text-center text-[16px] text-[#5a6b85]">Checking...</p>}
      {step === "won" && prize.code && (<>
        <p className="mt-3 text-center text-sm text-[#5a6b85]">30 days of WhatYouAte Pro. Save this code: it works once.</p>
        <div className="mt-4 rounded-2xl bg-[#eaf1fd] px-3 py-3 text-center font-mono text-lg font-bold tracking-wider shadow-[inset_0_0_0_2px_#c9d8f2]">{prize.code}</div>
        <button onClick={async () => { try { await navigator.clipboard.writeText(prize.code!); setCopied(true); } catch {} }} className="wk-btn wk-light mt-3 h-[44px] w-full text-[17px]">{copied ? "Copied!" : "Copy Code"}</button>
        <a href={`https://apps.apple.com/redeem?ctx=offercodes&id=${APP_STORE_ID}&code=${encodeURIComponent(prize.code)}`} className="wk-btn wk-navy mt-3 h-[48px] w-full text-[17px]">Redeem In The App Store</a>
        <button onClick={close} className="wk-link mt-2 w-full py-2 text-[15px]">Back To The Game</button>
      </>)}
      {(step === "gone" || step === "tried" || step === "error") && (<>
        <p className="mt-3 text-center text-sm text-[#5a6b85]">{step === "gone" ? "Nice catch, but all 3 of today's prizes were claimed. The logo's back tomorrow." : step === "tried" ? "One try a day. The logo's back tomorrow." : "We couldn't check your prize. Try again in a moment."}</p>
        <button onClick={close} className="wk-btn wk-blue mt-4 h-[50px] w-full text-[19px]">Back To The Game</button>
      </>)}
    </Modal>
  );
}
