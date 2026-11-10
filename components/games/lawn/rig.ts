// Pat's pickup truck and its flatbed trailer with two ramps: the shapes (for bumping into) and the drawing, in the
// same soft style as the buildings. Everything is measured along the rig from the truck's front bumper: `s` metres
// back toward the ramps, `l` metres to the truck's right.
import type { Pt } from "../lawnMap";
import type { Shape } from "./geo";
import { polyShape } from "./geo";
import { pathPoly } from "./art";

export type Rig = { x: number; y: number; a: number };   // the front bumper's middle, and the way the truck faces (radians)
export const RIG = {
  truckLen: 5.6, truckHalf: 1.0,      // the pickup
  bedStart: 6.6, bedEnd: 10.8, bedHalf: 0.95,   // the trailer's deck
  rampEnd: 12.6, rampHalf: 1.1,       // the ramps flare a little at the bottom
  boxStart: 7.4, boxEnd: 10.0, boxHalf: 0.75, park: 8.7,   // the box to park in, and the spot in its middle
};
const INK = "rgba(40,30,22,0.55)";

export function rigPt(r: Rig, s: number, l: number): Pt {
  const fx = Math.cos(r.a), fy = Math.sin(r.a);
  return [r.x - fx * s - fy * l, r.y - fy * s + fx * l];
}
/** A point (world) in the rig's own measures. */
export function rigLocal(r: Rig, x: number, y: number) {
  const fx = Math.cos(r.a), fy = Math.sin(r.a), dx = x - r.x, dy = y - r.y;
  return { s: -(dx * fx + dy * fy), l: -dx * fy + dy * fx };
}
const quad = (r: Rig, s0: number, s1: number, l0: number, l1: number): Pt[] => [rigPt(r, s0, l0), rigPt(r, s0, l1), rigPt(r, s1, l1), rigPt(r, s1, l0)];

/** What the tractor can bump: the truck, the trailer's headboard and side rails, the ramps' outer edges, the fenders.
 *  With `onboard` false the trailer is just one solid block (parked somewhere, not being loaded). */
export function rigShapes(r: Rig, onboard: boolean): Shape[] {
  const out: Shape[] = [polyShape(quad(r, 0, RIG.truckLen, -RIG.truckHalf, RIG.truckHalf)), polyShape(quad(r, RIG.truckLen, RIG.bedStart, -0.25, 0.25))];
  const seg = (a: Pt, b: Pt, rad = 0.05): Shape => ({ k: 2, ax: a[0], ay: a[1], bx: b[0], by: b[1], r: rad });
  if (!onboard) { out.push(polyShape(quad(r, RIG.bedStart, RIG.rampEnd, -RIG.bedHalf - 0.3, RIG.bedHalf + 0.3))); return out; }
  out.push(seg(rigPt(r, RIG.bedStart + 0.1, -RIG.bedHalf), rigPt(r, RIG.bedStart + 0.1, RIG.bedHalf), 0.08));   // the headboard
  for (const side of [-1, 1]) {
    out.push(seg(rigPt(r, RIG.bedStart + 0.1, side * RIG.bedHalf), rigPt(r, RIG.bedEnd, side * RIG.bedHalf)));
    out.push(seg(rigPt(r, RIG.bedEnd, side * RIG.bedHalf), rigPt(r, RIG.rampEnd, side * RIG.rampHalf)));
    out.push(polyShape(quad(r, 8.1, 9.7, side * (RIG.bedHalf + 0.05), side * (RIG.bedHalf + 0.38))));   // the fender over the wheels
  }
  return out;
}

function shade(c: CanvasRenderingContext2D, pts: Pt[], fill: string, line = INK, lw = 0.05) { pathPoly(c, pts); c.fillStyle = fill; c.fill(); c.strokeStyle = line; c.lineWidth = lw; c.stroke(); }

/** The truck and trailer. `ramps` down for loading, up for the road; `box` shows where to park. */
export function drawRig(c: CanvasRenderingContext2D, r: Rig, o: { ramps: boolean; box?: number; color?: string } = { ramps: true }) {
  const body = o.color ?? "#2f557f";
  c.save(); c.lineJoin = "round";
  // soft shadow down and to the right
  c.fillStyle = "rgba(20,40,10,0.2)"; pathPoly(c, quad(r, -0.2, RIG.truckLen + 0.1, -RIG.truckHalf - 0.1, RIG.truckHalf + 0.1).map(p => [p[0] + 0.35, p[1] + 0.4] as Pt)); c.fill();
  pathPoly(c, quad(r, RIG.bedStart, RIG.bedEnd, -RIG.bedHalf - 0.35, RIG.bedHalf + 0.35).map(p => [p[0] + 0.3, p[1] + 0.35] as Pt)); c.fill();
  // ── the trailer ──
  c.strokeStyle = "#4b5056"; c.lineWidth = 0.12; c.lineCap = "round"; c.beginPath();
  const t0 = rigPt(r, RIG.truckLen - 0.2, 0), t1 = rigPt(r, RIG.bedStart, -0.7), t2 = rigPt(r, RIG.bedStart, 0.7);
  c.moveTo(t1[0], t1[1]); c.lineTo(t0[0], t0[1]); c.lineTo(t2[0], t2[1]); c.stroke();   // the A-frame tongue to the hitch
  for (const side of [-1, 1]) {   // wheels under the fenders
    shade(c, quad(r, 8.25, 9.55, side * (RIG.bedHalf + 0.08), side * (RIG.bedHalf + 0.34)), "#1d1f22", "rgba(0,0,0,0.6)", 0.03);
    shade(c, quad(r, 8.1, 9.7, side * (RIG.bedHalf + 0.05), side * (RIG.bedHalf + 0.38)), "#6a7077");
  }
  shade(c, quad(r, RIG.bedStart, RIG.bedEnd, -RIG.bedHalf, RIG.bedHalf), "#b8895a");   // the wooden deck
  c.save(); pathPoly(c, quad(r, RIG.bedStart, RIG.bedEnd, -RIG.bedHalf, RIG.bedHalf)); c.clip();
  c.strokeStyle = "rgba(90,60,30,0.4)"; c.lineWidth = 0.025;
  for (let l = -RIG.bedHalf + 0.19; l < RIG.bedHalf; l += 0.19) { const a = rigPt(r, RIG.bedStart, l), b = rigPt(r, RIG.bedEnd, l); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  c.restore();
  for (const side of [-1, 1]) shade(c, quad(r, RIG.bedStart, RIG.bedEnd, side * (RIG.bedHalf - 0.07), side * (RIG.bedHalf + 0.04)), "#50565c", INK, 0.02);   // the steel side rails
  shade(c, quad(r, RIG.bedStart, RIG.bedStart + 0.16, -RIG.bedHalf - 0.04, RIG.bedHalf + 0.04), "#3d4247");   // the headboard
  if (o.box) {   // the box to park in: yellow paint on the boards
    c.save(); c.globalAlpha = o.box; c.setLineDash([0.28, 0.18]); c.strokeStyle = "#ffd23f"; c.lineWidth = 0.09;
    pathPoly(c, quad(r, RIG.boxStart, RIG.boxEnd, -RIG.boxHalf, RIG.boxHalf)); c.stroke(); c.setLineDash([]); c.restore();
  }
  // the ramps: two aluminium ramps with rungs, flaring a little at the foot (or stood up for the road)
  for (const side of [-1, 1]) {
    if (o.ramps) {
      const q: Pt[] = [rigPt(r, RIG.bedEnd - 0.05, side * 0.3), rigPt(r, RIG.bedEnd - 0.05, side * (RIG.bedHalf - 0.02)), rigPt(r, RIG.rampEnd, side * RIG.rampHalf), rigPt(r, RIG.rampEnd, side * 0.36)];
      shade(c, q, "#b9c0c7");
      c.strokeStyle = "rgba(70,80,90,0.55)"; c.lineWidth = 0.04;
      for (let s = RIG.bedEnd + 0.15; s < RIG.rampEnd; s += 0.22) { const f = (s - RIG.bedEnd) / (RIG.rampEnd - RIG.bedEnd), lo = 0.3 + 0.06 * f, hi = RIG.bedHalf + (RIG.rampHalf - RIG.bedHalf) * f; const a = rigPt(r, s, side * lo), b = rigPt(r, s, side * (hi - 0.03)); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    } else shade(c, quad(r, RIG.bedEnd - 0.1, RIG.bedEnd + 0.12, side * 0.3, side * (RIG.bedHalf - 0.05)), "#b9c0c7");
  }
  // ── the pickup ──
  for (const s of [1.05, 4.3]) for (const side of [-1, 1]) shade(c, quad(r, s - 0.4, s + 0.4, side * (RIG.truckHalf - 0.12), side * (RIG.truckHalf + 0.06)), "#1b1c1e", "rgba(0,0,0,0.6)", 0.02);
  const bodyQ = quad(r, 0, RIG.truckLen, -RIG.truckHalf, RIG.truckHalf);
  pathPoly(c, bodyQ); c.fillStyle = body; c.fill();
  // light from the top left over the body
  const [g0, g1] = [rigPt(r, 0, -RIG.truckHalf), rigPt(r, 0, RIG.truckHalf)], grd = c.createLinearGradient(g0[0], g0[1], g1[0], g1[1]);
  grd.addColorStop(0, "rgba(255,255,255,0.16)"); grd.addColorStop(0.5, "rgba(255,255,255,0.03)"); grd.addColorStop(1, "rgba(0,0,0,0.14)"); c.fillStyle = grd; c.fill();
  c.strokeStyle = INK; c.lineWidth = 0.07; c.stroke();
  c.strokeStyle = "rgba(0,0,0,0.22)"; c.lineWidth = 0.035; for (const l of [-0.42, 0.42]) { const a = rigPt(r, 0.15, l), b = rigPt(r, 1.45, l * 0.9); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }   // creases on the hood
  shade(c, quad(r, 1.55, 2.0, -0.86, 0.86), "#2a3542", INK, 0.03);   // the windshield
  const ws = c.createLinearGradient(...rigPt(r, 1.55, -0.86), ...rigPt(r, 2.0, 0.2)); ws.addColorStop(0, "rgba(180,210,235,0.45)"); ws.addColorStop(1, "rgba(180,210,235,0)"); c.fillStyle = ws; pathPoly(c, quad(r, 1.58, 1.97, -0.82, 0.82)); c.fill();
  shade(c, quad(r, 2.0, 3.05, -0.86, 0.86), body);   // the cab roof
  c.fillStyle = "rgba(255,255,255,0.14)"; pathPoly(c, quad(r, 2.1, 2.95, -0.76, -0.1)); c.fill();
  shade(c, quad(r, 3.05, 3.2, -0.8, 0.8), "#2a3542", INK, 0.02);   // the back window
  shade(c, quad(r, 3.35, RIG.truckLen - 0.12, -RIG.truckHalf + 0.13, RIG.truckHalf - 0.13), "#2a2f35");   // the box
  c.strokeStyle = "rgba(255,255,255,0.08)"; c.lineWidth = 0.03; for (let l = -0.6; l <= 0.6; l += 0.3) { const a = rigPt(r, 3.4, l), b = rigPt(r, RIG.truckLen - 0.2, l); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  for (const side of [-1, 1]) {
    shade(c, quad(r, 1.75, 1.95, side * RIG.truckHalf, side * (RIG.truckHalf + 0.18)), "#1f2328", INK, 0.02);   // mirrors
    shade(c, quad(r, 0.02, 0.18, side * 0.55, side * 0.88), "#fff6d2", INK, 0.02);   // headlights
    shade(c, quad(r, RIG.truckLen - 0.12, RIG.truckLen - 0.02, side * 0.62, side * 0.9), "#d13b33", INK, 0.02);   // tail lights
  }
  c.restore();
}

/** The ratchet straps over the tractor, pulled tight as `k` goes from 0 to 1. */
export function drawStraps(c: CanvasRenderingContext2D, r: Rig, k: number) {
  if (k <= 0) return;
  c.save(); c.lineCap = "round";
  const sets: [number, number, number][] = [[RIG.boxStart - 0.05, 7.95, -1], [RIG.boxStart - 0.05, 7.95, 1], [RIG.boxEnd + 0.05, 9.45, -1], [RIG.boxEnd + 0.05, 9.45, 1]];
  sets.forEach(([sa, sb, side], i) => {
    const u = Math.max(0, Math.min(1, k * 4 - i * 0.7)); if (u <= 0) return;
    const a = rigPt(r, sa, side * (RIG.bedHalf - 0.05)), b = rigPt(r, sb, side * 0.42), m: Pt = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 0.13; c.beginPath(); c.moveTo(a[0] + 0.05, a[1] + 0.06); c.lineTo(m[0] + 0.05, m[1] + 0.06); c.stroke();
    c.strokeStyle = "#f3c22e"; c.lineWidth = 0.1; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(m[0], m[1]); c.stroke();
    const rx = a[0] + (m[0] - a[0]) * 0.35, ry = a[1] + (m[1] - a[1]) * 0.35;
    c.fillStyle = "#3a3f45"; c.fillRect(rx - 0.09, ry - 0.09, 0.18, 0.18);   // the ratchet
  });
  c.restore();
}
