// Berry Pong: the rules and the berry's flight, pure (no React, no DOM), so the game, the computer, live play and the
// headless balance check (sim.ts) all run the same code. A match is a list of flicks applied in order; the same flicks
// always give the same match, which is what keeps two phones in step in a live game.
//
// The table: a kitchen table TL long and TW wide (world units are roughly centimetres). Each player has 6 cereal bowls
// in a 3-2-1 triangle at their end, the point toward the other player. On your turn you flick 2 blueberries at the
// other player's bowls. A berry that drops into a bowl sinks it and that bowl comes off the table.
//  - Sink 2 in a row (across turns too) and you're On Fire: the bowls' sweet spot grows a little until you miss.
//  - Sink both berries of a turn and you get Berries Back: another turn straight away.
//  - First to clear all 6 of the other player's bowls wins.
//  - Trick shots: a sink that does something special is named and scores a bonus against the computer (see trickOf).
//
// The flight is worked out in the thrower's own frame: the thrower stands at y < 0 and throws toward +y, with the
// target triangle near y = TL. The flight only uses + - * / and sqrt (no sin, cos or pow), which give the same answer in
// every browser, so the thrower's phone and the friend's phone draw the very same arc from the same launch speed.

export type Side = 0 | 1;
export type V3 = [number, number, number];
export const other = (s: Side): Side => (s === 0 ? 1 : 0);

// ── the table ──────────────────────────────────────────────────────────────
export const TL = 160, TW = 80;                 // table length and width
export const R = 6.5, H = 6.2, FOOT = 4;        // a bowl: rim radius, rim height, foot radius
export const BR = 2.1;                          // a blueberry's radius (a big one)
const RIM_T = 0.35;                             // the rim's thickness, as a tube around the rim circle
export const SP = 13.6, ROW = 11.778;           // bowl centres in a row, and rows apart (SP x sin 60)
export const BACK = TL - 11;                    // the back row's centre line, in the thrower's frame
/** The target triangle in the thrower's frame: 0-2 the back row (left to right), 3-4 the middle row, 5 the point. */
export const BOWLS: [number, number][] = [[-SP, BACK], [0, BACK], [SP, BACK], [-SP / 2, BACK - ROW], [SP / 2, BACK - ROW], [0, BACK - 2 * ROW]];
export const N_BOWLS = 6, FLICKS = 2;
/** Where a flick leaves from: centre, a little behind your end of the table, at hand height. */
export const Y0 = -20, Z0 = 45;

// ── the throw ──────────────────────────────────────────────────────────────
export const G = 420;                           // gravity (slower than real, so an arc reads on a phone)
const COS_E = 0.848048, SIN_E = 0.529919;       // every flick leaves at 32 degrees up; power sets the distance
export const U_MIN = 136, U_MAX = 265;          // launch speed at the shortest and the longest pull
export const MIN_PULL = 14, MAX_PULL = 120;     // the pull, in board units, that counts as a flick and that's full power
const LAT = 0.34, MAX_SKEW = 0.55;              // how far sideways a sideways pull aims, and the widest it goes
export const FIRE_BONUS = 1.4;                  // On Fire: how much wider the sweet spot gets

const round2 = (n: number) => Math.round(n * 100) / 100;
/** A launch from a power (0 to 1) and a direction on the table (ax sideways, ay forward; any length). */
export function launchV(p: number, ax: number, ay: number): V3 {
  const k = Math.max(0, Math.min(1, p)), u = U_MIN + (U_MAX - U_MIN) * k, l = Math.sqrt(ax * ax + ay * ay) || 1;
  const vh = u * COS_E;
  return [round2((vh * ax) / l), round2((vh * ay) / l), round2(u * SIN_E)];
}
/** The power and direction a pull gives (drag down to throw up the table; drag left to throw right). */
export function pullAim(px: number, py: number) {
  const len = Math.sqrt(px * px + py * py);
  const p = Math.max(0, Math.min(1, (len - MIN_PULL) / (MAX_PULL - MIN_PULL)));
  const ay = Math.max(1, py), ax = Math.max(-MAX_SKEW, Math.min(MAX_SKEW, (-px * LAT) / ay)) * ay;
  return { p, ax, ay, ok: len >= MIN_PULL && py > 4 };
}
export const pullV = (px: number, py: number): V3 => { const a = pullAim(px, py); return launchV(a.p, a.ax, a.ay); };
/** The berry's position t seconds after launch with nothing in the way (for the aim guide). */
export function freeAt(v: V3, t: number): V3 { return [v[0] * t, Y0 + v[1] * t, Z0 + v[2] * t - (G * t * t) / 2]; }

// ── the flight ─────────────────────────────────────────────────────────────
export type Hit = { t: number; k: "rim" | "wall" | "table" | "sink" | "off" | "stop"; bowl: number };
export type Flight = { pts: number[]; dt: number; hits: Hit[]; bowl: number; end: "sink" | "off" | "stop"; rims: number; x: number; y: number; t: number };
const DT = 1 / 480, REC = 4;                    // physics at 480 steps a second; the path is kept every 4th (120 a second)
export const PATH_DT = DT * REC;
const E_RIM = 0.5, E_WALL = 0.4, E_TABLE = 0.42, ROLL = 1.7;

/** Flies a berry from the launch speed `v` at the bowls still standing (`standing`, in the target triangle's order).
 *  Returns the path (x, y, z every PATH_DT seconds), what it hit and when, and which bowl it sank (-1 for none). */
export function flight(v: V3, standing: boolean[], fire: boolean): Flight {
  let x = 0, y = Y0, z = Z0, vx = v[0], vy = v[1], vz = v[2], t = 0, rolling = false, rims = 0;
  const pts: number[] = [x, y, z], hits: Hit[] = [], last = [-1, -1, -1, -1, -1, -1];
  const clean = R - BR - RIM_T + (fire ? FIRE_BONUS : 0);
  const end = (k: Hit["k"], bowl = -1): Flight => {
    hits.push({ t, k, bowl }); pts.push(x, y, z);
    return { pts, dt: PATH_DT, hits, bowl: k === "sink" ? bowl : -1, end: k === "sink" ? "sink" : k === "off" ? "off" : "stop", rims, x, y, t };
  };
  for (let step = 1; step <= 4 * 480; step++) {
    const zPrev = z;
    if (!rolling) vz -= G * DT;
    x += vx * DT; y += vy * DT; z += vz * DT; t += DT;
    for (let i = 0; i < N_BOWLS; i++) {
      if (!standing[i]) continue;
      const bx = BOWLS[i][0], by = BOWLS[i][1], dx = x - bx, dy = y - by, d2 = dx * dx + dy * dy;
      if (d2 > 121) continue;
      const d = Math.sqrt(d2), ux = d > 1e-6 ? dx / d : 1, uy = d > 1e-6 ? dy / d : 0;
      // dropping through the opening (cleanly, or off the rim and in): sunk
      if (z <= H && zPrev > H && d < Math.max(clean, R - 0.6)) { z = H; return end("sink", i); }
      // the rim, a tube all the way round
      if (d >= clean) {
        const px = x - (bx + R * ux), py = y - (by + R * uy), pz = z - H, dist = Math.sqrt(px * px + py * py + pz * pz);
        if (dist < BR + RIM_T && dist > 1e-6) {
          const nx = px / dist, ny = py / dist, nz = pz / dist, vn = vx * nx + vy * ny + vz * nz;
          if (vn < 0) {
            vx -= (1 + E_RIM) * vn * nx; vy -= (1 + E_RIM) * vn * ny; vz -= (1 + E_RIM) * vn * nz;
            vx *= 0.9; vy *= 0.9; vz *= 0.94; rolling = false;
            if (t - last[i] > 0.06) { hits.push({ t, k: "rim", bowl: i }); rims++; }
            last[i] = t;
          }
          const push = BR + RIM_T - dist; x += nx * push; y += ny * push; z += nz * push;
        }
      }
      // the outside of the bowl, below the rim
      if (z < H && d > R - 1.6) {
        const wr = FOOT + ((R - FOOT) * Math.max(0, z)) / H;
        if (d < wr + BR) {
          x = bx + ux * (wr + BR); y = by + uy * (wr + BR);
          const vr = vx * ux + vy * uy;
          if (vr < 0) { vx -= (1 + E_WALL) * vr * ux; vy -= (1 + E_WALL) * vr * uy; if (t - last[i] > 0.06) hits.push({ t, k: "wall", bowl: i }); last[i] = t; }
        }
      }
    }
    const onTable = x > -TW / 2 && x < TW / 2 && y > 0 && y < TL;
    if (onTable && z <= BR) {
      if (!rolling && vz < 0) {
        const hard = -vz;
        z = BR; vz = hard * E_TABLE; vx *= 0.8; vy *= 0.8;
        if (hard > 30) hits.push({ t, k: "table", bowl: -1 });
        if (vz < 24) { vz = 0; rolling = true; }
      } else if (rolling) z = BR;
    }
    if (rolling) {
      if (!onTable) rolling = false;
      else { const f = 1 - ROLL * DT; vx *= f; vy *= f; if (vx * vx + vy * vy < 36) return end("stop"); }
    }
    if (!onTable && z < -40) return end("off");
    if (step % REC === 0) pts.push(x, y, z);
  }
  return end("stop");
}

// ── trick shots ────────────────────────────────────────────────────────────
// Only the ones this flight can really do. A berry that hits the table early bounces up about 10 units, higher than a
// rim (6.2), so it can drop in on the hop: a Bank Shot (and a bank is about as hard to land as a straight shot, about
// 7% of a full pull wide, just at roughly half the power). A berry can touch the rim, rattle round and still drop:
// a Rim Roll. One off the side of one bowl can drop into the next: a Bowl Hop. Not here: a second bounce only rises
// about 3.8 (under the rim), so no Double Bounce; one berry sinks one bowl; and a full pull flies past the back row
// (which takes about 81%), so a "full power" Long Shot can't sink.
export type Trick = "bank" | "rim" | "hop";
export const TRICKS: Record<Trick, { name: string; how: string }> = {
  bank: { name: "Bank Shot", how: "Off The Table And In" },
  rim: { name: "Rim Roll", how: "Round The Rim And In" },
  hop: { name: "Bowl Hop", how: "Off One Bowl, Into Another" },
};
export const TRICK_PTS = 50;                    // the bonus for each trick shot against the computer
/** The trick shot this flight made, if it sank: off another bowl first beats a bounce, which beats a rattle. */
export function trickOf(f: Flight): Trick | null {
  if (f.bowl < 0) return null;
  if (f.hits.some(h => (h.k === "rim" || h.k === "wall") && h.bowl !== f.bowl)) return "hop";
  if (f.hits.some(h => h.k === "table")) return "bank";
  if (f.hits.filter(h => h.k === "rim" && h.bowl === f.bowl).length >= 2) return "rim";
  return null;
}

// ── the computer ───────────────────────────────────────────────────────────
/** How far (on the table) a launch at speed u travels before it comes down through rim height. */
export function rangeAt(u: number) { const vz = u * SIN_E, vh = u * COS_E; return (vh * (vz + Math.sqrt(vz * vz + 2 * G * (Z0 - H)))) / G; }
/** The power (0 to 1) that brings a berry down through rim height at distance D. */
export function powerFor(D: number) {
  let lo = U_MIN * 0.7, hi = U_MAX * 1.3;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (rangeAt(m) < D) lo = m; else hi = m; }
  return ((lo + hi) / 2 - U_MIN) / (U_MAX - U_MIN);
}
/** A bell-shaped random number around 0 (spread about 1), from three plain draws, so it's the same everywhere. */
const bell = (rnd: () => number) => (rnd() + rnd() + rnd() - 1.5) * 2;
/** Turns the direction (ax, ay) by a small angle a (radians), with plain arithmetic. */
function turn(ax: number, ay: number, a: number) { const c = 1 - (a * a) / 2, s = a - (a * a * a) / 6; return [ax * c - ay * s, ax * s + ay * c]; }

/** Aims at bowl `i` with this much wobble: `pw` spread in power, `aw` in angle (radians). */
export function aimAt(i: number, rnd: () => number, pw: number, aw: number): V3 {
  const [bx, by] = BOWLS[i], D = Math.sqrt(bx * bx + (by - Y0) * (by - Y0));
  const wild = rnd() < 0.07 ? 2.2 : 1;                 // now and then a flick just gets away from you
  const p = powerFor(D) + bell(rnd) * pw * wild, [ax, ay] = turn(bx, by - Y0, bell(rnd) * aw * wild);
  return launchV(p, ax, ay);
}
/** Which bowl to aim at: the one with the most bowls around it (a near miss can still drop in next door), and the
 *  front one of those (it's closest). */
export function pickBowl(standing: boolean[], rnd: () => number) {
  let best = -1, bestScore = -1;
  for (let i = 0; i < N_BOWLS; i++) {
    if (!standing[i]) continue;
    let n = 0;
    for (let j = 0; j < N_BOWLS; j++) if (j !== i && standing[j] && Math.abs(BOWLS[i][0] - BOWLS[j][0]) + Math.abs(BOWLS[i][1] - BOWLS[j][1]) < SP * 1.6) n++;
    const score = n * 10 + (BACK - BOWLS[i][1]) * 0.1 + rnd() * 4;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
/** How much the computer's hand wobbles: 1 for Today and Free Play round 1, a little less each Free Play round after,
 *  and looser for its first 2 turns (4 flicks), so a match always opens gently. */
export function cpuWobble(round: number, flicks = 99) { return Math.max(0.64, 1 - 0.07 * (round - 1)) * (flicks < 4 ? 1.3 : 1); }
export const CPU_PW = 0.048, CPU_AW = 0.031;    // its wobble at 1 (see sim.ts for what that gives)
export const CPU_TRY = 0.14;                    // how often (after its first 2 turns) the computer goes for a Bank Shot

const banks = new Map<string, { i: number; p: number; w: number } | null>();
/** The best Bank Shot at these bowls: the bowl with the widest run of powers that bounce in, and the middle of that run.
 *  Found by flying the real flight at every power step (cached, so each layout of bowls is worked out once). */
export function bankAim(standing: boolean[], fire: boolean) {
  const key = standing.map(Number).join("") + (fire ? "f" : "");
  if (banks.has(key)) return banks.get(key)!;
  let best: { i: number; p: number; w: number } | null = null;
  for (let i = 0; i < N_BOWLS; i++) {
    if (!standing[i]) continue;
    const [bx, by] = BOWLS[i], top = powerFor(Math.sqrt(bx * bx + (by - Y0) * (by - Y0))) - 0.1;
    let run = 0, start = 0;
    for (let k = 0, p = 0.1; p <= top + 1e-9; k++, p = 0.1 + k * 0.004) {
      const f = flight(launchV(p, bx, by - Y0), standing, fire), ok = f.bowl === i && f.hits.some(h => h.k === "table");
      if (ok) { if (!run) start = p; run++; }
      if ((!ok || p + 0.004 > top + 1e-9) && run) {
        const w = run * 0.004;
        if (!best || w > best.w) best = { i, p: start + (run - 1) * 0.002, w };
        run = 0;
      }
    }
  }
  banks.set(key, best);
  return best;
}
/** The computer's flick: usually straight at the bowl it picks; now and then (never in its first 2 turns) it lines up a
 *  Bank Shot instead, with the same wobble, so it lands about as often. `trying` says which, for the "aiming" chip. */
export function cpuPlan(standing: boolean[], rnd: () => number, wobble: number, fire = false, flicks = 99): { v: V3; trying: Trick | null } {
  if (flicks >= 4 && rnd() < CPU_TRY) {
    const b = bankAim(standing, fire);
    if (b) {
      const [bx, by] = BOWLS[b.i], wild = rnd() < 0.07 ? 2.2 : 1;
      const p = b.p + bell(rnd) * CPU_PW * wobble * wild, [ax, ay] = turn(bx, by - Y0, bell(rnd) * CPU_AW * wobble * wild);
      return { v: launchV(p, ax, ay), trying: "bank" };
    }
  }
  return { v: aimAt(pickBowl(standing, rnd), rnd, CPU_PW * wobble, CPU_AW * wobble), trying: null };
}
export function cpuFlick(standing: boolean[], rnd: () => number, wobble: number, fire = false, flicks = 99): V3 { return cpuPlan(standing, rnd, wobble, fire, flicks).v; }

// ── the match ──────────────────────────────────────────────────────────────
/** A flick: the launch speed, the bowl it sank (-1 for a miss) and the trick shot it made, if any (the thrower's phone
 *  works these out from the flight and the friend's phone takes them as final). v is null when the turn clock ran out. */
export type Action = { k: "flick"; v: V3 | null; bowl: number; trick?: Trick };
export type State = {
  bowls: [boolean[], boolean[]];   // each side's own bowls, true while standing
  turn: Side;
  flick: number;                   // which flick of the turn this is (0 or 1)
  turnSinks: number;               // sinks so far this turn
  streak: [number, number];        // sinks in a row
  fire: [boolean, boolean];        // On Fire
  flicks: [number, number];
  sinks: [number, number];
  backs: [number, number];         // Berries Back turns earned
  fires: [number, number];         // times each side caught fire
  tricks: [number, number];        // trick shots
  winner: Side | null;
  seq: number;                     // flicks applied, for live play's "who's newer"
};
export const newState = (first: Side = 0): State => ({
  bowls: [Array(N_BOWLS).fill(true), Array(N_BOWLS).fill(true)], turn: first, flick: 0, turnSinks: 0, streak: [0, 0], fire: [false, false],
  flicks: [0, 0], sinks: [0, 0], backs: [0, 0], fires: [0, 0], tricks: [0, 0], winner: null, seq: 0,
});
export const cloneState = (s: State): State => ({
  ...s, bowls: [[...s.bowls[0]], [...s.bowls[1]]], streak: [...s.streak] as [number, number], fire: [...s.fire] as [boolean, boolean],
  flicks: [...s.flicks] as [number, number], sinks: [...s.sinks] as [number, number], backs: [...s.backs] as [number, number], fires: [...s.fires] as [number, number],
  tricks: [...(s.tricks ?? [0, 0])] as [number, number],
});
export const left = (s: State, side: Side) => s.bowls[side].filter(Boolean).length;

/** What happened, in order, for the animations. */
export type Ev =
  | { e: "flick"; side: Side; v: V3 | null; bowl: number; fire: boolean; n: number; standing: boolean[] }
  | { e: "trick"; side: Side; kind: Trick; bowl: number }
  | { e: "sink"; side: Side; bowl: number; left: number; streak: number }
  | { e: "miss"; side: Side; timeout: boolean }
  | { e: "fire"; side: Side; on: boolean }
  | { e: "back"; side: Side }
  | { e: "win"; side: Side }
  | { e: "turn"; side: Side };

/** Applies one flick for the side whose turn it is. Returns null if it can't happen (a bowl that's already gone). */
export function apply(s0: State, a: Action): { s: State; ev: Ev[] } | null {
  if (s0.winner !== null || a.k !== "flick") return null;
  const t = s0.turn, target = other(t);
  if (a.bowl >= 0 && (a.bowl >= N_BOWLS || !s0.bowls[target][a.bowl] || !a.v)) return null;
  const s = cloneState(s0), ev: Ev[] = [];
  ev.push({ e: "flick", side: t, v: a.v, bowl: a.bowl, fire: s0.fire[t], n: s0.flick, standing: [...s0.bowls[target]] });
  s.flicks[t]++;
  if (a.bowl >= 0) {
    if (a.trick && TRICKS[a.trick]) { s.tricks[t]++; ev.push({ e: "trick", side: t, kind: a.trick, bowl: a.bowl }); }
    s.bowls[target][a.bowl] = false; s.sinks[t]++; s.streak[t]++; s.turnSinks++;
    ev.push({ e: "sink", side: t, bowl: a.bowl, left: left(s, target), streak: s.streak[t] });
    if (left(s, target) === 0) { s.winner = t; ev.push({ e: "win", side: t }); s.seq++; return { s, ev }; }
    if (s.streak[t] >= 2 && !s.fire[t]) { s.fire[t] = true; s.fires[t]++; ev.push({ e: "fire", side: t, on: true }); }
  } else {
    s.streak[t] = 0;
    ev.push({ e: "miss", side: t, timeout: !a.v });
    if (s.fire[t]) { s.fire[t] = false; ev.push({ e: "fire", side: t, on: false }); }
  }
  s.flick++;
  if (s.flick >= FLICKS) {
    if (s.turnSinks >= FLICKS) { s.backs[t]++; ev.push({ e: "back", side: t }); }
    else { s.turn = target; ev.push({ e: "turn", side: target }); }
    s.flick = 0; s.turnSinks = 0;
  }
  s.seq++;
  return { s, ev };
}

// ── the scoreboard ─────────────────────────────────────────────────────────
/** One match against the computer: 100 a sink, up to 400 for accuracy (400 x sinks / flicks), 50 for each trick shot,
 *  and for a win 500 plus 100 for each of your own bowls still standing. Never more than a flawless match (2100) or 350
 *  a flick, so the scoreboard's bounds hold; see the top of BerryPong.tsx. */
export const MAX_MATCH = 2100;
export function matchScore(won: boolean, sinks: number, flicks: number, bowlsLeft: number, tricks = 0) {
  const acc = flicks > 0 ? Math.floor((400 * sinks) / flicks) : 0;
  return Math.min(MAX_MATCH, 350 * flicks, 100 * sinks + acc + TRICK_PTS * tricks + (won ? 500 + 100 * bowlsLeft : 0));
}
