// Food Fight's art: a picnic on rolling hills in late-afternoon sun. A layered landscape (sky, sun, soft clouds,
// three bands of distant hills with trees), rich loam under living grass along the destructible ground, gingham
// blankets, wicker picnic baskets, and juicy effects. The sky and the soil texture are painted once; the ground is
// repainted only when a throw digs into it; everything else is light enough to draw every frame.
import { type C, TAU, seeded, rr, circ, ell, line, lin, rad, shade, noShade, mix, lighter, darker, rgba, layer, gloss, warmLight } from "./paint";

// ── the sky and the distant hills ─────────────────────────────────────────
function cloud(c: C, x: number, y: number, s: number) {
  const puffs: [number, number, number][] = [[0, 0, 1], [-22, 7, 0.74], [23, 5, 0.84], [-41, 13, 0.52], [43, 13, 0.58], [8, -13, 0.78], [-10, -8, 0.6]];
  const base = y + 16 * s;
  c.save(); c.beginPath(); c.rect(x - 80 * s, y - 60 * s, 160 * s, base - (y - 60 * s)); c.clip();
  c.fillStyle = "rgba(150,160,196,0.28)"; for (const [dx, dy, r] of puffs) { circ(c, x + dx * s + 3 * s, y + dy * s + 4 * s, 20 * r * s); c.fill(); }
  for (const [dx, dy, r] of puffs) {
    const px = x + dx * s, py = y + dy * s, R = 20 * r * s;
    c.fillStyle = rad(c, px, py, R * 0.1, R, [[0, "#ffffff"], [0.7, "#f7f8fc"], [1, "#e3e8f3"]], px - R * 0.4, py - R * 0.45); circ(c, px, py, R); c.fill();
  }
  c.beginPath(); for (const [dx, dy, r] of puffs) { const px = x + dx * s, py = y + dy * s; c.moveTo(px + 20 * r * s, py); c.arc(px, py, 20 * r * s, 0, TAU); }   // shade the underside of the puffs only
  c.fillStyle = lin(c, 0, y - 10 * s, 0, base, [[0, "rgba(255,255,255,0)"], [0.6, "rgba(206,212,232,0.15)"], [1, "rgba(186,194,222,0.55)"]]); c.fill();
  c.restore();
  c.fillStyle = "rgba(255,250,236,0.55)"; for (const [dx, dy, r] of puffs.slice(0, 3)) { ell(c, x + dx * s - 6 * r * s, y + dy * s - 9 * r * s, 7 * r * s, 4 * r * s, -0.5); c.fill(); }
}
function ridge(c: C, W: number, H: number, f: (x: number) => number, top: string, bot: string, y0: number) {
  c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 4) c.lineTo(x, f(x)); c.lineTo(W, H); c.closePath();
  c.fillStyle = lin(c, 0, y0, 0, y0 + 120, [[0, top], [1, bot]]); c.fill();
}
function tree(c: C, x: number, y: number, s: number, dark: string, light: string) {
  c.fillStyle = "rgba(40,50,30,0.25)"; ell(c, x + 3 * s, y + 1, 9 * s, 2.4 * s); c.fill();
  c.fillStyle = "#6b5032"; rr(c, x - 1.2 * s, y - 8 * s, 2.4 * s, 8 * s, 1); c.fill();
  for (const [dx, dy, r] of [[0, -16, 8], [-6, -11, 6], [6, -10, 6.4], [0, -22, 5.4]] as [number, number, number][]) {
    const px = x + dx * s, py = y + dy * s, R = r * s;
    c.fillStyle = rad(c, px, py, R * 0.15, R, [[0, light], [1, dark]], px - R * 0.45, py - R * 0.5); circ(c, px, py, R); c.fill();
  }
}
/** Everything behind the ground, W by H: sky, the sun up on the left, clouds, hazy hills and trees. */
export function paintSky(c: C, W: number, H: number) {
  c.fillStyle = lin(c, 0, 0, 0, 360, [[0, "#6fb0ea"], [0.42, "#a9d4f5"], [0.78, "#e6eef0"], [1, "#fbe6c6"]]); c.fillRect(0, 0, W, H);
  // the sun, low and warm on the left, with a wide glow and soft rays
  const sx = 58, sy = 92;
  c.fillStyle = rad(c, sx, sy, 0, 230, [[0, "rgba(255,244,214,0.85)"], [0.16, "rgba(255,232,186,0.5)"], [0.45, "rgba(255,222,170,0.16)"], [1, "rgba(255,222,170,0)"]]); c.fillRect(0, 0, W, H);
  c.save(); c.translate(sx, sy);
  for (let i = 0; i < 12; i++) { c.rotate(TAU / 12); c.fillStyle = lin(c, 0, 0, 200, 0, [[0, "rgba(255,246,220,0.16)"], [1, "rgba(255,246,220,0)"]]); c.beginPath(); c.moveTo(0, 0); c.lineTo(200, -9); c.lineTo(200, 9); c.closePath(); c.fill(); }
  c.restore();
  c.fillStyle = rad(c, sx, sy, 0, 24, [[0, "#fffef6"], [0.7, "#fff4cf"], [1, "#ffe6a0"]]); circ(c, sx, sy, 22); c.fill();
  cloud(c, 306, 108, 0.86); cloud(c, 118, 206, 0.66); cloud(c, 262, 236, 0.5); cloud(c, 384, 258, 0.42);
  // three bands of hills, hazier the farther they are
  const f1 = (x: number) => 262 + 16 * Math.sin(x / 58 + 1) + 9 * Math.sin(x / 21 + 0.3);
  const f2 = (x: number) => 296 + 20 * Math.sin(x / 82 + 2.4) + 8 * Math.sin(x / 29 + 1);
  const f3 = (x: number) => 334 + 15 * Math.sin(x / 52 + 0.5) + 7 * Math.sin(x / 18);
  ridge(c, W, H, f1, "#a9c9cf", "#c6dcd8", 250);
  c.fillStyle = lin(c, 0, 250, 0, 330, [[0, "rgba(255,246,230,0)"], [1, "rgba(255,246,230,0.4)"]]); c.fillRect(0, 250, W, 80);
  ridge(c, W, H, f2, "#86b483", "#a3c79a", 280);
  const r = seeded(0x7ee5);
  for (let x = 4; x < W;) {   // copses of trees along the middle band, smaller and hazier than the near ones
    const n = 1 + Math.floor(r() * 3);
    for (let j = 0; j < n; j++) { const tx = x + j * (7 + r() * 5); tree(c, tx, f2(tx) + 4 + r() * 3, 0.5 + r() * 0.32, "#6a9767", "#a2c99a"); }
    x += 40 + r() * 70;
  }
  c.fillStyle = lin(c, 0, 290, 0, 360, [[0, "rgba(255,244,226,0)"], [1, "rgba(255,244,226,0.3)"]]); c.fillRect(0, 290, W, 70);
  ridge(c, W, H, f3, "#6aa25d", "#5a904f", 320);
  for (let x = 20; x < W; x += 40 + r() * 60) {   // bushes along the nearest band
    const y = f3(x) + 2;
    for (const [dx, dy, rr0] of [[0, -4, 6], [-6, -1, 4.4], [6, -1, 4.8]] as [number, number, number][]) { c.fillStyle = rad(c, x + dx, y + dy, 0.5, rr0, [[0, "#86bd6e"], [1, "#4b7f43"]], x + dx - 2, y + dy - 2.5); circ(c, x + dx, y + dy, rr0); c.fill(); }
  }
  for (let x = 26; x < W; x += 90 + r() * 110) { tree(c, x, f3(x) + 5, 1 + r() * 0.35, "#4a7a44", "#86b96f"); if (r() < 0.6) tree(c, x + 9, f3(x + 9) + 6, 0.75, "#4a7a44", "#86b96f"); }
}

// ── the soil ───────────────────────────────────────────────────────────────
/** Rich loam, W by H, darker the deeper it goes, with strata, pebbles, roots and stones. The ground is cut from it. */
export function paintSoil(c: C, W: number, H: number) {
  const r = seeded(0x501);
  c.fillStyle = lin(c, 0, 290, 0, H, [[0, "#9b6a3e"], [0.3, "#83552f"], [0.62, "#6a4325"], [1, "#4a2e18"]]); c.fillRect(0, 0, W, H);
  for (let k = 0; k < 9; k++) {   // strata
    const y0 = 330 + k * 30 + r() * 12, a = r() < 0.5 ? `rgba(40,20,5,${0.07 + r() * 0.06})` : `rgba(255,210,160,${0.04 + r() * 0.04})`, ph = r() * TAU;
    c.strokeStyle = a; c.lineWidth = 3 + r() * 7; c.beginPath();
    for (let x = -10; x <= W + 10; x += 10) { const y = y0 + Math.sin(x / 45 + ph) * 4 + Math.sin(x / 13 + ph * 2) * 1.5; if (x === -10) c.moveTo(x, y); else c.lineTo(x, y); }
    c.stroke();
  }
  for (let i = 0; i < W * H * 0.04; i++) { c.fillStyle = r() < 0.5 ? `rgba(30,14,4,${0.08 + r() * 0.12})` : `rgba(255,220,180,${0.05 + r() * 0.08})`; c.fillRect(r() * W, 280 + r() * (H - 280), 0.6 + r() * 1.2, 0.6 + r()); }
  for (let i = 0; i < 26; i++) {   // fine roots near the top
    let x = r() * W, y = 300 + r() * 120; const n = 6 + r() * 10, a0 = Math.PI * (0.35 + r() * 0.3);
    c.strokeStyle = `rgba(214,170,120,${0.12 + r() * 0.12})`; c.lineWidth = 0.5 + r() * 0.6; c.beginPath(); c.moveTo(x, y);
    let a = a0; for (let s = 0; s < n; s++) { a += (r() - 0.5) * 0.8; x += Math.cos(a) * 4; y += Math.sin(a) * 4; c.lineTo(x, y); } c.stroke();
  }
  for (let i = 0; i < 70; i++) {   // pebbles and the odd stone, in loose clusters, more of them deeper down
    const cx = r() * W, cy = 320 + Math.sqrt(r()) * (H - 330), n = 1 + Math.floor(r() * r() * 5);
    for (let j = 0; j < n; j++) {
      const x = cx + (r() - 0.5) * 18, y = cy + (r() - 0.5) * 8, s = (0.7 + r() * r() * 3.2) * (y > 520 ? 1.35 : 1), tone = mix("#7d6a58", "#b8a48b", r());
      c.fillStyle = "rgba(25,12,3,0.28)"; ell(c, x + s * 0.3, y + s * 0.35, s, s * 0.7, r()); c.fill();
      c.fillStyle = rad(c, x, y, 0.2, s, [[0, rgba(lighter(tone, 0.18), 0.85)], [1, rgba(darker(tone, 0.32), 0.85)]], x - s * 0.35, y - s * 0.35); ell(c, x, y, s, s * 0.7, r()); c.fill();
    }
  }
  c.fillStyle = lin(c, 0, 568, 0, H, [[0, "rgba(30,18,10,0)"], [1, "rgba(30,18,10,0.35)"]]); c.fillRect(0, 568, W, H - 568);
}

/** The ground as it stands: soil cut to the hills, a lighter topsoil band, living grass wherever nothing has been dug
 *  (fresh dark earth where it has), and a gingham blanket under each basket. `sx` maps board x to screen x. */
export function paintGround(c: C, W: number, H: number, soil: HTMLCanvasElement, g: number[], g0: number[], sx: (x: number) => number,
  blankets: { x: number; col: string }[]) {
  const path = () => { c.beginPath(); c.moveTo(sx(0), H); for (let x = 0; x <= W; x += 2) c.lineTo(sx(x), g[x]); c.lineTo(sx(W), H); c.closePath(); };
  const top = (x0: number, x1: number, dy: number) => { c.beginPath(); for (let x = x0; x <= x1; x += 2) { if (x === x0) c.moveTo(sx(x), g[x] + dy); else c.lineTo(sx(x), g[x] + dy); } };
  const dug = (x: number) => g[x] > g0[x] + 1.5;
  const runs = (want: boolean) => { const out: [number, number][] = []; let s = -1; for (let x = 0; x <= W; x += 2) { const ok = dug(x) === want; if (ok && s < 0) s = x; if ((!ok || x + 2 > W) && s >= 0) { out.push([s, ok ? x : x - 2]); s = -1; } } return out; };
  // the soil, and a warmer topsoil band just under the surface
  c.save(); path(); c.clip();
  c.drawImage(soil, 0, 0, W, H);
  c.lineJoin = "round"; c.lineCap = "round";
  top(0, W, 14); c.strokeStyle = "rgba(255,206,150,0.13)"; c.lineWidth = 26; c.stroke();
  top(0, W, 5); c.strokeStyle = "rgba(255,214,160,0.12)"; c.lineWidth = 8; c.stroke();
  for (const [a, b] of runs(true)) {   // freshly dug: darker, damp earth with crumbs along the bite
    top(a, b, 3); c.strokeStyle = "rgba(48,24,8,0.45)"; c.lineWidth = 8; c.stroke();
    top(a, b, 0.5); c.strokeStyle = "rgba(70,38,14,0.9)"; c.lineWidth = 2.4; c.stroke();
    const r = seeded(a * 31 + b);
    for (let x = a; x <= b; x += 3) { const y = g[x] + 2 + r() * 6, s = 0.7 + r() * 1.6; c.fillStyle = r() < 0.5 ? "rgba(140,96,58,0.8)" : "rgba(40,20,6,0.6)"; ell(c, sx(x) + r() * 2, y, s, s * 0.7, r()); c.fill(); }
  }
  for (const [a, b] of runs(false)) { top(a, b, 9); c.strokeStyle = "rgba(36,18,4,0.32)"; c.lineWidth = 5; c.stroke(); }   // the shade under the turf
  c.restore();
  // the turf: a green band with light catching its top, blades standing up along it
  c.lineJoin = "round"; c.lineCap = "round";
  for (const [a, b] of runs(false)) {
    c.beginPath(); for (let x = a; x <= b; x += 2) { if (x === a) c.moveTo(sx(x), g[x] - 1); else c.lineTo(sx(x), g[x] - 1); } for (let x = b; x >= a; x -= 2) c.lineTo(sx(x), g[x] + 7.5); c.closePath();
    c.fillStyle = "#4f9a37"; c.fill();
    top(a, b, 5.8); c.strokeStyle = "rgba(30,70,15,0.55)"; c.lineWidth = 2.6; c.stroke();
    top(a, b, 0.4); c.strokeStyle = "#7cc64e"; c.lineWidth = 3; c.stroke();
    const r = seeded(a * 17 + 3);
    for (let x = a; x <= b; x += 1.3) {
      const xi = Math.min(b, Math.round(x)), y = g[xi] + 1.5, h = 3 + r() * 5, lean = (r() - 0.45) * 3.2, p = r();
      c.strokeStyle = p < 0.32 ? "#a9de72" : p < 0.7 ? "#6fb946" : "#4a8f33"; c.lineWidth = 0.9 + r() * 0.7;
      const X = sx(x); c.beginPath(); c.moveTo(X, y); c.quadraticCurveTo(X + lean * 0.4, y - h * 0.6, X + lean, y - h); c.stroke();
    }
    for (let x = a + 6; x < b - 4; x += 9 + r() * 26) {   // the odd daisy and clover
      const xi = Math.round(x), y = g[xi] - 2 - r() * 2, X = sx(x);
      if (r() < 0.55) { c.fillStyle = "#ffffff"; for (let k = 0; k < 5; k++) { const an = (k * TAU) / 5; circ(c, X + Math.cos(an) * 1.5, y + Math.sin(an) * 1.5, 1.05); c.fill(); } c.fillStyle = "#f4c430"; circ(c, X, y, 0.9); c.fill(); }
      else { c.fillStyle = "#3e8a2c"; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1.2]]) { circ(c, X + dx, y + dy + 1, 1.2); c.fill(); } }
    }
  }
  for (const bl of blankets) blanket(c, g, sx, bl.x, bl.col);
}
function blanket(c: C, g: number[], sx: (x: number) => number, fx: number, col: string) {
  const x0 = Math.max(0, fx - 36), x1 = Math.min(g.length - 1, fx + 36), th = 6.5;
  const band = () => { c.beginPath(); for (let x = x0; x <= x1; x++) { if (x === x0) c.moveTo(sx(x), g[x] - 2.8); else c.lineTo(sx(x), g[x] - 2.8); } for (let x = x1; x >= x0; x--) c.lineTo(sx(x), g[x] - 2.8 + th); c.closePath(); };
  shade(c, 3, 0.8, 1.6, "rgba(30,20,5,0.35)"); band(); c.fillStyle = "#f4f1ea"; c.fill(); noShade(c);
  c.save(); band(); c.clip();
  for (let x = x0; x < x1; x += 6) {   // gingham, the checks foreshortened
    const xi = Math.min(x1, x + 3), y = g[xi] - 2.8, odd = Math.round((x - x0) / 6) % 2 === 1, X0 = sx(x), X1 = sx(Math.min(x1, x + 6));
    if (odd) { c.fillStyle = rgba(col, 0.55); c.fillRect(Math.min(X0, X1), y - 1, Math.abs(X1 - X0), th + 2); }
    c.fillStyle = rgba(col, odd ? 0.5 : 0.45); c.fillRect(Math.min(X0, X1), y + th * 0.36, Math.abs(X1 - X0), th * 0.34);
  }
  for (let x = x0; x <= x1; x += 2) { const y = g[x] - 2.8; c.fillStyle = "rgba(0,0,0,0.05)"; c.fillRect(sx(x), y, 1, th); }   // the weave
  c.fillStyle = "rgba(255,255,255,0.35)"; for (let x = x0; x <= x1; x++) c.fillRect(sx(x), g[x] - 2.8, 1, 1);
  c.fillStyle = "rgba(40,20,5,0.22)"; for (let x = x0; x <= x1; x++) c.fillRect(sx(x), g[x] - 2.8 + th - 1.2, 1, 1.2);
  c.restore();
  // a rumpled corner turned up at each end
  for (const [ex, dir] of [[x0, -1], [x1, 1]] as [number, number][]) {
    const X = sx(ex), y = g[ex] - 2.8, d = dir * (sx(1) - sx(0));
    c.fillStyle = lighter(col, 0.55); c.beginPath(); c.moveTo(X, y); c.lineTo(X + d * 5, y + th + 1.5); c.lineTo(X - d * 2, y + th); c.closePath(); c.fill();
    c.strokeStyle = rgba(darker(col, 0.3), 0.5); c.lineWidth = 0.6; c.stroke();
  }
}

// ── baskets ────────────────────────────────────────────────────────────────
/** A wicker picnic basket in a 90 by 70 sprite; its bottom middle sits at (45, 62). Two lids, a gingham cloth peeking
 *  out, a bentwood handle, and a pennant in the player's colour pointing `flag` (+1 right, -1 left). */
export function paintBasket(c: C, col: string, flag: 1 | -1) {
  c.translate(45, 62);
  c.fillStyle = rad(c, 3, 0.5, 4, 34, [[0, "rgba(40,22,6,0.45)"], [1, "rgba(40,22,6,0)"]]); ell(c, 3, 0.5, 34, 5); c.fill();
  // the pennant on its dowel (behind the basket)
  const fx = flag * 14;   // the pole stands on the side toward the middle of the board
  c.strokeStyle = "#7a5230"; c.lineWidth = 2.2; c.lineCap = "round"; line(c, fx, -24, fx, -52);
  c.strokeStyle = "rgba(255,230,190,0.6)"; c.lineWidth = 0.7; line(c, fx - 0.5, -26, fx - 0.5, -51);
  c.beginPath(); c.moveTo(fx, -52); c.quadraticCurveTo(fx + flag * 8, -51, fx + flag * 16, -46.5); c.quadraticCurveTo(fx + flag * 8, -44, fx, -41.5); c.closePath();
  c.fillStyle = lin(c, fx, -52, fx + flag * 16, -42, [[0, lighter(col, 0.25)], [1, darker(col, 0.18)]]); c.fill();
  c.fillStyle = "rgba(255,255,255,0.35)"; c.beginPath(); c.moveTo(fx, -51.5); c.quadraticCurveTo(fx + flag * 8, -50.6, fx + flag * 14, -47); c.lineTo(fx, -48.5); c.closePath(); c.fill();
  c.fillStyle = "#e9c46a"; circ(c, fx, -53, 1.6); c.fill();
  // the handle: bentwood, wrapped in leather at the top
  c.lineCap = "round";
  c.strokeStyle = "#6e4620"; c.lineWidth = 4.6; c.beginPath(); c.arc(0, -27, 14.5, Math.PI, 0); c.stroke();
  c.strokeStyle = lin(c, -14, -42, 14, -28, [[0, "#e2b06e"], [0.5, "#b47a3c"], [1, "#8a5726"]]); c.lineWidth = 3.2; c.beginPath(); c.arc(0, -27, 14.5, Math.PI, 0); c.stroke();
  c.strokeStyle = "rgba(255,240,210,0.55)"; c.lineWidth = 0.8; c.beginPath(); c.arc(0, -27, 15.4, Math.PI * 1.08, Math.PI * 1.5); c.stroke();
  c.fillStyle = "#5a3418"; rr(c, -5.5, -44, 11, 5, 2.4); c.fill(); c.strokeStyle = "rgba(255,220,180,0.35)"; c.lineWidth = 0.6; for (let k = -4; k <= 4; k += 2) line(c, k, -43.6, k + 1, -39.4);
  // the body: a tapered wicker box, woven rows over stakes
  const body = () => { c.beginPath(); c.moveTo(-25, -22); c.lineTo(25, -22); c.lineTo(22, -2.5); c.quadraticCurveTo(21.6, 0, 19, 0); c.lineTo(-19, 0); c.quadraticCurveTo(-21.6, 0, -22, -2.5); c.closePath(); };
  shade(c, 4, 1.2, 2.4, "rgba(40,22,6,0.4)"); body(); c.fillStyle = "#a8733a"; c.fill(); noShade(c);
  c.save(); body(); c.clip();
  c.fillStyle = "#b9824a"; c.fillRect(-26, -23, 52, 24);
  for (let row = 0; row < 6; row++) {
    const y = -21.5 + row * 3.6, off = row % 2 ? 4 : 0;
    for (let x = -30 + off; x < 28; x += 8) {
      c.fillStyle = lin(c, 0, y, 0, y + 3.4, [[0, "#f0c98c"], [0.45, "#d7a462"], [1, "#a8733a"]]); rr(c, x + 0.4, y, 7.2, 3.3, 1.6); c.fill();
      c.fillStyle = "rgba(255,248,225,0.4)"; c.fillRect(x + 1.6, y + 0.5, 4.4, 0.6);
    }
  }
  for (let x = -24; x <= 24; x += 8) { c.fillStyle = "rgba(70,40,14,0.4)"; c.fillRect(x - 0.4 + (x % 16 ? 0 : 4), -22, 0.8, 22); }
  c.fillStyle = lin(c, -25, 0, 25, 0, [[0, "rgba(255,240,210,0.18)"], [0.35, "rgba(255,240,210,0)"], [0.8, "rgba(40,20,5,0.12)"], [1, "rgba(40,20,5,0.35)"]]); c.fillRect(-26, -23, 52, 24);
  c.fillStyle = lin(c, 0, -6, 0, 0, [[0, "rgba(40,20,5,0)"], [1, "rgba(40,20,5,0.35)"]]); c.fillRect(-26, -6, 52, 6);
  c.restore();
  // the braided rim and the two lids, a gingham cloth spilling out between them
  c.fillStyle = "#8a5a2a"; rr(c, -26.5, -25, 53, 4.6, 2.3); c.fill();
  c.fillStyle = lin(c, 0, -25, 0, -20.4, [[0, "#f2cf96"], [1, "#b47e44"]]); rr(c, -26.5, -25.4, 53, 4.2, 2.1); c.fill();
  c.strokeStyle = "rgba(110,66,26,0.55)"; c.lineWidth = 0.7; for (let x = -25; x < 26; x += 2.6) line(c, x, -25, x + 1.8, -21.4);
  c.save(); c.beginPath(); c.moveTo(-9, -24.6); c.quadraticCurveTo(-3, -33, 4, -30.5); c.quadraticCurveTo(9, -28.5, 11, -24.6); c.closePath(); c.clip();
  c.fillStyle = "#ffffff"; c.fillRect(-10, -34, 22, 10);
  for (let x = -10; x < 12; x += 3.4) { c.fillStyle = rgba(col, 0.55); c.fillRect(x, -34, 1.7, 10); }
  for (let y = -34; y < -24; y += 3.4) { c.fillStyle = rgba(col, 0.45); c.fillRect(-10, y, 22, 1.7); }
  c.fillStyle = lin(c, -9, -32, 10, -25, [[0, "rgba(255,255,255,0.25)"], [1, "rgba(0,0,0,0.2)"]]); c.fillRect(-10, -34, 22, 10);
  c.restore();
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -25 : 9, w = 16;
    c.fillStyle = "#93602c"; rr(c, x0, -28.6, w, 4.4, [2.2, 2.2, 1, 1]); c.fill();
    c.fillStyle = lin(c, 0, -29, 0, -24.4, [[0, "#f5d39c"], [1, "#c08a4c"]]); rr(c, x0, -29, w, 3.9, [2, 2, 1, 1]); c.fill();
    c.strokeStyle = "rgba(110,66,26,0.5)"; c.lineWidth = 0.5; for (let x = x0 + 2; x < x0 + w; x += 2.4) line(c, x, -28.6, x, -25);
  }
  c.fillStyle = "#c7cdd4"; rr(c, -1.4, -25.6, 2.8, 5.6, 1); c.fill(); c.fillStyle = "rgba(255,255,255,0.8)"; c.fillRect(-1, -25, 0.8, 4.4);   // the clasp
}

// ── effects ────────────────────────────────────────────────────────────────
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
/** A food landing, `k` from 0 to 1 over its half second: a flash, a ring along the ground, juice and clods flying, dust. */
export function drawImpact(c: C, x: number, y: number, k: number, col: string, r: number) {
  const seed = Math.round(x * 7 + y * 13), e = 1 - k;
  if (k < 0.3) { const f = 1 - k / 0.3; c.fillStyle = rad(c, x, y, 0, r * (0.5 + k), [[0, `rgba(255,252,236,${0.9 * f})`], [0.4, rgba(col, 0.5 * f)], [1, rgba(col, 0)]]); circ(c, x, y, r * (0.5 + k)); c.fill(); }
  c.strokeStyle = `rgba(255,255,255,${0.75 * e})`; c.lineWidth = 3 * e + 0.6; ell(c, x, y + 1, r * (0.3 + 0.95 * k), r * (0.3 + 0.95 * k) * 0.36); c.stroke();
  for (let i = 0; i < 3; i++) {   // dust
    const h0 = hash(seed + i * 5), dx = (h0 - 0.5) * r * 1.2, R = r * (0.25 + 0.6 * k) * (0.7 + h0 * 0.5);
    c.fillStyle = rad(c, x + dx, y - R * 0.5, 0, R, [[0, `rgba(196,160,120,${0.32 * e})`], [1, "rgba(196,160,120,0)"]]); circ(c, x + dx, y - R * 0.5, R); c.fill();
  }
  for (let i = 0; i < 7; i++) {   // clods of earth
    const h1 = hash(seed + i * 17), a = -Math.PI * (0.12 + 0.76 * h1), v = r * (0.6 + 0.7 * hash(seed + i * 29));
    const px = x + Math.cos(a) * v * k * 1.3, py = y + Math.sin(a) * v * k * 1.3 + 70 * k * k, s = (2.6 * e + 1) * (0.6 + h1 * 0.8);
    c.save(); c.translate(px, py); c.rotate(k * 6 + i); c.fillStyle = i % 2 ? "#6b4426" : "#8f6238"; rr(c, -s, -s * 0.7, s * 2, s * 1.4, s * 0.4); c.fill(); c.restore();
  }
  for (let i = 0; i < 12; i++) {   // juice
    const h1 = hash(seed + i * 7 + 3), a = -Math.PI * (0.05 + 0.9 * h1), v = r * (0.9 + 0.9 * hash(seed + i * 11));
    const px = x + Math.cos(a) * v * k * 1.25, py = y - 2 + Math.sin(a) * v * k * 1.25 + 90 * k * k, s = (3.4 * e + 0.8) * (0.55 + hash(seed + i * 13) * 0.7);
    c.fillStyle = darker(col, 0.15); circ(c, px, py, s); c.fill();
    c.fillStyle = lighter(col, 0.25); circ(c, px - s * 0.15, py - s * 0.2, s * 0.72); c.fill();
    c.fillStyle = `rgba(255,255,255,${0.85 * e})`; circ(c, px - s * 0.35, py - s * 0.35, s * 0.3); c.fill();
  }
}
/** The streak behind food in flight, tapering away from it. */
export function drawTrail(c: C, pts: { x: number; y: number }[], col: string) {
  const n = pts.length; if (n < 2) return;
  c.lineCap = "round";
  for (let j = 1; j < n; j++) {
    const t = j / n, a = pts[j - 1], b = pts[j];
    c.strokeStyle = `rgba(255,255,255,${0.5 * t})`; c.lineWidth = 0.6 + 4.6 * t; line(c, a.x, a.y, b.x, b.y);
    c.strokeStyle = rgba(col, 0.35 * t); c.lineWidth = 0.4 + 2 * t; line(c, a.x, a.y, b.x, b.y);
  }
}
/** A glazed chip in the food tray, centred in a (r+8)*2 square. */
export function paintChip(c: C, r: number) {
  const o = r + 8;
  c.fillStyle = "rgba(20,10,2,0.45)"; ell(c, o + 1.2, o + 3, r, r * 0.92); c.fill();
  shade(c, 5, 1, 3, "rgba(20,10,2,0.45)"); c.fillStyle = "#dfe4ea"; circ(c, o, o, r); c.fill(); noShade(c);
  c.fillStyle = lin(c, o - r, o - r, o + r, o + r, [[0, "#ffffff"], [0.55, "#f2f4f7"], [1, "#c5ccd5"]]); circ(c, o, o, r); c.fill();
  c.fillStyle = rad(c, o + 1, o + 1.4, 0, r * 0.76, [[0, "#ffffff"], [0.8, "#f4f6f8"], [1, "#e1e6ec"]]); circ(c, o, o, r * 0.76); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineWidth = 1.3; c.lineCap = "round"; c.beginPath(); c.arc(o, o, r - 1.2, Math.PI * 1.05, Math.PI * 1.45); c.stroke();
  gloss(c, o - r * 0.45, o - r * 0.5, r * 0.3, r * 0.14, 0.85);
  c.strokeStyle = "rgba(70,84,104,0.45)"; c.lineWidth = 0.7; circ(c, o, o, r - 0.35); c.stroke();
}

/** Builds the still layers: the sky, the soil texture, the sunlight over the scene, the tray chip. */
export function buildFightArt(k: number, W: number, H: number, chip: number) {
  const sky = layer(W, H, k); paintSky(sky.c, W, H);
  const soil = layer(W, H, k); paintSoil(soil.c, W, H);
  const light = layer(W, H, k); warmLight(light.c, W, H, { pool: 0.2, dark: 0.34, lx: 58, ly: 92, tone: "255,224,170", shadow: "40,20,0" });
  const tray = layer((chip + 8) * 2, (chip + 8) * 2, k); paintChip(tray.c, chip);
  return { k, sky: sky.cv, soil: soil.cv, light: light.cv, chip: tray.cv, baskets: new Map<string, HTMLCanvasElement>() };
}
export type FightArt = ReturnType<typeof buildFightArt>;
export function basketSprite(A: FightArt, col: string, flag: 1 | -1) {
  const key = `${col}${flag}`; let cv = A.baskets.get(key);
  if (!cv) { const L = layer(90, 70, A.k); paintBasket(L.c, col, flag); cv = L.cv; A.baskets.set(key, cv); }
  return cv;
}
