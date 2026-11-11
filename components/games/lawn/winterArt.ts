// The drawings for Pat's Winter (Chapter 4), in the same soft top-down style as ./art and ./fallArt: the yard under
// snow, bare trees, snow on the roofs, Pat in his winter coat and toque (on foot and on the tractor), the plow blade,
// snowbanks, Linda's car, tracks and footprints, the woodpile and the chopping block, the Christmas lights, the shop and
// its tools, the wood stove, and the little pictures on the job cards. World units are metres; each drawing's own frame
// has +x forward. Light comes from the top left, so shadows fall down and to the right (blue on snow).
import type { LawnMap, Pt, Tree, Building } from "../lawnMap";
import { pip, centroid, mulberry32, lineDist } from "./geo";
import { pathPoly, drawMower, drawCat, type Paint } from "./art";
import { drawCar } from "./fallArt";
import { ROOM, BENCH, PEGBOARD, STOVE, RUG, SHELF, RACK, BIN, CAR67, WALL_Y, TOOLS, type ToolKind } from "./shopMap";

export const SNOW = "#eef3f8";
const SH = (a: number) => `rgba(112,138,182,${a.toFixed(3)})`;   // the blue of a shadow on snow
const SKIN = "#efc6a2", HAIR = "#6b4a32", GREYS = "#b5aca2";
const COAT = "#b8322a", COAT_DARK = "rgba(28,16,16,0.5)", TOQUE = "#2e5e45", TOQUE_RIB = "#244b37", POM = "#efe6d2", GLOVE = "#b98a55", JEANS = "#3d5378", BOOT = "#4a3626";
export const BULB_COLS = ["#ff4a3d", "#3fd25a", "#4a8dff", "#ffd23a", "#ff8a2a", "#d46bff"];

/** A convex polygon pushed out by `d` (mitred corners), like a roof's overhang. */
export function outsetPoly(P: Pt[], d: number): Pt[] {
  const [cx, cy] = centroid(P), n = P.length;
  const nrm = (a: Pt, b: Pt): Pt => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; let nx = dy / L, ny = -dx / L; const mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy; if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; } return [nx, ny]; };
  return P.map((p, i) => { const a = P[(i + n - 1) % n], b = P[(i + 1) % n], n1 = nrm(a, p), n2 = nrm(p, b), k = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]); return [p[0] + (n1[0] + n2[0]) * k, p[1] + (n1[1] + n2[1]) * k] as Pt; });
}
const strokeLine = (c: CanvasRenderingContext2D, pts: Pt[], w: number, col: string, ox = 0, oy = 0) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = "round"; c.lineJoin = "round"; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0] + ox, p[1] + oy) : c.moveTo(p[0] + ox, p[1] + oy))); c.stroke(); };

/** A snowbank lump: a soft white mound with a blue shadow down and to the right. Stamped many times it makes a bank. */
export function stampBank(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.fillStyle = SH(0.16); c.beginPath(); c.ellipse(x + r * 0.18, y + r * 0.24, r * 1.05, r * 0.92, 0, 0, 7); c.fill();
  c.fillStyle = "#f6f9fd"; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  c.fillStyle = "rgba(255,255,255,0.85)"; c.beginPath(); c.arc(x - r * 0.28, y - r * 0.32, r * 0.5, 0, 7); c.fill();
}
/** The tractor's tire tracks in the snow (stamped as it goes). */
export function stampTrack(c: CanvasRenderingContext2D, x: number, y: number, h: number, a = 0.16) {
  c.save(); c.translate(x, y); c.rotate(h); c.fillStyle = SH(a);
  c.fillRect(-0.62, -0.62, 0.12, 0.24); c.fillRect(-0.62, 0.38, 0.12, 0.24); c.fillRect(0.7, -0.47, 0.08, 0.14); c.fillRect(0.7, 0.33, 0.08, 0.14);
  c.restore();
}
/** One boot print. `side` is -1 (left) or 1 (right). */
export function stampFoot(c: CanvasRenderingContext2D, x: number, y: number, a: number, side: number) {
  const px = x - Math.sin(a) * side * 0.11, py = y + Math.cos(a) * side * 0.11;
  c.save(); c.translate(px, py); c.rotate(a); c.fillStyle = SH(0.3);
  c.beginPath(); c.ellipse(0.03, 0, 0.08, 0.045, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(-0.09, 0, 0.04, 0.038, 0, 0, 7); c.fill();
  c.restore();
}

// ── the yard under snow, painted once over the ground layer ──
export type ClearShapes = { lanes: { pts: Pt[]; width: number }[]; polys: Pt[][]; walk: { pts: Pt[]; width: number } };
/** The whole yard in winter: snow over everything, drifts, dry grass poking through the rough, the woods bare, the road
 *  plowed, the lanes packed down with tire ruts, fences with snow on the rails, the fire pit and the chairs snowed over.
 *  `clear` is the gravel and the stone walk: bare underneath (for the plow job's fresh snow to cover), with banks along
 *  their edges when `plowed`. */
export function paintWinterGround(c: CanvasRenderingContext2D, map: LawnMap, clear: ClearShapes, plowed: boolean) {
  const W = map.size[0], H = map.size[1], rnd = mulberry32(23);
  c.save();
  c.fillStyle = SNOW; c.fillRect(-1, -1, W + 2, H + 2);
  // soft drifts: a shadow below and to the right, a brighter top
  for (let k = 0; k < (W * H) / 26; k++) { const x = rnd() * W, y = rnd() * H, rx = 1.5 + rnd() * 4.5, ry = 0.7 + rnd() * 1.6, a = -0.35 + (rnd() - 0.5) * 0.4; c.fillStyle = SH(0.045); c.beginPath(); c.ellipse(x + 0.35, y + 0.4, rx, ry, a, 0, 7); c.fill(); c.fillStyle = "rgba(255,255,255,0.4)"; c.beginPath(); c.ellipse(x, y, rx * 0.92, ry * 0.85, a, 0, 7); c.fill(); }
  for (let k = 0; k < W * H * 2.6; k++) { const v = rnd(); c.fillStyle = v < 0.45 ? "rgba(135,158,196,0.1)" : v < 0.93 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,1)"; c.fillRect(rnd() * W, rnd() * H, 0.06, 0.06); }
  const inLawn = (x: number, y: number) => map.lawn.some(p => pip(p, x, y));
  const onTrack = (x: number, y: number) => map.lanes.some(l => lineDist(l.pts, x, y) < l.width / 2 + 0.6) || map.roads.some(l => lineDist(l.pts, x, y) < l.width / 2 + 1.5) || map.driveway.some(p => pip(p, x, y));
  // dry grass and weeds poking through out in the rough
  c.lineCap = "round"; c.lineWidth = 0.035;
  for (let k = 0; k < W * H * 0.09; k++) {
    const x = rnd() * W, y = rnd() * H; if (inLawn(x, y) || onTrack(x, y) || map.noGo.some(n => pip(n.poly, x, y))) continue;
    c.strokeStyle = rnd() < 0.5 ? "rgba(150,120,70,0.55)" : "rgba(110,90,55,0.5)";
    for (let s = 0; s < 3; s++) { c.beginPath(); c.moveTo(x + s * 0.05, y); c.lineTo(x + s * 0.05 + (rnd() - 0.5) * 0.2, y - 0.18 - rnd() * 0.15); c.stroke(); }
  }
  // shadows: buildings (soft, blue) and the bare trees (faint)
  for (const b of map.buildings) {
    const h = b.kind === "deck" ? 0.6 : b.height, ox = h * 0.24 + 0.15, oy = h * 0.2 + 0.15 - h * 0.125;
    c.beginPath(); for (let t = 0; t <= 1.001; t += 0.125) { b.poly.forEach((p, i) => (i ? c.lineTo(p[0] + ox * t, p[1] + oy * t) : c.moveTo(p[0] + ox * t, p[1] + oy * t))); c.closePath(); }
    c.fillStyle = SH(0.17); c.fill("nonzero");
  }
  for (const t of map.trees) if (t.kind !== "well") { c.fillStyle = SH(t.kind === "spruce" ? 0.14 : 0.05); c.beginPath(); c.ellipse(t.x + t.r * 0.28, t.y + t.r * 0.32, t.r * 0.95, t.r * 0.88, 0, 0, 7); c.fill(); }
  // fields under snow (the furrows and stubble just showing), the woods bare with a few evergreens
  for (const n of map.noGo) {
    const xs = n.poly.map(p => p[0]), ys = n.poly.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (n.kind === "field") {
      c.save(); pathPoly(c, n.poly); c.clip(); c.fillStyle = "#e9eef4"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
      const ang = -1.35, ux = Math.cos(ang), uy = Math.sin(ang), L = Math.hypot(x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      for (let o = -L; o < L; o += 0.75) { c.strokeStyle = (Math.round(o / 0.75) & 1) ? SH(0.1) : "rgba(255,255,255,0.5)"; c.lineWidth = 0.22; c.beginPath(); c.moveTo(mx - uy * o - ux * L, my + ux * o - uy * L); c.lineTo(mx - uy * o + ux * L, my + ux * o + uy * L); c.stroke(); }
      for (let k = 0; k < (x1 - x0) * (y1 - y0) * 0.8; k++) { c.fillStyle = "rgba(140,115,75,0.45)"; c.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 0.05, 0.12); }
      c.restore();
    } else if (n.kind === "woods") {
      const pts: Pt[] = []; for (let k = 0; k < (x1 - x0) * (y1 - y0) * 0.45; k++) { const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0); if (pip(n.poly, x, y)) pts.push([x, y]); }
      c.fillStyle = SH(0.12); for (const [x, y] of pts) { c.beginPath(); c.arc(x + 0.5, y + 0.6, 1.2, 0, 7); c.fill(); }
      for (const [x, y] of pts) {
        if (rnd() < 0.22) { drawSpruceTop(c, x, y, 0.9 + rnd() * 0.6, rnd); continue; }
        const r = 0.9 + rnd() * 0.8; c.fillStyle = "rgba(120,100,85,0.18)"; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
        c.strokeStyle = "rgba(85,70,60,0.65)"; c.lineWidth = 0.05; for (let b = 0; b < 7; b++) { const a = rnd() * 7, l = r * (0.6 + rnd() * 0.4); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
        c.fillStyle = "#5e4e44"; c.beginPath(); c.arc(x, y, 0.12, 0, 7); c.fill();
      }
    }
  }
  // the road: plowed and wet, with banks along both sides
  for (const r of map.roads) {
    strokeLine(c, r.pts, r.width + 1.8, SH(0.16), 0.25, 0.3); strokeLine(c, r.pts, r.width + 1.6, "#f6f9fd");
    strokeLine(c, r.pts, r.width * 0.86, "#d9dee3"); strokeLine(c, r.pts, r.width * 0.72, "#6c7176");
    strokeLine(c, r.pts, r.width * 0.5, "rgba(255,255,255,0.06)");
    c.setLineDash([2.2, 2.6]); strokeLine(c, r.pts, Math.max(0.12, r.width * 0.025), "rgba(229,194,76,0.75)"); c.setLineDash([]);
  }
  // the lanes: packed snow with two ruts where the gravel shows
  for (const l of map.lanes) {
    strokeLine(c, l.pts, l.width, "#e3e9f0");
    for (const side of [-1, 1]) {
      const pts = l.pts.map((p, i) => { const q = l.pts[Math.min(l.pts.length - 1, i + 1)], o = l.pts[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], d = Math.hypot(dx, dy) || 1, off = side * l.width * 0.24; return [p[0] - (dy / d) * off, p[1] + (dx / d) * off] as Pt; });
      strokeLine(c, pts, Math.max(0.24, l.width * 0.1), "rgba(150,138,120,0.42)");
    }
  }
  // the gravel that gets plowed and the stone walk to the back door: bare and wet underneath
  const gravel = (fill: () => void, bb: [number, number, number, number]) => {
    c.save(); fill(); c.fillStyle = "#a99f8f"; c.fill(); c.clip();
    for (let k = 0; k < (bb[2] - bb[0]) * (bb[3] - bb[1]) * 14; k++) { const v = rnd(); c.fillStyle = v < 0.35 ? "rgba(95,85,72,0.45)" : v < 0.7 ? "rgba(225,220,210,0.5)" : "rgba(255,255,255,0.35)"; c.beginPath(); c.arc(bb[0] + rnd() * (bb[2] - bb[0]), bb[1] + rnd() * (bb[3] - bb[1]), 0.035 + rnd() * 0.04, 0, 7); c.fill(); }
    c.restore();
  };
  const lineBox = (pts: Pt[]): [number, number, number, number] => [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))];
  for (const l of clear.lanes) { strokeLine(c, l.pts, l.width, "#a99f8f"); const L = l.pts; for (let i = 1; i < L.length; i++) { const [ax, ay] = L[i - 1], [bx, by] = L[i], len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len; for (let k = 0; k < len * l.width * 14; k++) { const t = rnd(), o = (rnd() - 0.5) * l.width * 0.95, v = rnd(); c.fillStyle = v < 0.35 ? "rgba(95,85,72,0.45)" : v < 0.7 ? "rgba(225,220,210,0.5)" : "rgba(255,255,255,0.35)"; c.beginPath(); c.arc(ax + (bx - ax) * t + nx * o, ay + (by - ay) * t + ny * o, 0.035 + rnd() * 0.04, 0, 7); c.fill(); } } }
  for (const p of clear.polys) gravel(() => pathPoly(c, p), lineBox(p));
  // the stone walk: flagstones on a bed of gravel
  { const wk = clear.walk; strokeLine(c, wk.pts, wk.width, "#b9b2a6");
    for (let i = 1; i < wk.pts.length; i++) { const [ax, ay] = wk.pts[i - 1], [bx, by] = wk.pts[i], len = Math.hypot(bx - ax, by - ay); for (let d = 0.3; d < len; d += 0.62) { const t = d / len, x = ax + (bx - ax) * t, y = ay + (by - ay) * t; for (const o of [-0.25, 0.25]) { const nx = -(by - ay) / len, ny = (bx - ax) / len; c.fillStyle = rnd() < 0.5 ? "#8f8a82" : "#9d978c"; c.beginPath(); c.roundRect(x + nx * o - 0.24, y + ny * o - 0.22, 0.46 + rnd() * 0.06, 0.42, 0.08); c.fill(); } } } }
  if (plowed) {   // banks along the plowed edges
    const edge = (pts: Pt[], w: number) => { for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len; for (let d = 0; d < len; d += 0.32) { const t = d / len; for (const s of [-1, 1]) stampBank(c, ax + (bx - ax) * t + nx * s * (w / 2 + 0.35), ay + (by - ay) * t + ny * s * (w / 2 + 0.35), 0.34 + rnd() * 0.22); } } };
    for (const l of clear.lanes) edge(l.pts, l.width);
    for (const p of clear.polys) edge([...p, p[0]], 0);
    edge(clear.walk.pts, clear.walk.width);
  }
  // fences: snow along the top rail and a cap on every post, a little drift on the lee side
  for (const f of map.fences) {
    strokeLine(c, f, 0.5, "rgba(255,255,255,0.7)", 0.25, 0.3); strokeLine(c, f, 0.14, SH(0.2), 0.18, 0.22);
    strokeLine(c, f, 0.09, "#9c8466"); strokeLine(c, f, 0.045, "#ffffff", -0.01, -0.025);
    for (let i = 1; i < f.length; i++) { const [ax, ay] = f[i - 1], [bx, by] = f[i], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L / 2.4)); for (let k = 0; k <= n; k++) { const x = ax + ((bx - ax) * k) / n, y = ay + ((by - ay) * k) / n; c.fillStyle = "#6f5640"; c.fillRect(x - 0.12, y - 0.12, 0.24, 0.24); c.fillStyle = "#ffffff"; c.beginPath(); c.arc(x - 0.02, y - 0.03, 0.12, 0, 7); c.fill(); } }
  }
  // the fire pit buried in snow, the chairs with snow on the seats, the horseshoe pits just bumps
  for (const p of map.props) {
    if (p.kind === "firepit") { const r = p.r ?? 0.8; for (let k = 0; k < 13; k++) { const a = (k / 13) * Math.PI * 2; c.fillStyle = k % 3 ? "#8e877e" : "#a49d93"; c.beginPath(); c.ellipse(p.x + Math.cos(a) * r * 0.86, p.y + Math.sin(a) * r * 0.86 + 0.04, r * 0.18, r * 0.12, a, 0, 7); c.fill(); } stampBank(c, p.x, p.y, r * 0.95); for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2 + 0.3; c.fillStyle = "#f8fbff"; c.beginPath(); c.arc(p.x + Math.cos(a) * r * 0.85, p.y + Math.sin(a) * r * 0.85 - 0.05, r * 0.15, 0, 7); c.fill(); } }
    else if (p.kind === "chair") { c.save(); c.translate(p.x, p.y); c.rotate(((p.heading ?? 0) * Math.PI) / 180); const w = p.w ?? 1, h = p.h ?? 1; c.fillStyle = SH(0.18); c.fillRect(-w / 2 + 0.12, -h / 2 + 0.14, w, h); c.fillStyle = "#c79a5e"; c.fillRect(-w / 2, -h / 2, w, h); c.fillStyle = "#f7faff"; c.beginPath(); c.roundRect(-w / 2 + 0.04, -h / 2 + 0.04, w - 0.08, h - 0.08, 0.14); c.fill(); c.fillStyle = "#b8894f"; c.fillRect(-w / 2 - 0.06, -h * 0.1, 0.1, h * 0.55); c.fillRect(w / 2 - 0.04, -h * 0.1, 0.1, h * 0.55); c.restore(); }
    else if (p.kind === "horseshoe") { c.save(); c.translate(p.x, p.y); c.rotate(((p.heading ?? 0) * Math.PI) / 180); const w = p.w ?? 1, h = p.h ?? 1; c.fillStyle = SH(0.16); c.fillRect(-w / 2 + 0.1, -h / 2 + 0.12, w, h); c.fillStyle = "#8a6a46"; c.fillRect(-w / 2, -h / 2, w, h); c.fillStyle = "#f4f8fc"; c.fillRect(-w / 2 + 0.05, -h / 2 + 0.05, w - 0.1, h - 0.1); c.fillStyle = "#3b3f44"; c.beginPath(); c.arc(0, 0, 0.06, 0, 7); c.fill(); c.restore(); }
    else if (p.kind === "box") { c.save(); c.translate(p.x, p.y); c.rotate(((p.heading ?? 0) * Math.PI) / 180); const w = p.w ?? 1, h = p.h ?? 1; c.fillStyle = SH(0.18); c.fillRect(-w / 2 + 0.12, -h / 2 + 0.14, w, h); c.fillStyle = "#f4f2ec"; c.fillRect(-w / 2, -h / 2, w, h); c.fillStyle = "#fbfdff"; c.beginPath(); c.roundRect(-w / 2 + 0.03, -h / 2 + 0.03, w - 0.06, h - 0.06, 0.15); c.fill(); c.restore(); }
  }
  c.restore();
}
/** A little snowy evergreen from above (for the woods). */
function drawSpruceTop(c: CanvasRenderingContext2D, x: number, y: number, r: number, rnd: () => number) {
  for (const [col, k] of [["#2a4a33", 1], ["#33583c", 0.72], ["#3f6a47", 0.45]] as const) { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + k, rr = r * k * (i % 2 ? 0.7 : 1); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); }
  c.fillStyle = "rgba(250,252,255,0.92)"; for (let i = 0; i < 6; i++) { const a = rnd() * 7, d = rnd() * r * 0.75; c.beginPath(); c.ellipse(x + Math.cos(a) * d - 0.05, y + Math.sin(a) * d - 0.05, r * 0.2, r * 0.13, a, 0, 7); c.fill(); }
}

// ── snow on the roofs (painted once over each building's baked picture) ──
export function snowRoofs(baked: { cv: HTMLCanvasElement }[], buildings: Building[]) {
  buildings.forEach((b, i) => {
    const bk = baked[i]; if (!bk) return;
    const c = bk.cv.getContext("2d")!, dz = b.height * 0.25, lift = (ps: Pt[]) => ps.map(p => [p[0], p[1] - dz] as Pt), rnd = mulberry32(60 + i);
    c.save(); c.lineJoin = "round"; c.lineCap = "round";
    if (b.kind === "deck") {   // snow on the boards, a path shovelled from the door to the steps
      const T = lift(b.poly); c.save(); pathPoly(c, T); c.clip(); c.fillStyle = "rgba(246,249,253,0.9)"; c.fill(); const xs = T.map(p => p[0]), ys = T.map(p => p[1]);
      c.globalCompositeOperation = "destination-out"; c.fillStyle = "rgba(0,0,0,0.75)"; c.beginPath(); c.roundRect((Math.min(...xs) + Math.max(...xs)) / 2 + 0.5, Math.min(...ys) - 0.2, 1.3, Math.max(...ys) - Math.min(...ys) + 0.4, 0.3); c.fill();
      c.globalCompositeOperation = "source-over"; for (let k = 0; k < 40; k++) { c.fillStyle = "rgba(255,255,255,0.8)"; c.beginPath(); c.arc(Math.min(...xs) + rnd() * (Math.max(...xs) - Math.min(...xs)), Math.min(...ys) + rnd() * (Math.max(...ys) - Math.min(...ys)), 0.08 + rnd() * 0.1, 0, 7); c.fill(); }
      c.restore(); c.restore(); return;
    }
    const metal = b.kind === "barn" || b.kind === "shed" || b.kind === "garage" || b.kind === "hall" || b.kind === "other";
    const roofs = b.flat || b.kind === "porch" ? [outsetPoly(lift(b.poly), 0.18)] : (b.wings?.length ? b.wings : [b.poly]).map(wg => outsetPoly(lift(wg), metal ? 0.16 : 0.2));
    for (const R of roofs) {
      pathPoly(c, R); c.fillStyle = metal ? "rgba(244,247,251,0.9)" : "rgba(244,247,251,0.96)"; c.fill();
      if (R.length === 4 && !(b.flat || b.kind === "porch")) {
        const d = (p: Pt, q: Pt) => Math.hypot(q[0] - p[0], q[1] - p[1]), mid = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        const [p0, p1, p2, p3] = d(R[0], R[1]) >= d(R[1], R[2]) ? [R[0], R[1], R[2], R[3]] : [R[1], R[2], R[3], R[0]];
        const r0 = mid(p3, p0), r1 = mid(p1, p2);
        // the slope facing away from the light a touch blue
        const sideA = [p0, p1, r1, r0], sideB = [p2, p3, r0, r1], cA = centroid(sideA), cB = centroid(sideB), shade = (cA[0] * -0.55 + cA[1] * -0.83) < (cB[0] * -0.55 + cB[1] * -0.83) ? sideA : sideB;
        pathPoly(c, shade); c.fillStyle = SH(0.13); c.fill();
        strokeLine(c, [r0, r1], 0.1, SH(0.35)); strokeLine(c, [r0, r1], 0.04, "rgba(255,255,255,0.9)", -0.02, -0.03);
        if (metal) { c.strokeStyle = "rgba(120,130,140,0.22)"; c.lineWidth = 0.03; const lo = shade === sideA ? [p0, p1] : [p2, p3]; for (let t = 0.04; t < 1; t += 0.06) { const ax = lo[0][0] + (lo[1][0] - lo[0][0]) * t, ay = lo[0][1] + (lo[1][1] - lo[0][1]) * t, mx = r0[0] + (r1[0] - r0[0]) * t, my = r0[1] + (r1[1] - r0[1]) * t; c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + (mx - ax) * 0.18, ay + (my - ay) * 0.18); c.stroke(); } }
      }
      pathPoly(c, R); c.strokeStyle = SH(0.4); c.lineWidth = 0.08; c.stroke();
      // icicles along the lowest eave
      let lo = 0; for (let k = 0; k < R.length; k++) { const a = R[k], bq = R[(k + 1) % R.length], ma = (a[1] + bq[1]) / 2, ml = (R[lo][1] + R[(lo + 1) % R.length][1]) / 2; if (ma > ml) lo = k; }
      const A = R[lo], B = R[(lo + 1) % R.length], L = Math.hypot(B[0] - A[0], B[1] - A[1]);
      for (let dd = 0.2; dd < L - 0.1; dd += 0.22 + rnd() * 0.25) { const x = A[0] + ((B[0] - A[0]) * dd) / L, y = A[1] + ((B[1] - A[1]) * dd) / L, len = 0.1 + rnd() * 0.22; c.fillStyle = "rgba(225,240,255,0.95)"; c.beginPath(); c.moveTo(x - 0.05, y); c.lineTo(x + 0.05, y); c.lineTo(x, y + len); c.closePath(); c.fill(); c.strokeStyle = SH(0.35); c.lineWidth = 0.012; c.stroke(); }
    }
    if (b.frontGable) { const G = lift(b.frontGable), m: Pt = [(G[0][0] + G[1][0]) / 2, (G[0][1] + G[1][1]) / 2]; strokeLine(c, [G[0], G[2], G[1]], 0.07, SH(0.32)); strokeLine(c, [m, G[2]], 0.08, SH(0.3)); }
    if (b.chimney) { const x = b.chimney[0], y = b.chimney[1] - dz, s = 0.62, hgt = 0.5; c.fillStyle = "#8f4f3b"; c.fillRect(x - s / 2, y - hgt + s / 2, s, hgt); c.fillStyle = "#6b6f74"; c.fillRect(x - s / 2 - 0.05, y - hgt - s / 2 - 0.05, s + 0.1, s + 0.1); c.fillStyle = "#f6f9fd"; c.beginPath(); c.roundRect(x - s / 2 - 0.06, y - hgt - s / 2 - 0.08, s + 0.12, 0.2, 0.08); c.fill(); c.fillStyle = "#2a2422"; c.fillRect(x - 0.14, y - hgt - 0.1, 0.28, 0.24); }
    c.restore();
  });
}
/** Where the chimney's smoke comes out (world), for the house. */
export function chimneyTop(b: Building): Pt | null { return b.chimney ? [b.chimney[0], b.chimney[1] - b.height * 0.25 - 0.5] : null; }

// ── bare winter trees ──
const treeCache = new WeakMap<Tree, { br: Path2D; tw: Path2D; snow: Path2D }>();
/** A bare tree from above: branches out from the trunk, forking, thin twigs at the ends, snow along the tops. Spruces
 *  keep their needles with snow on each layer. Apple trees are lower and gnarlier. */
export function drawWinterTree(c: CanvasRenderingContext2D, t: Tree, alpha: number, time: number) {
  c.save(); c.globalAlpha = alpha; c.translate(t.x, t.y);
  if (t.kind === "spruce") {
    const sway = Math.sin(time * 0.8 + t.x) * 0.02 * t.r;
    for (const [col, k] of [["#244b2c", 1], ["#2f5f37", 0.78], ["#3b7043", 0.52], ["#4a8250", 0.26]] as const) {
      c.fillStyle = col; c.beginPath(); for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2 + k, r = t.r * k * (i % 2 ? 0.72 : 1); c.lineTo(Math.cos(a) * r + sway * k, Math.sin(a) * r); } c.closePath(); c.fill();
      c.fillStyle = "rgba(250,252,255,0.9)"; for (let i = 0; i < 12; i += 2) { const a = (i / 24) * Math.PI * 2 + k + 0.1, r = t.r * k * 0.8; c.beginPath(); c.ellipse(Math.cos(a) * r + sway * k - 0.04, Math.sin(a) * r - 0.05, t.r * 0.12 * k + 0.05, t.r * 0.07 * k + 0.03, a, 0, 7); c.fill(); }
    }
    c.restore(); return;
  }
  let p = treeCache.get(t);
  if (!p) {
    const rnd = mulberry32(Math.round(t.x * 31 + t.y * 17)), br = new Path2D(), tw = new Path2D(), snow = new Path2D(), fruit = t.kind === "fruit";
    const grow = (x: number, y: number, a: number, len: number, depth: number) => {
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len, mx = (x + ex) / 2 + (rnd() - 0.5) * len * (fruit ? 0.35 : 0.2), my = (y + ey) / 2 + (rnd() - 0.5) * len * (fruit ? 0.35 : 0.2);
      const path = depth >= 3 ? tw : br; path.moveTo(x, y); path.quadraticCurveTo(mx, my, ex, ey);
      if (depth <= 2 && Math.sin(a + 2.2) > -0.2) { snow.moveTo(x - 0.02, y - 0.03); snow.quadraticCurveTo(mx - 0.02, my - 0.03, ex - 0.02, ey - 0.03); }
      if (depth >= 4) return;
      const n = depth === 0 ? 2 : 2 + (rnd() < 0.4 ? 1 : 0);
      for (let k = 0; k < n; k++) grow(ex, ey, a + (rnd() - 0.5) * (fruit ? 1.5 : 1.1), len * (0.6 + rnd() * 0.18), depth + 1);
    };
    const nb = fruit ? 5 : 6 + Math.floor(rnd() * 3);
    for (let k = 0; k < nb; k++) grow(0, 0, (k / nb) * Math.PI * 2 + rnd() * 0.6, t.r * (fruit ? 0.36 : 0.32) * (0.8 + rnd() * 0.3), 0);
    p = { br, tw, snow }; treeCache.set(t, p);
  }
  c.fillStyle = "rgba(110,95,85,0.1)"; c.beginPath(); c.arc(0, 0, t.r * 0.92, 0, 7); c.fill();
  c.lineCap = "round"; c.lineJoin = "round";
  c.strokeStyle = "rgba(80,66,58,0.55)"; c.lineWidth = Math.max(0.025, t.r * 0.008); c.stroke(p.tw);
  c.strokeStyle = "#5a4a40"; c.lineWidth = Math.max(0.06, t.r * 0.028); c.stroke(p.br);
  c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = Math.max(0.035, t.r * 0.014); c.stroke(p.snow);
  c.fillStyle = "#4e3f36"; c.beginPath(); c.arc(0, 0, Math.max(0.22, t.r * 0.08), 0, 7); c.fill();
  c.fillStyle = "rgba(255,255,255,0.9)"; c.beginPath(); c.arc(-0.04, -0.05, Math.max(0.12, t.r * 0.045), 0, 7); c.fill();
  c.restore();
}

// ── Pat in his winter clothes ──
function plaid(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  c.save(); c.fillStyle = COAT; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); c.clip();
  c.fillStyle = COAT_DARK; for (let k = -0.4; k < 0.4; k += 0.1) { c.fillRect(x + k, y - ry, 0.04, ry * 2); c.fillRect(x - rx, y + k, rx * 2, 0.04); }
  c.fillStyle = "rgba(255,255,255,0.13)"; c.beginPath(); c.ellipse(x - rx * 0.3, y - ry * 0.3, rx * 0.45, ry * 0.45, 0, 0, 7); c.fill();
  c.restore(); c.strokeStyle = "rgba(60,15,12,0.5)"; c.lineWidth = 0.02; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.stroke();
}
/** Pat's head from above in his green toque with a pom-pom: brown hair going salt and pepper showing at the back. */
function toqueHead(c: CanvasRenderingContext2D, hk: number) {
  c.save(); c.scale(hk, hk);
  c.fillStyle = "rgba(40,20,10,0.18)"; c.beginPath(); c.arc(0.02, 0.02, 0.125, 0, 7); c.fill();
  c.fillStyle = SKIN; c.beginPath(); c.arc(0.01, 0, 0.12, 0, 7); c.fill();
  c.fillStyle = "#e3ad86"; c.beginPath(); c.ellipse(0.127, 0, 0.022, 0.026, 0, 0, 7); c.fill();
  c.fillStyle = HAIR; c.beginPath(); c.ellipse(-0.03, 0, 0.11, 0.118, 0, 0, 7); c.fill();
  c.fillStyle = GREYS; for (const [gx, gy] of [[-0.12, -0.03], [-0.115, 0.04], [-0.1, -0.08], [-0.1, 0.085]]) { c.beginPath(); c.arc(gx, gy, 0.016, 0, 7); c.fill(); }
  c.fillStyle = TOQUE; c.beginPath(); c.arc(0.0, 0, 0.106, 0, 7); c.fill();
  c.strokeStyle = TOQUE_RIB; c.lineWidth = 0.022; c.beginPath(); c.arc(0.0, 0, 0.094, 0, 7); c.stroke();
  c.lineWidth = 0.008; for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * 0.03, Math.sin(a) * 0.03); c.lineTo(Math.cos(a) * 0.085, Math.sin(a) * 0.085); c.stroke(); }
  c.fillStyle = "rgba(255,255,255,0.12)"; c.beginPath(); c.arc(-0.03, -0.035, 0.05, 0, 7); c.fill();
  c.fillStyle = POM; c.beginPath(); c.arc(-0.005, 0, 0.042, 0, 7); c.fill(); c.fillStyle = "rgba(160,140,110,0.35)"; c.beginPath(); c.arc(0.008, 0.01, 0.026, 0, 7); c.fill();
  c.restore();
}
export type WinterPose = { walk: number; carry?: "shovel" | "wood" | "lights" | "axe" | "tool" | null; tool?: ToolKind; bend?: number; reach?: number; swing?: number; wave?: number; scoop?: number; seed?: number };
/** Pat on foot in his red plaid coat, toque, jeans and winter boots. `walk` is the step phase (0 standing); `bend` reaches
 *  down; `reach` lifts both arms up (hanging lights); `swing` (0 up .. 1 down) is the axe; `scoop` lifts the shovel. */
export function drawWinterPat(c: CanvasRenderingContext2D, x: number, y: number, a: number, p: WinterPose, t: number, size = 1.3) {
  c.save(); c.translate(x, y);
  c.fillStyle = SH(0.25); c.beginPath(); c.ellipse(0.12, 0.14, 0.32 * size, 0.24 * size, a, 0, 7); c.fill();
  c.rotate(a); c.scale(size, size);
  const st = p.walk ? Math.sin(p.walk) : 0, bend = p.bend ?? 0, reach = p.reach ?? 0;
  for (const s of [-1, 1]) { const f = st * s * 0.16; c.fillStyle = JEANS; c.beginPath(); c.roundRect(-0.1 + f, s * 0.11 - 0.055, 0.2, 0.11, 0.05); c.fill(); c.fillStyle = BOOT; c.beginPath(); c.roundRect(0.06 + f, s * 0.11 - 0.06, 0.13, 0.12, 0.04); c.fill(); c.fillStyle = "#c9b79a"; c.fillRect(0.05 + f, s * 0.11 - 0.06, 0.03, 0.12); }
  c.translate(bend * 0.18, 0);
  const arm = (s: number, hx: number, hy: number) => {
    c.strokeStyle = COAT; c.lineWidth = 0.11; c.lineCap = "round"; c.beginPath(); c.moveTo(-0.02, s * 0.22); c.lineTo(hx * 0.75, s * 0.22 + (hy - s * 0.22) * 0.75); c.stroke();
    c.fillStyle = GLOVE; c.beginPath(); c.arc(hx, hy, 0.055, 0, 7); c.fill();
  };
  if (p.carry === "shovel") {   // both hands on the handle, the scoop out front
    const sc = p.scoop ?? 0, hx = 0.34 + sc * 0.04;
    c.save(); c.strokeStyle = "#8a6440"; c.lineWidth = 0.05; c.beginPath(); c.moveTo(0.1, 0.06); c.lineTo(0.82, 0); c.stroke();
    c.fillStyle = "#3a3f46"; c.beginPath(); c.roundRect(0.08, 0.02, 0.06, 0.1, 0.02); c.fill();
    c.translate(0.82 + sc * 0.06, 0); c.fillStyle = "#2f6db0"; c.beginPath(); c.roundRect(0, -0.24, 0.32, 0.48, 0.05); c.fill(); c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(0.02, -0.22, 0.07, 0.44);
    c.strokeStyle = "#c7ccd2"; c.lineWidth = 0.03; c.beginPath(); c.moveTo(0.32, -0.24); c.lineTo(0.32, 0.24); c.stroke();
    if (sc > 0.05) { c.fillStyle = "#f8fbff"; c.beginPath(); c.ellipse(0.17, 0, 0.13 * sc + 0.04, 0.19 * sc + 0.04, 0, 0, 7); c.fill(); }
    c.restore(); arm(-1, hx, -0.06); arm(1, 0.12, 0.1);
  } else if (p.carry === "axe") {   // the axe up over his shoulder (swing 0) down to the block in front (swing 1)
    const sw = p.swing ?? 0, ang = -2.4 + sw * 2.4, L = 0.75, hx = 0.12 + Math.cos(ang) * 0.12, hy = Math.sin(ang) * 0.05;
    const tx = hx + Math.cos(ang) * L, ty = hy + Math.sin(ang) * L * 0.25;
    c.strokeStyle = "#a07a4e"; c.lineWidth = 0.05; c.lineCap = "round"; c.beginPath(); c.moveTo(hx, hy); c.lineTo(tx, ty); c.stroke();
    c.save(); c.translate(tx, ty); c.rotate(Math.atan2(ty - hy, tx - hx)); c.fillStyle = "#5d646b"; c.beginPath(); c.moveTo(-0.04, -0.05); c.lineTo(0.08, -0.12); c.lineTo(0.1, 0.02); c.lineTo(-0.04, 0.05); c.closePath(); c.fill(); c.fillStyle = "#c7ccd2"; c.fillRect(0.07, -0.12, 0.03, 0.14); c.restore();
    arm(-1, hx, hy - 0.04); arm(1, hx, hy + 0.04);
  } else if (p.carry === "wood") {
    arm(-1, 0.38, -0.15); arm(1, 0.38, 0.15);
    for (let k = 0; k < 4; k++) drawSplit(c, 0.38 + (k % 2) * 0.06, -0.12 + k * 0.08, Math.PI / 2 + (k - 1.5) * 0.15, 0.55);
  } else if (p.carry === "lights") {
    arm(-1, 0.34, -0.12); arm(1, 0.34, 0.12);
    c.strokeStyle = "#2f5a2a"; c.lineWidth = 0.025; for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(0.42, 0, 0.12 + k * 0.02, 0.16 + k * 0.02, 0, 0, 7); c.stroke(); }
    BULB_COLS.forEach((col, k) => { const an = (k / 6) * Math.PI * 2; c.fillStyle = col; c.beginPath(); c.arc(0.42 + Math.cos(an) * 0.14, Math.sin(an) * 0.18, 0.025, 0, 7); c.fill(); });
  } else if (p.carry === "tool" && p.tool) {
    arm(-1, 0.32, -0.1); arm(1, 0.32, 0.1);
    drawTool(c, p.tool, 0.42, 0, Math.PI / 2, 0.8);
  } else if (reach > 0) {   // both arms up and forward (stringing lights along the eaves)
    const k = reach, wv = Math.sin(t * 7) * 0.03;
    arm(-1, 0.2 + 0.18 * k, -0.2 + wv); arm(1, 0.2 + 0.18 * k, 0.2 - wv);
  } else {
    const r2 = bend ? 0.22 + bend * 0.2 : 0;
    for (const s of [-1, 1]) arm(s, r2 ? 0.12 + r2 : -st * s * 0.16 + 0.04, r2 ? s * 0.14 : s * 0.27);
  }
  if (p.wave) { const wv = Math.sin(t * 11) * 0.09; c.strokeStyle = COAT; c.lineWidth = 0.1; c.beginPath(); c.moveTo(0, -0.22); c.lineTo(0.08 + wv * 0.5, -0.5); c.stroke(); c.fillStyle = GLOVE; c.beginPath(); c.arc(0.1 + wv, -0.62, 0.06, 0, 7); c.fill(); }
  plaid(c, -0.04, 0, 0.17, 0.28);
  c.fillStyle = "#3a2a22"; c.beginPath(); c.ellipse(0.05, 0, 0.05, 0.12, 0, 0, 7); c.fill();   // the collar
  c.translate(0.02 + bend * 0.12, 0); toqueHead(c, 1.15);
  c.restore();
}
/** Pat sitting on the tractor in his coat and toque (drawn over an empty seat, in the tractor's frame). */
export function drawPatSeated(c: CanvasRenderingContext2D, x: number, y: number, h: number, steer: number, t: number, wave = 0, hk = 1.15) {
  c.save(); c.translate(x, y); c.rotate(h);
  c.fillStyle = JEANS; c.beginPath(); c.roundRect(-0.36, -0.2, 0.5, 0.13, 0.05); c.fill(); c.beginPath(); c.roundRect(-0.36, 0.07, 0.5, 0.13, 0.05); c.fill();
  c.fillStyle = BOOT; c.beginPath(); c.roundRect(0.1, -0.22, 0.13, 0.14, 0.03); c.fill(); c.beginPath(); c.roundRect(0.1, 0.08, 0.13, 0.14, 0.03); c.fill();
  const sa = steer * 0.12;
  const arm = (fx: number, fy: number, hx: number, hy: number) => { c.strokeStyle = COAT; c.lineWidth = 0.11; c.lineCap = "round"; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + (hx - fx) * 0.8, fy + (hy - fy) * 0.8); c.stroke(); c.fillStyle = GLOVE; c.beginPath(); c.arc(hx, hy, 0.055, 0, 7); c.fill(); };
  arm(-0.42, 0.21, 0.03, 0.13 + sa);
  if (wave > 0) { const wv = Math.sin(t * 11) * 0.09 * wave; arm(-0.44, -0.2, -0.36 + 0.1 * wave + wv, -0.21 - 0.42 * wave); }
  else arm(-0.42, -0.21, 0.03, -0.13 + sa);
  plaid(c, -0.46, 0, 0.17, 0.27);
  c.fillStyle = "#3a2a22"; c.beginPath(); c.ellipse(-0.37, 0, 0.05, 0.12, 0, 0, 7); c.fill();
  c.translate(-0.44, 0); toqueHead(c, hk);
  c.restore();
}
/** Linda standing, from above: her light purple winter coat, blond hair over her shoulders, a mug in her hands (or waving). */
export function drawLindaWinter(c: CanvasRenderingContext2D, x: number, y: number, a: number, t: number, o: { wave?: number; mug?: boolean } = {}, size = 1.25) {
  const coat = "#c7a6e6", coatDark = "#a885cc", skin = "#f4d2b8", hair = "#e6c77a", hairLite = "#f5e2a6";
  c.save(); c.translate(x, y); c.fillStyle = SH(0.22); c.beginPath(); c.ellipse(0.1, 0.12, 0.3 * size, 0.22 * size, a, 0, 7); c.fill();
  c.rotate(a); c.scale(size, size);
  for (const s of [-1, 1]) { c.fillStyle = "#e9e4dc"; c.beginPath(); c.roundRect(0.04, s * 0.1 - 0.05, 0.14, 0.1, 0.04); c.fill(); }   // white winter boots
  c.lineCap = "round";
  const arm = (s: number, hx: number, hy: number) => { c.strokeStyle = coat; c.lineWidth = 0.1; c.beginPath(); c.moveTo(-0.02, s * 0.2); c.lineTo(hx * 0.8, s * 0.2 + (hy - s * 0.2) * 0.8); c.stroke(); c.fillStyle = skin; c.beginPath(); c.arc(hx, hy, 0.045, 0, 7); c.fill(); };
  if (o.mug) { arm(-1, 0.24, -0.05); arm(1, 0.24, 0.05); c.fillStyle = "#e8e2d4"; c.beginPath(); c.arc(0.3, 0, 0.06, 0, 7); c.fill(); c.fillStyle = "#6b4226"; c.beginPath(); c.arc(0.3, 0, 0.042, 0, 7); c.fill(); }
  else { arm(1, 0.08, 0.26); if (o.wave) { const wv = Math.sin(t * 10) * 0.08; arm(-1, 0.12 + wv, -0.5); } else arm(-1, 0.08, -0.26); }
  c.fillStyle = coat; c.beginPath(); c.ellipse(-0.05, 0, 0.16, 0.25, 0, 0, 7); c.fill();
  c.fillStyle = coatDark; c.beginPath(); c.ellipse(-0.1, 0.04, 0.07, 0.18, 0, 0, 7); c.fill();
  c.fillStyle = "rgba(255,255,255,0.22)"; c.beginPath(); c.ellipse(-0.06, -0.09, 0.06, 0.1, 0, 0, 7); c.fill();
  c.fillStyle = "#f2f0ea"; c.beginPath(); c.ellipse(0.04, 0, 0.06, 0.13, 0, 0, 7); c.fill();   // a white scarf
  c.fillStyle = hair; c.beginPath(); c.ellipse(-0.11, 0, 0.13, 0.15, 0, 0, 7); c.fill();
  c.fillStyle = skin; c.beginPath(); c.arc(0.01, 0, 0.105, 0, 7); c.fill();
  c.fillStyle = hair; c.beginPath(); c.ellipse(-0.025, 0, 0.1, 0.112, 0, 0, 7); c.fill();
  c.fillStyle = hairLite; c.beginPath(); c.ellipse(-0.035, -0.035, 0.055, 0.045, 0.4, 0, 7); c.fill();
  c.restore();
}

// ── the plow and the cars ──
export const BLADE = { lon0: 1.2, lon1: 1.55, half: 1.25 };
/** The plow blade on the front of the tractor (its frame), in the tractor's paint, with the snow it's pushing. */
export function drawPlow(c: CanvasRenderingContext2D, x: number, y: number, h: number, paint: Paint, load: number, t: number) {
  c.save(); c.translate(x, y); c.rotate(h);
  const { lon0, lon1, half } = BLADE;
  c.fillStyle = SH(0.2); c.beginPath(); c.roundRect(lon0 + 0.15, -half + 0.2, lon1 - lon0, half * 2, 0.08); c.fill();
  c.strokeStyle = "#2a2d31"; c.lineWidth = 0.07; c.lineCap = "round"; c.beginPath(); c.moveTo(0.75, -0.3); c.lineTo(lon0 + 0.05, -0.55); c.moveTo(0.75, 0.3); c.lineTo(lon0 + 0.05, 0.55); c.moveTo(0.95, 0); c.lineTo(lon0 + 0.05, 0); c.stroke();
  if (load > 0.01) {   // the snow rolling ahead of the blade
    const k = Math.min(1, load / 3), wob = Math.sin(t * 9) * 0.02;
    c.fillStyle = SH(0.2); c.beginPath(); c.ellipse(lon1 + 0.14 + k * 0.28, 0.1, 0.18 + k * 0.42, half * (0.55 + 0.4 * k), 0, 0, 7); c.fill();
    c.fillStyle = "#f6f9fd"; c.beginPath(); c.ellipse(lon1 + 0.06 + k * 0.24 + wob, 0, 0.16 + k * 0.4, half * (0.5 + 0.42 * k), 0, 0, 7); c.fill();
    c.fillStyle = "#ffffff"; for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(lon1 + 0.08 + k * 0.3, i * half * 0.3 * (0.5 + 0.4 * k) - 0.05, 0.08 + k * 0.12, 0, 7); c.fill(); }
  }
  const g = c.createLinearGradient(lon0, 0, lon1, 0); g.addColorStop(0, paint.trim); g.addColorStop(0.45, paint.body); g.addColorStop(1, paint.hood);
  c.fillStyle = g; c.beginPath(); c.roundRect(lon0, -half, lon1 - lon0 - 0.05, half * 2, 0.07); c.fill();
  c.strokeStyle = "rgba(40,25,10,0.55)"; c.lineWidth = 0.03; c.stroke();
  c.fillStyle = "rgba(255,255,255,0.22)"; c.fillRect(lon0 + 0.05, -half + 0.05, 0.07, half * 2 - 0.1);
  c.fillStyle = "#b9bec4"; c.fillRect(lon1 - 0.07, -half, 0.06, half * 2);   // the steel cutting edge
  c.fillStyle = "#24272b"; for (const s of [-1, 1]) { c.beginPath(); c.roundRect(lon0 - 0.02, s * half - (s > 0 ? 0.06 : 0), 0.32, 0.06, 0.02); c.fill(); }   // end plates
  c.fillStyle = "rgba(255,255,255,0.9)"; c.beginPath(); c.roundRect(lon0 + 0.02, -half * 0.8, 0.08, half * 1.4, 0.04); c.fill();   // snow on top of the blade
  c.restore();
}
/** A parked car from above with snow on it (`snow` 1 buried, 0.3 brushed off). Frame centred, +x forward. */
export function drawSnowCar(c: CanvasRenderingContext2D, x: number, y: number, h: number, color: string, snow: number, len = 4.4, wid = 1.84) {
  const L = len / 2, Wd = wid / 2, rnd = mulberry32(7);
  c.save(); c.fillStyle = SH(0.22); c.save(); c.translate(x + 0.35, y + 0.4); c.rotate(h); c.beginPath(); c.roundRect(-L, -Wd, L * 2, Wd * 2, 0.5); c.fill(); c.restore();
  c.translate(x, y); c.rotate(h);
  for (const [wx, s] of [[1.35, -1], [1.35, 1], [-1.3, -1], [-1.3, 1]] as const) { c.fillStyle = "#151515"; c.beginPath(); c.roundRect(wx - 0.34, s * (Wd - 0.04) - 0.13, 0.68, 0.26, 0.07); c.fill(); }
  c.fillStyle = color; c.beginPath(); c.roundRect(-L, -Wd, L * 2, Wd * 2, 0.45); c.fill();
  const g = c.createLinearGradient(0, -Wd, 0, Wd); g.addColorStop(0, "rgba(255,255,255,0.22)"); g.addColorStop(1, "rgba(0,0,0,0.2)"); c.fillStyle = g; c.fill();
  c.strokeStyle = "rgba(20,20,30,0.55)"; c.lineWidth = 0.05; c.stroke();
  c.fillStyle = "#28323d"; c.beginPath(); c.roundRect(0.45, -Wd + 0.16, 0.6, Wd * 2 - 0.32, 0.12); c.fill();   // windshield
  c.beginPath(); c.roundRect(-1.75, -Wd + 0.2, 0.45, Wd * 2 - 0.4, 0.1); c.fill();                             // back window
  c.fillStyle = color; c.beginPath(); c.roundRect(-1.3, -Wd + 0.14, 1.75, Wd * 2 - 0.28, 0.16); c.fill();     // roof
  for (const s of [-1, 1]) { c.fillStyle = "#1d2227"; c.beginPath(); c.ellipse(0.5, s * (Wd + 0.05), 0.08, 0.06, 0, 0, 7); c.fill(); }
  // the snow: thick on the roof, hood and trunk; pushed off the windows when it's been brushed
  const blob = (bx: number, by: number, bw: number, bh: number, r: number) => { c.fillStyle = SH(0.14); c.beginPath(); c.roundRect(bx + 0.05, by + 0.07, bw, bh, r); c.fill(); c.fillStyle = "#f6f9fd"; c.beginPath(); c.roundRect(bx, by, bw, bh, r); c.fill(); };
  blob(-1.25, -Wd + 0.18, 1.65, Wd * 2 - 0.36, 0.25);
  if (snow > 0.6) { blob(0.45, -Wd + 0.16, 0.6, Wd * 2 - 0.32, 0.2); blob(1.05, -Wd + 0.12, L - 1.15, Wd * 2 - 0.24, 0.25); blob(-L + 0.1, -Wd + 0.14, 0.55, Wd * 2 - 0.28, 0.2); blob(-1.75, -Wd + 0.2, 0.45, Wd * 2 - 0.4, 0.1); }
  else { blob(1.15, -Wd + 0.3, L - 1.3, Wd * 2 - 0.6, 0.2); }
  c.fillStyle = "rgba(255,255,255,0.9)"; for (let k = 0; k < 10; k++) { c.beginPath(); c.arc(-1.2 + rnd() * 1.6, (rnd() - 0.5) * (Wd * 2 - 0.5), 0.06 + rnd() * 0.06, 0, 7); c.fill(); }
  c.restore();
}

// ── firewood ──
/** A split piece of firewood from above: pale split face, bark on the back. */
export function drawSplit(c: CanvasRenderingContext2D, x: number, y: number, a: number, len = 0.5) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.fillStyle = "#6e4a2e"; c.beginPath(); c.roundRect(-len / 2, -0.07, len, 0.14, 0.04); c.fill();
  c.fillStyle = "#d9b37c"; c.beginPath(); c.moveTo(-len / 2 + 0.02, -0.05); c.lineTo(len / 2 - 0.02, -0.05); c.lineTo(len / 2 - 0.04, 0.03); c.lineTo(-len / 2 + 0.04, 0.03); c.closePath(); c.fill();
  c.strokeStyle = "rgba(120,80,40,0.45)"; c.lineWidth = 0.012; c.beginPath(); c.moveTo(-len / 2 + 0.05, -0.01); c.lineTo(len / 2 - 0.05, -0.02); c.stroke();
  c.restore();
}
/** A log round standing on end (the top showing its rings), `split` 0..1 opens it in two. */
export function drawRound(c: CanvasRenderingContext2D, x: number, y: number, r: number, split = 0, snow = false) {
  const o = split * 0.25;
  for (const s of split > 0 ? [-1, 1] : [0]) {
    c.save(); c.translate(x + s * o, y); if (split > 0) c.rotate(s * split * 0.5);
    c.beginPath(); if (s === 0) c.arc(0, 0, r, 0, 7); else c.arc(0, 0, r, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? Math.PI / 2 : Math.PI * 1.5); c.closePath();
    c.fillStyle = "#5e4028"; c.fill(); c.save(); c.clip(); c.fillStyle = "#d8b07a"; c.beginPath(); c.arc(0, 0, r * 0.84, 0, 7); c.fill();
    c.strokeStyle = "rgba(140,95,50,0.45)"; c.lineWidth = 0.012; for (let k = 0.2; k < 0.84; k += 0.16) { c.beginPath(); c.arc(0, 0, r * k, 0, 7); c.stroke(); }
    c.restore(); c.restore();
  }
  if (snow && !split) { c.fillStyle = "rgba(250,252,255,0.92)"; c.beginPath(); c.ellipse(x - r * 0.15, y - r * 0.2, r * 0.6, r * 0.4, 0, 0, 7); c.fill(); }
}
/** The chopping block: a big round on end, cut marks on top. */
export function drawBlock(c: CanvasRenderingContext2D, x: number, y: number, axeIn: boolean) {
  c.fillStyle = SH(0.22); c.beginPath(); c.ellipse(x + 0.12, y + 0.15, 0.42, 0.36, 0, 0, 7); c.fill();
  drawRound(c, x, y, 0.38);
  c.strokeStyle = "rgba(90,60,30,0.5)"; c.lineWidth = 0.02; for (const [a, b2] of [[-0.2, 0.15], [0.1, -0.18], [-0.05, -0.2]]) { c.beginPath(); c.moveTo(x + a, y + b2); c.lineTo(x - a * 0.6, y - b2 * 0.6); c.stroke(); }
  if (axeIn) { c.strokeStyle = "#a07a4e"; c.lineWidth = 0.05; c.lineCap = "round"; c.beginPath(); c.moveTo(x + 0.05, y - 0.02); c.lineTo(x + 0.62, y + 0.3); c.stroke(); c.fillStyle = "#5d646b"; c.beginPath(); c.moveTo(x - 0.08, y - 0.1); c.lineTo(x + 0.1, y - 0.06); c.lineTo(x + 0.06, y + 0.06); c.lineTo(x - 0.1, y + 0.02); c.closePath(); c.fill(); }
}
/** The woodpile: logs stacked lengthwise along `len` metres (frame +x along the pile), snow on top. */
export function drawWoodpile(c: CanvasRenderingContext2D, x: number, y: number, a: number, len: number, depth: number) {
  const rnd = mulberry32(5);
  c.save(); c.translate(x, y); c.rotate(a);
  c.fillStyle = SH(0.2); c.fillRect(-len / 2 + 0.2, -depth / 2 + 0.25, len, depth);
  c.fillStyle = "#5a3e28"; c.fillRect(-len / 2, -depth / 2, len, depth);
  for (let r = -depth / 2 + 0.11; r < depth / 2; r += 0.2) for (let s = -len / 2 + 0.05; s < len / 2 - 0.1; s += 0.62 + rnd() * 0.2) { c.fillStyle = rnd() < 0.5 ? "#7a5638" : "#6a4a30"; c.beginPath(); c.roundRect(s, r - 0.09, 0.6, 0.18, 0.08); c.fill(); }
  for (let s = -len / 2 + 0.1; s < len / 2; s += 0.22) drawRound(c, s, depth / 2 - 0.02, 0.1);   // the ends facing the front
  c.fillStyle = "rgba(248,251,255,0.95)"; c.beginPath(); c.roundRect(-len / 2 + 0.05, -depth / 2 + 0.03, len - 0.1, depth * 0.55, 0.12); c.fill();
  c.restore();
}
/** Split wood stacked against a wall: `n` pieces in rows (frame +x along the wall, the pile toward +y). */
export function drawWoodStack(c: CanvasRenderingContext2D, x: number, y: number, len: number, n: number) {
  c.fillStyle = SH(0.2); c.fillRect(x + 0.1, y + 0.1, len, 0.62);
  c.fillStyle = "#6a4a30"; c.fillRect(x, y, len, 0.6);
  const per = Math.max(1, Math.floor(len / 0.2)), rnd = mulberry32(9);
  for (let i = 0; i < n; i++) { const row = Math.floor(i / per), col = i % per; drawSplit(c, x + 0.1 + col * 0.2 + (row % 2) * 0.08, y + 0.32 - row * 0.06, Math.PI / 2 + (rnd() - 0.5) * 0.3, 0.52); }
}
/** The cart behind the tractor with split wood in it (frame like ./fallArt drawCart). */
export function drawWoodInCart(c: CanvasRenderingContext2D, x: number, y: number, a: number, n: number) {
  c.save(); c.translate(x, y); c.rotate(a); const rnd = mulberry32(13);
  for (let i = 0; i < n; i++) drawSplit(c, (rnd() - 0.5) * 0.85, (rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.8, 0.5);
  c.restore();
}

// ── Christmas lights ──
const glowCache = new Map<string, HTMLCanvasElement>();
function glowSprite(col: string) {
  let g = glowCache.get(col); if (g) return g;
  g = document.createElement("canvas"); g.width = g.height = 64; const c = g.getContext("2d")!, rg = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, "rgba(255,255,255,1)"); rg.addColorStop(0.12, col); rg.addColorStop(0.4, col + "66"); rg.addColorStop(1, col + "00");
  c.fillStyle = rg; c.fillRect(0, 0, 64, 64); glowCache.set(col, g); return g;
}
/** Bulbs every `gap` metres along a path, as far as `shown` (0..1) of the way. `lit` 0..1 lights them; `glow` draws the
 *  light round each (the night scene). */
export function drawStrand(c: CanvasRenderingContext2D, pts: Pt[], shown: number, lit: number, t: number, glow = false, gap = 0.42) {
  if (shown <= 0 || pts.length < 2) return;
  let total = 0; const segs: number[] = []; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); total += d; }
  const end = total * Math.min(1, shown);
  const at = (d: number): Pt => { for (let i = 0; i < segs.length; i++) { if (d <= segs[i] || i === segs.length - 1) { const u = segs[i] ? Math.min(1, d / segs[i]) : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]; } d -= segs[i]; } return pts[pts.length - 1]; };
  if (!glow) {   // the wire, swagging a little between bulbs
    c.strokeStyle = "#1f3a1c"; c.lineWidth = 0.035; c.lineCap = "round"; c.beginPath();
    for (let d = 0; d <= end; d += gap / 2) { const p = at(d), sag = Math.abs(Math.sin((d / gap) * Math.PI)) * 0.05; if (d === 0) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1] + sag); }
    c.stroke();
  }
  let k = 0;
  for (let d = gap / 2; d <= end; d += gap, k++) {
    const p = at(d), col = BULB_COLS[k % BULB_COLS.length], tw = 0.75 + 0.25 * Math.sin(t * 3 + k * 1.7);
    if (glow) { if (lit > 0) { const s = 1.4 * lit * tw; c.globalAlpha = Math.min(1, lit); c.drawImage(glowSprite(col), p[0] - s / 2, p[1] - s / 2, s, s); c.globalAlpha = 1; } continue; }
    c.fillStyle = lit > 0.5 ? "#ffffff" : col; c.beginPath(); c.ellipse(p[0], p[1] + 0.03, 0.06, 0.075, 0, 0, 7); c.fill();
    if (lit <= 0.5) { c.fillStyle = "rgba(0,0,0,0.25)"; c.beginPath(); c.ellipse(p[0] + 0.015, p[1] + 0.05, 0.04, 0.05, 0, 0, 7); c.fill(); c.fillStyle = "rgba(255,255,255,0.5)"; c.beginPath(); c.arc(p[0] - 0.02, p[1], 0.018, 0, 7); c.fill(); }
    else { c.fillStyle = col; c.globalAlpha = 0.55; c.beginPath(); c.arc(p[0], p[1] + 0.03, 0.1, 0, 7); c.fill(); c.globalAlpha = 1; }
  }
}
/** A box of lights waiting on the snow (where a strand goes). */
export function drawLightBox(c: CanvasRenderingContext2D, x: number, y: number, t: number) {
  c.fillStyle = SH(0.22); c.fillRect(x - 0.22, y - 0.12, 0.5, 0.36);
  c.fillStyle = "#c9a46a"; c.fillRect(x - 0.28, y - 0.2, 0.5, 0.36); c.strokeStyle = "rgba(90,60,30,0.5)"; c.lineWidth = 0.02; c.strokeRect(x - 0.28, y - 0.2, 0.5, 0.36);
  c.strokeStyle = "#2f5a2a"; c.lineWidth = 0.025; c.beginPath(); c.ellipse(x - 0.03, y - 0.02, 0.15, 0.1, 0, 0, 7); c.stroke();
  BULB_COLS.slice(0, 4).forEach((col, k) => { c.fillStyle = col; c.beginPath(); c.arc(x - 0.15 + k * 0.09, y - 0.02 + Math.sin(k * 2 + t) * 0.01, 0.03, 0, 7); c.fill(); });
}

// ── the shop: tools, the stove, the room ──
type Pal = { steel: string; dark: string; wood: string; red: string; yellow: string; orange: string; blue: string; ghost: boolean };
const PAL: Pal = { steel: "#9aa2aa", dark: "#4b5258", wood: "#b08458", red: "#c8352b", yellow: "#e8b52e", orange: "#ef7a1d", blue: "#2f6db0", ghost: false };
const GHOST: Pal = { steel: "rgba(30,34,40,0.38)", dark: "rgba(30,34,40,0.38)", wood: "rgba(30,34,40,0.38)", red: "rgba(30,34,40,0.38)", yellow: "rgba(30,34,40,0.38)", orange: "rgba(30,34,40,0.38)", blue: "rgba(30,34,40,0.38)", ghost: true };
/** A tool from above (frame +x along its length, centred). `ghost` draws its painted outline on the board instead. */
export function drawTool(c: CanvasRenderingContext2D, kind: ToolKind, x: number, y: number, a: number, s = 1, ghost = false) {
  const P = ghost ? GHOST : PAL;
  c.save(); c.translate(x, y); c.rotate(a); c.scale(s, s);
  const R = (x0: number, y0: number, w: number, h: number, r: number, col: string) => { c.fillStyle = col; c.beginPath(); c.roundRect(x0, y0, w, h, r); c.fill(); };
  const C = (cx: number, cy: number, r: number, col: string) => { c.fillStyle = col; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); };
  switch (kind) {
    case "wrenchL": case "wrenchS": { const L = kind === "wrenchL" ? 0.34 : 0.24, w = kind === "wrenchL" ? 0.04 : 0.032; R(-L / 2, -w / 2, L, w, w / 2, P.steel); C(L / 2, 0, w * 1.5, P.steel); C(-L / 2, 0, w * 1.3, P.steel); if (!ghost) { C(L / 2 + w * 0.8, 0, w * 0.75, "#e9edf0"); C(-L / 2, 0, w * 0.6, "#e9edf0"); } else { c.globalCompositeOperation = "destination-out"; C(L / 2 + w * 0.8, 0, w * 0.75, "#000"); c.globalCompositeOperation = "source-over"; } break; }
    case "hammer": R(-0.19, -0.022, 0.3, 0.044, 0.02, P.wood); R(0.1, -0.09, 0.07, 0.18, 0.02, P.dark); break;
    case "saw": R(-0.3, -0.05, 0.12, 0.1, 0.03, P.red); c.fillStyle = P.steel; c.beginPath(); c.moveTo(-0.18, -0.045); c.lineTo(0.32, -0.02); c.lineTo(0.32, 0.03); c.lineTo(-0.18, 0.06); c.closePath(); c.fill(); if (!ghost) { c.strokeStyle = "#6a7178"; c.lineWidth = 0.008; c.beginPath(); for (let k = -0.16; k < 0.31; k += 0.025) { c.moveTo(k, 0.055 - (k + 0.18) * 0.06); c.lineTo(k + 0.012, 0.07 - (k + 0.18) * 0.06); } c.stroke(); } break;
    case "screwdriver": R(-0.15, -0.025, 0.11, 0.05, 0.02, P.yellow); R(-0.05, -0.008, 0.2, 0.016, 0.006, P.steel); break;
    case "pliers": c.strokeStyle = P.red; c.lineWidth = 0.03; c.lineCap = "round"; c.beginPath(); c.moveTo(-0.13, -0.04); c.lineTo(0.02, 0); c.moveTo(-0.13, 0.04); c.lineTo(0.02, 0); c.stroke(); c.strokeStyle = P.steel; c.lineWidth = 0.035; c.beginPath(); c.moveTo(0.0, 0); c.lineTo(0.12, -0.012); c.moveTo(0.0, 0); c.lineTo(0.12, 0.012); c.stroke(); C(0.01, 0, 0.02, P.dark); break;
    case "rake": R(-0.75, -0.02, 1.4, 0.04, 0.02, P.wood); R(0.62, -0.25, 0.05, 0.5, 0.02, P.steel); if (!ghost) for (let k = -0.22; k <= 0.23; k += 0.055) R(0.66, k - 0.006, 0.08, 0.012, 0.004, P.dark); break;
    case "shovel": R(-0.7, -0.02, 1.15, 0.04, 0.02, P.wood); R(-0.75, -0.05, 0.1, 0.1, 0.03, P.dark); R(0.42, -0.26, 0.34, 0.52, 0.05, P.blue); if (!ghost) R(0.72, -0.26, 0.04, 0.52, 0.01, "#c7ccd2"); break;
    case "broom": R(-0.7, -0.02, 1.15, 0.04, 0.02, P.wood); R(0.42, -0.2, 0.3, 0.4, 0.06, ghost ? P.dark : "#d9b85a"); if (!ghost) { c.strokeStyle = "rgba(140,105,40,0.6)"; c.lineWidth = 0.01; for (let k = -0.18; k < 0.2; k += 0.04) { c.beginPath(); c.moveTo(0.45, k); c.lineTo(0.71, k); c.stroke(); } R(0.42, -0.2, 0.05, 0.4, 0.02, P.red); } break;
    case "gascan": R(-0.21, -0.15, 0.42, 0.3, 0.05, P.red); if (!ghost) { R(-0.12, -0.05, 0.16, 0.1, 0.03, "#8e2019"); R(0.12, -0.1, 0.1, 0.04, 0.02, "#2b2b2b"); c.strokeStyle = "rgba(255,255,255,0.2)"; c.lineWidth = 0.02; c.beginPath(); c.moveTo(-0.19, -0.13); c.lineTo(0.19, 0.13); c.stroke(); } else R(0.12, -0.1, 0.1, 0.04, 0.02, P.dark); break;
    case "cord": c.strokeStyle = P.orange; c.lineWidth = 0.035; for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(0, 0, 0.12 + k * 0.025, 0.14 + k * 0.025, 0.3, 0, 7); c.stroke(); } if (!ghost) { R(0.15, 0.12, 0.08, 0.05, 0.015, "#2b2b2b"); } break;
  }
  c.restore();
}
/** The wood stove from above: a black box with a round flue, the glass door glowing when it's lit. */
export function drawStoveTop(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, fire = 1) {
  c.fillStyle = "rgba(20,20,30,0.25)"; c.beginPath(); c.roundRect(x - r + 0.12, y - r * 0.8 + 0.15, r * 2, r * 1.6, 0.12); c.fill();
  c.fillStyle = "#2a2c30"; c.beginPath(); c.roundRect(x - r, y - r * 0.8, r * 2, r * 1.6, 0.12); c.fill();
  c.fillStyle = "#3a3d42"; c.beginPath(); c.roundRect(x - r + 0.06, y - r * 0.8 + 0.06, r * 2 - 0.12, r * 1.6 - 0.12, 0.08); c.fill();
  c.fillStyle = "#1c1d20"; c.beginPath(); c.arc(x, y - r * 0.3, r * 0.3, 0, 7); c.fill(); c.fillStyle = "#4a4d52"; c.beginPath(); c.arc(x - 0.03, y - r * 0.33, r * 0.16, 0, 7); c.fill();
  const fl = 0.7 + 0.3 * Math.sin(t * 9) * Math.sin(t * 5.3);
  c.fillStyle = "#1c1d20"; c.fillRect(x - r * 0.7, y + r * 0.5, r * 1.4, r * 0.32);
  const g = c.createLinearGradient(0, y + r * 0.5, 0, y + r * 0.82); g.addColorStop(0, `rgba(255,${Math.round(150 + 60 * fl)},60,${0.9 * fire})`); g.addColorStop(1, `rgba(255,90,30,${0.9 * fire})`);
  c.fillStyle = g; c.fillRect(x - r * 0.62, y + r * 0.53, r * 1.24, r * 0.26);
}
/** The shop drawn once: the concrete floor, the walls, the pegboard over the bench with each tool's outline, the rack,
 *  the shelves, the stove and its rug, the bin, Pat's '67, and the open doors with the snow outside. */
export function paintShop(c: CanvasRenderingContext2D, map: LawnMap) {
  const W = map.size[0], H = map.size[1], rnd = mulberry32(41), { x0, x1, y0, y1, doorX0, doorX1 } = ROOM;
  c.save();
  c.fillStyle = "#5a4636"; c.fillRect(-1, -1, W + 2, H + 2);
  // outside the doors: snow, a set of tire tracks going out
  c.fillStyle = SNOW; c.fillRect(doorX0 - 1, y1, doorX1 - doorX0 + 2, H - y1 + 1);
  for (let k = 0; k < 120; k++) { c.fillStyle = rnd() < 0.5 ? "rgba(135,158,196,0.12)" : "rgba(255,255,255,0.7)"; c.fillRect(doorX0 + rnd() * (doorX1 - doorX0), y1 + rnd() * (H - y1), 0.05, 0.05); }
  // the floor: concrete with saw-cut joints and a few old stains
  c.fillStyle = "#b9b4aa"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let k = 0; k < (x1 - x0) * (y1 - y0) * 18; k++) { c.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.08)" : "rgba(60,50,40,0.07)"; c.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 0.05, 0.05); }
  c.strokeStyle = "rgba(90,80,70,0.25)"; c.lineWidth = 0.03; for (let gx = x0 + 3; gx < x1; gx += 3) { c.beginPath(); c.moveTo(gx, y0); c.lineTo(gx, y1); c.stroke(); } for (let gy = y0 + 3; gy < y1; gy += 3) { c.beginPath(); c.moveTo(x0, gy); c.lineTo(x1, gy); c.stroke(); }
  for (const [sx, sy, sr] of [[7.6, 9.8, 0.5], [3.0, 8.4, 0.35], [9.4, 12.6, 0.6]]) { c.fillStyle = "rgba(60,50,45,0.14)"; c.beginPath(); c.ellipse(sx, sy, sr, sr * 0.7, 0.4, 0, 7); c.fill(); }
  // a wet patch of melted snow inside the doors
  c.fillStyle = "rgba(90,100,115,0.18)"; c.beginPath(); c.ellipse((doorX0 + doorX1) / 2, y1 - 0.5, 2.0, 0.6, 0, 0, 7); c.fill();
  // the walls: the north wall seen from the room (boards), the others as thick tops
  c.fillStyle = "#c9a878"; c.fillRect(x0, 0, x1 - x0, WALL_Y);
  for (let bx = x0; bx < x1; bx += 0.28) { c.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(90,60,30,0.07)"; c.fillRect(bx, 0, 0.28, WALL_Y); c.fillStyle = "rgba(90,60,30,0.3)"; c.fillRect(bx + 0.27, 0, 0.012, WALL_Y); }
  c.fillStyle = "rgba(60,40,20,0.25)"; c.fillRect(x0, WALL_Y - 0.12, x1 - x0, 0.12);
  c.fillStyle = "#6b5440"; c.fillRect(-1, -1, x0 + 1, H + 2); c.fillRect(x1, -1, W - x1 + 1, H + 2); c.fillRect(-1, y1, doorX0 + 1, 0.25); c.fillRect(doorX1, y1, W - doorX1 + 1, 0.25); c.fillRect(-1, -1, W + 2, 0.12);
  c.fillStyle = "#7d6450"; c.fillRect(x0 - 0.12, 0, 0.12, H); c.fillRect(x1, 0, 0.12, H);
  // the big doors slid open, and a window in the west wall
  c.fillStyle = "#9b3b2e"; c.fillRect(doorX0 - 2.0, y1 - 0.05, 2.0, 0.22); c.fillRect(doorX1, y1 - 0.05, 2.0, 0.22);
  c.fillStyle = "#cfe0ef"; c.fillRect(x0 - 0.1, 10.0, 0.1, 1.4);
  // the pegboard: brown board with holes, every pegboard tool's painted outline
  c.fillStyle = "#a07650"; c.fillRect(PEGBOARD.x0, PEGBOARD.y0, PEGBOARD.x1 - PEGBOARD.x0, PEGBOARD.y1 - PEGBOARD.y0);
  c.fillStyle = "rgba(50,30,15,0.45)"; for (let px = PEGBOARD.x0 + 0.08; px < PEGBOARD.x1; px += 0.1) for (let py = PEGBOARD.y0 + 0.08; py < PEGBOARD.y1; py += 0.1) c.fillRect(px, py, 0.02, 0.02);
  c.strokeStyle = "#6b4e33"; c.lineWidth = 0.05; c.strokeRect(PEGBOARD.x0, PEGBOARD.y0, PEGBOARD.x1 - PEGBOARD.x0, PEGBOARD.y1 - PEGBOARD.y0);
  for (const t of TOOLS) if (t.home === "pegboard" || t.home === "hook") drawTool(c, t.kind, t.spot[0], t.spot[1], t.spot[2], 1.6, true);
  // a little shelf on the wall by the cord hook: jars of screws
  c.fillStyle = "#8a6a48"; c.fillRect(7.2, 1.85, 2.4, 0.12); for (let k = 0; k < 5; k++) { c.fillStyle = "rgba(200,220,235,0.8)"; c.fillRect(7.35 + k * 0.45, 1.55, 0.26, 0.3); c.fillStyle = k % 2 ? "#c8352b" : "#2f6db0"; c.fillRect(7.35 + k * 0.45, 1.52, 0.26, 0.07); }
  c.fillStyle = "#555"; c.beginPath(); c.arc(8.3, 0.85, 0.05, 0, 7); c.fill();   // the cord hook
  // the stove pipe up the wall
  c.fillStyle = "#2a2c30"; c.fillRect(STOVE.x - 0.12, 0, 0.24, STOVE.y - 0.2); c.fillStyle = "rgba(255,255,255,0.12)"; c.fillRect(STOVE.x - 0.08, 0, 0.05, STOVE.y - 0.2);
  // the workbench: a heavy wooden top with a vise at one end and a coffee can of bolts
  c.fillStyle = "rgba(30,20,10,0.25)"; c.fillRect(BENCH.x0 + 0.1, BENCH.y0 + 0.12, BENCH.x1 - BENCH.x0, BENCH.y1 - BENCH.y0);
  c.fillStyle = "#8f6a44"; c.fillRect(BENCH.x0, BENCH.y0, BENCH.x1 - BENCH.x0, BENCH.y1 - BENCH.y0);
  for (let bx = BENCH.x0; bx < BENCH.x1; bx += 0.6) { c.fillStyle = "rgba(60,40,20,0.25)"; c.fillRect(bx, BENCH.y0, 0.015, BENCH.y1 - BENCH.y0); }
  c.fillStyle = "#4b5258"; c.fillRect(BENCH.x0 + 0.1, BENCH.y1 - 0.35, 0.4, 0.4); c.fillStyle = "#6c747b"; c.fillRect(BENCH.x0 + 0.15, BENCH.y1 - 0.05, 0.3, 0.12);
  c.fillStyle = "#9aa2aa"; c.beginPath(); c.arc(BENCH.x0 + 1.4, BENCH.y0 + 0.4, 0.13, 0, 7); c.fill(); c.fillStyle = "#5d646b"; c.beginPath(); c.arc(BENCH.x0 + 1.4, BENCH.y0 + 0.4, 0.1, 0, 7); c.fill();
  // the rack on the west wall for the long tools, with their outlines
  c.fillStyle = "#7a5a3c"; c.fillRect(RACK.x0, RACK.y0, RACK.x1 - RACK.x0, RACK.y1 - RACK.y0);
  for (const t of TOOLS) if (t.home === "rack") { drawTool(c, t.kind, t.spot[0] + 0.05, t.spot[1], 0, 0.9, true); c.fillStyle = "#3b3f44"; c.fillRect(RACK.x0 + 0.05, t.spot[1] - 0.03, 0.25, 0.06); }
  // the shelves on the east wall: paint cans, oil jugs, a box of rags, the gas can's spot
  c.fillStyle = "rgba(30,20,10,0.22)"; c.fillRect(SHELF.x0 - 0.12, SHELF.y0 + 0.12, SHELF.x1 - SHELF.x0, SHELF.y1 - SHELF.y0);
  c.fillStyle = "#8d949b"; c.fillRect(SHELF.x0, SHELF.y0, SHELF.x1 - SHELF.x0, SHELF.y1 - SHELF.y0); c.fillStyle = "#b8bec4"; c.fillRect(SHELF.x0 + 0.04, SHELF.y0 + 0.04, SHELF.x1 - SHELF.x0 - 0.08, SHELF.y1 - SHELF.y0 - 0.08);
  for (const [iy, col] of [[7.3, "#3a7be0"], [7.75, "#e8b52e"], [8.3, "#2f8a3a"], [8.8, "#e8e2d4"]] as const) { c.fillStyle = col; c.beginPath(); c.arc(SHELF.x0 + 0.45, iy, 0.18, 0, 7); c.fill(); c.fillStyle = "rgba(0,0,0,0.2)"; c.beginPath(); c.arc(SHELF.x0 + 0.45, iy, 0.1, 0, 7); c.fill(); }
  for (const t of TOOLS) if (t.home === "shelf") drawTool(c, t.kind, t.spot[0], t.spot[1], t.spot[2], 1.5, true);
  // the rug by the stove and the cat's bed
  c.fillStyle = "#8e3a34"; c.beginPath(); c.roundRect(RUG.x0, RUG.y0, RUG.x1 - RUG.x0, RUG.y1 - RUG.y0, 0.2); c.fill();
  c.strokeStyle = "rgba(240,210,150,0.5)"; c.lineWidth = 0.05; c.beginPath(); c.roundRect(RUG.x0 + 0.12, RUG.y0 + 0.12, RUG.x1 - RUG.x0 - 0.24, RUG.y1 - RUG.y0 - 0.24, 0.12); c.stroke();
  c.fillStyle = "#6b5b4b"; c.beginPath(); c.ellipse(10.1, 5.6, 0.42, 0.34, 0, 0, 7); c.fill(); c.fillStyle = "#c9b79a"; c.beginPath(); c.ellipse(10.1, 5.6, 0.32, 0.25, 0, 0, 7); c.fill();
  // a split-wood box by the stove (full: Pat filled it)
  c.fillStyle = "#6a4a30"; c.fillRect(11.25, 3.35, 0.75, 1.3); for (let k = 0; k < 7; k++) drawSplit(c, 11.62, 3.5 + k * 0.17, 0.05 * (k % 3 - 1), 0.62);
  drawStoveTop(c, STOVE.x, STOVE.y, STOVE.r, 0, 0);
  // the bin
  c.fillStyle = "rgba(30,20,10,0.25)"; c.beginPath(); c.arc(BIN.x + 0.08, BIN.y + 0.1, BIN.r, 0, 7); c.fill(); c.fillStyle = "#4f6a52"; c.beginPath(); c.arc(BIN.x, BIN.y, BIN.r, 0, 7); c.fill(); c.fillStyle = "#3d5440"; c.beginPath(); c.arc(BIN.x, BIN.y, BIN.r * 0.75, 0, 7); c.fill();
  // Pat's '67, parked for the winter
  drawCar(c, CAR67.x, CAR67.y, CAR67.h, 0, {});
  c.restore();
}

// ── breath, snow falling, the night ──
export type Puff = { x: number; y: number; vx: number; vy: number; t: number; life: number; r: number; a: number };
export function drawPuffs(c: CanvasRenderingContext2D, puffs: Puff[]) {
  for (const p of puffs) { const u = p.t / p.life; c.fillStyle = `rgba(255,255,255,${(p.a * (1 - u)).toFixed(3)})`; c.beginPath(); c.arc(p.x, p.y, p.r * (0.5 + u), 0, 7); c.fill(); }
}
/** Snow falling across the screen (screen pixels); stateless, from the time. */
export function drawSnowfall(c: CanvasRenderingContext2D, CW: number, MH: number, time: number, n: number, alpha = 0.85) {
  c.save(); c.fillStyle = `rgba(255,255,255,${alpha})`;
  for (let i = 0; i < n; i++) {
    const s1 = Math.sin(i * 91.7) * 0.5 + 0.5, s2 = Math.sin(i * 47.3) * 0.5 + 0.5, sp = 22 + s2 * 30, r = 0.9 + s2 * 1.6;
    const y = ((s1 * (MH + 20) + time * sp) % (MH + 20)) - 10, x = ((s2 * CW * 1.7 + Math.sin(time * 0.7 + i) * 14 + time * 6) % (CW + 20)) - 10;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
  c.restore();
}

// ── the little pictures on the job cards ──
export type WinterArtKind = "plow" | "wood" | "xmas" | "tidy";
export const isWinterArt = (k: string): k is WinterArtKind => k === "plow" || k === "wood" || k === "xmas" || k === "tidy";
const PAINT_ORANGE: Paint = { body: "#f26b1d", hood: "#f47c20", trim: "#b04e12" };
export function drawWinterCardArt(c: CanvasRenderingContext2D, kind: WinterArtKind, W: number, H: number, t: number, done = false) {
  c.save();
  const S = Math.min(H / 2.9, W / 9.2);
  if (kind === "wood" && done) { cosyStove(c, W, H, t); c.restore(); return; }
  if (kind === "tidy") { shopCard(c, W, H, t, S, done); c.restore(); return; }
  const night = kind === "xmas" && done;
  c.fillStyle = night ? "#1d2742" : SNOW; c.fillRect(0, 0, W, H);
  if (!night) { const r = mulberry32(3); for (let k = 0; k < W * H * 0.02; k++) { c.fillStyle = r() < 0.5 ? "rgba(135,158,196,0.14)" : "rgba(255,255,255,0.9)"; c.fillRect(r() * W, r() * H, 1.2, 1.2); } }
  c.translate(W / 2, H / 2); c.scale(S, S);
  const hw = W / S / 2;
  if (kind === "plow") {
    c.fillStyle = "#a99f8f"; c.fillRect(-hw, -0.95, hw * 2, 1.9);                       // the plowed strip
    for (let x = -hw; x < hw; x += 0.3) { stampBank(c, x, -1.15 + Math.sin(x * 3) * 0.05, 0.3); stampBank(c, x + 0.15, 1.15 + Math.cos(x * 2.3) * 0.05, 0.3); }
    if (done) {
      drawSnowCar(c, -3.6, 0, 0, "#7a2f3a", 0.3);
      drawWinterPat(c, 0.5, 0.15, 0, { walk: 0, carry: "shovel", wave: 0 }, t, 1.9);
      drawLindaWinter(c, 2.3, -0.1, Math.PI, t, { mug: true }, 1.8);
      for (let k = 0; k < 2; k++) { c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = 0.03; c.beginPath(); c.moveTo(2.88 + k * 0.08, -0.15); c.quadraticCurveTo(3.0 + k * 0.08 + Math.sin(t * 2 + k) * 0.08, -0.4, 2.9 + k * 0.08, -0.65); c.stroke(); }
    } else {
      c.fillStyle = SNOW; c.fillRect(1.8, -0.95, hw, 1.9);
      drawMower(c, -0.2, 0, 0, 0, 0, t, true, 0.3, PAINT_ORANGE, false, false, { empty: true });
      drawPlow(c, -0.2, 0, 0, PAINT_ORANGE, 2 + Math.sin(t * 2) * 0.5, t);
      drawPatSeated(c, -0.2, 0, 0, 0, t);
    }
  } else if (kind === "wood") {
    drawWoodpile(c, -2.6, -0.4, 0, 2.6, 0.9);
    drawBlock(c, 0.6, 0.35, false);
    const sw = (Math.sin(t * 3) + 1) / 2; drawRound(c, 0.6, 0.35, 0.22, sw > 0.85 ? (sw - 0.85) * 6 : 0);
    drawWinterPat(c, -0.3, 0.45, 0, { walk: 0, carry: "axe", swing: sw }, t, 1.35);
    for (let k = 0; k < 5; k++) drawSplit(c, 1.6 + (k % 3) * 0.2, 0.7 - Math.floor(k / 3) * 0.15, 0.3 * k, 0.5);
  } else {   // the lights: the house's eave with a strand, the spruce, Pat with a coil; at night it's all lit
    c.fillStyle = night ? "#3c3a44" : "#5b463b"; c.fillRect(-hw, -1.45, hw * 2, 0.75); c.fillStyle = night ? "#c9cfdb" : "#f4f7fb"; c.fillRect(-hw, -1.45, hw * 2, 0.6);
    c.fillStyle = night ? "#6e6a5a" : "#ece3cc"; c.fillRect(-hw, -0.7, hw * 2, 0.45);
    if (night) for (const wx of [-2.6, -0.6, 1.4]) { c.fillStyle = "#ffd77a"; c.fillRect(wx, -0.62, 0.5, 0.3); c.fillStyle = "rgba(255,215,120,0.25)"; c.beginPath(); c.arc(wx + 0.25, -0.45, 0.8, 0, 7); c.fill(); }
    const eave: Pt[] = [[-hw, -0.85], [hw, -0.85]];
    drawStrand(c, eave, 1, night ? 1 : 0, t); if (night) drawStrand(c, eave, 1, 1, t, true);
    c.save(); c.translate(hw - 1.1, 0.55); drawWinterTree(c, { x: 0, y: 0, r: 0.75, kind: "spruce" }, 1, t); const sp: Pt[] = []; for (let k = 0; k <= 20; k++) { const a = k * 0.9, rr = 0.7 - k * 0.03; sp.push([Math.cos(a) * rr, Math.sin(a) * rr]); } drawStrand(c, sp, done ? 1 : 0.6, night ? 1 : 0, t, false, 0.3); if (night) drawStrand(c, sp, 1, 1, t, true, 0.3); c.restore();
    if (night) { drawCatAt(c, -0.6, 0.55, -1.2, t); drawLindaWinter(c, -1.8, 0.5, -1.5, t, { wave: 1 }, 1.2); drawWinterPat(c, -1.1, 0.6, -1.4, { walk: 0 }, t, 1.3); drawSnowfallWorld(c, hw, t); }
    else drawWinterPat(c, -0.6, 0.4, -0.3, { walk: 0, carry: "lights" }, t, 1.35);
  }
  c.restore();
}
function drawCatAt(c: CanvasRenderingContext2D, x: number, y: number, h: number, t: number, act: "sit" | "nap" = "sit") { drawCat(c, { x, y, h, act, phase: 0 }, t, 1.8, false); }
function drawSnowfallWorld(c: CanvasRenderingContext2D, hw: number, t: number) { c.fillStyle = "rgba(255,255,255,0.85)"; for (let i = 0; i < 40; i++) { const s1 = Math.sin(i * 91.7) * 0.5 + 0.5, s2 = Math.sin(i * 47.3) * 0.5 + 0.5; c.beginPath(); c.arc(-hw + ((s2 * hw * 2 + t * 0.2) % (hw * 2)), -1.45 + ((s1 * 2.9 + t * (0.3 + s2 * 0.3)) % 2.9), 0.03 + s2 * 0.03, 0, 7); c.fill(); } }
/** The end card for the firewood: the wood stove going, the woodbox full, the cat curled up on the rug. */
function cosyStove(c: CanvasRenderingContext2D, W: number, H: number, t: number) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#5b3d2b"); g.addColorStop(1, "#3a271c"); c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 18) { c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(x, 0, 1, H * 0.7); }
  c.fillStyle = "#6e4f3a"; c.fillRect(0, H * 0.7, W, H * 0.3); c.fillStyle = "#8e3a34"; c.beginPath(); c.ellipse(W * 0.42, H * 0.9, W * 0.22, H * 0.1, 0, 0, 7); c.fill();
  const fl = 0.75 + 0.25 * Math.sin(t * 8) * Math.sin(t * 5.1), sx = W * 0.42, sw = H * 0.62, sh = H * 0.52, sy = H * 0.72 - sh;
  const glow = c.createRadialGradient(sx, sy + sh * 0.6, 0, sx, sy + sh * 0.6, H * 1.1); glow.addColorStop(0, `rgba(255,170,80,${0.35 * fl})`); glow.addColorStop(1, "rgba(255,140,60,0)"); c.fillStyle = glow; c.fillRect(0, 0, W, H);
  c.fillStyle = "#1f2023"; c.fillRect(sx - sh * 0.12, 0, sh * 0.24, sy);   // the pipe
  c.fillStyle = "#2a2c30"; c.beginPath(); c.roundRect(sx - sw / 2, sy, sw, sh, 4); c.fill();
  c.fillStyle = "#1a1b1e"; c.fillRect(sx - sw / 2 - 3, sy - 3, sw + 6, 5); c.fillRect(sx - sw / 2 + 3, sy + sh, 5, H * 0.06); c.fillRect(sx + sw / 2 - 8, sy + sh, 5, H * 0.06);
  const dx = sx - sw * 0.34, dy = sy + sh * 0.2, dw = sw * 0.68, dh = sh * 0.6;
  c.fillStyle = "#111"; c.fillRect(dx, dy, dw, dh);
  const fg = c.createLinearGradient(0, dy + dh, 0, dy); fg.addColorStop(0, "#ff7a1a"); fg.addColorStop(0.5, `rgba(255,${Math.round(170 + 60 * fl)},60,1)`); fg.addColorStop(1, "rgba(255,220,120,0.4)");
  c.fillStyle = fg; c.beginPath(); c.moveTo(dx + 2, dy + dh - 2);
  for (let k = 0; k <= 8; k++) { const fx = dx + 2 + ((dw - 4) * k) / 8, fh = dh * (0.45 + 0.35 * Math.abs(Math.sin(t * 6 + k * 1.3)) * fl); c.lineTo(fx, dy + dh - fh); }
  c.lineTo(dx + dw - 2, dy + dh - 2); c.closePath(); c.fill();
  c.fillStyle = "#5e3f28"; c.fillRect(dx + 3, dy + dh - 6, dw - 6, 4);
  c.strokeStyle = "#555a60"; c.lineWidth = 1.5; c.strokeRect(dx, dy, dw, dh);
  // the woodbox, full
  const bx = sx + sw * 0.7, by = H * 0.42; c.fillStyle = "#6a4a30"; c.fillRect(bx, by, W * 0.16, H * 0.3);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { c.fillStyle = (r + k) % 2 ? "#d8b07a" : "#c79a62"; c.beginPath(); c.arc(bx + 7 + k * W * 0.035, by + 4 - r * 5 + H * 0.02, 4.2, 0, 7); c.fill(); c.strokeStyle = "#6e4a2e"; c.lineWidth = 1.2; c.stroke(); }
  // the cat curled up on the rug, and a steaming mug on the hearth
  c.save(); c.translate(W * 0.2, H * 0.86); c.scale(H / 2.2, H / 2.2); drawCatAt(c, 0, 0, 0.5, t, "nap"); c.restore();
  const mx = W * 0.82, my = H * 0.8; c.fillStyle = "#e8e2d4"; c.fillRect(mx, my, 10, 11); c.strokeStyle = "#e8e2d4"; c.lineWidth = 2; c.beginPath(); c.arc(mx + 11, my + 5, 3.5, -1.4, 1.4); c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.5)"; c.lineWidth = 1.2; for (let k = 0; k < 2; k++) { c.beginPath(); c.moveTo(mx + 3 + k * 4, my - 2); c.quadraticCurveTo(mx + 6 + k * 4 + Math.sin(t * 2 + k) * 3, my - 8, mx + 3 + k * 4, my - 14); c.stroke(); }
}
/** The shop card: the pegboard with the tool outlines (filled in when it's done), Pat holding a wrench, the cat on the bench. */
function shopCard(c: CanvasRenderingContext2D, W: number, H: number, t: number, S: number, done: boolean) {
  c.fillStyle = "#c9a878"; c.fillRect(0, 0, W, H);
  c.fillStyle = "#b9b4aa"; c.fillRect(0, H * 0.62, W, H * 0.38);
  c.translate(W / 2, H / 2); c.scale(S * 1.25, S * 1.25);
  const hw = W / (S * 1.25) / 2;
  c.fillStyle = "#a07650"; c.fillRect(-2.6, -1.05, 5.2, 1.0); c.strokeStyle = "#6b4e33"; c.lineWidth = 0.04; c.strokeRect(-2.6, -1.05, 5.2, 1.0);
  c.fillStyle = "rgba(50,30,15,0.4)"; for (let px = -2.52; px < 2.6; px += 0.1) for (let py = -0.98; py < -0.05; py += 0.1) c.fillRect(px, py, 0.015, 0.015);
  const kinds: ToolKind[] = ["wrenchL", "wrenchS", "hammer", "saw", "screwdriver", "pliers"];
  kinds.forEach((k, i) => { const x = -2.1 + i * 0.85, show = done || i % 2 === 0; drawTool(c, k, x, -0.55, -Math.PI / 2, 1.25, !show); });
  c.fillStyle = "#8f6a44"; c.fillRect(-hw, 0.0, hw * 2, 0.32);
  drawCatAt(c, 2.3, 0.12, 2.6, t, done ? "nap" : "sit");
  if (!done) { drawTool(c, "rake", -1.6, 0.85, 0.1, 0.9); drawTool(c, "gascan", 1.4, 0.95, 0.4, 1.2); }
  drawWinterPat(c, 0, 0.75, -Math.PI / 2, { walk: 0, carry: done ? null : "tool", tool: "wrenchS", wave: done ? 1 : 0 }, t, 1.25);
}
