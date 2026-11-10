// The trip between home and the community centre: a few seconds of country road seen from above, the truck pulling
// the trailer with the tractor strapped down, fields going by. Out: the cat sees Pat off at the end of the driveway
// and the village sign comes up before the community centre. Home: the other way, the cat waiting at the farm.
import type { Building } from "../lawnMap";
import { drawBuilding, buildingShadow, drawTree, drawMower, drawCat, type Paint } from "./art";
import { drawRig, drawStraps, rigPt, RIG, type Rig } from "./rig";
import { heroBuildings } from "./hero";
import { mulberry32 } from "./geo";

const D = 150, T = 7.6, WAIT = 1.1;   // metres driven, seconds in all, seconds before the truck pulls away
const FONT = "system-ui, -apple-system, sans-serif";
const OBL_T = 0.3;

export function startTravel(canvas: HTMLCanvasElement, wrap: HTMLElement, o: { dir: "out" | "home"; paint: Paint; onDone: () => void; debug: boolean }) {
  const ctx = canvas.getContext("2d")!, out = o.dir === "out";
  const B = heroBuildings();
  const hall: Building = { kind: "hall", poly: [[-9, -6], [9, -6], [9, 6], [-9, 6]], height: 6, wall: "#dcd8cf", roof: "#8f959b", trim: "#ffffff" };
  const gym: Building = { kind: "hall", poly: [[-5, -4.5], [3, -4.5], [3, 3.5], [-5, 3.5]], height: 9, wall: "#e8e5de", roof: "#e3e7ea", trim: "#ffffff" };
  const blobs = (seed: number) => { const r = mulberry32(seed), b: number[][] = []; for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + r(), d = 0.45 + r() * 0.2; b.push([Math.cos(a) * d, Math.sin(a) * d, 0.42 + r() * 0.12, r()]); } return b; };
  let W = 300, H = 600, dpr = 1, raf = 0, t0 = 0, done = false;
  const resize = () => { W = wrap.clientWidth; H = wrap.clientHeight; dpr = window.devicePixelRatio || 1; canvas.style.width = `${W}px`; canvas.style.height = `${H}px`; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); };
  resize(); const ro = new ResizeObserver(resize); ro.observe(wrap);
  // the farm sits at x = 0 on the north side of the road, the community centre at x = D on the south side
  const farmX = 0, ccX = D;   // going out the truck heads east (right); coming home, west

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!t0) t0 = now;
    const t = (now - t0) / 1000, u = Math.max(0, Math.min(1, (t - WAIT) / (T - WAIT)));   // a moment at the farm gate (or the centre's), then off
    const prog = easeTrip(u), X = out ? farmX + 9 + prog * (ccX - 4 - farmX - 9) : ccX + 4 - prog * (ccX + 4 - farmX - 3);   // the truck's front, from beside one place to beside the other
    const c = ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const S = Math.min(W / 24, H / 30), lane = out ? 1.8 : -1.8, dirA = out ? 0 : Math.PI;
    // the camera lingers on the farm (the cat seeing Pat off) before following the rig; coming home it settles there
    const follow = X + (out ? -5 : 5), ss = (q: number) => { const k = Math.max(0, Math.min(1, q)); return k * k * (3 - 2 * k); };
    const hS = 1 - ss((t - 1.2) / 1.8), hE = ss((t - (T - 2.4)) / 1.8), atStart = out ? farmX + 1 : ccX + 2, atEnd = out ? ccX - 7 : farmX + 5;
    const camX = follow * (1 - hS - hE) + atStart * hS + atEnd * hE, camY = -3 + 8 * (out ? hE : hS);   // (lower down at the community centre, to show the hall)
    c.save(); c.translate(W / 2 - camX * S, H * 0.52 - camY * S); c.scale(S, S);
    const x0 = camX - W / S / 2 - 4, x1 = camX + W / S / 2 + 4, yTop = camY - H * 0.52 / S - 2, yBot = camY + H * 0.48 / S + 2;
    // ── fields either side, a new one every 24 m ──
    c.fillStyle = "#8fa557"; c.fillRect(x0, yTop, x1 - x0, yBot - yTop);
    for (let seg = Math.floor(x0 / 24); seg <= Math.floor(x1 / 24); seg++) for (const side of [-1, 1]) {
      const r = mulberry32(seg * 7 + (side > 0 ? 3 : 11) + 999), kind = Math.floor(r() * 3), fx = seg * 24;
      const yA = side < 0 ? yTop : 6.5, yB = side < 0 ? -6.5 : yBot;
      if ((Math.abs(fx - farmX) < 30 && side < 0) || (Math.abs(fx - ccX) < 34 && side > 0)) continue;   // the farm yard, the community centre
      c.fillStyle = kind === 0 ? "#a88e66" : kind === 1 ? "#6f9e48" : "#b9b56e"; c.fillRect(fx, yA, 24.05, yB - yA);
      c.lineWidth = 0.35;
      for (let rx = fx + 0.6; rx < fx + 24; rx += 1.1) { c.strokeStyle = kind === 0 ? "rgba(110,88,58,0.45)" : kind === 1 ? "rgba(60,110,40,0.55)" : "rgba(150,140,80,0.4)"; c.beginPath(); c.moveTo(rx, yA); c.lineTo(rx, yB); c.stroke(); }
      if (kind === 2) for (let k = 0; k < 3; k++) { const bx = fx + 3 + r() * 18, by = side < 0 ? -9 - r() * 8 : 9 + r() * 8; c.fillStyle = "rgba(20,40,10,0.2)"; c.beginPath(); c.arc(bx + 0.3, by + 0.3, 0.75, 0, 7); c.fill(); c.fillStyle = "#d8c27a"; c.beginPath(); c.arc(bx, by, 0.75, 0, 7); c.fill(); c.strokeStyle = "rgba(140,110,50,0.5)"; c.lineWidth = 0.06; c.beginPath(); c.arc(bx, by, 0.45, 0, 7); c.stroke(); }
      if (r() < 0.45) { const tx = fx + 4 + r() * 16, ty = side < 0 ? -8.5 : 8.5; c.fillStyle = "rgba(20,40,10,0.16)"; c.beginPath(); c.arc(tx + 0.7, ty + 0.8, 2.4, 0, 7); c.fill(); c.save(); c.translate(tx, ty); c.scale(2.3, 2.3); drawTree(c, { x: 0, y: 0, r: 1 }, blobs(seg * 13 + side), 1, t); c.restore(); }
    }
    // ── the road: ditches, gravel shoulders, asphalt, the yellow line ──
    c.fillStyle = "#7f9a4e"; c.fillRect(x0, -6.5, x1 - x0, 13);
    c.fillStyle = "#c4b89f"; c.fillRect(x0, -4.6, x1 - x0, 9.2);
    c.fillStyle = "#5f6266"; c.fillRect(x0, -3.6, x1 - x0, 7.2);
    c.strokeStyle = "#e5c24c"; c.lineWidth = 0.16; c.setLineDash([2.2, 2.6]); c.beginPath(); c.moveTo(x0, 0); c.lineTo(x1, 0); c.stroke(); c.setLineDash([]);
    // power poles along the north side, with the wire
    c.strokeStyle = "rgba(30,30,30,0.35)"; c.lineWidth = 0.05; c.beginPath(); c.moveTo(x0, -5.4); c.lineTo(x1, -5.4); c.stroke();
    for (let px = Math.floor(x0 / 30) * 30; px < x1; px += 30) { c.fillStyle = "rgba(20,40,10,0.25)"; c.fillRect(px + 0.2, -5.2, 2.6, 0.18); c.fillStyle = "#7a5a3c"; c.beginPath(); c.arc(px, -5.4, 0.22, 0, 7); c.fill(); c.fillStyle = "#5b4430"; c.fillRect(px - 0.7, -5.48, 1.4, 0.16); }
    // ── home: the gravel drive, the farmhouse, the big tree, the cat seeing Pat off (or waiting for him) ──
    if (Math.abs(farmX - camX) < 40) {
      c.fillStyle = "#cdbfa5"; c.fillRect(farmX + 0.5, -15, 3.6, 10.5);
      c.save(); c.translate(farmX - 7.5, -15); for (const b of [B.house, B.porch]) buildingShadow(c, b, OBL_T); drawBuilding(c, B.house, 1, null, OBL_T); drawBuilding(c, B.porch, 1, null, OBL_T); c.restore();
      c.fillStyle = "rgba(20,40,10,0.16)"; c.beginPath(); c.arc(farmX + 6.6, -12.2, 4.2, 0, 7); c.fill();
      c.save(); c.translate(farmX + 6, -13); c.scale(4, 4); drawTree(c, { x: 0, y: 0, r: 1 }, blobs(77), 1, t); c.restore();
      c.fillStyle = "#5b6066"; c.fillRect(farmX + 2.6, -5.2, 0.12, 0.6); c.fillStyle = "#e9edf0"; c.fillRect(farmX + 2.3, -5.6, 0.7, 0.42);   // the mailbox
      const cx = farmX - 1.6, cy = -5.9;
      drawCat(c, { x: cx, y: cy, h: Math.PI / 2, act: "sit", phase: 1 }, t, 2.6);
      const show = out ? t < 3 : t > T - 1.2;
      if (show) bubble(c, cx, cy - 1.6, "Meow!", S);
    }
    // ── the community centre: the entrance, the hall, a ball diamond's fence and lights, the sign ──
    if (Math.abs(ccX - camX) < 44) {
      c.fillStyle = "#6d7073"; c.fillRect(ccX - 3, 4.6, 6, 8); c.fillRect(ccX - 12, 12, 26, 9);
      c.save(); c.translate(ccX + 2, 28); buildingShadow(c, hall, OBL_T); drawBuilding(c, hall, 1, null, OBL_T); drawBuilding(c, gym, 1, null, OBL_T); c.restore();
      c.strokeStyle = "#8a9096"; c.lineWidth = 0.08; c.beginPath(); c.arc(ccX - 22, 30, 16, -Math.PI / 2 - 0.2, 0.15); c.stroke();
      c.fillStyle = "#6f9e48"; c.beginPath(); c.moveTo(ccX - 22, 30); c.arc(ccX - 22, 30, 15.8, -Math.PI / 2 - 0.2, 0.15); c.closePath(); c.fill();
      c.fillStyle = "#c0714a"; c.beginPath(); c.moveTo(ccX - 22, 30); c.arc(ccX - 22, 30, 7, -Math.PI / 2 - 0.2, 0.15); c.closePath(); c.fill();
      for (const [lx, ly] of [[ccX - 36, 14], [ccX - 10, 18]]) { c.fillStyle = "#6f757b"; c.beginPath(); c.arc(lx, ly, 0.35, 0, 7); c.fill(); c.fillStyle = "#e9edf0"; c.fillRect(lx - 0.6, ly - 0.9, 1.2, 0.45); }
      sign(c, ccX - 3, 6.2, "Malahide Community Place", "#2f5a1f", S);
    }
    // the village sign a little way from the community centre
    sign(c, ccX - 30, -5.6, "Springfield", "#2d6a3a", S);
    // ── the truck and trailer with the tractor strapped down ──
    const rig: Rig = { x: X, y: lane, a: dirA };
    drawRig(c, rig, { ramps: false });
    const [tx, ty] = rigPt(rig, RIG.park, 0);
    drawMower(c, tx, ty, dirA, 0, 0, t, false, 0.62, o.paint, false, false);
    drawStraps(c, rig, 1);
    c.restore();
    // a caption on top
    pill(c, out ? "Off To Springfield" : "Heading Home", W / 2, 40);
    if (t > T + 0.7 && !done) { done = true; o.onDone(); }
  }
  function bubble(c: CanvasRenderingContext2D, x: number, y: number, text: string, S: number) {
    c.save(); c.translate(x, y); c.scale(1 / S, 1 / S); c.font = `800 14px ${FONT}`; const tw = c.measureText(text).width + 22;
    c.fillStyle = "#fff"; c.shadowColor = "rgba(0,0,0,0.22)"; c.shadowBlur = 8; c.beginPath(); c.roundRect(-tw / 2, -14, tw, 26, 13); c.fill(); c.beginPath(); c.moveTo(-6, 11); c.lineTo(0, 19); c.lineTo(6, 11); c.fill(); c.shadowBlur = 0;
    c.fillStyle = "#2b3441"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, 0, 0); c.restore();
  }
  function sign(c: CanvasRenderingContext2D, x: number, y: number, text: string, col: string, S: number) {
    c.save(); c.translate(x, y); c.scale(1 / S, 1 / S); c.font = `800 12px ${FONT}`; const tw = c.measureText(text).width + 16;
    c.fillStyle = "rgba(20,40,10,0.25)"; c.fillRect(-tw / 2 + 3, -10, tw, 22);
    c.fillStyle = col; c.beginPath(); c.roundRect(-tw / 2, -13, tw, 22, 4); c.fill(); c.strokeStyle = "#ffffff"; c.lineWidth = 1.5; c.beginPath(); c.roundRect(-tw / 2 + 2.5, -10.5, tw - 5, 17, 3); c.stroke();
    c.fillStyle = "#ffffff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, 0, -1.5); c.restore();
  }
  function pill(c: CanvasRenderingContext2D, text: string, x: number, y: number) {
    c.save(); c.font = `800 15px ${FONT}`; const tw = c.measureText(text).width + 32;
    c.fillStyle = "rgba(255,253,246,0.96)"; c.shadowColor = "rgba(0,0,0,0.2)"; c.shadowBlur = 10; c.shadowOffsetY = 2; c.beginPath(); c.roundRect(x - tw / 2, y - 18, tw, 36, 18); c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0;
    c.fillStyle = "#24461a"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, x, y + 0.5); c.restore();
  }
  raf = requestAnimationFrame(frame);
  if (o.debug) (window as unknown as { __travel: unknown }).__travel = { skip: () => { if (!done) { done = true; o.onDone(); } } };
  return () => { cancelAnimationFrame(raf); ro.disconnect(); };
}
/** Pulls away gently, cruises, then slows to a stop. */
function easeTrip(u: number) { const a = 0.18, b = 0.78; if (u < a) return (0.5 * u * u) / a / (b - a / 2 + (1 - b) / 2) ; if (u < b) return (0.5 * a + (u - a)) / (b - a / 2 + (1 - b) / 2); const k = u - b; return (0.5 * a + (b - a) + k - (0.5 * k * k) / (1 - b)) / (b - a / 2 + (1 - b) / 2); }
