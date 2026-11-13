// Small canvas helpers for Kitchen Golf's drawings: shapes, gradients, colours, and the few lighting tricks every prop
// shares (light comes from the top left, so shadows and soft contact halos fall down and to the right).
import { type Pt } from "./sim";

export type C = CanvasRenderingContext2D;
export type Imgs = Record<string, HTMLImageElement>;
export type Rnd = () => number;
export const TAU = Math.PI * 2;

export function poly(c: C, p: Pt[]) { c.beginPath(); p.forEach(([x, y], i) => { if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.closePath(); }
export function rr(c: C, x: number, y: number, w: number, h: number, r: number | number[]) { c.beginPath(); c.roundRect(x, y, w, h, r); }
export function circ(c: C, x: number, y: number, r: number) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
export function ell(c: C, x: number, y: number, rx: number, ry: number, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); }
export function line(c: C, x0: number, y0: number, x1: number, y1: number) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
export function lin(c: C, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, s]) => g.addColorStop(o, s)); return g; }
export function rad(c: C, x: number, y: number, r0: number, r1: number, stops: [number, string][], fx = x, fy = y) { const g = c.createRadialGradient(fx, fy, r0, x, y, r1); stops.forEach(([o, s]) => g.addColorStop(o, s)); return g; }

// canvas shadows are measured in device pixels, not board units, so they're scaled to match the drawing
export function scaleOf(c: C) { const m = c.getTransform(); return Math.hypot(m.a, m.b) || 1; }
export function shade(c: C, blur: number, ox: number, oy: number, col: string) { const k = scaleOf(c); c.shadowColor = col; c.shadowBlur = blur * k; c.shadowOffsetX = ox * k; c.shadowOffsetY = oy * k; }
export function noShade(c: C) { c.shadowColor = "transparent"; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; }

const rgbOf = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hex = (v: number[]) => `#${v.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("")}`;
/** Between two #rrggbb colours (the answer is #rrggbb too, so it can be mixed again). */
export function mix(a: string, b: string, t: number) { const p = rgbOf(a), q = rgbOf(b); return hex(p.map((v, i) => v + (q[i] - v) * t)); }
export const lighter = (h: string, t: number) => mix(h, "#ffffff", t);
export const darker = (h: string, t: number) => mix(h, "#000000", t);
export const rgba = (h: string, a: number) => `rgba(${rgbOf(h).join(",")},${a})`;

export const bbox = (p: Pt[]) => { const xs = p.map(q => q[0]), ys = p.map(q => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
export function img(c: C, imgs: Imgs, code: string | undefined, x: number, y: number, s: number, rot = 0) {
  const im = code ? imgs[code] : undefined; if (!im || !im.complete || !im.naturalWidth) return;
  c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.drawImage(im, -s / 2, -s / 2, s, s); c.restore();
}
/** +1 or -1 by which way a polygon winds, so its outward side is known. */
export const signOf = (p: Pt[]) => { let a = 0; for (let i = 0; i < p.length; i++) { const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length]; a += x0 * y1 - x1 * y0; } return a > 0 ? 1 : -1; };
/** A polygon grown outward by d, sharp corners kept (fine while d is under half the narrowest gap). */
export function grow(p: Pt[], d: number): Pt[] {
  const n = p.length, sg = signOf(p);
  const L = p.map((a, i) => { const b = p[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [a[0] + (sg * dy / l) * d, a[1] + (-sg * dx / l) * d, dx / l, dy / l]; });
  return L.map((q, i) => {
    const [px, py, ux, uy] = L[(i - 1 + n) % n], [qx, qy, vx, vy] = q, den = ux * vy - uy * vx;
    if (Math.abs(den) < 1e-6) return [qx, qy] as Pt;
    const t = ((qx - px) * vy - (qy - py) * vx) / den; return [px + ux * t, py + uy * t] as Pt;
  });
}

// ── light and shadow ──
// The surface under everything tints its shadows (warm wood, cool steel...); the place sets it before painting.
let TINT = "48,22,4";
export const setTint = (t: string) => { TINT = t; };
export const tint = (a: number) => `rgba(${TINT},${a})`;
/** A soft dark halo where something round sits on the surface, a little down and right of it. */
export function ao(c: C, x: number, y: number, r: number, a = 0.5) {
  const cx = x + r * 0.1, cy = y + r * 0.16;
  c.fillStyle = rad(c, cx, cy, r * 0.55, r * 1.42, [[0, tint(a)], [0.45, tint(a * 0.45)], [1, tint(0)]]); circ(c, cx, cy, r * 1.42); c.fill();
}
/** A soft halo and drop shadow under a box (its body, drawn next, covers the solid middle). */
export function aoBox(c: C, x: number, y: number, w: number, h: number, r: number, a = 0.5, spread = 7) {
  shade(c, spread, spread * 0.3, spread * 0.55, tint(a)); c.fillStyle = tint(a); rr(c, x + 0.5, y + 0.5, w - 1, h - 1, r); c.fill(); noShade(c);
}
/** Drop shadow for the next fill. */
export const drop = (c: C, blur = 7, ox = 2.6, oy = 4.6, a = 0.42) => shade(c, blur, ox, oy, tint(a));
/** A box lit from the top left: a sheen across it, a bright top and left edge, a darker bottom and right edge. */
export function bevel(c: C, x0: number, y0: number, w: number, h: number, r: number, k = 1) {
  c.save(); rr(c, x0, y0, w, h, r); c.clip();
  c.fillStyle = lin(c, x0, y0, x0 + w, y0 + h, [[0, `rgba(255,255,255,${0.22 * k})`], [0.5, "rgba(255,255,255,0)"], [1, `rgba(0,0,0,${0.18 * k})`]]); c.fillRect(x0, y0, w, h);
  c.lineWidth = 2.2;
  c.strokeStyle = `rgba(255,255,255,${0.5 * k})`; c.beginPath(); c.moveTo(x0 + 1, y0 + h - r); c.lineTo(x0 + 1, y0 + 1); c.lineTo(x0 + w - r, y0 + 1); c.stroke();
  c.strokeStyle = `rgba(0,0,0,${0.25 * k})`; c.beginPath(); c.moveTo(x0 + r, y0 + h - 1); c.lineTo(x0 + w - 1, y0 + h - 1); c.lineTo(x0 + w - 1, y0 + r); c.stroke();
  c.restore();
}
/** A soft specular spot (glaze, glass, chrome), tilted toward the light. */
export function gloss(c: C, x: number, y: number, rx: number, ry: number, a = 0.85) {
  c.fillStyle = rad(c, x, y, 0, rx, [[0, `rgba(255,255,255,${a})`], [0.55, `rgba(255,255,255,${a * 0.35})`], [1, "rgba(255,255,255,0)"]]); ell(c, x, y, rx, ry, -0.7); c.fill();
}
/** A bright arc on the top-left edge of something round, and (optionally) a soft one bottom right. */
export function rimArc(c: C, x: number, y: number, r: number, w: number, a = 0.95, back = 0) {
  c.lineCap = "round"; c.lineWidth = w;
  c.strokeStyle = `rgba(255,255,255,${a})`; c.beginPath(); c.arc(x, y, r, Math.PI * 1.02, Math.PI * 1.44); c.stroke();
  if (back) { c.strokeStyle = `rgba(255,255,255,${back})`; c.beginPath(); c.arc(x, y, r, Math.PI * 0.08, Math.PI * 0.42); c.stroke(); }
}
/** A round glazed or painted body: drop shadow, lit from the top left, a crisp darker edge. */
export function orb(c: C, x: number, y: number, r: number, col: string, k = 1) {
  drop(c); c.fillStyle = darker(col, 0.2); circ(c, x, y, r); c.fill(); noShade(c);
  c.fillStyle = lin(c, x - r, y - r, x + r, y + r, [[0, lighter(col, 0.35 * k)], [0.5, col], [1, darker(col, 0.32 * k)]]); circ(c, x, y, r); c.fill();
  c.strokeStyle = rgba(darker(col, 0.5), 0.6); c.lineWidth = 0.8; circ(c, x, y, r - 0.4); c.stroke();
}
export const STEEL: [number, string][] = [[0, "#7b8591"], [0.28, "#f6f8fb"], [0.5, "#c3cbd4"], [0.72, "#e3e8ee"], [1, "#68727e"]];
/** A round steel body (pots, bowls, lids): brushed, bright on the top left, with a crisp rim. */
export function steelDisc(c: C, x: number, y: number, r: number, dark = false) {
  c.fillStyle = lin(c, x - r, y - r, x + r, y + r, dark ? [[0, "#c9d0d8"], [0.45, "#8e98a4"], [1, "#4b545e"]] : [[0, "#ffffff"], [0.35, "#dfe4ea"], [0.65, "#a9b2bc"], [1, "#6c7682"]]); circ(c, x, y, r); c.fill();
  c.strokeStyle = "rgba(40,48,58,0.55)"; c.lineWidth = 0.8; circ(c, x, y, r - 0.4); c.stroke();
}
