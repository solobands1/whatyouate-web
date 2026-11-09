// The drawings for Pat's Lawnmower: the yard (drawn once into big canvases), buildings, trees, the tractor, the cat,
// people, the fire, apples and puddles. World units are metres; x east, y south. Light comes from the top left, so
// shadows fall down and to the right.
import type { LawnMap, Pt, Building, Tree, Line, Vehicle, Prop } from "../lawnMap";
import { pip, polyClosest, segClosest, centroid, area, mulberry32 } from "./geo";

export const OBL = 0.2;   // how much wall shows under each roof (a slight 3/4 view)
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
  for (const b of map.buildings) for (let s = 0; s <= 1.001; s += 0.125) { const ox = b.height * 0.2 * s, oy = b.height * 0.24 * s; pathPoly(c, b.poly.map(p => [p[0] + ox + 0.25, p[1] + oy + 0.25] as Pt)); c.fill(); }
  c.fillStyle = "rgba(20,40,10,0.1)";
  for (const t of map.trees) if (t.kind !== "well") { c.beginPath(); c.ellipse(t.x + t.r * 0.22, t.y + t.r * 0.26, t.r * 0.9, t.r * 0.84, 0, 0, 7); c.fill(); }
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
    c.fillStyle = t.kind === "fruit" ? "#47873a" : "#3a7330"; c.beginPath(); c.arc(sway * 0.5, 0, t.r, 0, 7); c.fill();
    for (const [bx, by, br, sh] of blobs) { c.fillStyle = sh < 0.5 ? "#4b8c3a" : "#58a043"; c.beginPath(); c.arc(bx * t.r + sway, by * t.r, br * t.r, 0, 7); c.fill(); }
    c.fillStyle = "rgba(150,210,100,0.35)"; c.beginPath(); c.arc(-t.r * 0.3 + sway, -t.r * 0.32, t.r * 0.42, 0, 7); c.fill();
    if (t.kind === "fruit") { c.fillStyle = "#d8443a"; for (const [bx, by] of blobs) { c.beginPath(); c.arc(bx * t.r * 0.9 + sway, by * t.r * 0.9 + 0.1, 0.09, 0, 7); c.fill(); } }
  }
  c.restore();
}


export function drawBuilding(c: CanvasRenderingContext2D, b: Building, alpha: number, door: { x: number; y: number } | null) {
  const dz = b.height * OBL, P = b.poly, ccw = area(P) > 0;
  c.save(); c.globalAlpha = alpha; c.lineJoin = "round";
  if (b.kind === "deck") {   // a low wooden deck: boards, a darker edge, a little side face
    const T = P.map(p => [p[0], p[1] - dz] as Pt);
    c.fillStyle = b.wall; pathPoly(c, P); c.fill();
    c.fillStyle = b.roof; pathPoly(c, T); c.fill();
    c.save(); pathPoly(c, T); c.clip(); const xs = T.map(p => p[0]), ys = T.map(p => p[1]);
    c.strokeStyle = "rgba(110,80,45,0.35)"; c.lineWidth = 0.03; for (let yy = Math.min(...ys); yy < Math.max(...ys); yy += 0.14) { c.beginPath(); c.moveTo(Math.min(...xs), yy); c.lineTo(Math.max(...xs), yy); c.stroke(); }
    c.restore(); c.strokeStyle = "rgba(110,80,45,0.6)"; c.lineWidth = 0.08; pathPoly(c, T); c.stroke();
    c.restore(); return;
  }
  // south-facing walls (the slight 3/4 view)
  for (let i = 0; i < P.length; i++) {
    const a = P[i], q = P[(i + 1) % P.length], dx = q[0] - a[0], dy = q[1] - a[1], L = Math.hypot(dx, dy);
    const nx = (ccw ? dy : -dy) / L, ny = (ccw ? -dx : dx) / L;
    if (ny <= 0.35) continue;
    const shade = 0.82 + 0.18 * ny - 0.1 * Math.max(0, nx);
    c.fillStyle = b.wall; pathPoly(c, [a, q, [q[0], q[1] - dz], [a[0], a[1] - dz]]); c.fill();
    c.fillStyle = `rgba(0,0,0,${(1 - shade).toFixed(3)})`; c.fill();
    const ux = dx / L, uy = dy / L;
    if (b.kind === "house") {
      c.strokeStyle = "rgba(120,95,60,0.18)"; c.lineWidth = 0.04;
      for (let s = 0.25; s < dz; s += 0.25) { c.beginPath(); c.moveTo(a[0], a[1] - s); c.lineTo(q[0], q[1] - s); c.stroke(); }
      // the door on the wall nearest the door spot, windows elsewhere
      let doorAt = -1;
      if (door) { const cl = segClosest(a[0], a[1], q[0], q[1], door.x, door.y); if (Math.hypot(cl[0] - door.x, cl[1] - door.y) < 2.5) doorAt = Math.hypot(cl[0] - a[0], cl[1] - a[1]); }
      const n = Math.max(1, Math.floor(L / 1.5));
      for (let k = 0; k < n; k++) {
        const s = (L / n) * (k + 0.5); if (doorAt >= 0 && Math.abs(s - doorAt) < 0.8) continue;
        const wx = a[0] + ux * s, wy = a[1] + uy * s;
        c.fillStyle = b.trim ?? "#fff"; c.fillRect(wx - 0.3, wy - dz * 0.8, 0.6, dz * 0.42);
        c.fillStyle = "#53697e"; c.fillRect(wx - 0.23, wy - dz * 0.76, 0.46, dz * 0.34);
      }
      if (doorAt >= 0) { const wx = a[0] + ux * doorAt, wy = a[1] + uy * doorAt; c.fillStyle = b.trim ?? "#fff"; c.fillRect(wx - 0.36, wy - dz * 0.72, 0.72, dz * 0.72); c.fillStyle = "#f4f1ea"; c.fillRect(wx - 0.28, wy - dz * 0.66, 0.56, dz * 0.66); }
    } else if (b.kind === "barn" || b.kind === "garage") {
      const dw = Math.min(L * 0.4, 3.6), s = L / 2, wx = a[0] + ux * s, wy = a[1] + uy * s;
      c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(wx - dw / 2, wy - dz * 0.75, dw, dz * 0.75);
      c.strokeStyle = b.trim ?? "#fff"; c.lineWidth = 0.14; c.strokeRect(wx - dw / 2, wy - dz * 0.75, dw, dz * 0.75);
      c.beginPath(); c.moveTo(wx - dw / 2, wy - dz * 0.75); c.lineTo(wx + dw / 2, wy); c.moveTo(wx + dw / 2, wy - dz * 0.75); c.lineTo(wx - dw / 2, wy); c.moveTo(wx, wy - dz * 0.75); c.lineTo(wx, wy); c.stroke();
    } else {
      const wx = a[0] + ux * L * 0.5, wy = a[1] + uy * L * 0.5;
      c.fillStyle = "#6d5a48"; c.fillRect(wx - 0.45, wy - dz * 0.8, 0.9, dz * 0.8);
    }
    if (b.trim) { c.strokeStyle = b.trim; c.lineWidth = 0.1; pathPoly(c, [a, q, [q[0], q[1] - dz], [a[0], a[1] - dz]]); c.stroke(); }
  }
  // roof: a gable along the long side for a rectangle, flat with a rim for anything else
  const T = P.map(p => [p[0], p[1] - dz] as Pt);
  const edgeLight = (pts: Pt[], ridgeMid: Pt) => { const [cx, cy] = centroid(pts), vx = cx - ridgeMid[0], vy = cy - ridgeMid[1], l = Math.hypot(vx, vy) || 1; return (-vx - vy) / (l * 1.414); };
  const gable = (T: Pt[]) => {
    const L0 = Math.hypot(T[1][0] - T[0][0], T[1][1] - T[0][1]), L1 = Math.hypot(T[2][0] - T[1][0], T[2][1] - T[1][1]);
    const mid = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const [r0, r1, h1, h2] = L0 < L1 ? [mid(T[0], T[1]), mid(T[2], T[3]), [T[1], T[2]], [T[3], T[0]]] as const : [mid(T[1], T[2]), mid(T[3], T[0]), [T[0], T[1]], [T[2], T[3]]] as const;
    const halves: Pt[][] = L0 < L1 ? [[h1[0], h1[1], r1, r0], [h2[0], h2[1], r0, r1]] : [[h1[0], h1[1], r0, r1], [h2[0], h2[1], r1, r0]];
    const rm = mid(r0, r1);
    for (const hp of halves) {
      const lit = edgeLight(hp, rm);
      c.fillStyle = b.roof; pathPoly(c, hp); c.fill();
      c.fillStyle = lit > 0 ? `rgba(255,255,255,${(0.1 * lit).toFixed(3)})` : `rgba(0,0,0,${(-0.18 * lit).toFixed(3)})`; c.fill();
      // shingle / panel lines parallel to the ridge
      c.save(); pathPoly(c, hp); c.clip();
      const rx = r1[0] - r0[0], ry = r1[1] - r0[1], rl = Math.hypot(rx, ry), px = -ry / rl, py = rx / rl;
      c.strokeStyle = "rgba(0,0,0,0.13)"; c.lineWidth = 0.04;
      const span = Math.max(L0, L1);
      for (let s = -span; s <= span; s += b.kind === "house" ? 0.38 : 0.6) { c.beginPath(); c.moveTo(r0[0] + px * s - rx, r0[1] + py * s - ry); c.lineTo(r1[0] + px * s + rx, r1[1] + py * s + ry); c.stroke(); }
      c.restore();
      c.strokeStyle = "rgba(0,0,0,0.22)"; c.lineWidth = 0.05; pathPoly(c, hp); c.stroke();
    }
    c.strokeStyle = b.kind === "barn" ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.3)"; c.lineWidth = 0.14; c.beginPath(); c.moveTo(r0[0], r0[1]); c.lineTo(r1[0], r1[1]); c.stroke();
  };
  const lift = (ps: Pt[]) => ps.map(p => [p[0], p[1] - dz] as Pt);
  if (b.wings?.length) { c.fillStyle = b.roof; pathPoly(c, T); c.fill(); for (const wg of b.wings) gable(lift(wg)); }
  else if (T.length === 4 && !b.flat) {
    if (b.kind === "barn") {   // the grey roof sits inside a band of red wall so it reads as a red barn from above
      const ins = 0.5, Q = T.map((p, i) => { const n = T[(i + 1) % 4], o = T[(i + 3) % 4], ln = Math.hypot(n[0] - p[0], n[1] - p[1]), lo = Math.hypot(o[0] - p[0], o[1] - p[1]); return [p[0] + ((n[0] - p[0]) / ln + (o[0] - p[0]) / lo) * ins, p[1] + ((n[1] - p[1]) / ln + (o[1] - p[1]) / lo) * ins] as Pt; });
      c.fillStyle = b.wall; pathPoly(c, T); c.fill(); c.strokeStyle = b.trim ?? "#fff"; c.lineWidth = 0.12; c.stroke();
      gable(Q);
    } else gable(T);
  }
  else {
    c.fillStyle = b.roof; pathPoly(c, T); c.fill();
    c.strokeStyle = "rgba(0,0,0,0.18)"; c.lineWidth = 0.3; c.stroke();
  }
  c.strokeStyle = b.trim ?? "rgba(0,0,0,0.35)"; c.lineWidth = b.kind === "barn" ? 0.16 : 0.07; pathPoly(c, T); c.stroke();
  if (b.frontGable) {   // the steep cross gable over the front door, trimmed in white
    const [l, r, apex] = lift(b.frontGable), m: Pt = [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2];
    c.fillStyle = b.roof; pathPoly(c, [l, m, apex]); c.fill(); c.fillStyle = "rgba(255,255,255,0.08)"; c.fill();
    c.fillStyle = b.roof; pathPoly(c, [m, r, apex]); c.fill(); c.fillStyle = "rgba(0,0,0,0.16)"; c.fill();
    c.strokeStyle = "rgba(0,0,0,0.3)"; c.lineWidth = 0.06; c.beginPath(); c.moveTo(l[0], l[1]); c.lineTo(apex[0], apex[1]); c.lineTo(r[0], r[1]); c.stroke();
    c.strokeStyle = b.trim ?? "#fff"; c.lineWidth = 0.12; c.beginPath(); c.moveTo(m[0], m[1]); c.lineTo(apex[0], apex[1]); c.moveTo(l[0], l[1]); c.lineTo(r[0], r[1]); c.stroke();
  }
  if (b.kind === "house") { // a chimney
    const main = b.wings?.length ? lift(b.wings.reduce((a, w) => (Math.abs(area(w)) > Math.abs(area(a)) ? w : a))) : T;
    const xs = main.map(p => p[0]), ys = main.map(p => p[1]), cx = Math.max(...xs) - 0.55, cy = (Math.min(...ys) + Math.max(...ys)) / 2 - 0.25;
    c.fillStyle = "#8a4a36"; c.fillRect(cx - 0.25, cy - 0.25, 0.5, 0.5); c.fillStyle = "#3a2a22"; c.fillRect(cx - 0.15, cy - 0.15, 0.3, 0.3);
  }
  c.restore();
}


export type Paint = { body: string; hood: string; trim: string };
/** Pat on the lawn tractor, life size. Local frame: +x forward, +y to Pat's right. `deckHalf` is half the cut width. */
export function drawMower(c: CanvasRenderingContext2D, x: number, y: number, h: number, steer: number, odo: number, time: number, running: boolean, deckHalf: number, paint: Paint, bagger: boolean, lights: boolean) {
  c.save();
  // soft shadow down and to the right
  c.fillStyle = "rgba(20,40,10,0.22)"; c.beginPath(); c.ellipse(x + 0.28, y + 0.34, 1.12, Math.max(0.8, deckHalf * 0.55), h, 0, 7); c.fill();
  c.translate(x, y); c.rotate(h);
  const rr = (x0: number, y0: number, w: number, hh: number, r: number) => { c.beginPath(); c.roundRect(x0, y0, w, hh, r); };
  const buzz = running ? Math.sin(time * 90) * 0.006 : 0;
  // the wing deck: a centre deck under the tractor and a wing each side, hinged, with little gauge wheels
  const wl = -0.3, wlen = 0.74;
  c.fillStyle = "#2c2f33"; rr(wl - 0.03, -deckHalf - 0.03, wlen + 0.06, deckHalf * 2 + 0.06, 0.22); c.fill();
  c.fillStyle = "#454a50"; rr(wl, -deckHalf, wlen, deckHalf * 2, 0.2); c.fill();
  c.fillStyle = "rgba(255,255,255,0.08)"; rr(wl + 0.06, -deckHalf + 0.06, wlen * 0.4, deckHalf * 2 - 0.12, 0.12); c.fill();
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
  c.strokeStyle = "#efc6a2"; c.lineWidth = 0.075; c.lineCap = "round";
  const sa = steer * 0.12;
  c.beginPath(); c.moveTo(-0.42, -0.21); c.lineTo(0.03, -0.13 + sa); c.moveTo(-0.42, 0.21); c.lineTo(0.03, 0.13 + sa); c.stroke();
  c.fillStyle = "#4e7aa6"; c.beginPath(); c.ellipse(-0.46, 0, 0.15, 0.25, 0, 0, 7); c.fill();
  c.fillStyle = "rgba(255,255,255,0.15)"; c.beginPath(); c.ellipse(-0.5, -0.06, 0.08, 0.12, 0, 0, 7); c.fill();
  c.fillStyle = "#efc6a2"; c.beginPath(); c.arc(-0.43, 0, 0.12, 0, 7); c.fill();
  c.beginPath(); c.ellipse(-0.44, -0.12, 0.028, 0.022, 0, 0, 7); c.ellipse(-0.44, 0.12, 0.028, 0.022, 0, 0, 7); c.fill();
  c.fillStyle = "#6b4a32"; c.beginPath(); c.ellipse(-0.46, 0, 0.11, 0.115, 0, 0, 7); c.fill();
  c.fillStyle = "#a59a8f"; for (const [gx, gy] of [[-0.5, -0.06], [-0.47, 0.06], [-0.53, 0.01], [-0.42, -0.08], [-0.4, 0.07], [-0.55, -0.03]]) { c.beginPath(); c.arc(gx, gy, 0.02, 0, 7); c.fill(); }
  c.restore();
}

export type CatPose = { x: number; y: number; h: number; act: "walk" | "sit" | "lick" | "idle" | "nap" | "run"; phase: number };
const CAT = { fur: "#9aa0a8", light: "#b4b9c0", dark: "#8a9098", pink: "#f2b4be", eye: "#7cc35a", paw: "#f3f3f1" };
/** A tapered tail through the given points, thick at the base. */
function tail(c: CanvasRenderingContext2D, pts: Pt[], w0: number, w1: number) {
  c.lineCap = "round"; c.strokeStyle = CAT.fur;
  for (let i = 1; i < pts.length; i++) { c.lineWidth = w0 + (w1 - w0) * (i / (pts.length - 1)); c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke(); }
}
function catHead(c: CanvasRenderingContext2D, hx: number, hy: number, ang: number, eyes: "open" | "closed", earsBack = 0) {
  c.save(); c.translate(hx, hy); c.rotate(ang);
  for (const s of [-1, 1]) {   // ears: grey triangles, pink inside
    c.fillStyle = CAT.fur; c.beginPath(); c.moveTo(-0.035 - earsBack, s * 0.035); c.lineTo(-0.06 - earsBack * 1.5, s * 0.12); c.lineTo(0.03, s * 0.075); c.closePath(); c.fill();
    c.fillStyle = CAT.pink; c.beginPath(); c.moveTo(-0.025 - earsBack, s * 0.05); c.lineTo(-0.045 - earsBack * 1.4, s * 0.1); c.lineTo(0.012, s * 0.072); c.closePath(); c.fill();
  }
  c.fillStyle = CAT.fur; c.beginPath(); c.ellipse(0, 0, 0.095, 0.09, 0, 0, 7); c.fill();
  c.fillStyle = CAT.light; c.beginPath(); c.ellipse(0.055, 0, 0.035, 0.04, 0, 0, 7); c.fill();
  c.fillStyle = CAT.pink; c.beginPath(); c.arc(0.085, 0, 0.011, 0, 7); c.fill();
  if (eyes === "open") {
    for (const s of [-1, 1]) { c.fillStyle = CAT.eye; c.beginPath(); c.ellipse(0.04, s * 0.034, 0.016, 0.012, s * 0.4, 0, 7); c.fill(); c.fillStyle = "#1d2a16"; c.beginPath(); c.ellipse(0.042, s * 0.034, 0.005, 0.01, 0, 0, 7); c.fill(); }
  } else { c.strokeStyle = "#5b6067"; c.lineWidth = 0.008; for (const s of [-1, 1]) { c.beginPath(); c.arc(0.04, s * 0.034, 0.014, 0.3, 2.8); c.stroke(); } }
  c.restore();
}
/** The grey housecat from above: oval body, round head with ears, long tapering tail that sways. */
export function drawCat(c: CanvasRenderingContext2D, cat: CatPose, time: number, S = 2.0) {
  c.save(); c.translate(cat.x, cat.y);
  c.fillStyle = "rgba(20,40,10,0.18)"; c.beginPath(); c.ellipse(0.12, 0.14, 0.24 * S, 0.12 * S, cat.h, 0, 7); c.fill();
  c.rotate(cat.h); c.scale(S, S);
  const t = time + cat.phase, act = cat.act;
  if (act === "nap") {   // curled up: a round grey ball, tail wrapped round the front, head tucked, eyes shut
    const br = 0.15 + Math.sin(t * 1.5) * 0.004;
    c.fillStyle = CAT.fur; c.beginPath(); c.arc(-0.01, 0, br, 0, 7); c.fill();
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
    c.fillStyle = CAT.fur; c.beginPath(); c.ellipse(-0.05, 0, 0.13, 0.12, 0, 0, 7); c.fill();
    c.beginPath(); c.ellipse(0.05, 0, 0.08, 0.075, 0, 0, 7); c.fill();
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
  c.fillStyle = CAT.fur; c.beginPath(); c.ellipse(-0.01, sway, L, run ? 0.09 : 0.105, 0, 0, 7); c.fill();
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
