// The drawings for Kitchen Golf: each place in the kitchen (counter, table, fridge, sink, floor, stove, island,
// cupboard) with its surface and scenery, every prop, the cups, the moving parts, and the meatball, which turns as it
// rolls. Light comes from the top left, so shadows fall down and to the right. The still parts of a hole are drawn once
// into canvases (`paintHole`); the moving parts and the balls are drawn every frame.
import { type Course, type Zone, type Bump, type Block, type Deco, type Part, type Pt, BALL_R, CUP_R, MIXER_W, PIN_R, DOOR_W, W, burnerLit, mulberry32 } from "./sim";

type C = CanvasRenderingContext2D;
type Imgs = Record<string, HTMLImageElement>;
export const FOOD_IMGS = ["1f34e", "1f34a", "1f34b", "1f350", "1f9c0", "1f96c", "1f345", "1f966", "1f955", "1f95a", "1f33f"];

// ── little helpers ──
const TAU = Math.PI * 2;
function poly(c: C, p: Pt[]) { c.beginPath(); p.forEach(([x, y], i) => { if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.closePath(); }
function rr(c: C, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function circ(c: C, x: number, y: number, r: number) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
function shadow(c: C, blur = 8, ox = 3, oy = 5, a = 0.3) { c.shadowColor = `rgba(40,25,10,${a})`; c.shadowBlur = blur; c.shadowOffsetX = ox; c.shadowOffsetY = oy; }
function noShadow(c: C) { c.shadowColor = "transparent"; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; }
function lin(c: C, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, s]) => g.addColorStop(o, s)); return g; }
function rad(c: C, x: number, y: number, r0: number, r1: number, stops: [number, string][], fx = x, fy = y) { const g = c.createRadialGradient(fx, fy, r0, x, y, r1); stops.forEach(([o, s]) => g.addColorStop(o, s)); return g; }
const bbox = (p: Pt[]) => { const xs = p.map(q => q[0]), ys = p.map(q => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
function img(c: C, imgs: Imgs, code: string | undefined, x: number, y: number, s: number, rot = 0) {
  const im = code ? imgs[code] : undefined; if (!im || !im.complete || !im.naturalWidth) return;
  c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.drawImage(im, -s / 2, -s / 2, s, s); c.restore();
}

// ── materials ──
function woodPlanks(c: C, x0: number, y0: number, x1: number, y1: number, tones: string[], plank: number, rnd: () => number, vertical = true) {
  const n = Math.ceil(((vertical ? x1 - x0 : y1 - y0)) / plank);
  for (let i = 0; i < n; i++) {
    const a = (vertical ? x0 : y0) + i * plank;
    c.fillStyle = tones[Math.floor(rnd() * tones.length)];
    if (vertical) c.fillRect(a, y0, plank + 0.5, y1 - y0); else c.fillRect(x0, a, x1 - x0, plank + 0.5);
    c.strokeStyle = "rgba(60,30,10,0.13)"; c.lineWidth = 0.8;
    for (let k = 0; k < 4; k++) {                                   // grain
      const o = a + plank * (0.15 + rnd() * 0.7), w = 1 + rnd() * 2; c.beginPath();
      if (vertical) { c.moveTo(o, y0); for (let y = y0; y <= y1; y += 30) c.lineTo(o + Math.sin(y / 37 + i) * w, y); }
      else { c.moveTo(x0, o); for (let x = x0; x <= x1; x += 30) c.lineTo(x, o + Math.sin(x / 41 + i) * w); }
      c.stroke();
    }
    if (rnd() < 0.35) { const kx = vertical ? a + plank / 2 : x0 + rnd() * (x1 - x0), ky = vertical ? y0 + rnd() * (y1 - y0) : a + plank / 2; c.fillStyle = "rgba(80,40,15,0.18)"; c.beginPath(); c.ellipse(kx, ky, vertical ? 2 : 5, vertical ? 5 : 2, 0, 0, TAU); c.fill(); }
    c.fillStyle = "rgba(40,20,5,0.18)"; if (vertical) c.fillRect(a, y0, 0.8, y1 - y0); else c.fillRect(x0, a, x1 - x0, 0.8);
  }
}
function tiles(c: C, x0: number, y0: number, x1: number, y1: number, s: number, a: string, b: string, grout: string, rnd: () => number) {
  c.fillStyle = grout; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let y = y0, j = 0; y < y1; y += s, j++) for (let x = x0, i = 0; x < x1; x += s, i++) {
    c.fillStyle = (i + j) % 2 ? b : a; rr(c, x + 1, y + 1, s - 2, s - 2, 2); c.fill();
    c.fillStyle = `rgba(255,255,255,${0.06 + rnd() * 0.08})`; rr(c, x + 2, y + 2, s - 4, (s - 4) * 0.45, 2); c.fill();
  }
}
function subway(c: C, x0: number, y0: number, x1: number, y1: number) {
  c.fillStyle = "#d9dde2"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let y = y0, j = 0; y < y1; y += 18, j++) for (let x = x0 - (j % 2 ? 19 : 0); x < x1; x += 38) {
    c.fillStyle = lin(c, 0, y, 0, y + 17, [[0, "#ffffff"], [1, "#eef1f4"]]); rr(c, x + 1, y + 1, 36, 16, 3); c.fill();
  }
}
function stone(c: C, x0: number, y0: number, x1: number, y1: number, base: string, vein: string, rnd: () => number, speck = 0.12) {
  c.fillStyle = base; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  c.strokeStyle = vein; c.lineCap = "round";
  for (let k = 0; k < 9; k++) {                                     // soft veins
    let x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0); c.lineWidth = 0.6 + rnd() * 1.6; c.beginPath(); c.moveTo(x, y);
    for (let s = 0; s < 8; s++) { const nx = x + (rnd() - 0.3) * 70, ny = y + (rnd() - 0.5) * 50; c.quadraticCurveTo((x + nx) / 2 + (rnd() - 0.5) * 30, (y + ny) / 2 + (rnd() - 0.5) * 30, nx, ny); x = nx; y = ny; }
    c.stroke();
  }
  for (let k = 0; k < (x1 - x0) * (y1 - y0) * 0.004; k++) { c.fillStyle = rnd() < 0.5 ? `rgba(60,60,70,${speck})` : `rgba(255,255,255,${speck * 2})`; c.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 1.4, 1.4); }
}
function steel(c: C, x0: number, y0: number, x1: number, y1: number, rnd: () => number, dark = false) {
  c.fillStyle = lin(c, x0, y0, x1, y1, dark ? [[0, "#9aa3ad"], [0.5, "#c3cad2"], [1, "#8b949f"]] : [[0, "#d7dce1"], [0.45, "#eef1f4"], [1, "#c2c9d0"]]); c.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let y = y0; y < y1; y += 1.5) { c.fillStyle = `rgba(${rnd() < 0.5 ? "255,255,255" : "90,100,110"},${0.04 + rnd() * 0.05})`; c.fillRect(x0, y, x1 - x0, 0.7); }
}
function cabinetDoors(c: C, x0: number, y0: number, x1: number, y1: number, col: string, n: number) {
  const w = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * w;
    c.fillStyle = col; c.fillRect(x, y0, w, y1 - y0);
    c.strokeStyle = "rgba(0,0,0,0.12)"; c.lineWidth = 1.5; c.strokeRect(x + 1, y0 + 1, w - 2, y1 - y0 - 2);
    c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(x + 8, y0 + 8, w - 16, 2); c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(x + 8, y1 - 10, w - 16, 2);
    c.fillStyle = "#c9ced4"; rr(c, x + w / 2 - 12, y0 + 12, 24, 4, 2); c.fill();
  }
}

// ── each place: the scenery behind and around the hole, the surface you putt on, and the rails ──
type Look = { surface: (c: C, x0: number, y0: number, x1: number, y1: number, rnd: () => number) => void; rail: [string, string, string]; lip: number };
const LOOKS: Record<Course["place"], Look> = {
  counter: { surface: (c, a, b, x, y, r) => woodPlanks(c, a, b, x, y, ["#d9a066", "#cf9358", "#e0ab72", "#c98a4f", "#d69b5f"], 22, r), rail: ["#7a4a24", "#a8703f", "#5e3517"], lip: 7 },
  table: { surface: (c, a, b, x, y, r) => woodPlanks(c, a, b, x, y, ["#9a6438", "#8f5a30", "#a46d40", "#86522b"], 46, r, false), rail: ["#5e3517", "#7c4a26", "#3f220d"], lip: 8 },
  fridge: { surface: (c, a, b, x, y) => { c.fillStyle = lin(c, a, b, x, y, [[0, "#eef7fb"], [0.5, "#dceef6"], [1, "#e8f4f9"]]); c.fillRect(a, b, x - a, y - b);
    c.fillStyle = "rgba(255,255,255,0.55)"; for (const o of [0.15, 0.55]) { c.beginPath(); c.moveTo(a + (x - a) * o, b); c.lineTo(a + (x - a) * (o + 0.12), b); c.lineTo(a + (x - a) * (o - 0.1), y); c.lineTo(a + (x - a) * (o - 0.2), y); c.fill(); } },
    rail: ["#e9edf1", "#ffffff", "#b9c2cb"], lip: 7 },
  sink: { surface: (c, a, b, x, y, r) => steel(c, a, b, x, y, r, true), rail: ["#aeb6bf", "#e6eaee", "#7d8792"], lip: 6 },
  floor: { surface: (c, a, b, x, y, r) => tiles(c, a, b, x, y, 40, "#efe6d6", "#d9cdb8", "#bfb3a0", r), rail: ["#f4f1ea", "#ffffff", "#b8b0a2"], lip: 6 },
  stove: { surface: (c, a, b, x, y) => { c.fillStyle = lin(c, a, b, x, y, [[0, "#22252b"], [0.5, "#30343b"], [1, "#1b1d22"]]); c.fillRect(a, b, x - a, y - b);
    c.fillStyle = "rgba(255,255,255,0.05)"; c.beginPath(); c.moveTo(a, b + 60); c.lineTo(a + 120, b); c.lineTo(a + 170, b); c.lineTo(a, b + 120); c.fill(); }, rail: ["#a9b1ba", "#e3e7eb", "#6e7782"], lip: 6 },
  island: { surface: (c, a, b, x, y, r) => stone(c, a, b, x, y, "#f1efec", "rgba(130,125,120,0.28)", r, 0.08), rail: ["#cfcac4", "#ffffff", "#9d978f"], lip: 7 },
  cupboard: { surface: (c, a, b, x, y, r) => woodPlanks(c, a, b, x, y, ["#f2e6d0", "#eedfc5", "#f5ead6"], 60, r, false), rail: ["#b98e5c", "#d8b283", "#8a6236"], lip: 7 },
};
function background(c: C, k: Course, rnd: () => number) {
  const H = k.h;
  switch (k.place) {
    case "counter":
      subway(c, 0, 0, W, 168); c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(0, 160, W, 8);
      LOOKS.counter.surface(c, 0, 160, W, 556, rnd);
      c.fillStyle = lin(c, 0, 552, 0, 566, [[0, "#b07a46"], [1, "#7a4a24"]]); c.fillRect(0, 552, W, 14);
      cabinetDoors(c, 0, 566, W, H, "#9fb8a4", 4); break;
    case "table": tiles(c, 0, 0, W, H, 50, "#e9e1d3", "#ddd2c0", "#c6baa6", rnd); break;
    case "fridge": c.fillStyle = lin(c, 0, 0, W, 0, [[0, "#cfd7de"], [0.12, "#f4f7f9"], [0.88, "#f4f7f9"], [1, "#cfd7de"]]); c.fillRect(0, 0, W, H);
      for (const y of [118, H - 40]) { c.fillStyle = "rgba(160,175,190,0.5)"; c.fillRect(20, y, W - 40, 6); } break;
    case "sink": stone(c, 0, 0, W, H, "#5c6168", "rgba(230,230,235,0.25)", rnd, 0.3); break;
    case "floor": tiles(c, 0, 0, W, H, 40, "#efe6d6", "#d9cdb8", "#bfb3a0", rnd);
      c.fillStyle = "#8c6a48"; c.fillRect(0, 0, 54, H); c.fillRect(W - 54, 0, 54, H);
      for (const x0 of [0, W - 54]) { for (let y = 0; y < H; y += 120) { c.fillStyle = "#a07c57"; rr(c, x0 + 6, y + 6, 42, 108, 4); c.fill(); c.strokeStyle = "rgba(0,0,0,0.15)"; c.stroke(); } }
      c.fillStyle = "#3b3330"; c.fillRect(54, 0, 6, H); c.fillRect(W - 60, 0, 6, H); break;
    case "stove": steel(c, 0, 0, W, H, rnd); c.fillStyle = "#2b2f35"; c.fillRect(0, 0, W, 80); break;
    case "island": woodPlanks(c, 0, 0, W, H, ["#b98a5b", "#c4966a", "#ae7f52", "#bd8f62"], 34, rnd, false); break;
    case "cupboard": c.fillStyle = lin(c, 0, 0, W, 0, [[0, "#7a5636"], [0.1, "#a27a52"], [0.9, "#a27a52"], [1, "#7a5636"]]); c.fillRect(0, 0, W, 452);
      c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(0, 446, W, 6);
      woodPlanks(c, 0, 452, W, H, ["#d9a066", "#cf9358", "#e0ab72"], 22, rnd); break;
  }
}

// ── props ──
function drawBump(c: C, u: Bump, imgs: Imgs) {
  const { x, y, r } = u;
  switch (u.k) {
    case "fruitbowl": {
      shadow(c, 10, 3, 6); c.fillStyle = "#f7f4ef"; circ(c, x, y, r); c.fill(); noShadow(c);
      c.fillStyle = rad(c, x, y, 2, r * 0.8, [[0, "#ffffff"], [1, "#e8e2d8"]]); circ(c, x, y, r * 0.8); c.fill();
      c.strokeStyle = "#5d8fc9"; c.lineWidth = 2.5; circ(c, x, y, r - 2.5); c.stroke();
      const f = u.f ?? "1f34e", s = r * 0.62;
      img(c, imgs, f === "1f34a" ? "1f34a" : "1f350", x - r * 0.28, y + r * 0.18, s, 0.3); img(c, imgs, "1f34b", x + r * 0.3, y + r * 0.12, s * 0.9, -0.4); img(c, imgs, f, x, y - r * 0.22, s, 0.1); break;
    }
    case "pepper": shadow(c, 6, 2, 5); c.fillStyle = rad(c, x, y, 1, r, [[0, "#7a4e30"], [1, "#3b2414"]], x - r * 0.4, y - r * 0.4); circ(c, x, y, r); c.fill(); noShadow(c);
      c.strokeStyle = "rgba(255,255,255,0.18)"; c.lineWidth = 1; circ(c, x, y, r * 0.75); c.stroke(); steelCircle(c, x, y, r * 0.42); c.fillStyle = "#6e7782"; circ(c, x, y, r * 0.14); c.fill(); break;
    case "plate": shadow(c, 8, 2, 4, 0.22); c.fillStyle = "#fbfbfa"; circ(c, x, y, r); c.fill(); noShadow(c); c.strokeStyle = "#dfe3e8"; c.lineWidth = 2; circ(c, x, y, r * 0.66); c.stroke();
      c.strokeStyle = "#7da6d6"; c.lineWidth = 1.5; circ(c, x, y, r - 3); c.stroke(); break;
    case "glass": c.fillStyle = "rgba(200,230,245,0.55)"; circ(c, x, y, r); c.fill(); c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 1.5; circ(c, x, y, r - 1); c.stroke(); c.fillStyle = "rgba(120,180,220,0.35)"; circ(c, x, y, r * 0.6); c.fill(); break;
    case "bottle": shadow(c, 6, 2, 4); c.fillStyle = rad(c, x, y, 1, r, [[0, u.col ?? "#d8343a"], [1, "rgba(0,0,0,0.55)"]], x - r * 0.4, y - r * 0.4); circ(c, x, y, r); c.fill(); noShadow(c);
      c.fillStyle = "#f4f4f4"; circ(c, x, y, r * 0.5); c.fill(); c.fillStyle = u.col ?? "#d8343a"; circ(c, x, y, r * 0.22); c.fill(); break;
    case "jamjar": shadow(c, 6, 2, 4); c.fillStyle = "#b8283a"; circ(c, x, y, r); c.fill(); noShadow(c); c.fillStyle = "#e9e3d6"; circ(c, x, y, r * 0.8); c.fill();
      c.strokeStyle = "#c33"; c.lineWidth = 1; for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; c.beginPath(); c.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3); c.lineTo(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75); c.stroke(); } break;
    case "food": shadow(c, 6, 2, 4, 0.25); c.fillStyle = "rgba(0,0,0,0.01)"; circ(c, x, y, r * 0.8); c.fill(); noShadow(c); img(c, imgs, u.f, x, y, r * 2.3); break;
    case "mug": shadow(c, 7, 2, 5); c.fillStyle = "#3f7fd6"; circ(c, x, y, r); c.fill(); rr(c, x + r - 2, y - 4, 9, 8, 3); c.fill(); noShadow(c);
      c.fillStyle = "#4a2c18"; circ(c, x, y, r * 0.74); c.fill(); c.fillStyle = "rgba(255,255,255,0.25)"; circ(c, x - r * 0.25, y - r * 0.25, r * 0.22); c.fill(); break;
    case "pan": shadow(c, 9, 3, 6); c.fillStyle = "#2c2f35"; circ(c, x, y, r); c.fill(); noShadow(c); c.fillStyle = rad(c, x, y, 2, r * 0.86, [[0, "#4b5059"], [1, "#2a2d33"]], x - r * 0.3, y - r * 0.3); circ(c, x, y, r * 0.86); c.fill();
      img(c, imgs, "1f95a", x + 4, y - 2, r * 1.1); break;
    case "potbig": shadow(c, 9, 3, 6); steelCircle(c, x, y, r); noShadow(c); c.fillStyle = "#c7cdd4"; for (const s of [-1, 1]) { rr(c, x + s * (r + 1) - 5, y - 4, 10, 8, 3); c.fill(); }
      c.fillStyle = rad(c, x, y, 2, r * 0.8, [[0, "#d8dde2"], [1, "#9aa3ad"]]); circ(c, x, y, r * 0.8); c.fill(); c.fillStyle = "#3a3f46"; circ(c, x, y, 5); c.fill(); break;
    case "can": shadow(c, 6, 2, 5); c.fillStyle = "#c9ced4"; circ(c, x, y, r); c.fill(); noShadow(c); c.strokeStyle = u.col ?? "#d8343a"; c.lineWidth = 4; circ(c, x, y, r - 2); c.stroke();
      c.strokeStyle = "rgba(0,0,0,0.15)"; c.lineWidth = 1; circ(c, x, y, r * 0.62); c.stroke(); c.fillStyle = "#aab2bb"; rr(c, x - 4, y - r * 0.5, 8, 5, 2); c.fill(); break;
    case "cutter": c.strokeStyle = "#c9ced4"; c.lineWidth = 3; shadow(c, 4, 1, 3, 0.25);
      c.beginPath(); for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (i * TAU) / 10, rr2 = i % 2 ? r * 0.5 : r; if (i) c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); else c.moveTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } c.closePath(); c.stroke(); noShadow(c); break;
    case "canister": shadow(c, 6, 2, 4); c.fillStyle = "#e8505b"; circ(c, x, y, r); c.fill(); noShadow(c); c.fillStyle = "#f6f1ea"; circ(c, x, y, r * 0.6); c.fill(); break;
    case "leg": shadow(c, 4, 2, 3, 0.35); c.fillStyle = "#6b4426"; circ(c, x, y, r); c.fill(); noShadow(c); break;
    case "dog": break;   // drawn with the dog
  }
}
function steelCircle(c: C, x: number, y: number, r: number) { c.fillStyle = lin(c, x - r, y - r, x + r, y + r, [[0, "#eef1f4"], [0.5, "#b9c1ca"], [1, "#8d97a2"]]); circ(c, x, y, r); c.fill(); }
function drawBlock(c: C, b: Block, rnd: () => number) {
  const [x0, y0, x1, y1] = bbox(b.p), w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  switch (b.k) {
    case "fork": case "knife": shadow(c, 3, 1, 2, 0.3); c.fillStyle = lin(c, x0, 0, x1, 0, [[0, "#d7dce2"], [0.5, "#ffffff"], [1, "#aeb6bf"]]); rr(c, x0, y0, w, h, 2.5); c.fill(); noShadow(c);
      c.fillStyle = "#4a3426"; rr(c, x0, y0 + h * 0.55, w, h * 0.45, 2.5); c.fill(); break;
    case "carton": shadow(c, 9, 3, 6); c.fillStyle = "#ffffff"; rr(c, x0, y0, w, h, 3); c.fill(); noShadow(c); c.fillStyle = "#3f7fd6"; c.fillRect(x0, y0 + h * 0.62, w, h * 0.38);
      c.fillStyle = "#e8edf2"; c.beginPath(); c.moveTo(x0, cy); c.lineTo(cx, y0 + 4); c.lineTo(x1, cy); c.fill(); c.strokeStyle = "rgba(0,0,0,0.1)"; c.stroke(); break;
    case "eggs": shadow(c, 7, 2, 5); c.fillStyle = "#c9b79a"; rr(c, x0, y0, w, h, 6); c.fill(); noShadow(c);
      for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) { const ex = x0 + w * (i + 0.5) / 4, ey = y0 + h * (j + 0.5) / 2; c.fillStyle = rad(c, ex, ey, 1, 11, [[0, "#fffaf0"], [1, "#e6d4b6"]], ex - 3, ey - 3); c.beginPath(); c.ellipse(ex, ey, 10, 11, 0, 0, TAU); c.fill(); } break;
    case "sponge": shadow(c, 6, 2, 4); c.fillStyle = "#f2d64b"; rr(c, x0, y0, w, h, 5); c.fill(); noShadow(c); c.fillStyle = "#3f9b52"; rr(c, x0, y0, w, h * 0.38, 5); c.fill();
      c.fillStyle = "rgba(160,120,20,0.35)"; for (let i = 0; i < 14; i++) { circ(c, x0 + 4 + rnd() * (w - 8), y0 + h * 0.45 + rnd() * h * 0.5, 1.2); c.fill(); } break;
    case "broom": { const [a, bb, cc, d] = b.p, ax = (a[0] + d[0]) / 2, ay = (a[1] + d[1]) / 2, bx = (bb[0] + cc[0]) / 2, by = (bb[1] + cc[1]) / 2;
      shadow(c, 5, 2, 4); c.strokeStyle = lin(c, ax, ay, bx, by, [[0, "#c58b4e"], [1, "#e0a868"]]); c.lineWidth = 8; c.lineCap = "round"; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); noShadow(c);
      c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 2; c.beginPath(); c.moveTo(ax, ay - 2); c.lineTo(bx, by - 2); c.stroke(); c.fillStyle = "#e8505b"; circ(c, bx, by, 5); c.fill(); break; }
    case "panhandle": shadow(c, 4, 2, 3); c.fillStyle = "#1e2025"; rr(c, x0, y0, w, h, 4); c.fill(); noShadow(c); break;
    case "cookbook": shadow(c, 8, 3, 6); c.fillStyle = "#b8463c"; rr(c, x0 - 3, y0 - 3, w + 6, h + 6, 3); c.fill(); noShadow(c); c.fillStyle = "#fbf7ee"; c.fillRect(x0, y0, w, h);
      c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(cx - 1, y0, 2, h); c.fillStyle = "rgba(90,90,90,0.4)"; for (let i = 0; i < 6; i++) { c.fillRect(x0 + 5, y0 + 8 + i * 8, w / 2 - 10, 2); c.fillRect(cx + 5, y0 + 8 + i * 8, w / 2 - 10, 2); }
      img(c, {}, undefined, 0, 0, 0); break;
    case "coffeemaker": shadow(c, 10, 3, 7); c.fillStyle = "#2d3036"; rr(c, x0, y0, w, h, 8); c.fill(); noShadow(c); c.fillStyle = "rgba(140,200,240,0.4)"; circ(c, cx, cy + 6, w * 0.3); c.fill();
      c.fillStyle = "#4a2c18"; circ(c, cx, cy + 6, w * 0.18); c.fill(); c.fillStyle = "#e8505b"; circ(c, x0 + 10, y0 + 10, 3); c.fill(); break;
    case "toaster": toaster(c, cx, cy, w, h); break;
    case "blender": shadow(c, 9, 3, 6); c.fillStyle = "#c9ced4"; rr(c, x0, y0, w, h, 10); c.fill(); noShadow(c); c.fillStyle = "rgba(200,235,250,0.7)"; circ(c, cx, cy, w * 0.38); c.fill();
      c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, w * 0.3, 3.6, 4.6); c.stroke(); c.fillStyle = "#2d3036"; circ(c, cx, cy, 5); c.fill(); break;
    case "cereal": case "pasta": shadow(c, 9, 3, 6); c.fillStyle = b.col ?? "#e8a43a"; rr(c, x0, y0, w, h, 3); c.fill(); noShadow(c);
      c.fillStyle = "rgba(255,255,255,0.85)"; rr(c, x0 + 5, y0 + 5, w - 10, h * 0.35, 3); c.fill(); c.fillStyle = "rgba(0,0,0,0.15)"; c.fillRect(x0, y1 - 5, w, 5);
      c.fillStyle = b.k === "cereal" ? "#c46a1e" : "#f2d064"; for (let i = 0; i < 5; i++) { circ(c, x0 + 10 + i * (w - 20) / 4, y0 + h * 0.68, 3); c.fill(); } break;
    case "tableleg": shadow(c, 5, 2, 4, 0.4); c.fillStyle = "#6b4426"; rr(c, x0, y0, w, h, 3); c.fill(); noShadow(c); c.fillStyle = "rgba(255,255,255,0.12)"; c.fillRect(x0 + 3, y0 + 3, w - 6, 3); break;
    default: shadow(c); c.fillStyle = b.col ?? "#c98b52"; poly(c, b.p); c.fill(); noShadow(c);
  }
}
function toaster(c: C, cx: number, cy: number, w: number, h: number) {
  shadow(c, 10, 3, 7); c.fillStyle = lin(c, cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, [[0, "#f3f5f7"], [0.5, "#c3cad2"], [1, "#8f99a4"]]); rr(c, cx - w / 2, cy - h / 2, w, h, 12); c.fill(); noShadow(c);
  c.fillStyle = "#2a2d33"; for (const o of [-0.2, 0.2]) { rr(c, cx - w * 0.32, cy + o * h - 4, w * 0.64, 8, 4); c.fill(); }
  c.fillStyle = "rgba(255,255,255,0.6)"; rr(c, cx - w / 2 + 5, cy - h / 2 + 4, w - 10, 4, 2); c.fill();
}
function drawZone(c: C, z: Zone, rnd: () => number, k: Course) {
  const r = (z as { r?: [number, number, number, number] }).r, cr = (z as { c?: [number, number, number] }).c;
  switch (z.look) {
    case "boardUp": break;   // drawn with boardDown as one board
    case "boardDown": { const up = k.zones.find(q => q.look === "boardUp") as { r: [number, number, number, number] } | undefined; const y1 = up ? up.r[3] : r![3];
      shadow(c, 10, 3, 6); c.fillStyle = "#e4b57b"; rr(c, r![0], r![1], r![2] - r![0], y1 - r![1], 12); c.fill(); noShadow(c);
      woodClip(c, r![0], r![1], r![2], y1, rnd); const mid = r![3];
      c.fillStyle = lin(c, 0, r![1], 0, mid, [[0, "rgba(255,255,255,0.0)"], [1, "rgba(255,255,255,0.28)"]]); c.fillRect(r![0], r![1], r![2] - r![0], mid - r![1]);
      c.fillStyle = lin(c, 0, mid, 0, y1, [[0, "rgba(60,30,0,0.2)"], [1, "rgba(60,30,0,0.0)"]]); c.fillRect(r![0], mid, r![2] - r![0], y1 - mid);
      c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 2; c.beginPath(); c.moveTo(r![0] + 8, mid); c.lineTo(r![2] - 8, mid); c.stroke();
      c.fillStyle = "#c98a4f"; circ(c, r![2] - 16, (r![1] + y1) / 2, 6); c.fill(); c.fillStyle = k.place === "counter" ? "#d9a066" : "#000"; circ(c, r![2] - 16, (r![1] + y1) / 2, 4.5); c.fill(); break; }
    case "mat": { const [x0, y0, x1, y1] = r!; c.fillStyle = "#d9cbb0"; rr(c, x0, y0, x1 - x0, y1 - y0, 6); c.fill();
      c.strokeStyle = "rgba(150,120,80,0.35)"; c.lineWidth = 1; for (let y = y0 + 4; y < y1; y += 5) { c.beginPath(); c.moveTo(x0 + 3, y); c.lineTo(x1 - 3, y); c.stroke(); }
      c.strokeStyle = "#b9542f"; c.lineWidth = 3; rr(c, x0 + 4, y0 + 4, x1 - x0 - 8, y1 - y0 - 8, 4); c.stroke(); break; }
    case "frost": { const [x0, y0, x1, y1] = r!; c.fillStyle = "rgba(255,255,255,0.75)"; rr(c, x0, y0, x1 - x0, y1 - y0, 14); c.fill();
      c.strokeStyle = "rgba(150,200,230,0.8)"; c.lineWidth = 1.2; for (let i = 0; i < 9; i++) { const sx = x0 + 12 + rnd() * (x1 - x0 - 24), sy = y0 + 10 + rnd() * (y1 - y0 - 20), s = 4 + rnd() * 4; for (let a = 0; a < 3; a++) { const an = (a * Math.PI) / 3; c.beginPath(); c.moveTo(sx - Math.cos(an) * s, sy - Math.sin(an) * s); c.lineTo(sx + Math.cos(an) * s, sy + Math.sin(an) * s); c.stroke(); } }
      break; }
    case "suds": { const [x, y, R] = cr!; c.fillStyle = "rgba(255,255,255,0.35)"; circ(c, x, y, R); c.fill();
      for (let i = 0; i < 26; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * R * 0.92, bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d, s = 3 + rnd() * 7; c.fillStyle = "rgba(255,255,255,0.55)"; circ(c, bx, by, s); c.fill();
        c.strokeStyle = "rgba(170,200,230,0.8)"; c.lineWidth = 0.8; c.stroke(); c.fillStyle = "rgba(255,255,255,0.95)"; circ(c, bx - s * 0.35, by - s * 0.35, s * 0.25); c.fill(); } break; }
    case "swirl": { const [x, y, R] = cr!; c.fillStyle = rad(c, x, y, 4, R, [[0, "rgba(120,170,215,0.55)"], [1, "rgba(120,170,215,0)"]]); circ(c, x, y, R); c.fill();
      c.strokeStyle = "rgba(255,255,255,0.45)"; c.lineWidth = 1.5; for (let i = 1; i <= 3; i++) { c.beginPath(); c.arc(x, y, R * i * 0.28, i, i + 2.2); c.stroke(); } break; }
    case "rug": { const [x0, y0, x1, y1] = r!; c.fillStyle = "#b04a3a"; rr(c, x0, y0, x1 - x0, y1 - y0, 4); c.fill();
      c.fillStyle = "#e9c46a"; rr(c, x0 + 8, y0 + 8, x1 - x0 - 16, y1 - y0 - 16, 3); c.fill(); c.fillStyle = "#2a6f97"; rr(c, x0 + 14, y0 + 14, x1 - x0 - 28, y1 - y0 - 28, 3); c.fill();
      c.strokeStyle = "#e9c46a"; c.lineWidth = 2; const mx = (x0 + x1) / 2, my = (y0 + y1) / 2; c.beginPath(); c.moveTo(mx, y0 + 26); c.lineTo(x1 - 30, my); c.lineTo(mx, y1 - 26); c.lineTo(x0 + 30, my); c.closePath(); c.stroke();
      c.strokeStyle = "#f2ead8"; c.lineWidth = 1.2; for (let y = y0 + 3; y < y1; y += 4) { c.beginPath(); c.moveTo(x0 - 5, y); c.lineTo(x0, y); c.moveTo(x1, y); c.lineTo(x1 + 5, y); c.stroke(); } break; }
    case "waterbowl": { const [x, y, R] = cr!; shadow(c, 8, 2, 5); steelCircle(c, x, y, R + 7); noShadow(c); c.fillStyle = rad(c, x, y, 2, R, [[0, "#8fd0f5"], [1, "#3f8fd6"]]); circ(c, x, y, R); c.fill();
      c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 1.2; for (const f of [0.4, 0.7]) { circ(c, x, y, R * f); c.stroke(); } break; }
    case "burner": coil(c, cr![0], cr![1], cr![2]); break;
    case "spatula": { const [x0, y0, x1, y1] = r!; shadow(c, 7, 2, 5); c.fillStyle = lin(c, 0, y0, 0, y1, [[0, "#3a3e45"], [1, "#22252a"]]); rr(c, x0, y0, x1 - x0, y1 - y0, 10); c.fill(); noShadow(c);
      c.fillStyle = "#15171a"; for (let x = x0 + 14; x < x1 - 10; x += 16) { rr(c, x, y0 + 9, 6, y1 - y0 - 18, 3); c.fill(); }
      c.fillStyle = "#b07a46"; rr(c, x1 - 2, (y0 + y1) / 2 - 5, 46, 10, 5); c.fill();
      c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 2.5; const cx = (x0 + x1) / 2; for (const o of [-14, 6]) { c.beginPath(); c.moveTo(cx - 10, (y0 + y1) / 2 + o - 6); c.lineTo(cx, (y0 + y1) / 2 + o + 2); c.lineTo(cx + 10, (y0 + y1) / 2 + o - 6); c.stroke(); } break; }
    case "drawer": { const [x0, y0, x1, y1] = r!; c.fillStyle = "rgba(220,238,246,0.75)"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
      c.strokeStyle = "rgba(170,200,220,0.6)"; c.lineWidth = 1; for (let x = x0 + 12; x < x1; x += 14) { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke(); }
      c.fillStyle = "rgba(255,255,255,0.5)"; c.fillRect(x0, y1 - 26, x1 - x0, 26); c.fillStyle = "rgba(160,190,210,0.6)"; rr(c, (x0 + x1) / 2 - 22, y1 - 18, 44, 8, 4); c.fill(); break; }
    case "flour": { const [x, y, R] = cr!; for (let i = 0; i < 30; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * R, s = 4 + rnd() * 9; c.fillStyle = `rgba(255,255,255,${0.12 + rnd() * 0.2})`; circ(c, x + Math.cos(a) * d, y + Math.sin(a) * d, s); c.fill(); } break; }
  }
}
function woodClip(c: C, x0: number, y0: number, x1: number, y1: number, rnd: () => number) {
  c.save(); rr(c, x0, y0, x1 - x0, y1 - y0, 12); c.clip(); woodPlanks(c, x0, y0, x1, y1, ["#e6b880", "#ddae74", "#e9be88"], 140, rnd, false); c.restore();
}
function coil(c: C, x: number, y: number, R: number) {
  c.fillStyle = "rgba(0,0,0,0.25)"; circ(c, x, y, R); c.fill();
  c.strokeStyle = "rgba(120,125,135,0.55)"; c.lineWidth = 2; for (let i = 1; i <= 4; i++) { circ(c, x, y, R * (0.25 + i * 0.18)); c.stroke(); }
  c.strokeStyle = "rgba(200,205,212,0.35)"; c.lineWidth = 1; circ(c, x, y, R); c.stroke();
}
function drawDeco(c: C, d: Deco, imgs: Imgs, rnd: () => number) {
  const { x, y } = d, w = d.w ?? 40, h = d.h ?? 40;
  switch (d.k) {
    case "toaster": toaster(c, x, y, w, h); break;
    case "knifeblock": shadow(c, 9, 3, 6); c.fillStyle = lin(c, x - w / 2, 0, x + w / 2, 0, [[0, "#7a4a24"], [1, "#a8703f"]]); rr(c, x - w / 2, y - h / 2, w, h, 6); c.fill(); noShadow(c);
      c.fillStyle = "rgba(255,255,255,0.18)"; rr(c, x - w / 2 + 3, y - h / 2 + 3, w - 6, 6, 3); c.fill();
      for (let i = 0; i < 5; i++) { const kx = x - w / 2 + 10 + (i % 3) * 17, ky = y - h / 2 + 14 + Math.floor(i / 3) * 28 + (i % 2) * 4;
        c.fillStyle = "#c9ced4"; rr(c, kx, ky - 3, 10, 5, 1.5); c.fill(); shadow(c, 3, 1, 2, 0.35); c.fillStyle = lin(c, kx, 0, kx + 10, 0, [[0, "#2c2c30"], [0.5, "#4a4a52"], [1, "#1c1c20"]]); rr(c, kx, ky + 2, 10, 20, 4); c.fill(); noShadow(c);
        c.fillStyle = "#b9c1ca"; circ(c, kx + 5, ky + 8, 1.2); c.fill(); circ(c, kx + 5, ky + 15, 1.2); c.fill(); } break;
    case "towel": c.fillStyle = "#f6f1e6"; rr(c, x - 30, y - 18, 60, 44, 4); c.fill(); c.fillStyle = "#3f7fd6"; for (const o of [-10, 10]) c.fillRect(x - 30, y + o, 60, 4); break;
    case "chair": shadow(c, 9, 3, 6); c.fillStyle = "#a8703f"; rr(c, x - w / 2, y - h / 2, w, h, 10); c.fill(); noShadow(c);
      c.fillStyle = "#c98a4f"; rr(c, x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 12, 7); c.fill(); break;
    case "napkin": c.fillStyle = "#f5e8d6"; c.beginPath(); c.moveTo(x - 14, y - 6); c.lineTo(x + 14, y - 6); c.lineTo(x, y + 12); c.closePath(); c.fill(); c.strokeStyle = "#d6a37a"; c.lineWidth = 1; c.stroke(); break;
    case "fridgelight": c.fillStyle = rad(c, x, y, 4, 160, [[0, "rgba(255,255,240,0.9)"], [1, "rgba(255,255,240,0)"]]); circ(c, x, y, 160); c.fill(); c.fillStyle = "#fffbe8"; rr(c, x - 30, y - 6, 60, 12, 6); c.fill(); break;
    case "soap": shadow(c, 6, 2, 4); c.fillStyle = "#4cc27a"; rr(c, x - 10, y - 14, 20, 30, 6); c.fill(); noShadow(c); c.fillStyle = "#fff"; rr(c, x - 4, y - 20, 8, 8, 2); c.fill(); break;
    case "faucet": {   // the gooseneck, over the sink: from its base on the counter, arching out over the divider
      shadow(c, 12, 6, 10, 0.32); c.strokeStyle = lin(c, x - 6, 0, x + 6, 0, [[0, "#9aa3ad"], [0.5, "#f4f6f8"], [1, "#8b949f"]]); c.lineWidth = 11; c.lineCap = "round";
      c.beginPath(); c.moveTo(x, y - 30); c.lineTo(x, y + 52); c.stroke(); noShadow(c); steelCircle(c, x, y - 34, 13); c.fillStyle = "#6e7782"; circ(c, x, y + 54, 4); c.fill();
      steelCircle(c, x + 26, y - 34, 6); break; }
    case "chairseat": c.globalAlpha = 0.5; shadow(c, 12, 4, 8, 0.25); c.fillStyle = "#a8703f"; rr(c, x - w / 2, y - h / 2, w, h, 9); c.fill(); noShadow(c);
      c.fillStyle = "#c98a4f"; rr(c, x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 12, 6); c.fill(); c.globalAlpha = 1; break;
    case "bristles": c.save(); c.translate(x, y); c.rotate(d.rot ?? 0); shadow(c, 5, 2, 4); c.fillStyle = "#e3c06a"; c.beginPath(); c.moveTo(0, -6); c.lineTo(-34, -20); c.lineTo(-38, 20); c.lineTo(0, 6); c.closePath(); c.fill(); noShadow(c);
      c.strokeStyle = "rgba(150,110,30,0.6)"; c.lineWidth = 1; for (let i = -18; i <= 18; i += 4) { c.beginPath(); c.moveTo(-2, i * 0.3); c.lineTo(-36, i); c.stroke(); } c.fillStyle = "#e8505b"; c.fillRect(-4, -7, 6, 14); c.restore(); break;
    case "coil": coil(c, x, y, d.r ?? 50); break;
    case "knobs": for (let i = 0; i < 4; i++) { const kx = x - 120 + i * 80; shadow(c, 5, 2, 4); steelCircle(c, kx, y - 20, 13); noShadow(c); c.fillStyle = "#2b2f35"; rr(c, kx - 2, y - 31, 4, 10, 2); c.fill(); } break;
    case "mixerbowl": c.strokeStyle = "rgba(120,130,145,0.35)"; c.setLineDash([6, 7]); c.lineWidth = 1.5; circ(c, x, y, d.r ?? 90); c.stroke(); c.setLineDash([]);
      c.fillStyle = "rgba(255,255,255,0.25)"; circ(c, x, y, (d.r ?? 90) - 4); c.fill(); break;
    case "stool": shadow(c, 9, 3, 6); c.fillStyle = "#3a3f46"; circ(c, x, y, 26); c.fill(); noShadow(c); c.fillStyle = rad(c, x, y, 2, 21, [[0, "#c96f4a"], [1, "#9e4f30"]], x - 6, y - 6); circ(c, x, y, 21); c.fill(); break;
    case "plant": shadow(c, 8, 3, 6); c.fillStyle = "#c8693f"; circ(c, x, y, 20); c.fill(); noShadow(c);
      for (let i = 0; i < 9; i++) { const a = (i * TAU) / 9; c.fillStyle = i % 2 ? "#4c9a3c" : "#62b04e"; c.beginPath(); c.ellipse(x + Math.cos(a) * 12, y + Math.sin(a) * 12, 11, 5, a, 0, TAU); c.fill(); } break;
    case "tabletop": c.globalAlpha = 0.34; shadow(c, 18, 6, 12, 0.4); c.fillStyle = "#8f5a30"; rr(c, x - w / 2, y - h / 2, w, h, 16); c.fill(); noShadow(c);
      c.strokeStyle = "#5e3517"; c.lineWidth = 4; rr(c, x - w / 2 + 2, y - h / 2 + 2, w - 4, h - 4, 14); c.stroke(); c.globalAlpha = 1; break;
    case "dogbody": dog(c, x, y); break;
  }
  void imgs; void rnd;
}
function dog(c: C, x: number, y: number) {
  shadow(c, 12, 4, 8, 0.3);
  c.fillStyle = "#d9a35f"; c.beginPath(); c.ellipse(x - 20, y + 2, 46, 27, -0.05, 0, TAU); c.fill(); noShadow(c);
  c.fillStyle = "#e6b878"; c.beginPath(); c.ellipse(x - 26, y - 4, 30, 16, -0.05, 0, TAU); c.fill();
  c.strokeStyle = "#d9a35f"; c.lineWidth = 9; c.lineCap = "round"; c.beginPath(); c.moveTo(x - 62, y + 8); c.quadraticCurveTo(x - 84, y + 24, x - 66, y + 34); c.stroke();
  shadow(c, 8, 3, 5, 0.25); c.fillStyle = "#d9a35f"; circ(c, x + 40, y - 6, 20); c.fill(); noShadow(c);
  c.fillStyle = "#b07a3c"; c.beginPath(); c.ellipse(x + 30, y - 22, 9, 13, -0.6, 0, TAU); c.fill(); c.beginPath(); c.ellipse(x + 52, y - 20, 9, 13, 0.6, 0, TAU); c.fill();
  c.fillStyle = "#efcf9d"; c.beginPath(); c.ellipse(x + 46, y + 4, 10, 8, 0, 0, TAU); c.fill(); c.fillStyle = "#3a2a20"; circ(c, x + 50, y + 2, 3); c.fill();
  c.strokeStyle = "#3a2a20"; c.lineWidth = 1.6; for (const o of [-8, 6]) { c.beginPath(); c.arc(x + 40 + o, y - 8, 3, 0.2, Math.PI - 0.2); c.stroke(); }   // asleep
  c.fillStyle = "#c48c4a"; for (const o of [-6, 10]) { c.beginPath(); c.ellipse(x + o, y + 24, 9, 6, 0, 0, TAU); c.fill(); }
}
function drawCup(c: C, k: Course) {
  const [x, y] = k.cup, R = CUP_R;
  const hole = () => { c.fillStyle = rad(c, x, y, 1, R, [[0, "#0d0f13"], [0.75, "#1d2129"], [1, "#2c313b"]], x + 2, y + 3); circ(c, x, y, R); c.fill(); };
  shadow(c, 8, 2, 5, 0.25);
  switch (k.cupKind) {
    case "ramekin": c.fillStyle = "#fbfbfb"; circ(c, x, y, R + 7); c.fill(); noShadow(c); c.strokeStyle = "rgba(0,0,0,0.08)"; c.lineWidth = 1; for (let i = 0; i < 16; i++) { const a = (i * TAU) / 16; c.beginPath(); c.moveTo(x + Math.cos(a) * (R + 2), y + Math.sin(a) * (R + 2)); c.lineTo(x + Math.cos(a) * (R + 7), y + Math.sin(a) * (R + 7)); c.stroke(); } hole(); break;
    case "soup": c.fillStyle = "#fbfbfb"; circ(c, x, y, R + 10); c.fill(); noShadow(c); c.strokeStyle = "#3f7fd6"; c.lineWidth = 2.5; circ(c, x, y, R + 7); c.stroke(); hole(); break;
    case "jar": c.fillStyle = "rgba(210,236,248,0.9)"; circ(c, x, y, R + 6); c.fill(); noShadow(c); c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineWidth = 2; c.beginPath(); c.arc(x, y, R + 4, 3.5, 4.8); c.stroke(); hole(); break;
    case "drain": noShadow(c); steelCircle(c, x, y, R + 6); hole(); c.strokeStyle = "rgba(180,190,200,0.75)"; c.lineWidth = 1.6; for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 4; c.beginPath(); c.moveTo(x - Math.cos(a) * (R - 2), y - Math.sin(a) * (R - 2)); c.lineTo(x + Math.cos(a) * (R - 2), y + Math.sin(a) * (R - 2)); c.stroke(); } break;
    case "dogbowl": steelCircle(c, x, y, R + 12); noShadow(c); c.fillStyle = "#e8505b"; c.beginPath(); c.arc(x, y, R + 10, 2.2, 2.9); c.arc(x, y, R + 6, 2.9, 2.2, true); c.fill(); hole(); break;
    case "pot": steelCircle(c, x, y, R + 7); noShadow(c); c.fillStyle = "#1e2025"; rr(c, x + R + 5, y - 4, 40, 8, 4); c.fill(); hole(); break;
    case "mixbowl": c.fillStyle = "rgba(225,240,250,0.85)"; circ(c, x, y, R + 12); c.fill(); noShadow(c); c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, R + 9, 3.4, 4.9); c.stroke(); hole(); break;
    case "mug": c.fillStyle = "#e8505b"; circ(c, x, y, R + 6); c.fill(); rr(c, x + R + 3, y - 5, 10, 10, 4); c.fill(); noShadow(c); hole(); break;
    case "cookiejar": c.fillStyle = "#c98a4f"; circ(c, x, y, R + 8); c.fill(); noShadow(c); c.strokeStyle = "#f6e7cc"; c.lineWidth = 2; circ(c, x, y, R + 4); c.stroke(); hole(); break;
  }
  noShadow(c);
}
function drawTube(c: C, t: Course["tubes"][number]) {
  const dx = t.bx - t.ax, dy = t.by - t.ay, len = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  c.save(); c.translate(t.ax, t.ay); c.rotate(a);
  shadow(c, 10, 3, 7, 0.35); c.fillStyle = lin(c, 0, -t.r, 0, t.r, [[0, "#e8c493"], [0.45, "#c99a62"], [1, "#9b7140"]]); rr(c, 0, -t.r, len, t.r * 2, 4); c.fill(); noShadow(c);
  c.strokeStyle = "rgba(110,75,35,0.35)"; c.lineWidth = 1.2; for (let s = -10; s < len; s += 18) { c.beginPath(); c.moveTo(s, -t.r); c.lineTo(s + 14, t.r); c.stroke(); }
  c.fillStyle = "#3b2a18"; for (const e of [0, len]) { c.beginPath(); c.ellipse(e, 0, 4.5, t.r - 2, 0, 0, TAU); c.fill(); }
  c.restore();
}
function drawTee(c: C, k: Course) {
  const [x, y] = k.tee;
  shadow(c, 5, 1, 3, 0.25); c.fillStyle = rad(c, x, y, 2, 16, [[0, "#d9b48a"], [1, "#b98c5d"]]); circ(c, x, y, 16); c.fill(); noShadow(c);
  c.fillStyle = "rgba(120,80,40,0.35)"; for (let i = 0; i < 26; i++) { const a = (i * 2.39996) % TAU, d = Math.sqrt(i / 26) * 13; circ(c, x + Math.cos(a) * d, y + Math.sin(a) * d, 0.9); c.fill(); }
  c.strokeStyle = "rgba(255,255,255,0.45)"; c.lineWidth = 1; circ(c, x, y, 13.5); c.stroke();
}
/** The edge you bounce off, as a raised lip in this place's material, casting a soft shadow onto the surface. */
function rails(c: C, k: Course) {
  const L = LOOKS[k.place];
  c.save(); poly(c, k.out); c.clip();
  c.shadowColor = "rgba(30,15,5,0.4)"; c.shadowBlur = 12; c.shadowOffsetX = 3; c.shadowOffsetY = 5;
  c.strokeStyle = L.rail[0]; c.lineWidth = L.lip * 2; c.lineJoin = "round"; poly(c, k.out); c.stroke(); noShadow(c);
  c.strokeStyle = L.rail[1]; c.lineWidth = 2; c.globalAlpha = 0.7; c.beginPath();
  k.out.forEach(([x, y], i) => { const [nx, ny] = k.out[(i + 1) % k.out.length]; c.moveTo(x, y); c.lineTo(nx, ny); }); c.stroke(); c.globalAlpha = 1;
  c.restore();
  c.strokeStyle = L.rail[2]; c.lineWidth = 1.2; poly(c, k.out); c.stroke();
}

/** The still parts of a hole, drawn once at `scale` pixels per unit: `under` (everything below the balls) and `over`
 *  (things the balls roll under: a faucet, a chair seat, the table above). */
export function paintHole(k: Course, scale: number, imgs: Imgs) {
  const make = () => { const cv = document.createElement("canvas"); cv.width = Math.ceil(W * scale); cv.height = Math.ceil(k.h * scale); const c = cv.getContext("2d")!; c.scale(scale, scale); return { cv, c }; };
  const under = make(), c = under.c, rnd = mulberry32(k.id * 977 + 13);
  background(c, k, rnd);
  c.save(); poly(c, k.out); c.clip();
  const [x0, y0, x1, y1] = bbox(k.out); LOOKS[k.place].surface(c, x0, y0, x1, y1, rnd);
  if (k.place === "cupboard") { LOOKS.counter.surface(c, x0, 452, x1, y1, rnd); c.fillStyle = lin(c, 0, 452, 0, 470, [[0, "rgba(40,20,5,0.35)"], [1, "rgba(40,20,5,0)"]]); c.fillRect(x0, 452, x1 - x0, 18); }
  c.restore();
  if (k.place === "cupboard") { c.fillStyle = lin(c, 0, 440, 0, 456, [[0, "#c79a68"], [1, "#9a6e42"]]); c.fillRect(0, 442, 42, 14); c.fillRect(W - 42, 442, 42, 14); }
  for (const z of k.zones) drawZone(c, z, rnd, k);
  for (const d of k.deco) if (!d.over && (d.k === "coil" || d.k === "mixerbowl")) drawDeco(c, d, imgs, rnd);
  drawTee(c, k); drawCup(c, k);
  rails(c, k);
  for (const d of k.deco) if (!d.over && d.k !== "coil" && d.k !== "mixerbowl") drawDeco(c, d, imgs, rnd);
  for (const b of k.blocks) drawBlock(c, b, rnd);
  for (const u of k.bumps) drawBump(c, u, imgs);
  for (const t of k.tubes) drawTube(c, t);
  c.fillStyle = rad(c, W * 0.25, k.h * 0.18, 20, Math.max(W, k.h) * 0.95, [[0, "rgba(255,248,235,0.16)"], [0.55, "rgba(255,248,235,0)"], [1, "rgba(20,10,0,0.22)"]]); c.fillRect(0, 0, W, k.h);
  const overs = k.deco.filter(d => d.over);
  let over: HTMLCanvasElement | null = null;
  if (overs.length) { const o = make(); for (const d of overs) drawDeco(o.c, d, imgs, rnd); over = o.cv; }
  return { under: under.cv, over };
}

/** The moving parts at this moment on the hole clock, and the burners' glow. */
export function drawLive(c: C, k: Course, parts: Part[], clock: number, t: number) {
  for (const z of k.zones) if (z.k === "burner") {
    const lit = burnerLit(z, clock), u = (((clock + z.ph) % z.per) + z.per) % z.per;
    const glow = lit ? Math.min(1, u / 20, (z.on - u) / 20 + 0.3) : Math.max(0, 1 - (u - z.on) / 40) * 0.6;
    if (glow <= 0.01) continue;
    const [x, y, R] = z.c;
    c.globalAlpha = glow; c.fillStyle = rad(c, x, y, 4, R, [[0, "rgba(255,150,60,0.25)"], [1, "rgba(255,60,20,0)"]]); circ(c, x, y, R + 8); c.fill();
    c.strokeStyle = `rgba(255,${90 + Math.round(30 * Math.sin(t / 120))},40,0.95)`; c.lineWidth = 2.6;
    for (let i = 1; i <= 4; i++) { circ(c, x, y, R * (0.25 + i * 0.18)); c.stroke(); }
    c.globalAlpha = 1;
  }
  for (const p of parts) {
    if (p.k === "mixer") {
      shadow(c, 6, 3, 5, 0.3); c.lineCap = "round"; c.strokeStyle = "#9aa3ad"; c.lineWidth = MIXER_W * 2 + 2; c.beginPath(); c.moveTo(p.ax, p.ay); c.lineTo(p.bx, p.by); c.stroke(); noShadow(c);
      c.strokeStyle = "#e3e7eb"; c.lineWidth = MIXER_W; c.beginPath(); c.moveTo(p.ax, p.ay); c.lineTo(p.bx, p.by); c.stroke();
      for (const [ex, ey] of [[p.ax, p.ay], [p.bx, p.by]]) { c.strokeStyle = "#9aa3ad"; c.lineWidth = 3; circ(c, ex, ey, 9); c.stroke(); }
      shadow(c, 8, 3, 6, 0.3); c.fillStyle = rad(c, p.px, p.py, 2, 16, [[0, "#ffffff"], [1, "#d64550"]], p.px - 5, p.py - 5); circ(c, p.px, p.py, 16); c.fill(); noShadow(c);
      c.fillStyle = "#8b949f"; circ(c, p.px, p.py, 5); c.fill();
    } else if (p.k === "door") {
      const a = Math.atan2(p.by - p.ay, p.bx - p.ax), len = Math.hypot(p.bx - p.ax, p.by - p.ay);
      c.save(); c.translate(p.ax, p.ay); c.rotate(a); shadow(c, 10, 3, 7, 0.35);
      c.fillStyle = lin(c, 0, -DOOR_W - 2, 0, DOOR_W + 2, [[0, "#cfe3d2"], [0.5, "#a9c4ad"], [1, "#7f9c85"]]); rr(c, 0, -DOOR_W - 2, len, DOOR_W * 2 + 4, 3); c.fill(); noShadow(c);
      c.fillStyle = "rgba(255,255,255,0.55)"; c.fillRect(2, -DOOR_W - 1, len - 4, 2); c.strokeStyle = "rgba(60,80,65,0.35)"; c.lineWidth = 1; c.strokeRect(8, -DOOR_W + 1, len - 16, DOOR_W * 2 - 2);
      c.fillStyle = rad(c, len - 16, DOOR_W + 5, 1, 6, [[0, "#fff1c0"], [1, "#b8892e"]], len - 18, DOOR_W + 3); circ(c, len - 16, DOOR_W + 5, 5); c.fill();
      c.fillStyle = "#7d8792"; rr(c, -3, -DOOR_W - 3, 7, DOOR_W * 2 + 6, 2); c.fill(); c.restore();
    } else {
      const dx = p.bx - p.ax, dy = p.by - p.ay, len = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      c.save(); c.translate(p.ax, p.ay); c.rotate(a); shadow(c, 8, 3, 6, 0.32);
      c.fillStyle = "#a8703f"; rr(c, 0, -4, len, 8, 4); c.fill();
      c.fillStyle = lin(c, 0, -PIN_R, 0, PIN_R, [[0, "#f3cf9c"], [0.4, "#e2b07a"], [1, "#b98547"]]); rr(c, 16, -PIN_R, len - 32, PIN_R * 2, PIN_R); c.fill(); noShadow(c);
      c.strokeStyle = "rgba(150,100,50,0.35)"; c.lineWidth = 1; const roll = (p.px * 0.9) % 12;     // the grain turns as it rolls
      for (let s = 16 + ((roll + 12) % 12); s < len - 16; s += 12) { c.beginPath(); c.moveTo(s, -PIN_R + 2); c.lineTo(s, PIN_R - 2); c.stroke(); }
      c.restore();
    }
  }
}
/** The cocktail-stick flag in the cup (faded while a ball is close, so you can see in). */
export function drawFlag(c: C, k: Course, near: boolean, t: number) {
  const [x, y] = k.cup, sway = Math.sin(t / 500) * 1.5;
  c.globalAlpha = near ? 0.35 : 1;
  shadow(c, 3, 4, 6, 0.25); c.strokeStyle = "#d6b382"; c.lineWidth = 2.6; c.lineCap = "round"; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 5, y - 40); c.stroke(); noShadow(c);
  c.fillStyle = "#e8505b"; c.beginPath(); c.moveTo(x + 5, y - 40); c.quadraticCurveTo(x + 15, y - 37 + sway, x + 25, y - 35 + sway); c.lineTo(x + 4.5, y - 28); c.closePath(); c.fill();
  c.globalAlpha = 1;
}

// ── the meatball ──
// Seventy spots on a sphere (bumps, crumbs, parsley, pepper, a little sauce) turned by the ball's rotation; only the
// ones facing up are drawn, squashed toward the edge. The shading and the shine stay put, so it reads as rolling.
type Quat = [number, number, number, number];
export const quatIdentity = (): Quat => [1, 0, 0, 0];
/** Rolls the ball's turn on by a move of (dx, dy) on the board. */
export function rollQuat(q: Quat, dx: number, dy: number, r = BALL_R): Quat {
  const d = Math.hypot(dx, dy); if (d < 1e-6) return q;
  const a = d / r, s = Math.sin(a / 2), w = Math.cos(a / 2), ax = (-dy / d) * s, ay = (dx / d) * s;   // spin axis lies flat, square to the motion
  const [qw, qx, qy, qz] = q;
  const o: Quat = [w * qw - ax * qx - ay * qy, w * qx + ax * qw - ay * qz, w * qy + ay * qw + ax * qz, w * qz + ax * qy - ay * qx];
  const n = Math.hypot(...o); return [o[0] / n, o[1] / n, o[2] / n, o[3] / n];
}
function rotate(q: Quat, v: number[]) {
  const [w, x, y, z] = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}
const SPOTS: { v: number[]; k: number; s: number }[] = (() => {
  const rnd = mulberry32(4242), out: { v: number[]; k: number; s: number }[] = [], n = 70;
  for (let i = 0; i < n; i++) {
    const zz = 1 - (2 * (i + 0.5)) / n, rr2 = Math.sqrt(1 - zz * zz), a = i * 2.39996 + rnd() * 0.6;
    const v = [Math.cos(a) * rr2, Math.sin(a) * rr2, zz], p = rnd();
    const k = p < 0.34 ? 0 : p < 0.62 ? 1 : p < 0.74 ? 2 : p < 0.86 ? 3 : p < 0.94 ? 4 : 5;
    out.push({ v, k, s: [0.34, 0.27, 0.1, 0.07, 0.24, 0.08][k] * (0.8 + rnd() * 0.4) });
  }
  return out;
})();
const SPOT_COL = ["rgba(72,34,16,0.55)", "rgba(196,124,82,0.5)", "#3e7a2a", "#24160d", "rgba(196,52,28,0.42)", "#ecd29a"];
export function drawMeatball(c: C, x: number, y: number, r: number, q: Quat, alpha = 1, ring?: string) {
  c.save(); c.globalAlpha = alpha;
  c.fillStyle = "rgba(40,22,10,0.3)"; c.beginPath(); c.ellipse(x + r * 0.28, y + r * 0.42, r * 1.02, r * 0.78, 0, 0, TAU); c.fill();   // shadow
  if (ring) { c.strokeStyle = ring; c.lineWidth = Math.max(1.2, r * 0.15); c.globalAlpha = alpha * 0.75; circ(c, x, y, r + r * 0.3); c.stroke(); c.globalAlpha = alpha; }
  // the body, a touch lumpy
  c.beginPath();
  for (let i = 0; i <= 28; i++) { const a = (i * TAU) / 28, k = 1 + 0.035 * Math.sin(a * 5 + 1.3) + 0.025 * Math.sin(a * 9); if (i) c.lineTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k); else c.moveTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k); }
  c.closePath();
  c.fillStyle = rad(c, x, y, r * 0.1, r * 1.05, [[0, "#b8693f"], [0.65, "#8a4524"], [1, "#552812"]], x - r * 0.35, y - r * 0.4); c.fill();
  c.save(); c.clip();
  const pts = SPOTS.map(s => ({ s, p: rotate(q, s.v) })).filter(o => o.p[2] > 0).sort((a, b) => a.p[2] - b.p[2]);
  for (const { s, p } of pts) {
    const px = x + p[0] * r, py = y + p[1] * r, sz = s.s * r, ang = Math.atan2(p[1], p[0]), z = Math.max(0.18, p[2]);
    c.fillStyle = SPOT_COL[s.k]; c.beginPath(); c.ellipse(px, py, sz * z, sz, ang, 0, TAU); c.fill();
  }
  c.fillStyle = rad(c, x, y, r * 0.2, r * 1.05, [[0, "rgba(0,0,0,0)"], [0.7, "rgba(30,10,0,0.12)"], [1, "rgba(30,10,0,0.5)"]], x - r * 0.4, y - r * 0.45); c.fillRect(x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4);
  c.restore();
  c.fillStyle = "rgba(255,235,210,0.42)"; c.beginPath(); c.ellipse(x - r * 0.38, y - r * 0.42, r * 0.36, r * 0.22, -0.7, 0, TAU); c.fill();   // shine
  c.fillStyle = "rgba(255,255,255,0.8)"; circ(c, x - r * 0.45, y - r * 0.5, r * 0.09); c.fill();                                             // a glint of sauce
  c.restore();
}
