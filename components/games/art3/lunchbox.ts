// Pea Tanks' lunchboxes. Chunky plastic boxes on rubber treads with a striped straw on a domed cap, lit from the top
// left whichever way they face. Cheap to draw every frame: the shadow and treads, and the box itself, are painted once
// for each of 24 headings (light and shadow baked in for that heading) and turned the last few degrees when drawn;
// the tread links are a strip slid along each tread; the straw and cap are small sprites of their own.
import { TANK_R } from "../tankSim";
import { type C, TAU, rr, circ, ell, lin, rad, mix, rgba, scaleOf } from "../art2/paint";
import { soft, sprite, stamp, type Sprite } from "./kit";

export type Look = { body: string; pattern: "plain" | "crumbs" | "sauce" | "seeds" | "speckles" | "kernels" | "sesame" | "salt" | "shell"; straw: number; strawW: number; twin: boolean; stripe: string };
export type TankOpts = { treadL: number; treadR: number; flash: number; shield: boolean; hard: boolean; ghost: number; alpha: number; frozen: boolean };

// the lunchbox, in its own frame (x forward, y to its right), in board units: about 15% wider than TANK_R, treads out
const TL = 14.9, T0 = 7.7, T1 = 14.2, TR = 3.2;   // tread half length, inner and outer edge, corner
const BX = 12.5, BY = 10.5, BR = 5;               // the box
const LID = { x: -0.55, y: -0.7 }, FOOT = { x: 0.55, y: 0.7 };   // the lid sits up and left of the box's foot (its side shows)
const TTOP = { x: -0.25, y: -0.3 }, TFOOT = { x: 0.35, y: 0.45 };
const PITCH = 3.3, LINK0 = TL - 2.6;              // tread links, over the straight run
const NB = 24, STEP = TAU / NB;

const treadPath = (c: C, ox: number, oy: number, inset = 0) => {
  for (const s of [-1, 1]) c.roundRect(-TL + inset + ox, (s < 0 ? -T1 : T0) + inset + oy, 2 * (TL - inset), T1 - T0 - 2 * inset, TR - inset);
};
/** Fill a path built in the body frame with a gradient laid out on screen (light from the top left), for heading `a`. */
function screenFill(c: C, a: number, R: number, stops: [number, string][]) {
  c.save(); c.rotate(-a); c.fillStyle = lin(c, -R * 0.7, -R * 0.7, R * 0.7, R * 0.7, stops); c.fill(); c.restore();
}
function screenStroke(c: C, a: number, R: number, stops: [number, string][], w: number) {
  c.save(); c.rotate(-a); c.strokeStyle = lin(c, -R * 0.7, -R * 0.7, R * 0.7, R * 0.7, stops); c.lineWidth = w; c.stroke(); c.restore();
}

/** The soft shadow and the two treads (their rubber, not the links), for heading `a`. */
function basePaint(c: C, a: number) {
  const hull = (ox = 0, oy = 0) => { c.save(); c.rotate(a); c.beginPath(); treadPath(c, ox, oy); c.roundRect(-BX, -BY, 2 * BX, 2 * BY, BR); c.restore(); };
  soft(c, 5, "rgba(40,26,12,0.4)", () => { hull(); c.fill(); }, 3.4, 4.8);
  soft(c, 1.8, "rgba(34,22,10,0.45)", () => { hull(); c.fill(); }, 1.2, 1.6);
  const at = (p: { x: number; y: number }, f: () => void) => { c.save(); c.translate(p.x, p.y); c.rotate(a); f(); c.restore(); };
  at(TFOOT, () => { c.beginPath(); treadPath(c, 0, 0); c.fillStyle = "#17161a"; c.fill(); });
  at({ x: (TTOP.x + TFOOT.x) / 2, y: (TTOP.y + TFOOT.y) / 2 }, () => { c.beginPath(); treadPath(c, 0, 0); c.fillStyle = "#1f1e23"; c.fill(); });
  at(TTOP, () => {
    c.beginPath(); treadPath(c, 0, 0); c.fillStyle = "#38363d"; c.fill();
    screenFill(c, a, 20, [[0, "rgba(255,255,255,0.16)"], [0.5, "rgba(255,255,255,0)"], [1, "rgba(0,0,0,0.25)"]]);
    for (const s of [-1, 1]) {   // the ends wrap round the wheels: a couple of curved links each end
      const y0 = s < 0 ? -T1 : T0, ym = (y0 + y0 + T1 - T0) / 2;
      c.strokeStyle = "rgba(255,255,255,0.12)"; c.lineWidth = 0.7;
      for (const e of [-1, 1]) { c.beginPath(); c.arc(e * (TL - TR), ym, TR - 0.9, e > 0 ? -1.1 : Math.PI - 1.1, e > 0 ? 1.1 : Math.PI + 1.1); c.stroke(); }
      c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(-LINK0, ym - 0.25, 2 * LINK0, 0.5);
    }
    c.beginPath(); treadPath(c, 0, 0, 0.35); screenStroke(c, a, 20, [[0, "rgba(255,255,255,0.3)"], [0.45, "rgba(255,255,255,0.04)"], [0.55, "rgba(0,0,0,0.05)"], [1, "rgba(0,0,0,0.4)"]], 0.7);
  });
}
/** A strip of tread links (raised rubber pads), slid along the tread each frame. */
const linkStrip = (k: number) => sprite("tlinks", k, 2 * LINK0 + PITCH, T1 - T0 - 1.4, 0, 0, c => {
  const h = T1 - T0 - 1.4;
  for (let x = 0; x < 2 * LINK0 + PITCH; x += PITCH) {
    c.fillStyle = "#4a4850"; rr(c, x + 0.45, 0.2, PITCH - 0.9, h - 0.4, 0.7); c.fill();
    c.fillStyle = "rgba(255,255,255,0.16)"; c.fillRect(x + 0.9, 0.5, PITCH - 1.8, h - 1);
    c.fillStyle = "rgba(255,255,255,0.22)"; c.fillRect(x + PITCH / 2 - 0.25, 0.6, 0.5, h - 1.2);
    c.fillStyle = "rgba(0,0,0,0.3)"; c.fillRect(x + PITCH - 0.45, 0, 0.9, h);
  }
});

// patterns on the lid, one per kind, in the box's frame
function pattern(c: C, look: Look) {
  const p = look.pattern;
  const dots = (pts: number[][], col: string, r: number, hi = "") => { for (const [x, y] of pts) { c.fillStyle = col; circ(c, x, y, r); c.fill(); if (hi) { c.fillStyle = hi; circ(c, x - r * 0.3, y - r * 0.3, r * 0.4); c.fill(); } } };
  if (p === "plain") {   // the players: a bold stripe down the lid and a little star sticker
    c.fillStyle = "rgba(255,255,255,0.9)"; rr(c, -9.5, -1.5, 13, 3, 1.5); c.fill();
    c.fillStyle = "rgba(255,255,255,0.4)"; rr(c, -9.5, -4.8, 8, 1.6, 0.8); c.fill(); rr(c, -9.5, 3.2, 8, 1.6, 0.8); c.fill();
    return;
  }
  if (p === "crumbs") { for (const [x, y, s] of [[-7, -4.6, 1.5], [-2, 4.4, 1.2], [4.5, -4.2, 1.4], [6.5, 4.6, 1.1], [-8, 3.4, 1], [1, -0.4, 0.9]]) { c.fillStyle = "rgba(150,96,34,0.75)"; c.beginPath(); c.moveTo(x - s, y - s * 0.4); c.lineTo(x + s * 0.2, y - s); c.lineTo(x + s, y + s * 0.3); c.lineTo(x - s * 0.3, y + s * 0.9); c.closePath(); c.fill(); c.fillStyle = "rgba(255,236,190,0.6)"; circ(c, x - s * 0.3, y - s * 0.3, s * 0.35); c.fill(); } }
  else if (p === "sauce") { c.fillStyle = "rgba(150,30,20,0.6)"; c.beginPath(); c.ellipse(-3, -1.5, 6.4, 3.8, 0.4, 0, TAU); c.fill(); c.fillStyle = "rgba(255,170,150,0.35)"; ell(c, -4.6, -3, 2.4, 0.9, 0.4); c.fill(); dots([[5.4, 4.2], [-8, 5], [6, -4.4]], "rgba(70,140,60,0.9)", 1.2); }
  else if (p === "seeds") { for (const [x, y, r] of [[-6.5, -4.2, 0.4], [-2, 3.6, 1], [3.4, -3.4, 2], [6.4, 4.2, 0.6], [-7.6, 4, 2.4], [1, 0, 1.4]]) { c.fillStyle = "rgba(255,236,176,0.95)"; ell(c, x, y, 1.3, 0.8, r); c.fill(); } }
  else if (p === "speckles") { const cols = ["#ffffff", "#ffd84d", "#ff9fb4", "#9fd0ff"]; [[-7, -4.4, 0.3], [-3, 3.4, 1.2], [2.4, -5, 2.2], [6.4, 3.2, 0.8], [-8.4, 5, 1.8], [4.4, 0, 2.8], [0, 5.4, 0.5], [-4, -1, 2]].forEach(([x, y, r], i) => { c.save(); c.translate(x, y); c.rotate(r); c.fillStyle = cols[i % 4]; rr(c, -1.3, -0.45, 2.6, 0.9, 0.45); c.fill(); c.restore(); }); }
  else if (p === "kernels") { for (const [x, y] of [[-6, -3.4], [-1, 3.4], [4.4, -3.4], [6.4, 4.2], [-7.2, 4.2]]) { dots([[x - 0.9, y], [x + 0.9, y - 0.5], [x + 0.2, y + 0.9]], "rgba(255,253,240,0.98)", 1.25); c.fillStyle = "rgba(220,170,60,0.55)"; circ(c, x + 0.3, y + 0.2, 0.5); c.fill(); } }
  else if (p === "sesame") { c.strokeStyle = "rgba(120,70,25,0.55)"; c.lineWidth = 2.2; circ(c, -1, 0, 5.2); c.stroke(); c.strokeStyle = "rgba(255,230,190,0.35)"; c.lineWidth = 0.7; c.beginPath(); c.arc(-1, 0, 6, Math.PI * 1.05, Math.PI * 1.5); c.stroke(); for (const [x, y, r] of [[-8.4, -5, 0.6], [6.4, -5, 2], [-8.4, 5, 2.6], [6.4, 5, 1]]) { c.fillStyle = "rgba(255,246,214,0.98)"; ell(c, x, y, 1.2, 0.65, r); c.fill(); } }
  else if (p === "salt") { for (const [x, y, r] of [[-7, -4, 0.3], [-2, 4, 0.9], [3, -4, 0.5], [7, 3, 1.2], [-5, 1, 0.1], [1, -1, 0.7], [-8.4, 4.6, 0.4]]) { c.save(); c.translate(x, y); c.rotate(r); c.fillStyle = "rgba(255,255,255,0.97)"; c.fillRect(-0.9, -0.9, 1.8, 1.8); c.fillStyle = "rgba(190,200,215,0.7)"; c.fillRect(-0.1, -0.1, 1, 1); c.restore(); } }
  else if (p === "shell") { c.strokeStyle = "rgba(60,40,25,0.5)"; c.lineWidth = 0.8; for (let q = -9; q <= 9; q += 2.6) { c.beginPath(); c.moveTo(q, -7.4); c.quadraticCurveTo(q + 1.6, 0, q + 0.6, 7.4); c.stroke(); } }
}
/** The box: its side, the lid with a seam and a raised panel, the kind's pattern, latch and hinge, all lit for heading `a`. */
function bodyPaint(c: C, a: number, look: Look, hard: boolean) {
  const body = look.body, side = mix(body, "#000000", 0.42), rim = mix(body, "#000000", 0.2);
  const at = (p: { x: number; y: number }, f: () => void) => { c.save(); c.translate(p.x, p.y); c.rotate(a); f(); c.restore(); };
  for (let t = 1; t >= 0; t -= 0.25) {   // the side of the box, swept from its foot up to the lid
    at({ x: LID.x + (FOOT.x - LID.x) * t, y: LID.y + (FOOT.y - LID.y) * t }, () => { rr(c, -BX, -BY, 2 * BX, 2 * BY, BR); c.fillStyle = t > 0.9 ? mix(side, "#000000", 0.2) : side; c.fill(); });
  }
  at(LID, () => {
    rr(c, -BX, -BY, 2 * BX, 2 * BY, BR); c.fillStyle = rim; c.fill();
    screenFill(c, a, 17, [[0, "rgba(255,255,255,0.3)"], [0.5, "rgba(255,255,255,0.02)"], [1, "rgba(0,0,0,0.2)"]]);
    rr(c, -BX + 0.4, -BY + 0.4, 2 * BX - 0.8, 2 * BY - 0.8, BR - 0.4); screenStroke(c, a, 17, [[0, "rgba(255,255,255,0.7)"], [0.4, "rgba(255,255,255,0.08)"], [0.6, "rgba(0,0,0,0.06)"], [1, "rgba(0,0,0,0.35)"]], 0.8);
    // the lid proper, a step in from the rim: a soft dome
    const lx = BX - 2, ly = BY - 2;
    rr(c, -lx - 0.3, -ly - 0.3, 2 * lx + 0.6, 2 * ly + 0.6, BR - 1.6); c.fillStyle = mix(body, "#000000", 0.32); c.fill();
    rr(c, -lx, -ly, 2 * lx, 2 * ly, BR - 1.8); c.fillStyle = body; c.fill();
    c.save(); c.clip();
    c.save(); c.rotate(-a); c.fillStyle = rad(c, -4, -4.5, 1, 17, [[0, mix(body, "#ffffff", 0.36)], [0.45, mix(body, "#ffffff", 0.08)], [1, mix(body, "#000000", 0.18)]]); c.fillRect(-18, -18, 36, 36); c.restore();
    pattern(c, look);
    c.restore();
    rr(c, -lx + 0.3, -ly + 0.3, 2 * lx - 0.6, 2 * ly - 0.6, BR - 2); screenStroke(c, a, 15, [[0, "rgba(255,255,255,0.75)"], [0.35, "rgba(255,255,255,0.1)"], [0.6, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.22)"]], 0.6);
    // hinge at the back, a latch clip at the front
    c.fillStyle = mix(body, "#000000", 0.45); rr(c, -BX - 0.2, -6.4, 1.8, 3.6, 0.8); c.fill(); rr(c, -BX - 0.2, 2.8, 1.8, 3.6, 0.8); c.fill();
    c.fillStyle = rgba(mix(body, "#ffffff", 0.5), 0.5); c.fillRect(-BX + 0.2, -6, 0.5, 2.8); c.fillRect(-BX + 0.2, 3.2, 0.5, 2.8);
    c.fillStyle = "rgba(20,24,34,0.32)"; rr(c, BX - 2.4, -2.6, 3.8, 6, 1.2); c.fill();
    c.fillStyle = "#f7f8fa"; rr(c, BX - 2.8, -3, 3.6, 6, 1.2); c.fill();
    c.fillStyle = "rgba(150,160,176,0.7)"; c.fillRect(BX - 2.2, -0.35, 2.6, 0.7);
    c.fillStyle = "rgba(255,255,255,1)"; c.fillRect(BX - 2.5, -2.6, 0.5, 5.2);
    if (hard) {   // the coconut's shell, still on: hairy brown fibre round the box
      rr(c, -BX - 0.6, -BY - 0.6, 2 * BX + 1.2, 2 * BY + 1.2, BR + 0.6); c.strokeStyle = "rgba(92,60,32,0.98)"; c.lineWidth = 2.6; c.stroke();
      c.strokeStyle = "rgba(205,165,115,0.6)"; c.lineWidth = 0.5;
      for (let q = -BX + 1; q <= BX - 1; q += 2.2) { c.beginPath(); c.moveTo(q, -BY - 1.6); c.lineTo(q + 1.1, -BY + 0.2); c.moveTo(q, BY - 0.2); c.lineTo(q + 1.1, BY + 1.6); c.stroke(); }
      for (let q = -BY + 3; q <= BY - 3; q += 2.2) { c.beginPath(); c.moveTo(-BX - 1.6, q); c.lineTo(-BX + 0.2, q + 1.1); c.moveTo(BX - 0.2, q); c.lineTo(BX + 1.6, q + 1.1); c.stroke(); }
    }
  });
  // a gloss that stays up and left of the box, on screen
  c.save(); c.translate(LID.x, LID.y); c.rotate(a); rr(c, -BX + 2, -BY + 2, 2 * BX - 4, 2 * BY - 4, BR - 1.8); c.clip(); c.rotate(-a);
  c.fillStyle = rad(c, -5.2, -5, 0, 7.5, [[0, "rgba(255,255,255,0.5)"], [0.5, "rgba(255,255,255,0.14)"], [1, "rgba(255,255,255,0)"]]); ell(c, -5.2, -5, 7.5, 3, -0.62); c.fill();
  c.restore();
}
const lookKey = (l: Look, hard: boolean) => `${l.body}${l.pattern}${hard ? "h" : ""}`;
const baseSprite = (k: number, b: number) => sprite(`tbase${b}`, k, 56, 56, 23, 23, c => basePaint(c, b * STEP));
const bodySprite = (k: number, b: number, look: Look, hard: boolean) => sprite(`tbody${b}${lookKey(look, hard)}`, k, 40, 40, 20, 20, c => bodyPaint(c, b * STEP, look, hard));
/** The straw, lying along +x from the cap, lit from -y; flipped when the light is on its other side. */
function strawSprite(k: number, look: Look) {
  const SL = look.straw * 1.1 + 4.5, SW = look.strawW * 1.08;
  return sprite(`straw${look.stripe}${SL}${SW}`, k, SL + 4, SW + 2, 1, SW / 2 + 1, c => {
    rr(c, 1.5, -SW / 2, SL, SW, SW / 2); c.fillStyle = "#ffffff"; c.fill();
    c.save(); c.clip();
    c.fillStyle = look.stripe; for (let q = 5; q < SL + 2; q += 4.6) { c.beginPath(); c.moveTo(q, -SW / 2); c.lineTo(q + 2.1, -SW / 2); c.lineTo(q + 1.5, SW / 2); c.lineTo(q - 0.6, SW / 2); c.closePath(); c.fill(); }
    c.fillStyle = lin(c, 0, -SW / 2, 0, SW / 2, [[0, "rgba(255,255,255,0.7)"], [0.3, "rgba(255,255,255,0.15)"], [0.6, "rgba(0,0,0,0)"], [1, "rgba(20,24,40,0.3)"]]); c.fillRect(0, -SW, SL + 4, SW * 2);
    c.strokeStyle = "rgba(20,24,40,0.18)"; c.lineWidth = 0.4; for (const q of [3.4, 4.4, 5.4]) { c.beginPath(); c.moveTo(q, -SW / 2); c.lineTo(q, SW / 2); c.stroke(); }   // the bendy bit
    c.restore();
    c.fillStyle = "rgba(255,255,255,0.9)"; rr(c, 4, -SW / 2 + 0.6, SL - 4, Math.max(0.6, SW * 0.16), 0.4); c.fill();
    c.fillStyle = "rgba(40,30,30,0.45)"; ell(c, SL + 0.9, 0, 0.85, SW * 0.34); c.fill();
    c.strokeStyle = "rgba(30,34,50,0.3)"; c.lineWidth = 0.5; rr(c, 1.5, -SW / 2, SL, SW, SW / 2); c.stroke();
  });
}
function strawShadow(k: number, look: Look) {
  const SL = look.straw * 1.1 + 4.5, SW = look.strawW * 1.08;
  return sprite(`strawsh${SL}${SW}`, k, SL + 10, SW + 8, 4, SW / 2 + 4, c => { soft(c, 1.6, "rgba(30,20,10,0.36)", () => { rr(c, 2.5, -SW / 2, SL - 1, SW, SW / 2); c.fill(); }); });
}
const capSprite = (k: number, body: string) => sprite(`cap${body}`, k, 20, 20, 9, 9, c => {
  soft(c, 1.8, "rgba(30,20,10,0.42)", () => { circ(c, 0, 0, 6.4); c.fill(); }, 1.3, 1.8);
  c.fillStyle = mix(body, "#000000", 0.4); circ(c, 0.3, 0.4, 6.6); c.fill();
  c.fillStyle = rad(c, 0, 0, 0.5, 6.4, [[0, mix(body, "#ffffff", 0.6)], [0.5, body], [1, mix(body, "#000000", 0.32)]], -2.2, -2.3); circ(c, 0, 0, 6.3); c.fill();
  c.strokeStyle = rgba(mix(body, "#000000", 0.45), 0.8); c.lineWidth = 0.6; circ(c, 0, 0, 6.2); c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 0.5; circ(c, 0, 0, 4.3); c.stroke();
  c.fillStyle = "rgba(255,255,255,0.9)"; ell(c, -2.3, -2.5, 1.9, 1, -0.7); c.fill();
});
const flashSprite = (k: number) => sprite("tflash", k, 40, 40, 20, 20, c => { c.fillStyle = rad(c, 0, 0, 2, 19, [[0, "rgba(255,255,255,1)"], [0.55, "rgba(255,255,255,0.6)"], [1, "rgba(255,255,255,0)"]]); circ(c, 0, 0, 19); c.fill(); });
const SHIELD_R = TANK_R + 8;
const shieldSprite = (k: number) => sprite("tshield", k, (SHIELD_R + 6) * 2, (SHIELD_R + 6) * 2, SHIELD_R + 6, SHIELD_R + 6, c => {   // a ring of lettuce leaves
  const R = SHIELD_R;
  c.fillStyle = "rgba(140,210,110,0.14)"; circ(c, 0, 0, R); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, R + 1.8, Math.PI * 1.05, Math.PI * 1.5); c.stroke();
  c.strokeStyle = "rgba(84,164,64,0.75)"; c.lineWidth = 2.2; circ(c, 0, 0, R); c.stroke();
  for (let q = 0; q < 8; q++) {
    const an = (q / 8) * TAU + 0.2, x = Math.cos(an) * R, y = Math.sin(an) * R;
    c.save(); c.translate(x, y); c.rotate(an + Math.PI / 2);
    c.fillStyle = "rgba(30,60,20,0.25)"; ell(c, 0.6, 0.9, 4.6, 2.6); c.fill();
    c.fillStyle = "#57a842"; ell(c, 0, 0, 4.6, 2.6); c.fill();
    c.fillStyle = "#93d46e"; ell(c, -0.4, -0.6, 3.2, 1.3); c.fill();
    c.strokeStyle = "rgba(235,255,215,0.7)"; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-3.6, 0); c.lineTo(3.6, 0); c.stroke();
    c.restore();
  }
});

/** A lunchbox from above: shadow, rubber treads (the links roll as it moves), the plastic box with lid, hinge and latch,
 *  and a striped straw on a cap. Lit from the top left whichever way it faces. */
export function drawLunchbox(g: C, x: number, y: number, a: number, ta: number, look: Look, o: TankOpts) {
  const k = scaleOf(g), m = g.getTransform(), alpha0 = g.globalAlpha;
  const an = ((a % TAU) + TAU) % TAU, b = Math.round(an / STEP) % NB, res = an - b * STEP;
  g.globalAlpha = o.alpha;
  const turned = (s: Sprite, px = 0, py = 0) => { g.translate(x + px, y + py); g.rotate(res); stamp(g, s); g.setTransform(m); };
  turned(baseSprite(k, b));
  const L = linkStrip(k), h = T1 - T0 - 1.4;   // the links on each tread, rolling with the tread's distance
  g.translate(x + TTOP.x, y + TTOP.y); g.rotate(a);
  for (const [s, off] of [[-1, o.treadL], [1, o.treadR]]) {
    const ph = ((off % PITCH) + PITCH) % PITCH, sx = Math.max(0, Math.min((PITCH - ph) * k, L.cv.width - 2 * LINK0 * k));   // kept inside the strip: Safari skips a draw that reads past an image
    g.drawImage(L.cv, sx, 0, 2 * LINK0 * k, L.cv.height, -LINK0, (s < 0 ? -T1 : T0) + 0.7, 2 * LINK0, h);
  }
  g.setTransform(m);
  turned(bodySprite(k, b, o.frozen ? { ...look, body: "#bfe3f5" } : look, o.hard));
  // the straw (or two), its shadow first; flipped so its shine is always on the side toward the light
  const st = strawSprite(k, look), sh = strawShadow(k, look), flip = Math.sin(ta) - Math.cos(ta) > 0, cx = x + LID.x, cy = y + LID.y;
  for (const dy of look.twin ? [-3, 3] : [0]) {
    g.translate(cx + 2.2, cy + 3); g.rotate(ta); g.translate(0, dy); stamp(g, sh); g.setTransform(m);
  }
  for (const dy of look.twin ? [-3, 3] : [0]) {
    g.translate(cx, cy); g.rotate(ta); g.translate(0, dy); if (flip) g.scale(1, -1); stamp(g, st); g.setTransform(m);
  }
  stamp(g, capSprite(k, o.frozen ? "#bfe3f5" : look.body), cx, cy);
  if (o.flash > 0) { g.globalAlpha = o.flash * 0.6 * o.alpha; stamp(g, flashSprite(k), x, y); g.globalAlpha = o.alpha; }
  if (o.shield) stamp(g, shieldSprite(k), x, y);
  g.globalAlpha = alpha0;
}
/** Tread marks left on the cloth: two pressed patches per mark, under the treads. */
export function treadMarks(g: C, marks: { x: number; y: number; a: number; age: number }[]) {
  const m = g.getTransform(), y0 = T0 + 0.8, w = T1 - T0 - 1.6;
  g.fillStyle = "rgba(60,64,84,1)";
  for (const mk of marks) {
    const al = 0.075 * (1 - mk.age / 4000); if (al <= 0) continue;
    g.globalAlpha = al; g.translate(mk.x, mk.y); g.rotate(mk.a);
    g.fillRect(-2.2, -y0 - w, 1.6, w); g.fillRect(0.6, -y0 - w, 1.6, w); g.fillRect(-2.2, y0, 1.6, w); g.fillRect(0.6, y0, 1.6, w);
    g.setTransform(m);
  }
  g.globalAlpha = 1;
}
