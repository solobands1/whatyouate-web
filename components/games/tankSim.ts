// Pea Tanks rules: the kitchen table, the lunchboxes, peas, jelly mines, power-ups, kitchen spills, missions, Guard The
// Lunch waves and the computer drivers. Pure: no React, no DOM, no network. The game, the live host, the guest's
// prediction and the headless balance check all run this exact code.
// Arena coordinates: x right, y down, angles in radians from +x (canvas style). Players start at the bottom.
// Every lunchbox has a body (drives; turns to face where it's going) and a straw turret on top that turns on its own.
// Peas bounce off the table edge and cover once (Bagels' peas twice); after a bounce they can hit whoever fired them.
// Cereal boxes break (3 peas, or one mine blast); mugs, bowls, salt shakers and cutting boards don't.

export const AW = 360, AH = 440, DT = 1 / 60;
export const TANK_R = 13, PEA_R = 3.5, DRIVE_MIN = 0.3, AIM_TOL = 0.07, PLAYER_HIT = 10.5;   // players' lunchboxes are a little forgiving to hit
export const DUEL_T = 90, DUEL_HP = 3, LIVES = 3, BOX_HP = 3, POWER_T = 10, FREEZE_T = 5, FORT_T = 8, PICK_LIFE = 10;
export const MINE_ARM = 1, MINE_LIFE = 8, MINE_TRIG = 30, MINE_FUSE = 0.45, MINE_BLAST = 52, MINE_CAP = 2;
export const SPAWNS = [{ x: AW / 2, y: AH - 34 }, { x: AW / 2, y: 34 }];
export const COOP_SPAWNS = [{ x: AW / 2 - 50, y: AH - 34 }, { x: AW / 2 + 50, y: AH - 34 }];
export const GUARD_SPAWNS = [[{ x: AW / 2, y: AH - 128 }], [{ x: AW / 2 - 55, y: AH - 120 }, { x: AW / 2 + 55, y: AH - 120 }]];   // above the boxes round the basket

export type Kind = "player" | "crouton" | "meatball" | "chili" | "jelly" | "popcorn" | "bagel" | "pretzel" | "coconut";
type Spec = { speed: number; turn: number; tturn: number; pea: number; cd: number; max: number; bounce: number; hp: number; sight: number; mines: number };
export const KINDS: Record<Kind, Spec & { name: string; blurb: string }> = {
  player: { speed: 78, turn: 4.2, tturn: 11, pea: 235, cd: 0.32, max: 5, bounce: 1, hp: 1, sight: 999, mines: MINE_CAP, name: "You", blurb: "" },
  crouton: { speed: 0, turn: 0, tturn: 1.5, pea: 180, cd: 2.8, max: 1, bounce: 1, hp: 1, sight: 270, mines: 0, name: "Crouton", blurb: "Stays put and takes its time." },
  meatball: { speed: 36, turn: 2.4, tturn: 1.9, pea: 180, cd: 2.1, max: 1, bounce: 1, hp: 1, sight: 230, mines: 0, name: "Meatball", blurb: "Rolls about slowly. One pea at a time." },
  chili: { speed: 32, turn: 2.2, tturn: 1.7, pea: 300, cd: 2.8, max: 1, bounce: 1, hp: 1, sight: 999, mines: 0, name: "Chili", blurb: "Very fast peas, sees the whole table." },
  jelly: { speed: 48, turn: 3, tturn: 2, pea: 185, cd: 2.4, max: 1, bounce: 1, hp: 1, sight: 230, mines: 2, name: "Jellybean", blurb: "Drops jelly mines. Watch where you drive." },
  popcorn: { speed: 42, turn: 2.8, tturn: 2.6, pea: 200, cd: 0.32, max: 3, bounce: 1, hp: 1, sight: 230, mines: 0, name: "Popcorn", blurb: "Fires three peas in a quick burst." },
  bagel: { speed: 44, turn: 2.8, tturn: 2.2, pea: 195, cd: 2.0, max: 2, bounce: 2, hp: 1, sight: 260, mines: 0, name: "Bagel", blurb: "Its peas bounce twice, round corners." },
  pretzel: { speed: 98, turn: 5, tturn: 3, pea: 210, cd: 1.5, max: 1, bounce: 1, hp: 1, sight: 260, mines: 0, name: "Pretzel", blurb: "Fast, and comes looking for you." },
  coconut: { speed: 40, turn: 2.4, tturn: 1.9, pea: 195, cd: 1.8, max: 1, bounce: 1, hp: 2, sight: 240, mines: 0, name: "Coconut", blurb: "Hard shell: takes two hits." },
};
export const POWERS = [
  { name: "Lettuce Shield", short: "Shield", icon: "1f96c", blurb: "Blocks one hit." },
  { name: "Chili Peas", short: "Quick Peas", icon: "1f336", blurb: "Faster peas, faster firing." },
  { name: "Pea Pod", short: "Spread", icon: "1fadb", blurb: "Three peas at once." },
  { name: "Coffee Kick", short: "Speed", icon: "2615", blurb: "Drive faster." },
  { name: "Ice Cube", short: "Freeze", icon: "1f9ca", blurb: "Enemies freeze for 5 seconds." },
  { name: "Bread Wall", short: "Fortify", icon: "1f35e", blurb: "Walls pop up around you." },
];
export const ZONES = [
  { name: "Spilled Milk", blurb: "Slippery: you slide." },
  { name: "Syrup", blurb: "Sticky: you slow right down." },
  { name: "Sink", blurb: "Lunchboxes can't cross. Peas fly over." },
  { name: "Herb Patch", blurb: "Hide inside. You can still be hit." },
];

export type Pt = { x: number; y: number };
// cover: k 0 box (s 0 cereal box, breakable; 1 cutting board; 2 bread wall, for a while), k 1 round (s 0 fruit bowl, 1 mug, 2 salt shaker)
type Shape = ({ k: 0; w: number; h: number } | { k: 1; r: number }) & { x: number; y: number; s: number; c: number; hp?: number; ttl?: number };
export type Ob = Shape & { id: number };
export type Zone = { k: number; x: number; y: number; w: number; h: number };   // k: 0 milk, 1 syrup, 2 sink, 3 herbs; an ellipse (a rectangle for the sink)
export type TableMap = { obs: Ob[]; pads: Pt[]; zones: Zone[] };
export type Tank = { x: number; y: number; a: number; ta: number; aimT: number; hp: number; cd: number; fc: number; mc: number; pend: number;
  vx: number; vy: number; kind: Kind; team: number; inv: number; power: number; powerT: number; shield: boolean; hidden: boolean; out: number };
export type Pea = { id: number; o: number; team: number; x: number; y: number; vx: number; vy: number; b: number; hops: number; cs: number };
export type Mine = { id: number; o: number; team: number; x: number; y: number; t: number; fuse: number };
export type Pick = { id: number; k: number; x: number; y: number; life: number };
/** ax, ay: the drive stick. aim: where the turret should point (null = leave it). fc counts fire presses, mc mine presses; fire = held. */
export type Input = { ax: number; ay: number; aim: number | null; fire: boolean; fc: number; mc: number; s?: number };
export type Ev = { id: number; k: "hit" | "pick" | "splat" | "spark" | "fire" | "ko" | "boom" | "crumble" | "block" | "basket" | "mine"; x: number; y: number; v: number; n: number };
export type Mode = "versus" | "missions" | "guard";
export type Basket = { x: number; y: number; r: number; hp: number; max: number };
export type World = {
  mode: Mode; map: TableMap; ov: number; tanks: Tank[]; humans: number; peas: Pea[]; mines: Mine[]; picks: Pick[]; tick: number; time: number; nextId: number;
  lives: number; basket: Basket | null; freezeT: number; pickT: number; pickN: number; rnd: () => number; events: Ev[];
  shots: number[]; hits: number[]; kills: number[]; grabs: number[];
  /** live host only: where a pea's target was on the shooter's screen (lag compensation); null = where it is now */
  lagPos: ((victim: number, pea: Pea) => Pt) | null;
};

export function mulberry32(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export function wrapAngle(a: number) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

// ── cover and spills ───────────────────────────────────────────────────────
export function obDist(o: Ob, x: number, y: number) {   // distance from a point to the edge of a piece of cover (negative inside)
  if (o.k === 1) return Math.sqrt((x - o.x) * (x - o.x) + (y - o.y) * (y - o.y)) - o.r;
  const dx = Math.abs(x - o.x) - o.w / 2, dy = Math.abs(y - o.y) - o.h / 2;
  if (dx <= 0 && dy <= 0) return dx > dy ? dx : dy;
  const ex = dx > 0 ? dx : 0, ey = dy > 0 ? dy : 0;
  return Math.sqrt(ex * ex + ey * ey);
}
function obGap(a: Ob, b: Ob) {
  if (a.k === 0 && b.k === 0) {
    const dx = Math.abs(a.x - b.x) - (a.w + b.w) / 2, dy = Math.abs(a.y - b.y) - (a.h + b.h) / 2;
    if (dx <= 0 && dy <= 0) return dx > dy ? dx : dy;
    const ex = dx > 0 ? dx : 0, ey = dy > 0 ? dy : 0; return Math.sqrt(ex * ex + ey * ey);
  }
  const c = a.k === 1 ? a : b, o = a.k === 1 ? b : a;
  return obDist(o, c.x, c.y) - (c as { r: number }).r;
}
export function inZone(z: Zone, x: number, y: number, m = 0) {
  if (z.k === 2) return Math.abs(x - z.x) < z.w / 2 + m && Math.abs(y - z.y) < z.h / 2 + m;
  const ex = (x - z.x) / (z.w / 2 + m), ey = (y - z.y) / (z.h / 2 + m);
  return ex * ex + ey * ey < 1;
}
export const zoneAt = (map: TableMap, x: number, y: number) => { for (const z of map.zones) if (inZone(z, x, y)) return z.k; return -1; };
/** Somewhere a lunchbox fits (no cover, no sink within m). */
export function clearAt(map: TableMap, x: number, y: number, m: number) {
  if (x < m || y < m || x > AW - m || y > AH - m) return false;
  for (const o of map.obs) if (obDist(o, x, y) < m) return false;
  for (const z of map.zones) if (z.k === 2 && inZone(z, x, y, m)) return false;
  return true;
}
/** True when a straight line from a to b misses every piece of cover by at least m (sinks don't block peas). */
export function losClear(map: TableMap, a: Pt, b: Pt, m: number) {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  for (const o of map.obs) {
    if (o.k === 1) {
      const t = len2 > 0 ? clamp(((o.x - a.x) * dx + (o.y - a.y) * dy) / len2, 0, 1) : 0;
      const px = a.x + dx * t - o.x, py = a.y + dy * t - o.y;
      if (px * px + py * py < (o.r + m) * (o.r + m)) return false;
    } else {
      let t0 = 0, t1 = 1, hit = true;
      const lo = [o.x - o.w / 2 - m, o.y - o.h / 2 - m], hi = [o.x + o.w / 2 + m, o.y + o.h / 2 + m], p = [a.x, a.y], d = [dx, dy];
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

// ── tables ─────────────────────────────────────────────────────────────────
const BOXES = [[50, 26], [26, 50], [34, 34], [44, 28], [28, 44]];
type Raw = Shape;
function randomOb(rnd: () => number): Raw {
  const r = rnd();
  if (r < 0.12) return { k: 1, x: 0, y: 0, r: 9, s: 2, c: 0 };
  if (r < 0.32) return { k: 1, x: 0, y: 0, r: 13 + Math.floor(rnd() * 3), s: 1, c: Math.floor(rnd() * 3) };
  if (r < 0.47) return { k: 1, x: 0, y: 0, r: 20 + Math.floor(rnd() * 7), s: 0, c: Math.floor(rnd() * 3) };
  if (r < 0.62) { const wide = rnd() < 0.6; return { k: 0, x: 0, y: 0, w: wide ? 96 : 34, h: wide ? 34 : 96, s: 1, c: 0 }; }
  const b = BOXES[Math.floor(rnd() * BOXES.length)];
  return { k: 0, x: 0, y: 0, w: b[0], h: b[1], s: 0, c: Math.floor(rnd() * 3), hp: BOX_HP };
}
const finish = (raw: Raw[]): Ob[] => raw.map((o, i) => ({ ...o, id: i }) as Ob);
/** A table from a seed: a centre piece, mirrored pairs of cover (the same from both ends), maybe some spills, every spot
 *  reachable, the two ends out of each other's line of fire, and open spots for power-ups. */
export function makeMap(seed: number, pairs = 0, zoneKinds: number[] = []): TableMap {
  const rnd = mulberry32(seed);
  for (let attempt = 0; attempt < 80; attempt++) {
    const obs: Raw[] = [];
    const cr = rnd();
    if (cr < 0.45) obs.push({ k: 1, x: AW / 2, y: AH / 2, r: 26 + Math.floor(rnd() * 6), s: 0, c: Math.floor(rnd() * 3) });
    else if (cr < 0.7) obs.push({ k: 0, x: AW / 2, y: AH / 2, w: 100, h: 34, s: 1, c: 0 });
    else { const wide = rnd() < 0.75; obs.push({ k: 0, x: AW / 2, y: AH / 2, w: wide ? 70 : 30, h: wide ? 30 : 56, s: 0, c: Math.floor(rnd() * 3), hp: BOX_HP }); }
    const want = pairs || 3 + (rnd() < 0.5 ? 1 : 0);
    let made = 0;
    for (let tries = 0; tries < 300 && made < want; tries++) {
      const o = randomOb(rnd);
      o.x = Math.round(30 + rnd() * (AW - 60)); o.y = Math.round(66 + rnd() * (AH / 2 - 90));
      const twin: Raw = { ...o, x: AW - o.x, y: AH - o.y };
      const A = o as Ob, T = twin as Ob;
      if (obGap(A, T) < 34) continue;
      let ok = true;
      for (const s of [...SPAWNS, ...COOP_SPAWNS]) if (obDist(A, s.x, s.y) < 46 || obDist(T, s.x, s.y) < 46) ok = false;
      for (const p of obs) if (obGap(A, p as Ob) < 34 || obGap(T, p as Ob) < 34) ok = false;
      const ed = o.k === 1 ? Math.min(o.x - o.r, AW - o.x - o.r) : Math.min(o.x - o.w / 2, AW - o.x - o.w / 2);
      if (ed < 32) ok = false;
      if (!ok) continue;
      obs.push(o, twin); made++;
    }
    const map: TableMap = { obs: finish(obs), pads: [], zones: [] };
    if (made < 2 || losClear(map, SPAWNS[0], SPAWNS[1], 6)) continue;
    addZones(map, rnd, zoneKinds, true);
    if (!connected(map)) continue;
    addPads(map, rnd);
    if (map.pads.length < 2) continue;
    return map;
  }
  return { obs: finish([{ k: 1, x: AW / 2, y: AH / 2, r: 28, s: 0, c: 0 }, { k: 0, x: 90, y: 150, w: 50, h: 26, s: 0, c: 1, hp: BOX_HP }, { k: 0, x: AW - 90, y: AH - 150, w: 50, h: 26, s: 0, c: 1, hp: BOX_HP }]),
    pads: [{ x: 280, y: 140 }, { x: AW - 280, y: AH - 140 }], zones: [] };
}
function addZones(map: TableMap, rnd: () => number, kinds: number[], mirrored: boolean) {
  for (const k of kinds) {
    for (let tries = 0; tries < 80; tries++) {
      const w = k === 2 ? 70 + Math.floor(rnd() * 30) : 60 + Math.floor(rnd() * 40), h = k === 2 ? 40 + Math.floor(rnd() * 14) : 40 + Math.floor(rnd() * 26);
      const z: Zone = { k, x: Math.round(40 + rnd() * (AW - 80)), y: Math.round(90 + rnd() * (AH / 2 - 120)), w, h };
      const zs = mirrored ? [z, { ...z, x: AW - z.x, y: AH - z.y }] : [z];
      let ok = true;
      for (const q of zs) {
        for (const s of [...SPAWNS, ...COOP_SPAWNS]) if (inZone(q, s.x, s.y, 40)) ok = false;
        for (const o of map.obs) if (obDist(o, q.x, q.y) < Math.max(q.w, q.h) / 2 + (k === 2 ? 30 : 4)) ok = false;
        for (const o of map.zones) if (Math.abs(o.x - q.x) < (o.w + q.w) / 2 + 10 && Math.abs(o.y - q.y) < (o.h + q.h) / 2 + 10) ok = false;
      }
      if (mirrored && Math.abs(z.x - AW / 2) < z.w / 2 + 6 && Math.abs(z.y - AH / 2) < z.h / 2 + 6) ok = false;
      if (!ok) continue;
      map.zones.push(...zs); break;
    }
  }
}
function connected(map: TableMap) {
  const g = navGrid(map), reach = flood(g, cellOf(SPAWNS[0]));
  let free = 0, got = 0;
  for (let i = 0; i < g.length; i++) if (!g[i]) { free++; if (reach[i] >= 0) got++; }
  return reach[cellOf(SPAWNS[1])] >= 0 && got >= free * 0.9;
}
function addPads(map: TableMap, rnd: () => number) {
  const reach = flood(navGrid(map), cellOf(SPAWNS[0]));
  for (let tries = 0; tries < 200 && map.pads.length < 6; tries++) {
    const p = { x: Math.round(40 + rnd() * (AW - 80)), y: Math.round(AH / 2 - 130 + rnd() * 110) };
    if (!clearAt(map, p.x, p.y, 22) || reach[cellOf(p)] < 0 || zoneAt(map, p.x, p.y) >= 0) continue;
    if (map.pads.some(q => (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y) < 3600)) continue;
    map.pads.push(p, { x: AW - p.x, y: AH - p.y });
  }
}

// ── missions: 20 kitchen tables, one new thing at a time ──────────────────
export type Level = { n: number; name: string; map: TableMap; foes: { kind: Kind; x: number; y: number }[]; isNew: Kind | null; newZone: number | null };
type Hand = { name: string; obs: Raw[]; zones?: Zone[]; foes: [Kind, number, number][] };
const BX = (x: number, y: number, w: number, h: number, c = 0): Raw => ({ k: 0, x, y, w, h, s: 0, c, hp: BOX_HP });
const CB = (x: number, y: number, w: number, h: number): Raw => ({ k: 0, x, y, w, h, s: 1, c: 0 });
const BOWL = (x: number, y: number, r = 26, c = 0): Raw => ({ k: 1, x, y, r, s: 0, c });
const MUG = (x: number, y: number, c = 0): Raw => ({ k: 1, x, y, r: 14, s: 1, c });
const SALT = (x: number, y: number): Raw => ({ k: 1, x, y, r: 9, s: 2, c: 0 });
const Z = (k: number, x: number, y: number, w: number, h: number): Zone => ({ k, x, y, w, h });
const HAND: Record<number, Hand> = {
  1: { name: "Breakfast For One", obs: [BOWL(180, 215, 28), BX(84, 300, 50, 26, 1), BX(276, 135, 50, 26, 2), MUG(96, 120), MUG(264, 315, 1)], foes: [["crouton", 180, 60]] },
  2: { name: "Two Spoons", obs: [CB(180, 205, 110, 34), MUG(70, 300), MUG(290, 300, 2), BX(70, 115, 28, 44), BX(290, 115, 28, 44, 1), SALT(180, 320)], foes: [["crouton", 95, 55], ["crouton", 265, 55]] },
  3: { name: "Rolling Start", obs: [BX(110, 200, 44, 28), BX(250, 200, 44, 28, 1), MUG(180, 120, 2), MUG(180, 290), SALT(60, 260), SALT(300, 150), BOWL(300, 300, 22, 2), BOWL(60, 110, 22)], foes: [["meatball", 180, 50], ["crouton", 70, 50]] },
  4: { name: "Pancake Morning", obs: [CB(180, 160, 100, 34), BX(70, 270, 34, 34), BX(290, 270, 34, 34, 2), MUG(180, 300)], zones: [Z(1, 90, 200, 80, 52), Z(1, 270, 200, 80, 52)], foes: [["meatball", 80, 60], ["meatball", 280, 60]] },
  7: { name: "Herb Garden", obs: [BOWL(180, 220, 26, 1), BX(70, 150, 50, 26), BX(290, 290, 50, 26, 1), MUG(290, 140), MUG(70, 300, 2)], zones: [Z(3, 90, 225, 90, 60), Z(3, 270, 225, 90, 60)], foes: [["chili", 180, 40], ["jelly", 70, 70], ["meatball", 290, 70]] },
  11: { name: "Milk Spill", obs: [CB(180, 120, 96, 34), BX(80, 300, 44, 28, 2), BX(280, 300, 44, 28), SALT(180, 300), MUG(60, 180), MUG(300, 180, 1)], zones: [Z(0, 180, 215, 140, 70)], foes: [["bagel", 180, 50], ["popcorn", 60, 60], ["meatball", 300, 60]] },
  15: { name: "Washing Up", obs: [BOWL(70, 300, 24, 2), BOWL(290, 140, 24), BX(180, 330, 50, 26, 1), BX(180, 110, 50, 26), SALT(60, 150), SALT(300, 290)], zones: [Z(2, 180, 220, 120, 46)], foes: [["coconut", 180, 50], ["bagel", 60, 70], ["popcorn", 300, 70]] },
  20: { name: "Sunday Brunch", obs: [BOWL(180, 220, 30, 2), CB(80, 150, 96, 34), CB(280, 290, 96, 34), MUG(280, 140), MUG(80, 300, 2), BX(180, 110, 34, 34, 1), BX(180, 330, 34, 34), SALT(40, 220), SALT(320, 220)],
    zones: [Z(3, 290, 215, 60, 46), Z(1, 70, 215, 60, 46)], foes: [["coconut", 70, 60], ["chili", 180, 40], ["bagel", 300, 170], ["pretzel", 290, 60]] },
};
const NAMES = ["", "", "", "", "", "Hot Sauce", "Jelly Jar", "", "Popcorn Night", "Snack Attack", "Bagel Bakery", "", "Pretzel Twist", "Lunch Rush", "Coconut Cove",
  "", "Dinner Bell", "Pantry Raid", "Dessert Cart", "Second Helpings", ""];
const FOES: Kind[][] = [[], ["crouton"], ["crouton", "crouton"], ["meatball", "crouton"], ["meatball", "meatball"], ["chili", "meatball"], ["jelly", "crouton"],
  ["chili", "jelly", "meatball"], ["popcorn", "crouton"], ["popcorn", "meatball", "chili"], ["bagel", "crouton"], ["bagel", "popcorn", "meatball"], ["pretzel", "crouton"],
  ["pretzel", "chili", "jelly"], ["coconut", "meatball"], ["coconut", "bagel", "popcorn"], ["pretzel", "pretzel", "chili"], ["jelly", "jelly", "bagel", "coconut"],
  ["chili", "chili", "pretzel", "popcorn"], ["coconut", "coconut", "bagel", "pretzel"], ["coconut", "chili", "bagel", "pretzel"]];
const ZONE_START = [11, 4, 15, 7];   // the mission each spill first appears in: milk 11, syrup 4, sink 15, herbs 7
export const MISSIONS = 20;
const firstKind = (n: number) => { for (const k of FOES[n]) if (!FOES.slice(1, n).some(f => f.includes(k))) return k; return null; };
const firstZone = (n: number) => { const k = ZONE_START.indexOf(n); return k >= 0 ? k : null; };
function placeFoes(map: TableMap, kinds: Kind[], rnd: () => number) {
  const out: { kind: Kind; x: number; y: number }[] = [], reach = flood(navGrid(map), cellOf(SPAWNS[0]));
  for (let tries = 0; tries < 400 && out.length < kinds.length; tries++) {
    const p = { x: Math.round(30 + rnd() * (AW - 60)), y: Math.round(28 + rnd() * (AH * 0.34)) };
    if (!clearAt(map, p.x, p.y, TANK_R + 8) || reach[cellOf(p)] < 0 || zoneAt(map, p.x, p.y) >= 0) continue;
    if (out.some(q => (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y) < 70 * 70)) continue;
    out.push({ kind: kinds[out.length], x: p.x, y: p.y });
  }
  return out;
}
const zonesBy = (n: number) => [0, 1, 2, 3].filter(k => n > ZONE_START[k]);
export function missionLevel(n: number): Level {
  const h = HAND[n], rnd = mulberry32(0x9ea7 + n * 7919);
  if (h) {
    const map: TableMap = { obs: finish(h.obs), pads: [], zones: h.zones ?? [] };
    addPads(map, rnd);
    return { n, name: h.name, map, foes: h.foes.map(([kind, x, y]) => ({ kind, x, y })), isNew: firstKind(n), newZone: firstZone(n) };
  }
  const zk = zonesBy(n), pick = zk.length ? [zk[Math.floor(rnd() * zk.length)]] : [];
  const map = makeMap(0x7ab1e + n * 104729, n < 8 ? 3 : 4, pick);
  return { n, name: NAMES[n] || `Table ${n}`, map, foes: placeFoes(map, FOES[n], rnd), isNew: firstKind(n), newZone: null };
}
/** Today: 5 tables for everyone, one to four enemies, a new mix each day. */
export function dailyLevels(seed: number): Level[] {
  const rnd = mulberry32(seed), pools: Kind[][] = [["meatball", "crouton"], ["meatball", "chili", "popcorn"], ["jelly", "popcorn", "bagel", "chili"], ["pretzel", "bagel", "coconut", "chili"], ["coconut", "pretzel", "bagel", "jelly", "chili"]];
  const counts = [1, 2, 3, 3, 4], names = ["Warm-Up", "Second Course", "Main Dish", "Seconds", "Dessert"];
  return counts.map((c, i) => {
    const zk = i >= 1 ? [Math.floor(rnd() * 4)] : [];
    const map = makeMap((seed ^ Math.imul(i + 1, 0x9e3779b1)) | 0, 3 + (i >= 3 ? 1 : 0), zk);
    const kinds = Array.from({ length: c }, () => pools[i][Math.floor(rnd() * pools[i].length)]);
    return { n: i + 1, name: names[i], map, foes: placeFoes(map, kinds, rnd), isNew: null, newZone: null };
  });
}
/** Guard The Lunch: the picnic basket at the bottom, cereal boxes round it, open table above. */
export function guardMap(seed: number): TableMap {
  const rnd = mulberry32(seed), obs: Raw[] = [
    BX(120, 372, 40, 26, 1), BX(240, 372, 40, 26, 2), BX(180, 352, 50, 24), BX(78, 405, 26, 40), BX(282, 405, 26, 40, 1),
    MUG(60, 250), MUG(300, 250, 2), BOWL(180, 200, 24, 1), CB(90, 130, 80, 30), CB(270, 130, 80, 30)];
  const map: TableMap = { obs: finish(obs), pads: [], zones: rnd() < 0.5 ? [Z(3, 180, 280, 90, 44)] : [Z(1, 90, 300, 60, 40), Z(1, 270, 300, 60, 40)] };
  for (const p of [{ x: 70, y: 330 }, { x: 290, y: 330 }, { x: 180, y: 270 }, { x: 120, y: 200 }, { x: 240, y: 200 }]) map.pads.push(p);
  return map;
}
export const BASKET = { x: AW / 2, y: AH - 26, r: 18 };
export function waveFoes(n: number, rnd: () => number): Kind[] {
  const lists: Kind[][] = [["meatball", "meatball", "meatball"], ["meatball", "meatball", "chili", "meatball"], ["meatball", "pretzel", "meatball", "pretzel"],
    ["jelly", "popcorn", "meatball", "meatball", "chili"], ["bagel", "pretzel", "popcorn", "pretzel", "meatball"]];
  if (n <= lists.length) return lists[n - 1];
  const pool: Kind[] = ["meatball", "chili", "jelly", "popcorn", "bagel", "pretzel", "coconut"];
  return Array.from({ length: Math.min(9, 4 + Math.floor(n / 2)) }, () => pool[Math.floor(rnd() * pool.length)]);
}

/** Guard The Lunch waves: a short rest, then the wave's tanks roll in from the top a few at a time. */
export type Waves = { wave: number; queue: Kind[]; rest: number; spawnT: number; cleared: number; rnd: () => number };
export const newWaves = (seed: number): Waves => ({ wave: 0, queue: [], rest: 2.5, spawnT: 0, cleared: 0, rnd: mulberry32(seed ^ 0x3a7e) });
/** One step of the waves. Returns the index of a tank that just rolled in (it needs a driver), or -1. */
export function stepWaves(w: World, g: Waves): number {
  const alive = w.tanks.slice(w.humans).filter(t => t.hp > 0).length, cap = w.humans === 1 ? 3 : 5;
  if (!g.queue.length && alive === 0) {
    if (g.wave > g.cleared) g.cleared = g.wave;
    g.rest -= DT;
    if (g.rest <= 0) {
      g.wave++; g.queue = waveFoes(g.wave, g.rnd);
      if (w.humans > 1) g.queue.push(...waveFoes(Math.max(1, g.wave - 1), g.rnd).slice(0, 2 + Math.floor(g.wave / 3)));   // more of them in co-op
      g.rest = 4; g.spawnT = 0;
    }
  }
  g.spawnT -= DT;
  if (g.queue.length && alive < cap && g.spawnT <= 0) {
    g.spawnT = 0.7;
    const i = spawnFoe(w, g.queue[0]);
    if (i >= 0) { g.queue.shift(); return i; }
  }
  return -1;
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
export function flood(g: Uint8Array, from: number, avoid: Pt[] = []) {
  const dist = new Float32Array(g.length).fill(-1), q: number[] = [];
  let blocked = g;
  if (avoid.length) {   // cells near live mines count as blocked
    blocked = g.slice();
    for (const a of avoid) for (let c = 0; c < g.length; c++) { const p = cellPt(c); if ((p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y) < 44 * 44) blocked[c] = 1; }
  }
  let start = from;
  if (blocked[start]) {
    let best = -1, bd = 1e9; const sp = cellPt(from);
    for (let c = 0; c < blocked.length; c++) if (!blocked[c]) { const p = cellPt(c), d = (p.x - sp.x) * (p.x - sp.x) + (p.y - sp.y) * (p.y - sp.y); if (d < bd) { bd = d; best = c; } }
    if (best < 0) return dist; start = best;
  }
  dist[start] = 0; q.push(start);
  for (let h = 0; h < q.length; h++) {
    const c = q[h], cx = c % GW, cy = (c - cx) / GW;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = cx + ox, ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const n = ny * GW + nx;
      if (blocked[n]) continue;
      if (ox && oy && (blocked[cy * GW + nx] || blocked[ny * GW + cx])) continue;
      const nd = dist[c] + (ox && oy ? 1.4 : 1);
      if (dist[n] < 0 || nd < dist[n] - 0.01) { dist[n] = nd; q.push(n); }
    }
  }
  return dist;
}
export function pathTo(map: TableMap, a: Pt, b: Pt, avoid: Pt[] = []): Pt[] {
  const g = navGrid(map), dist = flood(g, cellOf(a), avoid);
  let c = cellOf(b);
  if (dist[c] < 0) {
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
export function newTank(kind: Kind, team: number, x: number, y: number, a: number, hp = KINDS[kind].hp): Tank {
  return { x, y, a, ta: a, aimT: a, hp, cd: 0.6, fc: 0, mc: 0, pend: 0, vx: 0, vy: 0, kind, team, inv: 0, power: -1, powerT: 0, shield: false, hidden: false, out: 0 };
}
const cloneMap = (m: TableMap): TableMap => ({ obs: m.obs.map(o => ({ ...o })), pads: m.pads, zones: m.zones });
function baseWorld(mode: Mode, map: TableMap, seed: number, tanks: Tank[], humans: number): World {
  return { mode, map: cloneMap(map), ov: 0, tanks, humans, peas: [], mines: [], picks: [], tick: 0, time: 0, nextId: 1000, lives: LIVES, basket: null, freezeT: 0,
    pickT: mode === "versus" ? 6 : 9, pickN: 0, rnd: mulberry32(seed ^ 0x7a11), events: [],
    shots: tanks.map(() => 0), hits: tanks.map(() => 0), kills: tanks.map(() => 0), grabs: tanks.map(() => 0), lagPos: null };
}
export const duelTank = (i: number) => newTank("player", i, SPAWNS[i].x, SPAWNS[i].y, i === 0 ? -Math.PI / 2 : Math.PI / 2, DUEL_HP);
export const newDuel = (map: TableMap, seed: number) => baseWorld("versus", map, seed, [duelTank(0), duelTank(1)], 2);
const playerTanks = (humans: number, guard = false) => (guard ? GUARD_SPAWNS[humans - 1] : humans === 1 ? [SPAWNS[0]] : COOP_SPAWNS).map(p => { const t = newTank("player", 0, p.x, p.y, -Math.PI / 2); t.inv = 1; return t; });
export function newMission(lv: Level, seed: number, humans: number, lives: number) {
  const tanks = [...playerTanks(humans), ...lv.foes.map(f => newTank(f.kind, 1, f.x, f.y, Math.PI / 2))];
  const w = baseWorld("missions", lv.map, seed, tanks, humans); w.lives = lives;
  return w;
}
export function newGuard(seed: number, humans: number) {
  const w = baseWorld("guard", guardMap(seed), seed, playerTanks(humans, true), humans);
  const hp = 6; w.basket = { ...BASKET, hp, max: hp }; w.lives = 0;
  return w;
}
/** Guard The Lunch: bring the next tank of the wave onto the table at the top edge. */
export function spawnFoe(w: World, kind: Kind): number {
  for (let tries = 0; tries < 30; tries++) {
    const x = Math.round(30 + w.rnd() * (AW - 60)), y = 22;
    if (!clearAt(w.map, x, y + 6, TANK_R + 4) || w.tanks.some(t => t.hp > 0 && Math.abs(t.x - x) < 34 && t.y < 60)) continue;
    const t = newTank(kind, 1, x, y, Math.PI / 2); t.inv = 0.6;
    const free = w.tanks.findIndex((q, i) => i >= w.humans && q.hp <= 0);   // reuse a knocked-out tank's slot, so the list stays short
    if (free >= 0) { w.tanks[free] = t; return free; }
    w.tanks.push(t); w.shots.push(0); w.hits.push(0); w.kills.push(0); w.grabs.push(0);
    return w.tanks.length - 1;
  }
  return -1;
}
export const NO_INPUT: Input = { ax: 0, ay: 0, aim: null, fire: false, fc: 0, mc: 0 };

function pushOut(t: Tank, map: TableMap) {
  for (let pass = 0; pass < 2; pass++) {
    for (const o of map.obs) {
      if (o.k === 1) {
        const dx = t.x - o.x, dy = t.y - o.y, d = Math.sqrt(dx * dx + dy * dy), m = o.r + TANK_R;
        if (d < m) { if (d < 0.001) { t.y += m; } else { t.x = o.x + (dx / d) * m; t.y = o.y + (dy / d) * m; } }
      } else boxOut(t, o.x, o.y, o.w / 2, o.h / 2);
    }
    for (const z of map.zones) if (z.k === 2) boxOut(t, z.x, z.y, z.w / 2, z.h / 2);
  }
  t.x = clamp(t.x, TANK_R, AW - TANK_R); t.y = clamp(t.y, TANK_R, AH - TANK_R);
}
function boxOut(t: Tank, x: number, y: number, hx: number, hy: number) {
  const cx = clamp(t.x, x - hx, x + hx), cy = clamp(t.y, y - hy, y + hy), dx = t.x - cx, dy = t.y - cy, d2 = dx * dx + dy * dy;
  if (d2 >= TANK_R * TANK_R) return;
  if (d2 > 0.000001) { const d = Math.sqrt(d2); t.x = cx + (dx / d) * TANK_R; t.y = cy + (dy / d) * TANK_R; return; }
  const l = t.x - (x - hx), r = x + hx - t.x, u = t.y - (y - hy), b = y + hy - t.y, m = Math.min(l, r, u, b);
  if (m === l) t.x = x - hx - TANK_R; else if (m === r) t.x = x + hx + TANK_R; else if (m === u) t.y = y - hy - TANK_R; else t.y = y + hy + TANK_R;
}
/** Body: turn toward the stick, then roll (a small push only turns; syrup slows, milk slides). Turret: turn toward `aim`.
 *  Fire when a press is waiting, the straw is ready and pointing where it was asked (or a moment has passed).
 *  Returns 1 if it fired, 0 if not. */
export function stepTank(t: Tank, inp: Input, map: TableMap, others: Tank[], peasOut: number, frozen = false, basket: Basket | null = null): number {
  const sp = KINDS[t.kind];
  const zone = zoneAt(map, t.x, t.y);
  t.hidden = zone === 3;
  let wx = 0, wy = 0;
  const mag = frozen ? 0 : Math.min(1, Math.sqrt(inp.ax * inp.ax + inp.ay * inp.ay));
  if (mag > 0.12 && sp.speed > 0) {
    const want = Math.atan2(inp.ay, inp.ax), diff = wrapAngle(want - t.a), step = sp.turn * DT;
    t.a = wrapAngle(t.a + clamp(diff, -step, step));
    if (mag > DRIVE_MIN) {
      const left = wrapAngle(want - t.a), c = Math.cos(left), align = c > 0 ? c * c : 0;
      const v = sp.speed * (t.power === 3 ? 1.4 : 1) * (zone === 1 ? 0.45 : 1) * (0.5 + (0.5 * (mag - DRIVE_MIN)) / (1 - DRIVE_MIN)) * align;
      wx = Math.cos(t.a) * v; wy = Math.sin(t.a) * v;
    }
  }
  if (zone === 0) { t.vx += (wx - t.vx) * 0.035; t.vy += (wy - t.vy) * 0.035; } else { t.vx = wx; t.vy = wy; }   // milk: you slide
  const ox = t.x, oy = t.y;
  t.x += t.vx * DT; t.y += t.vy * DT;
  pushOut(t, map);
  if (basket) { const dx = t.x - basket.x, dy = t.y - basket.y, d = Math.sqrt(dx * dx + dy * dy), m = basket.r + TANK_R; if (d < m && d > 0.001) { t.x = basket.x + (dx / d) * m; t.y = basket.y + (dy / d) * m; } }
  for (const o of others) {
    if (o === t || o.hp <= 0) continue;
    const dx = t.x - o.x, dy = t.y - o.y, d = Math.sqrt(dx * dx + dy * dy), m = TANK_R * 2;
    if (d < m && d > 0.001) { t.x = o.x + (dx / d) * m; t.y = o.y + (dy / d) * m; pushOut(t, map); }
  }
  if (zone === 0 && (Math.abs(t.x - ox - t.vx * DT) > 0.5 || Math.abs(t.y - oy - t.vy * DT) > 0.5)) { t.vx *= 0.5; t.vy *= 0.5; }   // slid into something
  if (!frozen && inp.aim !== null && inp.aim !== undefined && Number.isFinite(inp.aim)) t.aimT = inp.aim;
  if (!frozen) { const td = wrapAngle(t.aimT - t.ta), ts = sp.tturn * DT; t.ta = wrapAngle(t.ta + clamp(td, -ts, ts)); }
  if (t.powerT > 0) { t.powerT = Math.max(0, t.powerT - DT); if (t.powerT === 0) { if (t.power !== 0) t.power = -1; } }
  if (t.cd > 0) t.cd = Math.max(0, t.cd - DT);
  if (t.inv > 0) t.inv = Math.max(0, t.inv - DT);
  if (inp.fc > t.fc) { t.pend = Math.max(t.pend, 0.0001); t.fc = inp.fc; }
  if (inp.fire && t.pend === 0) t.pend = 0.0001;
  if (t.pend > 0 && !frozen) {
    t.pend += DT;
    const aligned = Math.abs(wrapAngle(t.aimT - t.ta)) < AIM_TOL || t.pend > 0.35;
    const cap = sp.max + (t.power === 2 ? 4 : 0);
    if (aligned && t.cd <= 0 && peasOut < cap) {
      t.cd = sp.cd * (t.power === 1 ? 0.55 : 1); t.pend = 0;
      return 1;
    }
    if (t.pend > 1.2) t.pend = 0;   // couldn't fire (all peas out): forget the press
  }
  return 0;
}
export function peaFrom(t: Tank, id: number, o: number, cs: number, spread = 0): Pea {
  const a = t.ta + spread, c = Math.cos(a), s = Math.sin(a), sp = KINDS[t.kind], v = sp.pea * (t.power === 1 ? 1.35 : 1);
  return { id, o, team: t.team, x: t.x + Math.cos(t.ta) * (TANK_R + 6), y: t.y + Math.sin(t.ta) * (TANK_R + 6), vx: c * v, vy: s * v, b: sp.bounce, hops: 0, cs };
}
/** The cover a pea last touched (index into map.obs), for breaking cereal boxes. */
export let lastOb = -1;
/** Moves a pea one step: off the edge and the cover it bounces (while it has bounces), else it splats. Returns a tank
 *  index it hit, "spark" for a bounce, "splat", or null while it's still flying. */
export function stepPea(p: Pea, map: TableMap, tanks: Tank[] | null, at?: (victim: number) => Pt): "spark" | "splat" | number | null {
  const ox = p.x, oy = p.y;
  lastOb = -1;
  p.x += p.vx * DT; p.y += p.vy * DT;
  if (tanks) for (let i = 0; i < tanks.length; i++) {
    const t = tanks[i];
    if (t.hp <= 0 || t.inv > 0) continue;
    if (i === p.o ? p.hops === 0 : t.team === p.team) continue;   // your own pea only after a bounce; no friendly fire
    const q = at ? at(i) : t, dx = p.x - q.x, dy = p.y - q.y, m = (t.kind === "player" ? PLAYER_HIT : TANK_R) + PEA_R;
    if (dx * dx + dy * dy < m * m) return i;
  }
  let bounced = false;
  if (p.x < PEA_R || p.x > AW - PEA_R) { if (p.b <= 0) return "splat"; p.vx = -p.vx; p.x = p.x < PEA_R ? 2 * PEA_R - p.x : 2 * (AW - PEA_R) - p.x; bounced = true; }
  if (p.y < PEA_R || p.y > AH - PEA_R) { if (p.b <= 0 && !bounced) return "splat"; p.vy = -p.vy; p.y = p.y < PEA_R ? 2 * PEA_R - p.y : 2 * (AH - PEA_R) - p.y; bounced = true; }
  if (!bounced) for (let k = 0; k < map.obs.length; k++) {
    const o = map.obs[k];
    if (obDist(o, p.x, p.y) >= PEA_R) continue;
    lastOb = k;
    if (p.b <= 0) return "splat";
    if (o.k === 1) {
      let nx = p.x - o.x, ny = p.y - o.y; const d = Math.sqrt(nx * nx + ny * ny) || 1; nx /= d; ny /= d;
      const dot = p.vx * nx + p.vy * ny; p.vx -= 2 * dot * nx; p.vy -= 2 * dot * ny;
      p.x = o.x + nx * (o.r + PEA_R + 0.5); p.y = o.y + ny * (o.r + PEA_R + 0.5);
    } else {
      const outX = Math.abs(ox - o.x) >= o.w / 2 + PEA_R - 0.01, outY = Math.abs(oy - o.y) >= o.h / 2 + PEA_R - 0.01;
      if (outX && !outY) p.vx = -p.vx; else if (outY && !outX) p.vy = -p.vy; else { p.vx = -p.vx; p.vy = -p.vy; }
      p.x = ox; p.y = oy;
    }
    bounced = true; break;
  }
  if (bounced) { p.b--; p.hops++; return "spark"; }
  return null;
}
const ev = (w: World, k: Ev["k"], x: number, y: number, v: number, n: number) => { w.events.push({ id: w.nextId++, k, x: Math.round(x), y: Math.round(y), v, n }); };
const frozenTeam = (w: World, t: Tank) => w.freezeT > 0 && t.team === 1 && w.mode !== "versus";
/** One lunchbox's step: its pea (or three) and its mine. The live host also uses it to catch up on a backlog of inputs. */
export function stepOneTank(w: World, i: number, inp: Input) {
  const t = w.tanks[i];
  if (t.hp <= 0) return;
  const frozen = frozenTeam(w, t);
  const out = w.peas.reduce((n, p) => n + (p.o === i ? 1 : 0), 0);
  if (stepTank(t, inp, w.map, w.tanks, out, frozen, w.basket)) {
    const spreads = t.power === 2 ? [-0.2, 0, 0.2] : [0];
    for (const sa of spreads) w.peas.push(peaFrom(t, w.nextId++, i, inp.s ?? -1, sa));
    w.shots[i]++;
    ev(w, "fire", t.x + Math.cos(t.ta) * (TANK_R + 8), t.y + Math.sin(t.ta) * (TANK_R + 8), i, Math.round(t.ta * 1000));
  }
  if (inp.mc > t.mc) {
    t.mc = inp.mc;
    const mine = w.mines.filter(m => m.o === i).length;
    if (!frozen && mine < KINDS[t.kind].mines) {
      w.mines.push({ id: w.nextId++, o: i, team: t.team, x: t.x, y: t.y, t: 0, fuse: 0 }); w.shots[i]++;
      ev(w, "mine", t.x, t.y, i, 0);
    }
  }
}
/** One 60th of a second. */
export function stepWorld(w: World, inputs: Input[]) {
  w.tick++; w.time += DT;
  if (w.freezeT > 0) w.freezeT = Math.max(0, w.freezeT - DT);
  for (let i = 0; i < w.tanks.length; i++) stepOneTank(w, i, inputs[i] ?? NO_INPUT);
  // peas
  for (let k = w.peas.length - 1; k >= 0; k--) {
    const p = w.peas[k], lag = w.lagPos;
    const r = stepPea(p, w.map, w.tanks, lag ? (v => lag(v, p)) : undefined);
    const ob = lastOb;
    if (r === null) {
      const m = w.mines.find(m => (m.x - p.x) * (m.x - p.x) + (m.y - p.y) * (m.y - p.y) < (7 + PEA_R) * (7 + PEA_R));   // shooting a mine sets it off
      if (m) { w.peas.splice(k, 1); m.fuse = 0.0001; m.t = MINE_LIFE; }
      else if (w.basket && w.mode === "guard" && p.team === 1) {
        const b = w.basket, dx = p.x - b.x, dy = p.y - b.y;
        if (dx * dx + dy * dy < (b.r + PEA_R) * (b.r + PEA_R)) { w.peas.splice(k, 1); b.hp--; ev(w, "basket", b.x, b.y, p.o, b.hp); }
      }
      continue;
    }
    if (ob >= 0) chipBox(w, ob);
    if (r === "spark") { ev(w, "spark", p.x, p.y, p.o, p.cs); continue; }
    w.peas.splice(k, 1);
    if (typeof r === "number") hitTank(w, r, p.o, 1);
    else ev(w, "splat", p.x, p.y, p.o, p.cs);
  }
  // jelly mines: arm after a second, go off after 8 seconds or when a lunchbox comes close; the blast reaches everyone
  for (const m of w.mines) {
    m.t += DT;
    if (m.fuse > 0) continue;
    if (m.t >= MINE_LIFE) m.fuse = 0.0001;
    else if (m.t >= MINE_ARM && w.tanks.some(t => t.hp > 0 && (t.x - m.x) * (t.x - m.x) + (t.y - m.y) * (t.y - m.y) < MINE_TRIG * MINE_TRIG)) m.fuse = 0.0001;
  }
  for (let k = w.mines.length - 1; k >= 0; k--) {
    const m = w.mines[k];
    if (m.fuse <= 0) continue;
    m.fuse += DT;
    if (m.fuse < MINE_FUSE && m.t < MINE_LIFE) continue;
    w.mines.splice(k, 1); boom(w, m);
    k = w.mines.length;   // a blast can set off others
  }
  // temporary walls go away
  let changed = false;
  for (const o of w.map.obs) if (o.ttl !== undefined) { o.ttl -= DT; if (o.ttl <= 0) changed = true; }
  if (changed) { w.map = { ...w.map, obs: w.map.obs.filter(o => o.ttl === undefined || o.ttl > 0) }; w.ov++; }
  // power-ups: players only. Versus gets a mirrored pair; missions and Guard The Lunch one at a time
  for (let k = w.picks.length - 1; k >= 0; k--) {
    const p = w.picks[k]; p.life -= DT;
    let taken = -1;
    for (let i = 0; i < w.tanks.length; i++) {
      const t = w.tanks[i]; if (t.hp <= 0 || t.kind !== "player") continue;
      const dx = t.x - p.x, dy = t.y - p.y; if (dx * dx + dy * dy < (TANK_R + 10) * (TANK_R + 10)) taken = i;
    }
    if (taken >= 0) { applyPower(w, taken, p.k); w.grabs[taken]++; ev(w, "pick", p.x, p.y, taken, p.k); }
    if (taken >= 0 || p.life <= 0) w.picks.splice(k, 1);
  }
  w.pickT -= DT;
  if (w.pickT <= 0 && w.picks.length === 0 && w.map.pads.length >= 1) {
    const pool = w.mode === "versus" ? [0, 1, 2, 3, 5] : [0, 1, 2, 3, 4, 5], kind = pool[(w.pickN * 7 + Math.floor(w.rnd() * 3)) % pool.length];
    if (w.mode === "versus" && w.map.pads.length >= 2) {
      const pair = Math.floor(w.rnd() * (w.map.pads.length / 2));
      for (const q of [w.map.pads[pair * 2], w.map.pads[pair * 2 + 1]]) w.picks.push({ id: w.nextId++, k: kind, x: q.x, y: q.y, life: PICK_LIFE });
    } else { const q = w.map.pads[Math.floor(w.rnd() * w.map.pads.length)]; w.picks.push({ id: w.nextId++, k: kind, x: q.x, y: q.y, life: PICK_LIFE }); }
    w.pickN++; w.pickT = w.mode === "versus" ? 11 : 13;
  } else if (w.pickT <= 0) w.pickT = 2;
}
function chipBox(w: World, k: number) {
  const o = w.map.obs[k];
  if (!o || o.hp === undefined) return;
  o.hp--; w.ov++;
  if (o.hp <= 0) breakOb(w, o);
}
function breakOb(w: World, o: Ob) {
  ev(w, "crumble", o.x, o.y, o.id, o.c);
  w.map = { ...w.map, obs: w.map.obs.filter(q => q !== o) }; w.ov++;
}
function boom(w: World, m: Mine) {
  ev(w, "boom", m.x, m.y, m.o, 0);
  for (let i = 0; i < w.tanks.length; i++) {
    const t = w.tanks[i]; if (t.hp <= 0 || t.inv > 0) continue;
    const dx = t.x - m.x, dy = t.y - m.y; if (dx * dx + dy * dy < (MINE_BLAST + TANK_R * 0.6) * (MINE_BLAST + TANK_R * 0.6)) hitTank(w, i, m.o, 2);
  }
  for (const o of [...w.map.obs]) if (o.hp !== undefined && obDist(o, m.x, m.y) < MINE_BLAST) breakOb(w, o);
  for (const q of w.mines) { const dx = q.x - m.x, dy = q.y - m.y; if (q.fuse <= 0 && dx * dx + dy * dy < MINE_BLAST * MINE_BLAST) { q.fuse = MINE_FUSE - 0.12; } }
  if (w.basket && w.mode === "guard") { const dx = w.basket.x - m.x, dy = w.basket.y - m.y; if (dx * dx + dy * dy < (MINE_BLAST + w.basket.r) * (MINE_BLAST + w.basket.r)) { w.basket.hp = Math.max(0, w.basket.hp - 1); ev(w, "basket", w.basket.x, w.basket.y, m.o, w.basket.hp); } }
}
function applyPower(w: World, i: number, k: number) {
  const t = w.tanks[i];
  if (k === 0) { t.shield = true; return; }
  if (k === 4) { w.freezeT = FREEZE_T; return; }
  if (k === 5) { fortify(w, t); return; }
  t.power = k; t.powerT = POWER_T;
}
/** Bread Wall: short walls pop up round you (round the basket in Guard The Lunch), wherever they don't land on anyone. */
function fortify(w: World, t: Tank) {
  const c = w.mode === "guard" && w.basket ? { x: w.basket.x, y: w.basket.y - 6 } : { x: t.x, y: t.y };
  const segs = w.mode === "guard" ? [[-58, -40, 44, 14], [58, -40, 44, 14], [0, -62, 50, 14]] : [[0, -38, 54, 14], [-38, 0, 14, 54], [38, 0, 14, 54]];
  let id = Math.max(...w.map.obs.map(o => o.id), 0) + 1;
  const add: Ob[] = [];
  for (const [dx, dy, ww, hh] of segs) {
    const o: Ob = { k: 0, x: clamp(c.x + dx, ww / 2, AW - ww / 2), y: clamp(c.y + dy, hh / 2, AH - hh / 2), w: ww, h: hh, s: 2, c: 0, ttl: FORT_T, id: id++ };
    if (w.tanks.some(q => q.hp > 0 && obDist(o, q.x, q.y) < TANK_R + 2)) continue;
    add.push(o);
  }
  if (add.length) { w.map = { ...w.map, obs: [...w.map.obs, ...add] }; w.ov++; }
}
/** A hit: shields soak it, then health. Missions: a player knocked out sits out (one shared life). */
export function hitTank(w: World, v: number, by: number, dmg: number) {
  const t = w.tanks[v];
  if (t.shield) { t.shield = false; t.inv = 0.4; ev(w, "block", t.x, t.y, v, by); return; }
  t.hp = Math.max(0, t.hp - dmg);
  if (by >= 0 && w.tanks[by] && w.tanks[by].team !== t.team) w.hits[by]++;
  ev(w, "hit", t.x, t.y, v, by);
  if (t.hp > 0) return;
  if (by >= 0 && w.tanks[by] && w.tanks[by].team !== t.team) w.kills[by]++;
  ev(w, "ko", t.x, t.y, v, by);
  if (t.kind === "player" && w.mode === "missions") w.lives = Math.max(0, w.lives - 1);
  if (t.kind === "player" && w.mode === "guard") t.out = 3;   // back after 3 seconds
  t.power = -1; t.powerT = 0;
}
/** Guard The Lunch: a knocked-out player comes back at the basket after a short wait. */
export function guardRespawn(w: World) {
  for (let i = 0; i < w.humans; i++) {
    const t = w.tanks[i]; if (t.hp > 0 || t.out <= 0) continue;
    t.out -= DT;
    if (t.out <= 0) { const s = GUARD_SPAWNS[w.humans - 1][i]; Object.assign(t, { hp: 1, x: s.x, y: s.y, a: -Math.PI / 2, ta: -Math.PI / 2, aimT: -Math.PI / 2, inv: 2, vx: 0, vy: 0, out: 0 }); }
  }
}
/** Versus: -1 still going, 0 or 1 the winner, 2 a tie. Time up: more health wins. */
export function duelWinner(w: World) {
  const [a, b] = [w.tanks[0].hp, w.tanks[1].hp];
  if (a <= 0 && b <= 0) return 2;
  if (a <= 0) return 1;
  if (b <= 0) return 0;
  if (w.time >= DUEL_T) return a > b ? 0 : b > a ? 1 : 2;
  return -1;
}
/** Missions: "cleared" when every enemy is out, "down" when every player is out. */
export function missionState(w: World): "play" | "cleared" | "down" {
  let players = false;
  for (let i = 0; i < w.humans; i++) if (w.tanks[i].hp > 0) players = true;
  if (!players) return "down";
  for (let i = w.humans; i < w.tanks.length; i++) if (w.tanks[i].hp > 0) return "play";
  return "cleared";
}
/** Points for a cleared mission: 1,000, 150 per enemy, up to 600 for speed (10 a second under 60), up to 500 for aim. */
export function missionPoints(secs: number, shots: number, hits: number, foes: number) {
  return 1000 + 150 * foes + Math.min(600, Math.max(0, Math.round((60 - secs) * 10))) + Math.round(500 * Math.min(1, hits / Math.max(shots, 3)));
}
export const LIFE_BONUS = 500, DAY_BONUS = 1000, TODAY_MISSIONS = 5, WAVE_POINTS = 1000, KILL_POINTS = 100;
/** How sharp the computer is: missions 1 to 20, Today's 5, Guard The Lunch waves. */
export const sharpFor = (n: number, daily: boolean) => (daily ? [0.2, 0.28, 0.36, 0.44, 0.52][n - 1] : Math.min(0.8, 0.1 + 0.035 * (n - 1)));
export const waveSharp = (n: number) => Math.min(0.85, 0.3 + 0.06 * (n - 1));

// ── aiming helpers ─────────────────────────────────────────────────────────
/** Where a pea fired from (x, y) at angle `a` would go: up to `bounces` bounces, `len` units. For the aim line. */
export function tracePath(map: TableMap, x: number, y: number, a: number, bounces: number, len: number): Pt[] {
  const p: Pea = { id: 0, o: -1, team: -1, x, y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, b: bounces, hops: 0, cs: 0 };
  const pts: Pt[] = [{ x, y }]; let d = 0;
  while (d < len) {
    const r = stepPea(p, map, null); d += 4;
    if (r === "spark") pts.push({ x: p.x, y: p.y });
    else if (r === "splat") break;
  }
  pts.push({ x: p.x, y: p.y });
  return pts;
}
function bankShot(map: TableMap, from: Pt, to: Pt): number | null {
  const mirrors: Pt[] = [{ x: -to.x + 2 * PEA_R, y: to.y }, { x: 2 * (AW - PEA_R) - to.x, y: to.y }, { x: to.x, y: -to.y + 2 * PEA_R }, { x: to.x, y: 2 * (AH - PEA_R) - to.y }];
  let best: number | null = null, bd = 1e9;
  for (let k = 0; k < 4; k++) {
    const m = mirrors[k], dx = m.x - from.x, dy = m.y - from.y;
    let t: number;
    if (k < 2) { const wx = k === 0 ? PEA_R : AW - PEA_R; if (Math.abs(dx) < 1) continue; t = (wx - from.x) / dx; }
    else { const wy = k === 2 ? PEA_R : AH - PEA_R; if (Math.abs(dy) < 1) continue; t = (wy - from.y) / dy; }
    if (t <= 0 || t >= 1) continue;
    const hit = { x: from.x + dx * t, y: from.y + dy * t };
    if (!losClear(map, from, hit, PEA_R + 1) || !losClear(map, hit, to, PEA_R + 1)) continue;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bd && d < 520) { bd = d; best = Math.atan2(dy, dx); }
  }
  return best;
}

// ── the computer drivers ───────────────────────────────────────────────────
// Each enemy sees you a moment late (not at all in the herbs unless it's close), drives its own way (Crouton stays
// put, Meatball potters, Pretzel and Coconut come for you, Chili keeps its distance, Jellybean leaves mines, Popcorn
// fires in bursts, Bagel banks shots off the edge), steers round live mines, turns its straw toward where you're going
// with a wobble, and pauses between shots. The wobble, the lead and the pauses shrink with `s` but never reach zero.
// In Guard The Lunch they head for the basket. The same driver (kind "player") plays you in the balance check and the
// browser test, and dodges peas a bit like a person would.
export type Brain = { rnd: () => number; s: number; hist: Pt[]; path: Pt[]; goal: Pt | null; think: number; jit: number; lead: number; wait: number; fc: number; mc: number;
  home: Pt | null; burst: number; mineT: number; target: number; seenT: number };
export function newBrain(seed: number, s: number): Brain {
  const rnd = mulberry32(seed);
  return { rnd, s, hist: [], path: [], goal: null, think: 0, jit: 0.15, lead: 0.7, wait: 1.4 + rnd() * 1.2, fc: 0, mc: 0, home: null, burst: 0, mineT: 3 + rnd() * 3, target: -1, seenT: 0 };
}
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.22;
function pickFoe(w: World, me: number) {
  const t = w.tanks[me]; let best = -1, bd = 1e9;
  for (let i = 0; i < w.tanks.length; i++) {
    const o = w.tanks[i]; if (i === me || o.hp <= 0 || o.team === t.team) continue;
    let d = (o.x - t.x) * (o.x - t.x) + (o.y - t.y) * (o.y - t.y);
    if (o.hidden && d > 70 * 70) d += 1e6;   // can't see into the herbs from afar
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function follow(w: World, t: Tank, b: Brain): [number, number] {
  if (!b.path.length) return [0, 0];
  let k = 0;
  while (k + 1 < b.path.length && k < 6 && losClear(w.map, t, b.path[k + 1], TANK_R - 1)) k++;
  const wp = b.path[k], ex = wp.x - t.x, ey = wp.y - t.y, d = Math.sqrt(ex * ex + ey * ey);
  if (d < 7) { b.path.splice(0, k + 1); return [0, 0]; }
  return [ex / d, ey / d];
}
function spotNear(w: World, b: Brain, around: Pt, dmin: number, dmax: number, needLos: Pt | null, from: Pt): Pt | null {
  const g = navGrid(w.map); let best: Pt | null = null, bs = 1e9;
  for (let k = 0; k < 30; k++) {
    const c = Math.floor(b.rnd() * g.length); if (g[c]) continue;
    const p = cellPt(c), fx = p.x - around.x, fy = p.y - around.y, fd = Math.sqrt(fx * fx + fy * fy);
    if (fd < dmin || fd > dmax) continue;
    if (needLos && !losClear(w.map, p, needLos, PEA_R + 2)) continue;
    const mx = p.x - from.x, my = p.y - from.y, sc = Math.sqrt(mx * mx + my * my) + b.rnd() * 40;
    if (sc < bs) { bs = sc; best = p; }
  }
  return best;
}
export function aiInput(w: World, b: Brain, me: number): Input {
  const t = w.tanks[me], sp = KINDS[t.kind], s = b.s, k = t.kind;
  if (!b.home) b.home = { x: t.x, y: t.y };
  b.think -= DT; b.wait -= DT; b.mineT -= DT;
  if (t.hp <= 0) return { ax: 0, ay: 0, aim: null, fire: false, fc: b.fc, mc: b.mc };
  const fi = pickFoe(w, me), guard = w.mode === "guard" && t.team === 1 && w.basket;
  const foe = fi >= 0 ? w.tanks[fi] : null;
  // in Guard The Lunch an enemy goes for the basket unless a player is close and in sight
  let tx: Pt | null = foe ? { x: foe.x, y: foe.y } : null, onBasket = false;
  if (guard) {
    const bk = w.basket!, dP = foe ? Math.hypot(foe.x - t.x, foe.y - t.y) : 1e9;
    if (!foe || dP > 110 || !losClear(w.map, t, foe, PEA_R + 1)) { tx = { x: bk.x, y: bk.y }; onBasket = true; }
  }
  if (!tx) return { ax: 0, ay: 0, aim: null, fire: false, fc: b.fc, mc: b.mc };
  if (fi !== b.target) { b.hist.length = 0; b.target = fi; }
  b.hist.push(tx); if (b.hist.length > 40) b.hist.shift();
  const react = Math.round(20 - 12 * s), seen = b.hist[Math.max(0, b.hist.length - 1 - react)], prev = b.hist[Math.max(0, b.hist.length - 7 - react)];
  const svx = onBasket ? 0 : (seen.x - prev.x) / (6 * DT), svy = onBasket ? 0 : (seen.y - prev.y) / (6 * DT);
  const dx = seen.x - t.x, dy = seen.y - t.y, dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const visible = onBasket || !(foe!.hidden && dist > 70);
  const los = visible && dist <= sp.sight && losClear(w.map, t, seen, PEA_R + 1) && (onBasket || foe!.inv <= 0);
  const mines = w.mines.filter(m => m.t > 0.3).map(m => ({ x: m.x, y: m.y }));
  b.seenT = los ? b.seenT + DT : 0;   // an enemy needs a moment to notice you before its first shot (peeking pays)
  const noticed = k === "player" || onBasket || b.seenT > 0.95 - 0.55 * s;

  // where to drive
  if (b.think <= 0 && sp.speed > 0) {
    b.goal = null;
    const pick = k === "player" ? w.picks.find(p => Math.hypot(p.x - t.x, p.y - t.y) < 150) : undefined;
    if (pick && b.rnd() < 0.6) { b.goal = { x: pick.x, y: pick.y }; b.think = 1; }
    else if (guard) { b.think = 1 + b.rnd(); b.goal = onBasket ? (los && dist < 150 ? null : spotNear(w, b, seen, 60, 150, seen, t) ?? seen) : (los ? null : seen); }
    else if (k === "meatball" || k === "jelly") { b.think = 2.5 + b.rnd() * 2; b.goal = spotNear(w, b, b.home, 0, k === "jelly" ? 170 : 110, null, t); }
    else if (k === "pretzel") { b.think = 0.8 + b.rnd() * 0.6; b.goal = spotNear(w, b, seen, 60, 150, null, t) ?? seen; }
    else if (k === "chili") { b.think = 3; b.goal = los && dist > 170 ? null : spotNear(w, b, seen, 180, 400, seen, t); }
    else if (k === "coconut") { b.think = 1.2; b.goal = dist > 120 ? { x: seen.x, y: seen.y } : null; }
    else if (k === "popcorn" || k === "bagel") { b.think = 2 + b.rnd() * 2; b.goal = spotNear(w, b, b.home, 0, 160, null, t); }
    else { b.think = 0.6 + b.rnd() * 0.3; b.goal = los && dist < 230 && dist > 80 ? null : spotNear(w, b, seen, 100, 210, seen, t) ?? { x: seen.x, y: seen.y }; }   // the player driver
    b.path = b.goal ? pathTo(w.map, t, b.goal, mines) : [];
  }
  let [ax, ay] = sp.speed > 0 ? follow(w, t, b) : [0, 0];
  if (k === "player") {
    if (los && !b.path.length) { const side = Math.sin(w.time * 1.7 + me) > 0 ? 1 : -1; ax = (-dy / dist) * side * 0.8; ay = (dx / dist) * side * 0.8; }   // strafe while shooting
    // dodge: a pea coming straight at us
    for (const p of w.peas) {
      if (p.team === t.team && p.hops === 0) continue;
      const rx = t.x - p.x, ry = t.y - p.y, vv = p.vx * p.vx + p.vy * p.vy, tt = (rx * p.vx + ry * p.vy) / vv;
      if (tt <= 0 || tt > 0.45) continue;
      const cx = p.x + p.vx * tt - t.x, cy = p.y + p.vy * tt - t.y;
      if (cx * cx + cy * cy < 20 * 20 && b.rnd() < 0.5 + 0.4 * s) { const n = Math.sqrt(vv); ax = -p.vy / n; ay = p.vx / n; if (cx * ay - cy * ax > 0) { ax = -ax; ay = -ay; } break; }
    }
  }

  // where to aim, and when to fire
  let aim: number, canShoot = false;
  let box: Ob | null = null;
  if (onBasket && !los) {   // Guard The Lunch: no clear shot at the basket, so chip away at a cereal box in the way
    let bd = 1e9;
    for (const o of w.map.obs) {
      if (o.hp === undefined) continue;
      const ox = o.x - t.x, oy = o.y - t.y, d = Math.hypot(ox, oy);
      if (d > 190 || (ox * dx + oy * dy) / (d * dist) < 0.3) continue;
      if (!losClear({ ...w.map, obs: w.map.obs.filter(q => q !== o) }, t, o, PEA_R)) continue;
      if (d < bd) { bd = d; box = o; }
    }
  }
  if (box) { aim = Math.atan2(box.y - t.y, box.x - t.x) + b.jit * 0.4; canShoot = true; }
  else if (los) {
    const tFly = dist / sp.pea;
    aim = Math.atan2(seen.y + svy * tFly * b.lead - t.y, seen.x + svx * tFly * b.lead - t.x) + b.jit; canShoot = true;
  } else {
    const bank = visible && (k === "bagel" || (k === "player" && s > 0.6)) ? bankShot(w.map, t, seen) : null;
    if (bank !== null) { aim = bank + b.jit * 0.5; canShoot = true; }
    else aim = Math.atan2(dy, dx);
  }
  // don't shoot your own side (co-op partner or another enemy) in the back
  if (canShoot) for (const o of w.tanks) {
    if (o === t || o.hp <= 0 || o.team !== t.team) continue;
    const ox = o.x - t.x, oy = o.y - t.y, along = ox * Math.cos(aim) + oy * Math.sin(aim);
    if (along > 0 && along < dist && Math.abs(-ox * Math.sin(aim) + oy * Math.cos(aim)) < TANK_R + 4) canShoot = false;
  }
  // look at the aim line first: no shots that bounce straight back
  if (canShoot && !box) {
    const path = tracePath(w.map, t.x + Math.cos(aim) * (TANK_R + 6), t.y + Math.sin(aim) * (TANK_R + 6), aim, sp.bounce, 360);
    for (let j = 1; j < path.length - 1 && canShoot; j++) {
      const a = path[j], b2 = path[j + 1], ex = b2.x - a.x, ey = b2.y - a.y, l2 = ex * ex + ey * ey || 1, u = clamp(((t.x - a.x) * ex + (t.y - a.y) * ey) / l2, 0, 1);
      if (Math.hypot(a.x + ex * u - t.x, a.y + ey * u - t.y) < 28) canShoot = false;
    }
  }
  const tol = box ? 0.12 : Math.max(0.05 + 0.05 * (1 - s), 0.7 * Math.atan2(TANK_R + PEA_R, dist));
  if (canShoot && (noticed || box) && b.wait <= 0 && t.cd <= 0 && Math.abs(wrapAngle(aim - t.ta)) < tol) {
    b.fc++;
    b.jit = gauss(b.rnd) * (k === "chili" ? 0.11 : k === "player" ? 0.14 : 0.22) * (1 - 0.55 * s);
    b.lead = 0.25 + b.rnd() * (0.55 + 0.4 * s);
    if (k === "popcorn" && ++b.burst < 3) b.wait = 0.05;
    else { b.burst = 0; b.wait = (k === "player" ? 0.1 : 0.5) + (1 - s) * 0.9 * b.rnd(); }
  }
  // Jellybean leaves a mine now and then when it's near you (never on top of another)
  if (sp.mines > 0 && k !== "player" && b.mineT <= 0 && !onBasket && dist < 220 && !w.mines.some(m => Math.hypot(m.x - t.x, m.y - t.y) < 60)) { b.mc++; b.mineT = 5 + b.rnd() * 3; }
  return { ax, ay, aim, fire: false, fc: b.fc, mc: b.mc };
}
