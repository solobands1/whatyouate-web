// Pea Tanks art helpers: soft shadows painted once (a shape seen only through its blurred shadow), a sprite store that
// keeps more pictures than the shared one (the lunchboxes keep a few dozen each), and the 2.5D "hull" trick that gives
// boxes, mugs and lunchboxes a hint of their side toward the bottom right, away from the top-left light.
import { type C, layer, scaleOf } from "../art2/paint";

/** Paints only the blurred shadow of whatever `draw` fills or strokes: the shape itself lands far off the canvas.
 *  For static layers (it costs a blur), never per frame. `ox`, `oy` move the shadow, in board units. */
export function soft(g: C, blur: number, col: string, draw: () => void, ox = 0, oy = 0) {
  const k = scaleOf(g), D = 3000;
  g.save(); g.translate(-D, 0);
  g.shadowColor = col; g.shadowBlur = blur * k; g.shadowOffsetX = (D + ox) * k; g.shadowOffsetY = oy * k;
  g.fillStyle = "#000"; g.strokeStyle = "#000";
  draw();
  g.restore();
}

export type Sprite = { cv: HTMLCanvasElement; w: number; h: number; ox: number; oy: number };
const store = new Map<string, Sprite>();
/** A picture painted once at this pixel density, `w` by `h` board units with its origin at (ox, oy). */
export function sprite(key: string, k: number, w: number, h: number, ox: number, oy: number, paint: (c: C) => void): Sprite {
  const id = `${key}@${k.toFixed(3)}`;
  let s = store.get(id);
  if (!s) {
    const L = layer(w, h, k); L.c.translate(ox, oy); paint(L.c);
    s = { cv: L.cv, w: L.cv.width / k, h: L.cv.height / k, ox, oy };
    if (store.size > 480) { let n = 0; for (const key2 of store.keys()) { store.delete(key2); if (++n >= 120) break; } }   // forget the oldest
    store.set(id, s);
  }
  return s;
}
export const stamp = (g: C, s: Sprite, x = 0, y = 0) => g.drawImage(s.cv, x - s.ox, y - s.oy, s.w, s.h);

/** Two circles and the band between them: a round thing's top and the foot it stands on, as one outline. */
export function capsule(g: C, x0: number, y0: number, x1: number, y1: number, r: number) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, a = Math.atan2(dy, dx);
  g.beginPath();
  if (l < 0.01) { g.arc(x0, y0, r, 0, Math.PI * 2); return; }
  g.arc(x1, y1, r, a - Math.PI / 2, a + Math.PI / 2);
  g.arc(x0, y0, r, a + Math.PI / 2, a + Math.PI * 1.5);
  g.closePath();
}
/** The outline of a box `w` by `h` lifted `d` up and left: the top face plus the two side faces showing below it. */
export function boxHull(g: C, x0: number, y0: number, w: number, h: number, d: number) {
  const tw = w - d, th = h - d;
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + tw, y0); g.lineTo(x0 + w, y0 + d); g.lineTo(x0 + w, y0 + h); g.lineTo(x0 + d, y0 + h); g.lineTo(x0, y0 + th); g.closePath();
}
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
