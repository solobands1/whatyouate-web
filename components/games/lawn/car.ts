// The flat-tire job: Pat drives his blue '67 from the barn, out the driveway and along the real road into Springfield,
// parks in the Rona lot, buys a tractor tire, and drives home to park by the barn. Same stick strip under the map as
// the tractor (push where you want to go), but it drives like a car: quicker, with a real turning circle, slowing
// for the corners. Off the road it slows right down and that counts as a bump. The world is in ./town.
import { buildTown, type Box } from "./town";
import { drawCar, drawPat, drawTire, CAR } from "./fallArt";
import { drawMower, drawCat } from "./art";
import { PAINTS, type Outcome } from "./jobs";
import { clamp, wrapA } from "./geo";
import { STRIP, type Config, type Hooks, type Hud, type Phase } from "./engine";

const STEP = 1 / 60, FONT = "system-ui, -apple-system, sans-serif";
const VMAX = 24, BRAKE = 14, COAST = 2.4, WB = CAR.wb, MAXSTEER = 0.48, LAT = 7.5, VREV = 3.2;
const DEAD = 0.08, STICK_R = 40, KNOB_R = 21;
const CAP = { road: 99, grass: 7, rough: 5.5 };
const accel = (v: number) => 1.6 + 6.2 * Math.max(0, 1 - Math.abs(v) / (VMAX * 1.1));
const steerMax = (v: number) => Math.min(MAXSTEER, Math.atan((WB * LAT) / Math.max(1, v * v)));
const fmtD = (d: number) => (d >= 1000 ? `${(d / 1000).toFixed(1)} km` : d >= 10 ? `${Math.round(d)} m` : `${d.toFixed(1)} m`);

export function startCar(canvas: HTMLCanvasElement, wrap: HTMLElement, cfg: Config, hooks: Hooks) {
  const job = cfg.job, snd = cfg.sound, T = buildTown(job.fall ?? 0.8), ctx = canvas.getContext("2d")!;
  const limit = job.limit ?? 300, par = job.par ?? 210, paint = PAINTS[cfg.up.paint] ?? PAINTS.orange;
  // ── state ──
  let phase: Phase = "ready", leg: "out" | "shop" | "back" = "out";
  let x = T.yardBox.x, y = T.yardBox.y, h = T.yardBox.a, v = 0, steer = 0;
  let simT = 0, bumps = 0, bumpCool = 0, shake = 0, surf: "road" | "grass" | "rough" = "road", parkT = 0, inBox = false, braking = false;
  let uturn = 0, revT = 0, blockedT = 0, sceneT = 0, success = false, ended = false, shopT = 0, gi = 0, catSay = 2.5;
  const floats: { text: string; x: number; y: number; t: number; color: string }[] = [];
  let toast = { text: "", t: 0 }, banner = "";
  const say = (t: string) => { toast = { text: t, t: 3 }; };
  const box = (): Box => (leg === "out" ? T.storeBox : T.yardBox);
  // Pat on foot at the Rona (and at home with the tire)
  const pat = { x: 0, y: 0, a: 0, ph: 0, carry: null as "tire" | null, show: false };

  // ── input: the same fixed stick in the strip under the map ──
  type Stick = { id: number; bx: number; by: number; kx: number; ky: number };
  let stick: Stick | null = null, released: { bx: number; by: number; kx: number; ky: number; t: number } | null = null, testIn: [number, number] | null = null, auto = false, speedK = 1, thS = 0, thHeld = false;
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
    if (p.y < MH) { if (e.pointerType === "mouse" || fingers.size >= 2) return; fingers.set(e.pointerId, p); try { canvas.setPointerCapture(e.pointerId); } catch {} if (fingers.size === 2) pinch = { d: gap(), z: zoomK }; e.preventDefault(); return; }
    if (p.y < MH + 4 || stick) return;
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    const r = stickRest(); stick = { id: e.pointerId, bx: r.x, by: r.y, kx: 0, ky: 0 }; onMove(e); e.preventDefault();
  };
  const onUp = (e: PointerEvent) => { if (fingers.delete(e.pointerId) && fingers.size < 2) pinch = null; if (stick?.id === e.pointerId) { released = { bx: stick.bx, by: stick.by, kx: stick.kx, ky: stick.ky, t: performance.now() / 1000 }; stick = null; } };
  const KEYS: Record<string, string> = { KeyW: "u", ArrowUp: "u", KeyS: "d", ArrowDown: "d", KeyA: "l", ArrowLeft: "l", KeyD: "r", ArrowRight: "r" };
  const onKey = (e: KeyboardEvent) => { const k = KEYS[e.code]; if (!k) return; e.preventDefault(); keys[k] = e.type === "keydown"; };
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);
  window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey);
  function readStick(): [number, number] {
    if (auto) return autoInput();
    if (testIn) return testIn;
    if (stick) return [stick.kx / STICK_R, stick.ky / STICK_R];
    const ax = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), ay = (keys.d ? 1 : 0) - (keys.u ? 1 : 0), d = Math.hypot(ax, ay); return d ? [ax / d, ay / d] : [0, 0];
  }

  // ── the autopilot (tests only): follows the guide path for this leg with the same stick ──
  function autoInput(): [number, number] {
    if (leg === "shop") return [0, 0];
    const g = T.guides[leg === "out" ? "out" : "back"], a = T.along(g, x, y, gi); gi = a.i;
    const total = g.cum[g.cum.length - 1], left = total - a.s;
    const ptAt = (s: number) => { s = clamp(s, 0, total); let i = 1; while (i < g.cum.length - 1 && g.cum[i] < s) i++; const u = (s - g.cum[i - 1]) / Math.max(1e-6, g.cum[i] - g.cum[i - 1]), p = g.pts[i - 1], q = g.pts[i]; return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]; };
    const look = left < 9 ? Math.max(1.2, left) : 4.5 + Math.abs(v) * 0.55, [tx, ty] = ptAt(a.s + look);
    let turn = 0; for (let s = a.s; s < a.s + 10 + Math.abs(v) * 2.4; s += 2) { const p0 = ptAt(s), p1 = ptAt(s + 4), p2 = ptAt(s + 8), d = Math.abs(wrapA(Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) - Math.atan2(p1[1] - p0[1], p1[0] - p0[0]))) / 6; turn = Math.max(turn, d); }
    let vT = turn > 1e-3 ? Math.max(4.5, Math.sqrt((LAT * 0.8) / turn)) : VMAX; vT = Math.min(vT, VMAX, Math.sqrt(2 * 3.2 * Math.max(0, left - 0.4)) + 0.6);
    if (inBox || left < 0.5) return [0, 0];
    const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1, m = clamp(vT / VMAX, 0.12, 1);
    return [(dx / d) * m, (dy / d) * m];
  }

  // ── driving ──
  function arcClear(side: number) {   // room ahead for a full-lock U-turn that way?
    const R = WB / Math.tan(MAXSTEER);
    for (const a of [0.35, 0.8, 1.3, 1.9, 2.6]) { const px = x + R * (Math.sin(a) * Math.cos(h) - side * (1 - Math.cos(a)) * Math.sin(h)), py = y + R * (Math.sin(a) * Math.sin(h) + side * (1 - Math.cos(a)) * Math.cos(h)); if (T.clearAt(px, py) < 1.4 || T.surface(px, py) === "rough") return false; }
    return true;
  }
  function step(dt: number) {
    const live = phase === "ready" || (phase === "play" && leg !== "shop");
    const [ax, ay] = live ? readStick() : [0, 0], raw = Math.min(1, Math.hypot(ax, ay));
    if (phase === "ready" && raw > DEAD) { phase = "play"; hooks.onStart(); }
    let target = 0, steerT = 0, dec = COAST;
    if (revT > 0) { revT -= dt; target = -VREV; steerT = -uturn * MAXSTEER; dec = BRAKE; }
    else if (raw > DEAD && live) {
      const th = Math.atan2(ay, ax); if (!thHeld) { thS = th; thHeld = true; } else thS = wrapA(thS + wrapA(th - thS) * Math.min(1, dt * 18));
      const mag = (raw - DEAD) / (1 - DEAD), diff = wrapA(thS - h), back = Math.abs(wrapA(th - h)) > 2.25;
      if (uturn && Math.abs(diff) < 0.6) uturn = 0;
      if (back && !uturn && v > 7) { target = 0; dec = BRAKE; }   // pointing back at speed: brake first
      else {
        if (back && !uturn) { const pref = Math.abs(Math.abs(wrapA(th - h)) - Math.PI) < 0.45 ? 0 : Math.sign(wrapA(th - h)); const s = pref || (arcClear(1) || !arcClear(-1) ? 1 : -1); uturn = s; if (!arcClear(s)) { revT = 1.3; } }
        if (uturn) { target = 4.2; steerT = uturn * MAXSTEER; dec = BRAKE; }
        else { target = VMAX * mag * Math.max(0.2, Math.pow(Math.cos(Math.min(Math.abs(diff), 1.45)), 1.6)); steerT = clamp(diff * 1.9, -steerMax(v), steerMax(v)); dec = target < v - 0.5 ? BRAKE * (0.35 + 0.65 * Math.min(1, (v - target) / 8)) : COAST; }
      }
    } else { uturn = 0; thHeld = false; }
    target = Math.sign(target) * Math.min(Math.abs(target), CAP[surf]);
    if (phase === "scene" || phase === "over" || leg === "shop") { target = 0; dec = BRAKE; }
    braking = target < v - 1 && v > 1;
    v += clamp(target - v, -dec * dt, accel(v) * dt);
    if (Math.abs(v) > CAP[surf] + 0.2) v -= Math.sign(v) * Math.min(Math.abs(v) - CAP[surf], 9 * dt);
    steer += clamp(steerT - steer, -2.6 * dt, 2.6 * dt);
    h = wrapA(h + (v / WB) * Math.tan(steer) * dt);
    // move, then push out of anything solid (three circles down the car)
    const ox = x, oy = y; x += Math.cos(h) * v * dt; y += Math.sin(h) * v * dt;
    let hitN: [number, number] | null = null;
    for (const off of [1.45, 0, -1.45]) { const cx = x + Math.cos(h) * off, cy = y + Math.sin(h) * off, q = T.collide(cx, cy, 0.9); if (q.hit) { x += q.x - cx; y += q.y - cy; hitN = [q.nx, q.ny]; } }
    if (hitN) {
      const into = -(Math.cos(h) * hitN[0] + Math.sin(h) * hitN[1]) * v;
      if (into > 1.6 && bumpCool <= 0 && phase === "play") bump(x + Math.cos(h) * 2, y + Math.sin(h) * 2);
      v *= into > 1.6 ? 0.25 : 0.75;
    }
    const moved = Math.hypot(x - ox, y - oy), wanted = Math.abs(v) * dt;
    blockedT = wanted > 0.01 && moved < wanted * 0.4 ? blockedT + dt : Math.max(0, blockedT - dt * 2);
    if (uturn && blockedT > 0.25 && revT <= 0) { revT = 1.1; blockedT = 0; }
    else if (revT > 0 && blockedT > 0.25) { revT = 0; blockedT = 0; }
    // the road: off it is slow, and running off counts as a bump
    const s2 = T.surface(x, y);
    if (s2 === "rough" && surf !== "rough" && Math.abs(v) > 3.5 && phase === "play" && bumpCool <= 0) { bump(x, y); say("Stay On The Road"); }
    surf = s2;
    bumpCool -= dt; shake = Math.max(0, shake - dt); catSay = Math.max(0, catSay - dt);
    if (phase === "play" && leg !== "shop") simT += dt;
    // parking: in the box, lined up (either way round) and stopped for a moment
    if (phase === "play" && leg !== "shop") {
      const b = box(), dx = x - b.x, dy = y - b.y, lon = dx * Math.cos(b.a) + dy * Math.sin(b.a), lat = -dx * Math.sin(b.a) + dy * Math.cos(b.a);
      inBox = Math.abs(lon) < 0.8 && Math.abs(lat) < 0.6 && Math.abs(Math.sin(h - b.a)) < 0.26;
      parkT = inBox && Math.abs(v) < 0.4 ? parkT + dt : 0;
      if (parkT > 0.5) { parkT = 0; inBox = false; if (leg === "out") { leg = "shop"; shopT = 0; snd.chime(); say("Pat's Gone In For The Tire"); } else endRun(true); }
      if (simT >= limit) endRun(false);
    }
    if (leg === "shop") shopStep(dt);
    if (phase === "scene") {
      sceneT += dt;
      if (success) homeStep(dt);
      if (sceneT > (success ? 4 : 2.4) && !ended) { ended = true; phase = "over"; hooks.onEnd(outcome(success)); }
    }
    for (const f of floats) f.t -= dt; for (let i = floats.length - 1; i >= 0; i--) if (floats[i].t <= 0) floats.splice(i, 1);
    toast.t = Math.max(0, toast.t - dt);
  }
  function bump(bx: number, by: number) { bumps++; bumpCool = 1.4; shake = 0.25; snd.bump(); floats.push({ text: "Bump!", x: bx, y: by - 1.5, t: 1.4, color: "#ffd2cc" }); try { if (!auto) navigator.vibrate?.(14); } catch {} }
  const walkTo = (tx: number, ty: number, dt: number, sp = 3.2) => { const dx = tx - pat.x, dy = ty - pat.y, d = Math.hypot(dx, dy); if (d < 0.05) return true; const s = Math.min(d, sp * dt); pat.x += (dx / d) * s; pat.y += (dy / d) * s; pat.a = Math.atan2(dy, dx); pat.ph += s * 5.2; return s >= d - 1e-6; };
  const doorSide = (): [number, number] => [x - Math.sin(h) * -1.3 + Math.cos(h) * 0.2, y + Math.cos(h) * -1.3 + Math.sin(h) * 0.2];
  const trunk = (): [number, number] => [x - Math.cos(h) * 2.9, y - Math.sin(h) * 2.9];
  let shopSt = 0;
  function shopStep(dt: number) {
    shopT += dt;
    if (shopSt === 0) { [pat.x, pat.y] = doorSide(); pat.show = true; pat.carry = null; shopSt = 1; }
    else if (shopSt === 1) { if (walkTo(T.doors[0], T.doors[1], dt, 4.2)) { shopSt = 2; shopT = 0; pat.show = false; } }
    else if (shopSt === 2) { if (shopT > 0.9) { shopSt = 3; pat.show = true; pat.carry = "tire"; snd.coin(); floats.push({ text: "New Tire!", x: T.doors[0], y: T.doors[1] - 2, t: 1.6, color: "#fff4c2" }); } }
    else if (shopSt === 3) { const [tx, ty] = trunk(); if (walkTo(tx, ty, dt, 4.2)) { shopSt = 4; shopT = 0; pat.carry = null; snd.clank(); } }
    else if (shopSt === 4) { const [dx2, dy2] = doorSide(); if (shopT > 0.3 && walkTo(dx2, dy2, dt, 4.2)) { shopSt = 5; pat.show = false; leg = "back"; gi = 0; say("Now Home To The Barn"); } }
  }
  let homeSt = 0;
  function homeStep(dt: number) {
    if (homeSt === 0) { [pat.x, pat.y] = trunk(); pat.show = true; pat.carry = "tire"; homeSt = 1; catSay = 2.5; snd.meow(); }
    else if (homeSt === 1 && sceneT > 0.6) { if (walkTo(T.tractorAt[0] + 1.6, T.tractorAt[1] + 0.2, dt, 3.6)) { homeSt = 2; pat.carry = null; snd.clank(); } }
  }
  function endRun(ok: boolean) {
    if (phase !== "play") return;
    phase = "scene"; sceneT = 0; success = ok; uturn = 0; revT = 0; stick = null;
    if (ok) { snd.chime(); banner = "Home With The Tire!"; } else { snd.fail(); banner = "Out Of Time"; }
  }
  function progress() {
    if (leg === "shop") return 0.5;
    const g = T.guides[leg === "out" ? "out" : "back"], tot = g.cum[g.cum.length - 1], a = T.along(g, x, y, gi);
    return (leg === "out" ? 0 : 0.5) + 0.5 * clamp(a.s / tot, 0, 1);
  }
  function outcome(done: boolean): Outcome {
    return { job: job.id, done, secs: simT, limit, par, pct: done ? 1 : progress(), stars: [done, done && simT <= par, done && bumps === 0], meows: 0, bumps, apples: 0, applesTotal: 0, quality: 0, wet: 0, priorityOk: false,
      extra: { label: "Bumps", value: String(bumps) }, failLine: leg === "out" ? "Keep it on the road and brake before the corners. The Rona's lot is on the right, just before the houses start." : "Point back the way you came to turn round in the lot, then it's the same road home and up the lane to the barn." };
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
  const treeA: number[] = [];
  function draw(time: number, dt: number) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, CW, CH);
    const sp = Math.abs(v), viewM = (28 + Math.min(sp, VMAX) * 0.85) * zoomK;
    let S = Math.min(CW, MH) / viewM, tx = x + Math.cos(h) * v * 0.9, ty = y + Math.sin(h) * v * 0.9 + (MH / S) * 0.05;
    if (leg === "shop") { tx = (x + T.doors[0]) / 2; ty = (y + T.doors[1]) / 2; S = Math.min(CW, MH) / (36 * zoomK); }
    if ((phase === "scene" || phase === "over") && success) { tx = (x + T.tractorAt[0]) / 2; ty = (y + T.tractorAt[1]) / 2; S = Math.min(CW, MH) / 24; }
    if (!camS) { camS = S; camX = tx; camY = ty; }
    const k = 1 - Math.exp(-dt * 3.2); camX += (tx - camX) * k; camY += (ty - camY) * k; camS += (S - camS) * (1 - Math.exp(-dt * 1.6)); S = camS;
    const shx = shake > 0 ? (Math.random() - 0.5) * shake * 0.8 : 0, shy = shake > 0 ? (Math.random() - 0.5) * shake * 0.8 : 0;
    const ox = CW / 2 - (camX + shx) * S, oy = MH / 2 - (camY + shy) * S, vw = CW / S, vh = MH / S, vx0 = camX - vw / 2 - 4, vy0 = camY - vh / 2 - 4, vx1 = camX + vw / 2 + 4, vy1 = camY + vh / 2 + 4;
    const sx = (wx: number) => ox + wx * S, sy = (wy: number) => oy + wy * S;
    ctx.save(); rr(0, 0, CW, MH, 18); ctx.clip();
    ctx.save(); ctx.translate(ox, oy); ctx.scale(S, S);
    T.drawGround(ctx, vx0, vy0, vx1, vy1, T.aMain, time);
    // a warm fall wash over the ground
    ctx.save(); ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = `rgba(255,214,150,${(0.3 * (job.fall ?? 0.8)).toFixed(3)})`; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0); ctx.restore();
    if (phase !== "scene" && phase !== "over") T.drawBox(ctx, box(), 0.5 + 0.5 * Math.sin(time * 4));
    T.drawStanding(ctx, vx0, vy0, vx1, vy1);
    for (const sg of T.signs) sign(ctx, sg.p[0], sg.p[1], sg.out, sg.out === "Rona" ? "#1f5fae" : sg.out === "Springfield" ? "#2f5a1f" : "#2d6a3a", S);
    for (const pc of T.parked) drawCar(ctx, pc.x, pc.y, pc.a, 0, { body: pc.col });
    // the tractor waiting by the barn with its flat, and the cat keeping it company
    drawMower(ctx, T.tractorAt[0], T.tractorAt[1], 0, 0, 0, time, false, 0.62, paint, false, false, { empty: true });
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.ellipse(T.tractorAt[0] - 0.56, T.tractorAt[1] + 0.62, 0.34, 0.08, 0, 0, 7); ctx.fill();   // the flat, squashed out
    drawCat(ctx, { x: T.catAt[0], y: T.catAt[1], h: Math.atan2(y - T.catAt[1], x - T.catAt[0]), act: "sit", phase: 1 }, time, 2.2);
    drawCar(ctx, x, y, h, steer, { brake: braking, t: time });
    if (pat.show) { drawPat(ctx, pat.x, pat.y, pat.a, { walk: pat.ph, carry: pat.carry }, time); }
    if (pat.carry === null && homeSt === 2) drawTire(ctx, T.tractorAt[0] + 1.0, T.tractorAt[1] + 0.3, 0.3, 0);
    T.drawPoles(ctx, vx0, vy0, vx1, vy1);
    T.drawTrees(ctx, vx0, vy0, vx1, vy1, time, x, y, (i, near) => { treeA[i] = (treeA[i] ?? 0.96) + ((near ? 0.45 : 0.96) - (treeA[i] ?? 0.96)) * Math.min(1, dt * 8); return treeA[i]; });
    ctx.restore();
    // the target box: an arrow on the edge when it's off screen
    if (phase !== "scene" && phase !== "over" && leg !== "shop") {
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
    // the cat says goodbye, and hello when Pat's home
    if (catSay > 0 && (phase === "ready" || phase === "scene" || phase === "over" || simT < 3)) { const bx = sx(T.catAt[0]), by = sy(T.catAt[1]) - 26, a = Math.min(1, catSay * 3); ctx.save(); ctx.globalAlpha = a; pill("Meow!", bx, by, 13, "#2b3441", "#ffffff", 11, 24); ctx.restore(); }
    for (const f of floats) { const u = 1 - f.t / 1.4; ctx.save(); ctx.globalAlpha = Math.min(1, f.t * 2); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(30,40,20,0.55)"; ctx.font = `800 14px ${FONT}`; ctx.textAlign = "center"; ctx.strokeText(f.text, sx(f.x), sy(f.y) - u * 26); text(f.text, sx(f.x), sy(f.y) - u * 26, 14, f.color, 800); ctx.restore(); }
    // the minimap: the drive, home and the Rona, and a dot for the '67
    if (phase !== "scene" && phase !== "over") {
      const all = [...T.guides.out.pts], xs = all.map(p => p[0]), ys = all.map(p => p[1]), mx0 = Math.min(...xs) - 30, mx1 = Math.max(...xs) + 30, my0 = Math.min(...ys) - 30, my1 = Math.max(...ys) + 30;
      const mw = Math.min(112, CW * 0.3), ms = mw / (mx1 - mx0), mh = (my1 - my0) * ms, px0 = CW - mw - 9, py0 = 9;
      ctx.save(); ctx.fillStyle = "rgba(255,253,246,0.92)"; ctx.shadowColor = "rgba(0,0,0,0.18)"; ctx.shadowBlur = 8; rr(px0 - 4, py0 - 4, mw + 8, mh + 8, 9); ctx.fill(); ctx.restore();
      const mp = (p: [number, number]) => [px0 + (p[0] - mx0) * ms, py0 + (p[1] - my0) * ms];
      ctx.strokeStyle = "#8d9399"; ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); all.forEach((p, i) => { const q = mp(p as [number, number]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.stroke();
      { const q = mp([T.yardBox.x, T.yardBox.y]); ctx.fillStyle = "#b3302a"; ctx.fillRect(q[0] - 3.5, q[1] - 3.5, 7, 7); }   // home (the red barn)
      { const q = mp([T.storeBox.x, T.storeBox.y]); ctx.fillStyle = "#16467f"; ctx.fillRect(q[0] - 3.5, q[1] - 3.5, 7, 7); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.strokeRect(q[0] - 3.5, q[1] - 3.5, 7, 7); }   // the Rona
      const q = mp([x, y]); ctx.fillStyle = "#2f68b4"; ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(q[0], q[1], 2.4, 0, 7); ctx.fill();
    }
    if (toast.t > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, toast.t * 2, (3 - toast.t) * 5); ctx.font = `800 13px ${FONT}`; const tw = ctx.measureText(toast.text).width + 28; pill(toast.text, 52 + tw / 2, 26, 13, "#3d4654", "rgba(255,255,255,0.96)"); ctx.restore(); }
    if (phase === "ready") { const b = 1 + 0.035 * Math.sin(time * 4); ctx.save(); ctx.translate(CW / 2, MH - 30); ctx.scale(b, b); pill("Push The Stick To Start", 0, 0, 13, "#2f5a1f", "rgba(255,255,255,0.97)", 16, 32); ctx.restore(); }
    if (surf === "rough" && phase === "play" && leg !== "shop") pill("Back On The Road", CW / 2, MH - 30, 13, "#b03a2e", "rgba(255,255,255,0.95)", 16, 32);
    if (phase === "scene" && banner) { const t = sceneT, s2 = t < 0.35 ? 0.5 + (t / 0.35) * 0.62 : 1.12 - Math.min(0.12, (t - 0.35) * 0.6); ctx.save(); ctx.translate(CW / 2, Math.max(44, MH * 0.1)); ctx.scale(s2, s2); ctx.globalAlpha = Math.min(1, t * 4); pill(banner, 0, 0, 22, success ? "#2f6d1c" : "#a3352a", "rgba(255,255,255,0.97)", 22, 50); ctx.restore(); }
    ctx.restore();
    // the stick strip (the same look as the tractor's)
    ctx.fillStyle = "rgba(255,255,255,0.42)"; rr(0, MH + 8, CW, CH - MH - 8, 18); ctx.fill();
    const rest = stickRest(); let bx = rest.x, by = rest.y, kx = 0, ky = 0;
    if (stick) { bx = stick.bx; by = stick.by; kx = stick.kx; ky = stick.ky; }
    else if (released) { const u = clamp((time - released.t) / 0.28, 0, 1), e = 1 - Math.pow(1 - u, 3), spring = (1 - e) * Math.cos(u * Math.PI * 0.9); bx = released.bx + (rest.x - released.bx) * e; by = released.by + (rest.y - released.by) * e; kx = released.kx * spring; ky = released.ky * spring; if (u >= 1) released = null; }
    const kd = Math.hypot(kx, ky), on = kd > STICK_R * DEAD;
    ctx.save(); ctx.fillStyle = "rgba(255,255,255,0.78)"; ctx.shadowColor = "rgba(0,0,0,0.1)"; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(bx, by, STICK_R, 0, 7); ctx.fill(); ctx.restore();
    ctx.strokeStyle = "rgba(47,104,180,0.32)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, STICK_R, 0, 7); ctx.stroke();
    if (on) { ctx.strokeStyle = "rgba(47,104,180,0.55)"; ctx.lineWidth = 4; ctx.lineCap = "round"; const an = Math.atan2(ky, kx), spn = 0.55 * Math.min(1, kd / STICK_R) + 0.15; ctx.beginPath(); ctx.arc(bx, by, STICK_R - 1, an - spn, an + spn); ctx.stroke(); }
    const qx = bx + kx, qy = by + ky;
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.28)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3; const g = ctx.createRadialGradient(qx - KNOB_R * 0.35, qy - KNOB_R * 0.4, KNOB_R * 0.1, qx, qy, KNOB_R); g.addColorStop(0, "#5f93d6"); g.addColorStop(1, stick ? "#1f4f8f" : "#2f68b4"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(qx, qy, KNOB_R, 0, 7); ctx.fill(); ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.32)"; ctx.beginPath(); ctx.ellipse(qx - KNOB_R * 0.25, qy - KNOB_R * 0.35, KNOB_R * 0.45, KNOB_R * 0.28, -0.4, 0, 7); ctx.fill();
    if (on) { const an = Math.atan2(ky, kx); ctx.save(); ctx.translate(qx, qy); ctx.rotate(an); ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.beginPath(); ctx.moveTo(KNOB_R * 0.62, 0); ctx.lineTo(KNOB_R * 0.08, -KNOB_R * 0.36); ctx.lineTo(KNOB_R * 0.2, 0); ctx.lineTo(KNOB_R * 0.08, KNOB_R * 0.36); ctx.closePath(); ctx.fill(); ctx.restore(); }
    if (!stick && !released) { ctx.fillStyle = "rgba(255,255,255,0.95)"; for (let q = 0; q < 4; q++) { const an = (q * Math.PI) / 2; ctx.beginPath(); ctx.moveTo(rest.x + Math.cos(an) * STICK_R * 0.86, rest.y + Math.sin(an) * STICK_R * 0.86); ctx.lineTo(rest.x + Math.cos(an + 0.22) * STICK_R * 0.7, rest.y + Math.sin(an + 0.22) * STICK_R * 0.7); ctx.lineTo(rest.x + Math.cos(an - 0.22) * STICK_R * 0.7, rest.y + Math.sin(an - 0.22) * STICK_R * 0.7); ctx.fill(); } }
    if (!stick) text("Push Where You Want To Go", rest.x, CH - 9, 11, "#5a6b4f", 700);
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
    snd.engine({ on: phase === "ready" || (phase === "play" && leg !== "shop"), rpm: clamp(Math.abs(v) / VMAX * 0.9 + 0.1, 0, 1), blades: 0, load: Math.min(1, shake * 4) });
    const quiet = paused || document.hidden; if (quiet !== wasQuiet) { wasQuiet = quiet; snd.setPaused(quiet); }
    if (now - hudAt > 100) {
      hudAt = now;
      const g = T.guides[leg === "back" ? "back" : "out"], left = leg === "shop" ? 0 : g.cum[g.cum.length - 1] - T.along(g, x, y, gi).s;
      const done = (phase === "scene" || phase === "over") && success;
      const lead: Hud["lead"] = { label: leg === "out" ? "To The Rona" : leg === "shop" ? "At The Rona" : "To The Barn", value: done ? "Home" : leg === "shop" ? "Shopping" : inBox ? "Stop!" : fmtD(Math.max(0, left)) };
      hooks.onHud({ pct: done ? 1 : progress(), time: simT, limit, par, meter: { label: "Bumps", value: String(bumps), frac: 0, good: bumps === 0 }, canFinish: false, phase, lead });
    }
  };
  raf = requestAnimationFrame(loop);

  if (cfg.debug) {
    (window as unknown as { __lm: unknown }).__lm = {
      state: () => ({ mode: "job", job: job.id, phase, leg, x, y, h, v, steer, simT, bumps, limit, par, inBox, parkT, surf, uturn, revT, size: [CW, CH, MH], zoom: zoomK, box: box(), progress: progress(), penalty: 0, pct: progress(), meows: 0 }),
      hold: (hx: number, hy: number) => { testIn = [hx, hy]; }, release: () => { testIn = null; },
      auto: (on: boolean) => { auto = on; }, speed: (k: number) => { speedK = k; },
      tp: (tx: number, ty: number, th?: number) => { x = tx; y = ty; if (th !== undefined) h = th; v = 0; camX = x; camY = y; },
      win: () => { if (phase === "ready") phase = "play"; leg = "back"; endRun(true); },
      town: () => ({ yardBox: T.yardBox, storeBox: T.storeBox, doors: T.doors, guideOut: T.guides.out.cum.at(-1), guideBack: T.guides.back.cum.at(-1), L: T.L }),
      scr: (wx: number, wy: number) => [CW / 2 + (wx - camX) * camS, MH / 2 + (wy - camY) * camS],
    };
  }
  return () => {
    cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("resize", resize);
    canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp);
    window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey);
    if (hooks.zoomRef) hooks.zoomRef.current = null; snd.stop();
  };
}
