// Pat's Fall Chores on the home map: the jobs that ride on the normal tractor engine (./engine) but play their own way.
//   sticks  Pat picks up sticks after a windy night: pull up beside one and tap it; he hops off, fetches it and tosses
//           it in the little cart behind the tractor.
//   leaves  fall leaves all round the house: the deck and bagger pick them up as the tractor drives over (the engine's
//           mowing does the counting; this paints the leaves and the fall look).
//   ride    Linda rides in the cart for two laps round the edge of the property, through the flags in order.
// The engine calls into a Chore at a handful of points (setup, each step, drawing, taps, the HUD, the outcome).
import type { LawnMap, Pt, Tree, Building } from "../lawnMap";
import type { World } from "./world";
import type { Job, Upgrades, Outcome } from "./jobs";
import type { Sound } from "./sound";
import type { Meter, Phase } from "./engine";
import { pushOut, CELL, BODY_R } from "./world";
import { clamp, wrapA, mulberry32 } from "./geo";
import { oldStripeCol } from "./art";
import { drawLeaf, drawStick, drawPat, drawCart, drawFlag, scatterLeaves, LEAF_COLS, type Stick } from "./fallArt";
import { winterChore, winterMap } from "./winter";   // Chapter 4: Pat's Winter
import { makeSummerChore } from "./summer";   // Chapter 6

export type ChoreCtx = {
  job: Job; map: LawnMap; w: World; up: Upgrades; snd: Sound; mode: string;
  grass: { cv: HTMLCanvasElement; c: CanvasRenderingContext2D }; jobNeed: Uint8Array; cut: Uint8Array;
  pose: () => { x: number; y: number; h: number; v: number };
  place: (x: number, y: number, h: number) => void;
  phase: () => Phase; simT: () => number; pct: () => number; bumps: () => number; meows: () => number;
  say: (t: string) => void; floatAt: (t: string, x: number, y: number, col?: string) => void; shake: (s: number) => void; buzz: () => void;
  // Chapter 4: the ground canvas (drawn once, world units), the baked buildings, the stick as read this step, where the cat is
  ground: HTMLCanvasElement; baked: { cv: HTMLCanvasElement; x: number; y: number; w: number; h: number }[]; stick: () => [number, number]; cat: () => { x: number; y: number; out: boolean };
};
export type Chore = {
  noTufts?: boolean; clipCols?: [string, string];
  hold(): boolean; patOff(): boolean;
  step(dt: number): void;
  hit?(into: number): void;
  tap?(wx: number, wy: number): void;
  done?(): boolean;
  drawGround(c: CanvasRenderingContext2D, time: number, cx: number, cy: number, vw: number, vh: number): void;
  drawBelow(c: CanvasRenderingContext2D, time: number): void;
  drawAbove(c: CanvasRenderingContext2D, time: number): void;
  drawScreen(c: CanvasRenderingContext2D, sx: (x: number) => number, sy: (y: number) => number, CW: number, MH: number, time: number): void;
  drawMini?(c: CanvasRenderingContext2D, ms: number): void;
  holes(): [number, number, number][];
  hud(): { lead?: { label: string; value: string }; meter?: Meter; pct?: number };
  outcome(o: Outcome): Outcome;
  banner(ok: boolean): string | undefined;
  focus?(): [number, number][] | null;
  autoInput?(dt: number): [number, number];
  debug(): unknown;
  // Chapter 4 (all optional): the deck as drawn, where the cat is, the camera's target, a tree drawn its own way, a layer
  // over the roofs, a longer end scene, no minimap, no engine noise, a top speed for now
  deck?: number; catMode?: "roam" | "deck" | "none"; cam?(): [number, number] | null; drawTree?(c: CanvasRenderingContext2D, t: Tree, alpha: number, time: number): boolean;
  drawTop?(c: CanvasRenderingContext2D, time: number): void; sceneSecs?: number; noMini?: boolean; silent?: boolean; speedCap?(): number | undefined;
  // Chapter 6: optional extras. drawBuilding draws a building itself (true skips the engine's own picture of it);
  // the end scene plays.
  drawBuilding?(c: CanvasRenderingContext2D, b: Building, time: number): boolean;
  push?(x: number, y: number, r: number): { x: number; y: number; nx: number; ny: number; hit: boolean } | null;
  catDeck?: boolean;
};

const FONT = "system-ui, -apple-system, sans-serif";
const U = (m: LawnMap, ux: number, uy: number): Pt => [ux * 0.075 - m.origin[0], (uy + 130) * 0.075 - m.origin[1]];   // a spot traced in the yard's units, in metres

// ── shared bits: the cart behind the tractor, the screen arrow, a little grid route-finder for the autopilot ──
function makeCart(ctx: ChoreCtx) {
  const HITCH = ctx.up.bagger ? 1.45 : 1.0, TONGUE = 1.55;
  const p0 = ctx.pose(); const c = { ax: p0.x - Math.cos(p0.h) * (HITCH + TONGUE), ay: p0.y - Math.sin(p0.h) * (HITCH + TONGUE), a: p0.h, hits: 0, cool: 0 };
  function update(dt: number) {
    const p = ctx.pose(), hx = p.x - Math.cos(p.h) * HITCH, hy = p.y - Math.sin(p.h) * HITCH;
    const fix = () => { const dx = hx - c.ax, dy = hy - c.ay, d = Math.hypot(dx, dy) || 1; c.ax = hx - (dx / d) * TONGUE; c.ay = hy - (dy / d) * TONGUE; c.a = Math.atan2(dy, dx); };
    fix();
    const rel = wrapA(c.a - p.h); if (Math.abs(rel) > 1.75) { c.a = p.h + Math.sign(rel) * 1.75; c.ax = hx - Math.cos(c.a) * TONGUE; c.ay = hy - Math.sin(c.a) * TONGUE; }   // never folds right back on itself
    let push = 0;
    for (let it = 0; it < 2; it++) for (const off of [0.42, -0.42]) {
      const cx = c.ax + Math.cos(c.a) * off, cy = c.ay + Math.sin(c.a) * off, q = pushOut(ctx.w, cx, cy, 0.58, null);
      if (q.hit) { c.ax += q.x - cx; c.ay += q.y - cy; push += Math.hypot(q.x - cx, q.y - cy); fix(); }
    }
    c.cool -= dt;
    if (push > 0.03 && Math.abs(p.v) > 1.2 && c.cool <= 0) { c.cool = 1; c.hits++; return true; }
    return false;
  }
  return { c, update, TONGUE, HITCH };
}
function edgeArrow(c: CanvasRenderingContext2D, qx: number, qy: number, fromX: number, fromY: number, CW: number, MH: number, time: number, label = "") {
  const a = Math.atan2(qy - fromY, qx - fromX), bob = Math.sin(time * 6) * 3, ex = clamp(qx, 26, CW - 26);
  let ey = clamp(qy, 26, MH - 26); if (ex > CW - Math.min(104, CW * 0.28) - 30 && ey < 140) ey = 140;   // never under the minimap
  c.save(); c.translate(ex - Math.cos(a) * bob, ey - Math.sin(a) * bob); c.rotate(a); c.fillStyle = "#ffd646"; c.strokeStyle = "rgba(60,50,0,0.6)"; c.lineWidth = 2; c.shadowColor = "rgba(0,0,0,0.25)"; c.shadowBlur = 6;
  c.beginPath(); c.moveTo(15, 0); c.lineTo(-10, -12); c.lineTo(-4, 0); c.lineTo(-10, 12); c.closePath(); c.fill(); c.shadowBlur = 0; c.stroke(); c.restore();
  if (label) { const lx = clamp(ex - Math.cos(a) * 32, 26, CW - 26), ly = clamp(ey - Math.sin(a) * 28, 18, MH - 18); pill(c, label, lx, ly, 11, "#5c4a12", "rgba(255,246,214,0.95)", 8, 20); }
}
function pill(c: CanvasRenderingContext2D, t: string, cx: number, cy: number, size: number, fg: string, bg: string, padX = 14, hgt = 30) {
  c.save(); c.font = `800 ${size}px ${FONT}`; const tw = c.measureText(t).width + padX * 2;
  c.fillStyle = bg; if (c.globalAlpha > 0.98) { c.shadowColor = "rgba(0,0,0,0.2)"; c.shadowBlur = 10; c.shadowOffsetY = 2; } c.beginPath(); c.roundRect(cx - tw / 2, cy - hgt / 2, tw, hgt, hgt / 2); c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0;
  c.fillStyle = fg; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(t, cx, cy + 0.5); c.restore();
}
function bubble(c: CanvasRenderingContext2D, x: number, y: number, t: string, a: number) {
  c.save(); c.globalAlpha = a; c.font = `800 13px ${FONT}`; const tw = c.measureText(t).width + 20;
  c.fillStyle = "#fff"; if (a > 0.98) { c.shadowColor = "rgba(0,0,0,0.25)"; c.shadowBlur = 8; } c.beginPath(); c.roundRect(x - tw / 2, y - 13, tw, 25, 12.5); c.fill(); c.beginPath(); c.moveTo(x - 5, y + 11); c.lineTo(x, y + 19); c.lineTo(x + 5, y + 11); c.fill(); c.shadowBlur = 0;
  c.fillStyle = "#4a2f6b"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(t, x, y); c.restore();
}
function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number, a: number) {
  c.save(); c.globalAlpha = a; c.translate(x, y); c.scale(s, s); c.fillStyle = "#e8506a"; c.beginPath(); c.moveTo(0, 3); c.bezierCurveTo(-6, -1, -3, -6, 0, -2.5); c.bezierCurveTo(3, -6, 6, -1, 0, 3); c.fill(); c.restore();
}
/** Grid routes for the autopilot (tests only): breadth-first over the cells the tractor can reach. */
function makeRouter(ctx: ChoreCtx) {
  const w = ctx.w;
  const near = (x: number, y: number) => { let k = w.cellOf(x, y); if (w.reach[k]) return k; let bd = Infinity; const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL); for (let dj = -8; dj <= 8; dj++) for (let di = -8; di <= 8; di++) { const a = ci + di, b = cj + dj; if (a < 0 || b < 0 || a >= w.NX || b >= w.NY) continue; const n = b * w.NX + a; if (w.reach[n] && Math.hypot(di, dj) < bd) { bd = Math.hypot(di, dj); k = n; } } return k; };
  function route(fx: number, fy: number, tx: number, ty: number) {
    const from = near(fx, fy), to = near(tx, ty), prev = new Int32Array(w.N).fill(-2), q = [from]; prev[from] = -1;
    for (let qi = 0; qi < q.length; qi++) { const k = q[qi]; if (k === to) break; const i = k % w.NX, j = (k - i) / w.NX; for (const n of [i > 0 ? k - 1 : -1, i < w.NX - 1 ? k + 1 : -1, j > 0 ? k - w.NX : -1, j < w.NY - 1 ? k + w.NX : -1]) if (n >= 0 && w.reach[n] && w.clearance[n] > BODY_R + 0.35 && prev[n] === -2) { prev[n] = k; q.push(n); } }
    if (prev[to] === -2) return [] as number[];
    const p: number[] = []; for (let c = to; c >= 0; c = prev[c]) p.push(c); return p.reverse();
  }
  const sight = (x: number, y: number, bx: number, by: number) => { const L = Math.hypot(bx - x, by - y), n = Math.ceil(L / 0.3); for (let q = 1; q <= n; q++) { const k = w.cellOf(x + ((bx - x) * q) / n, y + ((by - y) * q) / n); if (!w.reach[k] || w.clearance[k] < BODY_R + 0.45) return false; } return true; };
  let path: number[] = [], at = 0, goal: Pt | null = null, planT = 0;
  /** A push on the stick toward (tx, ty) along a grid route, eased near obstacles; [0, 0] once there. */
  function drive(dt: number, tx: number, ty: number, slowAt = 0): [number, number] {
    const p = ctx.pose(); planT -= dt;
    if (!goal || goal[0] !== tx || goal[1] !== ty || planT <= 0 || at >= path.length) { path = route(p.x, p.y, tx, ty); at = 0; goal = [tx, ty]; planT = 1.2; }
    while (at < path.length - 1 && Math.hypot(w.cellX(path[at]) - p.x, w.cellY(path[at]) - p.y) < 1.2) at++;
    let la = at; for (let q = Math.min(path.length - 1, at + 26); q > at; q--) if (sight(p.x, p.y, w.cellX(path[q]), w.cellY(path[q]))) { la = q; break; }
    const end = la >= path.length - 1, gx = end ? tx : path.length ? w.cellX(path[la]) : tx, gy = end ? ty : path.length ? w.cellY(path[la]) : ty, dx = gx - p.x, dy = gy - p.y, d = Math.hypot(dx, dy) || 1;
    let want = clamp(w.clearance[w.cellOf(p.x, p.y)] / 3, 0.35, 1);
    if (slowAt > 0) want = Math.min(want, clamp(Math.hypot(tx - p.x, ty - p.y) / slowAt, 0.25, 1));
    const push = 0.1 + 0.9 * want; return [(dx / d) * push, (dy / d) * push];
  }
  return { drive, near };
}
/** A light fall look: a warm wash over the ground, under everything standing on it. */
function fallWash(c: CanvasRenderingContext2D, f: number, cx: number, cy: number, vw: number, vh: number) {
  if (!f) return; c.save(); c.globalCompositeOperation = "multiply"; c.fillStyle = `rgba(255,214,150,${(0.32 * f).toFixed(3)})`; c.fillRect(cx - vw / 2 - 2, cy - vh / 2 - 2, vw + 4, vh + 4); c.restore();
}
/** A few leaves fallen round each tree (painted once on the grass). */
function treeLeaves(ctx: ChoreCtx, perM2: number, seed: number) {
  const g = ctx.grass.c, rnd = mulberry32(seed);
  for (const t of ctx.map.trees) { if (t.kind === "spruce" || t.kind === "well") continue; const n = Math.round(Math.PI * t.r * t.r * 1.4 * perM2); scatterLeaves(g, rnd, t.x + t.r * 0.15, t.y + t.r * 0.15, t.r * 1.2, n, 0.14); }
}

export function makeChore(job: Job, ctx: ChoreCtx): Chore | null {
  if (job.twist === "sticks") return sticksChore(ctx);
  if (job.twist === "leaves") return leavesChore(ctx);
  if (job.twist === "ride") return rideChore(ctx);
  const summer = makeSummerChore(job, ctx); if (summer) return summer;   // Chapter 6
  return winterChore(job, ctx);   // Chapter 4
}
/** Chapter 4: a chore can change the map before the world is built (Linda's car in the driveway, the inside of the shop). */
export function choreMap(job: Job, map: LawnMap): LawnMap { return winterMap(job, map) ?? map; }

// ── Sticks ──
// where they fell, traced in the yard's units: under the big trees, round the barn, along the fence lines
const STICK_SPOTS: [number, number][] = [
  [1040, 215], [1175, 265], [838, 240], [960, 520], [1200, 600], [1040, 690], [1020, 800], [1210, 790],   // under the trees and round the barn
  [600, 425], [250, 295], [60, 700], [500, 1035],                                                          // along the field's fences
];
function sticksChore(ctx: ChoreCtx): Chore {
  const m = ctx.map, rnd = mulberry32((Math.random() * 1e9) | 0), REACH = 4.4, WALK = 3.1;
  const sticks: (Stick & { st: 0 | 1 | 2 })[] = STICK_SPOTS.map(([ux, uy], i) => { const [x, y] = U(m, ux, uy); return { x, y, a: rnd() * Math.PI, len: 0.95 + rnd() * 0.45, seed: 20 + i, st: 0 }; });
  treeLeaves(ctx, 0.5, 31);
  const cart = makeCart(ctx), router = makeRouter(ctx);
  let inCart = 0, hintT = 0, autoReady = -1, autoOrder: number[] = [];
  // Pat on foot: off the seat, out to the stick, bend and pick it up, back to the cart, toss it in, climb back on
  type Walk = { st: "off" | "out" | "pick" | "back" | "toss" | "climb"; x: number; y: number; a: number; t: number; i: number; ph: number; side: number };
  let walk: Walk | null = null;
  const seat = (side: number): Pt => { const p = ctx.pose(); return [p.x - Math.cos(p.h) * 0.44 - Math.sin(p.h) * side * 0.85, p.y - Math.sin(p.h) * 0.44 + Math.cos(p.h) * side * 0.85]; };
  const cartSide = (): Pt => { const k = cart.c, p = ctx.pose(), sx = -Math.sin(k.a), sy = Math.cos(k.a), side = (p.x - k.ax) * sx + (p.y - k.ay) * sy >= 0 ? 1 : -1; return [k.ax + sx * side * 0.95, k.ay + sy * side * 0.95]; };
  const nearest = () => { const p = ctx.pose(); let bi = -1, bd = Infinity; sticks.forEach((s, i) => { if (s.st) return; const d = Math.hypot(s.x - p.x, s.y - p.y); if (d < bd) { bd = d; bi = i; } }); return { i: bi, d: bd }; };
  const go = (to: Pt, dt: number) => { if (!walk) return true; const dx = to[0] - walk.x, dy = to[1] - walk.y, d = Math.hypot(dx, dy); if (d < 0.05) return true; const s = Math.min(d, WALK * dt); walk.x += (dx / d) * s; walk.y += (dy / d) * s; walk.a = Math.atan2(dy, dx); walk.ph += s * 5.2; return s >= d - 1e-6; };
  function tapStick(i: number) {
    const p = ctx.pose(), s = sticks[i]; if (walk || s.st) return;
    if (Math.hypot(s.x - p.x, s.y - p.y) > REACH) { ctx.say("Pull Up Closer To That One"); hintT = 2; return; }
    const side = (s.x - p.x) * -Math.sin(p.h) + (s.y - p.y) * Math.cos(p.h) >= 0 ? 1 : -1, [sx, sy] = seat(0);
    walk = { st: "off", x: sx, y: sy, a: p.h + side * Math.PI / 2, t: 0, i, ph: 0, side }; s.st = 1; autoReady = -1; ctx.snd.click();
  }
  const total = sticks.length, got = () => sticks.filter(s => s.st === 2).length;
  return {
    hold: () => !!walk, patOff: () => !!walk,
    step(dt) {
      if (cart.update(dt)) ctx.shake(0.1);
      hintT = Math.max(0, hintT - dt);
      if (!walk) return;
      walk.t += dt; const s = sticks[walk.i];
      if (walk.st === "off") { if (go(seat(walk.side), dt) || walk.t > 0.5) { walk.st = "out"; walk.t = 0; } }
      else if (walk.st === "out") { const d = Math.hypot(s.x - walk.x, s.y - walk.y), tx = s.x - ((s.x - walk.x) / (d || 1)) * 0.5, ty = s.y - ((s.y - walk.y) / (d || 1)) * 0.5; if (go([tx, ty], dt)) { walk.st = "pick"; walk.t = 0; walk.a = Math.atan2(s.y - walk.y, s.x - walk.x); } }
      else if (walk.st === "pick") { if (walk.t > 0.55) { walk.st = "back"; walk.t = 0; ctx.snd.pop(); } }
      else if (walk.st === "back") { if (go(cartSide(), dt)) { walk.st = "toss"; walk.t = 0; walk.a = Math.atan2(cart.c.ay - walk.y, cart.c.ax - walk.x); } }
      else if (walk.st === "toss") { if (walk.t > 0.35) { s.st = 2; inCart++; ctx.snd.clank(); ctx.floatAt(`${got()} / ${total}`, cart.c.ax, cart.c.ay - 1.2, "#fff4c2"); walk.st = "climb"; walk.t = 0; } }
      else if (walk.st === "climb") { if (go(seat(walk.side), dt)) { walk = null; if (got() === total) ctx.say("That's Every Stick!"); } }
    },
    tap(wx, wy) {
      if (ctx.phase() !== "play" && ctx.phase() !== "ready") return;
      let bi = -1, bd = 1.9; sticks.forEach((s, i) => { if (s.st) return; const d = Math.hypot(s.x - wx, s.y - wy); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0) tapStick(bi);
    },
    done: () => got() === total && !walk,
    drawGround(c, time, cx, cy, vw, vh) {
      fallWash(c, ctx.job.fall ?? 0, cx, cy, vw, vh);
      const n = nearest(), p = ctx.pose();
      for (const [i, s] of sticks.entries()) {
        if (s.st === 2 || (walk && walk.i === i && walk.st !== "out" && walk.st !== "off")) continue;
        drawStick(c, s);
        if (i === n.i && !walk && n.d <= REACH && Math.abs(p.v) < 1.5) { const pu = 0.5 + 0.5 * Math.sin(time * 5); c.strokeStyle = `rgba(255,214,64,${(0.55 + 0.4 * pu).toFixed(3)})`; c.lineWidth = 0.1; c.beginPath(); c.arc(s.x, s.y, s.len * 0.62 + 0.1 * pu, 0, 7); c.stroke(); }
      }
    },
    drawBelow(c, time) { drawCart(c, cart.c.ax, cart.c.ay, cart.c.a, cart.TONGUE, { sticks: inCart }); void time; },
    drawAbove(c, time) {
      if (!walk) return; const s = sticks[walk.i];
      const bend = walk.st === "pick" ? Math.sin(Math.min(1, walk.t / 0.55) * Math.PI) : walk.st === "toss" ? 0.3 : 0;
      const carry = walk.st === "back" || (walk.st === "pick" && walk.t > 0.28) ? "stick" : null;
      if (walk.st === "toss") { const u = walk.t / 0.35; drawStick(c, { ...s, x: walk.x + (cart.c.ax - walk.x) * u, y: walk.y + (cart.c.ay - walk.y) * u - Math.sin(u * Math.PI) * 0.8, a: s.a + u * 3 }, 0.6, false); }
      drawPat(c, walk.x, walk.y, walk.a, { walk: walk.st === "out" || walk.st === "back" || walk.st === "climb" || walk.st === "off" ? walk.ph : 0, carry, bend, seed: s.seed }, time);
    },
    drawScreen(c, sx, sy, CW, MH, time) {
      if (ctx.phase() !== "play" && ctx.phase() !== "ready") return;
      const n = nearest(), p = ctx.pose();
      if (!walk && n.i >= 0 && n.d <= REACH && Math.abs(p.v) < 1.5) pill(c, "Tap The Stick", CW / 2, MH - 30, 13, "#2f5a1f", "rgba(255,255,255,0.97)", 16, 32);
      // none on screen: an arrow on the edge to the nearest, with how far
      if (n.i >= 0 && !walk) { const s = sticks[n.i], qx = sx(s.x), qy = sy(s.y); if (qx < 8 || qx > CW - 8 || qy < 8 || qy > MH - 8) edgeArrow(c, qx, qy, sx(p.x), sy(p.y), CW, MH, time, `${Math.round(n.d)} m`); }
    },
    drawMini(c, ms) { for (const s of sticks) if (s.st === 0) { c.fillStyle = "#7a4a22"; c.strokeStyle = "#fff"; c.lineWidth = 0.6 / ms; c.beginPath(); c.arc(s.x, s.y, 2.2 / ms, 0, 7); c.fill(); c.stroke(); } },
    holes() { const p = ctx.pose(), out: [number, number, number][] = [[cart.c.ax, cart.c.ay, 1.8]]; if (walk) out.push([walk.x, walk.y, 1.6]); for (const s of sticks) if (s.st !== 2 && Math.hypot(s.x - p.x, s.y - p.y) < 9) out.push([s.x, s.y, s.len * 0.8 + 0.5]); return out; },
    hud: () => ({ lead: { label: "Sticks", value: `${got()} / ${total}` }, pct: got() / total }),
    outcome: o => ({ ...o, failLine: `Pat got ${got()} of ${total} sticks. Stop right beside each one so he only has a step or two to walk.` }),
    banner: ok => (ok ? "Yard's All Clear!" : undefined),
    focus() { const p = ctx.pose(); return [[p.x, p.y], [cart.c.ax, cart.c.ay]]; },
    autoInput(dt) {
      // the tests' driver: the nearest stick by route, stop beside it, then wait for the tap (the test taps the screen)
      if (walk) return [0, 0];
      const p = ctx.pose();
      if (autoReady >= 0) { if (sticks[autoReady].st) autoReady = -1; else return [0, 0]; }
      if (!autoOrder.length || sticks[autoOrder[0]]?.st) { autoOrder = sticks.map((_, i) => i).filter(i => !sticks[i].st).sort((a, b) => Math.hypot(sticks[a].x - p.x, sticks[a].y - p.y) - Math.hypot(sticks[b].x - p.x, sticks[b].y - p.y)); }
      const i = autoOrder[0]; if (i === undefined) return [0, 0];
      const s = sticks[i], d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < REACH - 1.4) { autoReady = i; return [0, 0]; }
      return router.drive(dt, s.x, s.y, 5);
    },
    debug: () => ({ sticks: sticks.map(s => ({ x: s.x, y: s.y, st: s.st })), got: got(), total, walk: walk ? walk.st : null, ready: autoReady, cart: cart.c, reach: REACH }),
  };
}

// ── Leaves ──
function leavesChore(ctx: ChoreCtx): Chore {
  const m = ctx.map, w = ctx.w, g = ctx.grass.c, rnd = mulberry32(77), zone = ctx.job.zones?.map(n => m.zones[n]).filter(Boolean) ?? [];
  // the lawn round the house was mowed last week: neat old stripes, then leaves on top of it all
  g.save(); g.beginPath(); for (const z of zone) { z.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); } g.clip();
  for (let sx = 0; sx < w.W; sx += 4) { g.fillStyle = oldStripeCol(sx + 0.1); g.fillRect(sx, 0, 4.02, w.H); }
  g.fillStyle = "rgba(200,170,90,0.12)"; g.fillRect(0, 0, w.W, w.H);
  const trees = m.trees.filter(t => t.kind !== "spruce" && t.kind !== "well");
  for (let k = 0; k < w.N; k++) {
    if (!ctx.jobNeed[k]) continue;
    const x = w.cellX(k), y = w.cellY(k), under = trees.some(t => Math.hypot(t.x - x, t.y - y) < t.r * 1.25), n = under ? 7 : 4;
    for (let q = 0; q < n; q++) drawLeaf(g, x + (rnd() - 0.5) * 0.62, y + (rnd() - 0.5) * 0.62, rnd() * 7, 0.11 + rnd() * 0.08, LEAF_COLS[Math.floor(rnd() * LEAF_COLS.length)]);
  }
  g.restore();
  return {
    noTufts: true, clipCols: ["#e0782a", "#c9432b"],
    hold: () => false, patOff: () => false,
    step() {},
    drawGround(c, _t, cx, cy, vw, vh) { fallWash(c, ctx.job.fall ?? 0, cx, cy, vw, vh); },
    drawBelow() {}, drawAbove() {}, drawScreen() {},
    holes: () => [],
    hud: () => { const p = ctx.pct(); return { lead: { label: "Leaves Up", value: `${p >= 1 ? "100" : (Math.floor(p * 1000) / 10).toFixed(1)}%` } }; },
    outcome: o => ({ ...o, stars: [o.stars[0], o.stars[1], o.done && o.bumps === 0], extra: { label: "Big Bumps", value: String(o.bumps) }, failLine: `You got ${Math.floor(o.pct * 100)}% of the leaves. Long straight runs and U-turns at the ends are quickest.` }),
    banner: ok => (ok ? "Not A Leaf In Sight!" : undefined),
    debug: () => ({}),
  };
}

// ── Linda's ride ──
// the flags, in order round the edge of the property (yard units): down the east side by the lane, through the gate
// into the big field, its south-east, south-west, north-west and north corners, through the gap in the inner fence,
// then back across the top to the house. The last one is the start and finish line.
const RIDE_FLAGS: [number, number][] = [[1215, 365], [896, 490], [925, 925], [80, 1100], [80, 370], [400, 300], [800, 349], [1075, 125]];
function rideChore(ctx: ChoreCtx): Chore {
  const m = ctx.map, flags = RIDE_FLAGS.map(([ux, uy]) => U(m, ux, uy)), R = 5.2, LAPS = 2, N = flags.length;
  const start = flags[N - 1];
  { const t = flags[0]; ctx.place(start[0] + 1, start[1] + 1.5, Math.atan2(t[1] - start[1] - 1.5, t[0] - start[0] - 1)); }
  treeLeaves(ctx, 0.35, 41);
  const cart = makeCart(ctx), router = makeRouter(ctx);
  let next = 0, lap = 0, bumps = 0, say: { t: string; life: number } = { t: "Let's Go, Pat!", life: 2.6 }, hearts = 0, bumpT = 0, wheeT = 6, waveT = 2.5;
  const lindaSays = (t: string, life = 2.2) => { say = { t, life }; };
  const bump = () => { bumps++; bumpT = 1.2; ctx.shake(0.18); ctx.buzz(); lindaSays(["Easy, Pat!", "Ouch! Watch It!", "Pat!"][Math.min(2, bumps - 1)]); ctx.snd.bump(); };
  const progress = () => clamp((lap * N + next) / (LAPS * N), 0, 1);
  const lindaAt = (): Pt => [cart.c.ax - Math.cos(cart.c.a) * 0.22, cart.c.ay - Math.sin(cart.c.a) * 0.22];
  return {
    hold: () => false, patOff: () => false,
    step(dt) {
      const ph = ctx.phase();
      if (cart.update(dt) && ph === "play") bump();
      say.life -= dt; hearts = Math.max(0, hearts - dt); bumpT = Math.max(0, bumpT - dt); waveT = Math.max(0, waveT - dt);
      if (ph !== "play") return;
      const p = ctx.pose(), f = flags[next];
      if (Math.hypot(f[0] - p.x, f[1] - p.y) < R) {
        next++; ctx.snd.coin();
        if (next >= N) { next = 0; lap++; hearts = 2.2; waveT = 2; if (lap < LAPS) { lindaSays("One More Lap!"); ctx.say("Lap 1 Done!"); } }
      }
      wheeT -= dt; if (wheeT <= 0 && Math.abs(p.v) > 5 && bumpT <= 0 && say.life <= 0) { wheeT = 14 + Math.random() * 8; lindaSays(bumps ? "That's Better" : "Wheee!"); waveT = 1.5; }
    },
    hit(into) { if (into > 1.2 && ctx.phase() === "play" && bumpT <= 0) bump(); },
    done: () => lap >= LAPS,
    drawGround(c, time, cx, cy, vw, vh) {
      fallWash(c, ctx.job.fall ?? 0, cx, cy, vw, vh);
      if (lap >= LAPS) return;
      flags.forEach((f, i) => drawFlag(c, f[0], f[1], R, time, i === next ? "next" : i < next ? "done" : "later", i === N - 1 ? "Go" : String(i + 1)));
    },
    drawBelow(c, time) { drawCart(c, cart.c.ax, cart.c.ay, cart.c.a, cart.TONGUE, { linda: { t: time, wave: waveT > 0 ? Math.min(1, waveT * 2) : 0 } }); },
    drawAbove() {},
    drawScreen(c, sx, sy, CW, MH, time) {
      const [lx, ly] = lindaAt(), bx = sx(lx), by = sy(ly) - 30;
      if (say.life > 0) bubble(c, bx, by, say.t, Math.min(1, say.life * 3));
      if (hearts > 0) for (let k = 0; k < 3; k++) { const u = (2.2 - hearts) / 2.2 + k * 0.12; heart(c, bx - 14 + k * 14, by - 8 - u * 26, 1.3, Math.max(0, 1 - u)); }
      if ((ctx.phase() === "play" || ctx.phase() === "ready") && lap < LAPS) { const f = flags[next], qx = sx(f[0]), qy = sy(f[1]); if (qx < 8 || qx > CW - 8 || qy < 8 || qy > MH - 8) { const p = ctx.pose(); edgeArrow(c, qx, qy, sx(p.x), sy(p.y), CW, MH, time); } }
    },
    drawMini(c, ms) { if (lap >= LAPS) return; flags.forEach((f, i) => { c.fillStyle = i === next ? "#ffcf2e" : "rgba(255,255,255,0.9)"; c.strokeStyle = "rgba(60,50,20,0.7)"; c.lineWidth = 0.6 / ms; c.beginPath(); c.arc(f[0], f[1], (i === next ? 2.8 : 1.8) / ms, 0, 7); c.fill(); c.stroke(); }); },
    holes() { const [lx, ly] = lindaAt(); return [[lx, ly, 2.0]]; },
    hud: () => ({ lead: { label: "Lap", value: `${Math.min(LAPS, lap + 1)} / ${LAPS}` }, meter: { label: "Linda", value: bumps ? `${bumps} Bump${bumps > 1 ? "s" : ""}` : "Happy", frac: 0, good: bumps === 0 }, pct: progress() }),
    outcome: o => ({ ...o, bumps, stars: [o.stars[0], o.stars[1], o.done && bumps === 0], extra: { label: "Bumps", value: String(bumps) }, failLine: `Pat got ${Math.floor(progress() * 100)}% of the way round. Drive through each flag in order, and swing wide at the corners so Linda's cart clears the posts.` }),
    banner: ok => { if (ok) { lindaSays(bumps ? "Thanks For The Ride!" : "That Was Lovely!", 5); hearts = 2.2; waveT = 4; } return ok ? "Linda Loved It!" : undefined; },
    focus() { const p = ctx.pose(); return [[p.x, p.y], lindaAt()]; },
    autoInput(dt) { if (lap >= LAPS) return [0, 0]; const f = flags[next]; return router.drive(dt, f[0], f[1]); },
    debug: () => ({ next, lap, bumps, flags, cart: cart.c, cartHits: cart.c.hits }),
  };
}
