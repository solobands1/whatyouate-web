// Sound for every game on whatyouate.app/games: short, soft sounds made with the Web Audio API (no audio files), in
// keeping with a calm health app: rounded sine and triangle tones, filtered noise, notes from one pentatonic scale so
// quick runs of sounds never clash.
//
// One setting for all the games, kept in this browser: "wya-games-sound" is "on" or "off", and on when it's unset, so
// muting in one game mutes them all. The kit's SoundButton toggles it.
// One AudioContext per page, made on the player's first tap (browsers only start audio after a gesture). Before it's
// made, the page asks for an "ambient" audio session (Safari 16.4+), so an iPhone on silent stays silent and the
// player's own music keeps playing.
// Quiet while a popup is open or the game is paused (hold), while the tab is hidden, and while the game-over card is up
// (the end sting plays first, then nothing new starts). Repeats are rate-limited per sound and overall.
//
// Games call sfx.play("pop", { n: 3 }) with one of the shared voices below, or sfx.voice(name, k => ...) with their own
// (Kitchen Golf and Blenders & Bacon keep their own sound designs that way).

const KEY = "wya-games-sound";
const OLD_KEYS = ["kitchengolf-sound", "blendersbacon-sound"];   // the two games that had sound first, off unless turned on
const VOL = 0.5;

/** The building blocks a voice is made of. Times are seconds from now; volumes are before the master volume. */
export type Synth = {
  /** One oscillator note with a quick fade in and a smooth fade out, optionally sliding to another pitch. */
  tone(freq: number, dur: number, type: OscillatorType, vol: number, at?: number, slideTo?: number): void;
  /** A burst of filtered noise that fades out over its length, optionally sweeping the filter. `fast` fades on a squared
   *  curve (quick at first, then a soft tail) instead of a straight line. */
  noise(dur: number, vol: number, filter: BiquadFilterType, freq: number, at?: number, toFreq?: number, q?: number, fast?: boolean): void;
  /** A soft mallet note (like a marimba): the note, a quiet octave and a little click of overtone. */
  mallet(freq: number, dur: number, vol: number, at?: number): void;
};

/** A note of the C major pentatonic scale: step 0 is C5, 5 is C6, -5 is C4. `base` moves the scale. */
export function note(step: number, base = 523.25) {
  const P = [0, 2, 4, 7, 9], s = Math.round(step), oct = Math.floor(s / 5);
  return base * 2 ** ((oct * 12 + P[((s % 5) + 5) % 5]) / 12);
}

type Opts = { n?: number; vol?: number; delay?: number };
type Voice = { gap: number; key?: boolean; make: (k: Synth, n: number, v: number) => void };

const pop = (k: Synth, f: number, v: number, at = 0) => { k.tone(f, 0.09, "sine", v, at, f * 1.5); k.tone(f * 2, 0.05, "sine", v * 0.18, at + 0.01, f * 3); };
const thud = (k: Synth, n: number, v: number) => { const p = Math.max(0, Math.min(1, n)); k.tone(150 + 40 * p, 0.13, "sine", (0.07 + 0.11 * p) * v, 0, 72); k.noise(0.07, (0.04 + 0.08 * p) * v, "lowpass", 800); };
const arp = (k: Synth, steps: number[], gap: number, dur: number, v: number, at = 0) => steps.forEach((s, i) => k.mallet(note(s), dur + (i === steps.length - 1 ? 0.18 : 0), v, at + i * gap));
const shimmer = (k: Synth, v: number, at = 0) => k.noise(0.3, 0.018 * v, "highpass", 5200, at, 8000);
const sparkle = (k: Synth, v: number) => { [8, 9, 10, 12].forEach((s, i) => k.tone(note(s), 0.12, "triangle", 0.045 * v, i * 0.035)); shimmer(k, v); };
const bite = (k: Synth, v: number, at = 0) => { k.noise(0.05, 0.09 * v, "bandpass", 1800, at, 1200, 1.4); k.noise(0.06, 0.08 * v, "bandpass", 1300, at + 0.07, 900, 1.4); k.tone(180, 0.08, "sine", 0.06 * v, at, 120); };

// `gap`: the least time (ms) between two of the same sound. `key`: always heard, even in a busy moment.
const VOICES = {
  // ── shared: taps, turns, starts and ends ──
  tap: { gap: 35, make: (k, _n, v) => k.tone(1100, 0.035, "sine", 0.05 * v, 0, 820) },
  start: { gap: 250, key: true, make: (k, _n, v) => { k.mallet(note(3), 0.16, 0.09 * v); k.mallet(note(5), 0.26, 0.09 * v, 0.08); } },
  turn: { gap: 250, key: true, make: (k, _n, v) => { k.tone(note(2), 0.1, "sine", 0.07 * v); k.tone(note(4), 0.16, "sine", 0.07 * v, 0.08); } },
  count: { gap: 300, key: true, make: (k, _n, v) => k.tone(note(4), 0.1, "sine", 0.075 * v) },
  go: { gap: 300, key: true, make: (k, _n, v) => { k.mallet(note(7), 0.24, 0.09 * v); k.tone(note(2), 0.18, "triangle", 0.04 * v); } },
  level: { gap: 400, key: true, make: (k, _n, v) => { arp(k, [3, 5, 7], 0.06, 0.16, 0.085 * v); shimmer(k, v, 0.1); } },
  roundWon: { gap: 400, key: true, make: (k, _n, v) => { arp(k, [2, 3, 5, 7], 0.07, 0.18, 0.085 * v); shimmer(k, v, 0.15); } },
  roundLost: { gap: 400, key: true, make: (k, _n, v) => { k.tone(note(2), 0.2, "triangle", 0.075 * v); k.tone(note(0), 0.34, "triangle", 0.07 * v, 0.16); } },
  win: { gap: 600, key: true, make: (k, _n, v) => { arp(k, [0, 2, 3, 5, 7], 0.075, 0.2, 0.08 * v); shimmer(k, v * 1.2, 0.25); } },
  over: { gap: 600, key: true, make: (k, _n, v) => {   // the end sting: a soft falling cadence that comes to rest
    k.tone(note(2), 0.22, "triangle", 0.08 * v); k.tone(note(1), 0.24, "triangle", 0.075 * v, 0.15);
    k.tone(note(0), 0.55, "triangle", 0.075 * v, 0.3); k.tone(note(-5), 0.6, "sine", 0.05 * v, 0.3);
  } },
  heartUp: { gap: 200, key: true, make: (k, _n, v) => { k.tone(note(4), 0.12, "sine", 0.08 * v); k.tone(note(7), 0.22, "sine", 0.08 * v, 0.09); } },
  hurt: { gap: 150, make: (k, _n, v) => { thud(k, 0.8, v); k.tone(440, 0.22, "triangle", 0.055 * v, 0.03, 250); } },
  bump: { gap: 80, make: (k, n, v) => thud(k, n || 0.7, v) },
  whoosh: { gap: 120, make: (k, n, v) => { const p = 0.6 + 0.4 * Math.max(0, Math.min(1, n || 1)); k.noise(0.24, 0.1 * p * v, "bandpass", 420, 0, 2300, 1.1); k.tone(260, 0.18, "sine", 0.03 * p * v, 0, 520); } },
  creak: { gap: 70, make: (k, n, v) => { const p = Math.max(0, Math.min(1, n)); k.tone(230 + 230 * p, 0.06, "triangle", 0.032 * v, 0, 250 + 250 * p); } },   // a rubbery stretch as you pull back
  thud: { gap: 60, make: (k, n, v) => thud(k, n, v) },
  splat: { gap: 70, make: (k, n, v) => { const p = 0.7 + 0.3 * Math.max(0, Math.min(1, n || 0.5)); k.noise(0.2, 0.12 * p * v, "bandpass", 1000, 0, 300, 0.8); k.tone(240, 0.12, "sine", 0.1 * p * v, 0, 110); k.noise(0.12, 0.05 * p * v, "lowpass", 420); } },
  sparkle: { gap: 150, make: (k, _n, v) => sparkle(k, v) },
  water: { gap: 90, make: (k, _n, v) => { k.tone(620, 0.07, "sine", 0.1 * v, 0, 1250); k.tone(900, 0.06, "sine", 0.05 * v, 0.07, 1500); } },

  // ── Snack Merge ──
  drop: { gap: 80, make: (k, _n, v) => { k.tone(480, 0.07, "sine", 0.075 * v, 0, 340); k.noise(0.03, 0.02 * v, "lowpass", 900); } },
  merge: { gap: 55, make: (k, n, v) => { const f = note(n - 1, 392); pop(k, f, 0.12 * v); k.mallet(f, 0.18, 0.05 * v, 0.02); } },   // higher for bigger food
  combo: { gap: 140, make: (k, n, v) => { const s = 5 + Math.min(6, n); k.mallet(note(s), 0.14, 0.06 * v, 0.05); k.mallet(note(s + 2), 0.2, 0.055 * v, 0.11); } },
  bowl: { gap: 300, key: true, make: (k, _n, v) => { arp(k, [5, 6, 7, 8, 10], 0.045, 0.16, 0.07 * v); shimmer(k, v * 1.3, 0.1); } },

  // ── Beat The Crash ──
  catch: { gap: 50, make: (k, n, v) => { const f = note(2 + Math.min(7, n)); pop(k, f * 0.5, 0.07 * v); k.mallet(f, 0.14, 0.07 * v, 0.01); } },   // rises with your streak
  full: { gap: 120, make: (k, _n, v) => { k.tone(300, 0.14, "sine", 0.07 * v, 0, 220); k.tone(240, 0.16, "sine", 0.05 * v, 0.08, 180); } },
  sugar: { gap: 150, make: (k, _n, v) => sparkle(k, v) },
  crash: { gap: 200, make: (k, _n, v) => { k.tone(560, 0.42, "triangle", 0.08 * v, 0, 190); k.tone(140, 0.26, "sine", 0.11 * v, 0.05, 70); k.noise(0.16, 0.05 * v, "lowpass", 500, 0.05); } },
  slump: { gap: 400, key: true, make: (k, _n, v) => { k.tone(587, 0.3, "triangle", 0.075 * v); k.tone(440, 0.5, "triangle", 0.075 * v, 0.24, 400); } },

  // ── Cart Rush ──
  lane: { gap: 40, make: (k, n, v) => k.tone(760 + 110 * n, 0.03, "sine", 0.045 * v, 0, 640 + 110 * n) },   // a little higher to the right
  grab: { gap: 50, make: (k, n, v) => k.mallet(note(3 + Math.min(5, n)), 0.15, 0.09 * v) },                // rises as the recipe fills
  extra: { gap: 60, make: (k, _n, v) => k.tone(330, 0.09, "triangle", 0.06 * v, 0, 270) },
  recipe: { gap: 300, key: true, make: (k, _n, v) => { arp(k, [0, 2, 3, 5], 0.075, 0.18, 0.09 * v); shimmer(k, v, 0.2); } },
  spill: { gap: 120, make: (k, _n, v) => { k.noise(0.24, 0.09 * v, "bandpass", 1400, 0, 500, 0.9); k.tone(210, 0.16, "sine", 0.08 * v, 0, 110); } },

  // ── Berry Dash ──
  jump: { gap: 80, make: (k, _n, v) => k.tone(330, 0.13, "triangle", 0.05 * v, 0, 640) },
  duck: { gap: 80, make: (k, _n, v) => k.noise(0.12, 0.05 * v, "lowpass", 1400, 0, 400) },
  berry: { gap: 45, make: (k, n, v) => k.mallet(note(3 + (n % 8)), 0.12, 0.08 * v) },                     // climbs through a row of berries
  heavy: { gap: 300, make: (k, _n, v) => k.tone(260, 0.45, "triangle", 0.07 * v, 0, 150) },

  // ── Food Fling ──
  knock: { gap: 50, make: (k, n, v) => { const f = note(Math.min(9, Math.max(0, n - 1)), 392); k.tone(f, 0.08, "sine", 0.1 * v); k.tone(f * 2.7, 0.04, "sine", 0.03 * v); k.noise(0.03, 0.05 * v, "bandpass", 1800); } },

  // ── Fridge Raid ──
  shine: { gap: 200, make: (k, _n, v) => { [7, 8, 9].forEach((s, i) => k.tone(note(s), 0.4, "sine", 0.045 * v, i * 0.07)); k.noise(0.4, 0.02 * v, "highpass", 4000, 0, 9000); } },
  blast: { gap: 200, make: (k, n, v) => {   // an icy whoosh, a low thump, and a crunch if it bit anything
    k.noise(0.36, 0.1 * v, "bandpass", 3000, 0, 600, 1); k.tone(160, 0.22, "sine", 0.09 * v, 0.05, 70);
    if (n > 0) bite(k, v * 0.9, 0.12);
  } },
  ice: { gap: 80, make: (k, _n, v) => { k.tone(2200, 0.05, "sine", 0.035 * v); k.tone(2930, 0.07, "sine", 0.03 * v, 0.03); k.noise(0.03, 0.02 * v, "highpass", 5000); } },   // nothing there: a clink of ice
  bite: { gap: 80, make: (k, _n, v) => bite(k, v) },
  found: { gap: 250, key: true, make: (k, _n, v) => { bite(k, v); arp(k, [3, 5, 7], 0.065, 0.16, 0.08 * v, 0.12); } },

  // ── Pea Tanks ──
  fire: { gap: 55, make: (k, _n, v) => { k.tone(720, 0.05, "sine", 0.06 * v, 0, 360); k.noise(0.03, 0.03 * v, "lowpass", 1500); } },
  ricochet: { gap: 45, make: (k, _n, v) => k.tone(2000, 0.03, "sine", 0.03 * v, 0, 1600) },
  plip: { gap: 70, make: (k, _n, v) => k.tone(520, 0.04, "sine", 0.03 * v, 0, 380) },
  hit: { gap: 60, make: (k, _n, v) => { thud(k, 0.6, v); k.noise(0.1, 0.05 * v, "bandpass", 900, 0, 400, 0.9); } },
  ko: { gap: 120, make: (k, _n, v) => { k.noise(0.3, 0.1 * v, "lowpass", 900, 0, 200); k.tone(190, 0.36, "sine", 0.12 * v, 0, 60); k.tone(note(2), 0.24, "triangle", 0.04 * v, 0.06, note(-3)); } },
  mine: { gap: 120, make: (k, _n, v) => { k.tone(300, 0.16, "sine", 0.07 * v, 0, 200); k.tone(310, 0.16, "sine", 0.04 * v, 0.03, 205); } },   // a wobbly jelly plop
  boom: { gap: 90, make: (k, _n, v) => { k.noise(0.36, 0.13 * v, "lowpass", 800, 0, 180); k.tone(220, 0.34, "sine", 0.13 * v, 0, 64); } },
  power: { gap: 200, key: true, make: (k, _n, v) => { arp(k, [5, 7, 9], 0.05, 0.12, 0.07 * v); shimmer(k, v); } },
  crumble: { gap: 90, make: (k, _n, v) => { for (let i = 0; i < 4; i++) k.noise(0.04, 0.05 * v, "bandpass", 1600 - i * 200, i * 0.035, undefined, 1.2); } },
  block: { gap: 90, make: (k, _n, v) => k.mallet(note(8), 0.14, 0.06 * v) },
  basket: { gap: 120, make: (k, _n, v) => { thud(k, 0.9, v); k.tone(note(-3), 0.22, "triangle", 0.05 * v, 0.04); } },
} satisfies Record<string, Voice>;
export type SfxName = keyof typeof VOICES;

type Stats = { contexts: number; asked: Record<string, number>; played: Record<string, number>; dropped: number };

class Sfx implements Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;    // the overall volume (0 while muted)
  private bus: GainNode | null = null;       // every game sound goes through here (0 while held)
  private noiseBuf: AudioBuffer | null = null;
  private holds = new Map<string, boolean>(); // key -> fades out what's playing (popups, pause) or just stops new sounds (game over)
  private last = new Map<string, number>();
  private recent: number[] = [];
  private wokeAt = 0;
  private subs = new Set<() => void>();
  private ready = false;
  private onState = true;
  /** For the browser checks in development: how many contexts and sounds this page made. */
  stats: Stats = { contexts: 0, asked: {}, played: {}, dropped: 0 };

  /** Is sound on? (The shared setting; on unless the player turned it off.) */
  get on() { this.init(); return this.onState; }

  private init() {
    if (this.ready || typeof window === "undefined") return;
    this.ready = true;
    this.onState = readSetting();
    const wake = () => this.unlock();
    for (const ev of ["pointerdown", "pointerup", "touchend", "keydown", "click"]) document.addEventListener(ev, wake, { capture: true, passive: true });
    document.addEventListener("visibilitychange", () => this.syncRunning());
    window.addEventListener("pagehide", () => this.syncRunning());
    window.addEventListener("pageshow", () => this.syncRunning());
    window.addEventListener("storage", e => { if (e.key === KEY) { this.onState = readSetting(); this.applyOn(); } });   // another tab
    if (process.env.NODE_ENV !== "production") (window as unknown as { __wyaSfx?: Sfx }).__wyaSfx = this;
  }

  subscribe = (f: () => void) => { this.init(); this.subs.add(f); return () => { this.subs.delete(f); }; };
  getOn = () => this.on;

  /** Turns sound on or off for every game. Call it from the tap on the speaker button, so the audio can start. */
  setOn(on: boolean) {
    this.init();
    this.onState = on;
    try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {}
    this.applyOn();
    this.subs.forEach(f => f());
    if (on) this.ui();
  }

  /** Starts (or wakes) the audio. Called on every tap, key and click on the page, since browsers need a gesture. */
  unlock() {
    this.init();
    if (!this.onState || document.hidden) return;
    if (!this.ctx) {
      try {
        const nav = navigator as Navigator & { audioSession?: { type: string } };
        if (nav.audioSession && nav.audioSession.type !== "ambient") nav.audioSession.type = "ambient";   // follow the ring/silent switch
      } catch {}
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        const c = new AC();
        this.stats.contexts++;
        const comp = c.createDynamicsCompressor();   // keeps a pile-up of sounds from getting harsh
        comp.threshold.value = -10; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
        this.master = c.createGain(); this.master.gain.value = VOL;
        this.bus = c.createGain(); this.bus.gain.value = this.held(true) ? 0 : 1;
        this.bus.connect(this.master); this.master.connect(comp); comp.connect(c.destination);
        const len = c.sampleRate, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
        // a silent blip inside the gesture, which older iPhones need before they'll play anything
        const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0);
        this.ctx = c;
      } catch { this.ctx = null; return; }
    }
    if (this.ctx.state !== "running") { this.wokeAt = performance.now(); this.ctx.resume().catch(() => {}); }
  }

  /** Quiet while `on` (popups, pause). `fade` false only stops new sounds, so an end sting can ring out (game over). */
  hold(key: string, on: boolean, fade = true) {
    if (on) this.holds.set(key, fade); else this.holds.delete(key);
    if (this.ctx && this.bus) this.bus.gain.setTargetAtTime(this.held(true) ? 0 : 1, this.ctx.currentTime, 0.03);
  }
  private held(fadingOnly = false) { if (!fadingOnly) return this.holds.size > 0; for (const f of this.holds.values()) if (f) return true; return false; }

  /** A shared sound. `n` is the sound's own number (food size, streak, combo, power 0..1); `vol` scales it; `delay`
   *  (seconds) starts it a little later, to follow another sound. */
  play(name: SfxName, o: Opts = {}) {
    const v: Voice = VOICES[name], d = o.delay ?? 0;
    this.voice(name, k => v.make(d ? later(k, d) : k, o.n ?? 0, o.vol ?? 1), v.gap, v.key);
  }

  /** A game's own sound, built from tone, noise and mallet. `gap` rate-limits it (ms); `key` lets it through a busy moment. */
  voice(name: string, make: (k: Synth) => void, gap = 0, key = false) {
    this.init();
    this.stats.asked[name] = (this.stats.asked[name] ?? 0) + 1;
    if (!this.live() || this.held()) return;
    const now = performance.now();
    if (gap && now - (this.last.get(name) ?? -1e9) < gap) { this.stats.dropped++; return; }
    while (this.recent.length && now - this.recent[0] > 160) this.recent.shift();
    if (!key && this.recent.length >= 8) { this.stats.dropped++; return; }   // no more than 8 sounds starting in any 160ms
    this.last.set(name, now); this.recent.push(now);
    this.stats.played[name] = (this.stats.played[name] ?? 0) + 1;
    make(this);
  }

  /** The speaker button's little confirmation tick: past the game-over hold, straight to the master volume. */
  private ui() {
    if (!this.live() || !this.master) return;
    this.stats.played.ui = (this.stats.played.ui ?? 0) + 1;
    this.osc(900, 0.05, "sine", 0.08, 0.04, undefined, this.master);
    this.osc(1350, 0.07, "sine", 0.06, 0.09, undefined, this.master);
  }

  private live() {
    const c = this.ctx;
    if (!c || !this.onState || document.hidden) return false;
    if (c.state === "running") return true;
    return c.state === "suspended" && performance.now() - this.wokeAt < 400;   // waking up from this very tap: let the sound queue
  }
  private applyOn() {
    if (!this.onState) {
      if (this.ctx && this.master) { this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03); const c = this.ctx; setTimeout(() => { if (!this.onState && c.state === "running") c.suspend().catch(() => {}); }, 250); }
      return;
    }
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(VOL, this.ctx.currentTime, 0.02);
    this.unlock();
  }
  private syncRunning() {
    const c = this.ctx; if (!c) return;
    if (document.hidden) { if (c.state === "running") c.suspend().catch(() => {}); }
    else if (this.onState && c.state !== "running") { this.wokeAt = performance.now(); c.resume().catch(() => {}); }   // may need the next tap on iPhone
  }

  // ── the synth ──
  private osc(freq: number, dur: number, type: OscillatorType, vol: number, at: number, slideTo: number | undefined, out: AudioNode) {
    const c = this.ctx!, t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slideTo?: number) {
    if (this.ctx && this.bus) this.osc(freq, dur, type, vol, at, slideTo, this.bus);
  }
  noise(dur: number, vol: number, filter: BiquadFilterType, freq: number, at = 0, toFreq?: number, q?: number, fast = false) {
    const c = this.ctx, b = this.bus, buf = this.noiseBuf; if (!c || !b || !buf) return;
    const t = c.currentTime + at, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; if (dur > 0.9) s.loop = true;
    f.type = filter; f.frequency.setValueAtTime(freq, t); if (toFreq) f.frequency.exponentialRampToValueAtTime(toFreq, t + dur); if (q) f.Q.value = q;
    if (fast) g.gain.setValueCurveAtTime(Float32Array.from({ length: 32 }, (_, i) => vol * (1 - i / 31) ** 2), t, dur);
    else { g.gain.setValueAtTime(vol, t); g.gain.linearRampToValueAtTime(0, t + dur); }   // fades out across its length
    s.connect(f); f.connect(g); g.connect(b);
    s.start(t, dur > 0.9 ? 0 : Math.random() * (1 - dur)); s.stop(t + dur + 0.02);
  }
  mallet(freq: number, dur: number, vol: number, at = 0) {
    this.tone(freq, dur, "sine", vol, at);
    this.tone(freq * 2, dur * 0.6, "sine", vol * 0.22, at);
    this.tone(freq * 4.02, dur * 0.2, "sine", vol * 0.07, at);
  }
}

/** The same synth, every sound pushed back by `d` seconds. */
function later(k: Synth, d: number): Synth {
  return {
    tone: (f, dur, type, vol, at = 0, slide) => k.tone(f, dur, type, vol, at + d, slide),
    noise: (dur, vol, filter, f, at = 0, to, q, fast) => k.noise(dur, vol, filter, f, at + d, to, q, fast),
    mallet: (f, dur, vol, at = 0) => k.mallet(f, dur, vol, at + d),
  };
}

/** The shared setting. Unset means on; a player who had turned sound on in Kitchen Golf or Blenders & Bacon keeps it on. */
function readSetting() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "on" || v === "off") return v === "on";
    if (OLD_KEYS.some(k => localStorage.getItem(k) === "on")) { localStorage.setItem(KEY, "on"); return true; }
  } catch {}
  return true;
}

export const sfx = new Sfx();
