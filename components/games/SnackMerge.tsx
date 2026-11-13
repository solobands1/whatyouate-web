"use client";

// Snack Merge: a Suika-style merge game. Drop foods into the lunchbox; two of the same touching merge into the
// next food up the chain, ending at a Power Bowl. Scores come from merges (bigger foods are worth far more, and
// quick chains earn a combo bonus), so scores spread widely and ties are rare. "Today" gives everyone the same
// food sequence for the day (seeded), so the daily score compares skill on equal terms. Everything around the
// board (header, popups, scoreboard, game-over card, fact strip) comes from ./kit, shared with the other games.
import { useCallback, useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import { type Mode, type Toast, GameScreen, GameHeader, BoardArea, PrizeLogo, FactStrip, GameOver, HelpModal, ModesHelp, ShellPopups,
  useGameShell, fitCanvas, loadImages, dailySeed, dailyNumber, torontoDate, mulberry32, readBest, saveBest, foodPng, emoji, HUD_ROW, HudStat, HudTag, SoundButton } from "./kit";
import { sfx } from "./sfx";
import { useDuel } from "./duels";
import { type Burst, BURST_MS, drawBox, drawShadow, drawFood as paintFood, drawDangerLine, drawAim, drawBurst, warm } from "./art/snackMerge";

const GAME = "snack-merge";
type Food = { name: string; code: string; r: number; color: string; points: number; facts: string[] };   // 5 facts each, one picked at random
const FOODS: Food[] = [
  { name: "Blueberry", code: "1fad0", r: 15, color: "#dfe6ff", points: 1, facts: ["Frozen blueberries keep their nutrients as well as fresh ones.", "Blueberries are pale green inside. All that blue is in the skin.", "A cup of blueberries has about 4 grams of fibre.", "Wild blueberries are smaller than farmed ones and have a stronger flavour.", "Canada is one of the world's biggest growers of wild blueberries."] },
  { name: "Cherry", code: "1f352", r: 21, color: "#ffe1e4", points: 3, facts: ["Tart cherries naturally contain melatonin, the hormone that helps you sleep.", "Cherries don't ripen after they're picked, so buy them ripe.", "A cup of sweet cherries has about 3 grams of fibre.", "Don't chew cherry pits. They hold a compound that can release cyanide when crushed.", "Cherries are in the same plant family as roses, almonds and peaches."] },
  { name: "Strawberry", code: "1f353", r: 28, color: "#ffe4e1", points: 6, facts: ["The average strawberry has about 200 seeds on the outside.", "Gram for gram, strawberries have more vitamin C than oranges.", "Strawberries don't ripen after they're picked, so pick the reddest ones.", "Botanically, strawberries aren't berries. Bananas are.", "Wash strawberries right before you eat them. Washing them early makes them go mouldy faster."] },
  { name: "Egg", code: "1f95a", r: 35, color: "#fff3df", points: 10, facts: ["Brown and white eggs are the same inside. Shell colour just comes from the breed of hen.", "A large egg has about 6 grams of protein.", "A fresh egg sinks in water. An old one floats because its air pocket has grown.", "Yolk colour comes from what the hen eats, not how healthy the egg is.", "Older eggs are easier to peel once they're hard-boiled."] },
  { name: "Kiwi", code: "1f95d", r: 43, color: "#e8f6dc", points: 15, facts: ["You can eat kiwi skin. It's fuzzy, but it holds a lot of the fibre.", "Two kiwis have more vitamin C than a large orange.", "Kiwis used to be called Chinese gooseberries.", "Kiwi has an enzyme that breaks down protein, so it can tenderise meat in a marinade.", "Put a hard kiwi in a bag with an apple or banana and it ripens faster."] },
  { name: "Tomato", code: "1f345", r: 52, color: "#ffe2dc", points: 21, facts: ["Cooked tomato, like pasta sauce, gives you more lycopene than raw.", "Botanically, a tomato is a fruit.", "Keep tomatoes on the counter, not in the fridge. The cold dulls their flavour.", "Tomatoes are about 95% water.", "Tomatoes are in the same plant family as potatoes and peppers."] },
  { name: "Apple", code: "1f34e", r: 61, color: "#ffe0e0", points: 28, facts: ["Apples float because about a quarter of an apple is air.", "Keep the skin on. That's where a lot of an apple's fibre is.", "Apples give off a gas that makes other fruit near them ripen faster.", "A medium apple has about 4 grams of fibre.", "Apples are in the rose family."] },
  { name: "Avocado", code: "1f951", r: 71, color: "#eaf5dd", points: 36, facts: ["Avocados only ripen after they're picked. A paper bag with a banana speeds it up.", "Botanically, an avocado is a berry with one big seed.", "Avocado in a salad helps your body absorb more of the vitamins in the veggies.", "Half an avocado has about 7 grams of fibre.", "A squeeze of lime or lemon slows down cut avocado turning brown."] },
  { name: "Broccoli", code: "1f966", r: 82, color: "#e2f4e4", points: 45, facts: ["A cup of broccoli has about as much vitamin C as an orange.", "Broccoli stems are just as good to eat. Peel them and slice them thin.", "Steaming broccoli keeps more vitamin C than boiling it.", "Broccoli, cauliflower, cabbage and kale are all the same plant species, bred differently.", "A cup of raw broccoli has about 2.5 grams of protein."] },
  { name: "Pineapple", code: "1f34d", r: 94, color: "#fff4d6", points: 55, facts: ["Pineapple has an enzyme that breaks down protein. That's why it makes your mouth tingle.", "A pineapple plant takes about two years to grow one pineapple.", "Pineapples don't get any sweeter after they're picked.", "A pineapple is actually lots of small fruits fused together.", "Canned pineapple doesn't tingle. Heating it switches off the enzyme."] },
  { name: "Power Bowl", code: "1f957", r: 108, color: "#e3efff", points: 66, facts: ["Protein plus fibre is the combo that keeps your energy steady for hours.", "Beans and lentils add protein and fibre to a bowl at the same time.", "More colours on the plate usually means a wider mix of nutrients.", "Whole grains like brown rice and quinoa digest slower than white rice, so energy lasts longer.", "A palm-sized portion of protein is an easy guide for one meal."] },
];
const SPAWN_LEVELS = 5;                 // only the five smallest foods are ever dropped
const W = 400, H = 600, TOP = 90;       // logical box size; foods above TOP for too long end the game
const COMBO_WINDOW = 1200;              // ms between merges to keep a combo going


export default function SnackMerge() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("daily");
  const [run, setRun] = useState(0);                 // bump to restart
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [next, setNext] = useState(0);
  const [over, setOver] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [combo, setCombo] = useState(0);
  const [top, setTop] = useState(4);                   // highest food reached this run, for the share message
  const [board, setBoard] = useState({ w: 0, h: 0 });
  const shell = useGameShell(GAME, mode);
  const duel = useDuel(shell, GAME, "Snack Merge", mode, () => { if (mode !== "daily") { setMode("daily"); setRun(r => r + 1); } });   // Friend Duels
  const { reset: resetScores } = shell.scores;
  const bestKey = mode === "daily" ? `snackmerge-daily-${torontoDate()}` : "snackmerge-endless";
  useEffect(() => { setBest(readBest(bestKey)); }, [bestKey]);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const { ctx, toLocal, stop } = fitCanvas(canvas, wrap, W, H, setBoard);
    const imgs = loadImages(FOODS.map(f => f.code));
    const seed = mode === "daily" ? dailySeed() : Math.floor(Math.random() * 1e9);
    const rnd = mulberry32(seed);
    const pick = () => Math.floor(rnd() * SPAWN_LEVELS);

    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1.1 } });
    const wall = { isStatic: true, friction: 0.4, restitution: 0.1, render: { visible: false } };
    Matter.Composite.add(engine.world, [
      Matter.Bodies.rectangle(W / 2, H + 30, W + 200, 60, wall),
      Matter.Bodies.rectangle(-30, H / 2, 60, H * 2, wall),
      Matter.Bodies.rectangle(W + 30, H / 2, 60, H * 2, wall),
    ]);
    const level = new Map<number, number>();         // body id -> food level
    const born = new Map<number, number>();          // body id -> time added
    let current = pick(), upcoming = pick(), aimX = W / 2, canDrop = true, total = 0, ended = false;
    let lastMerge = 0, chain = 0, aboveSince = 0, raf = 0, drops = 0; const started = performance.now();
    const bursts: Burst[] = [], popAt = new Map<number, number>();   // merge bursts, and when each merged food appeared (art only)
    const seen = new Set<number>([0, 1, 2, 3, 4]);   // foods you can drop don't need an introduction
    let reached = 4; setTop(4);
    setNext(upcoming); setScore(0); setOver(false); setCombo(0); setToast(null); resetScores();

    const addFood = (lv: number, x: number, y: number) => {
      const f = FOODS[lv];
      const b = Matter.Bodies.circle(x, y, f.r, { restitution: 0.12, friction: 0.35, frictionAir: 0.004, density: 0.0012 + lv * 0.0001 });
      level.set(b.id, lv); born.set(b.id, performance.now()); Matter.Composite.add(engine.world, b); return b;
    };

    Matter.Events.on(engine, "collisionStart", e => {
      for (const { bodyA, bodyB } of e.pairs) {
        const a = level.get(bodyA.id), b = level.get(bodyB.id);
        if (a === undefined || b === undefined || a !== b) continue;
        if (!engine.world.bodies.includes(bodyA) || !engine.world.bodies.includes(bodyB)) continue;
        const x = (bodyA.position.x + bodyB.position.x) / 2, y = (bodyA.position.y + bodyB.position.y) / 2;
        Matter.Composite.remove(engine.world, [bodyA, bodyB]); level.delete(bodyA.id); level.delete(bodyB.id);
        const now = performance.now();
        chain = now - lastMerge < COMBO_WINDOW ? chain + 1 : 0; lastMerge = now; setCombo(chain);
        setTimeout(() => { if (performance.now() - lastMerge >= COMBO_WINDOW) setCombo(0); }, COMBO_WINDOW + 50);   // badge clears when the chain ends
        const mult = 1 + 0.25 * chain;                 // chains of quick merges are worth more
        bursts.push({ x, y, lv: Math.min(a + 1, FOODS.length - 1), age: 0, seed: (now * 1000) | 0 });
        // a pop that rises with the size of the new food, a chime on a combo, a sparkle for two Power Bowls
        if (a === FOODS.length - 1) sfx.play("bowl"); else { sfx.play("merge", { n: a + 1 }); if (chain > 0) sfx.play("combo", { n: chain }); }
        if (a === FOODS.length - 1) { total += Math.round(200 * mult); setScore(total); continue; }   // two Power Bowls: both clear, big bonus
        const nb = addFood(a + 1, x, y); Matter.Body.setVelocity(nb, { x: 0, y: -1.5 }); popAt.set(nb.id, now);
        if (a + 1 > reached) { reached = a + 1; setTop(reached); }
        total += Math.round(FOODS[a + 1].points * mult); setScore(total);
        if (!seen.has(a + 1)) { seen.add(a + 1); { const fs = FOODS[a + 1].facts; setToast({ title: `New: ${FOODS[a + 1].name}!`, body: fs[Math.floor(Math.random() * fs.length)], img: FOODS[a + 1].code }); } }
      }
    });

    const clampX = (x: number) => Math.max(FOODS[current].r + 2, Math.min(W - FOODS[current].r - 2, x));
    const onMove = (e: PointerEvent) => { aimX = clampX(toLocal(e.clientX)); };
    const onUp = (e: PointerEvent) => {
      if (ended || !canDrop) return;
      aimX = clampX(toLocal(e.clientX)); addFood(current, aimX, TOP - 40); drops++; sfx.play("drop");
      current = upcoming; upcoming = pick(); setNext(upcoming); canDrop = false;
      setTimeout(() => { canDrop = true; }, 550);
    };
    canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerdown", onMove); canvas.addEventListener("pointerup", onUp);

    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.max(0, Math.min(32, t - last)); last = t;
      if (!ended) Matter.Engine.update(engine, dt);
      // lose: a settled food stays above the line for 1.5s
      const settledAbove = engine.world.bodies.some(b => level.has(b.id) && t - (born.get(b.id) || 0) > 1200 && b.position.y - FOODS[level.get(b.id)!].r < TOP);
      if (!ended) {
        if (settledAbove) { aboveSince ||= t; if (t - aboveSince > 1500) { ended = true; sfx.play("over"); setOver(true); if (total > readBest(bestKey)) { saveBest(bestKey, total); setBest(total); } shell.finishRef.current({ score: total, drops, ms: t - started }); } }
        else aboveSince = 0;
      }
      // draw: the bento box, the line, the guide, shadows, then the foods in their cups and any merge bursts
      warm(ctx, W, H, FOODS, imgs);   // paints the box and every cup up front (and again only on a resize)
      ctx.clearRect(0, 0, W, H);
      drawBox(ctx, W, H);
      drawDangerLine(ctx, W, TOP, !!aboveSince, t);
      if (!ended) drawAim(ctx, aimX, TOP - 40 + FOODS[current].r, H);
      const foods = engine.world.bodies.filter(b => level.has(b.id));
      for (const b of foods) drawShadow(ctx, FOODS[level.get(b.id)!], b.position.x, b.position.y);
      for (const b of foods) {
        const lv = level.get(b.id)!, p = popAt.get(b.id);
        let s = 1;
        if (p !== undefined) { const k = (t - p) / 170; if (k >= 1) popAt.delete(b.id); else s = 0.8 + 0.2 * (1 - (1 - k) * (1 - k)); }   // pops up to size, never past it
        drawFood(lv, b.position.x, b.position.y, b.angle, 1, s);
      }
      if (!ended && canDrop) { drawShadow(ctx, FOODS[current], aimX, TOP - 40); drawFood(current, aimX, TOP - 40, 0, 1); }
      for (let k = bursts.length - 1; k >= 0; k--) { bursts[k].age += dt; if (bursts[k].age >= BURST_MS) bursts.splice(k, 1); else drawBurst(ctx, bursts[k], FOODS[bursts[k].lv].r); }
      raf = requestAnimationFrame(loop);
    };
    function drawFood(lv: number, x: number, y: number, ang: number, a: number, s = 1) { paintFood(ctx, lv, FOODS[lv], imgs[lv], x, y, ang, s, a); }
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); stop();
      canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerdown", onMove); canvas.removeEventListener("pointerup", onUp);
      Matter.Engine.clear(engine);
    };
  }, [mode, run, bestKey]);

  const share = () => {
    // Wordle-style: the food chain shows how far up you got, so friends can compare at a glance
    const label = mode === "daily" ? `Snack Merge #${dailyNumber("2026-11-01")} (Today's Challenge)` : "Snack Merge (Free Play)";
    const chain = FOODS.map((f, i) => i <= top ? emoji(f.code) : "⬜").join("");
    const p = shell.scores.posted;
    const rank = p?.rank ? `\n🏆 #${p.rank} of ${p.total} ${mode === "daily" ? "today" : "this week"}` : "";
    shell.share(`${label}\n${score.toLocaleString()} pts${rank}\n${chain}\nCan you beat it? whatyouate.app/games/snack-merge`);
  };

  return (
    <GameScreen>
      <GameHeader title="Snack Merge" mode={mode} onMode={m => { setMode(m); setRun(r => r + 1); }} onBoard={() => shell.setBoardOpen(true)} onHelp={shell.help.show} />

      <div className={HUD_ROW}>
        <HudStat label="Score" value={score.toLocaleString()} />
        <div className="flex min-w-0 flex-1 justify-center">{combo > 0 && <HudTag color="#22A964"><span className="max-[409px]:hidden">Combo </span>×{combo + 1}</HudTag>}</div>
        <div className="flex shrink-0 items-center gap-1.5">
          <HudStat label="Best" value={best.toLocaleString()} align="right" />
          <div className="wk-hud flex h-[38px] items-center gap-1.5 pl-2.5 pr-1">
            <span className="wk-hud-label">Next</span>
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] bg-white shadow-[inset_0_-2px_0_#d3e0f4]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foodPng(FOODS[next].code)} alt={FOODS[next].name} className="h-6 w-6" />
            </span>
          </div>
          <SoundButton />
        </div>
      </div>

      <BoardArea wrapRef={wrapRef} size={board}>
        {/* a linen napkin under the lunchbox, peeking out round its bottom edge */}
        <div aria-hidden className="pointer-events-none absolute -inset-x-[7px] -bottom-[9px] top-[40%] rounded-[24px]"
          style={{ background: "repeating-linear-gradient(0deg, rgba(120,96,64,0.07) 0 1px, rgba(255,255,255,0) 1px 3px), repeating-linear-gradient(90deg, rgba(120,96,64,0.06) 0 1px, rgba(255,255,255,0.05) 1px 3px), linear-gradient(180deg, #f1e8d8 0%, #e6dac4 100%)",
            boxShadow: "0 10px 26px -8px rgba(40,28,10,0.4), inset 0 0 0 1px rgba(255,255,255,0.55), inset 0 -3px 0 rgba(150,120,80,0.18)" }}>
          <div className="absolute inset-[4px] rounded-[20px] border border-dashed border-[#c9584d]/45" />
        </div>
        <canvas ref={canvasRef} className="relative block rounded-[22px] shadow-[0_6px_10px_rgba(60,30,6,0.28),0_18px_36px_rgba(40,24,8,0.22)]" />
        <PrizeLogo shell={shell} active={!over && !shell.paused} />
        {over && <GameOver label={mode === "daily" ? `Today's Challenge #${dailyNumber("2026-11-01")}` : "Free Play"} score={score} best={best} mode={mode}
          posted={shell.scores.posted} joined={!!shell.player} campaign={GAME} copied={shell.copied}
          pitch="Real food stacks up too. WhatYouAte shows you how your meals affect your energy."
          onBoard={() => shell.setBoardOpen(true)} onJoin={() => shell.setJoinOpen(true)} onAgain={() => setRun(r => r + 1)} onShare={share}  extra={duel.button} />}
      </BoardArea>

      <FactStrip toast={toast} onDismiss={clearToast} width={board.w} idle={
        // the food chain on a little oiled-wood shelf; foods you haven't reached yet sit back in the shade
        <div className="relative flex h-[40px] items-center gap-[1px] rounded-[14px] px-2.5"
          style={{ background: "linear-gradient(180deg, #f3d7a8 0%, #e2b67b 55%, #c98f52 100%)",
            boxShadow: "0 2px 0 #8a5426, 0 8px 14px -6px rgba(60,28,4,0.55), inset 0 1px 0 rgba(255,246,228,0.85), inset 0 -2px 3px rgba(120,62,20,0.25)" }}>
          <span className="pointer-events-none absolute inset-0 rounded-[14px] opacity-60" style={{ background: "repeating-linear-gradient(90deg, rgba(120,66,22,0) 0 7px, rgba(120,66,22,0.09) 7px 8px, rgba(255,240,215,0.08) 8px 10px, rgba(120,66,22,0) 10px 19px)" }} />
          {FOODS.map((f, i) => (<span key={f.code} className="relative flex items-center gap-[1px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foodPng(f.code)} alt={f.name} title={f.name} className={`h-[19px] w-[19px] drop-shadow-[1px_2px_1.5px_rgba(70,30,4,0.4)] transition-opacity ${i <= top ? "" : "opacity-40"}`} />
            {i < FOODS.length - 1 && <svg width="7" height="10" viewBox="0 0 7 10" aria-hidden className="shrink-0"><path d="M1.6 1.6 5 5l-3.4 3.4" fill="none" stroke="#8a5426" strokeOpacity="0.55" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>))}
        </div>} />

      <ShellPopups shell={shell} game={GAME} todayNote="Today's Challenge: same foods for everyone. Resets at midnight." />
      {duel.popup}

      {shell.help.open && (
        <HelpModal onClose={shell.help.close} steps={[
          "Tap where you want to drop the food.",
          "Two of the same food merge into the next one. Quick merges in a row are a combo.",
          "Don't let foods pile up past the dashed line.",
        ]}>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-0.5 rounded-2xl bg-[#f0f6fe] p-2">
            {FOODS.map((f, i) => (<span key={f.code} className="flex items-center gap-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foodPng(f.code)} alt={f.name} className="h-5 w-5" />{i < FOODS.length - 1 && <span className="text-[10px] text-[#a9c3ef]">›</span>}</span>))}
          </div>
          <div className="mt-1 text-center text-xs text-[#5a6b85]">Reach the Power Bowl 🥗</div>
          <ModesHelp today="everyone gets the same foods today. Fair fight, new one every day." free="random foods every game. Chase your high score." />
        </HelpModal>
      )}
    </GameScreen>
  );
}
