// The drawings for Chapter 6, The Annual Party, in the same soft top-down style as ./art and ./fallArt: the barn's walls
// (faded and peeling, then fresh red with white trim), the paint rig on the tractor, the lawn games, the nets, the slip
// and slide, the party tent, string lights, the hay wagon full of kids, and the little pictures on the job cards.
// World units are metres; each drawing's own frame has +x forward. Light from the top left. Things that stand up
// (ladders, nets, the goal, the tent poles) lean "up" the screen like the buildings do (the slight 3/4 view).
import type { Pt } from "../lawnMap";
import { mulberry32, clamp } from "./geo";
import { drawPerson, drawMower, drawCat, tone, OBL } from "./art";
import { drawLinda, drawPat, drawFlag } from "./fallArt";
import { PAINTS } from "./jobs";

export const BARN_RED = "#c8261e", BARN_FADED = "#b48f84", TRIM_OLD = "#c9bfae", TRIM_NEW = "#ffffff";
const INK = "rgba(46,32,22,0.55)", SHADOW = "rgba(20,40,10,0.22)";
const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
/** Two colours mixed (t 0 is `a`, 1 is `b`). */
export function mix(a: string, b: string, t: number) { const A = hex(a), B = hex(b), u = clamp(t, 0, 1); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * u).toString(16).padStart(2, "0")).join(""); }
const add = (p: Pt, q: Pt, k = 1): Pt => [p[0] + q[0] * k, p[1] + q[1] * k];

// ── the barn's walls ──
export type Face = {
  a: Pt; b: Pt;            // the wall along the ground, left to right as you look at it
  coats: Float32Array;     // paint on each strip of it, 0 faded .. 1 a full coat
  wet: Float32Array;       // how fresh each strip is (1 just painted .. 0 dry), for the shine and a drip or two
  trim: number;            // the white trim, 0 old .. 1 fresh
  seed: number;
  door?: { s: number; w: number; h: number };     // a big sliding door: centre along the wall (m), width, height (0..1 of the wall)
  window?: { s: number; w: number };
  corners: boolean;        // white corner boards at both ends
  hidden?: [number, number][];   // stretches of the wall (m) behind something else (not drawn)
};
/** One wall seen at an angle: the strips mix from the old weathered colour to fresh red, boards, peeling patches on the
 *  old paint, a wet shine on the new, then the trim. `off` is where the top of the wall shows (the roof's offset). */
export function drawFace(c: CanvasRenderingContext2D, f: Face, off: Pt, lit: number) {
  const L = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]), u: Pt = [(f.b[0] - f.a[0]) / L, (f.b[1] - f.a[1]) / L], n = f.coats.length, bl = L / n;
  const P = (s: number, k: number): Pt => [f.a[0] + u[0] * s + off[0] * k, f.a[1] + u[1] * s + off[1] * k];
  const quad = (s0: number, s1: number, k0 = 0, k1 = 1) => { const q = [P(s0, k0), P(s1, k0), P(s1, k1), P(s0, k1)]; c.beginPath(); c.moveTo(q[0][0], q[0][1]); for (let i = 1; i < 4; i++) c.lineTo(q[i][0], q[i][1]); c.closePath(); };
  const shade = lit > 0 ? 0.1 * lit : 0.22 * lit;
  c.save();
  quad(0, L); c.clip();
  const rnd = mulberry32(f.seed);
  for (let k = 0; k < n; k++) {
    const s0 = k * bl, s1 = s0 + bl, cv = f.coats[k];
    quad(s0 - 0.01, s1 + 0.01); c.fillStyle = tone(mix(BARN_FADED, BARN_RED, cv), shade); c.fill();
    // the old paint: grey weathered streaks and pale patches where it's peeled to the wood
    const old = Math.pow(1 - Math.min(1, cv), 1.4);
    const r1 = rnd(), r2 = rnd(), r3 = rnd(), r4 = rnd();
    if (old > 0.02) {
      c.globalAlpha = old * 0.85;
      c.fillStyle = "#ddd1c2"; const ps = s0 + bl * (0.15 + r1 * 0.5), pk = 0.25 + r2 * 0.5; quad(ps, Math.min(s1, ps + bl * (0.3 + r3 * 0.4)), pk, Math.min(0.95, pk + 0.12 + r4 * 0.2)); c.fill();
      c.fillStyle = "rgba(90,70,60,0.35)"; quad(s0 + bl * r3 * 0.6, s0 + bl * (r3 * 0.6 + 0.12), 0.05, 0.9); c.fill();
      c.globalAlpha = 1;
    }
    // fresh paint: a soft shine while it's wet, and now and then a drip running down
    if (f.wet[k] > 0.02 && cv > 0.5) {
      c.globalAlpha = f.wet[k] * 0.5; c.fillStyle = "#ff7a62"; quad(s0 + bl * 0.2, s0 + bl * 0.45, 0.15, 0.85); c.fill();
      if (r1 < 0.3) { c.globalAlpha = f.wet[k] * 0.9; c.fillStyle = "#9c1712"; const ds = s0 + bl * (0.3 + r2 * 0.4), dk = 0.55 + r3 * 0.3, len = 0.12 + (1 - f.wet[k]) * 0.25; quad(ds, ds + 0.05, dk - len, dk); c.fill(); const [dx, dy] = P(ds + 0.025, dk - len); c.beginPath(); c.arc(dx, dy, 0.04, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    }
  }
  // vertical boards
  c.lineWidth = 0.03; c.strokeStyle = "rgba(0,0,0,0.16)"; c.beginPath();
  for (let s = 0.3; s < L; s += 0.3) { const [x0, y0] = P(s, 0), [x1, y1] = P(s, 1); c.moveTo(x0, y0); c.lineTo(x1, y1); }
  c.stroke();
  // the roof's shadow along the top
  c.fillStyle = "rgba(30,20,10,0.22)"; quad(0, L, 0.86, 1); c.fill();
  c.restore();
  const trimCol = mix(TRIM_OLD, TRIM_NEW, f.trim), shine = f.trim > 0.99 ? 1 : 0;
  // the big door: planks the same paint as the wall, a white frame and the X brace
  if (f.door) {
    const { s, w, h } = f.door, a0 = s - w / 2, a1 = s + w / 2;
    c.fillStyle = "rgba(0,0,0,0.12)"; quad(a0, a1, 0, h); c.fill();
    c.strokeStyle = trimCol; c.lineWidth = 0.13; c.lineJoin = "round"; c.beginPath();
    const pt = (ss: number, kk: number) => P(ss, kk), m = s;
    for (const [p0, p1] of [[pt(a0, 0), pt(a0, h)], [pt(a0, h), pt(a1, h)], [pt(a1, h), pt(a1, 0)], [pt(a0, 0), pt(m, h)], [pt(m, 0), pt(a0, h)], [pt(m, 0), pt(a1, h)], [pt(a1, 0), pt(m, h)], [pt(m, 0), pt(m, h)]]) { c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); }
    c.stroke();
    c.strokeStyle = "#3a3d42"; c.lineWidth = 0.06; c.beginPath(); { const [x0, y0] = P(a0 - 0.1, h + 0.06), [x1, y1] = P(a1 + 0.1, h + 0.06); c.moveTo(x0, y0); c.lineTo(x1, y1); } c.stroke();
  }
  if (f.window) {
    const { s, w } = f.window; c.fillStyle = trimCol; quad(s - w / 2, s + w / 2, 0.5, 0.82); c.fill();
    c.fillStyle = "#5b7890"; quad(s - w / 2 + 0.07, s + w / 2 - 0.07, 0.54, 0.78); c.fill();
    c.fillStyle = "rgba(255,255,255,0.35)"; quad(s - w / 2 + 0.07, s - w / 2 + 0.2, 0.6, 0.78); c.fill();
    c.fillStyle = trimCol; quad(s - 0.025, s + 0.025, 0.54, 0.78); c.fill();
  }
  if (f.corners) { c.fillStyle = trimCol; quad(0, 0.12); c.fill(); quad(L - 0.12, L); c.fill(); }
  if (shine) { c.fillStyle = "rgba(255,255,255,0.08)"; quad(0, L, 0.6, 0.85); c.fill(); }
  c.strokeStyle = INK; c.lineWidth = 0.06; quad(0, L); c.stroke();
}

// ── the paint rig on the tractor: a drum of red paint on the back with a hose to a spray wand each side ──
export function drawPaintRig(c: CanvasRenderingContext2D, x: number, y: number, h: number, spray: number, side: number, t: number, white = false) {
  c.save(); c.translate(x, y); c.rotate(h);
  c.strokeStyle = "#2b2f33"; c.lineWidth = 0.06; c.lineCap = "round";
  c.beginPath(); c.moveTo(-0.95, 0); c.quadraticCurveTo(-0.6, 0.1, -0.3, 0.74); c.moveTo(-0.95, 0); c.quadraticCurveTo(-0.6, -0.1, -0.3, -0.74); c.stroke();
  for (const s of [-1, 1]) { c.strokeStyle = "#8d9399"; c.lineWidth = 0.07; c.beginPath(); c.moveTo(-0.45, s * 0.62); c.lineTo(-0.1, s * 0.86); c.stroke(); c.fillStyle = "#2b2f33"; c.beginPath(); c.arc(-0.08, s * 0.88, 0.05, 0, 7); c.fill(); }
  // the drum: red paint (or white once he's onto the trim), a lid with a bung
  c.fillStyle = SHADOW; c.beginPath(); c.arc(-0.88, 0.06, 0.32, 0, 7); c.fill();
  c.fillStyle = "#5d646b"; c.beginPath(); c.arc(-0.95, 0, 0.3, 0, 7); c.fill();
  c.fillStyle = white ? "#f4f4f0" : BARN_RED; c.beginPath(); c.arc(-0.95, 0, 0.24, 0, 7); c.fill();
  c.fillStyle = "rgba(255,255,255,0.3)"; c.beginPath(); c.arc(-1.02, -0.07, 0.1, 0, 7); c.fill();
  c.fillStyle = "#3a3d42"; c.beginPath(); c.arc(-0.9, 0.06, 0.05, 0, 7); c.fill();
  // the mist off the wand toward the wall
  if (spray > 0.02) {
    const s = side >= 0 ? 1 : -1;
    for (let k = 0; k < 7; k++) { const ph = (t * 3.2 + k / 7) % 1, sp = (k % 3 - 1) * 0.22 * ph; c.globalAlpha = spray * (1 - ph) * 0.55; c.fillStyle = white ? "#ffffff" : "#e0453a"; c.beginPath(); c.arc(-0.08 + sp, s * (0.95 + ph * 1.1), 0.06 + ph * 0.12, 0, 7); c.fill(); }
    c.globalAlpha = 1;
  }
  c.restore();
}

/** A drop of paint on the grass, or a cat's paw print in red. */
export function drawDrop(c: CanvasRenderingContext2D, x: number, y: number, r: number, col = BARN_RED) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
export function drawPawPrint(c: CanvasRenderingContext2D, x: number, y: number, a: number, alpha = 0.8) {
  c.save(); c.translate(x, y); c.rotate(a); c.globalAlpha = alpha; c.fillStyle = "#b8241c";
  c.beginPath(); c.ellipse(0, 0, 0.035, 0.04, 0, 0, 7); c.fill();
  for (const [tx, ty] of [[0.045, -0.035], [0.06, 0], [0.045, 0.035]]) { c.beginPath(); c.arc(tx, ty, 0.014, 0, 7); c.fill(); }
  c.restore();
}

/** A wooden step ladder leaning against a wall: from its foot on the grass to where it rests. */
export function drawLadder(c: CanvasRenderingContext2D, foot: Pt, top: Pt) {
  const dx = top[0] - foot[0], dy = top[1] - foot[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * 0.2, ny = dx / L * 0.2;
  c.save(); c.lineCap = "round";
  c.strokeStyle = SHADOW; c.lineWidth = 0.08; c.beginPath(); c.moveTo(foot[0] + 0.15, foot[1] + 0.12); c.lineTo(foot[0] + dx * 0.4 + 0.15, foot[1] + dy * 0.4 + 0.12); c.stroke();
  c.strokeStyle = "#9a7a4a"; c.lineWidth = 0.06; c.beginPath();
  for (const s of [-1, 1]) { c.moveTo(foot[0] + nx * s, foot[1] + ny * s); c.lineTo(top[0] + nx * s * 0.8, top[1] + ny * s * 0.8); }
  for (let k = 1; k < 6; k++) { const u = k / 6, w = 1 - u * 0.2; c.moveTo(foot[0] + dx * u - nx * w, foot[1] + dy * u - ny * w); c.lineTo(foot[0] + dx * u + nx * w, foot[1] + dy * u + ny * w); }
  c.stroke(); c.restore();
}

// ── lawn games ──
/** A cornhole board flat on the grass: +x points at the other board (the low front end); the hole is near the back. */
export function drawCornhole(c: CanvasRenderingContext2D, x: number, y: number, a: number, col = "#2f6db5") {
  c.save(); c.translate(x, y); c.rotate(a);
  c.fillStyle = SHADOW; c.beginPath(); c.roundRect(-0.6 + 0.12, -0.33 + 0.16, 1.2, 0.66, 0.05); c.fill();
  c.fillStyle = "#d9b77a"; c.beginPath(); c.roundRect(-0.6, -0.31, 1.2, 0.62, 0.04); c.fill();
  c.fillStyle = col; c.fillRect(-0.6, -0.08, 1.2, 0.16);
  c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(-0.58, -0.29, 1.16, 0.08);
  c.strokeStyle = "#a78350"; c.lineWidth = 0.035; c.strokeRect(-0.6, -0.31, 1.2, 0.62);
  c.fillStyle = "#2a2018"; c.beginPath(); c.arc(-0.32, 0, 0.1, 0, 7); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.4)"; c.lineWidth = 0.02; c.beginPath(); c.arc(-0.32, 0, 0.11, 0, 7); c.stroke();
  c.restore();
}
export function drawBag(c: CanvasRenderingContext2D, x: number, y: number, a: number, col: string, lift = 0) {
  c.save(); c.translate(x, y);
  c.fillStyle = `rgba(20,40,10,${0.22 / (1 + lift * 3)})`; c.beginPath(); c.roundRect(-0.08 + 0.04 + lift * 0.5, -0.08 + 0.05 + lift * 0.6, 0.16, 0.16, 0.04); c.fill();
  c.translate(0, -lift); c.rotate(a); c.fillStyle = col; c.beginPath(); c.roundRect(-0.08, -0.08, 0.16, 0.16, 0.045); c.fill();
  c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 0.015; c.beginPath(); c.roundRect(-0.065, -0.065, 0.13, 0.13, 0.035); c.stroke();
  c.restore();
}
/** A ladder-ball ladder standing up (three rungs, a bola or two hanging), its base along x. */
export function drawLadderBall(c: CanvasRenderingContext2D, x: number, y: number, bolas: number[], t: number) {
  const W = 0.95, H = 1.15, up = (k: number) => y - H * k;
  c.save(); c.lineCap = "round";
  c.fillStyle = SHADOW; c.beginPath(); c.moveTo(x - W / 2, y); c.lineTo(x + W / 2, y); c.lineTo(x + W / 2 + 0.55, y + 0.35); c.lineTo(x - W / 2 + 0.55, y + 0.35); c.closePath(); c.fill();
  c.strokeStyle = "#e9ecef"; c.lineWidth = 0.08;
  c.beginPath(); for (const s of [-1, 1]) { c.moveTo(x + s * W / 2, y); c.lineTo(x + s * W / 2, up(1)); } c.moveTo(x - W / 2 - 0.15, y); c.lineTo(x - W / 2 + 0.15, y); c.moveTo(x + W / 2 - 0.15, y); c.lineTo(x + W / 2 + 0.15, y); c.stroke();
  const rungs = [0.38, 0.66, 0.94];
  c.strokeStyle = "#f3a01d"; c.lineWidth = 0.07; c.beginPath(); for (const k of rungs) { c.moveTo(x - W / 2, up(k)); c.lineTo(x + W / 2, up(k)); } c.stroke();
  c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 0.02; c.beginPath(); for (const s of [-1, 1]) { c.moveTo(x + s * W / 2 + 0.03, y); c.lineTo(x + s * W / 2 + 0.03, up(1)); } c.stroke();
  // bolas: two balls on a cord, wrapped over a rung
  bolas.forEach((r, i) => { const bx = x - 0.22 + i * 0.3, by = up(rungs[r]), sw = Math.sin(t * 2 + i) * 0.03; c.strokeStyle = "#333"; c.lineWidth = 0.015; c.beginPath(); c.moveTo(bx - 0.08 + sw, by + 0.2); c.lineTo(bx, by); c.lineTo(bx + 0.08 + sw, by + 0.2); c.stroke(); for (const s of [-1, 1]) { c.fillStyle = i % 2 ? "#2f6db5" : "#d23a2e"; c.beginPath(); c.arc(bx + s * 0.08 + sw, by + 0.22, 0.055, 0, 7); c.fill(); } });
  c.restore();
}
/** A bola lying on the grass. */
export function drawBola(c: CanvasRenderingContext2D, x: number, y: number, a: number, col: string) {
  c.save(); c.translate(x, y); c.rotate(a); c.strokeStyle = "#333"; c.lineWidth = 0.015; c.beginPath(); c.moveTo(-0.16, 0); c.lineTo(0.16, 0); c.stroke();
  for (const s of [-1, 1]) { c.fillStyle = col; c.beginPath(); c.arc(s * 0.16, 0, 0.055, 0, 7); c.fill(); c.fillStyle = "rgba(255,255,255,0.35)"; c.beginPath(); c.arc(s * 0.16 - 0.015, -0.015, 0.02, 0, 7); c.fill(); }
  c.restore();
}
/** The bocce court: a rectangle of short grass inside a low wooden border, along x. */
export function drawBocceCourt(c: CanvasRenderingContext2D, x: number, y: number, a: number, L: number, W: number) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.fillStyle = "rgba(20,40,10,0.18)"; c.fillRect(-L / 2 + 0.06, -W / 2 + 0.1, L, W);
  c.fillStyle = "rgba(190,225,130,0.35)"; c.fillRect(-L / 2, -W / 2, L, W);
  c.strokeStyle = "#a27c4c"; c.lineWidth = 0.14; c.strokeRect(-L / 2, -W / 2, L, W);
  c.strokeStyle = "rgba(255,240,210,0.4)"; c.lineWidth = 0.04; c.strokeRect(-L / 2 - 0.03, -W / 2 - 0.03, L, W);
  c.strokeStyle = "rgba(255,255,255,0.5)"; c.lineWidth = 0.03; c.setLineDash([0.15, 0.12]); c.beginPath(); c.moveTo(-L / 2 + 1, -W / 2); c.lineTo(-L / 2 + 1, W / 2); c.moveTo(L / 2 - 1, -W / 2); c.lineTo(L / 2 - 1, W / 2); c.stroke(); c.setLineDash([]);
  c.restore();
}
export function drawBall(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, lift = 0) {
  c.fillStyle = `rgba(20,40,10,${0.25 / (1 + lift * 2)})`; c.beginPath(); c.ellipse(x + 0.04 + lift * 0.4, y + 0.05 + lift * 0.5, r, r * 0.7, 0, 0, 7); c.fill();
  c.fillStyle = col; c.beginPath(); c.arc(x, y - lift, r, 0, 7); c.fill();
  c.fillStyle = "rgba(255,255,255,0.4)"; c.beginPath(); c.arc(x - r * 0.35, y - lift - r * 0.35, r * 0.35, 0, 7); c.fill();
}

// ── nets ──
/** A badminton net between two poles (the line between them runs east-west so the net shows). */
export function drawBadminton(c: CanvasRenderingContext2D, a: Pt, b: Pt, t: number, lines = true) {
  const H = 1.25, top = (p: Pt): Pt => [p[0], p[1] - H];
  c.save(); c.lineCap = "round";
  if (lines) { const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, L = Math.hypot(b[0] - a[0], b[1] - a[1]); c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 0.05; c.strokeRect(cx - L / 2 + 0.2, cy - 3.6, L - 0.4, 7.2); c.beginPath(); c.moveTo(cx - L / 2 + 0.2, cy - 1.4); c.lineTo(cx + L / 2 - 0.2, cy - 1.4); c.moveTo(cx - L / 2 + 0.2, cy + 1.4); c.lineTo(cx + L / 2 - 0.2, cy + 1.4); c.stroke(); }
  c.fillStyle = SHADOW; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(b[0] + 0.6, b[1] + 0.45); c.lineTo(a[0] + 0.6, a[1] + 0.45); c.closePath(); c.fill();
  // the net: a mesh band hanging from the top cord
  const ta = top(a), tb = top(b), sag = Math.sin(t * 1.3) * 0.02;
  c.fillStyle = "rgba(255,255,255,0.12)"; c.beginPath(); c.moveTo(ta[0], ta[1]); c.lineTo(tb[0], tb[1]); c.lineTo(tb[0], tb[1] + 0.5); c.lineTo(ta[0], ta[1] + 0.5); c.closePath(); c.fill();
  c.strokeStyle = "rgba(40,40,40,0.55)"; c.lineWidth = 0.015; c.beginPath();
  const L = Math.hypot(tb[0] - ta[0], tb[1] - ta[1]), n = Math.round(L / 0.12);
  for (let k = 0; k <= n; k++) { const u = k / n, px = ta[0] + (tb[0] - ta[0]) * u, py = ta[1] + (tb[1] - ta[1]) * u + Math.sin(u * Math.PI) * sag; c.moveTo(px, py); c.lineTo(px, py + 0.5); }
  for (let r = 0.1; r < 0.5; r += 0.1) { c.moveTo(ta[0], ta[1] + r); c.lineTo(tb[0], tb[1] + r); }
  c.stroke();
  c.strokeStyle = "#ffffff"; c.lineWidth = 0.05; c.beginPath(); c.moveTo(ta[0], ta[1]); c.lineTo(tb[0], tb[1]); c.stroke();
  for (const p of [a, b]) { c.strokeStyle = "#5d646b"; c.lineWidth = 0.07; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0], p[1] - H - 0.05); c.stroke(); c.fillStyle = "#3a3d42"; c.beginPath(); c.arc(p[0], p[1], 0.07, 0, 7); c.fill(); }
  c.restore();
}
/** A badminton pole lying on the grass (before it goes up). */
export function drawPole(c: CanvasRenderingContext2D, x: number, y: number, a: number) { c.save(); c.translate(x, y); c.rotate(a); c.strokeStyle = "#5d646b"; c.lineWidth = 0.07; c.lineCap = "round"; c.beginPath(); c.moveTo(-0.6, 0); c.lineTo(0.6, 0); c.stroke(); c.restore(); }
/** The soccer goal: two posts and a crossbar, the net running back behind. `fwd` is the way it faces. */
export function drawGoal(c: CanvasRenderingContext2D, x: number, y: number, fwd: number, t: number, ball?: Pt | null) {
  const W = 3.4, H = 1.5, D = 1.3, fx = Math.cos(fwd), fy = Math.sin(fwd), sx = -fy, sy = fx;
  const p1: Pt = [x + sx * W / 2, y + sy * W / 2], p2: Pt = [x - sx * W / 2, y - sy * W / 2], up = (p: Pt, k = 1): Pt => [p[0], p[1] - H * k];
  const b1: Pt = [p1[0] - fx * D, p1[1] - fy * D], b2: Pt = [p2[0] - fx * D, p2[1] - fy * D];
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  c.fillStyle = SHADOW; c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.lineTo(b2[0] + 0.5, b2[1] + 0.4); c.lineTo(b1[0] + 0.5, b1[1] + 0.4); c.closePath(); c.fill();
  // the net: from the crossbar back and down to the ground behind
  const t1 = up(p1), t2 = up(p2), m1 = up(b1, 0.35), m2 = up(b2, 0.35);
  c.fillStyle = "rgba(255,255,255,0.14)"; c.beginPath(); c.moveTo(t1[0], t1[1]); c.lineTo(t2[0], t2[1]); c.lineTo(m2[0], m2[1]); c.lineTo(b2[0], b2[1]); c.lineTo(b1[0], b1[1]); c.lineTo(m1[0], m1[1]); c.closePath(); c.fill();
  c.strokeStyle = "rgba(240,240,240,0.55)"; c.lineWidth = 0.014; c.beginPath();
  for (let k = 0; k <= 16; k++) { const u = k / 16, a0: Pt = [t1[0] + (t2[0] - t1[0]) * u, t1[1] + (t2[1] - t1[1]) * u], a1: Pt = [m1[0] + (m2[0] - m1[0]) * u, m1[1] + (m2[1] - m1[1]) * u], a2: Pt = [b1[0] + (b2[0] - b1[0]) * u, b1[1] + (b2[1] - b1[1]) * u]; c.moveTo(a0[0], a0[1]); c.lineTo(a1[0], a1[1]); c.lineTo(a2[0], a2[1]); }
  for (let k = 1; k < 6; k++) { const u = k / 6, q1: Pt = [t1[0] + (m1[0] - t1[0]) * u, t1[1] + (m1[1] - t1[1]) * u], q2: Pt = [t2[0] + (m2[0] - t2[0]) * u, t2[1] + (m2[1] - t2[1]) * u]; c.moveTo(q1[0], q1[1]); c.lineTo(q2[0], q2[1]); }
  c.stroke();
  void t;
  if (ball) drawSoccerBall(c, ball[0], ball[1], 0);
  // posts and crossbar
  c.strokeStyle = "rgba(0,0,0,0.3)"; c.lineWidth = 0.13; c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(t1[0], t1[1]); c.lineTo(t2[0], t2[1]); c.lineTo(p2[0], p2[1]); c.stroke();
  c.strokeStyle = "#ffffff"; c.lineWidth = 0.09; c.stroke();
  c.restore();
}
/** A shuttlecock in flight: the cork nose leading, the white skirt behind. */
export function drawShuttle(c: CanvasRenderingContext2D, x: number, y: number, a: number, lift: number) {
  c.fillStyle = "rgba(20,40,10,0.2)"; c.beginPath(); c.ellipse(x + lift * 0.4, y + lift * 0.5, 0.07, 0.05, 0, 0, 7); c.fill();
  c.save(); c.translate(x, y - lift); c.rotate(a); c.fillStyle = "#ffffff"; c.strokeStyle = "rgba(0,0,0,0.3)"; c.lineWidth = 0.012; c.beginPath(); c.moveTo(0.02, -0.03); c.lineTo(-0.13, -0.08); c.lineTo(-0.13, 0.08); c.lineTo(0.02, 0.03); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = "#e8b53a"; c.beginPath(); c.arc(0.04, 0, 0.04, 0, 7); c.fill(); c.restore();
}
export function drawSoccerBall(c: CanvasRenderingContext2D, x: number, y: number, lift: number) {
  drawBall(c, x, y, 0.13, "#ffffff", lift);
  c.fillStyle = "#222"; c.beginPath(); c.arc(x + 0.02, y - lift + 0.01, 0.045, 0, 7); c.fill();
  for (let k = 0; k < 5; k++) { const a = k * 1.256; c.beginPath(); c.arc(x + Math.cos(a) * 0.1, y - lift + Math.sin(a) * 0.1, 0.022, 0, 7); c.fill(); }
}

// ── the slip and slide ──
/** The slide along a line from (x, y) heading `a`, `len` metres of it rolled out; `wet` (0..1) makes it shine. */
export function drawSlide(c: CanvasRenderingContext2D, x: number, y: number, a: number, len: number, wet: number, t: number) {
  if (len <= 0.02) return;
  const W = 1.0;
  c.save(); c.translate(x, y); c.rotate(a);
  c.fillStyle = "rgba(20,40,10,0.18)"; c.fillRect(0.05, -W / 2 + 0.08, len, W);
  c.fillStyle = "#f6d43c"; c.fillRect(0, -W / 2, len, W);
  c.fillStyle = "#e8b928"; c.fillRect(0, -0.08, len, 0.16);
  for (const s of [-1, 1]) { c.fillStyle = "#2f7fd6"; c.fillRect(0, s * W / 2 - 0.09, len, 0.18); c.fillStyle = "rgba(255,255,255,0.35)"; c.fillRect(0, s * W / 2 - 0.07, len, 0.05); }
  c.fillStyle = "#2f7fd6"; c.fillRect(-0.08, -W / 2 - 0.02, 0.16, W + 0.04);   // the end bumper with the sprinkler holes
  if (wet > 0.01) {
    c.globalAlpha = wet;
    c.fillStyle = "rgba(120,190,240,0.35)"; c.fillRect(0, -W / 2 + 0.09, len, W - 0.18);   // a sheet of water over it
    const g = c.createLinearGradient(0, -W / 2, 0, W / 2); g.addColorStop(0, "rgba(255,255,255,0.1)"); g.addColorStop(0.35, "rgba(235,248,255,0.7)"); g.addColorStop(0.55, "rgba(190,230,255,0.25)"); g.addColorStop(1, "rgba(255,255,255,0.1)"); c.fillStyle = g; c.fillRect(0, -W / 2 + 0.1, len, W - 0.2);
    for (let k = 0; k < 9; k++) { const u = ((t * 0.35 + k / 9) % 1) * len; c.fillStyle = "rgba(255,255,255,0.75)"; c.fillRect(u, -0.3, 0.4, 0.05); c.fillRect(u + 0.35, 0.16, 0.28, 0.045); }
    for (let k = 0; k < 7; k++) { const tw = Math.max(0, Math.sin(t * 5 + k * 2.1)), px = ((k * 0.37) % 1) * len, py = (((k * 0.61) % 1) - 0.5) * 0.6; if (tw > 0.3) { c.strokeStyle = `rgba(255,255,255,${tw.toFixed(3)})`; c.lineWidth = 0.025; c.beginPath(); c.moveTo(px - 0.09 * tw, py); c.lineTo(px + 0.09 * tw, py); c.moveTo(px, py - 0.09 * tw); c.lineTo(px, py + 0.09 * tw); c.stroke(); } }   // glints
    // little jets of water along the side tube
    for (let k = 0; k < Math.floor(len / 0.9); k++) { const ph = (t * 1.6 + k * 0.37) % 1, px = 0.4 + k * 0.9; for (const s of [-1, 1]) { c.fillStyle = `rgba(200,235,255,${(0.8 * (1 - ph)).toFixed(3)})`; c.beginPath(); c.arc(px, s * (W / 2 - 0.05 - ph * 0.35), 0.035, 0, 7); c.fill(); } }
    // a puddle at the far end
    c.fillStyle = "rgba(150,195,220,0.45)"; c.beginPath(); c.ellipse(len + 0.55, 0, 0.6, 0.65, 0, 0, 7); c.fill();
    c.globalAlpha = 1;
  }
  c.restore();
}
/** The rolled-up slide (a fat yellow cylinder seen from above). */
export function drawSlideRoll(c: CanvasRenderingContext2D, x: number, y: number, a: number) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.fillStyle = SHADOW; c.beginPath(); c.roundRect(-0.15, -0.5, 0.4, 1.06, 0.12); c.fill();
  c.fillStyle = "#f6d43c"; c.beginPath(); c.roundRect(-0.2, -0.53, 0.4, 1.06, 0.14); c.fill();
  c.fillStyle = "#2f7fd6"; c.fillRect(-0.2, -0.53, 0.4, 0.14); c.fillRect(-0.2, 0.39, 0.4, 0.14);
  c.strokeStyle = "rgba(160,110,10,0.4)"; c.lineWidth = 0.02; for (const k of [-0.1, 0, 0.1]) { c.beginPath(); c.moveTo(k, -0.39); c.lineTo(k, 0.39); c.stroke(); }
  c.restore();
}
/** A green garden hose from a reel to the end of the slide. */
export function drawHose(c: CanvasRenderingContext2D, pts: Pt[], on: boolean) {
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  c.strokeStyle = SHADOW; c.lineWidth = 0.09; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0] + 0.06, p[1] + 0.07) : c.moveTo(p[0] + 0.06, p[1] + 0.07))); c.stroke();
  c.strokeStyle = "#2f8a3a"; c.lineWidth = 0.07; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.3)"; c.lineWidth = 0.02; c.stroke();
  const r = pts[0]; c.fillStyle = "#3a6d3a"; c.beginPath(); c.arc(r[0], r[1], 0.32, 0, 7); c.fill(); c.strokeStyle = "#2f8a3a"; c.lineWidth = 0.06; for (const k of [0.12, 0.2, 0.27]) { c.beginPath(); c.arc(r[0], r[1], k, 0, 7); c.stroke(); }
  c.fillStyle = on ? "#e3b23a" : "#9aa0a6"; c.beginPath(); c.arc(r[0], r[1], 0.07, 0, 7); c.fill();
  c.restore();
}

// ── the party: the tent, tables, string lights, folks ──
/** A white party tent from above: four panels up to a peak, scalloped edges, poles at the corners. */
export function drawTent(c: CanvasRenderingContext2D, x: number, y: number, w: number, d: number) {
  const hz = 1.0;   // the peak shows a little up the screen
  c.save(); c.translate(x, y);
  c.fillStyle = "rgba(20,40,10,0.2)"; c.fillRect(-w / 2 + 0.5, -d / 2 + 0.45, w, d);
  const A: Pt = [-w / 2, -d / 2 - 0.4], B: Pt = [w / 2, -d / 2 - 0.4], C: Pt = [w / 2, d / 2 - 0.4], D: Pt = [-w / 2, d / 2 - 0.4], P: Pt = [0, -hz];
  // poles peeking out under the corners
  c.strokeStyle = "#cfd3d7"; c.lineWidth = 0.08; for (const q of [A, B, C, D]) { c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(q[0], q[1] + 0.4); c.stroke(); }
  const panel = (p: Pt, q: Pt, col: string) => { c.fillStyle = col; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.lineTo(P[0], P[1]); c.closePath(); c.fill(); };
  panel(A, B, "#eef1f2"); panel(B, C, "#dfe3e6"); panel(C, D, "#e8ebed"); panel(D, A, "#fbfcfc");
  c.strokeStyle = "rgba(120,130,140,0.35)"; c.lineWidth = 0.03; c.beginPath(); for (const q of [A, B, C, D]) { c.moveTo(q[0], q[1]); c.lineTo(P[0], P[1]); } c.stroke();
  // the scalloped valance round the edge, with a blue stripe
  c.fillStyle = "#ffffff"; c.strokeStyle = "rgba(90,100,110,0.35)"; c.lineWidth = 0.025;
  const sc = (p: Pt, q: Pt) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(2, Math.round(L / 0.5)); for (let k = 0; k < n; k++) { const u0 = k / n, u1 = (k + 1) / n, m = (u0 + u1) / 2, mx = p[0] + (q[0] - p[0]) * m, my = p[1] + (q[1] - p[1]) * m; c.beginPath(); c.arc(mx, my, (L / n) / 2, 0, Math.PI); c.fill(); c.stroke(); } };
  sc(D, C);
  c.strokeStyle = "#4e8ad6"; c.lineWidth = 0.09; c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.lineTo(C[0], C[1]); c.lineTo(D[0], D[1]); c.closePath(); c.stroke();
  c.strokeStyle = INK; c.lineWidth = 0.04; c.stroke();
  c.fillStyle = "#cfd3d7"; c.beginPath(); c.arc(P[0], P[1], 0.09, 0, 7); c.fill();
  c.restore();
}
/** A picnic table with a checked cloth, benches either side, plates and a watermelon. Long side along x. */
export function drawTable(c: CanvasRenderingContext2D, x: number, y: number, a: number, seed = 1) {
  const r = mulberry32(seed);
  c.save(); c.translate(x, y); c.rotate(a);
  c.fillStyle = SHADOW; c.fillRect(-0.85 + 0.12, -0.75 + 0.14, 1.7, 1.5);
  for (const s of [-1, 1]) { c.fillStyle = "#9a7448"; c.fillRect(-0.85, s * 0.6 - 0.11, 1.7, 0.22); c.fillStyle = "rgba(255,255,255,0.12)"; c.fillRect(-0.85, s * 0.6 - 0.11, 1.7, 0.05); }
  c.fillStyle = "#ffffff"; c.fillRect(-0.9, -0.38, 1.8, 0.76);
  c.fillStyle = "rgba(214,58,50,0.85)"; for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) c.fillRect(-0.9 + i * 0.2, -0.38 + j * 0.19, 0.2, 0.19);
  for (let k = 0; k < 4; k++) { const px = -0.6 + k * 0.4, py = (k % 2 ? 0.2 : -0.2); c.fillStyle = "#f7f7f2"; c.beginPath(); c.arc(px, py, 0.1, 0, 7); c.fill(); c.strokeStyle = "rgba(0,0,0,0.15)"; c.lineWidth = 0.012; c.stroke(); c.fillStyle = ["#c9853a", "#7fb54a", "#e05a3a"][Math.floor(r() * 3)]; c.beginPath(); c.arc(px + 0.02, py, 0.045, 0, 7); c.fill(); }
  c.fillStyle = "#3f8a3a"; c.beginPath(); c.arc(0.05, 0, 0.16, Math.PI, 0); c.fill(); c.fillStyle = "#e8454a"; c.beginPath(); c.arc(0.05, 0, 0.13, Math.PI, 0); c.fill();
  c.restore();
}
/** String lights hung between posts: a sagging cord with warm bulbs (`on` lights them up). */
export function stringLightPts(pts: Pt[], sag = 0.35, every = 0.45): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.round(L / every)); for (let k = i === 1 ? 0 : 1; k <= n; k++) { const u = k / n; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + Math.sin(u * Math.PI) * sag - 1.2]); } }
  return out;
}
export function drawStringLights(c: CanvasRenderingContext2D, posts: Pt[], on: number, t: number) {
  const bulbs = stringLightPts(posts);
  c.save(); c.lineCap = "round";
  for (const p of posts) { c.strokeStyle = "#7a5a3a"; c.lineWidth = 0.08; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0], p[1] - 1.25); c.stroke(); }
  c.strokeStyle = "rgba(40,40,40,0.6)"; c.lineWidth = 0.02; c.beginPath(); bulbs.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke();
  bulbs.forEach((q, i) => { const tw = 0.85 + 0.15 * Math.sin(t * 2 + i * 1.7); c.fillStyle = on > 0.05 ? `rgba(255,${210 + (i % 3) * 15},${120 + (i % 2) * 40},${(0.55 + 0.45 * on * tw).toFixed(3)})` : "#e8e2cf"; c.beginPath(); c.arc(q[0], q[1] + 0.06, 0.06, 0, 7); c.fill(); });
  c.restore();
}

export type Guest = { shirt: string; hair: string; skin: string };
export const SHIRTS = ["#d9534f", "#4e8ad6", "#f0ad4e", "#6aa84f", "#9b6bd6", "#e07b9b", "#3fb3a8", "#f2c94c"], HAIRS = ["#3b2a20", "#c99a5b", "#1f1a17", "#7a4a2a", "#e3d3a8", "#5b3a29"], SKINS = ["#f1c7a3", "#d9a37c", "#a8714f", "#f5d0b3"];
export const guest = (i: number): Guest => ({ shirt: SHIRTS[i % SHIRTS.length], hair: HAIRS[(i * 3 + 1) % HAIRS.length], skin: SKINS[(i * 5 + 2) % SKINS.length] });
/** A kid sliding down the slip and slide on their tummy, arms out front. */
export function drawSlider(c: CanvasRenderingContext2D, x: number, y: number, a: number, g: Guest, t: number) {
  c.save(); c.translate(x, y); c.rotate(a); c.scale(1.4, 1.4);
  c.fillStyle = "rgba(255,255,255,0.6)"; for (const s of [-1, 1]) { c.beginPath(); c.arc(-0.55, s * 0.2, 0.05 + Math.abs(Math.sin(t * 7 + s)) * 0.04, 0, 7); c.fill(); }   // spray off the sides
  c.fillStyle = "rgba(20,40,10,0.15)"; c.beginPath(); c.ellipse(0.04, 0.05, 0.45, 0.16, 0, 0, 7); c.fill();
  c.fillStyle = "#3d5378"; c.beginPath(); c.roundRect(-0.48, -0.1, 0.26, 0.2, 0.06); c.fill();
  c.strokeStyle = g.skin; c.lineWidth = 0.06; c.lineCap = "round"; const k = Math.sin(t * 9) * 0.03; c.beginPath(); c.moveTo(-0.45, -0.05); c.lineTo(-0.62, -0.07 + k); c.moveTo(-0.45, 0.05); c.lineTo(-0.62, 0.07 - k); c.moveTo(0.05, -0.1); c.lineTo(0.38, -0.12); c.moveTo(0.05, 0.1); c.lineTo(0.38, 0.12); c.stroke();
  c.fillStyle = g.shirt; c.beginPath(); c.ellipse(-0.1, 0, 0.2, 0.13, 0, 0, 7); c.fill();
  c.fillStyle = g.skin; c.beginPath(); c.arc(0.17, 0, 0.085, 0, 7); c.fill(); c.fillStyle = g.hair; c.beginPath(); c.ellipse(0.15, 0, 0.075, 0.08, 0, 0, 7); c.fill();
  c.restore();
  void clamp;
}

// ── the hay wagon ──
/** A flat wagon with hay bales down both sides and kids sitting on them. Body centred on its axle; tongue out front. */
export const WAGON = { len: 2.6, wid: 1.5, tongue: 2.0 };
export function drawHayWagon(c: CanvasRenderingContext2D, x: number, y: number, a: number, kids: (Guest & { wave?: number })[], t: number, bob = 0) {
  const L = WAGON.len / 2, Wd = WAGON.wid / 2;
  c.save();
  c.fillStyle = SHADOW; c.beginPath(); c.roundRect(x - L + 0.25, y - Wd + 0.3, L * 2, Wd * 2, 0.15); c.fill();
  c.translate(x, y); c.rotate(a);
  c.strokeStyle = "#3b3f44"; c.lineWidth = 0.09; c.lineCap = "round"; c.beginPath(); c.moveTo(L - 0.1, -0.45); c.lineTo(WAGON.tongue, 0); c.lineTo(L - 0.1, 0.45); c.stroke();
  c.fillStyle = "#2a2d31"; c.beginPath(); c.arc(WAGON.tongue, 0, 0.08, 0, 7); c.fill();
  for (const wx of [-0.75, 0.75]) for (const s of [-1, 1]) { c.fillStyle = "#151515"; c.beginPath(); c.roundRect(wx - 0.28, s * (Wd + 0.02) - 0.11, 0.56, 0.22, 0.07); c.fill(); }
  c.fillStyle = "#8a5f38"; c.beginPath(); c.roundRect(-L, -Wd, L * 2, Wd * 2, 0.08); c.fill();
  c.strokeStyle = "rgba(60,35,15,0.4)"; c.lineWidth = 0.025; for (let k = -Wd + 0.19; k < Wd; k += 0.19) { c.beginPath(); c.moveTo(-L, k); c.lineTo(L, k); c.stroke(); }
  c.fillStyle = "rgba(255,255,255,0.1)"; c.fillRect(-L, -Wd, L * 2, 0.12);
  // hay bales along both sides
  for (const s of [-1, 1]) for (const bx of [-0.62, 0.62]) {
    c.fillStyle = "#d8b85a"; c.beginPath(); c.roundRect(bx - 0.58, s * (Wd - 0.27) - 0.24, 1.16, 0.48, 0.06); c.fill();
    c.strokeStyle = "rgba(150,110,30,0.5)"; c.lineWidth = 0.02; for (let k = -0.45; k < 0.5; k += 0.12) { c.beginPath(); c.moveTo(bx + k, s * (Wd - 0.27) - 0.22); c.lineTo(bx + k + 0.05, s * (Wd - 0.27) + 0.22); c.stroke(); }
    c.strokeStyle = "#8a6a3a"; c.lineWidth = 0.025; for (const k of [-0.3, 0.3]) { c.beginPath(); c.moveTo(bx + k, s * (Wd - 0.27) - 0.24); c.lineTo(bx + k, s * (Wd - 0.27) + 0.24); c.stroke(); }
  }
  // the kids: sitting on the bales facing in, two a side
  kids.slice(0, 4).forEach((g, i) => { const s = i % 2 ? 1 : -1, kx = i < 2 ? 0.55 : -0.6; c.save(); c.translate(kx, s * (Wd - 0.3) - bob * 0.04); drawPerson(c, 0, 0, -s * Math.PI / 2, g.shirt, g.hair, g.skin, "sit", t + i, 0.95); if (g.wave) { c.strokeStyle = g.skin; c.lineWidth = 0.06; c.lineCap = "round"; const wv = Math.sin(t * 10 + i) * 0.08; c.beginPath(); c.moveTo(0, 0); c.lineTo(0.12 + wv, s * -0.05 - 0.32); c.stroke(); } c.restore(); });
  c.restore();
}

// ── spots to set things up on ──
/** A dashed outline on the grass where something goes; it pulses when Pat can set it up from here. */
export function drawOutline(c: CanvasRenderingContext2D, pts: Pt[], t: number, ready: boolean) {
  const p = 0.5 + 0.5 * Math.sin(t * 4);
  c.save(); c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath();
  c.fillStyle = ready ? `rgba(255,214,64,${(0.16 + 0.12 * p).toFixed(3)})` : "rgba(255,255,255,0.14)"; c.fill();
  c.setLineDash([0.35, 0.25]); c.lineDashOffset = -t * 0.4; c.strokeStyle = ready ? `rgba(255,214,64,${(0.75 + 0.25 * p).toFixed(3)})` : "rgba(255,255,255,0.85)"; c.lineWidth = 0.1; c.stroke(); c.setLineDash([]);
  c.restore();
}
/** A round marker on the grass (the trim spots, the hose, the barn door). */
export function drawMarker(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, ready: boolean, col = "#ffffff") {
  const p = 0.5 + 0.5 * Math.sin(t * 4);
  c.save(); c.fillStyle = ready ? `rgba(255,214,64,${(0.18 + 0.12 * p).toFixed(3)})` : "rgba(255,255,255,0.18)"; c.beginPath(); c.arc(x, y, r + (ready ? 0.08 * p : 0), 0, 7); c.fill();
  c.setLineDash([0.3, 0.22]); c.lineDashOffset = -t * 0.4; c.strokeStyle = ready ? "rgba(255,214,64,0.95)" : col; c.lineWidth = 0.09; c.stroke(); c.setLineDash([]); c.restore();
}
/** A cardboard box of games, a bag, or a rolled net: what's riding in the cart. */
export function drawLoad(c: CanvasRenderingContext2D, kind: string, x: number, y: number, a: number) {
  if (kind.startsWith("stack:")) { kind.slice(6).split(",").forEach((k, i) => drawLoad(c, k, x - Math.sin(a) * 0.0 + Math.cos(a) * (i - 1) * 0.06, y + Math.sin(a) * (i - 1) * 0.06 - i * 0.07, a + (i - 1) * 0.15)); return; }   // an armful
  c.save(); c.translate(x, y); c.rotate(a);
  if (kind === "cornhole") { for (const k of [0, 1]) { c.fillStyle = k ? "#d9b77a" : "#c9a76a"; c.fillRect(-0.32 + k * 0.05, -0.22 - k * 0.05, 0.64, 0.4); c.fillStyle = "#2f6db5"; c.fillRect(-0.32 + k * 0.05, -0.05 - k * 0.05, 0.64, 0.08); } }
  else if (kind === "ladder") { c.strokeStyle = "#e9ecef"; c.lineWidth = 0.06; c.strokeRect(-0.35, -0.2, 0.7, 0.4); c.strokeStyle = "#f3a01d"; c.beginPath(); c.moveTo(-0.12, -0.2); c.lineTo(-0.12, 0.2); c.moveTo(0.12, -0.2); c.lineTo(0.12, 0.2); c.stroke(); }
  else if (kind === "bocce") { c.fillStyle = "#3f5a8a"; c.beginPath(); c.roundRect(-0.22, -0.16, 0.44, 0.32, 0.1); c.fill(); c.fillStyle = "#d23a2e"; c.beginPath(); c.arc(-0.07, -0.02, 0.07, 0, 7); c.fill(); c.fillStyle = "#3f9a4a"; c.beginPath(); c.arc(0.08, 0.03, 0.07, 0, 7); c.fill(); }
  else if (kind === "badminton") { c.strokeStyle = "#5d646b"; c.lineWidth = 0.06; c.beginPath(); c.moveTo(-0.45, -0.1); c.lineTo(0.45, -0.1); c.moveTo(-0.45, 0.05); c.lineTo(0.45, 0.05); c.stroke(); c.fillStyle = "#f2f2ee"; c.beginPath(); c.roundRect(-0.2, -0.05, 0.4, 0.22, 0.06); c.fill(); }
  else if (kind === "goal") { c.strokeStyle = "#ffffff"; c.lineWidth = 0.07; c.beginPath(); c.moveTo(-0.5, -0.15); c.lineTo(0.5, -0.15); c.moveTo(-0.5, 0.05); c.lineTo(0.5, 0.05); c.stroke(); c.fillStyle = "rgba(255,255,255,0.4)"; c.fillRect(-0.4, 0.08, 0.8, 0.14); }
  else if (kind === "slide") { drawSlideRoll(c, 0, 0, 0); }
  c.restore();
}

// ── the little pictures on the job cards ──
export type SummerCardKind = "paint" | "games" | "nets" | "party";
export const isSummerCard = (k: string): k is SummerCardKind => k === "paint" || k === "games" || k === "nets" || k === "party";
export function drawSummerCard(c: CanvasRenderingContext2D, kind: SummerCardKind, W: number, H: number, t: number, done = false) {
  c.save();
  for (let k = 0; k * 22 < W + 22; k++) { c.fillStyle = k % 2 ? "#7fbf4a" : "#71b23f"; c.fillRect(k * 22, 0, 22, H); }
  const dusk = kind === "party" && done;
  const S = Math.min(H / 2.9, W / 9.2); c.translate(W / 2, H / 2); c.scale(S, S);
  const paint = PAINTS.orange, VW = W / S;
  if (kind === "paint") {
    const L = 7.2, n = 24, coats = new Float32Array(n), wet = new Float32Array(n);
    for (let k = 0; k < n; k++) { coats[k] = done ? 1 : k < n * 0.55 ? 1 : k < n * 0.62 ? 0.5 : 0; wet[k] = !done && k > n * 0.4 && k < n * 0.6 ? 0.8 : 0; }
    const face: Face = { a: [-L / 2 - 0.4, 0.15], b: [L / 2 - 0.4, 0.15], coats, wet, trim: done ? 1 : 0, seed: 3, door: { s: L * 0.72, w: 1.9, h: 0.88 }, window: { s: L * 0.18, w: 0.6 }, corners: true };
    drawFace(c, face, [0, -1.4], 0.3);
    c.fillStyle = "#a5aaaf"; c.fillRect(face.a[0] - 0.2, -1.62, L + 0.4, 0.42); c.strokeStyle = "rgba(0,0,0,0.18)"; c.lineWidth = 0.035; for (let k = face.a[0]; k < face.b[0] + 0.2; k += 0.46) { c.beginPath(); c.moveTo(k, -1.62); c.lineTo(k, -1.2); c.stroke(); }
    c.strokeStyle = mix(TRIM_OLD, TRIM_NEW, done ? 1 : 0); c.lineWidth = 0.08; c.strokeRect(face.a[0] - 0.2, -1.62, L + 0.4, 0.42);   // the roof's edge above
    if (done) drawPat(c, L / 2 - 1.2, 0.85, Math.PI * 0.7, { walk: 0, wave: 1 }, t, 1.2);
    else { drawMower(c, -0.2, 1.0, Math.PI, 0, 0, t, true, 0.62, paint, false, false, {}); drawPaintRig(c, -0.2, 1.0, Math.PI, 1, 1, t); }
  } else if (kind === "games") {
    drawCornhole(c, -2.9, 0.3, 0); drawCornhole(c, 2.4, 0.3, Math.PI, "#c93a32");
    for (const [bx, by, col] of [[2.1, 0.2, "#d23a2e"], [2.55, 0.45, "#2f6db5"], [-2.6, 0.5, "#2f6db5"], [-3.3, 0.05, "#d23a2e"]] as const) drawBag(c, bx, by, bx, col);
    drawBag(c, -0.4 + Math.sin(t * 1.4) * 1.6, 0.0, t * 3, "#d23a2e", 0.35 + 0.3 * Math.cos(t * 1.4));
    drawLadderBall(c, 0.2, 1.1, [1], t);
    drawPat(c, done ? -1.3 : -1.6, 1.0, done ? -0.4 : 0.2, { walk: 0, carry: done ? null : "load", wave: done ? 1 : 0 }, t, 1.2);
    if (!done) drawLoad(c, "bocce", -1.0, 1.0, 0);
  } else if (kind === "nets") {
    drawSlide(c, -VW / 2 + 0.3, 0.6, 0, VW * 0.62, done ? 1 : 0.6, t);
    drawSlider(c, -VW / 2 + 1 + ((t * 1.3) % 1) * VW * 0.5, 0.6, 0, guest(2), t);
    drawBadminton(c, [VW * 0.12, 0.1], [VW / 2 - 0.3, 0.1], t, false);
    drawBall(c, VW * 0.3, -0.9, 0.05, "#ffffff", 0.2 + 0.2 * Math.sin(t * 2));
  } else {
    if (dusk) { c.fillStyle = "rgba(30,40,90,0.35)"; c.fillRect(-VW, -2, VW * 2, 4); }
    drawTent(c, -VW / 2 + 2.0, 0.6, 3.0, 2.4);
    drawStringLights(c, [[-VW / 2 + 0.3, 1.25], [-0.5, 1.15], [VW / 2 - 0.3, 1.25]], dusk ? 1 : 0.2, t);
    drawLinda(c, 0.3, 0.55, 0.15, t, done ? 0.5 + 0.5 * Math.sin(t) : 0, 1.25);
    drawPat(c, 1.35, 0.6, Math.PI * 0.95, { walk: 0, wave: done ? 1 : 0 }, t, 1.3);
    drawCat(c, { x: 2.5, y: 0.75, h: 2.6, act: done ? "nap" : "sit", phase: 0 }, t, 2.0, false);
    if (!done) drawFlag(c, VW / 2 - 0.8, 0.9, 0, t, "next", "");
    if (dusk) {   // the lights glowing in the dusk
      c.globalCompositeOperation = "lighter";
      for (const q of stringLightPts([[-VW / 2 + 0.3, 1.25], [-0.5, 1.15], [VW / 2 - 0.3, 1.25]])) { const g = c.createRadialGradient(q[0], q[1] + 0.06, 0, q[0], q[1] + 0.06, 0.3); g.addColorStop(0, "rgba(255,210,120,0.16)"); g.addColorStop(0.45, "rgba(255,210,120,0.06)"); g.addColorStop(1, "rgba(255,210,120,0)"); c.fillStyle = g; c.beginPath(); c.arc(q[0], q[1] + 0.06, 0.3, 0, 7); c.fill(); }   // (soft: the bulbs sit close, so the glows add up)
      c.globalCompositeOperation = "source-over";
    }
  }
  c.restore();
  void OBL; void add;
}
