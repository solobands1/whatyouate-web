"use client";

// Cart Rush: push a shopping cart up a 3-lane grocery aisle, seen from behind the handle. Tap or slide along the
// lane pad under the cart (or tap either side, swipe, or use the arrow keys) to switch lanes, so your finger never
// covers the cart; your hearts ride under the cart where you're looking. A recipe card lists 3 or 4 ingredients; grab them to finish the recipe and get a
// bonus that grows with each recipe, doubled when you grabbed nothing off the list. Wet floors, boxes and rolling
// cans cost one of 3 hearts; every 4th recipe gives one back. Score is distance plus ingredients plus recipe
// bonuses. No facts pop up mid-run: the game-over card shows one, about the recipe you were shopping for.
// "Today" gives everyone the same aisle (hazards and item spots are seeded) and the same recipe order, and its
// speed levels off while the aisle keeps getting busier; Free Play is random and keeps speeding up.
// The rules live in one pure block (no DOM) so the balance sim can run the exact same code.
// Everything around the board comes from ./kit.
import { useEffect, useRef, useState } from "react";
import { type Mode, type Toast, GameScreen, GameHeader, BoardArea, PrizeLogo, GameOver, PauseButton, PausedCard, HelpModal, ModesHelp, ShellPopups,
  useGameShell, fitCanvas, loadImages, dailySeed, dailyNumber, torontoDate, mulberry32, readBest, saveBest, foodPng } from "./kit";

const GAME = "cart-rush";
const LAUNCH = "2026-11-08";   // Today's Challenge #1

// ── rules (pure, no DOM: the balance sim extracts and runs this block) ─────
type Item = { name: string; facts: string[] };
const ITEMS: Record<string, Item> = {
  "1f34c": { name: "Banana", facts: ["A medium banana has about 3 grams of fibre.", "Slightly green bananas have more resistant starch, which digests slower."] },
  "1f353": { name: "Strawberries", facts: ["Gram for gram, strawberries have more vitamin C than oranges.", "Strawberries don't ripen after they're picked, so pick the reddest ones."] },
  "1f95b": { name: "Milk", facts: ["A cup of milk has about 8 grams of protein.", "Most of the protein in milk is casein, which digests slowly."] },
  "1fad8": { name: "Beans", facts: ["A cup of cooked black beans has about 15 grams of fibre.", "Rinsing canned beans washes off a lot of the extra salt."] },
  "1f951": { name: "Avocado", facts: ["Avocados only ripen after they're picked. A paper bag with a banana speeds it up.", "A squeeze of lime or lemon slows down cut avocado turning brown."] },
  "1f345": { name: "Tomato", facts: ["Cooked tomato, like pasta sauce, gives you more lycopene than raw.", "Keep tomatoes on the counter, not in the fridge. The cold dulls their flavour."] },
  "1f9c0": { name: "Cheese", facts: ["Hard cheeses like cheddar and parmesan have very little lactose.", "An ounce of cheddar has about 7 grams of protein."] },
  "1f95a": { name: "Eggs", facts: ["A large egg has about 6 grams of protein.", "Brown and white eggs are the same inside. Shell colour comes from the breed of hen."] },
  "1fad1": { name: "Pepper", facts: ["A red bell pepper has more vitamin C than an orange.", "Most red peppers are green peppers left on the plant longer to ripen."] },
  "1f35a": { name: "Rice", facts: ["Brown rice keeps its bran, so it has more fibre than white rice.", "Rice that's cooked and then cooled forms some resistant starch, which digests slower."] },
  "1f966": { name: "Broccoli", facts: ["A cup of broccoli has about as much vitamin C as an orange.", "Broccoli stems are just as good to eat. Peel them and slice them thin."] },
  "1f955": { name: "Carrot", facts: ["Cooking carrots makes their beta-carotene easier for your body to absorb.", "Carrots come in purple, yellow and white too, not just orange."] },
  "1f357": { name: "Chicken", facts: ["A palm-sized piece of chicken has about 25 grams of protein.", "Protein digests slowly, so a meal with it keeps you going longer."] },
  "1f34e": { name: "Apple", facts: ["Keep the skin on. That's where a lot of an apple's fibre is.", "Apples float because about a quarter of an apple is air."] },
  "1f95d": { name: "Kiwi", facts: ["You can eat kiwi skin. It's fuzzy, but it holds a lot of the fibre.", "Two kiwis have more vitamin C than a large orange."] },
  "1f34d": { name: "Pineapple", facts: ["Pineapple has an enzyme that breaks down protein. That's why it makes your mouth tingle.", "A pineapple is actually lots of small fruits fused together."] },
  "1fad0": { name: "Blueberries", facts: ["Frozen blueberries keep their nutrients as well as fresh ones.", "A cup of blueberries has about 4 grams of fibre."] },
  "1f96c": { name: "Greens", facts: ["Darker greens like spinach and romaine have more vitamins than pale iceberg lettuce.", "A little olive oil on your greens helps you absorb their vitamins A and K."] },
  "1f952": { name: "Cucumber", facts: ["Cucumbers are about 95% water.", "Botanically, a cucumber is a fruit, like a tomato."] },
  "1f35e": { name: "Bread", facts: ["Whole grain bread keeps the bran and germ, so it has more fibre than white bread.", "Bread goes stale faster in the fridge than on the counter. The freezer keeps it best."] },
  "1f41f": { name: "Fish", facts: ["Salmon, sardines and trout are rich in omega-3 fats.", "A palm-sized piece of fish has about 20 grams of protein."] },
  "1f954": { name: "Potato", facts: ["A medium potato with the skin on has more potassium than a banana.", "Leave the skin on a potato for extra fibre."] },
  "1f34b": { name: "Lemon", facts: ["A squeeze of lemon adds flavour without adding salt.", "Lemon juice keeps cut apples and avocado from browning so fast."] },
  "1f9c5": { name: "Onion", facts: ["Onions are in the same plant family as garlic, leeks and chives.", "Chilling an onion before you cut it can mean fewer tears."] },
  "1f33d": { name: "Corn", facts: ["Popcorn is a whole grain.", "Each strand of silk on an ear of corn leads to one kernel."] },
};
type Recipe = { name: string; dish: string; items: string[] };   // dish: the emoji used in the share text
const RECIPES: Recipe[] = [
  { name: "Smoothie", dish: "🥤", items: ["1f34c", "1f353", "1f95b"] },
  { name: "Taco Night", dish: "🌮", items: ["1fad8", "1f951", "1f345", "1f9c0"] },
  { name: "Omelette", dish: "🍳", items: ["1f95a", "1f9c0", "1fad1", "1f9c5"] },
  { name: "Stir-Fry", dish: "🥡", items: ["1f35a", "1f966", "1f955", "1f357"] },
  { name: "Fruit Salad", dish: "🍍", items: ["1f34e", "1f95d", "1f34d", "1fad0"] },
  { name: "Big Salad", dish: "🥗", items: ["1f96c", "1f952", "1f345", "1f955"] },
  { name: "Avocado Toast", dish: "🥑", items: ["1f35e", "1f951", "1f95a"] },
  { name: "French Toast", dish: "🍞", items: ["1f35e", "1f95a", "1f95b", "1f353"] },
  { name: "Fish Dinner", dish: "🐟", items: ["1f41f", "1f954", "1f34b", "1f966"] },
  { name: "Chili", dish: "🌶️", items: ["1fad8", "1f345", "1f9c5", "1f33d"] },
  { name: "Grilled Cheese", dish: "🧀", items: ["1f35e", "1f9c0", "1f345"] },
];
type Hazard = { name: string; code: string; hit: string };
const HAZARDS: Hazard[] = [
  { name: "Wet floor", code: "26a0", hit: "Slipped on a wet floor!" },
  { name: "Boxes", code: "1f4e6", hit: "Bumped into boxes!" },
  { name: "Rolling can", code: "1f96b", hit: "A can rolled into you!" },
];
const ALL_ITEMS = Object.keys(ITEMS);
const LANES = 3, HEARTS = 3;
const V0 = 230, ACCEL = 2.2, DAILY_CAP = 410;   // px/s, px/s² (speed rises steadily with time), Today's top speed
const AHEAD = 560;                              // rows are laid out this far ahead of the cart (just above the top of the board)
const HIT_HAZARD = 30, HIT_ITEM = 44;           // how close (along the aisle) counts as touching; hazards are a bit forgiving
const P_ITEM = 0.34, P_NEEDED = 0.45;           // chance a free spot holds an item; chance that item is one you still need
const LISTED = 20, EXTRA = 5;                   // points per ingredient on the list, and per extra
const TAP_SECS = 0.65;                          // rows closer than this (in time) only ever ask for a one-lane move

/** Seconds since the start at a given distance (speed rises at ACCEL from V0), ignoring Today's cap. Sets the difficulty. */
/** Levels are labels on the steady speed-up (every 20 seconds of aisle), so you can feel your progress. They don't
 *  change the speed curve, which the "always a way through" rule depends on. */
const LEVEL_SECS = 20;
const timeAt = (d: number) => (Math.sqrt(V0 * V0 + 2 * ACCEL * d) - V0) / ACCEL;
const speedAt = (d: number, daily: boolean) => { const v = Math.sqrt(V0 * V0 + 2 * ACCEL * d); return daily ? Math.min(DAILY_CAP, v) : v; };
const recipeBonus = (n: number, perfect: boolean) => 100 * Math.min(n, 10) * (perfect ? 2 : 1);

type Thing = { d: number; lane: number; code: string; hazard: number; gone: boolean; hit: boolean };   // hazard: index, or -1 for an item
type Ev =
  | { type: "grab"; code: string; listed: boolean; pts: number }
  | { type: "recipe"; recipe: Recipe; pts: number; perfect: boolean; heart: boolean }
  | { type: "hit"; hazard: Hazard; hearts: number }
  | { type: "over" };

/** One shop. `rng` is mulberry32; the aisle (hazards and item spots) comes only from the seed, so on "Today" it's the
 *  same for everyone whatever they grab. Which ingredient sits in a spot depends on your recipe, drawn the same way. */
function createRun(daily: boolean, seed: number, rng: (seed: number) => () => number, on: (e: Ev) => void) {
  const lay = rng(seed), pick = rng(seed ^ 0x9e3779b), order = rng(seed ^ 0x51ed27);
  const s = {
    d: 0, ms: 0, lane: 1, hearts: HEARTS, pts: 0, recipe: 0, got: [] as boolean[], perfect: true, grabs: 0, over: false,
    hurtUntil: -1, lastHazard: -1, lastGrab: "", done: [] as { dish: string; perfect: boolean }[], things: [] as Thing[],
  };
  let nextRow = AHEAD, reach = [true, true, true];
  const recent: number[] = [];
  const newRecipe = () => {
    let r = Math.floor(order() * RECIPES.length);
    while (recent.includes(r)) r = (r + 1) % RECIPES.length;   // no repeats among the last 4
    recent.push(r); if (recent.length > 4) recent.shift();
    s.recipe = r; s.got = RECIPES[r].items.map(() => false); s.perfect = true;
  };
  newRecipe();
  const needed = () => RECIPES[s.recipe].items.filter((_, i) => !s.got[i]);
  const itemCode = (w: number, x: number) => {
    const need = needed();
    if (need.length && w < P_NEEDED) return need[Math.floor(x * need.length)];
    const pool = ALL_ITEMS.filter(c => !RECIPES[s.recipe].items.includes(c));
    return pool[Math.floor(x * pool.length)];
  };
  const genRow = () => {
    const d = nextRow, T = timeAt(d), v = speedAt(d, daily);
    const gap = Math.max(185, 280 - T), k = gap / v >= TAP_SECS ? 2 : 1;
    const late = Math.max(0, T - 100) / 400;                     // keeps getting busier, even once Today's speed levels off
    const p1 = Math.min(0.92, 0.38 + 0.44 * Math.min(1, T / 90) + late);
    const p2 = Math.min(0.65, 0.32 * Math.max(0, Math.min(1, (T - 15) / 90)) + late);
    const r = lay(), m = lay(), a = m < 0.44 ? 1 : m < 0.72 ? 0 : 2, b = (a + 1 + Math.floor(lay() * 2)) % LANES;   // the middle lane is no hiding place
    const haz = [false, false, false]; if (r < p1) haz[a] = true; if (r < p2) haz[b] = true;
    // a way through must always exist: a free lane you can reach in time from somewhere you could have been
    const through = () => haz.map((h, l) => !h && reach.some((ok, q) => ok && Math.abs(l - q) <= k));
    let nr = through();
    if (!nr.some(Boolean)) { haz[b] = false; nr = through(); }
    if (!nr.some(Boolean)) { haz[a] = false; nr = through(); }
    reach = nr;
    const squeeze = haz.filter(Boolean).length > 1;               // one way through: keep it clear, so no one is forced to grab an extra
    for (let l = 0; l < LANES; l++) {
      const roll = lay(), kind = Math.floor(lay() * HAZARDS.length), w = pick(), x = pick();   // same draws every row
      if (haz[l]) s.things.push({ d, lane: l, code: HAZARDS[kind].code, hazard: kind, gone: false, hit: false });
      else if (!squeeze && roll < P_ITEM) s.things.push({ d, lane: l, code: itemCode(w, x), hazard: -1, gone: false, hit: false });
    }
    nextRow += gap;
  };
  const grab = (code: string) => {
    s.grabs++;
    const i = RECIPES[s.recipe].items.indexOf(code);
    if (i < 0 || s.got[i]) { s.pts += EXTRA; s.perfect = false; on({ type: "grab", code, listed: false, pts: EXTRA }); return; }
    s.got[i] = true; s.pts += LISTED; s.lastGrab = code; on({ type: "grab", code, listed: true, pts: LISTED });
    if (s.got.every(Boolean)) {
      const recipe = RECIPES[s.recipe], n = s.done.length + 1, pts = recipeBonus(n, s.perfect);
      const heart = n % 4 === 0 && s.hearts < HEARTS;
      s.pts += pts; if (heart) s.hearts++;
      s.done.push({ dish: recipe.dish, perfect: s.perfect });
      on({ type: "recipe", recipe, pts, perfect: s.perfect, heart });
      newRecipe();
    }
  };
  const update = (dt: number) => {
    if (s.over) return;
    s.ms += dt; s.d += (speedAt(s.d, daily) * dt) / 1000;
    while (nextRow < s.d + AHEAD) genRow();
    for (const t of s.things) {
      if (t.gone || t.lane !== s.lane || Math.abs(t.d - s.d) > (t.hazard >= 0 ? HIT_HAZARD : HIT_ITEM)) continue;
      t.gone = true;
      if (t.hazard < 0) { grab(t.code); continue; }
      if (s.ms < s.hurtUntil) continue;                          // a moment to recover after a bump
      t.hit = true; s.hearts--; s.hurtUntil = s.ms + 1000; s.lastHazard = t.hazard;
      on({ type: "hit", hazard: HAZARDS[t.hazard], hearts: s.hearts });
      if (s.hearts <= 0) { s.over = true; on({ type: "over" }); return; }
    }
    s.things = s.things.filter(t => t.d > s.d - 160);
  };
  const move = (dir: number) => { if (!s.over) s.lane = Math.max(0, Math.min(LANES - 1, s.lane + dir)); };
  const setLane = (l: number) => { if (!s.over) s.lane = Math.max(0, Math.min(LANES - 1, l)); };
  const score = () => Math.floor(s.d / 20) + s.pts;               // a point every 20px of aisle, plus what you grabbed
  return { s, update, move, setLane, score, needed, speed: () => speedAt(s.d, daily) };
}
// ── end rules ──────────────────────────────────────────────────────────────

const W = 400, H = 600, HUD = 78;                 // logical board; the top strip holds the recipe card and hearts
const SHELF = 32, LANE_W = (W - 2 * SHELF) / LANES;
const laneX = (l: number) => SHELF + LANE_W * (l + 0.5);
const CART_Y = H - 132, CART = 70, IR = 27;       // cart position and size, item radius
const PAD_Y = H - 52, PAD_H = 42;                 // the lane pad under the cart: tap or slide here to pick a lane
const SHELF_COLORS = ["#f6b8b0", "#ffd98a", "#b9e4c3", "#a9cdf6", "#d9c3f2", "#ffc49b", "#f2f2f2"];
const font = (w: number, px: number) => `${w} ${px}px system-ui, -apple-system, sans-serif`;

type Result = { done: { dish: string; perfect: boolean }[]; hearts: number };
type Hud = { score: number; made: number };

export default function CartRush() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("daily");
  const [run, setRun] = useState(0);                 // bump to restart
  const [started, setStarted] = useState(false);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [hud, setHud] = useState<Hud>({ score: 0, made: 0 });
  const [best, setBest] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [board, setBoard] = useState({ w: 0, h: 0 });
  const shell = useGameShell(GAME, mode);
  const { reset: resetScores } = shell.scores;
  const pausedRef = useRef(false); pausedRef.current = shell.paused;   // popups pause the shop
  const startRef = useRef<() => void>(() => {});
  const bestKey = mode === "daily" ? `cartrush-daily-${torontoDate()}` : "cartrush-endless";
  useEffect(() => { setBest(readBest(bestKey)); }, [bestKey]);

  useEffect(() => {
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const { ctx, toLocal, stop } = fitCanvas(canvas, wrap, W, H, setBoard, 0);   // no fact strip: the board gets the room
    const codes = [...ALL_ITEMS, ...HAZARDS.map(h => h.code), "1f6d2", "2764"];
    const list = loadImages(codes), imgs = new Map(codes.map((c, i) => [c, list[i]] as const));
    const img = (c: string) => imgs.get(c)!;

    let cx = laneX(1), shakeUntil = 0, level = 1;
    const basket: string[] = [];                       // the last few things you grabbed, shown in the cart
    const floats: { x: number; y: number; text: string; color: string; age: number; big?: boolean }[] = [];
    const float = (text: string, color: string, x = cx, y = CART_Y - CART / 2 - 8, big = false) => floats.push({ x, y, text, color, age: 0, big });
    const game = createRun(mode === "daily", mode === "daily" ? dailySeed(0xca127) : Math.floor(Math.random() * 1e9), mulberry32, (e) => {
      if (e.type === "grab") { basket.push(e.code); if (basket.length > 4) basket.shift(); }
      if (e.type === "grab") float(e.listed ? `+${e.pts}` : `Not on the list +${e.pts}`, e.listed ? "#2eaa6e" : "#8a96a8");
      else if (e.type === "recipe") float(`${e.recipe.name} done! +${e.pts}${e.heart ? " ❤️" : ""}`, e.perfect ? "#2eaa6e" : "#3f7fd6", W / 2, H / 2 - 30, true);
      else if (e.type === "hit") { float(`💔 ${e.hazard.hit}`, "#e8505b"); shakeUntil = performance.now() + 260; }
      else finish();
    });
    const s = game.s;
    let started = false, ended = false, raf = 0, last = performance.now(), lastHud = 0, realStart = 0;
    setStarted(false); setOver(false); setResult(null); setToast(null); setHud({ score: 0, made: 0 }); resetScores();

    const finish = () => {
      ended = true;
      // one fact, after the run, about the recipe you were shopping for
      const recipe = RECIPES[s.recipe], last = s.got.some(Boolean) && recipe.items.includes(s.lastGrab);
      const left = recipe.items.filter((_, i) => !s.got[i]), code = last ? s.lastGrab : left[Math.floor(Math.random() * left.length)];
      const it = ITEMS[code];
      setToast({ title: last ? `Last in your cart: ${it.name}` : `Still on your list: ${it.name}`, body: it.facts[Math.floor(Math.random() * it.facts.length)], img: code });
      const sc = game.score();
      setHud({ score: sc, made: s.done.length });
      setResult({ done: [...s.done], hearts: s.hearts }); setOver(true);
      if (sc > readBest(bestKey)) { saveBest(bestKey, sc); setBest(sc); }
      shell.finishRef.current({ score: sc, drops: s.grabs, ms: performance.now() - realStart });
    };

    const start = () => { if (started || ended) return; started = true; realStart = performance.now(); last = realStart; setStarted(true); };
    startRef.current = start;
    // The lane pad under the cart: tap a lane, or slide along it. Elsewhere, tap either side or swipe.
    const toY = (clientY: number) => { const r = canvas.getBoundingClientRect(); return ((clientY - r.top) / r.height) * H; };
    const padLane = (x: number) => Math.max(0, Math.min(LANES - 1, Math.floor((x - SHELF) / LANE_W)));
    let down: { x: number; lane: number; swiped: boolean; pad: boolean } | null = null;
    const onDown = (e: PointerEvent) => {
      if (pausedRef.current || ended) return;
      if (!started) { start(); return; }
      const x = toLocal(e.clientX), pad = toY(e.clientY) >= PAD_Y - 24;
      down = { x, lane: s.lane, swiped: false, pad };
      if (pad) game.setLane(padLane(x)); else game.move(x < W / 2 ? -1 : 1);
    };
    const onMove = (e: PointerEvent) => {
      if (!down || !started || pausedRef.current) return;
      if (down.pad) { game.setLane(padLane(toLocal(e.clientX))); return; }
      if (down.swiped) return;
      const dx = toLocal(e.clientX) - down.x;
      if (Math.abs(dx) > 28) { down.swiped = true; game.setLane(down.lane + Math.sign(dx)); }   // the swipe wins over the tap
    };
    const onUp = () => { down = null; };
    const onKey = (e: KeyboardEvent) => {
      if (pausedRef.current || ended) return;
      const dir = e.key === "ArrowLeft" || e.key === "a" ? -1 : e.key === "ArrowRight" || e.key === "d" ? 1 : 0;
      if (!dir && e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      if (!started) start(); else if (dir) game.move(dir);
    };
    wrap.addEventListener("pointerdown", onDown); wrap.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp); window.addEventListener("pointercancel", onUp); window.addEventListener("keydown", onKey);

    const loop = (t: number) => {
      const dt = Math.max(0, Math.min(50, t - last)); last = t;   // frame times can land just before start()
      if (started && !ended && !pausedRef.current) {
        game.update(dt);
        const lv = 1 + Math.floor(timeAt(s.d) / LEVEL_SECS);
        if (lv > level && !s.over) {
          const capped = mode === "daily" && game.speed() >= DAILY_CAP; level = lv;
          float(capped ? `Level ${level}!` : `Level ${level} · Faster!`, "#2eaa6e", W / 2, H / 2 - 80, true);
        }
        if (!ended && t - lastHud > 100) { lastHud = t; setHud({ score: game.score(), made: s.done.length }); }
      }
      cx += (laneX(s.lane) - cx) * Math.min(1, dt / 55);
      for (let k = floats.length - 1; k >= 0; k--) { floats[k].age += dt; if (floats[k].age > (floats[k].big ? 1800 : 800)) floats.splice(k, 1); }
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    // the cart seen from behind the handle: a silver wire basket with groceries poking out, the folding child seat,
    // a red handle and your hands on it
    function trapezoid(x: number, top: number, bot: number, tw: number, bw: number, r: number) {
      ctx.beginPath();
      ctx.moveTo(x - tw + r, top); ctx.lineTo(x + tw - r, top); ctx.arcTo(x + tw, top, x + bw, bot, r);
      ctx.lineTo(x + bw, bot - r); ctx.arcTo(x + bw, bot, x - bw, bot, r); ctx.lineTo(x - bw + r, bot);
      ctx.arcTo(x - bw, bot, x - tw, top, r); ctx.lineTo(x - tw, top + r); ctx.arcTo(x - tw, top, x + tw, top, r); ctx.closePath();
    }
    function drawCart(x: number, y: number) {
      const top = y - 46, bot = y + 14, tw = 37, bw = 30;
      ctx.fillStyle = "rgba(16,27,46,0.12)"; ctx.beginPath(); ctx.ellipse(x, bot + 30, 46, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2f3747";                                          // wheels
      for (const [wx, wy] of [[x - tw - 3, top + 2], [x + tw - 4, top + 2], [x - bw - 4, bot - 4], [x + bw - 3, bot - 4]]) { ctx.beginPath(); ctx.roundRect(wx, wy, 7, 13, 3.5); ctx.fill(); }
      trapezoid(x, top, bot, tw, bw, 7);
      const g = ctx.createLinearGradient(0, top, 0, bot); g.addColorStop(0, "#f6f8fc"); g.addColorStop(1, "#dbe3ee");
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); trapezoid(x, top, bot, tw, bw, 7); ctx.clip();          // the wire mesh
      ctx.strokeStyle = "rgba(118,138,168,0.38)"; ctx.lineWidth = 1.2;
      for (let k = -4; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(x + k * 8.5, top); ctx.lineTo(x + k * 7, bot); ctx.stroke(); }
      for (let yy = top + 9; yy < bot; yy += 9) { ctx.beginPath(); ctx.moveTo(x - tw, yy); ctx.lineTo(x + tw, yy); ctx.stroke(); }
      ctx.fillStyle = "rgba(63,127,214,0.85)"; ctx.beginPath(); ctx.roundRect(x - bw + 4, bot - 14, (bw - 4) * 2, 11, 4); ctx.fill();   // folded child seat
      ctx.restore();
      trapezoid(x, top, bot, tw, bw, 7);
      ctx.strokeStyle = "#8d9fb9"; ctx.lineWidth = 3.5; ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.2;     // rim highlight
      ctx.beginPath(); ctx.moveTo(x - tw + 6, top + 2.5); ctx.lineTo(x + tw - 6, top + 2.5); ctx.stroke();
      const spots = [[-15, 8], [15, 6], [-6, 22], [16, 24]];               // groceries, poking up over the rim
      basket.forEach((c, k) => { const [dx, dy] = spots[k]; drawIcon(c, x + dx, top + dy, 30); });
      ctx.strokeStyle = "#8d9fb9"; ctx.lineWidth = 3;                     // frame down to the handle
      ctx.beginPath(); ctx.moveTo(x - bw + 4, bot); ctx.lineTo(x - bw + 2, bot + 13); ctx.moveTo(x + bw - 4, bot); ctx.lineTo(x + bw - 2, bot + 13); ctx.stroke();
      for (const side of [-1, 1]) {                                       // sleeves fading toward you
        const hx = x + side * 24, sg = ctx.createLinearGradient(0, bot + 18, 0, bot + 40);
        sg.addColorStop(0, "rgba(78,94,128,1)"); sg.addColorStop(1, "rgba(78,94,128,0)");
        ctx.fillStyle = sg; ctx.beginPath(); ctx.roundRect(hx - 8, bot + 18, 16, 22, 7); ctx.fill();
      }
      ctx.fillStyle = "#e8505b"; ctx.beginPath(); ctx.roundRect(x - 41, bot + 11, 82, 10, 5); ctx.fill();   // red handle
      ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.beginPath(); ctx.roundRect(x - 37, bot + 12.5, 74, 2.5, 1.25); ctx.fill();
      for (const side of [-1, 1]) {                                       // hands gripping it
        const hx = x + side * 24;
        ctx.fillStyle = "#f2c9a0"; ctx.beginPath(); ctx.roundRect(hx - 8, bot + 9, 16, 13, 6); ctx.fill();
        ctx.strokeStyle = "rgba(150,100,70,0.35)"; ctx.lineWidth = 1; ctx.stroke();
        ctx.strokeStyle = "rgba(150,100,70,0.3)";
        for (const fx of [-3, 1, 5]) { ctx.beginPath(); ctx.moveTo(hx + fx - 1, bot + 10); ctx.lineTo(hx + fx - 1, bot + 15); ctx.stroke(); }
      }
    }
    function drawHeart(x: number, y: number, s: number, full: boolean) {
      ctx.beginPath(); ctx.moveTo(x, y + s * 0.3);
      ctx.bezierCurveTo(x, y, x - s / 2, y, x - s / 2, y + s * 0.3);
      ctx.bezierCurveTo(x - s / 2, y + s * 0.6, x, y + s * 0.8, x, y + s);
      ctx.bezierCurveTo(x, y + s * 0.8, x + s / 2, y + s * 0.6, x + s / 2, y + s * 0.3);
      ctx.bezierCurveTo(x + s / 2, y, x, y, x, y + s * 0.3); ctx.closePath();
      if (full) { ctx.fillStyle = "#e8505b"; ctx.fill(); }
      else { ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fill(); ctx.strokeStyle = "rgba(16,27,46,0.25)"; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
    function drawIcon(code: string, x: number, y: number, size: number) { const i = img(code); if (i.complete && i.naturalWidth) ctx.drawImage(i, x - size / 2, y - size / 2, size, size); }

    function draw(t: number) {
      ctx.save(); ctx.clearRect(0, 0, W, H);
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, 22); ctx.clip();
      if (t < shakeUntil) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6);

      // the aisle: tiled floor, dashed lane lines and shelves, all scrolling with the distance travelled
      ctx.fillStyle = "#f7f3ec"; ctx.fillRect(0, 0, W, H);
      const off = s.d % 64;
      ctx.strokeStyle = "rgba(16,27,46,0.05)"; ctx.lineWidth = 2;
      for (let y = HUD - 64 + off; y < H; y += 64) { ctx.beginPath(); ctx.moveTo(SHELF, y); ctx.lineTo(W - SHELF, y); ctx.stroke(); }
      ctx.strokeStyle = "rgba(16,27,46,0.13)"; ctx.lineWidth = 3; ctx.setLineDash([22, 22]); ctx.lineDashOffset = -s.d % 44;
      for (let l = 1; l < LANES; l++) { const x = SHELF + LANE_W * l; ctx.beginPath(); ctx.moveTo(x, HUD); ctx.lineTo(x, H); ctx.stroke(); }
      ctx.setLineDash([]);
      for (const side of [0, W - SHELF]) {
        ctx.fillStyle = "#dfe6f0"; ctx.fillRect(side, 0, SHELF, H);
        const sOff = s.d % 36;
        for (let y = -36 + sOff, n = Math.floor(s.d / 36); y < H; y += 36, n--) {
          const c = SHELF_COLORS[(((n * 7 + (side ? 3 : 0)) % SHELF_COLORS.length) + SHELF_COLORS.length) % SHELF_COLORS.length];
          ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(side + 5, y + 4, SHELF - 10, 28, 4); ctx.fill();
        }
        ctx.fillStyle = "rgba(16,27,46,0.08)"; ctx.fillRect(side ? side : SHELF - 3, 0, 3, H);
      }

      // items and hazards
      const need = new Set(game.needed());
      for (const th of s.things) {
        const y = CART_Y - (th.d - s.d), x = laneX(th.lane);
        if (y < HUD - 40 || y > H + 40) continue;
        if (th.hazard < 0) {
          if (th.gone) continue;
          const listed = need.has(th.code);
          ctx.fillStyle = "rgba(255,255,255,0.96)"; ctx.beginPath(); ctx.arc(x, y, IR, 0, Math.PI * 2); ctx.fill();
          ctx.lineWidth = listed ? 4 : 2; ctx.strokeStyle = listed ? "#2eaa6e" : "rgba(16,27,46,0.10)"; ctx.stroke();
          if (listed) { ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t / 180); ctx.beginPath(); ctx.arc(x, y, IR + 6, 0, Math.PI * 2); ctx.strokeStyle = "#2eaa6e"; ctx.lineWidth = 3; ctx.stroke(); ctx.globalAlpha = 1; }
          drawIcon(th.code, x, y, IR * 1.55);
        } else {
          ctx.globalAlpha = th.hit ? 0.35 : 1;
          if (th.hazard === 0) {         // a puddle with a wet floor sign
            ctx.fillStyle = "rgba(90,160,235,0.45)"; ctx.beginPath(); ctx.ellipse(x, y + 6, 46, 22, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.ellipse(x - 16, y + 1, 12, 5, -0.3, 0, Math.PI * 2); ctx.fill();
            drawIcon("26a0", x, y - 4, 38);
          } else if (th.hazard === 1) {  // a stack of boxes
            drawIcon("1f4e6", x - 10, y + 8, 40); drawIcon("1f4e6", x + 12, y + 6, 40); drawIcon("1f4e6", x + 1, y - 14, 40);
          } else {                       // a can rolling toward you
            ctx.save(); ctx.translate(x, y); ctx.rotate(s.d / 40); drawIcon("1f96b", 0, 0, 42); ctx.restore();
          }
          ctx.globalAlpha = 1;
        }
      }

      // the cart (blinks for a moment after a bump)
      const hurt = s.ms < s.hurtUntil && Math.floor(t / 110) % 2 === 0;
      ctx.globalAlpha = hurt ? 0.35 : 1; drawCart(cx, CART_Y); ctx.globalAlpha = 1;
      for (let k = 0; k < HEARTS; k++) drawHeart(cx + (k - 1) * 17, CART_Y + 62, 13, k < s.hearts);   // hearts ride under the cart

      // the lane pad: where your finger goes
      ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.beginPath(); ctx.roundRect(SHELF + 4, PAD_Y, W - 2 * SHELF - 8, PAD_H, 14); ctx.fill();
      ctx.strokeStyle = "rgba(63,127,214,0.35)"; ctx.lineWidth = 2; ctx.stroke();
      const px = SHELF + 4 + s.lane * ((W - 2 * SHELF - 8) / LANES);
      ctx.fillStyle = "rgba(63,127,214,0.9)"; ctx.beginPath(); ctx.roundRect(px + 4, PAD_Y + 4, (W - 2 * SHELF - 8) / LANES - 8, PAD_H - 8, 10); ctx.fill();
      for (let l = 0; l < LANES; l++) {                  // ◀ left lane, • middle, ▶ right lane
        const mx = SHELF + 4 + (l + 0.5) * ((W - 2 * SHELF - 8) / LANES), my = PAD_Y + PAD_H / 2;
        ctx.fillStyle = l === s.lane ? "#fff" : "rgba(63,127,214,0.65)";
        ctx.beginPath();
        if (l === 1) ctx.arc(mx, my, 5, 0, Math.PI * 2);
        else { const d = l === 0 ? -1 : 1; ctx.moveTo(mx + d * 7, my); ctx.lineTo(mx - d * 5, my - 8); ctx.lineTo(mx - d * 5, my + 8); ctx.closePath(); }
        ctx.fill();
      }

      // HUD: the recipe card and hearts
      ctx.fillStyle = "rgba(255,255,255,0.94)"; ctx.fillRect(0, 0, W, HUD);
      ctx.fillStyle = "rgba(16,27,46,0.08)"; ctx.fillRect(0, HUD - 1, W, 1);
      const recipe = RECIPES[s.recipe];
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#101b2e"; ctx.font = font(700, 17);
      ctx.fillText(recipe.name, 14, 24);
      recipe.items.forEach((c, i) => {
        const ix = 14 + i * 46 + 18, iy = 52;
        ctx.globalAlpha = s.got[i] ? 0.35 : 1; drawIcon(c, ix, iy, 34); ctx.globalAlpha = 1;
        if (s.got[i]) {
          ctx.fillStyle = "#2eaa6e"; ctx.beginPath(); ctx.arc(ix + 12, iy + 10, 9, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(ix + 7.5, iy + 10); ctx.lineTo(ix + 11, iy + 13.5); ctx.lineTo(ix + 16.5, iy + 6.5); ctx.stroke();
        }
      });
      ctx.textAlign = "right"; ctx.font = font(600, 13); ctx.fillStyle = s.perfect ? "#2eaa6e" : "#8a96a8";
      ctx.fillText(s.perfect ? "No extras: ×2 bonus" : "Extras: no ×2 this time", W - 14, 24);
      ctx.font = font(800, 15); ctx.fillStyle = "#2eaa6e"; ctx.fillText(`Level ${level}`, W - 14, 58);

      ctx.textAlign = "center";
      for (const f of floats) {
        const life = f.big ? 1800 : 800, a = 1 - f.age / life;
        ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.6)); ctx.fillStyle = f.color;
        ctx.font = font(800, f.big ? 24 : 16);
        ctx.fillText(f.text, Math.max(W * 0.3, Math.min(W * 0.7, f.x)), f.y - (f.big ? 0 : f.age * 0.05));
      }
      ctx.globalAlpha = 1; ctx.restore();
    }

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); stop();
      wrap.removeEventListener("pointerdown", onDown); wrap.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onUp); window.removeEventListener("keydown", onKey);
    };
  }, [mode, run, bestKey]);

  const n = dailyNumber(LAUNCH);
  const made = result?.done.length ?? 0, perfects = result?.done.filter(d => d.perfect).length ?? 0;
  const headline = !result ? "" : made === 0 ? "No recipes this time 🛒" : `You made ${made} recipe${made === 1 ? "" : "s"} 🛒`;
  const share = () => {
    if (!result) return;
    // Wordle-style: the dishes you made, a ⭐ after each one with nothing extra in the cart
    const label = mode === "daily" ? `Cart Rush #${n} (Today's Challenge)` : "Cart Rush (Free Play)";
    const p = shell.scores.posted;
    const rank = p?.rank ? `\n🏆 #${p.rank} of ${p.total} ${mode === "daily" ? "today" : "this week"}` : "";
    const dishes = result.done.slice(0, 12).map(d => d.dish + (d.perfect ? "⭐" : "")).join(" ") + (made > 12 ? ` +${made - 12}` : "");
    const what = `${made} recipe${made === 1 ? "" : "s"}${perfects ? ` (${perfects} with no extras)` : ""}`;
    shell.share(`${label}\n${hud.score.toLocaleString()} pts · ${what}${dishes ? `\n${dishes}` : ""}${rank}\nCan you beat it? whatyouate.app/games/cart-rush`);
  };

  return (
    <GameScreen>
      <GameHeader title="Cart Rush" mode={mode} onMode={m => { setMode(m); setRun(r => r + 1); }} onBoard={() => shell.setBoardOpen(true)} onHelp={shell.help.show} />

      <div className="mt-2 flex items-center justify-between">
        <div><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Score</div><div className="text-2xl font-bold leading-none tabular-nums">{hud.score.toLocaleString()}</div></div>
        <div className="rounded-full bg-[#3f7fd6] px-2.5 py-0.5 text-xs font-bold text-white">
          {hud.made === 1 ? "1 recipe made" : `${hud.made} recipes made`}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right"><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Best</div><div className="text-lg font-semibold leading-none tabular-nums">{best.toLocaleString()}</div></div>
          <PauseButton shell={shell} active={started && !over} />
        </div>
      </div>

      <BoardArea wrapRef={wrapRef} size={board} reserve={0}>
        <canvas ref={canvasRef} className="block rounded-[22px] shadow-[0_14px_40px_rgba(16,42,86,0.18)]" />
        <PrizeLogo shell={shell} active={started && !over && !shell.paused} />
        <PausedCard shell={shell} active={started && !over} />
        {!started && !over && (
          <button onClick={() => startRef.current()} className="absolute inset-0 flex items-center justify-center rounded-[22px] bg-[#101b2e]/25">
            <span className="rounded-3xl bg-white px-6 py-4 text-center shadow-2xl">
              <span className="block text-lg font-bold">Tap To Start</span>
              <span className="mt-1 block text-sm text-[#5a6b85]">Use the pad under your cart to switch lanes</span>
            </span>
          </button>
        )}
        {over && <GameOver label={mode === "daily" ? `Today's Challenge #${n}` : "Free Play"} headline={headline} score={hud.score} best={best} mode={mode}
          posted={shell.scores.posted} joined={!!shell.player} campaign={GAME} copied={shell.copied} fact={toast}
          pitch="Planning meals beats grabbing whatever. WhatYouAte shows you which meals keep you going."
          onBoard={() => shell.setBoardOpen(true)} onJoin={() => shell.setJoinOpen(true)} onAgain={() => setRun(r => r + 1)} onShare={share} />}
      </BoardArea>

      <ShellPopups shell={shell} game={GAME} todayNote="Today's Challenge: same aisle and recipes for everyone. Resets at midnight." />

      {shell.help.open && (
        <HelpModal onClose={shell.help.close} steps={[
          "Tap a lane on the pad under your cart to switch, or slide along it. Swipes and arrow keys work too.",
          "Grab what's on your recipe card. Those items glow green. Finish the recipe for a bonus.",
          "Stick to the list. No extras in the cart doubles the bonus.",
          "Wet floors, boxes and rolling cans cost a heart. Lose all 3 and the shop's over. Every 4th recipe earns one back.",
        ]}>
          <ModesHelp today="everyone gets the same aisle and recipes today." free="a new aisle every time, and it keeps speeding up." />
        </HelpModal>
      )}
    </GameScreen>
  );
}
