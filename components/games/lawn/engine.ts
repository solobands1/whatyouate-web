// The running game for Pat's Lawnmower: input, the tractor, mowing, the cat, each job's twist, the camera, lighting and
// weather, and the debug hooks the browser tests use (only with ?debug=1). One engine runs per job or Free Mow ("job" /
// "free" mode); the title screen draws its own picture (./hero). "attract" mode (the tractor mowing by itself on the
// whole lawn) is still here for tests and the autopilot.
import { LAWN_MAP, HOME_RIG, toMetres, type Pt } from "../lawnMap";
import { COMMUNITY_MAP, COMMUNITY_RIG, COMMUNITY_PLATES } from "../communityMap";
import { RIG, rigPt, rigLocal, rigShapes, drawRig, drawStraps, type Rig } from "./rig";
import { buildWorld, pushOut, CELL, BODY_R, NEED_R } from "./world";
import { clamp, wrapA, smooth, pip, polyClosest, mulberry32 } from "./geo";
import { makeGrass, makeGround, drawTree, bakeBuilding, drawMower, drawCat, drawPerson, drawFire, drawApple, drawPuddle, stripeCol, oldStripeCol, pathPoly, OBL, type CatPose } from "./art";
import { DECKS, GEARS, PAINTS, isPark, type Job, type Upgrades, type Outcome } from "./jobs";
import type { Sound } from "./sound";

export type Mode = "attract" | "job" | "free";
export type Meter = { label: string; value: string; frac: number; good: boolean };
export type Hud = { pct: number; time: number; limit: number; par: number; meter: Meter | null; canFinish: boolean; phase: Phase; lead: { label: string; value: string } | null };
export type Phase = "ready" | "play" | "scene" | "over";
export type Hooks = {
  paused: () => boolean;
  onHud: (h: Hud) => void;
  onStart: () => void;
  onEnd: (o: Outcome) => void;
  finishRef: { current: (() => void) | null };
  assist?: () => boolean;   // Straight Assist (a setting): hold the stick steady and the heading locks for straight stripes
  zoomRef?: { current: ((dir: number) => void) | null };
};
export type Config = { mode: Mode; job: Job; up: Upgrades; sound: Sound; debug: boolean; showStrip: boolean };

const STEP = 1 / 60;
const FONT = "system-ui, -apple-system, sans-serif";
const DECK_LON = 0.9;                 // half the deck's length front to back (grid)
const ACC = 6, DEC = 10, DEC_SOFT = 3.5, VREV = 2.2;   // DEC_SOFT: letting go of the stick at speed, the tractor coasts to a stop
const DEAD = 0.12;                    // joystick dead zone (fraction of its throw)
const CURVE = 1.5;                    // past the dead zone the push eases in: gentle pushes crawl, a full push is full speed
const SNAP = (2.5 * Math.PI) / 180;   // within this of the heading asked for, the tractor locks dead straight
const LOCK_OFF = (10 * Math.PI) / 180; // Straight Assist lets go when the stick moves this far
const rmin = (v: number) => 0.85 + 0.2 * Math.abs(v);   // tightest turn (radius) at a speed: about 1 m when slow
const CAT_R = 0.5, MEOW_D = 3.2, STOP_T = 2, PENALTY = 3;
const STRAIGHT_OM = 0.4;             // turning slower than this (radians a second, smoothed) counts as driving straight
const APPLE_V = 3.3;                  // no faster than this over apples, or they squish
const DONE_AT = 0.985;                // a job counts as done at 98.5% (the last few blades are never worth chasing)
const NEAR_DONE = 0.97;               // from here the last patches pulse, an arrow points to the nearest and Finish Mowing shows
const VIEW_M = 13;                    // metres across the map's short side (close enough to see Pat and the cat clearly)
export const STRIP = 124;             // the joystick strip under the map
const STICK_R = 40, KNOB_R = 21;   // the push range and the knob (the two together just fit the strip's height)
const SHIRTS = ["#d9534f", "#4e8ad6", "#f0ad4e", "#6aa84f", "#9b6bd6", "#e07b9b", "#3fb3a8"], HAIRS = ["#3b2a20", "#c99a5b", "#1f1a17", "#7a4a2a", "#e3d3a8", "#5b3a29"], SKINS = ["#f1c7a3", "#d9a37c", "#a8714f", "#f5d0b3"];

type Cat = CatPose & { st: "in" | "out" | "home" | "flee"; actT: number; tx: number; ty: number; outT: number; next: number; fleeT: number; cool: number };
type Part = { x: number; y: number; vx: number; vy: number; life: number; c: string; s: number };
type Float = { text: string; x: number; y: number; t: number; color: string };
type Apple = { x: number; y: number; st: 0 | 1 | 2 };   // 0 on the grass, 1 picked up, 2 squished
type Puddle = { x: number; y: number; rx: number; ry: number; rot: number };

export function startEngine(canvas: HTMLCanvasElement, wrap: HTMLElement, cfg: Config, hooks: Hooks) {
  const job = cfg.job, mode = cfg.mode, snd = cfg.sound, park = isPark(job), away = job.twist === "away";
  const raw = job.map === "community" ? COMMUNITY_MAP : LAWN_MAP, map = toMetres(raw);
  // Pat's truck and trailer: in the driveway for loading and unloading, parked in the gravel lot at the community centre
  const rigSrc = away ? COMMUNITY_RIG : park ? HOME_RIG : null;
  const rig: Rig | null = rigSrc ? { x: (rigSrc.x - raw.origin[0]) * raw.unit, y: (rigSrc.y - raw.origin[1]) * raw.unit, a: ((rigSrc.heading - 90) * Math.PI) / 180 } : null;
  // putting the tractor away: the barn's walls with the door gap on the side facing the house, and the box inside
  const barn = map.buildings.find(b => b.kind === "barn");
  let worldMap = map, barnBox: { x: number; y: number; a: number } | null = null, barnDoor: Pt | null = null;
  if (job.twist === "unload" && barn) {
    const [A, B, C, D] = barn.poly, pad = map.pads.find(q => q.kind === "concrete"), L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const ux = (B[0] - A[0]) / L, uy = (B[1] - A[1]) / L, pc = pad ? pad.poly.reduce((a, q) => [a[0] + q[0] / pad.poly.length, a[1] + q[1] / pad.poly.length], [0, 0]) : [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    const tc = clamp((pc[0] - A[0]) * ux + (pc[1] - A[1]) * uy, 2.2, L - 2.2), half = 1.75, at = (t: number): Pt => [A[0] + ux * t, A[1] + uy * t];
    let nx = -uy, ny = ux; const bc = barn.poly.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4], [0, 0]); if ((bc[0] - A[0]) * nx + (bc[1] - A[1]) * ny < 0) { nx = -nx; ny = -ny; }
    barnDoor = at(tc); barnBox = { x: barnDoor[0] + nx * 3.5, y: barnDoor[1] + ny * 3.5, a: Math.atan2(ny, nx) };
    worldMap = { ...map, buildings: map.buildings.filter(b => b !== barn), fences: [...map.fences, [A, at(tc - half)], [at(tc + half), B, C, D, A]] };
  }
  const w = buildWorld(worldMap, away && rig ? rigShapes(rig, false) : []);
  const jobShapes = park && rig ? rigShapes(rig, job.twist === "trailer") : [], jw = { ...w, shapes: jobShapes };   // bumping these costs the star
  const rnd = mulberry32((Math.random() * 1e9) | 0);
  const deckHalf = Math.min(3.3, (DECKS[cfg.up.deck] ?? DECKS[0]) + (job.deckBonus ?? 0)), vmax = GEARS[cfg.up.gear] ?? GEARS[0], paint = PAINTS[cfg.up.paint] ?? PAINTS.orange;
  const deckShow = park ? 0.62 : deckHalf;   // the wings fold up for loading and the road
  const zone = (names: string[] | null) => (names ? names.map(n => map.zones[n]).filter(Boolean) : null);
  const jobNeed = w.maskIn(w.need, zone(job.zones));
  if (park) jobNeed.fill(0);   // nothing to mow: just park it
  // the storm job's puddles: standing water, so the grass under it doesn't count; set clear of fences and walls so
  // there's always room to drive round them. `wet` is a little wider: the autopilot keeps the tractor out of it.
  // where a job starts: the edge of its own piece of lawn nearest the house, facing into it
  let startK = -1, faceX = 0, faceY = 0;
  if (job.zones && mode === "job") {
    let bd = Infinity, zn = 0;
    for (let k = 0; k < w.N; k++) if (jobNeed[k]) { faceX += w.cellX(k); faceY += w.cellY(k); zn++; }
    faceX /= zn || 1; faceY /= zn || 1;
    for (let k = 0; k < w.N; k++) if (jobNeed[k] && w.reach[k] && w.clearance[k] > 2.2) { const d = Math.hypot(w.cellX(k) - map.start.x, w.cellY(k) - map.start.y); if (d < bd) { bd = d; startK = k; } }
  }
  const puddles: Puddle[] = [], water = new Uint8Array(w.N), wet = new Uint8Array(w.N);
  if (job.twist === "storm") {
    const spots: number[] = []; for (let k = 0; k < w.N; k++) if (jobNeed[k] && w.reach[k] && w.clearance[k] > 3.6) spots.push(k);
    for (let t = 0; t < 800 && puddles.length < 7 && spots.length; t++) {
      const k = spots[Math.floor(rnd() * spots.length)], px = w.cellX(k), py = w.cellY(k), rx = 1.6 + rnd() * 1.4, ry = 1.0 + rnd() * 0.8;
      if (w.clearance[k] < rx + 2.1 || puddles.some(p => Math.hypot(p.x - px, p.y - py) < 9) || (startK >= 0 && Math.hypot(w.cellX(startK) - px, w.cellY(startK) - py) < 9)) continue;
      puddles.push({ x: px, y: py, rx, ry, rot: rnd() * Math.PI });
    }
    const inside = (p: Puddle, qx: number, qy: number, pad: number) => { const dx = qx - p.x, dy = qy - p.y, c = Math.cos(-p.rot), s2 = Math.sin(-p.rot), lx = dx * c - dy * s2, ly = dx * s2 + dy * c; return (lx * lx) / ((p.rx + pad) ** 2) + (ly * ly) / ((p.ry + pad) ** 2) < 1; };
    for (let k = 0; k < w.N; k++) for (const p of puddles) {
      const qx = w.cellX(k), qy = w.cellY(k);
      if (inside(p, qx, qy, 0.6)) wet[k] = 1;
      if (inside(p, qx, qy, 0.3)) { water[k] = 1; jobNeed[k] = 0; }
    }
  }
  // the finale: the boys have trimmed the fiddly bits round the trees, fences and walls, so Pat mows the open grass
  let trimmedN = 0;
  if (job.trim) for (let k = 0; k < w.N; k++) if (jobNeed[k] && w.clearance[k] < job.trim) { jobNeed[k] = 0; trimmedN++; }
  let needCount = 0; for (let k = 0; k < w.N; k++) needCount += jobNeed[k];
  const areaM2 = needCount * CELL * CELL;
  let limit = mode === "job" ? job.limit ?? Math.round(areaM2 / job.pace / 5) * 5 + 20 : 0, par = job.par ?? Math.round(limit * 0.72);
  const PX = Math.max(8, Math.min(26, 4000 / Math.max(w.W, w.H), Math.sqrt(6.5e6 / (w.W * w.H))));
  const grass = makeGrass(map, PX), groundCv = makeGround(map, PX);
  const ctx = canvas.getContext("2d")!;
  const lightCv = document.createElement("canvas"), lc = lightCv.getContext("2d")!;
  const treeBlobs = map.trees.map((t, i) => { const r = mulberry32(100 + i), out: number[][] = []; for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + r(), d = 0.45 + r() * 0.2; out.push([Math.cos(a) * d, Math.sin(a) * d, 0.42 + r() * 0.12, r()]); } return out; });
  const treeAlpha = map.trees.map(() => 0.95), roofAlpha = map.buildings.map(() => 1);
  const canopy = document.createElement("canvas"), cc = canopy.getContext("2d")!;   // the tree layer
  const baked = map.buildings.map(b => bakeBuilding(b, b.kind === "house" || b.kind === "deck" ? map.door : null, 72));   // each building drawn once, then just copied every frame
  // grass speckle pinned to the ground
  const noise = document.createElement("canvas"); noise.width = noise.height = 96;
  { const nc = noise.getContext("2d")!, img = nc.createImageData(96, 96); for (let k = 0; k < 96 * 96; k++) { const v = Math.random(); img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = v < 0.5 ? 0 : 255; img.data[k * 4 + 3] = Math.random() < 0.5 ? 0 : 16; } nc.putImageData(img, 0, 0); }
  const noisePat = ctx.createPattern(noise, "repeat"); try { noisePat?.setTransform(new DOMMatrix().scale(1 / 20)); } catch {}

  // ── the grid: what's cut. Lawn outside today's job (and slivers the tractor can't reach) shows as mowed earlier ──
  const cut = new Uint8Array(w.N), jobNeedAny = needCount > 0;   // (tight spots by a fence or wall get a trimmer's soft edge, not a bright dab)
  {
    const g = grass.c, zp = zone(job.zones);
    if (zp) {
      // everything outside today's job: neat stripes from earlier in the week, with clean straight edges along the zone
      const tmp = document.createElement("canvas"); tmp.width = grass.cv.width; tmp.height = grass.cv.height; tmp.getContext("2d")!.drawImage(grass.cv, 0, 0);
      for (let sx = 0; sx < w.W; sx += 4) { g.fillStyle = oldStripeCol(sx + 0.1); g.fillRect(sx, 0, 4.02, w.H); }
      g.save(); g.beginPath(); for (const z of zp) { z.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); } g.clip();
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(tmp, 0, 0); g.restore();
    }
    if (!jobNeedAny) for (let sx = 0; sx < w.W; sx += 4) { g.fillStyle = oldStripeCol(sx + 0.1); g.fillRect(sx, 0, 4.02, w.H); }   // nothing to mow today: it's all done, in neat stripes
    else for (let k = 0; k < w.N; k++) if (w.lawn[k] && !jobNeed[k]) {
      cut[k] = 1; if (water[k]) continue; const x = w.cellX(k), y = w.cellY(k);
      if (!zp || zp.some(z => pip(z, x, y))) { g.fillStyle = jobNeedAny && w.clearance[k] < 1.2 ? "rgb(98,150,64)" : oldStripeCol(x); g.beginPath(); g.arc(x, y, CELL * 0.62, 0, 7); g.fill(); }   // spots too tight to mow count as trimmed (soft round dabs, not squares)
    }
  }
  for (const pd of puddles) { const g = grass.c; g.save(); g.translate(pd.x, pd.y); g.rotate(pd.rot); g.fillStyle = "rgb(96,136,72)"; g.beginPath(); g.ellipse(0, 0, pd.rx + 0.4, pd.ry + 0.4, 0, 0, 7); g.fill(); g.fillStyle = "rgb(84,120,66)"; g.beginPath(); g.ellipse(0, 0, pd.rx + 0.2, pd.ry + 0.2, 0, 0, 7); g.fill(); g.restore(); }
  const mm = document.createElement("canvas"); mm.width = w.NX; mm.height = w.NY;
  const mmc = mm.getContext("2d")!, mmImg = mmc.createImageData(w.NX, w.NY);
  const paintCell = (k: number) => { const o = k * 4; if (!w.lawn[k]) { mmImg.data[o + 3] = 0; return; } if (water[k]) { mmImg.data[o] = 96; mmImg.data[o + 1] = 150; mmImg.data[o + 2] = 190; mmImg.data[o + 3] = 255; return; } const todo = jobNeed[k] && !cut[k]; mmImg.data[o] = todo ? 52 : 168; mmImg.data[o + 1] = todo ? 104 : 212; mmImg.data[o + 2] = todo ? 34 : 112; mmImg.data[o + 3] = 255; };
  for (let k = 0; k < w.N; k++) paintCell(k);
  mmc.putImageData(mmImg, 0, 0);
  let mmDirty = false;

  // ── state ──
  let phase: Phase = mode === "attract" ? "play" : "ready";
  let x = map.start.x, y = map.start.y, h = ((map.start.heading - 90) * Math.PI) / 180, v = 0, om = 0, steer = 0, odo = 0;
  if (startK >= 0) { x = w.cellX(startK); y = w.cellY(startK); h = Math.atan2(faceY - y, faceX - x); }   // jobs start at the edge of their own lawn
  if (rig && job.twist === "trailer") { [x, y] = rigPt(rig, RIG.rampEnd + 6.5, -2.0); h = rig.a; }               // out on the lawn, a little off to one side
  else if (rig) { [x, y] = rigPt(rig, RIG.rampEnd + 1.4, 0); h = rig.a + Math.PI; }                               // just backed down off the ramps
  if (!park) { const p = pushOut(w, x, y, BODY_R, null); x = p.x; y = p.y; }
  let uturn = 0, revT = 0, revSide = 0, stuckN = 0, blockedT = 0, backHoldT = 0, stopT = 0, shake = 0, bumpCool = 0;
  let simT = 0, penalty = 0, meows = 0, bumps = 0, cutCount = 0, drove = 0, frame = 0, sceneT = 0, success = false, ended = false;
  let freshAll = 0, freshStraight = 0, wetT = 0, omS = 0, lastFresh = 0;   // omS: the turn rate, smoothed (gentle steering still counts as straight)
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
  const stripeMask = job.stripeZones ? w.maskIn(jobNeed, zone(job.stripeZones)) : null;   // the stripe score only counts these (the outfields)
  let priorityTotal = 0, priorityCut = 0; if (priorityMask) for (let k = 0; k < w.N; k++) priorityTotal += priorityMask[k];
  const apples: Apple[] = [];
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
  let bubbleT = 0, catSeen = false, nearTold = false;
  // she's at home today (watching from the deck while Pat loads up), or not here at all (the community centre)
  const catMode: "roam" | "deck" | "none" = away ? "none" : park ? "deck" : "roam";
  if (catMode === "none") { cat.st = "in"; cat.next = 1e9; }
  if (catMode === "deck" && deck) { cat.st = "out"; cat.x = (deck.poly[0][0] + deck.poly[2][0]) / 2; cat.y = (deck.poly[0][1] + deck.poly[2][1]) / 2 - deck.height * OBL - 0.4; cat.act = "sit"; cat.h = 0.6; cat.outT = 1e9; cat.actT = 1e9; }
  // loading and unloading: where to park, how close Pat is, the straps going on
  const parkSpot = job.twist === "trailer" && rig ? { x: rigPt(rig, RIG.park, 0)[0], y: rigPt(rig, RIG.park, 0)[1], a: rig.a } : barnBox;
  let elev = 0, inBox = false, parkT = 0, strapK = 0;
  // two kids playing catch at the community centre: they wander about the grass; Pat waits if one's close
  type Kid = { x: number; y: number; h: number; tx: number; ty: number; walk: boolean; shirt: string; hair: string; skin: string };
  const kids: Kid[] = away ? [{ x: 0, y: 0, h: 0, tx: 0, ty: 0, walk: false, shirt: "#e35d4f", hair: "#3b2a20", skin: "#f1c7a3" }, { x: 0, y: 0, h: 0, tx: 0, ty: 0, walk: false, shirt: "#4e8ad6", hair: "#c99a5b", skin: "#e8b48f" }] : [];
  let ballT = 0, ballFrom = 0, kidMoveT = 4, kidCool = 0, waits = 0, hiT = 0, hiKid = 0;

  // input
  type Stick = { id: number; bx: number; by: number; kx: number; ky: number };
  let stick: Stick | null = null, released: { bx: number; by: number; kx: number; ky: number; t: number } | null = null;   // (the knob springs back after a release)
  let thS = 0, thHeld = false, lock: number | null = null, lockCand = 0, lockT = 0, thAsk: number | null = null;   // the heading asked for, smoothed; Straight Assist's lock
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
  const stickRest = () => ({ x: CW / 2, y: MH + 9 + STICK_R + KNOB_R });
  const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  // zoom: pinch on the map or the +/- buttons; from 0.8x to 1.6x of the normal view, remembered in this browser
  const ZOOM_KEY = "pats-lawnmower-zoom";
  let zoomK = 1; try { const z = parseFloat(localStorage.getItem(ZOOM_KEY) || ""); if (z >= 0.8 && z <= 1.6) zoomK = z; } catch {}
  const setZoom = (z: number) => { zoomK = clamp(z, 0.8, 1.6); try { localStorage.setItem(ZOOM_KEY, zoomK.toFixed(3)); } catch {} };
  if (hooks.zoomRef) hooks.zoomRef.current = (dir: number) => setZoom(zoomK * (dir > 0 ? 1 / 1.2 : 1.2));
  const fingers = new Map<number, { x: number; y: number }>();
  let pinch: { d: number; z: number } | null = null;
  const fingerGap = () => { const [a, b] = [...fingers.values()]; return Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)); };
  const onMove = (e: PointerEvent) => {
    if (fingers.has(e.pointerId)) { fingers.set(e.pointerId, local(e)); if (fingers.size === 2 && pinch) setZoom((pinch.z * pinch.d) / fingerGap()); return; }
    if (!stick || stick.id !== e.pointerId) return;
    const p = local(e); let dx = p.x - stick.bx, dy = p.y - stick.by, d = Math.hypot(dx, dy);
    if (d > STICK_R) {   // dragged past the edge: the base follows the thumb, so the stick never runs out
      const over = d - STICK_R; stick.bx = clamp(stick.bx + (dx / d) * over, STICK_R, CW - STICK_R); stick.by = clamp(stick.by + (dy / d) * over, Math.min(MH + 9 + STICK_R + KNOB_R, CH - STICK_R - KNOB_R + 1), Math.max(MH + 9 + STICK_R + KNOB_R, CH - STICK_R - KNOB_R + 1));
      dx = p.x - stick.bx; dy = p.y - stick.by; d = Math.hypot(dx, dy);
    }
    stick.kx = d > STICK_R ? (dx / d) * STICK_R : dx; stick.ky = d > STICK_R ? (dy / d) * STICK_R : dy;
  };
  const onDown = (e: PointerEvent) => {
    if (!cfg.showStrip) return;
    const p = local(e);
    if (p.y < MH) {   // a finger on the map: two of them pinch to zoom
      if (e.pointerType === "mouse" || fingers.size >= 2) return;
      fingers.set(e.pointerId, p); try { canvas.setPointerCapture(e.pointerId); } catch {}
      if (fingers.size === 2) pinch = { d: fingerGap(), z: zoomK };
      e.preventDefault(); return;
    }
    if (p.y < MH + 4 || stick) return;
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    stick = { id: e.pointerId, bx: clamp(p.x, STICK_R, CW - STICK_R), by: clamp(p.y, Math.min(MH + 9 + STICK_R + KNOB_R, CH - STICK_R - KNOB_R + 1), Math.max(MH + 9 + STICK_R + KNOB_R, CH - STICK_R - KNOB_R + 1)), kx: 0, ky: 0 };   // right under the thumb, kept inside the strip
    onMove(e); e.preventDefault();
  };
  const onUp = (e: PointerEvent) => { if (fingers.delete(e.pointerId) && fingers.size < 2) pinch = null; if (stick?.id === e.pointerId) { released = { bx: stick.bx, by: stick.by, kx: stick.kx, ky: stick.ky, t: performance.now() / 1000 }; stick = null; } };
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
        for (const n of [i > 0 ? k - 1 : -1, i < w.NX - 1 ? k + 1 : -1, j > 0 ? k - w.NX : -1, j < w.NY - 1 ? k + w.NX : -1]) if (n >= 0 && w.reach[n] && (!wet[n] || wet[k]) && prev[n] === -2) { prev[n] = k; dist[n] = dist[k] + 1; q.push(n); }
      }
      if (best >= 0) { const p: number[] = []; for (let c = best; c >= 0; c = prev[c]) p.push(c); path = p.reverse(); goalK = best; if (bestU !== goal) { goal = bestU; goalT = 0; } return; }
      if (appleCells.size) { apples.forEach(a => { if (a.st === 0) a.st = 2; }); return; }
    }
  }
  // the main plan is how a tidy person mows: straight north-south stripes a deck-width apart, end to end, with a U-turn
  // at each end; then it tidies up whatever's left, nearest first
  type Seg = { ax: number; ay: number; bx: number; by: number; x: number };
  const segs: Seg[] = []; let segI = 0, segMode: "to" | "on" = "to", segT = 0, toPath: number[] = [], toAt = 0, toPlanT = 0;
  /** Stripes a deck-width apart running along `ang` (north-south by default), end to end; `trim` metres off each end. */
  function buildSegs(mask: Uint8Array, ang = Math.PI / 2, trim = 1.2) {
    const out: Seg[] = [], ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let k = 0; k < w.N; k++) if (mask[k]) { const cx = w.cellX(k), cy = w.cellY(k), u = cx * ux + cy * uy, vv = cx * nx + cy * ny; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, vv); v1 = Math.max(v1, vv); }
    if (!isFinite(u0)) return out;
    const spacing = deckHalf * 1.8, drivable = (px: number, py: number) => { if (px < 0 || py < 0 || px >= w.W || py >= w.H) return false; const k = w.cellOf(px, py); return w.reach[k] && w.clearance[k] >= BODY_R + 0.2; };
    let lane = 0;
    for (let lv = v0 + deckHalf * 0.85; lv <= v1 + deckHalf * 0.5; lv += spacing, lane++) {
      const runs: Seg[] = []; let rs: number | null = null;
      for (let u = u0 - 1; u <= u1 + 1 + CELL; u += CELL) {
        const px = ux * u + nx * lv, py = uy * u + ny * lv;
        let ok = false;
        if (u <= u1 + 1 && drivable(px, py)) for (let d = -deckHalf; d <= deckHalf && !ok; d += CELL) { const qx = px + nx * d, qy = py + ny * d; if (qx >= 0 && qy >= 0 && qx < w.W && qy < w.H && mask[w.cellOf(qx, qy)]) ok = true; }
        if (ok && rs === null) rs = u;
        if (!ok && rs !== null) { let a = rs + trim, b = u - trim - 0.4; const dry = (q: number) => !wet[w.cellOf(ux * q + nx * lv, uy * q + ny * lv)]; while (a < b && !dry(a)) a += CELL; while (b > a && !dry(b)) b -= CELL; if (b - a >= 1) runs.push({ ax: ux * a + nx * lv, ay: uy * a + ny * lv, bx: ux * b + nx * lv, by: uy * b + ny * lv, x: lv }); rs = null; }
      }
      if (lane % 2) runs.reverse().forEach(r => out.push({ ax: r.bx, ay: r.by, bx: r.ax, by: r.ay, x: r.x }));
      else runs.forEach(r => out.push(r));
    }
    return out;
  }
  /** A lap round the inside of a 4-sided zone, `inset` metres in from its edge, starting at the corner nearest the tractor. */
  function lapSegs(poly: Pt[], inset: number) {
    const n = poly.length, [cx, cy] = [poly.reduce((a, q) => a + q[0], 0) / n, poly.reduce((a, q) => a + q[1], 0) / n];
    const lines = poly.map((a, i) => { const b = poly[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); let nx2 = -dy / L, ny2 = dx / L; if ((cx - a[0]) * nx2 + (cy - a[1]) * ny2 < 0) { nx2 = -nx2; ny2 = -ny2; } return { px: a[0] + nx2 * inset, py: a[1] + ny2 * inset, dx: dx / L, dy: dy / L }; });
    const corners: Pt[] = lines.map((l2, i) => { const l1 = lines[(i + n - 1) % n], den = l1.dx * l2.dy - l1.dy * l2.dx; if (Math.abs(den) < 1e-6) return [l2.px, l2.py] as Pt; const t = ((l2.px - l1.px) * l2.dy - (l2.py - l1.py) * l2.dx) / den; return [l1.px + l1.dx * t, l1.py + l1.dy * t] as Pt; });
    let s0 = 0, bd = Infinity; corners.forEach((q, i) => { const d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; s0 = i; } });
    const out: Seg[] = []; for (let i = 0; i < n; i++) { const a = corners[(s0 + i) % n], b = corners[(s0 + i + 1) % n]; out.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], x: 0 }); }
    return out;
  }
  /** The direction of a zone's longest side (stripes look best along it). */
  const longAng = (poly: Pt[]) => { let best = 0, ang = Math.PI / 2; poly.forEach((a, i) => { const b = poly[(i + 1) % poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > best) { best = L; ang = Math.atan2(b[1] - a[1], b[0] - a[0]); } }); return ang; };
  function pathTo(target: number) {
    const from = startCellNear(); if (from < 0 || target < 0) return [];
    const prev = new Int32Array(w.N).fill(-2), q = [from]; prev[from] = -1;
    for (let qi = 0; qi < q.length; qi++) {
      const k = q[qi]; if (k === target) break;
      const i = k % w.NX, j = (k - i) / w.NX;
      for (const n of [i > 0 ? k - 1 : -1, i < w.NX - 1 ? k + 1 : -1, j > 0 ? k - w.NX : -1, j < w.NY - 1 ? k + w.NX : -1]) if (n >= 0 && w.reach[n] && (!wet[n] || wet[k]) && prev[n] === -2) { prev[n] = k; q.push(n); }
    }
    if (prev[target] === -2) return [];
    const p: number[] = []; for (let c = target; c >= 0; c = prev[c]) p.push(c); return p.reverse();
  }
  const segLeft = (sg: Seg) => { let n = 0, t = 0; const L = Math.hypot(sg.bx - sg.ax, sg.by - sg.ay) || 1, nx = -(sg.by - sg.ay) / L, ny = (sg.bx - sg.ax) / L; for (let d = 0; d <= L; d += CELL * 2) { const px = sg.ax + ((sg.bx - sg.ax) * d) / L, py = sg.ay + ((sg.by - sg.ay) * d) / L; for (let o = -deckHalf; o <= deckHalf; o += CELL) { const k = w.cellOf(px + nx * o, py + ny * o); if (jobNeed[k]) { t++; if (!cut[k]) n++; } } } return t ? n / t : 0; };
  let lastIn: [number, number] = [0, 0];
  let segsBuilt = false, lastCut = -1, idleT = 0;
  /** Follows a grid path: aims a little way ahead, closer in where things are tight. */
  const sightOk = (bx: number, by: number) => { const L = Math.hypot(bx - x, by - y), n = Math.ceil(L / 0.3); for (let q = 1; q <= n; q++) { const k = w.cellOf(x + ((bx - x) * q) / n, y + ((by - y) * q) / n); if (!w.reach[k] || wet[k] || w.clearance[k] < BODY_R + 0.12) return false; } return true; };
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
    let want = Math.min(1, m0) * clamp(w.clearance[w.cellOf(x, y)] / 3.0, 0.3, 1);   // easy does it near things (slow enough that a touch isn't a big bump)
    if (apples.some(ap => ap.st === 0 && Math.hypot(ap.x - x, ap.y - y) < deckHalf + 4)) want = Math.min(want, (APPLE_V * 0.8) / vmax);
    const push = DEAD + 0.02 + (1 - DEAD - 0.02) * Math.pow(want, 1 / CURVE);
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
    if (!segsBuilt) {
      segsBuilt = true; if (priorityMask) segs.push(...buildSegs(priorityMask));
      const sz = job.twist === "stripes" ? map.zones.stripes : null;
      // the stripes job, the way a careful person does it: a lap round the edge, then long stripes that turn on the cut border
      if (sz) { segs.push(...lapSegs(sz, deckHalf * 0.85)); segs.push(...buildSegs(jobNeed, longAng(sz), deckHalf * 1.35)); }
      else if (away && job.zones) for (const zn of job.zones) segs.push(...buildSegs(w.maskIn(jobNeed, zone([zn])), Math.PI / 2, 1.0));   // one fenced area at a time
      else segs.push(...buildSegs(jobNeed));
    }
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
      const ahead = Math.max(4, Math.abs(v) * 0.9), ta = Math.min(L + 2, along + ahead);
      let tx = sg.ax + ux * ta, ty = sg.ay + uy * ta;
      // a puddle on the line: swing wide round it and come back to the stripe after
      for (const pd of puddles) {
        const ca = Math.cos(pd.rot), sa = Math.sin(pd.rot), nn = -uy * ca + ux * sa, nm = uy * sa + ux * ca, R = Math.hypot(pd.rx * nn, pd.ry * nm) + BODY_R + 0.45, pa = (pd.x - sg.ax) * ux + (pd.y - sg.ay) * uy, lat = -(pd.x - sg.ax) * uy + (pd.y - sg.ay) * ux;
        if (Math.abs(lat) >= R || pa < along - R * 0.7 || pa > along + ahead + R + 3) continue;
        // follow a copy of the stripe shifted sideways past the puddle (started early so the tractor is beside it in time)
        const off = Math.abs(lat + R) < Math.abs(lat - R) ? lat + R : lat - R, side = (o: number) => { const qx = sg.ax + ux * pa - uy * o, qy = sg.ay + uy * pa + ux * o; return w.reach[w.cellOf(qx, qy)] && w.clearance[w.cellOf(qx, qy)] > BODY_R + 0.2; };
        const o = side(off) ? off : off === lat + R ? lat - R : lat + R, aimA = along + Math.max(3, ahead * 0.8);
        tx = sg.ax + ux * aimA - uy * o; ty = sg.ay + uy * aimA + ux * o; break;
      }
      const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1;
      return [dx / d, dy / d];
    }
    // tidy up: nearest grass first; if nothing gets cut for a while, give up on that patch
    planT -= dt; goalT += dt;
    if (cutCount !== lastCut) { lastCut = cutCount; idleT = 0; } else if (goalK >= 0 && Math.hypot(w.cellX(goalK) - x, w.cellY(goalK) - y) < 4) idleT += dt;
    if (goal >= 0 && (goalT > 7 || idleT > 6)) { const gx = w.cellX(goal), gy = w.cellY(goal); for (let q = 0; q < w.N; q++) if (jobNeed[q] && !cut[q] && Math.hypot(w.cellX(q) - gx, w.cellY(q) - gy) < 2) skip[q] = 1; goal = -1; planT = 0; idleT = 0; }
    if (planT <= 0 || pathAt >= path.length) { plan(); planT = 0.3; }
    if (!path.length) return [0, 0];
    const [sx2, sy2, at] = followPath(path, pathAt); pathAt = at;
    if (pathAt >= path.length - 3 && goal >= 0 && goalK >= 0 && sightOk(w.cellX(goalK), w.cellY(goalK))) {
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
  const kidOk = (px: number, py: number) => px > 1 && py > 1 && px < w.W - 1 && py < w.H - 1 && w.catFree[w.cellOf(px, py)] === 1 && w.lawn[w.cellOf(px, py)] === 1;
  const kidLine = (ax: number, ay: number, bx: number, by: number) => { const L = Math.hypot(bx - ax, by - ay), n = Math.ceil(L / 0.3); for (let q = 1; q <= n; q++) { const k2 = w.cellOf(ax + ((bx - ax) * q) / n, ay + ((by - ay) * q) / n); if (!w.catFree[k2]) return false; } return true; };
  /** Picks a new pair of spots on open grass away from Pat, a good throw apart; `jump` puts the kids straight there. */
  function kidSpots(jump: boolean) {
    for (let t = 0; t < 200; t++) {
      const k = Math.floor(rnd() * w.N); if (!w.lawn[k] || w.clearance[k] < 2) continue;
      const ax = w.cellX(k), ay = w.cellY(k), an = rnd() * Math.PI * 2, d = 6 + rnd() * 2.5, bx = ax + Math.cos(an) * d, by = ay + Math.sin(an) * d;
      if (Math.hypot(ax - x, ay - y) < 12 || Math.hypot(bx - x, by - y) < 12 || !kidOk(bx, by) || !kidLine(ax, ay, bx, by)) continue;
      if (!jump && (!kidLine(kids[0].x, kids[0].y, ax, ay) || !kidLine(kids[1].x, kids[1].y, bx, by))) continue;
      kids[0].tx = ax; kids[0].ty = ay; kids[1].tx = bx; kids[1].ty = by;
      for (const kd of kids) { if (jump) { kd.x = kd.tx; kd.y = kd.ty; } kd.walk = !jump; }
      return;
    }
  }
  function kidsStep(dt: number) {
    kidMoveT -= dt; kidCool -= dt; hiT = Math.max(0, hiT - dt);
    const near = kids.some(kd => !kd.walk && Math.hypot(kd.x - x, kd.y - y) < 6);
    if (kidMoveT <= 0 || (near && kidMoveT < 18)) { kidSpots(false); kidMoveT = 20 + rnd() * 10; }
    for (const kd of kids) {
      if (kd.walk) {
        const dx = kd.tx - kd.x, dy = kd.ty - kd.y, d = Math.hypot(dx, dy);
        if (d < 0.1) kd.walk = false; else { const st = Math.min(d, 1.3 * dt); kd.x += (dx / d) * st; kd.y += (dy / d) * st; kd.h = Math.atan2(dy, dx); }
      }
    }
    if (!kids[0].walk && !kids[1].walk) { for (const [a, b] of [[0, 1], [1, 0]]) kids[a].h = Math.atan2(kids[b].y - kids[a].y, kids[b].x - kids[a].x); ballT += dt / 1.3; if (ballT >= 1) { ballT = 0; ballFrom = 1 - ballFrom; } }
    // Pat waits for a kid close in front of him (no time penalty, he just stops and says hi)
    if (kidCool <= 0 && Math.abs(v) > 0.3) kids.forEach((kd, i) => {
      const dx = kd.x - x, dy = kd.y - y, d = Math.hypot(dx, dy);
      if (d < 3.2 && dx * Math.cos(h) + dy * Math.sin(h) > -0.5) { stopT = 1.4; v = 0; om = 0; uturn = 0; waits++; hiT = 1.8; hiKid = i; kidCool = 4; kidMoveT = Math.min(kidMoveT, 1); }
    });
  }
  if (away) kidSpots(true);

  function catStep(dt: number) {
    if (catMode !== "roam") { cat.cool -= dt; return; }
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
    let fresh = 0, freshZ = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * w.NX + i; if (cut[k] || !w.lawn[k]) continue;
      const dx = (i + 0.5) * CELL - x, dy = (j + 0.5) * CELL - y, lon = dx * c + dy * s, lat = -dx * s + dy * c;
      if (Math.abs(lon) <= DECK_LON && Math.abs(lat) <= deckHalf + 0.1) { cut[k] = 1; if (jobNeed[k]) { cutCount++; fresh++; if (!stripeMask || stripeMask[k]) freshZ++; if (priorityMask?.[k]) priorityCut++; } paintCell(k); mmDirty = true; }
    }
    if (moving || fresh) { const g = grass.c; g.save(); g.translate(x, y); g.rotate(h); g.fillStyle = stripeCol(h); g.fillRect(-DECK_LON * 0.75, -deckHalf + 0.04, DECK_LON * 1.5, deckHalf * 2 - 0.08); g.restore(); }
    lastFresh = fresh;
    if (fresh) {
      freshAll += freshZ; if (omS < STRAIGHT_OM) freshStraight += freshZ;
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
    const s3 = park ? bumps === 0 : away ? q >= (job.stripeGoal ?? 0.6) : job.twist === "bonfire" ? bumps === 0 : job.twist === "storm" ? wetT < 4 : job.twist === "guests" ? priorityOk : job.twist === "apples" ? applesGot() >= 10 : job.twist === "stripes" ? q >= 0.75 : meows === 0;
    return { job: job.id, done, secs, limit, par, pct: pct(), stars: [done, done && (job.star2 ? bumps === 0 : secs <= par), done && s3], meows, bumps, apples: applesGot(), applesTotal: apples.length, quality: q, wet: wetT, priorityOk };
  }
  function endRun(ok: boolean) {
    if (phase !== "play") return;
    phase = "scene"; sceneT = 0; success = ok; v = 0; om = 0; uturn = 0; stick = null;
    if (ok) {
      snd.chime();
      if (job.twist === "bonfire" || job.twist === "finale") { addPeople(fireSpots()); if (job.twist === "finale") { if (pits.length === 2) addPeople([[pits[0].x - 0.8, pits[0].y - 1.6, Math.PI / 2, "throw"], [pits[1].x + 0.8, pits[1].y + 1.6, -Math.PI / 2, "throw"]]); if (deck) { const [dx, dy] = [(deck.poly[0][0] + deck.poly[2][0]) / 2, (deck.poly[0][1] + deck.poly[2][1]) / 2 - deck.height * OBL]; cat.st = "out"; cat.x = dx; cat.y = dy; cat.act = "nap"; cat.h = 0.4; } } }
      if (job.twist === "guests" && !guestsIn && pits.length === 2) addPeople([[pits[0].x - 0.9, pits[0].y - 1.7, Math.PI / 2, "throw"], [pits[1].x + 0.9, pits[1].y + 1.7, -Math.PI / 2, "throw"], [pits[0].x + 2.2, pits[0].y + 0.6, Math.PI, "stand"]]);
      if (job.twist === "trailer") strapK = 0;
      if (job.twist === "unload" && barnBox) { cat.x = barnBox.x + Math.cos(barnBox.a + Math.PI / 2) * 1.6; cat.y = barnBox.y + Math.sin(barnBox.a + Math.PI / 2) * 1.6; cat.act = "sit"; cat.h = barnBox.a + Math.PI; }
      if (away) {   // the teams turn up: players at both diamonds, folks on the bleachers
        const plates = COMMUNITY_PLATES.map(q => [(q[0] - raw.origin[0]) * raw.unit, (q[1] - raw.origin[1]) * raw.unit]);
        for (const [hx, hy] of plates) addPeople([[hx - 1.2, hy - 1.0, -2.3, "stand"], [hx - 6, hy - 6, 0.8, "throw"], [hx - 10, hy - 2, 0.2, "stand"], [hx - 3, hy - 9, 1.5, "stand"]]);
        for (const b of map.props.filter(q => q.kind === "bleacher")) addPeople([[b.x - 0.3, b.y - 0.8, Math.PI, "sit"], [b.x + 0.2, b.y + 0.9, Math.PI, "sit"]]);
      }
      if (job.twist === "cat") { cat.st = "out"; if (deck) { cat.x = (deck.poly[0][0] + deck.poly[2][0]) / 2; cat.y = (deck.poly[0][1] + deck.poly[2][1]) / 2 - deck.height * OBL; } cat.act = "nap"; }
      banner = { text: job.twist === "trailer" ? "Strapped In!" : job.twist === "unload" ? "Home Sweet Home!" : away ? "Ready For The Game!" : job.twist === "storm" ? "Just In Time!" : job.twist === "apples" ? `${applesGot()} Apples Picked!` : job.twist === "finale" ? "Every Blade Done!" : job.twist === "bonfire" ? "Fire's Lit!" : job.twist === "guests" ? "Let The Games Begin!" : job.twist === "stripes" ? "Look At Those Stripes!" : job.twist === "cat" ? "Nap Time!" : mode === "free" ? "Lawn Mowed!" : "Job Done!", sub: "", t: 0 };
      if (job.twist === "storm") { thunderAt = 0.6; }
    } else {
      snd.fail();
      banner = { text: job.twist === "bonfire" ? "Too Dark To Mow" : job.twist === "storm" ? "Rained Out" : "Out Of Time", sub: "", t: 0 };
    }
  }
  hooks.finishRef.current = () => { if (phase === "play" && pct() >= NEAR_DONE) endRun(true); };

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
    // never swing into a wall (or a puddle): a side without room for the turn loses
    const uR = Math.max(rmin(3), deckHalf * 0.88), room = (side: number) => { let worst = 9; for (const a of [0.6, 1.2, 1.8, 2.4]) { const px = x + uR * (Math.sin(a) * c - side * (1 - Math.cos(a)) * s), py = y + uR * (Math.sin(a) * s + side * (1 - Math.cos(a)) * c); const kk = w.cellOf(px, py); worst = Math.min(worst, water[kk] ? 0 : wet[kk] ? BODY_R + 0.05 : w.clearance[kk]); } return worst; };
    const rl = room(-1), rr2 = room(1);
    if (prefer && (prefer < 0 ? rl : rr2) >= BODY_R + 0.1) return prefer;   // the side the player asked for, if there's room
    if (rl < BODY_R + 0.1 && rr2 >= BODY_R + 0.1) return 1;
    if (rr2 < BODY_R + 0.1 && rl >= BODY_R + 0.1) return -1;
    if (rl < BODY_R + 0.1 && rr2 < BODY_R + 0.1) return rr2 >= rl ? 1 : -1;
    return Rr >= L ? 1 : -1;   // +1 turns clockwise (to the tractor's right)
  }

  /** A little haptic tick (Android; harmless where phones don't support it). */
  const buzz = () => { try { if (mode !== "attract" && !auto) navigator.vibrate?.(14); } catch {} };
  /** The tractor as two circles front and back (it has to fit on a trailer), pushed out of walls and the rig. */
  function collidePark(px: number, py: number) {
    let hit = false, nx = 0, ny = 0;
    for (let it = 0; it < 2; it++) for (const off of [0.55, -0.45]) for (const wd of [w, jw]) {
      const cx = px + Math.cos(h) * off, cy = py + Math.sin(h) * off, q = pushOut(wd, cx, cy, 0.6, null);
      if (q.hit) { px += q.x - cx; py += q.y - cy; nx += q.nx; ny += q.ny; hit = true; }
    }
    const l = Math.hypot(nx, ny); return { x: px, y: py, nx: l ? nx / l : 0, ny: l ? ny / l : 0, hit };
  }
  const boxLocal = (px: number, py: number) => { const s0 = parkSpot!, dx = px - s0.x, dy = py - s0.y, c = Math.cos(s0.a), sn = Math.sin(s0.a); return { lon: dx * c + dy * sn, lat: -dx * sn + dy * c }; };

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
      // the heading asked for, smoothed so a wobbly thumb doesn't wobble the tractor; Straight Assist locks it when steady
      const thRaw = Math.atan2(ay, ax);
      if (!thHeld) { thS = thRaw; thHeld = true; lockCand = thRaw; lockT = 0; } else thS = wrapA(thS + wrapA(thRaw - thS) * Math.min(1, dt * 7));
      if (hooks.assist?.() ?? true) {
        if (lock === null) { if (Math.abs(wrapA(thRaw - lockCand)) < 0.11) { lockT += dt; if (lockT > 0.3) lock = thS; } else { lockCand = thRaw; lockT = 0; } }
        else if (Math.abs(wrapA(thRaw - lock)) > LOCK_OFF) { lock = null; lockCand = thRaw; lockT = 0; }
      } else lock = null;
      const mag = Math.pow((raw - DEAD) / (1 - DEAD), CURVE), th = lock ?? thS, diff = wrapA(th - h);
      thAsk = th;
      const diffRaw = wrapA(thRaw - h);   // (a U-turn starts on the raw stick, without waiting for the smoothing)
      if (!uturn && Math.abs(diffRaw) > 2.25) { uturn = uturnSide(Math.abs(Math.abs(diffRaw) - Math.PI) < 0.45 ? 0 : Math.sign(diffRaw)); thS = thRaw; lock = null; }
      if (uturn && Math.abs(diff) < 0.5) uturn = 0;
      if (uturn) {
        // pointing behind: a tight forward U-turn that comes back alongside the last strip
        const uR = Math.max(rmin(v), deckHalf * 0.88);   // as tight as the speed allows, so the new pass lands just inside the last
        target = Math.min(vmax, 3.6) * Math.max(0.65, mag); omT = uturn * (Math.max(0.5, v) / uR);
      } else {
        target = vmax * mag * Math.max(0.3, Math.pow(Math.cos(Math.min(Math.abs(diff), 1.35)), 1.4));
        omT = clamp(diff * 2.6, -3.2, 3.2);
      }
      // stopped against something with the stick pulled back for a moment: back up a little
      if (v < 0.3 && blockedT > 0.3 && Math.abs(diff) > 2.25) { backHoldT += dt; if (backHoldT > 0.6) { revT = 0.9; revSide = Math.sign(diff) || 1; backHoldT = 0; uturn = 0; } } else backHoldT = 0;
    } else { uturn = 0; backHoldT = 0; thHeld = false; lock = null; thAsk = null; }
    const inPuddle = puddles.some(p => { const dx = x - p.x, dy = y - p.y, c = Math.cos(-p.rot), s = Math.sin(-p.rot), lx = dx * c - dy * s, ly = dx * s + dy * c; return (lx * lx) / (p.rx * p.rx) + (ly * ly) / (p.ry * p.ry) < 1; });
    if (inPuddle && phase === "play") { target = Math.sign(target) * Math.min(Math.abs(target), vmax * 0.42); if (Math.abs(v) > 0.5) { wetT += dt; if (rnd() < 0.5) parts.push({ x: x + (rnd() - 0.5), y: y + (rnd() - 0.5), vx: (rnd() - 0.5) * 3, vy: (rnd() - 0.5) * 3, life: 0.45, c: "rgba(210,230,245,0.9)", s: 0.12 }); } }
    // loading and unloading: creep near the trailer and the barn, and ride up the ramps
    const rl = rig && park ? rigLocal(rig, x, y) : null;
    if ((rl && rl.s > RIG.bedStart - 0.5 && rl.s < RIG.rampEnd + 3.5 && Math.abs(rl.l) < 2.6) || (barnBox && Math.hypot(x - barnBox.x, y - barnBox.y) < 6.5)) target = Math.sign(target) * Math.min(Math.abs(target), 2.2);
    elev = rl && Math.abs(rl.l) < RIG.rampHalf + 0.15 && rl.s > RIG.bedStart && rl.s < RIG.rampEnd ? clamp((RIG.rampEnd - rl.s) / (RIG.rampEnd - RIG.bedEnd), 0, 1) : 0;
    const dec = uturn ? 16 : raw > DEAD || halt || Math.abs(v) < 1.5 ? DEC : DEC_SOFT;   // (brake into a U-turn so it stays tight)
    v += clamp(target - v, -dec * dt, ACC * dt);
    // yaw follows the request smoothly, never tighter than the turning circle allows at this speed (it can't spin on the spot)
    const omMax = Math.abs(v) / rmin(v);
    om += clamp(clamp(omT, -omMax, omMax) - om, -9 * dt, 9 * dt); om = clamp(om, -omMax, omMax);
    h = wrapA(h + om * dt); omS += (Math.abs(om) - omS) * Math.min(1, dt * 5);
    if (thAsk !== null && !uturn && revT <= 0 && Math.abs(v) > 0.2 && Math.abs(wrapA(thAsk - h)) < SNAP) { h = thAsk; om *= 0.5; }   // close enough: dead straight, for neat stripes
    const steerT = Math.abs(v) > 0.3 ? clamp(Math.atan((1.3 * om) / v), -0.7, 0.7) : (raw > DEAD ? clamp(wrapA(Math.atan2(ay, ax) - h), -0.7, 0.7) : 0);
    steer += (steerT - steer) * Math.min(1, dt * 12);
    const ox = x, oy = y, dirX = Math.cos(h), dirY = Math.sin(h);
    const p = park ? collidePark(x + dirX * v * dt, y + dirY * v * dt) : pushOut(w, x + dirX * v * dt, y + dirY * v * dt, BODY_R, cat.st !== "in" && catMode === "roam" ? { x: cat.x, y: cat.y, r: CAT_R } : null);
    if (p.hit) {
      const into = -(dirX * p.nx + dirY * p.ny) * v;
      if (park) {   // loading up: any real touch on the trailer, the ramps, the truck or the barn counts
        if (into > 0.35) { v *= 0.3; if (bumpCool <= 0 && phase === "play") { buzz(); bumps++; bumpCool = 0.8; shake = 0.15; snd.bump(); floatAt("Bump!", x, y - 1.4, "#ffd2cc"); } }
      } else if (into > 1.4) {
        v *= 0.35;
        if (bumpCool <= 0) { buzz(); shake = 0.22; if (phase === "play" && into > 2.5) bumps++; bumpCool = 0.5; snd.bump(); for (let n = 0; n < 7; n++) parts.push({ x: p.x - p.nx * BODY_R, y: p.y - p.ny * BODY_R, vx: (rnd() - 0.5) * 2 + p.nx, vy: (rnd() - 0.5) * 2 + p.ny, life: 0.45, c: "rgba(190,175,150,0.85)", s: 0.14 }); }
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
    if (!park && (phase === "play" || (phase === "ready" && moved > 0))) mow(moved > 0.001);
    if (phase === "play") simT += dt;
    catStep(dt);
    // the cat and the tractor: Pat always stops for her
    if (catMode === "roam" && cat.st !== "in" && cat.st !== "flee" && cat.cool <= 0 && phase === "play") {
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
      if (kids.length) kidsStep(dt);
      if (parkSpot) {   // parked: in the box, lined up (either way round) and stopped for a moment
        const q = boxLocal(x, y), aligned = Math.abs(Math.sin(h - parkSpot.a)) < 0.3;
        inBox = Math.abs(q.lon) < 0.6 && Math.abs(q.lat) < 0.35 && aligned;
        parkT = inBox && Math.abs(v) < 0.3 ? parkT + dt : 0;
        if (parkT > 0.5) endRun(true);
      }
      if (!park && !nearTold && pct() >= NEAR_DONE && mode !== "attract") { nearTold = true; say("Nearly Done! Follow The Arrow"); }
      if (!park && cutCount >= needCount * DONE_AT) endRun(true);
      else if (limit && simT >= limit) endRun(false);
    }
    if (phase === "scene") {
      sceneT += dt; banner.t += dt;
      if (success && (job.twist === "bonfire" || job.twist === "finale")) fireAmt = Math.min(1, fireAmt + dt * 0.8);
      if ((job.twist === "storm") ) { rainAmt = Math.min(1, rainAmt + dt * 0.7); if (thunderAt > 0 && sceneT > thunderAt) { thunderAt = 0; snd.thunder(); } }
      if (success && job.twist === "trailer") { const k0 = strapK; strapK = Math.min(1, sceneT / 1.8); if (Math.floor(k0 * 8) !== Math.floor(strapK * 8)) snd.clank(); }
      if (sceneT > (success ? (job.twist === "finale" || job.twist === "away" ? 5 : 3.6) : 2.4) && !ended) { ended = true; phase = "over"; hooks.onEnd(outcome(success)); }
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
    ctx.save(); ctx.fillStyle = bg; if (ctx.globalAlpha > 0.98) { ctx.shadowColor = "rgba(0,0,0,0.2)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; } rr(ctx, cx - tw / 2, cy - hgt / 2, tw, hgt, hgt / 2); ctx.fill(); ctx.restore();   // (Safari ignores globalAlpha on a fill with a shadow, so a fading pill gets none)
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
    if (!park && phase === "play" && p >= NEAR_DONE && mode !== "attract") {
      if (frame - missedAt > 20) { missed = []; for (let q = 0; q < w.N; q++) if (jobNeed[q] && !cut[q]) missed.push(q); missedAt = frame; }
      const pulse = 0.5 + 0.5 * Math.sin(time * 5);
      c.fillStyle = `rgba(255,216,80,${(0.35 + 0.35 * pulse).toFixed(3)})`;
      c.beginPath(); for (const q of missed) { c.moveTo(w.cellX(q) + CELL * (0.8 + 0.25 * pulse), w.cellY(q)); c.arc(w.cellX(q), w.cellY(q), CELL * (0.8 + 0.25 * pulse), 0, 7); } c.fill();
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
    // the two kids and their ball
    if (kids.length) {
      for (const kd of kids) drawPerson(c, kd.x, kd.y, kd.h, kd.shirt, kd.hair, kd.skin, kd.walk ? "stand" : "throw", time * 1.4 + kd.x, 1.05);
      if (!kids[0].walk && !kids[1].walk) { const a = kids[ballFrom], b = kids[1 - ballFrom], u = ballT, bx = a.x + (b.x - a.x) * u, by = a.y + (b.y - a.y) * u, lift = Math.sin(u * Math.PI) * 1.6;
        c.fillStyle = "rgba(20,40,10,0.22)"; c.beginPath(); c.ellipse(bx + 0.15, by + 0.15, 0.1, 0.07, 0, 0, 7); c.fill();
        c.fillStyle = "#ffffff"; c.strokeStyle = "rgba(200,60,50,0.8)"; c.lineWidth = 0.025; c.beginPath(); c.arc(bx, by - lift, 0.11, 0, 7); c.fill(); c.stroke(); }
    }
    // the truck and trailer, the barn floor and where to park
    if (rig) drawRig(c, rig, { ramps: true, box: job.twist === "trailer" && phase !== "scene" && phase !== "over" ? 0.7 + 0.3 * Math.sin(time * 4) : 0 });
    if (barn && barnBox) {
      c.save(); pathPoly(c, barn.poly); c.fillStyle = "#b9b2a5"; c.fill(); c.clip(); c.strokeStyle = "rgba(90,80,70,0.25)"; c.lineWidth = 0.04; for (let k2 = -12; k2 < 12; k2 += 0.6) { c.beginPath(); c.moveTo(barnBox.x - 12, barnBox.y + k2); c.lineTo(barnBox.x + 12, barnBox.y + k2); c.stroke(); } c.restore();
      c.save(); c.translate(barnBox.x, barnBox.y); c.rotate(barnBox.a); c.setLineDash([0.28, 0.18]); c.strokeStyle = "#ffd23f"; c.lineWidth = 0.09; c.strokeRect(-1.3, -0.75, 2.6, 1.5); c.setLineDash([]); c.restore();
    }
    const catOnDeck = cat.st !== "in" && deck && pip(deck.poly.map(q => [q[0], q[1] - deck.height * OBL] as Pt), cat.x, cat.y);
    // up on the ramps and the trailer the tractor sits a little higher (drawn a touch bigger, its shadow further off)
    const ek = 1 + 0.07 * elev;
    c.save(); c.translate(x, y); c.scale(ek, ek); c.translate(-x, -y);
    drawMower(c, x, y, h, steer, odo, time, phase === "play" || (park && phase === "ready"), deckShow, paint, cfg.up.bagger, cfg.up.lights && (job.light === "dusk" || job.light === "storm"));
    c.restore();
    if (job.twist === "trailer" && rig) drawStraps(c, rig, strapK);
    if (thAsk !== null && !auto && (phase === "play" || phase === "ready")) {   // where Pat's trying to go: a faint arrow just ahead
      const d0 = Math.max(2.6, deckShow * 0.6 + 1.8), ax2 = x + Math.cos(thAsk) * d0, ay2 = y + Math.sin(thAsk) * d0;
      if (lock !== null) { c.save(); c.strokeStyle = "rgba(255,255,255,0.45)"; c.lineWidth = 0.12; c.setLineDash([0.5, 0.5]); c.beginPath(); c.moveTo(ax2 + Math.cos(thAsk) * 0.9, ay2 + Math.sin(thAsk) * 0.9); c.lineTo(x + Math.cos(thAsk) * 14, y + Math.sin(thAsk) * 14); c.stroke(); c.restore(); }
      c.save(); c.translate(ax2, ay2); c.rotate(thAsk); c.globalAlpha = 0.6; c.fillStyle = "#ffffff"; c.strokeStyle = "rgba(30,50,20,0.45)"; c.lineWidth = 0.06;
      c.beginPath(); c.moveTo(0.75, 0); c.lineTo(-0.3, -0.55); c.lineTo(-0.05, 0); c.lineTo(-0.3, 0.55); c.closePath(); c.fill(); c.stroke(); c.restore();
    }
    if (cat.st !== "in" && !catOnDeck) drawCat(c, cat, time);   // over the tractor, so she's never lost under the wide deck
    if (firePit) drawFire(c, firePit.x, firePit.y, firePit.r ?? 0.8, time, fireAmt);
    // trees over the top, on their own layer with a soft window cut round Pat and the cat when they're underneath
    {
      const cv = c.canvas; if (canopy.width !== cv.width || canopy.height !== cv.height) { canopy.width = cv.width; canopy.height = cv.height; }
      cc.setTransform(1, 0, 0, 1, 0, 0); cc.clearRect(0, 0, canopy.width, canopy.height); cc.setTransform(c.getTransform());
      map.trees.forEach((t, i) => {
        if (t.kind === "well") return;
        const near = Math.hypot(t.x - x, t.y - y) < t.r + Math.max(BODY_R, deckHalf) + 0.4 || (cat.st !== "in" && Math.hypot(t.x - cat.x, t.y - cat.y) < t.r + 0.4);
        treeAlpha[i] += ((near ? 0.8 : 0.96) - treeAlpha[i]) * Math.min(1, dt * 8);
        drawTree(cc, t, treeBlobs[i], treeAlpha[i], time * (job.twist === "storm" ? 2.2 : 1));
      });
      cc.globalCompositeOperation = "destination-out";
      const hole = (hx: number, hy: number, r: number) => { const g = cc.createRadialGradient(hx, hy, 0, hx, hy, r); g.addColorStop(0, "rgba(0,0,0,0.85)"); g.addColorStop(0.55, "rgba(0,0,0,0.7)"); g.addColorStop(1, "rgba(0,0,0,0)"); cc.fillStyle = g; cc.beginPath(); cc.arc(hx, hy, r, 0, 7); cc.fill(); };
      hole(x, y, Math.max(2.6, deckHalf + 1.0));
      if (cat.st !== "in") hole(cat.x, cat.y, 1.4);
      if (rig && job.twist === "trailer") { const [ax, ay] = rigPt(rig, RIG.park, 0), [bx, by] = rigPt(rig, RIG.rampEnd, 0); hole(ax, ay, 3.2); hole(bx, by, 3.0); }   // keep the trailer and the ramps in view
      cc.globalCompositeOperation = "source-over";
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(canopy, 0, 0); c.restore();
    }
    map.buildings.forEach((b, i) => {
      const dz = b.height * OBL, roof = b.poly.map(q => [q[0], q[1] - dz] as Pt);
      const behind = pip(roof, x, y) && !pip(b.poly, x, y) && polyClosest(b.poly, x, y).d > 0.2;
      const catBehind = cat.st !== "in" && !catOnDeck && pip(roof, cat.x, cat.y);
      const inside = b === barn && barnBox !== null && (pip(b.poly, x, y) || (phase !== "play" && success));   // putting the tractor away: see in through the roof
      roofAlpha[i] += ((inside ? 0.18 : behind || catBehind ? 0.45 : 1) - roofAlpha[i]) * Math.min(1, dt * 8);
      const im = baked[i]; c.globalAlpha = roofAlpha[i]; c.drawImage(im.cv, im.x, im.y, im.w, im.h); c.globalAlpha = 1;
    });
    if (catOnDeck) drawCat(c, cat, time);
    // behind a roof: show the tractor and the cat through it, a little faded
    const covered = (px: number, py: number) => map.buildings.some((b, i) => roofAlpha[i] < 0.95 && pip(b.poly.map(q => [q[0], q[1] - b.height * OBL] as Pt), px, py));
    c.save(); c.globalAlpha = 0.55;
    if (cat.st !== "in" && !catOnDeck && covered(cat.x, cat.y)) drawCat(c, cat, time, 2.0, false);
    if (covered(x, y)) drawMower(c, x, y, h, steer, odo, time, phase === "play", deckShow, paint, cfg.up.bagger, false);
    c.restore();
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
    let S = Math.min(CW, MH) / (mode === "attract" ? VIEW_M * 1.15 : VIEW_M * zoomK);
    let tx = x + Math.cos(h) * v * 0.55, ty = y + Math.sin(h) * v * 0.55 + (MH / S) * 0.06;
    if (parkSpot) { const d = Math.hypot(parkSpot.x - x, parkSpot.y - y); if (d < 20) { const k2 = 0.45 * (1 - Math.max(0, d - 12) / 8); tx += (parkSpot.x - tx) * k2; ty += (parkSpot.y - ty) * k2; } }   // look ahead to where to park
    // end scenes: the camera goes to where the party is, or pulls back to show the stripes
    if ((phase === "scene" || phase === "over") && success) {
      const fit = (pts: [number, number][], pad: number) => { const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]); tx = (Math.min(...xs) + Math.max(...xs)) / 2; ty = (Math.min(...ys) + Math.max(...ys)) / 2; S = Math.min(CW / (Math.max(...xs) - Math.min(...xs) + pad * 2), MH / (Math.max(...ys) - Math.min(...ys) + pad * 2)); };
      const deckC: [number, number] | null = deck ? [(deck.poly[0][0] + deck.poly[2][0]) / 2, (deck.poly[0][1] + deck.poly[2][1]) / 2] : null;
      if (job.twist === "bonfire" && firePit) fit([[firePit.x, firePit.y]], 4.5);
      if (job.twist === "finale" && firePit) fit([[firePit.x, firePit.y], ...(deckC ? [deckC] : []), ...pits.map(q => [q.x, q.y] as [number, number])], 3);
      if (job.twist === "guests" && pits.length) fit(pits.map(q => [q.x, q.y] as [number, number]), 4.5);
      if (job.twist === "cat" && deckC) fit([deckC], 5);
      if (job.twist === "trailer" && rig) fit([rigPt(rig, -0.5, -1.5), rigPt(rig, RIG.rampEnd + 0.5, 1.5)], 2.5);
      if (job.twist === "unload" && barn) fit(barn.poly.map(q => [q[0], q[1]] as [number, number]), 3);
      if (away) { const zs = [...(map.zones.outfieldW ?? []), ...(map.zones.outfieldE ?? [])]; if (zs.length) fit(zs.map(q => [q[0], q[1]] as [number, number]), 2); }
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
      ctx.save(); ctx.globalAlpha = a; ctx.translate(bx, by); ctx.scale(pop, pop); ctx.fillStyle = "#fff"; if (a > 0.98) { ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 8; }
      rr(ctx, -32, -14, 64, 26, 13); ctx.fill(); ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(0, 20); ctx.lineTo(6, 10); ctx.fill();
      ctx.shadowBlur = 0; ctx.restore(); ctx.save(); ctx.globalAlpha = a; text("Meow!", bx, by - 1, 14, "#2b3441", 800); ctx.restore();
      const px = sx(x), py = sy(y) - 30; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = "#fff"; rr(ctx, px - 11, py - 11, 22, 22, 11); ctx.fill(); text("!", px, py, 15, "#d0402f", 900); ctx.restore();
    }
    if (cat.st !== "in" && cat.act === "nap" && bubbleT <= 0) for (let q = 0; q < 3; q++) { const ph = (time * 0.6 + q / 3) % 1; ctx.save(); ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9; text("z", sx(cat.x) + 10 + ph * 10, sy(cat.y) - 12 - ph * 18, 10 + ph * 5, "#ffffff", 800); ctx.restore(); }
    for (const f of floats) { const u = 1 - f.t / 1.4; ctx.save(); ctx.globalAlpha = Math.min(1, f.t * 2); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(30,40,20,0.55)"; ctx.font = `800 14px ${FONT}`; ctx.textAlign = "center"; ctx.strokeText(f.text, sx(f.x), sy(f.y) - u * 26); text(f.text, sx(f.x), sy(f.y) - u * 26, 14, f.color, 800); ctx.restore(); }
    // arrow to the nearest missed spot when it's off screen
    if (!park && phase === "play" && pct() >= NEAR_DONE && missed.length && mode !== "attract") {
      let best = -1, bd = Infinity; for (const q of missed) { const d = Math.hypot(w.cellX(q) - x, w.cellY(q) - y); if (d < bd) { bd = d; best = q; } }
      const qx = sx(w.cellX(best)), qy = sy(w.cellY(best));
      const bob = Math.sin(time * 6) * 3;
      if (qx < 8 || qx > CW - 8 || qy < 8 || qy > MH - 8) {
        // off screen: an arrow on the edge pointing at it, with how far
        const a = Math.atan2(qy - sy(y), qx - sx(x)), ex = clamp(qx, 26, CW - 26), ey = clamp(qy, 26, MH - 26);
        ctx.save(); ctx.translate(ex - Math.cos(a) * bob, ey - Math.sin(a) * bob); ctx.rotate(a); ctx.fillStyle = "#ffd646"; ctx.strokeStyle = "rgba(60,50,0,0.6)"; ctx.lineWidth = 2; ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; ctx.stroke(); ctx.restore();
        const lx = clamp(ex - Math.cos(a) * 30, 24, CW - 24), ly = clamp(ey - Math.sin(a) * 26, 18, MH - 18);
        pill(`${Math.round(bd)} m`, lx, ly, 11, "#5c4a12", "rgba(255,246,214,0.95)", 8, 20);
      } else if (bd > 3) {
        // on screen but not right here: a bouncing marker over it
        ctx.save(); ctx.translate(qx, qy - 16 + bob); ctx.fillStyle = "#ffd646"; ctx.strokeStyle = "rgba(60,50,0,0.6)"; ctx.lineWidth = 2; ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-10, -4); ctx.lineTo(-4, -4); ctx.lineTo(-4, -12); ctx.lineTo(4, -12); ctx.lineTo(4, -4); ctx.lineTo(10, -4); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; ctx.stroke(); ctx.restore();
      }
    }
    // where to park: an arrow on the edge when it's off screen, a bouncing marker over it (or the barn door) when not
    if (parkSpot && phase !== "scene" && phase !== "over") {
      const outside = barn && barnBox && barnDoor && !pip(barn.poly, x, y), mx0 = outside ? barnDoor![0] - Math.cos(barnBox!.a) * 1.4 : parkSpot.x, my0 = outside ? barnDoor![1] - Math.sin(barnBox!.a) * 1.4 : parkSpot.y;
      const qx = sx(mx0), qy = sy(my0), bob = Math.sin(time * 6) * 3, d = Math.hypot(parkSpot.x - x, parkSpot.y - y);
      if (qx < 8 || qx > CW - 8 || qy < 8 || qy > MH - 8) {
        const a = Math.atan2(qy - sy(y), qx - sx(x)), ex = clamp(qx, 26, CW - 26), ey = clamp(qy, 26, MH - 26);
        ctx.save(); ctx.translate(ex - Math.cos(a) * bob, ey - Math.sin(a) * bob); ctx.rotate(a); ctx.fillStyle = "#ffd646"; ctx.strokeStyle = "rgba(60,50,0,0.6)"; ctx.lineWidth = 2; ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; ctx.stroke(); ctx.restore();
      } else if (d > 2.5 && !inBox) {
        ctx.save(); ctx.translate(qx, qy - 22 + bob); ctx.fillStyle = "#ffd646"; ctx.strokeStyle = "rgba(60,50,0,0.6)"; ctx.lineWidth = 2; ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-10, -4); ctx.lineTo(-4, -4); ctx.lineTo(-4, -12); ctx.lineTo(4, -12); ctx.lineTo(4, -4); ctx.lineTo(10, -4); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; ctx.stroke(); ctx.restore();
      }
      if (inBox && phase === "play" && Math.abs(v) >= 0.3) pill("Stop Here!", CW / 2, MH - 30, 13, "#2f5a1f", "rgba(255,255,255,0.97)", 16, 32);
    }
    // "Hi Pat!" from a kid he stopped for
    if (hiT > 0 && kids.length) { const kd = kids[hiKid], bx = sx(kd.x), by = sy(kd.y) - 30, a = Math.min(1, hiT * 3); ctx.save(); ctx.globalAlpha = a; pill("Hi Pat!", bx, by, 13, "#2b3441", "#ffffff", 12, 26); ctx.restore(); }
    // minimap
    if (mode !== "attract" && phase !== "scene" && phase !== "over") {
      if (mmDirty && frame % 4 === 0) { mmc.putImageData(mmImg, 0, 0); mmDirty = false; }
      const mw = Math.min(104, CW * 0.28), mh = (mw * w.H) / w.W, mx = CW - mw - 9, my = 9, ms = mw / w.W;
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
    if (toast.t > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, toast.t * 2, (3 - toast.t) * 5); ctx.font = `800 13px ${FONT}`; const tw = ctx.measureText(toast.text).width + 28; ctx.translate(52 + tw / 2, 26); const pop = Math.max(1, 1.12 - (3 - toast.t) * 0.6); ctx.scale(pop, pop); ctx.translate(-(52 + tw / 2), -26); pill(toast.text, 52 + tw / 2, 26, 13, "#3d4654", "rgba(255,255,255,0.96)"); ctx.restore(); }
    if (phase === "ready" && mode !== "attract" && cfg.showStrip) { const b = 1 + 0.035 * Math.sin(time * 4); ctx.save(); ctx.translate(CW / 2, MH - 30); ctx.scale(b, b); pill("Push The Stick To Start", 0, 0, 13, "#2f5a1f", "rgba(255,255,255,0.97)", 16, 32); ctx.restore(); }
    if (stopT > 0 && phase === "play" && mode !== "attract") pill(hiT > 0 ? "Pat Waits For The Kids" : "Pat Stopped For The Cat", CW / 2, MH - 30, 13, "#b03a2e", "rgba(255,255,255,0.95)", 16, 32);
    if (phase === "scene" && banner.text) {
      const t = banner.t, s = t < 0.35 ? 0.5 + (t / 0.35) * 0.62 : 1.12 - Math.min(0.12, (t - 0.35) * 0.6);
      ctx.save(); ctx.translate(CW / 2, Math.max(44, MH * 0.1)); ctx.scale(s, s); ctx.globalAlpha = Math.min(1, t * 4);
      pill(banner.text, 0, 0, 22, success ? "#2f6d1c" : "#a3352a", "rgba(255,255,255,0.97)", 22, 50); ctx.restore();
    }
    ctx.restore();
    // the joystick strip: the base sits where the thumb lands, the knob shows the push and points the way; let go and
    // it springs back home
    if (cfg.showStrip) {
      ctx.fillStyle = "rgba(255,255,255,0.42)"; rr(ctx, 0, MH + 8, CW, CH - MH - 8, 18); ctx.fill();
      const rest = stickRest(); let bx = rest.x, by = rest.y, kx = 0, ky = 0;
      if (stick) { bx = stick.bx; by = stick.by; kx = stick.kx; ky = stick.ky; }
      else if (released) {
        const u = clamp((time - released.t) / 0.28, 0, 1), e = 1 - Math.pow(1 - u, 3), spring = (1 - e) * Math.cos(u * Math.PI * 0.9);
        bx = released.bx + (rest.x - released.bx) * e; by = released.by + (rest.y - released.by) * e; kx = released.kx * spring; ky = released.ky * spring;
        if (u >= 1) released = null;
      }
      const kd = Math.hypot(kx, ky), on = kd > STICK_R * DEAD;
      ctx.save(); ctx.fillStyle = "rgba(255,255,255,0.78)"; ctx.shadowColor = "rgba(0,0,0,0.1)"; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(bx, by, STICK_R, 0, 7); ctx.fill(); ctx.restore();
      ctx.strokeStyle = "rgba(61,122,38,0.32)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, STICK_R, 0, 7); ctx.stroke();   // the push range
      if (on) { ctx.strokeStyle = "rgba(61,122,38,0.55)"; ctx.lineWidth = 4; ctx.lineCap = "round"; const an = Math.atan2(ky, kx), sp = 0.55 * Math.min(1, kd / STICK_R) + 0.15; ctx.beginPath(); ctx.arc(bx, by, STICK_R - 1, an - sp, an + sp); ctx.stroke(); }   // how hard it's pushed, on the rim
      ctx.strokeStyle = "rgba(61,122,38,0.16)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(bx, by, STICK_R * DEAD, 0, 7); ctx.stroke();
      const KR = KNOB_R, qx = bx + kx, qy = by + ky;
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.28)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
      const g = ctx.createRadialGradient(qx - KR * 0.35, qy - KR * 0.4, KR * 0.1, qx, qy, KR); g.addColorStop(0, paint.hood); g.addColorStop(1, stick ? paint.trim : paint.body);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(qx, qy, KR, 0, 7); ctx.fill(); ctx.restore();
      ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(qx, qy, KR, 0, 7); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.32)"; ctx.beginPath(); ctx.ellipse(qx - KR * 0.25, qy - KR * 0.35, KR * 0.45, KR * 0.28, -0.4, 0, 7); ctx.fill();
      if (on) { const an = Math.atan2(ky, kx); ctx.save(); ctx.translate(qx, qy); ctx.rotate(an); ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.beginPath(); ctx.moveTo(KR * 0.62, 0); ctx.lineTo(KR * 0.08, -KR * 0.36); ctx.lineTo(KR * 0.2, 0); ctx.lineTo(KR * 0.08, KR * 0.36); ctx.closePath(); ctx.fill(); ctx.restore(); }   // the wedge points the way
      if (!stick && !released) { ctx.fillStyle = "rgba(255,255,255,0.95)"; for (let q = 0; q < 4; q++) { const an = (q * Math.PI) / 2; ctx.beginPath(); ctx.moveTo(rest.x + Math.cos(an) * STICK_R * 0.86, rest.y + Math.sin(an) * STICK_R * 0.86); ctx.lineTo(rest.x + Math.cos(an + 0.22) * STICK_R * 0.7, rest.y + Math.sin(an + 0.22) * STICK_R * 0.7); ctx.lineTo(rest.x + Math.cos(an - 0.22) * STICK_R * 0.7, rest.y + Math.sin(an - 0.22) * STICK_R * 0.7); ctx.fill(); } }
      if (!stick) text("Push Where You Want To Go", rest.x, CH - 9, 11, "#5a6b4f", 700);
      else if (lock !== null) { ctx.save(); ctx.font = `800 11px ${FONT}`; const tw = ctx.measureText("Straight Assist").width + 26, lx = (stick.bx > CW / 2 ? 12 : CW - 12 - tw), ly = MH + 18; ctx.fillStyle = "rgba(61,122,38,0.14)"; rr(ctx, lx, ly, tw, 20, 10); ctx.fill(); ctx.strokeStyle = "#3d7a26"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(lx + 8, ly + 14); ctx.lineTo(lx + 8, ly + 6); ctx.moveTo(lx + 5.5, ly + 8.5); ctx.lineTo(lx + 8, ly + 6); ctx.lineTo(lx + 10.5, ly + 8.5); ctx.stroke(); ctx.restore(); text("Straight Assist", lx + 16, ly + 10.5, 11, "#3d7a26", 800, "left"); }   // (in the corner away from the thumb)
    }
  }

  // ── loop ──
  let raf = 0, last = performance.now(), acc = 0, hudAt = 0, bladeUncut = 0, wasQuiet = false;
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
    // the engine: revs follow the speed and the stick; the blades work harder in long grass; a bump or a hard turn dips it
    {
      const onLawn = w.lawn[w.cellOf(x, y)] === 1, stickMag = Math.min(1, Math.hypot(lastIn[0], lastIn[1]));
      bladeUncut += ((lastFresh > 0 ? 1 : 0) - bladeUncut) * Math.min(1, dt * 6);
      const rpm = clamp(0.12 * (stickMag > DEAD ? stickMag : 0) + 0.88 * (Math.abs(v) / vmax), 0, 1);
      snd.engine({ on: mode !== "attract" && (phase === "ready" || phase === "play"), rpm, blades: park ? 0 : onLawn ? 0.4 + 0.6 * bladeUncut : 0.15, load: Math.min(1, shake * 4 + Math.max(0, Math.abs(om) - 1.2) * 0.4) });
      const quiet = paused || document.hidden; if (quiet !== wasQuiet) { wasQuiet = quiet; snd.setPaused(quiet); }
    }
    snd.rainLevel(paused ? 0 : rainAmt);
    if (now - hudAt > 100 && mode !== "attract") {
      hudAt = now;
      let meter: Meter | null = null;
      if (job.twist === "guests") meter = { label: "Pits & Path", value: `${Math.round((priorityTotal ? priorityCut / priorityTotal : 1) * 100)}%`, frac: priorityTotal ? priorityCut / priorityTotal : 1, good: priorityCut >= priorityTotal * 0.995 };
      else if (job.twist === "apples") meter = { label: "Apples", value: `${applesGot()} / ${apples.length}`, frac: apples.length ? applesGot() / apples.length : 0, good: applesGot() >= 10 };
      else if (job.twist === "stripes") meter = { label: "Stripe Score", value: `${Math.round(stripeScore() * 100)}%`, frac: stripeScore(), good: stripeScore() >= 0.75 };
      else if (job.twist === "storm") meter = { label: "Puddle Time", value: `${wetT.toFixed(1)}s`, frac: clamp(wetT / 4, 0, 1), good: wetT < 4 };
      else if (job.twist === "cat" || job.twist === "finale") meter = { label: "Cat Stops", value: String(meows), frac: 0, good: meows === 0 };
      else if (job.twist === "bonfire" || park) meter = { label: park ? "Bumps" : "Big Bumps", value: String(bumps), frac: 0, good: bumps === 0 };
      else if (away) { const q = stripeScore(); meter = { label: "Stripes", value: `${Math.round(q * 100)}%`, frac: q, good: q >= (job.stripeGoal ?? 0.6) }; }
      let lead: Hud["lead"] = null;
      if (parkSpot) { const d = Math.hypot(parkSpot.x - x, parkSpot.y - y); lead = { label: "To The Box", value: (phase === "scene" || phase === "over") && success ? "Parked" : inBox ? "Stop!" : `${d < 10 ? d.toFixed(1) : Math.round(d)} m` }; }
      hooks.onHud({ pct: (phase === "scene" || phase === "over") && success ? 1 : pct(), time: simT + penalty, limit, par, meter, canFinish: !park && phase === "play" && pct() >= NEAR_DONE, phase, lead });
    }
  };
  raf = requestAnimationFrame(loop);

  if (cfg.debug) {
    (window as unknown as { __lm: unknown }).__lm = {
      state: () => ({ mode, job: job.id, phase, stickIn: lastIn, blockedT, toLen: toPath.length, goal, goalK, pct: pct(), cut: cutCount, need: needCount, areaM2, limit, par, x, y, h, v, om, uturn, revT, stopT, meows, bumps, simT, penalty, drove, wetT,
        apples: applesGot(), applesLeft: apples.filter(a => a.st === 0).length, priority: priorityTotal ? priorityCut / priorityTotal : null, quality: stripeScore(), straight: freshAll ? freshStraight / freshAll : 1, trimmedN, eff: clamp(areaM2 * pct() / Math.max(1, drove * deckHalf * 2) / 0.8, 0, 1),
        cat: { st: cat.st, x: cat.x, y: cat.y, act: cat.act, next: cat.next }, size: [CW, CH, MH], zoom: zoomK, lock, thAsk, stickBase: stick ? [stick.bx, stick.by] : null, elev, inBox, parkT, waits, box: parkSpot, rig, kids: kids.map(kd => [kd.x, kd.y]), scrollH: document.documentElement.scrollHeight, PX, deckHalf, vmax }),
      hold: (hx: number, hy: number) => { testIn = [hx, hy]; },
      release: () => { testIn = null; },
      auto: (on: boolean) => { auto = on; },
      speed: (sk: number) => { speedK = sk; },
      catNow: () => { if (cat.st === "in") cat.next = 0.01; },
      catOff: () => { cat.st = "in"; cat.next = 1e9; },
      setCat: (cx: number, cy: number, act: string, hd: number) => { cat.st = "out"; cat.x = cx; cat.y = cy; cat.act = act as Cat["act"]; cat.actT = 60; cat.outT = 60; cat.h = hd; cat.cool = 10; },
      catAt: (cx: number, cy: number) => { cat.st = "out"; cat.x = cx; cat.y = cy; cat.act = "sit"; cat.actT = 5; cat.outT = 20; cat.cool = 0; },
      tp: (tx: number, ty: number, th?: number) => { const q = pushOut(w, tx, ty, BODY_R, null); x = q.x; y = q.y; if (th !== undefined) h = th; v = 0; om = 0; camX = x; camY = y; },
      toMap: (px: number, py: number) => [(px - raw.origin[0]) * raw.unit, (py - raw.origin[1]) * raw.unit],
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
    hooks.finishRef.current = null; if (hooks.zoomRef) hooks.zoomRef.current = null; snd.stop();
  };
}
