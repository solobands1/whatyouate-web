"use client";

// Pat's Lawnmower: a private little game for family and friends (not in the games list, the sitemap or search).
// Pat's Big Weekend is seven short jobs round the property, each with a twist and a clock; jobs pay cash for tractor
// upgrades in the shop. Free Mow is the whole lawn with no clock. The grey cat comes out of the house now and then;
// Pat always stops for her. Progress, stars, cash, upgrades and the sound setting are kept in this browser only.
// The yard is plain data in ./lawnMap; the game itself lives in ./lawn (engine, drawings, jobs, sounds).
/* eslint-disable react-hooks/set-state-in-effect --
   A real-time canvas game: the run lives in the engine, and React state only mirrors it for the HUD and the cards. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNoScroll } from "./kit";
import { startEngine, type Hud, type Mode } from "./lawn/engine";
import { JOBS, FREE_JOB, PAINTS, DECKS, DECK_NAMES, GEAR_NAMES, isPark, noMowing, loadout, loadoutLabel, loadSave, writeSave, newSave, shopItems, unlockedUpTo, payFor, type Save, type Outcome, type Job } from "./lawn/jobs";
import { Sound, renderEngineClip, toWav } from "./lawn/sound";
import { startHero } from "./lawn/hero";
import { startTravel } from "./lawn/travel";
import { startCar } from "./lawn/car";
import CardArt, { type CardArtKind } from "./lawn/CardArt";

type Screen = "title" | "jobs" | "shop" | "travel" | "intro" | "play" | "result";
type Session = { mode: Mode | "travel"; job: Job; n: number };
const isDebug = () => { try { return new URLSearchParams(window.location.search).get("debug") === "1"; } catch { return false; } };
const fmt = (s: number) => { const t = Math.max(0, Math.ceil(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const GREEN = "#3d8a26";
const SOUND = typeof window !== "undefined" ? new Sound() : null;   // makes no noise until the player turns sound on

const CSS = `
@keyframes plPop { 0% { transform: scale(.86); opacity: 0 } 60% { transform: scale(1.03); opacity: 1 } 100% { transform: scale(1) } }
@keyframes plUp { 0% { transform: translateY(26px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
@keyframes plStar { 0% { transform: scale(0) rotate(-40deg); opacity: 0 } 60% { transform: scale(1.35) rotate(10deg); opacity: 1 } 100% { transform: scale(1) rotate(0) } }
@keyframes plBurst { 0% { transform: scale(.4); opacity: .9 } 100% { transform: scale(2.2); opacity: 0 } }
@keyframes plFloat { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
@keyframes plFade { 0% { opacity: 0 } 100% { opacity: 1 } }
@keyframes plPulse { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.06) } }
.pl-btn { transition: transform .08s ease, box-shadow .08s ease; }
.pl-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0,0,0,.18) !important; }
`;

function Star({ on, size = 28, delay = 0, pop = false }: { on: boolean; size?: number; delay?: number; pop?: boolean }) {
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      {pop && on && <span className="absolute inset-0 rounded-full bg-[#ffd84d]" style={{ animation: `plBurst .6s ease-out ${delay + 0.15}s both` }} />}
      <svg viewBox="0 0 24 24" width={size} height={size} style={pop ? { animation: `plStar .5s cubic-bezier(.3,1.6,.5,1) ${delay}s both` } : undefined}>
        <path d="M12 2.2l2.9 6.1 6.7.8-4.9 4.6 1.3 6.6L12 17l-6 3.3 1.3-6.6L2.4 9.1l6.7-.8z" fill={on ? "#ffc928" : "#d9dfd2"} stroke={on ? "#d99a0b" : "#bfc7b6"} strokeWidth="1.4" strokeLinejoin="round" />
        {on && <path d="M9.2 8.6l2.8-5.4" stroke="#fff6c8" strokeWidth="1.6" strokeLinecap="round" opacity=".8" />}
      </svg>
    </span>
  );
}
function Btn({ children, onClick, color = GREEN, disabled = false, small = false, className = "" }: { children: ReactNode; onClick: () => void; color?: string; disabled?: boolean; small?: boolean; className?: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`pl-btn w-full rounded-2xl font-extrabold text-white disabled:opacity-45 ${small ? "py-2.5 text-[15px]" : "py-3.5 text-lg"} ${className}`}
      style={{ background: color, boxShadow: "0 4px 0 rgba(0,0,0,.2), inset 0 2px 0 rgba(255,255,255,.25)" }}>{children}</button>
  );
}
function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`rounded-[28px] bg-[#fffdf6] p-5 shadow-[0_18px_40px_rgba(20,40,10,.32)] ring-1 ring-black/5 [@media(max-height:700px)]:p-4 ${className}`} style={{ animation: "plPop .38s cubic-bezier(.2,1.3,.4,1) both", ...style }}>{children}</div>;
}
function Cash({ n, className = "" }: { n: number; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full bg-[#fff3c4] px-2.5 py-1 font-extrabold tabular-nums text-[#7a5a00] ${className}`}><span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#f2b81d] text-[10px] text-white">$</span>{n}</span>;
}
function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} aria-label={label} className="pl-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/85 text-[#3d7a26] shadow-[0_2px_0_rgba(0,0,0,.12)]">{children}</button>;
}
function SoundIcon({ muted }: { muted: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" />{muted ? <path d="M17 9l5 5m0-5l-5 5" /> : <><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a8.5 8.5 0 0 1 0 12" /></>}</svg>;
}
function CountUp({ to, delay = 0, onTick }: { to: number; delay?: number; onTick?: () => void }) {
  const [n, setN] = useState(0);
  const tick = useRef(onTick);
  useEffect(() => { tick.current = onTick; }, [onTick]);
  useEffect(() => {
    let raf = 0, start = 0, lastShown = 0;
    const t0 = setTimeout(() => {
      const run = (now: number) => { if (!start) start = now; const u = Math.min(1, (now - start) / 900), val = Math.round(to * (1 - Math.pow(1 - u, 3))); setN(val); if (val !== lastShown && val % 5 === 0) tick.current?.(); lastShown = val; if (u < 1) raf = requestAnimationFrame(run); };
      raf = requestAnimationFrame(run);
    }, delay * 1000);
    return () => { clearTimeout(t0); cancelAnimationFrame(raf); };
  }, [to, delay]);
  return <>{n}</>;
}
function ShopIcon({ id }: { id: string }) {
  const c = "#3d7a26";
  if (id === "deck") return <svg viewBox="0 0 32 32" width="30" height="30"><rect x="3" y="12" width="26" height="9" rx="4" fill="#454a50" /><rect x="11" y="9" width="10" height="15" rx="3" fill="#f26b1d" /><circle cx="6" cy="16.5" r="1.6" fill="#9a9ea3" /><circle cx="26" cy="16.5" r="1.6" fill="#9a9ea3" /></svg>;
  if (id === "gear") return <svg viewBox="0 0 32 32" width="30" height="30"><path d="M5 22a11 11 0 1 1 22 0" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" /><path d="M16 22l6-8" stroke="#f26b1d" strokeWidth="3" strokeLinecap="round" /><circle cx="16" cy="22" r="2.5" fill={c} /></svg>;
  if (id === "lights") return <svg viewBox="0 0 32 32" width="30" height="30"><path d="M8 13l17-6v18L8 19z" fill="#ffe28a" opacity=".7" /><circle cx="8" cy="16" r="5" fill="#fff6c8" stroke="#d9b440" strokeWidth="2" /></svg>;
  if (id === "bagger") return <svg viewBox="0 0 32 32" width="30" height="30"><rect x="7" y="8" width="18" height="18" rx="5" fill="#3f6a3a" /><path d="M10 13h12M10 17h12M10 21h12" stroke="#2f4a2c" strokeWidth="1.5" /><path d="M12 8c0-3 8-3 8 0" fill="none" stroke="#5d6166" strokeWidth="2" /></svg>;
  const p = PAINTS[id.replace("paint-", "")];
  return <svg viewBox="0 0 32 32" width="30" height="30"><path d="M16 4c5 7 8 11 8 15a8 8 0 0 1-16 0c0-4 3-8 8-15z" fill={p?.body ?? c} stroke="rgba(0,0,0,.2)" strokeWidth="1.5" /><circle cx="13" cy="19" r="2" fill="#fff" opacity=".5" /></svg>;
}

/** Pick from what's been bought: deck, gear, headlights, bagger, paint. Locked choices show what the shop sells. */
function Equipment({ save, set }: { save: Save; set: (fn: (s: Save) => Save) => void }) {
  const u = loadout(save);
  const row = (label: string, children: ReactNode) => (<div className="flex items-center gap-2 py-1.5"><span className="w-[74px] shrink-0 text-[12.5px] font-extrabold text-[#3f4f35]">{label}</span><span className="flex min-w-0 flex-1 flex-wrap gap-1.5">{children}</span></div>);
  const opt = (key: string | number, on: boolean, locked: boolean, onClick: () => void, children: ReactNode) => (
    <button key={key} disabled={locked} onClick={() => { SOUND?.unlock(); SOUND?.click(); onClick(); }} aria-pressed={on}
      className={`pl-btn rounded-full px-2.5 py-1.5 text-[12.5px] font-extrabold leading-none ${on ? "bg-[#3d8a26] text-white shadow-[0_2px_0_rgba(0,0,0,.18)]" : locked ? "bg-[#eceee8] text-[#a7af9f]" : "bg-[#e3eed7] text-[#2f5a1f]"}`}>
      {locked && <svg className="mr-1 inline -translate-y-px" width="9" height="10" viewBox="0 0 16 18" fill="currentColor"><rect x="1" y="8" width="14" height="10" rx="2.5" /><path d="M4 8V5.5a4 4 0 0 1 8 0V8" fill="none" stroke="currentColor" strokeWidth="2.4" /></svg>}{children}
    </button>);
  return (<div>
    {row("Deck", DECKS.map((d, i) => opt(i, u.deck === i, i > save.up.deck, () => set(s => ({ ...s, sel: { ...s.sel, deck: i } })), <>{DECK_NAMES[i]} {(d * 2).toFixed(1)} m</>)))}
    {row("Gear", GEAR_NAMES.map((g, i) => opt(i, u.gear === i, i > save.up.gear, () => set(s => ({ ...s, sel: { ...s.sel, gear: i } })), <>{g}</>)))}
    {row("Headlights", [false, true].map(v => opt(String(v), u.lights === v, v && !save.up.lights, () => set(s => ({ ...s, sel: { ...s.sel, lights: v } })), <>{v ? "On" : "Off"}</>)))}
    {row("Bagger", [false, true].map(v => opt(String(v), u.bagger === v, v && !save.up.bagger, () => set(s => ({ ...s, sel: { ...s.sel, bagger: v } })), <>{v ? "On" : "Off"}</>)))}
    {row("Paint", Object.entries(PAINTS).map(([k, p]) => { const owned = save.paints.includes(k); return (
      <button key={k} disabled={!owned} aria-label={p.name} aria-pressed={u.paint === k} onClick={() => { SOUND?.click(); set(s => ({ ...s, up: { ...s.up, paint: k } })); }}
        className="pl-btn relative flex h-7 w-7 items-center justify-center rounded-full" style={{ background: owned ? p.body : "#e3e6df", boxShadow: `inset 0 -3px 0 rgba(0,0,0,.18)${u.paint === k ? ", 0 0 0 2px #fffdf6, 0 0 0 4.5px #3d8a26" : ""}` }}>
        {!owned && <svg width="10" height="11" viewBox="0 0 16 18" fill={p.body}><rect x="1" y="8" width="14" height="10" rx="2.5" /><path d="M4 8V5.5a4 4 0 0 1 8 0V8" fill="none" stroke={p.body} strokeWidth="2.4" /></svg>}
        {u.paint === k && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
      </button>); }))}
  </div>);
}

export default function PatsLawnmower() {
  useNoScroll();
  const canvasRef = useRef<HTMLCanvasElement>(null), wrapRef = useRef<HTMLDivElement>(null);
  const [save, setSave] = useState<Save>(newSave);
  const [screen, setScreen] = useState<Screen>("title");
  const [session, setSession] = useState<Session>({ mode: "attract", job: FREE_JOB, n: 0 });
  const [hud, setHud] = useState<Hud | null>(null);
  const [held, setHeld] = useState(false);
  const [howTo, setHowTo] = useState(false);
  const [gearOpen, setGearOpen] = useState(false), gearAtOpen = useRef("");
  const [result, setResult] = useState<{ o: Outcome; pay: ReturnType<typeof payFor>; newBest: boolean; prevStars: number } | null>(null);
  const pausedRef = useRef(false);
  const finishRef = useRef<(() => void) | null>(null), zoomRef = useRef<((dir: number) => void) | null>(null);
  const paused = screen === "intro" || held || howTo || gearOpen;
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { const s = loadSave(); setSave(s); SOUND?.setMuted(s.muted); }, []);
  useEffect(() => {   // tests only: render a few seconds of the engine sound to a WAV file
    if (!isDebug()) return;
    (window as unknown as { __sound: unknown }).__sound = { clip: async (kind: "idle" | "cruise" | "full") => { const b = new Uint8Array(toWav(await renderEngineClip(kind))); let t = ""; for (let i = 0; i < b.length; i += 8192) t += String.fromCharCode(...b.subarray(i, i + 8192)); return btoa(t); } };
  }, []);
  useEffect(() => { const f = () => { if (document.hidden && screen === "play") setHeld(true); }; document.addEventListener("visibilitychange", f); return () => document.removeEventListener("visibilitychange", f); }, [screen]);
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; }, [save]);
  const update = (fn: (s: Save) => Save) => setSave(s => { const n = fn(s); writeSave(n); return n; });
  const sfx = () => { SOUND?.unlock(); SOUND?.click(); };

  // one engine per session: the title screen's tractor mowing by itself, or a job / Free Mow
  useEffect(() => {
    setHud(null);
    const s = saveRef.current;
    if (session.mode === "attract") return startHero(canvasRef.current!, wrapRef.current!, () => PAINTS[saveRef.current.up.paint] ?? PAINTS.orange, isDebug());
    if (session.mode === "travel") {   // the drive to the community centre (or home), then the job's card
      const job = session.job;
      return startTravel(canvasRef.current!, wrapRef.current!, { dir: job.twist === "unload" ? "home" : "out", paint: PAINTS[s.up.paint] ?? PAINTS.orange, debug: isDebug(), onDone: () => { setSession(ss => ({ mode: "job", job, n: ss.n + 1 })); setScreen("intro"); if (!saveRef.current.tutorial) setHowTo(true); } });
    }
    const run: typeof startEngine = session.job.twist === "tire" ? startCar : startEngine;   // the flat-tire job drives the car instead
    return run(canvasRef.current!, wrapRef.current!, { mode: session.mode, job: session.job, up: loadout(s), sound: SOUND!, debug: isDebug(), showStrip: true }, {
      paused: () => pausedRef.current,
      onHud: h => setHud(h),
      onStart: () => setScreen(sc => (sc === "intro" ? "play" : sc)),
      onEnd: o => {
        const s2 = saveRef.current, job = session.job, pay = payFor(job, o, s2), prevStars = job.id >= 0 ? s2.stars[job.id] : 0;
        const newBest = o.done && job.id < 0 && (s2.free.secs === null || o.secs < s2.free.secs);
        update(sv => {
          const n = { ...sv, cash: sv.cash + pay.total, stars: [...sv.stars], best: [...sv.best], free: { ...sv.free } };
          if (o.done && job.id >= 0) { n.stars[job.id] = Math.max(n.stars[job.id], o.stars.filter(Boolean).length); n.best[job.id] = n.best[job.id] === null ? o.secs : Math.min(n.best[job.id]!, o.secs); }
          if (o.done && job.id < 0 && (n.free.secs === null || o.secs < n.free.secs)) n.free.secs = o.secs;
          return n;
        });
        setResult({ o, pay, newBest, prevStars }); setScreen("result");
      },
      finishRef,
      zoomRef,
    });
  }, [session]);

  const goTitle = () => { sfx(); setHeld(false); setResult(null); setScreen("title"); if (session.mode !== "attract") setSession({ mode: "attract", job: FREE_JOB, n: session.n + 1 }); };
  const startJob = (job: Job) => {
    sfx(); setHeld(false); setResult(null);
    if (job.twist === "away" || job.twist === "unload") { setSession({ mode: "travel", job, n: session.n + 1 }); setScreen("travel"); return; }   // drive there first
    setSession({ mode: job.id < 0 ? "free" : "job", job, n: session.n + 1 }); setScreen("intro");
    if (!saveRef.current.tutorial) setHowTo(true);
  };
  const letsGo = () => { sfx(); setScreen("play"); };
  const toggleMute = () => { SOUND?.unlock(); const m = !save.muted; SOUND?.setMuted(m); update(s => ({ ...s, muted: m })); if (!m) setTimeout(() => SOUND?.click(), 50); };
  const buy = (id: string) => {
    SOUND?.unlock();
    const item = shopItems(save).find(i => i.id === id); if (!item) return;

    if (item.owned || save.cash < item.cost) return;
    SOUND?.coin();
    update(s => {
      const up = { ...s.up }, paints = [...s.paints], sel = { ...s.sel };   // a new buy goes straight on (it can be switched off in Equipment)
      if (id === "deck") sel.deck = ++up.deck; else if (id === "gear") sel.gear = ++up.gear; else if (id === "lights") up.lights = sel.lights = true; else if (id === "bagger") up.bagger = sel.bagger = true;
      else if (id.startsWith("paint-")) { paints.push(id.slice(6)); up.paint = id.slice(6); }
      return { ...s, cash: s.cash - item.cost, up, sel, paints };
    });
  };

  const inRun = screen === "intro" || screen === "play" || screen === "result";
  const job = session.job, totalStars = save.stars.reduce((a, b) => a + b, 0), open = unlockedUpTo(save);
  const timeLeft = hud ? (hud.limit ? hud.limit - hud.time : hud.time) : job.id >= 0 ? 0 : 0;
  const pctLabel = hud ? (hud.pct >= 1 ? "100" : (Math.floor(hud.pct * 1000) / 10).toFixed(1)) : "0.0";
  const nextJob = job.id >= 0 && job.id < JOBS.length - 1 && unlockedUpTo(save) > job.id ? JOBS[job.id + 1] : null;
  const art: CardArtKind | null = job.twist === "sticks" || job.twist === "leaves" || job.twist === "tire" || job.twist === "ride" ? job.twist : null;   // Pat's Fall Chores have a little picture on their cards
  const cardArt: CardArtKind | null = art ?? (job.twist === "plow" || job.twist === "wood" || job.twist === "xmas" || job.twist === "tidy" ? job.twist : null);   // (Chapter 4: and Pat's Winter)

  return (
    <main className="fixed inset-0 flex select-none flex-col overflow-hidden bg-gradient-to-b from-[#eef6e3] via-[#f3f8ec] to-[#b9dc98] text-[#1f2c17]"
      style={{ paddingTop: inRun ? "max(env(safe-area-inset-top), 10px)" : 0, paddingBottom: inRun ? "max(env(safe-area-inset-bottom), 10px)" : 0, paddingLeft: inRun ? 12 : 0, paddingRight: inRun ? 12 : 0 }}>
      <style>{CSS}</style>
      <div className={`mx-auto flex h-full w-full flex-col ${inRun ? "max-w-[440px]" : ""}`}>
        {inRun && (<>
          <div className="flex items-center gap-2">
            <IconBtn label="Pause" onClick={() => { sfx(); if (screen === "play") setHeld(true); else goTitle(); }}>
              {screen === "play" ? <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1.5" y="1" width="3" height="10" rx="1" /><rect x="7.5" y="1" width="3" height="10" rx="1" /></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>}
            </IconBtn>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#5a7a45]">{job.id >= 0 ? `Job ${job.id + 1} Of ${JOBS.length}` : "Free Mow"}{noMowing(job) ? "" : ` · ${((DECKS[loadout(save).deck] + (job.deckBonus ?? 0)) * 2).toFixed(1)} m Deck`}</div>
              <div className="truncate text-[17px] font-extrabold tracking-tight">{job.title}</div>
            </div>
            <IconBtn label={save.muted ? "Sound On" : "Sound Off"} onClick={toggleMute}><SoundIcon muted={save.muted} /></IconBtn>
          </div>
          <div className="mt-2 grid grid-cols-3 items-end gap-2">
            <div><div className="text-[10px] font-bold uppercase tracking-wide text-[#5a6b4f]">{hud?.lead ? hud.lead.label : "Mowed"}</div><div className="text-[22px] font-extrabold leading-none tabular-nums">{hud?.lead ? hud.lead.value : isPark(job) ? "-" : `${pctLabel}%`}</div></div>
            <div className="text-center"><div className="text-[10px] font-bold uppercase tracking-wide text-[#5a6b4f]">{hud?.limit ? "Time Left" : "Time"}</div>
              <div className={`text-[22px] font-extrabold leading-none tabular-nums ${hud?.limit && timeLeft < 15 ? "text-[#c0392b]" : ""}`} style={hud?.limit && timeLeft < 15 && screen === "play" ? { animation: "plFloat .5s ease-in-out infinite" } : undefined}>{hud ? fmt(Math.max(0, timeLeft)) : "-"}</div></div>
            <div className="text-right">{hud?.meter ? (<><div className="truncate text-[10px] font-bold uppercase tracking-wide text-[#5a6b4f]">{hud.meter.label}</div>
              <div className={`text-[18px] font-extrabold leading-none tabular-nums ${hud.meter.good ? "text-[#2f7d1f]" : "text-[#b4561a]"}`}>{hud.meter.value}</div></>)
              : (<><div className="text-[10px] font-bold uppercase tracking-wide text-[#5a6b4f]">Best</div><div className="text-[18px] font-extrabold leading-none tabular-nums">{save.free.secs !== null ? fmt(save.free.secs) : "-"}</div></>)}</div>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/70"><div className="h-full rounded-full bg-gradient-to-r from-[#6fbf3f] to-[#3d8a26] transition-[width] duration-200" style={{ width: `${isPark(job) ? (hud?.phase === "over" || screen === "result" ? 100 : 0) : (hud?.pct ?? 0) * 100}%` }} /></div>
        </>)}
        <div ref={wrapRef} className={`relative min-h-0 flex-1 touch-none ${inRun ? "mt-2" : ""}`}>
          <canvas ref={canvasRef} className="absolute left-0 top-0 block touch-none" />

          {/* ── title ── */}
          {screen === "title" && (
            <div className="absolute inset-0 flex flex-col" style={{ paddingTop: "max(env(safe-area-inset-top), 12px)", paddingBottom: "max(env(safe-area-inset-bottom), 14px)" }}>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#eef6e3] via-[#eef6e3]/70 to-transparent" />
              <div className="relative mx-auto flex w-full max-w-[440px] items-center justify-between px-4">
                <div className="flex items-center gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 font-extrabold tabular-nums text-[#7a5a00] shadow-sm"><Star on size={16} />{totalStars} / {JOBS.length * 3}</span><Cash n={save.cash} className="shadow-sm" /></div>
                <IconBtn label={save.muted ? "Sound On" : "Sound Off"} onClick={toggleMute}><SoundIcon muted={save.muted} /></IconBtn>
              </div>
              <div data-hero-top className="relative mx-auto mt-2.5 w-[calc(100%-32px)] max-w-[400px] rounded-[26px] bg-[#fffdf6]/92 px-4 pb-3 pt-2.5 text-center shadow-[0_10px_28px_rgba(30,60,15,.22)] ring-1 ring-black/5 backdrop-blur-[2px]" style={{ animation: "plUp .6s ease-out both" }}>
                <div className="text-[12px] font-extrabold uppercase tracking-[0.22em] text-[#5a8a3a]">Pat&apos;s Big Weekend</div>
                <h1 className="mt-0.5 whitespace-nowrap text-[clamp(30px,9.4vw,40px)] font-black leading-none tracking-tight text-[#24461a]">Pat&apos;s Lawnmower</h1>
              </div>
              <div className="flex-1" />
              <div data-hero-bottom className="relative mx-auto w-full max-w-[400px] space-y-2.5 px-6" style={{ animation: "plUp .6s ease-out .15s both" }}>
                <Btn onClick={() => { sfx(); setScreen("jobs"); }}>{totalStars ? "Continue The Weekend" : "Start The Weekend"}</Btn>
                <div className="grid grid-cols-2 gap-2.5">
                  <Btn small color="#f26b1d" onClick={() => startJob(FREE_JOB)}>Free Mow</Btn>
                  <Btn small color="#2f7fa8" onClick={() => { sfx(); setScreen("shop"); }}>Shop</Btn>
                </div>
              </div>
            </div>
          )}

          {/* ── job list ── */}
          {screen === "jobs" && (
            <div className="absolute inset-0 flex flex-col bg-[#183010]/55 backdrop-blur-[3px]" style={{ paddingTop: "max(env(safe-area-inset-top), 12px)", paddingBottom: "max(env(safe-area-inset-bottom), 12px)", animation: "plFade .2s both" }}>
              <div className="mx-auto flex w-full max-w-[440px] items-center gap-2 px-4">
                <IconBtn label="Back" onClick={goTitle}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg></IconBtn>
                <div className="flex-1 text-xl font-black text-white drop-shadow">Pat&apos;s Big Weekend</div>
                <Cash n={save.cash} />
              </div>
              <div className="mx-auto mt-3 w-full max-w-[440px] flex-1 space-y-2.5 overflow-y-auto px-4 pb-2">
                {JOBS.map((j, i) => {
                  const locked = i > open, stars = save.stars[i];
                  return (<div key={j.id}>
                    {j.chapter && <div className="px-1 pb-1.5 pt-2 text-[13px] font-extrabold uppercase tracking-[0.14em] text-white/90 drop-shadow">{j.chapter}</div>}
                    {i === 0 && <div className="px-1 pb-1.5 text-[13px] font-extrabold uppercase tracking-[0.14em] text-white/90 drop-shadow">Chapter 1: Home</div>}
                    <button disabled={locked} onClick={() => startJob(j)} className={`pl-btn flex w-full items-center gap-3 rounded-[22px] p-3 text-left shadow-[0_4px_0_rgba(0,0,0,.15)] ${locked ? "bg-[#e9ece3] text-[#7d8873]" : "bg-[#fffdf6]"}`} style={{ animation: `plUp .28s ease-out ${i * 0.03}s both` }}>
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white ${locked ? "bg-[#a9b39c]" : stars ? "bg-[#3d8a26]" : "bg-[#f26b1d]"}`}>
                        {locked ? <svg width="16" height="18" viewBox="0 0 16 18" fill="#fff"><rect x="1" y="8" width="14" height="10" rx="2.5" /><path d="M4 8V5.5a4 4 0 0 1 8 0V8" fill="none" stroke="#fff" strokeWidth="2.4" /></svg> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-extrabold">{j.title}</span>
                        <span className="block text-[12.5px] leading-snug text-[#5a6b4f]">{locked ? `Finish Job ${i} to unlock` : j.goal}</span>
                      </span>
                      <span className="flex shrink-0 gap-0.5">{[0, 1, 2].map(s => <Star key={s} on={stars > s} size={17} />)}</span>
                    </button>
                  </div>);
                })}
              </div>
            </div>
          )}

          {/* ── shop ── */}
          {screen === "shop" && (
            <div className="absolute inset-0 flex flex-col bg-[#183010]/55 backdrop-blur-[3px]" style={{ paddingTop: "max(env(safe-area-inset-top), 12px)", paddingBottom: "max(env(safe-area-inset-bottom), 12px)", animation: "plFade .2s both" }}>
              <div className="mx-auto flex w-full max-w-[440px] items-center gap-2 px-4">
                <IconBtn label="Back" onClick={goTitle}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg></IconBtn>
                <div className="flex-1 text-xl font-black text-white drop-shadow">Tractor Shop</div>
                <Cash n={save.cash} />
              </div>
              <div className="mx-auto mt-3 w-full max-w-[440px] flex-1 space-y-2.5 overflow-y-auto px-4 pb-2">
                <div className="rounded-[22px] bg-[#fffdf6] px-3 py-2.5 shadow-[0_4px_0_rgba(0,0,0,.15)]" style={{ animation: "plUp .28s ease-out both" }}>
                  <div className="flex items-baseline justify-between"><span className="text-[15.5px] font-extrabold">Equipment</span><span className="text-[11.5px] font-bold text-[#5a8a3a]">Pick what Pat takes out</span></div>
                  <Equipment save={save} set={update} />
                </div>
                <div className="px-1 pt-1 text-[13px] font-extrabold uppercase tracking-[0.14em] text-white/90 drop-shadow">For Sale</div>
                {shopItems(save).map((it, i) => {
                  const paint = it.id.startsWith("paint-"), equipped = paint && save.up.paint === it.id.slice(6), afford = save.cash >= it.cost;
                  return (
                    <div key={it.id} className="flex items-center gap-3 rounded-[22px] bg-[#fffdf6] p-3 shadow-[0_4px_0_rgba(0,0,0,.15)]" style={{ animation: `plUp .28s ease-out ${i * 0.03}s both` }}>
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef6e3]"><ShopIcon id={it.id} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15.5px] font-extrabold leading-tight">{it.name}</span>
                        {it.level && <span className="block text-[11px] font-bold text-[#5a8a3a]">{it.level}</span>}
                        <span className="block text-[12.5px] leading-snug text-[#5a6b4f]">{it.blurb}</span>
                      </span>
                      <span className="w-[84px] shrink-0">
                        {it.owned ? (paint && equipped ? <span className="block rounded-2xl bg-[#3d8a26] py-2.5 text-center text-[14px] font-extrabold text-white">On</span> : <span className="block rounded-2xl bg-[#e3eed7] py-2.5 text-center text-[14px] font-extrabold text-[#3d7a26]">Owned</span>)
                          : <Btn small color={afford ? "#f2a01d" : "#c5b9a0"} disabled={!afford} onClick={() => buy(it.id)}>${it.cost}</Btn>}
                      </span>
                    </div>
                  );
                })}
                <p className="px-2 pt-1 text-center text-[12.5px] font-semibold text-white/90 drop-shadow">Earn cash by finishing jobs. Replays pay half, plus extra for new stars.</p>
              </div>
            </div>
          )}

          {/* ── job intro ── */}
          {screen === "intro" && !howTo && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[18px] bg-[#183010]/40 p-3" style={{ animation: "plFade .2s both" }}>
              <Card className="max-h-full w-full max-w-[360px] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[#f26b1d] px-3 py-1 text-[12px] font-extrabold uppercase tracking-wider text-white">{job.id >= 0 ? `Job ${job.id + 1}` : "Free Mow"}</span>
                  {job.id >= 0 && <span className="flex gap-0.5">{[0, 1, 2].map(s => <Star key={s} on={save.stars[job.id] > s} size={18} />)}</span>}
                </div>
                {job.chapter && job.id >= 10 && <div className="mt-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#5a8a3a]">{job.chapter}</div>}
                <div className="mt-2 text-[26px] font-black leading-tight tracking-tight [@media(max-height:700px)]:mt-1.5 [@media(max-height:700px)]:text-[22px]">{job.title}</div>
                <div className="mt-1.5 space-y-1 text-[15px] leading-snug text-[#3f4f35] [@media(max-height:700px)]:mt-1 [@media(max-height:700px)]:text-[13.5px]">{job.intro.map((l, i) => <p key={i}>{l}</p>)}</div>
                {cardArt && <CardArt kind={cardArt} />}
                <div className="mt-3 rounded-2xl bg-[#eef6e3] px-3 py-2.5 text-[14px] [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:py-2 [@media(max-height:700px)]:text-[13px]">
                  <div className="flex items-center justify-between font-extrabold"><span>{job.goal}</span>{hud?.limit ? <span className="tabular-nums text-[#b4561a]">{fmt(hud.limit)}</span> : null}</div>
                  {job.id >= 0 && hud?.limit ? (
                    <ul className="mt-2 space-y-1 text-[13px] text-[#3f4f35] [@media(max-height:700px)]:mt-1 [@media(max-height:700px)]:space-y-0.5 [@media(max-height:700px)]:text-[12.5px]">
                      <li className="flex items-center gap-2"><Star on size={15} /> Finish before the clock runs out</li>
                      <li className="flex items-center gap-2"><Star on size={15} /> {job.star2 ?? `Finish in ${fmt(hud.par)} or less`}</li>
                      <li className="flex items-center gap-2"><Star on size={15} /> {job.star3}</li>
                    </ul>
                  ) : <div className="mt-1 text-[13px] text-[#3f4f35]">No clock. Best time: {save.free.secs !== null ? fmt(save.free.secs) : "none yet"}.</div>}
                </div>
                {job.twist !== "tire" && <div className="mt-2 flex items-center gap-2 rounded-2xl bg-[#f1f4ec] px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-[#3f4f35]">{loadoutLabel(loadout(save))}</span>
                  <button onClick={() => { sfx(); gearAtOpen.current = JSON.stringify(loadout(save)); setGearOpen(true); }} className="pl-btn shrink-0 rounded-full bg-[#2f7fa8] px-3 py-1 text-[12.5px] font-extrabold text-white shadow-[0_2px_0_rgba(0,0,0,.15)]">Equipment</button>
                </div>}
                {job.tip && <div className="mt-2 flex gap-2 rounded-2xl bg-[#fff6d6] px-3 py-2 text-[12.5px] leading-snug text-[#5c4a12] [@media(max-height:700px)]:py-1.5 [@media(max-height:700px)]:text-[12px]"><span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#f2b81d] text-[10px] font-black text-white">!</span><span>{job.tip}</span></div>}
                <div className="mt-4 grid grid-cols-[1fr_2fr] gap-2.5 [@media(max-height:700px)]:mt-3">
                  <Btn small color="#9aa58f" onClick={goTitle}>Menu</Btn>
                  <Btn small onClick={letsGo}>Let&apos;s Go</Btn>
                </div>
              </Card>
            </div>
          )}

          {/* ── equipment, from a job's card: changing it restarts the job's setup with the new loadout ── */}
          {gearOpen && (
            <div className="absolute inset-0 z-30 flex items-center justify-center rounded-[18px] bg-[#183010]/45 p-3" style={{ animation: "plFade .15s both" }}>
              <Card className="w-full max-w-[360px]">
                <div className="text-center text-[22px] font-black">Equipment</div>
                <div className="mt-2"><Equipment save={save} set={update} /></div>
                {job.deckBonus ? <p className="mt-1 text-[12px] text-[#5a6b4f]">This job adds the borrowed wide deck on top.</p> : null}
                <div className="mt-3"><Btn onClick={() => { sfx(); setGearOpen(false); if (JSON.stringify(loadout(saveRef.current)) !== gearAtOpen.current) setSession(ss => ({ ...ss, n: ss.n + 1 })); }}>Done</Btn></div>
              </Card>
            </div>
          )}

          {/* ── how to drive (first time) ── */}
          {howTo && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[18px] bg-[#183010]/45 p-3" style={{ animation: "plFade .2s both" }}>
              <Card className="w-full max-w-[360px]">
                <div className="text-center text-[24px] font-black">How To Drive</div>
                <ol className="mt-3 space-y-2.5 text-[15px] leading-snug">
                  {["Put your thumb in the strip under the lawn and push the way you want to go. Pat drives that way.",
                    "Point back the way you came and Pat makes a tight U-turn, right alongside the last stripe.",
                    "Watch for the grey cat. Pat always stops for her, and that costs a few seconds."].map((s, i) => (
                    <li key={i} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f26b1d] text-sm font-black text-white">{i + 1}</span><span>{s}</span></li>
                  ))}
                </ol>
                <p className="mt-3 text-center text-[12.5px] text-[#5a6b4f]">Pinch the map, or tap + and −, to zoom. On a computer, the arrow keys or WASD work too.</p>
                <div className="mt-4"><Btn onClick={() => { sfx(); setHowTo(false); update(s => ({ ...s, tutorial: true })); }}>Got It</Btn></div>
              </Card>
            </div>
          )}

          {/* ── zoom: small buttons in the map's top corner (the minimap has the other one) ── */}
          {(screen === "play" || screen === "intro") && !held && !howTo && hud?.phase !== "scene" && hud?.phase !== "over" && (
            <div className="absolute left-2 top-2 flex flex-col gap-1.5">
              {[["Zoom In", 1, "M12 6v12M6 12h12"], ["Zoom Out", -1, "M6 12h12"]].map(([label, dir, d]) => (
                <button key={label as string} aria-label={label as string} onClick={() => { sfx(); zoomRef.current?.(dir as number); }} className="pl-btn flex h-8 w-8 items-center justify-center rounded-full bg-white/88 text-[#3d7a26] shadow-[0_2px_0_rgba(0,0,0,.14)]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d={d as string} /></svg>
                </button>
              ))}
            </div>
          )}

          {/* ── finish button near the end: in the control strip, beside the stick, never over the lawn ── */}
          {screen === "play" && hud?.canFinish && !held && (
            <button onClick={() => finishRef.current?.()} aria-label="Finish Mowing" className="pl-btn absolute right-2.5 flex items-center gap-1.5 rounded-full py-2.5 pl-3 pr-4 text-[14px] font-extrabold text-white" style={{ bottom: 38, background: GREEN, boxShadow: "0 4px 0 rgba(0,0,0,.2)", animation: "plPulse 1.4s ease-in-out infinite" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>Finish
            </button>
          )}

          {/* ── pause ── */}
          {held && screen === "play" && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[18px] bg-[#183010]/45 p-4" style={{ animation: "plFade .15s both" }}>
              <Card className="w-full max-w-[300px] text-center">
                <div className="text-[24px] font-black">Paused</div>
                <div className="mt-4 space-y-2.5">
                  <Btn onClick={() => { sfx(); setHeld(false); }}>Resume</Btn>
                  <Btn small color="#f26b1d" onClick={() => startJob(job)}>Restart</Btn>
                  <Btn small color="#9aa58f" onClick={goTitle}>Quit To Menu</Btn>
                </div>
              </Card>
            </div>
          )}

          {/* ── results ── */}
          {screen === "result" && result && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[18px] bg-[#183010]/40 p-3" style={{ animation: "plFade .25s both" }}>
              <Card className="max-h-full w-full max-w-[360px] overflow-y-auto text-center">
                {result.o.done ? (<>
                  <div className="text-[13px] font-extrabold uppercase tracking-wider text-[#5a8a3a]">{job.id >= 0 ? `Job ${job.id + 1}` : "Free Mow"}</div>
                  <div className="text-[28px] font-black leading-tight">{job.endTitle ? job.endTitle : job.twist === "trailer" ? "Loaded Up!" : job.id >= 0 ? "Job Done!" : "Lawn Mowed!"}</div>
                  {job.id >= 0 ? (
                    <div className="mt-3 grid grid-cols-3 gap-1">
                      {[0, 1, 2].map(i => {
                        const labels = ["Finished", job.star2 ?? `Under ${fmt(result.o.par)}`, job.star3];
                        return (
                          <div key={i} className="flex flex-col items-center">
                            <span className="flex h-[56px] items-end"><Star on={result.o.stars[i]} size={i === 1 ? 54 : 44} delay={0.25 + i * 0.35} pop /></span>
                            <div className={`mt-1 text-[11.5px] font-bold leading-tight ${result.o.stars[i] ? "text-[#3f4f35]" : "text-[#9aa58f]"}`}>{labels[i]}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : result.newBest ? <div className="mx-auto mt-2 w-fit rounded-full bg-[#fff3c4] px-3 py-1 text-[13px] font-extrabold text-[#8a6a00]">New Best Time!</div> : null}
                  {cardArt && <CardArt kind={cardArt} done />}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-left">
                    <div className="rounded-2xl bg-[#eef6e3] px-3 py-2"><div className="text-[10.5px] font-bold uppercase tracking-wide text-[#5a6b4f]">Time</div><div className="text-[18px] font-extrabold tabular-nums">{fmt(result.o.secs)}</div></div>
                    <div className="rounded-2xl bg-[#eef6e3] px-3 py-2"><div className="text-[10.5px] font-bold uppercase tracking-wide text-[#5a6b4f]">{result.o.extra ? result.o.extra.label : job.twist === "apples" ? "Apples" : job.twist === "stripes" ? "Stripe Score" : job.twist === "away" ? "Outfield Stripes" : job.twist === "storm" ? "Puddle Time" : job.twist === "bonfire" ? "Big Bumps" : isPark(job) ? "Bumps" : job.twist === "guests" ? "Pits & Path" : "Cat Stops"}</div>
                      <div className="text-[18px] font-extrabold tabular-nums">{result.o.extra ? result.o.extra.value : job.twist === "apples" ? `${result.o.apples} / ${result.o.applesTotal}` : job.twist === "stripes" || job.twist === "away" ? `${Math.round(result.o.quality * 100)}%` : job.twist === "storm" ? `${result.o.wet.toFixed(1)}s` : job.twist === "bonfire" || isPark(job) ? result.o.bumps : job.twist === "guests" ? (result.o.priorityOk ? "Ready" : "Late") : result.o.meows}</div></div>
                  </div>
                  {job.twist !== "tire" && <div className="mt-2 text-[11.5px] font-bold text-[#7d8873]">{loadoutLabel(loadout(save))}</div>}
                  {job.endLine && <div className="mt-3 rounded-2xl bg-[#eef6e3] px-3 py-2 text-[14px] font-bold text-[#2f6d1c]" style={{ animation: "plUp .4s ease-out 1.2s both" }}>{job.endLine(save.stars.slice(job.chapterFrom ?? 0, job.id + 1).reduce((a, b) => a + b, 0), (job.id + 1 - (job.chapterFrom ?? 0)) * 3)}</div>}
                  <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-[#fff6d6] px-3 py-2.5" style={{ animation: "plUp .4s ease-out 1.3s both" }}>
                    <span className="text-[13px] font-bold text-[#7a5a00]">Pay</span>
                    <span className="text-[24px] font-black tabular-nums text-[#7a5a00]">+$<CountUp to={result.pay.total} delay={1.4} onTick={() => SOUND?.coin()} /></span>
                    {result.pay.bagger > 0 && <span className="text-[11px] font-bold text-[#9a7a20]">Incl. Bagger Bonus</span>}
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {nextJob ? <Btn onClick={() => startJob(nextJob)}>Next Job</Btn> : job.id === JOBS.length - 1 ? <Btn onClick={goTitle}>Back To The Farm</Btn> : null}
                    <div className="grid grid-cols-2 gap-2.5">
                      <Btn small color="#f26b1d" onClick={() => startJob(job)}>Play Again</Btn>
                      <Btn small color="#2f7fa8" onClick={() => { goTitle(); setTimeout(() => setScreen("shop"), 0); }}>Shop</Btn>
                    </div>
                  </div>
                </>) : (<>
                  <div className="text-[28px] font-black leading-tight text-[#a3352a]">{job.twist === "bonfire" ? "Too Dark To Mow" : job.twist === "storm" ? "Rained Out" : "Out Of Time"}</div>
                  {result.o.failLine ? <p className="mt-2 text-[15px] text-[#3f4f35]">{result.o.failLine}</p> : isPark(job) ? <p className="mt-2 text-[15px] text-[#3f4f35]">Line up straight first, then creep in slowly and stop inside the yellow box.</p> : (<>
                  <p className="mt-2 text-[15px] text-[#3f4f35]">You got {Math.floor(result.o.pct * 100)}% done. {job.twist === "bonfire" ? "Headlights from the shop help when the sun's going down." : "Long straight runs and U-turns at the ends are quickest."}</p>
                  <div className="mx-auto mt-3 h-3 w-full overflow-hidden rounded-full bg-[#eef0ea]"><div className="h-full rounded-full bg-[#f26b1d]" style={{ width: `${result.o.pct * 100}%` }} /></div></>)}
                  <div className="mt-4 grid grid-cols-[1fr_2fr] gap-2.5">
                    <Btn small color="#9aa58f" onClick={goTitle}>Menu</Btn>
                    <Btn small onClick={() => startJob(job)}>Try Again</Btn>
                  </div>
                </>)}
              </Card>
            </div>
          )}
        </div>
      </div>
      {result?.o.done && screen === "result" && job.id >= 0 && <StarSounds stars={result.o.stars} sound={SOUND} />}
    </main>
  );
}

/** Plays a little rising note as each earned star pops in. */
function StarSounds({ stars, sound }: { stars: boolean[]; sound: Sound | null }) {
  useEffect(() => {
    const ts = stars.map((on, i) => (on ? setTimeout(() => sound?.star(i), (0.3 + i * 0.35) * 1000) : 0));
    return () => ts.forEach(t => t && clearTimeout(t));
  }, [stars, sound]);
  return null;
}
