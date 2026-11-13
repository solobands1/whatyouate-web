// Little sounds for Berry Pong, made with the Web Audio API (no audio files). They play through the shared games sound
// (../sfx), so one on/off setting and one speaker button cover every game, and it follows the same holds and the
// iPhone's silent switch; the voices are Berry Pong's own.
import { sfx, type Synth } from "../sfx";

export class Sound {
  /** Call from a tap (browsers only start audio after a gesture). The shared sound also does this on every tap. */
  unlock() { sfx.unlock(); }
  private v(name: string, make: (k: Synth) => void, key = false) { sfx.voice(name, make, 0, key); }
  // Berry Pong's noise fades on a squared curve, always with a filter Q of 1 unless given
  private n(k: Synth, dur: number, vol: number, filter: BiquadFilterType, freq: number, at = 0, toFreq?: number, q = 1) { k.noise(dur, vol, filter, freq, at, toFreq, q, true); }
  /** The flick leaving your fingers. */
  flick() { this.v("flick", k => this.n(k, 0.16, 0.12, "bandpass", 900, 0, 2600, 0.8)); }
  /** A berry dropping into milk: a round plop and a little splash. */
  plop() { this.v("plop", k => { k.tone(520, 0.16, "sine", 0.22, 0, 140); this.n(k, 0.22, 0.12, "bandpass", 1800, 0.03, 700, 1.4); k.tone(900, 0.06, "sine", 0.06, 0.12, 1300); }, true); }
  /** Off the ceramic rim. */
  rim() { this.v("rim", k => { k.tone(2350, 0.18, "triangle", 0.09); k.tone(3520, 0.1, "sine", 0.04, 0.005); }); }
  /** A bounce on the wooden table. */
  tap(s = 1) { this.v("table", k => { this.n(k, 0.05, 0.16 * s, "lowpass", 900); k.tone(210, 0.05, "sine", 0.06 * s, 0, 150); }); }
  /** The bowl lifting off the table. */
  lift() { this.v("lift", k => k.tone(440, 0.3, "sine", 0.06, 0, 880)); }
  fire() { this.v("fire", k => { for (let i = 0; i < 7; i++) this.n(k, 0.05, 0.08, "highpass", 3000 + Math.random() * 2000, i * 0.05); k.tone(330, 0.5, "sawtooth", 0.035, 0, 660); }, true); }
  out() { this.v("out", k => k.tone(300, 0.18, "triangle", 0.06, 0, 200)); }
  back() { this.v("back", k => [659, 880, 1175].forEach((f, i) => k.tone(f, 0.18, "triangle", 0.1, i * 0.07)), true); }
  turn() { this.v("turn", k => { k.tone(660, 0.1, "sine", 0.1); k.tone(990, 0.14, "sine", 0.1, 0.09); }, true); }
  win() { this.v("win", k => [523, 659, 784, 1046, 1318].forEach((f, i) => k.tone(f, 0.42, "triangle", 0.12, i * 0.09)), true); }
  lose() { this.v("lose", k => { k.tone(392, 0.22, "triangle", 0.1); k.tone(330, 0.34, "triangle", 0.1, 0.18); }, true); }
  click() { this.v("click", k => k.tone(900, 0.04, "sine", 0.07)); }
}
