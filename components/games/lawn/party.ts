// Chapter 6: where everything for the annual party goes, and the party itself drawn on the lawn. The lawn games and the
// nets go in the big field just through the gate from the fire pit; the tent, the tables and the string lights go on the
// lawn south of the deck; the hay rides start from a box beside the deck. Each job draws what earlier jobs set up
// (`have`), and on Party Day everyone's out playing (`live`).
import type { LawnMap, Pt } from "../lawnMap";
import { polyShape, type Shape } from "./geo";
import { drawPerson, drawFire, drawBuilding } from "./art";
import { drawCar, drawLinda } from "./fallArt";
import {
  drawCornhole, drawBag, drawLadderBall, drawBola, drawBocceCourt, drawBall, drawBadminton, drawGoal, drawSoccerBall, drawSlide, drawHose, drawTent,
  drawTable, drawStringLights, drawSlider, drawPole, drawShuttle, guest,
} from "./summerArt";

const U = (m: LawnMap, ux: number, uy: number): Pt => [ux * 0.075 - m.origin[0], (uy + 130) * 0.075 - m.origin[1]];
export type GameKind = "cornhole" | "ladder" | "bocce" | "badminton" | "goal";
export type Layout = ReturnType<typeof partyLayout>;

export function partyLayout(m: LawnMap) {
  const P = (ux: number, uy: number) => U(m, ux, uy);
  // the barn's big doors on the north side, by the concrete pad (where the party things are stored)
  const barn = m.buildings.find(b => b.kind === "barn")!, pad = m.pads.find(q => q.kind === "concrete");
  const [A, B] = barn.poly, L = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / L, uy = (B[1] - A[1]) / L;
  const pc = pad ? pad.poly.reduce((a, q) => [a[0] + q[0] / pad.poly.length, a[1] + q[1] / pad.poly.length], [0, 0]) : [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  const tc = Math.max(2, Math.min(L - 2, (pc[0] - A[0]) * ux + (pc[1] - A[1]) * uy)), n: Pt = [uy, -ux];   // (north of the wall)
  const doorBase: Pt = [A[0] + ux * tc, A[1] + uy * tc];
  const slideA = P(560, 650), slideB = P(560, 790);
  return {
    door: { base: doorBase, mark: [doorBase[0] + n[0] * 2.5, doorBase[1] + n[1] * 2.5] as Pt, n, park: P(1136, 680) },   // (the marker's out past the roof's edge, where it shows)
    cornhole: { a: P(790, 510), b: P(790, 580), park: P(822, 545) },
    ladder: { a: P(690, 510), b: P(690, 580), park: P(724, 545) },
    bocce: { c: P(745, 680), L: 8, W: 3, park: P(745, 628) },
    badminton: { a: P(470, 545), b: P(550, 545), park: P(510, 598) },
    goal: { c: P(700, 880), fwd: -Math.PI / 2, park: P(700, 842) },   // at the south end of the field, facing up it
    slide: { a: slideA, b: slideB, pre: P(560, 585), ready: P(560, 624), past: P(560, 838) },
    reel: P(586, 806),
    tent: { c: P(1105, 345), w: 4.6, d: 4.2 },
    tables: [{ c: P(1105, 294), a: 0 }, { c: P(1172, 352), a: Math.PI / 2 }],
    lights: [P(1066, 308), P(1145, 308), P(1145, 383), P(1066, 383)],
    box: P(1012, 382),
    linda: P(1012, 284),
    cars: [{ c: P(1040, 118), h: 0, col: "#b8322a" }, { c: P(1080, 150), h: 0, col: "#e8e4da" }, { c: P(1118, 112), h: -0.1, col: "#3f6d8f" }],
  };
}

/** The dashed outline on the grass where a game goes (a little bigger than the game). */
export function outlineFor(k: GameKind, L: Layout): Pt[] {
  const rect = (a: Pt, b: Pt, side: number, ends: number): Pt[] => { const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy), u: Pt = [dx / d, dy / d], v: Pt = [-u[1], u[0]]; const A2: Pt = [a[0] - u[0] * ends, a[1] - u[1] * ends], B2: Pt = [b[0] + u[0] * ends, b[1] + u[1] * ends]; return [[A2[0] + v[0] * side, A2[1] + v[1] * side], [B2[0] + v[0] * side, B2[1] + v[1] * side], [B2[0] - v[0] * side, B2[1] - v[1] * side], [A2[0] - v[0] * side, A2[1] - v[1] * side]]; };
  if (k === "cornhole") return rect(L.cornhole.a, L.cornhole.b, 0.9, 0.9);
  if (k === "ladder") return rect(L.ladder.a, L.ladder.b, 0.9, 0.7);
  if (k === "bocce") { const { c, L: l, W } = L.bocce; return [[c[0] - l / 2 - 0.25, c[1] - W / 2 - 0.25], [c[0] + l / 2 + 0.25, c[1] - W / 2 - 0.25], [c[0] + l / 2 + 0.25, c[1] + W / 2 + 0.25], [c[0] - l / 2 - 0.25, c[1] + W / 2 + 0.25]]; }
  if (k === "badminton") return rect(L.badminton.a, L.badminton.b, 0.7, 0.5);
  return goalBox(L, 2.05, 0.5, 1.6);
}
/** A box round the goal: `side` out each side of centre, `front` ahead of the posts, `back` behind them. */
function goalBox(L: Layout, side: number, front: number, back: number): Pt[] {
  const { c, fwd } = L.goal, fx = Math.cos(fwd), fy = Math.sin(fwd), sx = -fy, sy = fx, at = (s: number, f: number): Pt => [c[0] + sx * s + fx * f, c[1] + sy * s + fy * f];
  return [at(-side, front), at(side, front), at(side, -back), at(-side, -back)];
}
/** Where Pat walks to put each piece down. */
export function piecesFor(k: GameKind, L: Layout): Pt[] {
  if (k === "cornhole") return [L.cornhole.a, L.cornhole.b];
  if (k === "ladder") return [[L.ladder.a[0], L.ladder.a[1] + 0.4], [L.ladder.b[0], L.ladder.b[1] + 0.4]];
  if (k === "bocce") { const { c, L: l } = L.bocce; return [[c[0] + l / 2 - 0.6, c[1]], [c[0] - l / 2 + 1.2, c[1]]]; }
  if (k === "badminton") return [L.badminton.a, L.badminton.b];
  return [[L.goal.c[0] + Math.cos(L.goal.fwd) * 0.6, L.goal.c[1] + Math.sin(L.goal.fwd) * 0.6]];
}
/** What the tractor bumps into once a game's set up. */
export function solidsFor(k: GameKind, L: Layout): Shape[] {
  const circ = (p: Pt, r: number): Shape => ({ k: 1, x: p[0], y: p[1], r });
  if (k === "cornhole") return [circ(L.cornhole.a, 0.55), circ(L.cornhole.b, 0.55)];
  if (k === "ladder") return [circ(L.ladder.a, 0.55), circ(L.ladder.b, 0.55)];
  if (k === "bocce") { const { c, L: l, W } = L.bocce; return [polyShape([[c[0] - l / 2, c[1] - W / 2], [c[0] + l / 2, c[1] - W / 2], [c[0] + l / 2, c[1] + W / 2], [c[0] - l / 2, c[1] + W / 2]])]; }
  if (k === "badminton") { const { a, b } = L.badminton; return [{ k: 2, ax: a[0], ay: a[1], bx: b[0], by: b[1], r: 0.15 }]; }
  return [polyShape(goalBox(L, 1.75, 0.1, 1.3))];
}
export function partySolids(L: Layout): Shape[] {
  const { c, w, d } = L.tent;
  return [polyShape([[c[0] - w / 2, c[1] - d / 2], [c[0] + w / 2, c[1] - d / 2], [c[0] + w / 2, c[1] + d / 2], [c[0] - w / 2, c[1] + d / 2]]),
    ...L.tables.map(tb => ({ k: 1 as const, x: tb.c[0], y: tb.c[1], r: 1.0 })), ...L.lights.map(p => ({ k: 1 as const, x: p[0], y: p[1], r: 0.15 })),
    ...L.cars.map(cr => ({ k: 1 as const, x: cr.c[0], y: cr.c[1], r: 1.4 }))];
}

/** How much of each thing is set up: pieces down (0, 1 or 2; the goal has one), how far the slide's rolled out, how wet. */
export type Have = { cornhole?: number; ladder?: number; bocce?: number; badminton?: number; goal?: number; slide?: number; wet?: number };
export const ALL_GAMES: Have = { cornhole: 2, ladder: 2, bocce: 2 }, ALL_SET: Have = { cornhole: 2, ladder: 2, bocce: 2, badminton: 2, goal: 1, slide: 1, wet: 1 };
const toss = (t: number, period: number) => { const u = (t % period) / period, dir = Math.floor(t / period) % 2; return { u, dir }; };
/** Everything set up so far, on the ground (games, nets, the slide), with folks playing when `live`. */
export function drawPartyGround(c: CanvasRenderingContext2D, L: Layout, h: Have, t: number, live: boolean) {
  const g = (i: number) => guest(i);
  if (h.bocce) {
    const { c: bc, L: l, W } = L.bocce; drawBocceCourt(c, bc[0], bc[1], 0, l, W);
    if (h.bocce < 2) drawBall(c, bc[0] + l / 2 - 0.6, bc[1], 0.13, "#d23a2e");
    else {
    const balls: [number, number, string][] = [[-1.6, 0.3, "#d23a2e"], [-1.9, -0.4, "#3f9a4a"], [-2.3, 0.1, "#d23a2e"], [-1.2, -0.2, "#3f9a4a"]];
    drawBall(c, bc[0] - l / 2 + 1.6, bc[1] + 0.1, 0.06, "#ffffff");
    for (const [ox, oy, col] of balls) drawBall(c, bc[0] - l / 2 + 2 + ox * 0.4, bc[1] + oy, 0.13, col);
    if (live) { const { u } = toss(t, 3.2), x = bc[0] + l / 2 - 1 - u * (l - 3.2), roll = Math.min(1, u * 1.4); drawBall(c, x + (1 - roll) * 0.3, bc[1] + Math.sin(u * 3) * 0.2, 0.13, Math.floor(t / 3.2) % 2 ? "#d23a2e" : "#3f9a4a"); drawPerson(c, bc[0] + l / 2 + 0.6, bc[1] - 0.6, Math.PI, g(1).shirt, g(1).hair, g(1).skin, u < 0.15 ? "throw" : "stand", t, 1.3); drawPerson(c, bc[0] + l / 2 + 0.7, bc[1] + 0.7, Math.PI, g(6).shirt, g(6).hair, g(6).skin, "stand", t + 1, 1.3); }
    else { for (let k = 0; k < 4; k++) drawBall(c, bc[0] + l / 2 - 0.6 + (k % 2) * 0.3, bc[1] - 0.2 + Math.floor(k / 2) * 0.35, 0.13, k % 2 ? "#3f9a4a" : "#d23a2e"); }
    }
  }
  if (h.cornhole) {
    const { a, b } = L.cornhole, ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    drawCornhole(c, a[0], a[1], ang, "#2f6db5"); if (h.cornhole > 1) drawCornhole(c, b[0], b[1], ang + Math.PI, "#c93a32");
    if (h.cornhole > 1) for (const [p, s] of [[a, 1], [b, -1]] as const) { const spots: [number, number][] = [[-0.75, -0.3], [-0.6, 0.15], [-0.85, 0.45], [0.05, -0.15], [-0.05, 0.3]]; spots.forEach(([ox, oy], k) => drawBag(c, p[0] + ox, p[1] + s * oy, k * 0.7, k % 2 ? "#2f6db5" : "#d23a2e")); }
    if (live) {
      const { u, dir } = toss(t, 1.9), from = dir ? b : a, to = dir ? a : b, sx = from[0] + 0.9, sy = from[1] - (dir ? -0.6 : 0.6) * 0.2;
      drawBag(c, sx + (to[0] - 0.1 - sx) * u, sy + (to[1] - sy) * u, t * 5, dir ? "#2f6db5" : "#d23a2e", Math.sin(u * Math.PI) * 1.2);
      drawPerson(c, a[0] + 0.9, a[1] - 0.5, Math.PI / 2, g(2).shirt, g(2).hair, g(2).skin, !dir && u < 0.2 ? "throw" : "stand", t, 1.3);
      drawPerson(c, b[0] + 0.9, b[1] + 0.5, -Math.PI / 2, g(3).shirt, g(3).hair, g(3).skin, dir && u < 0.2 ? "throw" : "stand", t + 2, 1.3);
    }
  }
  if (h.goal) {
    const { c: gc, fwd } = L.goal; let ball: Pt | null = null;
    if (live) { const fx = Math.cos(fwd), fy = Math.sin(fwd), { u, dir } = toss(t, 2.4), k0 = 4.5, k1 = 0.4, d = dir ? k1 + (k0 - k1) * u : k0 + (k1 - k0) * u, wob = Math.sin(t * 0.7) * 0.6; ball = [gc[0] + fx * d - fy * wob, gc[1] + fy * d + fx * wob]; drawPerson(c, gc[0] + fx * 5.0 + 0.3, gc[1] + fy * 5.0, fwd + Math.PI, g(4).shirt, g(4).hair, g(4).skin, !dir && u < 0.2 ? "throw" : "stand", t, 1.05); drawPerson(c, gc[0] + fx * 0.7 - 0.3, gc[1] + fy * 0.7, fwd, g(9).shirt, g(9).hair, g(9).skin, "stand", t + 1, 1.05); }
    drawGoal(c, gc[0], gc[1], fwd, t, null);
    if (ball) drawSoccerBall(c, ball[0], ball[1], 0);
  }
  if (h.slide !== undefined && h.slide > 0) {
    const { a, b } = L.slide, ang = Math.atan2(b[1] - a[1], b[0] - a[0]), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if ((h.wet ?? 0) > 0) drawHose(c, [L.reel, [L.reel[0] - 0.6, L.reel[1] - 0.5], [b[0] + 0.5, b[1] - 0.2], [b[0] + 0.05, b[1] - 0.1]], true);
    drawSlide(c, a[0], a[1], ang, len * h.slide, h.wet ?? 0, t);
    if (live) for (let k = 0; k < 2; k++) { const u = ((t * 0.32 + k * 0.5) % 1); if (u < 0.55) { const s = u / 0.55, e = 1 - Math.pow(1 - s, 2); drawSlider(c, a[0] + Math.cos(ang) * (0.6 + e * (len - 0.6)), a[1] + Math.sin(ang) * (0.6 + e * (len - 0.6)), ang, g(10 + k), t); } else { const s = (u - 0.55) / 0.45; drawPerson(c, b[0] + 1.4 - s * 0, b[1] - s * len, -Math.PI / 2, g(10 + k).shirt, g(10 + k).hair, g(10 + k).skin, "stand", t * 2 + k, 1.0); } }
  }
}
/** The standing things over the ground layer: the ladders and the badminton net. */
export function drawPartyStanding(c: CanvasRenderingContext2D, L: Layout, h: Have, t: number, live: boolean) {
  const g = (i: number) => guest(i);
  if (h.ladder) {
    const { a, b } = L.ladder;
    drawLadderBall(c, a[0], a[1], [0, 2], t); if (h.ladder > 1) drawLadderBall(c, b[0], b[1], [1], t);
    if (!live && h.ladder > 1) for (let k = 0; k < 3; k++) drawBola(c, b[0] - 0.5 + k * 0.4, b[1] + 0.7, 0.3 * k, k % 2 ? "#2f6db5" : "#d23a2e");
    if (live) { const { u, dir } = toss(t, 2.1), from = dir ? b : a, to = dir ? a : b; const bx = from[0] + 0.3 + (to[0] - from[0]) * u, by = from[1] + 1.2 * (dir ? -1 : 1) * 0 + (to[1] - from[1]) * u - Math.sin(u * Math.PI) * 1.4 - 0.4; c.save(); c.translate(bx, by); c.rotate(t * 9); c.strokeStyle = "#333"; c.lineWidth = 0.015; c.beginPath(); c.moveTo(-0.16, 0); c.lineTo(0.16, 0); c.stroke(); for (const s of [-1, 1]) { c.fillStyle = dir ? "#2f6db5" : "#d23a2e"; c.beginPath(); c.arc(s * 0.16, 0, 0.055, 0, 7); c.fill(); } c.restore();
      drawPerson(c, a[0] + 1.05, a[1] - 0.1, Math.PI / 2, g(5).shirt, g(5).hair, g(5).skin, !dir && u < 0.2 ? "throw" : "stand", t, 1.3); drawPerson(c, b[0] + 1.05, b[1] + 0.3, -Math.PI / 2, g(7).shirt, g(7).hair, g(7).skin, dir && u < 0.2 ? "throw" : "stand", t + 1, 1.3); }
  }
  if (h.badminton) {
    const { a, b } = L.badminton;
    if (live) { const { u, dir } = toss(t, 1.5), mx = (a[0] + b[0]) / 2, my = a[1]; drawPerson(c, mx - 0.6, my - 2.4, Math.PI / 2, g(8).shirt, g(8).hair, g(8).skin, !dir && u < 0.25 ? "throw" : "stand", t, 1.3); drawPerson(c, mx + 0.5, my + 2.4, -Math.PI / 2, g(11).shirt, g(11).hair, g(11).skin, dir && u < 0.25 ? "throw" : "stand", t, 1.3); const sy = dir ? my + 2.2 - u * 4.4 : my - 2.2 + u * 4.4; drawShuttle(c, mx + (u - 0.5) * 0.8, sy, dir ? -Math.PI / 2 : Math.PI / 2, 0.6 + Math.sin(u * Math.PI) * 1.4); }
    if (h.badminton > 1) drawBadminton(c, a, b, t, true); else drawPole(c, a[0] + 0.3, a[1] + 0.3, 0.4);
  }
}
/** The party round the house: the tent, tables with folks at them, the string lights, Linda on the deck, cars in the
 *  driveway, folks round the fire pit. `glow` (0..1) lights the string lights and the fire as it gets dark. */
export function drawPartyHouse(c: CanvasRenderingContext2D, m: LawnMap, L: Layout, t: number, glow: number, lindaWave: number) {
  for (const cr of L.cars) drawCar(c, cr.c[0], cr.c[1], cr.h, 0, { body: cr.col, t });
  L.tables.forEach((tb, i) => {
    drawTable(c, tb.c[0], tb.c[1], tb.a, 3 + i);
    for (let k = 0; k < 4; k++) { const s = k % 2 ? 1 : -1, along = (k < 2 ? -0.45 : 0.45), gx = tb.c[0] + Math.cos(tb.a) * along - Math.sin(tb.a) * s * 0.62, gy = tb.c[1] + Math.sin(tb.a) * along + Math.cos(tb.a) * s * 0.62, gg = guest(20 + i * 4 + k); drawPerson(c, gx, gy, tb.a - s * Math.PI / 2, gg.shirt, gg.hair, gg.skin, "sit", t + k, 1.15); }
  });
  const fp = m.props.find(p => p.kind === "firepit"), chairs = m.props.filter(p => p.kind === "chair");
  chairs.forEach((ch, i) => { if (!fp) return; const gg = guest(30 + i); drawPerson(c, ch.x, ch.y, Math.atan2(fp.y - ch.y, fp.x - ch.x), gg.shirt, gg.hair, gg.skin, "sit", t + i, 1.3); });
  if (fp && glow > 0) drawFire(c, fp.x, fp.y, fp.r ?? 0.8, t, glow);
  void lindaWave;
}
/** The deck drawn by the chore (so Linda can sit on it), with Linda in a chair looking out at the party. */
export function drawDeckWithLinda(c: CanvasRenderingContext2D, m: LawnMap, L: Layout, t: number, lindaWave: number) {
  const deck = m.buildings.find(b => b.kind === "deck"); if (!deck) return false;
  drawBuilding(c, deck, 1, m.door);
  const [lx, ly] = L.linda, up = deck.height * 0.25;
  c.fillStyle = "#e8e2d4"; c.beginPath(); c.roundRect(lx - 0.36, ly - up - 0.32, 0.6, 0.64, 0.12); c.fill(); c.strokeStyle = "rgba(0,0,0,0.2)"; c.lineWidth = 0.03; c.stroke();   // her deck chair
  drawLinda(c, lx - 0.1, ly - up, Math.PI / 2, t, lindaWave, 1.2);
  return true;
}
export function drawPartyAbove(c: CanvasRenderingContext2D, L: Layout, t: number, glow: number) {
  drawTent(c, L.tent.c[0], L.tent.c[1], L.tent.w, L.tent.d);
  drawStringLights(c, [...L.lights, L.lights[0]], glow, t);
}
