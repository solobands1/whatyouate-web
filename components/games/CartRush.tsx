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
  useGameShell, fitCanvas, loadImages, dailySeed, dailyNumber, torontoDate, mulberry32, readBest, saveBest, foodPng, HUD_ROW, HudStat, HudTag, StartCard } from "./kit";
import { useDuel } from "./duels";
import { GAME_FONT, loadGameFont } from "./gameFont";
import { type CartArt, buildCartArt, canStripes, heart, FLOOR_P, SHELF_P } from "./art2/cartArt";
import { layer, textStamps, warmText } from "./art2/paint";

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
const PAD = { x: SHELF + 4, y: PAD_Y, w: W - 2 * SHELF - 8, h: PAD_H };
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
  const duel = useDuel(shell, GAME, "Cart Rush", mode, () => { if (mode !== "daily") { setMode("daily"); setRun(r => r + 1); } });   // Friend Duels
  const { reset: resetScores } = shell.scores;
  // eslint-disable-next-line react-hooks/refs -- the canvas loop reads the latest pause state (same pattern as the other games)
  const pausedRef = useRef(false); pausedRef.current = shell.paused;   // popups pause the shop
  const startRef = useRef<() => void>(() => {});
  const bestKey = mode === "daily" ? `cartrush-daily-${torontoDate()}` : "cartrush-endless";
  useEffect(() => { setBest(readBest(bestKey)); }, [bestKey]);

  useEffect(() => {
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const { ctx, toLocal, stop } = fitCanvas(canvas, wrap, W, H, setBoard, 0);   // no fact strip: the board gets the room
    void loadGameFont();   // the display face for the recipe card and pop-up scores on the canvas
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

    // The aisle's still art (floor, shelves, light, the cart, sprites) is painted once per screen density in ./art2/cartArt;
    // each frame scrolls and stamps it, then draws what moves.
    let art: CartArt | null = null;
    const stamp = textStamps();
    const ensureArt = () => {
      const k = canvas.width / W;
      if (!art || Math.abs(art.k - k) > 1e-6) { art = buildCartArt(k, W, H, SHELF, LANE_W, IR, HUD, PAD); warmText([`17px ${GAME_FONT}`, `25px ${GAME_FONT}`], "💔 ❤️ +20 Level"); }
      return art;
    };
    function scroll(im: HTMLCanvasElement, dx: number, dw: number, P: number, k: number) {   // a strip that repeats every P, moved by the distance
      const off = Math.round((((s.d % P) + P) % P) * k), sy = Math.max(0, Math.round(P * k) - off), sh = Math.min(Math.round(H * k), im.height - sy);
      ctx.drawImage(im, 0, sy, im.width, sh, dx, 0, dw, sh / k);
    }
    // the cart seen from behind the handle: a chrome wire basket with groceries poking out, the folded child seat,
    // a red handle and your hands on it
    function drawCart(x: number, y: number, A: CartArt) {
      ctx.drawImage(A.cartBack, x - 60, y - 60, 120, 120);
      const top = y - 46, spots = [[-15, 8], [15, 6], [-6, 22], [16, 24]];   // groceries, poking up over the rim
      basket.forEach((c, k) => { const [dx, dy] = spots[k]; ctx.fillStyle = "rgba(40,52,72,0.22)"; ctx.beginPath(); ctx.ellipse(x + dx + 2, top + dy + 11, 10, 3.6, 0, 0, Math.PI * 2); ctx.fill(); drawIcon(c, x + dx, top + dy, 30); });
      ctx.drawImage(A.cartFront, x - 60, y - 60, 120, 120);
    }
    function drawIcon(code: string, x: number, y: number, size: number) { const i = img(code); if (i.complete && i.naturalWidth) ctx.drawImage(i, x - size / 2, y - size / 2, size, size); }
    let cardCv: HTMLCanvasElement | null = null, cardKeyNow = "", buttonCv: HTMLCanvasElement | null = null, buttonK = 0;
    function paintRecipeCard(A: CartArt, recipe: Recipe) {
      const L = layer(W, HUD + 12, A.k), c = L.c;
      c.drawImage(A.card, 0, 0, W, HUD + 12);
      c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillStyle = "#0E1F45"; c.font = `19px ${GAME_FONT}`;
      c.fillText(recipe.name, 16, 27);
      recipe.items.forEach((code, i) => {
        const ix = 14 + i * 46 + 18, iy = 52, im = img(code);
        c.fillStyle = "rgba(90,60,30,0.14)"; c.beginPath(); c.ellipse(ix + 2, iy + 15, 13, 3.4, 0, 0, Math.PI * 2); c.fill();
        c.globalAlpha = s.got[i] ? 0.35 : 1; if (im.complete && im.naturalWidth) c.drawImage(im, ix - 17, iy - 17, 34, 34); c.globalAlpha = 1;
        if (s.got[i]) check(c, ix + 12, iy + 10);
      });
      c.textAlign = "right"; c.font = font(600, 13); c.fillStyle = s.perfect ? "#1f9a5a" : "#7d8798";
      c.fillText(s.perfect ? "No extras: ×2 bonus" : "Extras: no ×2 this time", W - 15, 26);
      const lv = `Level ${level}`; c.font = `15px ${GAME_FONT}`; const lw = c.measureText(lv).width + 18, lx = W - 15 - lw, ly = 45;
      c.fillStyle = "#3F78DB"; c.beginPath(); c.roundRect(lx, ly + 2, lw, 21, 10.5); c.fill();
      const lg = c.createLinearGradient(0, ly, 0, ly + 21); lg.addColorStop(0, "#84B6FF"); lg.addColorStop(1, "#5A95F5");
      c.fillStyle = lg; c.beginPath(); c.roundRect(lx, ly, lw, 21, 10.5); c.fill();
      c.fillStyle = "rgba(255,255,255,0.3)"; c.beginPath(); c.roundRect(lx + 5, ly + 1.5, lw - 10, 7, 3.5); c.fill();
      c.textAlign = "center"; c.fillStyle = "rgba(30,70,150,0.35)"; c.fillText(lv, lx + lw / 2, ly + 16.5); c.fillStyle = "#fff"; c.fillText(lv, lx + lw / 2, ly + 15.5);
      return L.cv;
    }
    function litButton(A: CartArt, bw: number, bh: number) {   // the lane pad's lit button: brand blue, a lip under it, a shine on top
      if (buttonCv && buttonK === A.k) return buttonCv;
      const L = layer(bw, bh + 3, A.k), c = L.c;
      c.fillStyle = "#3F78DB"; c.beginPath(); c.roundRect(0, 2.5, bw, bh, 11); c.fill();
      const bg = c.createLinearGradient(0, 0, 0, bh); bg.addColorStop(0, "#84B6FF"); bg.addColorStop(0.5, "#6FA8FF"); bg.addColorStop(1, "#5A95F5");
      c.fillStyle = bg; c.beginPath(); c.roundRect(0, 0, bw, bh, 11); c.fill();
      const sh = c.createLinearGradient(0, 0, 0, bh * 0.5); sh.addColorStop(0, "rgba(255,255,255,0.42)"); sh.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = sh; c.beginPath(); c.roundRect(5, 2, bw - 10, bh * 0.45, [8, 8, 5, 5]); c.fill();
      buttonCv = L.cv; buttonK = A.k; return buttonCv;
    }
    function check(ctx: CanvasRenderingContext2D, x: number, y: number) {   // a ticked-off item on the card
      ctx.fillStyle = "rgba(20,60,30,0.25)"; ctx.beginPath(); ctx.arc(x + 0.6, y + 1.4, 9, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createLinearGradient(x - 9, y - 9, x + 9, y + 9); g.addColorStop(0, "#5fe3a0"); g.addColorStop(1, "#1e9a5a");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(x - 4.5, y); ctx.lineTo(x - 1, y + 3.5); ctx.lineTo(x + 4.5, y - 3.5); ctx.stroke();
    }

    function draw(t: number) {
      const A = ensureArt();
      ctx.save(); ctx.clearRect(0, 0, W, H);
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, 22); ctx.clip();
      if (t < shakeUntil) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6);

      // the aisle: polished tiles with lane lines, and the stocked shelves, all scrolling with the distance travelled
      scroll(A.floor, SHELF, W - 2 * SHELF, FLOOR_P, A.k);
      scroll(A.left, 0, SHELF, SHELF_P, A.k); scroll(A.right, W - SHELF, SHELF, SHELF_P, A.k);

      // items and hazards
      const need = new Set(game.needed()), S = (IR + 12) * 2;
      for (const th of s.things) {
        const y = CART_Y - (th.d - s.d), x = laneX(th.lane);
        if (y < HUD - 40 || y > H + 40) continue;
        if (th.hazard < 0) {
          if (th.gone) continue;
          const listed = need.has(th.code);
          ctx.drawImage(listed ? A.plateOn : A.plate, x - S / 2, y - S / 2, S, S);
          if (listed) {
            const p = 0.35 + 0.25 * Math.sin(t / 180);
            ctx.globalAlpha = p * 0.45; ctx.strokeStyle = "#5fe3a0"; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x, y, IR + 6, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = p * 1.4; ctx.strokeStyle = "#22a964"; ctx.lineWidth = 2.4; ctx.stroke(); ctx.globalAlpha = 1;
          }
          drawIcon(th.code, x, y - 1, IR * 1.55);
        } else {
          ctx.globalAlpha = th.hit ? 0.35 : 1;
          if (th.hazard === 0) ctx.drawImage(A.spill, x - 50, y - 40, 100, 84);          // a puddle with a wet floor sign
          else if (th.hazard === 1) ctx.drawImage(A.boxes, x - 50, y - 46, 100, 92);   // a stack of boxes
          else {                                                                         // a can rolling toward you
            ctx.drawImage(A.canBase, x - 30, y - 24, 60, 52); canStripes(ctx, x, y, (s.d / 75) % 1, "#c8443a"); ctx.drawImage(A.canShade, x - 30, y - 24, 60, 52);
          }
          ctx.globalAlpha = 1;
        }
      }

      // the cart (blinks for a moment after a bump)
      const hurt = s.ms < s.hurtUntil && Math.floor(t / 110) % 2 === 0;
      ctx.globalAlpha = hurt ? 0.35 : 1; drawCart(cx, CART_Y, A); ctx.globalAlpha = 1;
      for (let k = 0; k < HEARTS; k++) heart(ctx, cx + (k - 1) * 17, CART_Y + 62, 13, k < s.hearts);   // hearts ride under the cart
      ctx.drawImage(A.light, 0, 0, W, H);   // the store's light: warm from the top left, a soft vignette

      // the lane pad: where your finger goes (the lit button slides with the cart)
      ctx.drawImage(A.track, PAD.x - 10, PAD.y - 6, PAD.w + 20, PAD.h + 20);
      const segW = PAD.w / LANES, px = PAD.x + ((cx - laneX(0)) / LANE_W) * segW, bx = px + 4, bw = segW - 8, by = PAD_Y + 4, bh = PAD_H - 9;
      ctx.drawImage(litButton(A, bw, bh), bx, by, bw, bh + 3);
      for (let l = 0; l < LANES; l++) {                  // ◀ left lane, • middle, ▶ right lane
        const mx = PAD.x + (l + 0.5) * segW, my = PAD_Y + PAD_H / 2 - 1, on = l === s.lane;
        ctx.fillStyle = on ? "#fff" : "rgba(170,198,245,0.7)";
        if (on) { ctx.shadowColor = "rgba(20,50,110,0.45)"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 1.5 * A.k; }
        ctx.beginPath();
        if (l === 1) ctx.arc(mx, my, 5, 0, Math.PI * 2);
        else { const d = l === 0 ? -1 : 1; ctx.moveTo(mx + d * 7, my); ctx.lineTo(mx - d * 5, my - 8); ctx.lineTo(mx - d * 5, my + 8); ctx.closePath(); }
        ctx.fill(); ctx.shadowColor = "transparent"; ctx.shadowOffsetY = 0;
      }

      // the recipe card along the top (repainted only when something on it changes)
      const recipe = RECIPES[s.recipe], cardKey = `${A.k}|${s.recipe}|${s.got.join()}|${s.perfect}|${level}|${recipe.items.map(c => +(img(c).complete && img(c).naturalWidth > 0)).join("")}`;
      if (!cardCv || cardKey !== cardKeyNow) { cardCv = paintRecipeCard(A, recipe); cardKeyNow = cardKey; }
      ctx.drawImage(cardCv, 0, 0, W, HUD + 12);

      ctx.textAlign = "center";
      for (const f of floats) {
        const life = f.big ? 1800 : 800, a = 1 - f.age / life;
        ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.6));
        stamp(ctx, f.text, Math.max(W * 0.3, Math.min(W * 0.7, f.x)), f.y - (f.big ? 0 : f.age * 0.05), `${f.big ? 25 : 17}px ${GAME_FONT}`, f.color, "rgba(255,255,255,0.95)", f.big ? 5 : 4);
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

      <div className={HUD_ROW}>
        <HudStat label="Score" value={hud.score.toLocaleString()} />
        <HudTag color="#3F7FD6">{hud.made === 1 ? "1 Recipe Made" : `${hud.made} Recipes Made`}</HudTag>
        <div className="flex shrink-0 items-center gap-1.5">
          <HudStat label="Best" value={best.toLocaleString()} align="right" />
          <PauseButton shell={shell} active={started && !over} />
        </div>
      </div>

      <BoardArea wrapRef={wrapRef} size={board} reserve={0}>
        <canvas ref={canvasRef} className="block rounded-[22px] shadow-[0_14px_40px_rgba(16,42,86,0.18)]" />
        <PrizeLogo shell={shell} active={started && !over && !shell.paused} />
        <PausedCard shell={shell} active={started && !over} />
        {!started && !over && (
          <StartCard label={mode === "daily" ? `Today's Challenge #${n}` : "Free Play"} title="Cart Rush" how="Use the pad under your cart to switch lanes" onStart={() => startRef.current()} />
        )}
        {over && <GameOver label={mode === "daily" ? `Today's Challenge #${n}` : "Free Play"} headline={headline} score={hud.score} best={best} mode={mode}
          posted={shell.scores.posted} joined={!!shell.player} campaign={GAME} copied={shell.copied} fact={toast}
          pitch="Planning meals beats grabbing whatever. WhatYouAte shows you which meals keep you going."
          onBoard={() => shell.setBoardOpen(true)} onJoin={() => shell.setJoinOpen(true)} onAgain={() => setRun(r => r + 1)} onShare={share}  extra={duel.button} />}
      </BoardArea>

      <ShellPopups shell={shell} game={GAME} todayNote="Today's Challenge: same aisle and recipes for everyone. Resets at midnight." />
      {duel.popup}

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
