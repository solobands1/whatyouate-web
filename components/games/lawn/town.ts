// The world for the flat-tire job: the home farm at true scale, the real road into Springfield (the same route the
// truck trip follows, traced from a north-up aerial image), the Rona with its lot, and the scenery along the way.
// Long straights are squeezed so the drive takes a minute or two. Pure layout and queries here; drawing at the end.
// World units are metres; x east, y south.
import { LAWN_MAP, toMetres, type Building, type Pt } from "../lawnMap";
import { bakeBuilding, buildingShadow, drawTree, makeGround, oldStripeCol, pathPoly } from "./art";
import { type Shape, polyShape, sd, segClosest, pip, mulberry32 } from "./geo";
import { trunkR } from "./world";
import { drawStore, drawLeaf, LEAF_COLS } from "./fallArt";

// the route from the farm driveway, west along Ron McNeil Line, round the bend and west-southwest along Main Street
// into Springfield (the same points the truck trip uses; aerial pixels of about 0.876 m)
const ROUTE_PX: Pt[] = [
  [2983, 517], [2842.3, 547.9], [2795, 560.2], [2675.8, 601.9], [2657.5, 605.8], [2653.8, 606.1], [2649.4, 605.8], [2645, 605], [2640.3, 603.6], [2633.5, 600.8],
  [2630.2, 598.7], [2627.3, 595.8], [2624.6, 591.6], [2622, 586.7], [2614.1, 558.8], [2563.6, 574.5], [2367, 644], [2340.4, 651.6], [2015.2, 721.1], [1449.4, 843.1],
  [1084.9, 919.9], [984, 941.1], [862, 967.4], [761.6, 987.9], [555.2, 1034.7], [528, 920.2], [499.3, 772], [494.1, 745.5],
];
const MPP = 0.876;
// how much each stretch is squeezed (segment i runs from point i to i + 1): Ron McNeil Line a little, Main Street by half
const squeeze = (i: number) => (i <= 2 ? 0.6 : i >= 15 && i <= 23 ? 0.5 : i >= 24 ? 0.75 : 1);
export const ROAD_HALF = 4.0, SHOULDER = 1.7;   // asphalt half width, gravel shoulder
const YU = 0.108;                                 // the yard at true scale (metres a unit)
export const STORE_F = 0.74;                      // where the Rona is along Main Street (north side, before the village)

export type Box = { x: number; y: number; a: number; hl: number; hw: number };
type Road = { pts: Pt[]; half: number; kind: "road" | "lane" };

export function buildTown(fall: number) {
  // ── the road: the squeezed route, sampled every 3 m and rounded at the corners ──
  const V: Pt[] = [[ROUTE_PX[0][0] * MPP, ROUTE_PX[0][1] * MPP]];
  for (let i = 0; i < ROUTE_PX.length - 1; i++) { const f = squeeze(i); V.push([V[i][0] + (ROUTE_PX[i + 1][0] - ROUTE_PX[i][0]) * MPP * f, V[i][1] + (ROUTE_PX[i + 1][1] - ROUTE_PX[i][1]) * MPP * f]); }
  const east: Pt = [V[0][0] + (V[0][0] - V[1][0]) * 1.6, V[0][1] + (V[0][1] - V[1][1]) * 1.6];   // the road carries on east past the farm
  const ctrl = [east, ...V];
  let pts: Pt[] = []; for (let i = 0; i < ctrl.length - 1; i++) { const [a, b] = [ctrl[i], ctrl[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 3)); for (let k = 0; k < n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); }
  pts.push(ctrl[ctrl.length - 1]);
  for (let it = 0; it < 3; it++) { const q: Pt[] = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const [a, b] = [pts[i], pts[i + 1]]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } q.push(pts[pts.length - 1]); pts = q; }
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  const nearestS = (p: Pt) => { let best = 0, bd = Infinity; for (let i = 0; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - p[0], pts[i][1] - p[1]); if (d < bd) { bd = d; best = cum[i]; } } return best; };
  const at = (s: number): Pt => { s = Math.max(0, Math.min(L, s)); let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; } const u = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]); return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * u, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * u]; };
  const dirAt = (s: number) => { const a = at(s - 3), b = at(s + 3); return Math.atan2(b[1] - a[1], b[0] - a[0]); };
  /** A spot `off` metres to the right of the road (going out, west: right is north) at `s`. */
  const side = (s: number, off: number): Pt => { const p = at(s), a = dirAt(s); return [p[0] - Math.sin(a) * off, p[1] + Math.cos(a) * off]; };
  const sV = V.map(nearestS), s0 = sV[0];
  const mainS = (f: number) => sV[15] + (sV[24] - sV[15]) * f;

  // ── home: the yard map at true scale, its driveway meeting the road where the route starts ──
  const ym = toMetres({ ...LAWN_MAP, unit: YU });
  const T: Pt = [V[0][0] - (1106 - LAWN_MAP.origin[0]) * YU, V[0][1] - (-111.5 - LAWN_MAP.origin[1]) * YU];
  const Y = (ux: number, uy: number): Pt => [T[0] + (ux - LAWN_MAP.origin[0]) * YU, T[1] + (uy - LAWN_MAP.origin[1]) * YU];
  const sh = (p: Pt): Pt => [p[0] + T[0], p[1] + T[1]], shL = (ps: Pt[]) => ps.map(sh);
  const yard = {
    lawn: ym.lawn.map(shL), lanes: ym.lanes.map(l => ({ pts: shL(l.pts), half: l.width / 2 })), drive: [...ym.driveway.map(shL), ...ym.pads.map(p => shL(p.poly))],
    buildings: ym.buildings.map(b => ({ ...b, poly: shL(b.poly), wings: b.wings?.map(shL), frontGable: b.frontGable && shL(b.frontGable), chimney: b.chimney && sh(b.chimney) })) as Building[],
    trees: ym.trees.map(t => ({ ...t, x: t.x + T[0], y: t.y + T[1] })), fences: ym.fences.map(shL), door: sh([ym.door.x, ym.door.y]),
    x0: T[0], y0: T[1], w: ym.size[0], h: ym.size[1],
  };
  const yardBox: Box = { ...ptO(Y(1243, 790)), a: -Math.PI / 2, hl: 3.1, hw: 1.45 };   // on the lane beside the barn
  const tractorAt = Y(1132, 717), catAt = Y(1196, 770);

  // ── the Rona: its lot off the north side of Main Street, the store behind, a box to park in ──
  const sStore = mainS(STORE_F), aMain = dirAt(sStore);
  const lotNear = 4.8, lotFar = 37, lotHalf = 30, storeD = 24, storeW = 42;
  const local = (along: number, off: number): Pt => { const p = at(sStore), a = aMain; return [p[0] + Math.cos(a) * along - Math.sin(a) * off, p[1] + Math.sin(a) * along + Math.cos(a) * off]; };
  const lot: Pt[] = [local(-lotHalf, lotNear), local(lotHalf, lotNear), local(lotHalf, lotFar), local(-lotHalf, lotFar)];
  const storeC = local(0, lotFar + storeD / 2 + 0.5), storeA = aMain - Math.PI;   // the front faces the road
  const storePoly: Pt[] = [local(-storeW / 2, lotFar + 0.5), local(storeW / 2, lotFar + 0.5), local(storeW / 2, lotFar + 0.5 + storeD), local(-storeW / 2, lotFar + 0.5 + storeD)];
  const storeBox: Box = { ...ptO(local(2, 26)), a: aMain, hl: 3.1, hw: 1.45 };
  const doors = local(0, lotFar - 0.6);
  const parked: { x: number; y: number; a: number; col: string }[] = [
    { ...ptO(local(-22, 32)), a: aMain + Math.PI / 2, col: "#c9c3b5" }, { ...ptO(local(-15.5, 32)), a: aMain + Math.PI / 2, col: "#7a2a2a" },
    { ...ptO(local(16, 32)), a: aMain - Math.PI / 2, col: "#3b4a56" }, { ...ptO(local(22.5, 32)), a: aMain - Math.PI / 2, col: "#e6e6e2" },
    { ...ptO(local(25, 13)), a: aMain, col: "#5a6b3a" },
  ];

  // ── scenery: houses, barns and trees along the way (all of it off the road) ──
  const rnd = mulberry32(42), buildings: Building[] = [], trees: { x: number; y: number; r: number; seed: number }[] = [];
  const rectAt = (cx: number, cy: number, w: number, h: number, a: number): Pt[] => { const c = Math.cos(a), sn = Math.sin(a); return ([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] as Pt[]).map(([x, y]) => [cx + x * c - y * sn, cy + x * sn + y * c]); };
  const bld = (poly: Pt[], kind: Building["kind"], wall: string, roof: string, height: number) => buildings.push({ kind, poly, height, wall, roof, trim: "#ffffff" });
  // the farm by the bend with its long white barns
  { const p = side(sV[14], 40), a = dirAt(sV[15] + 10); for (let k = 0; k < 3; k++) { const q = side(sV[14] + 20 + k * 14, 44 + k * 4); bld(rectAt(q[0], q[1], 46, 10, a), "shed", "#e6e8ea", "#f1f3f5", 4); } bld(rectAt(p[0] - 26, p[1] + 6, 14, 11, a), "house", "#e4dccb", "#6b5a4d", 5); }
  // the tree line and the old rail bed along the south side of Main Street
  const rail: Pt[] = []; for (let s = sV[15] + 10; s < sV[24]; s += 5) rail.push(side(s, -24));
  for (let s = sV[15] + 6; s < sV[24]; s += 7) if (rnd() < 0.85) { const p = side(s, -(17 + rnd() * 5)); trees.push({ x: p[0], y: p[1], r: 4 + rnd() * 2.5, seed: Math.floor(s) }); }
  // Springfield: houses both sides past the Rona, each with a tree or two
  const roofs = ["#5d5a58", "#6b4f42", "#4f5357", "#7a6a5a", "#8a4a3c", "#5b6b78"], walls = ["#e4dccb", "#d8cdbb", "#e6e1d6", "#cfd6da", "#efe6d2"];
  const houseAt: { s: number; side: number }[] = [];
  const house = (s: number, off: number) => { houseAt.push({ s, side: Math.sign(off) }); const p = side(s, off), a = dirAt(s); bld(rectAt(p[0], p[1], 9 + rnd() * 3, 8 + rnd() * 2, a), "house", walls[Math.floor(rnd() * walls.length)], roofs[Math.floor(rnd() * roofs.length)], 4.5); if (rnd() < 0.75) { const q = side(s + (rnd() - 0.5) * 10, off + Math.sign(off) * (8 + rnd() * 5)); trees.push({ x: q[0], y: q[1], r: 3.5 + rnd() * 2, seed: Math.floor(s * 3) }); } };
  for (let s = mainS(0.58); s < sV[24] - 10; s += 17) for (const sd2 of [-1, 1]) { if (sd2 > 0 && Math.abs(s - sStore) < lotHalf + 14) continue; if (sd2 < 0 && s < mainS(0.66)) continue; house(s, sd2 * (15 + rnd() * 3)); }
  for (let s = sV[24] + 20; s < L - 10; s += 17) for (const sd2 of [-1, 1]) house(s, sd2 * (15 + rnd() * 3));
  // a few farmhouses along Ron McNeil Line and Main Street
  for (const [s, off] of [[sV[1] + 30, -22], [sV[2] + 10, 30], [mainS(0.2), 30], [mainS(0.35), 28], [mainS(0.48), 32]] as [number, number][]) house(s, off);
  // side roads: north at the bend, south down Wellington, a couple of village streets
  const sideRoads: Road[] = [{ pts: [V[15], [V[15][0] + 6, V[15][1] - 160]], half: 3.4, kind: "road" }, { pts: [V[24], [V[24][0] + 8, V[24][1] + 120]], half: 3.4, kind: "road" }];
  for (const f of [0.86, 0.95]) { const p = at(mainS(f)), a = dirAt(mainS(f)) + Math.PI / 2; sideRoads.push({ pts: [[p[0] - Math.cos(a) * 90, p[1] - Math.sin(a) * 90], [p[0] + Math.cos(a) * 90, p[1] + Math.sin(a) * 90]], half: 3.2, kind: "road" }); }
  // like the truck trip: hydro poles and their wires along the north side, wire fences along the fields, mailboxes at
  // the farm lanes, cows in the pasture across from home, the village sign coming into Springfield
  const sVil = mainS(0.56), poles: { x: number; y: number; a: number }[][] = [];
  for (const [a0, a1] of [[s0 + 10, sV[3]], [sV[15] + 10, sVil]]) { const run: { x: number; y: number; a: number }[] = []; for (let s = a0; s < a1; s += 26) { const p = side(s, 6.6); if (Math.abs(s - sStore) > lotHalf + 6) run.push({ x: p[0], y: p[1], a: dirAt(s) }); } poles.push(run); }
  const gaps: [number, number, number][] = [[s0 - 30, s0 + 22, -1], [sStore - lotHalf - 8, sStore + lotHalf + 8, 1], [sV[14] - 20, sV[15] + 30, 1], [sV[3] - 6, sV[15] + 6, -1]];
  const fenceRuns: Pt[][] = [];
  for (const sg of [-1, 1]) { let run: Pt[] = []; for (let s = s0 + 4; s < sVil; s += 3) { const gap = gaps.some(([a, b, gs]) => gs === sg && s > a && s < b) || houseAt.some(hs => hs.side === sg && Math.abs(hs.s - s) < 9); if (gap) { if (run.length > 1) fenceRuns.push(run); run = []; } else run.push(side(s, sg * 7.8)); } if (run.length > 1) fenceRuns.push(run); }
  const mailboxes = houseAt.filter(hs => hs.s < sVil).map(hs => { const p = side(hs.s + 4, hs.side * 5.3); return { x: p[0], y: p[1], a: dirAt(hs.s), col: ["#e9edf0", "#2b2f33", "#8a3b30", "#3d5a40"][Math.floor(rnd() * 4)] }; });
  { const p = side(s0 + 4, -5.3); mailboxes.push({ x: p[0], y: p[1], a: dirAt(s0), col: "#2b2f33" }); }   // home's own, at the end of the driveway
  const cows: { x: number; y: number; a: number; seed: number }[] = []; for (let k = 0; k < 6; k++) { const p = side(sV[1] - 20 + k * 11 + rnd() * 6, 14 + rnd() * 14); cows.push({ x: p[0], y: p[1], a: rnd() * 6.28, seed: k }); }
  // the street signs at the turns (the road being turned onto, going out; coming home they show the way back)
  const signs = [{ p: side(s0 + 16, -8.6), out: "Ron McNeil Line" }, { p: side(sV[15] + 4, -9), out: "Main Street" }, { p: side(sStore - lotHalf - 10, 8.6), out: "Rona" }, { p: side(sVil - 10, 8.6), out: "Springfield" }];

  // ── what can be hit: buildings, the store, parked cars, trunks, fences, poles ──
  const shapes: Shape[] = [];
  for (const b of [...yard.buildings, ...buildings]) if (b.kind !== "deck" && b.kind !== "porch") shapes.push(polyShape(b.poly));
  shapes.push(polyShape(storePoly));
  for (const c of parked) shapes.push(polyShape(rectAt(c.x, c.y, 4.5, 1.8, c.a)));
  for (const t of yard.trees) shapes.push({ k: 1, x: t.x, y: t.y, r: trunkR(t) });
  for (const t of trees) shapes.push({ k: 1, x: t.x, y: t.y, r: 0.45 });
  for (const f of yard.fences) for (let i = 1; i < f.length; i++) shapes.push({ k: 2, ax: f[i - 1][0], ay: f[i - 1][1], bx: f[i][0], by: f[i][1], r: 0.12 });
  for (const run of poles) for (const p of run) shapes.push({ k: 1, x: p.x, y: p.y, r: 0.3 });
  for (const run of fenceRuns) for (let i = 1; i < run.length; i++) shapes.push({ k: 2, ax: run[i - 1][0], ay: run[i - 1][1], bx: run[i][0], by: run[i][1], r: 0.08 });
  for (const m of mailboxes) shapes.push({ k: 1, x: m.x, y: m.y, r: 0.3 });
  const tractorPoly = rectAt(tractorAt[0], tractorAt[1], 2.2, 1.3, 0); shapes.push(polyShape(tractorPoly));
  const roads: Road[] = [{ pts, half: ROAD_HALF + SHOULDER, kind: "road" }, ...sideRoads.map(r => ({ ...r, half: r.half + 1.2 })), ...yard.lanes.map(l => ({ pts: l.pts, half: l.half + 0.8, kind: "lane" as const }))];
  // a coarse grid so each query only looks at what's near
  const G = 20, grid = new Map<string, { segs: [Road, number][]; shapes: Shape[] }>();
  const cellAt = (gx: number, gy: number) => { const k = `${gx},${gy}`; let c = grid.get(k); if (!c) { c = { segs: [], shapes: [] }; grid.set(k, c); } return c; };
  const each = (x0: number, y0: number, x1: number, y1: number, fn: (c: ReturnType<typeof cellAt>) => void) => { for (let gx = Math.floor(x0 / G); gx <= Math.floor(x1 / G); gx++) for (let gy = Math.floor(y0 / G); gy <= Math.floor(y1 / G); gy++) fn(cellAt(gx, gy)); };
  for (const r of roads) for (let i = 1; i < r.pts.length; i++) { const [a, b] = [r.pts[i - 1], r.pts[i]]; each(Math.min(a[0], b[0]) - r.half, Math.min(a[1], b[1]) - r.half, Math.max(a[0], b[0]) + r.half, Math.max(a[1], b[1]) + r.half, c => c.segs.push([r, i])); }
  for (const s of shapes) { const bb = s.k === 0 ? [s.x0, s.y0, s.x1, s.y1] : s.k === 1 ? [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r] : [Math.min(s.ax, s.bx) - s.r, Math.min(s.ay, s.by) - s.r, Math.max(s.ax, s.bx) + s.r, Math.max(s.ay, s.by) + s.r]; each(bb[0] - 1, bb[1] - 1, bb[2] + 1, bb[3] + 1, c => c.shapes.push(s)); }
  const near = (x: number, y: number) => grid.get(`${Math.floor(x / G)},${Math.floor(y / G)}`);
  const apron: Pt[] = [Y(1058, -70), Y(1152, -92), Y(1130, -22), Y(1082, -18)];   // the driveway flares out where it meets the road
  const drivePolys = [...yard.drive, lot, apron];
  /** What's under a spot: "road" (the road, a lane, the driveway, the lot), "grass" (the home lawn: slow) or "rough". */
  function surface(x: number, y: number): "road" | "grass" | "rough" {
    const c = near(x, y);
    if (c) for (const [r, i] of c.segs) { const a = r.pts[i - 1], b = r.pts[i], q = segClosest(a[0], a[1], b[0], b[1], x, y); if (Math.hypot(x - q[0], y - q[1]) < r.half) return "road"; }
    if (drivePolys.some(p => pip(p, x, y))) return "road";
    if (x > yard.x0 && y > yard.y0 && x < yard.x0 + yard.w && y < yard.y0 + yard.h && yard.lawn.some(p => pip(p, x, y))) return "grass";
    return "rough";
  }
  /** Pushes a circle out of anything solid; returns the push. */
  function collide(x: number, y: number, r: number) {
    let nx = 0, ny = 0, hit = false; const c = near(x, y); if (!c) return { x, y, nx, ny, hit };
    for (let it = 0; it < 2; it++) for (const s of c.shapes) {
      const d = sd(s, x, y), rr = r + (s.k === 0 ? 0 : 0);
      if (d >= rr) continue;
      const e = 0.01, gx = (sd(s, x + e, y) - sd(s, x - e, y)) / (2 * e), gy = (sd(s, x, y + e) - sd(s, x, y - e)) / (2 * e), gl = Math.hypot(gx, gy) || 1;
      x += (gx / gl) * (rr - d); y += (gy / gl) * (rr - d); nx += gx / gl; ny += gy / gl; hit = true;
    }
    const l = Math.hypot(nx, ny); return { x, y, nx: l ? nx / l : 0, ny: l ? ny / l : 0, hit };
  }
  /** How close the nearest solid thing is (for the autopilot and the U-turn check). */
  function clearAt(x: number, y: number) { const c = near(x, y); let d = 99; if (c) for (const s of c.shapes) d = Math.min(d, sd(s, x, y)); return d; }

  // ── the guide paths each way (the autopilot follows them; the HUD measures how far is left along them) ──
  const lanePts = yard.lanes[1].pts, drivePts = yard.lanes[0].pts;   // the lane down the east side, the driveway in from the road
  const yardOut: Pt[] = [[yardBox.x, yardBox.y], Y(1252, 700), ...[...lanePts].reverse().slice(2), ...[...drivePts].reverse()];
  const routeTo = (sA: number, sB: number, off: number) => { const out: Pt[] = [], dir = sB > sA ? 1 : -1; for (let s = sA; dir > 0 ? s < sB : s > sB; s += dir * 6) out.push(side(s, off * dir)); return out; };
  const guideOut: Pt[] = [...yardOut, ...routeTo(s0 + 2, sStore - 24, 1.6), local(-14, 15), local(-8, 24.5), [storeBox.x, storeBox.y]];
  const guideBack: Pt[] = [[storeBox.x, storeBox.y], local(11, 26), local(17, 19), local(13, 10), local(4, 3), ...routeTo(sStore - 4, s0 + 6, 1.6), ...drivePts.slice(0, 3), ...lanePts.slice(0, 5), Y(1250, 700), Y(1244, 740), [yardBox.x, yardBox.y]];
  const pathLen = (ps: Pt[]) => { const c = [0]; for (let i = 1; i < ps.length; i++) c.push(c[i - 1] + Math.hypot(ps[i][0] - ps[i - 1][0], ps[i][1] - ps[i - 1][1])); return c; };
  const guides = { out: { pts: guideOut, cum: pathLen(guideOut) }, back: { pts: guideBack, cum: pathLen(guideBack) } };
  /** How far along a guide a spot is (metres), searching near where it was last. */
  function along(g: { pts: Pt[]; cum: number[] }, x: number, y: number, from = 0) {
    let best = from, bd = Infinity, bs = g.cum[from] ?? 0;
    for (let i = Math.max(1, from - 4); i < Math.min(g.pts.length, from + 40); i++) { const a = g.pts[i - 1], b = g.pts[i], q = segClosest(a[0], a[1], b[0], b[1], x, y), d = Math.hypot(x - q[0], y - q[1]); if (d < bd) { bd = d; best = i; bs = g.cum[i - 1] + Math.hypot(q[0] - a[0], q[1] - a[1]); } }
    return { s: bs, i: best, d: bd };
  }

  // ── drawing: the yard ground baked once; everything else drawn as it comes on screen ──
  const PXY = 7, yardCv = document.createElement("canvas");
  {
    yardCv.width = Math.ceil(ym.size[0] * PXY); yardCv.height = Math.ceil(ym.size[1] * PXY);
    const c = yardCv.getContext("2d")!; c.scale(PXY, PXY);
    c.fillStyle = "#8fa557"; c.fillRect(0, 0, ym.size[0], ym.size[1]);
    c.save(); c.beginPath(); for (const p of ym.lawn) { p.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); } c.clip();
    for (let sx = 0; sx < ym.size[0]; sx += 5) { c.fillStyle = oldStripeCol((sx / 5) * 4 + 0.1); c.fillRect(sx, 0, 5.02, ym.size[1]); }
    c.restore();
    c.drawImage(makeGround(ym, PXY), 0, 0, ym.size[0], ym.size[1]);
    const r = mulberry32(5); for (const t of ym.trees) if (t.kind !== "spruce" && t.kind !== "well" && fall > 0.3) for (let k = 0; k < t.r * t.r * 2.2 * fall; k++) { const a = r() * 7, d = Math.sqrt(r()) * t.r * 1.2; drawLeaf(c, t.x + Math.cos(a) * d, t.y + Math.sin(a) * d, r() * 7, 0.2, LEAF_COLS[Math.floor(r() * LEAF_COLS.length)]); }
  }
  const baked = [...yard.buildings.map(b => ({ b, im: bakeBuilding(b, b.kind === "house" || b.kind === "deck" ? { x: yard.door[0], y: yard.door[1] } : null, 10) })), ...buildings.map(b => ({ b, im: bakeBuilding(b, null, 6) }))];
  const blobs = (seed: number) => { const r = mulberry32(seed), out: number[][] = []; for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + r(), d = 0.45 + r() * 0.2; out.push([Math.cos(a) * d, Math.sin(a) * d, 0.42 + r() * 0.12, r()]); } return out; };
  const allTrees = [...yard.trees.map((t, i) => ({ t, b: blobs(100 + i) })), ...trees.map(t => ({ t: { x: t.x, y: t.y, r: t.r }, b: blobs(t.seed) }))];

  function cowArt(c: CanvasRenderingContext2D, cw: { x: number; y: number; a: number; seed: number }, t: number) {
    const a = cw.a + Math.sin(t * 0.3 + cw.seed) * 0.15, nod = Math.sin(t * 1.3 + cw.seed * 2) * 0.06;
    c.save(); c.translate(cw.x, cw.y); c.fillStyle = "rgba(20,40,10,0.2)"; c.beginPath(); c.ellipse(0.3, 0.35, 1.25, 0.6, a, 0, 7); c.fill(); c.rotate(a);
    c.fillStyle = "#f4f1ea"; c.beginPath(); c.ellipse(0, 0, 1.2, 0.55, 0, 0, 7); c.fill(); c.strokeStyle = "rgba(40,30,22,0.5)"; c.lineWidth = 0.05; c.stroke();
    c.fillStyle = "#2b2622"; const r = mulberry32(cw.seed + 5); for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(-0.7 + r() * 1.3, (r() - 0.5) * 0.6, 0.22 + r() * 0.2, 0.16 + r() * 0.12, r() * 3, 0, 7); c.fill(); }
    c.beginPath(); c.ellipse(1.35 + nod, 0, 0.36, 0.26, 0, 0, 7); c.fill(); c.fillStyle = "#e9b9b0"; c.beginPath(); c.ellipse(1.6 + nod, 0, 0.13, 0.16, 0, 0, 7); c.fill();
    c.restore();
  }
  /** Hydro poles over the top: the wires (and their faint shadows), the crossarms, the insulators. */
  function drawPoles(c: CanvasRenderingContext2D, vx0: number, vy0: number, vx1: number, vy1: number) {
    for (const run of poles) {
      for (const [ox, oy, col, w] of [[2.4, 1.8, "rgba(20,40,10,0.14)", 0.06], [0, 0, "rgba(30,30,30,0.5)", 0.05]] as [number, number, string, number][]) {
        c.strokeStyle = col; c.lineWidth = w;
        for (const k of [-1, 1]) { c.beginPath(); run.forEach((p, i) => { const x = p.x - Math.sin(p.a) * k * 0.75 + ox, y = p.y + Math.cos(p.a) * k * 0.75 + oy; if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke(); }
      }
      for (const p of run) if (p.x > vx0 - 2 && p.x < vx1 + 2 && p.y > vy0 - 2 && p.y < vy1 + 2) {
        const nx = -Math.sin(p.a), ny = Math.cos(p.a);
        c.strokeStyle = "rgba(20,40,10,0.22)"; c.lineWidth = 0.22; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + 3.2, p.y + 2.4); c.stroke();
        c.strokeStyle = "#5b4430"; c.lineWidth = 0.18; c.beginPath(); c.moveTo(p.x - nx * 0.95, p.y - ny * 0.95); c.lineTo(p.x + nx * 0.95, p.y + ny * 0.95); c.stroke();
        c.fillStyle = "#7a5a3c"; c.beginPath(); c.arc(p.x, p.y, 0.22, 0, 7); c.fill();
        c.fillStyle = "#dfe6ea"; for (const k of [-0.75, 0.75]) { c.beginPath(); c.arc(p.x + nx * k, p.y + ny * k, 0.09, 0, 7); c.fill(); }
      }
    }
  }
  function drawGround(c: CanvasRenderingContext2D, vx0: number, vy0: number, vx1: number, vy1: number, aMainView: number, time = 0) {
    // fields: a patchwork lined up with Main Street
    c.fillStyle = "#8fa557"; c.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    c.save(); c.rotate(aMainView);
    { const ca = Math.cos(-aMainView), sa = Math.sin(-aMainView), cs = [[vx0, vy0], [vx1, vy0], [vx1, vy1], [vx0, vy1]].map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]);
      const ux0 = Math.min(...cs.map(q => q[0])), ux1 = Math.max(...cs.map(q => q[0])), uy0 = Math.min(...cs.map(q => q[1])), uy1 = Math.max(...cs.map(q => q[1]));
      for (let gx = Math.floor(ux0 / 90) * 90; gx < ux1; gx += 90) for (let gy = Math.floor(uy0 / 60) * 60; gy < uy1; gy += 60) {
        const h = mulberry32(((gx / 90) * 7919 + (gy / 60) * 104729) | 0), kind = Math.floor(h() * 4);
        c.fillStyle = ["#a88e66", "#8a9e48", "#c2ad6a", "#9aa552"][kind]; c.fillRect(gx + 1, gy + 1, 88, 58);
        c.strokeStyle = ["rgba(110,88,58,0.4)", "rgba(90,110,40,0.4)", "rgba(150,130,80,0.4)", "rgba(110,120,50,0.35)"][kind]; c.lineWidth = 0.8;
        c.beginPath(); for (let rx = gx + 3; rx < gx + 88; rx += 4) { c.moveTo(rx, gy + 1); c.lineTo(rx, gy + 59); } c.stroke();
      } }
    c.restore();
    // Springfield's lawns and the farmyard by the bend
    c.strokeStyle = "#86b85a"; c.lineCap = "butt"; c.lineJoin = "round"; c.lineWidth = 64; c.beginPath(); for (let s = mainS(0.56), k = 0; s <= L; s += 6, k++) { const p = at(s); if (k) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); } c.stroke();
    // the yard at home
    if (vx1 > yard.x0 && vx0 < yard.x0 + yard.w && vy1 > yard.y0 && vy0 < yard.y0 + yard.h) c.drawImage(yardCv, yard.x0, yard.y0, yard.w, yard.h);
    pathPoly(c, apron); c.fillStyle = "#cdc3ae"; c.fill();
    // the old rail bed
    c.strokeStyle = "#b9a684"; c.lineWidth = 5; c.lineCap = "round"; c.beginPath(); rail.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke();
    // roads: shoulders, asphalt, the yellow centre line
    const road = (ps: Pt[], half: number) => { c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = "#c4b89f"; c.lineWidth = (half + SHOULDER) * 2; c.beginPath(); ps.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); c.strokeStyle = "#5f6266"; c.lineWidth = half * 2; c.stroke(); };
    for (const r of sideRoads) road(r.pts, r.half);
    road(pts, ROAD_HALF);
    c.strokeStyle = "#e5c24c"; c.lineWidth = 0.22; c.setLineDash([3, 5]); c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); c.setLineDash([]);
    c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 0.14; for (const sgn of [-1, 1]) { c.beginPath(); for (let s = 0, k = 0; s <= L; s += 4, k++) { const p = side(s, sgn * (ROAD_HALF - 0.35)); if (k) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); } c.stroke(); }
    // the Rona's lot: asphalt, painted stalls, the box
    pathPoly(c, lot); c.fillStyle = "#6d7073"; c.fill(); c.strokeStyle = "rgba(200,200,190,0.7)"; c.lineWidth = 0.18; c.stroke();
    c.strokeStyle = "rgba(245,245,240,0.75)"; c.lineWidth = 0.12;
    for (let k = -lotHalf + 3; k <= lotHalf - 3; k += 3.2) { if (Math.abs(k) < 11) continue; const a = local(k, 29.5), b = local(k, 35); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    // fences (wire on wooden posts), mailboxes, cows grazing, then the buildings' shadows
    const inV = (px: number, py: number, m: number) => px > vx0 - m && px < vx1 + m && py > vy0 - m && py < vy1 + m;
    c.strokeStyle = "rgba(70,60,50,0.55)"; c.lineWidth = 0.05; for (const run of fenceRuns) { c.beginPath(); run.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); }
    c.fillStyle = "#7a6248"; for (const run of fenceRuns) for (const [px, py] of run) if (inV(px, py, 1)) c.fillRect(px - 0.11, py - 0.11, 0.22, 0.22);
    for (const m of mailboxes) if (inV(m.x, m.y, 2)) { c.save(); c.translate(m.x, m.y); c.rotate(m.a); c.fillStyle = "rgba(20,40,10,0.25)"; c.fillRect(-0.3, -0.12, 0.78, 0.5); c.fillStyle = "#5b4430"; c.fillRect(-0.06, -0.06, 0.12, 0.12); c.fillStyle = m.col; c.beginPath(); c.roundRect(-0.38, -0.22, 0.76, 0.44, 0.16); c.fill(); c.strokeStyle = "rgba(0,0,0,0.35)"; c.lineWidth = 0.03; c.stroke(); c.fillStyle = "#d8322a"; c.fillRect(0.1, -0.3, 0.2, 0.08); c.restore(); }
    for (const cw of cows) if (inV(cw.x, cw.y, 3)) cowArt(c, cw, time);
    for (const { b } of baked) { const xs = b.poly.map(p => p[0]); if (Math.max(...xs) < vx0 - 20 || Math.min(...xs) > vx1 + 20) continue; buildingShadow(c, b); }
  }
  function drawBox(c: CanvasRenderingContext2D, b: Box, glow: number) {
    c.save(); c.translate(b.x, b.y); c.rotate(b.a); c.globalAlpha = 0.6 + 0.4 * glow; c.setLineDash([0.5, 0.32]); c.strokeStyle = "#ffd23f"; c.lineWidth = 0.18; c.strokeRect(-b.hl, -b.hw, b.hl * 2, b.hw * 2); c.setLineDash([]); c.restore();
  }
  function drawStanding(c: CanvasRenderingContext2D, vx0: number, vy0: number, vx1: number, vy1: number) {
    for (const { im } of baked) if (im.x < vx1 + 2 && im.x + im.w > vx0 - 2 && im.y < vy1 + 2 && im.y + im.h > vy0 - 2) c.drawImage(im.cv, im.x, im.y, im.w, im.h);
    if (storeC[0] > vx0 - 60 && storeC[0] < vx1 + 60 && storeC[1] > vy0 - 60 && storeC[1] < vy1 + 60) drawStore(c, storeC[0], storeC[1], storeA, storeW, storeD);
  }
  function drawTrees(c: CanvasRenderingContext2D, vx0: number, vy0: number, vx1: number, vy1: number, time: number, carX: number, carY: number, alphaOf: (i: number, near: boolean) => number) {
    allTrees.forEach(({ t, b }, i) => {
      if (t.x + t.r < vx0 || t.x - t.r > vx1 || t.y + t.r < vy0 || t.y - t.r > vy1 || (t as { kind?: string }).kind === "well") return;
      const near = Math.hypot(t.x - carX, t.y - carY) < t.r + 2.5;
      drawTree(c, t, b, alphaOf(i, near), time, fall);
    });
  }
  return { drawPoles, pts, cum, L, at, side, dirAt, V, sV, s0, sStore, aMain, yard, yardBox, storeBox, storeC, storeA, storePoly, doors, lot, parked, tractorAt, catAt, signs, surface, collide, clearAt, guides, along, drawGround, drawBox, drawStanding, drawTrees, Y, yardOut };
}
function ptO(p: Pt) { return { x: p[0], y: p[1] }; }
export type Town = ReturnType<typeof buildTown>;
