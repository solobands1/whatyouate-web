"use client";

// Snack Merge: a Suika-style merge game. Drop foods into the lunchbox; two of the same touching merge into the
// next food up the chain, ending at a Power Bowl. Scores come from merges (bigger foods are worth far more, and
// quick chains earn a combo bonus), so scores spread widely and ties are rare. "Daily Drop" gives everyone the
// same food sequence for the day (seeded), so the daily score compares skill on equal terms. Prototype: best
// scores are kept in this browser only; the shared leaderboard comes later.
import { useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import { APP_STORE_URL } from "@/components/site";
import { sb } from "@/components/creators/api";

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

type Mode = "daily" | "endless";
function mulberry32(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function torontoDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date()); }   // YYYY-MM-DD
function dailyNumber() { return Math.floor((Date.parse(torontoDate()) - Date.parse("2026-11-01")) / 86400000) + 1; }
function readBest(key: string) { try { return Number(localStorage.getItem(key) || 0); } catch { return 0; } }
function saveBest(key: string, v: number) { try { localStorage.setItem(key, String(v)); } catch {} }

export default function SnackMerge() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("daily");
  const [run, setRun] = useState(0);                 // bump to restart
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [next, setNext] = useState(0);
  const [over, setOver] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const [combo, setCombo] = useState(0);
  const [copied, setCopied] = useState(false);
  const [board, setBoard] = useState({ w: 0, h: 0 });
  const [help, setHelp] = useState(false);              // "How to play": shown on a first visit, and from the ⓘ button
  // scoreboard: a player signs up once (name + email); the browser keeps their token and posts new runs itself
  const [player, setPlayer] = useState<{ token: string; name: string } | null>(null);
  const [final, setFinal] = useState<{ score: number; drops: number; ms: number } | null>(null);
  const [posted, setPosted] = useState<{ rank: number | null; total: number } | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const finishRef = useRef<(score: number, drops: number, ms: number) => void>(() => {});
  const bestKey = mode === "daily" ? `snackmerge-daily-${torontoDate()}` : "snackmerge-endless";

  useEffect(() => { setBest(readBest(bestKey)); }, [bestKey]);
  useEffect(() => { try { if (!localStorage.getItem("snackmerge-seen-help")) setHelp(true); } catch { setHelp(true); } }, []);
  const closeHelp = () => { setHelp(false); try { localStorage.setItem("snackmerge-seen-help", "1"); } catch {} };
  useEffect(() => { try { const v = localStorage.getItem("snackmerge-player"); if (v) setPlayer(JSON.parse(v)); } catch {} }, []);
  const apiMode = mode === "daily" ? "daily" : "free";
  const boardFor = mode === "daily" ? "today" : "week";
  const postScore = async (tok: string, f: { score: number; drops: number; ms: number }) => {
    if (f.score <= 0) return;
    const { data } = await sb().rpc("game_submit_score", { p_token: tok, p_game: "snack-merge", p_mode: apiMode, p_score: f.score, p_drops: f.drops, p_duration_ms: Math.round(f.ms) });
    if (!data?.ok) return;
    const { data: r } = await sb().rpc("game_my_rank", { p_token: tok, p_game: "snack-merge", p_board: boardFor });
    setPosted({ rank: r?.rank ?? null, total: r?.total ?? 0 });
  };
  finishRef.current = (sc, drops, ms) => { const f = { score: sc, drops, ms }; setFinal(f); setPosted(null); if (player) postScore(player.token, f); };
  useEffect(() => {                                    // a web app, not a page: no scrolling, no pull-to-refresh, no bounce
    const h = document.documentElement, b = document.body, prev = [h.style.overflow, b.style.overflow, h.style.overscrollBehavior];
    h.style.overflow = "hidden"; b.style.overflow = "hidden"; h.style.overscrollBehavior = "none";
    return () => { h.style.overflow = prev[0]; b.style.overflow = prev[1]; h.style.overscrollBehavior = prev[2]; };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    const imgs = FOODS.map(f => { const i = new Image(); i.src = `/games/foods/${f.code}.png`; return i; });
    const seed = mode === "daily" ? Number(torontoDate().replace(/-/g, "")) : Math.floor(Math.random() * 1e9);
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
    const seen = new Set<number>([0, 1, 2, 3, 4]);   // foods you can drop don't need an introduction
    setNext(upcoming); setScore(0); setOver(false); setCombo(0); setToast(null); setFinal(null); setPosted(null);

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
        if (a === FOODS.length - 1) { total += Math.round(200 * mult); setScore(total); continue; }   // two Power Bowls: both clear, big bonus
        const nb = addFood(a + 1, x, y); Matter.Body.setVelocity(nb, { x: 0, y: -1.5 });
        total += Math.round(FOODS[a + 1].points * mult); setScore(total);
        if (!seen.has(a + 1)) { seen.add(a + 1); { const fs = FOODS[a + 1].facts; setToast({ title: `New: ${FOODS[a + 1].name}!`, body: fs[Math.floor(Math.random() * fs.length)] }); } }
      }
    });

    const scale = () => Math.min(wrap.clientWidth / W, (wrap.clientHeight - 64) / H);   // fit width AND height (minus the fact strip below): no scrolling
    const resize = () => {
      const s = scale(), dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${W * s}px`; canvas.style.height = `${H * s}px`; setBoard({ w: W * s, h: H * s });
      canvas.width = Math.round(W * s * dpr); canvas.height = Math.round(H * s * dpr);
      ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
    };
    resize(); window.addEventListener("resize", resize);
    const ro = new ResizeObserver(resize); ro.observe(wrap);

    const toLocal = (clientX: number) => { const r = canvas.getBoundingClientRect(); return ((clientX - r.left) / r.width) * W; };
    const clampX = (x: number) => Math.max(FOODS[current].r + 2, Math.min(W - FOODS[current].r - 2, x));
    const onMove = (e: PointerEvent) => { aimX = clampX(toLocal(e.clientX)); };
    const onUp = (e: PointerEvent) => {
      if (ended || !canDrop) return;
      aimX = clampX(toLocal(e.clientX)); addFood(current, aimX, TOP - 40); drops++;
      current = upcoming; upcoming = pick(); setNext(upcoming); canDrop = false;
      setTimeout(() => { canDrop = true; }, 550);
    };
    canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerdown", onMove); canvas.addEventListener("pointerup", onUp);

    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(32, t - last); last = t;
      if (!ended) Matter.Engine.update(engine, dt);
      // lose: a settled food stays above the line for 1.5s
      const settledAbove = engine.world.bodies.some(b => level.has(b.id) && t - (born.get(b.id) || 0) > 1200 && b.position.y - FOODS[level.get(b.id)!].r < TOP);
      if (!ended) {
        if (settledAbove) { aboveSince ||= t; if (t - aboveSince > 1500) { ended = true; setOver(true); if (total > readBest(bestKey)) { saveBest(bestKey, total); setBest(total); } finishRef.current(total, drops, t - started); } }
        else aboveSince = 0;
      }
      // draw
      ctx.clearRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#f4f8ff"); g.addColorStop(1, "#dce9ff");
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 22); ctx.fill();
      ctx.strokeStyle = aboveSince ? "#e8505b" : "#a9c3ef"; ctx.setLineDash([10, 8]); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(10, TOP); ctx.lineTo(W - 10, TOP); ctx.stroke(); ctx.setLineDash([]);
      if (!ended) {                                     // aim guide and the food in hand
        ctx.strokeStyle = "rgba(63,127,214,0.25)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(aimX, TOP - 40); ctx.lineTo(aimX, H); ctx.stroke();
        if (canDrop) drawFood(current, aimX, TOP - 40, 0, 1);
      }
      for (const b of engine.world.bodies) { const lv = level.get(b.id); if (lv !== undefined) drawFood(lv, b.position.x, b.position.y, b.angle, 1); }
      raf = requestAnimationFrame(loop);
    };
    function drawFood(lv: number, x: number, y: number, ang: number, a: number) {
      const f = FOODS[lv];
      ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(ang);
      ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(0, 0, f.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(16,27,46,0.08)"; ctx.lineWidth = 2; ctx.stroke();
      const s = f.r * 1.55; if (imgs[lv].complete) ctx.drawImage(imgs[lv], -s / 2, -s / 2, s, s);
      ctx.restore();
    }
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); window.removeEventListener("resize", resize); ro.disconnect();
      canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerdown", onMove); canvas.removeEventListener("pointerup", onUp);
      Matter.Engine.clear(engine);
    };
  }, [mode, run, bestKey]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);

  const share = async () => {
    const label = mode === "daily" ? `Snack Merge, Today's Challenge #${dailyNumber()}` : "Snack Merge";
    const text = `${label} 🍲 ${score.toLocaleString()} pts\nCan you beat it? whatyouate.app/games`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } } catch {}
  };

  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-b from-[#e3effe] via-[#f0f6fe] to-[#6fa8ff] text-[#101b2e]"
      style={{ paddingTop: "max(env(safe-area-inset-top), 10px)", paddingBottom: "max(env(safe-area-inset-bottom), 10px)", paddingLeft: 12, paddingRight: 12 }}>
      <div className="mx-auto flex h-full w-full max-w-[440px] flex-col">
        <div className="flex items-center gap-2">
          <img src="/icon-512.png" alt="WhatYouAte" className="h-8 w-8 rounded-lg" />
          <h1 className="text-lg font-bold tracking-tight">Snack Merge</h1>
          <div className="ml-auto flex rounded-full bg-white/70 p-0.5 text-xs font-semibold">
            {(["daily", "endless"] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setRun(r => r + 1); }}
                className={`rounded-full px-3 py-1.5 ${mode === m ? "bg-[#3f7fd6] text-white" : "text-[#3f7fd6]"}`}>
                {m === "daily" ? "Today" : "Free Play"}
              </button>
            ))}
          </div>
          <button onClick={() => setBoardOpen(true)} aria-label="Scoreboard" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-base">🏆</button>
          <button onClick={() => setHelp(true)} aria-label="How to play" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-sm font-bold text-[#3f7fd6]">i</button>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Score</div><div className="text-2xl font-bold leading-none tabular-nums">{score.toLocaleString()}</div></div>
          <div className="h-6">{combo > 0 && <div className="rounded-full bg-[#2eaa6e] px-2.5 py-0.5 text-xs font-bold text-white">Combo ×{combo + 1}</div>}</div>
          <div className="text-right"><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Best</div><div className="text-lg font-semibold leading-none tabular-nums">{best.toLocaleString()}</div></div>
          <div className="ml-3 flex items-center gap-1"><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Next</div>
            <img src={`/games/foods/${FOODS[next].code}.png`} alt={FOODS[next].name} className="h-8 w-8" /></div>
        </div>

        <div ref={wrapRef} className="mt-2 flex min-h-0 flex-1 items-start justify-center touch-none select-none" style={{ paddingBottom: 64 }}>
          <div className="relative" style={{ width: board.w, height: board.h }}>
            <canvas ref={canvasRef} className="block rounded-[22px] shadow-[0_14px_40px_rgba(16,42,86,0.18)]" />
            {over && (
              <div className="absolute inset-0 flex items-center justify-center rounded-[22px] bg-[#101b2e]/45 p-4">
                <div className="w-full rounded-3xl bg-white p-5 text-center shadow-2xl">
                  <div className="text-sm font-semibold text-[#5a6b85]">{mode === "daily" ? `Today's Challenge #${dailyNumber()}` : "Free Play"}</div>
                  <div className="mt-1 text-4xl font-bold tabular-nums">{score.toLocaleString()}</div>
                  <div className="text-sm text-[#5a6b85]">{score >= best && score > 0 ? "New best!" : `Best: ${best.toLocaleString()}`}</div>
                  {posted?.rank ? (
                    <button onClick={() => setBoardOpen(true)} className="mt-3 w-full rounded-2xl bg-[#e3effe] px-3 py-2 text-sm font-semibold text-[#3f7fd6]">
                      🏆 You&apos;re #{posted.rank} of {posted.total} {mode === "daily" ? "today" : "this week"} · See scoreboard
                    </button>
                  ) : !player && score > 0 ? (
                    <button onClick={() => setJoinOpen(true)} className="mt-3 w-full rounded-2xl bg-[#fff4d6] px-3 py-2 text-sm font-semibold text-[#8a5a00]">
                      🏆 Put your score on the scoreboard
                    </button>
                  ) : null}
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => setRun(r => r + 1)} className="flex-1 rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Play again</button>
                    <button onClick={share} className="flex-1 rounded-full bg-[#e3effe] py-3 font-semibold text-[#3f7fd6]">{copied ? "Copied!" : "Share"}</button>
                  </div>
                  <p className="mt-4 text-sm text-[#5a6b85]">Real food stacks up too. WhatYouAte shows you how your meals affect your energy.</p>
                  <a href={APP_STORE_URL} className="mt-2 inline-block rounded-full bg-[#101b2e] px-5 py-2.5 text-sm font-semibold text-white">Get WhatYouAte</a>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 flex justify-center px-3" style={{ bottom: "max(env(safe-area-inset-bottom), 10px)" }}>
          <div className="pointer-events-auto w-full max-w-[440px]" style={{ maxWidth: board.w || undefined }}>
            {toast ? (
              <div className="flex items-start gap-2 rounded-2xl bg-white/95 px-3 py-2 shadow-md">
                <img src={`/games/foods/${FOODS.find(f => toast.title.includes(f.name))?.code ?? FOODS[0].code}.png`} alt="" className="mt-0.5 h-7 w-7" />
                <div className="min-w-0 flex-1"><div className="text-xs font-bold text-[#3f7fd6]">{toast.title}</div><div className="text-[13px] leading-snug">{toast.body}</div></div>
                <button onClick={() => setToast(null)} aria-label="Dismiss" className="-mr-1 -mt-1 h-8 w-8 shrink-0 rounded-full text-lg leading-none text-[#5a6b85]">×</button>
              </div>
            ) : (
              <div className="flex h-[52px] items-center justify-center gap-0.5">
                {FOODS.map((f, i) => (<span key={f.code} className="flex items-center gap-0.5">
                  <img src={`/games/foods/${f.code}.png`} alt={f.name} title={f.name} className="h-[18px] w-[18px]" />{i < FOODS.length - 1 && <span className="text-[10px] text-[#a9c3ef]">›</span>}</span>))}
              </div>
            )}
          </div>
        </div>
      </div>

      {joinOpen && <JoinForm onClose={() => setJoinOpen(false)} onJoined={async (pl) => {
        setPlayer(pl); try { localStorage.setItem("snackmerge-player", JSON.stringify(pl)); } catch {}
        setJoinOpen(false); if (final) await postScore(pl.token, final); setBoardOpen(true);
      }} />}
      {boardOpen && <Scoreboard token={player?.token} initial={boardFor} onClose={() => setBoardOpen(false)} onJoin={() => { setBoardOpen(false); setJoinOpen(true); }} />}

      {help && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#101b2e]/50 p-5" onClick={closeHelp}>
          <div className="w-full max-w-[380px] rounded-3xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center text-xl font-bold">How to play</div>
            <ol className="mt-3 space-y-2 text-[15px]">
              <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e3effe] text-sm font-bold text-[#3f7fd6]">1</span>Tap where you want to drop the food.</li>
              <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e3effe] text-sm font-bold text-[#3f7fd6]">2</span>Two of the same food merge into the next one. Quick merges in a row are a combo.</li>
              <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e3effe] text-sm font-bold text-[#3f7fd6]">3</span>Don&apos;t let foods pile up past the dashed line.</li>
            </ol>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-0.5 rounded-2xl bg-[#f0f6fe] p-2">
              {FOODS.map((f, i) => (<span key={f.code} className="flex items-center gap-0.5">
                <img src={`/games/foods/${f.code}.png`} alt={f.name} className="h-5 w-5" />{i < FOODS.length - 1 && <span className="text-[10px] text-[#a9c3ef]">›</span>}</span>))}
            </div>
            <div className="mt-1 text-center text-xs text-[#5a6b85]">Reach the Power Bowl 🥗</div>
            <div className="mt-4 space-y-1.5 text-sm">
              <p><b>Today:</b> everyone gets the same foods today. Fair fight, new one every day.</p>
              <p><b>Free Play:</b> random foods every game. Chase your high score.</p>
            </div>
            <button onClick={closeHelp} className="mt-5 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Let&apos;s play</button>
          </div>
        </div>
      )}
    </main>
  );
}

const NAME_ERRORS: Record<string, string> = {
  name_short: "Your name needs at least 2 characters.", name_long: "Keep your name to 20 characters.",
  name_characters: "Use letters, numbers, spaces, dots, dashes or underscores.", name_blocked: "Pick a different name.",
  name_reserved: "That name is reserved. Pick another.", email: "That email doesn't look right.",
};

function JoinForm({ onClose, onJoined }: { onClose: () => void; onJoined: (p: { token: string; name: string }) => void }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [updates, setUpdates] = useState(false);   // "someone beat your score" emails left out for now (Dillon: it'd get annoying)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const submit = async () => {
    setBusy(true); setErr("");
    const { data, error } = await sb().rpc("game_register", { p_name: name, p_email: email, p_notify: false, p_marketing: updates });
    setBusy(false);
    if (error || !data?.ok) { setErr(NAME_ERRORS[data?.error] ?? "Something went wrong. Try again."); return; }
    onJoined({ token: data.token, name: data.name });
  };
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#101b2e]/50 p-5" onClick={onClose}>
      <div className="w-full max-w-[380px] rounded-3xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="text-center text-xl font-bold">Join the scoreboard</div>
        <p className="mt-1 text-center text-sm text-[#5a6b85]">Your name shows on the board. Your email never does.</p>
        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#5a6b85]">Name</label>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={20} placeholder="e.g. SnackKing" className="mt-1 w-full rounded-xl border border-[#d6e2f5] px-3 py-2.5 text-base outline-none focus:border-[#3f7fd6]" />
        <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-[#5a6b85]">Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" className="mt-1 w-full rounded-xl border border-[#d6e2f5] px-3 py-2.5 text-base outline-none focus:border-[#3f7fd6]" />
        <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={updates} onChange={e => setUpdates(e.target.checked)} className="mt-0.5 h-4 w-4" />Send me WhatYouAte news and updates</label>
        {err && <p className="mt-3 text-sm font-semibold text-[#d64545]">{err}</p>}
        <button disabled={busy} onClick={submit} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white disabled:opacity-60">{busy ? "Adding you..." : "Add me to the board"}</button>
        <p className="mt-3 text-center text-[11px] text-[#5a6b85]">You can unsubscribe any time. See our <a href="/privacy" className="underline">privacy policy</a>.</p>
      </div>
    </div>
  );
}

type Row = { rank: number; name: string; score: number };
function Scoreboard({ token, initial, onClose, onJoin }: { token?: string; initial: string; onClose: () => void; onJoin: () => void }) {
  const [tab, setTab] = useState(initial); const [rows, setRows] = useState<Row[] | null>(null);
  const [mine, setMine] = useState<{ rank: number | null; score?: number; total?: number } | null>(null);
  useEffect(() => {
    let live = true; setRows(null); setMine(null);
    (async () => {
      const { data } = await sb().rpc("game_leaderboard", { p_game: "snack-merge", p_board: tab, p_limit: 50 });
      if (live) setRows((data as Row[]) ?? []);
      if (token) { const { data: m } = await sb().rpc("game_my_rank", { p_token: token, p_game: "snack-merge", p_board: tab }); if (live) setMine(m); }
    })();
    return () => { live = false; };
  }, [tab, token]);
  const tabs: [string, string][] = [["today", "Today"], ["week", "This Week"], ["all", "All-Time"]];
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#101b2e]/50 p-4" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-[400px] flex-col rounded-3xl bg-white p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><div className="text-xl font-bold">🏆 Scoreboard</div>
          <button onClick={onClose} aria-label="Close" className="h-8 w-8 rounded-full text-xl text-[#5a6b85]">×</button></div>
        <div className="mt-2 flex rounded-full bg-[#f0f6fe] p-0.5 text-xs font-semibold">
          {tabs.map(([k, label]) => (<button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-full py-1.5 ${tab === k ? "bg-[#3f7fd6] text-white" : "text-[#3f7fd6]"}`}>{label}</button>))}
        </div>
        <p className="mt-2 text-center text-[11px] text-[#5a6b85]">{tab === "today" ? "Today's Challenge: same foods for everyone. Resets at midnight." : tab === "week" ? "Best Free Play scores since Monday." : "Best Free Play scores ever."}</p>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
          {rows === null ? <p className="py-6 text-center text-sm text-[#5a6b85]">Loading...</p>
            : rows.length === 0 ? <p className="py-6 text-center text-sm text-[#5a6b85]">No scores yet. Be the first!</p>
            : rows.map(r => (
              <div key={r.rank} className={`flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm ${mine?.rank === r.rank ? "bg-[#e3effe] font-semibold" : ""}`}>
                <span className="w-7 text-right tabular-nums text-[#5a6b85]">{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</span>
                <span className="min-w-0 flex-1 truncate">{r.name}</span><span className="tabular-nums font-semibold">{r.score.toLocaleString()}</span>
              </div>))}
        </div>
        <div className="mt-2 border-t border-[#e3effe] pt-2 text-center text-sm">
          {token ? (mine?.rank ? <span>You&apos;re <b>#{mine.rank}</b> of {mine.total} with <b>{mine.score?.toLocaleString()}</b></span> : <span className="text-[#5a6b85]">Play a round to get on this board.</span>)
            : <button onClick={onJoin} className="font-semibold text-[#3f7fd6]">Join the scoreboard →</button>}
        </div>
      </div>
    </div>
  );
}
