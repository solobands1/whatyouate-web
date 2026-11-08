// Pea Tanks art: everything on the table, drawn in canvas (no image files except the food icons). Pure drawing
// functions, so the game and the little previews on the cards share them. Calm colours, soft shadows, one light
// source (top left).
import { AW, AH, TANK_R, PEA_R, MINE_ARM, MINE_LIFE, MINE_BLAST, type Ob, type Zone, type Kind, type Mine, type Basket, type Pt } from "./tankSim";

type C = CanvasRenderingContext2D;
export type Imgs = Record<string, HTMLImageElement>;
const img = (imgs: Imgs, code: string) => { const i = imgs[code]; return i && i.complete && i.naturalWidth ? i : null; };
const rr = (g: C, x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
function shade(hex: string, k: number) {   // k < 0 darker, k > 0 lighter
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255, t = k < 0 ? 0 : 255, f = Math.abs(k);
  return `rgb(${Math.round(r + (t - r) * f)},${Math.round(gg + (t - gg) * f)},${Math.round(b + (t - b) * f)})`;
}

// ── who looks like what ─────────────────────────────────────────────────────
export type Look = { body: string; pattern: "plain" | "crumbs" | "sauce" | "seeds" | "speckles" | "kernels" | "sesame" | "salt" | "shell"; straw: number; strawW: number; twin: boolean; stripe: string };
export const PLAYER_LOOKS: Look[] = [
  { body: "#3f7fd6", pattern: "plain", straw: 13, strawW: 5, twin: false, stripe: "#3f7fd6" },
  { body: "#e8505b", pattern: "plain", straw: 13, strawW: 5, twin: false, stripe: "#e8505b" },
  { body: "#2eaa6e", pattern: "plain", straw: 13, strawW: 5, twin: false, stripe: "#2eaa6e" },
];
export const LOOKS: Record<Exclude<Kind, "player">, Look> = {
  crouton: { body: "#e3a83a", pattern: "crumbs", straw: 11, strawW: 6, twin: false, stripe: "#a8742a" },
  meatball: { body: "#a8432f", pattern: "sauce", straw: 10, strawW: 7, twin: false, stripe: "#7a3b22" },
  chili: { body: "#d64545", pattern: "seeds", straw: 17, strawW: 4, twin: false, stripe: "#2e8b3e" },
  jelly: { body: "#b866c9", pattern: "speckles", straw: 11, strawW: 5, twin: false, stripe: "#8a3f9c" },
  popcorn: { body: "#efd98f", pattern: "kernels", straw: 11, strawW: 4, twin: true, stripe: "#d24b4b" },
  bagel: { body: "#3aa39a", pattern: "sesame", straw: 12, strawW: 7, twin: false, stripe: "#1f6f68" },
  pretzel: { body: "#5a3a24", pattern: "salt", straw: 9, strawW: 5, twin: false, stripe: "#f2ece0" },
  coconut: { body: "#ece5d8", pattern: "shell", straw: 11, strawW: 6, twin: false, stripe: "#8b6b52" },
};

// ── the table: checked cloth inside a wooden edge ─────────────────────────────
export function drawFloor(g: C) {
  g.fillStyle = "#f4f7fb"; g.fillRect(0, 0, AW, AH);
  const s = 24;   // a soft gingham: bands both ways, darker where they cross
  g.fillStyle = "rgba(120,160,215,0.075)";
  for (let x = 0; x < AW; x += s * 2) g.fillRect(x, 0, s, AH);
  for (let y = 0; y < AH; y += s * 2) g.fillRect(0, y, AW, s);
  // the wooden table edge
  const e = 6, wood = g.createLinearGradient(0, 0, AW, AH); wood.addColorStop(0, "#c8935e"); wood.addColorStop(1, "#a8723f");
  g.fillStyle = wood; g.fillRect(0, 0, AW, e); g.fillRect(0, AH - e, AW, e); g.fillRect(0, 0, e, AH); g.fillRect(AW - e, 0, e, AH);
  g.strokeStyle = "rgba(90,55,25,0.35)"; g.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    g.beginPath(); g.moveTo(0, 1.5 + k * 1.5); for (let x = 0; x <= AW; x += 30) g.lineTo(x, 1.5 + k * 1.5 + Math.sin(x / 23 + k) * 0.6); g.stroke();
    g.beginPath(); g.moveTo(0, AH - 4.5 + k * 1.5); for (let x = 0; x <= AW; x += 30) g.lineTo(x, AH - 4.5 + k * 1.5 + Math.sin(x / 19 + k) * 0.6); g.stroke();
  }
  g.strokeStyle = "rgba(60,35,15,0.25)"; g.lineWidth = 1.5; g.strokeRect(e, e, AW - 2 * e, AH - 2 * e);
}

// ── spills ───────────────────────────────────────────────────────────────────
function blob(g: C, z: Zone, wob: number) {
  g.beginPath();
  for (let k = 0; k <= 24; k++) {
    const a = (k / 24) * Math.PI * 2, r = 1 + Math.sin(a * 3 + z.x) * wob + Math.cos(a * 5 + z.y) * wob * 0.6;
    const x = z.x + Math.cos(a) * (z.w / 2) * r, y = z.y + Math.sin(a) * (z.h / 2) * r;
    if (k) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
}
/** Spills under the lunchboxes (milk, syrup, the sink). Herbs go on top: drawHerbs. */
export function drawZone(g: C, z: Zone) {
  if (z.k === 0) {
    blob(g, z, 0.08); g.fillStyle = "rgba(255,255,255,0.92)"; g.fill(); g.strokeStyle = "rgba(170,190,215,0.6)"; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = "rgba(255,255,255,1)"; g.beginPath(); g.ellipse(z.x - z.w * 0.15, z.y - z.h * 0.18, z.w * 0.14, z.h * 0.08, -0.3, 0, 7); g.fill();
    g.fillStyle = "rgba(190,210,235,0.35)"; g.beginPath(); g.ellipse(z.x + z.w * 0.12, z.y + z.h * 0.15, z.w * 0.2, z.h * 0.12, 0.2, 0, 7); g.fill();
  } else if (z.k === 1) {
    blob(g, z, 0.1); const gr = g.createRadialGradient(z.x - z.w * 0.1, z.y - z.h * 0.1, 2, z.x, z.y, z.w / 2);
    gr.addColorStop(0, "rgba(214,140,40,0.85)"); gr.addColorStop(1, "rgba(150,80,20,0.8)"); g.fillStyle = gr; g.fill();
    g.fillStyle = "rgba(255,230,170,0.55)"; g.beginPath(); g.ellipse(z.x - z.w * 0.18, z.y - z.h * 0.2, z.w * 0.12, z.h * 0.06, -0.4, 0, 7); g.fill();
  } else if (z.k === 2) {
    rr(g, z.x - z.w / 2 - 4, z.y - z.h / 2 - 4, z.w + 8, z.h + 8, 10); const steel = g.createLinearGradient(0, z.y - z.h / 2, 0, z.y + z.h / 2);
    steel.addColorStop(0, "#e6ebf1"); steel.addColorStop(1, "#aab4c0"); g.fillStyle = steel; g.fill();
    rr(g, z.x - z.w / 2, z.y - z.h / 2, z.w, z.h, 7); const water = g.createLinearGradient(0, z.y - z.h / 2, 0, z.y + z.h / 2);
    water.addColorStop(0, "#9fd0f2"); water.addColorStop(1, "#5aa7de"); g.fillStyle = water; g.fill();
    g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) { g.beginPath(); const yy = z.y - z.h / 4 + k * z.h / 4; g.moveTo(z.x - z.w / 3, yy); g.quadraticCurveTo(z.x - z.w / 6, yy - 3, z.x, yy); g.quadraticCurveTo(z.x + z.w / 6, yy + 3, z.x + z.w / 3, yy); g.stroke(); }
    g.fillStyle = "#8b96a3"; g.beginPath(); g.arc(z.x + z.w / 2 - 9, z.y - z.h / 2 + 9, 4, 0, 7); g.fill();   // the plug hole
  }
}
export function drawHerbs(g: C, z: Zone, t: number) {
  if (z.k !== 3) return;
  blob(g, z, 0.06); g.fillStyle = "rgba(76,150,70,0.55)"; g.fill();
  const n = Math.round((z.w * z.h) / 90);
  for (let k = 0; k < n; k++) {
    const a = (k * 2.399) % (Math.PI * 2), r = Math.sqrt((k + 0.5) / n) * 0.92, x = z.x + Math.cos(a) * (z.w / 2) * r, y = z.y + Math.sin(a) * (z.h / 2) * r;
    const sway = Math.sin(t / 900 + k) * 0.15;
    g.save(); g.translate(x, y); g.rotate(a + sway);
    g.fillStyle = k % 3 === 0 ? "rgba(56,128,52,0.9)" : k % 3 === 1 ? "rgba(88,166,72,0.88)" : "rgba(120,190,90,0.85)";
    g.beginPath(); g.ellipse(0, 0, 7, 3.4, 0, 0, 7); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-5, 0); g.lineTo(5, 0); g.stroke();
    g.restore();
  }
}

// ── cover ────────────────────────────────────────────────────────────────────
const BOX = [["#f2994a", "#d77a2a"], ["#e8505b", "#c43d48"], ["#4f9ad8", "#3a7dbb"]], MUGS = ["#ffffff", "#7fb8e6", "#f2c14e"];
export function drawShadow(g: C, o: Ob) {
  g.fillStyle = "rgba(40,60,90,0.16)";
  if (o.k === 1) { g.beginPath(); g.ellipse(o.x + 3, o.y + 5, o.r, o.r * 0.95, 0, 0, 7); g.fill(); }
  else { rr(g, o.x - o.w / 2 + 3, o.y - o.h / 2 + 5, o.w, o.h, 5); g.fill(); }
}
export function drawCover(g: C, o: Ob, imgs: Imgs, fruit: string[][]) {
  if (o.k === 1 && o.s === 0) {   // fruit bowl
    const gr = g.createRadialGradient(o.x - o.r * 0.35, o.y - o.r * 0.35, 2, o.x, o.y, o.r);
    gr.addColorStop(0, "#ffffff"); gr.addColorStop(1, "#dfe6ef"); g.fillStyle = gr; g.beginPath(); g.arc(o.x, o.y, o.r, 0, 7); g.fill();
    g.strokeStyle = "#c3cedc"; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = "#eef3f9"; g.beginPath(); g.arc(o.x, o.y, o.r * 0.78, 0, 7); g.fill();
    const fr = fruit[o.c % fruit.length], s = o.r * 0.95, spots = [[-0.3, -0.25], [0.32, -0.12], [-0.05, 0.32]];
    fr.forEach((f, j) => { const im = img(imgs, f); if (im) g.drawImage(im, o.x + spots[j][0] * o.r - s / 2, o.y + spots[j][1] * o.r - s / 2, s, s); });
  } else if (o.k === 1 && o.s === 1) {   // mug of tea
    const col = MUGS[o.c % 3];
    g.fillStyle = shade(col === "#ffffff" ? "#e8edf3" : col, -0.15); rr(g, o.x + o.r - 3, o.y - 4, 9, 8, 3); g.fill();   // handle
    const gr = g.createRadialGradient(o.x - o.r * 0.4, o.y - o.r * 0.4, 1, o.x, o.y, o.r);
    gr.addColorStop(0, shade(col === "#ffffff" ? "#f4f7fb" : col, 0.35)); gr.addColorStop(1, shade(col === "#ffffff" ? "#dce3ec" : col, -0.12));
    g.fillStyle = gr; g.beginPath(); g.arc(o.x, o.y, o.r, 0, 7); g.fill();
    g.fillStyle = "#7a4a2a"; g.beginPath(); g.arc(o.x, o.y, o.r * 0.72, 0, 7); g.fill();
    g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.ellipse(o.x - o.r * 0.25, o.y - o.r * 0.25, o.r * 0.25, o.r * 0.12, -0.6, 0, 7); g.fill();
  } else if (o.k === 1) {   // salt shaker
    g.fillStyle = "#f4f6f9"; g.beginPath(); g.arc(o.x, o.y, o.r, 0, 7); g.fill();
    g.strokeStyle = "#b9c2cd"; g.lineWidth = 2; g.beginPath(); g.arc(o.x, o.y, o.r - 1.5, 0, 7); g.stroke();
    g.fillStyle = "#8d97a3"; for (const [dx, dy] of [[0, 0], [-3, -2], [3, -2], [-2, 3], [2, 3]]) { g.beginPath(); g.arc(o.x + dx, o.y + dy, 0.9, 0, 7); g.fill(); }
  } else if (o.s === 0) {   // cereal box: gets dented, then cracks
    const [c1, c2] = BOX[o.c % 3], x = o.x - o.w / 2, y = o.y - o.h / 2;
    const gr = g.createLinearGradient(x, y, x + o.w, y + o.h); gr.addColorStop(0, shade(c1, 0.12)); gr.addColorStop(1, c1);
    g.fillStyle = gr; rr(g, x, y, o.w, o.h, 3); g.fill(); g.strokeStyle = c2; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.45)"; g.lineWidth = 1;   // the top flaps
    if (o.w >= o.h) { g.beginPath(); g.moveTo(x + 3, o.y); g.lineTo(x + o.w - 3, o.y); g.stroke(); } else { g.beginPath(); g.moveTo(o.x, y + 3); g.lineTo(o.x, y + o.h - 3); g.stroke(); }
    const lw = Math.min(o.w, o.h) * 0.62;
    g.fillStyle = "rgba(255,255,255,0.92)"; rr(g, o.x - lw / 2, o.y - lw / 2, lw, lw, 4); g.fill();
    const im = img(imgs, "1f963"); if (im) g.drawImage(im, o.x - lw * 0.4, o.y - lw * 0.4, lw * 0.8, lw * 0.8);
    if (o.hp !== undefined && o.hp < 3) {
      g.strokeStyle = "rgba(60,30,10,0.55)"; g.lineWidth = 1.2; g.beginPath();
      g.moveTo(x + o.w * 0.2, y + 2); g.lineTo(x + o.w * 0.35, y + o.h * 0.4); g.lineTo(x + o.w * 0.28, y + o.h * 0.7);
      if (o.hp < 2) { g.moveTo(x + o.w - 2, y + o.h * 0.3); g.lineTo(x + o.w * 0.7, y + o.h * 0.55); g.lineTo(x + o.w * 0.78, y + o.h - 2); }
      g.stroke();
    }
  } else if (o.s === 1) {   // cutting board
    const x = o.x - o.w / 2, y = o.y - o.h / 2, gr = g.createLinearGradient(x, y, x, y + o.h);
    gr.addColorStop(0, "#e2b57e"); gr.addColorStop(1, "#c8955a"); g.fillStyle = gr; rr(g, x, y, o.w, o.h, 7); g.fill();
    g.strokeStyle = "#a7743f"; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = "rgba(140,90,40,0.3)"; g.lineWidth = 1;
    const along = o.w >= o.h;
    for (let k = 1; k < 4; k++) { g.beginPath(); if (along) { const yy = y + (o.h * k) / 4; g.moveTo(x + 6, yy); g.bezierCurveTo(x + o.w * 0.3, yy - 2, x + o.w * 0.6, yy + 2, x + o.w - 6, yy); } else { const xx = x + (o.w * k) / 4; g.moveTo(xx, y + 6); g.bezierCurveTo(xx - 2, y + o.h * 0.3, xx + 2, y + o.h * 0.6, xx, y + o.h - 6); } g.stroke(); }
    g.fillStyle = "rgba(90,55,25,0.55)"; g.beginPath(); g.arc(along ? x + 9 : o.x, along ? o.y : y + 9, 3, 0, 7); g.fill();   // the hanging hole
  } else {   // bread wall (from the power-up): a toasty loaf, fading at the end
    const x = o.x - o.w / 2, y = o.y - o.h / 2, gr = g.createLinearGradient(x, y, x, y + o.h);
    g.globalAlpha = Math.min(1, (o.ttl ?? 1) / 1);
    gr.addColorStop(0, "#f1c27d"); gr.addColorStop(1, "#c98a3c"); g.fillStyle = gr; rr(g, x, y, o.w, o.h, 6); g.fill();
    g.strokeStyle = "#a86a26"; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = "rgba(255,240,200,0.6)"; g.lineWidth = 1.2;
    const along = o.w >= o.h, n = Math.max(2, Math.round((along ? o.w : o.h) / 12));
    for (let k = 1; k < n; k++) { g.beginPath(); if (along) { const xx = x + (o.w * k) / n; g.moveTo(xx - 2, y + 3); g.lineTo(xx + 2, y + o.h - 3); } else { const yy = y + (o.h * k) / n; g.moveTo(x + 3, yy - 2); g.lineTo(x + o.w - 3, yy + 2); } g.stroke(); }
    g.globalAlpha = 1;
  }
}

// ── lunchboxes ───────────────────────────────────────────────────────────────
function pattern(g: C, look: Look) {
  const p = look.pattern;
  if (p === "plain") { g.fillStyle = "rgba(255,255,255,0.85)"; g.fillRect(-9, -1.2, 15, 2.4); return; }
  const dots = (pts: number[][], col: string, r: number) => { g.fillStyle = col; for (const [x, y] of pts) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } };
  if (p === "crumbs") dots([[-7, -5], [-2, 4], [4, -4], [6, 5], [-8, 3]], "rgba(140,90,30,0.7)", 1.3);
  else if (p === "sauce") { g.fillStyle = "rgba(150,30,20,0.55)"; g.beginPath(); g.ellipse(-3, -2, 6, 3.5, 0.4, 0, 7); g.fill(); dots([[5, 4], [-8, 5]], "rgba(70,140,60,0.8)", 1.2); }
  else if (p === "seeds") dots([[-6, -4], [-2, 3], [3, -3], [6, 4], [-7, 4], [1, 0]], "rgba(255,235,170,0.9)", 0.9);
  else if (p === "speckles") dots([[-7, -4], [-3, 3], [2, -5], [6, 3], [-8, 5], [4, 0], [0, 5]], "rgba(255,255,255,0.75)", 1);
  else if (p === "kernels") dots([[-6, -3], [-1, 3], [4, -3], [6, 4], [-7, 4]], "rgba(255,255,255,0.95)", 2.2);
  else if (p === "sesame") { g.strokeStyle = "rgba(120,70,25,0.6)"; g.lineWidth = 2; g.beginPath(); g.arc(-1, 0, 5, 0, 7); g.stroke(); dots([[-8, -5], [6, -5], [-8, 5], [6, 5]], "rgba(255,245,210,0.95)", 1); }
  else if (p === "salt") dots([[-7, -4], [-2, 4], [3, -4], [7, 3], [-5, 1], [1, -1]], "rgba(255,255,255,0.95)", 1.1);
  else if (p === "shell") { g.strokeStyle = "rgba(60,40,25,0.55)"; g.lineWidth = 0.9; for (let k = -8; k <= 8; k += 3) { g.beginPath(); g.moveTo(k, -7); g.lineTo(k + 2, 7); g.stroke(); } }
}
export type TankOpts = { treadL: number; treadR: number; flash: number; shield: boolean; hard: boolean; ghost: number; alpha: number; frozen: boolean };
/** A lunchbox from above: two treads (they roll as it moves), the box with its lid and latch, and a straw on a cap. */
export function drawLunchbox(g: C, x: number, y: number, a: number, ta: number, look: Look, o: TankOpts) {
  g.save(); g.globalAlpha = o.alpha;
  g.fillStyle = "rgba(30,45,70,0.2)"; g.beginPath(); g.ellipse(x + 2.5, y + 4, 15, 12, 0, 0, 7); g.fill();   // shadow
  g.translate(x, y); g.rotate(a);
  for (const [side, off] of [[-1, o.treadL], [1, o.treadR]]) {   // treads
    const ty = side * 9.5 - 3;
    g.fillStyle = "#3d4553"; rr(g, -13, ty, 26, 6, 2.5); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.22)"; g.lineWidth = 1.2; g.beginPath();
    const ph = ((off % 4) + 4) % 4;
    for (let k = -13 + ph; k < 13; k += 4) { g.moveTo(k, ty + 0.8); g.lineTo(k, ty + 5.2); }
    g.stroke();
  }
  const body = o.frozen ? "#bfe3f5" : look.body;
  const gr = g.createLinearGradient(-11, -9, 11, 9); gr.addColorStop(0, shade(body, 0.2)); gr.addColorStop(1, shade(body, -0.08));
  g.fillStyle = gr; rr(g, -11.5, -8.5, 22, 17, 4); g.fill();
  g.strokeStyle = shade(body, -0.3); g.lineWidth = 1; g.stroke();
  g.save(); rr(g, -10, -7, 19, 14, 3); g.clip(); pattern(g, look); g.restore();
  g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 1; rr(g, -9.5, -6.5, 18, 13, 3); g.stroke();   // lid seam
  g.fillStyle = "rgba(255,255,255,0.9)"; rr(g, 9, -2.5, 2.5, 5, 1); g.fill();   // latch
  if (o.hard) { g.strokeStyle = "rgba(120,90,60,0.95)"; g.lineWidth = 2.2; rr(g, -12.5, -9.5, 24, 19, 5); g.stroke(); }   // coconut's shell, still on
  g.rotate(ta - a);
  const L = look.straw, W = look.strawW;
  for (const dy of look.twin ? [-2.6, 2.6] : [0]) {   // the straw(s)
    g.fillStyle = "#ffffff"; rr(g, 2, dy - W / 2, L + 4, W, W / 2); g.fill();
    g.fillStyle = look.stripe; for (let k = 5; k < L + 4; k += 4.5) g.fillRect(k, dy - W / 2, 2, W);
    g.strokeStyle = "rgba(30,40,60,0.25)"; g.lineWidth = 0.8; rr(g, 2, dy - W / 2, L + 4, W, W / 2); g.stroke();
  }
  const cap = g.createRadialGradient(-1.5, -1.5, 0.5, 0, 0, 5.5); cap.addColorStop(0, shade(body, 0.45)); cap.addColorStop(1, shade(body, -0.2));
  g.fillStyle = cap; g.beginPath(); g.arc(0, 0, 5.5, 0, 7); g.fill(); g.strokeStyle = shade(body, -0.35); g.lineWidth = 1; g.stroke();
  g.restore();
  g.save(); g.globalAlpha = o.alpha;
  if (o.flash > 0) { g.globalAlpha = o.flash * 0.75; g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); g.globalAlpha = o.alpha; }
  if (o.shield) {   // lettuce shield
    g.strokeStyle = "rgba(90,170,70,0.75)"; g.lineWidth = 3; g.beginPath(); g.arc(x, y, TANK_R + 6, 0, 7); g.stroke();
    g.fillStyle = "rgba(120,200,90,0.16)"; g.beginPath(); g.arc(x, y, TANK_R + 6, 0, 7); g.fill();
    for (let k = 0; k < 6; k++) { const an = (k / 6) * Math.PI * 2; g.fillStyle = "rgba(90,170,70,0.85)"; g.beginPath(); g.ellipse(x + Math.cos(an) * (TANK_R + 6), y + Math.sin(an) * (TANK_R + 6), 3.5, 1.8, an + 1.57, 0, 7); g.fill(); }
  }
  g.restore();
}
/** The little previews on the cards (a lunchbox facing up, straw to the right). */
export function previewLunchbox(c: HTMLCanvasElement, look: Look) {
  const g = c.getContext("2d"); if (!g) return;
  const d = window.devicePixelRatio || 1; c.width = 48 * d; c.height = 48 * d; g.setTransform(d * 1.5, 0, 0, d * 1.5, 0, 0); g.clearRect(0, 0, 32, 32);
  drawLunchbox(g, 16, 15, -Math.PI / 2, -Math.PI / 4, look, { treadL: 0, treadR: 0, flash: 0, shield: false, hard: look.pattern === "shell", ghost: 0, alpha: 1, frozen: false });
}

// ── peas, mines, power-ups, the basket ──────────────────────────────────────
export function drawPea(g: C, x: number, y: number, trail: Pt[] | null, col = "#5fae34") {
  if (trail) for (let k = 0; k < trail.length; k++) { g.globalAlpha = 0.08 + (0.22 * k) / trail.length; g.fillStyle = col; g.beginPath(); g.arc(trail[k].x, trail[k].y, PEA_R * (0.5 + (0.4 * k) / trail.length), 0, 7); g.fill(); }
  g.globalAlpha = 1;
  const gr = g.createRadialGradient(x - 1.2, y - 1.2, 0.5, x, y, PEA_R); gr.addColorStop(0, "#b6e58a"); gr.addColorStop(1, col);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, PEA_R, 0, 7); g.fill();
  g.strokeStyle = "rgba(40,90,25,0.5)"; g.lineWidth = 0.8; g.stroke();
}
export function drawMine(g: C, m: Mine, t: number) {
  const armed = m.t >= MINE_ARM, blink = m.fuse > 0 ? Math.sin(t / 40) > 0 : armed && m.t > MINE_LIFE - 2 ? Math.sin(t / 90) > 0 : false;
  g.fillStyle = "rgba(30,45,70,0.18)"; g.beginPath(); g.ellipse(m.x + 1.5, m.y + 2.5, 8, 6, 0, 0, 7); g.fill();
  const gr = g.createRadialGradient(m.x - 2, m.y - 2.5, 0.5, m.x, m.y, 8); gr.addColorStop(0, "#ff9fb4"); gr.addColorStop(1, m.team === 0 ? "#e2456b" : "#9b3fb5");
  g.fillStyle = gr; g.beginPath(); g.ellipse(m.x, m.y, 8, 6.5, 0.4, 0, 7); g.fill();   // a jelly bean
  g.fillStyle = "rgba(255,255,255,0.6)"; g.beginPath(); g.ellipse(m.x - 2.5, m.y - 2, 2.6, 1.3, -0.5, 0, 7); g.fill();
  g.fillStyle = blink ? "#fff35c" : armed ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.3)"; g.beginPath(); g.arc(m.x + 2.5, m.y + 1, 1.6, 0, 7); g.fill();
  if (m.fuse > 0) { g.strokeStyle = "rgba(255,120,80,0.5)"; g.lineWidth = 1.5; g.beginPath(); g.arc(m.x, m.y, MINE_BLAST * Math.min(1, m.fuse / 0.45), 0, 7); g.stroke(); }
}
export function drawPick(g: C, x: number, y: number, icon: string, life: number, t: number, imgs: Imgs, rot: boolean) {
  const pulse = 1 + 0.08 * Math.sin(t / 220 + x), fade = life < 2 ? 0.4 + 0.6 * Math.abs(Math.sin(t / 120)) : 1;
  g.globalAlpha = fade;
  g.fillStyle = "rgba(255,214,90,0.28)"; g.beginPath(); g.arc(x, y, 14 * pulse, 0, 7); g.fill();
  g.fillStyle = "rgba(30,45,70,0.15)"; g.beginPath(); g.arc(x + 1.5, y + 2.5, 11, 0, 7); g.fill();
  g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); g.strokeStyle = "#f2c94c"; g.lineWidth = 1.5; g.stroke();
  const im = img(imgs, icon); if (im) { g.save(); g.translate(x, y); if (rot) g.rotate(Math.PI); g.drawImage(im, -8, -8, 16, 16); g.restore(); }
  g.globalAlpha = 1;
}
export function drawBasket(g: C, b: Basket, flash: number) {
  g.fillStyle = "rgba(30,45,70,0.2)"; g.beginPath(); g.ellipse(b.x + 2, b.y + 4, b.r + 5, b.r, 0, 0, 7); g.fill();
  g.fillStyle = "#c98f4f"; rr(g, b.x - b.r - 4, b.y - b.r + 2, (b.r + 4) * 2, b.r * 2 - 2, 7); g.fill();
  g.strokeStyle = "rgba(110,65,25,0.6)"; g.lineWidth = 1;
  for (let k = -b.r; k < b.r + 4; k += 4) { g.beginPath(); g.moveTo(b.x + k, b.y - b.r + 3); g.lineTo(b.x + k + 3, b.y + b.r - 1); g.stroke(); }
  for (let k = 0; k < 6; k++) for (let j = 0; j < 2; j++) { g.fillStyle = (k + j) % 2 ? "#ffffff" : "#e8505b"; g.fillRect(b.x - b.r + k * 6, b.y - b.r - 3 + j * 5, 6, 5); }   // the cloth
  g.strokeStyle = "#8a5a2b"; g.lineWidth = 3; g.beginPath(); g.arc(b.x, b.y - 2, b.r - 4, Math.PI * 1.1, Math.PI * 1.9); g.stroke();   // handle
  if (flash > 0) { g.globalAlpha = flash * 0.7; g.fillStyle = "#fff"; rr(g, b.x - b.r - 4, b.y - b.r - 3, (b.r + 4) * 2, b.r * 2 + 3, 7); g.fill(); g.globalAlpha = 1; }
}
// ── effects ──────────────────────────────────────────────────────────────────
export type Fx = { k: "puff" | "splat" | "spark" | "boom" | "crumble" | "block"; x: number; y: number; age: number; a: number; col: string };
export const FX_LIFE: Record<Fx["k"], number> = { puff: 260, splat: 520, spark: 240, boom: 700, crumble: 650, block: 400 };
export function drawFx(g: C, f: Fx) {
  const k = f.age / FX_LIFE[f.k];
  if (f.k === "puff") { g.globalAlpha = 0.7 * (1 - k); g.fillStyle = "#ffffff"; for (let j = 0; j < 3; j++) { const d = 3 + 8 * k; g.beginPath(); g.arc(f.x + Math.cos(f.a + (j - 1) * 0.6) * d, f.y + Math.sin(f.a + (j - 1) * 0.6) * d, 2.5 + 2 * k, 0, 7); g.fill(); } }
  else if (f.k === "splat") { g.globalAlpha = 1 - k; g.fillStyle = f.col; for (let j = 0; j < 7; j++) { const an = j * 0.9 + f.a, d = 2 + 9 * k; g.beginPath(); g.arc(f.x + Math.cos(an) * d, f.y + Math.sin(an) * d, 2.2 * (1 - k * 0.5), 0, 7); g.fill(); } g.beginPath(); g.arc(f.x, f.y, 3.5 * (1 - k), 0, 7); g.fill(); }
  else if (f.k === "spark") { g.globalAlpha = 1 - k; g.strokeStyle = "#ffd75e"; g.lineWidth = 1.5; for (let j = 0; j < 5; j++) { const an = j * 1.26 + f.a, d0 = 2 + 3 * k, d1 = 5 + 6 * k; g.beginPath(); g.moveTo(f.x + Math.cos(an) * d0, f.y + Math.sin(an) * d0); g.lineTo(f.x + Math.cos(an) * d1, f.y + Math.sin(an) * d1); g.stroke(); } }
  else if (f.k === "boom") {
    g.globalAlpha = 0.55 * (1 - k); g.fillStyle = "#ffb3c6"; g.beginPath(); g.arc(f.x, f.y, MINE_BLAST * (0.4 + 0.6 * k), 0, 7); g.fill();
    g.globalAlpha = 1 - k; g.strokeStyle = "#e2456b"; g.lineWidth = 3 * (1 - k) + 1; g.beginPath(); g.arc(f.x, f.y, MINE_BLAST * (0.3 + 0.7 * k), 0, 7); g.stroke();
    g.fillStyle = "#c2345a"; for (let j = 0; j < 10; j++) { const an = j * 0.63, d = 6 + MINE_BLAST * 0.8 * k; g.beginPath(); g.arc(f.x + Math.cos(an) * d, f.y + Math.sin(an) * d, 2.4 * (1 - k) + 0.5, 0, 7); g.fill(); }
  } else if (f.k === "crumble") { g.globalAlpha = 1 - k; g.fillStyle = f.col; for (let j = 0; j < 9; j++) { const an = j * 0.7 + f.a, d = 4 + 20 * k; g.save(); g.translate(f.x + Math.cos(an) * d, f.y + Math.sin(an) * d + 6 * k * k); g.rotate(an + k * 3); g.fillRect(-3, -2, 6, 4); g.restore(); } }
  else if (f.k === "block") { g.globalAlpha = 1 - k; g.strokeStyle = "#5aaa46"; g.lineWidth = 3; g.beginPath(); g.arc(f.x, f.y, TANK_R + 6 + 10 * k, 0, 7); g.stroke(); }
  g.globalAlpha = 1;
}
export type Mark = { x: number; y: number; a: number; age: number };
export function drawMarks(g: C, marks: Mark[]) {
  g.fillStyle = "rgba(70,80,100,1)";
  for (const m of marks) {
    const al = 0.09 * (1 - m.age / 4000); if (al <= 0) continue;
    g.globalAlpha = al; g.save(); g.translate(m.x, m.y); g.rotate(m.a);
    g.fillRect(-2, -12.5, 4, 5); g.fillRect(-2, 7.5, 4, 5);
    g.restore();
  }
  g.globalAlpha = 1;
}
