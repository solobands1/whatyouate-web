// Kitchen Golf's props: everything that sits on a hole (the solid things you bounce off, the zones that change the
// roll, the scenery), the cups and the tees. Each sits on the surface with a soft contact halo and is lit from the top
// left. Sizes are the hole's own (they're also what the ball bounces off), so detail and contrast do the work.
import { type Course, type Bump, type Block, type Deco, type Zone, type Pt, CUP_R } from "./sim";
import { type C, type Imgs, type Rnd, TAU, poly, rr, circ, ell, line, lin, rad, shade, noShade, mix, lighter, darker, rgba, bbox, img,
  tint, ao, aoBox, drop, bevel, gloss, rimArc, orb, steelDisc, STEEL } from "./draw";
import { planks } from "./materials";

type Rect = [number, number, number, number];

// ── round things ──
/** A dinner plate: a glossy rim, a cobalt band, the step down into the well, a soft reflection. */
function plate(c: C, x: number, y: number, r: number) {
  ao(c, x, y, r, 0.5);
  drop(c); c.fillStyle = "#e9ecf0"; circ(c, x, y, r); c.fill(); noShade(c);
  c.fillStyle = lin(c, x - r, y - r, x + r, y + r, [[0, "#ffffff"], [0.45, "#f3f5f8"], [1, "#bcc4cf"]]); circ(c, x, y, r); c.fill();
  c.strokeStyle = "#2a62c4"; c.lineWidth = 1.7; circ(c, x, y, r * 0.88); c.stroke();
  c.strokeStyle = "rgba(42,98,196,0.45)"; c.lineWidth = 0.6; circ(c, x, y, r * 0.82); c.stroke();
  c.fillStyle = lin(c, x - r * 0.7, y - r * 0.7, x + r * 0.7, y + r * 0.7, [[0, "#aab3bf"], [0.5, "#e7eaee"], [1, "#ffffff"]]); circ(c, x, y, r * 0.7); c.fill();
  c.fillStyle = rad(c, x + r * 0.05, y + r * 0.07, 0, r * 0.64, [[0, "#ffffff"], [0.75, "#f4f6f8"], [1, "#e0e4ea"]]); circ(c, x, y, r * 0.64); c.fill();
  rimArc(c, x, y, r * 0.945, r * 0.075, 0.98); c.strokeStyle = "rgba(255,255,255,0.7)"; c.lineWidth = r * 0.05; c.beginPath(); c.arc(x, y, r * 0.66, Math.PI * 0.08, Math.PI * 0.42); c.stroke();
  gloss(c, x - r * 0.22, y - r * 0.26, r * 0.34, r * 0.22, 0.9);
  c.strokeStyle = "rgba(80,92,110,0.55)"; c.lineWidth = 0.8; circ(c, x, y, r - 0.4); c.stroke();
}
/** A deep glazed bowl of fruit: cobalt outside, cream inside, each fruit with its own little shadow. */
function fruitBowl(c: C, u: Bump, imgs: Imgs) {
  const { x, y, r } = u;
  ao(c, x, y, r, 0.55);
  drop(c, 9, 3, 6, 0.45); c.fillStyle = "#1f4e9a"; circ(c, x, y, r); c.fill(); noShade(c);
  c.fillStyle = lin(c, x - r, y - r, x + r, y + r, [[0, "#5d97e6"], [0.5, "#2f6fc4"], [1, "#173d7c"]]); circ(c, x, y, r); c.fill();
  c.fillStyle = lin(c, x - r, y - r, x + r, y + r, [[0, "#c9b896"], [0.55, "#f3e9d6"], [1, "#fffaf0"]]); circ(c, x, y, r * 0.84); c.fill();
  c.fillStyle = rad(c, x + r * 0.1, y + r * 0.12, 0, r * 0.72, [[0, "#fffaf0"], [0.8, "#f0e5d0"], [1, "rgba(240,229,208,0)"]]); circ(c, x, y, r * 0.78); c.fill();
  rimArc(c, x, y, r * 0.93, 1.5, 0.95);
  const f = u.f ?? "1f34e", s = r * 0.74, spots: [string, number, number, number][] = [[f === "1f34a" ? "1f34a" : "1f350", -0.3, 0.17, 0.3], ["1f34b", 0.3, 0.12, -0.4], [f, 0, -0.24, 0.1]];
  for (const [code, dx, dy, rot] of spots) { c.fillStyle = "rgba(90,50,15,0.3)"; ell(c, x + dx * r + 1.6, y + dy * r + 2.6, s * 0.36, s * 0.3); c.fill(); img(c, imgs, code, x + dx * r, y + dy * r, s, rot); }
  c.strokeStyle = "rgba(12,30,70,0.6)"; c.lineWidth = 0.8; circ(c, x, y, r - 0.4); c.stroke();
}
/** A tumbler of water from above: a thick bright rim, the water, a caustic glint in its shadow. */
function glass(c: C, x: number, y: number, r: number) {
  c.fillStyle = rad(c, x + r * 0.45, y + r * 0.7, 0, r * 1.3, [[0, "rgba(255,250,220,0.55)"], [0.35, tint(0.12)], [0.8, tint(0.22)], [1, tint(0)]]); circ(c, x + r * 0.45, y + r * 0.7, r * 1.3); c.fill();
  c.fillStyle = "rgba(225,242,252,0.5)"; circ(c, x, y, r); c.fill();
  c.fillStyle = rad(c, x + r * 0.15, y + r * 0.2, 0, r * 0.75, [[0, "rgba(170,215,240,0.55)"], [1, "rgba(110,170,215,0.65)"]]); circ(c, x, y, r * 0.74); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineWidth = 1.7; circ(c, x, y, r - 0.85); c.stroke();
  c.strokeStyle = "rgba(70,120,160,0.45)"; c.lineWidth = 0.7; circ(c, x, y, r * 0.74); c.stroke();
  c.strokeStyle = "rgba(60,90,120,0.45)"; c.lineWidth = 0.6; circ(c, x, y, r); c.stroke();
  c.fillStyle = "rgba(255,255,255,0.95)"; ell(c, x - r * 0.35, y - r * 0.38, r * 0.24, r * 0.12, -0.7); c.fill();
}
/** A pepper mill from above: turned walnut rings and a steel cap with a knob. */
function pepperMill(c: C, x: number, y: number, r: number) {
  ao(c, x, y, r, 0.55); orb(c, x, y, r, "#7a4220");
  c.strokeStyle = "rgba(255,215,170,0.28)"; c.lineWidth = 0.9; circ(c, x, y, r * 0.8); c.stroke();
  c.strokeStyle = "rgba(40,15,0,0.35)"; circ(c, x, y, r * 0.66); c.stroke();
  steelDisc(c, x, y, r * 0.5); c.fillStyle = "#3b3f46"; circ(c, x, y, r * 0.17); c.fill(); gloss(c, x - r * 0.12, y - r * 0.14, r * 0.12, r * 0.07, 0.8);
  rimArc(c, x, y, r - 1.1, 1.1, 0.5);
}
/** A sauce bottle from above: coloured glass, a white ridged cap. */
function bottle(c: C, x: number, y: number, r: number, col: string) {
  ao(c, x, y, r, 0.55); orb(c, x, y, r, col, 1.2);
  c.fillStyle = rad(c, x, y, r * 0.5, r, [[0, rgba(darker(col, 0.3), 0.5)], [1, rgba(col, 0)]]); circ(c, x, y, r * 0.95); c.fill();
  c.fillStyle = lin(c, x - r * 0.5, y - r * 0.5, x + r * 0.5, y + r * 0.5, [[0, "#ffffff"], [1, "#c6ccd4"]]); circ(c, x, y, r * 0.5); c.fill();
  c.strokeStyle = "rgba(90,100,115,0.45)"; c.lineWidth = 0.6; for (let i = 0; i < 16; i++) { const a = (i * TAU) / 16; line(c, x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); }
  c.fillStyle = col; circ(c, x, y, r * 0.2); c.fill();
  gloss(c, x - r * 0.42, y - r * 0.45, r * 0.3, r * 0.16, 0.9); rimArc(c, x, y, r - 1, 1.1, 0.7);
}
/** A jam jar with a gingham cloth lid tied with string. */
function jamJar(c: C, x: number, y: number, r: number) {
  ao(c, x, y, r, 0.55);
  drop(c); c.fillStyle = "#8a1626"; circ(c, x, y, r); c.fill(); noShade(c);
  c.fillStyle = lin(c, x - r, y - r, x + r, y + r, [[0, "#c8283c"], [1, "#6b0f1c"]]); circ(c, x, y, r); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.75)"; c.lineWidth = 1; circ(c, x, y, r - 1); c.stroke();
  c.save(); c.beginPath(); for (let i = 0; i <= 24; i++) { const a = (i * TAU) / 24, k = i % 2 ? 0.82 : 0.9; if (i) c.lineTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k); else c.moveTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k); } c.closePath();
  c.fillStyle = "#ffffff"; c.fill(); c.clip();
  const s = r * 0.24; c.fillStyle = "rgba(214,45,60,0.55)"; for (let i = -5; i <= 5; i++) { c.fillRect(x + i * s * 2 - s / 2, y - r, s, r * 2); c.fillRect(x - r, y + i * s * 2 - s / 2, r * 2, s); }
  c.fillStyle = lin(c, x - r, y - r, x + r, y + r, [[0, "rgba(255,255,255,0.25)"], [0.5, "rgba(255,255,255,0)"], [1, "rgba(60,0,10,0.25)"]]); c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
  c.strokeStyle = "#b48a52"; c.lineWidth = 1.4; circ(c, x, y, r * 0.66); c.stroke(); c.strokeStyle = "rgba(255,240,210,0.6)"; c.lineWidth = 0.5; circ(c, x, y, r * 0.66 - 0.4); c.stroke();
  c.fillStyle = "#b48a52"; ell(c, x + r * 0.6, y + r * 0.2, 2.2, 1.2, 0.6); c.fill();
}
/** A food picture (an apple, a lemon...) sitting on the surface with a soft shadow. */
function food(c: C, x: number, y: number, r: number, code: string | undefined, imgs: Imgs) {
  ao(c, x, y, r * 0.85, 0.5);
  shade(c, 4, 1.6, 3, tint(0.5)); img(c, imgs, code, x, y, r * 2.3); noShade(c);
}
/** A ceramic mug of coffee, handle and all. */
function mug(c: C, x: number, y: number, r: number, col: string) {
  ao(c, x, y, r * 1.05, 0.55);
  drop(c); c.strokeStyle = darker(col, 0.15); c.lineWidth = 3.4; rr(c, x + r - 2.5, y - 5, 9.5, 10, 4.5); c.stroke(); noShade(c);
  c.strokeStyle = lin(c, x + r, y - 5, x + r + 9, y + 5, [[0, lighter(col, 0.35)], [1, darker(col, 0.3)]]); c.lineWidth = 2.6; rr(c, x + r - 2.5, y - 5, 9.5, 10, 4.5); c.stroke();
  orb(c, x, y, r, col);
  c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 1.1; circ(c, x, y, r * 0.84); c.stroke();
  c.fillStyle = rad(c, x + r * 0.08, y + r * 0.1, 0, r * 0.78, [[0, "#7a4423"], [0.7, "#4a2410"], [1, "#2e1607"]]); circ(c, x, y, r * 0.78); c.fill();
  c.strokeStyle = "rgba(205,150,95,0.55)"; c.lineWidth = 0.9; circ(c, x, y, r * 0.72); c.stroke();
  gloss(c, x - r * 0.25, y - r * 0.28, r * 0.24, r * 0.12, 0.6); rimArc(c, x, y, r - 0.9, 1.1, 0.75);
}
/** A non-stick frying pan with an egg in it (its handle is a separate block). */
function pan(c: C, x: number, y: number, r: number, imgs: Imgs) {
  ao(c, x, y, r, 0.6);
  drop(c, 10, 3, 6, 0.5); c.fillStyle = "#1c1e22"; circ(c, x, y, r); c.fill(); noShade(c);
  c.fillStyle = lin(c, x - r, y - r, x + r, y + r, [[0, "#8e96a0"], [0.4, "#4a4f57"], [1, "#1e2024"]]); circ(c, x, y, r); c.fill();
  c.fillStyle = rad(c, x, y, 0, r * 0.88, [[0, "#3a3e45"], [0.8, "#25272c"], [1, "#16171a"]], x - r * 0.25, y - r * 0.3); circ(c, x, y, r * 0.88); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.04)"; c.lineWidth = 0.8; for (let i = 2; i < 9; i++) { circ(c, x, y, r * 0.1 * i); c.stroke(); }
  c.strokeStyle = "rgba(255,255,255,0.22)"; c.lineWidth = 2; c.lineCap = "round"; c.beginPath(); c.arc(x, y, r * 0.74, Math.PI * 1.05, Math.PI * 1.4); c.stroke();
  shade(c, 4, 1.5, 3, "rgba(0,0,0,0.5)"); img(c, imgs, "1f95a", x + 4, y - 2, r * 1.1); noShade(c);
  rimArc(c, x, y, r - 1.2, 1.6, 0.55);
}
/** A big steel pot with its lid on, a handle each side. */
function bigPot(c: C, x: number, y: number, r: number) {
  ao(c, x, y, r, 0.6);
  for (const sx of [-1, 1]) { drop(c, 4, 1.5, 3, 0.5); c.fillStyle = lin(c, 0, y - 4, 0, y + 4, [[0, "#eef1f4"], [1, "#7d8792"]]); rr(c, x + sx * (r + 1) - 6, y - 4.5, 12, 9, 4); c.fill(); noShade(c); }
  drop(c, 10, 3, 6, 0.5); c.fillStyle = "#8d97a2"; circ(c, x, y, r); c.fill(); noShade(c);
  steelDisc(c, x, y, r);
  c.fillStyle = lin(c, x - r, y - r, x + r, y + r, [[0, "#c9d0d8"], [0.5, "#eef1f4"], [1, "#9aa3ad"]]); circ(c, x, y, r * 0.84); c.fill();
  c.fillStyle = rad(c, x - r * 0.25, y - r * 0.3, 0, r * 0.8, [[0, "rgba(255,255,255,0.75)"], [0.5, "rgba(255,255,255,0.1)"], [1, "rgba(255,255,255,0)"]]); circ(c, x, y, r * 0.8); c.fill();
  c.strokeStyle = "rgba(60,70,80,0.35)"; c.lineWidth = 0.8; circ(c, x, y, r * 0.84); c.stroke();
  drop(c, 3, 1, 2, 0.5); c.fillStyle = "#24272c"; circ(c, x, y, 6); c.fill(); noShade(c);
  c.fillStyle = rad(c, x - 1.6, y - 1.8, 0, 6, [[0, "#6b717a"], [1, "#1c1e22"]]); circ(c, x, y, 5.6); c.fill();
  rimArc(c, x, y, r - 1.3, 1.6, 0.85);
}
/** A tin can from above: the label's colour at the edge, the ribbed lid, a ring pull. */
function can(c: C, x: number, y: number, r: number, col: string) {
  ao(c, x, y, r, 0.55);
  drop(c); c.fillStyle = darker(col, 0.2); circ(c, x, y, r); c.fill(); noShade(c);
  c.fillStyle = lin(c, x - r, y - r, x + r, y + r, [[0, lighter(col, 0.3)], [1, darker(col, 0.3)]]); circ(c, x, y, r); c.fill();
  steelDisc(c, x, y, r * 0.84); c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 0.8; circ(c, x, y, r * 0.78); c.stroke();
  c.strokeStyle = "rgba(60,70,80,0.3)"; for (const k of [0.62, 0.46]) { circ(c, x, y, r * k); c.stroke(); }
  c.fillStyle = lin(c, 0, y - r * 0.5, 0, y - r * 0.1, [[0, "#f2f4f7"], [1, "#9aa3ad"]]); rr(c, x - 4, y - r * 0.55, 8, 6, 3); c.fill();
  c.fillStyle = "#6c7682"; rr(c, x - 2, y - r * 0.5, 4, 2.4, 1.2); c.fill();
  rimArc(c, x, y, r * 0.82, 1, 0.7);
}
/** A star cookie cutter: a thin steel outline standing on its edge. */
function cutter(c: C, x: number, y: number, r: number) {
  const star = () => { c.beginPath(); for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (i * TAU) / 10, k = i % 2 ? r * 0.48 : r; if (i) c.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); else c.moveTo(x + Math.cos(a) * k, y + Math.sin(a) * k); } c.closePath(); };
  c.lineJoin = "round"; shade(c, 3, 1.4, 2.6, tint(0.55)); c.strokeStyle = "#7d8792"; c.lineWidth = 3.4; star(); c.stroke(); noShade(c);
  c.strokeStyle = lin(c, x - r, y - r, x + r, y + r, STEEL); c.lineWidth = 2.6; star(); c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 0.6; star(); c.stroke();
}
/** A kitchen canister with its lid on. */
function canister(c: C, x: number, y: number, r: number) {
  ao(c, x, y, r, 0.55); orb(c, x, y, r, "#e8505b");
  c.fillStyle = lin(c, x - r, y - r, x + r, y + r, [[0, "#ffffff"], [1, "#d9d2c4"]]); circ(c, x, y, r * 0.66); c.fill();
  c.fillStyle = "#c9c0ae"; circ(c, x, y, r * 0.22); c.fill(); gloss(c, x - r * 0.35, y - r * 0.4, r * 0.3, r * 0.15, 0.8);
}
function leg(c: C, x: number, y: number, r: number) {
  ao(c, x, y, r, 0.6); orb(c, x, y, r, "#6b3a1a"); c.fillStyle = "rgba(255,220,180,0.25)"; circ(c, x, y, r * 0.55); c.fill();
}
export function drawBump(c: C, u: Bump, imgs: Imgs) {
  const { x, y, r } = u;
  switch (u.k) {
    case "fruitbowl": fruitBowl(c, u, imgs); break;
    case "plate": plate(c, x, y, r); break;
    case "glass": glass(c, x, y, r); break;
    case "pepper": pepperMill(c, x, y, r); break;
    case "bottle": bottle(c, x, y, r, u.col ?? "#d8343a"); break;
    case "jamjar": jamJar(c, x, y, r); break;
    case "food": food(c, x, y, r, u.f, imgs); break;
    case "mug": mug(c, x, y, r, "#3f7fd6"); break;
    case "pan": pan(c, x, y, r, imgs); break;
    case "potbig": bigPot(c, x, y, r); break;
    case "can": can(c, x, y, r, u.col ?? "#d8343a"); break;
    case "cutter": cutter(c, x, y, r); break;
    case "canister": canister(c, x, y, r); break;
    case "leg": leg(c, x, y, r); break;
  }
}

// ── boxy things ──
/** A fork or knife: polished steel with a bright streak down it, an ebony handle with two rivets. */
function cutlery(c: C, b: Block) {
  const [x0, y0, x1, y1] = bbox(b.p), w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, ht = y0 + h * 0.52;
  shade(c, 4, 1.4, 2.8, tint(0.6)); c.fillStyle = tint(0.7); rr(c, x0 + 0.4, y0 + 1, w - 0.8, h - 1, 2.2); c.fill(); noShade(c);
  c.fillStyle = lin(c, x0, 0, x1, 0, [[0, "#2c1f18"], [0.32, "#6a4d3a"], [0.55, "#3f2c21"], [1, "#160e0a"]]); rr(c, x0 - 0.4, ht, w + 0.8, y1 - ht, 2.8); c.fill();
  c.strokeStyle = "rgba(255,225,190,0.4)"; c.lineWidth = 0.55; line(c, x0 + 1.3, ht + 2.5, x0 + 1.3, y1 - 2.5);
  for (const ry of [ht + 6.5, y1 - 6.5]) { c.fillStyle = "#dfe5eb"; circ(c, cx, ry, 0.95); c.fill(); c.fillStyle = "rgba(0,0,0,0.35)"; circ(c, cx + 0.3, ry + 0.35, 0.5); c.fill(); }
  c.fillStyle = lin(c, x0, 0, x1, 0, STEEL);
  if (b.k === "fork") {
    const neck = y0 + h * 0.31, tw = (w + 1.4) / 7;
    rr(c, cx - 1.25, neck - 1, 2.5, ht - neck + 2, 1); c.fill();
    c.beginPath(); c.moveTo(x0 - 0.7, y0 + h * 0.15); c.lineTo(x1 + 0.7, y0 + h * 0.15); c.lineTo(x1 + 0.5, y0 + h * 0.21); c.quadraticCurveTo(x1, neck, cx + 1.25, neck + 0.5); c.lineTo(cx - 1.25, neck + 0.5); c.quadraticCurveTo(x0, neck, x0 - 0.5, y0 + h * 0.21); c.closePath(); c.fill();
    for (let i = 0; i < 4; i++) { rr(c, x0 - 0.7 + i * 2 * tw, y0 + 0.4, tw, h * 0.16, tw / 2); c.fill(); }
  } else {
    const bot = y0 + h * 0.5;
    c.beginPath(); c.moveTo(x0 - 0.2, bot); c.lineTo(x0 - 0.2, y0 + 3); c.quadraticCurveTo(x0, y0, x0 + w * 0.62, y0 + 0.2); c.quadraticCurveTo(x1 + 0.8, y0 + 3.5, x1 + 0.5, y0 + h * 0.2); c.lineTo(x1 + 0.2, bot); c.closePath(); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 0.5; line(c, x1 - 0.3, y0 + h * 0.19, x1 - 0.4, bot - 1);
    c.fillStyle = lin(c, x0, 0, x1, 0, [[0, "#5f6974"], [0.4, "#d7dde3"], [1, "#4e5762"]]); rr(c, x0 - 0.5, bot - 1.2, w + 1, 2.6, 1); c.fill();
  }
  c.strokeStyle = "rgba(255,255,255,0.92)"; c.lineWidth = 0.55; line(c, x0 + w * 0.3, y0 + 1.5, x0 + w * 0.3, ht - 2);
  c.strokeStyle = "rgba(30,40,50,0.35)"; c.lineWidth = 0.5; line(c, x1 - 0.2, y0 + h * 0.22, x1 - 0.2, ht - 1);
}
/** A milk carton from above: two roof slopes (one in the light), the fin along the top, a blue label. */
function milkCarton(c: C, x: number, y: number, w: number, h: number) {
  aoBox(c, x, y, w, h, 3, 0.5, 9);
  c.fillStyle = "#e7ecf1"; rr(c, x, y, w, h, 3); c.fill();
  const m = y + h / 2;
  c.fillStyle = lin(c, 0, y, 0, m, [[0, "#ffffff"], [1, "#f1f4f7"]]); rr(c, x, y, w, h / 2, [3, 3, 0, 0]); c.fill();
  c.fillStyle = lin(c, 0, m, 0, y + h, [[0, "#d3dbe4"], [1, "#bcc7d2"]]); rr(c, x, m, w, h / 2, [0, 0, 3, 3]); c.fill();
  c.fillStyle = "#3f7fd6"; c.fillRect(x, y + h * 0.08, w, h * 0.12); c.fillStyle = "#2c63b5"; c.fillRect(x, y + h * 0.8, w, h * 0.12);
  c.fillStyle = "rgba(255,255,255,0.9)"; circ(c, x + w * 0.5, y + h * 0.3, 5); c.fill(); c.fillStyle = "#3f7fd6"; circ(c, x + w * 0.5, y + h * 0.3, 3); c.fill();
  drop(c, 3, 0.8, 1.6, 0.35); c.fillStyle = lin(c, 0, m - 3, 0, m + 3, [[0, "#ffffff"], [1, "#cfd7e0"]]); rr(c, x - 1.5, m - 2.6, w + 3, 5.2, 2); c.fill(); noShade(c);
  c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineWidth = 0.8; line(c, x, m - 1.8, x + w, m - 1.8);
  bevel(c, x, y, w, h, 3, 0.8);
}
/** An egg box: moulded pulp, eight glossy eggs sitting in their cups. */
function eggBox(c: C, x: number, y: number, w: number, h: number, rnd: Rnd) {
  aoBox(c, x, y, w, h, 7, 0.5, 8);
  c.fillStyle = lin(c, x, y, x + w, y + h, [[0, "#d8cbb4"], [1, "#a99a80"]]); rr(c, x, y, w, h, 7); c.fill();
  for (let i = 0; i < w * h * 0.08; i++) { c.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.18)" : "rgba(90,75,50,0.16)"; c.fillRect(x + rnd() * w, y + rnd() * h, 0.8, 0.8); }
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) {
    const ex = x + (w * (i + 0.5)) / 4, ey = y + (h * (j + 0.5)) / 2;
    c.fillStyle = rad(c, ex, ey, 6, 13, [[0, "rgba(80,62,38,0.45)"], [1, "rgba(80,62,38,0)"]]); circ(c, ex, ey, 13); c.fill();
    c.fillStyle = rad(c, ex - 3, ey - 3.4, 1, 12, [[0, "#fffdf6"], [0.6, "#f2e2c4"], [1, "#c9ad84"]]); ell(c, ex, ey, 10, 11); c.fill();
    gloss(c, ex - 3.4, ey - 4, 3.6, 2.2, 0.85);
  }
  bevel(c, x, y, w, h, 7, 0.7);
}
/** A kitchen sponge: yellow foam full of pores, a green scourer on top. */
function sponge(c: C, x: number, y: number, w: number, h: number, rnd: Rnd) {
  aoBox(c, x, y, w, h, 5, 0.5, 7);
  c.fillStyle = lin(c, x, y, x + w, y + h, [[0, "#ffe46a"], [1, "#e5b92b"]]); rr(c, x, y, w, h, 5); c.fill();
  c.save(); rr(c, x, y, w, h, 5); c.clip();
  for (let i = 0; i < 50; i++) { c.fillStyle = `rgba(150,105,10,${0.25 + rnd() * 0.3})`; ell(c, x + rnd() * w, y + h * 0.38 + rnd() * h * 0.62, 0.6 + rnd() * 1.2, 0.5 + rnd() * 0.9); c.fill(); }
  c.fillStyle = lin(c, 0, y, 0, y + h * 0.38, [[0, "#4fb15e"], [1, "#2f8a3f"]]); c.fillRect(x, y, w, h * 0.38);
  c.lineWidth = 0.5; for (let i = 0; i < 90; i++) { const px = x + rnd() * w, py = y + rnd() * h * 0.36, a = rnd() * TAU; c.strokeStyle = rnd() < 0.5 ? "rgba(190,240,190,0.5)" : "rgba(10,60,20,0.45)"; line(c, px, py, px + Math.cos(a) * 1.8, py + Math.sin(a) * 1.8); }
  c.restore(); bevel(c, x, y, w, h, 5, 1);
}
/** The broom's handle: a long varnished pole with a red cap. */
function broomHandle(c: C, p: Pt[]) {
  const [a, b, cc, d] = p, ax = (a[0] + d[0]) / 2, ay = (a[1] + d[1]) / 2, bx = (b[0] + cc[0]) / 2, by = (b[1] + cc[1]) / 2, nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny);
  c.lineCap = "round"; shade(c, 6, 3, 5, tint(0.5)); c.strokeStyle = "#a8692f"; c.lineWidth = 9; line(c, ax, ay, bx, by); noShade(c);
  c.strokeStyle = lin(c, ax + (nx / nl) * 4.5, ay + (ny / nl) * 4.5, ax - (nx / nl) * 4.5, ay - (ny / nl) * 4.5, [[0, "#7a4518"], [0.45, "#e8b072"], [0.6, "#d0904f"], [1, "#8a5220"]]); c.lineWidth = 8; line(c, ax, ay, bx, by);
  c.strokeStyle = "rgba(255,240,215,0.7)"; c.lineWidth = 1; line(c, ax - (nx / nl) * 1.6, ay - (ny / nl) * 1.6, bx - (nx / nl) * 1.6, by - (ny / nl) * 1.6);
  orb(c, bx, by, 5.4, "#e8505b"); gloss(c, bx - 1.5, by - 1.8, 1.8, 1, 0.9);
}
/** A pan handle: black bakelite with a hanging hole and two rivets. */
function panHandle(c: C, x: number, y: number, w: number, h: number) {
  aoBox(c, x, y, w, h, 4, 0.55, 5);
  c.fillStyle = lin(c, 0, y, 0, y + h, [[0, "#4a4e56"], [0.4, "#25282d"], [1, "#0f1013"]]); rr(c, x, y, w, h, 4.5); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 0.8; line(c, x + 3, y + 2.2, x + w - 4, y + 2.2);
  c.fillStyle = "#0a0b0d"; ell(c, x + w - 7, y + h / 2, 3, 2.2); c.fill();
  for (const rx of [x + 3.5, x + 8]) { c.fillStyle = "#c9d0d8"; circ(c, rx, y + h / 2, 1.2); c.fill(); }
}
/** An open cookbook: a red cover, pages that curve into the spine, lines of recipe and a picture. */
function cookbook(c: C, x: number, y: number, w: number, h: number) {
  aoBox(c, x - 3, y - 3, w + 6, h + 6, 3, 0.5, 9);
  c.fillStyle = lin(c, x - 3, y - 3, x + w + 3, y + h + 3, [[0, "#cf4e42"], [1, "#8e2a22"]]); rr(c, x - 3, y - 3, w + 6, h + 6, 3); c.fill();
  const m = x + w / 2;
  c.fillStyle = lin(c, x, 0, m, 0, [[0, "#fffdf6"], [0.85, "#f3ead8"], [1, "#d6c9ad"]]); c.fillRect(x, y, w / 2, h);
  c.fillStyle = lin(c, m, 0, x + w, 0, [[0, "#d6c9ad"], [0.15, "#f3ead8"], [1, "#fffdf6"]]); c.fillRect(m, y, w / 2, h);
  c.fillStyle = "rgba(90,90,90,0.38)"; for (let i = 0; i < 6; i++) { c.fillRect(x + 5, y + 8 + i * 8, w / 2 - 11, 1.6); if (i > 2) c.fillRect(m + 5, y + 8 + i * 8, w / 2 - 11, 1.6); }
  c.fillStyle = lin(c, m + 5, y + 6, m + w / 2 - 5, y + 26, [[0, "#f2b35c"], [1, "#d9712f"]]); rr(c, m + 5, y + 6, w / 2 - 10, 19, 2); c.fill();
  c.fillStyle = "rgba(255,255,255,0.6)"; circ(c, m + w / 4, y + 15, 4); c.fill();
  c.fillStyle = "#c8463c"; c.beginPath(); c.moveTo(m + 2, y - 3); c.lineTo(m + 6, y - 3); c.lineTo(m + 6, y + h * 0.55); c.lineTo(m + 4, y + h * 0.5); c.lineTo(m + 2, y + h * 0.55); c.closePath(); c.fill();
  bevel(c, x - 3, y - 3, w + 6, h + 6, 3, 0.6);
}
/** A coffee maker from above: glossy black, a glass carafe lid with coffee showing, a red light. */
function coffeeMaker(c: C, x: number, y: number, w: number, h: number) {
  aoBox(c, x, y, w, h, 8, 0.55, 10);
  c.fillStyle = lin(c, x, y, x + w, y + h, [[0, "#4a4e56"], [0.35, "#26292e"], [1, "#101114"]]); rr(c, x, y, w, h, 8); c.fill();
  c.fillStyle = lin(c, x, y, x + w, y, [[0, "#c9d0d8"], [0.5, "#f4f6f8"], [1, "#8d97a2"]]); rr(c, x + 4, y + 4, w - 8, 6, 3); c.fill();
  const cx = x + w / 2, cy = y + h * 0.58, r = w * 0.3;
  c.fillStyle = "rgba(160,205,235,0.35)"; circ(c, cx, cy, r + 3); c.fill(); c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 1; circ(c, cx, cy, r + 3); c.stroke();
  c.fillStyle = rad(c, cx + 2, cy + 2, 0, r, [[0, "#6b3a1e"], [1, "#2e1607"]]); circ(c, cx, cy, r); c.fill();
  gloss(c, cx - r * 0.4, cy - r * 0.45, r * 0.4, r * 0.2, 0.7);
  c.fillStyle = rad(c, x + 11, y + 17, 0, 6, [[0, "rgba(255,90,90,0.9)"], [1, "rgba(255,60,60,0)"]]); circ(c, x + 11, y + 17, 6); c.fill(); c.fillStyle = "#ff6b6b"; circ(c, x + 11, y + 17, 2); c.fill();
  bevel(c, x, y, w, h, 8, 1);
}
/** A chrome toaster from above: two slots, a lever, the kitchen reflected in its sides. */
export function toaster(c: C, cx: number, cy: number, w: number, h: number) {
  const x = cx - w / 2, y = cy - h / 2;
  aoBox(c, x, y, w, h, 12, 0.55, 10);
  c.fillStyle = lin(c, x, y, x + w, y + h, [[0, "#ffffff"], [0.2, "#dfe4e9"], [0.38, "#9aa3ad"], [0.55, "#e9edf1"], [0.8, "#aab3bd"], [1, "#6c7682"]]); rr(c, x, y, w, h, 12); c.fill();
  c.fillStyle = "rgba(255,255,255,0.7)"; rr(c, x + 6, y + 4, w - 12, 3.5, 1.7); c.fill();
  for (const o of [-0.2, 0.2]) {
    c.fillStyle = "#cfd5db"; rr(c, cx - w * 0.34, cy + o * h - 5.2, w * 0.68, 10.4, 5.2); c.fill();
    c.fillStyle = lin(c, 0, cy + o * h - 4, 0, cy + o * h + 4, [[0, "#0b0c0e"], [1, "#3a3f46"]]); rr(c, cx - w * 0.32, cy + o * h - 4, w * 0.64, 8, 4); c.fill();
    c.fillStyle = "rgba(255,150,70,0.18)"; rr(c, cx - w * 0.28, cy + o * h - 1, w * 0.56, 2.5, 1.2); c.fill();
  }
  c.fillStyle = "#2b2f35"; rr(c, x + w - 3, cy - 6, 6, 12, 2.5); c.fill(); c.fillStyle = "rgba(255,255,255,0.4)"; rr(c, x + w - 2, cy - 5, 2, 10, 1); c.fill();
  c.strokeStyle = "rgba(50,60,70,0.55)"; c.lineWidth = 0.8; rr(c, x + 0.4, y + 0.4, w - 0.8, h - 0.8, 11.6); c.stroke();
}
/** A blender from above: a black base, the glass jug's rim and its lid with a cap. */
function blender(c: C, x: number, y: number, w: number, h: number) {
  aoBox(c, x, y, w, h, 10, 0.55, 9);
  c.fillStyle = lin(c, x, y, x + w, y + h, [[0, "#4a4e56"], [1, "#121316"]]); rr(c, x, y, w, h, 10); c.fill();
  const cx = x + w / 2, cy = y + h / 2, r = w * 0.42;
  c.fillStyle = "rgba(200,232,248,0.45)"; circ(c, cx, cy, r); c.fill(); c.strokeStyle = "rgba(255,255,255,0.75)"; c.lineWidth = 1.2; circ(c, cx, cy, r); c.stroke();
  c.fillStyle = lin(c, cx - r, cy - r, cx + r, cy + r, [[0, "#3b3f46"], [1, "#16171a"]]); circ(c, cx, cy, r * 0.78); c.fill();
  c.fillStyle = lin(c, cx - 7, cy - 7, cx + 7, cy + 7, [[0, "#7a828c"], [1, "#2b2f35"]]); circ(c, cx, cy, 6.5); c.fill();
  gloss(c, cx - r * 0.45, cy - r * 0.5, r * 0.4, r * 0.18, 0.75);
  c.fillStyle = "#2eaa6e"; circ(c, x + w - 9, y + h - 9, 2); c.fill();
  bevel(c, x, y, w, h, 10, 1);
}
/** A cereal or pasta box lying flat: printed, a white label, a little picture of what's inside. */
function box(c: C, x: number, y: number, w: number, h: number, col: string, k: string) {
  aoBox(c, x, y, w, h, 3, 0.55, 9);
  c.fillStyle = lin(c, x, y, x + w, y + h, [[0, lighter(col, 0.2)], [1, darker(col, 0.2)]]); rr(c, x, y, w, h, 3); c.fill();
  const lx = x + 5, ly = y + 5, lw = w - 10, lh = h * 0.36;
  c.fillStyle = "rgba(255,255,255,0.92)"; rr(c, lx, ly, lw, lh, 3); c.fill();
  c.fillStyle = darker(col, 0.25); rr(c, lx + 4, ly + lh * 0.3, lw * 0.6, lh * 0.18, 1); c.fill(); rr(c, lx + 4, ly + lh * 0.6, lw * 0.38, lh * 0.14, 1); c.fill();
  c.fillStyle = k === "cereal" ? "#fff3d6" : "#fff8e0"; rr(c, x + 6, y + h * 0.52, w - 12, h * 0.38, h * 0.12); c.fill();
  const n = k === "cereal" ? 6 : 4;
  for (let i = 0; i < n; i++) {
    const px = x + 12 + (i * (w - 24)) / Math.max(1, n - 1), py = y + h * 0.71;
    if (k === "cereal") { c.fillStyle = rad(c, px - 1, py - 1, 0.3, 3.6, [[0, "#f0b058"], [1, "#b8641e"]]); circ(c, px, py, 3.4); c.fill(); c.fillStyle = "#8a4a14"; circ(c, px, py, 1); c.fill(); }
    else { c.fillStyle = lin(c, px - 2, 0, px + 2, 0, [[0, "#f5d77a"], [1, "#d9a83a"]]); rr(c, px - 1.6, py - h * 0.13, 3.2, h * 0.26, 1.6); c.fill(); }
  }
  c.fillStyle = "rgba(0,0,0,0.18)"; c.fillRect(x, y + h - 5, w, 5);
  bevel(c, x, y, w, h, 3, 1);
}
function tableLeg(c: C, x: number, y: number, w: number, h: number) {
  aoBox(c, x, y, w, h, 3, 0.6, 6);
  c.fillStyle = lin(c, x, y, x + w, y + h, [[0, "#9a5d2c"], [1, "#4f2a10"]]); rr(c, x, y, w, h, 3); c.fill();
  c.strokeStyle = "rgba(40,18,4,0.35)"; c.lineWidth = 0.6; for (let i = 1; i <= 3; i++) { rr(c, x + i * 2.6, y + i * 2.6, w - i * 5.2, h - i * 5.2, 2); c.stroke(); }
  bevel(c, x, y, w, h, 3, 1);
}
export function drawBlock(c: C, b: Block, rnd: Rnd) {
  const [x0, y0, x1, y1] = bbox(b.p), w = x1 - x0, h = y1 - y0;
  switch (b.k) {
    case "fork": case "knife": cutlery(c, b); break;
    case "carton": milkCarton(c, x0, y0, w, h); break;
    case "eggs": eggBox(c, x0, y0, w, h, rnd); break;
    case "sponge": sponge(c, x0, y0, w, h, rnd); break;
    case "broom": broomHandle(c, b.p); break;
    case "panhandle": panHandle(c, x0, y0, w, h); break;
    case "cookbook": cookbook(c, x0, y0, w, h); break;
    case "coffeemaker": coffeeMaker(c, x0, y0, w, h); break;
    case "toaster": toaster(c, x0 + w / 2, y0 + h / 2, w, h); break;
    case "blender": blender(c, x0, y0, w, h); break;
    case "cereal": case "pasta": box(c, x0, y0, w, h, b.col ?? "#e8a43a", b.k); break;
    case "tableleg": tableLeg(c, x0, y0, w, h); break;
    default: drop(c); c.fillStyle = b.col ?? "#c98b52"; poly(c, b.p); c.fill(); noShade(c);
  }
}

// ── zones ──
/** A woven placemat (a slow patch): a basket-weave rattan field, a stitched terracotta border. */
function placemat(c: C, r: Rect, rnd: Rnd) {
  const [x0, y0, x1, y1] = r, w = x1 - x0, h = y1 - y0;
  shade(c, 6, 1.6, 3.2, tint(0.5)); c.fillStyle = "#a63e25"; rr(c, x0, y0, w, h, 6); c.fill(); noShade(c);
  c.fillStyle = lin(c, x0, y0, x1, y1, [[0, "#dc6744"], [0.5, "#c24f30"], [1, "#9a3820"]]); rr(c, x0, y0, w, h, 6); c.fill();
  const ix = x0 + 6.5, iy = y0 + 6.5, iw = w - 13, ih = h - 13;
  c.save(); rr(c, ix, iy, iw, ih, 3); c.clip(); c.fillStyle = "#b98d57"; c.fillRect(ix, iy, iw, ih);
  weave(c, ix, iy, iw, ih, rnd, ["#f1d8a6", "#e6c690", "#d8b47b"]);
  c.fillStyle = lin(c, ix, iy, ix + iw, iy + ih, [[0, "rgba(255,245,220,0.22)"], [0.5, "rgba(255,245,220,0)"], [1, "rgba(70,40,10,0.18)"]]); c.fillRect(ix, iy, iw, ih);
  c.restore();
  c.strokeStyle = "rgba(70,25,10,0.55)"; c.lineWidth = 1.1; rr(c, ix, iy, iw, ih, 3); c.stroke();
  c.strokeStyle = "rgba(255,225,200,0.75)"; c.lineWidth = 0.8; c.setLineDash([2.2, 1.8]); rr(c, x0 + 3.2, y0 + 3.2, w - 6.4, h - 6.4, 4.5); c.stroke(); c.setLineDash([]);
  c.lineWidth = 1.2; c.strokeStyle = "rgba(255,210,180,0.6)"; c.beginPath(); c.moveTo(x0 + 0.8, y1 - 6); c.lineTo(x0 + 0.8, y0 + 0.8); c.lineTo(x1 - 6, y0 + 0.8); c.stroke();
}
/** A basket weave: little squares of three strands, across then down, in turn. */
function weave(c: C, x: number, y: number, w: number, h: number, rnd: Rnd, cols: string[], cell = 7.2) {
  const sw = cell / 3;
  for (let j = 0, yy = y - 1; yy < y + h; yy += cell, j++) for (let i = 0, xx = x - 1; xx < x + w; xx += cell, i++) {
    const across = (i + j) % 2 === 0;
    for (let q = 0; q < 3; q++) {
      const col = cols[Math.floor(rnd() * cols.length)];
      if (across) { const sy = yy + q * sw; c.fillStyle = lin(c, 0, sy, 0, sy + sw, [[0, lighter(col, 0.3)], [0.5, col], [1, mix(col, "#5e3a12", 0.32)]]); rr(c, xx + 0.35, sy + 0.2, cell - 0.7, sw - 0.4, 1); }
      else { const sx = xx + q * sw; c.fillStyle = lin(c, sx, 0, sx + sw, 0, [[0, lighter(col, 0.3)], [0.5, col], [1, mix(col, "#5e3a12", 0.32)]]); rr(c, sx + 0.2, yy + 0.35, sw - 0.4, cell - 0.7, 1); }
      c.fill();
    }
  }
}
/** The chopping board ramp: a thick maple board, its upper half tilted toward the light and the lower half away, with
 *  a bright ridge where they meet (the ball runs off the ridge both ways). */
function boardRamp(c: C, r: Rect, y1: number, k: Course, rnd: Rnd) {
  const [x0, ry0, x1, mid] = r, w = x1 - x0, h = y1 - ry0;
  shade(c, 14, 5, 9, tint(0.6)); c.fillStyle = "#4a240c"; rr(c, x0, ry0, w, h, 12); c.fill(); noShade(c);
  c.save(); rr(c, x0, ry0, w, h, 12); c.clip();
  planks(c, x0, ry0, x1, y1, rnd, ["#7a3f1c", "#6a3516", "#86471f", "#5e2f12"], "30,10,0", { vertical: true, size: [22, 10], joints: false });
  c.fillStyle = lin(c, 0, ry0, 0, mid, [[0, "rgba(255,225,180,0)"], [1, "rgba(255,225,180,0.2)"]]); c.fillRect(x0, ry0, w, mid - ry0);
  c.fillStyle = lin(c, 0, mid, 0, y1, [[0, "rgba(20,6,0,0.38)"], [1, "rgba(20,6,0,0.06)"]]); c.fillRect(x0, mid, w, y1 - mid);
  c.restore();
  c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 2; line(c, x0 + 6, mid, x1 - 6, mid);
  c.strokeStyle = "rgba(20,6,0,0.5)"; c.lineWidth = 1.6; rr(c, x0 + 7, ry0 + 7, w - 14, h - 14, 7); c.stroke();
  c.strokeStyle = "rgba(255,220,180,0.35)"; c.lineWidth = 0.8; rr(c, x0 + 8.2, ry0 + 8.2, w - 16.4, h - 16.4, 6); c.stroke();
  c.strokeStyle = "rgba(255,240,215,0.6)"; c.lineWidth = 1.4; rr(c, x0 + 1, ry0 + 1, w - 2, h - 2, 11); c.stroke();
  const hx = k.mirror ? x0 + 16 : x1 - 16, hy = (ry0 + y1) / 2;   // the hanging hole
  c.fillStyle = lin(c, hx - 6, hy - 6, hx + 6, hy + 6, [[0, "#6b4320"], [1, "#d9a066"]]); circ(c, hx, hy, 6); c.fill();
  c.fillStyle = k.place === "counter" ? "#c8925a" : "#222"; circ(c, hx, hy, 4.4); c.fill();
}
/** Frost on the glass shelf (a slick patch): icy white, feathered crystals, a few snowflakes, and bright streaks. */
function frost(c: C, r: Rect, rnd: Rnd) {
  const [x0, y0, x1, y1] = r, w = x1 - x0, h = y1 - y0;
  shade(c, 8, 0, 0, "rgba(255,255,255,0.9)"); c.fillStyle = rad(c, x0 + w / 2, y0 + h / 2, 4, Math.max(w, h) * 0.6, [[0, "rgba(255,255,255,0.97)"], [0.7, "rgba(240,250,255,0.9)"], [1, "rgba(225,243,253,0.8)"]]); rr(c, x0, y0, w, h, 14); c.fill(); noShade(c);
  c.save(); rr(c, x0, y0, w, h, 14); c.clip();
  c.lineCap = "round";
  for (let i = 0; i < 60; i++) { const sx = x0 + rnd() * w, sy = y0 + rnd() * h, a = rnd() * TAU, l = 3 + rnd() * 8; c.strokeStyle = `rgba(110,180,225,${0.35 + rnd() * 0.35})`; c.lineWidth = 0.55; line(c, sx, sy, sx + Math.cos(a) * l, sy + Math.sin(a) * l); for (const s of [-1, 1]) { const bx = sx + Math.cos(a) * l * 0.5, by = sy + Math.sin(a) * l * 0.5; line(c, bx, by, bx + Math.cos(a + s * 0.8) * l * 0.35, by + Math.sin(a + s * 0.8) * l * 0.35); } }
  for (const o of [0.15, 0.55]) { c.fillStyle = "rgba(255,255,255,0.75)"; c.beginPath(); c.moveTo(x0 + w * o, y0); c.lineTo(x0 + w * (o + 0.1), y0); c.lineTo(x0 + w * (o + 0.02), y1); c.lineTo(x0 + w * (o - 0.08), y1); c.closePath(); c.fill(); }
  c.restore();
  for (let i = 0; i < 5; i++) {   // snowflakes
    const sx = x0 + 14 + rnd() * (w - 28), sy = y0 + 12 + rnd() * (h - 24), s = 3.5 + rnd() * 3; c.strokeStyle = "rgba(120,185,225,0.85)"; c.lineWidth = 0.9;
    for (let a = 0; a < 3; a++) { const an = (a * Math.PI) / 3; line(c, sx - Math.cos(an) * s, sy - Math.sin(an) * s, sx + Math.cos(an) * s, sy + Math.sin(an) * s); }
  }
  c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 1.2; rr(c, x0 + 0.6, y0 + 0.6, w - 1.2, h - 1.2, 13.4); c.stroke();
  c.strokeStyle = "rgba(130,190,225,0.5)"; c.lineWidth = 0.8; rr(c, x0 + 2, y0 + 2, w - 4, h - 4, 12); c.stroke();
}
/** Soap suds (a sticky patch): a white foam with soft, glinting bubbles, big in the middle and small at the edges. */
function suds(c: C, x: number, y: number, R: number, rnd: Rnd) {
  c.fillStyle = rad(c, x, y, R * 0.3, R * 1.05, [[0, "rgba(255,255,255,0.35)"], [1, "rgba(255,255,255,0)"]]); circ(c, x, y, R * 1.05); c.fill();
  const blobs: number[][] = [];
  for (let i = 0; i < 22; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * R * 0.72, s = (8 + rnd() * 10) * (1.1 - d / R * 0.5); blobs.push([x + Math.cos(a) * d, y + Math.sin(a) * d, s]); }
  shade(c, 6, 1.5, 3, "rgba(40,55,75,0.35)"); c.fillStyle = "#eef3f8"; for (const [bx, by, s] of blobs) { circ(c, bx, by, s); c.fill(); } noShade(c);
  for (const [bx, by, s] of blobs) { c.fillStyle = rad(c, bx - s * 0.3, by - s * 0.35, 0, s * 1.1, [[0, "#ffffff"], [0.6, "#f2f6fa"], [1, "#c9d6e3"]]); circ(c, bx, by, s); c.fill(); }
  const bubbles: number[][] = [];
  for (let i = 0; i < 44; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * R * 0.92, s = (2 + rnd() * 6) * (1.15 - d / R * 0.6); bubbles.push([x + Math.cos(a) * d, y + Math.sin(a) * d, s]); }
  bubbles.sort((p, q) => p[1] - q[1]);
  for (const [bx, by, s] of bubbles) {
    c.fillStyle = rad(c, bx, by, s * 0.3, s, [[0, "rgba(255,255,255,0.05)"], [0.8, "rgba(235,245,255,0.35)"], [1, "rgba(255,255,255,0.6)"]]); circ(c, bx, by, s); c.fill();
    c.strokeStyle = "rgba(150,180,215,0.6)"; c.lineWidth = 0.6; circ(c, bx, by, s); c.stroke();
    c.strokeStyle = "rgba(255,170,220,0.45)"; c.lineWidth = 0.7; c.beginPath(); c.arc(bx, by, s * 0.8, 0.2, 1.2); c.stroke();
    c.strokeStyle = "rgba(140,220,255,0.5)"; c.beginPath(); c.arc(bx, by, s * 0.8, 1.4, 2.2); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.95)"; ell(c, bx - s * 0.38, by - s * 0.4, s * 0.26, s * 0.15, -0.7); c.fill();
  }
}
/** The water swirling down the drain (a pull): a wet sheen with arcs spiralling in. */
function swirl(c: C, x: number, y: number, R: number) {
  c.fillStyle = rad(c, x, y, 4, R, [[0, "rgba(90,150,205,0.4)"], [0.6, "rgba(120,175,220,0.22)"], [1, "rgba(120,175,220,0)"]]); circ(c, x, y, R); c.fill();
  c.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    c.strokeStyle = `rgba(255,255,255,${0.55 - i * 0.08})`; c.lineWidth = 1.8 - i * 0.25; c.beginPath();
    for (let s = 0; s <= 30; s++) { const t = s / 30, a = i * (TAU / 4) + t * 4.2, d = R * (0.92 - t * 0.62); if (s) c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); else c.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
    c.stroke();
  }
}
/** A rug (a slow patch): a woven red and navy pattern with a gold border and fringes. */
function rug(c: C, r: Rect, rnd: Rnd) {
  const [x0, y0, x1, y1] = r, w = x1 - x0, h = y1 - y0, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  c.strokeStyle = "#efe3c8"; c.lineWidth = 1.2; for (let y = y0 + 3; y < y1 - 1; y += 3.2) { line(c, x0 - 6, y + (rnd() - 0.5), x0, y); line(c, x1, y, x1 + 6, y + (rnd() - 0.5)); }
  shade(c, 8, 2, 4, tint(0.5)); c.fillStyle = "#8f3328"; rr(c, x0, y0, w, h, 3); c.fill(); noShade(c);
  c.fillStyle = lin(c, x0, y0, x1, y1, [[0, "#c2493a"], [1, "#8a2d23"]]); rr(c, x0, y0, w, h, 3); c.fill();
  c.fillStyle = lin(c, x0, y0, x1, y1, [[0, "#f3cf75"], [1, "#c99a3b"]]); rr(c, x0 + 8, y0 + 8, w - 16, h - 16, 2); c.fill();
  c.fillStyle = lin(c, x0, y0, x1, y1, [[0, "#2d6f97"], [1, "#183f5c"]]); rr(c, x0 + 13, y0 + 13, w - 26, h - 26, 2); c.fill();
  c.fillStyle = "#b8463a"; c.beginPath(); c.moveTo(mx, y0 + 24); c.lineTo(x1 - 26, my); c.lineTo(mx, y1 - 24); c.lineTo(x0 + 26, my); c.closePath(); c.fill();
  c.strokeStyle = "#f3cf75"; c.lineWidth = 2; c.stroke();
  c.fillStyle = "#f3cf75"; c.beginPath(); c.moveTo(mx, my - 16); c.lineTo(mx + 14, my); c.lineTo(mx, my + 16); c.lineTo(mx - 14, my); c.closePath(); c.fill();
  c.fillStyle = "#2d6f97"; circ(c, mx, my, 5); c.fill();
  for (const [cx, cy] of [[x0 + 22, y0 + 22], [x1 - 22, y0 + 22], [x0 + 22, y1 - 22], [x1 - 22, y1 - 22]]) { c.fillStyle = "#f3cf75"; c.beginPath(); c.moveTo(cx, cy - 5); c.lineTo(cx + 5, cy); c.lineTo(cx, cy + 5); c.lineTo(cx - 5, cy); c.closePath(); c.fill(); }
  c.save(); rr(c, x0, y0, w, h, 3); c.clip();
  for (let y = y0; y < y1; y += 1.6) { c.fillStyle = `rgba(${rnd() < 0.5 ? "255,240,220" : "40,10,5"},${0.04 + rnd() * 0.05})`; c.fillRect(x0, y, w, 0.7); }
  c.fillStyle = lin(c, x0, y0, x1, y1, [[0, "rgba(255,240,215,0.14)"], [0.5, "rgba(255,240,215,0)"], [1, "rgba(30,10,0,0.18)"]]); c.fillRect(x0, y0, w, h);
  c.restore();
}
/** The dog's water bowl (a hazard): a steel bowl full of bright water. */
function waterBowl(c: C, x: number, y: number, R: number) {
  ao(c, x, y, R + 7, 0.55);
  drop(c, 8, 2.6, 5, 0.5); c.fillStyle = "#8d97a2"; circ(c, x, y, R + 7); c.fill(); noShade(c);
  steelDisc(c, x, y, R + 7); c.fillStyle = lin(c, x - R, y - R, x + R, y + R, [[0, "#6c7682"], [1, "#e9edf1"]]); circ(c, x, y, R + 2); c.fill();
  c.fillStyle = rad(c, x - R * 0.3, y - R * 0.3, 1, R, [[0, "#b8e6ff"], [0.5, "#5fb4ea"], [1, "#2d7fc4"]]); circ(c, x, y, R); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 1; for (const f of [0.35, 0.62, 0.86]) { c.beginPath(); c.arc(x + 2, y + 2, R * f, 0.3, 2.6); c.stroke(); }
  gloss(c, x - R * 0.38, y - R * 0.42, R * 0.4, R * 0.18, 0.85); rimArc(c, x, y, R + 6, 1.4, 0.85);
}
/** A cooktop coil printed on black glass: a dull spiral that glows when lit (the glow is drawn live). */
export function coil(c: C, x: number, y: number, R: number) {
  c.fillStyle = rad(c, x, y, R * 0.2, R, [[0, "rgba(0,0,0,0.35)"], [1, "rgba(0,0,0,0.15)"]]); circ(c, x, y, R); c.fill();
  c.strokeStyle = "rgba(230,235,240,0.5)"; c.lineWidth = 0.9; circ(c, x, y, R); c.stroke(); c.setLineDash([2, 3]); circ(c, x, y, R + 4); c.stroke(); c.setLineDash([]);
  const spiral = (lw: number, col: string, dx = 0, dy = 0) => {
    c.strokeStyle = col; c.lineWidth = lw; c.lineCap = "round"; c.beginPath();
    for (let s = 0; s <= 200; s++) { const t = s / 200, a = t * TAU * 4, d = R * (0.2 + t * 0.7); if (s) c.lineTo(x + dx + Math.cos(a) * d, y + dy + Math.sin(a) * d); else c.moveTo(x + dx + Math.cos(a) * d, y + dy + Math.sin(a) * d); }
    c.stroke();
  };
  spiral(3.6, "rgba(0,0,0,0.6)", 0.6, 1); spiral(2.8, "#3e3734"); spiral(0.8, "rgba(255,210,190,0.22)", -0.5, -0.6);
}
/** The spatula ramp: a black silicone turner with slots, chevrons showing which way it tips, a wooden handle. */
function spatula(c: C, r: Rect, mirror: boolean) {
  const [x0, y0, x1, y1] = r, w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const hx0 = mirror ? x0 - 44 : x1 - 2;
  drop(c, 6, 2, 4, 0.5); c.fillStyle = lin(c, 0, cy - 5, 0, cy + 5, [[0, "#e0a868"], [1, "#9a6232"]]); rr(c, hx0, cy - 5, 46, 10, 5); c.fill(); noShade(c);
  c.strokeStyle = "rgba(255,240,215,0.6)"; c.lineWidth = 0.8; line(c, hx0 + 4, cy - 3, hx0 + 42, cy - 3);
  shade(c, 8, 2.6, 5, tint(0.55)); c.fillStyle = "#18191c"; rr(c, x0, y0, w, h, 10); c.fill(); noShade(c);
  c.fillStyle = lin(c, x0, y0, x1, y1, [[0, "#4a4e56"], [0.5, "#26292e"], [1, "#16171a"]]); rr(c, x0, y0, w, h, 10); c.fill();
  c.fillStyle = "#0b0c0e"; for (let x = x0 + 14; x < x1 - 10; x += 16) { rr(c, x, y0 + 9, 6, h - 18, 3); c.fill(); c.fillStyle = "rgba(255,255,255,0.12)"; rr(c, x + 0.5, y0 + h - 10, 5, 1, 0.5); c.fill(); c.fillStyle = "#0b0c0e"; }
  c.strokeStyle = "rgba(255,255,255,0.75)"; c.lineWidth = 2.6; c.lineCap = "round"; c.lineJoin = "round";
  for (const o of [-14, 6]) { c.beginPath(); c.moveTo(cx - 10, cy + o - 6); c.lineTo(cx, cy + o + 2); c.lineTo(cx + 10, cy + o - 6); c.stroke(); }
  c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x0 + 2, y1 - 8); c.lineTo(x0 + 2, y0 + 2); c.lineTo(x1 - 8, y0 + 2); c.stroke();
}
/** A crisper drawer (a slick patch): frosted ribbed plastic, glossy streaks, a lip and a finger pull at the front. */
function drawer(c: C, r: Rect, rnd: Rnd) {
  const [x0, y0, x1, y1] = r, w = x1 - x0, h = y1 - y0;
  c.fillStyle = lin(c, x0, y0, x0, y1, [[0, "rgba(206,230,244,0.92)"], [1, "rgba(170,206,228,0.92)"]]); c.fillRect(x0, y0, w, h);
  c.lineWidth = 0.9; for (let x = x0 + 10; x < x1; x += 11) { c.strokeStyle = "rgba(95,145,180,0.45)"; line(c, x, y0, x, y1 - 26); c.strokeStyle = "rgba(255,255,255,0.75)"; line(c, x + 1.2, y0, x + 1.2, y1 - 26); }
  for (let i = 0; i < w * h * 0.004; i++) { c.fillStyle = "rgba(255,255,255,0.5)"; c.fillRect(x0 + rnd() * w, y0 + rnd() * h, 0.8, 0.8); }
  for (const o of [0.12, 0.5]) { c.fillStyle = "rgba(255,255,255,0.45)"; c.beginPath(); c.moveTo(x0 + w * o, y0); c.lineTo(x0 + w * (o + 0.14), y0); c.lineTo(x0 + w * (o + 0.02), y1 - 26); c.lineTo(x0 + w * (o - 0.12), y1 - 26); c.closePath(); c.fill(); }
  c.fillStyle = lin(c, 0, y1 - 26, 0, y1, [[0, "rgba(255,255,255,0.85)"], [1, "rgba(215,232,242,0.95)"]]); c.fillRect(x0, y1 - 26, w, 26);
  c.fillStyle = "rgba(120,160,190,0.35)"; c.fillRect(x0, y1 - 26, w, 1);
  c.fillStyle = lin(c, 0, y1 - 18, 0, y1 - 10, [[0, "rgba(120,160,190,0.75)"], [1, "rgba(200,225,240,0.6)"]]); rr(c, (x0 + x1) / 2 - 22, y1 - 18, 44, 8, 4); c.fill();
}
/** A pile of flour (a sticky patch): a soft powdery mound, fine grains, a dusting round it. */
function flourPile(c: C, x: number, y: number, R: number, rnd: Rnd) {
  for (let i = 0; i < 40; i++) { const a = rnd() * TAU, d = R * (0.8 + rnd() * 0.6); c.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.2})`; circ(c, x + Math.cos(a) * d, y + Math.sin(a) * d, 0.6 + rnd() * 1.4); c.fill(); }
  shade(c, 6, 1.5, 3, tint(0.25));
  c.fillStyle = rad(c, x - R * 0.15, y - R * 0.2, R * 0.1, R, [[0, "rgba(255,255,255,0.97)"], [0.6, "rgba(250,248,242,0.85)"], [1, "rgba(245,240,230,0)"]]); circ(c, x, y, R); c.fill(); noShade(c);
  for (let i = 0; i < 9; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * R * 0.75, s = 5 + rnd() * 9; c.fillStyle = rad(c, x + Math.cos(a) * d - s * 0.2, y + Math.sin(a) * d - s * 0.25, 0, s, [[0, "rgba(255,255,255,0.7)"], [1, "rgba(255,255,255,0)"]]); circ(c, x + Math.cos(a) * d, y + Math.sin(a) * d, s); c.fill(); }
  c.fillStyle = rad(c, x + R * 0.2, y + R * 0.28, 0, R * 0.7, [[0, "rgba(180,165,140,0.2)"], [1, "rgba(180,165,140,0)"]]); circ(c, x, y, R * 0.9); c.fill();
  for (let i = 0; i < 160; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * R * 0.9; c.fillStyle = rnd() < 0.7 ? "rgba(255,255,255,0.8)" : "rgba(200,190,170,0.4)"; c.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.7, 0.7); }
}
export function drawZone(c: C, z: Zone, k: Course, rnd: Rnd) {
  const r = (z as { r?: Rect }).r, cr = (z as { c?: [number, number, number] }).c;
  switch (z.look) {
    case "boardDown": { const up = k.zones.find(q => q.look === "boardUp") as { r: Rect } | undefined; boardRamp(c, r!, up ? up.r[3] : r![3], k, rnd); break; }
    case "mat": placemat(c, r!, rnd); break;
    case "frost": frost(c, r!, rnd); break;
    case "suds": suds(c, cr![0], cr![1], cr![2], rnd); break;
    case "swirl": swirl(c, cr![0], cr![1], cr![2]); break;
    case "rug": rug(c, r!, rnd); break;
    case "waterbowl": waterBowl(c, cr![0], cr![1], cr![2]); break;
    case "burner": coil(c, cr![0], cr![1], cr![2]); break;
    case "spatula": spatula(c, r!, k.mirror); break;
    case "drawer": drawer(c, r!, rnd); break;
    case "flour": flourPile(c, cr![0], cr![1], cr![2], rnd); break;
  }
}

// ── scenery ──
/** A wooden chair seen from above, tucked in at the table: seat, a teal cushion with piping, the back on the far side. */
function chair(c: C, d: Deco, mid: Pt, alpha = 1) {
  const { x, y } = d, w = d.w ?? 40, h = d.h ?? 40, x0 = x - w / 2, y0 = y - h / 2;
  c.save(); c.globalAlpha = alpha;
  shade(c, 12, 5, 9, "rgba(40,24,8,0.45)"); c.fillStyle = "#7a4520"; rr(c, x0, y0, w, h, 11); c.fill(); noShade(c);
  c.fillStyle = lin(c, x0, y0, x0 + w, y0 + h, [[0, "#b8743c"], [0.5, "#9a5a2b"], [1, "#77401c"]]); rr(c, x0 + 1, y0 + 1, w - 2, h - 2, 10); c.fill();
  c.strokeStyle = "rgba(255,220,170,0.4)"; c.lineWidth = 1.2; rr(c, x0 + 1.6, y0 + 1.6, w - 3.2, h - 3.2, 9.5); c.stroke();
  const ix = x0 + 7, iy = y0 + 7, iw = w - 14, ih = h - 14;
  shade(c, 3, 1, 2, "rgba(20,30,35,0.4)"); c.fillStyle = "#2b7480"; rr(c, ix, iy, iw, ih, 8); c.fill(); noShade(c);
  c.fillStyle = rad(c, ix + iw * 0.35, iy + ih * 0.3, 2, Math.max(iw, ih) * 0.75, [[0, "#4fa3ad"], [0.6, "#2f7d88"], [1, "#205a62"]]); rr(c, ix, iy, iw, ih, 8); c.fill();
  c.strokeStyle = "rgba(220,245,248,0.55)"; c.lineWidth = 0.9; c.setLineDash([2, 1.6]); rr(c, ix + 2.5, iy + 2.5, iw - 5, ih - 5, 6); c.stroke(); c.setLineDash([]);
  c.fillStyle = "#1c4d55"; circ(c, ix + iw / 2, iy + ih / 2, 1.8); c.fill();
  const horiz = w > h, far = horiz ? (y > mid[1] ? 1 : -1) : (x > mid[0] ? 1 : -1), t = 8;
  if (mid[0] > 0) {   // the back, on the side away from the table (a seat seen from above has none)
    const bx = horiz ? x0 + 4 : far > 0 ? x0 + w - t + 3 : x0 - 3, by = horiz ? (far > 0 ? y0 + h - t + 3 : y0 - 3) : y0 + 4, bw = horiz ? w - 8 : t, bh = horiz ? t : h - 8;
    shade(c, 6, 3, 5, "rgba(40,24,8,0.45)"); c.fillStyle = "#6a3a19"; rr(c, bx, by, bw, bh, 4); c.fill(); noShade(c);
    c.fillStyle = lin(c, bx, by, bx + (horiz ? 0 : bw), by + (horiz ? bh : 0), [[0, "#c27e44"], [1, "#7a4520"]]); rr(c, bx + 0.8, by + 0.8, bw - 1.6, bh - 1.6, 3.4); c.fill();
  }
  c.restore();
}
function napkin(c: C, x: number, y: number) {
  shade(c, 4, 1.2, 2.6, tint(0.45)); c.fillStyle = "#f4ede2"; c.beginPath(); c.moveTo(x - 16, y - 7); c.lineTo(x + 16, y - 7); c.lineTo(x, y + 14); c.closePath(); c.fill(); noShade(c);
  c.fillStyle = lin(c, x, y - 7, x, y + 14, [[0, "#ffffff"], [1, "#e6dccd"]]); c.beginPath(); c.moveTo(x - 16, y - 7); c.lineTo(x + 16, y - 7); c.lineTo(x, y + 14); c.closePath(); c.fill();
  c.fillStyle = "rgba(150,130,105,0.22)"; c.beginPath(); c.moveTo(x - 16, y - 7); c.lineTo(x + 3, y - 7); c.lineTo(x - 1, y + 10); c.closePath(); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 0.7; line(c, x + 3, y - 6.5, x - 0.6, y + 10);
  c.strokeStyle = "#c8463c"; c.lineWidth = 1.3; line(c, x - 12.5, y - 4.6, x + 12.5, y - 4.6);
  c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 0.8; line(c, x - 15, y - 6.4, x + 15, y - 6.4);
}
/** A walnut knife block with five knives in it. */
function knifeBlock(c: C, x: number, y: number, w: number, h: number, rnd: Rnd) {
  const x0 = x - w / 2, y0 = y - h / 2;
  aoBox(c, x0, y0, w, h, 6, 0.55, 10);
  c.save(); rr(c, x0, y0, w, h, 6); c.clip(); planks(c, x0, y0, x0 + w, y0 + h, rnd, ["#7c4524", "#86502b"], "52,22,4", { size: [h + 10, 1], joints: false }); c.restore();
  bevel(c, x0, y0, w, h, 6, 1.1);
  for (let i = 0; i < 5; i++) {
    const kx = x0 + 10 + (i % 3) * 17, ky = y0 + 14 + Math.floor(i / 3) * 28 + (i % 2) * 4;
    c.fillStyle = "#1a1210"; rr(c, kx - 0.5, ky - 3.5, 11, 6, 1.5); c.fill();
    c.fillStyle = lin(c, kx, 0, kx + 10, 0, STEEL); rr(c, kx, ky - 3, 10, 4.4, 1.2); c.fill();
    shade(c, 3, 1, 2, "rgba(0,0,0,0.45)"); c.fillStyle = lin(c, kx, 0, kx + 10, 0, [[0, "#3a2a20"], [0.4, "#6a4d3a"], [1, "#1d140f"]]); rr(c, kx, ky + 2, 10, 20, 4); c.fill(); noShade(c);
    c.fillStyle = "#dfe5eb"; circ(c, kx + 5, ky + 8, 1.1); c.fill(); circ(c, kx + 5, ky + 15, 1.1); c.fill();
    c.strokeStyle = "rgba(255,225,190,0.35)"; c.lineWidth = 0.6; line(c, kx + 2, ky + 4, kx + 2, ky + 20);
  }
}
/** A striped tea towel folded over the edge of the counter. */
function towel(c: C, x: number, y: number) {
  const x0 = x - 30, y0 = y - 20, w = 60, h = 48;
  shade(c, 6, 2, 4, "rgba(30,20,10,0.4)"); c.fillStyle = "#efe7d8"; rr(c, x0, y0, w, h, 4); c.fill(); noShade(c);
  c.fillStyle = lin(c, x0, 0, x0 + w, 0, [[0, "#fbf7ef"], [0.25, "#ece3d2"], [0.5, "#fbf7ef"], [0.75, "#e6dcc8"], [1, "#f6f0e4"]]); rr(c, x0, y0, w, h, 4); c.fill();
  c.fillStyle = "#3f7fd6"; for (const o of [10, 16, 34]) c.fillRect(x0, y0 + o, w, o === 16 ? 2 : 4);
  c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(x0, y0, w, 5);
  c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 0.6; c.setLineDash([1.5, 1.5]); line(c, x0 + 2, y0 + h - 3, x0 + w - 2, y0 + h - 3); c.setLineDash([]);
}
/** The fridge's light, glowing cold white along the top. */
function fridgeLight(c: C, x: number, y: number) {
  c.fillStyle = rad(c, x, y, 4, 190, [[0, "rgba(235,248,255,0.95)"], [0.35, "rgba(220,240,255,0.35)"], [1, "rgba(220,240,255,0)"]]); circ(c, x, y, 190); c.fill();
  c.fillStyle = "rgba(255,255,255,0.9)"; rr(c, x - 34, y - 7, 68, 14, 7); c.fill();
  c.fillStyle = lin(c, 0, y - 5, 0, y + 5, [[0, "#ffffff"], [1, "#d8ecf7"]]); rr(c, x - 31, y - 4.5, 62, 9, 4.5); c.fill();
}
/** A soap dispenser: green glass and a white pump. */
function soap(c: C, x: number, y: number) {
  ao(c, x, y + 2, 12, 0.5);
  drop(c); c.fillStyle = "#2f9a5a"; rr(c, x - 10, y - 14, 20, 30, 7); c.fill(); noShade(c);
  c.fillStyle = lin(c, x - 10, 0, x + 10, 0, [[0, "#7fe0a6"], [0.4, "#3fbf74"], [1, "#1f7a45"]]); rr(c, x - 10, y - 14, 20, 30, 7); c.fill();
  c.fillStyle = "rgba(255,255,255,0.55)"; rr(c, x - 7, y - 11, 3, 22, 1.5); c.fill();
  c.fillStyle = lin(c, x - 5, 0, x + 5, 0, [[0, "#ffffff"], [1, "#c9d0d8"]]); rr(c, x - 5, y - 21, 10, 9, 3); c.fill(); rr(c, x - 2, y - 26, 12, 4, 2); c.fill();
}
/** The faucet, arching over the sink: a chrome gooseneck from its base on the counter. */
function faucet(c: C, x: number, y: number) {
  c.lineCap = "round";
  shade(c, 12, 7, 12, "rgba(10,15,25,0.4)"); c.strokeStyle = "#8d97a2"; c.lineWidth = 11; line(c, x, y - 30, x, y + 52); noShade(c);
  c.strokeStyle = lin(c, x - 6, 0, x + 6, 0, [[0, "#6c7682"], [0.3, "#ffffff"], [0.55, "#c3cbd4"], [1, "#5f6974"]]); c.lineWidth = 10; line(c, x, y - 30, x, y + 52);
  c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 1.2; line(c, x - 2, y - 28, x - 2, y + 50);
  drop(c, 6, 2, 4, 0.45); steelDisc(c, x, y - 34, 13); noShade(c); gloss(c, x - 4, y - 38, 5, 2.6, 0.9);
  c.fillStyle = "#5f6974"; circ(c, x, y + 54, 4.4); c.fill(); c.fillStyle = "#2b2f35"; circ(c, x, y + 54, 2.6); c.fill();
  drop(c, 4, 1.6, 3, 0.45); steelDisc(c, x + 26, y - 34, 6.5); noShade(c);
  c.strokeStyle = lin(c, 0, y - 37, 0, y - 31, [[0, "#ffffff"], [1, "#7d8792"]]); c.lineWidth = 4; line(c, x + 26, y - 34, x + 42, y - 40);
}
/** A broom's head of straw, bound with red. */
function bristles(c: C, x: number, y: number, rot: number) {
  c.save(); c.translate(x, y); c.rotate(rot);
  shade(c, 6, 2, 4, tint(0.5)); c.fillStyle = "#c99a3e"; c.beginPath(); c.moveTo(0, -6); c.lineTo(-34, -20); c.quadraticCurveTo(-40, 0, -38, 20); c.lineTo(0, 6); c.closePath(); c.fill(); noShade(c);
  c.fillStyle = lin(c, 0, -20, 0, 20, [[0, "#f4d68a"], [0.5, "#e3bd62"], [1, "#b88a35"]]); c.beginPath(); c.moveTo(0, -6); c.lineTo(-34, -20); c.quadraticCurveTo(-40, 0, -38, 20); c.lineTo(0, 6); c.closePath(); c.fill();
  c.lineWidth = 0.6; for (let i = -19; i <= 19; i += 1.6) { c.strokeStyle = (i * 7) % 3 < 1 ? "rgba(255,240,190,0.6)" : "rgba(130,90,25,0.5)"; line(c, -2, i * 0.3, -36 - Math.abs(i) * 0.05, i); }
  c.fillStyle = lin(c, 0, -7, 0, 7, [[0, "#ff7a82"], [1, "#b8323c"]]); rr(c, -6, -7.5, 8, 15, 2); c.fill(); c.fillStyle = "rgba(255,255,255,0.4)"; c.fillRect(-5, -6, 6, 1.2);
  c.restore();
}
/** The cooktop's control knobs. */
function knobs(c: C, x: number, y: number) {
  for (let i = 0; i < 4; i++) {
    const kx = x - 120 + i * 80, ky = y - 20;
    drop(c, 5, 2, 4, 0.55); steelDisc(c, kx, ky, 13); noShade(c);
    c.fillStyle = lin(c, kx - 9, ky - 9, kx + 9, ky + 9, [[0, "#ffffff"], [1, "#9aa3ad"]]); circ(c, kx, ky, 9.5); c.fill();
    c.fillStyle = "#2b2f35"; rr(c, kx - 1.8, ky - 11, 3.6, 10, 1.8); c.fill();
    gloss(c, kx - 4, ky - 5, 4, 2, 0.9);
  }
}
/** Where the mixer's beater sweeps: a soft engraved ring in the marble. */
function mixerBowl(c: C, x: number, y: number, R: number) {
  c.fillStyle = rad(c, x, y, R * 0.3, R, [[0, "rgba(255,255,255,0.0)"], [0.85, "rgba(160,150,140,0.08)"], [1, "rgba(160,150,140,0.16)"]]); circ(c, x, y, R); c.fill();
  c.strokeStyle = "rgba(90,80,70,0.25)"; c.lineWidth = 2; circ(c, x, y, R); c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = 1; c.beginPath(); c.arc(x + 0.8, y + 1, R, 0, TAU); c.stroke();
  c.strokeStyle = "rgba(120,110,100,0.3)"; c.setLineDash([5, 6]); c.lineWidth = 1; circ(c, x, y, R - 8); c.stroke(); c.setLineDash([]);
}
/** A bar stool: a tufted leather seat on a steel foot ring. */
function stool(c: C, x: number, y: number) {
  drop(c, 10, 4, 7, 0.45); c.strokeStyle = "#5f6974"; c.lineWidth = 3; circ(c, x, y, 25); c.stroke(); noShade(c);
  c.strokeStyle = lin(c, x - 25, y - 25, x + 25, y + 25, STEEL); c.lineWidth = 2.4; circ(c, x, y, 25); c.stroke();
  drop(c, 6, 2, 4, 0.5); c.fillStyle = "#6e2f1c"; circ(c, x, y, 21); c.fill(); noShade(c);
  c.fillStyle = rad(c, x, y, 1, 21, [[0, "#d27a52"], [0.6, "#a8492c"], [1, "#6e2f1c"]], x - 7, y - 7); circ(c, x, y, 21); c.fill();
  c.strokeStyle = "rgba(255,220,190,0.5)"; c.lineWidth = 0.8; c.setLineDash([1.6, 1.4]); circ(c, x, y, 17.5); c.stroke(); c.setLineDash([]);
  c.fillStyle = "#4e1f10"; circ(c, x, y, 1.8); c.fill(); gloss(c, x - 7, y - 8, 6, 3, 0.55);
}
/** A pot of basil. */
function plant(c: C, x: number, y: number) {
  drop(c, 8, 3, 6, 0.45); c.fillStyle = "#a8502d"; circ(c, x, y, 21); c.fill(); noShade(c);
  c.fillStyle = lin(c, x - 21, y - 21, x + 21, y + 21, [[0, "#e98a5c"], [1, "#9a4524"]]); circ(c, x, y, 21); c.fill();
  c.fillStyle = rad(c, x, y, 2, 17, [[0, "#5a3a22"], [1, "#2e1c10"]]); circ(c, x, y, 17); c.fill();
  for (let i = 0; i < 11; i++) {
    const a = (i * TAU) / 11 + (i % 2) * 0.3, d = i % 2 ? 7 : 12, lx = x + Math.cos(a) * d, ly = y + Math.sin(a) * d;
    shade(c, 2, 0.8, 1.5, "rgba(0,30,0,0.4)"); c.fillStyle = lin(c, lx - 6, ly - 6, lx + 6, ly + 6, [[0, "#8fd16a"], [1, "#3f8f2e"]]); ell(c, lx, ly, 10, 5, a); c.fill(); noShade(c);
    c.strokeStyle = "rgba(30,80,20,0.55)"; c.lineWidth = 0.5; line(c, lx - Math.cos(a) * 8, ly - Math.sin(a) * 8, lx + Math.cos(a) * 8, ly + Math.sin(a) * 8);
  }
}
/** The table above (the ball rolls under it): the shade it casts, soft at the edges, and the faint line of its apron,
 *  so the ball shows through but reads as underneath. */
function tabletop(c: C, x: number, y: number, w: number, h: number) {
  const x0 = x - w / 2, y0 = y - h / 2;
  c.save(); rr(c, x0, y0, w, h, 16); c.clip();
  shade(c, 26, 0, 0, "rgba(25,10,0,0.55)"); c.fillStyle = "#000"; c.beginPath(); c.rect(x0 - 80, y0 - 80, w + 160, h + 160); c.roundRect(x0, y0, w, h, 16); c.fill("evenodd"); noShade(c);
  c.fillStyle = "rgba(25,10,0,0.18)"; c.fillRect(x0, y0, w, h);
  c.restore();
  c.strokeStyle = "rgba(70,32,8,0.45)"; c.lineWidth = 5; rr(c, x0 + 2.5, y0 + 2.5, w - 5, h - 5, 14); c.stroke();
  c.strokeStyle = "rgba(255,215,160,0.35)"; c.lineWidth = 1; rr(c, x0 + 0.5, y0 + 0.5, w - 1, h - 1, 16); c.stroke();
}
/** The sleeping dog: soft fur, floppy ears, a red collar with a gold tag. */
function dog(c: C, x: number, y: number) {
  ao(c, x - 10, y + 2, 56, 0.4);
  c.lineCap = "round"; shade(c, 6, 2, 4, tint(0.4)); c.strokeStyle = "#c98f4f"; c.lineWidth = 10; c.beginPath(); c.moveTo(x - 62, y + 8); c.quadraticCurveTo(x - 86, y + 24, x - 66, y + 36); c.stroke(); noShade(c);
  c.strokeStyle = "rgba(255,225,180,0.5)"; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 64, y + 6); c.quadraticCurveTo(x - 84, y + 21, x - 68, y + 33); c.stroke();
  shade(c, 12, 4, 8, tint(0.4)); c.fillStyle = "#cf974f"; ell(c, x - 20, y + 2, 46, 27, -0.05); c.fill(); noShade(c);
  c.fillStyle = rad(c, x - 30, y - 8, 4, 50, [[0, "#f2c88c"], [0.6, "#dba45d"], [1, "#b67a37"]]); ell(c, x - 20, y + 2, 46, 27, -0.05); c.fill();
  c.fillStyle = "rgba(150,95,40,0.35)"; ell(c, x - 22, y - 12, 34, 9, -0.05); c.fill();
  c.strokeStyle = "rgba(140,85,30,0.35)"; c.lineWidth = 0.8; for (let i = 0; i < 18; i++) { const a = -2.6 + i * 0.3, fx = x - 20 + Math.cos(a) * 40, fy = y + 2 + Math.sin(a) * 22; line(c, fx, fy, fx + Math.cos(a) * 4, fy + Math.sin(a) * 3); }
  for (const o of [-6, 10]) { c.fillStyle = lin(c, x + o - 9, y + 20, x + o + 9, y + 30, [[0, "#e6b878"], [1, "#b07a3c"]]); ell(c, x + o, y + 24, 9.5, 6.5); c.fill(); c.strokeStyle = "rgba(110,60,20,0.5)"; c.lineWidth = 0.6; for (const t of [-3, 0, 3]) line(c, x + o + t, y + 27, x + o + t, y + 29.5); }
  shade(c, 8, 3, 5, tint(0.35)); c.fillStyle = "#d29a55"; circ(c, x + 40, y - 6, 20); c.fill(); noShade(c);
  c.fillStyle = rad(c, x + 34, y - 13, 2, 22, [[0, "#f2c88c"], [1, "#c08540"]]); circ(c, x + 40, y - 6, 20); c.fill();
  c.strokeStyle = "#c8463c"; c.lineWidth = 3.4; c.beginPath(); c.arc(x + 40, y - 6, 19.5, 1.9, 3.2); c.stroke();
  c.fillStyle = rad(c, x + 24, y + 9, 0.5, 3.4, [[0, "#fff1b0"], [1, "#c8901e"]]); circ(c, x + 24, y + 10, 3); c.fill();
  for (const [ex, er] of [[30, -0.6], [52, 0.6]] as [number, number][]) { c.fillStyle = lin(c, x + ex - 8, y - 32, x + ex + 8, y - 10, [[0, "#c88a45"], [1, "#8e5a24"]]); ell(c, x + ex, y - 22, 9, 13.5, er); c.fill(); }
  c.fillStyle = rad(c, x + 46, y + 2, 1, 11, [[0, "#fbe2b6"], [1, "#e0b57c"]]); ell(c, x + 46, y + 4, 10.5, 8.5); c.fill();
  c.fillStyle = "#2a1c14"; ell(c, x + 50.5, y + 1.6, 3.4, 2.6); c.fill(); c.fillStyle = "rgba(255,255,255,0.6)"; circ(c, x + 49.6, y + 0.8, 0.9); c.fill();
  c.strokeStyle = "#3a2a20"; c.lineWidth = 1.5; for (const o of [-8, 6]) { c.beginPath(); c.arc(x + 40 + o, y - 8, 3, 0.25, Math.PI - 0.25); c.stroke(); }
}
/** Scenery that stands round the hole (under the table's shadow): chairs, stools. */
export function drawGroundDeco(c: C, k: Course, mid: Pt) {
  for (const d of k.deco) { if (d.over) continue; if (d.k === "chair") chair(c, d, mid); else if (d.k === "stool") stool(c, d.x, d.y); }
}
/** Scenery lying on the surface, under the rails and cups: coils, the mixer's ring, napkins. */
export function drawSurfaceDeco(c: C, k: Course) {
  for (const d of k.deco) { if (d.over) continue; if (d.k === "coil") coil(c, d.x, d.y, d.r ?? 50); else if (d.k === "mixerbowl") mixerBowl(c, d.x, d.y, d.r ?? 90); else if (d.k === "napkin") napkin(c, d.x, d.y); }
}
/** Scenery on top: appliances, the towel, the light, the soap, the broom's head, the dog. */
export function drawTopDeco(c: C, k: Course, rnd: Rnd) {
  for (const d of k.deco) {
    if (d.over) continue;
    const w = d.w ?? 40, h = d.h ?? 40;
    switch (d.k) {
      case "toaster": toaster(c, d.x, d.y, w, h); break;
      case "knifeblock": knifeBlock(c, d.x, d.y, w, h, rnd); break;
      case "towel": towel(c, d.x, d.y); break;
      case "fridgelight": fridgeLight(c, d.x, d.y); break;
      case "soap": soap(c, d.x, d.y); break;
      case "bristles": bristles(c, d.x, d.y, d.rot ?? 0); break;
      case "knobs": knobs(c, d.x, d.y); break;
      case "plant": plant(c, d.x, d.y); break;
      case "dogbody": c.save(); if (k.mirror) { c.translate(d.x * 2, 0); c.scale(-1, 1); } dog(c, d.x, d.y); c.restore(); break;   // mirrored holes put its head the other way
    }
  }
}
/** Scenery the balls roll under (a faucet, a chair seat, the table above), for the `over` canvas. */
export function drawOverDeco(c: C, d: Deco) {
  if (d.k === "faucet") faucet(c, d.x, d.y);
  else if (d.k === "chairseat") chair(c, d, [-1, -1], 0.55);
  else if (d.k === "tabletop") tabletop(c, d.x, d.y, d.w ?? 200, d.h ?? 200);
}

// ── cups and tees ──
/** The hole itself: deep dark, the far (bottom right) wall catching the light, a lip dark near and bright far. */
function hole(c: C, x: number, y: number, R: number) {
  c.fillStyle = lin(c, x - R, y - R, x + R, y + R, [[0, "#07080b"], [0.55, "#151920"], [1, "#4d5664"]]); circ(c, x, y, R); c.fill();
  c.fillStyle = rad(c, x - R * 0.16, y - R * 0.18, 0, R * 0.86, [[0, "#000000"], [0.72, "#040507"], [1, "rgba(4,5,7,0)"]]); circ(c, x - R * 0.16, y - R * 0.18, R * 0.86); c.fill();
  c.lineWidth = 1.8; c.strokeStyle = lin(c, x - R, y - R, x + R, y + R, [[0, "rgba(0,0,0,0.6)"], [0.5, "rgba(0,0,0,0.15)"], [0.8, "rgba(255,255,255,0.45)"], [1, "rgba(255,255,255,0.85)"]]); circ(c, x, y, R - 0.5); c.stroke();
}
/** A glazed china rim round the hole: lit top left, a crisp edge, an optional coloured band. */
function china(c: C, x: number, y: number, o: number, col: string, band?: string) {
  ao(c, x, y, o, 0.5);
  drop(c); c.fillStyle = darker(col, 0.12); circ(c, x, y, o); c.fill(); noShade(c);
  c.fillStyle = lin(c, x - o, y - o, x + o, y + o, [[0, lighter(col, 0.6)], [0.45, col], [1, darker(col, 0.24)]]); circ(c, x, y, o); c.fill();
  if (band) { c.strokeStyle = band; c.lineWidth = 2.6; circ(c, x, y, CUP_R + (o - CUP_R) * 0.55); c.stroke(); }
  rimArc(c, x, y, o - 1.3, 1.7, 0.95);
  c.fillStyle = lin(c, x - CUP_R - 4, y - CUP_R - 4, x + CUP_R + 4, y + CUP_R + 4, [[0, darker(col, 0.42)], [0.55, darker(col, 0.08)], [1, lighter(col, 0.5)]]); circ(c, x, y, CUP_R + 3.6); c.fill();
  c.strokeStyle = rgba(darker(col, 0.55), 0.55); c.lineWidth = 0.8; circ(c, x, y, o - 0.4); c.stroke();
}
export function drawCup(c: C, k: Course) {
  const [x, y] = k.cup, R = CUP_R;
  switch (k.cupKind) {
    case "ramekin": {   // a white fluted ramekin
      china(c, x, y, R + 8, "#f4f5f7");
      c.lineWidth = 0.8; for (let i = 0; i < 24; i++) { const a = (i * TAU) / 24; c.strokeStyle = i % 2 ? "rgba(140,150,165,0.35)" : "rgba(255,255,255,0.8)"; line(c, x + Math.cos(a) * (R + 4.2), y + Math.sin(a) * (R + 4.2), x + Math.cos(a) * (R + 7.3), y + Math.sin(a) * (R + 7.3)); }
      break;
    }
    case "soup": china(c, x, y, R + 11, "#f2f4f7", "#2a62c4"); break;
    case "cookiejar": china(c, x, y, R + 9, "#f1e3c8", "#a8602e"); break;
    case "mug": {
      drop(c); c.strokeStyle = "#b8323c"; c.lineWidth = 3.6; rr(c, x + R + 3, y - 6, 11, 12, 5); c.stroke(); noShade(c);
      c.strokeStyle = lin(c, x + R, y - 6, x + R + 12, y + 6, [[0, "#ff7a82"], [1, "#a8262f"]]); c.lineWidth = 2.8; rr(c, x + R + 3, y - 6, 11, 12, 5); c.stroke();
      china(c, x, y, R + 6, "#e8505b"); break;
    }
    case "jar": case "mixbowl": {   // glass: a clear thick rim with bright edges
      const o = k.cupKind === "jar" ? R + 6 : R + 12;
      ao(c, x, y, o, 0.35);
      c.fillStyle = rad(c, x, y, R, o, [[0, "rgba(190,225,245,0.7)"], [0.7, "rgba(215,238,250,0.55)"], [1, "rgba(160,205,235,0.75)"]]); circ(c, x, y, o); c.fill();
      c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineWidth = 1.6; circ(c, x, y, o - 0.8); c.stroke();
      c.strokeStyle = "rgba(90,140,180,0.5)"; c.lineWidth = 0.8; circ(c, x, y, o); c.stroke(); circ(c, x, y, R + 2.5); c.stroke();
      if (k.cupKind === "jar") { c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 0.7; for (const f of [0.4, 0.7]) { circ(c, x, y, R + 2.5 + (o - R - 2.5) * f); c.stroke(); } }
      rimArc(c, x, y, o - 2, 2, 0.95, 0.5);
      break;
    }
    case "drain": {   // a steel drain with a strainer across it
      drop(c, 4, 1, 2, 0.4); steelDisc(c, x, y, R + 7); noShade(c);
      c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 0.6; for (const f of [R + 2.6, R + 4.4]) { circ(c, x, y, f); c.stroke(); }
      hole(c, x, y, R);
      c.strokeStyle = lin(c, x - R, y - R, x + R, y + R, STEEL); c.lineWidth = 1.8; for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 4; line(c, x - Math.cos(a) * (R - 1.5), y - Math.sin(a) * (R - 1.5), x + Math.cos(a) * (R - 1.5), y + Math.sin(a) * (R - 1.5)); }
      steelDisc(c, x, y, 3.2);
      return;
    }
    case "dogbowl": {   // a steel bowl on a red rubber ring
      ao(c, x, y, R + 15, 0.5);
      drop(c, 8, 2.6, 5, 0.5); c.fillStyle = "#a8262f"; circ(c, x, y, R + 15); c.fill(); noShade(c);
      c.fillStyle = lin(c, x - R - 15, y - R - 15, x + R + 15, y + R + 15, [[0, "#ff7a82"], [1, "#a8262f"]]); circ(c, x, y, R + 15); c.fill();
      steelDisc(c, x, y, R + 11); c.fillStyle = lin(c, x - R - 6, y - R - 6, x + R + 6, y + R + 6, [[0, "#5f6974"], [0.6, "#c9d0d8"], [1, "#ffffff"]]); circ(c, x, y, R + 6); c.fill();
      rimArc(c, x, y, R + 10, 1.6, 0.9);
      break;
    }
    case "pot": {   // a steel pot with a long black handle
      drop(c, 5, 2, 3, 0.5); c.fillStyle = lin(c, 0, y - 4, 0, y + 4, [[0, "#4a4e56"], [1, "#0f1013"]]); rr(c, x + R + 5, y - 4.5, 42, 9, 4.5); c.fill(); noShade(c);
      c.strokeStyle = "rgba(255,255,255,0.3)"; c.lineWidth = 0.8; line(c, x + R + 9, y - 2.5, x + R + 44, y - 2.5);
      ao(c, x, y, R + 8, 0.5); drop(c); steelDisc(c, x, y, R + 8); noShade(c);
      c.fillStyle = lin(c, x - R - 4, y - R - 4, x + R + 4, y + R + 4, [[0, "#5f6974"], [0.6, "#c9d0d8"], [1, "#ffffff"]]); circ(c, x, y, R + 4); c.fill();
      rimArc(c, x, y, R + 6.6, 1.6, 0.95);
      break;
    }
  }
  hole(c, x, y, R);
}
/** The tee: a cork coaster, or a mat that suits the place, always with a white spot. */
export function drawTee(c: C, k: Course, rnd: Rnd) {
  const [x, y] = k.tee;
  const spot = () => { c.fillStyle = "rgba(40,20,5,0.35)"; circ(c, x + 0.6, y + 1, 4.2); c.fill(); c.fillStyle = "#ffffff"; circ(c, x, y, 3.8); c.fill(); };
  if (k.place === "fridge") {   // a blue silicone mat with a ring pattern
    const r = 18; ao(c, x, y, r, 0.4); drop(c, 5, 1.6, 3, 0.4); c.fillStyle = "#2f6fc4"; circ(c, x, y, r); c.fill(); noShade(c);
    c.fillStyle = rad(c, x, y, 1, r, [[0, "#7fb4f2"], [0.8, "#4a8ee0"], [1, "#2f6fc4"]], x - r * 0.3, y - r * 0.35); circ(c, x, y, r - 0.8); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 1; for (const f of [0.45, 0.7]) { circ(c, x, y, r * f); c.stroke(); }
    rimArc(c, x, y, r - 1, 1.2, 0.7); spot(); return;
  }
  if (k.place === "sink") {   // a grey rubber sink mat, dimpled
    const w = 44, h = 34; aoBox(c, x - w / 2, y - h / 2, w, h, 7, 0.45, 6);
    c.fillStyle = lin(c, x - w / 2, y - h / 2, x + w / 2, y + h / 2, [[0, "#9aa7b4"], [1, "#5f6c79"]]); rr(c, x - w / 2, y - h / 2, w, h, 7); c.fill();
    for (let yy = y - h / 2 + 5; yy < y + h / 2 - 3; yy += 4.5) for (let xx = x - w / 2 + 5; xx < x + w / 2 - 3; xx += 4.5) { c.fillStyle = "rgba(30,40,50,0.35)"; circ(c, xx + 0.4, yy + 0.5, 1.2); c.fill(); c.fillStyle = "rgba(255,255,255,0.35)"; circ(c, xx - 0.3, yy - 0.3, 0.8); c.fill(); }
    bevel(c, x - w / 2, y - h / 2, w, h, 7, 0.9); spot(); return;
  }
  if (k.place === "floor") {   // a round woven jute mat
    const r = 19; ao(c, x, y, r, 0.45); drop(c, 5, 1.6, 3, 0.4); c.fillStyle = "#9a7a48"; circ(c, x, y, r); c.fill(); noShade(c);
    for (let i = 0; i < 6; i++) { c.strokeStyle = i % 2 ? "#c9a46a" : "#b38d55"; c.lineWidth = 3.2; circ(c, x, y, r - 1.8 - i * 2.9); c.stroke(); }
    c.strokeStyle = "rgba(90,65,30,0.35)"; c.lineWidth = 0.5; for (let i = 0; i < 36; i++) { const a = (i * TAU) / 36; line(c, x + Math.cos(a) * 5, y + Math.sin(a) * 5, x + Math.cos(a) * (r - 0.5), y + Math.sin(a) * (r - 0.5)); }
    c.fillStyle = rad(c, x, y, 2, r, [[0, "rgba(255,240,210,0.15)"], [1, "rgba(60,40,10,0.2)"]], x - r * 0.4, y - r * 0.4); circ(c, x, y, r); c.fill();
    spot(); return;
  }
  const r = 17;   // a cork coaster
  ao(c, x, y, r, 0.45);
  drop(c, 5, 1.6, 3.2, 0.45); c.fillStyle = "#a8743d"; circ(c, x, y, r); c.fill(); noShade(c);
  c.fillStyle = rad(c, x, y, 1, r, [[0, "#e0b277"], [0.8, "#c8955a"], [1, "#a8743d"]], x - r * 0.3, y - r * 0.35); circ(c, x, y, r - 1); c.fill();
  for (let i = 0; i < 170; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * (r - 2.5); c.fillStyle = rnd() < 0.55 ? `rgba(95,52,16,${0.25 + rnd() * 0.3})` : `rgba(255,232,195,${0.25 + rnd() * 0.3})`; c.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.7 + rnd() * 0.7, 0.7 + rnd() * 0.5); }
  c.strokeStyle = "rgba(110,62,22,0.65)"; c.lineWidth = 1.1; circ(c, x, y, r - 1.6); c.stroke();
  rimArc(c, x, y, r - 0.9, 1, 0.75); spot();
}
/** The paper towel tube: a cardboard tube with its spiral seam, open at both ends. */
export function drawTube(c: C, t: Course["tubes"][number]) {
  const dx = t.bx - t.ax, dy = t.by - t.ay, len = Math.hypot(dx, dy), a = Math.atan2(dy, dx), r = t.r;
  c.save(); c.translate(t.ax, t.ay); c.rotate(a);
  shade(c, 10, 3, 7, tint(0.5)); c.fillStyle = "#b8844c"; rr(c, 0, -r, len, r * 2, 4); c.fill(); noShade(c);
  c.fillStyle = lin(c, 0, -r, 0, r, [[0, "#9b6d3a"], [0.22, "#f0cf9e"], [0.45, "#d8aa6c"], [1, "#8a5f30"]]); rr(c, 0, -r, len, r * 2, 4); c.fill();
  c.save(); rr(c, 0, -r, len, r * 2, 4); c.clip();
  c.strokeStyle = "rgba(110,72,30,0.45)"; c.lineWidth = 1.1; for (let s = -16; s < len; s += 20) line(c, s, -r, s + 16, r);
  c.strokeStyle = "rgba(255,240,215,0.35)"; c.lineWidth = 0.6; for (let s = -15; s < len; s += 20) line(c, s, -r, s + 16, r);
  c.restore();
  c.strokeStyle = "rgba(255,245,225,0.6)"; c.lineWidth = 1; line(c, 3, -r * 0.6, len - 3, -r * 0.6);
  for (const e of [0, len]) {
    c.fillStyle = "#8a5f30"; ell(c, e, 0, 5.5, r); c.fill();
    c.fillStyle = rad(c, e, 0, 0.5, r, [[0, "#140c05"], [1, "#4a2f14"]]); ell(c, e, 0, 4.2, r - 2.2); c.fill();
  }
  c.restore();
}
