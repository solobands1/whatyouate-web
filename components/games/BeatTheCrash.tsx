"use client";

// Beat The Crash: keep your energy steady from 7am to 10pm. Foods fall; drag left and right to eat them. Real food
// releases energy slowly; sugar gives a quick lift, then a crash a few seconds later that costs one of 3 hearts.
// Two clear ways to lose: run out of hearts (too much sugar) or let energy hit zero (fall asleep). Energy drains
// faster in the afternoon slump (2 to 4pm). Points build while energy sits in the green, faster on a streak of
// real food; eating when already full, or a sugar high, breaks the streak. No facts pop up mid-game (too
// distracting), and no strip under the board, so the board is bigger: the game-over card explains what ended your day. Balance was checked with simulated players:
// eating everything dies by mid-morning, doing nothing falls asleep before lunch, a careful player makes it to
// 10pm about half the time. "Today" gives everyone the same falling foods (seeded) and
// ends at 10pm; Free Play keeps going day after day, faster each time. Everything around the board comes from ./kit.
import { useEffect, useRef, useState } from "react";
import { type Mode, type Toast, GameScreen, GameHeader, BoardArea, GameOver, HelpModal, ModesHelp, ShellPopups,
  useGameShell, fitCanvas, loadImages, dailySeed, dailyNumber, torontoDate, mulberry32, readBest, saveBest, foodPng } from "./kit";

const GAME = "beat-the-crash";
const LAUNCH = "2026-11-08";   // Today's Challenge #1

type Kind = "steady" | "sugar" | "water";
type Food = { name: string; code: string; kind: Kind; facts: string[] };
const FOODS: Food[] = [
  { name: "Oatmeal", code: "1f963", kind: "steady", facts: ["Oats have a fibre called beta-glucan that slows digestion, so their energy comes in gradually.", "Steel-cut and rolled oats digest slower than instant oats.", "A cup of cooked oatmeal has about 4 grams of fibre."] },
  { name: "Egg", code: "1f95a", kind: "steady", facts: ["A large egg has about 6 grams of protein.", "Protein at breakfast helps you stay full longer.", "Brown and white eggs are the same inside. Shell colour comes from the breed of hen."] },
  { name: "Peanuts", code: "1f95c", kind: "steady", facts: ["Peanuts are legumes, not nuts. They're related to beans and peas.", "A small handful of peanuts has about 7 grams of protein.", "Pairing fruit with nuts slows down how fast the fruit's sugar hits."] },
  { name: "Banana", code: "1f34c", kind: "steady", facts: ["A medium banana has about 3 grams of fibre.", "Slightly green bananas have more resistant starch, which digests slower.", "A banana with peanut butter lasts longer than a banana on its own."] },
  { name: "Chicken", code: "1f357", kind: "steady", facts: ["A palm-sized piece of chicken has about 25 grams of protein.", "Protein digests slowly, so a meal with it keeps you going longer.", "Chicken thighs have a little more fat than breasts, which keeps them juicier."] },
  { name: "Beans", code: "1fad8", kind: "steady", facts: ["Beans have protein and fibre together, a combo that keeps you full for hours.", "A cup of cooked black beans has about 15 grams of fibre.", "Rinsing canned beans washes off a lot of the extra salt."] },
  { name: "Sweet Potato", code: "1f360", kind: "steady", facts: ["One medium sweet potato has more than a day's worth of vitamin A.", "Leave the skin on for extra fibre.", "Sweet potatoes and regular potatoes aren't closely related."] },
  { name: "Apple", code: "1f34e", kind: "steady", facts: ["Keep the skin on. That's where a lot of an apple's fibre is.", "A medium apple has about 4 grams of fibre.", "Apples float because about a quarter of an apple is air."] },
  { name: "Avocado", code: "1f951", kind: "steady", facts: ["Half an avocado has about 7 grams of fibre.", "The fat in avocado slows digestion, so a meal with it lasts longer.", "Avocado in a salad helps your body absorb more of the vitamins in the veggies."] },
  { name: "Salad", code: "1f957", kind: "steady", facts: ["Add protein like chicken, eggs or beans and a salad becomes a meal that lasts.", "More colours on the plate usually means a wider mix of nutrients.", "A little olive oil on a salad helps you absorb its vitamins A and K."] },
  { name: "Blueberries", code: "1fad0", kind: "steady", facts: ["A cup of blueberries has about 4 grams of fibre.", "Frozen blueberries keep their nutrients as well as fresh ones.", "Blueberries are pale green inside. All that blue is in the skin."] },
  { name: "Donut", code: "1f369", kind: "sugar", facts: ["A glazed donut is mostly refined flour and sugar. Both digest fast, which is the spike.", "A glazed donut has about 10 to 15 grams of sugar.", "Having a donut after a meal with protein softens the spike compared to eating it alone."] },
  { name: "Candy", code: "1f36c", kind: "sugar", facts: ["Candy is almost pure sugar, so it hits fast and wears off fast.", "A big review of studies found sugar doesn't lift your mood, and people felt more tired within an hour."] },
  { name: "Soda", code: "1f964", kind: "sugar", facts: ["A can of regular soda has about 39 grams of sugar. That's around 10 teaspoons.", "Sugar in a drink hits faster than sugar in food, because there's nothing to slow it down."] },
  { name: "Cookie", code: "1f36a", kind: "sugar", facts: ["Most store-bought cookies are refined flour, sugar and butter: fast energy with little to hold it.", "A cookie with milk or nuts adds protein, which slows the sugar down a bit."] },
  { name: "Cupcake", code: "1f9c1", kind: "sugar", facts: ["A lot of a cupcake's sugar is in the frosting.", "Refined flour and sugar together digest fast. That's why sweets give a quick lift, then a slump."] },
  { name: "Lollipop", code: "1f36d", kind: "sugar", facts: ["A lollipop is basically pure sugar on a stick.", "Sucking on candy slowly keeps sugar on your teeth longer, which is harder on them."] },
  { name: "Water", code: "1f4a7", kind: "water", facts: ["Even mild dehydration can make you feel tired and foggy.", "Water has no calories, but being short on it can still drain your energy.", "Coffee and tea count toward your daily water too."] },
];
const OF_KIND = (k: Kind) => FOODS.flatMap((f, i) => (f.kind === k ? [i] : []));
const BY_KIND: Record<Kind, number[]> = { steady: OF_KIND("steady"), sugar: OF_KIND("sugar"), water: OF_KIND("water") };
const FACES = { asleep: "1f634", low: "1f971", steady: "1f60a", high: "1f92a" };

const W = 400, H = 600, HUD = 64;          // logical board; the top HUD strip shows the clock and energy bar
const PLAYER_Y = H - 112, PR = 30, FR = 26; // player and food radius
const GRIP_Y = H - 42;                      // the grip bar you drag along, below the face
const HEARTS = 3, SUGAR = 0.28;            // sugar's share of the food (eased in over the first hours of day 1)
const START = 7, END = 22, HOUR_MS = 5000; // the day runs 7am to 10pm, five seconds an hour
type Zone = "crash" | "low" | "steady" | "wired" | "high";
const zoneOf = (e: number): Zone => (e < 20 ? "crash" : e < 40 ? "low" : e <= 80 ? "steady" : e < 92 ? "wired" : "high");
const ZONE_LABEL: Record<Zone, string> = { crash: "Crashing!", low: "Running low", steady: "Steady", wired: "Wired", high: "Sugar high!" };
const ZONE_COLOR: Record<Zone, string> = { crash: "#e8505b", low: "#e09a00", steady: "#2eaa6e", wired: "#e09a00", high: "#b54bd1" };
const BAR: [number, number, string][] = [[0, 20, "#f9cfd2"], [20, 40, "#fde9b8"], [40, 80, "#c9eed6"], [80, 92, "#fde9b8"], [92, 100, "#efd0f5"]];
const SKY: [number, string, string][] = [[7, "#fff1dc", "#e8f1ff"], [11, "#eef5ff", "#d6e7ff"], [14, "#fff0e6", "#ffdcc9"], [16, "#eef5ff", "#d6e7ff"], [19, "#ffe3cf", "#c6d3f3"], [22, "#4a5c92", "#26315c"]];
function clock(h: number) { const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`; }
function mix(a: string, b: string, t: number) {
  const p = (s: string) => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)), x = p(a), y = p(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
}
function sky(h: number) {
  let i = 0; while (i < SKY.length - 2 && h >= SKY[i + 1][0]) i++;
  const [h0, a0, b0] = SKY[i], [h1, a1, b1] = SKY[i + 1], t = Math.max(0, Math.min(1, (h - h0) / (h1 - h0)));
  return [mix(a0, a1, t), mix(b0, b1, t)];
}

type Result = { kind: "done" | "asleep" | "sugar"; at: string; day: number; squares: string };
type Hud = { score: number; zone: Zone; mult: number };

export default function BeatTheCrash() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("daily");
  const [run, setRun] = useState(0);                 // bump to restart
  const [started, setStarted] = useState(false);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [hud, setHud] = useState<Hud>({ score: 0, zone: "steady", mult: 1 });
  const [best, setBest] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [board, setBoard] = useState({ w: 0, h: 0 });
  const shell = useGameShell(GAME, mode);
  const { reset: resetScores } = shell.scores;
  const pausedRef = useRef(false); pausedRef.current = shell.paused;   // popups pause the day
  const startRef = useRef<() => void>(() => {});
  const bestKey = mode === "daily" ? `beatthecrash-daily-${torontoDate()}` : "beatthecrash-endless";
  useEffect(() => { setBest(readBest(bestKey)); }, [bestKey]);

  useEffect(() => {
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const { ctx, toLocal, stop } = fitCanvas(canvas, wrap, W, H, setBoard, 0);   // no fact strip: the board gets the room
    const imgs = loadImages(FOODS.map(f => f.code)), faces = loadImages(Object.values(FACES));
    const rnd = mulberry32(mode === "daily" ? dailySeed(0x3c7a5) : Math.floor(Math.random() * 1e9));

    let energy = 62, gameMs = 0, total = 0, streak = 0, eaten = 0, day = 1, hydratedUntil = -1, nextSpawn = 700, hearts = HEARTS, lastSugar = -1;
    let px = W / 2, target = W / 2, keyDir = 0, started = false, ended = false, raf = 0, last = performance.now(), lastHud = 0, realStart = 0, slumpShown = false;
    const foods: { x: number; y: number; i: number; vy: number; spin: number }[] = [];
    const flows: { perMs: number; left: number }[] = [];               // energy arriving (or leaving) over time
    const crashes: { at: number; amount: number; food: number }[] = [];
    const floats: { x: number; y: number; text: string; color: string; age: number; big?: boolean }[] = [];
    let hours = Array.from({ length: END - START }, () => ({ steady: 0, ok: 0, bad: 0 }));
    const ate = new Map<number, number>();            // food -> times eaten, for the end-of-day fact
    setStarted(false); setOver(false); setResult(null); setToast(null); setHud({ score: 0, zone: "steady", mult: 1 }); resetScores();

    const progress = () => Math.min(1, gameMs / HOUR_MS / (END - START));
    const hourNow = () => START + gameMs / HOUR_MS;
    const mult = () => 1 + Math.min(streak, 10) * 0.2;
    const float = (text: string, color: string, x = px, y = PLAYER_Y - PR - 10, big = false) => floats.push({ x, y, text, color, age: 0, big });

    const spawn = () => {                              // three draws per food, in order, so "Today" is the same for everyone
      const p = progress(), r = rnd();
      const su = day > 1 ? SUGAR : SUGAR * Math.min(1, 0.55 + p * 1.8);
      const kind: Kind = r < 0.9 - su ? "steady" : r < 0.9 ? "sugar" : "water";
      const list = BY_KIND[kind], i = list[Math.floor(rnd() * list.length)];
      foods.push({ i, x: FR + 8 + rnd() * (W - 2 * FR - 16), y: HUD - FR, vy: (130 + 50 * p) * (1 + 0.15 * (day - 1)), spin: 0 });
      nextSpawn += (1100 - 330 * p) / (1 + 0.12 * (day - 1));
    };

    const eat = (i: number) => {
      const f = FOODS[i]; eaten++; ate.set(i, (ate.get(i) ?? 0) + 1);
      if (f.kind === "steady") {
        flows.push({ perMs: 20 / 3000, left: 3000 });
        if (energy >= 85) { if (streak >= 3) float("Too full! Streak lost", "#e09a00"); else float("Too full!", "#e09a00"); streak = 0; }   // overeating doesn't pay
        else { streak++; const pts = Math.round(5 * mult()); total += pts; float(`+${pts}`, "#2eaa6e"); }
      }
      else if (f.kind === "sugar") { energy += 24; crashes.push({ at: gameMs + 2500, amount: 28, food: i }); float("Sugar rush! Crash coming", "#b54bd1"); streak = 0; }
      else { energy += 5; hydratedUntil = gameMs + 5000; total += 10; float("Hydrated!", "#3f7fd6"); }
    };

    const squares = () => hours.map(h => { const all = h.steady + h.ok + h.bad; return all < 1 ? "⬜" : h.steady >= all * 0.6 ? "🟩" : h.bad > all * 0.3 ? "🟥" : "🟨"; }).join("");
    const pick = (f: Food) => f.facts[Math.floor(Math.random() * f.facts.length)];
    const finish = (kind: Result["kind"]) => {
      ended = true;
      if (kind === "done") { const bonus = 300 + Math.round(energy * 3) + 200 * hearts; total += bonus; float(`Made it! +${bonus}`, "#2eaa6e", W / 2, H / 2, true); }
      // one fact, after the game, about what decided it
      if (kind === "sugar" && lastSugar >= 0) setToast({ title: `Why you crashed: ${FOODS[lastSugar].name}`, body: pick(FOODS[lastSugar]), img: FOODS[lastSugar].code });
      else if (kind === "asleep") setToast({ title: "Why you crashed: running on empty", body: "Meals with protein and fibre digest slowly, so their energy lasts for hours instead of minutes.", img: "1f634" });
      else {
        const top = [...ate.entries()].filter(([i]) => FOODS[i].kind === "steady").sort((a, b) => b[1] - a[1])[0];
        if (top) setToast({ title: `Your top food: ${FOODS[top[0]].name}`, body: pick(FOODS[top[0]]), img: FOODS[top[0]].code });
      }
      const sc = Math.floor(total);
      setHud({ score: sc, zone: zoneOf(energy), mult: mult() });
      setResult({ kind, at: clock(Math.min(hourNow(), END)), day, squares: squares() }); setOver(true);
      if (sc > readBest(bestKey)) { saveBest(bestKey, sc); setBest(sc); }
      shell.finishRef.current({ score: sc, drops: eaten, ms: performance.now() - realStart });
    };

    const start = () => { if (started || ended) return; started = true; realStart = performance.now(); last = realStart; setStarted(true); };
    startRef.current = start;
    // relative drag: the face moves as far as your finger does, from wherever you put it down
    let dragFrom: { x: number; px: number } | null = null;
    const onDown = (e: PointerEvent) => { dragFrom = { x: toLocal(e.clientX), px: target }; if (!pausedRef.current) start(); };
    const onPoint = (e: PointerEvent) => { if (dragFrom) target = Math.max(PR, Math.min(W - PR, dragFrom.px + (toLocal(e.clientX) - dragFrom.x) * 1.15)); };
    const onUp = () => { dragFrom = null; };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") keyDir = -1; else if (e.key === "ArrowRight") keyDir = 1;
      else if ((e.key === " " || e.key === "Enter") && !pausedRef.current) start(); else return;
      e.preventDefault(); if (!pausedRef.current) start();
    };
    const onKeyUp = (e: KeyboardEvent) => { if ((e.key === "ArrowLeft" && keyDir < 0) || (e.key === "ArrowRight" && keyDir > 0)) keyDir = 0; };
    wrap.addEventListener("pointermove", onPoint); wrap.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp); window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKeyUp);

    const loop = (t: number) => {
      const dt = Math.max(0, Math.min(50, t - last)); last = t;   // frame times can land just before start()
      if (started && !ended && !pausedRef.current) {
        gameMs += dt;
        while (gameMs >= nextSpawn) spawn();
        for (let k = flows.length - 1; k >= 0; k--) { const f = flows[k], use = Math.min(dt, f.left); energy += f.perMs * use; f.left -= use; if (f.left <= 0) flows.splice(k, 1); }
        for (let k = crashes.length - 1; k >= 0; k--) if (gameMs >= crashes[k].at) {
          const c = crashes[k]; flows.push({ perMs: -c.amount / 800, left: 800 }); crashes.splice(k, 1);
          hearts--; lastSugar = c.food; float(hearts > 0 ? "💔 Sugar crash!" : "💔 Out of hearts", "#e8505b");
        }
        if (hearts <= 0) { finish("sugar"); }
        const h = hourNow(), p = progress(), slump = h >= 14 && h < 16;
        if (slump && !slumpShown) { slumpShown = true; float("😩 The 3pm slump!", "#e8505b", W / 2, HUD + 60, true); }
        const drain = (4.2 + 1.6 * p) * (slump ? 1.9 : 1) * (1 + 0.12 * (day - 1)) * (gameMs < hydratedUntil ? 0.55 : 1);
        energy = Math.max(0, Math.min(100, energy - (drain * dt) / 1000));
        const z = zoneOf(energy);
        if (z === "high") streak = 0;                  // a sugar high breaks the streak too
        total += ((z === "steady" ? 20 * mult() : z === "low" || z === "wired" ? 5 : 0) * dt) / 1000;   // most points come from staying steady
        const slot = hours[Math.min(hours.length - 1, Math.floor(h - START))];
        if (z === "steady") slot.steady += dt; else if (z === "low" || z === "wired") slot.ok += dt; else slot.bad += dt;

        target = Math.max(PR, Math.min(W - PR, target + keyDir * 0.45 * dt));
        px += (target - px) * Math.min(1, dt / 60);
        for (let k = foods.length - 1; k >= 0; k--) {
          const f = foods[k]; f.y += (f.vy * dt) / 1000; f.spin += dt / 900;
          if (Math.abs(f.x - px) < PR + FR - 6 && Math.abs(f.y - PLAYER_Y) < PR + FR - 8) { foods.splice(k, 1); eat(f.i); }
          else if (f.y > H + FR) foods.splice(k, 1);
        }
        if (ended) { /* out of hearts */ }
        else if (energy <= 0) finish("asleep");
        else if (hourNow() >= END) {
          if (mode === "daily") finish("done");
          else {
            day++; gameMs = 0; nextSpawn = 700; slumpShown = false; total += 300; hours = hours.map(() => ({ steady: 0, ok: 0, bad: 0 }));
            const back = hearts < HEARTS; hearts = Math.min(HEARTS, hearts + 1);   // a good night's sleep: one heart back
            float(`Day ${day}! +300${back ? " ❤️" : ""}`, "#2eaa6e", W / 2, H / 2, true);
          }
        }
        if (t - lastHud > 100) { lastHud = t; setHud({ score: Math.floor(total), zone: zoneOf(energy), mult: mult() }); }
      }
      for (let k = floats.length - 1; k >= 0; k--) { floats[k].age += dt; if (floats[k].age > (floats[k].big ? 2200 : 900)) floats.splice(k, 1); }
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    function draw(t: number) {
      const h = Math.min(hourNow(), END), night = h >= 19.5, z = zoneOf(energy);
      ctx.save(); ctx.clearRect(0, 0, W, H);
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, 22); ctx.clip();
      const [top, bottom] = sky(h), g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bottom);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      for (const f of foods) {
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(Math.sin(f.spin) * 0.25);
        ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.beginPath(); ctx.arc(0, 0, FR, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(16,27,46,0.08)"; ctx.lineWidth = 2; ctx.stroke();
        const s = FR * 1.6; if (imgs[f.i].complete) ctx.drawImage(imgs[f.i], -s / 2, -s / 2, s, s);
        ctx.restore();
      }

      // HUD: clock, day or goal, and the energy bar with its zones
      ctx.fillStyle = "rgba(255,255,255,0.82)"; ctx.fillRect(0, 0, W, HUD);
      ctx.fillStyle = "#101b2e"; ctx.font = "700 20px system-ui, -apple-system, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText(clock(h), 16, 27);
      const slump = h >= 14 && h < 16;
      ctx.font = "600 13px system-ui, -apple-system, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = slump ? "#e8505b" : "#5a6b85";
      ctx.fillText(slump ? "😩 Slump" : mode === "daily" ? "" : `Day ${day}`, W / 2 + 10, 25);
      ctx.font = "18px system-ui, -apple-system, sans-serif"; ctx.textAlign = "right";
      ctx.fillText(Array.from({ length: HEARTS }, (_, k) => (k < hearts ? "❤️" : "🤍")).join(""), W - 14, 27);
      const bx = 16, bw = W - 32, by = 38, bh = 14;
      for (const [a, b, c] of BAR) { ctx.fillStyle = c; ctx.fillRect(bx + (a / 100) * bw, by, ((b - a) / 100) * bw, bh); }
      ctx.strokeStyle = "rgba(16,27,46,0.12)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 7); ctx.stroke();
      const kx = bx + (energy / 100) * bw, warn = crashes.some(c => c.at - gameMs < 1500);
      ctx.fillStyle = "#fff"; ctx.strokeStyle = warn && Math.floor(t / 150) % 2 ? "#e8505b" : ZONE_COLOR[z]; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(kx, by + bh / 2, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      const jx = z === "high" ? Math.sin(t / 35) * 6 : 0;   // a sugar high makes you jittery
      const face = faces[energy <= 0 || z === "crash" ? 0 : z === "low" ? 1 : z === "high" || z === "wired" ? 3 : 2];
      ctx.fillStyle = "#fff"; ctx.strokeStyle = ZONE_COLOR[z]; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(px + jx, PLAYER_Y, PR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const fs = PR * 1.55; if (face.complete) ctx.drawImage(face, px + jx - fs / 2, PLAYER_Y - fs / 2, fs, fs);
      const next = crashes.reduce<number | null>((m, c) => (m === null || c.at < m ? c.at : m), null);
      if (next !== null) {                               // a sugar crash is coming: a red ring runs out around the face
        const left = Math.max(0, Math.min(1, (next - gameMs) / 2500));
        ctx.strokeStyle = "#e8505b"; ctx.lineWidth = 5; ctx.beginPath();
        ctx.arc(px + jx, PLAYER_Y, PR + 7, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = "rgba(16,27,46,0.08)"; ctx.beginPath(); ctx.roundRect(14, GRIP_Y - 9, W - 28, 18, 9); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(63,127,214,0.55)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(px - 34, GRIP_Y - 15, 68, 30, 15); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(63,127,214,0.6)";
      for (const dx of [-8, 0, 8]) { ctx.beginPath(); ctx.arc(px + dx, GRIP_Y, 2.5, 0, Math.PI * 2); ctx.fill(); }

      ctx.textAlign = "center";
      for (const f of floats) {
        const life = f.big ? 2200 : 900, a = 1 - f.age / life;
        ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.6)); ctx.fillStyle = f.big && night ? "#fff" : f.color;
        ctx.font = `800 ${f.big ? 26 : 17}px system-ui, -apple-system, sans-serif`;
        ctx.fillText(f.text, f.x, f.y - (f.big ? 0 : f.age * 0.05));
      }
      ctx.globalAlpha = 1; ctx.restore();
    }

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); stop();
      wrap.removeEventListener("pointermove", onPoint); wrap.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp);
    };
  }, [mode, run, bestKey]);

  const n = dailyNumber(LAUNCH);
  const why = !result ? "" : result.kind === "sugar" ? `Sugar crashed you at ${result.at} 💔` : `You fell asleep at ${result.at} 😴`;
  const headline = !result ? "" : result.kind === "done" ? "You made it to 10pm! 🌙" : mode === "daily" ? why : `Day ${result.day}: ${why}`;
  const share = () => {
    if (!result) return;
    // Wordle-style: one square per hour of the day, green when you stayed steady
    const label = mode === "daily" ? `Beat The Crash #${n} (Today's Challenge)` : "Beat The Crash (Free Play)";
    const p = shell.scores.posted;
    const rank = p?.rank ? `\n🏆 #${p.rank} of ${p.total} ${mode === "daily" ? "today" : "this week"}` : "";
    const how = result.kind === "done" ? "Made it to 10pm 🌙" : result.kind === "sugar" ? `Sugar crash at ${result.at} 💔` : `Fell asleep at ${result.at} 😴`;
    shell.share(`${label}\n${hud.score.toLocaleString()} pts · ${mode === "daily" ? "" : `Day ${result.day} · `}${how}${rank}\n${result.squares}\nCan you beat it? whatyouate.app/games/beat-the-crash`);
  };

  return (
    <GameScreen>
      <GameHeader title="Beat The Crash" mode={mode} onMode={m => { setMode(m); setRun(r => r + 1); }} onBoard={() => shell.setBoardOpen(true)} onHelp={shell.help.show} />

      <div className="mt-2 flex items-center justify-between">
        <div><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Score</div><div className="text-2xl font-bold leading-none tabular-nums">{hud.score.toLocaleString()}</div></div>
        <div className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: ZONE_COLOR[hud.zone] }}>
          {ZONE_LABEL[hud.zone]}{hud.zone === "steady" && hud.mult > 1 ? ` ×${hud.mult.toFixed(1)}` : ""}
        </div>
        <div className="text-right"><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Best</div><div className="text-lg font-semibold leading-none tabular-nums">{best.toLocaleString()}</div></div>
      </div>

      <BoardArea wrapRef={wrapRef} size={board} reserve={0}>
        <canvas ref={canvasRef} className="block rounded-[22px] shadow-[0_14px_40px_rgba(16,42,86,0.18)]" />
        {!started && !over && (
          <button onClick={() => startRef.current()} className="absolute inset-0 flex items-center justify-center rounded-[22px] bg-[#101b2e]/25">
            <span className="rounded-3xl bg-white px-6 py-4 text-center shadow-2xl">
              <span className="block text-lg font-bold">Tap to start</span>
              <span className="mt-1 block text-sm text-[#5a6b85]">Drag the bar at the bottom to move</span>
            </span>
          </button>
        )}
        {over && <GameOver label={mode === "daily" ? `Today's Challenge #${n}` : "Free Play"} headline={headline} score={hud.score} best={best} mode={mode}
          posted={shell.scores.posted} joined={!!shell.player} campaign={GAME} copied={shell.copied} fact={toast}
          pitch="Real meals work the same way. WhatYouAte shows you which ones keep your energy steady."
          onBoard={() => shell.setBoardOpen(true)} onJoin={() => shell.setJoinOpen(true)} onAgain={() => setRun(r => r + 1)} onShare={share} />}
      </BoardArea>

      <ShellPopups shell={shell} game={GAME} todayNote="Today's Challenge: same foods for everyone. Resets at midnight." />

      {shell.help.open && (
        <HelpModal onClose={shell.help.close} steps={[
          "Drag the bar at the bottom to move. Catch food to eat it.",
          "Real food keeps your energy up. Keep it in the green for the most points, and don't eat when you're full.",
          "Sugar gives a quick boost, then a crash that costs a ❤️. Lose all three and your day is over.",
          "Don't let your energy hit zero, and watch out for the 3pm slump.",
        ]}>
          <div className="mt-3 space-y-1 rounded-2xl bg-[#f0f6fe] p-2.5 text-xs font-semibold text-[#5a6b85]">
            {([["steady", "Steady energy"], ["sugar", "Boost, then a crash (costs a ❤️)"]] as [Kind, string][]).map(([k, label]) => (
              <div key={k} className="flex flex-wrap items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {BY_KIND[k].map(i => <img key={i} src={foodPng(FOODS[i].code)} alt={FOODS[i].name} className="h-[18px] w-[18px]" />)}
                <span className="ml-1">{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foodPng("1f4a7")} alt="Water" className="h-[18px] w-[18px]" /><span className="ml-1">Water slows the drain</span>
            </div>
          </div>
          <ModesHelp today="everyone gets the same foods today. Make it to 10pm." free="the days keep coming, and each one is faster." />
        </HelpModal>
      )}
    </GameScreen>
  );
}
