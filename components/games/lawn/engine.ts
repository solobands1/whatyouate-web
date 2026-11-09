// The running game for Pat's Lawnmower: input, the tractor, mowing, the cat, each job's twist, the camera, lighting and
// weather, and the debug hooks the browser tests use (only with ?debug=1). One engine runs per screen: the title screen
// runs it in "attract" mode (the tractor mows on its own behind the menu), a job or Free Mow in "job" / "free" mode.
import { LAWN_MAP, toMetres, type Pt } from "../lawnMap";
import { buildWorld, pushOut, CELL, BODY_R, NEED_R } from "./world";
import { clamp, wrapA, smooth, pip, polyClosest, mulberry32 } from "./geo";
import { makeGrass, makeGround, drawTree, drawBuilding, drawMower, drawCat, drawPerson, drawFire, drawApple, drawPuddle, stripeCol, oldStripeCol, pathPoly, OBL, type CatPose } from "./art";
import { DECKS, GEARS, PAINTS, type Job, type Upgrades, type Outcome } from "./jobs";
import type { Sound } from "./sound";

export type Mode = "attract" | "job" | "free";
export type Meter = { label: string; value: string; frac: number; good: boolean };
export type Hud = { pct: number; time: number; limit: number; par: number; meter: Meter | null; canFinish: boolean; phase: Phase };
export type Phase = "ready" | "play" | "scene" | "over";
export type Hooks = {
  paused: () => boolean;
  onHud: (h: Hud) => void;
  onStart: () => void;
  onEnd: (o: Outcome) => void;
  finishRef: { current: (() => void) | null };
};
export type Config = { mode: Mode; job: Job; up: Upgrades; sound: Sound; debug: boolean; showStrip: boolean };

const STEP = 1 / 60;
const FONT = "system-ui, -apple-system, sans-serif";
const DECK_LON = 0.9;                 // half the deck's length front to back (grid)
const ACC = 6, DEC = 10, VREV = 2.2;
const DEAD = 0.22;                    // joystick dead zone (fraction of its throw)
const rmin = (v: number) => 0.85 + 0.2 * Math.abs(v);   // tightest turn (radius) at a speed: about 1 m when slow
const CAT_R = 0.5, MEOW_D = 3.2, STOP_T = 2, PENALTY = 3;
const APPLE_V = 3.3;                  // no faster than this over apples, or they squish
const DONE_AT = 0.99;                 // a job counts as done at 99% (the last few blades are never worth chasing)
const VIEW_M = 16;                    // metres across the map's short side
export const STRIP = 124;             // the joystick strip under the map
const STICK_R = 40;
const SHIRTS = ["#d9534f", "#4e8ad6", "#f0ad4e", "#6aa84f", "#9b6bd6", "#e07b9b", "#3fb3a8"], HAIRS = ["#3b2a20", "#c99a5b", "#1f1a17", "#7a4a2a", "#e3d3a8", "#5b3a29"], SKINS = ["#f1c7a3", "#d9a37c", "#a8714f", "#f5d0b3"];

type Cat = CatPose & { st: "in" | "out" | "home" | "flee"; actT: number; tx: number; ty: number; outT: number; next: number; fleeT: number; cool: number };
type Part = { x: number; y: number; vx: number; vy: number; life: number; c: string; s: number };
type Float = { text: string; x: number; y: number; t: number; color: string };
type Apple = { x: number; y: number; st: 0 | 1 | 2 };   // 0 on the grass, 1 picked up, 2 squished
type Puddle = { x: number; y: number; rx: number; ry: number; rot: number };

export function startEngine(canvas: HTMLCanvasElement, wrap: HTMLElement, cfg: Config, hooks: Hooks) {
  const map = toMetres(LAWN_MAP), w = buildWorld(map), job = cfg.job, mode = cfg.mode, snd = cfg.sound;
  const rnd = mulberry32((Math.random() * 1e9) | 0);
  const deckHalf = DECKS[cfg.up.deck] ?? DECKS[0], vmax = GEARS[cfg.up.gear] ?? GEARS[0], paint = PAINTS[cfg.up.paint] ?? PAINTS.orange;
  const zone = (names: string[] | null) => (names ? names.map(n => map.zones[n]).filter(Boolean) : null);
  const jobNeed = w.maskIn(w.need, zone(job.zones));
  let needCount = 0; for (let k = 0; k < w.N; k++) needCount += jobNeed[k];
  const areaM2 = needCount * CELL * CELL;
  let limit = mode === "job" ? job.limit ?? Math.round(areaM2 / job.pace / 5) * 5 + 20 : 0, par = job.par ?? Math.round(limit * 0.72);
  const PX = Math.max(8, Math.min(26, 4000 / Math.max(w.W, w.H), Math.sqrt(6.5e6 / (w.W * w.H))));
  const grass = makeGrass(map, PX), groundCv = makeGround(map, PX);
  const ctx = canvas.getContext("2d")!;
  const lightCv = document.createElement("canvas"), lc = lightCv.getContext("2d")!;
  const treeBlobs = map.trees.map((t, i) => { const r = mulberry32(100 + i), out: number[][] = []; for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + r(), d = 0.45 + r() * 0.2; out.push([Math.cos(a) * d, Math.sin(a) * d, 0.42 + r() * 0.12, r()]); } return out; });
  const treeAlpha = map.trees.map(() => 0.95), roofAlpha = map.buildings.map(() => 1);
  // grass speckle pinned to the ground
  const noise = document.createElement("canvas"); noise.width = noise.height = 96;
  { const nc = noise.getContext("2d")!, img = nc.createImageData(96, 96); for (let k = 0; k < 96 * 96; k++) { const v = Math.random(); img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = v < 0.5 ? 0 : 255; img.data[k * 4 + 3] = Math.random() < 0.5 ? 0 : 16; } nc.putImageData(img, 0, 0); }
  const noisePat = ctx.createPattern(noise, "repeat"); try { noisePat?.setTransform(new DOMMatrix().scale(1 / 20)); } catch {}

  // ── the grid: what's cut. Lawn outside today's job (and slivers the tractor can't reach) shows as mowed earlier ──
  const cut = new Uint8Array(w.N);
  {
    const g = grass.c, zp = zone(job.zones);
    if (zp) {
      // everything outside today's job: neat stripes from earlier in the week, with clean straight edges along the zone
      const tmp = document.createElement("canvas"); tmp.width = grass.cv.width; tmp.height = grass.cv.height; tmp.getContext("2d")!.drawImage(grass.cv, 0, 0);
      for (let sx = 0; sx < w.W; sx += 4) { g.fillStyle = oldStripeCol(sx + 0.1); g.fillRect(sx, 0, 4.02, w.H); }
      g.save(); g.beginPath(); for (const z of zp) { z.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); } g.clip();
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(tmp, 0, 0); g.restore();
    }
    for (let k = 0; k < w.N; k++) if (w.lawn[k] && !jobNeed[k]) {
      cut[k] = 1; const x = w.cellX(k), y = w.cellY(k);
      if (!zp || zp.some(z => pip(z, x, y))) { g.fillStyle = oldStripeCol(x); g.fillRect(x - CELL * 0.52, y - CELL * 0.52, CELL * 1.04, CELL * 1.04); }   // spots too tight to mow count as trimmed
    }
  }
  const mm = document.createElement("canvas"); mm.width = w.NX; mm.height = w.NY;
  const mmc = mm.getContext("2d")!, mmImg = mmc.createImageData(w.NX, w.NY);
  const paintCell = (k: number) => { const o = k * 4; if (!w.lawn[k]) { mmImg.data[o + 3] = 0; return; } const todo = jobNeed[k] && !cut[k]; mmImg.data[o] = todo ? 52 : 168; mmImg.data[o + 1] = todo ? 104 : 212; mmImg.data[o + 2] = todo ? 34 : 112; mmImg.data[o + 3] = 255; };
  for (let k = 0; k < w.N; k++) paintCell(k);
  mmc.putImageData(mmImg, 0, 0);
  let mmDirty = false;

  // ── state ──
  let phase: Phase = mode === "attract" ? "play" : "ready";
  let x = map.start.x, y = map.start.y, h = ((map.start.heading - 90) * Math.PI) / 180, v = 0, om = 0, steer = 0, odo = 0;
  if (job.zones && mode === "job") {   // jobs start at the edge of their own piece of lawn, facing into it
    let best = -1, bd = Infinity, zx = 0, zy = 0, zn = 0;
    for (let k = 0; k < w.N; k++) if (jobNeed[k]) { zx += w.cellX(k); zy += w.cellY(k); zn++; }
    zx /= zn || 1; zy /= zn || 1;
    for (let k = 0; k < w.N; k++) if (jobNeed[k] && w.reach[k] && w.clearance[k] > 2.2) { const d = Math.hypot(w.cellX(k) - map.start.x, w.cellY(k) - map.start.y); if (d < bd) { bd = d; best = k; } }
    if (best >= 0) { x = w.cellX(best); y = w.cellY(best); h = Math.atan2(zy - y, zx - x); }
  }
  { const p = pushOut(w, x, y, BODY_R, null); x = p.x; y = p.y; }
  let uturn = 0, revT = 0, revSide = 0, stuckN = 0, blockedT = 0, backHoldT = 0, stopT = 0, shake = 0, bumpCool = 0;
  let simT = 0, penalty = 0, meows = 0, bumps = 0, cutCount = 0, drove = 0, frame = 0, sceneT = 0, success = false, ended = false;
  let freshAll = 0, freshStraight = 0, wetT = 0;
  const floats: Float[] = [], parts: Part[] = [];
  let toast = { text: "", t: 0 }, banner = { text: "", sub: "", t: 0 };
  const say = (text: string) => { toast = { text, t: 3 }; };
  const floatAt = (text: string, fx: number, fy: number, color = "#ffffff") => floats.push({ text, x: fx, y: fy, t: 1.4, color });
  let camX = x, camY = y, camS = 0, missed: number[] = [], missedAt = -1;
  const firePit = map.props.find(p => p.kind === "firepit"), chairs = map.props.filter(p => p.kind === "chair"), pits = map.props.filter(p => p.kind === "horseshoe");
  const deck = map.buildings.find(b => b.kind === "deck");
  let fireAmt = 0, rainAmt = 0, guestsIn = false, priorityOk = false, priorityTold = false, thunderAt = 0;
  const people: { x: number; y: number; a: number; shirt: string; hair: string; skin: string; pose: "sit" | "stand" | "throw"; fade: number }[] = [];
  const addPeople = (spots: [number, number, number, "sit" | "stand" | "throw"][]) => { for (const [px, py, a, pose] of spots) people.push({ x: px, y: py, a, pose, shirt: SHIRTS[people.length % SHIRTS.length], hair: HAIRS[(people.length * 3) % HAIRS.length], skin: SKINS[(people.length * 5) % SKINS.length], fade: 0 }); };
  const fireSpots = (): [number, number, number, "sit" | "stand" | "throw"][] => {
    if (!firePit) return [];
    const out: [number, number, number, "sit" | "stand" | "throw"][] = chairs.map(c => [c.x, c.y, Math.atan2(firePit.y - c.y, firePit.x - c.x), "sit"]);
    for (const a of [0.9, 2.3, 3.7, 5.1]) { const px = firePit.x + Math.cos(a) * 2.4, py = firePit.y + Math.sin(a) * 2.4; out.push([px, py, a + Math.PI, "stand"]); }
    return out;
  };

  // twists
  const priorityMask = job.twist === "guests" ? w.maskIn(jobNeed, zone(["priorityPits", "priorityPath"])) : null;
  let priorityTotal = 0, priorityCut = 0; if (priorityMask) for (let k = 0; k < w.N; k++) priorityTotal += priorityMask[k];
  const puddles: Puddle[] = [], apples: Apple[] = [];
  const needCells: number[] = []; for (let k = 0; k < w.N; k++) if (jobNeed[k] && w.reach[k]) needCells.push(k);
  if (job.twist === "storm") {
    for (let t = 0; t < 400 && puddles.length < 7; t++) {
      const k = needCells[Math.floor(rnd() * needCells.length)]; if (k === undefined) break;
      const px = w.cellX(k), py = w.cellY(k);
      if (puddles.some(p => Math.hypot(p.x - px, p.y - py) < 9)) continue;
      puddles.push({ x: px, y: py, rx: 1.6 + rnd() * 1.4, ry: 1.0 + rnd() * 0.8, rot: rnd() * Math.PI });
    }
  }
  if (job.twist === "apples") {
    const trees = map.trees.filter(t => t.kind === "fruit");
    for (let t = 0; t < 2000 && apples.length < 12; t++) {
      const tr = trees[apples.length % trees.length]; if (!tr) break;
      const a = rnd() * Math.PI * 2, d = tr.r * (0.55 + rnd() * 0.85), ax = tr.x + Math.cos(a) * d, ay = tr.y + Math.sin(a) * d, k = w.cellOf(ax, ay);
      if (!jobNeed[k] || !w.reach[k] || apples.some(p => Math.hypot(p.x - ax, p.y - ay) < 1.4)) continue;
      apples.push({ x: ax, y: ay, st: 0 });
    }
  }
  const clouds = job.twist === "storm" ? Array.from({ length: 6 }, (_, i) => ({ x: rnd() * w.W, y: rnd() * w.H, r: 14 + rnd() * 12, sp: 1.2 + rnd() * 0.8, i })) : [];

  // the cat
  const catCfg = job.twist === "cat" ? { first: 3, gap: [3, 6], out: [26, 40], walk: 1.25 } : { first: 8, gap: [30, 60], out: [18, 30], walk: 0.9 };
  const cat: Cat = { st: "in", x: map.door.x, y: map.door.y, h: Math.PI / 2, act: "idle", actT: 0, tx: 0, ty: 0, outT: 0, next: mode === "attract" ? 4 : catCfg.first + rnd() * 6, fleeT: 0, cool: 0, phase: rnd() * 6 };
  let bubbleT = 0, catSeen = false;

  // input
  type Stick = { id: number; bx: number; by: number; kx: number; ky: number };
  let stick: Stick | null = null;
  const keys: Record<string, boolean> = {};
  let testIn: [number, number] | null = null, auto = mode === "attract", speedK = 1;
  // layout
  let CW = 300, CH = 400, MH = 276, dpr = 1;
  const resize = () => {
    CW = wrap.clientWidth; CH = wrap.clientHeight; MH = cfg.showStrip ? Math.max(120, CH - STRIP) : CH; dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${CW}px`; canvas.style.height = `${CH}px`; canvas.width = Math.round(CW * dpr); canvas.height = Math.round(CH * dpr);
    lightCv.width = Math.max(1, Math.round(CW)); lightCv.height = Math.max(1, Math.round(MH));
  };
  resize();
  const ro = new ResizeObserver(resize); ro.observe(wrap); window.addEventListener("resize", resize);
  const stickRest = () => ({ x: CW / 2, y: MH + 8 + (STRIP - 8) / 2 - 6 });
  const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onMove = (e: PointerEvent) => {
    if (!stick || stick.id !== e.pointerId) return;
    const p = local(e), dx = p.x - stick.bx, dy = p.y - stick.by, d = Math.hypot(dx, dy);
    stick.kx = d > STICK_R ? (dx / d) * STICK_R : dx; stick.ky = d > STICK_R ? (dy / d) * STICK_R : dy;
  };
  const onDown = (e: PointerEvent) => {
    if (!cfg.showStrip) return;
    const p = local(e); if (p.y < MH + 4 || stick) return;
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    stick = { id: e.pointerId, bx: clamp(p.x, STICK_R, CW - STICK_R), by: clamp(p.y, MH + 8 + STICK_R, CH - STICK_R), kx: 0, ky: 0 };
    onMove(e); e.preventDefault();
  };
  const onUp = (e: PointerEvent) => { if (stick?.id === e.pointerId) stick = null; };
  const KEYS: Record<string, string> = { KeyW: "u", ArrowUp: "u", KeyS: "d", ArrowDown: "d", KeyA: "l", ArrowLeft: "l", KeyD: "r", ArrowRight: "r" };
  const onKey = (e: KeyboardEvent) => { const k = KEYS[e.code]; if (!k || !cfg.showStrip) return; e.preventDefault(); keys[k] = e.type === "keydown"; };
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);
  window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey);

  // ── autopilot (attract mode and the browser tests): plans along the grid, then drives with the same stick ──
  let path: number[] = [], pathAt = 0, planT = 0, goal = -1, goalK = -1, goalT = 0, appleGoal = -1;
  const skip = new Uint8Array(w.N);
  const offsR = (r: number) => { const out: number[][] = [], c = Math.ceil(r / CELL); for (let dj = -c; dj <= c; dj++) for (let di = -c; di <= c; di++) if (Math.hypot(di, dj) * CELL <= r) out.push([di, dj]); return out; };
  const offsTight = offsR(0.55), offsWide = offsR(NEED_R);
  const todo = (n: number) => jobNeed[n] && !cut[n] && !skip[n];
  const uncutNear = (k: number, offs: number[][], pri: boolean) => { const i = k % w.NX, j = (k - i) / w.NX; for (const [di, dj] of offs) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= w.NX || b >= w.NY) continue; const n = b * w.NX + a; if (todo(n) && (!pri || priorityMask![n])) return n; } return -1; };
  function startCellNear() {
    let from = w.reach[w.cellOf(x, y)] ? w.cellOf(x, y) : -1;
    if (from < 0) { let bd = Infinity; const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL); for (let dj = -5; dj <= 5; dj++) for (let di = -5; di <= 5; di++) { const a = ci + di, b = cj + dj; if (a < 0 || b < 0 || a >= w.NX || b >= w.NY) continue; const n = b * w.NX + a; if (w.reach[n] && Math.hypot(di, dj) < bd) { bd = Math.hypot(di, dj); from = n; } } }
    return from;
  }
  function plan() {
    const from = startCellNear(); path = []; pathAt = 0; appleGoal = -1;
    if (from < 0) return;
    const prev = new Int32Array(w.N).fill(-2), dist = new Int32Array(w.N); const q = [from]; prev[from] = -1;
    // apples first (drive right over them), then priority spots, then the nearest uncut grass, preferring straight ahead
    const appleCells = new Map<number, number>(); apples.forEach((a, i) => { if (a.st === 0) appleCells.set(w.cellOf(a.x, a.y), i); });
    const pri = !!priorityMask && priorityCut < priorityTotal;
    for (const offs of [offsTight, offsWide]) {
      prev.fill(-2); prev[from] = -1; q.length = 0; q.push(from); dist[from] = 0;
      let found = -1, foundD = Infinity, best = -1, bestScore = Infinity, bestU = -1;
      for (let qi = 0; qi < q.length; qi++) {
        const k = q[qi];
        if (found >= 0 && dist[k] > foundD + 12) break;
        if (appleCells.size) { if (appleCells.has(k)) { best = k; bestU = k; appleGoal = appleCells.get(k)!; break; } }
        else {
          const u = uncutNear(k, offs, pri);
          if (u >= 0) {
            if (found < 0) { found = k; foundD = dist[k]; }
            const dx = w.cellX(k) - x, dy = w.cellY(k) - y, dd = Math.hypot(dx, dy) || 1, along = (dx * Math.cos(h) + dy * Math.sin(h)) / dd;
            const score = dist[k] * CELL - 3 * along;
            if (score < bestScore) { bestScore = score; best = k; bestU = u; }
          }
        }
        const i = k % w.NX, j = (k - i) / w.NX;
        for (const n of [i > 0 ? k - 1 : -1, i < w.NX - 1 ? k + 1 : -1, j > 0 ? k - w.NX : -1, j < w.NY - 1 ? k + w.NX : -1]) if (n >= 0 && w.reach[n] && prev[n] === -2) { prev[n] = k; dist[n] = dist[k] + 1; q.push(n); }
      }
      if (best >= 0) { const p: number[] = []; for (let c = best; c >= 0; c = prev[c]) p.push(c); path = p.reverse(); goalK = best; if (bestU !== goal) { goal = bestU; goalT = 0; } return; }
      if (appleCells.size) { apples.forEach(a => { if (a.st === 0) a.st = 2; }); return; }
    }
  }
  // the main plan is how a tidy person mows: straight north-south stripes a deck-width apart, end to end, with a U-turn
  // at each end; then it tidies up whatever's left, nearest first
  type Seg = { ax: number; ay: number; bx: number; by: number; x: number };
  const segs: Seg[] = []; let segI = 0, segMode: "to" | "on" = "to", segT = 0, toPath: number[] = [], toAt = 0, toPlanT = 0;
  function buildSegs(mask: Uint8Array) {
    const out: Seg[] = []; let x0 = Infinity, x1 = -Infinity;
    for (let k = 0; k < w.N; k++) if (mask[k]) { x0 = Math.min(x0, w.cellX(k)); x1 = Math.max(x1, w.cellX(k)); }
    if (!isFinite(x0)) return out;
    const spacing = deckHalf * 1.8, drivable = (k: number) => w.reach[k] && w.clearance[k] >= BODY_R + 0.2;
    let lane = 0;
    for (let lx = x0 + deckHalf * 0.85; lx <= x1 + deckHalf * 0.5; lx += spacing, lane++) {
      const ci = clamp(Math.floor(lx / CELL), 0, w.NX - 1), span = Math.ceil(deckHalf / CELL), runs: Seg[] = [];
      let runStart = -1;
      for (let j = 0; j <= w.NY; j++) {
        let ok = false;
        if (j < w.NY && drivable(j * w.NX + ci)) for (let d = -span; d <= span && !ok; d++) { const ii = ci + d; if (ii >= 0 && ii < w.NX && mask[j * w.NX + ii]) ok = true; }
        if (ok && runStart < 0) runStart = j;
        if (!ok && runStart >= 0) { const a0 = runStart + 2, b0 = j - 3; if (b0 - a0 >= 2) runs.push({ ax: w.cellX(ci), ay: (a0 + 0.5) * CELL, bx: w.cellX(ci), by: (b0 + 0.5) * CELL, x: lx }); runStart = -1; }
      }
      if (lane % 2) runs.reverse().forEach(r => out.push({ ax: r.bx, ay: r.by, bx: r.ax, by: r.ay, x: r.x }));
      else runs.forEach(r => out.push(r));
    }
    return out;
  }
  function pathTo(target: number) {
    const from = startCellNear(); if (from < 0 || target < 0) return [];
    const prev = new Int32Array(w.N).fill(-2), q = [from]; prev[from] = -1;
    for (let qi = 0; qi < q.length; qi++) {
      const k = q[qi]; if (k === target) break;
      const i = k % w.NX, j = (k - i) / w.NX;
      for (const n of [i > 0 ? k - 1 : -1, i < w.NX - 1 ? k + 1 : -1, j > 0 ? k - w.NX : -1, j < w.NY - 1 ? k + w.NX : -1]) if (n >= 0 && w.reach[n] && prev[n] === -2) { prev[n] = k; q.push(n); }
    }
    if (prev[target] === -2) return [];
    const p: number[] = []; for (let c = target; c >= 0; c = prev[c]) p.push(c); return p.reverse();
  }
  const segLeft = (sg: Seg) => { let n = 0, t = 0; const L = Math.hypot(sg.bx - sg.ax, sg.by - sg.ay); for (let d = 0; d <= L; d += CELL * 2) { const px = sg.ax + ((sg.bx - sg.ax) * d) / (L || 1), py = sg.ay + ((sg.by - sg.ay) * d) / (L || 1); for (let o = -deckHalf; o <= deckHalf; o += CELL) { const k = w.cellOf(px + o, py); if (jobNeed[k]) { t++; if (!cut[k]) n++; } } } return t ? n / t : 0; };
  let lastIn: [number, number] = [0, 0];
  let segsBuilt = false, lastCut = -1, idleT = 0;
  /** Follows a grid path: aims a little way ahead, closer in where things are tight. */
  const sightOk = (bx: number, by: number) => { const L = Math.hypot(bx - x, by - y), n = Math.ceil(L / 0.3); for (let q = 1; q <= n; q++) { const k = w.cellOf(x + ((bx - x) * q) / n, y + ((by - y) * q) / n); if (!w.reach[k] || w.clearance[k] < BODY_R + 0.12) return false; } return true; };
  function followPath(p: number[], at: number): [number, number, number] {
    while (at < p.length - 1 && Math.hypot(w.cellX(p[at]) - x, w.cellY(p[at]) - y) < 1.0) at++;
    // aim at the farthest point on the path that's in plain sight (up to 12 m), so the tractor drives straight lines
    let la = at;
    for (let q = Math.min(p.length - 1, at + 24); q > at; q--) if (sightOk(w.cellX(p[q]), w.cellY(p[q]))) { la = q; break; }
    const dx = w.cellX(p[la]) - x, dy = w.cellY(p[la]) - y, d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d, at];
  }
  let anchorX = 0, anchorY = 0, anchorT = 0;
  function autoInput(dt: number): [number, number] {
    // wedged somewhere for a few seconds: back out, forget that target and plan again
    anchorT += dt;
    if (Math.hypot(x - anchorX, y - anchorY) > 1.2) { anchorX = x; anchorY = y; anchorT = 0; }
    else if (anchorT > 4) { anchorT = 0; revT = 1.2; revSide = rnd() < 0.5 ? 1 : -1; if (goal >= 0) skip[goal] = 1; goal = -1; planT = 0; toPath = []; if (segI < segs.length && segMode === "to") segI++; }
    const [ax2, ay2] = autoRaw(dt), m0 = Math.hypot(ax2, ay2);
    if (!m0) return [0, 0];
    // the wanted speed (0..1) becomes a push past the dead zone, like a thumb would
    let want = Math.min(1, m0) * clamp(w.clearance[w.cellOf(x, y)] / 2.0, 0.55, 1);   // easy does it near things
    if (apples.some(ap => ap.st === 0 && Math.hypot(ap.x - x, ap.y - y) < deckHalf + 4)) want = Math.min(want, (APPLE_V * 0.8) / vmax);
    const push = DEAD + 0.02 + (1 - DEAD - 0.02) * want;
    return [(ax2 / m0) * push, (ay2 / m0) * push];
  }
  /** Aims at a spot; one right beside the tractor is inside its turning circle, so drive on a little first and come round. */
  function aimAt(tx: number, ty: number): [number, number] {
    const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1, df = Math.abs(wrapA(Math.atan2(dy, dx) - h));
    if (d < 2.6 && df > 1.0 && df < 2.25) return [Math.cos(h), Math.sin(h)];
    return [dx / d, dy / d];
  }
  function autoRaw(dt: number): [number, number] {
    // apples first, one at a time
    if (apples.some(a => a.st === 0)) {
      planT -= dt; goalT += dt;
      if (goal >= 0 && goalT > 7) { if (appleGoal >= 0) apples[appleGoal].st = 2; goal = -1; planT = 0; }
      if (planT <= 0 || pathAt >= path.length) { plan(); planT = 0.3; }
      if (path.length) { const [sx2, sy2, at] = followPath(path, pathAt); pathAt = at; if (appleGoal >= 0 && pathAt >= path.length - 2) { const a = apples[appleGoal]; return aimAt(a.x, a.y); } return [sx2, sy2]; }
    }
    if (!segsBuilt) { segsBuilt = true; if (priorityMask) segs.push(...buildSegs(priorityMask)); segs.push(...buildSegs(jobNeed)); }
    while (segI < segs.length && segLeft(segs[segI]) < 0.08) { segI++; segMode = "to"; toPath = []; }
    if (segI < segs.length) {
      const sg = segs[segI]; segT += dt;
      if (segT > 25) { segI++; segT = 0; segMode = "to"; toPath = []; return [0, 0]; }
      if (segMode === "to") {
        if (Math.hypot(sg.ax - x, sg.ay - y) < 1.6) { segMode = "on"; segT = 0; }
        else {
          toPlanT -= dt;
          if (!toPath.length || toPlanT <= 0) { toPath = pathTo(w.cellOf(sg.ax, sg.ay)); toAt = 0; toPlanT = 1.5; if (!toPath.length) { segI++; return [0, 0]; } }
          const [sx2, sy2, at] = followPath(toPath, toAt); toAt = at; return [sx2, sy2];
        }
      }
      // along the stripe: aim 3 m ahead on the line
      const L = Math.hypot(sg.bx - sg.ax, sg.by - sg.ay) || 1, ux = (sg.bx - sg.ax) / L, uy = (sg.by - sg.ay) / L;
      const along = (x - sg.ax) * ux + (y - sg.ay) * uy;
      if (along > L - 0.6) { segI++; segT = 0; segMode = "to"; toPath = []; return [ux, uy]; }
      const ahead = Math.max(4, Math.abs(v) * 0.9), tx = sg.ax + ux * Math.min(L + 2, along + ahead), ty = sg.ay + uy * Math.min(L + 2, along + ahead), dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1;
      return [dx / d, dy / d];
    }
    // tidy up: nearest grass first; if nothing gets cut for a while, give up on that patch
    planT -= dt; goalT += dt;
    if (cutCount !== lastCut) { lastCut = cutCount; idleT = 0; } else if (goalK >= 0 && Math.hypot(w.cellX(goalK) - x, w.cellY(goalK) - y) < 4) idleT += dt;
    if (goal >= 0 && (goalT > 7 || idleT > 6)) { const gx = w.cellX(goal), gy = w.cellY(goal); for (let q = 0; q < w.N; q++) if (jobNeed[q] && !cut[q] && Math.hypot(w.cellX(q) - gx, w.cellY(q) - gy) < 2) skip[q] = 1; goal = -1; planT = 0; idleT = 0; }
    if (planT <= 0 || pathAt >= path.length) { plan(); planT = 0.3; }
    if (!path.length) return [0, 0];
    const [sx2, sy2, at] = followPath(path, pathAt); pathAt = at;
    if (pathAt >= path.length - 3 && goal >= 0 && goalK >= 0) {
      // drive right over the spot the planner picked (from there the deck reaches the grass); if that didn't cut it, move on
      const tx = w.cellX(goalK), ty = w.cellY(goalK);
      const dd = Math.hypot(tx - x, ty - y);
      if (dd < 0.35) { if (!cut[goal]) skip[goal] = 1; goal = -1; planT = 0; return [Math.cos(h), Math.sin(h)]; }
      const [ax3, ay3] = aimAt(tx, ty), k3 = dd < 2 ? 0.45 : 1;
      return [ax3 * k3, ay3 * k3];
    }
    return [sx2, sy2];
  }

  // ── the cat ──
  const catOk = (px: number, py: number) => px > 0 && py > 0 && px < w.W && py < w.H && w.catFree[w.cellOf(px, py)] === 1 && w.catD[w.cellOf(px, py)] >= 0;
  const lineOk = (ax: number, ay: number, bx: number, by: number) => { const L = Math.hypot(bx - ax, by - ay), n = Math.ceil(L / 0.25); for (let s = 1; s <= n; s++) if (!catOk(ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n)) return false; return true; };
  function pickTarget() {
    for (let t = 0; t < 30; t++) {
      const a = rnd() * Math.PI * 2, d = 3 + rnd() * 9, tx = cat.x + Math.cos(a) * d, ty = cat.y + Math.sin(a) * d;
      if (!catOk(tx, ty) || !w.lawn[w.cellOf(tx, ty)] || Math.hypot(tx - x, ty - y) < 4 || !lineOk(cat.x, cat.y, tx, ty)) continue;
      cat.tx = tx; cat.ty = ty; cat.act = "walk"; return;
    }
    cat.act = "idle"; cat.actT = 0.8;
  }
  function catStep(dt: number) {
    cat.cool -= dt;
    if (phase === "scene") return;
    if (cat.st === "in") {
      if (phase !== "play") return;
      cat.next -= dt;
      if (cat.next <= 0) {
        if (!catSeen && mode !== "attract") { catSeen = true; say("The Cat Is Out!"); }
        cat.st = "out"; cat.x = w.cellX(w.doorCell); cat.y = w.cellY(w.doorCell); cat.outT = catCfg.out[0] + rnd() * (catCfg.out[1] - catCfg.out[0]); cat.act = "idle"; cat.actT = 0.8;
      }
      return;
    }
    const moveTo = (tx: number, ty: number, sp: number) => {
      const dx = tx - cat.x, dy = ty - cat.y, d = Math.hypot(dx, dy); if (d < 0.05) return true;
      const st = Math.min(d, sp * dt), nx = cat.x + (dx / d) * st, ny = cat.y + (dy / d) * st;
      if (Math.hypot(nx - x, ny - y) < BODY_R + CAT_R + 0.3 && Math.hypot(nx - x, ny - y) < Math.hypot(cat.x - x, cat.y - y)) return true;   // never walk into the tractor
      cat.h += clamp(wrapA(Math.atan2(dy, dx) - cat.h), -8 * dt, 8 * dt);
      if (catOk(nx, ny)) { cat.x = nx; cat.y = ny; } else return true;
      return st >= d - 1e-6;
    };
    if (cat.st === "flee") {
      cat.fleeT -= dt; cat.act = "run";
      const away = Math.atan2(cat.y - y, cat.x - x);
      let moved = false;
      for (const off of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2.2, -2.2]) {
        const a = away + off, nx = cat.x + Math.cos(a) * 3.8 * dt, ny = cat.y + Math.sin(a) * 3.8 * dt;
        if (catOk(nx, ny) && Math.hypot(nx - x, ny - y) >= BODY_R + CAT_R) { cat.x = nx; cat.y = ny; cat.h += clamp(wrapA(a - cat.h), -14 * dt, 14 * dt); moved = true; break; }
      }
      if (!moved || cat.fleeT <= 0) { cat.st = cat.outT <= 0 ? "home" : "out"; cat.act = "sit"; cat.actT = 1 + rnd() * 1.5; }
      return;
    }
    if (cat.st === "out") {
      cat.outT -= dt;
      if (cat.act === "walk") { if (moveTo(cat.tx, cat.ty, catCfg.walk)) { const r = rnd(); cat.act = r < 0.3 ? "sit" : r < 0.55 ? "lick" : r < 0.72 ? "nap" : "idle"; cat.actT = cat.act === "idle" ? 0.6 + rnd() : cat.act === "nap" ? 5 + rnd() * 3 : 2 + rnd() * 2.5; } }
      else { cat.actT -= dt; if (cat.actT <= 0) { if (cat.outT <= 0) { cat.st = "home"; cat.act = "walk"; } else pickTarget(); } }
      return;
    }
    cat.act = "walk";
    const k = w.cellOf(cat.x, cat.y);
    if (k === w.doorCell || w.catD[k] <= 0) { if (moveTo(w.cellX(w.doorCell), w.cellY(w.doorCell), catCfg.walk)) { cat.st = "in"; cat.next = catCfg.gap[0] + rnd() * (catCfg.gap[1] - catCfg.gap[0]); } return; }
    let best = k, bd = w.catD[k]; const i = k % w.NX, j = (k - i) / w.NX;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= w.NX || b >= w.NY) continue; const n = b * w.NX + a; if (w.catFree[n] && w.catD[n] >= 0 && w.catD[n] < bd) { bd = w.catD[n]; best = n; } }
    moveTo(w.cellX(best), w.cellY(best), catCfg.walk * 1.15);
  }

  // ── mowing ──
  const pct = () => (needCount ? cutCount / needCount : 1);
  function mow(moving: boolean) {
    const c = Math.cos(h), s = Math.sin(h), reach = Math.hypot(deckHalf + 0.1, DECK_LON);
    const i0 = Math.max(0, Math.floor((x - reach) / CELL)), i1 = Math.min(w.NX - 1, Math.floor((x + reach) / CELL));
    const j0 = Math.max(0, Math.floor((y - reach) / CELL)), j1 = Math.min(w.NY - 1, Math.floor((y + reach) / CELL));
    let fresh = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * w.NX + i; if (cut[k] || !w.lawn[k]) continue;
      const dx = (i + 0.5) * CELL - x, dy = (j + 0.5) * CELL - y, lon = dx * c + dy * s, lat = -dx * s + dy * c;
      if (Math.abs(lon) <= DECK_LON && Math.abs(lat) <= deckHalf + 0.1) { cut[k] = 1; if (jobNeed[k]) { cutCount++; fresh++; if (priorityMask?.[k]) priorityCut++; } paintCell(k); mmDirty = true; }
    }
    if (moving || fresh) { const g = grass.c; g.save(); g.translate(x, y); g.rotate(h); g.fillStyle = stripeCol(h); g.fillRect(-DECK_LON * 0.75, -deckHalf + 0.04, DECK_LON * 1.5, deckHalf * 2 - 0.08); g.restore(); }
    if (fresh) {
      freshAll += fresh; if (Math.abs(om) < 0.14) freshStraight += fresh;
      if (parts.length < 160) for (let n = 0; n < Math.min(3, fresh); n++) {
        if (cfg.up.bagger) { const a = h + Math.PI + (rnd() - 0.5) * 0.6; parts.push({ x: x + Math.cos(h + Math.PI / 2) * 0.7, y: y + Math.sin(h + Math.PI / 2) * 0.7, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 0.3, c: rnd() < 0.5 ? "#7fbf4f" : "#4f8f2f", s: 0.1 }); }
        else { const sp = 3 + rnd() * 3, a = h + Math.PI / 2 + (rnd() - 0.5) * 0.7; parts.push({ x: x + Math.cos(h + Math.PI / 2) * deckHalf + Math.cos(h) * (rnd() - 0.5) * 0.5, y: y + Math.sin(h + Math.PI / 2) * deckHalf + Math.sin(h) * (rnd() - 0.5) * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + rnd() * 0.3, c: rnd() < 0.5 ? "#8fcf5f" : "#4f8f2f", s: 0.12 }); }
      }
    }
  }
  const stripeScore = () => { if (!freshAll) return 1; const straight = freshStraight / freshAll, eff = clamp(areaM2 * pct() / Math.max(1, drove * deckHalf * 2) / 0.8, 0, 1); return clamp(straight * 0.65 + eff * 0.35, 0, 1); };
  const applesGot = () => apples.filter(a => a.st === 1).length;
  function outcome(done: boolean): Outcome {
    const secs = simT + penalty;
    const q = stripeScore();
    const s3 = job.twist === "bonfire" ? bumps === 0 : job.twist === "storm" ? wetT < 4 : job.twist === "guests" ? priorityOk : job.twist === "apples" ? applesGot() >= 10 : job.twist === "stripes" ? q >= 0.75 : meows === 0;
    return { job: job.id, done, secs, limit, par, pct: pct(), stars: [done, done && secs <= par, done && s3], meows, bumps, apples: applesGot(), applesTotal: apples.length, quality: q, wet: wetT, priorityOk };
  }
  function endRun(ok: boolean) {
    if (phase !== "play") return;
    phase = "scene"; sceneT = 0; success = ok; v = 0; om = 0; uturn = 0; stick = null;
    if (ok) {
      snd.chime();
      if (job.twist === "bonfire" || job.twist === "finale") { addPeople(fireSpots()); if (job.twist === "finale") { if (pits.length === 2) addPeople([[pits[0].x - 0.8, pits[0].y - 1.6, Math.PI / 2, "throw"], [pits[1].x + 0.8, pits[1].y + 1.6, -Math.PI / 2, "throw"]]); if (deck) { const [dx, dy] = [(deck.poly[0][0] + deck.poly[2][0]) / 2, (deck.poly[0][1] + deck.poly[2][1]) / 2 - deck.height * OBL]; cat.st = "out"; cat.x = dx; cat.y = dy; cat.act = "nap"; cat.h = 0.4; } } }
      if (job.twist === "guests" && !guestsIn && pits.length === 2) addPeople([[pits[0].x - 0.9, pits[0].y - 1.7, Math.PI / 2, "throw"], [pits[1].x + 0.9, pits[1].y + 1.7, -Math.PI / 2, "throw"], [pits[0].x + 2.2, pits[0].y + 0.6, Math.PI, "stand"]]);
      if (job.twist === "cat") { cat.st = "out"; if (deck) { cat.x = (deck.poly[0][0] + deck.poly[2][0]) / 2; cat.y = (deck.poly[0][1] + deck.poly[2][1]) / 2 - deck.height * OBL; } cat.act = "nap"; }
      banner = { text: job.twist === "storm" ? "Just In Time!" : job.twist === "apples" ? `${applesGot()} Apples Picked!` : job.twist === "finale" ? "What A Weekend!" : job.twist === "bonfire" ? "Fire's Lit!" : job.twist === "guests" ? "Let The Games Begin!" : job.twist === "stripes" ? "Look At Those Stripes!" : job.twist === "cat" ? "Nap Time!" : mode === "free" ? "Lawn Mowed!" : "Job Done!", sub: "", t: 0 };
      if (job.twist === "storm") { thunderAt = 0.6; }
    } else {
      snd.fail();
      banner = { text: job.twist === "bonfire" ? "Too Dark To Mow" : job.twist === "storm" ? "Rained Out" : "Out Of Time", sub: "", t: 0 };
    }
  }
  hooks.finishRef.current = () => { if (phase === "play" && pct() >= 0.975) endRun(true); };

  function readStick(): [number, number] {
    if (auto) return autoInput(STEP);
    if (testIn) return testIn;
    if (stick) return [stick.kx / STICK_R, stick.ky / STICK_R];
    const ax = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), ay = (keys.d ? 1 : 0) - (keys.u ? 1 : 0), d = Math.hypot(ax, ay);
    return d ? [ax / d, ay / d] : [0, 0];
  }
  /** Picks the U-turn side with more grass still to mow beside the tractor. */
  function uturnSide(prefer = 0) {
    let L = 0, Rr = 0; const c = Math.cos(h), s = Math.sin(h);
    for (let a = -3; a <= 3; a += 1) for (const side of [-1, 1]) for (let o = 1; o <= 3; o++) {
      const px = x + c * a + -s * side * deckHalf * 1.1 * o * 0.7, py = y + s * a + c * side * deckHalf * 1.1 * o * 0.7, k = w.cellOf(px, py);
      if (!w.reach[k] && !w.lawn[k]) { if (side < 0) L -= 0.3; else Rr -= 0.3; continue; }
      if (jobNeed[k] && !cut[k]) { if (side < 0) L++; else Rr++; }
    }
    // never swing into a wall: a side without room for the turn loses
    const uR = Math.max(rmin(4), deckHalf * 0.92), room = (side: number) => { let worst = 9; for (const a of [0.6, 1.2, 1.8, 2.4]) { const px = x + uR * (Math.sin(a) * c - side * (1 - Math.cos(a)) * s), py = y + uR * (Math.sin(a) * s + side * (1 - Math.cos(a)) * c); worst = Math.min(worst, w.clearance[w.cellOf(px, py)]); } return worst; };
    const rl = room(-1), rr2 = room(1);
    if (prefer && (prefer < 0 ? rl : rr2) >= BODY_R + 0.1) return prefer;   // the side the player asked for, if there's room
    if (rl < BODY_R + 0.1 && rr2 >= BODY_R + 0.1) return 1;
    if (rr2 < BODY_R + 0.1 && rl >= BODY_R + 0.1) return -1;
    if (rl < BODY_R + 0.1 && rr2 < BODY_R + 0.1) return rr2 >= rl ? 1 : -1;
    return Rr >= L ? 1 : -1;   // +1 turns clockwise (to the tractor's right)
  }

  function step(dt: number) {
    const [ax, ay] = phase === "play" || phase === "ready" ? readStick() : [0, 0];
    lastIn = [ax, ay];
    const raw = Math.min(1, Math.hypot(ax, ay));
    if (phase === "ready" && raw > DEAD) { phase = "play"; hooks.onStart(); }
    if (stopT > 0) { stopT -= dt; v = 0; om = 0; }
    let target = 0, omT = 0;
    const halt = stopT > 0 || phase === "scene" || phase === "over";
    if (!halt && revT > 0) {
      // a short back-up: the tractor reverses with the wheels turned the other way, then carries on
      revT -= dt; target = -VREV; omT = -revSide * (Math.abs(v) / rmin(v));
      if (revT <= 0) { revSide = 0; }
    } else if (!halt && raw > DEAD) {
      const mag = (raw - DEAD) / (1 - DEAD), th = Math.atan2(ay, ax), diff = wrapA(th - h);
      if (!uturn && Math.abs(diff) > 2.25) uturn = uturnSide(Math.abs(Math.abs(diff) - Math.PI) < 0.45 ? 0 : Math.sign(diff));
      if (uturn && Math.abs(diff) < 0.5) uturn = 0;
      if (uturn) {
        // pointing behind: a tight forward U-turn that comes back alongside the last strip
        const uR = Math.max(rmin(4), deckHalf * 0.92);
        target = Math.min(vmax, 4) * Math.max(0.65, mag); omT = uturn * (Math.max(0.5, v) / uR);
      } else {
        target = vmax * mag * Math.max(0.3, Math.pow(Math.cos(Math.min(Math.abs(diff), 1.35)), 1.4));
        omT = clamp(diff * 2.6, -3.2, 3.2);
      }
      // stopped against something with the stick pulled back for a moment: back up a little
      if (v < 0.3 && blockedT > 0.3 && Math.abs(diff) > 2.25) { backHoldT += dt; if (backHoldT > 0.6) { revT = 0.9; revSide = Math.sign(diff) || 1; backHoldT = 0; uturn = 0; } } else backHoldT = 0;
    } else { uturn = 0; backHoldT = 0; }
    const inPuddle = puddles.some(p => { const dx = x - p.x, dy = y - p.y, c = Math.cos(-p.rot), s = Math.sin(-p.rot), lx = dx * c - dy * s, ly = dx * s + dy * c; return (lx * lx) / (p.rx * p.rx) + (ly * ly) / (p.ry * p.ry) < 1; });
    if (inPuddle && phase === "play") { target = Math.sign(target) * Math.min(Math.abs(target), vmax * 0.42); if (Math.abs(v) > 0.5) { wetT += dt; if (rnd() < 0.5) parts.push({ x: x + (rnd() - 0.5), y: y + (rnd() - 0.5), vx: (rnd() - 0.5) * 3, vy: (rnd() - 0.5) * 3, life: 0.45, c: "rgba(210,230,245,0.9)", s: 0.12 }); } }
    v += clamp(target - v, -DEC * dt, ACC * dt);
    // yaw follows the request smoothly, never tighter than the turning circle allows at this speed (it can't spin on the spot)
    const omMax = Math.abs(v) / rmin(v);
    om += clamp(clamp(omT, -omMax, omMax) - om, -9 * dt, 9 * dt); om = clamp(om, -omMax, omMax);
    h = wrapA(h + om * dt);
    const steerT = Math.abs(v) > 0.3 ? clamp(Math.atan((1.3 * om) / v), -0.7, 0.7) : (raw > DEAD ? clamp(wrapA(Math.atan2(ay, ax) - h), -0.7, 0.7) : 0);
    steer += (steerT - steer) * Math.min(1, dt * 12);
    const ox = x, oy = y, dirX = Math.cos(h), dirY = Math.sin(h);
    const p = pushOut(w, x + dirX * v * dt, y + dirY * v * dt, BODY_R, cat.st !== "in" ? { x: cat.x, y: cat.y, r: CAT_R } : null);
    if (p.hit) {
      const into = -(dirX * p.nx + dirY * p.ny) * v;
      if (into > 1.4) {
        v *= 0.35;
        if (bumpCool <= 0) { shake = 0.22; if (phase === "play" && into > 2.5) bumps++; bumpCool = 0.5; snd.bump(); for (let n = 0; n < 7; n++) parts.push({ x: p.x - p.nx * BODY_R, y: p.y - p.ny * BODY_R, vx: (rnd() - 0.5) * 2 + p.nx, vy: (rnd() - 0.5) * 2 + p.ny, life: 0.45, c: "rgba(190,175,150,0.85)", s: 0.14 }); }
      }
    }
    x = p.x; y = p.y;
    const moved = Math.hypot(x - ox, y - oy), wanted = Math.abs(v) * dt;
    blockedT = wanted > 0.004 && moved < wanted * 0.35 ? blockedT + dt : Math.max(0, blockedT - dt * 2);
    if (uturn && blockedT > 0.25 && revT <= 0) { revT = 0.8; revSide = uturn; blockedT = 0; }   // a quick three-point turn when the U-turn runs out of room
    else if (revT > 0 && blockedT > 0.2) { revT = 0; revSide = 0; blockedT = 0; stuckN++; if (uturn) uturn = -uturn; }   // backed into something: go forward the other way
    if (stuckN >= 3 && revT <= 0) { stuckN = 0; revT = 1.4; revSide = 0.0001; }   // still boxed in: back straight out for a moment
    odo += moved; if (phase === "play") drove += moved;
    bumpCool -= dt; shake = Math.max(0, shake - dt);
    if (phase === "play" || (phase === "ready" && moved > 0)) mow(moved > 0.001);
    if (phase === "play") simT += dt;
    catStep(dt);
    // the cat and the tractor: Pat always stops for her
    if (cat.st !== "in" && cat.st !== "flee" && cat.cool <= 0 && phase === "play") {
      const d = Math.hypot(cat.x - x, cat.y - y);
      if (d < MEOW_D && (Math.abs(v) > 0.3 || d < BODY_R + 1.2)) {
        stopT = STOP_T; v = 0; om = 0; uturn = 0; meows++; if (mode !== "attract") { penalty += PENALTY; floatAt(`+${PENALTY}s`, x, y + 1.6, "#ffe1dc"); }
        bubbleT = 2; cat.st = "flee"; cat.fleeT = 1.5; cat.cool = 4.5; snd.meow();
      }
    }
    // twists
    if (phase === "play") {
      for (const a of apples) if (a.st === 0) {
        // ease over an apple and the deck scoops it up; rush over it and it's squished
        const dx = a.x - x, dy = a.y - y, lon = dx * Math.cos(h) + dy * Math.sin(h), lat = -dx * Math.sin(h) + dy * Math.cos(h);
        const under = Math.abs(lon) < DECK_LON + 0.25 && Math.abs(lat) < deckHalf + 0.1;
        if (under && Math.abs(v) <= APPLE_V) { a.st = 1; snd.pop(); floatAt("+1 Apple", a.x, a.y - 0.6, "#fff4c2"); }
        else if (under) { a.st = 2; v *= 0.5; shake = 0.12; snd.squish(); floatAt("Squish! Slow Down", a.x, a.y - 0.6, "#ffd2cc"); for (let n = 0; n < 8; n++) parts.push({ x: a.x, y: a.y, vx: (rnd() - 0.5) * 3, vy: (rnd() - 0.5) * 3, life: 0.5, c: "#d8443a", s: 0.1 }); }
      }
      if (priorityMask && limit) {
        if (!priorityTold && priorityCut >= priorityTotal * 0.995) { priorityTold = true; if (!guestsIn) { priorityOk = true; say("Pits And Path Ready!"); snd.coin(); } }
        if (!guestsIn && simT >= limit * 0.55) { guestsIn = true; say("The Guests Are Here!"); if (pits.length === 2) addPeople([[pits[0].x - 0.9, pits[0].y - 1.7, Math.PI / 2, "throw"], [pits[1].x + 0.9, pits[1].y + 1.7, -Math.PI / 2, "throw"], [pits[0].x + 2.2, pits[0].y + 0.6, Math.PI, "stand"]]); }
      }
      if (job.twist === "storm") { const u = simT / limit; if (u > 0.82) rainAmt = Math.max(rainAmt, (u - 0.82) / 0.18 * 0.45); }
      if (cutCount >= needCount * DONE_AT) endRun(true);
      else if (limit && simT >= limit) endRun(false);
    }
    if (phase === "scene") {
      sceneT += dt; banner.t += dt;
      if (success && (job.twist === "bonfire" || job.twist === "finale")) fireAmt = Math.min(1, fireAmt + dt * 0.8);
      if ((job.twist === "storm") ) { rainAmt = Math.min(1, rainAmt + dt * 0.7); if (thunderAt > 0 && sceneT > thunderAt) { thunderAt = 0; snd.thunder(); } }
      if (sceneT > (success ? (job.twist === "finale" ? 5 : 3.6) : 2.4) && !ended) { ended = true; phase = "over"; hooks.onEnd(outcome(success)); }
    }
    for (const pp of people) pp.fade = Math.min(1, pp.fade + dt * 1.5);
    if (people.some(pp => pp.pose === "throw") && Math.floor((simT + sceneT) * 0.5) !== Math.floor((simT + sceneT - dt) * 0.5) && mode !== "attract") snd.clank();
    bubbleT = Math.max(0, bubbleT - dt); toast.t = Math.max(0, toast.t - dt);
    for (const f of floats) f.t -= dt; for (let i = floats.length - 1; i >= 0; i--) if (floats[i].t <= 0) floats.splice(i, 1);
    for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.92; q.vy *= 0.92; q.life -= dt; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
    for (const cl of clouds) { cl.x += cl.sp * dt; if (cl.x - cl.r > w.W) cl.x = -cl.r; }
    // attract mode keeps going forever: start the lawn over once it's mostly done
    if (mode === "attract" && pct() > 0.6) { for (let k = 0; k < w.N; k++) if (jobNeed[k]) { cut[k] = 0; } cutCount = 0; }
  }

  // ── drawing ──
  function rr(c: CanvasRenderingContext2D, x0: number, y0: number, ww: number, hh: number, r: number) { c.beginPath(); c.roundRect(x0, y0, ww, hh, r); }
  function text(t: string, tx: number, ty: number, size: number, color: string, weight = 700, align: CanvasTextAlign = "center") { ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(t, tx, ty); }
  function pill(t: string, cx: number, cy: number, size: number, fg: string, bg: string, padX = 14, hgt = 30) {
    ctx.font = `800 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + padX * 2;
    ctx.save(); ctx.fillStyle = bg; ctx.shadowColor = "rgba(0,0,0,0.2)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; rr(ctx, cx - tw / 2, cy - hgt / 2, tw, hgt, hgt / 2); ctx.fill(); ctx.restore();
    text(t, cx, cy + 0.5, size, fg, 800); return tw;
  }
  /** The yard and everything on it, in world units (the caller sets the camera transform). */
  function drawWorld(c: CanvasRenderingContext2D, cx: number, cy: number, vw: number, vh: number, time: number, dt: number) {
    const p = pct();
    c.imageSmoothingEnabled = true;
    c.drawImage(grass.cv, 0, 0, w.W, w.H);
    if (noisePat) { c.fillStyle = noisePat; c.fillRect(cx - vw / 2 - 1, cy - vh / 2 - 1, vw + 2, vh + 2); }
    c.drawImage(groundCv, 0, 0, w.W, w.H);
    // tall grass tufts that sway, on the grass still to mow (only what's on screen)
    {
      const i0 = Math.max(0, Math.floor((cx - vw / 2) / CELL)), i1 = Math.min(w.NX - 1, Math.ceil((cx + vw / 2) / CELL));
      const j0 = Math.max(0, Math.floor((cy - vh / 2) / CELL)), j1 = Math.min(w.NY - 1, Math.ceil((cy + vh / 2) / CELL));
      const wind = job.twist === "storm" ? 0.1 + 0.08 * Math.sin(time * 0.7) : 0.035;
      const dark = new Path2D(), lite = new Path2D();
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = j * w.NX + i; if (!jobNeed[k] || cut[k]) continue;
        const hsh = ((i * 73856093) ^ (j * 19349663)) >>> 0, ox = ((hsh & 255) / 255) * CELL, oy = (((hsh >> 8) & 255) / 255) * CELL;
        const bx = i * CELL + ox, by = j * CELL + oy, sw = Math.sin(time * 2.2 + bx * 0.6 + by * 0.4) * wind;
        const path = hsh & 1 ? dark : lite;
        path.moveTo(bx, by); path.lineTo(bx - 0.05 + sw, by - 0.2); path.moveTo(bx + 0.04, by); path.lineTo(bx + 0.08 + sw * 1.2, by - 0.17);
      }
      c.lineCap = "round"; c.lineWidth = 0.04; c.strokeStyle = "rgba(30,72,22,0.5)"; c.stroke(dark); c.strokeStyle = "rgba(120,170,70,0.42)"; c.stroke(lite);
    }
    for (const pd of puddles) drawPuddle(c, pd.x, pd.y, pd.rx, pd.ry, pd.rot, time, rainAmt);
    // priority spots: a soft yellow wash on the grass still to mow there
    if (priorityMask && priorityCut < priorityTotal) {
      const pulse = 0.18 + 0.1 * Math.sin(time * 3);
      c.fillStyle = `rgba(255,214,64,${pulse.toFixed(3)})`;
      for (const nm of ["priorityPits", "priorityPath"]) { const z = map.zones[nm]; if (z) { c.save(); pathPoly(c, z); c.clip(); c.fill(); c.restore(); } }
      c.strokeStyle = "rgba(255,214,64,0.8)"; c.lineWidth = 0.12; c.setLineDash([0.6, 0.45]);
      for (const nm of ["priorityPits", "priorityPath"]) { const z = map.zones[nm]; if (z) { pathPoly(c, z); c.stroke(); } }
      c.setLineDash([]);
    }
    // missed spots, once nearly done
    if (phase === "play" && p >= 0.97 && mode !== "attract") {
      if (frame - missedAt > 20) { missed = []; for (let q = 0; q < w.N; q++) if (jobNeed[q] && !cut[q]) missed.push(q); missedAt = frame; }
      const pulse = 0.5 + 0.5 * Math.sin(time * 5);
      c.fillStyle = `rgba(255,216,80,${(0.3 + 0.35 * pulse).toFixed(3)})`;
      for (const q of missed) { c.beginPath(); c.arc(w.cellX(q), w.cellY(q), CELL * 0.75, 0, 7); c.fill(); }
    }
    for (const a of apples) if (a.st === 0) drawApple(c, a.x, a.y, time, true); else if (a.st === 2) { c.fillStyle = "rgba(170,40,30,0.55)"; c.beginPath(); c.ellipse(a.x, a.y, 0.22, 0.14, 0.4, 0, 7); c.fill(); }
    for (const q of parts) { c.globalAlpha = Math.min(1, q.life * 3); c.fillStyle = q.c; c.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
    c.globalAlpha = 1;
    for (const pp of people) { c.globalAlpha = pp.fade; drawPerson(c, pp.x, pp.y, pp.a, pp.shirt, pp.hair, pp.skin, pp.pose, time + pp.x); }
    c.globalAlpha = 1;
    // the horseshoe in the air between the pits once the game is on
    if (pits.length === 2 && people.some(pp => pp.pose === "throw")) {
      const u = (time * 0.5) % 1, dir = Math.floor(time * 0.5) % 2, a = pits[dir], b = pits[1 - dir], hx = a.x + (b.x - a.x) * u, hy = a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * 1.4;
      c.strokeStyle = "#6d7176"; c.lineWidth = 0.06; c.beginPath(); c.arc(hx, hy, 0.13, time * 8, time * 8 + 4.4); c.stroke();
    }
    const catOnDeck = cat.st !== "in" && deck && pip(deck.poly.map(q => [q[0], q[1] - deck.height * OBL] as Pt), cat.x, cat.y);
    if (cat.st !== "in" && !catOnDeck) drawCat(c, cat, time);
    drawMower(c, x, y, h, steer, odo, time, phase === "play", deckHalf, paint, cfg.up.bagger, cfg.up.lights && (job.light === "dusk" || job.light === "storm"));
    if (firePit) drawFire(c, firePit.x, firePit.y, firePit.r ?? 0.8, time, fireAmt);
    // trees and buildings over the top, see-through where the tractor or cat is underneath
    map.trees.forEach((t, i) => {
      if (t.kind === "well") return;
      const near = Math.hypot(t.x - x, t.y - y) < t.r + Math.max(BODY_R, deckHalf) + 0.4 || (cat.st !== "in" && Math.hypot(t.x - cat.x, t.y - cat.y) < t.r + 0.4);
      treeAlpha[i] += ((near ? 0.25 : 0.96) - treeAlpha[i]) * Math.min(1, dt * 8);
      drawTree(c, t, treeBlobs[i], treeAlpha[i], time * (job.twist === "storm" ? 2.2 : 1));
    });
    map.buildings.forEach((b, i) => {
      const dz = b.height * OBL, roof = b.poly.map(q => [q[0], q[1] - dz] as Pt);
      const behind = pip(roof, x, y) && !pip(b.poly, x, y) && polyClosest(b.poly, x, y).d > 0.2;
      const catBehind = cat.st !== "in" && !catOnDeck && pip(roof, cat.x, cat.y);
      roofAlpha[i] += ((behind || catBehind ? 0.45 : 1) - roofAlpha[i]) * Math.min(1, dt * 8);
      drawBuilding(c, b, roofAlpha[i], b.kind === "house" ? map.door : null);
    });
    if (catOnDeck) drawCat(c, cat, time);
    // cloud shadows drifting over the yard before the storm
    for (const cl of clouds) { const g = c.createRadialGradient(cl.x, cl.y, 0, cl.x, cl.y, cl.r); g.addColorStop(0, "rgba(20,30,40,0.22)"); g.addColorStop(1, "rgba(20,30,40,0)"); c.fillStyle = g; c.beginPath(); c.arc(cl.x, cl.y, cl.r, 0, 7); c.fill(); }
  }
  /** Time of day: a tint over the map, darkness with headlights and firelight for dusk, rain for the storm. */
  function drawLight(ox: number, oy: number, S: number, time: number) {
    const u = limit ? clamp(simT / limit, 0, 1) : 0, L = job.light;
    const sx = (wx: number) => ox + wx * S, sy = (wy: number) => oy + wy * S;
    let tint: string | null = null, dark = 0;
    if (L === "dusk") { tint = `rgba(255,${Math.round(190 - 70 * u)},${Math.round(120 - 50 * u)},${(0.05 + 0.2 * u).toFixed(3)})`; dark = smooth((u - 0.3) / 0.7) * 0.7 + (phase !== "play" && success ? 0.08 : 0); }
    else if (L === "storm") { tint = `rgba(90,105,120,${(0.18 + 0.32 * Math.max(u, rainAmt)).toFixed(3)})`; dark = 0.12 * rainAmt; }
    else if (L === "morning") tint = "rgba(255,232,190,0.12)";
    else if (L === "golden") { tint = `rgba(255,${Math.round(196 - 40 * u)},120,${(0.12 + 0.1 * u + (phase === "scene" ? 0.08 : 0)).toFixed(3)})`; if (phase === "scene" || phase === "over") dark = 0.35 * Math.min(1, sceneT / 1.5); }
    if (tint) { ctx.save(); ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = tint; ctx.fillRect(0, 0, CW, MH); ctx.restore(); }
    if (dark > 0.01) {
      lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalCompositeOperation = "source-over"; lc.clearRect(0, 0, lightCv.width, lightCv.height);
      lc.fillStyle = `rgba(12,18,48,${dark.toFixed(3)})`; lc.fillRect(0, 0, lightCv.width, lightCv.height);
      lc.globalCompositeOperation = "destination-out";
      const hole = (hx: number, hy: number, r: number, a: number) => { const g = lc.createRadialGradient(hx, hy, 0, hx, hy, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, "rgba(0,0,0,0)"); lc.fillStyle = g; lc.beginPath(); lc.arc(hx, hy, r, 0, 7); lc.fill(); };
      hole(sx(x), sy(y), 3.2 * S, 0.75);
      if (cfg.up.lights) {   // headlight beam
        const nx = sx(x + Math.cos(h) * 1.1), ny = sy(y + Math.sin(h) * 1.1), Rb = 11 * S;
        const g = lc.createRadialGradient(nx, ny, 0, nx, ny, Rb); g.addColorStop(0, "rgba(0,0,0,0.95)"); g.addColorStop(0.7, "rgba(0,0,0,0.6)"); g.addColorStop(1, "rgba(0,0,0,0)");
        lc.fillStyle = g; lc.beginPath(); lc.moveTo(nx, ny); lc.arc(nx, ny, Rb, h - 0.5, h + 0.5); lc.closePath(); lc.fill();
      }
      if (firePit && fireAmt > 0) hole(sx(firePit.x), sy(firePit.y), 8 * S * fireAmt, 0.9 * fireAmt);
      const door = map.door; hole(sx(door.x), sy(door.y - 1), 2.6 * S, 0.5);   // porch light by the back door
      ctx.drawImage(lightCv, 0, 0, CW, MH);
      if (cfg.up.lights) {   // a warm glow in the beam
        ctx.save(); ctx.globalCompositeOperation = "lighter"; const nx = sx(x + Math.cos(h) * 1.1), ny = sy(y + Math.sin(h) * 1.1), Rb = 9 * S;
        const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, Rb); g.addColorStop(0, `rgba(255,240,180,${(0.18 * dark).toFixed(3)})`); g.addColorStop(1, "rgba(255,240,180,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(nx, ny); ctx.arc(nx, ny, Rb, h - 0.5, h + 0.5); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    if (rainAmt > 0.01) {   // rain streaks across the screen
      ctx.save(); ctx.strokeStyle = `rgba(220,232,245,${(0.55 * rainAmt).toFixed(3)})`; ctx.lineWidth = 1.2; ctx.beginPath();
      const n = Math.round(160 * rainAmt);
      for (let i = 0; i < n; i++) { const s1 = Math.sin(i * 91.7) * 0.5 + 0.5, s2 = Math.sin(i * 47.3) * 0.5 + 0.5, fall = (time * (1.6 + s2) + s1) % 1, rx = (s1 * CW * 1.3 + fall * 60) % (CW + 40) - 20, ry = fall * (MH + 40) - 20; ctx.moveTo(rx, ry); ctx.lineTo(rx - 5, ry + 16); }
      ctx.stroke(); ctx.restore();
    }
  }
  function draw(time: number, dt: number) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, CW, CH);
    let S = Math.min(CW, MH) / (mode === "attract" ? VIEW_M * 1.15 : VIEW_M);
    let tx = x + Math.cos(h) * v * 0.55, ty = y + Math.sin(h) * v * 0.55 + (MH / S) * 0.06;
    // end scenes: the camera goes to where the party is, or pulls back to show the stripes
    if ((phase === "scene" || phase === "over") && success) {
      const fit = (pts: [number, number][], pad: number) => { const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]); tx = (Math.min(...xs) + Math.max(...xs)) / 2; ty = (Math.min(...ys) + Math.max(...ys)) / 2; S = Math.min(CW / (Math.max(...xs) - Math.min(...xs) + pad * 2), MH / (Math.max(...ys) - Math.min(...ys) + pad * 2)); };
      const deckC: [number, number] | null = deck ? [(deck.poly[0][0] + deck.poly[2][0]) / 2, (deck.poly[0][1] + deck.poly[2][1]) / 2] : null;
      if (job.twist === "bonfire" && firePit) fit([[firePit.x, firePit.y]], 4.5);
      if (job.twist === "finale" && firePit) fit([[firePit.x, firePit.y], ...(deckC ? [deckC] : []), ...pits.map(q => [q.x, q.y] as [number, number])], 3);
      if (job.twist === "guests" && pits.length) fit(pits.map(q => [q.x, q.y] as [number, number]), 4.5);
      if (job.twist === "cat" && deckC) fit([deckC], 5);
      if (job.twist === "stripes") { const z = map.zones.stripes; if (z) { const xs = z.map(q => q[0]), ys = z.map(q => q[1]); tx = (Math.min(...xs) + Math.max(...xs)) / 2; ty = (Math.min(...ys) + Math.max(...ys)) / 2; S = Math.min(CW / (Math.max(...xs) - Math.min(...xs) + 6), MH / (Math.max(...ys) - Math.min(...ys) + 6)); } }
    }
    if (!camS) camS = S;
    const k = 1 - Math.exp(-dt * (phase === "scene" ? 2 : 3.5));
    camX += (tx - camX) * k; camY += (ty - camY) * k; camS += (S - camS) * k; S = camS;
    const vw = CW / S, vh = MH / S, m = 2;
    const cx = vw >= w.W + 2 * m ? w.W / 2 : clamp(camX, vw / 2 - m, w.W - vw / 2 + m), cy = vh >= w.H + 2 * m ? w.H / 2 : clamp(camY, vh / 2 - m, w.H - vh / 2 + m);
    const shx = shake > 0 ? (Math.random() - 0.5) * shake * 0.6 : 0, shy = shake > 0 ? (Math.random() - 0.5) * shake * 0.6 : 0;
    const ox = CW / 2 - (cx + shx) * S, oy = MH / 2 - (cy + shy) * S;
    // the map
    ctx.save(); rr(ctx, 0, 0, CW, MH, cfg.showStrip ? 18 : 0); ctx.clip();
    ctx.fillStyle = "#8fa557"; ctx.fillRect(0, 0, CW, MH);
    ctx.save(); ctx.translate(ox, oy); ctx.scale(S, S);
    drawWorld(ctx, cx, cy, vw, vh, time, dt);
    ctx.restore();
    // soft light from the top left over the whole map
    { const g = ctx.createLinearGradient(0, 0, CW, MH); g.addColorStop(0, "rgba(255,250,220,0.07)"); g.addColorStop(1, "rgba(0,20,0,0.07)"); ctx.fillStyle = g; ctx.fillRect(0, 0, CW, MH); }
    drawLight(ox, oy, S, time);
    const sx = (wx: number) => ox + wx * S, sy = (wy: number) => oy + wy * S;
    // bubbles and floating words
    if (bubbleT > 0 && cat.st !== "in" && mode !== "attract") {
      const bx = sx(cat.x), by = sy(cat.y) - 32, a = Math.min(1, bubbleT * 3), pop = 1 + Math.max(0, (bubbleT - 1.8) * 1.5);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(bx, by); ctx.scale(pop, pop); ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 8;
      rr(ctx, -32, -14, 64, 26, 13); ctx.fill(); ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(0, 20); ctx.lineTo(6, 10); ctx.fill();
      ctx.shadowBlur = 0; ctx.restore(); ctx.save(); ctx.globalAlpha = a; text("Meow!", bx, by - 1, 14, "#2b3441", 800); ctx.restore();
      const px = sx(x), py = sy(y) - 30; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = "#fff"; rr(ctx, px - 11, py - 11, 22, 22, 11); ctx.fill(); text("!", px, py, 15, "#d0402f", 900); ctx.restore();
    }
    if (cat.st !== "in" && cat.act === "nap" && bubbleT <= 0) for (let q = 0; q < 3; q++) { const ph = (time * 0.6 + q / 3) % 1; ctx.save(); ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9; text("z", sx(cat.x) + 10 + ph * 10, sy(cat.y) - 12 - ph * 18, 10 + ph * 5, "#ffffff", 800); ctx.restore(); }
    for (const f of floats) { const u = 1 - f.t / 1.4; ctx.save(); ctx.globalAlpha = Math.min(1, f.t * 2); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(30,40,20,0.55)"; ctx.font = `800 14px ${FONT}`; ctx.textAlign = "center"; ctx.strokeText(f.text, sx(f.x), sy(f.y) - u * 26); text(f.text, sx(f.x), sy(f.y) - u * 26, 14, f.color, 800); ctx.restore(); }
    // arrow to the nearest missed spot when it's off screen
    if (phase === "play" && pct() >= 0.97 && missed.length && mode !== "attract") {
      let best = -1, bd = Infinity; for (const q of missed) { const d = Math.hypot(w.cellX(q) - x, w.cellY(q) - y); if (d < bd) { bd = d; best = q; } }
      const qx = sx(w.cellX(best)), qy = sy(w.cellY(best));
      if (qx < 8 || qx > CW - 8 || qy < 8 || qy > MH - 8) {
        const a = Math.atan2(qy - sy(y), qx - sx(x)), ex = clamp(qx, 22, CW - 22), ey = clamp(qy, 22, MH - 22);
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = "#ffd646"; ctx.strokeStyle = "rgba(60,50,0,0.5)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -9); ctx.lineTo(-3, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
    // minimap
    if (mode !== "attract" && phase !== "scene" && phase !== "over") {
      if (mmDirty && frame % 4 === 0) { mmc.putImageData(mmImg, 0, 0); mmDirty = false; }
      const mw = Math.min(88, CW * 0.25), mh = (mw * w.H) / w.W, mx = CW - mw - 8, my = 8, ms = mw / w.W;
      ctx.save(); ctx.fillStyle = "rgba(255,255,255,0.88)"; ctx.shadowColor = "rgba(0,0,0,0.18)"; ctx.shadowBlur = 8; rr(ctx, mx - 3, my - 3, mw + 6, mh + 6, 9); ctx.fill(); ctx.shadowBlur = 0;
      rr(ctx, mx, my, mw, mh, 6); ctx.clip(); ctx.fillStyle = "#a9b874"; ctx.fillRect(mx, my, mw, mh);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(mm, mx, my, mw, mh); ctx.imageSmoothingEnabled = true;
      ctx.translate(mx, my); ctx.scale(ms, ms);
      for (const r of [...map.roads, ...map.lanes]) { ctx.strokeStyle = map.roads.includes(r) ? "#6a6d70" : "#d6c9ae"; ctx.lineWidth = r.width; ctx.lineCap = "round"; ctx.beginPath(); r.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); }
      for (const d of [...map.driveway, ...map.pads.map(q => q.poly)]) { ctx.fillStyle = "#d6c9ae"; pathPoly(ctx, d); ctx.fill(); }
      for (const n of map.noGo) { ctx.fillStyle = n.kind === "field" ? "#a88e66" : n.kind === "woods" ? "#2f5a2c" : "#6a6d70"; pathPoly(ctx, n.poly); ctx.fill(); }
      for (const b of map.buildings) { ctx.fillStyle = b.kind === "barn" ? "#b3302a" : b.roof; pathPoly(ctx, b.poly); ctx.fill(); }
      for (const a of apples) if (a.st === 0) { ctx.fillStyle = "#e0352b"; ctx.beginPath(); ctx.arc(a.x, a.y, 1.6, 0, 7); ctx.fill(); }
      ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 1 / ms; ctx.strokeRect(cx - vw / 2, cy - vh / 2, vw, vh);
      if (cat.st !== "in") { ctx.fillStyle = "#5b6068"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 0.8 / ms; ctx.beginPath(); ctx.arc(cat.x, cat.y, 2.3 / ms, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = paint.body; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.3 / ms; ctx.beginPath(); ctx.arc(x, y, 3.2 / ms, 0, 7); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (toast.t > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, toast.t * 2, (3 - toast.t) * 5); ctx.font = `800 13px ${FONT}`; const tw = ctx.measureText(toast.text).width + 28; ctx.translate(10 + tw / 2, 26); const pop = Math.max(1, 1.12 - (3 - toast.t) * 0.6); ctx.scale(pop, pop); ctx.translate(-(10 + tw / 2), -26); pill(toast.text, 10 + tw / 2, 26, 13, "#3d4654", "rgba(255,255,255,0.96)"); ctx.restore(); }
    if (phase === "ready" && mode !== "attract" && cfg.showStrip) { const b = 0.75 + 0.25 * Math.sin(time * 4); ctx.save(); ctx.globalAlpha = b; pill("Push The Stick To Start", CW / 2, MH - 30, 13, "#2f5a1f", "rgba(255,255,255,0.95)", 16, 32); ctx.restore(); }
    if (stopT > 0 && phase === "play" && mode !== "attract") pill("Pat Stopped For The Cat", CW / 2, MH - 30, 13, "#b03a2e", "rgba(255,255,255,0.95)", 16, 32);
    if (phase === "scene" && banner.text) {
      const t = banner.t, s = t < 0.35 ? 0.5 + (t / 0.35) * 0.62 : 1.12 - Math.min(0.12, (t - 0.35) * 0.6);
      ctx.save(); ctx.translate(CW / 2, MH * 0.2); ctx.scale(s, s); ctx.globalAlpha = Math.min(1, t * 4);
      pill(banner.text, 0, 0, 22, success ? "#2f6d1c" : "#a3352a", "rgba(255,255,255,0.97)", 22, 50); ctx.restore();
    }
    ctx.restore();
    // the joystick strip
    if (cfg.showStrip) {
      ctx.fillStyle = "rgba(255,255,255,0.42)"; rr(ctx, 0, MH + 8, CW, CH - MH - 8, 18); ctx.fill();
      const rest = stickRest(), bx = stick ? stick.bx : rest.x, by = stick ? stick.by : rest.y, kx = stick ? stick.kx : 0, ky = stick ? stick.ky : 0;
      ctx.save(); ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.shadowColor = "rgba(0,0,0,0.08)"; ctx.shadowBlur = 6; ctx.beginPath(); ctx.arc(bx, by, STICK_R, 0, 7); ctx.fill(); ctx.restore();
      ctx.strokeStyle = "rgba(61,122,38,0.3)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, STICK_R, 0, 7); ctx.stroke();
      ctx.strokeStyle = "rgba(61,122,38,0.18)"; ctx.beginPath(); ctx.arc(bx, by, STICK_R * DEAD, 0, 7); ctx.stroke();
      ctx.save(); ctx.fillStyle = stick ? paint.trim : paint.body; ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2; ctx.beginPath(); ctx.arc(bx + kx, by + ky, STICK_R * 0.46, 0, 7); ctx.fill(); ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.arc(bx + kx - 4, by + ky - 5, STICK_R * 0.18, 0, 7); ctx.fill();
      if (!stick) { ctx.fillStyle = "rgba(255,255,255,0.95)"; for (let q = 0; q < 4; q++) { const an = (q * Math.PI) / 2; ctx.beginPath(); ctx.moveTo(rest.x + Math.cos(an) * STICK_R * 0.84, rest.y + Math.sin(an) * STICK_R * 0.84); ctx.lineTo(rest.x + Math.cos(an + 0.24) * STICK_R * 0.66, rest.y + Math.sin(an + 0.24) * STICK_R * 0.66); ctx.lineTo(rest.x + Math.cos(an - 0.24) * STICK_R * 0.66, rest.y + Math.sin(an - 0.24) * STICK_R * 0.66); ctx.fill(); } }
      text(stick ? "" : "Push Where You Want To Go", rest.x, CH - 10, 11, "#5a6b4f", 700);
    }
  }

  // ── loop ──
  let raf = 0, last = performance.now(), acc = 0, hudAt = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    let dt = Math.min(0.1, (now - last) / 1000); last = now;
    const paused = hooks.paused();
    if (paused) dt = 0;
    acc += dt * speedK;
    let n = 0;
    while (acc >= STEP && n < 60 * Math.max(1, speedK)) { step(STEP); acc -= STEP; n++; }
    frame++;
    draw(now / 1000, dt);
    snd.engine(Math.abs(v) / vmax, !paused && (phase === "play" || phase === "ready") && mode !== "attract");
    snd.rainLevel(paused ? 0 : rainAmt);
    if (now - hudAt > 100 && mode !== "attract") {
      hudAt = now;
      let meter: Meter | null = null;
      if (job.twist === "guests") meter = { label: "Pits & Path", value: `${Math.round((priorityTotal ? priorityCut / priorityTotal : 1) * 100)}%`, frac: priorityTotal ? priorityCut / priorityTotal : 1, good: priorityCut >= priorityTotal * 0.995 };
      else if (job.twist === "apples") meter = { label: "Apples", value: `${applesGot()} / ${apples.length}`, frac: apples.length ? applesGot() / apples.length : 0, good: applesGot() >= 10 };
      else if (job.twist === "stripes") meter = { label: "Stripe Score", value: `${Math.round(stripeScore() * 100)}%`, frac: stripeScore(), good: stripeScore() >= 0.75 };
      else if (job.twist === "storm") meter = { label: "Puddle Time", value: `${wetT.toFixed(1)}s`, frac: clamp(wetT / 4, 0, 1), good: wetT < 4 };
      else if (job.twist === "cat" || job.twist === "finale") meter = { label: "Cat Stops", value: String(meows), frac: 0, good: meows === 0 };
      else if (job.twist === "bonfire") meter = { label: "Big Bumps", value: String(bumps), frac: 0, good: bumps === 0 };
      hooks.onHud({ pct: pct(), time: simT + penalty, limit, par, meter, canFinish: phase === "play" && pct() >= 0.975, phase });
    }
  };
  raf = requestAnimationFrame(loop);

  if (cfg.debug) {
    (window as unknown as { __lm: unknown }).__lm = {
      state: () => ({ mode, job: job.id, phase, stickIn: lastIn, blockedT, toLen: toPath.length, goal, goalK, pct: pct(), cut: cutCount, need: needCount, areaM2, limit, par, x, y, h, v, om, uturn, revT, stopT, meows, bumps, simT, penalty, drove, wetT,
        apples: applesGot(), applesLeft: apples.filter(a => a.st === 0).length, priority: priorityTotal ? priorityCut / priorityTotal : null, quality: stripeScore(),
        cat: { st: cat.st, x: cat.x, y: cat.y, act: cat.act, next: cat.next }, size: [CW, CH, MH], scrollH: document.documentElement.scrollHeight, PX, deckHalf, vmax }),
      hold: (hx: number, hy: number) => { testIn = [hx, hy]; },
      release: () => { testIn = null; },
      auto: (on: boolean) => { auto = on; },
      speed: (sk: number) => { speedK = sk; },
      catNow: () => { if (cat.st === "in") cat.next = 0.01; },
      catOff: () => { cat.st = "in"; cat.next = 1e9; },
      setCat: (cx: number, cy: number, act: string, hd: number) => { cat.st = "out"; cat.x = cx; cat.y = cy; cat.act = act as Cat["act"]; cat.actT = 60; cat.outT = 60; cat.h = hd; cat.cool = 10; },
      catAt: (cx: number, cy: number) => { cat.st = "out"; cat.x = cx; cat.y = cy; cat.act = "sit"; cat.actT = 5; cat.outT = 20; cat.cool = 0; },
      tp: (tx: number, ty: number, th?: number) => { const q = pushOut(w, tx, ty, BODY_R, null); x = q.x; y = q.y; if (th !== undefined) h = th; v = 0; om = 0; camX = x; camY = y; },
      toMap: (px: number, py: number) => [(px - LAWN_MAP.origin[0]) * LAWN_MAP.unit, (py - LAWN_MAP.origin[1]) * LAWN_MAP.unit],
      shot: (cx: number, cy: number, viewW: number, pw: number, ph: number) => {
        const cv = document.createElement("canvas"); cv.width = pw; cv.height = ph; const o = cv.getContext("2d")!, sc = pw / viewW;
        o.fillStyle = "#8fa557"; o.fillRect(0, 0, pw, ph); o.translate(pw / 2 - cx * sc, ph / 2 - cy * sc); o.scale(sc, sc);
        drawWorld(o, cx, cy, viewW, ph / sc, performance.now() / 1000, 1);
        return cv.toDataURL("image/png");
      },
      cell: (cx: number, cy: number) => { const k2 = w.cellOf(cx, cy); return { lawn: w.lawn[k2], need: w.need[k2], job: jobNeed[k2], reach: w.reach[k2], cut: cut[k2] }; },
      missed: () => { const out: number[][] = []; for (let q = 0; q < w.N; q++) if (jobNeed[q] && !cut[q]) out.push([w.cellX(q), w.cellY(q)]); return out.slice(0, 50); },
      win: () => { if (phase === "ready") { phase = "play"; } cutCount = needCount; endRun(true); },   // jump to the end scene (screenshots only)
      setLimit: (n: number) => { limit = n; par = Math.round(n * 0.72); },
      segs: () => ({ segI, segMode, n: segs.length, cur: segs[segI] ?? null, first: segs.slice(0, 6) }),
      unneeded: () => { let n = 0; for (let q = 0; q < w.N; q++) if (w.lawn[q] && !w.need[q]) n++; return n; },
    };
  }

  return () => {
    cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("resize", resize);
    canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp);
    window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey);
    hooks.finishRef.current = null; snd.stop();
  };
}
