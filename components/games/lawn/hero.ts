// The title screen's picture (and the link preview): the farmhouse turned to face us like the street view, a big
// tree and the gravel driveway, fresh stripes on the lawn, and Pat on the orange tractor up close with the grey cat
// sitting right in his way. Drawn with the game's own drawings, a little closer and a little more 3/4.
import { LAWN_MAP, toMetres, type Building, type Pt, type Tree } from "../lawnMap";
import { drawBuilding, buildingShadow, drawTree, drawMower, drawCat, type Paint } from "./art";
import { mulberry32 } from "./geo";

const OBL_HERO = 0.36;
type Part = { x: number; y: number; vx: number; vy: number; life: number; c: string; s: number };
export type HeroLayout = { W: number; H: number; top: number; bottom: number; og?: boolean };

/** The house and its porch from the map, turned half round about the house (porch toward us) and centred on 0,0. */
export function heroBuildings() {
  const m = toMetres(LAWN_MAP), house = m.buildings.find(b => b.kind === "house")!, porch = m.buildings.find(b => b.kind === "porch")!;
  const xs = house.poly.map(p => p[0]), ys = [...house.poly, ...porch.poly].map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const R = (p: Pt): Pt => [cx - p[0], cy - p[1]], RL = (ps: Pt[]) => ps.map(R);
  // just the main two-storey block (the back ell would hide behind it anyway)
  const main = house.wings!.reduce((a, w) => (Math.abs(w[0][0] - w[1][0]) * Math.abs(w[1][1] - w[2][1]) > Math.abs(a[0][0] - a[1][0]) * Math.abs(a[1][1] - a[2][1]) ? w : a));
  const h: Building = { ...house, poly: RL(main), wings: [RL(main)], frontGable: house.frontGable && RL(house.frontGable), chimney: house.chimney && R(house.chimney) };
  // a shallower porch roof than the map's (seen from the front it would hide the house)
  const pp = RL(porch.poly), px0 = Math.min(...pp.map(q => q[0])), px1 = Math.max(...pp.map(q => q[0])), py0 = Math.min(...pp.map(q => q[1]));
  const p: Building = { ...porch, poly: [[px0, py0], [px1, py0], [px1, py0 + 1.75], [px0, py0 + 1.75]] };
  const barn = m.buildings.find(b => b.kind === "barn")!, lean = m.buildings.find(b => b.kind === "other")!;
  const bx = barn.poly.reduce((a, q) => a + q[0], 0) / 4, by = barn.poly.reduce((a, q) => a + q[1], 0) / 4;
  const T = (ps: Pt[]) => ps.map(q => [q[0] - bx, q[1] - by] as Pt);
  return { house: h, porch: p, barn: { ...barn, poly: T(barn.poly) } as Building, lean: { ...lean, poly: T(lean.poly) } as Building };
}

/** A tile of mown grass texture (soft speckle and short blades), repeated over the lawn. */
function grassTile() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 160;
  const c = cv.getContext("2d")!, rnd = mulberry32(5);
  for (let k = 0; k < 900; k++) { c.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.07)" : "rgba(0,40,0,0.08)"; c.fillRect(rnd() * 160, rnd() * 160, 1.5, 1.5); }
  c.lineCap = "round"; c.lineWidth = 1.2;
  for (let k = 0; k < 140; k++) { const x = rnd() * 160, y = rnd() * 160; c.strokeStyle = rnd() < 0.5 ? "rgba(30,80,20,0.18)" : "rgba(220,255,180,0.14)"; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 3, y - 4 - rnd() * 3); c.stroke(); }
  return cv;
}

export function makeHero() {
  const B = heroBuildings(), tile = grassTile();
  let pat: CanvasPattern | null = null;
  const parts: Part[] = [], rnd = mulberry32(9);
  const trees: { t: Tree; blobs: number[][] }[] = [];
  const blobsFor = (seed: number) => { const r = mulberry32(seed), out: number[][] = []; for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + r(), d = 0.45 + r() * 0.2; out.push([Math.cos(a) * d, Math.sin(a) * d, 0.42 + r() * 0.12, r()]); } return out; };
  for (let i = 0; i < 6; i++) trees.push({ t: { x: 0, y: 0, r: 1 }, blobs: blobsFor(300 + i) });
  let lastT = 0;

  /** Draws the whole picture for one frame. */
  function draw(c: CanvasRenderingContext2D, L: HeroLayout, time: number, paint: Paint) {
    const { W, H } = L, dt = Math.min(0.05, Math.max(0, time - lastT)); lastT = time;
    if (!pat) pat = c.createPattern(tile, "repeat");
    const og = !!L.og, region = L.bottom - L.top;
    // the scale: the house fits the upper part of the free space; Pat is drawn closer (bigger) in front
    const hw = 6.75 + 1.2, hh = 5.25 + 1.75 + 5.4 * OBL_HERO + 1.6;
    const S = og ? 30 : Math.max(14, Math.min((W * 0.64) / hw, (region * 0.56) / hh));
    const T = og ? 98 : Math.min(S * 1.8, (W * 0.5) / 2.3);
    const hx = og ? 838 : W * 0.5, hy = og ? 128 : L.top + hh * S * 0.6;
    const tx = og ? 912 : W * 0.6, ty = og ? 478 : Math.min(L.bottom - 1.75 * T, hy + hh * S * 0.5 + 2.2 * T);
    // ── the lawn: wide east-west stripes, a band of long grass still to mow ahead of Pat ──
    const band = 2.7 * T, b0 = ty - band / 2;
    c.fillStyle = "#86c056"; c.fillRect(0, 0, W, H);
    for (let k = -12; k < 12; k++) { const y0 = b0 + k * band; if (y0 > H || y0 + band < 0) continue; c.fillStyle = k % 2 ? "#7ab64c" : "#94ca62"; c.fillRect(0, y0, W, band + 0.5); }
    // long grass ahead of the tractor (it's mowing to the left)
    const cutTo = tx - 0.2 * T;
    c.fillStyle = "#5f9a3c"; c.fillRect(0, b0, cutTo, band);
    c.save(); c.beginPath(); c.rect(0, b0, cutTo, band); c.clip();
    const tr = mulberry32(3); c.lineCap = "round"; c.lineWidth = Math.max(1, T * 0.03);
    for (let k = 0; k < (cutTo * band) / 60; k++) { const x = tr() * cutTo, y = b0 + tr() * band, sw = Math.sin(time * 2 + x * 0.05) * T * 0.02; c.strokeStyle = tr() < 0.5 ? "rgba(40,90,25,0.55)" : "rgba(150,200,100,0.45)"; c.beginPath(); c.moveTo(x, y); c.lineTo(x + sw, y - T * 0.13); c.stroke(); }
    c.restore();
    c.fillStyle = "rgba(255,255,255,0.08)"; c.fillRect(cutTo, b0, W - cutTo, band);   // the fresh stripe, a touch brighter
    if (pat) { c.save(); c.globalAlpha = 0.9; c.fillStyle = pat; c.fillRect(0, 0, W, H); c.restore(); }
    // ── the gravel driveway on the left, up past the house to a turnaround ──
    const gx = hx - (hw / 2 + 1.6) * S;
    c.save(); c.fillStyle = "#cdbfa5"; c.beginPath();
    c.moveTo(gx - 2.2 * S, -10); c.lineTo(gx + 0.9 * S, -10); c.lineTo(gx + 0.9 * S, hy + 1.5 * S); c.quadraticCurveTo(gx + 0.6 * S, hy + 4 * S, gx - 3.5 * S, hy + 6.5 * S); c.lineTo(gx - 6 * S, hy + 5.5 * S); c.quadraticCurveTo(gx - 2.4 * S, hy + 3.4 * S, gx - 2.2 * S, hy); c.closePath(); c.fill(); c.clip();
    const gr = mulberry32(8); for (let k = 0; k < 900; k++) { const v = gr(); c.fillStyle = v < 0.35 ? "rgba(120,105,85,0.45)" : v < 0.7 ? "rgba(245,238,222,0.7)" : "rgba(160,150,135,0.5)"; c.beginPath(); c.arc(gx - 6 * S + gr() * 8 * S, -10 + gr() * (hy + 8 * S), Math.max(0.8, S * 0.05) * (0.6 + gr()), 0, 7); c.fill(); }
    c.restore();
    c.strokeStyle = "rgba(90,110,50,0.4)"; c.lineWidth = Math.max(1.5, S * 0.12); c.beginPath(); c.moveTo(gx + 0.9 * S, -10); c.lineTo(gx + 0.9 * S, hy + 1.5 * S); c.quadraticCurveTo(gx + 0.6 * S, hy + 4 * S, gx - 3.5 * S, hy + 6.5 * S); c.stroke();
    // ── the house ──
    c.save(); c.translate(hx, hy); c.scale(S, S);
    for (const b of [B.house, B.porch]) buildingShadow(c, b, OBL_HERO);
    // flower beds either side of the porch steps
    const pys = B.porch.poly.map(p => p[1]), pxs = B.porch.poly.map(p => p[0]), front = Math.max(...pys), pl = Math.min(...pxs), pr = Math.max(...pxs);
    for (const [x0, x1] of [[pl + 0.1, (pl + pr) / 2 - 1.0], [(pl + pr) / 2 + 1.0, pr - 0.1]]) {
      c.fillStyle = "#6b4a31"; c.beginPath(); c.roundRect(x0, front + 0.15, x1 - x0, 0.7, 0.2); c.fill(); c.strokeStyle = "#b9b0a2"; c.lineWidth = 0.08; c.stroke();
      const fr = mulberry32(Math.round(x0 * 10) + 50);
      for (let x = x0 + 0.3; x < x1 - 0.1; x += 0.55) { c.fillStyle = "#3f7a2e"; c.beginPath(); c.arc(x, front + 0.48, 0.28, 0, 7); c.fill(); c.fillStyle = "#5c9a3f"; c.beginPath(); c.arc(x - 0.07, front + 0.42, 0.15, 0, 7); c.fill(); if (fr() < 0.7) { c.fillStyle = ["#f2c84b", "#e8758a", "#ffffff", "#a77fd6"][Math.floor(fr() * 4)]; c.beginPath(); c.arc(x + 0.08, front + 0.38, 0.07, 0, 7); c.fill(); } }
    }
    drawBuilding(c, B.house, 1, null, OBL_HERO);
    drawBuilding(c, B.porch, 1, null, OBL_HERO);
    c.restore();
    // the red barn, off to the side (the link preview has room for it)
    if (og) { c.save(); c.translate(1112, 352); c.scale(S * 0.6, S * 0.6); c.rotate(0.02); buildingShadow(c, B.barn, OBL_HERO); drawBuilding(c, B.barn, 1, null, OBL_HERO); drawBuilding(c, B.lean, 1, null, OBL_HERO); c.restore(); }
    // ── trees: the big old one by the driveway, one on the right, a couple more at the edges ──
    const spots: [number, number, number][] = og
      ? [[hx - 7.2 * S, hy - 1.6 * S, 3.6 * S], [W * 1.01, H * 0.0, 2.6 * S], [W * 0.6, H * 1.08, 2.0 * S], [hx + 5.9 * S, hy + 1.6 * S, 1.6 * S]]
      : [[hx - (hw / 2 + 3.6) * S, hy - 1.2 * S, 3.5 * S], [hx + (hw / 2 + 2.2) * S, hy - 3.2 * S, 2.6 * S], [W * 1.02, hy + 3.4 * S, 2 * S], [-W * 0.02, L.top - 1.5 * S, 2.2 * S]];
    spots.forEach(([x, y, r], i) => {
      c.save(); c.fillStyle = "rgba(20,40,10,0.16)"; c.beginPath(); c.ellipse(x + r * 0.28, y + r * 0.34, r * 1.04, r * 0.96, 0, 0, 7); c.fill(); c.restore();
      const tt = trees[i]; tt.t = { x: 0, y: 0, r: 1, kind: "leafy" };
      c.save(); c.translate(x, y); c.scale(r, r); drawTree(c, tt.t, tt.blobs, 1, time); c.restore();
    });
    // ── Pat, the tractor, the cat ──
    const h = Math.PI + 0.1, wavePh = (time % 5) / 5, wave = og ? 1 : wavePh < 0.42 ? Math.min(1, Math.sin((wavePh / 0.42) * Math.PI) * 1.6) : 0;
    c.save(); c.translate(tx, ty); c.scale(T, T);
    // clippings flying out the right side of the deck
    if (rnd() < 0.9) for (let n = 0; n < 2; n++) { const a = h + Math.PI / 2 + (rnd() - 0.5) * 0.8, sp = 2 + rnd() * 2.5; parts.push({ x: Math.cos(h + Math.PI / 2) * 1.15 + Math.cos(h) * (rnd() * 0.3 - 0.1), y: Math.sin(h + Math.PI / 2) * 1.15, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + rnd() * 0.3, c: rnd() < 0.5 ? "#a6dc6e" : "#4f8f2f", s: 0.07 }); }
    for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.93; q.vy *= 0.93; q.life -= dt; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0 || parts.length > 60) parts.splice(i, 1);
    for (const q of parts) { c.globalAlpha = Math.min(1, q.life * 3); c.fillStyle = q.c; c.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
    c.globalAlpha = 1;
    drawMower(c, 0, 0, h, 0.04 * Math.sin(time * 0.8), time * 1.2, time, true, 0.95, paint, false, false, { head: 1.4, wave });
    // the cat, sat right in his way, tail going
    const cx = og ? -2.75 : -3.1, cy = 0.15;
    drawCat(c, { x: cx, y: cy, h: 0.15, act: "sit", phase: 0 }, time, 2.6);
    c.restore();
    // a "Meow!" now and then
    const mp = og ? 0.12 : ((time + 2.2) % 5.5) / 5.5;
    if (mp < 0.3) {
      const a = Math.min(1, mp * 20, (0.3 - mp) * 20), bx = tx + cx * T, by = ty + (cy - 1.0) * T, sz = Math.max(13, T * 0.36);
      c.save(); c.globalAlpha = a; c.translate(bx, by); const pop = 1 + Math.max(0, 0.04 - mp) * 6; c.scale(pop, pop);
      c.font = `800 ${sz}px system-ui, -apple-system, sans-serif`; const tw = c.measureText("Meow!").width + sz * 1.1;
      c.fillStyle = "#fff"; if (a > 0.98) { c.shadowColor = "rgba(0,0,0,0.22)"; c.shadowBlur = 8; c.shadowOffsetY = 2; } c.beginPath(); c.roundRect(-tw / 2, -sz * 0.95, tw, sz * 1.7, sz * 0.85); c.fill();   // (Safari ignores alpha on shadowed fills)
      c.beginPath(); c.moveTo(-sz * 0.3, sz * 0.7); c.lineTo(0, sz * 1.2); c.lineTo(sz * 0.3, sz * 0.7); c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0;
      c.fillStyle = "#2b3441"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("Meow!", 0, -0.08 * sz); c.restore();
    }
    return { S, T };
  }
  return { draw };
}

/** Runs the title picture in a canvas until the returned function is called. `top`/`bottom` come from the page:
 *  elements marked data-hero-top (the title) and data-hero-bottom (the buttons) keep the picture clear of them. */
export function startHero(canvas: HTMLCanvasElement, wrap: HTMLElement, paintNow: () => Paint, debug: boolean) {
  const ctx = canvas.getContext("2d")!, hero = makeHero();
  let W = 300, H = 600, dpr = 1;
  const resize = () => { W = wrap.clientWidth; H = wrap.clientHeight; dpr = window.devicePixelRatio || 1; canvas.style.width = `${W}px`; canvas.style.height = `${H}px`; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); };
  resize();
  const ro = new ResizeObserver(resize); ro.observe(wrap);
  const edges = () => {
    const r = wrap.getBoundingClientRect(), t = wrap.querySelector("[data-hero-top]")?.getBoundingClientRect(), b = wrap.querySelector("[data-hero-bottom]")?.getBoundingClientRect();
    return { top: t ? t.bottom - r.top + 6 : H * 0.28, bottom: b ? b.top - r.top - 4 : H - 160 };
  };
  let raf = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const e = edges();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hero.draw(ctx, { W, H, top: e.top, bottom: e.bottom }, now / 1000, paintNow());
  };
  raf = requestAnimationFrame(loop);
  if (debug) (window as unknown as { __hero: unknown }).__hero = {
    /** The link preview: the picture on the right, the name and the line on the left (1200 x 630). */
    og: () => {
      const cv = document.createElement("canvas"); cv.width = 1200; cv.height = 630; const c = cv.getContext("2d")!, h2 = makeHero(), paint = paintNow();
      for (let k = 0; k < 30; k++) h2.draw(c, { W: 1200, H: 630, top: 0, bottom: 630, og: true }, 1.25 + k * 0.03, paint);   // let the clippings fly a moment
      h2.draw(c, { W: 1200, H: 630, top: 0, bottom: 630, og: true }, 2.2, paint);
      // the words on a soft panel
      const g = c.createLinearGradient(0, 0, 600, 0); g.addColorStop(0, "rgba(250,253,244,0.97)"); g.addColorStop(0.78, "rgba(250,253,244,0.94)"); g.addColorStop(1, "rgba(250,253,244,0)");
      c.fillStyle = g; c.fillRect(0, 0, 600, 630);
      c.fillStyle = "#4d7a33"; c.font = "800 22px -apple-system, system-ui, sans-serif"; c.textBaseline = "alphabetic";
      const sp = (t: string, x: number, y: number, ls: number) => { let cx = x; for (const ch of t) { c.fillText(ch, cx, y); cx += c.measureText(ch).width + ls; } };
      sp("PAT'S BIG WEEKEND", 68, 118, 2.6);
      c.fillStyle = "#24461a"; c.font = "900 92px -apple-system, system-ui, sans-serif"; c.fillText("Pat's", 62, 222); c.fillText("Lawnmower", 62, 316);
      c.fillStyle = "#3a4f2e"; c.font = "500 32px -apple-system, system-ui, sans-serif"; c.fillText("Help Pat finish the lawn before", 68, 398); c.fillText("the cat gets in the way.", 68, 442);
      c.fillStyle = "#f26b1d"; c.beginPath(); c.roundRect(68, 492, 196, 62, 31); c.fill(); c.fillStyle = "rgba(0,0,0,0.16)"; c.fillRect(0, 0, 0, 0);
      c.fillStyle = "#fff"; c.font = "800 27px -apple-system, system-ui, sans-serif"; c.textAlign = "center"; c.fillText("Mow It!", 166, 533); c.textAlign = "left";
      return cv.toDataURL("image/png");
    },
  };
  return () => { cancelAnimationFrame(raf); ro.disconnect(); };
}
