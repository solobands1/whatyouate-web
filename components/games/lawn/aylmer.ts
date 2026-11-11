// Chapter 5: the world for the gas run. The home farm at true scale, the same road into Springfield as ./town (squeezed
// harder), then left onto Springfield Road (Elgin County Road 40) south past Glencolin Line, and right onto Talbot Street
// into Aylmer, to a plain roadside gas station on the north side. The real roads, squeezed so each way takes a minute or
// so. Pure layout and queries here; drawing at the end. World units are metres; x east, y south.
import { LAWN_MAP, toMetres, type Building, type Pt } from "../lawnMap";
import { bakeBuilding, buildingShadow, drawTree, makeGround, oldStripeCol, pathPoly } from "./art";
import { type Shape, polyShape, sd, segClosest, pip, mulberry32, lineDist, centroid } from "./geo";
import { trunkR } from "./world";
import type { Box } from "./town";

// the farm driveway, west along Ron McNeil Line, round the bend and along Main Street to Springfield Road (the first
// points of ./town's route, the same aerial pixels of about 0.876 m)
const ROUTE_PX: Pt[] = [
  [2983, 517], [2842.3, 547.9], [2795, 560.2], [2675.8, 601.9], [2657.5, 605.8], [2653.8, 606.1], [2649.4, 605.8], [2645, 605], [2640.3, 603.6], [2633.5, 600.8],
  [2630.2, 598.7], [2627.3, 595.8], [2624.6, 591.6], [2622, 586.7], [2614.1, 558.8], [2563.6, 574.5], [2367, 644], [2340.4, 651.6], [2015.2, 721.1], [1449.4, 843.1],
  [1084.9, 919.9],
];
const MPP = 0.876;
const squeeze = (i: number) => (i <= 2 ? 0.22 : i >= 15 ? 0.11 : 1);   // Ron McNeil Line and Main Street squeezed hard, the bend at true size
// Springfield Road from Main Street (metres from the corner): south, an easy jog east at Glencolin Line, south to Talbot
const SPRING_RD: Pt[] = [[0, 0], [-2, 54], [6, 86], [8, 140]];
const TALBOT = [-0.964, -0.265];    // Talbot Street heads west-northwest into Aylmer
const TALBOT_TO_GAS = 78, TALBOT_PAST = 70;
export const ROAD_HALF = 4.0, SHOULDER = 1.7;
const YU = 0.108;

type Road = { pts: Pt[]; half: number; kind: "road" | "lane" };

export function buildAylmer() {
  // ── the road: the squeezed route, sampled every 3 m and rounded at the corners ──
  const V: Pt[] = [[ROUTE_PX[0][0] * MPP, ROUTE_PX[0][1] * MPP]];
  for (let i = 0; i < ROUTE_PX.length - 1; i++) { const f = squeeze(i); V.push([V[i][0] + (ROUTE_PX[i + 1][0] - ROUTE_PX[i][0]) * MPP * f, V[i][1] + (ROUTE_PX[i + 1][1] - ROUTE_PX[i][1]) * MPP * f]); }
  const J = V[V.length - 1];                                                     // Main Street and Springfield Road
  const SR = SPRING_RD.map(([dx, dy]) => [J[0] + dx, J[1] + dy] as Pt), H = SR[SR.length - 1];   // H: Springfield Road meets Talbot Street
  const gasEnd: Pt = [H[0] + TALBOT[0] * (TALBOT_TO_GAS + TALBOT_PAST), H[1] + TALBOT[1] * (TALBOT_TO_GAS + TALBOT_PAST)];
  const east: Pt = [V[0][0] + (V[0][0] - V[1][0]) * 1.6, V[0][1] + (V[0][1] - V[1][1]) * 1.6];   // the road carries on east past the farm
  const ctrl: Pt[] = [east, ...V, ...SR.slice(1), gasEnd];
  let pts: Pt[] = []; for (let i = 0; i < ctrl.length - 1; i++) { const [a, b] = [ctrl[i], ctrl[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 3)); for (let k = 0; k < n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); }
  pts.push(ctrl[ctrl.length - 1]);
  for (let it = 0; it < 3; it++) { const q: Pt[] = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const [a, b] = [pts[i], pts[i + 1]]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } q.push(pts[pts.length - 1]); pts = q; }
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  const nearestS = (p: Pt) => { let best = 0, bd = Infinity; for (let i = 0; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - p[0], pts[i][1] - p[1]); if (d < bd) { bd = d; best = cum[i]; } } return best; };
  const at = (s: number): Pt => { s = Math.max(0, Math.min(L, s)); let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; } const u = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]); return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * u, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * u]; };
  const dirAt = (s: number) => { const a = at(s - 3), b = at(s + 3); return Math.atan2(b[1] - a[1], b[0] - a[0]); };
  /** A spot `off` metres to the right of the road (going out) at `s`. */
  const side = (s: number, off: number): Pt => { const p = at(s), a = dirAt(s); return [p[0] - Math.sin(a) * off, p[1] + Math.cos(a) * off]; };
  const sV = V.map(nearestS), s0 = sV[0], sJ = nearestS(J), sJog = nearestS([(SR[1][0] + SR[2][0]) / 2, (SR[1][1] + SR[2][1]) / 2]), sH = nearestS(H), sGas = sH + TALBOT_TO_GAS;
  const mainS = (f: number) => sV[15] + (sJ - sV[15]) * f;
  /** Where the tire goes flat: about halfway from Springfield to Aylmer, on Springfield Road past the jog. */
  const sFlat = sJ + (sGas - sJ) * 0.45;
  /** How far along the road a spot is, searching near where it was last (for the flat and the HUD). */
  const roadS = (x: number, y: number, near = -1) => { let best = near, bd = Infinity; const i0 = near < 0 ? 1 : Math.max(1, near - 30), i1 = near < 0 ? pts.length : Math.min(pts.length, near + 30); for (let i = i0; i < i1; i++) { const d = Math.hypot(pts[i][0] - x, pts[i][1] - y); if (d < bd) { bd = d; best = i; } } return { s: cum[Math.max(0, best)], i: best, d: bd }; };

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

  // ── the gas station: a lot off the north side of Talbot Street, two pump islands under a canopy, a little shop ──
  const aGas = dirAt(sGas);
  const local = (along: number, off: number): Pt => { const p = at(sGas), a = aGas; return [p[0] + Math.cos(a) * along - Math.sin(a) * off, p[1] + Math.sin(a) * along + Math.cos(a) * off]; };
  const lotA0 = -26, lotA1 = 34, lotNear = 4.6, lotFar = 32;
  const lot: Pt[] = [local(lotA0, lotNear), local(lotA1, lotNear), local(lotA1, lotFar), local(lotA0, lotFar)];
  const islands = [13, 19].map(off => ({ c: local(0, off), poly: [local(-3.2, off - 0.6), local(3.2, off - 0.6), local(3.2, off + 0.6), local(-3.2, off + 0.6)] as Pt[] }));
  const pumps = islands.map(is => is.c);
  const canopy: Pt[] = [local(-6, 10), local(6, 10), local(6, 22), local(-6, 22)];
  const posts: Pt[] = [local(-4.6, 13), local(4.6, 13), local(-4.6, 19), local(4.6, 19)];
  const shopC = local(25, 17), shopPoly: Pt[] = [local(19, 11), local(31, 11), local(31, 23), local(19, 23)];
  const gasBox: Box = { ...ptO(local(0, 16)), a: aGas, hl: 3.1, hw: 1.45 };
  const gasSign = local(-29, 7.6);   // on the grass by the road, just before the lot

  // ── scenery: farms, Springfield's houses, Aylmer's houses and shops along Talbot Street, trees (all off the road) ──
  const rnd = mulberry32(57), buildings: Building[] = [], trees: { x: number; y: number; r: number; seed: number }[] = [];
  const rectAt = (cx: number, cy: number, w: number, h: number, a: number): Pt[] => { const c = Math.cos(a), sn = Math.sin(a); return ([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] as Pt[]).map(([x, y]) => [cx + x * c - y * sn, cy + x * sn + y * c]); };
  const bld = (poly: Pt[], kind: Building["kind"], wall: string, roof: string, height: number) => buildings.push({ kind, poly, height, wall, roof, trim: "#ffffff" });
  const roofs = ["#5d5a58", "#6b4f42", "#4f5357", "#7a6a5a", "#8a4a3c", "#5b6b78"], walls = ["#e4dccb", "#d8cdbb", "#e6e1d6", "#cfd6da", "#efe6d2"];
  const houseAt: { s: number; side: number }[] = [];
  const house = (s: number, off: number, w = 9, d = 8) => { houseAt.push({ s, side: Math.sign(off) }); const p = side(s, off), a = dirAt(s); bld(rectAt(p[0], p[1], w + rnd() * 3, d + rnd() * 2, a), "house", walls[Math.floor(rnd() * walls.length)], roofs[Math.floor(rnd() * roofs.length)], 4.5); if (rnd() < 0.7) { const q = side(s + (rnd() - 0.5) * 10, off + Math.sign(off) * (8 + rnd() * 5)); trees.push({ x: q[0], y: q[1], r: 3.5 + rnd() * 2, seed: Math.floor(s * 3) }); } };
  // the farm by the bend with its long white barns
  { const p = side(sV[14], 40), a = dirAt(sV[15] + 10); for (let k = 0; k < 3; k++) { const q = side(sV[14] + 20 + k * 14, 44 + k * 4); bld(rectAt(q[0], q[1], 46, 10, a), "shed", "#e6e8ea", "#f1f3f5", 4); } bld(rectAt(p[0] - 26, p[1] + 6, 14, 11, a), "house", "#e4dccb", "#6b5a4d", 5); }
  // farmhouses along Ron McNeil Line and Main Street; Springfield's houses near the corner, both ways
  for (const [s, off] of [[sV[1] + 20, -22], [mainS(0.25), 30], [mainS(0.5), 28]] as [number, number][]) house(s, off);
  for (let s = mainS(0.68); s < sJ - 14; s += 16) for (const sg of [-1, 1]) house(s, sg * (15 + rnd() * 3));
  for (let s = sJ + 16; s < sJ + 40; s += 16) for (const sg of [-1, 1]) house(s, sg * (15 + rnd() * 3));
  // along Springfield Road: a farm or two, a barn, tree rows
  for (const [s, off] of [[sJ + 50, 30], [sJog + 30, -34], [sJog + 56, 28]] as [number, number][]) house(s, off);
  { const q = side(sJog + 40, -48), a = dirAt(sJog + 40); bld(rectAt(q[0], q[1], 18, 12, a), "barn", "#a8382c", "#5d5a58", 5.5); }
  for (let s = sJ + 44; s < sH - 12; s += 8) if (rnd() < 0.55) { const sg = rnd() < 0.5 ? -1 : 1, p = side(s, sg * (16 + rnd() * 10)); trees.push({ x: p[0], y: p[1], r: 3.5 + rnd() * 2.5, seed: Math.floor(s * 7) }); }
  // Aylmer: houses both sides of Talbot Street past the town sign, a few shops near the station
  const sTown = sH + 22;
  for (let s = sTown + 4; s < L - 6; s += 15) for (const sg of [-1, 1]) { if (sg > 0 && Math.abs(s - sGas) < 34) continue; const shop = s > sGas - 50 && rnd() < 0.5; if (shop) { const p = side(s, sg * 14), a = dirAt(s); houseAt.push({ s, side: sg }); bld(rectAt(p[0], p[1], 12, 9, a), "shed", ["#d9cbb0", "#c9b9a0", "#e2dccf"][Math.floor(rnd() * 3)], ["#6d6f72", "#7a5040", "#556070"][Math.floor(rnd() * 3)], 5); } else house(s, sg * (15 + rnd() * 3)); }
  for (let s = sH + 12; s < sTown; s += 9) if (rnd() < 0.6) { const p = side(s, (rnd() < 0.5 ? -1 : 1) * (16 + rnd() * 8)); trees.push({ x: p[0], y: p[1], r: 4 + rnd() * 2, seed: Math.floor(s * 5) }); }
  // side roads: north at the bend, Main Street on west into the village, Talbot Street east, two Aylmer streets
  const sideRoads: Road[] = [
    { pts: [V[15], [V[15][0] + 6, V[15][1] - 160]], half: 3.4, kind: "road" },
    (() => { const dx = J[0] - V[V.length - 2][0], dy = J[1] - V[V.length - 2][1], d = Math.hypot(dx, dy); return { pts: [J, [J[0] + (dx / d) * 60, J[1] + (dy / d) * 60]] as Pt[], half: 3.6, kind: "road" as const }; })(),
    { pts: [H, [H[0] - TALBOT[0] * 200, H[1] - TALBOT[1] * 200]], half: 3.8, kind: "road" },
  ];
  // (short, so the squeezed-up roads never cross each other: Glencolin Line mostly east of the jog, Aylmer's streets mostly south of Talbot)
  for (const [ds, toR, toL] of [[sJog, 22, 70], [sTown + 12, 30, 70], [sGas + 46, 36, 70]]) { const p = at(ds), a = dirAt(ds) + Math.PI / 2; sideRoads.push({ pts: [[p[0] - Math.cos(a) * toL, p[1] - Math.sin(a) * toL], [p[0] + Math.cos(a) * toR, p[1] + Math.sin(a) * toR]], half: 3.2, kind: "road" }); }
  // hydro poles along one side, wire fences along the fields, mailboxes at the farm lanes
  const poles: { x: number; y: number; a: number }[][] = [];
  for (const [a0, a1, off] of [[s0 + 10, sV[3], 6.6], [sV[15] + 10, mainS(0.66), 6.6], [sJ + 42, sH - 10, -6.6], [sH + 10, sTown, 6.6]]) { const run: { x: number; y: number; a: number }[] = []; for (let s = a0; s < a1; s += 26) { const p = side(s, off); run.push({ x: p[0], y: p[1], a: dirAt(s) }); } poles.push(run); }
  const gaps: [number, number, number][] = [[s0 - 30, s0 + 22, -1], [sV[14] - 20, sV[15] + 30, 1], [sV[3] - 6, sV[15] + 6, -1], [sJog - 14, sJog + 14, -1], [sJog - 14, sJog + 14, 1]];
  const fenceRuns: Pt[][] = [];
  for (const [f0, f1] of [[s0 + 4, mainS(0.66)], [sJ + 44, sH - 14]]) for (const sg of [-1, 1]) { let run: Pt[] = []; for (let s = f0; s < f1; s += 3) { const gap = gaps.some(([a, b, gs]) => gs === sg && s > a && s < b) || houseAt.some(hs => hs.side === sg && Math.abs(hs.s - s) < 9); if (gap) { if (run.length > 1) fenceRuns.push(run); run = []; } else run.push(side(s, sg * 7.8)); } if (run.length > 1) fenceRuns.push(run); }
  const mailboxes = houseAt.filter(hs => hs.s < sTown && (hs.s < mainS(0.66) || hs.s > sJ + 40)).map(hs => { const p = side(hs.s + 4, hs.side * 5.3); return { x: p[0], y: p[1], a: dirAt(hs.s), col: ["#e9edf0", "#2b2f33", "#8a3b30", "#3d5a40"][Math.floor(rnd() * 4)] }; });
  { const p = side(s0 + 4, -5.3); mailboxes.push({ x: p[0], y: p[1], a: dirAt(s0), col: "#2b2f33" }); }   // home's own
  // the street signs at the turns (the road being turned onto going out), the town sign, the station's sign
  const signs: { p: Pt; text: string; col: string }[] = [
    { p: side(s0 + 16, -8.6), text: "Ron McNeil Line", col: "#2d6a3a" }, { p: side(sV[15] + 4, -9), text: "Main Street", col: "#2d6a3a" },
    { p: side(mainS(0.6), 8.6), text: "Springfield", col: "#2f5a1f" }, { p: side(sJ - 14, -8.6), text: "Springfield Road", col: "#2d6a3a" },
    { p: side(sJog - 8, 8.6), text: "Glencolin Line", col: "#2d6a3a" }, { p: side(sH - 18, -8.6), text: "Talbot Street", col: "#2d6a3a" },
    { p: side(sTown, -8.6), text: "Aylmer", col: "#2f5a1f" }, { p: gasSign, text: "Gas", col: "#c8281f" },
  ];

  // nothing stands on a road: the squeezed corners can bring a house or a tree from one road onto the next
  const roadDist = (px: number, py: number) => Math.min(lineDist(pts, px, py), ...sideRoads.map(r => lineDist(r.pts, px, py) - (r.half - ROAD_HALF)));
  for (let i = buildings.length - 1; i >= 0; i--) { const ps = buildings[i].poly, spots = [centroid(ps), ...ps, ...ps.map((q, k) => [(q[0] + ps[(k + 1) % ps.length][0]) / 2, (q[1] + ps[(k + 1) % ps.length][1]) / 2] as Pt)]; if (spots.some(q => roadDist(q[0], q[1]) < ROAD_HALF + SHOULDER + 1)) buildings.splice(i, 1); }
  for (let i = trees.length - 1; i >= 0; i--) if (roadDist(trees[i].x, trees[i].y) < ROAD_HALF + SHOULDER + 1.5 + trees[i].r * 0.5) trees.splice(i, 1);

  // ── what can be hit ──
  const shapes: Shape[] = [];
  for (const b of [...yard.buildings, ...buildings]) if (b.kind !== "deck" && b.kind !== "porch") shapes.push(polyShape(b.poly));
  shapes.push(polyShape(shopPoly)); for (const is of islands) shapes.push(polyShape(is.poly));
  for (const p of posts) shapes.push({ k: 1, x: p[0], y: p[1], r: 0.25 });
  shapes.push({ k: 1, x: gasSign[0], y: gasSign[1], r: 0.3 });
  for (const t of yard.trees) shapes.push({ k: 1, x: t.x, y: t.y, r: trunkR(t) });
  for (const t of trees) shapes.push({ k: 1, x: t.x, y: t.y, r: 0.45 });
  for (const f of yard.fences) for (let i = 1; i < f.length; i++) shapes.push({ k: 2, ax: f[i - 1][0], ay: f[i - 1][1], bx: f[i][0], by: f[i][1], r: 0.12 });
  for (const run of poles) for (const p of run) shapes.push({ k: 1, x: p.x, y: p.y, r: 0.3 });
  for (const run of fenceRuns) for (let i = 1; i < run.length; i++) shapes.push({ k: 2, ax: run[i - 1][0], ay: run[i - 1][1], bx: run[i][0], by: run[i][1], r: 0.08 });
  for (const m of mailboxes) shapes.push({ k: 1, x: m.x, y: m.y, r: 0.3 });
  const tractorPoly = rectAt(tractorAt[0], tractorAt[1], 2.2, 1.3, 0); shapes.push(polyShape(tractorPoly));
  const roads: Road[] = [{ pts, half: ROAD_HALF + SHOULDER, kind: "road" }, ...sideRoads.map(r => ({ ...r, half: r.half + 1.2 })), ...yard.lanes.map(l => ({ pts: l.pts, half: l.half + 0.8, kind: "lane" as const }))];
  const G = 20, grid = new Map<string, { segs: [Road, number][]; shapes: Shape[] }>();
  const cellAt = (gx: number, gy: number) => { const k = `${gx},${gy}`; let c = grid.get(k); if (!c) { c = { segs: [], shapes: [] }; grid.set(k, c); } return c; };
  const each = (x0: number, y0: number, x1: number, y1: number, fn: (c: ReturnType<typeof cellAt>) => void) => { for (let gx = Math.floor(x0 / G); gx <= Math.floor(x1 / G); gx++) for (let gy = Math.floor(y0 / G); gy <= Math.floor(y1 / G); gy++) fn(cellAt(gx, gy)); };
  for (const r of roads) for (let i = 1; i < r.pts.length; i++) { const [a, b] = [r.pts[i - 1], r.pts[i]]; each(Math.min(a[0], b[0]) - r.half, Math.min(a[1], b[1]) - r.half, Math.max(a[0], b[0]) + r.half, Math.max(a[1], b[1]) + r.half, c => c.segs.push([r, i])); }
  for (const s of shapes) { const bb = s.k === 0 ? [s.x0, s.y0, s.x1, s.y1] : s.k === 1 ? [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r] : [Math.min(s.ax, s.bx) - s.r, Math.min(s.ay, s.by) - s.r, Math.max(s.ax, s.bx) + s.r, Math.max(s.ay, s.by) + s.r]; each(bb[0] - 1, bb[1] - 1, bb[2] + 1, bb[3] + 1, c => c.shapes.push(s)); }
  const near = (x: number, y: number) => grid.get(`${Math.floor(x / G)},${Math.floor(y / G)}`);
  const apron: Pt[] = [Y(1058, -70), Y(1152, -92), Y(1130, -22), Y(1082, -18)];
  const drivePolys = [...yard.drive, lot, apron];
  function surface(x: number, y: number): "road" | "grass" | "rough" {
    const c = near(x, y);
    if (c) for (const [r, i] of c.segs) { const a = r.pts[i - 1], b = r.pts[i], q = segClosest(a[0], a[1], b[0], b[1], x, y); if (Math.hypot(x - q[0], y - q[1]) < r.half) return "road"; }
    if (drivePolys.some(p => pip(p, x, y))) return "road";
    if (x > yard.x0 && y > yard.y0 && x < yard.x0 + yard.w && y < yard.y0 + yard.h && yard.lawn.some(p => pip(p, x, y))) return "grass";
    return "rough";
  }
  function collide(x: number, y: number, r: number) {
    let nx = 0, ny = 0, hit = false; const c = near(x, y); if (!c) return { x, y, nx, ny, hit };
    for (let it = 0; it < 2; it++) for (const s of c.shapes) {
      const d = sd(s, x, y); if (d >= r) continue;
      const e = 0.01, gx = (sd(s, x + e, y) - sd(s, x - e, y)) / (2 * e), gy = (sd(s, x, y + e) - sd(s, x, y - e)) / (2 * e), gl = Math.hypot(gx, gy) || 1;
      x += (gx / gl) * (r - d); y += (gy / gl) * (r - d); nx += gx / gl; ny += gy / gl; hit = true;
    }
    const l = Math.hypot(nx, ny); return { x, y, nx: l ? nx / l : 0, ny: l ? ny / l : 0, hit };
  }
  function clearAt(x: number, y: number) { const c = near(x, y); let d = 99; if (c) for (const s of c.shapes) d = Math.min(d, sd(s, x, y)); return d; }

  // ── the guide paths (the autopilot follows them; the HUD measures what's left along them) ──
  const lanePts = yard.lanes[1].pts, drivePts = yard.lanes[0].pts;
  const yardOut: Pt[] = [[yardBox.x, yardBox.y], Y(1252, 700), ...[...lanePts].reverse().slice(2), ...[...drivePts].reverse()];
  const routeTo = (sA: number, sB: number, off: number) => { const out: Pt[] = [], dir = sB > sA ? 1 : -1; for (let s = sA; dir > 0 ? s < sB : s > sB; s += dir * 6) out.push(side(s, off * dir)); return out; };
  const flatSpot = (sNow: number) => { const s = Math.max(sNow + 18, sFlat + 12), p = side(s, 3.7); return { x: p[0], y: p[1], a: dirAt(s) }; };   // where the car rolls to a stop on the shoulder
  const guideOut1: Pt[] = [...yardOut, ...routeTo(s0 + 2, sFlat + 24, 1.6)];
  const guideOut2At = (sFrom: number): Pt[] => [...routeTo(sFrom + 4, sGas - 24, 1.6), local(-18, 7.5), local(-10, 15), local(-5, 16), [gasBox.x, gasBox.y]];
  const guideBack: Pt[] = [[gasBox.x, gasBox.y], local(8, 16.5), local(13.5, 21), local(11, 26.5), local(2, 27.5), local(-10, 27), local(-18, 22), local(-21, 13), local(-19, 6.5), ...routeTo(sGas - 30, s0 + 6, 1.6), ...drivePts.slice(0, 3), ...lanePts.slice(0, 5), Y(1250, 700), Y(1244, 740), [yardBox.x, yardBox.y]];
  const pathLen = (ps: Pt[]) => { const c = [0]; for (let i = 1; i < ps.length; i++) c.push(c[i - 1] + Math.hypot(ps[i][0] - ps[i - 1][0], ps[i][1] - ps[i - 1][1])); return c; };
  const guide = (ps: Pt[]) => ({ pts: ps, cum: pathLen(ps) });
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
    c.fillStyle = "#8fb557"; c.fillRect(0, 0, ym.size[0], ym.size[1]);
    c.save(); c.beginPath(); for (const p of ym.lawn) { p.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); } c.clip();
    for (let sx = 0; sx < ym.size[0]; sx += 5) { c.fillStyle = oldStripeCol((sx / 5) * 4 + 0.1); c.fillRect(sx, 0, 5.02, ym.size[1]); }
    c.restore();
    c.drawImage(makeGround(ym, PXY), 0, 0, ym.size[0], ym.size[1]);
  }
  const baked = [...yard.buildings.map(b => ({ b, im: bakeBuilding(b, b.kind === "house" || b.kind === "deck" ? { x: yard.door[0], y: yard.door[1] } : null, 10) })), ...buildings.map(b => ({ b, im: bakeBuilding(b, null, 6) }))];
  const shopB: Building = { kind: "house", poly: shopPoly, height: 3.6, wall: "#ece6da", roof: "#7d8287", trim: "#c8281f" };
  const shopIm = bakeBuilding(shopB, null, 8);
  const blobs = (seed: number) => { const r = mulberry32(seed), out: number[][] = []; for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + r(), d = 0.45 + r() * 0.2; out.push([Math.cos(a) * d, Math.sin(a) * d, 0.42 + r() * 0.12, r()]); } return out; };
  const allTrees = [...yard.trees.map((t, i) => ({ t, b: blobs(100 + i) })), ...trees.map(t => ({ t: { x: t.x, y: t.y, r: t.r }, b: blobs(t.seed) }))];

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
  function drawGround(c: CanvasRenderingContext2D, vx0: number, vy0: number, vx1: number, vy1: number) {
    // spring fields in a patchwork on the concession grid: fresh green, new-sown brown, early wheat
    c.fillStyle = "#93b85a"; c.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    for (let gx = Math.floor(vx0 / 90) * 90; gx < vx1; gx += 90) for (let gy = Math.floor(vy0 / 60) * 60; gy < vy1; gy += 60) {
      const h = mulberry32(((gx / 90) * 7919 + (gy / 60) * 104729) | 0), kind = Math.floor(h() * 4);
      c.fillStyle = ["#9b8462", "#86ad4c", "#a9a466", "#93b356"][kind]; c.fillRect(gx + 1, gy + 1, 88, 58);
      c.strokeStyle = ["rgba(110,88,58,0.4)", "rgba(80,120,40,0.4)", "rgba(140,130,80,0.4)", "rgba(100,130,50,0.35)"][kind]; c.lineWidth = 0.8;
      c.beginPath(); for (let rx = gx + 3; rx < gx + 88; rx += 4) { c.moveTo(rx, gy + 1); c.lineTo(rx, gy + 59); } c.stroke();
    }
    // the lawns in Springfield and Aylmer
    c.strokeStyle = "#8cc25e"; c.lineCap = "butt"; c.lineJoin = "round"; c.lineWidth = 64;
    for (const [a0, a1] of [[mainS(0.62), sJ + 44], [sTown - 4, L]]) { c.beginPath(); for (let s = a0, k = 0; s <= a1; s += 6, k++) { const p = at(s); if (k) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); } c.stroke(); }
    if (vx1 > yard.x0 && vx0 < yard.x0 + yard.w && vy1 > yard.y0 && vy0 < yard.y0 + yard.h) c.drawImage(yardCv, yard.x0, yard.y0, yard.w, yard.h);
    pathPoly(c, apron); c.fillStyle = "#cdc3ae"; c.fill();
    // roads: shoulders, asphalt, the yellow centre line, the white edge lines
    const road = (ps: Pt[], half: number) => { c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = "#c4b89f"; c.lineWidth = (half + SHOULDER) * 2; c.beginPath(); ps.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); c.strokeStyle = "#5f6266"; c.lineWidth = half * 2; c.stroke(); };
    for (const r of sideRoads) road(r.pts, r.half);
    road(pts, ROAD_HALF);
    c.strokeStyle = "#e5c24c"; c.lineWidth = 0.22; c.setLineDash([3, 5]); c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); c.setLineDash([]);
    c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 0.14; for (const sgn of [-1, 1]) { c.beginPath(); for (let s = 0, k = 0; s <= L; s += 4, k++) { const p = side(s, sgn * (ROAD_HALF - 0.35)); if (k) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); } c.stroke(); }
    // the station's lot: asphalt, the islands' kerbs, painted lines by the shop
    pathPoly(c, lot); c.fillStyle = "#6d7073"; c.fill(); c.strokeStyle = "rgba(200,200,190,0.7)"; c.lineWidth = 0.18; c.stroke();
    c.strokeStyle = "rgba(245,245,240,0.75)"; c.lineWidth = 0.12; for (let k = 20; k <= 31; k += 2.8) { const a = local(k, 23.5), b = local(k, 28.5); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    for (const is of islands) { pathPoly(c, is.poly); c.fillStyle = "#c9c6bd"; c.fill(); c.strokeStyle = "#e8c43a"; c.lineWidth = 0.12; c.stroke(); }
    const inV = (px: number, py: number, m: number) => px > vx0 - m && px < vx1 + m && py > vy0 - m && py < vy1 + m;
    c.strokeStyle = "rgba(70,60,50,0.55)"; c.lineWidth = 0.05; for (const run of fenceRuns) { c.beginPath(); run.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); }
    c.fillStyle = "#7a6248"; for (const run of fenceRuns) for (const [px, py] of run) if (inV(px, py, 1)) c.fillRect(px - 0.11, py - 0.11, 0.22, 0.22);
    for (const m of mailboxes) if (inV(m.x, m.y, 2)) { c.save(); c.translate(m.x, m.y); c.rotate(m.a); c.fillStyle = "rgba(20,40,10,0.25)"; c.fillRect(-0.3, -0.12, 0.78, 0.5); c.fillStyle = "#5b4430"; c.fillRect(-0.06, -0.06, 0.12, 0.12); c.fillStyle = m.col; c.beginPath(); c.roundRect(-0.38, -0.22, 0.76, 0.44, 0.16); c.fill(); c.strokeStyle = "rgba(0,0,0,0.35)"; c.lineWidth = 0.03; c.stroke(); c.fillStyle = "#d8322a"; c.fillRect(0.1, -0.3, 0.2, 0.08); c.restore(); }
    for (const { b } of baked) { const xs = b.poly.map(p => p[0]); if (Math.max(...xs) < vx0 - 20 || Math.min(...xs) > vx1 + 20) continue; buildingShadow(c, b); }
    buildingShadow(c, shopB);
  }
  function drawBox(c: CanvasRenderingContext2D, b: Box, glow: number) {
    c.save(); c.translate(b.x, b.y); c.rotate(b.a); c.globalAlpha = 0.6 + 0.4 * glow; c.setLineDash([0.5, 0.32]); c.strokeStyle = "#ffd23f"; c.lineWidth = 0.18; c.strokeRect(-b.hl, -b.hw, b.hl * 2, b.hw * 2); c.setLineDash([]); c.restore();
  }
  /** The pumps on their islands (under everything that moves). */
  function drawPumps(c: CanvasRenderingContext2D) {
    for (const p of pumps) {
      c.save(); c.translate(p[0], p[1]); c.rotate(aGas);
      c.fillStyle = "rgba(20,40,10,0.25)"; c.fillRect(-0.45, -0.25, 1.0, 0.6);
      c.fillStyle = "#f2f0ea"; c.beginPath(); c.roundRect(-0.55, -0.32, 1.1, 0.64, 0.08); c.fill(); c.strokeStyle = "#8d9399"; c.lineWidth = 0.04; c.stroke();
      c.fillStyle = "#c8281f"; c.fillRect(-0.55, -0.32, 1.1, 0.14);
      c.fillStyle = "#26323d"; c.fillRect(-0.3, -0.12, 0.6, 0.22);
      c.strokeStyle = "#2b2f33"; c.lineWidth = 0.05; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 0.5, 0); c.quadraticCurveTo(s * 0.75, 0.4, s * 0.6, 0.55); c.stroke(); }
      c.restore();
    }
  }
  /** The station's canopy over the pumps: white with a red band and a plain "Gas" on it; see-through when the car's under it. */
  function drawCanopy(c: CanvasRenderingContext2D, under: boolean) {
    c.save(); c.globalAlpha = under ? 0.16 : 0.95;
    c.fillStyle = "rgba(20,40,10,0.18)"; c.save(); c.translate(1.4, 1.1); pathPoly(c, canopy); c.fill(); c.restore();
    pathPoly(c, canopy); c.fillStyle = "#f4f3ef"; c.fill(); c.strokeStyle = "#c8281f"; c.lineWidth = 0.7; c.stroke();
    if (under) { c.restore(); return; }
    c.translate(...local(0, 16)); c.rotate(aGas + Math.PI); c.scale(0.05, 0.05); c.fillStyle = "#c8281f"; c.font = "800 70px system-ui, -apple-system, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("Gas", 0, 0);
    c.restore();
  }
  function drawStanding(c: CanvasRenderingContext2D, vx0: number, vy0: number, vx1: number, vy1: number) {
    for (const { im } of baked) if (im.x < vx1 + 2 && im.x + im.w > vx0 - 2 && im.y < vy1 + 2 && im.y + im.h > vy0 - 2) c.drawImage(im.cv, im.x, im.y, im.w, im.h);
    if (shopIm.x < vx1 + 2 && shopIm.x + shopIm.w > vx0 - 2 && shopIm.y < vy1 + 2 && shopIm.y + shopIm.h > vy0 - 2) c.drawImage(shopIm.cv, shopIm.x, shopIm.y, shopIm.w, shopIm.h);
  }
  function drawTrees(c: CanvasRenderingContext2D, vx0: number, vy0: number, vx1: number, vy1: number, time: number, carX: number, carY: number, alphaOf: (i: number, near: boolean) => number) {
    allTrees.forEach(({ t, b }, i) => {
      if (t.x + t.r < vx0 || t.x - t.r > vx1 || t.y + t.r < vy0 || t.y - t.r > vy1 || (t as { kind?: string }).kind === "well") return;
      drawTree(c, t, b, alphaOf(i, Math.hypot(t.x - carX, t.y - carY) < t.r + 2.5), time, 0);
    });
  }
  return { pts, cum, L, at, side, dirAt, roadS, sFlat, sGas, sJ, sH, flatSpot, yard, yardBox, gasBox, pumps, shopC, local, tractorAt, catAt, signs, surface, collide, clearAt,
    guideOut1: guide(guideOut1), guideOut2: (sFrom: number) => guide(guideOut2At(sFrom)), guideBack: guide(guideBack), along, drawGround, drawBox, drawPumps, drawCanopy, drawStanding, drawTrees, drawPoles, canopy, Y };
}
function ptO(p: Pt) { return { x: p[0], y: p[1] }; }
export type Aylmer = ReturnType<typeof buildAylmer>;
