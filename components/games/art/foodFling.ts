// Food Fling's board art: a park on a sunny afternoon (the sun up in the top left, soft clouds drifting, hazy hills
// and a tree line, a mown lawn), sturdy wooden plinths for the shelves, crates and boards with real grain and bevels,
// glazed tiles under the junk, a turned-wood slingshot with a stretchy rubber band, and calm dust puffs with a few
// splinters when junk gets knocked off. Still things are painted once (the sky, the land, each level's shelves, each
// piece's look); per frame it's a handful of stamps.
import { type C, type Layer, type Rnd, TAU, rr, circ, ell, line, lin, rad, shade, noShade, mix, lighter, darker, rgba, mulberry, layerCache, put, putAt, planks, sheen, bevel, gloss } from "./paint";

export type Shelf = { x: number; w: number; top: number; ledge: boolean };
type Piece = { kind: "junk" | "crate" | "plank" | "fruit"; w: number; h: number; type: number };

const cache = layerCache();
const OAK = ["#c98f55", "#bf8549", "#d39b60", "#b67a42", "#c88b51"];
const PINE = ["#e2b77c", "#d9ab6e", "#e8c08a", "#d3a465", "#dfb378"];

// ── the sky and the land ──
function paintSky(c: C, W: number, H: number) {
  c.fillStyle = lin(c, 0, 0, 0, H * 0.82, [[0, "#6fa9e6"], [0.45, "#a9cff2"], [0.8, "#e4f0f8"], [1, "#fbf1dc"]]); c.fillRect(0, 0, W, H);
  // the sun, top left, and its warm haze
  c.fillStyle = rad(c, 58, 64, 0, 360, [[0, "rgba(255,246,214,0.95)"], [0.08, "rgba(255,236,190,0.6)"], [0.3, "rgba(255,226,170,0.2)"], [1, "rgba(255,220,160,0)"]]); c.fillRect(0, 0, W, H);
  c.fillStyle = rad(c, 58, 64, 0, 26, [[0, "#fffef6"], [0.7, "#fff6d8"], [1, "rgba(255,240,200,0)"]]); circ(c, 58, 64, 26); c.fill();
}
/** A soft cumulus: a stack of round puffs, lit on top from the left, shaded grey-blue underneath. */
function cloud(c: C, x: number, y: number, s: number, rnd: Rnd) {
  const puffs: number[][] = [];
  const n = 6 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) { const t = i / (n - 1); puffs.push([x + (t - 0.5) * 120 * s + (rnd() - 0.5) * 10 * s, y - Math.sin(t * Math.PI) * 18 * s - rnd() * 8 * s, (14 + Math.sin(t * Math.PI) * 16 + rnd() * 6) * s]); }
  c.fillStyle = "rgba(150,178,210,0.35)"; for (const [px, py, r] of puffs) { circ(c, px + 3 * s, py + 5 * s, r); c.fill(); }
  for (const [px, py, r] of puffs) { c.fillStyle = rad(c, px - r * 0.35, py - r * 0.45, r * 0.1, r * 1.1, [[0, "#ffffff"], [0.6, "#f6f9fd"], [1, "#d3e0ee"]]); circ(c, px, py, r); c.fill(); }
  c.fillStyle = lin(c, 0, y - 4 * s, 0, y + 16 * s, [[0, "rgba(196,212,232,0)"], [1, "rgba(176,196,222,0.55)"]]);
  for (const [px, py, r] of puffs) { c.save(); circ(c, px, py, r); c.clip(); c.fillRect(px - r, y - 4 * s, r * 2, 40 * s); c.restore(); }
}
function paintClouds(c: C, w: number) {
  const rnd = mulberry(812);
  for (const [x, y, a] of [[60, 40, 0.5], [300, 190, 0.35], [520, 30, 0.4]]) {   // high wisps
    c.fillStyle = rad(c, x, y, 0, 90, [[0, `rgba(255,255,255,${a})`], [1, "rgba(255,255,255,0)"]]); ell(c, x, y, 90, 8, -0.06); c.fill();
    if (x < 160) { c.fillStyle = rad(c, x + w, y, 0, 90, [[0, `rgba(255,255,255,${a})`], [1, "rgba(255,255,255,0)"]]); ell(c, x + w, y, 90, 8, -0.06); c.fill(); }
  }
  cloud(c, 120, 110, 0.9, rnd); cloud(c, 330, 70, 0.62, rnd); cloud(c, 440, 205, 0.42, rnd); cloud(c, 560, 96, 0.75, rnd); cloud(c, 250, 250, 0.36, rnd);
  cloud(c, 120 + w, 110, 0.9, mulberry(812));   // the first one again past the end, so the strip wraps
}
/** A hill line from summed waves. */
function ridge(c: C, W: number, base: number, amp: number, f: number, ph: number, bottom: number) {
  c.beginPath(); c.moveTo(-2, bottom);
  for (let x = -2; x <= W + 2; x += 4) c.lineTo(x, base - (Math.sin(x * f + ph) * 0.6 + Math.sin(x * f * 2.3 + ph * 1.7) * 0.3 + Math.sin(x * f * 5.1 + ph) * 0.1) * amp);
  c.lineTo(W + 2, bottom); c.closePath();
}
function tree(c: C, x: number, y: number, s: number, rnd: Rnd, haze: number, tall = 1) {
  const leaf = mix("#4f8f3a", "#a9c6b8", haze), lit = mix("#9bd06a", "#d2e4d6", haze), deep = mix("#2f6127", "#8eaaa0", haze), bark = mix("#6b4a2e", "#a3aca6", haze);
  c.fillStyle = rgba(deep, 0.35); ell(c, x + 6 * s, y + 1.5, 16 * s, 3 * s); c.fill();
  c.fillStyle = bark; rr(c, x - 2.2 * s, y - 20 * s, 4.4 * s, 21 * s, 1.5 * s); c.fill();
  const blobs: number[][] = [], n = 6 + Math.floor(rnd() * 4), cy = y - 34 * s * tall;
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rnd(); blobs.push([x + Math.cos(a) * (9 + rnd() * 5) * s, cy + Math.sin(a) * (9 + rnd() * 4) * s * tall, (8 + rnd() * 6) * s]); }
  blobs.push([x + (rnd() - 0.5) * 4 * s, cy - 6 * s * tall, 12 * s]);
  for (const [bx, by, r] of blobs) { c.fillStyle = deep; circ(c, bx + 1.5 * s, by + 2 * s, r); c.fill(); }
  for (const [bx, by, r] of blobs) { c.fillStyle = rad(c, bx - r * 0.4, by - r * 0.45, r * 0.1, r * 1.15, [[0, lit], [0.55, leaf], [1, deep]]); circ(c, bx, by, r); c.fill(); }
  for (let i = 0; i < 30 * s; i++) { const a = rnd() * TAU, d = rnd() * 20 * s; c.fillStyle = rnd() < 0.5 ? rgba(lit, 0.5) : rgba(deep, 0.35); circ(c, x + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9 * tall, (1 + rnd() * 1.6) * s); c.fill(); }
}
function conifer(c: C, x: number, y: number, s: number, rnd: Rnd, haze: number) {
  const lit = mix("#6fae55", "#c9dccf", haze), deep = mix("#2b5a2a", "#8aa79c", haze);
  c.fillStyle = mix("#5a3e26", "#a3aca6", haze); c.fillRect(x - 1.5 * s, y - 8 * s, 3 * s, 8 * s);
  for (let i = 0; i < 4; i++) {
    const ty = y - 8 * s - i * 11 * s, hw = (15 - i * 3) * s;
    c.fillStyle = lin(c, x - hw, 0, x + hw, 0, [[0, lit], [0.5, mix(lit, deep, 0.4)], [1, deep]]);
    c.beginPath(); c.moveTo(x - hw, ty); c.quadraticCurveTo(x, ty + 3 * s, x + hw, ty); c.lineTo(x + rnd() * s, ty - 17 * s); c.closePath(); c.fill();
  }
}
/** A far wooded ridge: canopies packed close, softened by haze. */
function forest(c: C, W: number, base: number, rnd: Rnd, haze: number) {
  const deep = mix("#3d7034", "#a9c2bd", haze), lit = mix("#8cc463", "#d6e6dd", haze);
  c.fillStyle = deep; c.fillRect(-2, base - 6, W + 4, 40);
  for (let x = -10; x < W + 10; x += 5 + rnd() * 6) {
    const r = 6 + rnd() * 8, y = base - 4 - rnd() * 8 - Math.sin(x / 60) * 4;
    if (rnd() < 0.12) { c.fillStyle = lin(c, x - 4, 0, x + 4, 0, [[0, lit], [1, deep]]); ell(c, x, y - r, r * 0.55, r * 1.6); c.fill(); continue; }   // a poplar
    c.fillStyle = rad(c, x - r * 0.4, y - r * 0.5, 0, r * 1.2, [[0, lit], [0.6, mix(lit, deep, 0.5)], [1, deep]]); circ(c, x, y, r); c.fill();
  }
}
function paintLand(c: C, W: number, H: number, FLOOR: number, Y0: number) {
  const rnd = mulberry(3301);
  c.translate(0, -Y0);
  // far hills in the haze, a wooded ridge, then nearer greener hills with a few trees on them
  ridge(c, W, 440, 34, 0.009, 0.4, FLOOR); c.fillStyle = lin(c, 0, 400, 0, 470, [[0, "#bfd6e2"], [1, "#d3e2df"]]); c.fill();
  ridge(c, W, 456, 20, 0.013, 2.3, FLOOR); c.save(); c.clip(); forest(c, W, 470, rnd, 0.58); c.restore();
  ridge(c, W, 486, 18, 0.008, 4.1, FLOOR); c.fillStyle = lin(c, 0, 462, 0, 520, [[0, "#9cc983"], [1, "#86b86c"]]); c.fill();
  ridge(c, W, 486, 18, 0.008, 4.1, FLOOR); c.save(); c.clip();
  c.fillStyle = lin(c, 0, 460, W, 520, [[0, "rgba(255,240,200,0.25)"], [0.5, "rgba(255,240,200,0)"]]); c.fillRect(0, 440, W, 120);
  for (let i = 0; i < 260; i++) { c.fillStyle = rnd() < 0.5 ? "rgba(70,120,50,0.18)" : "rgba(200,235,160,0.18)"; c.fillRect(rnd() * W, 466 + rnd() * 90, 1.2, 1.2); }
  c.restore();
  conifer(c, 136, 496, 0.7, rnd, 0.3); tree(c, 168, 500, 0.55, rnd, 0.32); tree(c, 262, 494, 0.5, rnd, 0.36, 1.2); conifer(c, 318, 490, 0.62, rnd, 0.34); tree(c, 372, 498, 0.72, rnd, 0.26);
  tree(c, -4, 522, 0.75, rnd, 0.14);
  ridge(c, W, 528, 10, 0.012, 2.2, FLOOR + 1); c.fillStyle = lin(c, 0, 515, 0, FLOOR, [[0, "#7fbf5c"], [1, "#6aac4b"]]); c.fill();
  // the lawn: mown stripes running away from you, blades along its back edge, a few daisies
  const vx = W * 0.5, vy = FLOOR - 160;
  c.save(); c.beginPath(); c.rect(0, FLOOR, W, H - FLOOR); c.clip();
  c.fillStyle = lin(c, 0, FLOOR, 0, H, [[0, "#78bf55"], [0.5, "#68b047"], [1, "#58993c"]]); c.fillRect(0, FLOOR, W, H - FLOOR);
  for (let i = -6; i < 12; i++) {
    const xa = i * 52, xb = xa + 52, t = (FLOOR - H) / (vy - H), ta = xa + (vx - xa) * t, tb = xb + (vx - xb) * t;
    if (i % 2) { c.fillStyle = "rgba(255,255,220,0.08)"; c.beginPath(); c.moveTo(xa, H); c.lineTo(xb, H); c.lineTo(tb, FLOOR); c.lineTo(ta, FLOOR); c.closePath(); c.fill(); }
  }
  for (let i = 0; i < 900; i++) { const x = rnd() * W, y = FLOOR + rnd() * (H - FLOOR); c.strokeStyle = rnd() < 0.55 ? "rgba(40,90,25,0.28)" : "rgba(200,240,150,0.3)"; c.lineWidth = 0.7; line(c, x, y, x + (rnd() - 0.5) * 2, y - 2 - rnd() * 3); }
  c.restore();
  for (let i = 0; i < 520; i++) {   // blades standing up along the back edge of the lawn
    const x = rnd() * W, h = 3 + rnd() * 7, lean = (rnd() - 0.4) * 3;
    c.strokeStyle = rnd() < 0.5 ? "#5ea33f" : rnd() < 0.5 ? "#8fd066" : "#4b8c33"; c.lineWidth = 0.9 + rnd() * 0.6; c.lineCap = "round";
    c.beginPath(); c.moveTo(x, FLOOR + 3); c.quadraticCurveTo(x + lean * 0.3, FLOOR - h * 0.5, x + lean, FLOOR + 2 - h); c.stroke();
  }
  for (let i = 0; i < 16; i++) {   // daisies
    const x = rnd() * W, y = FLOOR + 6 + rnd() * (H - FLOOR - 10);
    for (let p = 0; p < 5; p++) { const a = (p / 5) * TAU; c.fillStyle = "rgba(255,255,255,0.92)"; circ(c, x + Math.cos(a) * 1.6, y + Math.sin(a) * 1.6, 1.1); c.fill(); }
    c.fillStyle = "#f2c230"; circ(c, x, y, 0.9); c.fill();
  }
}
function paintLight(c: C, W: number, H: number) {
  c.fillStyle = rad(c, W * 0.15, H * 0.1, 10, H * 0.9, [[0, "rgba(255,232,180,0.16)"], [0.45, "rgba(255,232,180,0.04)"], [1, "rgba(255,232,180,0)"]]); c.fillRect(0, 0, W, H);
  c.fillStyle = rad(c, W * 0.5 + 20, H * 0.42, H * 0.36, H * 0.82, [[0, "rgba(20,30,10,0)"], [1, "rgba(20,30,10,0.32)"]]); c.fillRect(0, 0, W, H);
}

const LAND_Y = 400;
/** The still scene behind everything, with the clouds drifting slowly across. */
export function drawPark(c: C, W: number, H: number, FLOOR: number, t: number) {
  put(c, cache.get(c, "sky", W, H, cc => paintSky(cc, W, H), 0.4));
  const CW = 640, clouds = cache.get(c, "clouds", CW + 220, 290, cc => paintClouds(cc, CW), 0.6), off = (t * 0.0035) % CW;
  put(c, clouds, -off, 0); if (CW - off < W) put(c, clouds, CW - off, 0);
  put(c, cache.get(c, "land", W, H - LAND_Y, cc => paintLand(cc, W, H, FLOOR, LAND_Y)), 0, LAND_Y);
}
/** The light over the whole board: warm from the top left, a soft vignette at the edges. */
export function drawParkLight(c: C, W: number, H: number) { put(c, cache.get(c, "light", W, H, cc => paintLight(cc, W, H), 0.35)); }

// ── shelves ──
function plinth(c: C, x: number, top: number, w: number, bottom: number, rnd: Rnd) {
  const h = bottom - top;
  c.fillStyle = "rgba(30,50,15,0.4)"; ell(c, x + w / 2 + 6, bottom - 2, w / 2 + 10, 7); c.fill();   // where it stands on the grass
  shade(c, 10, 4, 6, "rgba(40,30,10,0.35)"); c.fillStyle = "#8a5a2c"; c.fillRect(x, top, w, h); noShade(c);
  c.save(); c.beginPath(); c.rect(x, top, w, h); c.clip();
  planks(c, x, top + 6, x + w, bottom, rnd, OAK, "70,36,8", [15, 5], false);
  c.fillStyle = lin(c, x, 0, x + w, 0, [[0, "rgba(255,236,200,0.18)"], [0.35, "rgba(255,236,200,0)"], [1, "rgba(50,24,4,0.28)"]]); c.fillRect(x, top, w, h);
  c.restore();
  for (const px of [x, x + w - 6]) {   // corner posts
    c.fillStyle = lin(c, px, 0, px + 6, 0, [[0, "#b07a43"], [0.4, "#d3a067"], [1, "#7d4e24"]]); c.fillRect(px, top + 4, 6, h - 4);
    c.fillStyle = "rgba(60,30,8,0.35)"; c.fillRect(px + (px === x ? 6 : -0.8), top + 4, 0.8, h - 4);
    for (let ny = top + 14; ny < bottom - 6; ny += 26) { c.fillStyle = "#5b5f66"; circ(c, px + 3, ny, 1.1); c.fill(); c.fillStyle = "rgba(255,255,255,0.6)"; circ(c, px + 2.7, ny - 0.4, 0.45); c.fill(); }
  }
  // the top board: lit along its face, a crisp dark line under its edge (the line junk has to fall below)
  c.fillStyle = lin(c, 0, top, 0, top + 7, [[0, "#f0c58c"], [0.35, "#d79e5f"], [1, "#9a6331"]]); c.fillRect(x, top, w, 7);
  c.fillStyle = "rgba(255,246,226,0.85)"; c.fillRect(x, top, w, 1.2);
  c.fillStyle = "rgba(60,28,6,0.7)"; c.fillRect(x, top + 6.4, w, 1.4);
  c.fillStyle = lin(c, 0, top + 7.8, 0, top + 16, [[0, "rgba(50,24,4,0.4)"], [1, "rgba(50,24,4,0)"]]); c.fillRect(x, top + 7.8, w, 8);
  c.strokeStyle = "rgba(60,30,8,0.6)"; c.lineWidth = 1; c.strokeRect(x + 0.5, top + 0.5, w - 1, h - 1);
}
function ledge(c: C, W: number, top: number, w: number, rnd: Rnd) {
  // a tree trunk at the edge of the board holds the ledge up
  const tx = W - 16;
  c.save(); c.beginPath(); c.rect(tx - 6, 0, 40, 620); c.clip();
  shade(c, 12, -3, 0, "rgba(30,20,10,0.35)"); c.fillStyle = "#6b4a2e"; c.fillRect(tx, -10, 30, 640); noShade(c);
  c.fillStyle = lin(c, tx, 0, tx + 22, 0, [[0, "#5a3c22"], [0.3, "#8a6440"], [0.6, "#6e4d30"], [1, "#4a3018"]]); c.fillRect(tx, -10, 30, 640);
  for (let i = 0; i < 70; i++) { const y = rnd() * 600, x = tx + 2 + rnd() * 16; c.strokeStyle = rnd() < 0.6 ? "rgba(35,20,8,0.45)" : "rgba(200,160,120,0.25)"; c.lineWidth = 0.8 + rnd(); c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + 2, y + 10, x - 2, y + 20, x + 1, y + 30 + rnd() * 20); c.stroke(); }
  c.restore();
  const x = W - w;
  c.fillStyle = "#5b6068"; c.beginPath(); c.moveTo(tx, top + 14); c.lineTo(tx, top + 50); c.lineTo(tx - 34, top + 14); c.closePath(); c.fill();   // a steel bracket
  c.fillStyle = lin(c, tx - 34, top + 14, tx, top + 50, [[0, "#c9d0d8"], [1, "#6c7682"]]); c.beginPath(); c.moveTo(tx, top + 16); c.lineTo(tx, top + 46); c.lineTo(tx - 28, top + 16); c.closePath(); c.fill();
  c.fillStyle = "#2b2f35"; circ(c, tx - 4, top + 24, 1.3); c.fill(); circ(c, tx - 4, top + 38, 1.3); c.fill();
  shade(c, 8, 3, 5, "rgba(40,30,10,0.4)"); c.fillStyle = "#9a6331"; c.fillRect(x, top, w, 14); noShade(c);
  c.save(); c.beginPath(); c.rect(x, top, w, 14); c.clip(); planks(c, x - 20, top, W + 20, top + 14, rnd, OAK, "70,36,8", [14, 1], false); c.restore();
  c.fillStyle = "rgba(255,246,226,0.85)"; c.fillRect(x, top, w, 1.2);
  c.fillStyle = "rgba(60,28,6,0.7)"; c.fillRect(x, top + 6.4, w, 1.4);
  c.fillStyle = lin(c, 0, top + 8, 0, top + 14, [[0, "rgba(50,24,4,0.1)"], [1, "rgba(50,24,4,0.45)"]]); c.fillRect(x, top + 8, w, 6);
  c.fillStyle = lin(c, x, 0, x + 12, 0, [[0, "#7a4a20"], [1, "rgba(122,74,32,0)"]]); c.fillRect(x, top, 12, 14);   // the end grain
}
/** One level's shelves, painted once when the level starts. */
export function drawShelves(c: C, key: string, shelves: Shelf[], W: number, H: number, FLOOR: number) {
  const top = shelves.some(s => s.ledge) ? 0 : Math.min(...shelves.map(s => s.top)) - 20;   // a ledge's tree trunk runs the full height
  put(c, cache.get(c, `lv${key}`, W, H - top, cc => {
    cc.translate(0, -top); const rnd = mulberry(key.length * 977 + shelves.length * 131 + Math.round(shelves[0]?.top ?? 0));
    for (const s of shelves) if (s.ledge) ledge(cc, W, s.top, s.w, rnd); else plinth(cc, s.x - s.w / 2, s.top, s.w, FLOOR + 6, rnd);
  }), 0, top);
}
export function dropLevel(key: string) { cache.drop(`lv${key}`); }

// ── the pieces ──
function crate(c: C, w: number, h: number) {
  const rnd = mulberry(77), x = -w / 2, y = -h / 2, f = 5;
  c.fillStyle = "#7a4a22"; rr(c, x, y, w, h, 3); c.fill();
  c.save(); rr(c, x, y, w, h, 3); c.clip();
  planks(c, x, y, x + w, y + h, rnd, PINE, "92,50,14", [w / 3 - 0.5, 0.01], false);
  c.fillStyle = "rgba(60,30,8,0.25)"; c.fillRect(x + f, y + f, w - 2 * f, h - 2 * f);   // the boards inside sit back a little
  c.save(); c.translate(0, 0); c.rotate(-Math.atan2(h - 2 * f, w - 2 * f));   // the brace across
  c.fillStyle = "rgba(40,20,4,0.3)"; c.fillRect(-w * 0.62, -2.2, w * 1.24, 5.6);
  c.fillStyle = lin(c, 0, -3, 0, 3, [[0, "#f1cb94"], [0.5, "#dcae72"], [1, "#b27c44"]]); c.fillRect(-w * 0.62, -3, w * 1.24, 6);
  c.restore();
  for (const [fx, fy, fw, fh] of [[x, y, w, f], [x, y + h - f, w, f], [x, y, f, h], [x + w - f, y, f, h]]) {   // the frame
    c.fillStyle = lin(c, fx, fy, fx + fw, fy + fh, [[0, "#ecc48c"], [1, "#c18949"]]); c.fillRect(fx, fy, fw, fh);
  }
  c.strokeStyle = "rgba(70,36,8,0.55)"; c.lineWidth = 0.8; c.strokeRect(x + f, y + f, w - 2 * f, h - 2 * f);
  for (const [nx, ny] of [[x + 2.5, y + 2.5], [x + w - 2.5, y + 2.5], [x + 2.5, y + h - 2.5], [x + w - 2.5, y + h - 2.5]]) { c.fillStyle = "#4a4e55"; circ(c, nx, ny, 0.9); c.fill(); c.fillStyle = "rgba(255,255,255,0.7)"; circ(c, nx - 0.3, ny - 0.3, 0.35); c.fill(); }
  c.restore();
  bevel(c, x, y, w, h, 3, 0.9);
  c.strokeStyle = "rgba(70,36,8,0.7)"; c.lineWidth = 0.8; rr(c, x + 0.4, y + 0.4, w - 0.8, h - 0.8, 3); c.stroke();
}
function board(c: C, w: number, h: number) {
  const rnd = mulberry(Math.round(w * 13 + h)), x = -w / 2, y = -h / 2, along = w >= h;
  c.save(); rr(c, x, y, w, h, 2); c.clip();
  if (along) planks(c, x, y, x + w, y + h + 4, rnd, OAK, "80,40,10", [h + 4, 0.01], false);
  else { c.save(); c.translate(x, y + h); c.rotate(-Math.PI / 2); planks(c, 0, 0, h, w + 4, rnd, OAK, "80,40,10", [w + 4, 0.01], false); c.restore(); }
  const L = along ? w : h;
  for (const e of [0, 1]) {   // end grain at each end
    const ex = along ? x + e * (w - 3) : x, ey = along ? y : y + e * (h - 3), ew = along ? 3 : w, eh = along ? h : 3;
    c.fillStyle = "rgba(90,48,14,0.45)"; c.fillRect(ex, ey, ew, eh);
  }
  if (L > 30) sheen(c, x, y, x + w, y + h, 0.12);
  c.restore();
  bevel(c, x, y, w, h, 2, 0.95);
  c.strokeStyle = "rgba(80,40,10,0.6)"; c.lineWidth = 0.7; rr(c, x + 0.35, y + 0.35, w - 0.7, h - 0.7, 2); c.stroke();
}
function tile(c: C, w: number, h: number) {
  const x = -w / 2, y = -h / 2;
  c.fillStyle = lin(c, x, y, x + w, y + h, [[0, "#fff1f3"], [0.5, "#ffd6dd"], [1, "#f0a9b6"]]); rr(c, x, y, w, h, 7); c.fill();
  c.fillStyle = rad(c, 0, 0, 0, w * 0.55, [[0, "rgba(255,255,255,0.5)"], [1, "rgba(255,255,255,0)"]]); rr(c, x + 3, y + 3, w - 6, h - 6, 5); c.fill();
  bevel(c, x, y, w, h, 7, 1);
  gloss(c, x + 7, y + 6, 6, 3, 0.7);
  c.strokeStyle = "rgba(190,90,110,0.55)"; c.lineWidth = 0.9; rr(c, x + 0.45, y + 0.45, w - 0.9, h - 0.9, 7); c.stroke();
}
/** A soft shadow the shape of a piece, to stamp just below and right of it. */
function silhouette(c: C, w: number, h: number, r: number, round: boolean) {
  const k = 1000; c.shadowColor = "rgba(30,24,8,0.42)"; c.shadowBlur = 5 * (c.getTransform().a || 1); c.shadowOffsetX = k * (c.getTransform().a || 1);
  c.fillStyle = "#000"; if (round) circ(c, -k, 0, w / 2); else rr(c, -k - w / 2, -h / 2, w, h, r); c.fill(); noShade(c);
}
export function drawPieceShadow(c: C, p: Piece, x: number, y: number, ang: number) {
  const round = p.kind === "fruit", key = `ps${p.kind}${Math.round(p.w)}x${Math.round(p.h)}`;
  const L = cache.get(c, key, p.w + 14, p.h + 14, cc => { cc.translate(p.w / 2 + 7, p.h / 2 + 7); silhouette(cc, p.w, p.h, p.kind === "junk" ? 7 : p.kind === "crate" ? 3 : 2, round); });
  putAt(c, L, x + 2.2, y + 3.6, ang);
}
export function drawPiece(c: C, p: Piece, x: number, y: number, ang: number) {
  const key = `pc${p.kind}${Math.round(p.w)}x${Math.round(p.h)}`;
  const L: Layer = cache.get(c, key, p.w + 2, p.h + 2, cc => { cc.translate(p.w / 2 + 1, p.h / 2 + 1); if (p.kind === "crate") crate(cc, p.w, p.h); else if (p.kind === "junk") tile(cc, p.w, p.h); else board(cc, p.w, p.h); });
  putAt(c, L, x, y, ang);
}
/** A soft round shadow on the grass under a fruit (smaller and fainter the higher it flies). */
export function drawGroundShadow(c: C, x: number, r: number, height: number, FLOOR: number) {
  const k = Math.max(0, 1 - height / 300); if (k <= 0.02) return;
  c.fillStyle = rad(c, x + 3, FLOOR + 2, 0, r * 1.2, [[0, `rgba(30,50,15,${0.4 * k})`], [1, "rgba(30,50,15,0)"]]); ell(c, x + 3, FLOOR + 2, r * 1.2 * (0.6 + 0.4 * k), r * 0.4 * (0.6 + 0.4 * k)); c.fill();
}

// ── the slingshot ──
function forkLimb(c: C, x0: number, y0: number, x1: number, y1: number, w0: number) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l, w = w0;
  c.lineCap = "round";
  c.strokeStyle = lin(c, x0 + nx * w, y0 + ny * w, x0 - nx * w, y0 - ny * w, [[0, "#6e3f1a"], [0.25, "#c88a4c"], [0.45, "#ecb87e"], [0.7, "#a86a34"], [1, "#5c3312"]]);
  if (Math.abs(dx) > Math.abs(dy) * 0.2) c.strokeStyle = lin(c, x0 - w, y0 - w, x0 + w, y0 + w, [[0, "#ecb87e"], [0.45, "#b97a3e"], [1, "#5c3312"]]);
  c.lineWidth = w * 2; line(c, x0, y0, x1, y1);
  c.lineWidth = 0.6;
  for (let i = 0; i < 4; i++) { const o = (i / 3 - 0.5) * 1.2 * w; c.strokeStyle = `rgba(70,34,8,${0.16 + (i % 2) * 0.12})`; line(c, x0 + nx * o, y0 + ny * o + 2, x1 + nx * o, y1 + ny * o); }
  c.strokeStyle = "rgba(255,240,215,0.5)"; c.lineWidth = 0.9; line(c, x0 - w * 0.42, y0 - w * 0.12 + 2, x1 - w * 0.42, y1 - w * 0.12);
}
/** The slingshot's back half (handle and right arm) and front half (left arm), at rest positions. */
export function drawSlingBack(c: C, sx: number, sy: number, FLOOR: number) {
  const L = cache.get(c, "slingB", 80, FLOOR - sy + 60, cc => {
    cc.translate(40 - sx, 20 - sy);
    cc.fillStyle = "rgba(30,50,15,0.4)"; ell(cc, sx + 6, FLOOR + 2, 16, 4.5); cc.fill();
    shade(cc, 6, 3, 4, "rgba(30,20,8,0.35)");
    forkLimb(cc, sx, FLOOR + 2, sx, sy + 34, 5.2); forkLimb(cc, sx, sy + 36, sx + 14, sy - 6, 4.4); noShade(cc);
    forkLimb(cc, sx, FLOOR + 2, sx, sy + 34, 5.2); forkLimb(cc, sx, sy + 36, sx + 14, sy - 6, 4.4);
    for (let y = FLOOR - 40; y < FLOOR - 6; y += 3.4) {   // a leather grip, wrapped round the handle
      cc.fillStyle = lin(cc, sx - 6, 0, sx + 6, 0, [[0, "#2e1a0e"], [0.4, "#7a4a2a"], [1, "#24140a"]]); cc.beginPath(); cc.moveTo(sx - 5.8, y); cc.lineTo(sx + 5.8, y + 1.4); cc.lineTo(sx + 5.8, y + 4); cc.lineTo(sx - 5.8, y + 2.6); cc.closePath(); cc.fill();
      cc.strokeStyle = "rgba(255,220,180,0.25)"; cc.lineWidth = 0.5; line(cc, sx - 5.5, y + 0.3, sx + 5.5, y + 1.7);
    }
    cc.fillStyle = lin(cc, sx - 6, 0, sx + 6, 0, [[0, "#8a6a2a"], [0.4, "#f2d58a"], [1, "#7a5a1a"]]); rr(cc, sx - 5.6, sy + 30, 11.2, 4, 1.2); cc.fill();   // a brass ring where the arms meet
    cc.fillStyle = "#3a2210"; rr(cc, sx + 14 - 4.2, sy - 6 + 2, 8.4, 5, 1.5); cc.fill();   // the band's binding on the tip
  });
  put(c, L, sx - 40, sy - 20);
}
export function drawSlingFront(c: C, sx: number, sy: number) {
  const L = cache.get(c, "slingF", 50, 72, cc => {
    cc.translate(30 - sx, 20 - sy);
    shade(cc, 6, 3, 4, "rgba(30,20,8,0.35)"); forkLimb(cc, sx, sy + 36, sx - 14, sy - 6, 4.4); noShade(cc);
    forkLimb(cc, sx, sy + 36, sx - 14, sy - 6, 4.4);
    cc.fillStyle = "#3a2210"; rr(cc, sx - 14 - 4.2, sy - 6 + 2, 8.4, 5, 1.5); cc.fill();
    cc.fillStyle = "rgba(255,230,190,0.35)"; rr(cc, sx - 14 - 3.6, sy - 6 + 2.4, 7, 1, 0.5); cc.fill();
  });
  put(c, L, sx - 30, sy - 20);
}
/** One rubber band from a fork tip to the pouch: thick at rest, thinner as it stretches. */
export function drawBand(c: C, x0: number, y0: number, x1: number, y1: number, stretch: number) {
  const w = 4.6 - Math.min(1, stretch) * 1.9;
  c.lineCap = "round";
  c.strokeStyle = "#5a1f12"; c.lineWidth = w + 1.2; line(c, x0, y0, x1, y1);
  c.strokeStyle = "#9b3a22"; c.lineWidth = w; line(c, x0, y0, x1, y1);
  c.strokeStyle = "rgba(255,190,160,0.45)"; c.lineWidth = Math.max(0.6, w * 0.25); line(c, x0, y0 - w * 0.25, x1, y1 - w * 0.25);
}
/** The leather pouch the fruit sits in. */
export function drawPouch(c: C, x: number, y: number, r: number, ang: number) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.fillStyle = "#3e2412"; ell(c, 0, 0, r * 0.55, r * 1.05); c.fill();
  c.fillStyle = lin(c, -r * 0.5, 0, r * 0.5, 0, [[0, "#5a361c"], [0.5, "#8a5a32"], [1, "#4a2a14"]]); ell(c, 0, 0, r * 0.45, r * 0.95); c.fill();
  c.restore();
}
/** A fruit with a soft shadow on whatever's behind it. */
export function drawFruit(c: C, img: HTMLImageElement, x: number, y: number, s: number, ang = 0) {
  if (!img.complete || !img.naturalWidth) return;
  if (ang) { c.save(); c.translate(x, y); c.rotate(ang); c.drawImage(img, -s / 2, -s / 2, s, s); c.restore(); }
  else c.drawImage(img, x - s / 2, y - s / 2, s, s);
}

// ── effects ──
/** Where junk got knocked off: a calm puff of dust, a few crumbs and splinters. `k` runs 0 to 1. */
export function drawPoof(c: C, x: number, y: number, k: number, seed: number) {
  if (k >= 1) return;
  const rnd = mulberry(seed), e = 1 - (1 - k) * (1 - k);
  c.save();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + rnd() * 0.6, d = 6 + 20 * e * (0.7 + rnd() * 0.5), r = (7 + rnd() * 5) * (0.6 + e * 0.8);
    c.globalAlpha = Math.max(0, 0.62 * (1 - k));
    c.fillStyle = rad(c, x + Math.cos(a) * d, y + Math.sin(a) * d - 8 * e, 0, r, [[0, "rgba(255,250,240,0.95)"], [0.6, "rgba(240,228,210,0.55)"], [1, "rgba(230,215,195,0)"]]); circ(c, x + Math.cos(a) * d, y + Math.sin(a) * d - 8 * e, r); c.fill();
  }
  c.globalAlpha = Math.max(0, 1 - k * 1.1);
  for (let i = 0; i < 5; i++) {   // splinters
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6, sp = 26 + rnd() * 26, px = x + Math.cos(a) * sp * e, py = y + Math.sin(a) * sp * e + 70 * k * k;
    c.save(); c.translate(px, py); c.rotate(rnd() * TAU + k * 6 * (rnd() < 0.5 ? 1 : -1));
    c.fillStyle = rnd() < 0.5 ? "#c9955a" : "#e7bd85"; c.fillRect(-3.4, -0.8, 6.8, 1.6); c.fillStyle = "rgba(90,48,14,0.6)"; c.fillRect(-3.4, 0.3, 6.8, 0.5);
    c.restore();
  }
  for (let i = 0; i < 4; i++) {   // crumbs
    const a = rnd() * TAU, sp = 14 + rnd() * 18, px = x + Math.cos(a) * sp * e, py = y + Math.sin(a) * sp * e + 50 * k * k;
    c.fillStyle = rnd() < 0.5 ? "#f2b3bd" : "#ffe08a"; circ(c, px, py, 1.6 * (1 - k * 0.5)); c.fill();
  }
  c.restore();
}
/** Words on the board with a soft halo, so they read over the sky, the trees and the grass. */
export function haloText(c: C, text: string, x: number, y: number, fill: string, halo = "rgba(255,255,255,0.85)", width = 4) {
  c.lineJoin = "round"; c.strokeStyle = halo; c.lineWidth = width; c.strokeText(text, x, y);
  c.fillStyle = fill; c.fillText(text, x, y);
}
export { lighter, darker };
