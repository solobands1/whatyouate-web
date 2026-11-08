"use client";

// Pat's Lawnmower: a private little game (not in the games list, the sitemap or search). Drive Pat's orange lawn
// tractor around the yard and mow every bit of lawn; the faster you finish, the more points, with a small bonus for neat
// mowing (less driving over grass that's already cut). Every 30 to 60 seconds the grey cat comes out of the house
// door, wanders the lawn for a while and goes back in. If the mower gets close, Pat stops for 2 seconds (a little
// time added to the clock) and the cat scampers off. The mower can never touch the cat.
// The yard is plain data in ./lawnMap (metres); the lawn is a 0.5 m grid. Cells too tight to reach with the mower are
// left out of the count when the yard loads, so 100% is always possible.
// The mower is a classic lawn tractor: front wheels steer, it only turns while it rolls (a real turning circle), and
// it backs up. Controls: a joystick in the strip under the map (it steers toward where you push and drives; push
// behind it to reverse), or the keys like a car (W/up and S/down drive, A/D or left/right steer).
// Best score and time are kept in this browser only.
/* eslint-disable react-hooks/set-state-in-effect --
   A real-time canvas game: the run lives in the effect's closure, and React state only mirrors it for the HUD and cards. */
import { useEffect, useRef, useState } from "react";
import { HelpModal, Modal, useHelp, useNoScroll, mulberry32 } from "./kit";
import { LAWN_MAP, toMetres, vehiclePoly, propPoly, type LawnMap, type Pt, type Building, type Tree, type Line, type Vehicle, type Prop } from "./lawnMap";

const GAME = "pats-lawnmower";
const BEST_KEY = "pats-lawnmower-best";
const FONT = "system-ui, -apple-system, sans-serif";
const STEP = 1 / 60;
// grid and mower (metres, seconds)
const CELL = 0.5;
const K = 1.4;                           // the mower is drawn and simulated this much bigger than life (see lawnMap.ts)
const R = 0.82 * K;                      // the mower's bump circle (a little inside the hood's tip, so gaps a tractor fits through stay open)
const DECK_LAT = 0.9 * K, DECK_LON = 0.75 * K;   // half-size of the strip the deck cuts (grid)
const VIS_LAT = 0.84 * K, VIS_LON = 0.62 * K;    // half-size of the stripe painted (a hair smaller, so "looks mowed" means mowed)
const NEED_R = 0.78 * K;                 // a lawn cell counts if a reachable mower spot is this close
const VMAX = 8, VREV = 3, ACC = 7, DEC = 12;
const TURN_R = 1.9;                      // tightest turning circle (radius, metres): a lawn tractor, not a zero-turn
const MAX_STEER = 0.6;                   // front wheel angle at full lock (only for the look)
// the cat
const CAT_R = 0.55, CAT_CLEAR = 0.35, MEOW_D = 3.6, STOP_T = 2, PENALTY = 3;
const CAT_WALK = 0.9, CAT_RUN = 3.6;
// screen
const VIEW_M = 22;                       // metres across the map's short side when following the mower
const STRIP = 124;                       // the joystick strip under the map
const STICK_R = 40;
const OBL = 0.2;                         // how much wall shows under each roof (a slight 3/4 view)

type Shape = { k: 0; pts: Pt[]; x0: number; y0: number; x1: number; y1: number } | { k: 1; x: number; y: number; r: number } | { k: 2; ax: number; ay: number; bx: number; by: number; r: number };
type Result = { secs: number; penalty: number; meows: number; neat: number; score: number };
type Best = { score: number; secs: number };
type Hooks = {
  paused: () => boolean;
  onStart: () => void;
  onHud: (pct: number, secs: number, canFinish: boolean) => void;
  onFinish: (r: Result) => void;
  finishRef: { current: (() => void) | null };
};

const isDebug = () => { try { return new URLSearchParams(window.location.search).get("debug") === "1"; } catch { return false; } };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrapA = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const fmt = (s: number) => { const t = Math.max(0, Math.floor(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
function readBestRec(): Best | null { try { const v = JSON.parse(localStorage.getItem(BEST_KEY) || "null"); return v && typeof v.score === "number" ? v : null; } catch { return null; } }

// ── geometry ────────────────────────────────────────────────────────────────
function pip(pts: Pt[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segClosest(ax: number, ay: number, bx: number, by: number, px: number, py: number): Pt {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
  return [ax + dx * t, ay + dy * t];
}
function polyClosest(pts: Pt[], x: number, y: number): { c: Pt; d: number } {
  let best: Pt = pts[0], bd = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const c = segClosest(pts[j][0], pts[j][1], pts[i][0], pts[i][1], x, y), d = Math.hypot(x - c[0], y - c[1]);
    if (d < bd) { bd = d; best = c; }
  }
  return { c: best, d: bd };
}
function polyShape(pts: Pt[]): Shape {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { k: 0, pts, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
function sd(s: Shape, x: number, y: number) {
  if (s.k === 0) { const { d } = polyClosest(s.pts, x, y); return pip(s.pts, x, y) ? -d : d; }
  if (s.k === 1) return Math.hypot(x - s.x, y - s.y) - s.r;
  const c = segClosest(s.ax, s.ay, s.bx, s.by, x, y); return Math.hypot(x - c[0], y - c[1]) - s.r;
}
const trunkR = (t: Tree) => (t.kind === "well" ? t.r : t.kind === "spruce" ? t.r * 0.75 : Math.max(0.3, t.r * (t.kind === "fruit" ? 0.2 : 0.16)));
function lineDist(l: Line, x: number, y: number) { let d = Infinity; for (let i = 1; i < l.pts.length; i++) { const c = segClosest(l.pts[i - 1][0], l.pts[i - 1][1], l.pts[i][0], l.pts[i][1], x, y); d = Math.min(d, Math.hypot(x - c[0], y - c[1])); } return d; }
function centroid(pts: Pt[]): Pt { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; }
function area(pts: Pt[]) { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; return a / 2; }

// ── the yard, prepared: shapes, the grid, what needs mowing, where the cat can walk ──
function buildWorld(map: LawnMap) {
  const W = map.size[0], H = map.size[1];
  const shapes: Shape[] = [];
  for (const b of map.buildings) shapes.push(polyShape(b.poly));
  for (const b of map.beds) shapes.push(polyShape(b.poly));
  for (const n of map.noGo) shapes.push(polyShape(n.poly));
  for (const v of map.vehicles) shapes.push(polyShape(vehiclePoly(v)));
  for (const pr of map.props) shapes.push(pr.kind === "firepit" ? { k: 1, x: pr.x, y: pr.y, r: pr.r ?? 0.6 } : polyShape(propPoly(pr)));
  for (const t of map.trees) shapes.push({ k: 1, x: t.x, y: t.y, r: trunkR(t) });
  for (const f of map.fences) for (let i = 1; i < f.length; i++) shapes.push({ k: 2, ax: f[i - 1][0], ay: f[i - 1][1], bx: f[i][0], by: f[i][1], r: 0.12 });
  const NX = Math.ceil(W / CELL), NY = Math.ceil(H / CELL), N = NX * NY;
  const lawn = new Uint8Array(N), free = new Uint8Array(N), catFree = new Uint8Array(N), need = new Uint8Array(N);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const x = (i + 0.5) * CELL, y = (j + 0.5) * CELL, k = j * NX + i;
    let clear = Math.min(x, y, W - x, H - y);
    for (const s of shapes) { if (s.k === 0 && (x < s.x0 - 2 || x > s.x1 + 2 || y < s.y0 - 2 || y > s.y1 + 2)) { clear = Math.min(clear, 2); continue; } clear = Math.min(clear, sd(s, x, y)); }
    if (clear >= R) free[k] = 1;
    if (clear >= CAT_CLEAR) catFree[k] = 1;
    if (clear > 0 && map.lawn.some(p => pip(p, x, y)) && !map.driveway.some(p => pip(p, x, y)) && !map.pads.some(p => pip(p.poly, x, y))
      && !map.lanes.some(l => lineDist(l, x, y) < l.width / 2) && !map.roads.some(l => lineDist(l, x, y) < l.width / 2)) lawn[k] = 1;
  }
  const cellOf = (x: number, y: number) => clamp(Math.floor(y / CELL), 0, NY - 1) * NX + clamp(Math.floor(x / CELL), 0, NX - 1);
  const nearest = (mask: Uint8Array, x: number, y: number) => {
    let best = cellOf(x, y), bd = Infinity;
    for (let k = 0; k < N; k++) if (mask[k]) { const d = Math.hypot(((k % NX) + 0.5) * CELL - x, (Math.floor(k / NX) + 0.5) * CELL - y); if (d < bd) { bd = d; best = k; } }
    return best;
  };
  const bfs = (mask: Uint8Array, from: number) => {
    const dist = new Int32Array(N).fill(-1), q = new Int32Array(N); let h = 0, t = 0;
    dist[from] = 0; q[t++] = from;
    while (h < t) {
      const k = q[h++], i = k % NX, j = (k - i) / NX;
      const nb = [i > 0 ? k - 1 : -1, i < NX - 1 ? k + 1 : -1, j > 0 ? k - NX : -1, j < NY - 1 ? k + NX : -1];
      for (const n of nb) if (n >= 0 && mask[n] && dist[n] < 0) { dist[n] = dist[k] + 1; q[t++] = n; }
    }
    return dist;
  };
  // reachable mower spots, and the lawn cells the deck can get to from them
  const startCell = free[cellOf(map.start.x, map.start.y)] ? cellOf(map.start.x, map.start.y) : nearest(free, map.start.x, map.start.y);
  const reachD = bfs(free, startCell);
  const rc = Math.ceil(NEED_R / CELL), offs: number[][] = [];
  for (let dj = -rc; dj <= rc; dj++) for (let di = -rc; di <= rc; di++) if (Math.hypot(di, dj) * CELL <= NEED_R) offs.push([di, dj]);
  let needCount = 0;
  for (let k = 0; k < N; k++) if (reachD[k] >= 0) {
    const i = k % NX, j = (k - i) / NX;
    for (const [di, dj] of offs) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= NX || b >= NY) continue; const n = b * NX + a; if (lawn[n] && !need[n]) { need[n] = 1; needCount++; } }
  }
  // the cat's walking map: a distance field back to the door (she always finds her way home)
  const doorCell = catFree[cellOf(map.door.x, map.door.y)] ? cellOf(map.door.x, map.door.y) : nearest(catFree, map.door.x, map.door.y);
  const catD = bfs(catFree, doorCell);
  const reach = new Uint8Array(N); for (let k = 0; k < N; k++) if (reachD[k] >= 0) reach[k] = 1;
  return { W, H, shapes, NX, NY, N, lawn, need, needCount, reach, catFree, catD, doorCell, cellOf, startCell };
}
type World = ReturnType<typeof buildWorld>;

/** Moves a circle out of every wall it overlaps. Returns the new spot and the push direction (for bumps). */
function pushOut(w: World, x: number, y: number, r: number, extra: { x: number; y: number; r: number } | null) {
  let nx = 0, ny = 0;
  for (let it = 0; it < 3; it++) {
    let moved = false;
    for (const s of w.shapes) {
      if (s.k === 0) {
        if (x < s.x0 - r || x > s.x1 + r || y < s.y0 - r || y > s.y1 + r) continue;
        const { c, d } = polyClosest(s.pts, x, y), inside = pip(s.pts, x, y);
        if (inside) { const ux = (c[0] - x) / (d || 1), uy = (c[1] - y) / (d || 1); x = c[0] + ux * r; y = c[1] + uy * r; nx += ux; ny += uy; moved = true; }
        else if (d < r) { const ux = (x - c[0]) / (d || 1), uy = (y - c[1]) / (d || 1); x = c[0] + ux * r; y = c[1] + uy * r; nx += ux; ny += uy; moved = true; }
      } else {
        const c: Pt = s.k === 1 ? [s.x, s.y] : segClosest(s.ax, s.ay, s.bx, s.by, x, y), d = Math.hypot(x - c[0], y - c[1]), rr = r + s.r;
        if (d < rr) { const ux = (x - c[0]) / (d || 1), uy = (y - c[1]) / (d || 1); x = c[0] + ux * rr; y = c[1] + uy * rr; nx += ux; ny += uy; moved = true; }
      }
    }
    if (extra) { const d = Math.hypot(x - extra.x, y - extra.y), rr = r + extra.r; if (d < rr) { const ux = (x - extra.x) / (d || 1), uy = (y - extra.y) / (d || 1); x = extra.x + ux * rr; y = extra.y + uy * rr; nx += ux; ny += uy; moved = true; } }
    const cx = clamp(x, r, w.W - r), cy = clamp(y, r, w.H - r);
    if (cx !== x || cy !== y) { nx += Math.sign(cx - x); ny += Math.sign(cy - y); x = cx; y = cy; moved = true; }
    if (!moved) break;
  }
  const l = Math.hypot(nx, ny);
  return { x, y, nx: l ? nx / l : 0, ny: l ? ny / l : 0, hit: l > 0 };
}

// ── drawing helpers (world units are metres) ───────────────────────────────
function pathPoly(c: CanvasRenderingContext2D, pts: Pt[]) { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); }
function lerpCol(a: number[], b: number[], t: number) { return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`; }
const STRIPE_DARK = [112, 172, 68], STRIPE_LIGHT = [178, 218, 116];
/** Cut grass colour by mowing direction: mowed upward reads light, downward dark, like real stripes. */
function stripeCol(h: number) { const b = -Math.sin(h), t = 0.5 + 0.5 * Math.sign(b) * Math.pow(Math.abs(b), 0.55); return lerpCol(STRIPE_DARK, STRIPE_LIGHT, t); }

/** Lots of little grass blades, batched into one path per colour. */
function blades(c: CanvasRenderingContext2D, rnd: () => number, W: number, H: number, n: number, cols: string[], lw: number, len: number, jit: number) {
  const paths = cols.map(() => new Path2D());
  for (let k = 0; k < n; k++) { const x = rnd() * W, y = rnd() * H, p = paths[Math.floor(rnd() * cols.length)]; p.moveTo(x, y); p.lineTo(x + (rnd() - 0.5) * len, y - len - rnd() * jit); }
  c.lineWidth = lw; c.lineCap = "round"; paths.forEach((p, i) => { c.strokeStyle = cols[i]; c.stroke(p); });
}

/** The grass layer: rough meadow everywhere, the lawn on top as tall uncut grass. Mowing paints onto it. */
function makeGrass(map: LawnMap, PX: number) {
  const W = map.size[0], H = map.size[1], cv = document.createElement("canvas");
  cv.width = Math.ceil(W * PX); cv.height = Math.ceil(H * PX);
  const c = cv.getContext("2d")!, rnd = mulberry32(7);
  c.scale(PX, PX);
  c.fillStyle = "#8fa557"; c.fillRect(0, 0, W, H);
  blades(c, rnd, W, H, W * H * 3, ["rgba(70,95,35,0.35)", "rgba(200,205,120,0.35)"], 0.06, 0.35, 0.25);
  c.save();
  map.lawn.forEach(p => pathPoly(c, p)); c.beginPath(); for (const p of map.lawn) { p.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); }
  c.clip();
  c.fillStyle = "#3f7428"; c.fillRect(0, 0, W, H);
  blades(c, rnd, W, H, W * H * 12, ["rgba(26,66,20,0.6)", "rgba(78,130,46,0.55)", "rgba(118,165,70,0.5)"], 0.05, 0.16, 0.14);
  c.restore();
  // keep the lawn clip on for mowing strokes
  c.beginPath(); for (const p of map.lawn) { p.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); }
  c.clip();
  return { cv, c };
}

/** Everything flat on the ground, drawn once: road, driveway, beds, fences, shadows, the door step. */
function makeGround(map: LawnMap, PX: number) {
  const W = map.size[0], H = map.size[1], cv = document.createElement("canvas");
  cv.width = Math.ceil(W * PX); cv.height = Math.ceil(H * PX);
  const c = cv.getContext("2d")!, rnd = mulberry32(11);
  c.scale(PX, PX);
  // shadows first (soft: a wide faint one under a tighter one)
  c.fillStyle = "rgba(20,40,10,0.12)";
  for (const t of map.trees) if (t.kind !== "well") { c.beginPath(); c.ellipse(t.x + t.r * 0.28, t.y + t.r * 0.32, t.r * 1.06, t.r * 0.98, 0, 0, 7); c.fill(); }
  for (const b of map.buildings) for (let s = 0; s <= 1.001; s += 0.125) { const ox = b.height * 0.2 * s, oy = b.height * 0.24 * s; pathPoly(c, b.poly.map(p => [p[0] + ox + 0.25, p[1] + oy + 0.25] as Pt)); c.fill(); }
  c.fillStyle = "rgba(20,40,10,0.1)";
  for (const t of map.trees) if (t.kind !== "well") { c.beginPath(); c.ellipse(t.x + t.r * 0.22, t.y + t.r * 0.26, t.r * 0.9, t.r * 0.84, 0, 0, 7); c.fill(); }
  // no-go areas
  for (const n of map.noGo) {
    const xs = n.poly.map(p => p[0]), ys = n.poly.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    c.save(); pathPoly(c, n.poly); c.clip();
    if (n.kind === "road") {
      c.fillStyle = "#c2b79e"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
      const horiz = x1 - x0 >= y1 - y0, inset = 0.7;
      c.fillStyle = "#5c5f63"; if (horiz) c.fillRect(x0, y0 + inset, x1 - x0, y1 - y0 - inset); else c.fillRect(x0 + inset, y0, x1 - x0 - 2 * inset, y1 - y0);
      for (let k = 0; k < (x1 - x0) * (y1 - y0) * 6; k++) { c.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"; c.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 0.08, 0.08); }
      c.strokeStyle = "#e5c24c"; c.lineWidth = 0.15; c.setLineDash([2, 2.4]); c.beginPath();
      if (horiz) { const m = (y0 + inset + y1) / 2; c.moveTo(x0, m); c.lineTo(x1, m); } else { const m = (x0 + x1) / 2; c.moveTo(m, y0); c.lineTo(m, y1); }
      c.stroke(); c.setLineDash([]);
    } else if (n.kind === "water") { c.fillStyle = "#6fa7c9"; c.fillRect(x0, y0, x1 - x0, y1 - y0); c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 0.08; for (let k = 0; k < 20; k++) { const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0); c.beginPath(); c.moveTo(x, y); c.lineTo(x + 0.8, y); c.stroke(); } }
    else if (n.kind === "field") {   // a tilled field: soil with crop-stubble rows
      c.fillStyle = "#a88e66"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
      for (let k = 0; k < (x1 - x0) * (y1 - y0) * 3; k++) { c.fillStyle = rnd() < 0.5 ? "rgba(90,70,45,0.25)" : "rgba(200,180,140,0.25)"; c.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 0.12, 0.12); }
      const ang = -1.35, ux = Math.cos(ang), uy = Math.sin(ang), L = Math.hypot(x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      c.lineWidth = 0.22;
      for (let o = -L; o < L; o += 0.75) { c.strokeStyle = (Math.round(o / 0.75) & 1) ? "rgba(110,88,58,0.45)" : "rgba(196,176,132,0.35)"; c.beginPath(); c.moveTo(mx - uy * o - ux * L, my + ux * o - uy * L); c.lineTo(mx - uy * o + ux * L, my + ux * o + uy * L); c.stroke(); }
    }
    c.restore();
    if (n.kind === "woods") {   // a dense row of trees: overlapping round canopies, drawn past the edge a little so it looks soft
      const pts: Pt[] = []; for (let k = 0; k < (x1 - x0) * (y1 - y0) * 0.5; k++) { const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0); if (pip(n.poly, x, y)) pts.push([x, y]); }
      c.fillStyle = "rgba(20,40,10,0.2)"; for (const [x, y] of pts) { c.beginPath(); c.arc(x + 0.5, y + 0.6, 1.3, 0, 7); c.fill(); }
      const cols = ["#2d5a2a", "#356a2f", "#3f7a35", "#2a5226"];
      for (const [x, y] of pts) { const r = 0.9 + rnd() * 0.8; c.fillStyle = cols[Math.floor(rnd() * cols.length)]; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.fillStyle = "rgba(140,200,100,0.18)"; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.5, 0, 7); c.fill(); }
    }
  }
  // roads: gravel shoulders, asphalt, a dashed centre line
  const stroke = (l: Line, wd: number, col: string, dash: number[] = []) => { c.strokeStyle = col; c.lineWidth = wd; c.lineCap = dash.length ? "butt" : "round"; c.lineJoin = "round"; c.setLineDash(dash); c.beginPath(); l.pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); c.setLineDash([]); };
  // lanes: gravel (light, speckled, two darker tire tracks) or dirt (a two-track with grass down the middle)
  for (const l of map.lanes) {
    if (l.kind === "dirt") { stroke(l, l.width, "#b39f7c"); stroke(l, l.width * 0.22, "rgba(120,140,70,0.55)"); continue; }
    stroke(l, l.width + 0.3, "rgba(90,110,50,0.35)"); stroke(l, l.width, "#cdc3ae");
    for (let i = 1; i < l.pts.length; i++) {
      const [ax, ay] = l.pts[i - 1], [bx, by] = l.pts[i], L = Math.hypot(bx - ax, by - ay);
      for (let k = 0; k < L * l.width * 14; k++) { const t = rnd(), o = (rnd() - 0.5) * l.width * 0.95, nx = -(by - ay) / L, ny = (bx - ax) / L, v = rnd(); c.fillStyle = v < 0.35 ? "rgba(120,105,85,0.45)" : v < 0.7 ? "rgba(245,238,222,0.6)" : "rgba(160,150,135,0.5)"; c.beginPath(); c.arc(ax + (bx - ax) * t + nx * o, ay + (by - ay) * t + ny * o, 0.035 + rnd() * 0.04, 0, 7); c.fill(); }
    }
    for (const side of [-1, 1]) {
      c.strokeStyle = "rgba(125,110,88,0.35)"; c.lineWidth = Math.max(0.22, l.width * 0.1); c.lineCap = "round"; c.lineJoin = "round"; c.beginPath();
      l.pts.forEach((p, i) => { const q = l.pts[Math.min(l.pts.length - 1, i + 1)], o = l.pts[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], d = Math.hypot(dx, dy) || 1, off = side * l.width * 0.24; const x = p[0] - (dy / d) * off, y = p[1] + (dx / d) * off; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
      c.stroke();
    }
  }
  for (const r of map.roads) {
    stroke(r, r.width, "#c4b89f"); stroke(r, r.width * 0.72, "#5f6266");
    for (let k = 0; k < 2; k++) stroke(r, r.width * (0.7 - k * 0.02), k ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)");
    stroke(r, Math.max(0.12, r.width * 0.025), "#e5c24c", [2.2, 2.6]);
  }
  // concrete pads
  for (const d of map.pads) {
    if (d.kind === "dirt") {
      c.save(); pathPoly(c, d.poly); c.clip(); const xs = d.poly.map(p => p[0]), ys = d.poly.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      c.fillStyle = "#a88d68"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
      for (let k = 0; k < (x1 - x0) * (y1 - y0) * 12; k++) { c.fillStyle = rnd() < 0.5 ? "rgba(90,70,45,0.3)" : rnd() < 0.5 ? "rgba(200,182,145,0.35)" : "rgba(110,140,70,0.35)"; c.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 0.08, 0.08); }
      c.restore(); c.strokeStyle = "rgba(90,120,50,0.5)"; c.lineWidth = 0.3; pathPoly(c, d.poly); c.stroke();
    } else { c.fillStyle = "#d3cfc6"; pathPoly(c, d.poly); c.fill(); c.strokeStyle = "rgba(0,0,0,0.12)"; c.lineWidth = 0.08; c.stroke(); }
  }
  // gravel driveway
  for (const d of map.driveway) {
    const xs = d.map(p => p[0]), ys = d.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    c.save(); pathPoly(c, d); c.fillStyle = "#cdbfa5"; c.fill(); c.clip();
    for (let k = 0; k < (x1 - x0) * (y1 - y0) * 14; k++) { const v = rnd(); c.fillStyle = v < 0.35 ? "rgba(120,105,85,0.45)" : v < 0.7 ? "rgba(240,232,215,0.6)" : "rgba(160,150,135,0.5)"; c.beginPath(); c.arc(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 0.04 + rnd() * 0.05, 0, 7); c.fill(); }
    c.strokeStyle = "rgba(90,110,50,0.45)"; c.lineWidth = 0.35; pathPoly(c, d); c.stroke();
    c.restore();
  }
  // the door step
  const house = map.buildings.find(b => b.kind === "house");
  if (house) {
    const { c: near } = polyClosest(house.poly, map.door.x, map.door.y), a = Math.atan2(map.door.y - near[1], map.door.x - near[0]);
    c.save(); c.translate((map.door.x + near[0]) / 2, (map.door.y + near[1]) / 2); c.rotate(a);
    c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(-0.45, -0.7, 1.05, 1.5); c.fillStyle = "#d8cfbd"; c.fillRect(-0.55, -0.75, 1.0, 1.5); c.restore();
  }
  // garden beds
  for (const b of map.beds) {
    const xs = b.poly.map(p => p[0]), ys = b.poly.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    c.save(); pathPoly(c, b.poly); c.fillStyle = "#6b4a31"; c.fill(); c.clip();
    for (let k = 0; k < (x1 - x0) * (y1 - y0) * 10; k++) { c.fillStyle = rnd() < 0.5 ? "rgba(40,25,15,0.35)" : "rgba(140,105,75,0.35)"; c.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 0.07, 0.07); }
    if (b.veg) {
      const horiz = x1 - x0 >= y1 - y0;
      for (let r = (horiz ? y0 : x0) + 0.6; r < (horiz ? y1 : x1) - 0.3; r += 0.9) for (let s = (horiz ? x0 : y0) + 0.5; s < (horiz ? x1 : y1) - 0.3; s += 0.55) {
        const x = horiz ? s : r, y = horiz ? r : s; c.fillStyle = "#4f8f35"; c.beginPath(); c.arc(x, y, 0.2 + rnd() * 0.06, 0, 7); c.fill(); c.fillStyle = "#73b04c"; c.beginPath(); c.arc(x - 0.05, y - 0.05, 0.1, 0, 7); c.fill();
      }
    } else {
      const flowers = ["#e8758a", "#f2c84b", "#a77fd6", "#ffffff", "#f08a4b"];
      for (let k = 0; k < (x1 - x0) * (y1 - y0) * 2.2; k++) { const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0); c.fillStyle = rnd() < 0.5 ? "#4a8a33" : "#3a7329"; c.beginPath(); c.arc(x, y, 0.18 + rnd() * 0.14, 0, 7); c.fill(); if (rnd() < 0.55) { c.fillStyle = flowers[Math.floor(rnd() * flowers.length)]; c.beginPath(); c.arc(x + (rnd() - 0.5) * 0.15, y + (rnd() - 0.5) * 0.15, 0.08, 0, 7); c.fill(); } }
    }
    c.restore();
    c.strokeStyle = "#9b7b58"; c.lineWidth = 0.16; pathPoly(c, b.poly); c.stroke();
  }
  // parked vehicles, with a shadow
  for (const v of map.vehicles) drawVehicle(c, v);
  for (const pr of map.props) drawProp(c, pr, rnd);
  // a few fallen apples under the apple trees
  for (const t of map.trees) if (t.kind === "fruit") for (let k = 0; k < 7; k++) { const a = rnd() * 7, d = t.r * (0.5 + rnd() * 0.65); c.fillStyle = rnd() < 0.7 ? "#c9362c" : "#8f2a22"; c.beginPath(); c.arc(t.x + Math.cos(a) * d, t.y + Math.sin(a) * d, 0.09, 0, 7); c.fill(); }
  // the cistern cap / rocks
  for (const t of map.trees) if (t.kind === "well") {
    c.fillStyle = "rgba(20,40,10,0.18)"; c.beginPath(); c.arc(t.x + 0.25, t.y + 0.3, t.r, 0, 7); c.fill();
    c.fillStyle = "#cfc8b6"; c.beginPath(); c.arc(t.x, t.y, t.r, 0, 7); c.fill();
    c.strokeStyle = "#a9a291"; c.lineWidth = 0.12; c.stroke(); c.beginPath(); c.arc(t.x, t.y, t.r * 0.55, 0, 7); c.stroke();
  }
  // fences: post and rail
  for (const f of map.fences) {
    c.lineCap = "round";
    c.strokeStyle = "rgba(20,40,10,0.18)"; c.lineWidth = 0.14; c.beginPath(); f.forEach((p, i) => (i ? c.lineTo(p[0] + 0.18, p[1] + 0.22) : c.moveTo(p[0] + 0.18, p[1] + 0.22))); c.stroke();
    c.strokeStyle = "#b39a76"; c.lineWidth = 0.09; c.beginPath(); f.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke();
    c.fillStyle = "#7c6144";
    for (let i = 1; i < f.length; i++) {
      const [ax, ay] = f[i - 1], [bx, by] = f[i], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L / 2.4));
      for (let k = 0; k <= n; k++) { const x = ax + ((bx - ax) * k) / n, y = ay + ((by - ay) * k) / n; c.fillRect(x - 0.12, y - 0.12, 0.24, 0.24); }
    }
  }
  return cv;
}

function drawProp(c: CanvasRenderingContext2D, p: Prop, rnd: () => number) {
  c.save(); c.translate(p.x, p.y);
  if (p.kind === "firepit") {   // a ring of stones, ash and a few embers in the middle
    const r = p.r ?? 0.6;
    c.fillStyle = "rgba(20,20,10,0.25)"; c.beginPath(); c.arc(0.08, 0.1, r * 1.05, 0, 7); c.fill();
    c.fillStyle = "#4a4440"; c.beginPath(); c.arc(0, 0, r * 0.82, 0, 7); c.fill();
    c.fillStyle = "#7d756c"; c.beginPath(); c.arc(0, 0, r * 0.6, 0, 7); c.fill();
    for (let k = 0; k < 9; k++) { c.fillStyle = rnd() < 0.5 ? "#e0702a" : "#f2a33a"; c.beginPath(); c.arc((rnd() - 0.5) * r * 0.8, (rnd() - 0.5) * r * 0.8, 0.04 + rnd() * 0.04, 0, 7); c.fill(); }
    c.strokeStyle = "#3a2a1e"; c.lineWidth = 0.06; c.beginPath(); c.moveTo(-r * 0.35, -r * 0.1); c.lineTo(r * 0.3, r * 0.15); c.moveTo(-r * 0.2, r * 0.3); c.lineTo(r * 0.15, -r * 0.3); c.stroke();
    const n = 13; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; c.fillStyle = k % 3 ? "#9c958c" : "#b4ada3"; c.beginPath(); c.ellipse(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, r * 0.2, r * 0.15, a, 0, 7); c.fill(); }
  } else {
    const w = p.w ?? 1, h = p.h ?? 1;
    c.rotate(((p.heading ?? 0) * Math.PI) / 180);
    c.fillStyle = "rgba(20,40,10,0.2)"; c.fillRect(-w / 2 + 0.1, -h / 2 + 0.12, w, h);
    if (p.kind === "horseshoe") {   // a sand pit with a stake and a couple of horseshoes
      c.fillStyle = "#8a6a46"; c.fillRect(-w / 2, -h / 2, w, h); c.fillStyle = "#e3cf9a"; c.fillRect(-w / 2 + 0.06, -h / 2 + 0.06, w - 0.12, h - 0.12);
      c.fillStyle = "rgba(0,0,0,0.25)"; c.beginPath(); c.arc(w * 0.03, w * 0.04, w * 0.09, 0, 7); c.fill();
      c.fillStyle = "#2f3237"; c.beginPath(); c.arc(0, 0, w * 0.08, 0, 7); c.fill();
      c.strokeStyle = "#5d6166"; c.lineWidth = w * 0.06; c.lineCap = "round";
      for (const [hx, hy, ha] of [[-w * 0.14, h * 0.24, 0.5], [w * 0.16, -h * 0.26, 2.4]]) { c.beginPath(); c.arc(hx, hy, w * 0.16, ha, ha + Math.PI * 1.4); c.stroke(); }
    } else if (p.kind === "chair") {   // a wooden lawn chair seen from above
      c.fillStyle = "#c79a5e"; c.fillRect(-w / 2, -h / 2, w, h * 0.35);
      c.fillStyle = "#d9ae72"; c.fillRect(-w / 2 + 0.05, -h / 2 + h * 0.35, w - 0.1, h * 0.65);
      c.strokeStyle = "rgba(90,60,30,0.45)"; c.lineWidth = 0.03; for (let k = 1; k < 4; k++) { const x = -w / 2 + (w * k) / 4; c.beginPath(); c.moveTo(x, -h / 2); c.lineTo(x, h / 2); c.stroke(); }
      c.fillStyle = "#b8894f"; c.fillRect(-w / 2 - 0.06, -h * 0.1, 0.12, h * 0.6); c.fillRect(w / 2 - 0.06, -h * 0.1, 0.12, h * 0.6);
    } else {   // a small white box (a cover or little shed)
      c.fillStyle = "#f4f2ec"; c.fillRect(-w / 2, -h / 2, w, h); c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 0.06; c.strokeRect(-w / 2, -h / 2, w, h);
      c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(w / 2, 0); c.stroke();
    }
  }
  c.restore();
}

function drawVehicle(c: CanvasRenderingContext2D, v: Vehicle) {
  const a = ((v.heading - 90) * Math.PI) / 180, L = v.len, Wd = v.wid;
  c.save(); c.fillStyle = "rgba(20,40,10,0.22)"; c.translate(v.x + 0.35, v.y + 0.4); c.rotate(a); c.beginPath(); c.roundRect(-L / 2, -Wd / 2, L, Wd, 0.4); c.fill(); c.restore();
  c.save(); c.translate(v.x, v.y); c.rotate(a);
  c.fillStyle = "#1c1c1c"; for (const [wx, wy] of [[L * 0.3, -Wd / 2], [L * 0.3, Wd / 2], [-L * 0.3, -Wd / 2], [-L * 0.3, Wd / 2]]) c.fillRect(wx - 0.38, wy - 0.12, 0.76, 0.24);
  c.fillStyle = v.color; c.beginPath(); c.roundRect(-L / 2, -Wd / 2, L, Wd, 0.35); c.fill();
  c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 0.06; c.stroke();
  c.fillStyle = "#2b3440"; c.beginPath(); c.roundRect(L * 0.12, -Wd / 2 + 0.15, L * 0.14, Wd - 0.3, 0.12); c.fill();        // windshield
  c.fillStyle = "rgba(0,0,0,0.08)"; c.fillRect(-L / 2 + 0.2, -Wd / 2 + 0.2, L * 0.5, Wd - 0.4);                              // the box
  c.strokeStyle = "rgba(0,0,0,0.18)"; c.strokeRect(-L / 2 + 0.2, -Wd / 2 + 0.2, L * 0.5, Wd - 0.4);
  c.restore();
}

function drawTree(c: CanvasRenderingContext2D, t: Tree, blobs: number[][], alpha: number, time: number) {
  c.save(); c.globalAlpha = alpha; c.translate(t.x, t.y);
  const sway = Math.sin(time * 0.8 + t.x) * 0.03 * t.r;
  if (t.kind === "spruce") {
    const layers = [["#244b2c", 1], ["#2f5f37", 0.78], ["#3b7043", 0.52], ["#4a8250", 0.26]] as const;
    for (const [col, k] of layers) {
      c.fillStyle = col; c.beginPath();
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2 + k, r = t.r * k * (i % 2 ? 0.72 : 1); c.lineTo(Math.cos(a) * r + sway * k, Math.sin(a) * r); }
      c.closePath(); c.fill();
    }
  } else {
    c.fillStyle = t.kind === "fruit" ? "#47873a" : "#3a7330"; c.beginPath(); c.arc(sway * 0.5, 0, t.r, 0, 7); c.fill();
    for (const [bx, by, br, sh] of blobs) { c.fillStyle = sh < 0.5 ? "#4b8c3a" : "#58a043"; c.beginPath(); c.arc(bx * t.r + sway, by * t.r, br * t.r, 0, 7); c.fill(); }
    c.fillStyle = "rgba(150,210,100,0.35)"; c.beginPath(); c.arc(-t.r * 0.3 + sway, -t.r * 0.32, t.r * 0.42, 0, 7); c.fill();
    if (t.kind === "fruit") { c.fillStyle = "#d8443a"; for (const [bx, by] of blobs) { c.beginPath(); c.arc(bx * t.r * 0.9 + sway, by * t.r * 0.9 + 0.1, 0.09, 0, 7); c.fill(); } }
  }
  c.restore();
}

function drawBuilding(c: CanvasRenderingContext2D, b: Building, alpha: number, door: { x: number; y: number } | null) {
  const dz = b.height * OBL, P = b.poly, ccw = area(P) > 0;
  c.save(); c.globalAlpha = alpha; c.lineJoin = "round";
  if (b.kind === "deck") {   // a low wooden deck: boards, a darker edge, a little side face
    const T = P.map(p => [p[0], p[1] - dz] as Pt);
    c.fillStyle = b.wall; pathPoly(c, P); c.fill();
    c.fillStyle = b.roof; pathPoly(c, T); c.fill();
    c.save(); pathPoly(c, T); c.clip(); const xs = T.map(p => p[0]), ys = T.map(p => p[1]);
    c.strokeStyle = "rgba(110,80,45,0.35)"; c.lineWidth = 0.03; for (let yy = Math.min(...ys); yy < Math.max(...ys); yy += 0.14) { c.beginPath(); c.moveTo(Math.min(...xs), yy); c.lineTo(Math.max(...xs), yy); c.stroke(); }
    c.restore(); c.strokeStyle = "rgba(110,80,45,0.6)"; c.lineWidth = 0.08; pathPoly(c, T); c.stroke();
    c.restore(); return;
  }
  // south-facing walls (the slight 3/4 view)
  for (let i = 0; i < P.length; i++) {
    const a = P[i], q = P[(i + 1) % P.length], dx = q[0] - a[0], dy = q[1] - a[1], L = Math.hypot(dx, dy);
    const nx = (ccw ? dy : -dy) / L, ny = (ccw ? -dx : dx) / L;
    if (ny <= 0.35) continue;
    const shade = 0.82 + 0.18 * ny - 0.1 * Math.max(0, nx);
    c.fillStyle = b.wall; pathPoly(c, [a, q, [q[0], q[1] - dz], [a[0], a[1] - dz]]); c.fill();
    c.fillStyle = `rgba(0,0,0,${(1 - shade).toFixed(3)})`; c.fill();
    const ux = dx / L, uy = dy / L;
    if (b.kind === "house") {
      c.strokeStyle = "rgba(120,95,60,0.18)"; c.lineWidth = 0.04;
      for (let s = 0.25; s < dz; s += 0.25) { c.beginPath(); c.moveTo(a[0], a[1] - s); c.lineTo(q[0], q[1] - s); c.stroke(); }
      // the door on the wall nearest the door spot, windows elsewhere
      let doorAt = -1;
      if (door) { const cl = segClosest(a[0], a[1], q[0], q[1], door.x, door.y); if (Math.hypot(cl[0] - door.x, cl[1] - door.y) < 2.5) doorAt = Math.hypot(cl[0] - a[0], cl[1] - a[1]); }
      const n = Math.max(1, Math.floor(L / 1.5));
      for (let k = 0; k < n; k++) {
        const s = (L / n) * (k + 0.5); if (doorAt >= 0 && Math.abs(s - doorAt) < 0.8) continue;
        const wx = a[0] + ux * s, wy = a[1] + uy * s;
        c.fillStyle = b.trim ?? "#fff"; c.fillRect(wx - 0.3, wy - dz * 0.8, 0.6, dz * 0.42);
        c.fillStyle = "#53697e"; c.fillRect(wx - 0.23, wy - dz * 0.76, 0.46, dz * 0.34);
      }
      if (doorAt >= 0) { const wx = a[0] + ux * doorAt, wy = a[1] + uy * doorAt; c.fillStyle = b.trim ?? "#fff"; c.fillRect(wx - 0.36, wy - dz * 0.72, 0.72, dz * 0.72); c.fillStyle = "#f4f1ea"; c.fillRect(wx - 0.28, wy - dz * 0.66, 0.56, dz * 0.66); }
    } else if (b.kind === "barn" || b.kind === "garage") {
      const dw = Math.min(L * 0.4, 3.6), s = L / 2, wx = a[0] + ux * s, wy = a[1] + uy * s;
      c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(wx - dw / 2, wy - dz * 0.75, dw, dz * 0.75);
      c.strokeStyle = b.trim ?? "#fff"; c.lineWidth = 0.14; c.strokeRect(wx - dw / 2, wy - dz * 0.75, dw, dz * 0.75);
      c.beginPath(); c.moveTo(wx - dw / 2, wy - dz * 0.75); c.lineTo(wx + dw / 2, wy); c.moveTo(wx + dw / 2, wy - dz * 0.75); c.lineTo(wx - dw / 2, wy); c.moveTo(wx, wy - dz * 0.75); c.lineTo(wx, wy); c.stroke();
    } else {
      const wx = a[0] + ux * L * 0.5, wy = a[1] + uy * L * 0.5;
      c.fillStyle = "#6d5a48"; c.fillRect(wx - 0.45, wy - dz * 0.8, 0.9, dz * 0.8);
    }
    if (b.trim) { c.strokeStyle = b.trim; c.lineWidth = 0.1; pathPoly(c, [a, q, [q[0], q[1] - dz], [a[0], a[1] - dz]]); c.stroke(); }
  }
  // roof: a gable along the long side for a rectangle, flat with a rim for anything else
  const T = P.map(p => [p[0], p[1] - dz] as Pt);
  const edgeLight = (pts: Pt[], ridgeMid: Pt) => { const [cx, cy] = centroid(pts), vx = cx - ridgeMid[0], vy = cy - ridgeMid[1], l = Math.hypot(vx, vy) || 1; return (-vx - vy) / (l * 1.414); };
  const gable = (T: Pt[]) => {
    const L0 = Math.hypot(T[1][0] - T[0][0], T[1][1] - T[0][1]), L1 = Math.hypot(T[2][0] - T[1][0], T[2][1] - T[1][1]);
    const mid = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const [r0, r1, h1, h2] = L0 < L1 ? [mid(T[0], T[1]), mid(T[2], T[3]), [T[1], T[2]], [T[3], T[0]]] as const : [mid(T[1], T[2]), mid(T[3], T[0]), [T[0], T[1]], [T[2], T[3]]] as const;
    const halves: Pt[][] = L0 < L1 ? [[h1[0], h1[1], r1, r0], [h2[0], h2[1], r0, r1]] : [[h1[0], h1[1], r0, r1], [h2[0], h2[1], r1, r0]];
    const rm = mid(r0, r1);
    for (const hp of halves) {
      const lit = edgeLight(hp, rm);
      c.fillStyle = b.roof; pathPoly(c, hp); c.fill();
      c.fillStyle = lit > 0 ? `rgba(255,255,255,${(0.1 * lit).toFixed(3)})` : `rgba(0,0,0,${(-0.18 * lit).toFixed(3)})`; c.fill();
      // shingle / panel lines parallel to the ridge
      c.save(); pathPoly(c, hp); c.clip();
      const rx = r1[0] - r0[0], ry = r1[1] - r0[1], rl = Math.hypot(rx, ry), px = -ry / rl, py = rx / rl;
      c.strokeStyle = "rgba(0,0,0,0.13)"; c.lineWidth = 0.04;
      const span = Math.max(L0, L1);
      for (let s = -span; s <= span; s += b.kind === "house" ? 0.38 : 0.6) { c.beginPath(); c.moveTo(r0[0] + px * s - rx, r0[1] + py * s - ry); c.lineTo(r1[0] + px * s + rx, r1[1] + py * s + ry); c.stroke(); }
      c.restore();
      c.strokeStyle = b.trim ?? "rgba(0,0,0,0.35)"; c.lineWidth = 0.1; pathPoly(c, hp); c.stroke();
    }
    c.strokeStyle = b.kind === "barn" ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.3)"; c.lineWidth = 0.14; c.beginPath(); c.moveTo(r0[0], r0[1]); c.lineTo(r1[0], r1[1]); c.stroke();
  };
  const lift = (ps: Pt[]) => ps.map(p => [p[0], p[1] - dz] as Pt);
  if (b.wings?.length) { c.fillStyle = b.roof; pathPoly(c, T); c.fill(); for (const wg of b.wings) gable(lift(wg)); }
  else if (T.length === 4 && !b.flat) {
    if (b.kind === "barn") {   // the grey roof sits inside a band of red wall so it reads as a red barn from above
      const ins = 0.5, Q = T.map((p, i) => { const n = T[(i + 1) % 4], o = T[(i + 3) % 4], ln = Math.hypot(n[0] - p[0], n[1] - p[1]), lo = Math.hypot(o[0] - p[0], o[1] - p[1]); return [p[0] + ((n[0] - p[0]) / ln + (o[0] - p[0]) / lo) * ins, p[1] + ((n[1] - p[1]) / ln + (o[1] - p[1]) / lo) * ins] as Pt; });
      c.fillStyle = b.wall; pathPoly(c, T); c.fill(); c.strokeStyle = b.trim ?? "#fff"; c.lineWidth = 0.12; c.stroke();
      gable(Q);
    } else gable(T);
  }
  else {
    c.fillStyle = b.roof; pathPoly(c, T); c.fill();
    c.strokeStyle = "rgba(0,0,0,0.18)"; c.lineWidth = 0.3; c.stroke();
  }
  c.strokeStyle = b.trim ?? "rgba(0,0,0,0.35)"; c.lineWidth = b.kind === "barn" ? 0.2 : 0.12; pathPoly(c, T); c.stroke();
  if (b.frontGable) {   // the steep cross gable over the front door, trimmed in white
    const [l, r, apex] = lift(b.frontGable), m: Pt = [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2];
    c.fillStyle = b.roof; pathPoly(c, [l, m, apex]); c.fill(); c.fillStyle = "rgba(255,255,255,0.08)"; c.fill();
    c.fillStyle = b.roof; pathPoly(c, [m, r, apex]); c.fill(); c.fillStyle = "rgba(0,0,0,0.16)"; c.fill();
    c.strokeStyle = "rgba(0,0,0,0.3)"; c.lineWidth = 0.06; c.beginPath(); c.moveTo(l[0], l[1]); c.lineTo(apex[0], apex[1]); c.lineTo(r[0], r[1]); c.stroke();
    c.strokeStyle = b.trim ?? "#fff"; c.lineWidth = 0.12; c.beginPath(); c.moveTo(m[0], m[1]); c.lineTo(apex[0], apex[1]); c.moveTo(l[0], l[1]); c.lineTo(r[0], r[1]); c.stroke();
  }
  if (b.kind === "house") { // a chimney
    const main = b.wings?.length ? lift(b.wings.reduce((a, w) => (Math.abs(area(w)) > Math.abs(area(a)) ? w : a))) : T;
    const xs = main.map(p => p[0]), ys = main.map(p => p[1]), cx = Math.max(...xs) - 0.55, cy = (Math.min(...ys) + Math.max(...ys)) / 2 - 0.25;
    c.fillStyle = "#8a4a36"; c.fillRect(cx - 0.25, cy - 0.25, 0.5, 0.5); c.fillStyle = "#3a2a22"; c.fillRect(cx - 0.15, cy - 0.15, 0.3, 0.3);
  }
  c.restore();
}

/** Pat on the orange lawn tractor. Local frame (life size, then scaled by K): +x forward, +y to Pat's right. */
function drawMower(c: CanvasRenderingContext2D, x: number, y: number, h: number, steer: number, odo: number, time: number, running: boolean) {
  c.save();
  c.fillStyle = "rgba(20,40,10,0.25)"; c.beginPath(); c.ellipse(x + 0.25, y + 0.32, 1.05 * K, 0.85 * K, h, 0, 7); c.fill();
  c.translate(x, y); c.rotate(h); c.scale(K, K);
  const rr = (x0: number, y0: number, w: number, hh: number, r: number) => { c.beginPath(); c.roundRect(x0, y0, w, hh, r); };
  const buzz = running ? Math.sin(time * 90) * 0.008 : 0;
  // the deck slung underneath between the wheels, a little wider than the body, with the side chute
  c.fillStyle = "#262626"; rr(-0.3, -0.76, 0.78, 1.52, 0.3); c.fill();
  c.fillStyle = "#3a3a3a"; rr(-0.26, -0.71, 0.7, 1.42, 0.26); c.fill();
  c.fillStyle = "#1b1b1b"; rr(-0.02, 0.7, 0.36, 0.26, 0.06); c.fill();
  // wheels: big rear, small front that steer; treads roll with distance
  const wheel = (cx: number, cy: number, lw: number, ww: number, a: number) => {
    c.save(); c.translate(cx, cy); c.rotate(a);
    c.fillStyle = "#141414"; rr(-lw / 2, -ww / 2, lw, ww, 0.06); c.fill();
    c.strokeStyle = "#383838"; c.lineWidth = 0.03; const sp = 0.09, off = ((odo / K) % sp + sp) % sp;
    c.save(); rr(-lw / 2, -ww / 2, lw, ww, 0.06); c.clip(); for (let s = -lw / 2 - sp + off; s < lw / 2 + sp; s += sp) { c.beginPath(); c.moveTo(s, -ww / 2); c.lineTo(s, ww / 2); c.stroke(); } c.restore();
    c.fillStyle = "#9a9ea3"; rr(-lw * 0.2, -ww * 0.22, lw * 0.4, ww * 0.44, 0.03); c.fill();   // grey hub
    c.fillStyle = "#6d7176"; c.beginPath(); c.arc(0, 0, Math.min(lw, ww) * 0.12, 0, 7); c.fill();
    c.restore();
  };
  wheel(-0.56, -0.47, 0.56, 0.24, 0); wheel(-0.56, 0.47, 0.56, 0.24, 0);
  wheel(0.74, -0.38, 0.32, 0.14, steer); wheel(0.74, 0.38, 0.32, 0.14, steer);
  c.translate(0, buzz);
  // running boards (black) and the rear body round the seat
  c.fillStyle = "#222"; rr(-0.1, -0.4, 0.46, 0.8, 0.06); c.fill();
  c.fillStyle = "#f26b1d"; rr(-0.86, -0.42, 0.8, 0.84, 0.18); c.fill();
  c.strokeStyle = "#b04e12"; c.lineWidth = 0.04; c.stroke();
  c.fillStyle = "#1e1e1e"; c.fillRect(-0.86, -0.3, 0.07, 0.6);   // rear hitch plate
  // the long hood out front: grille and headlights at the nose
  c.beginPath(); c.moveTo(0.22, -0.3); c.lineTo(0.96, -0.24); c.quadraticCurveTo(1.1, -0.22, 1.1, 0); c.quadraticCurveTo(1.1, 0.22, 0.96, 0.24); c.lineTo(0.22, 0.3); c.closePath();
  c.fillStyle = "#f47c20"; c.fill(); c.strokeStyle = "#b04e12"; c.stroke();
  c.fillStyle = "rgba(255,255,255,0.18)"; c.beginPath(); c.moveTo(0.3, -0.2); c.lineTo(0.95, -0.15); c.lineTo(0.95, -0.05); c.lineTo(0.3, -0.08); c.closePath(); c.fill();
  c.fillStyle = "#c95714"; c.fillRect(0.32, -0.025, 0.66, 0.05);              // hood seam
  c.fillStyle = "#1a1a1a"; rr(1.02, -0.15, 0.08, 0.3, 0.03); c.fill();        // grille
  c.fillStyle = "#fff6c8"; c.beginPath(); c.arc(1.04, -0.19, 0.04, 0, 7); c.arc(1.04, 0.19, 0.04, 0, 7); c.fill();
  // dash, steering wheel just in front of the seat
  c.fillStyle = "#2a2a2a"; rr(0.12, -0.22, 0.12, 0.44, 0.04); c.fill();
  c.strokeStyle = "#151515"; c.lineWidth = 0.05; c.beginPath(); c.arc(0.08, 0, 0.15, 0, 7); c.stroke();
  c.beginPath(); c.moveTo(-0.07, 0); c.lineTo(0.23, 0); c.stroke();
  // the black seat
  c.fillStyle = "#1b1b1b"; rr(-0.66, -0.25, 0.42, 0.5, 0.1); c.fill();
  c.fillStyle = "#2b2b2b"; rr(-0.76, -0.27, 0.12, 0.54, 0.05); c.fill();
  // Pat: legs to the running boards, arms to the wheel, shirt, head with brown and grey hair
  c.fillStyle = "#3d5378"; rr(-0.36, -0.2, 0.5, 0.13, 0.05); c.fill(); rr(-0.36, 0.07, 0.5, 0.13, 0.05); c.fill();
  c.fillStyle = "#3a2f28"; rr(0.12, -0.21, 0.1, 0.12, 0.03); c.fill(); rr(0.12, 0.09, 0.1, 0.12, 0.03); c.fill();
  c.strokeStyle = "#efc6a2"; c.lineWidth = 0.075; c.lineCap = "round";
  c.beginPath(); c.moveTo(-0.42, -0.21); c.lineTo(0.02, -0.13); c.moveTo(-0.42, 0.21); c.lineTo(0.02, 0.13); c.stroke();
  c.fillStyle = "#4e7aa6"; c.beginPath(); c.ellipse(-0.46, 0, 0.15, 0.25, 0, 0, 7); c.fill();
  c.fillStyle = "#efc6a2"; c.beginPath(); c.arc(-0.43, 0, 0.12, 0, 7); c.fill();
  c.beginPath(); c.ellipse(-0.44, -0.12, 0.028, 0.022, 0, 0, 7); c.ellipse(-0.44, 0.12, 0.028, 0.022, 0, 0, 7); c.fill();
  c.fillStyle = "#6b4a32"; c.beginPath(); c.ellipse(-0.46, 0, 0.11, 0.115, 0, 0, 7); c.fill();
  c.fillStyle = "#a59a8f"; for (const [gx, gy] of [[-0.5, -0.06], [-0.47, 0.06], [-0.53, 0.01], [-0.42, -0.08], [-0.4, 0.07], [-0.55, -0.03]]) { c.beginPath(); c.arc(gx, gy, 0.02, 0, 7); c.fill(); }
  c.strokeStyle = "rgba(60,40,25,0.5)"; c.lineWidth = 0.014; c.beginPath(); c.arc(-0.48, 0, 0.065, -1.2, 1.2); c.stroke();
  c.restore();
}

type Cat = { st: "in" | "out" | "home" | "flee"; x: number; y: number; h: number; act: "walk" | "sit" | "lick" | "idle" | "nap"; actT: number; tx: number; ty: number; outT: number; next: number; fleeT: number; cool: number; phase: number };

/** The grey cat, top-down. Local frame: +x where she's facing. */
function drawCat(c: CanvasRenderingContext2D, cat: Cat, time: number) {
  const S = 2.8;   // drawn bigger than life (like the mower) so she's easy to spot
  c.save(); c.translate(cat.x, cat.y);
  c.fillStyle = "rgba(20,40,10,0.16)"; c.beginPath(); c.ellipse(0.06, 0.08, 0.24 * S, 0.14 * S, cat.h, 0, 7); c.fill();
  c.rotate(cat.h); c.scale(S, S);
  const grey = "#8b9097", dark = "#6c7179", moving = cat.act === "walk" || cat.st === "flee";
  const sitting = !moving && (cat.act === "sit" || cat.act === "lick");
  if (!moving && cat.act === "nap") {   // curled up asleep in the sun: a round grey ball, tail wrapped round, ears up
    const br = 0.18 + Math.sin(time * 1.6) * 0.006;
    c.fillStyle = grey; c.beginPath(); c.arc(-0.02, 0, br, 0, 7); c.fill();
    c.strokeStyle = dark; c.lineWidth = 0.025; for (const k of [-0.6, 0, 0.6]) { c.beginPath(); c.arc(-0.02, 0, br * 0.75, k - 0.35, k + 0.35); c.stroke(); }
    c.strokeStyle = dark; c.lineWidth = 0.06; c.lineCap = "round"; c.beginPath(); c.arc(-0.02, 0, br + 0.02, 0.6, 2.6); c.stroke();
    c.fillStyle = grey; c.beginPath(); c.arc(0.12, -0.06, 0.085, 0, 7); c.fill();
    c.beginPath(); c.moveTo(0.1, -0.12); c.lineTo(0.08, -0.2); c.lineTo(0.16, -0.14); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0.17, -0.1); c.lineTo(0.23, -0.16); c.lineTo(0.2, -0.06); c.closePath(); c.fill();
    c.strokeStyle = "#3b3f45"; c.lineWidth = 0.012; c.beginPath(); c.arc(0.15, -0.07, 0.02, 0.2, 2.9); c.stroke(); c.beginPath(); c.arc(0.1, -0.03, 0.02, 0.2, 2.9); c.stroke();
    c.restore(); return;
  }
  const sw = Math.sin(time * (cat.st === "flee" ? 9 : 2.2) + cat.phase);
  // tail
  c.strokeStyle = dark; c.lineWidth = 0.06; c.lineCap = "round"; c.beginPath();
  if (sitting) { c.moveTo(-0.14, 0.05); c.quadraticCurveTo(-0.2, 0.22, 0.02, 0.22 + sw * 0.02); }
  else { c.moveTo(-0.22, 0); c.quadraticCurveTo(-0.36, sw * 0.14, -0.48, sw * 0.08 + Math.sin(time * 3 + cat.phase) * 0.06); }
  c.stroke();
  // legs while moving
  if (moving) { c.fillStyle = dark; const lp = Math.sin(time * (cat.st === "flee" ? 22 : 9) + cat.phase) * 0.05; for (const [lx, ly, s] of [[0.12, -0.1, 1], [0.12, 0.1, -1], [-0.12, -0.1, -1], [-0.12, 0.1, 1]]) { c.beginPath(); c.ellipse(lx + lp * s, ly, 0.045, 0.03, 0, 0, 7); c.fill(); } }
  // body
  c.fillStyle = grey; c.beginPath();
  if (sitting) c.ellipse(-0.04, 0, 0.17, 0.15, 0, 0, 7); else c.ellipse(-0.02, 0, 0.24, 0.11, 0, 0, 7);
  c.fill();
  c.strokeStyle = dark; c.lineWidth = 0.025;
  for (const k of sitting ? [-0.1, -0.02] : [-0.14, -0.06, 0.02]) { c.beginPath(); c.moveTo(k, -0.09); c.quadraticCurveTo(k + 0.03, 0, k, 0.09); c.stroke(); }
  // head (turns to lick a paw)
  const lick = cat.act === "lick" && !moving, hx = sitting ? 0.13 : 0.24, hy = lick ? 0.06 + Math.sin(time * 6) * 0.015 : 0;
  if (lick) { c.fillStyle = "#e9e9e9"; c.beginPath(); c.arc(hx + 0.05, hy + 0.05, 0.035, 0, 7); c.fill(); }
  c.fillStyle = grey; c.beginPath(); c.arc(hx, hy, 0.095, 0, 7); c.fill();
  const back = cat.st === "flee" ? -0.03 : 0;
  c.fillStyle = "#7c8189";
  c.beginPath(); c.moveTo(hx - 0.03 + back, hy - 0.04); c.lineTo(hx - 0.07 + back, hy - 0.15); c.lineTo(hx + 0.05, hy - 0.08); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(hx - 0.03 + back, hy + 0.04); c.lineTo(hx - 0.07 + back, hy + 0.15); c.lineTo(hx + 0.05, hy + 0.08); c.closePath(); c.fill();
  c.fillStyle = "#eab8c0"; c.beginPath(); c.moveTo(hx - 0.02 + back, hy - 0.06); c.lineTo(hx - 0.05 + back, hy - 0.12); c.lineTo(hx + 0.02, hy - 0.08); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(hx - 0.02 + back, hy + 0.06); c.lineTo(hx - 0.05 + back, hy + 0.12); c.lineTo(hx + 0.02, hy + 0.08); c.closePath(); c.fill();
  c.fillStyle = "#dfe1e4"; c.beginPath(); c.arc(hx + 0.06, hy, 0.035, 0, 7); c.fill();
  c.fillStyle = "#e9c46a"; c.beginPath(); c.arc(hx + 0.035, hy - 0.04, 0.02, 0, 7); c.arc(hx + 0.035, hy + 0.04, 0.02, 0, 7); c.fill();
  c.fillStyle = "#1f2328"; c.beginPath(); c.arc(hx + 0.04, hy - 0.04, 0.009, 0, 7); c.arc(hx + 0.04, hy + 0.04, 0.009, 0, 7); c.fill();
  c.fillStyle = "#e79aa6"; c.beginPath(); c.arc(hx + 0.09, hy, 0.012, 0, 7); c.fill();
  c.restore();
}

// ── the run ────────────────────────────────────────────────────────────────
function startEngine(canvas: HTMLCanvasElement, wrap: HTMLElement, hooks: Hooks) {
  const map = toMetres(LAWN_MAP), w = buildWorld(map), dbg = isDebug();
  const rnd = mulberry32((Math.random() * 1e9) | 0);
  const PX = Math.max(6, Math.min(28, 4000 / Math.max(w.W, w.H), Math.sqrt(6e6 / (w.W * w.H))));
  const grass = makeGrass(map, PX), groundCv = makeGround(map, PX);
  const ctx = canvas.getContext("2d")!;
  const treeBlobs = map.trees.map((t, i) => { const r = mulberry32(100 + i), out: number[][] = []; for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + r(), d = 0.45 + r() * 0.2; out.push([Math.cos(a) * d, Math.sin(a) * d, 0.42 + r() * 0.12, r()]); } return out; });
  const treeAlpha = map.trees.map(() => 0.95), roofAlpha = map.buildings.map(() => 1);
  // noise speckle over the lawn, pinned to the ground
  const noise = document.createElement("canvas"); noise.width = noise.height = 96;
  { const nc = noise.getContext("2d")!, img = nc.createImageData(96, 96); for (let k = 0; k < 96 * 96; k++) { const v = Math.random(); img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = v < 0.5 ? 0 : 255; img.data[k * 4 + 3] = Math.random() < 0.5 ? 0 : 16; } nc.putImageData(img, 0, 0); }
  const noisePat = ctx.createPattern(noise, "repeat"); try { noisePat?.setTransform(new DOMMatrix().scale(1 / 20)); } catch {}
  // minimap: one pixel per cell
  const mm = document.createElement("canvas"); mm.width = w.NX; mm.height = w.NY;
  const mmc = mm.getContext("2d")!, mmImg = mmc.createImageData(w.NX, w.NY);
  const cut = new Uint8Array(w.N);
  const paintCell = (k: number) => { const o = k * 4; if (!w.lawn[k]) { mmImg.data[o + 3] = 0; return; } const done = cut[k] || !w.need[k]; mmImg.data[o] = done ? 160 : 58; mmImg.data[o + 1] = done ? 208 : 112; mmImg.data[o + 2] = done ? 104 : 38; mmImg.data[o + 3] = 255; };
  for (let k = 0; k < w.N; k++) paintCell(k);
  mmc.putImageData(mmImg, 0, 0);
  let mmDirty = false;

  // ── state ──
  let phase: "ready" | "play" | "done" = "ready";
  let x = map.start.x, y = map.start.y, h = ((map.start.heading - 90) * Math.PI) / 180, v = 0, steer = 0, reversing = false, backT = 0, uSide = 1, odo = 0, stopT = 0, shake = 0, bumpCool = 0;
  { const p = pushOut(w, x, y, R, null); x = p.x; y = p.y; }
  let simT = 0, penalty = 0, meows = 0, bumps = 0, cutCount = 0, drove = 0, frame = 0;
  const cat: Cat = { st: "in", x: map.door.x, y: map.door.y, h: Math.PI / 2, act: "idle", actT: 0, tx: 0, ty: 0, outT: 0, next: 8 + rnd() * 8, fleeT: 0, cool: 0, phase: rnd() * 6 };
  let bubbleT = 0, floatT = 0, toastT = 0, catSeen = false;
  const parts: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];
  let camX = x, camY = y, missed: number[] = [], missedAt = -1;
  // input
  type Stick = { id: number; bx: number; by: number; kx: number; ky: number };
  let stick: Stick | null = null;
  const keys: Record<string, boolean> = {};
  let testIn: [number, number] | null = null, auto = false, speedK = 1;
  // layout
  let CW = 300, CH = 400, MH = 276, dpr = 1;
  const resize = () => {
    CW = wrap.clientWidth; CH = wrap.clientHeight; MH = Math.max(120, CH - STRIP); dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${CW}px`; canvas.style.height = `${CH}px`; canvas.width = Math.round(CW * dpr); canvas.height = Math.round(CH * dpr);
  };
  resize();
  const ro = new ResizeObserver(resize); ro.observe(wrap); window.addEventListener("resize", resize);
  const stickRest = () => ({ x: CW / 2, y: MH + 8 + (STRIP - 8) / 2 - 6 });
  const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onMove = (e: PointerEvent) => {
    if (!stick || stick.id !== e.pointerId) return;
    const p = local(e), dx = p.x - stick.bx, dy = p.y - stick.by, d = Math.hypot(dx, dy);
    stick.kx = d > STICK_R ? (dx / d) * STICK_R : dx; stick.ky = d > STICK_R ? (dy / d) * STICK_R : dy;
  };
  const onDown = (e: PointerEvent) => {
    const p = local(e); if (p.y < MH + 4 || stick) return;
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    const m = STICK_R * 0.8;
    stick = { id: e.pointerId, bx: clamp(p.x, m, CW - m), by: clamp(p.y, MH + 8 + STICK_R, CH - STICK_R), kx: 0, ky: 0 };
    onMove(e); e.preventDefault();
  };
  const onUp = (e: PointerEvent) => { if (stick?.id === e.pointerId) stick = null; };
  const KEYS: Record<string, string> = { KeyW: "u", ArrowUp: "u", KeyS: "d", ArrowDown: "d", KeyA: "l", ArrowLeft: "l", KeyD: "r", ArrowRight: "r" };
  const onKey = (e: KeyboardEvent) => { const k = KEYS[e.code]; if (!k) return; e.preventDefault(); keys[k] = e.type === "keydown"; };
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);
  window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey);

  // ── autopilot for the browser test (?debug=1): heads for the nearest uncut grass along the grid ──
  let path: number[] = [], pathAt = 0, planT = 0, goal = -1, goalT = 0;
  const skip = new Uint8Array(w.N);
  const nearR = (r: number) => { const out: number[][] = [], c = Math.ceil(r / CELL); for (let dj = -c; dj <= c; dj++) for (let di = -c; di <= c; di++) if (Math.hypot(di, dj) * CELL <= r) out.push([di, dj]); return out; };
  const offsTight = nearR(0.7), offsWide = nearR(NEED_R);
  const uncutNear = (k: number, offs: number[][]) => { const i = k % w.NX, j = (k - i) / w.NX; for (const [di, dj] of offs) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= w.NX || b >= w.NY) continue; const n = b * w.NX + a; if (w.need[n] && !cut[n] && !skip[n]) return n; } return -1; };
  function plan() {
    let from = w.reach[w.cellOf(x, y)] ? w.cellOf(x, y) : -1; path = []; pathAt = 0;
    if (from < 0) { let bd = Infinity; const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL); for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) { const a = ci + di, b = cj + dj; if (a < 0 || b < 0 || a >= w.NX || b >= w.NY) continue; const n = b * w.NX + a; if (w.reach[n] && Math.hypot(di, dj) < bd) { bd = Math.hypot(di, dj); from = n; } } }
    if (from < 0) return;
    for (const offs of [offsTight, offsWide]) {
      const prev = new Int32Array(w.N).fill(-2), q = [from]; prev[from] = -1;
      for (let qi = 0; qi < q.length; qi++) {
        const k = q[qi], u = uncutNear(k, offs);
        if (u >= 0) { const p: number[] = []; for (let c = k; c >= 0; c = prev[c]) p.push(c); path = p.reverse(); if (u !== goal) { goal = u; goalT = 0; } return; }
        const i = k % w.NX, j = (k - i) / w.NX;
        for (const n of [i > 0 ? k - 1 : -1, i < w.NX - 1 ? k + 1 : -1, j > 0 ? k - w.NX : -1, j < w.NY - 1 ? k + w.NX : -1]) if (n >= 0 && w.reach[n] && prev[n] === -2) { prev[n] = k; q.push(n); }
      }
    }
  }
  function autoInput(dt: number): [number, number] {
    planT -= dt; goalT += dt;
    if (goal >= 0 && goalT > 5) { skip[goal] = 1; goal = -1; planT = 0; }
    if (planT <= 0 || pathAt >= path.length) { plan(); planT = 0.35; }
    if (!path.length) return [0, 0];
    while (pathAt < path.length - 1) { const k = path[pathAt], px = ((k % w.NX) + 0.5) * CELL, py = (Math.floor(k / w.NX) + 0.5) * CELL; if (Math.hypot(px - x, py - y) < 0.6) pathAt++; else break; }
    const look = path[Math.min(path.length - 1, pathAt + 2)];
    let tx = ((look % w.NX) + 0.5) * CELL, ty = (Math.floor(look / w.NX) + 0.5) * CELL;
    if (pathAt >= path.length - 1 && goal >= 0) { tx = ((goal % w.NX) + 0.5) * CELL; ty = (Math.floor(goal / w.NX) + 0.5) * CELL; if (Math.hypot(tx - x, ty - y) < 1.0) { const a = Math.atan2(ty - y, tx - x) + Math.PI / 2; return [Math.cos(a) * 0.5, Math.sin(a) * 0.5]; } }
    const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d];
  }

  // ── the cat ──
  const cellX = (k: number) => ((k % w.NX) + 0.5) * CELL, cellY = (k: number) => (Math.floor(k / w.NX) + 0.5) * CELL;
  const catOk = (px: number, py: number) => px > 0 && py > 0 && px < w.W && py < w.H && w.catFree[w.cellOf(px, py)] === 1 && w.catD[w.cellOf(px, py)] >= 0;
  const lineOk = (ax: number, ay: number, bx: number, by: number) => { const L = Math.hypot(bx - ax, by - ay), n = Math.ceil(L / 0.25); for (let s = 1; s <= n; s++) if (!catOk(ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n)) return false; return true; };
  function pickTarget() {
    for (let t = 0; t < 30; t++) {
      const a = rnd() * Math.PI * 2, d = 3 + rnd() * 9, tx = cat.x + Math.cos(a) * d, ty = cat.y + Math.sin(a) * d;
      if (!catOk(tx, ty) || !w.lawn[w.cellOf(tx, ty)] || Math.hypot(tx - x, ty - y) < 4 || !lineOk(cat.x, cat.y, tx, ty)) continue;
      cat.tx = tx; cat.ty = ty; cat.act = "walk"; return;
    }
    cat.act = "idle"; cat.actT = 0.8;
  }
  function catStep(dt: number) {
    cat.cool -= dt;
    if (cat.st === "in") {
      if (phase !== "play") return;
      cat.next -= dt;
      if (cat.next <= 0) { if (!catSeen) { catSeen = true; toastT = 3; } cat.st = "out"; cat.x = cellX(w.doorCell); cat.y = cellY(w.doorCell); cat.outT = 18 + rnd() * 12; cat.act = "idle"; cat.actT = 0.8; }
      return;
    }
    const moveTo = (tx: number, ty: number, sp: number) => {
      const dx = tx - cat.x, dy = ty - cat.y, d = Math.hypot(dx, dy); if (d < 0.05) return true;
      const step = Math.min(d, sp * dt), nx = cat.x + (dx / d) * step, ny = cat.y + (dy / d) * step;
      if (Math.hypot(nx - x, ny - y) < R + CAT_R + 0.05 && Math.hypot(nx - x, ny - y) < Math.hypot(cat.x - x, cat.y - y)) return true;   // never walk into the mower
      cat.h += clamp(wrapA(Math.atan2(dy, dx) - cat.h), -8 * dt, 8 * dt);
      if (catOk(nx, ny)) { cat.x = nx; cat.y = ny; } else return true;
      return step >= d - 1e-6;
    };
    if (cat.st === "flee") {
      cat.fleeT -= dt;
      const away = Math.atan2(cat.y - y, cat.x - x);
      let moved = false;
      for (const off of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2.2, -2.2]) {
        const a = away + off, nx = cat.x + Math.cos(a) * CAT_RUN * dt, ny = cat.y + Math.sin(a) * CAT_RUN * dt;
        if (catOk(nx, ny) && Math.hypot(nx - x, ny - y) >= R + CAT_R) { cat.x = nx; cat.y = ny; cat.h += clamp(wrapA(a - cat.h), -14 * dt, 14 * dt); moved = true; break; }
      }
      if (!moved || cat.fleeT <= 0) { cat.st = cat.outT <= 0 ? "home" : "out"; cat.act = "sit"; cat.actT = 1 + rnd() * 1.5; }
      return;
    }
    if (cat.st === "out") {
      cat.outT -= dt;
      if (cat.act === "walk") { if (moveTo(cat.tx, cat.ty, CAT_WALK)) { const r = rnd(); cat.act = r < 0.3 ? "sit" : r < 0.55 ? "lick" : r < 0.72 ? "nap" : "idle"; cat.actT = cat.act === "idle" ? 0.6 + rnd() : cat.act === "nap" ? 5 + rnd() * 3 : 2 + rnd() * 2.5; } }
      else { cat.actT -= dt; if (cat.actT <= 0) { if (cat.outT <= 0) { cat.st = "home"; cat.act = "walk"; } else pickTarget(); } }
      return;
    }
    // home: follow the distance field down to the door
    cat.act = "walk";
    const k = w.cellOf(cat.x, cat.y);
    if (k === w.doorCell || w.catD[k] <= 0) { if (moveTo(cellX(w.doorCell), cellY(w.doorCell), CAT_WALK)) { cat.st = "in"; cat.next = 30 + rnd() * 30; } return; }
    let best = k, bd = w.catD[k]; const i = k % w.NX, j = (k - i) / w.NX;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= w.NX || b >= w.NY) continue; const n = b * w.NX + a; if (w.catFree[n] && w.catD[n] >= 0 && w.catD[n] < bd) { bd = w.catD[n]; best = n; } }
    moveTo(cellX(best), cellY(best), CAT_WALK * 1.15);
  }

  // ── mowing ──
  function mow() {
    const c = Math.cos(h), s = Math.sin(h), reach = Math.hypot(DECK_LAT, DECK_LON);
    const i0 = Math.max(0, Math.floor((x - reach) / CELL)), i1 = Math.min(w.NX - 1, Math.floor((x + reach) / CELL));
    const j0 = Math.max(0, Math.floor((y - reach) / CELL)), j1 = Math.min(w.NY - 1, Math.floor((y + reach) / CELL));
    let fresh = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * w.NX + i; if (cut[k] || !w.lawn[k]) continue;
      const dx = (i + 0.5) * CELL - x, dy = (j + 0.5) * CELL - y, lon = dx * c + dy * s, lat = -dx * s + dy * c;
      if (Math.abs(lon) <= DECK_LON && Math.abs(lat) <= DECK_LAT) { cut[k] = 1; if (w.need[k]) { cutCount++; fresh++; } paintCell(k); mmDirty = true; }
    }
    const g = grass.c; g.save(); g.translate(x, y); g.rotate(h); g.fillStyle = stripeCol(h); g.fillRect(-VIS_LON, -VIS_LAT, VIS_LON * 2, VIS_LAT * 2); g.restore();
    if (fresh && parts.length < 140) for (let n = 0; n < Math.min(3, fresh); n++) {
      const sp = 3 + rnd() * 3, a = h + Math.PI / 2 + (rnd() - 0.5) * 0.7;
      parts.push({ x: x + Math.cos(h + Math.PI / 2) * DECK_LAT + Math.cos(h) * (rnd() - 0.5) * 0.5, y: y + Math.sin(h + Math.PI / 2) * DECK_LAT + Math.sin(h) * (rnd() - 0.5) * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + rnd() * 0.3, c: rnd() < 0.5 ? "#7fbf4f" : "#4f8f2f" });
    }
  }
  const pct = () => (w.needCount ? cutCount / w.needCount : 1);
  function finish() {
    if (phase === "done") return;
    phase = "done";
    const secs = simT + penalty, area = w.needCount * CELL * CELL;
    const par = (area / (2 * DECK_LAT * VMAX)) * 1.6;
    const neat = clamp(area / Math.max(1, drove * 2 * DECK_LAT), 0, 1);
    const score = Math.round(8000 * clamp(par / Math.max(1, secs), 0, 3) * pct() + 2000 * clamp((neat - 0.4) / 0.45, 0, 1));
    hooks.onFinish({ secs, penalty, meows, neat, score });
  }
  hooks.finishRef.current = () => { if (phase === "play" && pct() >= 0.995) finish(); };

  function step(dt: number) {
    // input: the joystick (and the autopilot) give a direction on screen; the keys drive it like a car (W/S, A/D)
    let ax = 0, ay = 0, thr = 0, turnK = 0, car = false;
    if (auto) [ax, ay] = autoInput(dt);
    else if (testIn) [ax, ay] = testIn;
    else if (stick) { ax = stick.kx / STICK_R; ay = stick.ky / STICK_R; }
    else { thr = (keys.u ? 1 : 0) - (keys.d ? 1 : 0); turnK = (keys.r ? 1 : 0) - (keys.l ? 1 : 0); car = true; }
    const mag = Math.min(1, Math.hypot(ax, ay));
    if (phase === "ready" && (mag > 0.15 || thr !== 0)) { phase = "play"; hooks.onStart(); }
    const halt = phase === "done" || stopT > 0;
    if (stopT > 0) { stopT -= dt; v = 0; }
    let target = 0, steerCmd = 0;
    if (!halt && car) { target = thr > 0 ? VMAX * thr : thr < 0 ? -VREV : 0; steerCmd = turnK; }
    else if (!halt && mag > 0.12) {
      // steer the front wheels toward where the stick points; back up when it points behind
      const th = Math.atan2(ay, ax), fd = wrapA(th - h);
      // pointing behind while rolling makes a full-lock U-turn; pointing behind while stopped (or stuck) backs up
      const behind = Math.abs(fd) > 2.05;
      if (reversing) { if (Math.abs(fd) < 1.1) reversing = false; }
      else if (behind && v < 0.5) { backT += dt; if (backT > 0.25) reversing = true; } else backT = 0;
      if (!reversing && behind && v < 0.5) { target = 0; steerCmd = 0; }
      else if (reversing) { const rd = wrapA(th - h - Math.PI); steerCmd = -clamp(rd / 0.8, -1, 1); target = -VREV * mag; }
      else if (behind) { uSide = Math.abs(steer) > 0.05 ? Math.sign(steer) : fd >= 0 ? 1 : -1; steerCmd = uSide; target = VMAX * mag * 0.45; }
      else { steerCmd = clamp(fd / 0.8, -1, 1); target = VMAX * mag * (0.35 + 0.65 * Math.max(0, Math.cos(fd))); }
    }
    steer += (steerCmd * MAX_STEER - steer) * Math.min(1, dt * 10);
    v += clamp(target - v, -DEC * dt, ACC * dt);
    h = wrapA(h + (v / TURN_R) * (steer / MAX_STEER) * dt);   // car steering: it only turns while it rolls
    const ox = x, oy = y, dirX = Math.cos(h), dirY = Math.sin(h);
    const p = pushOut(w, x + dirX * v * dt, y + dirY * v * dt, R, cat.st !== "in" ? { x: cat.x, y: cat.y, r: CAT_R } : null);
    if (p.hit) { const into = -(dirX * p.nx + dirY * p.ny) * v; if (into > 1.2) { v *= 0.35; if (bumpCool <= 0) { shake = 0.22; bumps++; bumpCool = 0.45; for (let n = 0; n < 6; n++) parts.push({ x: p.x - p.nx * R, y: p.y - p.ny * R, vx: (rnd() - 0.5) * 2 + p.nx, vy: (rnd() - 0.5) * 2 + p.ny, life: 0.4, c: "rgba(190,175,150,0.8)" }); } } }
    x = p.x; y = p.y;
    const moved = Math.hypot(x - ox, y - oy); odo += moved; if (phase === "play") drove += moved;
    bumpCool -= dt; shake = Math.max(0, shake - dt);
    if (phase === "play") { simT += dt; mow(); }
    else if (phase === "ready" && moved > 0) mow();
    catStep(dt);
    // the cat and the mower: Pat always stops
    if (cat.st !== "in" && cat.st !== "flee" && cat.cool <= 0 && phase === "play") {
      const d = Math.hypot(cat.x - x, cat.y - y);
      if (d < MEOW_D && (Math.abs(v) > 0.3 || d < R + 1.2)) {
        stopT = STOP_T; v = 0; penalty += PENALTY; meows++; bubbleT = 2; floatT = 1.6; cat.st = "flee"; cat.fleeT = 1.4; cat.cool = 4.5;
      }
    }
    bubbleT = Math.max(0, bubbleT - dt); floatT = Math.max(0, floatT - dt); toastT = Math.max(0, toastT - dt);
    for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.92; q.vy *= 0.92; q.life -= dt; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
    if (phase === "play" && cutCount >= w.needCount) finish();
  }

  // ── drawing ──
  const toScreen = { s: 1, ox: 0, oy: 0 };
  function rr(x0: number, y0: number, ww: number, hh: number, r: number) { ctx.beginPath(); ctx.roundRect(x0, y0, ww, hh, r); }
  function text(t: string, tx: number, ty: number, size: number, color: string, weight = 700, align: CanvasTextAlign = "center") { ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(t, tx, ty); }
  /** The yard and everything on it, in world units (the caller sets the camera transform). */
  function drawWorld(c: CanvasRenderingContext2D, cx: number, cy: number, vw: number, vh: number, time: number, dt: number) {
    const p = pct();
    c.imageSmoothingEnabled = true;
    c.drawImage(grass.cv, 0, 0, w.W, w.H);
    if (noisePat) { c.fillStyle = noisePat; c.fillRect(cx - vw / 2 - 1, cy - vh / 2 - 1, vw + 2, vh + 2); }
    c.drawImage(groundCv, 0, 0, w.W, w.H);
    // missed spots, once nearly done
    if (phase === "play" && p >= 0.97) {
      if (frame - missedAt > 20) { missed = []; for (let q = 0; q < w.N; q++) if (w.need[q] && !cut[q]) missed.push(q); missedAt = frame; }
      const pulse = 0.5 + 0.5 * Math.sin(time * 5);
      c.fillStyle = `rgba(255,216,80,${(0.3 + 0.35 * pulse).toFixed(3)})`;
      for (const q of missed) { const mx = cellX(q), my = cellY(q); c.beginPath(); c.arc(mx, my, CELL * 0.75, 0, 7); c.fill(); }
    }
    // clippings, the cat, the mower
    for (const q of parts) { c.globalAlpha = Math.min(1, q.life * 3); c.fillStyle = q.c; c.fillRect(q.x - 0.06, q.y - 0.06, 0.12, 0.12); }
    c.globalAlpha = 1;
    if (cat.st !== "in") drawCat(c, cat, time);
    drawMower(c, x, y, h, steer, odo, time, phase === "play");
    // trees and buildings over the top, see-through where the mower or cat is underneath
    map.trees.forEach((t, i) => {
      if (t.kind === "well") return;
      const near = Math.hypot(t.x - x, t.y - y) < t.r + R + 0.6 || (cat.st !== "in" && Math.hypot(t.x - cat.x, t.y - cat.y) < t.r + 0.3);
      treeAlpha[i] += ((near ? 0.22 : 0.96) - treeAlpha[i]) * Math.min(1, dt * 8);
      drawTree(c, t, treeBlobs[i], treeAlpha[i], time);
    });
    map.buildings.forEach((b, i) => {
      const dz = b.height * OBL, roof = b.poly.map(q => [q[0], q[1] - dz] as Pt);
      const behind = (pip(roof, x, y) || polyClosest(roof, x, y).d < 1.0) && !pip(b.poly, x, y);
      const catBehind = cat.st !== "in" && pip(roof, cat.x, cat.y);
      roofAlpha[i] += ((behind || catBehind ? 0.45 : 1) - roofAlpha[i]) * Math.min(1, dt * 8);
      drawBuilding(c, b, roofAlpha[i], b.kind === "house" ? map.door : null);
    });
  }
  function draw(time: number, dt: number) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, CW, CH);
    const sFollow = Math.min(CW, MH) / VIEW_M, sFit = Math.min(CW / w.W, MH / w.H), follow = sFit < sFollow * 0.8, S = follow ? sFollow : sFit;
    const vw = CW / S, vh = MH / S;
    // the tractor sits a little above the middle of the map, with the camera looking ahead the way it's going
    const look = v * 0.6, tx = x + Math.cos(h) * look, ty = y + Math.sin(h) * look + vh * 0.08, k = 1 - Math.exp(-dt * 3.5);
    camX += (tx - camX) * k; camY += (ty - camY) * k;
    const m = 1.5;
    const cx = vw >= w.W + 2 * m ? w.W / 2 : clamp(camX, vw / 2 - m, w.W - vw / 2 + m), cy = vh >= w.H + 2 * m ? w.H / 2 : clamp(camY, vh / 2 - m, w.H - vh / 2 + m);
    const shx = shake > 0 ? (Math.random() - 0.5) * shake * 0.6 : 0, shy = shake > 0 ? (Math.random() - 0.5) * shake * 0.6 : 0;
    const ox = CW / 2 - (cx + shx) * S, oy = MH / 2 - (cy + shy) * S;
    toScreen.s = S; toScreen.ox = ox; toScreen.oy = oy;
    // the map
    ctx.save(); rr(0, 0, CW, MH, 18); ctx.clip();
    ctx.fillStyle = "#83a052"; ctx.fillRect(0, 0, CW, MH);
    ctx.translate(ox, oy); ctx.scale(S, S);
    const p = pct();
    drawWorld(ctx, cx, cy, vw, vh, time, dt);
    ctx.restore();
    // bubbles in screen space
    const sx = (wx: number) => ox + wx * S, sy = (wy: number) => oy + wy * S;
    if (bubbleT > 0 && cat.st !== "in") {
      const bx = sx(cat.x), by = sy(cat.y) - 30, a = Math.min(1, bubbleT * 3);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 6;
      rr(bx - 30, by - 13, 60, 24, 12); ctx.fill(); ctx.beginPath(); ctx.moveTo(bx - 5, by + 10); ctx.lineTo(bx + 1, by + 19); ctx.lineTo(bx + 6, by + 10); ctx.fill();
      ctx.shadowBlur = 0; text("Meow!", bx, by - 1, 13, "#2b3441", 800); ctx.restore();
      const px = sx(x), py = sy(y) - 30; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = "#fff"; rr(px - 11, py - 11, 22, 22, 11); ctx.fill(); text("!", px, py, 15, "#d0402f", 900); ctx.restore();
    }
    if (cat.st !== "in" && cat.act === "nap" && bubbleT <= 0) {   // little z's over a napping cat
      for (let k = 0; k < 3; k++) { const ph = (time * 0.6 + k / 3) % 1; ctx.save(); ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9; text("z", sx(cat.x) + 8 + ph * 10, sy(cat.y) - 10 - ph * 18, 9 + ph * 5, "#4b5563", 800); ctx.restore(); }
    }
    if (toastT > 0) {   // the first time she comes out
      ctx.save(); ctx.globalAlpha = Math.min(1, toastT * 2, (3 - toastT) * 4); ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.shadowColor = "rgba(0,0,0,0.18)"; ctx.shadowBlur = 8;
      ctx.font = `800 13px ${FONT}`; const tw = ctx.measureText("The Cat Is Out!").width + 28;
      rr(10, 10, tw, 30, 15); ctx.fill(); ctx.shadowBlur = 0; text("The Cat Is Out!", 10 + tw / 2, 25.5, 13, "#3d4654", 800); ctx.restore();
    }
    if (floatT > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, floatT * 2); text(`+${PENALTY}s`, sx(x), sy(y) + 34 - (1.6 - floatT) * 14, 13, "#c0392b", 800); ctx.restore(); }
    // arrow to the nearest missed spot when it's off screen
    if (phase === "play" && p >= 0.97 && missed.length) {
      let best = -1, bd = Infinity; for (const q of missed) { const d = Math.hypot(cellX(q) - x, cellY(q) - y); if (d < bd) { bd = d; best = q; } }
      const qx = sx(cellX(best)), qy = sy(cellY(best));
      if (qx < 8 || qx > CW - 8 || qy < 8 || qy > MH - 8) {
        const a = Math.atan2(qy - sy(y), qx - sx(x)), ex = clamp(qx, 22, CW - 22), ey = clamp(qy, 22, MH - 22);
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = "#ffd646"; ctx.strokeStyle = "rgba(60,50,0,0.5)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -9); ctx.lineTo(-3, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
    // minimap
    if (follow) {
      if (mmDirty && frame % 4 === 0) { mmc.putImageData(mmImg, 0, 0); mmDirty = false; }
      const mw = Math.min(92, CW * 0.26), mh = (mw * w.H) / w.W, mx = CW - mw - 8, my = 8, ms = mw / w.W;
      ctx.save(); ctx.fillStyle = "rgba(255,255,255,0.85)"; rr(mx - 3, my - 3, mw + 6, mh + 6, 8); ctx.fill();
      rr(mx, my, mw, mh, 5); ctx.clip(); ctx.fillStyle = "#9fb06a"; ctx.fillRect(mx, my, mw, mh);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(mm, mx, my, mw, mh); ctx.imageSmoothingEnabled = true;
      ctx.translate(mx, my); ctx.scale(ms, ms);
      for (const r of [...map.roads, ...map.lanes]) { ctx.strokeStyle = map.roads.includes(r) ? "#6a6d70" : "#d6c9ae"; ctx.lineWidth = r.width; ctx.lineCap = "round"; ctx.beginPath(); r.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); }
      for (const d of [...map.driveway, ...map.pads.map(q => q.poly)]) { ctx.fillStyle = "#d6c9ae"; pathPoly(ctx, d); ctx.fill(); }
      for (const f of map.fences) { ctx.strokeStyle = "rgba(90,70,40,0.8)"; ctx.lineWidth = 0.6; ctx.beginPath(); f.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); }
      for (const t of map.trees) if (t.kind === "spruce") { ctx.fillStyle = "#2f5f37"; ctx.beginPath(); ctx.arc(t.x, t.y, t.r * 0.8, 0, 7); ctx.fill(); }
      for (const n of map.noGo) { ctx.fillStyle = n.kind === "road" ? "#6a6d70" : n.kind === "water" ? "#6fa7c9" : n.kind === "field" ? "#a88e66" : "#2f5a2c"; pathPoly(ctx, n.poly); ctx.fill(); }
      for (const b of map.beds) { ctx.fillStyle = "#6b4a31"; pathPoly(ctx, b.poly); ctx.fill(); }
      for (const b of map.buildings) { ctx.fillStyle = b.roof; pathPoly(ctx, b.poly); ctx.fill(); }
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1 / ms; ctx.strokeRect(cx - vw / 2, cy - vh / 2, vw, vh);
      if (cat.st !== "in") { ctx.fillStyle = "#5b6068"; ctx.beginPath(); ctx.arc(cat.x, cat.y, 2.2 / ms, 0, 7); ctx.fill(); }
      ctx.fillStyle = "#f07a1a"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2 / ms; ctx.beginPath(); ctx.arc(x, y, 3 / ms, 0, 7); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (phase === "ready") {
      ctx.save(); ctx.fillStyle = "rgba(255,255,255,0.92)"; rr(CW / 2 - 92, MH - 46, 184, 32, 16); ctx.fill(); text("Drive To Start The Clock", CW / 2, MH - 30, 13, "#2f5a1f", 700); ctx.restore();
    }
    // the joystick strip
    ctx.fillStyle = "rgba(255,255,255,0.4)"; rr(0, MH + 8, CW, CH - MH - 8, 18); ctx.fill();
    const rest = stickRest(), bx = stick ? stick.bx : rest.x, by = stick ? stick.by : rest.y, kx = stick ? stick.kx : 0, ky = stick ? stick.ky : 0;
    ctx.fillStyle = "rgba(255,255,255,0.65)"; ctx.beginPath(); ctx.arc(bx, by, STICK_R, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(61,122,38,0.35)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = stick ? "#e2701a" : "rgba(240,122,26,0.9)"; ctx.beginPath(); ctx.arc(bx + kx, by + ky, STICK_R * 0.45, 0, 7); ctx.fill();
    if (!stick) { ctx.fillStyle = "rgba(255,255,255,0.95)"; for (let q = 0; q < 4; q++) { const an = (q * Math.PI) / 2; ctx.beginPath(); ctx.moveTo(rest.x + Math.cos(an) * STICK_R * 0.82, rest.y + Math.sin(an) * STICK_R * 0.82); ctx.lineTo(rest.x + Math.cos(an + 0.25) * STICK_R * 0.64, rest.y + Math.sin(an + 0.25) * STICK_R * 0.64); ctx.lineTo(rest.x + Math.cos(an - 0.25) * STICK_R * 0.64, rest.y + Math.sin(an - 0.25) * STICK_R * 0.64); ctx.fill(); } }
    text("Drive", rest.x, CH - 9, 11, "#5a6b4f", 700);
    if (stopT > 0) { ctx.save(); ctx.fillStyle = "rgba(255,255,255,0.94)"; ctx.font = `700 13px ${FONT}`; const tw = ctx.measureText("Pat Stopped For The Cat").width + 28; rr(CW / 2 - tw / 2, MH - 46, tw, 32, 16); ctx.fill(); text("Pat Stopped For The Cat", CW / 2, MH - 30, 13, "#b03a2e", 700); ctx.restore(); }
  }

  // ── loop ──
  let raf = 0, last = performance.now(), acc = 0, hudAt = 0, lastCan = false;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    let dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (hooks.paused()) dt = 0;
    acc += dt * speedK;
    let n = 0;
    while (acc >= STEP && n < 60 * Math.max(1, speedK)) { step(STEP); acc -= STEP; n++; }
    frame++;
    draw(now / 1000, dt);
    if (now - hudAt > 100) { hudAt = now; const can = phase === "play" && pct() >= 0.995; hooks.onHud(pct(), simT + penalty, can); lastCan = can; }
    void lastCan;
  };
  raf = requestAnimationFrame(loop);

  if (dbg) {
    (window as unknown as { __lm: unknown }).__lm = {
      state: () => ({ phase, pct: pct(), cut: cutCount, need: w.needCount, lawnCells: w.lawn.reduce((a, b) => a + b, 0), x, y, h, v, stopT, meows, bumps, simT, penalty, drove,
        cat: { st: cat.st, x: cat.x, y: cat.y, act: cat.act, next: cat.next }, size: [CW, CH, MH], scrollH: document.documentElement.scrollHeight, PX }),
      hold: (ax: number, ay: number) => { testIn = [ax, ay]; },
      release: () => { testIn = null; },
      auto: (on: boolean) => { auto = on; },
      speed: (k: number) => { speedK = k; },
      catNow: () => { if (cat.st === "in") cat.next = 0.01; },
      catAt: (cx: number, cy: number) => { cat.st = "out"; cat.x = cx; cat.y = cy; cat.act = "sit"; cat.actT = 5; cat.outT = 20; cat.cool = 0; },
      tp: (tx: number, ty: number, th?: number) => { const q = pushOut(w, tx, ty, R, null); x = q.x; y = q.y; if (th !== undefined) h = th; camX = x; camY = y; },
      overview: (sc: number, showNeed: boolean) => {   // the whole yard as an image, for checking a traced layout
        const cv = document.createElement("canvas"); cv.width = Math.round(w.W * sc); cv.height = Math.round(w.H * sc);
        const o = cv.getContext("2d")!; o.scale(sc, sc); o.drawImage(grass.cv, 0, 0, w.W, w.H); o.drawImage(groundCv, 0, 0, w.W, w.H);
        if (showNeed) for (let q = 0; q < w.N; q++) { if (w.lawn[q] && !w.need[q]) { o.fillStyle = "rgba(255,0,0,0.6)"; o.fillRect(cellX(q) - CELL / 2, cellY(q) - CELL / 2, CELL, CELL); } }
        map.trees.forEach((t, i) => { if (t.kind !== "well") drawTree(o, t, treeBlobs[i], 0.96, 0); });
        map.buildings.forEach(b => drawBuilding(o, b, 1, b.kind === "house" ? map.door : null));
        if (showNeed) { o.fillStyle = "#f07a1a"; o.beginPath(); o.arc(map.start.x, map.start.y, 1, 0, 7); o.fill(); o.fillStyle = "#8b9097"; o.beginPath(); o.arc(map.door.x, map.door.y, 0.6, 0, 7); o.fill(); }
        return cv.toDataURL("image/png");
      },
      sweep: (frac: number, fromEast = false) => {   // mows in neat north-south columns (for the test and the preview picture), then tidies up
        if (phase === "ready") { phase = "play"; hooks.onStart(); }
        let col = 0;
        for (let ii = 0; ii < w.NX && pct() < frac; ii += 4, col++) {
          const i = fromEast ? w.NX - 1 - ii : ii;
          const hh = col % 2 ? Math.PI / 2 : -Math.PI / 2;
          for (let jj = 0; jj < w.NY; jj++) { const j = col % 2 ? jj : w.NY - 1 - jj, k2 = j * w.NX + i; if (!w.reach[k2]) continue; x = cellX(k2); y = cellY(k2); h = hh; mow(); }
        }
        for (let k2 = 0; k2 < w.N && pct() < frac; k2++) if (w.reach[k2] && uncutNear(k2, offsWide) >= 0) { x = cellX(k2); y = cellY(k2); for (const hh of [0, Math.PI / 2]) { h = hh; mow(); } }
        camX = x; camY = y; return pct();
      },
      shot: (cx: number, cy: number, viewW: number, pw: number, ph: number) => {   // a picture of the yard from any camera
        const cv = document.createElement("canvas"); cv.width = pw; cv.height = ph; const o = cv.getContext("2d")!, sc = pw / viewW;
        o.fillStyle = "#83a052"; o.fillRect(0, 0, pw, ph); o.translate(pw / 2 - cx * sc, ph / 2 - cy * sc); o.scale(sc, sc);
        drawWorld(o, cx, cy, viewW, ph / sc, performance.now() / 1000, 1);
        return cv.toDataURL("image/png");
      },
      setCat: (cx: number, cy: number, act: string, hd: number) => { cat.st = "out"; cat.x = cx; cat.y = cy; cat.act = act as Cat["act"]; cat.actT = 60; cat.outT = 60; cat.h = hd; cat.cool = 10; },
      cell: (cx: number, cy: number) => { const k2 = w.cellOf(cx, cy); return { lawn: w.lawn[k2], need: w.need[k2], reach: w.reach[k2], cut: cut[k2] }; },
      missed: () => { const out: number[][] = []; for (let q = 0; q < w.N; q++) if (w.need[q] && !cut[q]) out.push([cellX(q), cellY(q)]); return out.slice(0, 50); },
    };
  }

  return () => {
    cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("resize", resize);
    canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp);
    window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey);
    hooks.finishRef.current = null;
  };
}

// ── the page ───────────────────────────────────────────────────────────────
export default function PatsLawnmower() {
  useNoScroll();
  const help = useHelp(GAME);
  const canvasRef = useRef<HTMLCanvasElement>(null), wrapRef = useRef<HTMLDivElement>(null);
  const [runId, setRunId] = useState(0);
  const [started, setStarted] = useState(false);
  const [held, setHeld] = useState(false);
  const [hud, setHud] = useState({ pct: 0, secs: 0, can: false });
  const [result, setResult] = useState<Result | null>(null);
  const [best, setBest] = useState<Best | null>(null);
  const [newBest, setNewBest] = useState(false);
  const pausedRef = useRef(false);
  const paused = help.open || held || !!result;
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  const finishRef = useRef<(() => void) | null>(null);

  useEffect(() => { setBest(readBestRec()); }, []);
  useEffect(() => { const f = () => { if (document.hidden) setHeld(true); }; document.addEventListener("visibilitychange", f); return () => document.removeEventListener("visibilitychange", f); }, []);
  useEffect(() => {
    setStarted(false); setHud({ pct: 0, secs: 0, can: false }); setResult(null); setHeld(false);
    return startEngine(canvasRef.current!, wrapRef.current!, {
      paused: () => pausedRef.current,
      onStart: () => setStarted(true),
      onHud: (pct, secs, can) => setHud(o => (Math.abs(o.pct - pct) < 0.0005 && Math.floor(o.secs) === Math.floor(secs) && o.can === can ? o : { pct, secs, can })),
      onFinish: r => {
        const prev = readBestRec(), rec: Best = { score: Math.max(prev?.score ?? 0, r.score), secs: prev ? Math.min(prev.secs, r.secs) : r.secs };
        try { localStorage.setItem(BEST_KEY, JSON.stringify(rec)); } catch {}
        setNewBest(!prev || r.score > prev.score); setBest(rec); setResult(r);
      },
      finishRef,
    });
  }, [runId]);

  const playing = started && !result;
  const pctLabel = hud.pct >= 1 ? "100" : (Math.floor(hud.pct * 1000) / 10).toFixed(1);
  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-b from-[#eef6e3] via-[#f3f8ec] to-[#b9dc98] text-[#1f2c17]"
      style={{ paddingTop: "max(env(safe-area-inset-top), 10px)", paddingBottom: "max(env(safe-area-inset-bottom), 10px)", paddingLeft: 12, paddingRight: 12 }}>
      <div className="mx-auto flex h-full w-full max-w-[440px] flex-col">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold leading-tight tracking-tight">Pat&apos;s Lawnmower</h1>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setHeld(true)} aria-label="Pause" disabled={!playing}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/75 text-[#3d7a26] transition ${playing ? "" : "opacity-0"}`}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1.5" y="1" width="3" height="10" rx="1" /><rect x="7.5" y="1" width="3" height="10" rx="1" /></svg>
            </button>
            <button onClick={help.show} aria-label="How to play" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/75 text-sm font-bold text-[#3d7a26]">i</button>
          </div>
        </div>
        <div className="mt-1.5 flex items-end justify-between">
          <div><div className="text-[10px] uppercase tracking-wide text-[#5a6b4f]">Mowed</div><div className="text-2xl font-bold leading-none tabular-nums">{pctLabel}%</div></div>
          <div className="text-center"><div className="text-[10px] uppercase tracking-wide text-[#5a6b4f]">Time</div><div className="text-2xl font-bold leading-none tabular-nums">{fmt(hud.secs)}</div></div>
          <div className="text-right"><div className="text-[10px] uppercase tracking-wide text-[#5a6b4f]">Best</div><div className="text-lg font-semibold leading-none tabular-nums">{best ? best.score.toLocaleString() : "-"}</div></div>
        </div>
        <div ref={wrapRef} className="relative mt-2 min-h-0 flex-1 touch-none select-none">
          <canvas ref={canvasRef} className="absolute left-0 top-0 block touch-none" />
          {hud.can && !result && !held && (
            <div className="pointer-events-none absolute inset-x-0 flex justify-center" style={{ bottom: STRIP + 16 }}>
              <button onClick={() => finishRef.current?.()} className="pointer-events-auto rounded-full bg-[#3d7a26] px-5 py-2.5 text-sm font-bold text-white shadow-lg">Finish Mowing</button>
            </div>
          )}
          {held && playing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[18px] bg-[#1f2c17]/45 p-4">
              <div className="w-full max-w-[280px] rounded-3xl bg-white p-5 text-center shadow-2xl">
                <div className="text-xl font-bold">Paused</div>
                <button onClick={() => setHeld(false)} className="mt-4 w-full rounded-full bg-[#3d7a26] py-3 font-semibold text-white">Resume</button>
              </div>
            </div>
          )}
        </div>
      </div>
      {result && (
        <Modal onClose={() => {}}>
          <div className="text-center text-2xl font-bold">Lawn Mowed!</div>
          {newBest && <div className="mx-auto mt-2 rounded-full bg-[#fff3c4] px-3 py-1 text-xs font-bold text-[#8a6a00]">New Best!</div>}
          <div className="mt-4 text-center"><div className="text-[11px] uppercase tracking-wide text-[#5a6b4f]">Score</div><div className="text-4xl font-bold tabular-nums">{result.score.toLocaleString()}</div></div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-[#f0f7e8] px-2 py-2"><div className="text-[11px] uppercase tracking-wide text-[#5a6b4f]">Time</div><div className="text-lg font-bold tabular-nums">{fmt(result.secs)}</div>
              {result.penalty > 0 && <div className="text-[11px] text-[#5a6b4f]">Incl. +{result.penalty}s For The Cat</div>}</div>
            <div className="rounded-2xl bg-[#f0f7e8] px-2 py-2"><div className="text-[11px] uppercase tracking-wide text-[#5a6b4f]">Neatness</div><div className="text-lg font-bold tabular-nums">{Math.round(result.neat * 100)}%</div></div>
            <div className="rounded-2xl bg-[#f0f7e8] px-2 py-2"><div className="text-[11px] uppercase tracking-wide text-[#5a6b4f]">Best Score</div><div className="text-lg font-bold tabular-nums">{best ? best.score.toLocaleString() : "-"}</div></div>
            <div className="rounded-2xl bg-[#f0f7e8] px-2 py-2"><div className="text-[11px] uppercase tracking-wide text-[#5a6b4f]">Best Time</div><div className="text-lg font-bold tabular-nums">{best ? fmt(best.secs) : "-"}</div></div>
          </div>
          <button onClick={() => setRunId(n => n + 1)} className="mt-5 w-full rounded-full bg-[#3d7a26] py-3.5 text-lg font-bold text-white">Play Again</button>
        </Modal>
      )}
      {help.open && (
        <HelpModal onClose={help.close} steps={[
          "Put your thumb in the strip under the lawn and push where you want to go. Pat steers like a real tractor, so turns are wide. On a computer: W and S drive, A and D steer.",
          "Mow every bit of grass. The little map in the corner shows what's left, and missed spots light up near the end.",
          "Watch for the grey cat. Pat stops for her, which costs a few seconds. The faster you finish, the more points.",
        ]} />
      )}
    </main>
  );
}
