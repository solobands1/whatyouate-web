// Kitchen Golf's materials: the surfaces every place is built from (walnut, butcher block, marble, granite, brushed
// steel, black glass, frosted glass, glossy tile, painted wood, cabinet doors). Each fills a rectangle; the caller clips.
import { type C, type Rnd, TAU, rr, lin, rad, mix, lighter, darker } from "./draw";

/** Planks across (or down, `vertical`), each its own tone, with flowing grain, open pores, the odd cathedral figure and
 *  knot, and butt joints. `dark` is the grain colour as "r,g,b". */
export function planks(c: C, x0: number, y0: number, x1: number, y1: number, rnd: Rnd, pal: string[], dark: string, opts: { vertical?: boolean; size?: [number, number]; joints?: boolean } = {}) {
  if (opts.vertical) {   // the same thing turned a quarter: across becomes down
    c.save(); c.translate(x0, y1); c.rotate(-Math.PI / 2); planks(c, 0, 0, y1 - y0, x1 - x0, rnd, pal, dark, { ...opts, vertical: false }); c.restore(); return;
  }
  const [hMin, hVar] = opts.size ?? [44, 16];
  let y = y0 - rnd() * 18;
  while (y < y1) {
    const h = hMin + rnd() * hVar, base = pal[Math.floor(rnd() * pal.length)];
    const joints = [x0 - 1]; if (opts.joints !== false) { let jx = x0 + 60 + rnd() * 260; while (jx < x1) { joints.push(jx); jx += 280 + rnd() * 200; } } joints.push(x1 + 1);
    for (let s = 0; s < joints.length - 1; s++) {
      const bx0 = joints[s], bx1 = joints[s + 1], tone = mix(base, rnd() < 0.5 ? "#ffffff" : "#000000", rnd() * 0.07);
      c.fillStyle = lin(c, 0, y, 0, y + h, [[0, lighter(tone, 0.07)], [0.55, tone], [1, darker(tone, 0.12)]]); c.fillRect(bx0, y, bx1 - bx0, h);
      c.save(); c.beginPath(); c.rect(bx0, y, bx1 - bx0, h); c.clip();
      const n = Math.max(3, Math.round(h / 1.7));
      for (let g = 0; g < n; g++) {
        const gy = y + (g + rnd() * 0.7) * (h / n), a1 = 0.6 + rnd() * 1.8, l1 = 60 + rnd() * 90, ph = rnd() * TAU, a2 = rnd() * 0.7, l2 = 12 + rnd() * 18, light = rnd() < 0.22;
        c.strokeStyle = light ? `rgba(255,222,175,${0.06 + rnd() * 0.08})` : `rgba(${dark},${0.06 + rnd() * 0.15})`; c.lineWidth = 0.35 + rnd() * 1.2;
        c.beginPath(); for (let xx = bx0 - 6; xx <= bx1 + 6; xx += 6) { const yy = gy + Math.sin(xx / l1 + ph) * a1 + Math.sin(xx / l2 + ph * 2) * a2; if (xx === bx0 - 6) c.moveTo(xx, yy); else c.lineTo(xx, yy); } c.stroke();
      }
      const pores = Math.round((bx1 - bx0) * h * 0.02);
      for (let q = 0; q < pores; q++) { c.fillStyle = `rgba(${dark},${0.1 + rnd() * 0.14})`; c.fillRect(bx0 + rnd() * (bx1 - bx0), y + rnd() * h, 1.2 + rnd() * 2.4, 0.45); }
      if (h > 30 && rnd() < 0.6) {   // cathedral figure: nested arches
        const fx = bx0 + (bx1 - bx0) * (0.15 + rnd() * 0.7), fy = y + h * (0.35 + rnd() * 0.35), span = 36 + rnd() * 50;
        for (let j = 0; j < 7; j++) {
          const off = j * 2.3 + 1.5; c.strokeStyle = `rgba(${dark},${0.06 + rnd() * 0.07})`; c.lineWidth = 0.5 + rnd() * 0.7; c.beginPath();
          for (let i = 0; i <= 20; i++) { const t = -1 + i / 10, xx = fx + t * (span + off * 3), yy = fy - off + t * t * (off * 1.5 + 5); if (i) c.lineTo(xx, yy); else c.moveTo(xx, yy); }
          c.stroke();
        }
      }
      if (h > 30 && rnd() < 0.16) {   // a knot
        const kx = bx0 + (bx1 - bx0) * (0.1 + rnd() * 0.8), ky = y + h * (0.3 + rnd() * 0.4);
        c.fillStyle = rad(c, kx, ky, 0.3, 4.5, [[0, `rgba(${dark},0.75)`], [1, `rgba(${dark},0)`]]); c.beginPath(); c.ellipse(kx, ky, 6, 3.4, 0, 0, TAU); c.fill();
        for (let j = 1; j <= 4; j++) { c.strokeStyle = `rgba(${dark},${0.18 - j * 0.03})`; c.lineWidth = 0.6; c.beginPath(); c.ellipse(kx, ky, 6 + j * 3.4, 3.4 + j * 1.5, 0, 0, TAU); c.stroke(); }
      }
      c.restore();
      if (s > 0) { c.fillStyle = `rgba(${dark},0.55)`; c.fillRect(bx0 - 0.5, y, 1, h); c.fillStyle = "rgba(255,230,190,0.18)"; c.fillRect(bx0 + 0.5, y, 0.6, h); }
    }
    c.fillStyle = `rgba(${dark},0.6)`; c.fillRect(x0, y - 0.6, x1 - x0, 1.2); c.fillStyle = "rgba(255,232,195,0.22)"; c.fillRect(x0, y + 0.6, x1 - x0, 0.8);
    y += h;
  }
}
/** A soft varnish sheen: a broad diagonal highlight band. */
export function sheen(c: C, x0: number, y0: number, x1: number, y1: number, a = 0.15) {
  c.fillStyle = lin(c, x0, y0, x1, y1, [[0, "rgba(255,244,222,0)"], [0.22, `rgba(255,244,222,${a})`], [0.36, `rgba(255,244,222,${a * 0.1})`], [0.6, `rgba(255,244,222,${a * 0.5})`], [0.72, "rgba(255,244,222,0)"]]);
  c.fillRect(x0, y0, x1 - x0, y1 - y0);
}
/** A butcher block: narrow edge-grain strips down the counter, honey maple with the odd darker one, oiled. */
export function butcherBlock(c: C, x0: number, y0: number, x1: number, y1: number, rnd: Rnd) {
  const pal = ["#d39352", "#c58447", "#dda262", "#bd7b40", "#d59a5c", "#b4733a", "#d99d5c"], dark = "92,44,8";
  for (let x = x0; x < x1;) {
    const w = 11 + rnd() * 7, base = rnd() < 0.1 ? "#9a5f2e" : pal[Math.floor(rnd() * pal.length)];
    c.fillStyle = lin(c, x, 0, x + w, 0, [[0, lighter(base, 0.08)], [0.5, base], [1, darker(base, 0.1)]]); c.fillRect(x, y0, w, y1 - y0);
    c.save(); c.beginPath(); c.rect(x, y0, w, y1 - y0); c.clip();
    for (let g = 0; g < Math.round(w / 1.8); g++) {
      const gx = x + (g + rnd() * 0.6) * 1.8, a = 0.4 + rnd() * 1.2, l = 50 + rnd() * 70, ph = rnd() * TAU;
      c.strokeStyle = rnd() < 0.25 ? `rgba(255,228,185,${0.06 + rnd() * 0.07})` : `rgba(${dark},${0.05 + rnd() * 0.12})`; c.lineWidth = 0.3 + rnd() * 0.9;
      c.beginPath(); for (let yy = y0 - 6; yy <= y1 + 6; yy += 8) { const xx = gx + Math.sin(yy / l + ph) * a; if (yy === y0 - 6) c.moveTo(xx, yy); else c.lineTo(xx, yy); } c.stroke();
    }
    for (let q = 0; q < Math.round(w * (y1 - y0) * 0.015); q++) { c.fillStyle = `rgba(${dark},${0.08 + rnd() * 0.1})`; c.fillRect(x + rnd() * w, y0 + rnd() * (y1 - y0), 0.45, 1.2 + rnd() * 2); }
    c.restore();
    c.fillStyle = `rgba(${dark},0.5)`; c.fillRect(x - 0.4, y0, 0.8, y1 - y0); c.fillStyle = "rgba(255,236,205,0.2)"; c.fillRect(x + 0.4, y0, 0.6, y1 - y0);
    x += w;
  }
  sheen(c, x0, y0, x1, y1, 0.13);
}
/** Polished marble: a warm white with soft cloudy patches and grey veins, each a wide haze with a fine line in it. */
export function marble(c: C, x0: number, y0: number, x1: number, y1: number, rnd: Rnd) {
  const w = x1 - x0, h = y1 - y0;
  c.fillStyle = lin(c, x0, y0, x1, y1, [[0, "#fbf9f6"], [1, "#ece7e1"]]); c.fillRect(x0, y0, w, h);
  for (let i = 0; i < 14; i++) { const cx = x0 + rnd() * w, cy = y0 + rnd() * h, r = 30 + rnd() * 80; c.fillStyle = rad(c, cx, cy, 0, r, [[0, rnd() < 0.5 ? "rgba(200,192,182,0.16)" : "rgba(235,225,210,0.22)"], [1, "rgba(220,210,200,0)"]]); c.fillRect(cx - r, cy - r, r * 2, r * 2); }
  c.lineCap = "round"; c.lineJoin = "round";
  for (let k = 0; k < 5; k++) {
    const pts: number[][] = []; let x = x0 - 40 + rnd() * (w + 40), y = y0 - 20 + rnd() * 40, a = 0.7 + rnd() * 0.8;
    for (let s = 0; s < 22; s++) { pts.push([x, y]); a += (rnd() - 0.5) * 0.35; x += Math.cos(a) * 24; y += Math.sin(a) * 24 + 6; }
    const path = () => { c.beginPath(); pts.forEach(([px, py], i) => { if (i) { const [qx, qy] = pts[i - 1]; c.quadraticCurveTo(qx, qy, (qx + px) / 2, (qy + py) / 2); } else c.moveTo(px, py); }); };
    const g = 0.6 + rnd() * 0.6;
    path(); c.strokeStyle = `rgba(130,120,112,${0.045 * g})`; c.lineWidth = 16; c.stroke();
    path(); c.strokeStyle = `rgba(120,112,105,${0.07 * g})`; c.lineWidth = 5; c.stroke();
    path(); c.strokeStyle = `rgba(110,102,96,${0.12 * g})`; c.lineWidth = 2; c.stroke();
    path(); c.strokeStyle = `rgba(100,94,90,${0.2 * g})`; c.lineWidth = 0.6; c.stroke();
    if (rnd() < 0.7) { const i0 = 4 + Math.floor(rnd() * 10), br = pts.slice(i0, i0 + 6).map(([px, py], j) => [px + j * 9 * (rnd() < 0.5 ? 1 : -1), py + j * 4]); c.beginPath(); br.forEach(([px, py], i) => { if (i) c.lineTo(px, py); else c.moveTo(px, py); }); c.strokeStyle = `rgba(110,104,98,${0.22 * g})`; c.lineWidth = 0.5; c.stroke(); }
  }
  for (let i = 0; i < w * h * 0.002; i++) { c.fillStyle = `rgba(150,140,130,${0.1 + rnd() * 0.15})`; c.fillRect(x0 + rnd() * w, y0 + rnd() * h, 0.8, 0.8); }
  sheen(c, x0, y0, x1, y1, 0.2);
}
/** Polished dark granite, full of flecks, with a soft reflection across it. */
export function granite(c: C, x0: number, y0: number, x1: number, y1: number, rnd: Rnd) {
  const w = x1 - x0, h = y1 - y0;
  c.fillStyle = lin(c, x0, y0, x1, y1, [[0, "#4a4e55"], [1, "#2c2f34"]]); c.fillRect(x0, y0, w, h);
  const cols = ["rgba(12,12,15,0.6)", "rgba(12,12,15,0.6)", "rgba(95,98,106,0.5)", "rgba(130,134,142,0.4)", "rgba(150,118,92,0.35)", "rgba(185,185,192,0.3)"];
  for (let i = 0; i < w * h * 0.035; i++) { const s = 0.5 + rnd() * rnd() * 2.6; c.fillStyle = cols[Math.floor(rnd() * cols.length)]; c.fillRect(x0 + rnd() * w, y0 + rnd() * h, s, s * (0.6 + rnd() * 0.6)); }
  for (let i = 0; i < w * h * 0.0012; i++) { c.fillStyle = "rgba(235,235,240,0.55)"; c.fillRect(x0 + rnd() * w, y0 + rnd() * h, 0.7, 0.7); }
  c.fillStyle = lin(c, x0, y0, x1, y1, [[0, "rgba(255,255,255,0)"], [0.3, "rgba(255,255,255,0.1)"], [0.42, "rgba(255,255,255,0)"], [1, "rgba(255,255,255,0)"]]); c.fillRect(x0, y0, w, h);
}
/** Brushed stainless steel: a soft gradient, fine streaks along it, a long bright reflection. */
export function brushedSteel(c: C, x0: number, y0: number, x1: number, y1: number, rnd: Rnd, dark = false) {
  const w = x1 - x0, h = y1 - y0;
  c.fillStyle = lin(c, x0, y0, x1, y1, dark ? [[0, "#a3acb6"], [0.5, "#c7ced6"], [1, "#8e98a3"]] : [[0, "#d9dee4"], [0.45, "#f1f4f7"], [1, "#c2c9d1"]]); c.fillRect(x0, y0, w, h);
  for (let y = y0; y < y1; y += 0.7) { c.fillStyle = `rgba(${rnd() < 0.5 ? "255,255,255" : "70,80,92"},${0.03 + rnd() * 0.06})`; c.fillRect(x0 + rnd() * 20 - 20, y, w + 40, 0.45); }
  c.fillStyle = lin(c, x0, y0, x1, y1, [[0, "rgba(255,255,255,0)"], [0.25, "rgba(255,255,255,0.28)"], [0.32, "rgba(255,255,255,0.05)"], [0.55, "rgba(255,255,255,0)"], [0.62, "rgba(255,255,255,0.14)"], [0.7, "rgba(255,255,255,0)"]]); c.fillRect(x0, y0, w, h);
}
/** Black glass: nearly black, with long soft reflections and a faint dust. */
export function blackGlass(c: C, x0: number, y0: number, x1: number, y1: number, rnd: Rnd) {
  const w = x1 - x0, h = y1 - y0;
  c.fillStyle = lin(c, x0, y0, x1, y1, [[0, "#2a2e35"], [0.5, "#16181c"], [1, "#0d0e11"]]); c.fillRect(x0, y0, w, h);
  c.fillStyle = lin(c, x0, y0, x1, y1, [[0, "rgba(255,255,255,0)"], [0.16, "rgba(255,255,255,0.12)"], [0.24, "rgba(255,255,255,0.02)"], [0.3, "rgba(255,255,255,0.07)"], [0.36, "rgba(255,255,255,0)"], [0.78, "rgba(255,255,255,0)"], [0.84, "rgba(255,255,255,0.05)"], [0.9, "rgba(255,255,255,0)"]]); c.fillRect(x0, y0, w, h);
  for (let i = 0; i < w * h * 0.004; i++) { c.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.06})`; c.fillRect(x0 + rnd() * w, y0 + rnd() * h, 0.6, 0.6); }
}
/** A frosted glass shelf in cold light: pale ice blue, a fine frost, bright diagonal streaks, a glow at the edges. */
export function frostedGlass(c: C, x0: number, y0: number, x1: number, y1: number, rnd: Rnd) {
  const w = x1 - x0, h = y1 - y0;
  c.fillStyle = lin(c, x0, y0, x0, y1, [[0, "#e3f1f9"], [0.5, "#c9e2f0"], [1, "#b2d2e6"]]); c.fillRect(x0, y0, w, h);
  c.fillStyle = lin(c, x0, 0, x1, 0, [[0, "rgba(120,170,205,0.25)"], [0.15, "rgba(120,170,205,0)"], [0.85, "rgba(120,170,205,0)"], [1, "rgba(120,170,205,0.25)"]]); c.fillRect(x0, y0, w, h);
  for (let i = 0; i < w * h * 0.02; i++) { c.fillStyle = rnd() < 0.6 ? `rgba(255,255,255,${0.2 + rnd() * 0.3})` : `rgba(110,160,195,${0.08 + rnd() * 0.12})`; c.fillRect(x0 + rnd() * w, y0 + rnd() * h, 0.8, 0.8); }
  for (const [o, s, a] of [[0.12, 0.1, 0.5], [0.3, 0.04, 0.35], [0.58, 0.12, 0.42], [0.8, 0.05, 0.28]]) {
    const ax = x0 + w * o; c.fillStyle = lin(c, ax, y0, ax + w * s, y0, [[0, "rgba(255,255,255,0)"], [0.5, `rgba(255,255,255,${a})`], [1, "rgba(255,255,255,0)"]]);
    c.beginPath(); c.moveTo(ax, y0); c.lineTo(ax + w * s, y0); c.lineTo(ax + w * s - h * 0.35, y1); c.lineTo(ax - h * 0.35, y1); c.closePath(); c.fill();
  }
}
/** Glossy floor tiles: each its own shade, bevelled, the grout set deep between them, a soft reflection in each. */
export function glossyTiles(c: C, x0: number, y0: number, x1: number, y1: number, s: number, a: string, b: string, grout: string, rnd: Rnd) {
  c.fillStyle = grout; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let y = y0, j = 0; y < y1; y += s, j++) for (let x = x0, i = 0; x < x1; x += s, i++) {
    const base = (i + j) % 2 ? b : a, v = (rnd() - 0.5) * 0.1, col = v > 0 ? lighter(base, v) : darker(base, -v);
    c.fillStyle = darker(grout, 0.25); rr(c, x + 1, y + 1, s - 1.4, s - 1.4, 3); c.fill();
    c.fillStyle = lin(c, x, y, x + s, y + s, [[0, lighter(col, 0.16)], [1, darker(col, 0.12)]]); rr(c, x + 1.4, y + 1.4, s - 2.8, s - 2.8, 2.8); c.fill();
    c.fillStyle = lin(c, x, y, x + s, y + s, [[0, "rgba(255,255,255,0)"], [0.3, "rgba(255,255,255,0.22)"], [0.42, "rgba(255,255,255,0)"]]); rr(c, x + 1.4, y + 1.4, s - 2.8, s - 2.8, 2.8); c.fill();
    c.lineWidth = 1; c.strokeStyle = "rgba(255,255,255,0.65)"; c.beginPath(); c.moveTo(x + 2.3, y + s - 4); c.lineTo(x + 2.3, y + 2.3); c.lineTo(x + s - 4, y + 2.3); c.stroke();
    c.strokeStyle = "rgba(60,44,28,0.3)"; c.beginPath(); c.moveTo(x + 4, y + s - 2); c.lineTo(x + s - 2, y + s - 2); c.lineTo(x + s - 2, y + 4); c.stroke();
  }
}
/** Glossy white subway tiles with deep grout and a bright edge on each. */
export function subway(c: C, x0: number, y0: number, x1: number, y1: number, rnd: Rnd) {
  c.fillStyle = "#c3c8ce"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let y = y0, j = 0; y < y1; y += 18, j++) for (let x = x0 - (j % 2 ? 19 : 0); x < x1; x += 38) {
    const t = 0.97 + rnd() * 0.03;
    c.fillStyle = "#a9b0b8"; rr(c, x + 0.8, y + 0.8, 36.6, 16.6, 3.2); c.fill();
    c.fillStyle = lin(c, 0, y, 0, y + 17, [[0, "#ffffff"], [0.6, mix("#eef2f6", "#ffffff", 1 - t)], [1, "#dfe5eb"]]); rr(c, x + 1.2, y + 1.2, 35.6, 15.4, 3); c.fill();
    c.fillStyle = "rgba(255,255,255,0.8)"; rr(c, x + 3, y + 2.2, 30, 2.4, 1.2); c.fill();
    c.strokeStyle = "rgba(120,130,142,0.35)"; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x + 3, y + 16.2); c.lineTo(x + 35, y + 16.2); c.stroke();
  }
}
/** Painted boards: a soft satin colour, the seams between boards, a little grain showing through the paint. */
export function paintedWood(c: C, x0: number, y0: number, x1: number, y1: number, rnd: Rnd, col: string, plank = 40) {
  for (let y = y0, i = 0; y < y1; y += plank, i++) {
    const tone = mix(col, i % 2 ? "#ffffff" : "#000000", rnd() * 0.05);
    c.fillStyle = lin(c, 0, y, 0, y + plank, [[0, lighter(tone, 0.08)], [0.5, tone], [1, darker(tone, 0.07)]]); c.fillRect(x0, y, x1 - x0, plank);
    for (let g = 0; g < 10; g++) {
      const gy = y + rnd() * plank, ph = rnd() * TAU; c.strokeStyle = rnd() < 0.5 ? "rgba(255,255,255,0.1)" : "rgba(90,70,40,0.07)"; c.lineWidth = 0.5 + rnd();
      c.beginPath(); for (let x = x0 - 6; x <= x1 + 6; x += 12) { const yy = gy + Math.sin(x / 70 + ph) * 1.2; if (x === x0 - 6) c.moveTo(x, yy); else c.lineTo(x, yy); } c.stroke();
    }
    c.fillStyle = "rgba(70,50,30,0.35)"; c.fillRect(x0, y - 0.7, x1 - x0, 1.4); c.fillStyle = "rgba(255,255,255,0.5)"; c.fillRect(x0, y + 0.7, x1 - x0, 0.8);
  }
}
/** Shaker cabinet doors: a bevelled frame, a recessed panel, a brushed bar handle. */
export function cabinetDoors(c: C, x0: number, y0: number, x1: number, y1: number, col: string, n: number) {
  const w = (x1 - x0) / n;
  c.fillStyle = darker(col, 0.45); c.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let i = 0; i < n; i++) {
    const x = x0 + i * w + 1.5, dw = w - 3, h = y1 - y0;
    c.fillStyle = lin(c, x, y0, x + dw, y0 + h, [[0, lighter(col, 0.1)], [1, darker(col, 0.12)]]); rr(c, x, y0 + 1.5, dw, h, 3); c.fill();
    c.fillStyle = lin(c, x, y0, x + dw, y0 + h, [[0, darker(col, 0.1)], [1, lighter(col, 0.06)]]); rr(c, x + 9, y0 + 10, dw - 18, h - 12, 2); c.fill();
    c.strokeStyle = "rgba(0,0,0,0.22)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + 9.5, y0 + h); c.lineTo(x + 9.5, y0 + 10.5); c.lineTo(x + dw - 9, y0 + 10.5); c.stroke();
    c.strokeStyle = "rgba(255,255,255,0.35)"; c.beginPath(); c.moveTo(x + dw - 9.5, y0 + 11); c.lineTo(x + dw - 9.5, y0 + h); c.stroke();
    c.strokeStyle = "rgba(255,255,255,0.4)"; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 0.8, y0 + h); c.lineTo(x + 0.8, y0 + 2.3); c.lineTo(x + dw - 1, y0 + 2.3); c.stroke();
    const hx = x + dw / 2;   // the handle
    c.fillStyle = "rgba(0,0,0,0.3)"; rr(c, hx - 13 + 1, y0 + 16 + 1.6, 26, 4.4, 2.2); c.fill();
    c.fillStyle = lin(c, 0, y0 + 16, 0, y0 + 20.4, [[0, "#f4f6f8"], [0.5, "#b9c1ca"], [1, "#7b8591"]]); rr(c, hx - 13, y0 + 16, 26, 4.4, 2.2); c.fill();
  }
}
