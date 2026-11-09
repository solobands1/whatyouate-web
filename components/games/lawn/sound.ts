// Little sounds for Pat's Lawnmower, made with the Web Audio API (no audio files). Off until the player turns them on.

type Ctx = AudioContext;
const VOL = 0.6;   // the overall level: gentle

export class Sound {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private eng: { a: OscillatorNode; b: OscillatorNode; f: BiquadFilterNode; g: GainNode } | null = null;
  private rain: { src: AudioBufferSourceNode; g: GainNode } | null = null;
  muted = true;

  /** Must be called from a tap or click (browsers only start audio after a gesture). */
  unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : VOL; this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }
  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : VOL, this.ctx.currentTime, 0.05);
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
  /** The engine hum: follows the speed (0..1); off when not running. */
  engine(speed: number, on: boolean) {
    const c = this.ctx, m = this.master; if (!c || !m) return;
    if (!this.eng) {
      const a = c.createOscillator(), b = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      a.type = "sawtooth"; b.type = "square"; f.type = "lowpass"; f.frequency.value = 420; g.gain.value = 0;
      a.connect(f); b.connect(f); f.connect(g); g.connect(m); a.start(); b.start();
      this.eng = { a, b, f, g };
    }
    const t = c.currentTime, s = Math.max(0, Math.min(1, speed));
    this.eng.a.frequency.setTargetAtTime(46 + 34 * s, t, 0.08); this.eng.b.frequency.setTargetAtTime(92 + 60 * s, t, 0.08);
    this.eng.f.frequency.setTargetAtTime(380 + 500 * s, t, 0.1);
    this.eng.g.gain.setTargetAtTime(on && !this.muted ? 0.028 + 0.024 * s : 0, t, 0.12);
  }
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
  stop() { if (this.eng) this.eng.g.gain.setTargetAtTime(0, this.now(), 0.05); this.rainLevel(0); }
}
