// Chapter 5: the gas run to Aylmer. Pat takes his blue '67 from the barn, through Springfield, south on Springfield Road
// and along Talbot Street into Aylmer to fill the gas cans, then all the way home to the barn. Halfway down Springfield
// Road a tire goes flat: the car rolls onto the shoulder and you change it with a few calm taps (pop the trunk, jack it
// up, loosen the nuts, swap the wheel, tighten the nuts in a star, lower it, stow the flat). It drives exactly like the
// flat-tire job's car (./car); the world is in ./aylmer.
import { buildAylmer } from "./aylmer";
import type { Box } from "./town";
import { drawCar, drawPat, drawTire, CAR } from "./fallArt";
import { drawMower, drawCat } from "./art";
import { drawGasCan, springWash } from "./springArt";
import { PAINTS, type Outcome } from "./jobs";
import { clamp, wrapA } from "./geo";
import { STRIP, type Config, type Hooks, type Hud, type Phase } from "./engine";

const STEP = 1 / 60, FONT = "system-ui, -apple-system, sans-serif";
const VMAX = 15, BRAKE = 14, COAST = 9, WB = CAR.wb, LAT = 7.5, VREV = 3.2;
const RMIN = 3.4;
const DEAD = 0.08, STICK_R = 40, KNOB_R = 21;
const CAP = { road: 99, grass: 7, rough: 5.5 };
const accel = (v: number) => 3 + 6 * Math.max(0, 1 - Math.abs(v) / (VMAX * 1.1));
const fmtD = (d: number) => (d >= 1000 ? `${(d / 1000).toFixed(1)} km` : d >= 10 ? `${Math.round(d)} m` : `${d.toFixed(1)} m`);
const BLUE = "#2f68b4";

type Leg = "out1" | "pull" | "flat" | "out2" | "pump" | "back";
// the tire change, one step at a time (the title on the panel, the help line under it)
const STEPS: [string, string][] = [
  ["Pop The Trunk", "Tap the trunk for the spare and the jack."],
  ["Jack It Up", "Tap the jack to crank the car up."],
  ["Loosen The Nuts", "Tap each nut to spin it off."],
  ["Swap The Wheel", "Tap the flat to pull it off, then tap the spare."],
  ["Tighten The Nuts", "Go round in a star: tap the nut that's lit up."],
  ["Lower The Car", "Tap the jack to let the car down."],
  ["Flat In The Trunk", "Tap the flat and Pat puts it away."],
];
const STAR = [0, 2, 4, 1, 3];   // tightening order round the five studs

export function startGas(canvas: HTMLCanvasElement, wrap: HTMLElement, cfg: Config, hooks: Hooks) {
  const job = cfg.job, snd = cfg.sound, W = buildAylmer(), ctx = canvas.getContext("2d")!;
  let limit = job.limit ?? 300; const par = job.par ?? 230, paint = PAINTS[cfg.up.paint] ?? PAINTS.orange;
  // ── state ──
  let phase: Phase = "ready", leg: Leg = "out1";
  let x = W.yardBox.x, y = W.yardBox.y, h = W.yardBox.a, v = 0, steer = 0, om = 0;
  let simT = 0, bumps = 0, bumpCool = 0, shake = 0, surf: "road" | "grass" | "rough" = "road", parkT = 0, inBox = false, braking = false;
  let uturn = 0, revT = 0, blockedT = 0, sceneT = 0, success = false, ended = false, gi = 0, catSay = 2.5, ri = -1, flatT = 0;
  let gOut2 = W.guideOut2(W.sFlat);
  const floats: { text: string; x: number; y: number; t: number; color: string }[] = [];
  let toast = { text: "", t: 0 }, banner = "", bigT = 0;
  const say = (t: string) => { toast = { text: t, t: 3 }; };
  const box = (): Box => (leg === "back" ? W.yardBox : W.gasBox);
  const guide = () => (leg === "out1" ? W.guideOut1 : leg === "back" ? W.guideBack : gOut2);
  const pat = { x: 0, y: 0, a: 0, ph: 0, show: false, cans: 0, bend: 0 };
  // the roll onto the shoulder when the tire goes
  let pull = { t: 0, D: 1, p0: [0, 0], p1: [0, 0], c0: [0, 0], c1: [0, 0], a1: 0 };
  // the tire change
  const tc = { step: 0, busy: 0, busyT: 0, lid: 0, lidT: 0, tools: 0, lift: 0, liftT: 0, nuts: [1, 1, 1, 1, 1], spin: [0, 0, 0, 0, 0], flatOn: true, spareOn: false, flatOff: 0, spareGo: 0, stow: 0, star: 0, wrongT: 0, wrongI: -1, taps: 0 };

  // ── input: the same fixed stick in the strip under the map; taps on the map work the tire change ──
  type Stick = { id: number; bx: number; by: number; kx: number; ky: number };
  let stick: Stick | null = null, released: { bx: number; by: number; kx: number; ky: number; t: number } | null = null, testIn: [number, number] | null = null, auto = false, speedK = 1, thS = 0, thHeld = false;
  let tapAt: { id: number; x: number; y: number; t: number } | null = null;
  const keys: Record<string, boolean> = {};
  let CW = 300, CH = 400, MH = 276, dpr = 1;
  const resize = () => { CW = wrap.clientWidth; CH = wrap.clientHeight; MH = Math.max(120, CH - STRIP); dpr = window.devicePixelRatio || 1; canvas.style.width = `${CW}px`; canvas.style.height = `${CH}px`; canvas.width = Math.round(CW * dpr); canvas.height = Math.round(CH * dpr); };
  resize(); const ro = new ResizeObserver(resize); ro.observe(wrap); window.addEventListener("resize", resize);
  const stickRest = () => ({ x: CW / 2, y: MH + 9 + STICK_R + KNOB_R });
  const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const ZOOM_KEY = "pats-lawnmower-carzoom";
  let zoomK = 1; try { const z = parseFloat(localStorage.getItem(ZOOM_KEY) || ""); if (z >= 0.7 && z <= 1.6) zoomK = z; } catch {}
  const setZoom = (z: number) => { zoomK = clamp(z, 0.7, 1.6); try { localStorage.setItem(ZOOM_KEY, zoomK.toFixed(3)); } catch {} };
  if (hooks.zoomRef) hooks.zoomRef.current = (dir: number) => setZoom(zoomK * (dir > 0 ? 1 / 1.2 : 1.2));
  const fingers = new Map<number, { x: number; y: number }>(); let pinch: { d: number; z: number } | null = null;
  const gap = () => { const [a, b] = [...fingers.values()]; return Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)); };
  const onMove = (e: PointerEvent) => {
    if (fingers.has(e.pointerId)) { fingers.set(e.pointerId, local(e)); if (fingers.size === 2 && pinch) setZoom((pinch.z * pinch.d) / gap()); return; }
    if (!stick || stick.id !== e.pointerId) return;
    const p = local(e), dx = p.x - stick.bx, dy = p.y - stick.by, d = Math.hypot(dx, dy);
    stick.kx = d > STICK_R ? (dx / d) * STICK_R : dx; stick.ky = d > STICK_R ? (dy / d) * STICK_R : dy;
  };
  const onDown = (e: PointerEvent) => {
    const p = local(e);
    if (p.y < MH) {
      if (leg === "flat") { tapAt = { id: e.pointerId, x: p.x, y: p.y, t: performance.now() }; e.preventDefault(); return; }
      if (e.pointerType === "mouse" || fingers.size >= 2) return; fingers.set(e.pointerId, p); try { canvas.setPointerCapture(e.pointerId); } catch {} if (fingers.size === 2) pinch = { d: gap(), z: zoomK }; e.preventDefault(); return;
    }
    if (p.y < MH + 4 || stick) return;
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    const r = stickRest(); stick = { id: e.pointerId, bx: r.x, by: r.y, kx: 0, ky: 0 }; onMove(e); e.preventDefault();
  };
  const onUp = (e: PointerEvent) => {
    if (tapAt?.id === e.pointerId) { const p = local(e); if (Math.hypot(p.x - tapAt.x, p.y - tapAt.y) < 16 && performance.now() - tapAt.t < 700) flatTap(p.x, p.y); tapAt = null; }
    if (fingers.delete(e.pointerId) && fingers.size < 2) pinch = null; if (stick?.id === e.pointerId) { released = { bx: stick.bx, by: stick.by, kx: stick.kx, ky: stick.ky, t: performance.now() / 1000 }; stick = null; }
  };
  const KEYS: Record<string, string> = { KeyW: "u", ArrowUp: "u", KeyS: "d", ArrowDown: "d", KeyA: "l", ArrowLeft: "l", KeyD: "r", ArrowRight: "r" };
  const onKey = (e: KeyboardEvent) => {
    if (leg === "flat" && (e.code === "Space" || e.code === "Enter")) { e.preventDefault(); if (e.type === "keydown" && !e.repeat) { const t = targets()[0]; if (t) flatTap(t.x, t.y); } return; }   // the keyboard works the tire change too
    const k = KEYS[e.code]; if (!k) return; e.preventDefault(); keys[k] = e.type === "keydown";
  };
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);
  window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey);
  const driving = () => leg === "out1" || leg === "out2" || leg === "back";
  function readStick(): [number, number] {
    if (auto) return autoInput();
    if (testIn) return testIn;
    if (stick) return [stick.kx / STICK_R, stick.ky / STICK_R];
    const ax = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), ay = (keys.d ? 1 : 0) - (keys.u ? 1 : 0), d = Math.hypot(ax, ay); return d ? [ax / d, ay / d] : [0, 0];
  }

  // ── the autopilot (tests only): follows this leg's guide path with the same stick ──
  function autoInput(): [number, number] {
    if (!driving()) return [0, 0];
    const g = guide(), a = W.along(g, x, y, gi); gi = a.i;
    const total = g.cum[g.cum.length - 1], left = total - a.s, parks = leg !== "out1";
    const ptAt = (s: number) => { s = clamp(s, 0, total); let i = 1; while (i < g.cum.length - 1 && g.cum[i] < s) i++; const u = (s - g.cum[i - 1]) / Math.max(1e-6, g.cum[i] - g.cum[i - 1]), p = g.pts[i - 1], q = g.pts[i]; return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]; };
    const look = parks && left < 9 ? Math.max(1.2, left) : 4.5 + Math.abs(v) * 0.55, [tx, ty] = ptAt(a.s + look);
    let turn = 0; for (let s = a.s; s < a.s + 10 + Math.abs(v) * 2.4; s += 2) { const p0 = ptAt(s), p1 = ptAt(s + 4), p2 = ptAt(s + 8), d = Math.abs(wrapA(Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) - Math.atan2(p1[1] - p0[1], p1[0] - p0[0]))) / 6; turn = Math.max(turn, d); }
    let vT = turn > 1e-3 ? Math.max(4.5, Math.sqrt((LAT * 0.8) / turn)) : VMAX; if (parks) vT = Math.min(vT, VMAX, Math.sqrt(2 * 3.2 * Math.max(0, left - 0.4)) + 0.6);
    if (inBox) return [0, 0];
    if (parks && left < 4) { const bx = box(), ex = bx.x - x, ey = bx.y - y, ed = Math.hypot(ex, ey) || 1, m = clamp(ed * 0.06, 0.1, 0.3); return [(ex / ed) * m, (ey / ed) * m]; }
    const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1, m = clamp(vT / VMAX, 0.12, 1);
    return [(dx / d) * m, (dy / d) * m];
  }

  // ── driving (the same car as ./car) ──
  function arcClear(side: number) {
    for (const a of [0.35, 0.8, 1.3, 1.9, 2.6]) { const px = x + RMIN * (Math.sin(a) * Math.cos(h) - side * (1 - Math.cos(a)) * Math.sin(h)), py = y + RMIN * (Math.sin(a) * Math.sin(h) + side * (1 - Math.cos(a)) * Math.cos(h)); if (W.clearAt(px, py) < 1.4 || W.surface(px, py) === "rough") return false; }
    return true;
  }
  function step(dt: number) {
    const live = phase === "ready" || (phase === "play" && driving());
    const [ax, ay] = live ? readStick() : [0, 0], raw = Math.min(1, Math.hypot(ax, ay));
    if (phase === "ready" && raw > DEAD) { phase = "play"; hooks.onStart(); }
    if (leg === "pull") pullStep(dt);
    else {
      let target = 0, omT = 0, dec = COAST;
      if (revT > 0) { revT -= dt; target = -VREV; omT = -uturn * (Math.abs(v) / RMIN); dec = BRAKE; }
      else if (raw > DEAD && live) {
        const th = Math.atan2(ay, ax); if (!thHeld) { thS = th; thHeld = true; } else thS = wrapA(thS + wrapA(th - thS) * Math.min(1, dt * 18));
        const mag = (raw - DEAD) / (1 - DEAD), diff = wrapA(thS - h), back = Math.abs(wrapA(th - h)) > 2.25;
        if (uturn && Math.abs(diff) < 0.6) uturn = 0;
        if (back && !uturn && v > 6) { target = 0; dec = BRAKE; }
        else {
          if (back && !uturn) { const pref = Math.abs(Math.abs(wrapA(th - h)) - Math.PI) < 0.45 ? 0 : Math.sign(wrapA(th - h)); const s = pref || (arcClear(1) || !arcClear(-1) ? 1 : -1); uturn = s; if (!arcClear(s)) { revT = 1.3; } }
          if (uturn) { target = 4.2; omT = uturn * (Math.max(0.5, v) / RMIN); dec = BRAKE; }
          else { target = VMAX * mag * Math.max(0.3, Math.pow(Math.cos(Math.min(Math.abs(diff), 1.35)), 1.4)); omT = clamp(diff * 4, -4, 4); dec = target < v - 0.5 ? BRAKE : COAST; }
        }
      } else { uturn = 0; thHeld = false; }
      target = Math.sign(target) * Math.min(Math.abs(target), CAP[surf]);
      if (phase === "scene" || phase === "over" || !driving()) { target = 0; dec = BRAKE; }
      braking = target < v - 1 && v > 1;
      v += clamp(target - v, -dec * dt, accel(v) * dt);
      if (Math.abs(v) > CAP[surf] + 0.2) v -= Math.sign(v) * Math.min(Math.abs(v) - CAP[surf], 9 * dt);
      const omMax = Math.abs(v) / RMIN;
      om += clamp(clamp(omT, -omMax, omMax) - om, -16 * dt, 16 * dt); om = clamp(om, -omMax, omMax);
      h = wrapA(h + om * dt);
      steer += (clamp(Math.abs(v) > 0.3 ? Math.atan((WB * om) / v) : 0, -0.6, 0.6) - steer) * Math.min(1, dt * 12);
      const ox = x, oy = y; x += Math.cos(h) * v * dt; y += Math.sin(h) * v * dt;
      let hitN: [number, number] | null = null;
      for (const off of [1.45, 0, -1.45]) { const cx = x + Math.cos(h) * off, cy = y + Math.sin(h) * off, q = W.collide(cx, cy, 0.9); if (q.hit) { x += q.x - cx; y += q.y - cy; hitN = [q.nx, q.ny]; } }
      if (hitN) {
        const into = -(Math.cos(h) * hitN[0] + Math.sin(h) * hitN[1]) * v;
        if (into > 1.6 && bumpCool <= 0 && phase === "play") bump(x + Math.cos(h) * 2, y + Math.sin(h) * 2);
        v *= into > 1.6 ? 0.25 : 0.75;
      }
      const moved = Math.hypot(x - ox, y - oy), wanted = Math.abs(v) * dt;
      blockedT = wanted > 0.01 && moved < wanted * 0.4 ? blockedT + dt : Math.max(0, blockedT - dt * 2);
      if (uturn && blockedT > 0.25 && revT <= 0) { revT = 1.1; blockedT = 0; }
      else if (revT > 0 && blockedT > 0.25) { revT = 0; blockedT = 0; }
      const s2 = W.surface(x, y);
      if (s2 === "rough" && surf !== "rough" && Math.abs(v) > 3.5 && phase === "play" && bumpCool <= 0) { bump(x, y); say("Stay On The Road"); }
      surf = s2;
    }
    bumpCool -= dt; shake = Math.max(0, shake - dt); catSay = Math.max(0, catSay - dt); bigT = Math.max(0, bigT - dt);
    if (phase === "play" && leg !== "pump") simT += dt;
    if (phase === "play") {
      // the tire goes about halfway down Springfield Road
      if (leg === "out1") { const r = W.roadS(x, y, ri); ri = r.i; if (r.s >= W.sFlat && r.d < 9) startPull(r.s); }
      // parking at the pump, and home by the barn: in the box, lined up (either way round) and stopped for a moment
      if (leg === "out2" || leg === "back") {
        const b = box(), dx = x - b.x, dy = y - b.y, lon = dx * Math.cos(b.a) + dy * Math.sin(b.a), lat = -dx * Math.sin(b.a) + dy * Math.cos(b.a);
        inBox = Math.abs(lon) < 0.8 && Math.abs(lat) < 0.6 && Math.abs(Math.sin(h - b.a)) < 0.26;
        parkT = inBox && Math.abs(v) < 0.4 ? parkT + dt : 0;
        if (parkT > 0.5) { parkT = 0; inBox = false; if (leg === "out2") { leg = "pump"; pumpSt = 0; pumpT = 0; snd.chime(); say("Pat's Filling The Cans"); } else endRun(true); }
      } else inBox = false;
      if (simT >= limit) endRun(false);
    }
    if (leg === "flat") flatStep(dt);
    if (leg === "pump") pumpStep(dt);
    if (phase === "scene") {
      sceneT += dt;
      if (success) homeStep(dt);
      if (sceneT > (success ? 4.4 : 2.4) && !ended) { ended = true; phase = "over"; hooks.onEnd(outcome(success)); }
    }
    for (const f of floats) f.t -= dt; for (let i = floats.length - 1; i >= 0; i--) if (floats[i].t <= 0) floats.splice(i, 1);
    toast.t = Math.max(0, toast.t - dt);
  }
  function bump(bx: number, by: number) { bumps++; bumpCool = 1.4; shake = 0.25; snd.bump(); floats.push({ text: "Bump!", x: bx, y: by - 1.5, t: 1.4, color: "#ffd2cc" }); try { if (!auto) navigator.vibrate?.(14); } catch {} }

  // ── the flat: a bang, a hiss, and the car rolls onto the shoulder on its own ──
  function startPull(sNow: number) {
    leg = "pull"; uturn = 0; revT = 0; stick = null; thHeld = false;
    const f = W.flatSpot(sNow), d = Math.hypot(f.x - x, f.y - y), sp = Math.max(3, Math.abs(v));
    pull = { t: 0, D: clamp((2 * d) / (sp + 0.5), 1.4, 3.6), p0: [x, y], p1: [f.x, f.y], c0: [x + Math.cos(h) * d * 0.45, y + Math.sin(h) * d * 0.45], c1: [f.x - Math.cos(f.a) * d * 0.4, f.y - Math.sin(f.a) * d * 0.4], a1: f.a };
    snd.bump(); snd.hiss(); shake = 0.45; bigT = 2.2; banner = "Flat Tire!";
    try { if (!auto) navigator.vibrate?.([20, 40, 20]); } catch {}
  }
  function pullStep(dt: number) {
    pull.t += dt; const u = clamp(pull.t / pull.D, 0, 1), e = 1 - (1 - u) * (1 - u);   // eases to a stop
    const B = (k: number) => { const m = 1 - e; return m * m * m * pull.p0[k] + 3 * m * m * e * pull.c0[k] + 3 * m * e * e * pull.c1[k] + e * e * e * pull.p1[k]; };
    const nx = B(0), ny = B(1), dx = nx - x, dy = ny - y, d = Math.hypot(dx, dy);
    if (d > 1e-4) { const nh = Math.atan2(dy, dx); steer += (clamp(wrapA(nh - h) * 8, -0.5, 0.5) - steer) * Math.min(1, dt * 10); h = nh; }
    v = d / dt; x = nx; y = ny; braking = true;
    if (u >= 1) { v = 0; steer = 0; h = wrapA(h + wrapA(pull.a1 - h) * 0.5); leg = "flat"; tc.step = 0; tc.busy = 0; flatT = 0; pat.show = true; [pat.x, pat.y] = doorSide(); pat.a = h + Math.PI / 2; say("Change The Tire"); }
  }

  // ── the tire change ──
  // where things are on the car (world): the right rear wheel, the trunk, Pat's door
  const carPt = (lx: number, ly: number): [number, number] => [x + Math.cos(h) * lx - Math.sin(h) * ly, y + Math.sin(h) * lx + Math.cos(h) * ly];
  const doorSide = (): [number, number] => carPt(0.2, -1.3);
  const trunk = (): [number, number] => carPt(-2.9, 0);
  const wheelSide = (): [number, number] => carPt(-1.38, 1.35);
  const walkTo = (tx: number, ty: number, dt: number, sp = 3.2) => { const dx = tx - pat.x, dy = ty - pat.y, d = Math.hypot(dx, dy); if (d < 0.05) return true; const s = Math.min(d, sp * dt); pat.x += (dx / d) * s; pat.y += (dy / d) * s; pat.a = Math.atan2(dy, dx); pat.ph += s * 5.2; return s >= d - 1e-6; };
  let patGoal: "door" | "trunk" | "wheel" | "hide" = "door";
  function flatStep(dt: number) {
    flatT += dt; tc.wrongT = Math.max(0, tc.wrongT - dt);
    // Pat walks where the job is
    const goal = patGoal === "trunk" ? trunk() : patGoal === "wheel" ? wheelSide() : doorSide();
    if (pat.show && walkTo(goal[0], goal[1], dt, 3.4)) { pat.ph = 0; pat.a = patGoal === "wheel" ? h - Math.PI / 2 : patGoal === "trunk" ? h : h + Math.PI / 2; if (patGoal === "hide") pat.show = false; }
    pat.bend = patGoal === "wheel" && tc.step >= 1 ? 0.6 : 0;
    // animations
    tc.lid += ((tc.lidT) - tc.lid) * Math.min(1, dt * 7);
    tc.lift += clamp(tc.liftT - tc.lift, -dt * 1.4, dt * 2.6);
    for (let i = 0; i < 5; i++) tc.spin[i] = Math.max(0, tc.spin[i] - dt);
    if (tc.flatOff > 0 && tc.flatOff < 1) tc.flatOff = Math.min(1, tc.flatOff + dt * 1.8);
    if (tc.spareGo > 0 && tc.spareGo < 1) tc.spareGo = Math.min(1, tc.spareGo + dt * 1.8);
    if (tc.stow > 0 && tc.stow < 1) tc.stow = Math.min(1, tc.stow + dt * 1.1);
    if (tc.busy > 0) {
      tc.busyT -= dt;
      if (tc.busyT <= 0) {
        tc.busy = 0;
        if (tc.step === 0) { tc.tools = 1; patGoal = "wheel"; snd.clank(); next(); }
        else if (tc.step === 1 && tc.liftT >= 1) next();
        else if (tc.step === 2 && tc.nuts.every(n => n === 0)) next();
        else if (tc.step === 3 && tc.spareOn) next();
        else if (tc.step === 4 && tc.nuts.every(n => n === 1)) next();
        else if (tc.step === 5) next();
        else if (tc.step === 6) { tc.lidT = 0; snd.clank(); patGoal = "door"; leg = "out2"; gOut2 = W.guideOut2(W.roadS(x, y, ri).s); gi = 0; pat.show = false; say("Back On The Road To Aylmer"); floats.push({ text: "Good As New!", x, y: y - 2, t: 1.6, color: "#fff4c2" }); }
      }
    }
  }
  function next() { tc.step++; if (tc.step < STEPS.length) snd.pop(); }
  /** The panel the tire change is drawn in (the lower part of the map, with the car in view above it). */
  const panel = () => { const ph = Math.min(MH * 0.6, 230), pw = Math.min(CW - 20, 520); return { x: (CW - pw) / 2, y: MH - ph - 10, w: pw, h: ph }; };
  // the side view: the car seen from its right side, front to the right (metres from its middle, up from the ground)
  const sideK = () => { const P = panel(); return Math.min((P.w * 0.92) / CAR.len, (P.h - 74) / 1.42); };
  const sideAt = (mx: number, my: number): [number, number] => { const P = panel(), k = sideK(); return [P.x + P.w / 2 + mx * k, P.y + P.h - 22 - my * k]; };
  const WR = 0.34, REAR = -1.38, SPARE_X = 0.3, FLAT_X = -0.45, JACK_X = -0.78, LIE_Y = -0.2;   // (the spare and the flat lie on the gravel in front)
  const wheelView = () => tc.step === 2 || tc.step === 4;
  const hubAt = () => { const P = panel(), R = Math.min((P.h - 66) * 0.5, P.w * 0.28); return { cx: P.x + P.w / 2, cy: P.y + P.h - 8 - R, R }; };
  const nutAt = (i: number): [number, number] => { const { cx, cy, R } = hubAt(), a = -Math.PI / 2 + (i * Math.PI * 2) / 5; return [cx + Math.cos(a) * R * 0.46, cy + Math.sin(a) * R * 0.46]; };
  const lifted = () => tc.lift * 0.14;
  /** What can be tapped right now (screen spots, with a radius), most useful first. */
  function targets(): { x: number; y: number; r: number; id: string; dr?: number }[] {   // (dr: the ring's size when it's smaller than the spot you can tap)
    if (leg !== "flat" || tc.busy || tc.step >= STEPS.length) return [];
    const k = sideK(), lr = Math.max(22, k * 0.42);
    switch (tc.step) {
      case 0: { const [tx, ty] = sideAt(-1.95, 0.86); return [{ x: tx, y: ty, r: lr, id: "trunk" }]; }
      case 1: case 5: { const [tx, ty] = sideAt(JACK_X, 0.12); return [{ x: tx, y: ty, r: lr, id: "jack" }]; }
      case 2: return tc.nuts.map((n, i) => ({ n, i })).filter(q => q.n === 1).map(q => { const [nx, ny] = nutAt(q.i); return { x: nx, y: ny, r: Math.max(21, hubAt().R * 0.16), id: `nut${q.i}`, dr: hubAt().R * 0.15 }; });
      case 4: { const i = STAR[tc.star], [nx, ny] = nutAt(i); return [{ x: nx, y: ny, r: Math.max(21, hubAt().R * 0.16), id: `nut${i}`, dr: hubAt().R * 0.15 }]; }
      case 3: { const [fx, fy] = sideAt(REAR, WR + lifted()), [sx2, sy2] = sideAt(SPARE_X, LIE_Y); return tc.flatOn ? [{ x: fx, y: fy, r: Math.max(lr, WR * k * 1.2), id: "flat" }] : [{ x: sx2, y: sy2, r: Math.max(lr, WR * k * 1.2), id: "spare" }]; }
      case 6: { const [fx, fy] = sideAt(FLAT_X, LIE_Y); return [{ x: fx, y: fy, r: Math.max(lr, WR * k * 1.2), id: "flatGround" }]; }
    }
    return [];
  }
  function flatTap(px: number, py: number) {
    if (leg !== "flat" || phase !== "play" || tc.busy || hooks.paused()) return;
    // in the star, a tap on any other nut only shows which one's next
    if (tc.step === 4) {
      const [rx, ry] = nutAt(STAR[tc.star]), rr2 = Math.max(21, hubAt().R * 0.16);
      if (Math.hypot(px - rx, py - ry) >= rr2) for (let i = 0; i < 5; i++) { const [nx, ny] = nutAt(i); if (Math.hypot(px - nx, py - ny) < rr2) { tc.wrongT = 0.9; tc.wrongI = i; snd.click(); return; } }
    }
    const t = targets().find(q => Math.hypot(px - q.x, py - q.y) < q.r); if (!t) return;
    tc.taps++;
    const busy = (s: number) => { tc.busy = 1; tc.busyT = s; };
    if (t.id === "trunk") { tc.lidT = 1; patGoal = "trunk"; snd.click(); busy(1.5); }
    else if (t.id === "jack" && tc.step === 1) { tc.liftT = Math.min(1, tc.liftT + 1 / 3); snd.clank(); busy(0.4); }
    else if (t.id === "jack" && tc.step === 5) { tc.liftT = 0; snd.clank(); busy(0.8); }
    else if (t.id.startsWith("nut") && tc.step === 2) { const i = +t.id.slice(3); tc.nuts[i] = 0; tc.spin[i] = 0.35; snd.click(); busy(0.32); }
    else if (t.id.startsWith("nut") && tc.step === 4) { const i = +t.id.slice(3); tc.nuts[i] = 1; tc.spin[i] = 0.35; tc.star++; snd.click(); busy(0.32); }
    else if (t.id === "flat") { tc.flatOn = false; tc.flatOff = 0.01; snd.bump(); busy(0.6); }
    else if (t.id === "spare") { tc.spareOn = true; tc.spareGo = 0.01; tc.nuts = [0, 0, 0, 0, 0]; snd.clank(); busy(0.6); }
    else if (t.id === "flatGround") { tc.stow = 0.01; patGoal = "trunk"; busy(1.3); }
  }

  // ── at the pump: Pat gets out, takes the cans from the trunk, fills them, puts them back ──
  let pumpSt = 0, pumpT = 0, fill = 0;
  const pumpSide = (): [number, number] => W.local(-1.4, 14.1);
  function pumpStep(dt: number) {
    pumpT += dt;
    if (pumpSt === 0) { [pat.x, pat.y] = doorSide(); pat.show = true; pat.cans = 0; fill = 0; pumpSt = 1; }
    else if (pumpSt === 1) { const [tx, ty] = trunk(); if (walkTo(tx, ty, dt, 4.2)) { pumpSt = 2; pat.cans = 2; snd.clank(); } }
    else if (pumpSt === 2) { const [tx, ty] = pumpSide(); if (walkTo(tx, ty, dt, 4.2)) { pumpSt = 3; pumpT = 0; pat.a = W.dirAt(W.sGas) - Math.PI / 2; } }
    else if (pumpSt === 3) { fill = clamp(pumpT / 2.6, 0, 1); if (Math.floor(pumpT * 4) !== Math.floor((pumpT - dt) * 4)) snd.click(); if (fill >= 1) { pumpSt = 4; snd.coin(); floats.push({ text: "Cans Full!", x: pat.x, y: pat.y - 1.6, t: 1.6, color: "#fff4c2" }); } }
    else if (pumpSt === 4) { const [tx, ty] = trunk(); if (walkTo(tx, ty, dt, 4.2)) { pumpSt = 5; pumpT = 0; pat.cans = 0; snd.clank(); } }
    else if (pumpSt === 5) { const [dx2, dy2] = doorSide(); if (pumpT > 0.3 && walkTo(dx2, dy2, dt, 4.2)) { pumpSt = 6; pat.show = false; leg = "back"; gi = 0; say("Now Home To The Barn"); } }
  }
  // home: Pat takes a can to the tractor and fills it up
  let homeSt = 0;
  function homeStep(dt: number) {
    if (homeSt === 0) { [pat.x, pat.y] = trunk(); pat.show = true; pat.cans = 1; homeSt = 1; catSay = 2.5; snd.meow(); }
    else if (homeSt === 1 && sceneT > 0.6) { if (walkTo(W.tractorAt[0] + 1.5, W.tractorAt[1] + 0.3, dt, 3.6)) { homeSt = 2; pat.a = Math.PI; snd.click(); } }
    else if (homeSt === 2 && sceneT > 2.6) { homeSt = 3; snd.coin(); floats.push({ text: "Full Tank!", x: W.tractorAt[0], y: W.tractorAt[1] - 1.6, t: 1.6, color: "#fff4c2" }); }
  }
  function endRun(ok: boolean) {
    if (phase !== "play") return;
    phase = "scene"; sceneT = 0; success = ok; uturn = 0; revT = 0; stick = null;
    if (ok) { snd.chime(); banner = "Home With The Gas!"; bigT = 99; } else { snd.fail(); banner = "Out Of Time"; bigT = 99; }
  }
  function progress() {
    if (leg === "pull" || leg === "flat") return 0.3 + 0.1 * (tc.step / STEPS.length);
    if (leg === "pump") return 0.5;
    const g = guide(), tot = g.cum[g.cum.length - 1], a = W.along(g, x, y, gi), f = clamp(a.s / tot, 0, 1);
    return leg === "out1" ? 0.3 * f : leg === "out2" ? 0.4 + 0.1 * f : 0.5 + 0.5 * f;
  }
  function outcome(done: boolean): Outcome {
    return { job: job.id, done, secs: simT, limit, par, pct: done ? 1 : progress(), stars: [done, done && simT <= par, done && bumps === 0], meows: 0, bumps, apples: 0, applesTotal: 0, quality: 0, wet: 0, priorityOk: false,
      extra: { label: "Bumps", value: String(bumps) },
      failLine: leg === "back" ? "Turn round behind the pumps, then it's Talbot Street, Springfield Road and Main Street home. Keep it on the road." : leg === "flat" ? "The tire change is on the clock. Tap each part as soon as it lights up." : "Keep it on the road and brake before the corners. In Springfield, turn left onto Springfield Road." };
  }
  hooks.finishRef.current = null;

  // ── drawing ──
  let camX = x, camY = y, camS = 0;
  const rr = (x0: number, y0: number, w: number, hh: number, r: number) => { ctx.beginPath(); ctx.roundRect(x0, y0, w, hh, r); };
  function text(t: string, tx: number, ty: number, size: number, color: string, weight = 700) { ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(t, tx, ty); }
  function pill(t: string, cx: number, cy: number, size: number, fg: string, bg: string, padX = 14, hgt = 30) {
    ctx.font = `800 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + padX * 2;
    ctx.save(); ctx.fillStyle = bg; if (ctx.globalAlpha > 0.98) { ctx.shadowColor = "rgba(0,0,0,0.2)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; } rr(cx - tw / 2, cy - hgt / 2, tw, hgt, hgt / 2); ctx.fill(); ctx.restore();
    text(t, cx, cy + 0.5, size, fg, 800);
  }
  function sign(c: CanvasRenderingContext2D, sx: number, sy: number, t: string, col: string, S: number) {
    c.save(); c.translate(sx, sy); c.scale(1 / S, 1 / S); c.font = `800 11px ${FONT}`; const tw = c.measureText(t).width + 14;
    c.fillStyle = "#5b6066"; c.fillRect(-1, 0, 2, 9); c.fillStyle = "rgba(20,40,10,0.25)"; c.fillRect(-tw / 2 + 3, -17, tw, 19);
    c.fillStyle = col; c.beginPath(); c.roundRect(-tw / 2, -20, tw, 19, 4); c.fill(); c.strokeStyle = "#ffffff"; c.lineWidth = 1.4; c.beginPath(); c.roundRect(-tw / 2 + 2.5, -17.5, tw - 5, 14, 3); c.stroke();
    c.fillStyle = "#ffffff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(t, 0, -10.2); c.restore();
  }
  function ring(px: number, py: number, r: number, time: number) {
    const pu = 0.5 + 0.5 * Math.sin(time * 6);
    ctx.save(); ctx.strokeStyle = `rgba(255,214,70,${(0.65 + 0.35 * pu).toFixed(3)})`; ctx.lineWidth = 3.5; ctx.shadowColor = "rgba(255,200,40,0.8)"; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(px, py, r + pu * 3, 0, 7); ctx.stroke(); ctx.restore();
  }
  /** A wheel from the side: tire, steel rim, hub and (when they're on) five nuts. */
  function sideWheel(cx: number, cy: number, r: number, flat: boolean, nuts: number) {
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = "#151515"; ctx.beginPath(); if (flat) { ctx.ellipse(0, r * 0.16, r * 1.12, r * 0.84, 0, 0, 7); } else ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.fillStyle = "#b9bfc4"; ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, 7); ctx.fill(); ctx.fillStyle = "#8d949a"; ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, 7); ctx.fill();
    if (nuts) { ctx.fillStyle = "#e9ecef"; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * Math.PI * 2) / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36, Math.max(1.2, r * 0.06), 0, 7); ctx.fill(); } }
    ctx.restore();
  }
  /** A wheel lying on the gravel, seen at a slant (the spare waiting, the flat once it's off). */
  function lyingWheel(cx: number, cy: number, r: number, flat: boolean) {
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = "rgba(60,50,30,0.25)"; ctx.beginPath(); ctx.ellipse(r * 0.12, r * 0.12, r * 1.05, r * 0.4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#151515"; ctx.beginPath(); ctx.ellipse(0, 0, r * (flat ? 1.06 : 1), r * 0.38, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#2a2a2a"; ctx.fillRect(-r * (flat ? 1.06 : 1), -r * 0.12, r * 2 * (flat ? 1.06 : 1), r * 0.12);
    ctx.fillStyle = "#151515"; ctx.beginPath(); ctx.ellipse(0, -r * 0.12, r * (flat ? 1.06 : 1), r * 0.38, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#b9bfc4"; ctx.beginPath(); ctx.ellipse(0, -r * 0.12, r * 0.6, r * 0.23, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#8d949a"; ctx.beginPath(); ctx.ellipse(0, -r * 0.12, r * 0.22, r * 0.085, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  /** The tire change panel: the car from the side (or a close-up of the wheel for the nuts), the step and a help line. */
  function drawPanel(time: number) {
    const P = panel(), k = sideK(), lift = lifted(), st = Math.min(tc.step, STEPS.length - 1);
    ctx.save(); ctx.fillStyle = "rgba(255,253,246,0.97)"; ctx.shadowColor = "rgba(0,0,0,0.22)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3; rr(P.x, P.y, P.w, P.h, 16); ctx.fill(); ctx.restore();
    ctx.save(); rr(P.x, P.y, P.w, P.h, 16); ctx.clip();
    if (!wheelView()) {
      // the gravel shoulder, the car's shadow
      const gy = sideAt(0, 0)[1]; ctx.fillStyle = "#cbbf9f"; ctx.fillRect(P.x, gy, P.w, P.y + P.h - gy); ctx.fillStyle = "rgba(90,80,60,0.25)"; for (let q = 0; q < 30; q++) ctx.fillRect(P.x + ((q * 53.7) % P.w), gy + 3 + ((q * 7.3) % 14), 2, 2);
      ctx.fillStyle = "rgba(20,40,10,0.2)"; ctx.beginPath(); ctx.ellipse(P.x + P.w / 2, gy + 1, CAR.len * k * 0.48, 4, 0, 0, 7); ctx.fill();
      const at2 = (mx: number, my: number) => sideAt(mx, my + lift), frontX = 1.38, nutsOn = tc.nuts.filter(n => n).length;
      const poly = (ps: [number, number][], up = true) => { ctx.beginPath(); ps.forEach(([bx, by], i) => { const [qx, qy] = up ? at2(bx, by) : sideAt(bx, by); if (i) ctx.lineTo(qx, qy); else ctx.moveTo(qx, qy); }); ctx.closePath(); };
      // the body, dark wheel wells, the wheels in them
      poly([[-2.33, 0.3], [-2.33, 0.72], [-1.9, 0.82], [-0.55, 1.27], [0.2, 1.29], [0.85, 0.86], [2.22, 0.8], [2.33, 0.62], [2.33, 0.3]]);
      ctx.fillStyle = BLUE; ctx.fill(); ctx.strokeStyle = "rgba(20,30,50,0.6)"; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.14)"; poly([[-2.2, 0.68], [2.2, 0.74], [2.2, 0.66], [-2.2, 0.6]]); ctx.fill();
      for (const ax2 of [REAR, frontX]) { const [qx, qy] = at2(ax2, WR); ctx.fillStyle = "#1d2a3a"; ctx.beginPath(); ctx.arc(qx, qy, WR * k * 1.14, Math.PI, 0); ctx.lineTo(qx + WR * k * 1.14, qy + 2); ctx.lineTo(qx - WR * k * 1.14, qy + 2); ctx.fill(); }
      sideWheel(...at2(frontX, WR), WR * k, false, 5);
      if (tc.flatOn) sideWheel(...at2(REAR, WR - (tc.lift < 0.4 ? 0.04 : 0)), WR * k, tc.lift < 0.4, nutsOn);
      // windows, the door seams, bumpers, the tail light
      poly([[-1.55, 0.9], [-0.55, 1.2], [0.15, 1.22], [0.7, 0.9]]); ctx.fillStyle = "#26313d"; ctx.fill();
      ctx.strokeStyle = BLUE; ctx.lineWidth = Math.max(2, k * 0.05); ctx.beginPath(); ctx.moveTo(...at2(-0.38, 0.9)); ctx.lineTo(...at2(-0.38, 1.21)); ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...at2(-0.32, 0.36)); ctx.lineTo(...at2(-0.32, 0.88)); ctx.moveTo(...at2(0.74, 0.36)); ctx.lineTo(...at2(0.74, 0.88)); ctx.stroke();
      ctx.fillStyle = "#d9dde1"; for (const [bx0, bx1] of [[-2.42, -2.2], [2.2, 2.42]]) { const [q0x, q0y] = at2(bx0, 0.46), [q1x] = at2(bx1, 0.46); ctx.beginPath(); ctx.roundRect(q0x, q0y - 3, q1x - q0x, 6, 3); ctx.fill(); }
      { const [qx, qy] = at2(-2.33, 0.62); ctx.fillStyle = "#b8282a"; ctx.fillRect(qx - 2, qy - 5, 4, 10); }
      { const [qx, qy] = at2(2.33, 0.62); ctx.fillStyle = "#eef0e6"; ctx.fillRect(qx - 3, qy - 4, 4, 8); }
      // the trunk lid on its hinge (it swings up), and the dark trunk under it
      { const [hx, hy] = at2(-1.86, 0.83), len = 0.5 * k, ang = Math.PI - 0.22 + tc.lid * 1.3;
        if (tc.lid > 0.08) { poly([[-2.31, 0.73], [-1.86, 0.82], [-1.86, 0.74], [-2.31, 0.66]]); ctx.fillStyle = "#151c24"; ctx.fill(); }
        ctx.strokeStyle = "#285c9c"; ctx.lineWidth = Math.max(3, k * 0.07); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(ang) * len, hy + Math.sin(ang) * len); ctx.stroke(); }
      // the jack under the car: a red scissor jack with its crank
      if (tc.tools && tc.step <= 5) {
        const [jx, jy] = sideAt(JACK_X, 0), top = (0.12 + lift + 0.14) * k, hw = k * 0.15;
        ctx.strokeStyle = "#c9302a"; ctx.lineWidth = Math.max(2, k * 0.045); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(jx - hw, jy - 2); ctx.lineTo(jx, jy - top / 2); ctx.lineTo(jx - hw, jy - top); ctx.moveTo(jx + hw, jy - 2); ctx.lineTo(jx, jy - top / 2); ctx.lineTo(jx + hw, jy - top); ctx.stroke();
        ctx.fillStyle = "#7a2420"; ctx.fillRect(jx - hw * 1.3, jy - 3, hw * 2.6, 3); ctx.fillRect(jx - hw * 0.8, jy - top - 2, hw * 1.6, 3);
        const cr = (tc.busy && (tc.step === 1 || tc.step === 5) ? time * 10 : 0.6); ctx.strokeStyle = "#8d949a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(jx, jy - top / 2); ctx.lineTo(jx + k * 0.4, jy - top / 2 + 2); ctx.lineTo(jx + k * 0.4 + Math.cos(cr) * 6, jy - top / 2 + 2 + Math.sin(cr) * 6); ctx.stroke();
      }
      // the spare: lying on the gravel, then rolled up onto the hub; the flat comes off and lies there till it's put away
      if (tc.tools && !tc.spareOn) lyingWheel(...sideAt(SPARE_X, LIE_Y), WR * k, false);
      if (tc.spareOn) { const u = tc.spareGo; if (u < 0.5) lyingWheel(...sideAt(SPARE_X + (REAR - SPARE_X) * u, LIE_Y + u * 0.3), WR * k, false); else sideWheel(...sideAt(SPARE_X + (REAR - SPARE_X) * u, WR + lift * u), WR * k, false, nutsOn); }
      if (!tc.flatOn && tc.stow < 1) { const u = tc.flatOff; ctx.save(); ctx.globalAlpha = 1 - tc.stow; if (u < 0.5) sideWheel(...sideAt(REAR + (FLAT_X - REAR) * u, WR + lift), WR * k, true, 0); else lyingWheel(...sideAt(FLAT_X, LIE_Y + tc.stow * 0.5), WR * k, true); ctx.restore(); }
    } else {
      // the close-up: the fender over the wheel, the wheel, its five studs and nuts, the lug wrench on the one being turned
      const { cx, cy, R } = hubAt(), top = P.y + 48;
      ctx.save(); ctx.beginPath(); ctx.rect(P.x, top, P.w, cy - top); ctx.clip();
      ctx.fillStyle = BLUE; ctx.fillRect(P.x, top, P.w, cy - top); ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.fillRect(P.x, top + 8, P.w, 6);
      ctx.fillStyle = "#1d2a3a"; ctx.beginPath(); ctx.arc(cx, cy, R * 1.16, 0, 7); ctx.fill(); ctx.restore();
      ctx.fillStyle = "#151515"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
      ctx.strokeStyle = "#2a2a2a"; ctx.lineWidth = 2; for (let q = 0; q < 24; q++) { const a = (q / 24) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86); ctx.lineTo(cx + Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.98); ctx.stroke(); }
      const rim = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.25, R * 0.1, cx, cy, R * 0.66); rim.addColorStop(0, "#e2e6e9"); rim.addColorStop(1, "#9aa1a7"); ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(cx, cy, R * 0.64, 0, 7); ctx.fill();
      ctx.fillStyle = "#7d858b"; ctx.beginPath(); ctx.arc(cx, cy, R * 0.18, 0, 7); ctx.fill();
      if (tc.step === 4) for (let q = 0; q + 1 < tc.star; q++) { const [nx, ny] = nutAt(STAR[q]), [mx2, my2] = nutAt(STAR[q + 1]); ctx.save(); ctx.strokeStyle = "rgba(230,170,20,0.55)"; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(mx2, my2); ctx.stroke(); ctx.restore(); }
      for (let i = 0; i < 5; i++) {
        const [nx, ny] = nutAt(i), on = tc.nuts[i] === 1, sp = tc.spin[i], nr = R * 0.1;
        ctx.fillStyle = "#5d646b"; ctx.beginPath(); ctx.arc(nx, ny, nr * 0.5, 0, 7); ctx.fill();   // the stud
        if (on || (tc.step === 2 && sp > 0)) {
          const u = sp > 0 ? (0.35 - sp) / 0.35 : 1, out = tc.step === 2 && sp > 0 ? u : 0, a = (tc.step === 2 ? -1 : 1) * u * 6;
          ctx.save(); ctx.translate(nx + (nx - cx) * out * 0.5, ny + (ny - cy) * out * 0.5); ctx.rotate(a); ctx.globalAlpha = 1 - out * 0.8;
          ctx.fillStyle = "#eef1f3"; ctx.beginPath(); for (let q = 0; q < 6; q++) { const b = (q / 6) * Math.PI * 2; if (q) ctx.lineTo(Math.cos(b) * nr, Math.sin(b) * nr); else ctx.moveTo(Math.cos(b) * nr, Math.sin(b) * nr); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#8d949a"; ctx.lineWidth = 1.2; ctx.stroke();
          ctx.fillStyle = "#b9bfc4"; ctx.beginPath(); ctx.arc(0, 0, nr * 0.45, 0, 7); ctx.fill(); ctx.restore();
        }
        if (sp > 0) { const wa = -0.5 + (tc.step === 2 ? -1 : 1) * ((0.35 - sp) / 0.35) * 1.4; ctx.save(); ctx.strokeStyle = "#5b6066"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx + Math.cos(wa) * R * 0.9, ny + Math.sin(wa) * R * 0.9); ctx.stroke(); ctx.restore(); }
        if (tc.step === 4 && !on && tc.wrongT > 0 && tc.wrongI === i) { ctx.save(); ctx.strokeStyle = "rgba(200,60,40,0.75)"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(nx, ny, nr * 1.7, 0, 7); ctx.stroke(); ctx.restore(); }
      }
    }
    for (const t of targets()) ring(t.x, t.y, t.dr ?? t.r, time);
    // the step and its help line, on a band over the top
    ctx.fillStyle = "rgba(255,253,246,0.97)"; ctx.fillRect(P.x, P.y, P.w, 46);
    text(STEPS[st][0], P.x + P.w / 2, P.y + 17, 16, "#2f5a1f", 800);
    text(tc.wrongT > 0 ? "Not that one yet: the lit-up nut is next." : STEPS[st][1], P.x + P.w / 2, P.y + 35, 12, tc.wrongT > 0 ? "#b03a2e" : "#5a6b4f", 700);
    text(`${st + 1} / ${STEPS.length}`, P.x + P.w - 24, P.y + 17, 11, "#8a9580", 800);
    ctx.restore();
  }
  const treeA: number[] = [];
  function draw(time: number, dt: number) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, CW, CH);
    const sp = Math.abs(v), viewM = (28 + Math.min(sp, VMAX) * 0.85) * zoomK;
    let S = Math.min(CW, MH) / viewM, tx = x + Math.cos(h) * v * 0.9, ty = y + Math.sin(h) * v * 0.9 + (MH / S) * 0.05;
    if (leg === "flat" || leg === "pull") { const band = MH - panel().h - 10; S = Math.min(CW / 13, band / 7.2, MH / 13); tx = x; ty = leg === "flat" ? y + (MH / 2 - band / 2) / S : y; }   // the car in the strip of map above the panel
    if (leg === "pump") { const pc = W.local(0, 15); tx = (x + pc[0]) / 2; ty = (y + pc[1]) / 2; S = Math.min(CW, MH) / (24 * zoomK); }
    if ((phase === "scene" || phase === "over") && success) { tx = (x + W.tractorAt[0]) / 2; ty = (y + W.tractorAt[1]) / 2; S = Math.min(CW, MH) / 24; }
    if (!camS) { camS = S; camX = tx; camY = ty; }
    const k = 1 - Math.exp(-dt * 3.2); camX += (tx - camX) * k; camY += (ty - camY) * k; camS += (S - camS) * (1 - Math.exp(-dt * 1.6)); S = camS;
    const shx = shake > 0 ? (Math.random() - 0.5) * shake * 0.8 : 0, shy = shake > 0 ? (Math.random() - 0.5) * shake * 0.8 : 0;
    const ox = CW / 2 - (camX + shx) * S, oy = MH / 2 - (camY + shy) * S, vw = CW / S, vh = MH / S, vx0 = camX - vw / 2 - 4, vy0 = camY - vh / 2 - 4, vx1 = camX + vw / 2 + 4, vy1 = camY + vh / 2 + 4;
    const sx = (wx: number) => ox + wx * S, sy = (wy: number) => oy + wy * S;
    ctx.save(); rr(0, 0, CW, MH, 18); ctx.clip();
    ctx.save(); ctx.translate(ox, oy); ctx.scale(S, S);
    W.drawGround(ctx, vx0, vy0, vx1, vy1);
    springWash(ctx, camX, camY, vw, vh);
    if (phase !== "scene" && phase !== "over" && (leg === "out2" || leg === "back")) W.drawBox(ctx, box(), 0.5 + 0.5 * Math.sin(time * 4));
    W.drawPumps(ctx);
    W.drawStanding(ctx, vx0, vy0, vx1, vy1);
    for (const sg of W.signs) sign(ctx, sg.p[0], sg.p[1], sg.text, sg.col, S);
    // the tractor waiting by the barn, empty, and the cat keeping it company
    drawMower(ctx, W.tractorAt[0], W.tractorAt[1], 0, 0, 0, time, false, 0.62, paint, false, false, { empty: true });
    drawCat(ctx, { x: W.catAt[0], y: W.catAt[1], h: Math.atan2(y - W.catAt[1], x - W.catAt[0]), act: "sit", phase: 1 }, time, 2.2);
    // the car, the flat squashed out at the right rear, and the spare on the gravel beside it
    drawCar(ctx, x, y, h, steer, { brake: braking, t: time, signal: leg === "flat" || leg === "pull" ? 1 : 0 });
    if ((leg === "pull" || leg === "flat") && tc.flatOn) { const [fx, fy] = carPt(-1.38, 0.86); ctx.fillStyle = "#111"; ctx.beginPath(); ctx.ellipse(fx, fy, 0.38, 0.12, h, 0, 7); ctx.fill(); }
    if (leg === "flat" && tc.tools && !tc.spareOn) { const [qx, qy] = carPt(-0.4, 1.55); drawTire(ctx, qx, qy, h + Math.PI / 2, 0); }
    if (leg === "flat" && !tc.flatOn && tc.stow < 0.5) { const [qx, qy] = carPt(-2.0, 1.6); drawTire(ctx, qx, qy, h, 0); }
    if (pat.show) {
      drawPat(ctx, pat.x, pat.y, pat.a, { walk: pat.ph, bend: pat.bend }, time);
      for (let q = 0; q < pat.cans; q++) { const ly = pat.cans === 2 ? (q ? 0.3 : -0.3) : 0.3, hx = pat.x + Math.cos(pat.a) * 0.42 - Math.sin(pat.a) * ly, hy = pat.y + Math.sin(pat.a) * 0.42 + Math.cos(pat.a) * ly; drawGasCan(ctx, hx, hy, pat.a + (homeSt >= 2 && sceneT < 2.6 ? 0.9 : 0), leg === "pump" ? (pumpSt >= 4 ? 1 : 0) : 1, 0.9); }
    }
    if (leg === "pump" && pumpSt === 3) { const [px2, py2] = W.pumps[0]; ctx.strokeStyle = "#2b2f33"; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(px2, py2); ctx.quadraticCurveTo((px2 + pat.x) / 2, (py2 + pat.y) / 2 + 0.6, pat.x + Math.cos(pat.a) * 0.4, pat.y + Math.sin(pat.a) * 0.4); ctx.stroke(); }
    W.drawCanopy(ctx, leg === "pump" || ((leg === "out2" || leg === "back") && Math.hypot(x - W.gasBox.x, y - W.gasBox.y) < 14));
    W.drawPoles(ctx, vx0, vy0, vx1, vy1);
    W.drawTrees(ctx, vx0, vy0, vx1, vy1, time, x, y, (i, near) => { treeA[i] = (treeA[i] ?? 0.96) + ((near ? 0.45 : 0.96) - (treeA[i] ?? 0.96)) * Math.min(1, dt * 8); return treeA[i]; });
    ctx.restore();
    // the target box: an arrow on the edge when it's off screen
    if (phase !== "scene" && phase !== "over" && (leg === "out2" || leg === "back")) {
      const b = box(), qx = sx(b.x), qy = sy(b.y), bob = Math.sin(time * 6) * 3;
      if (qx < 8 || qx > CW - 8 || qy < 8 || qy > MH - 8) {
        const a = Math.atan2(qy - sy(y), qx - sx(x)), ex = clamp(qx, 26, CW - 26), ey = clamp(qy, 26, MH - 26);
        ctx.save(); ctx.translate(ex - Math.cos(a) * bob, ey - Math.sin(a) * bob); ctx.rotate(a); ctx.fillStyle = "#ffd646"; ctx.strokeStyle = "rgba(60,50,0,0.6)"; ctx.lineWidth = 2; ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; ctx.stroke(); ctx.restore();
      } else if (Math.hypot(b.x - x, b.y - y) > 4) {
        ctx.save(); ctx.translate(qx, qy - 22 + bob); ctx.fillStyle = "#ffd646"; ctx.strokeStyle = "rgba(60,50,0,0.6)"; ctx.lineWidth = 2; ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-10, -4); ctx.lineTo(-4, -4); ctx.lineTo(-4, -12); ctx.lineTo(4, -12); ctx.lineTo(4, -4); ctx.lineTo(10, -4); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; ctx.stroke(); ctx.restore();
      }
      if (inBox && Math.abs(v) >= 0.4 && phase === "play") pill("Stop Here!", CW / 2, MH - 30, 13, "#2f5a1f", "rgba(255,255,255,0.97)", 16, 32);
    }
    if (catSay > 0 && (phase === "ready" || phase === "scene" || phase === "over" || simT < 3)) { const bx = sx(W.catAt[0]), by = sy(W.catAt[1]) - 26, a = Math.min(1, catSay * 3); ctx.save(); ctx.globalAlpha = a; pill("Meow!", bx, by, 13, "#2b3441", "#ffffff", 11, 24); ctx.restore(); }
    for (const f of floats) { const u = 1 - f.t / 1.4; ctx.save(); ctx.globalAlpha = Math.min(1, f.t * 2); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(30,40,20,0.55)"; ctx.font = `800 14px ${FONT}`; ctx.textAlign = "center"; ctx.strokeText(f.text, sx(f.x), sy(f.y) - u * 26); text(f.text, sx(f.x), sy(f.y) - u * 26, 14, f.color, 800); ctx.restore(); }
    // the filling meter at the pump
    if (leg === "pump" && pumpSt >= 3 && pumpSt <= 4) { const bw = 150, bx = CW / 2 - bw / 2, by = MH - 44; ctx.save(); ctx.fillStyle = "rgba(255,255,255,0.96)"; ctx.shadowColor = "rgba(0,0,0,0.2)"; ctx.shadowBlur = 8; rr(bx - 10, by - 12, bw + 20, 36, 18); ctx.fill(); ctx.restore(); text("Filling The Cans", CW / 2, by - 1, 11.5, "#5a6b4f", 800); ctx.fillStyle = "#e6e2d8"; rr(bx, by + 9, bw, 7, 3.5); ctx.fill(); ctx.fillStyle = "#c8281f"; rr(bx, by + 9, bw * fill, 7, 3.5); ctx.fill(); }
    // the minimap: the drive, home, the station, and a dot for the '67
    if (phase !== "scene" && phase !== "over" && leg !== "flat") {
      const all: [number, number][] = []; for (let s = 0; s <= W.sGas + 10; s += 12) all.push(W.at(s));
      const yy = W.yardBox, xs = [...all.map(p => p[0]), yy.x], ys = [...all.map(p => p[1]), yy.y], mx0 = Math.min(...xs) - 30, mx1 = Math.max(...xs) + 30, my0 = Math.min(...ys) - 30, my1 = Math.max(...ys) + 30;
      const mw = Math.min(104, CW * 0.28), ms = mw / Math.max(mx1 - mx0, (my1 - my0) * 0.9), mh = (my1 - my0) * ms, px0 = CW - mw - 9, py0 = 9;
      ctx.save(); ctx.fillStyle = "rgba(255,253,246,0.92)"; ctx.shadowColor = "rgba(0,0,0,0.18)"; ctx.shadowBlur = 8; rr(px0 - 4, py0 - 4, mw + 8, mh + 8, 9); ctx.fill(); ctx.restore();
      const mp = (p: [number, number]) => [px0 + (p[0] - mx0) * ms, py0 + (p[1] - my0) * ms];
      ctx.strokeStyle = "#8d9399"; ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); all.forEach((p, i) => { const q = mp(p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.stroke();
      { const q = mp([yy.x, yy.y]); ctx.fillStyle = "#b3302a"; ctx.fillRect(q[0] - 3.5, q[1] - 3.5, 7, 7); }
      { const q = mp([W.gasBox.x, W.gasBox.y]); ctx.fillStyle = "#c8281f"; ctx.beginPath(); ctx.arc(q[0], q[1], 4, 0, 7); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.stroke(); }
      const q = mp([x, y]); ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(q[0], q[1], 4.5, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(q[0], q[1], 2.2, 0, 7); ctx.fill();
    }
    if (leg === "flat" && phase === "play") drawPanel(time);
    if (toast.t > 0 && leg !== "flat") { ctx.save(); ctx.globalAlpha = Math.min(1, toast.t * 2, (3 - toast.t) * 5); ctx.font = `800 13px ${FONT}`; const tw = ctx.measureText(toast.text).width + 28; pill(toast.text, 52 + tw / 2, 26, 13, "#3d4654", "rgba(255,255,255,0.96)"); ctx.restore(); }
    if (phase === "ready") { const b = 1 + 0.035 * Math.sin(time * 4); ctx.save(); ctx.translate(CW / 2, MH - 30); ctx.scale(b, b); pill("Push The Stick To Start", 0, 0, 13, "#2f5a1f", "rgba(255,255,255,0.97)", 16, 32); ctx.restore(); }
    if (surf === "rough" && phase === "play" && driving()) pill("Back On The Road", CW / 2, MH - 30, 13, "#b03a2e", "rgba(255,255,255,0.95)", 16, 32);
    if (banner && bigT > 0 && (phase === "scene" || leg === "pull" || leg === "flat")) {
      const t = phase === "scene" ? sceneT : 2.2 - bigT, s2 = t < 0.35 ? 0.5 + (t / 0.35) * 0.62 : 1.12 - Math.min(0.12, (t - 0.35) * 0.6);
      ctx.save(); ctx.translate(CW / 2, Math.max(44, MH * 0.1)); ctx.scale(s2, s2); ctx.globalAlpha = Math.min(1, t * 4, bigT * 3); pill(banner, 0, 0, 22, phase === "scene" && success ? "#2f6d1c" : "#a3352a", "rgba(255,255,255,0.97)", 22, 50); ctx.restore();
    }
    ctx.restore();
    // the stick strip (the same look as the tractor's)
    ctx.fillStyle = "rgba(255,255,255,0.42)"; rr(0, MH + 8, CW, CH - MH - 8, 18); ctx.fill();
    const rest = stickRest(); let bx = rest.x, by = rest.y, kx = 0, ky = 0;
    if (stick) { bx = stick.bx; by = stick.by; kx = stick.kx; ky = stick.ky; }
    else if (released) { const u = clamp((time - released.t) / 0.28, 0, 1), e = 1 - Math.pow(1 - u, 3), spring = (1 - e) * Math.cos(u * Math.PI * 0.9); bx = released.bx + (rest.x - released.bx) * e; by = released.by + (rest.y - released.by) * e; kx = released.kx * spring; ky = released.ky * spring; if (u >= 1) released = null; }
    const kd = Math.hypot(kx, ky), on = kd > STICK_R * DEAD, idle = leg === "flat" || leg === "pull" || leg === "pump";
    ctx.save(); ctx.globalAlpha = idle ? 0.45 : 1;
    ctx.save(); ctx.fillStyle = "rgba(255,255,255,0.78)"; ctx.shadowColor = "rgba(0,0,0,0.1)"; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(bx, by, STICK_R, 0, 7); ctx.fill(); ctx.restore();
    ctx.strokeStyle = "rgba(47,104,180,0.32)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, STICK_R, 0, 7); ctx.stroke();
    if (on) { ctx.strokeStyle = "rgba(47,104,180,0.55)"; ctx.lineWidth = 4; ctx.lineCap = "round"; const an = Math.atan2(ky, kx), spn = 0.55 * Math.min(1, kd / STICK_R) + 0.15; ctx.beginPath(); ctx.arc(bx, by, STICK_R - 1, an - spn, an + spn); ctx.stroke(); }
    const qx = bx + kx, qy = by + ky;
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.28)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3; const g = ctx.createRadialGradient(qx - KNOB_R * 0.35, qy - KNOB_R * 0.4, KNOB_R * 0.1, qx, qy, KNOB_R); g.addColorStop(0, "#5f93d6"); g.addColorStop(1, stick ? "#1f4f8f" : "#2f68b4"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(qx, qy, KNOB_R, 0, 7); ctx.fill(); ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.32)"; ctx.beginPath(); ctx.ellipse(qx - KNOB_R * 0.25, qy - KNOB_R * 0.35, KNOB_R * 0.45, KNOB_R * 0.28, -0.4, 0, 7); ctx.fill();
    if (on) { const an = Math.atan2(ky, kx); ctx.save(); ctx.translate(qx, qy); ctx.rotate(an); ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.beginPath(); ctx.moveTo(KNOB_R * 0.62, 0); ctx.lineTo(KNOB_R * 0.08, -KNOB_R * 0.36); ctx.lineTo(KNOB_R * 0.2, 0); ctx.lineTo(KNOB_R * 0.08, KNOB_R * 0.36); ctx.closePath(); ctx.fill(); ctx.restore(); }
    if (!stick && !released) { ctx.fillStyle = "rgba(255,255,255,0.95)"; for (let q = 0; q < 4; q++) { const an = (q * Math.PI) / 2; ctx.beginPath(); ctx.moveTo(rest.x + Math.cos(an) * STICK_R * 0.86, rest.y + Math.sin(an) * STICK_R * 0.86); ctx.lineTo(rest.x + Math.cos(an + 0.22) * STICK_R * 0.7, rest.y + Math.sin(an + 0.22) * STICK_R * 0.7); ctx.lineTo(rest.x + Math.cos(an - 0.22) * STICK_R * 0.7, rest.y + Math.sin(an - 0.22) * STICK_R * 0.7); ctx.fill(); } }
    ctx.restore();
    if (!stick) text(leg === "flat" ? "Tap The Glowing Part" : leg === "pump" ? "Pat's Filling Up" : "Push Where You Want To Go", rest.x, CH - 9, 11, "#5a6b4f", 700);
  }

  // ── loop ──
  let raf = 0, last = performance.now(), acc = 0, hudAt = 0, wasQuiet = false;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    let dt = Math.min(0.1, (now - last) / 1000); last = now;
    const paused = hooks.paused(); if (paused) dt = 0;
    acc += dt * speedK; let n = 0;
    while (acc >= STEP && n < 60 * Math.max(1, speedK)) { step(STEP); acc -= STEP; n++; }
    draw(now / 1000, dt);
    snd.engine({ on: phase === "ready" || (phase === "play" && (driving() || leg === "pull")), rpm: clamp(Math.abs(v) / VMAX * 0.9 + 0.1, 0, 1), blades: 0, load: Math.min(1, shake * 4) });
    const quiet = paused || document.hidden; if (quiet !== wasQuiet) { wasQuiet = quiet; snd.setPaused(quiet); }
    if (now - hudAt > 100) {
      hudAt = now;
      const done = (phase === "scene" || phase === "over") && success;
      let lead: Hud["lead"];
      if (leg === "flat" || leg === "pull") lead = { label: "Flat Tire", value: `${Math.min(tc.step + 1, STEPS.length)} Of ${STEPS.length}` };
      else if (leg === "pump") lead = { label: "At The Pump", value: "Filling Up" };
      else {
        const g = guide(), left = g.cum[g.cum.length - 1] - W.along(g, x, y, gi).s, toGas = leg === "out1" ? left + (W.sGas - W.sFlat) : left;
        lead = { label: leg === "back" ? "To The Barn" : "To Aylmer", value: done ? "Home" : inBox ? "Stop!" : fmtD(Math.max(0, toGas)) };
      }
      hooks.onHud({ pct: done ? 1 : progress(), time: simT, limit, par, meter: { label: "Bumps", value: String(bumps), frac: 0, good: bumps === 0 }, canFinish: false, phase, lead });
    }
  };
  raf = requestAnimationFrame(loop);

  if (cfg.debug) {
    (window as unknown as { __lm: unknown }).__lm = {
      state: () => ({ mode: "job", job: job.id, phase, leg, x, y, h, v, steer, simT, bumps, limit, par, inBox, parkT, surf, uturn, revT, size: [CW, CH, MH], zoom: zoomK, box: box(), progress: progress(), penalty: 0, pct: progress(), meows: 0, step: tc.step, taps: tc.taps, flatAt: flatT }),
      hold: (hx: number, hy: number) => { testIn = [hx, hy]; }, release: () => { testIn = null; },
      auto: (on: boolean) => { auto = on; }, speed: (k: number) => { speedK = k; }, setLimit: (s: number) => { limit = s; }, catOff: () => {},
      tp: (tx: number, ty: number, th?: number) => { x = tx; y = ty; if (th !== undefined) h = th; v = 0; camX = x; camY = y; },
      win: () => { if (phase === "ready") phase = "play"; leg = "back"; endRun(true); },
      flat: () => ({ leg, step: tc.step, busy: tc.busy, targets: targets() }),
      world: () => ({ L: W.L, sFlat: W.sFlat, sGas: W.sGas, sJ: W.sJ, sH: W.sH, out1: W.guideOut1.cum.at(-1), back: W.guideBack.cum.at(-1), gasBox: W.gasBox, yardBox: W.yardBox }),
      probe: (px: number, py: number) => ({ clear: W.clearAt(px, py), surf: W.surface(px, py) }),
      scr: (wx: number, wy: number) => [CW / 2 + (wx - camX) * camS, MH / 2 + (wy - camY) * camS],
      shot: (cx: number, cy: number, vwm: number, pw: number, ph: number) => {   // a still of the world (tests only)
        const cv = document.createElement("canvas"); cv.width = pw; cv.height = ph; const c = cv.getContext("2d")!, s = pw / vwm, vhm = ph / s;
        c.translate(pw / 2 - cx * s, ph / 2 - cy * s); c.scale(s, s); W.drawGround(c, cx - vwm / 2, cy - vhm / 2, cx + vwm / 2, cy + vhm / 2); W.drawPumps(c); W.drawStanding(c, cx - vwm / 2, cy - vhm / 2, cx + vwm / 2, cy + vhm / 2);
        for (const sg of W.signs) sign(c, sg.p[0], sg.p[1], sg.text, sg.col, s); W.drawCanopy(c, false); W.drawPoles(c, cx - vwm / 2, cy - vhm / 2, cx + vwm / 2, cy + vhm / 2); W.drawTrees(c, cx - vwm / 2, cy - vhm / 2, cx + vwm / 2, cy + vhm / 2, 0, 1e9, 1e9, () => 0.96);
        return cv.toDataURL("image/png");
      },
    };
  }
  return () => {
    cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("resize", resize);
    canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp);
    window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey);
    if (hooks.zoomRef) hooks.zoomRef.current = null; snd.stop();
  };
}
