// Cart Rush's art: a real grocery aisle seen from behind the handle. Polished terrazzo floor tiles with ceiling lights
// reflected in them, metal shelving stocked with boxes, tins, jars, bottles, cartons and bags (no brand names), a
// chrome wire cart with a red plastic handle, glossy hazards, and the recipe card as a taped paper card.
// Everything still is painted once (per screen density) into canvases; the game scrolls and stamps them each frame.
import { type C, type Rnd, TAU, seeded, rr, circ, ell, line, lin, rad, shade, noShade, lighter, darker, rgba, layer, gloss, contact, rimArc, warmLight, CHROME } from "./paint";

export const TILE = 56, FLOOR_P = 224, BAY = 112, SHELF_P = 448;

// ── the floor ──────────────────────────────────────────────────────────────
/** The aisle floor between the shelves: a strip `fw` wide and `fh` tall whose pattern repeats every FLOOR_P, so it
 *  can scroll forever. Lane dividers sit on the grout lines at `lanes` (strip x). */
export function paintFloor(c: C, fw: number, fh: number, lanes: number[]) {
  const cols = Math.ceil(fw / TILE), rows = FLOOR_P / TILE;
  c.fillStyle = "#bdb5a8"; c.fillRect(0, 0, fw, fh);
  for (let j = 0; j * TILE < fh; j++) for (let i = 0; i < cols; i++) {
    const x = i * TILE, y = j * TILE, r2 = seeded(((j % rows) * 31 + i) * 977 + 5);
    const base = (i + j) % 2 ? "#ddd6ca" : "#efebe4", v = (r2() - 0.5) * 0.04, col = v > 0 ? lighter(base, v) : darker(base, -v);
    c.fillStyle = darker(col, 0.16); rr(c, x + 0.6, y + 0.6, TILE - 1.2, TILE - 1.2, 3); c.fill();
    c.fillStyle = lin(c, x, y, x + TILE, y + TILE, [[0, lighter(col, 0.12)], [0.6, col], [1, darker(col, 0.05)]]); rr(c, x + 1.1, y + 1.1, TILE - 2.2, TILE - 2.2, 2.6); c.fill();
    c.save(); rr(c, x + 1.1, y + 1.1, TILE - 2.2, TILE - 2.2, 2.6); c.clip();
    for (let q = 0; q < 46; q++) {   // terrazzo chips, fine and quiet
      const fx = x + r2() * TILE, fy = y + r2() * TILE, s = 0.3 + r2() * r2() * 1.5, p = r2();
      c.fillStyle = p < 0.4 ? `rgba(118,104,90,${0.08 + r2() * 0.12})` : p < 0.75 ? `rgba(255,255,255,${0.3 + r2() * 0.35})` : p < 0.9 ? `rgba(190,150,115,${0.1 + r2() * 0.14})` : `rgba(84,92,102,${0.08 + r2() * 0.12})`;
      ell(c, fx, fy, s, s * (0.55 + r2() * 0.5), r2() * 3); c.fill();
    }
    c.fillStyle = lin(c, x, y, x + TILE, y + TILE, [[0, "rgba(255,255,255,0)"], [0.28, "rgba(255,255,255,0.2)"], [0.4, "rgba(255,255,255,0)"], [0.7, "rgba(255,255,255,0.06)"], [0.8, "rgba(255,255,255,0)"]]);
    c.fillRect(x, y, TILE, TILE);
    c.restore();
    c.lineWidth = 0.9; c.strokeStyle = "rgba(255,255,255,0.75)"; c.beginPath(); c.moveTo(x + 1.6, y + TILE - 3); c.lineTo(x + 1.6, y + 1.6); c.lineTo(x + TILE - 3, y + 1.6); c.stroke();
    c.strokeStyle = "rgba(92,70,44,0.2)"; c.beginPath(); c.moveTo(x + 3, y + TILE - 1.4); c.lineTo(x + TILE - 1.4, y + TILE - 1.4); c.lineTo(x + TILE - 1.4, y + 3); c.stroke();
  }
  const rnd = seeded(0x5ee1f);
  const blobs: [number, number, string][] = [];   // the shelves' colours, smeared in the gloss near each side
  for (let k = 0; k < 16; k++) blobs.push([rnd() * FLOOR_P, rnd() < 0.5 ? 0 : 1, ["#c8443a", "#e0a83a", "#2f8f8a", "#2d4f8a", "#7a3d6a", "#e07b39"][Math.floor(rnd() * 6)]]);
  for (let base = -FLOOR_P; base < fh + FLOOR_P; base += FLOOR_P) {
    // a long ceiling light reflected down the middle of the aisle, and a fainter one each side
    for (const [cx, a, w] of [[fw / 2, 0.62, 38], [fw * 0.17, 0.3, 20], [fw * 0.83, 0.3, 20]] as [number, number, number][]) {
      const cy = base + FLOOR_P * 0.5;
      c.save(); c.translate(cx, cy); c.scale(w / 80, 1);
      c.fillStyle = rad(c, 0, 0, 0, 80, [[0, `rgba(255,251,240,${a})`], [0.35, `rgba(255,251,240,${a * 0.45})`], [1, "rgba(255,251,240,0)"]]); circ(c, 0, 0, 80); c.fill();
      c.restore();
      c.fillStyle = lin(c, 0, cy - 46, 0, cy + 46, [[0, "rgba(255,255,255,0)"], [0.5, `rgba(255,255,255,${a * 0.55})`], [1, "rgba(255,255,255,0)"]]); rr(c, cx - w * 0.06, cy - 46, w * 0.12, 92, 1); c.fill();
    }
    for (const [by, side, col] of blobs) {
      const cx = side ? fw - 6 : 6, cy = base + by;
      c.save(); c.translate(cx, cy); c.scale(0.42, 1);
      c.fillStyle = rad(c, 0, 0, 0, 30, [[0, rgba(col, 0.2)], [0.5, rgba(col, 0.08)], [1, rgba(col, 0)]]); circ(c, 0, 0, 30); c.fill(); c.restore();
    }
  }
  for (const lx of lanes) for (let y = -TILE; y < fh + TILE; y += TILE) {   // lane dividers: painted dashes on the grout line, a little worn
    const y0 = y + 13, h = 30;
    c.fillStyle = "rgba(255,255,255,0.7)"; rr(c, lx - 2.6, y0 - 0.6, 5.2, h + 1.2, 2.4); c.fill();
    c.fillStyle = lin(c, lx - 2.2, 0, lx + 2.2, 0, [[0, "#9a8f80"], [0.5, "#857a6b"], [1, "#74695b"]]); rr(c, lx - 2.2, y0, 4.4, h, 2); c.fill();
    c.fillStyle = "rgba(255,255,255,0.35)"; rr(c, lx - 1.6, y0 + 1, 1, h - 2, 0.5); c.fill();
    const r2 = seeded(Math.round(lx * 13 + (((y % FLOOR_P) + FLOOR_P) % FLOOR_P)));
    for (let q = 0; q < 6; q++) { c.fillStyle = `rgba(230,224,214,${0.25 + r2() * 0.3})`; c.fillRect(lx - 2 + r2() * 4, y0 + r2() * h, 0.6 + r2() * 0.8, 0.6); }
  }
}

// ── the shelves ────────────────────────────────────────────────────────────
const PACK = ["#c8443a", "#e0a83a", "#2f8f8a", "#2d4f8a", "#efe2c4", "#7d8a3a", "#7a3d6a", "#e07b39", "#3f6e4a", "#5a8fc9", "#d9634f", "#f2c14e"];
type Group = { kind: number; y: number; len: number; cols: string[] };
/** One side of the aisle, `sw` wide: a metal shelf stocked with groceries, the price rail on the aisle edge. Repeats
 *  every SHELF_P. `face` is +1 when the aisle is to the right of the shelf (the left side), -1 for the right side. */
export function paintShelf(c: C, sw: number, sh: number, face: 1 | -1, seed: number) {
  const rnd = seeded(seed), X = (u: number) => (face > 0 ? u : sw - u), xr = (u0: number, u1: number) => [Math.min(X(u0), X(u1)), Math.abs(X(u1) - X(u0))] as const;
  c.fillStyle = lin(c, 0, 0, sw, 0, face > 0 ? [[0, "#9ea5ae"], [0.2, "#c3c9d0"], [1, "#dde1e5"]] : [[0, "#dde1e5"], [0.8, "#c3c9d0"], [1, "#9ea5ae"]]); c.fillRect(0, 0, sw, sh);
  { const [bx, bw] = xr(0, 2.6); c.fillStyle = "#8e959e"; c.fillRect(bx, 0, bw, sh); }   // the back panel
  for (let y = 2; y < sh; y += 5) { const [bx] = xr(1.3, 1.3); c.fillStyle = "rgba(40,44,52,0.45)"; circ(c, bx, y, 0.45); c.fill(); }   // its pegboard holes
  const bays: Group[][] = [];
  for (let b = 0; b < SHELF_P / BAY; b++) {
    const gs: Group[] = []; let y = 5;
    while (y < BAY - 14) {
      const kind = Math.floor(rnd() * 6), len = Math.min(BAY - 3 - y, 22 + Math.floor(rnd() * 26));
      const cols = [PACK[Math.floor(rnd() * PACK.length)], PACK[Math.floor(rnd() * PACK.length)], PACK[Math.floor(rnd() * PACK.length)]];
      gs.push({ kind, y, len, cols }); y += len + 2 + rnd() * 3;
    }
    bays.push(gs);
  }
  for (let b = 0; b * BAY < sh + BAY; b++) {
    const y0 = b * BAY;
    for (const g of bays[b % bays.length]) group(c, g, y0 + g.y, X, xr, seeded(b % bays.length * 101 + Math.round(g.y)));
    // the upright between bays
    const [ux, uw] = xr(0, sw);
    c.fillStyle = "rgba(20,24,30,0.28)"; c.fillRect(ux, y0 + 1.6, uw, 2.4);
    c.fillStyle = lin(c, 0, y0 - 1.6, 0, y0 + 1.8, [[0, "#d8dde3"], [0.4, "#9aa2ac"], [1, "#5f6772"]]); c.fillRect(ux, y0 - 1.6, uw, 3.4);
  }
  // the price rail along the aisle edge, with tags
  const [rx, rw] = xr(sw - 5, sw);
  c.fillStyle = lin(c, rx, 0, rx + rw, 0, face > 0 ? [[0, "#c9ced5"], [0.3, "#f4f6f8"], [1, "#b3bac3"]] : [[0, "#b3bac3"], [0.7, "#f4f6f8"], [1, "#c9ced5"]]); c.fillRect(rx, 0, rw, sh);
  c.fillStyle = "rgba(40,44,52,0.35)"; c.fillRect(face > 0 ? rx - 0.6 : rx + rw - 0.2, 0, 0.8, sh);
  for (let y = 8; y < sh + 20; y += 28) {
    const yy = y + ((y * 7) % 5), promo = (Math.floor(yy / 28) % 5) === 2, tx = rx + 0.8;
    c.fillStyle = "rgba(20,24,30,0.22)"; c.fillRect(tx + 0.4, yy + 0.6, rw - 1.6, 8);
    c.fillStyle = promo ? "#ffd84a" : "#ffffff"; c.fillRect(tx, yy, rw - 1.6, 8);
    c.fillStyle = promo ? "#c8443a" : "rgba(30,40,60,0.55)"; c.fillRect(tx + 0.8, yy + 1.6, rw - 3.4, 1.2); c.fillRect(tx + 0.8, yy + 4.2, (rw - 3.4) * 0.6, 2);
  }
}
function group(c: C, g: Group, y: number, X: (u: number) => number, xr: (a: number, b: number) => readonly [number, number], r: Rnd) {
  const [c0, c1, c2] = g.cols, end = y + g.len;
  if (g.kind === 0) {   // cereal-style boxes standing in a row: their tops, and a sliver of the printed front
    const t = 6 + Math.floor(r() * 3), [bx, bw] = xr(4.5, 25);
    shade(c, 2.5, 0.8, 1.2, "rgba(30,30,40,0.4)"); c.fillStyle = darker(c0, 0.2); c.fillRect(bx, y, bw, g.len); noShade(c);
    for (let yy = y; yy + t <= end + 0.5; yy += t + 0.6) {
      const col = r() < 0.75 ? c0 : c1;
      c.fillStyle = lin(c, bx, yy, bx + bw, yy + t, [[0, lighter(col, 0.22)], [1, darker(col, 0.08)]]); c.fillRect(bx, yy, bw, t);
      const [fx, fw] = xr(22.4, 25); c.fillStyle = darker(col, 0.28); c.fillRect(fx, yy, fw, t);
      const [lx, lw] = xr(6, 21); c.fillStyle = "rgba(0,0,0,0.18)"; c.fillRect(lx, yy + t * 0.5, lw, 0.5); c.fillStyle = "rgba(255,255,255,0.3)"; c.fillRect(lx, yy + t * 0.5 + 0.5, lw, 0.4);
      c.fillStyle = "rgba(255,255,255,0.4)"; c.fillRect(bx, yy, bw, 0.6);
      c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(bx, yy + t - 0.5, bw, 0.5);
    }
  } else if (g.kind === 1 || g.kind === 2) {   // tins (steel lids) or jars (coloured lids on glass)
    const jar = g.kind === 2, R = jar ? 5 : 4.6, step = R * 2 + 0.8;
    for (let yy = y + R; yy + R <= end + 0.5; yy += step) for (const u of [9.6, 20.2]) {
      const x = X(u), col = r() < 0.6 ? c0 : c2;
      shade(c, 2, 0.7, 1.1, "rgba(30,30,40,0.45)"); c.fillStyle = jar ? "rgba(225,235,240,0.9)" : darker(col, 0.15); circ(c, x, yy, R); c.fill(); noShade(c);
      if (jar) {
        c.fillStyle = rad(c, x, yy, R * 0.5, R, [[0, "rgba(240,246,250,0.2)"], [1, "rgba(150,170,185,0.55)"]]); circ(c, x, yy, R); c.fill();
        c.fillStyle = lin(c, x - R, yy - R, x + R, yy + R, [[0, lighter(col, 0.35)], [0.55, col], [1, darker(col, 0.3)]]); circ(c, x, yy, R * 0.78); c.fill();
        c.strokeStyle = rgba(darker(col, 0.4), 0.5); c.lineWidth = 0.4; for (let k = 0; k < 14; k++) { const a = (k * TAU) / 14; line(c, x + Math.cos(a) * R * 0.66, yy + Math.sin(a) * R * 0.66, x + Math.cos(a) * R * 0.78, yy + Math.sin(a) * R * 0.78); }
        gloss(c, x - R * 0.3, yy - R * 0.32, R * 0.42, R * 0.22, 0.85);
      } else {
        c.fillStyle = col; circ(c, x, yy, R); c.fill();
        c.fillStyle = lin(c, x - R, yy - R, x + R, yy + R, [[0, "#ffffff"], [0.4, "#dfe4ea"], [0.7, "#a9b2bc"], [1, "#6c7682"]]); circ(c, x, yy, R * 0.84); c.fill();
        c.strokeStyle = "rgba(70,80,92,0.45)"; c.lineWidth = 0.35; circ(c, x, yy, R * 0.66); c.stroke(); circ(c, x, yy, R * 0.48); c.stroke();
        c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = 0.5; c.beginPath(); c.arc(x, yy, R * 0.8, Math.PI * 1.05, Math.PI * 1.45); c.stroke();
      }
    }
  } else if (g.kind === 3) {   // bottles: glass shoulders round a small cap
    const R = 3.5, step = 7.4; let row = 0;
    for (let yy = y + R; yy + R <= end + 0.5; yy += step * 0.86, row++) for (const u of row % 2 ? [8.5, 16.5] : [12.5, 20.5]) {
      const x = X(u), glass = r() < 0.5 ? "#3d7a46" : r() < 0.5 ? "#9a5a1e" : "#cfe3ea", cap = r() < 0.5 ? "#d9a63a" : c1;
      shade(c, 2, 0.6, 1, "rgba(30,30,40,0.45)"); c.fillStyle = darker(glass, 0.2); circ(c, x, yy, R); c.fill(); noShade(c);
      c.fillStyle = rad(c, x, yy, R * 0.3, R, [[0, lighter(glass, 0.35)], [1, darker(glass, 0.25)]], x - R * 0.35, yy - R * 0.35); circ(c, x, yy, R); c.fill();
      c.fillStyle = lin(c, x - 1.6, yy - 1.6, x + 1.6, yy + 1.6, [[0, lighter(cap, 0.4)], [1, darker(cap, 0.25)]]); circ(c, x, yy, 1.6); c.fill();
      c.strokeStyle = "rgba(255,255,255,0.7)"; c.lineWidth = 0.5; c.beginPath(); c.arc(x, yy, R * 0.82, Math.PI * 1.05, Math.PI * 1.5); c.stroke();
    }
  } else if (g.kind === 4) {   // cartons with gable tops
    const t = 9, [bx, bw] = xr(5, 23);
    for (let yy = y; yy + t <= end + 0.5; yy += t + 0.8) {
      const band = r() < 0.5 ? c0 : c1;
      shade(c, 2.5, 0.8, 1.2, "rgba(30,30,40,0.4)"); c.fillStyle = "#e9e6df"; c.fillRect(bx, yy, bw, t); noShade(c);
      c.fillStyle = lin(c, 0, yy, 0, yy + t / 2, [[0, "#ffffff"], [1, "#efede8"]]); c.fillRect(bx, yy, bw, t / 2);
      c.fillStyle = lin(c, 0, yy + t / 2, 0, yy + t, [[0, "#d6d2ca"], [1, "#bdb8ae"]]); c.fillRect(bx, yy + t / 2, bw, t / 2);
      c.fillStyle = band; c.fillRect(bx, yy + t * 0.18, bw, 1.4); c.fillRect(bx, yy + t * 0.7, bw, 1.4);
      c.fillStyle = "rgba(255,255,255,0.9)"; c.fillRect(bx, yy + t / 2 - 0.5, bw, 0.7);   // the ridge fin
      c.fillStyle = "rgba(80,70,60,0.35)"; c.fillRect(bx, yy + t / 2 + 0.2, bw, 0.4);
    }
  } else {   // pasta bags: soft pillows with a clear window and crimped ends
    const t = 13;
    for (let yy = y; yy + t <= end + 0.5; yy += t + 0.8) {
      const col = r() < 0.6 ? c0 : c2, [bx, bw] = xr(4.5, 24.5);
      shade(c, 3, 0.8, 1.4, "rgba(30,30,40,0.4)"); c.fillStyle = darker(col, 0.15); rr(c, bx, yy, bw, t, 4); c.fill(); noShade(c);
      c.fillStyle = rad(c, bx + bw * 0.4, yy + t * 0.4, 1, bw * 0.7, [[0, lighter(col, 0.3)], [1, darker(col, 0.18)]]); rr(c, bx, yy, bw, t, 4); c.fill();
      c.fillStyle = "rgba(246,214,140,0.95)"; rr(c, bx + bw * 0.3, yy + t * 0.3, bw * 0.4, t * 0.4, 2); c.fill();
      c.strokeStyle = "rgba(200,150,60,0.6)"; c.lineWidth = 0.4; for (let q = 0; q < 4; q++) line(c, bx + bw * (0.33 + q * 0.09), yy + t * 0.32, bx + bw * (0.36 + q * 0.09), yy + t * 0.68);
      c.fillStyle = "rgba(255,255,255,0.45)"; c.fillRect(bx + 1.5, yy + 1.2, bw - 3, 0.7);
      c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 0.5; line(c, bx + bw * 0.2, yy + 2, bx + bw * 0.28, yy + t - 2); line(c, bx + bw * 0.75, yy + 2, bx + bw * 0.7, yy + t - 2);
    }
  }
}

/** The light over the aisle: the left shelf's shadow on the floor, a warm pool from the top left, a vignette. */
export function paintAisleLight(c: C, W: number, H: number, shelf: number) {
  c.fillStyle = lin(c, shelf, 0, shelf + 20, 0, [[0, "rgba(46,30,12,0.32)"], [0.5, "rgba(46,30,12,0.1)"], [1, "rgba(46,30,12,0)"]]); c.fillRect(shelf, 0, 20, H);
  c.fillStyle = lin(c, W - shelf - 7, 0, W - shelf, 0, [[0, "rgba(46,30,12,0)"], [1, "rgba(46,30,12,0.18)"]]); c.fillRect(W - shelf - 7, 0, 7, H);
  warmLight(c, W, H, { pool: 0.17, dark: 0.36, lx: W * 0.14, ly: H * 0.1 });
}

// ── things on the floor ────────────────────────────────────────────────────
/** The dish an item sits on: a glossy white plate with a deep rim, its shadow on the floor. Drawn centred in a
 *  (r+12)*2 square. `listed` gives it an emerald band. */
export function paintPlate(c: C, r: number, listed: boolean) {
  const o = r + 12;
  contact(c, o, o + 2, r * 1.02, r * 0.95, 0.42);
  shade(c, 6, 2, 4, "rgba(40,24,10,0.34)"); c.fillStyle = "#e7eaee"; circ(c, o, o, r); c.fill(); noShade(c);
  c.fillStyle = lin(c, o - r, o - r, o + r, o + r, [[0, "#ffffff"], [0.5, "#f3f5f7"], [1, "#c3cad3"]]); circ(c, o, o, r); c.fill();
  if (listed) {
    c.strokeStyle = "#22a964"; c.lineWidth = 3.4; circ(c, o, o, r - 2.4); c.stroke();
    c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 0.9; c.beginPath(); c.arc(o, o, r - 3.4, Math.PI * 1.05, Math.PI * 1.5); c.stroke();
  } else { c.strokeStyle = "rgba(160,170,184,0.5)"; c.lineWidth = 0.7; circ(c, o, o, r - 3); c.stroke(); }
  c.fillStyle = lin(c, o - r * 0.7, o - r * 0.7, o + r * 0.7, o + r * 0.7, [[0, "#b9c1cb"], [0.5, "#e9ecef"], [1, "#ffffff"]]); circ(c, o, o, r * 0.72); c.fill();
  c.fillStyle = rad(c, o + r * 0.05, o + r * 0.07, 0, r * 0.67, [[0, "#ffffff"], [0.75, "#f6f7f9"], [1, "#e3e7ec"]]); circ(c, o, o, r * 0.67); c.fill();
  rimArc(c, o, o, r - 0.9, 1.4, 0.95, 0.35);
  gloss(c, o - r * 0.5, o - r * 0.56, r * 0.3, r * 0.14, 0.9);
  c.fillStyle = "rgba(90,70,50,0.18)"; ell(c, o + 2, o + r * 0.32, r * 0.48, r * 0.16); c.fill();   // where the food sits
  c.strokeStyle = "rgba(80,92,110,0.5)"; c.lineWidth = 0.7; circ(c, o, o, r - 0.35); c.stroke();
}
/** A puddle with a wet floor sign standing in it, centred at (50, 40) of a 100 by 84 sprite. */
export function paintSpill(c: C) {
  const x = 50, y = 40;
  // the water: a glossy sheet, darker at its edge where it bends the light, the ceiling lights in it
  const blob = (s: number) => { c.beginPath(); for (let k = 0; k <= 30; k++) { const a = (k / 30) * TAU, w = 1 + 0.07 * Math.sin(a * 3 + 1) + 0.05 * Math.cos(a * 5); const px = x + Math.cos(a) * 46 * w * s, py = y + 8 + Math.sin(a) * 22 * w * s; if (k) c.lineTo(px, py); else c.moveTo(px, py); } c.closePath(); };
  blob(1); c.fillStyle = "rgba(70,100,130,0.16)"; c.fill();
  blob(0.97); c.fillStyle = rad(c, x - 8, y + 4, 4, 50, [[0, "rgba(196,224,246,0.55)"], [0.7, "rgba(150,190,225,0.5)"], [1, "rgba(110,150,190,0.6)"]]); c.fill();
  blob(0.97); c.strokeStyle = "rgba(255,255,255,0.75)"; c.lineWidth = 0.9; c.stroke();
  c.save(); blob(0.97); c.clip();
  // the sign reflected in it
  c.globalAlpha = 0.28; c.save(); c.translate(0, 2 * (y + 15)); c.scale(1, -0.55); signShape(c, x, y); c.restore(); c.globalAlpha = 1;
  c.fillStyle = "rgba(255,255,255,0.7)"; ell(c, x - 22, y + 2, 11, 2.6, -0.12); c.fill();
  c.fillStyle = "rgba(255,255,255,0.45)"; ell(c, x + 20, y + 16, 9, 2, -0.1); c.fill();
  c.restore();
  for (const [dx, dy, s] of [[-40, -4, 2.2], [44, 0, 1.7], [36, 26, 1.4]]) { c.fillStyle = "rgba(150,190,225,0.6)"; ell(c, x + dx, y + dy, s * 1.4, s); c.fill(); c.fillStyle = "rgba(255,255,255,0.85)"; circ(c, x + dx - s * 0.4, y + dy - s * 0.3, s * 0.4); c.fill(); }
  // the sign's shadow, then the sign
  c.fillStyle = "rgba(30,40,60,0.28)"; c.beginPath(); c.moveTo(x - 13, y + 16); c.lineTo(x + 22, y + 16); c.lineTo(x + 30, y + 22); c.lineTo(x - 6, y + 22); c.closePath(); c.fill();
  signShape(c, x, y);
}
function signShape(c: C, x: number, y: number) {
  // the back leg, peeking out to the right
  c.fillStyle = lin(c, x, y - 22, x + 18, y + 16, [[0, "#d39b16"], [1, "#9c6d0a"]]);
  c.beginPath(); c.moveTo(x - 4, y - 23); c.lineTo(x + 8, y - 23); c.lineTo(x + 19, y + 15); c.lineTo(x + 13, y + 15); c.closePath(); c.fill();
  // the front panel
  c.beginPath(); c.moveTo(x - 9, y - 24); c.lineTo(x + 7, y - 24); c.quadraticCurveTo(x + 9, y - 24, x + 9.6, y - 22); c.lineTo(x + 14, y + 13); c.quadraticCurveTo(x + 14.2, y + 16, x + 11.4, y + 16);
  c.lineTo(x - 14.4, y + 16); c.quadraticCurveTo(x - 17.2, y + 16, x - 16.8, y + 13); c.lineTo(x - 11.6, y - 22); c.quadraticCurveTo(x - 11, y - 24, x - 9, y - 24); c.closePath();
  c.fillStyle = lin(c, x - 16, y - 24, x + 14, y + 16, [[0, "#ffe27a"], [0.45, "#ffcc2e"], [1, "#e5a812"]]); c.fill();
  c.strokeStyle = "#a8780c"; c.lineWidth = 0.9; c.stroke();
  c.fillStyle = "rgba(255,255,255,0.55)"; c.beginPath(); c.moveTo(x - 10.6, y - 21.6); c.lineTo(x - 8.6, y - 21.6); c.lineTo(x - 13.6, y + 12); c.lineTo(x - 15.2, y + 12); c.closePath(); c.fill();
  c.fillStyle = "#3a2a08"; rr(c, x - 4.5, y - 21.5, 9, 3, 1.5); c.fill();   // the handle slot
  // a warning triangle with a drawn exclamation mark
  c.beginPath(); c.moveTo(x - 1, y - 12); c.lineTo(x + 8.4, y + 6); c.lineTo(x - 10.4, y + 6); c.closePath(); c.fillStyle = "#1d1a14"; c.fill();
  c.beginPath(); c.moveTo(x - 1, y - 8.6); c.lineTo(x + 5.8, y + 4.2); c.lineTo(x - 7.8, y + 4.2); c.closePath(); c.fillStyle = "#ffcf33"; c.fill();
  c.fillStyle = "#1d1a14"; rr(c, x - 2.1, y - 4.6, 2.2, 5.4, 1.1); c.fill(); circ(c, x - 1, y + 2.6, 1.2); c.fill();
}
/** A stack of three cardboard boxes, centred at (50, 46) of a 100 by 92 sprite. */
export function paintBoxes(c: C) {
  const x = 50, y = 46;
  contact(c, x + 2, y + 24, 38, 9, 0.45);
  box(c, x - 26, y - 4, 32, 25, 10, "#c7925a", 1);
  box(c, x - 3, y - 6, 34, 27, 11, "#bd8a52", 2);
  box(c, x - 16, y - 33, 30, 22, 9, "#d19c62", 3);
}
function box(c: C, x: number, y: number, w: number, h: number, d: number, col: string, seed: number) {
  const r = seeded(seed * 71);
  shade(c, 6, 2, 4, "rgba(40,24,10,0.35)"); c.fillStyle = darker(col, 0.1); c.fillRect(x, y, w, h); noShade(c);
  // the top, seen a little from above
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + d * 0.5, y - d); c.lineTo(x + w + d * 0.5, y - d); c.lineTo(x + w, y); c.closePath();
  c.fillStyle = lin(c, x, y - d, x + w, y, [[0, lighter(col, 0.24)], [1, lighter(col, 0.08)]]); c.fill();
  c.fillStyle = "rgba(240,222,180,0.85)"; c.beginPath(); c.moveTo(x + w * 0.42, y); c.lineTo(x + w * 0.42 + d * 0.5, y - d); c.lineTo(x + w * 0.58 + d * 0.5, y - d); c.lineTo(x + w * 0.58, y); c.closePath(); c.fill();   // tape
  c.strokeStyle = "rgba(110,70,30,0.45)"; c.lineWidth = 0.6; line(c, x + w * 0.5 + d * 0.25, y - d * 0.5, x + w * 0.5 - 2 + d * 0.25, y - d * 0.5);
  // the side, in shade
  c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w + d * 0.5, y - d); c.lineTo(x + w + d * 0.5, y + h - d); c.lineTo(x + w, y + h); c.closePath();
  c.fillStyle = darker(col, 0.28); c.fill();
  // the front: corrugated board, the tape running down, a printed this-way-up mark
  c.fillStyle = lin(c, x, y, x, y + h, [[0, lighter(col, 0.04)], [1, darker(col, 0.12)]]); c.fillRect(x, y, w, h);
  for (let k = 0; k < 8; k++) { c.fillStyle = `rgba(110,70,30,${0.05 + r() * 0.06})`; c.fillRect(x + r() * w, y, 0.6, h); }
  c.fillStyle = "rgba(240,222,180,0.8)"; c.fillRect(x + w * 0.42, y, w * 0.16, h * 0.34);
  c.strokeStyle = "rgba(70,40,15,0.6)"; c.lineWidth = 1.1; c.lineCap = "round";
  for (const ax of [x + w * 0.2, x + w * 0.32]) { line(c, ax, y + h * 0.78, ax, y + h * 0.5); c.beginPath(); c.moveTo(ax - 2, y + h * 0.58); c.lineTo(ax, y + h * 0.5); c.lineTo(ax + 2, y + h * 0.58); c.stroke(); }
  c.strokeStyle = "rgba(70,40,15,0.5)"; c.lineWidth = 0.8; c.strokeRect(x + w * 0.66, y + h * 0.5, w * 0.2, h * 0.32);
  c.fillStyle = "rgba(255,240,210,0.35)"; c.fillRect(x, y, 0.8, h); c.fillStyle = "rgba(60,30,10,0.3)"; c.fillRect(x, y + h - 0.8, w, 0.8);
  c.strokeStyle = "rgba(70,40,15,0.35)"; c.lineWidth = 0.6; c.strokeRect(x, y, w, h);
}
/** A tin can lying on its side: the shadow, the steel ends and the label colour. Centred at (30, 26) of 60 by 52. */
export function paintCanBase(c: C, col: string) {
  const x = 30, y = 24;
  contact(c, x + 2, y + 14, 22, 6, 0.5);
  shade(c, 5, 1.6, 3.4, "rgba(40,24,10,0.4)"); c.fillStyle = "#8d97a2"; rr(c, x - 19, y - 12, 38, 24, 6); c.fill(); noShade(c);
  c.fillStyle = col; c.fillRect(x - 15, y - 12, 30, 24);
  for (const ex of [x - 19, x + 15]) {   // the rims, ribbed steel
    c.fillStyle = lin(c, 0, y - 12, 0, y + 12, [[0, "#6f7a87"], [0.25, "#f2f5f8"], [0.5, "#aeb7c1"], [0.75, "#7c8692"], [1, "#4f5862"]]); rr(c, ex, y - 12, 4, 24, ex < x ? [6, 0, 0, 6] : [0, 6, 6, 0]); c.fill();
    c.fillStyle = "rgba(40,48,58,0.4)"; c.fillRect(ex + (ex < x ? 3.4 : 0), y - 12, 0.6, 24);
  }
}
/** The label's turning stripes, drawn between the base and the shading so the can reads as rolling. */
export function canStripes(c: C, x: number, y: number, phase: number, col: string) {
  c.save(); c.beginPath(); c.rect(x - 15, y - 12, 30, 24); c.clip();
  const bands: [number, string, number][] = [[0, "#ffffff", 0.24], [0.32, darker(col, 0.25), 0.1], [0.5, "#f4e3b5", 0.16], [0.75, darker(col, 0.25), 0.06]];
  for (const [o, bc, wdt] of bands) for (const turn of [0, 1]) {
    const a = ((o + phase) % 1) * TAU + turn * TAU, s0 = Math.sin(a - wdt * Math.PI), s1 = Math.sin(a + wdt * Math.PI);
    if (Math.cos(a) < -0.15) continue;   // round the back
    const y0 = y + Math.min(s0, s1) * 12, y1 = y + Math.max(s0, s1) * 12;
    c.fillStyle = bc; c.fillRect(x - 15, y0, 30, Math.max(0.4, y1 - y0));
  }
  c.restore();
}
/** The cylinder's light and shade over the label, the same 60 by 52 box as the base. */
export function paintCanShade(c: C) {
  const x = 30, y = 24;
  c.fillStyle = lin(c, 0, y - 12, 0, y + 12, [[0, "rgba(0,0,0,0.38)"], [0.22, "rgba(255,255,255,0.0)"], [0.32, "rgba(255,255,255,0.5)"], [0.42, "rgba(255,255,255,0.05)"], [0.75, "rgba(0,0,0,0.12)"], [1, "rgba(0,0,0,0.45)"]]);
  c.fillRect(x - 15, y - 12, 30, 24);
  c.strokeStyle = "rgba(30,36,44,0.55)"; c.lineWidth = 0.7; rr(c, x - 19, y - 12, 38, 24, 6); c.stroke();
}

// ── the cart ───────────────────────────────────────────────────────────────
// From behind the handle: a chrome wire basket (the far wall, the sides and the floor are painted under the groceries;
// the near wall, the child seat, the frame, the handle and your hands go over them). Both are 120 by 120, centred.
const TOP = -46, BOT = 14, TW = 37, BW = 30;
const R = { tl: [-TW, TOP], tr: [TW, TOP], br: [BW, BOT], bl: [-BW, BOT] }, F = { tl: [-27, TOP + 9], tr: [27, TOP + 9], br: [22.5, BOT - 7], bl: [-22.5, BOT - 7] };
const lerp = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function wire(c: C, a: number[], b: number[], w = 0.95) {
  c.strokeStyle = "rgba(70,84,104,0.62)"; c.lineWidth = w; line(c, a[0] + 0.35, a[1] + 0.45, b[0] + 0.35, b[1] + 0.45);
  c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = w * 0.55; line(c, a[0] - 0.2, a[1] - 0.2, b[0] - 0.2, b[1] - 0.2);
}
function tube(c: C, pts: number[][], w: number, close = false) {
  const path = () => { c.beginPath(); pts.forEach(([x, y], i) => { if (i) c.lineTo(x, y); else c.moveTo(x, y); }); if (close) c.closePath(); };
  c.lineJoin = "round"; c.lineCap = "round";
  path(); c.strokeStyle = "#5d6773"; c.lineWidth = w + 1; c.stroke();
  path(); c.strokeStyle = lin(c, -40, -50, 40, 30, CHROME); c.lineWidth = w; c.stroke();
  c.save(); c.translate(-w * 0.18, -w * 0.22); path(); c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = w * 0.28; c.stroke(); c.restore();
}
export function paintCartBack(c: C) {
  c.translate(60, 60);
  // its shadow on the floor (the basket rides high on its wheels), and a tighter one under the frame
  c.save(); c.translate(7, 4); c.scale(1, 0.62); c.fillStyle = rad(c, 0, 0, 10, 56, [[0, "rgba(40,26,10,0.3)"], [0.6, "rgba(40,26,10,0.14)"], [1, "rgba(40,26,10,0)"]]); circ(c, 0, 0, 56); c.fill(); c.restore();
  c.save(); c.translate(4, BOT + 32); c.scale(1, 0.2); c.fillStyle = rad(c, 0, 0, 6, 48, [[0, "rgba(40,26,10,0.32)"], [1, "rgba(40,26,10,0)"]]); circ(c, 0, 0, 48); c.fill(); c.restore();
  for (const [wx, wy] of [[-TW - 3, TOP + 2], [TW - 4, TOP + 2], [-BW - 4, BOT - 4], [BW - 3, BOT - 4]]) {   // casters
    c.fillStyle = "rgba(30,20,10,0.35)"; ell(c, wx + 4.6, wy + 13.5, 5.5, 2); c.fill();
    c.fillStyle = lin(c, wx, 0, wx + 7, 0, [[0, "#5a6170"], [0.35, "#2b3039"], [1, "#16191e"]]); rr(c, wx, wy, 7, 13, 3.5); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.28)"; c.lineWidth = 0.8; line(c, wx + 1.4, wy + 3, wx + 1.4, wy + 10);
    c.fillStyle = lin(c, wx, wy + 4, wx + 7, wy + 9, CHROME); rr(c, wx + 1.6, wy + 4.6, 3.8, 3.8, 1.9); c.fill();
    c.fillStyle = lin(c, wx - 1, wy - 2, wx + 8, wy + 2, CHROME); rr(c, wx - 0.6, wy - 1.6, 8.2, 3.2, 1.4); c.fill();
  }
  const poly = (p: number[][]) => { c.beginPath(); p.forEach(([x, y], i) => { if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.closePath(); };
  // inside the basket: a pale steel tint, darker down on its floor
  poly([R.tl, R.tr, R.br, R.bl]); c.fillStyle = lin(c, 0, TOP, 0, BOT, [[0, "rgba(236,241,247,0.94)"], [1, "rgba(206,215,227,0.94)"]]); c.fill();
  poly([F.tl, F.tr, F.br, F.bl]); c.fillStyle = lin(c, 0, F.tl[1], 0, F.bl[1], [[0, "rgba(150,162,178,0.42)"], [1, "rgba(170,182,198,0.3)"]]); c.fill();
  c.fillStyle = "rgba(255,255,255,0.35)"; poly([R.tl, R.tr, F.tr, F.tl]); c.fill();   // the far wall catches the light
  for (let k = 1; k < 10; k++) wire(c, lerp(R.tl, R.tr, k / 10), lerp(F.tl, F.tr, k / 10));   // far wall
  for (let k = 1; k < 7; k++) { wire(c, lerp(R.tl, R.bl, k / 7), lerp(F.tl, F.bl, k / 7)); wire(c, lerp(R.tr, R.br, k / 7), lerp(F.tr, F.br, k / 7)); }   // sides
  for (const t of [0.5]) { wire(c, lerp(R.tl, F.tl, t), lerp(R.bl, F.bl, t)); wire(c, lerp(R.tr, F.tr, t), lerp(R.br, F.br, t)); wire(c, lerp(R.tl, F.tl, t), lerp(R.tr, F.tr, t)); }
  for (let k = 1; k < 8; k++) wire(c, lerp(F.tl, F.tr, k / 8), lerp(F.bl, F.br, k / 8), 0.8);   // floor
  for (let k = 1; k < 6; k++) wire(c, lerp(F.tl, F.bl, k / 6), lerp(F.tr, F.br, k / 6), 0.8);
  wire(c, F.tl, F.tr, 1.1); wire(c, F.tl, F.bl, 1.1); wire(c, F.tr, F.br, 1.1);
  tube(c, [R.bl, R.tl, R.tr, R.br], 2.6);   // the far and side rims
}
export function paintCartFront(c: C) {
  c.translate(60, 60);
  // the near wall over the groceries: see-through mesh
  const poly = (p: number[][]) => { c.beginPath(); p.forEach(([x, y], i) => { if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.closePath(); };
  poly([F.bl, F.br, R.br, R.bl]); c.fillStyle = "rgba(226,233,242,0.42)"; c.fill();
  for (let k = 1; k < 9; k++) wire(c, lerp(F.bl, F.br, k / 9), lerp(R.bl, R.br, k / 9));
  wire(c, lerp(F.bl, R.bl, 0.5), lerp(F.br, R.br, 0.5)); wire(c, F.bl, F.br, 1.1);
  // the child seat, folded flat against it: blue plastic with a hinge
  const sx = -BW + 4, sw = (BW - 4) * 2, sy = BOT - 13;
  shade(c, 3, 0.8, 1.6, "rgba(20,30,50,0.4)"); c.fillStyle = "#2a5ba8"; rr(c, sx, sy, sw, 10.5, 4); c.fill(); noShade(c);
  c.fillStyle = lin(c, 0, sy, 0, sy + 10.5, [[0, "#7fb2f5"], [0.45, "#3f7fd6"], [1, "#2a5ba8"]]); rr(c, sx, sy, sw, 10.5, 4); c.fill();
  c.fillStyle = "rgba(255,255,255,0.5)"; rr(c, sx + 3, sy + 1.2, sw - 6, 2.2, 1.1); c.fill();
  c.fillStyle = "rgba(20,40,80,0.35)"; for (const lx of [-9, 0, 9]) { rr(c, lx - 2.6, sy + 5, 5.2, 3, 1.5); c.fill(); }
  tube(c, [R.bl, R.br], 2.8);   // the near rim
  tube(c, [[-BW + 4, BOT], [-BW + 2, BOT + 13]], 2.6); tube(c, [[BW - 4, BOT], [BW - 2, BOT + 13]], 2.6);   // the frame down to the handle
  for (const side of [-1, 1]) {   // sleeves, fading toward you
    const hx = side * 24;
    c.fillStyle = lin(c, 0, BOT + 17, 0, BOT + 42, [[0, "#41557f"], [0.55, "rgba(52,70,108,0.75)"], [1, "rgba(52,70,108,0)"]]); rr(c, hx - 8.5, BOT + 17, 17, 25, 7); c.fill();
    c.strokeStyle = "rgba(20,30,55,0.35)"; c.lineWidth = 0.7; line(c, hx - 2, BOT + 22, hx - 3, BOT + 34); line(c, hx + 3.5, BOT + 21, hx + 4, BOT + 31);
  }
  // the handle: red plastic over a steel bar, chrome caps
  shade(c, 4, 1, 2.6, "rgba(30,20,10,0.4)"); c.fillStyle = "#a8262f"; rr(c, -41, BOT + 11, 82, 10, 5); c.fill(); noShade(c);
  c.fillStyle = lin(c, 0, BOT + 11, 0, BOT + 21, [[0, "#ff9aa1"], [0.3, "#ef5a65"], [0.7, "#cf3743"], [1, "#9e212b"]]); rr(c, -41, BOT + 11, 82, 10, 5); c.fill();
  c.fillStyle = "rgba(255,255,255,0.6)"; rr(c, -37, BOT + 12.4, 74, 2.2, 1.1); c.fill();
  for (const ex of [-44, 39]) { c.fillStyle = lin(c, 0, BOT + 10, 0, BOT + 22, CHROME); rr(c, ex, BOT + 10.4, 5, 11.2, 2); c.fill(); }
  for (const side of [-1, 1]) {   // hands round the grip
    const hx = side * 24;
    shade(c, 3, 0.6, 1.8, "rgba(60,30,10,0.35)"); c.fillStyle = "#e3ad7f"; rr(c, hx - 8, BOT + 9, 16, 13, 6); c.fill(); noShade(c);
    c.fillStyle = lin(c, hx - 8, BOT + 9, hx + 8, BOT + 22, [[0, "#fbdcb8"], [0.55, "#efc093"], [1, "#d39a6c"]]); rr(c, hx - 8, BOT + 9, 16, 13, 6); c.fill();
    c.strokeStyle = "rgba(150,90,55,0.45)"; c.lineWidth = 0.8;
    for (const fx of [-3.6, 0.4, 4.4]) line(c, hx + fx, BOT + 10.5, hx + fx - 0.4, BOT + 16);
    c.fillStyle = "rgba(255,255,255,0.4)"; for (const fx of [-5.6, -1.6, 2.4]) { rr(c, hx + fx, BOT + 10.2, 2.4, 1.6, 0.8); c.fill(); }
    c.fillStyle = "rgba(160,95,55,0.25)"; rr(c, hx - 7, BOT + 18.5, 14, 3, 1.5); c.fill();
  }
}

/** The lane pad's track: a flat white pad with a hairline pale blue edge and a soft shadow, like the kit's switches. */
export function paintPadTrack(c: C, x: number, y: number, w: number, h: number) {
  shade(c, 14, 0, 6, "rgba(31,70,140,0.22)"); c.fillStyle = "#ffffff"; rr(c, x, y, w, h, 15); c.fill(); noShade(c);
  c.strokeStyle = "#DCE8FA"; c.lineWidth = 1; rr(c, x + 0.5, y + 0.5, w - 1, h - 1, 14.5); c.stroke();
  for (let l = 1; l < 3; l++) { const lx = x + (w / 3) * l; c.fillStyle = "rgba(111,168,255,0.2)"; c.fillRect(lx - 0.5, y + 9, 1, h - 18); }
}

/** The recipe card along the top: cream card stock taped down at the corners, ruled lines, a shadow on the aisle. */
export function paintCard(c: C, W: number, H: number) {
  const x = 6, y = 5, w = W - 12, h = H - 10, rnd = seeded(0xca4d);
  shade(c, 12, 1, 5, "rgba(36,22,8,0.38)"); c.fillStyle = "#f3e9d6"; rr(c, x, y, w, h, 9); c.fill(); noShade(c);
  c.fillStyle = lin(c, 0, y, 0, y + h, [[0, "#fffdf8"], [0.6, "#fbf5e9"], [1, "#f2e7d2"]]); rr(c, x, y, w, h, 9); c.fill();
  c.save(); rr(c, x, y, w, h, 9); c.clip();
  for (let i = 0; i < w * h * 0.12; i++) { c.fillStyle = rnd() < 0.5 ? `rgba(150,120,80,${0.04 + rnd() * 0.06})` : `rgba(255,255,255,${0.3 + rnd() * 0.3})`; c.fillRect(x + rnd() * w, y + rnd() * h, 0.6 + rnd() * 0.8, 0.5); }
  c.fillStyle = "rgba(90,130,200,0.16)"; for (const ly of [31, 50, 69]) c.fillRect(x, ly, w, 0.8);
  c.fillStyle = lin(c, x + w - 60, y + h - 26, x + w, y + h, [[0, "rgba(120,90,50,0)"], [1, "rgba(120,90,50,0.12)"]]); c.fillRect(x + w - 60, y + h - 26, 60, 26);   // a slight lift at the corner
  c.restore();
  c.strokeStyle = "rgba(170,140,100,0.35)"; c.lineWidth = 0.8; rr(c, x + 0.4, y + 0.4, w - 0.8, h - 0.8, 9); c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 10, y + 1.2); c.lineTo(x + w - 10, y + 1.2); c.stroke();
  for (const [tx, ty, a, col] of [[x + 6, y + 2, -0.55, "#9fd8c7"], [x + w - 6, y + 2, 0.55, "#f6b3a6"]] as [number, number, number, string][]) {   // washi tape
    c.save(); c.translate(tx, ty); c.rotate(a);
    c.beginPath(); c.moveTo(-17, -5); for (let k = 0; k <= 4; k++) c.lineTo(-17 + (k % 2) * 1.2, -5 + k * 2.5); c.lineTo(17, 5); for (let k = 0; k <= 4; k++) c.lineTo(17 - (k % 2) * 1.2, 5 - k * 2.5); c.closePath();
    c.fillStyle = rgba(col, 0.82); c.fill();
    c.fillStyle = "rgba(255,255,255,0.35)"; c.fillRect(-16, -4, 32, 1.6);
    c.fillStyle = "rgba(255,255,255,0.22)"; for (let k = -14; k < 16; k += 5) c.fillRect(k, -5, 1.4, 10);
    c.restore();
  }
}

/** Builds every still layer of the aisle at `k` pixels per unit. */
export function buildCartArt(k: number, W: number, H: number, shelf: number, laneW: number, ir: number, hud: number, pad: { x: number; y: number; w: number; h: number }) {
  const fw = W - 2 * shelf;
  const floor = layer(fw, H + FLOOR_P, k); paintFloor(floor.c, fw, H + FLOOR_P, [laneW, laneW * 2]);
  const left = layer(shelf, H + SHELF_P, k); paintShelf(left.c, shelf, H + SHELF_P, 1, 0x51e1f);
  const right = layer(shelf, H + SHELF_P, k); paintShelf(right.c, shelf, H + SHELF_P, -1, 0x7a11e);
  const light = layer(W, H, k); paintAisleLight(light.c, W, H, shelf);
  const plate = layer((ir + 12) * 2, (ir + 12) * 2, k); paintPlate(plate.c, ir, false);
  const plateOn = layer((ir + 12) * 2, (ir + 12) * 2, k); paintPlate(plateOn.c, ir, true);
  const spill = layer(100, 84, k); paintSpill(spill.c);
  const boxes = layer(100, 92, k); paintBoxes(boxes.c);
  const canBase = layer(60, 52, k); paintCanBase(canBase.c, "#c8443a");
  const canShade = layer(60, 52, k); paintCanShade(canShade.c);
  const cartBack = layer(120, 120, k); paintCartBack(cartBack.c);
  const cartFront = layer(120, 120, k); paintCartFront(cartFront.c);
  const track = layer(pad.w + 20, pad.h + 20, k); paintPadTrack(track.c, 10, 6, pad.w, pad.h);
  const card = layer(W, hud + 12, k); paintCard(card.c, W, hud);
  return { k, floor: floor.cv, left: left.cv, right: right.cv, light: light.cv, plate: plate.cv, plateOn: plateOn.cv, spill: spill.cv, boxes: boxes.cv,
    canBase: canBase.cv, canShade: canShade.cv, cartBack: cartBack.cv, cartFront: cartFront.cv, track: track.cv, card: card.cv };
}
export type CartArt = ReturnType<typeof buildCartArt>;

/** A glossy heart (the cart's lives): full is red with a shine, empty is a pale outline. */
export function heart(c: C, x: number, y: number, s: number, full: boolean) {
  const path = () => {
    c.beginPath(); c.moveTo(x, y + s * 0.3);
    c.bezierCurveTo(x, y, x - s / 2, y, x - s / 2, y + s * 0.3);
    c.bezierCurveTo(x - s / 2, y + s * 0.6, x, y + s * 0.8, x, y + s);
    c.bezierCurveTo(x, y + s * 0.8, x + s / 2, y + s * 0.6, x + s / 2, y + s * 0.3);
    c.bezierCurveTo(x + s / 2, y, x, y, x, y + s * 0.3); c.closePath();
  };
  if (full) {
    shade(c, 2.5, 0.6, 1.4, "rgba(80,10,20,0.4)"); path(); c.fillStyle = "#c22f3b"; c.fill(); noShade(c);
    path(); c.fillStyle = lin(c, x - s / 2, y, x + s / 2, y + s, [[0, "#ff8c94"], [0.5, "#ec4c58"], [1, "#b8232f"]]); c.fill();
    c.fillStyle = "rgba(255,255,255,0.75)"; ell(c, x - s * 0.24, y + s * 0.22, s * 0.12, s * 0.07, -0.6); c.fill();
  } else {
    path(); c.fillStyle = "rgba(255,255,255,0.78)"; c.fill(); c.strokeStyle = "rgba(16,27,46,0.3)"; c.lineWidth = 1.3; c.stroke();
  }
}
