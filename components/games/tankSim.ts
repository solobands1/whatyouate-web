// Pea Tanks rules: the kitchen table, the lunchboxes, the peas, the boosts, and the computer driver.
// Pure: no React, no DOM, no network. The game, the live host, the guest's prediction and the headless balance check
// all run this exact code. The map is made from a seed with + - * / and sqrt only, so a seed gives the same table on
// every phone (a live match sends the map anyway).
// Arena coordinates: x right, y down, angles in radians from +x (canvas style). Player 0 starts at the bottom.

export const AW = 360, AH = 440, DT = 1 / 60;
export const TANK_R = 13, PEA_R = 3.5, PEA_SPEED = 240, TANK_SPEED = 76, TURN = 3.6;
export const HP = 100, DMG = 20, COOLDOWN = 0.5, RAPID_COOLDOWN = 0.2, MAX_PEAS = 3, RAPID_PEAS = 6;
export const BOOST_T = 5, SPEED_MULT = 1.45, PICK_LIFE = 9, ROUND_T = 60, DRIVE_MIN = 0.35;
export const SPAWNS = [{ x: AW / 2, y: AH - 34 }, { x: AW / 2, y: 34 }];

export type Pt = { x: number; y: number };
export type Ob = { k: 0; x: number; y: number; w: number; h: number; c: number } | { k: 1; x: number; y: number; r: number; c: number };   // 0 cereal box, 1 fruit bowl
export type TableMap = { obs: Ob[]; pads: Pt[] };   // pads come in mirrored pairs: [a0, b0, a1, b1, ...]
export type Tank = { x: number; y: number; a: number; hp: number; cd: number; fc: number; speedT: number; rapidT: number; vx: number; vy: number };
export type Pea = { id: number; o: number; x: number; y: number; vx: number; vy: number; cs: number };
export type Pick = { id: number; k: number; x: number; y: number; life: number };   // k: 0 water (speed), 1 strawberry (rapid fire)
export type Input = { ax: number; ay: number; fire: boolean; fc: number; s?: number };
export type Ev = { id: number; k: "hit" | "pick" | "splat"; x: number; y: number; v: number; n: number };
export type World = {
  map: TableMap; tanks: Tank[]; peas: Pea[]; picks: Pick[]; tick: number; time: number; nextId: number;
  pickT: number; pickN: number; rnd: () => number; events: Ev[];
  shots: number[]; hits: number[]; dealt: number[]; grabs: number[][];
  /** live host only: where a pea's target was on the shooter's screen (lag compensation); null = where it is now */
  lagPos: ((victim: number, pea: Pea) => Pt) | null;
};

export function mulberry32(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export function wrapAngle(a: number) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

// ── the table ──────────────────────────────────────────────────────────────
const BOXES = [[50, 26], [26, 50], [34, 34], [62, 22], [22, 62], [40, 28], [28, 40]];
function obDist(o: Ob, x: number, y: number) {   // distance from a point to the edge of an obstacle (negative inside)
  if (o.k === 1) return Math.sqrt((x - o.x) * (x - o.x) + (y - o.y) * (y - o.y)) - o.r;
  const dx = Math.abs(x - o.x) - o.w / 2, dy = Math.abs(y - o.y) - o.h / 2;
  if (dx <= 0 && dy <= 0) return dx > dy ? dx : dy;
  const ex = dx > 0 ? dx : 0, ey = dy > 0 ? dy : 0;
  return Math.sqrt(ex * ex + ey * ey);
}
function obGap(a: Ob, b: Ob) {   // rough gap between two obstacles (bounding circles for bowls, boxes as boxes)
  if (a.k === 0 && b.k === 0) {
    const dx = Math.abs(a.x - b.x) - (a.w + b.w) / 2, dy = Math.abs(a.y - b.y) - (a.h + b.h) / 2;
    if (dx <= 0 && dy <= 0) return dx > dy ? dx : dy;
    const ex = dx > 0 ? dx : 0, ey = dy > 0 ? dy : 0; return Math.sqrt(ex * ex + ey * ey);
  }
  const c = a.k === 1 ? a : b, o = a.k === 1 ? b : a;
  return obDist(o, c.x, c.y) - (c as { r: number }).r;
}
export function clearAt(map: TableMap, x: number, y: number, m: number) {
  if (x < m || y < m || x > AW - m || y > AH - m) return false;
  for (const o of map.obs) if (obDist(o, x, y) < m) return false;
  return true;
}
/** A table from a seed: a fruit bowl or cereal box in the middle, then 3 or 4 mirrored pairs (the table looks the same
 *  from both ends), every spot reachable, and the two starting spots out of each other's line of fire. */
export function makeMap(seed: number): TableMap {
  const rnd = mulberry32(seed);
  for (let attempt = 0; attempt < 60; attempt++) {
    const obs: Ob[] = [];
    const cr = rnd();
    if (cr < 0.55) obs.push({ k: 1, x: AW / 2, y: AH / 2, r: 26 + Math.floor(rnd() * 7), c: Math.floor(rnd() * 3) });
    else { const wide = rnd() < 0.75; obs.push({ k: 0, x: AW / 2, y: AH / 2, w: wide ? 74 : 30, h: wide ? 30 : 56, c: Math.floor(rnd() * 3) }); }
    const want = 3 + (rnd() < 0.5 ? 1 : 0);
    let pairs = 0;
    for (let tries = 0; tries < 300 && pairs < want; tries++) {
      let o: Ob;
      if (rnd() < 0.4) { const r = 18 + Math.floor(rnd() * 8); o = { k: 1, x: 0, y: 0, r, c: Math.floor(rnd() * 3) }; }
      else { const b = BOXES[Math.floor(rnd() * BOXES.length)]; o = { k: 0, x: 0, y: 0, w: b[0], h: b[1], c: Math.floor(rnd() * 3) }; }
      o.x = Math.round(36 + rnd() * (AW - 72)); o.y = Math.round(70 + rnd() * (AH / 2 - 100));
      const twin: Ob = { ...o, x: AW - o.x, y: AH - o.y };
      if (obGap(o, twin) < 36) continue;
      let ok = true;
      for (const s of SPAWNS) if (obDist(o, s.x, s.y) < 52 || obDist(twin, s.x, s.y) < 52) ok = false;
      for (const p of obs) if (obGap(o, p) < 36 || obGap(twin, p) < 36) ok = false;
      // either flush with a wall or far enough from it for a lunchbox to pass
      const ed = o.k === 1 ? Math.min(o.x - o.r, AW - o.x - o.r) : Math.min(o.x - o.w / 2, AW - o.x - o.w / 2);
      if (ed < 34) ok = false;
      if (!ok) continue;
      obs.push(o, twin); pairs++;
    }
    const map: TableMap = { obs, pads: [] };
    if (pairs < 3 || losClear(map, SPAWNS[0], SPAWNS[1], 6)) continue;   // the middle piece must block the opening shot
    const g = navGrid(map), reach = flood(g, cellOf(SPAWNS[0]));
    let free = 0, got = 0;
    for (let i = 0; i < g.length; i++) if (!g[i]) { free++; if (reach[i] >= 0) got++; }
    if (reach[cellOf(SPAWNS[1])] < 0 || got < free * 0.92) continue;
    // boost pads: open spots in the middle band, mirrored
    for (let tries = 0; tries < 200 && map.pads.length < 6; tries++) {
      const p = { x: Math.round(40 + rnd() * (AW - 80)), y: Math.round(AH / 2 - 120 + rnd() * 100) };
      if (!clearAt(map, p.x, p.y, 22) || reach[cellOf(p)] < 0) continue;
      if (map.pads.some(q => (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y) < 3600)) continue;
      map.pads.push(p, { x: AW - p.x, y: AH - p.y });
    }
    if (map.pads.length < 2) continue;
    return map;
  }
  return { obs: [{ k: 1, x: AW / 2, y: AH / 2, r: 28, c: 0 }, { k: 0, x: 90, y: 150, w: 50, h: 26, c: 1 }, { k: 0, x: AW - 90, y: AH - 150, w: 50, h: 26, c: 1 }],
    pads: [{ x: 280, y: 140 }, { x: AW - 280, y: AH - 140 }] };
}

/** True when a straight line from a to b misses every obstacle by at least m. */
export function losClear(map: TableMap, a: Pt, b: Pt, m: number) {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  for (const o of map.obs) {
    if (o.k === 1) {
      const t = len2 > 0 ? clamp(((o.x - a.x) * dx + (o.y - a.y) * dy) / len2, 0, 1) : 0;
      const px = a.x + dx * t - o.x, py = a.y + dy * t - o.y;
      if (px * px + py * py < (o.r + m) * (o.r + m)) return false;
    } else {
      // slab test against the box grown by m
      let t0 = 0, t1 = 1;
      const lo = [o.x - o.w / 2 - m, o.y - o.h / 2 - m], hi = [o.x + o.w / 2 + m, o.y + o.h / 2 + m], p = [a.x, a.y], d = [dx, dy];
      let hit = true;
      for (let i = 0; i < 2; i++) {
        if (d[i] === 0) { if (p[i] < lo[i] || p[i] > hi[i]) { hit = false; break; } continue; }
        let ta = (lo[i] - p[i]) / d[i], tb = (hi[i] - p[i]) / d[i];
        if (ta > tb) { const s = ta; ta = tb; tb = s; }
        if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
        if (t0 > t1) { hit = false; break; }
      }
      if (hit) return false;
    }
  }
  return true;
}

// ── navigation grid (the computer's pathing) ───────────────────────────────
export const CELL = 10, GW = AW / CELL, GH = AH / CELL;
export const cellOf = (p: Pt) => clamp(Math.floor(p.y / CELL), 0, GH - 1) * GW + clamp(Math.floor(p.x / CELL), 0, GW - 1);
export const cellPt = (c: number): Pt => ({ x: (c % GW) * CELL + CELL / 2, y: Math.floor(c / GW) * CELL + CELL / 2 });
const grids = new WeakMap<TableMap, Uint8Array>();
export function navGrid(map: TableMap) {
  let g = grids.get(map);
  if (g) return g;
  g = new Uint8Array(GW * GH);
  for (let c = 0; c < g.length; c++) { const p = cellPt(c); g[c] = clearAt(map, p.x, p.y, TANK_R + 2) ? 0 : 1; }
  grids.set(map, g); return g;
}
/** Steps from `from` to every reachable cell (8 neighbours, diagonals 1.4). -1 = can't get there. */
export function flood(g: Uint8Array, from: number) {
  const dist = new Float32Array(g.length).fill(-1), q: number[] = [];
  let start = from;
  if (g[start]) {   // standing on a blocked cell (pressed against something): start from the nearest open one
    let best = -1, bd = 1e9; const sp = cellPt(from);
    for (let c = 0; c < g.length; c++) if (!g[c]) { const p = cellPt(c), d = (p.x - sp.x) * (p.x - sp.x) + (p.y - sp.y) * (p.y - sp.y); if (d < bd) { bd = d; best = c; } }
    if (best < 0) return dist; start = best;
  }
  dist[start] = 0; q.push(start);
  // a simple label-correcting search; the grid is small (36 x 44)
  for (let h = 0; h < q.length; h++) {
    const c = q[h], cx = c % GW, cy = (c - cx) / GW;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = cx + ox, ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const n = ny * GW + nx;
      if (g[n]) continue;
      if (ox && oy && (g[cy * GW + nx] || g[ny * GW + cx])) continue;   // no cutting corners
      const nd = dist[c] + (ox && oy ? 1.4 : 1);
      if (dist[n] < 0 || nd < dist[n] - 0.01) { dist[n] = nd; q.push(n); }
    }
  }
  return dist;
}
/** Waypoints from a to b, following the flood downhill from b. */
export function pathTo(map: TableMap, a: Pt, b: Pt): Pt[] {
  const g = navGrid(map), dist = flood(g, cellOf(a));
  let c = cellOf(b);
  if (dist[c] < 0) {   // goal unreachable: head for the nearest reachable cell to it
    let best = -1, bd = 1e9;
    for (let k = 0; k < dist.length; k++) if (dist[k] >= 0) { const p = cellPt(k), d = (p.x - b.x) * (p.x - b.x) + (p.y - b.y) * (p.y - b.y); if (d < bd) { bd = d; best = k; } }
    if (best < 0) return []; c = best;
  }
  const out: Pt[] = [];
  for (let guard = 0; guard < 400 && dist[c] > 0; guard++) {
    out.push(cellPt(c));
    const cx = c % GW, cy = (c - cx) / GW; let nb = c, nd = dist[c];
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const nx = cx + ox, ny = cy + oy;
      if ((!ox && !oy) || nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const n = ny * GW + nx;
      if (dist[n] >= 0 && dist[n] < nd) { nd = dist[n]; nb = n; }
    }
    if (nb === c) break; c = nb;
  }
  return out.reverse();
}

// ── the world ──────────────────────────────────────────────────────────────
export function newTank(i: number): Tank {
  return { x: SPAWNS[i].x, y: SPAWNS[i].y, a: i === 0 ? -Math.PI / 2 : Math.PI / 2, hp: HP, cd: 0.4, fc: 0, speedT: 0, rapidT: 0, vx: 0, vy: 0 };
}
export function newWorld(map: TableMap, seed: number): World {
  return { map, tanks: [newTank(0), newTank(1)], peas: [], picks: [], tick: 0, time: 0, nextId: 1, pickT: 5, pickN: 0, rnd: mulberry32(seed ^ 0x7a11),
    events: [], shots: [0, 0], hits: [0, 0], dealt: [0, 0], grabs: [[0, 0], [0, 0]], lagPos: null };
}
export const NO_INPUT: Input = { ax: 0, ay: 0, fire: false, fc: 0 };

function pushOut(t: Tank, map: TableMap) {
  for (let pass = 0; pass < 2; pass++) for (const o of map.obs) {
    if (o.k === 1) {
      const dx = t.x - o.x, dy = t.y - o.y, d = Math.sqrt(dx * dx + dy * dy), m = o.r + TANK_R;
      if (d < m) { if (d < 0.001) { t.y += m; } else { t.x = o.x + (dx / d) * m; t.y = o.y + (dy / d) * m; } }
    } else {
      const hx = o.w / 2, hy = o.h / 2, cx = clamp(t.x, o.x - hx, o.x + hx), cy = clamp(t.y, o.y - hy, o.y + hy);
      const dx = t.x - cx, dy = t.y - cy, d2 = dx * dx + dy * dy;
      if (d2 < TANK_R * TANK_R) {
        if (d2 > 0.000001) { const d = Math.sqrt(d2); t.x = cx + (dx / d) * TANK_R; t.y = cy + (dy / d) * TANK_R; }
        else {   // centre inside the box: out the nearest side
          const l = t.x - (o.x - hx), r = o.x + hx - t.x, u = t.y - (o.y - hy), b = o.y + hy - t.y, m = Math.min(l, r, u, b);
          if (m === l) t.x = o.x - hx - TANK_R; else if (m === r) t.x = o.x + hx + TANK_R; else if (m === u) t.y = o.y - hy - TANK_R; else t.y = o.y + hy + TANK_R;
        }
      }
    }
  }
  t.x = clamp(t.x, TANK_R, AW - TANK_R); t.y = clamp(t.y, TANK_R, AH - TANK_R);
}
/** Turn toward the stick, then roll. A small push only turns (aim on the spot); the lunchbox only rolls when it
 *  roughly faces where you're pushing. `other` is the other lunchbox (null to ignore it). Returns true if it fired. */
export function stepTank(t: Tank, inp: Input, map: TableMap, other: Tank | null, peasOut: number): boolean {
  const ox = t.x, oy = t.y;
  const mag = Math.min(1, Math.sqrt(inp.ax * inp.ax + inp.ay * inp.ay));
  if (mag > 0.15) {
    const want = Math.atan2(inp.ay, inp.ax), diff = wrapAngle(want - t.a), step = TURN * DT;
    t.a = wrapAngle(t.a + clamp(diff, -step, step));
    if (mag > DRIVE_MIN) {
      const left = wrapAngle(want - t.a), c = Math.cos(left), align = c > 0 ? c * c : 0;
      const v = TANK_SPEED * (t.speedT > 0 ? SPEED_MULT : 1) * (0.5 + (0.5 * (mag - DRIVE_MIN)) / (1 - DRIVE_MIN)) * align;
      t.x += Math.cos(t.a) * v * DT; t.y += Math.sin(t.a) * v * DT;
    }
  }
  pushOut(t, map);
  if (other) {
    const dx = t.x - other.x, dy = t.y - other.y, d = Math.sqrt(dx * dx + dy * dy), m = TANK_R * 2;
    if (d < m && d > 0.001) { t.x = other.x + (dx / d) * m; t.y = other.y + (dy / d) * m; pushOut(t, map); }
  }
  t.vx = (t.x - ox) / DT; t.vy = (t.y - oy) / DT;
  if (t.speedT > 0) t.speedT = Math.max(0, t.speedT - DT);
  if (t.rapidT > 0) t.rapidT = Math.max(0, t.rapidT - DT);
  if (t.cd > 0) t.cd = Math.max(0, t.cd - DT);
  const wants = inp.fire || inp.fc > t.fc;
  if (wants && t.cd <= 0 && peasOut < (t.rapidT > 0 ? RAPID_PEAS : MAX_PEAS)) {
    t.cd = t.rapidT > 0 ? RAPID_COOLDOWN : COOLDOWN; t.fc = inp.fc;
    return true;
  }
  if (!wants) t.fc = inp.fc;
  return false;
}
export function peaFrom(t: Tank, id: number, o: number, cs: number): Pea {
  const c = Math.cos(t.a), s = Math.sin(t.a);
  return { id, o, x: t.x + c * (TANK_R + 3), y: t.y + s * (TANK_R + 3), vx: c * PEA_SPEED, vy: s * PEA_SPEED, cs };
}
/** Moves a pea one step. Returns "wall", "ob", a tank index it hit, or null while it's still flying. */
export function stepPea(p: Pea, map: TableMap, tanks: Tank[] | null, at?: (victim: number) => Pt): "wall" | "ob" | number | null {
  p.x += p.vx * DT; p.y += p.vy * DT;
  if (tanks) for (let i = 0; i < tanks.length; i++) {
    if (i === p.o || tanks[i].hp <= 0) continue;
    const q = at ? at(i) : tanks[i], dx = p.x - q.x, dy = p.y - q.y, m = TANK_R + PEA_R;
    if (dx * dx + dy * dy < m * m) return i;
  }
  if (p.x < PEA_R || p.y < PEA_R || p.x > AW - PEA_R || p.y > AH - PEA_R) return "wall";
  for (const o of map.obs) if (obDist(o, p.x, p.y) < PEA_R) return "ob";
  return null;
}
/** Moves one lunchbox one step (and fires its pea). The live host also uses it to catch up on a backlog of inputs. */
export function stepOneTank(w: World, i: number, inp: Input) {
  const t = w.tanks[i];
  if (t.hp <= 0) return;
  const out = w.peas.reduce((n, p) => n + (p.o === i ? 1 : 0), 0);
  if (stepTank(t, inp, w.map, w.tanks[1 - i], out)) { w.peas.push(peaFrom(t, w.nextId++, i, inp.s ?? -1)); w.shots[i]++; }
}
/** One 60th of a second of a round. */
export function stepWorld(w: World, inputs: Input[]) {
  w.tick++; w.time += DT;
  for (let i = 0; i < 2; i++) stepOneTank(w, i, inputs[i] ?? NO_INPUT);
  for (let k = w.peas.length - 1; k >= 0; k--) {
    const p = w.peas[k], lag = w.lagPos;
    const r = stepPea(p, w.map, w.tanks, lag ? (v => lag(v, p)) : undefined);
    if (r === null) continue;
    w.peas.splice(k, 1);
    if (typeof r === "number") {
      const t = w.tanks[r], d = Math.min(DMG, t.hp);
      t.hp -= d; w.hits[p.o]++; w.dealt[p.o] += d;
      w.events.push({ id: w.nextId++, k: "hit", x: t.x, y: t.y, v: r, n: d });
    } else w.events.push({ id: w.nextId++, k: "splat", x: p.x, y: p.y, v: p.o, n: p.cs });
  }
  // boosts: a mirrored pair every so often, one near each end, gone after a while if nobody takes them
  for (let k = w.picks.length - 1; k >= 0; k--) {
    const p = w.picks[k]; p.life -= DT;
    let taken = -1;
    for (let i = 0; i < 2; i++) { const t = w.tanks[i], dx = t.x - p.x, dy = t.y - p.y; if (t.hp > 0 && dx * dx + dy * dy < (TANK_R + 10) * (TANK_R + 10)) taken = i; }
    if (taken >= 0) {
      const t = w.tanks[taken];
      if (p.k === 0) t.speedT = BOOST_T; else t.rapidT = BOOST_T;
      w.grabs[taken][p.k]++;
      w.events.push({ id: w.nextId++, k: "pick", x: p.x, y: p.y, v: taken, n: p.k });
    }
    if (taken >= 0 || p.life <= 0) w.picks.splice(k, 1);
  }
  w.pickT -= DT;
  if (w.pickT <= 0 && w.picks.length === 0 && w.map.pads.length >= 2) {
    const pair = Math.floor(w.rnd() * (w.map.pads.length / 2)), kind = w.pickN % 2;
    for (const q of [w.map.pads[pair * 2], w.map.pads[pair * 2 + 1]]) w.picks.push({ id: w.nextId++, k: kind, x: q.x, y: q.y, life: PICK_LIFE });
    w.pickN++; w.pickT = 10;
  } else if (w.pickT <= 0) w.pickT = 2;
}
/** -1 still going, 0 or 1 the winner, 2 a tie. Time up: more health wins. */
export function roundWinner(w: World) {
  const [a, b] = [w.tanks[0].hp, w.tanks[1].hp];
  if (a <= 0 && b <= 0) return 2;
  if (a <= 0) return 1;
  if (b <= 0) return 0;
  if (w.time >= ROUND_T) return a > b ? 0 : b > a ? 1 : 2;
  return -1;
}
/** A round's points for the player against the computer: 5 per point of damage, up to 400 for accuracy, and for a win
 *  1,000 + 10 per health left + 10 per second under 60. */
export function roundPoints(won: boolean, dealt: number, hpLeft: number, shots: number, hits: number, secs: number) {
  const acc = Math.round((400 * hits) / Math.max(shots, 5));
  return Math.min(HP, dealt) * 5 + acc + (won ? 1000 + hpLeft * 10 + Math.max(0, Math.round((ROUND_T - secs) * 10)) : 0);
}
export const DAY_BONUS = 1000, TODAY_ROUNDS = 3;
/** How sharp the computer is: Today gets a little sharper each round; Free Play keeps climbing. */
export function sharpFor(daily: boolean, round: number) { return daily ? [0.34, 0.46, 0.58][Math.min(2, round - 1)] : Math.min(0.95, 0.25 + 0.07 * (round - 1)); }

// ── the computer ───────────────────────────────────────────────────────────
// It sees you a moment late (reaction time), paths around cover to a spot where it can see you at a comfortable
// range, turns to aim with an imperfect lead and a little wobble, and pauses between shots. It goes for boosts that
// are close, and every few seconds it shuffles sideways so it isn't a sitting duck. Never perfect: the wobble, the
// lead and the pauses all shrink with `s` but never reach zero.
export type Brain = { rnd: () => number; s: number; hist: Pt[]; path: Pt[]; goal: Pt | null; think: number; jit: number; lead: number; wait: number;
  shuffle: number; shuffleDir: number; nextShuffle: number; fc: number };
export function newBrain(seed: number, s: number): Brain {
  const rnd = mulberry32(seed);
  return { rnd, s, hist: [], path: [], goal: null, think: 0, jit: 0, lead: 0.7, wait: 0.6, shuffle: 0, shuffleDir: 1, nextShuffle: 2 + rnd() * 2, fc: 0 };
}
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.22;   // roughly a bell curve with sd about 0.7
export function aiInput(w: World, b: Brain, me: number): Input {
  const t = w.tanks[me], foe = w.tanks[1 - me], s = b.s;
  b.hist.push({ x: foe.x, y: foe.y }); if (b.hist.length > 40) b.hist.shift();
  const react = Math.round(18 - 10 * s), seen = b.hist[Math.max(0, b.hist.length - 1 - react)], prev = b.hist[Math.max(0, b.hist.length - 7 - react)];
  const svx = (seen.x - prev.x) / (6 * DT), svy = (seen.y - prev.y) / (6 * DT);
  const dx = seen.x - t.x, dy = seen.y - t.y, dist = Math.sqrt(dx * dx + dy * dy);
  const los = losClear(w.map, t, seen, PEA_R + 1);
  const g = navGrid(w.map);
  b.think -= DT; b.wait -= DT; b.nextShuffle -= DT;
  let ax = 0, ay = 0, fire = false;

  // pick where to go now and then
  if (b.think <= 0) {
    b.think = 0.5 + b.rnd() * 0.3; b.goal = null;
    const near = w.picks.filter(p => { const ex = p.x - t.x, ey = p.y - t.y; return ex * ex + ey * ey < 150 * 150; });
    if (near.length && b.rnd() < 0.4 + 0.4 * s) b.goal = { x: near[0].x, y: near[0].y };
    else if (!(los && dist < 230 && dist > 70)) {
      let best: Pt | null = null, bs = 1e9;
      for (let k = 0; k < 28; k++) {
        const c = Math.floor(b.rnd() * g.length);
        if (g[c]) continue;
        const p = cellPt(c), fx = p.x - seen.x, fy = p.y - seen.y, fd = Math.sqrt(fx * fx + fy * fy);
        if (fd < 100 || fd > 210 || !losClear(w.map, p, seen, PEA_R + 2)) continue;
        const mx = p.x - t.x, my = p.y - t.y, sc = Math.sqrt(mx * mx + my * my) + Math.abs(fd - 150) * 0.6;
        if (sc < bs) { bs = sc; best = p; }
      }
      b.goal = best ?? { x: seen.x, y: seen.y };
    }
    b.path = b.goal ? pathTo(w.map, t, b.goal) : [];
  }

  const forBoost = !!b.goal && b.path.length > 0 && w.picks.some(p => p.x === b.goal!.x && p.y === b.goal!.y);
  const aiming = los && (dist < 140 || (dist < 240 && !forBoost));
  if (aiming && dist < 120) b.shuffle = 0;   // no hopping about up close: it would turn its back
  if (b.shuffle > 0) {   // a short sideways hop
    b.shuffle -= DT;
    const sa = t.a + (Math.PI / 2) * b.shuffleDir, tx = t.x + Math.cos(sa) * 30, ty = t.y + Math.sin(sa) * 30;
    if (clearAt(w.map, tx, ty, TANK_R + 2)) { ax = Math.cos(sa); ay = Math.sin(sa); } else b.shuffleDir = -b.shuffleDir;
  } else if (aiming) {
    const tFly = dist / PEA_SPEED;
    const px = seen.x + svx * tFly * b.lead, py = seen.y + svy * tFly * b.lead;
    const want = Math.atan2(py - t.y, px - t.x) + b.jit, diff = wrapAngle(want - t.a);
    ax = Math.cos(want) * 0.3; ay = Math.sin(want) * 0.3;   // under DRIVE_MIN: turn on the spot
    const close = dist < 90, tol = Math.max(0.07 + 0.05 * (1 - s), 0.8 * Math.atan2(TANK_R + PEA_R, dist));
    if (Math.abs(diff) < tol && (b.wait <= 0 || close)) {
      fire = true;
      b.jit = gauss(b.rnd) * (0.2 - 0.13 * s);
      b.lead = 0.25 + b.rnd() * (0.6 + 0.4 * s);
      b.wait = (0.85 - 0.5 * s) * (0.6 + b.rnd() * 0.8);
    }
    if (b.nextShuffle <= 0 && dist >= 120) { b.nextShuffle = 2.2 + b.rnd() * 2.5 - s; b.shuffle = 0.35 + b.rnd() * 0.35; b.shuffleDir = b.rnd() < 0.5 ? -1 : 1; }
  } else if (b.path.length) {
    // look ahead along the path as far as there's a clear lane
    let k = 0;
    while (k + 1 < b.path.length && k < 6 && losClear(w.map, t, b.path[k + 1], TANK_R - 1)) k++;
    const wp = b.path[k], ex = wp.x - t.x, ey = wp.y - t.y, d = Math.sqrt(ex * ex + ey * ey);
    if (d < 7) b.path.splice(0, k + 1);
    else { ax = ex / d; ay = ey / d; }
  } else if (b.goal) b.think = 0;
  return { ax, ay, fire, fc: b.fc };
}
