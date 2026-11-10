// Kitchen Golf's rules, holes, physics and computer player. Pure: no React, no DOM, and the physics only uses + - * /,
// sqrt and floor (angles come from a table built with a Taylor series), which give the same answer in every browser,
// so a putt rolled on one phone ends in exactly the same spot on the other. The balance check runs this file in Node.
//
// The world is 400 units wide; most holes are 600 tall, a couple are taller and the camera pans. y grows downward.
// Each hole is a place in the kitchen: its `place` picks the scenery and surface, `out` is the edge you bounce off,
// `blocks` and `bumps` are solid things on it, `zones` change how it rolls, `movers` move on the hole clock, `tubes`
// carry the ball from one end to the other, and `deco` is drawing only.

export const W = 400, SUB = 4, STEP = 1000 / 60;
export const BALL_R = 9, CUP_R = 13, VMAX = 11, MAX_PULL = 110, MIN_PULL = 8;
const ROLL_K = 0.99, ROLL_C = 0.018;                          // rolling: each step, speed = speed * K - C
const FRICTION = { slow: [0.965, 0.03], sticky: [0.92, 0.05], slick: [0.996, 0.006] } as const;
const WALL_E = 0.75, BUMP_E = 0.82, MOVER_E = 0.9;
const CUP_PULL = 0.3, CUP_CATCH = 2.9;                        // the cup tugs a passing ball in; slower than CATCH and it drops
export const MIXER_W = 6, PIN_R = 10, DOOR_W = 6;
export const MAX_STROKES = 6, PICKUP = 7, ROUND_HOLES = 9;
const MAX_STEPS = 1500;
export const PI = 3.141592653589793;

export function mulberry32(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// cos and sin every half degree, from Taylor series (only + - * /), so every browser builds the same table
export const TRIG: number[][] = [];
for (let i = 0; i < 720; i++) {
  let a = (i * PI) / 360; if (a > PI) a -= 2 * PI;
  let s = 0, c = 0, ts = a, tc = 1;
  for (let k = 0; k < 30; k++) { s += ts; c += tc; ts = (-ts * a * a) / ((2 * k + 2) * (2 * k + 3)); tc = (-tc * a * a) / ((2 * k + 1) * (2 * k + 2)); }
  TRIG.push([c, s]);
}
/** cos, sin of an angle in half degrees (any real number), between table entries by a straight line. */
export function trig(a: number) {
  const f = Math.floor(a), t = a - f, i = ((f % 720) + 720) % 720, j = (i + 1) % 720;
  return [TRIG[i][0] + (TRIG[j][0] - TRIG[i][0]) * t, TRIG[i][1] + (TRIG[j][1] - TRIG[i][1]) * t];
}

export type Pt = [number, number];
export type Rect = [number, number, number, number];          // x0, y0, x1, y1
export type Circle = [number, number, number];                // x, y, r
export type Place = "counter" | "table" | "fridge" | "sink" | "floor" | "stove" | "island" | "cupboard";
export type CupKind = "ramekin" | "soup" | "jar" | "drain" | "dogbowl" | "pot" | "mixbowl" | "mug" | "cookiejar";
// how a zone changes the roll; `look` says how to draw it
export type Zone =
  | { k: "slow" | "sticky" | "slick"; look: string; r?: Rect; c?: Circle }
  | { k: "slope"; look: string; r: Rect; ax: number; ay: number }
  | { k: "hazard"; look: string; r?: Rect; c?: Circle }                       // in it: back where you putted from, plus a stroke
  | { k: "pull"; look: string; c: Circle; s: number }                         // pulls toward the middle (the sink's swirl)
  | { k: "burner"; look: string; c: Circle; s: number; per: number; on: number; ph: number };   // lit part of the time: pushes out
export type Bump = { x: number; y: number; r: number; k: string; f?: string; col?: string };
export type Block = { k: string; p: Pt[]; col?: string };
export type Mover =
  | { k: "mixer"; x: number; y: number; len: number; spd: number; ph: number }                       // spd: half degrees a step
  | { k: "pin"; x0: number; y0: number; x1: number; y1: number; half: number; per: number; ph: number }   // slides x0,y0 <-> x1,y1
  | { k: "door"; x: number; y: number; len: number; a0: number; a1: number; per: number; hold: number; ph: number };   // swings shut <-> open
export type Tube = { ax: number; ay: number; bx: number; by: number; r: number };
export type Deco = { k: string; x: number; y: number; w?: number; h?: number; r?: number; rot?: number; f?: string; col?: string; over?: boolean; n?: number };
export type HoleDef = { name: string; place: Place; par: number; tier: 0 | 1 | 2; h: number; tee: Pt; cup: Pt; cupKind: CupKind; out: Pt[];
  blocks?: Block[]; bumps?: Bump[]; zones?: Zone[]; movers?: Mover[]; tubes?: Tube[]; deco?: Deco[] };
export type Course = Required<Omit<HoleDef, "tier">> & { id: number; mirror: boolean; segs: number[][] };

const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/** A rectangle with its corners cut off (a rounded table or worktop, near enough). */
const chamfer = (x0: number, y0: number, x1: number, y1: number, c: number): Pt[] => [[x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c]];
/** A thin bar from a to b, w wide (cutlery, a broom handle). */
function bar(ax: number, ay: number, bx: number, by: number, w: number): Pt[] {
  const dx = bx - ax, dy = by - ay, l = Math.sqrt(dx * dx + dy * dy), nx = (-dy / l) * (w / 2), ny = (dx / l) * (w / 2);
  return [[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]];
}
const legs = (x0: number, y0: number, x1: number, y1: number, r: number): Bump[] => [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => ({ x, y, r, k: "leg" }));

export const HOLES: HoleDef[] = [
  // ── tier 0: the first three holes of every round, gentle ──
  { name: "On The Counter", place: "counter", par: 2, tier: 0, h: 600, tee: [200, 505], cup: [200, 205], cupKind: "ramekin",
    out: [[92, 160], [290, 160], [290, 242], [370, 242], [370, 548], [30, 548], [30, 236], [92, 236]],
    zones: [{ k: "slope", look: "boardUp", r: [130, 356, 270, 412], ax: 0, ay: 0.035 }, { k: "slope", look: "boardDown", r: [130, 300, 270, 356], ax: 0, ay: -0.035 }],
    bumps: [{ x: 312, y: 430, r: 34, k: "fruitbowl" }, { x: 70, y: 420, r: 12, k: "pepper" }],
    deco: [{ k: "toaster", x: 330, y: 201, w: 76, h: 76 }, { k: "knifeblock", x: 61, y: 198, w: 58, h: 72 }, { k: "towel", x: 200, y: 572 }] },
  { name: "At The Table", place: "table", par: 3, tier: 0, h: 600, tee: [200, 515], cup: [200, 165], cupKind: "soup",
    out: chamfer(40, 110, 360, 560, 22),
    zones: [{ k: "slow", look: "mat", r: [52, 168, 148, 262] }, { k: "slow", look: "mat", r: [252, 168, 348, 262] }, { k: "slow", look: "mat", r: [52, 408, 148, 502] }, { k: "slow", look: "mat", r: [252, 408, 348, 502] }],
    bumps: [{ x: 100, y: 215, r: 24, k: "plate" }, { x: 300, y: 215, r: 24, k: "plate" }, { x: 100, y: 455, r: 24, k: "plate" }, { x: 300, y: 455, r: 24, k: "plate" },
      { x: 200, y: 335, r: 25, k: "fruitbowl", f: "1f34a" }, { x: 146, y: 180, r: 9, k: "glass" }, { x: 254, y: 180, r: 9, k: "glass" }],
    blocks: [{ k: "fork", p: rect(60, 192, 65, 240) }, { k: "knife", p: rect(135, 192, 140, 240) }, { k: "fork", p: rect(260, 192, 265, 240) }, { k: "knife", p: rect(335, 192, 340, 240) },
      { k: "fork", p: rect(60, 432, 65, 480) }, { k: "knife", p: rect(135, 432, 140, 480) }, { k: "fork", p: rect(260, 432, 265, 480) }, { k: "knife", p: rect(335, 432, 340, 480) }],
    deco: [{ k: "chair", x: 200, y: 590, w: 120, h: 50 }, { k: "chair", x: 15, y: 335, w: 50, h: 120 }, { k: "chair", x: 385, y: 335, w: 50, h: 120 }, { k: "napkin", x: 100, y: 255 }, { k: "napkin", x: 300, y: 495 }] },
  { name: "In The Fridge", place: "fridge", par: 3, tier: 0, h: 600, tee: [290, 510], cup: [100, 190], cupKind: "jar",
    out: rect(50, 130, 350, 550),
    zones: [{ k: "slick", look: "frost", r: [180, 222, 340, 282] }],
    blocks: [{ k: "carton", p: rect(62, 300, 130, 368) }, { k: "eggs", p: rect(232, 142, 340, 196) }],
    bumps: [{ x: 250, y: 330, r: 14, k: "bottle", col: "#d8343a" }, { x: 292, y: 352, r: 13, k: "bottle", col: "#f2c230" }, { x: 170, y: 445, r: 16, k: "jamjar" }, { x: 95, y: 470, r: 15, k: "food", f: "1f9c0" }],
    deco: [{ k: "fridgelight", x: 200, y: 100 }] },
  // ── tier 1: holes 4 to 6 ──
  { name: "In The Sink", place: "sink", par: 3, tier: 1, h: 600, tee: [118, 478], cup: [282, 445], cupKind: "drain",
    out: [[45, 170], [190, 170], [190, 318], [210, 318], [210, 170], [355, 170], [355, 520], [210, 520], [210, 382], [190, 382], [190, 520], [45, 520]],
    zones: [{ k: "sticky", look: "suds", c: [118, 245, 46] }, { k: "pull", look: "swirl", c: [282, 445, 58], s: 0.05 }],
    blocks: [{ k: "sponge", p: rect(296, 238, 344, 270) }],
    bumps: [{ x: 82, y: 392, r: 17, k: "mug" }],
    deco: [{ k: "faucet", x: 200, y: 150, over: true }, { k: "soap", x: 360, y: 120 }] },
  { name: "On The Floor", place: "floor", par: 4, tier: 1, h: 680, tee: [272, 600], cup: [120, 152], cupKind: "dogbowl",
    out: rect(60, 92, 340, 640),
    zones: [{ k: "slow", look: "rug", r: [108, 330, 292, 470] }, { k: "hazard", look: "waterbowl", c: [300, 128, 22] }],
    blocks: [{ k: "broom", p: bar(66, 525, 248, 438, 9) }],
    bumps: legs(222, 232, 280, 288, 6),
    deco: [{ k: "chairseat", x: 251, y: 260, w: 74, h: 72, over: true }, { k: "bristles", x: 66, y: 525, rot: -0.446 }] },
  { name: "On The Stove", place: "stove", par: 3, tier: 1, h: 600, tee: [200, 510], cup: [200, 188], cupKind: "pot",
    out: rect(50, 140, 350, 545),
    zones: [{ k: "burner", look: "burner", c: [125, 238, 50], s: 0.14, per: 240, on: 120, ph: 0 }, { k: "burner", look: "burner", c: [275, 440, 50], s: 0.14, per: 240, on: 120, ph: 120 },
      { k: "slope", look: "spatula", r: [150, 320, 250, 372], ax: 0, ay: 0.06 }],
    bumps: [{ x: 275, y: 236, r: 40, k: "pan" }, { x: 125, y: 440, r: 38, k: "potbig" }],
    blocks: [{ k: "panhandle", p: rect(312, 230, 350, 242) }],
    deco: [{ k: "coil", x: 275, y: 236, r: 50 }, { k: "coil", x: 125, y: 440, r: 50 }, { k: "knobs", x: 200, y: 105 }] },
  { name: "At The Island", place: "island", par: 3, tier: 1, h: 600, tee: [200, 515], cup: [200, 175], cupKind: "mixbowl",
    out: chamfer(50, 125, 350, 550, 26),
    movers: [{ k: "mixer", x: 200, y: 348, len: 82, spd: 3, ph: 0 }],
    blocks: [{ k: "cookbook", p: rect(70, 168, 142, 228) }],
    bumps: [{ x: 312, y: 200, r: 14, k: "mug" }, { x: 86, y: 470, r: 22, k: "food", f: "1f34b" }],
    deco: [{ k: "mixerbowl", x: 200, y: 348, r: 92 }, { k: "stool", x: 120, y: 585 }, { k: "stool", x: 280, y: 585 }, { k: "stool", x: 18, y: 330 }, { k: "stool", x: 382, y: 330 }] },
  { name: "Behind The Toaster", place: "counter", par: 3, tier: 2, h: 600, tee: [232, 505], cup: [232, 196], cupKind: "ramekin",
    out: rect(30, 152, 370, 548),
    blocks: [{ k: "coffeemaker", p: rect(30, 294, 110, 376) }, { k: "toaster", p: rect(150, 300, 250, 366) }, { k: "blender", p: rect(270, 298, 330, 372) }],
    bumps: [{ x: 260, y: 334, r: 12, k: "canister" }],
    tubes: [{ ax: 130, ay: 440, bx: 130, by: 226, r: 14 }],
    deco: [{ k: "plant", x: 350, y: 120 }] },
  // ── tier 2: holes 7 to 9 ──
  { name: "In The Cupboard", place: "cupboard", par: 3, tier: 2, h: 660, tee: [200, 600], cup: [300, 165], cupKind: "mug",
    out: [[40, 110], [360, 110], [360, 446], [370, 446], [370, 640], [30, 640], [30, 446], [40, 446]],
    movers: [{ k: "door", x: 42, y: 450, len: 156, a0: 0, a1: 180, per: 360, hold: 70, ph: 0 }, { k: "door", x: 358, y: 450, len: 156, a0: 360, a1: 180, per: 360, hold: 70, ph: 0 }],
    blocks: [{ k: "cereal", p: rect(58, 124, 150, 172), col: "#e8a43a" }, { k: "pasta", p: rect(188, 180, 230, 252), col: "#3f7fd6" }],
    bumps: [{ x: 118, y: 302, r: 18, k: "can", col: "#d8343a" }, { x: 156, y: 302, r: 18, k: "can", col: "#2eaa6e" }, { x: 252, y: 258, r: 18, k: "can", col: "#f2994a" }, { x: 310, y: 335, r: 16, k: "jamjar" }] },
  { name: "In The Crisper", place: "fridge", par: 4, tier: 2, h: 600, tee: [118, 508], cup: [282, 482], cupKind: "jar",
    out: [[50, 120], [350, 120], [350, 545], [215, 545], [215, 212], [185, 212], [185, 545], [50, 545]],
    zones: [{ k: "slick", look: "drawer", r: [50, 212, 185, 545] }, { k: "slick", look: "drawer", r: [215, 212, 350, 545] }],
    bumps: [{ x: 98, y: 300, r: 22, k: "food", f: "1f96c" }, { x: 150, y: 420, r: 13, k: "food", f: "1f345" }, { x: 262, y: 290, r: 18, k: "food", f: "1f966" }, { x: 312, y: 380, r: 13, k: "food", f: "1f955" }],
    deco: [{ k: "fridgelight", x: 200, y: 92 }] },
  { name: "Rolling Pin Run", place: "table", par: 3, tier: 2, h: 600, tee: [200, 520], cup: [200, 165], cupKind: "cookiejar",
    out: chamfer(40, 115, 360, 555, 22),
    zones: [{ k: "sticky", look: "flour", c: [128, 252, 40] }, { k: "sticky", look: "flour", c: [282, 425, 36] }],
    movers: [{ k: "pin", x0: 130, y0: 332, x1: 270, y1: 332, half: 70, per: 220, ph: 0 }],
    bumps: [{ x: 88, y: 448, r: 14, k: "cutter" }, { x: 318, y: 232, r: 14, k: "cutter" }, { x: 320, y: 500, r: 20, k: "food", f: "1f95a" }] },
  { name: "Under The Table", place: "floor", par: 4, tier: 2, h: 820, tee: [200, 745], cup: [200, 150], cupKind: "dogbowl",
    out: rect(60, 90, 340, 780),
    zones: [{ k: "slow", look: "rug", r: [110, 330, 290, 530] }],
    blocks: [{ k: "tableleg", p: rect(94, 304, 118, 328) }, { k: "tableleg", p: rect(282, 304, 306, 328) }, { k: "tableleg", p: rect(94, 532, 118, 556) }, { k: "tableleg", p: rect(282, 532, 306, 556) }],
    bumps: [{ x: 172, y: 652, r: 24, k: "dog" }, { x: 214, y: 655, r: 26, k: "dog" }, { x: 252, y: 642, r: 19, k: "dog" }, ...legs(264, 186, 314, 236, 6)],
    deco: [{ k: "tabletop", x: 200, y: 430, w: 236, h: 276, over: true }, { k: "dogbody", x: 210, y: 650 }, { k: "chairseat", x: 289, y: 211, w: 64, h: 64, over: true }] },
];

function polySegs(p: Pt[]) { return p.map((a, i) => { const b = p[(i + 1) % p.length]; return [a[0], a[1], b[0], b[1]]; }); }
/** A hole ready to play, mirrored left to right if `mirror` (so 12 holes give 24 layouts). */
export function compile(id: number, mirror: boolean): Course {
  const h = HOLES[id], mx = (x: number) => (mirror ? W - x : x), mp = (p: Pt): Pt => [mx(p[0]), p[1]];
  const mr = (r?: Rect): Rect | undefined => (r && mirror ? [W - r[2], r[1], W - r[0], r[3]] : r);
  const mc = (c?: Circle): Circle | undefined => (c && mirror ? [W - c[0], c[1], c[2]] : c);
  const out = h.out.map(mp), blocks = (h.blocks ?? []).map(b => ({ ...b, p: b.p.map(mp) }));
  const zones = (h.zones ?? []).map(z => ({ ...z, r: mr((z as { r?: Rect }).r), c: mc((z as { c?: Circle }).c), ...(z.k === "slope" ? { ax: mirror ? -z.ax : z.ax } : {}) }) as Zone);
  const movers: Mover[] = (h.movers ?? []).map(m => m.k === "mixer" ? { ...m, x: mx(m.x), spd: mirror ? -m.spd : m.spd, ph: mirror ? (720 + 360 - m.ph) % 720 : m.ph }
    : m.k === "pin" ? { ...m, x0: mx(m.x0), x1: mx(m.x1) }
    : { ...m, x: mx(m.x), a0: mirror ? (720 + 360 - m.a0) % 720 : m.a0, a1: mirror ? (720 + 360 - m.a1) % 720 : m.a1 });
  const tubes = (h.tubes ?? []).map(t => ({ ...t, ax: mx(t.ax), bx: mx(t.bx) }));
  const segs = [...polySegs(out), ...blocks.flatMap(b => polySegs(b.p))];
  return { id, mirror, name: h.name, place: h.place, par: h.par, h: h.h, tee: mp(h.tee), cup: mp(h.cup), cupKind: h.cupKind, out, blocks,
    bumps: (h.bumps ?? []).map(b => ({ ...b, x: mx(b.x) })), zones, movers, tubes,
    deco: (h.deco ?? []).map(d => ({ ...d, x: mx(d.x), rot: d.rot !== undefined && mirror ? -d.rot : d.rot })), segs };
}
/** A round's 9 holes: the 3 gentle ones, then 3 middling, then 3 hard, shuffled by the seed, some mirrored. Each tier
 *  prefers places not already played this round, so a round is a tour of the kitchen. */
export function pickHoles(seed: number): { id: number; mirror: boolean }[] {
  const rnd = mulberry32(seed), out: { id: number; mirror: boolean }[] = [], used = new Set<Place>();
  for (const tier of [0, 1, 2]) {
    const ids = HOLES.map((h, i) => (h.tier === tier ? i : -1)).filter(i => i >= 0);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
    ids.sort((a, b) => (used.has(HOLES[a].place) ? 1 : 0) - (used.has(HOLES[b].place) ? 1 : 0));   // stable: keeps the shuffle otherwise
    for (let k = 0; k < 3; k++) { out.push({ id: ids[k], mirror: rnd() < 0.5 }); used.add(HOLES[ids[k]].place); }
  }
  return out;
}
const inRect = (r: Rect, x: number, y: number) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
const inCircle = (c: Circle, x: number, y: number) => (x - c[0]) * (x - c[0]) + (y - c[1]) * (y - c[1]) < c[2] * c[2];
export const inZone = (z: Zone, x: number, y: number) => { const r = (z as { r?: Rect }).r, c = (z as { c?: Circle }).c; return r ? inRect(r, x, y) : c ? inCircle(c, x, y) : false; };
export const burnerLit = (z: { per: number; on: number; ph: number }, clock: number) => (((clock + z.ph) % z.per) + z.per) % z.per < z.on;

type Body = { x: number; y: number; vx: number; vy: number };
/** Pushes the ball out of a line segment (thickened to `rad`) and bounces it, relative to the segment's own velocity. Returns the hit speed. */
function hitSeg(b: Body, ax: number, ay: number, bx: number, by: number, rad: number, svx: number, svy: number, e: number) {
  const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
  let t = l2 > 0 ? ((b.x - ax) * ex + (b.y - ay) * ey) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + ex * t, cy = ay + ey * t, dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy;
  if (d2 >= rad * rad || d2 < 1e-9) return 0;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  b.x = cx + nx * rad; b.y = cy + ny * rad;
  const vn = (b.vx - svx) * nx + (b.vy - svy) * ny;
  if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; return -vn; }
  return 0;
}
function hitCircle(b: Body, x: number, y: number, rad: number, e: number) {
  const dx = b.x - x, dy = b.y - y, d2 = dx * dx + dy * dy;
  if (d2 >= rad * rad || d2 < 1e-9) return 0;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  b.x = x + nx * rad; b.y = y + ny * rad;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; return -vn; }
  return 0;
}
/** Where each moving part is at a step of the hole clock: a segment, how thick, its pivot, spin and sliding velocity. */
export type Part = { k: Mover["k"]; ax: number; ay: number; bx: number; by: number; rad: number; spin: number; px: number; py: number; vx: number; vy: number };
function doorAngle(m: Extract<Mover, { k: "door" }>, clock: number) {
  const u = (((clock + m.ph) % m.per) + m.per) % m.per, s = m.per / 2 - m.hold, d = m.a1 - m.a0;   // shut, swing open, open, swing shut
  if (u < m.hold) return [m.a0, 0];
  if (u < m.hold + s) return [m.a0 + (d * (u - m.hold)) / s, d / s];
  if (u < 2 * m.hold + s) return [m.a1, 0];
  return [m.a1 - (d * (u - 2 * m.hold - s)) / s, -d / s];
}
export function partsAt(c: Course, clock: number): Part[] {
  return c.movers.map(m => {
    if (m.k === "mixer") {
      const [co, si] = trig(m.ph + clock * m.spd);
      return { k: m.k, ax: m.x - m.len * co, ay: m.y - m.len * si, bx: m.x + m.len * co, by: m.y + m.len * si, rad: BALL_R + MIXER_W, spin: (m.spd * PI) / 360, px: m.x, py: m.y, vx: 0, vy: 0 };
    }
    if (m.k === "door") {
      const [a, da] = doorAngle(m, clock), [co, si] = trig(a);
      return { k: m.k, ax: m.x, ay: m.y, bx: m.x + m.len * co, by: m.y + m.len * si, rad: BALL_R + DOOR_W, spin: (da * PI) / 360, px: m.x, py: m.y, vx: 0, vy: 0 };
    }
    const half = m.per / 2, u = (((clock + m.ph) % m.per) + m.per) % m.per, f = u < half ? u / half : 2 - u / half, dir = u < half ? 1 : -1;
    const dx = m.x1 - m.x0, dy = m.y1 - m.y0, l = Math.sqrt(dx * dx + dy * dy), ux = dx / l, uy = dy / l, cx = m.x0 + dx * f, cy = m.y0 + dy * f;
    return { k: m.k, ax: cx - ux * m.half, ay: cy - uy * m.half, bx: cx + ux * m.half, by: cy + uy * m.half, rad: BALL_R + PIN_R, spin: 0, px: cx, py: cy, vx: (dir * dx) / half, vy: (dir * dy) / half };
  });
}

/** One putt in progress. done: 0 rolling, 1 stopped, 2 in the cup, 3 in a hazard. `ev` flags this step's events for
 *  sounds (1 bounce, 2 into a tube, 4 out of a tube, 8 a hot burner), `hit` the hardest bounce. */
export type Roll = Body & { clock: number; steps: number; slow: number; done: 0 | 1 | 2 | 3; sx: number; sy: number; dist: number;
  tube: { i: number; from: number; t: number; T: number; sp: number } | null; ev: number; hit: number };
export function startRoll(x: number, y: number, px: number, py: number, clock: number): Roll {
  const l = Math.sqrt(px * px + py * py), k = l > MAX_PULL ? MAX_PULL / l : 1;
  return { x, y, vx: ((-px * k) / MAX_PULL) * VMAX, vy: ((-py * k) / MAX_PULL) * VMAX, clock, steps: 0, slow: 0, done: 0, sx: x, sy: y, dist: 0, tube: null, ev: 0, hit: 0 };
}
function tubeGeo(t: Tube) { const dx = t.bx - t.ax, dy = t.by - t.ay, len = Math.sqrt(dx * dx + dy * dy); return { ux: dx / len, uy: dy / len, len }; }
/** Where a ball inside a tube is (for drawing): along the tube from the end it went in. */
export function tubePos(c: Course, b: Roll) {
  const tb = b.tube!, t = c.tubes[tb.i], f = tb.from === 0 ? tb.t / tb.T : 1 - tb.t / tb.T;
  return [t.ax + (t.bx - t.ax) * f, t.ay + (t.by - t.ay) * f];
}
export function stepRoll(c: Course, b: Roll): number {
  if (b.done) return b.done;
  b.ev = 0; b.hit = 0;
  if (b.tube) {                                                  // inside a tube: out the other end after a moment
    const tb = b.tube; tb.t++; b.clock++; b.steps++;
    if (tb.t >= tb.T) {
      const t = c.tubes[tb.i], g = tubeGeo(t), dir = tb.from === 0 ? 1 : -1, ex = tb.from === 0 ? t.bx : t.ax, ey = tb.from === 0 ? t.by : t.ay;
      const sp = tb.sp * 0.9 > 1.2 ? tb.sp * 0.9 : 1.2;
      b.x = ex + g.ux * dir * (BALL_R + 1); b.y = ey + g.uy * dir * (BALL_R + 1); b.vx = g.ux * dir * sp; b.vy = g.uy * dir * sp;
      b.tube = null; b.ev |= 4;
    }
    return 0;
  }
  let k: number = ROLL_K, cc: number = ROLL_C, push = false;
  for (const z of c.zones) {
    if (z.k === "burner") {
      if (!burnerLit(z, b.clock)) continue;
      const dx = b.x - z.c[0], dy = b.y - z.c[1], d2 = dx * dx + dy * dy;
      if (d2 < z.c[2] * z.c[2] && d2 > 0.01) { const d = Math.sqrt(d2), a = z.s * (1 - d / z.c[2]); b.vx += (dx / d) * a; b.vy += (dy / d) * a; push = true; b.ev |= 8; }
      continue;
    }
    if (z.k === "pull") {
      const dx = z.c[0] - b.x, dy = z.c[1] - b.y, d2 = dx * dx + dy * dy;
      if (d2 < z.c[2] * z.c[2] && d2 > 0.01) { const d = Math.sqrt(d2), a = z.s * (1 - d / z.c[2]); b.vx += (dx / d) * a; b.vy += (dy / d) * a; push = true; }
      continue;
    }
    if (!inZone(z, b.x, b.y)) continue;
    if (z.k === "hazard") { b.vx = 0; b.vy = 0; b.done = 3; return 3; }
    if (z.k === "slope") { b.vx += z.ax; b.vy += z.ay; push = true; }
    else { k = FRICTION[z.k][0]; cc = FRICTION[z.k][1]; }
  }
  let sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  const qx = b.x - c.cup[0], qy = b.y - c.cup[1], q2 = qx * qx + qy * qy;
  if (q2 < CUP_R * CUP_R) {
    if (sp < CUP_CATCH) { b.x = c.cup[0]; b.y = c.cup[1]; b.vx = 0; b.vy = 0; b.done = 2; return 2; }
    const q = Math.sqrt(q2); if (q > 0.01) { b.vx -= (qx / q) * CUP_PULL; b.vy -= (qy / q) * CUP_PULL; }
    sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  }
  const ns = sp * k - cc;
  if (ns <= 0) { b.vx = 0; b.vy = 0; } else { b.vx = (b.vx * ns) / sp; b.vy = (b.vy * ns) / sp; }
  const parts = c.movers.length ? partsAt(c, b.clock) : [];
  const x0 = b.x, y0 = b.y;
  for (let s = 0; s < SUB; s++) {
    b.x += b.vx / SUB; b.y += b.vy / SUB;
    for (let i = 0; i < c.tubes.length; i++) {                     // into a tube's open end, or off its side
      const t = c.tubes[i], g = tubeGeo(t), rx = b.x - t.ax, ry = b.y - t.ay, along = rx * g.ux + ry * g.uy, side = rx * -g.uy + ry * g.ux;
      const aside = side < 0 ? -side : side, vin = b.vx * g.ux + b.vy * g.uy;
      if (aside < t.r + 2 && ((along > -BALL_R && along < BALL_R && vin > 0) || (along > g.len - BALL_R && along < g.len + BALL_R && vin < 0))) {
        const from = vin > 0 ? 0 : 1, v = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        b.tube = { i, from, t: 0, T: Math.ceil(g.len / (v > 2 ? v : 2)), sp: v }; b.ev |= 2;
        return 0;
      }
      if (along >= 0 && along <= g.len && aside < t.r + BALL_R) {
        const n = side < 0 ? -1 : 1, nx = -g.uy * n, ny = g.ux * n, vn = b.vx * nx + b.vy * ny;
        b.x += nx * (t.r + BALL_R - aside); b.y += ny * (t.r + BALL_R - aside);
        if (vn < 0) { b.vx -= (1 + WALL_E) * vn * nx; b.vy -= (1 + WALL_E) * vn * ny; b.ev |= 1; if (-vn > b.hit) b.hit = -vn; }
      }
    }
    for (const p of parts) {
      const ex = p.bx - p.ax, ey = p.by - p.ay, l2 = ex * ex + ey * ey;
      let t = ((b.x - p.ax) * ex + (b.y - p.ay) * ey) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const hx = p.ax + ex * t, hy = p.ay + ey * t;   // the part's velocity where it meets the ball
      const v = hitSeg(b, p.ax, p.ay, p.bx, p.by, p.rad, p.vx - p.spin * (hy - p.py), p.vy + p.spin * (hx - p.px), MOVER_E);
      if (v) { b.ev |= 1; if (v > b.hit) b.hit = v; }
    }
    for (const g of c.segs) { const v = hitSeg(b, g[0], g[1], g[2], g[3], BALL_R, 0, 0, WALL_E); if (v) { b.ev |= 1; if (v > b.hit) b.hit = v; } }
    for (const u of c.bumps) { const v = hitCircle(b, u.x, u.y, u.r + BALL_R, BUMP_E); if (v) { b.ev |= 1; if (v > b.hit) b.hit = v; } }
  }
  const mx = b.x - x0, my = b.y - y0; b.dist += Math.sqrt(mx * mx + my * my);
  b.clock++; b.steps++;
  sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  if (sp < 0.05) { b.slow++; if (!push || b.slow > 30) { b.vx = 0; b.vy = 0; b.done = 1; } } else b.slow = 0;
  if (b.steps >= MAX_STEPS && !b.done) { b.vx = 0; b.vy = 0; b.done = 1; }
  if (b.done === 1) rest(c, b);
  return b.done;
}
/** A ball can't stop where a moving part sweeps: it's set down just outside, then nudged off any wall. */
function rest(c: Course, b: Body) {
  for (const m of c.movers) {
    if (m.k === "mixer") {
      const R = m.len + MIXER_W + BALL_R + 2, dx = b.x - m.x, dy = b.y - m.y, d2 = dx * dx + dy * dy;
      if (d2 < R * R) { const d = Math.sqrt(d2); if (d < 0.01) { b.x = m.x; b.y = m.y + R; } else { b.x = m.x + (dx / d) * R; b.y = m.y + (dy / d) * R; } }
    } else if (m.k === "door") {
      const R = m.len + DOOR_W + BALL_R + 2, dx = b.x - m.x, dy = b.y - m.y, d2 = dx * dx + dy * dy;
      const [c0, s0] = trig(m.a0), [c1, s1] = trig(m.a1), sw = c0 * s1 - s0 * c1, a = c0 * dy - s0 * dx, z = dx * s1 - dy * c1;
      const inSweep = sw > 0 ? a >= -8 && z >= -8 : a <= 8 && z <= 8;   // between shut and open (with a little to spare)
      if (d2 < R * R && inSweep) { const d = Math.sqrt(d2); if (d > 0.01) { b.x = m.x + (dx / d) * R; b.y = m.y + (dy / d) * R; } }
    } else {
      const dx = m.x1 - m.x0, dy = m.y1 - m.y0, l = Math.sqrt(dx * dx + dy * dy), ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
      const along = (b.x - m.x0) * ux + (b.y - m.y0) * uy, side = (b.x - m.x0) * nx + (b.y - m.y0) * ny, R = PIN_R + BALL_R + 2;
      if (along > -m.half - BALL_R && along < l + m.half + BALL_R && side > -R && side < R) { const to = side < 0 ? -R : R; b.x += nx * (to - side); b.y += ny * (to - side); }
    }
  }
  const t = { x: b.x, y: b.y, vx: 0, vy: 0 };
  for (let k = 0; k < 3; k++) { for (const g of c.segs) hitSeg(t, g[0], g[1], g[2], g[3], BALL_R + 0.5, 0, 0, 0); for (const u of c.bumps) hitCircle(t, u.x, u.y, u.r + BALL_R + 0.5, 0); }
  b.x = Math.round(t.x * 100) / 100; b.y = Math.round(t.y * 100) / 100;
}
/** A whole putt at once (the computer thinking, and catching up): where it ends and how. */
export function simPutt(c: Course, x: number, y: number, px: number, py: number, clock: number) {
  const b = startRoll(x, y, px, py, clock);
  while (!b.done) stepRoll(c, b);
  return b;
}

// ── the computer ──
// It reads the hole as a grid of distances to the cup (walking round walls and bowls, through tubes, never into the
// water; rugs, suds and flour count extra), tries about a thousand putts in its head, keeps a good one that still works
// when slightly off, then misses on purpose by a random amount that shrinks a little each hole and each round.
const CELL = 8, GW = W / CELL;
export function inPoly(p: Pt[], x: number, y: number) {
  let on = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) on = !on;
  }
  return on;
}
export function segDist2(x: number, y: number, g: number[]) {
  const ex = g[2] - g[0], ey = g[3] - g[1], l2 = ex * ex + ey * ey;
  let t = l2 > 0 ? ((x - g[0]) * ex + (y - g[1]) * ey) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = x - g[0] - ex * t, dy = y - g[1] - ey * t; return dx * dx + dy * dy;
}
const fields = new Map<string, Float64Array>();
export function fieldFor(c: Course) {
  const key = `${c.id}${c.mirror ? "m" : ""}`, have = fields.get(key);
  if (have) return have;
  const GH = Math.ceil(c.h / CELL), cost = new Float64Array(GW * GH), dist = new Float64Array(GW * GH).fill(Infinity);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = i * CELL + CELL / 2, y = j * CELL + CELL / 2;
    let ok = inPoly(c.out, x, y) && !c.blocks.some(b => inPoly(b.p, x, y)) && c.segs.every(g => segDist2(x, y, g) > (BALL_R - 2) * (BALL_R - 2))
      && c.bumps.every(u => (x - u.x) * (x - u.x) + (y - u.y) * (y - u.y) > (u.r + BALL_R - 2) * (u.r + BALL_R - 2));
    for (const t of c.tubes) { const tb = { ax: t.ax, ay: t.ay, bx: t.bx, by: t.by }; if (segDist2(x, y, [tb.ax, tb.ay, tb.bx, tb.by]) < (t.r + BALL_R - 2) * (t.r + BALL_R - 2)) ok = false; }
    let k = 1;
    for (const z of c.zones) {
      if (z.k === "hazard" && inZone(z, x, y)) ok = false;
      if ((z.k === "sticky" || z.k === "slow") && inZone(z, x, y)) k = z.k === "sticky" ? 2 : 1.5;
      if (z.k === "burner" && inCircle(z.c, x, y)) k = 1.6;
    }
    cost[j * GW + i] = ok ? k : 0;
  }
  const cell = (x: number, y: number) => Math.max(0, Math.min(GH - 1, Math.floor(y / CELL))) * GW + Math.max(0, Math.min(GW - 1, Math.floor(x / CELL)));
  const links = new Map<number, [number, number][]>();      // tubes: one end's mouth to the other's
  for (const t of c.tubes) {
    const g = tubeGeo(t), a = cell(t.ax - g.ux * (BALL_R + 4), t.ay - g.uy * (BALL_R + 4)), b = cell(t.bx + g.ux * (BALL_R + 4), t.by + g.uy * (BALL_R + 4));
    (links.get(a) ?? links.set(a, []).get(a)!).push([b, 30]); (links.get(b) ?? links.set(b, []).get(b)!).push([a, 30]);
  }
  const heap: number[][] = [];
  const push = (d: number, n: number) => { heap.push([d, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const start = cell(c.cup[0], c.cup[1]); dist[start] = 0; push(0, start);
  while (heap.length) {
    const [d, n] = pop(); if (d > dist[n]) continue;
    const i = n % GW, j = (n - i) / GW;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, b2 = j + dj; if (a < 0 || b2 < 0 || a >= GW || b2 >= GH) continue;
      const m = b2 * GW + a; if (!cost[m]) continue;
      const nd = d + (di && dj ? 1.4142 : 1) * CELL * cost[m];
      if (nd < dist[m]) { dist[m] = nd; push(nd, m); }
    }
    for (const [m, w] of links.get(n) ?? []) if (d + w < dist[m]) { dist[m] = d + w; push(d + w, m); }
  }
  fields.set(key, dist);
  return dist;
}
export function distAt(c: Course, f: Float64Array, x: number, y: number) {
  const GH = Math.ceil(c.h / CELL), i = Math.max(0, Math.min(GW - 1, Math.floor(x / CELL))), j = Math.max(0, Math.min(GH - 1, Math.floor(y / CELL)));
  let best = f[j * GW + i];
  if (best === Infinity) for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < GW && b < GH) best = Math.min(best, f[b * GW + a] + CELL * 1.5); }
  return best === Infinity ? 999 : best;
}
export type Brain = { rnd: () => number; sharp: number; k: number };
const POWERS = [0.1, 0.15, 0.2, 0.26, 0.32, 0.39, 0.46, 0.54, 0.62, 0.71, 0.8, 0.9, 1];
export function pullFor(ai: number, pow: number) {
  const [co, si] = TRIG[((ai % 720) + 720) % 720];
  return { px: Math.round(-co * pow * MAX_PULL * 100) / 100, py: Math.round(-si * pow * MAX_PULL * 100) / 100 };
}
function judge(c: Course, f: Float64Array, x: number, y: number, ai: number, pow: number, clock: number) {
  const { px, py } = pullFor(ai, pow), b = simPutt(c, x, y, px, py, clock);
  return b.done === 2 ? -100 + pow : b.done === 3 ? distAt(c, f, x, y) + 60 : distAt(c, f, b.x, b.y);
}
/** Plans a putt a bit at a time (it yields so a phone can keep drawing). With no brain it gives its best guess, no misses. */
export function* aiPlan(c: Course, x: number, y: number, clock: number, b: Brain | null): Generator<void, { px: number; py: number }> {
  const f = fieldFor(c), found: number[][] = [];
  let n = 0;
  for (let ai = 0; ai < 720; ai += 10) for (const pw of POWERS) { found.push([judge(c, f, x, y, ai, pw, clock), ai, pw]); if (++n % 40 === 0) yield; }
  found.sort((p, q) => p[0] - q[0]);
  const tried = found.slice(0, 4);
  for (const [, ai0, pw0] of found.slice(0, 4)) for (const da of [-4, -2, 2, 4]) for (const dp of [-0.06, -0.03, 0, 0.03, 0.06]) {
    const pw = Math.max(0.08, Math.min(1, pw0 + dp));
    tried.push([judge(c, f, x, y, ai0 + da, pw, clock), ai0 + da, pw]);
    if (++n % 40 === 0) yield;
  }
  // a putt that only works when it's perfect isn't a good plan: score the best few by how they do a little off
  tried.sort((p, q) => p[0] - q[0]);
  let best = tried[0], bestAvg = Infinity;
  for (const [s0, ai0, pw0] of tried.slice(0, 8)) {
    let tot = s0;
    for (const da of [-6, 0, 6]) for (const dp of [-0.08, 0, 0.08]) if (da || dp) tot += judge(c, f, x, y, ai0 + da, Math.max(0.08, Math.min(1, pw0 * (1 + dp))), clock);
    if (tot / 9 < bestAvg) { bestAvg = tot / 9; best = [s0, ai0, pw0]; }
    yield;
  }
  let ai = best[1], pw = best[2];
  if (b) {
    const noise = () => (b.rnd() + b.rnd() + b.rnd() - 1.5) * 2;   // roughly a bell curve, without trig
    const spread = b.sharp * Math.max(0.6, 1 - 0.03 * b.k);
    ai = Math.round(ai + noise() * 15 * spread); pw = Math.max(0.08, Math.min(1, pw * (1 + noise() * 0.28 * spread)));
    b.k++;
  }
  return pullFor(ai, pw);
}
export function sharpFor(mode: "daily" | "endless", round: number) { return mode === "daily" ? 1 : Math.max(0.6, 1 - 0.07 * (round - 1)); }
/** A hole's points for the player: 100 per stroke under 7, 100 per stroke under par, 200 more for a hole in one, 25 for beating the computer. */
export function holePoints(strokes: number, par: number, cpu: number) {
  if (strokes >= PICKUP) return 0;
  return (PICKUP - strokes) * 100 + Math.max(0, par - strokes) * 100 + (strokes === 1 ? 200 : 0) + (strokes < cpu ? 25 : 0);
}
export const WIN_BONUS = 500, TIE_BONUS = 200;
