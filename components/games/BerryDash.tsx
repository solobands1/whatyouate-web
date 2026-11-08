"use client";

// Berry Dash: a strawberry runs along a kitchen counter. Tap to jump over things on the counter, swipe down to duck
// under things flying at you. Blueberries and water are points. Candy is the tempting one: a short sugar rush
// (faster, so distance piles up) and then heavy legs for a few seconds, when every jump is smaller. You have 3
// hearts; each bump costs one and gives a short blink of safety, so one misread swipe doesn't end a run but
// carelessness does. Score is distance in metres plus pickups, so it spreads widely and ties are rare.
// The course is laid out by distance, not time, so "Today" gives everyone the same counter (seeded), and the speed
// ramps up to a cap. Free Play is random and keeps getting faster. No facts pop up mid-run: the game-over card shows
// one at the end, about what knocked you out. Balance was checked with simulated players: doing nothing ends in about
// 7 seconds, a careless player in 10 to 40, a careful one lasts about two minutes and scores many times more.
// Everything around the board comes from ./kit.
import { useEffect, useRef, useState } from "react";
import { type Mode, type Toast, GameScreen, GameHeader, BoardArea, PrizeLogo, GameOver, PauseButton, PausedCard, HelpModal, ModesHelp, ShellPopups,
  useGameShell, fitCanvas, loadImages, dailySeed, dailyNumber, torontoDate, mulberry32, readBest, saveBest, foodPng } from "./kit";

const GAME = "berry-dash";
const LAUNCH = "2026-11-08";   // Today's Challenge #1

// ── rules (mirrored in the balance sim) ────────────────────────────────────
const W = 400, H = 600, HUD = 44, GY = 470;    // logical board; GY is the counter top
const PX = 92, PXM = 20;                       // the strawberry's x; 20 px of counter is one metre
const G = 2600, JUMP_V = 830, HEAVY_JUMP = 0.88, FAST_FALL = 3;
const STAND_H = 46, DUCK_H = 24, PHW = 13, SLIDE_MS = 600, INV_MS = 1100, HEARTS = 3;
const RUSH = 1.3, RUSH_MS = 2500, HEAVY_MS = 4000;
const PICK_R = 32, SEG_M = 250;                // pickup reach; metres per square in the share text

type Obs = { name: string; code: string; air: boolean; size: number; hw: number; h?: number; lo?: number; hi?: number; title: string; facts: string[] };
const OBS: Obs[] = [
  { name: "Salt shaker", code: "1f9c2", air: false, size: 52, hw: 12, h: 44, title: "Tripped by a salt shaker", facts: [
    "Most of the salt people eat comes from packaged and restaurant food, not the shaker.",
    "A teaspoon of salt has about 2,300 mg of sodium. That's the most adults are advised to have in a whole day."] },
  { name: "Can", code: "1f96b", air: false, size: 52, hw: 15, h: 42, title: "Tripped by a can", facts: [
    "Rinsing canned beans washes off a lot of the extra salt.",
    "Canned salmon and sardines with the soft bones left in are a good source of calcium."] },
  { name: "Honey pot", code: "1f36f", air: false, size: 54, hw: 17, h: 40, title: "Stuck on a honey pot", facts: [
    "Spoon for spoon, honey has a few more calories than table sugar.",
    "Bees visit millions of flowers to make a single jar of honey."] },
  { name: "Teapot", code: "1fad6", air: false, size: 62, hw: 24, h: 36, title: "Tripped by a teapot", facts: [
    "Green, black and oolong tea all come from the same plant. The difference is how the leaves are processed.",
    "A cup of black tea has roughly half the caffeine of a cup of coffee.",
    "Unsweetened tea counts toward your daily water."] },
  { name: "Bee", code: "1f41d", air: true, size: 46, hw: 17, lo: 32, hi: 76, title: "Bumped by a bee", facts: [
    "Bees help pollinate strawberries. Well-pollinated berries grow bigger and rounder.",
    "About one in every three bites of food we eat depends on pollinators like bees."] },
  { name: "Spoon", code: "1f944", air: true, size: 50, hw: 22, lo: 34, hi: 70, title: "Hit by a flying spoon", facts: [
    "A teaspoon of sugar is about 4 grams. Divide the sugar on a label by 4 to picture it in teaspoons.",
    "A can of regular soda has about 39 grams of sugar. That's around 10 teaspoons."] },
];
type Pick = { name: string; code: string; pts: number; size: number };
const PICKS: Pick[] = [
  { name: "Blueberries", code: "1fad0", pts: 5, size: 30 },
  { name: "Water", code: "1f4a7", pts: 15, size: 30 },
  { name: "Candy", code: "1f36c", pts: 10, size: 34 },
];
const CANDY_FACTS = [
  "Candy is almost pure sugar, so it hits fast and wears off fast.",
  "Sugar on its own digests quickly. Having it with protein or fibre slows it down.",
];
const BERRY = "1f353";

// Levels: every 400 m the speed steps up (eased in, never a jolt), with a "Level 3 · Faster!" banner. The steps
// follow the same overall curve as before, so it's no harder, just easier to feel your progress.
const LEVEL_PX = 400 * 20;
const levelAt = (d: number) => 1 + Math.floor(d / LEVEL_PX);
function baseSpeed(d: number, free: boolean) {
  const lv = levelAt(d);
  if (!free) return 230 + 250 * Math.min(1, (lv - 1) / 8);               // Today: tops out at level 9, then holds
  return Math.min(650, 230 + 250 * Math.min(1, (lv - 1) / 6) + Math.max(0, lv - 7) * 16);   // Free Play keeps going
}
const gapTime = (d: number) => Math.max(0.95, 1.9 - (d / 30000) * 0.8);   // seconds between obstacles, roomy at first

type Ent = { k: "o" | "p"; t: number; wx: number; y: number; pair?: boolean; done?: boolean; knocked?: number };
type Status = "run" | "rush" | "heavy";
type Result = { meters: number; berries: number; squares: string; level: number };
type Hud = { score: number; status: Status };
const STATUS_LABEL: Record<Status, string> = { run: "Running", rush: "Sugar rush!", heavy: "Heavy legs" };
const STATUS_COLOR: Record<Status, string> = { run: "#2eaa6e", rush: "#b54bd1", heavy: "#e09a00" };

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, full: boolean) {
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  ctx.fillStyle = full ? "#e8505b" : "rgba(16,27,46,0.15)"; ctx.fill();
}

const Row = ({ codes, label }: { codes: string[]; label: string }) => (
  <div className="flex items-center gap-1">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {codes.map(c => <img key={c} src={foodPng(c)} alt="" className="h-[18px] w-[18px]" />)}
    <span className="ml-1">{label}</span>
  </div>
);

export default function BerryDash() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("daily");
  const [run, setRun] = useState(0);                 // bump to restart
  const [started, setStarted] = useState(false);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [hud, setHud] = useState<Hud>({ score: 0, status: "run" });
  const [best, setBest] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [board, setBoard] = useState({ w: 0, h: 0 });
  const shell = useGameShell(GAME, mode);
  const { reset: resetScores } = shell.scores;
  const pausedRef = useRef(false); pausedRef.current = shell.paused;   // popups pause the run
  const startRef = useRef<() => void>(() => {});
  const bestKey = mode === "daily" ? `berrydash-daily-${torontoDate()}` : "berrydash-endless";
  useEffect(() => { setBest(readBest(bestKey)); }, [bestKey]);

  useEffect(() => {
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const { ctx, stop } = fitCanvas(canvas, wrap, W, H, setBoard, 0);   // no fact strip: the board gets the room
    const free = mode === "endless";
    const obsImg = loadImages(OBS.map(o => o.code)), pickImg = loadImages(PICKS.map(p => p.code)), [berryImg] = loadImages([BERRY]);
    const rnd = mulberry32(mode === "daily" ? dailySeed(0xbe77d) : Math.floor(Math.random() * 1e9));

    // the course, laid out by distance so it doesn't depend on how anyone plays
    const ents: Ent[] = [];
    let nextX = 700, lastCandy = -1e9;
    const gen = () => {
      const v = baseSpeed(nextX, free), x0 = nextX;
      const airP = nextX < 4500 ? 0 : 0.32, pairP = nextX < 15000 ? 0 : 0.16;
      const r = rnd();
      let right: number;
      if (r < airP) {
        const t = nextX > 9000 && rnd() < 0.5 ? 5 : 4;
        ents.push({ k: "o", t, wx: x0 + OBS[t].hw, y: 0 }); right = x0 + 2 * OBS[t].hw;
      } else if (r < airP + pairP) {                 // two small ones close together: one good jump clears both
        const t = rnd() < 0.5 ? 0 : 1, hw = OBS[t].hw;
        ents.push({ k: "o", t, wx: x0 + hw, y: 0 }, { k: "o", t, wx: x0 + 3 * hw + 30, y: 0, pair: true }); right = x0 + 4 * hw + 30;
      } else {
        const pool = nextX < 2500 ? 3 : 4, t = Math.floor(rnd() * pool), hw = OBS[t].hw;
        ents.push({ k: "o", t, wx: x0 + hw, y: 0 }); right = x0 + 2 * hw;
        if (rnd() < 0.3) for (let i = -1; i <= 1; i++) ents.push({ k: "p", t: 0, wx: x0 + hw + i * 40, y: i ? 135 : 152 });   // an arc of berries over it
      }
      const gap = Math.max(v * gapTime(nextX) * (0.85 + rnd() * 0.4), v * RUSH * 0.72 + 40);   // always room to land and jump again, even in a rush
      const gx = right + gap / 2, r2 = rnd();
      if (nextX >= 6000 && nextX - lastCandy > 5000 && r2 < 0.16) { ents.push({ k: "p", t: 2, wx: gx, y: 18 }); lastCandy = nextX; }
      else if (r2 < 0.55) { const n = 3 + Math.floor(rnd() * 3); for (let i = 0; i < n; i++) ents.push({ k: "p", t: 0, wx: gx + (i - (n - 1) / 2) * 36, y: 22 }); }
      else if (r2 < 0.65) ents.push({ k: "p", t: 1, wx: gx, y: 115 });
      nextX = right + gap;
    };

    let speed = baseSpeed(0, free), level = 1;          // speed eases toward each level's target
    let d = 0, ms = 0, y = 0, vy = 0, onGround = true, fast = false, slideUntil = -1, duckHeld = false, duckOnLand = false, jumpBuf = -1;
    let hearts = HEARTS, invUntil = -1, rushUntil = -1, heavyUntil = -1, pts = 0, picks = 0, berries = 0, lastHit = -1, lastHitSugar = false;
    let started = false, ended = false, raf = 0, last = performance.now(), lastHud = 0, realStart = 0, duckHintShown = false;
    const segs: ("ok" | "candy" | "hit")[] = [];
    const mark = (s: "candy" | "hit") => { const i = Math.floor(d / PXM / SEG_M); while (segs.length <= i) segs.push("ok"); if (segs[i] !== "hit") segs[i] = s; };
    const floats: { x: number; y: number; text: string; color: string; age: number; big?: boolean }[] = [];
    const float = (text: string, color: string, x = PX, fy = GY - y - 70, big = false) => floats.push({ x, y: fy, text, color, age: 0, big });
    setStarted(false); setOver(false); setResult(null); setToast(null); setHud({ score: 0, status: "run" }); resetScores();

    const isHeavy = () => ms >= rushUntil && ms < heavyUntil;
    const status = (): Status => (ms < rushUntil ? "rush" : isHeavy() ? "heavy" : "run");
    const score = () => Math.floor(d / PXM) + pts;
    const jump = () => { jumpBuf = ms; };
    const duck = () => { if (onGround) slideUntil = ms + SLIDE_MS; else { fast = true; duckOnLand = true; } };

    const finish = () => {
      ended = true;
      const o = lastHit >= 0 ? OBS[lastHit] : null, pickFact = (f: string[]) => f[Math.floor(Math.random() * f.length)];
      // one fact, after the run, about what ended it
      if (lastHitSugar) setToast({ title: isHeavy() ? "Why your legs felt heavy: candy" : "Caught out after candy", body: pickFact(CANDY_FACTS), img: "1f36c" });
      else if (o) setToast({ title: o.title, body: pickFact(o.facts), img: o.code });
      const sc = score(), meters = Math.floor(d / PXM);
      mark("hit");
      const squares = segs.slice(0, 20).map(s => (s === "hit" ? "🟥" : s === "candy" ? "🟨" : "🟩")).join("") + (segs.length > 20 ? "+" : "");
      setHud({ score: sc, status: status() });
      setResult({ meters, berries, squares, level }); setOver(true);
      if (sc > readBest(bestKey)) { saveBest(bestKey, sc); setBest(sc); }
      shell.finishRef.current({ score: sc, drops: picks, ms: performance.now() - realStart });
    };

    const step = (dt: number) => {                 // one slice of the run, at most 17ms
      while (nextX < d + W + 200) gen();
      while (ents.length && ents[0].done && (ents[0].knocked === undefined || ms - ents[0].knocked > 1000)) ents.shift();
      const goal = baseSpeed(d, free); speed += Math.max(-90, Math.min(90, goal - speed)) * Math.min(1, dt / 400);
      if (levelAt(d) > level) {
        const faster = baseSpeed(d, free) > baseSpeed((level - 1) * LEVEL_PX, free); level = levelAt(d);
        float(faster ? `Level ${level} · Faster!` : `Level ${level}!`, "#2eaa6e", W / 2, HUD + 120, true);
      }
      const v = speed * (ms < rushUntil ? RUSH : 1), heavy = isHeavy();
      d += (v * dt) / 1000; ms += dt;
      if (jumpBuf >= 0 && ms - jumpBuf > 150) jumpBuf = -1;   // a tap just before landing still counts
      if (jumpBuf >= 0 && onGround) { vy = JUMP_V * (heavy ? HEAVY_JUMP : 1); onGround = false; slideUntil = -1; jumpBuf = -1; }
      if (!onGround) {
        vy -= (G * (fast ? FAST_FALL : 1) * dt) / 1000; y += (vy * dt) / 1000;
        if (y <= 0) { y = 0; vy = 0; onGround = true; fast = false; if (duckOnLand) { slideUntil = ms + SLIDE_MS; duckOnLand = false; } }
      }
      const ducking = onGround && (ms < slideUntil || duckHeld), ph = ducking ? DUCK_H : STAND_H;
      for (const e of ents) {
        if (e.done) continue;
        const sx = e.wx - d + PX;
        if (sx < -60) { e.done = true; continue; }
        if (sx > PX + 100) break;   // arc berries sit just behind their obstacle in the list
        if (e.k === "o") {
          const o = OBS[e.t]; if (Math.abs(sx - PX) >= o.hw + PHW) continue;
          const hit = o.air ? y < o.hi! && y + ph > o.lo! : y < o.h!;
          if (hit && ms >= invUntil) {
            e.done = true; e.knocked = ms; hearts--; invUntil = ms + INV_MS; lastHit = e.t; lastHitSugar = ms < heavyUntil; mark("hit");
            float(hearts > 0 ? "Ouch!" : "Out of hearts", "#e8505b");
            if (hearts <= 0) { finish(); return; }
          }
        } else {
          if (Math.hypot(sx - PX, e.y - (y + ph / 2)) < PICK_R) {
            const p = PICKS[e.t]; e.done = true; picks++; pts += p.pts;
            if (e.t === 0) { berries++; float(`+${p.pts}`, "#4a5fc1", PX + 10, GY - e.y - 24); }
            else if (e.t === 1) float(`+${p.pts}`, "#3f7fd6", PX + 10, GY - e.y - 24);
            else { rushUntil = ms + RUSH_MS; heavyUntil = rushUntil + HEAVY_MS; mark("candy"); float("Sugar rush!", "#b54bd1", W / 2, HUD + 80, true); }
          }
        }
      }
      if (ms >= rushUntil && ms - dt < rushUntil && heavyUntil > ms) float("Heavy legs...", "#e09a00", W / 2, HUD + 80, true);
      if (!duckHintShown) { const a = ents.find(e => !e.done && e.k === "o" && OBS[e.t].air); if (a && a.wx - d + PX < W - 10) { duckHintShown = true; float("Swipe down to duck!", "#3f7fd6", W / 2, HUD + 80, true); } }
    };

    // input: tap jumps, a swipe down ducks. A tap fires on release, or after 80ms if the finger hasn't moved down.
    let ptr: { id: number; y0: number; t0: number; jumped: boolean; ducked: boolean } | null = null;
    const start = () => { if (started || ended) return; started = true; realStart = performance.now(); last = realStart; setStarted(true); };
    startRef.current = start;
    const live = () => started && !ended && !pausedRef.current;
    const onDown = (e: PointerEvent) => {
      if (pausedRef.current || ended) return;
      if (!started) { start(); return; }
      ptr = { id: e.pointerId, y0: e.clientY, t0: performance.now(), jumped: false, ducked: false };
    };
    const onMove = (e: PointerEvent) => {
      if (!ptr || e.pointerId !== ptr.id || !live()) return;
      const dy = e.clientY - ptr.y0;
      if (dy > 16 && !ptr.ducked) { ptr.ducked = true; duck(); }
      else if (dy < -12 && !ptr.jumped && !ptr.ducked) { ptr.jumped = true; jump(); }
    };
    const onUp = (e: PointerEvent) => { if (ptr && e.pointerId === ptr.id && !ptr.jumped && !ptr.ducked && live()) jump(); ptr = null; };
    const onCancel = () => { ptr = null; };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "Enter") { e.preventDefault(); if (pausedRef.current || e.repeat) return; if (!started) start(); else if (live()) jump(); }
      else if (e.key === "ArrowDown" || e.key === "s") { e.preventDefault(); if (live() && !duckHeld) { duckHeld = true; duck(); } }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === "ArrowDown" || e.key === "s") duckHeld = false; };
    wrap.addEventListener("pointerdown", onDown); wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerup", onUp); wrap.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKeyUp);

    const loop = (t: number) => {
      const dt = Math.max(0, Math.min(50, t - last)); last = t;   // frame times can land just before start()
      if (live()) {
        if (ptr && !ptr.jumped && !ptr.ducked && t - ptr.t0 > 80) { ptr.jumped = true; jump(); }
        for (let left = dt; left > 0 && !ended; left -= 17) step(Math.min(17, left));
        if (!ended && t - lastHud > 100) { lastHud = t; setHud({ score: score(), status: status() }); }
      } else if (pausedRef.current) ptr = null;
      for (let k = floats.length - 1; k >= 0; k--) { floats[k].age += dt; if (floats[k].age > (floats[k].big ? 1600 : 700)) floats.splice(k, 1); }
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    function draw(t: number) {
      ctx.save(); ctx.clearRect(0, 0, W, H);
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, 22); ctx.clip();
      const st = status();

      // the kitchen: wall, a window, tiles, then the counter and cupboards
      const g = ctx.createLinearGradient(0, 0, 0, GY); g.addColorStop(0, "#fff8ee"); g.addColorStop(1, "#ffefdc");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, GY);
      const wp = 700, wx0 = -((d * 0.25) % wp) + 260;
      for (let x = wx0 - wp; x < W + wp; x += wp) {
        ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.roundRect(x - 6, 96, 142, 132, 10); ctx.fill();
        ctx.fillStyle = "#dcebff"; ctx.beginPath(); ctx.roundRect(x, 102, 130, 120, 6); ctx.fill();
        ctx.fillStyle = "#ffffff"; ctx.fillRect(x + 62, 102, 6, 120); ctx.fillRect(x, 159, 130, 6);
      }
      const ty = GY - 150, ts = 36, tx0 = -((d * 0.6) % ts);
      ctx.fillStyle = "#fbe6cf"; ctx.fillRect(0, ty, W, GY - ty);
      ctx.strokeStyle = "rgba(16,27,46,0.06)"; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let x = tx0; x < W; x += ts) { ctx.moveTo(x, ty); ctx.lineTo(x, GY); }
      for (let yy = ty; yy < GY; yy += ts) { ctx.moveTo(0, yy); ctx.lineTo(W, yy); }
      ctx.stroke();
      ctx.fillStyle = "#d9a46c"; ctx.fillRect(0, GY, W, 14);
      ctx.fillStyle = "#e9bd8a"; ctx.fillRect(0, GY, W, 3);
      ctx.fillStyle = "#f6e3c8"; ctx.fillRect(0, GY + 14, W, H - GY - 14);
      const dp = 130, dx0 = -(d % dp);
      for (let x = dx0; x < W + dp; x += dp) {
        ctx.strokeStyle = "rgba(16,27,46,0.10)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x + 8, GY + 26, dp - 16, H - GY - 18, 8); ctx.stroke();
        ctx.fillStyle = "#c79a68"; ctx.beginPath(); ctx.arc(x + dp - 22, GY + 58, 4, 0, Math.PI * 2); ctx.fill();
      }

      // things on the counter and in the air
      for (const e of ents) {
        const sx = e.wx - d + PX;
        if (sx > W + 100) break;
        if (sx < -50) continue;
        if (e.k === "o") {
          const o = OBS[e.t], img = obsImg[e.t];
          let cy = o.air ? GY - (o.lo! + o.hi!) / 2 : GY - o.size / 2 + 3, rot = 0, alpha = 1;
          if (e.knocked !== undefined) {                 // bumped things tumble off the back of the counter
            const k = (ms - e.knocked) / 1000; cy -= 260 * k - 600 * k * k; rot = k * 8; alpha = Math.max(0, 1 - k * 1.5);
            if (alpha <= 0) continue;
          } else if (e.done) continue;
          if (o.code === "1f41d") cy += Math.sin(t / 120 + e.wx) * 2;
          if (o.code === "1f944") rot += -Math.PI / 4 + Math.sin(t / 140) * 0.15;   // the spoon flies flat, bowl first
          if (!o.air && e.knocked === undefined) { ctx.fillStyle = "rgba(16,27,46,0.10)"; ctx.beginPath(); ctx.ellipse(sx, GY + 2, o.hw + 6, 4, 0, 0, Math.PI * 2); ctx.fill(); }
          ctx.save(); ctx.globalAlpha = alpha; ctx.translate(sx, cy); ctx.rotate(rot);
          if (img.complete) ctx.drawImage(img, -o.size / 2, -o.size / 2, o.size, o.size);
          ctx.restore();
        } else if (!e.done) {
          const p = PICKS[e.t], img = pickImg[e.t], cy = GY - e.y + (e.t === 0 ? 0 : Math.sin(t / 200 + e.wx) * 3);
          if (e.t === 2) { ctx.fillStyle = "rgba(181,75,209,0.16)"; ctx.beginPath(); ctx.arc(sx, cy, p.size * 0.62, 0, Math.PI * 2); ctx.fill(); }
          if (img.complete) ctx.drawImage(img, sx - p.size / 2, cy - p.size / 2, p.size, p.size);
        }
      }

      // the strawberry
      const ducking = onGround && (ms < slideUntil || duckHeld), blink = ms < invUntil && Math.floor(t / 90) % 2 === 0;
      ctx.fillStyle = "rgba(16,27,46,0.13)"; ctx.beginPath(); ctx.ellipse(PX, GY + 2, Math.max(8, 20 - y * 0.08), 4, 0, 0, Math.PI * 2); ctx.fill();
      if (st === "rush" && started && !ended) {
        ctx.strokeStyle = "rgba(181,75,209,0.45)"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath();
        for (let i = 0; i < 3; i++) { const ly = GY - y - 14 - i * 13, off = (t / 3 + i * 23) % 30; ctx.moveTo(PX - 30 - off, ly); ctx.lineTo(PX - 52 - off, ly); }
        ctx.stroke();
      }
      ctx.save(); ctx.globalAlpha = blink ? 0.35 : 1;
      const S = 58, bob = onGround && !ducking && started && !ended ? Math.abs(Math.sin(t / 90)) * 2.5 : 0;
      ctx.translate(PX, GY - y - bob);
      if (ducking) ctx.scale(1.25, 0.55);
      else if (!onGround) ctx.rotate(Math.max(-0.3, Math.min(0.3, -vy / 2600)));
      else ctx.rotate(Math.sin(t / 90) * 0.05);
      if (berryImg.complete) ctx.drawImage(berryImg, -S / 2, -S + 4, S, S);
      ctx.restore();
      if (st === "heavy") {                            // heavy legs: little sweat drops
        ctx.fillStyle = "#7fb2ef";
        for (let i = 0; i < 2; i++) { const a = ((t / 500 + i * 0.5) % 1); ctx.globalAlpha = 1 - a; ctx.beginPath(); ctx.arc(PX + 22 + i * 6, GY - y - 48 + a * 18, 3, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
      }

      // HUD: hearts, the rush or heavy timer, distance
      ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(0, 0, W, HUD);
      for (let i = 0; i < HEARTS; i++) heart(ctx, 26 + i * 26, 12, 20, i < hearts);
      ctx.fillStyle = "#101b2e"; ctx.font = "700 20px system-ui, -apple-system, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
      ctx.fillText(`${Math.floor(d / PXM).toLocaleString()} m`, W - 16, 29);
      const mw = ctx.measureText(`${Math.floor(d / PXM).toLocaleString()} m`).width;
      ctx.font = "700 14px system-ui, -apple-system, sans-serif"; ctx.fillStyle = "#2eaa6e"; ctx.fillText(`Lv ${level}`, W - 26 - mw, 28);
      if (st !== "run") {
        const left = st === "rush" ? (rushUntil - ms) / RUSH_MS : (heavyUntil - ms) / HEAVY_MS, bx = 120, bw = 140;
        ctx.fillStyle = "rgba(16,27,46,0.08)"; ctx.beginPath(); ctx.roundRect(bx, 26, bw, 8, 4); ctx.fill();
        ctx.fillStyle = STATUS_COLOR[st]; ctx.beginPath(); ctx.roundRect(bx, 26, Math.max(8, bw * left), 8, 4); ctx.fill();
        ctx.font = "700 12px system-ui, -apple-system, sans-serif"; ctx.textAlign = "center"; ctx.fillText(STATUS_LABEL[st], bx + bw / 2, 20);
      }

      ctx.textAlign = "center";
      for (const f of floats) {
        const life = f.big ? 1600 : 700, a = 1 - f.age / life;
        ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.6)); ctx.fillStyle = f.color;
        ctx.font = `800 ${f.big ? 24 : 16}px system-ui, -apple-system, sans-serif`;
        ctx.fillText(f.text, f.x, f.y - (f.big ? 0 : f.age * 0.05));
      }
      ctx.globalAlpha = 1; ctx.restore();
    }

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); stop();
      wrap.removeEventListener("pointerdown", onDown); wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerup", onUp); wrap.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp);
    };
  }, [mode, run, bestKey]);

  const n = dailyNumber(LAUNCH);
  const headline = !result ? "" : `Level ${result.level} · ${result.meters.toLocaleString()} m 🍓`;
  const share = () => {
    if (!result) return;
    // Wordle-style: one square per 250 m, green when clean, yellow for a sugar rush, red where you got bumped
    const label = mode === "daily" ? `Berry Dash #${n} (Today's Challenge)` : "Berry Dash (Free Play)";
    const p = shell.scores.posted;
    const rank = p?.rank ? `\n🏆 #${p.rank} of ${p.total} ${mode === "daily" ? "today" : "this week"}` : "";
    shell.share(`${label}\n${hud.score.toLocaleString()} pts · Level ${result.level} · 🍓 ${result.meters.toLocaleString()} m · 🫐 ${result.berries}${rank}\n${result.squares}\nCan you beat it? whatyouate.app/games/berry-dash`);
  };

  return (
    <GameScreen>
      <GameHeader title="Berry Dash" mode={mode} onMode={m => { setMode(m); setRun(r => r + 1); }} onBoard={() => shell.setBoardOpen(true)} onHelp={shell.help.show} />

      <div className="mt-2 flex items-center justify-between">
        <div><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Score</div><div className="text-2xl font-bold leading-none tabular-nums">{hud.score.toLocaleString()}</div></div>
        <div className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: STATUS_COLOR[hud.status] }}>{STATUS_LABEL[hud.status]}</div>
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
              <span className="block text-lg font-bold">Tap to start</span>
              <span className="mt-1 block text-sm text-[#5a6b85]">Tap to jump, swipe down to duck</span>
            </span>
          </button>
        )}
        {over && <GameOver label={mode === "daily" ? `Today's Challenge #${n}` : "Free Play"} headline={headline} score={hud.score} best={best} mode={mode}
          posted={shell.scores.posted} joined={!!shell.player} campaign={GAME} copied={shell.copied} fact={toast}
          pitch="Real snacks keep you going too. WhatYouAte shows you which ones work for you."
          onBoard={() => shell.setBoardOpen(true)} onJoin={() => shell.setJoinOpen(true)} onAgain={() => setRun(r => r + 1)} onShare={share} />}
      </BoardArea>

      <ShellPopups shell={shell} game={GAME} todayNote="Today's Challenge: same counter for everyone. Resets at midnight." />

      {shell.help.open && (
        <HelpModal onClose={shell.help.close} steps={[
          "Tap to jump over things on the counter.",
          "Swipe down to duck under anything flying at you.",
          "Grab blueberries and water for points. Candy gives a sugar rush, then heavy legs that make your jumps smaller.",
          "Three bumps and your run is over. Every 400 m is a new level, and a little faster.",
        ]}>
          <div className="mt-3 space-y-1 rounded-2xl bg-[#f0f6fe] p-2.5 text-xs font-semibold text-[#5a6b85]">
            <Row codes={OBS.filter(o => !o.air).map(o => o.code)} label="Jump" />
            <Row codes={OBS.filter(o => o.air).map(o => o.code)} label="Duck" />
            <Row codes={["1fad0", "1f4a7", "1f36c"]} label="5, 15 and 10 points" />
          </div>
          <ModesHelp today="everyone runs the same counter today. Go as far as you can." free="a new counter every run, and it keeps getting faster." />
        </HelpModal>
      )}
    </GameScreen>
  );
}
