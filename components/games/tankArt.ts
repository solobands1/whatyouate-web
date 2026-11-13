// Pea Tanks art: everything on the table, drawn in canvas (no image files except the food icons). Pure drawing
// functions, so the game and the little previews on the cards share them. The "Premium Kitchen" look: a woven linen
// gingham cloth inside a walnut rim, real materials on the cover (printed card, maple boards, glazed ceramic, glass and
// steel), soft contact shadows, one warm light from the top left falling into a vignette, and calm effects.
// The cloth and the light are painted once per screen density; the table's cover goes into the game's table canvas;
// lunchboxes, peas and effects are light enough to draw every frame (peas, mines and tokens are cached sprites).
import { AW, AH, TANK_R, PEA_R, MINE_ARM, MINE_LIFE, MINE_BLAST, type Ob, type Zone, type Kind, type Mine, type Basket, type Pt } from "./tankSim";
import { TAU, seeded, circ, ell, line, lin, rad, shade, noShade, mix, lighter, darker, rgba, layer, gloss, contact, rimArc, warmLight, scaleOf, spriteCache, CHROME } from "./art2/paint";

type C = CanvasRenderingContext2D;
export type Imgs = Record<string, HTMLImageElement>;
const img = (imgs: Imgs, code: string) => { const i = imgs[code]; return i && i.complete && i.naturalWidth ? i : null; };
const rr = (g: C, x: number, y: number, w: number, h: number, r: number | number[]) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const sprite = spriteCache();

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

// ── the table: woven gingham inside a walnut rim, and the light over it ─────
const RIM = 6, CORNER = 18;
function crease(g: C, horizontal: boolean, at: number) {
  const a = at - 8, b = at + 8;
  g.fillStyle = horizontal ? lin(g, 0, a, 0, b, [[0, "rgba(255,255,255,0)"], [0.4, "rgba(255,255,255,0.22)"], [0.5, "rgba(70,80,100,0.08)"], [0.64, "rgba(70,80,100,0)"]])
    : lin(g, a, 0, b, 0, [[0, "rgba(255,255,255,0)"], [0.4, "rgba(255,255,255,0.2)"], [0.5, "rgba(70,80,100,0.07)"], [0.64, "rgba(70,80,100,0)"]]);
  if (horizontal) g.fillRect(0, a, AW, 16); else g.fillRect(a, 0, 16, AH);
}
function paintCloth(g: C) {
  const r = seeded(0x7ab1e), s = 24;
  g.fillStyle = "#f8f5ef"; g.fillRect(0, 0, AW, AH);
  g.fillStyle = "rgba(84,124,192,0.15)";
  for (let x = 0; x < AW; x += s * 2) g.fillRect(x, 0, s, AH);
  for (let y = 0; y < AH; y += s * 2) g.fillRect(0, y, AW, s);
  for (let x = 0; x < AW; x += s * 2) for (let t = x; t < x + s; t += 1.25) { g.fillStyle = "rgba(60,96,170,0.05)"; g.fillRect(t, 0, 0.5, AH); }   // the coloured warp threads
  for (let y = 0; y < AH; y += s * 2) for (let t = y; t < y + s; t += 1.25) { g.fillStyle = "rgba(60,96,170,0.05)"; g.fillRect(0, t, AW, 0.5); }
  for (let y = 0, i = 0; y < AH; y += 1.25, i++) { g.fillStyle = i % 2 ? "rgba(255,255,255,0.13)" : "rgba(70,80,100,0.03)"; g.fillRect(0, y, AW, 0.5); }   // the weave
  for (let x = 0, i = 0; x < AW; x += 1.25, i++) { g.fillStyle = i % 2 ? "rgba(255,255,255,0.1)" : "rgba(70,80,100,0.025)"; g.fillRect(x, 0, 0.5, AH); }
  for (let i = 0; i < 2200; i++) {   // slubs in the linen
    g.fillStyle = r() < 0.55 ? `rgba(255,255,255,${0.35 + r() * 0.35})` : `rgba(80,90,110,${0.05 + r() * 0.06})`;
    if (r() < 0.5) g.fillRect(r() * AW, r() * AH, 1.4 + r() * 3.2, 0.42); else g.fillRect(r() * AW, r() * AH, 0.42, 1.4 + r() * 3.2);
  }
  crease(g, true, AH / 2); crease(g, false, AW / 2); crease(g, true, AH / 4 - 4); crease(g, true, (AH * 3) / 4 + 4);
  for (let i = 0; i < 4; i++) {   // a few broad, soft wrinkles
    const x = r() * AW, y = r() * AH, R = 60 + r() * 70;
    g.save(); g.translate(x, y); g.rotate(r() * Math.PI); g.scale(1, 0.25);
    g.fillStyle = rad(g, 0, 0, 0, R, [[0, "rgba(255,255,255,0.12)"], [0.5, "rgba(80,90,110,0.04)"], [1, "rgba(80,90,110,0)"]]); circ(g, 0, 0, R); g.fill(); g.restore();
  }
  // the rim's shadow on the cloth, along the top and left
  g.save(); rr(g, RIM, RIM, AW - 2 * RIM, AH - 2 * RIM, CORNER - RIM); g.clip();
  g.fillStyle = lin(g, 0, RIM, 0, RIM + 13, [[0, "rgba(50,28,8,0.26)"], [1, "rgba(50,28,8,0)"]]); g.fillRect(0, RIM, AW, 13);
  g.fillStyle = lin(g, RIM, 0, RIM + 13, 0, [[0, "rgba(50,28,8,0.22)"], [1, "rgba(50,28,8,0)"]]); g.fillRect(RIM, 0, 13, AH);
  g.fillStyle = lin(g, 0, AH - RIM, 0, AH - RIM - 6, [[0, "rgba(50,28,8,0.1)"], [1, "rgba(50,28,8,0)"]]); g.fillRect(0, AH - RIM - 6, AW, 6);
  g.fillStyle = lin(g, AW - RIM, 0, AW - RIM - 6, 0, [[0, "rgba(50,28,8,0.1)"], [1, "rgba(50,28,8,0)"]]); g.fillRect(AW - RIM - 6, 0, 6, AH);
  g.restore();
  // the walnut rim: grain running round it, a bevel lit from the top left
  const ring = () => { g.beginPath(); g.roundRect(0, 0, AW, AH, CORNER); g.roundRect(RIM, RIM, AW - 2 * RIM, AH - 2 * RIM, CORNER - RIM); };
  ring(); g.fillStyle = lin(g, 0, 0, AW, AH, [[0, "#9a5a2c"], [0.5, "#83481f"], [1, "#6c3816"]]); g.fill("evenodd");
  g.save(); ring(); g.clip("evenodd");
  for (let i = 0; i < 9; i++) { const d = 0.5 + i * 0.62 + r() * 0.3; g.strokeStyle = r() < 0.3 ? `rgba(255,214,160,${0.08 + r() * 0.1})` : `rgba(40,16,2,${0.12 + r() * 0.16})`; g.lineWidth = 0.3 + r() * 0.5; g.beginPath(); g.roundRect(d, d, AW - 2 * d, AH - 2 * d, Math.max(1, CORNER - d)); g.stroke(); }
  for (let i = 0; i < 700; i++) {   // pores, along the run of the grain
    const t = r(), side = Math.floor(r() * 4), dd = 0.6 + r() * (RIM - 1.2);
    const [px, py, w, h] = side === 0 ? [t * AW, dd, 1.4 + r() * 2, 0.35] : side === 1 ? [t * AW, AH - dd, 1.4 + r() * 2, 0.35] : side === 2 ? [dd, t * AH, 0.35, 1.4 + r() * 2] : [AW - dd, t * AH, 0.35, 1.4 + r() * 2];
    g.fillStyle = `rgba(30,12,2,${0.15 + r() * 0.2})`; g.fillRect(px, py, w, h);
  }
  g.fillStyle = lin(g, 0, 0, AW, AH, [[0, "rgba(255,236,205,0.22)"], [0.3, "rgba(255,236,205,0.04)"], [0.55, "rgba(255,236,205,0.12)"], [0.7, "rgba(255,236,205,0)"]]); g.fillRect(0, 0, AW, AH);
  g.restore();
  g.lineWidth = 1.1; g.strokeStyle = lin(g, 0, 0, AW, AH, [[0, "rgba(255,232,196,0.6)"], [0.5, "rgba(255,232,196,0.15)"], [1, "rgba(255,232,196,0.05)"]]); rr(g, 1.1, 1.1, AW - 2.2, AH - 2.2, CORNER - 1); g.stroke();
  g.lineWidth = 1.3; g.strokeStyle = lin(g, RIM, RIM, AW - RIM, AH - RIM, [[0, "rgba(30,12,2,0.7)"], [0.5, "rgba(60,30,10,0.45)"], [1, "rgba(255,226,186,0.55)"]]); rr(g, RIM - 0.4, RIM - 0.4, AW - 2 * RIM + 0.8, AH - 2 * RIM + 0.8, CORNER - RIM); g.stroke();
}
const cloths = new Map<string, HTMLCanvasElement>(), lights = new Map<string, HTMLCanvasElement>();
function cached(m: Map<string, HTMLCanvasElement>, k: number, paint: (g: C) => void) {
  const key = k.toFixed(3); let cv = m.get(key);
  if (!cv) { const L = layer(AW, AH, k); paint(L.c); cv = L.cv; m.clear(); m.set(key, cv); }
  return cv;
}
export function drawFloor(g: C) { g.drawImage(cached(cloths, scaleOf(g), paintCloth), 0, 0, AW, AH); }
/** The light over the table, painted over the cover: a warm pool from the top left falling into a soft vignette. */
export function drawTableLight(g: C) { g.drawImage(cached(lights, scaleOf(g), c => warmLight(c, AW, AH, { pool: 0.2, dark: 0.3, lx: AW * 0.16, ly: AH * 0.1 })), 0, 0, AW, AH); }

// ── spills ───────────────────────────────────────────────────────────────────
function blob(g: C, z: Zone, wob: number, k = 1, dx = 0, dy = 0) {
  g.beginPath();
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2, r = (1 + Math.sin(a * 3 + z.x) * wob + Math.cos(a * 5 + z.y) * wob * 0.6) * k;
    const x = z.x + dx + Math.cos(a) * (z.w / 2) * r, y = z.y + dy + Math.sin(a) * (z.h / 2) * r;
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
}
/** Spills under the lunchboxes (milk, syrup, the sink). Herbs go on top: drawHerbs. */
export function drawZone(g: C, z: Zone) {
  const R = Math.max(z.w, z.h) / 2, r = seeded(Math.round(z.x * 7 + z.y * 3));
  if (z.k === 0) {   // spilled milk: a bright sheet with a soft meniscus, the cloth damp round it
    blob(g, z, 0.08, 1.06, 1.5, 2); g.fillStyle = "rgba(110,135,175,0.16)"; g.fill();
    blob(g, z, 0.08); g.fillStyle = "#fdfeff"; g.fill();
    blob(g, z, 0.08); g.fillStyle = rad(g, z.x - z.w * 0.1, z.y - z.h * 0.12, R * 0.1, R * 1.05, [[0, "rgba(255,255,255,0)"], [0.7, "rgba(206,218,236,0.18)"], [1, "rgba(150,172,206,0.5)"]]); g.fill();
    blob(g, z, 0.08); g.strokeStyle = "rgba(140,162,196,0.55)"; g.lineWidth = 1; g.stroke();
    blob(g, z, 0.08, 0.93, -0.6, -0.8); g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = "rgba(255,255,255,1)"; ell(g, z.x - z.w * 0.18, z.y - z.h * 0.2, z.w * 0.13, z.h * 0.06, -0.3); g.fill();
    g.fillStyle = "rgba(196,212,236,0.35)"; ell(g, z.x + z.w * 0.14, z.y + z.h * 0.16, z.w * 0.2, z.h * 0.1, 0.2); g.fill();
    for (let i = 0; i < 4; i++) { const a = r() * TAU, d = 1.08 + r() * 0.12, x = z.x + Math.cos(a) * z.w * 0.5 * d, y = z.y + Math.sin(a) * z.h * 0.5 * d, s = 1.4 + r() * 2.4; g.fillStyle = "rgba(110,135,175,0.2)"; ell(g, x + 0.6, y + 0.9, s, s * 0.8); g.fill(); g.fillStyle = "#fdfeff"; ell(g, x, y, s, s * 0.8); g.fill(); g.fillStyle = "#fff"; circ(g, x - s * 0.3, y - s * 0.3, s * 0.3); g.fill(); }
  } else if (z.k === 1) {   // syrup: clear deep amber you can see the cloth through, thick and dark at its edge, glossy on top
    blob(g, z, 0.1, 1.05, 1.5, 2); g.fillStyle = "rgba(150,90,20,0.16)"; g.fill();
    blob(g, z, 0.1); g.fillStyle = "rgba(255,206,120,0.55)"; g.fill();   // light glowing through it
    blob(g, z, 0.1); g.fillStyle = rad(g, z.x - z.w * 0.1, z.y - z.h * 0.1, 2, R, [[0, "rgba(246,150,24,0.5)"], [0.55, "rgba(222,108,10,0.66)"], [0.85, "rgba(160,64,4,0.84)"], [1, "rgba(112,42,2,0.92)"]]); g.fill();
    blob(g, z, 0.1); g.strokeStyle = "rgba(96,44,4,0.65)"; g.lineWidth = 1; g.stroke();
    blob(g, z, 0.1, 0.86, -1, -1.2); g.strokeStyle = "rgba(255,214,140,0.3)"; g.lineWidth = 2.2; g.stroke();
    g.save(); blob(g, z, 0.1); g.clip(); blob(g, z, 0.1, 0.93, 1.4, 1.6); g.strokeStyle = "rgba(255,226,120,0.55)"; g.lineWidth = 1.6; g.stroke(); g.restore();   // a caustic where the light comes out
    g.save(); blob(g, z, 0.1); g.clip();
    g.fillStyle = lin(g, z.x - z.w / 2, z.y - z.h / 2, z.x + z.w / 2, z.y + z.h / 2, [[0, "rgba(255,240,200,0)"], [0.3, "rgba(255,240,200,0.32)"], [0.38, "rgba(255,240,200,0)"], [0.62, "rgba(255,240,200,0.12)"], [0.68, "rgba(255,240,200,0)"]]); g.fillRect(z.x - z.w, z.y - z.h, z.w * 2, z.h * 2);
    g.restore();
    g.fillStyle = "rgba(255,248,224,0.9)"; ell(g, z.x - z.w * 0.2, z.y - z.h * 0.24, z.w * 0.12, z.h * 0.045, -0.35); g.fill();
    g.fillStyle = "rgba(255,248,224,0.55)"; ell(g, z.x + z.w * 0.16, z.y + z.h * 0.18, z.w * 0.06, z.h * 0.025, -0.35); g.fill();
    for (let i = 0; i < 6; i++) { const x = z.x + (r() - 0.5) * z.w * 0.6, y = z.y + (r() - 0.5) * z.h * 0.6, s = 0.6 + r() * 1.2; g.strokeStyle = "rgba(255,226,160,0.55)"; g.lineWidth = 0.5; circ(g, x, y, s); g.stroke(); g.fillStyle = "rgba(255,255,255,0.75)"; circ(g, x - s * 0.3, y - s * 0.35, s * 0.3); g.fill(); }
  } else if (z.k === 2) {   // the sink: a brushed steel basin, water in it, a chrome drain
    const x0 = z.x - z.w / 2, y0 = z.y - z.h / 2;
    shade(g, 6, 2, 3.5, "rgba(40,30,20,0.35)"); g.fillStyle = "#aab4c0"; rr(g, x0 - 4, y0 - 4, z.w + 8, z.h + 8, 10); g.fill(); noShade(g);
    g.fillStyle = lin(g, x0 - 4, y0 - 4, x0 + z.w + 4, y0 + z.h + 4, [[0, "#f6f8fa"], [0.45, "#d3dae1"], [1, "#9aa5b1"]]); rr(g, x0 - 4, y0 - 4, z.w + 8, z.h + 8, 10); g.fill();
    for (let y = y0 - 3; y < y0 + z.h + 4; y += 0.8) { g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "80,90,104"},${0.05 + r() * 0.06})`; g.fillRect(x0 - 3, y, z.w + 6, 0.4); }
    g.fillStyle = lin(g, x0, y0, x0, y0 + z.h, [[0, "#6f7a86"], [0.3, "#9ba6b2"], [1, "#c4ccd5"]]); rr(g, x0, y0, z.w, z.h, 7); g.fill();
    g.save(); rr(g, x0, y0, z.w, z.h, 7); g.clip();
    g.fillStyle = lin(g, x0, y0, x0 + z.w, y0 + z.h, [[0, "rgba(150,205,240,0.7)"], [1, "rgba(80,150,210,0.75)"]]); g.fillRect(x0, y0, z.w, z.h);
    g.fillStyle = lin(g, 0, y0, 0, y0 + 9, [[0, "rgba(20,30,45,0.45)"], [1, "rgba(20,30,45,0)"]]); g.fillRect(x0, y0, z.w, 9);
    g.fillStyle = lin(g, x0, 0, x0 + 8, 0, [[0, "rgba(20,30,45,0.35)"], [1, "rgba(20,30,45,0)"]]); g.fillRect(x0, y0, 8, z.h);
    g.strokeStyle = "rgba(255,255,255,0.6)"; g.lineWidth = 1;
    for (let k = 0; k < 3; k++) { g.beginPath(); const yy = z.y - z.h / 4 + (k * z.h) / 4; g.moveTo(z.x - z.w / 3, yy); g.quadraticCurveTo(z.x - z.w / 6, yy - 2.5, z.x, yy); g.quadraticCurveTo(z.x + z.w / 6, yy + 2.5, z.x + z.w / 3, yy); g.stroke(); }
    g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.moveTo(x0 + z.w * 0.1, y0); g.lineTo(x0 + z.w * 0.24, y0); g.lineTo(x0 + z.w * 0.12, y0 + z.h); g.lineTo(x0 - z.w * 0.02, y0 + z.h); g.closePath(); g.fill();
    g.restore();
    g.strokeStyle = "rgba(40,48,58,0.45)"; g.lineWidth = 0.8; rr(g, x0, y0, z.w, z.h, 7); g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.75)"; g.lineWidth = 0.8; rr(g, x0 - 3.4, y0 - 3.4, z.w + 6.8, z.h + 6.8, 9.5); g.stroke();
    const px = z.x + z.w / 2 - 9, py = z.y - z.h / 2 + 9;   // the plug hole
    g.fillStyle = lin(g, px - 4.5, py - 4.5, px + 4.5, py + 4.5, CHROME); circ(g, px, py, 4.5); g.fill();
    g.fillStyle = "#2b323b"; circ(g, px, py, 2.8); g.fill(); g.strokeStyle = "rgba(200,210,220,0.8)"; g.lineWidth = 0.6; line(g, px - 2.4, py, px + 2.4, py); line(g, px, py - 2.4, px, py + 2.4);
  }
}
export function drawHerbs(g: C, z: Zone, t: number) {
  if (z.k !== 3) return;
  blob(g, z, 0.06, 1.02, 1.2, 1.8); g.fillStyle = "rgba(30,60,20,0.18)"; g.fill();
  blob(g, z, 0.06); g.fillStyle = "rgba(70,140,62,0.5)"; g.fill();
  const n = Math.round((z.w * z.h) / 90);
  for (let k = 0; k < n; k++) {
    const a = (k * 2.399) % (Math.PI * 2), r = Math.sqrt((k + 0.5) / n) * 0.92, x = z.x + Math.cos(a) * (z.w / 2) * r, y = z.y + Math.sin(a) * (z.h / 2) * r;
    const sway = Math.sin(t / 900 + k) * 0.15;
    g.save(); g.translate(x, y); g.rotate(a + sway);
    g.fillStyle = "rgba(20,50,15,0.25)"; g.beginPath(); g.ellipse(0.8, 1.2, 7, 3.4, 0, 0, 7); g.fill();
    g.fillStyle = k % 3 === 0 ? "#3d8a38" : k % 3 === 1 ? "#5aa948" : "#79c25e";
    g.beginPath(); g.ellipse(0, 0, 7, 3.4, 0, 0, 7); g.fill();
    g.fillStyle = "rgba(255,255,255,0.16)"; g.beginPath(); g.ellipse(0, -1.2, 6, 1.6, 0, 0, 7); g.fill();
    g.strokeStyle = "rgba(230,255,210,0.4)"; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-5.5, 0); g.lineTo(5.5, 0); g.stroke();
    g.restore();
  }
}

// ── cover ────────────────────────────────────────────────────────────────────
const BOX = [["#f2994a", "#c96f22"], ["#e8505b", "#b83440"], ["#4f9ad8", "#2f6fae"]], MUGS = ["#f4f1ea", "#7fb8e6", "#f2c14e"], BOWLS = ["#2f62b0", "#3a8f72", "#c75a3c"];
/** Soft contact shadows under the cover, down and right of each piece. */
export function drawShadow(g: C, o: Ob) {
  if (o.ttl !== undefined) {   // a bread wall, drawn every frame: a plain offset shadow, no blur
    g.fillStyle = "rgba(50,30,10,0.18)"; rr(g, o.x - (o.k === 0 ? o.w : 0) / 2 + 2.5, o.y - (o.k === 0 ? o.h : 0) / 2 + 4, o.k === 0 ? o.w : 0, o.k === 0 ? o.h : 0, 6); g.fill(); return;
  }
  if (o.k === 1) { contact(g, o.x, o.y, o.r * 1.04, o.r, 0.42, "50,30,10"); shade(g, 9, 3, 5.5, "rgba(50,30,10,0.3)"); g.fillStyle = "rgba(50,30,10,0.3)"; circ(g, o.x, o.y, o.r - 1); g.fill(); noShade(g); }
  else { shade(g, 9, 3, 5.5, "rgba(50,30,10,0.34)"); g.fillStyle = "rgba(50,30,10,0.34)"; rr(g, o.x - o.w / 2 + 1, o.y - o.h / 2 + 1, o.w - 2, o.h - 2, 5); g.fill(); noShade(g); }
}
function knife(g: C, x: number, y: number, len: number, along: boolean) {
  g.save(); g.translate(x, y); if (!along) g.rotate(Math.PI / 2); g.rotate(-0.06);
  const hl = len * 0.38;
  shade(g, 3, 1, 2, "rgba(40,20,5,0.4)"); g.fillStyle = "#c5ccd4"; g.beginPath(); g.moveTo(-len / 2 + hl, -3.2); g.lineTo(len / 2 - 2, -2.2); g.quadraticCurveTo(len / 2 + 1, -0.6, len / 2 - 4, 2.4); g.lineTo(-len / 2 + hl, 3); g.closePath(); g.fill(); noShade(g);
  g.fillStyle = lin(g, 0, -3.2, 0, 3, [[0, "#ffffff"], [0.35, "#dfe4ea"], [0.65, "#a7b0ba"], [1, "#7d8792"]]); g.fill();
  g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 0.6; line(g, -len / 2 + hl + 1, -2.4, len / 2 - 4, -1.6);
  shade(g, 3, 1, 2, "rgba(40,20,5,0.4)"); g.fillStyle = "#2a2522"; rr(g, -len / 2, -3.4, hl, 6.8, 3); g.fill(); noShade(g);
  g.fillStyle = lin(g, 0, -3.4, 0, 3.4, [[0, "#5a514b"], [1, "#1c1816"]]); rr(g, -len / 2, -3.4, hl, 6.8, 3); g.fill();
  g.fillStyle = lin(g, 0, -1, 0, 1, CHROME); for (const rx of [0.25, 0.55, 0.82]) { circ(g, -len / 2 + hl * rx, 0, 1); g.fill(); }
  g.fillStyle = "rgba(255,255,255,0.3)"; rr(g, -len / 2 + 1.5, -2.6, hl - 3, 1, 0.5); g.fill();
  g.restore();
}
export function drawCover(g: C, o: Ob, imgs: Imgs, fruit: string[][]) {
  if (o.k === 1 && o.s === 0) {   // a glazed fruit bowl: coloured outside, cream inside, each fruit with its own little shadow
    const { x, y, r } = o, col = BOWLS[o.c % 3];
    g.fillStyle = lin(g, x - r, y - r, x + r, y + r, [[0, lighter(col, 0.38)], [0.5, col], [1, darker(col, 0.38)]]); circ(g, x, y, r); g.fill();
    g.fillStyle = lin(g, x - r, y - r, x + r, y + r, [[0, "#c9b896"], [0.55, "#f3ead8"], [1, "#fffaf0"]]); circ(g, x, y, r * 0.84); g.fill();
    g.fillStyle = rad(g, x + r * 0.08, y + r * 0.1, 0, r * 0.74, [[0, "#fffaf0"], [0.8, "#f1e6d2"], [1, "rgba(241,230,210,0)"]]); circ(g, x, y, r * 0.78); g.fill();
    g.strokeStyle = rgba(darker(col, 0.2), 0.5); g.lineWidth = 0.7; circ(g, x, y, r * 0.84); g.stroke();
    rimArc(g, x, y, r * 0.92, 1.5, 0.9, 0.3);
    const fr = fruit[o.c % fruit.length], s = r * 0.95, spots = [[-0.3, -0.25, 0.3], [0.32, -0.12, -0.4], [-0.05, 0.32, 0.1]];
    fr.forEach((f, j) => { const im = img(imgs, f), fx = x + spots[j][0] * r, fy = y + spots[j][1] * r; g.fillStyle = "rgba(90,50,15,0.28)"; ell(g, fx + s * 0.06, fy + s * 0.1, s * 0.36, s * 0.3); g.fill(); if (im) { g.save(); g.translate(fx, fy); g.rotate(spots[j][2]); g.drawImage(im, -s / 2, -s / 2, s, s); g.restore(); } });
    gloss(g, x - r * 0.6, y - r * 0.64, r * 0.22, r * 0.09, 0.7);
    g.strokeStyle = rgba(darker(col, 0.55), 0.6); g.lineWidth = 0.8; circ(g, x, y, r - 0.4); g.stroke();
  } else if (o.k === 1 && o.s === 1) {   // a ceramic mug of tea, handle and all
    const { x, y, r } = o, col = MUGS[o.c % 3];
    shade(g, 3, 1, 2.2, "rgba(50,30,10,0.35)"); g.strokeStyle = darker(col, 0.18); g.lineWidth = 3.6; rr(g, x + r - 3, y - 4.8, 9.4, 9.6, 4.6); g.stroke(); noShade(g);
    g.strokeStyle = lin(g, x + r, y - 5, x + r + 9, y + 5, [[0, lighter(col, 0.45)], [1, darker(col, 0.28)]]); g.lineWidth = 2.6; rr(g, x + r - 3, y - 4.8, 9.4, 9.6, 4.6); g.stroke();
    g.fillStyle = lin(g, x - r, y - r, x + r, y + r, [[0, lighter(col, 0.5)], [0.5, col], [1, darker(col, 0.28)]]); circ(g, x, y, r); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 1.1; circ(g, x, y, r * 0.84); g.stroke();
    g.fillStyle = rad(g, x + r * 0.08, y + r * 0.1, 0, r * 0.78, [[0, "#9a5a2e"], [0.65, "#6a3616"], [1, "#3e1d08"]]); circ(g, x, y, r * 0.78); g.fill();
    g.strokeStyle = "rgba(215,160,100,0.5)"; g.lineWidth = 0.8; circ(g, x, y, r * 0.72); g.stroke();
    gloss(g, x - r * 0.24, y - r * 0.28, r * 0.26, r * 0.11, 0.6);
    rimArc(g, x, y, r - 0.9, 1.1, 0.85, 0.3);
    g.strokeStyle = rgba(darker(col, 0.5), 0.5); g.lineWidth = 0.7; circ(g, x, y, r - 0.35); g.stroke();
  } else if (o.k === 1) {   // a salt shaker from above: the glass round a steel cap with holes
    const { x, y, r } = o;
    g.fillStyle = rad(g, x, y, r * 0.5, r, [[0, "rgba(255,255,255,0.9)"], [0.8, "rgba(220,230,238,0.95)"], [1, "rgba(160,176,190,0.95)"]]); circ(g, x, y, r); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = 1; circ(g, x, y, r - 0.8); g.stroke();
    g.fillStyle = lin(g, x - r, y - r, x + r, y + r, [[0, "#ffffff"], [0.35, "#e2e7ec"], [0.7, "#a3acb6"], [1, "#6e7883"]]); circ(g, x, y, r * 0.74); g.fill();
    g.strokeStyle = "rgba(60,70,80,0.4)"; g.lineWidth = 0.5; circ(g, x, y, r * 0.6); g.stroke();
    g.fillStyle = "#4c555f"; for (const [dx, dy] of [[0, 0], [-2.4, -1.6], [2.4, -1.6], [-1.6, 2.4], [1.6, 2.4]]) { circ(g, x + dx, y + dy, 0.75); g.fill(); }
    g.strokeStyle = "rgba(60,70,80,0.5)"; g.lineWidth = 0.6; circ(g, x, y, r - 0.3); g.stroke();
    gloss(g, x - r * 0.36, y - r * 0.4, r * 0.3, r * 0.14, 0.9);
  } else if (o.s === 0) {   // a cereal box from above: printed card, the flaps tucked in; dented, then split, as it's hit
    const [c1, c2] = BOX[o.c % 3], x = o.x - o.w / 2, y = o.y - o.h / 2, along = o.w >= o.h;
    g.fillStyle = darker(c1, 0.25); rr(g, x, y, o.w, o.h, 3); g.fill();
    g.fillStyle = lin(g, x, y, x + o.w, y + o.h, [[0, lighter(c1, 0.22)], [0.6, c1], [1, darker(c1, 0.08)]]); rr(g, x + 0.6, y + 0.6, o.w - 1.2, o.h - 1.2, 2.6); g.fill();
    g.save(); rr(g, x + 0.6, y + 0.6, o.w - 1.2, o.h - 1.2, 2.6); g.clip();
    g.fillStyle = rgba(c2, 0.55); for (let k = -4; k < 8; k++) { g.beginPath(); const sx = x + k * 9; g.moveTo(sx, y + o.h); g.lineTo(sx + 4, y + o.h); g.lineTo(sx + 4 + o.h * 0.6, y); g.lineTo(sx + o.h * 0.6, y); g.closePath(); g.fill(); }   // printed stripes
    g.fillStyle = lin(g, x, y, x + o.w, y + o.h, [[0, "rgba(255,255,255,0)"], [0.3, "rgba(255,255,255,0.28)"], [0.42, "rgba(255,255,255,0)"]]); g.fillRect(x, y, o.w, o.h);   // the coated card's sheen
    g.restore();
    g.strokeStyle = rgba(darker(c1, 0.4), 0.65); g.lineWidth = 0.8;   // the flaps
    if (along) { line(g, x + 2, o.y, x + o.w - 2, o.y); } else { line(g, o.x, y + 2, o.x, y + o.h - 2); }
    g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = 0.6; if (along) line(g, x + 2, o.y + 0.8, x + o.w - 2, o.y + 0.8); else line(g, o.x + 0.8, y + 2, o.x + 0.8, y + o.h - 2);
    const lw = Math.min(o.w, o.h) * 0.62;
    g.fillStyle = "rgba(40,20,5,0.25)"; rr(g, o.x - lw / 2 + 0.6, o.y - lw / 2 + 1, lw, lw, 4); g.fill();
    g.fillStyle = lin(g, o.x - lw / 2, o.y - lw / 2, o.x + lw / 2, o.y + lw / 2, [[0, "#ffffff"], [1, "#eef1f5"]]); rr(g, o.x - lw / 2, o.y - lw / 2, lw, lw, 4); g.fill();
    g.strokeStyle = rgba(c2, 0.8); g.lineWidth = 1; rr(g, o.x - lw / 2 + 1.5, o.y - lw / 2 + 1.5, lw - 3, lw - 3, 3); g.stroke();
    const im = img(imgs, "1f963"); if (im) g.drawImage(im, o.x - lw * 0.4, o.y - lw * 0.4, lw * 0.8, lw * 0.8);
    g.lineWidth = 1.2; g.strokeStyle = "rgba(255,255,255,0.55)"; g.beginPath(); g.moveTo(x + 1, y + o.h - 3); g.lineTo(x + 1, y + 1); g.lineTo(x + o.w - 3, y + 1); g.stroke();
    g.strokeStyle = "rgba(0,0,0,0.25)"; g.beginPath(); g.moveTo(x + 3, y + o.h - 0.8); g.lineTo(x + o.w - 0.8, y + o.h - 0.8); g.lineTo(x + o.w - 0.8, y + 3); g.stroke();
    if (o.hp !== undefined && o.hp < 3) {   // dents, then a split with torn card showing
      const dent = (px: number, py: number, s: number) => { g.fillStyle = rad(g, px, py, 0, s, [[0, "rgba(40,20,5,0.3)"], [1, "rgba(40,20,5,0)"]]); circ(g, px, py, s); g.fill(); g.fillStyle = rad(g, px - s * 0.4, py - s * 0.4, 0, s * 0.6, [[0, "rgba(255,255,255,0.35)"], [1, "rgba(255,255,255,0)"]]); circ(g, px - s * 0.4, py - s * 0.4, s * 0.6); g.fill(); };
      dent(x + o.w * 0.28, y + o.h * 0.36, 5);
      const tear = (pts: number[][]) => {
        g.lineJoin = "round"; g.strokeStyle = "#f3e6cc"; g.lineWidth = 2.4; g.beginPath(); pts.forEach(([px, py], i) => { if (i) g.lineTo(px, py); else g.moveTo(px, py); }); g.stroke();
        g.strokeStyle = "rgba(60,30,10,0.75)"; g.lineWidth = 1; g.stroke();
      };
      tear([[x + o.w * 0.2, y + 1.5], [x + o.w * 0.35, y + o.h * 0.4], [x + o.w * 0.28, y + o.h * 0.7]]);
      if (o.hp < 2) { dent(x + o.w * 0.72, y + o.h * 0.6, 6); tear([[x + o.w - 1.5, y + o.h * 0.3], [x + o.w * 0.7, y + o.h * 0.55], [x + o.w * 0.78, y + o.h - 1.5]]); }
    }
  } else if (o.s === 1) {   // a maple cutting board: edge-grain strips, a juice groove, the hanging hole, a knife resting on it
    const x = o.x - o.w / 2, y = o.y - o.h / 2, along = o.w >= o.h, r = seeded(o.id * 131 + 7), pal = ["#e2b276", "#d6a466", "#ebc08a", "#cf9b5c", "#dfae70"];
    g.fillStyle = "#a8743f"; rr(g, x, y, o.w, o.h, 7); g.fill();
    g.save(); rr(g, x + 0.8, y + 0.8, o.w - 1.6, o.h - 1.6, 6.4); g.clip();
    const span = along ? o.h : o.w;
    for (let p = 0; p < span;) {
      const sw = 5 + r() * 4, col = pal[Math.floor(r() * pal.length)];
      g.fillStyle = col; if (along) g.fillRect(x, y + p, o.w, sw); else g.fillRect(x + p, y, sw, o.h);
      for (let k = 0; k < 4; k++) {
        const o2 = p + r() * sw, ph = r() * TAU; g.strokeStyle = r() < 0.3 ? "rgba(255,236,200,0.25)" : `rgba(120,70,25,${0.1 + r() * 0.14})`; g.lineWidth = 0.35 + r() * 0.5; g.beginPath();
        for (let s = -4; s <= (along ? o.w : o.h) + 4; s += 6) { const wv = o2 + Math.sin(s / 17 + ph) * 0.6; if (along) { if (s === -4) g.moveTo(x + s, y + wv); else g.lineTo(x + s, y + wv); } else { if (s === -4) g.moveTo(x + wv, y + s); else g.lineTo(x + wv, y + s); } }
        g.stroke();
      }
      g.fillStyle = "rgba(110,64,24,0.35)"; if (along) g.fillRect(x, y + p, o.w, 0.5); else g.fillRect(x + p, y, 0.5, o.h);
      p += sw;
    }
    g.fillStyle = lin(g, x, y, x + o.w, y + o.h, [[0, "rgba(255,246,226,0)"], [0.25, "rgba(255,246,226,0.22)"], [0.38, "rgba(255,246,226,0)"], [0.6, "rgba(255,246,226,0.1)"], [0.7, "rgba(255,246,226,0)"]]); g.fillRect(x, y, o.w, o.h);
    g.restore();
    g.strokeStyle = "rgba(110,62,20,0.5)"; g.lineWidth = 1.4; rr(g, x + 4, y + 4, o.w - 8, o.h - 8, 4); g.stroke();   // the groove
    g.strokeStyle = "rgba(255,236,200,0.5)"; g.lineWidth = 0.7; rr(g, x + 4.8, y + 4.8, o.w - 8, o.h - 8, 4); g.stroke();
    g.lineWidth = 1.4; g.strokeStyle = "rgba(255,240,210,0.6)"; g.beginPath(); g.moveTo(x + 1, y + o.h - 6); g.lineTo(x + 1, y + 1); g.lineTo(x + o.w - 6, y + 1); g.stroke();
    g.strokeStyle = "rgba(80,40,10,0.4)"; g.beginPath(); g.moveTo(x + 6, y + o.h - 0.8); g.lineTo(x + o.w - 0.8, y + o.h - 0.8); g.lineTo(x + o.w - 0.8, y + 6); g.stroke();
    const hx = along ? x + 9.5 : o.x, hy = along ? o.y : y + 9.5;   // the hanging hole
    g.fillStyle = "rgba(60,32,10,0.6)"; circ(g, hx, hy, 3.2); g.fill(); g.fillStyle = rgba("#f8f5ef", 0.9); circ(g, hx + 0.4, hy + 0.5, 2.3); g.fill();
    g.strokeStyle = "rgba(255,240,210,0.6)"; g.lineWidth = 0.6; g.beginPath(); g.arc(hx, hy, 3.3, 0.1, Math.PI * 0.6); g.stroke();
    const len = (along ? o.w : o.h) * 0.56;
    if (len > 40) knife(g, along ? o.x + 6 : o.x, along ? o.y : o.y + 6, len, along);
  } else {   // a bread wall (from the power-up): a toasty loaf, fading at the end
    const x = o.x - o.w / 2, y = o.y - o.h / 2, along = o.w >= o.h;
    g.globalAlpha = Math.min(1, (o.ttl ?? 1) / 1);
    g.fillStyle = "#9c5e1e"; rr(g, x, y, o.w, o.h, 6); g.fill();
    g.fillStyle = along ? lin(g, 0, y, 0, y + o.h, [[0, "#f6cf8c"], [0.45, "#dc9a48"], [1, "#a8661f"]]) : lin(g, x, 0, x + o.w, 0, [[0, "#f6cf8c"], [0.45, "#dc9a48"], [1, "#a8661f"]]);
    rr(g, x + 0.6, y + 0.6, o.w - 1.2, o.h - 1.2, 5.5); g.fill();
    const n = Math.max(2, Math.round((along ? o.w : o.h) / 12));
    g.lineCap = "round";
    for (let k = 1; k < n; k++) {   // the scored top
      g.strokeStyle = "rgba(255,236,190,0.75)"; g.lineWidth = 1.8; g.beginPath();
      if (along) { const xx = x + (o.w * k) / n; g.moveTo(xx - 2, y + 3.4); g.lineTo(xx + 2, y + o.h - 3.4); } else { const yy = y + (o.h * k) / n; g.moveTo(x + 3.4, yy - 2); g.lineTo(x + o.w - 3.4, yy + 2); }
      g.stroke(); g.strokeStyle = "rgba(120,60,10,0.45)"; g.lineWidth = 0.7; g.stroke();
    }
    g.fillStyle = "rgba(255,255,255,0.5)"; for (let k = 0; k < 10; k++) { const fx = x + ((k * 37) % 100) / 100 * o.w, fy = y + ((k * 61) % 100) / 100 * o.h; g.fillRect(fx, fy, 0.8, 0.8); }
    g.fillStyle = "rgba(255,255,255,0.3)"; rr(g, x + 2.5, y + 1.6, o.w - 5, Math.min(2, o.h * 0.15), 1); g.fill();
    g.globalAlpha = 1;
  }
}

// ── lunchboxes ───────────────────────────────────────────────────────────────
function pattern(g: C, look: Look) {
  const p = look.pattern;
  if (p === "plain") { g.fillStyle = "rgba(255,255,255,0.85)"; rr(g, -9, -1.2, 15, 2.4, 1.2); g.fill(); g.fillStyle = "rgba(255,255,255,0.35)"; rr(g, -9, -4.4, 10, 1.4, 0.7); g.fill(); return; }
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
const shadowBlob = (k: number) => sprite("tankShadow", k, 40, 34, c => { c.fillStyle = rad(c, 20, 17, 2, 17, [[0, "rgba(40,26,10,0.36)"], [0.55, "rgba(40,26,10,0.2)"], [1, "rgba(40,26,10,0)"]]); c.save(); c.translate(20, 17); c.scale(1, 0.84); circ(c, 0, 0, 17); c.restore(); c.fill(); });
/** A lunchbox from above: two rubber treads (they roll as it moves), the plastic box with its lid, hinge and latch,
 *  and a striped straw on a cap. Lit from the top left whichever way it faces. */
export function drawLunchbox(g: C, x: number, y: number, a: number, ta: number, look: Look, o: TankOpts) {
  const k = scaleOf(g), L = Math.SQRT1_2;
  g.save(); g.globalAlpha = o.alpha;
  g.drawImage(shadowBlob(k), x + 2.5 - 20, y + 4 - 17, 40, 34);
  g.translate(x, y); g.rotate(a);
  for (const [side, off] of [[-1, o.treadL], [1, o.treadR]]) {   // treads
    const ty = side * 9.5 - 3;
    g.fillStyle = "#1b1f26"; rr(g, -13.6, ty - 0.4, 27.2, 6.8, 3.2); g.fill();
    g.fillStyle = "#363d49"; rr(g, -13, ty, 26, 6, 2.6); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.2)"; g.lineWidth = 1.1; g.beginPath();
    const ph = ((off % 4) + 4) % 4;
    for (let q = -13 + ph; q < 13; q += 4) { g.moveTo(q, ty + 0.9); g.lineTo(q, ty + 5.1); }
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.14)"; g.fillRect(-12, ty + 0.5, 24, 0.8);
    g.fillStyle = "#8d97a3"; for (const hx of [-10, 10]) { g.beginPath(); g.arc(hx, ty + 3, 1.2, 0, 7); g.fill(); }
  }
  const body = o.frozen ? "#bfe3f5" : look.body;
  const lx = Math.cos(a) * -L + Math.sin(a) * -L, ly = -Math.sin(a) * -L + Math.cos(a) * -L;   // the light's direction, in the box's own frame
  g.fillStyle = mix(body, "#000000", 0.34); rr(g, -12.1, -9.1, 23.2, 18.2, 4.8); g.fill();
  g.fillStyle = lin(g, lx * 12, ly * 9, -lx * 12, -ly * 9, [[0, mix(body, "#ffffff", 0.32)], [0.5, body], [1, mix(body, "#000000", 0.16)]]); rr(g, -11.5, -8.5, 22, 17, 4); g.fill();
  g.strokeStyle = rgba(mix(body, "#000000", 0.38), 0.6); g.lineWidth = 0.8; rr(g, -9.6, -6.6, 18.2, 13.2, 3); g.stroke();   // the lid's seam
  g.strokeStyle = "rgba(255,255,255,0.42)"; rr(g, -9.6 + lx * 0.7, -6.6 + ly * 0.7, 18.2, 13.2, 3); g.stroke();
  g.save(); rr(g, -10, -7, 19, 14, 3); g.clip();
  g.fillStyle = rad(g, -0.5 + lx * 2, ly * 2, 1, 12, [[0, "rgba(255,255,255,0.18)"], [1, "rgba(255,255,255,0)"]]); g.fillRect(-10, -7, 19, 14);   // the lid's dome
  pattern(g, look); g.restore();
  g.fillStyle = rgba(mix(body, "#000000", 0.42), 0.7); rr(g, -11.6, -4.2, 1.8, 8.4, 0.9); g.fill();   // the hinge
  g.fillStyle = "rgba(20,30,50,0.3)"; rr(g, 9.3, -2.2, 3, 5.2, 1.2); g.fill();   // the latch
  g.fillStyle = "#f6f8fa"; rr(g, 9, -2.6, 2.8, 5.2, 1.2); g.fill(); g.fillStyle = "rgba(120,130,150,0.5)"; g.fillRect(9.4, -0.3, 2, 0.6);
  if (o.hard) {   // the coconut's shell, still on: hairy brown fibre round the box
    g.strokeStyle = "rgba(96,64,36,0.95)"; g.lineWidth = 2.4; rr(g, -12.6, -9.6, 24.2, 19.2, 5.2); g.stroke();
    g.strokeStyle = "rgba(200,160,110,0.55)"; g.lineWidth = 0.6; for (let q = -11; q <= 11; q += 2.6) { g.beginPath(); g.moveTo(q, -10.4); g.lineTo(q + 1.2, -8.8); g.moveTo(q, 8.8); g.lineTo(q + 1.2, 10.4); g.stroke(); }
  }
  g.save(); rr(g, -11.5, -8.5, 22, 17, 4); g.clip(); g.rotate(-a);   // a gloss that stays up and left of the box
  gloss(g, -5, -4.6, 8.5, 3.2, 0.42, -0.62);
  g.restore();
  g.rotate(ta - a);
  const SL = look.straw, SW = look.strawW;
  for (const dy of look.twin ? [-2.6, 2.6] : [0]) {   // the straw(s)
    g.fillStyle = "rgba(20,30,50,0.22)"; rr(g, 2.6, dy - SW / 2 + 1.4, SL + 4, SW, SW / 2); g.fill();
    g.fillStyle = "#ffffff"; rr(g, 2, dy - SW / 2, SL + 4, SW, SW / 2); g.fill();
    g.fillStyle = look.stripe; for (let q = 5; q < SL + 4; q += 4.5) g.fillRect(q, dy - SW / 2, 2, SW);
    g.fillStyle = lin(g, 0, dy - SW / 2, 0, dy + SW / 2, [[0, "rgba(255,255,255,0.55)"], [0.38, "rgba(255,255,255,0)"], [1, "rgba(10,20,40,0.24)"]]); rr(g, 2, dy - SW / 2, SL + 4, SW, SW / 2); g.fill();
    g.fillStyle = "rgba(20,30,50,0.35)"; g.beginPath(); g.ellipse(SL + 5.2, dy, 0.9, SW * 0.32, 0, 0, 7); g.fill();
    g.strokeStyle = "rgba(30,40,60,0.3)"; g.lineWidth = 0.7; rr(g, 2, dy - SW / 2, SL + 4, SW, SW / 2); g.stroke();
  }
  g.rotate(-ta);
  g.fillStyle = "rgba(20,30,50,0.3)"; g.beginPath(); g.arc(0.8, 1.2, 5.6, 0, 7); g.fill();
  g.fillStyle = rad(g, 0, 0, 0.5, 5.6, [[0, mix(body, "#ffffff", 0.55)], [0.55, body], [1, mix(body, "#000000", 0.3)]], -1.8, -1.8); g.beginPath(); g.arc(0, 0, 5.5, 0, 7); g.fill();
  g.strokeStyle = mix(body, "#000000", 0.38); g.lineWidth = 0.9; g.stroke();
  g.fillStyle = "rgba(255,255,255,0.85)"; g.beginPath(); g.ellipse(-2, -2.1, 1.6, 0.9, -0.7, 0, 7); g.fill();
  g.restore();
  g.save(); g.globalAlpha = o.alpha;
  if (o.flash > 0) { g.globalAlpha = o.flash * 0.6; g.fillStyle = rad(g, x, y, 2, 16, [[0, "rgba(255,255,255,1)"], [0.6, "rgba(255,255,255,0.6)"], [1, "rgba(255,255,255,0)"]]); g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill(); g.globalAlpha = o.alpha; }
  if (o.shield) {   // lettuce shield
    const R = TANK_R + 6;
    g.fillStyle = "rgba(130,205,100,0.14)"; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 1; g.beginPath(); g.arc(x, y, R + 1.6, Math.PI * 1.05, Math.PI * 1.5); g.stroke();
    g.strokeStyle = "rgba(80,160,62,0.7)"; g.lineWidth = 2.4; g.beginPath(); g.arc(x, y, R, 0, 7); g.stroke();
    for (let q = 0; q < 6; q++) {
      const an = (q / 6) * Math.PI * 2, lx2 = x + Math.cos(an) * R, ly2 = y + Math.sin(an) * R;
      g.fillStyle = "#4f9d3c"; g.beginPath(); g.ellipse(lx2, ly2, 4, 2.1, an + 1.57, 0, 7); g.fill();
      g.fillStyle = "#8fd26a"; g.beginPath(); g.ellipse(lx2 - 0.5, ly2 - 0.5, 2.6, 1.1, an + 1.57, 0, 7); g.fill();
    }
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
  if (trail) for (let q = 0; q < trail.length; q++) { g.globalAlpha = 0.06 + (0.2 * q) / trail.length; g.fillStyle = col; g.beginPath(); g.arc(trail[q].x, trail[q].y, PEA_R * (0.45 + (0.4 * q) / trail.length), 0, 7); g.fill(); }
  g.globalAlpha = 1;
  const S = (PEA_R + 5) * 2, cv = sprite(`pea${col}`, scaleOf(g), S, S, c => {
    const o = S / 2;
    c.fillStyle = rad(c, o + 1.5, o + 2.4, 0.5, PEA_R * 1.5, [[0, "rgba(30,40,15,0.38)"], [1, "rgba(30,40,15,0)"]]); circ(c, o + 1.5, o + 2.4, PEA_R * 1.5); c.fill();
    c.fillStyle = rad(c, o, o, 0.3, PEA_R, [[0, "#dcf7b4"], [0.35, lighter(col, 0.3)], [1, darker(col, 0.28)]], o - 1.2, o - 1.3); circ(c, o, o, PEA_R); c.fill();
    c.strokeStyle = "rgba(30,70,15,0.55)"; c.lineWidth = 0.6; circ(c, o, o, PEA_R - 0.3); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.9)"; ell(c, o - 1.2, o - 1.4, 0.95, 0.6, -0.7); c.fill();
  });
  g.drawImage(cv, x - S / 2, y - S / 2, S, S);
}
export function drawMine(g: C, m: Mine, t: number) {
  const armed = m.t >= MINE_ARM, blink = m.fuse > 0 ? Math.sin(t / 40) > 0 : armed && m.t > MINE_LIFE - 2 ? Math.sin(t / 90) > 0 : false;
  const col = m.team === 0 ? "#e2456b" : "#9b3fb5", cv = sprite(`bean${col}`, scaleOf(g), 26, 24, c => {   // a glossy jelly bean
    c.fillStyle = rad(c, 14.5, 14.5, 1, 10, [[0, "rgba(40,26,10,0.32)"], [1, "rgba(40,26,10,0)"]]); ell(c, 14.5, 14.5, 10, 8); c.fill();
    c.fillStyle = darker(col, 0.25); ell(c, 13, 12, 8, 6.5, 0.4); c.fill();
    c.fillStyle = rad(c, 13, 12, 0.5, 8, [[0, lighter(col, 0.55)], [0.5, col], [1, darker(col, 0.3)]], 10.5, 9.5); ell(c, 13, 12, 7.6, 6.1, 0.4); c.fill();
    c.fillStyle = "rgba(255,255,255,0.72)"; ell(c, 10.5, 10, 2.8, 1.3, -0.5); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.3)"; c.lineWidth = 0.6; c.beginPath(); c.ellipse(13, 12, 6.4, 5, 0.4, Math.PI * 0.15, Math.PI * 0.6); c.stroke();
  });
  g.drawImage(cv, m.x - 13, m.y - 12, 26, 24);
  if (blink) { g.fillStyle = "rgba(255,240,90,0.45)"; g.beginPath(); g.arc(m.x + 2.5, m.y + 1, 3.4, 0, 7); g.fill(); }
  g.fillStyle = blink ? "#fff35c" : armed ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)"; g.beginPath(); g.arc(m.x + 2.5, m.y + 1, 1.6, 0, 7); g.fill();
  if (m.fuse > 0) { const f = Math.min(1, m.fuse / 0.45); g.strokeStyle = "rgba(255,120,80,0.45)"; g.lineWidth = 1.5; g.beginPath(); g.arc(m.x, m.y, MINE_BLAST * f, 0, 7); g.stroke(); g.fillStyle = "rgba(255,150,120,0.08)"; g.fill(); }
}
export function drawPick(g: C, x: number, y: number, icon: string, life: number, t: number, imgs: Imgs, rot: boolean) {
  const pulse = 1 + 0.08 * Math.sin(t / 220 + x), fade = life < 2 ? 0.4 + 0.6 * Math.abs(Math.sin(t / 120)) : 1;
  g.globalAlpha = fade;
  g.fillStyle = rad(g, x, y, 4, 16 * pulse, [[0, "rgba(255,214,90,0.45)"], [1, "rgba(255,214,90,0)"]]); g.beginPath(); g.arc(x, y, 16 * pulse, 0, 7); g.fill();
  const cv = sprite("token", scaleOf(g), 32, 32, c => {   // a glazed token with a gold rim
    c.fillStyle = rad(c, 17.5, 18.5, 2, 13, [[0, "rgba(40,26,10,0.35)"], [1, "rgba(40,26,10,0)"]]); circ(c, 17.5, 18.5, 13); c.fill();
    c.fillStyle = lin(c, 5, 5, 27, 27, [[0, "#fff1b0"], [0.4, "#f2c94c"], [1, "#b8862a"]]); circ(c, 16, 16, 11); c.fill();
    c.fillStyle = lin(c, 7, 7, 25, 25, [[0, "#ffffff"], [1, "#eef1f5"]]); circ(c, 16, 16, 9.2); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 1; c.beginPath(); c.arc(16, 16, 10.4, Math.PI * 1.05, Math.PI * 1.45); c.stroke();
    c.strokeStyle = "rgba(140,100,20,0.5)"; c.lineWidth = 0.6; circ(c, 16, 16, 9.2); c.stroke();
  });
  g.drawImage(cv, x - 16, y - 16, 32, 32);
  const im = img(imgs, icon); if (im) { g.save(); g.translate(x, y); if (rot) g.rotate(Math.PI); g.drawImage(im, -8, -8, 16, 16); g.restore(); }
  g.fillStyle = "rgba(255,255,255,0.55)"; g.beginPath(); g.ellipse(x - 4.5, y - 5.5, 3, 1.3, -0.7, 0, 7); g.fill();
  g.globalAlpha = 1;
}
export function drawBasket(g: C, b: Basket, flash: number) {
  const W = (b.r + 4) * 2 + 16, H = b.r * 2 + 22, cv = sprite(`basket${b.r}`, scaleOf(g), W, H, c => {   // a wicker picnic basket from above, gingham cloth on top
    const x = W / 2, y = H / 2 - 2, R = b.r;
    c.fillStyle = rad(c, x + 2, y + 4, 2, R + 8, [[0, "rgba(40,26,10,0.4)"], [1, "rgba(40,26,10,0)"]]); c.save(); c.translate(x + 2, y + 4); c.scale(1, 0.8); circ(c, 0, 0, R + 8); c.restore(); c.fill();
    const bx = x - R - 4, by = y - R + 2, bw = (R + 4) * 2, bh = R * 2 - 2;
    c.fillStyle = "#8a5a2a"; rr(c, bx, by, bw, bh, 7); c.fill();
    c.save(); rr(c, bx + 1, by + 1, bw - 2, bh - 2, 6); c.clip();
    for (let row = 0, yy = by; yy < by + bh; yy += 3.4, row++) for (let xx = bx - 6 + (row % 2) * 3.5; xx < bx + bw; xx += 7) {
      c.fillStyle = lin(c, 0, yy, 0, yy + 3.2, [[0, "#f0c98c"], [0.5, "#d4a060"], [1, "#a8733a"]]); rr(c, xx + 0.3, yy, 6.4, 3.1, 1.5); c.fill();
    }
    c.fillStyle = lin(c, bx, by, bx + bw, by + bh, [[0, "rgba(255,240,210,0.18)"], [0.5, "rgba(255,240,210,0)"], [1, "rgba(40,20,5,0.25)"]]); c.fillRect(bx, by, bw, bh);
    c.restore();
    c.save(); rr(c, x - R, y - R - 3, R * 2, 10, 2); c.clip();   // the cloth
    c.fillStyle = "#ffffff"; c.fillRect(x - R, y - R - 3, R * 2, 10);
    for (let q = 0; q < R * 2; q += 6) { c.fillStyle = "rgba(232,80,91,0.6)"; c.fillRect(x - R + q, y - R - 3, 3, 10); }
    for (let q = 0; q < 10; q += 5) { c.fillStyle = "rgba(232,80,91,0.5)"; c.fillRect(x - R, y - R - 3 + q, R * 2, 2.5); }
    c.fillStyle = lin(c, 0, y - R - 3, 0, y - R + 7, [[0, "rgba(255,255,255,0.3)"], [1, "rgba(0,0,0,0.15)"]]); c.fillRect(x - R, y - R - 3, R * 2, 10);
    c.restore();
    c.lineCap = "round"; c.strokeStyle = "#6e4620"; c.lineWidth = 3.6; c.beginPath(); c.arc(x, y - 2, R - 4, Math.PI * 1.1, Math.PI * 1.9); c.stroke();   // the handle
    c.strokeStyle = "#c08a4c"; c.lineWidth = 2.2; c.stroke();
    c.strokeStyle = "rgba(255,240,210,0.6)"; c.lineWidth = 0.7; c.beginPath(); c.arc(x, y - 2, R - 4.6, Math.PI * 1.15, Math.PI * 1.5); c.stroke();
  });
  g.drawImage(cv, b.x - W / 2, b.y - H / 2 + 2, W, H);
  if (flash > 0) { g.globalAlpha = flash * 0.6; g.fillStyle = "#fff"; rr(g, b.x - b.r - 4, b.y - b.r - 3, (b.r + 4) * 2, b.r * 2 + 3, 7); g.fill(); g.globalAlpha = 1; }
}
// ── effects ──────────────────────────────────────────────────────────────────
export type Fx = { k: "puff" | "splat" | "spark" | "boom" | "crumble" | "block"; x: number; y: number; age: number; a: number; col: string };
export const FX_LIFE: Record<Fx["k"], number> = { puff: 260, splat: 520, spark: 240, boom: 700, crumble: 650, block: 400 };
export function drawFx(g: C, f: Fx) {
  const k = f.age / FX_LIFE[f.k], e = 1 - k;
  if (f.k === "puff") {   // a soft breath of steam at the straw
    for (let j = 0; j < 3; j++) { const d = 3 + 8 * k, px = f.x + Math.cos(f.a + (j - 1) * 0.6) * d, py = f.y + Math.sin(f.a + (j - 1) * 0.6) * d, R = 2.6 + 2.4 * k; g.globalAlpha = 0.55 * e; g.fillStyle = "#ffffff"; g.beginPath(); g.arc(px, py, R, 0, 7); g.fill(); g.globalAlpha = 0.25 * e; g.beginPath(); g.arc(px, py, R + 1.6, 0, 7); g.fill(); }
  } else if (f.k === "splat") {   // pea juice: a few glossy drops, a soft stain
    g.globalAlpha = 0.35 * e; g.fillStyle = f.col; g.beginPath(); g.arc(f.x, f.y, 5 + 4 * k, 0, 7); g.fill();
    for (let j = 0; j < 7; j++) {
      const an = j * 0.9 + f.a, d = 2 + 9 * k, px = f.x + Math.cos(an) * d, py = f.y + Math.sin(an) * d, R = 2.2 * (1 - k * 0.5);
      g.globalAlpha = e; g.fillStyle = darker(f.col, 0.15); g.beginPath(); g.arc(px, py, R, 0, 7); g.fill();
      g.fillStyle = lighter(f.col, 0.35); g.beginPath(); g.arc(px - R * 0.25, py - R * 0.25, R * 0.6, 0, 7); g.fill();
    }
    g.globalAlpha = e; g.fillStyle = "rgba(255,255,255,0.8)"; g.beginPath(); g.arc(f.x - 1, f.y - 1, 1.3 * e, 0, 7); g.fill();
  } else if (f.k === "spark") {   // a glint where a pea bounces
    g.globalAlpha = e; g.strokeStyle = "#fff6c8"; g.lineWidth = 1.4; g.lineCap = "round";
    for (let j = 0; j < 5; j++) { const an = j * 1.26 + f.a, d0 = 2 + 3 * k, d1 = 5 + 6 * k; g.beginPath(); g.moveTo(f.x + Math.cos(an) * d0, f.y + Math.sin(an) * d0); g.lineTo(f.x + Math.cos(an) * d1, f.y + Math.sin(an) * d1); g.stroke(); }
    g.fillStyle = "rgba(255,230,140,0.7)"; g.beginPath(); g.arc(f.x, f.y, 2.2 * e, 0, 7); g.fill();
  } else if (f.k === "boom") {   // a jelly mine: a soft pink shock ring and glossy jelly flying
    g.globalAlpha = 0.4 * e; g.fillStyle = "#ffc2d2"; g.beginPath(); g.arc(f.x, f.y, MINE_BLAST * (0.4 + 0.6 * k), 0, 7); g.fill();
    g.globalAlpha = e; g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 2.4 * e + 0.6; g.beginPath(); g.arc(f.x, f.y, MINE_BLAST * (0.3 + 0.7 * k), 0, 7); g.stroke();
    g.strokeStyle = "#e2456b"; g.lineWidth = 1.4 * e + 0.4; g.beginPath(); g.arc(f.x, f.y, MINE_BLAST * (0.3 + 0.7 * k) - 2, 0, 7); g.stroke();
    for (let j = 0; j < 10; j++) {
      const an = j * 0.63, d = 6 + MINE_BLAST * 0.8 * k, px = f.x + Math.cos(an) * d, py = f.y + Math.sin(an) * d, R = 2.6 * e + 0.6;
      g.fillStyle = "#c2345a"; g.beginPath(); g.arc(px, py, R, 0, 7); g.fill(); g.fillStyle = "rgba(255,200,215,0.9)"; g.beginPath(); g.arc(px - R * 0.3, py - R * 0.3, R * 0.4, 0, 7); g.fill();
    }
  } else if (f.k === "crumble") {   // a box gives way: shards of printed card tumbling out
    for (let j = 0; j < 9; j++) {
      const an = j * 0.7 + f.a, d = 4 + 20 * k; g.save(); g.translate(f.x + Math.cos(an) * d, f.y + Math.sin(an) * d + 6 * k * k); g.rotate(an + k * 3);
      g.globalAlpha = e; g.fillStyle = "rgba(40,20,5,0.25)"; g.fillRect(-2.4, -1.2, 6, 4); g.fillStyle = f.col; g.fillRect(-3, -2, 6, 4); g.fillStyle = "rgba(255,255,255,0.4)"; g.fillRect(-3, -2, 6, 1); g.fillStyle = "#f3e6cc"; g.fillRect(2.2, -2, 0.8, 4);
      g.restore();
    }
  } else if (f.k === "block") {   // the lettuce shield takes the hit
    g.globalAlpha = e; g.strokeStyle = "#5aaa46"; g.lineWidth = 3 * e + 0.6; g.beginPath(); g.arc(f.x, f.y, TANK_R + 6 + 10 * k, 0, 7); g.stroke();
    g.strokeStyle = "rgba(220,255,200,0.7)"; g.lineWidth = 1; g.beginPath(); g.arc(f.x, f.y, TANK_R + 4 + 10 * k, Math.PI * 1.05, Math.PI * 1.55); g.stroke();
  }
  g.globalAlpha = 1;
}
export type Mark = { x: number; y: number; a: number; age: number };
export function drawMarks(g: C, marks: Mark[]) {
  g.fillStyle = "rgba(70,60,50,1)";
  for (const m of marks) {
    const al = 0.08 * (1 - m.age / 4000); if (al <= 0) continue;
    g.globalAlpha = al; g.save(); g.translate(m.x, m.y); g.rotate(m.a);
    g.fillRect(-2, -12.5, 4, 5); g.fillRect(-2, 7.5, 4, 5);
    g.restore();
  }
  g.globalAlpha = 1;
}
