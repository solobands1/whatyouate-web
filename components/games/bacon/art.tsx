// Blenders & Bacon's drawn art, all SVG: the pantry shelving unit (oak frame, sage beadboard back, plank shelves), the
// 96 numbered tiles, the jars, tins and bottles standing between them, the blenders with their glass tubes, the
// bacon strips, the Pantry Card tiles, the Finish tile and the Start crate. Board units: the board is BW x BH and
// every square is a CW x RH slot; the game scales the whole thing to fit the phone.
// The paths (tubes, bacon) are computed once; tubeAt() and baconAt() give the animations points along them.
import { memo, type ReactNode } from "react";
import { GAME_FONT } from "../gameFont";
import { BACON, BLENDERS, CARD_SQUARES, COLS, LAST, ROWS, cellOf, type Card } from "./rules";

export const FW = 20, CT = 40, FL = 66, CW = 100, RH = 90;
export const BW = FW * 2 + COLS * CW;                 // 840
export const BH = CT + ROWS * RH + FL;                // 1186
export type Pt = { x: number; y: number };

const rowTop = (r: number) => CT + (ROWS - 1 - r) * RH;
/** A square's tile: its face (x, y, w, h) on the shelf. */
export function tileOf(n: number) {
  const { row, col } = cellOf(n), y0 = rowTop(row);
  return { x: FW + col * CW + 10, y: y0 + 13, w: 80, h: 60, row, col, y0 };
}
/** Where a token stands on square n (0 = the Start crate; side picks which half of it). */
export function spotOf(n: number, side = 0): Pt {
  if (n <= 0) return { x: side === 0 ? 92 : 178, y: BH - 34 };
  const t = tileOf(n);
  return { x: t.x + t.w / 2 + 3, y: t.y + t.h / 2 + 4 };
}
/** The blender on its base square: where its jug sits (the token drops in here) and the top of its lid. */
export function blenderGeo(i: number) {
  const t = tileOf(BLENDERS[i][0]), cx = t.x + 50;
  return { cx, base: t.y + t.h + 4, jug: { x: cx, y: t.y + 20 }, lid: { x: cx, y: t.y - 7 } };
}

// ── little helpers ─────────────────────────────────────────────────────────
function rnd(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f1 = (v: number) => Math.round(v * 10) / 10;
const poly = (pts: Pt[]) => pts.map(p => `${f1(p.x)},${f1(p.y)}`).join(" ");
const line = (pts: Pt[]) => "M" + pts.map(p => `${f1(p.x)} ${f1(p.y)}`).join("L");
function bez(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}
/** Points along a polyline at even spacing, with each point's unit normal and the running length. */
function even(src: Pt[], n: number) {
  const len = [0]; for (let i = 1; i < src.length; i++) len.push(len[i - 1] + Math.hypot(src[i].x - src[i - 1].x, src[i].y - src[i - 1].y));
  const total = len[len.length - 1], out: (Pt & { nx: number; ny: number; s: number })[] = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const s = (total * k) / n; while (j < src.length - 2 && len[j + 1] < s) j++;
    const seg = len[j + 1] - len[j] || 1, t = (s - len[j]) / seg, a = src[j], b = src[j + 1];
    const dx = b.x - a.x, dy = b.y - a.y, m = Math.hypot(dx, dy) || 1;
    out.push({ x: a.x + dx * t, y: a.y + dy * t, nx: -dy / m, ny: dx / m, s });
  }
  return { pts: out, total };
}
/** Samples a path made by `at(t)` into points with normals (smoothed). */
function sampled(at: (t: number) => Pt, n: number) { const raw: Pt[] = []; for (let i = 0; i <= n * 3; i++) raw.push(at(i / (n * 3))); return even(raw, n); }

// ── the tubes ──────────────────────────────────────────────────────────────
// Each blender's glass tube leaves the top of its lid and curls up to the target square, ending in a glass mouth there.
const SMOOTHIE = ["#ff6f91", "#ffa62b", "#8bd450", "#8f74e0", "#ff8a5c"];
const SMOOTHIE_DARK = ["#d9416a", "#e07f0c", "#5aa627", "#6449c0", "#e15d2f"];
export const smoothieOf = (i: number) => SMOOTHIE[i % SMOOTHIE.length];
const TUBES = BLENDERS.map(([, top], i) => {
  const g = blenderGeo(i), end = spotOf(top), p0 = g.lid, p3 = { x: end.x, y: end.y + 6 };
  const dy = p0.y - p3.y, side = i % 2 === 0 ? 1 : -1, sway = Math.min(34, 14 + dy * 0.08) * side;
  const p1 = { x: p0.x + sway, y: p0.y - dy * 0.45 }, p2 = { x: p3.x - sway, y: p3.y + dy * 0.5 };
  const at = (t: number) => bez(p0, p1, p2, p3, t);
  return { ...sampled(at, 70), p0, p3 };
});
/** A point on blender i's tube, t from 0 (the lid) to 1 (the target square), at even speed. */
export function tubeAt(i: number, t: number): Pt & { a: number } {
  const { pts } = TUBES[i], k = Math.max(0, Math.min(pts.length - 1.001, t * (pts.length - 1))), j = Math.floor(k), f = k - j;
  const a = pts[j], b = pts[Math.min(pts.length - 1, j + 1)];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, a: Math.atan2(b.y - a.y, b.x - a.x) };
}
export const tubeD = (i: number) => line(TUBES[i].pts);
export const tubeLen = (i: number) => TUBES[i].total;

// ── the bacon ──────────────────────────────────────────────────────────────
// A strip draped from its top square down to its bottom square: a gentle S with a crinkle, red meat and cream fat
// running along it, a glossy sheen on the crests.
const BACON_PATHS = BACON.map(([head, tail], i) => {
  const a = spotOf(head), b = spotOf(tail), r = rnd(9001 + i * 77);
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  const waves = Math.max(1, Math.round((L / 150) * 2) / 2), ph = r() * Math.PI, amp = 11 + r() * 4;
  const at = (t: number): Pt => {
    const env = Math.sin(Math.PI * t) * 0.85 + 0.15, w = Math.sin(t * Math.PI * waves + ph) * amp * env;
    const crinkle = Math.sin(t * L / 8 + ph * 3) * 1.1;
    return { x: a.x + dx * t + nx * (w + crinkle), y: a.y + dy * t + ny * (w + crinkle) };
  };
  return { ...sampled(at, 64), a, b, seed: i };
});
/** A point on bacon strip i, t from 0 (top end) to 1 (bottom end), plus the direction it's heading. */
export function baconAt(i: number, t: number): Pt & { a: number } {
  const { pts } = BACON_PATHS[i], k = Math.max(0, Math.min(pts.length - 1.001, t * (pts.length - 1))), j = Math.floor(k), f = k - j;
  const p = pts[j], q = pts[Math.min(pts.length - 1, j + 1)];
  return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f, a: Math.atan2(q.y - p.y, q.x - p.x) };
}
export const baconD = (i: number) => line(BACON_PATHS[i].pts);
export const baconLen = (i: number) => BACON_PATHS[i].total;

function BaconStrip({ i }: { i: number }) {
  const { pts } = BACON_PATHS[i], r = rnd(4242 + i * 31), n = pts.length;
  const jit = Array.from({ length: 6 }, () => ({ f: 0.25 + r() * 0.4, p: r() * 6.28, a: 0.5 + r() * 0.9 }));
  const edge = (o: number, k: number, j: number) => {
    const p = pts[j], taper = j < 2 || j > n - 3 ? 0.86 : 1, w = jit[k] ? Math.sin(j * jit[k].f + jit[k].p) * jit[k].a : 0;
    return { x: p.x + p.nx * (o * taper + w), y: p.y + p.ny * (o * taper + w) };
  };
  const band = (o1: number, o2: number, k1: number, k2: number) => {
    const L: Pt[] = [], R: Pt[] = [];
    for (let j = 0; j < n; j++) { L.push(edge(o1, k1, j)); R.push(edge(o2, k2, j)); }
    return poly([...L, ...R.reverse()]);
  };
  const W = 17;
  // light: crests facing up-left catch it, the troughs go a little darker
  const shades: ReactNode[] = [];
  for (let j = 0; j < n - 1; j++) {
    const p = pts[j], q = pts[j + 1], tx = q.x - p.x, ty = q.y - p.y, m = Math.hypot(tx, ty) || 1;
    const lit = (tx / m) * -0.55 + (ty / m) * -0.35;   // how much this bit faces the light
    const o = Math.max(-1, Math.min(1, lit * 1.6));
    if (Math.abs(o) < 0.15) continue;
    const quad = [edge(-W, 9, j), edge(-W, 9, j + 1), edge(W, 9, j + 1), edge(W, 9, j)];
    shades.push(<polygon key={j} points={poly(quad)} fill={o > 0 ? "#fff" : "#4a0d08"} opacity={f1(o > 0 ? o * 1.6 : -o * 2) / 10} />);
  }
  const gloss: ReactNode[] = [];
  for (let j = 2; j < n - 3; j += 1) {
    if (Math.sin(j * 0.55 + i) < 0.35) continue;
    gloss.push(<polygon key={j} points={poly([edge(-12.5, 9, j), edge(-12.5, 9, j + 1), edge(-10.2, 9, j + 1), edge(-10.2, 9, j)])} fill="#fff" opacity={0.55} />);
  }
  return (
    <g>
      <polygon points={band(-W - 1, W + 1, 0, 5)} fill="#3d0f08" opacity={0.28} transform="translate(4 8)" filter="url(#bbSoft)" />
      <polygon points={band(-W - 1.2, W + 1.2, 0, 5)} fill="#8d2a1d" />
      <polygon points={band(-W, -9, 0, 1)} fill="#d24a36" />
      <polygon points={band(-9, -4, 1, 2)} fill="#fbe6cc" />
      <polygon points={band(-4, 3, 2, 3)} fill="#b83a2b" />
      <polygon points={band(3, 7.5, 3, 4)} fill="#f6dcbc" />
      <polygon points={band(7.5, W, 4, 5)} fill="#d9573f" />
      <polygon points={band(-7.4, -6.2, 1, 1)} fill="#fff6ea" opacity={0.9} />
      <polygon points={band(11, 12.4, 5, 5)} fill="#a8352a" opacity={0.5} />
      {shades}
      {gloss}
    </g>
  );
}

// ── the blender ────────────────────────────────────────────────────────────
/** A countertop blender standing on its tile: a glass jug of smoothie with a lid, on a glossy base with a dial.
 *  `swirl` adds the spinning vortex inside the jug (the whirl animation draws its own copy with it). */
export function BlenderArt({ i, swirl = false, spin = 0 }: { i: number; swirl?: boolean; spin?: number }) {
  const g = blenderGeo(i), x = g.cx, yb = g.base, col = SMOOTHIE[i % SMOOTHIE.length], dark = SMOOTHIE_DARK[i % SMOOTHIE.length];
  const jt = yb - 66, jb = yb - 22;                  // jug top and bottom
  const fill = jt + 20;                              // smoothie level
  const jug = `M${x - 17} ${jt} L${x + 17} ${jt} L${x + 12} ${jb} L${x - 12} ${jb} Z`;
  const liquid = `M${x - 17 + (fill - jt) * 0.147} ${fill} Q${x - 6} ${fill - 3} ${x} ${fill} T${x + 17 - (fill - jt) * 0.147} ${fill} L${x + 12} ${jb} L${x - 12} ${jb} Z`;
  return (
    <g>
      <ellipse cx={x} cy={yb + 1} rx={27} ry={4.5} fill="#2a1a08" opacity={0.25} />
      {/* base */}
      <path d={`M${x - 22} ${yb} L${x + 22} ${yb} L${x + 17} ${yb - 22} L${x - 17} ${yb - 22} Z`} fill="url(#bbBase)" stroke="#0b5f56" strokeWidth={1.4} strokeLinejoin="round" />
      <path d={`M${x - 16} ${yb - 20} L${x + 16} ${yb - 20}`} stroke="#bff3ea" strokeWidth={1.6} strokeLinecap="round" opacity={0.8} />
      <rect x={x - 19} y={yb - 4} width={38} height={4} rx={2} fill="#0b5f56" opacity={0.35} />
      <circle cx={x} cy={yb - 10.5} r={6.6} fill="url(#bbDial)" stroke="#0b5f56" strokeWidth={1.1} />
      <path d={`M${x} ${yb - 10.5} L${x + 3.2 * Math.cos(spin - 1.2)} ${yb - 10.5 + 3.2 * Math.sin(spin - 1.2)}`} stroke="#0e2f45" strokeWidth={1.7} strokeLinecap="round" />
      <circle cx={x - 12.5} cy={yb - 10.5} r={1.8} fill="#ffd34d" stroke="#0b5f56" strokeWidth={0.7} />
      <circle cx={x + 12.5} cy={yb - 10.5} r={1.8} fill="#ff6b6b" stroke="#0b5f56" strokeWidth={0.7} />
      {/* collar */}
      <rect x={x - 14} y={jb - 1} width={28} height={4} rx={1.5} fill="#cfd8e3" stroke="#7c8aa0" strokeWidth={0.8} />
      {/* handle */}
      <path d={`M${x + 15} ${jt + 7} C${x + 28} ${jt + 8} ${x + 27} ${jb - 8} ${x + 12.5} ${jb - 6}`} fill="none" stroke="#9fc4d6" strokeWidth={4.2} strokeLinecap="round" opacity={0.9} />
      <path d={`M${x + 15} ${jt + 7} C${x + 28} ${jt + 8} ${x + 27} ${jb - 8} ${x + 12.5} ${jb - 6}`} fill="none" stroke="#eaf8ff" strokeWidth={1.4} strokeLinecap="round" opacity={0.9} />
      {/* jug glass, the smoothie, and the blade */}
      <path d={jug} fill="rgba(214,240,255,0.55)" />
      <clipPath id={`bbJug${i}${swirl ? "s" : ""}`}><path d={jug} /></clipPath>
      <g clipPath={`url(#bbJug${i}${swirl ? "s" : ""})`}>
        <path d={liquid} fill={col} />
        <path d={liquid} fill="url(#bbLiquidShade)" />
        {!swirl && [0, 1, 2, 3].map(k => <circle key={k} cx={x - 8 + k * 5.5} cy={fill + 8 + (k % 2) * 7} r={2.1} fill={dark} opacity={0.7} />)}
        {swirl && (
          <g className="bb-vortex" style={{ transformOrigin: `${x}px ${jb - 14}px` }}>
            {[0, 1, 2].map(k => <path key={k} d={`M${x} ${jb - 14} m-15 ${-6 + k * 7} q 15 -9 30 0`} stroke="#fff" strokeWidth={2.2} fill="none" opacity={0.75} strokeLinecap="round" transform={`rotate(${k * 120} ${x} ${jb - 14})`} />)}
            <ellipse cx={x} cy={jb - 14} rx={13} ry={5} fill="none" stroke={dark} strokeWidth={2} opacity={0.6} />
          </g>
        )}
        <path d={`M${x - 7} ${jb - 4} L${x + 7} ${jb - 6} M${x - 6} ${jb - 6} L${x + 6} ${jb - 3.5}`} stroke="#8fa0b5" strokeWidth={1.6} strokeLinecap="round" />
      </g>
      <path d={jug} fill="none" stroke="#7fb3cc" strokeWidth={1.5} strokeLinejoin="round" />
      <path d={`M${x - 12} ${jt + 5} L${x - 8.5} ${jb - 5}`} stroke="#fff" strokeWidth={2.6} strokeLinecap="round" opacity={0.85} />
      <path d={`M${x - 6.5} ${jt + 5} L${x - 5} ${jt + 14}`} stroke="#fff" strokeWidth={1.4} strokeLinecap="round" opacity={0.7} />
      {[0, 1, 2].map(k => <path key={k} d={`M${x + 8 - k * 0.6} ${jt + 9 + k * 7} h5`} stroke="#5e95b3" strokeWidth={1} opacity={0.65} />)}
      {/* lid */}
      <rect x={x - 19} y={jt - 6} width={38} height={7.5} rx={3.2} fill="url(#bbLid)" stroke="#1b2738" strokeWidth={1.1} />
      <rect x={x - 6} y={jt - 11} width={12} height={6} rx={2} fill="#33445e" stroke="#1b2738" strokeWidth={1} />
      <path d={`M${x - 15} ${jt - 4} h20`} stroke="#8295b3" strokeWidth={1.2} strokeLinecap="round" />
    </g>
  );
}

function Tube({ i }: { i: number }) {
  const { pts } = TUBES[i], col = SMOOTHIE[i % SMOOTHIE.length], R = 10;
  const off = (o: number) => line(pts.map(p => ({ x: p.x + p.nx * o, y: p.y + p.ny * o })));
  // a two-strand spiral of smoothie wrapping the glass: the front half bright, the back half faint
  const front: string[] = [], back: string[] = [];
  for (const strand of [0, Math.PI]) {
    let cur: Pt[] = [], curFront = true;
    pts.forEach((p, k) => {
      const ph = p.s / 30 * Math.PI * 2 + strand + i, o = Math.cos(ph) * (R - 3), isFront = Math.sin(ph) > 0;
      const q = { x: p.x + p.nx * o, y: p.y + p.ny * o };
      if (k > 0 && isFront !== curFront) { (curFront ? front : back).push(line([...cur, q])); cur = []; }
      curFront = isFront; cur.push(q);
    });
    if (cur.length > 1) (curFront ? front : back).push(line(cur));
  }
  const d = line(pts), end = pts[pts.length - 1], prev = pts[pts.length - 4], ang = Math.atan2(end.y - prev.y, end.x - prev.x) * 180 / Math.PI;
  return (
    <g>
      <path d={d} stroke="#16384a" strokeOpacity={0.18} strokeWidth={2 * R + 4} fill="none" strokeLinecap="round" transform="translate(3 6)" filter="url(#bbSoft)" />
      {back.map((b, k) => <path key={`b${k}`} d={b} stroke={col} strokeWidth={3.4} fill="none" strokeLinecap="round" opacity={0.35} />)}
      <path d={d} stroke="#d8f3ff" strokeOpacity={0.42} strokeWidth={2 * R} fill="none" strokeLinecap="round" />
      <path d={off(-R)} stroke="#4f97b8" strokeOpacity={0.75} strokeWidth={1.7} fill="none" />
      <path d={off(R)} stroke="#4f97b8" strokeOpacity={0.75} strokeWidth={1.7} fill="none" />
      {front.map((f, k) => <path key={`f${k}`} d={f} stroke={col} strokeWidth={3.6} fill="none" strokeLinecap="round" />)}
      <path d={off(-5.5)} stroke="#fff" strokeOpacity={0.8} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeDasharray="40 9 6 9" />
      {/* the glass mouth at the target square */}
      <g transform={`translate(${f1(end.x)} ${f1(end.y)}) rotate(${f1(ang + 90)})`}>
        <ellipse cx={0} cy={0} rx={R + 5} ry={5.5} fill="rgba(216,243,255,0.55)" stroke="#4f97b8" strokeWidth={1.6} />
        <ellipse cx={0} cy={0} rx={R + 1} ry={3} fill={col} opacity={0.55} />
        <path d={`M${-R - 2} -1.5 Q0 -6 ${R + 2} -1.5`} stroke="#fff" strokeWidth={1.4} fill="none" opacity={0.85} />
      </g>
    </g>
  );
}

// ── pantry bits between the tiles ──────────────────────────────────────────
type Deco = { x: number; y: number; k: number; v: number };
const DECO: Deco[] = (() => {
  const out: Deco[] = [], r = rnd(321);
  for (let row = 0; row < ROWS; row++) {
    const order = Array.from({ length: COLS - 1 }, (_, k) => k);   // a shuffle that runs the same everywhere (a random sort() differs between browsers)
    for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
    const y = rowTop(row) + 78, gaps = order.slice(0, 3 + (row % 3 === 0 ? 1 : 0));
    for (const gp of gaps) out.push({ x: FW + (gp + 1) * CW, y, k: Math.floor(r() * 7), v: Math.floor(r() * 4) });
  }
  return out;
})();
const SPICE = ["#d9532c", "#f2b630", "#6aa84f", "#8a5a3b"], LABEL = ["#e8505b", "#3f7fd6", "#22a964", "#f5a524"];
function DecoItem({ d }: { d: Deco }) {
  return <g transform={`translate(${d.x} ${d.y}) scale(1.12) translate(${-d.x} ${-d.y})`}><DecoShape d={d} /></g>;
}
function DecoShape({ d }: { d: Deco }) {
  const { x, y, v } = d;
  switch (d.k) {
    case 0: return (   // spice jar
      <g><rect x={x - 7} y={y - 26} width={14} height={22} rx={3} fill="rgba(230,246,255,0.8)" stroke="#8bb3c9" strokeWidth={1} />
        <rect x={x - 6} y={y - 17} width={12} height={12} rx={2} fill={SPICE[v]} />
        <rect x={x - 7.5} y={y - 31} width={15} height={6} rx={2} fill={["#e8505b", "#2b3a55", "#f5a524", "#22a964"][v]} />
        <path d={`M${x - 4} ${y - 23} v14`} stroke="#fff" strokeWidth={1.4} opacity={0.8} /></g>);
    case 1: return (   // tin can
      <g><rect x={x - 8} y={y - 22} width={16} height={22} rx={2} fill="url(#bbTin)" />
        <rect x={x - 8} y={y - 18} width={16} height={13} fill={LABEL[v]} />
        <circle cx={x} cy={y - 11.5} r={3.6} fill="#fff" opacity={0.9} />
        <rect x={x - 8.5} y={y - 23} width={17} height={2.4} rx={1} fill="#c3ccd8" /><rect x={x - 8.5} y={y - 2.4} width={17} height={2.4} rx={1} fill="#aab4c2" /></g>);
    case 2: return (   // oil bottle
      <g><path d={`M${x - 6} ${y} V${y - 26} Q${x - 6} ${y - 32} ${x - 2.4} ${y - 35} V${y - 44} H${x + 2.4} V${y - 35} Q${x + 6} ${y - 32} ${x + 6} ${y - 26} V${y} Z`} fill={["#d8a21c", "#7aa83a", "#c66a2a", "#4f8f6a"][v]} opacity={0.9} stroke="#6b4a10" strokeWidth={0.8} />
        <rect x={x - 3} y={y - 48} width={6} height={5} rx={1.4} fill="#a0703f" />
        <rect x={x - 5} y={y - 20} width={10} height={9} rx={1.5} fill="#fff7e6" />
        <path d={`M${x - 3.4} ${y - 30} v24`} stroke="#fff" strokeWidth={1.2} opacity={0.55} /></g>);
    case 3: return (   // tea box
      <g><rect x={x - 8} y={y - 32} width={16} height={32} rx={1.5} fill={["#2f9e8f", "#e07a5f", "#5b6ee1", "#f2b630"][v]} stroke="rgba(0,0,0,0.15)" strokeWidth={0.8} />
        <rect x={x - 8} y={y - 32} width={16} height={6} fill="rgba(255,255,255,0.35)" />
        <circle cx={x} cy={y - 15} r={4.5} fill="#fff" opacity={0.85} /><circle cx={x} cy={y - 15} r={2} fill="#2b3a55" opacity={0.6} /></g>);
    case 4: return (   // honey jar
      <g><path d={`M${x - 8} ${y} V${y - 15} Q${x - 8} ${y - 20} ${x - 5} ${y - 20} H${x + 5} Q${x + 8} ${y - 20} ${x + 8} ${y - 15} V${y} Z`} fill="#f2a818" stroke="#b5760a" strokeWidth={0.8} />
        <rect x={x - 7} y={y - 25} width={14} height={5.5} rx={1.6} fill="#e8505b" /><path d={`M${x - 7} ${y - 22} h14`} stroke="#fff" strokeWidth={0.8} strokeDasharray="1.5 1.5" />
        <path d={`M${x - 5} ${y - 16} v12`} stroke="#ffe08a" strokeWidth={1.6} opacity={0.9} /></g>);
    case 5: return (   // pasta jar
      <g><rect x={x - 8} y={y - 36} width={16} height={36} rx={3.5} fill="rgba(230,246,255,0.75)" stroke="#8bb3c9" strokeWidth={1} />
        {[0, 1, 2, 3, 4, 5].map(k => <rect key={k} x={x - 6 + (k % 2) * 5.5} y={y - 30 + Math.floor(k / 2) * 9} width={6} height={3} rx={1.2} fill="#f2c14e" transform={`rotate(${k % 2 ? 25 : -20} ${x - 3 + (k % 2) * 5.5} ${y - 28 + Math.floor(k / 2) * 9})`} />)}
        <rect x={x - 8.5} y={y - 40} width={17} height={5} rx={1.8} fill="#9a6b3f" />
        <path d={`M${x - 5} ${y - 33} v28`} stroke="#fff" strokeWidth={1.4} opacity={0.7} /></g>);
    default: return (  // pepper mill
      <g><path d={`M${x - 4} ${y} V${y - 18} Q${x - 6} ${y - 24} ${x - 3.5} ${y - 28} H${x + 3.5} Q${x + 6} ${y - 24} ${x + 4} ${y - 18} V${y} Z`} fill="#6b4226" stroke="#3e2412" strokeWidth={0.8} />
        <circle cx={x} cy={y - 31} r={3} fill="#3e2412" /><path d={`M${x - 2} ${y - 24} v20`} stroke="#a77a52" strokeWidth={1.2} opacity={0.8} /></g>);
  }
}

// ── tiles ──────────────────────────────────────────────────────────────────
const TILE = [{ face: "#fffaf1", lip: "#d4b98a" }, { face: "#ffe6c2", lip: "#d2a565" }];
function CardMark({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-11} y={-14} width={22} height={29} rx={4} fill="#8a5cf6" transform="rotate(-12) translate(-4 1)" opacity={0.95} />
      <g transform="rotate(8)">
        <rect x={-11} y={-15} width={22} height={30} rx={4} fill="#fff" stroke="#c98a12" strokeWidth={1.6} />
        <rect x={-8} y={-12} width={16} height={24} rx={2.6} fill="url(#bbGold)" />
        <path d="M0 -6.8 L2.1 -2.2 L7 -1.8 L3.2 1.4 L4.4 6.2 L0 3.6 L-4.4 6.2 L-3.2 1.4 L-7 -1.8 L-2.1 -2.2 Z" fill="#fff" stroke="#c98a12" strokeWidth={0.9} strokeLinejoin="round" />
      </g>
    </g>
  );
}
function Trophy({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-13 -18 h26 v6 q0 14 -13 16 q-13 -2 -13 -16 z" fill="url(#bbGold)" stroke="#a86a00" strokeWidth={1.4} />
      <path d="M-13 -14 q-9 0 -8 7 q1 6 9 6 M13 -14 q9 0 8 7 q-1 6 -9 6" fill="none" stroke="#e0a21a" strokeWidth={2.6} strokeLinecap="round" />
      <rect x={-3} y={3} width={6} height={7} fill="#e0a21a" />
      <rect x={-10} y={10} width={20} height={6} rx={2} fill="#9a5f12" />
      <path d="M-8 -15 q1 10 6 13" stroke="#fff6d0" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.85} />
    </g>
  );
}

function Tiles() {
  const out: ReactNode[] = [];
  const blenderBases = new Set(BLENDERS.map(b => b[0]));
  for (let n = 1; n <= LAST; n++) {
    const t = tileOf(n), alt = (t.row + t.col) % 2, card = CARD_SQUARES.includes(n), fin = n === LAST, bl = blenderBases.has(n);
    const face = fin ? "url(#bbFinish)" : card ? "url(#bbCardTile)" : bl ? "#e3f6f2" : TILE[alt].face;
    const lip = fin ? "#c7880f" : card ? "#d39a1c" : bl ? "#a9d6cc" : TILE[alt].lip;
    out.push(
      <g key={n}>
        <rect x={t.x + 2} y={t.y + 9} width={t.w - 4} height={t.h} rx={12} fill="#5a3a18" opacity={0.24} />
        <rect x={t.x} y={t.y + 6.5} width={t.w} height={t.h} rx={12} fill={lip} />
        <rect x={t.x + 0.5} y={t.y + 6.5} width={t.w - 1} height={t.h} rx={12} fill="none" stroke="#6b4318" strokeOpacity={0.25} strokeWidth={1} />
        <rect x={t.x} y={t.y} width={t.w} height={t.h} rx={12} fill={face} />
        <rect x={t.x} y={t.y} width={t.w} height={t.h} rx={12} fill="url(#bbTileShade)" />
        <rect x={t.x + 3} y={t.y + 2.5} width={t.w - 6} height={t.h * 0.42} rx={9} fill="#fff" opacity={card || fin ? 0.28 : 0.45} />
        <rect x={t.x + 0.6} y={t.y + 0.6} width={t.w - 1.2} height={t.h - 1.2} rx={11.5} fill="none" stroke={card || fin ? "#b97a08" : "#8a5a2b"} strokeOpacity={card || fin ? 0.45 : 0.16} strokeWidth={1.2} />
        {card && <CardMark x={t.x + 54} y={t.y + 32} />}
        {fin && <Trophy x={t.x + 55} y={t.y + 33} />}
      </g>,
    );
  }
  return <g>{out}</g>;
}
/** The square numbers, drawn last of the board art so a strip of bacon never hides one. */
function Numbers() {
  const out: ReactNode[] = [];
  for (let n = 1; n <= LAST; n++) {
    const t = tileOf(n), card = CARD_SQUARES.includes(n), fin = n === LAST;
    out.push(
      <text key={n} x={t.x + 8} y={t.y + 23} fontFamily={GAME_FONT} fontSize={22} fill={fin || card ? "#7a4a00" : "#8a5527"}
        stroke={fin || card ? "#fff3c4" : "#fffaf0"} strokeWidth={3.4} paintOrder="stroke" strokeLinejoin="round">{n}</text>,
    );
  }
  return <g>{out}</g>;
}

// ── the unit ───────────────────────────────────────────────────────────────
function Unit() {
  const shelves: ReactNode[] = [];
  for (let row = 0; row < ROWS; row++) {
    const y0 = rowTop(row), py = y0 + 76;
    shelves.push(
      <g key={row}>
        <rect x={FW} y={py + 13} width={BW - 2 * FW} height={16} fill="url(#bbUnderShadow)" />
        <rect x={FW} y={py} width={BW - 2 * FW} height={4.5} fill="#f2c993" />
        <rect x={FW} y={py + 4} width={BW - 2 * FW} height={10} fill="url(#bbPlank)" />
        <path d={`M${FW} ${py + 4.3} H${BW - FW}`} stroke="#fff1d6" strokeWidth={1} opacity={0.8} />
        <path d={`M${FW + 40} ${py + 9} q60 -2 120 0 t130 1 M${FW + 330} ${py + 10} q70 -2 140 0 M${FW + 540} ${py + 9} q80 -2 160 0 t100 1`} stroke="#a8692f" strokeWidth={0.8} fill="none" opacity={0.45} />
        {row > 0 && [FW + 2, BW / 2 - 5, BW - FW - 12].map((bx, k) => (
          <g key={k}><path d={`M${bx} ${py + 14} h10 l-10 10 z`} fill="#9aa4b1" /><path d={`M${bx} ${py + 14} h10`} stroke="#d5dbe3" strokeWidth={1.2} /><circle cx={bx + 3} cy={py + 17.5} r={1.1} fill="#5f6875" /></g>
        ))}
      </g>,
    );
  }
  return (
    <g>
      {/* back wall: sage beadboard with a soft light from above */}
      <rect x={0} y={0} width={BW} height={BH} fill="#cfe5d6" />
      <rect x={FW} y={CT} width={BW - 2 * FW} height={ROWS * RH + FL} fill="url(#bbBead)" />
      <rect x={FW} y={CT} width={BW - 2 * FW} height={ROWS * RH + FL} fill="url(#bbWallLight)" />
      {shelves}
    </g>
  );
}
function Frame() {
  const py = BH - 14;
  return (
    <g>
      {/* inner shadow where the posts meet the wall */}
      <rect x={FW} y={CT} width={10} height={BH - CT} fill="url(#bbPostShadowL)" />
      <rect x={BW - FW - 10} y={CT} width={10} height={BH - CT} fill="url(#bbPostShadowR)" />
      <rect x={0} y={0} width={FW} height={BH} fill="url(#bbPost)" />
      <rect x={BW - FW} y={0} width={FW} height={BH} fill="url(#bbPost)" />
      <path d={`M${FW - 1} ${CT} V${BH} M${BW - FW + 1} ${CT} V${BH}`} stroke="#7a4a1f" strokeWidth={1.5} opacity={0.6} />
      <path d={`M5 60 q2 200 -1 420 t2 400 t-1 ${BH - 900} M${BW - 7} 90 q-2 260 1 470 t-1 380 t1 ${BH - 960}`} stroke="#9a5f2a" strokeWidth={0.9} fill="none" opacity={0.5} />
      {/* crown */}
      <rect x={0} y={0} width={BW} height={CT} fill="url(#bbCrown)" />
      <rect x={0} y={0} width={BW} height={9} fill="#e9b678" />
      <path d={`M0 9 H${BW}`} stroke="#fff0d2" strokeWidth={1.2} opacity={0.8} />
      <rect x={0} y={CT - 7} width={BW} height={7} fill="#a86a33" />
      <path d={`M0 ${CT - 7} H${BW}`} stroke="#7a4a1f" strokeWidth={1} opacity={0.7} />
      <rect x={FW} y={CT} width={BW - 2 * FW} height={12} fill="url(#bbUnderShadow)" />
      {Array.from({ length: Math.ceil((BW - 14) / 20) }, (_, k) => <rect key={k} x={14 + k * 20} y={CT - 6} width={10} height={4} rx={1} fill="#8d5526" opacity={0.6} />)}
      <g>
        <rect x={BW / 2 - 66} y={11} width={132} height={20} rx={6} fill="#8d5526" />
        <rect x={BW / 2 - 64} y={12} width={128} height={17} rx={5} fill="#fff4dc" />
        <text x={BW / 2} y={26} textAnchor="middle" fontFamily={GAME_FONT} fontSize={14.5} fill="#8a5527" letterSpacing="0.06em">THE PANTRY</text>
      </g>
      {/* the bottom: a floor board with the Start crate and a couple of sacks */}
      <rect x={FW} y={py} width={BW - 2 * FW} height={14} fill="url(#bbPlank)" />
      <rect x={FW} y={py - 3} width={BW - 2 * FW} height={4} fill="#f2c993" />
      <rect x={0} y={BH - 4} width={BW} height={4} fill="#6e4219" />
    </g>
  );
}
function StartCrate() {
  const y = BH - 60, x0 = 30, w = 214, h = 44;
  return (
    <g>
      <rect x={x0} y={y + 6} width={w} height={h} rx={6} fill="#9b6431" />
      <rect x={x0} y={y} width={w} height={h} rx={6} fill="url(#bbCrate)" stroke="#7a4a1f" strokeWidth={1.4} />
      {[0, 1, 2].map(k => <path key={k} d={`M${x0 + 4} ${y + 6 + k * 15} H${x0 + w - 4}`} stroke="#c58a4c" strokeWidth={1} opacity={0.6} />)}
      <rect x={x0 + w / 2 - 34} y={y + h - 15} width={68} height={19} rx={9.5} fill="#22a964" stroke="#167a45" strokeWidth={1.4} />
      <text x={x0 + w / 2} y={y + h - 0.5} textAnchor="middle" fontFamily={GAME_FONT} fontSize={14} fill="#fff" letterSpacing="0.05em">START</text>
      {/* sacks and an onion basket on the right */}
      <g transform={`translate(${BW - 150} ${BH - 14})`}>
        <path d="M-30 0 Q-36 -30 -22 -46 Q-14 -52 -6 -46 Q8 -30 2 0 Z" fill="#d8b98a" stroke="#9c7a49" strokeWidth={1.3} />
        <path d="M-25 -44 q9 5 19 -1" stroke="#9c7a49" strokeWidth={2} fill="none" />
        <text x={-14} y={-16} textAnchor="middle" fontFamily={GAME_FONT} fontSize={10} fill="#8a6a3a">FLOUR</text>
        <path d="M10 0 Q8 -26 22 -36 Q36 -40 46 -32 Q58 -20 54 0 Z" fill="#c9a774" stroke="#94723f" strokeWidth={1.3} />
        <path d="M20 -34 q12 5 24 0" stroke="#94723f" strokeWidth={2} fill="none" />
        <circle cx={40} cy={-42} r={7} fill="#c96a3a" /><circle cx={30} cy={-39} r={6} fill="#b4552b" /><circle cx={47} cy={-36} r={5.5} fill="#d07a43" />
        <path d="M40 -49 l1 -5 M30 -45 l-1 -4" stroke="#7a9a3a" strokeWidth={1.4} strokeLinecap="round" />
        <path d="M70 0 h46 l-5 -26 h-36 z" fill="#b07a3f" stroke="#7a4a1f" strokeWidth={1.2} />
        <path d="M72 -9 h42 M73 -18 h40" stroke="#7a4a1f" strokeWidth={1} opacity={0.6} />
        <circle cx={84} cy={-30} r={6.5} fill="#ffd34d" /><circle cx={98} cy={-31} r={7} fill="#f2b630" /><circle cx={91} cy={-36} r={6} fill="#ffe27a" />
      </g>
    </g>
  );
}

function Defs() {
  return (
    <defs>
      <filter id="bbSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" /></filter>
      <pattern id="bbBead" width="26" height="40" patternUnits="userSpaceOnUse">
        <rect width="26" height="40" fill="#d3e9da" />
        <rect x="0" width="1.6" height="40" fill="#b9d6c3" /><rect x="1.6" width="2" height="40" fill="#e3f3e8" />
        <rect x="13" width="9" height="40" fill="#cde4d4" opacity="0.6" />
      </pattern>
      <linearGradient id="bbWallLight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.25" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#2f5a44" stopOpacity="0.12" />
      </linearGradient>
      <linearGradient id="bbUnderShadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#24402f" stopOpacity="0.32" /><stop offset="1" stopColor="#24402f" stopOpacity="0" /></linearGradient>
      <linearGradient id="bbPlank" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dfa463" /><stop offset="1" stopColor="#b5763a" /></linearGradient>
      <linearGradient id="bbPost" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#a96a30" /><stop offset="0.45" stopColor="#d79c5c" /><stop offset="1" stopColor="#b47538" /></linearGradient>
      <linearGradient id="bbPostShadowL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#24402f" stopOpacity="0.25" /><stop offset="1" stopColor="#24402f" stopOpacity="0" /></linearGradient>
      <linearGradient id="bbPostShadowR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stopColor="#24402f" stopOpacity="0.25" /><stop offset="1" stopColor="#24402f" stopOpacity="0" /></linearGradient>
      <linearGradient id="bbCrown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d99d5c" /><stop offset="1" stopColor="#bd7f41" /></linearGradient>
      <linearGradient id="bbCrate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e2ad6e" /><stop offset="1" stopColor="#c48647" /></linearGradient>
      <linearGradient id="bbCardTile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe48a" /><stop offset="1" stopColor="#ffc53d" /></linearGradient>
      <linearGradient id="bbFinish" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff0a8" /><stop offset="0.5" stopColor="#ffd34d" /><stop offset="1" stopColor="#f7b21a" /></linearGradient>
      <linearGradient id="bbGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff2a6" /><stop offset="0.5" stopColor="#ffcf3f" /><stop offset="1" stopColor="#f0a818" /></linearGradient>
      <linearGradient id="bbBase" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#1aa596" /><stop offset="0.4" stopColor="#3fd0bd" /><stop offset="1" stopColor="#139080" /></linearGradient>
      <linearGradient id="bbLid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4d6386" /><stop offset="1" stopColor="#253349" /></linearGradient>
      <radialGradient id="bbDial" cx="0.35" cy="0.35" r="0.8"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#c9d4e2" /></radialGradient>
      <linearGradient id="bbLiquidShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0.35" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.18" /></linearGradient>
      <linearGradient id="bbTileShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stopColor="#8a5a2b" stopOpacity="0" /><stop offset="1" stopColor="#8a5a2b" stopOpacity="0.1" /></linearGradient>
      <linearGradient id="bbTin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#9aa6b6" /><stop offset="0.4" stopColor="#eef2f7" /><stop offset="1" stopColor="#8a96a8" /></linearGradient>
    </defs>
  );
}

/** The whole board, drawn once. */
export const BoardArt = memo(function BoardArt() {
  return (
    <svg viewBox={`0 0 ${BW} ${BH}`} width="100%" height="100%" className="absolute inset-0 block" aria-hidden>
      <Defs />
      <Unit />
      {DECO.map((d, k) => <DecoItem key={k} d={d} />)}
      <Tiles />
      {BLENDERS.map((_, i) => <Tube key={i} i={i} />)}
      {BACON.map((_, i) => <BaconStrip key={i} i={i} />)}
      {BLENDERS.map((_, i) => <BlenderArt key={i} i={i} />)}
      <Numbers />
      <Frame />
      <StartCrate />
    </svg>
  );
});

/** The defs the overlay copies need (gradients for the blender). */
export const ArtDefs = Defs;

// ── cards ──────────────────────────────────────────────────────────────────
export const CARD_INFO: Record<Card, { name: string; short: string; tip: string; col: string; lo: string; lip: string }> = {
  double: { name: "Double Roll", short: "Double", tip: "Roll twice this turn", col: "#ffb238", lo: "#f08a0c", lip: "#b8620a" },
  swap: { name: "Swap Places", short: "Swap", tip: "Swap squares with them", col: "#a07cff", lo: "#7c55ea", lip: "#5735b8" },
  mitt: { name: "Oven Mitt", short: "Mitt", tip: "Saves you from bacon", col: "#3ccfb4", lo: "#16a88f", lip: "#0d7a67" },
};
/** A card's picture, drawn: two dice, two swapping arrows, or a quilted oven mitt. 64x64 box. */
export function CardIcon({ card, size }: { card: Card; size: number }) {
  if (card === "double") return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className="block">
      <g transform="rotate(-14 22 34)"><rect x="5" y="17" width="32" height="32" rx="8" fill="#fff" stroke="#c46a00" strokeWidth="2.4" />
        {[[13, 25], [29, 41], [21, 33]].map(([cx, cy], k) => <circle key={k} cx={cx} cy={cy} r="3.4" fill="#2b2140" />)}</g>
      <g transform="rotate(12 44 28)"><rect x="27" y="10" width="32" height="32" rx="8" fill="#fff" stroke="#c46a00" strokeWidth="2.4" />
        {[[35, 18], [51, 18], [35, 34], [51, 34]].map(([cx, cy], k) => <circle key={k} cx={cx} cy={cy} r="3.4" fill="#2b2140" />)}</g>
      <path d="M31 12 v-0.1" />
    </svg>
  );
  if (card === "swap") return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className="block">
      <path d="M12 24 h30 l-7 -8 M52 40 h-30 l7 8" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 24 h30 l-7 -8 M52 40 h-30 l7 8" fill="none" stroke="#4a2aa8" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="24" r="7" fill="#3f7fd6" stroke="#fff" strokeWidth="2.4" />
      <circle cx="52" cy="40" r="7" fill="#e8505b" stroke="#fff" strokeWidth="2.4" />
    </svg>
  );
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className="block">
      <path d="M20 54 V30 Q18 12 32 10 Q46 9 46 26 V30 L52 24 Q58 20 60 26 Q61 31 55 36 L46 46 V54 Z" fill="#e8505b" stroke="#a3262f" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M24 30 L42 48 M24 42 L36 54 M30 18 L44 32 M24 22 L28 26 M34 12 L44 22 M44 32 L24 52" stroke="#ff9aa1" strokeWidth="1.6" opacity="0.8" />
      <rect x="17" y="50" width="32" height="9" rx="3.5" fill="#fff4e0" stroke="#a3262f" strokeWidth="2.2" />
      <path d="M26 16 Q30 13 35 13" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.8" />
    </svg>
  );
}

/** The die icon on the Roll button. */
export function DieIcon({ size, color = "#fff", pip = "#167a45" }: { size: number; color?: string; pip?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden className="block">
      <rect x="3" y="3" width="26" height="26" rx="7" fill={color} />
      <rect x="3" y="3" width="26" height="12" rx="7" fill="#fff" opacity="0.4" />
      {[[10.5, 10.5], [21.5, 10.5], [16, 16], [10.5, 21.5], [21.5, 21.5]].map(([cx, cy], k) => <circle key={k} cx={cx} cy={cy} r="2.6" fill={pip} />)}
    </svg>
  );
}

/** Speaker icon for the sound toggle. */
export function SoundIcon({ on, size }: { on: boolean; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="block" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      {on ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
    </svg>
  );
}
