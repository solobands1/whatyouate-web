// Beat The Crash's board art: a kitchen with a big window, from 7am to 10pm. Through the glass the sky goes from a peach
// sunrise to bright day, a golden evening and a starry night, with the sun (then the moon) crossing it; the room around
// it (sage plaster, linen curtains, a white painted window with a herb pot on the sill, subway tiles, a walnut table) is
// lit warm in the morning and evening and by a lamp at night. Foods fall on glazed saucers with soft shadows, the face
// sits on the table, and the top strip is a frosted panel with a glossy energy track and a little sun and moon track.
// Painted once: the room, seven skies (blended between), the panel, the saucers. Per frame: a few stamps and fills.
import { type C, type Rnd, TAU, rr, circ, ell, line, lin, rad, mix, lighter, darker, rgba, mulberry, layerCache, put, putAt, planks, sheen, weave, plaster, gloss, boardScale } from "./paint";

const cache = layerCache();
// the window: its glass, and the painted casing round it
const GX0 = 48, GX1 = 352, GY0 = 98, GY1 = 366, CX0 = 34, CX1 = 366, CY0 = 84, CY1 = 374;
const SILL = 374, TILE0 = 394, TABLE = 452;

type Sky = { h: number; top: string; mid: string; bot: string; cloud: [string, string]; land: [string, string]; stars: number; lit: number };
const SKIES: Sky[] = [
  { h: 7, top: "#f2b9a0", mid: "#fbd2b4", bot: "#fff0da", cloud: ["#fff0e2", "#e3aea2"], land: ["#a3b2ab", "#7f968f"], stars: 0, lit: 0.2 },
  { h: 9.5, top: "#86bbec", mid: "#b9d9f5", bot: "#eaf3fa", cloud: ["#ffffff", "#c6d7ea"], land: ["#93b68c", "#6b9a6b"], stars: 0, lit: 0 },
  { h: 13, top: "#5b9fe4", mid: "#9cc8f1", bot: "#d9ebf8", cloud: ["#ffffff", "#c1d4ea"], land: ["#88b47d", "#5e925e"], stars: 0, lit: 0 },
  { h: 16, top: "#73a9e2", mid: "#b2cfec", bot: "#f2e4d2", cloud: ["#fff8ee", "#d3cbd3"], land: ["#8eac7a", "#678e5c"], stars: 0, lit: 0 },
  { h: 18.5, top: "#6a7fc0", mid: "#e6a49e", bot: "#ffcf94", cloud: ["#ffd6b2", "#c4868a"], land: ["#7b7883", "#5a5867"], stars: 0, lit: 0.3 },
  { h: 20, top: "#38498a", mid: "#76659c", bot: "#d4948a", cloud: ["#ad93b2", "#655884"], land: ["#4a4b66", "#373951"], stars: 0.45, lit: 0.8 },
  { h: 22, top: "#121a3a", mid: "#212c58", bot: "#384473", cloud: ["#465281", "#283157"], land: ["#1c223d", "#141830"], stars: 1, lit: 1 },
];

// ── the view through the window ──
function paintSky(c: C, k: Sky) {
  const rnd = mulberry(5150);
  c.fillStyle = lin(c, 0, GY0, 0, GY1, [[0, k.top], [0.55, k.mid], [1, k.bot]]); c.fillRect(GX0 - 4, GY0 - 4, GX1 - GX0 + 8, GY1 - GY0 + 8);
  for (let i = 0; i < 90 * k.stars; i++) {   // stars
    const x = GX0 + rnd() * (GX1 - GX0), y = GY0 + rnd() * (GY1 - GY0) * 0.7, r = 0.4 + rnd() * rnd() * 1.3;
    c.fillStyle = `rgba(255,250,235,${(0.35 + rnd() * 0.6) * k.stars})`; circ(c, x, y, r); c.fill();
    if (r > 1.2) { c.fillStyle = `rgba(255,250,235,${0.15 * k.stars})`; circ(c, x, y, r * 3); c.fill(); }
  }
  const rc = mulberry(733);
  for (const [cx, cy, s] of [[110, 150, 1], [270, 118, 0.7], [210, 222, 0.55], [320, 260, 0.45]]) {   // clouds, the same in every sky so they blend
    const n = 7; const puffs: number[][] = [];
    for (let i = 0; i < n; i++) { const t = i / (n - 1); puffs.push([cx + (t - 0.5) * 110 * s, cy - Math.sin(t * Math.PI) * 16 * s - rc() * 6 * s, (12 + Math.sin(t * Math.PI) * 14 + rc() * 5) * s]); }
    for (const [px, py, r] of puffs) { c.fillStyle = rgba(k.cloud[1], 0.45); circ(c, px + 2 * s, py + 4 * s, r); c.fill(); }
    for (const [px, py, r] of puffs) { c.fillStyle = rad(c, px - r * 0.35, py - r * 0.45, r * 0.1, r * 1.1, [[0, k.cloud[0]], [0.65, mix(k.cloud[0], k.cloud[1], 0.3)], [1, k.cloud[1]]]); circ(c, px, py, r); c.fill(); }
  }
  // far hills, a line of trees and two houses, their windows lit as it gets dark
  const [l0, l1] = k.land;
  c.fillStyle = mix(l0, k.bot, 0.45); c.beginPath(); c.moveTo(GX0 - 4, GY1 + 4); for (let x = GX0 - 4; x <= GX1 + 4; x += 4) c.lineTo(x, 318 - Math.sin(x / 47) * 8 - Math.sin(x / 19) * 3); c.lineTo(GX1 + 4, GY1 + 4); c.closePath(); c.fill();
  const rt = mulberry(91);
  for (let x = GX0 - 6; x < GX1 + 6; x += 6 + rt() * 7) { const r = 6 + rt() * 7, y = 338 - rt() * 6; c.fillStyle = rad(c, x - r * 0.3, y - r * 0.4, 0, r * 1.2, [[0, mix(l0, "#ffffff", 0.12)], [1, l1]]); circ(c, x, y, r); c.fill(); }
  for (const [hx, hw, hh] of [[96, 46, 26], [262, 54, 30]]) {
    const hy = 344, day = 1 - k.stars, wall = mix(mix(l1, "#efe2cc", 0.55 * day), k.bot, 0.15), roof = mix(l1, "#9a5040", 0.55 * day + 0.1);
    c.fillStyle = wall; c.fillRect(hx, hy - hh, hw, hh + 30);
    c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(hx + hw * 0.62, hy - hh, hw * 0.38, hh + 30);
    c.fillStyle = mix(roof, "#000000", 0.25); c.fillRect(hx + hw * 0.7, hy - hh - 20, 6, 14);   // chimney
    c.fillStyle = roof; c.beginPath(); c.moveTo(hx - 5, hy - hh); c.lineTo(hx + hw / 2, hy - hh - 18); c.lineTo(hx + hw + 5, hy - hh); c.closePath(); c.fill();
    c.fillStyle = mix(roof, "#ffffff", 0.2); c.beginPath(); c.moveTo(hx - 5, hy - hh); c.lineTo(hx + hw / 2, hy - hh - 18); c.lineTo(hx + hw / 2, hy - hh); c.closePath(); c.fill();
    c.fillStyle = mix(roof, "#000000", 0.3); c.fillRect(hx - 5, hy - hh, hw + 10, 1.5);
    for (const [wx, wy] of [[hx + 7, hy - hh + 7], [hx + hw - 17, hy - hh + 7]]) {
      const glass = mix(mix(l1, "#c9d6e2", 0.5), "#ffd27a", k.lit);
      c.fillStyle = mix(wall, "#ffffff", 0.4); c.fillRect(wx - 1, wy - 1, 12, 11);
      c.fillStyle = glass; c.fillRect(wx, wy, 10, 9);
      c.fillStyle = mix(wall, "#ffffff", 0.4); c.fillRect(wx + 4.5, wy, 1, 9); c.fillRect(wx, wy + 4, 10, 1);
      if (k.lit > 0.4) { c.fillStyle = `rgba(255,200,110,${0.22 * k.lit})`; circ(c, wx + 5, wy + 4.5, 13); c.fill(); }
    }
  }
  c.fillStyle = l1; c.beginPath(); c.moveTo(GX0 - 4, GY1 + 4); for (let x = GX0 - 4; x <= GX1 + 4; x += 4) c.lineTo(x, 352 - Math.sin(x / 31 + 1) * 3); c.lineTo(GX1 + 4, GY1 + 4); c.closePath(); c.fill();
}
const skyAt = (i: number, c: C) => cache.get(c, `sky${i}`, GX1 - GX0 + 8, GY1 - GY0 + 8, cc => { cc.translate(-(GX0 - 4), -(GY0 - 4)); paintSky(cc, SKIES[i]); }, 0.5);

/** How the light is at hour h: 0 to 1 for night, warmth, and how much sun gets in. */
export function lightAt(h: number) {
  const night = Math.max(0, Math.min(1, (h - 19.3) / 1.7));
  const warm = Math.max(0, 1 - Math.abs(h - 7) / 1.8) * 0.7 + Math.max(0, 1 - Math.abs(h - 18.6) / 1.6);
  const sun = Math.max(0, Math.min(1, (h - 6.8) / 0.8, (19.8 - h) / 1.2));
  return { night, warm: Math.min(1, warm), sun };
}

function sunGlow(c: C) {
  c.fillStyle = rad(c, 60, 60, 0, 60, [[0, "rgba(255,248,220,0.95)"], [0.18, "rgba(255,236,180,0.7)"], [0.4, "rgba(255,220,150,0.22)"], [1, "rgba(255,210,140,0)"]]); circ(c, 60, 60, 60); c.fill();
  c.fillStyle = rad(c, 56, 56, 0, 14, [[0, "#fffef8"], [0.7, "#fff4cc"], [1, "#ffe7a3"]]); circ(c, 60, 60, 13); c.fill();
}
function moon(c: C) {
  c.fillStyle = rad(c, 40, 40, 0, 40, [[0, "rgba(230,236,255,0.35)"], [1, "rgba(230,236,255,0)"]]); circ(c, 40, 40, 40); c.fill();
  c.fillStyle = rad(c, 36, 36, 0, 13, [[0, "#fffdf2"], [1, "#e6e2cf"]]); circ(c, 40, 40, 12); c.fill();
  c.fillStyle = "rgba(170,165,145,0.35)"; for (const [x, y, r] of [[36, 37, 2.6], [44, 44, 1.8], [42, 34, 1.2]]) { circ(c, x, y, r); c.fill(); }
}

/** The sky through the window at hour h (blended between the two nearest painted skies), and the sun or moon. */
export function drawView(c: C, h: number) {
  let i = 0; while (i < SKIES.length - 2 && h >= SKIES[i + 1].h) i++;
  const a = SKIES[i], b = SKIES[i + 1], t = Math.max(0, Math.min(1, (h - a.h) / (b.h - a.h)));
  const x = GX0 - 4, y = GY0 - 4;
  put(c, skyAt(i, c), x, y);
  if (t > 0.002) { c.globalAlpha = t; put(c, skyAt(i + 1, c), x, y); c.globalAlpha = 1; }
  c.save(); c.beginPath(); c.rect(GX0, GY0, GX1 - GX0, 318 - GY0 - 4); c.clip();
  const L = lightAt(h);
  if (L.sun > 0) {   // the sun crosses the window in an arc, low on the left at 7am, low on the right by evening
    const u = (h - 6.5) / 13.5, sx = 62 + u * 276, sy = 304 - Math.sin(u * Math.PI) * 190;
    c.globalAlpha = L.sun; putAt(c, cache.get(c, "sun", 120, 120, sunGlow, 0.6), sx, sy); c.globalAlpha = 1;
  }
  if (L.night > 0) { const mx = 300 - (h - 19.5) * 26, my = 230 - (h - 19.5) * 38; c.globalAlpha = L.night; putAt(c, cache.get(c, "moon", 80, 80, moon, 0.8), mx, my); c.globalAlpha = 1; }
  c.restore();
}

// ── the room ──
function curtain(c: C, side: number, tieY: number, rnd: Rnd) {
  // drawn as the left curtain; the right one is the same thing mirrored
  const top = 78, bottom = 410, out = 3, rodIn = 47, tieX = 26, footIn = 46;   // never over the glass, so the sky keeps its own light
  const shape = () => {
    c.beginPath(); c.moveTo(out, top); c.lineTo(rodIn, top);
    c.bezierCurveTo(rodIn - 2, top + 70, tieX + 14, tieY - 50, tieX, tieY);
    c.bezierCurveTo(tieX + 8, tieY + 50, footIn - 4, bottom - 70, footIn, bottom);
    c.lineTo(out, bottom); c.closePath();
  };
  c.save(); if (side < 0) { c.translate(400, 0); c.scale(-1, 1); }
  const k = c.getTransform().a || 1;
  c.save(); shape(); c.shadowColor = "rgba(40,50,30,0.32)"; c.shadowBlur = 12 * Math.abs(k); c.shadowOffsetX = 5 * k; c.shadowOffsetY = 5 * Math.abs(k); c.fillStyle = "#e3d8c4"; c.fill(); c.restore();
  c.save(); shape(); c.clip();
  weave(c, 0, top, rodIn + 4, bottom, rnd, "#ebe1cf", 1.4);
  // folds: gathered tight at the tie-back, falling open above and below it
  for (let i = 0; i < 6; i++) {
    const t0 = i / 6, t1 = (i + 1) / 6, xa = (y: number) => out + (edgeAt(y) - out) * t0, xb = (y: number) => out + (edgeAt(y) - out) * t1;
    c.beginPath(); c.moveTo(xa(top), top);
    for (let y = top; y <= bottom; y += 12) c.lineTo(xa(y), y);
    for (let y = bottom; y >= top; y -= 12) c.lineTo(xb(y), y);
    c.closePath();
    c.fillStyle = lin(c, xa(tieY), 0, xb(tieY), 0, [[0, "rgba(255,255,255,0.2)"], [0.4, "rgba(255,255,255,0.02)"], [0.8, "rgba(95,72,40,0.18)"], [1, "rgba(95,72,40,0.05)"]]); c.fill();
  }
  c.fillStyle = lin(c, 0, top, 0, bottom, [[0, "rgba(90,70,40,0.14)"], [0.15, "rgba(90,70,40,0)"], [0.92, "rgba(90,70,40,0)"], [1, "rgba(90,70,40,0.2)"]]); c.fillRect(0, top, rodIn + 4, bottom - top);
  c.restore();
  c.fillStyle = "rgba(60,45,25,0.28)"; rr(c, out - 2, tieY - 1, tieX - out + 10, 9, 3); c.fill();   // the tie-back
  c.fillStyle = lin(c, 0, tieY - 4, 0, tieY + 4, [[0, "#d6c4a3"], [1, "#a8956f"]]); rr(c, out - 2, tieY - 4, tieX - out + 10, 8, 3); c.fill();
  c.fillStyle = "rgba(255,250,235,0.5)"; c.fillRect(out, tieY - 3, tieX - out + 4, 1);
  c.restore();
  function edgeAt(y: number) {   // the curtain's inner edge at height y, matching the curves above
    if (y <= tieY) { const t = (y - top) / (tieY - top); return rodIn + (tieX - rodIn) * (t * t * (3 - 2 * t)); }
    const t = (y - tieY) / (bottom - tieY); return tieX + (footIn - tieX) * (t * t * (3 - 2 * t));
  }
}
function herbPot(c: C, x: number, y: number, rnd: Rnd) {
  c.fillStyle = "rgba(50,35,20,0.3)"; ell(c, x + 3, y + 1, 18, 3.5); c.fill();
  c.fillStyle = lin(c, x - 13, 0, x + 13, 0, [[0, "#e58f62"], [0.4, "#cf7246"], [1, "#9a4a28"]]); c.beginPath(); c.moveTo(x - 13, y - 22); c.lineTo(x + 13, y - 22); c.lineTo(x + 10, y); c.lineTo(x - 10, y); c.closePath(); c.fill();
  c.fillStyle = lin(c, x - 15, 0, x + 15, 0, [[0, "#f0a57a"], [1, "#a95530"]]); rr(c, x - 15, y - 27, 30, 6, 2); c.fill();
  c.fillStyle = "rgba(255,230,210,0.5)"; c.fillRect(x - 13, y - 26, 20, 1);
  for (let i = 0; i < 26; i++) {   // basil leaves
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4, d = 6 + rnd() * 20, lx = x + Math.cos(a) * d * 0.9, ly = y - 28 + Math.sin(a) * d;
    c.strokeStyle = "rgba(60,100,40,0.6)"; c.lineWidth = 0.8; line(c, x + (rnd() - 0.5) * 6, y - 26, lx, ly);
    c.save(); c.translate(lx, ly); c.rotate(a + Math.PI / 2 + (rnd() - 0.5));
    c.fillStyle = lin(c, -4, -6, 4, 6, [[0, "#8fcf5e"], [1, "#3d7f2c"]]); ell(c, 0, 0, 3.6, 6); c.fill();
    c.strokeStyle = "rgba(40,80,25,0.4)"; c.lineWidth = 0.4; line(c, 0, -5, 0, 5);
    c.restore();
  }
}
function jar(c: C, x: number, y: number) {
  c.fillStyle = "rgba(50,35,20,0.28)"; ell(c, x + 3, y + 1, 13, 3); c.fill();
  c.fillStyle = "rgba(220,235,240,0.35)"; rr(c, x - 10, y - 30, 20, 30, 4); c.fill();
  c.fillStyle = lin(c, 0, y - 22, 0, y, [[0, "#f3d58a"], [1, "#d9a441"]]); rr(c, x - 9, y - 20, 18, 19, 3); c.fill();   // honey
  c.fillStyle = lin(c, x - 11, 0, x + 11, 0, [[0, "#7d8792"], [0.4, "#e8edf2"], [1, "#6b7480"]]); rr(c, x - 11, y - 35, 22, 6, 2); c.fill();
  c.fillStyle = "rgba(255,255,255,0.6)"; rr(c, x - 7, y - 27, 2.5, 22, 1.2); c.fill();
  c.strokeStyle = "rgba(120,140,150,0.5)"; c.lineWidth = 0.7; rr(c, x - 10, y - 30, 20, 30, 4); c.stroke();
}
function paintRoom(c: C, W: number, H: number, HUD: number, GRIP_Y: number) {
  const rnd = mulberry(2202);
  // the wall: sage plaster
  plaster(c, 0, HUD, W, TILE0, rnd, "#c4d2bb");
  c.fillStyle = lin(c, 0, HUD, 0, TILE0, [[0, "rgba(40,60,30,0.1)"], [1, "rgba(255,255,255,0.05)"]]); c.fillRect(0, HUD, W, TILE0 - HUD);
  // the window casing: thick painted wood, bevelled, with a shadow on the wall
  c.save(); c.shadowColor = "rgba(40,55,30,0.35)"; c.shadowBlur = 12 * (c.getTransform().a || 1); c.shadowOffsetX = 4 * (c.getTransform().a || 1); c.shadowOffsetY = 6 * (c.getTransform().a || 1);
  c.fillStyle = "#f2efe7"; rr(c, CX0, CY0, CX1 - CX0, CY1 - CY0, 3); c.fill(); c.restore();
  c.fillStyle = lin(c, CX0, CY0, CX1, CY1, [[0, "#fffdf8"], [0.6, "#f1ede3"], [1, "#ddd6c8"]]); rr(c, CX0, CY0, CX1 - CX0, CY1 - CY0, 3); c.fill();
  c.fillStyle = "rgba(120,110,90,0.35)"; c.fillRect(GX0 - 3, GY0 - 3, GX1 - GX0 + 6, GY1 - GY0 + 6);   // the reveal, shadowed
  c.fillStyle = lin(c, GX0 - 3, GY0 - 3, GX0 + 6, GY0 + 6, [[0, "#a59c88"], [1, "#d8d1c2"]]);
  c.fillRect(GX0 - 3, GY0 - 3, GX1 - GX0 + 6, 3); c.fillRect(GX0 - 3, GY0 - 3, 3, GY1 - GY0 + 6);
  c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 1; c.beginPath(); c.moveTo(CX0 + 1, CY1 - 2); c.lineTo(CX0 + 1, CY0 + 1); c.lineTo(CX1 - 2, CY0 + 1); c.stroke();
  c.strokeStyle = "rgba(120,110,90,0.4)"; c.beginPath(); c.moveTo(CX1 - 0.5, CY0 + 2); c.lineTo(CX1 - 0.5, CY1 - 0.5); c.stroke();
  c.clearRect(GX0, GY0, GX1 - GX0, GY1 - GY0);   // cut the glass out (its streaks and bars are in the front layer)
  // the sill: a deep ledge you see the top of, a shadow under its nose
  c.fillStyle = "rgba(40,55,30,0.35)"; c.fillRect(CX0 - 6, SILL + 18, CX1 - CX0 + 12, 8);
  c.fillStyle = lin(c, 0, SILL - 6, 0, SILL + 6, [[0, "#ddd6c8"], [1, "#fbf9f3"]]); c.beginPath(); c.moveTo(CX0, SILL - 6); c.lineTo(CX1, SILL - 6); c.lineTo(CX1 + 10, SILL + 6); c.lineTo(CX0 - 10, SILL + 6); c.closePath(); c.fill();
  c.fillStyle = lin(c, 0, SILL + 6, 0, SILL + 20, [[0, "#f6f3ec"], [0.5, "#e6e0d3"], [1, "#c9c1b0"]]); rr(c, CX0 - 10, SILL + 6, CX1 - CX0 + 20, 14, [0, 0, 3, 3]); c.fill();
  c.fillStyle = "rgba(255,255,255,0.95)"; c.fillRect(CX0 - 10, SILL + 6, CX1 - CX0 + 20, 1.2);
  // subway tiles between the sill and the table
  c.save(); c.beginPath(); c.rect(0, TILE0, W, TABLE - TILE0); c.clip();
  c.fillStyle = "#cfcabd"; c.fillRect(0, TILE0, W, TABLE - TILE0);
  for (let y = TILE0, j = 0; y < TABLE; y += 14.5, j++) for (let x = -(j % 2 ? 16 : 0); x < W; x += 32) {
    c.fillStyle = "#bdb7a8"; rr(c, x + 0.6, y + 0.6, 31, 13.6, 2.4); c.fill();
    c.fillStyle = lin(c, 0, y, 0, y + 14, [[0, "#fffdf6"], [0.6, mix("#f1ede2", "#fffdf6", rnd() * 0.6)], [1, "#e2dccd"]]); rr(c, x + 1, y + 1, 30, 12.6, 2.2); c.fill();
    c.fillStyle = "rgba(255,255,255,0.8)"; rr(c, x + 3, y + 1.8, 24, 1.6, 0.8); c.fill();
    c.fillStyle = "rgba(120,110,90,0.18)"; c.fillRect(x + 2, y + 12.4, 28, 0.8);
  }
  c.fillStyle = lin(c, 0, TILE0, 0, TILE0 + 16, [[0, "rgba(40,50,30,0.35)"], [1, "rgba(40,50,30,0)"]]); c.fillRect(0, TILE0, W, 16);
  c.restore();
  // the walnut table: planks widening toward you, oiled, a soft shadow along the back
  c.save(); c.beginPath(); c.rect(0, TABLE, W, H - TABLE); c.clip();
  const WAL = ["#9a5a2e", "#8b4f27", "#a86433", "#7f4722", "#955730"];
  let y = TABLE;
  for (const ph of [12, 15, 19, 24, 30, 38, 46]) {
    c.save(); c.beginPath(); c.rect(0, y, W, ph); c.clip(); planks(c, 0, y, W, y + ph + 2, rnd, WAL, "50,22,4", [ph + 2, 0.01], true); c.restore();
    c.fillStyle = "rgba(40,16,2,0.55)"; c.fillRect(0, y - 0.6, W, 1.2); c.fillStyle = "rgba(255,220,180,0.18)"; c.fillRect(0, y + 0.8, W, 0.8);
    y += ph; if (y > H) break;
  }
  sheen(c, 0, TABLE, W, H, 0.16);
  c.fillStyle = lin(c, 0, TABLE, 0, TABLE + 26, [[0, "rgba(30,12,0,0.5)"], [1, "rgba(30,12,0,0)"]]); c.fillRect(0, TABLE, W, 26);
  // the groove the grip slides in
  c.fillStyle = "rgba(30,12,0,0.45)"; rr(c, 14, GRIP_Y - 9, W - 28, 18, 9); c.fill();
  c.fillStyle = lin(c, 0, GRIP_Y - 9, 0, GRIP_Y + 9, [[0, "#3a1c08"], [0.5, "#5a2f12"], [1, "#6e3c18"]]); rr(c, 15, GRIP_Y - 8, W - 30, 16, 8); c.fill();
  c.strokeStyle = "rgba(255,220,180,0.35)"; c.lineWidth = 1; c.beginPath(); c.moveTo(22, GRIP_Y + 9.5); c.lineTo(W - 22, GRIP_Y + 9.5); c.stroke();
  c.restore();
  // linen curtains, tied back, on a brass rod
  curtain(c, 1, 250, rnd); curtain(c, -1, 250, rnd);
  c.fillStyle = "rgba(40,50,30,0.3)"; rr(c, 4, 76, W - 8, 6, 3); c.fill();
  c.fillStyle = lin(c, 0, 71, 0, 78, [[0, "#f6dd9a"], [0.4, "#c89b3c"], [1, "#7d5a18"]]); rr(c, 4, 71, W - 8, 6, 3); c.fill();
  for (const fx of [8, W - 8]) { c.fillStyle = rad(c, fx - 1.5, 72, 0.5, 7, [[0, "#fff3c8"], [0.5, "#d4a647"], [1, "#7d5a18"]]); circ(c, fx, 74, 6.5); c.fill(); }
  for (let i = 0; i < 6; i++) { const rx = i < 3 ? 14 + i * 22 : W - 14 - (i - 3) * 22; c.strokeStyle = "#a9802c"; c.lineWidth = 1.6; ell(c, rx, 76, 3.2, 5); c.stroke(); }
  // warm light from the top left, falling off into a soft vignette (the glass keeps the sky's own light)
  c.save(); c.beginPath(); c.rect(0, HUD, W, H - HUD); c.rect(GX0, GY0, GX1 - GX0, GY1 - GY0); c.clip("evenodd");
  c.fillStyle = rad(c, W * 0.2, HUD + 40, 10, H * 0.9, [[0, "rgba(255,228,176,0.16)"], [0.45, "rgba(255,228,176,0.04)"], [1, "rgba(255,228,176,0)"]]); c.fillRect(0, HUD, W, H - HUD);
  c.fillStyle = rad(c, W * 0.5 + 20, H * 0.5, H * 0.38, H * 0.85, [[0, "rgba(30,14,0,0)"], [1, "rgba(30,14,0,0.36)"]]); c.fillRect(0, HUD, W, H - HUD);
  c.restore();
}
/** The things in front of the sky that the room's light falls on: the glass's streaks, the sash bars, the herb pot and
 *  the honey jar on the sill. Kept apart from the room so they can dim at night without dimming the sky behind. */
function paintFront(c: C, dark: boolean) {
  const rnd = mulberry(77), mx = (GX0 + GX1) / 2, my = 220;
  c.save(); c.beginPath(); c.rect(GX0, GY0, GX1 - GX0, GY1 - GY0); c.clip();
  c.fillStyle = "rgba(255,255,255,0.05)"; c.fillRect(GX0, GY0, GX1 - GX0, GY1 - GY0);
  for (const [o, wd, a] of [[0.08, 0.1, 0.14], [0.24, 0.04, 0.09], [0.62, 0.12, 0.1]]) {
    const ax = GX0 + (GX1 - GX0) * o; c.fillStyle = lin(c, ax, 0, ax + (GX1 - GX0) * wd, 0, [[0, "rgba(255,255,255,0)"], [0.5, `rgba(255,255,255,${a})`], [1, "rgba(255,255,255,0)"]]);
    c.beginPath(); c.moveTo(ax, GY0); c.lineTo(ax + (GX1 - GX0) * wd, GY0); c.lineTo(ax + (GX1 - GX0) * wd - 120, GY1); c.lineTo(ax - 120, GY1); c.closePath(); c.fill();
  }
  for (const [x, y, w, h] of [[mx - 4, GY0, 8, GY1 - GY0], [GX0, my - 4, GX1 - GX0, 8]]) {
    c.fillStyle = "rgba(20,30,40,0.18)"; c.fillRect(x + 2, y + 3, w, h);
    c.fillStyle = w < h ? lin(c, x, 0, x + w, 0, [[0, "#ffffff"], [0.6, "#eeeae1"], [1, "#cfc7b6"]]) : lin(c, 0, y, 0, y + h, [[0, "#ffffff"], [0.6, "#eeeae1"], [1, "#cfc7b6"]]); c.fillRect(x, y, w, h);
  }
  c.fillStyle = "rgba(20,30,40,0.22)"; c.fillRect(GX0, GY0, GX1 - GX0, 3); c.fillRect(GX0, GY0, 3, GY1 - GY0);
  c.restore();
  herbPot(c, 74, SILL + 2, rnd); jar(c, 330, SILL + 2);
  if (dark) { c.globalCompositeOperation = "source-atop"; c.fillStyle = "rgb(18,24,58)"; c.fillRect(0, 0, 400, 600); c.globalCompositeOperation = "source-over"; }
}
/** Lamplight for the evening: a warm pool over the table, and a little from a lamp off to the top left. */
function lampGlow(c: C, W: number, H: number) {
  c.fillStyle = rad(c, W * 0.5, 440, 0, 330, [[0, "rgba(255,200,130,0.42)"], [0.4, "rgba(255,186,110,0.18)"], [1, "rgba(255,176,100,0)"]]); c.fillRect(0, 0, W, H);
  c.fillStyle = rad(c, 40, 90, 0, 220, [[0, "rgba(255,200,130,0.3)"], [1, "rgba(255,186,110,0)"]]); c.fillRect(0, 0, W, H);
}

/** The room round the window, lit for hour h. Draw after drawView. */
export function drawRoom(c: C, W: number, H: number, HUD: number, GRIP_Y: number, h: number) {
  put(c, cache.get(c, "room", W, H, cc => paintRoom(cc, W, H, HUD, GRIP_Y)));
  const L = lightAt(h);
  if (L.warm > 0.01 || L.night > 0.01) {   // tint the room (not the sky) warm for sunrise and evening, dark at night
    c.save(); c.beginPath(); c.rect(0, HUD, W, H - HUD); c.rect(GX0, GY0, GX1 - GX0, GY1 - GY0); c.clip("evenodd");
    if (L.warm > 0.01) { c.fillStyle = `rgba(255,150,70,${0.11 * L.warm * (1 - L.night)})`; c.fillRect(0, HUD, W, H - HUD); }
    if (L.night > 0.01) { c.globalCompositeOperation = "multiply"; c.fillStyle = `rgba(66,76,140,${0.72 * L.night})`; c.fillRect(0, HUD, W, H - HUD); c.globalCompositeOperation = "source-over"; }
    c.restore();
  }
  const F0 = CX0 - 12, F1 = 92;   // the front layer covers the window and its sill
  put(c, cache.get(c, "front", CX1 - CX0 + 24, SILL + 30 - F1, cc => { cc.translate(-F0, -F1); paintFront(cc, false); }), F0, F1);
  if (L.night > 0.01) {
    c.globalAlpha = L.night * 0.6; put(c, cache.get(c, "frontN", CX1 - CX0 + 24, SILL + 30 - F1, cc => { cc.translate(-F0, -F1); paintFront(cc, true); }), F0, F1); c.globalAlpha = 1;
    c.save(); c.beginPath(); c.rect(0, HUD, W, H - HUD); c.rect(GX0, GY0, GX1 - GX0, GY1 - GY0); c.clip("evenodd"); c.globalAlpha = L.night; put(c, cache.get(c, "lamp", W, H, cc => lampGlow(cc, W, H), 0.25)); c.restore();
  }
}

// ── the top strip ──
const TRACK_X0 = 126, TRACK_X1 = 240, TRACK_Y = 20;
function paintPanel(c: C, W: number, HUD: number) {
  c.fillStyle = lin(c, 0, 0, 0, HUD, [[0, "rgba(255,255,255,0.97)"], [1, "rgba(244,247,252,0.95)"]]); c.fillRect(0, 0, W, HUD);
  c.fillStyle = lin(c, 0, 0, W, HUD, [[0, "rgba(255,240,215,0.25)"], [0.4, "rgba(255,255,255,0)"]]); c.fillRect(0, 0, W, HUD);
  c.fillStyle = "rgba(14,31,69,0.14)"; c.fillRect(0, HUD - 1, W, 1);
  // the energy track: a recessed groove
  const bx = 16, bw = W - 32, by = 38, bh = 14;
  c.fillStyle = "rgba(14,31,69,0.16)"; rr(c, bx - 1.5, by - 1, bw + 3, bh + 3, 8.5); c.fill();
  // the sun track
  c.fillStyle = "rgba(14,31,69,0.12)"; rr(c, TRACK_X0 - 1, TRACK_Y - 4, TRACK_X1 - TRACK_X0 + 2, 8, 4); c.fill();
  c.fillStyle = "#e9eef6"; rr(c, TRACK_X0, TRACK_Y - 3, TRACK_X1 - TRACK_X0, 6, 3); c.fill();
  for (let i = 0; i <= 15; i += 3) { const x = TRACK_X0 + 3 + (i / 15) * (TRACK_X1 - TRACK_X0 - 6); c.fillStyle = "rgba(14,31,69,0.2)"; c.fillRect(x - 0.5, TRACK_Y + 5, 1, 2.5); }
}
const BAR_COLS: [number, number, string, string][] = [[0, 20, "#f7b9be", "#e8838c"], [20, 40, "#fde3a4", "#f2c35e"], [40, 80, "#bfe9cd", "#6fcf97"], [80, 92, "#fde3a4", "#f2c35e"], [92, 100, "#ecc4f4", "#c98ad8"]];
function paintBar(c: C, W: number) {
  const bx = 16, bw = W - 32, by = 38, bh = 14;
  c.save(); rr(c, bx, by, bw, bh, 7); c.clip();
  for (const [a, b, t, d] of BAR_COLS) { c.fillStyle = lin(c, 0, by, 0, by + bh, [[0, t], [1, mix(t, d, 0.55)]]); c.fillRect(bx + (a / 100) * bw, by, ((b - a) / 100) * bw + 0.5, bh); }
  c.fillStyle = lin(c, 0, by, 0, by + bh, [[0, "rgba(255,255,255,0.65)"], [0.45, "rgba(255,255,255,0.15)"], [0.5, "rgba(255,255,255,0)"], [1, "rgba(0,0,0,0.06)"]]); c.fillRect(bx, by, bw, bh);
  c.fillStyle = "rgba(14,31,69,0.18)"; c.fillRect(bx, by, bw, 1.5);
  for (const v of [20, 40, 80, 92]) { c.fillStyle = "rgba(255,255,255,0.75)"; c.fillRect(bx + (v / 100) * bw - 0.6, by + 2, 1.2, bh - 4); }
  c.restore();
  c.strokeStyle = "rgba(16,27,46,0.18)"; c.lineWidth = 1; rr(c, bx, by, bw, bh, 7); c.stroke();
}
function paintTrackFill(c: C) {
  const w = TRACK_X1 - TRACK_X0;
  c.fillStyle = lin(c, TRACK_X0, 0, TRACK_X1, 0, [[0, "#ffb27a"], [0.18, "#ffd36b"], [0.5, "#ffe48a"], [0.75, "#ffb36b"], [0.86, "#e98aa0"], [1, "#5866b8"]]); rr(c, TRACK_X0, TRACK_Y - 3, w, 6, 3); c.fill();
  c.fillStyle = "rgba(255,255,255,0.45)"; rr(c, TRACK_X0 + 2, TRACK_Y - 2.4, w - 4, 1.6, 0.8); c.fill();
}
function sunIcon(c: C) {
  c.translate(12, 12);
  c.strokeStyle = "#f2a516"; c.lineWidth = 1.6; c.lineCap = "round";
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; line(c, Math.cos(a) * 7.6, Math.sin(a) * 7.6, Math.cos(a) * 10, Math.sin(a) * 10); }
  c.fillStyle = "rgba(160,90,0,0.3)"; circ(c, 0.6, 1, 6); c.fill();
  c.fillStyle = rad(c, -2, -2, 0.5, 7, [[0, "#fff6c8"], [0.5, "#ffd23e"], [1, "#f29d0c"]]); circ(c, 0, 0, 5.8); c.fill();
  c.fillStyle = "rgba(255,255,255,0.8)"; ell(c, -2, -2.4, 1.8, 1.1, -0.6); c.fill();
}
function moonIcon(c: C) {
  c.translate(12, 12);
  c.fillStyle = "rgba(20,30,70,0.25)"; circ(c, 0.6, 1, 6.6); c.fill();
  c.beginPath(); c.arc(0, 0, 6.4, 0, TAU); c.arc(3.2, -2.2, 5.2, 0, TAU, true); c.closePath();
  c.fillStyle = lin(c, -6, -6, 6, 6, [[0, "#fff8dc"], [1, "#d9cf9f"]]); c.fill("evenodd");
  c.strokeStyle = "rgba(90,80,40,0.35)"; c.lineWidth = 0.6; c.stroke();
}
/** The frosted top strip behind the clock and the energy bar, with the day's progress on a little sun track. */
export function drawPanel(c: C, W: number, HUD: number, h: number, start: number, end: number) {
  put(c, cache.get(c, "panel", W, HUD + 6, cc => paintPanel(cc, W, HUD)));
  c.fillStyle = lin(c, 0, HUD, 0, HUD + 8, [[0, "rgba(14,31,69,0.16)"], [1, "rgba(14,31,69,0)"]]); c.fillRect(0, HUD, W, 8);
  put(c, cache.get(c, "bar", W, HUD, cc => paintBar(cc, W)));
  const u = Math.max(0, Math.min(1, (h - start) / (end - start))), x = TRACK_X0 + 3 + u * (TRACK_X1 - TRACK_X0 - 6);
  const fill = cache.get(c, "tfill", W, 30, paintTrackFill);
  c.save(); c.beginPath(); c.rect(TRACK_X0, 0, x - TRACK_X0, 30); c.clip(); put(c, fill); c.restore();
  const night = h >= 19.5;
  putAt(c, cache.get(c, night ? "moonI" : "sunI", 24, 24, night ? moonIcon : sunIcon), x, TRACK_Y);
}
/** The energy knob: a glossy bead with the zone's colour round it. */
export function drawKnob(c: C, x: number, y: number, ring: string) {
  c.fillStyle = "rgba(14,31,69,0.28)"; circ(c, x + 0.8, y + 1.6, 9.5); c.fill();
  c.fillStyle = ring; circ(c, x, y, 10.5); c.fill();
  c.fillStyle = lin(c, x - 8, y - 8, x + 8, y + 8, [[0, "#ffffff"], [1, "#e3e9f2"]]); circ(c, x, y, 7.3); c.fill();
  c.fillStyle = "rgba(255,255,255,0.55)"; ell(c, x - 3.5, y - 6.5, 3.6, 1.6, -0.4); c.fill();
}

// ── the moving things ──
function saucer(c: C, r: number) {
  c.translate(r + 2, r + 2);
  c.fillStyle = lin(c, -r, -r, r, r, [[0, "#ffffff"], [0.6, "#f2f3f5"], [1, "#d3d7de"]]); circ(c, 0, 0, r); c.fill();
  c.fillStyle = rad(c, r * 0.12, r * 0.15, r * 0.2, r * 0.78, [[0, "#ffffff"], [0.75, "#f4f5f7"], [1, "#dfe3ea"]]); circ(c, 0, 0, r * 0.76); c.fill();
  c.strokeStyle = "rgba(140,150,165,0.45)"; c.lineWidth = 0.8; circ(c, 0, 0, r * 0.76); c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineWidth = 1.6; c.lineCap = "round"; c.beginPath(); c.arc(0, 0, r - 1.4, Math.PI * 1.05, Math.PI * 1.55); c.stroke();
  c.strokeStyle = "rgba(100,110,130,0.45)"; c.lineWidth = 1; circ(c, 0, 0, r - 0.5); c.stroke();
  gloss(c, -r * 0.5, -r * 0.55, r * 0.3, r * 0.14, 0.9);
}
function blob(c: C, r: number, a: number, col = "30,20,40") {
  const R = r * 1.25; c.translate(R, R);
  c.fillStyle = rad(c, 0, 0, 0, R, [[0, `rgba(${col},${a})`], [0.55, `rgba(${col},${a * 0.55})`], [1, `rgba(${col},0)`]]); circ(c, 0, 0, R); c.fill();
}
/** A falling food on its saucer, with a soft shadow on the wall behind it. */
export function drawFood(c: C, img: HTMLImageElement, x: number, y: number, r: number, rot: number, night: number) {
  putAt(c, cache.get(c, `fsh${r}`, r * 2.5, r * 2.5, cc => blob(cc, r, 0.3)), x + 6, y + 10);
  c.save(); c.translate(x, y); c.rotate(rot);
  putAt(c, cache.get(c, `sau${r}`, r * 2 + 4, r * 2 + 4, cc => saucer(cc, r)), 0, 0);
  if (night > 0) { c.fillStyle = `rgba(14,20,52,${0.18 * night})`; circ(c, 0, 0, r); c.fill(); }
  const s = r * 1.6; if (img.complete && img.naturalWidth) c.drawImage(img, -s / 2, -s / 2, s, s);
  c.restore();
}
/** The face sitting on the table: a soft shadow under it, a glazed plate, a ring in the zone's colour. */
export function drawFace(c: C, img: HTMLImageElement, x: number, y: number, r: number, ring: string) {
  putAt(c, cache.get(c, `fcs${r}`, r * 2.5, r * 2.5, cc => blob(cc, r, 0.42, "30,12,0")), x + 4, y + 9);
  c.fillStyle = "rgba(30,12,0,0.35)"; ell(c, x + 3, y + r - 1, r * 0.85, 5); c.fill();
  putAt(c, cache.get(c, `sau${r}`, r * 2 + 4, r * 2 + 4, cc => saucer(cc, r)), x, y);
  c.strokeStyle = ring; c.lineWidth = 4; circ(c, x, y, r); c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, r + 0.6, Math.PI * 1.08, Math.PI * 1.5); c.stroke();
  const s = r * 1.55; if (img.complete && img.naturalWidth) c.drawImage(img, x - s / 2, y - s / 2, s, s);
}
/** A heart, glossy when full, a pale outline when it's gone. */
export function drawHeart(c: C, x: number, y: number, s: number, full: boolean) {
  c.beginPath(); c.moveTo(x, y + s * 0.3);
  c.bezierCurveTo(x, y, x - s / 2, y, x - s / 2, y + s * 0.3);
  c.bezierCurveTo(x - s / 2, y + s * 0.6, x, y + s * 0.8, x, y + s);
  c.bezierCurveTo(x, y + s * 0.8, x + s / 2, y + s * 0.6, x + s / 2, y + s * 0.3);
  c.bezierCurveTo(x + s / 2, y, x, y, x, y + s * 0.3); c.closePath();
  if (full) {
    c.fillStyle = lin(c, x - s / 2, y, x + s / 2, y + s, [[0, "#ff8a92"], [0.5, "#e8505b"], [1, "#b8323d"]]); c.fill();
    c.strokeStyle = "rgba(120,20,30,0.5)"; c.lineWidth = 0.8; c.stroke();
    c.fillStyle = "rgba(255,255,255,0.75)"; ell(c, x - s * 0.24, y + s * 0.24, s * 0.1, s * 0.06, -0.6); c.fill();
  } else { c.fillStyle = "rgba(255,255,255,0.7)"; c.fill(); c.strokeStyle = "rgba(16,27,46,0.3)"; c.lineWidth = 1.5; c.stroke(); }
}
/** The grip you drag: a glazed white pill with three ridges. */
export function drawGrip(c: C, x: number, y: number) {
  putAt(c, cache.get(c, "grip", 80, 42, cc => {
    cc.translate(40, 21);
    cc.fillStyle = "rgba(30,12,0,0.4)"; rr(cc, -33, -12, 68, 30, 15); cc.fill();
    cc.fillStyle = lin(cc, 0, -15, 0, 15, [[0, "#ffffff"], [0.55, "#eef2f8"], [1, "#c9d3e2"]]); rr(cc, -34, -15, 68, 30, 15); cc.fill();
    cc.strokeStyle = "rgba(63,127,214,0.55)"; cc.lineWidth = 2; rr(cc, -34, -15, 68, 30, 15); cc.stroke();
    cc.fillStyle = "rgba(255,255,255,0.9)"; rr(cc, -26, -12.5, 52, 5, 2.5); cc.fill();
    for (const dx of [-8, 0, 8]) {
      cc.fillStyle = "rgba(255,255,255,0.9)"; rr(cc, dx - 1.6, -6, 3.2, 13, 1.6); cc.fill();
      cc.fillStyle = "rgba(63,127,214,0.6)"; rr(cc, dx - 1.4, -6.5, 2.8, 12, 1.4); cc.fill();
    }
  }), x, y + 1);
}
/** Paints every layer the day will need up front (all the skies, night's lamp and dimmed window, the saucers), so
 *  nothing gets painted mid-game. Draws junk on the board; call it every frame right before the board is cleared (it only works when it has to). */
let warmK = 0;
export function warm(c: C, W: number, H: number, HUD: number, GRIP_Y: number, FR: number, PR: number, img: HTMLImageElement) {
  const k = boardScale(c); if (Math.abs(k - warmK) < 0.01) return; warmK = k;   // again only if the board's pixel scale changed
  for (const k of SKIES) drawView(c, k.h + 0.01);
  drawRoom(c, W, H, HUD, GRIP_Y, 21); drawRoom(c, W, H, HUD, GRIP_Y, 8);
  drawPanel(c, W, HUD, 8, 7, 22); drawPanel(c, W, HUD, 21, 7, 22);
  drawFood(c, img, 100, 300, FR, 0, 0); drawFace(c, img, 100, 300, PR, "#2eaa6e"); drawGrip(c, 100, GRIP_Y);
}
/** Words on the board with a soft halo so they read over the window, the wall and the table. */
export function haloText(c: C, text: string, x: number, y: number, fill: string, dark: boolean) {
  c.lineJoin = "round"; c.strokeStyle = dark ? "rgba(10,16,40,0.6)" : "rgba(255,255,255,0.85)"; c.lineWidth = 4; c.strokeText(text, x, y);
  c.fillStyle = fill; c.fillText(text, x, y);
}
export { lighter, darker, rgba };
