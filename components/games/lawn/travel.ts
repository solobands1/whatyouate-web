// The trip between home and the community centre, following the real route seen from above: out of the farm driveway
// left (west) along Ron McNeil Line, round the bend and left by the farm with the white barns onto Main Street, a run
// west-southwest beside the tree line and the old rail bed, past the business with the big lot and into Springfield,
// right (north) onto Wellington Street, which becomes Whittaker Road, then left into the community centre. Coming home
// is the same road backwards. Everything is drawn life size and up close (the truck, the trailer and the tractor are
// big on screen, like the first version of the drive): fields in rows, ditches and gravel shoulders, fences, hydro
// poles and their wires, mailboxes at the driveways, farms and houses with roofs. The long straights are squeezed so
// the whole drive takes about 27 seconds at an easy pace; the turns, the signs and the scenery are where they really
// are. It always plays through (there's no skipping it).
import type { Building, Pt } from "../lawnMap";
import { LAWN_MAP, toMetres } from "../lawnMap";
import { drawBuilding, buildingShadow, drawTree, drawMower, drawCat, drawVehicle, type Paint } from "./art";
import { drawRig, drawStraps, rigPt, RIG, type Rig } from "./rig";
import { mulberry32 } from "./geo";

// the route, traced from the driving directions on a north-up aerial image (pixels of about 0.876 m), farm first
const ROUTE_PX: Pt[] = [
  [2983, 517], [2842.3, 547.9], [2795, 560.2], [2675.8, 601.9], [2657.5, 605.8], [2653.8, 606.1], [2649.4, 605.8], [2645, 605], [2640.3, 603.6], [2633.5, 600.8],
  [2630.2, 598.7], [2627.3, 595.8], [2624.6, 591.6], [2622, 586.7], [2614.1, 558.8], [2563.6, 574.5], [2367, 644], [2340.4, 651.6], [2015.2, 721.1], [1449.4, 843.1],
  [1084.9, 919.9], [984, 941.1], [862, 967.4], [761.6, 987.9], [555.2, 1034.7], [528, 920.2], [499.3, 772], [494.1, 745.5], [461.8, 751], [416.4, 758.7],
  [402.4, 753.5], [400.3, 752.8], [340, 764.2], [345.1, 792.6],
];
const MPP = 0.876;
// the drive, squeezed (segment i runs from point i to i + 1, counting the driveway as point 0): the driveway and the
// bend a little, Ron McNeil Line a lot, Main Street most of all (its farm end, the tree line and the village each keep
// about 40 m), Wellington and Whittaker and the road into the community centre somewhere between
const squeeze = (i: number) => (i === 0 ? 0.75 : i <= 3 ? 0.14 : i <= 14 ? 0.45 : i <= 18 ? 0.07 : i <= 20 ? 0.04 : i <= 24 ? 0.07 : i <= 27 ? 0.17 : i <= 32 ? 0.22 : 0.7);
const WAIT = 2.0, DRIVE = 24, STAY = 1.6;        // seconds at the start, driving, at the end
const OBL_T = 0.3;                               // how much wall the buildings show (a 3/4 view, like the first drive)
const LANE = 1.8;                                // the truck keeps to the right-hand lane
const FONT = "system-ui, -apple-system, sans-serif";

type Ev = { at: number; out: string; home: string; turn: number };   // a sign along the way: where, the names each way, -1 left / +1 right (going out)
type TreeT = { x: number; y: number; r: number; seed: number; spruce?: boolean };
type Pole = { x: number; y: number; a: number };
type Box = { x: number; y: number; a: number; col: string };
type Cow = { x: number; y: number; a: number; seed: number };
type Car = { x: number; y: number; len: number; wid: number; heading: number; color: string };
type Bld = { b: Building; x0: number; y0: number; x1: number; y1: number; cy: number };

export function startTravel(canvas: HTMLCanvasElement, wrap: HTMLElement, o: { dir: "out" | "home"; paint: Paint; onDone: () => void; debug: boolean }) {
  const ctx = canvas.getContext("2d")!, out = o.dir === "out";
  // ── the road: real points (metres), the squeezed copy we drive, a smooth dense path along it ──
  const real: Pt[] = [[ROUTE_PX[0][0] * MPP, (ROUTE_PX[0][1] + 30) * MPP], ...ROUTE_PX.map(p => [p[0] * MPP, p[1] * MPP] as Pt)];   // the driveway first
  const V: Pt[] = [real[0]]; for (let i = 0; i < real.length - 1; i++) { const f = squeeze(i); V.push([V[i][0] + (real[i + 1][0] - real[i][0]) * f, V[i][1] + (real[i + 1][1] - real[i][1]) * f]); }
  let pts: Pt[] = []; for (let i = 0; i < V.length - 1; i++) { const [a, b] = [V[i], V[i + 1]], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len)); for (let k = 0; k < n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); }
  pts.push(V[V.length - 1]);
  for (let pass = 0; pass < 3; pass++) pts = pts.map((_, i) => { const w = Math.min(6, i, pts.length - 1 - i); let x = 0, y = 0; for (let k = -w; k <= w; k++) { x += pts[i + k][0]; y += pts[i + k][1]; } return [x / (2 * w + 1), y / (2 * w + 1)] as Pt; });   // round the corners (a truck-sized turn)
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  const at = (s: number): Pt => {
    if (s < 0) { const d = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) || 1; return [pts[0][0] + ((pts[0][0] - pts[1][0]) / d) * -s, pts[0][1] + ((pts[0][1] - pts[1][1]) / d) * -s]; }   // past the ends, the road carries straight on
    if (s > L) { const n = pts.length - 1, d = Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1]) || 1; return [pts[n][0] + ((pts[n][0] - pts[n - 1][0]) / d) * (s - L), pts[n][1] + ((pts[n][1] - pts[n - 1][1]) / d) * (s - L)]; }
    let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; } const u = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]); return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * u, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * u]; };
  const dirAt = (s: number) => { const a = at(s - 1.5), b = at(s + 1.5); return Math.atan2(b[1] - a[1], b[0] - a[0]); };
  const sideOf = (s: number, off: number): Pt => { const a = dirAt(s), p = at(s); return [p[0] - Math.sin(a) * off, p[1] + Math.cos(a) * off]; };   // + off = to the right going out
  const nearestS = (p: Pt) => { let best = 0, bd = Infinity; for (let i = 0; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - p[0], pts[i][1] - p[1]); if (d < bd) { bd = d; best = cum[i]; } } return best; };
  const sV = V.map(nearestS);   // where each route point falls along the smooth path
  const sVil = sV[21] - 4;      // where Springfield begins (no more ditches, fences or fields along the road)
  // the signs and turns (going out); coming home they're met in reverse with the other names and the other hand
  const evs: Ev[] = [
    { at: sV[1], out: "Ron McNeil Line", home: "", turn: -1 },
    { at: sV[15], out: "Main Street", home: "Ron McNeil Line", turn: -1 },
    { at: sV[25], out: "Wellington Street", home: "Main Street", turn: 1 },
    { at: sV[25] + (sV[28] - sV[25]) * 0.45, out: "Whittaker Road", home: "Wellington Street", turn: 0 },
    { at: sV[28], out: "Malahide Community Place", home: "Whittaker Road", turn: -1 },
  ];
  // ── the drive: pulls away, eases off for each turn and round the bend, stops at the end; scaled to take DRIVE seconds ──
  const slowAt: [number, number][] = [...evs.filter(e => e.turn).map(e => [e.at, 0.45] as [number, number]), [sV[9], 0.62]];   // where, and how slow (a share of full speed)
  const shape = (p: number) => { const s = out ? p : L - p; let k = 1; for (const [at0, f] of slowAt) k = Math.min(k, f + (1 - f) * Math.min(1, Math.abs(at0 - s) / 20)); return Math.max(0.1, Math.min(1, (p + 3) / 26, (L - p + 2) / 30)) * k; };
  let need = 0; for (let p = 0; p < L; p += 0.5) need += 0.5 / shape(p);
  const vmax = need / DRIVE;
  // the lane: in the middle of the driveway and the parking lot, on the right-hand side of the road in between
  const laneOff = (s: number) => LANE * Math.max(0, Math.min(1, (s - sV[1] + 6) / 12, (L - 6 - s) / 10));
  const laneAt = (s: number, dirSign: number) => sideOf(s, dirSign * laneOff(s));

  // ── the scenery, laid out once along the squeezed road ──
  const rnd = mulberry32(42);
  const rectAt = (cx: number, cy: number, w: number, h: number, a: number): Pt[] => { const c = Math.cos(a), sn = Math.sin(a); return ([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] as Pt[]).map(([x, y]) => [cx + x * c - y * sn, cy + x * sn + y * c]); };
  const strip = (s0: number, s1: number, o0: number, o1: number, step = 2): Pt[] => { const a: Pt[] = [], b: Pt[] = []; for (let s = s0; ; s = Math.min(s1, s + step)) { a.push(sideOf(s, o0)); b.push(sideOf(s, o1)); if (s >= s1) break; } return [...a, ...b.reverse()]; };
  const offLine = (s0: number, s1: number, off: number, step = 1.5): Pt[] => { const r: Pt[] = []; for (let s = s0; s < s1; s += step) r.push(sideOf(s, off)); r.push(sideOf(s1, off)); return r; };
  const unit = (a: Pt, b: Pt): Pt => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; };
  const mainA = Math.atan2(V[25][1] - V[16][1], V[25][0] - V[16][0]);   // the way Main Street runs (going out); the fields line up with it
  // the side roads (each from its junction outward): Ron McNeil east past the farm, the road north at the bend, Main
  // Street on west past Wellington, Wellington south, Whittaker north past the community centre
  const sideRoads: { p: Pt[]; rural: boolean }[] = [];
  { const e = unit(at(sV[1] + 12), V[1]); sideRoads.push({ p: [[V[1][0] - e[0] * 7, V[1][1] - e[1] * 7], [V[1][0] + e[0] * 160, V[1][1] + e[1] * 160]], rural: true }); }
  { const n = unit(V[14], V[15]); sideRoads.push({ p: [V[15], [V[15][0] + n[0] * 160, V[15][1] + n[1] * 160]], rural: true }); }
  { const m = unit(V[24], V[25]); sideRoads.push({ p: [V[25], [V[25][0] + m[0] * 140, V[25][1] + m[1] * 140]], rural: false }); }
  { const w = unit(V[26], V[25]); sideRoads.push({ p: [V[25], [V[25][0] + w[0] * 140, V[25][1] + w[1] * 140]], rural: false }); }
  { const n = unit(V[26], V[28]); sideRoads.push({ p: [V[28], [V[28][0] + n[0] * 140, V[28][1] + n[1] * 140]], rural: false }); }
  const segD = (p: Pt, a: Pt, b: Pt) => { const dx = b[0] - a[0], dy = b[1] - a[1], u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - a[0] - dx * u, p[1] - a[1] - dy * u); };
  const roadDist = (p: Pt) => { let d = Infinity; for (let i = 0; i < pts.length; i += 2) d = Math.min(d, Math.hypot(pts[i][0] - p[0], pts[i][1] - p[1])); for (const r of sideRoads) d = Math.min(d, segD(p, r.p[0], r.p[1])); return d; };
  const clear = (p: Pt, r: number) => roadDist(p) >= r;

  const blds: Bld[] = [], trees: TreeT[] = [], poles: Pole[][] = [], boxes: Box[] = [], cows: Cow[] = [], cars: Car[] = [];
  const lawns: Pt[][] = [], gravel: Pt[][] = [], paved: Pt[][] = [], stripes: [Pt, Pt][] = [], fenceRuns: Pt[][] = [], drives: { p: Pt[]; paved: boolean }[] = [], silos: [number, number, number][] = [], play: Pt[] = [];
  const gaps: { s0: number; s1: number; side: number }[] = [];   // breaks in the roadside fence (driveways, yards)
  const addB = (b: Building) => { const xs = b.poly.map(p => p[0]), ys = b.poly.map(p => p[1]); blds.push({ b, x0: Math.min(...xs), y0: Math.min(...ys) - b.height * OBL_T, x1: Math.max(...xs), y1: Math.max(...ys), cy: (Math.min(...ys) + Math.max(...ys)) / 2 }); return b; };
  const bld = (poly: Pt[], kind: Building["kind"], wall: string, roof: string, height: number, extra: Partial<Building> = {}) => addB({ kind, poly, height, wall, roof, trim: "#ffffff", ...extra });
  const tree = (p: Pt, r: number, spruce = false) => { if (clear(p, r * 0.7 + 4.8)) trees.push({ x: p[0], y: p[1], r, seed: Math.floor(rnd() * 9999), spruce }); };
  const mailbox = (s: number, side: number) => { const a = dirAt(s), p = sideOf(s, side * 5.0); boxes.push({ x: p[0], y: p[1], a, col: ["#e9edf0", "#2b2f33", "#8a3b30", "#3d5a40"][Math.floor(rnd() * 4)] }); };
  const driveway = (s: number, side: number, depth: number, w = 3.4, kind: "gravel" | "paved" = "gravel") => { drives.push({ p: strip(s - w / 2, s + w / 2, side * 3.4, side * depth, w), paved: kind === "paved" }); gaps.push({ s0: s - w / 2 - 1, s1: s + w / 2 + 1, side }); };
  const roofs = ["#5d5a58", "#6b4f42", "#4f5357", "#7a6a5a", "#8a4a3c", "#5b6b78"], walls = ["#e4dccb", "#d8cdbb", "#e6e1d6", "#cfd6da", "#efe6d2", "#d9c7aa"];
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  // a house set back from the road (front to the street), its driveway and mailbox, a tree or two in the yard
  const house = (s: number, side: number, o: { set?: number; w?: number; d?: number; h?: number; garage?: boolean; yard?: boolean } = {}) => {
    const a = dirAt(s), set = o.set ?? 11 + rnd() * 3, w = o.w ?? 9 + rnd() * 2.5, d = o.d ?? 7 + rnd() * 1.5, c = sideOf(s, side * (set + d / 2));
    if (!clear(c, Math.hypot(w, d) / 2 + 5)) return false;
    bld(rectAt(c[0], c[1], w, d, a), "house", pick(walls), pick(roofs), o.h ?? 5 + rnd() * 1.2);
    const ds = s + (rnd() < 0.5 ? -1 : 1) * (w / 2 + 2.2);
    driveway(ds, side, set + d * 0.8, 3.2, side > 0 && rnd() < 0.5 ? "paved" : "gravel"); mailbox(ds + 2.4 * (ds > s ? 1 : -1), side);
    if (o.garage ?? rnd() < 0.45) { const g = sideOf(ds, side * (set + d * 0.5)); if (clear(g, 6)) bld(rectAt(g[0], g[1], 4.4, 6, a), "garage", pick(walls), pick(roofs), 3.4); }
    if (rnd() < 0.5) { const car = sideOf(ds, side * (set - 2.4)); cars.push({ x: car[0], y: car[1], len: 4.4, wid: 1.8, heading: ((a + (side > 0 ? Math.PI / 2 : -Math.PI / 2)) * 180) / Math.PI + 90, color: pick(["#8b2f2a", "#e8e8e4", "#2f3d52", "#6d7378", "#3e5b3c"]) }); }
    if (o.yard) lawns.push(strip(s - w / 2 - 8, s + w / 2 + 8, side * 6.6, side * (set + d + 12), 4));
    gaps.push({ s0: s - w / 2 - 6, s1: s + w / 2 + 6, side });
    tree(sideOf(s + (rnd() - 0.5) * w * 1.6, side * (set + d + 3 + rnd() * 4)), 3 + rnd() * 1.6);
    if (rnd() < 0.7) tree(sideOf(s + (rnd() < 0.5 ? -1 : 1) * (w / 2 + 4 + rnd() * 3), side * (7.8 + rnd() * 3)), 2.4 + rnd() * 1.3);
    return true;
  };

  // home: the farmhouse (its front to the road, like the real one), the red barn behind, the big tree, the gravel drive
  const G = 1.3;   // the farm map is drawn at about half true size; here it's nearer life size
  {
    const m = toMetres(LAWN_MAP), [dx, dy] = V[0], ry = V[1][1];
    const house0 = m.buildings.find(b => b.kind === "house")!, hx = (Math.min(...house0.poly.map(p => p[0])) + Math.max(...house0.poly.map(p => p[0]))) / 2, hy = Math.min(...house0.poly.map(p => p[1]));
    const barn0 = m.buildings.find(b => b.kind === "barn")!, bx = barn0.poly.reduce((a, p) => a + p[0], 0) / 4, by = barn0.poly.reduce((a, p) => a + p[1], 0) / 4;
    for (const b of m.buildings) {
      const isHouse = b.kind === "house" || b.kind === "porch" || b.kind === "deck", isBarn = b.kind === "barn" || b.kind === "other";
      if (!isHouse && !isBarn) continue;
      const shift = isHouse ? (p: Pt): Pt => [dx - 8.6 + (p[0] - hx) * G, ry + 9.5 + (p[1] - hy) * G] : (p: Pt): Pt => [dx + 15 + (p[0] - bx) * G, ry + 36 + (p[1] - by) * G];
      addB({ ...b, height: b.height * (isHouse ? 1.25 : 1.2), poly: b.poly.map(shift), wings: b.wings?.map(w => w.map(shift)), frontGable: b.frontGable?.map(shift), chimney: b.chimney && shift(b.chimney) });
    }
    lawns.push([[dx - 34, ry + 6.6], [dx + 34, ry + 6.6], [dx + 34, dy + 34], [dx - 34, dy + 34]]);
    gravel.push([[dx + 6, dy + 18], [dx + 26, dy + 18], [dx + 26, dy + 26], [dx + 6, dy + 26]]);   // the turnaround by the barn
    drives.push({ p: [[dx - 1.9, ry + 3], [dx + 1.9, ry + 3], [dx + 1.9, dy + 22], [dx - 1.9, dy + 22]], paved: false });
    gaps.push({ s0: -40, s1: sV[1] + 30, side: -1 });
    boxes.push({ x: dx + 2.9, y: ry + 5.2, a: Math.PI, col: "#e9edf0" });
    trees.push({ x: dx + 7.5, y: ry + 12, r: 4.4, seed: 77 }, { x: dx - 24, y: ry + 13, r: 3.6, seed: 78 }, { x: dx - 27, y: dy + 12, r: 3.2, seed: 79 }, { x: dx + 26, y: ry + 12, r: 3, seed: 80 }, { x: dx - 6, y: dy + 22, r: 3.4, seed: 81 });
    for (let k = 0; k < 6; k++) trees.push({ x: dx + 32 + (k % 2) * 3, y: ry + 10 + k * 5.2, r: 2.6, seed: 90 + k, spruce: true });   // the spruce windbreak
  }
  // Ron McNeil Line: a neighbour across the road, cows in the pasture beside them
  house(sV[1] + 30, 1, { set: 13, w: 10.5, d: 8.5, h: 6.6, yard: true });
  for (let k = 0, n = 0; k < 30 && n < 6; k++) { const p = sideOf(sV[1] + 44 + rnd() * 26, 12 + rnd() * 14); if (clear(p, 10)) { cows.push({ x: p[0], y: p[1], a: rnd() * 6.28, seed: n }); n++; } }
  // the farm by the bend with its long white barns, the silo and a big gravel yard, north of Main Street
  {
    const a = mainA, s0 = sV[15] + 14;
    lawns.push(strip(sV[15] + 6, sV[15] + 52, 6.6, 48, 4));
    gravel.push(strip(s0, s0 + 34, 9, 40, 4));
    for (let k = 0; k < 3; k++) { const c = sideOf(s0 + 17 + k * 2.5, 15 + k * 11); bld(rectAt(c[0], c[1], 32, 8.5, a), "shed", "#e6e8ea", "#f1f3f5", 4.2); }
    const hc = sideOf(sV[15] + 46, 15); bld(rectAt(hc[0], hc[1], 10, 8.5, a), "house", "#efe9dd", "#4f5357", 6.4);
    driveway(s0 + 6, 1, 12, 5); mailbox(s0 + 10, 1);
    const sc = sideOf(s0 + 36, 30); silos.push([sc[0], sc[1], 2.6], [sc[0] + 6, sc[1] - 1, 2.2]);
    tree(sideOf(sV[15] + 52, 24), 4); tree(sideOf(sV[15] + 40, 10), 3.2);
    gaps.push({ s0: sV[15] + 4, s1: sV[15] + 54, side: 1 });
  }
  // the south side of Main Street: a farmhouse, then the tree line and the old rail bed
  house(sV[15] + 30, -1, { set: 12, w: 10, d: 8.5, h: 6.2, yard: true, garage: false });
  for (let s = sV[16] + 20; s < sV[21] + 6; s += 4.6 + rnd() * 1.6) if (rnd() < 0.88) tree(sideOf(s, -(11 + rnd() * 2.5)), 3.2 + rnd() * 1.6);
  const railBed = offLine(sV[16] + 12, sV[21] + 14, -17.5, 3);
  // the business with the big paved lot (north side, at the edge of the village)
  {
    const s0 = sV[21] - 2, a = dirAt(s0 + 14);
    paved.push(strip(s0, s0 + 30, 5.4, 24, 3));
    for (let k = 0; k <= 7; k++) { const s = s0 + 2 + k * 3.4; stripes.push([sideOf(s, 9), sideOf(s, 13.5)]); if (k < 7 && rnd() < 0.6) { const c = sideOf(s + 1.7, 11.2); cars.push({ x: c[0], y: c[1], len: 4.3, wid: 1.8, heading: ((a + Math.PI / 2) * 180) / Math.PI + 90, color: pick(["#8b2f2a", "#e8e8e4", "#2f3d52", "#6d7378", "#c9a23a"]) }); } }
    const bc = sideOf(s0 + 15, 30); bld(rectAt(bc[0], bc[1], 26, 12, a), "shed", "#d9dde0", "#e4e7ea", 5.5);
    tree(sideOf(s0 + 34, 12), 3); tree(sideOf(s0 - 4, 14), 3.4);
  }
  // Springfield: houses both sides of Main Street and Wellington Street, a lawn all through
  for (let s = sV[21] + 8; s < sV[25] - 8; s += 13 + rnd() * 3) house(s, -1);
  for (let s = sV[21] + 34; s < sV[25] - 8; s += 13 + rnd() * 3) house(s, 1);
  for (let s = sV[25] + 12; s < sV[28] - 8; s += 13 + rnd() * 3) { house(s, -1); house(s + 4, 1); }
  for (let s = sV[28] + 8; s < sV[32] - 4; s += 7) tree(sideOf(s, -(9 + rnd() * 4)), 2.6 + rnd() * 1.2);
  // the community centre: the lot, the hall with its gym, the two ball diamonds north of the entrance road
  const E = V[V.length - 1];
  const diamonds: Pt[] = [[E[0] - 38, E[1] - 30], [E[0] + 4, E[1] - 30]];
  {
    lawns.push([[E[0] - 80, E[1] - 82], [E[0] + 40, E[1] - 82], [E[0] + 40, E[1] + 60], [E[0] - 80, E[1] + 60]]);
    paved.push([[E[0] - 16, E[1] - 3], [E[0] + 13, E[1] - 3], [E[0] + 13, E[1] + 15], [E[0] - 16, E[1] + 15]]);
    for (let k = 0; k < 8; k++) { const x = E[0] - 15 + k * 3.4; if (Math.abs(x + 1.7 - E[0]) < 3.4) continue; stripes.push([[x, E[1] + 9], [x, E[1] + 14.6]]); if (k !== 3 && rnd() < 0.55) cars.push({ x: x + 1.7, y: E[1] + 11.8, len: 4.3, wid: 1.8, heading: 180, color: pick(["#8b2f2a", "#e8e8e4", "#2f3d52", "#6d7378"]) }); }
    bld(rectAt(E[0] + 1, E[1] + 25, 18, 12, 0), "hall", "#dcd8cf", "#8f959b", 6);
    bld(rectAt(E[0] + 12, E[1] + 25, 5, 9, 0), "hall", "#dcd8cf", "#8f959b", 4.4);
    bld(rectAt(E[0] - 0.5, E[1] + 24.5, 8, 8, 0), "hall", "#e8e5de", "#e3e7ea", 9);
    for (let k = 0; k < 7; k++) trees.push({ x: E[0] - 58 - (k % 2) * 4, y: E[1] - 8 + k * 5, r: 2.8 + (k % 3) * 0.4, seed: 300 + k, spruce: true });   // the spruce grove on the west edge
    trees.push({ x: E[0] + 22, y: E[1] + 8, r: 3.6, seed: 310 }, { x: E[0] - 26, y: E[1] + 30, r: 3.2, seed: 311 }, { x: E[0] + 19, y: E[1] - 4, r: 3, seed: 312 }, { x: E[0] - 21, y: E[1] + 4, r: 3.3, seed: 313 }, { x: E[0] + 24, y: E[1] + 30, r: 3.8, seed: 314 });
    play.push([E[0] - 30, E[1] + 18]);   // the playground west of the hall
  }
  // fences along the fields, hydro poles along the north side of the country roads (and the east side of Wellington)
  for (const side of [-1, 1]) {
    let run: Pt[] = [];
    for (let s = sV[1] + 6; s < sVil; s += 3) {
      const p = sideOf(s, side * 7.6), gap = gaps.some(g => g.side === side && s > g.s0 && s < g.s1) || !clear(p, 7.3);
      if (gap) { if (run.length > 1) fenceRuns.push(run); run = []; } else run.push(p);
    }
    if (run.length > 1) fenceRuns.push(run);
  }
  for (const [s0, s1] of [[sV[1] + 8, sV[5]], [sV[15] + 10, sV[25] - 9], [sV[25] + 9, sV[28] - 7]]) { const run: Pole[] = []; for (let s = s0; s < s1; s += 26) { const p = sideOf(s, 6.3); if (clear(p, 5.6)) run.push({ x: p[0], y: p[1], a: dirAt(s) }); } poles.push(run); }
  // trees along the field edges here and there, and the odd one by the road
  for (let s = sV[1] + 20; s < sVil; s += 9) if (rnd() < 0.3) { const sd = rnd() < 0.5 ? -1 : 1; if (!gaps.some(g => g.side === sd && s > g.s0 - 4 && s < g.s1 + 4)) tree(sideOf(s, sd * (10 + rnd() * 18)), 2.6 + rnd() * 1.8); }
  trees.sort((p, q) => p.y - q.y); blds.sort((p, q) => p.cy + p.b.height * 0.2 - q.cy - q.b.height * 0.2);   // (the hall's tall gym after the hall round it)
  // the roads, cut into the bits each is drawn with
  const roadPts = (s0: number, s1: number) => { const r: Pt[] = [at(s0)]; for (let i = 0; i < pts.length; i++) if (cum[i] > s0 && cum[i] < s1) r.push(pts[i]); r.push(at(s1)); return r; };
  const rural = roadPts(sV[1] - 3, sVil), village = roadPts(sVil, L), full = roadPts(sV[1] - 3, L), driveIn = roadPts(-14, sV[1] - 2);
  const edgeRuns = [[sV[1] + 10, sV[15] - 9], [sV[15] + 9, sVil]].map(([a, b]) => [offLine(a, b, -3.25), offLine(a, b, 3.25)]).flat();
  const ditchRuns = [[sV[1] + 3, sV[15] - 6], [sV[15] + 6, sVil]].map(([a, b]) => [offLine(a, b, -5.6, 2), offLine(a, b, 5.6, 2)]).flat();
  const sidewalk = offLine(sVil + 2, sV[25] - 7, 6.2), sidewalk2 = offLine(sV[25] + 7, sV[28] - 7, 6.2);
  const blobCache = new Map<number, number[][]>();
  const blobsFor = (seed: number) => { let b = blobCache.get(seed); if (!b) { const r = mulberry32(seed); b = []; for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + r(), d = 0.45 + r() * 0.2; b.push([Math.cos(a) * d, Math.sin(a) * d, 0.42 + r() * 0.12, r()]); } blobCache.set(seed, b); } return b; };
  const baleCache = new Map<string, Pt[]>();
  // the minimap: the real route, fitted into a little panel
  const mx0 = Math.min(...real.map(p => p[0])), mx1 = Math.max(...real.map(p => p[0])), my0 = Math.min(...real.map(p => p[1])), my1 = Math.max(...real.map(p => p[1]));
  const realAt = (s: number): Pt => { let i = 0; while (i < sV.length - 2 && sV[i + 1] < s) i++; const u = Math.max(0, Math.min(1, (s - sV[i]) / Math.max(1e-6, sV[i + 1] - sV[i]))); return [real[i][0] + (real[i + 1][0] - real[i][0]) * u, real[i][1] + (real[i + 1][1] - real[i][1]) * u]; };
  // where each street sign stands: at the corner, on the side of the turn, clear of both roads
  const onB = (p: Pt) => blds.some(b => p[0] > b.x0 - 3 && p[0] < b.x1 + 3 && p[1] > b.y0 - 1 && p[1] < b.y1 + 3);
  const signAt = (e: Ev, side: number) => { for (const sd of [side, -side]) for (let off = 8; off < 20; off += 1) { const p = sideOf(e.at, sd * off); if (clear(p, 6.4) && !onB(p)) return p; } return sideOf(e.at, side * 9); };
  const dirSign = out ? 1 : -1;
  const signs = evs.map(e => { const name = out ? e.out : e.home, turn = out ? e.turn : -e.turn; return { name, p: e === evs[0] ? [V[1][0] + 5.6, V[1][1] + 6] as Pt : signAt(e, (turn >= 0 ? 1 : -1) * dirSign) }; }).filter(x => x.name);   // (at the farm gate it stands across the drive from the cat)
  if (out) signs.push({ name: "Springfield", p: sideOf(sV[21] - 10, 8.4) });   // the village sign, coming into Springfield

  let W = 300, H = 600, dpr = 1, raf = 0, t0 = 0, last = 0, done = false, sNow = 0, stayT = 0;
  const resize = () => { W = wrap.clientWidth; H = wrap.clientHeight; dpr = window.devicePixelRatio || 1; canvas.style.width = `${W}px`; canvas.style.height = `${H}px`; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); };
  resize(); const ro = new ResizeObserver(resize); ro.observe(wrap);
  let camX = 0, camY = 0, camInit = false;
  const smooth = (q: number) => { const k = Math.max(0, Math.min(1, q)); return k * k * (3 - 2 * k); };

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!t0) { t0 = now; last = now; }
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (t > WAIT && sNow < L) sNow = Math.min(L, sNow + vmax * shape(sNow) * dt);
    const s = out ? sNow : L - sNow;
    // the truck's front, its heading, the hitch, the trailer's heading (the trailer follows the road round corners)
    const tl = RIG.truckLen, front = laneAt(s, dirSign), back = laneAt(s - dirSign * tl, dirSign), a1 = Math.atan2(front[1] - back[1], front[0] - back[0]);
    const tail = laneAt(s - dirSign * RIG.bedEnd, dirSign), a2 = Math.atan2(back[1] - tail[1], back[0] - tail[0]);
    // the camera: up close (about 24 m across, like the first drive), just ahead of the truck, gliding; it leans
    // toward the farm and the hall when the truck is near them
    const S = Math.min(W / 24, H / 30), lead = 3.5;
    let tx = front[0] + Math.cos(a1) * lead, ty = front[1] + Math.sin(a1) * lead;
    { const wE = smooth(1 - Math.hypot(front[0] - E[0], front[1] - E[1]) / 26) * 0.5; tx += (E[0] - 1 - tx) * wE; ty += (E[1] + 14 - ty) * wE; }
    { const wF = smooth(1 - Math.hypot(front[0] - V[0][0], front[1] - V[0][1]) / 22) * 0.35; tx += (V[0][0] - 7 - tx) * wF; ty += (V[1][1] + 10 - ty) * wF; }
    { // never lose any of the rig off the screen or under the captions at the top
      const ends = [front, laneAt(s - dirSign * RIG.rampEnd, dirSign)], xs = ends.map(p => p[0]), ys = ends.map(p => p[1]);
      tx = Math.min(Math.max(tx, Math.max(...xs) - W / S / 2 + 1.5), Math.min(...xs) + W / S / 2 - 1.5);
      ty = Math.min(Math.max(ty, Math.max(...ys) - (H * 0.45 - 30) / S), Math.min(...ys) + (H * 0.55 - 100) / S);
    }
    if (!camInit) { camX = tx; camY = ty; camInit = true; }
    const kc = 1 - Math.exp(-dt * 7); camX += (tx - camX) * kc; camY += (ty - camY) * kc;
    const c = ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.save(); c.translate(W / 2 - camX * S, H * 0.55 - camY * S); c.scale(S, S);
    const vx0 = camX - W / S / 2 - 2, vx1 = camX + W / S / 2 + 2, vy0 = camY - (H * 0.55) / S - 2, vy1 = camY + (H * 0.45) / S + 2;
    const inV = (x: number, y: number, m: number) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;
    // ── fields: a patchwork lined up with Main Street, rows across each field, round bales on the hay, grass margins ──
    c.fillStyle = "#8fa557"; c.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    c.save(); c.rotate(mainA);
    { const ca = Math.cos(-mainA), sa = Math.sin(-mainA), corners = [[vx0, vy0], [vx1, vy0], [vx1, vy1], [vx0, vy1]].map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]);
      const ux0 = Math.min(...corners.map(q => q[0])), ux1 = Math.max(...corners.map(q => q[0])), uy0 = Math.min(...corners.map(q => q[1])), uy1 = Math.max(...corners.map(q => q[1]));
      const FW = 24, FH = 36;
      for (let gx = Math.floor(ux0 / FW) * FW; gx < ux1; gx += FW) for (let gy = Math.floor(uy0 / FH) * FH; gy < uy1; gy += FH) {
        const h = mulberry32(((gx / FW) * 7919 + (gy / FH) * 104729) | 0), kind = Math.floor(h() * 5);
        c.fillStyle = ["#a88e66", "#6f9e48", "#b9b56e", "#7fae52", "#5f9440"][kind]; c.fillRect(gx + 0.4, gy + 0.4, FW - 0.8, FH - 0.8);
        if (kind !== 3) {
          c.strokeStyle = ["rgba(110,88,58,0.45)", "rgba(60,110,40,0.55)", "rgba(150,140,80,0.4)", "", "rgba(40,90,30,0.6)"][kind]; c.lineWidth = kind === 4 ? 0.3 : 0.35;
          c.beginPath(); for (let rx = gx + 0.9; rx < gx + FW - 0.4; rx += kind === 4 ? 0.78 : 1.1) { c.moveTo(rx, gy + 0.6); c.lineTo(rx, gy + FH - 0.6); } c.stroke();
        } else { c.fillStyle = "rgba(60,100,40,0.18)"; for (let k = 0; k < 9; k++) { c.beginPath(); c.arc(gx + 2 + h() * (FW - 4), gy + 2 + h() * (FH - 4), 0.8 + h() * 1.4, 0, 7); c.fill(); } }
        if (kind === 2) {
          const key = `${gx},${gy}`; let bales = baleCache.get(key);
          if (!bales) { bales = []; for (let k = 0; k < 4; k++) { const bx = gx + 3 + h() * (FW - 6), by = gy + 3 + h() * (FH - 6), ca2 = Math.cos(mainA), sa2 = Math.sin(mainA); if (clear([bx * ca2 - by * sa2, bx * sa2 + by * ca2], 9)) bales.push([bx, by]); } baleCache.set(key, bales); }
          for (const [bx, by] of bales) { c.fillStyle = "rgba(20,40,10,0.2)"; c.beginPath(); c.arc(bx + 0.35, by + 0.4, 0.8, 0, 7); c.fill(); c.fillStyle = "#d8c27a"; c.beginPath(); c.arc(bx, by, 0.78, 0, 7); c.fill(); c.strokeStyle = "rgba(140,110,50,0.55)"; c.lineWidth = 0.07; c.beginPath(); c.arc(bx, by, 0.48, 0, 7); c.stroke(); c.beginPath(); c.arc(bx, by, 0.2, 0, 7); c.stroke(); }
        }
      } }
    c.restore();
    // ── lawns: the farmyards, Springfield all along its streets, the community centre's grounds ──
    c.fillStyle = "#86b85a"; for (const y of lawns) { pathP(c, y); c.fill(); }
    c.strokeStyle = "#86b85a"; c.lineCap = "butt"; c.lineJoin = "round"; c.lineWidth = 64; strokeP(c, village);
    c.lineWidth = 50; for (const r of sideRoads) if (!r.rural) strokeP(c, r.p);
    // gravel yards, the old rail bed, the parking lots
    c.fillStyle = "#cdbfa5"; for (const g of gravel) { pathP(c, g); c.fill(); }
    c.lineCap = "round"; c.strokeStyle = "#b9a684"; c.lineWidth = 3.6; strokeP(c, railBed);
    c.strokeStyle = "rgba(120,104,80,0.45)"; c.lineWidth = 0.12; c.setLineDash([0.9, 0.7]); strokeP(c, railBed); c.setLineDash([]);
    c.fillStyle = "#6d7073"; for (const lt of paved) { pathP(c, lt); c.fill(); }
    c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = 0.14; c.beginPath(); for (const [a, b] of stripes) { c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); } c.stroke();
    // the ball diamonds: outfield grass, the red-dirt infield, bases, the chain-link fence, the backstop
    for (const [dx, dy] of diamonds) {
      if (!inV(dx, dy, 30)) continue;
      const a0 = -Math.PI / 2 - 0.78, a1d = -Math.PI / 2 + 0.78;
      c.fillStyle = "#6f9e48"; c.beginPath(); c.moveTo(dx, dy); c.arc(dx, dy, 24, a0, a1d); c.closePath(); c.fill();
      c.strokeStyle = "rgba(255,255,255,0.12)"; c.lineWidth = 2; for (let r = 10; r < 24; r += 4) { c.beginPath(); c.arc(dx, dy, r, a0, a1d); c.stroke(); }
      c.fillStyle = "#c0714a"; c.beginPath(); c.moveTo(dx, dy); c.arc(dx, dy, 9.5, a0, a1d); c.closePath(); c.fill();
      c.fillStyle = "#6f9e48"; c.beginPath(); c.moveTo(dx, dy - 1.6); c.lineTo(dx + 4.2, dy - 5.8); c.lineTo(dx, dy - 10); c.lineTo(dx - 4.2, dy - 5.8); c.closePath(); c.fill();
      c.fillStyle = "#ffffff"; for (const [bx, by] of [[0, 0], [4.6, -4.6], [0, -9.2], [-4.6, -4.6]]) c.fillRect(dx + bx - 0.22, dy + by - 0.22, 0.44, 0.44);
      c.strokeStyle = "#8a9096"; c.lineWidth = 0.12; c.beginPath(); c.arc(dx, dy, 24, a0, a1d); c.moveTo(dx, dy); c.lineTo(dx + Math.cos(a0) * 24, dy + Math.sin(a0) * 24); c.moveTo(dx, dy); c.lineTo(dx + Math.cos(a1d) * 24, dy + Math.sin(a1d) * 24); c.stroke();
      c.strokeStyle = "#6f757b"; c.lineWidth = 0.18; c.beginPath(); c.arc(dx, dy + 0.5, 3.4, 0.2, Math.PI - 0.2); c.stroke();
      for (const [lx, ly] of [[dx - 15, dy - 4], [dx + 15, dy - 4]]) { c.fillStyle = "rgba(20,40,10,0.22)"; c.fillRect(lx + 0.3, ly + 0.3, 3.4, 0.22); c.fillStyle = "#6f757b"; c.beginPath(); c.arc(lx, ly, 0.35, 0, 7); c.fill(); c.fillStyle = "#e9edf0"; c.fillRect(lx - 0.7, ly - 1, 1.4, 0.5); }
      c.fillStyle = "#a9adb2"; c.fillRect(dx + 5, dy + 1.2, 5, 1.4); c.fillRect(dx - 10, dy + 1.2, 5, 1.4);   // the bleachers
    }
    for (const [px, py] of play) if (inV(px, py, 12)) playArt(c, px, py);
    // ── the roads: ditches, gravel shoulders, the driveways across them, asphalt, edge and centre lines ──
    c.lineJoin = "round"; c.lineCap = "butt";
    c.strokeStyle = "#7f9a4e"; c.lineWidth = 13; strokeP(c, rural); for (const r of sideRoads) if (r.rural) strokeP(c, r.p);
    c.strokeStyle = "rgba(60,90,40,0.35)"; c.lineWidth = 0.6; for (const d of ditchRuns) strokeP(c, d);
    c.strokeStyle = "#c4b89f"; c.lineWidth = 9.2; strokeP(c, rural); for (const r of sideRoads) if (r.rural) strokeP(c, r.p);
    c.strokeStyle = "#cfc9bb"; c.lineWidth = 8.0; strokeP(c, village); for (const r of sideRoads) if (!r.rural) strokeP(c, r.p);
    c.strokeStyle = "#d8d4ca"; c.lineWidth = 1.5; strokeP(c, sidewalk); strokeP(c, sidewalk2);
    for (const d of drives) { c.fillStyle = d.paved ? "#76797c" : "#cdbfa5"; pathP(c, d.p); c.fill(); }
    c.lineCap = "round"; c.strokeStyle = "#cdbfa5"; c.lineWidth = 3.8; strokeP(c, driveIn);
    c.lineCap = "butt"; c.strokeStyle = "#5f6266"; c.lineWidth = 6.6; for (const r of sideRoads) strokeP(c, r.p);
    c.lineWidth = 7.2; strokeP(c, full);
    c.strokeStyle = "rgba(240,240,232,0.8)"; c.lineWidth = 0.13; for (const e of edgeRuns) strokeP(c, e);
    c.strokeStyle = "#e5c24c"; c.lineWidth = 0.16; c.setLineDash([2.2, 2.6]); strokeP(c, roadPts(sV[1] + 6, L - 12));
    for (const r of sideRoads) { const [a, b] = r.p, u = unit(a, b); c.beginPath(); c.moveTo(a[0] + u[0] * 6, a[1] + u[1] * 6); c.lineTo(b[0], b[1]); c.stroke(); }
    c.setLineDash([]);
    // ── on the ground: parked cars, fences (wire on wooden posts), mailboxes, cows grazing ──
    for (const v of cars) if (inV(v.x, v.y, 4)) drawVehicle(c, v);
    c.strokeStyle = "rgba(70,60,50,0.55)"; c.lineWidth = 0.05; for (const run of fenceRuns) strokeP(c, run);
    c.fillStyle = "#7a6248"; for (const run of fenceRuns) for (const [px, py] of run) if (inV(px, py, 1)) c.fillRect(px - 0.11, py - 0.11, 0.22, 0.22);
    for (const b of boxes) if (inV(b.x, b.y, 2)) mailboxArt(c, b);
    for (const cw of cows) if (inV(cw.x, cw.y, 3)) cowArt(c, cw, t);
    // ── shadows (buildings, trees, poles), then the buildings with their roofs, the silos, the trees ──
    for (const b of blds) if (b.x1 > vx0 - 8 && b.x0 < vx1 && b.y1 > vy0 && b.y0 < vy1 + 8) buildingShadow(c, b.b, OBL_T);
    for (const th of trees) if (inV(th.x, th.y, th.r + 2)) { c.fillStyle = "rgba(20,40,10,0.17)"; c.beginPath(); c.arc(th.x + th.r * 0.3 + 0.3, th.y + th.r * 0.35 + 0.3, th.r * 1.02, 0, 7); c.fill(); }
    for (const run of poles) for (const p of run) if (inV(p.x, p.y, 6)) { c.strokeStyle = "rgba(20,40,10,0.22)"; c.lineWidth = 0.22; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + 3.2, p.y + 2.4); c.stroke(); }
    for (const [sx, sy, sr] of silos) if (inV(sx, sy, 6)) { c.fillStyle = "rgba(20,40,10,0.2)"; c.beginPath(); c.arc(sx + 1.4, sy + 1.2, sr, 0, 7); c.fill(); }
    for (const b of blds) if (b.x1 > vx0 && b.x0 < vx1 && b.y1 > vy0 && b.y0 < vy1) drawBuilding(c, b.b, 1, null, OBL_T);
    for (const [sx, sy, sr] of silos) if (inV(sx, sy, 6)) siloArt(c, sx, sy, sr);
    for (const th of trees) if (inV(th.x, th.y, th.r + 1)) { c.save(); c.translate(th.x, th.y); c.scale(th.r, th.r); drawTree(c, { x: 0, y: 0, r: 1, kind: th.spruce ? "spruce" : undefined }, blobsFor(th.seed), 1, t); c.restore(); }
    // hydro poles: the wires (and their faint shadows), the crossarms and the insulators
    for (const run of poles) {
      for (const [ox, oy, col, w] of [[2.4, 1.8, "rgba(20,40,10,0.14)", 0.06], [0, 0, "rgba(30,30,30,0.5)", 0.05]] as [number, number, string, number][]) {
        c.strokeStyle = col; c.lineWidth = w;
        for (const k of [-1, 1]) { c.beginPath(); run.forEach((p, i) => { const x = p.x + Math.cos(p.a) * 0 - Math.sin(p.a) * k * 0.75 + ox, y = p.y + Math.cos(p.a) * k * 0.75 + oy; if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke(); }
      }
      for (const p of run) if (inV(p.x, p.y, 2)) {
        const nx = -Math.sin(p.a), ny = Math.cos(p.a);
        c.strokeStyle = "#5b4430"; c.lineWidth = 0.18; c.beginPath(); c.moveTo(p.x - nx * 0.95, p.y - ny * 0.95); c.lineTo(p.x + nx * 0.95, p.y + ny * 0.95); c.stroke();
        c.fillStyle = "#7a5a3c"; c.beginPath(); c.arc(p.x, p.y, 0.22, 0, 7); c.fill();
        c.fillStyle = "#dfe6ea"; for (const k of [-0.75, 0.75]) { c.beginPath(); c.arc(p.x + nx * k, p.y + ny * k, 0.09, 0, 7); c.fill(); }
      }
    }
    // street signs at the turns (the name of the road being turned onto, whichever way Pat's going) and the village sign
    for (const sg of signs) if (inV(sg.p[0], sg.p[1], 12)) sign(c, sg.p[0], sg.p[1], sg.name, sg.name.includes("Community") ? "#2f5a1f" : "#2d6a3a", S);
    // the cat: seeing Pat off at the end of the drive, or there to meet him
    { const cx = V[1][0] - 3.4, cy = V[1][1] + 7.2; drawCat(c, { x: cx, y: cy, h: -Math.PI / 2, act: "sit", phase: 1 }, t, 2.6); if (out ? t < WAIT + 1.6 : sNow >= L - 1) bubble(c, cx, cy - 1.6, "Meow!", S); }
    // ── the truck and trailer, the tractor strapped on, the turn signal blinking before each turn ──
    const next = evs.map(e => ({ s: out ? e.at : L - e.at, turn: out ? e.turn : -e.turn })).filter(e => e.turn && e.s > sNow - 6 && e.s - sNow < 34)[0];
    const blink = next && Math.floor(t * 2.6) % 2 === 0 ? next.turn : 0;
    const r1: Rig = { x: front[0], y: front[1], a: a1 }, r2: Rig = { x: back[0] + Math.cos(a2) * tl, y: back[1] + Math.sin(a2) * tl, a: a2 };
    drawRig(c, r1, { ramps: false, only: "truck", signal: blink });
    drawRig(c, r2, { ramps: false, only: "trailer" }); const [px2, py2] = rigPt(r2, RIG.park, 0); drawMower(c, px2, py2, a2, 0, 0, t, false, 0.62, o.paint, false, false); drawStraps(c, r2, 1);
    c.restore();
    // ── on top: where we're headed, the road we're on, the route minimap with a dot for the truck ──
    pill(c, out ? "Off To Springfield" : "Heading Home", W / 2, 40, 15, "#24461a");
    let roadName = out ? "Leaving The Farm" : "Malahide Community Place";
    let passed = -1; for (const e of evs) { const sAt = out ? e.at : L - e.at, name = out ? e.out : e.home; if (name && sNow >= sAt - 4 && sAt > passed) { passed = sAt; roadName = name; } }
    if (!out && sNow > L - sV[1] - 4) roadName = "Home";
    pill(c, roadName, W / 2, 78, 12.5, "#5a6b4f");
    { const pw = Math.min(124, W * 0.32), ph = (pw * (my1 - my0)) / (mx1 - mx0) + 14, px0 = W - pw - 12, py0 = 104, sc = (pw - 14) / (mx1 - mx0);
      c.save(); c.fillStyle = "rgba(255,253,246,0.94)"; c.shadowColor = "rgba(0,0,0,0.18)"; c.shadowBlur = 8; c.beginPath(); c.roundRect(px0, py0, pw, ph, 10); c.fill(); c.restore();
      const mp = (p: Pt): Pt => [px0 + 7 + (p[0] - mx0) * sc, py0 + 7 + (p[1] - my0) * sc];
      c.strokeStyle = "#c9cfc2"; c.lineWidth = 4; c.lineCap = "round"; c.lineJoin = "round"; c.beginPath(); real.forEach((p, i) => { const q = mp(p); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.stroke();
      c.strokeStyle = "#e0573c"; c.lineWidth = 2; c.stroke();
      for (const [p, col] of [[real[0], "#f2b81d"], [real[real.length - 1], "#3d8a26"]] as [Pt, string][]) { const q = mp(p); c.fillStyle = col; c.beginPath(); c.arc(q[0], q[1], 3.5, 0, 7); c.fill(); }
      const q = mp(realAt(s)); c.fillStyle = "#ffffff"; c.beginPath(); c.arc(q[0], q[1], 5, 0, 7); c.fill(); c.fillStyle = o.paint.body; c.beginPath(); c.arc(q[0], q[1], 3.6, 0, 7); c.fill();
    }
    if (sNow >= L && t > WAIT + DRIVE * 0.5 && !done) { if (!stayT) stayT = t; if (t - stayT > STAY) { done = true; o.onDone(); } }
  }
  function pathP(c: CanvasRenderingContext2D, ps: Pt[]) { c.beginPath(); ps.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); }
  function strokeP(c: CanvasRenderingContext2D, ps: Pt[]) { c.beginPath(); ps.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); }
  function mailboxArt(c: CanvasRenderingContext2D, b: Box) {
    c.save(); c.translate(b.x, b.y); c.rotate(b.a);
    c.fillStyle = "rgba(20,40,10,0.25)"; c.fillRect(-0.3, -0.12, 0.78, 0.5);
    c.fillStyle = "#5b4430"; c.fillRect(-0.06, -0.06, 0.12, 0.12);
    c.fillStyle = b.col; c.beginPath(); c.roundRect(-0.38, -0.22, 0.76, 0.44, 0.16); c.fill(); c.strokeStyle = "rgba(0,0,0,0.35)"; c.lineWidth = 0.03; c.stroke();
    c.fillStyle = "#d8322a"; c.fillRect(0.1, -0.3, 0.2, 0.08);
    c.restore();
  }
  function cowArt(c: CanvasRenderingContext2D, cw: Cow, t: number) {
    const a = cw.a + Math.sin(t * 0.3 + cw.seed) * 0.15, nod = Math.sin(t * 1.3 + cw.seed * 2) * 0.06;
    c.save(); c.translate(cw.x, cw.y);
    c.fillStyle = "rgba(20,40,10,0.2)"; c.beginPath(); c.ellipse(0.3, 0.35, 1.25, 0.6, a, 0, 7); c.fill();
    c.rotate(a);
    c.fillStyle = "#f4f1ea"; c.beginPath(); c.ellipse(0, 0, 1.2, 0.55, 0, 0, 7); c.fill(); c.strokeStyle = "rgba(40,30,22,0.5)"; c.lineWidth = 0.05; c.stroke();
    c.fillStyle = "#2b2622"; const r = mulberry32(cw.seed + 5); for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(-0.7 + r() * 1.3, (r() - 0.5) * 0.6, 0.22 + r() * 0.2, 0.16 + r() * 0.12, r() * 3, 0, 7); c.fill(); }
    c.fillStyle = "#2b2622"; c.beginPath(); c.ellipse(1.35 + nod, 0, 0.36, 0.26, 0, 0, 7); c.fill();
    c.fillStyle = "#e9b9b0"; c.beginPath(); c.ellipse(1.6 + nod, 0, 0.13, 0.16, 0, 0, 7); c.fill();
    c.restore();
  }
  function playArt(c: CanvasRenderingContext2D, x: number, y: number) {
    c.fillStyle = "#d9c7a0"; c.beginPath(); c.roundRect(x - 8, y - 6, 16, 12, 2); c.fill(); c.strokeStyle = "#6f757b"; c.lineWidth = 0.1; c.stroke();   // the sand
    c.fillStyle = "rgba(20,40,10,0.2)"; c.fillRect(x - 5.2, y - 2.6, 5, 2.4); c.fillRect(x + 2.4, y - 3.6, 4, 1.4);
    c.fillStyle = "#3d7cc0"; c.fillRect(x - 5.6, y - 3, 5, 2.4); c.fillStyle = "#e8b53a"; c.fillRect(x - 4.6, y - 2.4, 1.6, 1.2); c.fillStyle = "#d8443a"; c.fillRect(x - 2.6, y - 2.4, 1.6, 1.2);   // the climber
    c.strokeStyle = "#e8b53a"; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x - 0.6, y - 1.8); c.lineTo(x + 0.4, y + 3.4); c.stroke();   // the slide
    c.strokeStyle = "#5b6066"; c.lineWidth = 0.16; c.beginPath(); c.moveTo(x + 2, y - 4); c.lineTo(x + 6.4, y - 4); c.stroke();      // the swings
    c.fillStyle = "#2b2f33"; for (const k of [3, 4.6]) c.fillRect(x + k - 0.3, y - 3.4, 0.6, 0.4);
  }
  function siloArt(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
    const hgt = 9 * OBL_T;
    c.fillStyle = "#b9bec3"; c.fillRect(x - r, y - hgt, r * 2, hgt); c.beginPath(); c.arc(x, y, r, 0, Math.PI); c.fill();
    c.strokeStyle = "rgba(60,60,60,0.25)"; c.lineWidth = 0.05; for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x - r, y - hgt + (hgt * k) / 4); c.lineTo(x + r, y - hgt + (hgt * k) / 4); c.stroke(); }
    c.fillStyle = "#d3d7db"; c.beginPath(); c.arc(x, y - hgt, r, 0, 7); c.fill(); c.strokeStyle = "rgba(46,32,22,0.5)"; c.lineWidth = 0.08; c.stroke();
    c.fillStyle = "rgba(255,255,255,0.5)"; c.beginPath(); c.arc(x - r * 0.3, y - hgt - r * 0.3, r * 0.35, 0, 7); c.fill();
  }
  function bubble(c: CanvasRenderingContext2D, x: number, y: number, text: string, S: number) {
    c.save(); c.translate(x, y); c.scale(1 / S, 1 / S); c.font = `800 14px ${FONT}`; const tw = c.measureText(text).width + 22;
    c.fillStyle = "#fff"; c.shadowColor = "rgba(0,0,0,0.22)"; c.shadowBlur = 8; c.beginPath(); c.roundRect(-tw / 2, -14, tw, 26, 13); c.fill(); c.beginPath(); c.moveTo(-6, 11); c.lineTo(0, 19); c.lineTo(6, 11); c.fill(); c.shadowBlur = 0;
    c.fillStyle = "#2b3441"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, 0, 0); c.restore();
  }
  function sign(c: CanvasRenderingContext2D, x: number, y: number, text: string, col: string, S: number) {
    c.save(); c.translate(x, y); c.scale(1 / S, 1 / S); c.font = `800 12px ${FONT}`; const tw = c.measureText(text).width + 16;
    c.fillStyle = "#5b6066"; c.fillRect(-1.2, 0, 2.4, 10);
    c.fillStyle = "rgba(20,40,10,0.25)"; c.fillRect(-tw / 2 + 3, -18, tw, 22);
    c.fillStyle = col; c.beginPath(); c.roundRect(-tw / 2, -21, tw, 22, 4); c.fill(); c.strokeStyle = "#ffffff"; c.lineWidth = 1.5; c.beginPath(); c.roundRect(-tw / 2 + 2.5, -18.5, tw - 5, 17, 3); c.stroke();
    c.fillStyle = "#ffffff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, 0, -9.8); c.restore();
  }
  function pill(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, col: string) {
    c.save(); c.font = `800 ${size}px ${FONT}`; const tw = c.measureText(text).width + size * 2, hh = size * 2.3;
    c.fillStyle = "rgba(255,253,246,0.96)"; c.shadowColor = "rgba(0,0,0,0.2)"; c.shadowBlur = 10; c.shadowOffsetY = 2; c.beginPath(); c.roundRect(x - tw / 2, y - hh / 2, tw, hh, hh / 2); c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0;
    c.fillStyle = col; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, x, y + 0.5); c.restore();
  }
  raf = requestAnimationFrame(frame);
  if (o.debug) (window as unknown as { __travel: unknown }).__travel = { state: () => ({ s: sNow, L, t: (performance.now() - t0) / 1000, done, vmax, S: Math.min(W / 24, H / 30) }) };
  return () => { cancelAnimationFrame(raf); ro.disconnect(); };
}
