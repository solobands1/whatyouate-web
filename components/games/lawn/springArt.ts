// The drawings for Chapter 5 (spring on the farm), in the same soft top-down style as ./art and ./fallArt: dandelions
// and their seed puffs, weeds and the little sprayer, the gravel pile and the dump cart, the nursery wagon, young maples,
// stakes, Pat's shovel and watering can, a robin, apple blossom, and the pictures on the job cards. World units are
// metres; each drawing's own frame has +x forward. Light from the top left, shadows down and to the right.
import type { Tree } from "../lawnMap";
import { mulberry32 } from "./geo";
import { drawMower } from "./art";
import { drawPat, drawCar, drawTire } from "./fallArt";
import { PAINTS } from "./jobs";

const SHADOW = "rgba(20,40,10,0.22)";

/** A spring wash over the ground: a touch brighter and fresher green (under everything standing on it). */
export function springWash(c: CanvasRenderingContext2D, cx: number, cy: number, vw: number, vh: number) {
  c.save(); c.globalCompositeOperation = "soft-light"; c.fillStyle = "rgba(190,255,110,0.2)"; c.fillRect(cx - vw / 2 - 2, cy - vh / 2 - 2, vw + 4, vh + 4); c.restore();
}

// ── dandelions ──
/** A dandelion from above: a rosette of toothed leaves and a yellow head, or (gone to seed) a white puff ball. */
export function drawDandelion(c: CanvasRenderingContext2D, x: number, y: number, seed: number, puff: boolean, t: number, glow = 0, k = 1) {
  const r = mulberry32(seed);
  c.save(); c.translate(x, y); c.scale(k, k);
  if (glow > 0) { c.fillStyle = `rgba(255,236,120,${(0.28 * glow).toFixed(3)})`; c.beginPath(); c.arc(0, 0, 0.55 + 0.08 * Math.sin(t * 5), 0, 7); c.fill(); }
  // the leaves, flat on the grass
  const n = 5 + Math.floor(r() * 3), a0 = r() * 7;
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * Math.PI * 2 + (r() - 0.5) * 0.4, L = 0.26 + r() * 0.1;
    c.save(); c.rotate(a); c.fillStyle = k % 2 ? "#3f8a2e" : "#4c9a36";
    c.beginPath(); c.moveTo(0, 0); for (let q = 1; q <= 4; q++) { const u = q / 4; c.lineTo(L * u - 0.03, 0.05 + 0.03 * (q % 2)); c.lineTo(L * u, 0.02); } c.lineTo(L + 0.03, 0); for (let q = 4; q >= 1; q--) { const u = q / 4; c.lineTo(L * u, -0.02); c.lineTo(L * u - 0.03, -0.05 - 0.03 * (q % 2)); } c.closePath(); c.fill();
    c.restore();
  }
  const sway = Math.sin(t * 2 + seed) * 0.015;
  if (!puff) {
    c.fillStyle = SHADOW; c.beginPath(); c.arc(0.04, 0.05, 0.11, 0, 7); c.fill();
    c.fillStyle = "#e9a90e"; c.beginPath(); c.arc(sway, 0, 0.115, 0, 7); c.fill();
    c.fillStyle = "#ffd21f"; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; c.beginPath(); c.ellipse(sway + Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0.045, 0.022, a, 0, 7); c.fill(); }
    c.fillStyle = "#ffe561"; c.beginPath(); c.arc(sway - 0.01, -0.01, 0.05, 0, 7); c.fill();
  } else {
    c.fillStyle = "rgba(20,40,10,0.16)"; c.beginPath(); c.arc(0.05, 0.06, 0.16, 0, 7); c.fill();
    c.fillStyle = "rgba(255,255,255,0.75)"; c.beginPath(); c.arc(sway, 0, 0.17, 0, 7); c.fill();
    c.strokeStyle = "rgba(200,205,195,0.9)"; c.lineWidth = 0.012; for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; c.beginPath(); c.moveTo(sway, 0); c.lineTo(sway + Math.cos(a) * 0.16, Math.sin(a) * 0.16); c.stroke(); }
    c.fillStyle = "#ffffff"; for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; c.beginPath(); c.arc(sway + Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.025, 0, 7); c.fill(); }
    c.fillStyle = "#c9bf9f"; c.beginPath(); c.arc(sway, 0, 0.035, 0, 7); c.fill();
  }
  c.restore();
}
/** One drifting seed: a tiny parachute. */
export function drawSeed(c: CanvasRenderingContext2D, x: number, y: number, a: number, alpha: number) {
  c.save(); c.globalAlpha = alpha; c.translate(x, y); c.rotate(a);
  c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineWidth = 0.012; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(0.07, k * 0.022); c.stroke(); }
  c.strokeStyle = "rgba(170,150,110,0.9)"; c.beginPath(); c.moveTo(0, 0); c.lineTo(-0.05, 0); c.stroke();
  c.restore();
}

// ── weeds ──
/** A weed clump from above: dark spiky leaves, with purple thistle flowers on some. `wilt` (0..1) browns it off. */
export function drawWeed(c: CanvasRenderingContext2D, x: number, y: number, rad: number, seed: number, wilt: number, t: number) {
  const r = mulberry32(seed), mix = (a: number[], b: number[]) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * wilt)},${Math.round(a[1] + (b[1] - a[1]) * wilt)},${Math.round(a[2] + (b[2] - a[2]) * wilt)})`;
  const dark = mix([34, 74, 34], [120, 92, 52]), mid = mix([52, 100, 46], [150, 118, 66]), purple = mix([150, 70, 170], [120, 96, 70]);
  c.save(); c.translate(x, y);
  c.fillStyle = "rgba(20,40,10,0.2)"; c.beginPath(); c.ellipse(rad * 0.15, rad * 0.2, rad * 1.05, rad * 0.95, 0, 0, 7); c.fill();
  const droop = 1 - 0.35 * wilt;
  for (let k = 0; k < 9; k++) {
    const a = r() * 7, L = rad * (0.7 + r() * 0.5) * droop, w = rad * 0.22;
    c.save(); c.rotate(a); c.fillStyle = k % 2 ? dark : mid;
    c.beginPath(); c.moveTo(0, -w * 0.4); c.lineTo(L * 0.35, -w); c.lineTo(L * 0.5, -w * 0.4); c.lineTo(L * 0.7, -w * 0.85); c.lineTo(L, 0); c.lineTo(L * 0.7, w * 0.85); c.lineTo(L * 0.5, w * 0.4); c.lineTo(L * 0.35, w); c.lineTo(0, w * 0.4); c.closePath(); c.fill();
    c.restore();
  }
  c.fillStyle = dark; c.beginPath(); c.arc(0, 0, rad * 0.3, 0, 7); c.fill();
  if (seed % 3 !== 0) for (let k = 0; k < 3; k++) {   // thistle heads
    const a = r() * 7, d = rad * (0.2 + r() * 0.35), fx = Math.cos(a) * d + Math.sin(t * 1.5 + seed + k) * 0.01, fy = Math.sin(a) * d;
    c.fillStyle = mix([70, 110, 60], [130, 104, 70]); c.beginPath(); c.arc(fx, fy, 0.075 * droop, 0, 7); c.fill();
    c.fillStyle = purple; c.beginPath(); c.arc(fx - 0.01, fy - 0.015, 0.055 * droop, 0, 7); c.fill();
  }
  c.restore();
}

// ── the sprayer ──
/** The little tow-behind sprayer: two wheels, a white poly tank (the spray level showing through), and a boom across
 *  the back with nozzles. Body centred on its axle, the tongue out front to the hitch. */
export function drawSprayer(c: CanvasRenderingContext2D, x: number, y: number, a: number, tongue: number, boom: number, level: number, on: boolean, t: number) {
  c.save();
  c.fillStyle = SHADOW; c.beginPath(); c.ellipse(x + 0.25, y + 0.3, 0.85, 0.65, a, 0, 7); c.fill();
  c.translate(x, y); c.rotate(a);
  c.strokeStyle = "#3b3f44"; c.lineWidth = 0.08; c.lineCap = "round"; c.beginPath(); c.moveTo(0.5, -0.3); c.lineTo(tongue, 0); c.lineTo(0.5, 0.3); c.stroke();
  c.fillStyle = "#2a2d31"; c.beginPath(); c.arc(tongue, 0, 0.07, 0, 7); c.fill();
  for (const s of [-1, 1]) { c.fillStyle = "#151515"; c.beginPath(); c.roundRect(-0.25, s * 0.55 - 0.09, 0.5, 0.18, 0.06); c.fill(); c.fillStyle = "#8d9399"; c.fillRect(-0.07, s * 0.55 - 0.04, 0.14, 0.08); }
  // the boom: a bar across the back with a nozzle every half metre
  c.strokeStyle = "#30353a"; c.lineWidth = 0.07; c.beginPath(); c.moveTo(-0.62, -boom); c.lineTo(-0.62, boom); c.stroke();
  c.strokeStyle = "#5d646b"; c.lineWidth = 0.035; c.beginPath(); c.moveTo(-0.62, -boom); c.lineTo(-0.3, -0.35); c.moveTo(-0.62, boom); c.lineTo(-0.3, 0.35); c.stroke();
  c.fillStyle = on ? "#3d8ad6" : "#c43d2e"; for (let o = -boom; o <= boom + 1e-6; o += boom / 3) { c.beginPath(); c.arc(-0.66, o, 0.045, 0, 7); c.fill(); }
  // the frame and the tank
  c.fillStyle = "#c43d2e"; c.beginPath(); c.roundRect(-0.6, -0.42, 1.1, 0.84, 0.1); c.fill();
  c.fillStyle = "#eef0ec"; c.beginPath(); c.ellipse(-0.04, 0, 0.5, 0.36, 0, 0, 7); c.fill();
  c.save(); c.beginPath(); c.ellipse(-0.04, 0, 0.47, 0.33, 0, 0, 7); c.clip();
  c.fillStyle = "rgba(90,150,210,0.45)"; c.fillRect(-0.51, 0.33 - 0.66 * Math.max(0, Math.min(1, level)), 0.94, 0.7); c.restore();
  c.strokeStyle = "rgba(60,60,60,0.35)"; c.lineWidth = 0.025; c.beginPath(); c.ellipse(-0.04, 0, 0.5, 0.36, 0, 0, 7); c.stroke();
  c.fillStyle = "rgba(255,255,255,0.6)"; c.beginPath(); c.ellipse(-0.16, -0.14, 0.18, 0.08, -0.2, 0, 7); c.fill();
  c.fillStyle = "#2a2d31"; c.beginPath(); c.arc(0.12, 0, 0.09, 0, 7); c.fill(); c.fillStyle = "#c9a227"; c.beginPath(); c.arc(0.12, 0, 0.055, 0, 7); c.fill();   // the filler cap
  if (on) { const p = 0.5 + 0.5 * Math.sin(t * 20); c.fillStyle = `rgba(160,210,255,${(0.25 + 0.1 * p).toFixed(3)})`; c.fillRect(-1.05, -boom - 0.1, 0.42, boom * 2 + 0.2); }
  c.restore();
}

// ── gravel ──
/** The gravel pile the truck dumped by the road: a heap of grey-tan stones that shrinks a little each load. */
export function drawGravelPile(c: CanvasRenderingContext2D, x: number, y: number, amount: number, seed: number) {
  const r = mulberry32(seed), R = 1.5 + amount * 0.9;
  c.save(); c.translate(x, y);
  c.fillStyle = "rgba(20,40,10,0.25)"; c.beginPath(); c.ellipse(0.35, 0.4, R * 1.05, R * 0.82, 0, 0, 7); c.fill();
  for (const [k, col] of [[1, "#9c9384"], [0.78, "#b0a796"], [0.55, "#c2b9a6"], [0.3, "#d2c9b5"]] as const) { c.fillStyle = col; c.beginPath(); for (let q = 0; q < 18; q++) { const a = (q / 18) * Math.PI * 2, rr = R * k * (0.9 + 0.12 * Math.sin(q * 2.3 + seed)); c.lineTo(Math.cos(a) * rr - k * 0.15, Math.sin(a) * rr * 0.86 - k * 0.2); } c.closePath(); c.fill(); }
  for (let k = 0; k < R * R * 26; k++) { const a = r() * 7, d = Math.sqrt(r()) * R * 0.95; c.fillStyle = ["#857c6e", "#e1d9c6", "#a59a88", "#6f685d"][Math.floor(r() * 4)]; c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d * 0.86, 0.03 + r() * 0.03, 0, 7); c.fill(); }
  c.restore();
}
/** Fresh gravel scattered over a spot (painted once onto the driveway layer). */
export function paintGravel(c: CanvasRenderingContext2D, rnd: () => number, x: number, y: number, r: number, n: number) {
  for (let k = 0; k < n; k++) { const a = rnd() * 7, d = Math.sqrt(rnd()) * r; c.fillStyle = ["#a69c8b", "#cfc6b2", "#8f877a", "#e0d8c5", "#b8ae9b"][Math.floor(rnd() * 5)]; c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.035 + rnd() * 0.035, 0, 7); c.fill(); }
}
/** The tipping dump cart: a deeper steel box with a heap of gravel inside (`load` 0..1). Centred on its axle. */
export function drawDumpCart(c: CanvasRenderingContext2D, x: number, y: number, a: number, tongue: number, load: number, spreading: boolean, t: number) {
  c.save();
  c.fillStyle = SHADOW; c.beginPath(); c.ellipse(x + 0.25, y + 0.3, 1.0, 0.75, a, 0, 7); c.fill();
  c.translate(x, y); c.rotate(a);
  c.strokeStyle = "#3b3f44"; c.lineWidth = 0.08; c.lineCap = "round"; c.beginPath(); c.moveTo(0.72, -0.4); c.lineTo(tongue, 0); c.lineTo(0.72, 0.4); c.stroke();
  c.fillStyle = "#2a2d31"; c.beginPath(); c.arc(tongue, 0, 0.07, 0, 7); c.fill();
  for (const s of [-1, 1]) { c.fillStyle = "#151515"; c.beginPath(); c.roundRect(-0.28, s * 0.64 - 0.11, 0.56, 0.22, 0.06); c.fill(); c.fillStyle = "#8d9399"; c.fillRect(-0.08, s * 0.64 - 0.05, 0.16, 0.1); }
  c.fillStyle = "#2f6a3a"; c.beginPath(); c.roundRect(-0.8, -0.58, 1.6, 1.16, 0.12); c.fill();
  c.fillStyle = "#3f8a4a"; c.beginPath(); c.roundRect(-0.72, -0.5, 1.44, 1.0, 0.08); c.fill();
  c.fillStyle = "#2a4f30"; c.beginPath(); c.roundRect(-0.66, -0.44, 1.32, 0.88, 0.06); c.fill();
  if (load > 0.01) {
    const r = mulberry32(17), R = 0.25 + 0.38 * Math.sqrt(load);
    c.fillStyle = "#b5ab98"; c.beginPath(); c.ellipse(0, 0, Math.min(0.64, R * 1.5), Math.min(0.42, R), 0, 0, 7); c.fill();
    for (let k = 0; k < 40 * load + 6; k++) { const aa = r() * 7, d = Math.sqrt(r()); c.fillStyle = ["#8f877a", "#d6cdb9", "#a39886"][k % 3]; c.beginPath(); c.arc(Math.cos(aa) * d * Math.min(0.6, R * 1.45), Math.sin(aa) * d * Math.min(0.4, R * 0.95), 0.035, 0, 7); c.fill(); }
  }
  // the spreader chute at the back, with stones falling when it's spreading
  c.fillStyle = "#22262a"; c.fillRect(-0.92, -0.5, 0.14, 1.0);
  if (spreading) { const r = mulberry32(Math.floor(t * 20)); for (let k = 0; k < 10; k++) { c.fillStyle = ["#a69c8b", "#d6cdb9"][k % 2]; c.beginPath(); c.arc(-1.0 - r() * 0.3, (r() - 0.5) * 1.6, 0.04, 0, 7); c.fill(); } }
  c.restore();
}
/** A muddy hole in the driveway (painted once): wet brown mud, a little puddle in the middle. */
export function paintMud(c: CanvasRenderingContext2D, rnd: () => number, x: number, y: number, rx: number, ry: number, rot: number) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = "#7a6248"; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, 7); c.fill();
  for (let k = 0; k < rx * ry * 40; k++) { const a = rnd() * 7, d = Math.sqrt(rnd()); c.fillStyle = rnd() < 0.5 ? "rgba(60,44,30,0.35)" : "rgba(150,125,95,0.35)"; c.beginPath(); c.arc(Math.cos(a) * d * rx, Math.sin(a) * d * ry, 0.05 + rnd() * 0.05, 0, 7); c.fill(); }
  c.fillStyle = "rgba(110,135,140,0.75)"; c.beginPath(); c.ellipse(rx * 0.1, -ry * 0.05, rx * 0.45, ry * 0.4, 0.3, 0, 7); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 0.04; c.beginPath(); c.ellipse(0, -ry * 0.12, rx * 0.25, ry * 0.18, 0.3, 3.6, 5.2); c.stroke();
  c.restore();
}

// ── trees ──
/** A young maple seen from above: a small round canopy of fresh light leaves (`s` its radius), on a stake. */
export function drawSapling(c: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, seed = 1) {
  const r = mulberry32(seed), sway = Math.sin(t * 1.4 + seed) * 0.02;
  c.save(); c.translate(x, y);
  c.fillStyle = "rgba(20,40,10,0.2)"; c.beginPath(); c.ellipse(s * 0.35, s * 0.4, s * 1.0, s * 0.85, 0, 0, 7); c.fill();
  c.fillStyle = "#4f8a34"; c.beginPath(); c.arc(sway, 0, s, 0, 7); c.fill();
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + r(), d = s * 0.55; c.fillStyle = k % 2 ? "#6aac45" : "#7fbf55"; c.beginPath(); c.arc(sway + Math.cos(a) * d, Math.sin(a) * d, s * 0.5, 0, 7); c.fill(); }
  c.fillStyle = "rgba(200,240,150,0.45)"; c.beginPath(); c.arc(sway - s * 0.3, -s * 0.3, s * 0.4, 0, 7); c.fill();
  c.restore();
}
/** A sapling in its black nursery pot (on the wagon, or carried). */
export function drawPotted(c: CanvasRenderingContext2D, x: number, y: number, t: number, seed: number, k = 1) {
  c.save(); c.translate(x, y); c.scale(k, k);
  c.fillStyle = "#1f2124"; c.beginPath(); c.arc(0, 0, 0.17, 0, 7); c.fill(); c.fillStyle = "#4a3a2c"; c.beginPath(); c.arc(0, 0, 0.13, 0, 7); c.fill();
  drawSapling(c, 0, -0.02, 0.28, t, seed);
  c.restore();
}
/** The little nursery wagon by the barn: a flat bed with potted maples on it (`n` left). */
export function drawNursery(c: CanvasRenderingContext2D, x: number, y: number, a: number, n: number, t: number) {
  c.save(); c.translate(x, y);
  c.fillStyle = SHADOW; c.beginPath(); c.ellipse(0.3, 0.35, 1.5, 0.9, a, 0, 7); c.fill();
  c.rotate(a);
  c.strokeStyle = "#2f3236"; c.lineWidth = 0.07; c.beginPath(); c.moveTo(1.2, 0); c.lineTo(1.75, 0); c.stroke(); c.beginPath(); c.arc(1.82, 0, 0.09, 0, 7); c.stroke();
  for (const [wx, s] of [[0.85, -1], [0.85, 1], [-0.85, -1], [-0.85, 1]] as const) { c.fillStyle = "#161616"; c.beginPath(); c.roundRect(wx - 0.18, s * 0.66 - 0.08, 0.36, 0.16, 0.05); c.fill(); }
  c.fillStyle = "#8a5a35"; c.beginPath(); c.roundRect(-1.2, -0.62, 2.4, 1.24, 0.08); c.fill();
  c.strokeStyle = "rgba(60,35,20,0.4)"; c.lineWidth = 0.03; for (let k = -1.0; k <= 1.0; k += 0.3) { c.beginPath(); c.moveTo(k, -0.6); c.lineTo(k, 0.6); c.stroke(); }
  c.strokeStyle = "#5e3c22"; c.lineWidth = 0.08; c.strokeRect(-1.2, -0.62, 2.4, 1.24);
  const spots: [number, number][] = [[-0.8, -0.3], [-0.8, 0.3], [-0.25, -0.3], [-0.25, 0.3], [0.3, -0.3], [0.3, 0.3], [0.85, 0]];
  for (let i = 0; i < Math.min(n, spots.length); i++) drawPotted(c, spots[i][0], spots[i][1], t, 30 + i);
  c.restore();
}
/** A planting stake: a wooden stake with an orange ribbon; `glow` rings it when Pat's close enough to plant there. */
export function drawStake(c: CanvasRenderingContext2D, x: number, y: number, t: number, glow: number) {
  c.save(); c.translate(x, y);
  if (glow > 0) { const p = 0.5 + 0.5 * Math.sin(t * 5); c.strokeStyle = `rgba(255,214,64,${(0.5 + 0.4 * p) * glow})`; c.lineWidth = 0.1; c.beginPath(); c.arc(0, 0, 0.75 + 0.1 * p, 0, 7); c.stroke(); }
  c.fillStyle = "rgba(20,40,10,0.25)"; c.beginPath(); c.ellipse(0.2, 0.25, 0.14, 0.08, 0.6, 0, 7); c.fill();
  c.fillStyle = "#6d5136"; c.beginPath(); c.arc(0, 0, 0.075, 0, 7); c.fill(); c.fillStyle = "#a07a52"; c.beginPath(); c.arc(-0.015, -0.015, 0.05, 0, 7); c.fill();
  const wv = Math.sin(t * 3 + x) * 0.05;
  c.fillStyle = "#f2762a"; c.beginPath(); c.moveTo(0.04, -0.02); c.quadraticCurveTo(0.25, -0.1 + wv, 0.42, -0.02 + wv); c.lineTo(0.38, 0.06 + wv); c.quadraticCurveTo(0.22, 0.0 + wv, 0.04, 0.04); c.closePath(); c.fill();
  c.restore();
}
/** A planted tree's fresh dirt ring, watered dark. */
export function drawMound(c: CanvasRenderingContext2D, x: number, y: number, wet: number) {
  c.save(); c.translate(x, y);
  c.fillStyle = "#6b4e33"; c.beginPath(); c.arc(0, 0, 0.6, 0, 7); c.fill();
  c.fillStyle = "#86644a"; c.beginPath(); c.arc(-0.08, -0.08, 0.42, 0, 7); c.fill();
  if (wet > 0) { c.fillStyle = `rgba(55,40,28,${(0.55 * wet).toFixed(3)})`; c.beginPath(); c.arc(0, 0, 0.5, 0, 7); c.fill(); }
  c.restore();
}

// ── Pat's tools (drawn in Pat's own frame, after drawPat: +x where he faces) ──
/** A shovel in Pat's hands. `dig` (0..1) pushes the blade down into the ground in front of him; `full` carries a scoop. */
export function drawShovel(c: CanvasRenderingContext2D, x: number, y: number, a: number, dig: number, full: "dirt" | "gravel" | null, size = 1.3) {
  c.save(); c.translate(x, y); c.rotate(a); c.scale(size, size);
  const reach = 0.42 + 0.22 * dig;
  c.strokeStyle = "#8a6a44"; c.lineWidth = 0.05; c.lineCap = "round"; c.beginPath(); c.moveTo(0.1, 0.05); c.lineTo(reach, 0.02); c.stroke();
  c.fillStyle = "#7d858d"; c.beginPath(); c.moveTo(reach - 0.02, -0.1); c.lineTo(reach + 0.2, -0.08); c.quadraticCurveTo(reach + 0.28, 0.02, reach + 0.2, 0.12); c.lineTo(reach - 0.02, 0.12); c.closePath(); c.fill();
  if (full) { c.fillStyle = full === "dirt" ? "#6b4e33" : "#b5ab98"; c.beginPath(); c.ellipse(reach + 0.1, 0.02, 0.1, 0.08, 0, 0, 7); c.fill(); }
  c.restore();
}
/** A green watering can in Pat's hands, tipped forward with a sprinkle when `pour` is on. */
export function drawCan(c: CanvasRenderingContext2D, x: number, y: number, a: number, pour: number, t: number, size = 1.3) {
  c.save(); c.translate(x, y); c.rotate(a); c.scale(size, size);
  c.fillStyle = "#3f8a4a"; c.beginPath(); c.roundRect(0.28, -0.12, 0.26, 0.24, 0.05); c.fill();
  c.strokeStyle = "#2f6a3a"; c.lineWidth = 0.035; c.beginPath(); c.moveTo(0.54, 0); c.lineTo(0.78, -0.02); c.stroke();
  c.fillStyle = "#2f6a3a"; c.beginPath(); c.arc(0.8, -0.02, 0.04, 0, 7); c.fill();
  if (pour > 0) { c.fillStyle = "rgba(140,195,240,0.85)"; const r = mulberry32(Math.floor(t * 18)); for (let k = 0; k < 8; k++) { c.beginPath(); c.arc(0.86 + r() * 0.25, (r() - 0.5) * 0.18, 0.018, 0, 7); c.fill(); } }
  c.restore();
}

// ── a robin and birds overhead ──
/** A robin from above: grey-brown back, the orange breast showing at the front, a little tail. `hop` lifts it. */
export function drawRobin(c: CanvasRenderingContext2D, x: number, y: number, a: number, hop: number, peck: number) {
  c.save(); c.translate(x, y);
  c.fillStyle = "rgba(20,40,10,0.22)"; c.beginPath(); c.ellipse(0.04 + hop * 0.08, 0.05 + hop * 0.1, 0.11, 0.08, a, 0, 7); c.fill();
  c.translate(0, -hop * 0.08); c.rotate(a); const S = 1.2; c.scale(S, S);
  c.fillStyle = "#4b4540"; c.beginPath(); c.moveTo(-0.08, 0); c.lineTo(-0.17, -0.035); c.lineTo(-0.17, 0.035); c.closePath(); c.fill();
  c.fillStyle = "#e0662c"; c.beginPath(); c.ellipse(0.02, 0, 0.075, 0.058, 0, 0, 7); c.fill();
  c.fillStyle = "#5e5650"; c.beginPath(); c.ellipse(-0.02, 0, 0.07, 0.05, 0, 0, 7); c.fill();
  c.fillStyle = "#2c2a28"; c.beginPath(); c.arc(0.065 + peck * 0.02, 0, 0.035, 0, 7); c.fill();
  c.fillStyle = "#f2b31d"; c.beginPath(); c.moveTo(0.095 + peck * 0.02, -0.01); c.lineTo(0.125 + peck * 0.03, 0); c.lineTo(0.095 + peck * 0.02, 0.01); c.closePath(); c.fill();
  c.fillStyle = "#ffffff"; c.beginPath(); c.arc(0.075 + peck * 0.02, -0.018, 0.007, 0, 7); c.arc(0.075 + peck * 0.02, 0.018, 0.007, 0, 7); c.fill();
  c.restore();
}
/** A small bird gliding overhead (screen space, pixels): wings flapping, its shadow off to the side. */
export function drawBirdScreen(c: CanvasRenderingContext2D, x: number, y: number, a: number, flap: number, s: number) {
  for (const [ox, oy, col] of [[s * 2.2, s * 2.6, "rgba(20,40,10,0.16)"], [0, 0, "#5a4a3c"]] as const) {
    c.save(); c.translate(x + ox, y + oy); c.rotate(a); c.fillStyle = col;
    const w = s * (0.6 + 0.4 * Math.abs(Math.sin(flap)));
    c.beginPath(); c.moveTo(s * 0.5, 0); c.quadraticCurveTo(0, -w * 0.4, -s * 0.2, -w); c.quadraticCurveTo(-s * 0.1, -w * 0.3, -s * 0.5, 0); c.quadraticCurveTo(-s * 0.1, w * 0.3, -s * 0.2, w); c.quadraticCurveTo(0, w * 0.4, s * 0.5, 0); c.fill();
    c.restore();
  }
}

// ── spring trees ──
/** Over the engine's tree: apple trees in pink and white blossom, other trees a touch of fresh new leaf. */
export function drawBlossom(c: CanvasRenderingContext2D, t: Tree, blobs: number[][], alpha: number, time: number) {
  if (t.kind === "spruce" || t.kind === "well") return;
  const sway = Math.sin(time * 0.8 + t.x) * 0.03 * t.r;
  c.save(); c.globalAlpha = alpha; c.translate(t.x, t.y);
  if (t.kind === "fruit") {
    const r = mulberry32(Math.round(t.x * 13 + t.y * 7));
    for (const [bx, by, br] of blobs) { c.fillStyle = "rgba(250,214,226,0.75)"; c.beginPath(); c.arc(bx * t.r + sway, by * t.r, br * t.r * 0.92, 0, 7); c.fill(); }
    c.fillStyle = "rgba(250,214,226,0.6)"; c.beginPath(); c.arc(sway * 0.5, 0, t.r * 0.8, 0, 7); c.fill();
    const n = Math.round(t.r * t.r * 70);
    for (let k = 0; k < n; k++) { const a = r() * 7, d = Math.sqrt(r()) * t.r * 0.98; c.fillStyle = ["#ffffff", "#f7c6d6", "#ee9fbb", "#fff0f5"][Math.floor(r() * 4)]; c.beginPath(); c.arc(Math.cos(a) * d + sway, Math.sin(a) * d, 0.07 + r() * 0.05, 0, 7); c.fill(); }
    for (let k = 0; k < n * 0.15; k++) { const a = r() * 7, d = Math.sqrt(r()) * t.r * 0.95; c.fillStyle = "rgba(110,170,70,0.7)"; c.beginPath(); c.arc(Math.cos(a) * d + sway, Math.sin(a) * d, 0.06, 0, 7); c.fill(); }
  } else {
    c.fillStyle = "rgba(190,235,120,0.16)"; for (const [bx, by, br] of blobs) { c.beginPath(); c.arc(bx * t.r + sway, by * t.r, br * t.r, 0, 7); c.fill(); }
  }
  c.restore();
}
/** Petals blown under an apple tree (painted once onto the grass). */
export function paintPetals(c: CanvasRenderingContext2D, rnd: () => number, x: number, y: number, r: number, n: number) {
  for (let k = 0; k < n; k++) { const a = rnd() * 7, d = Math.sqrt(rnd()) * r; c.fillStyle = ["#ffffff", "#f7c6d6", "#f3b0c6"][Math.floor(rnd() * 3)]; c.beginPath(); c.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.07, 0.045, rnd() * 3, 0, 7); c.fill(); }
}

// ── the job cards ──
export type SpringCardKind = "dandelions" | "spray" | "gravel" | "trees" | "gas";
export function drawSpringCard(c: CanvasRenderingContext2D, kind: SpringCardKind, W: number, H: number, t: number, done: boolean) {
  c.save();
  for (let k = 0; k * 22 < W + 22; k++) { c.fillStyle = k % 2 ? "#9ccd62" : "#8cc152"; c.fillRect(k * 22, 0, 22, H); }
  const S = Math.min(H / 2.9, W / 9.2); c.translate(W / 2, H / 2); c.scale(S, S);
  const r = mulberry32(kind.length * 31), hw = W / S / 2, paint = PAINTS.orange;
  if (kind === "dandelions") {
    c.fillStyle = "#9fd06a"; c.fillRect(-hw, -1.0, hw + 0.2, 2.0);   // the strip he's mowed
    for (let k = 0; k < 26; k++) { const x = 0.9 + r() * (hw - 0.6), y = (r() - 0.5) * 2.6; drawDandelion(c, x, y, 40 + k, k % 6 === 0, t); }
    if (done) for (let k = 0; k < 10; k++) { const u = (t * 0.25 + k / 10) % 1; drawSeedCard(c, -hw + u * hw * 2, -1.1 + Math.sin(u * 9 + k) * 0.3, u); }
    drawMower(c, 0, 0, 0, 0, 0, t, true, 1.7, paint, false, false, { wave: done ? 1 : 0 });
  } else if (kind === "spray") {
    for (let k = 0; k < 7; k++) drawWeed(c, -hw + 0.8 + k * 1.1, 0.95 + (k % 2) * 0.25, 0.32, 20 + k, done || -hw + 0.8 + k * 1.1 < -2.2 ? 1 : 0, t);
    c.fillStyle = "#6b4a31"; c.beginPath(); c.roundRect(hw - 2.6, -1.35, 2.4, 0.75, 0.1); c.fill();
    const fl = ["#e8758a", "#f2c84b", "#a77fd6", "#ffffff"]; for (let k = 0; k < 14; k++) { c.fillStyle = "#4a8a33"; const fx = hw - 2.45 + (k % 7) * 0.33, fy = -1.15 + Math.floor(k / 7) * 0.32; c.beginPath(); c.arc(fx, fy, 0.14, 0, 7); c.fill(); c.fillStyle = fl[k % 4]; c.beginPath(); c.arc(fx, fy, 0.07, 0, 7); c.fill(); }
    drawSprayer(c, -2.7, 0.1, 0, 1.55, 1.3, done ? 0.35 : 0.8, !done, t);
    drawMower(c, -0.2, 0.1, 0, 0, 0, t, true, 0.62, paint, false, false, { wave: done ? 1 : 0 });
  } else if (kind === "gravel") {
    c.fillStyle = "#c4b89f"; c.fillRect(-hw, -0.95, hw * 2, 1.9);
    const rg = mulberry32(3); if (!done) { paintMud(c, rg, 1.7, 0.1, 0.9, 0.6, 0.2); paintMud(c, rg, 3.4, -0.3, 0.7, 0.5, -0.4); }
    paintGravel(c, mulberry32(5), -hw / 2, 0, hw / 2, 160); if (done) paintGravel(c, mulberry32(6), hw / 2, 0, hw / 2, 160);
    drawGravelPile(c, -hw + 1.0, -1.1, 0.4, 3);
    drawDumpCart(c, -2.4, 0.05, 0, 1.55, done ? 0 : 0.8, !done, t);
    drawMower(c, 0.2, 0.05, 0, 0, 0, t, true, 0.62, paint, false, false, { wave: done ? 1 : 0 });
  } else if (kind === "gas") {
    c.fillStyle = "#5f6266"; c.fillRect(-hw, -0.9, hw * 2, 1.8); c.strokeStyle = "#e5c24c"; c.lineWidth = 0.08; c.setLineDash([0.9, 1.4]); c.beginPath(); c.moveTo(-hw, 0.95); c.lineTo(hw, 0.95); c.stroke(); c.setLineDash([]);
    drawCar(c, -0.9, 0, 0, 0, { t });
    if (done) { drawGasCan(c, -2.75, -0.45, 0, 1); drawGasCan(c, -2.75, 0.45, 0, 1); drawPat(c, 2.6, 0.2, Math.PI, { walk: 0, wave: 1 }, t, 1.3); }
    else { drawTire(c, 2.0, 1.15, 0.3, t); drawPat(c, 2.8, -0.1, Math.PI * 0.9, { walk: 0 }, t, 1.3); drawGasCan(c, 3.6, 0.6, 0.4, 0); drawGasCan(c, 3.95, 1.05, -0.2, 0); }
  } else {
    for (let k = 0; k < 5; k++) { const x = -hw + 1.2 + k * 1.6; if (done || k < 2) { drawMound(c, x, -0.9, 1); drawSapling(c, x, -0.95, 0.42, t, 50 + k); } else drawStake(c, x, -0.9, t, 0); }
    drawNursery(c, -2.6, 0.75, 0, done ? 0 : 3, t);
    drawPat(c, 1.0, 0.55, -1.2, { walk: 0, bend: 0.3, wave: done ? 1 : 0 }, t, 1.3);
    drawShovel(c, 1.0, 0.55, -1.2, done ? 0 : 0.5 + 0.5 * Math.sin(t * 3), null);
  }
  c.restore();
}
function drawSeedCard(c: CanvasRenderingContext2D, x: number, y: number, u: number) { drawSeed(c, x, y, u * 6, Math.sin(u * Math.PI)); }

/** A red plastic gas can from above: the body, the handle on top and the yellow spout (`full` shines it up a little). */
export function drawGasCan(c: CanvasRenderingContext2D, x: number, y: number, a: number, full: number, k = 1) {
  c.save(); c.translate(x, y); c.rotate(a); c.scale(k, k);
  c.fillStyle = "rgba(20,40,10,0.25)"; c.beginPath(); c.roundRect(-0.2, -0.13, 0.48, 0.34, 0.06); c.fill();
  c.fillStyle = "#c8281f"; c.beginPath(); c.roundRect(-0.25, -0.17, 0.48, 0.34, 0.06); c.fill();
  c.fillStyle = "rgba(255,255,255,0.18)"; c.beginPath(); c.roundRect(-0.22, -0.14, 0.42, 0.1, 0.04); c.fill();
  c.strokeStyle = "#8e1b15"; c.lineWidth = 0.05; c.beginPath(); c.moveTo(-0.15, 0); c.lineTo(0.08, 0); c.stroke();
  c.fillStyle = "#f2c21d"; c.beginPath(); c.moveTo(0.18, -0.12); c.lineTo(0.34, -0.2); c.lineTo(0.37, -0.15); c.lineTo(0.22, -0.06); c.closePath(); c.fill();
  if (full) { c.fillStyle = "rgba(255,240,200,0.3)"; c.beginPath(); c.arc(-0.1, -0.06, 0.06, 0, 7); c.fill(); }
  c.restore();
}
