// Kitchen racer rules: the six courses, the five food cars, the driving, the hot sauce / syrup / flour / burners, lap
// counting and the computer drivers. Pure: no React, no DOM, no network. The game, the live host, the guest's
// prediction and the headless balance check all run this exact code.
// Course coordinates: x right, y down, angles in radians from +x (canvas style). The whole course fits on screen.

export const AW = 360, AH = 520, DT = 1 / 60, LAPS = 3;
export const CAR_R = 10;                      // bump radius; a kart is drawn 28 long and 16 wide
export const V0 = 130, A0 = 1.7, TURN0 = 3.4, GRIP0 = 9;
export const BOOST_T = 0.9, BOOST_MULT = 1.38, OFF_MULT = 0.5, SYRUP_MULT = 0.5, BURNER_MULT = 0.6, BRAKE_MULT = 0.45;
export const CLOUD_T = 2.6, CLOUD_R = 46, BAG_CD = 5;
export const FINISH_WAIT = 8;                 // live and same phone: the other car gets this long to finish after the winner

export type Pt = { x: number; y: number };
// ── the cars ───────────────────────────────────────────────────────────────
export type CarSpec = { id: string; name: string; emoji: string; top: number; accel: number; grip: number; turn: number; mass: number;
  stats: [number, number, number, number]; blurb: string };   // stats: speed, grip, acceleration, weight (1 to 5)
export const CARS: CarSpec[] = [
  { id: "potato", name: "Potato", emoji: "1f954", top: 1.0, accel: 1.0, grip: 1.0, turn: 1.0, mass: 1.0, stats: [3, 3, 3, 3], blurb: "Good at everything." },
  { id: "watermelon", name: "Watermelon", emoji: "1f349", top: 1.07, accel: 0.7, grip: 1.0, turn: 0.98, mass: 1.75, stats: [4, 3, 1, 5], blurb: "Slow to start, hard to push." },
  { id: "blueberry", name: "Blueberry", emoji: "1fad0", top: 0.945, accel: 1.4, grip: 1.05, turn: 1.08, mass: 0.6, stats: [2, 4, 5, 1], blurb: "Quick off the line, easy to bump." },
  { id: "carrot", name: "Carrot", emoji: "1f955", top: 1.13, accel: 0.95, grip: 0.8, turn: 0.96, mass: 1.0, stats: [5, 1, 3, 3], blurb: "Fastest flat out. Takes corners wide." },
  { id: "donut", name: "Donut", emoji: "1f369", top: 0.93, accel: 1.05, grip: 1.4, turn: 1.12, mass: 1.05, stats: [2, 5, 3, 3], blurb: "Sticks to the corners." },
];

// ── the courses ────────────────────────────────────────────────────────────
// A course is a closed centre line (control points, smoothed), a width, kitchen props (some solid, so nobody cuts
// across), and its extras: hot sauce pads (boost), syrup puddles (slow), burners (slow while they glow) and flour bags
// (a cloud that hides the track nearby for a moment).
export type Prop = { k: "c"; x: number; y: number; r: number; solid: boolean; art: string; c?: string } | { k: "r"; x: number; y: number; w: number; h: number; solid: boolean; art: string; c?: string; rad?: number };
export type Pad = { at: number; off: number };                      // fraction of the lap, sideways offset from the centre line
export type Spot = { x: number; y: number; r: number };
export type Burner = Spot & { period: number; on: number; phase: number };
export type CourseDef = { id: string; name: string; theme: string; pts: number[][]; width: number; props: Prop[]; pads: Pad[]; syrup: Spot[]; burners: Burner[]; flour: Spot[]; par: number; decor?: [string, number, number, number][] };   // decor: emoji, x, y, size (off the track, just for looks)
export type Course = CourseDef & {
  cx: Float32Array; cy: Float32Array; th: Float32Array; cum: Float32Array; kap: Float32Array; n: number; L: number;
  padsAt: { x: number; y: number; a: number }[];
};

export const COURSES: CourseDef[] = [
  { id: "counter", name: "Countertop Loop", theme: "counter", width: 58, par: 42,
    pts: [[180, 450], [240, 450], [285, 438], [308, 405], [312, 350], [312, 290], [312, 230], [312, 170], [302, 118], [274, 86], [230, 74], [180, 72], [130, 74], [86, 86], [58, 118], [48, 170], [48, 230], [48, 290], [48, 350], [52, 405], [75, 438], [120, 450]],
    props: [{ k: "r", x: 180, y: 262, w: 150, h: 230, solid: true, art: "board", rad: 18 }],
    pads: [{ at: 0.33, off: 0 }, { at: 0.82, off: 0 }], syrup: [], burners: [], flour: [], decor: [["1f34b", 336, 26, 24], ["1f35e", 26, 496, 28], ["1f95a", 336, 496, 22]] },
  { id: "sink", name: "Around The Sink", theme: "sink", width: 54, par: 45,
    pts: [[180, 462], [270, 458], [316, 418], [318, 340], [292, 282], [316, 220], [314, 120], [272, 64], [180, 58], [92, 64], [48, 120], [44, 250], [48, 380], [86, 450]],
    props: [{ k: "r", x: 165, y: 258, w: 150, h: 260, solid: true, art: "sink", rad: 26 }],
    pads: [{ at: 0.86, off: 0 }], syrup: [{ x: 210, y: 61, r: 14 }], burners: [], flour: [], decor: [["1f34b", 338, 500, 22], ["1f9c2", 22, 500, 24]] },
  { id: "stove", name: "Stovetop", theme: "stove", width: 54, par: 54,
    pts: [[180, 466], [282, 462], [322, 418], [324, 300], [318, 150], [298, 82], [250, 64], [214, 96], [180, 170], [146, 96], [110, 64], [62, 82], [42, 150], [36, 300], [38, 418], [78, 462]],
    props: [{ k: "c", x: 180, y: 320, r: 74, solid: true, art: "pot" }, { k: "c", x: 252, y: 170, r: 30, solid: true, art: "pan" }, { k: "c", x: 108, y: 170, r: 30, solid: true, art: "pan" }],
    pads: [{ at: 0.1, off: 0 }],
    syrup: [], flour: [],
    burners: [{ x: 0, y: 0, r: 17, period: 5, on: 2.6, phase: 0 }, { x: 0, y: 0, r: 17, period: 5, on: 2.6, phase: 2.5 }, { x: 0, y: 0, r: 17, period: 5, on: 2.6, phase: 1.2 }] },
  { id: "fridge", name: "Fridge Shelves", theme: "fridge", width: 44, par: 62,
    pts: [[110, 450], [190, 450], [262, 450], [304, 432], [326, 390], [304, 348], [262, 330], [190, 330], [150, 330], [108, 312], [92, 270], [108, 228], [150, 210], [190, 210], [262, 210], [304, 192], [326, 150], [304, 108], [262, 90], [180, 90], [96, 90], [56, 104], [38, 150], [36, 270], [38, 390], [56, 436]],
    props: [
      { k: "r", x: 165, y: 390, w: 210, h: 8, solid: true, art: "shelf" }, { k: "r", x: 258, y: 270, w: 200, h: 8, solid: true, art: "shelf" },
      { k: "r", x: 168, y: 150, w: 204, h: 8, solid: true, art: "shelf" }, { k: "r", x: 63, y: 270, w: 8, h: 240, solid: true, art: "rail" },
    ],
    pads: [{ at: 0.47, off: 0 }, { at: 0.86, off: 0 }], syrup: [{ x: 214, y: 334, r: 12 }, { x: 160, y: 86, r: 12 }], burners: [], flour: [], decor: [["1f95a", 340, 28, 22], ["1f9c0", 132, 270, 24], ["1f95b", 340, 500, 24]] },
  { id: "pantry", name: "Pantry Maze", theme: "pantry", width: 48, par: 70,
    pts: [[170, 470], [262, 468], [314, 440], [318, 388], [278, 362], [200, 360], [142, 340], [130, 290], [170, 262], [262, 256], [312, 226], [318, 150], [300, 84], [250, 56], [208, 84], [196, 140], [150, 168], [104, 140], [96, 84], [64, 56], [36, 100], [34, 250], [38, 400], [72, 458]],
    props: [
      { k: "c", x: 228, y: 410, r: 30, solid: true, art: "jar" }, { k: "r", x: 230, y: 309, w: 150, h: 34, solid: true, art: "box" },
      { k: "c", x: 255, y: 160, r: 34, solid: true, art: "jar2" }, { k: "r", x: 150, y: 74, w: 40, h: 54, solid: true, art: "can" },
      { k: "r", x: 88, y: 290, w: 40, h: 200, solid: true, art: "boxes" },
    ],
    pads: [{ at: 0.04, off: 0 }, { at: 0.83, off: 0 }], syrup: [{ x: 228, y: 256, r: 12 }], burners: [], flour: [{ x: 316, y: 300, r: 14 }, { x: 36, y: 180, r: 14 }] },
  { id: "table", name: "Dinner Table", theme: "table", width: 50, par: 66,
    pts: [[180, 474], [270, 470], [318, 430], [312, 372], [262, 344], [250, 300], [292, 262], [322, 210], [318, 120], [290, 62], [230, 48], [190, 86], [150, 126], [100, 112], [62, 66], [36, 120], [42, 200], [96, 236], [118, 290], [74, 330], [40, 380], [48, 440], [96, 470]],
    props: [
      { k: "c", x: 180, y: 380, r: 56, solid: true, art: "plate" }, { k: "c", x: 196, y: 200, r: 60, solid: true, art: "plate2" },
      { k: "c", x: 268, y: 136, r: 22, solid: true, art: "glass" },
    ],
    pads: [{ at: 0.06, off: 0 }, { at: 0.55, off: 0 }], syrup: [{ x: 300, y: 380, r: 12 }, { x: 42, y: 160, r: 12 }], burners: [], flour: [{ x: 270, y: 300, r: 14 }, { x: 100, y: 470, r: 14 }] },
];

const wrapI = (i: number, n: number) => ((i % n) + n) % n;
export function wrapAngle(a: number) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export function mulberry32(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const SPACING = 4;
const built = new Map<number, Course>();
/** The course, with its centre line smoothed (Catmull-Rom) and resampled every 4 units. */
export function course(i: number): Course {
  const hit = built.get(i); if (hit) return hit;
  const d = COURSES[i], P = d.pts, m = P.length, raw: number[][] = [];
  for (let k = 0; k < m; k++) {
    const p0 = P[wrapI(k - 1, m)], p1 = P[k], p2 = P[wrapI(k + 1, m)], p3 = P[wrapI(k + 2, m)];
    for (let j = 0; j < 40; j++) {
      const t = j / 40, t2 = t * t, t3 = t2 * t;
      raw.push([0, 1].map(c => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  // resample evenly
  let total = 0; const seg: number[] = [];
  for (let k = 0; k < raw.length; k++) { const a = raw[k], b = raw[(k + 1) % raw.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push(l); total += l; }
  const n = Math.round(total / SPACING), step = total / n;
  const cx = new Float32Array(n), cy = new Float32Array(n), th = new Float32Array(n), cum = new Float32Array(n), kap = new Float32Array(n);
  let k = 0, acc = 0;
  for (let i = 0; i < n; i++) {
    const want = i * step;
    while (acc + seg[k] < want && k < raw.length - 1) { acc += seg[k]; k++; }
    const a = raw[k], b = raw[(k + 1) % raw.length], f = seg[k] > 0 ? (want - acc) / seg[k] : 0;
    cx[i] = a[0] + (b[0] - a[0]) * f; cy[i] = a[1] + (b[1] - a[1]) * f; cum[i] = want;
  }
  for (let i = 0; i < n; i++) { const a = wrapI(i - 1, n), b = wrapI(i + 1, n); th[i] = Math.atan2(cy[b] - cy[a], cx[b] - cx[a]); }
  for (let i = 0; i < n; i++) { const a = wrapI(i - 3, n), b = wrapI(i + 3, n); kap[i] = Math.abs(wrapAngle(th[b] - th[a])) / (6 * step); }
  const c: Course = { ...d, cx, cy, th, cum, kap, n, L: total, padsAt: [] };
  c.padsAt = d.pads.map(p => { const j = Math.round(p.at * n) % n, nx = -Math.sin(th[j]), ny = Math.cos(th[j]); return { x: cx[j] + nx * p.off, y: cy[j] + ny * p.off, a: th[j] }; });
  // burners sit on the centre line at fixed spots along the lap (the stove), defined here so the data stays readable
  if (d.id === "stove" && d.burners.length) {
    const at = [0.3, 0.5, 0.72];
    c.burners = d.burners.map((b, q) => { const j = Math.round(at[q] * n) % n, nx = -Math.sin(th[j]), ny = Math.cos(th[j]), side = q === 1 ? 0 : (q === 0 ? 1 : -1) * 10; return { ...b, x: cx[j] + nx * side, y: cy[j] + ny * side }; });
  }
  built.set(i, c);
  return c;
}

// ── the world ──────────────────────────────────────────────────────────────
/** steer -1 (left) .. 1 (right), brake; or a joystick: ax, ay = the screen direction to head for (the car steers toward
 *  it; pointing back past the car's side brakes too). q: the guest's input number. */
export type Input = { s: number; b: boolean; ax?: number; ay?: number; q?: number };
export const STICK_DEAD = 0.25;
/** A joystick direction turned into steering and braking for this car right now. */
export function stickSteer(h: number, ax: number, ay: number) {
  const mag = Math.sqrt(ax * ax + ay * ay);
  if (mag < STICK_DEAD) return { s: 0, b: false };
  const diff = wrapAngle(Math.atan2(ay, ax) - h);
  return { s: clamp(diff * 2.6, -1, 1), b: Math.abs(diff) > 2.0 };
}
export const NO_INPUT: Input = { s: 0, b: false };
export type Car = {
  x: number; y: number; h: number; vx: number; vy: number; st: number; boostT: number;
  pi: number; prog: number; best: number; laps: number[]; fin: number; spec: number; surf: number; bump: number;
};
export type Cloud = { id: number; x: number; y: number; t: number };
export type Ev = { id: number; k: "boost" | "bump" | "lap" | "finish" | "flour"; car: number; x: number; y: number; n: number };
export type World = { ci: number; c: Course; cars: Car[]; tick: number; time: number; clouds: Cloud[]; bagCd: number[]; nextId: number; events: Ev[]; order: number[] };

/** The starting grid: two by two behind the line, the first car on the left front. */
export function gridSpot(c: Course, slot: number) {
  const back = 16 + Math.floor(slot / 2) * 36, side = (slot % 2 ? 1 : -1) * Math.min(15, c.width / 2 - 11);
  const j = wrapI(Math.round(-back / (c.L / c.n)), c.n), nx = -Math.sin(c.th[j]), ny = Math.cos(c.th[j]);
  return { x: c.cx[j] + nx * side, y: c.cy[j] + ny * side, h: c.th[j], pi: j, prog: -back };
}
export function newCar(c: Course, slot: number, spec: number): Car {
  const g = gridSpot(c, slot);
  return { x: g.x, y: g.y, h: g.h, vx: 0, vy: 0, st: 0, boostT: 0, pi: g.pi, prog: g.prog, best: g.prog, laps: [], fin: -1, spec, surf: 0, bump: 0 };
}
/** `slots`: where each car starts on the grid (default: in order). */
export function newWorld(ci: number, specs: number[], slots?: number[]): World {
  const c = course(ci);
  return { ci, c, cars: specs.map((s, k) => newCar(c, slots ? slots[k] : k, s)), tick: 0, time: 0, clouds: [], bagCd: c.flour.map(() => 0), nextId: 1, events: [], order: [] };
}

/** Nearest centre-line point, searching near where the car was (so it can't jump to another part of the track). */
function track(car: Car, c: Course) {
  let best = car.pi, bd = 1e18;
  for (let o = -14; o <= 34; o++) {
    const j = wrapI(car.pi + o, c.n), dx = c.cx[j] - car.x, dy = c.cy[j] - car.y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = j; }
  }
  let ds = c.cum[best] - c.cum[car.pi];
  if (ds > c.L / 2) ds -= c.L; else if (ds < -c.L / 2) ds += c.L;
  car.pi = best; car.prog += ds;
  return Math.sqrt(bd);
}
/** Distance to the centre line anywhere (for on / off the track). */
function offTrack(x: number, y: number, c: Course, near: number) {
  let bd = near * near;
  for (let j = 0; j < c.n; j += 2) { const dx = c.cx[j] - x, dy = c.cy[j] - y, d = dx * dx + dy * dy; if (d < bd) bd = d; }
  return Math.sqrt(bd) > c.width / 2;
}
export function burnerOn(b: Burner, time: number) { return ((time + b.phase) % b.period) < b.on; }
function inSpot(x: number, y: number, s: Spot, extra = 0) { const dx = x - s.x, dy = y - s.y; return dx * dx + dy * dy < (s.r + extra) * (s.r + extra); }

function pushOutProps(car: Car, c: Course) {
  for (const p of c.props) {
    if (!p.solid) continue;
    let nx = 0, ny = 0, pen = 0;
    if (p.k === "c") {
      const dx = car.x - p.x, dy = car.y - p.y, d = Math.sqrt(dx * dx + dy * dy), m = p.r + CAR_R;
      if (d >= m) continue;
      if (d < 0.001) { nx = 0; ny = 1; } else { nx = dx / d; ny = dy / d; }
      pen = m - d;
    } else {
      const hx = p.w / 2, hy = p.h / 2, qx = clamp(car.x, p.x - hx, p.x + hx), qy = clamp(car.y, p.y - hy, p.y + hy);
      const dx = car.x - qx, dy = car.y - qy, d2 = dx * dx + dy * dy;
      if (d2 >= CAR_R * CAR_R) continue;
      if (d2 > 1e-6) { const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; pen = CAR_R - d; }
      else {
        const l = car.x - (p.x - hx), r = p.x + hx - car.x, u = car.y - (p.y - hy), b = p.y + hy - car.y, mm = Math.min(l, r, u, b);
        if (mm === l) { nx = -1; pen = l + CAR_R; } else if (mm === r) { nx = 1; pen = r + CAR_R; } else if (mm === u) { ny = -1; pen = u + CAR_R; } else { ny = 1; pen = b + CAR_R; }
      }
    }
    car.x += nx * pen; car.y += ny * pen;
    const vn = car.vx * nx + car.vy * ny;
    if (vn < 0) { car.vx -= vn * nx * 1.3; car.vy -= vn * ny * 1.3; car.vx *= 0.9; car.vy *= 0.9; }
  }
  if (car.x < CAR_R) { car.x = CAR_R; if (car.vx < 0) car.vx *= -0.3; }
  if (car.x > AW - CAR_R) { car.x = AW - CAR_R; if (car.vx > 0) car.vx *= -0.3; }
  if (car.y < CAR_R) { car.y = CAR_R; if (car.vy < 0) car.vy *= -0.3; }
  if (car.y > AH - CAR_R) { car.y = AH - CAR_R; if (car.vy > 0) car.vy *= -0.3; }
}

/** One car, one step: steering, the surface under it, speed, grip. Returns the surface (0 track, 1 off, 2 syrup, 3 burner). */
export function driveCar(car: Car, inp: Input, c: Course, time: number, done: boolean): number {
  const sp = CARS[car.spec];
  // the wheel follows the buttons quickly but not instantly, so tapping steers a little and holding steers a lot
  let si = inp.s, bi = inp.b;
  if (inp.ax !== undefined && inp.ay !== undefined) { const j = stickSteer(car.h, inp.ax, inp.ay); si = j.s; bi = bi || j.b; }
  const want = done ? 0 : clamp(si, -1, 1), rate = 8 * DT;
  car.st += clamp(want - car.st, -rate, rate);
  const fx0 = Math.cos(car.h), fy0 = Math.sin(car.h), vf0 = car.vx * fx0 + car.vy * fy0;
  const brake = !done && bi;
  const turn = TURN0 * sp.turn * clamp(0.35 + vf0 / 50, -0.6, 1) / (1 + Math.abs(vf0) / 260) * (brake ? 1.15 : 1);
  car.h = wrapAngle(car.h + car.st * turn * DT);
  const fx = Math.cos(car.h), fy = Math.sin(car.h);
  let vf = car.vx * fx + car.vy * fy, vl = -car.vx * fy + car.vy * fx;
  // what's under the car
  const off = offTrack(car.x, car.y, c, track(car, c));
  let surf = off ? 1 : 0, mult = off ? OFF_MULT : 1;
  for (const s of c.syrup) if (inSpot(car.x, car.y, s, 3)) { surf = 2; mult = Math.min(mult, SYRUP_MULT); }
  for (const b of c.burners) if (burnerOn(b, time) && inSpot(car.x, car.y, b, 2)) { surf = 3; mult = Math.min(mult, BURNER_MULT); }
  for (const p of c.padsAt) {
    const dx = car.x - p.x, dy = car.y - p.y, along = dx * Math.cos(p.a) + dy * Math.sin(p.a), side = -dx * Math.sin(p.a) + dy * Math.cos(p.a);
    if (Math.abs(along) < 13 && Math.abs(side) < 16 && !done) car.boostT = BOOST_T;
  }
  if (car.boostT > 0) { car.boostT = Math.max(0, car.boostT - DT); mult = Math.max(mult, BOOST_MULT); }
  const vmax = V0 * sp.top * mult * (done ? 0.35 : 1), target = brake ? vmax * BRAKE_MULT : vmax;
  if (vf < target) vf += (target - vf) * A0 * sp.accel * (car.boostT > 0 ? 2.2 : 1) * DT;
  else vf -= (vf - target) * (brake ? 3.4 : off ? 3 : 2.2) * DT;
  vl *= Math.exp(-GRIP0 * sp.grip * (off ? 0.8 : 1) * DT);
  car.vx = fx * vf - fy * vl; car.vy = fy * vf + fx * vl;
  car.x += car.vx * DT; car.y += car.vy * DT;
  pushOutProps(car, c);
  if (car.bump > 0) car.bump = Math.max(0, car.bump - DT);
  car.surf = surf;
  return surf;
}
/** Two cars touching: they push apart, the lighter one more. `oneSided` moves only `a` (the guest's prediction). */
export function bump(a: Car, b: Car, oneSided = false): number {
  const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, m = CAR_R * 2;
  if (d2 >= m * m) return 0;
  const d = Math.sqrt(d2) || 0.001, nx = d2 > 1e-6 ? dx / d : 1, ny = d2 > 1e-6 ? dy / d : 0;
  const ma = CARS[a.spec].mass, mb = CARS[b.spec].mass, pen = m - d;
  const fa = oneSided ? 1 : mb / (ma + mb), fb = oneSided ? 0 : ma / (ma + mb);
  a.x -= nx * pen * fa; a.y -= ny * pen * fa; b.x += nx * pen * fb; b.y += ny * pen * fb;
  const vrel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vrel < 0) {
    const j = (-(1 + 0.45) * vrel) / (1 / ma + 1 / mb);
    a.vx -= (j / ma) * nx; a.vy -= (j / ma) * ny;
    if (!oneSided) { b.vx += (j / mb) * nx; b.vy += (j / mb) * ny; }
    if (-vrel > 25) { a.bump = 0.3; if (!oneSided) b.bump = 0.3; }
    return -vrel;
  }
  return 0;
}
/** One 60th of a second of the race. */
export function stepWorld(w: World, inputs: Input[]) {
  w.tick++; w.time += DT;
  const c = w.c;
  w.cars.forEach((car, i) => {
    const before = car.prog, wasBoost = car.boostT;
    driveCar(car, inputs[i] ?? NO_INPUT, c, w.time, car.fin >= 0);
    if (car.boostT > wasBoost + 0.05) w.events.push({ id: w.nextId++, k: "boost", car: i, x: car.x, y: car.y, n: 0 });
    lapCheck(w, car, i, before);
  });
  for (let i = 0; i < w.cars.length; i++) for (let j = i + 1; j < w.cars.length; j++) {
    const hit = bump(w.cars[i], w.cars[j]);
    if (hit > 25) w.events.push({ id: w.nextId++, k: "bump", car: i, x: (w.cars[i].x + w.cars[j].x) / 2, y: (w.cars[i].y + w.cars[j].y) / 2, n: j });
  }
  // flour: driving through a bag puffs a cloud there for a moment
  c.flour.forEach((f, k) => {
    if (w.bagCd[k] > 0) { w.bagCd[k] = Math.max(0, w.bagCd[k] - DT); return; }
    const who = w.cars.findIndex(car => inSpot(car.x, car.y, f, CAR_R));
    if (who >= 0) { w.bagCd[k] = BAG_CD; w.clouds.push({ id: w.nextId++, x: f.x, y: f.y, t: CLOUD_T }); w.events.push({ id: w.nextId++, k: "flour", car: who, x: f.x, y: f.y, n: k }); }
  });
  for (let k = w.clouds.length - 1; k >= 0; k--) { w.clouds[k].t -= DT; if (w.clouds[k].t <= 0) w.clouds.splice(k, 1); }
}
function lapCheck(w: World, car: Car, i: number, before: number) {
  if (car.fin >= 0) return;
  const L = w.c.L;
  if (car.prog > car.best) car.best = car.prog;
  const done = Math.floor(car.best / L);
  while (car.laps.length < done && car.laps.length < LAPS) {
    car.laps.push(Math.round(w.time * 1000) / 1000);
    if (car.laps.length >= LAPS) { car.fin = w.time; w.order.push(i); w.events.push({ id: w.nextId++, k: "finish", car: i, x: car.x, y: car.y, n: w.order.length }); }
    else w.events.push({ id: w.nextId++, k: "lap", car: i, x: car.x, y: car.y, n: car.laps.length });
  }
  void before;
}
/** Race order: finished cars by finishing time, then by how far round they are. */
export function standings(w: World): number[] {
  const idx = w.cars.map((_, i) => i);
  return idx.sort((a, b) => {
    const A = w.cars[a], B = w.cars[b];
    if (A.fin >= 0 && B.fin >= 0) return A.fin - B.fin;
    if (A.fin >= 0) return -1; if (B.fin >= 0) return 1;
    return B.best - A.best;
  });
}
export const lapOf = (car: Car, L: number) => Math.min(LAPS, Math.max(1, Math.floor(car.best / L) + 1));
export function lapTimes(car: Car) { return car.laps.map((t, k) => t - (k ? car.laps[k - 1] : 0)); }

// ── scores ─────────────────────────────────────────────────────────────────
/** Today's time trial: 1,000 for finishing plus 100 a second under the course's par (3 laps). */
export function trialPoints(ci: number, secs: number) { return 1000 + Math.max(0, Math.round((COURSES[ci].par - secs) * 100)); }
/** Free Play race against the computer: points for the place, plus 50 a second under par. */
export const PLACE_PTS = [2000, 1200, 700, 400];
/** The computer cars in Free Play: the front one is a match for a decent driver on that course, the others a step
 *  behind; a bigger field is a little gentler, since you start at the back. The early courses get sloppier drivers
 *  (wider lines, more slips), and every computer car eases off when it's well ahead of you (see aiInput). */
export const FREE = { one: [0.5, 0.55, 0.52, 0.4, 0.36, 0.45], three: [0.5, 0.48, 0.53, 0.37, 0.38, 0.48], spread: 0.12, sl: [0.9, 0.8, 0.75, 0.7, 0.7, 0.7] };   // front car's skill vs 1 / vs 3
export function freeSkills(ci: number, n: number) { const top = n <= 1 ? FREE.one[ci] : n >= 3 ? FREE.three[ci] : (FREE.one[ci] + FREE.three[ci]) / 2; return [top, top - FREE.spread, top - 2 * FREE.spread].slice(0, n); }
export function freeBrains(ci: number, n: number, seed: number) { return freeSkills(ci, n).map((s, k) => newBrain(seed + k * 7919, Math.max(-0.3, s), FREE.sl[ci])); }
export function racePoints(ci: number, place: number, secs: number) { return PLACE_PTS[place] + Math.max(0, Math.round((COURSES[ci].par - secs) * 50)); }

// ── the computer ───────────────────────────────────────────────────────────
// It looks ahead along the centre line (further when it's going faster), steers toward that point plus a lane offset
// that drifts about, and brakes when a bend coming up is sharper than its car can take at this speed. Imperfect on
// purpose: its sense of how fast it can take a bend, its lane, its reactions and a little steering wobble all get
// better with `s` but never perfect. Sharper drivers also steer round syrup and line up hot sauce pads.
export type Brain = { rnd: () => number; s: number; sl: number; lane: number; laneT: number; laneGoal: number; wob: number; wobT: number; slip: number; slipT: number; push: number };
/** `sl` (0 to 1): extra sloppiness, wider lines and more slips (Free Play's computer cars on the early courses). */
export function newBrain(seed: number, s: number, sl = 0): Brain {
  const rnd = mulberry32(seed);
  return { rnd, s, sl, lane: 0, laneT: 0, laneGoal: 0, wob: 0, wobT: 0, slip: 0, slipT: 2 + rnd() * 4, push: 0.98 - 0.08 * sl + (rnd() - 0.5) * (0.08 + 0.22 * sl) };   // its pace for the race: sloppier drivers vary more from race to race
}
/** The fastest the car can take a bend of curvature k (and still hold its line). */
export function bendSpeed(k: number, spec: CarSpec) {
  const T = TURN0 * spec.turn * Math.min(1, Math.pow(spec.grip, 0.6)) * 0.86;
  if (k < 1e-4) return 1e9;
  // v * k * (1 + v / 260) = T  ->  v^2 k / 260 + v k - T = 0
  const a = k / 260, b = k, cc = -T;
  return (-b + Math.sqrt(b * b - 4 * a * cc)) / (2 * a);
}
/** `chase`: how far round the course the human furthest round is (Free Play). A computer car well ahead of that eases
 *  off a little, so a race stays close; it never speeds up to catch you. */
export function aiInput(w: World, b: Brain, me: number, chase = Infinity): Input {
  const car = w.cars[me], c = w.c, sp = CARS[car.spec], s = b.s, step = c.L / c.n;
  const spd = Math.hypot(car.vx, car.vy);
  // lane: drifts slowly around the middle; better drivers stay closer to the line and dodge syrup
  b.laneT -= DT;
  if (b.laneT <= 0) { b.laneT = 0.8 + b.rnd() * 1.6; b.laneGoal = (b.rnd() * 2 - 1) * c.width * 0.26 * (1.15 - s) * (1 + b.sl); }
  let goal = b.laneGoal;
  const away = Math.hypot(c.cx[car.pi] - car.x, c.cy[car.pi] - car.y) > c.width / 2 + 4;   // off the track: head straight back to it
  const look = away ? 10 : 14 + spd * 0.3;
  if (away) goal = 0;
  const ahead = wrapI(car.pi + Math.round(look / step), c.n);
  if (s > 0.35) {
    for (const sy of c.syrup) {
      for (let o = 4; o < 30; o += 4) {
        const j = wrapI(car.pi + o, c.n);
        if (Math.hypot(c.cx[j] - sy.x, c.cy[j] - sy.y) < sy.r + 14) { const nx = -Math.sin(c.th[j]), ny = Math.cos(c.th[j]); const side = (sy.x - c.cx[j]) * nx + (sy.y - c.cy[j]) * ny; goal = side > 0 ? -c.width * 0.3 : c.width * 0.3; break; }
      }
    }
  }
  b.lane += (goal - b.lane) * Math.min(1, DT * 2.5);
  const nx = -Math.sin(c.th[ahead]), ny = Math.cos(c.th[ahead]);
  const tx = c.cx[ahead] + nx * b.lane, ty = c.cy[ahead] + ny * b.lane;
  // wobble and the odd slip of concentration (less with skill)
  b.wobT -= DT; if (b.wobT <= 0) { b.wobT = 0.25 + b.rnd() * 0.4; b.wob = (b.rnd() * 2 - 1) * 0.35 * (1 - s + 0.5 * b.sl); }
  b.slipT -= DT; if (b.slipT <= 0) { b.slipT = 3 + b.rnd() * 6 + s * 6; b.slip = b.rnd() < 0.6 * (1 - s) + 0.3 * b.sl ? 0.35 + b.rnd() * (0.3 + 0.3 * b.sl) : 0; }
  const slipping = b.slip > 0; if (slipping) b.slip = Math.max(0, b.slip - DT);
  const want = Math.atan2(ty - car.y, tx - car.x), diff = wrapAngle(want - car.h);
  let steer = clamp(diff * 3.2 + b.wob, -1, 1);
  if (slipping) steer *= 0.3;   // a moment of not quite turning enough
  // brake for bends: the slowest bend speed over the stopping distance ahead, with the driver's judgement
  const judge = (0.74 + 0.28 * s) * b.push, dist = 30 + spd * 0.9;
  let brake = false;
  for (let o = 2; o * step < dist; o += 2) {
    const j = wrapI(car.pi + o, c.n), vb = bendSpeed(c.kap[j], sp) * judge, room = o * step;
    if (spd > Math.sqrt(vb * vb + 2 * 150 * room)) { brake = true; break; }
  }
  // never flat out everywhere: weaker drivers ease off a touch on the straights too
  const lead = car.best - chase, ease = lead > 40 ? Math.max(0.8, 1 - (lead - 40) / 300) : 1;
  if (spd > V0 * sp.top * (0.8 + 0.22 * s) * Math.sqrt(b.push) * ease * (car.boostT > 0 ? BOOST_MULT : 1)) brake = true;
  return { s: Math.round(steer * 100) / 100, b: brake };
}
