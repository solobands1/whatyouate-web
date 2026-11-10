// Little sounds for Pat's Lawnmower, made with the Web Audio API (no audio files). Off until the player turns them on.
//
// The tractor: a small single-cylinder engine. One loop of 48 firing cycles is built once (each a thump with an
// exhaust bark, the cycles a touch uneven in length and strength so it chugs rather than buzzes), then played faster
// or slower for the revs: about 24 firings a second at idle up to 50 at full throttle, through a low-pass that opens
// with the revs, with a quiet second harmonic on top. The blades add a soft whir, with a grassy chop over long grass.
// Everything ends in a gentle low-pass and a soft limiter so nothing clips; all changes glide (setTargetAtTime).

type Ctx = AudioContext;
const VOL = 0.6;           // the overall level: gentle
const F0 = 25;             // the firing rate the loop was built at (a second's loop holds 25 cycles)
export type EngineState = { on: boolean; rpm: number; blades: number; load: number };   // rpm 0 idle..1 full; blades 0 off, 0.4 over cut grass, 1 over long grass; load 0..1 (a bump, a hard turn) dips the revs

/** A tiny repeatable random number source. */
function lcg(seed: number) { let x = seed >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
/** One loop of the engine's firing cycles at F0. */
function putterBuffer(c: BaseAudioContext) {
  const sr = c.sampleRate, cycles = 48, r = lcg(7), lens: number[] = [];
  let tot = 0; for (let i = 0; i < cycles; i++) { const l = 1 + (r() - 0.5) * 0.1; lens.push(l); tot += l; }
  const N = Math.round((sr * cycles) / F0), buf = c.createBuffer(1, N, sr), d = buf.getChannelData(0);
  let pos = 0, lp = 0, peak = 0;
  for (let i = 0; i < cycles; i++) {
    const len = i === cycles - 1 ? N - pos : Math.round((lens[i] / tot) * N), amp = 0.72 + r() * 0.42, bark = 0.45 + r() * 0.35;
    for (let j = 0; j < len; j++) {
      const t = j / sr;
      lp += 0.32 * ((r() * 2 - 1) - lp);   // softened noise for the exhaust bark
      // the bang: a low thump with brighter overtones that die away faster (phone speakers need the 300-900 Hz part)
      const thump = Math.exp(-t * 34) * Math.sin(2 * Math.PI * 96 * t) * 0.8 + Math.exp(-t * 60) * (Math.sin(2 * Math.PI * 240 * t + 1) * 0.45 + Math.sin(2 * Math.PI * 470 * t + 2) * 0.22);
      const v = amp * (thump + Math.exp(-t * 70) * lp * bark * 2.6) - 0.14 * Math.sin((Math.PI * j) / len);
      d[pos + j] = v; peak = Math.max(peak, Math.abs(v));
    }
    pos += len;
  }
  for (let k = 0; k < N; k++) d[k] *= 0.9 / peak;
  return buf;
}
function noiseBuffer(c: BaseAudioContext, secs: number) { const len = Math.floor(c.sampleRate * secs), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0), r = lcg(3); for (let i = 0; i < len; i++) d[i] = r() * 2 - 1; return b; }

type EngineNodes = { src: AudioBufferSourceNode; harm: OscillatorNode; lp: BiquadFilterNode; g: GainNode; hg: GainNode; whir: GainNode; chop: GainNode; chopLfo: OscillatorNode; out: GainNode };
/** The engine and blade sounds, wired into `dest`. Nothing is heard until `out` is turned up. */
function buildEngine(c: BaseAudioContext, dest: AudioNode): EngineNodes {
  const out = c.createGain(); out.gain.value = 0; out.connect(dest);
  const src = c.createBufferSource(); src.buffer = putterBuffer(c); src.loop = true;
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520; lp.Q.value = 0.7;
  const g = c.createGain(); g.gain.value = 0.44;
  src.connect(lp); lp.connect(g); g.connect(out);
  const harm = c.createOscillator(); harm.type = "sine"; harm.frequency.value = 48; const hg = c.createGain(); hg.gain.value = 0.05; harm.connect(hg); hg.connect(lp);
  const nb = noiseBuffer(c, 2);
  const n1 = c.createBufferSource(); n1.buffer = nb; n1.loop = true; const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.8;
  const whir = c.createGain(); whir.gain.value = 0; n1.connect(bp); bp.connect(whir); whir.connect(out);
  const n2 = c.createBufferSource(); n2.buffer = nb; n2.loop = true; n2.loopStart = 0.7; const bp2 = c.createBiquadFilter(); bp2.type = "bandpass"; bp2.frequency.value = 650; bp2.Q.value = 1.1;
  const chopAmp = c.createGain(); chopAmp.gain.value = 0.5; const chop = c.createGain(); chop.gain.value = 0;
  const chopLfo = c.createOscillator(); chopLfo.type = "triangle"; chopLfo.frequency.value = 9; const lfoG = c.createGain(); lfoG.gain.value = 0.5; chopLfo.connect(lfoG); lfoG.connect(chopAmp.gain);
  n2.connect(bp2); bp2.connect(chopAmp); chopAmp.connect(chop); chop.connect(out);
  src.start(); harm.start(); n1.start(); n2.start(0, 0.7); chopLfo.start();
  return { src, harm, lp, g, hg, whir, chop, chopLfo, out };
}
/** Sets the engine's revs, its level and the blades (gliding there over `tc` seconds). */
function setEngine(e: EngineNodes, t: number, rpm: number, level: number, blades: number, tc = 0.12) {
  const f = 24 + 26 * Math.max(0, Math.min(1.2, rpm));
  e.src.playbackRate.setTargetAtTime(f / F0, t, tc); e.harm.frequency.setTargetAtTime(f * 2, t, tc);
  e.lp.frequency.setTargetAtTime(520 + 480 * Math.min(1, rpm), t, tc * 1.5);
  e.g.gain.setTargetAtTime(0.44 + 0.12 * Math.min(1, rpm), t, tc);
  e.out.gain.setTargetAtTime(level, t, 0.06);
  e.whir.gain.setTargetAtTime(blades > 0 ? 0.035 + 0.03 * blades : 0, t, 0.2);
  e.chop.gain.setTargetAtTime(Math.max(0, blades - 0.5) * 0.14, t, 0.15);
}
/** The master chain: a gentle low-pass, then a soft limiter. */
function buildMaster(c: BaseAudioContext, level: number) {
  const master = c.createGain(); master.gain.value = level;
  const soft = c.createBiquadFilter(); soft.type = "lowpass"; soft.frequency.value = 5200; soft.Q.value = 0.5;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 8; comp.attack.value = 0.004; comp.release.value = 0.2;
  master.connect(soft); soft.connect(comp); comp.connect(c.destination);
  return master;
}

/** Renders a few seconds of the engine to check it by ear or by numbers: "idle", "cruise" (over long grass) or "full". */
export async function renderEngineClip(kind: "idle" | "cruise" | "full", secs = 4): Promise<AudioBuffer> {
  const OAC = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const c = new OAC(1, Math.round(44100 * secs), 44100), e = buildEngine(c, buildMaster(c, VOL));
  const [rpm, blades] = kind === "idle" ? [0, 0] : kind === "cruise" ? [0.6, 1] : [1, 0.4];
  setEngine(e, 0, rpm, 1, blades, 0.01);
  return c.startRendering();
}
/** A rendered clip as a 16-bit mono WAV file. */
export function toWav(b: AudioBuffer) {
  const d = b.getChannelData(0), n = d.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, b.sampleRate, true); v.setUint32(28, b.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
  return buf;
}

export class Sound {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private eng: EngineNodes | null = null;
  private running = false;
  private paused = false;
  private rain: { src: AudioBufferSourceNode; g: GainNode } | null = null;
  muted = true;

  /** Must be called from a tap or click (browsers only start audio after a gesture). */
  unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = buildMaster(this.ctx, this.muted ? 0 : VOL);
    } catch { this.ctx = null; }
  }
  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : VOL, this.ctx.currentTime, 0.05);
    this.setPaused(this.paused);
  }
  /** Paused, hidden or muted: the audio clock stops (no work, no noise); it starts again on the next tap if need be. */
  setPaused(p: boolean) {
    this.paused = p; const c = this.ctx; if (!c) return;
    if ((p || this.muted) && c.state === "running") c.suspend().catch(() => {});
    else if (!p && !this.muted && c.state === "suspended") c.resume().catch(() => {});
  }
  private now() { return this.ctx ? this.ctx.currentTime : 0; }
  private tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slideTo?: number) {
    const c = this.ctx, m = this.master; if (!c || !m || this.muted) return;
    const t = this.now() + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(m); o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, vol: number, filter: BiquadFilterType, freq: number, at = 0) {
    const c = this.ctx, m = this.master; if (!c || !m || this.muted) return;
    const t = this.now() + at, len = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = filter; f.frequency.value = freq; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(m); s.start(t);
  }
  /** The tractor, every frame: a crank when it starts, revs and blades as it drives, a sputter when it stops. */
  engine(st: EngineState) {
    const c = this.ctx, m = this.master; if (!c || !m) return;
    if (!this.eng) this.eng = buildEngine(c, m);
    const e = this.eng, t = c.currentTime;
    if (st.on && !this.running) {   // the starter turns it over a few times, it catches, revs up a touch, settles to idle
      this.running = true;
      e.src.playbackRate.cancelScheduledValues(t); e.src.playbackRate.setValueAtTime(0.36, t); e.src.playbackRate.setTargetAtTime(0.5, t, 0.3);
      e.out.gain.cancelScheduledValues(t); e.out.gain.setValueAtTime(0.0001, t); e.out.gain.setTargetAtTime(0.7, t, 0.08);
      e.lp.frequency.setValueAtTime(260, t);
      const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = "sawtooth"; o.frequency.setValueAtTime(150, t); o.frequency.linearRampToValueAtTime(230, t + 0.6);
      f.type = "bandpass"; f.frequency.value = 700; f.Q.value = 1.5; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.connect(f); f.connect(g); g.connect(m); o.start(t); o.stop(t + 0.75);
      e.src.playbackRate.setTargetAtTime((24 + 26 * 0.45) / F0, t + 0.65, 0.08);   // caught: a little rev...
      e.src.playbackRate.setTargetAtTime(24 / F0, t + 1.0, 0.25);                   // ...and down to idle
      e.out.gain.setTargetAtTime(1, t + 0.65, 0.1);
      this.startT = t + 1.2;
      return;
    }
    if (!st.on && this.running) {   // a few uneven last putts, slowing, then quiet
      this.running = false;
      e.src.playbackRate.cancelScheduledValues(t); e.src.playbackRate.setTargetAtTime(0.4, t, 0.35);
      e.lp.frequency.setTargetAtTime(220, t, 0.3);
      e.out.gain.cancelScheduledValues(t); e.out.gain.setTargetAtTime(0, t + 0.5, 0.18);
      e.whir.gain.setTargetAtTime(0, t, 0.15); e.chop.gain.setTargetAtTime(0, t, 0.1);
      for (const at of [0.25, 0.55, 0.9]) this.noise(0.06, 0.12, "lowpass", 500, at);
      return;
    }
    if (!st.on || t < this.startT) return;
    setEngine(e, t, Math.max(0, st.rpm - 0.18 * st.load), 1, st.blades);
  }
  private startT = 0;
  /** Steady rain, louder with `amount` (0..1). */
  rainLevel(amount: number) {
    const c = this.ctx, m = this.master; if (!c || !m) return;
    if (!this.rain && amount > 0) {
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = buf; src.loop = true; f.type = "highpass"; f.frequency.value = 1200; g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(m); src.start();
      this.rain = { src, g };
    }
    if (this.rain) this.rain.g.gain.setTargetAtTime(this.muted ? 0 : amount * 0.09, c.currentTime, 0.3);
  }
  meow() { this.tone(620, 0.18, "triangle", 0.18, 0, 900); this.tone(900, 0.32, "triangle", 0.16, 0.16, 520); this.tone(1240, 0.3, "sine", 0.05, 0.16, 700); }
  bump() { this.noise(0.16, 0.3, "lowpass", 260); this.tone(110, 0.18, "sine", 0.22, 0, 50); }
  squish() { this.noise(0.12, 0.25, "bandpass", 900); this.tone(300, 0.1, "square", 0.08, 0, 120); }
  pop() { this.tone(660, 0.09, "sine", 0.2, 0, 990); this.tone(990, 0.1, "sine", 0.12, 0.06, 1320); }
  coin() { this.tone(1320, 0.08, "square", 0.06); this.tone(1760, 0.14, "square", 0.06, 0.07); }
  star(i: number) { this.tone(660 * Math.pow(1.26, i), 0.22, "triangle", 0.18); this.tone(1320 * Math.pow(1.26, i), 0.18, "sine", 0.06, 0.03); }
  chime() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.45, "triangle", 0.16, i * 0.09)); }
  fail() { this.tone(392, 0.25, "triangle", 0.15); this.tone(311, 0.4, "triangle", 0.15, 0.2); }
  click() { this.tone(880, 0.05, "sine", 0.08); }
  clank() { this.tone(1800, 0.25, "square", 0.04); this.tone(2400, 0.2, "sine", 0.05, 0.01); this.noise(0.05, 0.2, "highpass", 3000); }
  thunder() { this.noise(1.6, 0.36, "lowpass", 140); this.noise(0.9, 0.18, "lowpass", 300, 0.15); }
  stop() { if (this.eng) { this.eng.out.gain.cancelScheduledValues(this.now()); this.eng.out.gain.setTargetAtTime(0, this.now(), 0.05); } this.running = false; this.rainLevel(0); }
}
