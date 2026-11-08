"use client";

// Melon Bowling: roll a watermelon down a long kitchen counter at 10 bottles of soda and juice. Real bowling scoring over
// 10 frames: strikes, spares and the 10th-frame bonus balls. Put your finger in the bottom area under where you want the
// melon to start, then drag up to roll (further is faster, leaning left or right aims). A faint line shows the aim; spin
// (picked at the bottom) curves it late on the dry end of the counter, and the counter's slope (shown at the top, a new one
// each frame) pulls every roll a little.
// "Today" is one game against the computer with the same slopes and the same computer bowler for everyone; Free Play is a
// new game each time against a computer that gets a little sharper each game. Score: 10 x the bowling score, plus up to 20
// for each full rack where you hit the pocket, plus 300 for beating the computer (150 for a tie).
// "Play A Friend" is live over a Supabase Realtime channel (no tables): frames alternate, and the bowler's phone runs the
// roll and sends the bottles left standing, so the two screens can't drift. The friend sees your melon and aim line move
// while you line up. If someone steps away (another app, a dropped connection, a reload), the other sees "Stepped Away"
// with 60 seconds to come back, can keep bowling on their own turn, and the returner catches up from a snapshot.
// "Same Phone" is pass and play. Live and same-phone games post no scores.
// The block between SIM BEGIN and SIM END is pure (no React, no DOM) and only uses + - * / and sqrt, which give the same
// answer in every browser; the balance check runs that exact code in Node.
// No facts mid-game; one fact on the game-over card. Everything around the board comes from ./kit.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sb } from "@/components/creators/api";
import { appStoreLink } from "@/components/site";
import { type Mode, type Toast, GameScreen, GameHeader, BoardArea, PrizeLogo, GameOver, PauseButton, PausedCard, ReadyCard, HelpModal, ModesHelp, ShellPopups,
  useGameShell, fitCanvas, dailySeed, dailyNumber, torontoDate, mulberry32, readBest, saveBest } from "./kit";

const GAME = "melon-bowling";
const LAUNCH = "2026-11-08";   // Today's Challenge #1
const DAY_SALT = 0xb0771;      // keeps Today's slopes and computer apart from every other game's daily seed

// ── SIM BEGIN ──────────────────────────────────────────────────────────────
// Lane units: x across (the lane is -50 to 50, gutters out to 62), y down the lane from the foul line (head bottle at 420).
const W = 400, H = 600, STEP = 1000 / 60, SUB = 6;      // logical board; physics at 60 steps a second, 6 sub-steps each
const LANE = 50, GUT = 62, HEAD = 420, DECK = 395, PIT = 540;
const RB = 10.5, RP = 6, RH = 4, REACH = 20;             // melon radius, bottle radius, cap radius, how far a falling bottle's cap reaches
const MB = 4.2, MP = 1;                                  // a melon outweighs a bottle about 4 to 1
const VMIN = 2.2, VMAX = 4.3;                            // melon speed per step at 0% and 100% power
const HOOK = 0.013, OIL = 170, DRY = 330, SLOPE = 0.00055;   // spin pulls sideways once past the slick front of the counter; slope pulls all the way
const TOPPLE = 0.3, E_BALL = 0.45, E_PIN = 0.35, FRICTION = 0.032, FALL = 1 / 13, SPIN_I = 140;
const CONTACT_Y = HEAD - RB - RP, POCKET = 6.5, ALL = 1023;
const SPOTS: number[][] = [[0, 420], [-14.5, 445], [14.5, 445], [-29, 470], [0, 470], [29, 470], [-43.5, 495], [-14.5, 495], [14.5, 495], [43.5, 495]];

type Roll = { sx: number; ax: number; pw: number; sp: number };   // start x on the foul line, aim (x at the head bottle's row), power 0-100, spin -2..2
type Pin = { x: number; y: number; vx: number; vy: number; up: boolean; f: number; dx: number; dy: number; w: number; gone: boolean };
type Ball = { x: number; y: number; vx: number; vy: number; sp: number; gutter: boolean; gone: boolean };
type Sim = { ball: Ball; pins: Pin[]; slope: number; steps: number; after: number; contactX: number | null; done: boolean; mask: number };

const q1 = (v: number) => Math.round(v * 10) / 10;
function quantize(r: Roll): Roll {
  return { sx: q1(Math.max(-38, Math.min(38, r.sx))), ax: q1(Math.max(-80, Math.min(80, r.ax))), pw: Math.round(Math.max(0, Math.min(100, r.pw))), sp: Math.round(Math.max(-2, Math.min(2, r.sp))) };
}
function newBall(r: Roll): Ball {
  const dx = r.ax - r.sx, dy = HEAD, l = Math.sqrt(dx * dx + dy * dy), v = VMIN + ((VMAX - VMIN) * r.pw) / 100;
  return { x: r.sx, y: 0, vx: (dx / l) * v, vy: (dy / l) * v, sp: r.sp, gutter: false, gone: false };
}
function newSim(r: Roll, mask: number, slope: number): Sim {
  const pins = SPOTS.map(([x, y], i) => ({ x, y, vx: 0, vy: 0, up: true, f: 0, dx: 0, dy: 1, w: 0, gone: !(mask & (1 << i)) }));
  return { ball: newBall(r), pins, slope, steps: 0, after: 0, contactX: null, done: false, mask };
}
/** The melon alone for one sub-step: spin and slope push it sideways on the lane; off the edge it drops into the gutter. */
function moveBall(b: Ball, slope: number, h: number) {
  if (b.gone) return;
  if (!b.gutter && b.y < DECK) {
    const dry = b.y < OIL ? 0 : b.y > DRY ? 1 : (b.y - OIL) / (DRY - OIL);
    b.vx += (b.sp * HOOK * dry + slope * SLOPE) * h;
  }
  b.x += b.vx * h; b.y += b.vy * h;
  if (!b.gutter && (b.x > LANE || b.x < -LANE)) { b.gutter = true; b.x = b.x > 0 ? 56 : -56; b.vx = 0; }
  if (b.y > PIT || b.vy < 0.05) b.gone = true;
}
function capOf(p: Pin) { const k = REACH * p.f; return { x: p.x + p.dx * k, y: p.y + p.dy * k }; }
function capVel(p: Pin) {
  const k = REACH * p.f, sweep = p.f < 1 ? REACH * FALL : 0;
  return { vx: p.vx + p.dx * sweep - p.dy * p.w * k, vy: p.vy + p.dy * sweep + p.dx * p.w * k };
}
function topple(p: Pin, vx: number, vy: number) {
  p.up = false; p.vx = vx; p.vy = vy; p.f = 0;
  const l = Math.sqrt(vx * vx + vy * vy);
  if (l > 0) { p.dx = vx / l; p.dy = vy / l; }
}
// one bump between a moving body and a bottle. kind: 0 the melon, 1 a down bottle's base, 2 a down bottle's cap
function bump(s: Sim, ai: number, kind: number, ax: number, ay: number, ar: number, avx: number, avy: number, p: Pin, bx: number, by: number, br: number, bvx: number, bvy: number, bcap: boolean) {
  const dx = bx - ax, dy = by - ay, rr = ar + br, d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr || d2 === 0) return;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = rr - d;
  const vrel = (bvx - avx) * nx + (bvy - avy) * ny;
  const ma = kind === 0 ? MB : MP, e = kind === 0 ? E_BALL : E_PIN;
  const a = kind === 0 ? null : s.pins[ai];
  if (p.up) {
    if (vrel >= 0) return;
    const j = (-(1 + e) * vrel) / (1 / ma + 1 / MP);
    if (j >= TOPPLE) {
      topple(p, (j / MP) * nx, (j / MP) * ny);
      push(s, kind, a, -j / ma, nx, ny, kind === 2);
      p.x += nx * pen * 0.5; p.y += ny * pen * 0.5; move(s, kind, a, -pen * 0.5, nx, ny);
    } else {
      push(s, kind, a, (1 + e) * vrel, nx, ny, kind === 2);    // a light tap: the bottle wobbles and stays put
      move(s, kind, a, -pen, nx, ny);
    }
    return;
  }
  // both moving
  move(s, kind, a, -pen * (MP / (ma + MP)), nx, ny);
  p.x += nx * pen * (ma / (ma + MP)); p.y += ny * pen * (ma / (ma + MP));
  if (vrel >= 0) return;
  const j = (-(1 + e) * vrel) / (1 / ma + 1 / MP);
  push(s, kind, a, -j / ma, nx, ny, kind === 2);
  p.vx += (j / MP) * nx; p.vy += (j / MP) * ny;
  if (bcap) { const k = REACH * p.f; p.w += ((p.dx * k) * ny - (p.dy * k) * nx) * j / SPIN_I; }
}
function push(s: Sim, kind: number, a: Pin | null, dv: number, nx: number, ny: number, cap: boolean) {
  if (kind === 0) { s.ball.vx += dv * nx; s.ball.vy += dv * ny; return; }
  if (!a) return;
  a.vx += dv * nx; a.vy += dv * ny;
  if (cap) { const k = REACH * a.f; a.w += ((a.dx * k) * ny - (a.dy * k) * nx) * dv / SPIN_I; }
}
function move(s: Sim, kind: number, a: Pin | null, k: number, nx: number, ny: number) {
  if (kind === 0) { s.ball.x += k * nx; s.ball.y += k * ny; return; }
  if (a) { a.x += k * nx; a.y += k * ny; }
}
function collide(s: Sim) {
  const b = s.ball, ps = s.pins;
  if (!b.gone && !b.gutter && b.y > HEAD - 60) {
    for (let i = 0; i < 10; i++) {
      const p = ps[i]; if (p.gone) continue;
      bump(s, -1, 0, b.x, b.y, RB, b.vx, b.vy, p, p.x, p.y, RP, p.vx, p.vy, false);
      if (!p.up) { const c = capOf(p), cv = capVel(p); bump(s, -1, 0, b.x, b.y, RB, b.vx, b.vy, p, c.x, c.y, RH, cv.vx, cv.vy, true); }
    }
  }
  for (let i = 0; i < 10; i++) {
    const a = ps[i]; if (a.gone || a.up) continue;
    for (let j = 0; j < 10; j++) {
      if (j === i) continue;
      const p = ps[j]; if (p.gone || (!p.up && j < i)) continue;   // each down pair once; down-vs-standing from the moving side
      const ac = capOf(a), acv = capVel(a);
      bump(s, i, 1, a.x, a.y, RP, a.vx, a.vy, p, p.x, p.y, RP, p.vx, p.vy, false);
      bump(s, i, 2, ac.x, ac.y, RH, acv.vx, acv.vy, p, p.x, p.y, RP, p.vx, p.vy, false);
      if (!p.up) {
        const pc = capOf(p), pcv = capVel(p);
        bump(s, i, 1, a.x, a.y, RP, a.vx, a.vy, p, pc.x, pc.y, RH, pcv.vx, pcv.vy, true);
        bump(s, i, 2, ac.x, ac.y, RH, acv.vx, acv.vy, p, pc.x, pc.y, RH, pcv.vx, pcv.vy, true);
      }
    }
  }
}
function movePins(s: Sim, h: number) {
  for (const p of s.pins) {
    if (p.gone || p.up) continue;
    p.x += p.vx * h; p.y += p.vy * h;
    const k = 1 - FRICTION * h; p.vx *= k; p.vy *= k;
    if (p.f < 1) p.f = Math.min(1, p.f + FALL * h);
    if (p.w !== 0) {
      const nx = p.dx - p.dy * p.w * h, ny = p.dy + p.dx * p.w * h, l = Math.sqrt(nx * nx + ny * ny);
      p.dx = nx / l; p.dy = ny / l; p.w *= 1 - 0.06 * h;
      if (p.w > -0.0005 && p.w < 0.0005) p.w = 0;
    }
    if (p.x > GUT - RP) { p.x = GUT - RP; if (p.vx > 0) p.vx = -p.vx * 0.45; }
    if (p.x < -GUT + RP) { p.x = -GUT + RP; if (p.vx < 0) p.vx = -p.vx * 0.45; }
    if (p.y > PIT) p.gone = true;
    if (p.f >= 1 && p.vx * p.vx + p.vy * p.vy < 0.0008) { p.vx = 0; p.vy = 0; }
  }
}
/** One physics step (6 sub-steps). Done once the melon is gone and every bottle is still, or 2.5s after the melon left. */
function stepSim(s: Sim) {
  if (s.done) return;
  const h = 1 / SUB, b = s.ball;
  for (let k = 0; k < SUB; k++) {
    const y0 = b.y;
    moveBall(b, s.slope, h);
    if (s.contactX === null && !b.gutter && y0 < CONTACT_Y && b.y >= CONTACT_Y) s.contactX = b.x - (b.vx * (b.y - CONTACT_Y)) / b.vy;
    movePins(s, h);
    collide(s);
  }
  s.steps++;
  if (b.gone) s.after++;
  const moving = s.pins.some(p => !p.gone && !p.up && (p.vx !== 0 || p.vy !== 0 || p.f < 1));
  if ((b.gone && !moving) || s.after > 150 || s.steps > 900) s.done = true;
}
function standing(s: Sim) { let m = 0; s.pins.forEach((p, i) => { if (p.up && !p.gone) m |= 1 << i; }); return m; }
function count(mask: number) { let n = 0; for (let i = 0; i < 10; i++) if (mask & (1 << i)) n++; return n; }
/** Runs a whole roll without drawing it: standing bottles after, and where the melon met the head bottle's row. */
function runRoll(r: Roll, mask: number, slope: number) {
  const s = newSim(r, mask, slope);
  while (!s.done) stepSim(s);
  return { mask: standing(s), contactX: s.contactX, gutter: s.ball.gutter };
}
/** Where the melon alone would be when it reaches row y (the computer aims with it). Gutter balls report far out. */
function ballAt(r: Roll, slope: number, y: number) {
  const b = newBall(r), h = 1 / SUB;
  while (!b.gone && b.y < y) { moveBall(b, slope, h); if (b.gutter) return b.x > 0 ? 99 : -99; }
  return b.x;
}
/** Points for lining up on the pocket (either side of the head bottle) with a full rack: 20 dead on, 0 at 10 units off. */
function pocketPoints(contactX: number | null) {
  if (contactX === null) return 0;
  const d = Math.min(Math.abs(contactX - POCKET), Math.abs(contactX + POCKET));
  return Math.max(0, 20 - Math.round(d * 2));
}

// ── bowling scoring, per bowler: a list of pins knocked down per ball ──
/** Where the next ball goes: frame 0-9 and ball 0-2; done after the 10th frame. */
function nextBall(rolls: number[]): { frame: number; ball: number; done: boolean } {
  let i = 0;
  for (let f = 0; f < 9; f++) {
    if (i >= rolls.length) return { frame: f, ball: 0, done: false };
    if (rolls[i] === 10) { i++; continue; }
    if (i + 1 >= rolls.length) return { frame: f, ball: 1, done: false };
    i += 2;
  }
  const t = rolls.slice(i);
  if (t.length < 2) return { frame: 9, ball: t.length, done: false };
  if (t.length === 2) return { frame: 9, ball: 2, done: !(t[0] === 10 || t[0] + t[1] === 10) };
  return { frame: 9, ball: 3, done: true };
}
function tenth(rolls: number[]) { let i = 0; for (let f = 0; f < 9 && i < rolls.length; f++) i += rolls[i] === 10 ? 1 : 2; return rolls.slice(i); }
/** Does the next ball get a fresh rack of 10? Ball 1 of a frame, or in the 10th after a strike or a spare. */
function freshRack(rolls: number[]) {
  const nb = nextBall(rolls);
  if (nb.ball === 0) return true;
  if (nb.frame < 9) return false;
  const t = tenth(rolls);
  return nb.ball === 1 ? t[0] === 10 : (t[0] === 10 && t[1] === 10) || (t[0] < 10 && t[0] + t[1] === 10);
}
function framesDone(rolls: number[]) { const nb = nextBall(rolls); return nb.done ? 10 : nb.frame; }
/** Running total after each frame, or null while a strike or spare is still waiting for its bonus balls. */
function frameScores(rolls: number[]): (number | null)[] {
  const out: (number | null)[] = []; let i = 0, total = 0;
  for (let f = 0; f < 10; f++) {
    if (i >= rolls.length) { out.push(null); continue; }
    const a = rolls[i], b = rolls[i + 1], c = rolls[i + 2];
    if (f === 9) {
      const t = rolls.slice(i), nb = nextBall(rolls);
      out.push(nb.done ? (total += t.reduce((x, y) => x + y, 0)) : null); continue;
    }
    if (a === 10) { if (b === undefined || c === undefined) { out.push(null); i++; continue; } total += 10 + b + c; out.push(total); i++; continue; }
    if (b === undefined) { out.push(null); i++; continue; }
    if (a + b === 10) { if (c === undefined) { out.push(null); i += 2; continue; } total += 10 + c; out.push(total); i += 2; continue; }
    total += a + b; out.push(total); i += 2;
  }
  return out;
}
/** The total so far, counting what's known (strikes and spares count 10 until their bonus balls come in). */
function runningTotal(rolls: number[]) {
  const fs = frameScores(rolls); let last = 0, k = -1;
  fs.forEach((v, i) => { if (v !== null) { last = v; k = i; } });
  let i = 0; for (let f = 0; f <= k && i < rolls.length; f++) i += f === 9 ? 3 : rolls[i] === 10 ? 1 : 2;
  return last + rolls.slice(i).reduce((x, y) => x + y, 0);
}
/** The marks in each frame's little boxes: X, /, - for a miss, or the count. */
function frameMarks(rolls: number[]): string[][] {
  const out: string[][] = []; let i = 0;
  const n = (v: number) => (v === 0 ? "-" : String(v));
  for (let f = 0; f < 9; f++) {
    const a = rolls[i], b = rolls[i + 1];
    if (a === undefined) { out.push([]); continue; }
    if (a === 10) { out.push(["X"]); i++; continue; }
    out.push(b === undefined ? [n(a)] : [n(a), a + b === 10 ? "/" : n(b)]); i += 2;
  }
  const t = rolls.slice(i), m: string[] = [];
  t.forEach((v, k) => {
    const fresh = k === 0 || (k === 1 && t[0] === 10) || (k === 2 && (t[1] === 10 && t[0] === 10 || (t[0] < 10 && t[0] + t[1] === 10)));
    if (fresh) m.push(v === 10 ? "X" : n(v));
    else m.push(t[k - 1] + v === 10 ? "/" : n(v));
  });
  out.push(m);
  return out;
}
/** Whose ball it is (0 or 1), or -1 when both have bowled 10 frames. Frames alternate: first bowler, then the other. */
function whoseTurn(rolls: number[][], first: number) {
  const a = first, b = 1 - first, fa = framesDone(rolls[a]), fb = framesDone(rolls[b]);
  if (fa === 10 && fb === 10) return -1;
  return fa > fb ? b : a;
}
/** A split: the head bottle is down and what's left stands in two or more groups with a gap between. */
const NEAR = [[1, 2, 4], [0, 2, 3, 4, 7], [0, 1, 4, 5, 8], [1, 6, 7, 4], [0, 1, 2, 3, 5, 7, 8], [2, 4, 8, 9], [3], [1, 3, 4, 8], [2, 4, 5, 7], [5]];
function isSplit(mask: number) {
  if (mask & 1 || count(mask) < 2) return false;
  const left = [...Array(10).keys()].filter(i => mask & (1 << i)), seen = new Set([left[0]]), todo = [left[0]];
  while (todo.length) { const i = todo.pop()!; for (const j of NEAR[i]) if (mask & (1 << j) && !seen.has(j)) { seen.add(j); todo.push(j); } }
  return seen.size < left.length;
}

// ── lanes and the computer ──
/** The counter's slope for a frame: the same for both bowlers and everyone with the seed; whole steps from -max to max. */
function slopeFor(seed: number, frame: number, max: number) {
  const r = mulberry32((seed + Math.imul(frame + 1, 104729)) | 0)();
  return Math.round((r * 2 - 1) * max);
}
type Brain = { rnd: () => number; aim: number; pow: number; hook: number };
/** What the computer goes for: the pocket on a full rack, otherwise the front bottle left, leaning toward the rest. */
function aiTarget(mask: number, hook: number) {
  if (mask === ALL) return { x: hook < 0 ? POCKET : -POCKET, y: CONTACT_Y };
  const left = SPOTS.map((p, i) => ({ x: p[0], y: p[1], i })).filter(p => mask & (1 << p.i));
  const front = left.reduce((a, p) => (p.y < a.y || (p.y === a.y && Math.abs(p.x) < Math.abs(a.x)) ? p : a), left[0]);
  const cx = left.reduce((a, p) => a + p.x, 0) / left.length, lean = Math.max(-4, Math.min(4, (cx - front.x) * 0.3));
  return { x: front.x + lean, y: front.y - RB - RP };
}
/** The computer finds the roll that would land on its target (it knows the slope and its own spin), then misses by a
 *  random amount: a rough bell curve, sharper or looser by brain.aim (lane units) and brain.pow (power points). */
function aiRoll(mask: number, slope: number, b: Brain): Roll {
  const full = mask === ALL, t = aiTarget(mask, b.hook);
  const sp = full ? b.hook : 0, pw = full ? 84 : 90, sx = full ? (b.hook < 0 ? 18 : -18) : Math.max(-30, Math.min(30, -t.x * 0.6));
  let lo = -80, hi = 80;
  for (let k = 0; k < 26; k++) { const mid = (lo + hi) / 2; if (ballAt({ sx, ax: mid, pw, sp }, slope, t.y) < t.x) lo = mid; else hi = mid; }
  const noise = () => (b.rnd() + b.rnd() + b.rnd() - 1.5) * 2;
  return quantize({ sx, ax: (lo + hi) / 2 + noise() * b.aim, pw: pw + noise() * b.pow, sp });
}
// ── SIM END ────────────────────────────────────────────────────────────────

// ── board layout and timing ────────────────────────────────────────────────
const PAD_Y = 470, CHIP_Y = 578, CHIP_R = 15, CHIPS = [34, 72, 110, 148, 186];   // the drag area, and the spin chips along the bottom
const HINT = { x: 70, y: 486, w: 260, h: 64 };
const PULL_FULL = 55, MIN_PULL = 12, AIM_GAIN = 0.45, HOME_S = 2.75;              // drag up 55 for full power; 1px sideways = 0.45 lane units of aim
const TURN_MS = 30000, THINK_MS = 1100, SETTLE_MS = 1100, SWEEP_MS = 600, AWAIT_MS = 5000;
const CPU_AIM = 6;            // the computer's miss spread on Today, in lane units (see the balance check)
const BOTTLE_H = 30, JUICE = [0, 4, 6, 9];
const SPIN_NAMES = ["Big Curve Left", "Curve Left", "Straight", "Curve Right", "Big Curve Right"];
const FONT = "system-ui, -apple-system, sans-serif";
const FACTS = ["Watermelon is about 92% water, which is how it got its name.", "A cup of diced watermelon has about 45 calories."];

type Msg =
  | { t: "hello"; id: string; name: string }
  | { t: "lobby"; id: string; name: string; to: string; ready: boolean }   // host to guest: you're paired, here's my name and whether I'm ready
  | { t: "ready"; id: string; ready: boolean }                             // I tapped I'm Ready on the Get Ready card
  | { t: "start"; m: number; seed: number; first: 0 | 1; names: string[]; ids: string[] }
  | { t: "aim"; m: number; n: number; sx: number; ax: number; pw: number; sp: number }   // the bowler lining up (about 6 a second at most)
  | { t: "aimEnd"; m: number; n: number }                                   // they let go without rolling
  | { t: "roll"; m: number; n: number; sx: number; ax: number; pw: number; sp: number }  // ball n is rolling: both screens run it
  | { t: "result"; m: number; n: number; mask: number }                    // the bowler's answer: bottles left standing after ball n
  | { t: "pass"; m: number; n: number }                                     // the bowler's 30 seconds ran out: ball n is a miss
  | { t: "again" }
  | { t: "resume"; id: string; host: boolean; snap: unknown }               // back from a break: here is what I have
  | { t: "state"; host: boolean; snap: unknown }                            // and here is what I have
  | { t: "bye" };
type GameMsg = Extract<Msg, { n: number }>;
type LivePlay = { kind: "live"; code: string; m: number; seed: number; me: 0 | 1; first: 0 | 1; names: string[] };
type LocalPlay = { kind: "local"; m: number; seed: number; first: 0 | 1; names: string[] };
type Play = { kind: "cpu" } | LivePlay | LocalPlay;
type Phase = "aim" | "think" | "roll" | "await" | "settle" | "sweep" | "pass" | "over";
type Result = { you: number; cpu: number; pts: number; pockets: number; marks: string[][] };
type Hud = { rolls: number[][]; bowler: number; first: number };

// ── live rooms ─────────────────────────────────────────────────────────────
// One Realtime channel per room, "melon-bowling:CODE". Presence says who's in (2 at most; a third is told it's full).
// The guest says hello and the host answers with "lobby": both see the Get Ready card, and each "ready" is broadcast (and
// kept in presence). When both are ready the host picks the seed and sends start. Then for each ball the bowler sends
// "aim" while lining up, "roll" when they let go, and "result" when the bottles settle; "pass" when their 30 seconds run
// out. "again" for a rematch, "bye" on leaving. Someone dropping out of presence mid-game gets 60 seconds ("Stepped
// Away"); coming back sends "resume" with a snapshot, the other answers "state" with theirs, and both keep the newer.
const ALPHA = "ACDEFHJKMNPRTWXY";   // no I/L/1, O/Q/0, S/5, Z/2, B/8, G/6, U/V
const newCode = () => Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");
type Member = { id: string; name: string; role: "host" | "guest"; at: number; ready?: boolean };
type RoomUi = { s: "waiting" | "joining" | "lobby" | "full" | "empty" | "left" | "error"; code: string };
// A snapshot of the shared game at the start of the next ball, for catching up. Newer wins: a later game (m), then more balls (p).
type Snap = { m: number; p: number; [k: string]: unknown };
const LIVE_KEY = "melon-bowling-live", ROOM_KEY = "melon-bowling-room", AWAY_MS = 60000;
type SavedLive = { code: string; play: LivePlay; snap: Snap | null; t: number };
function readLive(): SavedLive | null {
  try { const v = JSON.parse(localStorage.getItem(LIVE_KEY) ?? "null") as SavedLive | null; return v && Date.now() - v.t < 3 * 3600 * 1000 ? v : null; } catch { return null; }
}
// A saved seat in a room: the same id comes back after a reload or a dropped connection, so it rejoins as the same player.
type Saved = { code: string; role: Member["role"]; id: string; at: number; friendId: string; friendName: string; m: number; first: 0 | 1; loser: 0 | 1; t: number };
function readSaved(code?: string): Saved | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(ROOM_KEY) ?? localStorage.getItem(ROOM_KEY) ?? "null") as Saved | null;
    if (!v || (code && v.code !== code) || Date.now() - v.t > 3 * 3600 * 1000) return null;
    return v;
  } catch { return null; }
}
type RoomHandlers = { start: (p: LivePlay) => void; game: (m: GameMsg) => void; left: () => void; snapshot: () => Snap | null; apply: (snap: Snap) => void; resumed: (asked: boolean) => void; away: (on: boolean) => void };

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
  const members = (ch: RealtimeChannel) => {
    const st = ch.presenceState() as unknown as Record<string, Member[]>, seen = new Set<string>(), out: Member[] = [];
    for (const k in st) for (const m of st[k]) if (m.id && !seen.has(m.id)) { seen.add(m.id); out.push(m); }
    return out.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  };
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
    if (keep) return;                                                  // reconnecting: the game carries on
    clearAway(); setReconnecting(false);
    setFriend("", "Guest"); s.seen = false; s.m = 0; s.last = null; setAgain({ me: false, them: false }); setReady({ me: false, them: false });
  };
  // gone from presence mid-game: give them 60 seconds (they may have just answered a text); "bye" or the 60s ending is final
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
  const consider = (snap: Snap | null) => {
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
      consider(msg.snap as Snap | null); handlers.current.resumed(true);
    } else if (msg.t === "state") {
      consider(msg.snap as Snap | null); setReconnecting(false); handlers.current.resumed(false);
    } else if (msg.t === "bye") friendGone(true);
    else handlers.current.game(msg);
  };
  function open(code: string, role: Member["role"], resume?: Saved) {
    close(false, !!resume);
    const prior = resume ?? readSaved(code);                           // same room as before: same seat
    s.code = code; s.role = role; s.id = prior?.id ?? Math.random().toString(36).slice(2, 10); s.at = prior?.at ?? Date.now();
    if (resume) { s.friendId = resume.friendId; s.friendName = resume.friendName || "Guest"; setFriendName(s.friendName); s.m = resume.m; s.first = resume.first; s.loser = resume.loser; s.seen = false; }
    const ch = sb().channel(`melon-bowling:${code}`, { config: { broadcast: { self: false }, presence: { key: s.id } } });
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
      if (!rt.isConnected()) {                                        // the socket died while we were away: a dead socket never reconnects by itself
        setReconnecting(true);                                        // (connect() is a no-op while the old one is still attached), so tear it down first
        void rt.disconnect().catch(() => {}).then(() => { if (!s.code) return; rt.connect(); open(s.code, s.role, current()); });
      } else if (!ch || ch.state !== "joined") { setReconnecting(true); open(s.code, s.role, current()); }
      else { track(); if (s.m) { setReconnecting(true); sendResume(); } }
    };
    document.addEventListener("visibilitychange", back); window.addEventListener("pageshow", back); window.addEventListener("online", back);
    return () => { document.removeEventListener("visibilitychange", back); window.removeEventListener("pageshow", back); window.removeEventListener("online", back); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  return {
    ui, again, ready, friendName, away, reconnecting,
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
const FREE_KEY = "melonbowling-free-level";   // Free Play games this session: the computer sharpens a little each one
function readLevel() { try { return Number(sessionStorage.getItem(FREE_KEY) || 0); } catch { return 0; } }

export default function MelonBowling() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("daily");
  const [run, setRun] = useState(0);                 // bump to restart
  const [play, setPlay] = useState<Play>({ kind: "cpu" });
  const [started, setStarted] = useState(false);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [matchEnd, setMatchEnd] = useState<{ winner: number; scores: number[] } | null>(null);   // live and same-phone games; -1 is a tie
  const [passTo, setPassTo] = useState<string | null>(null);
  const [wins, setWins] = useState([0, 0]);
  const [hud, setHud] = useState<Hud>({ rolls: [[], []], bowler: 0, first: 0 });
  const [best, setBest] = useState(0);
  const [fact, setFact] = useState<Toast | null>(null);
  const [board, setBoard] = useState({ w: 0, h: 0 });
  const [menu, setMenu] = useState<null | "friend" | "local">(null);
  const [code, setCode] = useState("");
  const [names, setNames] = useState(["", ""]);
  const shell = useGameShell(GAME, mode);
  const { reset: resetScores } = shell.scores;
  const pausedRef = useRef(false); pausedRef.current = shell.paused;
  const playRef = useRef(play); playRef.current = play;
  const startRef = useRef<() => void>(() => {});
  const passRef = useRef<() => void>(() => {});
  const engineRef = useRef<{ m: number; remote: (msg: GameMsg) => void; snap: () => Snap | null; apply: (sn: Snap) => void } | null>(null);
  const pendingSnap = useRef<Snap | null>(null);           // a snapshot to load once the live game it belongs to is set up
  const turnBreak = useRef(false);                         // someone was away: push our state at the next ball so nobody's behind
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
  const awayRef = useRef(false); awayRef.current = !!room.away || room.reconnecting;   // the live turn timer stops while either of you is away
  const [offer, setOffer] = useState<{ saved: Saved; live: SavedLive } | null>(null);   // a game from before a reload
  const [, setTick] = useState(0);
  useEffect(() => { if (!room.away) return; const t = setInterval(() => setTick(x => x + 1), 500); return () => clearInterval(t); }, [room.away]);
  const bestKey = mode === "daily" ? `melonbowling-daily-${torontoDate()}` : "melonbowling-endless";
  useEffect(() => { setBest(readBest(bestKey)); }, [bestKey]);

  // a shared link (?room=ABCD) joins that room straight away, or picks a saved game back up. Minimising or reloading the
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
    const P = playRef.current, cpu = P.kind === "cpu", live = P.kind === "live", local = P.kind === "local";
    const me = P.kind === "live" ? P.me : 0, first = P.kind === "cpu" ? 0 : P.first;
    const pnames = P.kind === "cpu" ? ["You", "Computer"] : P.kind === "live" ? P.names.map((v, i) => (i !== me && v === "Guest" ? "Your Friend" : v)) : P.names;
    const level = readLevel();
    const seed = P.kind === "cpu" ? (mode === "daily" ? dailySeed(DAY_SALT) : Math.floor(Math.random() * 1e9)) : P.seed;
    const slopeMax = cpu ? (mode === "daily" ? 3 : Math.min(3, 2 + Math.floor(level / 3))) : 2;
    const slopes = Array.from({ length: 10 }, (_, f) => slopeFor(seed, f, slopeMax));
    const brain: Brain = { rnd: mulberry32(seed ^ 0x5eed7), aim: mode === "daily" || !cpu ? CPU_AIM : Math.max(3, CPU_AIM + 1 - 0.5 * level), pow: 6, hook: -1 };
    const human = (i: number) => (cpu ? i === 0 : live ? i === me : true);
    const liveM = P.kind === "live" ? P.m : 0;

    let rolls: number[][] = [[], []], mask = ALL, n = 0, bowler: number = first, lastBowler = -1, phase: Phase = "aim", started = !cpu;
    let wait = 0, turnLeft = TURN_MS, acc = 0, raf = 0, last = performance.now(), realStart = performance.now();
    let sim: Sim | null = null, shown: number = ALL, pending: number | null = null, pendingAge = 0, awaitAge = 0, ended: number | null = null;
    let pockets = 0, cpuRoll: Roll | null = null, rolled = false, rackAge = 9999, sweepFresh = false;
    let cam = 0, popup: { text: string; age: number; color: string } | null = null;
    const startX = [0, 0], spinOf = [0, 0];
    let drag: { x0: number; y0: number; sx: number; dx: number; dy: number; id: number } | null = null;
    // the other bowler lining up (live friend or the computer): x, a, p ease toward their targets
    const seen = { sx: 0, ax: 0, pw: 0, tsx: 0, tax: 0, tpw: 0, sp: 0, on: false };
    let aimSent = "", aimAt = 0;
    const pushHud = () => setHud({ rolls: rolls.map(r => r.slice()), bowler, first });
    setOver(false); setResult(null); setFact(null); setPassTo(null); setStarted(!cpu); setMatchEnd(null); resetScores(); pushHud();

    const local2view = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
    const send = (msg: Msg) => { if (live) roomRef.current.send(msg); };
    const myTurn = () => phase === "aim" && human(bowler) && (live ? bowler === me : true);
    const canAim = () => started && myTurn() && !(pausedRef.current && !live);
    const frameNow = () => nextBall(rolls[bowler]).frame;
    const preview = (): Roll | null => {
      if (!drag) return null;
      return quantize({ sx: drag.sx, ax: drag.sx + drag.dx * AIM_GAIN, pw: (drag.dy / PULL_FULL) * 100, sp: spinOf[bowler] });
    };

    function beginBall() {
      bowler = whoseTurn(rolls, first);
      if (bowler < 0) { endGame(); return; }
      if (freshRack(rolls[bowler])) mask = ALL;
      if (sweepFresh) { rackAge = 0; sweepFresh = false; }
      shown = mask; sim = null; pending = null; awaitAge = 0;
      turnLeft = TURN_MS; drag = null; aimSent = ""; seen.on = false; cpuRoll = null;
      seen.sx = seen.tsx = seen.ax = seen.tax = startX[bowler]; seen.pw = seen.tpw = 0;
      if (live && turnBreak.current && !roomRef.current.isAway()) { turnBreak.current = false; roomRef.current.pushState(); }   // the returner catches up exactly
      const newFrame = bowler !== lastBowler; lastBowler = bowler;
      if (local && newFrame) { phase = "pass"; setPassTo(pnames[bowler]); }
      else if (cpu && bowler === 1) {
        phase = "think"; wait = THINK_MS; cpuRoll = aiRoll(mask, slopes[frameNow()], brain);
        Object.assign(seen, { tsx: cpuRoll.sx, tax: cpuRoll.ax, tpw: 0, sp: cpuRoll.sp, on: true });
      } else phase = "aim";
      pushHud(); persist();
    }
    passRef.current = () => { if (phase !== "pass") return; phase = "aim"; setPassTo(null); };

    function fire(r: Roll) {
      const q = quantize(r);
      sim = newSim(q, mask, slopes[frameNow()]); pending = null; pendingAge = 0; acc = 0; drag = null; seen.on = false;
      if (human(bowler)) { startX[bowler] = q.sx; rolled = true; }
      if (live && bowler === me) send({ t: "roll", m: liveM, n, ...q });
      phase = "roll";
    }
    // a roll has settled: the bowler's phone decides (live), everyone else waits for its answer
    function rollDone() {
      if (!sim) return;
      const m2 = standing(sim);
      if (live && bowler !== me) {
        if (pending !== null) applyAuth(pending); else { phase = "await"; awaitAge = 0; }
        return;
      }
      if (live) send({ t: "result", m: liveM, n, mask: m2 });
      finishBall(m2, sim.contactX, false);
    }
    // the bowler's answer wins: bottles it says are standing go back up, the rest go down
    function applyAuth(m2: number) {
      if (sim) sim.pins.forEach((p, i) => {
        const up = !!(m2 & (1 << i));
        if (up && (!p.up || p.gone)) Object.assign(p, { x: SPOTS[i][0], y: SPOTS[i][1], vx: 0, vy: 0, up: true, f: 0, w: 0, gone: false });
        else if (!up && p.up && !p.gone) { p.up = false; p.f = 1; }
      });
      pending = null; finishBall(m2, null, false);
    }
    function finishBall(m2: number, contactX: number | null, timeUp: boolean) {
      const before = mask, fresh = before === ALL, knocked = count(before) - count(m2);
      if (cpu && bowler === 0 && fresh && !timeUp) pockets += pocketPoints(contactX);
      rolls[bowler].push(knocked); n++;
      const gutter = !!sim?.ball.gutter;
      const text = timeUp ? "Time's Up" : knocked === 10 && fresh ? "Strike!" : !fresh && m2 === 0 ? "Spare!" : knocked === 0 ? (gutter ? "Gutter" : "Missed") : fresh && isSplit(m2) ? `Split · ${knocked}` : `${knocked} Bottle${knocked === 1 ? "" : "s"}`;
      popup = { text, age: 0, color: text === "Strike!" || text === "Spare!" ? "#2eaa6e" : timeUp || knocked === 0 ? "#5a6b85" : "#101b2e" };
      const next = whoseTurn(rolls, first);
      mask = next === bowler && next >= 0 && !freshRack(rolls[bowler]) ? m2 : ALL;
      sweepFresh = mask === ALL;
      phase = "settle"; wait = timeUp ? 700 : SETTLE_MS;
      pushHud(); persist();
    }
    function endGame() {
      phase = "over"; drag = null;
      const a = runningTotal(rolls[0]), b = runningTotal(rolls[1]), winner = a > b ? 0 : b > a ? 1 : -1;
      if (!cpu) {
        ended = winner; persist();
        if (live) roomRef.current.ended(winner);
        setWins(v => (winner < 0 ? v : v.map((x, i) => (i === winner ? x + 1 : x))));
        setMatchEnd({ winner, scores: [a, b] }); return;
      }
      const pts = a * 10 + pockets + (a > b ? 300 : a === b ? 150 : 0);
      setFact({ title: "Watermelon Fact", body: FACTS[Math.floor(Math.random() * FACTS.length)], img: "1f349" });
      setResult({ you: a, cpu: b, pts, pockets, marks: frameMarks(rolls[0]) }); setOver(true);
      if (pts > readBest(bestKey)) { saveBest(bestKey, pts); setBest(pts); }
      if (mode !== "daily") { try { sessionStorage.setItem(FREE_KEY, String(level + 1)); } catch {} }
      shell.finishRef.current({ score: pts, drops: rolls[0].length, ms: performance.now() - realStart });
    }
    startRef.current = () => { if (started) return; started = true; realStart = performance.now(); setStarted(true); };

    // catching up after a break: the state at the start of the next ball, and loading someone else's
    function takeSnap(): Snap | null {
      if (P.kind !== "live") return null;
      return { m: P.m, p: n, seed: P.seed, first: P.first, names: P.names, rolls: rolls.map(r => r.slice()), mask, end: ended };
    }
    function loadSnap(sn: Snap) {
      rolls = (sn.rolls as number[][]).map(r => r.slice()); n = rolls[0].length + rolls[1].length; mask = sn.mask as number;
      sim = null; pending = null; mail.length = 0; drag = null; popup = null; shown = mask; lastBowler = -1;
      if (sn.end != null) { phase = "over"; ended = sn.end as number; bowler = -1; pushHud(); roomRef.current.ended(ended); setMatchEnd({ winner: ended, scores: [runningTotal(rolls[0]), runningTotal(rolls[1])] }); persist(); }
      else { ended = null; setMatchEnd(null); beginBall(); }
    }
    function persist() {
      if (P.kind !== "live") return;
      try { localStorage.setItem(LIVE_KEY, JSON.stringify({ code: P.code, play: P, snap: takeSnap(), t: Date.now() })); } catch {}
    }

    // messages from a live friend, held until the game is ready for them
    const mail: GameMsg[] = [];
    function pump() {
      const behind = mail.some(q => q.n > n);
      for (let k = 0; k < mail.length; k++) {
        const msg = mail[k];
        if (msg.n < n) { mail.splice(k--, 1); continue; }
        if (msg.n !== n || bowler === me || bowler < 0) continue;
        if (msg.t === "result") {
          if (phase === "roll") { mail.splice(k--, 1); pending = msg.mask; pendingAge = 0; }
          else if (phase === "await" || (phase === "aim" && (behind || !mail.some(q => q.t === "roll" && q.n === n)))) { mail.splice(k--, 1); applyAuth(msg.mask); return; }
        } else if (msg.t === "roll" && phase === "aim") {
          if (behind && mail.some(q => q.t === "result" && q.n === n)) { mail.splice(k--, 1); continue; }   // way behind: skip the replay
          mail.splice(k--, 1); fire(msg);
        } else if (msg.t === "pass" && phase === "aim") { mail.splice(k--, 1); finishBall(mask, null, true); return; }
      }
    }
    if (P.kind === "live") {
      engineRef.current = { m: P.m, snap: takeSnap, apply: loadSnap, remote: msg => {
        if (msg.t !== "aim" && msg.t !== "aimEnd") { mail.push(msg); return; }
        if (msg.n !== n || bowler === me || phase !== "aim") return;   // lining up is just for show: drop anything stale
        if (msg.t === "aim") Object.assign(seen, { tsx: msg.sx, tax: msg.ax, tpw: msg.pw, sp: msg.sp, on: true });
        else Object.assign(seen, { tpw: 0, tax: seen.tsx });
      } };
      inbox.current = inbox.current.filter(q => { if (q.m === P.m) { mail.push(q); return false; } return q.m > P.m; });
    } else engineRef.current = null;

    // ── input: a finger in the bottom area puts the melon above it; drag up to roll; spin chips along the bottom ──
    const onDown = (e: PointerEvent) => {
      const p = local2view(e);
      if (!started || drag || (pausedRef.current && !live)) return;
      const chip = CHIPS.findIndex(x => Math.hypot(p.x - x, p.y - CHIP_Y) < CHIP_R + 5);
      if (chip >= 0) { if (myTurn()) spinOf[bowler] = chip - 2; return; }
      if (!canAim() || p.y < PAD_Y) return;
      const sx = Math.max(-38, Math.min(38, (p.x - W / 2) / HOME_S));
      drag = { x0: p.x, y0: p.y, sx, dx: 0, dy: 0, id: e.pointerId }; startX[bowler] = sx;
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = local2view(e); drag.dx = p.x - drag.x0; drag.dy = Math.max(0, drag.y0 - p.y);
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      onMove(e); const r = preview(), d = drag; drag = null;
      if (!canAim() || !r || d.dy < MIN_PULL) { aimEnd(); return; }
      fire(r);
    };
    const onCancel = () => { if (drag) aimEnd(); drag = null; };
    // live: let the other phone see you line up (only when it changed, about 6 a second at most), and say when you let go
    const aimKey = () => { const r = preview(); return r ? `${r.sx},${r.ax},${r.pw},${r.sp}` : `${q1(startX[me])},${q1(startX[me])},0,${spinOf[me]}`; };
    function aimEnd() { if (live && bowler === me && phase === "aim") { send({ t: "aimEnd", m: liveM, n }); aimSent = ""; } }
    function sendAim(t: number) {
      if (!live || bowler !== me || phase !== "aim" || t - aimAt < 160) return;
      const k = aimKey(); if (k === aimSent) return;
      const [sx, ax, pw, sp] = k.split(",").map(Number); aimSent = k; aimAt = t;
      send({ t: "aim", m: liveM, n, sx, ax, pw, sp });
    }
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onCancel);
    beginBall();
    if (P.kind === "live" && pendingSnap.current?.m === P.m) { const sn = pendingSnap.current; pendingSnap.current = null; loadSnap(sn); }
    /* TEST-HOOK-START */ if (new URLSearchParams(window.location.search).has("debug")) (window as unknown as { __mb: unknown }).__mb = {
      state: () => ({ n, phase, bowler, me, viewer: me, rolls: rolls.map(r => r.slice()), mask, turnLeft, totals: rolls.map(runningTotal), seen: { ...seen }, cam, pockets }),
      rt: () => { const r = sb().realtime as unknown as { isConnected: () => boolean; connectionState: () => string; channels: { topic: string; state: string }[] }; return { on: r.isConnected(), st: r.connectionState(), ch: r.channels.map(c => `${c.topic}:${c.state}`) }; },
      // a decent roll for whoever's up, as the drag that makes it (board units): touch at down, move to up; tap chip first
      plan: (miss = 0) => {
        const r = aiRoll(mask, slopes[frameNow()], { rnd: () => 0.5, aim: 0, pow: 0, hook: mask === ALL ? -1 : 0 });
        const ax = r.ax + miss, x0 = W / 2 + r.sx * HOME_S, y0 = 528, dy = (r.pw / 100) * PULL_FULL, dx = (ax - r.sx) / AIM_GAIN;
        return { roll: { ...r, ax }, chip: { x: CHIPS[r.sp + 2], y: CHIP_Y }, down: { x: x0, y: y0 }, up: { x: x0 + dx, y: y0 - dy } };
      } }; /* TEST-HOOK-END */

    const loop = (t: number) => {
      const dt = Math.max(0, Math.min(100, t - last)); last = t;
      const frozen = !started || (!live && pausedRef.current);
      if (!live && pausedRef.current) drag = null;
      if (!frozen) {
        if (live) pump();
        if (phase === "roll" && sim) {
          acc += dt; let k = 0;
          while (acc >= STEP && k < 8 && phase === "roll") { acc -= STEP; k++; stepSim(sim); if (sim.done) rollDone(); }
          if (k >= 8) acc = 0;
          if (pending !== null && phase === "roll" && (pendingAge += dt) > 4000) applyAuth(pending);   // way behind: catch up
        } else if (phase === "await") {
          if ((awaitAge += dt) > AWAIT_MS && sim) finishBall(standing(sim), null, false);   // no answer: our run of the same roll is the same
        } else if (phase === "think") {
          wait -= dt;
          const kk = Math.min(1, Math.max(0, 1.3 * (1 - wait / THINK_MS) - 0.15)); seen.tpw = cpuRoll ? cpuRoll.pw * kk : 0;
          if (wait <= 0 && cpuRoll) { const r = cpuRoll; cpuRoll = null; fire(r); }
        } else if (phase === "settle") {
          wait -= dt; if (wait <= 0) { phase = "sweep"; wait = SWEEP_MS; }
        } else if (phase === "sweep") {
          wait -= dt; if (wait <= 0) beginBall();
        } else if (phase === "aim" && live) {
          sendAim(t);
          if (!awayRef.current) turnLeft -= dt;                       // paused while either of you is away
          if (turnLeft <= 0 && bowler === me) { send({ t: "pass", m: liveM, n }); drag = null; finishBall(mask, null, true); }
        }
        const ease = Math.min(1, dt / 110);
        seen.sx += (seen.tsx - seen.sx) * ease; seen.ax += (seen.tax - seen.ax) * ease; seen.pw += (seen.tpw - seen.pw) * ease;
        const camT = (phase === "roll" || phase === "await" || phase === "settle") && sim ? (sim.ball.gone ? 1 : Math.min(1, Math.max(0, (sim.ball.y - 40) / 300))) : 0;
        cam += (camT - cam) * Math.min(1, dt / (camT > cam ? 160 : 260));
        if (popup && (popup.age += dt) > 1500) popup = null;
        rackAge += dt;
      }
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    // ── drawing: a gentle perspective down the counter that glides toward the bottles while the melon rolls ──
    let K = 0, HY = 0, F = 0, Y0 = 0, DD = 621;
    function setCam(c: number) {
      const e = c * c * (3 - 2 * c);
      Y0 = 300 * e; DD = 621 + 179 * e;
      const sy0 = 425 + 45 * e, sy1 = 72 + 3 * e, s0 = HOME_S + 0.25 * e;
      K = (sy0 - sy1) / (1 / DD - 1 / (PIT - Y0 + DD)); HY = sy0 - K / DD; F = s0 * DD;
    }
    const pr = (x: number, y: number) => { const d = Math.max(80, y - Y0 + DD); return { x: W / 2 + (x * F) / d, y: HY + K / d, s: F / d }; };
    const rr = (x: number, y: number, ww: number, hh: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, ww, hh, r); };
    const text = (s: string, x: number, y: number, size: number, color: string, weight = 700, align: CanvasTextAlign = "center") => {
      ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y);
    };
    const quad = (pts: { x: number; y: number }[], fill: string | CanvasGradient) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
    const strip = (x0: number, x1: number, y0: number, y1: number, fill: string | CanvasGradient) => quad([pr(x0, y0), pr(x1, y0), pr(x1, y1), pr(x0, y1)], fill);
    const line = (x0: number, y0: number, x1: number, y1: number, color: string, w: number) => { const a = pr(x0, y0), b = pr(x1, y1); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };

    function drawBottle(i: number, bx: number, by: number, tx: number, ty: number, w: number, alpha: number) {
      const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy);
      if (L < 2 || alpha <= 0) return;
      const juice = JUICE.includes(i), body = juice ? "#f6a33b" : "#46b3a3", dark = juice ? "#d9822a" : "#2f8f81", cap = juice ? "#2eaa6e" : "#e8505b";
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(bx, by); ctx.rotate(Math.atan2(dx, -dy));
      const hw = w / 2, nw = w * 0.22;
      ctx.beginPath();
      ctx.moveTo(-hw, -hw * 0.3); ctx.lineTo(-hw, -L * 0.56);
      ctx.quadraticCurveTo(-hw, -L * 0.72, -nw, -L * 0.8); ctx.lineTo(-nw, -L * 0.93);
      ctx.lineTo(nw, -L * 0.93); ctx.lineTo(nw, -L * 0.8);
      ctx.quadraticCurveTo(hw, -L * 0.72, hw, -L * 0.56); ctx.lineTo(hw, -hw * 0.3);
      ctx.quadraticCurveTo(hw, hw * 0.25, 0, hw * 0.25); ctx.quadraticCurveTo(-hw, hw * 0.25, -hw, -hw * 0.3);
      const g = ctx.createLinearGradient(-hw, 0, hw, 0); g.addColorStop(0, dark); g.addColorStop(0.35, body); g.addColorStop(1, dark);
      ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillRect(-hw, -L * 0.44, w, L * 0.2);                                   // label
      ctx.fillStyle = juice ? "#f6a33b" : "#e8505b";
      if (juice) { ctx.beginPath(); ctx.arc(0, -L * 0.34, Math.min(w * 0.22, L * 0.07), 0, 7); ctx.fill(); } else ctx.fillRect(-hw, -L * 0.36, w, L * 0.05);
      ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(-hw * 0.55, -L * 0.7, w * 0.14, L * 0.24);     // shine
      ctx.fillStyle = cap; rr(-nw * 1.25, -L, nw * 2.5, L * 0.08, Math.min(3, nw)); ctx.fill();
      ctx.restore();
    }
    function bottle(i: number, p: Pin, alpha: number) {
      const b = pr(p.x, p.y), w = RP * 2 * b.s, up = { x: b.x, y: b.y - BOTTLE_H * b.s };
      if (p.up) {
        ctx.fillStyle = `rgba(60,40,20,${0.16 * alpha})`; ctx.beginPath(); ctx.ellipse(b.x + w * 0.15, b.y + w * 0.05, w * 0.7, w * 0.25, 0, 0, 7); ctx.fill();
        drawBottle(i, b.x, b.y, up.x, up.y, w, alpha); return;
      }
      const reach = BOTTLE_H * 0.95, hd = pr(p.x + p.dx * reach, p.y + p.dy * reach), e = p.f * p.f * (3 - 2 * p.f);
      drawBottle(i, b.x, b.y - w * 0.3 * e, up.x + (hd.x - up.x) * e, up.y + (hd.y - w * 0.3 - up.y) * e, w * (1 - 0.1 * e), alpha);
    }
    function melon(x: number, y: number, s: number, spin: number, gutter: boolean) {
      const p = pr(x, y), r = RB * s * (gutter ? 0.92 : 1), cy = p.y - r * 0.85;
      ctx.fillStyle = "rgba(40,30,20,0.22)"; ctx.beginPath(); ctx.ellipse(p.x + r * 0.15, p.y, r * 0.95, r * 0.3, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(p.x, cy, r, 0, 7); ctx.clip();
      const g = ctx.createRadialGradient(p.x - r * 0.35, cy - r * 0.4, r * 0.1, p.x, cy, r * 1.05); g.addColorStop(0, "#7cc576"); g.addColorStop(0.55, "#3c9a43"); g.addColorStop(1, "#1f6a2a");
      ctx.fillStyle = g; ctx.fillRect(p.x - r, cy - r, r * 2, r * 2);
      ctx.strokeStyle = "rgba(18,72,30,0.75)"; ctx.lineWidth = r * 0.2; ctx.lineCap = "round";
      for (let k = 0; k < 5; k++) {
        const ph = (((k / 5 + spin) % 1) + 1) % 1, yy = cy + r - 2 * r * ph, hw = Math.sqrt(Math.max(0, r * r - (yy - cy) * (yy - cy)));
        ctx.beginPath(); ctx.moveTo(p.x - hw, yy); ctx.quadraticCurveTo(p.x - hw * 0.5, yy - r * 0.18, p.x, yy - r * 0.04); ctx.quadraticCurveTo(p.x + hw * 0.5, yy + r * 0.12, p.x + hw, yy - r * 0.02); ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.beginPath(); ctx.ellipse(p.x - r * 0.38, cy - r * 0.42, r * 0.32, r * 0.2, -0.5, 0, 7); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(20,60,28,0.5)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, cy, r, 0, 7); ctx.stroke();
    }
    function spinArrow(cx: number, cy: number, sp: number, color: string) {
      const bend = sp * 5;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx, cy + 8); ctx.quadraticCurveTo(cx - bend * 0.2, cy - 2, cx + bend, cy - 6); ctx.stroke();
      const ex = cx + bend, ey = cy - 6, ux = sp === 0 ? 0 : Math.sign(sp) * 0.8, uy = sp === 0 ? -1 : -0.6;
      ctx.beginPath(); ctx.moveTo(ex + ux * 5, ey + uy * 5); ctx.lineTo(ex - uy * 4.5 - ux * 2, ey + ux * 4.5 - uy * 2); ctx.lineTo(ex + uy * 4.5 - ux * 2, ey - ux * 4.5 - uy * 2); ctx.closePath(); ctx.fill();
    }

    function draw(t: number) {
      setCam(cam);
      ctx.save(); ctx.clearRect(0, 0, W, H);
      rr(0, 0, W, H, 22); ctx.clip();
      // the backsplash: soft tiles
      ctx.fillStyle = "#f3efe7"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(120,100,70,0.12)"; ctx.lineWidth = 1;
      for (let y = 0; y < 140; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      for (let x = 0; x < W; x += 30) for (let y = 0; y < 140; y += 22) { const o = (y / 22) % 2 ? 15 : 0; ctx.beginPath(); ctx.moveTo(x + o, y); ctx.lineTo(x + o, y + 22); ctx.stroke(); }
      // the counter around the lane, the steel gutters, the butcher-block lane, the cutting-board deck, the dark gap at the end
      strip(-170, 170, -90, PIT, "#e6dccb");
      const gut = ctx.createLinearGradient(0, 0, W, 0); gut.addColorStop(0, "#aeb8c4"); gut.addColorStop(0.5, "#dfe5ec"); gut.addColorStop(1, "#aeb8c4");
      strip(-GUT, -LANE, -90, PIT, "#c4ccd6"); strip(LANE, GUT, -90, PIT, "#c4ccd6");
      line(-56, -90, -56, PIT, "rgba(90,105,125,0.35)", 1.5); line(56, -90, 56, PIT, "rgba(90,105,125,0.35)", 1.5);
      strip(-LANE, LANE, -90, DECK, "#e9c48f");
      strip(-LANE, LANE, DECK, PIT, "#f3dcb3");
      for (let k = 1; k < 14; k++) { const x = -LANE + (k * 100) / 14; line(x, -90, x, DECK, "rgba(150,100,50,0.16)", 1); }
      line(-LANE, DECK, LANE, DECK, "rgba(150,100,50,0.3)", 1.5);
      const pit = [pr(-GUT, PIT), pr(GUT, PIT), pr(GUT, PIT + 40), pr(-GUT, PIT + 40)]; quad(pit, "#3a3f4b");
      quad([pr(-170, PIT), pr(-GUT, PIT), pr(-GUT, PIT + 40), pr(-170, PIT + 40)], "#d8cdb9"); quad([pr(GUT, PIT), pr(170, PIT), pr(170, PIT + 40), pr(GUT, PIT + 40)], "#d8cdb9");
      // aiming arrows a third of the way down, the foul line, and faint spots where bottles stand
      for (let k = -3; k <= 3; k++) {
        const a = pr(k * 12, 128), b = pr(k * 12 - 2.4, 116), c = pr(k * 12 + 2.4, 116);
        ctx.fillStyle = "rgba(120,70,30,0.45)"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.fill();
      }
      line(-LANE, 0, LANE, 0, "#e8505b", 2.5);
      for (const [x, y] of SPOTS) { const p = pr(x, y); ctx.fillStyle = "rgba(150,100,50,0.25)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, 2.2 * p.s, 0.9 * p.s, 0, 0, 7); ctx.fill(); }

      // aim lines: yours while dragging, the other bowler's while they line up (never the curve: that's for you to learn)
      const myPrev = myTurn() && started ? preview() : null;
      const theirs = !local && started && bowler >= 0 && !human(bowler) && (phase === "aim" || phase === "think") && seen.on;
      const guide = (sx: number, ax: number, pw: number, mine: boolean) => {
        const a = pr(sx, 6), b = pr(ax, HEAD);
        ctx.save(); ctx.setLineDash([7, 7]); ctx.lineDashOffset = -t / 40; ctx.lineWidth = 2.5;
        ctx.strokeStyle = mine ? "rgba(16,27,46,0.38)" : "rgba(232,80,91,0.5)"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
        if (pw > 2) {   // power, by the melon
          const m = pr(sx, 0), x = Math.max(44, Math.min(W - 44, m.x + (m.x < W / 2 ? 56 : -56))), y = m.y - 22;
          ctx.fillStyle = "rgba(255,255,255,0.92)"; rr(x - 34, y - 13, 68, 26, 13); ctx.fill();
          ctx.strokeStyle = mine ? "#3f7fd6" : "#e8505b"; ctx.lineWidth = 2; ctx.stroke();
          text(`${Math.round(pw)}%`, x, y + 5, 14, "#101b2e", 800);
        }
      };
      if (myPrev) guide(myPrev.sx, myPrev.ax, myPrev.pw, true);
      else if (theirs && (seen.tpw > 0 || Math.abs(seen.tax - seen.tsx) > 0.5)) guide(seen.sx, seen.ax, seen.pw, false);

      // the bottles and the melon, far to near
      const items: { y: number; draw: () => void }[] = [];
      const fadeK = phase === "sweep" ? Math.max(0, wait / SWEEP_MS) : 1;
      if (sim) sim.pins.forEach((p, i) => {
        if (p.gone) return;
        const alpha = phase === "sweep" && (!p.up || sweepFresh) ? fadeK : 1;
        items.push({ y: p.y, draw: () => bottle(i, p, alpha) });
      });
      else SPOTS.forEach(([x, y], i) => {
        if (!(shown & (1 << i))) return;
        const p: Pin = { x, y, vx: 0, vy: 0, up: true, f: 0, dx: 0, dy: 1, w: 0, gone: false };
        items.push({ y, draw: () => bottle(i, p, Math.min(1, rackAge / 300)) });
      });
      if (sim && !sim.ball.gone) { const b = sim.ball; items.push({ y: b.y, draw: () => melon(b.x, b.y, pr(b.x, b.y).s, b.y / (2 * Math.PI * RB), b.gutter) }); }
      else if (!sim && bowler >= 0 && phase !== "over" && phase !== "sweep") {
        const sx = myPrev ? myPrev.sx : theirs ? seen.sx : drag ? drag.sx : startX[bowler];
        items.push({ y: 0, draw: () => melon(sx, 0, pr(sx, 0).s, 0.08, false) });
      }
      items.sort((a, b) => b.y - a.y).forEach(it => it.draw());

      // top: the counter's slope this frame, whose turn, the frame, and the turn clock in a live game
      if (bowler >= 0 && phase !== "over") {
        const sl = slopes[frameNow()];
        ctx.fillStyle = "rgba(255,255,255,0.88)"; rr(8, 6, 94, 32, 12); ctx.fill();
        text("SLOPE", 55, 17, 8, "#5a6b85", 800);
        if (sl === 0) text("Flat", 55, 32, 13, "#3f7fd6", 800);
        else {
          const len = 10 + 9 * Math.abs(sl), dir = Math.sign(sl), x0 = 48 - (dir * len) / 2, x1 = 48 + (dir * len) / 2;
          ctx.strokeStyle = "#3f7fd6"; ctx.fillStyle = "#3f7fd6"; ctx.lineWidth = 3; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(x0, 27); ctx.lineTo(x1 - dir * 5, 27); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x1 + dir * 2, 27); ctx.lineTo(x1 - dir * 6, 22); ctx.lineTo(x1 - dir * 6, 32); ctx.fill();
          text(String(Math.abs(sl)), x1 + dir * 11, 32, 12, "#3f7fd6", 800);
        }
        const nb = nextBall(rolls[bowler]);
        const lining = !local && !human(bowler) && seen.on && (seen.tpw > 0 || Math.abs(seen.tax - seen.tsx) > 0.5) && (phase === "aim" || phase === "think");
        const whose = lining ? `${pnames[bowler]} Is Lining Up...` : cpu ? (bowler === 0 ? "Your Turn" : "Computer's Turn") : live ? (bowler === me ? "Your Turn" : `${pnames[bowler]}'s Turn`) : `${pnames[bowler]}'s Turn`;
        ctx.fillStyle = "rgba(255,255,255,0.88)"; rr(108, 6, cpu || local ? 244 : 284, 32, 12); ctx.fill();
        const cx = cpu || local ? 230 : 250;
        text(whose, cx, 20, 13, bowler === me || local ? "#101b2e" : "#5a6b85", 800);
        text(`Frame ${nb.frame + 1} · Ball ${Math.min(3, nb.ball + 1)}`, cx, 33, 10, "#5a6b85", 700);
        if (live && phase === "aim") {
          const left = Math.max(0, Math.ceil(turnLeft / 1000));
          text(`${left}s`, 372, 27, 12, left <= 5 ? "#e8505b" : "#3f7fd6", 800);
          ctx.fillStyle = "rgba(16,27,46,0.1)"; rr(116, 42, 268, 4, 2); ctx.fill();
          ctx.fillStyle = left <= 5 ? "#e8505b" : "#3f7fd6"; rr(116, 42, (268 * Math.max(0, turnLeft)) / TURN_MS, 4, 2); ctx.fill();
        }
      }

      // the bottom: where to drag, and the spin chips
      const mine = myTurn() && started;
      ctx.fillStyle = "rgba(255,255,255,0.55)"; rr(8, PAD_Y + 2, W - 16, H - PAD_Y - 10, 18); ctx.fill();
      if (mine && !drag && !rolled) {
        ctx.globalAlpha = 0.65 + 0.25 * Math.sin(t / 300);
        ctx.strokeStyle = "#3f7fd6"; ctx.setLineDash([8, 7]); ctx.lineWidth = 2; rr(HINT.x, HINT.y, HINT.w, HINT.h, 16); ctx.stroke(); ctx.setLineDash([]);
        text("Drag Up From Here To Roll", W / 2, HINT.y + 27, 15, "#3f7fd6", 800);
        text("Your Melon Starts Above Your Finger", W / 2, HINT.y + 47, 12, "#3f7fd6", 600);
        ctx.globalAlpha = 1;
      } else if (mine && !drag) text("Drag Up To Roll", W / 2, 522, 14, "rgba(63,127,214,0.8)", 800);
      else if (!mine && bowler >= 0 && (phase === "aim" || phase === "think") && started) text(cpu ? "The Computer Is Up" : live ? `${pnames[bowler]} Is Up` : "", W / 2, 522, 13, "#5a6b85", 700);
      const shownSpin = mine || local ? spinOf[bowler] : bowler >= 0 && !human(bowler) && seen.on ? seen.sp : spinOf[bowler >= 0 ? bowler : 0];
      ctx.globalAlpha = mine ? 1 : 0.55;
      CHIPS.forEach((x, k) => {
        const on = k - 2 === shownSpin;
        ctx.fillStyle = on ? "#3f7fd6" : "#fff"; ctx.beginPath(); ctx.arc(x, CHIP_Y, CHIP_R, 0, 7); ctx.fill();
        ctx.strokeStyle = on ? "#3f7fd6" : "rgba(16,27,46,0.18)"; ctx.lineWidth = 1.5; ctx.stroke();
        spinArrow(x, CHIP_Y, k - 2, on ? "#fff" : "#3f7fd6");
      });
      text("Spin", 214, CHIP_Y - 3, 11, "#5a6b85", 700, "left");
      text(SPIN_NAMES[shownSpin + 2], 214, CHIP_Y + 13, 13, "#101b2e", 800, "left");
      ctx.globalAlpha = 1;

      if (popup) {
        const a = Math.min(1, (1500 - popup.age) / 300), big = popup.text === "Strike!" || popup.text === "Spare!";
        ctx.globalAlpha = Math.max(0, a); ctx.font = `800 ${big ? 40 : 28}px ${FONT}`; ctx.textAlign = "center";
        ctx.lineWidth = 6; ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineJoin = "round"; ctx.strokeText(popup.text, W / 2, 260 - Math.min(20, popup.age * 0.02));
        ctx.fillStyle = popup.color; ctx.fillText(popup.text, W / 2, 260 - Math.min(20, popup.age * 0.02));
        ctx.globalAlpha = 1;
      }
      ctx.restore();
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
  const friend = play.kind === "live" ? (play.names[1 - me] === "Guest" ? "Your Friend" : play.names[1 - me]) : "";
  const stripNames = isCpu ? ["You", "Computer"] : play.kind === "live" ? play.names.map((v, i) => (i === me ? "You" : v === "Guest" ? "Friend" : v)) : play.kind === "local" ? play.names : ["", ""];
  const headline = !result ? "" : result.you > result.cpu ? `You Beat The Computer ${result.you}-${result.cpu}! 🎉` : result.you === result.cpu ? `A Tie With The Computer At ${result.you}` : `The Computer Won ${result.cpu}-${result.you}`;
  const share = () => {
    if (!result) return;
    const label = mode === "daily" ? `Melon Bowling #${n} (Today's Challenge)` : "Melon Bowling (Free Play)";
    const p = shell.scores.posted;
    const rank = p?.rank ? `\n🏆 #${p.rank} of ${p.total} ${mode === "daily" ? "today" : "this week"}` : "";
    const how = result.you > result.cpu ? `Beat the computer ${result.you}-${result.cpu}` : result.you === result.cpu ? `Tied the computer at ${result.you}` : `Lost to the computer ${result.you}-${result.cpu}`;
    const squares = result.marks.map(f => (f[0] === "X" ? "🟩" : f.includes("/") ? "🟨" : "⬜")).join("");
    shell.share(`${label}\n${result.you} · ${how}\n${result.marks.map(f => f.join("")).join(" ")}\n${squares}\n${result.pts.toLocaleString()} pts${rank}\nCan you beat it? whatyouate.app/games/melon-bowling`);
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
    const first = (matchEnd.winner < 0 ? 1 - play.first : 1 - matchEnd.winner) as 0 | 1;   // the loser bowls first
    setMatchEnd(null); setPlay({ ...play, m: play.m + 1, seed: Math.floor(Math.random() * 1e9), first });
  };
  const shareRoom = (c: string) => shell.share(`Bowl with me in Melon Bowling! Room ${c}: ${window.location.origin}/games/melon-bowling?room=${c}`);
  const rui = room.ui;
  const playing = isCpu ? started && !over : isLocal ? !matchEnd : false;
  const theirTurn = isLive && hud.bowler === 1 - me;
  const awaySecs = room.away ? Math.max(0, Math.ceil((room.away - Date.now()) / 1000)) : 0;

  return (
    <GameScreen>
      <GameHeader title="Melon Bowling" mode={mode} onMode={m => { toCpu(); setMode(m); }} onBoard={() => shell.setBoardOpen(true)} onHelp={shell.help.show} />

      <ScoreStrip rolls={hud.rolls} names={stripNames} cur={hud.bowler} faded={isCpu && !started} />

      <BoardArea wrapRef={wrapRef} size={board} reserve={0}>
        <canvas ref={canvasRef} className="block rounded-[22px] shadow-[0_14px_40px_rgba(16,42,86,0.18)]" />
        {(isCpu || isLocal) && <div className="absolute right-[6px] top-[5px] z-[6]"><PauseButton shell={shell} active={playing} /></div>}
        <PrizeLogo shell={shell} active={isCpu && started && !over && !shell.paused && !menu && !rui} />
        <PausedCard shell={shell} active={playing} />

        {isCpu && !started && !over && !menu && !rui && !offer && (
          <Card>
            <div className="text-lg font-bold">{mode === "daily" ? `Today's Challenge #${n}` : "Free Play"}</div>
            <p className="mt-1 text-sm text-[#5a6b85]">{mode === "daily" ? "10 frames against the computer. Same counter and same computer for everyone today." : "10 frames against a computer that gets a little sharper every game."}</p>
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
            <p className="mt-1 text-sm text-[#5a6b85]">Bowl live on two phones. Make a room and send your friend the link.</p>
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
            <p className="mt-1 text-sm text-[#5a6b85]">Two bowlers, one phone. Pass it over after each frame.</p>
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
            <p className="mt-1 text-sm text-[#5a6b85]">You were in the middle of a game in room {offer.saved.code}.</p>
            <button onClick={() => rejoinNow(offer.saved, offer.live)} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Rejoin</button>
            <button onClick={() => { room.forget(); try { localStorage.removeItem(LIVE_KEY); } catch {} setOffer(null); }} className="mt-2 w-full py-2 text-sm font-semibold text-[#5a6b85]">No Thanks</button>
          </Card>
        )}

        {rui?.s === "lobby" && (
          <ReadyCard me={nameRef.current === "Guest" ? "You" : nameRef.current} friend={room.friendName === "Guest" ? "Your Friend" : room.friendName}
            ready={[room.ready.me, room.ready.them]} onReady={room.markReady} onLeave={toCpu} steps={[
              "Put your finger in the bottom area under where you want to start, then drag up to roll.",
              "Drag further for more speed. Lean left or right to aim; the faint line shows where.",
              "Spin curves the melon late. The slope at the top pulls every roll.",
              "You take turns, a frame each, 30 seconds a ball. The host bowls first.",
            ]} />
        )}

        {rui && rui.s !== "lobby" && (
          <Card>
            {rui.s === "waiting" && (<>
              <div className="text-sm font-semibold text-[#5a6b85]">Your Room Code</div>
              <div className="mt-1 font-mono text-4xl font-bold tracking-[0.2em]">{rui.code}</div>
              <p className="mt-2 text-sm text-[#5a6b85]">Send your friend the link. You&apos;ll both get ready once they join.</p>
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
              <p className="mt-2 text-sm text-[#5a6b85]">That game is over.</p>
              <button onClick={openRoom} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Make A New Room</button>
              <button onClick={toCpu} className="mt-2 w-full rounded-full bg-[#e3effe] py-3 font-semibold text-[#3f7fd6]">Play The Computer</button>
            </>)}
          </Card>
        )}

        {isLive && room.away && !rui && !matchEnd && (theirTurn ? (
          <Card>
            <div className="text-xl font-bold">{friend} Stepped Away...</div>
            <div className="mt-2 text-4xl font-bold tabular-nums text-[#3f7fd6]">{awaySecs}s</div>
            <p className="mt-2 text-sm text-[#5a6b85]">It&apos;s their turn, so the game waits. It picks up right where you left off when they&apos;re back.</p>
            <button onClick={toCpu} className="mt-3 w-full py-2 text-sm font-semibold text-[#5a6b85]">Leave</button>
          </Card>
        ) : (
          <div className="pointer-events-none absolute inset-x-0 top-[60px] z-[6] flex justify-center px-3">
            <div className="rounded-2xl bg-white/95 px-4 py-2 text-center shadow-md">
              <div className="text-sm font-bold text-[#101b2e]">{friend} Stepped Away · {awaySecs}s</div>
              <div className="text-xs font-semibold text-[#5a6b85]">Keep Bowling. They&apos;ll Catch Up.</div>
            </div>
          </div>
        ))}
        {isLive && room.reconnecting && !room.away && !rui && (
          <div className="pointer-events-none absolute inset-x-0 top-[60px] z-[6] flex justify-center">
            <div className="rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-[#3f7fd6] shadow-md">Reconnecting...</div>
          </div>
        )}

        {isLocal && passTo && !matchEnd && !shell.held && (
          <button onClick={() => passRef.current()} className="absolute inset-0 z-10 flex items-center justify-center rounded-[22px] bg-[#101b2e]/45 p-6">
            <span className="w-full max-w-[260px] rounded-3xl bg-white px-6 py-5 text-center shadow-2xl">
              <span className="block text-sm font-semibold text-[#5a6b85]">Pass To {passTo}</span>
              <span className="mt-0.5 block text-2xl font-bold">{passTo}&apos;s Frame</span>
              <span className="mt-3 block rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Tap To Start</span>
            </span>
          </button>
        )}

        {matchEnd && !rui && (isLive || isLocal) && (
          <Card>
            <div className="text-sm font-semibold text-[#5a6b85]">{play.kind === "live" ? `Room ${play.code}` : "Same Phone"}</div>
            <div className="mt-1 text-2xl font-bold">
              {matchEnd.winner < 0 ? "It's A Tie" : isLive ? (matchEnd.winner === me ? "You Won! 🎉" : `${friend} Won`) : `${stripNames[matchEnd.winner]} Wins! 🎉`}
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums">
              {isLive ? `${matchEnd.scores[me]} - ${matchEnd.scores[1 - me]}` : `${matchEnd.scores[0]} - ${matchEnd.scores[1]}`}
            </div>
            <div className="mt-1 text-sm text-[#5a6b85]">
              Games Won: {isLive ? `You ${wins[me]} · ${friend} ${wins[1 - me]}` : `${stripNames[0]} ${wins[0]} · ${stripNames[1]} ${wins[1]}`}
            </div>
            {isLive && room.again.them && !room.again.me && <div className="mt-2 text-sm font-semibold text-[#2eaa6e]">{friend} Wants A Rematch!</div>}
            <button onClick={isLive ? room.rematch : localRematch} disabled={isLive && room.again.me} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white disabled:opacity-70">
              {isLive && room.again.me ? `Waiting For ${friend}...` : "Rematch"}
            </button>
            <button onClick={toCpu} className="mt-2 w-full rounded-full bg-[#e3effe] py-3 font-semibold text-[#3f7fd6]">{isLive ? "Leave" : "Done"}</button>
            <a href={appStoreLink(GAME)} className="mt-3 inline-block text-xs font-semibold text-[#5a6b85] underline">Get WhatYouAte For iPhone</a>
          </Card>
        )}

        {over && isCpu && result && !menu && !rui && <GameOver label={mode === "daily" ? `Today's Challenge #${n}` : "Free Play"} headline={headline} score={result.pts} best={best} mode={mode}
          posted={shell.scores.posted} joined={!!shell.player} campaign={GAME} copied={shell.copied} fact={fact}
          pitch="Small adjustments win at bowling. They work for eating well too. WhatYouAte helps with that part."
          extra={<button onClick={() => setMenu("friend")} className="mt-2 text-sm font-semibold text-[#3f7fd6]">Bowl A Friend Instead →</button>}
          onBoard={() => shell.setBoardOpen(true)} onJoin={() => shell.setJoinOpen(true)} onAgain={() => setRun(r => r + 1)} onShare={share} />}
      </BoardArea>

      <ShellPopups shell={shell} game={GAME} todayNote="Today's Challenge: same counter slopes and computer bowler for everyone. Resets at midnight." />

      {shell.help.open && (
        <HelpModal onClose={shell.help.close} steps={[
          "Put your finger in the bottom area under where you want to start. Your melon sits right above it.",
          "Drag up to roll: further is faster, and leaning left or right aims. The faint line shows your aim.",
          "Pick a spin at the bottom to curve the melon late. The slope at the top pulls every roll a little.",
          "Real bowling scoring: 10 frames, and strikes and spares earn bonus pins. Play the computer, a friend on their phone, or someone next to you.",
        ]}>
          <ModesHelp today="the same counter and the same computer bowler for everyone. Your score is your bowling score x 10, plus up to 20 for each pocket hit and 300 for beating the computer." free="a new game every time, against a computer that gets a little sharper each game." />
        </HelpModal>
      )}
    </GameScreen>
  );
}

/** The classic 10-frame score sheet, one row per bowler: little boxes for each ball, the running total under them. */
function ScoreStrip({ rolls, names, cur, faded }: { rolls: number[][]; names: string[]; cur: number; faded: boolean }) {
  return (
    <div className={`mt-2 shrink-0 overflow-hidden rounded-xl bg-white/85 shadow-sm transition-opacity ${faded ? "opacity-60" : ""}`}>
      {[0, 1].map(p => {
        const marks = frameMarks(rolls[p]), scores = frameScores(rolls[p]), nb = nextBall(rolls[p]), total = runningTotal(rolls[p]);
        return (
          <div key={p} className={`grid ${p ? "border-t border-[#dbe7f8]" : ""}`} style={{ gridTemplateColumns: "62px repeat(9, minmax(0, 1fr)) minmax(0, 1.45fr) 34px" }}>
            <div className={`truncate px-1 text-[10px] font-bold leading-[28px] ${cur === p ? "text-[#3f7fd6]" : "text-[#101b2e]"}`}>{names[p]}</div>
            {Array.from({ length: 10 }, (_, f) => {
              const m = marks[f] ?? [], boxes = f < 9 ? (m[0] === "X" ? ["", "X"] : [m[0] ?? "", m[1] ?? ""]) : [m[0] ?? "", m[1] ?? "", m[2] ?? ""];
              return (
                <div key={f} className={`min-w-0 border-l border-[#dbe7f8] ${cur === p && !nb.done && nb.frame === f ? "bg-[#e3effe]" : ""}`}>
                  <div className="flex h-[13px] justify-end">
                    {boxes.map((b, k) => <span key={k} className={`w-[11px] text-center text-[10px] font-bold leading-[13px] ${k ? "border-b border-l border-[#dbe7f8]" : ""} ${b === "X" || b === "/" ? "text-[#2eaa6e]" : "text-[#101b2e]"}`}>{b}</span>)}
                  </div>
                  <div className="h-[15px] text-center text-[11px] font-bold leading-[15px] tabular-nums text-[#101b2e]">{scores[f] ?? ""}</div>
                </div>
              );
            })}
            <div className="border-l border-[#dbe7f8] text-center text-[13px] font-bold leading-[28px] tabular-nums text-[#101b2e]">{total}</div>
          </div>
        );
      })}
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[22px] bg-[#101b2e]/35 p-5">
      <div className="w-full max-w-[290px] rounded-3xl bg-white p-5 text-center shadow-2xl">{children}</div>
    </div>
  );
}
