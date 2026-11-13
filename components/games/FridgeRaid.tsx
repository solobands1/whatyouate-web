"use client";

// Fridge Raid: hide five snacks in your fridge, then take turns guessing where the other side's snacks are. A bite shows
// a piece of what you bit and earns another shot; ice means nothing's there and the turn passes. Find every cell of a
// snack and it pops out whole. Once a round each side can use the Fridge Light (shows a 2x2 patch without biting) and
// the Freezer Blast (bites 3 shelves in a row or column). First to find all of the other side's snacks wins.
// A 7x7 fridge, so a game is about half as long as the old 8x8 one. Three ways to play:
//  - Computer: Today (everyone raids the same computer fridge, and the computer's moves follow the same seeded order) or
//    Free Play (round after round, the computer a little sharper each time, score adds up until you lose). The computer
//    hunts like a person would and uses its power-ups sensibly but not perfectly. It only ever uses what it has seen.
//  - Same Phone: two names, pass the phone between turns behind a "no peeking" card. No scoreboard.
//  - Play A Friend: a 4-letter room over Supabase Realtime (channel "fridge-raid:ABCD", presence for who's in).
//    Each phone keeps its own fridge private: the shooter sends a move (shot, light or blast, and where), the defender
//    answers each shelf it covers (bite or ice, and which snack). Layouts never leave the phone.
//    Before the first game both see a Get Ready card; "I'm Ready" goes out at once (a "meta" message) and stays in presence,
//    and the host starts only when both are ready. Rematches skip the card.
// Every shelf a move checks counts as one shot, for the score and for the scoreboard's limits.
// The computer's balance and the Today seed were checked with a headless sim of the rules block below.
/* eslint-disable react-hooks/refs, react-hooks/purity, react-hooks/immutability, react-hooks/set-state-in-effect --
   Turn-based, so the match lives in one mutable object (g.current) that handlers, timers and Realtime callbacks all
   update, then bump() re-renders. The canvas games do the same inside their effect closures, out of the linter's sight. */
import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sb } from "@/components/creators/api";
import { type Mode, type Toast, GameScreen, GameHeader, BoardArea, PrizeLogo, GameOver, PauseButton, PausedCard, ReadyCard, HelpModal, ModesHelp, ShellPopups,
  useGameShell, dailySeed, dailyNumber, torontoDate, mulberry32, readBest, saveBest, foodPng, emoji } from "./kit";
import { GAME_FONT_CSS } from "./gameFont";

const GAME = "fridge-raid";
const LAUNCH = "2026-11-08";                 // Today's Challenge #1
const LAYOUT_SALT = 0x6f1d9, AI_SALT = 0x2b7e3;

// ── rules (pure: no React, no DOM; the headless balance check runs this block as-is) ──── RULES START
const N = 7;
type Snack = { name: string; code: string; len: number; color: string; facts: string[] };
const SNACKS: Snack[] = [
  { name: "Baguette", code: "1f956", len: 3, color: "#f6e0b8", facts: [
    "Bread goes stale faster in the fridge than on the counter. The freezer is the place to keep it.",
    "A traditional French baguette is made with just flour, water, salt and yeast.",
    "In 2022, UNESCO added the craft of French baguette baking to its list of cultural heritage."] },
  { name: "Carrot", code: "1f955", len: 3, color: "#ffdcc2", facts: [
    "Cooking carrots makes their beta-carotene easier for your body to absorb.",
    "Early carrots were purple or yellow. Orange carrots caught on in Europe in the 1600s.",
    "Cut the green tops off before you store carrots. The leaves pull moisture out of the roots."] },
  { name: "Cucumber", code: "1f952", len: 2, color: "#d6f1c9", facts: [
    "Cucumbers are about 95% water.",
    "Botanically, a cucumber is a fruit. It's in the same family as melons and squash.",
    "Cucumbers can get soft, watery spots if they're kept too cold for too long. Eat them within a few days."] },
  { name: "Banana", code: "1f34c", len: 2, color: "#fff2b3", facts: [
    "A ripe banana's peel turns brown in the fridge, but the fruit inside stays fresh for days longer.",
    "A medium banana has about 3 grams of fibre.",
    "Botanically, bananas are berries. Strawberries aren't."] },
  { name: "Cheese", code: "1f9c0", len: 2, color: "#ffe7a6", facts: [
    "Aged hard cheeses like cheddar and parmesan have very little lactose.",
    "Wrap cheese in wax or parchment paper in the fridge. Plastic wrap traps moisture.",
    "Cheese tastes stronger at room temperature. Take it out of the fridge about 30 minutes before eating."] },
];
const CELLS = SNACKS.reduce((a, s) => a + s.len, 0);   // 12 snack cells in a 7x7 fridge
type Placed = { s: number; r: number; c: number; v: boolean };   // snack index, top-left cell, vertical?
// What a fridge's owner has given away so far, per cell: 0 nothing, 1 ice (a miss, or lit and empty), 2 bitten, 3 lit (a snack is here, not bitten yet)
type Kind = "shot" | "light" | "blast";
type Cell = { i: number; hit: boolean; s: number; sunk: Placed | null };   // s: which snack is in that cell (-1: none)
type Answer = { kind: Kind; cells: Cell[]; over: boolean };

const cellsOf = (p: Placed) => Array.from({ length: SNACKS[p.s].len }, (_, k) => (p.v ? (p.r + k) * N + p.c : p.r * N + p.c + k));
function inBounds(p: Placed) {
  const L = SNACKS[p.s].len;
  return p.r >= 0 && p.c >= 0 && (p.v ? p.r + L <= N && p.c < N : p.c + L <= N && p.r < N);
}
/** Can snack p go here, given the others? noTouch also keeps snacks from sitting side by side (auto-placing only). */
function fits(layout: Placed[], p: Placed, noTouch = false) {
  if (!inBounds(p)) return false;
  const taken = new Set<number>();
  for (const q of layout) if (q.s !== p.s) for (const k of cellsOf(q)) {
    taken.add(k);
    if (noTouch) { const r = Math.floor(k / N), c = k % N; if (r > 0) taken.add(k - N); if (r < N - 1) taken.add(k + N); if (c > 0) taken.add(k - 1); if (c < N - 1) taken.add(k + 1); }
  }
  return cellsOf(p).every(k => !taken.has(k));
}
/** A random fridge. Same rnd seed, same fridge (Today). */
function autoPlace(rnd: () => number): Placed[] {
  for (let tries = 0; tries < 300; tries++) {
    const out: Placed[] = [];
    for (let s = 0; s < SNACKS.length; s++) {
      const L = SNACKS[s].len;
      for (let k = 0; k < 120; k++) {
        const v = rnd() < 0.5, p = { s, v, r: Math.floor(rnd() * (v ? N - L + 1 : N)), c: Math.floor(rnd() * (v ? N : N - L + 1)) };
        if (fits(out, p, tries < 250)) { out.push(p); break; }
      }
      if (out.length !== s + 1) break;
    }
    if (out.length === SNACKS.length) return out;
  }
  return SNACKS.map((_, s) => ({ s, r: s, c: 0, v: false }));
}
/** The cells a move covers. Fridge Light: the 2x2 patch from that shelf (kept inside the fridge). Freezer Blast: 3 in a row
 *  or column centred on it (kept inside). */
function lightCells(i: number) {
  const r = Math.min(N - 2, Math.floor(i / N)), c = Math.min(N - 2, i % N);
  return [r * N + c, r * N + c + 1, (r + 1) * N + c, (r + 1) * N + c + 1];
}
function blastCells(i: number, vertical: boolean) {
  const r = Math.floor(i / N), c = i % N;
  if (vertical) { const r0 = Math.max(0, Math.min(N - 3, r - 1)); return [r0 * N + c, (r0 + 1) * N + c, (r0 + 2) * N + c]; }
  const c0 = Math.max(0, Math.min(N - 3, c - 1)); return [r * N + c0, r * N + c0 + 1, r * N + c0 + 2];
}
const coverOf = (kind: Kind, i: number, vertical: boolean) => (kind === "light" ? lightCells(i) : kind === "blast" ? blastCells(i, vertical) : [i]);
/** The cells of a move that would tell something new (a lit snack can still be bitten; the light skips anything known). */
const freshCells = (inc: Int8Array, kind: Kind, cells: number[]) => cells.filter(i => (kind === "light" ? inc[i] === 0 : inc[i] === 0 || inc[i] === 3));
/** The defender's side of a move: marks it on their own fridge and says what each new cell held. Layouts never leave the phone. */
function answerMove(layout: Placed[], inc: Int8Array, kind: Kind, cells: number[]): Answer {
  const out: Cell[] = [];
  for (const i of freshCells(inc, kind, cells)) {
    const p = layout.find(q => cellsOf(q).includes(i)) ?? null;
    if (kind === "light") { inc[i] = p ? 3 : 1; out.push({ i, hit: !!p, s: p ? p.s : -1, sunk: null }); continue; }
    inc[i] = p ? 2 : 1;
    out.push({ i, hit: !!p, s: p ? p.s : -1, sunk: p && cellsOf(p).every(k => inc[k] === 2) ? p : null });
  }
  return { kind, cells: out, over: kind !== "light" && layout.every(q => cellsOf(q).every(k => inc[k] === 2)) };
}
/** The computer's next single shot, from what it can see: its shots so far (inc) and the snacks it has found. Never peeks.
 *  skill 0..1: how often it follows a line it has started and hunts on a checkerboard, rather than slipping. */
function aiPick(inc: Int8Array, found: Placed[], rnd: () => number, skill: number): number {
  const done = new Set(found.flatMap(cellsOf));
  const open = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N && (inc[r * N + c] === 0 || inc[r * N + c] === 3);
  const live = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N && inc[r * N + c] === 2 && !done.has(r * N + c);
  const lit: number[] = []; for (let i = 0; i < N * N; i++) if (inc[i] === 3) lit.push(i);
  if (lit.length && rnd() < 0.55 + 0.45 * skill) return lit[Math.floor(rnd() * lit.length)];   // a snack it already spotted
  const active: number[] = [];
  for (let i = 0; i < N * N; i++) if (inc[i] === 2 && !done.has(i)) active.push(i);
  if (active.length) {
    const ends: number[] = [], next: number[] = [];
    for (const a of active) {
      const r = Math.floor(a / N), c = a % N;
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        if (!live(r + dr, c + dc) && !live(r - dr, c - dc)) continue;     // a line of two or more hits: try its ends
        let k = 1; while (live(r + dr * k, c + dc * k)) k++; if (open(r + dr * k, c + dc * k)) ends.push((r + dr * k) * N + c + dc * k);
        k = 1; while (live(r - dr * k, c - dc * k)) k++; if (open(r - dr * k, c - dc * k)) ends.push((r - dr * k) * N + c - dc * k);
      }
      for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) if (open(r + dr, c + dc)) next.push((r + dr) * N + c + dc);
    }
    const slip = rnd() > skill;                                          // sometimes it forgets the line and pokes around
    const pool = ends.length && !(slip && next.length) ? ends : next;
    if (pool.length) return pool[Math.floor(rnd() * pool.length)];
  }
  const left = SNACKS.map((s, i) => (found.some(f => f.s === i) ? 99 : s.len)), shortest = Math.min(...left);
  const room = (i: number) => {                                          // could the shortest snack left fit through here?
    const r = Math.floor(i / N), c = i % N; let h = 1, v = 1;
    for (let k = 1; open(r, c - k); k++) h++; for (let k = 1; open(r, c + k); k++) h++;
    for (let k = 1; open(r - k, c); k++) v++; for (let k = 1; open(r + k, c); k++) v++;
    return h >= shortest || v >= shortest;
  };
  const all: number[] = []; for (let i = 0; i < N * N; i++) if (inc[i] === 0) all.push(i);
  const sensible = rnd() < 0.5 + skill / 2 ? all.filter(room) : all;
  const checker = rnd() < skill ? sensible.filter(i => (Math.floor(i / N) + (i % N)) % 2 === 0) : sensible;
  const pool = checker.length ? checker : sensible.length ? sensible : all;
  return pool[Math.floor(rnd() * pool.length)];
}
type Move = { kind: Kind; at: number; v: boolean };                       // the shelf tapped (and the blast's direction)
/** The computer's whole move: sometimes a power-up (each once a round), otherwise a shot. Blast along a line it has
 *  started; light up the emptiest-looking corner while it's still hunting. Imperfect on purpose, like the shots. */
function aiMove(inc: Int8Array, found: Placed[], rnd: () => number, skill: number, used: { light: boolean; blast: boolean }, turnNo: number): Move {
  const done = new Set(found.flatMap(cellsOf));
  const liveAt = (i: number) => inc[i] === 2 && !done.has(i);
  const roll = rnd(), roll2 = rnd();
  if (!used.blast && roll < 0.35 + 0.6 * skill) {
    let best: Move | null = null, bestN = 1;
    for (let i = 0; i < N * N; i++) if (liveAt(i)) {
      const r = Math.floor(i / N), c = i % N;
      for (const v of [false, true]) {
        const step = v ? N : 1, along = (k: number) => (v ? k >= 0 && k < N * N : Math.floor(k / N) === r);
        if (!((along(i - step) && liveAt(i - step)) || (along(i + step) && liveAt(i + step)))) continue;   // only along a line of two hits
        for (let o = -3; o <= 3; o++) {                                // every 3-shelf stretch of that line near the hits
          const j = i + o * step; if (!along(j) || (v ? j % N !== c : false)) continue;
          const cov = blastCells(j, v), fresh = freshCells(inc, "blast", cov);
          if (!fresh.some(k => (along(k - step) && liveAt(k - step)) || (along(k + step) && liveAt(k + step)))) continue;   // must carry the line on
          if (fresh.length > bestN || (fresh.length === bestN && rnd() < 0.5)) { bestN = fresh.length; best = { kind: "blast", at: j, v }; }
        }
      }
    }
    if (best && bestN >= 2) return best;
  }
  const hunting = !Array.from({ length: N * N }, (_, i) => i).some(liveAt);
  if (!used.light && hunting && turnNo >= 1 && roll2 < 0.25 + 0.35 * skill) {
    let best = 0, picks: number[] = [];
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) {
      const i = r * N + c, n = freshCells(inc, "light", lightCells(i)).length;
      if (n > best) { best = n; picks = [i]; } else if (n === best) picks.push(i);
    }
    if (best >= 3) return { kind: "light", at: picks[Math.floor(rnd() * picks.length)], v: false };
  }
  return { kind: "shot", at: aiPick(inc, found, rnd, skill), v: false };
}
// Scoring (vs computer): every shelf a move checks counts as one shot. A bite is 15, plus 10 for each bite in a row before
// it (up to 55); finding a snack adds 40 plus 10 a cell; a win adds 400, 35 for every shot under 49, and 15 for each of
// your snack cells the computer never bit. The light earns nothing itself; it makes the next shots count.
// A shot that bites earns another shot; a miss, or either power-up, hands the turn over.
const hitPoints = (streak: number) => 15 + 10 * Math.min(4, streak - 1);
const foundPoints = (s: number) => 40 + 10 * SNACKS[s].len;
const winBonus = (shots: number, mine: Placed[], inc: Int8Array) => 400 + 35 * Math.max(0, N * N - shots) + 15 * mine.flatMap(cellsOf).filter(k => inc[k] !== 2).length;
const SKILL_TODAY = 0.6, SKILL_FREE = 0.5, SKILL_STEP = 0.1;   // Free Play: round 1 is gentle, then sharper each round
// ───────────────────────────────────────────────────────────────────────────────────────── RULES END

type Opp = "cpu" | "phone" | "live";
type Side = 0 | 1;
type Phase = "idle" | "gate" | "names" | "pass" | "place" | "play" | "roundWon" | "over" | "doneToday";   // gate: the live Get Ready card
type Used = { light: boolean; blast: boolean };
type Fx = { id: number; side: Side; kind: Kind; cells: Cell[] };   // the newest move on a fridge, for its little animations
type Game = {
  layout: [Placed[], Placed[] | null];       // [me or player 1, the other side]; null = a friend's phone keeps it
  inc: [Int8Array, Int8Array];               // what each fridge has given away (see the rules: 0, 1 ice, 2 bitten, 3 lit)
  seen: [Int8Array, Int8Array];              // which snack sits in each given-away snack shelf (-1 unknown), to draw the bite
  found: [Placed[], Placed[]];               // snacks found on each side
  used: [Used, Used];                        // power-ups each side has used this round
  shots: [number, number]; hits: [number, number]; streak: [number, number]; bestStreak: [number, number];
  log: [string[], string[]];                 // each side's moves as share squares
  turn: Side; turnNo: number; turnAt: number; // turnNo counts moves (a bite's extra shot is a new move)
  fx: Fx | null; lastFound: number | null; roundScore: number;
};
const newGame = (a: Placed[], b: Placed[] | null): Game => ({
  layout: [a, b], inc: [new Int8Array(N * N), new Int8Array(N * N)], seen: [new Int8Array(N * N).fill(-1), new Int8Array(N * N).fill(-1)],
  found: [[], []], used: [{ light: false, blast: false }, { light: false, blast: false }],
  shots: [0, 0], hits: [0, 0], streak: [0, 0], bestStreak: [0, 0], log: [[], []],
  turn: 0, turnNo: 0, turnAt: 0, fx: null, lastFound: null, roundScore: 0,
});
type Final = { score: number; won: boolean; shots: number; hits: number; streak: number; rounds: number; log: string[] };

// live play
const CODE_LETTERS = "BCDFGHJKMNPQRSTVWXZ";   // no vowels (no accidental words), no I, L or O
const TURN_MS = 45000, GRACE_MS = 5000, RESEND_MS = 3000;
const LOCK_MS = 700;                          // a beat after each move so you see what happened (also keeps the scoreboard's speed check honest)
type Meta = { id: string; name: string; at: number; round: number; ready: boolean; seq: number;   // seq: newer wins; ready: snacks hidden
  ok: boolean; stage: "gate" | "game" };   // ok: tapped I'm Ready on the Get Ready card; stage: the host has started the first game
type Room = { status: "idle" | "connecting" | "waiting" | "paired" | "away" | "full" | "error"; code?: string; opp?: Meta | null; host?: boolean; until?: number };   // away: the friend stepped out (60s grace)
// What this phone saves to pick a live match back up after a reload or a dropped connection. Its own layout stays on the
// phone; the shared part (the shot grids and turn) can also come from the friend's snapshot, whichever is newer.
type Snap = { p: number; from: string; round: number; ph: number; turnOwner: string; turnNo: number; inc: string[]; seen: number[][]; found: Placed[][]; used: Used[];
  shots: number[]; hits: number[]; streak: number[]; bestStreak: number[]; log: string[][]; lastFound: number | null };
type SavedLive = { code: string; id: string; at: number; friendId: string; round: number; layout: Placed[]; ready: boolean; snap: Snap; t: number };
const LIVE_KEY = "fridge-raid-live", AWAY_MS = 60000;
function readLive(code?: string): SavedLive | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(LIVE_KEY) ?? localStorage.getItem(LIVE_KEY) ?? "null") as SavedLive | null;
    return v && (!code || v.code === code) && Date.now() - v.t < 3 * 3600 * 1000 ? v : null;
  } catch { return null; }
}
type Msg =
  | { t: "move"; round: number; turn: number; kind: Kind; at: number; v: boolean }
  | { t: "answer"; round: number; turn: number; kind: Kind; cells: Cell[]; over: boolean }
  | { t: "skip"; round: number; turn: number }
  | { t: "meta"; round: number; meta: Meta }
  | { t: "resume"; round: number; snap: Snap }   // back from a break: here is what I have
  | { t: "state"; round: number; snap: Snap }    // and here is what I have (each keeps the newer)
  | { t: "bye"; round: number };                 // tapped Leave: gone for good   // the same seat info as presence, sent straight away (presence can lag a few seconds)
const newCode = () => Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join("");
const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
const validCode = (s: string) => s.length === 4 && [...s].every(ch => CODE_LETTERS.includes(ch));
function storedName() {   // the kit's player record, read straight away so a link-join has the name on the first render
  try { const v = localStorage.getItem("wya-games-player") ?? localStorage.getItem("snackmerge-player"); return v ? (JSON.parse(v).name as string) || "Guest" : "Guest"; } catch { return "Guest"; }
}
const SQUARE = { hit: "🟧", miss: "⬜", light: "💡" };
const lines = (log: string[]) => { const out: string[] = []; for (let i = 0; i < log.length; i += 10) out.push(log.slice(i, i + 10).join("")); return out.join("\n"); };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const POWER = { light: { name: "Fridge Light", tip: "Peek At 4 Shelves", use: "Shine Here" }, blast: { name: "Freezer Blast", tip: "Hit 3 In A Row", use: "Blast Here" } };
// each fridge has its own colour, so it's always clear whose is whose: yours blue, theirs red
const MINE = { hi: "#78b2ff", lo: "#3f7fd6", lip: "#2a5ba8" }, THEIRS = { hi: "#ff8d84", lo: "#e8505b", lip: "#b33a44" };

export default function FridgeRaid() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [mode, setMode] = useState<Mode>("daily");
  const [opp, setOpp] = useState<Opp>("cpu");
  const [run, setRun] = useState(0);
  const [phase, setPhaseState] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const go = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const g = useRef<Game>(newGame(autoPlace(Math.random), autoPlace(Math.random)));
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [msg, setMsg] = useState("");
  const [round, setRound] = useState(1);
  const [sel, setSel] = useState<number | null>(null);
  const [ghost, setGhostState] = useState<{ p: Placed; ok: boolean } | null>(null);
  const ghostRef = useRef<{ p: Placed; ok: boolean } | null>(null);
  const setGhost = (v: { p: Placed; ok: boolean } | null) => { ghostRef.current = v; setGhostState(v); };
  const [best, setBest] = useState(0);
  const [final, setFinal] = useState<Final | null>(null);
  const [fact, setFact] = useState<Toast | null>(null);
  const [locked, setLockedState] = useState(false);       // a beat after each move, so you see what happened
  const lockedRef = useRef(false);
  const setLocked = (v: boolean) => { lockedRef.current = v; setLockedState(v); };
  const [armed, setArmed] = useState<"light" | "blast" | null>(null);   // a power-up picked, waiting for where
  const [aimAt, setAimAt] = useState<{ at: number; v: boolean } | null>(null);   // where it would go (tap again to use it)
  const [cpuAim, setCpuAim] = useState<number[] | null>(null);           // the computer's move, shown on your fridge just before it lands
  const [turnPop, setTurnPop] = useState<{ id: number; mine: boolean } | null>(null);   // "Your Turn!" / "Their Turn" when the turn changes
  const shell = useGameShell(GAME, mode);
  const { reset: resetScores } = shell.scores;
  const aiRng = useRef<() => number>(Math.random);
  const cpuPlan = useRef<{ turnNo: number; move: Move } | null>(null);   // decided once per move, so a pause can't change Today
  const total = useRef(0), runShots = useRef(0), runStart = useRef(0);
  const bestKey = mode === "daily" ? `fridgeraid-daily-${torontoDate()}` : "fridgeraid-endless";
  const todayKey = `fridgeraid-today-${torontoDate()}`;
  useEffect(() => { setBest(readBest(bestKey)); }, [bestKey]);
  const myName = shell.player?.name || "Guest";

  // same phone
  const [names, setNames] = useState<[string, string]>(["", ""]);
  const [holder, setHolder] = useState<Side>(0);
  const [pass, setPass] = useState<{ to: Side; then: "place" | "play" }>({ to: 0, then: "place" });
  const phoneReady = useRef<[boolean, boolean]>([false, false]);

  // live
  const [room, setRoom] = useState<Room>({ status: "idle" });
  const chRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef<Meta | null>(null);
  const pairedWith = useRef<string | null>(null);
  const [myReady, setMyReady] = useState(false);
  const [myOk, setMyOk] = useState(false);                 // tapped I'm Ready on the Get Ready card
  const readyRef = useRef(false);
  const awaiting = useRef<{ turn: number; kind: Kind; at: number; v: boolean; cells: number[]; sent: number } | null>(null);
  const heard = useRef<Meta | null>(null);                 // the friend's newest seat info from a "meta" message
  const answers = useRef(new Map<number, Msg>());
  const awayT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOpp = useRef<Meta | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [offer, setOffer] = useState<SavedLive | null>(null);   // a live match from before a reload
  const [joinInput, setJoinInput] = useState("");
  const [now, setNow] = useState(0);

  // the board fills the space: their fridge on top, the power-ups, then your own fridge (bigger on tall phones)
  useEffect(() => {
    const el = wrapRef.current!; const f = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect();
  }, []);
  const FR = 9, HEAD = 24, HANDLE = 7, GAP = 8, BAR = 58, LOWH = 128, SFR = 5, SHEAD = 18;
  const maxBig = Math.max(20, Math.floor((area.w - 2 * FR - HANDLE) / N));
  const smallH = (c: number) => N * c + SFR + SHEAD;
  const want = area.h < 600 ? 19 : 29;
  const cB = Math.max(22, Math.min(maxBig, 54, Math.floor((area.h - smallH(want) - BAR - 2 * GAP - FR - HEAD) / N)));
  const cS = Math.max(14, Math.min(34, Math.floor((area.h - (N * cB + FR + HEAD) - BAR - 2 * GAP - SFR - SHEAD) / N), Math.floor((area.w * 0.6 - 2 * SFR - 4) / N)));
  const cP = Math.max(22, Math.min(maxBig, 54, Math.floor((area.h - LOWH - GAP - FR - HEAD) / N)));

  // ── starting things ────────────────────────────────────────────────────
  const todayRecord = (): Final | null => { try { const v = localStorage.getItem(todayKey); return v ? JSON.parse(v) : null; } catch { return null; } };
  const clearAim = () => { setArmed(null); setAimAt(null); };
  const startCpu = (keep: Placed[] | null, nextRound: number) => {
    const daily = mode === "daily";
    if (daily && todayRecord()) { setFinal(todayRecord()); go("doneToday"); setMsg("Today's Fridge Is Done. New One At Midnight."); return; }
    const lay = mulberry32(daily ? dailySeed(LAYOUT_SALT) : Math.floor(Math.random() * 1e9));
    aiRng.current = mulberry32(daily ? dailySeed(AI_SALT) : Math.floor(Math.random() * 1e9));
    g.current = newGame(keep ?? autoPlace(Math.random), autoPlace(lay)); cpuPlan.current = null;
    if (nextRound === 1) { total.current = 0; runShots.current = 0; runStart.current = 0; resetScores(); }
    setRound(nextRound); setSel(null); setGhost(null); setFact(null); setFinal(null); setLocked(false); clearAim(); setCpuAim(null);
    go("place"); setMsg(nextRound === 1 ? "Hide Your Snacks, Then Tap Ready." : `Round ${nextRound}. Move Your Snacks If You Like.`);
    bump();
  };
  useEffect(() => {
    if (opp === "cpu") startCpu(null, 1);
    else if (opp === "phone") { go("names"); setMsg("Two Players, One Phone."); setFact(null); setFinal(null); }
    else if (resuming.current) resuming.current = false;               // picking a saved live match back up: keep it
    else { go("idle"); setFact(null); setFinal(null); setMsg("Play Live On Two Phones."); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, opp, run]);

  const forgetLive = () => { try { sessionStorage.removeItem(LIVE_KEY); localStorage.removeItem(LIVE_KEY); } catch {} };
  // Leave (a button, or leaving the game for another page) says "bye", so the friend knows straight away. Minimising or
  // reloading doesn't: the friend sees "Stepped Away" for up to 60 seconds and the match picks up when you're back.
  const leaveRoom = () => {
    const ch = chRef.current;
    if (ch) { ch.send({ type: "broadcast", event: "m", payload: { t: "bye", round: meRef.current?.round ?? 0 } }); setTimeout(() => sb().removeChannel(ch), 200); }
    chRef.current = null; pairedWith.current = null; awaiting.current = null; lastOpp.current = null;
    if (awayT.current) clearTimeout(awayT.current); awayT.current = null;
    forgetLive(); setReconnecting(false); setRoom({ status: "idle" });
  };
  const leaveRef = useRef(leaveRoom); leaveRef.current = leaveRoom;
  useEffect(() => () => leaveRef.current(), []);
  const pickOpp = (o: Opp) => { if (o === opp) return; if (opp === "live") leaveRoom(); setOpp(o); };
  const pickMode = (m: Mode) => { if (opp === "live") leaveRoom(); setMode(m); if (opp !== "cpu") setOpp("cpu"); else setRun(r => r + 1); };

  // the pause button is for the computer only
  const { held, setHeld } = shell;
  useEffect(() => { if (opp !== "cpu" && held) setHeld(false); }, [opp, held, setHeld]);

  // ── moves ──────────────────────────────────────────────────────────────
  const pov: Side = opp === "phone" ? holder : 0;
  const other = (s: Side): Side => (s === 0 ? 1 : 0);
  const nameOf = (s: Side) => opp === "cpu" ? (s === 0 ? "You" : "The Computer")
    : opp === "phone" ? (names[s] || `Player ${s + 1}`)
    : (s === 0 ? myName : (room.opp ?? lastOpp.current)?.name && (room.opp ?? lastOpp.current)!.name !== "Guest" ? (room.opp ?? lastOpp.current)!.name : "Your Friend");
  const fridgeName = (s: Side) => (s === pov ? "Your Fridge" : opp === "cpu" ? "Computer's Fridge" : `${nameOf(s)}'s Fridge`);

  /** Book-keeping for a move by `shooter`, once the answer is known. Returns true when it earns another shot. */
  const record = (shooter: Side, a: Answer): boolean => {
    const G = g.current, target = other(shooter), light = a.kind === "light";
    G.shots[shooter] += a.cells.length;
    if (a.kind !== "shot") G.used[shooter][a.kind] = true;
    let bites = 0, sunk: Placed | null = null;
    for (const c of a.cells) {
      G.inc[target][c.i] = light ? (c.hit ? 3 : 1) : (c.hit ? 2 : 1); if (c.hit) G.seen[target][c.i] = c.s;
      if (light) continue;
      if (c.hit) { bites++; G.hits[shooter]++; G.streak[shooter]++; G.bestStreak[shooter] = Math.max(G.bestStreak[shooter], G.streak[shooter]); }
      else G.streak[shooter] = 0;
      if (c.sunk && !G.found[target].some(f => f.s === c.sunk!.s)) { G.found[target].push(c.sunk); sunk = c.sunk; G.lastFound = c.sunk.s; }
      G.log[shooter].push(c.sunk ? emoji(SNACKS[c.sunk.s].code) : c.hit ? SQUARE.hit : SQUARE.miss);
      if (opp === "cpu" && shooter === 0) G.roundScore += (c.hit ? hitPoints(G.streak[0]) : 0) + (c.sunk ? foundPoints(c.sunk.s) : 0);
    }
    if (light) G.log[shooter].push(SQUARE.light);
    if (a.over && opp === "cpu" && shooter === 0) G.roundScore += winBonus(G.shots[0], G.layout[0], G.inc[0]);
    G.fx = { id: (G.fx?.id ?? 0) + 1, side: target, kind: a.kind, cells: a.cells };
    const again = a.kind === "shot" && bites > 0 && !a.over;
    // what happened, in a word or two (Title Case)
    const me = shooter === pov, lit = a.cells.filter(c => c.hit).length;
    const bit = a.cells.find(c => c.hit), bitName = bit ? SNACKS[bit.s].name : "";
    const theirs = opp === "phone" ? `${nameOf(target)}'s` : "The";
    const who = opp === "cpu" ? "The Computer" : nameOf(shooter), whose = opp === "cpu" ? "The Computer's" : `${nameOf(shooter)}'s`;
    const tail = again ? (me ? " Go Again!" : opp === "cpu" ? " It Goes Again." : " They Go Again.") : "";
    let line: string;
    if (me) {
      if (light) line = lit ? `The Light Shows ${plural(lit, "Snack", "Snacks")}!` : "The Light Shows Only Ice.";
      else if (sunk) line = `You Found ${theirs} ${SNACKS[sunk.s].name}! ${emoji(SNACKS[sunk.s].code)}`;
      else if (a.kind === "blast") line = bites ? `Freezer Blast! ${plural(bites, "Bite", "Bites")}.` : "Freezer Blast! Just Ice.";
      else line = bites ? (G.streak[shooter] > 1 ? `Another Bite! ${G.streak[shooter]} In A Row.` : `A Bite! It's A ${bitName}.`) : "Just Ice. Nothing There.";
    } else {
      if (light) line = lit ? `${whose} Light Spotted ${plural(lit, "Snack", "Snacks")}.` : `${whose} Light Found Only Ice.`;
      else if (sunk) line = `${who} Found Your ${SNACKS[sunk.s].name}!`;
      else if (a.kind === "blast") line = bites ? `Freezer Blast! ${who} Bit ${plural(bites, "Shelf", "Shelves")}.` : `${whose} Freezer Blast Missed.`;
      else line = bites ? `${who} Bit Your ${bitName}.` : `${who} Missed.`;
    }
    setMsg(line + tail);
    return again;
  };
  const pickFact = (s: number | null): Toast | null => {
    if (s === null) return null; const sn = SNACKS[s];
    return { title: `The Last Snack Found: ${sn.name}`, body: sn.facts[Math.floor(Math.random() * sn.facts.length)], img: sn.code };
  };
  /** After a move: the same side again after a bite, otherwise the other side. */
  const nextMove = (again: boolean) => { const G = g.current; G.turnNo++; if (!again) G.turn = other(G.turn); G.turnAt = Date.now(); };

  const cpuEnd = (won: boolean) => {
    const G = g.current; runShots.current += G.shots[0];
    setFact(pickFact(G.lastFound)); clearAim(); setCpuAim(null);
    if (won && mode === "endless") { total.current += G.roundScore; go("roundWon"); bump(); return; }
    const score = total.current + G.roundScore;
    const f: Final = { score, won, shots: G.shots[0], hits: G.hits[0], streak: G.bestStreak[0], rounds: round, log: G.log[0] };
    setFinal(f); go("over");
    if (score > readBest(bestKey)) { saveBest(bestKey, score); setBest(score); }
    if (mode === "daily") try { localStorage.setItem(todayKey, JSON.stringify(f)); } catch {}
    shell.finishRef.current({ score, drops: runShots.current, ms: performance.now() - runStart.current });
    bump();
  };

  /** Your move on their fridge (a tap): a shot, or a power-up if one is armed (first tap aims, a second tap on it uses it). */
  const tapTarget = (i: number) => {
    const G = g.current, t = other(pov);
    if (phaseRef.current !== "play" || G.turn !== pov || lockedRef.current || awaiting.current) return;
    if (opp === "live" && (room.status !== "paired" || reconnecting)) return;   // a shot needs their answer: wait for them
    if (opp === "cpu" && shell.paused) return;
    let kind: Kind = "shot", v = false;
    if (armed) {
      if (!aimAt || !coverOf(armed, aimAt.at, aimAt.v).includes(i)) { setAimAt({ at: i, v: aimAt?.v ?? false }); setMsg(`Looks Good? Tap ${POWER[armed].use}.`); return; }
      kind = armed; i = aimAt.at; v = aimAt.v;
    }
    const cells = coverOf(kind, i, v);
    if (!freshCells(G.inc[t], kind, cells).length) { setMsg(kind === "shot" ? "You've Tried That Shelf. Pick Another." : "Nothing New There. Aim Somewhere Else."); return; }
    clearAim();
    if (opp === "live") return liveSend(kind, i, v, cells);
    const a = answerMove(G.layout[t]!, G.inc[t], kind, cells), again = record(pov, a);
    setLocked(true); bump();
    if (opp === "cpu") {
      if (a.over) { setTimeout(() => { setLocked(false); cpuEnd(true); }, LOCK_MS); return; }
      setTimeout(() => { setLocked(false); nextMove(again); bump(); }, LOCK_MS); return;
    }
    // same phone: show the result for a moment, then go again or hand over
    if (a.over) { setTimeout(() => { setLocked(false); go("over"); setFact(pickFact(G.lastFound)); bump(); }, LOCK_MS); return; }
    if (again) { setTimeout(() => { setLocked(false); nextMove(true); bump(); }, LOCK_MS); return; }
    setTimeout(() => { setLocked(false); nextMove(false); setPass({ to: t, then: "play" }); go("pass"); setMsg(`Pass The Phone To ${nameOf(t)}.`); bump(); }, 1400);
  };

  // the computer's turn: think, show where it's going on your fridge, then land it (and go again after a bite)
  const paused = shell.paused;
  useEffect(() => {
    if (opp !== "cpu" || phase !== "play" || g.current.turn !== 1 || paused || locked) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const G = g.current, turnNo = G.turnNo;   // the last result stays up while it thinks, then its aim shows, then the new result
    timers.push(setTimeout(() => {
      if (phaseRef.current !== "play" || G.turn !== 1 || G.turnNo !== turnNo) return;
      const skill = mode === "daily" ? SKILL_TODAY : Math.min(1, SKILL_FREE + SKILL_STEP * (round - 1));
      if (cpuPlan.current?.turnNo !== turnNo) cpuPlan.current = { turnNo, move: aiMove(G.inc[0], G.found[0], aiRng.current, skill, G.used[1], G.turnNo) };
      let mv = cpuPlan.current.move;
      if (!freshCells(G.inc[0], mv.kind, coverOf(mv.kind, mv.at, mv.v)).length) mv = { kind: "shot", at: aiPick(G.inc[0], G.found[0], aiRng.current, skill), v: false };
      const cells = coverOf(mv.kind, mv.at, mv.v);
      setCpuAim(cells);
      setMsg(mv.kind === "light" ? "The Computer Turns On Its Fridge Light..." : mv.kind === "blast" ? "Freezer Blast Incoming!" : "The Computer Takes A Shot...");
      timers.push(setTimeout(() => {
        if (phaseRef.current !== "play" || G.turn !== 1 || G.turnNo !== turnNo) return;
        setCpuAim(null);
        const a = answerMove(G.layout[0], G.inc[0], mv.kind, cells), again = record(1, a);
        if (a.over) { bump(); setTimeout(() => cpuEnd(false), LOCK_MS); return; }
        nextMove(again); bump();
      }, mv.kind === "shot" ? 450 : 750));
    }, 650 + Math.random() * 300));
    return () => { timers.forEach(clearTimeout); setCpuAim(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp, phase, paused, locked, g.current.turn, g.current.turnNo]);

  // a big "Your Turn!" (or "Their Turn") over their fridge whenever the turn changes hands, so nobody has to read for it
  const lastTurn = useRef("");
  useEffect(() => {
    if (phase !== "play") { lastTurn.current = ""; setTurnPop(null); return; }
    const key = `${round}:${g.current.turn}:${opp === "phone" ? holder : 0}`;
    if (key === lastTurn.current) return;
    lastTurn.current = key;
    const id = Date.now(), mine = g.current.turn === (opp === "phone" ? holder : 0);
    setTurnPop({ id, mine });
    const t = setTimeout(() => setTurnPop(p => (p && p.id === id ? null : p)), 1200);
    return () => clearTimeout(t);
  }, [phase, g.current.turn, round, holder, opp]);

  // ── placing your snacks ────────────────────────────────────────────────
  const draft = () => g.current.layout[pov] ?? [];
  const setDraft = (l: Placed[]) => { g.current.layout[pov] = l; bump(); };
  const placing = phase === "place" && !(opp === "live" && myReady);
  const turnSnack = (s: number, pivot?: number) => {
    const l = draft(), p = l.find(q => q.s === s)!; const L = SNACKS[s].len;
    const cells = cellsOf(p), at = pivot !== undefined && cells.includes(pivot) ? cells.indexOf(pivot) : 0, pc = cells[at];
    const pr = Math.floor(pc / N), pcol = pc % N, v = !p.v;
    const order = Array.from({ length: L }, (_, k) => k).sort((x, y) => Math.abs(x - at) - Math.abs(y - at));
    for (const k of order) {
      const q = { s, v, r: v ? pr - k : pr, c: v ? pcol : pcol - k };
      if (fits(l, q)) { setDraft(l.map(o => (o.s === s ? q : o))); return; }
    }
    setMsg("No Room To Turn It There. Move It First.");
  };
  const drag = useRef<{ s: number; dr: number; dc: number; from: number; moved: boolean; wasSel: boolean } | null>(null);
  const cellAt = (e: { clientX: number; clientY: number }, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const c = Math.max(0, Math.min(N - 1, Math.floor(((e.clientX - r.left) / r.width) * N)));
    const row = Math.max(0, Math.min(N - 1, Math.floor(((e.clientY - r.top) / r.height) * N)));
    return row * N + c;
  };
  const clampTo = (s: number, v: boolean, r: number, c: number): Placed => {
    const L = SNACKS[s].len;
    return { s, v, r: Math.max(0, Math.min(v ? N - L : N - 1, r)), c: Math.max(0, Math.min(v ? N - 1 : N - L, c)) };
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!placing) return;
    const i = cellAt(e, e.currentTarget), l = draft(), p = l.find(q => cellsOf(q).includes(i));
    if (p) {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { s: p.s, dr: Math.floor(i / N) - p.r, dc: (i % N) - p.c, from: i, moved: false, wasSel: sel === p.s };
      setSel(p.s);
    } else if (sel !== null) {                     // tap an empty shelf to move the picked snack there
      const cur = l.find(q => q.s === sel)!, q = clampTo(sel, cur.v, Math.floor(i / N), i % N);
      if (fits(l, q)) setDraft(l.map(o => (o.s === sel ? q : o))); else setMsg("That Spot's Taken. Try Another.");
    }
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d) return;
    const i = cellAt(e, e.currentTarget); if (i === d.from && !d.moved) return;
    d.moved = true;
    const cur = draft().find(q => q.s === d.s)!, q = clampTo(d.s, cur.v, Math.floor(i / N) - d.dr, (i % N) - d.dc);
    setGhost({ p: q, ok: fits(draft(), q) });
  };
  const onUp = () => {
    const d = drag.current; drag.current = null; if (!d) return;
    const gh = ghostRef.current;
    if (d.moved) { if (gh?.ok) setDraft(draft().map(o => (o.s === d.s ? gh.p : o))); else if (gh) setMsg("That Spot's Taken. Try Another."); setGhost(null); }
    else if (d.wasSel) turnSnack(d.s, d.from);
  };
  const shuffle = () => { setDraft(autoPlace(Math.random)); setSel(null); };

  const ready = () => {
    setSel(null); setGhost(null);
    if (opp === "cpu") {
      const G = g.current; G.turn = 0; G.turnAt = Date.now();
      if (!runStart.current) runStart.current = performance.now();
      go("play"); setMsg("Your Turn. Tap A Shelf In Their Fridge."); bump(); return;
    }
    if (opp === "phone") {
      phoneReady.current[holder] = true;
      const first: Side = round % 2 === 1 ? 0 : 1;
      if (!phoneReady.current[other(holder)]) { setPass({ to: other(holder), then: "place" }); go("pass"); setMsg(`Pass The Phone To ${nameOf(other(holder))}.`); }
      else if (first === holder) { g.current.turn = first; go("play"); setMsg(`${nameOf(first)}, You Go First. Tap A Shelf In Their Fridge.`); bump(); }   // already holding it
      else { g.current.turn = first; setPass({ to: first, then: "play" }); go("pass"); setMsg(`Pass The Phone To ${nameOf(first)}.`); }
      return;
    }
    readyRef.current = true; setMyReady(true); setMeta({ ready: true });
    setMsg("Waiting For Your Friend To Hide Their Snacks.");
  };

  // ── same phone ─────────────────────────────────────────────────────────
  const startPhone = (nextRound: number, first = nameOf(0)) => {
    const fresh = () => autoPlace(Math.random);
    g.current = newGame(fresh(), fresh()); phoneReady.current = [false, false];
    setRound(nextRound); setFact(null); setSel(null); clearAim();
    setPass({ to: 0, then: "place" }); go("pass"); setMsg(`Pass The Phone To ${first}.`); bump();
  };
  const takePhone = () => {
    setHolder(pass.to); setSel(null); clearAim(); go(pass.then);
    const n = names[pass.to] || `Player ${pass.to + 1}`;
    setMsg(pass.then === "place" ? `${n}, Hide Your Snacks.` : `${n}, Your Turn. Tap A Shelf In Their Fridge.`);
  };

  // ── live ───────────────────────────────────────────────────────────────
  const send = (m: Msg) => { chRef.current?.send({ type: "broadcast", event: "m", payload: m }); };
  // seat info goes out at once as a broadcast; presence gets one update per burst (two tracks in a row can make the
  // friend's phone briefly lose this seat altogether, which reads as "they left")
  const trackSoon = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setMeta = (p: Partial<Meta>) => {
    if (!meRef.current) return; meRef.current = { ...meRef.current, ...p, seq: Math.max(Date.now(), meRef.current.seq + 1) };   // newer even after a reload
    send({ t: "meta", round: meRef.current.round, meta: meRef.current });
    if (!trackSoon.current) trackSoon.current = setTimeout(() => { trackSoon.current = null; if (meRef.current) chRef.current?.track(meRef.current); }, 250);
  };
  /** Join a room. `resume`: the same seat as before (after a reload, or a dropped connection), with the match carrying on. */
  const joinRoom = (code: string, resume?: SavedLive | null) => {
    if (chRef.current) sb().removeChannel(chRef.current);
    const prior = resume ?? readLive(code);                            // same room as before: same seat
    if (!resume) { pairedWith.current = null; heard.current = null; }
    const me: Meta = { id: prior?.id ?? Math.random().toString(36).slice(2, 10), name: storedName(), at: prior?.at ?? Date.now(), round: resume ? resume.round : 1,
      ready: resume ? resume.ready : false, seq: Date.now(), ok: !!resume, stage: resume ? "game" : "gate" };
    setMyOk(!!resume);
    meRef.current = me;
    if (resume) { setReconnecting(true); setRoom(v => ({ ...v, status: v.status === "away" ? "away" : "paired", code })); } else setRoom({ status: "connecting", code });
    const ch = sb().channel(`${GAME}:${code}`, { config: { broadcast: { self: false }, presence: { key: me.id } } });
    chRef.current = ch;
    let tracked = false;
    const track = () => { if (tracked || chRef.current !== ch) return; tracked = true; ch.track(meRef.current!); };
    const full = () => { setRoom({ status: "full", code }); sb().removeChannel(ch); if (chRef.current === ch) chRef.current = null; };
    ch.on("presence", { event: "sync" }, () => {
      if (chRef.current !== ch) return;
      const metas = Object.values(ch.presenceState<Meta>()).map(a => a[a.length - 1] as unknown as Meta).filter(m => m && typeof m.id === "string");
      if (!tracked) { if (metas.filter(m => m.id !== me.id).length >= 2) full(); else track(); return; }
      if (!metas.some(m => m.id === me.id)) return;
      const seats = metas.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1)).slice(0, 2);
      if (!seats.some(m => m.id === me.id)) { full(); return; }       // two people raced in at once: the later one steps out
      let o = seats.find(m => m.id !== me.id) ?? null;
      if (o && heard.current?.id === o.id && heard.current.seq > (o.seq ?? 0)) o = heard.current;   // presence hasn't caught up yet
      const host = seats[0].id === me.id;
      if (o) lastOpp.current = o;
      if (!o && pairedWith.current && ["place", "play", "over"].includes(phaseRef.current)) {   // gone mid-match: give them 60 seconds
        if (!awayT.current) {
          const until = Date.now() + AWAY_MS;
          awayT.current = setTimeout(() => { awayT.current = null; setRoom(v => (v.status === "away" ? { ...v, status: "waiting", opp: null, until: undefined } : v)); }, AWAY_MS);
          setRoom({ status: "away", code, opp: null, host, until });
        }
        return;
      }
      if (o && awayT.current) { clearTimeout(awayT.current); awayT.current = null; }
      setRoom({ status: o ? "paired" : "waiting", code, opp: o, host });
    });
    ch.on("broadcast", { event: "m" }, ({ payload }) => onMsgRef.current(payload as Msg));
    ch.subscribe(status => {
      if (chRef.current !== ch) return;
      if (status === "SUBSCRIBED") {
        setTimeout(track, resume ? 0 : 1500);                           // in case the first presence sync is slow
        if (pairedWith.current) setTimeout(() => sendResume(), 500);    // catch up with the friend
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (pairedWith.current) { setReconnecting(true); setTimeout(() => { if (chRef.current === ch) joinRoom(code, liveNowRef.current()); }, 1500); }   // try again, same seat
        else setRoom({ status: "error", code });
      }
    });
  };
  // ── catching up after a break ─────────────────────────────────────────
  // Each phone snapshots the shared match from its own side (both shot grids, found snacks, power-ups, whose turn);
  // the one that comes back sends "resume", the other answers "state", and each keeps the newer. Layouts never travel:
  // after a reload a phone takes its own layout back from local storage.
  const takeSnap = (): Snap => {
    const G = g.current, ph = phaseRef.current === "over" ? 2 : phaseRef.current === "play" ? 1 : 0, r = meRef.current?.round ?? round;
    return { p: r * 1e6 + ph * 1e4 + G.turnNo, from: meRef.current?.id ?? "", round: r, ph, turnOwner: G.turn === 0 ? (meRef.current?.id ?? "") : (pairedWith.current ?? ""), turnNo: G.turnNo,
      inc: G.inc.map(x => Array.from(x).join("")), seen: G.seen.map(x => Array.from(x)), found: G.found, used: G.used, shots: [...G.shots], hits: [...G.hits],
      streak: [...G.streak], bestStreak: [...G.bestStreak], log: G.log, lastFound: G.lastFound };
  };
  /** Load a snapshot's shared match. `theirs`: it was taken on the friend's phone, so their side 0 is our side 1. */
  const loadShared = (sn: Snap, theirs: boolean) => {
    const G = g.current, o = (a: number) => (theirs ? 1 - a : a);
    G.inc = [Int8Array.from(sn.inc[o(0)], ch => +ch), Int8Array.from(sn.inc[o(1)], ch => +ch)];
    G.seen = [Int8Array.from(sn.seen[o(0)]), Int8Array.from(sn.seen[o(1)])];
    G.found = [sn.found[o(0)], sn.found[o(1)]]; G.used = [{ ...sn.used[o(0)] }, { ...sn.used[o(1)] }];
    G.shots = [sn.shots[o(0)], sn.shots[o(1)]]; G.hits = [sn.hits[o(0)], sn.hits[o(1)]]; G.streak = [sn.streak[o(0)], sn.streak[o(1)]];
    G.bestStreak = [sn.bestStreak[o(0)], sn.bestStreak[o(1)]]; G.log = [sn.log[o(0)], sn.log[o(1)]]; G.lastFound = sn.lastFound;
    G.turnNo = sn.turnNo; G.turn = sn.turnOwner === meRef.current?.id ? 0 : 1; G.turnAt = Date.now(); G.fx = null;
    awaiting.current = null; setLocked(false); clearAim();
    if (sn.round !== (meRef.current?.round ?? round)) { setRound(sn.round); setMeta({ round: sn.round }); }
    if (sn.ph === 2) { go("over"); setFact(pickFact(G.lastFound)); } else if (sn.ph === 1) { go("play"); setMsg(G.turn === 0 ? "Back In The Game. Your Turn." : `Back In The Game. ${nameOf(1)}'s Turn.`); }
    bump();
  };
  const liveNow = (): SavedLive => ({ code: room.code ?? "", id: meRef.current?.id ?? "", at: meRef.current?.at ?? 0, friendId: pairedWith.current ?? "", round: meRef.current?.round ?? round,
    layout: g.current.layout[0] ?? [], ready: readyRef.current, snap: takeSnap(), t: Date.now() });
  const takeSnapRef = useRef(takeSnap); takeSnapRef.current = takeSnap;
  const liveNowRef = useRef(liveNow); liveNowRef.current = liveNow;
  const sendResume = () => { const sn = takeSnapRef.current(); send({ t: "resume", round: sn.round, snap: sn }); setReconnecting(true); setTimeout(() => setReconnecting(false), 4000); };
  // keep the live match saved (cleared when it ends or you leave), so a reload can pick it back up
  useEffect(() => {
    if (opp !== "live" || !pairedWith.current || !room.code) return;
    if (phase === "place" || phase === "play") { const v = JSON.stringify(liveNow()); try { sessionStorage.setItem(LIVE_KEY, v); localStorage.setItem(LIVE_KEY, v); } catch {} }
    else if (phase === "over") forgetLive();
  });
  // back from another app (or the network): make sure we're still in the room, and catch up
  const backRef = useRef(() => {});
  backRef.current = () => {
    if (document.visibilityState !== "visible" || opp !== "live" || !pairedWith.current || !room.code) return;
    const ch = chRef.current as unknown as { state?: string } | null, rt = sb().realtime;
    if (!rt.isConnected() || !ch || ch.state !== "joined") { joinRoom(room.code, liveNow()); if (!rt.isConnected()) void rt.disconnect().catch(() => {}).then(() => rt.connect()); }   // the socket may have died while we were away; connect() does nothing while a dead one is still attached
    else { chRef.current?.track(meRef.current!); sendResume(); }
  };
  useEffect(() => {
    const f = () => backRef.current();
    document.addEventListener("visibilitychange", f); window.addEventListener("pageshow", f); window.addEventListener("online", f);
    return () => { document.removeEventListener("visibilitychange", f); window.removeEventListener("pageshow", f); window.removeEventListener("online", f); };
  }, []);
  const resuming = useRef(false);
  const rejoinNow = (sv: SavedLive) => {
    resuming.current = opp !== "live"; setOffer(null); setOpp("live");
    meRef.current = { id: sv.id, name: storedName(), at: sv.at, round: sv.round, ready: sv.ready, seq: Date.now(), ok: true, stage: "game" };   // our seat, before reading whose turn it is
    g.current = newGame(sv.layout, null); loadShared(sv.snap, false);
    setRound(sv.round); readyRef.current = sv.ready; setMyReady(sv.ready); pairedWith.current = sv.friendId; heard.current = null;
    if (sv.snap.ph === 0) { go("place"); setMsg(sv.ready ? "Waiting For Your Friend To Hide Their Snacks." : "Hide Your Snacks, Then Tap Ready."); }
    joinRoom(sv.code, sv);
  };
  // a shared link (whatyouate.app/games/fridge-raid?room=ABCD) joins that room straight away, or picks a saved match back up
  useEffect(() => {
    const code = cleanCode(new URLSearchParams(window.location.search).get("room") ?? "");
    const sv = readLive();
    if (sv && sv.snap.ph < 2 && (!validCode(code) || code === sv.code)) { if (validCode(code)) rejoinNow(sv); else setOffer(sv); return; }
    if (validCode(code)) { setOpp("live"); joinRoom(code); }
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const roomLink = (code: string) => `${typeof window === "undefined" ? "https://whatyouate.app" : window.location.origin}/games/${GAME}?room=${code}`;

  const startLiveRound = (r: number) => {
    g.current = newGame(g.current.layout[0] && r > 1 ? g.current.layout[0] : autoPlace(Math.random), null);
    answers.current.clear(); awaiting.current = null; readyRef.current = false; setMyReady(false); clearAim(); setLocked(false);
    setRound(r); setMeta({ round: r, ready: false }); setFact(null); setSel(null);
    go("place"); setMsg(r === 1 ? "Hide Your Snacks, Then Tap Ready." : "Rematch! Move Your Snacks If You Like."); bump();
  };
  // a friend arrived (or a new one after the last one left): both see the Get Ready card, then a fresh round 1
  const oppId = room.status === "paired" ? room.opp?.id ?? null : null;
  useEffect(() => {
    if (opp !== "live" || !oppId || pairedWith.current === oppId) return;
    pairedWith.current = oppId; setMyOk(false); setMeta({ ok: false, stage: "gate", round: 1, ready: false });
    setFact(null); go("gate"); setMsg("Get Ready"); bump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oppId, opp]);
  // the friend left: nobody is ready any more (so a new friend starts at the Get Ready card too)
  useEffect(() => {
    if (opp === "live" && room.status === "waiting" && meRef.current && (meRef.current.ok || meRef.current.stage === "game")) { setMyOk(false); setMeta({ ok: false, stage: "gate" }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp, room.status]);
  // both ready: the host starts the first game; the guest follows when it sees the host has started (and still has both ready)
  const oppOk = !!room.opp?.ok, oppStage = room.opp?.stage;
  useEffect(() => {
    if (opp !== "live" || phase !== "gate" || room.status !== "paired" || !myOk || !oppOk) return;
    if (room.host) { setMeta({ stage: "game" }); startLiveRound(1); }
    else if (oppStage === "game") startLiveRound(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp, phase, room.status, room.host, myOk, oppOk, oppStage]);
  const markOk = () => { if (myOk) return; setMyOk(true); setMeta({ ok: true }); };
  const firstShooter = (r: number): Side => ((r % 2 === 1) === !!room.host ? 0 : 1);   // host first, then take turns going first
  const startLivePlay = () => {
    if (phaseRef.current !== "place" || !readyRef.current) return;
    const G = g.current; G.turn = firstShooter(meRef.current?.round ?? round); G.turnNo = 0; G.turnAt = Date.now();
    go("play"); setMsg(G.turn === 0 ? "You Go First. Tap A Shelf In Their Fridge." : `${nameOf(1)} Goes First.`); bump();
  };
  useEffect(() => {
    if (opp === "live" && phase === "place" && myReady && room.status === "paired" && room.opp?.ready && room.opp.round === round) startLivePlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp, phase, myReady, room, round]);
  const liveSend = (kind: Kind, at: number, v: boolean, cells: number[]) => {
    const G = g.current; if (awaiting.current) return;
    awaiting.current = { turn: G.turnNo, kind, at, v, cells, sent: Date.now() };
    send({ t: "move", round: meRef.current!.round, turn: G.turnNo, kind, at, v }); bump();
  };
  const liveOver = (won: boolean) => {
    setFact(pickFact(g.current.lastFound)); go("over"); clearAim();
    setMsg(won ? `You Found All Of ${nameOf(1)}'s Snacks!` : `${nameOf(1)} Found All Your Snacks.`);
  };
  const onMsg = (m: Msg) => {
    const G = g.current, r = meRef.current?.round;
    if (m?.t === "bye") {                                              // they tapped Leave: no grace period
      if (awayT.current) clearTimeout(awayT.current); awayT.current = null;
      setRoom(v => ({ ...v, status: "waiting", opp: null, until: undefined })); return;
    }
    if (m?.t === "resume" || m?.t === "state") {
      if (!pairedWith.current || m.snap.from !== pairedWith.current) return;
      if (m.t === "resume") { const mine = takeSnap(); send({ t: "state", round: mine.round, snap: mine }); }
      else setReconnecting(false);
      const mine = takeSnap();
      if (m.snap.p > mine.p) loadShared(m.snap, true);                // newer wins (equal progress is the same match state)
      return;
    }
    if (m?.t === "meta") {
      if (heard.current?.id === m.meta.id && heard.current.seq >= m.meta.seq) return;
      heard.current = m.meta;
      setRoom(v => (v.status === "paired" && v.opp?.id === m.meta.id ? { ...v, opp: m.meta } : v)); return;
    }
    if (!m || m.round !== r) return;
    if (phaseRef.current === "place") startLivePlay();     // their move can arrive just before their "ready" does
    if (phaseRef.current !== "play" && m.t !== "move") return;
    if (m.t === "move") {
      if (phaseRef.current === "over" || m.turn < G.turnNo) { const old = answers.current.get(m.turn); if (old) send(old); return; }
      if (phaseRef.current !== "play" || m.turn !== G.turnNo || G.turn !== 1) return;
      const a = answerMove(G.layout[0]!, G.inc[0], m.kind, coverOf(m.kind, m.at, m.v));
      const reply: Msg = { t: "answer", round: r, turn: m.turn, kind: a.kind, cells: a.cells, over: a.over };
      answers.current.set(m.turn, reply); send(reply);
      const again = record(1, a);
      if (a.over) liveOver(false); else nextMove(again);
      bump();
    } else if (m.t === "answer") {
      const w = awaiting.current; if (!w || w.turn !== m.turn || w.kind !== m.kind) return;
      awaiting.current = null;
      const again = record(0, { kind: m.kind, cells: m.cells, over: m.over });
      if (!m.over && !again) { nextMove(false); bump(); return; }      // the turn passes straight away; a bite (or the end) waits a beat
      setLocked(true); bump();
      setTimeout(() => { setLocked(false); if (m.over) liveOver(true); else nextMove(true); bump(); }, LOCK_MS);
    } else if (m.t === "skip") {
      if (m.turn !== G.turnNo) return;
      if (awaiting.current?.turn === m.turn) awaiting.current = null;
      setMsg(G.turn === 0 ? "Time's Up. Your Turn Passed." : `${nameOf(1)} Ran Out Of Time. Your Turn.`);
      nextMove(false); bump();
    }
  };
  const onMsgRef = useRef(onMsg); onMsgRef.current = onMsg;
  // the turn clock, plus resending a move if its answer hasn't come back
  useEffect(() => {
    if (opp !== "live" || phase !== "play") return;
    const t = setInterval(() => {
      const G = g.current, el = Date.now() - G.turnAt, r = meRef.current?.round ?? 0, w = awaiting.current;
      if (room.status === "away" || reconnecting) { G.turnAt += 250; setNow(Date.now()); return; }   // the clock stops while either of you is away
      if (w && Date.now() - w.sent > RESEND_MS) { w.sent = Date.now(); send({ t: "move", round: r, turn: w.turn, kind: w.kind, at: w.at, v: w.v }); }
      if (room.status === "paired") {
        if (G.turn === 0 && !w && !lockedRef.current && el > TURN_MS) { send({ t: "skip", round: r, turn: G.turnNo }); nextMove(false); clearAim(); setMsg(`Time's Up. ${nameOf(1)}'s Turn.`); bump(); }
        else if (G.turn === 1 && el > TURN_MS + GRACE_MS) { send({ t: "skip", round: r, turn: G.turnNo }); nextMove(false); setMsg(`${nameOf(1)} Ran Out Of Time. Your Turn.`); bump(); }
      }
      setNow(Date.now());
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp, phase, room.status, reconnecting]);
  useEffect(() => { if (room.status !== "away") return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [room.status]);

  // ── share ──────────────────────────────────────────────────────────────
  const n = dailyNumber(LAUNCH);
  const shareCpu = (f: Final) => {
    const label = mode === "daily" ? `Fridge Raid #${n} (Today's Challenge)` : "Fridge Raid (Free Play)";
    const rate = f.shots ? Math.round((f.hits / f.shots) * 100) : 0;
    const how = mode === "daily" ? (f.won ? `Raided in ${f.shots} shots` : "The computer won this one") : `${f.rounds - (f.won ? 0 : 1)} ${f.rounds - (f.won ? 0 : 1) === 1 ? "round" : "rounds"} won`;
    const p = shell.scores.posted;
    const rank = p?.rank ? `\n🏆 #${p.rank} of ${p.total} ${mode === "daily" ? "today" : "this week"}` : "";
    shell.share(`${label}\n${f.score.toLocaleString()} pts · ${how}\n🎯 ${rate}% bites · best streak ${f.streak}${rank}\n${lines(f.log)}\nCan you beat it? whatyouate.app/games/${GAME}`);
  };
  const shareDuel = (winner: Side) => {
    const G = g.current, w = nameOf(winner), l = nameOf(other(winner));
    const head = opp === "phone" ? `${w} beat ${l} in ${G.shots[winner]} shots 🎉` : winner === 0 ? `I beat ${l} in ${G.shots[0]} shots 🎉` : `${l} beat me this time`;
    shell.share(`Fridge Raid (${opp === "phone" ? "Same Phone" : "Play A Friend"})\n${head}\n${lines(G.log[opp === "phone" ? winner : 0])}\nPlay a friend: whatyouate.app/games/${GAME}`);
  };

  // ── drawing ────────────────────────────────────────────────────────────
  const G = g.current;
  const target = other(pov);
  const myTurn = phase === "play" && G.turn === pov;
  const canAct = myTurn && !locked && !awaiting.current && !(opp === "cpu" && shell.paused);
  const scoreNow = phase === "roundWon" ? total.current : total.current + G.roundScore;   // a won round is already in the total
  const winner: Side | null = G.found[1].length === SNACKS.length ? 0 : G.found[0].length === SNACKS.length ? 1 : null;
  const secsLeft = opp === "live" && phase === "play" ? Math.max(0, Math.ceil((TURN_MS - (now - G.turnAt)) / 1000)) : 0;
  const theyWantRematch = opp === "live" && phase === "over" && (room.opp?.round ?? 0) > round;
  const preview = armed && aimAt ? coverOf(armed, aimAt.at, aimAt.v) : [];

  /** A fridge: a coloured door frame (yours blue, theirs red) with a chrome handle, a cool lit interior with glass
   *  shelves, and what's been found in it. role: "target" (theirs, tap to play), "own" (yours, snacks showing),
   *  "edit" (yours, while hiding snacks). While it's your turn their fridge glows; while it's theirs it dims and yours
   *  glows red, because that's where they're looking. */
  const fridge = (s: Side, c: number, role: "target" | "own" | "edit", small = false) => {
    const own = role !== "target", fr = small ? SFR : FR, head = small ? SHEAD : HEAD, handle = small ? 5 : HANDLE;
    const inner = N * c, w = inner + 2 * fr + handle, h = inner + head + fr;
    const col = s === pov ? MINE : THEIRS;
    const foundSet = new Set(G.found[s].flatMap(cellsOf));
    const fx = G.fx && G.fx.side === s ? G.fx : null, fxCells = new Set(fx ? fx.cells.map(x => x.i) : []);
    const fresh = (i: number) => fxCells.has(i);
    const marks: ReactNode[] = [];
    const at = (i: number, sz: number): CSSProperties => ({ left: (i % N) * c + (c - sz) / 2, top: Math.floor(i / N) * c + (c - sz) / 2, width: sz, height: sz });
    for (let i = 0; i < N * N; i++) {
      const v = G.inc[s][i]; if (!v) continue;
      const key = `${i}-${fresh(i) ? fx!.id : 0}`;
      if (v === 1) {                                                     // ice: a little ice cube, and a frost puff when it's new
        marks.push(<span key={`m${key}`} className="pointer-events-none absolute" style={at(i, c)}>
          {fresh(i) && <span className="fr-puff absolute inset-0 rounded-full bg-white" />}
          <span className="absolute rounded-[28%]" style={{ left: c * 0.13, top: c * 0.13, width: c * 0.74, height: c * 0.74,
            background: "linear-gradient(150deg, rgba(255,255,255,0.97), rgba(200,228,255,0.9))", boxShadow: "inset 0 -2px 0 rgba(110,165,230,0.4), 0 1px 2px rgba(16,42,86,0.18)" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foodPng("2744")} alt="" draggable={false} className="absolute opacity-70" style={{ left: c * 0.28, top: c * 0.28, width: c * 0.44, height: c * 0.44 }} />
        </span>);
      } else if (v === 2 && (own || !foundSet.has(i))) {               // a bite: on their fridge, a bitten piece of what's there
        if (own) marks.push(<span key={`m${key}`} className={`pointer-events-none absolute ${fresh(i) ? "fr-shake" : ""}`} style={at(i, c)}><Bite c={c} /></span>);
        else { const sn = SNACKS[Math.max(0, G.seen[s][i])];
          marks.push(<span key={`m${key}`} className={`pointer-events-none absolute rounded-[28%] ${fresh(i) ? "fr-shake" : ""}`} style={{ ...at(i, c * 0.9),
            background: `linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0) 55%), ${sn.color}`, boxShadow: "inset 0 0 0 1.5px rgba(232,80,91,0.55), 0 2px 4px rgba(16,42,86,0.16)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foodPng(sn.code)} alt={sn.name} draggable={false} className="absolute" style={{ left: c * 0.08, top: c * 0.12, width: c * 0.68, height: c * 0.68 }} />
            <Bite c={c * 0.9} />
          </span>); }
      } else if (v === 3) {                                              // lit: a snack is here, not bitten yet
        const sn = SNACKS[Math.max(0, G.seen[s][i])];
        marks.push(<span key={`m${key}`} className={`pointer-events-none absolute rounded-[28%] ${fresh(i) ? "fr-glow" : ""}`} style={{ ...at(i, c * 0.86), boxShadow: "0 0 0 2px rgba(245,180,40,0.9), 0 0 12px 3px rgba(255,214,90,0.6)", background: "rgba(255,246,214,0.7)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {!own && <img src={foodPng(sn.code)} alt="" draggable={false} className="absolute opacity-50" style={{ left: c * 0.13, top: c * 0.13, width: c * 0.6, height: c * 0.6 }} />}
        </span>);
      }
    }
    const pills = role === "target" ? G.found[s] : (G.layout[s] ?? []);
    const justFound = fx ? new Set(fx.cells.filter(x => x.sunk).map(x => x.sunk!.s)) : new Set<number>();
    const pend = role === "target" && awaiting.current ? awaiting.current.cells : [];
    const aim = own && cpuAim && s === 0 && opp === "cpu" ? cpuAim : [];
    const clickable = role === "target" && canAct;
    const inPlay = phase === "play";
    const glow = role === "target" ? (inPlay && myTurn ? "go" : null) : (role === "own" && inPlay && !myTurn ? "alert" : null);
    const dim = role === "target" && inPlay && !myTurn;
    const tag = role === "target" && inPlay ? (myTurn ? "Tap A Shelf" : "Wait") : role === "own" && inPlay && !myTurn ? "Searching" : null;
    const r = small ? 11 : 17;
    const popText = turnPop ? (turnPop.mine ? "Your Turn!" : opp === "cpu" ? "Computer's Turn" : "Their Turn") : "";
    return (
      <div className="relative shrink-0" style={{ width: w, height: h }}>
        {glow && <div className={`pointer-events-none absolute ${glow === "go" ? "fr-go" : "fr-alert"}`} style={{ inset: small ? -4 : -6, borderRadius: r + (small ? 4 : 6),
          border: `${small ? 2.5 : 3.5}px solid ${glow === "go" ? "#3ddc84" : "#ff5d6c"}` }} />}
        <div className="absolute inset-0" style={{ borderRadius: r, background: `linear-gradient(165deg, ${col.hi} 0%, ${col.lo} 70%)`,
          boxShadow: `0 ${small ? 3 : 5}px 0 ${col.lip}, 0 14px 26px -10px rgba(16,42,86,0.5), inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.08)` }} />
        <div className="absolute rounded-full" style={{ right: small ? 1.5 : 2, top: h * 0.24, width: small ? 3 : 4.5, height: h * 0.34, background: "linear-gradient(90deg, #c9d3e1, #ffffff 45%, #aab6c8)", boxShadow: "0 1px 2px rgba(16,42,86,0.35)" }} />
        <div className="absolute flex items-center justify-between gap-1" style={{ left: fr + 2, right: fr + handle, top: 0, height: head }}>
          <span className={`game-font truncate uppercase text-white ${small ? "text-[10px]" : "text-[14px]"}`} style={{ textShadow: `0 1.5px 0 ${col.lip}` }}>{fridgeName(s)}</span>
          {tag && <span className={`game-font shrink-0 rounded-full uppercase ${small ? "px-1.5 text-[8px] leading-[13px]" : "px-2 text-[10px] leading-[17px]"} ${tag === "Tap A Shelf" ? "fr-blink bg-[#3ddc84] text-[#0d4d2b]" : tag === "Searching" ? "fr-blink bg-[#ff5d6c] text-white" : "bg-black/20 text-white/90"}`}>{tag}</span>}
        </div>
        <div data-fridge={role} className={`absolute overflow-hidden transition-[filter] duration-300 ${role === "edit" ? "touch-none" : ""} ${clickable ? "cursor-pointer" : ""}`}
          style={{ left: fr, top: head, width: inner, height: inner, borderRadius: small ? 6 : 9, background: INTERIOR, filter: dim ? "saturate(0.55) brightness(0.9)" : undefined,
            boxShadow: "inset 0 3px 12px rgba(16,42,86,0.2), inset 0 0 0 1.5px rgba(255,255,255,0.75)" }}
          onPointerDown={role === "edit" ? onDown : undefined} onPointerMove={role === "edit" ? onMove : undefined} onPointerUp={role === "edit" ? onUp : undefined} onPointerCancel={role === "edit" ? onUp : undefined}
          onClick={role === "target" ? e => tapTarget(cellAt(e, e.currentTarget)) : undefined}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: "rgba(255,255,240,0.95)", boxShadow: "0 0 14px 5px rgba(255,255,235,0.85)" }} />
          {Array.from({ length: N - 1 }, (_, k) => (   // glass shelves
            <div key={k} className="pointer-events-none absolute inset-x-0" style={{ top: (k + 1) * c - 2, height: small ? 2 : 4, background: "linear-gradient(rgba(255,255,255,0.95), rgba(150,192,238,0.55))", boxShadow: "0 2px 3px rgba(16,42,86,0.10)" }} />
          ))}
          {pills.map(p => (
            <Pill key={`${p.s}-${justFound.has(p.s) ? fx!.id : 0}`} p={p} c={c} found={own && G.found[s].some(f => f.s === p.s)} pop={justFound.has(p.s)}
              sel={role === "edit" && sel === p.s} faded={role === "edit" && ghost?.p.s === p.s} />
          ))}
          {role === "target" && phase === "over" && opp === "cpu" && (G.layout[s] ?? []).filter(p => !G.found[s].some(f => f.s === p.s)).map(p => <Pill key={`left${p.s}`} p={p} c={c} faded />)}
          {role === "edit" && ghost && <Pill p={ghost.p} c={c} ghost bad={!ghost.ok} />}
          {marks}
          {justFound.size > 0 && fx!.cells.filter(x => x.sunk).flatMap(x => cellsOf(x.sunk!)).map((i, k) => (
            <span key={`sp${fx!.id}-${i}`} className="fr-spark pointer-events-none absolute text-center" style={{ ...at(i, c), fontSize: c * 0.45, lineHeight: `${c}px`, animationDelay: `${k * 60}ms` }}>✨</span>
          ))}
          {preview.length > 0 && role === "target" && preview.map(i => (
            <span key={`pv${i}`} className="fr-aim pointer-events-none absolute rounded-[22%]" style={{ ...at(i, c * 0.92), boxShadow: armed === "light" ? "0 0 0 3px #f0b429, 0 0 14px rgba(255,214,90,0.8)" : "0 0 0 3px #4aa3ff, 0 0 14px rgba(120,190,255,0.8)", background: armed === "light" ? "rgba(255,240,180,0.45)" : "rgba(190,225,255,0.45)" }} />
          ))}
          {pend.map(i => <span key={`pe${i}`} className="pointer-events-none absolute animate-pulse rounded-full bg-[#3f7fd6]/40" style={at(i, c * 0.4)} />)}
          {aim.map(i => <span key={`ai${i}`} className="fr-aim pointer-events-none absolute rounded-[24%]" style={{ ...at(i, c * 0.96), border: `${small ? 2 : 3}px solid #e8505b`, boxShadow: "0 0 10px 3px rgba(232,80,91,0.55)", background: "rgba(232,80,91,0.12)" }} />)}
        </div>
        {role === "target" && turnPop && popText && (
          <div key={turnPop.id} className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
            <span className="fr-turnpop game-font whitespace-nowrap uppercase text-white" style={{ fontSize: Math.min(46, (inner * 1.55) / popText.length), textShadow: outline(turnPop.mine ? "#15803f" : "#16264a") }}>
              {popText}</span>
          </div>
        )}
      </div>
    );
  };

  /** One side of the race: whose snacks have been found so far, each one ticked off as it's found. */
  const raceRow = (s: Side, label: string, col: typeof MINE) => {
    const n = G.found[s].length;
    return (
      <div data-snacks={s === target ? "target" : "own"}>
        <div className="flex items-baseline justify-between gap-1">
          <span className="game-font truncate text-[12px] uppercase leading-tight" style={{ color: col.lo }}>{label}</span>
          <span className="game-font text-[13px] leading-tight tabular-nums text-[#101b2e]">{n}/{SNACKS.length}</span>
        </div>
        <div className="mt-1 flex items-center gap-[3px]">
          {SNACKS.map((sn, k) => { const got = G.found[s].some(f => f.s === k); return (
            <span key={k} className="relative flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: got ? sn.color : "rgba(255,255,255,0.65)", boxShadow: got ? "inset 0 0 0 1.5px #2eaa6e" : "inset 0 0 0 1px rgba(16,42,86,0.08)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foodPng(sn.code)} alt={sn.name} title={sn.name} data-found={got ? "1" : "0"} className={`h-[18px] w-[18px] ${got ? "" : "opacity-30 grayscale"}`} />
              {got && <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#2eaa6e] text-[8px] font-bold leading-none text-white">✓</span>}
            </span>); })}
        </div>
      </div>
    );
  };

  const card = (children: ReactNode, solid = false) => (
    <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[22px] p-3 ${solid ? "bg-[#dce9fc]" : "bg-[#101b2e]/45"}`}>
      <div className="max-h-full w-full max-w-[340px] overflow-y-auto rounded-3xl bg-white p-5 text-center shadow-2xl">{children}</div>
      {fact && (phase === "over") && <FactCard fact={fact} />}
    </div>
  );
  const btn = "game-font w-full rounded-2xl bg-[linear-gradient(180deg,#5c9bf2,#3f7fd6)] py-3 text-[19px] text-white shadow-[0_4px_0_#2a5ba8] active:translate-y-[2px] active:shadow-[0_2px_0_#2a5ba8] disabled:opacity-50";
  const btn2 = "game-font w-full rounded-2xl bg-[#e3effe] py-3 text-[19px] text-[#3f7fd6] shadow-[0_4px_0_#c3d7f3] active:translate-y-[2px] active:shadow-[0_2px_0_#c3d7f3]";
  const btnGo = "game-font w-full rounded-2xl bg-[linear-gradient(180deg,#46d98c,#22a964)] py-3 text-[21px] uppercase text-white shadow-[0_5px_0_#167a45] active:translate-y-[2px] active:shadow-[0_3px_0_#167a45]";
  const chip = "game-font flex-1 rounded-2xl bg-white py-2.5 text-[16px] text-[#3f7fd6] shadow-[0_4px_0_rgba(16,42,86,0.16)] active:translate-y-[2px] active:shadow-[0_2px_0_rgba(16,42,86,0.16)]";

  const liveCard = (): ReactNode => {
    if (opp !== "live" && offer) return card(<>
      <div className="game-font text-[24px] leading-tight text-[#101b2e]">Rejoin Your Game</div>
      <p className="mt-1 text-sm text-[#5a6b85]">You were in the middle of a live match in room {offer.code}.</p>
      <button onClick={() => rejoinNow(offer)} className={`mt-4 ${btn}`}>Rejoin</button>
      <button onClick={() => { forgetLive(); setOffer(null); }} className="mt-2 w-full py-2 text-sm font-semibold text-[#5a6b85]">No Thanks</button>
    </>);
    if (opp === "live" && room.status === "away") return card(<>
      <div className="game-font text-[24px] leading-tight text-[#101b2e]">{nameOf(1)} Stepped Away...</div>
      <div className="mt-1 text-sm font-semibold text-[#3f7fd6]">Waiting For {nameOf(1)} To Come Back</div>
      <div className="mt-2 text-4xl font-bold tabular-nums text-[#3f7fd6]">{Math.max(0, Math.ceil(((room.until ?? 0) - now) / 1000))}s</div>
      <p className="mt-2 text-sm text-[#5a6b85]">The game is paused. It picks up right where you left off when they&apos;re back.</p>
      <button onClick={() => { leaveRoom(); setJoinInput(""); go("idle"); }} className="mt-3 w-full py-2 text-sm font-semibold text-[#5a6b85]">Leave Room</button>
    </>);
    if (opp !== "live" || (room.status === "paired" && phase !== "idle")) return null;
    const code = room.code ?? "";
    if (room.status === "idle") return card(<>
      <div className="game-font text-[24px] leading-tight text-[#101b2e]">Play A Friend</div>
      <p className="mt-1 text-sm text-[#5a6b85]">Make a room and send your friend the link, or type their code.</p>
      <button onClick={() => joinRoom(newCode())} className={`mt-4 ${btn}`}>Make A Room</button>
      <div className="mt-4 flex gap-2">
        <input value={joinInput} onChange={e => setJoinInput(cleanCode(e.target.value))} placeholder="CODE" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
          className="min-w-0 flex-1 rounded-full border border-[#d6e2f5] px-4 py-2.5 text-center font-mono text-lg font-bold uppercase tracking-[0.3em] outline-none focus:border-[#3f7fd6]" />
        <button disabled={!validCode(joinInput)} onClick={() => joinRoom(joinInput)} className="rounded-full bg-[#101b2e] px-5 font-semibold text-white disabled:opacity-40">Join</button>
      </div>
      {joinInput.length === 4 && !validCode(joinInput) && <p className="mt-2 text-xs font-semibold text-[#d64545]">That code doesn&apos;t look right. Check it again.</p>}
    </>);
    if (room.status === "connecting") return card(<><div className="game-font text-[24px] leading-tight text-[#101b2e]">Joining Room {code}</div><p className="mt-2 text-sm text-[#5a6b85]">One moment...</p></>);
    if (room.status === "full") return card(<>
      <div className="game-font text-[24px] leading-tight text-[#101b2e]">Room Full</div>
      <p className="mt-1 text-sm text-[#5a6b85]">Room {code} already has two players. Make your own room instead.</p>
      <button onClick={() => { setRoom({ status: "idle" }); setJoinInput(""); }} className={`mt-4 ${btn}`}>Back</button>
    </>);
    if (room.status === "error") return card(<>
      <div className="game-font text-[24px] leading-tight text-[#101b2e]">Couldn&apos;t Connect</div>
      <p className="mt-1 text-sm text-[#5a6b85]">Check your connection and try again.</p>
      <button onClick={() => joinRoom(code)} className={`mt-4 ${btn}`}>Try Again</button>
      <button onClick={leaveRoom} className="mt-2 w-full py-2 text-sm font-semibold text-[#5a6b85]">Back</button>
    </>);
    // waiting: for a first friend, or for one who left to come back
    const left = !!pairedWith.current;
    return card(<>
      <div className="game-font text-[24px] leading-tight text-[#101b2e]">{left ? "Your Friend Left" : "Your Room"}</div>
      <p className="mt-1 text-sm text-[#5a6b85]">{left ? "Waiting for them to come back. If they rejoin, you'll start a fresh game." : "Send your friend the link, or have them type this code."}</p>
      <div className="mt-3 font-mono text-4xl font-bold tracking-[0.25em] text-[#101b2e]">{code}</div>
      <button onClick={() => shell.share(`Play Fridge Raid with me! Room ${code}\n${roomLink(code)}`)} className={`mt-4 ${btn}`}>{shell.copied ? "Link Copied!" : "Share The Link"}</button>
      <p className="mt-3 text-xs text-[#5a6b85]">Waiting For Your Friend To Join...</p>
      <button onClick={() => { leaveRoom(); setJoinInput(""); }} className="mt-1 w-full py-2 text-sm font-semibold text-[#5a6b85]">Leave Room</button>
    </>);
  };

  const overlay = (): ReactNode => {
    const live = liveCard(); if (live) return live;
    if (opp === "live" && phase === "gate" && room.status === "paired") return (
      <ReadyCard me={myName === "Guest" ? "You" : myName} friend={nameOf(1)} ready={[myOk, oppOk]} onReady={markOk}
        onLeave={() => { leaveRoom(); setJoinInput(""); go("idle"); }} steps={[
          "First, hide your five snacks in your fridge.",
          "Take turns tapping a shelf in their fridge. A bite earns another shot; ice passes the turn.",
          "Once a round: the Fridge Light shows a 2×2 patch, the Freezer Blast bites 3 in a row.",
          "Find all their snacks before they find yours. You get 45 seconds a turn.",
        ]} />
    );
    if (opp === "cpu" && phase === "over" && final) {
      const headline = final.won ? `You Raided The Fridge In ${final.shots} Shots! 🎉`
        : mode === "daily" ? "The Computer Found Your Snacks First" : round > 1 ? `Round ${round}: The Computer Found Your Snacks First` : "The Computer Found Your Snacks First";
      return <GameOver label={mode === "daily" ? `Today's Challenge #${n}` : "Free Play"} headline={headline} score={final.score} best={best} mode={mode}
        posted={shell.scores.posted} joined={!!shell.player} campaign={GAME} copied={shell.copied} fact={fact}
        pitch="What's in your fridge matters too. WhatYouAte shows you how your meals affect your energy."
        onBoard={() => shell.setBoardOpen(true)} onJoin={() => shell.setJoinOpen(true)}
        onAgain={() => (mode === "daily" ? pickMode("endless") : setRun(r => r + 1))} onShare={() => shareCpu(final)} />;
    }
    if (opp === "cpu" && phase === "doneToday" && final) return card(<>
      <div className="text-sm font-semibold text-[#5a6b85]">Today&apos;s Challenge #{n}</div>
      <div className="game-font mt-1 text-[24px] leading-tight text-[#101b2e]">Today&apos;s Fridge Is Raided</div>
      <div className="mt-1 text-4xl font-bold tabular-nums">{final.score.toLocaleString()}</div>
      <p className="text-sm text-[#5a6b85]">{final.won ? `You won in ${final.shots} shots.` : "The computer won this one."} New fridge at midnight.</p>
      <div className="mt-4 flex gap-2">
        <button onClick={() => pickMode("endless")} className={btn}>Free Play</button>
        <button onClick={() => shareCpu(final)} className={btn2}>{shell.copied ? "Copied!" : "Share"}</button>
      </div>
      <button onClick={() => shell.setBoardOpen(true)} className="mt-3 text-sm font-semibold text-[#3f7fd6]">🏆 See Today&apos;s Scoreboard</button>
    </>);
    if (opp === "cpu" && phase === "roundWon") return card(<>
      <div className="text-sm font-semibold text-[#5a6b85]">Free Play</div>
      <div className="game-font mt-1 text-[24px] leading-tight text-[#101b2e]">Round {round} Won! 🎉</div>
      <p className="mt-1 text-sm text-[#5a6b85]">Found every snack in {G.shots[0]} shots. +{G.roundScore.toLocaleString()} points.</p>
      <div className="mt-2 text-3xl font-bold tabular-nums">{total.current.toLocaleString()}</div>
      <p className="text-xs text-[#5a6b85]">The computer gets a little sharper next round.</p>
      <button onClick={() => startCpu(G.layout[0], round + 1)} className={`mt-4 ${btn}`}>Next Round</button>
    </>);
    if (opp === "phone" && phase === "names") return card(<>
      <div className="game-font text-[24px] leading-tight text-[#101b2e]">Same Phone</div>
      <p className="mt-1 text-sm text-[#5a6b85]">Take turns on this phone. Who&apos;s playing?</p>
      {[0, 1].map(k => (
        <input key={k} value={names[k]} maxLength={14} placeholder={k === 0 ? (shell.player?.name || "Player 1") : "Player 2"}
          onChange={e => setNames(nm => (k === 0 ? [e.target.value, nm[1]] : [nm[0], e.target.value]))}
          className="mt-3 w-full rounded-xl border border-[#d6e2f5] px-3 py-2.5 text-base outline-none focus:border-[#3f7fd6]" />
      ))}
      <button onClick={() => { const a = names[0].trim() || shell.player?.name || "Player 1", b = names[1].trim() || "Player 2"; setNames([a, b]); startPhone(1, a); }} className={`mt-4 ${btn}`}>Start</button>
    </>);
    if (opp === "phone" && phase === "pass") {
      const to = nameOf(pass.to), from = nameOf(other(pass.to));
      return card(<>
        <div className="text-4xl">📱</div>
        <div className="game-font mt-2 text-[24px] leading-tight text-[#101b2e]">Pass The Phone To {to}</div>
        <p className="mt-1 text-sm text-[#5a6b85]">{from}, No Peeking!</p>
        <button onClick={takePhone} className={`mt-4 ${btn}`}>I&apos;m {to}, Show Me</button>
      </>, true);
    }
    if (opp !== "cpu" && phase === "over" && winner !== null) {
      const w = nameOf(winner), l = nameOf(other(winner));
      const head = opp === "live" ? (winner === 0 ? "You Win! 🎉" : `${w} Wins`) : `${w} Wins! 🎉`;
      return card(<>
        <div className="text-sm font-semibold text-[#5a6b85]">{opp === "phone" ? "Same Phone" : "Play A Friend"}</div>
        <div className="game-font mt-1 text-[30px] leading-tight text-[#101b2e]">{head}</div>
        <p className="mt-1 text-sm text-[#5a6b85]">{opp === "live" && winner === 1 ? `${w} found all your snacks in ${G.shots[1]} shots.` : `Found all of ${l}'s snacks in ${G.shots[winner]} shots.`}</p>
        {theyWantRematch && <p className="mt-2 rounded-2xl bg-[#e3effe] px-3 py-2 text-sm font-semibold text-[#3f7fd6]">{nameOf(1)} Wants A Rematch!</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={() => (opp === "phone" ? startPhone(round + 1) : startLiveRound(round + 1))} className={btn}>Rematch</button>
          <button onClick={() => shareDuel(winner)} className={btn2}>{shell.copied ? "Copied!" : "Share"}</button>
        </div>
        <button onClick={() => { if (opp === "phone") go("names"); else { leaveRoom(); setJoinInput(""); } }} className="mt-2 w-full py-2 text-sm font-semibold text-[#5a6b85]">
          {opp === "phone" ? "Change Players" : "Leave Room"}</button>
      </>);
    }
    return null;
  };

  // the power-ups: two cards that say what they do (with the shape they cover). Picking one swaps the row for its aim
  // controls: cancel, turn (the blast), and a big button to use it once it's aimed (tapping the aim again works too).
  const powerBar = () => {
    const used = G.used[pov];
    const pick = (k: "light" | "blast") => {
      if (!canAct || used[k]) return;
      if (armed === k) { clearAim(); setMsg("Tap A Shelf In Their Fridge."); return; }
      setArmed(k); setAimAt(null); setMsg(k === "light" ? "Tap Where To Shine The Light." : "Tap Where To Blast.");
    };
    if (armed) {
      const light = armed === "light";
      return (
        <div className="flex items-center gap-2" style={{ height: BAR }}>
          <button onClick={() => { clearAim(); setMsg("Tap A Shelf In Their Fridge."); }} aria-label="Put it back"
            className="game-font flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[20px] text-[#5a6b85] shadow-[0_4px_0_rgba(16,42,86,0.16)]">✕</button>
          {!light && (
            <button onClick={() => setAimAt(a => (a ? { ...a, v: !a.v } : { at: 3 * N + 3, v: true }))} aria-label="Turn the blast"
              className="game-font flex h-12 shrink-0 items-center rounded-2xl bg-[#dff0ff] px-3 text-[16px] text-[#1f5fa8] shadow-[0_4px_0_#b8d9f7]">{aimAt?.v ? "↕" : "↔"} Turn</button>
          )}
          <button disabled={!aimAt || !canAct} onClick={() => aimAt && tapTarget(aimAt.at)}
            className={`game-font flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl text-[18px] uppercase disabled:opacity-60 ${light ? "bg-[linear-gradient(180deg,#ffe066,#f5b82e)] text-[#6b4300] shadow-[0_4px_0_#c98f12]" : "bg-[linear-gradient(180deg,#8fd0ff,#4aa3ff)] text-white shadow-[0_4px_0_#2f7fcf]"}`}>
            <ToolIcon k={armed} size={24} />
            <span className="truncate">{aimAt ? POWER[armed].use : "Tap Their Fridge"}</span>
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-stretch gap-2" style={{ height: BAR }}>
        {(["light", "blast"] as const).map(k => {
          const gone = used[k];
          return (
            <button key={k} onClick={() => pick(k)} disabled={gone || !canAct}
              className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-2xl px-2 text-left transition ${gone ? "bg-white/40" : "bg-white shadow-[0_4px_0_rgba(16,42,86,0.16),0_8px_16px_-8px_rgba(16,42,86,0.35)]"} ${!canAct && !gone ? "opacity-60" : ""}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[19px] ${gone ? "opacity-40 grayscale" : ""}`}
                style={{ background: k === "light" ? "linear-gradient(180deg,#fff4c7,#ffe08a)" : "linear-gradient(180deg,#e6f4ff,#bfe2ff)" }}><ToolIcon k={k} size={26} /></span>
              <span className="min-w-0 flex-1">
                <span className={`game-font block truncate text-[15px] leading-tight ${gone ? "text-[#9aa6b8]" : "text-[#101b2e]"}`}>{POWER[k].name}</span>
                <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold leading-tight text-[#5a6b85]">
                  {!gone && <Pattern k={k} />}<span className="truncate">{gone ? "Used This Round" : POWER[k].tip}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  const placeControls = () => (
    <div className="flex flex-col justify-center gap-2" style={{ height: LOWH, width: N * cP + 2 * FR + HANDLE }}>
      <p className="text-center text-xs text-[#5a6b85]">{sel === null ? "Drag A Snack To Move It. Tap It Twice To Turn It." : `${SNACKS[sel].name}: Drag It, Tap An Empty Shelf, Or Tap Turn.`}</p>
      <div className="flex gap-2">
        <button onClick={shuffle} className={chip}>🔀 Shuffle</button>
        <button onClick={() => sel !== null && turnSnack(sel)} disabled={sel === null} className={`${chip} disabled:opacity-40`}>↻ Turn</button>
      </div>
      <button onClick={ready} className={btnGo}>I&apos;m Ready</button>
    </div>
  );
  const liveWaiting = () => (
    <div className="flex flex-col items-center justify-center gap-2 text-center" style={{ height: LOWH, width: N * cP + 2 * FR + HANDLE }}>
      <div className="text-sm font-semibold">{room.opp && room.opp.round < round ? `Waiting For ${nameOf(1)} To Say Rematch` : "Waiting For Your Friend To Hide Their Snacks"}</div>
      <div className="flex gap-1">{[0, 1, 2].map(k => <span key={k} className="h-2 w-2 animate-pulse rounded-full bg-[#3f7fd6]" style={{ animationDelay: `${k * 200}ms` }} />)}</div>
      <button onClick={() => { readyRef.current = false; setMyReady(false); setMeta({ ready: false }); setMsg("Hide Your Snacks, Then Tap Ready."); }} className="text-xs font-semibold text-[#5a6b85]">Move My Snacks</button>
    </div>
  );

  const playing = phase === "play" || phase === "over" || phase === "roundWon";
  const board = (): ReactNode => {
    if (phase === "place") return (
      <div className="flex flex-col items-center" style={{ gap: GAP }}>
        {fridge(pov, cP, placing ? "edit" : "own")}
        {placing ? placeControls() : liveWaiting()}
      </div>
    );
    if (playing) {
      const bigW = N * cB + 2 * FR + HANDLE, rowW = Math.max(bigW, Math.min(area.w, 400));   // on short phones the fridge narrows; the rows under it don't

      return (
        <div className="flex flex-col items-center" style={{ gap: GAP }}>
          {fridge(target, cB, "target")}
          <div style={{ width: rowW }}>{powerBar()}</div>
          <div className="flex items-start gap-3" style={{ width: rowW }}>
            {fridge(pov, cS, "own", true)}
            <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
              {raceRow(target, "You Found", MINE)}
              {raceRow(pov, opp === "cpu" ? "Computer Found" : nameOf(target) === "Your Friend" ? "Friend Found" : `${nameOf(target)} Found`, THEIRS)}
              <div className="text-[11px] font-semibold tabular-nums text-[#5a6b85]">Shots {G.shots[pov]} · Bites {G.hits[pov]}</div>
            </div>
          </div>
        </div>
      );
    }
    return <div className="rounded-[18px] bg-white/60" style={{ width: Math.min(area.w, N * cP + 2 * FR + HANDLE), height: N * cP + FR + HEAD }} />;
  };

  return (
    <GameScreen>
      <GameHeader title="Fridge Raid" mode={mode} onMode={pickMode} onBoard={() => shell.setBoardOpen(true)} onHelp={shell.help.show} />

      <div className="mt-2 flex h-8 shrink-0 rounded-full bg-white/70 p-0.5 text-xs font-semibold">
        {([["cpu", "Computer"], ["phone", "Same Phone"], ["live", "Play A Friend"]] as [Opp, string][]).map(([o, label]) => (
          <button key={o} onClick={() => pickOpp(o)} className={`flex-1 rounded-full ${opp === o ? "bg-[#101b2e] text-white" : "text-[#3f7fd6]"}`}>{label}</button>
        ))}
      </div>

      {phase === "play" || phase === "place" ? (
        // the turn banner: green while it's yours, dark while it's theirs, blue while hiding snacks
        <div className="mt-2 flex h-[54px] shrink-0 items-center gap-2 rounded-2xl px-3 transition-colors duration-300"
          style={{ background: phase === "place" ? "linear-gradient(180deg,#5c9bf2,#3f7fd6)" : myTurn ? "linear-gradient(180deg,#46d98c,#22a964)" : "linear-gradient(180deg,#2c4274,#172a52)",
            boxShadow: `0 4px 0 ${phase === "place" ? "#2a5ba8" : myTurn ? "#167a45" : "#0b1630"}` }}>
          <div className="min-w-0 flex-1">
            <div className="game-font flex items-baseline gap-1 truncate text-[22px] uppercase leading-none text-white" style={{ textShadow: "0 2px 0 rgba(0,0,0,0.18)" }}>
              <span className="truncate">{phase === "place" ? (placing ? "Hide Your Snacks" : "Get Set") : myTurn ? "Your Turn" : opp === "cpu" ? "Computer's Turn" : `${nameOf(other(pov))}'s Turn`}</span>
              {phase === "play" && !myTurn && <span className="shrink-0">{[0, 1, 2].map(k => <span key={k} className="fr-dot" style={{ animationDelay: `${k * 0.2}s` }}>.</span>)}</span>}
            </div>
            <div className="mt-1 text-[12px] font-semibold leading-tight text-white/90" style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {phase === "place" ? (placing && !msg.startsWith("Round") ? "Then Tap I'm Ready To Start." : msg) : msg.replace(/^Your Turn\.\s*/, "")}</div>
          </div>
          {opp === "cpu" && phase === "play" && (
            <div className="shrink-0 text-right">
              <div className="text-[9px] font-bold uppercase tracking-wide text-white/75">Score</div>
              <div className="game-font text-[20px] leading-none tabular-nums text-white">{scoreNow.toLocaleString()}</div>
            </div>
          )}
          {opp === "cpu" && <PauseButton shell={shell} active={phase === "play"} />}
          {opp === "live" && phase === "play" && (
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full" aria-label={`${secsLeft} seconds left`}
              style={{ background: `conic-gradient(${secsLeft <= 10 ? "#ff5d6c" : "#ffffff"} ${(secsLeft / (TURN_MS / 1000)) * 360}deg, rgba(255,255,255,0.22) 0)` }}>
              <div className="game-font flex h-[32px] w-[32px] items-center justify-center rounded-full text-[15px] tabular-nums text-white" style={{ background: myTurn ? "#22a964" : "#172a52" }}>{secsLeft}</div>
            </div>
          )}
        </div>
      ) : (
      <div className="mt-2 flex h-10 shrink-0 items-center gap-2">
        <div className="w-16 shrink-0">
          {opp === "cpu" ? (<><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Score</div><div className="text-xl font-bold leading-none tabular-nums">{scoreNow.toLocaleString()}</div></>)
            : (<><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">{opp === "phone" ? "Round" : "Shots"}</div><div className="text-xl font-bold leading-none tabular-nums">{opp === "phone" ? round : G.shots[0]}</div></>)}
        </div>
        <div className="min-w-0 flex-1 text-center text-[13px] font-semibold leading-tight text-[#101b2e]" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{msg}</div>
        <div className="flex min-w-16 shrink-0 justify-end">
          {opp === "cpu" && <PauseButton shell={shell} active={false} />}
        </div>
      </div>
      )}

      <BoardArea wrapRef={wrapRef} size={area} reserve={0}>
        <div className="flex h-full w-full justify-center">{board()}</div>
        {opp === "cpu" && <PrizeLogo shell={shell} active={phase === "play" && !shell.paused} />}
        {opp === "cpu" && <PausedCard shell={shell} active={phase === "play"} />}
        {overlay()}
        {opp === "live" && reconnecting && room.status !== "away" && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
            <div className="rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-[#3f7fd6] shadow-md">Reconnecting...</div>
          </div>
        )}
        <style>{FX_CSS + GAME_FONT_CSS}</style>
      </BoardArea>

      <ShellPopups shell={shell} game={GAME} todayNote="Today's Challenge: same computer fridge for everyone. Resets at midnight." />

      {shell.help.open && (
        <HelpModal onClose={shell.help.close} steps={[
          "Hide your snacks in your fridge. Drag to move, tap twice to turn, or tap Shuffle.",
          "Take turns tapping a shelf in the other fridge. A bite shows what you hit and earns another shot. Ice passes the turn.",
          <span key="p">Once a round: <ToolIcon k="light" size={16} inline /> <b>Fridge Light</b> shows a 2×2 patch, <ToolIcon k="blast" size={16} inline /> <b>Freezer Blast</b> bites 3 in a row. Tap a shelf to aim, then tap Shine Here or Blast Here.</span>,
          "Find all their snacks before they find yours.",
        ]}>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-[#f0f6fe] p-2">
            {SNACKS.map(s => (
              <span key={s.code} className="flex rounded-full px-1" style={{ background: s.color }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {Array.from({ length: s.len }, (_, k) => <img key={k} src={foodPng(s.code)} alt={k === 0 ? s.name : ""} className="h-4 w-4" />)}
              </span>
            ))}
          </div>
          <ModesHelp today="everyone raids the same computer fridge today. Fewer shots, more points." free="win round after round. Your score adds up until you lose one." />
          <div className="mt-1.5 space-y-1.5 text-sm">
            <p><b>Same Phone</b> or <b>Play A Friend:</b> take turns on one phone, or play live on two.</p>
          </div>
        </HelpModal>
      )}
    </GameScreen>
  );
}

// the fridge's cool, lightly frosted inside: a soft light from the top, frosty corners, a faint frost speckle
const INTERIOR = [
  "radial-gradient(ellipse at 50% -12%, rgba(255,255,255,0.95), rgba(255,255,255,0) 58%)",
  "radial-gradient(circle at 0 100%, rgba(255,255,255,0.75), transparent 24%)",
  "radial-gradient(circle at 100% 100%, rgba(255,255,255,0.65), transparent 22%)",
  "radial-gradient(circle at 100% 0, rgba(255,255,255,0.55), transparent 18%)",
  "radial-gradient(rgba(255,255,255,0.55) 0.7px, transparent 1.3px) 0 0 / 7px 7px",
  "linear-gradient(90deg, rgba(63,127,214,0.05) 1px, transparent 1px) 0 0 / calc(100% / 7) 100%",
  "linear-gradient(#ecf6ff, #d3e6fa)",
].join(", ");
const FX_CSS = `
.fr-puff { animation: fr-puff 0.6s ease-out forwards }
@keyframes fr-puff { 0% { transform: scale(0.2); opacity: 0.95 } 100% { transform: scale(1.35); opacity: 0 } }
.fr-shake { animation: fr-shake 0.45s ease-in-out }
@keyframes fr-shake { 0%, 100% { transform: translateX(0) } 20% { transform: translateX(-3px) rotate(-4deg) } 40% { transform: translateX(3px) rotate(4deg) } 60% { transform: translateX(-2px) } 80% { transform: translateX(2px) } }
.fr-pop { animation: fr-pop 0.55s cubic-bezier(.3,1.6,.5,1) }
@keyframes fr-pop { 0% { transform: scale(0.6); opacity: 0.4 } 60% { transform: scale(1.12) } 100% { transform: scale(1); opacity: 1 } }
.fr-spark { animation: fr-spark 0.9s ease-out forwards; opacity: 0 }
@keyframes fr-spark { 0% { transform: translateY(0) scale(0.4); opacity: 0 } 30% { opacity: 1 } 100% { transform: translateY(-14px) scale(1.1); opacity: 0 } }
.fr-glow { animation: fr-glow 0.8s ease-out }
@keyframes fr-glow { 0% { transform: scale(0.7); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
.fr-aim { animation: fr-aim 0.5s ease-in-out infinite alternate }
.fr-go { animation: fr-go 1.1s ease-in-out infinite }
@keyframes fr-go { 0%, 100% { box-shadow: 0 0 0 0 rgba(61,220,132,0.6); opacity: 1 } 50% { box-shadow: 0 0 0 8px rgba(61,220,132,0); opacity: 0.7 } }
.fr-alert { animation: fr-alert 0.9s ease-in-out infinite }
@keyframes fr-alert { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,93,108,0.6) } 50% { box-shadow: 0 0 0 6px rgba(255,93,108,0) } }
.fr-blink { animation: fr-blink 1.1s ease-in-out infinite }
@keyframes fr-blink { 0%, 100% { opacity: 1 } 50% { opacity: 0.55 } }
.fr-dot { animation: fr-dot 1s ease-in-out infinite }
@keyframes fr-dot { 0%, 100% { opacity: 0.25 } 50% { opacity: 1 } }
.fr-turnpop { display: inline-block; animation: fr-turnpop 1.2s cubic-bezier(.2,.9,.3,1) forwards }
@keyframes fr-turnpop { 0% { transform: scale(0.4) rotate(-4deg); opacity: 0 } 18% { transform: scale(1.12) rotate(-3deg); opacity: 1 } 28% { transform: scale(1) rotate(-3deg) } 78% { transform: scale(1) rotate(-3deg); opacity: 1 } 100% { transform: scale(1.06) rotate(-3deg); opacity: 0 } }
@keyframes fr-aim { 0% { transform: scale(0.85); opacity: 0.6 } 100% { transform: scale(1.02); opacity: 1 } }
`;

function Pill({ p, c, found, pop, sel, ghost, bad, faded }: { p: Placed; c: number; found?: boolean; pop?: boolean; sel?: boolean; ghost?: boolean; bad?: boolean; faded?: boolean }) {
  const s = SNACKS[p.s], L = s.len, ins = Math.max(1, Math.round(c * 0.08));
  return (
    <div className={`pointer-events-none absolute flex items-center justify-around rounded-full ${pop ? "fr-pop" : ""}`}
      style={{ left: p.c * c + ins, top: p.r * c + ins, width: (p.v ? 1 : L) * c - 2 * ins, height: (p.v ? L : 1) * c - 2 * ins, flexDirection: p.v ? "column" : "row",
        background: bad ? "#ffd9dc" : `linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0) 55%), ${s.color}`, opacity: found ? 0.5 : ghost ? 0.75 : faded ? 0.35 : 1, filter: found ? "grayscale(0.6)" : undefined,
        boxShadow: sel ? "0 0 0 2.5px #3f7fd6" : bad ? "0 0 0 2px #e8505b" : ghost ? "0 0 0 2px #2eaa6e" : pop ? "0 0 0 2px #2eaa6e, 0 4px 12px rgba(46,170,110,0.35)" : "inset 0 0 0 1px rgba(16,27,46,0.10), 0 2px 4px rgba(16,42,86,0.12)" }}>
      {Array.from({ length: L }, (_, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={k} src={foodPng(s.code)} alt={k === 0 ? s.name : ""} draggable={false} style={{ width: c * 0.68, height: c * 0.68 }} />
      ))}
    </div>
  );
}

/** A bite taken out of one of your own snacks. */
function Bite({ c }: { c: number }) {
  return (
    <svg viewBox="0 0 40 40" width={c} height={c} className="absolute inset-0" aria-hidden>
      <circle cx="30" cy="10" r="11" fill="#eaf4ff" />
      <circle cx="21" cy="7" r="4" fill="#eaf4ff" /><circle cx="33" cy="19" r="4" fill="#eaf4ff" />
      <circle cx="30" cy="10" r="11" fill="none" stroke="rgba(232,80,91,0.55)" strokeWidth="2" strokeDasharray="3 3" />
    </svg>
  );
}

function FactCard({ fact }: { fact: Toast }) {
  return (
    <div className="flex w-full max-w-[340px] shrink-0 items-start gap-2 rounded-2xl bg-white/95 px-3 py-2 text-left shadow-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={foodPng(fact.img)} alt="" className="mt-0.5 h-7 w-7" />
      <div className="min-w-0 flex-1"><div className="text-xs font-bold text-[#3f7fd6]">{fact.title}</div><div className="text-[13px] leading-snug">{fact.body}</div></div>
    </div>
  );
}

/** The cells a power-up covers, as a tiny diagram: 2x2 for the light, 3 in a row for the blast. */
function Pattern({ k }: { k: "light" | "blast" }) {
  const cols = k === "light" ? 2 : 3, rows = k === "light" ? 2 : 1, col = k === "light" ? "#f0b429" : "#4aa3ff";
  return (
    <span className="grid shrink-0 gap-[2px]" style={{ gridTemplateColumns: `repeat(${cols}, 5px)` }} aria-hidden>
      {Array.from({ length: cols * rows }, (_, i) => <span key={i} className="h-[5px] w-[5px] rounded-[1.5px]" style={{ background: col }} />)}
    </span>
  );
}

/** A chunky outline for display text (text-shadow in eight directions, plus a drop). */
function outline(c: string, o = 2.5) {
  const d = o * 0.7;
  return [`${o}px 0 0 ${c}`, `-${o}px 0 0 ${c}`, `0 ${o}px 0 ${c}`, `0 -${o}px 0 ${c}`, `${d}px ${d}px 0 ${c}`, `-${d}px ${d}px 0 ${c}`, `${d}px -${d}px 0 ${c}`, `-${d}px -${d}px 0 ${c}`, `0 ${o + 3}px 0 ${c}`].join(", ");
}

/** The two tools, drawn: the fridge's own light bulb, glowing, and a burst of frost. */
function ToolIcon({ k, size, inline }: { k: "light" | "blast"; size: number; inline?: boolean }) {
  const cls = inline ? "inline-block align-[-3px]" : "block";
  if (k === "light") return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={cls} aria-hidden>
      <defs>
        <radialGradient id="frBulb" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#fffbe6" /><stop offset="0.55" stopColor="#ffe066" /><stop offset="1" stopColor="#f5b100" /></radialGradient>
      </defs>
      <g stroke="#f5b100" strokeWidth="2" strokeLinecap="round" opacity="0.9">
        <path d="M16 1.8v2.6M5.6 6.2l1.9 1.8M26.4 6.2l-1.9 1.8M2 15.4h2.6M27.4 15.4H30" />
      </g>
      <path d="M16 6.2c-5 0-8.6 3.8-8.6 8.4 0 3.1 1.6 5.2 3.3 6.9.9.9 1.4 2 1.4 3.2v.5h7.8v-.5c0-1.2.5-2.3 1.4-3.2 1.7-1.7 3.3-3.8 3.3-6.9 0-4.6-3.6-8.4-8.6-8.4z" fill="url(#frBulb)" stroke="#c98a00" strokeWidth="1.2" />
      <path d="M12.6 12.4c.6-1.8 2.2-3 4-3.2" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.9" />
      <rect x="11.9" y="25.6" width="8.2" height="2.6" rx="1.2" fill="#9aa6b8" />
      <rect x="12.6" y="28" width="6.8" height="2.4" rx="1.2" fill="#7c889c" />
    </svg>
  );
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={cls} aria-hidden>
      <circle cx="16" cy="16" r="13" fill="#e9f6ff" stroke="#9fd2ff" strokeWidth="1.4" strokeDasharray="2.6 2.4" />
      <g stroke="#2f8de4" strokeWidth="2.3" strokeLinecap="round" fill="none">
        {[0, 60, 120].map(a => (
          <g key={a} transform={`rotate(${a} 16 16)`}>
            <path d="M16 5.5v21" />
            <path d="M12.8 8.2 16 10.6l3.2-2.4M12.8 23.8 16 21.4l3.2 2.4" />
          </g>
        ))}
      </g>
      <circle cx="16" cy="16" r="2.4" fill="#ffffff" stroke="#2f8de4" strokeWidth="1.6" />
    </svg>
  );
}
