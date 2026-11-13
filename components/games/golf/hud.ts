// Kitchen Golf's game HUD, drawn on the canvas in the display face (Lilita One, the promo videos' face): the band at
// the top (hole and par, each player's chip with their strokes), the turn tab under it (whose turn, the live timer,
// your power while you drag), the score banners ("Birdie!"), the little floating words, the first-putt hint, and the
// vignette. Anything with text is painted once into a small canvas and only repainted when what it shows changes, so a
// frame just copies it.
import { GAME_FONT } from "../gameFont";

type C = CanvasRenderingContext2D;
export const NAVY = "#101B2E", NAVY2 = "#24324D", YEL1 = "#FFE65C", YEL2 = "#FFB618", YEL_LIP = "#B86E00";
export const gf = (size: number) => `${size}px ${GAME_FONT}`;
const TAU = Math.PI * 2;

const rgbOf = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/** A #rrggbb colour mixed toward white (t > 0) or black (t < 0). */
export function shade(h: string, t: number) { const p = rgbOf(h), q = t > 0 ? 255 : 0, k = Math.abs(t); return `rgb(${p.map(v => Math.round(v + (q - v) * k)).join(",")})`; }
function lin(c: C, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, s]) => g.addColorStop(o, s)); return g; }
function rr(c: C, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.roundRect(x, y, w, h, r); }

/** Display-face text, optionally with an outline (drawn first, so the fill sits on top of it). */
export function say(c: C, s: string, x: number, y: number, size: number, fill: string | CanvasGradient, stroke?: string, lw = 0, align: CanvasTextAlign = "center") {
  c.font = gf(size); c.textAlign = align; c.textBaseline = "alphabetic";
  if (stroke && lw > 0) { c.lineJoin = "round"; c.miterLimit = 2; c.strokeStyle = stroke; c.lineWidth = lw; c.strokeText(s, x, y); }
  c.fillStyle = fill; c.fillText(s, x, y);
}
/** Shrinks text toward `min` to fit `max` wide, then trims it. */
export function fitText(c: C, s: string, max: number, size: number, min: number) {
  for (let z = size; z >= min; z -= 0.5) { c.font = gf(z); if (c.measureText(s).width <= max) return { s, size: z }; }
  c.font = gf(min); let t = s;
  while (t.length > 1 && c.measureText(t + "…").width > max) t = t.slice(0, -1);
  return { s: t.trimEnd() + "…", size: min };
}

/** A small offscreen canvas, repainted only when its key changes (or the screen's pixel density does). */
export class Layer {
  private cv: HTMLCanvasElement | null = null;
  private g: C | null = null;
  private key = "";
  private px = 0;
  constructor(public w: number, public h: number) {}
  reset() { this.key = ""; }
  get(px: number, key: string, paint: (g: C) => void) {
    if (!this.cv || this.px !== px) {
      this.cv = document.createElement("canvas"); this.cv.width = Math.ceil(this.w * px); this.cv.height = Math.ceil(this.h * px);
      this.g = this.cv.getContext("2d")!; this.px = px; this.key = "";
    }
    if (key !== this.key) {
      const g = this.g!; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.cv.width, this.cv.height); g.setTransform(px, 0, 0, px, 0, 0);
      paint(g); this.key = key;
    }
    return this.cv;
  }
}

// ── the band ──
export type Chip = { name: string; strokes: number; done: boolean; picked: boolean; color: string; active: boolean };
export type Band = { hole: number; par: number; place: string; chips: Chip[] };
export const bandKey = (b: Band) => `${b.hole}|${b.par}|${b.place}|${b.chips.map(c => `${c.name},${c.strokes},${+c.done},${+c.picked},${c.color},${+c.active}`).join(";")}`;

/** The band at the top of the board, `top` tall and `w` wide, with its soft shadow on the board underneath. `ball` is a
 *  little meatball for the players' chips. */
export function paintBand(g: C, b: Band, top: number, w: number, px: number, ball: CanvasImageSource | null) {
  g.fillStyle = lin(g, 0, 0, 0, top, [[0, "#21468c"], [0.55, NAVY2], [1, NAVY]]); g.fillRect(0, 0, w, top);
  g.fillStyle = "rgba(255,255,255,0.06)"; g.fillRect(0, 0, w, top * 0.48);
  g.fillStyle = "rgba(120,170,255,0.22)"; g.fillRect(0, top - 3.5, w, 1);
  g.fillStyle = "#081430"; g.fillRect(0, top - 2.5, w, 2.5);
  g.fillStyle = lin(g, 0, top, 0, top + 11, [[0, "rgba(4,10,28,0.42)"], [1, "rgba(4,10,28,0)"]]); g.fillRect(0, top, w, 11);

  const anyActive = b.chips.some(c => c.active), cw = 141, ch = 40, cy = 27.5;
  b.chips.forEach((p, k) => {
    const right = k === 1, x0 = right ? w - 7 - cw : 7, ax = right ? x0 + cw - 20 : x0 + 20, nx = right ? x0 + 21 : x0 + cw - 21;
    g.save();
    if (anyActive && !p.active) g.globalAlpha = 0.72;
    if (p.active) { g.shadowColor = p.color; g.shadowBlur = 12 * px; }
    g.fillStyle = p.active ? lin(g, 0, cy - ch / 2, 0, cy + ch / 2, [[0, "rgba(255,255,255,0.22)"], [1, "rgba(255,255,255,0.08)"]]) : "rgba(3,10,30,0.38)";
    rr(g, x0, cy - ch / 2, cw, ch, ch / 2); g.fill();
    g.shadowColor = "transparent"; g.shadowBlur = 0;
    if (p.active) { g.strokeStyle = shade(p.color, 0.15); g.lineWidth = 2.4; rr(g, x0 + 1.2, cy - ch / 2 + 1.2, cw - 2.4, ch - 2.4, ch / 2 - 1.2); g.stroke(); }
    else { g.strokeStyle = "rgba(255,255,255,0.1)"; g.lineWidth = 1; rr(g, x0 + 0.5, cy - ch / 2 + 0.5, cw - 1, ch - 1, ch / 2 - 0.5); g.stroke(); }
    // the player's colour, with their meatball in it
    g.fillStyle = lin(g, 0, cy - 15, 0, cy + 15, [[0, shade(p.color, 0.3)], [1, shade(p.color, -0.12)]]); g.beginPath(); g.arc(ax, cy, 15, 0, TAU); g.fill();
    g.strokeStyle = "#ffffff"; g.lineWidth = 2; g.stroke();
    if (ball) g.drawImage(ball, ax - 11, cy - 11.5, 22, 22);
    if (p.done) {   // a badge: holed (green tick) or picked up (red)
      const bx = ax + (right ? -11 : 11), by = cy + 10;
      g.fillStyle = p.picked ? "#e8505b" : "#2eaa6e"; g.beginPath(); g.arc(bx, by, 6.5, 0, TAU); g.fill(); g.strokeStyle = "#ffffff"; g.lineWidth = 1.6; g.stroke();
      g.lineCap = "round"; g.lineWidth = 1.8; g.beginPath();
      if (p.picked) { g.moveTo(bx - 2.3, by - 2.3); g.lineTo(bx + 2.3, by + 2.3); g.moveTo(bx + 2.3, by - 2.3); g.lineTo(bx - 2.3, by + 2.3); }
      else { g.moveTo(bx - 2.8, by + 0.2); g.lineTo(bx - 0.8, by + 2.2); g.lineTo(bx + 2.9, by - 2.2); }
      g.stroke();
    }
    // name, what happened, strokes
    const nameX = right ? ax - 20 : ax + 20, room = Math.abs((right ? nx + 15 : nx - 15) - nameX), align: CanvasTextAlign = right ? "right" : "left";
    const f = fitText(g, p.name, room, 15, 11), status = p.picked ? "Picked Up" : p.done ? "Holed Out" : "";
    if (status) { say(g, f.s, nameX, cy + 0.5, f.size, "#ffffff", undefined, 0, align); say(g, status, nameX, cy + 12.5, 10, p.picked ? "#ffa3a9" : "#8debb4", undefined, 0, align); }
    else say(g, f.s, nameX, cy + 5.5, f.size, "#ffffff", undefined, 0, align);
    say(g, String(p.strokes), nx, cy + 9, 25, p.active ? lin(g, 0, cy - 10, 0, cy + 9, [[0, "#FFF3A0"], [1, YEL2]]) : "#ffffff", NAVY, 5);
    g.restore();
  });

  // the middle: hole and par as one chunky pill, the place underneath
  const cx = w / 2, ht = `Hole ${b.hole}`, pt = `Par ${b.par}`;
  g.font = gf(15); const hw = g.measureText(ht).width + 15; g.font = gf(12); const pw = g.measureText(pt).width + 13;
  const tot = hw + pw, s = Math.min(1, 104 / tot), y0 = 6, hh = 24;
  g.save(); g.translate(cx, y0); g.scale(s, s); g.translate(-tot / 2, 0);
  g.fillStyle = YEL_LIP; rr(g, 0, 2.5, tot, hh, hh / 2); g.fill();
  g.fillStyle = lin(g, 0, 0, 0, hh, [[0, YEL1], [1, YEL2]]); rr(g, 0, 0, tot, hh, hh / 2); g.fill();
  g.fillStyle = "rgba(255,255,255,0.4)"; rr(g, 6, 2, hw - 10, hh * 0.36, 5); g.fill();
  g.fillStyle = NAVY; rr(g, hw - 2, 3, pw - 1, hh - 6, (hh - 6) / 2); g.fill();
  say(g, ht, hw / 2 + 1, 17.5, 15, NAVY);
  say(g, pt, hw - 2 + (pw - 1) / 2, 16.5, 12, "#ffffff");
  g.restore();
  const pf = fitText(g, b.place, 104, 11.5, 9);
  say(g, pf.s, cx, 47.5, pf.size, "rgba(255,255,255,0.8)");
}

// ── the turn tab ──
export type Tab = { kind: "you" | "them" | "wait" | "power"; text: string; color: string; secs?: number; frac?: number; power?: number };
export const TAB_W = 260, TAB_H = 40;
export const tabKey = (t: Tab) => `${t.kind}|${t.text}|${t.color}|${t.secs ?? ""}|${t.frac === undefined ? "" : Math.round(t.frac * 60)}|${t.power === undefined ? "" : Math.round(t.power * 100)}`;
/** The pill that hangs under the band: whose turn it is (and the live timer), or your power while you drag. */
export function paintTab(g: C, t: Tab, px: number) {
  const cx = TAB_W / 2, y0 = 6, h = 26;
  g.shadowColor = "rgba(4,10,28,0.35)"; g.shadowBlur = 6 * px; g.shadowOffsetY = 2 * px;
  if (t.kind === "power") {
    const pw = Math.max(0, Math.min(1, t.power ?? 0)), w = 204, x0 = cx - w / 2;
    g.fillStyle = "#081430"; rr(g, x0, y0 + 2.5, w, h, h / 2); g.fill();
    g.shadowColor = "transparent"; g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.fillStyle = lin(g, 0, y0, 0, y0 + h, [[0, "#2A3852"], [1, NAVY2]]); rr(g, x0, y0, w, h, h / 2); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = 1; rr(g, x0 + 0.5, y0 + 0.5, w - 1, h - 1, h / 2 - 0.5); g.stroke();
    say(g, "Power", x0 + 13, y0 + 18, 13, "#ffffff", undefined, 0, "left");
    const tx0 = x0 + 62, tw = w - 62 - 46, ty = y0 + h / 2 - 5.5;
    g.fillStyle = "rgba(0,0,0,0.42)"; rr(g, tx0, ty, tw, 11, 5.5); g.fill();
    if (pw > 0.01) {
      g.save(); rr(g, tx0, ty, Math.max(11, tw * pw), 11, 5.5); g.clip();
      g.fillStyle = lin(g, tx0, 0, tx0 + tw, 0, [[0, "#3bd16f"], [0.5, "#FFD93D"], [0.8, "#FF9A2E"], [1, "#FF4757"]]); g.fillRect(tx0, ty, tw, 11);
      g.fillStyle = "rgba(255,255,255,0.4)"; g.fillRect(tx0, ty + 1, tw, 3.2);
      g.restore();
    }
    const col = pw > 0.85 ? "#FF6B76" : pw > 0.6 ? "#FFD93D" : "#7BE59E";
    say(g, `${Math.round(pw * 100)}%`, x0 + w - 13, y0 + 18, 13, col, undefined, 0, "right");
    return;
  }
  const timer = t.secs !== undefined;
  g.font = gf(15); const tw = g.measureText(t.text).width, w = tw + 30 + (timer ? 25 : 0), x0 = cx - w / 2;
  const [top, bot, lip, ink, edge] = t.kind === "you" ? [YEL1, YEL2, YEL_LIP, NAVY, ""]
    : t.kind === "wait" ? ["#3d61a6", "#24447f", "#081430", "#ffffff", NAVY]
    : [shade(t.color, 0.22), shade(t.color, -0.06), shade(t.color, -0.45), "#ffffff", shade(t.color, -0.5)];
  g.fillStyle = lip; rr(g, x0, y0 + 2.5, w, h, h / 2); g.fill();
  g.shadowColor = "transparent"; g.shadowBlur = 0; g.shadowOffsetY = 0;
  g.fillStyle = lin(g, 0, y0, 0, y0 + h, [[0, top], [1, bot]]); rr(g, x0, y0, w, h, h / 2); g.fill();
  g.fillStyle = "rgba(255,255,255,0.32)"; rr(g, x0 + 7, y0 + 2, w - 14, h * 0.36, 6); g.fill();
  say(g, t.text, x0 + 15 + tw / 2, y0 + 18.5, 15, ink, edge || undefined, edge ? 3 : 0);
  if (timer) {   // the live putt clock: a ring that drains, red for the last five seconds
    const rx = x0 + w - 17, ry = y0 + h / 2, low = (t.secs ?? 0) <= 5, ringInk = low ? "#e8505b" : t.kind === "you" ? NAVY : "#ffffff";
    g.lineWidth = 2.6; g.strokeStyle = t.kind === "you" ? "rgba(14,31,69,0.18)" : "rgba(0,0,0,0.25)"; g.beginPath(); g.arc(rx, ry, 8.2, 0, TAU); g.stroke();
    g.strokeStyle = ringInk; g.lineCap = "round"; g.beginPath(); g.arc(rx, ry, 8.2, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.001, Math.min(1, t.frac ?? 0))); g.stroke();
    say(g, String(t.secs), rx, ry + 3.6, 10, ringInk);
  }
}

// ── banners and floating words ──
export type Tone = "gold" | "blue" | "plain";
/** A score banner ("Birdie!") in the display face: thick navy outline, a soft drop shadow, a gold or white fill. */
export function makeBanner(text: string, tone: Tone, px: number) {
  const size = tone === "plain" ? 34 : tone === "blue" ? 40 : 46, cv = document.createElement("canvas"), m = cv.getContext("2d")!;
  m.font = gf(size); const w = m.measureText(text).width + size * 0.9, h = size * 1.7;
  cv.width = Math.ceil(w * px); cv.height = Math.ceil(h * px);
  const g = cv.getContext("2d")!; g.setTransform(px, 0, 0, px, 0, 0);
  const base = h * 0.66;
  g.font = gf(size); g.textAlign = "center"; g.textBaseline = "alphabetic"; g.lineJoin = "round"; g.miterLimit = 2;
  g.shadowColor = "rgba(6,14,36,0.5)"; g.shadowBlur = 8 * px; g.shadowOffsetY = 4 * px;
  g.strokeStyle = NAVY; g.lineWidth = size * 0.24; g.strokeText(text, w / 2, base);
  g.shadowColor = "transparent"; g.shadowBlur = 0; g.shadowOffsetY = 0;
  g.strokeStyle = tone === "gold" ? "#7a3d00" : "#20407a"; g.lineWidth = size * 0.08; g.strokeText(text, w / 2, base + size * 0.04);
  g.fillStyle = lin(g, 0, base - size * 0.78, 0, base + size * 0.08, tone === "gold" ? [[0, "#FFFBD0"], [0.42, "#FFE54A"], [1, "#FFA914"]]
    : tone === "blue" ? [[0, "#ffffff"], [1, "#bcd8ff"]] : [[0, "#ffffff"], [1, "#dfe5ee"]]);
  g.fillText(text, w / 2, base);
  return { cv, w, h };
}
/** A small word that floats up off the board ("Splash! +1 Stroke"), outlined so it reads on any surface. */
export function makeFloat(text: string, fill: string, px: number) {
  const size = 17, cv = document.createElement("canvas"), m = cv.getContext("2d")!;
  m.font = gf(size); const w = m.measureText(text).width + 14, h = size * 1.6;
  cv.width = Math.ceil(w * px); cv.height = Math.ceil(h * px);
  const g = cv.getContext("2d")!; g.setTransform(px, 0, 0, px, 0, 0);
  g.shadowColor = "rgba(6,14,36,0.4)"; g.shadowBlur = 4 * px; g.shadowOffsetY = 2 * px;
  say(g, text, w / 2, h * 0.68, size, fill, NAVY, 4.5);
  return { cv, w, h };
}

/** Soft rays turning behind a big banner (a hole in one, an eagle). */
export function drawRays(c: C, x: number, y: number, r: number, rot: number, a: number) {
  c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha = a;
  const glow = c.createRadialGradient(0, 0, r * 0.1, 0, 0, r); glow.addColorStop(0, "rgba(255,236,120,0.75)"); glow.addColorStop(1, "rgba(255,236,120,0)");
  c.fillStyle = glow; c.beginPath();
  for (let i = 0; i < 12; i++) { const a0 = (i * TAU) / 12, a1 = a0 + TAU / 30; c.moveTo(0, 0); c.lineTo(Math.cos(a0) * r, Math.sin(a0) * r); c.lineTo(Math.cos(a1) * r, Math.sin(a1) * r); c.closePath(); }
  c.fill(); c.restore();
}
/** A four-point twinkle. */
export function drawSparkle(c: C, x: number, y: number, s: number, a: number, col = "#FFF6B0") {
  if (a <= 0.01 || s <= 0.1) return;
  c.globalAlpha = a; c.fillStyle = col; c.beginPath();
  c.moveTo(x, y - s); c.quadraticCurveTo(x, y, x + s, y); c.quadraticCurveTo(x, y, x, y + s); c.quadraticCurveTo(x, y, x - s, y); c.quadraticCurveTo(x, y, x, y - s);
  c.fill(); c.globalAlpha = 1;
}

/** The first putt's hint: a navy pill saying what to do, a little chevron underneath nudging the way. */
export function drawHint(c: C, cx: number, y: number, t: number) {
  const w = 214, h = 40, a = 0.88 + 0.12 * Math.sin(t / 300), bob = Math.sin(t / 220) * 2.5;
  c.save(); c.globalAlpha = a;
  c.fillStyle = "rgba(4,10,28,0.35)"; rr(c, cx - w / 2 + 1, y + 4, w, h, h / 2); c.fill();
  c.fillStyle = lin(c, 0, y, 0, y + h, [[0, "#2A3852"], [1, NAVY]]); rr(c, cx - w / 2, y, w, h, h / 2); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 2; rr(c, cx - w / 2 + 1, y + 1, w - 2, h - 2, h / 2 - 1); c.stroke();
  say(c, "Drag Back To Putt", cx, y + 27, 19, "#ffffff");
  c.strokeStyle = "#ffffff"; c.lineWidth = 3.2; c.lineCap = "round"; c.lineJoin = "round";
  for (let i = 0; i < 2; i++) { const yy = y + h + 9 + i * 8 + bob; c.globalAlpha = a * (i ? 0.55 : 0.95); c.beginPath(); c.moveTo(cx - 7, yy); c.lineTo(cx, yy + 5); c.lineTo(cx + 7, yy); c.stroke(); }
  c.restore();
}

/** A soft darkening toward the board's edges, so the course pops (drawn small: it's only a gradient). */
export function makeVignette(w: number, h: number) {
  const cv = document.createElement("canvas"); cv.width = Math.ceil(w / 2); cv.height = Math.ceil(h / 2);
  const g = cv.getContext("2d")!; g.scale(0.5, 0.5);
  const v = g.createRadialGradient(w / 2, h * 0.55, h * 0.36, w / 2, h * 0.55, h * 0.78);
  v.addColorStop(0, "rgba(8,16,40,0)"); v.addColorStop(0.7, "rgba(8,16,40,0.12)"); v.addColorStop(1, "rgba(8,16,40,0.32)");
  g.fillStyle = v; g.fillRect(0, 0, w, h);
  return cv;
}
