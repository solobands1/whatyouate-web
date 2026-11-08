"use client";

// Fridge Raid: hide five snacks in your fridge, then take turns guessing where the other side's snacks are. A hit
// leaves a bite, a miss finds only ice; find every cell of a snack and it's revealed. First to find all of the other
// side's snacks wins. Three ways to play:
//  - Computer: Today (everyone raids the same computer fridge, and the computer's guesses follow the same seeded
//    order) or Free Play (round after round, the computer a little sharper each time, score adds up until you lose).
//    The computer hunts like a person would: random-ish until a hit, then the neighbours, then along the line, with
//    some slips so it's beatable. It only ever uses what it has seen. Scores post to the scoreboard.
//  - Same Phone: two names, pass the phone between turns behind a "no peeking" card. No scoreboard.
//  - Play A Friend: a 4-letter room over Supabase Realtime (channel "fridge-raid:ABCD", presence for who's in).
//    Each phone keeps its own fridge private: the shooter sends {r, c}, the defender answers hit / found / game over.
// The computer's balance and the Today seed were checked with a headless sim of the rules block below.
/* eslint-disable react-hooks/refs, react-hooks/purity, react-hooks/immutability, react-hooks/set-state-in-effect --
   Turn-based, so the match lives in one mutable object (g.current) that handlers, timers and Realtime callbacks all
   update, then bump() re-renders. The canvas games do the same inside their effect closures, out of the linter's sight. */
import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sb } from "@/components/creators/api";
import { type Mode, type Toast, GameScreen, GameHeader, BoardArea, PrizeLogo, GameOver, PauseButton, PausedCard, HelpModal, ModesHelp, ShellPopups,
  useGameShell, dailySeed, dailyNumber, torontoDate, mulberry32, readBest, saveBest, foodPng, emoji } from "./kit";

const GAME = "fridge-raid";
const LAUNCH = "2026-11-08";                 // Today's Challenge #1
const LAYOUT_SALT = 0x6f1d9, AI_SALT = 0x2b7e3;

// ── rules (pure: no React, no DOM; the headless balance check runs this block as-is) ──── RULES START
const N = 8;
type Snack = { name: string; code: string; len: number; color: string; facts: string[] };
const SNACKS: Snack[] = [
  { name: "Baguette", code: "1f956", len: 4, color: "#f6e0b8", facts: [
    "Bread goes stale faster in the fridge than on the counter. The freezer is the place to keep it.",
    "A traditional French baguette is made with just flour, water, salt and yeast.",
    "In 2022, UNESCO added the craft of French baguette baking to its list of cultural heritage."] },
  { name: "Carrot", code: "1f955", len: 3, color: "#ffdcc2", facts: [
    "Cooking carrots makes their beta-carotene easier for your body to absorb.",
    "Early carrots were purple or yellow. Orange carrots caught on in Europe in the 1600s.",
    "Cut the green tops off before you store carrots. The leaves pull moisture out of the roots."] },
  { name: "Cucumber", code: "1f952", len: 3, color: "#d6f1c9", facts: [
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
type Placed = { s: number; r: number; c: number; v: boolean };   // snack index, top-left cell, vertical?
type Answer = { hit: boolean; sunk: Placed | null; over: boolean };

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
/** The defender's side of a shot: marks it on their fridge (2 = bitten, 1 = ice) and says what it found. */
function answerShot(layout: Placed[], inc: Int8Array, i: number): Answer {
  const p = layout.find(q => cellsOf(q).includes(i)) ?? null;
  inc[i] = p ? 2 : 1;
  if (!p) return { hit: false, sunk: null, over: false };
  const sunk = cellsOf(p).every(k => inc[k] === 2) ? p : null;
  return { hit: true, sunk, over: layout.every(q => cellsOf(q).every(k => inc[k] === 2)) };
}
/** The computer's next guess, from what it can see: its shots so far (inc) and the snacks it has found. Never peeks.
 *  skill 0..1: how often it follows a line it has started and hunts on a checkerboard, rather than slipping. */
function aiPick(inc: Int8Array, found: Placed[], rnd: () => number, skill: number): number {
  const done = new Set(found.flatMap(cellsOf));
  const open = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N && inc[r * N + c] === 0;
  const live = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N && inc[r * N + c] === 2 && !done.has(r * N + c);
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
// Scoring (vs computer): a hit is 15, plus 10 for each hit in a row before it (up to 55); finding a snack adds 40 plus
// 10 a cell; a win adds 400, 35 for every shot under 64, and 15 for each of your snack cells the computer never found.
// So a fast win scores far more than a slow one, good hiding counts too, and ties are rare.
const hitPoints = (streak: number) => 15 + 10 * Math.min(4, streak - 1);
const foundPoints = (s: number) => 40 + 10 * SNACKS[s].len;
const winBonus = (shots: number, mine: Placed[], inc: Int8Array) => 400 + 35 * Math.max(0, N * N - shots) + 15 * mine.flatMap(cellsOf).filter(k => inc[k] !== 2).length;
const SKILL_TODAY = 0.55, SKILL_FREE = 0.45, SKILL_STEP = 0.1;   // Free Play: round 1 is gentle, then sharper each round
// ───────────────────────────────────────────────────────────────────────────────────────── RULES END

type Opp = "cpu" | "phone" | "live";
type Side = 0 | 1;
type Phase = "idle" | "names" | "pass" | "place" | "play" | "roundWon" | "over" | "doneToday";
type Game = {
  layout: [Placed[], Placed[] | null];       // [me or player 1, the other side]; null = a friend's phone keeps it
  inc: [Int8Array, Int8Array];               // shots each side has taken from (0 none, 1 ice, 2 bite)
  found: [Placed[], Placed[]];               // snacks found on each side
  shots: [number, number]; hits: [number, number]; streak: [number, number]; bestStreak: [number, number];
  log: [string[], string[]];                 // each side's shots as share squares
  turn: Side; turnNo: number; turnAt: number;
  last: [number, number];                    // the newest shot on each side's fridge, for the little pop
  lastFound: number | null;                  // snack found last, for the game-over fact
  roundScore: number;
};
const newGame = (a: Placed[], b: Placed[] | null): Game => ({
  layout: [a, b], inc: [new Int8Array(N * N), new Int8Array(N * N)], found: [[], []],
  shots: [0, 0], hits: [0, 0], streak: [0, 0], bestStreak: [0, 0], log: [[], []],
  turn: 0, turnNo: 0, turnAt: 0, last: [-1, -1], lastFound: null, roundScore: 0,
});
type Final = { score: number; won: boolean; shots: number; hits: number; streak: number; rounds: number; log: string[] };

// live play
const CODE_LETTERS = "BCDFGHJKMNPQRSTVWXZ";   // no vowels (no accidental words), no I, L or O
const TURN_MS = 45000, GRACE_MS = 5000, RESEND_MS = 3000;
type Meta = { id: string; name: string; at: number; round: number; ready: boolean; seq: number };   // seq: newer wins
type Room = { status: "idle" | "connecting" | "waiting" | "paired" | "full" | "error"; code?: string; opp?: Meta | null; host?: boolean };
type Msg =
  | { t: "shot"; round: number; turn: number; i: number }
  | { t: "answer"; round: number; turn: number; i: number; hit: boolean; sunk: Placed | null; over: boolean }
  | { t: "skip"; round: number; turn: number }
  | { t: "meta"; round: number; meta: Meta };   // the same seat info as presence, sent straight away (presence can lag a few seconds)
const newCode = () => Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join("");
const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
const validCode = (s: string) => s.length === 4 && [...s].every(ch => CODE_LETTERS.includes(ch));
function storedName() {   // the kit's player record, read straight away so a link-join has the name on the first render
  try { const v = localStorage.getItem("wya-games-player") ?? localStorage.getItem("snackmerge-player"); return v ? (JSON.parse(v).name as string) || "Guest" : "Guest"; } catch { return "Guest"; }
}
const SQUARE = { hit: "🟧", miss: "⬜" };
const lines = (log: string[]) => { const out: string[] = []; for (let i = 0; i < log.length; i += 10) out.push(log.slice(i, i + 10).join("")); return out.join("\n"); };

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
  const [swap, setSwap] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [ghost, setGhostState] = useState<{ p: Placed; ok: boolean } | null>(null);
  const ghostRef = useRef<{ p: Placed; ok: boolean } | null>(null);
  const setGhost = (v: { p: Placed; ok: boolean } | null) => { ghostRef.current = v; setGhostState(v); };
  const [best, setBest] = useState(0);
  const [final, setFinal] = useState<Final | null>(null);
  const [fact, setFact] = useState<Toast | null>(null);
  const [locked, setLocked] = useState(false);            // a beat after each shot, so you see what happened
  const shell = useGameShell(GAME, mode);
  const { reset: resetScores } = shell.scores;
  const aiRng = useRef<() => number>(Math.random);
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
  const readyRef = useRef(false);
  const awaiting = useRef<{ turn: number; i: number; sent: number } | null>(null);
  const heard = useRef<Meta | null>(null);                 // the friend's newest seat info from a "meta" message
  const answers = useRef(new Map<number, Msg>());
  const [joinInput, setJoinInput] = useState("");
  const [now, setNow] = useState(0);

  // the board fills the space: the big fridge on top, the small one (or the setup buttons) underneath
  useEffect(() => {
    const el = wrapRef.current!; const f = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect();
  }, []);
  const PAD = 6, TOP = 22, GAP = 10;
  const lowH = Math.round(Math.max(112, Math.min(150, area.h * 0.24)));
  const cell = Math.max(18, Math.min(52, Math.floor((area.w - 2 * PAD) / N), Math.floor((area.h - lowH - GAP - TOP - 2 * PAD) / N)));
  const bigW = cell * N + 2 * PAD, bigH = bigW + TOP;
  const smallCell = Math.floor((lowH - 14 - 6) / N);
  const size = { w: bigW, h: bigH + GAP + lowH };

  // ── starting things ────────────────────────────────────────────────────
  const todayRecord = (): Final | null => { try { const v = localStorage.getItem(todayKey); return v ? JSON.parse(v) : null; } catch { return null; } };
  const startCpu = (keep: Placed[] | null, nextRound: number) => {
    const daily = mode === "daily";
    if (daily && todayRecord()) { setFinal(todayRecord()); go("doneToday"); setMsg("Today's Fridge Is Done. New One At Midnight."); return; }
    const lay = mulberry32(daily ? dailySeed(LAYOUT_SALT) : Math.floor(Math.random() * 1e9));
    aiRng.current = mulberry32(daily ? dailySeed(AI_SALT) : Math.floor(Math.random() * 1e9));
    g.current = newGame(keep ?? autoPlace(Math.random), autoPlace(lay));
    if (nextRound === 1) { total.current = 0; runShots.current = 0; runStart.current = 0; resetScores(); }
    setRound(nextRound); setSel(null); setGhost(null); setSwap(false); setFact(null); setFinal(null); setLocked(false);
    go("place"); setMsg(nextRound === 1 ? "Hide Your Snacks, Then Tap Ready." : `Round ${nextRound}. Move Your Snacks If You Like.`);
    bump();
  };
  useEffect(() => {
    if (opp === "cpu") startCpu(null, 1);
    else if (opp === "phone") { go("names"); setMsg("Two Players, One Phone."); setFact(null); setFinal(null); }
    else { go("idle"); setFact(null); setFinal(null); setMsg("Play Live On Two Phones."); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, opp, run]);

  const leaveRoom = () => {
    if (chRef.current) sb().removeChannel(chRef.current);
    chRef.current = null; pairedWith.current = null; awaiting.current = null; setRoom({ status: "idle" });
  };
  useEffect(() => {   // leaving the page leaves the room straight away, so a friend isn't left waiting on a dead seat
    const bye = () => { if (chRef.current) { chRef.current.untrack(); sb().removeChannel(chRef.current); chRef.current = null; } };
    window.addEventListener("pagehide", bye);
    return () => { window.removeEventListener("pagehide", bye); bye(); };
  }, []);
  const pickOpp = (o: Opp) => { if (o === opp) return; if (opp === "live") leaveRoom(); setOpp(o); };
  const pickMode = (m: Mode) => { if (opp === "live") leaveRoom(); setMode(m); if (opp !== "cpu") setOpp("cpu"); else setRun(r => r + 1); };

  // the pause button is for the computer only
  const { held, setHeld } = shell;
  useEffect(() => { if (opp !== "cpu" && held) setHeld(false); }, [opp, held, setHeld]);

  // ── shots ──────────────────────────────────────────────────────────────
  const pov: Side = opp === "phone" ? holder : 0;
  const other = (s: Side): Side => (s === 0 ? 1 : 0);
  const nameOf = (s: Side) => opp === "cpu" ? (s === 0 ? "You" : "The computer")
    : opp === "phone" ? (names[s] || `Player ${s + 1}`)
    : (s === 0 ? myName : room.opp?.name && room.opp.name !== "Guest" ? room.opp.name : "Your Friend");
  const fridgeName = (s: Side) => (s === pov ? "Your Fridge" : opp === "cpu" ? "Computer's Fridge" : `${nameOf(s)}'s Fridge`);

  /** Book-keeping for a shot by `shooter` at cell i, once the answer is known (inc is already marked). */
  const record = (shooter: Side, i: number, a: Answer) => {
    const G = g.current, target = other(shooter);
    G.shots[shooter]++; G.last[target] = i;
    if (a.hit) { G.hits[shooter]++; G.streak[shooter]++; G.bestStreak[shooter] = Math.max(G.bestStreak[shooter], G.streak[shooter]); }
    else G.streak[shooter] = 0;
    if (a.sunk && !G.found[target].some(f => f.s === a.sunk!.s)) G.found[target].push(a.sunk);
    if (a.sunk) G.lastFound = a.sunk.s;
    G.log[shooter].push(a.sunk ? emoji(SNACKS[a.sunk.s].code) : a.hit ? SQUARE.hit : SQUARE.miss);
    if (opp === "cpu" && shooter === 0) G.roundScore += (a.hit ? hitPoints(G.streak[0]) : 0) + (a.sunk ? foundPoints(a.sunk.s) : 0) + (a.over ? winBonus(G.shots[0], G.layout[0], G.inc[0]) : 0);
    const me = shooter === pov, s = a.sunk ? SNACKS[a.sunk.s] : null;
    const theirs = opp === "phone" ? `${nameOf(target)}'s` : "The";
    if (me) setMsg(s ? `You Found ${theirs} ${s.name}! ${emoji(s.code)}` : a.hit ? (G.streak[shooter] > 1 ? `Another Bite! ${G.streak[shooter]} In A Row.` : "A Bite! Something's There.") : "Just Ice. Nothing There.");
    else {
      const who = opp === "cpu" ? "The Computer" : nameOf(shooter);
      const hitSnack = a.hit ? SNACKS[(G.layout[target] ?? []).find(q => cellsOf(q).includes(i))?.s ?? 0] : null;
      setMsg(s ? `${who} Found Your ${s.name}.` : hitSnack ? `${who} Bit Your ${hitSnack.name}.` : `${who} Missed.`);
    }
  };
  const pickFact = (s: number | null): Toast | null => {
    if (s === null) return null; const sn = SNACKS[s];
    return { title: `The Last Snack Found: ${sn.name}`, body: sn.facts[Math.floor(Math.random() * sn.facts.length)], img: sn.code };
  };

  const cpuEnd = (won: boolean) => {
    const G = g.current; runShots.current += G.shots[0];
    setFact(pickFact(G.lastFound));
    if (won && mode === "endless") { total.current += G.roundScore; go("roundWon"); bump(); return; }
    const score = total.current + G.roundScore;
    const f: Final = { score, won, shots: G.shots[0], hits: G.hits[0], streak: G.bestStreak[0], rounds: round, log: G.log[0] };
    setFinal(f); go("over");
    if (score > readBest(bestKey)) { saveBest(bestKey, score); setBest(score); }
    if (mode === "daily") try { localStorage.setItem(todayKey, JSON.stringify(f)); } catch {}
    shell.finishRef.current({ score, drops: runShots.current, ms: performance.now() - runStart.current });
    bump();
  };

  const shoot = (i: number) => {
    const G = g.current;
    if (phaseRef.current !== "play" || G.turn !== pov || locked || swap) return;
    if (G.inc[other(pov)][i] !== 0) { setMsg("You've Tried That Shelf. Pick Another."); return; }
    if (opp === "cpu" && shell.paused) return;
    if (opp === "live") return liveShoot(i);
    const t = other(pov), a = answerShot(G.layout[t]!, G.inc[t], i);
    record(pov, i, a);
    if (opp === "cpu") {
      if (a.over) cpuEnd(true); else { G.turn = 1; G.turnAt = Date.now(); }
      bump(); return;
    }
    // same phone: show the result for a moment, then hand over
    if (a.over) { go("over"); setFact(pickFact(G.lastFound)); bump(); return; }
    G.turn = t; setLocked(true); bump();
    setTimeout(() => { setLocked(false); setPass({ to: t, then: "play" }); go("pass"); setMsg(`Pass The Phone To ${nameOf(t)}.`); }, 1400);
  };

  // the computer's turn
  const paused = shell.paused;
  useEffect(() => {
    if (opp !== "cpu" || phase !== "play" || g.current.turn !== 1 || paused) return;
    const t = setTimeout(() => {
      const G = g.current; if (phaseRef.current !== "play" || G.turn !== 1) return;
      const skill = mode === "daily" ? SKILL_TODAY : Math.min(1, SKILL_FREE + SKILL_STEP * (round - 1));
      const i = aiPick(G.inc[0], G.found[0], aiRng.current, skill);
      const a = answerShot(G.layout[0], G.inc[0], i);
      record(1, i, a);
      if (a.over) cpuEnd(false); else { G.turn = 0; G.turnAt = Date.now(); }
      bump();
    }, 750 + Math.random() * 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp, phase, paused, g.current.turn, g.current.turnAt]);

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
      else if (first === holder) { g.current.turn = first; setSwap(false); go("play"); setMsg(`${nameOf(first)}, You Go First. Tap A Shelf In Their Fridge.`); bump(); }   // already holding it
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
    setRound(nextRound); setFact(null); setSwap(false); setSel(null);
    setPass({ to: 0, then: "place" }); go("pass"); setMsg(`Pass The Phone To ${first}.`); bump();
  };
  const takePhone = () => {
    setHolder(pass.to); setSwap(false); setSel(null); go(pass.then);
    const n = names[pass.to] || `Player ${pass.to + 1}`;
    setMsg(pass.then === "place" ? `${n}, Hide Your Snacks.` : `${n}, Your Turn. Tap A Shelf In Their Fridge.`);
  };

  // ── live ───────────────────────────────────────────────────────────────
  const send = (m: Msg) => { chRef.current?.send({ type: "broadcast", event: "m", payload: m }); };
  const setMeta = (p: Partial<Meta>) => {
    if (!meRef.current) return; meRef.current = { ...meRef.current, ...p, seq: meRef.current.seq + 1 }; chRef.current?.track(meRef.current);
    send({ t: "meta", round: meRef.current.round, meta: meRef.current });
  };
  const joinRoom = (code: string) => {
    if (chRef.current) sb().removeChannel(chRef.current);
    pairedWith.current = null; heard.current = null;
    const me: Meta = { id: Math.random().toString(36).slice(2, 10), name: storedName(), at: Date.now(), round: 1, ready: false, seq: 0 };
    meRef.current = me; setRoom({ status: "connecting", code });
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
      setRoom({ status: o ? "paired" : "waiting", code, opp: o, host: seats[0].id === me.id });
    });
    ch.on("broadcast", { event: "m" }, ({ payload }) => onMsgRef.current(payload as Msg));
    ch.subscribe(status => {
      if (chRef.current !== ch) return;
      if (status === "SUBSCRIBED") setTimeout(track, 1500);              // in case the first presence sync is slow
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setRoom({ status: "error", code });
    });
  };
  // auto-join from a shared link: whatyouate.app/games/fridge-raid?room=ABCD
  useEffect(() => {
    const code = cleanCode(new URLSearchParams(window.location.search).get("room") ?? "");
    if (validCode(code)) { setOpp("live"); joinRoom(code); }
  }, []);
  const roomLink = (code: string) => `${typeof window === "undefined" ? "https://whatyouate.app" : window.location.origin}/games/${GAME}?room=${code}`;

  const startLiveRound = (r: number) => {
    g.current = newGame(g.current.layout[0] && r > 1 ? g.current.layout[0] : autoPlace(Math.random), null);
    answers.current.clear(); awaiting.current = null; readyRef.current = false; setMyReady(false);
    setRound(r); setMeta({ round: r, ready: false }); setFact(null); setSwap(false); setSel(null);
    go("place"); setMsg(r === 1 ? "Hide Your Snacks, Then Tap Ready." : "Rematch! Move Your Snacks If You Like."); bump();
  };
  // a friend arrived (or a new one after the last one left): start fresh at round 1
  const oppId = room.status === "paired" ? room.opp?.id ?? null : null;
  useEffect(() => {
    if (opp !== "live" || !oppId || pairedWith.current === oppId) return;
    pairedWith.current = oppId; startLiveRound(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oppId, opp]);
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
  const nextTurn = () => { const G = g.current; G.turn = other(G.turn); G.turnNo++; G.turnAt = Date.now(); };
  const liveShoot = (i: number) => {
    const G = g.current; if (awaiting.current) return;
    awaiting.current = { turn: G.turnNo, i, sent: Date.now() };
    send({ t: "shot", round: meRef.current!.round, turn: G.turnNo, i }); bump();
  };
  const liveOver = (won: boolean) => {
    setFact(pickFact(g.current.lastFound)); go("over");
    setMsg(won ? `You Found All Of ${nameOf(1)}'s Snacks!` : `${nameOf(1)} Found All Your Snacks.`);
  };
  const onMsg = (m: Msg) => {
    const G = g.current, r = meRef.current?.round;
    if (m?.t === "meta") {
      if (heard.current?.id === m.meta.id && heard.current.seq >= m.meta.seq) return;
      heard.current = m.meta;
      setRoom(v => (v.status === "paired" && v.opp?.id === m.meta.id ? { ...v, opp: m.meta } : v)); return;
    }
    if (!m || m.round !== r) return;
    if (phaseRef.current === "place") startLivePlay();     // their shot can arrive just before their "ready" does
    if (phaseRef.current !== "play" && m.t !== "shot") return;
    if (m.t === "shot") {
      if (phaseRef.current === "over" || m.turn < G.turnNo) { const old = answers.current.get(m.turn); if (old) send(old); return; }
      if (phaseRef.current !== "play" || m.turn !== G.turnNo || G.turn !== 1) return;
      const a = answerShot(G.layout[0]!, G.inc[0], m.i);
      const reply: Msg = { t: "answer", round: r, turn: m.turn, i: m.i, hit: a.hit, sunk: a.sunk, over: a.over };
      answers.current.set(m.turn, reply); send(reply);
      record(1, m.i, a);
      if (a.over) liveOver(false); else nextTurn();
      bump();
    } else if (m.t === "answer") {
      const w = awaiting.current; if (!w || w.turn !== m.turn || w.i !== m.i) return;
      awaiting.current = null;
      G.inc[1][m.i] = m.hit ? 2 : 1;
      record(0, m.i, { hit: m.hit, sunk: m.sunk, over: m.over });
      if (m.over) liveOver(true); else nextTurn();
      bump();
    } else if (m.t === "skip") {
      if (m.turn !== G.turnNo) return;
      if (awaiting.current?.turn === m.turn) awaiting.current = null;
      setMsg(G.turn === 0 ? "Time's Up. Your Turn Passed." : `${nameOf(1)} Ran Out Of Time. Your Turn.`);
      nextTurn(); bump();
    }
  };
  const onMsgRef = useRef(onMsg); onMsgRef.current = onMsg;
  // the turn clock, plus resending a shot if its answer hasn't come back
  useEffect(() => {
    if (opp !== "live" || phase !== "play") return;
    const t = setInterval(() => {
      const G = g.current, el = Date.now() - G.turnAt, r = meRef.current?.round ?? 0, w = awaiting.current;
      if (w && Date.now() - w.sent > RESEND_MS) { w.sent = Date.now(); send({ t: "shot", round: r, turn: w.turn, i: w.i }); }
      if (room.status === "paired") {
        if (G.turn === 0 && !w && el > TURN_MS) { send({ t: "skip", round: r, turn: G.turnNo }); nextTurn(); setMsg(`Time's Up. ${nameOf(1)}'s Turn.`); bump(); }
        else if (G.turn === 1 && el > TURN_MS + GRACE_MS) { send({ t: "skip", round: r, turn: G.turnNo }); nextTurn(); setMsg(`${nameOf(1)} Ran Out Of Time. Your Turn.`); bump(); }
      }
      setNow(Date.now());
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp, phase, room.status]);

  // ── share ──────────────────────────────────────────────────────────────
  const n = dailyNumber(LAUNCH);
  const shareCpu = (f: Final) => {
    const label = mode === "daily" ? `Fridge Raid #${n} (Today's Challenge)` : "Fridge Raid (Free Play)";
    const rate = f.shots ? Math.round((f.hits / f.shots) * 100) : 0;
    const how = mode === "daily" ? (f.won ? `Raided in ${f.shots} shots` : "The computer won this one") : `${f.rounds - (f.won ? 0 : 1)} ${f.rounds - (f.won ? 0 : 1) === 1 ? "round" : "rounds"} won`;
    const p = shell.scores.posted;
    const rank = p?.rank ? `\n🏆 #${p.rank} of ${p.total} ${mode === "daily" ? "today" : "this week"}` : "";
    shell.share(`${label}\n${f.score.toLocaleString()} pts · ${how}\n🎯 ${rate}% hits · best streak ${f.streak}${rank}\n${lines(f.log)}\nCan you beat it? whatyouate.app/games/${GAME}`);
  };
  const shareDuel = (winner: Side) => {
    const G = g.current, w = nameOf(winner), l = nameOf(other(winner));
    const head = opp === "phone" ? `${w} beat ${l} in ${G.shots[winner]} shots 🎉` : winner === 0 ? `I beat ${l} in ${G.shots[0]} shots 🎉` : `${l} beat me this time`;
    shell.share(`Fridge Raid (${opp === "phone" ? "Same Phone" : "Play A Friend"})\n${head}\n${lines(G.log[opp === "phone" ? winner : 0])}\nPlay a friend: whatyouate.app/games/${GAME}`);
  };

  // ── drawing ────────────────────────────────────────────────────────────
  const G = g.current;
  const target = other(pov);
  const bigSide: Side = swap ? pov : target, smallSide: Side = swap ? target : pov;
  const myTurn = phase === "play" && G.turn === pov;
  const scoreNow = total.current + G.roundScore;
  const winner: Side | null = G.found[1].length === SNACKS.length ? 0 : G.found[0].length === SNACKS.length ? 1 : null;
  const secsLeft = opp === "live" && phase === "play" ? Math.max(0, Math.ceil((TURN_MS - (now - G.turnAt)) / 1000)) : 0;
  const theyWantRematch = opp === "live" && phase === "over" && (room.opp?.round ?? 0) > round;

  const fridge = (s: Side, c: number, small: boolean, opts: { edit?: boolean } = {}) => {
    const own = s === pov, show = own ? (G.layout[s] ?? []) : G.found[s];
    const foundSet = new Set(G.found[s].flatMap(cellsOf));
    const pad = small ? 3 : PAD, top = small ? 14 : TOP;
    const marks: ReactNode[] = [];
    for (let i = 0; i < N * N; i++) {
      const v = G.inc[s][i]; if (!v || (!own && foundSet.has(i))) continue;
      const r = Math.floor(i / N), cc = i % N, sz = v === 2 ? c * (small ? 0.55 : 0.72) : c * (small ? 0.32 : 0.5);
      const style = { left: cc * c + (c - sz) / 2, top: r * c + (c - sz) / 2, width: sz, height: sz };
      marks.push(small ? <span key={i} className="absolute rounded-full" style={{ ...style, background: v === 2 ? "#f2735f" : "#9fb8dc" }} />
        : v === 2 ? <Splat key={i} style={style} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img key={i} src={foodPng("2744")} alt="" draggable={false} className="absolute opacity-80" style={style} />);
    }
    const pend = !own && awaiting.current ? awaiting.current.i : -1;
    const pop = G.last[s];
    return (
      <div className="bg-white shadow-[0_10px_30px_rgba(16,42,86,0.16)]" style={{ width: c * N + pad * 2, padding: pad, paddingTop: 0, borderRadius: small ? 12 : 18 }}>
        <div className="flex items-center justify-between gap-1 px-1" style={{ height: top }}>
          <span className={`truncate font-bold uppercase tracking-wide text-[#5a6b85] ${small ? "text-[8px]" : "text-[10px]"}`}>{fridgeName(s)}</span>
          <span className={`shrink-0 rounded-full bg-[#d6e2f5] ${small ? "h-1 w-4" : "h-1.5 w-7"}`} />
        </div>
        <div className={`relative overflow-hidden bg-[#eef5ff] ${opts.edit ? "touch-none" : ""} ${!small && !own && myTurn && !swap ? "cursor-pointer" : ""}`}
          style={{ width: c * N, height: c * N, borderRadius: small ? 6 : 10,
            backgroundImage: "linear-gradient(to right, rgba(63,127,214,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(63,127,214,0.22) 1.5px, transparent 1.5px)",
            backgroundSize: `${c}px ${c}px`, backgroundPosition: "-0.5px -0.75px" }}
          onPointerDown={opts.edit ? onDown : undefined} onPointerMove={opts.edit ? onMove : undefined} onPointerUp={opts.edit ? onUp : undefined} onPointerCancel={opts.edit ? onUp : undefined}
          onClick={!small && !own ? e => shoot(cellAt(e, e.currentTarget)) : undefined}>
          {show.map(p => (
            <Pill key={p.s} p={p} c={c} dim={own && G.found[s].some(f => f.s === p.s)} sel={opts.edit && sel === p.s} faded={opts.edit && ghost?.p.s === p.s} />
          ))}
          {opts.edit && ghost && <Pill p={ghost.p} c={c} ghost bad={!ghost.ok} />}
          {marks}
          {pend >= 0 && <span className="absolute animate-pulse rounded-full bg-[#3f7fd6]/40" style={{ left: (pend % N) * c + c * 0.3, top: Math.floor(pend / N) * c + c * 0.3, width: c * 0.4, height: c * 0.4 }} />}
          {pop >= 0 && <span key={`${pop}-${G.shots[other(s)]}`} className="fr-pop pointer-events-none absolute rounded-full border-solid border-[#3f7fd6]"
            style={{ left: (pop % N) * c, top: Math.floor(pop / N) * c, width: c, height: c, borderWidth: small ? 2 : 3 }} />}
        </div>
      </div>
    );
  };

  const snackRow = (s: Side, label: string) => (
    <div>
      <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-[#5a6b85]">{label}</div>
      <div className="mt-0.5 flex gap-1">
        {SNACKS.map((sn, k) => { const gone = G.found[s].some(f => f.s === k); return (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={k} src={foodPng(sn.code)} alt={sn.name} title={sn.name} className={`h-5 w-5 ${gone ? "opacity-25 grayscale" : ""}`} />); })}
      </div>
    </div>
  );

  const card = (children: ReactNode, solid = false) => (
    <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[22px] p-3 ${solid ? "bg-[#dce9fc]" : "bg-[#101b2e]/45"}`}>
      <div className="max-h-full w-full max-w-[340px] overflow-y-auto rounded-3xl bg-white p-5 text-center shadow-2xl">{children}</div>
      {fact && (phase === "over") && <FactCard fact={fact} />}
    </div>
  );
  const btn = "w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white disabled:opacity-50";
  const btn2 = "w-full rounded-full bg-[#e3effe] py-3 font-semibold text-[#3f7fd6]";

  const liveCard = (): ReactNode => {
    if (opp !== "live" || (room.status === "paired" && phase !== "idle")) return null;
    const code = room.code ?? "";
    if (room.status === "idle") return card(<>
      <div className="text-xl font-bold">Play A Friend</div>
      <p className="mt-1 text-sm text-[#5a6b85]">Make a room and send your friend the link, or type their code.</p>
      <button onClick={() => joinRoom(newCode())} className={`mt-4 ${btn}`}>Make A Room</button>
      <div className="mt-4 flex gap-2">
        <input value={joinInput} onChange={e => setJoinInput(cleanCode(e.target.value))} placeholder="CODE" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
          className="min-w-0 flex-1 rounded-full border border-[#d6e2f5] px-4 py-2.5 text-center font-mono text-lg font-bold uppercase tracking-[0.3em] outline-none focus:border-[#3f7fd6]" />
        <button disabled={!validCode(joinInput)} onClick={() => joinRoom(joinInput)} className="rounded-full bg-[#101b2e] px-5 font-semibold text-white disabled:opacity-40">Join</button>
      </div>
      {joinInput.length === 4 && !validCode(joinInput) && <p className="mt-2 text-xs font-semibold text-[#d64545]">That code doesn&apos;t look right. Check it again.</p>}
    </>);
    if (room.status === "connecting") return card(<><div className="text-xl font-bold">Joining Room {code}</div><p className="mt-2 text-sm text-[#5a6b85]">One moment...</p></>);
    if (room.status === "full") return card(<>
      <div className="text-xl font-bold">Room Full</div>
      <p className="mt-1 text-sm text-[#5a6b85]">Room {code} already has two players. Make your own room instead.</p>
      <button onClick={() => { setRoom({ status: "idle" }); setJoinInput(""); }} className={`mt-4 ${btn}`}>Back</button>
    </>);
    if (room.status === "error") return card(<>
      <div className="text-xl font-bold">Couldn&apos;t Connect</div>
      <p className="mt-1 text-sm text-[#5a6b85]">Check your connection and try again.</p>
      <button onClick={() => joinRoom(code)} className={`mt-4 ${btn}`}>Try Again</button>
      <button onClick={leaveRoom} className="mt-2 w-full py-2 text-sm font-semibold text-[#5a6b85]">Back</button>
    </>);
    // waiting: for a first friend, or for one who left to come back
    const left = !!pairedWith.current;
    return card(<>
      <div className="text-xl font-bold">{left ? "Your Friend Left" : "Your Room"}</div>
      <p className="mt-1 text-sm text-[#5a6b85]">{left ? "Waiting for them to come back. If they rejoin, you'll start a fresh game." : "Send your friend the link, or have them type this code."}</p>
      <div className="mt-3 font-mono text-4xl font-bold tracking-[0.25em] text-[#101b2e]">{code}</div>
      <button onClick={() => shell.share(`Play Fridge Raid with me! Room ${code}\n${roomLink(code)}`)} className={`mt-4 ${btn}`}>{shell.copied ? "Link Copied!" : "Share The Link"}</button>
      <p className="mt-3 text-xs text-[#5a6b85]">Waiting For Your Friend To Join...</p>
      <button onClick={() => { leaveRoom(); setJoinInput(""); }} className="mt-1 w-full py-2 text-sm font-semibold text-[#5a6b85]">Leave Room</button>
    </>);
  };

  const overlay = (): ReactNode => {
    const live = liveCard(); if (live) return live;
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
      <div className="mt-1 text-xl font-bold">Today&apos;s Fridge Is Raided</div>
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
      <div className="mt-1 text-xl font-bold">Round {round} Won! 🎉</div>
      <p className="mt-1 text-sm text-[#5a6b85]">Found every snack in {G.shots[0]} shots. +{G.roundScore.toLocaleString()} points.</p>
      <div className="mt-2 text-3xl font-bold tabular-nums">{total.current.toLocaleString()}</div>
      <p className="text-xs text-[#5a6b85]">The computer gets a little sharper next round.</p>
      <button onClick={() => startCpu(G.layout[0], round + 1)} className={`mt-4 ${btn}`}>Next Round</button>
    </>);
    if (opp === "phone" && phase === "names") return card(<>
      <div className="text-xl font-bold">Same Phone</div>
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
        <div className="mt-2 text-xl font-bold">Pass The Phone To {to}</div>
        <p className="mt-1 text-sm text-[#5a6b85]">{from}, No Peeking!</p>
        <button onClick={takePhone} className={`mt-4 ${btn}`}>I&apos;m {to}, Show Me</button>
      </>, true);
    }
    if (opp !== "cpu" && phase === "over" && winner !== null) {
      const w = nameOf(winner), l = nameOf(other(winner));
      const head = opp === "live" ? (winner === 0 ? "You Win! 🎉" : `${w} Wins`) : `${w} Wins! 🎉`;
      return card(<>
        <div className="text-sm font-semibold text-[#5a6b85]">{opp === "phone" ? "Same Phone" : "Play A Friend"}</div>
        <div className="mt-1 text-2xl font-bold">{head}</div>
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

  const lower = (): ReactNode => {
    if (placing) return (
      <div className="flex flex-col justify-center gap-2" style={{ height: lowH }}>
        <p className="text-center text-xs text-[#5a6b85]">{sel === null ? "Drag A Snack To Move It. Tap It Twice To Turn It." : `${SNACKS[sel].name}: Drag It, Tap An Empty Shelf, Or Tap Turn.`}</p>
        <div className="flex gap-2">
          <button onClick={shuffle} className="flex-1 rounded-full bg-white/80 py-2 text-sm font-semibold text-[#3f7fd6]">🔀 Shuffle</button>
          <button onClick={() => sel !== null && turnSnack(sel)} disabled={sel === null} className="flex-1 rounded-full bg-white/80 py-2 text-sm font-semibold text-[#3f7fd6] disabled:opacity-40">↻ Turn</button>
        </div>
        <button onClick={ready} className={btn}>I&apos;m Ready</button>
      </div>
    );
    if (opp === "live" && phase === "place") return (
      <div className="flex flex-col items-center justify-center gap-2 text-center" style={{ height: lowH }}>
        <div className="text-sm font-semibold">{room.opp && room.opp.round < round ? `Waiting For ${nameOf(1)} To Say Rematch` : "Waiting For Your Friend To Hide Their Snacks"}</div>
        <div className="flex gap-1">{[0, 1, 2].map(k => <span key={k} className="h-2 w-2 animate-pulse rounded-full bg-[#3f7fd6]" style={{ animationDelay: `${k * 200}ms` }} />)}</div>
        <button onClick={() => { readyRef.current = false; setMyReady(false); setMeta({ ready: false }); setMsg("Hide Your Snacks, Then Tap Ready."); }} className="text-xs font-semibold text-[#5a6b85]">Move My Snacks</button>
      </div>
    );
    if (phase === "play" || phase === "over" || phase === "roundWon") return (
      <div className="flex gap-2.5" style={{ height: lowH }}>
        <button aria-label="Swap fridges" onClick={() => setSwap(s => !s)} className="shrink-0 self-start text-left">{fridge(smallSide, smallCell, true)}</button>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          {snackRow(target, opp === "cpu" ? "Computer's Snacks" : `${nameOf(target)}'s Snacks`)}
          {snackRow(pov, "Your Snacks")}
          <div className="text-xs font-semibold tabular-nums text-[#101b2e]">Shots {G.shots[pov]} · Hits {G.hits[pov]}</div>
          <div className="text-[11px] text-[#5a6b85]">Tap The Small Fridge To Swap</div>
        </div>
      </div>
    );
    return <div style={{ height: lowH }} />;
  };

  const showBoard = phase === "place" || phase === "play" || phase === "over" || phase === "roundWon";
  const placeSide: Side = pov;

  return (
    <GameScreen>
      <GameHeader title="Fridge Raid" mode={mode} onMode={pickMode} onBoard={() => shell.setBoardOpen(true)} onHelp={shell.help.show} />

      <div className="mt-2 flex h-8 shrink-0 rounded-full bg-white/70 p-0.5 text-xs font-semibold">
        {([["cpu", "Computer"], ["phone", "Same Phone"], ["live", "Play A Friend"]] as [Opp, string][]).map(([o, label]) => (
          <button key={o} onClick={() => pickOpp(o)} className={`flex-1 rounded-full ${opp === o ? "bg-[#101b2e] text-white" : "text-[#3f7fd6]"}`}>{label}</button>
        ))}
      </div>

      <div className="mt-2 flex h-10 shrink-0 items-center gap-2">
        <div className="w-16 shrink-0">
          {opp === "cpu" ? (<><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Score</div><div className="text-xl font-bold leading-none tabular-nums">{scoreNow.toLocaleString()}</div></>)
            : (<><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">{opp === "phone" ? "Round" : "Shots"}</div><div className="text-xl font-bold leading-none tabular-nums">{opp === "phone" ? round : G.shots[0]}</div></>)}
        </div>
        <div className="min-w-0 flex-1 text-center text-[13px] font-semibold leading-tight text-[#101b2e]" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{msg}</div>
        <div className="flex min-w-16 shrink-0 justify-end">
          {opp === "cpu" && <PauseButton shell={shell} active={phase === "play"} />}
          {opp === "live" && phase === "play" && (
            <div className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${secsLeft <= 10 ? "bg-[#e8505b] text-white" : "bg-white/70 text-[#3f7fd6]"}`}>
              {G.turn === 0 ? "You" : "Them"} {secsLeft}s</div>
          )}
        </div>
      </div>

      <BoardArea wrapRef={wrapRef} size={size} reserve={0}>
        <div className="flex flex-col items-center" style={{ gap: GAP }}>
          <div className={showBoard ? "" : "opacity-60"}>
            {showBoard ? (placing || (opp === "live" && phase === "place") ? fridge(placeSide, cell, false, { edit: placing }) : fridge(bigSide, cell, false))
              : <div className="rounded-[18px] bg-white/80" style={{ width: bigW, height: bigH }} />}
          </div>
          <div style={{ width: bigW }}>{showBoard ? lower() : <div style={{ height: lowH }} />}</div>
        </div>
        {opp === "cpu" && <PrizeLogo shell={shell} active={phase === "play" && !shell.paused} />}
        {opp === "cpu" && <PausedCard shell={shell} active={phase === "play"} />}
        {overlay()}
        <style>{`.fr-pop { animation: fr-pop 0.7s ease-out forwards } @keyframes fr-pop { 0% { transform: scale(0.4); opacity: 1 } 100% { transform: scale(1.25); opacity: 0 } }`}</style>
      </BoardArea>

      <ShellPopups shell={shell} game={GAME} todayNote="Today's Challenge: same computer fridge for everyone. Resets at midnight." />

      {shell.help.open && (
        <HelpModal onClose={shell.help.close} steps={[
          "Hide your snacks in your fridge. Drag to move, tap twice to turn, or tap Shuffle.",
          "Take turns tapping a shelf in the other fridge to guess where their snacks are.",
          <span key="m" className="inline-flex flex-wrap items-center gap-1">A bite <Splat className="inline-block h-5 w-5" /> means you hit a snack. Ice
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foodPng("2744")} alt="" className="inline-block h-4 w-4" /> means nothing&apos;s there.</span>,
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
            <p><b>Same Phone:</b> two players, one phone. Pass it between turns.</p>
            <p><b>Play A Friend:</b> share a room code and play live on two phones.</p>
          </div>
        </HelpModal>
      )}
    </GameScreen>
  );
}

function Pill({ p, c, dim, sel, ghost, bad, faded }: { p: Placed; c: number; dim?: boolean; sel?: boolean; ghost?: boolean; bad?: boolean; faded?: boolean }) {
  const s = SNACKS[p.s], L = s.len, ins = Math.max(1, Math.round(c * 0.07));
  return (
    <div className="pointer-events-none absolute flex items-center justify-around rounded-full"
      style={{ left: p.c * c + ins, top: p.r * c + ins, width: (p.v ? 1 : L) * c - 2 * ins, height: (p.v ? L : 1) * c - 2 * ins, flexDirection: p.v ? "column" : "row",
        background: bad ? "#ffd9dc" : s.color, opacity: dim ? 0.45 : ghost ? 0.75 : faded ? 0.3 : 1,
        boxShadow: sel ? "0 0 0 2.5px #3f7fd6" : bad ? "0 0 0 2px #e8505b" : ghost ? "0 0 0 2px #2eaa6e" : "inset 0 0 0 1px rgba(16,27,46,0.10)" }}>
      {Array.from({ length: L }, (_, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={k} src={foodPng(s.code)} alt={k === 0 ? s.name : ""} draggable={false} style={{ width: c * 0.68, height: c * 0.68 }} />
      ))}
    </div>
  );
}

function Splat({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className ?? "pointer-events-none absolute"} style={style} aria-hidden>
      <path fill="#f2735f" d="M20 4c2.6 0 3.4 4.6 6 5.2 2.4.5 5.6-2.6 7.4-.8 1.8 1.8-1.4 5-.9 7.4.6 2.6 5.5 3.4 5.5 6.2s-4.9 3-5.5 5.6c-.5 2.4 2.7 5.6.9 7.4-1.8 1.8-5-1.3-7.4-.8-2.6.6-3.4 5.8-6 5.8s-3.4-5.2-6-5.8c-2.4-.5-5.6 2.6-7.4.8-1.8-1.8 1.3-5 .8-7.4C6.8 25 2 24.8 2 22s4.8-3.6 5.4-6.2c.5-2.4-2.6-5.6-.8-7.4 1.8-1.8 5 1.3 7.4.8C16.6 8.6 17.4 4 20 4z" />
      <circle cx="20" cy="21" r="6" fill="#fff" opacity="0.5" />
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
