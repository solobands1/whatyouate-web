// Little sounds for Blenders & Bacon, made with the Web Audio API (no audio files). They play through the shared games
// sound (../sfx), so one on/off setting and one speaker button cover every game; the voices are this game's own.
import { sfx, type Synth } from "../sfx";

export class Sound {
  /** Call from a tap (browsers only start audio after a gesture). The shared sound also does this on every tap. */
  unlock() { sfx.unlock(); }
  private v(name: string, make: (k: Synth) => void, key = false) { sfx.voice(name, make, 0, key); }
  /** The die rattling, then landing. */
  roll() { this.v("roll", k => { for (let i = 0; i < 6; i++) k.noise(0.035, 0.14, "bandpass", 2600 - i * 150, i * 0.09); k.tone(180, 0.08, "sine", 0.18, 0.62, 120); }); }
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
