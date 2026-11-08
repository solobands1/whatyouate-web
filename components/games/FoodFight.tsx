"use client";

// Food Fight: a turn-based food throwing game. Two picnic baskets sit on rolling hills; take turns throwing food at
// the other one. Drag back anywhere on the lower half of the board (relative drag, so your finger never covers the
// shot), watch the dotted aim line and the wind, and let go to throw. A hit knocks health off any basket near where
// it lands and digs a crater. First basket to zero loses the round.
// Foods: apple (the all-rounder), watermelon (big blast but heavy: a short aim line, 2 a round), blueberries
// (3 small hits, light so the wind pushes them, a long aim line).
// "Today" is best of 3 rounds with the same hills, wind and computer for everyone; score rewards winning in fewer
// throws with more health left. Free Play keeps going round after round with a slightly sharper computer.
// "Play A Friend" is a live match over a Supabase Realtime channel (no tables): the player who throws runs the shot
// and then sends the result (craters and health), so the two screens can't drift. "Same Phone" is pass and play.
// The block between SIM BEGIN and SIM END is pure (no React, no DOM) and only uses + - * / and sqrt, which give the
// same answer in every browser; the balance check runs that exact code in Node.
// No facts mid-game and no strip under the board; one fact on the game-over card, about the food you threw most.
// Everything around the board comes from ./kit.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sb } from "@/components/creators/api";
import { appStoreLink } from "@/components/site";
import { type Mode, type Toast, GameScreen, GameHeader, BoardArea, PrizeLogo, GameOver, PauseButton, PausedCard, ReadyCard, HelpModal, ModesHelp, ShellPopups,
  useGameShell, fitCanvas, loadImages, dailySeed, dailyNumber, torontoDate, mulberry32, readBest, saveBest, foodPng } from "./kit";

const GAME = "food-fight";
const LAUNCH = "2026-11-08";   // Today's Challenge #1

// ── SIM BEGIN ──────────────────────────────────────────────────────────────
const W = 400, H = 600, STEP = 1000 / 60, SUB = 4;   // logical board; physics at 60 steps a second, 4 sub-steps each
const G = 0.08, VMAX = 6.4, WIND_ACC = 0.008;       // gravity and full-power speed in board units per step
const MAX_PULL = 90, MIN_PULL = 12;
const FORT_X = [58, 342], FORT_W = 48, FORT_H = 30;
const HP = 100, SHOT_CAP = 12, TOP = 300, LOW = 462, BEDROCK = H - 20;
const TODAY_ROUNDS = 3, DAY_BONUS = 1000;

type FoodDef = { name: string; plural: string; code: string; speed: number; wind: number; blast: number; dmg: number; crater: number;
  pellets: number; aim: number; limit: number; r: number; color: string; tip: string; facts: string[] };
const FOODS: FoodDef[] = [
  { name: "Apple", plural: "apples", code: "1f34e", speed: 1, wind: 1, blast: 30, dmg: 24, crater: 15, pellets: 1, aim: 110, limit: 99, r: 9,
    color: "#e8505b", tip: "The All-Rounder", facts: [
      "A medium apple has about 4 grams of fibre, and a lot of it is in the skin.",
      "Apples float because about a quarter of an apple is air."] },
  { name: "Watermelon", plural: "watermelons", code: "1f349", speed: 0.9, wind: 0.55, blast: 46, dmg: 40, crater: 26, pellets: 1, aim: 50, limit: 2, r: 13,
    color: "#f06a7a", tip: "Big Blast, Hard To Aim", facts: [
      "Watermelon is about 92% water, which is how it got its name.",
      "A cup of diced watermelon has about 45 calories."] },
  { name: "Blueberries", plural: "blueberries", code: "1fad0", speed: 1.04, wind: 1.5, blast: 16, dmg: 10, crater: 8, pellets: 3, aim: 170, limit: 99, r: 6,
    color: "#4a63c8", tip: "3 Small Hits, Easy To Aim", facts: [
      "A cup of blueberries has about 4 grams of fibre.",
      "Blueberries are pale green inside. All that blue is in the skin."] },
];

type Proj = { x: number; y: number; vx: number; vy: number; f: number; age: number; alive: boolean };
type Hit = { x: number; y: number; f: number; miss: boolean };
type World = { ground: number[]; hp: number[]; melons: number[]; shots: number[]; wind: number; projs: Proj[] };
type Brain = { rnd: () => number; sharp: number; k: number; near: number };
type GameMode = "daily" | "endless";

/** Rolling hills from a seed: random heights every 40 units, smoothed, a hill somewhere in the middle, flat pads for the baskets. */
function makeTerrain(seed: number, rough: number): number[] {
  const rnd = mulberry32(seed), pts: number[] = [];
  const hillX = 140 + rnd() * 120, hillH = (40 + rnd() * 70) * rough;
  for (let i = 0; i <= 10; i++) {
    const d = (i * 40 - hillX) / 90, bump = d * d < 1 ? (1 - d * d) * (1 - d * d) : 0;
    pts.push(440 - (rnd() - 0.5) * 50 * rough - hillH * bump);
  }
  const g: number[] = [];
  for (let x = 0; x <= W; x++) {
    const i = Math.min(9, Math.floor(x / 40)), t = (x - i * 40) / 40, s = t * t * (3 - 2 * t);
    g.push(pts[i] + (pts[i + 1] - pts[i]) * s);
  }
  for (const fx of FORT_X) {
    const pad = Math.min(452, Math.max(405, g[fx]));
    for (let x = Math.max(0, fx - 46); x <= Math.min(W, fx + 46); x++) {
      const d = Math.abs(x - fx), k = d <= 30 ? 1 : 1 - (d - 30) / 16, s = k * k * (3 - 2 * k);
      g[x] = g[x] + (pad - g[x]) * s;
    }
  }
  return g.map(y => Math.round(Math.min(LOW, Math.max(TOP, y)) * 100) / 100);
}
function newWorld(seed: number, rough: number): World {
  return { ground: makeTerrain(seed, rough), hp: [HP, HP], melons: [FOODS[1].limit, FOODS[1].limit], shots: [0, 0], wind: 0, projs: [] };
}
function groundAt(g: number[], x: number) {
  if (x < 0 || x > W) return BEDROCK;
  const i = Math.min(W - 1, Math.floor(x)), t = x - i;
  return g[i] + (g[i + 1] - g[i]) * t;
}
function fortBox(w: World, i: number) {
  const y = groundAt(w.ground, FORT_X[i]);
  return { l: FORT_X[i] - FORT_W / 2, r: FORT_X[i] + FORT_W / 2, t: y - FORT_H, b: y };
}
function clampPull(px: number, py: number) {
  const l = Math.sqrt(px * px + py * py);
  return l > MAX_PULL ? { x: (px / l) * MAX_PULL, y: (py / l) * MAX_PULL } : { x: px, y: py };
}
/** The wind for one turn: the same for everyone who has the seed, in steps of 0.1 (shown as 0 to 10). */
function windFor(seed: number, round: number, n: number, max: number) {
  const r = mulberry32((seed + Math.imul(round, 7919) + Math.imul(n + 1, 104729)) | 0)();
  return Math.round((r * 2 - 1) * max * 10) / 10;
}
/** The food leaves from just above the thrower's basket, the opposite way to the pull. Blueberries go as 3 pellets. */
function makeProjs(w: World, who: number, px: number, py: number, f: number): Proj[] {
  const p = clampPull(px, py), food = FOODS[f], b = fortBox(w, who);
  const speeds = food.pellets === 3 ? [0.975, 1, 1.025] : [1];
  return speeds.map(s => ({ x: FORT_X[who], y: b.t - 8, vx: (-p.x / MAX_PULL) * VMAX * food.speed * s, vy: (-p.y / MAX_PULL) * VMAX * food.speed * s, f, age: 0, alive: true }));
}
function launch(w: World, who: number, px: number, py: number, f: number) {
  w.projs = makeProjs(w, who, px, py, f); w.shots[who]++;
  if (f === 1) w.melons[who]--;
}
/** One physics step for one piece of food: wind and gravity, then the ground, the baskets, or off the board. */
function stepProj(w: World, p: Proj): Hit | null {
  const food = FOODS[p.f], ax = w.wind * WIND_ACC * food.wind;
  for (let s = 0; s < SUB; s++) {
    p.vx += ax / SUB; p.vy += G / SUB; p.x += p.vx / SUB; p.y += p.vy / SUB;
    if (p.x < -30 || p.x > W + 30 || p.y > H + 30) { p.alive = false; return { x: p.x, y: p.y, f: p.f, miss: true }; }
    if (p.x >= 0 && p.x <= W && p.y >= groundAt(w.ground, p.x)) { p.alive = false; return { x: p.x, y: groundAt(w.ground, p.x), f: p.f, miss: false }; }
    for (let i = 0; i < 2; i++) {
      const b = fortBox(w, i);
      if (p.x >= b.l && p.x <= b.r && p.y >= b.t && p.y <= b.b) { p.alive = false; return { x: p.x, y: p.y, f: p.f, miss: false }; }
    }
  }
  p.age++;
  if (p.age > 900) { p.alive = false; return { x: p.x, y: p.y, f: p.f, miss: true }; }
  return null;
}
function crater(g: number[], x: number, y: number, r: number) {
  for (let i = Math.max(0, Math.ceil(x - r)); i <= Math.min(W, Math.floor(x + r)); i++) {
    const dx = i - x, dy = Math.sqrt(r * r - dx * dx);
    g[i] = Math.min(BEDROCK, Math.max(g[i], y + dy));
  }
}
function damageAt(w: World, h: Hit, i: number) {
  const b = fortBox(w, i), food = FOODS[h.f];
  const dx = Math.max(b.l - h.x, 0, h.x - b.r), dy = Math.max(b.t - h.y, 0, h.y - b.b), d = Math.sqrt(dx * dx + dy * dy);
  return d >= food.blast ? 0 : Math.round(food.dmg * (1 - d / food.blast));
}
/** Lands a hit: damage to each basket by distance (measured before the crater), then the crater. */
function applyHit(w: World, h: Hit) {
  if (h.miss) return [0, 0];
  const dmg = [damageAt(w, h, 0), damageAt(w, h, 1)];
  w.hp = w.hp.map((v, i) => Math.max(0, v - dmg[i]));
  crater(w.ground, h.x, h.y, FOODS[h.f].crater);
  return dmg;
}
/** Where a throw would land, without changing anything (the middle pellet for blueberries). The computer aims with it. */
function simShot(w: World, who: number, px: number, py: number, f: number): Hit {
  const ps = makeProjs(w, who, px, py, f), p = ps[ps.length > 1 ? 1 : 0];
  let h: Hit | null = null;
  while (!h) h = stepProj(w, p);
  return h;
}
// angle table rounded to 6 places, so every browser's cos and sin give the computer the same aim
const DIRS: number[][] = [];
for (let d = 0; d <= 90; d++) DIRS.push([Math.round(Math.cos((d * Math.PI) / 180) * 1e6) / 1e6, Math.round(Math.sin((d * Math.PI) / 180) * 1e6) / 1e6]);
function pullFor(who: number, deg: number, pow: number) {
  const [c, s] = DIRS[deg], len = (MAX_PULL * pow) / 100, dir = who === 0 ? 1 : -1;
  return { px: Math.round(-dir * c * len * 100) / 100, py: Math.round(s * len * 100) / 100 };
}
/** The computer: tries hundreds of throws in its head, picks the one that lands closest, then misses on purpose by a
 *  random amount that shrinks as it zeroes in during a round, and a little more in later rounds. Never perfect. */
function aiShot(w: World, b: Brain, who = 1) {
  const foe = 1 - who, fb = fortBox(w, foe), tx = FORT_X[foe], ty = fb.t + FORT_H / 2;
  const r = b.rnd();
  const f = w.melons[who] > 0 && b.near < 40 && r < 0.55 ? 1 : r > 0.78 ? 2 : 0;
  let bd = 45, bp = 70, best = Infinity;
  for (let deg = 16; deg <= 80; deg += 2) for (let pow = 24; pow <= 100; pow += 2) {
    const { px, py } = pullFor(who, deg, pow), h = simShot(w, who, px, py, f);
    if (h.miss) continue;
    const own = Math.abs(h.x - FORT_X[who]) < FOODS[f].blast + FORT_W / 2 ? 300 : 0;   // never aim at itself
    const ex = h.x - tx, ey = h.y - ty, d = Math.sqrt(ex * ex + ey * ey) + own;
    if (d < best) { best = d; bd = deg; bp = pow; }
  }
  const noise = () => (b.rnd() + b.rnd() + b.rnd() - 1.5) * 2;   // roughly a bell curve, without trig
  const spread = b.sharp * Math.max(0.3, 1 - 0.12 * b.k);
  const deg = Math.max(5, Math.min(85, Math.round(bd + noise() * 7 * spread)));
  const pow = Math.max(15, Math.min(100, Math.round(bp + noise() * 17 * spread)));
  b.k++;
  return { ...pullFor(who, deg, pow), f };
}
function sharpFor(mode: GameMode, round: number) { return mode === "daily" ? [1.15, 1, 0.88][round - 1] : Math.max(0.6, 1.15 - 0.06 * (round - 1)); }
function windMax(mode: GameMode, round: number) { return mode === "daily" ? [0.4, 0.7, 1][round - 1] : Math.min(1, 0.3 + 0.12 * round); }
function roughFor(mode: GameMode, round: number) { return mode === "daily" ? [0.7, 0.9, 1.1][round - 1] : Math.min(1.2, 0.6 + 0.1 * round); }
/** A round's points for the player: 5 per point of damage dealt, and for a win 500 + 10 per health left + 100 per throw under 10. */
function roundPoints(won: boolean, dealt: number, hpLeft: number, shots: number) {
  return Math.min(HP, dealt) * 5 + (won ? 500 + hpLeft * 10 + Math.max(0, 10 - shots) * 100 : 0);
}
/** -1 still going, 0 or 1 the winner, 2 a tie. Knock both out at once and the thrower loses. After 12 throws each, more health wins. */
function roundWinner(w: World, shooter: number) {
  if (w.hp[0] <= 0 && w.hp[1] <= 0) return 1 - shooter;
  if (w.hp[0] <= 0) return 1;
  if (w.hp[1] <= 0) return 0;
  if (w.shots[0] >= SHOT_CAP && w.shots[1] >= SHOT_CAP) return w.hp[0] > w.hp[1] ? 0 : w.hp[1] > w.hp[0] ? 1 : 2;
  return -1;
}
// ── SIM END ────────────────────────────────────────────────────────────────

const GRIP_Y = 300, GAIN = 1.6, TURN_MS = 30000, THINK_MS = 900, SETTLE_MS = 700;
const TRAY = [30, 78, 126], TRAY_Y = 572, CHIP = 20;
const HINT = { x: 168, y: 474, w: 222, h: 68 };
const FONT = "system-ui, -apple-system, sans-serif";

type Msg =
  | { t: "hello"; id: string; name: string }
  | { t: "lobby"; id: string; name: string; to: string; ready: boolean }   // host to guest: you're paired, here's my name and whether I'm ready
  | { t: "ready"; id: string; ready: boolean }                             // I tapped I'm Ready on the Get Ready card
  | { t: "start"; m: number; seed: number; first: 0 | 1; names: string[]; ids: string[] }
  | { t: "shot"; m: number; n: number; px: number; py: number; f: number }
  | { t: "hit"; m: number; n: number; imp: number[][]; hp: number[] }
  | { t: "pass"; m: number; n: number }
  | { t: "aim"; m: number; n: number; px: number; py: number; f: number }   // the thrower's pull while they drag (whole numbers, 8 a second at most)
  | { t: "aimEnd"; m: number; n: number }                                   // they let go without throwing
  | { t: "again" }
  | { t: "resume"; id: string; host: boolean; snap: unknown }   // back from a break: here is what I have
  | { t: "state"; host: boolean; snap: unknown }               // and here is what I have
  | { t: "bye" };
type GameMsg = Extract<Msg, { n: number }>;
type LivePlay = { kind: "live"; code: string; m: number; seed: number; me: 0 | 1; first: 0 | 1; names: string[] };
type LocalPlay = { kind: "local"; m: number; seed: number; first: 0 | 1; names: string[] };
type Play = { kind: "cpu" } | LivePlay | LocalPlay;
type Phase = "aim" | "think" | "fly" | "await" | "settle" | "pass" | "between" | "over";
type Result = { kind: "won" | "lost"; won: number; lost: number; round: number; squares: string };
type Hud = { score: number; round: number; won: number; lost: number };
type RoundCard = { round: number; won: boolean; tie: boolean; points: number };

// ── live rooms ─────────────────────────────────────────────────────────────
// One Realtime channel per room, "food-fight:CODE". Presence says who's in (2 at most; a third is told it's full).
// The guest says hello and the host answers with "lobby": both see the Get Ready card, and each "ready" is broadcast (and kept
// in presence). Only when both are ready does the host pick the seed and send start; then each throw is a "shot" from the thrower and a
// "hit" with the outcome once it lands. "pass" when a turn's 30 seconds run out, "again" for a rematch, "bye" on leaving.
const ALPHA = "ACDEFHJKMNPRTWXY";   // no I/L/1, O/Q/0, S/5, Z/2, B/8, G/6, U/V
const newCode = () => Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");
type Member = { id: string; name: string; role: "host" | "guest"; at: number; ready?: boolean };
type RoomUi = { s: "waiting" | "joining" | "lobby" | "full" | "empty" | "left" | "error"; code: string };
const LIVE_KEY = "food-fight-live";   // the live match in progress, for picking it back up after a reload
type SavedLive = { code: string; play: LivePlay; snap: Snap | null; t: number };
function readLive(): SavedLive | null {
  try { const v = JSON.parse(localStorage.getItem(LIVE_KEY) ?? "null") as SavedLive | null; return v && Date.now() - v.t < 3 * 3600 * 1000 ? v : null; } catch { return null; }
}
type RoomHandlers = { start: (p: LivePlay) => void; game: (m: GameMsg) => void; left: () => void; snapshot: () => Snap | null; apply: (snap: Snap) => void; resumed: (asked: boolean) => void; away: (on: boolean) => void };

// A saved seat in a room: the same id comes back after a reload or a dropped connection, so it rejoins as the same player.
type Saved = { code: string; role: Member["role"]; id: string; at: number; friendId: string; friendName: string; m: number; first: 0 | 1; loser: 0 | 1; t: number };
// A snapshot of the shared match, for catching up after someone stepped away. Newer wins: a later match (m), then more
// progress (p). Equal progress means the same state, so nothing changes.
type Snap = { m: number; p: number; [k: string]: unknown };
const ROOM_KEY = "food-fight-room", AWAY_MS = 60000;
function readSaved(code?: string): Saved | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(ROOM_KEY) ?? localStorage.getItem(ROOM_KEY) ?? "null") as Saved | null;
    if (!v || (code && v.code !== code) || Date.now() - v.t > 3 * 3600 * 1000) return null;
    return v;
  } catch { return null; }
}

function useRoom(nameRef: { current: string }, handlers: { current: RoomHandlers }) {
  const [ui, setUi] = useState<RoomUi | null>(null);
  const [again, setAgainState] = useState({ me: false, them: false });
  const [ready, setReadyState] = useState({ me: false, them: false });   // the Get Ready card, before the first game
  const [friendName, setFriendName] = useState("Guest");
  const [away, setAwayState] = useState<number | null>(null);            // the friend stepped away: when their 60 seconds run out
  const [reconnecting, setReconnecting] = useState(false);               // we're catching up after our own break
  const s = useRef({ ch: null as RealtimeChannel | null, code: "", role: "host" as Member["role"], id: "", at: 0, friendId: "", friendName: "Guest",
    seen: false, m: 0, first: 0 as 0 | 1, loser: 1 as 0 | 1, last: null as Msg | null, again: { me: false, them: false }, ready: { me: false, them: false }, timers: [] as ReturnType<typeof setTimeout>[],
    away: 0, awayT: null as ReturnType<typeof setTimeout> | null }).current;
  const setAgain = (a: { me: boolean; them: boolean }) => { s.again = a; setAgainState(a); };
  const setReady = (r: { me: boolean; them: boolean }) => { s.ready = r; setReadyState(r); };
  const current = (): Saved => ({ code: s.code, role: s.role, id: s.id, at: s.at, friendId: s.friendId, friendName: s.friendName, m: s.m, first: s.first, loser: s.loser, t: Date.now() });
  const save = () => { if (!s.code) return; const v = JSON.stringify(current()); try { sessionStorage.setItem(ROOM_KEY, v); localStorage.setItem(ROOM_KEY, v); } catch {} };
  const forget = () => { try { sessionStorage.removeItem(ROOM_KEY); localStorage.removeItem(ROOM_KEY); } catch {} };
  const setFriend = (id: string, name: string) => {
    s.friendId = id; s.friendName = name || "Guest"; setFriendName(s.friendName);
    s.seen = !!id && !!s.ch && members(s.ch).some(m => m.id === id);    // already in presence? then a later absence means they left
    save();
  };
  const send = (msg: Msg) => { void s.ch?.send({ type: "broadcast", event: "m", payload: msg }); };
  const track = () => { void s.ch?.track({ id: s.id, name: nameRef.current, role: s.role, at: s.at, ready: s.ready.me }); };   // presence keeps "ready" too
  const clearAway = () => {
    if (s.awayT) clearTimeout(s.awayT); s.awayT = null;
    if (s.away) { s.away = 0; setAwayState(null); handlers.current.away(false); }
  };
  const close = (bye: boolean, keep = false) => {
    s.timers.forEach(t => { clearTimeout(t); clearInterval(t); }); s.timers = [];
    const ch = s.ch; s.ch = null;
    if (ch) {
      if (bye) void ch.send({ type: "broadcast", event: "m", payload: { t: "bye" } });
      void ch.untrack().catch(() => {}); void sb().removeChannel(ch);
    }
    if (keep) return;                                                  // reconnecting: the match carries on
    clearAway(); setReconnecting(false);
    setFriend("", "Guest"); s.seen = false; s.m = 0; s.last = null; setAgain({ me: false, them: false }); setReady({ me: false, them: false });
  };
  const members = (ch: RealtimeChannel) => {
    const st = ch.presenceState() as unknown as Record<string, Member[]>, seen = new Set<string>(), out: Member[] = [];
    for (const k in st) for (const m of st[k]) if (m.id && !seen.has(m.id)) { seen.add(m.id); out.push(m); }
    return out.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  };
  // gone from presence mid-match: give them 60 seconds (they may have just answered a text); "bye" or the 60s ending is final
  const friendGone = (final = false) => {
    if (!s.ch && !s.away) return;
    if (s.role === "host" && !s.m) {                                     // left from the Get Ready card: keep the room open for them
      setFriend("", "Guest"); s.seen = false; setReady({ me: false, them: false }); track(); setUi({ s: "waiting", code: s.code }); return;
    }
    if (!final && s.m) {
      if (s.away) return;
      s.away = Date.now() + AWAY_MS; setAwayState(s.away); handlers.current.away(true);
      s.awayT = setTimeout(() => friendGone(true), AWAY_MS); return;
    }
    const code = s.code; close(false); forget(); setUi({ s: "left", code }); handlers.current.left();
  };
  // the host starts the first game only when both have tapped I'm Ready and the friend is still here
  const hostCheck = () => {
    if (s.role !== "host" || s.m || !s.ch || !s.friendId || !s.ready.me || !s.ready.them) return;
    if (!members(s.ch).some(m => m.id === s.friendId)) return;          // presence will call back when they show up
    begin(0);
  };
  const onPresence = (ch: RealtimeChannel) => {
    const list = members(ch), mine = list.findIndex(m => m.id === s.id);
    if (mine < 0) return;                                              // our own entry hasn't landed yet
    if (s.role === "host" && !s.friendId && list.some((m, i) => i < mine && m.role === "host")) { open(newCode(), "host"); return; }   // code already taken
    if (s.role === "guest" && !s.m && !s.friendId && mine >= 2) { const code = s.code; close(false); setUi({ s: "full", code }); return; }
    if (s.friendId) {
      const f = list.find(m => m.id === s.friendId);
      if (f) { s.seen = true; clearAway(); if (!s.m && f.ready && !s.ready.them) setReady({ ...s.ready, them: true }); hostCheck(); }
      else if (s.seen) friendGone();
    }
  };
  const begin = (first: 0 | 1) => {
    s.m++; s.first = first; setAgain({ me: false, them: false });
    const msg: Msg = { t: "start", m: s.m, seed: Math.floor(Math.random() * 1e9), first, names: [nameRef.current, s.friendName], ids: [s.id, s.friendId] };
    s.last = msg; send(msg); setUi(null); save();
    handlers.current.start({ kind: "live", code: s.code, m: s.m, seed: msg.seed, me: 0, first, names: msg.names });
  };
  const lobbyMsg = (): Msg => ({ t: "lobby", id: s.id, name: nameRef.current, to: s.friendId, ready: s.ready.me });
  // catching up: whoever comes back says "resume" with its snapshot; the other answers with its own; each keeps the newer
  const sendResume = () => { send({ t: "resume", id: s.id, host: s.role === "host", snap: handlers.current.snapshot() }); s.timers.push(setTimeout(() => setReconnecting(false), 4000)); };
  const consider = (snap: Snap | null, fromHost: boolean) => {
    if (!snap) return;
    const mine = handlers.current.snapshot();
    if (!mine || snap.m > mine.m || (snap.m === mine.m && snap.p > mine.p)) {
      if (snap.m > s.m) { s.m = snap.m; save(); }
      handlers.current.apply(snap);
    }
  };
  const onMsg = (msg: Msg) => {
    if (msg.t === "hello") {
      if (s.role !== "host") return;
      if (!s.friendId) { setFriend(msg.id, msg.name); setReady({ me: false, them: false }); track(); setUi({ s: "lobby", code: s.code }); }
      if (msg.id === s.friendId) send(s.m && s.last ? s.last : lobbyMsg());   // in the lobby, or they missed the start
    } else if (msg.t === "lobby") {
      if (s.role !== "guest" || msg.to !== s.id || s.m) return;
      if (!s.friendId) { setFriend(msg.id, msg.name); setUi({ s: "lobby", code: s.code }); }
      if (msg.ready !== s.ready.them) setReady({ ...s.ready, them: msg.ready });
    } else if (msg.t === "ready") {
      if (msg.id !== s.friendId || s.m) return;
      setReady({ ...s.ready, them: msg.ready }); hostCheck();
    } else if (msg.t === "start") {
      if (s.role !== "guest" || msg.ids[1] !== s.id || msg.m <= s.m) return;
      s.m = msg.m; s.first = msg.first; setFriend(msg.ids[0], msg.names[0]); setAgain({ me: false, them: false }); setUi(null);
      handlers.current.start({ kind: "live", code: s.code, m: msg.m, seed: msg.seed, me: 1, first: msg.first, names: msg.names });
    } else if (msg.t === "again") {
      setAgain({ ...s.again, them: true });
      if (s.role === "host" && s.again.me) begin(s.loser);
    } else if (msg.t === "resume") {
      if (msg.id !== s.friendId) return;
      clearAway(); send({ t: "state", host: s.role === "host", snap: handlers.current.snapshot() });
      consider(msg.snap as Snap | null, msg.host); handlers.current.resumed(true);
    } else if (msg.t === "state") {
      consider(msg.snap as Snap | null, msg.host); setReconnecting(false); handlers.current.resumed(false);
    } else if (msg.t === "bye") friendGone(true);
    else handlers.current.game(msg);
  };
  function open(code: string, role: Member["role"], resume?: Saved) {
    close(false, !!resume);
    const prior = resume ?? readSaved(code);                           // same room as before: same seat
    s.code = code; s.role = role; s.id = prior?.id ?? Math.random().toString(36).slice(2, 10); s.at = prior?.at ?? Date.now();
    if (resume) { s.friendId = resume.friendId; s.friendName = resume.friendName || "Guest"; setFriendName(s.friendName); s.m = resume.m; s.first = resume.first; s.loser = resume.loser; s.seen = false; }
    const ch = sb().channel(`food-fight:${code}`, { config: { broadcast: { self: false }, presence: { key: s.id } } });
    s.ch = ch; save();
    ch.on("broadcast", { event: "m" }, ({ payload }) => { if (s.ch === ch) onMsg(payload as Msg); });
    ch.on("presence", { event: "sync" }, () => { if (s.ch === ch) onPresence(ch); });
    ch.subscribe(status => {
      if (s.ch !== ch) return;
      if (status === "SUBSCRIBED") {
        track();
        if (s.m) sendResume();
        else if (role === "guest" && !s.friendId) {
          const hello = () => { if (!s.m && !s.friendId) send({ t: "hello", id: s.id, name: nameRef.current }); };
          hello(); s.timers.push(setInterval(hello, 1500));
          s.timers.push(setTimeout(() => {                             // nobody answering: no host, or the host is busy with someone else
            if (s.m || s.friendId || s.ch !== ch) return;
            const list = members(ch), host = list.some(m => m.role === "host"), others = list.filter(m => m.role === "guest" && m.id !== s.id).length;
            if (!host || others > 0) { close(false); setUi({ s: host ? "full" : "empty", code }); }
          }, 8000));
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (s.m || s.friendId) { setReconnecting(true); s.timers.push(setTimeout(() => { if (s.ch === ch || !s.ch) open(s.code, s.role, current()); }, 1500)); }   // try again, same seat
        else { close(false); setUi({ s: "error", code }); }
      }
    });
    if (resume && resume.m) { setUi(null); setReconnecting(true); }
    else setUi({ s: role === "host" ? "waiting" : "joining", code });
  }
  // back from another app (or the network): make sure we're still in the room, and catch up
  useEffect(() => {
    const back = () => {
      if (document.visibilityState !== "visible" || !s.code || !(s.m || s.friendId)) return;
      const ch = s.ch as unknown as { state?: string } | null, rt = sb().realtime;
      if (!rt.isConnected() || !ch || ch.state !== "joined") { setReconnecting(true); open(s.code, s.role, current()); if (!rt.isConnected()) void rt.disconnect().catch(() => {}).then(() => rt.connect()); }   // the socket may have died while we were away; connect() does nothing while a dead one is still attached
      else { track(); if (s.m) { setReconnecting(true); sendResume(); } }
    };
    document.addEventListener("visibilitychange", back); window.addEventListener("pageshow", back); window.addEventListener("online", back);
    return () => { document.removeEventListener("visibilitychange", back); window.removeEventListener("pageshow", back); window.removeEventListener("online", back); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  return {
    ui, again, ready, friendName, away, reconnecting,
    friend: () => s.friendName,
    ended: (winner: number) => { s.loser = (winner < 0 ? 1 - s.first : 1 - winner) as 0 | 1; save(); },
    isHost: () => s.role === "host",
    code: () => s.code,
    saved: () => { const v = readSaved(); return v && v.m ? v : null; },
    isAway: () => !!s.away,
    pushState: () => send({ t: "state", host: s.role === "host", snap: handlers.current.snapshot() }),   // after a break: here's the latest, in case they missed it
    rejoin: (v: Saved) => open(v.code, v.role, v),
    forget,
    create: () => open(newCode(), "host"),
    join: (code: string) => { const v = readSaved(code); if (v && v.m) open(code, v.role, v); else open(code, "guest"); },
    leave: () => { close(true); forget(); setUi(null); },
    dismiss: () => setUi(null),
    // tapping I'm Ready: tell them straight away, keep it in presence too, and let the host check
    markReady: () => { if (s.ready.me || s.m) return; setReady({ ...s.ready, me: true }); send({ t: "ready", id: s.id, ready: true }); track(); hostCheck(); },
    rematch: () => { setAgain({ ...s.again, me: true }); send({ t: "again" }); if (s.role === "host" && s.again.them) begin(s.loser); },
    send,
  };
}

// ── the game ───────────────────────────────────────────────────────────────
export default function FoodFight() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("daily");
  const [run, setRun] = useState(0);                 // bump to restart
  const [play, setPlay] = useState<Play>({ kind: "cpu" });
  const [started, setStarted] = useState(false);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [roundCard, setRoundCard] = useState<RoundCard | null>(null);
  const [matchEnd, setMatchEnd] = useState<{ winner: number } | null>(null);   // live and same-phone matches; -1 is a tie
  const [passTo, setPassTo] = useState<string | null>(null);
  const [wins, setWins] = useState([0, 0]);
  const [hud, setHud] = useState<Hud>({ score: 0, round: 1, won: 0, lost: 0 });
  const [best, setBest] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [board, setBoard] = useState({ w: 0, h: 0 });
  const [menu, setMenu] = useState<null | "friend" | "local">(null);
  const [code, setCode] = useState("");
  const [names, setNames] = useState(["", ""]);
  const shell = useGameShell(GAME, mode);
  const { reset: resetScores } = shell.scores;
  const pausedRef = useRef(false); pausedRef.current = shell.paused;
  const playRef = useRef(play); playRef.current = play;
  const startRef = useRef<() => void>(() => {});
  const nextRef = useRef<() => void>(() => {});
  const passRef = useRef<() => void>(() => {});
  const engineRef = useRef<{ m: number; remote: (msg: GameMsg) => void; snap: () => Snap | null; apply: (sn: Snap) => void } | null>(null);
  const pendingSnap = useRef<Snap | null>(null);           // a snapshot to load once the live match it belongs to is set up
  const turnBreak = useRef(false);                          // someone stepped away during this turn: share the state when the next one starts
  const [liveMine, setLiveMine] = useState(false);          // live: it's your throw (you can play on while your friend is away)
  const inbox = useRef<GameMsg[]>([]);
  const nameRef = useRef("Guest"); nameRef.current = shell.player?.name || "Guest";
  const handlers = useRef<RoomHandlers>({ start: () => {}, game: () => {}, left: () => {}, snapshot: () => null, apply: () => {}, resumed: () => {}, away: () => {} });
  handlers.current = {
    start: p => { inbox.current = inbox.current.filter(q => q.m >= p.m); setMatchEnd(null); setMenu(null); setPlay(p); },
    game: msg => { const e = engineRef.current; if (e && e.m === msg.m) e.remote(msg); else inbox.current.push(msg); },
    left: () => { setMatchEnd(null); setPlay({ kind: "cpu" }); try { localStorage.removeItem(LIVE_KEY); } catch {} },
    snapshot: () => engineRef.current?.snap() ?? null,
    apply: sn => {
      const P = playRef.current;
      if (P.kind === "live" && P.m === sn.m && engineRef.current) { engineRef.current.apply(sn); return; }
      pendingSnap.current = sn; setMatchEnd(null); setMenu(null);
      setPlay({ kind: "live", code: roomRef.current.code(), m: sn.m, seed: sn.seed as number, me: roomRef.current.isHost() ? 0 : 1, first: sn.first as 0 | 1, names: sn.names as string[] });
    },
    resumed: asked => { if (asked) turnBreak.current = true; },
    away: on => { if (on) turnBreak.current = true; },
  };
  const room = useRoom(nameRef, handlers);
  const roomRef = useRef(room); roomRef.current = room;
  const awayRef = useRef(false); awayRef.current = !!room.away || room.reconnecting;   // live turn timers stop while either of you is away
  const [offer, setOffer] = useState<{ saved: Saved; live: SavedLive } | null>(null);   // a match from before a reload
  const [tick, setTick] = useState(0);
  useEffect(() => { if (!room.away) return; const t = setInterval(() => setTick(x => x + 1), 500); return () => clearInterval(t); }, [room.away]);
  const bestKey = mode === "daily" ? `foodfight-daily-${torontoDate()}` : "foodfight-endless";
  useEffect(() => { setBest(readBest(bestKey)); }, [bestKey]);

  // a shared link (?room=ABCD) joins that room straight away, or picks a saved match back up. Minimising or reloading the
  // page doesn't leave the room (the friend sees "Stepped Away"); only Leave, or leaving the game for another page, does.
  const rejoinNow = (saved: Saved, live: SavedLive) => {
    pendingSnap.current = live.snap; setWins([0, 0]); setMenu(null); setOffer(null); setPlay(live.play); roomRef.current.rejoin(saved);
  };
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? "";
    const saved = roomRef.current.saved(), live = readLive();
    const resumable = !!saved && !!live && live.code === saved.code && live.play.m === saved.m && !(live.snap && live.snap.end != null);
    if (resumable && (!c || c === saved!.code)) { if (c) rejoinNow(saved!, live!); else setOffer({ saved: saved!, live: live! }); }
    else if (/^[A-Z]{4}$/.test(c)) { setWins([0, 0]); roomRef.current.join(c); }
    return () => { roomRef.current.leave(); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const playKey = play.kind === "cpu" ? "cpu" : play.kind === "live" ? `live-${play.code}-${play.m}` : `local-${play.m}`;
  useEffect(() => {
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const { ctx, stop } = fitCanvas(canvas, wrap, W, H, setBoard, 0);   // no fact strip: the board gets the room
    const imgs = loadImages(FOODS.map(f => f.code));
    const P = playRef.current, cpu = P.kind === "cpu", live = P.kind === "live", local = P.kind === "local";
    const me = P.kind === "live" ? P.me : 0;
    const pnames = P.kind === "cpu" ? ["You", "Computer"] : P.kind === "live" ? P.names.map((v, i) => (i !== me && v === "Guest" ? "Friend" : v)) : P.names;   // an unnamed friend is "Friend", not "Guest"
    const seed = P.kind === "cpu" ? (mode === "daily" ? dailySeed(0xf00d5) : Math.floor(Math.random() * 1e9)) : P.seed;
    const human = (i: number) => (cpu ? i === 0 : live ? i === me : true);
    const label = (i: number) => (cpu || live ? (i === me ? "You" : pnames[i]) : pnames[i]);
    const brain: Brain = { rnd: mulberry32(seed ^ 0x5eed1), sharp: 1, k: 0, near: 999 };
    const makeRound = (r: number) => {
      const world = newWorld((seed ^ Math.imul(r, 0x9e3779b1)) | 0, cpu ? roughFor(mode, r) : 0.9);
      brain.sharp = sharpFor(mode, r); brain.k = 0; brain.near = 999;
      return world;
    };

    let round = 1, w = makeRound(1), g0 = w.ground.slice(), turn = 0, shooter = P.kind === "cpu" ? 0 : P.first, viewer = live ? me : shooter;
    let phase: Phase = "aim", started = !cpu, food = 0, wait = 0, turnLeft = TURN_MS, acc = 0, pendingAge = 0;
    let total = 0, dealt = 0, won = 0, lost = 0, throws = 0, realStart = performance.now(), roundAge = 0, raf = 0, last = performance.now();
    // the other player's aim as we last heard it (live), or the computer's (eased toward its throw while it "thinks"); x, y ease toward tx, ty
    const seen = { x: 0, y: 0, tx: 0, ty: 0, f: 0, on: false };
    let cpuShot: { px: number; py: number; f: number } | null = null, aimSent = "", aimAt = 0;
    let turnStart = { ground: [] as number[], hp: [] as number[], melons: [] as number[], shots: [] as number[] }, ended: number | null = null;
    let snap: { ground: number[]; hp: number[] } | null = null, pending: Extract<GameMsg, { t: "hit" }> | null = null, hits: Hit[] = [];
    let drag: { sx: number; sy: number; px: number; py: number; id: number } | null = null;
    const lastAim: ({ deg: number; pow: number } | null)[] = [null, null];
    const squares: string[] = [], thrown = [0, 0, 0], shake = [0, 0];
    const trails: { x: number; y: number }[][] = [];
    const floats: { x: number; y: number; text: string; color: string; age: number; big?: boolean }[] = [];
    const poofs: { x: number; y: number; age: number; color: string; r: number }[] = [];
    const pushHud = () => setHud({ score: total, round, won, lost });
    setOver(false); setResult(null); setRoundCard(null); setToast(null); setPassTo(null); setStarted(!cpu); resetScores(); pushHud();

    const vx = (x: number) => (viewer === 1 ? W - x : x);
    const local2view = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
    const myTurn = () => phase === "aim" && human(shooter) && (live ? shooter === me : true);
    const canAim = () => started && myTurn() && !(pausedRef.current && !live);
    const float = (x: number, y: number, text: string, color: string, big = false) => floats.push({ x, y, text, color, age: 0, big });
    const send = (msg: Msg) => { if (live) roomRef.current.send(msg); };

    function beginTurn() {
      turnStart = { ground: w.ground.slice(), hp: w.hp.slice(), melons: w.melons.slice(), shots: w.shots.slice() }; persist();
      if (live) {
        setLiveMine(shooter === me);
        if (turnBreak.current && !roomRef.current.isAway()) { turnBreak.current = false; roomRef.current.pushState(); }   // the returner catches up exactly
      }
      w.wind = windFor(seed, round, turn, cpu ? windMax(mode as GameMode, round) : 0.7);
      turnLeft = TURN_MS; drag = null; aimSent = ""; Object.assign(seen, { x: 0, y: 0, tx: 0, ty: 0, on: false });
      if (local) { viewer = shooter; phase = "pass"; setPassTo(pnames[shooter]); }
      else if (cpu && shooter === 1) { phase = "think"; wait = THINK_MS; cpuShot = aiShot(w, brain); seen.f = cpuShot.f; seen.on = true; }   // same throw as deciding at the end
      else phase = "aim";
      if (food === 1 && w.melons[local ? shooter : me] <= 0) food = 0;
    }
    passRef.current = () => { if (phase !== "pass") return; phase = "aim"; setPassTo(null); };

    function fire(px: number, py: number, f: number) {
      snap = { ground: w.ground.slice(), hp: w.hp.slice() }; hits = []; pending = null; pendingAge = 0; seen.on = false;
      launch(w, shooter, px, py, f);
      trails.length = 0; w.projs.forEach(() => trails.push([]));
      if (human(shooter)) {
        thrown[f]++; if (cpu) throws++;
        const ux = shooter === 0 ? -px : px;   // toward the other basket
        lastAim[shooter] = { deg: Math.round((Math.atan2(py, ux) * 180) / Math.PI), pow: Math.round((Math.sqrt(px * px + py * py) / MAX_PULL) * 100) };
      }
      if (live && shooter === me) send({ t: "shot", m: P.kind === "live" ? P.m : 0, n: turn, px, py, f });
      phase = "fly"; acc = 0;
    }

    function tick() {
      w.projs.forEach((p, k) => {
        if (!p.alive) return;
        const h = stepProj(w, p);
        trails[k]?.push({ x: p.x, y: p.y }); if (trails[k] && trails[k].length > 14) trails[k].shift();
        if (!h) return;
        hits.push(h);
        if (h.miss) return;
        const d = applyHit(w, h), food = FOODS[h.f];
        poofs.push({ x: h.x, y: h.y, age: 0, color: food.color, r: food.blast });
        if (cpu && shooter === 0) dealt += d[1];
        d.forEach((v, i) => { if (v > 0) { shake[i] = 300; const b = fortBox(w, i); float(FORT_X[i], b.t - 70 - (floats.length % 3) * 14, `-${v}`, "#e8505b"); } });
      });
      if (w.projs.every(p => !p.alive)) resolveShot();
    }

    function resolveShot() {
      const landed = hits.filter(h => !h.miss);
      const changed = !snap || snap.hp[0] !== w.hp[0] || snap.hp[1] !== w.hp[1];
      if (!landed.length) { const h = hits[hits.length - 1]; float(Math.max(50, Math.min(W - 50, h.x)), Math.min(H - 150, Math.max(110, h.y)), "Off The Board", "#5a6b85"); }
      else if (!changed) { const h = landed[landed.length - 1]; float(h.x, h.y - 24, "Missed", "#5a6b85"); }
      if (cpu && shooter === 1) brain.near = landed.reduce((m, h) => { const b = fortBox(w, 0), ex = h.x - FORT_X[0], ey = h.y - (b.t + FORT_H / 2); return Math.min(m, Math.sqrt(ex * ex + ey * ey)); }, 999);
      if (live && shooter !== me) {
        if (pending) { applyAuth(pending); settle(); } else phase = "await";
        return;
      }
      if (live) send({ t: "hit", m: P.kind === "live" ? P.m : 0, n: turn, imp: landed.map(h => [h.x, h.y, h.f]), hp: w.hp.slice() });
      settle();
    }
    // the thrower's result wins: put the ground back as it was before the throw, dig their craters, take their health
    function applyAuth(msg: Extract<GameMsg, { t: "hit" }>) {
      if (snap) w.ground = snap.ground.slice();
      for (const [x, y, f] of msg.imp) crater(w.ground, x, y, FOODS[f].crater);
      w.hp = msg.hp.slice(); w.projs.forEach(p => { p.alive = false; }); pending = null;
    }
    function settle() { phase = "settle"; wait = SETTLE_MS; }
    function doPass() {
      w.shots[shooter]++; drag = null;
      const b = fortBox(w, shooter); float(FORT_X[shooter], b.t - 70, "Time's Up!", "#e09a00");
      settle();
    }
    function next() {
      const win = roundWinner(w, shooter);
      if (win !== -1) { endRound(win); return; }
      turn++; shooter = 1 - shooter; beginTurn();
    }

    const pick = (f: FoodDef) => f.facts[Math.floor(Math.random() * f.facts.length)];
    function endRound(win: number) {
      drag = null;
      if (!cpu) {
        phase = "over"; const winner = win === 2 ? -1 : win;
        ended = winner; turnStart = { ground: w.ground.slice(), hp: w.hp.slice(), melons: w.melons.slice(), shots: w.shots.slice() }; persist();
        if (live) roomRef.current.ended(winner);
        setWins(v => (winner < 0 ? v : v.map((n, i) => (i === winner ? n + 1 : n))));
        setMatchEnd({ winner }); return;
      }
      const youWon = win === 0 || win === 2, pts = roundPoints(youWon, dealt, w.hp[0], w.shots[0]);
      total += pts; squares.push(youWon ? "🟩" : "🟥"); if (youWon) won++; else lost++; pushHud();
      if (mode === "daily" ? won >= 2 : false) { total += DAY_BONUS; finish("won"); }
      else if (mode === "daily" ? lost >= 2 : !youWon) finish("lost");
      else { phase = "between"; setRoundCard({ round, won: youWon, tie: win === 2, points: pts }); }
    }
    function nextRound() {
      if (phase !== "between") return;
      round++; w = makeRound(round); g0 = w.ground.slice(); turn = 0; shooter = 0; dealt = 0; roundAge = 0;
      floats.length = 0; poofs.length = 0; lastAim[0] = null; setRoundCard(null); beginTurn(); pushHud();
    }
    nextRef.current = nextRound;
    function finish(kind: Result["kind"]) {
      phase = "over";
      const top = thrown.indexOf(Math.max(...thrown)), f = FOODS[top];
      if (throws) setToast({ title: `Your Top Throw: ${f.name}`, body: pick(f), img: f.code });
      setResult({ kind, won, lost, round, squares: squares.join("") });
      pushHud(); setOver(true);
      if (total > readBest(bestKey)) { saveBest(bestKey, total); setBest(total); }
      shell.finishRef.current({ score: total, drops: throws, ms: performance.now() - realStart });
    }
    startRef.current = () => { if (started) return; started = true; realStart = performance.now(); setStarted(true); };

    // messages from a live friend, held until the game is ready for them
    const mail: GameMsg[] = [];
    function pump() {
      for (let k = 0; k < mail.length; k++) {
        const msg = mail[k];
        if (msg.n < turn) { mail.splice(k--, 1); continue; }
        if (msg.n !== turn || shooter === me) continue;
        if ((msg.t === "shot" || msg.t === "pass") && phase === "aim") { mail.splice(k--, 1); if (msg.t === "shot") fire(msg.px, msg.py, msg.f); else doPass(); }
        else if (msg.t === "hit" && (phase === "fly" || phase === "await")) {
          mail.splice(k--, 1);
          if (phase === "fly") { pending = msg; pendingAge = 0; } else { applyAuth(msg); settle(); }
        }
      }
    }
    // catching up after a break: the state at the start of the current turn, and loading someone else's
    function takeSnap(): Snap | null {
      if (P.kind !== "live") return null;
      return { m: P.m, p: ended !== null ? 1e5 : turn, seed: P.seed, first: P.first, names: P.names, n: turn, ground: turnStart.ground, hp: turnStart.hp, melons: turnStart.melons, shots: turnStart.shots, end: ended };
    }
    function loadSnap(sn: Snap) {
      w.ground = (sn.ground as number[]).slice(); w.hp = (sn.hp as number[]).slice(); w.melons = (sn.melons as number[]).slice(); w.shots = (sn.shots as number[]).slice();
      w.projs = []; mail.length = 0; pending = null; snap = null; hits = []; drag = null;
      turn = sn.n as number; shooter = (((P.kind === "cpu" ? 0 : P.first) + turn) % 2) as 0 | 1;
      if (sn.end != null) { phase = "over"; ended = sn.end as number; turnStart = { ground: w.ground.slice(), hp: w.hp.slice(), melons: w.melons.slice(), shots: w.shots.slice() }; roomRef.current.ended?.(ended); setMatchEnd({ winner: ended }); persist(); }
      else { ended = null; setMatchEnd(null); beginTurn(); }
    }
    function persist() {
      if (P.kind !== "live") return;
      try { localStorage.setItem(LIVE_KEY, JSON.stringify({ code: P.code, play: P, snap: takeSnap(), t: Date.now() })); } catch {}
    }
    if (P.kind === "live") {
      engineRef.current = { m: P.m, snap: takeSnap, apply: loadSnap, remote: msg => {
        if (msg.t !== "aim" && msg.t !== "aimEnd") { mail.push(msg); return; }
        if (msg.n !== turn || shooter === me || phase !== "aim") return;   // aim is just for show: drop anything stale
        if (msg.t === "aim") Object.assign(seen, { tx: msg.px, ty: msg.py, f: msg.f, on: true }); else Object.assign(seen, { tx: 0, ty: 0 });
      } };
      inbox.current = inbox.current.filter(q => { if (q.m === P.m) { mail.push(q); return false; } return q.m > P.m; });
    } else engineRef.current = null;

    const onDown = (e: PointerEvent) => {
      const p = local2view(e);
      if (!started || drag || (pausedRef.current && !live)) return;
      const t = TRAY.findIndex(x => Math.hypot(p.x - x, p.y - TRAY_Y) < CHIP + 4);
      if (t >= 0) { if (myTurn() && (t !== 1 || w.melons[shooter] > 0)) food = t; return; }
      if (!canAim() || p.y < GRIP_Y) return;
      drag = { sx: p.x, sy: p.y, px: 0, py: 0, id: e.pointerId };
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = local2view(e), c = clampPull((p.x - drag.sx) * GAIN, (p.y - drag.sy) * GAIN);
      drag.px = c.x; drag.py = c.y;
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      onMove(e); const d = drag; drag = null;
      if (!canAim() || Math.hypot(d.px, d.py) < MIN_PULL) { aimEnd(); return; }
      const px = Math.round((viewer === 1 ? -d.px : d.px) * 100) / 100, py = Math.round(d.py * 100) / 100;   // board pull, the same on both screens
      if (food === 1 && w.melons[shooter] <= 0) food = 0;
      fire(px, py, food);
    };
    const onCancel = () => { if (drag) aimEnd(); drag = null; };
    // live: let the other phone see the pull (whole numbers, only when it changed, 8 a second at most), and say when it's dropped
    const aimKey = () => { if (!drag) return `0,0,${food}`; const c = clampPull(drag.px, drag.py); return `${Math.round(viewer === 1 ? -c.x : c.x)},${Math.round(c.y)},${food}`; };
    function aimEnd() { if (live && shooter === me && phase === "aim") { send({ t: "aimEnd", m: P.kind === "live" ? P.m : 0, n: turn }); aimSent = `0,0,${food}`; } }
    function sendAim(t: number) {
      if (!live || shooter !== me || phase !== "aim" || t - aimAt < 125) return;
      const k = aimKey(); if (k === aimSent) return;
      const [px, py, f] = k.split(",").map(Number); aimSent = k; aimAt = t;
      send({ t: "aim", m: P.kind === "live" ? P.m : 0, n: turn, px, py, f });
    }
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onCancel);
    beginTurn();
    if (P.kind === "live" && pendingSnap.current?.m === P.m) { const sn = pendingSnap.current; pendingSnap.current = null; loadSnap(sn); }

    const loop = (t: number) => {
      const dt = Math.max(0, Math.min(100, t - last)); last = t;
      const frozen = !started || (!live && pausedRef.current);
      if (!live && pausedRef.current) drag = null;
      if (!frozen) {
        if (live) pump();
        if (phase === "fly") {
          acc += dt; let n = 0;
          while (acc >= STEP && n < 8 && phase === "fly") { acc -= STEP; n++; tick(); }
          if (n >= 8) acc = 0;
          if (pending && phase === "fly" && (pendingAge += dt) > 3000) { applyAuth(pending); settle(); }   // way behind: catch up
        } else if (phase === "think") {
          wait -= dt;
          const c = cpuShot ?? (cpuShot = aiShot(w, brain)), k = Math.min(1, Math.max(0, 1.4 * (1 - wait / THINK_MS) - 0.2)), e = k * k * (3 - 2 * k);
          seen.tx = c.px * e + Math.sin(t / 70) * 4 * (1 - e); seen.ty = c.py * e + Math.cos(t / 90) * 3 * (1 - e);   // a little wobble, then settle on the throw
          if (wait <= 0) { cpuShot = null; fire(c.px, c.py, c.f); }
        } else if (phase === "settle") {
          wait -= dt; if (wait <= 0) next();
        } else if (phase === "aim" && live) {
          sendAim(t);
          if (!awayRef.current) turnLeft -= dt;                       // paused while either of you is away
          if (turnLeft <= 0 && shooter === me) { send({ t: "pass", m: P.kind === "live" ? P.m : 0, n: turn }); doPass(); }
        }
        roundAge += dt;
        const ease = Math.min(1, dt / 90); seen.x += (seen.tx - seen.x) * ease; seen.y += (seen.ty - seen.y) * ease;
        for (let k = floats.length - 1; k >= 0; k--) { floats[k].age += dt; if (floats[k].age > (floats[k].big ? 2200 : 1100)) floats.splice(k, 1); }
        for (let k = poofs.length - 1; k >= 0; k--) { poofs[k].age += dt; if (poofs[k].age > 500) poofs.splice(k, 1); }
        for (let i = 0; i < 2; i++) shake[i] = Math.max(0, shake[i] - dt);
      }
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    const rr = (x: number, y: number, ww: number, hh: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, ww, hh, r); };
    const text = (s: string, x: number, y: number, size: number, color: string, weight = 700, align: CanvasTextAlign = "center") => {
      ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y);
    };
    function drawFort(i: number) {
      const b = fortBox(w, i), cx = vx(FORT_X[i]) + (shake[i] > 0 ? Math.sin(shake[i] / 18) * 3 : 0), by = b.b;
      const col = cpu || live ? (i === me ? "#3f7fd6" : "#e8505b") : i === 0 ? "#3f7fd6" : "#e8505b";
      ctx.fillStyle = "rgba(16,27,46,0.18)"; ctx.beginPath(); ctx.ellipse(cx, by + 1, 28, 4, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = "#a8733a"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, by - 29, 14, Math.PI, 0); ctx.stroke();   // handle
      const fx = cx + (vx(FORT_X[i]) < W / 2 ? 14 : -14);
      ctx.strokeStyle = "#5a6b85"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, by - 29); ctx.lineTo(fx, by - 52); ctx.stroke();   // flag
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(fx, by - 52); ctx.lineTo(fx + (vx(FORT_X[i]) < W / 2 ? 14 : -14), by - 47); ctx.lineTo(fx, by - 42); ctx.fill();
      ctx.fillStyle = "#d9a35f"; rr(cx - 24, by - 22, 48, 22, 5); ctx.fill();
      ctx.strokeStyle = "#a8733a"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); for (const y of [by - 15, by - 8]) { ctx.moveTo(cx - 22, y); ctx.lineTo(cx + 22, y); }
      for (let x = -16; x <= 16; x += 8) { ctx.moveTo(cx + x, by - 21); ctx.lineTo(cx + x, by - 1); }
      ctx.stroke();
      for (let k = 0; k < 8; k++) for (let j = 0; j < 2; j++) {   // gingham cloth on top
        ctx.fillStyle = (k + j) % 2 ? "#fff" : col; ctx.fillRect(cx - 26 + k * 6.5, by - 30 + j * 4.5, 6.5, 4.5);
      }
      // health, small, right above the basket
      const hp = w.hp[i], bw = 46, hy = by - 64;
      ctx.fillStyle = "rgba(255,255,255,0.85)"; rr(cx - bw / 2 - 2, hy - 2, bw + 4, 10, 5); ctx.fill();
      ctx.fillStyle = hp > 50 ? "#2eaa6e" : hp > 25 ? "#e09a00" : "#e8505b"; rr(cx - bw / 2, hy, (bw * hp) / HP, 6, 3); ctx.fill();
      text(`${label(i)} · ${hp}`, cx, hy - 6, 12, "#101b2e");
    }

    function draw(t: number) {
      ctx.save(); ctx.clearRect(0, 0, W, H);
      rr(0, 0, W, H, 22); ctx.clip();
      const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#d6ecff"); sky.addColorStop(1, "#eef6ff");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (const [cx, cy, s] of [[60, 120, 1], [300, 170, 0.8], [190, 230, 0.6]]) {
        ctx.beginPath(); ctx.arc(cx, cy, 18 * s, 0, 7); ctx.arc(cx + 22 * s, cy - 8 * s, 22 * s, 0, 7); ctx.arc(cx + 46 * s, cy, 16 * s, 0, 7); ctx.fill();
      }

      // the hills: dirt, with grass wherever nothing has been dug out
      const g = w.ground;
      ctx.beginPath(); ctx.moveTo(vx(0), H);
      for (let x = 0; x <= W; x += 2) ctx.lineTo(vx(x), g[x]);
      ctx.lineTo(vx(W), H); ctx.closePath();
      const dirt = ctx.createLinearGradient(0, TOP, 0, H); dirt.addColorStop(0, "#c99560"); dirt.addColorStop(1, "#a06d3f");
      ctx.fillStyle = dirt; ctx.fill();
      ctx.strokeStyle = "#79c25b"; ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
      let on = false;
      for (let x = 0; x <= W; x += 2) {
        if (g[x] <= g0[x] + 1.5) { if (on) ctx.lineTo(vx(x), g[x] + 2); else ctx.moveTo(vx(x), g[x] + 2); on = true; } else on = false;
      }
      ctx.stroke();
      ctx.strokeStyle = "#8a5a30"; ctx.lineWidth = 4; ctx.beginPath(); on = false;   // a darker rim where food dug in
      for (let x = 0; x <= W; x += 2) {
        if (g[x] > g0[x] + 1.5) { if (on) ctx.lineTo(vx(x), g[x] + 1); else ctx.moveTo(vx(x), g[x] + 1); on = true; } else on = false;
      }
      ctx.stroke();
      for (let i = 0; i < 2; i++) drawFort(i);

      // aim: the dotted line (wind not included), and the angle and power by your basket
      const aimer = local ? shooter : me, ab = fortBox(w, aimer), ax = vx(FORT_X[aimer]);
      const pill = (s: number, px: number, py: number, strong: boolean) => {   // angle and power above a basket, from a board pull
        const b = fortBox(w, s), x = vx(FORT_X[s]), ux = s === 0 ? -px : px;
        const deg = Math.round((Math.atan2(py, ux) * 180) / Math.PI), pw = Math.round((Math.hypot(px, py) / MAX_PULL) * 100);
        ctx.fillStyle = "#fff"; rr(x - 46, b.t - 108, 92, 24, 12); ctx.fill();
        ctx.strokeStyle = strong ? "#3f7fd6" : "#e8505b"; ctx.lineWidth = 2; ctx.stroke();
        text(`${deg}°  ${pw}%`, x, b.t - 91, 15, "#101b2e", 800);
      };
      const sling = (s: number, px: number, py: number, f: number) => {      // the food pulled back over a basket, on two bands
        const b = fortBox(w, s), x = vx(FORT_X[s]), fx = x + (viewer === 1 ? -px : px) * 0.4, fy = b.t - 8 + py * 0.4, sz = FOODS[f].r * 2.4;
        ctx.strokeStyle = "#6b3b1f"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 13, b.t - 4); ctx.lineTo(fx, fy); ctx.lineTo(x + 13, b.t - 4); ctx.stroke();
        if (imgs[f].complete) ctx.drawImage(imgs[f], fx - sz / 2, fy - sz / 2, sz, sz);
      };
      // the other side aiming (live friend, or the computer): their food in the sling and the pill, never the dotted line
      if (!local && seen.on && shooter !== me && (phase === "aim" || phase === "think")) {
        sling(shooter, seen.x, seen.y, seen.f);
        if (Math.hypot(seen.tx, seen.ty) >= MIN_PULL && (phase !== "think" || wait < THINK_MS * 0.45)) pill(shooter, seen.x, seen.y, false);   // the computer's pill once it settles
      }
      if (drag && canAim()) {
        const p = clampPull(drag.px, drag.py), pw = Math.round((Math.hypot(p.x, p.y) / MAX_PULL) * 100), f = FOODS[food];
        sling(aimer, viewer === 1 ? -p.x : p.x, p.y, food);
        if (Math.hypot(p.x, p.y) >= MIN_PULL) {
          const bpx = viewer === 1 ? -p.x : p.x, [pr] = makeProjs(w, aimer, bpx, p.y, food);
          const vxx = pr.vx; let x = pr.x, y = pr.y, vy = pr.vy, len = 0, i = 0;
          ctx.fillStyle = "rgba(16,27,46,0.6)";
          while (len < f.aim && i < 400 && y < groundAt(g, x)) {
            vy += G; x += vxx; y += vy; len += Math.hypot(vxx, vy); i++;
            if (i % 3 === 0) { ctx.globalAlpha = Math.max(0.2, 1 - len / (f.aim * 1.1)); ctx.beginPath(); ctx.arc(vx(x), y, 3.2, 0, 7); ctx.fill(); }
          }
          ctx.globalAlpha = 1;
        }
        const deg = Math.round((Math.atan2(p.y, -p.x) * 180) / Math.PI);
        ctx.fillStyle = "#fff"; rr(ax - 46, ab.t - 108, 92, 24, 12); ctx.fill();
        ctx.strokeStyle = "#3f7fd6"; ctx.lineWidth = 2; ctx.stroke();
        text(`${deg}°  ${pw}%`, ax, ab.t - 91, 15, "#101b2e", 800);
      } else if (myTurn() && started && lastAim[aimer]) {
        const la = lastAim[aimer]!;
        text(`Last: ${la.deg}°  ${la.pow}%`, ax, ab.t - 92, 12, "#5a6b85", 600);
      }

      // food in the air, with a short trail; an arrow at the top when it's above the board
      w.projs.forEach((p, k) => {
        if (!p.alive) return;
        const f = FOODS[p.f], s = f.r * 2.4;
        ctx.fillStyle = "rgba(16,27,46,0.18)";
        trails[k]?.forEach((q, j) => { if (j % 2 === 0) { ctx.beginPath(); ctx.arc(vx(q.x), q.y, 1.6, 0, 7); ctx.fill(); } });
        if (p.y < -s / 2) {
          ctx.fillStyle = "#3f7fd6"; ctx.beginPath(); ctx.moveTo(vx(p.x), 4); ctx.lineTo(vx(p.x) - 7, 16); ctx.lineTo(vx(p.x) + 7, 16); ctx.fill();
        } else {
          ctx.save(); ctx.translate(vx(p.x), p.y); ctx.rotate(p.age * 0.15 * (viewer === 1 ? -1 : 1));
          if (imgs[p.f].complete) ctx.drawImage(imgs[p.f], -s / 2, -s / 2, s, s);
          ctx.restore();
        }
      });
      for (const p of poofs) {
        const k = p.age / 500; ctx.globalAlpha = 1 - k; ctx.fillStyle = p.color;
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, d = 6 + p.r * 0.8 * k; ctx.beginPath(); ctx.arc(vx(p.x) + Math.cos(a) * d, p.y - Math.abs(Math.sin(a)) * d, 4 * (1 - k) + 1.5, 0, 7); ctx.fill(); }
      }
      ctx.globalAlpha = 1;

      // top: wind, whose turn, and the turn clock in a live match
      text("WIND", W / 2, 20, 10, "#5a6b85", 700);
      const wd = viewer === 1 ? -w.wind : w.wind, ws = Math.round(Math.abs(w.wind) * 10);
      if (ws === 0) text("Calm", W / 2, 40, 14, "#3f7fd6", 700);
      else {
        const len = 14 + 46 * Math.abs(w.wind), dir = Math.sign(wd), x0 = W / 2 - (dir * len) / 2, x1 = W / 2 + (dir * len) / 2;
        ctx.strokeStyle = "#3f7fd6"; ctx.fillStyle = "#3f7fd6"; ctx.lineWidth = 4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x0, 34); ctx.lineTo(x1 - dir * 6, 34); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1 + dir * 2, 34); ctx.lineTo(x1 - dir * 9, 27); ctx.lineTo(x1 - dir * 9, 41); ctx.fill();
        text(String(ws), x1 + dir * 16, 39, 13, "#3f7fd6", 800);
      }
      if (started && phase !== "over" && phase !== "between") {
        const aiming = !local && shooter !== me && seen.on && Math.hypot(seen.tx, seen.ty) >= MIN_PULL && (phase === "aim" || phase === "think");
        const whose = aiming ? `${pnames[shooter]} Is Aiming...` : cpu ? (shooter === 0 ? "Your Turn" : "Computer's Turn") : live ? (shooter === me ? "Your Turn" : `${pnames[shooter]}'s Turn`) : `${pnames[shooter]}'s Turn`;
        const left = Math.max(0, Math.ceil(turnLeft / 1000));
        text(live && phase === "aim" ? `${whose} · ${left}s` : whose, W / 2, 66, 15, shooter === me || local ? "#101b2e" : "#5a6b85", 800);
        if (live && phase === "aim") {
          ctx.fillStyle = "rgba(16,27,46,0.1)"; rr(W / 2 - 60, 74, 120, 5, 2.5); ctx.fill();
          ctx.fillStyle = left <= 5 ? "#e8505b" : "#3f7fd6"; rr(W / 2 - 60, 74, (120 * Math.max(0, turnLeft)) / TURN_MS, 5, 2.5); ctx.fill();
          if (turnLeft <= 0 && shooter !== me) text(`Waiting For ${pnames[shooter]}...`, W / 2, 96, 12, "#5a6b85", 600);
        }
      }
      if (cpu && roundAge < 1600 && started && phase !== "over") {
        ctx.globalAlpha = Math.min(1, (1600 - roundAge) / 400);
        text(mode === "daily" ? `Round ${round} Of ${TODAY_ROUNDS}` : `Round ${round}`, W / 2, 132, 26, "#101b2e", 800);
        ctx.globalAlpha = 1;
      }

      // the food tray, bottom left, and what the chosen food does
      const mine = myTurn() && started, owner = local ? shooter : me;
      ctx.globalAlpha = mine ? 1 : 0.45;
      FOODS.forEach((f, i) => {
        const x = TRAY[i], none = i === 1 && w.melons[owner] <= 0;
        ctx.globalAlpha = (mine ? 1 : 0.45) * (none ? 0.35 : 1);
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, TRAY_Y, CHIP, 0, 7); ctx.fill();
        ctx.strokeStyle = i === food ? "#3f7fd6" : "rgba(16,27,46,0.15)"; ctx.lineWidth = i === food ? 3.5 : 1.5; ctx.stroke();
        if (imgs[i].complete) ctx.drawImage(imgs[i], x - 14, TRAY_Y - 14, 28, 28);
        if (i === 1) {
          ctx.fillStyle = none ? "#9aa6b8" : "#e8505b"; ctx.beginPath(); ctx.arc(x + 15, TRAY_Y - 15, 8, 0, 7); ctx.fill();
          text(String(w.melons[owner]), x + 15, TRAY_Y - 11, 11, "#fff", 800);
        }
      });
      ctx.globalAlpha = mine ? 1 : 0.6;
      text(FOODS[food].name, 152, TRAY_Y - 3, 13, "#fff", 800, "left");
      text(FOODS[food].tip, 152, TRAY_Y + 14, 12, "rgba(255,255,255,0.9)", 600, "left");
      ctx.globalAlpha = 1;
      if (mine && !drag && w.shots[owner] >= SHOT_CAP - 3 && w.shots[owner] < SHOT_CAP) text(`${SHOT_CAP - w.shots[owner]} Throws Left`, W - 12, TRAY_Y + 14, 12, "#fff", 700, "right");

      // the first throw: show where to drag
      if (mine && !drag && w.shots[owner] === 0 && thrown.every(n => n === 0) && (!cpu || round === 1)) {
        ctx.globalAlpha = 0.6 + 0.25 * Math.sin(t / 300);
        ctx.strokeStyle = "#fff"; ctx.setLineDash([8, 7]); ctx.lineWidth = 2; rr(HINT.x, HINT.y, HINT.w, HINT.h, 16); ctx.stroke(); ctx.setLineDash([]);
        text("Drag Back Anywhere Here", HINT.x + HINT.w / 2, HINT.y + 28, 15, "#fff", 800);
        text("Then Let Go To Throw", HINT.x + HINT.w / 2, HINT.y + 48, 13, "#fff", 600);
        ctx.globalAlpha = 1;
      }

      for (const f of floats) {
        const life = f.big ? 2200 : 1100, a = 1 - f.age / life;
        ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.6));
        text(f.text, Math.max(50, Math.min(W - 50, vx(f.x))), f.y - (f.big ? 0 : f.age * 0.03), f.big ? 24 : 16, f.color, 800);
      }
      ctx.globalAlpha = 1; ctx.restore();
    }

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); stop();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onCancel);
      engineRef.current = null;
    };
  }, [mode, run, playKey, bestKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  const n = dailyNumber(LAUNCH);
  const isCpu = play.kind === "cpu", isLive = play.kind === "live", isLocal = play.kind === "local";
  const me = play.kind === "live" ? play.me : 0;
  const pn = play.kind === "cpu" ? ["You", "Computer"] : play.names;
  const friend = play.kind === "live" ? (play.names[1 - me] === "Guest" ? "Your Friend" : play.names[1 - me]) : "";
  const headline = !result ? "" : mode === "daily"
    ? (result.kind === "won" ? `You Won The Day ${result.won}-${result.lost}! 🎉` : `The Computer Took It ${result.lost}-${result.won}`)
    : `${result.won} Round${result.won === 1 ? "" : "s"} Won, Lost Round ${result.round}`;
  const share = () => {
    if (!result) return;
    const label = mode === "daily" ? `Food Fight #${n} (Today's Challenge)` : "Food Fight (Free Play)";
    const p = shell.scores.posted;
    const rank = p?.rank ? `\n🏆 #${p.rank} of ${p.total} ${mode === "daily" ? "today" : "this week"}` : "";
    const how = mode === "daily" ? (result.kind === "won" ? `Won ${result.won}-${result.lost}` : `Lost ${result.won}-${result.lost}`) : `${result.won} rounds won`;
    shell.share(`${label}\n${hud.score.toLocaleString()} pts · ${how}${rank}\n${result.squares}\nCan you beat it? whatyouate.app/games/food-fight`);
  };
  const toCpu = () => { if (isLive || room.ui) room.leave(); try { localStorage.removeItem(LIVE_KEY); } catch {} setOffer(null); setMatchEnd(null); setMenu(null); setPlay({ kind: "cpu" }); setRun(r => r + 1); };
  const openRoom = () => { setWins([0, 0]); setMenu(null); room.create(); };
  const joinRoom = () => { if (code.length === 4) { setWins([0, 0]); setMenu(null); room.join(code); } };
  const startLocal = () => {
    const nm = names.map((v, i) => v.trim().slice(0, 12) || `Player ${i + 1}`);
    setWins([0, 0]); setMenu(null); setMatchEnd(null);
    setPlay({ kind: "local", m: 1, seed: Math.floor(Math.random() * 1e9), first: 0, names: nm });
  };
  const localRematch = () => {
    if (play.kind !== "local" || !matchEnd) return;
    const first = (matchEnd.winner < 0 ? 1 - play.first : 1 - matchEnd.winner) as 0 | 1;   // the loser throws first
    setMatchEnd(null); setPlay({ ...play, m: play.m + 1, seed: Math.floor(Math.random() * 1e9), first });
  };
  const shareRoom = (c: string) => shell.share(`Play Food Fight with me! Room ${c}: ${window.location.origin}/games/food-fight?room=${c}`);
  const rui = room.ui;
  const playing = isCpu ? started && !over && !roundCard : isLocal ? !matchEnd : false;

  return (
    <GameScreen>
      <GameHeader title="Food Fight" mode={mode} onMode={m => { toCpu(); setMode(m); }} onBoard={() => shell.setBoardOpen(true)} onHelp={shell.help.show} />

      <div className="mt-2 flex items-center justify-between">
        {isCpu ? (<>
          <div><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Score</div><div className="text-2xl font-bold leading-none tabular-nums">{hud.score.toLocaleString()}</div></div>
          <div className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold text-[#3f7fd6]">
            Round {hud.round}{mode === "daily" ? ` of ${TODAY_ROUNDS}` : ""} · {hud.won}-{hud.lost}
          </div>
        </>) : (<>
          <div className="min-w-0"><div className="truncate text-[10px] uppercase tracking-wide text-[#5a6b85]">{isLive ? "You" : pn[0]}</div><div className="text-2xl font-bold leading-none tabular-nums">{wins[isLive ? me : 0]}</div></div>
          <div className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold text-[#3f7fd6]">{play.kind === "live" ? `Live · Room ${play.code}` : "Same Phone"}</div>
        </>)}
        <div className="flex items-center gap-2">
          {isCpu ? <div className="text-right"><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Best</div><div className="text-lg font-semibold leading-none tabular-nums">{best.toLocaleString()}</div></div>
            : <div className="min-w-0 text-right"><div className="max-w-[110px] truncate text-[10px] uppercase tracking-wide text-[#5a6b85]">{isLive ? friend : pn[1]}</div><div className="text-2xl font-bold leading-none tabular-nums">{wins[isLive ? 1 - me : 1]}</div></div>}
          <PauseButton shell={shell} active={playing} />
        </div>
      </div>

      <BoardArea wrapRef={wrapRef} size={board} reserve={0}>
        <canvas ref={canvasRef} className="block rounded-[22px] shadow-[0_14px_40px_rgba(16,42,86,0.18)]" />
        <PrizeLogo shell={shell} active={isCpu && started && !over && !roundCard && !shell.paused && !menu && !rui} />
        <PausedCard shell={shell} active={playing} />

        {isCpu && !started && !over && !menu && !rui && (
          <Card>
            <div className="text-lg font-bold">{mode === "daily" ? `Today's Challenge #${n}` : "Free Play"}</div>
            <p className="mt-1 text-sm text-[#5a6b85]">{mode === "daily" ? "Best of 3 rounds against the computer." : "Win round after round against the computer."}</p>
            <button onClick={() => startRef.current()} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Play The Computer</button>
            <div className="mt-2 flex gap-2">
              <button onClick={() => setMenu("friend")} className="flex-1 rounded-full bg-[#e3effe] py-3 text-sm font-semibold text-[#3f7fd6]">Play A Friend</button>
              <button onClick={() => setMenu("local")} className="flex-1 rounded-full bg-[#e3effe] py-3 text-sm font-semibold text-[#3f7fd6]">Same Phone</button>
            </div>
          </Card>
        )}

        {menu === "friend" && !rui && (
          <Card>
            <div className="text-xl font-bold">Play A Friend</div>
            <p className="mt-1 text-sm text-[#5a6b85]">Play live on two phones. Make a room and send your friend the link.</p>
            <button onClick={openRoom} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Make A Room</button>
            <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#5a6b85]">Got A Code?</div>
            <div className="mt-1 flex gap-2">
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))} placeholder="ABCD" autoCapitalize="characters" autoComplete="off" spellCheck={false}
                onKeyDown={e => { if (e.key === "Enter") joinRoom(); }}
                className="w-0 min-w-0 flex-1 rounded-xl border border-[#d6e2f5] px-3 py-2.5 text-center font-mono text-lg font-bold tracking-[0.3em] outline-none focus:border-[#3f7fd6]" />
              <button onClick={joinRoom} disabled={code.length !== 4} className="rounded-full bg-[#e3effe] px-5 font-semibold text-[#3f7fd6] disabled:opacity-50">Join</button>
            </div>
            <button onClick={() => setMenu(null)} className="mt-3 w-full py-2 text-sm font-semibold text-[#5a6b85]">Back</button>
          </Card>
        )}

        {menu === "local" && (
          <Card>
            <div className="text-xl font-bold">Same Phone</div>
            <p className="mt-1 text-sm text-[#5a6b85]">Two players, one phone. Pass it over after each throw.</p>
            {[0, 1].map(i => (
              <input key={i} value={names[i]} maxLength={12} placeholder={`Player ${i + 1}`} autoComplete="off"
                onChange={e => setNames(v => v.map((x, j) => (j === i ? e.target.value : x)))}
                className="mt-3 w-full rounded-xl border border-[#d6e2f5] px-3 py-2.5 text-base outline-none focus:border-[#3f7fd6]" />
            ))}
            <button onClick={startLocal} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Start</button>
            <button onClick={() => setMenu(null)} className="mt-2 w-full py-2 text-sm font-semibold text-[#5a6b85]">Back</button>
          </Card>
        )}

        {offer && !rui && !isLive && (
          <Card>
            <div className="text-xl font-bold">Rejoin Your Game</div>
            <p className="mt-1 text-sm text-[#5a6b85]">You were in the middle of a match in room {offer.saved.code}.</p>
            <button onClick={() => rejoinNow(offer.saved, offer.live)} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Rejoin</button>
            <button onClick={() => { room.forget(); try { localStorage.removeItem(LIVE_KEY); } catch {} setOffer(null); }} className="mt-2 w-full py-2 text-sm font-semibold text-[#5a6b85]">No Thanks</button>
          </Card>
        )}

        {isLive && room.away && !rui && liveMine && !matchEnd && (
          <div className="pointer-events-none absolute inset-x-0 top-[88px] z-10 flex justify-center">
            <div className="rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-[#3f7fd6] shadow-md">{friend} Stepped Away... {Math.max(0, Math.ceil((room.away - Date.now()) / 1000) + tick * 0)}s · Your Throw</div>
          </div>
        )}
        {isLive && room.away && !rui && (!liveMine || !!matchEnd) && (
          <Card>
            <div className="text-xl font-bold">{friend} Stepped Away...</div>
            <div className="mt-2 text-4xl font-bold tabular-nums text-[#3f7fd6]">{Math.max(0, Math.ceil((room.away - Date.now()) / 1000) + tick * 0)}s</div>
            <p className="mt-2 text-sm text-[#5a6b85]">The game is paused. It picks up right where you left off when they&apos;re back.</p>
            <button onClick={toCpu} className="mt-3 w-full py-2 text-sm font-semibold text-[#5a6b85]">Leave</button>
          </Card>
        )}
        {isLive && room.reconnecting && !room.away && !rui && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
            <div className="rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-[#3f7fd6] shadow-md">Reconnecting...</div>
          </div>
        )}

        {rui?.s === "lobby" && (
          <ReadyCard me={nameRef.current === "Guest" ? "You" : nameRef.current} friend={room.friendName === "Guest" ? "Your Friend" : room.friendName}
            ready={[room.ready.me, room.ready.them]} onReady={room.markReady} onLeave={toCpu} steps={[
              "Pick a food at the bottom left, then drag back on the lower half and let go to throw.",
              "The dots show your aim. Wind pushes light food more.",
              "Hit their basket to knock its health down. First to zero loses.",
              "You get 30 seconds a turn. The host throws first.",
            ]} />
        )}

        {rui && rui.s !== "lobby" && (
          <Card>
            {rui.s === "waiting" && (<>
              <div className="text-sm font-semibold text-[#5a6b85]">Your Room Code</div>
              <div className="mt-1 font-mono text-4xl font-bold tracking-[0.2em]">{rui.code}</div>
              <p className="mt-2 text-sm text-[#5a6b85]">Send your friend the link. The game starts as soon as they join.</p>
              <button onClick={() => shareRoom(rui.code)} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">{shell.copied ? "Link Copied!" : "Share Link"}</button>
              <p className="mt-3 text-sm font-semibold text-[#3f7fd6]">Waiting For Your Friend...</p>
              <button onClick={toCpu} className="mt-1 w-full py-2 text-sm font-semibold text-[#5a6b85]">Cancel</button>
            </>)}
            {rui.s === "joining" && (<>
              <div className="text-xl font-bold">Joining Room {rui.code}</div>
              <p className="mt-2 text-sm font-semibold text-[#3f7fd6]">Connecting...</p>
              <button onClick={toCpu} className="mt-3 w-full py-2 text-sm font-semibold text-[#5a6b85]">Cancel</button>
            </>)}
            {(rui.s === "full" || rui.s === "empty" || rui.s === "error") && (<>
              <div className="text-xl font-bold">{rui.s === "full" ? "Room Full" : rui.s === "empty" ? "No One's Here" : "Can't Connect"}</div>
              <p className="mt-2 text-sm text-[#5a6b85]">{rui.s === "full" ? `Room ${rui.code} already has two players.` : rui.s === "empty" ? `Nobody is in room ${rui.code} right now. Ask your friend to make a room and send you the link.` : "We couldn't reach the game. Check your connection and try again."}</p>
              <button onClick={() => { room.dismiss(); setMenu("friend"); }} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Back</button>
              <button onClick={toCpu} className="mt-2 w-full py-2 text-sm font-semibold text-[#5a6b85]">Play The Computer</button>
            </>)}
            {rui.s === "left" && (<>
              <div className="text-xl font-bold">Your Friend Left</div>
              <p className="mt-2 text-sm text-[#5a6b85]">That match is over.</p>
              <button onClick={openRoom} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Make A New Room</button>
              <button onClick={toCpu} className="mt-2 w-full rounded-full bg-[#e3effe] py-3 font-semibold text-[#3f7fd6]">Play The Computer</button>
            </>)}
          </Card>
        )}

        {isLocal && passTo && !matchEnd && !shell.held && (
          <button onClick={() => passRef.current()} className="absolute inset-0 z-10 flex items-center justify-center rounded-[22px] bg-[#101b2e]/45 p-6">
            <span className="w-full max-w-[260px] rounded-3xl bg-white px-6 py-5 text-center shadow-2xl">
              <span className="block text-sm font-semibold text-[#5a6b85]">Pass To {passTo}</span>
              <span className="mt-0.5 block text-2xl font-bold">{passTo}&apos;s Turn</span>
              <span className="mt-3 block rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Tap To Start</span>
            </span>
          </button>
        )}

        {matchEnd && !rui && (isLive || isLocal) && (
          <Card>
            <div className="text-sm font-semibold text-[#5a6b85]">{play.kind === "live" ? `Room ${play.code}` : "Same Phone"}</div>
            <div className="mt-1 text-2xl font-bold">
              {matchEnd.winner < 0 ? "It's A Tie" : isLive ? (matchEnd.winner === me ? "You Won! 🎉" : `${friend} Won`) : `${pn[matchEnd.winner]} Wins! 🎉`}
            </div>
            <div className="mt-1 text-sm text-[#5a6b85]">
              {isLive ? `You ${wins[me]} · ${friend} ${wins[1 - me]}` : `${pn[0]} ${wins[0]} · ${pn[1]} ${wins[1]}`}
            </div>
            {isLive && room.again.them && !room.again.me && <div className="mt-2 text-sm font-semibold text-[#2eaa6e]">{friend} Wants A Rematch!</div>}
            <button onClick={isLive ? room.rematch : localRematch} disabled={isLive && room.again.me} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white disabled:opacity-70">
              {isLive && room.again.me ? `Waiting For ${friend}...` : "Rematch"}
            </button>
            <button onClick={toCpu} className="mt-2 w-full rounded-full bg-[#e3effe] py-3 font-semibold text-[#3f7fd6]">{isLive ? "Leave" : "Done"}</button>
            <a href={appStoreLink(GAME)} className="mt-3 inline-block text-xs font-semibold text-[#5a6b85] underline">Get WhatYouAte For iPhone</a>
          </Card>
        )}

        {roundCard && !over && (
          <Card>
            <div className="text-sm font-semibold text-[#5a6b85]">Round {roundCard.round} {roundCard.won ? "Won" : "Lost"}</div>
            <div className="mt-0.5 text-3xl font-bold leading-tight tabular-nums">+{roundCard.points.toLocaleString()}</div>
            <div className="text-sm text-[#5a6b85]">{roundCard.tie ? "Tied on health, so you take it" : roundCard.won ? "Nice Throwing!" : "The computer took this one"}</div>
            <button onClick={() => nextRef.current()} className="mt-3 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Next Round</button>
          </Card>
        )}

        {over && isCpu && !menu && !rui && <GameOver label={mode === "daily" ? `Today's Challenge #${n}` : "Free Play"} headline={headline} score={hud.score} best={best} mode={mode}
          posted={shell.scores.posted} joined={!!shell.player} campaign={GAME} copied={shell.copied} fact={toast}
          pitch="Good aim takes practice. So do good habits. WhatYouAte helps with the second one."
          extra={<button onClick={() => setMenu("friend")} className="mt-2 text-sm font-semibold text-[#3f7fd6]">Play A Friend Instead →</button>}
          onBoard={() => shell.setBoardOpen(true)} onJoin={() => shell.setJoinOpen(true)} onAgain={() => setRun(r => r + 1)} onShare={share} />}
      </BoardArea>

      <ShellPopups shell={shell} game={GAME} todayNote="Today's Challenge: same hills, wind and computer for everyone. Resets at midnight." />

      {shell.help.open && (
        <HelpModal onClose={shell.help.close} steps={[
          "Pick a food at the bottom left. Drag back anywhere on the lower half, then let go to throw.",
          "The dots show your aim. Watch the wind at the top: it pushes light food more.",
          "Hit the other picnic basket to knock its health down. First to zero loses.",
          "Play the computer, a friend on their phone, or someone next to you on yours.",
        ]}>
          <div className="mt-3 space-y-1 rounded-2xl bg-[#f0f6fe] p-2.5 text-xs font-semibold text-[#5a6b85]">
            {FOODS.map(f => (
              <div key={f.code} className="flex items-center gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={foodPng(f.code)} alt="" className="h-[18px] w-[18px]" />
                <span><b className="text-[#101b2e]">{f.name}:</b> {f.code === "1f349" ? "big blast, short aim line, 2 a round" : f.code === "1fad0" ? "3 small hits, long aim line" : "the all-rounder"}</span>
              </div>
            ))}
          </div>
          <ModesHelp today="same hills, wind and computer for everyone. Best of 3. Fewer throws and more health left score higher." free="win round after round against a computer that gets a little sharper." />
        </HelpModal>
      )}
    </GameScreen>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[22px] bg-[#101b2e]/35 p-5">
      <div className="w-full max-w-[290px] rounded-3xl bg-white p-5 text-center shadow-2xl">{children}</div>
    </div>
  );
}
