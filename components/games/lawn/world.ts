// The yard prepared for play: collision shapes, the 0.5 m lawn grid, which cells the mower can reach and mow, and the
// cat's walking map. Pure data and maths; no drawing.
import { vehiclePoly, propPoly, type LawnMap, type Pt, type Tree } from "../lawnMap";
import { type Shape, clamp, pip, polyShape, sd, lineDist, segClosest, polyClosest } from "./geo";

export const CELL = 0.5;
export const BODY_R = 0.85;      // the tractor's bump circle (life size: it's about 2 m long and 1.2 m wide)
export const NEED_R = 0.9;       // a lawn cell counts if a reachable tractor spot is this close; tighter spots count as trimmed
export const CAT_CLEAR = 0.35;

/** Trees only block at the trunk: canopies are overhead (and fade when the tractor is under them). */
export const trunkR = (t: Tree) => (t.kind === "well" ? t.r : t.kind === "spruce" ? Math.max(0.35, t.r * 0.22) : Math.max(0.28, t.r * 0.11));

export function buildWorld(map: LawnMap) {
  const W = map.size[0], H = map.size[1];
  const shapes: Shape[] = [];
  for (const b of map.buildings) shapes.push(polyShape(b.poly));
  for (const b of map.beds) shapes.push(polyShape(b.poly));
  for (const n of map.noGo) shapes.push(polyShape(n.poly));
  for (const v of map.vehicles) shapes.push(polyShape(vehiclePoly(v)));
  for (const pr of map.props) shapes.push(pr.kind === "firepit" ? { k: 1, x: pr.x, y: pr.y, r: pr.r ?? 0.6 } : polyShape(propPoly(pr)));
  for (const t of map.trees) shapes.push({ k: 1, x: t.x, y: t.y, r: trunkR(t) });
  for (const f of map.fences) for (let i = 1; i < f.length; i++) shapes.push({ k: 2, ax: f[i - 1][0], ay: f[i - 1][1], bx: f[i][0], by: f[i][1], r: 0.12 });
  const NX = Math.ceil(W / CELL), NY = Math.ceil(H / CELL), N = NX * NY;
  const lawn = new Uint8Array(N), free = new Uint8Array(N), catFree = new Uint8Array(N), need = new Uint8Array(N), clearance = new Float32Array(N);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const x = (i + 0.5) * CELL, y = (j + 0.5) * CELL, k = j * NX + i;
    let clear = Math.min(x, y, W - x, H - y);
    for (const s of shapes) {
      if (s.k === 0 && (x < s.x0 - 3 || x > s.x1 + 3 || y < s.y0 - 3 || y > s.y1 + 3)) { clear = Math.min(clear, Math.hypot(Math.max(s.x0 - x, 0, x - s.x1), Math.max(s.y0 - y, 0, y - s.y1))); continue; }
      clear = Math.min(clear, sd(s, x, y));
    }
    clearance[k] = clear;
    if (clear >= BODY_R) free[k] = 1;
    if (clear >= CAT_CLEAR) catFree[k] = 1;
    if (clear > 0 && map.lawn.some(p => pip(p, x, y)) && !map.driveway.some(p => pip(p, x, y)) && !map.pads.some(p => pip(p.poly, x, y))
      && !map.lanes.some(l => lineDist(l.pts, x, y) < l.width / 2) && !map.roads.some(l => lineDist(l.pts, x, y) < l.width / 2)) lawn[k] = 1;
  }
  const cellOf = (x: number, y: number) => clamp(Math.floor(y / CELL), 0, NY - 1) * NX + clamp(Math.floor(x / CELL), 0, NX - 1);
  const cellX = (k: number) => ((k % NX) + 0.5) * CELL, cellY = (k: number) => (Math.floor(k / NX) + 0.5) * CELL;
  const nearest = (mask: Uint8Array, x: number, y: number) => {
    let best = cellOf(x, y), bd = Infinity;
    for (let k = 0; k < N; k++) if (mask[k]) { const d = Math.hypot(cellX(k) - x, cellY(k) - y); if (d < bd) { bd = d; best = k; } }
    return best;
  };
  const bfs = (mask: Uint8Array, from: number) => {
    const dist = new Int32Array(N).fill(-1), q = new Int32Array(N); let h = 0, t = 0;
    dist[from] = 0; q[t++] = from;
    while (h < t) {
      const k = q[h++], i = k % NX, j = (k - i) / NX;
      const nb = [i > 0 ? k - 1 : -1, i < NX - 1 ? k + 1 : -1, j > 0 ? k - NX : -1, j < NY - 1 ? k + NX : -1];
      for (const n of nb) if (n >= 0 && mask[n] && dist[n] < 0) { dist[n] = dist[k] + 1; q[t++] = n; }
    }
    return dist;
  };
  // reachable tractor spots, and the lawn cells the deck can get to from them; anything else is left out of the count
  const startCell = free[cellOf(map.start.x, map.start.y)] ? cellOf(map.start.x, map.start.y) : nearest(free, map.start.x, map.start.y);
  const reachD = bfs(free, startCell);
  const reach = new Uint8Array(N); for (let k = 0; k < N; k++) if (reachD[k] >= 0) reach[k] = 1;
  const rc = Math.ceil(NEED_R / CELL), offs: number[][] = [];
  for (let dj = -rc; dj <= rc; dj++) for (let di = -rc; di <= rc; di++) if (Math.hypot(di, dj) * CELL <= NEED_R) offs.push([di, dj]);
  for (let k = 0; k < N; k++) if (reach[k]) {
    const i = k % NX, j = (k - i) / NX;
    for (const [di, dj] of offs) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= NX || b >= NY) continue; const n = b * NX + a; if (lawn[n]) need[n] = 1; }
  }
  // the cat's walking map: a distance field back to the door (she always finds her way home)
  const doorCell = catFree[cellOf(map.door.x, map.door.y)] ? cellOf(map.door.x, map.door.y) : nearest(catFree, map.door.x, map.door.y);
  const catD = bfs(catFree, doorCell);
  /** The cells of `base` that fall inside any of the polygons (all of them when there are none). */
  const maskIn = (base: Uint8Array, polys: Pt[][] | null) => {
    const out = new Uint8Array(N);
    for (let k = 0; k < N; k++) if (base[k] && (!polys || polys.some(p => pip(p, cellX(k), cellY(k))))) out[k] = 1;
    return out;
  };
  return { W, H, shapes, NX, NY, N, lawn, need, reach, free, clearance, catFree, catD, doorCell, cellOf, cellX, cellY, startCell, maskIn };
}
export type World = ReturnType<typeof buildWorld>;

/** Moves a circle out of every wall it overlaps. Returns the new spot and the push direction (for bumps). */
export function pushOut(w: World, x: number, y: number, r: number, extra: { x: number; y: number; r: number } | null) {
  let nx = 0, ny = 0;
  for (let it = 0; it < 3; it++) {
    let moved = false;
    for (const s of w.shapes) {
      if (s.k === 0) {
        if (x < s.x0 - r || x > s.x1 + r || y < s.y0 - r || y > s.y1 + r) continue;
        const { c, d } = polyClosest(s.pts, x, y), inside = pip(s.pts, x, y);
        if (inside) { const ux = (c[0] - x) / (d || 1), uy = (c[1] - y) / (d || 1); x = c[0] + ux * r; y = c[1] + uy * r; nx += ux; ny += uy; moved = true; }
        else if (d < r) { const ux = (x - c[0]) / (d || 1), uy = (y - c[1]) / (d || 1); x = c[0] + ux * r; y = c[1] + uy * r; nx += ux; ny += uy; moved = true; }
      } else {
        const c: Pt = s.k === 1 ? [s.x, s.y] : segClosest(s.ax, s.ay, s.bx, s.by, x, y), d = Math.hypot(x - c[0], y - c[1]), rr = r + s.r;
        if (d < rr) { const ux = (x - c[0]) / (d || 1), uy = (y - c[1]) / (d || 1); x = c[0] + ux * rr; y = c[1] + uy * rr; nx += ux; ny += uy; moved = true; }
      }
    }
    if (extra) { const d = Math.hypot(x - extra.x, y - extra.y), rr = r + extra.r; if (d < rr) { const ux = (x - extra.x) / (d || 1), uy = (y - extra.y) / (d || 1); x = extra.x + ux * rr; y = extra.y + uy * rr; nx += ux; ny += uy; moved = true; } }
    const cx = clamp(x, r, w.W - r), cy = clamp(y, r, w.H - r);
    if (cx !== x || cy !== y) { nx += Math.sign(cx - x); ny += Math.sign(cy - y); x = cx; y = cy; moved = true; }
    if (!moved) break;
  }
  const l = Math.hypot(nx, ny);
  return { x, y, nx: l ? nx / l : 0, ny: l ? ny / l : 0, hit: l > 0 };
}
