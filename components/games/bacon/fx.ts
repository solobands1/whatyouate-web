// The little particles over the board, on one canvas: fruit bits that swirl out of a blender and trail up its tube,
// gold sparkles when you land somewhere good, sizzle drops on the bacon, and confetti for a win. Board units in,
// so the game never thinks about pixels; the loop only runs while something is moving.
type P = { kind: "bit" | "spark" | "drop" | "confetti"; x: number; y: number; vx: number; vy: number; g: number; life: number; max: number;
  r: number; rot: number; vr: number; col: string; drag: number };

const FRUIT = ["#ff5d7a", "#ffb02e", "#8bd450", "#7c5ce0", "#ff7a3d", "#ffe14d"];
const CONFETTI = ["#3f7fd6", "#e8505b", "#ffcf3f", "#22a964", "#a07cff", "#ff8a5c"];

export class Particles {
  private ps: P[] = [];
  private raf = 0;
  private last = 0;
  private ctx: CanvasRenderingContext2D | null = null;
  private scale = 1;
  private w = 0;
  private h = 0;

  attach(canvas: HTMLCanvasElement | null, w: number, h: number, scale: number) {
    if (!canvas) { this.ctx = null; return; }
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * scale * dpr); canvas.height = Math.round(h * scale * dpr);
    this.ctx = canvas.getContext("2d"); this.scale = scale * dpr; this.w = w; this.h = h;
  }
  clear() { this.ps = []; if (this.ctx) this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height); }

  private add(p: Partial<P> & Pick<P, "kind" | "x" | "y">) {
    this.ps.push({ vx: 0, vy: 0, g: 0, life: 0, max: 0.8, r: 4, rot: Math.random() * 6.28, vr: 0, col: "#fff", drag: 0.98, ...p });
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.tick); }
  }
  /** Fruit bits bursting out (a blender whirling). */
  bits(x: number, y: number, n = 10, up = 1) {
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2 * up, s = 90 + Math.random() * 140;
      this.add({ kind: "bit", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 420, max: 0.6 + Math.random() * 0.4, r: 3 + Math.random() * 3, vr: (Math.random() - 0.5) * 14, col: FRUIT[k % FRUIT.length] });
    }
  }
  /** A fruit bit or two left behind along the tube. */
  trail(x: number, y: number) {
    this.add({ kind: "bit", x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 50, g: 60,
      max: 0.45 + Math.random() * 0.3, r: 2 + Math.random() * 2.5, vr: (Math.random() - 0.5) * 10, col: FRUIT[Math.floor(Math.random() * FRUIT.length)] });
  }
  /** Gold sparkles in a ring. */
  sparks(x: number, y: number, n = 10, col = "#ffd34d") {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.4, s = 60 + Math.random() * 70;
      this.add({ kind: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0, max: 0.5 + Math.random() * 0.25, r: 4 + Math.random() * 3, drag: 0.9, col });
    }
  }
  /** Hot fat spitting off the bacon. */
  drops(x: number, y: number, n = 6) {
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, s = 50 + Math.random() * 90;
      this.add({ kind: "drop", x: x + (Math.random() - 0.5) * 24, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 380, max: 0.35 + Math.random() * 0.3, r: 1.6 + Math.random() * 1.8, col: Math.random() < 0.5 ? "#fff6dc" : "#ffd28a" });
    }
  }
  /** A win: confetti from the top of the board. */
  confetti(n = 70) {
    for (let k = 0; k < n; k++) {
      this.add({ kind: "confetti", x: Math.random() * this.w, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 160, g: 60,
        max: 2.6 + Math.random() * 1.4, r: 5 + Math.random() * 4, vr: (Math.random() - 0.5) * 10, drag: 0.995, col: CONFETTI[k % CONFETTI.length] });
    }
  }

  private tick = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const c = this.ctx;
    this.ps = this.ps.filter(p => (p.life += dt) < p.max);
    for (const p of this.ps) { p.vy += p.g * dt; p.vx *= p.drag; p.vy *= p.drag; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
    if (c) {
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, c.canvas.width, c.canvas.height); c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      for (const p of this.ps) {
        const k = p.life / p.max, a = p.kind === "confetti" ? Math.min(1, (1 - k) * 4) : 1 - k * k;
        c.globalAlpha = Math.max(0, a); c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        if (p.kind === "bit") {
          c.fillStyle = p.col; c.beginPath(); c.roundRect(-p.r, -p.r * 0.8, p.r * 2, p.r * 1.6, p.r * 0.5); c.fill();
          c.fillStyle = "rgba(255,255,255,0.55)"; c.beginPath(); c.arc(-p.r * 0.35, -p.r * 0.3, p.r * 0.35, 0, 6.28); c.fill();
        } else if (p.kind === "spark") {
          const r = p.r * (1 - k * 0.5); c.fillStyle = p.col; c.beginPath();
          for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.32 : r, an = (i / 8) * Math.PI * 2; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
          c.closePath(); c.fill();
        } else if (p.kind === "drop") {
          c.fillStyle = p.col; c.beginPath(); c.arc(0, 0, p.r, 0, 6.28); c.fill();
        } else {
          c.fillStyle = p.col; c.scale(1, Math.cos(p.rot * 1.7)); c.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9);
        }
        c.restore();
      }
      c.globalAlpha = 1;
    }
    this.raf = this.ps.length ? requestAnimationFrame(this.tick) : 0;
    if (!this.ps.length && c) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, c.canvas.width, c.canvas.height); }
  };
  stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; this.ps = []; }
}
