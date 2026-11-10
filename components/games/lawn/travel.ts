// The trip between home and the community centre, following the real route seen from above: out of the farm driveway
// left (west) along Ron McNeil Line, left at the bend by the farm with the white barns onto Main Street, a long run
// west-southwest beside the tree line and the old rail bed, past the business with the big lot and into Springfield,
// right (north) onto Wellington Street, which becomes Whittaker Road, then left into the community centre. Coming home
// is the same road backwards. The long straights are squeezed so the whole drive takes about 13 seconds; the turns,
// the signs and the scenery are where they really are. It always plays through (there's no skipping it).
import type { Building, Pt } from "../lawnMap";
import { LAWN_MAP, toMetres } from "../lawnMap";
import { bakeBuilding, buildingShadow, drawTree, drawMower, drawCat, type Paint } from "./art";
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
// the drive, squeezed: each stretch is shortened by its factor (segment i runs from point i to i + 1, counting the
// driveway as point 0): Ron McNeil Line a bit, Main Street a lot, Wellington and Whittaker a little
const squeeze = (i: number) => (i >= 1 && i <= 3 ? 0.5 : i >= 16 && i <= 24 ? 0.24 : i >= 25 ? 0.75 : 1);
const K = 2.5, G = 1.8;                          // the truck and trailer are drawn larger than life, the buildings a little less so
const WAIT = 1.5, DRIVE = 10.5, STAY = 1.4;       // seconds at the start, driving, at the end
const FONT = "system-ui, -apple-system, sans-serif";

type Ev = { at: number; out: string; home: string; turn: number };   // a sign along the way: where, the names each way, -1 left / +1 right (going out)

export function startTravel(canvas: HTMLCanvasElement, wrap: HTMLElement, o: { dir: "out" | "home"; paint: Paint; onDone: () => void; debug: boolean }) {
  const ctx = canvas.getContext("2d")!, out = o.dir === "out";
  // ── the road: real points (metres), the squeezed copy we drive, a smooth dense path along it ──
  const real: Pt[] = [[ROUTE_PX[0][0] * MPP, (ROUTE_PX[0][1] + 30) * MPP], ...ROUTE_PX.map(p => [p[0] * MPP, p[1] * MPP] as Pt)];   // the driveway first
  const V: Pt[] = [real[0]]; for (let i = 0; i < real.length - 1; i++) { const f = squeeze(i); V.push([V[i][0] + (real[i + 1][0] - real[i][0]) * f, V[i][1] + (real[i + 1][1] - real[i][1]) * f]); }
  let pts: Pt[] = []; for (let i = 0; i < V.length - 1; i++) { const [a, b] = [V[i], V[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 3)); for (let k = 0; k < n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); }
  pts.push(V[V.length - 1]);
  for (let it = 0; it < 4; it++) { const q: Pt[] = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const [a, b] = [pts[i], pts[i + 1]]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } q.push(pts[pts.length - 1]); pts = q; }   // round the corners
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  const at = (s0: number): Pt => {
    if (s0 < 0) { const d = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) || 1; return [pts[0][0] + ((pts[0][0] - pts[1][0]) / d) * -s0, pts[0][1] + ((pts[0][1] - pts[1][1]) / d) * -s0]; }   // past the ends, the road carries straight on
    if (s0 > L) { const n = pts.length - 1, d = Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1]) || 1; return [pts[n][0] + ((pts[n][0] - pts[n - 1][0]) / d) * (s0 - L), pts[n][1] + ((pts[n][1] - pts[n - 1][1]) / d) * (s0 - L)]; }
    const s = s0; let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; } const u = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]); return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * u, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * u]; };
  const nearestS = (p: Pt) => { let best = 0, bd = Infinity; for (let i = 0; i < pts.length; i += 2) { const d = Math.hypot(pts[i][0] - p[0], pts[i][1] - p[1]); if (d < bd) { bd = d; best = cum[i]; } } return best; };
  const sV = V.map(nearestS);   // where each route point falls along the smooth path
  // the signs and turns (going out); coming home they're met in reverse with the other names and the other hand
  const evs: Ev[] = [
    { at: sV[1], out: "Ron McNeil Line", home: "", turn: -1 },
    { at: sV[15], out: "Main Street", home: "Ron McNeil Line", turn: -1 },
    { at: sV[25], out: "Wellington Street", home: "Main Street", turn: 1 },
    { at: sV[25] + 80, out: "Whittaker Road", home: "Wellington Street", turn: 0 },
    { at: sV[28], out: "Malahide Community Place", home: "Whittaker Road", turn: -1 },
  ];
  // ── the drive: pulls away, eases off for each turn, stops at the end; scaled to take DRIVE seconds ──
  const turnAt = evs.filter(e => e.turn).map(e => e.at);
  const shape = (s: number) => Math.max(0.12, Math.min(1, (s + 6) / 70, (L - s + 4) / 80)) * (0.42 + 0.58 * Math.min(1, Math.min(...turnAt.map(t => Math.abs(t - s))) / 60));
  let need = 0; for (let s = 0; s < L; s += 1) need += 1 / shape(s);
  const vmax = need / DRIVE;
  // ── the scenery, laid out once along the squeezed road ──
  const rnd = mulberry32(42);
  const segPt = (i0: number, i1: number, f: number): Pt => { const s = sV[i0] + (sV[i1] - sV[i0]) * f; return at(s); };
  const sideOf = (s: number, off: number): Pt => { const a = at(s - 2), b = at(s + 2), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, p = at(s); return [p[0] - (dy / l) * off, p[1] + (dx / l) * off]; };   // + off = to the right going out
  type Thing = { x: number; y: number; img?: ReturnType<typeof bakeBuilding>; tree?: number; r?: number };
  const things: Thing[] = [], lots: Pt[][] = [], gravel: Pt[][] = [], side: Pt[][] = [], yards: Pt[][] = [];
  const rectAt = (cx: number, cy: number, w: number, h: number, a: number): Pt[] => { const c = Math.cos(a), sn = Math.sin(a); return ([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] as Pt[]).map(([x, y]) => [cx + x * c - y * sn, cy + x * sn + y * c]); };
  const mainA = Math.atan2(V[25][1] - V[16][1], V[25][0] - V[16][0]);   // the way Main Street runs (going out)
  const bld = (poly: Pt[], kind: Building["kind"], wall: string, roof: string, height: number) => { const b: Building = { kind, poly, height, wall, roof, trim: "#ffffff" }; const im = bakeBuilding(b, null, 7); things.push({ x: (poly[0][0] + poly[2][0]) / 2, y: (poly[0][1] + poly[2][1]) / 2, img: im }); return b; };
  const shadows: Building[] = [];
  // home: the farmhouse (its front to the road, like the real one), the red barn behind, the big tree, the gravel drive
  {
    const m = toMetres(LAWN_MAP), ox = V[1][0], oy = V[1][1];
    const hs = m.buildings.filter(b => b.kind === "house" || b.kind === "porch" || b.kind === "deck" || b.kind === "barn" || b.kind === "other");
    const house = m.buildings.find(b => b.kind === "house")!, hx = (house.poly[0][0] + house.poly[1][0]) / 2, hy = house.poly[0][1];
    for (const b of hs) {
      const shift = (p: Pt): Pt => [ox + 14 + (p[0] - hx) * G, oy + 16 + (p[1] - hy) * G];
      const nb: Building = { ...b, height: b.height * G, poly: b.poly.map(shift), wings: b.wings?.map(w => w.map(shift)), frontGable: b.frontGable?.map(shift), chimney: b.chimney && shift(b.chimney) };
      if (nb.kind === "barn" || nb.kind === "other") nb.poly = nb.poly.map(p => [p[0] + 30, p[1] - 46] as Pt);
      shadows.push(nb); const im = bakeBuilding(nb, null, 7); things.push({ x: nb.poly[0][0], y: nb.poly[0][1], img: im });
    }
    yards.push([[ox - 60, oy + 6], [ox + 90, oy + 6], [ox + 90, oy + 120], [ox - 60, oy + 120]]);
    gravel.push([[ox - 4, oy], [ox + 4, oy], [ox + 4, V[0][1] + 6], [ox - 4, V[0][1] + 6]]);
    things.push({ x: ox - 22, y: oy + 26, tree: 77, r: 14 }, { x: ox + 66, y: oy + 34, tree: 78, r: 10 }, { x: ox - 40, y: oy + 64, tree: 79, r: 9 });
  }
  // the farm by the bend with its long white barns and a big gravel yard, north of the road
  { const [bx, by] = V[15]; gravel.push(rectAt(bx - 115, by - 95, 150, 110, 0)); for (let k = 0; k < 4; k++) shadows.push(bld(rectAt(bx - 150 + k * 8, by - 140 + k * 26, 70, 14, 0), "shed", "#e6e8ea", "#f1f3f5", 4)); bld(rectAt(bx - 70, by - 70, 26, 20, 0), "house", "#e4dccb", "#6b5a4d", 5); }
  // the tree line and the old rail bed along the south side of Main Street
  for (let f = 0; f <= 1; f += 0.012) { const s = sV[16] + (sV[25] - sV[16]) * f; if (rnd() < 0.85) things.push({ ...ptObj(sideOf(s, -(18 + rnd() * 6))), tree: 200 + Math.floor(f * 300), r: 5.5 + rnd() * 3.5 }); }
  for (let f = 0; f < 1; f += 0.05) side.push([sideOf(sV[16] + (sV[25] - sV[16]) * f, -26), sideOf(sV[16] + (sV[25] - sV[16]) * (f + 0.05), -26)]);
  // the business with the big paved lot (north side, near the village)
  { const [cx, cy] = sideOf(sV[16] + (sV[25] - sV[16]) * 0.74, 52); lots.push(rectAt(cx, cy, 120, 64, mainA)); const [hx2, hy2] = sideOf(sV[16] + (sV[25] - sV[16]) * 0.74, 74); shadows.push(bld(rectAt(hx2, hy2, 80, 20, mainA), "shed", "#d9dde0", "#e4e7ea", 6)); }
  // Springfield: houses on both sides of Main Street and Wellington Street, each with a tree or two
  const roofs = ["#5d5a58", "#6b4f42", "#4f5357", "#7a6a5a", "#8a4a3c", "#5b6b78"], walls = ["#e4dccb", "#d8cdbb", "#e6e1d6", "#cfd6da", "#efe6d2"];
  const house = (p: Pt, a: number) => { const w = (9 + rnd() * 4) * G, h = (8 + rnd() * 3) * G; shadows.push(bld(rectAt(p[0], p[1], w, h, a), "house", walls[Math.floor(rnd() * walls.length)], roofs[Math.floor(rnd() * roofs.length)], 5)); if (rnd() < 0.7) things.push({ x: p[0] + (rnd() - 0.5) * 40, y: p[1] + (rnd() - 0.5) * 40, tree: Math.floor(rnd() * 999), r: 5 + rnd() * 4 }); };
  for (let f = 0.58; f < 0.97; f += 0.07) for (const sd of [-1, 1]) if (!(sd > 0 && f > 0.64 && f < 0.84)) house(sideOf(sV[16] + (sV[25] - sV[16]) * f + rnd() * 8, sd * (28 + rnd() * 6)), mainA);
  for (let s = sV[25] + 30; s < sV[28] - 20; s += 30) for (const sd of [-1, 1]) house(sideOf(s, sd * (27 + rnd() * 5)), Math.atan2(V[27][1] - V[25][1], V[27][0] - V[25][0]));
  // the community centre: the lot, the hall, the two ball diamonds to the north-west
  const end = V[V.length - 1];
  yards.push(rectAt(end[0] + 5, end[1] + 10, 200, 170, 0)); lots.push(rectAt(end[0] - 6, end[1] + 6, 80, 34, 0));
  shadows.push(bld(rectAt(end[0] + 8, end[1] + 52, 52, 42, 0), "hall", "#dcd8cf", "#8f959b", 8));
  bld(rectAt(end[0] + 5, end[1] + 49, 26, 22, 0), "hall", "#e8e5de", "#e3e7ea", 12);
  const diamonds: [number, number][] = [[end[0] - 26, end[1] - 26], [end[0] + 38, end[1] - 30]];
  // the side roads: the road north at the bend, the road east past the farm, Wellington south, a couple of village streets
  const sideRoads: Pt[][] = [[V[15], [V[15][0] + 10, V[15][1] - 400]], [V[1], [V[1][0] + 260, V[1][1] - 55]], [V[25], [V[25][0] + 10, V[25][1] + 160]]];
  for (const f of [0.68, 0.86]) { const p = at(sV[16] + (sV[25] - sV[16]) * f); sideRoads.push([[p[0] - 30, p[1] - 140], [p[0] + 30, p[1] + 140]]); }
  function ptObj(p: Pt) { return { x: p[0], y: p[1] }; }
  const treeBlobs = (seed: number) => { const r = mulberry32(seed), b: number[][] = []; for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + r(), d = 0.45 + r() * 0.2; b.push([Math.cos(a) * d, Math.sin(a) * d, 0.42 + r() * 0.12, r()]); } return b; };
  const blobCache = new Map<number, number[][]>(); const blobsFor = (seed: number) => { let b = blobCache.get(seed); if (!b) { b = treeBlobs(seed); blobCache.set(seed, b); } return b; };
  // the minimap: the real route, fitted into a little panel
  const mx0 = Math.min(...real.map(p => p[0])), mx1 = Math.max(...real.map(p => p[0])), my0 = Math.min(...real.map(p => p[1])), my1 = Math.max(...real.map(p => p[1]));
  const realAt = (s: number): Pt => { let i = 0; while (i < sV.length - 2 && sV[i + 1] < s) i++; const u = Math.max(0, Math.min(1, (s - sV[i]) / Math.max(1e-6, sV[i + 1] - sV[i]))); return [real[i][0] + (real[i + 1][0] - real[i][0]) * u, real[i][1] + (real[i + 1][1] - real[i][1]) * u]; };

  let W = 300, H = 600, dpr = 1, raf = 0, t0 = 0, last = 0, done = false, sNow = 0;
  const resize = () => { W = wrap.clientWidth; H = wrap.clientHeight; dpr = window.devicePixelRatio || 1; canvas.style.width = `${W}px`; canvas.style.height = `${H}px`; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); };
  resize(); const ro = new ResizeObserver(resize); ro.observe(wrap);
  let camX = 0, camY = 0, camInit = false;

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!t0) { t0 = now; last = now; }
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (t > WAIT && sNow < L) sNow = Math.min(L, sNow + vmax * shape(sNow) * dt);
    const s = out ? sNow : L - sNow, dirSign = out ? 1 : -1;
    // the truck's front, its heading, the hitch, the trailer's heading (the trailer follows the road round corners)
    const tl = K * RIG.truckLen, front = at(s), back = at(s - dirSign * tl), a1 = Math.atan2(front[1] - back[1], front[0] - back[0]);
    const tail = at(s - dirSign * (tl + K * (RIG.bedEnd - RIG.truckLen))), a2 = Math.atan2(back[1] - tail[1], back[0] - tail[0]);
    // the camera: just ahead of the truck, gliding
    const S = Math.min(W / 95, H / 150), lead = 26, tx = front[0] + Math.cos(a1) * lead, ty = front[1] + Math.sin(a1) * lead;
    if (!camInit) { camX = tx; camY = ty; camInit = true; }
    const kc = 1 - Math.exp(-dt * 14); camX += (tx - camX) * kc; camY += (ty - camY) * kc;
    const c = ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.save(); c.translate(W / 2 - camX * S, H * 0.55 - camY * S); c.scale(S, S);
    const vx0 = camX - W / S / 2 - 30, vx1 = camX + W / S / 2 + 30, vy0 = camY - H * 0.55 / S - 30, vy1 = camY + H * 0.45 / S + 30;
    // fields: a patchwork lined up with Main Street
    c.fillStyle = "#8fa557"; c.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    c.save(); c.rotate(mainA);
    { const ca = Math.cos(-mainA), sa = Math.sin(-mainA), corners = [[vx0, vy0], [vx1, vy0], [vx1, vy1], [vx0, vy1]].map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]);
      const ux0 = Math.min(...corners.map(q => q[0])), ux1 = Math.max(...corners.map(q => q[0])), uy0 = Math.min(...corners.map(q => q[1])), uy1 = Math.max(...corners.map(q => q[1]));
      for (let gx = Math.floor(ux0 / 90) * 90; gx < ux1; gx += 90) for (let gy = Math.floor(uy0 / 60) * 60; gy < uy1; gy += 60) {
        const h = mulberry32(((gx / 90) * 7919 + (gy / 60) * 104729) | 0), kind = Math.floor(h() * 4);
        c.fillStyle = ["#a88e66", "#6f9e48", "#b9b56e", "#7fae52"][kind]; c.fillRect(gx + 1, gy + 1, 88, 58);
        c.strokeStyle = ["rgba(110,88,58,0.4)", "rgba(60,110,40,0.45)", "rgba(150,140,80,0.4)", "rgba(80,130,50,0.35)"][kind]; c.lineWidth = 0.8;
        c.beginPath(); for (let rx = gx + 3; rx < gx + 88; rx += 4) { c.moveTo(rx, gy + 1); c.lineTo(rx, gy + 59); } c.stroke();
      } }
    c.restore();
    // the village and the farmyards are lawn, not field
    c.fillStyle = "#86b85a"; for (const y of yards) { pathP(c, y); c.fill(); }
    c.strokeStyle = "#86b85a"; c.lineCap = "butt"; c.lineJoin = "round"; c.lineWidth = 110; c.beginPath();
    for (let ss = sV[16] + (sV[25] - sV[16]) * 0.55, k2 = 0; ss <= sV[28]; ss += 6, k2++) { const p = at(ss); if (k2) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); } c.stroke();   // Springfield's lawns
    { const [bx, by] = V[15]; c.fillStyle = "#86b85a"; pathP(c, rectAt(bx - 115, by - 95, 190, 150, 0)); c.fill(); }
    // gravel, the old rail bed, parking lots
    c.fillStyle = "#cdbfa5"; for (const g of gravel) { pathP(c, g); c.fill(); }
    c.strokeStyle = "#b9a684"; c.lineWidth = 6; c.lineCap = "round"; for (const [a, b] of side) { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    c.strokeStyle = "rgba(90,80,70,0.5)"; c.lineWidth = 0.8; for (const [a, b] of side) { c.beginPath(); c.moveTo(a[0], a[1] - 1.2); c.lineTo(b[0], b[1] - 1.2); c.moveTo(a[0], a[1] + 1.2); c.lineTo(b[0], b[1] + 1.2); c.stroke(); }
    c.fillStyle = "#6d7073"; for (const lt of lots) { pathP(c, lt); c.fill(); }
    // the ball diamonds
    for (const [dx, dy] of diamonds) { c.fillStyle = "#6f9e48"; c.beginPath(); c.moveTo(dx, dy); c.arc(dx, dy, 48, Math.PI * 1.0, Math.PI * 1.5); c.closePath(); c.fill(); c.fillStyle = "#c0714a"; c.beginPath(); c.moveTo(dx, dy); c.arc(dx, dy, 18, Math.PI * 1.0, Math.PI * 1.5); c.closePath(); c.fill(); c.strokeStyle = "#8a9096"; c.lineWidth = 0.6; c.beginPath(); c.arc(dx, dy, 48, Math.PI * 1.0, Math.PI * 1.5); c.stroke(); }
    // roads: the side roads, then the route itself (gravel shoulders, asphalt, a yellow centre line)
    const road = (ps: Pt[], w: number) => { c.lineJoin = "round"; c.lineCap = "round"; c.strokeStyle = "#c4b89f"; c.lineWidth = w + 3; c.beginPath(); ps.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); c.strokeStyle = "#5f6266"; c.lineWidth = w; c.stroke(); };
    for (const r of sideRoads) road(r, 7);
    road(pts.slice(Math.floor(pts.length * 0.0)), 9);
    c.strokeStyle = "#e5c24c"; c.lineWidth = 0.5; c.setLineDash([4, 5]); c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); c.setLineDash([]);
    // power poles along Ron McNeil Line
    for (let ss = 0; ss < sV[15]; ss += 30) { const [px, py] = sideOf(ss, -7); c.fillStyle = "#7a5a3c"; c.beginPath(); c.arc(px, py, 0.5, 0, 7); c.fill(); }
    // buildings (each drawn once into its own picture), their shadows, the trees
    for (const b of shadows) { const xs = b.poly.map(p => p[0]); if (Math.max(...xs) < vx0 || Math.min(...xs) > vx1) continue; buildingShadow(c, b); }
    for (const th of things) if (th.img && th.x > vx0 - 60 && th.x < vx1 + 60 && th.y > vy0 - 60 && th.y < vy1 + 60) c.drawImage(th.img.cv, th.img.x, th.img.y, th.img.w, th.img.h);
    for (const th of things) if (th.tree !== undefined && th.x > vx0 && th.x < vx1 && th.y > vy0 && th.y < vy1) { const r = th.r ?? 4; c.fillStyle = "rgba(20,40,10,0.16)"; c.beginPath(); c.arc(th.x + r * 0.3, th.y + r * 0.35, r, 0, 7); c.fill(); c.save(); c.translate(th.x, th.y); c.scale(r, r); drawTree(c, { x: 0, y: 0, r: 1 }, blobsFor(th.tree), 1, t); c.restore(); }
    // street signs at the turns: the name of the road being turned onto (whichever way Pat's going)
    for (const e of evs) { const name = out ? e.out : e.home; if (!name) continue; const turn = out ? e.turn : -e.turn, p = sideOf(e.at, (turn >= 0 ? 1 : -1) * dirSign * 12); sign(c, p[0], p[1], name, name.includes("Community") ? "#2f5a1f" : "#2d6a3a", S); }
    // the cat: seeing Pat off at the end of the drive, or there to meet him
    { const cx = V[1][0] - 9, cy = V[1][1] + 8; drawCat(c, { x: cx, y: cy, h: -Math.PI / 2, act: "sit", phase: 1 }, t, 7.5); if (out ? t < WAIT + 1.4 : sNow >= L - 1) bubble(c, cx, cy - 7, "Meow!", S); }
    // ── the truck and trailer, the tractor strapped on, the turn signal blinking before each turn ──
    const next = evs.map(e => ({ s: out ? e.at : L - e.at, turn: out ? e.turn : -e.turn })).filter(e => e.turn && e.s > sNow - 8 && e.s - sNow < 70)[0];
    const blink = next && Math.floor(t * 2.6) % 2 === 0 ? next.turn : 0;
    const r1: Rig = { x: 0, y: 0, a: a1 }, r2: Rig = { x: 0, y: 0, a: a2 };
    c.save(); c.translate(front[0], front[1]); c.scale(K, K); drawRig(c, r1, { ramps: false, only: "truck", signal: blink }); c.restore();
    c.save(); c.translate(back[0], back[1]); c.scale(K, K); c.translate(Math.cos(a2) * RIG.truckLen, Math.sin(a2) * RIG.truckLen);
    drawRig(c, r2, { ramps: false, only: "trailer" }); const [px2, py2] = rigPt(r2, RIG.park, 0); drawMower(c, px2, py2, a2, 0, 0, t, false, 0.62, o.paint, false, false); drawStraps(c, r2, 1); c.restore();
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
  let stayT = 0;
  function pathP(c: CanvasRenderingContext2D, ps: Pt[]) { c.beginPath(); ps.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); }
  function bubble(c: CanvasRenderingContext2D, x: number, y: number, text: string, S: number) {
    c.save(); c.translate(x, y); c.scale(1 / S, 1 / S); c.font = `800 14px ${FONT}`; const tw = c.measureText(text).width + 22;
    c.fillStyle = "#fff"; c.shadowColor = "rgba(0,0,0,0.22)"; c.shadowBlur = 8; c.beginPath(); c.roundRect(-tw / 2, -14, tw, 26, 13); c.fill(); c.beginPath(); c.moveTo(-6, 11); c.lineTo(0, 19); c.lineTo(6, 11); c.fill(); c.shadowBlur = 0;
    c.fillStyle = "#2b3441"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, 0, 0); c.restore();
  }
  function sign(c: CanvasRenderingContext2D, x: number, y: number, text: string, col: string, S: number) {
    c.save(); c.translate(x, y); c.scale(1 / S, 1 / S); c.font = `800 11px ${FONT}`; const tw = c.measureText(text).width + 14;
    c.fillStyle = "#5b6066"; c.fillRect(-1, 0, 2, 9);
    c.fillStyle = "rgba(20,40,10,0.25)"; c.fillRect(-tw / 2 + 3, -17, tw, 19);
    c.fillStyle = col; c.beginPath(); c.roundRect(-tw / 2, -20, tw, 19, 4); c.fill(); c.strokeStyle = "#ffffff"; c.lineWidth = 1.4; c.beginPath(); c.roundRect(-tw / 2 + 2.5, -17.5, tw - 5, 14, 3); c.stroke();
    c.fillStyle = "#ffffff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, 0, -10.2); c.restore();
  }
  function pill(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, col: string) {
    c.save(); c.font = `800 ${size}px ${FONT}`; const tw = c.measureText(text).width + size * 2, hh = size * 2.3;
    c.fillStyle = "rgba(255,253,246,0.96)"; c.shadowColor = "rgba(0,0,0,0.2)"; c.shadowBlur = 10; c.shadowOffsetY = 2; c.beginPath(); c.roundRect(x - tw / 2, y - hh / 2, tw, hh, hh / 2); c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0;
    c.fillStyle = col; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, x, y + 0.5); c.restore();
  }
  raf = requestAnimationFrame(frame);
  if (o.debug) (window as unknown as { __travel: unknown }).__travel = { state: () => ({ s: sNow, L, t: (performance.now() - t0) / 1000, done }) };
  return () => { cancelAnimationFrame(raf); ro.disconnect(); };
}
