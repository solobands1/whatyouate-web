// Little sounds for Blenders & Bacon, made with the Web Audio API (no audio files). They play through the shared games
// sound (../sfx), so one on/off setting and one speaker button cover every game; the voices are this game's own.
import { sfx, type Synth } from "../sfx";

/** One roll's timing, in seconds from the throw: when the die hits the table and how hard (1 for the first hit), and when
 *  it settles flat. A real die tumbling on a table hits 2 to 5 times, each hop shorter and softer than the last (the gaps
 *  shrink by about the same ratio each time, like a bouncing ball), then rocks onto its face. The die animation in
 *  BlendersBacon.tsx is drawn from the same plan, so each clack lands with a visible bounce. */
export type DicePlan = { hits: { t: number; s: number }[]; settle: number; end: number };
export function dicePlan(rnd: () => number = Math.random): DicePlan {
  const u = rnd(), n = u < 0.15 ? 2 : u < 0.5 ? 3 : u < 0.85 ? 4 : 5;
  const first = 0.19 + rnd() * 0.05;                 // the drop from the hand to the first hit
  const last = first + [0.2, 0.3, 0.36, 0.42][n - 2] * (0.85 + rnd() * 0.3);   // the last hard hit: more hits, a longer tumble
  const r = 0.55 + rnd() * 0.12;                     // each hop this much shorter than the one before
  let gap = n > 1 ? ((last - first) * (1 - r)) / (1 - r ** (n - 1)) : 0, t = first, s = 1;
  const hits: DicePlan["hits"] = [];
  for (let k = 0; k < n; k++) {
    hits.push({ t: +t.toFixed(4), s: +s.toFixed(3) });
    t += gap * (0.92 + rnd() * 0.16); gap *= r; s *= 0.56 + rnd() * 0.16;
  }
  const settle = hits[n - 1].t + 0.035 + rnd() * 0.03;
  return { hits, settle, end: settle + 0.07 };
}

/** One clack of the die on the wooden table, kept round rather than pointy (the owner's ear, 2026-11-17): mostly the
 *  table's warm wooden body (a few inharmonic modes from about 200 Hz to 1.7 kHz that die away in 25 to 60 ms), with
 *  only a soft touch of the die's edge on top (a short tick of noise around 1.5 to 2 kHz and a quiet, very short high
 *  ring), every part easing in over 1.5 ms. Each hit lands a little differently: on a corner it's a bit brighter, flat
 *  on a face it's fuller, and the pitches shift a few percent with where on the table it lands. */
function clack(k: Synth, at: number, s: number, rnd: () => number) {
  const j = () => 0.95 + rnd() * 0.1, edge = rnd(), body = 1 - edge * 0.3;
  k.knock(0.28 * s, at, [
    [210 * j(), 0.055, 0.11 * body],         // the table top flexing
    [640 * j(), 0.05, 0.32 * body],          // the wood's main knock
    [1060 * j(), 0.036, 0.27 * body],
    [1680 * j(), 0.026, 0.19],
    [2700 * j(), 0.016, 0.1 + 0.04 * edge],
    [4200 * j(), 0.007, 0.04 + 0.04 * edge], // the die's little ring
  ], 0.2 + 0.12 * edge, 1500 + 500 * edge, 0.0015);
}

export class Sound {
  /** Call from a tap (browsers only start audio after a gesture). The shared sound also does this on every tap. */
  unlock() { sfx.unlock(); }
  private v(name: string, make: (k: Synth) => void, key = false) { sfx.voice(name, make, 0, key); }
  /** The die tumbling on the table: a clack for each hit in the plan, softer each time, then a soft settle as it rocks
   *  flat (two tiny ticks and a low touch of the table). */
  roll(p: DicePlan, rnd: () => number = Math.random) {
    this.v("roll", k => {
      for (const h of p.hits) clack(k, h.t, h.s, rnd);
      const s = p.hits[p.hits.length - 1].s * 0.5;
      clack(k, p.settle - 0.022, s * 0.45, rnd);
      k.knock(0.28 * s, p.settle, [[200, 0.04, 0.12], [610, 0.035, 0.22], [1200, 0.02, 0.1]], 0.06, 1400, 0.002);
    });
  }
  hop(n: number) { this.v("hop", k => k.tone(560 + (n % 6) * 40, 0.06, "sine", 0.1, 0, 760 + (n % 6) * 40)); }
  whirl() { this.v("whirl", k => { k.noise(0.9, 0.18, "bandpass", 300, 0, 2200); k.tone(110, 0.9, "sawtooth", 0.03, 0, 220); }); }
  whoosh() { this.v("whoosh", k => { k.noise(0.7, 0.2, "lowpass", 400, 0, 3000); k.tone(300, 0.7, "sine", 0.06, 0, 900); }); }
  pop() { this.v("pop", k => k.tone(700, 0.09, "sine", 0.16, 0, 1200)); }
  sizzle() { this.v("sizzle", k => { k.noise(0.6, 0.1, "highpass", 4200); k.noise(0.3, 0.06, "highpass", 6000, 0.25); }); }
  slide() { this.v("slide", k => k.tone(620, 0.6, "triangle", 0.09, 0, 180)); }
  card() { this.v("card", k => [880, 1175, 1568].forEach((f, i) => k.tone(f, 0.16, "triangle", 0.1, i * 0.06))); }
  play() { this.v("play", k => { k.tone(523, 0.12, "triangle", 0.12); k.tone(784, 0.2, "triangle", 0.12, 0.08); }); }
  mitt() { this.v("mitt", k => { k.noise(0.12, 0.2, "lowpass", 600); k.tone(392, 0.25, "triangle", 0.12, 0.05, 523); }); }
  turn() { this.v("turn", k => { k.tone(660, 0.1, "sine", 0.1); k.tone(990, 0.14, "sine", 0.1, 0.09); }, true); }
  win() { this.v("win", k => [523, 659, 784, 1046, 1318].forEach((f, i) => k.tone(f, 0.42, "triangle", 0.12, i * 0.09)), true); }
  lose() { this.v("lose", k => { k.tone(392, 0.22, "triangle", 0.1); k.tone(330, 0.34, "triangle", 0.1, 0.18); }, true); }
  click() { this.v("click", k => k.tone(900, 0.04, "sine", 0.07)); }
}
