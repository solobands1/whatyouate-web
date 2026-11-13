"use client";

// Food Fling: a slingshot game. Pull back from anywhere in the lower left (relative drag, so your finger never covers
// the shot), watch the dotted aim line, let go to fling fruit at little towers of junk food on shelves. Knock every
// junk food off its shelf with 3 fruits to clear the level; run out of fruit with junk still standing and the run ends.
// Points: each junk food knocked down in the same fling is worth more than the last (100, 200, 300...), plus a little
// for how far it flew, plus a clear bonus and 500 for every fruit left over, so careful shots spread scores widely.
// "Today" is the same 10 levels for everyone (seeded), Free Play is random levels that keep getting harder.
// Physics runs on a fixed 60 Hz step and only while a fruit is in flight, so how long you take to aim never changes
// the level, and a seeded level plays out the same on every device as far as floating point allows.
// The block between SIM BEGIN and SIM END is pure (no React, no DOM): the balance check runs that exact code in Node.
// No facts mid-game and no strip under the board; one fact on the game-over card, about a junk food from your run.
// Everything around the board comes from ./kit.
import { useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import { type Mode, type Toast, GameScreen, GameHeader, BoardArea, PrizeLogo, GameOver, HelpModal, ModesHelp, ShellPopups,
  useGameShell, fitCanvas, loadImages, dailySeed, dailyNumber, torontoDate, mulberry32, readBest, saveBest, foodPng, HUD_ROW, HudStat, HudTag, OverlayCard, UI, drawHintPill } from "./kit";
import { useDuel } from "./duels";
import { loadGameFont } from "./gameFont";
import { PlayIcon } from "./icons";
import { drawPark, drawParkLight, drawShelves, dropLevel, drawPieceShadow, drawPiece, drawGroundShadow, drawSlingBack, drawSlingFront, drawBand, drawPouch, drawFruit, drawPoof, haloText } from "./art/foodFling";

const GAME = "food-fling";
const LAUNCH = "2026-11-08";   // Today's Challenge #1

// ── SIM BEGIN ──────────────────────────────────────────────────────────────
const W = 400, H = 600, FLOOR = 556, STEP = 1000 / 60;
const SLING = { x: 82, y: 436 };              // where the fruit sits before you pull
const MAX_PULL = 80, MIN_PULL = 14, VMAX = 16; // pull length in board units; launch speed in units per step
const THROWS = 3, DAILY_LEVELS = 10;
const J = 32, C = 34, PT = 10;                 // junk tile, crate, plank thickness

type FruitDef = { name: string; code: string; r: number; density: number };
const FRUITS: FruitDef[] = [
  { name: "Apple", code: "1f34e", r: 16, density: 0.006 },
  { name: "Orange", code: "1f34a", r: 15, density: 0.005 },
  { name: "Watermelon", code: "1f349", r: 22, density: 0.007 },   // bigger and heavier: hits hardest
];
type JunkDef = { name: string; plural: string; code: string; facts: string[] };
const JUNK: JunkDef[] = [
  { name: "Soda", plural: "sodas", code: "1f964", facts: [
    "A 355 ml can of regular cola has about 39 grams of sugar. That's close to 10 teaspoons.",
    "One can of regular cola is most of the 50 grams of added sugar the WHO suggests as a daily limit.",
    "Sparkling water with a squeeze of lime gives you the fizz with none of the sugar."] },
  { name: "Donut", plural: "donuts", code: "1f369", facts: [
    "A glazed donut has about 10 to 15 grams of sugar.",
    "A glazed donut is mostly refined flour and sugar. Both digest fast, so the energy doesn't last."] },
  { name: "Candy", plural: "candies", code: "1f36c", facts: [
    "A piece of hard candy is almost pure sugar, close to a teaspoon in each one.",
    "Sucking on hard candy keeps sugar on your teeth for a long time, which is hard on them."] },
  { name: "Fries", plural: "fries", code: "1f35f", facts: [
    "A medium order of fast-food fries has around 300 calories or more.",
    "Oven-baked potato wedges use far less oil than deep-fried fries."] },
  { name: "Chocolate", plural: "chocolate bars", code: "1f36b", facts: [
    "A regular milk chocolate bar has about 24 grams of sugar.",
    "Dark chocolate with 70% cocoa or more has a lot less sugar than milk chocolate."] },
  { name: "Cookie", plural: "cookies", code: "1f36a", facts: [
    "A big bakery cookie can have 20 grams of sugar or more, about half a can of soda.",
    "Most store-bought cookies are refined flour, sugar and butter: quick energy with little to hold it."] },
  { name: "Cupcake", plural: "cupcakes", code: "1f9c1", facts: [
    "A frosted cupcake often has 20 grams of sugar or more, and a lot of it is in the frosting.",
    "Refined flour and sugar together digest fast. That's why sweets give a quick lift, then a slump."] },
  { name: "Lollipop", plural: "lollipops", code: "1f36d", facts: [
    "A small lollipop is almost all sugar, often around 10 grams.",
    "Hard candy and lollipops sit in your mouth a long time, so the sugar stays on your teeth longer."] },
];

type Kind = "junk" | "crate" | "plank" | "fruit";
type Part = { kind: Kind; x: number; y: number; w: number; h: number; type: number; shelf: number };   // shelf: top y of the shelf it stands on
type Shelf = { x: number; w: number; top: number; ledge: boolean };                                     // static; x is the centre
type Plan = { shelves: Shelf[]; parts: Part[]; fruits: number[] };
type Piece = Part & { body: Matter.Body; x0: number; y0: number };
type World = { engine: Matter.Engine; pieces: Map<number, Piece>; shelves: Shelf[]; fruits: number[]; fruit: Piece | null; steps: number; calm: number; clearAt: number };
type Knock = { piece: Piece; dist: number };

/** One level's layout. Harder levels add shelves, crates that shield the junk, tables, a high ledge, and more junk. */
function planLevel(rnd: () => number, n: number): Plan {
  // difficulty climbs about two steps every three levels (level 4 plays like the old level 3, level 10 like the old 7);
  // the straight one-step-a-level ramp got too hard by level 4. Crate walls and the tallest stacks wait for step 6
  // (Today's level 8 on), since level 7 was still a little too hard with them
  const t = Math.min(12, Math.ceil(n * 0.65));
  const rf = (a: number, b: number) => a + rnd() * (b - a);
  const ri = (a: number, b: number) => Math.min(b, Math.floor(rf(a, b + 1)));
  const shelves: Shelf[] = [], parts: Part[] = [];
  let shelf = 0;   // shelf top for the parts being placed
  const junk = (x: number, y: number) => { parts.push({ kind: "junk", x, y: y - J / 2, w: J, h: J, type: ri(0, JUNK.length - 1), shelf }); return y - J; };
  const crate = (x: number, y: number) => { parts.push({ kind: "crate", x, y: y - C / 2, w: C, h: C, type: 0, shelf }); return y - C; };
  const plank = (x: number, y: number, len: number) => { parts.push({ kind: "plank", x, y: y - PT / 2, w: len, h: PT, type: 0, shelf }); return y - PT; };
  const post = (x: number, y: number, h: number) => { parts.push({ kind: "plank", x, y: y - h / 2, w: PT, h, type: 1, shelf }); return y - h; };
  const rowW = (k: number) => k * J + (k - 1) * 6;
  const row = (cx: number, y: number, k: number) => { for (let i = 0; i < k; i++) junk(cx + (i - (k - 1) / 2) * (J + 6), y); };

  // each build knows its width up front, so the shelf under it can fit it snugly
  type Build = { w: number; place: (cx: number, y: number) => void };
  const builds: Record<string, (maxW: number) => Build> = {
    row: (maxW) => { const k = Math.min(t <= 1 ? 2 : ri(2, 3), Math.floor((maxW + 6) / (J + 6))); return { w: rowW(k), place: (cx, y) => row(cx, y, k) }; },
    stack: (maxW) => {
      const side = maxW >= C + J + 6 && (t <= 3 || rnd() < 0.6), tall = t >= 4 ? ri(0, t >= 6 ? 2 : 1) : 0;   // 0: crate, 1: two crates, 2: crate, junk, crate
      const w = side ? C + J + 6 : C;
      return { w, place: (cx, y) => {
        const sx = cx - w / 2 + C / 2;
        let top = crate(sx, y);
        if (tall === 1) top = crate(sx, top); else if (tall === 2) { top = junk(sx, top); top = crate(sx, top); }
        junk(sx, top);
        if (side) junk(cx + w / 2 - J / 2, y);
      } };
    },
    table: (maxW) => {
      const s = Math.min(maxW - 14, rf(70, 100)), ph = 44, onTop = s + 8 >= rowW(2) ? 2 : 1;
      return { w: s + 14, place: (cx, y) => {
        post(cx - s / 2 + PT / 2, y, ph); post(cx + s / 2 - PT / 2, y, ph);
        row(cx, plank(cx, y - ph, s + 14), onTop);
      } };
    },
    wall: (maxW) => {
      const k = Math.min(ri(1, 2), Math.floor((maxW - C - 6 + 6) / (J + 6))), high = rnd() < 0.6, cap = rnd() < 0.5, w = C + 6 + rowW(Math.max(1, k));
      return { w, place: (cx, y) => {
        const wx = cx - w / 2 + C / 2;
        let top = crate(wx, y); if (high) top = crate(wx, top);
        if (cap) junk(wx, top);
        row(cx + w / 2 - rowW(Math.max(1, k)) / 2, y, Math.max(1, k));
      } };
    },
    pyramid: () => ({ w: 3 * C + 2, place: (cx, y) => {
      for (const dx of [-C - 1, 0, C + 1]) crate(cx + dx, y);
      row(cx, plank(cx, y - C, 3 * C + 10), 2);
    } }),
  };
  const pickBuild = (maxW: number) => {
    const opts: [string, number][] = t <= 1 ? [["row", 1]] : t === 2 ? [["row", 1], ["stack", 1]] : t === 3 ? [["stack", 1], ["table", 1.4]]
      : [["row", 0.6], ["stack", 1], ["table", maxW >= 84 ? 1.2 : 0], ["wall", t >= 6 && maxW >= C + J + 6 ? 1.2 : 0], ["pyramid", t >= 6 && maxW >= 3 * C + 2 ? 1.2 : 0]];
    const sum = opts.reduce((a, o) => a + o[1], 0); let r = rnd() * sum;
    for (const [k, wt] of opts) { r -= wt; if (r < 0) return builds[k](maxW); }
    return builds.row(maxW);
  };
  // from level 3, sometimes one more junk food stands beside the build
  const pickPlus = (maxW: number): Build => {
    if (t < 3 || maxW < C + J + 6 || rnd() >= 0.5) return pickBuild(maxW);
    const b = pickBuild(maxW - J - 6), w = b.w + J + 6;
    return { w, place: (cx, y) => { b.place(cx - w / 2 + b.w / 2, y); junk(cx + w / 2 - J / 2, y); } };
  };
  const pedestal = (b: Build, x: number, w: number, top: number) => { shelves.push({ x, w, top, ledge: false }); shelf = top; b.place(x, top); };
  const height = () => rf(60, Math.min(240, 70 + 18 * t));
  const LEFT = 150, RIGHT = 394;   // the tower area

  const ledge = t >= 6 && rnd() < 0.35, two = !ledge && t >= 4 && rnd() < Math.min(0.8, 0.3 + 0.07 * t);
  if (ledge) {
    const b = pickPlus(110), w = b.w + rf(8, 16), x = rf(LEFT + w / 2 + 30, 300 - w / 2);
    pedestal(b, x, w, FLOOR - rf(60, 160));
    const lt = rf(270, 330);
    shelves.push({ x: W - 40, w: 80, top: lt, ledge: true }); shelf = lt;
    if (rnd() < 0.5) row(W - 44, lt, 2); else junk(W - 44, crate(W - 44, lt));
  } else if (two) {
    // a gap wide enough for junk to fall into, so nothing gets wedged against the next shelf
    const b1 = pickPlus(86), b2 = pickPlus(86), w1 = b1.w + rf(8, 14), w2 = b2.w + rf(8, 14), gap = 44;
    const x1 = rf(LEFT + w1 / 2, Math.min(LEFT + w1 / 2 + 30, RIGHT - w2 - gap - w1 / 2));
    const lo = x1 + (w1 + w2) / 2 + gap, x2 = rf(lo, Math.max(lo, RIGHT - w2 / 2));
    pedestal(b1, x1, w1, FLOOR - height()); pedestal(b2, x2, w2, FLOOR - height());
  } else {
    const b = pickPlus(124), w = b.w + rf(8, 18), x = rf(Math.max(240, LEFT + w / 2), RIGHT - w / 2);
    pedestal(b, x, w, FLOOR - height());
  }
  const bag = [0, 0, 0, 1, 1, 1, 2, 2];
  const fruits = Array.from({ length: THROWS }, () => bag[ri(0, bag.length - 1)]);
  return { shelves, parts, fruits };
}

function buildWorld(M: typeof Matter, plan: Plan): World {
  const engine = M.Engine.create({ gravity: { x: 0, y: 1 }, enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
  const add = (b: Matter.Body) => M.Composite.add(engine.world, b);
  add(M.Bodies.rectangle(W / 2, FLOOR + 40, W + 1400, 80, { isStatic: true, friction: 0.9 }));
  for (const s of plan.shelves) {
    const h = s.ledge ? 14 : FLOOR - s.top;
    add(M.Bodies.rectangle(s.x, s.top + h / 2, s.w, h, { isStatic: true, friction: 0.9 }));
  }
  const pieces = new Map<number, Piece>();
  for (const p of plan.parts) {
    const b = M.Bodies.rectangle(p.x, p.y, p.w, p.h, { friction: p.kind === "junk" ? 0.4 : 0.6, frictionStatic: p.kind === "junk" ? 0.5 : 0.8, restitution: 0.05, density: p.kind === "junk" ? 0.0009 : 0.0014, chamfer: { radius: p.kind === "plank" ? 2 : 4 } });
    pieces.set(b.id, { ...p, body: b, x0: p.x, y0: p.y }); add(b);
  }
  return { engine, pieces, shelves: plan.shelves, fruits: [...plan.fruits], fruit: null, steps: 0, calm: 0, clearAt: -1 };
}

/** Lets a new level settle; it only counts if nothing moved and everything went to sleep. */
function settle(M: typeof Matter, w: World) {
  for (let i = 0; i < 200; i++) M.Engine.update(w.engine, STEP);
  for (const p of w.pieces.values()) {
    const b = p.body;
    if (!b.isSleeping || Math.hypot(b.position.x - p.x0, b.position.y - p.y0) > 4 || Math.abs(b.angle) > 0.08) return false;
  }
  for (const p of w.pieces.values()) { p.x0 = p.body.position.x; p.y0 = p.body.position.y; }
  return true;
}

/** Level n of a run: its own seed, so it never depends on how earlier levels went. */
function makeLevel(M: typeof Matter, seed: number, n: number): World {
  const rnd = mulberry32((seed + Math.imul(n, 0x9e3779b1)) | 0);
  for (let i = 0; i < 16; i++) {
    const w = buildWorld(M, planLevel(rnd, i < 10 ? n : Math.max(1, n - 3)));
    if (settle(M, w)) return w;
    M.Engine.clear(w.engine);
  }
  const w = buildWorld(M, planLevel(rnd, 1)); settle(M, w); return w;
}

const junkLeft = (w: World) => { let k = 0; for (const p of w.pieces.values()) if (p.kind === "junk") k++; return k; };
function clampPull(px: number, py: number) { const l = Math.hypot(px, py); return l > MAX_PULL ? { x: (px / l) * MAX_PULL, y: (py / l) * MAX_PULL } : { x: px, y: py }; }
function launchVelocity(px: number, py: number) { const p = clampPull(px, py); return { x: (-p.x / MAX_PULL) * VMAX, y: (-p.y / MAX_PULL) * VMAX }; }

/** Fling the next fruit. (px, py) is how far the pouch is pulled from rest; the fruit flies the opposite way. */
function throwFruit(M: typeof Matter, w: World, px: number, py: number) {
  if (!w.fruits.length || w.fruit || Math.hypot(px, py) < MIN_PULL) return false;
  const p = clampPull(px, py), v = launchVelocity(px, py), f = FRUITS[w.fruits.shift()!];
  const b = M.Bodies.circle(SLING.x + p.x, SLING.y + p.y, f.r, { density: f.density, friction: 0.4, frictionAir: 0.003, restitution: 0.3 });
  M.Composite.add(w.engine.world, b); M.Body.setVelocity(b, v);
  const piece: Piece = { kind: "fruit", x: b.position.x, y: b.position.y, w: f.r * 2, h: f.r * 2, type: FRUITS.indexOf(f), shelf: 0, body: b, x0: b.position.x, y0: b.position.y };
  w.pieces.set(b.id, piece); w.fruit = piece; w.steps = 0; w.calm = 0;
  return true;
}

/** One fixed physics step. Junk counts as knocked once its top is below the top of the shelf it started on. */
function stepWorld(M: typeof Matter, w: World) {
  M.Engine.update(w.engine, STEP); w.steps++;
  const knocked: Knock[] = [];
  for (const p of [...w.pieces.values()]) {
    const b = p.body, out = b.position.x < -60 || b.position.x > W + 60 || b.position.y > H + 60;
    if (p.kind === "junk" && (out || b.bounds.min.y > p.shelf + 2)) knocked.push({ piece: p, dist: Math.hypot(b.position.x - p.x0, b.position.y - p.y0) });
    else if (!out) continue;
    M.Composite.remove(w.engine.world, b); w.pieces.delete(b.id);
    if (p === w.fruit) w.fruit = null;
  }
  let calm = true;
  for (const b of w.engine.world.bodies) if (!b.isStatic && !b.isSleeping && (Math.hypot(b.velocity.x, b.velocity.y) > 0.15 || Math.abs(b.angularVelocity) > 0.008)) { calm = false; break; }
  w.calm = calm ? w.calm + 1 : 0;
  const left = junkLeft(w);
  if (left === 0 && w.clearAt < 0) w.clearAt = w.steps;
  const done = left === 0 ? w.steps - w.clearAt >= 45 : (w.steps >= 40 && w.calm >= 20) || w.steps >= 540;
  if (done && w.fruit) { M.Composite.remove(w.engine.world, w.fruit.body); w.pieces.delete(w.fruit.body.id); w.fruit = null; }
  return { knocked, done };
}
// ── SIM END ────────────────────────────────────────────────────────────────

const GRIP = { x: 8, y: 300, w: 196, h: 248 };    // where the "drag back here" hint sits (any drag on the left half works)
const DRAG_GAIN = 1.25;
const knockPoints = (k: number, dist: number) => 100 * k + Math.min(100, Math.round(dist / 3));
const clearBonus = (n: number, spare: number) => 250 + 50 * Math.min(n, 20) + 500 * spare;
const DAY_BONUS = 1000;
const POOF_MS = 620;   // how long a knocked-off puff of dust hangs in the air
// share squares: cleared with 1, 2 or 3 fruits, or not cleared
const SQUARE = ["", "🟩", "🟨", "🟧"];

type Result = { kind: "done" | "fail"; level: number; left: number; squares: string };
type Hud = { score: number; level: number; left: number };
type Clear = { level: number; points: number; spare: number };

export default function FoodFling() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("daily");
  const [run, setRun] = useState(0);                 // bump to restart
  const [hud, setHud] = useState<Hud>({ score: 0, level: 1, left: 0 });
  const [best, setBest] = useState(0);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [clear, setClear] = useState<Clear | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [board, setBoard] = useState({ w: 0, h: 0 });
  const shell = useGameShell(GAME, mode);
  const duel = useDuel(shell, GAME, "Food Fling", mode, () => { if (mode !== "daily") { setMode("daily"); setRun(r => r + 1); } });   // Friend Duels
  const { reset: resetScores } = shell.scores;
  const pausedRef = useRef(false); pausedRef.current = shell.paused;   // popups pause the game
  const nextRef = useRef<() => void>(() => {});
  const bestKey = mode === "daily" ? `foodfling-daily-${torontoDate()}` : "foodfling-endless";
  useEffect(() => { setBest(readBest(bestKey)); }, [bestKey]);
  useEffect(() => { void loadGameFont(); }, []);   // the display face for the first-throw hint on the canvas

  useEffect(() => {
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const { ctx, stop } = fitCanvas(canvas, wrap, W, H, setBoard, 0);   // no fact strip: the board gets the room
    const fruitImg = loadImages(FRUITS.map(f => f.code)), junkImg = loadImages(JUNK.map(j => j.code));
    const seed = mode === "daily" ? dailySeed(0xf11a6) : Math.floor(Math.random() * 1e9);

    let level = 1, w = makeLevel(Matter, seed, level);
    let phase: "aim" | "fly" | "clear" | "over" = "aim";
    let total = 0, levelPoints = 0, combo = 0, drops = 0, realStart = 0, acc = 0, last = performance.now(), raf = 0, bannerAge = 0;
    let drag: { sx: number; sy: number; px: number; py: number; id: number } | null = null;
    const squares: string[] = [];
    const knockedBy = new Map<number, number>();     // junk type -> times knocked, for the end-of-run fact
    const floats: { x: number; y: number; text: string; color: string; age: number; big?: boolean }[] = [];
    const poofs: { x: number; y: number; age: number; seed: number }[] = [];
    let lvKey = `${seed}:${level}`;   // which level's shelves are painted
    const pushHud = () => setHud({ score: total, level, left: junkLeft(w) });
    setOver(false); setResult(null); setClear(null); setToast(null); resetScores(); pushHud();

    const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
    const pick = (j: JunkDef) => j.facts[Math.floor(Math.random() * j.facts.length)];

    const finish = (kind: Result["kind"]) => {
      phase = "over";
      if (kind === "done") { total += DAY_BONUS; floats.push({ x: W / 2, y: 200, text: `Day complete! +${DAY_BONUS}`, color: "#2eaa6e", age: 0, big: true }); }
      // one fact, after the run, about a junk food from it
      const standing = [...w.pieces.values()].find(p => p.kind === "junk");
      const top = [...knockedBy.entries()].sort((a, b) => b[1] - a[1])[0];
      if (kind === "fail" && standing) { const j = JUNK[standing.type]; setToast({ title: `Still standing: ${j.name}`, body: pick(j), img: j.code }); }
      else if (top) { const j = JUNK[top[0]]; setToast({ title: `You knocked down ${top[1]} ${top[1] === 1 ? j.name.toLowerCase() : j.plural}`, body: pick(j), img: j.code }); }
      const all = mode === "daily" ? [...squares, ...Array(Math.max(0, DAILY_LEVELS - squares.length)).fill("⬜")] : squares.slice(-20);
      setResult({ kind, level, left: junkLeft(w), squares: all.join("") });
      pushHud(); setOver(true);
      if (total > readBest(bestKey)) { saveBest(bestKey, total); setBest(total); }
      shell.finishRef.current({ score: total, drops, ms: performance.now() - realStart });
    };

    const resolveThrow = () => {
      combo = 0;
      if (junkLeft(w) === 0) {
        const spare = w.fruits.length, bonus = clearBonus(level, spare);
        total += bonus; levelPoints += bonus; squares.push(SQUARE[THROWS - spare]); pushHud();
        if (mode === "daily" && level >= DAILY_LEVELS) finish("done");
        else { phase = "clear"; setClear({ level, points: levelPoints, spare }); }
      } else if (!w.fruits.length) { squares.push("🟥"); finish("fail"); }
      else phase = "aim";
    };

    const next = () => {
      if (phase !== "clear") return;
      Matter.Engine.clear(w.engine);
      level++; w = makeLevel(Matter, seed, level); levelPoints = 0; bannerAge = 0; floats.length = 0; poofs.length = 0;
      dropLevel(lvKey); lvKey = `${seed}:${level}`;
      phase = "aim"; setClear(null); pushHud();
    };
    nextRef.current = next;

    const tick = () => {
      const { knocked, done } = stepWorld(Matter, w);
      for (const { piece, dist } of knocked) {
        combo++; const pts = knockPoints(combo, dist); total += pts; levelPoints += pts;
        knockedBy.set(piece.type, (knockedBy.get(piece.type) ?? 0) + 1);
        const x = Math.max(24, Math.min(W - 24, piece.body.position.x)), y = Math.min(FLOOR - 20, piece.body.position.y);
        poofs.push({ x, y, age: 0, seed: (x * 131 + y * 17 + combo) | 0 });
        floats.push({ x, y: y - 14, text: combo > 1 ? `+${pts} combo x${combo}` : `+${pts}`, color: combo > 1 ? "#b54bd1" : "#2eaa6e", age: 0 });
      }
      if (knocked.length) pushHud();
      if (done) resolveThrow();
    };

    const onDown = (e: PointerEvent) => {
      if (phase !== "aim" || pausedRef.current || drag) return;
      const p = local(e);
      if (p.x > W * 0.6 || p.y < 110) return;
      drag = { sx: p.x, sy: p.y, px: 0, py: 0, id: e.pointerId };
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = local(e), c = clampPull((p.x - drag.sx) * DRAG_GAIN, (p.y - drag.sy) * DRAG_GAIN);
      drag.px = c.x; drag.py = c.y;
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      onMove(e); const d = drag; drag = null;
      if (phase !== "aim" || pausedRef.current) return;
      if (throwFruit(Matter, w, d.px, d.py)) { if (!drops) realStart = performance.now(); drops++; phase = "fly"; acc = 0; pushHud(); }
    };
    const onCancel = () => { drag = null; };
    const onKey = (e: KeyboardEvent) => { if ((e.key === "Enter" || e.key === " ") && phase === "clear" && !pausedRef.current) { e.preventDefault(); next(); } };
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);

    const loop = (t: number) => {
      const dt = Math.max(0, Math.min(100, t - last)); last = t;
      if (pausedRef.current) { drag = null; acc = 0; }
      else {
        if (phase === "fly") {
          acc += dt; let n = 0;
          while (acc >= STEP && n < 8 && phase === "fly") { acc -= STEP; n++; tick(); }
          if (n >= 8) acc = 0;                       // a very slow frame: slow the game down rather than skip physics
        }
        bannerAge += dt;
        for (let k = floats.length - 1; k >= 0; k--) { floats[k].age += dt; if (floats[k].age > (floats[k].big ? 2200 : 1000)) floats.splice(k, 1); }
        for (let k = poofs.length - 1; k >= 0; k--) { poofs[k].age += dt; if (poofs[k].age > POOF_MS) poofs.splice(k, 1); }
      }
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    const rr = (x: number, y: number, ww: number, hh: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, ww, hh, r); };
    function draw(t: number) {
      ctx.save(); ctx.clearRect(0, 0, W, H);
      rr(0, 0, W, H, 22); ctx.clip();
      drawPark(ctx, W, H, FLOOR, t);
      // shelves: wooden plinths; the dark line under each top board is the line junk has to fall below
      if (w.shelves.length) drawShelves(ctx, lvKey, w.shelves, W, H, FLOOR);

      // the sling's back half and back band, then the pieces, so fruit in flight passes in front of the tower
      const pull = drag ? { x: drag.px, y: drag.py } : { x: 0, y: 0 };
      const pouch = { x: SLING.x + pull.x, y: SLING.y + pull.y }, loaded = phase === "aim" && w.fruits.length > 0;
      const tipL = { x: SLING.x - 14, y: SLING.y - 6 }, tipR = { x: SLING.x + 14, y: SLING.y - 6 };
      const end = loaded ? pouch : { x: SLING.x, y: SLING.y + 2 }, stretch = Math.hypot(pull.x, pull.y) / MAX_PULL;
      drawSlingBack(ctx, SLING.x, SLING.y, FLOOR);
      drawBand(ctx, tipR.x, tipR.y, end.x, end.y, stretch);

      for (const p of w.pieces.values()) drawPieceShadow(ctx, p, p.body.position.x, p.body.position.y, p.body.angle);
      for (const p of w.pieces.values()) {
        const b = p.body;
        if (p.kind === "fruit") {
          drawGroundShadow(ctx, b.position.x, p.w / 2, FLOOR - b.position.y, FLOOR);
          drawFruit(ctx, fruitImg[p.type], b.position.x, b.position.y, p.w * 1.18, b.angle);
        } else {
          drawPiece(ctx, p, b.position.x, b.position.y, b.angle);
          if (p.kind === "junk") drawFruit(ctx, junkImg[p.type], b.position.x, b.position.y, p.w * 1.02, b.angle);
        }
      }

      // the fruit in the pouch, the front band and arm, and the fruit still to come
      if (loaded) {
        const f = FRUITS[w.fruits[0]], s = f.r * 2 * 1.18;
        drawPouch(ctx, pouch.x, pouch.y, f.r, Math.atan2(pull.y, pull.x || 0.0001));
        drawFruit(ctx, fruitImg[w.fruits[0]], pouch.x, pouch.y, s);
      }
      drawBand(ctx, tipL.x, tipL.y, end.x, end.y, stretch);
      drawSlingFront(ctx, SLING.x, SLING.y);
      const queue = w.fruits.slice(loaded ? 1 : 0);
      queue.forEach((fi, i) => { const s = 26, x = 44 - i * 26; drawGroundShadow(ctx, x, 11, 0, FLOOR); drawFruit(ctx, fruitImg[fi], x, FLOOR - s / 2 + 2, s); });

      // the aim: dots along the first part of the path, so you still have to judge where it lands
      if (drag && Math.hypot(drag.px, drag.py) >= MIN_PULL && loaded) {
        const f = FRUITS[w.fruits[0]], v = launchVelocity(drag.px, drag.py), g1 = 0.001 * STEP * STEP, air = 1 - 0.003;
        let x = pouch.x, y = pouch.y, vx = v.x, vy = v.y, len = 0, i = 0;
        ctx.fillStyle = "rgba(16,27,46,0.62)"; ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 1.2;
        while (len < 200 && y < FLOOR - f.r && i < 200) {
          vx *= air; vy = vy * air + g1; x += vx; y += vy; len += Math.hypot(vx, vy); i++;
          if (i % 3 === 0) { ctx.globalAlpha = Math.max(0.15, 1 - len / 220); ctx.beginPath(); ctx.arc(x, y, 3.4 - len / 110, 0, 7); ctx.fill(); ctx.stroke(); }
        }
        ctx.globalAlpha = 1;
      }
      drawParkLight(ctx, W, H);

      // first throw of a run: show where to drag
      if (phase === "aim" && !drag && drops === 0 && level === 1) {
        drawHintPill(ctx, GRIP.x + GRIP.w / 2, GRIP.y + 6, "Drag Back To Fling", t, 192);
      }

      for (const p of poofs) drawPoof(ctx, p.x, p.y, p.age / POOF_MS, p.seed);   // dust and splinters where junk was knocked off
      ctx.globalAlpha = 1; ctx.textAlign = "center";
      if (bannerAge < 1600 && phase === "aim") {
        ctx.globalAlpha = Math.min(1, (1600 - bannerAge) / 400);
        ctx.font = "800 26px system-ui, -apple-system, sans-serif"; haloText(ctx, `Level ${level}`, W / 2, 56, "#101b2e", "rgba(255,255,255,0.8)", 6);
        ctx.globalAlpha = 1;
      }
      if (phase === "aim" && w.fruits.length === 1 && !drag) {
        ctx.font = "700 13px system-ui, -apple-system, sans-serif"; haloText(ctx, "Last fruit!", SLING.x, SLING.y - 32, "#e8505b");
      }
      for (const f of floats) {
        const life = f.big ? 2200 : 1000, a = 1 - f.age / life;
        ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.6));
        ctx.font = `800 ${f.big ? 24 : 15}px system-ui, -apple-system, sans-serif`;
        haloText(ctx, f.text, Math.max(60, Math.min(W - 60, f.x)), f.y - (f.big ? 0 : f.age * 0.04), f.color);
      }
      ctx.globalAlpha = 1; ctx.restore();
    }

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); stop();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      Matter.Engine.clear(w.engine); dropLevel(lvKey);
    };
  }, [mode, run, bestKey]);

  const n = dailyNumber(LAUNCH);
  const headline = !result ? "" : result.kind === "done" ? `All ${DAILY_LEVELS} levels cleared! 🎉` : `Out of fruit on level ${result.level}`;
  const share = () => {
    if (!result) return;
    // Wordle-style: one square per level. Green took one fruit, yellow two, orange three, red didn't clear.
    const label = mode === "daily" ? `Food Fling #${n} (Today's Challenge)` : "Food Fling (Free Play)";
    const p = shell.scores.posted;
    const rank = p?.rank ? `\n🏆 #${p.rank} of ${p.total} ${mode === "daily" ? "today" : "this week"}` : "";
    const how = result.kind === "done" ? `All ${DAILY_LEVELS} levels 🎉` : mode === "daily" ? `Level ${result.level} of ${DAILY_LEVELS}` : `Reached level ${result.level}`;
    shell.share(`${label}\n${hud.score.toLocaleString()} pts · ${how}${rank}\n${result.squares}\nCan you beat it? whatyouate.app/games/food-fling`);
  };

  return (
    <GameScreen>
      <GameHeader title="Food Fling" mode={mode} onMode={m => { setMode(m); setRun(r => r + 1); }} onBoard={() => shell.setBoardOpen(true)} onHelp={shell.help.show} />

      <div className={HUD_ROW}>
        <HudStat label="Score" value={hud.score.toLocaleString()} />
        <HudTag light>Level {hud.level}{mode === "daily" ? ` Of ${DAILY_LEVELS}` : ""} · {hud.left} Junk Left</HudTag>
        <HudStat label="Best" value={best.toLocaleString()} align="right" />
      </div>

      <BoardArea wrapRef={wrapRef} size={board} reserve={0}>
        <canvas ref={canvasRef} className="block rounded-[22px] shadow-[0_14px_40px_rgba(16,42,86,0.18)]" />
        <PrizeLogo shell={shell} active={!over && !shell.paused} />
        {clear && !over && (
          <OverlayCard title={`Level ${clear.level} Cleared`} max="max-w-[270px]">
            <div className={`${UI.big} text-[46px] [text-shadow:0_4px_0_#cfdff8]`}>+{clear.points.toLocaleString()}</div>
            <div className="mt-1.5 text-sm text-[#5a6b85]">{clear.spare ? `${clear.spare} fruit to spare` : "Just made it!"}</div>
            <button onClick={() => nextRef.current()} className={`${UI.go} mt-4 h-[52px] w-full text-[21px]`}>Next Level<PlayIcon size={17} /></button>
          </OverlayCard>
        )}
        {over && <GameOver label={mode === "daily" ? `Today's Challenge #${n}` : "Free Play"} headline={headline} score={hud.score} best={best} mode={mode}
          posted={shell.scores.posted} joined={!!shell.player} campaign={GAME} copied={shell.copied} fact={toast}
          pitch="Swapping one junk snack a day adds up. WhatYouAte shows you what's worth swapping."
          onBoard={() => shell.setBoardOpen(true)} onJoin={() => shell.setJoinOpen(true)} onAgain={() => setRun(r => r + 1)} onShare={share}  extra={duel.button} />}
      </BoardArea>

      <ShellPopups shell={shell} game={GAME} todayNote="Today's Challenge: same levels for everyone. Resets at midnight." />
      {duel.popup}

      {shell.help.open && (
        <HelpModal onClose={shell.help.close} steps={[
          "Drag back anywhere on the left, then let go to fling. The dots show where it's headed.",
          "Knock every junk food off its shelf. You get 3 fruits a level, and a watermelon hits hardest.",
          "Each junk food in the same fling is worth more than the last. Fruit you don't need is bonus points.",
          "Clear a level to move on. Run out of fruit with junk still standing and the run is over.",
        ]}>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1 rounded-2xl bg-[#f0f6fe] p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {FRUITS.map(f => <img key={f.code} src={foodPng(f.code)} alt={f.name} className="h-5 w-5" />)}
            <span className="mx-1 text-xs text-[#5a6b85]">vs</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {JUNK.map(j => <img key={j.code} src={foodPng(j.code)} alt={j.name} className="h-5 w-5" />)}
          </div>
          <ModesHelp today={`everyone gets the same ${DAILY_LEVELS} levels today. Clear them all for a bonus.`} free="random levels that keep getting harder. See how far you get." />
        </HelpModal>
      )}
    </GameScreen>
  );
}
