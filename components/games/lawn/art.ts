// The drawings for Pat's Lawnmower: the yard (drawn once into big canvases), buildings, trees, the tractor, the cat,
// people, the fire, apples and puddles. World units are metres; x east, y south. Light comes from the top left, so
// shadows fall down and to the right.
import type { LawnMap, Pt, Building, Tree, Line, Vehicle, Prop } from "../lawnMap";
import { pip, polyClosest, segClosest, centroid, area, mulberry32 } from "./geo";

export const OBL = 0.25;  // how much wall shows under each roof (a slight 3/4 view)
export function pathPoly(c: CanvasRenderingContext2D, pts: Pt[]) { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); }
function lerpCol(a: number[], b: number[], t: number) { return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`; }
const STRIPE_DARK = [104, 166, 62], STRIPE_LIGHT = [176, 218, 112];
/** Cut grass colour by mowing direction: mowed upward reads light, downward dark, like real stripes. */
export function stripeCol(h: number) { const b = -Math.sin(h), t = 0.5 + 0.5 * Math.sign(b) * Math.pow(Math.abs(b), 0.55); return lerpCol(STRIPE_DARK, STRIPE_LIGHT, t); }
/** Grass mowed earlier in the week (outside today's job): wide, soft stripes. */
export function oldStripeCol(x: number) { return Math.floor(x / 4) % 2 ? "rgb(128,184,82)" : "rgb(152,200,98)"; }

/** Lots of little grass blades, batched into one path per colour. */
function blades(c: CanvasRenderingContext2D, rnd: () => number, W: number, H: number, n: number, cols: string[], lw: number, len: number, jit: number) {
  const paths = cols.map(() => new Path2D());
  for (let k = 0; k < n; k++) { const x = rnd() * W, y = rnd() * H, p = paths[Math.floor(rnd() * cols.length)]; p.moveTo(x, y); p.lineTo(x + (rnd() - 0.5) * len, y - len - rnd() * jit); }
  c.lineWidth = lw; c.lineCap = "round"; paths.forEach((p, i) => { c.strokeStyle = cols[i]; c.stroke(p); });
}

/** The grass layer: rough meadow everywhere, the lawn on top as tall uncut grass. Mowing paints onto it. */
export function makeGrass(map: LawnMap, PX: number) {
  const W = map.size[0], H = map.size[1], cv = document.createElement("canvas");
  cv.width = Math.ceil(W * PX); cv.height = Math.ceil(H * PX);
  const c = cv.getContext("2d")!, rnd = mulberry32(7);
  c.scale(PX, PX);
  c.fillStyle = "#8fa557"; c.fillRect(0, 0, W, H);
  blades(c, rnd, W, H, W * H * 3, ["rgba(70,95,35,0.35)", "rgba(200,205,120,0.35)"], 0.06, 0.35, 0.25);
  c.save();
  map.lawn.forEach(p => pathPoly(c, p)); c.beginPath(); for (const p of map.lawn) { p.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); }
  c.clip();
  c.fillStyle = "#3f7428"; c.fillRect(0, 0, W, H);
  blades(c, rnd, W, H, W * H * 12, ["rgba(26,66,20,0.6)", "rgba(78,130,46,0.55)", "rgba(118,165,70,0.5)"], 0.05, 0.16, 0.14);
  c.restore();
  // keep the lawn clip on for mowing strokes
  c.beginPath(); for (const p of map.lawn) { p.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); }
  c.clip();
  return { cv, c };
}


/** Everything flat on the ground, drawn once: road, driveway, beds, fences, shadows, the door step. */
export function makeGround(map: LawnMap, PX: number) {
  const W = map.size[0], H = map.size[1], cv = document.createElement("canvas");
  cv.width = Math.ceil(W * PX); cv.height = Math.ceil(H * PX);
  const c = cv.getContext("2d")!, rnd = mulberry32(11);
  c.scale(PX, PX);
  // shadows first (soft: a wide faint one under a tighter one)
  c.fillStyle = "rgba(20,40,10,0.12)";
  for (const t of map.trees) if (t.kind !== "well") { c.beginPath(); c.ellipse(t.x + t.r * 0.28, t.y + t.r * 0.32, t.r * 1.06, t.r * 0.98, 0, 0, 7); c.fill(); }
  c.fillStyle = "rgba(20,40,10,0.1)";
  for (const t of map.trees) if (t.kind !== "well") { c.beginPath(); c.ellipse(t.x + t.r * 0.22, t.y + t.r * 0.26, t.r * 0.9, t.r * 0.84, 0, 0, 7); c.fill(); }
  for (const b of map.buildings) buildingShadow(c, b);
  // no-go areas
  for (const n of map.noGo) {
    const xs = n.poly.map(p => p[0]), ys = n.poly.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    c.save(); pathPoly(c, n.poly); c.clip();
    if (n.kind === "road") {
      c.fillStyle = "#c2b79e"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
      const horiz = x1 - x0 >= y1 - y0, inset = 0.7;
      c.fillStyle = "#5c5f63"; if (horiz) c.fillRect(x0, y0 + inset, x1 - x0, y1 - y0 - inset); else c.fillRect(x0 + inset, y0, x1 - x0 - 2 * inset, y1 - y0);
      for (let k = 0; k < (x1 - x0) * (y1 - y0) * 6; k++) { c.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"; c.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 0.08, 0.08); }
      c.strokeStyle = "#e5c24c"; c.lineWidth = 0.15; c.setLineDash([2, 2.4]); c.beginPath();
      if (horiz) { const m = (y0 + inset + y1) / 2; c.moveTo(x0, m); c.lineTo(x1, m); } else { const m = (x0 + x1) / 2; c.moveTo(m, y0); c.lineTo(m, y1); }
      c.stroke(); c.setLineDash([]);
    } else if (n.kind === "water") { c.fillStyle = "#6fa7c9"; c.fillRect(x0, y0, x1 - x0, y1 - y0); c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 0.08; for (let k = 0; k < 20; k++) { const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0); c.beginPath(); c.moveTo(x, y); c.lineTo(x + 0.8, y); c.stroke(); } }
    else if (n.kind === "field") {   // a tilled field: soil with crop-stubble rows
      c.fillStyle = "#a88e66"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
      for (let k = 0; k < (x1 - x0) * (y1 - y0) * 3; k++) { c.fillStyle = rnd() < 0.5 ? "rgba(90,70,45,0.25)" : "rgba(200,180,140,0.25)"; c.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 0.12, 0.12); }
      const ang = -1.35, ux = Math.cos(ang), uy = Math.sin(ang), L = Math.hypot(x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      c.lineWidth = 0.22;
      for (let o = -L; o < L; o += 0.75) { c.strokeStyle = (Math.round(o / 0.75) & 1) ? "rgba(110,88,58,0.45)" : "rgba(196,176,132,0.35)"; c.beginPath(); c.moveTo(mx - uy * o - ux * L, my + ux * o - uy * L); c.lineTo(mx - uy * o + ux * L, my + ux * o + uy * L); c.stroke(); }
    }
    c.restore();
    if (n.kind === "woods") {   // a dense row of trees: overlapping round canopies, drawn past the edge a little so it looks soft
      const pts: Pt[] = []; for (let k = 0; k < (x1 - x0) * (y1 - y0) * 0.5; k++) { const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0); if (pip(n.poly, x, y)) pts.push([x, y]); }
      c.fillStyle = "rgba(20,40,10,0.2)"; for (const [x, y] of pts) { c.beginPath(); c.arc(x + 0.5, y + 0.6, 1.3, 0, 7); c.fill(); }
      const cols = ["#2d5a2a", "#356a2f", "#3f7a35", "#2a5226"];
      for (const [x, y] of pts) { const r = 0.9 + rnd() * 0.8; c.fillStyle = cols[Math.floor(rnd() * cols.length)]; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.fillStyle = "rgba(140,200,100,0.18)"; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.5, 0, 7); c.fill(); }
    }
  }
  // roads: gravel shoulders, asphalt, a dashed centre line
  const stroke = (l: Line, wd: number, col: string, dash: number[] = []) => { c.strokeStyle = col; c.lineWidth = wd; c.lineCap = dash.length ? "butt" : "round"; c.lineJoin = "round"; c.setLineDash(dash); c.beginPath(); l.pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); c.setLineDash([]); };
  // lanes: gravel (light, speckled, two darker tire tracks) or dirt (a two-track with grass down the middle)
  for (const l of map.lanes) {
    if (l.kind === "dirt") { stroke(l, l.width, "#b39f7c"); stroke(l, l.width * 0.22, "rgba(120,140,70,0.55)"); continue; }
    stroke(l, l.width + 0.3, "rgba(90,110,50,0.35)"); stroke(l, l.width, "#cdc3ae");
    for (let i = 1; i < l.pts.length; i++) {
      const [ax, ay] = l.pts[i - 1], [bx, by] = l.pts[i], L = Math.hypot(bx - ax, by - ay);
      for (let k = 0; k < L * l.width * 14; k++) { const t = rnd(), o = (rnd() - 0.5) * l.width * 0.95, nx = -(by - ay) / L, ny = (bx - ax) / L, v = rnd(); c.fillStyle = v < 0.35 ? "rgba(120,105,85,0.45)" : v < 0.7 ? "rgba(245,238,222,0.6)" : "rgba(160,150,135,0.5)"; c.beginPath(); c.arc(ax + (bx - ax) * t + nx * o, ay + (by - ay) * t + ny * o, 0.035 + rnd() * 0.04, 0, 7); c.fill(); }
    }
    for (const side of [-1, 1]) {
      c.strokeStyle = "rgba(125,110,88,0.35)"; c.lineWidth = Math.max(0.22, l.width * 0.1); c.lineCap = "round"; c.lineJoin = "round"; c.beginPath();
      l.pts.forEach((p, i) => { const q = l.pts[Math.min(l.pts.length - 1, i + 1)], o = l.pts[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], d = Math.hypot(dx, dy) || 1, off = side * l.width * 0.24; const x = p[0] - (dy / d) * off, y = p[1] + (dx / d) * off; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
      c.stroke();
    }
  }
  for (const r of map.roads) {
    stroke(r, r.width, "#c4b89f"); stroke(r, r.width * 0.72, "#5f6266");
    for (let k = 0; k < 2; k++) stroke(r, r.width * (0.7 - k * 0.02), k ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)");
    stroke(r, Math.max(0.12, r.width * 0.025), "#e5c24c", [2.2, 2.6]);
  }
  // concrete pads
  for (const d of map.pads) {
    if (d.kind === "dirt") {
      c.save(); pathPoly(c, d.poly); c.clip(); const xs = d.poly.map(p => p[0]), ys = d.poly.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      c.fillStyle = "#a88d68"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
      for (let k = 0; k < (x1 - x0) * (y1 - y0) * 12; k++) { c.fillStyle = rnd() < 0.5 ? "rgba(90,70,45,0.3)" : rnd() < 0.5 ? "rgba(200,182,145,0.35)" : "rgba(110,140,70,0.35)"; c.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 0.08, 0.08); }
      c.restore(); c.strokeStyle = "rgba(90,120,50,0.5)"; c.lineWidth = 0.3; pathPoly(c, d.poly); c.stroke();
    } else { c.fillStyle = "#d3cfc6"; pathPoly(c, d.poly); c.fill(); c.strokeStyle = "rgba(0,0,0,0.12)"; c.lineWidth = 0.08; c.stroke(); }
  }
  // gravel driveway
  for (const d of map.driveway) {
    const xs = d.map(p => p[0]), ys = d.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    c.save(); pathPoly(c, d); c.fillStyle = "#cdbfa5"; c.fill(); c.clip();
    for (let k = 0; k < (x1 - x0) * (y1 - y0) * 14; k++) { const v = rnd(); c.fillStyle = v < 0.35 ? "rgba(120,105,85,0.45)" : v < 0.7 ? "rgba(240,232,215,0.6)" : "rgba(160,150,135,0.5)"; c.beginPath(); c.arc(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 0.04 + rnd() * 0.05, 0, 7); c.fill(); }
    c.strokeStyle = "rgba(90,110,50,0.45)"; c.lineWidth = 0.35; pathPoly(c, d); c.stroke();
    c.restore();
  }
  // the door step
  const house = map.buildings.find(b => b.kind === "house");
  if (house) {
    const { c: near } = polyClosest(house.poly, map.door.x, map.door.y), a = Math.atan2(map.door.y - near[1], map.door.x - near[0]);
    c.save(); c.translate((map.door.x + near[0]) / 2, (map.door.y + near[1]) / 2); c.rotate(a);
    c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(-0.45, -0.7, 1.05, 1.5); c.fillStyle = "#d8cfbd"; c.fillRect(-0.55, -0.75, 1.0, 1.5); c.restore();
  }
  // garden beds
  for (const b of map.beds) {
    const xs = b.poly.map(p => p[0]), ys = b.poly.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    c.save(); pathPoly(c, b.poly); c.fillStyle = "#6b4a31"; c.fill(); c.clip();
    for (let k = 0; k < (x1 - x0) * (y1 - y0) * 10; k++) { c.fillStyle = rnd() < 0.5 ? "rgba(40,25,15,0.35)" : "rgba(140,105,75,0.35)"; c.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 0.07, 0.07); }
    if (b.veg) {
      const horiz = x1 - x0 >= y1 - y0;
      for (let r = (horiz ? y0 : x0) + 0.6; r < (horiz ? y1 : x1) - 0.3; r += 0.9) for (let s = (horiz ? x0 : y0) + 0.5; s < (horiz ? x1 : y1) - 0.3; s += 0.55) {
        const x = horiz ? s : r, y = horiz ? r : s; c.fillStyle = "#4f8f35"; c.beginPath(); c.arc(x, y, 0.2 + rnd() * 0.06, 0, 7); c.fill(); c.fillStyle = "#73b04c"; c.beginPath(); c.arc(x - 0.05, y - 0.05, 0.1, 0, 7); c.fill();
      }
    } else {
      const flowers = ["#e8758a", "#f2c84b", "#a77fd6", "#ffffff", "#f08a4b"];
      for (let k = 0; k < (x1 - x0) * (y1 - y0) * 2.2; k++) { const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0); c.fillStyle = rnd() < 0.5 ? "#4a8a33" : "#3a7329"; c.beginPath(); c.arc(x, y, 0.18 + rnd() * 0.14, 0, 7); c.fill(); if (rnd() < 0.55) { c.fillStyle = flowers[Math.floor(rnd() * flowers.length)]; c.beginPath(); c.arc(x + (rnd() - 0.5) * 0.15, y + (rnd() - 0.5) * 0.15, 0.08, 0, 7); c.fill(); } }
    }
    c.restore();
    c.strokeStyle = "#9b7b58"; c.lineWidth = 0.16; pathPoly(c, b.poly); c.stroke();
  }
  // parked vehicles, with a shadow
  for (const v of map.vehicles) drawVehicle(c, v);
  for (const pr of map.props) drawProp(c, pr, rnd);
  // a few fallen apples under the apple trees
  for (const t of map.trees) if (t.kind === "fruit") for (let k = 0; k < 7; k++) { const a = rnd() * 7, d = t.r * (0.5 + rnd() * 0.65); c.fillStyle = rnd() < 0.7 ? "#c9362c" : "#8f2a22"; c.beginPath(); c.arc(t.x + Math.cos(a) * d, t.y + Math.sin(a) * d, 0.09, 0, 7); c.fill(); }
  // the cistern cap / rocks
  for (const t of map.trees) if (t.kind === "well") {
    c.fillStyle = "rgba(20,40,10,0.18)"; c.beginPath(); c.arc(t.x + 0.25, t.y + 0.3, t.r, 0, 7); c.fill();
    c.fillStyle = "#cfc8b6"; c.beginPath(); c.arc(t.x, t.y, t.r, 0, 7); c.fill();
    c.strokeStyle = "#a9a291"; c.lineWidth = 0.12; c.stroke(); c.beginPath(); c.arc(t.x, t.y, t.r * 0.55, 0, 7); c.stroke();
  }
  // fences: post and rail
  for (const f of map.fences) {
    c.lineCap = "round";
    c.strokeStyle = "rgba(20,40,10,0.18)"; c.lineWidth = 0.14; c.beginPath(); f.forEach((p, i) => (i ? c.lineTo(p[0] + 0.18, p[1] + 0.22) : c.moveTo(p[0] + 0.18, p[1] + 0.22))); c.stroke();
    c.strokeStyle = "#b39a76"; c.lineWidth = 0.09; c.beginPath(); f.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke();
    c.fillStyle = "#7c6144";
    for (let i = 1; i < f.length; i++) {
      const [ax, ay] = f[i - 1], [bx, by] = f[i], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L / 2.4));
      for (let k = 0; k <= n; k++) { const x = ax + ((bx - ax) * k) / n, y = ay + ((by - ay) * k) / n; c.fillRect(x - 0.12, y - 0.12, 0.24, 0.24); }
    }
  }
  return cv;
}


export function drawProp(c: CanvasRenderingContext2D, p: Prop, rnd: () => number) {
  c.save(); c.translate(p.x, p.y);
  if (p.kind === "firepit") {   // a ring of stones, ash and a few embers in the middle
    const r = p.r ?? 0.6;
    c.fillStyle = "rgba(20,20,10,0.25)"; c.beginPath(); c.arc(0.08, 0.1, r * 1.05, 0, 7); c.fill();
    c.fillStyle = "#4a4440"; c.beginPath(); c.arc(0, 0, r * 0.82, 0, 7); c.fill();
    c.fillStyle = "#7d756c"; c.beginPath(); c.arc(0, 0, r * 0.6, 0, 7); c.fill();
    for (let k = 0; k < 9; k++) { c.fillStyle = rnd() < 0.5 ? "#e0702a" : "#f2a33a"; c.beginPath(); c.arc((rnd() - 0.5) * r * 0.8, (rnd() - 0.5) * r * 0.8, 0.04 + rnd() * 0.04, 0, 7); c.fill(); }
    c.strokeStyle = "#3a2a1e"; c.lineWidth = 0.06; c.beginPath(); c.moveTo(-r * 0.35, -r * 0.1); c.lineTo(r * 0.3, r * 0.15); c.moveTo(-r * 0.2, r * 0.3); c.lineTo(r * 0.15, -r * 0.3); c.stroke();
    const n = 13; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; c.fillStyle = k % 3 ? "#9c958c" : "#b4ada3"; c.beginPath(); c.ellipse(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, r * 0.2, r * 0.15, a, 0, 7); c.fill(); }
  } else {
    const w = p.w ?? 1, h = p.h ?? 1;
    c.rotate(((p.heading ?? 0) * Math.PI) / 180);
    c.fillStyle = "rgba(20,40,10,0.2)"; c.fillRect(-w / 2 + 0.1, -h / 2 + 0.12, w, h);
    if (p.kind === "horseshoe") {   // a sand pit with a stake and a couple of horseshoes
      c.fillStyle = "#8a6a46"; c.fillRect(-w / 2, -h / 2, w, h); c.fillStyle = "#e3cf9a"; c.fillRect(-w / 2 + 0.06, -h / 2 + 0.06, w - 0.12, h - 0.12);
      c.fillStyle = "rgba(0,0,0,0.25)"; c.beginPath(); c.arc(w * 0.03, w * 0.04, w * 0.09, 0, 7); c.fill();
      c.fillStyle = "#2f3237"; c.beginPath(); c.arc(0, 0, w * 0.08, 0, 7); c.fill();
      c.strokeStyle = "#5d6166"; c.lineWidth = w * 0.06; c.lineCap = "round";
      for (const [hx, hy, ha] of [[-w * 0.14, h * 0.24, 0.5], [w * 0.16, -h * 0.26, 2.4]]) { c.beginPath(); c.arc(hx, hy, w * 0.16, ha, ha + Math.PI * 1.4); c.stroke(); }
    } else if (p.kind === "chair") {   // a wooden lawn chair seen from above
      c.fillStyle = "#c79a5e"; c.fillRect(-w / 2, -h / 2, w, h * 0.35);
      c.fillStyle = "#d9ae72"; c.fillRect(-w / 2 + 0.05, -h / 2 + h * 0.35, w - 0.1, h * 0.65);
      c.strokeStyle = "rgba(90,60,30,0.45)"; c.lineWidth = 0.03; for (let k = 1; k < 4; k++) { const x = -w / 2 + (w * k) / 4; c.beginPath(); c.moveTo(x, -h / 2); c.lineTo(x, h / 2); c.stroke(); }
      c.fillStyle = "#b8894f"; c.fillRect(-w / 2 - 0.06, -h * 0.1, 0.12, h * 0.6); c.fillRect(w / 2 - 0.06, -h * 0.1, 0.12, h * 0.6);
    } else {   // a small white box (a cover or little shed)
      c.fillStyle = "#f4f2ec"; c.fillRect(-w / 2, -h / 2, w, h); c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 0.06; c.strokeRect(-w / 2, -h / 2, w, h);
      c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(w / 2, 0); c.stroke();
    }
  }
  c.restore();
}

export function drawVehicle(c: CanvasRenderingContext2D, v: Vehicle) {
  const a = ((v.heading - 90) * Math.PI) / 180, L = v.len, Wd = v.wid;
  c.save(); c.fillStyle = "rgba(20,40,10,0.22)"; c.translate(v.x + 0.35, v.y + 0.4); c.rotate(a); c.beginPath(); c.roundRect(-L / 2, -Wd / 2, L, Wd, 0.4); c.fill(); c.restore();
  c.save(); c.translate(v.x, v.y); c.rotate(a);
  c.fillStyle = "#1c1c1c"; for (const [wx, wy] of [[L * 0.3, -Wd / 2], [L * 0.3, Wd / 2], [-L * 0.3, -Wd / 2], [-L * 0.3, Wd / 2]]) c.fillRect(wx - 0.38, wy - 0.12, 0.76, 0.24);
  c.fillStyle = v.color; c.beginPath(); c.roundRect(-L / 2, -Wd / 2, L, Wd, 0.35); c.fill();
  c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 0.06; c.stroke();
  c.fillStyle = "#2b3440"; c.beginPath(); c.roundRect(L * 0.12, -Wd / 2 + 0.15, L * 0.14, Wd - 0.3, 0.12); c.fill();        // windshield
  c.fillStyle = "rgba(0,0,0,0.08)"; c.fillRect(-L / 2 + 0.2, -Wd / 2 + 0.2, L * 0.5, Wd - 0.4);                              // the box
  c.strokeStyle = "rgba(0,0,0,0.18)"; c.strokeRect(-L / 2 + 0.2, -Wd / 2 + 0.2, L * 0.5, Wd - 0.4);
  c.restore();
}


export function drawTree(c: CanvasRenderingContext2D, t: Tree, blobs: number[][], alpha: number, time: number) {
  c.save(); c.globalAlpha = alpha; c.translate(t.x, t.y);
  const sway = Math.sin(time * 0.8 + t.x) * 0.03 * t.r;
  if (t.kind === "spruce") {
    const layers = [["#244b2c", 1], ["#2f5f37", 0.78], ["#3b7043", 0.52], ["#4a8250", 0.26]] as const;
    for (const [col, k] of layers) {
      c.fillStyle = col; c.beginPath();
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2 + k, r = t.r * k * (i % 2 ? 0.72 : 1); c.lineTo(Math.cos(a) * r + sway * k, Math.sin(a) * r); }
      c.closePath(); c.fill();
    }
  } else {
    // a soft dark edge round the whole canopy (the same toy look as the buildings), then the leafy clumps
    c.strokeStyle = "rgba(26,56,20,0.42)"; c.lineWidth = Math.max(0.06, t.r * 0.05);
    c.beginPath(); c.arc(sway * 0.5, 0, t.r, 0, 7); for (const [bx, by, br] of blobs) { c.moveTo(bx * t.r + sway + br * t.r, by * t.r); c.arc(bx * t.r + sway, by * t.r, br * t.r, 0, 7); } c.stroke();
    c.fillStyle = t.kind === "fruit" ? "#47873a" : "#3a7330"; c.beginPath(); c.arc(sway * 0.5, 0, t.r, 0, 7); c.fill();
    for (const [bx, by, br, sh] of blobs) { c.fillStyle = sh < 0.5 ? "#4b8c3a" : "#58a043"; c.beginPath(); c.arc(bx * t.r + sway, by * t.r, br * t.r, 0, 7); c.fill(); }
    c.fillStyle = "rgba(20,50,15,0.14)"; for (const [bx, by, br] of blobs) if (bx + by > 0.2) { c.beginPath(); c.arc(bx * t.r + sway + br * t.r * 0.25, by * t.r + br * t.r * 0.25, br * t.r * 0.7, 0, 7); c.fill(); }
    c.fillStyle = "rgba(150,210,100,0.35)"; c.beginPath(); c.arc(-t.r * 0.3 + sway, -t.r * 0.32, t.r * 0.42, 0, 7); c.fill();
    if (t.kind === "fruit") { c.fillStyle = "#d8443a"; for (const [bx, by] of blobs) { c.beginPath(); c.arc(bx * t.r * 0.9 + sway, by * t.r * 0.9 + 0.1, 0.09, 0, 7); c.fill(); } }
  }
  c.restore();
}


// ── buildings: one soft, slightly toy-like style for all of them. Roofs overhang their walls, shingled (house, porch)
// or standing-seam metal (barn, shed, lean-to), trimmed in white and edged with a soft dark line; the south walls show
// below (the slight 3/4 view) with siding, corner boards, windows and doors. ──
const INK = "rgba(46,32,22,0.55)";
function rgbOf(col: string) { const h = col.replace("#", ""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
/** A colour lightened (k > 0, toward white) or darkened (k < 0, toward black). */
export function tone(col: string, k: number) { const [r, g, b] = rgbOf(col), t = k > 0 ? 255 : 0, a = Math.min(1, Math.abs(k)); return `rgb(${Math.round(r + (t - r) * a)},${Math.round(g + (t - g) * a)},${Math.round(b + (t - b) * a)})`; }
const mid = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
const dist = (p: Pt, q: Pt) => Math.hypot(q[0] - p[0], q[1] - p[1]);
/** A convex polygon pushed out by `d` (mitred corners): a roof's overhang past its walls. */
function outset(P: Pt[], d: number): Pt[] {
  const [cx, cy] = centroid(P), n = P.length;
  const nrm = (a: Pt, b: Pt): Pt => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; let nx = dy / L, ny = -dx / L; const mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy; if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; } return [nx, ny]; };
  return P.map((p, i) => { const a = P[(i + n - 1) % n], b = P[(i + 1) % n], n1 = nrm(a, p), n2 = nrm(p, b), k = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]); return [p[0] + (n1[0] + n2[0]) * k, p[1] + (n1[1] + n2[1]) * k] as Pt; });
}
/** How much a surface facing `dir` is lit (light from the top left): -1..1. */
const litBy = (dx: number, dy: number) => { const L = Math.hypot(dx, dy) || 1; return (dx * -0.55 + dy * -0.83) / L; };

/** Roof texture inside a clipped region, drawn in the ridge's frame (x along the ridge, y away from it). */
function roofTexture(c: CanvasRenderingContext2D, metal: boolean, len: number, depth: number, seed: number) {
  const rnd = mulberry32(seed);
  if (metal) {   // standing seams running down the slope
    c.lineWidth = 0.035;
    for (let x = -len / 2 - 1; x < len / 2 + 1; x += 0.46) { c.strokeStyle = "rgba(0,0,0,0.2)"; c.beginPath(); c.moveTo(x, -0.2); c.lineTo(x, depth + 0.5); c.stroke(); c.strokeStyle = "rgba(255,255,255,0.22)"; c.beginPath(); c.moveTo(x + 0.05, -0.2); c.lineTo(x + 0.05, depth + 0.5); c.stroke(); }
    return;
  }
  // shingles: courses parallel to the ridge, the tabs staggered, a little variation from shingle to shingle
  const row = 0.2, tab = 0.32;
  for (let y = 0, j = 0; y < depth + 0.5; y += row, j++) for (let x = -len / 2 - 1 + (j % 2) * tab * 0.5; x < len / 2 + 1; x += tab) {
    const v = rnd(); if (v < 0.2) { c.fillStyle = "rgba(255,255,255,0.05)"; c.fillRect(x, y, tab, row); } else if (v > 0.82) { c.fillStyle = "rgba(0,0,0,0.06)"; c.fillRect(x, y, tab, row); }
  }
  c.strokeStyle = "rgba(0,0,0,0.22)"; c.lineWidth = 0.026; c.beginPath();
  for (let y = row, j = 1; y < depth + 0.5; y += row, j++) { c.moveTo(-len / 2 - 1, y); c.lineTo(len / 2 + 1, y); for (let x = -len / 2 - 1 + (j % 2) * tab * 0.5; x < len / 2 + 1; x += tab) { c.moveTo(x, y); c.lineTo(x, y + row * 0.85); } }
  c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.07)"; c.beginPath(); for (let y = row + 0.035; y < depth + 0.5; y += row) { c.moveTo(-len / 2 - 1, y); c.lineTo(len / 2 + 1, y); } c.stroke();
}
/** One slope of a roof: base colour, lit or shaded, textured, from ridge r0-r1 out to the eave. */
function roofSlope(c: CanvasRenderingContext2D, poly: Pt[], r0: Pt, r1: Pt, col: string, metal: boolean, seed: number) {
  const [cx, cy] = centroid(poly), rm = mid(r0, r1), lit = litBy(cx - rm[0], cy - rm[1]);
  const ang = Math.atan2(r1[1] - r0[1], r1[0] - r0[0]), len = dist(r0, r1) + 2;
  let nx = -Math.sin(ang), ny = Math.cos(ang); const flip = (cx - rm[0]) * nx + (cy - rm[1]) * ny < 0; if (flip) { nx = -nx; ny = -ny; }
  const depth = Math.max(...poly.map(p => Math.abs((p[0] - rm[0]) * nx + (p[1] - rm[1]) * ny)));
  c.save(); pathPoly(c, poly); c.fillStyle = tone(col, lit > 0 ? 0.13 * lit : 0.26 * lit); c.fill(); c.clip();
  // a soft fall-off from the ridge to the eave
  const g = c.createLinearGradient(rm[0], rm[1], rm[0] + nx * depth, rm[1] + ny * depth); g.addColorStop(0, "rgba(255,255,255,0.06)"); g.addColorStop(1, "rgba(0,0,0,0.1)"); c.fillStyle = g; c.fill();
  c.translate(rm[0], rm[1]); c.rotate(ang); if (flip) c.scale(1, -1);
  roofTexture(c, metal, len, depth, seed);
  c.restore();
}
/** A gable roof over a 4-sided footprint, ridge along the long side. Returns the ridge. */
function gableRoof(c: CanvasRenderingContext2D, R: Pt[], col: string, metal: boolean, trim: string, seed: number) {
  const [p0, p1, p2, p3] = dist(R[0], R[1]) >= dist(R[1], R[2]) ? [R[0], R[1], R[2], R[3]] : [R[1], R[2], R[3], R[0]];
  const r0 = mid(p3, p0), r1 = mid(p1, p2);
  roofSlope(c, [p0, p1, r1, r0], r0, r1, col, metal, seed);
  roofSlope(c, [p2, p3, r0, r1], r0, r1, col, metal, seed + 1);
  // the ridge cap
  c.lineCap = "butt"; c.strokeStyle = "rgba(0,0,0,0.28)"; c.lineWidth = 0.26; c.beginPath(); c.moveTo(r0[0], r0[1]); c.lineTo(r1[0], r1[1]); c.stroke();
  c.strokeStyle = tone(col, metal ? 0.3 : 0.12); c.lineWidth = 0.18; c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.18)"; c.lineWidth = 0.05; c.beginPath(); const a = Math.atan2(r1[1] - r0[1], r1[0] - r0[0]), ox = Math.sin(a) * 0.04, oy = -Math.cos(a) * 0.04; c.moveTo(r0[0] + ox, r0[1] + oy); c.lineTo(r1[0] + ox, r1[1] + oy); c.stroke();
  edge(c, R, trim);
  return [r0, r1] as const;
}
/** The roof's edge: a soft dark line with the white fascia inside it. */
function edge(c: CanvasRenderingContext2D, R: Pt[], trim: string | null) {
  c.lineJoin = "round"; pathPoly(c, R); c.strokeStyle = INK; c.lineWidth = 0.17; c.stroke();
  if (trim) { c.strokeStyle = trim; c.lineWidth = 0.09; c.stroke(); }
}
/** A window in a wall: white frame, sill, glass with a sky reflection. */
function windowAt(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, trim: string) {
  c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(x - w / 2 + 0.04, y + 0.04, w, h);
  c.fillStyle = trim; c.fillRect(x - w / 2, y, w, h);
  const g = c.createLinearGradient(x - w / 2, y, x + w / 2, y + h); g.addColorStop(0, "#9fbdd3"); g.addColorStop(0.45, "#5b7890"); g.addColorStop(1, "#3f566b");
  c.fillStyle = g; c.fillRect(x - w / 2 + 0.07, y + 0.07, w - 0.14, h - 0.14);
  c.fillStyle = "rgba(255,255,255,0.35)"; c.beginPath(); c.moveTo(x - w / 2 + 0.07, y + h * 0.55); c.lineTo(x - w / 2 + 0.07 + w * 0.35, y + 0.07); c.lineTo(x - w / 2 + 0.07 + w * 0.5, y + 0.07); c.lineTo(x - w / 2 + 0.07, y + h * 0.8); c.fill();
  c.fillStyle = trim; c.fillRect(x - 0.025, y + 0.07, 0.05, h - 0.14);
  c.fillStyle = trim; c.fillRect(x - w / 2 - 0.06, y + h - 0.02, w + 0.12, 0.07);
}

/** The south-facing walls of a footprint, with what goes on them. */
function walls(c: CanvasRenderingContext2D, b: Building, P: Pt[], dz: number, door: { x: number; y: number } | null) {
  const [cx, cy] = centroid(P), trim = b.trim ?? "#ffffff";
  // which wall gets the door: the south-facing one right above the door spot
  let doorWall = -1, doorBest = Infinity;
  if (door && b.kind === "house") P.forEach((a, i) => { const q = P[(i + 1) % P.length]; if (q[1] < cy && a[1] < cy) return; const x0 = Math.min(a[0], q[0]), x1 = Math.max(a[0], q[0]); if (door.x > x0 + 0.5 && door.x < x1 - 0.5 && door.y > (a[1] + q[1]) / 2) { const d = door.y - (a[1] + q[1]) / 2; if (d < doorBest) { doorBest = d; doorWall = i; } } });
  P.forEach((a, i) => {
    const q = P[(i + 1) % P.length], dx = q[0] - a[0], dy = q[1] - a[1], L = Math.hypot(dx, dy);
    let nx = dy / L, ny = -dx / L; if (nx * ((a[0] + q[0]) / 2 - cx) + ny * ((a[1] + q[1]) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
    if (ny <= 0.35 || L < 0.05) return;
    const quad: Pt[] = [a, q, [q[0], q[1] - dz], [a[0], a[1] - dz]], ux = dx / L, uy = dy / L;
    c.save(); pathPoly(c, quad); c.fillStyle = b.wall; c.fill(); c.clip();
    c.fillStyle = `rgba(0,0,0,${(0.04 + 0.1 * Math.max(0, nx) + 0.06 * (1 - ny)).toFixed(3)})`; c.fill();
    const bot = Math.max(a[1], q[1]);
    if (b.kind === "porch") {   // an open porch: the shady house wall behind, the front door, white posts and a low rail
      c.fillStyle = tone(b.wall, -0.42); c.fill();
      c.restore();
      const at2 = (s2: number, up: number): Pt => [a[0] + ux * s2, a[1] + uy * s2 - up], hh = dz * 0.92;
      const [dx2, dy2] = at2(L / 2, hh); c.fillStyle = b.trim ?? "#fff"; c.fillRect(dx2 - 0.42, dy2, 0.84, hh); c.fillStyle = "#f6f3ec"; c.fillRect(dx2 - 0.33, dy2 + 0.08, 0.66, hh - 0.08); c.fillStyle = "#6d8aa3"; c.beginPath(); c.arc(dx2, dy2 + hh * 0.25, 0.12, 0, 7); c.fill();
      for (const f of [0.2, 0.8]) { const [wx2, wy2] = at2(L * f, hh * 0.85); windowAt(c, wx2, wy2, Math.min(1.1, L * 0.18), hh * 0.55, b.trim ?? "#fff"); }
      c.fillStyle = b.trim ?? "#fff"; const posts = Math.max(2, Math.round(L / 1.7)) + 1;
      for (let k = 0; k < posts; k++) { const [px2, py2] = at2((L * k) / (posts - 1) * 0.96 + L * 0.02, dz); c.fillRect(px2 - 0.07, py2, 0.14, dz); }
      c.fillStyle = b.trim ?? "#fff"; for (const [s0, s1] of [[0.02, 0.4], [0.6, 0.98]]) { const [p0x, p0y] = at2(L * s0, dz * 0.38), [p1x] = at2(L * s1, 0); c.fillRect(Math.min(p0x, p1x), p0y, Math.abs(p1x - p0x), 0.06); }
      const [sx2, sy2] = at2(L / 2, 0); for (let k = 0; k < 2; k++) { c.fillStyle = k ? "#c9c2b5" : "#ddd6c8"; c.fillRect(sx2 - 0.7 - k * 0.1, sy2 + k * 0.22, 1.4 + k * 0.2, 0.24); c.strokeStyle = INK; c.lineWidth = 0.03; c.strokeRect(sx2 - 0.7 - k * 0.1, sy2 + k * 0.22, 1.4 + k * 0.2, 0.24); }
      c.strokeStyle = INK; c.lineWidth = 0.06; pathPoly(c, quad); c.stroke();
      return;
    }
    if (b.kind === "house") {   // lap siding
      c.lineWidth = 0.025;
      for (let s = 0.18; s < dz; s += 0.18) { c.strokeStyle = "rgba(110,90,60,0.22)"; c.beginPath(); c.moveTo(a[0], a[1] - s); c.lineTo(q[0], q[1] - s); c.stroke(); c.strokeStyle = "rgba(255,255,255,0.25)"; c.beginPath(); c.moveTo(a[0], a[1] - s + 0.03); c.lineTo(q[0], q[1] - s + 0.03); c.stroke(); }
      c.fillStyle = "#b8b0a2"; pathPoly(c, [a, q, [q[0], q[1] - 0.14], [a[0], a[1] - 0.14]]); c.fill();   // the foundation
    } else {   // vertical boards
      c.lineWidth = 0.03; c.strokeStyle = "rgba(0,0,0,0.16)";
      for (let s = 0.3; s < L; s += 0.3) { c.beginPath(); c.moveTo(a[0] + ux * s, a[1] + uy * s); c.lineTo(a[0] + ux * s, a[1] + uy * s - dz); c.stroke(); }
      c.strokeStyle = "rgba(255,255,255,0.1)"; for (let s = 0.34; s < L; s += 0.3) { c.beginPath(); c.moveTo(a[0] + ux * s, a[1] + uy * s); c.lineTo(a[0] + ux * s, a[1] + uy * s - dz); c.stroke(); }
    }
    // the roof's shadow along the top of the wall
    const g = c.createLinearGradient(0, bot - dz, 0, bot - dz + Math.min(0.45, dz * 0.4)); g.addColorStop(0, "rgba(30,20,10,0.38)"); g.addColorStop(1, "rgba(30,20,10,0)"); c.fillStyle = g; c.fillRect(Math.min(a[0], q[0]) - 1, bot - dz - 1, L + 2, dz + 2);
    c.restore();
    const at = (s: number, up: number): Pt => [a[0] + ux * s, a[1] + uy * s - up];
    if (b.kind === "house") {
      let doorS = -1;
      if (i === doorWall && door) doorS = clampN((door.x - a[0]) / (ux || 1e-6), 0.6, L - 0.6);
      const n = Math.max(1, Math.floor(L / 1.5)), rows = dz > 1.6 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const s = (L / n) * (k + 0.5); if (doorS >= 0 && Math.abs(s - doorS) < 0.85) continue;
        for (let r = 0; r < rows; r++) { const [wx, wy] = at(s, rows === 2 ? dz * (0.42 + r * 0.42) : dz * 0.78); windowAt(c, wx, wy, 0.62, rows === 2 ? dz * 0.3 : dz * 0.5, trim); }
      }
      if (doorS >= 0) {
        const [wx, wy] = at(doorS, Math.min(dz * 0.8, 1.3)), hh = Math.min(dz * 0.8, 1.3);
        c.fillStyle = trim; c.fillRect(wx - 0.38, wy, 0.76, hh); c.fillStyle = "#f6f3ec"; c.fillRect(wx - 0.3, wy + 0.07, 0.6, hh - 0.07);
        c.fillStyle = "#6d8aa3"; c.fillRect(wx - 0.18, wy + 0.14, 0.36, hh * 0.32); c.fillStyle = "#c9a227"; c.beginPath(); c.arc(wx + 0.2, wy + hh * 0.6, 0.035, 0, 7); c.fill();
      }
    } else if (b.kind === "barn" || b.kind === "garage") {
      // a big sliding door toward the east end (the lean-to covers the middle) and a small window to the west
      const east = a[0] > q[0] ? 0 : L, s = Math.abs(east - L * 0.24), dw = Math.min(L * 0.3, 2.8), hh = dz * 0.86, [wx, wy] = at(s, hh);
      c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(wx - dw / 2, wy, dw, hh);
      c.strokeStyle = trim; c.lineWidth = 0.13; c.strokeRect(wx - dw / 2, wy, dw, hh);
      c.beginPath(); c.moveTo(wx - dw / 2, wy); c.lineTo(wx, wy + hh); c.lineTo(wx + dw / 2, wy); c.moveTo(wx - dw / 2, wy + hh); c.lineTo(wx, wy); c.lineTo(wx + dw / 2, wy + hh); c.moveTo(wx, wy); c.lineTo(wx, wy + hh); c.stroke();
      c.fillStyle = "#3a3d42"; c.fillRect(wx - dw / 2 - 0.1, wy - 0.12, dw + 0.2, 0.07);   // the door track
      const [vx, vy] = at(Math.abs(L - east - L * 0.12), dz * 0.75); windowAt(c, vx, vy, 0.6, dz * 0.4, trim);
    } else if (b.kind === "shed") {
      const d0 = at(L * 0.5 - 0.4, 0), d1 = at(L * 0.5 + 0.4, 0), hh = dz * 0.82, dq: Pt[] = [d0, d1, [d1[0], d1[1] - hh], [d0[0], d0[1] - hh]];
      pathPoly(c, dq); c.fillStyle = tone(b.wall, -0.25); c.fill(); c.strokeStyle = trim; c.lineWidth = 0.07; c.stroke();
    }
    // corner boards and a soft dark edge
    if (b.kind !== "other") { c.fillStyle = trim; for (const s of [0.05, L - 0.05]) { const [px, py] = at(s, 0); c.fillRect(px - 0.06, py - dz, 0.12, dz); } }
    c.strokeStyle = INK; c.lineWidth = 0.06; pathPoly(c, quad); c.stroke();
  });
}
const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function drawDeck(c: CanvasRenderingContext2D, b: Building, dz: number, door: { x: number; y: number } | null) {
  const P = b.poly, T = P.map(p => [p[0], p[1] - dz] as Pt), xs = T.map(p => p[0]), ys = T.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), rnd = mulberry32(31);
  // the side face, then the steps down to the door
  c.fillStyle = tone(b.wall, -0.18); pathPoly(c, [P[0], P[1], P[2], P[3]]); c.fill();
  if (door && door.y > y1 && door.x > x0 && door.x < x1) {
    for (let k = 0; k < 2; k++) { const sy = y1 + dz + k * 0.3; c.fillStyle = "rgba(20,30,10,0.18)"; c.fillRect(door.x - 0.62, sy + 0.08, 1.3, 0.3); c.fillStyle = k ? tone(b.roof, -0.08) : b.roof; c.fillRect(door.x - 0.65, sy - 0.02, 1.3, 0.3); c.strokeStyle = INK; c.lineWidth = 0.03; c.strokeRect(door.x - 0.65, sy - 0.02, 1.3, 0.3); }
  }
  c.save(); pathPoly(c, T); c.fillStyle = b.roof; c.fill(); c.clip();
  // boards running east-west with staggered joints, each a slightly different shade
  const bw = 0.15;
  for (let y = y0, j = 0; y < y1; y += bw, j++) {
    let x = x0 - rnd() * 1.6;
    while (x < x1) { const L = 1.6 + rnd() * 1.2, v = rnd(); c.fillStyle = v < 0.33 ? "rgba(255,255,255,0.08)" : v < 0.66 ? "rgba(90,60,30,0.08)" : "rgba(0,0,0,0)"; c.fillRect(x, y, L, bw); c.fillStyle = "rgba(80,55,30,0.35)"; c.fillRect(x + L - 0.012, y, 0.024, bw); x += L; }
    c.fillStyle = "rgba(80,55,30,0.4)"; c.fillRect(x0, y + bw - 0.014, x1 - x0, 0.022);
  }
  // a picture-frame board round the edge
  c.strokeStyle = tone(b.roof, -0.12); c.lineWidth = 0.3; pathPoly(c, T); c.stroke();
  c.restore();
  c.strokeStyle = INK; c.lineWidth = 0.06; pathPoly(c, T); c.stroke();
}

/** A flat-ish roof: the porch roof (shingled) or a lean-to (metal), sloping away along its short side. */
function flatRoof(c: CanvasRenderingContext2D, b: Building, T: Pt[]) {
  const metal = b.kind !== "porch", R = outset(T, 0.12);
  const [p0, p1, p2, p3] = dist(R[0], R[1]) >= dist(R[1], R[2]) ? [R[0], R[1], R[2], R[3]] : [R[1], R[2], R[3], R[0]];
  // the high edge is the long side nearer the bigger building it leans on; we just use the southern one
  const hiFirst = (p0[1] + p1[1]) > (p2[1] + p3[1]);
  const r0 = hiFirst ? p0 : p3, r1 = hiFirst ? p1 : p2;
  roofSlope(c, R, r0, r1, b.roof, metal, 77);
  edge(c, R, b.trim ?? null);
}

/** The front gable: a steep cross gable from the eave up to the main ridge, with white bargeboards. */
function frontGable(c: CanvasRenderingContext2D, b: Building, G: Pt[]) {
  if (G[2][1] < G[0][1] - 0.1) { gableFace(c, b, G); return; }
  const [l0, r0, apex] = G, m0 = mid(l0, r0), dx = m0[0] - apex[0], dy = m0[1] - apex[1], L = Math.hypot(dx, dy) || 1, ov = 0.22;
  const l: Pt = [l0[0] + (dx / L) * ov, l0[1] + (dy / L) * ov], r: Pt = [r0[0] + (dx / L) * ov, r0[1] + (dy / L) * ov], m: Pt = [m0[0] + (dx / L) * ov, m0[1] + (dy / L) * ov];
  // a soft shadow where it sits on the main roof
  c.fillStyle = "rgba(0,0,0,0.18)"; pathPoly(c, [[r[0] + 0.25, r[1]], [apex[0] + 0.3, apex[1] + 0.1], [m[0] + 0.1, m[1]]]); c.fill();
  roofSlope(c, [l, m, apex], m, apex, b.roof, false, 91);
  roofSlope(c, [m, r, apex], m, apex, b.roof, false, 92);
  c.lineCap = "round"; c.strokeStyle = "rgba(0,0,0,0.3)"; c.lineWidth = 0.2; c.beginPath(); c.moveTo(m[0], m[1]); c.lineTo(apex[0], apex[1]); c.stroke();
  c.strokeStyle = tone(b.roof, 0.12); c.lineWidth = 0.13; c.stroke();
  c.strokeStyle = INK; c.lineWidth = 0.19; c.beginPath(); c.moveTo(l[0], l[1]); c.lineTo(apex[0], apex[1]); c.lineTo(r[0], r[1]); c.stroke();
  c.strokeStyle = b.trim ?? "#fff"; c.lineWidth = 0.11; c.stroke();
  // the little white peak trim at the eave end
  c.fillStyle = b.trim ?? "#fff"; c.beginPath(); c.moveTo(m[0] - 0.22, m[1]); c.lineTo(m[0], m[1] - 0.32); c.lineTo(m[0] + 0.22, m[1]); c.closePath(); c.fill(); c.strokeStyle = INK; c.lineWidth = 0.03; c.stroke();
}

/** A front gable turned toward the viewer (the title screen): its end wall shows, beige with a tall window, under
 *  white bargeboards, and its two small roof slopes run back to the main ridge. */
function gableFace(c: CanvasRenderingContext2D, b: Building, G: Pt[]) {
  const [l0, r0, apexP] = G, m = mid(l0, r0), wd = dist(l0, r0), gh = Math.min(wd * 0.8, Math.abs(m[1] - apexP[1]) * 0.85), trim = b.trim ?? "#fff";
  const l: Pt = [l0[0] - (l0[0] < r0[0] ? 0.2 : -0.2), l0[1] + 0.06], r: Pt = [r0[0] + (l0[0] < r0[0] ? 0.2 : -0.2), r0[1] + 0.06], peak: Pt = [m[0], m[1] - gh];
  roofSlope(c, [l, peak, apexP], peak, apexP, b.roof, false, 93);
  roofSlope(c, [peak, r, apexP], peak, apexP, b.roof, false, 94);
  c.strokeStyle = "rgba(0,0,0,0.3)"; c.lineWidth = 0.18; c.beginPath(); c.moveTo(peak[0], peak[1]); c.lineTo(apexP[0], apexP[1]); c.stroke(); c.strokeStyle = tone(b.roof, 0.12); c.lineWidth = 0.11; c.stroke();
  // the end wall: siding, a tall window with a little arch, the white trim
  const face: Pt[] = [[l[0] + (l0[0] < r0[0] ? 0.25 : -0.25), l[1]], [r[0] - (l0[0] < r0[0] ? 0.25 : -0.25), r[1]], [peak[0], peak[1] + 0.25]];
  c.save(); pathPoly(c, face); c.fillStyle = b.wall; c.fill(); c.clip();
  c.lineWidth = 0.025; for (let y = m[1]; y > peak[1]; y -= 0.18) { c.strokeStyle = "rgba(110,90,60,0.22)"; c.beginPath(); c.moveTo(m[0] - wd, y); c.lineTo(m[0] + wd, y); c.stroke(); }
  const g = c.createLinearGradient(0, peak[1], 0, m[1]); g.addColorStop(0, "rgba(40,25,10,0.3)"); g.addColorStop(0.4, "rgba(40,25,10,0)"); c.fillStyle = g; c.fill();
  c.restore();
  const ww = Math.min(0.72, wd * 0.24), wh = gh * 0.42; windowAt(c, m[0], m[1] - wh - gh * 0.12, ww, wh, trim);
  c.fillStyle = trim; c.beginPath(); c.arc(m[0], m[1] - wh - gh * 0.12, ww / 2 + 0.06, Math.PI, 0); c.fill();
  c.fillStyle = "#5b7890"; c.beginPath(); c.arc(m[0], m[1] - wh - gh * 0.12, ww / 2 - 0.02, Math.PI, 0); c.fill();
  c.lineJoin = "round"; c.strokeStyle = INK; c.lineWidth = 0.24; c.beginPath(); c.moveTo(l[0], l[1]); c.lineTo(peak[0], peak[1]); c.lineTo(r[0], r[1]); c.stroke();
  c.strokeStyle = trim; c.lineWidth = 0.15; c.stroke();
  // the gingerbread trim under the peak
  c.strokeStyle = trim; c.lineWidth = 0.05; c.beginPath(); c.moveTo(peak[0] - 0.42, peak[1] + 0.42); c.quadraticCurveTo(peak[0], peak[1] + 0.2, peak[0] + 0.42, peak[1] + 0.42); c.moveTo(peak[0], peak[1] + 0.08); c.lineTo(peak[0], peak[1] + 0.55); c.stroke();
  c.fillStyle = trim; c.beginPath(); c.arc(peak[0], peak[1] + 0.6, 0.06, 0, 7); c.fill();
}

function chimney(c: CanvasRenderingContext2D, x: number, y: number) {
  const s = 0.62, hgt = 0.5;
  c.fillStyle = "rgba(0,0,0,0.22)"; c.fillRect(x - s / 2 + 0.3, y - hgt - s / 2 + 0.35, s + 0.1, s + hgt);
  c.fillStyle = "#8f4f3b"; c.fillRect(x - s / 2, y - hgt + s / 2, s, hgt);   // the south face
  c.strokeStyle = "rgba(60,25,15,0.4)"; c.lineWidth = 0.02; for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x - s / 2, y - hgt + s / 2 + (hgt * k) / 4); c.lineTo(x + s / 2, y - hgt + s / 2 + (hgt * k) / 4); c.stroke(); }
  c.fillStyle = "#a95f47"; c.fillRect(x - s / 2, y - hgt - s / 2, s, s);   // the top
  c.fillStyle = "#6b6f74"; c.fillRect(x - s / 2 - 0.05, y - hgt - s / 2 - 0.05, s + 0.1, s + 0.1); c.fillStyle = "#2a2422"; c.fillRect(x - 0.14, y - hgt - 0.14, 0.28, 0.28);
  c.strokeStyle = INK; c.lineWidth = 0.04; c.strokeRect(x - s / 2 - 0.05, y - hgt - s / 2 - 0.05, s + 0.1, s + 0.1); c.strokeRect(x - s / 2, y - hgt + s / 2, s, hgt);
}

/** The soft drop shadow a building throws down and to the right (drawn on the ground first). */
export function buildingShadow(c: CanvasRenderingContext2D, b: Building, obl = OBL) {
  const h = b.kind === "deck" ? 0.6 : b.height, ox = h * 0.24 + 0.15, oy = h * 0.2 + 0.15 - h * obl * 0.5;
  c.save();
  for (const [pad, a] of [[0.35, 0.07], [0.12, 0.13]] as const) { const base = outset(b.poly, pad); pathPoly(c, hull([...base, ...base.map(p => [p[0] + ox, p[1] + oy] as Pt)])); c.fillStyle = `rgba(20,40,10,${a})`; c.fill(); }
  c.restore();
}
/** The convex hull of some points (Andrew's monotone chain). */
function hull(pts: Pt[]): Pt[] {
  const P = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [], hi: Pt[] = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

/** Any building, in world units. `obl` is how much wall shows (the title screen shows a little more). */
export function drawBuilding(c: CanvasRenderingContext2D, b: Building, alpha: number, door: { x: number; y: number } | null, obl = OBL) {
  const dz = b.height * obl, P = b.poly, lift = (ps: Pt[]) => ps.map(p => [p[0], p[1] - dz] as Pt), T = lift(P);
  c.save(); c.globalAlpha *= alpha; c.lineJoin = "round"; c.lineCap = "round";
  if (b.kind === "deck") { drawDeck(c, b, dz, door); c.restore(); return; }
  walls(c, b, P, dz, door);
  const metal = b.kind === "barn" || b.kind === "shed" || b.kind === "garage" || b.kind === "other";
  if (b.flat || b.kind === "porch") flatRoof(c, b, T);
  else if (b.wings?.length) {
    b.wings.forEach((wg, i) => gableRoof(c, outset(lift(wg), 0.2), b.roof, metal, b.trim ?? "#fff", 50 + i * 7));
    if (b.frontGable) frontGable(c, b, lift(b.frontGable));
    if (b.chimney) chimney(c, b.chimney[0], b.chimney[1] - dz);
  } else if (T.length === 4) {
    gableRoof(c, outset(T, metal ? 0.16 : 0.2), b.roof, metal, b.trim ?? "#fff", 40);
    if (b.frontGable) frontGable(c, b, lift(b.frontGable));
  } else { c.fillStyle = b.roof; pathPoly(c, T); c.fill(); edge(c, T, b.trim ?? null); }
  c.restore();
}

/** A building drawn once into its own canvas (`px` pixels a metre), for drawing fast every frame. */
export function bakeBuilding(b: Building, door: { x: number; y: number } | null, px: number) {
  const pad = 1.6, xs = b.poly.map(p => p[0]), ys = b.poly.map(p => p[1]);
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad - b.height * OBL, x1 = Math.max(...xs) + pad, y1 = Math.max(...ys) + pad + 1;
  const cv = document.createElement("canvas"); cv.width = Math.ceil((x1 - x0) * px); cv.height = Math.ceil((y1 - y0) * px);
  const c = cv.getContext("2d")!; c.scale(px, px); c.translate(-x0, -y0); drawBuilding(c, b, 1, door);
  return { cv, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}


export type Paint = { body: string; hood: string; trim: string };
/** Pat on the lawn tractor, life size. Local frame: +x forward, +y to Pat's right. `deckHalf` is half the cut width. */
export type MowerExtras = { head?: number; wave?: number };
/** Pat on the tractor. `head` scales Pat's head (bigger reads better small); `wave` (0..1) raises his left hand for a wave. */
export function drawMower(c: CanvasRenderingContext2D, x: number, y: number, h: number, steer: number, odo: number, time: number, running: boolean, deckHalf: number, paint: Paint, bagger: boolean, lights: boolean, ex: MowerExtras = {}) {
  c.save();
  // soft shadow down and to the right
  c.fillStyle = "rgba(20,40,10,0.22)"; c.beginPath(); c.ellipse(x + 0.28, y + 0.34, 1.12, Math.max(0.8, deckHalf * 0.55), h, 0, 7); c.fill();
  c.translate(x, y); c.rotate(h);
  const rr = (x0: number, y0: number, w: number, hh: number, r: number) => { c.beginPath(); c.roundRect(x0, y0, w, hh, r); };
  const buzz = running ? Math.sin(time * 90) * 0.006 : 0;
  // the wing deck: a centre deck under the tractor and a wing each side, hinged, with little gauge wheels
  const wl = -0.3, wlen = 0.74;
  // the discharge chute out the right-hand end
  c.fillStyle = "#2a2d31"; c.beginPath(); c.moveTo(wl + 0.12, deckHalf - 0.05); c.lineTo(wl + 0.06, deckHalf + 0.2); c.lineTo(wl + 0.5, deckHalf + 0.2); c.lineTo(wl + 0.46, deckHalf - 0.05); c.closePath(); c.fill();
  c.fillStyle = "#24272b"; rr(wl - 0.035, -deckHalf - 0.035, wlen + 0.07, deckHalf * 2 + 0.07, 0.34); c.fill();
  const dg = c.createLinearGradient(wl + wlen, 0, wl, 0); dg.addColorStop(0, "#666d75"); dg.addColorStop(0.35, "#50565d"); dg.addColorStop(1, "#3e4348");
  c.fillStyle = dg; rr(wl, -deckHalf, wlen, deckHalf * 2, 0.3); c.fill();
  c.fillStyle = "rgba(255,255,255,0.13)"; rr(wl + wlen * 0.55, -deckHalf + 0.1, wlen * 0.32, deckHalf * 2 - 0.2, 0.12); c.fill();
  c.strokeStyle = "#24272a"; c.lineWidth = 0.035; c.beginPath(); c.moveTo(wl, -0.62); c.lineTo(wl + wlen, -0.62); c.moveTo(wl, 0.62); c.lineTo(wl + wlen, 0.62); c.stroke();
  c.fillStyle = "#6d7278"; for (const s of [-1, 1]) for (const f of [0.18, 0.32 + (deckHalf - 0.62) * 0.5]) { c.beginPath(); c.arc(wl + wlen * 0.5, s * (0.62 + Math.min(f, deckHalf - 0.75)), 0.06, 0, 7); c.fill(); }
  c.fillStyle = "#151515"; for (const s of [-1, 1]) { rr(wl + wlen - 0.02, s * (deckHalf - 0.12) - 0.05, 0.14, 0.1, 0.03); c.fill(); }
  // wheels: big rear, small front that steer; treads roll with distance; grey hubs
  const wheel = (cx: number, cy: number, lw: number, ww: number, a: number) => {
    c.save(); c.translate(cx, cy); c.rotate(a);
    c.fillStyle = "#141414"; rr(-lw / 2, -ww / 2, lw, ww, 0.06); c.fill();
    c.strokeStyle = "#3a3a3a"; c.lineWidth = 0.03; const sp = 0.09, off = ((odo % sp) + sp) % sp;
    c.save(); rr(-lw / 2, -ww / 2, lw, ww, 0.06); c.clip(); for (let s = -lw / 2 - sp + off; s < lw / 2 + sp; s += sp) { c.beginPath(); c.moveTo(s, -ww / 2); c.lineTo(s, ww / 2); c.stroke(); } c.restore();
    c.fillStyle = "#9a9ea3"; rr(-lw * 0.2, -ww * 0.22, lw * 0.4, ww * 0.44, 0.03); c.fill();
    c.restore();
  };
  wheel(-0.56, -0.5, 0.56, 0.25, 0); wheel(-0.56, 0.5, 0.56, 0.25, 0);
  wheel(0.74, -0.4, 0.32, 0.15, steer); wheel(0.74, 0.4, 0.32, 0.15, steer);
  c.translate(0, buzz);
  // the bagger: a canvas bag on a frame behind the seat, fed by a tube from the deck
  if (bagger) {
    c.strokeStyle = "#5d6166"; c.lineWidth = 0.13; c.lineCap = "round"; c.beginPath(); c.moveTo(0.05, 0.62); c.quadraticCurveTo(-0.5, 0.7, -0.92, 0.32); c.stroke();
    c.fillStyle = "#2f4a2c"; rr(-1.34, -0.46, 0.5, 0.92, 0.12); c.fill();
    c.fillStyle = "#3f6a3a"; rr(-1.3, -0.4, 0.42, 0.8, 0.1); c.fill();
    c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 0.02; for (const k of [-0.2, 0, 0.2]) { c.beginPath(); c.moveTo(-1.3, k); c.lineTo(-0.88, k); c.stroke(); }
  }
  // running boards and the rear body round the seat
  c.fillStyle = "#222"; rr(-0.1, -0.42, 0.46, 0.84, 0.06); c.fill();
  c.fillStyle = paint.body; rr(-0.86, -0.44, 0.8, 0.88, 0.2); c.fill();
  c.strokeStyle = paint.trim; c.lineWidth = 0.04; c.stroke();
  c.fillStyle = "rgba(255,255,255,0.16)"; rr(-0.8, -0.38, 0.3, 0.76, 0.12); c.fill();
  c.fillStyle = "#1e1e1e"; c.fillRect(-0.86, -0.3, 0.07, 0.6);
  // the long rounded hood sloping to the nose: grille and headlights
  c.beginPath(); c.moveTo(0.22, -0.31); c.lineTo(0.94, -0.25); c.quadraticCurveTo(1.12, -0.23, 1.12, 0); c.quadraticCurveTo(1.12, 0.23, 0.94, 0.25); c.lineTo(0.22, 0.31); c.closePath();
  c.fillStyle = paint.hood; c.fill(); c.strokeStyle = paint.trim; c.stroke();
  const g = c.createLinearGradient(0, -0.3, 0, 0.3); g.addColorStop(0, "rgba(255,255,255,0.28)"); g.addColorStop(0.45, "rgba(255,255,255,0.02)"); g.addColorStop(1, "rgba(0,0,0,0.14)");
  c.fillStyle = g; c.fill();
  c.fillStyle = "rgba(0,0,0,0.18)"; c.fillRect(0.32, -0.02, 0.66, 0.04);
  c.fillStyle = "#1a1a1a"; rr(1.04, -0.15, 0.08, 0.3, 0.03); c.fill();
  c.fillStyle = lights ? "#fffbe0" : "#f6f0cf"; c.beginPath(); c.arc(1.06, -0.19, 0.045, 0, 7); c.arc(1.06, 0.19, 0.045, 0, 7); c.fill();
  // dash and the black steering wheel just in front of the seat
  c.fillStyle = "#2a2a2a"; rr(0.12, -0.22, 0.12, 0.44, 0.04); c.fill();
  c.strokeStyle = "#151515"; c.lineWidth = 0.05; c.beginPath(); c.arc(0.08, 0, 0.15, 0, 7); c.stroke();
  c.save(); c.translate(0.08, 0); c.rotate(steer * 1.6); c.beginPath(); c.moveTo(-0.15, 0); c.lineTo(0.15, 0); c.stroke(); c.restore();
  // the black seat
  c.fillStyle = "#1b1b1b"; rr(-0.66, -0.26, 0.42, 0.52, 0.1); c.fill();
  c.fillStyle = "#2b2b2b"; rr(-0.77, -0.28, 0.12, 0.56, 0.05); c.fill();
  // Pat: legs to the running boards, arms to the wheel, shirt, head with brown hair going grey
  c.fillStyle = "#3d5378"; rr(-0.36, -0.2, 0.5, 0.13, 0.05); c.fill(); rr(-0.36, 0.07, 0.5, 0.13, 0.05); c.fill();
  c.fillStyle = "#3a2f28"; rr(0.12, -0.21, 0.1, 0.12, 0.03); c.fill(); rr(0.12, 0.09, 0.1, 0.12, 0.03); c.fill();
  const SKIN = "#efc6a2", wave = ex.wave ?? 0, hk = ex.head ?? 1.15;
  c.strokeStyle = SKIN; c.lineWidth = 0.075; c.lineCap = "round";
  const sa = steer * 0.12;
  c.beginPath(); c.moveTo(-0.42, 0.21); c.lineTo(0.03, 0.13 + sa); c.stroke();
  if (wave > 0) {   // the left arm up and out, the hand going side to side
    const wv = Math.sin(time * 11) * 0.09 * wave, hx = -0.36 + 0.1 * wave, hy = -0.21 - 0.42 * wave;
    c.strokeStyle = "#4e7aa6"; c.lineWidth = 0.1; c.beginPath(); c.moveTo(-0.44, -0.2); c.lineTo(-0.42 + (hx + 0.42) * 0.35, -0.2 + (hy + 0.2) * 0.35); c.stroke();
    c.strokeStyle = SKIN; c.lineWidth = 0.075; c.beginPath(); c.moveTo(-0.42 + (hx + 0.42) * 0.3, -0.2 + (hy + 0.2) * 0.3); c.lineTo(hx + wv, hy); c.stroke();
    c.fillStyle = SKIN; c.beginPath(); c.arc(hx + wv, hy - 0.02, 0.055, 0, 7); c.fill(); c.strokeStyle = "rgba(120,70,40,0.5)"; c.lineWidth = 0.012; c.stroke();
  } else { c.beginPath(); c.moveTo(-0.42, -0.21); c.lineTo(0.03, -0.13 + sa); c.stroke(); }
  c.fillStyle = "#4e7aa6"; c.beginPath(); c.ellipse(-0.46, 0, 0.15, 0.25, 0, 0, 7); c.fill();
  c.fillStyle = "rgba(255,255,255,0.15)"; c.beginPath(); c.ellipse(-0.5, -0.06, 0.08, 0.12, 0, 0, 7); c.fill();
  c.strokeStyle = "rgba(30,50,80,0.45)"; c.lineWidth = 0.02; c.beginPath(); c.ellipse(-0.46, 0, 0.15, 0.25, 0, 0, 7); c.stroke();
  // the head: a little big, like a toy, with brown hair going salt-and-pepper grey; clean shaven
  c.save(); c.translate(-0.44, 0); c.scale(hk, hk);
  c.fillStyle = "rgba(40,20,10,0.18)"; c.beginPath(); c.arc(0.02, 0.02, 0.125, 0, 7); c.fill();
  c.fillStyle = SKIN; c.beginPath(); c.arc(0.01, 0, 0.12, 0, 7); c.fill();
  c.beginPath(); c.ellipse(0, -0.12, 0.03, 0.024, 0, 0, 7); c.ellipse(0, 0.12, 0.03, 0.024, 0, 0, 7); c.fill();
  c.fillStyle = "#e3ad86"; c.beginPath(); c.ellipse(0.125, 0, 0.022, 0.026, 0, 0, 7); c.fill();   // the nose, just showing
  c.fillStyle = "#6b4a32"; c.beginPath(); c.ellipse(-0.02, 0, 0.112, 0.116, 0, 0, 7); c.fill();
  c.fillStyle = "#7d5a3f"; c.beginPath(); c.ellipse(-0.035, -0.035, 0.06, 0.05, 0.4, 0, 7); c.fill();
  c.fillStyle = "#b5aca2"; for (const [gx, gy] of [[-0.06, -0.06], [-0.03, 0.06], [-0.09, 0.01], [0.02, -0.08], [0.04, 0.07], [-0.1, -0.04], [-0.07, 0.08], [0.0, 0.0], [-0.04, -0.09]]) { c.beginPath(); c.arc(gx, gy, 0.019, 0, 7); c.fill(); }
  c.fillStyle = "#8f877e"; for (const [gx, gy] of [[0.06, -0.09], [0.06, 0.09]]) { c.beginPath(); c.ellipse(gx, gy, 0.03, 0.018, 0, 0, 7); c.fill(); }   // grey at the temples
  c.strokeStyle = "rgba(60,35,20,0.45)"; c.lineWidth = 0.014; c.beginPath(); c.arc(0.01, 0, 0.12, 0, 7); c.stroke();
  c.restore();
  c.restore();
}

export type CatPose = { x: number; y: number; h: number; act: "walk" | "sit" | "lick" | "idle" | "nap" | "run"; phase: number };
const CAT = { fur: "#9aa0a8", light: "#b4b9c0", dark: "#8a9098", pink: "#f2b4be", eye: "#7cc35a", paw: "#f3f3f1", line: "rgba(38,42,52,0.7)" };
/** A tapered tail through the given points, thick at the base. */
function tail(c: CanvasRenderingContext2D, pts: Pt[], w0: number, w1: number) {
  c.lineCap = "round";
  for (const [col, extra] of [[CAT.line, 0.022], [CAT.fur, 0]] as const) {
    c.strokeStyle = col;
    for (let i = 1; i < pts.length; i++) { c.lineWidth = w0 + (w1 - w0) * (i / (pts.length - 1)) + extra; c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke(); }
  }
}
/** Fills the current path in fur with the cat's soft dark outline. */
function furFill(c: CanvasRenderingContext2D, col: string = CAT.fur) { c.strokeStyle = CAT.line; c.lineWidth = 0.022; c.stroke(); c.fillStyle = col; c.fill(); }
function catHead(c: CanvasRenderingContext2D, hx: number, hy: number, ang: number, eyes: "open" | "closed", earsBack = 0) {
  c.save(); c.translate(hx, hy); c.rotate(ang);
  for (const s of [-1, 1]) {   // ears: grey triangles, pink inside
    c.beginPath(); c.moveTo(-0.035 - earsBack, s * 0.035); c.lineTo(-0.06 - earsBack * 1.5, s * 0.12); c.lineTo(0.03, s * 0.075); c.closePath(); furFill(c);
    c.fillStyle = CAT.pink; c.beginPath(); c.moveTo(-0.025 - earsBack, s * 0.05); c.lineTo(-0.045 - earsBack * 1.4, s * 0.1); c.lineTo(0.012, s * 0.072); c.closePath(); c.fill();
  }
  c.beginPath(); c.ellipse(0, 0, 0.095, 0.09, 0, 0, 7); furFill(c);
  c.fillStyle = CAT.light; c.beginPath(); c.ellipse(0.055, 0, 0.035, 0.04, 0, 0, 7); c.fill();
  c.fillStyle = CAT.pink; c.beginPath(); c.arc(0.085, 0, 0.011, 0, 7); c.fill();
  if (eyes === "open") {
    for (const s of [-1, 1]) { c.fillStyle = CAT.eye; c.beginPath(); c.ellipse(0.04, s * 0.034, 0.016, 0.012, s * 0.4, 0, 7); c.fill(); c.fillStyle = "#1d2a16"; c.beginPath(); c.ellipse(0.042, s * 0.034, 0.005, 0.01, 0, 0, 7); c.fill(); }
  } else { c.strokeStyle = "#5b6067"; c.lineWidth = 0.008; for (const s of [-1, 1]) { c.beginPath(); c.arc(0.04, s * 0.034, 0.014, 0.3, 2.8); c.stroke(); } }
  c.restore();
}
/** The grey housecat from above: oval body, round head with ears, long tapering tail that sways. */
export function drawCat(c: CanvasRenderingContext2D, cat: CatPose, time: number, S = 2.0, halo = true) {
  c.save(); c.translate(cat.x, cat.y);
  if (halo) {   // a soft light pool under her so she reads on the grass at phone size
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 0.42 * S); g.addColorStop(0, "rgba(255,255,240,0.38)"); g.addColorStop(0.6, "rgba(255,255,240,0.16)"); g.addColorStop(1, "rgba(255,255,240,0)");
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 0.42 * S, 0, 7); c.fill();
  }
  c.fillStyle = "rgba(20,40,10,0.18)"; c.beginPath(); c.ellipse(0.12, 0.14, 0.24 * S, 0.12 * S, cat.h, 0, 7); c.fill();
  c.rotate(cat.h); c.scale(S, S);
  const t = time + cat.phase, act = cat.act;
  if (act === "nap") {   // curled up: a round grey ball, tail wrapped round the front, head tucked, eyes shut
    const br = 0.15 + Math.sin(t * 1.5) * 0.004;
    c.beginPath(); c.arc(-0.01, 0, br, 0, 7); furFill(c);
    c.fillStyle = CAT.light; c.beginPath(); c.arc(-0.04, -0.03, br * 0.55, 0, 7); c.fill();
    const tp: Pt[] = []; for (let i = 0; i <= 8; i++) { const a = 0.4 + i * 0.3; tp.push([Math.cos(a) * (br + 0.015), Math.sin(a) * (br + 0.015)]); }
    tail(c, tp, 0.05, 0.03);
    c.fillStyle = CAT.paw; c.beginPath(); c.ellipse(0.11, 0.07, 0.03, 0.022, 0.5, 0, 7); c.fill();
    catHead(c, 0.1, -0.05, 0.6, "closed");
    c.restore(); return;
  }
  if (act === "sit" || act === "lick" || act === "idle") {   // sitting: round haunches, chest, tail curled round the paws
    const sw = Math.sin(t * 1.3) * 0.03;
    tail(c, [[-0.13, 0.06], [-0.12, 0.15], [-0.04, 0.2], [0.06, 0.19 + sw * 0.3], [0.13, 0.15 + sw]], 0.05, 0.025);
    c.beginPath(); c.ellipse(-0.05, 0, 0.13, 0.12, 0, 0, 7); c.ellipse(0.05, 0, 0.08, 0.075, 0, 0, 7); furFill(c);
    c.fillStyle = CAT.fur; c.beginPath(); c.ellipse(-0.05, 0, 0.12, 0.11, 0, 0, 7); c.ellipse(0.05, 0, 0.07, 0.065, 0, 0, 7); c.fill();
    c.fillStyle = CAT.light; c.beginPath(); c.ellipse(-0.06, -0.02, 0.07, 0.05, 0, 0, 7); c.fill();
    c.fillStyle = CAT.paw; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(0.13, s * 0.035, 0.025, 0.018, 0, 0, 7); c.fill(); }
    if (act === "lick") {
      const bob = Math.sin(t * 7) * 0.01;
      c.fillStyle = CAT.paw; c.beginPath(); c.ellipse(0.11, 0.05 + bob, 0.024, 0.02, 0, 0, 7); c.fill();
      catHead(c, 0.09, 0.04 + bob, 0.7, "closed");
    } else catHead(c, 0.1, 0, Math.sin(t * 0.7) * 0.25, "open");
    c.restore(); return;
  }
  // walking or running: body sways, paws step, tail swishes
  const run = act === "run", f = run ? 14 : 6.5, ph = Math.sin(t * f), sway = ph * (run ? 0.008 : 0.014);
  const L = run ? 0.25 : 0.21;
  const tw = Math.sin(t * (run ? 6 : 2.4)) * (run ? 0.03 : 0.1);
  tail(c, run ? [[-L, 0], [-L - 0.12, tw * 0.5], [-L - 0.24, tw], [-L - 0.33, tw * 1.3]] : [[-L, 0], [-L - 0.1, tw * 0.6], [-L - 0.2, tw * 1.3], [-L - 0.28, tw * 0.6 + 0.04]], 0.05, 0.022);
  c.fillStyle = CAT.paw;
  for (const [px, py, s] of [[0.12, -0.075, 1], [0.12, 0.075, -1], [-0.13, -0.075, -1], [-0.13, 0.075, 1]]) { c.beginPath(); c.ellipse(px + ph * s * (run ? 0.06 : 0.035), py * (run ? 1.15 : 1), 0.028, 0.02, 0, 0, 7); c.fill(); }
  c.beginPath(); c.ellipse(-0.01, sway, L, run ? 0.09 : 0.105, 0, 0, 7); furFill(c);
  c.fillStyle = CAT.light; c.beginPath(); c.ellipse(-0.02, sway - 0.01, L * 0.7, 0.035, 0, 0, 7); c.fill();
  c.strokeStyle = CAT.dark; c.lineWidth = 0.012; c.globalAlpha = 0.5;
  for (const k of [-0.1, -0.03, 0.04]) { c.beginPath(); c.moveTo(k, sway - 0.07); c.quadraticCurveTo(k + 0.02, sway, k, sway + 0.07); c.stroke(); }
  c.globalAlpha = 1;
  catHead(c, L + 0.02, -sway * 0.6, -sway * 2, "open", run ? 0.02 : 0);
  c.restore();
}

/** A little person from above: shoulders, arms, head and hair. */
export function drawPerson(c: CanvasRenderingContext2D, x: number, y: number, ang: number, shirt: string, hair: string, skin: string, pose: "sit" | "stand" | "throw", t: number) {
  c.save(); c.translate(x, y); c.scale(1.35, 1.35);
  c.fillStyle = "rgba(20,40,10,0.2)"; c.beginPath(); c.ellipse(0.1, 0.12, 0.3, 0.2, ang, 0, 7); c.fill();
  c.rotate(ang);
  if (pose === "sit") { c.fillStyle = "#3d5378"; c.beginPath(); c.roundRect(-0.05, -0.16, 0.34, 0.12, 0.05); c.roundRect(-0.05, 0.04, 0.34, 0.12, 0.05); c.fill(); }
  const swing = pose === "throw" ? Math.sin(t * 3) * 0.5 : Math.sin(t * 1.3) * 0.05;
  c.strokeStyle = skin; c.lineWidth = 0.07; c.lineCap = "round";
  c.beginPath(); c.moveTo(-0.02, -0.2); c.lineTo(0.18, -0.24 + swing * 0.2); c.moveTo(-0.02, 0.2); c.lineTo(0.2 + Math.max(0, swing) * 0.25, 0.2); c.stroke();
  c.fillStyle = shirt; c.beginPath(); c.ellipse(-0.04, 0, 0.13, 0.23, 0, 0, 7); c.fill();
  c.fillStyle = "rgba(255,255,255,0.15)"; c.beginPath(); c.ellipse(-0.07, -0.06, 0.06, 0.1, 0, 0, 7); c.fill();
  c.fillStyle = skin; c.beginPath(); c.arc(0, 0, 0.1, 0, 7); c.fill();
  c.fillStyle = hair; c.beginPath(); c.ellipse(-0.02, 0, 0.09, 0.095, 0, 0, 7); c.fill();
  c.restore();
}

/** The bonfire: a warm glow and flickering flames (call with c.globalCompositeOperation as normal). */
export function drawFire(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, amount: number) {
  if (amount <= 0) return;
  c.save(); c.translate(x, y);
  const glow = c.createRadialGradient(0, 0, 0, 0, 0, r * 6);
  glow.addColorStop(0, `rgba(255,190,90,${0.45 * amount})`); glow.addColorStop(0.4, `rgba(255,140,50,${0.18 * amount})`); glow.addColorStop(1, "rgba(255,120,40,0)");
  c.fillStyle = glow; c.beginPath(); c.arc(0, 0, r * 6, 0, 7); c.fill();
  for (let i = 0; i < 9; i++) {
    const a = i * 2.3 + t * 0.7, d = r * 0.22 * ((i % 3) / 2), fl = 0.65 + 0.35 * Math.sin(t * (7 + i) + i);
    c.fillStyle = i % 3 === 0 ? `rgba(255,214,90,${0.95 * amount})` : i % 3 === 1 ? `rgba(255,150,40,${0.9 * amount})` : `rgba(235,80,30,${0.85 * amount})`;
    c.beginPath(); c.ellipse(Math.cos(a) * d, Math.sin(a) * d, r * 0.32 * fl, r * 0.26 * fl, a, 0, 7); c.fill();
  }
  c.fillStyle = `rgba(255,248,210,${amount})`; c.beginPath(); c.arc(0, 0, r * 0.14 * (0.8 + 0.2 * Math.sin(t * 11)), 0, 7); c.fill();
  c.restore();
}

export function drawApple(c: CanvasRenderingContext2D, x: number, y: number, t: number, pulse: boolean) {
  const s = 1 + (pulse ? Math.sin(t * 5) * 0.08 : 0);
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = "rgba(20,40,10,0.25)"; c.beginPath(); c.ellipse(0.05, 0.07, 0.17, 0.12, 0, 0, 7); c.fill();
  c.fillStyle = "#c9302a"; c.beginPath(); c.arc(0, 0, 0.16, 0, 7); c.fill();
  c.fillStyle = "#e85146"; c.beginPath(); c.arc(-0.03, -0.03, 0.1, 0, 7); c.fill();
  c.fillStyle = "rgba(255,255,255,0.55)"; c.beginPath(); c.arc(-0.06, -0.06, 0.035, 0, 7); c.fill();
  c.fillStyle = "#4f8f2f"; c.beginPath(); c.ellipse(0.06, -0.13, 0.06, 0.03, -0.6, 0, 7); c.fill();
  c.restore();
}

export function drawPuddle(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number, t: number, rain: number) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = "rgba(60,75,70,0.35)"; c.beginPath(); c.ellipse(0, 0, rx * 1.12, ry * 1.12, 0, 0, 7); c.fill();
  const g = c.createLinearGradient(-rx, -ry, rx, ry); g.addColorStop(0, "rgba(150,180,195,0.85)"); g.addColorStop(0.5, "rgba(95,125,140,0.85)"); g.addColorStop(1, "rgba(120,150,165,0.85)");
  c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, 7); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 0.06; c.beginPath(); c.ellipse(-rx * 0.2, -ry * 0.25, rx * 0.5, ry * 0.35, 0, 3.6, 5.2); c.stroke();
  if (rain > 0) { c.strokeStyle = `rgba(230,240,255,${0.5 * rain})`; c.lineWidth = 0.03; for (let i = 0; i < 5; i++) { const ph = (t * 0.9 + i * 0.37) % 1, px = Math.sin(i * 12.9) * rx * 0.6, py = Math.cos(i * 7.3) * ry * 0.6; c.globalAlpha = 1 - ph; c.beginPath(); c.ellipse(px, py, 0.05 + ph * 0.35, 0.03 + ph * 0.22, 0, 0, 7); c.stroke(); } c.globalAlpha = 1; }
  c.restore();
}
