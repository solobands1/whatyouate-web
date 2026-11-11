// Chapter 6, The Annual Party: four summer jobs that ride on the normal tractor engine (./engine) through the Chore hooks
// in ./chores, the same way Pat's Fall Chores do.
//   paint   A Fresh Coat: a paint sprayer on the tractor; drive beside the barn's walls and they turn from faded to fresh
//           red (slower gives a fuller coat). Once a side is red, stop by its white marker and tap it: Pat climbs a
//           ladder and does the white trim by hand. The barn is drawn here with a little parallax, so the wall Pat is
//           driving beside always shows.
//   games   Lawn Games: load the games at the barn door (tap), then pull up by each outlined spot in the field and tap
//           it; Pat hops off and sets up cornhole, ladder ball and the bocce court.
//   nets    Nets And The Slip And Slide: the same with the badminton net and the soccer goal, and the slide, which unrolls
//           out of the cart as the tractor drives along a dashed line; then a tap on the hose and it's wet.
//   party   Party Day: three hay-wagon rides for the kids, picked up and dropped off by the tent, through the flags, past
//           everyone playing the games Pat set up. It ends at dusk with the string lights on.
import type { LawnMap, Pt, Building } from "../lawnMap";
import type { Chore, ChoreCtx } from "./chores";
import type { Job, Outcome } from "./jobs";
import { pushOut, CELL, BODY_R, type World } from "./world";
import { clamp, wrapA, mulberry32, pip, polyClosest, centroid, sd as sdShape, type Shape } from "./geo";
import { gableRoof, flatRoof, outset, drawPerson } from "./art";
import { drawPat, drawCart, drawFlag } from "./fallArt";
import {
  drawFace, drawPaintRig, drawDrop, drawPawPrint, drawLadder, drawHose, stringLightPts, drawHayWagon, drawOutline, drawMarker, drawLoad, mix, guest, WAGON, TRIM_OLD, TRIM_NEW, type Face, type Guest,
} from "./summerArt";
import { partyLayout, outlineFor, piecesFor, solidsFor, partySolids, drawPartyGround, drawPartyStanding, drawPartyHouse, drawPartyAbove, drawDeckWithLinda, ALL_GAMES, ALL_SET, type GameKind, type Have } from "./party";

const FONT = "system-ui, -apple-system, sans-serif";
const U = (m: LawnMap, ux: number, uy: number): Pt => [ux * 0.075 - m.origin[0], (uy + 130) * 0.075 - m.origin[1]];   // a spot traced in the yard's units, in metres
const REACH = 4.6;   // how far Pat will walk from the tractor or the cart to set something up

export function makeSummerChore(job: Job, ctx: ChoreCtx): Chore | null {
  if (job.twist === "paint") return paintChore(ctx);
  if (job.twist === "games") return gamesChore(ctx);
  if (job.twist === "nets") return netsChore(ctx);
  if (job.twist === "party") return partyChore(ctx);
  return null;
}

// ── small shared bits (the same look as ./chores) ──
function pill(c: CanvasRenderingContext2D, t: string, cx: number, cy: number, size: number, fg: string, bg: string, padX = 14, hgt = 30) {
  c.save(); c.font = `800 ${size}px ${FONT}`; const tw = c.measureText(t).width + padX * 2;
  c.fillStyle = bg; if (c.globalAlpha > 0.98) { c.shadowColor = "rgba(0,0,0,0.2)"; c.shadowBlur = 10; c.shadowOffsetY = 2; } c.beginPath(); c.roundRect(cx - tw / 2, cy - hgt / 2, tw, hgt, hgt / 2); c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0;
  c.fillStyle = fg; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(t, cx, cy + 0.5); c.restore();
}
/** A speech bubble over (x, y). Given the map's size it stays on screen: the bubble slides in from the edge and its tail
 *  points the way to whoever is talking (or drops when they're off screen). */
function bubble(c: CanvasRenderingContext2D, x: number, y: number, t: string, a: number, CW = Infinity, MH = Infinity) {
  c.save(); c.globalAlpha = a; c.font = `800 13px ${FONT}`; const tw = c.measureText(t).width + 20;
  const bx = clamp(x, tw / 2 + 8, CW - tw / 2 - 8), by = clamp(y, 22, MH - 30), tail = y === by && x >= 0 && x <= CW, tx = clamp(x, bx - tw / 2 + 14, bx + tw / 2 - 14);
  c.fillStyle = "#fff"; if (a > 0.98) { c.shadowColor = "rgba(0,0,0,0.25)"; c.shadowBlur = 8; } c.beginPath(); c.roundRect(bx - tw / 2, by - 13, tw, 25, 12.5); c.fill();
  if (tail) { c.beginPath(); c.moveTo(tx - 5, by + 11); c.lineTo(tx, by + 19); c.lineTo(tx + 5, by + 11); c.fill(); }
  c.shadowBlur = 0;
  c.fillStyle = "#4a2f6b"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(t, bx, by); c.restore();
}
function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number, a: number) {
  c.save(); c.globalAlpha = a; c.translate(x, y); c.scale(s, s); c.fillStyle = "#e8506a"; c.beginPath(); c.moveTo(0, 3); c.bezierCurveTo(-6, -1, -3, -6, 0, -2.5); c.bezierCurveTo(3, -6, 6, -1, 0, 3); c.fill(); c.restore();
}
/** An arrow on the edge of the map pointing at something off screen (never one out in front of the tractor). */
function edgeArrow(c: CanvasRenderingContext2D, qx: number, qy: number, fromX: number, fromY: number, CW: number, MH: number, time: number, label = "") {
  if (qx >= 8 && qx <= CW - 8 && qy >= 8 && qy <= MH - 8) return;
  const a = Math.atan2(qy - fromY, qx - fromX), bob = Math.sin(time * 6) * 3, ex = clamp(qx, 26, CW - 26);
  let ey = clamp(qy, 26, MH - 26); if (ex > CW - Math.min(104, CW * 0.28) - 30 && ey < 140) ey = 140;   // never under the minimap
  c.save(); c.translate(ex - Math.cos(a) * bob, ey - Math.sin(a) * bob); c.rotate(a); c.fillStyle = "#ffd646"; c.strokeStyle = "rgba(60,50,0,0.6)"; c.lineWidth = 2; c.shadowColor = "rgba(0,0,0,0.25)"; c.shadowBlur = 6;
  c.beginPath(); c.moveTo(15, 0); c.lineTo(-10, -12); c.lineTo(-4, 0); c.lineTo(-10, 12); c.closePath(); c.fill(); c.shadowBlur = 0; c.stroke(); c.restore();
  if (label) { const lx = clamp(ex - Math.cos(a) * 32, 26, CW - 26), ly = clamp(ey - Math.sin(a) * 28, 18, MH - 18); pill(c, label, lx, ly, 11, "#5c4a12", "rgba(255,246,214,0.95)", 8, 20); }
}
/** Grid routes for the autopilot (tests only): breadth-first over the cells the tractor can reach. */
function makeRouter(ctx: ChoreCtx, blocked?: (x: number, y: number) => boolean) {
  const w = ctx.w;
  const ok = (k: number) => w.reach[k] && w.clearance[k] > BODY_R + 0.35 && !(blocked && blocked(w.cellX(k), w.cellY(k)));
  const near = (x: number, y: number) => { let k = w.cellOf(x, y); if (ok(k)) return k; let bd = Infinity; const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL); for (let dj = -10; dj <= 10; dj++) for (let di = -10; di <= 10; di++) { const a = ci + di, b = cj + dj; if (a < 0 || b < 0 || a >= w.NX || b >= w.NY) continue; const n = b * w.NX + a; if (ok(n) && Math.hypot(di, dj) < bd) { bd = Math.hypot(di, dj); k = n; } } return k; };
  function route(fx: number, fy: number, tx: number, ty: number) {
    const from = near(fx, fy), to = near(tx, ty), prev = new Int32Array(w.N).fill(-2), q = [from]; prev[from] = -1;
    for (let qi = 0; qi < q.length; qi++) { const k = q[qi]; if (k === to) break; const i = k % w.NX, j = (k - i) / w.NX; for (const n of [i > 0 ? k - 1 : -1, i < w.NX - 1 ? k + 1 : -1, j > 0 ? k - w.NX : -1, j < w.NY - 1 ? k + w.NX : -1]) if (n >= 0 && ok(n) && prev[n] === -2) { prev[n] = k; q.push(n); } }
    if (prev[to] === -2) return [] as number[];
    const p: number[] = []; for (let c = to; c >= 0; c = prev[c]) p.push(c); return p.reverse();
  }
  const sight = (x: number, y: number, bx: number, by: number) => { const L = Math.hypot(bx - x, by - y), n = Math.ceil(L / 0.3); for (let q = 1; q <= n; q++) { const k = w.cellOf(x + ((bx - x) * q) / n, y + ((by - y) * q) / n); if (!w.reach[k] || w.clearance[k] < BODY_R + 0.45 || (blocked && blocked(x + ((bx - x) * q) / n, y + ((by - y) * q) / n))) return false; } return true; };
  let path: number[] = [], at = 0, goal: Pt | null = null, planT = 0;
  /** A push on the stick toward (tx, ty) along a grid route, eased near obstacles; `top` caps the push. */
  function drive(dt: number, tx: number, ty: number, slowAt = 0, top = 1): [number, number] {
    const p = ctx.pose(); planT -= dt;
    if (!goal || goal[0] !== tx || goal[1] !== ty || planT <= 0 || at >= path.length) { path = route(p.x, p.y, tx, ty); at = 0; goal = [tx, ty]; planT = 1.2; }
    while (at < path.length - 1 && Math.hypot(w.cellX(path[at]) - p.x, w.cellY(path[at]) - p.y) < 1.2) at++;
    let la = at; for (let q = Math.min(path.length - 1, at + 26); q > at; q--) if (sight(p.x, p.y, w.cellX(path[q]), w.cellY(path[q]))) { la = q; break; }
    const end = la >= path.length - 1 && sight(p.x, p.y, tx, ty), gx = end ? tx : path.length ? w.cellX(path[la]) : tx, gy = end ? ty : path.length ? w.cellY(path[la]) : ty, dx = gx - p.x, dy = gy - p.y, d = Math.hypot(dx, dy) || 1;
    let want = clamp(w.clearance[w.cellOf(p.x, p.y)] / 3, 0.35, 1) * top;
    if (slowAt > 0) want = Math.min(want, clamp(Math.hypot(tx - p.x, ty - p.y) / slowAt, 0.25, 1));
    const push = 0.1 + 0.9 * want; return [(dx / d) * push, (dy / d) * push];
  }
  return { drive };
}

/** High summer: a deeper green over the grass, and flower beds round the house and the deck (painted once). */
function summerLook(ctx: ChoreCtx) {
  const g = ctx.grass.c, m = ctx.map, rnd = mulberry32(606);
  const COLS = ["#f06a9a", "#f7d046", "#ffffff", "#b77be0", "#ff8a4a", "#e84a5f"];
  const bed = (pts: [number, number][], wd: number) => {
    const P = pts.map(([ux, uy]) => U(m, ux, uy));
    g.save(); g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#5b4232"; g.lineWidth = wd; g.beginPath(); P.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke();
    for (let i = 1; i < P.length; i++) { const [a, b] = [P[i - 1], P[i]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s < L; s += 0.16) { const u = s / L, x = a[0] + (b[0] - a[0]) * u + (rnd() - 0.5) * wd * 0.7, y = a[1] + (b[1] - a[1]) * u + (rnd() - 0.5) * wd * 0.7; g.fillStyle = rnd() < 0.4 ? "#3f7a32" : "#4f8f3a"; g.beginPath(); g.arc(x, y, 0.09, 0, 7); g.fill(); if (rnd() < 0.75) { g.fillStyle = COLS[Math.floor(rnd() * COLS.length)]; g.beginPath(); g.arc(x + 0.03, y - 0.02, 0.055, 0, 7); g.fill(); g.fillStyle = "rgba(255,240,150,0.9)"; g.beginPath(); g.arc(x + 0.03, y - 0.02, 0.018, 0, 7); g.fill(); } } }
    g.restore();
  };
  bed([[948, 311], [975, 311]], 0.55); bed([[1006, 311], [1028, 311]], 0.55);   // along the deck, each side of the steps
  bed([[1036, 256], [1036, 300]], 0.5);                                         // the east side of the deck
  bed([[925, 95], [1005, 95]], 0.5);                                            // in front of the porch
  bed([[914, 140], [914, 200]], 0.45);                                          // the west side of the house
  return (c: CanvasRenderingContext2D, cx: number, cy: number, vw: number, vh: number) => {
    c.save(); c.globalCompositeOperation = "multiply"; c.fillStyle = "rgba(196,232,170,0.32)"; c.fillRect(cx - vw / 2 - 2, cy - vh / 2 - 2, vw + 4, vh + 4); c.restore();
  };
}

/** Something hitched behind the tractor (the little cart, the hay wagon), pushed out of walls and the chore's own things. */
function makeTrailer(ctx: ChoreCtx, solids: () => World | null, o: { tongue: number; offs: number[]; r: number }) {
  const HITCH = ctx.up.bagger ? 1.45 : 1.0, TONGUE = o.tongue;
  const p0 = ctx.pose(); const c = { ax: p0.x - Math.cos(p0.h) * (HITCH + TONGUE), ay: p0.y - Math.sin(p0.h) * (HITCH + TONGUE), a: p0.h, hits: 0, cool: 0 };
  function update(dt: number) {
    const p = ctx.pose(), hx = p.x - Math.cos(p.h) * HITCH, hy = p.y - Math.sin(p.h) * HITCH;
    const fix = () => { const dx = hx - c.ax, dy = hy - c.ay, d = Math.hypot(dx, dy) || 1; c.ax = hx - (dx / d) * TONGUE; c.ay = hy - (dy / d) * TONGUE; c.a = Math.atan2(dy, dx); };
    fix();
    const rel = wrapA(c.a - p.h); if (Math.abs(rel) > 1.75) { c.a = p.h + Math.sign(rel) * 1.75; c.ax = hx - Math.cos(c.a) * TONGUE; c.ay = hy - Math.sin(c.a) * TONGUE; }
    let push = 0; const sw = solids();
    for (let it = 0; it < 2; it++) for (const off of o.offs) for (const wd of sw ? [ctx.w, sw] : [ctx.w]) {
      const cx = c.ax + Math.cos(c.a) * off, cy = c.ay + Math.sin(c.a) * off, q = pushOut(wd, cx, cy, o.r, null);
      if (q.hit) { c.ax += q.x - cx; c.ay += q.y - cy; push += Math.hypot(q.x - cx, q.y - cy); fix(); }
    }
    c.cool -= dt;
    if (push > 0.03 && Math.abs(p.v) > 1.2 && c.cool <= 0) { c.cool = 1; c.hits++; return true; }
    return false;
  }
  return { c, update, TONGUE };
}

// ── Pat on foot: a little list of steps (walk somewhere, do something there), then back up onto the seat ──
type WStep = { to?: () => Pt; act?: number; carry?: string | null; bend?: number; brush?: boolean; perch?: () => Pt; face?: () => Pt; done?: () => void; tick?: (u: number) => void };
function makeWalker(ctx: ChoreCtx, WALK = 3.3) {
  type W = { x: number; y: number; a: number; ph: number; i: number; steps: WStep[]; carry: string | null; at: number; arr: boolean; begun: boolean; side: number; moving: boolean };
  let w: W | null = null;
  const seat = (side: number): Pt => { const p = ctx.pose(); return [p.x - Math.cos(p.h) * 0.44 - Math.sin(p.h) * side * 0.85, p.y - Math.sin(p.h) * 0.44 + Math.cos(p.h) * side * 0.85]; };
  function start(steps: WStep[], toward: Pt) {
    const p = ctx.pose(), side = (toward[0] - p.x) * -Math.sin(p.h) + (toward[1] - p.y) * Math.cos(p.h) >= 0 ? 1 : -1;
    w = { x: p.x - Math.cos(p.h) * 0.44, y: p.y - Math.sin(p.h) * 0.44, a: p.h + side * Math.PI / 2, ph: 0, i: 0, steps: [{ to: () => seat(side) }, ...steps, { to: () => seat(side), carry: null }], carry: null, at: 0, arr: false, begun: false, side, moving: false };
    ctx.snd.click();
  }
  function step(dt: number) {
    if (!w) return; const s = w.steps[w.i];
    if (!w.begun) { w.begun = true; if (s.carry !== undefined) w.carry = s.carry; }
    w.moving = false;
    if (!w.arr) {
      if (s.to) { const [tx, ty] = s.to(), dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy); if (d > 0.03) { const st = Math.min(d, WALK * dt); w.x += (dx / d) * st; w.y += (dy / d) * st; w.a = Math.atan2(dy, dx); w.ph += st * 5.2; w.moving = true; if (st < d - 1e-6) return; } }
      w.arr = true; if (s.face) { const [fx, fy] = s.face(); w.a = Math.atan2(fy - w.y, fx - w.x); }
    }
    w.at += dt; s.tick?.(clamp(w.at / (s.act || 1), 0, 1));
    if (w.at < (s.act ?? 0)) return;
    s.done?.(); w.i++; w.at = 0; w.arr = false; w.begun = false;
    if (w.i >= w.steps.length) w = null;
  }
  function draw(c: CanvasRenderingContext2D, t: number) {
    if (!w) return; const s = w.steps[w.i];
    const u = s.act ? clamp(w.at / s.act, 0, 1) : 0, bend = s.bend && w.arr ? Math.sin(u * Math.PI) * s.bend : 0;
    let px = w.x, py = w.y, size = 1.3;
    if (s.perch && w.arr) { const [qx, qy] = s.perch(), k = Math.min(1, u * 5, (1 - u) * 5); px += (qx - w.x) * k; py += (qy - w.y) * k; size = 1.3 + 0.12 * k; }
    drawPat(c, px, py, w.a, { walk: w.moving ? w.ph : 0, carry: w.carry || s.brush ? "load" : null, bend }, t, size);
    const hx = px + Math.cos(w.a) * 0.62 * size / 1.3, hy = py + Math.sin(w.a) * 0.62 * size / 1.3;
    if (w.carry) drawLoad(c, w.carry, hx, hy, w.a + Math.PI / 2);
    if (s.brush && w.arr) { const wob = Math.sin(t * 14) * 0.08; c.save(); c.translate(hx, hy + wob); c.rotate(w.a); c.fillStyle = "#8a6a3a"; c.fillRect(-0.12, -0.025, 0.18, 0.05); c.fillStyle = "#f4f4f0"; c.fillRect(0.05, -0.05, 0.08, 0.1); c.restore(); }
  }
  return { start, step, draw, busy: () => !!w, pos: (): Pt | null => (w ? [w.x, w.y] : null), state: () => (w ? w.i : -1) };
}

/** Taps: the nearest of some targets within `r` of the tap. */
const nearestTo = <T>(items: T[], at: (t: T) => Pt, x: number, y: number, r: number) => { let best: T | null = null, bd = r; for (const it of items) { const [ix, iy] = at(it), d = Math.hypot(ix - x, iy - y); if (d < bd) { bd = d; best = it; } } return best; };

// ══════════════════════════════ A Fresh Coat ══════════════════════════════
function paintChore(ctx: ChoreCtx): Chore {
  const m = ctx.map, barn = m.buildings.find(b => b.kind === "barn")!, lean = m.buildings.find(b => b.kind === "other" && polyClosest(barn.poly, centroid(b.poly)[0], centroid(b.poly)[1]).d < 3) ?? null;
  const look = summerLook(ctx), g = ctx.grass.c;
  ctx.place(...U(m, 1062, 703), 0);
  const R = 3.3, FULL = 0.8;   // the sprayer reaches 3.3 m (fading over the last half metre); a strip takes 0.8 s for a full coat
  const SIDES = ["North", "East", "South", "West"];
  type Wall = { face: Face; n: Pt; u: Pt; L: number; side: number; hidden: Uint8Array; struct: number; lit: number };
  const walls: Wall[] = [];
  const pad = m.pads.find(q => q.kind === "concrete"), padC = pad ? centroid(pad.poly) : null;
  const build = (b: Building, struct: number) => {
    const P = b.poly, [cx, cy] = centroid(P);
    P.forEach((a, i) => {
      const q = P[(i + 1) % P.length], dx = q[0] - a[0], dy = q[1] - a[1], L = Math.hypot(dx, dy), u: Pt = [dx / L, dy / L];
      let n: Pt = [dy / L, -dx / L]; if (n[0] * ((a[0] + q[0]) / 2 - cx) + n[1] * ((a[1] + q[1]) / 2 - cy) < 0) n = [-n[0], -n[1]];
      const mid: Pt = [(a[0] + q[0]) / 2, (a[1] + q[1]) / 2];
      if (struct === 1 && polyClosest(barn.poly, mid[0], mid[1]).d < 0.6) return;   // where the lean-to meets the barn
      const nb = Math.max(2, Math.round(L / 0.5)), side = Math.abs(n[1]) > Math.abs(n[0]) ? (n[1] < 0 ? 0 : 2) : n[0] > 0 ? 1 : 3;
      const face: Face = { a, b: q, coats: new Float32Array(nb), wet: new Float32Array(nb), trim: 0, seed: 70 + walls.length * 13, corners: true };
      if (struct === 0) {
        if (side === 0 && padC) face.door = { s: clamp((padC[0] - a[0]) * u[0] + (padC[1] - a[1]) * u[1], 1.6, L - 1.6), w: 2.6, h: 0.86 };
        if (side === 2) { const east = a[0] > q[0] ? 0 : L; face.door = { s: Math.abs(east - L * 0.24), w: Math.min(L * 0.3, 2.8), h: 0.86 }; face.window = { s: Math.abs(L - east - L * 0.12), w: 0.6 }; }
        if (side === 1 || side === 3) face.window = { s: L / 2, w: 0.6 };
      }
      const hidden = new Uint8Array(nb);
      if (struct === 0 && lean) for (let k = 0; k < nb; k++) { const s = (k + 0.5) * (L / nb), bx = a[0] + u[0] * s, by = a[1] + u[1] * s; if (pip(lean.poly, bx, by) || polyClosest(lean.poly, bx, by).d < 0.4) hidden[k] = 1; }
      const lit = (n[0] * -0.55 + n[1] * -0.83);
      walls.push({ face, n, u, L, side, hidden, struct, lit });
    });
  };
  build(barn, 0); if (lean) build(lean, 1);
  let totalBins = 0; for (const wl of walls) for (let k = 0; k < wl.hidden.length; k++) if (!wl.hidden[k]) totalBins++;
  const binDone = (v: number) => Math.min(1, v / 0.9);
  const wallsPct = () => { let s = 0; for (const wl of walls) for (let k = 0; k < wl.hidden.length; k++) if (!wl.hidden[k]) s += binDone(wl.face.coats[k]); return totalBins ? s / totalBins : 1; };
  const sidePct = (side: number) => { let s = 0, n = 0; for (const wl of walls) if (wl.side === side) for (let k = 0; k < wl.hidden.length; k++) if (!wl.hidden[k]) { s += binDone(wl.face.coats[k]); n++; } return n ? s / n : 1; };
  const sideReady = (side: number) => sidePct(side) >= 0.96;
  // the trim markers: one per side, out in front of its main wall (by the doors on the north and south)
  const trims = [0, 1, 2, 3].map(side => {
    const wl = walls.find(q => q.side === side && q.struct === 0)!, s = wl.face.door ? wl.face.door.s : wl.L / 2;
    const base: Pt = [wl.face.a[0] + wl.u[0] * s, wl.face.a[1] + wl.u[1] * s];
    return { side, wl, s, base, spot: [base[0] + wl.n[0] * 2.4, base[1] + wl.n[1] * 2.4] as Pt, foot: [base[0] + wl.n[0] * 0.55, base[1] + wl.n[1] * 0.55] as Pt, done: false, k: 0, told: false };
  });
  const trimsDone = () => trims.filter(t => t.done).length;
  const walker = makeWalker(ctx), router = makeRouter(ctx);
  let dropAt: number[] | null = null, spray = 0, sprayT = 0, sprayHead = 0, bumps = 0, bumpCool = 0, view: Pt = [0, 0], finished = false, catPaint = 0, catStep = 0, catLast: Pt | null = null, catTold = false, autoReady: number | null = null;
  const B = centroid([...barn.poly, ...(lean ? lean.poly : [])]);
  /** Where the tops of the walls show: the roof leans away from the camera (a little parallax), a touch up the screen. */
  const offset = (): Pt => { if (ctx.phase() === "scene" || ctx.phase() === "over") return [0, -1.5]; let ox = (B[0] - view[0]) * 0.3, oy = (B[1] - view[1]) * 0.3; const L = Math.hypot(ox, oy); if (L > 1.7) { ox *= 1.7 / L; oy *= 1.7 / L; } return [ox, oy - 0.5]; };
  let roofA = 1;
  // the autopilot's lap (tests only): a loop 1.8 m out from the walls of the barn and the lean-to, corner to corner
  let lapDone = false, wp = -1, wpN = 0;
  const loop: Pt[] = (() => {
    // the outline of the barn and the lean-to together (into the nooks beside the lean-to), pushed out 1.7 m
    const P: Pt[] = [...barn.poly];
    if (lean) {
      const lc = centroid(lean.poly); let ei = 0, bd = Infinity; P.forEach((a, i) => { const q = P[(i + 1) % P.length], d = Math.hypot((a[0] + q[0]) / 2 - lc[0], (a[1] + q[1]) / 2 - lc[1]); if (d < bd) { bd = d; ei = i; } });
      const L4 = lean.poly, near = [0, 1, 2, 3].sort((i, j) => polyClosest(barn.poly, L4[i][0], L4[i][1]).d - polyClosest(barn.poly, L4[j][0], L4[j][1]).d).slice(0, 2);
      const a = P[ei], n0 = Math.hypot(L4[near[0]][0] - a[0], L4[near[0]][1] - a[1]) < Math.hypot(L4[near[1]][0] - a[0], L4[near[1]][1] - a[1]) ? near[0] : near[1], n1 = near[0] === n0 ? near[1] : near[0];
      const far0 = [0, 1, 2, 3].find(i => i !== n0 && i !== n1 && (Math.abs(i - n0) === 1 || Math.abs(i - n0) === 3))!, far1 = [0, 1, 2, 3].find(i => i !== n0 && i !== n1 && i !== far0)!;
      P.splice(ei + 1, 0, L4[n0], L4[far0], L4[far1], L4[n1]);
    }
    const area = P.reduce((s2, a, i) => { const q = P[(i + 1) % P.length]; return s2 + a[0] * q[1] - q[0] * a[1]; }, 0), sg = area > 0 ? 1 : -1, d = 1.7, out: Pt[] = [];
    const nrm = (a: Pt, b: Pt): Pt => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [sg * (b[1] - a[1]) / L, -sg * (b[0] - a[0]) / L]; };
    P.forEach((v, i) => { const pr = P[(i + P.length - 1) % P.length], nx = P[(i + 1) % P.length], n1 = nrm(pr, v), n2 = nrm(v, nx), k = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]); out.push([v[0] + (n1[0] + n2[0]) * k, v[1] + (n1[1] + n2[1]) * k]); if (Math.hypot(nx[0] - v[0], nx[1] - v[1]) > 5) for (const f of [0.25, 0.5, 0.75]) out.push([v[0] + (nx[0] - v[0]) * f + n2[0] * d, v[1] + (nx[1] - v[1]) * f + n2[1] * d]); });
    // (a corner tucked in by the shed: the nearest spot the tractor fits)
    const w = ctx.w;
    return out.map(([x, y]) => { let k = w.cellOf(x, y); if (w.reach[k] && w.clearance[k] > BODY_R + 0.45) return [x, y] as Pt; let bd = Infinity; for (let n = 0; n < w.N; n++) if (w.reach[n] && w.clearance[n] > BODY_R + 0.45) { const dd = Math.hypot(w.cellX(n) - x, w.cellY(n) - y); if (dd < bd) { bd = dd; k = n; } } return bd < 1 ? [w.cellX(k), w.cellY(k)] as Pt : null; }).filter((q): q is Pt => !!q);
  })();
  function tapTrim(t: (typeof trims)[number]) {
    if (walker.busy() || t.done) return;
    const p = ctx.pose();
    if (!sideReady(t.side)) { ctx.say(`Paint The ${SIDES[t.side]} Side Red First`); return; }
    if (Math.hypot(t.spot[0] - p.x, t.spot[1] - p.y) > REACH) { ctx.say("Pull Up Closer To The Marker"); return; }
    autoReady = null;
    walker.start([{ to: () => t.foot, face: () => t.base, act: 1.9, brush: true, perch: () => { const o = offset(); return [t.base[0] + o[0] * 0.5 + t.wl.n[0] * 0.25, t.base[1] + o[1] * 0.5 + t.wl.n[1] * 0.25]; },
      tick: u => { t.k = u; for (const wl of walls) if (wl.side === t.side) wl.face.trim = u; }, done: () => { t.done = true; ctx.snd.coin(); ctx.floatAt("Trim Done!", t.base[0], t.base[1] - 1, "#ffffff"); } }], t.spot);
  }
  return {
    noTufts: true,
    hold: () => walker.busy(), patOff: () => walker.busy(),
    step(dt) {
      walker.step(dt); bumpCool -= dt;
      for (const wl of walls) for (let k = 0; k < wl.face.wet.length; k++) if (wl.face.wet[k] > 0) wl.face.wet[k] = Math.max(0, wl.face.wet[k] - dt / 7);
      let got = 0, sideX = 0;
      const p = ctx.pose();
      if (ctx.phase() === "play" && !walker.busy()) {
        for (const wl of walls) {
          const bl = wl.L / wl.hidden.length, a = wl.face.a; let wallDone = true, before = true;
          for (let k = 0; k < wl.hidden.length; k++) {
            if (wl.hidden[k]) continue;
            const s = (k + 0.5) * bl, bx = a[0] + wl.u[0] * s, by = a[1] + wl.u[1] * s, dx = p.x - bx, dy = p.y - by, dn = dx * wl.n[0] + dy * wl.n[1], d = Math.hypot(dx, dy);
            if (wl.face.coats[k] < 0.9) before = false;
            if (dn > 0 && d < R) {
              const r = (dt / FULL) * clamp((R - d) / 0.5, 0, 1);
              if (wl.face.coats[k] < 1) { wl.face.coats[k] = Math.min(1, wl.face.coats[k] + r); wl.face.wet[k] = 1; got += r; sideX += -Math.sin(p.h) * -dx + Math.cos(p.h) * -dy; if (!dropAt || Math.random() < 0.2) dropAt = [bx, by, wl.n[0], wl.n[1]]; }
            }
            if (wl.face.coats[k] < 0.9) wallDone = false;
          }
          if (wallDone && !before) ctx.snd.pop();
        }
        for (const t of trims) if (!t.told && sideReady(t.side)) { t.told = true; ctx.snd.coin(); ctx.say(`${SIDES[t.side]} Side Ready For Trim`); }
      }
      if (dropAt && got > 0 && Math.random() < dt * 2.2) { const [bx, by, nx, ny] = dropAt, o = 0.25 + Math.random() * 0.45, q = (Math.random() - 0.5) * 0.5; drawDrop(g, bx + nx * o - ny * q, by + ny * o + nx * q, 0.025 + Math.random() * 0.025); }   // a drip on the grass now and then
      dropAt = null;
      spray += ((got > 0 ? 1 : 0) - spray) * Math.min(1, dt * 8);
      if (got > 0 && lean) { let ls = 0, ln = 0; for (const wl of walls) if (wl.struct === 1) for (let k = 0; k < wl.hidden.length; k++) { ls += wl.face.coats[k]; ln++; } const lm = ln ? ls / ln : 1; for (const wl of walls) for (let k = 0; k < wl.hidden.length; k++) if (wl.hidden[k]) wl.face.coats[k] = lm; }   // the strip of barn wall behind the lean-to (seen over its roof) goes red with it
      if (got > 0) { sprayHead = sideX; sprayT += dt; }
      // the cat and the wet paint: a few red paw prints across the grass
      const ct = ctx.cat?.();
      if (ct?.out) {
        if (catPaint <= 0) for (const wl of walls) { const bl = wl.L / wl.hidden.length; for (let k = 0; k < wl.hidden.length; k += 2) { if (wl.face.wet[k] < 0.3) continue; const s = (k + 0.5) * bl, bx = wl.face.a[0] + wl.u[0] * s, by = wl.face.a[1] + wl.u[1] * s; if (Math.hypot(ct.x - bx, ct.y - by) < 0.75) { catPaint = 3.5; if (!catTold) { catTold = true; ctx.floatAt("Wet Paws!", ct.x, ct.y - 0.8, "#ffd2cc"); ctx.snd.meow(); } } } }
        if (catPaint > 0 && catLast) { catPaint -= dt; catStep += Math.hypot(ct.x - catLast[0], ct.y - catLast[1]); if (catStep > 0.28) { catStep = 0; const a = Math.atan2(ct.y - catLast[1], ct.x - catLast[0]), sd = Math.random() < 0.5 ? 1 : -1; drawPawPrint(g, ct.x - Math.sin(a) * 0.06 * sd, ct.y + Math.cos(a) * 0.06 * sd, a, Math.min(0.85, catPaint / 2)); } }
        catLast = [ct.x, ct.y];
      } else catLast = null;
      if (!finished && trimsDone() === 4 && !walker.busy()) { finished = true; for (const wl of walls) wl.face.coats.fill(1); }
    },
    hit(into) { if (into > 1.5 && ctx.phase() === "play" && bumpCool <= 0) { const p = ctx.pose(); if (polyClosest(barn.poly, p.x, p.y).d < 1.6 || (lean && polyClosest(lean.poly, p.x, p.y).d < 1.6)) { bumps++; bumpCool = 1; ctx.floatAt("Smudge!", p.x, p.y - 1.2, "#ffd2cc"); } } },
    tap(wx, wy) {
      if (ctx.phase() !== "play") return;
      const t = nearestTo(trims.filter(q => !q.done), q => q.spot, wx, wy, 2.2) ?? nearestTo(trims.filter(q => !q.done), q => q.base, wx, wy, 2.2);
      if (t) tapTrim(t);
    },
    done: () => finished,
    drawGround(c, time, cx, cy, vw, vh) {
      view = [cx, cy]; look(c, cx, cy, vw, vh);
      const p = ctx.pose();
      for (const t of trims) if (!t.done) { const ready = sideReady(t.side) && !walker.busy() && Math.hypot(t.spot[0] - p.x, t.spot[1] - p.y) <= REACH && Math.abs(p.v) < 1.5; drawMarker(c, t.spot[0], t.spot[1], 0.75, time, ready, sideReady(t.side) ? "#ffffff" : "rgba(255,255,255,0.35)"); if (sideReady(t.side)) { c.save(); c.fillStyle = "#ffffff"; c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 0.03; c.beginPath(); c.roundRect(t.spot[0] - 0.22, t.spot[1] - 0.22, 0.44, 0.44, 0.1); c.fill(); c.stroke(); c.fillStyle = "#8a6a3a"; c.fillRect(t.spot[0] - 0.04, t.spot[1] - 0.2, 0.08, 0.2); c.restore(); } }
    },
    drawBuilding(c, b) {
      if (b === lean) return true;
      if (b !== barn) return false;
      const off = offset(), offL: Pt = [off[0] * (lean ? lean.height / barn.height : 1), off[1] * (lean ? lean.height / barn.height : 1)];
      const p = ctx.pose(), tr = trims.reduce((a, t) => a + t.k, 0) / 4, trimCol = mix(TRIM_OLD, TRIM_NEW, tr);
      const drawStruct = (bb: Building, o: Pt, struct: number) => {
        for (const wl of walls) if (wl.struct === struct && wl.n[0] * o[0] + wl.n[1] * o[1] < -0.02) drawFace(c, wl.face, o, wl.lit);
        const T = bb.poly.map(q => [q[0] + o[0], q[1] + o[1]] as Pt);
        const under = pip(T, p.x, p.y) && !pip(bb.poly, p.x, p.y);
        if (struct === 0) roofA += ((under ? 0.5 : 1) - roofA) * 0.15;
        c.save(); c.globalAlpha = struct === 0 ? roofA : 1;
        if (struct === 0) gableRoof(c, outset(T, 0.16), bb.roof, true, trimCol, 40); else flatRoof(c, { ...bb, trim: trimCol }, T);
        c.restore();
      };
      if (lean && off[1] < 0) { drawStruct(barn, off, 0); drawStruct(lean, offL, 1); }
      else { if (lean) drawStruct(lean, offL, 1); drawStruct(barn, off, 0); }
      // Pat on his ladder doing the trim, in front of the wall
      const wp = walker.pos(), t = performance.now() / 1000; if (wp) for (const tr of trims) if (Math.hypot(wp[0] - tr.foot[0], wp[1] - tr.foot[1]) < 0.2) drawLadder(c, [tr.foot[0] + tr.wl.n[0] * 0.2, tr.foot[1] + tr.wl.n[1] * 0.2], [tr.base[0] + off[0] * 0.75, tr.base[1] + off[1] * 0.75]);
      walker.draw(c, t);
      return true;
    },
    drawBelow() {},
    drawAbove(c, time) {
      const p = ctx.pose();
      if (!walker.busy()) drawPaintRig(c, p.x, p.y, p.h, spray, sprayHead, time);
      else drawPaintRig(c, p.x, p.y, p.h, 0, 0, time, true);
      // (Pat on foot and his ladder are drawn with the barn, in front of its wall)
    },
    drawScreen(c, sx, sy, CW, MH, time) {
      if (ctx.phase() !== "play" && ctx.phase() !== "ready") return;
      const p = ctx.pose();
      const t = trims.find(q => !q.done && sideReady(q.side) && Math.hypot(q.spot[0] - p.x, q.spot[1] - p.y) <= REACH);
      if (t && !walker.busy() && Math.abs(p.v) < 1.5) pill(c, "Tap The White Marker", CW / 2, MH - 30, 13, "#2f5a1f", "rgba(255,255,255,0.97)", 16, 32);
      else if (spray > 0.3 && Math.abs(p.v) > 5.2) pill(c, "Slow Down For A Full Coat", CW / 2, MH - 30, 13, "#8a3a14", "rgba(255,255,255,0.95)", 16, 32);
      // off screen: the next trim marker, or the nearest bare wall
      if (walker.busy()) return;
      const rt = trims.find(q => !q.done && sideReady(q.side));
      let target: Pt | null = rt ? rt.spot : null;
      if (!target) { let bd = Infinity; for (const wl of walls) { const bl = wl.L / wl.hidden.length; for (let k = 0; k < wl.hidden.length; k++) if (!wl.hidden[k] && wl.face.coats[k] < 0.9) { const s = (k + 0.5) * bl, bx = wl.face.a[0] + wl.u[0] * s + wl.n[0] * 1.5, by = wl.face.a[1] + wl.u[1] * s + wl.n[1] * 1.5, d = Math.hypot(bx - p.x, by - p.y); if (d < bd) { bd = d; target = [bx, by]; } } } }
      if (target) edgeArrow(c, sx(target[0]), sy(target[1]), sx(p.x), sy(p.y), CW, MH, time, `${Math.round(Math.hypot(target[0] - p.x, target[1] - p.y))} m`);
    },
    drawMini(c, ms) {
      for (const wl of walls) { let s = 0, n = 0; for (let k = 0; k < wl.hidden.length; k++) if (!wl.hidden[k]) { s += binDone(wl.face.coats[k]); n++; } if (!n) continue; c.strokeStyle = mix("#e8d8cc", "#ff2a1a", s / n); c.lineWidth = 2.2 / ms; c.beginPath(); c.moveTo(wl.face.a[0], wl.face.a[1]); c.lineTo(wl.face.b[0], wl.face.b[1]); c.stroke(); }
      for (const t of trims) if (!t.done && sideReady(t.side)) { c.fillStyle = "#ffffff"; c.strokeStyle = "#5c4a12"; c.lineWidth = 0.6 / ms; c.beginPath(); c.arc(t.spot[0], t.spot[1], 2.2 / ms, 0, 7); c.fill(); c.stroke(); }
    },
    holes() { const p = ctx.pose(), out: [number, number, number][] = [[p.x, p.y, 2.4]]; const wp = walker.pos(); if (wp) out.push([wp[0], wp[1], 1.8]); return out; },
    hud: () => { const pct = finished ? 1 : wallsPct() * 0.85 + (trimsDone() / 4) * 0.15; return { lead: { label: "Painted", value: `${pct >= 1 ? "100" : (Math.floor(pct * 1000) / 10).toFixed(1)}%` }, meter: { label: "Trim", value: `${trimsDone()} / 4`, frac: trimsDone() / 4, good: trimsDone() === 4 }, pct }; },
    outcome: (o: Outcome) => ({ ...o, bumps, stars: [o.stars[0], o.stars[1], o.done && bumps === 0], extra: { label: "Paint Smudges", value: String(bumps) }, failLine: `The barn got to ${Math.floor((wallsPct() * 0.85 + (trimsDone() / 4) * 0.15) * 100)}%. Drive steadily beside each wall, then stop by the white marker and tap it as soon as a side is red.` }),
    banner: ok => (ok ? "Good As New!" : undefined),
    focus() { const pts: [number, number][] = barn.poly.map(q => [q[0], q[1]]); const [bx, by] = centroid(barn.poly); pts.push([bx, by + 9]); return pts; },
    sceneSecs: 4.2,
    autoInput(dt) {
      // the tests' driver: laps round the barn at a steady speed, then each side's trim (the test taps the marker)
      if (walker.busy()) return [0, 0];
      if (autoReady !== null) { if (trims[autoReady].done) autoReady = null; else return [0, 0]; }
      const p = ctx.pose();
      const todo = trims.filter(t => !t.done && sideReady(t.side)).sort((a, b) => Math.hypot(a.spot[0] - p.x, a.spot[1] - p.y) - Math.hypot(b.spot[0] - p.x, b.spot[1] - p.y));
      if (todo.length && (lapDone || wallsPct() > 0.985)) { const t = todo[0]; if (Math.hypot(t.spot[0] - p.x, t.spot[1] - p.y) < 1.3) { autoReady = t.side; return [0, 0]; } return router.drive(dt, t.spot[0], t.spot[1], 4, 0.7); }
      if (wp < 0) { let bd = Infinity; loop.forEach((q, i) => { const d = Math.hypot(q[0] - p.x, q[1] - p.y); if (d < bd) { bd = d; wp = i; } }); wpN = 0; }
      const q = loop[wp];
      if (Math.hypot(q[0] - p.x, q[1] - p.y) < 1.4) { wp = (wp + 1) % loop.length; wpN++; if (wpN >= loop.length) { lapDone = true; wpN = 0; } }
      return router.drive(dt, loop[wp][0], loop[wp][1], 0, 0.66);
    },
    debug: () => ({ walls: wallsPct(), sides: [0, 1, 2, 3].map(sidePct), trims: trims.map(t => ({ side: t.side, done: t.done, x: t.spot[0], y: t.spot[1] })), ready: autoReady !== null ? { x: trims[autoReady].spot[0], y: trims[autoReady].spot[1] } : null, bumps, walk: walker.state(), finished, sprayT }),
  };

}

// ══════════════════════════════ Lawn Games, and Nets And The Slip And Slide ══════════════════════════════
const gamesChore = (ctx: ChoreCtx) => setupChore(ctx, "games");
const netsChore = (ctx: ChoreCtx) => setupChore(ctx, "nets");
type Target = { kind: GameKind; name: string; st: 0 | 1 | 2; pieces: number; outline: Pt[]; at: Pt[]; park: Pt; solid: Shape[] };
function setupChore(ctx: ChoreCtx, which: "games" | "nets"): Chore {
  const m = ctx.map, L = partyLayout(m), look = summerLook(ctx), games = which === "games";
  ctx.place(...U(m, 1040, 640), 0);
  const NAMES: Record<GameKind, string> = { cornhole: "Cornhole", ladder: "Ladder Ball", bocce: "Bocce", badminton: "Badminton Net", goal: "Soccer Goal" };
  const kinds: GameKind[] = games ? ["cornhole", "ladder", "bocce"] : ["badminton", "goal"];
  const parkOf = (k: GameKind): Pt => (L as unknown as Record<string, { park: Pt }>)[k].park;
  const targets: Target[] = kinds.map(k => ({ kind: k, name: NAMES[k], st: 0, pieces: 0, outline: outlineFor(k, L), at: piecesFor(k, L), park: parkOf(k), solid: solidsFor(k, L) }));
  const loads: string[] = games ? ["cornhole", "ladder", "bocce"] : ["badminton", "goal", "slide"];
  // what was set up before today: the lawn games (for the nets job), and the tent either way
  const before: Have = games ? {} : { ...ALL_GAMES };
  const fixed: Shape[] = [partySolids(L)[0], ...L.lights.map(q => ({ k: 1 as const, x: q[0], y: q[1], r: 0.15 }))];   // the tent and the light posts
  if (!games) for (const k of ["cornhole", "ladder", "bocce"] as GameKind[]) fixed.push(...solidsFor(k, L));
  let solidW: World | null = null;
  const refreshSolids = () => { const sh = [...fixed]; for (const t of targets) if (t.pieces > 0) sh.push(...t.solid); solidW = { ...ctx.w, shapes: sh }; };
  refreshSolids();
  const cart = makeTrailer(ctx, () => solidW, { tongue: 1.55, offs: [0.42, -0.42], r: 0.58 });
  const walker = makeWalker(ctx, 4.0);
  const blocked = (x: number, y: number) => !!solidW && solidW.shapes.some(sh => sdShape(sh, x, y) < BODY_R + 0.45);
  const router = makeRouter(ctx, blocked);
  let loaded = 0, loading = false; const inCart: string[] = [];
  // the slip and slide: 0 in the cart, 1 the end's staked down and it's unrolling, 2 all rolled out, 3 the water's on
  const S = L.slide, sLen = Math.hypot(S.b[0] - S.a[0], S.b[1] - S.a[1]), su: Pt = [(S.b[0] - S.a[0]) / sLen, (S.b[1] - S.a[1]) / sLen];
  let slideSt = 0, prog = 0, wet = 0, strays = 0, offLine = false, hoseWalk = false, autoReady: Pt | null = null, autoStage = 0;
  const placed = () => targets.filter(t => t.st === 2).length + (games ? 0 : slideSt >= 3 ? 1 : 0);
  const total = targets.length + (games ? 0 : 1);
  const cartSide = (): Pt => { const k = cart.c, p = ctx.pose(), sx = -Math.sin(k.a), sy = Math.cos(k.a), side = (p.x - k.ax) * sx + (p.y - k.ay) * sy >= 0 ? 1 : -1; return [k.ax + sx * side * 0.95, k.ay + sy * side * 0.95]; };
  const near = (q: Pt) => { const p = ctx.pose(); return Math.min(Math.hypot(q[0] - p.x, q[1] - p.y), Math.hypot(q[0] - cart.c.ax, q[1] - cart.c.ay)); };
  const nearPoly = (poly: Pt[]) => { const p = ctx.pose(); return Math.min(pip(poly, p.x, p.y) ? 0 : polyClosest(poly, p.x, p.y).d, pip(poly, cart.c.ax, cart.c.ay) ? 0 : polyClosest(poly, cart.c.ax, cart.c.ay).d); };
  const stopped = () => Math.abs(ctx.pose().v) < 1.5;
  const doorIn: Pt = [L.door.base[0] - L.door.n[0] * 0.5, L.door.base[1] - L.door.n[1] * 0.5];
  function tapLoad() {
    if (walker.busy() || loaded || loading) return;
    if (near(L.door.mark) > REACH) { ctx.say("Pull Up Closer To The Barn Door"); return; }
    loading = true; autoReady = null;
    // in through the door, out with the lot stacked in his arms, into the cart
    walker.start([{ to: () => doorIn, carry: null, act: 0.45 }, { to: cartSide, carry: `stack:${loads.join(",")}`, act: 0.35, done: () => { inCart.push(...loads); ctx.snd.clank(); loaded = 1; loading = false; ctx.say(games ? "All Loaded! Off To The Field" : "Loaded! Nets First, Or The Slide"); } }], L.door.mark);
  }
  function tapTarget(t: Target) {
    if (walker.busy() || t.st) return;
    if (!loaded) { ctx.say("Load Up At The Barn First"); return; }
    if (nearPoly(t.outline) > 4.0) { ctx.say("Pull Up Closer To The Spot"); return; }
    t.st = 1; autoReady = null;
    const steps: WStep[] = [{ to: cartSide, carry: null, act: 0.25, done: () => { const i = inCart.indexOf(t.kind); if (i >= 0) inCart.splice(i, 1); } }];
    t.at.forEach((q, i) => steps.push({ to: () => q, carry: i === t.at.length - 1 ? null : t.kind, act: t.at.length === 1 ? 1.0 : 0.45, bend: 0.85, done: () => { t.pieces = i + 1; refreshSolids(); ctx.snd.pop(); if (i === t.at.length - 1) { t.st = 2; ctx.snd.coin(); ctx.floatAt(`${t.name} Ready!`, q[0], q[1] - 1, "#fff4c2"); } } }));
    walker.start(steps, t.at[0]);
  }
  function tapSlide() {
    if (walker.busy()) return;
    if (!loaded) { ctx.say("Load Up At The Barn First"); return; }
    if (slideSt === 0) {
      if (near(S.a) > REACH) { ctx.say("Pull Up Closer To The Start"); return; }
      autoReady = null;
      walker.start([{ to: () => [S.a[0] - su[0] * 0.2, S.a[1] - su[1] * 0.2], act: 0.8, bend: 0.85, done: () => { slideSt = 1; ctx.snd.clank(); ctx.say("Now Drive Along The Line"); } }], S.a);
    } else if (slideSt === 2) {
      if (near(L.reel) > REACH) { ctx.say("Pull Up Closer To The Hose"); return; }
      autoReady = null; hoseWalk = true;
      walker.start([{ to: () => L.reel, act: 0.3, bend: 0.5 }, { to: () => [S.b[0] + su[0] * 0.25, S.b[1] + su[1] * 0.25], act: 0.8, bend: 0.6, done: () => { slideSt = 3; hoseWalk = false; ctx.snd.chime(); ctx.say("Slip And Slide Is On!"); } }], L.reel);
    }
  }
  let autoPush: [number, number] = [0, 0];
  const have = (): Have => { const h: Have = { ...before }; for (const t of targets) if (t.pieces) h[t.kind] = t.pieces; if (!games) { h.slide = prog; h.wet = wet; } return h; };
  return {
    noTufts: true,
    hold: () => walker.busy(), patOff: () => walker.busy(),
    step(dt) {
      walker.step(dt); if (cart.update(dt)) ctx.shake(0.1);
      if (slideSt === 3) wet = Math.min(1, wet + dt / 1.6);
      if (slideSt === 1 && ctx.phase() === "play") {
        const dx = cart.c.ax - S.a[0], dy = cart.c.ay - S.a[1], along = dx * su[0] + dy * su[1], lat = Math.abs(-dx * su[1] + dy * su[0]);
        if (lat < 1.3 && along > prog * sLen - 1.2 && along < sLen + 1.5) { prog = clamp(Math.max(prog, along / sLen), 0, 1); offLine = false; }
        else if (lat >= 1.3 && along > 0.3 && along < sLen - 0.3 && prog > 0.03 && !offLine) { offLine = true; strays++; ctx.say("Back To The Line"); ctx.snd.bump(); }
        if (prog >= 1) { slideSt = 2; ctx.snd.coin(); ctx.say("Now Turn On The Hose"); const i = inCart.indexOf("slide"); if (i >= 0) inCart.splice(i, 1); }
      }
    },
    tap(wx, wy) {
      if (ctx.phase() !== "play") return;
      if (!loaded) { if (Math.hypot(wx - L.door.mark[0], wy - L.door.mark[1]) < 2.4 || Math.hypot(wx - L.door.base[0], wy - L.door.base[1]) < 2.4) tapLoad(); else if (targets.some(t => pip(t.outline, wx, wy))) ctx.say("Load Up At The Barn First"); return; }
      const t = targets.find(q => !q.st && (pip(q.outline, wx, wy) || polyClosest(q.outline, wx, wy).d < 1.2)); if (t) { tapTarget(t); return; }
      if (!games && slideSt === 0 && Math.hypot(wx - S.a[0], wy - S.a[1]) < 2) tapSlide();
      if (!games && slideSt === 2 && (Math.hypot(wx - L.reel[0], wy - L.reel[1]) < 2 || Math.hypot(wx - S.b[0], wy - S.b[1]) < 1.6)) tapSlide();
    },
    done: () => placed() === total && !walker.busy(),
    drawGround(c, time, cx, cy, vw, vh) {
      look(c, cx, cy, vw, vh);
      const h = have();
      drawPartyGround(c, L, h, time, false);
      const p = ctx.pose();
      for (const t of targets) if (t.st === 0) drawOutline(c, t.outline, time, !!loaded && !walker.busy() && stopped() && nearPoly(t.outline) <= 4.0);
      if (!loaded) drawMarker(c, L.door.mark[0], L.door.mark[1], 0.9, time, !walker.busy() && stopped() && near(L.door.mark) <= REACH);
      if (!games) {
        if (slideSt <= 1) { c.save(); c.setLineDash([0.45, 0.3]); c.lineDashOffset = -time * 0.5; c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 0.1; for (const s2 of [-0.55, 0.55]) { c.beginPath(); c.moveTo(S.a[0] - su[1] * s2 + su[0] * prog * sLen, S.a[1] + su[0] * s2 + su[1] * prog * sLen); c.lineTo(S.b[0] - su[1] * s2, S.b[1] + su[0] * s2); c.stroke(); } c.setLineDash([]); c.restore(); }
        if (slideSt === 0) drawMarker(c, S.a[0], S.a[1], 0.8, time, !!loaded && !walker.busy() && stopped() && near(S.a) <= REACH);
        if (slideSt <= 2) { drawHose(c, [L.reel], false); if (slideSt === 2) drawMarker(c, L.reel[0], L.reel[1], 0.75, time, !walker.busy() && stopped() && near(L.reel) <= REACH); }
        const wp = walker.pos(); if (hoseWalk && wp) drawHose(c, [L.reel, wp], false);
      }
      void p;
    },
    drawBelow(c) {
      drawCart(c, cart.c.ax, cart.c.ay, cart.c.a, cart.TONGUE, {});
      inCart.forEach((it, i) => { const lx = 0.3 - (i % 2) * 0.62, ly = i < 2 ? -0.12 : 0.18; drawLoad(c, it, cart.c.ax + Math.cos(cart.c.a) * lx - Math.sin(cart.c.a) * ly, cart.c.ay + Math.sin(cart.c.a) * lx + Math.cos(cart.c.a) * ly, cart.c.a + (it === "slide" ? 0 : Math.PI / 2)); });
    },
    drawAbove(c, time) {
      drawPartyStanding(c, L, have(), time, false);
      walker.draw(c, time);
      drawPartyAbove(c, L, time, 0);
    },
    drawScreen(c, sx, sy, CW, MH, time) {
      if (ctx.phase() !== "play" && ctx.phase() !== "ready") return;
      const p = ctx.pose();
      if (!walker.busy() && stopped()) {
        let msg = "";
        if (!loaded && !loading && near(L.door.mark) <= REACH) msg = "Tap The Barn Door";
        else if (loaded && targets.some(t => !t.st && nearPoly(t.outline) <= 4.0)) msg = "Tap The Outline";
        else if (!games && loaded && slideSt === 0 && near(S.a) <= REACH) msg = "Tap The Start Of The Line";
        else if (!games && slideSt === 2 && near(L.reel) <= REACH) msg = "Tap The Hose";
        if (msg) pill(c, msg, CW / 2, MH - 30, 13, "#2f5a1f", "rgba(255,255,255,0.97)", 16, 32);
      }
      if (!games && slideSt === 1 && offLine) pill(c, "Back To The Line", CW / 2, MH - 30, 13, "#b03a2e", "rgba(255,255,255,0.95)", 16, 32);
      if (walker.busy()) return;
      // off screen: an arrow on the edge to where to go next
      let q: Pt | null = null;
      if (!loaded) q = L.door.mark;
      else if (!games && slideSt === 1) q = S.b;
      else if (!games && slideSt === 2) q = L.reel;
      else { let bd = Infinity; for (const t of targets) if (!t.st) { const cc = centroid(t.outline), d = Math.hypot(cc[0] - p.x, cc[1] - p.y); if (d < bd) { bd = d; q = cc; } } if (!games && slideSt === 0) { const d = Math.hypot(S.a[0] - p.x, S.a[1] - p.y); if (d < bd) q = S.a; } }
      if (q) edgeArrow(c, sx(q[0]), sy(q[1]), sx(p.x), sy(p.y), CW, MH, time, `${Math.round(Math.hypot(q[0] - p.x, q[1] - p.y))} m`);
    },
    drawMini(c, ms) {
      const dot = (q: Pt, col: string) => { c.fillStyle = col; c.strokeStyle = "#fff"; c.lineWidth = 0.6 / ms; c.beginPath(); c.arc(q[0], q[1], 2.3 / ms, 0, 7); c.fill(); c.stroke(); };
      if (!loaded) dot(L.door.mark, "#ffcf2e");
      for (const t of targets) if (!t.st) dot(centroid(t.outline), loaded ? "#ffcf2e" : "rgba(255,255,255,0.9)");
      if (!games && slideSt < 3) dot(slideSt === 2 ? L.reel : S.a, loaded ? "#2f7fd6" : "rgba(255,255,255,0.9)");
    },
    holes() { const out: [number, number, number][] = [[cart.c.ax, cart.c.ay, 1.8]]; const wp = walker.pos(); if (wp) out.push([wp[0], wp[1], 1.6]); return out; },
    push: (x, y, r) => (solidW ? pushOut(solidW, x, y, r, null) : null),
    hud: () => {
      const pct = games ? (loaded ? 0.1 : 0) + targets.reduce((a, t) => a + (t.pieces / t.at.length) * 0.3, 0) : (loaded ? 0.1 : 0) + targets.reduce((a, t) => a + (t.pieces / t.at.length) * 0.25, 0) + (slideSt >= 1 ? 0.05 : 0) + prog * 0.25 + (slideSt >= 3 ? 0.1 : 0);
      const meter = games ? { label: "Cat Stops", value: String(ctx.meows()), frac: 0, good: ctx.meows() === 0 } : { label: "Slide", value: slideSt === 0 ? "Rolled Up" : slideSt === 1 ? `${Math.round(prog * 100)}%` : slideSt === 2 ? "Needs Water" : "Wet!", frac: prog, good: strays === 0 };
      return { lead: { label: games ? "Games" : "Set Up", value: `${placed()} / ${total}` }, meter, pct: clamp(pct, 0, 1) };
    },
    outcome: (o: Outcome) => games
      ? ({ ...o, extra: { label: "Cat Stops", value: String(o.meows) }, failLine: `Pat set up ${placed()} of ${total} games. Load up at the barn door, then stop right beside each outline so he only has a few steps to walk.` })
      : ({ ...o, stars: [o.stars[0], o.stars[1], o.done && strays === 0], extra: { label: "Slide Laid", value: strays ? `${strays} Wobble${strays > 1 ? "s" : ""}` : "Straight" }, failLine: `Pat got ${placed()} of ${total} things set up. Stop close to each outline, and keep the cart on the dashed line while the slide rolls out.` }),
    banner: ok => (ok ? (games ? "Game On!" : "Ready For A Splash!") : undefined),
    focus() { const pts: [number, number][] = targets.map(t => centroid(t.outline)); if (!games) pts.push(S.a, S.b); return pts; },
    autoInput(dt) {
      // the tests' driver: load at the barn, then each target from its parking spot (the test taps the spot)
      if (walker.busy() || loading) return [0, 0];
      if (autoReady) return [0, 0];
      const p = ctx.pose();
      const goTo = (q: Pt, tol: number, slow = 4, top = 1): boolean => { if (Math.hypot(q[0] - p.x, q[1] - p.y) < tol) return true; autoPush = router.drive(dt, q[0], q[1], slow, top); return false; };
      autoPush = [0, 0];
      if (!loaded) { if (goTo(L.door.park, 1.0)) autoReady = L.door.mark; return autoPush; }
      const next = targets.find(t => !t.st);
      if (next) { if (goTo(next.park, 1.0)) autoReady = centroid(next.outline); return autoPush; }
      if (!games) {
        if (slideSt === 0) { if (autoStage === 0) { if (goTo(S.pre, 1.3)) autoStage = 1; return autoPush; } if (goTo(S.ready, 0.7, 3, 0.6)) autoReady = S.a; return autoPush; }
        if (slideSt === 1) { const d = Math.hypot(S.past[0] - p.x, S.past[1] - p.y); if (d < 0.8) return [0, 0]; return [su[0] * 0.55, su[1] * 0.55]; }
        if (slideSt === 2) { autoReady = L.reel; return [0, 0]; }
      }
      return [0, 0];
    },
    debug: () => ({ loaded, inCart: [...inCart], placed: placed(), total, targets: targets.map(t => ({ kind: t.kind, st: t.st, pieces: t.pieces })), slide: slideSt, prog, strays, ready: autoReady ? { x: autoReady[0], y: autoReady[1] } : null, walk: walker.state(), stage: slideSt, cart: cart.c }),
  };
}

// ══════════════════════════════ Party Day ══════════════════════════════
const RIDES: { name: string; flags: [number, number][] }[] = [
  { name: "Round The Games", flags: [[893, 470], [680, 440], [420, 470], [390, 760], [520, 960], [820, 940], [870, 720], [900, 520]] },
  { name: "Down To The Barn", flags: [[1130, 462], [1045, 700], [1018, 850], [1130, 897], [1250, 790], [1250, 690], [1180, 590]] },
  { name: "Up By The Woods", flags: [[915, 322], [700, 285], [540, 330], [800, 352], [840, 440], [900, 520]] },
];
function partyChore(ctx: ChoreCtx): Chore {
  const m = ctx.map, L = partyLayout(m), look = summerLook(ctx), R = 4.4, BOX_R = 2.9, RIDE_N = 3;
  ctx.place(...U(m, 1150, 432), Math.PI);
  const rides = RIDES.map(r => ({ name: r.name, flags: r.flags.map(([ux, uy]) => U(m, ux, uy)) }));
  const solidW: World = { ...ctx.w, shapes: [...partySolids(L), ...(["cornhole", "ladder", "bocce", "badminton", "goal"] as GameKind[]).flatMap(k => solidsFor(k, L))] };
  const wagon = makeTrailer(ctx, () => solidW, { tongue: WAGON.tongue, offs: [0.75, -0.75], r: 0.78 });
  const router = makeRouter(ctx, (x, y) => solidW.shapes.some(sh => sdShape(sh, x, y) < BODY_R + 0.6));
  // each ride's kids: they wait by the box, climb on, ride, and hop off at the tent
  const groups: (Guest & { wave?: number })[][] = [0, 1, 2].map(g => [0, 1, 2, 3].map(k => ({ ...guest(40 + g * 4 + k) })));
  type St = "pickup" | "board" | "ride" | "back" | "unload" | "done";
  let st: St = "pickup", ride = 0, next = 0, stT = 0, bumps = 0, bumpT = 0, say = { t: "", life: 0 }, hearts = 0, wheeT = 8, dusk = 0, sceneT = 0;
  const box = L.box;
  const waitAt = (k: number): Pt => [box[0] - 3.4, box[1] - 1.2 + k * 0.8];
  const tentAt = (k: number): Pt => [L.tent.c[0] - 1.35 + k * 0.9, L.tent.c[1] + L.tent.d / 2 - 0.7];   // just in under the tent's edge (they join the party)
  const seatAt = (k: number): Pt => { const s = k % 2 ? 1 : -1, kx = k < 2 ? 0.55 : -0.6, c = wagon.c; return [c.ax + Math.cos(c.a) * kx - Math.sin(c.a) * s * (WAGON.wid / 2 - 0.3), c.ay + Math.sin(c.a) * kx + Math.cos(c.a) * s * (WAGON.wid / 2 - 0.3)]; };
  const kidsSay = (t: string, life = 2.2) => { say = { t, life }; };
  const bump = () => { bumps++; bumpT = 1.2; ctx.shake(0.18); ctx.buzz(); kidsSay(["Whoa!", "Hold On!", "Easy, Pat!"][Math.min(2, bumps - 1)]); ctx.snd.bump(); };
  const inBox = () => { const p = ctx.pose(); return Math.min(Math.hypot(p.x - box[0], p.y - box[1]), Math.hypot(wagon.c.ax - box[0], wagon.c.ay - box[1])) < BOX_R; };
  const flags = () => rides[Math.min(ride, RIDE_N - 1)].flags;
  const progress = () => { if (st === "done") return 1; const per = 1 / RIDE_N, f = flags().length; let u = 0; if (st === "board") u = 0.05; if (st === "ride") u = 0.08 + (next / f) * 0.8; if (st === "back") u = 0.9; if (st === "unload") u = 0.96; return clamp(ride * per + u * per, 0, 1); };
  return {
    noTufts: true, catDeck: true, sceneSecs: 6.5,
    hold: () => false, patOff: () => false,
    step(dt) {
      const ph = ctx.phase();
      if (wagon.update(dt) && ph === "play") bump();
      say.life -= dt; hearts = Math.max(0, hearts - dt); bumpT = Math.max(0, bumpT - dt);
      if (ph === "scene" || ph === "over") { sceneT += dt; dusk = Math.min(1, sceneT / 2.5); }
      if (ph !== "play") return;
      stT += dt;
      const p = ctx.pose(), still = Math.abs(p.v) < 0.4;
      if (st === "pickup" && inBox() && still) { st = "board"; stT = 0; ctx.snd.click(); }
      else if (st === "board") { if (!inBox() || !still) { if (stT < 1.6) { st = "pickup"; stT = 0; } } if (stT >= 1.6 && st === "board") { st = "ride"; next = 0; stT = 0; kidsSay(ride === 0 ? "Let's Go, Pat!" : ride === 1 ? "Our Turn!" : "Last Ride!"); ctx.say(`Ride ${ride + 1}: ${rides[ride].name}`); } }
      else if (st === "ride") {
        const f = flags()[next];
        if (Math.hypot(f[0] - p.x, f[1] - p.y) < R) { next++; ctx.snd.coin(); if (next >= flags().length) { st = "back"; ctx.say("Back To The Tent"); } }
        wheeT -= dt; if (wheeT <= 0 && Math.abs(p.v) > 4.5 && bumpT <= 0 && say.life <= 0) { wheeT = 9 + Math.random() * 6; kidsSay(bumps ? "That's Better" : ["Wheee!", "Faster, Pat!", "Hi Grandma!"][Math.floor(Math.random() * 3)]); }
      } else if (st === "back" && inBox() && still) { st = "unload"; stT = 0; hearts = 2.2; kidsSay(bumps ? "Thanks, Pat!" : "Again! Again!"); ctx.snd.chime(); }
      else if (st === "unload" && stT >= 1.3) { ride++; stT = 0; if (ride >= RIDE_N) st = "done"; else st = inBox() && still ? "board" : "pickup"; }
    },
    hit(into) { if (into > 1.2 && ctx.phase() === "play" && bumpT <= 0) bump(); },
    done: () => st === "done",
    drawBuilding(c, b, time) { if (b.kind !== "deck") return false; return drawDeckWithLinda(c, m, L, time, ctx.phase() === "scene" || ctx.phase() === "over" ? 0.5 + 0.5 * Math.sin(time * 1.4) : 0.4 + 0.4 * Math.sin(time * 0.5)); },
    drawGround(c, time, cx, cy, vw, vh) {
      look(c, cx, cy, vw, vh);
      drawPartyGround(c, L, ALL_SET, time, true);
      // the pickup box with its little sign, and the flags for this ride
      const ready = st === "pickup" || st === "back" || st === "board" || st === "unload";
      c.save(); c.setLineDash([0.45, 0.3]); c.lineDashOffset = -time * 0.4; c.strokeStyle = ready ? "rgba(255,214,64,0.95)" : "rgba(255,255,255,0.75)"; c.lineWidth = 0.12; c.beginPath(); c.arc(box[0], box[1], BOX_R, 0, 7); c.stroke(); c.setLineDash([]);
      if (ready) { c.fillStyle = `rgba(255,214,64,${(0.12 + 0.08 * Math.sin(time * 4)).toFixed(3)})`; c.beginPath(); c.arc(box[0], box[1], BOX_R, 0, 7); c.fill(); }
      c.restore();
      c.save(); c.translate(box[0] - BOX_R - 0.3, box[1] - BOX_R + 0.4); c.strokeStyle = "#7a5a3a"; c.lineWidth = 0.08; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -1.0); c.stroke(); c.fillStyle = "#d9b77a"; c.beginPath(); c.roundRect(-0.85, -1.55, 1.7, 0.6, 0.08); c.fill(); c.strokeStyle = "#8a6a3a"; c.lineWidth = 0.04; c.stroke(); c.save(); c.scale(0.02, 0.02); c.fillStyle = "#5c3a12"; c.font = `800 15px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("Hay Rides", 0, -1.25 * 50); c.restore(); c.restore();
      if (st === "ride") flags().forEach((f, i) => { if (i >= next) drawFlag(c, f[0], f[1], R, time, i === next ? "next" : "later", String(i + 1)); });
      // the kids: waiting by the box, climbing on, hopping off and walking to the tent
      const g = groups[Math.min(ride, RIDE_N - 1)];
      if (st === "pickup") g.forEach((k, i) => { const [x, y] = waitAt(i); drawPerson(c, x, y, 0, k.shirt, k.hair, k.skin, Math.sin(time * 3 + i) > 0.6 ? "throw" : "stand", time + i, 1.05); });
      if (st === "board") g.forEach((k, i) => { const u = clamp(stT / 1.4, 0, 1), [ax, ay] = waitAt(i), [bx, by] = seatAt(i); drawPerson(c, ax + (bx - ax) * u, ay + (by - ay) * u, Math.atan2(by - ay, bx - ax), k.shirt, k.hair, k.skin, "stand", time * 2 + i, 1.05); });
      if (st === "unload" && ride < RIDE_N) groups[ride].forEach((k, i) => { const u = clamp(stT / 1.3, 0, 1), [ax, ay] = seatAt(i), [bx, by] = tentAt(i); c.save(); c.globalAlpha = 1 - Math.max(0, u - 0.7) / 0.3; drawPerson(c, ax + (bx - ax) * u, ay + (by - ay) * u, Math.atan2(by - ay, bx - ax), k.shirt, k.hair, k.skin, "stand", time * 2 + i, 1.05); c.restore(); });
      drawPartyHouse(c, m, L, time, dusk, 0);
    },
    drawBelow(c, time) {
      const riding = st === "ride" || st === "back";
      const kids = riding ? groups[ride].map((k, i) => ({ ...k, wave: say.life > 0 && i < 2 ? 1 : 0 })) : [];
      drawHayWagon(c, wagon.c.ax, wagon.c.ay, wagon.c.a, kids, time, Math.abs(ctx.pose().v) > 1 ? Math.sin(time * 9) : 0);
    },
    drawAbove(c, time) { drawPartyStanding(c, L, ALL_SET, time, true); drawPartyAbove(c, L, time, dusk); },
    drawScreen(c, sx, sy, CW, MH, time) {
      // dusk at the end: a deep blue evening, the string lights glowing
      if (dusk > 0) {
        c.save(); c.globalCompositeOperation = "multiply"; c.fillStyle = `rgba(70,80,150,${(0.45 * dusk).toFixed(3)})`; c.fillRect(0, 0, CW, MH); c.restore();
        c.save(); c.globalCompositeOperation = "lighter";
        const S0 = Math.abs(sx(1) - sx(0));
        for (const q of stringLightPts([...L.lights, L.lights[0]])) { const x = sx(q[0]), y = sy(q[1] + 0.06), r = 0.75 * S0; const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,205,120,${(0.16 * dusk).toFixed(3)})`); gr.addColorStop(0.45, `rgba(255,205,120,${(0.06 * dusk).toFixed(3)})`); gr.addColorStop(1, "rgba(255,205,120,0)"); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
        { const x = sx(L.tent.c[0]), y = sy(L.tent.c[1]), r = 3.5 * S0, gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,200,120,${(0.14 * dusk).toFixed(3)})`); gr.addColorStop(1, "rgba(255,200,120,0)"); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
        c.restore();
      }
      const wx = sx(wagon.c.ax), wy = sy(wagon.c.ay) - 32, bx = clamp(wx, 30, CW - 30), by = clamp(wy, 48, MH - 30);
      if (say.life > 0) bubble(c, wx, wy, say.t, Math.min(1, say.life * 3), CW, MH);
      if (hearts > 0) for (let k = 0; k < 3; k++) { const u = (2.2 - hearts) / 2.2 + k * 0.12; heart(c, bx - 14 + k * 14, by - 8 - u * 26, 1.3, Math.max(0, 1 - u)); }
      if (ctx.phase() !== "play" && ctx.phase() !== "ready") return;
      const p = ctx.pose();
      if ((st === "pickup" || st === "back") && inBox() && Math.abs(p.v) >= 0.4) pill(c, "Stop Here!", CW / 2, MH - 30, 13, "#2f5a1f", "rgba(255,255,255,0.97)", 16, 32);
      else if (st === "board") pill(c, "The Kids Are Climbing On", CW / 2, MH - 30, 13, "#2f5a1f", "rgba(255,255,255,0.97)", 16, 32);
      else if (st === "unload") pill(c, "Everybody Off!", CW / 2, MH - 30, 13, "#2f5a1f", "rgba(255,255,255,0.97)", 16, 32);
      const q: Pt | null = st === "ride" ? flags()[next] : st === "pickup" || st === "back" ? box : null;
      if (q) edgeArrow(c, sx(q[0]), sy(q[1]), sx(p.x), sy(p.y), CW, MH, time);
    },
    drawMini(c, ms) {
      const dot = (q: Pt, col: string, r = 2.2) => { c.fillStyle = col; c.strokeStyle = "rgba(60,50,20,0.7)"; c.lineWidth = 0.6 / ms; c.beginPath(); c.arc(q[0], q[1], r / ms, 0, 7); c.fill(); c.stroke(); };
      if (st === "ride") flags().forEach((f, i) => { if (i >= next) dot(f, i === next ? "#ffcf2e" : "rgba(255,255,255,0.9)", i === next ? 2.8 : 1.8); });
      else if (st !== "done") dot(box, "#ffcf2e", 2.8);
    },
    holes() { return [[wagon.c.ax, wagon.c.ay, 2.2]]; },
    push: (x, y, r) => pushOut(solidW, x, y, r, null),
    hud: () => ({ lead: { label: "Rides", value: `${Math.min(RIDE_N, ride + (st === "done" ? 0 : 1))} / ${RIDE_N}` }, meter: { label: "Kids", value: bumps ? `${bumps} Bump${bumps > 1 ? "s" : ""}` : "Happy", frac: 0, good: bumps === 0 }, pct: progress() }),
    outcome: (o: Outcome) => ({ ...o, bumps, stars: [o.stars[0], o.stars[1], o.done && bumps === 0], extra: { label: "Bumps", value: String(bumps) }, failLine: `Pat gave ${ride} of ${RIDE_N} rides. Stop in the box by the tent, go through each flag in order, and swing wide so the wagon clears the corners.` }),
    banner: ok => { if (ok) { kidsSay("Best Party Ever!", 6); hearts = 2.2; } return ok ? "What A Party!" : undefined; },
    focus() { return [L.tent.c, L.box, L.linda, [L.tent.c[0] + 3, L.tent.c[1] + 5]]; },
    autoInput(dt) {
      // the tests' driver: into the box, wait for the kids, then the flags in order, then back to the box
      if (st === "board" || st === "unload" || st === "done") return [0, 0];
      if (st === "pickup" || st === "back") { if (inBox()) return [0, 0]; return router.drive(dt, box[0], box[1], 6, 0.8); }
      const f = flags()[next]; return router.drive(dt, f[0], f[1], 0, 0.85);
    },
    debug: () => ({ st, ride, next, bumps, cartHits: wagon.c.hits, wagon: wagon.c, ready: null }),
  };
}
