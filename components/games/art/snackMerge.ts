// Snack Merge's board art: the inside of a lacquered wooden bento box (honey cedar with a fine straight grain, moulded
// walls that catch the light on the right and fall into shadow on the left, a floor you can just see, a rim casting a
// soft shadow), each food sitting in a pleated silicone cup, and a juicy burst when two merge.
// The box and every cup are painted once; per frame it's a few small stamps per food.
import { type C, type Layer, TAU, rr, circ, lin, rad, mix, lighter, darker, rgba, mulberry, layerCache, put, putAt, lightPool, sheen, boardScale } from "./paint";

/** A richer tint per food for its cup, from the food's pale colour toward its own hue. */
const CUP: string[] = ["#9fb1ff", "#ff9aa6", "#ffa494", "#ffcf86", "#aedb86", "#ff9c84", "#ff9696", "#bddc8a", "#93d6a0", "#ffd772", "#94c4ff"];

const cache = layerCache();

/** Straight-grained cedar across a rectangle: broad bands of tone, fine wavy lines, pores. `down` runs the grain down. */
function cedar(c: C, x0: number, y0: number, x1: number, y1: number, rnd: () => number, top: string, bottom: string) {
  const w = x1 - x0, h = y1 - y0;
  c.fillStyle = lin(c, 0, y0, 0, y1, [[0, top], [1, bottom]]); c.fillRect(x0, y0, w, h);
  for (let x = x0 - 4; x < x1 + 4;) {   // broad bands of slightly different wood, the odd pinker streak
    const bw = 10 + rnd() * 50, r = rnd();
    c.fillStyle = r < 0.12 ? `rgba(214,120,80,${0.06 + rnd() * 0.08})` : r < 0.55 ? `rgba(255,236,205,${rnd() * 0.13})` : `rgba(140,78,28,${rnd() * 0.09})`; c.fillRect(x, y0, bw, h); x += bw;
  }
  for (let i = 0; i < w * 0.5; i++) {   // the grain
    const gx = x0 + rnd() * w, a = 0.4 + rnd() * 1.6, l = 60 + rnd() * 140, ph = rnd() * TAU, dark = rnd() < 0.8;
    c.strokeStyle = dark ? `rgba(118,62,20,${0.04 + rnd() * 0.12})` : `rgba(255,240,215,${0.07 + rnd() * 0.12})`; c.lineWidth = 0.3 + rnd() * (dark ? 1.1 : 0.7);
    c.beginPath(); for (let y = y0 - 6; y <= y1 + 6; y += 8) { const x = gx + Math.sin(y / l + ph) * a + Math.sin(y / 23 + ph * 3) * 0.25; if (y === y0 - 6) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
  }
  for (let i = 0; i < 6; i++) {   // a few darker late-wood lines that wander
    const gx = x0 + rnd() * w, ph = rnd() * TAU; c.strokeStyle = `rgba(110,55,15,${0.1 + rnd() * 0.08})`; c.lineWidth = 1 + rnd() * 1.2;
    c.beginPath(); for (let y = y0 - 6; y <= y1 + 6; y += 6) { const x = gx + Math.sin(y / 90 + ph) * 3 + Math.sin(y / 31 + ph) * 0.8; if (y === y0 - 6) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
  }
  for (let i = 0; i < w * h * 0.006; i++) { c.fillStyle = `rgba(110,60,20,${0.08 + rnd() * 0.12})`; c.fillRect(x0 + rnd() * w, y0 + rnd() * h, 0.45, 1 + rnd() * 2.4); }
}
const poly = (c: C, p: number[][]) => { c.beginPath(); p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };

function paintBox(c: C, W: number, H: number) {
  const rnd = mulberry(4471), WL = 17, FL = 26, RIM = 9, bx0 = WL, bx1 = W - WL, by1 = H - FL;
  c.save(); rr(c, 0, 0, W, H, 22); c.clip();
  // the back wall: one sheet of cedar, a straight grain running down it, lacquered
  cedar(c, 0, 0, W, H, rnd, "#efcf9e", "#d9a76a");
  sheen(c, 0, 0, W, H * 0.9, 0.22);
  // the lacquer is glossy enough to hold a soft reflection of the kitchen window, top left
  c.save(); c.transform(1, 0, -0.18, 1, 0, 0);
  for (const [x, y, w, h] of [[46, 34, 58, 120], [110, 34, 58, 120], [46, 160, 58, 78], [110, 160, 58, 78]]) {
    c.fillStyle = lin(c, 0, y, 0, y + h, [[0, "rgba(255,250,238,0.2)"], [1, "rgba(255,250,238,0.03)"]]); rr(c, x + 30, y, w, h, 5); c.fill();
  }
  c.restore();
  // the floor, in perspective: its grain runs toward the back, it faces up into the light
  const vx = W / 2, vy = H * 0.42;
  c.save(); poly(c, [[0, H], [bx0, by1], [bx1, by1], [W, H]]); c.clip();
  c.fillStyle = lin(c, 0, by1, 0, H, [[0, "#e2b679"], [1, "#f2d4a2"]]); c.fillRect(0, by1, W, FL);
  for (let i = 0; i < 70; i++) {
    const fx = -40 + rnd() * (W + 80), t = (by1 - H) / (vy - H);
    c.strokeStyle = rnd() < 0.8 ? `rgba(120,62,20,${0.05 + rnd() * 0.12})` : `rgba(255,240,215,${0.1 + rnd() * 0.12})`; c.lineWidth = 0.4 + rnd() * 0.9;
    c.beginPath(); c.moveTo(fx, H); c.lineTo(fx + (vx - fx) * t, by1); c.stroke();
  }
  c.fillStyle = lin(c, 0, by1, 0, by1 + 9, [[0, "rgba(80,38,6,0.42)"], [1, "rgba(80,38,6,0)"]]); c.fillRect(0, by1, W, 9);   // the cove where it meets the wall
  c.fillStyle = lin(c, 0, H - 5, 0, H, [[0, "rgba(255,246,228,0)"], [1, "rgba(255,246,228,0.5)"]]); c.fillRect(0, H - 5, W, 5);
  c.restore();
  // the side walls, receding: the left one turned from the light, the right one catching it
  c.save(); poly(c, [[0, 0], [bx0, RIM], [bx0, by1], [0, H]]); c.clip();
  cedar(c, 0, 0, bx0 + 1, H, rnd, "#d3a46a", "#b97f45");
  c.fillStyle = lin(c, 0, 0, bx0, 0, [[0, "rgba(70,32,4,0.42)"], [1, "rgba(70,32,4,0.16)"]]); c.fillRect(0, 0, bx0 + 1, H);
  c.restore();
  c.save(); poly(c, [[W, 0], [bx1, RIM], [bx1, by1], [W, H]]); c.clip();
  cedar(c, bx1 - 1, 0, W, H, rnd, "#f6dcaf", "#e7bb80");
  c.fillStyle = lin(c, bx1, 0, W, 0, [[0, "rgba(255,244,222,0.1)"], [0.7, "rgba(255,244,222,0.3)"], [1, "rgba(120,60,15,0.25)"]]); c.fillRect(bx1 - 1, 0, WL + 1, H);
  c.restore();
  // the left wall and the rim keep some of the light off the back wall: a soft shadow down its left side
  c.fillStyle = lin(c, bx0, 0, bx0 + 70, 0, [[0, "rgba(80,38,6,0.2)"], [1, "rgba(80,38,6,0)"]]); c.fillRect(bx0, RIM, 70, by1 - RIM);
  // rounded inside corners: soft shade where the walls meet the back, a bright crest on the lit side
  c.fillStyle = lin(c, bx0, 0, bx0 + 9, 0, [[0, "rgba(80,38,6,0.32)"], [1, "rgba(80,38,6,0)"]]); c.fillRect(bx0, RIM, 9, by1 - RIM);
  c.fillStyle = lin(c, bx1 - 7, 0, bx1, 0, [[0, "rgba(80,38,6,0)"], [1, "rgba(80,38,6,0.2)"]]); c.fillRect(bx1 - 7, RIM, 7, by1 - RIM);
  c.strokeStyle = "rgba(255,246,226,0.55)"; c.lineWidth = 1; c.beginPath(); c.moveTo(bx1 + 1.5, RIM + 2); c.lineTo(bx1 + 1.5, by1 - 1); c.lineTo(W - 2, H); c.stroke();
  c.strokeStyle = "rgba(255,238,210,0.3)"; c.beginPath(); c.moveTo(bx0 - 1, RIM + 2); c.lineTo(bx0 - 1, by1 - 1); c.stroke();
  c.strokeStyle = "rgba(90,44,8,0.35)"; c.lineWidth = 1; c.beginPath(); c.moveTo(1, H - 1); c.lineTo(bx0, by1); c.lineTo(bx1, by1); c.stroke();
  // the rim along the top, lacquered darker, and the soft shadow it throws down the wall
  c.fillStyle = lin(c, 0, 0, 0, RIM, [[0, "#a7652d"], [0.4, "#cf9050"], [1, "#7a3f17"]]); c.fillRect(0, 0, W, RIM);
  c.fillStyle = "rgba(255,234,198,0.6)"; c.fillRect(0, 2.4, W, 1);
  c.fillStyle = lin(c, 0, RIM, 0, RIM + 40, [[0, "rgba(70,32,4,0.45)"], [0.3, "rgba(70,32,4,0.16)"], [1, "rgba(70,32,4,0)"]]); c.fillRect(0, RIM, W, 40);
  lightPool(c, W, H, "255,230,184", 0.28, "60,24,0", 0.42, W * 0.22, H * 0.05);
  c.restore();
  // a crisp edge where the board meets the page
  c.strokeStyle = "rgba(96,48,12,0.6)"; c.lineWidth = 1.5; rr(c, 0.75, 0.75, W - 1.5, H - 1.5, 21.5); c.stroke();
}

/** A pleated silicone cup, `r` across, in the food's tint. Lit evenly, so it can turn with the food. */
function paintCup(c: C, r: number, col: string) {
  const n = Math.max(16, Math.min(44, Math.round(r * 0.9))), inner = r * 0.8;
  c.beginPath();
  for (let i = 0; i <= n * 2; i++) { const a = (i / (n * 2)) * TAU, rr2 = i % 2 ? r * 0.965 : r; if (i) c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); else c.moveTo(rr2, 0); }
  c.closePath();
  c.fillStyle = rad(c, 0, 0, inner * 0.9, r, [[0, darker(col, 0.06)], [0.6, col], [1, lighter(col, 0.12)]]); c.fill();
  c.strokeStyle = rgba(darker(col, 0.35), 0.55); c.lineWidth = Math.max(0.6, r * 0.025); c.stroke();
  c.lineWidth = Math.max(0.5, r * 0.022);
  for (let i = 0; i < n; i++) {   // the pleats: a fold in the light, a fold in the shade
    const a = (i / n) * TAU;
    c.strokeStyle = i % 2 ? rgba(darker(col, 0.3), 0.22) : "rgba(255,255,255,0.3)";
    c.beginPath(); c.moveTo(Math.cos(a) * inner, Math.sin(a) * inner); c.lineTo(Math.cos(a) * r * 0.97, Math.sin(a) * r * 0.97); c.stroke();
  }
  c.fillStyle = rad(c, 0, 0, 0, inner, [[0, lighter(col, 0.55)], [0.75, lighter(col, 0.35)], [1, mix(col, "#ffffff", 0.15)]]); circ(c, 0, 0, inner); c.fill();
  c.strokeStyle = rgba(darker(col, 0.3), 0.35); c.lineWidth = Math.max(0.6, r * 0.03); circ(c, 0, 0, inner); c.stroke();
}
/** The light on a cup, which doesn't turn: bright along the top left of the rim, shaded bottom right, a little gloss. */
function paintCupLight(c: C, r: number) {
  c.lineCap = "round";
  c.lineWidth = r * 0.1; c.strokeStyle = "rgba(255,255,255,0.55)"; c.beginPath(); c.arc(0, 0, r * 0.9, Math.PI * 1.02, Math.PI * 1.5); c.stroke();
  c.lineWidth = r * 0.12; c.strokeStyle = "rgba(80,30,10,0.16)"; c.beginPath(); c.arc(0, 0, r * 0.9, Math.PI * 0.05, Math.PI * 0.55); c.stroke();
  c.fillStyle = rad(c, -r * 0.6, -r * 0.62, 0, r * 0.26, [[0, "rgba(255,255,255,0.75)"], [1, "rgba(255,255,255,0)"]]); circ(c, -r * 0.6, -r * 0.62, r * 0.26); c.fill();
}

export type Food = { r: number; color: string };
export type Burst = { x: number; y: number; lv: number; age: number; seed: number };
export const BURST_MS = 520;

/** Everything still: the box. */
export function drawBox(c: C, W: number, H: number) { put(c, cache.get(c, "box", W, H, cc => paintBox(cc, W, H))); }

/** Soft shadows under every food (drawn first, so foods sit in each other's shade). */
export function drawShadow(c: C, f: Food, x: number, y: number) {
  const R = f.r * 1.18, L: Layer = cache.get(c, `sh${f.r}`, R * 2, R * 2, cc => {
    cc.fillStyle = rad(cc, R, R, 0, R, [[0, "rgba(70,30,4,0.4)"], [0.55, "rgba(70,30,4,0.22)"], [1, "rgba(70,30,4,0)"]]); circ(cc, R, R, R); cc.fill();
  });
  putAt(c, L, x + f.r * 0.12, y + f.r * 0.2);
}
/** A food in its cup. `s` (at most 1) shrinks it for the pop when it's just been made. */
export function drawFood(c: C, lv: number, f: Food, img: HTMLImageElement, x: number, y: number, ang: number, s = 1, alpha = 1) {
  const cup = cache.get(c, `cup${lv}`, f.r * 2 + 2, f.r * 2 + 2, cc => { cc.translate(f.r + 1, f.r + 1); paintCup(cc, f.r, CUP[lv] ?? f.color); });
  const light = cache.get(c, `cl${lv}`, f.r * 2 + 2, f.r * 2 + 2, cc => { cc.translate(f.r + 1, f.r + 1); paintCupLight(cc, f.r); });
  if (alpha < 1) c.globalAlpha = alpha;
  putAt(c, cup, x, y, ang, s);
  putAt(c, light, x, y, 0, s);
  const z = f.r * 1.55 * s;
  if (img.complete && img.naturalWidth) {
    if (ang) { c.save(); c.translate(x, y); c.rotate(ang); c.drawImage(img, -z / 2, -z / 2, z, z); c.restore(); }
    else c.drawImage(img, x - z / 2, y - z / 2, z, z);
  }
  if (alpha < 1) c.globalAlpha = 1;
}

/** Paints the box and every cup up front, so a new food's first appearance doesn't cost a frame. Draws junk on the board; call it every frame right before the board is cleared (it only works when it has to). */
let warmK = 0;
export function warm(c: C, W: number, H: number, foods: Food[], imgs: HTMLImageElement[]) {
  const k = boardScale(c); if (Math.abs(k - warmK) < 0.01) return; warmK = k;   // again only if the board's pixel scale changed
  drawBox(c, W, H);
  foods.forEach((f, lv) => { drawShadow(c, f, 0, 0); drawFood(c, lv, f, imgs[lv], 0, 0, 0, 1, 0.01); });
}

/** The line foods mustn't settle above: a clean dashed line pressed into the wood, red and glowing when it's close. */
export function drawDangerLine(c: C, W: number, y: number, danger: boolean, t: number) {
  c.save(); c.lineCap = "round"; c.setLineDash([9, 9]);
  if (danger) {
    const p = 0.6 + 0.4 * Math.sin(t / 110);
    c.strokeStyle = `rgba(232,80,91,${0.25 * p})`; c.lineWidth = 9; c.beginPath(); c.moveTo(24, y); c.lineTo(W - 24, y); c.stroke();
    c.strokeStyle = "#e8505b"; c.lineWidth = 3; c.beginPath(); c.moveTo(24, y); c.lineTo(W - 24, y); c.stroke();
  } else {
    c.strokeStyle = "rgba(120,62,18,0.35)"; c.lineWidth = 3; c.beginPath(); c.moveTo(24, y + 1); c.lineTo(W - 24, y + 1); c.stroke();
    c.strokeStyle = "rgba(255,247,232,0.9)"; c.lineWidth = 2.5; c.beginPath(); c.moveTo(24, y); c.lineTo(W - 24, y); c.stroke();
  }
  c.restore();
}

/** The drop guide: a clean dotted line straight down from the food in hand, fading as it goes. */
export function drawAim(c: C, x: number, y0: number, y1: number) {
  const n = Math.floor((y1 - y0) / 13);
  for (let i = 1; i <= n; i++) {
    const y = y0 + i * 13, a = 0.85 * (1 - (i / n) * 0.75);
    c.fillStyle = `rgba(110,55,15,${a * 0.3})`; circ(c, x + 0.5, y + 0.8, 2.2); c.fill();
    c.fillStyle = `rgba(255,250,240,${a})`; circ(c, x, y, 2); c.fill();
  }
}

/** A juicy burst where two foods merged: a ring of the new food's colour, droplets thrown out, a quick flash. */
export function drawBurst(c: C, b: Burst, r: number) {
  const k = b.age / BURST_MS; if (k >= 1) return;
  const col = CUP[b.lv] ?? "#ffffff", deep = darker(col, 0.18), e = 1 - (1 - k) * (1 - k), rnd = mulberry(b.seed);
  c.save();
  c.globalAlpha = Math.max(0, 1 - k * 1.6);
  c.fillStyle = rad(c, b.x, b.y, 0, r * (0.9 + e * 0.5), [[0, "rgba(255,255,255,0.75)"], [0.6, rgba(lighter(col, 0.4), 0.35)], [1, rgba(col, 0)]]); circ(c, b.x, b.y, r * (0.9 + e * 0.5)); c.fill();
  c.globalAlpha = Math.max(0, 1 - k);
  c.strokeStyle = rgba(col, 0.9); c.lineWidth = 4 * (1 - k) + 0.5; circ(c, b.x, b.y, r * (0.75 + e * 0.75)); c.stroke();
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd() * 0.4, sp = r * (0.7 + rnd() * 0.9), d = r * 0.6 + sp * e, gy = 60 * k * k;
    const px = b.x + Math.cos(a) * d, py = b.y + Math.sin(a) * d + gy, s = (2.2 + rnd() * 3.2) * (1 - k * 0.7);
    c.fillStyle = i % 3 ? deep : "#ffffff"; circ(c, px, py, s); c.fill();
    c.fillStyle = "rgba(255,255,255,0.7)"; circ(c, px - s * 0.3, py - s * 0.3, s * 0.35); c.fill();
  }
  c.restore();
}
