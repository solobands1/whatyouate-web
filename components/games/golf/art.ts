// The drawings for Kitchen Golf. Each place in the kitchen (counter, table, fridge, sink, floor, stove, island,
// cupboard) has its scenery, a putting surface in a real material, and a thick rounded rail lit from the top left;
// everything is lit by a warm (or, in the fridge, cold) pool of light from the top left that falls off into a vignette.
// The still parts of a hole are painted once into canvases (`paintHole`); the moving parts, the flag and the balls are
// drawn every frame. Props, zones, cups and tees are in ./props, the materials in ./materials.
import { type Course, type Part, type Pt, BALL_R, MIXER_W, PIN_R, DOOR_W, W, burnerLit, mulberry32 } from "./sim";
import { type C, type Imgs, type Rnd, TAU, poly, rr, circ, line, lin, rad, shade, noShade, mix, darker, bbox, signOf, grow, setTint, tint, STEEL } from "./draw";
import { planks, sheen, butcherBlock, marble, granite, brushedSteel, blackGlass, frostedGlass, glossyTiles, subway, paintedWood, cabinetDoors } from "./materials";
import { drawBump, drawBlock, drawZone, drawCup, drawTee, drawTube, drawGroundDeco, drawSurfaceDeco, drawTopDeco, drawOverDeco } from "./props";

export const FOOD_IMGS = ["1f34e", "1f34a", "1f34b", "1f350", "1f9c0", "1f96c", "1f345", "1f966", "1f955", "1f95a"];

// ── rails ──
type RailLook = { T: number; base: string; light: string; dark: string; grain?: boolean };
/** The edge you bounce off: a chunky rounded rail just outside the surface (so the ball meets its face), each side lit
 *  by which way it faces, mitred at the corners, throwing its shadow on the scenery. T must stay under half the
 *  narrowest gap between walls (the sink's divider is 20 wide). */
function rails(c: C, out: Pt[], L: RailLook, rnd: Rnd) {
  const { T, base, light, dark } = L, n = out.length, sg = signOf(out), LX = -Math.SQRT1_2, LY = -Math.SQRT1_2, edge = darker(dark, 0.4);
  const G = grow(out, T);
  const ring = () => { c.beginPath(); G.forEach(([x, y], i) => { if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.closePath(); out.forEach(([x, y], i) => { if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.closePath(); };
  ring(); shade(c, 12, 4, 7, tint(0.5)); c.fillStyle = base; c.fill("evenodd"); noShade(c);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, [ax, ay] = out[i], [bx, by] = out[j], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy); if (len < 1) continue;
    const nx = (sg * dy) / len, ny = (-sg * dx) / len, f = nx * LX + ny * LY;
    const tone = (v: number) => (v > 0 ? mix(base, light, Math.min(1, v * 1.15)) : mix(base, dark, Math.min(1, -v * 1.15)));
    c.save(); c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.lineTo(G[j][0], G[j][1]); c.lineTo(G[i][0], G[i][1]); c.closePath(); c.clip();
    c.fillStyle = lin(c, ax, ay, ax + nx * T, ay + ny * T, [[0, tone(-f)], [0.2, mix(base, light, 0.25)], [0.42, mix(base, light, 0.55)], [0.6, mix(base, light, 0.2)], [1, tone(f)]]);
    c.fillRect(Math.min(ax, bx, G[i][0], G[j][0]) - 1, Math.min(ay, by, G[i][1], G[j][1]) - 1, Math.abs(bx - ax) + T * 2 + 2, Math.abs(by - ay) + T * 2 + 2);
    if (L.grain) for (let g = 0; g < 6; g++) {
      const o = T * (0.1 + rnd() * 0.8), wob = rnd() * TAU; c.strokeStyle = `rgba(52,22,4,${0.08 + rnd() * 0.12})`; c.lineWidth = 0.4 + rnd() * 0.6; c.beginPath();
      for (let s = -T; s <= len + T; s += 8) { const w2 = o + Math.sin(s / 23 + wob) * 0.6, px = ax + (dx / len) * s + nx * w2, py = ay + (dy / len) * s + ny * w2; if (s === -T) c.moveTo(px, py); else c.lineTo(px, py); }
      c.stroke();
    }
    c.strokeStyle = "rgba(255,255,255,0.4)"; c.lineWidth = 1.1; line(c, ax - (dx / len) * T + nx * T * 0.42, ay - (dy / len) * T + ny * T * 0.42, bx + (dx / len) * T + nx * T * 0.42, by + (dy / len) * T + ny * T * 0.42);
    c.restore();
    c.strokeStyle = "rgba(0,0,0,0.22)"; c.lineWidth = 0.6; line(c, out[i][0], out[i][1], G[i][0], G[i][1]);   // the mitre joint
  }
  c.strokeStyle = edge; c.lineWidth = 1.3; c.beginPath(); G.forEach(([x, y], i) => { if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.closePath(); c.stroke();
  c.save(); poly(c, out); c.clip(); c.lineCap = "round";   // its inside face, a sliver on the surface: lit bottom and right, shaded top and left
  for (let i = 0; i < n; i++) {
    const [ax, ay] = out[i], [bx, by] = out[(i + 1) % n], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy); if (len < 1) continue;
    const f = ((sg * dy) / len) * LX + ((-sg * dx) / len) * LY;
    c.strokeStyle = f < 0 ? `rgba(255,255,255,${0.55 * -f})` : `rgba(0,0,0,${0.32 * f})`; c.lineWidth = 3.4; line(c, ax, ay, bx, by);
  }
  c.restore();
  c.strokeStyle = edge; c.lineWidth = 1; poly(c, out); c.stroke();
}
/** On the surface: a soft dark edge all round, and the rail's shadow along the top and left. */
function edgeShade(c: C, out: Pt[], h: number, a: number) {
  c.save(); poly(c, out); c.clip();
  c.beginPath(); c.rect(-60, -60, W + 120, h + 120); out.forEach(([x, y], i) => { if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.closePath(); c.fillStyle = "#000";
  shade(c, 9, 0, 0, tint(a * 0.8)); c.fill("evenodd"); shade(c, 11, 5, 7, tint(a)); c.fill("evenodd"); noShade(c);
  c.restore();
}
/** The light over everything: a pool from the top left that falls off into a vignette. */
function light(c: C, k: Course, mode: "warm" | "cool" | "neutral", strength: number) {
  const big = Math.max(W, k.h), lx = W * 0.18, ly = Math.min(k.h * 0.14, 110);
  const pool = mode === "warm" ? "255,214,150" : mode === "cool" ? "215,238,255" : "255,248,232", dark = mode === "warm" ? "34,12,0" : mode === "cool" ? "8,24,48" : "10,12,18";
  c.fillStyle = rad(c, lx, ly, 10, big * 0.85, [[0, `rgba(${pool},${strength})`], [0.4, `rgba(${pool},${strength * 0.28})`], [1, `rgba(${pool},0)`]]); c.fillRect(0, 0, W, k.h);
  c.fillStyle = rad(c, lx + 40, ly + 60, big * 0.45, big * 1.1, [[0, `rgba(${dark},0)`], [1, `rgba(${dark},${mode === "warm" ? 0.46 : 0.4})`]]); c.fillRect(0, 0, W, k.h);
}

// ── the places ──
type Box = [number, number, number, number];
type Place = {
  tint: string;                                      // what colour shadows go on this surface
  light: "warm" | "cool" | "neutral";
  rail: RailLook;
  edge: number;                                      // how dark the surface gets at its rail
  pool: number;                                      // how bright the light pool from the top left is
  slab?: boolean;                                    // a raised top (a table, the island) with a big shadow on the floor
  scene: (c: C, k: Course, rnd: Rnd) => void;        // everything round the hole (and under it)
  surface?: (c: C, k: Course, b: Box, rnd: Rnd) => void;   // the putting surface, clipped to the hole
};
const WALNUT = ["#a9592a", "#944b21", "#b8652f", "#86411c", "#9f5326", "#b05f2c"];
const OAK = ["#c99560", "#bd8854", "#d4a06a", "#b47e4b", "#c6915c"];
const MAPLE = ["#ecc78f", "#e3ba80", "#f1cf9a", "#ddb277", "#e8c288"];
function counterScene(c: C, k: Course, rnd: Rnd, top = 168, edgeY = 552) {
  subway(c, 0, 0, W, top, rnd);
  butcherBlock(c, 0, top - 8, W, edgeY, rnd);
  c.fillStyle = lin(c, 0, top - 8, 0, top + 6, [[0, "rgba(40,22,6,0.45)"], [1, "rgba(40,22,6,0)"]]); c.fillRect(0, top - 8, W, 14);
  c.fillStyle = lin(c, 0, edgeY - 2, 0, edgeY + 14, [[0, "#f3c78e"], [0.3, "#d29358"], [0.75, "#9a5f2e"], [1, "#6e4018"]]); c.fillRect(0, edgeY - 2, W, 16);
  c.fillStyle = "rgba(255,244,222,0.75)"; c.fillRect(0, edgeY - 1, W, 1.2);
  cabinetDoors(c, 0, edgeY + 14, W, k.h + 2, "#93b29a", 4);
  c.fillStyle = lin(c, 0, edgeY + 14, 0, edgeY + 30, [[0, "rgba(30,18,6,0.5)"], [1, "rgba(30,18,6,0)"]]); c.fillRect(0, edgeY + 14, W, 16);
}
function floorScene(c: C, k: Course, rnd: Rnd) {
  glossyTiles(c, 0, 0, W, k.h, 40, "#f3ebdd", "#ddd0bb", "#a89a84", rnd);
  for (const [x0, x1] of [[0, 54], [W - 54, W]]) {   // the cabinets each side: oak doors with recessed panels and a knob
    c.save(); c.beginPath(); c.rect(x0, 0, x1 - x0, k.h); c.clip(); planks(c, x0, 0, x1, k.h, rnd, OAK, "70,35,8", { vertical: true, size: [18, 6], joints: false }); c.restore();
    for (let y = 0; y < k.h; y += 120) {
      c.fillStyle = "rgba(60,30,8,0.35)"; c.fillRect(x0, y, x1 - x0, 1.5);
      c.fillStyle = lin(c, x0, y, x1, y + 120, [[0, "rgba(40,20,5,0.25)"], [1, "rgba(255,230,190,0.15)"]]); rr(c, x0 + 8, y + 10, x1 - x0 - 16, 100, 3); c.fill();
      c.strokeStyle = "rgba(255,230,190,0.35)"; c.lineWidth = 1; c.beginPath(); c.moveTo(x1 - 8.5, y + 10.5); c.lineTo(x1 - 8.5, y + 110); c.lineTo(x0 + 8.5, y + 110); c.stroke();
      const kx = x0 < W / 2 ? x1 - 14 : x0 + 14; c.fillStyle = "rgba(0,0,0,0.3)"; circ(c, kx + 0.8, y + 61.5, 3.4); c.fill(); c.fillStyle = rad(c, kx - 1, y + 59, 0.4, 3.4, [[0, "#fff1c0"], [1, "#a8781e"]]); circ(c, kx, y + 60, 3.2); c.fill();
    }
  }
  for (const x of [54, W - 60]) { c.fillStyle = lin(c, x, 0, x + 6, 0, [[0, "#2c2420"], [1, "#4a3c33"]]); c.fillRect(x, 0, 6, k.h); }
}
const PLACES: Record<Course["place"], Place> = {
  counter: {
    tint: "64,32,6", light: "warm", edge: 0.4, pool: 0.18, rail: { T: 12, base: "#b27640", light: "#f2c48c", dark: "#6a3c16", grain: true },
    scene: (c, k, rnd) => counterScene(c, k, rnd),
  },
  table: {
    tint: "48,22,4", light: "warm", edge: 0.42, pool: 0.28, slab: true, rail: { T: 14, base: "#7a401b", light: "#d99257", dark: "#3a1b07", grain: true },
    scene: (c, k, rnd) => glossyTiles(c, 0, 0, W, k.h, 50, "#efe2cc", "#e2d0b3", "#a9967a", rnd),
    surface: (c, k, [x0, y0, x1, y1], rnd) => {
      if (k.zones.some(z => z.look === "flour")) {   // a pastry board, dusted with flour
        planks(c, x0, y0, x1, y1, rnd, MAPLE, "130,80,25", { vertical: true, size: [30, 14], joints: false });
        sheen(c, x0, y0, x1, y1, 0.12);
        for (let i = 0; i < 26; i++) { const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), r = 14 + rnd() * 40; c.fillStyle = rad(c, x, y, 0, r, [[0, `rgba(255,255,255,${0.04 + rnd() * 0.06})`], [1, "rgba(255,255,255,0)"]]); circ(c, x, y, r); c.fill(); }   // a light dusting, well short of the sticky piles
        for (let i = 0; i < (x1 - x0) * (y1 - y0) * 0.006; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.4})`; c.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 0.8, 0.8); }
      } else { planks(c, x0, y0, x1, y1, rnd, WALNUT, "52,22,4"); sheen(c, x0, y0, x1, y1, 0.17); }
    },
  },
  fridge: {
    tint: "40,72,105", light: "cool", edge: 0.38, pool: 0.2, rail: { T: 11, base: "#e6edf3", light: "#ffffff", dark: "#93a6b8" },
    scene: (c, k) => {
      c.fillStyle = lin(c, 0, 0, W, 0, [[0, "#aebdca"], [0.09, "#e9f0f5"], [0.5, "#f9fbfd"], [0.91, "#e9f0f5"], [1, "#aebdca"]]); c.fillRect(0, 0, W, k.h);
      c.fillStyle = lin(c, 0, 0, 0, k.h, [[0, "rgba(255,255,255,0.4)"], [1, "rgba(150,175,195,0.25)"]]); c.fillRect(0, 0, W, k.h);
      for (let y = 30; y < k.h; y += 46) for (const x of [10, W - 22]) { c.fillStyle = "rgba(120,145,165,0.35)"; rr(c, x, y, 12, 3, 1.5); c.fill(); c.fillStyle = "rgba(255,255,255,0.8)"; rr(c, x, y - 1, 12, 1.2, 0.6); c.fill(); }
      for (const y of [118, k.h - 40]) {   // the shelf ledges
        c.fillStyle = "rgba(60,90,120,0.25)"; c.fillRect(16, y + 5, W - 32, 6);
        c.fillStyle = lin(c, 0, y - 3, 0, y + 6, [[0, "#ffffff"], [0.6, "#e3ebf2"], [1, "#b4c4d2"]]); rr(c, 16, y - 3, W - 32, 9, 3); c.fill();
        c.fillStyle = lin(c, 16, 0, W - 16, 0, [[0, "#9aa7b4"], [0.3, "#ffffff"], [0.7, "#d4dce4"], [1, "#9aa7b4"]]); c.fillRect(20, y + 3.6, W - 40, 1.4);
      }
    },
    surface: (c, k, [x0, y0, x1, y1], rnd) => frostedGlass(c, x0, y0, x1, y1, rnd),
  },
  sink: {
    tint: "18,26,38", light: "neutral", edge: 0.6, pool: 0.2, rail: { T: 9, base: "#c3cad2", light: "#ffffff", dark: "#69737e" },
    scene: (c, k, rnd) => granite(c, 0, 0, W, k.h, rnd),
    surface: (c, k, [x0, y0, x1, y1], rnd) => {
      brushedSteel(c, x0, y0, x1, y1, rnd, true);
      for (let i = 0; i < 34; i++) {   // water droplets on the steel
        const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), r = 1.2 + rnd() * rnd() * 3.4;
        c.fillStyle = "rgba(30,40,55,0.25)"; c.beginPath(); c.ellipse(x + r * 0.35, y + r * 0.45, r, r * 0.9, 0, 0, TAU); c.fill();
        c.fillStyle = rad(c, x, y, 0, r, [[0, "rgba(230,240,248,0.25)"], [0.8, "rgba(170,185,200,0.35)"], [1, "rgba(90,105,120,0.55)"]]); c.beginPath(); c.ellipse(x, y, r, r * 0.9, 0, 0, TAU); c.fill();
        c.fillStyle = "rgba(255,255,255,0.95)"; circ(c, x - r * 0.35, y - r * 0.35, r * 0.3); c.fill();
      }
    },
  },
  floor: {
    tint: "58,40,22", light: "warm", edge: 0.38, pool: 0.2, rail: { T: 10, base: "#f0ece5", light: "#ffffff", dark: "#ada597" },
    scene: floorScene,
  },
  stove: {
    tint: "0,0,0", light: "neutral", edge: 0.6, pool: 0.24, rail: { T: 10, base: "#c3cad2", light: "#ffffff", dark: "#5f6974" },
    scene: (c, k, rnd) => {
      brushedSteel(c, 0, 0, W, k.h, rnd);
      blackGlass(c, 0, 0, W, 80, rnd);
      c.fillStyle = lin(c, 0, 78, 0, 84, [[0, "#ffffff"], [1, "#7d8792"]]); c.fillRect(0, 78, W, 4);
      c.fillStyle = lin(c, 0, 82, 0, 96, [[0, "rgba(0,0,0,0.3)"], [1, "rgba(0,0,0,0)"]]); c.fillRect(0, 82, W, 14);
    },
    surface: (c, k, [x0, y0, x1, y1], rnd) => blackGlass(c, x0, y0, x1, y1, rnd),
  },
  island: {
    tint: "70,52,36", light: "warm", edge: 0.36, pool: 0.16, slab: true, rail: { T: 13, base: "#e0d9d0", light: "#ffffff", dark: "#978d81" },
    scene: (c, k, rnd) => { planks(c, 0, 0, W, k.h, rnd, OAK, "80,40,10", { size: [30, 8] }); sheen(c, 0, 0, W, k.h, 0.1); },
    surface: (c, k, [x0, y0, x1, y1], rnd) => marble(c, x0, y0, x1, y1, rnd),
  },
  cupboard: {
    tint: "60,34,10", light: "warm", edge: 0.46, pool: 0.16, rail: { T: 10, base: "#a3bca6", light: "#e6f2e6", dark: "#56705a" },
    scene: (c, k, rnd) => {
      c.save(); c.beginPath(); c.rect(0, 0, W, 452); c.clip(); planks(c, 0, 0, W, 452, rnd, ["#6e4426", "#7a4c2b", "#654023"], "40,18,4", { vertical: true, size: [34, 10], joints: false }); c.restore();
      c.fillStyle = lin(c, 0, 0, W, 0, [[0, "rgba(20,8,0,0.45)"], [0.12, "rgba(20,8,0,0)"], [0.88, "rgba(20,8,0,0)"], [1, "rgba(20,8,0,0.45)"]]); c.fillRect(0, 0, W, 452);
      butcherBlock(c, 0, 452, W, k.h, rnd);
      c.fillStyle = lin(c, 0, 440, 0, 456, [[0, "#c9dccb"], [0.5, "#a3bca6"], [1, "#6e8a72"]]); c.fillRect(0, 442, W, 14);
      c.fillStyle = lin(c, 0, 456, 0, 474, [[0, "rgba(40,20,5,0.4)"], [1, "rgba(40,20,5,0)"]]); c.fillRect(0, 456, W, 18);
    },
    surface: (c, k, [x0, y0, x1], rnd) => {   // the shelf, painted cream (the counter in front is the scene's butcher block)
      paintedWood(c, x0, y0, x1, 446, rnd, "#e9d6b2", 56);
      c.fillStyle = lin(c, 0, 446, 0, 470, [[0, "rgba(40,20,5,0.4)"], [1, "rgba(40,20,5,0)"]]); c.fillRect(x0, 446, x1 - x0, 24);
    },
  },
};

/** The still parts of a hole, drawn once at `scale` pixels per unit: `under` (everything below the balls) and `over`
 *  (things the balls roll under: a faucet, a chair seat, the table above). */
export function paintHole(k: Course, scale: number, imgs: Imgs) {
  const make = () => { const cv = document.createElement("canvas"); cv.width = Math.ceil(W * scale); cv.height = Math.ceil(k.h * scale); const c = cv.getContext("2d")!; c.scale(scale, scale); return { cv, c }; };
  const under = make(), c = under.c, rnd = mulberry32(k.id * 977 + 13), P = PLACES[k.place];
  setTint(P.tint);
  const [x0, y0, x1, y1] = bbox(k.out), mid: Pt = [(x0 + x1) / 2, (y0 + y1) / 2];
  P.scene(c, k, rnd);
  drawGroundDeco(c, k, mid);
  if (P.slab) { shade(c, 28, 10, 18, "rgba(40,22,6,0.55)"); c.fillStyle = darker(P.rail.base, 0.3); poly(c, grow(k.out, P.rail.T)); c.fill(); noShade(c); }
  if (P.surface) { c.save(); poly(c, k.out); c.clip(); P.surface(c, k, [x0, y0, x1, y1], rnd); c.restore(); }
  edgeShade(c, k.out, k.h, P.edge);
  for (const z of k.zones) drawZone(c, z, k, rnd);
  drawSurfaceDeco(c, k);
  drawTee(c, k, rnd); drawCup(c, k);
  rails(c, k.out, P.rail, rnd);
  drawTopDeco(c, k, rnd);
  for (const b of k.blocks) drawBlock(c, b, rnd);
  for (const u of k.bumps) drawBump(c, u, imgs);
  for (const t of k.tubes) drawTube(c, t);
  light(c, k, P.light, P.pool);
  const overs = k.deco.filter(d => d.over);
  let over: HTMLCanvasElement | null = null;
  if (overs.length) { const o = make(); setTint(P.tint); for (const d of overs) drawOverDeco(o.c, d); over = o.cv; }
  return { under: under.cv, over };
}

/** The moving parts at this moment on the hole clock, and the burners' glow. */
export function drawLive(c: C, k: Course, parts: Part[], clock: number, t: number) {
  for (const z of k.zones) if (z.k === "burner") {
    const lit = burnerLit(z, clock), u = (((clock + z.ph) % z.per) + z.per) % z.per;
    const glow = lit ? Math.min(1, u / 20, (z.on - u) / 20 + 0.3) : Math.max(0, 1 - (u - z.on) / 40) * 0.6;
    if (glow <= 0.01) continue;
    const [x, y, R] = z.c, flick = 0.9 + 0.1 * Math.sin(t / 120);
    c.globalAlpha = glow; c.fillStyle = rad(c, x, y, 4, R + 10, [[0, "rgba(255,140,50,0.35)"], [0.7, "rgba(255,70,20,0.18)"], [1, "rgba(255,60,20,0)"]]); circ(c, x, y, R + 10); c.fill();
    c.lineCap = "round"; c.beginPath();
    for (let s = 0; s <= 120; s++) { const q = s / 120, a = q * TAU * 4, d = R * (0.2 + q * 0.7); if (s) c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); else c.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
    c.strokeStyle = `rgba(255,${Math.round(80 * flick)},30,0.95)`; c.lineWidth = 3; c.stroke();
    c.strokeStyle = `rgba(255,${Math.round(200 * flick)},120,0.8)`; c.lineWidth = 1; c.stroke();
    c.globalAlpha = 1;
  }
  for (const p of parts) {
    if (p.k === "mixer") {   // the stand mixer's beater, sweeping round its hub
      const nx = -(p.by - p.ay), ny = p.bx - p.ax, nl = Math.hypot(nx, ny) || 1, ox = (nx / nl) * MIXER_W, oy = (ny / nl) * MIXER_W;
      c.lineCap = "round"; shade(c, 6, 3, 5, "rgba(40,30,20,0.35)"); c.strokeStyle = "#7d8792"; c.lineWidth = MIXER_W * 2 + 2; line(c, p.ax, p.ay, p.bx, p.by); noShade(c);
      c.strokeStyle = lin(c, p.px + ox, p.py + oy, p.px - ox, p.py - oy, STEEL); c.lineWidth = MIXER_W * 2; line(c, p.ax, p.ay, p.bx, p.by);
      for (const [ex, ey] of [[p.ax, p.ay], [p.bx, p.by]]) { c.strokeStyle = "#7d8792"; c.lineWidth = 3.4; circ(c, ex, ey, 9); c.stroke(); c.strokeStyle = "rgba(255,255,255,0.7)"; c.lineWidth = 1; circ(c, ex, ey, 9); c.stroke(); }
      shade(c, 8, 3, 6, "rgba(40,30,20,0.35)"); c.fillStyle = "#a8262f"; circ(c, p.px, p.py, 16); c.fill(); noShade(c);
      c.fillStyle = rad(c, p.px, p.py, 1, 16, [[0, "#ff8f96"], [0.5, "#e8505b"], [1, "#a8262f"]], p.px - 5, p.py - 6); circ(c, p.px, p.py, 16); c.fill();
      c.fillStyle = "rgba(255,255,255,0.8)"; c.beginPath(); c.ellipse(p.px - 5, p.py - 6, 4.5, 2.4, -0.7, 0, TAU); c.fill();
      c.fillStyle = lin(c, p.px - 5, p.py - 5, p.px + 5, p.py + 5, STEEL); circ(c, p.px, p.py, 5); c.fill();
    } else if (p.k === "door") {   // a cupboard door swinging on its hinge: painted panel, brass knob
      const a = Math.atan2(p.by - p.ay, p.bx - p.ax), len = Math.hypot(p.bx - p.ax, p.by - p.ay), hw = DOOR_W + 2;
      c.save(); c.translate(p.ax, p.ay); c.rotate(a);
      shade(c, 10, 3, 7, "rgba(30,20,10,0.4)"); c.fillStyle = "#6e8a72"; rr(c, 0, -hw, len, hw * 2, 3); c.fill(); noShade(c);
      c.fillStyle = lin(c, 0, -hw, 0, hw, [[0, "#d7e8d8"], [0.45, "#a9c2ac"], [1, "#6e8a72"]]); rr(c, 0, -hw, len, hw * 2, 3); c.fill();
      c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 1; line(c, 3, -hw + 1, len - 3, -hw + 1);
      c.strokeStyle = "rgba(50,70,55,0.35)"; c.strokeRect(9, -DOOR_W + 1.5, len - 18, DOOR_W * 2 - 3);
      // the knob sits on the door's outer face, the one toward the player: the left door is drawn pointing right from its
      // hinge and the right door pointing left (turned half a turn), so the right door's outer face is its other side
      const ks = p.ax < W / 2 ? 1 : -1, ky = ks * (hw + 4);
      c.fillStyle = rad(c, len - 16, ky, 1, 6, [[0, "#fff1c0"], [1, "#a8781e"]], len - 18, ky - 2 * ks); circ(c, len - 16, ky, 4.6); c.fill();
      c.fillStyle = lin(c, -3, 0, 4, 0, STEEL); rr(c, -3, -hw - 1, 7, hw * 2 + 2, 2); c.fill();
      c.restore();
    } else {   // the rolling pin, rolling back and forth
      const dx = p.bx - p.ax, dy = p.by - p.ay, len = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      c.save(); c.translate(p.ax, p.ay); c.rotate(a);
      shade(c, 8, 3, 6, "rgba(50,30,10,0.4)"); c.fillStyle = "#8a5a2c"; rr(c, 0, -4.5, len, 9, 4.5); c.fill(); noShade(c);
      c.fillStyle = lin(c, 0, -4.5, 0, 4.5, [[0, "#d9a066"], [0.4, "#b07a46"], [1, "#6e4320"]]); rr(c, 0, -4.5, len, 9, 4.5); c.fill();
      shade(c, 8, 3, 6, "rgba(50,30,10,0.4)"); c.fillStyle = "#c9955a"; rr(c, 16, -PIN_R, len - 32, PIN_R * 2, PIN_R); c.fill(); noShade(c);
      c.fillStyle = lin(c, 0, -PIN_R, 0, PIN_R, [[0, "#fbe2b6"], [0.35, "#ecc590"], [0.7, "#d3a066"], [1, "#a8743e"]]); rr(c, 16, -PIN_R, len - 32, PIN_R * 2, PIN_R); c.fill();
      c.save(); rr(c, 16, -PIN_R, len - 32, PIN_R * 2, PIN_R); c.clip();
      c.strokeStyle = "rgba(150,100,50,0.3)"; c.lineWidth = 0.8; const roll = (p.px * 0.9) % 12;   // the grain turns as it rolls
      for (let s = 16 + ((roll + 12) % 12); s < len - 16; s += 12) line(c, s, -PIN_R + 1, s + 3, PIN_R - 1);
      c.fillStyle = "rgba(255,255,255,0.55)"; c.fillRect(16, -PIN_R + 2.5, len - 32, 2);
      c.fillStyle = "rgba(255,255,255,0.35)"; for (let s = 22; s < len - 22; s += 9) c.fillRect(s, PIN_R - 4 - (s % 3), 1.2, 1.2);   // a little flour on it
      c.restore(); c.restore();
    }
  }
}
/** The cocktail-stick flag in the cup (faded while a ball is close, so you can see in). */
export function drawFlag(c: C, k: Course, near: boolean, t: number, num?: number, font?: string) {
  const [x, y] = k.cup, sway = Math.sin(t / 500) * 1.5, wave = Math.sin(t / 260) * 1.2, tx = x + 5, ty = y - 44;
  c.globalAlpha = near ? 0.35 : 1; c.lineCap = "round"; c.lineJoin = "round";
  // its shadow on the surface, falling down and to the right
  c.strokeStyle = "rgba(25,14,4,0.22)"; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x + 4, y + 2.5); c.lineTo(x + 24, y + 15); c.stroke();
  c.fillStyle = "rgba(25,14,4,0.11)"; c.beginPath(); c.moveTo(x + 24, y + 15); c.quadraticCurveTo(x + 33, y + 15 + sway, x + 41, y + 19 + sway); c.lineTo(x + 36, y + 27 + sway); c.quadraticCurveTo(x + 28, y + 23, x + 18, y + 24); c.closePath(); c.fill();
  // the cocktail stick
  c.strokeStyle = "#9c7442"; c.lineWidth = 3.6; c.beginPath(); c.moveTo(x, y); c.lineTo(tx, ty); c.stroke();
  c.strokeStyle = "#ecd09f"; c.lineWidth = 2.2; c.beginPath(); c.moveTo(x, y); c.lineTo(tx, ty); c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.65)"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x - 0.6, y - 3); c.lineTo(tx - 0.6, ty + 2); c.stroke();
  // the flag, rippling a little, with the hole number on it
  const fw = 27, fh = 17;
  c.beginPath(); c.moveTo(tx, ty);
  c.bezierCurveTo(tx + fw * 0.35, ty - 3 + wave, tx + fw * 0.65, ty + 3 - wave, tx + fw, ty + 1 + sway);
  c.lineTo(tx + fw - 0.5, ty + fh + 1 + sway);
  c.bezierCurveTo(tx + fw * 0.65, ty + fh + 3 - wave, tx + fw * 0.35, ty + fh - 3 + wave, tx - 0.3, ty + fh);
  c.closePath();
  c.fillStyle = lin(c, tx, ty, tx + fw, ty + fh, [[0, "#ff707a"], [0.55, "#e8505b"], [1, "#c23441"]]); c.fill();
  c.strokeStyle = "#9e2531"; c.lineWidth = 1; c.stroke();
  c.fillStyle = "rgba(255,255,255,0.22)"; c.beginPath(); c.moveTo(tx + 1, ty + 1); c.bezierCurveTo(tx + fw * 0.35, ty - 2 + wave, tx + fw * 0.65, ty + 4 - wave, tx + fw - 1, ty + 2 + sway); c.lineTo(tx + fw - 1, ty + 6 + sway); c.bezierCurveTo(tx + fw * 0.65, ty + 7 - wave, tx + fw * 0.35, ty + 2 + wave, tx + 1, ty + 5); c.closePath(); c.fill();
  if (num !== undefined && font) {
    c.font = `11px ${font}`; c.textAlign = "center"; c.textBaseline = "middle";
    c.strokeStyle = "#7d1a25"; c.lineWidth = 2.6; c.strokeText(String(num), tx + fw * 0.5, ty + fh * 0.5 + 1 + sway * 0.5);
    c.fillStyle = "#ffffff"; c.fillText(String(num), tx + fw * 0.5, ty + fh * 0.5 + 1 + sway * 0.5); c.textBaseline = "alphabetic";
  }
  c.fillStyle = rad(c, tx - 0.8, ty - 1.2, 0.3, 3.2, [[0, "#fff6c8"], [1, "#d39b2a"]]); circ(c, tx, ty - 0.5, 2.8); c.fill();
  c.globalAlpha = 1;
}

// ── the meatball ──
// Seventy spots on a sphere (bumps, crumbs, parsley, pepper, a little sauce) turned by the ball's rotation; only the
// ones facing up are drawn, squashed toward the edge. The shading and the shine stay put, so it reads as rolling.
type Quat = [number, number, number, number];
export const quatIdentity = (): Quat => [1, 0, 0, 0];
/** Rolls the ball's turn on by a move of (dx, dy) on the board. */
export function rollQuat(q: Quat, dx: number, dy: number, r = BALL_R): Quat {
  const d = Math.hypot(dx, dy); if (d < 1e-6) return q;
  const a = d / r, s = Math.sin(a / 2), w = Math.cos(a / 2), ax = (-dy / d) * s, ay = (dx / d) * s;   // spin axis lies flat, square to the motion
  const [qw, qx, qy, qz] = q;
  const o: Quat = [w * qw - ax * qx - ay * qy, w * qx + ax * qw - ay * qz, w * qy + ay * qw + ax * qz, w * qz + ax * qy - ay * qx];
  const n = Math.hypot(...o); return [o[0] / n, o[1] / n, o[2] / n, o[3] / n];
}
function rotate(q: Quat, v: number[]) {
  const [w, x, y, z] = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}
const SPOTS: { v: number[]; k: number; s: number }[] = (() => {
  const rnd = mulberry32(4242), out: { v: number[]; k: number; s: number }[] = [], n = 70;
  for (let i = 0; i < n; i++) {
    const zz = 1 - (2 * (i + 0.5)) / n, rr2 = Math.sqrt(1 - zz * zz), a = i * 2.39996 + rnd() * 0.6;
    const v = [Math.cos(a) * rr2, Math.sin(a) * rr2, zz], p = rnd();
    const k = p < 0.34 ? 0 : p < 0.62 ? 1 : p < 0.74 ? 2 : p < 0.86 ? 3 : p < 0.94 ? 4 : 5;
    out.push({ v, k, s: [0.34, 0.27, 0.1, 0.07, 0.24, 0.08][k] * (0.8 + rnd() * 0.4) });
  }
  return out;
})();
const SPOT_COL = ["rgba(72,34,16,0.55)", "rgba(196,124,82,0.5)", "#3e7a2a", "#24160d", "rgba(196,52,28,0.42)", "#ecd29a"];
export function drawMeatball(c: C, x: number, y: number, r: number, q: Quat, alpha = 1, ring?: string) {
  c.save(); c.globalAlpha = alpha;
  // the shadow: a wide soft one, and a tight dark one where it touches the surface
  c.fillStyle = rad(c, x + r * 0.42, y + r * 0.58, r * 0.2, r * 1.25, [[0, "rgba(40,22,10,0.32)"], [1, "rgba(40,22,10,0)"]]); c.beginPath(); c.ellipse(x + r * 0.42, y + r * 0.58, r * 1.25, r * 1.05, 0, 0, TAU); c.fill();
  c.fillStyle = rad(c, x + r * 0.16, y + r * 0.26, r * 0.3, r * 0.98, [[0, "rgba(30,14,4,0.55)"], [1, "rgba(30,14,4,0)"]]); c.beginPath(); c.ellipse(x + r * 0.16, y + r * 0.26, r * 0.98, r * 0.86, 0, 0, TAU); c.fill();
  if (ring) {   // whose ball: a crisp ring in the player's colour, edged in white so it reads on any surface
    c.globalAlpha = alpha * 0.9; c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = Math.max(1.6, r * 0.34); circ(c, x, y, r * 1.36); c.stroke();
    c.strokeStyle = ring; c.lineWidth = Math.max(1.1, r * 0.2); circ(c, x, y, r * 1.36); c.stroke(); c.globalAlpha = alpha;
  }
  // the body, a touch lumpy
  const body = () => {
    c.beginPath();
    for (let i = 0; i <= 28; i++) { const a = (i * TAU) / 28, k = 1 + 0.035 * Math.sin(a * 5 + 1.3) + 0.025 * Math.sin(a * 9); if (i) c.lineTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k); else c.moveTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k); }
    c.closePath();
  };
  body();
  c.fillStyle = rad(c, x, y, r * 0.1, r * 1.05, [[0, "#b8693f"], [0.65, "#8a4524"], [1, "#552812"]], x - r * 0.35, y - r * 0.4); c.fill();
  c.save(); c.clip();
  const pts = SPOTS.map(s => ({ s, p: rotate(q, s.v) })).filter(o => o.p[2] > 0).sort((a, b) => a.p[2] - b.p[2]);
  for (const { s, p } of pts) {
    const px = x + p[0] * r, py = y + p[1] * r, sz = s.s * r, ang = Math.atan2(p[1], p[0]), z = Math.max(0.18, p[2]);
    c.fillStyle = SPOT_COL[s.k]; c.beginPath(); c.ellipse(px, py, sz * z, sz, ang, 0, TAU); c.fill();
  }
  c.fillStyle = rad(c, x, y, r * 0.2, r * 1.05, [[0, "rgba(0,0,0,0)"], [0.7, "rgba(30,10,0,0.12)"], [1, "rgba(30,10,0,0.5)"]], x - r * 0.4, y - r * 0.45); c.fillRect(x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4);
  c.strokeStyle = "rgba(255,190,140,0.35)"; c.lineWidth = r * 0.16; c.beginPath(); c.arc(x, y, r * 0.9, Math.PI * 0.1, Math.PI * 0.55); c.stroke();   // warm light bouncing back up off the surface
  c.restore();
  body(); c.strokeStyle = "rgba(45,18,4,0.55)"; c.lineWidth = Math.max(0.6, r * 0.07); c.stroke();                                           // a crisp edge
  c.fillStyle = rad(c, x - r * 0.36, y - r * 0.42, 0, r * 0.5, [[0, "rgba(255,244,228,0.75)"], [0.5, "rgba(255,236,214,0.32)"], [1, "rgba(255,236,214,0)"]]);
  c.beginPath(); c.ellipse(x - r * 0.36, y - r * 0.42, r * 0.5, r * 0.34, -0.7, 0, TAU); c.fill();                                              // gloss
  c.fillStyle = "rgba(255,255,255,0.92)"; c.beginPath(); c.ellipse(x - r * 0.44, y - r * 0.5, r * 0.15, r * 0.09, -0.7, 0, TAU); c.fill();        // a glint of sauce
  c.restore();
}
