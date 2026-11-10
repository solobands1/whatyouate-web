// Little sounds for Kitchen Golf, made with the Web Audio API (no audio files). Off until the player turns them on;
// the setting is kept in this browser.
const VOL = 0.55;
const KEY = "kitchengolf-sound";

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = true;
  constructor() { try { this.muted = localStorage.getItem(KEY) !== "on"; } catch {} }

  /** Must be called from a tap or click (browsers only start audio after a gesture). */
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
  /** The putter's tap, harder for a harder putt (power 0..1). */
  putt(power: number) { this.tone(520 + 260 * power, 0.07, "sine", 0.12 + 0.16 * power, 0, 300); this.noise(0.03, 0.12 + 0.2 * power, "highpass", 2400); }
  /** Bumping a wall or a bowl; `speed` is how hard. */
  bump(speed: number) { const v = Math.min(1, speed / 6); if (v < 0.08) return; this.tone(150 + 80 * v, 0.09, "sine", 0.05 + 0.18 * v, 0, 90); this.noise(0.05, 0.05 + 0.15 * v, "lowpass", 900); }
  /** Into the cup: a rattle, then a plop. */
  cup() { [0, 0.05, 0.1].forEach((a, i) => this.tone(1500 - i * 200, 0.04, "triangle", 0.07, a)); this.tone(240, 0.22, "sine", 0.2, 0.15, 120); }
  splash() { this.noise(0.5, 0.32, "bandpass", 1600, 0, 400); this.tone(180, 0.25, "sine", 0.08, 0.02, 90); }
  tube() { this.noise(0.45, 0.2, "lowpass", 300, 0, 1400); }
  sizzle() { this.noise(0.18, 0.06, "highpass", 4000); }
  cheer(big: boolean) { (big ? [523, 659, 784, 1046, 1318] : [659, 784, 988]).forEach((f, i) => this.tone(f, 0.38, "triangle", 0.13, i * 0.08)); }
  meh() { this.tone(392, 0.2, "triangle", 0.1); this.tone(330, 0.3, "triangle", 0.1, 0.16); }
  click() { this.tone(900, 0.04, "sine", 0.08); }
}
