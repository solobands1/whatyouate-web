"use client";

// Kitchen Golf: mini golf round the kitchen, with a meatball. Nine holes a round from a bank of 18: placemats, cutting
// boards, bowls, a syrup spill, butter, spatula ramps, the sink, a spinning stand mixer and a rolling pin. Drag back
// anywhere on the board (relative drag, so your finger never covers the ball), watch the short dotted line and the
// power meter, and let go to putt. Fewest strokes over 9 holes wins; 6 strokes a hole at most, then you pick up and
// take a 7. The sink sends you back where you putted from, with a stroke added.
// Both balls play the same hole and take turns (they don't hit each other); whoever has holed out waits for the other.
// "Today" is 9 holes against the computer, the same holes and computer for everyone; points per hole for strokes
// under 7, under par, holes in one and beating the computer. Free Play keeps going round after round while you
// beat (or tie) a computer that gets a little sharper.
// "Play A Friend" is a live match over a Supabase Realtime channel (no tables): whoever putts runs the roll and then
// sends where it stopped, so the two screens can't drift. Minimise or lose signal and the other phone shows
// "Stepped Away" for 60 seconds; the snapshot exchange on return catches you up. "Same Phone" is pass and play.
// The block between SIM BEGIN and SIM END is pure (no React, no DOM) and only uses + - * / and sqrt (even the
// mixer's angles come from a table built with them), which give the same answer in every browser; the balance check
// runs that exact code in Node.
// No facts mid-game; one fact on the game-over card. Everything around the board comes from ./kit.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sb } from "@/components/creators/api";
import { appStoreLink } from "@/components/site";
import { type Mode, type Toast, GameScreen, GameHeader, BoardArea, PrizeLogo, GameOver, PauseButton, PausedCard, ReadyCard, HelpModal, ModesHelp, ShellPopups,
  useGameShell, fitCanvas, loadImages, dailySeed, dailyNumber, torontoDate, mulberry32, readBest, saveBest } from "./kit";

const GAME = "kitchen-golf";
const LAUNCH = "2026-11-08";   // Today's Challenge #1

// ── SIM BEGIN ──────────────────────────────────────────────────────────────
const W = 400, H = 600, SUB = 4;                     // logical board; physics at 60 steps a second, 4 sub-steps each
const BALL_R = 7, CUP_R = 11, VMAX = 11, MAX_PULL = 110, MIN_PULL = 8;
const ROLL_K = 0.99, ROLL_C = 0.018;                 // rolling: each step, speed = speed * K - C
const SYRUP_K = 0.9, SYRUP_C = 0.06, BUTTER_K = 0.996, BUTTER_C = 0.006;
const WALL_E = 0.78, BUMP_E = 0.85, MOVER_E = 0.9;   // bounciness
const CUP_PULL = 0.3, CUP_CATCH = 2.8;               // the cup tugs a passing ball in; slower than CATCH and it drops
const MIXER_W = 5, PIN_R = 9;
const MAX_STROKES = 6, PICKUP = 7, ROUND_HOLES = 9, MAX_STEPS = 1500;
const PI = 3.141592653589793;

// cos and sin every half degree, from Taylor series (only + - * /), so every browser builds the same table
const TRIG: number[][] = [];
for (let i = 0; i < 720; i++) {
  let a = (i * PI) / 360; if (a > PI) a -= 2 * PI;
  let s = 0, c = 0, ts = a, tc = 1;
  for (let k = 0; k < 30; k++) { s += ts; c += tc; ts = (-ts * a * a) / ((2 * k + 2) * (2 * k + 3)); tc = (-tc * a * a) / ((2 * k + 1) * (2 * k + 2)); }
  TRIG.push([c, s]);
}

type Pt = [number, number];
type Rect = [number, number, number, number];                                  // x0, y0, x1, y1
type Zone = { k: "syrup"; c: [number, number, number] } | { k: "butter"; r: Rect } | { k: "sink"; r: Rect } | { k: "ramp"; r: Rect; ax: number; ay: number };
type Bump = { x: number; y: number; r: number; k: "bowl" | "jar" | "cup"; f?: string };
type Block = { k: "board" | "shelf"; p: Pt[] };
type Mover = { k: "mixer"; x: number; y: number; len: number; spd: number; ph: number }      // spd: half degrees a step
  | { k: "pin"; x0: number; y0: number; x1: number; y1: number; half: number; per: number; ph: number };   // slides x0,y0 <-> x1,y1 every per steps
type HoleDef = { name: string; par: number; tier: 0 | 1 | 2; tee: Pt; cup: Pt; out: Pt[]; blocks?: Block[]; bumps?: Bump[]; zones?: Zone[]; movers?: Mover[] };
type Course = { id: number; mirror: boolean; name: string; par: number; tee: Pt; cup: Pt; out: Pt[]; blocks: Block[]; bumps: Bump[]; zones: Zone[]; movers: Mover[]; segs: number[][] };

const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const HOLES: HoleDef[] = [
  // tier 0: the first three holes of every round
  { name: "Placemat", par: 2, tier: 0, tee: [200, 520], cup: [200, 150], out: rect(110, 90, 290, 570) },
  { name: "Fruit Bowl", par: 2, tier: 0, tee: [200, 520], cup: [200, 150], out: rect(90, 90, 310, 570), bumps: [{ x: 200, y: 330, r: 34, k: "bowl", f: "1f34e" }] },
  { name: "Corner Counter", par: 3, tier: 0, tee: [120, 520], cup: [290, 145], out: [[60, 80], [340, 80], [340, 210], [180, 210], [180, 575], [60, 575]] },
  { name: "Syrup Spill", par: 2, tier: 0, tee: [200, 520], cup: [200, 150], out: rect(100, 90, 300, 570), zones: [{ k: "syrup", c: [200, 225, 42] }] },
  { name: "The Funnel", par: 2, tier: 0, tee: [200, 535], cup: [200, 150], out: [[60, 80], [340, 80], [340, 300], [230, 470], [230, 575], [170, 575], [170, 470], [60, 300]] },
  // tier 1: holes 4 to 6
  { name: "Cutting Board", par: 3, tier: 1, tee: [200, 525], cup: [200, 140], out: rect(60, 80, 340, 575), blocks: [{ k: "board", p: rect(110, 280, 290, 350) }] },
  { name: "Spatula Ramp", par: 3, tier: 1, tee: [200, 525], cup: [200, 150], out: rect(100, 80, 300, 575), zones: [{ k: "ramp", r: [100, 250, 300, 370], ax: 0, ay: 0.07 }] },
  { name: "Kitchen Sink", par: 3, tier: 1, tee: [200, 525], cup: [200, 140], out: rect(50, 80, 350, 575), zones: [{ k: "sink", r: [125, 240, 275, 400] }] },
  { name: "Bowl Pinball", par: 3, tier: 1, tee: [200, 530], cup: [200, 140], out: rect(60, 80, 340, 575),
    bumps: [{ x: 130, y: 250, r: 26, k: "bowl", f: "1f34a" }, { x: 270, y: 250, r: 26, k: "bowl", f: "1f345" }, { x: 200, y: 340, r: 26, k: "bowl", f: "1f95a" },
      { x: 130, y: 430, r: 20, k: "jar" }, { x: 270, y: 430, r: 20, k: "jar" }] },
  { name: "Butter Slide", par: 3, tier: 1, tee: [280, 520], cup: [105, 145], out: [[60, 80], [340, 80], [340, 575], [220, 575], [220, 210], [60, 210]],
    zones: [{ k: "butter", r: [150, 92, 330, 198] }] },
  { name: "Spice Rack", par: 3, tier: 1, tee: [110, 525], cup: [110, 140], out: rect(60, 80, 340, 575),
    blocks: [{ k: "shelf", p: rect(60, 250, 230, 280) }, { k: "shelf", p: rect(170, 400, 340, 430) }] },
  // tier 2: holes 7 to 9
  { name: "Rolling Pin", par: 3, tier: 2, tee: [200, 525], cup: [200, 140], out: rect(70, 80, 330, 575), movers: [{ k: "pin", x0: 145, y0: 320, x1: 255, y1: 320, half: 70, per: 240, ph: 0 }] },
  { name: "Stand Mixer", par: 3, tier: 2, tee: [200, 525], cup: [200, 140], out: rect(80, 80, 320, 575), movers: [{ k: "mixer", x: 200, y: 330, len: 92, spd: 3, ph: 0 }] },
  { name: "Egg Cups", par: 3, tier: 2, tee: [200, 530], cup: [200, 220], out: rect(50, 80, 350, 575),
    bumps: [[258, 220], [241, 261], [200, 278], [159, 261], [142, 220], [159, 179], [241, 179]].map(([x, y]) => ({ x, y, r: 16, k: "cup" as const })) },
  { name: "Dish Rack", par: 3, tier: 2, tee: [110, 525], cup: [290, 140], out: rect(60, 80, 340, 575), zones: [{ k: "sink", r: [60, 280, 160, 400] }, { k: "sink", r: [240, 280, 340, 400] }] },
  { name: "Pantry Shelves", par: 4, tier: 2, tee: [290, 525], cup: [290, 145], out: rect(60, 80, 340, 575),
    blocks: [{ k: "shelf", p: rect(140, 230, 340, 260) }, { k: "shelf", p: rect(60, 380, 260, 410) }], zones: [{ k: "syrup", c: [200, 320, 34] }] },
  { name: "Twin Mixers", par: 4, tier: 2, tee: [200, 535], cup: [200, 130], out: rect(70, 80, 330, 575),
    movers: [{ k: "mixer", x: 200, y: 420, len: 80, spd: 3, ph: 0 }, { k: "mixer", x: 200, y: 240, len: 80, spd: -3, ph: 90 }] },
  { name: "Ramp And Pin", par: 4, tier: 2, tee: [200, 530], cup: [200, 135], out: rect(80, 80, 320, 575),
    zones: [{ k: "ramp", r: [80, 380, 320, 470], ax: 0, ay: 0.06 }], movers: [{ k: "pin", x0: 150, y0: 250, x1: 250, y1: 250, half: 60, per: 200, ph: 50 }] },
];

function polySegs(p: Pt[]) { return p.map((a, i) => { const b = p[(i + 1) % p.length]; return [a[0], a[1], b[0], b[1]]; }); }
/** A hole ready to play, mirrored left to right if `mirror` (so 18 holes give 36 layouts). */
function compile(id: number, mirror: boolean): Course {
  const h = HOLES[id], mx = (x: number) => (mirror ? W - x : x), mp = (p: Pt): Pt => [mx(p[0]), p[1]];
  const mr = (r: Rect): Rect => (mirror ? [W - r[2], r[1], W - r[0], r[3]] : r);
  const out = h.out.map(mp), blocks = (h.blocks ?? []).map(b => ({ k: b.k, p: b.p.map(mp) }));
  const zones: Zone[] = (h.zones ?? []).map(z => z.k === "syrup" ? { k: "syrup", c: [mx(z.c[0]), z.c[1], z.c[2]] } : z.k === "ramp" ? { k: "ramp", r: mr(z.r), ax: mirror ? -z.ax : z.ax, ay: z.ay } : { k: z.k, r: mr(z.r) } as Zone);
  const movers: Mover[] = (h.movers ?? []).map(m => m.k === "mixer" ? { ...m, x: mx(m.x), spd: mirror ? -m.spd : m.spd, ph: mirror ? (720 + 360 - m.ph) % 720 : m.ph }
    : { ...m, x0: mx(m.x0), x1: mx(m.x1) });
  const segs = [...polySegs(out), ...blocks.flatMap(b => polySegs(b.p))];
  return { id, mirror, name: h.name, par: h.par, tee: mp(h.tee), cup: mp(h.cup), out, blocks, bumps: (h.bumps ?? []).map(b => ({ ...b, x: mx(b.x) })), zones, movers, segs };
}
/** A round's 9 holes: 3 easy ones, 3 middling, 3 hard, each set shuffled by the seed, some mirrored. */
function pickHoles(seed: number): { id: number; mirror: boolean }[] {
  const rnd = mulberry32(seed), out: { id: number; mirror: boolean }[] = [];
  for (const tier of [0, 1, 2]) {
    const ids = HOLES.map((h, i) => (h.tier === tier ? i : -1)).filter(i => i >= 0);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
    for (let k = 0; k < 3; k++) out.push({ id: ids[k], mirror: rnd() < 0.5 });
  }
  return out;
}
const inRect = (r: Rect, x: number, y: number) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];

type Ball = { x: number; y: number; vx: number; vy: number };
/** Pushes the ball out of a line segment (thickened to `rad`) and bounces it, relative to the segment's own velocity. */
function hitSeg(b: Ball, ax: number, ay: number, bx: number, by: number, rad: number, svx: number, svy: number, e: number) {
  const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
  let t = l2 > 0 ? ((b.x - ax) * ex + (b.y - ay) * ey) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + ex * t, cy = ay + ey * t, dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy;
  if (d2 >= rad * rad || d2 < 1e-9) return false;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  b.x = cx + nx * rad; b.y = cy + ny * rad;
  const vn = (b.vx - svx) * nx + (b.vy - svy) * ny;
  if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
  return true;
}
function hitCircle(b: Ball, x: number, y: number, rad: number, e: number) {
  const dx = b.x - x, dy = b.y - y, d2 = dx * dx + dy * dy;
  if (d2 >= rad * rad || d2 < 1e-9) return false;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  b.x = x + nx * rad; b.y = y + ny * rad;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
  return true;
}
/** Where each moving part is at a given step of the hole clock: a segment, how thick, and how fast it's moving. */
type Part = { ax: number; ay: number; bx: number; by: number; rad: number; spin: number; px: number; py: number; vx: number; vy: number };
function partsAt(c: Course, clock: number): Part[] {
  return c.movers.map(m => {
    if (m.k === "mixer") {
      const i = (((m.ph + clock * m.spd) % 720) + 720) % 720, co = TRIG[i][0], si = TRIG[i][1];
      return { ax: m.x - m.len * co, ay: m.y - m.len * si, bx: m.x + m.len * co, by: m.y + m.len * si, rad: BALL_R + MIXER_W, spin: (m.spd * PI) / 360, px: m.x, py: m.y, vx: 0, vy: 0 };
    }
    const half = m.per / 2, u = (((clock + m.ph) % m.per) + m.per) % m.per, f = u < half ? u / half : 2 - u / half, dir = u < half ? 1 : -1;
    const dx = m.x1 - m.x0, dy = m.y1 - m.y0, l = Math.sqrt(dx * dx + dy * dy), ux = dx / l, uy = dy / l, cx = m.x0 + dx * f, cy = m.y0 + dy * f;
    return { ax: cx - ux * m.half, ay: cy - uy * m.half, bx: cx + ux * m.half, by: cy + uy * m.half, rad: BALL_R + PIN_R, spin: 0, px: cx, py: cy, vx: (dir * dx) / half, vy: (dir * dy) / half };
  });
}

/** One putt in progress. done: 0 rolling, 1 stopped, 2 in the cup, 3 in the sink. */
type Roll = Ball & { clock: number; steps: number; slow: number; done: 0 | 1 | 2 | 3; sx: number; sy: number; dist: number };
function startRoll(x: number, y: number, px: number, py: number, clock: number): Roll {
  const l = Math.sqrt(px * px + py * py), k = l > MAX_PULL ? MAX_PULL / l : 1;
  return { x, y, vx: ((-px * k) / MAX_PULL) * VMAX, vy: ((-py * k) / MAX_PULL) * VMAX, clock, steps: 0, slow: 0, done: 0, sx: x, sy: y, dist: 0 };
}
function stepRoll(c: Course, b: Roll): number {
  if (b.done) return b.done;
  let k = ROLL_K, cc = ROLL_C, ramp = false;
  for (const z of c.zones) {
    if (z.k === "syrup") { const dx = b.x - z.c[0], dy = b.y - z.c[1]; if (dx * dx + dy * dy < z.c[2] * z.c[2]) { k = SYRUP_K; cc = SYRUP_C; } }
    else if (inRect(z.r, b.x, b.y)) {
      if (z.k === "sink") { b.vx = 0; b.vy = 0; b.done = 3; return 3; }
      if (z.k === "butter") { k = BUTTER_K; cc = BUTTER_C; }
      else { b.vx += z.ax; b.vy += z.ay; ramp = true; }
    }
  }
  let sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  const qx = b.x - c.cup[0], qy = b.y - c.cup[1], q2 = qx * qx + qy * qy;
  if (q2 < CUP_R * CUP_R) {
    if (sp < CUP_CATCH) { b.x = c.cup[0]; b.y = c.cup[1]; b.vx = 0; b.vy = 0; b.done = 2; return 2; }
    const q = Math.sqrt(q2); if (q > 0.01) { b.vx -= (qx / q) * CUP_PULL; b.vy -= (qy / q) * CUP_PULL; }
    sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  }
  const ns = sp * k - cc;
  if (ns <= 0) { b.vx = 0; b.vy = 0; } else { b.vx = (b.vx * ns) / sp; b.vy = (b.vy * ns) / sp; }
  const parts = c.movers.length ? partsAt(c, b.clock) : [];
  const x0 = b.x, y0 = b.y;
  for (let s = 0; s < SUB; s++) {
    b.x += b.vx / SUB; b.y += b.vy / SUB;
    for (const p of parts) {
      const ex = p.bx - p.ax, ey = p.by - p.ay, l2 = ex * ex + ey * ey;
      let t = ((b.x - p.ax) * ex + (b.y - p.ay) * ey) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const hx = p.ax + ex * t, hy = p.ay + ey * t;   // the part's velocity where it meets the ball
      hitSeg(b, p.ax, p.ay, p.bx, p.by, p.rad, p.vx - p.spin * (hy - p.py), p.vy + p.spin * (hx - p.px), MOVER_E);
    }
    for (const g of c.segs) hitSeg(b, g[0], g[1], g[2], g[3], BALL_R, 0, 0, WALL_E);
    for (const u of c.bumps) hitCircle(b, u.x, u.y, u.r + BALL_R, BUMP_E);
  }
  const mx = b.x - x0, my = b.y - y0; b.dist += Math.sqrt(mx * mx + my * my);
  b.clock++; b.steps++;
  sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  if (sp < 0.05) { b.slow++; if (!ramp || b.slow > 30) { b.vx = 0; b.vy = 0; b.done = 1; } } else b.slow = 0;
  if (b.steps >= MAX_STEPS && !b.done) { b.vx = 0; b.vy = 0; b.done = 1; }
  if (b.done === 1) rest(c, b);
  return b.done;
}
/** A ball can't stop where a moving part sweeps: it's set down just outside, then nudged off any wall. */
function rest(c: Course, b: Ball) {
  for (const m of c.movers) {
    if (m.k === "mixer") {
      const R = m.len + MIXER_W + BALL_R + 2, dx = b.x - m.x, dy = b.y - m.y, d2 = dx * dx + dy * dy;
      if (d2 < R * R) { const d = Math.sqrt(d2); if (d < 0.01) { b.x = m.x; b.y = m.y + R; } else { b.x = m.x + (dx / d) * R; b.y = m.y + (dy / d) * R; } }
    } else {
      const dx = m.x1 - m.x0, dy = m.y1 - m.y0, l = Math.sqrt(dx * dx + dy * dy), ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
      const along = (b.x - m.x0) * ux + (b.y - m.y0) * uy, side = (b.x - m.x0) * nx + (b.y - m.y0) * ny, R = PIN_R + BALL_R + 2;
      if (along > -m.half - BALL_R && along < l + m.half + BALL_R && side > -R && side < R) { const to = side < 0 ? -R : R; b.x += nx * (to - side); b.y += ny * (to - side); }
    }
  }
  const t = { x: b.x, y: b.y, vx: 0, vy: 0 };
  for (let k = 0; k < 3; k++) { for (const g of c.segs) hitSeg(t, g[0], g[1], g[2], g[3], BALL_R + 0.5, 0, 0, 0); for (const u of c.bumps) hitCircle(t, u.x, u.y, u.r + BALL_R + 0.5, 0); }
  b.x = Math.round(t.x * 100) / 100; b.y = Math.round(t.y * 100) / 100;
}
/** A whole putt at once (the computer thinking, and catching up): where it ends and how. */
function simPutt(c: Course, x: number, y: number, px: number, py: number, clock: number) {
  const b = startRoll(x, y, px, py, clock);
  while (!b.done) stepRoll(c, b);
  return b;
}

// ── the computer ──
// It reads the hole as a grid of distances to the cup (walking round walls, bowls and the sink; syrup counts double),
// tries hundreds of putts in its head, keeps the one that ends closest (or in the cup), then misses on purpose by a
// random amount that shrinks a little each hole and each round. Never perfect.
const CELL = 8, GW = W / CELL, GH = H / CELL;
function inPoly(p: Pt[], x: number, y: number) {
  let on = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) on = !on;
  }
  return on;
}
function segDist2(x: number, y: number, g: number[]) {
  const ex = g[2] - g[0], ey = g[3] - g[1], l2 = ex * ex + ey * ey;
  let t = l2 > 0 ? ((x - g[0]) * ex + (y - g[1]) * ey) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = x - g[0] - ex * t, dy = y - g[1] - ey * t; return dx * dx + dy * dy;
}
const fields = new Map<string, Float64Array>();
function fieldFor(c: Course) {
  const key = `${c.id}${c.mirror ? "m" : ""}`, have = fields.get(key);
  if (have) return have;
  const cost = new Float64Array(GW * GH), dist = new Float64Array(GW * GH).fill(Infinity);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = i * CELL + CELL / 2, y = j * CELL + CELL / 2;
    let ok = inPoly(c.out, x, y) && !c.blocks.some(b => inPoly(b.p, x, y)) && c.segs.every(g => segDist2(x, y, g) > (BALL_R - 2) * (BALL_R - 2))
      && c.bumps.every(u => (x - u.x) * (x - u.x) + (y - u.y) * (y - u.y) > (u.r + BALL_R - 2) * (u.r + BALL_R - 2));
    let k = 1;
    for (const z of c.zones) {
      if (z.k === "sink" && inRect(z.r, x, y)) ok = false;
      if (z.k === "syrup" && (x - z.c[0]) * (x - z.c[0]) + (y - z.c[1]) * (y - z.c[1]) < z.c[2] * z.c[2]) k = 2;
    }
    cost[j * GW + i] = ok ? k : 0;
  }
  const ci = Math.floor(c.cup[0] / CELL), cj = Math.floor(c.cup[1] / CELL), heap: number[][] = [];
  const push = (d: number, n: number) => { heap.push([d, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  dist[cj * GW + ci] = 0; push(0, cj * GW + ci);
  while (heap.length) {
    const [d, n] = pop(); if (d > dist[n]) continue;
    const i = n % GW, j = (n - i) / GW;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, b2 = j + dj; if (a < 0 || b2 < 0 || a >= GW || b2 >= GH) continue;
      const m = b2 * GW + a; if (!cost[m]) continue;
      const nd = d + (di && dj ? 1.4142 : 1) * CELL * cost[m];
      if (nd < dist[m]) { dist[m] = nd; push(nd, m); }
    }
  }
  fields.set(key, dist);
  return dist;
}
function distAt(f: Float64Array, x: number, y: number) {
  const i = Math.max(0, Math.min(GW - 1, Math.floor(x / CELL))), j = Math.max(0, Math.min(GH - 1, Math.floor(y / CELL)));
  let best = f[j * GW + i];
  if (best === Infinity) for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < GW && b < GH) best = Math.min(best, f[b * GW + a] + CELL * 1.5); }
  return best === Infinity ? 999 : best;
}
type Brain = { rnd: () => number; sharp: number; k: number };
const POWERS = [0.1, 0.15, 0.2, 0.26, 0.32, 0.39, 0.46, 0.54, 0.62, 0.71, 0.8, 0.9, 1];
function pullFor(ai: number, pow: number) {
  const [co, si] = TRIG[((ai % 720) + 720) % 720];
  return { px: Math.round(-co * pow * MAX_PULL * 100) / 100, py: Math.round(-si * pow * MAX_PULL * 100) / 100 };
}
function judge(c: Course, f: Float64Array, x: number, y: number, ai: number, pow: number, clock: number) {
  const { px, py } = pullFor(ai, pow), b = simPutt(c, x, y, px, py, clock);
  return b.done === 2 ? -100 + pow : b.done === 3 ? distAt(f, x, y) + 60 : distAt(f, b.x, b.y);
}
/** Plans a putt a bit at a time (it yields so a phone can keep drawing). `noisy` false gives its best guess, no misses. */
function* aiPlan(c: Course, x: number, y: number, clock: number, b: Brain | null): Generator<void, { px: number; py: number }> {
  const f = fieldFor(c), found: number[][] = [];
  let n = 0;
  for (let ai = 0; ai < 720; ai += 10) for (const pw of POWERS) { found.push([judge(c, f, x, y, ai, pw, clock), ai, pw]); if (++n % 40 === 0) yield; }
  found.sort((p, q) => p[0] - q[0]);
  const tried = found.slice(0, 4);
  for (const [, ai0, pw0] of found.slice(0, 4)) for (const da of [-4, -2, 2, 4]) for (const dp of [-0.06, -0.03, 0, 0.03, 0.06]) {
    const pw = Math.max(0.08, Math.min(1, pw0 + dp));
    tried.push([judge(c, f, x, y, ai0 + da, pw, clock), ai0 + da, pw]);
    if (++n % 40 === 0) yield;
  }
  // a putt that only works when it's perfect isn't a good plan: score the best few by how they do a little off
  tried.sort((p, q) => p[0] - q[0]);
  let best = tried[0], bestAvg = Infinity;
  for (const [s0, ai0, pw0] of tried.slice(0, 8)) {
    let tot = s0;
    for (const da of [-6, 0, 6]) for (const dp of [-0.08, 0, 0.08]) if (da || dp) tot += judge(c, f, x, y, ai0 + da, Math.max(0.08, Math.min(1, pw0 * (1 + dp))), clock);
    if (tot / 9 < bestAvg) { bestAvg = tot / 9; best = [s0, ai0, pw0]; }
    yield;
  }
  let ai = best[1], pw = best[2];
  if (b) {
    const noise = () => (b.rnd() + b.rnd() + b.rnd() - 1.5) * 2;   // roughly a bell curve, without trig
    const spread = b.sharp * Math.max(0.6, 1 - 0.03 * b.k);
    ai = Math.round(ai + noise() * 15 * spread); pw = Math.max(0.08, Math.min(1, pw * (1 + noise() * 0.28 * spread)));
    b.k++;
  }
  return pullFor(ai, pw);
}
function sharpFor(mode: "daily" | "endless", round: number) { return mode === "daily" ? 1 : Math.max(0.6, 1 - 0.07 * (round - 1)); }
/** A hole's points for the player: 100 per stroke under 7, 100 per stroke under par, 200 more for a hole in one, 25 for beating the computer. */
function holePoints(strokes: number, par: number, cpu: number) {
  if (strokes >= PICKUP) return 0;
  return (PICKUP - strokes) * 100 + Math.max(0, par - strokes) * 100 + (strokes === 1 ? 200 : 0) + (strokes < cpu ? 25 : 0);
}
const WIN_BONUS = 500, TIE_BONUS = 200;
// ── SIM END ────────────────────────────────────────────────────────────────

const GAIN = 1, TURN_MS = 30000, THINK_MS = 1000, THINK_STEPS = 60, SETTLE_MS = 650, HOLE_MS = 2600, STEP = 1000 / 60;
const TOP = 58;                                          // the band at the top of the board: hole, par, strokes, whose turn
const FONT = "system-ui, -apple-system, sans-serif";
const FOOD_CODES = ["1f34e", "1f34a", "1f345", "1f95a"];
const FACTS: Toast[] = [
  { title: "Kitchen Fact", body: "It takes about 40 litres of maple sap to make 1 litre of maple syrup.", img: "1f95e" },
  { title: "Kitchen Fact", body: "Butter sold in Canada and the US has to be at least 80% milk fat.", img: "1f35e" },
  { title: "Kitchen Fact", body: "Ground beef is cooked safely once the inside reaches 71°C (160°F). A food thermometer is the sure way to tell.", img: "1f356" },
  { title: "Kitchen Fact", body: "To a botanist, a tomato is a fruit: it grows from the flower and holds the seeds.", img: "1f345" },
];
const sum = (v: number[]) => v.reduce((s, x) => s + x, 0);
const versus = (s: number, par: number) => (s >= PICKUP ? "🟥" : s === 1 ? "🌟" : s < par ? "🟦" : s === par ? "🟩" : s === par + 1 ? "🟨" : s === par + 2 ? "🟧" : "🟥");
const KEYCAP = ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣"];
function scoreName(s: number, par: number) {
  if (s >= PICKUP) return "Picked Up";
  if (s === 1) return "Hole In One!";
  const d = s - par;
  return d <= -2 ? "Eagle!" : d === -1 ? "Birdie!" : d === 0 ? "Par" : d === 1 ? "Bogey" : d === 2 ? "Double Bogey" : `${d} Over`;
}

type St = { hole: number; balls: number[][]; strokes: number[]; done: boolean[]; cards: number[][]; lead: number; shooter: number; n: number; clock: number };
const clone = (s: St): St => JSON.parse(JSON.stringify(s));
type Msg =
  | { t: "hello"; id: string; name: string }
  | { t: "lobby"; id: string; name: string; to: string; ready: boolean }   // host to guest: you're paired, here's my name and whether I'm ready
  | { t: "ready"; id: string; ready: boolean }                             // I tapped I'm Ready on the Get Ready card
  | { t: "start"; m: number; seed: number; first: 0 | 1; names: string[]; ids: string[] }
  | { t: "putt"; m: number; n: number; x: number; y: number; px: number; py: number; c: number }   // the putter let go: ball, pull and hole clock
  | { t: "done"; m: number; n: number; x: number; y: number; r: number; c: number }             // where it stopped (r: 1 stopped, 2 holed, 3 sink)
  | { t: "pass"; m: number; n: number }                                    // the putter's 30 seconds ran out: a stroke, the ball stays
  | { t: "aim"; m: number; n: number; px: number; py: number }             // the putter's pull while dragging (whole numbers, about 6 a second)
  | { t: "aimEnd"; m: number; n: number }                                  // they let go without putting
  | { t: "again" }
  | { t: "resume"; id: string; host: boolean; snap: unknown }              // back from a break: here is what I have
  | { t: "state"; host: boolean; snap: unknown }                           // and here is what I have
  | { t: "ping"; id: string; p: number }                                   // every 3 seconds mid-match: still here, and how far the match has got
  | { t: "away"; id: string }                                              // I'm switching apps or locking the phone
  | { t: "bye" };
type GameMsg = Extract<Msg, { n: number }>;
type LivePlay = { kind: "live"; code: string; m: number; seed: number; me: 0 | 1; first: 0 | 1; names: string[] };
type LocalPlay = { kind: "local"; m: number; seed: number; first: 0 | 1; names: string[] };
type Play = { kind: "cpu" } | LivePlay | LocalPlay;
type Phase = "aim" | "think" | "roll" | "await" | "settle" | "pass" | "holeEnd" | "between" | "over";
type Result = { kind: "won" | "lost" | "tie"; you: number; cpu: number; par: number; card: number[]; pars: number[]; rounds: number };
type Hud = { score: number; hole: number; round: number; tot: number[] };
type HoleCard = { hole: number; name: string; par: number; rows: { name: string; strokes: number }[]; pts: number | null };
type RoundCard = { round: number; won: boolean; tie: boolean; points: number; you: number; cpu: number };
type MatchEnd = { winner: number; tot: number[]; cards: number[][]; pars: number[] };

// ── live rooms ─────────────────────────────────────────────────────────────
// One Realtime channel per room, "kitchen-golf:CODE". Presence says who's in (2 at most; a third is told it's full).
// The guest says hello and the host answers with "lobby": both see the Get Ready card, and each "ready" is broadcast (and
// kept in presence). Only when both are ready does the host pick the seed and send start; then each stroke is a "putt"
// from the putter (both screens roll it) and a "done" with where it stopped, which the other screen takes as final.
// "pass" when a putt's 30 seconds run out, "again" for a rematch, "bye" on leaving.
// Each player keeps a seat id for the room (sessionStorage, with a localStorage copy), so a reload or a dropped connection
// comes back as the same player. Gone from presence mid-match means "Stepped Away" for 60 seconds, not gone: on return,
// "resume" and "state" swap snapshots of the match and each side keeps the newer one. Presence can take a while to notice
// a phone that lost signal, so each side also pings every 3 seconds: 12 seconds of silence counts as stepped away, a phone
// going to the background says "away" on its way out, and a ping that shows the friend further ahead asks for a catch-up.
const ALPHA = "ACDEFHJKMNPRTWXY";   // no I/L/1, O/Q/0, S/5, Z/2, B/8, G/6, U/V
const newCode = () => Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");
type Member = { id: string; name: string; role: "host" | "guest"; at: number; ready?: boolean };
type RoomUi = { s: "waiting" | "joining" | "lobby" | "full" | "empty" | "left" | "error"; code: string };
type Snap = { m: number; p: number; [k: string]: unknown };
type RoomHandlers = { start: (p: LivePlay) => void; game: (m: GameMsg) => void; left: () => void; snapshot: () => Snap | null; apply: (snap: Snap) => void; resumed: () => void };
type Saved = { code: string; role: Member["role"]; id: string; at: number; friendId: string; friendName: string; m: number; first: 0 | 1; loser: 0 | 1; t: number };
const ROOM_KEY = "kitchen-golf-room", LIVE_KEY = "kitchen-golf-live", AWAY_MS = 60000;
type SavedLive = { code: string; play: LivePlay; snap: Snap | null; t: number };
function readSaved(code?: string): Saved | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(ROOM_KEY) ?? localStorage.getItem(ROOM_KEY) ?? "null") as Saved | null;
    if (!v || (code && v.code !== code) || Date.now() - v.t > 3 * 3600 * 1000) return null;
    return v;
  } catch { return null; }
}
function readLive(): SavedLive | null {
  try { const v = JSON.parse(localStorage.getItem(LIVE_KEY) ?? "null") as SavedLive | null; return v && Date.now() - v.t < 3 * 3600 * 1000 ? v : null; } catch { return null; }
}
const forgetLive = () => { try { localStorage.removeItem(LIVE_KEY); } catch {} };

function useRoom(nameRef: { current: string }, handlers: { current: RoomHandlers }) {
  const [ui, setUi] = useState<RoomUi | null>(null);
  const [again, setAgainState] = useState({ me: false, them: false });
  const [ready, setReadyState] = useState({ me: false, them: false });   // the Get Ready card, before the first game
  const [friendName, setFriendName] = useState("Guest");
  const [away, setAwayState] = useState<number | null>(null);            // the friend stepped away: when their 60 seconds run out
  const [reconnecting, setReconnecting] = useState(false);               // we're catching up after our own break
  const s = useRef({ ch: null as RealtimeChannel | null, code: "", role: "host" as Member["role"], id: "", at: 0, friendId: "", friendName: "Guest",
    seen: false, m: 0, first: 0 as 0 | 1, loser: 1 as 0 | 1, last: null as Msg | null, again: { me: false, them: false }, ready: { me: false, them: false },
    timers: [] as ReturnType<typeof setTimeout>[], away: 0, awayT: null as ReturnType<typeof setTimeout> | null, heard: 0, ahead: 0 }).current;
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
  // only over a joined channel: otherwise supabase falls back to a REST call that fails in the browser; anything missed
  // while we're not joined is caught up by the resume / ping exchange
  const send = (msg: Msg) => { const ch = s.ch as (RealtimeChannel & { state?: string }) | null; if (ch && ch.state === "joined" && sb().realtime.isConnected()) void ch.send({ type: "broadcast", event: "m", payload: msg }); };
  const track = () => { if ((s.ch as unknown as { state?: string } | null)?.state === "joined") void s.ch?.track({ id: s.id, name: nameRef.current, role: s.role, at: s.at, ready: s.ready.me }); };   // presence keeps "ready" too
  const clearAway = () => {
    if (s.awayT) clearTimeout(s.awayT); s.awayT = null;
    if (s.away) { s.away = 0; setAwayState(null); }
  };
  const close = (bye: boolean, keep = false) => {
    s.timers.forEach(t => { clearTimeout(t); clearInterval(t); }); s.timers = [];
    const ch = s.ch; s.ch = null;
    if (ch) {
      if (bye && (ch as unknown as { state?: string }).state === "joined") void ch.send({ type: "broadcast", event: "m", payload: { t: "bye" } });
      void ch.untrack().catch(() => {}); void sb().removeChannel(ch);
    }
    if (keep) return;                                                  // reconnecting: the match carries on
    clearAway(); setReconnecting(false);
    setFriend("", "Guest"); s.seen = false; s.m = 0; s.last = null; setAgain({ me: false, them: false }); setReady({ me: false, them: false });
  };
  // gone from presence mid-match: give them 60 seconds (they may have just answered a text); "bye" or the 60s ending is final
  const friendGone = (final = false) => {
    if (!s.ch && !s.away) return;
    if (s.role === "host" && !s.m) {                                     // left from the Get Ready card: keep the room open for them
      setFriend("", "Guest"); s.seen = false; setReady({ me: false, them: false }); track(); setUi({ s: "waiting", code: s.code }); return;
    }
    if (!final && s.m) {
      if (s.away) return;
      s.away = Date.now() + AWAY_MS; setAwayState(s.away);
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
    s.m++; s.first = first; s.heard = Date.now(); setAgain({ me: false, them: false });
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
    if (!mine || snap.m > mine.m || (snap.m === mine.m && (snap.p > mine.p || (snap.p === mine.p && fromHost && s.role !== "host")))) {
      if (snap.m > s.m) { s.m = snap.m; save(); }
      handlers.current.apply(snap);
    }
  };
  // catch up with the friend: send ours, they answer with theirs, each keeps the newer
  const resync = () => { if (s.ch && s.m) send({ t: "resume", id: s.id, host: s.role === "host", snap: handlers.current.snapshot() }); };
  const onMsg = (msg: Msg) => {
    if (s.m && msg.t !== "hello" && msg.t !== "lobby" && (!("id" in msg) || msg.id === s.friendId)) {
      s.heard = Date.now();
      if (s.away && msg.t !== "away" && msg.t !== "bye" && msg.t !== "resume") { clearAway(); resync(); }   // back after going quiet
    }
    if (msg.t === "ping") {
      if (!s.m && s.role === "guest" && msg.id === s.friendId) { send({ t: "hello", id: s.id, name: nameRef.current }); return; }   // the host has started and we missed it: ask again
      const mine = handlers.current.snapshot();
      s.ahead = mine && msg.p > mine.p ? s.ahead + 1 : 0;
      if (s.ahead >= 3) { s.ahead = 0; resync(); }                     // they've been ahead of us for a while: we missed something
      return;
    }
    if (msg.t === "away") { if (msg.id === s.friendId) friendGone(); return; }
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
      s.m = msg.m; s.first = msg.first; s.heard = Date.now(); setFriend(msg.ids[0], msg.names[0]); setAgain({ me: false, them: false }); setUi(null);
      handlers.current.start({ kind: "live", code: s.code, m: msg.m, seed: msg.seed, me: 1, first: msg.first, names: msg.names });
    } else if (msg.t === "again") {
      setAgain({ ...s.again, them: true });
      if (s.role === "host" && s.again.me) begin(s.loser);
    } else if (msg.t === "resume") {
      if (msg.id !== s.friendId) return;
      clearAway(); send({ t: "state", host: s.role === "host", snap: handlers.current.snapshot() });
      consider(msg.snap as Snap | null, msg.host); handlers.current.resumed();
    } else if (msg.t === "state") {
      consider(msg.snap as Snap | null, msg.host); setReconnecting(false); handlers.current.resumed();
    } else if (msg.t === "bye") friendGone(true);
    else handlers.current.game(msg);
  };
  function open(code: string, role: Member["role"], resume?: Saved) {
    close(false, !!resume);
    const prior = resume ?? readSaved(code);                           // same room as before: same seat
    s.code = code; s.role = role; s.id = prior?.id ?? Math.random().toString(36).slice(2, 10); s.at = prior?.at ?? Date.now();
    if (resume) { s.friendId = resume.friendId; s.friendName = resume.friendName || "Guest"; setFriendName(s.friendName); s.m = resume.m; s.first = resume.first; s.loser = resume.loser; s.seen = false; }
    const ch = sb().channel(`kitchen-golf:${code}`, { config: { broadcast: { self: false }, presence: { key: s.id } } });
    s.ch = ch; s.heard = Date.now(); save();
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
  // mid-match heartbeat: say we're here; a friend silent for 12 seconds has stepped away (or we've lost signal)
  useEffect(() => {
    const t = setInterval(() => {
      if (!s.ch || !s.m || !s.friendId || document.visibilityState !== "visible") return;
      const sn = handlers.current.snapshot();
      send({ t: "ping", id: s.id, p: sn ? sn.p : 0 });
      if (!s.away && s.heard && Date.now() - s.heard > 12000) {
        if (typeof navigator !== "undefined" && navigator.onLine === false) setReconnecting(true);
        else friendGone();
      }
    }, 3000);
    const hide = () => { if (document.visibilityState === "hidden" && s.ch && s.m) send({ t: "away", id: s.id }); };
    const gone = () => { if (s.ch && s.m) send({ t: "away", id: s.id }); };   // reloads and closed tabs count as away, not leaving
    document.addEventListener("visibilitychange", hide); window.addEventListener("pagehide", gone);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", gone); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  // back from another app (or the network): make sure we're still in the room, and catch up
  useEffect(() => {
    const back = () => {
      if (document.visibilityState !== "visible" || !s.code || !(s.m || s.friendId)) return;
      try { const rt = sb().realtime; if (!rt.isConnected()) rt.connect(); } catch {}   // don't sit out the socket's reconnect backoff
      const ch = s.ch as unknown as { state?: string } | null;
      if (!ch || ch.state !== "joined") { setReconnecting(true); open(s.code, s.role, current()); }
      else { track(); if (s.m) { setReconnecting(true); sendResume(); } }
    };
    document.addEventListener("visibilitychange", back); window.addEventListener("pageshow", back); window.addEventListener("online", back);
    return () => { document.removeEventListener("visibilitychange", back); window.removeEventListener("pageshow", back); window.removeEventListener("online", back); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  return {
    ui, again, ready, friendName, away, reconnecting,
    debug: () => ({ ch: (s.ch as unknown as { state?: string } | null)?.state ?? null, m: s.m, away: s.away, heard: Date.now() - s.heard, friend: s.friendId, id: s.id }),
    ended: (winner: number) => { s.loser = (winner < 0 ? 1 - s.first : 1 - winner) as 0 | 1; save(); },
    isHost: () => s.role === "host",
    code: () => s.code,
    saved: () => { const v = readSaved(); return v && v.m ? v : null; },
    rejoin: (v: Saved) => open(v.code, v.role, v),
    forget,
    create: () => open(newCode(), "host"),
    join: (code: string) => { const v = readSaved(code); if (v && v.m) open(code, v.role, v); else open(code, "guest"); },
    leave: () => { close(true); forget(); setUi(null); },
    resync,
    dismiss: () => setUi(null),
    // tapping I'm Ready: tell them straight away, keep it in presence too, and let the host check
    markReady: () => { if (s.ready.me || s.m) return; setReady({ ...s.ready, me: true }); send({ t: "ready", id: s.id, ready: true }); track(); hostCheck(); },
    rematch: () => { setAgain({ ...s.again, me: true }); send({ t: "again" }); if (s.role === "host" && s.again.them) begin(s.loser); },
    send,
  };
}

// ── the game ───────────────────────────────────────────────────────────────
export default function KitchenGolf() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("daily");
  const [run, setRun] = useState(0);                 // bump to restart
  const [play, setPlay] = useState<Play>({ kind: "cpu" });
  const [started, setStarted] = useState(false);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [roundCard, setRoundCard] = useState<RoundCard | null>(null);
  const [holeCard, setHoleCard] = useState<HoleCard | null>(null);
  const [matchEnd, setMatchEnd] = useState<MatchEnd | null>(null);   // live and same-phone matches; winner -1 is a tie
  const [passTo, setPassTo] = useState<string | null>(null);
  const [wins, setWins] = useState([0, 0]);
  const [hud, setHud] = useState<Hud>({ score: 0, hole: 1, round: 1, tot: [0, 0] });
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
  const skipRef = useRef<() => void>(() => {});
  const engineRef = useRef<{ m: number; remote: (msg: GameMsg) => void; snap: () => Snap | null; apply: (sn: Snap) => void; resumed: () => void } | null>(null);
  const pendingSnap = useRef<Snap | null>(null);           // a snapshot to load once the live match it belongs to is set up
  const inbox = useRef<GameMsg[]>([]);
  const nameRef = useRef("Guest"); nameRef.current = shell.player?.name || "Guest";
  const handlers = useRef<RoomHandlers>({ start: () => {}, game: () => {}, left: () => {}, snapshot: () => null, apply: () => {}, resumed: () => {} });
  handlers.current = {
    start: p => { inbox.current = inbox.current.filter(q => q.m >= p.m); pendingSnap.current = null; setMatchEnd(null); setMenu(null); setPlay(p); },
    game: msg => { const e = engineRef.current; if (e && e.m === msg.m) e.remote(msg); else inbox.current.push(msg); },
    left: () => { setMatchEnd(null); setPlay({ kind: "cpu" }); forgetLive(); },
    snapshot: () => engineRef.current?.snap() ?? null,
    apply: sn => {
      const P = playRef.current;
      if (P.kind === "live" && P.m === sn.m && engineRef.current) { engineRef.current.apply(sn); return; }
      pendingSnap.current = sn; setMatchEnd(null); setMenu(null);
      setPlay({ kind: "live", code: roomRef.current.code(), m: sn.m, seed: sn.seed as number, me: roomRef.current.isHost() ? 0 : 1, first: sn.first as 0 | 1, names: sn.names as string[] });
    },
    resumed: () => engineRef.current?.resumed(),
  };
  const room = useRoom(nameRef, handlers);
  const roomRef = useRef(room); roomRef.current = room;
  const awayRef = useRef(false); awayRef.current = !!room.away || room.reconnecting;      // live turn timers stop while either of you is away
  const reconRef = useRef(false); reconRef.current = room.reconnecting;                   // no putting while we catch up
  const [offer, setOffer] = useState<{ saved: Saved; live: SavedLive } | null>(null);     // a match from before a reload
  const [now, setNow] = useState(0);
  useEffect(() => { if (!room.away) return; setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [room.away]);
  const bestKey = mode === "daily" ? `kitchengolf-daily-${torontoDate()}` : "kitchengolf-endless";
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
  }, []);

  const playKey = play.kind === "cpu" ? "cpu" : play.kind === "live" ? `live-${play.code}-${play.m}` : `local-${play.m}`;
  useEffect(() => {
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const { ctx, stop } = fitCanvas(canvas, wrap, W, H, setBoard, 0);   // no fact strip: the board gets the room
    const imgList = loadImages(FOOD_CODES), imgs: Record<string, HTMLImageElement> = {};
    FOOD_CODES.forEach((c, i) => { imgs[c] = imgList[i]; });
    const P = playRef.current, cpu = P.kind === "cpu", live = P.kind === "live", local = P.kind === "local";
    const me = P.kind === "live" ? P.me : 0, other = 1 - me;
    const pnames = P.kind === "cpu" ? ["You", "Computer"] : P.kind === "live" ? P.names.map((v, i) => (i !== me && v === "Guest" ? "Friend" : v)) : P.names;   // an unnamed friend is "Friend", not "Guest"
    const seed = P.kind === "cpu" ? (mode === "daily" ? dailySeed(0x6017f) : Math.floor(Math.random() * 1e9)) : P.seed;
    const human = (i: number) => (cpu ? i === 0 : live ? i === me : true);
    const label = (i: number) => (cpu || live ? (i === me ? "You" : pnames[i]) : pnames[i]);
    const mnum = P.kind === "live" ? P.m : 0;
    const brain: Brain = { rnd: mulberry32(seed ^ 0x5eed1), sharp: sharpFor(mode, 1), k: 0 };
    const roundSeed = (r: number) => (seed ^ Math.imul(r, 0x9e3779b1)) | 0;
    let round = 1, holes = pickHoles(roundSeed(1));
    const first = P.kind === "cpu" ? 0 : P.first;
    let course = compile(holes[0].id, holes[0].mirror);
    let st: St = { hole: 0, balls: [], strokes: [0, 0], done: [false, false], cards: [[], []], lead: first, shooter: first, n: 0, clock: 0 };
    function setupHole(i: number, lead: number) {
      course = compile(holes[i].id, holes[i].mirror);
      Object.assign(st, { hole: i, balls: [course.tee.slice(), course.tee.slice()], strokes: [0, 0], done: [false, false], lead, shooter: lead, clock: 0 });
    }
    setupHole(0, first);
    let turnStart = clone(st), ended: number | null = null, counted = false;

    let phase: Phase = "aim", started = !cpu, wait = 0, turnLeft = TURN_MS, acc = 0, clockAcc = 0, pendingAge = 0, lastPass = -1;
    let total = 0, roundPts = 0, allStrokes = 0, realStart = performance.now(), raf = 0, last = performance.now();
    let roll: Roll | null = null, pending: Extract<GameMsg, { t: "done" }> | null = null;
    let plan: Generator<void, { px: number; py: number }> | null = null, planned: { px: number; py: number } | null = null, planClock = 0;
    let shown: { course: Course; balls: number[][]; done: boolean[]; hole: number; strokes: number[] } | null = null;   // the hole just finished, under its score card
    let drag: { sx: number; sy: number; px: number; py: number; id: number } | null = null;
    const seen = { x: 0, y: 0, tx: 0, ty: 0, on: false };   // the other player's pull, as last heard (live) or planned (computer)
    let aimSent = "", aimAt = 0;
    const firstPutt = [true, true];
    const floats: { x: number; y: number; text: string; color: string; age: number; big?: boolean }[] = [];
    const ripples: { x: number; y: number; age: number }[] = [];
    let drop: { x: number; y: number; age: number } | null = null;
    const trail: { x: number; y: number }[] = [];
    const pushHud = () => setHud({ score: total, hole: shown ? shown.hole : st.hole + 1, round, tot: [sum(st.cards[0]), sum(st.cards[1])] });
    setOver(false); setResult(null); setRoundCard(null); setHoleCard(null); setToast(null); setPassTo(null); setStarted(!cpu); resetScores(); pushHud();

    const toView = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
    const myTurn = () => phase === "aim" && ended === null && human(st.shooter) && (live ? st.shooter === me : true);
    const canAim = () => started && myTurn() && !(pausedRef.current && !live) && !(live && reconRef.current);
    const float = (x: number, y: number, text: string, color: string, big = false) => floats.push({ x, y, text, color, age: 0, big });
    const send = (msg: Msg) => { if (live) roomRef.current.send(msg); };
    function persist() {
      if (P.kind !== "live") return;
      try { localStorage.setItem(LIVE_KEY, JSON.stringify({ code: P.code, play: P, snap: takeSnap(), t: Date.now() })); } catch {}
    }
    function snapNow() { turnStart = clone(st); persist(); }

    // a new turn on screen: pass the phone, let the computer think, or wait for a putt
    function beginTurn() {
      turnLeft = TURN_MS; drag = null; aimSent = ""; Object.assign(seen, { x: 0, y: 0, tx: 0, ty: 0, on: false });
      planned = null; plan = null;
      if (ended !== null) return;
      const s = st.shooter;
      if (local && s !== lastPass) { phase = "pass"; lastPass = s; setPassTo(pnames[s]); }
      else if (cpu && s === 1) { phase = "think"; wait = THINK_MS; planClock = st.clock + THINK_STEPS; plan = aiPlan(course, st.balls[1][0], st.balls[1][1], planClock, brain); seen.on = true; }
      else phase = "aim";
      pushHud();
    }
    passRef.current = () => { if (phase !== "pass") return; phase = "aim"; setPassTo(null); };

    function fire(px: number, py: number, c: number) {
      const s = st.shooter, [x, y] = st.balls[s];
      st.clock = c; roll = startRoll(x, y, px, py, c); trail.length = 0; seen.on = false; drag = null;
      if (human(s)) firstPutt[s] = false;
      if (live && s === me) send({ t: "putt", m: mnum, n: st.n, x, y, px, py, c });
      phase = "roll"; acc = 0; pending = null; pendingAge = 0;
    }
    function rollEnded() {
      const r = roll!;
      if (r.done === 3) { ripples.push({ x: r.x, y: r.y, age: 0 }); }
      if (r.done === 2) drop = { x: r.x, y: r.y, age: 0 };
      if (live && st.shooter !== me) { if (pending) applyDone(pending); else phase = "await"; return; }
      const res = { x: r.x, y: r.y, r: r.done, c: r.clock };
      if (live) send({ t: "done", m: mnum, n: st.n, ...res });
      applyResult(res);
    }
    function applyDone(msg: Extract<GameMsg, { t: "done" }>) {
      if (msg.r === 2 && !drop && (!roll || roll.done !== 2)) drop = { x: course.cup[0], y: course.cup[1], age: 0 };
      applyResult({ x: msg.x, y: msg.y, r: msg.r, c: msg.c });
    }
    // a stroke counts: where the ball ended, the sink's extra stroke, picking up after 6
    function applyResult(res: { x: number; y: number; r: number; c: number }) {
      const s = st.shooter; roll = null; pending = null;
      const [bx, by] = st.balls[s];
      if (res.r === 3) { st.strokes[s] += 2; float(bx, by - 26, "Splash! +1 Stroke", "#3f7fd6"); }
      else {
        st.strokes[s] += 1;
        if (res.r === 2) { st.done[s] = true; st.balls[s] = course.cup.slice(); float(course.cup[0], course.cup[1] - 30, scoreName(st.strokes[s], course.par), "#2eaa6e", true); }
        else st.balls[s] = [res.x, res.y];
      }
      if (!st.done[s] && st.strokes[s] >= MAX_STROKES) { st.done[s] = true; st.strokes[s] = PICKUP; float(st.balls[s][0], st.balls[s][1] - 26, "Picked Up", "#5a6b85"); }
      st.clock = res.c;
      advance(s);
    }
    function doPass() {
      const s = st.shooter; st.strokes[s] += 1; drag = null;
      float(st.balls[s][0], st.balls[s][1] - 26, "Time's Up! +1", "#e09a00");
      if (st.strokes[s] >= MAX_STROKES) { st.done[s] = true; st.strokes[s] = PICKUP; }
      advance(s);
    }
    function advance(s: number) {
      st.n++;
      if (!(st.done[0] && st.done[1])) {
        st.shooter = st.done[1 - s] ? s : 1 - s;
        snapNow(); phase = "settle"; wait = SETTLE_MS; pushHud(); return;
      }
      // the hole is over: the card shows it while the next hole is set up underneath
      const sc = st.strokes.slice(), par = course.par;
      st.cards[0].push(sc[0]); st.cards[1].push(sc[1]);
      shown = { course, balls: st.balls.map(b => b.slice()), done: [true, true], hole: st.hole + 1, strokes: sc };
      let pts: number | null = null;
      if (cpu) { pts = holePoints(sc[0], par, sc[1]); total += pts; roundPts += pts; }
      const order = cpu || live ? [me, other] : [0, 1];
      setHoleCard({ hole: st.hole + 1, name: course.name, par, rows: order.map(i => ({ name: label(i), strokes: sc[i] })), pts });
      if (st.hole < ROUND_HOLES - 1) setupHole(st.hole + 1, sc[0] < sc[1] ? 0 : sc[1] < sc[0] ? 1 : 1 - st.lead);   // lower score putts first; a tie swaps
      else if (!cpu) { const a = sum(st.cards[0]), b = sum(st.cards[1]); ended = a < b ? 0 : b < a ? 1 : -1; }
      snapNow(); phase = "holeEnd"; wait = HOLE_MS; pushHud();
    }
    skipRef.current = () => { if (phase === "holeEnd" && !live) wait = 0; };
    function afterHoleCard() {
      setHoleCard(null); shown = null; pushHud();
      if (ended !== null) { finishMatch(); return; }
      if (cpu && st.cards[0].length >= ROUND_HOLES) { endRound(); return; }
      beginTurn();
    }
    function finishMatch() {
      phase = "over"; drag = null;
      if (counted) return; counted = true;
      const w = ended!;
      if (live) roomRef.current.ended(w);
      setWins(v => (w < 0 ? v : v.map((x, i) => (i === w ? x + 1 : x))));
      setMatchEnd({ winner: w, tot: [sum(st.cards[0]), sum(st.cards[1])], cards: st.cards.map(c => c.slice()), pars: holes.map(h => HOLES[h.id].par) });
      persist();
    }
    function endRound() {
      const a = sum(st.cards[0]), b = sum(st.cards[1]), bonus = a < b ? WIN_BONUS : a === b ? TIE_BONUS : 0;
      total += bonus; roundPts += bonus; pushHud();
      if (mode === "daily") finish(a < b ? "won" : a === b ? "tie" : "lost");
      else if (a <= b) { phase = "between"; setRoundCard({ round, won: a < b, tie: a === b, points: roundPts, you: a, cpu: b }); }
      else finish("lost");
    }
    function nextRound() {
      if (phase !== "between") return;
      allStrokes += sum(st.cards[0]); round++; holes = pickHoles(roundSeed(round)); brain.sharp = sharpFor(mode, round); roundPts = 0;
      st.cards = [[], []]; setupHole(0, 0); floats.length = 0; setRoundCard(null); beginTurn(); pushHud();
    }
    nextRef.current = nextRound;
    function finish(kind: Result["kind"]) {
      phase = "over";
      const pars = holes.map(h => HOLES[h.id].par);
      setToast(FACTS[Math.floor(Math.random() * FACTS.length)]);
      setResult({ kind, you: sum(st.cards[0]), cpu: sum(st.cards[1]), par: sum(pars), card: st.cards[0].slice(), pars, rounds: round });
      pushHud(); setOver(true);
      if (total > readBest(bestKey)) { saveBest(bestKey, total); setBest(total); }
      shell.finishRef.current({ score: total, drops: allStrokes + sum(st.cards[0]), ms: performance.now() - realStart });
    }
    startRef.current = () => { if (started) return; started = true; realStart = performance.now(); setStarted(true); };

    // ── live: messages from the friend, held until the game is ready for them; snapshots for catching up ──
    const mail: GameMsg[] = [];
    let loaded = false;
    function pump() {
      for (let k = 0; k < mail.length; k++) {
        const msg = mail[k];
        if (msg.n < st.n) { mail.splice(k--, 1); continue; }
        if (msg.n !== st.n || st.shooter === me || ended !== null) continue;
        if (msg.t === "putt" && phase === "aim") { mail.splice(k--, 1); st.balls[st.shooter] = [msg.x, msg.y]; fire(msg.px, msg.py, msg.c); }
        else if (msg.t === "pass" && phase === "aim") { mail.splice(k--, 1); doPass(); }
        else if (msg.t === "done" && phase === "roll") { mail.splice(k--, 1); pending = msg; pendingAge = 0; }
        else if (msg.t === "done" && (phase === "await" || phase === "aim")) { mail.splice(k--, 1); applyDone(msg); }
      }
    }
    function takeSnap(): Snap | null {
      if (P.kind !== "live") return null;
      return { m: P.m, p: ended !== null ? 1e5 : turnStart.n, seed: P.seed, first: P.first, names: P.names, st: turnStart, end: ended };
    }
    function loadSnap(sn: Snap) {
      const s2 = sn.st as St;
      if (sn.end == null && ended === null && s2.n === st.n && st.shooter === me && phase === "roll") return;   // my putt is rolling: I finish it and send where it stopped
      st = clone(s2); course = compile(holes[st.hole].id, holes[st.hole].mirror);
      roll = null; pending = null; drag = null; shown = null; drop = null; setHoleCard(null);
      for (let k = mail.length - 1; k >= 0; k--) if (mail[k].n < st.n) mail.splice(k, 1);
      turnStart = clone(st);
      if (sn.end != null) { ended = sn.end as number; finishMatch(); }
      else { ended = null; counted = false; setMatchEnd(null); beginTurn(); persist(); }
      pushHud();
    }
    // after a break: if we were watching the friend's putt roll, it may never finish here; their "done" (or snapshot) settles it
    function resumed() { if (live && ended === null && st.shooter !== me && (phase === "roll" || phase === "await")) { roll = null; pending = null; phase = "aim"; } }
    if (P.kind === "live") {
      engineRef.current = { m: P.m, snap: takeSnap, apply: loadSnap, resumed, remote: msg => {
        if (msg.t !== "aim" && msg.t !== "aimEnd") { mail.push(msg); if (msg.n > st.n + (phase === "settle" || phase === "holeEnd" ? 1 : 0)) roomRef.current.resync(); return; }
        if (msg.n !== st.n || st.shooter === me || phase !== "aim") return;   // aim is just for show: drop anything stale
        if (msg.t === "aim") Object.assign(seen, { tx: msg.px, ty: msg.py, on: true }); else Object.assign(seen, { tx: 0, ty: 0 });
      } };
      inbox.current = inbox.current.filter(q => { if (q.m === P.m) { mail.push(q); return false; } return q.m > P.m; });
      if (pendingSnap.current && pendingSnap.current.m === P.m) { const sn = pendingSnap.current; pendingSnap.current = null; loadSnap(sn); loaded = true; }
      else persist();
    } else engineRef.current = null;

    // ── input: drag back anywhere on the board ──
    const onDown = (e: PointerEvent) => {
      if (drag || !canAim()) return;
      const p = toView(e);
      drag = { sx: p.x, sy: p.y, px: 0, py: 0, id: e.pointerId };
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = toView(e); let px = (p.x - drag.sx) * GAIN, py = (p.y - drag.sy) * GAIN;
      const l = Math.hypot(px, py); if (l > MAX_PULL) { px = (px / l) * MAX_PULL; py = (py / l) * MAX_PULL; }
      drag.px = px; drag.py = py;
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      onMove(e); const d = drag; drag = null;
      if (!canAim() || Math.hypot(d.px, d.py) < MIN_PULL) { aimEnd(); return; }
      fire(Math.round(d.px * 100) / 100, Math.round(d.py * 100) / 100, st.clock);
    };
    const onCancel = () => { if (drag) aimEnd(); drag = null; };
    function aimEnd() { if (live && st.shooter === me && phase === "aim") { send({ t: "aimEnd", m: mnum, n: st.n }); aimSent = "0,0"; } }
    function sendAim(t: number) {
      if (!live || st.shooter !== me || phase !== "aim" || !drag || t - aimAt < 160) return;
      const k = `${Math.round(drag.px)},${Math.round(drag.py)}`; if (k === aimSent) return;
      const [px, py] = k.split(",").map(Number); aimSent = k; aimAt = t;
      send({ t: "aim", m: mnum, n: st.n, px, py });
    }
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onCancel);
    if (!loaded) beginTurn();

    /* TEST-HOOK-START */ if (new URLSearchParams(window.location.search).has("debug")) (window as unknown as { __golf: unknown }).__golf = {
      room: () => roomRef.current.debug(),
      state: () => ({ phase, n: st.n, hole: st.hole, holeId: holes[st.hole].id, shooter: st.shooter, me, balls: st.balls, strokes: st.strokes, done: st.done, cards: st.cards, ended, total,
        clock: st.clock, turnLeft, seen: seen.on ? [Math.round(seen.x), Math.round(seen.y)] : null, dragging: !!drag, holes: holes.map(h => h.id) }),
      show: (id: number, mirror = false) => { holes[st.hole] = { id, mirror }; setupHole(st.hole, st.shooter); snapNow(); beginTurn(); },
      aim: () => { const s = st.shooter, g = aiPlan(course, st.balls[s][0], st.balls[s][1], st.clock + 30, null); let r; while (!(r = g.next()).done); return r.value; },
    }; /* TEST-HOOK-END */

    const loop = (t: number) => {
      const dt = Math.max(0, Math.min(100, t - last)); last = t;
      const frozen = !started || (!live && pausedRef.current);
      if (!live && pausedRef.current) drag = null;
      if (!frozen) {
        if (live) pump();
        if (phase === "roll" && roll) {
          acc += dt; let n = 0;
          while (acc >= STEP && n < 8 && roll && !roll.done) {
            acc -= STEP; n++; stepRoll(course, roll); st.clock = roll.clock;
            if (roll.steps % 2 === 0) { trail.push({ x: roll.x, y: roll.y }); if (trail.length > 12) trail.shift(); }
          }
          if (n >= 8) acc = 0;
          if (roll && roll.done) rollEnded();
          else if (pending && (pendingAge += dt) > 2500) applyDone(pending);   // way behind: catch up
        } else {
          clockAcc += dt; while (clockAcc >= STEP) { clockAcc -= STEP; st.clock++; }   // the mixer and the rolling pin keep moving
          if (phase === "think") {
            wait -= dt;
            if (plan) { const t0 = performance.now(); while (plan && performance.now() - t0 < 8) { const r = plan.next(); if (r.done) { planned = r.value; plan = null; } } }
            const tgt = planned ?? { px: 0, py: 0 }, k = planned ? Math.min(1, Math.max(0, 1.6 * (1 - wait / THINK_MS) - 0.3)) : 0, e = k * k * (3 - 2 * k);
            seen.tx = tgt.px * e + Math.sin(t / 160) * 10 * (1 - e) + (1 - e) * 20; seen.ty = tgt.py * e + Math.cos(t / 200) * 8 * (1 - e) + (1 - e) * 20;
            if (wait <= 0 && planned) fire(planned.px, planned.py, planClock);
          } else if (phase === "settle") { wait -= dt; if (wait <= 0) beginTurn(); }
          else if (phase === "holeEnd") { wait -= dt; if (wait <= 0) afterHoleCard(); }
          else if (phase === "aim" && live) {
            sendAim(t);
            if (!awayRef.current) turnLeft -= dt;                       // paused while either of you is away
            if (turnLeft <= 0 && st.shooter === me && !reconRef.current) { send({ t: "pass", m: mnum, n: st.n }); doPass(); }
          } else if (phase === "await") pendingAge += dt;
        }
        const ease = Math.min(1, dt / 110); seen.x += (seen.tx - seen.x) * ease; seen.y += (seen.ty - seen.y) * ease;
        for (let k = floats.length - 1; k >= 0; k--) { floats[k].age += dt; if (floats[k].age > (floats[k].big ? 2000 : 1300)) floats.splice(k, 1); }
        for (let k = ripples.length - 1; k >= 0; k--) { ripples[k].age += dt; if (ripples[k].age > 700) ripples.splice(k, 1); }
        if (drop) { drop.age += dt; if (drop.age > 400) drop = null; }
      }
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    // ── drawing ──
    const rr = (x: number, y: number, ww: number, hh: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, ww, hh, r); };
    const text = (s: string, x: number, y: number, size: number, color: string, weight = 700, align: CanvasTextAlign = "center") => {
      ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y);
    };
    const poly = (p: Pt[]) => { ctx.beginPath(); p.forEach(([x, y], i) => { if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); };
    const specks: number[][] = []; { const r = mulberry32(77); for (let i = 0; i < 90; i++) specks.push([r() * W, r() * H, 0.8 + r() * 1.6, r()]); }
    const colorOf = (i: number) => (cpu || live ? (i === me ? "#3f7fd6" : "#e8505b") : i === 0 ? "#3f7fd6" : "#e8505b");
    function drawCourse(c: Course, clock: number) {
      // the counter
      ctx.fillStyle = "#efe7dc"; ctx.fillRect(0, 0, W, H);
      for (const [x, y, r, k] of specks) { ctx.fillStyle = k < 0.5 ? "rgba(140,110,80,0.18)" : "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
      // the mat, with a cutting-mat grid
      ctx.save(); ctx.shadowColor = "rgba(60,40,20,0.22)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6; poly(c.out); ctx.fillStyle = "#8fcf86"; ctx.fill(); ctx.restore();
      ctx.save(); poly(c.out); ctx.clip();
      ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x <= W; x += 20) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 0; y <= H; y += 20) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      // zones
      for (const z of c.zones) {
        if (z.k === "syrup") {
          const [x, y, r] = z.c;
          ctx.fillStyle = "rgba(222,140,24,0.85)"; ctx.strokeStyle = "rgba(170,92,12,0.9)"; ctx.lineWidth = 2; ctx.beginPath();
          for (let i = 0; i <= 24; i++) { const [co, si] = TRIG[(i * 30) % 720], rr2 = r * (1 + 0.07 * ((i * 7) % 3 - 1)); if (i) ctx.lineTo(x + co * rr2, y + si * rr2); else ctx.moveTo(x + co * rr2, y + si * rr2); }
          ctx.fill(); ctx.stroke(); ctx.fillStyle = "rgba(255,236,190,0.7)"; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.12, -0.5, 0, 7); ctx.fill();
        } else if (z.k === "butter") {
          const [x0, y0, x1, y1] = z.r; rr(x0, y0, x1 - x0, y1 - y0, 10); ctx.fillStyle = "#fbe9a6"; ctx.fill(); ctx.strokeStyle = "#efcf62"; ctx.lineWidth = 2; ctx.stroke();
          ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 3; ctx.beginPath();
          for (let x = x0 + 18; x < x1 - 10; x += 34) { ctx.moveTo(x, y0 + 14); ctx.lineTo(x + 14, y0 + 30); }
          ctx.stroke();
        } else if (z.k === "sink") {
          const [x0, y0, x1, y1] = z.r; rr(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2, 14); ctx.fillStyle = "#c7d0db"; ctx.fill(); ctx.strokeStyle = "#9aa6b8"; ctx.lineWidth = 3; ctx.stroke();
          rr(x0 + 8, y0 + 8, x1 - x0 - 16, y1 - y0 - 16, 10); ctx.fillStyle = "#86bdf0"; ctx.fill();
          const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
          ctx.fillStyle = "#6b7a90"; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, 7); ctx.fill(); ctx.strokeStyle = "#c7d0db"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy); ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5); ctx.stroke();
          ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 2; const w2 = Math.sin(clock / 30) * 3;
          for (const k of [0.3, 0.7]) { ctx.beginPath(); ctx.ellipse(cx + (k - 0.5) * (x1 - x0) * 0.5, y0 + (y1 - y0) * k, 14 + w2, 4, 0, 0, 7); ctx.stroke(); }
        } else {
          const [x0, y0, x1, y1] = z.r, g = ctx.createLinearGradient(x0, y0, x0 + (z.ax ? x1 - x0 : 0), y0 + (z.ay ? y1 - y0 : 0));
          g.addColorStop(z.ay > 0 || z.ax > 0 ? 0 : 1, "#e9edf2"); g.addColorStop(z.ay > 0 || z.ax > 0 ? 1 : 0, "#a9b3c1");   // darker at the bottom of the slope
          ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
          ctx.fillStyle = "rgba(90,107,133,0.35)";
          for (let x = x0 + 26; x < x1 - 20; x += 30) { rr(x, y0 + 14, 8, y1 - y0 - 28, 4); ctx.fill(); }   // spatula slots
          const dx = Math.sign(z.ax), dy = Math.sign(z.ay), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
          ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
          for (const o of [-24, 0, 24]) { const px = cx + dx * o, py = cy + dy * o; ctx.beginPath(); ctx.moveTo(px - dy * 14 - dx * 7, py - dx * 14 - dy * 7); ctx.lineTo(px + dx * 7, py + dy * 7); ctx.lineTo(px + dy * 14 - dx * 7, py + dx * 14 - dy * 7); ctx.stroke(); }
        }
      }
      // the tee
      rr(c.tee[0] - 16, c.tee[1] - 11, 32, 22, 6); ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.fill();
      ctx.restore();
      // the rails round the mat
      poly(c.out); ctx.lineJoin = "round"; ctx.strokeStyle = "#b07a46"; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = "#d9a56b"; ctx.lineWidth = 3; ctx.stroke();
      // cutting boards and shelves
      for (const b of c.blocks) {
        ctx.save(); ctx.shadowColor = "rgba(60,40,20,0.25)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4; poly(b.p); ctx.fillStyle = b.k === "board" ? "#ddb07a" : "#c98b52"; ctx.fill(); ctx.restore();
        poly(b.p); ctx.strokeStyle = b.k === "board" ? "#a8733a" : "#94602f"; ctx.lineWidth = 2.5; ctx.stroke();
        const xs = b.p.map(p => p[0]), ys = b.p.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        ctx.save(); poly(b.p); ctx.clip();
        if (b.k === "board") {
          ctx.strokeStyle = "rgba(150,95,45,0.35)"; ctx.lineWidth = 1.5; ctx.beginPath();
          for (let y = y0 + 9; y < y1; y += 11) { ctx.moveTo(x0, y); ctx.bezierCurveTo(x0 + (x1 - x0) * 0.3, y - 3, x0 + (x1 - x0) * 0.6, y + 3, x1, y); }
          ctx.stroke(); ctx.fillStyle = "#efe7dc"; ctx.beginPath(); ctx.arc(x1 - 16, (y0 + y1) / 2, 6, 0, 7); ctx.fill();
        } else {
          const cols = ["#e8505b", "#f2994a", "#2eaa6e", "#8e6bd6", "#e09a00"];
          for (let x = x0 + 16, i = 0; x < x1 - 8; x += 26, i++) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, (y0 + y1) / 2, 9, 0, 7); ctx.fill(); ctx.fillStyle = cols[(i + Math.round(x0)) % 5]; ctx.beginPath(); ctx.arc(x, (y0 + y1) / 2, 6, 0, 7); ctx.fill(); }
        }
        ctx.restore();
      }
      // bowls, jars and egg cups
      for (const u of c.bumps) {
        ctx.fillStyle = "rgba(60,40,20,0.2)"; ctx.beginPath(); ctx.arc(u.x + 2, u.y + 5, u.r, 0, 7); ctx.fill();
        if (u.k === "bowl") {
          ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(u.x, u.y, u.r, 0, 7); ctx.fill(); ctx.strokeStyle = "#9dc0ef"; ctx.lineWidth = 3; ctx.stroke();
          ctx.fillStyle = "#eef4fc"; ctx.beginPath(); ctx.arc(u.x, u.y, u.r * 0.72, 0, 7); ctx.fill();
          if (u.f && imgs[u.f]?.complete) { const s = u.r * 1.15; ctx.drawImage(imgs[u.f], u.x - s / 2, u.y - s / 2, s, s); }
        } else if (u.k === "jar") {
          ctx.fillStyle = "#e8505b"; ctx.beginPath(); ctx.arc(u.x, u.y, u.r, 0, 7); ctx.fill();
          ctx.fillStyle = "#f07a83"; ctx.beginPath(); ctx.arc(u.x, u.y, u.r * 0.78, 0, 7); ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.8)"; for (let i = 0; i < 6; i++) { const [co, si] = TRIG[i * 120]; ctx.beginPath(); ctx.arc(u.x + co * u.r * 0.45, u.y + si * u.r * 0.45, 2, 0, 7); ctx.fill(); }
        } else {
          ctx.fillStyle = "#3f7fd6"; ctx.beginPath(); ctx.arc(u.x, u.y, u.r, 0, 7); ctx.fill();
          ctx.fillStyle = "#fffaf0"; ctx.beginPath(); ctx.ellipse(u.x, u.y, u.r * 0.7, u.r * 0.78, 0, 0, 7); ctx.fill();
        }
      }
      // the cup and its cocktail-stick flag
      const [qx, qy] = c.cup;
      ctx.fillStyle = "#e9f6e6"; ctx.beginPath(); ctx.arc(qx, qy, CUP_R + 3, 0, 7); ctx.fill();
      ctx.fillStyle = "#2b2f38"; ctx.beginPath(); ctx.arc(qx, qy, CUP_R, 0, 7); ctx.fill();
      ctx.fillStyle = "#454b57"; ctx.beginPath(); ctx.arc(qx, qy + 2, CUP_R - 4, 0, 7); ctx.fill();
      // moving parts
      for (const m of c.movers) {
        if (m.k === "mixer") {
          ctx.strokeStyle = "rgba(90,107,133,0.25)"; ctx.setLineDash([5, 6]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(m.x, m.y, m.len + MIXER_W, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = "rgba(90,107,133,0.18)"; ctx.lineWidth = PIN_R * 2 + 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(m.x0 - m.half, m.y0); ctx.lineTo(m.x1 + m.half, m.y1); ctx.stroke();
        }
      }
      for (const p of partsAt(c, clock)) {
        if (p.spin) {
          ctx.lineCap = "round"; ctx.strokeStyle = "#8a96a8"; ctx.lineWidth = MIXER_W * 2 + 2; ctx.beginPath(); ctx.moveTo(p.ax, p.ay); ctx.lineTo(p.bx, p.by); ctx.stroke();
          ctx.strokeStyle = "#d3d9e2"; ctx.lineWidth = MIXER_W; ctx.beginPath(); ctx.moveTo(p.ax, p.ay); ctx.lineTo(p.bx, p.by); ctx.stroke();
          for (const [ex, ey] of [[p.ax, p.ay], [p.bx, p.by]]) { ctx.strokeStyle = "#8a96a8"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(ex, ey, 9, 9, 0, 0, 7); ctx.stroke(); }
          ctx.fillStyle = "#5a6b85"; ctx.beginPath(); ctx.arc(p.px, p.py, 10, 0, 7); ctx.fill(); ctx.fillStyle = "#c7d0db"; ctx.beginPath(); ctx.arc(p.px, p.py, 4, 0, 7); ctx.fill();
        } else {
          ctx.save(); ctx.shadowColor = "rgba(60,40,20,0.3)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 4;
          ctx.lineCap = "round"; ctx.strokeStyle = "#b07a46"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(p.ax, p.ay); ctx.lineTo(p.bx, p.by); ctx.stroke(); ctx.restore();
          const pl = Math.hypot(p.bx - p.ax, p.by - p.ay) || 1, hx = ((p.bx - p.ax) / pl) * 18, hy = ((p.by - p.ay) / pl) * 18;   // handles at both ends
          ctx.strokeStyle = "#e6b980"; ctx.lineWidth = PIN_R * 2; ctx.beginPath(); ctx.moveTo(p.ax + hx, p.ay + hy); ctx.lineTo(p.bx - hx, p.by - hy); ctx.stroke();
          ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.ax + hx, p.ay + hy - 4); ctx.lineTo(p.bx - hx, p.by - hy - 4); ctx.stroke();
        }
      }
    }
    function drawFlag(c: Course, near: boolean) {
      const [qx, qy] = c.cup; ctx.globalAlpha = near ? 0.35 : 1;
      ctx.strokeStyle = "#c9a26b"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(qx + 4, qy - 36); ctx.stroke();
      ctx.fillStyle = "#e8505b"; ctx.beginPath(); ctx.moveTo(qx + 4, qy - 36); ctx.lineTo(qx + 22, qy - 31); ctx.lineTo(qx + 3.5, qy - 25); ctx.fill();
      ctx.globalAlpha = 1;
    }
    function drawBall(x: number, y: number, i: number, alpha: number, spin = 0, scale = 1) {
      ctx.globalAlpha = alpha * 0.35; ctx.fillStyle = "#3a2a1a"; ctx.beginPath(); ctx.ellipse(x + 1.5, y + 3, BALL_R * scale, BALL_R * 0.7 * scale, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colorOf(i); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, (BALL_R + 2) * scale, 0, 7); ctx.stroke();
      const g = ctx.createRadialGradient(x - 2.5 * scale, y - 2.5 * scale, 1, x, y, BALL_R * scale);
      g.addColorStop(0, "#b8673f"); g.addColorStop(1, "#6e3720");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, BALL_R * scale, 0, 7); ctx.fill();
      const a = Math.round((spin / BALL_R) * 115) % 720;   // flecks of herbs turn as it rolls
      for (const [o, col] of [[0, "#4f8a3a"], [240, "#d7a07a"], [480, "#4f8a3a"]] as [number, string][]) {
        const [co, si] = TRIG[(a + o + 720) % 720]; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + co * 3.6 * scale, y + si * 2.6 * scale, 1.3 * scale, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    function drawPutter(x: number, y: number, px: number, py: number, alpha: number) {
      const l = Math.hypot(px, py); if (l < 2) return;
      const dx = -px / l, dy = -py / l, pw = Math.min(1, l / MAX_PULL), back = BALL_R + 5 + 24 * pw, hx = x - dx * back, hy = y - dy * back;
      ctx.globalAlpha = alpha; ctx.lineCap = "round";
      ctx.strokeStyle = "#9aa6b8"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - dx * 26 - dy * 12, hy - dy * 26 + dx * 12); ctx.stroke();
      ctx.strokeStyle = "#5a6b85"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(hx - dy * 9, hy + dx * 9); ctx.lineTo(hx + dy * 9, hy - dx * 9); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    function aimDots(c: Course, x: number, y: number, px: number, py: number) {
      const l = Math.hypot(px, py); if (l < MIN_PULL) return;
      const dx = -px / l, dy = -py / l, len = 26 + 84 * Math.min(1, l / MAX_PULL);
      ctx.fillStyle = "#ffffff";
      for (let s = BALL_R + 7; s < len; s += 8) {
        const qx = x + dx * s, qy = y + dy * s;
        if (c.segs.some(g => segDist2(qx, qy, g) < 9) || c.bumps.some(u => (qx - u.x) * (qx - u.x) + (qy - u.y) * (qy - u.y) < u.r * u.r)) break;   // stops at the first wall
        ctx.globalAlpha = Math.max(0.25, 1 - s / (len * 1.15)); ctx.beginPath(); ctx.arc(qx, qy, 2.8, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(16,27,46,0.35)"; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function draw(t: number) {
      ctx.save(); ctx.clearRect(0, 0, W, H);
      rr(0, 0, W, H, 22); ctx.clip();
      const view = shown ?? { course, balls: st.balls, done: st.done, hole: st.hole + 1, strokes: st.strokes }, c = view.course;
      drawCourse(c, roll ? roll.clock : st.clock);
      for (const r of ripples) { const k = r.age / 700; ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(r.x, r.y, 4 + k * 26, 0, 7); ctx.stroke(); }
      const ballAt = (i: number) => (roll && i === st.shooter && !shown ? [roll.x, roll.y] : view.balls[i]);
      const near = [0, 1].some(i => !view.done[i] && Math.hypot(ballAt(i)[0] - c.cup[0], ballAt(i)[1] - c.cup[1] + 20) < 30);
      drawFlag(c, near);
      if (drop) { const k = drop.age / 400; drawBall(c.cup[0] + (drop.x - c.cup[0]) * (1 - k), c.cup[1] + (drop.y - c.cup[1]) * (1 - k), st.shooter, 1 - k * 0.6, 0, 1 - k * 0.6); }
      // the waiting ball first, faded; the one putting on top
      const active = shown ? -1 : st.shooter, order = active === 0 ? [1, 0] : [0, 1];
      for (const i of order) {
        if (view.done[i] && !(roll && i === active)) continue;
        if (roll && i === active && roll.done === 2) continue;
        const [x, y] = ballAt(i), mine = i === active;
        if (mine && roll) { ctx.fillStyle = "rgba(255,255,255,0.45)"; trail.forEach((q, j) => { ctx.globalAlpha = j / trail.length; ctx.beginPath(); ctx.arc(q.x, q.y, 2, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1; }
        drawBall(x, y, i, mine ? 1 : 0.5, mine && roll ? roll.dist : 0);
      }
      // aiming: yours (dots, putter and power), or theirs (putter only, never the line)
      if (!shown && phase !== "over") {
        const [bx, by] = st.balls[st.shooter];
        if (drag && canAim()) { drawPutter(bx, by, drag.px, drag.py, 1); aimDots(c, bx, by, drag.px, drag.py); }
        else if (!local && seen.on && st.shooter !== me && (phase === "aim" || phase === "think")) drawPutter(bx, by, seen.x, seen.y, 0.85);
      }
      for (const f of floats) {
        const life = f.big ? 2000 : 1300, a = 1 - f.age / life;
        ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.6));
        const fx = Math.max(70, Math.min(W - 70, f.x)), fy = Math.max(TOP + 30, f.y - (f.big ? 0 : f.age * 0.025));
        ctx.font = `800 ${f.big ? 24 : 16}px ${FONT}`; const tw = ctx.measureText(f.text).width;
        ctx.fillStyle = "rgba(255,255,255,0.85)"; rr(fx - tw / 2 - 8, fy - (f.big ? 22 : 16), tw + 16, f.big ? 30 : 22, 11); ctx.fill();
        text(f.text, fx, fy, f.big ? 24 : 16, f.color, 800);
      }
      ctx.globalAlpha = 1;

      // the band at the top: hole and par, each player's strokes, whose turn (or your power while you drag)
      ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(0, 0, W, TOP); ctx.fillStyle = "rgba(16,27,46,0.08)"; ctx.fillRect(0, TOP - 1, W, 1);
      text(`Hole ${view.hole} · Par ${c.par}`, 14, 23, 15, "#101b2e", 800, "left");
      text(c.name, W - 14, 23, 13, "#5a6b85", 600, "right");
      const sides = cpu || live ? [me, other] : [0, 1], vs = view.strokes;
      sides.forEach((i, k) => {
        const x = k === 0 ? 14 : W - 14, nm = label(i).length > 9 ? label(i).slice(0, 8) + "." : label(i);
        const s = view.done[i] ? (vs[i] >= PICKUP ? "Picked Up" : `${vs[i]} ✓`) : String(vs[i]);
        ctx.fillStyle = colorOf(i); ctx.beginPath(); ctx.arc(k === 0 ? x + 4 : x - 4, 41, 4, 0, 7); ctx.fill();
        text(`${nm} ${s}`, k === 0 ? x + 12 : x - 12, 46, 13, "#101b2e", 700, k === 0 ? "left" : "right");
      });
      if (drag && canAim()) {
        const pw = Math.min(1, Math.hypot(drag.px, drag.py) / MAX_PULL), bw = 96, x0 = W / 2 - bw / 2;
        ctx.fillStyle = "rgba(16,27,46,0.1)"; rr(x0, 37, bw, 10, 5); ctx.fill();
        ctx.fillStyle = pw > 0.85 ? "#e8505b" : pw > 0.6 ? "#e09a00" : "#2eaa6e"; rr(x0, 37, Math.max(10, bw * pw), 10, 5); ctx.fill();
        text(`${Math.round(pw * 100)}%`, x0 + bw + 6, 46, 12, "#101b2e", 800, "left");
      } else if (started && !shown && phase !== "over" && phase !== "between") {
        const s = st.shooter, aiming = !local && s !== me && (phase === "think" || (seen.on && Math.hypot(seen.tx, seen.ty) >= MIN_PULL && phase === "aim"));
        const whose = aiming ? `${cpu ? "Computer" : pnames[s].slice(0, 9)} Aiming...` : st.done[me] && !local && s !== me ? `Waiting For ${cpu ? "Computer" : pnames[s].slice(0, 9)}` : human(s) && !local ? "Your Turn" : `${(cpu ? "Computer" : pnames[s]).slice(0, 9)}'s Turn`;
        const left = Math.max(0, Math.ceil(turnLeft / 1000));
        text(live && phase === "aim" ? `${whose} · ${left}s` : whose, W / 2, 46, 13, s === me || local ? "#3f7fd6" : "#5a6b85", 800);
        if (live && phase === "aim") { ctx.fillStyle = left <= 5 ? "#e8505b" : "#3f7fd6"; rr(W / 2 - 50, 51, (100 * Math.max(0, turnLeft)) / TURN_MS, 3, 1.5); ctx.fill(); }
      }
      // the first putt: show where to drag (away from the ball)
      if (myTurn() && started && !drag && firstPutt[local ? st.shooter : me] && st.hole === 0 && (!cpu || round === 1)) {
        const by = st.balls[st.shooter][1], y0 = by > 430 ? by - 170 : Math.min(H - 90, by + 40);
        ctx.globalAlpha = 0.65 + 0.25 * Math.sin(t / 300);
        ctx.strokeStyle = "#fff"; ctx.setLineDash([8, 7]); ctx.lineWidth = 2; rr(W / 2 - 115, y0, 230, 70, 16); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "rgba(16,27,46,0.35)"; rr(W / 2 - 113, y0 + 2, 226, 66, 15); ctx.fill();
        text("Drag Back Anywhere", W / 2, y0 + 30, 16, "#fff", 800);
        text("Then Let Go To Putt", W / 2, y0 + 52, 13, "#fff", 600);
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
  const pn = play.kind === "cpu" ? ["You", "Computer"] : play.names;
  const friend = play.kind === "live" ? (play.names[1 - me] === "Guest" ? "Your Friend" : play.names[1 - me]) : "";
  const headline = !result ? "" : mode === "daily"
    ? (result.kind === "won" ? `You Beat The Computer By ${result.cpu - result.you}! 🎉` : result.kind === "tie" ? "Tied With The Computer" : `The Computer Won By ${result.you - result.cpu}`)
    : `${result.rounds - 1} Round${result.rounds === 2 ? "" : "s"} Won, Lost Round ${result.rounds}`;
  const toPar = (s: number, par: number) => (s === par ? "Even Par" : s < par ? `${par - s} Under Par` : `${s - par} Over Par`);
  const share = () => {
    if (!result) return;
    const label = mode === "daily" ? `Kitchen Golf #${n} (Today's Challenge)` : "Kitchen Golf (Free Play)";
    const p = shell.scores.posted;
    const rank = p?.rank ? `\n🏆 #${p.rank} of ${p.total} ${mode === "daily" ? "today" : "this week"}` : "";
    const how = mode === "daily" ? (result.kind === "won" ? `Beat the computer ${result.you} to ${result.cpu}` : result.kind === "tie" ? `Tied the computer at ${result.you}` : `Lost to the computer ${result.you} to ${result.cpu}`)
      : `${result.rounds - 1} rounds won`;
    const sq = result.card.map((s, i) => versus(s, result.pars[i])).join(""), keys = result.card.map(s => KEYCAP[s]).join("");
    shell.share(`${label}\n${hud.score.toLocaleString()} pts · ${result.you} strokes (par ${result.par})\n${how}${rank}\n${sq}\n${keys}\nCan you beat it? whatyouate.app/games/kitchen-golf`);
  };
  const toCpu = () => { if (isLive || room.ui) room.leave(); forgetLive(); setOffer(null); setMatchEnd(null); setMenu(null); setPlay({ kind: "cpu" }); setRun(r => r + 1); };
  const openRoom = () => { setWins([0, 0]); setMenu(null); room.create(); };
  const joinRoom = () => { if (code.length === 4) { setWins([0, 0]); setMenu(null); room.join(code); } };
  const startLocal = () => {
    const nm = names.map((v, i) => v.trim().slice(0, 12) || `Player ${i + 1}`);
    setWins([0, 0]); setMenu(null); setMatchEnd(null);
    setPlay({ kind: "local", m: 1, seed: Math.floor(Math.random() * 1e9), first: 0, names: nm });
  };
  const localRematch = () => {
    if (play.kind !== "local" || !matchEnd) return;
    const first = (matchEnd.winner < 0 ? 1 - play.first : 1 - matchEnd.winner) as 0 | 1;   // the loser putts first
    setMatchEnd(null); setPlay({ ...play, m: play.m + 1, seed: Math.floor(Math.random() * 1e9), first });
  };
  const shareRoom = (c: string) => shell.share(`Play Kitchen Golf with me! Room ${c}: ${window.location.origin}/games/kitchen-golf?room=${c}`);
  const rui = room.ui;
  const playing = isCpu ? started && !over && !roundCard : isLocal ? !matchEnd : false;
  const awayLeft = room.away ? Math.max(0, Math.ceil((room.away - (now || Date.now())) / 1000)) : 0;
  // whose putt it is right now in a live match, for the Stepped Away card (we can keep putting on our own turn)
  const liveState = () => (engineRef.current?.snap()?.st as St | undefined);
  const theirTurn = isLive && (() => { const s2 = liveState(); return !s2 || s2.shooter !== me || matchEnd !== null; })();

  return (
    <GameScreen>
      <GameHeader title="Kitchen Golf" mode={mode} onMode={m => { toCpu(); setMode(m); }} onBoard={() => shell.setBoardOpen(true)} onHelp={shell.help.show} />

      <div className="mt-2 flex items-center justify-between">
        {isCpu ? (<>
          <div><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Score</div><div className="text-2xl font-bold leading-none tabular-nums">{hud.score.toLocaleString()}</div></div>
          <div className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold text-[#3f7fd6]">
            {mode === "daily" ? `Hole ${hud.hole} of 9` : `Round ${hud.round} · Hole ${hud.hole}`} · {hud.tot[0]}-{hud.tot[1]}
          </div>
        </>) : (<>
          <div className="min-w-0"><div className="truncate text-[10px] uppercase tracking-wide text-[#5a6b85]">{isLive ? "You" : pn[0]}</div><div className="text-2xl font-bold leading-none tabular-nums">{hud.tot[isLive ? me : 0]}</div></div>
          <div className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold text-[#3f7fd6]">{play.kind === "live" ? `Live · Room ${play.code}` : "Same Phone"}</div>
        </>)}
        <div className="flex items-center gap-2">
          {isCpu ? <div className="text-right"><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Best</div><div className="text-lg font-semibold leading-none tabular-nums">{best.toLocaleString()}</div></div>
            : <div className="min-w-0 text-right"><div className="max-w-[110px] truncate text-[10px] uppercase tracking-wide text-[#5a6b85]">{isLive ? friend : pn[1]}</div><div className="text-2xl font-bold leading-none tabular-nums">{hud.tot[isLive ? 1 - me : 1]}</div></div>}
          <PauseButton shell={shell} active={playing} />
        </div>
      </div>

      <BoardArea wrapRef={wrapRef} size={board} reserve={0}>
        <canvas ref={canvasRef} className="block rounded-[22px] shadow-[0_14px_40px_rgba(16,42,86,0.18)]" />
        <PrizeLogo shell={shell} active={isCpu && started && !over && !roundCard && !shell.paused && !menu && !rui} />
        <PausedCard shell={shell} active={playing} />

        {holeCard && !matchEnd && (
          <button onClick={() => skipRef.current()} className="absolute inset-x-0 top-[14%] z-[6] mx-auto flex w-[78%] max-w-[300px] flex-col items-center rounded-3xl bg-white/95 px-4 py-3 text-center shadow-2xl">
            <span className="text-sm font-semibold text-[#5a6b85]">Hole {holeCard.hole} · {holeCard.name} · Par {holeCard.par}</span>
            {holeCard.rows.map((r, i) => (
              <span key={i} className="mt-1 flex w-full items-baseline justify-between text-base">
                <span className="flex items-center gap-1.5 font-bold"><span className={`h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-[#3f7fd6]" : "bg-[#e8505b]"}`} />{r.name}</span>
                <span className="text-sm text-[#5a6b85]">{scoreName(r.strokes, holeCard.par)} · <b className="text-[#101b2e]">{r.strokes >= PICKUP ? 7 : r.strokes}</b></span>
              </span>
            ))}
            {holeCard.pts !== null && <span className="mt-1 text-2xl font-bold tabular-nums text-[#2eaa6e]">+{holeCard.pts.toLocaleString()}</span>}
          </button>
        )}

        {isCpu && !started && !over && !menu && !rui && !offer && (
          <Card>
            <div className="text-lg font-bold">{mode === "daily" ? `Today's Challenge #${n}` : "Free Play"}</div>
            <p className="mt-1 text-sm text-[#5a6b85]">{mode === "daily" ? "9 holes against the computer. Fewest strokes wins." : "Beat the computer round after round."}</p>
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
            <p className="mt-1 text-sm text-[#5a6b85]">Two players, one phone. Pass it over when it&apos;s the other player&apos;s putt.</p>
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
            <button onClick={() => { room.forget(); forgetLive(); setOffer(null); }} className="mt-2 w-full py-2 text-sm font-semibold text-[#5a6b85]">No Thanks</button>
          </Card>
        )}

        {isLive && room.away && !rui && (theirTurn ? (
          <Card>
            <div className="text-xl font-bold">{friend} Stepped Away...</div>
            <div className="mt-2 text-4xl font-bold tabular-nums text-[#3f7fd6]">{awayLeft}s</div>
            <p className="mt-2 text-sm text-[#5a6b85]">It&apos;s their putt, so the game waits. It picks up right where you left off when they&apos;re back.</p>
            <button onClick={toCpu} className="mt-3 w-full py-2 text-sm font-semibold text-[#5a6b85]">Leave</button>
          </Card>
        ) : (
          <div className="pointer-events-none absolute inset-x-0 top-1.5 z-10 flex justify-center px-3">
            <div className="truncate rounded-full bg-[#fff4d6] px-3 py-1 text-xs font-bold text-[#8a5a00] shadow-md">{friend} Stepped Away · {awayLeft}s · Your Putt</div>
          </div>
        ))}
        {isLive && room.reconnecting && !room.away && !rui && (
          <div className="pointer-events-none absolute inset-x-0 top-1.5 z-10 flex justify-center">
            <div className="rounded-full bg-[#e3effe] px-3 py-1 text-xs font-bold text-[#3f7fd6] shadow-md">Reconnecting...</div>
          </div>
        )}

        {rui?.s === "lobby" && (
          <ReadyCard me={nameRef.current === "Guest" ? "You" : nameRef.current} friend={room.friendName === "Guest" ? "Your Friend" : room.friendName}
            ready={[room.ready.me, room.ready.them]} onReady={room.markReady} onLeave={toCpu} steps={[
              "Drag back anywhere on the board and let go to putt. The dots show the way.",
              "Pull further for more power. Walls bounce, syrup slows you down, butter speeds you up.",
              "You take turns. The sink costs a stroke. After 6 strokes you pick up and take a 7.",
              "30 seconds a putt. Fewest strokes over 9 holes wins.",
            ]} />
        )}

        {rui && rui.s !== "lobby" && (
          <Card>
            {rui.s === "waiting" && (<>
              <div className="text-sm font-semibold text-[#5a6b85]">Your Room Code</div>
              <div className="mt-1 font-mono text-4xl font-bold tracking-[0.2em]">{rui.code}</div>
              <p className="mt-2 text-sm text-[#5a6b85]">Send your friend the link. The game starts when you&apos;re both ready.</p>
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
              <span className="mt-0.5 block text-2xl font-bold">{passTo}&apos;s Putt</span>
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
            <ScoreGrid pars={matchEnd.pars} rows={(isLive ? [me, 1 - me] : [0, 1]).map(i => ({ name: isLive ? (i === me ? "You" : friend) : pn[i], card: matchEnd.cards[i], total: matchEnd.tot[i] }))} />
            {(wins[0] + wins[1] > 1) && <div className="mt-1 text-xs text-[#5a6b85]">{isLive ? `Matches: You ${wins[me]} · ${friend} ${wins[1 - me]}` : `Matches: ${pn[0]} ${wins[0]} · ${pn[1]} ${wins[1]}`}</div>}
            {isLive && room.again.them && !room.again.me && <div className="mt-2 text-sm font-semibold text-[#2eaa6e]">{friend} Wants A Rematch!</div>}
            <button onClick={isLive ? room.rematch : localRematch} disabled={isLive && room.again.me} className="mt-3 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white disabled:opacity-70">
              {isLive && room.again.me ? `Waiting For ${friend}...` : "Rematch"}
            </button>
            <button onClick={toCpu} className="mt-2 w-full rounded-full bg-[#e3effe] py-3 font-semibold text-[#3f7fd6]">{isLive ? "Leave" : "Done"}</button>
            <a href={appStoreLink(GAME)} className="mt-3 inline-block text-xs font-semibold text-[#5a6b85] underline">Get WhatYouAte For iPhone</a>
          </Card>
        )}

        {roundCard && !over && (
          <Card>
            <div className="text-sm font-semibold text-[#5a6b85]">Round {roundCard.round} {roundCard.tie ? "Tied" : "Won"} · {roundCard.you} To {roundCard.cpu}</div>
            <div className="mt-0.5 text-3xl font-bold leading-tight tabular-nums">+{roundCard.points.toLocaleString()}</div>
            <div className="text-sm text-[#5a6b85]">{roundCard.tie ? "A tie keeps you going" : "Nice Putting!"}</div>
            <button onClick={() => nextRef.current()} className="mt-3 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Next Round</button>
          </Card>
        )}

        {over && isCpu && !menu && !rui && result && <GameOver label={mode === "daily" ? `Today's Challenge #${n}` : "Free Play"} headline={headline} score={hud.score} best={best} mode={mode}
          posted={shell.scores.posted} joined={!!shell.player} campaign={GAME} copied={shell.copied} fact={toast}
          pitch="Good putting takes practice. So do good habits. WhatYouAte helps with the second one."
          extra={<>
            <div className="mt-2 text-sm font-semibold text-[#5a6b85]">{result.you} Strokes · {toPar(result.you, result.par)}</div>
            <div className="text-sm tracking-tight">{result.card.map((s, i) => versus(s, result.pars[i])).join("")}</div>
            <button onClick={() => setMenu("friend")} className="mt-1 text-sm font-semibold text-[#3f7fd6]">Play A Friend Instead →</button>
          </>}
          onBoard={() => shell.setBoardOpen(true)} onJoin={() => shell.setJoinOpen(true)} onAgain={() => setRun(r => r + 1)} onShare={share} />}
      </BoardArea>

      <ShellPopups shell={shell} game={GAME} todayNote="Today's Challenge: same 9 holes and computer for everyone. Resets at midnight." />

      {shell.help.open && (
        <HelpModal onClose={shell.help.close} steps={[
          "Drag back anywhere on the board and let go to putt. The dots show which way the meatball goes.",
          "Pull further for more power. Walls bounce, syrup slows you, butter is slippery, ramps roll you back.",
          "The sink sends you back with a stroke added. Time your putt past the mixer and the rolling pin.",
          "Fewest strokes over 9 holes wins. After 6 strokes you pick up and take a 7.",
        ]}>
          <ModesHelp today="the same 9 holes and computer for everyone. Fewer strokes, holes in one and beating the computer score more." free="new holes every round against a computer that gets a little sharper. Win or tie to keep going." />
          <p className="mt-1.5 text-sm"><b>With a friend:</b> live on two phones, or pass one phone.</p>
        </HelpModal>
      )}
    </GameScreen>
  );
}

function ScoreGrid({ pars, rows }: { pars: number[]; rows: { name: string; card: number[]; total: number }[] }) {
  return (
    <div className="mt-3 w-full overflow-hidden rounded-xl bg-[#f0f6fe] px-2 py-1.5 text-[11px] tabular-nums">
      {[{ name: "Par", card: pars, total: sum(pars) }, ...rows].map((r, k) => (
        <div key={k} className={`flex items-center ${k === 0 ? "text-[#5a6b85]" : "font-semibold"}`}>
          <span className="w-12 shrink-0 truncate text-left">{r.name}</span>
          {r.card.map((s, i) => <span key={i} className="flex-1 text-center">{s >= PICKUP ? 7 : s}</span>)}
          <span className="w-7 shrink-0 text-right font-bold">{r.total}</span>
        </div>
      ))}
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[22px] bg-[#101b2e]/35 p-5">
      <div className="w-full max-w-[300px] rounded-3xl bg-white p-5 text-center shadow-2xl">{children}</div>
    </div>
  );
}
