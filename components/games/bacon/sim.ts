// Headless balance check for Blenders & Bacon: plays N games of the real rules (rules.ts) with random dice, both sides
// using the computer's card choices, and prints how long games run and how often the side that's behind comes back.
// Run it from the repo root:
//   npx tsc --outDir /tmp/bb-sim --module commonjs --target es2020 --skipLibCheck components/games/bacon/sim.ts && node /tmp/bb-sim/sim.js
// Results for this layout (1000 games, seed 12345), 2026-11-13, 96 squares:
//   winner's turns: median 25, 10th to 90th percentile 18 to 37, longest 69
//   side that's behind at the halfway point still wins 36%; behind by 10+ squares at halfway still wins 33%
//   first player wins 50%; per game about 3 blender rides, 4.9 bacon slides, 5.5 cards, 1.2 Oven Mitt saves
//   estimated play time (the SEC timings below): median 4.0 minutes, 90th percentile 6.1, longest 11.2
//   A real game against the computer in WebKit, rolling the moment Roll lit up, ran 3.6 s a turn (34 turns each, 242 s);
//   with a person's thinking time on top that's about 4 minutes against the computer and 4 to 5 against a friend.
import { apply, cpuCard, newState, BACON, BLENDERS, type State, type Side } from "./rules";

function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// rough seconds each thing takes on screen (die, hops, blender, bacon, cards), plus thinking time before a roll
const SEC = { die: 1.25, hop: 0.24, blender: 2.0, bacon: 1.6, mitt: 1.1, card: 1.0, play: 1.1, swap: 1.0, turn: 0.9, human: 1.8, cpu: 0.9 };

export type Result = { winner: Side; turns: number; total: number; secs: number; midBehindWon: boolean | null; bigComeback: boolean | null;
  blenders: number; bacon: number; mitts: number; cards: number; swaps: number };

export function playOne(r: () => number, first: Side = 0): Result {
  let s: State = newState(first);
  const snaps: State[] = [s];
  let secs = 0, blenders = 0, bacon = 0, mitts = 0, cards = 0, swaps = 0;
  for (let guard = 0; guard < 2000 && s.winner === null; guard++) {
    if (s.sub === 0 && !s.played) secs += s.turn === 0 ? SEC.human : SEC.cpu;
    const c = cpuCard(s, s.turn);
    const out = c ? apply(s, { k: "card", card: c }) : apply(s, { k: "roll", v: 1 + Math.floor(r() * 6), pick: r() });
    if (!out) throw new Error("illegal");
    for (const e of out.ev) {
      if (e.e === "die") secs += SEC.die;
      else if (e.e === "hop") secs += SEC.hop * (e.to - e.from);
      else if (e.e === "blender") { secs += SEC.blender; blenders++; }
      else if (e.e === "bacon") { secs += SEC.bacon; bacon++; }
      else if (e.e === "mitt") { secs += SEC.mitt; mitts++; }
      else if (e.e === "card" || e.e === "full") { secs += SEC.card; cards++; }
      else if (e.e === "play") secs += SEC.play;
      else if (e.e === "swap") { secs += SEC.swap; swaps++; }
      else if (e.e === "turn") secs += SEC.turn;
    }
    s = out.s;
    if (out.ev.some(e => e.e === "turn")) snaps.push(s);
  }
  const winner = s.winner as Side, mid = snaps[Math.floor(snaps.length / 2)];
  const gap = mid.pos[0] - mid.pos[1];
  const behind: Side | null = gap === 0 ? null : gap < 0 ? 0 : 1;
  return { winner, turns: s.turns[winner], total: s.turnNo + 1, secs, midBehindWon: behind === null ? null : behind === winner,
    bigComeback: Math.abs(gap) >= 10 ? behind === winner : null, blenders, bacon, mitts, cards, swaps };
}

export function simulate(n = 1000, seed = 12345) {
  const r = rng(seed), res: Result[] = [];
  for (let i = 0; i < n; i++) res.push(playOne(r, (i % 2) as Side));
  const turns = res.map(x => x.turns).sort((a, b) => a - b), secs = res.map(x => x.secs).sort((a, b) => a - b);
  const q = (a: number[], p: number) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
  const mid = res.filter(x => x.midBehindWon !== null), big = res.filter(x => x.bigComeback !== null);
  const avg = (k: keyof Result) => (res.reduce((a, x) => a + (x[k] as number), 0) / n).toFixed(2);
  return {
    games: n,
    winnerTurns: { median: q(turns, 0.5), p10: q(turns, 0.1), p90: q(turns, 0.9), max: turns[turns.length - 1], min: turns[0] },
    minutes: { median: +(q(secs, 0.5) / 60).toFixed(1), p10: +(q(secs, 0.1) / 60).toFixed(1), p90: +(q(secs, 0.9) / 60).toFixed(1), max: +(secs[secs.length - 1] / 60).toFixed(1) },
    behindAtHalfwayWins: `${Math.round((100 * mid.filter(x => x.midBehindWon).length) / mid.length)}%`,
    behindBy10PlusWins: `${Math.round((100 * big.filter(x => x.bigComeback).length) / Math.max(1, big.length))}% (of ${big.length} games)`,
    firstPlayerWins: `${Math.round((100 * res.filter((x, i) => x.winner === ((i % 2) as Side)).length) / n)}%`,
    perGame: { blenders: avg("blenders"), bacon: avg("bacon"), mittSaves: avg("mitts"), cards: avg("cards"), swaps: avg("swaps") },
    layout: { blenders: BLENDERS.map(b => b.join("->")).join(" "), bacon: BACON.map(b => b.join("->")).join(" ") },
  };
}

if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) console.log(JSON.stringify(simulate(Number(process.argv[2]) || 1000), null, 2));
