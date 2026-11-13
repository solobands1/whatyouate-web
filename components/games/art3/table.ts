// Pea Tanks' table: a yarn-dyed linen gingham cloth in soft sky blues and cream, lying on a walnut table whose edge
// rises round it as the rim; a couple of fold creases and soft rumples; one warm light from the top left falling into a
// vignette. Plus the spills on the cloth (milk, syrup, the sink) and the herb patch. All painted once, except the herb
// leaves on top, which are small cached sprites that sway.
import { AW, AH, type Zone } from "../tankSim";
import { type C, TAU, seeded, rr, circ, ell, line, lin, rad, mix, scaleOf, layer, warmLight, CHROME } from "../art2/paint";
import { soft, sprite, stamp } from "./kit";

export const RIM = 7, CORNER = 18;
const S = 36;   // one gingham check, in board units

// ── the cloth ────────────────────────────────────────────────────────────────
function gingham(g: C) {
  const r = seeded(0x9ea7), x0 = (AW - Math.ceil(AW / S) * S) / 2, y0 = (AH - Math.ceil(AH / S) * S) / 2;
  g.fillStyle = "#fbf9f3"; g.fillRect(0, 0, AW, AH);
  // the blue threads run both ways; where two blue bands cross the colour doubles, which is what makes gingham
  const band = "rgba(86,146,238,0.235)", edge = "rgba(86,146,238,0.11)";
  for (let x = x0; x < AW; x += S * 2) { g.fillStyle = band; g.fillRect(x + 0.6, 0, S - 1.2, AH); g.fillStyle = edge; g.fillRect(x, 0, 0.6, AH); g.fillRect(x + S - 0.6, 0, 0.6, AH); }
  for (let y = y0; y < AH; y += S * 2) { g.fillStyle = band; g.fillRect(0, y + 0.6, AW, S - 1.2); g.fillStyle = edge; g.fillRect(0, y, AW, 0.6); g.fillRect(0, y + S - 0.6, AW, 0.6); }
  // dyed threads inside each band: fine lines along it, a little uneven, like real yarn
  for (let x = x0; x < AW; x += S * 2) for (let t = x + 0.4; t < x + S; t += 1.15) { g.fillStyle = r() < 0.5 ? `rgba(60,112,205,${0.03 + r() * 0.05})` : `rgba(255,255,255,${0.04 + r() * 0.06})`; g.fillRect(t, 0, 0.5, AH); }
  for (let y = y0; y < AH; y += S * 2) for (let t = y + 0.4; t < y + S; t += 1.15) { g.fillStyle = r() < 0.5 ? `rgba(60,112,205,${0.03 + r() * 0.05})` : `rgba(255,255,255,${0.04 + r() * 0.06})`; g.fillRect(0, t, AW, 0.5); }
}
function linen(g: C) {
  const r = seeded(0x11e7);
  // the weave over everything: each thread its own weight, so it reads as cloth, not as a grid
  for (let y = 0; y < AH; y += 1.15) { g.fillStyle = r() < 0.55 ? `rgba(255,255,255,${0.05 + r() * 0.09})` : `rgba(60,70,92,${0.012 + r() * 0.03})`; g.fillRect(0, y, AW, 0.45); }
  for (let x = 0; x < AW; x += 1.15) { g.fillStyle = r() < 0.55 ? `rgba(255,255,255,${0.04 + r() * 0.08})` : `rgba(60,70,92,${0.01 + r() * 0.025})`; g.fillRect(x, 0, 0.45, AH); }
  for (let i = 0; i < 900; i++) {   // slubs: thicker bits of yarn
    const lit = r() < 0.6, a = lit ? 0.18 + r() * 0.22 : 0.04 + r() * 0.05, len = 2 + r() * 5;
    g.fillStyle = lit ? `rgba(255,255,255,${a})` : `rgba(70,80,105,${a})`;
    if (r() < 0.5) g.fillRect(r() * AW, r() * AH, len, 0.5); else g.fillRect(r() * AW, r() * AH, 0.5, len);
  }
}
/** A long soft ridge in the cloth: lit on its top-left flank, a little shadow on the other. */
function ridge(g: C, pts: number[][], w: number, lit = 0.3, dark = 0.1) {
  const path = (dx: number, dy: number) => { g.beginPath(); pts.forEach(([x, y], i) => { if (i) { const [px, py] = pts[i - 1]; g.quadraticCurveTo(px + dx, py + dy, (px + x) / 2 + dx, (py + y) / 2 + dy); } else g.moveTo(x + dx, y + dy); }); const [lx, ly] = pts[pts.length - 1]; g.lineTo(lx + dx, ly + dy); };
  g.lineCap = "round"; g.lineJoin = "round";
  soft(g, w * 1.3, `rgba(255,252,244,${lit})`, () => { g.lineWidth = w * 0.7; path(-w * 0.3, -w * 0.35); g.stroke(); });
  soft(g, w * 1.1, `rgba(40,58,96,${dark})`, () => { g.lineWidth = w * 0.55; path(w * 0.45, w * 0.5); g.stroke(); });
}
/** A pressed fold line from the cloth being folded in the drawer. */
function crease(g: C, horizontal: boolean, at: number, wob: number) {
  const pts: number[][] = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8, w = Math.sin(t * 5.3 + wob) * 1.4; pts.push(horizontal ? [t * AW, at + w] : [at + w, t * AH]); }
  const path = (dx: number, dy: number) => { g.beginPath(); pts.forEach(([x, y], i) => { if (i) g.lineTo(x + dx, y + dy); else g.moveTo(x + dx, y + dy); }); };
  g.lineCap = "round";
  soft(g, 3, "rgba(255,255,255,0.55)", () => { g.lineWidth = 1.6; path(horizontal ? 0 : -0.9, horizontal ? -0.9 : 0); g.stroke(); });
  soft(g, 2.2, "rgba(40,58,96,0.16)", () => { g.lineWidth = 1.1; path(horizontal ? 0 : 1.1, horizontal ? 1.1 : 0); g.stroke(); });
}
function folds(g: C) {
  crease(g, true, AH / 2 + 0.5, 0.4); crease(g, false, AW / 2 - 0.5, 1.7);
  ridge(g, [[-10, 150], [40, 120], [95, 70], [120, -10]], 16, 0.5, 0.15);
  ridge(g, [[AW + 10, 270], [AW - 50, 300], [AW - 95, 360], [AW - 110, AH + 10]], 16, 0.42, 0.15);
  ridge(g, [[60, AH + 10], [80, AH - 60], [40, AH - 120], [-10, AH - 150]], 12, 0.3, 0.1);
  ridge(g, [[AW - 40, -10], [AW - 70, 50], [AW + 10, 110]], 12, 0.3, 0.1);
}
// ── the walnut table round it ──
function rim(g: C) {
  const r = seeded(0x3a1);
  // the rim's shadow on the cloth: deeper along the top and left, where the light comes over the edge
  g.save(); rr(g, RIM, RIM, AW - 2 * RIM, AH - 2 * RIM, CORNER - RIM); g.clip();
  soft(g, 7, "rgba(60,32,8,0.42)", () => { g.lineWidth = 6; rr(g, RIM - 3, RIM - 3, AW - 2 * RIM + 6, AH - 2 * RIM + 6, CORNER - RIM + 3); g.stroke(); }, 2.2, 3);
  soft(g, 1.6, "rgba(50,26,6,0.3)", () => { g.lineWidth = 2; rr(g, RIM - 1, RIM - 1, AW - 2 * RIM + 2, AH - 2 * RIM + 2, CORNER - RIM + 1); g.stroke(); }, 0.5, 0.7);
  g.restore();
  const ring = () => { g.beginPath(); g.roundRect(0, 0, AW, AH, CORNER); g.roundRect(RIM, RIM, AW - 2 * RIM, AH - 2 * RIM, CORNER - RIM); };
  ring(); g.fillStyle = lin(g, 0, 0, AW, AH, [[0, "#a2602f"], [0.5, "#8a4c22"], [1, "#6e3a18"]]); g.fill("evenodd");
  g.save(); ring(); g.clip("evenodd");
  for (let i = 0; i < 16; i++) {   // grain running round the edge
    const d = 0.3 + i * 0.42 + r() * 0.2, dark = r() < 0.72;
    g.strokeStyle = dark ? `rgba(46,18,2,${0.1 + r() * 0.2})` : `rgba(255,212,160,${0.06 + r() * 0.1})`; g.lineWidth = 0.2 + r() * 0.5;
    g.beginPath(); g.roundRect(d, d, AW - 2 * d, AH - 2 * d, Math.max(1, CORNER - d)); g.stroke();
  }
  for (let i = 0; i < 900; i++) {   // open pores, along the grain
    const t = r(), side = Math.floor(r() * 4), dd = 0.6 + r() * (RIM - 1.2), l = 1.2 + r() * 2.6;
    const [px, py, w, h] = side === 0 ? [t * AW, dd, l, 0.32] : side === 1 ? [t * AW, AH - dd, l, 0.32] : side === 2 ? [dd, t * AH, 0.32, l] : [AW - dd, t * AH, 0.32, l];
    g.fillStyle = `rgba(30,12,2,${0.14 + r() * 0.2})`; g.fillRect(px, py, w, h);
  }
  // a rounded edge: each side lit by how it faces the light (outer edge bright top and left, inner edge bright bottom and right)
  const side = (pts: number[][], x0: number, y0: number, x1: number, y1: number, outLit: boolean) => {
    g.save(); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
    g.fillStyle = lin(g, x0, y0, x1, y1, outLit ? [[0, "rgba(255,226,186,0.34)"], [0.45, "rgba(255,226,186,0.04)"], [0.8, "rgba(30,10,0,0.12)"], [1, "rgba(30,10,0,0.42)"]]
      : [[0, "rgba(30,10,0,0.3)"], [0.4, "rgba(30,10,0,0.08)"], [0.75, "rgba(255,226,186,0.1)"], [1, "rgba(255,226,186,0.36)"]]);
    g.fillRect(0, 0, AW, AH); g.restore();
  };
  side([[0, 0], [AW, 0], [AW - RIM, RIM], [RIM, RIM]], 0, 0, 0, RIM, true);
  side([[0, 0], [RIM, RIM], [RIM, AH - RIM], [0, AH]], 0, 0, RIM, 0, true);
  side([[0, AH], [RIM, AH - RIM], [AW - RIM, AH - RIM], [AW, AH]], 0, AH, 0, AH - RIM, false);
  side([[AW, 0], [AW, AH], [AW - RIM, AH - RIM], [AW - RIM, RIM]], AW, 0, AW - RIM, 0, false);
  g.fillStyle = lin(g, 0, 0, AW, AH, [[0, "rgba(255,240,215,0.18)"], [0.25, "rgba(255,240,215,0.02)"], [0.5, "rgba(255,240,215,0.1)"], [0.62, "rgba(255,240,215,0)"]]); g.fillRect(0, 0, AW, AH);   // varnish
  g.restore();
  g.lineWidth = 0.9; g.strokeStyle = lin(g, 0, 0, AW, AH, [[0, "rgba(255,236,204,0.7)"], [0.5, "rgba(255,236,204,0.2)"], [1, "rgba(255,236,204,0.06)"]]); rr(g, 0.9, 0.9, AW - 1.8, AH - 1.8, CORNER - 0.9); g.stroke();
  g.lineWidth = 0.8; g.strokeStyle = lin(g, RIM, RIM, AW - RIM, AH - RIM, [[0, "rgba(34,14,2,0.75)"], [0.6, "rgba(60,30,10,0.4)"], [1, "rgba(255,226,186,0.5)"]]); rr(g, RIM - 0.3, RIM - 0.3, AW - 2 * RIM + 0.6, AH - 2 * RIM + 0.6, CORNER - RIM); g.stroke();
}
function paintTable(g: C) {
  gingham(g); linen(g); folds(g); rim(g);
}
const cloths = new Map<string, HTMLCanvasElement>(), lights = new Map<string, HTMLCanvasElement>();
function cached(m: Map<string, HTMLCanvasElement>, k: number, paint: (g: C) => void) {
  const key = k.toFixed(3); let cv = m.get(key);
  if (!cv) { const L = layer(AW, AH, k); paint(L.c); cv = L.cv; m.clear(); m.set(key, cv); }
  return cv;
}
export function drawFloor(g: C) { g.drawImage(cached(cloths, scaleOf(g), paintTable), 0, 0, AW, AH); }
/** The light over the table, painted over the cover: a warm pool from the top left, a vignette toward the far corner. */
export function drawTableLight(g: C) {
  g.drawImage(cached(lights, scaleOf(g), c => {
    warmLight(c, AW, AH, { pool: 0.2, dark: 0.32, lx: AW * 0.14, ly: AH * 0.08, shadow: "30,24,40" });
    c.fillStyle = lin(c, 0, 0, AW, AH, [[0, "rgba(255,250,236,0.1)"], [0.4, "rgba(255,250,236,0)"]]); c.fillRect(0, 0, AW, AH);
  }), 0, 0, AW, AH);
}

// ── spills ───────────────────────────────────────────────────────────────────
function blob(g: C, z: Zone, wob: number, k = 1, dx = 0, dy = 0) {
  g.beginPath();
  for (let i = 0; i <= 36; i++) {
    const a = (i / 36) * TAU, r = (1 + Math.sin(a * 3 + z.x) * wob + Math.cos(a * 5 + z.y) * wob * 0.6) * k;
    const x = z.x + dx + Math.cos(a) * (z.w / 2) * r, y = z.y + dy + Math.sin(a) * (z.h / 2) * r;
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
}
/** Spills under the lunchboxes (milk, syrup, the sink), and the soil and lower leaves of the herb patch. */
export function drawZone(g: C, z: Zone) {
  const R = Math.max(z.w, z.h) / 2, r = seeded(Math.round(z.x * 7 + z.y * 3));
  if (z.k === 0) {   // spilled milk: a bright sheet with a soft meniscus, the cloth soaked darker round it
    soft(g, 6, "rgba(70,100,150,0.22)", () => { blob(g, z, 0.08, 1.1, 1, 1.5); g.fill(); });
    blob(g, z, 0.08, 1.04, 0.8, 1.2); g.fillStyle = "rgba(120,146,190,0.22)"; g.fill();
    blob(g, z, 0.08); g.fillStyle = "#fdfeff"; g.fill();
    blob(g, z, 0.08); g.fillStyle = rad(g, z.x - z.w * 0.12, z.y - z.h * 0.14, R * 0.1, R * 1.05, [[0, "rgba(255,255,255,0)"], [0.65, "rgba(214,226,242,0.2)"], [1, "rgba(150,174,210,0.55)"]]); g.fill();
    blob(g, z, 0.08); g.strokeStyle = "rgba(134,158,196,0.6)"; g.lineWidth = 0.9; g.stroke();
    blob(g, z, 0.08, 0.93, -0.6, -0.8); g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = 1.3; g.stroke();
    g.fillStyle = "#ffffff"; ell(g, z.x - z.w * 0.18, z.y - z.h * 0.2, z.w * 0.14, z.h * 0.065, -0.3); g.fill();
    g.fillStyle = "rgba(255,255,255,0.8)"; ell(g, z.x - z.w * 0.02, z.y - z.h * 0.27, z.w * 0.05, z.h * 0.03, -0.3); g.fill();
    g.fillStyle = "rgba(190,208,234,0.32)"; ell(g, z.x + z.w * 0.14, z.y + z.h * 0.16, z.w * 0.2, z.h * 0.1, 0.2); g.fill();
    for (let i = 0; i < 5; i++) {   // splashes round it
      const a = r() * TAU, d = 1.1 + r() * 0.14, x = z.x + Math.cos(a) * z.w * 0.5 * d, y = z.y + Math.sin(a) * z.h * 0.5 * d, s = 1.3 + r() * 2.4;
      g.fillStyle = "rgba(110,135,175,0.22)"; ell(g, x + 0.5, y + 0.8, s * 1.1, s * 0.9); g.fill();
      g.fillStyle = "#fdfeff"; ell(g, x, y, s, s * 0.8); g.fill(); g.fillStyle = "#fff"; circ(g, x - s * 0.3, y - s * 0.3, s * 0.32); g.fill();
    }
  } else if (z.k === 1) {   // syrup: clear deep amber you can see the cloth through, thick and dark at its edge, glossy on top
    soft(g, 5, "rgba(120,60,10,0.22)", () => { blob(g, z, 0.1, 1.06, 1, 1.5); g.fill(); });
    blob(g, z, 0.1); g.fillStyle = "rgba(255,206,120,0.55)"; g.fill();
    blob(g, z, 0.1); g.fillStyle = rad(g, z.x - z.w * 0.1, z.y - z.h * 0.1, 2, R, [[0, "rgba(246,150,24,0.5)"], [0.55, "rgba(222,108,10,0.68)"], [0.85, "rgba(160,64,4,0.86)"], [1, "rgba(112,42,2,0.94)"]]); g.fill();
    blob(g, z, 0.1); g.strokeStyle = "rgba(96,44,4,0.65)"; g.lineWidth = 1; g.stroke();
    blob(g, z, 0.1, 0.86, -1, -1.2); g.strokeStyle = "rgba(255,214,140,0.3)"; g.lineWidth = 2.2; g.stroke();
    g.save(); blob(g, z, 0.1); g.clip(); blob(g, z, 0.1, 0.93, 1.4, 1.6); g.strokeStyle = "rgba(255,226,120,0.55)"; g.lineWidth = 1.6; g.stroke();   // a caustic where the light comes out
    g.fillStyle = lin(g, z.x - z.w / 2, z.y - z.h / 2, z.x + z.w / 2, z.y + z.h / 2, [[0, "rgba(255,240,200,0)"], [0.3, "rgba(255,240,200,0.32)"], [0.38, "rgba(255,240,200,0)"], [0.62, "rgba(255,240,200,0.12)"], [0.68, "rgba(255,240,200,0)"]]); g.fillRect(z.x - z.w, z.y - z.h, z.w * 2, z.h * 2);
    g.restore();
    g.fillStyle = "rgba(255,248,224,0.9)"; ell(g, z.x - z.w * 0.2, z.y - z.h * 0.24, z.w * 0.12, z.h * 0.045, -0.35); g.fill();
    g.fillStyle = "rgba(255,248,224,0.55)"; ell(g, z.x + z.w * 0.16, z.y + z.h * 0.18, z.w * 0.06, z.h * 0.025, -0.35); g.fill();
    for (let i = 0; i < 6; i++) { const x = z.x + (r() - 0.5) * z.w * 0.6, y = z.y + (r() - 0.5) * z.h * 0.6, s = 0.6 + r() * 1.2; g.strokeStyle = "rgba(255,226,160,0.55)"; g.lineWidth = 0.5; circ(g, x, y, s); g.stroke(); g.fillStyle = "rgba(255,255,255,0.75)"; circ(g, x - s * 0.3, y - s * 0.35, s * 0.3); g.fill(); }
  } else if (z.k === 2) {   // the sink: a brushed steel basin set in the table, water in it, a chrome drain
    const x0 = z.x - z.w / 2, y0 = z.y - z.h / 2;
    soft(g, 7, "rgba(40,30,20,0.38)", () => { rr(g, x0 - 4, y0 - 4, z.w + 8, z.h + 8, 10); g.fill(); }, 2, 3.5);
    g.fillStyle = lin(g, x0 - 4, y0 - 4, x0 + z.w + 4, y0 + z.h + 4, [[0, "#f6f8fa"], [0.45, "#d3dae1"], [1, "#9aa5b1"]]); rr(g, x0 - 4, y0 - 4, z.w + 8, z.h + 8, 10); g.fill();
    g.save(); rr(g, x0 - 4, y0 - 4, z.w + 8, z.h + 8, 10); g.clip();
    for (let y = y0 - 4; y < y0 + z.h + 4; y += 0.7) { g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "80,90,104"},${0.04 + r() * 0.06})`; g.fillRect(x0 - 4, y, z.w + 8, 0.35); }
    g.restore();
    g.fillStyle = lin(g, x0, y0, x0, y0 + z.h, [[0, "#6f7a86"], [0.3, "#9ba6b2"], [1, "#c4ccd5"]]); rr(g, x0, y0, z.w, z.h, 7); g.fill();
    g.save(); rr(g, x0, y0, z.w, z.h, 7); g.clip();
    g.fillStyle = lin(g, x0, y0, x0 + z.w, y0 + z.h, [[0, "rgba(150,205,240,0.7)"], [1, "rgba(80,150,210,0.75)"]]); g.fillRect(x0, y0, z.w, z.h);
    g.fillStyle = lin(g, 0, y0, 0, y0 + 10, [[0, "rgba(20,30,45,0.45)"], [1, "rgba(20,30,45,0)"]]); g.fillRect(x0, y0, z.w, 10);
    g.fillStyle = lin(g, x0, 0, x0 + 9, 0, [[0, "rgba(20,30,45,0.35)"], [1, "rgba(20,30,45,0)"]]); g.fillRect(x0, y0, 9, z.h);
    g.strokeStyle = "rgba(255,255,255,0.6)"; g.lineWidth = 1;
    for (let k = 0; k < 3; k++) { g.beginPath(); const yy = z.y - z.h / 4 + (k * z.h) / 4; g.moveTo(z.x - z.w / 3, yy); g.quadraticCurveTo(z.x - z.w / 6, yy - 2.5, z.x, yy); g.quadraticCurveTo(z.x + z.w / 6, yy + 2.5, z.x + z.w / 3, yy); g.stroke(); }
    g.fillStyle = "rgba(255,255,255,0.32)"; g.beginPath(); g.moveTo(x0 + z.w * 0.1, y0); g.lineTo(x0 + z.w * 0.24, y0); g.lineTo(x0 + z.w * 0.12, y0 + z.h); g.lineTo(x0 - z.w * 0.02, y0 + z.h); g.closePath(); g.fill();
    g.restore();
    g.strokeStyle = "rgba(40,48,58,0.45)"; g.lineWidth = 0.8; rr(g, x0, y0, z.w, z.h, 7); g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 0.8; rr(g, x0 - 3.4, y0 - 3.4, z.w + 6.8, z.h + 6.8, 9.5); g.stroke();
    const px = z.x + z.w / 2 - 9, py = z.y - z.h / 2 + 9;   // the plug hole
    g.fillStyle = lin(g, px - 4.5, py - 4.5, px + 4.5, py + 4.5, CHROME); circ(g, px, py, 4.5); g.fill();
    g.fillStyle = "#2b323b"; circ(g, px, py, 2.8); g.fill(); g.strokeStyle = "rgba(200,210,220,0.8)"; g.lineWidth = 0.6; line(g, px - 2.4, py, px + 2.4, py); line(g, px, py - 2.4, px, py + 2.4);
  } else if (z.k === 3) {   // the herb patch's floor: a soft green shadow and a bed of darker leaves (the top leaves sway on top)
    soft(g, 6, "rgba(30,60,20,0.3)", () => { blob(g, z, 0.06, 1.04, 1.5, 2.2); g.fill(); });
    blob(g, z, 0.06, 0.96); g.fillStyle = "rgba(52,96,40,0.55)"; g.fill();
    const n = Math.round((z.w * z.h) / 70), k = scaleOf(g);
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.95, x = z.x + Math.cos(a) * (z.w / 2) * d, y = z.y + Math.sin(a) * (z.h / 2) * d;
      const s = leaf(i % 3 === 0 ? 3 : 4, k); g.save(); g.translate(x, y); g.rotate(r() * TAU); stamp(g, s); g.restore();
    }
  }
}
// ── herbs: basil leaves in a few greens, each a little cached picture ──
const LEAF = ["#3f8a3a", "#56a449", "#74bb5c", "#2f6e2e", "#3b7a35"];
function leaf(i: number, k: number) {
  return sprite(`leaf${i}`, k, 14, 9, 7, 4.5, c => {
    const col = LEAF[i];
    const shape = (dx: number, dy: number) => { c.beginPath(); c.moveTo(-6 + dx, dy); c.bezierCurveTo(-3 + dx, -4.4 + dy, 3.5 + dx, -4 + dy, 6.2 + dx, dy); c.bezierCurveTo(3.5 + dx, 4 + dy, -3 + dx, 4.4 + dy, -6 + dx, dy); c.closePath(); };
    shape(0.6, 0.9); c.fillStyle = "rgba(16,40,10,0.32)"; c.fill();
    shape(0, 0); c.fillStyle = lin(c, 0, -4, 0, 4, [[0, mix(col, "#ffffff", 0.18)], [0.55, col], [1, mix(col, "#000000", 0.22)]]); c.fill();
    c.strokeStyle = mix(col, "#000000", 0.3); c.lineWidth = 0.4; c.stroke();
    c.strokeStyle = "rgba(230,255,200,0.45)"; c.lineWidth = 0.55; c.beginPath(); c.moveTo(-5.4, 0); c.quadraticCurveTo(0, -0.6, 5.6, 0); c.stroke();
    c.lineWidth = 0.35; c.strokeStyle = "rgba(230,255,200,0.28)"; for (const t of [-2.8, -0.4, 2]) { c.beginPath(); c.moveTo(t, -0.3); c.lineTo(t + 1.6, -2.4); c.moveTo(t, 0.3); c.lineTo(t + 1.6, 2.3); c.stroke(); }
    c.fillStyle = "rgba(255,255,255,0.28)"; ell(c, -0.5, -1.6, 3.2, 0.8, -0.08); c.fill();
  });
}
/** The herb patch's top leaves, over the lunchboxes hiding in it. Drawn every frame, so each leaf is a cached sprite. */
export function drawHerbs(g: C, z: Zone, t: number) {
  if (z.k !== 3) return;
  const n = Math.round((z.w * z.h) / 80), k = scaleOf(g), m = g.getTransform();
  for (let i = 0; i < n; i++) {
    const a = (i * 2.399) % TAU, d = Math.sqrt((i + 0.5) / n) * 0.9, x = z.x + Math.cos(a) * (z.w / 2) * d, y = z.y + Math.sin(a) * (z.h / 2) * d;
    const s = leaf(i % 3, k), sway = Math.sin(t / 900 + i) * 0.14;
    g.translate(x, y); g.rotate(a + sway); stamp(g, s); g.setTransform(m);
  }
}
