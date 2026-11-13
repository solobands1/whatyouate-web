// Berry Pong's art, in the "Premium Kitchen" look: a walnut kitchen table running away from you in gentle perspective,
// woven seagrass placemats, glazed cereal bowls with milk and toasted oat rings, a soft kitchen behind (blue shaker
// cabinets, a quartz counter, white tile), warm light from the top left and a vignette. Static layers are painted once
// into offscreen canvases (the room and table, the light, each bowl and its shadow); the game only stamps them.
// The berry is the blueberry emoji (public/games/foods/1fad0.png): the front berry of the three, cut out and shaded.
//
// The camera: you sit at your end of the table looking down it. World units are the rules' (roughly cm): x across the
// table, y along it (0 at your end), z up from the table top. Straight up stays straight up on screen, which keeps the
// bowls simple to draw. The board is BW wide and BH tall (BH follows the phone's shape); the camera is fitted so the far
// end of the table sits about a third of the way down and your own bowls touch the bottom.
import { BOWLS, TL, TW, R, H, FOOT, BACK, ROW, type Side } from "./rules";
import { type C, type Rnd, TAU, seeded, layer, ell, lin, rad, mix, lighter, darker, rgba, warmLight, gloss } from "../art2/paint";
import { drawHint as drawSharedHint } from "../hint";

export const BW = 360;
const CY = 180, CZ = 130, FLOOR = -75, TOP_F = 0.32;
export type Cam = { BH: number; F: number; HY: number };
export type Pt = { x: number; y: number; s: number };

export function makeCam(BH: number): Cam {
  const top = TOP_F * BH, bot = BH - 4, a1 = CZ / (TL + CY), a2 = CZ / (6 + CY);
  const F = (bot - top) / (a2 - a1);
  return { BH, F, HY: top - a1 * F };
}
/** A world point on the board, and how many board units one world unit is there. */
export function P(cam: Cam, x: number, y: number, z: number): Pt {
  const d = Math.max(30, y + CY), s = cam.F / d;
  return { x: BW / 2 + x * s, y: cam.HY + (CZ - z) * s, s };
}
/** How flat a level circle at height z looks at depth y (1 = seen from straight above). */
export const flat = (y: number, z: number) => (CZ - z) / Math.max(30, y + CY);
/** Where a point in the thrower's frame is in the viewer's world (the thrower's far end is the viewer's near end). */
export function toWorld(x: number, y: number, z: number, thrower: Side, viewer: Side): [number, number, number] {
  return thrower === viewer ? [x, y, z] : [-x, TL - y, z];
}
/** Bowl i of `side`, in the viewer's world: the viewer's own bowls are at the near end. */
export function bowlAt(side: Side, i: number, viewer: Side): [number, number] {
  const [bx, by] = BOWLS[i];
  return side === viewer ? [-bx, TL - by] : [bx, by];
}

// ── colours ────────────────────────────────────────────────────────────────
export type Glaze = { hi: string; mid: string; lo: string; deep: string };
/** You (and Same Phone's player 1) in the WhatYouAte blue; the other player in the soft pink. */
export const GLAZE: [Glaze, Glaze] = [
  { hi: "#C9DFFF", mid: "#86B4F8", lo: "#5A8BDB", deep: "#3E68B4" },
  { hi: "#FFD3DB", mid: "#FF94A8", lo: "#E26683", deep: "#B9486A" },
];
const WALNUT = ["#7B4A2B", "#6F4226", "#84522F", "#754728", "#6B3F23"], GRAIN = "52,26,10";

// ── the room and the table (one layer, painted once per size) ─────────────
/** A level quad on the floor or table, from world corners, as a path. */
function quad(c: C, cam: Cam, x0: number, y0: number, x1: number, y1: number, z: number) {
  const a = P(cam, x0, y0, z), b = P(cam, x1, y0, z), d = P(cam, x1, y1, z), e = P(cam, x0, y1, z);
  c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.lineTo(e.x, e.y); c.closePath();
}
/** A line on a level surface, sampled along y so it bends with the perspective. */
function strokeAlong(c: C, cam: Cam, fx: (y: number) => number, y0: number, y1: number, z: number, step = 3) {
  c.beginPath();
  for (let y = y0; ; y += step) {
    const yy = Math.min(y, y1), p = P(cam, fx(yy), yy, z);
    if (yy === y0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
    if (yy >= y1) break;
  }
  c.stroke();
}

/** The kitchen behind the table: white tile, a quartz counter, blue shaker cabinets with brass knobs, an oak floor.
 *  Painted small and scaled up by the caller, so it sits soft and out of focus behind the table. */
function paintRoom(c: C, cam: Cam, rnd: Rnd) {
  const BH = cam.BH, wallY = TL + 130, cabY = TL + 70, counterZ = 15;
  const wall = (z: number) => P(cam, 0, wallY, z), cab = (z: number) => P(cam, 0, cabY, z);
  // the floor everywhere first (only the sides by the table end up showing)
  c.fillStyle = lin(c, 0, 0, 0, BH, [[0, "#B8915F"], [1, "#9C7647"]]); c.fillRect(0, 0, BW, BH);
  c.strokeStyle = "rgba(70,40,15,0.35)"; c.lineWidth = 0.8;
  for (let x = -260; x <= 260; x += 14) strokeAlong(c, cam, () => x, -20, cabY, FLOOR, 20);
  // the counter's top, back to the tiled wall
  const ct = cab(counterZ), wt = wall(counterZ);
  c.fillStyle = "#EEF0EF"; c.fillRect(0, 0, BW, ct.y);
  // white subway tile on the wall above the counter
  const s = wt.s, tw = 15 * s, th = 7.5 * s;
  c.fillStyle = lin(c, 0, 0, 0, wt.y, [[0, "#F6F4EF"], [1, "#EAE6DE"]]); c.fillRect(0, 0, BW, wt.y);
  c.strokeStyle = "rgba(150,140,125,0.55)"; c.lineWidth = Math.max(0.6, 0.35 * s);
  for (let row = 0, y = wt.y; y > -th; row++, y -= th) {
    c.beginPath(); c.moveTo(0, y); c.lineTo(BW, y); c.stroke();
    for (let x = (row % 2 ? tw / 2 : 0) + ((BW / 2) % tw); x < BW; x += tw) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - th); c.stroke(); }
  }
  // a marble counter top: warm white, soft clouds and a grey vein or two
  const cy0 = wt.y, ch = ct.y - wt.y;
  c.fillStyle = lin(c, 0, cy0, 0, ct.y, [[0, "#DCDAD5"], [1, "#EEECE7"]]); c.fillRect(0, cy0, BW, ch);
  for (let i = 0; i < 8; i++) { const x = rnd() * BW, y = cy0 + rnd() * ch, r = 20 + rnd() * 40; c.fillStyle = rad(c, x, y, 0, r, [[0, "rgba(190,184,175,0.18)"], [1, "rgba(190,184,175,0)"]]); c.fillRect(x - r, y - r, r * 2, r * 2); }
  c.strokeStyle = "rgba(150,145,140,0.28)"; c.lineWidth = 0.7;
  for (let k = 0; k < 3; k++) { let x = rnd() * BW, y = cy0; c.beginPath(); c.moveTo(x, y); while (y < ct.y) { x += (rnd() - 0.35) * 14; y += 3 + rnd() * 4; c.lineTo(x, Math.min(y, ct.y)); } c.stroke(); }
  // a few things on the counter, soft: a cutting board leaning on the tile, a crock of wooden spoons, a kettle, a herb pot
  const at = (x: number, d = 30) => P(cam, x, cabY + d, counterZ);
  const foot = (x: number, y: number, w: number) => { c.fillStyle = "rgba(60,45,30,0.22)"; ell(c, x + w * 0.1, y, w * 0.62, w * 0.11); c.fill(); };
  { // the board, with a handle and a hole
    const p = at(-66, 50), w = 24 * p.s, h = 30 * p.s; foot(p.x, p.y, w);
    c.fillStyle = lin(c, p.x - w / 2, 0, p.x + w / 2, 0, [[0, "#D8AE7C"], [0.5, "#C2955F"], [1, "#9B6E3E"]]);
    c.beginPath(); c.roundRect(p.x - w / 2, p.y - h, w, h, 3 * p.s); c.fill();
    c.beginPath(); c.roundRect(p.x - 3 * p.s, p.y - h - 7 * p.s, 6 * p.s, 9 * p.s, 2.5 * p.s); c.fill();
    c.fillStyle = "#E3E1DB"; ell(c, p.x, p.y - h - 3.6 * p.s, 1.3 * p.s, 1.3 * p.s); c.fill();
  }
  { // a white crock with wooden spoons
    const p = at(-40, 34), w = 11 * p.s, h = 13 * p.s; foot(p.x, p.y, w);
    c.strokeStyle = "#B88655"; c.lineCap = "round";
    for (const [dx, tilt, len] of [[-2, -0.35, 22], [1, 0.1, 25], [3, 0.4, 20]]) {
      const bx = p.x + dx * p.s, by = p.y - h * 0.6, ex = bx + Math.sin(tilt) * len * p.s, ey = by - Math.cos(tilt) * len * p.s;
      c.lineWidth = 1.2 * p.s; c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.stroke();
      c.fillStyle = "#C79463"; ell(c, ex, ey, 2 * p.s, 3 * p.s, tilt); c.fill();
    }
    c.fillStyle = lin(c, p.x - w / 2, 0, p.x + w / 2, 0, [[0, "#FFFFFF"], [0.5, "#EEEAE3"], [1, "#C9C3B8"]]);
    c.beginPath(); c.roundRect(p.x - w / 2, p.y - h, w, h, [1.5 * p.s, 1.5 * p.s, 3 * p.s, 3 * p.s]); c.fill();
  }
  { // a little pot of herbs
    const p = at(-24, 26), w = 8 * p.s, h = 7 * p.s; foot(p.x, p.y, w);
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 2.2, l = (6 + rnd() * 6) * p.s; c.fillStyle = i % 2 ? "#6E9A5A" : "#83AE6B"; ell(c, p.x + Math.cos(a) * l * 0.5, p.y - h - 2 * p.s + Math.sin(a) * l * 0.6, 2.2 * p.s, 3.6 * p.s, a + Math.PI / 2); c.fill(); }
    c.fillStyle = lin(c, p.x - w / 2, 0, p.x + w / 2, 0, [[0, "#D88E68"], [1, "#A6603F"]]); c.beginPath(); c.roundRect(p.x - w / 2, p.y - h, w, h, 1.5 * p.s); c.fill();
  }
  { // a steel kettle with a spout and a handle
    const p = at(54, 34), w = 17 * p.s, h = 13 * p.s; foot(p.x, p.y, w);
    c.strokeStyle = "#2E3640"; c.lineWidth = 1.6 * p.s; c.beginPath(); c.arc(p.x, p.y - h, w * 0.32, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    c.fillStyle = "#AEB7C1"; c.beginPath(); c.moveTo(p.x - w * 0.42, p.y - h * 0.5); c.lineTo(p.x - w * 0.75, p.y - h * 0.95); c.lineTo(p.x - w * 0.68, p.y - h * 1.02); c.lineTo(p.x - w * 0.3, p.y - h * 0.72); c.fill();
    c.fillStyle = lin(c, p.x - w / 2, 0, p.x + w / 2, 0, [[0, "#8D97A2"], [0.25, "#F2F5F8"], [0.55, "#B9C2CC"], [1, "#6E7884"]]);
    c.beginPath(); c.moveTo(p.x - w / 2, p.y); c.bezierCurveTo(p.x - w / 2, p.y - h * 0.8, p.x - w * 0.3, p.y - h, p.x, p.y - h); c.bezierCurveTo(p.x + w * 0.3, p.y - h, p.x + w / 2, p.y - h * 0.8, p.x + w / 2, p.y); c.closePath(); c.fill();
  }
  // the counter's front edge
  const edgeTop = cab(counterZ).y, edgeBot = cab(counterZ - 3.5).y;
  c.fillStyle = lin(c, 0, edgeTop, 0, edgeBot, [[0, "#FBFAF7"], [1, "#CFCCC6"]]); c.fillRect(0, edgeTop, BW, edgeBot - edgeTop);
  // the cabinets: deep blue shaker doors with a frame and a recessed panel, dark in the gaps
  const doorTop = cab(counterZ - 4).y, kick = cab(FLOOR + 10).y, floorY = cab(FLOOR).y, cs = cab(0).s;
  c.fillStyle = "#1F2A37"; c.fillRect(0, edgeBot, BW, kick - edgeBot + 1);                         // the gaps and the shadow under the counter
  c.fillStyle = "#18212C"; c.fillRect(0, kick, BW, floorY - kick);                                 // the toe kick
  const doorW = 40 * cs, gap = 0.8 * cs, stile = 6 * cs, x0 = BW / 2 - doorW * 3 - gap * 2.5;
  for (let k = 0; k < 7; k++) {
    const x = x0 + k * (doorW + gap), y = doorTop, h = kick - doorTop;
    c.fillStyle = lin(c, x, 0, x + doorW, 0, [[0, "#5B7491"], [0.5, "#526A86"], [1, "#475D77"]]); c.fillRect(x, y, doorW, h);
    // the recessed panel: a shadow along its top and left, a lit edge on the bottom and right
    const px = x + stile, py = y + stile, pw = doorW - stile * 2, ph = h - stile * 2;
    c.fillStyle = lin(c, 0, py, 0, py + ph, [[0, "#4D6481"], [1, "#465C77"]]); c.fillRect(px, py, pw, ph);
    c.fillStyle = "rgba(15,25,40,0.4)"; c.fillRect(px, py, pw, 1.2 * cs); c.fillRect(px, py, 1.2 * cs, ph);
    c.fillStyle = "rgba(255,255,255,0.14)"; c.fillRect(px, py + ph - 0.8 * cs, pw, 0.8 * cs); c.fillRect(px + pw - 0.8 * cs, py, 0.8 * cs, ph);
    c.fillStyle = "rgba(255,255,255,0.1)"; c.fillRect(x, y, doorW, 0.7 * cs); c.fillRect(x, y, 0.6 * cs, h);
    // a brass knob by the top inner corner
    const kx = k % 2 ? x + stile * 0.5 : x + doorW - stile * 0.5, ky = y + 9 * cs, kr = 1.3 * cs;
    c.fillStyle = "rgba(10,10,10,0.35)"; ell(c, kx + kr * 0.35, ky + kr * 0.45, kr, kr); c.fill();
    c.fillStyle = rad(c, kx - kr * 0.3, ky - kr * 0.3, 0, kr, [[0, "#FFF0C2"], [0.5, "#D6A94E"], [1, "#8C6420"]]); ell(c, kx, ky, kr, kr); c.fill();
  }
  // warm light falling across the doors from the top left, fading down toward the table
  c.fillStyle = lin(c, 0, doorTop, BW, kick, [[0, "rgba(255,220,170,0.16)"], [0.5, "rgba(255,220,170,0.04)"], [1, "rgba(0,0,0,0.12)"]]); c.fillRect(0, doorTop, BW, kick - doorTop);
  // the floor in front of the cabinets darkens toward them
  c.fillStyle = lin(c, 0, floorY, 0, floorY + 40, [[0, "rgba(40,25,10,0.45)"], [1, "rgba(40,25,10,0)"]]); c.fillRect(0, floorY, BW, 40);
}

/** The walnut table top: five planks running away from you, with flowing grain, pores, the odd cathedral figure and
 *  butt joint, an oiled sheen and a bright rounded edge. */
function paintTable(c: C, cam: Cam, rnd: Rnd) {
  const n = 5, pw = TW / n;
  c.save(); quad(c, cam, -TW / 2, -2, TW / 2, TL, 0); c.clip();
  for (let j = 0; j < n; j++) {
    const x0 = -TW / 2 + j * pw, x1 = x0 + pw, base = WALNUT[j % WALNUT.length];
    const far = P(cam, 0, TL, 0).y, near = cam.BH;
    c.fillStyle = lin(c, 0, far, 0, near, [[0, lighter(base, 0.06)], [0.5, base], [1, darker(base, 0.1)]]);
    quad(c, cam, x0, -2, x1, TL + 1, 0); c.fill();
    c.save(); quad(c, cam, x0, -2, x1, TL + 1, 0); c.clip();
    // grain: long lines that wander, thin far away and fuller up close (drawn in three lengths)
    const lines = 16;
    for (let g = 0; g < lines; g++) {
      const gx = x0 + ((g + rnd() * 0.8) / lines) * pw, a1 = 0.2 + rnd() * 0.55, l1 = 18 + rnd() * 30, ph = rnd() * TAU, a2 = rnd() * 0.25, l2 = 5 + rnd() * 6;
      const light = rnd() < 0.2, alpha = light ? 0.05 + rnd() * 0.07 : 0.07 + rnd() * 0.16;
      c.strokeStyle = light ? `rgba(255,214,165,${alpha})` : `rgba(${GRAIN},${alpha})`;
      const fx = (y: number) => Math.max(x0 + 0.3, Math.min(x1 - 0.3, gx + Math.sin(y / l1 + ph) * a1 + Math.sin(y / l2 + ph * 2) * a2));
      const w0 = 0.3 + rnd() * 0.9;
      for (const [ya, yb] of [[-2, 50], [50, 110], [110, TL + 1]]) { c.lineWidth = w0 * P(cam, 0, (ya + yb) / 2, 0).s * 0.16; strokeAlong(c, cam, fx, ya, yb, 0, 2.5); }
    }
    // pores: short dark ticks along the grain
    for (let q = 0; q < 170; q++) {
      const x = x0 + rnd() * pw, y = rnd() * TL, a = P(cam, x, y, 0), b = P(cam, x, y + 0.6 + rnd() * 1.4, 0);
      c.strokeStyle = `rgba(${GRAIN},${0.12 + rnd() * 0.16})`; c.lineWidth = a.s * 0.09;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    }
    // a cathedral figure: nested arches up the plank
    if (rnd() < 0.8) {
      const fx = x0 + pw * (0.3 + rnd() * 0.4), fy = 20 + rnd() * (TL - 50), span = 2.5 + rnd() * 2;
      for (let k = 0; k < 6; k++) {
        const off = k * 1.1 + 0.6; c.strokeStyle = `rgba(${GRAIN},${0.08 + rnd() * 0.07})`; c.lineWidth = P(cam, 0, fy, 0).s * 0.12;
        c.beginPath();
        for (let i = 0; i <= 16; i++) { const t = -1 + i / 8, p = P(cam, fx + t * (span + off), fy - off * 2.2 + t * t * (off * 2.8 + 5), 0); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }
        c.stroke();
      }
    }
    // a butt joint across some planks
    if (rnd() < 0.55) {
      const y = 30 + rnd() * (TL - 60), a = P(cam, x0, y, 0), b = P(cam, x1, y, 0);
      c.strokeStyle = `rgba(${GRAIN},0.55)`; c.lineWidth = a.s * 0.16; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      c.strokeStyle = "rgba(255,225,190,0.16)"; c.lineWidth = a.s * 0.1; c.beginPath(); c.moveTo(a.x, a.y + a.s * 0.14); c.lineTo(b.x, b.y + a.s * 0.14); c.stroke();
    }
    c.restore();
    // the seam between planks
    if (j > 0) {
      c.strokeStyle = `rgba(${GRAIN},0.6)`; c.lineWidth = 0.9; strokeAlong(c, cam, () => x0, -2, TL, 0, 20);
      c.strokeStyle = "rgba(255,226,190,0.16)"; c.lineWidth = 0.6; strokeAlong(c, cam, () => x0 + 0.25, -2, TL, 0, 20);
    }
  }
  // an oiled sheen: a broad soft band from the top left
  const far = P(cam, 0, TL, 0).y;
  c.fillStyle = lin(c, 0, far, BW, cam.BH, [[0, "rgba(255,240,215,0.16)"], [0.25, "rgba(255,240,215,0.05)"], [0.45, "rgba(255,240,215,0.1)"], [0.6, "rgba(255,240,215,0)"]]);
  c.fillRect(0, far, BW, cam.BH - far);
  c.restore();
  // the rounded edge: a bright lip just inside, a dark line outside
  const fl = P(cam, -TW / 2, TL, 0), fr = P(cam, TW / 2, TL, 0), nl = P(cam, -TW / 2, -2, 0), nr = P(cam, TW / 2, -2, 0);
  c.lineJoin = "round";
  c.strokeStyle = "rgba(25,12,4,0.65)"; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(nl.x, nl.y); c.lineTo(fl.x, fl.y); c.lineTo(fr.x, fr.y); c.lineTo(nr.x, nr.y); c.stroke();
  c.strokeStyle = "rgba(255,222,180,0.42)"; c.lineWidth = 1.1;
  const fl2 = P(cam, -TW / 2 + 0.6, TL - 0.6, 0), fr2 = P(cam, TW / 2 - 0.6, TL - 0.6, 0), nl2 = P(cam, -TW / 2 + 0.6, -2, 0), nr2 = P(cam, TW / 2 - 0.6, -2, 0);
  c.beginPath(); c.moveTo(nl2.x, nl2.y); c.lineTo(fl2.x, fl2.y); c.lineTo(fr2.x, fr2.y); c.lineTo(nr2.x, nr2.y); c.stroke();
}

/** A woven seagrass placemat under a triangle (world rectangle), with a bound edge and a soft shadow on the table. */
function paintMat(c: C, cam: Cam, x0: number, y0: number, x1: number, y1: number, rnd: Rnd) {
  // the shadow it lays on the table, down and to the right
  c.save(); c.fillStyle = "rgba(30,12,2,0.28)"; quad(c, cam, x0 + 0.6, y0 - 0.9, x1 + 0.9, y1 - 0.4, 0); c.fill(); c.restore();
  c.fillStyle = "#C9AD7D"; quad(c, cam, x0, y0, x1, y1, 0); c.fill();
  c.save(); quad(c, cam, x0, y0, x1, y1, 0); c.clip();
  // rows of twisted seagrass strands across the mat (each a little rounded: lit along the top, shaded underneath),
  // bound by thin threads that run down it every few centimetres
  const rowH = 1.15;
  for (let y = y0; y < y1; y += rowH) {
    const a = P(cam, 0, y, 0), b = P(cam, 0, y + rowH, 0), tone = mix("#C7AB7B", "#D6BD8F", rnd());
    c.fillStyle = lin(c, 0, b.y, 0, a.y, [[0, lighter(tone, 0.16)], [0.45, tone], [1, darker(tone, 0.2)]]);
    quad(c, cam, x0, y, x1, y + rowH, 0); c.fill();
    for (let k = 0; k < 10; k++) {   // the twist: short slanted marks along the strand
      const x = x0 + rnd() * (x1 - x0), p = P(cam, x, y + rowH * 0.5, 0), w = 0.5 * p.s;
      c.strokeStyle = `rgba(110,80,40,${0.12 + rnd() * 0.12})`; c.lineWidth = 0.08 * p.s;
      c.beginPath(); c.moveTo(p.x - w * 0.5, p.y - (b.y - a.y) * -0.35); c.lineTo(p.x + w * 0.5, p.y + (b.y - a.y) * -0.35); c.stroke();
    }
  }
  for (let x = x0 + 2.8; x < x1 - 1; x += 3.6) {   // the binding threads
    c.strokeStyle = "rgba(95,68,32,0.32)"; c.lineWidth = 0.75; strokeAlong(c, cam, () => x, y0, y1, 0, 6);
    c.strokeStyle = "rgba(255,240,210,0.18)"; c.lineWidth = 0.4; strokeAlong(c, cam, () => x + 0.25, y0, y1, 0, 6);
  }
  c.restore();
  // the bound edge
  const e = 1.4;
  c.fillStyle = "#9D7A47";
  quad(c, cam, x0, y0, x1, y0 + e, 0); c.fill(); quad(c, cam, x0, y1 - e, x1, y1, 0); c.fill();
  quad(c, cam, x0, y0, x0 + e, y1, 0); c.fill(); quad(c, cam, x1 - e, y0, x1, y1, 0); c.fill();
  c.strokeStyle = "rgba(255,240,205,0.35)"; c.lineWidth = 0.7;
  const p = (x: number, y: number) => P(cam, x, y, 0);
  const a = p(x0 + e, y1 - e), b = p(x1 - e, y1 - e), d = p(x1 - e, y0 + e), f = p(x0 + e, y0 + e);
  c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.lineTo(f.x, f.y); c.closePath(); c.stroke();
}

/** Where the table is on the board, for clipping a berry that's dropped off the edge. */
export function tablePath(c: C, cam: Cam) { quad(c, cam, -TW / 2, -60, TW / 2, TL, 0); }

/** The room, the table and the two mats, at k device pixels per board unit. */
export function paintScene(cam: Cam, k: number) {
  const L = layer(BW, cam.BH, k), c = L.c, rnd = seeded(0xbe77e);
  const soft = layer(BW, cam.BH, Math.max(0.5, k * 0.42));        // painted small: scaled up, it's softly out of focus
  paintRoom(soft.c, cam, seeded(0x51ce));
  c.imageSmoothingEnabled = true; c.drawImage(soft.cv, 0, 0, BW, cam.BH);
  paintTable(c, cam, rnd);
  const mx = 27, back = BACK + 9, front = BACK - 2 * ROW - 10.5;
  paintMat(c, cam, -mx, front, mx, back, rnd);                   // theirs, far
  paintMat(c, cam, -mx, TL - back, mx, TL - front, rnd);        // yours, near
  return L.cv;
}

/** Warm light from the top left and a soft vignette, drawn over everything each frame. */
export function paintLight(cam: Cam, k: number) {
  const L = layer(BW, cam.BH, Math.max(0.5, k * 0.5));
  warmLight(L.c, BW, cam.BH, { pool: 0.2, dark: 0.36, lx: BW * 0.12, ly: cam.BH * 0.12 });
  return L.cv;
}

// ── bowls ──────────────────────────────────────────────────────────────────
export type Sprite = { cv: HTMLCanvasElement; x: number; y: number; w: number; h: number };
export type BowlArt = { body: Sprite; shadow: Sprite; ax: number; ay: number; rim: Pt; milk: { x: number; y: number; rx: number; ry: number }; rx: number; ry: number };
const MILK = 1.5;   // milk sits this far under the rim

/** The bits of a bowl's shape on the board (its rim, its milk, its foot), for drawing and for the splash. */
export function bowlGeo(cam: Cam, wx: number, wy: number) {
  const top = P(cam, wx, wy, H), base = P(cam, wx, wy, 0), m = P(cam, wx, wy, H - MILK), s = top.s;
  const kr = flat(wy, H), kb = flat(wy, 0), km = flat(wy, H - MILK);
  const rm = (R - 0.9) * m.s;
  return { top, base, s, rx: R * s, ry: R * s * kr, fx: FOOT * base.s, fy: FOOT * base.s * kb, milk: { x: m.x, y: m.y, rx: rm, ry: rm * km }, kr, km };
}

/** One bowl, painted once: a glazed body in its colour with a white stripe, a white rim, milk with oat rings floating. */
export function bowlArt(cam: Cam, k: number, wx: number, wy: number, glaze: Glaze, seed: number): BowlArt {
  const g = bowlGeo(cam, wx, wy), { top, base, rx, ry, fx, fy, milk } = g;
  const rnd = seeded(seed);
  const pad = rx * 0.7, x = top.x - rx - pad, y = top.y - ry - 4, w = rx * 2 + pad * 2, h = base.y + fy + pad * 0.6 - y;
  const B = layer(w, h, k), c = B.c;
  c.translate(-x, -y);
  // the body: from the rim's ends down a soft curve to the foot, round the front of the foot, and back up
  const cx = top.x, cy = top.y, by = base.y;
  // the foot is a short ring under the bowl: the wall curves in and flattens out onto the top of it
  const ft = P(cam, wx, wy, 0.7), fty = ft.y, ffy = FOOT * ft.s * flat(wy, 0.7);
  const body = () => {
    c.beginPath(); c.moveTo(cx - rx, cy);
    c.bezierCurveTo(cx - rx * 1.02, cy + (fty - cy) * 0.55, cx - fx - (rx - fx) * 0.45, fty + ffy * 0.9, cx - fx, fty + ffy * 0.55);
    c.ellipse(cx, fty, fx, ffy, 0, Math.PI * 0.82, Math.PI * 0.18, true);
    c.bezierCurveTo(cx + fx + (rx - fx) * 0.45, fty + ffy * 0.9, cx + rx * 1.02, cy + (fty - cy) * 0.55, cx + rx, cy);
    c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI, false);
    c.closePath();
  };
  // the foot ring first (the body sits on it)
  c.beginPath(); c.ellipse(cx, by, fx, fy, 0, Math.PI, 0, true); c.lineTo(cx + fx, fty); c.ellipse(cx, fty, fx, ffy, 0, 0, Math.PI, false); c.closePath();
  c.fillStyle = lin(c, cx - fx, 0, cx + fx, 0, [[0, glaze.lo], [0.3, glaze.mid], [1, glaze.deep]]); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 0.35 * base.s; c.beginPath(); c.ellipse(cx, by, fx * 0.98, fy * 0.98, 0, Math.PI * 0.55, Math.PI * 0.95); c.stroke();
  body();
  c.fillStyle = lin(c, cx - rx, 0, cx + rx, 0, [[0, glaze.mid], [0.18, glaze.hi], [0.42, glaze.mid], [0.8, glaze.lo], [1, glaze.deep]]); c.fill();
  c.save(); body(); c.clip();
  c.fillStyle = lin(c, 0, cy, 0, by + fy, [[0, "rgba(255,255,255,0.18)"], [0.35, "rgba(255,255,255,0)"], [0.75, "rgba(20,30,60,0.12)"], [1, "rgba(20,30,60,0.32)"]]); c.fillRect(cx - rx * 1.2, cy, rx * 2.4, by + fy - cy + 2);
  // a white stripe round the outside, a little under the rim
  const st = P(cam, wx, wy, H - 1.9), sk = flat(wy, H - 1.9), sr = (R - 0.22) * st.s;
  c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 0.4 * st.s;
  c.beginPath(); c.ellipse(st.x, st.y, sr, sr * sk, 0, 0.05, Math.PI - 0.05); c.stroke();
  // a glossy streak on the lit side
  gloss(c, cx - rx * 0.55, cy + (by - cy) * 0.42, rx * 0.16, (by - cy) * 0.36, 0.7, 0.12);
  c.restore();
  // inside: white glaze, darker on the left (the left wall shades it), the milk, the oat rings
  const lip = 0.55 * top.s, irx = rx - lip * 0.6, iry = ry - lip * 0.6 * g.kr;
  c.save(); ell(c, cx, cy, irx, iry); c.clip();
  c.fillStyle = lin(c, cx - irx, 0, cx + irx, 0, [[0, "#D9DDE4"], [0.45, "#F4F5F7"], [1, "#FFFFFF"]]); c.fillRect(cx - rx, cy - ry, rx * 2, ry * 2 + 4);
  c.fillStyle = rad(c, milk.x, milk.y, milk.rx * 0.1, milk.rx * 1.05, [[0, "#FFFEFB"], [0.7, "#FBF8F1"], [1, "#E8EBEE"]]);
  ell(c, milk.x, milk.y, milk.rx, milk.ry); c.fill();
  // oat rings floating
  const n = 7 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, d = Math.sqrt(rnd()) * (R - 2.1), o = P(cam, wx + Math.cos(a) * d, wy + Math.sin(a) * d, H - MILK + 0.12);
    const orr = (0.62 + rnd() * 0.14) * o.s, oy = orr * g.km * (0.8 + rnd() * 0.4), rot = (rnd() - 0.5) * 0.8;
    c.fillStyle = "rgba(120,110,95,0.22)"; ell(c, o.x + orr * 0.15, o.y + oy * 0.35, orr * 1.05, oy * 1.05, rot); c.fill();
    c.strokeStyle = mix("#D59A45", "#E7B866", rnd()); c.lineWidth = orr * 0.62;
    c.beginPath(); c.ellipse(o.x, o.y, orr * 0.72, oy * 0.72, rot, 0, TAU); c.stroke();
    c.strokeStyle = "rgba(150,85,20,0.45)"; c.lineWidth = orr * 0.18;
    c.beginPath(); c.ellipse(o.x, o.y, orr * 0.72, oy * 0.72, rot, 0.2, Math.PI * 0.95); c.stroke();
    c.strokeStyle = "rgba(255,240,200,0.7)"; c.lineWidth = orr * 0.16;
    c.beginPath(); c.ellipse(o.x, o.y, orr * 0.8, oy * 0.8, rot, Math.PI * 1.1, Math.PI * 1.7); c.stroke();
  }
  // the left wall's shadow on the milk, and a soft shine from the window
  c.save(); ell(c, milk.x, milk.y, milk.rx, milk.ry); c.clip();
  c.fillStyle = lin(c, milk.x - milk.rx, 0, milk.x - milk.rx * 0.2, 0, [[0, "rgba(70,80,100,0.2)"], [1, "rgba(70,80,100,0)"]]); c.fillRect(milk.x - milk.rx, milk.y - milk.ry, milk.rx, milk.ry * 2);
  c.restore();
  gloss(c, milk.x - milk.rx * 0.32, milk.y - milk.ry * 0.38, milk.rx * 0.34, milk.ry * 0.22, 0.75, 0);
  c.restore();
  // the rim: a white lip, bright on the front left, with a fine edge each side
  c.strokeStyle = lin(c, cx - rx, 0, cx + rx, 0, [[0, "#FFFFFF"], [0.6, "#F3F5F8"], [1, "#DCE1E8"]]); c.lineWidth = lip;
  c.beginPath(); c.ellipse(cx, cy, rx - lip / 2, ry - (lip / 2) * g.kr, 0, 0, TAU); c.stroke();
  c.strokeStyle = rgba(glaze.deep, 0.35); c.lineWidth = 0.6; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, TAU); c.stroke();
  c.strokeStyle = "rgba(110,120,140,0.25)"; c.lineWidth = 0.5; c.beginPath(); c.ellipse(cx, cy, rx - lip, ry - lip * g.kr, 0, 0, TAU); c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineWidth = lip * 0.5; c.lineCap = "round";
  c.beginPath(); c.ellipse(cx, cy, rx - lip / 2, ry - (lip / 2) * g.kr, 0, Math.PI * 0.62, Math.PI * 1.02); c.stroke();
  c.beginPath(); c.ellipse(cx, cy, rx - lip / 2, ry - (lip / 2) * g.kr, 0, Math.PI * 1.55, Math.PI * 1.75); c.stroke();
  // its shadow, separate so it can fade when the bowl lifts away
  const sw = rx * 3, sh = rx * 1.6, sx = base.x - sw / 2 + rx * 0.15, sy = base.y - sh / 2 + fy * 0.25;
  const S = layer(sw, sh, k), sc = S.c; sc.translate(-sx, -sy);
  sc.fillStyle = rad(sc, base.x + rx * 0.18, base.y + fy * 0.3, 0, rx * 1.2, [[0, "rgba(30,14,4,0.38)"], [0.55, "rgba(30,14,4,0.14)"], [1, "rgba(30,14,4,0)"]]);
  sc.save(); sc.translate(base.x + rx * 0.18, base.y + fy * 0.3); sc.scale(1, g.kr * 1.15); sc.translate(-(base.x + rx * 0.18), -(base.y + fy * 0.3));
  ell(sc, base.x + rx * 0.18, base.y + fy * 0.3, rx * 1.2, rx * 1.2); sc.fill(); sc.restore();
  sc.fillStyle = rad(sc, base.x + fx * 0.1, base.y + fy * 0.15, fx * 0.4, fx * 1.25, [[0, "rgba(25,10,2,0.5)"], [1, "rgba(25,10,2,0)"]]);
  ell(sc, base.x + fx * 0.1, base.y + fy * 0.15, fx * 1.3, fy * 1.35); sc.fill();
  return { body: { cv: B.cv, x, y, w, h }, shadow: { cv: S.cv, x: sx, y: sy, w: sw, h: sh }, ax: base.x, ay: base.y, rim: top, milk, rx, ry };
}

// ── the berry ──────────────────────────────────────────────────────────────
/** The front berry of the blueberry emoji, cut out once (with a little extra shading at the bottom right). */
export function berrySprite(img: HTMLImageElement, k: number, size: number) {
  const L = layer(size, size, k), c = L.c, r = size / 2;
  c.save(); ell(c, r, r, r, r); c.clip();
  const src = 40.5;   // the front berry: centred at (47, 111) in the 160 x 160 image, 41 px across the middle
  c.drawImage(img, 47 - src, 111 - src, src * 2, src * 2, 0, 0, size, size);
  c.fillStyle = rad(c, r * 0.7, r * 0.6, r * 0.3, r * 1.1, [[0, "rgba(10,10,40,0)"], [0.75, "rgba(10,10,40,0)"], [1, "rgba(10,10,40,0.25)"]]); c.fillRect(0, 0, size, size);
  c.restore();
  return L.cv;
}
/** A soft glowing blob for the On Fire flames, white-hot in the middle (hot) or orange to red (warm). */
export function flameSprite(k: number, hot: boolean) {
  const L = layer(32, 32, k), c = L.c;
  c.fillStyle = rad(c, 16, 16, 0, 16, hot ? [[0, "rgba(255,255,230,1)"], [0.3, "rgba(255,226,120,0.9)"], [0.65, "rgba(255,140,40,0.45)"], [1, "rgba(255,90,20,0)"]]
    : [[0, "rgba(255,190,80,0.95)"], [0.45, "rgba(255,110,40,0.6)"], [1, "rgba(220,50,30,0)"]]);
  c.fillRect(0, 0, 32, 32);
  return L.cv;
}

/** The first-flick hint on the board: the shared WhatYouAte hint pill (../hint), chevrons nudging down. */
export function drawHint(c: C, cx: number, y: number, label: string, t: number, _font?: string, _w?: number) {
  void _font; void _w;
  drawSharedHint(c as CanvasRenderingContext2D, cx, y, label, t, "down");
}
