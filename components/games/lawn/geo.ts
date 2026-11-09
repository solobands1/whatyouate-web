// Small geometry helpers for Pat's Lawnmower (world units are metres; x east, y south).
import type { Pt } from "../lawnMap";

export type Shape = { k: 0; pts: Pt[]; x0: number; y0: number; x1: number; y1: number } | { k: 1; x: number; y: number; r: number } | { k: 2; ax: number; ay: number; bx: number; by: number; r: number };

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const wrapA = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };

export function pip(pts: Pt[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function segClosest(ax: number, ay: number, bx: number, by: number, px: number, py: number): Pt {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
  return [ax + dx * t, ay + dy * t];
}
export function polyClosest(pts: Pt[], x: number, y: number): { c: Pt; d: number } {
  let best: Pt = pts[0], bd = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const c = segClosest(pts[j][0], pts[j][1], pts[i][0], pts[i][1], x, y), d = Math.hypot(x - c[0], y - c[1]);
    if (d < bd) { bd = d; best = c; }
  }
  return { c: best, d: bd };
}
export function polyShape(pts: Pt[]): Shape {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { k: 0, pts, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
/** Signed distance from a point to a shape (negative inside). */
export function sd(s: Shape, x: number, y: number) {
  if (s.k === 0) { const { d } = polyClosest(s.pts, x, y); return pip(s.pts, x, y) ? -d : d; }
  if (s.k === 1) return Math.hypot(x - s.x, y - s.y) - s.r;
  const c = segClosest(s.ax, s.ay, s.bx, s.by, x, y); return Math.hypot(x - c[0], y - c[1]) - s.r;
}
export function lineDist(pts: Pt[], x: number, y: number) { let d = Infinity; for (let i = 1; i < pts.length; i++) { const c = segClosest(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], x, y); d = Math.min(d, Math.hypot(x - c[0], y - c[1])); } return d; }
export function centroid(pts: Pt[]): Pt { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; }
export function area(pts: Pt[]) { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; return a / 2; }
export function bbox(pts: Pt[]) { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }; }
export function mulberry32(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
