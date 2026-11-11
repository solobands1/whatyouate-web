// Pat's Winter (Chapter 4): four jobs that ride on the normal tractor engine (./engine) through the chore hooks in
// ./chores, with the yard under snow (./winterArt draws it all):
//   plow  Plow The Driveway: the blade on the front clears the gravel and pushes the snow off into banks; then Pat hops
//         off with the shovel (the stick walks him) for the walk to the back door and round Linda's car.
//   wood  Firewood: split logs at the chopping block (tap when the marker's in the green), haul them up to the back door
//         in the cart and stack them on the deck. Three loads fills the woodbox.
//   xmas  Christmas Lights: six strands round the yard (the house, the spruce, the fence, both apple trees, the barn).
//         Pat takes a box from the cart and hangs each one; at dark they all light up.
//   tidy  Clean Up The Shop: inside the barn (./shopMap), Pat on foot puts every tool back where it goes.
// The cat watches from the deck (in the shop she has her own spots); Pat stops to say hi when he walks past.
import { toMetres, centredRect, type LawnMap, type Pt, type Tree } from "../lawnMap";
import type { Job, Outcome } from "./jobs";
import type { Chore, ChoreCtx } from "./chores";
import { pushOut, CELL, BODY_R } from "./world";
import { clamp, wrapA, pip, lineDist, mulberry32 } from "./geo";
import { drawCat, pathPoly, type CatPose } from "./art";
import { drawCart } from "./fallArt";
import {
  paintWinterGround, snowRoofs, chimneyTop, drawWinterTree, drawWinterPat, drawPatSeated, drawLindaWinter, drawPlow, drawSnowCar, stampTrack, stampFoot, stampBank,
  drawSplit, drawRound, drawBlock, drawWoodpile, drawWoodStack, drawWoodInCart, drawStrand, drawLightBox, drawTool, drawStoveTop, paintShop, drawPuffs, drawSnowfall,
  outsetPoly, BLADE, SNOW, type ClearShapes, type Puff, type WinterPose,
} from "./winterArt";
import { SHOP_MAP, TOOLS, CAT_SPOTS, PAT_START, TRACTOR, TRACTOR_BLOCKS, STOVE, ROOM, WALL_Y } from "./shopMap";

const FONT = "system-ui, -apple-system, sans-serif";
const U = (ux: number, uy: number): Pt => [ux * 0.075, (uy + 130) * 0.075];   // a spot traced in the yard's units, in metres
const UL = (pts: [number, number][]) => pts.map(([a, b]) => U(a, b));
/** Taps count once the clock's going (push the stick to start); before that a tap just says so. */
const playing = (ctx: ChoreCtx) => { const ph = ctx.phase(); if (ph === "ready") ctx.say("Push The Stick To Start"); return ph === "play"; };
const isWinter = (j: Job) => j.twist === "plow" || j.twist === "wood" || j.twist === "xmas" || j.twist === "tidy";

// ── round the house: the gravel the plow clears, the stone walk to the back door, Linda's car in the parking spot ──
const DRIVE_LANE = { pts: UL([[1105, -62], [1108, 20], [1104, 96]]), width: 46 * 0.075 };
const EAST_LANE = { pts: UL([[1100, 140], [1160, 190], [1222, 250], [1250, 330], [1252, 500], [1252, 690]]), width: 38 * 0.075 };
const TURNAROUND = UL([[1015, 90], [1136, 86], [1140, 154], [1015, 158]]);
const WALK = { pts: UL([[1030, 160], [1040, 248], [1040, 318], [988, 320]]), width: 1.2 };
const CAR_AT = U(1033, 122), CAR = { x: CAR_AT[0], y: CAR_AT[1], len: 4.4, wid: 1.84, color: "#7a2f3a" };
const CAR_POLY = centredRect(CAR.x, CAR.y, CAR.wid, CAR.len), RING = outsetPoly(CAR_POLY, 0.9);
const CLEAR: ClearShapes = { lanes: [DRIVE_LANE, EAST_LANE], polys: [TURNAROUND, RING], walk: WALK };
// firewood: the woodpile and the chopping block by the woodshed, the steps and the stack on the deck by the back door
const WOODPILE = { at: U(1172, 655), len: 2.6, depth: 0.9 };
const BLOCK = U(1150, 682);
const STEPS = U(990, 324);
const STACK_AT = U(948, 252), STACK_LEN = 2.6;

/** Chapter 4: the map for a winter job (Linda's car in the parking spot, the woodpile; the shop is its own map). */
export function winterMap(job: Job, map: LawnMap): LawnMap | null {
  if (!isWinter(job)) return null;
  if (job.twist === "tidy") return toMetres(SHOP_MAP);
  const props = [...map.props];
  if (job.twist === "wood") props.push({ kind: "box", x: WOODPILE.at[0], y: WOODPILE.at[1], w: WOODPILE.len, h: WOODPILE.depth, heading: 0 }, { kind: "pole", x: BLOCK[0], y: BLOCK[1], r: 0.36 });
  return { ...map, props, vehicles: [...map.vehicles, { x: CAR.x, y: CAR.y, len: CAR.len, wid: CAR.wid, heading: 0, color: CAR.color }] };
}
export function winterChore(job: Job, ctx: ChoreCtx): Chore | null {
  if (job.twist === "plow") return plowChore(ctx);
  if (job.twist === "wood") return woodChore(ctx);
  if (job.twist === "xmas") return lightsChore(ctx);
  if (job.twist === "tidy") return shopChore(ctx);
  return null;
}

// ── little shared drawings on the screen ──
function pill(c: CanvasRenderingContext2D, t: string, cx: number, cy: number, size: number, fg: string, bg: string, padX = 14, hgt = 30) {
  c.save(); c.font = `800 ${size}px ${FONT}`; const tw = c.measureText(t).width + padX * 2;
  c.fillStyle = bg; if (c.globalAlpha > 0.98) { c.shadowColor = "rgba(0,0,0,0.2)"; c.shadowBlur = 10; c.shadowOffsetY = 2; } c.beginPath(); c.roundRect(cx - tw / 2, cy - hgt / 2, tw, hgt, hgt / 2); c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0;
  c.fillStyle = fg; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(t, cx, cy + 0.5); c.restore();
}
const hint = (c: CanvasRenderingContext2D, t: string, CW: number, MH: number) => pill(c, t, CW / 2, MH - 30, 13, "#2f5a1f", "rgba(255,255,255,0.97)", 16, 32);
function bubble(c: CanvasRenderingContext2D, x: number, y: number, t: string, a: number, fg = "#2b3441") {
  c.save(); c.globalAlpha = a; c.font = `800 13px ${FONT}`; const tw = c.measureText(t).width + 20;
  c.fillStyle = "#fff"; if (a > 0.98) { c.shadowColor = "rgba(0,0,0,0.25)"; c.shadowBlur = 8; } c.beginPath(); c.roundRect(x - tw / 2, y - 13, tw, 25, 12.5); c.fill(); c.beginPath(); c.moveTo(x - 5, y + 11); c.lineTo(x, y + 19); c.lineTo(x + 5, y + 11); c.fill(); c.shadowBlur = 0;
  c.fillStyle = fg; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(t, x, y); c.restore();
}
function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number, a: number) {
  c.save(); c.globalAlpha = a; c.translate(x, y); c.scale(s, s); c.fillStyle = "#e8506a"; c.beginPath(); c.moveTo(0, 3); c.bezierCurveTo(-6, -1, -3, -6, 0, -2.5); c.bezierCurveTo(3, -6, 6, -1, 0, 3); c.fill(); c.restore();
}
/** An arrow on the edge of the map pointing at something off screen (never ahead of Pat or the tractor), with how far. */
function edgeArrow(c: CanvasRenderingContext2D, qx: number, qy: number, fromX: number, fromY: number, CW: number, MH: number, time: number, label = "", noMini = false) {
  if (qx >= 8 && qx <= CW - 8 && qy >= 8 && qy <= MH - 8) return;
  const a = Math.atan2(qy - fromY, qx - fromX), bob = Math.sin(time * 6) * 3, ex = clamp(qx, 26, CW - 26);
  let ey = clamp(qy, 26, MH - 26); if (!noMini && ex > CW - Math.min(104, CW * 0.28) - 30 && ey < 140) ey = 140;
  c.save(); c.translate(ex - Math.cos(a) * bob, ey - Math.sin(a) * bob); c.rotate(a); c.fillStyle = "#ffd646"; c.strokeStyle = "rgba(60,50,0,0.6)"; c.lineWidth = 2; c.shadowColor = "rgba(0,0,0,0.25)"; c.shadowBlur = 6;
  c.beginPath(); c.moveTo(15, 0); c.lineTo(-10, -12); c.lineTo(-4, 0); c.lineTo(-10, 12); c.closePath(); c.fill(); c.shadowBlur = 0; c.stroke(); c.restore();
  if (label) { const lx = clamp(ex - Math.cos(a) * 32, 26, CW - 26), ly = clamp(ey - Math.sin(a) * 28, 18, MH - 18); pill(c, label, lx, ly, 11, "#5c4a12", "rgba(255,246,214,0.95)", 8, 20); }
}
/** A soft pulsing ring on the snow where something's waiting. */
function ring(c: CanvasRenderingContext2D, x: number, y: number, r: number, time: number) {
  const p = 0.5 + 0.5 * Math.sin(time * 4);
  c.fillStyle = `rgba(255,214,64,${(0.12 + 0.08 * p).toFixed(3)})`; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  c.strokeStyle = "rgba(240,180,30,0.9)"; c.lineWidth = 0.1; c.setLineDash([0.5, 0.35]); c.beginPath(); c.arc(x, y, r + 0.08 * p, time * 0.4, time * 0.4 + 7); c.stroke(); c.setLineDash([]);
}

// ── the cart behind the tractor (as in the fall chores) ──
function makeCart(ctx: ChoreCtx) {
  const HITCH = ctx.up.bagger ? 1.45 : 1.0, TONGUE = 1.55;
  const p0 = ctx.pose(); const c = { ax: p0.x - Math.cos(p0.h) * (HITCH + TONGUE), ay: p0.y - Math.sin(p0.h) * (HITCH + TONGUE), a: p0.h, hits: 0, cool: 0 };
  function update(dt: number) {
    const p = ctx.pose(), hx = p.x - Math.cos(p.h) * HITCH, hy = p.y - Math.sin(p.h) * HITCH;
    const fix = () => { const dx = hx - c.ax, dy = hy - c.ay, d = Math.hypot(dx, dy) || 1; c.ax = hx - (dx / d) * TONGUE; c.ay = hy - (dy / d) * TONGUE; c.a = Math.atan2(dy, dx); };
    fix();
    const rel = wrapA(c.a - p.h); if (Math.abs(rel) > 1.75) { c.a = p.h + Math.sign(rel) * 1.75; c.ax = hx - Math.cos(c.a) * TONGUE; c.ay = hy - Math.sin(c.a) * TONGUE; }
    let push = 0;
    for (let it = 0; it < 2; it++) for (const off of [0.42, -0.42]) {
      const cx = c.ax + Math.cos(c.a) * off, cy = c.ay + Math.sin(c.a) * off, q = pushOut(ctx.w, cx, cy, 0.58, null);
      if (q.hit) { c.ax += q.x - cx; c.ay += q.y - cy; push += Math.hypot(q.x - cx, q.y - cy); fix(); }
    }
    c.cool -= dt;
    if (push > 0.03 && Math.abs(p.v) > 1.2 && c.cool <= 0) { c.cool = 1; c.hits++; return true; }
    return false;
  }
  /** The spot beside the cart on Pat's side. */
  const side = (): Pt => { const p = ctx.pose(), sx = -Math.sin(c.a), sy = Math.cos(c.a), s = (p.x - c.ax) * sx + (p.y - c.ay) * sy >= 0 ? 1 : -1; return [c.ax + sx * s * 0.95, c.ay + sy * s * 0.95]; };
  return { c, update, side, TONGUE };
}

/** Grid routes for the autopilot (the tests only): the tractor over the cells it can reach, Pat over anywhere he fits. */
function makeRouter(ctx: ChoreCtx) {
  const w = ctx.w;
  let avoid: [number, number, number][] = [];
  const okT = (k: number) => w.reach[k] === 1 && w.clearance[k] > BODY_R + 0.35, okP = (k: number) => w.clearance[k] > 0.34 && !avoid.some(([x, y, r]) => Math.hypot(w.cellX(k) - x, w.cellY(k) - y) < r + 0.3);
  const near = (x: number, y: number, ok: (k: number) => boolean) => { let k = w.cellOf(x, y); if (ok(k)) return k; let bd = Infinity; const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL); for (let dj = -8; dj <= 8; dj++) for (let di = -8; di <= 8; di++) { const a = ci + di, b = cj + dj; if (a < 0 || b < 0 || a >= w.NX || b >= w.NY) continue; const n = b * w.NX + a; if (ok(n) && Math.hypot(di, dj) < bd) { bd = Math.hypot(di, dj); k = n; } } return k; };
  function route(fx: number, fy: number, tx: number, ty: number, ok: (k: number) => boolean) {
    const from = near(fx, fy, ok), to = near(tx, ty, ok), prev = new Int32Array(w.N).fill(-2), q = [from]; prev[from] = -1;
    for (let qi = 0; qi < q.length; qi++) { const k = q[qi]; if (k === to) break; const i = k % w.NX, j = (k - i) / w.NX; for (const n of [i > 0 ? k - 1 : -1, i < w.NX - 1 ? k + 1 : -1, j > 0 ? k - w.NX : -1, j < w.NY - 1 ? k + w.NX : -1]) if (n >= 0 && ok(n) && prev[n] === -2) { prev[n] = k; q.push(n); } }
    if (prev[to] === -2) return [] as number[];
    const p: number[] = []; for (let c = to; c >= 0; c = prev[c]) p.push(c); return p.reverse();
  }
  const sight = (x: number, y: number, bx: number, by: number, need: number) => { const L = Math.hypot(bx - x, by - y), n = Math.ceil(L / 0.25); for (let q = 1; q <= n; q++) { const px = x + ((bx - x) * q) / n, py = y + ((by - y) * q) / n, k = w.cellOf(px, py); if (w.clearance[k] < need) return false; if (need < 1 && avoid.some(([ax, ay, ar]) => Math.hypot(px - ax, py - ay) < ar + 0.3)) return false; } return true; };
  const mk = (ok: (k: number) => boolean, need: number) => {
    let path: number[] = [], at = 0, goal: Pt | null = null, planT = 0;
    /** A push on the stick toward (tx, ty) along a route; eased near obstacles and toward the end. */
    return (dt: number, fx: number, fy: number, tx: number, ty: number, slowAt = 0): [number, number] => {
      planT -= dt;
      if (!goal || goal[0] !== tx || goal[1] !== ty || planT <= 0 || at >= path.length) { path = route(fx, fy, tx, ty, ok); at = 0; goal = [tx, ty]; planT = 1.0; }
      while (at < path.length - 1 && Math.hypot(w.cellX(path[at]) - fx, w.cellY(path[at]) - fy) < 0.9) at++;
      let la = at; for (let q = Math.min(path.length - 1, at + 26); q > at; q--) if (sight(fx, fy, w.cellX(path[q]), w.cellY(path[q]), need)) { la = q; break; }
      const end = la >= path.length - 1, gx = end ? tx : path.length ? w.cellX(path[la]) : tx, gy = end ? ty : path.length ? w.cellY(path[la]) : ty, dx = gx - fx, dy = gy - fy, d = Math.hypot(dx, dy) || 1;
      let want = need > 1 ? clamp(w.clearance[w.cellOf(fx, fy)] / 3, 0.35, 1) : 1;
      if (slowAt > 0) want = Math.min(want, clamp(Math.hypot(tx - fx, ty - fy) / slowAt, 0.25, 1));
      const push = 0.1 + 0.9 * want; return [(dx / d) * push, (dy / d) * push];
    };
  };
  const tr = mk(okT, BODY_R + 0.45), pt0 = mk(okP, 0.4);
  // Pat's walk, with a nudge sideways if he's been pushing against something without getting anywhere
  let stAt: Pt = [0, 0], stT = 0, unT = 0, unA = 0;
  const pt = (dt: number, fx: number, fy: number, tx: number, ty: number, slowAt = 0): [number, number] => {
    if (Math.hypot(fx - stAt[0], fy - stAt[1]) > 0.25) { stAt = [fx, fy]; stT = 0; } else stT += dt;
    if (stT > 1.2) { stT = 0; unT = 0.5; unA = Math.atan2(ty - fy, tx - fx) + (Math.random() < 0.5 ? 1.7 : -1.7); }
    if (unT > 0) { unT -= dt; return [Math.cos(unA), Math.sin(unA)]; }
    return pt0(dt, fx, fy, tx, ty, slowAt);
  };
  return { tractor: (dt: number, tx: number, ty: number, slowAt = 0) => { const p = ctx.pose(); return tr(dt, p.x, p.y, tx, ty, slowAt); }, pat: pt, okP, avoid: (b: [number, number, number][]) => { avoid = b; }, sight: (x: number, y: number, bx: number, by: number) => sight(x, y, bx, by, 0.32) };
}

// ── Pat on foot: the stick walks him (quick turning, no assist), he bumps round things, leaves boot prints in the snow ──
type Walker = { x: number; y: number; a: number; v: number; ph: number; vx: number; vy: number; lastFoot: number; foot: number };
function makeWalker(ctx: ChoreCtx, speed: number, prints: boolean) {
  const g = ctx.ground.getContext("2d")!;
  const wk: Walker = { x: 0, y: 0, a: 0, v: 0, ph: 0, vx: 0, vy: 0, lastFoot: 0, foot: 1 };
  /** Moves Pat with the stick; `blocks` are extra circles to walk round (the tractor). */
  function step(dt: number, inp: [number, number], blocks: [number, number, number][]) {
    const raw = Math.min(1, Math.hypot(inp[0], inp[1]));
    let tvx = 0, tvy = 0;
    if (raw > 0.08) { const mag = (raw - 0.08) / 0.92, a = Math.atan2(inp[1], inp[0]); tvx = Math.cos(a) * speed * mag; tvy = Math.sin(a) * speed * mag; wk.a += clamp(wrapA(a - wk.a), -14 * dt, 14 * dt); }
    const k = Math.min(1, dt * 14); wk.vx += (tvx - wk.vx) * k; wk.vy += (tvy - wk.vy) * k;
    let nx = wk.x + wk.vx * dt, ny = wk.y + wk.vy * dt;
    for (const [bx, by, br] of blocks) { const d = Math.hypot(nx - bx, ny - by), rr = br + 0.28; if (d < rr) { nx = bx + ((nx - bx) / (d || 1)) * rr; ny = by + ((ny - by) / (d || 1)) * rr; } }
    const q = pushOut(ctx.w, nx, ny, 0.28, null);
    const moved = Math.hypot(q.x - wk.x, q.y - wk.y); wk.x = q.x; wk.y = q.y; wk.v = moved / dt; wk.ph += moved * 5.4;
    if (prints) footprints(moved);
    return moved;
  }
  function footprints(moved: number) { wk.lastFoot += moved; if (wk.lastFoot > 0.36) { wk.lastFoot = 0; wk.foot = -wk.foot; stampFoot(g, wk.x, wk.y, wk.a, wk.foot); } }
  /** A scripted walk toward a spot (hopping off, carrying things): true once there. */
  function go(to: Pt, dt: number, sp = 3.1) { const dx = to[0] - wk.x, dy = to[1] - wk.y, d = Math.hypot(dx, dy); if (d < 0.04) return true; const s = Math.min(d, sp * dt); wk.x += (dx / d) * s; wk.y += (dy / d) * s; wk.a = Math.atan2(dy, dx); wk.ph += s * 5.4; wk.v = s / dt; if (prints) footprints(s); return s >= d - 1e-6; }
  return { wk, step, go };
}

// ── the winter look shared by the jobs at home: the yard and roofs under snow, bare trees, tracks, breath, smoke ──
function winterBase(ctx: ChoreCtx, plowed: boolean, o: { snowfall?: number; smoke?: () => number } = {}) {
  const g = ctx.ground.getContext("2d")!, m = ctx.map, w = ctx.w;
  paintWinterGround(g, m, CLEAR, plowed);
  snowRoofs(ctx.baked, m.buildings);
  const house = m.buildings.find(b => b.kind === "house"), chim = house ? chimneyTop(house) : null;
  const puffs: Puff[] = [], rnd = mulberry32(5);
  let lastTx = ctx.pose().x, lastTy = ctx.pose().y, breathT = 0.6, exhaustT = 0, smokeT = 0;
  /** Each step: tire tracks behind the tractor, Pat's breath, a putt of exhaust, the chimney's smoke. */
  function step(dt: number, pat: { x: number; y: number; a: number } | null, cart: { ax: number; ay: number; a: number } | null) {
    const p = ctx.pose();
    if (Math.hypot(p.x - lastTx, p.y - lastTy) > 0.12) { stampTrack(g, p.x, p.y, p.h); if (cart) for (const s of [-1, 1]) { g.fillStyle = "rgba(112,138,182,0.14)"; g.save(); g.translate(cart.ax - Math.sin(cart.a) * s * 0.62, cart.ay + Math.cos(cart.a) * s * 0.62); g.rotate(cart.a); g.fillRect(-0.06, -0.09, 0.12, 0.18); g.restore(); } lastTx = p.x; lastTy = p.y; }
    breathT -= dt; if (breathT <= 0) { breathT = 1.5 + rnd() * 0.6; const q = pat ?? { x: p.x - Math.cos(p.h) * 0.44, y: p.y - Math.sin(p.h) * 0.44, a: p.h }; puffs.push({ x: q.x + Math.cos(q.a) * 0.25, y: q.y + Math.sin(q.a) * 0.25, vx: Math.cos(q.a) * 0.35, vy: Math.sin(q.a) * 0.35 - 0.12, t: 0, life: 1.2, r: 0.14, a: 0.7 }); }
    exhaustT -= dt; if (exhaustT <= 0 && !ctx.phase().startsWith("o")) { exhaustT = 0.45 + Math.min(0.5, Math.abs(p.v) * 0.05); const ex = p.x + Math.cos(p.h) * 0.9 - Math.sin(p.h) * 0.38, ey = p.y + Math.sin(p.h) * 0.9 + Math.cos(p.h) * 0.38; puffs.push({ x: ex, y: ey, vx: -Math.sin(p.h) * 0.3, vy: Math.cos(p.h) * 0.3 - 0.2, t: 0, life: 0.9, r: 0.09, a: 0.45 }); }
    if (chim) { smokeT -= dt; const k = o.smoke ? o.smoke() : 0.4; if (smokeT <= 0 && k > 0) { smokeT = 0.7 / (0.4 + k); puffs.push({ x: chim[0] + (rnd() - 0.5) * 0.1, y: chim[1], vx: 0.25 + rnd() * 0.1, vy: -0.45, t: 0, life: 3.4, r: 0.22 + 0.2 * k, a: 0.32 + 0.22 * k }); } }
    for (const q of puffs) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; } for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].t >= puffs[i].life) puffs.splice(i, 1);
  }
  const outside = (c: CanvasRenderingContext2D) => { c.fillStyle = SNOW; c.fillRect(-30, -30, w.W + 60, 30); c.fillRect(-30, w.H, w.W + 60, 30); c.fillRect(-30, 0, 30, w.H); c.fillRect(w.W, 0, 30, w.H); };
  const drawTree = (c: CanvasRenderingContext2D, t: Tree, alpha: number, time: number) => { drawWinterTree(c, t, alpha, time); return true; };
  /** The minimap under snow: the lanes, the buildings, the woods; each job adds its own marks. */
  function mini(c: CanvasRenderingContext2D) {
    c.fillStyle = "#eef2f7"; c.fillRect(0, 0, w.W, w.H);
    for (const n of m.noGo) { c.fillStyle = n.kind === "woods" ? "#8b9088" : "#e2e7ee"; pathPoly(c, n.poly); c.fill(); }
    for (const r of [...m.roads, ...m.lanes]) { c.strokeStyle = m.roads.includes(r) ? "#7a7e83" : "#c9ccd0"; c.lineWidth = r.width; c.lineCap = "round"; c.beginPath(); r.pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke(); }
    for (const d of m.driveway) { c.fillStyle = "#c9ccd0"; pathPoly(c, d); c.fill(); }
    for (const b of m.buildings) { c.fillStyle = b.kind === "barn" ? "#b3302a" : b.kind === "deck" ? "#cdb48e" : "#8d8f93"; pathPoly(c, b.poly); c.fill(); }
    c.fillStyle = CAR.color; pathPoly(c, CAR_POLY); c.fill();
  }
  const top = (c: CanvasRenderingContext2D) => drawPuffs(c, puffs);
  const screen = (c: CanvasRenderingContext2D, CW: number, MH: number, time: number) => { if (o.snowfall) drawSnowfall(c, CW, MH, time, o.snowfall); };
  return { step, outside, drawTree, mini, top, screen, puffs };
}

/** The cat on the deck says hi when Pat walks past (once in a while). */
function makeCatHi(ctx: ChoreCtx) {
  let cool = 4, say = 0;
  return {
    step(dt: number, pat: { x: number; y: number } | null) { cool -= dt; say = Math.max(0, say - dt); const ct = ctx.cat(); if (pat && ct.out && cool <= 0 && Math.hypot(ct.x - pat.x, ct.y - pat.y) < 2.2) { cool = 12; say = 1.8; ctx.snd.meow(); } },
    draw(c: CanvasRenderingContext2D, sx: (x: number) => number, sy: (y: number) => number) { if (say > 0) { const ct = ctx.cat(); bubble(c, sx(ct.x), sy(ct.y) - 30, "Meow!", Math.min(1, say * 3)); } },
  };
}

// ════════════════════════════════════════════ Plow The Driveway ════════════════════════════════════════════
// the autopilot's runs (yard units): out of the barn along the spur, up the lane, back and forth across the parking
// spot, up the driveway to the road and back down, then park by the walk
const PLOW_LEGS: Pt[][] = [
  UL([[1252, 732], [1252, 500], [1250, 330], [1222, 250], [1160, 190], [1114, 150]]),
  UL([[1114, 150], [1068, 150], [1068, 124], [1134, 124], [1134, 99], [1068, 99]]),
  UL([[1068, 99], [1086, 62], [1099, 36], [1099, -46], [1113, -46], [1113, 92]]),
];
const PLOW_PARK = U(1098, 168);
function plowChore(ctx: ChoreCtx): Chore {
  const w = ctx.w, base = winterBase(ctx, false, { snowfall: 42 }), g = ctx.ground.getContext("2d")!, router = makeRouter(ctx), catHi = makeCatHi(ctx);
  const walker = makeWalker(ctx, 2.5, true), pat = walker.wk;
  { const s = U(1252, 732); ctx.place(s[0], s[1], -Math.PI / 2); }   // just out of the barn, at the bottom of the lane
  // which cells are gravel (the blade works there), which need plowing, which need the shovel
  const gravel = new Uint8Array(w.N), plowN = new Uint8Array(w.N), shovN = new Uint8Array(w.N), clr = new Uint8Array(w.N), skip = new Uint8Array(w.N);
  const road = ctx.map.roads[0];
  let plowT = 0, shovT = 0;
  for (let k = 0; k < w.N; k++) {
    const x = w.cellX(k), y = w.cellY(k); if (w.clearance[k] < 0.1 || pip(CAR_POLY, x, y)) continue;
    if (road && lineDist(road.pts, x, y) < road.width / 2 + 0.9) continue;
    const onGravel = CLEAR.lanes.some(l => lineDist(l.pts, x, y) < l.width / 2) || pip(TURNAROUND, x, y), inRing = pip(RING, x, y), onWalk = lineDist(WALK.pts, x, y) < WALK.width / 2;
    if (onGravel || inRing) gravel[k] = 1;
    if (inRing || onWalk) { shovN[k] = 1; shovT++; } else if (onGravel && w.clearance[k] > 0.5) { plowN[k] = 1; plowT++; }
  }
  let plowC = 0, shovC = 0;
  const plowPct = () => (plowT ? plowC / plowT : 1), shovPct = () => (shovT ? shovC / shovT : 1), allPct = () => (plowC + shovC) / Math.max(1, plowT + shovT);
  const clearCell = (k: number) => { if (clr[k]) return false; if (plowN[k]) { clr[k] = 1; plowC++; return true; } if (shovN[k]) { clr[k] = 1; shovC++; return true; } return false; };
  // the fresh snow over the gravel and the walk, on its own layer: the blade and the shovel wipe it away
  const xs = [...CLEAR.lanes.flatMap(l => l.pts), ...TURNAROUND, ...RING, ...WALK.pts].map(p => p[0]), ys = [...CLEAR.lanes.flatMap(l => l.pts), ...TURNAROUND, ...RING, ...WALK.pts].map(p => p[1]);
  const bx0 = Math.min(...xs) - 2.5, by0 = Math.min(...ys) - 2.5, bx1 = Math.max(...xs) + 2.5, by1 = Math.max(...ys) + 2.5, RES = 24;
  const layer = document.createElement("canvas"); layer.width = Math.ceil((bx1 - bx0) * RES); layer.height = Math.ceil((by1 - by0) * RES);
  const lc = layer.getContext("2d")!; lc.scale(RES, RES); lc.translate(-bx0, -by0);
  // the gravel as one clip shape: every piece wound the same way so the overlaps add up instead of cancelling
  const gravelPath = new Path2D(), addPoly = (P: Pt[]) => { let a = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += P[j][0] * P[i][1] - P[i][0] * P[j][1]; const Q = a < 0 ? [...P].reverse() : P; Q.forEach((q, i) => (i ? gravelPath.lineTo(q[0], q[1]) : gravelPath.moveTo(q[0], q[1]))); gravelPath.closePath(); };
  for (const l of CLEAR.lanes) { const hw = l.width / 2 + 0.15; for (let i = 1; i < l.pts.length; i++) { const [ax, ay] = l.pts[i - 1], [bx, by] = l.pts[i], L = Math.hypot(bx - ax, by - ay), nx = (-(by - ay) / L) * hw, ny = ((bx - ax) / L) * hw; addPoly([[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]]); } for (const [px, py] of l.pts) addPoly(Array.from({ length: 16 }, (_, k) => [px + Math.cos((k / 16) * Math.PI * 2) * hw, py + Math.sin((k / 16) * Math.PI * 2) * hw] as Pt)); }
  for (const p of [TURNAROUND, outsetPoly(RING, 0.1)]) addPoly(p);
  {
    const strokeL = (pts: Pt[], wd: number, col: string) => { lc.strokeStyle = col; lc.lineWidth = wd; lc.lineCap = "round"; lc.lineJoin = "round"; lc.beginPath(); pts.forEach((q, i) => (i ? lc.lineTo(q[0], q[1]) : lc.moveTo(q[0], q[1]))); lc.stroke(); };
    for (const [pad, col] of [[0.7, "rgba(238,243,248,0.45)"], [0.35, "rgba(238,243,248,0.8)"], [0, SNOW]] as const) {
      for (const l of CLEAR.lanes) strokeL(l.pts, l.width + pad, col);
      strokeL(WALK.pts, WALK.width + pad, col);
      for (const p of [TURNAROUND, RING]) { lc.fillStyle = col; pathPoly(lc, outsetPoly(p, pad / 2)); lc.fill(); }
    }
    lc.save(); lc.clip(gravelPath); const r = mulberry32(17); for (let k = 0; k < (bx1 - bx0) * (by1 - by0) * 2.2; k++) { const v = r(); lc.fillStyle = v < 0.45 ? "rgba(135,158,196,0.1)" : "rgba(255,255,255,0.7)"; lc.fillRect(bx0 + r() * (bx1 - bx0), by0 + r() * (by1 - by0), 0.06, 0.06); } lc.restore();
  }
  const inClear = (x: number, y: number) => { const k = w.cellOf(x, y); return gravel[k] === 1 || shovN[k] === 1 || x < 0 || y < 0 || x > w.W || y > w.H; };
  // orange snow stakes along both edges of what the blade should clear, like real driveway markers, so it's plain where to plow
  const stakes: Pt[] = [];
  {
    const ok = (x: number, y: number) => { const k = w.cellOf(x, y); return w.clearance[k] > 0.15 && !gravel[k] && !shovN[k] && !stakes.some(q => Math.hypot(q[0] - x, q[1] - y) < 2.2); };
    for (const l of CLEAR.lanes) for (let i = 1; i < l.pts.length; i++) {
      const [ax, ay] = l.pts[i - 1], [bx, by] = l.pts[i], L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L, ny = (bx - ax) / L, off = l.width / 2 + 0.45;
      for (let d = 0; d <= L; d += 3.2) for (const sd of [1, -1]) { const x = ax + ((bx - ax) * d) / L + nx * off * sd, y = ay + ((by - ay) * d) / L + ny * off * sd; if (ok(x, y)) stakes.push([x, y]); }
    }
    const T = outsetPoly(TURNAROUND, 0.45);
    for (let i = 0; i < T.length; i++) { const [ax, ay] = T[i], [bx, by] = T[(i + 1) % T.length], L = Math.hypot(bx - ax, by - ay); for (let d = 0; d <= L; d += 3.2) { const x = ax + ((bx - ax) * d) / L, y = ay + ((by - ay) * d) / L; if (ok(x, y)) stakes.push([x, y]); } }
  }
  // the plow and the shovel
  let load = 0, pushing = 0; const spillAcc = [0, 0, 0];
  const L2W = (lon: number, lat: number, x: number, y: number, h: number): Pt => [x + Math.cos(h) * lon - Math.sin(h) * lat, y + Math.sin(h) * lon + Math.cos(h) * lat];
  function plowStep(dt: number) {
    const p = ctx.pose(); if (p.v < 0.15) return;
    const { lon0, lon1, half } = BLADE, c = Math.cos(p.h), s = Math.sin(p.h), R = Math.hypot(lon1 + 0.2, half + 0.2);
    const i0 = Math.max(0, Math.floor((p.x - R) / CELL)), i1 = Math.min(w.NX - 1, Math.floor((p.x + R) / CELL)), j0 = Math.max(0, Math.floor((p.y - R) / CELL)), j1 = Math.min(w.NY - 1, Math.floor((p.y + R) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * w.NX + i; if (!gravel[k] || clr[k]) continue;
      const dx = (i + 0.5) * CELL - p.x, dy = (j + 0.5) * CELL - p.y, lon = dx * c + dy * s, lat = -dx * s + dy * c;
      if (lon >= lon0 - 0.25 && lon <= lon1 + 0.1 && Math.abs(lat) <= half + 0.12) { if (clearCell(k)) { load += 0.1; pushing = 0.35; } }
    }
    lc.save(); lc.clip(gravelPath); lc.translate(p.x, p.y); lc.rotate(p.h);
    lc.globalCompositeOperation = "source-atop"; lc.fillStyle = "rgba(112,138,182,0.05)"; lc.fillRect(lon0 - 0.3, -half - 0.16, 0.5, 0.16); lc.fillRect(lon0 - 0.3, half, 0.5, 0.16);   // a little wall of snow each side of the cut
    lc.globalCompositeOperation = "destination-out"; lc.fillStyle = "#000"; lc.fillRect(lon0 - 0.25, -half, lon1 - lon0 + 0.25, half * 2); lc.restore();
    // the snow rolls off the ends of the blade into banks, or off the front when it's pushed to the edge
    const spills: [number, number][] = [[lon0 + 0.15, -(half + 0.45)], [lon0 + 0.15, half + 0.45], [lon1 + 0.55, 0]];
    spills.forEach(([lo, la], n) => {
      if (load <= 0) return; const [sx, sy] = L2W(lo, la, p.x, p.y, p.h); if (inClear(sx, sy)) return;
      const amt = Math.min(load, load * (n === 2 ? 5 : 2.4) * dt + 0.01 * dt); load -= amt; spillAcc[n] += amt;
      if (spillAcc[n] > 0.035) { const r = 0.24 + Math.min(0.42, spillAcc[n] * 1.6); stampBank(g, sx + (Math.random() - 0.5) * 0.3, sy + (Math.random() - 0.5) * 0.3, r); spillAcc[n] = 0; }
    });
  }
  let scoop = 0, tossT = 0; const tossed: { x: number; y: number; vx: number; vy: number; t: number }[] = [];
  function shovelStep(moved: number, dt: number) {
    if (moved < 0.002) return;
    const c = Math.cos(pat.a), s = Math.sin(pat.a), cx = pat.x + c * 0.62, cy = pat.y + s * 0.62;
    const i0 = Math.max(0, Math.floor((cx - 0.9) / CELL)), i1 = Math.min(w.NX - 1, Math.floor((cx + 0.9) / CELL)), j0 = Math.max(0, Math.floor((cy - 0.9) / CELL)), j1 = Math.min(w.NY - 1, Math.floor((cy + 0.9) / CELL));
    let got = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * w.NX + i; if (clr[k] || (!plowN[k] && !shovN[k])) continue; const dx = (i + 0.5) * CELL - pat.x, dy = (j + 0.5) * CELL - pat.y, lon = dx * c + dy * s, lat = -dx * s + dy * c; if (lon > 0.15 && lon < 1.0 && Math.abs(lat) < 0.46) { if (clearCell(k)) got++; } }
    lc.save(); lc.translate(cx, cy); lc.rotate(pat.a); lc.globalCompositeOperation = "destination-out"; lc.fillStyle = "#000"; lc.beginPath(); lc.roundRect(-0.3, -0.42, 0.62, 0.84, 0.18); lc.fill(); lc.restore();
    if (got) { scoop = Math.min(1, scoop + got * 0.12); ctx.buzz(); }
    tossT -= dt;
    if (scoop >= 1 && tossT <= 0) {   // a full shovel: toss it off to whichever side isn't walk or gravel
      tossT = 0.5; scoop = 0; ctx.snd.click();
      for (const sd of [1, -1]) { const tx = pat.x - s * sd * 1.3 + c * 0.3, ty = pat.y + c * sd * 1.3 + s * 0.3; if (!inClear(tx, ty)) { for (let n = 0; n < 6; n++) tossed.push({ x: cx, y: cy, vx: (tx - cx) * (1.6 + Math.random()), vy: (ty - cy) * (1.6 + Math.random()), t: 0 }); stampBank(g, tx, ty, 0.3 + Math.random() * 0.15); break; } }
    }
  }
  // Pat on and off the tractor
  type Mode = "seat" | "off" | "foot" | "on";
  let mode: Mode = "seat", sideAt: Pt = [0, 0], toldPlow = false, toldShov = false, stopT = 0, autoReady: "" | "hop" | "climb" = "", linda = 0, footT = 0;
  const seatPt = (): Pt => { const p = ctx.pose(); return [p.x - Math.cos(p.h) * 0.44, p.y - Math.sin(p.h) * 0.44]; };
  const sidePt = (): Pt => { const p = ctx.pose(); return [p.x - Math.cos(p.h) * 0.3 + Math.sin(p.h) * 1.4, p.y - Math.sin(p.h) * 0.3 - Math.cos(p.h) * 1.4]; };
  const blocks = (): [number, number, number][] => { const p = ctx.pose(); return [[p.x, p.y, 0.9], [...L2W(1.38, 0, p.x, p.y, p.h), 0.42], [...L2W(1.38, -0.8, p.x, p.y, p.h), 0.42], [...L2W(1.38, 0.8, p.x, p.y, p.h), 0.42]] as [number, number, number][]; };
  const onFoot = () => mode !== "seat";
  // autopilot state (tests)
  let legI = 0, legAt = 0, goalK = -1, goalT = 0, lastC = 0, stuckT = 0, unstickT = 0, stuckAt: Pt = [0, 0];
  function nearestTodo(fx: number, fy: number, which: "plow" | "shovel" | "any") { let bk = -1, bd = Infinity; for (let k = 0; k < w.N; k++) { if (clr[k] || skip[k]) continue; if (which === "plow" ? !plowN[k] : which === "shovel" ? !shovN[k] : !plowN[k] && !shovN[k]) continue; const d = Math.hypot(w.cellX(k) - fx, w.cellY(k) - fy); if (d < bd) { bd = d; bk = k; } } return bk; }
  return {
    deck: 0.3, catMode: "deck", noTufts: true, drawTree: base.drawTree,
    hold: () => onFoot(), patOff: () => true,
    speedCap: () => (pushing > 0 ? 3.4 : undefined),   // a blade full of snow is slow going
    step(dt) {
      const ph = ctx.phase(), p = ctx.pose(), playing = ph === "play" || ph === "ready";
      pushing = Math.max(0, pushing - dt);
      base.step(dt, onFoot() ? pat : null, null); catHi.step(dt, onFoot() ? pat : null);
      stopT = Math.abs(p.v) < 0.3 ? stopT + dt : 0; footT = onFoot() ? footT + dt : 0;
      for (const q of tossed) { q.t += dt; q.x += q.vx * dt * (1 - q.t); q.y += q.vy * dt * (1 - q.t); } for (let i = tossed.length - 1; i >= 0; i--) if (tossed[i].t > 0.5) tossed.splice(i, 1);
      if (ph === "scene") { linda = Math.min(1, linda + dt * 1.5); return; }
      if (!playing) return;
      if (mode === "seat") plowStep(dt);
      else if (mode === "off") { if (walker.go(sideAt, dt)) { mode = "foot"; } }
      else if (mode === "on") { if (walker.go(sideAt, dt) && walker.go(seatPt(), dt)) { mode = "seat"; } }
      else { const moved = walker.step(dt, ctx.stick(), blocks()); shovelStep(moved, dt); }
      if (!toldPlow && plowPct() >= 0.95) { toldPlow = true; ctx.snd.coin(); ctx.say(shovPct() >= 0.95 ? "All Clear!" : mode === "seat" ? "Driveway's Done! Stop And Tap Pat" : "Driveway's Done!"); }
      if (!toldShov && shovPct() >= 0.95) { toldShov = true; ctx.snd.coin(); if (plowPct() < 0.95) ctx.say("Walk's Done! Back On The Tractor"); }
    },
    tap(wx, wy) {
      if (!playing(ctx)) return;
      const p = ctx.pose();
      if (mode === "seat") { if (Math.hypot(wx - p.x, wy - p.y) < 2.0) { if (Math.abs(p.v) > 0.6) { ctx.say("Stop First"); return; } const [sx, sy] = seatPt(); pat.x = sx; pat.y = sy; pat.a = p.h - Math.PI / 2; sideAt = sidePt(); mode = "off"; autoReady = ""; ctx.snd.click(); } return; }
      if (mode === "foot" && Math.hypot(wx - p.x, wy - p.y) < 2.2) { if (Math.hypot(pat.x - p.x, pat.y - p.y) > 3.2) { ctx.say("Walk Back To The Tractor"); return; } sideAt = sidePt(); mode = "on"; autoReady = ""; ctx.snd.click(); }
    },
    done: () => plowPct() >= 0.95 && shovPct() >= 0.95,
    drawGround(c, time) {
      base.outside(c);
      c.drawImage(layer, bx0, by0, bx1 - bx0, by1 - by0);
      // the spots for the shovel (the walk and round Linda's car) tinted blue, brighter once the plowing's done
      if (shovPct() < 0.95 && (ctx.phase() === "play" || ctx.phase() === "ready")) {
        const strong = plowPct() >= 0.95 || onFoot(), a = strong ? 0.2 + 0.12 * (0.5 + 0.5 * Math.sin(time * 4)) : 0.14;
        c.save(); c.fillStyle = c.strokeStyle = `rgba(70,130,215,${a.toFixed(3)})`; c.lineCap = "round"; c.lineJoin = "round";
        c.lineWidth = WALK.width; c.beginPath(); WALK.pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke();
        pathPoly(c, RING); c.fill();
        c.setLineDash([0.35, 0.25]); c.lineWidth = 0.07; c.strokeStyle = `rgba(50,105,190,${(a * 2.4).toFixed(3)})`; pathPoly(c, RING); c.stroke(); c.restore();
      }
      // nearly there: the last patches glow
      const which = mode === "seat" ? (plowPct() >= 0.8 && plowPct() < 0.95 ? plowN : null) : shovPct() >= 0.8 && shovPct() < 0.95 ? shovN : plowPct() < 0.95 && plowPct() >= 0.88 ? plowN : null;
      if (which && ctx.phase() === "play") { const pu = 0.5 + 0.5 * Math.sin(time * 5); c.fillStyle = `rgba(255,214,64,${(0.3 + 0.3 * pu).toFixed(3)})`; c.beginPath(); for (let k = 0; k < w.N; k++) if (which[k] && !clr[k]) { c.moveTo(w.cellX(k) + 0.32, w.cellY(k)); c.arc(w.cellX(k), w.cellY(k), 0.32, 0, 7); } c.fill(); }
    },
    drawBelow(c, time) {
      for (const [x, y] of stakes) { c.fillStyle = "rgba(60,80,110,0.25)"; c.beginPath(); c.ellipse(x + 0.16, y + 0.18, 0.16, 0.09, 0.6, 0, 7); c.fill(); c.fillStyle = "#f26b1d"; c.strokeStyle = "#7a2f08"; c.lineWidth = 0.04; c.beginPath(); c.arc(x, y, 0.15, 0, 7); c.fill(); c.stroke(); c.fillStyle = "#fff3e6"; c.beginPath(); c.arc(x - 0.04, y - 0.04, 0.05, 0, 7); c.fill(); }
      if (mode === "seat" && plowPct() >= 0.95 && shovPct() < 0.95 && ctx.phase() === "play") { const p = ctx.pose(), u = (time * 1.4) % 1; c.strokeStyle = `rgba(255,214,64,${(0.9 * (1 - u)).toFixed(3)})`; c.lineWidth = 0.14; c.beginPath(); c.arc(p.x, p.y, 1.4 + u * 1.4, 0, 7); c.stroke(); }
      drawSnowCar(c, CAR.x, CAR.y, -Math.PI / 2, CAR.color, 1, CAR.len, CAR.wid); const p = ctx.pose(); drawPlow(c, p.x, p.y, p.h, ctx.up.paint === "red" ? { body: "#d8322a", hood: "#e8443a", trim: "#8e1f19" } : ctx.up.paint === "yellow" ? { body: "#f2b81d", hood: "#f8c935", trim: "#a87c0c" } : { body: "#f26b1d", hood: "#f47c20", trim: "#b04e12" }, load, time); },
    drawAbove(c, time) {
      const p = ctx.pose();
      if (mode === "seat") drawPatSeated(c, p.x, p.y, p.h, 0, time, ctx.phase() === "scene" || ctx.phase() === "over" ? 1 : 0);
      else { const pose: WinterPose = { walk: pat.v > 0.2 ? pat.ph : 0, carry: "shovel", scoop, wave: (ctx.phase() === "scene" || ctx.phase() === "over") ? 1 : 0 }; drawWinterPat(c, pat.x, pat.y, pat.a, pose, time); }
      for (const q of tossed) { c.fillStyle = `rgba(250,252,255,${(1 - q.t * 1.6).toFixed(3)})`; c.beginPath(); c.arc(q.x, q.y, 0.08, 0, 7); c.fill(); }
      if (linda > 0) { c.globalAlpha = linda; drawLindaWinter(c, STEPS[0] + 0.4, STEPS[1] - 0.25, onFoot() ? Math.atan2(pat.y - STEPS[1], pat.x - STEPS[0]) : 0.6, time, { mug: true }); c.globalAlpha = 1; }
    },
    drawTop(c) { base.top(c); },
    drawScreen(c, sx, sy, CW, MH, time) {
      base.screen(c, CW, MH, time); catHi.draw(c, sx, sy);
      const ph = ctx.phase(); if (ph !== "play" && ph !== "ready") return;
      const p = ctx.pose();
      if (mode === "seat" && plowPct() >= 0.95 && shovPct() < 0.95) hint(c, stopT > 0.3 ? "Step 2 Of 2: Tap Pat To Hop Off And Shovel" : "Step 2 Of 2: Stop And Tap Pat To Shovel", CW, MH);
      else if (mode === "seat" && plowPct() < 0.95 && (ctx.simT() < 7 || stopT > 1.5) && !(stopT > 1.6 && nearestTodo(p.x, p.y, "shovel") >= 0 && Math.hypot(w.cellX(nearestTodo(p.x, p.y, "shovel")) - p.x, w.cellY(nearestTodo(p.x, p.y, "shovel")) - p.y) < 9)) hint(c, "Step 1 Of 2: Plow Between The Orange Stakes", CW, MH);
      else if (mode === "foot" && shovPct() < 0.95 && footT < 5) hint(c, "Walk Over The Blue Snow To Shovel It", CW, MH);
      else if (mode === "seat" && stopT > 0.4 && shovPct() < 0.95 && (plowPct() >= 0.95 || (stopT > 1.6 && nearestTodo(p.x, p.y, "shovel") >= 0 && Math.hypot(w.cellX(nearestTodo(p.x, p.y, "shovel")) - p.x, w.cellY(nearestTodo(p.x, p.y, "shovel")) - p.y) < 9))) hint(c, "Tap Pat To Hop Off", CW, MH);
      else if (mode === "foot" && plowPct() < 0.95 && (shovPct() >= 0.95 || Math.hypot(pat.x - p.x, pat.y - p.y) < 3)) hint(c, "Tap The Tractor To Climb On", CW, MH);
      // what's left, when it's off screen
      const fx = onFoot() ? pat.x : p.x, fy = onFoot() ? pat.y : p.y, which = onFoot() ? (shovPct() < 0.95 ? "shovel" : plowPct() < 0.95 ? "plow" : null) : plowPct() < 0.95 ? "plow" : shovPct() < 0.95 ? "shovel" : null;
      if (which) { const k = nearestTodo(fx, fy, which); if (k >= 0) edgeArrow(c, sx(w.cellX(k)), sy(w.cellY(k)), sx(fx), sy(fy), CW, MH, time, `${Math.round(Math.hypot(w.cellX(k) - fx, w.cellY(k) - fy))} m`); }
    },
    drawMini(c, ms) {
      base.mini(c);
      for (let k = 0; k < w.N; k++) if ((plowN[k] || shovN[k]) && !clr[k]) { c.fillStyle = shovN[k] ? "#5a8fd6" : "#86aee3"; c.fillRect(w.cellX(k) - 0.4, w.cellY(k) - 0.4, 0.8, 0.8); }
      if (onFoot()) { c.fillStyle = "#b8322a"; c.strokeStyle = "#fff"; c.lineWidth = 0.6 / ms; c.beginPath(); c.arc(pat.x, pat.y, 2 / ms, 0, 7); c.fill(); c.stroke(); }
    },
    holes() { const out: [number, number, number][] = []; if (onFoot()) out.push([pat.x, pat.y, 1.6]); return out; },
    cam() { return onFoot() ? [pat.x + pat.vx * 0.35, pat.y + pat.vy * 0.35] : null; },
    hud: () => ({ lead: { label: plowPct() >= 0.95 ? "Shovelled" : "Plowed", value: `${Math.floor((plowPct() >= 0.95 ? shovPct() : plowPct()) * 100)}%` }, meter: { label: "Big Bumps", value: String(ctx.bumps()), frac: 0, good: ctx.bumps() === 0 }, pct: allPct() }),
    outcome: (o: Outcome) => ({ ...o, pct: allPct(), stars: [o.stars[0], o.stars[1], o.done && o.bumps === 0], extra: { label: "Big Bumps", value: String(o.bumps) }, failLine: `Pat cleared ${Math.floor(allPct() * 100)}% of the snow. Plow the gravel in long runs, then hop off for the walk and round the car.` }),
    banner: ok => { if (ok) { ctx.snd.meow(); } return ok ? "All Dug Out!" : undefined; },
    focus() { const p = ctx.pose(); return [[onFoot() ? pat.x : p.x, onFoot() ? pat.y : p.y], STEPS]; },
    sceneSecs: 4.5,
    autoInput(dt) {
      const p = ctx.pose();
      if (mode === "off" || mode === "on" || autoReady) return [0, 0];
      if (mode === "seat") {
        if (plowPct() >= 0.95 || legI >= PLOW_LEGS.length && nearestTodo(p.x, p.y, "plow") < 0) {
          if (shovPct() >= 0.95) return [0, 0];
          if (Math.hypot(PLOW_PARK[0] - p.x, PLOW_PARK[1] - p.y) > 1.4) return router.tractor(dt, PLOW_PARK[0], PLOW_PARK[1], 4);
          if (Math.abs(p.v) < 0.2) autoReady = "hop"; return [0, 0];
        }
        if (legI < PLOW_LEGS.length) {   // follow the run: aim a little way ahead along it
          const L = PLOW_LEGS[legI];
          while (legAt < L.length - 1 && Math.hypot(L[legAt][0] - p.x, L[legAt][1] - p.y) < 2.0) legAt++;
          if (legAt >= L.length - 1 && Math.hypot(L[L.length - 1][0] - p.x, L[L.length - 1][1] - p.y) < 2.0) { legI++; legAt = 0; return [Math.cos(p.h), Math.sin(p.h)]; }
          const t = L[legAt], dx = t[0] - p.x, dy = t[1] - p.y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d];
        }
        // tidy up what's left, nearest first; give up on a patch that won't clear
        goalT += dt; if (plowC !== lastC) { lastC = plowC; goalT = 0; }
        if (goalK >= 0 && (clr[goalK] || goalT > 6)) { if (!clr[goalK]) for (let q = 0; q < w.N; q++) if (Math.hypot(w.cellX(q) - w.cellX(goalK), w.cellY(q) - w.cellY(goalK)) < 1.2) skip[q] = 1; goalK = -1; goalT = 0; }
        if (goalK < 0) goalK = nearestTodo(p.x + Math.cos(p.h) * 1.4, p.y + Math.sin(p.h) * 1.4, "plow");
        if (goalK < 0) return [0, 0];
        const tx = w.cellX(goalK), ty = w.cellY(goalK), dd = Math.hypot(tx - p.x, ty - p.y), df = Math.abs(wrapA(Math.atan2(ty - p.y, tx - p.x) - p.h));
        if (dd < 3 && df > 0.9 && df < 2.3) return [Math.cos(p.h) * 0.5, Math.sin(p.h) * 0.5];   // inside the turning circle: drive on and come round
        return router.tractor(dt, tx, ty);
      }
      // on foot: the nearest snow still on the walk or round the car (or gravel the blade missed), then back on
      if (shovPct() >= 0.95) { if (plowPct() >= 0.95) return [0, 0]; if (Math.hypot(pat.x - p.x, pat.y - p.y) > 2.4) return router.pat(dt, pat.x, pat.y, p.x, p.y, 1); autoReady = "climb"; return [0, 0]; }
      router.avoid(blocks());
      stuckT = Math.hypot(pat.x - stuckAt[0], pat.y - stuckAt[1]) > 0.3 ? (stuckAt = [pat.x, pat.y], 0) : stuckT + dt;
      if (stuckT > 1.2) { unstickT = 0.6; stuckT = 0; }
      if (unstickT > 0) { unstickT -= dt; return [Math.cos(pat.a + 1.9), Math.sin(pat.a + 1.9)]; }
      goalT += dt; if (shovC !== lastC) { lastC = shovC; goalT = 0; }
      if (goalK >= 0 && (clr[goalK] || goalT > 3)) { if (!clr[goalK]) for (let q = 0; q < w.N; q++) if (shovN[q] && Math.hypot(w.cellX(q) - w.cellX(goalK), w.cellY(q) - w.cellY(goalK)) < 0.8) skip[q] = 1; goalK = -1; goalT = 0; }
      if (goalK < 0 || !shovN[goalK]) goalK = nearestTodo(pat.x + Math.cos(pat.a) * 0.6, pat.y + Math.sin(pat.a) * 0.6, "shovel");
      if (goalK < 0) return [0, 0];
      const tx = w.cellX(goalK), ty = w.cellY(goalK);
      if (Math.hypot(tx - pat.x, ty - pat.y) < 1.4 && router.sight(pat.x, pat.y, tx, ty)) { const d = Math.hypot(tx - pat.x, ty - pat.y) || 1; return [((tx - pat.x) / d) * 0.7, ((ty - pat.y) / d) * 0.7]; }
      return router.pat(dt, pat.x, pat.y, tx, ty);
    },
    debug: () => ({ mode, ready: autoReady, plow: plowPct(), shovel: shovPct(), plowT, shovT, plowC, shovC, legI, pat: [pat.x, pat.y], load, goal: goalK >= 0 ? [w.cellX(goalK), w.cellY(goalK)] : null, left: (() => { const o: number[][] = []; for (let k = 0; k < w.N; k++) if (shovN[k] && !clr[k]) o.push([w.cellX(k), w.cellY(k), skip[k]]); return o; })(), stick: ctx.stick() }),
  };
}

// ════════════════════════════════════════════ Firewood ════════════════════════════════════════════
const LOADS = 3, PER = 4, SWEEP = 0.85, REACH = 4.6;
function woodChore(ctx: ChoreCtx): Chore {
  let loads = 0;
  const base = winterBase(ctx, true, { smoke: () => 0.25 + loads * 0.25 }), router = makeRouter(ctx), catHi = makeCatHi(ctx);
  { const s = U(1062, 700); ctx.place(s[0], s[1], 0); }   // by the barn, facing the woodshed
  const cart = makeCart(ctx), walker = makeWalker(ctx, 2.5, true), pat = walker.wk;
  type Stage = "toBlock" | "walkIn" | "chop" | "gather" | "toHouse" | "unload";
  let stage: Stage = "toBlock", splits = 0, misses = 0, missRun = 0, zw = 0.18, swingT = -1, swingHit = false, splitT = -1, nextT = 0, inCart = 0, stackN = 0, meterT = 0, sub = 0, autoReady: "" | "block" | "steps" = "", autoTapAt = -1;
  const pile: { x: number; y: number; a: number }[] = [];
  const stand: Pt = [BLOCK[0] - 0.78, BLOCK[1]];
  const seatPt = (): Pt => { const p = ctx.pose(); return [p.x - Math.cos(p.h) * 0.44, p.y - Math.sin(p.h) * 0.44]; };
  const meter = () => { const u = (meterT / SWEEP) % 2; return u < 1 ? u : 2 - u; };
  const onFoot = () => stage === "walkIn" || stage === "chop" || stage === "gather" || stage === "unload";
  const deckPath = [U(990, 318), U(990, 298), U(STACK_AT[0] / 0.075 + 18, 262)];
  const stackY = STACK_AT[1] - 0.15;
  function beginWalk(to: Stage) { const [sx, sy] = seatPt(); pat.x = sx; pat.y = sy; pat.a = ctx.pose().h + Math.PI / 2; stage = to; sub = 0; autoReady = ""; ctx.snd.click(); }
  const near = (q: Pt) => { const p = ctx.pose(); return Math.hypot(q[0] - p.x, q[1] - p.y); };
  function chopTap() {
    if (stage !== "chop" || swingT >= 0 || splitT >= 0 || nextT > 0 || splits >= PER) return;
    const m = meter(); swingHit = Math.abs(m - 0.5) <= zw; swingT = 0;
  }
  return {
    catMode: "deck", noTufts: true, deck: 0.62, drawTree: base.drawTree,
    hold: () => onFoot(), patOff: () => true,
    step(dt) {
      const ph = ctx.phase();
      base.step(dt, onFoot() ? pat : null, cart.c); catHi.step(dt, onFoot() ? pat : null);
      if (cart.update(dt)) ctx.shake(0.1);
      if (ph !== "play" && ph !== "ready") return;
      meterT += dt; nextT = Math.max(0, nextT - dt);
      if (stage === "walkIn") { if (walker.go(stand, dt)) { stage = "chop"; pat.a = 0; meterT = 0; } }
      else if (stage === "chop") {
        if (swingT >= 0) {
          swingT += dt;
          if (swingT >= 0.2) {
            swingT = -1;
            if (swingHit) { splitT = 0; splits++; missRun = 0; ctx.snd.bump(); ctx.snd.pop(); ctx.shake(0.08); ctx.floatAt("Crack!", BLOCK[0], BLOCK[1] - 0.9, "#fff4c2"); ctx.buzz(); }
            else { misses++; missRun++; if (missRun >= 2) zw = Math.min(0.3, zw + 0.05); ctx.snd.bump(); ctx.floatAt("Thunk! Try Again", BLOCK[0], BLOCK[1] - 0.9, "#ffd2cc"); nextT = 0.25; }
          }
        }
        if (splitT >= 0) { splitT += dt; if (splitT >= 0.4) { splitT = -1; for (const s of [-1, 1]) pile.push({ x: BLOCK[0] + 0.55 + Math.random() * 0.35, y: BLOCK[1] + s * 0.35 + (Math.random() - 0.5) * 0.25, a: Math.random() * 3 }); nextT = splits >= PER ? 0.3 : 0.3; } }
        if (splits >= PER && splitT < 0 && swingT < 0 && nextT <= 0) { stage = "gather"; sub = 0; }
      }
      else if (stage === "gather") {   // scoop up the pile, carry it to the cart, toss it in, climb back on
        if (sub === 0) { if (walker.go([BLOCK[0] + 0.55, BLOCK[1] + 0.05], dt)) { sub = 1; pile.length = 0; ctx.snd.pop(); } }
        else if (sub === 1) { if (walker.go(cart.side(), dt)) { sub = 2; inCart = PER * 2; ctx.snd.clank(); } }
        else if (walker.go(seatPt(), dt)) { stage = "toHouse"; splits = 0; ctx.say("Off To The House!"); }
      }
      else if (stage === "unload") {   // an armload up the steps to the stack by the door, then back
        if (sub === 0) { if (walker.go(cart.side(), dt)) { sub = 1; inCart = 0; ctx.snd.pop(); } }
        else if (sub >= 1 && sub <= deckPath.length) { if (walker.go(deckPath[sub - 1], dt, 2.8)) sub++; }
        else if (sub === deckPath.length + 1) { stackN += PER * 2; loads++; ctx.snd.clank(); ctx.floatAt(`${loads} / ${LOADS}`, pat.x, pat.y - 1, "#fff4c2"); sub++; if (loads >= LOADS) ctx.say("The Woodbox Is Full!"); }
        else if (sub < deckPath.length * 2 + 2) { const back = deckPath[deckPath.length * 2 + 1 - sub]; if (walker.go(back, dt, 2.8)) sub++; }
        else if (walker.go(seatPt(), dt)) { stage = loads >= LOADS ? "toHouse" : "toBlock"; if (loads < LOADS) ctx.say("Back For Another Load"); }
      }
    },
    tap(wx, wy) {
      if (!playing(ctx)) return;
      if (stage === "chop") { chopTap(); return; }
      if (loads >= LOADS) return;
      const p = ctx.pose();
      if (stage === "toBlock" && Math.hypot(wx - BLOCK[0], wy - BLOCK[1]) < 1.8) { if (near(BLOCK) > REACH) { ctx.say("Pull Up Closer To The Block"); return; } if (Math.abs(p.v) > 0.6) { ctx.say("Stop First"); return; } beginWalk("walkIn"); return; }
      if (stage === "toHouse" && (Math.hypot(wx - STEPS[0], wy - STEPS[1]) < 2 || (wx > STACK_AT[0] - 0.5 && wx < STACK_AT[0] + STACK_LEN + 0.5 && Math.abs(wy - stackY) < 1.2))) { if (near(STEPS) > REACH) { ctx.say("Pull Up Closer To The Steps"); return; } if (Math.abs(p.v) > 0.6) { ctx.say("Stop First"); return; } beginWalk("unload"); }
    },
    done: () => loads >= LOADS && stage === "toHouse",
    drawGround(c, time) {
      base.outside(c);
      drawWoodpile(c, WOODPILE.at[0], WOODPILE.at[1], 0, WOODPILE.len, WOODPILE.depth);
      drawBlock(c, BLOCK[0], BLOCK[1], stage !== "chop");
      if (stage === "chop" && splits < PER) { const sp = splitT >= 0 ? Math.min(1, splitT / 0.25) : 0; drawRound(c, BLOCK[0], BLOCK[1], 0.24, sp); }
      for (const q of pile) drawSplit(c, q.x, q.y, q.a, 0.5);
      const ph = ctx.phase();
      if (ph === "play" || ph === "ready") { if (stage === "toBlock") ring(c, BLOCK[0], BLOCK[1], 1.1, time); if (stage === "toHouse" && loads < LOADS) ring(c, STEPS[0], STEPS[1], 1.0, time); }
    },
    drawBelow(c) { drawSnowCar(c, CAR.x, CAR.y, -Math.PI / 2, CAR.color, 0.3, CAR.len, CAR.wid); drawCart(c, cart.c.ax, cart.c.ay, cart.c.a, cart.TONGUE, {}); drawWoodInCart(c, cart.c.ax, cart.c.ay, cart.c.a, inCart); },
    drawAbove(c, time) {
      const p = ctx.pose();
      if (!onFoot()) { drawPatSeated(c, p.x, p.y, p.h, 0, time, ctx.phase() === "scene" || ctx.phase() === "over" ? 1 : 0); return; }
      if (pat.y < U(0, 306)[1] && stage === "unload") return;   // up on the deck: drawn over it
      drawPatNow(c, time);
    },
    drawTop(c, time) {
      drawWoodStack(c, STACK_AT[0], stackY, STACK_LEN, stackN);
      if (onFoot() && stage === "unload" && pat.y < U(0, 306)[1]) drawPatNow(c, time);
      base.top(c);
    },
    drawScreen(c, sx, sy, CW, MH, time) {
      base.screen(c, CW, MH, time); catHi.draw(c, sx, sy);
      const ph = ctx.phase(); if (ph !== "play" && ph !== "ready") return;
      const p = ctx.pose(), stopped = Math.abs(p.v) < 1.2;
      if (stage === "chop") {   // the swing meter over Pat: tap when the marker's in the green
        const mx = sx(pat.x), my = Math.max(40, sy(pat.y) - 74), bw = Math.min(170, CW - 60), m = meter();
        c.save(); c.fillStyle = "rgba(255,255,255,0.95)"; c.shadowColor = "rgba(0,0,0,0.22)"; c.shadowBlur = 8; c.beginPath(); c.roundRect(mx - bw / 2 - 6, my - 13, bw + 12, 26, 13); c.fill(); c.restore();
        c.fillStyle = "#e3e7ea"; c.beginPath(); c.roundRect(mx - bw / 2, my - 7, bw, 14, 7); c.fill();
        c.fillStyle = "#57b33a"; c.beginPath(); c.roundRect(mx - bw * zw, my - 7, bw * zw * 2, 14, 7); c.fill();
        const kx = mx - bw / 2 + bw * m; c.fillStyle = "#2b3441"; c.beginPath(); c.roundRect(kx - 3, my - 11, 6, 22, 3); c.fill();
        hint(c, splits === 0 && misses === 0 ? "Tap The Map When It's In The Green" : `Split ${splits} Of ${PER}`, CW, MH);
      } else if (stage === "toBlock" && stopped && near(BLOCK) <= REACH) hint(c, "Tap The Chopping Block", CW, MH);
      else if (stage === "toHouse" && loads < LOADS && stopped && near(STEPS) <= REACH) hint(c, "Tap The Steps To Unload", CW, MH);
      const tgt = stage === "toBlock" ? BLOCK : stage === "toHouse" && loads < LOADS ? STEPS : null;
      if (tgt) edgeArrow(c, sx(tgt[0]), sy(tgt[1]), sx(p.x), sy(p.y), CW, MH, time, `${Math.round(near(tgt))} m`);
    },
    drawMini(c, ms) {
      base.mini(c);
      const dot = (q: Pt, col: string, on: boolean) => { c.fillStyle = on ? "#ffcf2e" : col; c.strokeStyle = "#fff"; c.lineWidth = 0.6 / ms; c.beginPath(); c.arc(q[0], q[1], (on ? 2.8 : 2) / ms, 0, 7); c.fill(); c.stroke(); };
      dot(BLOCK, "#7a4a22", stage === "toBlock"); dot(STEPS, "#7a4a22", stage === "toHouse" && loads < LOADS);
    },
    holes() { const out: [number, number, number][] = [[cart.c.ax, cart.c.ay, 1.8]]; if (onFoot()) out.push([pat.x, pat.y, 1.6]); return out; },
    cam() { return null; },
    hud: () => ({ lead: { label: "Woodbox", value: `${loads} / ${LOADS}` }, meter: { label: "Misses", value: String(misses), frac: 0, good: misses <= 2 }, pct: Math.min(1, (loads + (stage === "toHouse" || stage === "unload" ? 0.6 : (splits / PER) * 0.5)) / LOADS) }),
    outcome: (o: Outcome) => ({ ...o, stars: [o.stars[0], o.stars[1], o.done && misses <= 2], extra: { label: "Missed Swings", value: String(misses) }, failLine: `Pat stacked ${loads} of ${LOADS} loads. Pull up right beside the block and the steps so he only has a few steps to walk.` }),
    banner: ok => (ok ? "Warm As Toast!" : undefined),
    focus() { return [[STACK_AT[0], STACK_AT[1]], [STEPS[0], STEPS[1]], [ctx.pose().x, ctx.pose().y]]; },
    autoInput(dt) {
      if (stage === "chop") { const m = meter(); if (autoTapAt < 0) autoTapAt = 0.5 + (Math.random() - 0.5) * zw * 1.2; if (Math.abs(m - autoTapAt) < 0.03 && swingT < 0 && splitT < 0 && nextT <= 0) { chopTap(); autoTapAt = -1; } return [0, 0]; }
      if (onFoot() || autoReady || loads >= LOADS) return [0, 0];
      const p = ctx.pose(), tgt = stage === "toBlock" ? BLOCK : STEPS, d = Math.hypot(tgt[0] - p.x, tgt[1] - p.y);
      if (d < REACH - 1.3) { if (Math.abs(p.v) < 0.25) autoReady = stage === "toBlock" ? "block" : "steps"; return [0, 0]; }
      return router.tractor(dt, tgt[0], tgt[1], 5);
    },
    debug: () => ({ stage, loads, splits, misses, ready: autoReady, tapAt: autoReady === "block" ? BLOCK : autoReady === "steps" ? STEPS : null, meter: meter(), zw, cart: cart.c }),
  };
  function drawPatNow(c: CanvasRenderingContext2D, time: number) {
    const sw = swingT >= 0 ? Math.min(1, swingT / 0.2) : 0;
    const carry = stage === "chop" ? "axe" : (stage === "gather" && sub >= 1) || (stage === "unload" && sub >= 1 && sub <= deckPath.length) ? "wood" : null;
    const lift = stage === "unload" && pat.y < U(0, 306)[1] ? 0.15 : 0;
    drawWinterPat(c, pat.x, pat.y - lift, pat.a, { walk: pat.v > 0.2 ? pat.ph : 0, carry, swing: sw }, time);
  }
}

// ════════════════════════════════════════════ Christmas Lights ════════════════════════════════════════════
type Strand = { name: string; anchor: Pt; paths: Pt[][]; hung: number; litAt: number };
function lightsChore(ctx: ChoreCtx): Chore {
  const m = ctx.map;
  const base = winterBase(ctx, true, { smoke: () => 0.5 }), router = makeRouter(ctx), catHi = makeCatHi(ctx);
  { const s = U(1100, 128); ctx.place(s[0], s[1], Math.PI / 2); }
  const cart = makeCart(ctx), walker = makeWalker(ctx, 2.5, true), pat = walker.wk;
  // the strands: round the house's eaves, a spiral down the spruce, along the fence, round both apple trees, the barn's eaves
  const lift = (b: { height: number }, ps: Pt[]) => ps.map(p => [p[0], p[1] - b.height * 0.25] as Pt);
  const house = m.buildings.find(b => b.kind === "house"), barn = m.buildings.find(b => b.kind === "barn");
  const housePaths: Pt[][] = [];
  if (house?.wings) { const [ell, main] = house.wings; const M = outsetPoly(lift(house, main), 0.2); housePaths.push([...M, M[0]]); const E = outsetPoly(lift(house, ell), 0.2); housePaths.push([E[1], E[2], E[3], E[0]]); }
  const barnR = barn ? outsetPoly(lift(barn, barn.poly), 0.16) : [];
  const spiral = (t: Tree | undefined, turns: number, r0: number, r1: number, step = 0.42): Pt[] => { if (!t) return []; const out: Pt[] = [], n = Math.round((turns * Math.PI * 2) / step); for (let k = 0; k <= n; k++) { const a = k * step, r = t.r * (r0 + ((r1 - r0) * k) / n); out.push([t.x + Math.cos(a) * r, t.y + Math.sin(a) * r * 0.92]); } return out; };
  const spruce = m.trees.find(t => t.kind === "spruce" && Math.hypot(t.x - U(1108, 408)[0], t.y - U(1108, 408)[1]) < 1), apples = m.trees.filter(t => t.kind === "fruit");
  const strands: Strand[] = [
    { name: "The House", anchor: U(1030, 196), paths: housePaths, hung: 0, litAt: 5 },
    { name: "The Spruce", anchor: U(1090, 424), paths: [spiral(spruce, 2.6, 0.95, 0.2, 0.5)], hung: 0, litAt: 3 },
    { name: "The Fence", anchor: U(888, 395), paths: [UL([[855, 334], [887, 455]]).map(p => [p[0], p[1] - 0.05] as Pt)], hung: 0, litAt: 4 },
    { name: "The Apple Tree", anchor: U(1012, 704), paths: [spiral(apples[0], 2.2, 0.3, 0.9, 0.55)], hung: 0, litAt: 2 },
    { name: "The Other Apple Tree", anchor: U(1082, 692), paths: [spiral(apples[1], 2.2, 0.3, 0.9, 0.55)], hung: 0, litAt: 1 },
    { name: "The Barn", anchor: U(1135, 700), paths: barnR.length ? [[...barnR, barnR[0]]] : [], hung: 0, litAt: 0 },
  ];
  const ORDER = [...strands].sort((a, b) => a.litAt - b.litAt), LIT0 = 1.3, LIT_GAP = 0.8, HANG_T = 2.4, RCH = 4.8;
  type Mode = "seat" | "toCart" | "toSpot" | "hang" | "back";
  let mode: Mode = "seat", cur = -1, hangT = 0, sceneT = 0, autoReady = -1, bumps = 0;
  const seatPt = (): Pt => { const p = ctx.pose(); return [p.x - Math.cos(p.h) * 0.44, p.y - Math.sin(p.h) * 0.44]; };
  const onFoot = () => mode !== "seat";
  const hungN = () => strands.filter(s => s.hung >= 1).length;
  const nearest = () => { const p = ctx.pose(); let bi = -1, bd = Infinity; strands.forEach((s, i) => { if (s.hung >= 1 || i === cur) return; const d = Math.hypot(s.anchor[0] - p.x, s.anchor[1] - p.y); if (d < bd) { bd = d; bi = i; } }); return { i: bi, d: bd }; };
  const litOf = (s: Strand) => clamp((sceneT - (LIT0 + s.litAt * LIT_GAP)) / 0.35, 0, 1);
  return {
    catMode: "deck", noTufts: true, deck: 0.62, drawTree: base.drawTree,
    hold: () => onFoot(), patOff: () => true,
    step(dt) {
      const ph = ctx.phase();
      base.step(dt, onFoot() ? pat : null, cart.c); catHi.step(dt, onFoot() ? pat : null);
      if (cart.update(dt) && ph === "play") { bumps++; ctx.shake(0.1); }
      if (ph === "scene" || ph === "over") {   // dark, and on they come one by one
        const was = sceneT; sceneT += dt;
        for (const s of strands) { const at = LIT0 + s.litAt * LIT_GAP; if (was < at && sceneT >= at) ctx.snd.star(Math.min(2, Math.floor(s.litAt / 2))); }
        const allAt = LIT0 + 5 * LIT_GAP + 0.6; if (was < allAt && sceneT >= allAt) { ctx.snd.chime(); ctx.snd.meow(); }
        return;
      }
      if (ph !== "play" && ph !== "ready") return;
      if (mode === "toCart") { if (walker.go(cart.side(), dt)) { mode = "toSpot"; ctx.snd.pop(); } }
      else if (mode === "toSpot") { if (walker.go(strands[cur].anchor, dt)) { mode = "hang"; hangT = 0; } }
      else if (mode === "hang") {
        const s = strands[cur], before = s.hung; hangT += dt; s.hung = Math.min(1, hangT / HANG_T);
        if (Math.floor(before * 12) !== Math.floor(s.hung * 12)) ctx.snd.click();
        const c0 = s.paths[0]?.[Math.min(s.paths[0].length - 1, Math.floor(s.hung * (s.paths[0].length - 1)))]; if (c0) pat.a = Math.atan2(c0[1] - pat.y, c0[0] - pat.x);
        if (s.hung >= 1) { mode = "back"; ctx.snd.coin(); ctx.floatAt(`${hungN()} / ${strands.length}`, s.anchor[0], s.anchor[1] - 1, "#fff4c2"); }
      } else if (mode === "back") { if (walker.go(seatPt(), dt)) { mode = "seat"; cur = -1; } }
    },
    tap(wx, wy) {
      if (!playing(ctx) || mode !== "seat") return;
      let bi = -1, bd = 2.2; strands.forEach((s, i) => { if (s.hung >= 1) return; const d = Math.hypot(s.anchor[0] - wx, s.anchor[1] - wy); if (d < bd) { bd = d; bi = i; } });
      if (bi < 0) return;
      const p = ctx.pose(); if (Math.hypot(strands[bi].anchor[0] - p.x, strands[bi].anchor[1] - p.y) > RCH) { ctx.say("Pull Up Closer"); return; } if (Math.abs(p.v) > 0.6) { ctx.say("Stop First"); return; }
      const [sx, sy] = seatPt(); pat.x = sx; pat.y = sy; pat.a = p.h + Math.PI / 2; cur = bi; mode = "toCart"; autoReady = -1; ctx.snd.click();
    },
    done: () => hungN() === strands.length && mode === "seat",
    drawGround(c, time) {
      base.outside(c);
      const ph = ctx.phase();
      if (ph === "play" || ph === "ready") strands.forEach((s, i) => { if (s.hung < 1 && i !== cur) { ring(c, s.anchor[0], s.anchor[1], 1.0, time + i); drawLightBox(c, s.anchor[0], s.anchor[1], time); } });
    },
    drawBelow(c) {
      drawSnowCar(c, CAR.x, CAR.y, -Math.PI / 2, CAR.color, 0.3, CAR.len, CAR.wid);
      drawCart(c, cart.c.ax, cart.c.ay, cart.c.a, cart.TONGUE, {});
      const boxes = strands.filter((s, i) => s.hung === 0 && (i !== cur || mode === "toCart")).length;
      c.save(); c.translate(cart.c.ax, cart.c.ay); c.rotate(cart.c.a); for (let k = 0; k < boxes; k++) { c.fillStyle = "#c9a46a"; c.fillRect(-0.62 + (k % 3) * 0.42, -0.4 + Math.floor(k / 3) * 0.42, 0.36, 0.34); c.strokeStyle = "rgba(90,60,30,0.5)"; c.lineWidth = 0.02; c.strokeRect(-0.62 + (k % 3) * 0.42, -0.4 + Math.floor(k / 3) * 0.42, 0.36, 0.34); } c.restore();
    },
    drawAbove(c, time) {
      const p = ctx.pose();
      if (!onFoot()) { drawPatSeated(c, p.x, p.y, p.h, 0, time, ctx.phase() === "scene" || ctx.phase() === "over" ? 1 : 0); return; }
      drawWinterPat(c, pat.x, pat.y, pat.a, { walk: pat.v > 0.2 && mode !== "hang" ? pat.ph : 0, carry: mode === "toSpot" ? "lights" : null, reach: mode === "hang" ? 1 : 0 }, time);
    },
    drawTop(c, time) {
      const night = ctx.phase() === "scene" || ctx.phase() === "over";
      for (const s of strands) for (const path of s.paths) drawStrand(c, path, s.hung, night ? litOf(s) : 0, time);
      if (mode === "hang" && cur >= 0) { const s = strands[cur], path = s.paths[0]; if (path?.length) { const q = path[Math.min(path.length - 1, Math.floor(s.hung * (path.length - 1)))]; c.strokeStyle = "rgba(31,58,28,0.8)"; c.lineWidth = 0.03; c.beginPath(); c.moveTo(pat.x, pat.y); c.lineTo(q[0], q[1]); c.stroke(); } }
      if (night) drawLindaWinter(c, STEPS[0] + 0.3, STEPS[1] - 0.2, -1.2, time, { wave: 1 });
      base.top(c);
    },
    drawScreen(c, sx, sy, CW, MH, time) {
      const ph = ctx.phase(), night = ph === "scene" || ph === "over";
      if (night) {   // night falls, then the lights: the glow on top of the dark
        const k = clamp(sceneT / 1.2, 0, 1); c.save(); c.fillStyle = `rgba(8,14,40,${(0.5 * k).toFixed(3)})`; c.fillRect(0, 0, CW, MH);
        const S = sx(1) - sx(0); c.translate(sx(0), sy(0)); c.scale(S, S); c.globalCompositeOperation = "lighter";
        for (const s of strands) { const l = litOf(s); if (l > 0) for (const path of s.paths) { drawStrand(c, path, 1, l, time, true); } }
        c.globalCompositeOperation = "source-over"; for (const s of strands) { const l = litOf(s); if (l > 0) for (const path of s.paths) drawStrand(c, path, 1, l, time); }
        c.restore(); drawSnowfall(c, CW, MH, time, 70, 0.75);
        return;
      }
      base.screen(c, CW, MH, time); catHi.draw(c, sx, sy);
      if (ph !== "play" && ph !== "ready") return;
      const p = ctx.pose(), n = nearest();
      if (mode === "seat" && n.i >= 0 && n.d <= RCH && Math.abs(p.v) < 1.2) hint(c, "Tap The Box Of Lights", CW, MH);
      if (mode === "seat" && n.i >= 0) { const s = strands[n.i]; edgeArrow(c, sx(s.anchor[0]), sy(s.anchor[1]), sx(p.x), sy(p.y), CW, MH, time, `${Math.round(n.d)} m`); }
    },
    drawMini(c, ms) { base.mini(c); strands.forEach(s => { if (s.hung >= 1) return; c.fillStyle = "#ffcf2e"; c.strokeStyle = "rgba(90,60,10,0.8)"; c.lineWidth = 0.6 / ms; c.beginPath(); c.arc(s.anchor[0], s.anchor[1], 2.4 / ms, 0, 7); c.fill(); c.stroke(); }); },
    holes() { const out: [number, number, number][] = [[cart.c.ax, cart.c.ay, 1.8]]; if (onFoot()) out.push([pat.x, pat.y, 1.6]); return out; },
    hud: () => ({ lead: { label: "Strands", value: `${hungN()} / ${strands.length}` }, meter: { label: "Big Bumps", value: String(ctx.bumps() + bumps), frac: 0, good: ctx.bumps() + bumps === 0 }, pct: (hungN() + (cur >= 0 ? strands[cur].hung : 0)) / strands.length }),
    outcome: (o: Outcome) => { const b = o.bumps + bumps; return { ...o, bumps: b, stars: [o.stars[0], o.stars[1], o.done && b === 0], extra: { label: "Big Bumps", value: String(b) }, failLine: `Pat hung ${hungN()} of ${strands.length} strands. Stop right beside each box so he only has a few steps to walk.` }; },
    banner: ok => (ok ? "Merry Christmas!" : undefined),
    focus() {   // the camera rides along as they light up, from the barn to the house
      const i = clamp(Math.floor((sceneT - LIT0) / LIT_GAP), 0, ORDER.length - 1), late = sceneT > LIT0 + ORDER.length * LIT_GAP + 0.6;
      const pick = late ? strands.filter(s => s.name === "The House" || s.name === "The Spruce" || s.name === "The Fence") : ORDER.slice(Math.max(0, i - 1), i + 1);
      const pts: [number, number][] = []; for (const s of pick) for (const path of s.paths) for (const q of path) pts.push([q[0], q[1]]);
      return pts.length ? pts : null;
    },
    sceneSecs: LIT0 + 6 * LIT_GAP + 3.2,
    autoInput(dt) {
      if (onFoot()) return [0, 0];
      const p = ctx.pose();
      if (autoReady >= 0) { if (strands[autoReady].hung >= 1) autoReady = -1; else return [0, 0]; }
      const n = nearest(); if (n.i < 0) return [0, 0];
      const s = strands[n.i];
      if (n.d < RCH - 1.4) { if (Math.abs(p.v) < 0.25) autoReady = n.i; return [0, 0]; }
      return router.tractor(dt, s.anchor[0], s.anchor[1], 5);
    },
    debug: () => ({ mode, cur, hung: hungN(), ready: autoReady, tapAt: autoReady >= 0 ? strands[autoReady].anchor : null, sceneT, bumps, strands: strands.map(s => ({ name: s.name, anchor: s.anchor, hung: s.hung, n: s.paths.reduce((a, q) => a + q.length, 0) })) }),
  };
}

// ════════════════════════════════════════════ Clean Up The Shop ════════════════════════════════════════════
const PICK_R = 1.7, DROP_R = 0.85;
function shopChore(ctx: ChoreCtx): Chore {
  const w = ctx.w, g = ctx.ground.getContext("2d")!, router = makeRouter(ctx);
  paintShop(g, ctx.map);
  ctx.place(TRACTOR.x, TRACTOR.y, TRACTOR.h);
  const walker = makeWalker(ctx, 2.3, false), pat = walker.wk; pat.x = PAT_START[0]; pat.y = PAT_START[1]; pat.a = -Math.PI / 2;
  type T = { st: "floor" | "carried" | "home"; x: number; y: number; a: number };
  const tools: T[] = TOOLS.map(t => ({ st: "floor", x: t.floor[0], y: t.floor[1], a: t.floor[2] }));
  let carry = -1, actT = -1, act: "" | "pick" | "put" = "", actI = -1, petted = false, hearts = 0, purr = 0, autoReady: "" | "tool" | "cat" = "", autoI = -1;
  // the cat: sits in her spots, wanders to another now and then, says hi when Pat comes by
  const cat: CatPose & { spot: number; tx: number; ty: number; moveT: number; meowCool: number; say: number } = { x: CAT_SPOTS[0][0], y: CAT_SPOTS[0][1], h: CAT_SPOTS[0][2], act: "sit", phase: 1.3, spot: 0, tx: 0, ty: 0, moveT: 16, meowCool: 3, say: 0 };
  const homeN = () => tools.filter(t => t.st === "home").length;
  const blocks = TRACTOR_BLOCKS;
  const nearTool = (fx: number, fy: number, r: number) => { let bi = -1, bd = r; tools.forEach((t, i) => { if (t.st !== "floor") return; const d = Math.hypot(t.x - fx, t.y - fy); if (d < bd) { bd = d; bi = i; } }); return bi; };
  return {
    catMode: "none", noTufts: true, deck: 0.3, noMini: true, silent: true,
    hold: () => true, patOff: () => true,
    step(dt) {
      const ph = ctx.phase();
      hearts = Math.max(0, hearts - dt); purr = Math.max(0, purr - dt); cat.say = Math.max(0, cat.say - dt); cat.meowCool -= dt;
      // the cat
      cat.moveT -= dt;
      if (cat.act === "walk") { const dx = cat.tx - cat.x, dy = cat.ty - cat.y, d = Math.hypot(dx, dy); if (d < 0.05) { cat.act = cat.spot === 1 ? "nap" : "sit"; cat.h = CAT_SPOTS[cat.spot][2]; } else { const s = Math.min(d, 0.9 * dt); cat.x += (dx / d) * s; cat.y += (dy / d) * s; cat.h = Math.atan2(dy, dx); } }
      else if (cat.moveT <= 0 && ph === "play" && purr <= 0) { cat.moveT = 15 + Math.random() * 8; cat.spot = (cat.spot + 1 + Math.floor(Math.random() * (CAT_SPOTS.length - 1))) % CAT_SPOTS.length; cat.tx = CAT_SPOTS[cat.spot][0]; cat.ty = CAT_SPOTS[cat.spot][1]; cat.act = "walk"; }
      if (ph === "scene" || ph === "over") { if (cat.act !== "walk" && cat.spot !== 1) { cat.spot = 1; cat.tx = CAT_SPOTS[1][0]; cat.ty = CAT_SPOTS[1][1]; cat.act = "walk"; } return; }
      if (ph !== "play" && ph !== "ready") return;
      if (cat.meowCool <= 0 && Math.hypot(cat.x - pat.x, cat.y - pat.y) < 1.5) { cat.meowCool = 14; cat.say = 1.6; ctx.snd.meow(); }
      if (actT >= 0) {   // bending to pick something up, or putting it away
        actT += dt;
        if (actT >= 0.35) {
          if (act === "pick") { tools[actI].st = "carried"; carry = actI; ctx.snd.pop(); }
          else { tools[actI].st = "home"; carry = -1; ctx.snd.clank(); const d = TOOLS[actI]; ctx.floatAt(`${homeN()} / ${TOOLS.length}`, d.drop[0], d.drop[1] - 0.8, "#fff4c2"); if (homeN() === TOOLS.length) ctx.say("Every Tool Put Away!"); }
          actT = -1; act = ""; actI = -1;
        }
        return;
      }
      walker.step(dt, ctx.stick(), blocks);
      if (carry >= 0) { const d = TOOLS[carry]; if (Math.hypot(d.drop[0] - pat.x, d.drop[1] - pat.y) < DROP_R) { act = "put"; actI = carry; actT = 0; pat.a = Math.atan2(d.spot[1] - pat.y, d.spot[0] - pat.x); } }
    },
    tap(wx, wy) {
      if (!playing(ctx) || actT >= 0) return;
      const ti = nearTool(wx, wy, 1.1), catD = Math.hypot(cat.x - wx, cat.y - wy), catNear = Math.hypot(cat.x - pat.x, cat.y - pat.y) <= 1.8;
      if (catD < 1.0 && (ti < 0 || (catNear && catD < Math.hypot(tools[ti].x - wx, tools[ti].y - wy)))) { if (!catNear) { ctx.say("Walk Over To The Cat"); return; } petted = true; hearts = 2; purr = 2.5; cat.say = 1.6; ctx.snd.meow(); if (cat.act === "walk") { cat.act = "sit"; } autoReady = ""; return; }
      const i = ti; if (i < 0) return;
      if (carry >= 0) { ctx.say(`Put The ${TOOLS[carry].name} Away First`); return; }
      if (Math.hypot(tools[i].x - pat.x, tools[i].y - pat.y) > PICK_R) { ctx.say("Walk Over To It First"); return; }
      act = "pick"; actI = i; actT = 0; pat.a = Math.atan2(tools[i].y - pat.y, tools[i].x - pat.x); autoReady = ""; ctx.snd.click();
    },
    done: () => homeN() === TOOLS.length && actT < 0,
    drawGround(c, time) {
      c.fillStyle = "#3a2c22"; c.fillRect(-30, -30, w.W + 60, 30); c.fillRect(-30, w.H, w.W + 60, 30); c.fillRect(-30, 0, 30, w.H); c.fillRect(w.W, 0, 30, w.H);   // dark outside the walls
      drawStoveTop(c, STOVE.x, STOVE.y, STOVE.r, time, 1);
      // tools where they go, then what's still lying about
      tools.forEach((t, i) => { const d = TOOLS[i]; if (t.st === "home") drawTool(c, d.kind, d.spot[0], d.spot[1], d.home === "rack" ? 0 : d.spot[2], d.home === "rack" ? 0.9 : d.home === "shelf" ? 1.5 : 1.6); });
      if (carry >= 0 && ctx.phase() === "play") { const d = TOOLS[carry], pu = 0.5 + 0.5 * Math.sin(time * 5); c.save(); c.strokeStyle = `rgba(255,200,40,${(0.6 + 0.4 * pu).toFixed(3)})`; c.lineWidth = 0.08; c.beginPath(); c.arc(d.spot[0], d.spot[1], 0.42 + 0.06 * pu, 0, 7); c.stroke(); c.restore(); ring(c, d.drop[0], d.drop[1], DROP_R * 0.8, time); }
      const ni = carry < 0 ? nearTool(pat.x, pat.y, PICK_R) : -1;
      tools.forEach((t, i) => { if (t.st !== "floor") return; const d = TOOLS[i]; if (i === ni) { const pu = 0.5 + 0.5 * Math.sin(time * 5); c.fillStyle = `rgba(255,214,64,${(0.25 + 0.2 * pu).toFixed(3)})`; c.beginPath(); c.arc(t.x, t.y, 0.55, 0, 7); c.fill(); } drawTool(c, d.kind, t.x + 0.04, t.y + 0.05, t.a, 1.5, true); drawTool(c, d.kind, t.x, t.y, t.a, 1.5); });
      if (cat.act !== "walk" && (cat.spot === 0 || cat.spot === 3)) drawCat(c, cat, time, 1.9);
    },
    drawBelow(c, time) { const p = ctx.pose(); drawPlow(c, p.x, p.y, p.h, { body: "#f26b1d", hood: "#f47c20", trim: "#b04e12" }, 0, time); },
    drawAbove(c, time) {
      if (cat.act === "walk" || (cat.spot !== 0 && cat.spot !== 3)) drawCat(c, cat, time, 1.9);
      const bend = actT >= 0 ? Math.sin(Math.min(1, actT / 0.35) * Math.PI) : 0;
      const pose: WinterPose = { walk: pat.v > 0.2 ? pat.ph : 0, carry: carry >= 0 ? "tool" : null, tool: carry >= 0 ? TOOLS[carry].kind : undefined, bend: act === "pick" ? bend : 0, reach: act === "put" ? bend : 0, wave: ctx.phase() === "scene" || ctx.phase() === "over" ? 1 : 0 };
      drawWinterPat(c, pat.x, pat.y, pat.a, pose, time);
    },
    drawScreen(c, sx, sy, CW, MH, time) {
      // warm lamp light from the ceiling, the stove's glow, the dark outside the walls
      const S = sx(1) - sx(0);
      c.save(); c.globalCompositeOperation = "multiply"; c.fillStyle = "rgba(255,226,180,0.22)"; c.fillRect(0, 0, CW, MH); c.restore();
      c.save(); c.globalCompositeOperation = "lighter"; for (const [lx, ly, lr, la] of [[sx(4), sy(7.5), 6 * S, 0.1], [sx(STOVE.x), sy(STOVE.y + 0.6), 2.4 * S, 0.12 + 0.03 * Math.sin(time * 7)]] as const) { const gr = c.createRadialGradient(lx, ly, 0, lx, ly, lr); gr.addColorStop(0, `rgba(255,190,110,${la.toFixed(3)})`); gr.addColorStop(1, "rgba(255,190,110,0)"); c.fillStyle = gr; c.fillRect(lx - lr, ly - lr, lr * 2, lr * 2); } c.restore();
      if (purr > 0 || cat.say > 0) bubble(c, sx(cat.x), sy(cat.y) - 30, purr > 0 ? "Purr" : "Meow!", Math.min(1, Math.max(purr, cat.say) * 3));
      if (hearts > 0) for (let k = 0; k < 3; k++) { const u = (2 - hearts) / 2 + k * 0.12; heart(c, sx(cat.x) - 14 + k * 14, sy(cat.y) - 44 - u * 22, 1.3, Math.max(0, 1 - u)); }
      const ph = ctx.phase(); if (ph !== "play" && ph !== "ready") return;
      if (carry >= 0) { const d = TOOLS[carry]; hint(c, `Take The ${d.name} To ${d.home === "pegboard" ? "The Pegboard" : d.home === "rack" ? "The Rack" : d.home === "shelf" ? "The Shelf" : "Its Hook"}`, CW, MH); edgeArrow(c, sx(d.drop[0]), sy(d.drop[1]), sx(pat.x), sy(pat.y), CW, MH, time, "", true); }
      else { const ni = nearTool(pat.x, pat.y, PICK_R); if (ni >= 0 && actT < 0) hint(c, `Tap The ${TOOLS[ni].name}`, CW, MH); else if (homeN() < TOOLS.length) { const fi = nearTool(pat.x, pat.y, 99); if (fi >= 0) edgeArrow(c, sx(tools[fi].x), sy(tools[fi].y), sx(pat.x), sy(pat.y), CW, MH, time, "", true); } }
    },
    holes: () => [],
    cam() { return [pat.x + pat.vx * 0.3, pat.y + pat.vy * 0.3]; },
    hud: () => ({ lead: { label: "Tools", value: `${homeN()} / ${TOOLS.length}` }, meter: { label: "The Cat", value: petted ? "Patted" : "Waiting", frac: 0, good: petted }, pct: homeN() / TOOLS.length }),
    outcome: (o: Outcome) => ({ ...o, stars: [o.stars[0], o.stars[1], o.done && petted], extra: { label: "The Cat", value: petted ? "Patted" : "Not Yet" }, failLine: `Pat put away ${homeN()} of ${TOOLS.length} tools. Grab the nearest one, and its spot lights up.` }),
    banner: ok => (ok ? "Tidy As Can Be!" : undefined),
    focus() { return [[ROOM.x0, WALL_Y - 2], [ROOM.x1, ROOM.y1]]; },
    sceneSecs: 4,
    autoInput(dt) {
      router.avoid(blocks);
      if (ctx.phase() === "ready") return [0, -0.5];
      if (actT >= 0 || autoReady) return [0, 0];
      if (carry >= 0) { const d = TOOLS[carry]; return router.pat(dt, pat.x, pat.y, d.drop[0], d.drop[1], 1); }
      if (!petted && homeN() >= 3 && cat.act !== "walk") { if (Math.hypot(cat.x - pat.x, cat.y - pat.y) < 1.4) { autoReady = "cat"; return [0, 0]; } return router.pat(dt, pat.x, pat.y, cat.x, cat.y + (cat.spot === 0 ? 0.9 : 0), 1); }
      // the nearest tool by walking distance (roughly: straight line)
      let bi = -1, bd = Infinity; tools.forEach((t, i) => { if (t.st !== "floor") return; const d = Math.hypot(t.x - pat.x, t.y - pat.y); if (d < bd) { bd = d; bi = i; } });
      if (bi < 0) return [0, 0];
      autoI = bi; if (bd < PICK_R - 0.45) { autoReady = "tool"; return [0, 0]; }
      return router.pat(dt, pat.x, pat.y, tools[bi].x, tools[bi].y, 1);
    },
    debug: () => ({ home: homeN(), carry, ready: autoReady, tapAt: autoReady === "tool" && autoI >= 0 ? [tools[autoI].x, tools[autoI].y] : autoReady === "cat" ? [cat.x, cat.y] : null, petted, pat: [pat.x, pat.y], cat: [cat.x, cat.y, cat.act] }),
  };
}
