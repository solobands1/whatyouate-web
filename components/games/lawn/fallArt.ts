// The drawings for Pat's Fall Chores, in the same soft top-down style as ./art: fallen sticks and leaves, Pat on foot,
// the little cart behind the tractor, Linda riding in it, the lap flags, Pat's blue '67, a new tire and the hardware
// store in Springfield. World units are metres; each drawing's own frame has +x forward. Light from the top left.
import { mulberry32 } from "./geo";

export const LEAF_COLS = ["#e0782a", "#c9432b", "#e8b53a", "#a85a2a", "#d9902f", "#b8402c", "#f0c24a"];
const SKIN = "#efc6a2";

/** One fallen leaf: a pointed oval with a midrib. */
export function drawLeaf(c: CanvasRenderingContext2D, x: number, y: number, a: number, s: number, col: string) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.fillStyle = col; c.beginPath(); c.moveTo(s, 0); c.quadraticCurveTo(0, s * 0.62, -s, 0); c.quadraticCurveTo(0, -s * 0.62, s, 0); c.fill();
  c.strokeStyle = "rgba(80,40,20,0.35)"; c.lineWidth = s * 0.12; c.beginPath(); c.moveTo(s * 0.9, 0); c.lineTo(-s * 1.25, 0); c.stroke();
  c.restore();
}
/** A scatter of leaves round a point (`n` of them within `r` metres). */
export function scatterLeaves(c: CanvasRenderingContext2D, rnd: () => number, x: number, y: number, r: number, n: number, size = 0.15) {
  for (let k = 0; k < n; k++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r; drawLeaf(c, x + Math.cos(a) * d, y + Math.sin(a) * d, rnd() * 7, size * (0.75 + rnd() * 0.6), LEAF_COLS[Math.floor(rnd() * LEAF_COLS.length)]); }
}

export type Stick = { x: number; y: number; a: number; len: number; seed: number };
/** A fallen branch: a crooked brown stick with a fork or two and a couple of dry leaves. `lift` raises it off the grass. */
export function drawStick(c: CanvasRenderingContext2D, s: Stick, lift = 0, halo = true) {
  const r = mulberry32(s.seed), L = s.len;
  c.save(); c.translate(s.x, s.y);
  if (halo) { const g = c.createRadialGradient(0, 0, 0, 0, 0, L * 0.75); g.addColorStop(0, "rgba(255,250,225,0.32)"); g.addColorStop(1, "rgba(255,250,225,0)"); c.fillStyle = g; c.beginPath(); c.arc(0, 0, L * 0.75, 0, 7); c.fill(); }
  c.rotate(s.a);
  const pts: [number, number][] = []; for (let k = 0; k <= 4; k++) pts.push([-L / 2 + (L * k) / 4, (r() - 0.5) * 0.12]);
  const forks: [number, number, number, number][] = [[pts[1][0], pts[1][1], pts[1][0] + 0.28, -0.24], [pts[3][0], pts[3][1], pts[3][0] + 0.22, 0.2 + r() * 0.06]];
  const path = (ox: number, oy: number) => { c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px + ox, py + oy) : c.moveTo(px + ox, py + oy))); for (const [ax, ay, bx, by] of forks) { c.moveTo(ax + ox, ay + oy); c.lineTo(bx + ox, by + oy); } };
  c.lineCap = "round"; c.lineJoin = "round";
  path(0.07 + lift * 0.5, 0.09 + lift * 0.6); c.strokeStyle = "rgba(20,40,10,0.28)"; c.lineWidth = 0.1; c.stroke();
  if (lift) c.translate(-lift * 0.1, -lift * 0.25);
  path(0, 0); c.strokeStyle = "#4a3222"; c.lineWidth = 0.1; c.stroke();
  path(0, -0.012); c.strokeStyle = "#7a563a"; c.lineWidth = 0.06; c.stroke();
  drawLeaf(c, forks[0][2], forks[0][3], -0.6, 0.1, "#c9632b"); drawLeaf(c, forks[1][2] + 0.04, forks[1][3], 0.8, 0.09, "#d9a33a");
  c.restore();
}

/** Pat's head from above (brown hair going salt and pepper, clean shaven), the same as on the tractor. */
function patHead(c: CanvasRenderingContext2D, hk: number) {
  c.save(); c.scale(hk, hk);
  c.fillStyle = "rgba(40,20,10,0.18)"; c.beginPath(); c.arc(0.02, 0.02, 0.125, 0, 7); c.fill();
  c.fillStyle = SKIN; c.beginPath(); c.arc(0.01, 0, 0.12, 0, 7); c.fill();
  c.beginPath(); c.ellipse(0, -0.12, 0.03, 0.024, 0, 0, 7); c.ellipse(0, 0.12, 0.03, 0.024, 0, 0, 7); c.fill();
  c.fillStyle = "#e3ad86"; c.beginPath(); c.ellipse(0.125, 0, 0.022, 0.026, 0, 0, 7); c.fill();
  c.fillStyle = "#6b4a32"; c.beginPath(); c.ellipse(-0.02, 0, 0.112, 0.116, 0, 0, 7); c.fill();
  c.fillStyle = "#7d5a3f"; c.beginPath(); c.ellipse(-0.035, -0.035, 0.06, 0.05, 0.4, 0, 7); c.fill();
  c.fillStyle = "#b5aca2"; for (const [gx, gy] of [[-0.06, -0.06], [-0.03, 0.06], [-0.09, 0.01], [0.02, -0.08], [0.04, 0.07], [-0.1, -0.04], [-0.07, 0.08], [0.0, 0.0], [-0.04, -0.09]]) { c.beginPath(); c.arc(gx, gy, 0.019, 0, 7); c.fill(); }
  c.fillStyle = "#8f877e"; for (const [gx, gy] of [[0.06, -0.09], [0.06, 0.09]]) { c.beginPath(); c.ellipse(gx, gy, 0.03, 0.018, 0, 0, 7); c.fill(); }
  c.strokeStyle = "rgba(60,35,20,0.45)"; c.lineWidth = 0.014; c.beginPath(); c.arc(0.01, 0, 0.12, 0, 7); c.stroke();
  c.restore();
}

export type PatPose = { walk: number; carry?: "stick" | "tire" | null; bend?: number; wave?: number; seed?: number };
/** Pat on foot, from above: work boots stepping, jeans, his blue shirt, arms swinging (or carrying something), his head.
 *  `walk` is the step phase (0 standing); `bend` (0..1) reaches down to the grass. */
export function drawPat(c: CanvasRenderingContext2D, x: number, y: number, a: number, p: PatPose, t: number, size = 1.3) {
  c.save(); c.translate(x, y);
  c.fillStyle = "rgba(20,40,10,0.22)"; c.beginPath(); c.ellipse(0.12, 0.14, 0.32 * size, 0.24 * size, a, 0, 7); c.fill();
  c.rotate(a); c.scale(size, size);
  const st = p.walk ? Math.sin(p.walk) : 0, bend = p.bend ?? 0;
  // legs and boots, one ahead of the other as he walks
  for (const s of [-1, 1]) { const f = st * s * 0.16; c.fillStyle = "#3d5378"; c.beginPath(); c.roundRect(-0.1 + f, s * 0.11 - 0.055, 0.2, 0.11, 0.05); c.fill(); c.fillStyle = "#3a2f28"; c.beginPath(); c.roundRect(0.08 + f, s * 0.11 - 0.05, 0.1, 0.1, 0.03); c.fill(); }
  const lean = bend * 0.18;
  c.translate(lean, 0);
  // arms: swinging, reaching down, or both out front holding what he carries
  c.strokeStyle = SKIN; c.lineWidth = 0.075; c.lineCap = "round";
  const reach = p.carry ? 0.34 : bend ? 0.22 + bend * 0.2 : 0;
  for (const s of [-1, 1]) {
    const hx = reach ? 0.12 + reach : -st * s * 0.16 + 0.04, hy = reach ? s * 0.14 : s * 0.27;
    c.strokeStyle = "#4e7aa6"; c.lineWidth = 0.1; c.beginPath(); c.moveTo(-0.02, s * 0.22); c.lineTo((hx - 0.02) * 0.4, s * 0.22 + (hy - s * 0.22) * 0.4); c.stroke();
    c.strokeStyle = SKIN; c.lineWidth = 0.07; c.beginPath(); c.moveTo((hx - 0.02) * 0.35, s * 0.22 + (hy - s * 0.22) * 0.35); c.lineTo(hx, hy); c.stroke();
  }
  if (p.wave) { const wv = Math.sin(t * 11) * 0.09; c.strokeStyle = SKIN; c.lineWidth = 0.07; c.beginPath(); c.moveTo(0, -0.22); c.lineTo(0.1 + wv, -0.62); c.stroke(); c.fillStyle = SKIN; c.beginPath(); c.arc(0.1 + wv, -0.64, 0.055, 0, 7); c.fill(); }
  if (p.carry === "stick") drawStick(c, { x: 0.46, y: 0, a: Math.PI / 2 + 0.25, len: 0.9, seed: p.seed ?? 3 }, 0, false);
  if (p.carry === "tire") drawTire(c, 0.62, 0, Math.PI / 2, t);
  // shirt and shoulders
  c.fillStyle = "#4e7aa6"; c.beginPath(); c.ellipse(-0.04, 0, 0.15, 0.26, 0, 0, 7); c.fill();
  c.fillStyle = "rgba(255,255,255,0.15)"; c.beginPath(); c.ellipse(-0.08, -0.07, 0.07, 0.12, 0, 0, 7); c.fill();
  c.strokeStyle = "rgba(30,50,80,0.45)"; c.lineWidth = 0.02; c.beginPath(); c.ellipse(-0.04, 0, 0.15, 0.26, 0, 0, 7); c.stroke();
  c.translate(0.02 + bend * 0.12, 0); patHead(c, 1.15);
  c.restore();
}

/** Linda from above, sitting facing forward: blond hair to her shoulders, a light purple shirt, jeans. `wave` lifts a hand. */
export function drawLinda(c: CanvasRenderingContext2D, x: number, y: number, a: number, t: number, wave = 0, size = 1.15) {
  const skin = "#f4d2b8", hair = "#e6c77a", hairLite = "#f5e2a6", shirt = "#c7a6e6", shirtDark = "#a885cc";
  c.save(); c.translate(x, y); c.rotate(a); c.scale(size, size);
  // legs out in front (sitting)
  c.fillStyle = "#5b75a8"; c.beginPath(); c.roundRect(-0.02, -0.16, 0.36, 0.12, 0.05); c.roundRect(-0.02, 0.04, 0.36, 0.12, 0.05); c.fill();
  c.fillStyle = "#f2f2ee"; c.beginPath(); c.roundRect(0.31, -0.16, 0.08, 0.11, 0.03); c.roundRect(0.31, 0.05, 0.08, 0.11, 0.03); c.fill();   // white sneakers
  // arms: resting on her knees, or one up waving
  c.lineCap = "round";
  for (const s of [-1, 1]) {
    if (wave > 0 && s < 0) { const wv = Math.sin(t * 10) * 0.08 * wave; c.strokeStyle = shirt; c.lineWidth = 0.09; c.beginPath(); c.moveTo(-0.04, -0.2); c.lineTo(0.0, -0.32); c.stroke(); c.strokeStyle = skin; c.lineWidth = 0.065; c.beginPath(); c.moveTo(0.0, -0.31); c.lineTo(0.08 + wv, -0.5 - 0.06 * wave); c.stroke(); c.fillStyle = skin; c.beginPath(); c.arc(0.08 + wv, -0.53 - 0.06 * wave, 0.05, 0, 7); c.fill(); continue; }
    c.strokeStyle = shirt; c.lineWidth = 0.09; c.beginPath(); c.moveTo(-0.04, s * 0.2); c.lineTo(0.04, s * 0.22); c.stroke();
    c.strokeStyle = skin; c.lineWidth = 0.065; c.beginPath(); c.moveTo(0.04, s * 0.21); c.lineTo(0.2, s * 0.12); c.stroke();
  }
  // shirt
  c.fillStyle = shirt; c.beginPath(); c.ellipse(-0.05, 0, 0.13, 0.22, 0, 0, 7); c.fill();
  c.fillStyle = shirtDark; c.beginPath(); c.ellipse(-0.1, 0.03, 0.06, 0.16, 0, 0, 7); c.fill();
  c.fillStyle = "rgba(255,255,255,0.22)"; c.beginPath(); c.ellipse(-0.06, -0.08, 0.06, 0.09, 0, 0, 7); c.fill();
  // hair falling to her shoulders behind, then the head, face just showing at the front
  c.fillStyle = hair; c.beginPath(); c.ellipse(-0.1, 0, 0.13, 0.15, 0, 0, 7); c.fill();
  c.fillStyle = skin; c.beginPath(); c.arc(0.01, 0, 0.105, 0, 7); c.fill();
  c.fillStyle = "#e9b394"; c.beginPath(); c.ellipse(0.108, 0, 0.02, 0.024, 0, 0, 7); c.fill();
  c.fillStyle = hair; c.beginPath(); c.ellipse(-0.025, 0, 0.1, 0.112, 0, 0, 7); c.fill();
  c.fillStyle = hairLite; c.beginPath(); c.ellipse(-0.035, -0.035, 0.055, 0.045, 0.4, 0, 7); c.fill();
  c.strokeStyle = "rgba(160,120,50,0.5)"; c.lineWidth = 0.012; for (const k of [-0.05, 0, 0.05]) { c.beginPath(); c.moveTo(0.06, k * 0.6); c.quadraticCurveTo(-0.05, k * 1.6, -0.2, k * 2); c.stroke(); }
  c.restore();
}

/** The little steel cart: body centred on its axle, the tongue out front to the hitch (`tongue` metres ahead). */
export function drawCart(c: CanvasRenderingContext2D, x: number, y: number, a: number, tongue: number, inside: { sticks?: number; linda?: { t: number; wave: number } }) {
  c.save();
  c.fillStyle = "rgba(20,40,10,0.22)"; c.beginPath(); c.ellipse(x + 0.25, y + 0.3, 0.95, 0.7, a, 0, 7); c.fill();
  c.translate(x, y); c.rotate(a);
  c.strokeStyle = "#3b3f44"; c.lineWidth = 0.08; c.lineCap = "round"; c.beginPath(); c.moveTo(0.72, -0.4); c.lineTo(tongue, 0); c.lineTo(0.72, 0.4); c.stroke();
  c.fillStyle = "#2a2d31"; c.beginPath(); c.arc(tongue, 0, 0.07, 0, 7); c.fill();
  for (const s of [-1, 1]) { c.fillStyle = "#151515"; c.beginPath(); c.roundRect(-0.27, s * 0.62 - 0.1, 0.54, 0.2, 0.06); c.fill(); c.fillStyle = "#8d9399"; c.fillRect(-0.08, s * 0.62 - 0.05, 0.16, 0.1); }
  c.fillStyle = "#5d646b"; c.beginPath(); c.roundRect(-0.78, -0.56, 1.56, 1.12, 0.12); c.fill();
  c.fillStyle = "#8a929a"; c.beginPath(); c.roundRect(-0.7, -0.48, 1.4, 0.96, 0.08); c.fill();
  c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(-0.68, -0.46, 1.36, 0.16);
  c.strokeStyle = "rgba(40,45,50,0.35)"; c.lineWidth = 0.025; for (let k = -0.5; k <= 0.5; k += 0.25) { c.beginPath(); c.moveTo(k, -0.48); c.lineTo(k, 0.48); c.stroke(); }
  if (inside.sticks) for (let i = 0; i < inside.sticks; i++) { const r = mulberry32(50 + i); drawStick(c, { x: (r() - 0.5) * 0.7, y: (r() - 0.5) * 0.5, a: (r() - 0.5) * 0.9, len: 0.8 + r() * 0.3, seed: 9 + i }, 0, false); }
  if (inside.linda) {
    c.fillStyle = "#b8463c"; c.beginPath(); c.roundRect(-0.62, -0.42, 1.0, 0.84, 0.1); c.fill();   // a red plaid blanket to sit on
    c.strokeStyle = "rgba(255,240,220,0.35)"; c.lineWidth = 0.04; for (let k = -0.5; k < 0.4; k += 0.22) { c.beginPath(); c.moveTo(k, -0.42); c.lineTo(k, 0.42); c.stroke(); } for (let k = -0.32; k < 0.42; k += 0.22) { c.beginPath(); c.moveTo(-0.62, k); c.lineTo(0.38, k); c.stroke(); }
    drawLinda(c, -0.22, 0, 0, inside.linda.t, inside.linda.wave, 1.05);
  }
  c.restore();
}

/** A lap flag: a post with a pennant; the next one to drive through glows with a ring on the grass. */
export function drawFlag(c: CanvasRenderingContext2D, x: number, y: number, R: number, t: number, state: "next" | "later" | "done", label: string) {
  c.save(); c.translate(x, y);
  if (state === "next") {
    const p = 0.5 + 0.5 * Math.sin(t * 4);
    c.fillStyle = `rgba(255,214,64,${(0.1 + 0.08 * p).toFixed(3)})`; c.beginPath(); c.arc(0, 0, R, 0, 7); c.fill();
    c.strokeStyle = "rgba(255,214,64,0.85)"; c.lineWidth = 0.14; c.setLineDash([0.7, 0.5]); c.beginPath(); c.arc(0, 0, R, t * 0.3, t * 0.3 + 7); c.stroke(); c.setLineDash([]);
  }
  const col = state === "next" ? "#ffcf2e" : state === "done" ? "#9fd47a" : "#ffffff", k = state === "next" ? 1.35 : 1;
  c.scale(k, k);
  c.fillStyle = "rgba(20,40,10,0.25)"; c.beginPath(); c.ellipse(0.25, 0.25, 0.3, 0.15, 0.6, 0, 7); c.fill();
  c.strokeStyle = "#6b5a48"; c.lineWidth = 0.07; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -1.3); c.stroke();
  const wv = Math.sin(t * 3 + x) * 0.08;
  c.fillStyle = col; c.strokeStyle = "rgba(60,50,20,0.55)"; c.lineWidth = 0.04; c.beginPath(); c.moveTo(0, -1.3); c.lineTo(0.8, -1.08 + wv); c.lineTo(0, -0.86); c.closePath(); c.fill(); c.stroke();
  if (label) { c.save(); c.scale(0.02, 0.02); c.fillStyle = "#4a3a12"; c.font = "800 14px system-ui, -apple-system, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(label, 15, (-1.08 + wv * 0.5) * 50); c.restore(); }
  c.restore();
}

/** A new tractor tire seen from above as it rolls (tread across it). */
export function drawTire(c: CanvasRenderingContext2D, x: number, y: number, a: number, t: number) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.fillStyle = "#151515"; c.beginPath(); c.roundRect(-0.32, -0.12, 0.64, 0.24, 0.1); c.fill();
  c.strokeStyle = "#3b3b3b"; c.lineWidth = 0.035; const off = (t * 0.6) % 0.12; for (let k = -0.3 + off; k < 0.3; k += 0.12) { c.beginPath(); c.moveTo(k, -0.11); c.lineTo(k + 0.04, 0.11); c.stroke(); }
  c.fillStyle = "#f2b81d"; c.fillRect(-0.06, -0.125, 0.12, 0.02);
  c.restore();
}

/** Pat's blue '67: a fastback coupe from above. Long hood, short deck, the roofline sloping right down to the tail.
 *  Plain body (no badges). Frame centred on the car, +x forward; `steer` turns the front wheels. */
export const CAR = { len: 4.65, wid: 1.82, wb: 2.75 };
export function drawCar(c: CanvasRenderingContext2D, x: number, y: number, h: number, steer: number, o: { body?: string; brake?: boolean; signal?: number; t?: number } = {}) {
  const L = CAR.len / 2, Wd = CAR.wid / 2, body = o.body ?? "#2f68b4";
  c.save();
  c.fillStyle = "rgba(20,40,10,0.24)"; c.save(); c.translate(x + 0.4, y + 0.45); c.rotate(h); c.beginPath(); c.roundRect(-L, -Wd, L * 2, Wd * 2, 0.6); c.fill(); c.restore();
  c.translate(x, y); c.rotate(h);
  // wheels peeking out (the fronts steer)
  for (const [wx, s] of [[1.38, -1], [1.38, 1], [-1.38, -1], [-1.38, 1]] as const) { c.save(); c.translate(wx, s * (Wd - 0.05)); if (wx > 0) c.rotate(steer); c.fillStyle = "#121212"; c.beginPath(); c.roundRect(-0.34, -0.13, 0.68, 0.26, 0.07); c.fill(); c.restore(); }
  // the body: a touch narrower at the doors, wider over the wheels
  c.beginPath();
  c.moveTo(L - 0.25, -Wd + 0.06); c.quadraticCurveTo(L, -Wd + 0.1, L, -Wd + 0.42); c.lineTo(L, Wd - 0.42); c.quadraticCurveTo(L, Wd - 0.1, L - 0.25, Wd - 0.06);
  c.quadraticCurveTo(0.2, Wd + 0.02, -0.4, Wd - 0.03); c.quadraticCurveTo(-1.4, Wd + 0.03, -L + 0.2, Wd - 0.08); c.quadraticCurveTo(-L, Wd - 0.12, -L, Wd - 0.4);
  c.lineTo(-L, -Wd + 0.4); c.quadraticCurveTo(-L, -Wd + 0.12, -L + 0.2, -Wd + 0.08); c.quadraticCurveTo(-1.4, -Wd - 0.03, -0.4, -Wd + 0.03); c.quadraticCurveTo(0.2, -Wd - 0.02, L - 0.25, -Wd + 0.06);
  c.closePath(); c.fillStyle = body; c.fill();
  const g = c.createLinearGradient(0, -Wd, 0, Wd); g.addColorStop(0, "rgba(255,255,255,0.22)"); g.addColorStop(0.45, "rgba(255,255,255,0.03)"); g.addColorStop(1, "rgba(0,0,0,0.2)"); c.fillStyle = g; c.fill();
  c.strokeStyle = "rgba(20,30,50,0.6)"; c.lineWidth = 0.05; c.stroke();
  // chrome bumpers
  c.fillStyle = "#d9dde1"; c.beginPath(); c.roundRect(L - 0.07, -Wd + 0.12, 0.13, Wd * 2 - 0.24, 0.05); c.fill(); c.beginPath(); c.roundRect(-L - 0.06, -Wd + 0.14, 0.12, Wd * 2 - 0.28, 0.05); c.fill();
  // the grille and round headlights
  c.fillStyle = "#23272c"; c.beginPath(); c.roundRect(L - 0.17, -0.5, 0.1, 1.0, 0.04); c.fill();
  for (const s of [-1, 1]) { c.fillStyle = "#eef0e6"; c.beginPath(); c.arc(L - 0.15, s * 0.68, 0.11, 0, 7); c.fill(); c.strokeStyle = "#9aa0a6"; c.lineWidth = 0.03; c.stroke(); }
  // a long hood with a raised centre
  c.strokeStyle = "rgba(0,0,0,0.18)"; c.lineWidth = 0.035; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(L - 0.25, s * 0.3); c.lineTo(0.75, s * 0.36); c.stroke(); }
  c.fillStyle = "rgba(255,255,255,0.1)"; c.beginPath(); c.roundRect(0.8, -0.28, L - 1.1, 0.56, 0.2); c.fill();
  // windshield, roof, the long fastback rear glass, the short deck lid
  c.fillStyle = "#26313d"; c.beginPath(); c.moveTo(0.7, -Wd + 0.2); c.lineTo(0.7, Wd - 0.2); c.lineTo(0.18, Wd - 0.17); c.lineTo(0.18, -Wd + 0.17); c.closePath(); c.fill();
  const ws = c.createLinearGradient(0.7, -Wd, 0.2, 0.3); ws.addColorStop(0, "rgba(190,215,240,0.5)"); ws.addColorStop(1, "rgba(190,215,240,0)"); c.fillStyle = ws; c.fill();
  c.fillStyle = body; c.beginPath(); c.roundRect(-0.72, -Wd + 0.18, 0.92, Wd * 2 - 0.36, 0.12); c.fill();
  c.fillStyle = "rgba(255,255,255,0.16)"; c.beginPath(); c.roundRect(-0.6, -Wd + 0.26, 0.7, 0.3, 0.1); c.fill();
  c.fillStyle = "#26313d"; c.beginPath(); c.moveTo(-0.72, -Wd + 0.2); c.lineTo(-0.72, Wd - 0.2); c.lineTo(-1.62, Wd - 0.3); c.lineTo(-1.62, -Wd + 0.3); c.closePath(); c.fill();
  c.fillStyle = "rgba(190,215,240,0.18)"; c.beginPath(); c.moveTo(-0.76, -Wd + 0.26); c.lineTo(-0.76, -0.1); c.lineTo(-1.55, -0.25); c.lineTo(-1.55, -Wd + 0.34); c.closePath(); c.fill();
  c.strokeStyle = "rgba(0,0,0,0.2)"; c.lineWidth = 0.03; c.beginPath(); c.moveTo(-1.7, -Wd + 0.25); c.lineTo(-1.7, Wd - 0.25); c.stroke();
  // side mirrors, door seams, tail lights (lit when braking)
  for (const s of [-1, 1]) {
    c.fillStyle = "#cfd3d7"; c.beginPath(); c.ellipse(0.62, s * (Wd + 0.06), 0.08, 0.06, 0, 0, 7); c.fill();
    c.strokeStyle = "rgba(0,0,0,0.22)"; c.lineWidth = 0.025; c.beginPath(); c.moveTo(0.15, s * (Wd - 0.02)); c.lineTo(-0.85, s * (Wd - 0.02)); c.stroke();
    c.fillStyle = o.brake ? "#ff4a3a" : "#b8282a"; c.beginPath(); c.roundRect(-L + 0.02, s * 0.48 - 0.17, 0.08, 0.34, 0.03); c.fill();
    if (o.brake) { c.fillStyle = "rgba(255,70,50,0.3)"; c.beginPath(); c.arc(-L - 0.1, s * 0.48, 0.32, 0, 7); c.fill(); }
  }
  if (o.signal && Math.floor((o.t ?? 0) * 2.6) % 2 === 0) for (const sx of [L - 0.1, -L + 0.05]) { c.fillStyle = "rgba(255,180,40,0.4)"; c.beginPath(); c.arc(sx, o.signal * (Wd - 0.12), 0.24, 0, 7); c.fill(); c.fillStyle = "#ffb52e"; c.beginPath(); c.arc(sx, o.signal * (Wd - 0.12), 0.09, 0, 7); c.fill(); }
  c.restore();
}

/** The Rona in Springfield: a big box with a flat roof, blue walls and trim, and a plain "Rona" sign. Frame: centred,
 *  +x along the front, the front facing +y (the side that shows its wall in the 3/4 view). `w` wide, `d` deep. */
export function drawStore(c: CanvasRenderingContext2D, x: number, y: number, a: number, w: number, d: number) {
  const fh = 3.2, BLUE = "#1f5fae", DARK = "#16467f";
  c.save(); c.translate(x, y); c.rotate(a);
  c.fillStyle = "rgba(20,40,10,0.18)"; c.fillRect(-w / 2 + 1.4, -d / 2 + 0.6, w, d + 1.2);
  // the garden centre fenced off at one end, with pallets of bags
  const r = mulberry32(4); c.fillStyle = "#9a9d9f"; c.fillRect(w / 2, -d / 2 + 2, 8, d - 2);
  for (let k = 0; k < 6; k++) { c.fillStyle = ["#6d8f3f", "#8a5a3a", "#c9b37a"][k % 3]; c.fillRect(w / 2 + 1 + (k % 2) * 3.6, -d / 2 + 3 + Math.floor(k / 2) * 6, 2.6 + r() * 0.3, 2.6); }
  c.strokeStyle = "#5d646b"; c.lineWidth = 0.18; c.strokeRect(w / 2, -d / 2 + 2, 8, d - 2);
  // the front wall: blue cladding, a darker band, two sets of glass doors
  c.fillStyle = BLUE; c.fillRect(-w / 2, d / 2 - fh, w, fh);
  c.fillStyle = DARK; c.fillRect(-w / 2, d / 2 - 0.5, w, 0.5);
  for (const dx of [-w * 0.24, w * 0.24]) { c.fillStyle = "#26323d"; c.fillRect(dx - 2, d / 2 - 2.1, 4, 2.1); c.fillStyle = "rgba(200,225,245,0.25)"; c.fillRect(dx - 1.9, d / 2 - 2.0, 1.4, 0.8); c.strokeStyle = "rgba(255,255,255,0.45)"; c.lineWidth = 0.08; c.beginPath(); c.moveTo(dx, d / 2 - 2.1); c.lineTo(dx, d / 2); c.stroke(); }
  c.strokeStyle = "rgba(255,255,255,0.12)"; c.lineWidth = 0.06; for (let k = -w / 2 + 1; k < w / 2; k += 1) { c.beginPath(); c.moveTo(k, d / 2 - fh); c.lineTo(k, d / 2 - 2.3); c.stroke(); }
  // the flat roof: light grey membrane, blue trim round the edge, rooftop units
  const ry0 = -d / 2 - fh, ry1 = d / 2 - fh;
  c.fillStyle = "#c4c7c9"; c.fillRect(-w / 2, ry0, w, d);
  c.strokeStyle = "rgba(0,0,0,0.06)"; c.lineWidth = 0.08; for (let k = -w / 2 + 2; k < w / 2; k += 2) { c.beginPath(); c.moveTo(k, ry0); c.lineTo(k, ry1); c.stroke(); }
  c.strokeStyle = BLUE; c.lineWidth = 0.6; c.strokeRect(-w / 2 + 0.3, ry0 + 0.3, w - 0.6, d - 0.6);
  for (const [ux, uy] of [[-w * 0.3, -0.2], [w * 0.05, 0.05], [w * 0.28, -0.25]]) { const yy = ry0 + d / 2 + uy * d; c.fillStyle = "rgba(0,0,0,0.15)"; c.fillRect(ux + 0.35, yy + 0.35, 2.8, 2); c.fillStyle = "#9aa0a5"; c.fillRect(ux, yy, 2.8, 2); c.fillStyle = "#7d8287"; c.beginPath(); c.arc(ux + 1.4, yy + 1, 0.65, 0, 7); c.fill(); }
  // the sign over the doors: a dark blue panel with plain white letters in the game's own font
  const sw = Math.min(w * 0.32, 11), sy = ry1 - 0.4;
  c.fillStyle = "rgba(0,0,0,0.22)"; c.fillRect(-sw / 2 + 0.25, sy - 1.0, sw, 2.6);
  c.fillStyle = DARK; c.beginPath(); c.roundRect(-sw / 2, sy - 1.3, sw, 2.6, 0.35); c.fill();
  c.strokeStyle = "#ffffff"; c.lineWidth = 0.14; c.stroke();
  c.save(); c.scale(0.05, 0.05); c.fillStyle = "#ffffff"; c.font = "800 38px system-ui, -apple-system, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("Rona", 0, (sy + 0.05) * 20); c.restore();
  c.restore();
}
