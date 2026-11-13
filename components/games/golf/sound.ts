// Little sounds for Kitchen Golf, made with the Web Audio API (no audio files). They play through the shared games sound
// (../sfx), so one on/off setting and one speaker button cover every game; the voices are Kitchen Golf's own.
import { sfx, type Synth } from "../sfx";

const V = 1.1;   // these were tuned at a 0.55 master volume; the shared one is 0.5
const tone = (k: Synth, freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slideTo?: number) => k.tone(freq, dur, type, vol * V, at, slideTo);
const noise = (k: Synth, dur: number, vol: number, filter: BiquadFilterType, freq: number, at = 0, toFreq?: number) => k.noise(dur, vol * V, filter, freq, at, toFreq);

export class Sound {
  /** Call from a tap or click (browsers only start audio after a gesture). The shared sound also does this on every tap. */
  unlock() { sfx.unlock(); }
  /** The putter's tap, harder for a harder putt (power 0..1). */
  putt(power: number) { sfx.voice("putt", k => { tone(k, 520 + 260 * power, 0.07, "sine", 0.12 + 0.16 * power, 0, 300); noise(k, 0.03, 0.12 + 0.2 * power, "highpass", 2400); }); }
  /** Bumping a wall or a bowl; `speed` is how hard. */
  bump(speed: number) {
    const v = Math.min(1, speed / 6); if (v < 0.08) return;
    sfx.voice("bump", k => { tone(k, 150 + 80 * v, 0.09, "sine", 0.05 + 0.18 * v, 0, 90); noise(k, 0.05, 0.05 + 0.15 * v, "lowpass", 900); });
  }
  /** Into the cup: a rattle, then a plop. */
  cup() { sfx.voice("cup", k => { [0, 0.05, 0.1].forEach((a, i) => tone(k, 1500 - i * 200, 0.04, "triangle", 0.07, a)); tone(k, 240, 0.22, "sine", 0.2, 0.15, 120); }, 0, true); }
  splash() { sfx.voice("splash", k => { noise(k, 0.5, 0.32, "bandpass", 1600, 0, 400); tone(k, 180, 0.25, "sine", 0.08, 0.02, 90); }); }
  tube() { sfx.voice("tube", k => noise(k, 0.45, 0.2, "lowpass", 300, 0, 1400)); }
  sizzle() { sfx.voice("sizzle", k => noise(k, 0.18, 0.06, "highpass", 4000)); }
  cheer(big: boolean) { sfx.voice("cheer", k => (big ? [523, 659, 784, 1046, 1318] : [659, 784, 988]).forEach((f, i) => tone(k, f, 0.38, "triangle", 0.13, i * 0.08)), 0, true); }
  meh() { sfx.voice("meh", k => { tone(k, 392, 0.2, "triangle", 0.1); tone(k, 330, 0.3, "triangle", 0.1, 0.16); }, 0, true); }
}
