// Little sounds for Blenders & Bacon, made with the Web Audio API (no audio files). Off until the player turns them on;
// the setting is kept in this browser.
const VOL = 0.5;
const KEY = "blendersbacon-sound";

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = true;
  constructor() { try { this.muted = localStorage.getItem(KEY) !== "on"; } catch {} }

  /** Must be called from a tap (browsers only start audio after a gesture). */
  unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {}); return; }
    if (this.muted) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = VOL; this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }
  setMuted(m: boolean) {
    this.muted = m; try { localStorage.setItem(KEY, m ? "off" : "on"); } catch {}
    if (!m) this.unlock();
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : VOL, this.ctx.currentTime, 0.05);
  }
  private tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slideTo?: number) {
    const c = this.ctx, m = this.master; if (!c || !m || this.muted) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(m); o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, vol: number, filter: BiquadFilterType, freq: number, at = 0, toFreq?: number) {
    const c = this.ctx, m = this.master; if (!c || !m || this.muted) return;
    const t = c.currentTime + at, len = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = filter; f.frequency.setValueAtTime(freq, t); if (toFreq) f.frequency.exponentialRampToValueAtTime(toFreq, t + dur); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(m); s.start(t);
  }
  /** The die rattling, then landing. */
  roll() { for (let k = 0; k < 6; k++) this.noise(0.035, 0.14, "bandpass", 2600 - k * 150, k * 0.09); this.tone(180, 0.08, "sine", 0.18, 0.62, 120); }
  hop(k: number) { this.tone(560 + (k % 6) * 40, 0.06, "sine", 0.1, 0, 760 + (k % 6) * 40); }
  whirl() { this.noise(0.9, 0.18, "bandpass", 300, 0, 2200); this.tone(110, 0.9, "sawtooth", 0.03, 0, 220); }
  whoosh() { this.noise(0.7, 0.2, "lowpass", 400, 0, 3000); this.tone(300, 0.7, "sine", 0.06, 0, 900); }
  pop() { this.tone(700, 0.09, "sine", 0.16, 0, 1200); }
  sizzle() { this.noise(0.6, 0.1, "highpass", 4200); this.noise(0.3, 0.06, "highpass", 6000, 0.25); }
  slide() { this.tone(620, 0.6, "triangle", 0.09, 0, 180); }
  card() { [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.16, "triangle", 0.1, i * 0.06)); }
  play() { this.tone(523, 0.12, "triangle", 0.12); this.tone(784, 0.2, "triangle", 0.12, 0.08); }
  mitt() { this.noise(0.12, 0.2, "lowpass", 600); this.tone(392, 0.25, "triangle", 0.12, 0.05, 523); }
  turn() { this.tone(660, 0.1, "sine", 0.1); this.tone(990, 0.14, "sine", 0.1, 0.09); }
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.42, "triangle", 0.12, i * 0.09)); }
  lose() { this.tone(392, 0.22, "triangle", 0.1); this.tone(330, 0.34, "triangle", 0.1, 0.18); }
  click() { this.tone(900, 0.04, "sine", 0.07); }
}
