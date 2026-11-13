// Pea Tanks art: everything on the table, drawn in canvas (no image files except the food pictures). Pure drawing
// functions, so the game and the little previews on the cards share them. The "Premium Kitchen" look: a yarn-dyed
// linen gingham cloth on a walnut table, real things standing on it (printed cereal boxes, maple boards, glazed mugs and
// bowls, a glass shaker), each with a hint of its side and a soft contact shadow, one warm light from the top left
// falling into a vignette, and chunky plastic lunchboxes on rubber treads.
// The cloth and the light are painted once per screen density; the cover goes into the game's table canvas; the
// lunchboxes, peas, mines, tokens and herb leaves are cached sprites, so a frame is mostly drawImage calls.
// The pieces live in ./art3: table.ts (cloth, rim, light, spills, herbs), cover.ts, lunchbox.ts, kit.ts.
import { TANK_R, PEA_R, MINE_ARM, MINE_LIFE, MINE_BLAST, type Ob, type Kind, type Mine, type Basket, type Pt } from "./tankSim";
import { type C, seeded, rr, circ, ell, lin, rad, lighter, darker, rgba, scaleOf } from "./art2/paint";
import { soft, sprite, stamp, boxHull } from "./art3/kit";
import { drawFloor, drawTableLight, drawZone, drawHerbs } from "./art3/table";
import { drawCoverShadow, drawCerealBox, drawBoard, drawMug, drawFruitBowl, drawShaker, drawBreadShadow, drawBread, type Imgs } from "./art3/cover";
import { drawLunchbox, treadMarks, type Look, type TankOpts } from "./art3/lunchbox";

export { drawFloor, drawTableLight, drawZone, drawHerbs, drawLunchbox };
export type { Imgs, Look, TankOpts };
const img = (imgs: Imgs, code: string) => { const i = imgs[code]; return i && i.complete && i.naturalWidth ? i : null; };

// ── who looks like what ─────────────────────────────────────────────────────
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

// ── cover ────────────────────────────────────────────────────────────────────
/** Soft contact shadows under the cover, down and right of each piece (bread walls: a cheap one, they're per frame). */
export function drawShadow(g: C, o: Ob) {
  if (o.ttl !== undefined) { if (o.k === 0) drawBreadShadow(g, o); return; }
  drawCoverShadow(g, o);
}
export function drawCover(g: C, o: Ob, imgs: Imgs, fruit: string[][]) {
  if (o.k === 1) { if (o.s === 0) drawFruitBowl(g, o, imgs, fruit); else if (o.s === 1) drawMug(g, o); else drawShaker(g, o); return; }
  if (o.ttl !== undefined || o.s === 2) drawBread(g, o);
  else if (o.s === 0) drawCerealBox(g, o, imgs);
  else drawBoard(g, o);
}

// ── lunchboxes ───────────────────────────────────────────────────────────────
/** The little previews on the cards (a lunchbox facing up, straw to the right). */
export function previewLunchbox(c: HTMLCanvasElement, look: Look) {
  const g = c.getContext("2d"); if (!g) return;
  const d = window.devicePixelRatio || 1; c.width = 48 * d; c.height = 48 * d; g.setTransform(d * 1.2, 0, 0, d * 1.2, 0, 0); g.clearRect(0, 0, 40, 40);
  drawLunchbox(g, 17, 17.5, -Math.PI / 2, -Math.PI / 4, look, { treadL: 0, treadR: 0, flash: 0, shield: false, hard: look.pattern === "shell", ghost: 0, alpha: 1, frozen: false });
}

// ── peas, mines, power-ups, the basket ──────────────────────────────────────
const peaSprite = (k: number, col: string) => sprite(`pea${col}`, k, 18, 18, 8, 8, c => {
  soft(c, 2.2, "rgba(30,40,15,0.42)", () => { circ(c, 0, 0, PEA_R * 0.92); c.fill(); }, 1.5, 2.3);
  c.fillStyle = rad(c, 0, 0, 0.2, PEA_R, [[0, "#e6f9c0"], [0.3, lighter(col, 0.3)], [0.78, col], [1, darker(col, 0.32)]], -1.3, -1.4); circ(c, 0, 0, PEA_R); c.fill();
  c.strokeStyle = rgba(darker(col, 0.5), 0.55); c.lineWidth = 0.45; circ(c, 0, 0, PEA_R - 0.25); c.stroke();
  c.strokeStyle = "rgba(255,255,220,0.35)"; c.lineWidth = 0.5; c.beginPath(); c.arc(0, 0, PEA_R - 0.7, Math.PI * 0.1, Math.PI * 0.45); c.stroke();   // light bounced up off the cloth
  c.fillStyle = "rgba(255,255,255,0.95)"; ell(c, -1.2, -1.4, 1, 0.6, -0.7); c.fill();
});
const dotSprite = (k: number, col: string) => sprite(`dot${col}`, k, 10, 10, 5, 5, c => { c.fillStyle = rad(c, 0, 0, 0, 4.5, [[0, rgba(col, 0.9)], [0.5, rgba(col, 0.5)], [1, rgba(col, 0)]]); circ(c, 0, 0, 4.5); c.fill(); });
export function drawPea(g: C, x: number, y: number, trail: Pt[] | null, col = "#5fae34") {
  const k = scaleOf(g);
  if (trail && trail.length) { const d = dotSprite(k, col); for (let q = 0; q < trail.length; q++) { const f = (q + 1) / trail.length, s = 0.55 + 0.4 * f; g.globalAlpha = 0.1 + 0.32 * f; g.drawImage(d.cv, trail[q].x - 5 * s, trail[q].y - 5 * s, 10 * s, 10 * s); } }
  g.globalAlpha = 1;
  stamp(g, peaSprite(k, col), x, y);
}
const beanSprite = (k: number, col: string) => sprite(`bean${col}`, k, 30, 28, 14, 13, c => {   // a glossy, see-through jelly bean
  soft(c, 3, "rgba(60,20,30,0.36)", () => { ell(c, 0, 0, 7.6, 6, 0.4); c.fill(); }, 1.6, 2.4);
  c.fillStyle = rgba(darker(col, 0.15), 0.3); ell(c, 1.8, 2.4, 6.4, 4.2, 0.4); c.fill();   // light through the jelly, coloured on the cloth
  c.fillStyle = darker(col, 0.3); ell(c, 0, 0, 8, 6.4, 0.4); c.fill();
  c.fillStyle = rad(c, 0, 0, 0.5, 8, [[0, lighter(col, 0.5)], [0.45, col], [1, darker(col, 0.28)]], -2.6, -2.4); ell(c, 0, 0, 7.6, 6, 0.4); c.fill();
  c.fillStyle = rgba(lighter(col, 0.35), 0.5); ell(c, 1.6, 1.4, 4.2, 2.6, 0.4); c.fill();   // the bright core where light gathers
  c.fillStyle = "rgba(255,255,255,0.78)"; ell(c, -2.6, -2.2, 3, 1.3, -0.5); c.fill();
  c.fillStyle = "rgba(255,255,255,0.9)"; circ(c, 3.4, 2.6, 0.5); c.fill(); circ(c, -4.6, 0.4, 0.35); c.fill();   // sugar glints
  c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 0.6; c.beginPath(); c.ellipse(0, 0, 6.6, 5, 0.4, Math.PI * 0.15, Math.PI * 0.6); c.stroke();
});
export function drawMine(g: C, m: Mine, t: number) {
  const armed = m.t >= MINE_ARM, blink = m.fuse > 0 ? Math.sin(t / 40) > 0 : armed && m.t > MINE_LIFE - 2 ? Math.sin(t / 90) > 0 : false;
  const col = m.team === 0 ? "#e2456b" : "#9b3fb5";
  stamp(g, beanSprite(scaleOf(g), col), m.x, m.y);
  if (blink) { g.fillStyle = "rgba(255,240,90,0.5)"; circ(g, m.x + 2.6, m.y + 1.2, 3.6); g.fill(); }
  g.fillStyle = blink ? "#fff35c" : armed ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)"; circ(g, m.x + 2.6, m.y + 1.2, 1.5); g.fill();
  if (m.fuse > 0) { const f = Math.min(1, m.fuse / 0.45); g.strokeStyle = "rgba(255,120,80,0.45)"; g.lineWidth = 1.5; circ(g, m.x, m.y, MINE_BLAST * f); g.stroke(); g.fillStyle = "rgba(255,150,120,0.08)"; g.fill(); }
}
const glowSprite = (k: number) => sprite("pglow", k, 40, 40, 20, 20, c => { c.fillStyle = rad(c, 0, 0, 4, 19, [[0, "rgba(255,214,90,0.5)"], [0.6, "rgba(255,214,90,0.16)"], [1, "rgba(255,214,90,0)"]]); circ(c, 0, 0, 19); c.fill(); });
const tokenSprite = (k: number) => sprite("ptoken", k, 34, 34, 16, 16, c => {   // a glazed coaster with a gold rim
  soft(c, 3, "rgba(52,32,14,0.4)", () => { circ(c, 0, 0, 11); c.fill(); }, 1.6, 2.4);
  c.fillStyle = "#9a6c1c"; circ(c, 0.5, 0.7, 11.2); c.fill();
  c.fillStyle = lin(c, -11, -11, 11, 11, [[0, "#fff4c0"], [0.35, "#f4cd58"], [0.7, "#d19a30"], [1, "#a8731e"]]); circ(c, 0, 0, 11); c.fill();
  c.fillStyle = "#b9862a"; circ(c, 0, 0, 9.4); c.fill();
  c.fillStyle = rad(c, 0, 0, 1, 9.2, [[0, "#ffffff"], [0.8, "#f4f6fa"], [1, "#dfe4ec"]], -2.5, -2.5); circ(c, 0.2, 0.2, 9); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineWidth = 0.9; c.beginPath(); c.arc(0, 0, 10.3, Math.PI * 1.05, Math.PI * 1.45); c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.5)"; c.lineWidth = 0.6; c.beginPath(); c.arc(0, 0, 10.3, Math.PI * 0.1, Math.PI * 0.4); c.stroke();
});
export function drawPick(g: C, x: number, y: number, icon: string, life: number, t: number, imgs: Imgs, rot: boolean) {
  const k = scaleOf(g), pulse = 1 + 0.08 * Math.sin(t / 220 + x), fade = life < 2 ? 0.4 + 0.6 * Math.abs(Math.sin(t / 120)) : 1;
  g.globalAlpha = fade;
  const gl = glowSprite(k); g.drawImage(gl.cv, x - 20 * pulse, y - 20 * pulse, 40 * pulse, 40 * pulse);
  stamp(g, tokenSprite(k), x, y);
  const im = img(imgs, icon); if (im) { g.save(); g.translate(x, y); if (rot) g.rotate(Math.PI); g.drawImage(im, -8, -8, 16, 16); g.restore(); }
  g.fillStyle = "rgba(255,255,255,0.5)"; ell(g, x - 4.4, y - 5.4, 3, 1.2, -0.7); g.fill();
  g.globalAlpha = 1;
}
function gingham(c: C, x: number, y: number, w: number, h: number, s: number, col: string) {
  c.fillStyle = "#fffaf4"; c.fillRect(x, y, w, h);
  c.fillStyle = rgba(col, 0.5); for (let q = 0; q < w; q += s * 2) c.fillRect(x + q, y, s, h);
  for (let q = 0; q < h; q += s * 2) c.fillRect(x, y + q, w, s);
}
export function drawBasket(g: C, b: Basket, flash: number) {
  const R = b.r, W = (R + 5) * 2, H = R * 2, d = 3.6, x0 = -W / 2, y0 = -H / 2, tw = W - d, th = H - d;
  const cv = sprite(`basket${R}`, scaleOf(g), W + 18, H + 20, W / 2 + 6, H / 2 + 6, c => {   // a wicker picnic hamper: two lids, straps and a handle
    const r = seeded(0xba5);
    soft(c, 7, "rgba(52,32,14,0.42)", () => { boxHull(c, x0, y0, W, H, d); c.fill(); }, 3.6, 5);
    soft(c, 1.8, "rgba(40,24,10,0.45)", () => { boxHull(c, x0, y0, W, H, d); c.fill(); }, 0.8, 1.2);
    boxHull(c, x0, y0, W, H, d); c.fillStyle = "#7a4c20"; c.fill();
    c.save(); boxHull(c, x0, y0, W, H, d); c.clip();   // the woven sides
    for (let yy = y0 + th; yy < y0 + H; yy += 1.4) { c.fillStyle = `rgba(${r() < 0.5 ? "255,220,160" : "50,24,4"},${0.12 + r() * 0.12})`; c.fillRect(x0, yy, W, 0.6); }
    for (let xx = x0 + tw; xx < x0 + W; xx += 1.4) { c.fillStyle = `rgba(${r() < 0.5 ? "255,220,160" : "50,24,4"},${0.1 + r() * 0.1})`; c.fillRect(xx, y0, 0.6, H); }
    c.restore();
    c.save(); c.beginPath(); c.moveTo(x0 + 3, y0 + th); c.lineTo(x0 + 15, y0 + th); c.lineTo(x0 + 11, y0 + H + 1.5); c.lineTo(x0 + 5, y0 + H + 0.5); c.closePath(); c.clip();   // a napkin corner peeking out
    gingham(c, x0, y0 + th - 2, 20, 10, 1.8, "#E8505B"); c.restore();
    c.fillStyle = "#8a5a2a"; rr(c, x0, y0, tw, th, 5); c.fill();   // the lid, woven
    c.save(); rr(c, x0 + 1.2, y0 + 1.2, tw - 2.4, th - 2.4, 4); c.clip();
    for (let row = 0, yy = y0; yy < y0 + th; yy += 3.2, row++) for (let xx = x0 - 6 + (row % 2) * 3.4; xx < x0 + tw; xx += 6.8) {
      c.fillStyle = lin(c, 0, yy, 0, yy + 3, [[0, "#f2cd92"], [0.5, "#d7a464"], [1, "#a9743c"]]); rr(c, xx + 0.3, yy + 0.1, 6.2, 2.9, 1.4); c.fill();
      c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(xx + 1, yy + 0.5, 4.6, 0.5);
    }
    c.fillStyle = lin(c, x0, y0, x0 + tw, y0 + th, [[0, "rgba(255,240,210,0.22)"], [0.5, "rgba(255,240,210,0)"], [1, "rgba(40,20,5,0.28)"]]); c.fillRect(x0, y0, tw, th);
    c.restore();
    c.lineWidth = 2; c.strokeStyle = "#c8915a"; rr(c, x0 + 1, y0 + 1, tw - 2, th - 2, 4.4); c.stroke();   // the rolled cane edge
    c.lineWidth = 0.6; c.strokeStyle = "rgba(255,236,200,0.7)"; c.beginPath(); c.moveTo(x0 + 0.6, y0 + th - 4); c.lineTo(x0 + 0.6, y0 + 0.6); c.lineTo(x0 + tw - 4, y0 + 0.6); c.stroke();
    c.strokeStyle = "rgba(60,30,6,0.55)"; rr(c, x0 + 0.3, y0 + 0.3, tw - 0.6, th - 0.6, 5); c.stroke();
    const my = y0 + th / 2;   // where the two lids meet
    c.fillStyle = "rgba(60,30,6,0.5)"; c.fillRect(x0 + 2, my - 0.6, tw - 4, 1.2); c.fillStyle = "rgba(255,230,190,0.45)"; c.fillRect(x0 + 2, my + 0.6, tw - 4, 0.5);
    for (const sx of [x0 + tw * 0.27, x0 + tw * 0.73]) {   // leather straps and buckles
      c.fillStyle = "rgba(40,20,4,0.3)"; c.fillRect(sx - 2.2 + 0.6, y0 + 0.8, 4.4, th - 0.4);
      c.fillStyle = lin(c, sx - 2.2, 0, sx + 2.2, 0, [[0, "#9a5a2c"], [0.5, "#7d4420"], [1, "#5e3014"]]); c.fillRect(sx - 2.2, y0, 4.4, th);
      c.fillStyle = "rgba(255,220,180,0.35)"; c.fillRect(sx - 2.2, y0, 0.6, th);
      c.strokeStyle = "rgba(255,226,190,0.35)"; c.lineWidth = 0.3; c.setLineDash([0.8, 0.8]); c.beginPath(); c.moveTo(sx - 1.4, y0 + 1); c.lineTo(sx - 1.4, y0 + th - 1); c.moveTo(sx + 1.4, y0 + 1); c.lineTo(sx + 1.4, y0 + th - 1); c.stroke(); c.setLineDash([]);
      const by = y0 + th - 7;
      c.strokeStyle = lin(c, sx - 3, by - 2, sx + 3, by + 2, [[0, "#fff8d8"], [0.5, "#d8b45a"], [1, "#8a6a22"]]); c.lineWidth = 1.1; rr(c, sx - 3, by - 2.2, 6, 4.4, 1); c.stroke();
      c.strokeStyle = "#e9d48e"; c.lineWidth = 0.6; c.beginPath(); c.moveTo(sx, by - 2); c.lineTo(sx, by + 2); c.stroke();
    }
    const hx0 = x0 + 7, hx1 = x0 + tw - 7, hy = my - 0.4;   // the handle, folded flat across the middle
    c.lineCap = "round";
    c.strokeStyle = "rgba(40,20,4,0.35)"; c.lineWidth = 3.6; c.beginPath(); c.moveTo(hx0 + 1.2, hy + 1.8); c.lineTo(hx1 + 1.2, hy + 1.8); c.stroke();
    c.strokeStyle = "#6e4620"; c.lineWidth = 3.6; c.beginPath(); c.moveTo(hx0, hy); c.lineTo(hx1, hy); c.stroke();
    c.strokeStyle = lin(c, 0, hy - 1.8, 0, hy + 1.8, [[0, "#e8b878"], [0.5, "#b47a40"], [1, "#7a4a1c"]]); c.lineWidth = 2.8; c.stroke();
    c.strokeStyle = "rgba(255,240,210,0.6)"; c.lineWidth = 0.6; c.beginPath(); c.moveTo(hx0 + 1, hy - 0.8); c.lineTo(hx1 - 1, hy - 0.8); c.stroke();
    for (const ex of [hx0, hx1]) { c.fillStyle = lin(c, ex - 2, hy - 2, ex + 2, hy + 2, [[0, "#fff8d8"], [0.5, "#c9a24a"], [1, "#7a5a1a"]]); circ(c, ex, hy, 2); c.fill(); }
  });
  stamp(g, cv, b.x, b.y);
  if (flash > 0) { g.globalAlpha = flash * 0.6; g.fillStyle = "#fff"; rr(g, b.x + x0, b.y + y0, tw, th, 5); g.fill(); g.globalAlpha = 1; }
}

// ── effects ──────────────────────────────────────────────────────────────────
export type Fx = { k: "puff" | "splat" | "spark" | "boom" | "crumble" | "block"; x: number; y: number; age: number; a: number; col: string };
export const FX_LIFE: Record<Fx["k"], number> = { puff: 260, splat: 520, spark: 240, boom: 700, crumble: 650, block: 400 };
const puffSprite = (k: number) => sprite("puff", k, 12, 12, 6, 6, c => { c.fillStyle = rad(c, 0, 0, 0, 5.6, [[0, "rgba(255,255,255,0.95)"], [0.55, "rgba(255,255,255,0.6)"], [1, "rgba(255,255,255,0)"]]); circ(c, 0, 0, 5.6); c.fill(); });
const ringSprite = (k: number, col: string) => sprite(`ring${col}`, k, 2 * MINE_BLAST + 12, 2 * MINE_BLAST + 12, MINE_BLAST + 6, MINE_BLAST + 6, c => {
  c.fillStyle = rad(c, 0, 0, MINE_BLAST * 0.2, MINE_BLAST, [[0, rgba(col, 0.05)], [0.75, rgba(col, 0.35)], [0.92, rgba(lighter(col, 0.6), 0.7)], [1, rgba(col, 0)]]); circ(c, 0, 0, MINE_BLAST); c.fill();
});
export function drawFx(g: C, f: Fx) {
  const k = f.age / FX_LIFE[f.k], e = 1 - k, sk = scaleOf(g);
  if (f.k === "puff") {   // a soft breath of steam at the straw
    const p = puffSprite(sk);
    for (let j = 0; j < 3; j++) { const d = 3 + 9 * k, px = f.x + Math.cos(f.a + (j - 1) * 0.6) * d, py = f.y + Math.sin(f.a + (j - 1) * 0.6) * d, s = (2.6 + 2.6 * k) / 2.8; g.globalAlpha = 0.75 * e; g.drawImage(p.cv, px - 6 * s, py - 6 * s, 12 * s, 12 * s); }
  } else if (f.k === "splat") {   // pea juice: a soft stain and a few glossy drops
    g.globalAlpha = 0.32 * e; g.fillStyle = f.col; circ(g, f.x, f.y, 5 + 4 * k); g.fill();
    for (let j = 0; j < 7; j++) {
      const an = j * 0.9 + f.a, d = 2 + 9 * k, px = f.x + Math.cos(an) * d, py = f.y + Math.sin(an) * d, R = 2.2 * (1 - k * 0.5);
      g.globalAlpha = e; g.fillStyle = darker(f.col, 0.18); circ(g, px + 0.3, py + 0.4, R); g.fill();
      g.fillStyle = lighter(f.col, 0.3); circ(g, px - R * 0.15, py - R * 0.15, R * 0.8); g.fill();
      g.fillStyle = "rgba(255,255,255,0.75)"; circ(g, px - R * 0.35, py - R * 0.35, R * 0.28); g.fill();
    }
  } else if (f.k === "spark") {   // a glint where a pea bounces
    g.globalAlpha = e; g.strokeStyle = "#fff6c8"; g.lineWidth = 1.4; g.lineCap = "round";
    g.beginPath(); for (let j = 0; j < 5; j++) { const an = j * 1.26 + f.a, d0 = 2 + 3 * k, d1 = 5 + 6 * k; g.moveTo(f.x + Math.cos(an) * d0, f.y + Math.sin(an) * d0); g.lineTo(f.x + Math.cos(an) * d1, f.y + Math.sin(an) * d1); } g.stroke();
    g.fillStyle = "rgba(255,230,140,0.75)"; circ(g, f.x, f.y, 2.2 * e); g.fill();
  } else if (f.k === "boom") {   // a jelly mine (or a lunchbox knocked out): a soft shock ring and glossy blobs flying
    const col = f.col || "#e2456b", ring = ringSprite(sk, col), s = 0.35 + 0.65 * Math.sqrt(k);
    g.globalAlpha = 0.85 * e; g.drawImage(ring.cv, f.x - ring.ox * s, f.y - ring.oy * s, ring.w * s, ring.h * s);
    g.globalAlpha = e; g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 2 * e + 0.5; circ(g, f.x, f.y, MINE_BLAST * (0.3 + 0.7 * k)); g.stroke();
    const dark = darker(col, 0.15), hi = rgba(lighter(col, 0.6), 0.9);
    for (let j = 0; j < 10; j++) {
      const an = j * 0.63, d = 6 + MINE_BLAST * 0.8 * k, px = f.x + Math.cos(an) * d, py = f.y + Math.sin(an) * d + 4 * k * k, R = 2.6 * e + 0.6;
      g.fillStyle = dark; circ(g, px, py, R); g.fill(); g.fillStyle = hi; circ(g, px - R * 0.3, py - R * 0.3, R * 0.4); g.fill();
    }
  } else if (f.k === "crumble") {   // a box gives way: shards of printed card tumbling out
    const m = g.getTransform();
    for (let j = 0; j < 10; j++) {
      const an = j * 0.7 + f.a, d = 4 + 20 * k; g.translate(f.x + Math.cos(an) * d, f.y + Math.sin(an) * d + 6 * k * k); g.rotate(an + k * 3);
      g.globalAlpha = e; g.fillStyle = "rgba(52,32,14,0.25)"; g.fillRect(-2.2, -1, 6, 4); g.fillStyle = f.col; g.fillRect(-3, -2, 6, 4); g.fillStyle = "rgba(255,255,255,0.45)"; g.fillRect(-3, -2, 6, 1); g.fillStyle = "#d8cfbf"; g.fillRect(2.2, -2, 0.8, 4);
      g.setTransform(m);
    }
  } else if (f.k === "block") {   // the lettuce shield takes the hit
    g.globalAlpha = e; g.strokeStyle = "#5aaa46"; g.lineWidth = 3 * e + 0.6; circ(g, f.x, f.y, TANK_R + 8 + 10 * k); g.stroke();
    g.strokeStyle = "rgba(220,255,200,0.7)"; g.lineWidth = 1; g.beginPath(); g.arc(f.x, f.y, TANK_R + 6 + 10 * k, Math.PI * 1.05, Math.PI * 1.55); g.stroke();
  }
  g.globalAlpha = 1;
}
export type Mark = { x: number; y: number; a: number; age: number };
export function drawMarks(g: C, marks: Mark[]) { treadMarks(g, marks); }
