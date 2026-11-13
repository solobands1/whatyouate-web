// Shared drawing helpers for the arcade games' scenery (Snack Merge, Food Fling, Beat The Crash, Berry Dash), in the
// same "premium kitchen" style as Kitchen Golf: real materials, a warm light from the top left that falls off into a
// vignette, soft contact shadows, bright edges where the light catches. Our own copy, so the golf files can change freely.
// Still things are painted once into canvases at the board's pixel scale (`layer`); only moving things draw per frame.

export type C = CanvasRenderingContext2D;
export type Rnd = () => number;
export const TAU = Math.PI * 2;

export function rr(c: C, x: number, y: number, w: number, h: number, r: number | number[]) { c.beginPath(); c.roundRect(x, y, w, h, r); }
export function circ(c: C, x: number, y: number, r: number) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
export function ell(c: C, x: number, y: number, rx: number, ry: number, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); }
export function line(c: C, x0: number, y0: number, x1: number, y1: number) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
export function lin(c: C, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, s]) => g.addColorStop(o, s)); return g; }
export function rad(c: C, x: number, y: number, r0: number, r1: number, stops: [number, string][], fx = x, fy = y) { const g = c.createRadialGradient(fx, fy, r0, x, y, r1); stops.forEach(([o, s]) => g.addColorStop(o, s)); return g; }

/** Canvas shadows are in device pixels, so they're scaled to match the drawing. */
export function scaleOf(c: C) { const m = c.getTransform(); return Math.hypot(m.a, m.b) || 1; }
export function shade(c: C, blur: number, ox: number, oy: number, col: string) { const k = scaleOf(c); c.shadowColor = col; c.shadowBlur = blur * k; c.shadowOffsetX = ox * k; c.shadowOffsetY = oy * k; }
export function noShade(c: C) { c.shadowColor = "transparent"; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; }

const rgbOf = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hex = (v: number[]) => `#${v.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("")}`;
/** Between two #rrggbb colours; the answer is #rrggbb too, so it can be mixed again. */
export function mix(a: string, b: string, t: number) { const p = rgbOf(a), q = rgbOf(b); return hex(p.map((v, i) => v + (q[i] - v) * t)); }
export const lighter = (h: string, t: number) => mix(h, "#ffffff", t);
export const darker = (h: string, t: number) => mix(h, "#000000", t);
export const rgba = (h: string, a: number) => `rgba(${rgbOf(h).join(",")},${a})`;

export function mulberry(seed: number): Rnd { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ── painted-once canvases ──
export type Layer = { cv: HTMLCanvasElement; w: number; h: number; k: number };
/** A canvas w by h board units at k device pixels per unit, painted once by `paint` (which works in board units). */
export function layer(w: number, h: number, k: number, paint: (c: C) => void): Layer {
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.ceil(w * k)); cv.height = Math.max(1, Math.ceil(h * k));
  const c = cv.getContext("2d")!; c.scale(k, k); paint(c);
  return { cv, w, h, k };
}
/** Draws a layer at (x, y) in board units. */
export function put(c: C, L: Layer, x = 0, y = 0) { c.drawImage(L.cv, x, y, L.w, L.h); }
/** Draws a layer centred on (x, y), turned by `rot`. */
export function putAt(c: C, L: Layer, x: number, y: number, rot = 0, s = 1) {
  if (rot) { c.save(); c.translate(x, y); c.rotate(rot); c.drawImage(L.cv, (-L.w / 2) * s, (-L.h / 2) * s, L.w * s, L.h * s); c.restore(); }
  else c.drawImage(L.cv, x - (L.w / 2) * s, y - (L.h / 2) * s, L.w * s, L.h * s);
}
/** The device pixels per board unit the board is drawn at right now (it changes when the phone turns or resizes). */
export function boardScale(c: C) { return Math.min(4, scaleOf(c)); }
/** Keeps painted layers until the board's pixel scale changes, then paints them again on next use. */
export function layerCache() {
  let k = 0; const m = new Map<string, Layer>();
  return {
    get(c: C, key: string, w: number, h: number, paint: (c: C) => void, kMul = 1) {
      const s = boardScale(c);
      if (Math.abs(s - k) > 0.01) { m.clear(); k = s; }
      let L = m.get(key); if (!L) { L = layer(w, h, s * kMul, paint); m.set(key, L); }
      return L;
    },
    drop(prefix: string) { for (const key of [...m.keys()]) if (key.startsWith(prefix)) m.delete(key); },
  };
}

// ── light ──
/** A soft specular spot (glaze, glass, chrome), tilted toward the light. */
export function gloss(c: C, x: number, y: number, rx: number, ry: number, a = 0.85, rot = -0.7) {
  c.fillStyle = rad(c, x, y, 0, rx, [[0, `rgba(255,255,255,${a})`], [0.55, `rgba(255,255,255,${a * 0.35})`], [1, "rgba(255,255,255,0)"]]); ell(c, x, y, rx, ry, rot); c.fill();
}
/** The light over a whole scene: a warm pool from the top left that falls off into a vignette at the edges. */
export function lightPool(c: C, w: number, h: number, pool = "255,214,150", strength = 0.2, dark = "34,12,0", vig = 0.42, lx = w * 0.18, ly = h * 0.12) {
  const big = Math.max(w, h);
  c.fillStyle = rad(c, lx, ly, 10, big * 0.85, [[0, `rgba(${pool},${strength})`], [0.4, `rgba(${pool},${strength * 0.28})`], [1, `rgba(${pool},0)`]]); c.fillRect(0, 0, w, h);
  c.fillStyle = rad(c, w * 0.5 + 20, h * 0.46, big * 0.42, big * 0.95, [[0, `rgba(${dark},0)`], [1, `rgba(${dark},${vig})`]]); c.fillRect(0, 0, w, h);
}
/** A box lit from the top left: a sheen across it, a bright top and left edge, a darker bottom and right edge. */
export function bevel(c: C, x0: number, y0: number, w: number, h: number, r: number, k = 1) {
  c.save(); rr(c, x0, y0, w, h, r); c.clip();
  c.fillStyle = lin(c, x0, y0, x0 + w, y0 + h, [[0, `rgba(255,255,255,${0.22 * k})`], [0.5, "rgba(255,255,255,0)"], [1, `rgba(0,0,0,${0.18 * k})`]]); c.fillRect(x0, y0, w, h);
  c.lineWidth = 2;
  c.strokeStyle = `rgba(255,255,255,${0.5 * k})`; c.beginPath(); c.moveTo(x0 + 1, y0 + h - r); c.lineTo(x0 + 1, y0 + 1); c.lineTo(x0 + w - r, y0 + 1); c.stroke();
  c.strokeStyle = `rgba(0,0,0,${0.25 * k})`; c.beginPath(); c.moveTo(x0 + r, y0 + h - 1); c.lineTo(x0 + w - 1, y0 + h - 1); c.lineTo(x0 + w - 1, y0 + r); c.stroke();
  c.restore();
}
/** A soft round shadow, as a small canvas to stamp under things: dark in the middle, gone at the edge. */
export function shadowBlob(k: number, rx: number, ry: number, col = "30,16,4", a = 0.4): Layer {
  return layer(rx * 2 + 4, ry * 2 + 4, k, c => {
    c.translate(rx + 2, ry + 2); c.scale(1, ry / rx);
    c.fillStyle = rad(c, 0, 0, 0, rx, [[0, `rgba(${col},${a})`], [0.5, `rgba(${col},${a * 0.55})`], [1, `rgba(${col},0)`]]); circ(c, 0, 0, rx); c.fill();
  });
}

// ── materials (each fills a rectangle; the caller clips) ──
/** Planks across, each its own tone, with flowing grain, pores, the odd knot and the seams between them. */
export function planks(c: C, x0: number, y0: number, x1: number, y1: number, rnd: Rnd, pal: string[], dark: string, size: [number, number] = [40, 14], joints = true) {
  const [hMin, hVar] = size;
  let y = y0 - rnd() * 10;
  while (y < y1) {
    const h = hMin + rnd() * hVar, base = pal[Math.floor(rnd() * pal.length)];
    const js = [x0 - 1]; if (joints) { let jx = x0 + 50 + rnd() * 220; while (jx < x1) { js.push(jx); jx += 240 + rnd() * 180; } } js.push(x1 + 1);
    for (let s = 0; s < js.length - 1; s++) {
      const bx0 = js[s], bx1 = js[s + 1], tone = mix(base, rnd() < 0.5 ? "#ffffff" : "#000000", rnd() * 0.07);
      c.fillStyle = lin(c, 0, y, 0, y + h, [[0, lighter(tone, 0.08)], [0.55, tone], [1, darker(tone, 0.12)]]); c.fillRect(bx0, y, bx1 - bx0, h);
      c.save(); c.beginPath(); c.rect(bx0, y, bx1 - bx0, h); c.clip();
      const n = Math.max(3, Math.round(h / 1.8));
      for (let g = 0; g < n; g++) {
        const gy = y + (g + rnd() * 0.7) * (h / n), a1 = 0.5 + rnd() * 1.6, l1 = 50 + rnd() * 80, ph = rnd() * TAU, light = rnd() < 0.22;
        c.strokeStyle = light ? `rgba(255,222,175,${0.06 + rnd() * 0.08})` : `rgba(${dark},${0.06 + rnd() * 0.14})`; c.lineWidth = 0.35 + rnd() * 1.1;
        c.beginPath(); for (let xx = bx0 - 6; xx <= bx1 + 6; xx += 6) { const yy = gy + Math.sin(xx / l1 + ph) * a1; if (xx === bx0 - 6) c.moveTo(xx, yy); else c.lineTo(xx, yy); } c.stroke();
      }
      const pores = Math.round((bx1 - bx0) * h * 0.018);
      for (let q = 0; q < pores; q++) { c.fillStyle = `rgba(${dark},${0.1 + rnd() * 0.12})`; c.fillRect(bx0 + rnd() * (bx1 - bx0), y + rnd() * h, 1.2 + rnd() * 2.2, 0.45); }
      if (h > 26 && rnd() < 0.14) {
        const kx = bx0 + (bx1 - bx0) * (0.1 + rnd() * 0.8), ky = y + h * (0.3 + rnd() * 0.4);
        c.fillStyle = rad(c, kx, ky, 0.3, 4.5, [[0, `rgba(${dark},0.7)`], [1, `rgba(${dark},0)`]]); ell(c, kx, ky, 5.5, 3.2); c.fill();
        for (let j = 1; j <= 3; j++) { c.strokeStyle = `rgba(${dark},${0.16 - j * 0.035})`; c.lineWidth = 0.6; ell(c, kx, ky, 5.5 + j * 3.2, 3.2 + j * 1.4); c.stroke(); }
      }
      c.restore();
      if (s > 0) { c.fillStyle = `rgba(${dark},0.5)`; c.fillRect(bx0 - 0.5, y, 1, h); c.fillStyle = "rgba(255,230,190,0.18)"; c.fillRect(bx0 + 0.5, y, 0.6, h); }
    }
    c.fillStyle = `rgba(${dark},0.55)`; c.fillRect(x0, y - 0.6, x1 - x0, 1.2); c.fillStyle = "rgba(255,232,195,0.22)"; c.fillRect(x0, y + 0.6, x1 - x0, 0.8);
    y += h;
  }
}
/** A varnish sheen: a broad diagonal highlight band. */
export function sheen(c: C, x0: number, y0: number, x1: number, y1: number, a = 0.15) {
  c.fillStyle = lin(c, x0, y0, x1, y1, [[0, "rgba(255,244,222,0)"], [0.22, `rgba(255,244,222,${a})`], [0.36, `rgba(255,244,222,${a * 0.1})`], [0.6, `rgba(255,244,222,${a * 0.5})`], [0.72, "rgba(255,244,222,0)"]]);
  c.fillRect(x0, y0, x1 - x0, y1 - y0);
}
/** Polished marble: a warm white, soft cloudy patches, grey veins (a wide haze with a fine line in it). */
export function marble(c: C, x0: number, y0: number, x1: number, y1: number, rnd: Rnd, veins = 5) {
  const w = x1 - x0, h = y1 - y0;
  c.fillStyle = lin(c, x0, y0, x1, y1, [[0, "#fbf9f6"], [1, "#ece7e1"]]); c.fillRect(x0, y0, w, h);
  for (let i = 0; i < 14; i++) { const cx = x0 + rnd() * w, cy = y0 + rnd() * h, r = 30 + rnd() * 80; c.fillStyle = rad(c, cx, cy, 0, r, [[0, rnd() < 0.5 ? "rgba(200,192,182,0.16)" : "rgba(235,225,210,0.22)"], [1, "rgba(220,210,200,0)"]]); c.fillRect(cx - r, cy - r, r * 2, r * 2); }
  c.lineCap = "round"; c.lineJoin = "round";
  for (let k = 0; k < veins; k++) {
    const pts: number[][] = []; let x = x0 - 40 + rnd() * (w + 40), y = y0 - 10 + rnd() * h * 0.5, a = (rnd() - 0.5) * 0.9;
    for (let s = 0; s < 24; s++) { pts.push([x, y]); a += (rnd() - 0.5) * 0.35; x += Math.cos(a) * 22; y += Math.sin(a) * 9; }
    const path = () => { c.beginPath(); pts.forEach(([px, py], i) => { if (i) { const [qx, qy] = pts[i - 1]; c.quadraticCurveTo(qx, qy, (qx + px) / 2, (qy + py) / 2); } else c.moveTo(px, py); }); };
    const g = 0.6 + rnd() * 0.6;
    path(); c.strokeStyle = `rgba(130,120,112,${0.05 * g})`; c.lineWidth = 10; c.stroke();
    path(); c.strokeStyle = `rgba(120,112,105,${0.08 * g})`; c.lineWidth = 3.5; c.stroke();
    path(); c.strokeStyle = `rgba(100,94,90,${0.22 * g})`; c.lineWidth = 0.7; c.stroke();
  }
  for (let i = 0; i < w * h * 0.002; i++) { c.fillStyle = `rgba(150,140,130,${0.1 + rnd() * 0.15})`; c.fillRect(x0 + rnd() * w, y0 + rnd() * h, 0.8, 0.8); }
}
/** Fine fabric: a soft base colour with a woven crosshatch and a little slub. */
export function weave(c: C, x0: number, y0: number, x1: number, y1: number, rnd: Rnd, col: string, step = 2.2) {
  c.fillStyle = col; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  c.lineWidth = step * 0.45;
  for (let y = y0; y < y1; y += step) { c.strokeStyle = rnd() < 0.5 ? "rgba(255,255,255,0.09)" : "rgba(60,40,20,0.07)"; line(c, x0, y, x1, y); }
  for (let x = x0; x < x1; x += step) { c.strokeStyle = rnd() < 0.5 ? "rgba(255,255,255,0.07)" : "rgba(60,40,20,0.06)"; line(c, x, y0, x, y1); }
  for (let i = 0; i < (x1 - x0) * (y1 - y0) * 0.004; i++) { c.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.18)" : "rgba(70,50,30,0.12)"; c.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 2 + rnd() * 4, 0.6); }
}
/** A painted plaster wall: a soft colour with a faint mottle and fine speckle. */
export function plaster(c: C, x0: number, y0: number, x1: number, y1: number, rnd: Rnd, col: string, wrap = false) {
  const w = x1 - x0, h = y1 - y0;
  c.fillStyle = col; c.fillRect(x0, y0, w, h);
  for (let i = 0; i < w * h * 0.0009; i++) {
    const cx = x0 + rnd() * w, cy = y0 + rnd() * h, r = 14 + rnd() * 40, st = [[0, rnd() < 0.5 ? "rgba(255,255,255,0.1)" : "rgba(120,90,60,0.05)"], [1, "rgba(255,255,255,0)"]] as [number, string][];
    for (const dx of wrap ? [-w, 0, w] : [0]) { c.fillStyle = rad(c, cx + dx, cy, 0, r, st); c.fillRect(cx + dx - r, cy - r, r * 2, r * 2); }
  }
  for (let i = 0; i < w * h * 0.01; i++) { c.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.22)" : "rgba(110,85,60,0.09)"; c.fillRect(x0 + rnd() * w, y0 + rnd() * h, 0.8, 0.8); }
}
