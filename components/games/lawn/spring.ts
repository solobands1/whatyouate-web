// Chapter 5, Spring On The Farm: the jobs that ride on the normal tractor engine (./engine) through the Chore hooks
// (./chores), each playing its own way. The gas run to Aylmer drives the '67 instead (./gasRun).
//   dandelions  the east lawn is full of dandelions: the deck takes them out as it goes over (the dandelions are the goal,
//               not the grass). Some have gone to seed: rush over those and the seeds blow all over the yard.
//   spray       a little sprayer towed behind: turn it on over the weeds along the fences, the driveway and the barn, keep
//               it off the flower beds and the vegetable garden, and don't run the tank dry on clean grass.
//   gravel      a dump cart behind: stop beside the gravel pile by the road and Pat shovels in a load; drive the cart over
//               the muddy holes in the driveway and it spreads fresh gravel.
//   trees       a cart behind: load young maples at the nursery wagon by the barn, stop by each stake in the field and tap
//               it; Pat digs, plants and waters.
// Every job has the spring look: fresh green grass, apple blossom, puddles, a robin on the lawn, birds overhead.
import type { Pt, Tree } from "../lawnMap";
import type { Job } from "./jobs";
import { DECKS, GEARS } from "./jobs";
import { type Chore, type ChoreCtx, makeCart, edgeArrow, pill, makeRouter } from "./chores";
import { CELL } from "./world";
import { clamp, wrapA, mulberry32, pip, segClosest } from "./geo";
import { drawPuddle } from "./art";
import { drawPat, drawCart } from "./fallArt";
import { springWash, drawDandelion, drawSeed, drawWeed, drawSprayer, drawGravelPile, paintGravel, paintMud, drawDumpCart, drawSapling, drawPotted, drawNursery,
  drawStake, drawMound, drawShovel, drawCan, drawRobin, drawBirdScreen, drawBlossom } from "./springArt";

const U = (ux: number, uy: number): Pt => [ux * 0.075, (uy + 130) * 0.075];   // a spot traced in the yard's units, in metres
const DECK_LON = 0.9, SEED_V = 3.3, DEAD = 0.08;
type Part = { x: number; y: number; vx: number; vy: number; life: number; max: number; kind: "yellow" | "green" | "seed" | "mist" | "dirt" | "gravel" | "drop" | "splash"; a: number };

export function springChore(job: Job, ctx: ChoreCtx): Chore | null {
  if (job.twist === "dandelions") return dandelionChore(ctx);
  if (job.twist === "spray") return sprayChore(ctx);
  if (job.twist === "gravel") return gravelChore(ctx);
  if (job.twist === "trees") return treesChore(ctx);
  return null;
}

// ── the spring scene every job shares: petals under the apple trees, puddles, a robin, birds overhead, particles ──
const PUDDLES: [number, number, number, number, number][] = [[1192, 345, 1.5, 0.85, 0.4], [950, 445, 1.2, 0.75, -0.3], [1030, 893, 1.4, 0.8, 0.2], [700, 520, 1.6, 0.9, 0.1], [1180, 25, 1.1, 0.7, -0.5]];
const ROBIN_SPOTS: [number, number][] = [[1150, 300], [960, 360], [1000, 820], [1200, 560], [930, 60], [650, 700], [760, 450]];
function springScene(ctx: ChoreCtx) {
  const m = ctx.map, prnd = mulberry32(61);
  const petals: { x: number; y: number; a: number; c: string }[] = [];
  for (const t of m.trees) if (t.kind === "fruit") { const n = Math.round(t.r * t.r * 30); for (let k = 0; k < n; k++) { const a = prnd() * 7, d = Math.sqrt(prnd()) * t.r * 1.3; petals.push({ x: t.x + t.r * 0.15 + Math.cos(a) * d, y: t.y + t.r * 0.15 + Math.sin(a) * d, a: prnd() * 3, c: ["#ffffff", "#f7c6d6", "#f3b0c6"][Math.floor(prnd() * 3)] }); } }
  const puddles = PUDDLES.map(([ux, uy, rx, ry, rot]) => { const [x, y] = U(ux, uy); return { x, y, rx, ry, rot }; });
  const parts: Part[] = [];
  const spots = ROBIN_SPOTS.map(([ux, uy]) => U(ux, uy));
  const robin = { x: spots[0][0], y: spots[0][1], a: 0.5, hop: 0, hopT: 0.8, peck: 0, peckT: 0, fly: null as null | { fx: number; fy: number; tx: number; ty: number; u: number } };
  let birdT = 5, chirpT = 4, splashT = 0;
  const birds: { x: number; y: number; vx: number; vy: number; ph: number }[] = [];
  function step(dt: number) {
    const p = ctx.pose();
    // the robin: hops and pecks; flies off to another spot when the tractor (or Pat) comes close
    if (robin.fly) { robin.fly.u = Math.min(1, robin.fly.u + dt * 0.55); const f = robin.fly, e = f.u * f.u * (3 - 2 * f.u); robin.x = f.fx + (f.tx - f.fx) * e; robin.y = f.fy + (f.ty - f.fy) * e; robin.a = Math.atan2(f.ty - f.fy, f.tx - f.fx); if (f.u >= 1) robin.fly = null; }
    else {
      if (Math.hypot(robin.x - p.x, robin.y - p.y) < 5) {
        let best = spots[0], bd = -1; for (const s of spots) { const d = Math.hypot(s[0] - p.x, s[1] - p.y); if (d > bd && d < 40) { bd = d; best = s; } }
        robin.fly = { fx: robin.x, fy: robin.y, tx: best[0] + (Math.random() - 0.5) * 2, ty: best[1] + (Math.random() - 0.5) * 2, u: 0 }; ctx.snd.chirp();
      }
      robin.hopT -= dt; robin.peckT -= dt;
      if (robin.hopT <= 0) { robin.hopT = 0.7 + Math.random() * 1.3; const a = robin.a + (Math.random() - 0.5) * 1.6; robin.a = a; robin.hop = 1; robin.x += Math.cos(a) * 0.25; robin.y += Math.sin(a) * 0.25; }
      if (robin.peckT <= 0) { robin.peckT = 0.5 + Math.random() * 1.5; robin.peck = 1; }
    }
    robin.hop = Math.max(0, robin.hop - dt * 6); robin.peck = Math.max(0, robin.peck - dt * 5);
    chirpT -= dt; if (chirpT <= 0) { chirpT = 6 + Math.random() * 8; if (ctx.phase() === "play") ctx.snd.chirp(); }
    // birds crossing overhead now and then
    birdT -= dt; if (birdT <= 0) { birdT = 14 + Math.random() * 10; const y0 = 0.15 + Math.random() * 0.5, dir = Math.random() < 0.5 ? 1 : -1; for (let k = 0; k < 2; k++) birds.push({ x: dir > 0 ? -0.1 - k * 0.07 : 1.1 + k * 0.07, y: y0 + k * 0.05, vx: dir, vy: (Math.random() - 0.5) * 0.04, ph: Math.random() * 6 }); }
    for (const b of birds) { b.ph += dt * 9; b.x += b.vx * dt * 0.09; b.y += b.vy * dt; }   // (in fractions of the screen: they're overhead, not on the yard)
    for (let i = birds.length - 1; i >= 0; i--) if (birds[i].x > 1.3 || birds[i].x < -0.3) birds.splice(i, 1);
    // a splash driving through a puddle
    splashT -= dt;
    if (Math.abs(p.v) > 1 && splashT <= 0 && puddles.some(q => { const dx = p.x - q.x, dy = p.y - q.y, c = Math.cos(-q.rot), s = Math.sin(-q.rot), lx = dx * c - dy * s, ly = dx * s + dy * c; return (lx * lx) / (q.rx * q.rx) + (ly * ly) / (q.ry * q.ry) < 1; })) {
      splashT = 0.05; for (let k = 0; k < 3; k++) parts.push({ x: p.x + (Math.random() - 0.5), y: p.y + (Math.random() - 0.5), vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, life: 0.45, max: 0.45, kind: "splash", a: 0 });
    }
    for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; const drag = q.kind === "seed" ? 0.995 : 0.92; q.vx *= drag; q.vy *= drag; if (q.kind === "seed") { q.vx += 0.25 * dt; q.vy -= 0.05 * dt; q.a += dt * 2; } q.life -= dt; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
  }
  const inView = (x: number, y: number, cx: number, cy: number, vw: number, vh: number, m2 = 2) => Math.abs(x - cx) < vw / 2 + m2 && Math.abs(y - cy) < vh / 2 + m2;
  function drawGround(c: CanvasRenderingContext2D, time: number, cx: number, cy: number, vw: number, vh: number) {
    springWash(c, cx, cy, vw, vh);
    for (const q of puddles) if (inView(q.x, q.y, cx, cy, vw, vh, 3)) drawPuddle(c, q.x, q.y, q.rx, q.ry, q.rot, time, 0);
    for (const q of petals) if (inView(q.x, q.y, cx, cy, vw, vh)) { c.fillStyle = q.c; c.beginPath(); c.ellipse(q.x, q.y, 0.075, 0.045, q.a, 0, 7); c.fill(); }
    if (!robin.fly) drawRobin(c, robin.x, robin.y, robin.a, robin.hop, robin.peck);
    for (const q of parts) if (q.kind !== "seed" && q.kind !== "mist") {
      c.globalAlpha = Math.min(1, (q.life / q.max) * 2.5);
      c.fillStyle = q.kind === "yellow" ? "#ffd21f" : q.kind === "green" ? "#4c9a36" : q.kind === "dirt" ? "#6b4e33" : q.kind === "gravel" ? "#b5ab98" : q.kind === "drop" ? "rgba(140,195,240,0.9)" : "rgba(210,230,245,0.9)";
      c.fillRect(q.x - 0.06, q.y - 0.06, 0.12, 0.12);
    }
    c.globalAlpha = 1;
  }
  function drawAbove(c: CanvasRenderingContext2D) {
    if (robin.fly) { const u = robin.fly.u; drawRobin(c, robin.x, robin.y, robin.a, 2 + Math.sin(u * Math.PI) * 6, 0); }
    for (const q of parts) if (q.kind === "seed") drawSeed(c, q.x, q.y, q.a, Math.min(1, q.life / q.max * 2));
      else if (q.kind === "mist") { c.globalAlpha = Math.min(1, q.life / q.max) * 0.55; c.fillStyle = "#dceeff"; c.beginPath(); c.arc(q.x, q.y, 0.09 + (1 - q.life / q.max) * 0.12, 0, 7); c.fill(); c.globalAlpha = 1; }
  }
  function drawScreen(c: CanvasRenderingContext2D, CW: number, MH: number) {
    for (const b of birds) drawBirdScreen(c, b.x * CW, b.y * MH + Math.sin(b.ph * 0.2) * 6, b.vx > 0 ? 0 : Math.PI, b.ph, 7);
  }
  return { parts, step, drawGround, drawAbove, drawScreen, drawTree: (c: CanvasRenderingContext2D, t: Tree, blobs: number[][], alpha: number, time: number) => drawBlossom(c, t, blobs, alpha, time) };
}

/** Pat on foot: a little script of walks, waits and doings (off the seat, out to something, back on). */
type Look = { carry: "pot" | "pots" | null; tool: "shovel" | "can" | null; dig: number; pour: number; bend: number; full: "dirt" | "gravel" | null };
type Act = { go?: () => Pt; wait?: number; face?: () => Pt; look?: Partial<Look>; anim?: (u: number, me: { look: Look }) => void; then?: () => void };
function makeWalker(ctx: ChoreCtx) {
  const WALK = 3.1;
  const me = { on: false, x: 0, y: 0, a: 0, ph: 0, walking: false, look: { carry: null, tool: null, dig: 0, pour: 0, bend: 0, full: null } as Look };
  let q: Act[] = [], cur: Act | null = null, t = 0;
  const seat = (side: number): Pt => { const p = ctx.pose(); return [p.x - Math.cos(p.h) * 0.44 - Math.sin(p.h) * side * 0.85, p.y - Math.sin(p.h) * 0.44 + Math.cos(p.h) * side * 0.85]; };
  function start(acts: Act[]) { const p = ctx.pose(); me.on = true; me.x = p.x - Math.cos(p.h) * 0.44; me.y = p.y - Math.sin(p.h) * 0.44; me.a = p.h + Math.PI / 2; me.look = { carry: null, tool: null, dig: 0, pour: 0, bend: 0, full: null }; q = [...acts]; cur = null; t = 0; ctx.snd.click(); }
  function step(dt: number) {
    if (!me.on) return;
    if (!cur) { cur = q.shift() ?? null; t = 0; if (!cur) { me.on = false; return; } if (cur.look) Object.assign(me.look, cur.look); }
    t += dt; me.walking = false;
    if (cur.go) {
      const [tx, ty] = cur.go(), dx = tx - me.x, dy = ty - me.y, d = Math.hypot(dx, dy), s = Math.min(d, WALK * dt);
      if (d > 0.04) { me.x += (dx / d) * s; me.y += (dy / d) * s; me.a = Math.atan2(dy, dx); me.ph += s * 5.2; me.walking = true; }
      if (d - s < 0.04 || t > 6) { cur.then?.(); cur = null; }
    } else {
      if (cur.face) { const [fx, fy] = cur.face(); me.a += clamp(wrapA(Math.atan2(fy - me.y, fx - me.x) - me.a), -10 * dt, 10 * dt); }
      const W = cur.wait ?? 0; cur.anim?.(Math.min(1, t / Math.max(1e-6, W)), me);
      if (t >= W) { cur.then?.(); cur = null; }
    }
  }
  function draw(c: CanvasRenderingContext2D, time: number) {
    if (!me.on) return; const L = me.look;
    drawPat(c, me.x, me.y, me.a, { walk: me.walking ? me.ph : 0, bend: L.carry ? 0.45 : L.bend, seed: 3 }, time);
    const hx = me.x + Math.cos(me.a) * 0.62, hy = me.y + Math.sin(me.a) * 0.62;
    if (L.carry === "pot") drawPotted(c, hx, hy, time, 33, 0.9);
    if (L.carry === "pots") for (const o of [-0.3, 0, 0.3]) drawPotted(c, hx - Math.sin(me.a) * o, hy + Math.cos(me.a) * o, time, 34 + o * 10, 0.8);
    if (L.tool === "shovel") drawShovel(c, me.x, me.y, me.a, L.dig, L.full);
    if (L.tool === "can") drawCan(c, me.x, me.y, me.a, L.pour, time);
  }
  return { me, start, step, draw, seat };
}
/** The autopilot's speed on the stick: a push that drives about `v` metres a second. */
const pushFor = (ctx: ChoreCtx, v: number) => DEAD + 0.02 + (1 - DEAD - 0.02) * clamp(v / (GEARS[ctx.up.gear] ?? GEARS[0]), 0, 1);
const capPush = (inp: [number, number], m: number): [number, number] => { const d = Math.hypot(inp[0], inp[1]); return d > m ? [(inp[0] / d) * m, (inp[1] / d) * m] : inp; };
/** Pushes the tractor out of a round thing the chore draws (the gravel pile, a wagon, the water tote). */
function keepOut(ctx: ChoreCtx, x: number, y: number, r: number) { const p = ctx.pose(), d = Math.hypot(p.x - x, p.y - y), rr = r + 0.85; if (d < rr && d > 1e-3) ctx.place(x + ((p.x - x) / d) * rr, y + ((p.y - y) / d) * rr, p.h); }
const fmtPct = (f: number) => `${f >= 1 ? "100" : (Math.floor(f * 1000) / 10).toFixed(1)}%`;
const offScreen = (qx: number, qy: number, CW: number, MH: number) => qx < 8 || qx > CW - 8 || qy < 8 || qy > MH - 8;

// ── Dandelions ──
// where they've come up thickest (yard units, how many in the clump)
const DANDY_CLUMPS: [number, number, number][] = [
  [960, 35, 7], [1190, 55, 6], [1040, 75, 4], [925, 300, 5], [1195, 330, 6], [1100, 345, 6], [960, 385, 4], [1150, 420, 5],
  [945, 505, 5], [1060, 545, 6], [1170, 615, 5], [995, 725, 5], [1120, 660, 4], [1025, 880, 6], [1190, 860, 6],
];
function dandelionChore(ctx: ChoreCtx): Chore {
  const w = ctx.w, sc = springScene(ctx), router = makeRouter(ctx), rnd = mulberry32(518);
  const deckHalf = Math.min(3.3, (DECKS[ctx.up.deck] ?? DECKS[0]) + (ctx.job.deckBonus ?? 0));
  const flowers: { x: number; y: number; seed: number; puff: boolean; st: 0 | 1 }[] = [];
  const okAt = (x: number, y: number) => { const k = w.cellOf(x, y); return ctx.jobNeed[k] && w.reach[k] && w.clearance[k] > 1.3; };
  DANDY_CLUMPS.forEach(([ux, uy, n], ci) => {
    const [cx, cy] = U(ux, uy); let placed = 0;
    for (let t = 0; t < 80 && placed < n; t++) {
      const a = rnd() * 7, d = Math.sqrt(rnd()) * 2.8, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      if (!okAt(x, y) || flowers.some(f => Math.hypot(f.x - x, f.y - y) < 0.55)) continue;
      flowers.push({ x, y, seed: 100 + flowers.length, puff: (placed === 1 && ci % 2 === 0) || (placed === 3 && ci % 3 === 1), st: 0 }); placed++;
    }
  });
  const total = flowers.length, got = () => flowers.filter(f => f.st).length;
  let blown = 0, autoT: number | null = null, autoBest = Infinity, autoStuck = 0;
  const skip = new Set<number>();
  return {
    ownGoal: true, clipCols: ["#8fcf5f", "#4f8f2f"],
    hold: () => false, patOff: () => false,
    step(dt) {
      sc.step(dt);
      const p = ctx.pose(), c = Math.cos(p.h), s = Math.sin(p.h), ph = ctx.phase();
      if (ph !== "play" && ph !== "ready") return;
      for (const f of flowers) {
        if (f.st) continue;
        const dx = f.x - p.x, dy = f.y - p.y; if (Math.abs(dx) > 4 || Math.abs(dy) > 4) continue;
        const lon = dx * c + dy * s, lat = -dx * s + dy * c;
        if (Math.abs(lon) > DECK_LON + 0.15 || Math.abs(lat) > deckHalf + 0.05) continue;
        f.st = 1;
        if (f.puff && Math.abs(p.v) > SEED_V) {   // too fast over a seed head: the seeds blow all over the yard
          blown++; ctx.snd.squish(); ctx.floatAt("Poof! Ease Off", f.x, f.y - 0.6, "#ffffff"); ctx.shake(0.08);
          for (let k = 0; k < 26; k++) { const a = Math.random() * 7, sp = 0.6 + Math.random() * 1.8; sc.parts.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp + 0.6, vy: Math.sin(a) * sp - 0.3, life: 3 + Math.random() * 1.5, max: 4.5, kind: "seed", a: Math.random() * 6 }); }
        } else if (f.puff) {
          ctx.snd.pop(); for (let k = 0; k < 6; k++) { const a = Math.random() * 7; sc.parts.push({ x: f.x, y: f.y, vx: Math.cos(a) * 0.4, vy: Math.sin(a) * 0.4, life: 1.2, max: 1.5, kind: "seed", a: Math.random() * 6 }); }
        } else {
          ctx.snd.pop(); for (let k = 0; k < 7; k++) { const a = p.h + Math.PI / 2 + (Math.random() - 0.5) * 1.2, sp = 2 + Math.random() * 2.5; sc.parts.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, max: 0.5, kind: k % 3 ? "yellow" : "green", a: 0 }); }
        }
        if (got() === total) ctx.say("That's Every Dandelion!");
        else if (got() === total - 5) ctx.say("Five To Go!");
      }
    },
    done: () => got() === total,
    drawGround(c, time, cx, cy, vw, vh) {
      sc.drawGround(c, time, cx, cy, vw, vh);
      const few = total - got() <= 8;
      for (const f of flowers) if (!f.st && Math.abs(f.x - cx) < vw / 2 + 1 && Math.abs(f.y - cy) < vh / 2 + 1) drawDandelion(c, f.x, f.y, f.seed, f.puff, time, few ? 1 : 0, 1.7);
    },
    drawBelow() {}, drawAbove(c) { sc.drawAbove(c); },
    drawScreen(c, sx, sy, CW, MH, time) {
      sc.drawScreen(c, CW, MH);
      if (ctx.phase() !== "play" && ctx.phase() !== "ready") return;
      const p = ctx.pose(); let bi = -1, bd = Infinity; flowers.forEach((f, i) => { if (f.st) return; const d = Math.hypot(f.x - p.x, f.y - p.y); if (d < bd) { bd = d; bi = i; } });
      if (bi < 0) return; const f = flowers[bi], qx = sx(f.x), qy = sy(f.y);
      if (offScreen(qx, qy, CW, MH)) edgeArrow(c, qx, qy, sx(p.x), sy(p.y), CW, MH, time, `${Math.round(bd)} m`);
    },
    drawMini(c, ms) { for (const f of flowers) if (!f.st) { c.fillStyle = f.puff ? "#ffffff" : "#ffd21f"; c.beginPath(); c.arc(f.x, f.y, 1.4 / ms, 0, 7); c.fill(); } },
    holes: () => [],
    hud: () => ({ lead: { label: "Dandelions", value: `${got()} / ${total}` }, meter: { label: "Seeds Blown", value: String(blown), frac: 0, good: blown === 0 }, pct: got() / total }),
    outcome: o => ({ ...o, pct: got() / total, stars: [o.stars[0], o.stars[1], o.done && blown === 0], extra: { label: "Seeds Blown", value: String(blown) },
      failLine: `You got ${got()} of ${total} dandelions (${Math.floor((got() / total) * 100)}%). Go from clump to clump: the little map shows where they're left.` }),
    banner: ok => (ok ? "Not A Dandelion Left!" : undefined),
    drawTreeOver: sc.drawTree,
    autoInput(dt) {
      // the tests' driver: the nearest dandelion, easing off near the seed heads; skips one it can't get to for a while
      const p = ctx.pose();
      let bi = -1, bd = Infinity; flowers.forEach((f, i) => { if (f.st || skip.has(i)) return; const d = Math.hypot(f.x - p.x, f.y - p.y); if (d < bd) { bd = d; bi = i; } });
      if (bi < 0) { skip.clear(); return [0, 0]; }
      if (autoT !== bi) { autoT = bi; autoBest = bd; autoStuck = 0; } else if (bd < autoBest - 0.4) { autoBest = bd; autoStuck = 0; } else if ((autoStuck += dt) > 6) { skip.add(bi); autoT = null; }
      const f = flowers[bi]; let inp = router.drive(dt, f.x, f.y, 0);
      if (flowers.some(q => !q.st && q.puff && Math.hypot(q.x - p.x, q.y - p.y) < deckHalf + 3.5)) inp = capPush(inp, pushFor(ctx, SEED_V * 0.8));
      return inp;
    },
    debug: () => ({ total, got: got(), blown, left: flowers.filter(f => !f.st).map(f => [Math.round(f.x * 10) / 10, Math.round(f.y * 10) / 10]) }),
  };
}

// ── Spray the weeds ──
// weed clumps (yard units, size in metres): along the inner fences, the driveway's edges, round the barn, a few patches
// in the lawn, and a couple near the flower beds and the garden (spray those with care)
const WEEDS: [number, number, number][] = [
  [873, 355, 0.45], [883, 391, 0.4], [892, 428, 0.45],                                   // the fence by the house
  [930, 540, 0.45], [984, 752, 0.4], [963, 698, 0.45], [990, 816, 0.4], [1002, 885, 0.45], // the fence down to the barn
  [1060, 931, 0.45], [1118, 920, 0.4], [1197, 903, 0.45],                                 // the south fence
  [1072, -40, 0.4], [1070, 25, 0.45], [1140, -55, 0.45], [1141, 12, 0.4], [1137, 66, 0.4], // the driveway's edges
  [1030, 172, 0.45], [1170, 175, 0.4], [1205, 235, 0.45], [1230, 360, 0.4], [1231, 470, 0.45], [1232, 640, 0.4],   // the turnaround and the lane
  [1030, 772, 0.45], [1040, 830, 0.4], [1075, 727, 0.4], [1100, 724, 0.45], [1192, 780, 0.4], [1194, 822, 0.45], [1150, 868, 0.45],   // round the barn
  [1000, 35, 0.4], [1012, 45, 0.35], [1160, 395, 0.45], [1172, 404, 0.35], [1045, 520, 0.4], [1058, 512, 0.35],   // patches in the lawn
  [962, 60, 0.4], [1077, 278, 0.4], [1155, 642, 0.45], [1095, 586, 0.4],                  // near the flowers and the garden
];
const BOOM = 1.7, TOTE: [number, number] = [1175, 700];
function sprayChore(ctx: ChoreCtx): Chore {
  const w = ctx.w, sc = springScene(ctx), router = makeRouter(ctx);
  { const [sx, sy] = U(1200, 722); ctx.place(sx, sy, Math.PI); }   // Pat starts on the barn lane, by the water tote
  const cart = makeCart(ctx), [tx, ty] = U(TOTE[0], TOTE[1]);
  const weeds = WEEDS.map(([ux, uy, r], i) => { const [x, y] = U(ux, uy); return { x, y, r, seed: 60 + i, st: 0 as 0 | 1, wilt: 0 }; });
  // the beds as points every 25 cm (the spray can't land on any of them)
  const bedPts: Pt[] = [];
  for (const b of ctx.map.beds) { const xs = b.poly.map(q => q[0]), ys = b.poly.map(q => q[1]); for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.25) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.25) if (pip(b.poly, x, y)) bedPts.push([x, y]); }
  const DRAIN = 1 / 24;   // a full tank sprays for 24 s of driving (the careful autopilot needs about 8)
  let on = false, level = 1, hits = 0, hitCool = 0, hissT = 0, fillT = 0, topping = false, emptyTold = false, sprayed = 0;
  const total = weeds.length, got = () => weeds.filter(q => q.st).length;
  const boom = () => { const k = cart.c, ca = Math.cos(k.a), sa = Math.sin(k.a); return { k, ca, sa, inR: (px: number, py: number, pad = 0) => { const dx = px - k.ax, dy = py - k.ay, lon = dx * ca + dy * sa, lat = -dx * sa + dy * ca; return lon < -0.35 + pad && lon > -1.15 - pad && Math.abs(lat) < BOOM + pad; } }; };
  const bedNear = (pad: number) => { const b = boom(); return bedPts.some(([px, py]) => Math.abs(px - b.k.ax) < 3.5 && Math.abs(py - b.k.ay) < 3.5 && b.inR(px, py, pad)); };
  const setOn = (v: boolean) => { if (v && level <= 0.001) { ctx.say("Tank's Empty. Top Up At The Barn"); return; } on = v; ctx.snd.click(); };
  // the autopilot's passes: a straight run from A to B that takes the boom over the weed (A and B open, in plain sight)
  type Pass = { a: Pt; b: Pt; i: number; st: 0 | 1; t: number; tries: number };
  let pass: Pass | null = null;
  const skip = new Set<number>();
  const openAt = (x: number, y: number, need = 1.25) => { if (x < 1 || y < 1 || x > w.W - 1 || y > w.H - 1) return false; const k = w.cellOf(x, y); return w.reach[k] === 1 && w.clearance[k] > need; };
  const lineOk = (ax: number, ay: number, bx: number, by: number, need = 1.0) => { const L = Math.hypot(bx - ax, by - ay), n = Math.ceil(L / 0.3); for (let q = 0; q <= n; q++) if (!openAt(ax + ((bx - ax) * q) / n, ay + ((by - ay) * q) / n, need)) return false; return true; };
  function planPass(i: number, tries = 0): Pass | null {
    const q = weeds[i], p = ctx.pose(); let best: Pass | null = null, bs = Infinity;
    for (let k = 0; k < 24; k++) {
      const th = (k / 24) * Math.PI * 2, ux = Math.cos(th), uy = Math.sin(th);
      for (const o of [0, 0.5, -0.5, 0.9, -0.9, 1.2, -1.2, 1.5, -1.5]) {
        const back = o === 0 || Math.abs(o) > 1 ? 3.5 : 2.2, cx = q.x - uy * o, cy = q.y + ux * o, a: Pt = [cx - ux * back, cy - uy * back], b: Pt = [cx + ux * (4.2 + tries * 0.8), cy + uy * (4.2 + tries * 0.8)];
        if (!openAt(a[0], a[1], 1.05) || !openAt(b[0], b[1], 1.05) || !lineOk(a[0], a[1], b[0], b[1], 0.95)) continue;
        const bedRisk = bedPts.some(([bx, by]) => { const dx = bx - cx, dy = by - cy, lat = Math.abs(-dx * uy + dy * ux), lon = dx * ux + dy * uy; return lat < BOOM + 0.5 && Math.abs(lon) < 2.5; });
        const sc2 = Math.hypot(a[0] - p.x, a[1] - p.y) + Math.abs(o) * 2 + Math.abs(wrapA(th - p.h)) * 1.5 + (bedRisk ? 30 : 0);
        if (sc2 < bs) { bs = sc2; best = { a, b, i, st: 0, t: 0, tries }; }
      }
    }
    return best;
  }
  return {
    hold: () => false, patOff: () => false,
    step(dt) {
      sc.step(dt);
      if (cart.update(dt)) ctx.shake(0.1);
      keepOut(ctx, tx, ty, 0.55);
      for (const q of weeds) if (q.st) q.wilt = Math.min(1, q.wilt + dt * 0.8);
      hitCool = Math.max(0, hitCool - dt);
      const p = ctx.pose(), ph = ctx.phase();
      if (ph !== "play") { if (ph !== "ready") on = false; return; }
      // topping up: stopped by the water tote at the barn
      const nearTote = Math.hypot(p.x - tx, p.y - ty) < 3.6 || Math.hypot(cart.c.ax - tx, cart.c.ay - ty) < 3.2;
      if (nearTote && Math.abs(p.v) < 0.3 && level < 0.999) { fillT += dt; if (fillT > 0.3) { if (!topping) { topping = true; on = false; ctx.say("Topping Up The Tank"); } level = Math.min(1, level + dt * 0.45); if (level >= 1) { ctx.say("Tank's Full"); ctx.snd.coin(); emptyTold = false; } } }
      else { fillT = 0; topping = false; }
      if (!on) return;
      const moving = Math.abs(p.v) > 0.3;
      if (moving) { level = Math.max(0, level - DRAIN * dt); sprayed += dt; }
      if (level <= 0) { on = false; if (!emptyTold) { emptyTold = true; ctx.say("Tank's Empty. Top Up At The Barn"); ctx.snd.fail(); } return; }
      hissT -= dt; if (hissT <= 0) { hissT = 0.28; ctx.snd.hiss(); }
      const b = boom();
      if (moving) for (let k = 0; k < 3; k++) { const o = (Math.random() * 2 - 1) * BOOM, bx = b.k.ax - b.ca * 0.66 - b.sa * o * -1, by = b.k.ay - b.sa * 0.66 + b.ca * o; sc.parts.push({ x: bx, y: by, vx: -b.ca * 0.6 + (Math.random() - 0.5) * 0.3, vy: -b.sa * 0.6 + (Math.random() - 0.5) * 0.3, life: 0.5, max: 0.5, kind: "mist", a: 0 }); }
      for (const q of weeds) if (!q.st && b.inR(q.x, q.y, q.r * 0.5)) { q.st = 1; ctx.snd.pop(); ctx.floatAt(`${got()} / ${total}`, q.x, q.y - 0.8, "#e6f2ff"); if (got() === total) ctx.say("That's Every Weed!"); }
      if (hitCool <= 0 && bedNear(0)) { hits++; hitCool = 2.2; ctx.shake(0.1); ctx.buzz(); ctx.snd.squish(); const [bx, by] = [b.k.ax, b.k.ay]; ctx.floatAt("Not The Flowers!", bx, by - 1.2, "#ffd2cc"); }
    },
    done: () => got() === total,
    drawGround(c, time, cx, cy, vw, vh) {
      sc.drawGround(c, time, cx, cy, vw, vh);
      // the water tote by the barn
      c.save(); c.translate(tx, ty); c.fillStyle = "rgba(20,40,10,0.25)"; c.fillRect(-0.4, -0.3, 1.25, 1.2); c.fillStyle = "#9aa0a6"; c.fillRect(-0.55, -0.55, 1.1, 1.1); c.fillStyle = "#e9eef2"; c.fillRect(-0.47, -0.47, 0.94, 0.94); c.fillStyle = "rgba(90,150,210,0.5)"; c.fillRect(-0.47, -0.1, 0.94, 0.57); c.strokeStyle = "#7d858d"; c.lineWidth = 0.05; for (const o of [-0.16, 0.16]) { c.beginPath(); c.moveTo(o, -0.55); c.lineTo(o, 0.55); c.moveTo(-0.55, o); c.lineTo(0.55, o); c.stroke(); } c.fillStyle = "#2a2d31"; c.beginPath(); c.arc(0, -0.2, 0.12, 0, 7); c.fill(); c.restore();
      if (level < 0.5 && ctx.phase() === "play") { const pu = 0.5 + 0.5 * Math.sin(time * 4); c.strokeStyle = `rgba(95,176,239,${(0.4 + 0.4 * pu).toFixed(3)})`; c.lineWidth = 0.12; c.setLineDash([0.5, 0.35]); c.beginPath(); c.arc(tx, ty, 2.6, 0, 7); c.stroke(); c.setLineDash([]); }
      const few = total - got() <= 6;
      for (const q of weeds) if (Math.abs(q.x - cx) < vw / 2 + 1 && Math.abs(q.y - cy) < vh / 2 + 1) {
        if (!q.st && few) { c.fillStyle = `rgba(255,214,64,${(0.18 + 0.1 * Math.sin(time * 5)).toFixed(3)})`; c.beginPath(); c.arc(q.x, q.y, q.r + 0.4, 0, 7); c.fill(); }
        drawWeed(c, q.x, q.y, q.r * 1.35, q.seed, q.wilt, time);
      }
    },
    drawBelow(c, time) { drawSprayer(c, cart.c.ax, cart.c.ay, cart.c.a, cart.TONGUE, BOOM, level, on && Math.abs(ctx.pose().v) > 0.3, time); },
    drawAbove(c) { sc.drawAbove(c); },
    drawScreen(c, sx, sy, CW, MH, time) {
      sc.drawScreen(c, CW, MH);
      const ph = ctx.phase(); if (ph !== "play" && ph !== "ready") return;
      const p = ctx.pose();
      if (level <= 0.001 || topping) { const qx = sx(tx), qy = sy(ty); if (offScreen(qx, qy, CW, MH)) edgeArrow(c, qx, qy, sx(p.x), sy(p.y), CW, MH, time, "Refill"); if (topping) pill(c, "Topping Up", CW / 2, MH - 30, 13, "#245a8a", "rgba(255,255,255,0.97)", 16, 32); return; }
      let bi = -1, bd = Infinity; weeds.forEach((q, i) => { if (q.st) return; const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0) { const q = weeds[bi], qx = sx(q.x), qy = sy(q.y); if (offScreen(qx, qy, CW, MH)) edgeArrow(c, qx, qy, sx(p.x), sy(p.y), CW, MH, time, `${Math.round(bd)} m`); }
      if (ph === "ready") pill(c, "Tap Spray To Turn It On", CW / 2, MH - 70, 12, "#245a8a", "rgba(255,255,255,0.92)", 12, 26);
    },
    drawMini(c, ms) { for (const q of weeds) if (!q.st) { c.fillStyle = "#8a3fa0"; c.beginPath(); c.arc(q.x, q.y, 1.6 / ms, 0, 7); c.fill(); } c.fillStyle = "#3d8ad6"; c.fillRect(tx - 2.2 / ms, ty - 2.2 / ms, 4.4 / ms, 4.4 / ms); },
    holes() { return [[cart.c.ax, cart.c.ay, 2.2]]; },
    hud: () => ({ lead: { label: "Weeds", value: `${got()} / ${total}` }, meter: { label: "Flowers", value: hits ? `${hits} Spray${hits > 1 ? "s" : ""}` : "Safe", frac: 0, good: hits === 0 }, pct: got() / total }),
    outcome: o => ({ ...o, pct: got() / total, stars: [o.stars[0], o.stars[1], o.done && hits === 0], extra: { label: "Flower Sprays", value: String(hits) },
      failLine: `Pat sprayed ${got()} of ${total} weeds. Turn the sprayer on just before a weed and off again after, and top up at the barn when it runs low.` }),
    banner: ok => (ok ? "Weeds Done!" : undefined),
    focus() { const p = ctx.pose(); return [[p.x, p.y], [cart.c.ax, cart.c.ay]]; },
    button: () => (ctx.phase() === "play" || ctx.phase() === "ready" ? { label: "Spray", on, level } : null),
    press() { if (ctx.phase() === "play" || ctx.phase() === "ready") setOn(!on); },
    drawTreeOver: sc.drawTree,
    autoInput(dt) {
      // the tests' driver: tops up when low; for each weed (nearest first) it lines up a straight pass that takes the
      // boom right over it, and sprays only when a weed's about to go under the boom and no bed is near
      const p = ctx.pose();
      const want = (() => { const b = boom(); return weeds.some(q => !q.st && Math.hypot(q.x - b.k.ax, q.y - b.k.ay) < 2.4 && b.inR(q.x, q.y, 0.9)); })() && !bedNear(0.35);
      if (want !== on && level > 0.001) setOn(want);
      if (level < 0.12 || topping) { if (level >= 0.999) { topping = false; } else { const d = Math.hypot(p.x - tx, p.y - ty); if (d < 3.0) return [0, 0]; return router.drive(dt, tx + 1.2, ty + 1.8, 4); } }
      if (pass && (weeds[pass.i].st || (pass.t += dt) > 14)) { if (!weeds[pass.i].st) skip.add(pass.i); pass = null; }
      if (!pass) {
        let bi = -1, bd = Infinity; weeds.forEach((q, i) => { if (q.st || skip.has(i)) return; const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; bi = i; } });
        if (bi < 0) { skip.clear(); return [0, 0]; }
        pass = planPass(bi); if (!pass) { skip.add(bi); return [0, 0]; }
      }
      if (pass.st === 0) { if (Math.hypot(pass.a[0] - p.x, pass.a[1] - p.y) < 1.3) pass.st = 1; else return capPush(router.drive(dt, pass.a[0], pass.a[1], 3), pushFor(ctx, 5.5)); }
      const dx = pass.b[0] - p.x, dy = pass.b[1] - p.y, d = Math.hypot(dx, dy);
      if (d < 0.9) { if (!weeds[pass.i].st && ++pass.tries < 3) { pass = planPass(pass.i, pass.tries); return [0, 0]; } if (!weeds[pass.i].st) skip.add(pass.i); pass = null; return [0, 0]; }
      const m2 = pushFor(ctx, 4.5); return [(dx / d) * m2, (dy / d) * m2];
    },
    debug: () => ({ total, got: got(), hits, level, on, sprayed, left: weeds.map((q, i) => (q.st ? -1 : i)).filter(i => i >= 0), cart: cart.c }),
  };
}

// ── Fresh gravel ──
// muddy holes in the driveway (yard units): up the drive from the road, in the turnaround, and down the lane
const MUD: [number, number][] = [[1106, -38], [1107, 18], [1106, 70], [1048, 124], [1118, 134], [1170, 198], [1236, 283], [1251, 380], [1252, 466]];
const PILE: [number, number] = [1170, -28];
function gravelChore(ctx: ChoreCtx): Chore {
  const m = ctx.map, w = ctx.w, sc = springScene(ctx), router = makeRouter(ctx), walker = makeWalker(ctx);
  { const [sx, sy] = U(1106, 60); ctx.place(sx, sy, -Math.PI / 2); }   // Pat starts at the top of the drive, by the house
  const cart = makeCart(ctx), [px, py] = U(PILE[0], PILE[1]), PILE_R = 2.0, LOAD_R = PILE_R + 2.5;
  // the driveway's gravel (the lanes and the turnaround), less a strip at the edges; the muddy cells are what's to fix
  const lanes = [m.lanes[0], m.lanes[1]], drive = m.driveway[0];
  const onCore = (x: number, y: number) => {
    for (const l of lanes) for (let i = 1; i < l.pts.length; i++) { const a = l.pts[i - 1], b = l.pts[i], q = segClosest(a[0], a[1], b[0], b[1], x, y); if (Math.hypot(x - q[0], y - q[1]) < l.width / 2 - 0.45) return true; }
    if (drive && pip(drive, x, y)) { let near = Infinity; for (let i = 0; i < drive.length; i++) { const a = drive[i], b = drive[(i + 1) % drive.length], q = segClosest(a[0], a[1], b[0], b[1], x, y); near = Math.min(near, Math.hypot(x - q[0], y - q[1])); } return near > 0.45; }
    return false;
  };
  const holes = MUD.map(([ux, uy]) => U(ux, uy));
  const thin = new Uint8Array(w.N), cells: number[] = [];
  for (let k = 0; k < w.N; k++) { const x = w.cellX(k), y = w.cellY(k); if (holes.some(([hx, hy]) => Math.hypot((hx - x) * 0.85, hy - y) < 2.0) && onCore(x, y)) { thin[k] = 1; cells.push(k); } }
  const total = cells.length, CAP = Math.ceil(total / 3.2);
  let fixed = 0, load = 0, pileAmt = 1, allFresh = false;
  // the driveway layer: the mud painted once, fresh gravel painted over it as it goes down
  const xs = cells.map(k => w.cellX(k)), ys = cells.map(k => w.cellY(k)), X0 = Math.min(...xs) - 2, Y0 = Math.min(...ys) - 2, X1 = Math.max(...xs) + 2, Y1 = Math.max(...ys) + 2, LPX = 20;
  const layer = document.createElement("canvas"); layer.width = Math.ceil((X1 - X0) * LPX); layer.height = Math.ceil((Y1 - Y0) * LPX);
  const lc = layer.getContext("2d")!; lc.scale(LPX, LPX); lc.translate(-X0, -Y0);
  const rnd = mulberry32(91);
  for (const k of cells) { lc.fillStyle = "#7a6248"; lc.beginPath(); lc.arc(w.cellX(k), w.cellY(k), 0.36, 0, 7); lc.fill(); }
  for (const [hx, hy] of holes) { lc.save(); lc.beginPath(); for (const k of cells) { if (Math.hypot(w.cellX(k) - hx, w.cellY(k) - hy) > 2.6) continue; lc.moveTo(w.cellX(k) + 0.38, w.cellY(k)); lc.arc(w.cellX(k), w.cellY(k), 0.38, 0, 7); } lc.clip(); paintMud(lc, rnd, hx, hy, 2.2, 1.4, rnd() * 3); lc.restore(); }
  const freshAt = (x: number, y: number, r: number) => { lc.fillStyle = "#c9bfa9"; lc.beginPath(); lc.arc(x, y, r * 0.9, 0, 7); lc.fill(); paintGravel(lc, rnd, x, y, r, Math.round(r * r * 90)); };
  function freshenAll() {
    if (allFresh) return; allFresh = true;
    for (let k = 0; k < w.N; k++) { const x = w.cellX(k), y = w.cellY(k); if (x < X0 || x > X1 || y < Y0 || y > Y1) continue; if (onCore(x, y) || (thin[k] && !0)) freshAt(x, y, 0.42); }
  }
  // Pat shovelling a load: off the seat, between the cart and the pile, three scoops, back on
  const spotBy = (): Pt => { const k = cart.c, dx = px - k.ax, dy = py - k.ay, d = Math.hypot(dx, dy) || 1; return [k.ax + (dx / d) * 1.1, k.ay + (dy / d) * 1.1]; };
  function startLoad() {
    const scoop = (): Parameters<typeof walker.start>[0] => [
      { face: () => [px, py], wait: 0.35, look: { tool: "shovel", full: null }, anim: (u, me) => { me.look.dig = Math.sin(u * Math.PI); }, then: () => ctx.snd.crunch() },
      { face: () => [cart.c.ax, cart.c.ay], wait: 0.3, look: { full: "gravel" }, anim: (u, me) => { me.look.dig = 0.2; void u; } , then: () => { load = Math.min(1, load + 1 / 3); pileAmt = Math.max(0.15, pileAmt - 0.025); walker.me.look.full = null; for (let k = 0; k < 6; k++) sc.parts.push({ x: cart.c.ax + (Math.random() - 0.5) * 0.6, y: cart.c.ay + (Math.random() - 0.5) * 0.4, vx: (Math.random() - 0.5), vy: (Math.random() - 0.5), life: 0.3, max: 0.3, kind: "gravel", a: 0 }); ctx.snd.crunch(); } },
    ];
    walker.start([{ go: () => walker.seat(1) }, { go: spotBy, look: { tool: "shovel" } }, ...scoop(), ...scoop(), ...scoop(), { go: () => walker.seat(1), look: { tool: null }, then: () => ctx.say("Cart's Full") }]);
  }
  let stillT = 0, emptyTold = true, autoT = -1, autoBest = Infinity, autoStuck = 0, autoGo: Pt | null = null;
  const skip = new Set<number>();
  const cartNearPile = () => Math.hypot(cart.c.ax - px, cart.c.ay - py) < LOAD_R;
  const pct = () => (total ? fixed / total : 1);
  return {
    hold: () => walker.me.on, patOff: () => walker.me.on,
    step(dt) {
      sc.step(dt);
      if (cart.update(dt)) ctx.shake(0.1);
      keepOut(ctx, px, py, (1.5 + 0.9 * pileAmt) * 0.9);
      walker.step(dt);
      const p = ctx.pose(), ph = ctx.phase();
      if (ph !== "play") return;
      // loading: stopped with the cart beside the pile
      if (!walker.me.on && load < 0.99 && cartNearPile() && Math.abs(p.v) < 0.3) { stillT += dt; if (stillT > 0.35) { stillT = 0; startLoad(); emptyTold = false; } } else stillT = 0;
      // spreading: the cart drops gravel on the muddy cells it goes over
      if (load > 0 && Math.abs(p.v) > 0.2 && !walker.me.on) {
        const k = cart.c, ca = Math.cos(k.a), sa = Math.sin(k.a);
        const i0 = Math.floor((k.ax - 2) / CELL), i1 = Math.floor((k.ax + 2) / CELL), j0 = Math.floor((k.ay - 2) / CELL), j1 = Math.floor((k.ay + 2) / CELL);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          if (i < 0 || j < 0 || i >= w.NX || j >= w.NY) continue; const n = j * w.NX + i; if (thin[n] !== 1) continue;
          const dx = w.cellX(n) - k.ax, dy = w.cellY(n) - k.ay, lon = dx * ca + dy * sa, lat = -dx * sa + dy * ca;
          if (lon > 0.6 || lon < -1.2 || Math.abs(lat) > 1.3) continue;
          thin[n] = 2; fixed++; load = Math.max(0, load - 1 / CAP); freshAt(w.cellX(n), w.cellY(n), 0.42);
          if (Math.random() < 0.4) sc.parts.push({ x: w.cellX(n), y: w.cellY(n), vx: (Math.random() - 0.5), vy: (Math.random() - 0.5), life: 0.3, max: 0.3, kind: "gravel", a: 0 });
          if (load <= 0) break;
        }
        if (load <= 1e-6) { load = 0; if (!emptyTold && pct() < 0.97) { emptyTold = true; ctx.say("Cart's Empty. Back To The Pile"); } }
      }
      if (pct() >= 0.97) freshenAll();
    },
    done: () => pct() >= 0.97 && !walker.me.on,
    drawGround(c, time, cx, cy, vw, vh) {
      sc.drawGround(c, time, cx, cy, vw, vh);
      c.drawImage(layer, X0, Y0, X1 - X0, Y1 - Y0);
      if (pct() >= 0.85 && !allFresh) { const pu = 0.5 + 0.5 * Math.sin(time * 5); c.fillStyle = `rgba(255,216,80,${(0.3 + 0.3 * pu).toFixed(3)})`; c.beginPath(); for (const k of cells) if (thin[k] === 1) { c.moveTo(w.cellX(k) + 0.42, w.cellY(k)); c.arc(w.cellX(k), w.cellY(k), 0.42, 0, 7); } c.fill(); }
      drawGravelPile(c, px, py, pileAmt, 7);
      if (load < 0.99 && ctx.phase() === "play" && !walker.me.on) { const pu = 0.5 + 0.5 * Math.sin(time * 4); c.strokeStyle = `rgba(255,214,64,${(0.45 + 0.4 * pu).toFixed(3)})`; c.lineWidth = 0.12; c.setLineDash([0.5, 0.35]); c.beginPath(); c.arc(px, py, LOAD_R, 0, 7); c.stroke(); c.setLineDash([]); }
    },
    drawBelow(c, time) { drawDumpCart(c, cart.c.ax, cart.c.ay, cart.c.a, cart.TONGUE, load, load > 0 && Math.abs(ctx.pose().v) > 0.2, time); },
    drawAbove(c, time) { walker.draw(c, time); sc.drawAbove(c); },
    drawScreen(c, sx, sy, CW, MH, time) {
      sc.drawScreen(c, CW, MH);
      const ph = ctx.phase(); if (ph !== "play" && ph !== "ready") return;
      const p = ctx.pose();
      if (load <= 0.001 && !walker.me.on) { const qx = sx(px), qy = sy(py); if (offScreen(qx, qy, CW, MH)) edgeArrow(c, qx, qy, sx(p.x), sy(p.y), CW, MH, time, "Gravel"); else if (cartNearPile() && Math.abs(p.v) >= 0.3) pill(c, "Stop Here To Load", CW / 2, MH - 30, 13, "#2f5a1f", "rgba(255,255,255,0.97)", 16, 32); return; }
      if (walker.me.on) { pill(c, "Shovelling A Load", CW / 2, MH - 30, 13, "#2f5a1f", "rgba(255,255,255,0.97)", 16, 32); return; }
      let best = -1, bd = Infinity; for (const k of cells) if (thin[k] === 1) { const d = Math.hypot(w.cellX(k) - p.x, w.cellY(k) - p.y); if (d < bd) { bd = d; best = k; } }
      if (best >= 0) { const qx = sx(w.cellX(best)), qy = sy(w.cellY(best)); if (offScreen(qx, qy, CW, MH)) edgeArrow(c, qx, qy, sx(p.x), sy(p.y), CW, MH, time, `${Math.round(bd)} m`); }
    },
    drawMini(c, ms) { for (const k of cells) if (thin[k] === 1) { c.fillStyle = "#7a5230"; c.fillRect(w.cellX(k) - 0.5, w.cellY(k) - 0.5, 1, 1); } c.fillStyle = "#9c9384"; c.strokeStyle = "#fff"; c.lineWidth = 0.6 / ms; c.beginPath(); c.arc(px, py, 2.6 / ms, 0, 7); c.fill(); c.stroke(); },
    holes() { const out: [number, number, number][] = [[cart.c.ax, cart.c.ay, 2.0]]; if (walker.me.on) out.push([walker.me.x, walker.me.y, 1.6]); return out; },
    hud: () => ({ lead: { label: "Driveway", value: allFresh ? "100%" : fmtPct(Math.min(0.999, pct() / 0.97)) }, meter: { label: "Cart", value: load <= 0.001 ? "Empty" : load > 0.95 ? "Full" : `${Math.round(load * 100)}%`, frac: load, good: load > 0.001 }, pct: Math.min(1, pct() / 0.97) }),
    outcome: o => ({ ...o, pct: pct(), stars: [o.stars[0], o.stars[1], o.done && o.bumps === 0], extra: { label: "Big Bumps", value: String(o.bumps) },
      failLine: `The driveway got to ${Math.floor(pct() * 100)}%. Stop with the cart right beside the pile to load up, then drive the cart straight over the muddy patches.` }),
    banner: ok => { if (ok) freshenAll(); return ok ? "Fresh As New!" : undefined; },
    focus() { return [U(1106, -60), U(1060, 150), U(1140, 150)]; },   // the end: the drive and the turnaround, all fresh
    drawTreeOver: sc.drawTree,
    autoInput(dt) {
      // the tests' driver: when empty, park the cart beside the pile; when loaded, drive the nearest muddy cells
      if (walker.me.on) return [0, 0];
      const p = ctx.pose();
      if (load <= 0.001) {
        if (cartNearPile()) return [0, 0];
        const [gx, gy] = U(1108, -48); return router.drive(dt, gx, gy, 5);
      }
      if (autoGo) { if (Math.hypot(autoGo[0] - p.x, autoGo[1] - p.y) < 0.9) autoGo = null; else return capPush(router.drive(dt, autoGo[0], autoGo[1], 0), pushFor(ctx, 3.4)); }
      let best = -1, bd = Infinity; for (const k of cells) { if (thin[k] !== 1 || skip.has(k)) continue; const d = Math.hypot(w.cellX(k) - p.x, w.cellY(k) - p.y); if (d < bd) { bd = d; best = k; } }
      if (best < 0) { skip.clear(); return [0, 0]; }
      if (autoT !== best) { autoT = best; autoBest = bd; autoStuck = 0; } else if (bd < autoBest - 0.3) { autoBest = bd; autoStuck = 0; } else if ((autoStuck += dt) > 5) { skip.add(best); autoT = -1; }
      if (bd < 0.8) { const g: Pt = [w.cellX(best) + Math.cos(p.h) * 3, w.cellY(best) + Math.sin(p.h) * 3], k = w.cellOf(g[0], g[1]); autoGo = w.reach[k] && w.clearance[k] > 1.1 ? g : null; }   // carry on so the cart goes over it
      return capPush(router.drive(dt, w.cellX(best), w.cellY(best), 0), pushFor(ctx, 4));
    },
    debug: () => ({ total, fixed, pct: pct(), load, cap: CAP, walker: walker.me.on, cart: cart.c, pile: [px, py] }),
  };
}

// ── Plant trees ──
// the stakes for the new row (yard units), across the big field just inside the gate
const STAKES: [number, number][] = [[870, 600], [800, 600], [730, 600], [660, 600], [590, 600], [520, 600]];
const WAGON: [number, number] = [1085, 712];
function treesChore(ctx: ChoreCtx): Chore {
  const sc = springScene(ctx), router = makeRouter(ctx), walker = makeWalker(ctx), REACH = 4.4, HOLD = 3;
  { const [sx, sy] = U(1195, 722); ctx.place(sx, sy, Math.PI); }   // Pat starts on the barn lane
  const cart = makeCart(ctx), [wx, wy] = U(WAGON[0], WAGON[1]);
  const stakes = STAKES.map(([ux, uy], i) => { const [x, y] = U(ux, uy); return { x, y, st: 0 as 0 | 1 | 2, grow: 0, wet: 0, seed: 70 + i }; });   // 0 waiting, 1 Pat's planting it, 2 planted
  const total = stakes.length;
  let onCart = 0, onWagon = total, stillT = 0, hintT = 0, autoReady = -1;
  const planted = () => stakes.filter(s => s.st === 2).length;
  const nearest = () => { const p = ctx.pose(); let bi = -1, bd = Infinity; stakes.forEach((s, i) => { if (s.st) return; const d = Math.hypot(s.x - p.x, s.y - p.y); if (d < bd) { bd = d; bi = i; } }); return { i: bi, d: bd }; };
  const cartSide = (): Pt => { const k = cart.c, p = ctx.pose(), sx2 = -Math.sin(k.a), sy2 = Math.cos(k.a), side = (p.x - k.ax) * sx2 + (p.y - k.ay) * sy2 >= 0 ? 1 : -1; return [k.ax + sx2 * side * 0.95, k.ay + sy2 * side * 0.95]; };
  const nearWagon = () => Math.hypot(cart.c.ax - wx, cart.c.ay - wy) < 3.8 || Math.hypot(ctx.pose().x - wx, ctx.pose().y - wy) < 3.8;
  function startLoad() {
    const n = Math.min(HOLD - onCart, onWagon); if (n <= 0) return;
    const wagonSide = (): Pt => { const p = ctx.pose(), d = Math.hypot(p.x - wx, p.y - wy) || 1; return [wx + ((p.x - wx) / d) * 1.0, wy + ((p.y - wy) / d) * 1.0]; };
    walker.start([{ go: () => walker.seat(1) }, { go: wagonSide }, { face: () => [wx, wy], wait: 0.4, look: { bend: 0.6 }, then: () => { onWagon -= n; walker.me.look.carry = "pots"; walker.me.look.bend = 0; } }, { go: cartSide }, { face: () => [cart.c.ax, cart.c.ay], wait: 0.35, then: () => { onCart += n; walker.me.look.carry = null; ctx.snd.clank(); } }, { go: () => walker.seat(1), then: () => ctx.say(n > 1 ? `${n} Trees On Board` : "1 Tree On Board") }]);
  }
  function startPlant(i: number) {
    const s = stakes[i], p = ctx.pose(); if (walker.me.on || s.st) return;
    if (onCart <= 0) { ctx.say(onWagon > 0 ? "Load Up At The Nursery Cart" : "No Trees Left"); hintT = 2; return; }
    if (Math.hypot(s.x - p.x, s.y - p.y) > REACH) { ctx.say("Pull Up Closer To That One"); hintT = 2; return; }
    s.st = 1; autoReady = -1;
    const front = (): Pt => { const d = Math.hypot(s.x - walker.me.x, s.y - walker.me.y) || 1; return [s.x - ((s.x - walker.me.x) / d) * 0.7, s.y - ((s.y - walker.me.y) / d) * 0.7]; };
    walker.start([
      { go: cartSide }, { face: () => [cart.c.ax, cart.c.ay], wait: 0.3, look: { bend: 0.5 }, then: () => { onCart--; walker.me.look = { ...walker.me.look, carry: "pot", bend: 0 }; } },
      { go: front }, { face: () => [s.x, s.y], wait: 0.25, look: { carry: null, tool: "shovel" } },
      { face: () => [s.x, s.y], wait: 1.0, anim: (u, me) => { me.look.dig = Math.abs(Math.sin(u * Math.PI * 3)); me.look.full = Math.sin(u * Math.PI * 3) < 0 ? "dirt" : null; if (Math.random() < 0.15) sc.parts.push({ x: s.x + (Math.random() - 0.5) * 0.5, y: s.y + (Math.random() - 0.5) * 0.5, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, life: 0.4, max: 0.4, kind: "dirt", a: 0 }); }, then: () => ctx.snd.crunch() },
      { face: () => [s.x, s.y], wait: 0.4, look: { tool: null, full: null, dig: 0, bend: 0.7 }, then: () => { s.grow = 0.01; ctx.snd.pop(); } },
      { face: () => [s.x, s.y], wait: 1.0, look: { tool: "can", bend: 0 }, anim: (u, me) => { me.look.pour = 1; s.wet = u; if (Math.random() < 0.3) sc.parts.push({ x: s.x + (Math.random() - 0.5) * 0.4, y: s.y + (Math.random() - 0.5) * 0.4, vx: 0, vy: 0.3, life: 0.3, max: 0.3, kind: "drop", a: 0 }); } },
      { go: () => walker.seat(1), look: { tool: null, pour: 0 }, then: () => { s.st = 2; ctx.snd.coin(); ctx.floatAt(`${planted()} / ${total}`, s.x, s.y - 1.6, "#fff4c2"); if (planted() === total) ctx.say("That's The Whole Row!"); else if (onCart === 0) ctx.say("Back To The Nursery Cart"); } },
    ]);
  }
  return {
    hold: () => walker.me.on, patOff: () => walker.me.on,
    step(dt) {
      sc.step(dt);
      if (cart.update(dt)) ctx.shake(0.1);
      keepOut(ctx, wx, wy, 1.05);
      walker.step(dt); hintT = Math.max(0, hintT - dt);
      for (const s of stakes) if (s.grow > 0) s.grow = Math.min(1, s.grow + dt * 2);
      const p = ctx.pose();
      if (ctx.phase() !== "play") return;
      if (!walker.me.on && onCart < HOLD && onWagon > 0 && onCart + planted() + stakes.filter(s => s.st === 1).length < total && nearWagon() && Math.abs(p.v) < 0.3) { stillT += dt; if (stillT > 0.35) { stillT = 0; startLoad(); } } else stillT = 0;
    },
    tap(x, y) {
      const ph = ctx.phase(); if (ph !== "play" && ph !== "ready") return;
      let bi = -1, bd = 2.2; stakes.forEach((s, i) => { if (s.st) return; const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0) startPlant(bi);
    },
    done: () => planted() === total && !walker.me.on,
    drawGround(c, time, cx, cy, vw, vh) {
      sc.drawGround(c, time, cx, cy, vw, vh);
      const n = nearest(), p = ctx.pose();
      for (const [i, s] of stakes.entries()) {
        if (s.grow > 0) { drawMound(c, s.x, s.y, s.wet); continue; }
        drawStake(c, s.x, s.y, time, i === n.i && !walker.me.on && n.d <= REACH && Math.abs(p.v) < 1.5 && onCart > 0 ? 1 : 0);
      }
      drawNursery(c, wx, wy, 0, onWagon, time);
      if (onCart === 0 && onWagon > 0 && !walker.me.on && ctx.phase() === "play") { const pu = 0.5 + 0.5 * Math.sin(time * 4); c.strokeStyle = `rgba(255,214,64,${(0.45 + 0.4 * pu).toFixed(3)})`; c.lineWidth = 0.12; c.setLineDash([0.5, 0.35]); c.beginPath(); c.arc(wx, wy, 3.0, 0, 7); c.stroke(); c.setLineDash([]); }
    },
    drawBelow(c, time) {
      const k = cart.c; drawCart(c, k.ax, k.ay, k.a, cart.TONGUE, {});
      for (let i = 0; i < onCart; i++) { const o = (i - (onCart - 1) / 2) * 0.42; drawPotted(c, k.ax - Math.sin(k.a) * o, k.ay + Math.cos(k.a) * o, time, 40 + i, 0.85); }
    },
    drawAbove(c, time) {
      for (const s of stakes) if (s.grow > 0) drawSapling(c, s.x, s.y, 0.2 + 0.5 * s.grow, time, s.seed);   // the new trees stand over the grass
      walker.draw(c, time); sc.drawAbove(c);
    },
    drawScreen(c, sx, sy, CW, MH, time) {
      sc.drawScreen(c, CW, MH);
      const ph = ctx.phase(); if (ph !== "play" && ph !== "ready") return;
      const p = ctx.pose(), n = nearest();
      if (walker.me.on) return;
      if (onCart === 0 && onWagon > 0) { const qx = sx(wx), qy = sy(wy); if (offScreen(qx, qy, CW, MH)) edgeArrow(c, qx, qy, sx(p.x), sy(p.y), CW, MH, time, "Trees"); else if (nearWagon() && Math.abs(p.v) >= 0.3) pill(c, "Stop Here To Load", CW / 2, MH - 30, 13, "#2f5a1f", "rgba(255,255,255,0.97)", 16, 32); return; }
      if (n.i >= 0 && n.d <= REACH && Math.abs(p.v) < 1.5) pill(c, "Tap The Stake", CW / 2, MH - 30, 13, "#2f5a1f", "rgba(255,255,255,0.97)", 16, 32);
      if (n.i >= 0) { const s = stakes[n.i], qx = sx(s.x), qy = sy(s.y); if (offScreen(qx, qy, CW, MH)) edgeArrow(c, qx, qy, sx(p.x), sy(p.y), CW, MH, time, `${Math.round(n.d)} m`); }
      void hintT;
    },
    drawMini(c, ms) { for (const s of stakes) { c.fillStyle = s.st === 2 ? "#4f8a34" : "#f2762a"; c.strokeStyle = "#fff"; c.lineWidth = 0.6 / ms; c.beginPath(); c.arc(s.x, s.y, 2.0 / ms, 0, 7); c.fill(); c.stroke(); } if (onWagon) { c.fillStyle = "#8a5a35"; c.fillRect(wx - 2.4 / ms, wy - 1.6 / ms, 4.8 / ms, 3.2 / ms); } },
    holes() { const out: [number, number, number][] = [[cart.c.ax, cart.c.ay, 1.8]]; if (walker.me.on) out.push([walker.me.x, walker.me.y, 1.6]); for (const s of stakes) out.push([s.x, s.y, 1.0]); return out; },
    hud: () => ({ lead: { label: "Trees", value: `${planted()} / ${total}` }, meter: { label: "On The Cart", value: String(onCart), frac: onCart / HOLD, good: onCart > 0 }, pct: planted() / total }),
    outcome: o => ({ ...o, pct: planted() / total, stars: [o.stars[0], o.stars[1], o.done && o.meows === 0], extra: { label: "Cat Stops", value: String(o.meows) },
      failLine: `Pat planted ${planted()} of ${total} trees. Stop right beside each stake so he only has a step or two to walk.` }),
    banner: ok => (ok ? "A Brand New Row!" : undefined),
    focus() { return stakes.map(s => [s.x, s.y] as [number, number]); },
    drawTreeOver: sc.drawTree,
    autoInput(dt) {
      // the tests' driver: load at the wagon when the cart's empty, then the nearest stake; stop beside it and wait for
      // the tap (the test taps the screen)
      if (walker.me.on) return [0, 0];
      if (onCart === 0 && onWagon > 0) { if (nearWagon()) return [0, 0]; const [gx, gy] = U(1122, 716); return router.drive(dt, gx, gy, 5); }
      if (autoReady >= 0) { if (stakes[autoReady].st) autoReady = -1; else return [0, 0]; }
      const n = nearest(); if (n.i < 0) return [0, 0];
      const s = stakes[n.i];
      if (n.d < REACH - 1.4) { autoReady = n.i; return [0, 0]; }
      return router.drive(dt, s.x, s.y, 5);
    },
    debug: () => ({ stakes: stakes.map(s => ({ x: s.x, y: s.y, st: s.st })), planted: planted(), total, onCart, onWagon, ready: autoReady, walker: walker.me.on, cart: cart.c, reach: REACH, wagon: [wx, wy] }),
  };
}
