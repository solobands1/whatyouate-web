// Pea Tanks' cover: what stands on the table, each lit from the top left with a hint of its side toward the bottom
// right and a soft contact shadow. Brandless cereal boxes with printed art, maple cutting boards, glazed mugs of coffee
// and tea, glazed fruit bowls (the fruit stays the game's food pictures), a glass salt shaker, and the bread walls.
import { type Ob } from "../tankSim";
import { type C, TAU, seeded, rr, circ, line, lin, rad, lighter, darker, rgba, gloss, rimArc, CHROME } from "../art2/paint";
import { soft, capsule, boxHull, clamp } from "./kit";

export type Imgs = Record<string, HTMLImageElement>;
const img = (imgs: Imgs, code: string) => { const i = imgs[code]; return i && i.complete && i.naturalWidth ? i : null; };
type Rect = Ob & { k: 0 };
type Round = Ob & { k: 1 };
const SH = "52,32,14";   // shadows on the cloth are a warm brown, never black

// how far each kind of thing shows its side (its height, seen a little from the top left)
const boxDepth = (o: Rect) => clamp(Math.min(o.w, o.h) * 0.14, 3, 4.6);
const BOARD_D = 2.6, MUG_D = 3.2, BOWL_D = 2.6, SALT_D = 3.4;
const mugHandle = (o: Round) => 0.32 + (((o.id * 37) % 7) - 3) * 0.12;   // which way the handle points: right, a little up or down

// ── shadows (painted once into the table, under everything) ─────────────────
export function drawCoverShadow(g: C, o: Ob) {
  if (o.k === 0) {
    const d = o.s === 0 ? boxDepth(o) : o.s === 1 ? BOARD_D : 2.4, x0 = o.x - o.w / 2, y0 = o.y - o.h / 2, far = o.s === 0 ? 1 : 0.65;
    soft(g, 9 * far, `rgba(${SH},${0.3})`, () => { boxHull(g, x0, y0, o.w, o.h, d); g.fill(); }, 4.2 * far, 6 * far);
    soft(g, 2, `rgba(${SH},0.42)`, () => { boxHull(g, x0, y0, o.w, o.h, d); g.fill(); }, 0.8, 1.2);
    return;
  }
  const { x, y, r } = o;
  if (o.s === 1) {   // a mug: the round foot and the handle
    const a = mugHandle(o), hx = x + Math.cos(a) * (r + 3.4), hy = y + Math.sin(a) * (r + 3.4);
    soft(g, 8, `rgba(${SH},0.32)`, () => { circ(g, x + 1, y + 1.2, r - 0.4); g.fill(); g.lineWidth = 3.6; circ(g, hx + 1, hy + 1.2, 4.4); g.stroke(); }, 4.6, 6.6);
    soft(g, 2, `rgba(${SH},0.45)`, () => { circ(g, x + 1.2, y + 1.5, r - 0.8); g.fill(); }, 0.6, 0.9);
  } else if (o.s === 2) {   // a tall shaker throws a longer shadow
    soft(g, 6, `rgba(${SH},0.34)`, () => { capsule(g, x + 1.5, y + 1.8, x + 6, y + 8, r - 1); g.fill(); }, 0, 0);
    soft(g, 1.6, `rgba(${SH},0.45)`, () => { circ(g, x + 1.4, y + 1.8, r - 0.8); g.fill(); }, 0.5, 0.7);
  } else {
    soft(g, 9, `rgba(${SH},0.3)`, () => { circ(g, x + 0.8, y + 1, r - 0.4); g.fill(); }, 4, 5.6);
    soft(g, 2.4, `rgba(${SH},0.42)`, () => { circ(g, x + 1, y + 1.3, r - 1); g.fill(); }, 0.5, 0.8);
  }
}

// ── cereal boxes ─────────────────────────────────────────────────────────────
const BOXES = [
  { body: "#F39B3A", deep: "#C2621A", rays: "#FFC968", band: "#FFF6E8", ink: "#E8505B", badge: "#FFE066", side: "#FFF0D6" },   // sunny orange
  { body: "#E5505F", deep: "#A9303F", rays: "#FF8A95", band: "#FFF4EF", ink: "#FFB534", badge: "#FFD84D", side: "#FFE9E6" },   // berry red
  { body: "#4D91EE", deep: "#2B62B9", rays: "#8FBFFF", band: "#F4F8FF", ink: "#FF7A93", badge: "#FFD84D", side: "#E8F1FF" },   // sky blue
];
/** A starburst with `n` points. */
function burst(g: C, x: number, y: number, r0: number, r1: number, n: number, rot = 0) {
  g.beginPath();
  for (let i = 0; i <= n * 2; i++) { const a = rot + (i / (n * 2)) * TAU, rr2 = i % 2 ? r0 : r1; if (i) g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); else g.moveTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  g.closePath();
}
export function drawCerealBox(g: C, o: Rect, imgs: Imgs) {
  const P = BOXES[o.c % 3], d = boxDepth(o), x0 = o.x - o.w / 2, y0 = o.y - o.h / 2, tw = o.w - d, th = o.h - d, along = o.w > o.h;
  // the two side faces we see, toward the bottom right
  boxHull(g, x0, y0, o.w, o.h, d); g.fillStyle = darker(P.body, 0.38); g.fill();
  g.beginPath(); g.moveTo(x0 + tw, y0); g.lineTo(x0 + o.w, y0 + d); g.lineTo(x0 + o.w, y0 + o.h); g.lineTo(x0 + tw, y0 + th); g.closePath();
  g.fillStyle = lin(g, x0 + tw, 0, x0 + o.w, 0, [[0, darker(P.body, 0.18)], [1, darker(P.body, 0.3)]]); g.fill();
  g.beginPath(); g.moveTo(x0, y0 + th); g.lineTo(x0 + tw, y0 + th); g.lineTo(x0 + o.w, y0 + o.h); g.lineTo(x0 + d, y0 + o.h); g.closePath();
  g.fillStyle = lin(g, 0, y0 + th, 0, y0 + o.h, [[0, darker(P.body, 0.28)], [1, darker(P.body, 0.42)]]); g.fill();
  // the print carries round the sides: the band and a panel of fine lines (no words)
  g.save(); boxHull(g, x0, y0, o.w, o.h, d); g.clip();
  g.fillStyle = rgba(P.side, 0.5);
  if (along) { g.beginPath(); g.moveTo(x0 + tw * 0.62, y0 + th); g.lineTo(x0 + tw * 0.62 + d, y0 + o.h); g.lineTo(x0 + tw * 0.8 + d, y0 + o.h); g.lineTo(x0 + tw * 0.8, y0 + th); g.closePath(); g.fill(); }
  else { g.beginPath(); g.moveTo(x0 + tw, y0 + th * 0.62); g.lineTo(x0 + o.w, y0 + th * 0.62 + d); g.lineTo(x0 + o.w, y0 + th * 0.8 + d); g.lineTo(x0 + tw, y0 + th * 0.8); g.closePath(); g.fill(); }
  g.restore();
  g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 0.5; line(g, x0 + tw + 0.3, y0 + 0.8, x0 + tw + 0.3, y0 + th - 0.3); line(g, x0 + 0.8, y0 + th + 0.3, x0 + tw - 0.3, y0 + th + 0.3);
  g.strokeStyle = rgba(darker(P.body, 0.55), 0.6); g.lineWidth = 0.6; boxHull(g, x0 + 0.3, y0 + 0.3, o.w - 0.6, o.h - 0.6, d); g.stroke();

  // the front of the box, lying face up: art laid out down the box, top end first
  g.save(); rr(g, x0, y0, tw, th, 1.4); g.clip();
  let S: number, L: number, turn = 0;
  if (along) { g.translate(x0, y0 + th); g.rotate(-Math.PI / 2); S = th; L = tw; turn = -Math.PI / 2; } else { g.translate(x0, y0); S = tw; L = th; }
  if (o.c % 2 === 1 && along) { g.translate(S, L); g.rotate(Math.PI); turn += Math.PI; }   // not every box lies the same way round
  g.fillStyle = lin(g, 0, 0, S * 0.4, L, [[0, lighter(P.body, 0.14)], [0.6, P.body], [1, darker(P.body, 0.06)]]); g.fillRect(0, 0, S, L);
  const hx = S * 0.5, hy = L * 0.62, hr = Math.min(S * 0.4, L * 0.28);
  g.save(); g.globalAlpha = 0.45; g.fillStyle = P.rays;   // sunburst behind the bowl
  for (let i = 0; i < 16; i += 2) { const a0 = (i / 16) * TAU, a1 = ((i + 1) / 16) * TAU; g.beginPath(); g.moveTo(hx, hy); g.arc(hx, hy, L * 1.2, a0, a1); g.closePath(); g.fill(); }
  g.restore();
  const wy = L * 0.3;   // the title wave
  g.fillStyle = rgba(darker(P.body, 0.4), 0.35); g.beginPath(); g.moveTo(0, wy - L * 0.12 + 1); g.quadraticCurveTo(S * 0.5, wy - L * 0.2 + 1, S, wy - L * 0.1 + 1); g.lineTo(S, wy + L * 0.06 + 1); g.quadraticCurveTo(S * 0.5, wy - L * 0.02 + 1, 0, wy + L * 0.06 + 1); g.closePath(); g.fill();
  g.fillStyle = P.band; g.beginPath(); g.moveTo(0, wy - L * 0.12); g.quadraticCurveTo(S * 0.5, wy - L * 0.2, S, wy - L * 0.1); g.lineTo(S, wy + L * 0.06); g.quadraticCurveTo(S * 0.5, wy - L * 0.02, 0, wy + L * 0.06); g.closePath(); g.fill();
  const bh = Math.max(1.6, L * 0.05);   // two bold bars where the name would go
  g.fillStyle = P.ink; rr(g, S * 0.16, wy - L * 0.1, S * 0.6, bh, bh / 2); g.fill(); rr(g, S * 0.16, wy - L * 0.1 + bh * 1.5, S * 0.38, bh * 0.8, bh * 0.4); g.fill();
  g.fillStyle = P.band; circ(g, hx, hy, hr); g.fill();
  g.strokeStyle = rgba(P.ink, 0.85); g.lineWidth = Math.max(0.7, hr * 0.09); circ(g, hx, hy, hr - g.lineWidth * 1.2); g.stroke();
  const im = img(imgs, "1f963"); if (im) { const s = hr * 1.6; g.save(); g.translate(hx, hy); g.rotate(-turn); g.drawImage(im, -s / 2, -s / 2 - hr * 0.04, s, s); g.restore(); }   // the food picture stays upright
  const bx = S * 0.8, by = L * 0.44, br = Math.min(S, L) * 0.12;   // a star badge
  g.fillStyle = rgba(darker(P.body, 0.45), 0.3); burst(g, bx + 0.4, by + 0.6, br * 0.78, br, 10); g.fill();
  g.fillStyle = P.badge; burst(g, bx, by, br * 0.78, br, 10); g.fill();
  g.fillStyle = "#ffffff"; circ(g, bx, by, br * 0.42); g.fill();
  g.fillStyle = P.deep; g.fillRect(0, L * 0.93, S, L * 0.07);   // a band along the bottom
  g.fillStyle = rgba(P.band, 0.5); for (let q = S * 0.1; q < S * 0.9; q += 2.2) g.fillRect(q, L * 0.955, 1.1, L * 0.02);
  const fl = Math.min(3, L * 0.07);   // the top flap folded over the end
  g.fillStyle = rgba(lighter(P.body, 0.25), 0.55); g.fillRect(0, 0, S, fl);
  g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(0, fl, S, 0.45); g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(0, fl + 0.45, S, 0.4);
  g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(S * 0.5 - 0.2, 0, 0.4, fl);
  g.restore();
  // coated card: one sheen across the face, a bright top and left edge
  g.save(); rr(g, x0, y0, tw, th, 1.4); g.clip();
  g.fillStyle = lin(g, x0, y0, x0 + tw, y0 + th, [[0, "rgba(255,255,255,0.22)"], [0.28, "rgba(255,255,255,0.05)"], [0.36, "rgba(255,255,255,0.2)"], [0.44, "rgba(255,255,255,0)"], [1, "rgba(0,0,0,0.08)"]]); g.fillRect(x0, y0, tw, th);
  g.restore();
  g.lineWidth = 0.9; g.strokeStyle = "rgba(255,255,255,0.7)"; g.beginPath(); g.moveTo(x0 + 0.5, y0 + th - 1); g.lineTo(x0 + 0.5, y0 + 0.5); g.lineTo(x0 + tw - 1, y0 + 0.5); g.stroke();
  g.strokeStyle = rgba(darker(P.body, 0.5), 0.5); g.lineWidth = 0.6; rr(g, x0 + 0.3, y0 + 0.3, tw - 0.6, th - 0.6, 1.3); g.stroke();
  if (o.hp !== undefined && o.hp < 3) {   // dents, then a split with the grey card showing through
    const dent = (px: number, py: number, s: number) => {
      g.fillStyle = rad(g, px + s * 0.2, py + s * 0.25, 0, s, [[0, "rgba(40,20,5,0.34)"], [1, "rgba(40,20,5,0)"]]); circ(g, px + s * 0.2, py + s * 0.25, s); g.fill();
      g.fillStyle = rad(g, px - s * 0.35, py - s * 0.35, 0, s * 0.6, [[0, "rgba(255,255,255,0.4)"], [1, "rgba(255,255,255,0)"]]); circ(g, px - s * 0.35, py - s * 0.35, s * 0.6); g.fill();
    };
    const rn = seeded(o.id * 29 + o.hp);
    const tear = (pts: number[][]) => {   // a jagged split: torn card edges either side of a dark gap
      const zz: number[][] = [];
      for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; for (let j = 0; j < 4; j++) { const t = j / 4, nx = -(by - ay), ny = bx - ax, l = Math.hypot(nx, ny) || 1, w = (j % 2 ? 1 : -1) * (0.4 + rn() * 0.6); zz.push([ax + (bx - ax) * t + (nx / l) * w, ay + (by - ay) * t + (ny / l) * w]); } }
      zz.push(pts[pts.length - 1]);
      const path = (dx: number, dy: number) => { g.beginPath(); zz.forEach(([px, py], i) => (i ? g.lineTo(px + dx, py + dy) : g.moveTo(px + dx, py + dy))); };
      g.lineJoin = "miter"; g.lineCap = "butt";
      path(0.5, 0.6); g.strokeStyle = "rgba(250,244,232,0.95)"; g.lineWidth = 1.1; g.stroke();
      path(-0.5, -0.5); g.strokeStyle = "rgba(250,244,232,0.95)"; g.lineWidth = 0.9; g.stroke();
      path(0, 0); g.strokeStyle = "rgba(84,56,34,0.85)"; g.lineWidth = 0.75; g.stroke();
    };
    dent(x0 + tw * 0.3, y0 + th * 0.36, Math.min(tw, th) * 0.16);
    tear([[x0 + tw * 0.18, y0 + 1], [x0 + tw * 0.3, y0 + th * 0.22], [x0 + tw * 0.26, y0 + th * 0.4], [x0 + tw * 0.36, y0 + th * 0.62]]);
    if (o.hp < 2) {
      dent(x0 + tw * 0.7, y0 + th * 0.62, Math.min(tw, th) * 0.2);
      tear([[x0 + tw - 1, y0 + th * 0.3], [x0 + tw * 0.76, y0 + th * 0.48], [x0 + tw * 0.8, y0 + th * 0.7], [x0 + tw * 0.68, y0 + th - 1]]);
      g.fillStyle = "#d8cfbf"; g.beginPath(); g.moveTo(x0 + tw, y0 + th); g.lineTo(x0 + tw - 7, y0 + th); g.lineTo(x0 + tw, y0 + th - 7); g.closePath(); g.fill();   // a crushed corner
      g.strokeStyle = "rgba(60,40,20,0.5)"; g.lineWidth = 0.6; line(g, x0 + tw - 7, y0 + th, x0 + tw, y0 + th - 7);
    }
  }
}

// ── cutting boards ───────────────────────────────────────────────────────────
function knife(g: C, x: number, y: number, len: number, along: boolean) {
  g.save(); g.translate(x, y); if (!along) g.rotate(Math.PI / 2); g.rotate(-0.06);
  const hl = len * 0.38;
  g.fillStyle = "rgba(60,32,10,0.28)"; g.beginPath(); g.moveTo(-len / 2 + hl + 1.2, -2); g.lineTo(len / 2 - 0.8, -1); g.quadraticCurveTo(len / 2 + 2, 0.6, len / 2 - 2.8, 3.6); g.lineTo(-len / 2 + hl + 1.2, 4.2); g.closePath(); g.fill();
  g.fillStyle = "rgba(40,20,5,0.3)"; rr(g, -len / 2 + 1, -2.2, hl, 6.8, 3); g.fill();
  g.fillStyle = lin(g, 0, -3.2, 0, 3, [[0, "#ffffff"], [0.35, "#e3e8ee"], [0.65, "#a9b2bc"], [1, "#7d8792"]]);
  g.beginPath(); g.moveTo(-len / 2 + hl, -3.2); g.lineTo(len / 2 - 2, -2.2); g.quadraticCurveTo(len / 2 + 1, -0.6, len / 2 - 4, 2.4); g.lineTo(-len / 2 + hl, 3); g.closePath(); g.fill();
  g.strokeStyle = "rgba(70,80,92,0.5)"; g.lineWidth = 0.4; g.stroke();
  g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = 0.6; line(g, -len / 2 + hl + 1, -2.4, len / 2 - 4, -1.6);
  g.fillStyle = lin(g, 0, -3.4, 0, 3.4, [[0, "#5a514b"], [0.5, "#2c2724"], [1, "#1c1816"]]); rr(g, -len / 2, -3.4, hl, 6.8, 3); g.fill();
  g.fillStyle = lin(g, 0, -1, 0, 1, CHROME); for (const rx of [0.25, 0.55, 0.82]) { circ(g, -len / 2 + hl * rx, 0, 1); g.fill(); }
  g.fillStyle = "rgba(255,255,255,0.3)"; rr(g, -len / 2 + 1.5, -2.6, hl - 3, 1, 0.5); g.fill();
  g.restore();
}
export function drawBoard(g: C, o: Rect) {
  const d = BOARD_D, x0 = o.x - o.w / 2, y0 = o.y - o.h / 2, tw = o.w - d, th = o.h - d, along = o.w >= o.h, r = seeded(o.id * 131 + 7);
  const pal = ["#e4b47a", "#d8a669", "#edc38e", "#d09d5e", "#e0b073", "#c9955a"];
  boxHull(g, x0, y0, o.w, o.h, d); g.fillStyle = "#94622f"; g.fill();   // the board's edge
  g.save(); boxHull(g, x0, y0, o.w, o.h, d); g.clip();
  const span = along ? th : tw;   // end grain on the edge: the strips' ends
  for (let p = 0; p < span;) { const sw = 5 + r() * 4; g.fillStyle = r() < 0.5 ? "rgba(255,220,170,0.12)" : "rgba(80,40,10,0.14)"; if (along) g.fillRect(x0 + d, y0 + p + d, o.w, sw); else g.fillRect(x0 + p + d, y0 + d, sw, o.h); p += sw; }
  g.restore();
  g.fillStyle = "rgba(255,230,190,0.3)"; g.fillRect(x0 + tw, y0 + 0.6, 0.6, th);
  g.save(); rr(g, x0, y0, tw, th, 6); g.clip();
  for (let p = 0; p < span;) {   // edge-grain strips glued side by side
    const sw = 5 + r() * 4, col = pal[Math.floor(r() * pal.length)];
    g.fillStyle = col; if (along) g.fillRect(x0, y0 + p, tw, sw); else g.fillRect(x0 + p, y0, sw, th);
    for (let k = 0; k < 5; k++) {
      const o2 = p + r() * sw, ph = r() * TAU; g.strokeStyle = r() < 0.3 ? "rgba(255,236,200,0.28)" : `rgba(120,70,25,${0.1 + r() * 0.16})`; g.lineWidth = 0.3 + r() * 0.5; g.beginPath();
      for (let s = -4; s <= (along ? tw : th) + 4; s += 5) { const wv = o2 + Math.sin(s / 15 + ph) * 0.6; if (along) { if (s === -4) g.moveTo(x0 + s, y0 + wv); else g.lineTo(x0 + s, y0 + wv); } else { if (s === -4) g.moveTo(x0 + wv, y0 + s); else g.lineTo(x0 + wv, y0 + s); } }
      g.stroke();
    }
    g.fillStyle = "rgba(110,64,24,0.38)"; if (along) g.fillRect(x0, y0 + p, tw, 0.45); else g.fillRect(x0 + p, y0, 0.45, th);
    p += sw;
  }
  for (let i = 0; i < 14; i++) { const kx = x0 + 8 + r() * (tw - 16), ky = y0 + 6 + r() * (th - 12); g.strokeStyle = "rgba(110,60,20,0.16)"; g.lineWidth = 0.3; const a = along ? r() * 0.3 - 0.15 : Math.PI / 2 + r() * 0.3 - 0.15; line(g, kx, ky, kx + Math.cos(a) * (4 + r() * 6), ky + Math.sin(a) * (4 + r() * 6)); }   // knife marks
  g.fillStyle = lin(g, x0, y0, x0 + tw, y0 + th, [[0, "rgba(255,246,226,0.05)"], [0.22, "rgba(255,246,226,0.26)"], [0.36, "rgba(255,246,226,0)"], [0.6, "rgba(255,246,226,0.1)"], [0.7, "rgba(255,246,226,0)"], [1, "rgba(60,30,5,0.1)"]]); g.fillRect(x0, y0, tw, th);
  g.restore();
  g.strokeStyle = "rgba(110,62,20,0.5)"; g.lineWidth = 1.4; rr(g, x0 + 3.6, y0 + 3.6, tw - 7.2, th - 7.2, 4); g.stroke();   // the juice groove
  g.strokeStyle = "rgba(255,236,200,0.55)"; g.lineWidth = 0.6; rr(g, x0 + 4.3, y0 + 4.3, tw - 7.2, th - 7.2, 4); g.stroke();
  g.lineWidth = 1.1; g.strokeStyle = "rgba(255,240,210,0.7)"; g.beginPath(); g.moveTo(x0 + 0.6, y0 + th - 6); g.lineTo(x0 + 0.6, y0 + 0.6); g.lineTo(x0 + tw - 6, y0 + 0.6); g.stroke();
  g.strokeStyle = "rgba(90,48,14,0.45)"; g.lineWidth = 0.6; rr(g, x0 + 0.3, y0 + 0.3, tw - 0.6, th - 0.6, 6); g.stroke();
  const hx = along ? x0 + 9 : x0 + tw / 2, hy = along ? y0 + th / 2 : y0 + 9;   // the hanging hole, the cloth showing through
  g.fillStyle = "rgba(60,32,10,0.7)"; circ(g, hx, hy, 3.2); g.fill(); g.fillStyle = "#e9ecf3"; circ(g, hx + 0.7, hy + 0.9, 2.4); g.fill();
  g.strokeStyle = "rgba(255,240,210,0.65)"; g.lineWidth = 0.6; g.beginPath(); g.arc(hx, hy, 3.3, 0.1, Math.PI * 0.6); g.stroke();
  const len = (along ? tw : th) * 0.56;
  if (len > 40) knife(g, along ? x0 + tw / 2 + 6 : x0 + tw / 2, along ? y0 + th / 2 : y0 + th / 2 + 6, len, along);
}

// ── glazed ceramic ───────────────────────────────────────────────────────────
const MUGS = [
  { glaze: "#F3EDE2", inner: "#FBF8F2", speck: true },   // cream stoneware
  { glaze: "#6FA8FF", inner: "#F6F9FF", speck: false },  // sky blue
  { glaze: "#F2C04C", inner: "#FFF9EA", speck: false },  // mustard
];
const LIGHT = { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };
/** The wall of something round, between its top (x0, y0) and its foot (x1, y1): lit on the side toward the light. */
function wall(g: C, x0: number, y0: number, x1: number, y1: number, r: number, col: string) {
  capsule(g, x0, y0, x1, y1, r);
  const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny) || 1, s = (nx * LIGHT.x + ny * LIGHT.y) / l > 0 ? 1 : -1;
  const ux = (nx / l) * s * r, uy = (ny / l) * s * r, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  g.fillStyle = lin(g, cx + ux, cy + uy, cx - ux, cy - uy, [[0, lighter(col, 0.1)], [0.5, darker(col, 0.2)], [1, darker(col, 0.42)]]); g.fill();
}
function specks(g: C, x: number, y: number, r: number, seed: number) {
  const rn = seeded(seed);
  for (let i = 0; i < r * 3; i++) { const a = rn() * TAU, d = Math.sqrt(rn()) * r; g.fillStyle = `rgba(90,70,50,${0.25 + rn() * 0.3})`; circ(g, x + Math.cos(a) * d, y + Math.sin(a) * d, 0.18 + rn() * 0.22); g.fill(); }
}
export function drawMug(g: C, o: Round) {
  const { x, y, r } = o, P = MUGS[o.c % 3], R = r - 0.4, d = MUG_D;
  const tx = x - d * 0.42, ty = y - d * 0.5, fx = x + d * 0.42, fy = y + d * 0.5;   // the rim, and the foot below it
  const a = mugHandle(o);
  // the handle: a glazed loop, its own side showing
  const pt = (rr2: number, da: number, ox: number, oy: number) => [x + Math.cos(a + da) * rr2 + ox, y + Math.sin(a + da) * rr2 + oy];
  const loop = (ox: number, oy: number) => {   // the handle: two short arms out of the wall and a rounded grip between them
    const [p0x, p0y] = pt(R - 1.5, -0.58, ox, oy), [c0x, c0y] = pt(R + 7.6, -0.52, ox, oy), [mx, my] = pt(R + 7.4, 0, ox, oy), [c1x, c1y] = pt(R + 7.6, 0.52, ox, oy), [p1x, p1y] = pt(R - 1.5, 0.58, ox, oy);
    g.beginPath(); g.moveTo(p0x, p0y); g.quadraticCurveTo(c0x, c0y, mx, my); g.quadraticCurveTo(c1x, c1y, p1x, p1y);
  };
  g.lineCap = "round"; g.lineJoin = "round";
  loop(0.7, 0.9); g.strokeStyle = darker(P.glaze, 0.4); g.lineWidth = 2.8; g.stroke();
  loop(-0.35, -0.45); g.strokeStyle = lin(g, x - R, y - R, x + R + 8, y + R + 8, [[0, lighter(P.glaze, 0.3)], [0.6, P.glaze], [1, darker(P.glaze, 0.12)]]); g.lineWidth = 2.4; g.stroke();
  loop(-0.75, -0.95); g.strokeStyle = rgba(lighter(P.glaze, 0.7), 0.85); g.lineWidth = 0.6; g.stroke();
  wall(g, tx, ty, fx, fy, R, P.glaze);
  if (P.speck) { g.save(); capsule(g, tx, ty, fx, fy, R); g.clip(); specks(g, x, y, R + 2, o.id * 3 + 1); g.restore(); }
  // the rim: a glazed lip, bright where it faces the light
  g.fillStyle = lin(g, tx - R, ty - R, tx + R, ty + R, [[0, lighter(P.glaze, 0.5)], [0.5, P.glaze], [1, darker(P.glaze, 0.18)]]); circ(g, tx, ty, R); g.fill();
  if (P.speck) { g.save(); circ(g, tx, ty, R); g.clip(); specks(g, tx, ty, R, o.id * 5 + 2); g.restore(); }
  const ri = R * 0.82;
  g.fillStyle = P.inner; circ(g, tx, ty, ri); g.fill();   // inside: the far wall lit, the near wall in the rim's shadow
  g.fillStyle = lin(g, tx - ri, ty - ri, tx + ri, ty + ri, [[0, "rgba(60,40,20,0.3)"], [0.5, "rgba(60,40,20,0.06)"], [1, "rgba(255,255,255,0.2)"]]); circ(g, tx, ty, ri); g.fill();
  // what's in it, lower than the rim so it sits a touch down and right
  const kind = o.id % 3, lx = tx + 0.5, ly = ty + 0.6, lr = ri * 0.86;
  if (kind === 1) {   // tea, clear amber with a paler ring at the glaze
    g.fillStyle = rad(g, lx + lr * 0.1, ly + lr * 0.1, 0, lr, [[0, "#c98232"], [0.7, "#9c5a1c"], [1, "#6a360c"]]); circ(g, lx, ly, lr); g.fill();
    g.strokeStyle = "rgba(255,210,150,0.4)"; g.lineWidth = 0.7; circ(g, lx, ly, lr - 0.5); g.stroke();
  } else if (kind === 2) {   // a latte with a foam heart
    g.fillStyle = rad(g, lx, ly, 0, lr, [[0, "#d9a873"], [0.75, "#b9824a"], [1, "#8a5528"]]); circ(g, lx, ly, lr); g.fill();
    g.save(); g.translate(lx, ly + lr * 0.05); g.rotate(-0.4); const hs2 = lr * 0.42;
    g.fillStyle = "rgba(255,248,236,0.95)"; g.beginPath(); g.moveTo(0, hs2 * 0.95); g.bezierCurveTo(-hs2 * 1.5, -hs2 * 0.1, -hs2 * 0.7, -hs2 * 1.2, 0, -hs2 * 0.45); g.bezierCurveTo(hs2 * 0.7, -hs2 * 1.2, hs2 * 1.5, -hs2 * 0.1, 0, hs2 * 0.95); g.fill();
    g.restore();
    g.strokeStyle = "rgba(255,240,220,0.5)"; g.lineWidth = 0.8; circ(g, lx, ly, lr - 0.8); g.stroke();
  } else {   // black coffee with a ring of crema
    g.fillStyle = rad(g, lx + lr * 0.1, ly + lr * 0.1, 0, lr, [[0, "#7a4320"], [0.7, "#4f2810"], [1, "#2e1606"]]); circ(g, lx, ly, lr); g.fill();
    g.strokeStyle = "rgba(214,160,100,0.55)"; g.lineWidth = 0.9; circ(g, lx, ly, lr - 0.7); g.stroke();
  }
  gloss(g, lx - lr * 0.32, ly - lr * 0.36, lr * 0.34, lr * 0.13, 0.55);   // the lamp in the drink
  rimArc(g, tx, ty, R - 0.9, 1.2, 0.9, 0.3);
  g.strokeStyle = rgba(darker(P.glaze, 0.35), 0.45); g.lineWidth = 0.5; circ(g, tx, ty, ri); g.stroke();
  g.strokeStyle = rgba(darker(P.glaze, 0.5), 0.5); g.lineWidth = 0.6; capsule(g, tx, ty, fx, fy, R - 0.3); g.stroke();
}
const BOWLS = [
  { glaze: "#4C86E0", band: "#F2C14E" },   // cobalt with a gold line
  { glaze: "#6FAE8F", band: "#FFFFFF" },   // soft sage
  { glaze: "#D86A4A", band: "#FFE2A8" },   // terracotta
];
export function drawFruitBowl(g: C, o: Round, imgs: Imgs, fruit: string[][]) {
  const { x, y, r } = o, P = BOWLS[o.c % 3], d = BOWL_D, R = r - 0.4;
  const tx = x - d * 0.4, ty = y - d * 0.5, fx = x + d * 0.4, fy = y + d * 0.5;
  wall(g, tx, ty, fx, fy, R, P.glaze);
  g.fillStyle = lin(g, tx - R, ty - R, tx + R, ty + R, [[0, lighter(P.glaze, 0.42)], [0.5, P.glaze], [1, darker(P.glaze, 0.22)]]); circ(g, tx, ty, R); g.fill();
  const ri = R * 0.86;
  g.fillStyle = "#fbf6ec"; circ(g, tx, ty, ri); g.fill();   // the cream glaze inside, shaded like a hollow
  g.fillStyle = rad(g, tx + ri * 0.12, ty + ri * 0.14, ri * 0.2, ri, [[0, "rgba(255,255,255,0)"], [0.7, "rgba(120,96,70,0.08)"], [1, "rgba(120,96,70,0.26)"]]); circ(g, tx, ty, ri); g.fill();
  g.fillStyle = lin(g, tx - ri, ty - ri, tx + ri, ty + ri, [[0, "rgba(70,50,30,0.22)"], [0.45, "rgba(70,50,30,0)"], [0.8, "rgba(255,255,255,0)"], [1, "rgba(255,255,255,0.3)"]]); circ(g, tx, ty, ri); g.fill();
  g.strokeStyle = rgba(P.band, 0.9); g.lineWidth = 1; circ(g, tx, ty, ri - 1.6); g.stroke();   // a painted line round the inside
  g.strokeStyle = "rgba(150,120,90,0.25)"; g.lineWidth = 0.6; circ(g, tx + 0.6, ty + 0.7, ri * 0.42); g.stroke();   // the foot ring, seen through
  const fr = fruit[o.c % fruit.length], s = R * 0.98, spots = [[-0.32, -0.22, 0.3], [0.3, -0.12, -0.4], [-0.04, 0.32, 0.1]];
  fr.forEach((f, j) => {
    const im = img(imgs, f), px = tx + spots[j][0] * R, py = ty + spots[j][1] * R;
    g.fillStyle = rad(g, px + s * 0.08, py + s * 0.12, 0, s * 0.42, [[0, "rgba(90,50,15,0.38)"], [1, "rgba(90,50,15,0)"]]); circ(g, px + s * 0.08, py + s * 0.12, s * 0.42); g.fill();
    if (im) { g.save(); g.translate(px, py); g.rotate(spots[j][2]); g.drawImage(im, -s / 2, -s / 2, s, s); g.restore(); }
  });
  g.strokeStyle = rgba(darker(P.glaze, 0.3), 0.6); g.lineWidth = 0.6; circ(g, tx, ty, ri); g.stroke();
  rimArc(g, tx, ty, R - 1, 1.4, 0.9, 0.35);
  gloss(g, tx - R * 0.62, ty - R * 0.6, R * 0.2, R * 0.08, 0.75);
  g.strokeStyle = rgba(darker(P.glaze, 0.55), 0.55); g.lineWidth = 0.6; capsule(g, tx, ty, fx, fy, R - 0.3); g.stroke();
}
export function drawShaker(g: C, o: Round) {
  const { x, y, r } = o, d = SALT_D, R = r - 0.3, tx = x - d * 0.42, ty = y - d * 0.5, fx = x + d * 0.42, fy = y + d * 0.5, rn = seeded(o.id * 17);
  capsule(g, tx, ty, fx, fy, R); g.fillStyle = "rgba(200,216,232,0.85)"; g.fill();   // the glass, salt inside it
  g.save(); capsule(g, tx, ty, fx, fy, R); g.clip();
  g.fillStyle = "#f6f7f9"; capsule(g, tx + 0.8, ty + 1, fx, fy, R - 1.1); g.fill();
  for (let i = 0; i < 46; i++) { g.fillStyle = rn() < 0.5 ? "rgba(255,255,255,1)" : "rgba(150,164,182,0.55)"; g.fillRect(x - R + rn() * R * 2.4, y - R + rn() * R * 2.4, 0.55, 0.55); }
  g.fillStyle = lin(g, fx - R, fy - R, fx + R, fy + R, [[0, "rgba(255,255,255,0.5)"], [0.35, "rgba(255,255,255,0)"], [0.7, "rgba(70,96,124,0.18)"], [1, "rgba(70,96,124,0.45)"]]); g.fillRect(x - R - 4, y - R - 4, R * 2 + 10, R * 2 + 10);
  g.restore();
  g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = 0.9; g.beginPath(); g.arc(fx, fy, R - 0.7, Math.PI * 0.5, Math.PI * 0.9); g.stroke();   // light caught in the glass
  g.strokeStyle = "rgba(60,80,104,0.5)"; g.lineWidth = 0.5; capsule(g, tx, ty, fx, fy, R - 0.2); g.stroke();
  const cr = R * 0.92;   // the steel cap: a rolled rim and a domed top full of holes
  g.fillStyle = "rgba(40,50,60,0.35)"; circ(g, tx + 0.4, ty + 0.6, cr); g.fill();
  g.fillStyle = lin(g, tx - cr, ty - cr, tx + cr, ty + cr, CHROME); circ(g, tx, ty, cr); g.fill();
  g.fillStyle = rad(g, tx, ty, 0.5, cr * 0.72, [[0, "#ffffff"], [0.55, "#d9dfe6"], [1, "#8d97a2"]], tx - cr * 0.3, ty - cr * 0.35); circ(g, tx, ty, cr * 0.72); g.fill();
  g.strokeStyle = "rgba(50,60,72,0.55)"; g.lineWidth = 0.45; circ(g, tx, ty, cr * 0.72); g.stroke(); circ(g, tx, ty, cr - 0.25); g.stroke();
  for (const [dx, dy] of [[0, 0], [-2.2, -1.3], [2.2, -1.3], [-1.35, 2.1], [1.35, 2.1]]) { g.fillStyle = "#39414b"; circ(g, tx + dx, ty + dy, 0.62); g.fill(); g.fillStyle = "rgba(255,255,255,0.85)"; circ(g, tx + dx + 0.32, ty + dy + 0.36, 0.24); g.fill(); }
  gloss(g, tx - cr * 0.4, ty - cr * 0.45, cr * 0.34, cr * 0.15, 0.95);
}

// ── bread walls (the Fortify power-up): drawn every frame while they last, so no blur ──
export function drawBreadShadow(g: C, o: Rect) {
  g.fillStyle = "rgba(52,32,14,0.12)"; rr(g, o.x - o.w / 2 + 3, o.y - o.h / 2 + 4.5, o.w, o.h, 7); g.fill();
  g.fillStyle = "rgba(52,32,14,0.16)"; rr(g, o.x - o.w / 2 + 1.5, o.y - o.h / 2 + 2.2, o.w, o.h, 6); g.fill();
}
export function drawBread(g: C, o: Rect) {
  const d = 2.4, x = o.x - o.w / 2, y = o.y - o.h / 2, tw = o.w - d, th = o.h - d, along = o.w >= o.h;
  g.globalAlpha = Math.min(1, o.ttl ?? 1);
  g.fillStyle = "#8a4f16"; rr(g, x + d, y + d, tw, th, 6); g.fill(); g.fillRect(x + d * 0.5, y + d * 0.5, tw, th);
  g.fillStyle = along ? lin(g, 0, y, 0, y + th, [[0, "#f7d397"], [0.45, "#dd9c4a"], [1, "#a8661f"]]) : lin(g, x, 0, x + tw, 0, [[0, "#f7d397"], [0.45, "#dd9c4a"], [1, "#a8661f"]]);
  rr(g, x, y, tw, th, 6); g.fill();
  const n = Math.max(2, Math.round((along ? tw : th) / 12));
  g.lineCap = "round";
  for (let k = 1; k < n; k++) {   // the scored top
    g.strokeStyle = "rgba(255,238,196,0.8)"; g.lineWidth = 1.8; g.beginPath();
    if (along) { const xx = x + (tw * k) / n; g.moveTo(xx - 2, y + 3.2); g.lineTo(xx + 2, y + th - 3.2); } else { const yy = y + (th * k) / n; g.moveTo(x + 3.2, yy - 2); g.lineTo(x + tw - 3.2, yy + 2); }
    g.stroke(); g.strokeStyle = "rgba(120,60,10,0.45)"; g.lineWidth = 0.7; g.stroke();
  }
  g.fillStyle = "rgba(255,255,255,0.55)"; for (let k = 0; k < 10; k++) { const fx = x + (((k * 37) % 100) / 100) * tw, fy = y + (((k * 61) % 100) / 100) * th; g.fillRect(fx, fy, 0.8, 0.8); }
  g.fillStyle = "rgba(255,255,255,0.35)"; rr(g, x + 2.5, y + 1.4, tw - 5, Math.min(2, th * 0.15), 1); g.fill();
  g.globalAlpha = 1;
}
