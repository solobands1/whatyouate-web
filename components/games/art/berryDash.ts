// Berry Dash's board art: a long kitchen counter you run along, in three depths that slide at their own speeds. Far
// off, a garden through the windows; then the wall (warm plaster, white windows with café curtains and soft rays of
// light, open oak shelves with jars, glossy tiles with deep grout); then, at running speed, a polished marble counter
// that reflects what stands on it and oak shaker cabinets with brushed steel handles. Painted once into strips that
// tile; per frame it's a few strip stamps, soft shadows and reflections under things, and the light over the top.
import { type C, TAU, rr, circ, ell, line, lin, rad, mix, rgba, mulberry, layerCache, put, planks, sheen, marble, bevel, gloss } from "./paint";

const cache = layerCache();
export const P0 = 600, P1 = 640, P2 = 520;          // how far each strip runs before it repeats
export const S0 = 0.15, S1 = 0.5;                   // the garden and the wall move this fast against the counter
const WIN = { x: 262, y: 74, w: 176, h: 186 };      // the window in each wall strip (glass inside a 10 unit frame)
const CAB = { y0: 50, y1: 196, x0: 466, x1: 236 + P1 };   // the wall cupboards run from x0 round past the strip's end to x1

// ── far: the garden ──
function paintGarden(c: C, w: number, top: number, bottom: number) {
  const rnd = mulberry(606);
  c.fillStyle = lin(c, 0, top, 0, bottom, [[0, "#8fc2ee"], [0.6, "#cfe5f6"], [1, "#f4f1e2"]]); c.fillRect(0, top, w, bottom - top);
  for (const [cx, cy, s] of [[90, 140, 1], [380, 120, 0.8], [520, 168, 0.6]]) {
    for (const dx of [0, w]) {
      for (let i = 0; i < 6; i++) { const t = i / 5, px = cx + dx + (t - 0.5) * 80 * s, py = cy - Math.sin(t * Math.PI) * 12 * s, r = (10 + Math.sin(t * Math.PI) * 10) * s; c.fillStyle = rad(c, px - r * 0.3, py - r * 0.4, 0, r * 1.1, [[0, "#ffffff"], [1, "#d8e6f2"]]); circ(c, px, py, r); c.fill(); }
    }
  }
  const hill = (base: number, amp: number, f: number, col: string) => {
    c.fillStyle = col; c.beginPath(); c.moveTo(0, bottom);
    for (let x = 0; x <= w; x += 4) c.lineTo(x, base - (Math.sin((x / w) * TAU * f) * 0.6 + Math.sin((x / w) * TAU * f * 3 + 1) * 0.4) * amp);
    c.lineTo(w, bottom); c.closePath(); c.fill();
  };
  hill(214, 14, 2, "#b9d3c6");
  hill(232, 10, 3, "#97c086");
  for (let x = 8; x < w; x += 18 + rnd() * 26) {   // trees along the garden's edge
    const s = 0.6 + rnd() * 0.6, y = 238;
    c.fillStyle = "#6a4a2e"; c.fillRect(x - 1.5, y - 10 * s, 3, 10 * s);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU, bx = x + Math.cos(a) * 6 * s, by = y - 18 * s + Math.sin(a) * 5 * s, r = (7 + rnd() * 3) * s; c.fillStyle = rad(c, bx - r * 0.4, by - r * 0.4, 0, r * 1.1, [[0, "#a3d673"], [0.6, "#5f9c45"], [1, "#3c7030"]]); circ(c, bx, by, r); c.fill(); }
  }
  c.fillStyle = "#86b86c"; c.fillRect(0, 240, w, bottom - 240);
  for (let x = 0; x < w; x += 12) { c.fillStyle = "#f4efe4"; c.fillRect(x, 236, 3, 16); }   // a picket fence
  c.fillStyle = "#e6dfd0"; c.fillRect(0, 240, w, 2.5); c.fillRect(0, 247, w, 2.5);
}

// ── middle: the wall ──
function jarOn(c: C, x: number, base: number, w: number, h: number, fill: string, lid: string) {
  c.fillStyle = "rgba(60,40,20,0.3)"; ell(c, x + 3, base + 1, w * 0.6, 2.5); c.fill();
  c.fillStyle = "rgba(225,238,244,0.4)"; rr(c, x - w / 2, base - h, w, h, 4); c.fill();
  c.fillStyle = lin(c, x - w / 2, 0, x + w / 2, 0, [[0, mix(fill, "#ffffff", 0.2)], [1, mix(fill, "#000000", 0.18)]]); rr(c, x - w / 2 + 1.5, base - h * 0.7, w - 3, h * 0.7 - 1.5, 3); c.fill();
  c.fillStyle = lin(c, x - w / 2, 0, x + w / 2, 0, [[0, mix(lid, "#ffffff", 0.35)], [0.5, lid], [1, mix(lid, "#000000", 0.3)]]); rr(c, x - w / 2 - 1, base - h - 5, w + 2, 6, 2); c.fill();
  c.fillStyle = "rgba(255,255,255,0.65)"; rr(c, x - w / 2 + 3, base - h + 3, 2.2, h - 7, 1.1); c.fill();
  c.strokeStyle = "rgba(110,130,140,0.45)"; c.lineWidth = 0.7; rr(c, x - w / 2, base - h, w, h, 4); c.stroke();
}
function paintWall(c: C, GY: number, HUD: number) {
  const rnd = mulberry(1414), w = P1;
  // glossy cream subway tiles all the way up, deep grout, a soft sheen on each
  c.fillStyle = "#bfb39e"; c.fillRect(0, HUD, w, GY + 4 - HUD);
  const th = 20, tw = 40;
  for (let y = HUD - 6, j = 0; y < GY + 4; y += th, j++) for (let x = (j % 2 ? -tw / 2 : 0); x < w; x += tw) {
    const v = (rnd() - 0.5) * 0.08, base = mix("#f8f1e4", v > 0 ? "#ffffff" : "#ddd0b8", Math.abs(v) * 4);
    c.fillStyle = "#a99d87"; rr(c, x + 0.9, y + 0.9, tw - 1.4, th - 1.4, 2.6); c.fill();
    c.fillStyle = lin(c, 0, y, 0, y + th, [[0, mix(base, "#ffffff", 0.6)], [0.55, base], [1, mix(base, "#000000", 0.07)]]); rr(c, x + 1.3, y + 1.3, tw - 2.6, th - 2.6, 2.3); c.fill();
    c.fillStyle = "rgba(255,255,255,0.75)"; rr(c, x + 3.5, y + 2.4, tw - 9, 1.8, 0.9); c.fill();
    c.fillStyle = "rgba(110,90,60,0.16)"; c.fillRect(x + 3, y + th - 2.6, tw - 6, 0.8);
  }
  // the wall cupboards: painted sage shaker doors under a crown moulding, a light rail with a warm strip light under it
  const doors = (x0: number, x1: number) => {
    const { y0, y1 } = CAB, n = Math.round((x1 - x0) / 108), dw = (x1 - x0) / n;
    c.fillStyle = "rgba(60,50,30,0.3)"; c.fillRect(x0 + 4, y0, x1 - x0, y1 - y0 + 12);
    c.fillStyle = "#6f806e"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * dw + 1.5, ww = dw - 3, y = y0 + 2, h = y1 - y0 - 4;
      c.fillStyle = lin(c, x, y, x + ww, y + h, [[0, "#c1d0bd"], [1, "#93a691"]]); rr(c, x, y, ww, h, 2.5); c.fill();
      c.fillStyle = lin(c, x, y, x + ww, y + h, [[0, "#97aa95"], [1, "#b6c6b2"]]); rr(c, x + 11, y + 12, ww - 22, h - 24, 2); c.fill();
      c.strokeStyle = "rgba(40,55,40,0.35)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + 11.5, y + h - 12); c.lineTo(x + 11.5, y + 12.5); c.lineTo(x + ww - 11, y + 12.5); c.stroke();
      c.strokeStyle = "rgba(255,255,255,0.45)"; c.beginPath(); c.moveTo(x + ww - 11.5, y + 13); c.lineTo(x + ww - 11.5, y + h - 12); c.lineTo(x + 12, y + h - 11.5); c.stroke();
      c.strokeStyle = "rgba(255,255,255,0.5)"; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 0.8, y + h); c.lineTo(x + 0.8, y + 0.8); c.lineTo(x + ww, y + 0.8); c.stroke();
      const hx = i % 2 ? x + 14 : x + ww - 14;   // a brushed steel knob near the bottom inside corner
      c.fillStyle = "rgba(30,40,30,0.35)"; circ(c, hx + 1, y + h - 14, 4); c.fill();
      c.fillStyle = rad(c, hx - 1.2, y + h - 16.5, 0.5, 4.2, [[0, "#ffffff"], [0.5, "#c3cbd4"], [1, "#6c7682"]]); circ(c, hx, y + h - 15.5, 3.6); c.fill();
    }
    c.fillStyle = lin(c, 0, y0 - 8, 0, y0 + 2, [[0, "#e0e8dc"], [0.5, "#a8b9a5"], [1, "#6f806e"]]); c.fillRect(x0 - 4, y0 - 8, x1 - x0 + 8, 10);   // crown
    c.fillStyle = "rgba(255,255,255,0.6)"; c.fillRect(x0 - 4, y0 - 8, x1 - x0 + 8, 1.2);
    c.fillStyle = lin(c, 0, y1, 0, y1 + 6, [[0, "#a8b9a5"], [1, "#647563"]]); c.fillRect(x0 - 2, y1, x1 - x0 + 4, 6);   // light rail
    c.fillStyle = "rgba(255,246,220,0.95)"; c.fillRect(x0 + 6, y1 + 5, x1 - x0 - 12, 1.4);
    c.save(); c.globalCompositeOperation = "lighter";   // the strip light's warm wash down the tiles
    c.fillStyle = lin(c, 0, y1 + 6, 0, y1 + 110, [[0, "rgba(255,214,150,0.28)"], [0.35, "rgba(255,214,150,0.08)"], [1, "rgba(255,214,150,0)"]]); c.fillRect(x0 - 10, y1 + 6, x1 - x0 + 20, 104);
    c.restore();
  };
  doors(CAB.x0, CAB.x1); c.save(); c.translate(-w, 0); doors(CAB.x0, CAB.x1); c.restore();   // one run, wrapping round the strip's seam
  // the window: frame, glass cut out, bars, a café curtain, a sill
  const { x, y, w: ww, h } = WIN, F = 10;
  c.fillStyle = "rgba(90,70,40,0.28)"; rr(c, x + 4, y + 6, ww, h + 14, 4); c.fill();
  c.fillStyle = lin(c, x, y, x + ww, y + h, [[0, "#ffffff"], [0.6, "#f2eee5"], [1, "#dcd4c4"]]); rr(c, x, y, ww, h, 4); c.fill();
  c.clearRect(x + F, y + F, ww - 2 * F, h - 2 * F);
  c.fillStyle = "rgba(255,255,255,0.08)"; c.fillRect(x + F, y + F, ww - 2 * F, h - 2 * F);
  c.save(); c.beginPath(); c.rect(x + F, y + F, ww - 2 * F, h - 2 * F); c.clip();
  for (const [o, wd, a] of [[0.1, 0.12, 0.18], [0.3, 0.05, 0.1], [0.66, 0.14, 0.12]]) { const ax = x + F + (ww - 2 * F) * o; c.fillStyle = lin(c, ax, 0, ax + ww * wd, 0, [[0, "rgba(255,255,255,0)"], [0.5, `rgba(255,255,255,${a})`], [1, "rgba(255,255,255,0)"]]); c.beginPath(); c.moveTo(ax, y); c.lineTo(ax + ww * wd, y); c.lineTo(ax + ww * wd - 70, y + h); c.lineTo(ax - 70, y + h); c.closePath(); c.fill(); }
  c.fillStyle = "rgba(60,60,50,0.2)"; c.fillRect(x + F, y + F, ww - 2 * F, 3); c.fillRect(x + F, y + F, 3, h - 2 * F);
  c.restore();
  for (const [bx, by, bw, bh] of [[x + ww / 2 - 3, y + F, 6, h - 2 * F], [x + F, y + h * 0.42 - 3, ww - 2 * F, 6]]) {
    c.fillStyle = "rgba(40,40,30,0.18)"; c.fillRect(bx + 1.5, by + 2, bw, bh);
    c.fillStyle = bw < bh ? lin(c, bx, 0, bx + bw, 0, [[0, "#ffffff"], [1, "#d6cfc0"]]) : lin(c, 0, by, 0, by + bh, [[0, "#ffffff"], [1, "#d6cfc0"]]); c.fillRect(bx, by, bw, bh);
  }
  const cy = y + h * 0.6;   // café curtain on a thin brass rod
  c.save(); c.beginPath(); c.rect(x + 5, cy, ww - 10, h - (cy - y) - 6); c.clip();
  c.fillStyle = "#f3ece0"; c.fillRect(x, cy, ww, h);
  for (let i = 0; i < 12; i++) { const fx = x + 5 + i * ((ww - 10) / 12); c.fillStyle = lin(c, fx, 0, fx + (ww - 10) / 12, 0, [[0, "rgba(255,255,255,0.4)"], [0.5, "rgba(255,255,255,0)"], [1, "rgba(120,95,60,0.18)"]]); c.fillRect(fx, cy, (ww - 10) / 12, h); }
  for (let yy = cy; yy < y + h; yy += 2) { c.fillStyle = "rgba(120,95,60,0.05)"; c.fillRect(x, yy, ww, 0.8); }
  c.fillStyle = "rgba(200,90,80,0.55)"; c.fillRect(x, y + h - 24, ww, 2); c.fillRect(x, y + h - 20, ww, 1);   // a red stripe near the hem
  c.restore();
  c.fillStyle = "rgba(60,40,20,0.3)"; c.fillRect(x + 6, cy + 1.5, ww - 12, 2);
  c.fillStyle = lin(c, 0, cy - 2, 0, cy + 2, [[0, "#f6dd9a"], [1, "#9a7424"]]); rr(c, x + 3, cy - 2, ww - 6, 3.5, 1.7); c.fill();
  c.fillStyle = "rgba(90,70,40,0.3)"; c.fillRect(x - 6, y + h + 8, ww + 12, 6);
  c.fillStyle = lin(c, 0, y + h - 2, 0, y + h + 9, [[0, "#ffffff"], [0.5, "#efeae0"], [1, "#cfc6b4"]]); rr(c, x - 8, y + h - 2, ww + 16, 10, 2); c.fill();
  c.fillStyle = "rgba(255,255,255,0.95)"; c.fillRect(x - 8, y + h - 2, ww + 16, 1.2);
  jarOn(c, x + 22, y + h - 2, 14, 18, "#e9c88a", "#c9a24a");
  // soft rays of daylight falling from the window down and to the right
  c.save(); c.globalCompositeOperation = "lighter";
  for (const [o, wd, a] of [[0.12, 30, 0.07], [0.42, 44, 0.08], [0.72, 26, 0.06]]) {
    const sx = x + F + (ww - 2 * F) * o, y0 = y + h * 0.3, len = GY - y0 + 10;
    c.fillStyle = lin(c, 0, y0, 0, y0 + len, [[0, `rgba(255,238,196,${a})`], [0.7, `rgba(255,238,196,${a * 0.5})`], [1, "rgba(255,238,196,0)"]]);
    c.beginPath(); c.moveTo(sx, y0); c.lineTo(sx + wd, y0); c.lineTo(sx + wd + len * 0.5 + 16, y0 + len); c.lineTo(sx + len * 0.5, y0 + len); c.closePath(); c.fill();
  }
  c.restore();
  c.fillStyle = lin(c, 0, GY - 30, 0, GY + 4, [[0, "rgba(60,40,20,0)"], [1, "rgba(60,40,20,0.3)"]]); c.fillRect(0, GY - 30, w, 34);   // the counter's shadow on the tiles
}

// ── near: the counter and cabinets ──
/** Paints something w wide that repeats without a seam: painted a little past w, and the bit past the end is faded in
 *  over the start, so where one copy ends the next carries on with the same stone. */
function seamless(c: C, x0: number, y0: number, w: number, h: number, paint: (c: C) => void) {
  const k = c.getTransform().a || 1, X = 60;
  const mk = (cw: number) => { const cv = document.createElement("canvas"); cv.width = Math.ceil(cw * k); cv.height = Math.ceil(h * k); const cc = cv.getContext("2d")!; cc.scale(k, k); return { cv, cc }; };
  const A = mk(w + X); A.cc.translate(-x0, -y0); paint(A.cc);
  const B = mk(X); B.cc.drawImage(A.cv, -w, 0, w + X, h);
  B.cc.globalCompositeOperation = "destination-in"; B.cc.fillStyle = lin(B.cc, 0, 0, X, 0, [[0, "rgba(0,0,0,1)"], [1, "rgba(0,0,0,0)"]]); B.cc.fillRect(0, 0, X, h);
  c.drawImage(A.cv, 0, 0, w * k, h * k, x0, y0, w, h);
  c.drawImage(B.cv, x0, y0, X, h);
}
function paintCounter(c: C, GY: number, H: number) {
  const rnd = mulberry(2626), w = P2, top0 = GY - 12, front = GY + 12, edge = GY + 24;
  // the marble top, receding, polished
  seamless(c, 0, top0, w, front - top0, cc => marble(cc, 0, top0, w + 60, front, rnd, 4));
  c.fillStyle = lin(c, 0, top0, 0, front, [[0, "rgba(120,110,100,0.18)"], [0.4, "rgba(255,255,255,0)"], [1, "rgba(255,255,255,0.15)"]]); c.fillRect(0, top0, w, front - top0);
  c.fillStyle = "rgba(90,80,70,0.25)"; c.fillRect(0, top0, w, 1);
  // its front edge: a rounded nose with a bright line where it catches the light
  c.fillStyle = lin(c, 0, front, 0, edge, [[0, "#ffffff"], [0.25, "#f1ece5"], [0.7, "#d8d0c6"], [1, "#b4aa9e"]]); c.fillRect(0, front, w, edge - front);
  c.save(); c.globalAlpha = 0.55; seamless(c, 0, front, w, edge - front, cc => marble(cc, 0, front - 40, w + 60, edge + 40, mulberry(77), 3)); c.restore();
  c.fillStyle = "rgba(255,255,255,0.95)"; c.fillRect(0, front + 0.5, w, 1.2);
  c.fillStyle = "rgba(80,70,60,0.35)"; c.fillRect(0, edge - 1, w, 1);
  // the cabinets: oak shaker doors, a recessed panel, a brushed steel bar handle each
  const OAK = ["#c08a55", "#b47e4a", "#c9935d", "#ad7743"];
  c.fillStyle = "#4a2e16"; c.fillRect(0, edge, w, H - edge + 2);
  c.fillStyle = lin(c, 0, edge, 0, edge + 14, [[0, "rgba(20,10,0,0.55)"], [1, "rgba(20,10,0,0)"]]);
  const dw = 130;
  for (let i = 0; i < w / dw; i++) {
    const x = i * dw + 2, y = edge + 3, ww = dw - 4, h = H - y + 10;
    c.save(); rr(c, x, y, ww, h, 3); c.clip();
    c.save(); c.translate(x, y + h); c.rotate(-Math.PI / 2); planks(c, 0, 0, h, ww, rnd, OAK, "70,36,8", [ww / 4, 6], false); c.restore();
    c.fillStyle = lin(c, x, y, x + ww, y + h, [[0, "rgba(255,236,200,0.18)"], [1, "rgba(40,20,4,0.22)"]]); c.fillRect(x, y, ww, h);
    const px0 = x + 13, py0 = y + 16, pw = ww - 26, ph = h - 26;   // the recessed panel
    c.fillStyle = "rgba(40,20,4,0.22)"; rr(c, px0, py0, pw, ph, 2); c.fill();
    c.save(); rr(c, px0 + 2, py0 + 2, pw - 4, ph - 4, 2); c.clip(); planks(c, px0, py0, px0 + pw, py0 + ph, rnd, OAK, "70,36,8", [ph, 0.01], false); c.fillStyle = "rgba(40,20,4,0.08)"; c.fillRect(px0, py0, pw, ph); c.restore();
    c.strokeStyle = "rgba(30,14,2,0.4)"; c.lineWidth = 1.3; c.beginPath(); c.moveTo(px0 + 0.6, py0 + ph); c.lineTo(px0 + 0.6, py0 + 0.6); c.lineTo(px0 + pw, py0 + 0.6); c.stroke();
    c.strokeStyle = "rgba(255,236,200,0.45)"; c.beginPath(); c.moveTo(px0 + pw - 0.6, py0 + 1); c.lineTo(px0 + pw - 0.6, py0 + ph); c.stroke();
    c.restore();
    bevel(c, x, y, ww, h, 3, 0.8);
    const hx = x + ww / 2, hy = y + 8;   // the handle
    c.fillStyle = "rgba(20,10,0,0.4)"; rr(c, hx - 24 + 1.2, hy + 2, 48, 5, 2.5); c.fill();
    c.fillStyle = lin(c, 0, hy - 2, 0, hy + 4, [[0, "#ffffff"], [0.35, "#d5dbe2"], [0.65, "#97a1ac"], [1, "#5d6772"]]); rr(c, hx - 24, hy - 1.5, 48, 5, 2.5); c.fill();
    for (let s = 0; s < 6; s++) { c.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.15})`; c.fillRect(hx - 22, hy - 0.8 + s * 0.7, 44, 0.3); }
    for (const ex of [hx - 21, hx + 21]) { c.fillStyle = "#6c7682"; rr(c, ex - 2, hy - 3, 4, 8, 1.5); c.fill(); }
  }
  c.fillStyle = lin(c, 0, edge, 0, edge + 14, [[0, "rgba(20,10,0,0.55)"], [1, "rgba(20,10,0,0)"]]); c.fillRect(0, edge, w, 14);   // shade under the counter's nose
}
function paintLight(c: C, W: number, H: number, HUD: number) {
  c.fillStyle = rad(c, W * 0.15, HUD + 30, 10, H * 0.9, [[0, "rgba(255,228,176,0.18)"], [0.45, "rgba(255,228,176,0.05)"], [1, "rgba(255,228,176,0)"]]); c.fillRect(0, HUD, W, H - HUD);
  c.fillStyle = rad(c, W * 0.5 + 20, H * 0.48, H * 0.34, H * 0.86, [[0, "rgba(40,20,0,0)"], [1, "rgba(40,20,0,0.42)"]]); c.fillRect(0, HUD, W, H - HUD);
}

/** Lays a strip end to end across the board; each copy overlaps the next by a hair so no seam shows between them. */
const strip = (c: C, L: ReturnType<typeof cache.get>, off: number, period: number, y: number, W: number) => {
  for (let x = -off; x < W; x += period) c.drawImage(L.cv, 0, 0, L.cv.width, L.cv.height, x, y, L.w + 0.75, L.h);
};
/** The kitchen at distance d along the counter: garden, wall, counter, each sliding at its own speed. */
export function drawKitchen(c: C, W: number, H: number, HUD: number, GY: number, d: number) {
  const gTop = WIN.y - 4, gBot = WIN.y + WIN.h + 4;
  strip(c, cache.get(c, "garden", P0, gBot - gTop, cc => { cc.translate(0, -gTop); paintGarden(cc, P0, gTop, gBot); }, 0.5), (d * S0) % P0, P0, gTop, W);
  strip(c, cache.get(c, "wall", P1, GY + 4 - HUD, cc => { cc.translate(0, -HUD); paintWall(cc, GY, HUD); }), (d * S1) % P1, P1, HUD, W);
  strip(c, cache.get(c, "counter", P2, H - (GY - 12), cc => { cc.translate(0, -(GY - 12)); paintCounter(cc, GY, H); }), d % P2, P2, GY - 12, W);
}
/** The light over the scene: warm from the top left, softly dark at the edges. Doesn't slide. */
export function drawLight(c: C, W: number, H: number, HUD: number) { put(c, cache.get(c, "light", W, H, cc => paintLight(cc, W, H, HUD), 0.3)); }

/** A soft shadow on the counter under something, smaller and fainter the higher it is. */
export function counterShadow(c: C, x: number, GY: number, hw: number, height: number) {
  const k = Math.max(0.15, 1 - height / 160), rx = hw * (0.7 + 0.5 * k), ry = 3.6 * (0.6 + 0.4 * k);
  c.fillStyle = rad(c, x + 3, GY + 3, 0, rx, [[0, `rgba(40,25,10,${0.38 * k})`], [0.6, `rgba(40,25,10,${0.2 * k})`], [1, "rgba(40,25,10,0)"]]);
  ell(c, x + 3, GY + 3, rx, ry); c.fill();
}
/** The marble's reflection of something standing on it: upside down, faint, fading toward you. */
export function reflect(c: C, img: HTMLImageElement, x: number, base: number, size: number, GY: number, a = 0.2, sx = 1, sy = 1) {
  if (!img.complete || !img.naturalWidth) return;
  c.save(); c.beginPath(); c.rect(x - size, base, size * 2, GY + 12 - base); c.clip();
  c.globalAlpha = a; c.translate(x, base); c.scale(sx, -sy); c.drawImage(img, -size / 2, -size, size, size);
  c.restore();
}

// ── the top strip ──
function paintPanel(c: C, W: number, HUD: number) {
  c.fillStyle = lin(c, 0, 0, 0, HUD, [[0, "rgba(255,255,255,0.97)"], [1, "rgba(244,247,252,0.95)"]]); c.fillRect(0, 0, W, HUD);
  c.fillStyle = lin(c, 0, 0, W, HUD, [[0, "rgba(255,240,215,0.25)"], [0.4, "rgba(255,255,255,0)"]]); c.fillRect(0, 0, W, HUD);
  c.fillStyle = "rgba(14,31,69,0.14)"; c.fillRect(0, HUD - 1, W, 1);
  c.fillStyle = lin(c, 0, HUD, 0, HUD + 8, [[0, "rgba(14,31,69,0.16)"], [1, "rgba(14,31,69,0)"]]); c.fillRect(0, HUD, W, 8);
}
export function drawPanel(c: C, W: number, HUD: number) { put(c, cache.get(c, "panel", W, HUD + 8, cc => paintPanel(cc, W, HUD))); }
/** A heart: glossy red when you have it, a soft hollow when it's gone. */
export function drawHeart(c: C, x: number, y: number, s: number, full: boolean) {
  c.beginPath(); c.moveTo(x, y + s * 0.3);
  c.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  c.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  c.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  c.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  if (full) {
    c.fillStyle = lin(c, x - s / 2, y, x + s / 2, y + s, [[0, "#ff8a92"], [0.5, "#e8505b"], [1, "#b8323d"]]); c.fill();
    c.strokeStyle = "rgba(120,20,30,0.45)"; c.lineWidth = 0.8; c.stroke();
    c.fillStyle = "rgba(255,255,255,0.75)"; ell(c, x - s * 0.24, y + s * 0.24, s * 0.1, s * 0.06, -0.6); c.fill();
  } else { c.fillStyle = "rgba(16,27,46,0.1)"; c.fill(); c.strokeStyle = "rgba(16,27,46,0.18)"; c.lineWidth = 1; c.stroke(); }
}
/** The sugar rush or heavy legs timer: a recessed track with a glossy fill. */
export function drawTimer(c: C, x: number, y: number, w: number, left: number, col: string) {
  c.fillStyle = "rgba(16,27,46,0.12)"; rr(c, x, y, w, 8, 4); c.fill();
  c.fillStyle = "rgba(16,27,46,0.1)"; rr(c, x, y, w, 2, 1); c.fill();
  const fw = Math.max(8, w * left);
  c.fillStyle = col; rr(c, x, y, fw, 8, 4); c.fill();
  c.fillStyle = "rgba(255,255,255,0.4)"; rr(c, x + 2, y + 1, fw - 4, 2.4, 1.2); c.fill();
}
/** Candy's sugary glow. */
export function candyGlow(c: C, x: number, y: number, r: number, t: number) {
  const p = 0.85 + 0.15 * Math.sin(t / 160);
  c.fillStyle = rad(c, x, y, 0, r * p, [[0, "rgba(200,110,230,0.32)"], [0.6, "rgba(181,75,209,0.14)"], [1, "rgba(181,75,209,0)"]]); circ(c, x, y, r * p); c.fill();
}
/** Words on the board with a soft halo so they read over the wall and the tiles. */
export function haloText(c: C, text: string, x: number, y: number, fill: string) {
  c.lineJoin = "round"; c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 4; c.strokeText(text, x, y);
  c.fillStyle = fill; c.fillText(text, x, y);
}
export { sheen, gloss, line, rgba };
