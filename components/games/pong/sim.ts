// Headless balance check for Berry Pong: plays N matches of the real rules and flight (rules.ts) between a decent
// simulated player and the computer, and prints how long matches run, how often the computer wins, how often On Fire and
// Berries Back come up, and the scores (to check the scoreboard bounds at the top of BerryPong.tsx).
// Run it from the repo root (any out dir works):
//   npx tsc --outDir /tmp/pong-sim --module commonjs --target es2020 --skipLibCheck components/games/pong/sim.ts && node /tmp/pong-sim/sim.js
// The "decent player" aims at the same bowls the computer would, with a steadier hand than the computer's first round
// (power wobble 0.04, angle 0.025 rad: about 4 px of pull and a degree and a half), which is how a player throws after a
// few flicks of practice. A brand new player is closer to the "new player" line.
// Results, 2026-11-13 (2000 matches each; the timings below; aiming time assumed 3 s a flick):
//   decent player vs Today / Free Play round 1: computer wins 25%; match median 1.9 min (10th to 90th percentile 1.1 to
//     2.8, longest 4.4); hit rate 38% (computer 31%); your flicks median 14, most 32
//   average player (power 0.05, angle 0.032): computer wins 48%; median 2.3 min (1.5 to 3.3); hit rate 29% (computer 30%)
//   new player (power 0.065, angle 0.04): computer wins 70%; median 2.5 min (1.6 to 3.6); hit rate 24%
//   Free Play vs the decent player: computer wins 29% in round 2, 39% in round 3, 53% in round 5
//   On Fire comes up in about 95% of matches (decent player 1.0 times a match, computer 0.7); Berries Back in about 82%
//     (you 0.8, computer 0.5)
//   score per flick never passes 350 (a flawless match: 2100 from 6 flicks); most flicks in one match 45 (new player)
import { apply, newState, flight, cpuFlick, cpuWobble, aimAt, pickBowl, matchScore, left, other, type State, type Side, type V3 } from "./rules";

function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// rough seconds each thing takes on screen (BerryPong.tsx's timings), plus aiming time before a flick
export const SEC = { human: 3.0, cpu: 1.18, sink: 1.1, miss: 0.48, fire: 1.0, back: 1.3, turn: 0.35, maxMiss: 1.5 };

export type Player = { pw: number; aw: number };
export const DECENT: Player = { pw: 0.04, aw: 0.025 };
export const AVERAGE: Player = { pw: 0.05, aw: 0.032 };
export const NEWBIE: Player = { pw: 0.065, aw: 0.04 };

type Result = { winner: Side; secs: number; flicks: [number, number]; sinks: [number, number]; fires: [number, number]; backs: [number, number];
  left: [number, number]; score: number };

export function playOne(r: () => number, you: Player, round: number): Result {
  let s: State = newState(0);
  let secs = 0;
  for (let guard = 0; guard < 2000 && s.winner === null; guard++) {
    const t = s.turn, standing = s.bowls[other(t)];
    secs += t === 0 ? SEC.human : SEC.cpu;
    const v: V3 = t === 0 ? aimAt(pickBowl(standing, r), r, you.pw, you.aw) : cpuFlick(standing, r, cpuWobble(round, s.flicks[1]));
    const f = flight(v, standing, s.fire[t]);
    const out = apply(s, { k: "flick", v, bowl: f.bowl });
    if (!out) throw new Error("illegal");
    secs += f.bowl >= 0 ? Math.min(f.t, 2.2) + SEC.sink : Math.min(f.t, SEC.maxMiss) + SEC.miss;
    for (const e of out.ev) {
      if (e.e === "fire" && e.on) secs += SEC.fire;
      else if (e.e === "back") secs += SEC.back;
      else if (e.e === "turn") secs += SEC.turn;
    }
    s = out.s;
  }
  const winner = s.winner as Side;
  return { winner, secs, flicks: [...s.flicks] as [number, number], sinks: [...s.sinks] as [number, number], fires: [...s.fires] as [number, number],
    backs: [...s.backs] as [number, number], left: [left(s, 0), left(s, 1)], score: matchScore(winner === 0, s.sinks[0], s.flicks[0], left(s, 0)) };
}

export function simulate(n = 2000, seed = 12345, you: Player = DECENT, round = 1) {
  const r = rng(seed), res: Result[] = [];
  for (let i = 0; i < n; i++) res.push(playOne(r, you, round));
  const q = (a: number[], p: number) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
  const secs = res.map(x => x.secs).sort((a, b) => a - b), pf = res.map(x => x.flicks[0]).sort((a, b) => a - b);
  const scores = res.map(x => x.score).sort((a, b) => a - b);
  const sum = (f: (x: Result) => number) => res.reduce((a, x) => a + f(x), 0);
  const pct = (k: number) => `${Math.round((100 * k) / n)}%`;
  return {
    games: n, round, you,
    computerWins: pct(res.filter(x => x.winner === 1).length),
    minutes: { median: +(q(secs, 0.5) / 60).toFixed(1), p10: +(q(secs, 0.1) / 60).toFixed(1), p90: +(q(secs, 0.9) / 60).toFixed(1), max: +(secs[secs.length - 1] / 60).toFixed(1) },
    yourFlicks: { median: q(pf, 0.5), p90: q(pf, 0.9), max: pf[pf.length - 1], min: pf[0] },
    hitRate: { you: (sum(x => x.sinks[0]) / sum(x => x.flicks[0])).toFixed(3), computer: (sum(x => x.sinks[1]) / sum(x => x.flicks[1])).toFixed(3) },
    onFirePerMatch: { you: (sum(x => x.fires[0]) / n).toFixed(2), computer: (sum(x => x.fires[1]) / n).toFixed(2), anyInMatch: pct(res.filter(x => x.fires[0] + x.fires[1] > 0).length) },
    berriesBackPerMatch: { you: (sum(x => x.backs[0]) / n).toFixed(2), computer: (sum(x => x.backs[1]) / n).toFixed(2), anyInMatch: pct(res.filter(x => x.backs[0] + x.backs[1] > 0).length) },
    yourScore: { median: q(scores, 0.5), p90: q(scores, 0.9), max: scores[scores.length - 1], worstPerFlick: Math.max(...res.map(x => x.score / Math.max(1, x.flicks[0]))).toFixed(1) },
  };
}

if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  const n = Number(process.argv[2]) || 2000;
  console.log(JSON.stringify([simulate(n, 12345, DECENT, 1), simulate(n, 777, DECENT, 2), simulate(n, 999, DECENT, 3), simulate(n, 4242, DECENT, 5), simulate(n, 2024, AVERAGE, 1), simulate(n, 31337, NEWBIE, 1)], null, 2));
}
