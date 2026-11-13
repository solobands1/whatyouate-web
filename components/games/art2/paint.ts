// Shared canvas helpers for the "Premium Kitchen" art in Cart Rush, Food Fight and Pea Tanks: shapes, gradients,
// colour mixing, soft shadows, gloss, and offscreen layers painted once at the screen's real pixel density.
// Light always comes from the top left, so shadows and contact halos fall down and to the right.

export type C = CanvasRenderingContext2D;
export type Rnd = () => number;
export const TAU = Math.PI * 2;

/** A small seeded random (same as the kit's), so painted texture is the same on every visit. */
export function seeded(seed: number): Rnd {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function rr(c: C, x: number, y: number, w: number, h: number, r: number | number[]) { c.beginPath(); c.roundRect(x, y, w, h, r); }
export function circ(c: C, x: number, y: number, r: number) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
export function ell(c: C, x: number, y: number, rx: number, ry: number, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU); }
export function line(c: C, x0: number, y0: number, x1: number, y1: number) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
export function lin(c: C, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) { const g = c.createLinearGradient(x0, y0, x1, y1); for (const [o, s] of stops) g.addColorStop(o, s); return g; }
export function rad(c: C, x: number, y: number, r0: number, r1: number, stops: [number, string][], fx = x, fy = y) { const g = c.createRadialGradient(fx, fy, r0, x, y, r1); for (const [o, s] of stops) g.addColorStop(o, s); return g; }

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

/** An offscreen canvas `w` by `h` board units at `k` device pixels per unit, its context already scaled. */
export function layer(w: number, h: number, k: number) {
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.ceil(w * k)); cv.height = Math.max(1, Math.ceil(h * k));
  const c = cv.getContext("2d")!; c.scale(k, k);
  return { cv, c };
}
/** Sprites painted once and drawn many times: keyed by name and pixel density, so a resize repaints them. */
export function spriteCache() {
  const m = new Map<string, HTMLCanvasElement>();
  return (key: string, k: number, w: number, h: number, paint: (c: C) => void) => {
    const id = `${key}@${k.toFixed(3)}`;
    let cv = m.get(id);
    if (!cv) { const L = layer(w, h, k); paint(L.c); cv = L.cv; if (m.size > 160) m.clear(); m.set(id, cv); }
    return cv;
  };
}

/** A soft specular spot (glaze, glass, chrome), tilted toward the light. */
export function gloss(c: C, x: number, y: number, rx: number, ry: number, a = 0.85, rot = -0.7) {
  c.fillStyle = rad(c, x, y, 0, rx, [[0, `rgba(255,255,255,${a})`], [0.55, `rgba(255,255,255,${a * 0.35})`], [1, "rgba(255,255,255,0)"]]);
  ell(c, x, y, rx, ry, rot); c.fill();
}
/** A soft dark halo where something sits on a surface, a little down and right of it. */
export function contact(c: C, x: number, y: number, rx: number, ry: number, a = 0.4, tint = "40,24,10") {
  const cx = x + rx * 0.12, cy = y + ry * 0.2;
  c.save(); c.translate(cx, cy); c.scale(1, ry / rx);
  c.fillStyle = rad(c, 0, 0, rx * 0.35, rx * 1.25, [[0, `rgba(${tint},${a})`], [0.5, `rgba(${tint},${a * 0.42})`], [1, `rgba(${tint},0)`]]);
  circ(c, 0, 0, rx * 1.25); c.fill(); c.restore();
}
/** A box lit from the top left: a sheen across it, a bright top and left edge, a darker bottom and right edge. */
export function bevel(c: C, x0: number, y0: number, w: number, h: number, r: number, k = 1, lw = 1.6) {
  c.save(); rr(c, x0, y0, w, h, r); c.clip();
  c.fillStyle = lin(c, x0, y0, x0 + w, y0 + h, [[0, `rgba(255,255,255,${0.2 * k})`], [0.5, "rgba(255,255,255,0)"], [1, `rgba(0,0,0,${0.16 * k})`]]); c.fillRect(x0, y0, w, h);
  c.lineWidth = lw;
  c.strokeStyle = `rgba(255,255,255,${0.5 * k})`; c.beginPath(); c.moveTo(x0 + lw / 2, y0 + h - r); c.lineTo(x0 + lw / 2, y0 + lw / 2); c.lineTo(x0 + w - r, y0 + lw / 2); c.stroke();
  c.strokeStyle = `rgba(0,0,0,${0.22 * k})`; c.beginPath(); c.moveTo(x0 + r, y0 + h - lw / 2); c.lineTo(x0 + w - lw / 2, y0 + h - lw / 2); c.lineTo(x0 + w - lw / 2, y0 + r); c.stroke();
  c.restore();
}
/** A bright arc on the top-left edge of something round, and (optionally) a soft one bottom right. */
export function rimArc(c: C, x: number, y: number, r: number, w: number, a = 0.9, back = 0) {
  c.lineCap = "round"; c.lineWidth = w;
  c.strokeStyle = `rgba(255,255,255,${a})`; c.beginPath(); c.arc(x, y, r, Math.PI * 1.02, Math.PI * 1.46); c.stroke();
  if (back) { c.strokeStyle = `rgba(255,255,255,${back})`; c.beginPath(); c.arc(x, y, r, Math.PI * 0.08, Math.PI * 0.42); c.stroke(); }
}
export const CHROME: [number, string][] = [[0, "#6f7a87"], [0.22, "#f7f9fc"], [0.42, "#b9c2cc"], [0.62, "#e6ebf0"], [1, "#5d6773"]];

/** The light over a whole scene: a warm pool from the top left that falls off into a vignette. Paint it once into a layer. */
export function warmLight(c: C, w: number, h: number, opt: { pool?: number; dark?: number; lx?: number; ly?: number; tone?: string; shadow?: string } = {}) {
  const big = Math.max(w, h), lx = opt.lx ?? w * 0.16, ly = opt.ly ?? h * 0.1, pool = opt.tone ?? "255,214,150", dark = opt.shadow ?? "34,14,0";
  const a = opt.pool ?? 0.22, d = opt.dark ?? 0.42;
  c.fillStyle = rad(c, lx, ly, 8, big * 0.9, [[0, `rgba(${pool},${a})`], [0.42, `rgba(${pool},${a * 0.3})`], [1, `rgba(${pool},0)`]]); c.fillRect(0, 0, w, h);
  c.fillStyle = rad(c, w * 0.5 + (lx - w * 0.5) * 0.25, h * 0.5 + (ly - h * 0.5) * 0.2, big * 0.42, big * 0.95, [[0, `rgba(${dark},0)`], [0.7, `rgba(${dark},${d * 0.45})`], [1, `rgba(${dark},${d})`]]);
  c.fillRect(0, 0, w, h);
}

/** Text with a soft outline and a drop under it, so it reads on any background. */
export function outlined(c: C, s: string, x: number, y: number, fill: string, edge = "rgba(255,255,255,0.92)", w = 3.2, drop = "rgba(10,20,40,0.25)") {
  c.lineJoin = "round"; c.miterLimit = 2;
  if (drop) { c.fillStyle = drop; c.fillText(s, x, y + w * 0.55); }
  c.strokeStyle = edge; c.lineWidth = w; c.strokeText(s, x, y);
  c.fillStyle = fill; c.fillText(s, x, y);
}

/** Draws the given text once, off screen, so the first time it appears in play (an emoji in a pop-up, say) doesn't
 *  stall a frame while the browser loads the glyphs. */
export function warmText(fonts: string[], text: string) {
  try { const c = document.createElement("canvas").getContext("2d"); if (!c) return; for (const f of fonts) { c.font = f; c.lineWidth = 3; c.strokeText(text, 0, 20); c.fillText(text, 0, 20); } } catch {}
}

/** Outlined text painted once into a small canvas and stamped after that: stroking text every frame is slow, and the
 *  labels (health, whose turn, pop-up scores) rarely change. Call the returned function like outlined(), plus the font. */
export function textStamps() {
  const m = new Map<string, { cv: HTMLCanvasElement; w: number; tw: number; pad: number; asc: number; h: number }>();
  let meas: CanvasRenderingContext2D | null = null;
  return (c: C, s: string, x: number, y: number, font: string, fill: string, edge = "rgba(255,255,255,0.92)", ew = 3.2, drop = "", align: CanvasTextAlign = "center") => {
    const k = scaleOf(c), key = `${k.toFixed(3)}|${font}|${fill}|${edge}|${ew}|${drop}|${s}`;
    let e = m.get(key);
    if (!e) {
      meas = meas ?? document.createElement("canvas").getContext("2d")!;
      meas.font = font; const tm = meas.measureText(s), px = parseFloat(font.replace(/^\d{3}\s+/, "")) || 14;
      const asc = Math.max(tm.actualBoundingBoxAscent || 0, px * 0.82), desc = Math.max(tm.actualBoundingBoxDescent || 0, px * 0.28), pad = ew + 2;
      const w = tm.width + pad * 2, h = asc + desc + pad * 2 + (drop ? ew * 0.6 : 0);
      const L = layer(w, h, k); L.c.font = font; L.c.textAlign = "left"; L.c.textBaseline = "alphabetic";
      outlined(L.c, s, pad, pad + asc, fill, edge, ew, drop);
      e = { cv: L.cv, w, tw: tm.width, pad, asc, h };
      if (m.size > 240) m.clear();
      m.set(key, e);
    }
    const left = align === "center" ? x - e.tw / 2 : align === "right" || align === "end" ? x - e.tw : x;
    c.drawImage(e.cv, left - e.pad, y - e.pad - e.asc, e.w, e.h);
  };
}
