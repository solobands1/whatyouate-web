"use client";

// Food Rally: little food cars race 3 laps round kitchen courses (a countertop, the sink, the stovetop, fridge shelves,
// the pantry, the dinner table). Pick a car (potato, watermelon, blueberry, carrot or donut, each with its own feel)
// and a course. Hot sauce pads give a burst of speed, syrup and glowing burners slow you, flour puffs into a cloud that
// hides the track for a moment, and cars bump (the lighter one moves more).
// Controls, in a strip under the track so thumbs never cover the cars; the car speeds up by itself. Joystick (the
// default): push where you want to go on the screen and the car steers toward that heading (pointing back behind it
// brakes), with a Brake button beside it. Buttons (an option, remembered): Turn Left / Brake / Turn Right, which turn the
// car its own way. Keyboard: arrows or A / D turn, down, S or space brakes.
// "Today" is a 3-lap time trial on the day's course and car, the same for everyone, against a ghost of your best run
// today; score is 1,000 plus 100 a second under par. Free Play races 1 to 3 computer cars on the course and car you
// pick. "Same Phone": the phone lies flat, player 2's buttons at the top (upside down for them), both cars on one
// track, first to finish 3 laps wins (one race or best of 3). "Play A Friend": live on two phones; the host picks the
// course, each picks a car. The host phone runs the race (60 steps a second) and sends it 20 times a second; the guest
// sends its buttons, drives its own car straight away (prediction, gently corrected) and shows the host's car slightly
// in the past (interpolation). Transport (WebRTC with a Supabase fallback, rooms, stepping away, rejoining) is Pea
// Tanks' ./tankNet, used as is. Rules, courses and the computer drivers live in ./racerSim. No facts while racing; one
// fact about your car on the game-over card. Everything around the board comes from ./kit.
/* eslint-disable react-hooks/set-state-in-effect --
   A real-time canvas game: the race lives in the effect's closure and the room hook's refs, and React state only
   mirrors it for the cards around the board (same approach as the other canvas games). */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { appStoreLink } from "@/components/site";
import { type Mode, type Toast, GameScreen, GameHeader, BoardArea, PrizeLogo, GameOver, PauseButton, PausedCard, HelpModal, ModesHelp, ShellPopups,
  useGameShell, fitCanvas, loadImages, dailySeed, dailyNumber, torontoDate, readBest, saveBest, foodPng, mulberry32 } from "./kit";
import { AW, AH, LAPS, BOOST_T, CLOUD_T, CLOUD_R, FINISH_WAIT, CARS, COURSES, type Course, type Car, type World, type Input, type Brain, type Cloud,
  course, newWorld, stepWorld, driveCar, bump, aiInput, newBrain, freeBrains, standings, lapOf, lapTimes, trialPoints, racePoints, burnerOn, wrapAngle, NO_INPUT } from "./racerSim";
import { useTankRoom, savedSession, AWAY_MS, type RoomState, type Saved } from "./tankNet";
import { useDuel } from "./duels";

const GAME = "food-rally", TITLE = "Food Rally";
const LAUNCH = "2026-11-08";   // Today's Time Trial #1
const SALT = 0x5ac3d;          // keeps Today's course and car apart from the other games' daily seeds
const STEP_MS = 1000 / 60, COUNT_MS = 3000, GO_MS = 700, LABEL_MS = 3500, DONE_MS = 1700;
const CH = 112, CHL = 96;      // the button strip under the track (one strip, or one each end on Same Phone)
const FONT = "system-ui, -apple-system, sans-serif";
const BLUE = "#3f7fd6", RED = "#e8505b", GREEN = "#2eaa6e", ORANGE = "#f2994a", PURPLE = "#8e6bd6", INK = "#101b2e", GREY = "#5a6b85";
const CPU_COL = [GREEN, ORANGE, PURPLE];
const CAR_EMOJI = ["🥔", "🍉", "🫐", "🥕", "🍩"];
// art: the five cars, then the extras and the props' food
const IMG = ["1f954", "1f349", "1fad0", "1f955", "1f369", "1f336", "1f373", "1f944", "1f36f", "1f95c", "1f96b", "1f957", "1f35d", "1f952", "1f345", "1f9c5",
  "1f9fd", "1f34b", "1f9c2", "1f95b", "1f9c0", "1f95a", "1f35e"];
const II = Object.fromEntries(IMG.map((c, i) => [c, i])) as Record<string, number>;
const FACTS: Toast[] = [
  { title: "About Potatoes", body: "A medium potato with its skin has more potassium than a medium banana.", img: "1f954" },
  { title: "About Watermelon", body: "Watermelon is about 92% water, which is where it gets its name.", img: "1f349" },
  { title: "About Blueberries", body: "A cup of blueberries has about 3.5 grams of fibre.", img: "1fad0" },
  { title: "About Carrots", body: "A medium carrot has over half a day's vitamin A, as beta-carotene.", img: "1f955" },
  { title: "About Doughnuts", body: "A glazed doughnut has about 10 to 14 grams of sugar, around 3 teaspoons.", img: "1f369" },
];

type Play = { kind: "cpu" } | { kind: "local"; m: number; names: string[]; cars: number[]; ci: number; bo3: boolean } | { kind: "live"; code: string; me: 0 | 1; names: string[] };
type Phase = "idle" | "lobby" | "count" | "race" | "done" | "fin" | "over";
type Result = { place: number; of: number; secs: number; laps: number[]; ci: number; car: number; points: number; bestLap: number; newBest: boolean };
type Hud = { lap: number; place: number; of: number; laps: number[] };
type RaceEnd = { order: number[]; fin: number[]; laps: number[][]; dnf: boolean[] };
type Stick = { id: number; bx: number; by: number; kx: number; ky: number };
type Ctl = { left: Set<number>; right: Set<number>; brake: Set<number>; keys: Record<string, boolean>; stick: Stick | null };
type Controls = "stick" | "buttons";
type Snap = { k: number; at: number; ph: number; cl: number; a: number; C: number[][]; tm: number };
type Float = { text: string; car: number; color: string; age: number; life: number };
type NetMsg = { t: string; [k: string]: unknown };
type Engine = { onMsg: (m: NetMsg) => void; startMatch: () => void; onBack: () => void };
type Picks = { ci: number; car: number; n: number };

const newCtl = (): Ctl => ({ left: new Set(), right: new Set(), brake: new Set(), keys: {}, stick: null });
const readControls = (): Controls => { try { return localStorage.getItem(`${GAME}-controls`) === "buttons" ? "buttons" : "stick"; } catch { return "stick"; } };
const STICK_AREA = AW - 124;   // joystick mode: the stick has the strip's left side (as that player sees it), Brake the right
const q1 = (v: number) => Math.round(v * 10), q3 = (v: number) => Math.round(v * 1000);
function packCar(c: Car) { return [q1(c.x), q1(c.y), q3(c.h), q1(c.vx), q1(c.vy), Math.round(c.st * 100), Math.round(c.boostT * 100), c.pi, q1(c.prog), q1(c.best), c.fin >= 0 ? q3(c.fin) : -1, c.laps.length, Math.round(c.bump * 100), c.surf]; }
function unpackCar(a: number[], spec: number): Car {
  return { x: a[0] / 10, y: a[1] / 10, h: a[2] / 1000, vx: a[3] / 10, vy: a[4] / 10, st: a[5] / 100, boostT: a[6] / 100, pi: a[7], prog: a[8] / 10, best: a[9] / 10,
    fin: a[10] >= 0 ? a[10] / 1000 : -1, laps: new Array(a[11]).fill(0), spec, bump: a[12] / 100, surf: a[13] };
}
const isDebug = () => { try { return new URLSearchParams(window.location.search).get("debug") === "1"; } catch { return false; } };
const ord = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}` : s.toFixed(1));
const fmt2 = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}` : s.toFixed(2));
/** Today's course and car: the same for everyone. Day 1 is the easy one. */
function todayPick() {
  const n = dailyNumber(LAUNCH);
  if (n <= 1) return { ci: 0, car: 0 };
  const r = mulberry32(dailySeed(SALT));
  return { ci: Math.floor(r() * COURSES.length), car: Math.floor(r() * CARS.length) };
}
const readPicks = (): Picks => { try { const v = JSON.parse(localStorage.getItem(`${GAME}-picks`) || "null"); if (v && v.ci >= 0 && v.ci < 6 && v.car >= 0 && v.car < 5) return { ci: v.ci, car: v.car, n: Math.min(3, Math.max(1, v.n || 3)) }; } catch {} return { ci: 0, car: 0, n: 3 }; };
const ghostKey = () => `${GAME}-ghost-${torontoDate()}`;

export default function FoodRally() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("daily");
  const [run, setRun] = useState(0);
  const [play, setPlay] = useState<Play>({ kind: "cpu" });
  const [started, setStarted] = useState(false);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [raceEnd, setRaceEnd] = useState<RaceEnd | null>(null);
  const [wins, setWins] = useState([0, 0]);
  const [hud, setHud] = useState<Hud>({ lap: 1, place: 1, of: 1, laps: [1, 1] });
  const [best, setBest] = useState(0);
  const [fact, setFact] = useState<Toast | null>(null);
  const [board, setBoard] = useState({ w: 0, h: 0 });
  const [menu, setMenu] = useState<null | "friend" | "local" | "pick">(null);
  const [picks, setPicks] = useState<Picks>({ ci: 0, car: 0, n: 3 });
  const [code, setCode] = useState("");
  const [names, setNames] = useState(["", ""]);
  const [localCars, setLocalCars] = useState([0, 2]);
  const [localCi, setLocalCi] = useState(0);
  const [bo3, setBo3] = useState(true);
  const [ready, setReady] = useState({ me: false, them: false });
  const [again, setAgain] = useState({ me: false, them: false });
  const [liveOn, setLiveOn] = useState(false);
  const [livePick, setLivePick] = useState({ ci: 0, cars: [0, 2] });   // host's course, [host car, guest car]
  const [rejoin, setRejoin] = useState<Saved | null>(null);
  const [controls, setControlsState] = useState<Controls>("stick");
  const controlsRef = useRef<Controls>("stick"); controlsRef.current = controls;
  const setControls = (v: Controls) => { setControlsState(v); try { localStorage.setItem(`${GAME}-controls`, v); } catch {} };
  const [, setNow] = useState(0);
  const winsRef = useRef([0, 0]);   // Same Phone best of 3: wins carry over from race to race
  const shell = useGameShell(GAME, mode);
  const { reset: resetScores } = shell.scores;
  const duel = useDuel(shell, GAME, TITLE, mode, () => { if (mode !== "daily") { setMode("daily"); setRun(r => r + 1); } });   // Friend Duels on Today's time trial
  const pausedRef = useRef(false); pausedRef.current = shell.paused;
  const playRef = useRef(play); playRef.current = play;
  const picksRef = useRef(picks); picksRef.current = picks;
  const livePickRef = useRef(livePick); livePickRef.current = livePick;
  const startRef = useRef<() => void>(() => {});
  const engineRef = useRef<Engine | null>(null);
  const inbox = useRef<NetMsg[]>([]);
  const nameRef = useRef("Guest"); nameRef.current = shell.player?.name || "Guest";
  const onGame = useRef<(m: NetMsg) => void>(() => {});
  const net = useTankRoom(GAME, nameRef, onGame);
  const netRef = useRef(net); netRef.current = net;
  const rui = net.room;
  const flags = useRef({ ready, again, liveOn, raceEnd }); flags.current = { ready, again, liveOn, raceEnd };
  const meRef = useRef(0); meRef.current = play.kind === "live" ? play.me : 0;
  onGame.current = (m: NetMsg) => {
    if (m.t === "ready") setReady(r => ({ ...r, them: true }));
    else if (m.t === "again") setAgain(a => ({ ...a, them: true }));
    else if (m.t === "pick") {   // the friend changed their car (and the host, the course)
      const me = meRef.current;
      setLivePick(p => { const cars = p.cars.slice(); cars[1 - me] = m.car as number; return { ci: me === 1 && typeof m.ci === "number" ? (m.ci as number) : p.ci, cars }; });
    }
    else if (m.t === "_back") {   // both phones are here again: say where we were, and the host resyncs the race
      const f = flags.current, lp = livePickRef.current, me = meRef.current;
      netRef.current.send({ t: "pick", car: lp.cars[me], ...(me === 0 ? { ci: lp.ci } : {}) }, true);
      if (f.ready.me && !f.liveOn) netRef.current.send({ t: "ready" }, true);
      if (f.again.me && f.raceEnd) netRef.current.send({ t: "again" }, true);
      engineRef.current?.onBack();
    }
    else if (engineRef.current) engineRef.current.onMsg(m);
    else inbox.current.push(m);
  };
  const today = todayPick();
  const bestKey = mode === "daily" ? `foodrally-daily-${torontoDate()}` : "foodrally-endless";
  useEffect(() => { setBest(readBest(bestKey)); }, [bestKey]);
  useEffect(() => { setControlsState(readControls()); const p = readPicks(); setPicks(p); setLocalCi(p.ci); setLocalCars([p.car, p.car === 2 ? 4 : 2]); }, []);
  const choose = (p: Partial<Picks>) => setPicks(v => { const nv = { ...v, ...p }; try { localStorage.setItem(`${GAME}-picks`, JSON.stringify(nv)); } catch {} return nv; });

  // a shared link (?room=ABCD) joins that room (or rejoins it after a reload); a game saved in the last minute offers Rejoin
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? "", saved = savedSession(GAME);
    if (/^[A-Z]{4}$/.test(c)) { if (saved && saved.code === c) netRef.current.resume(saved); else netRef.current.join(c); }
    else if (saved) setRejoin(saved);
    const away = () => netRef.current.suspend();
    const back = (e: PageTransitionEvent) => { const sv = savedSession(GAME); if (e.persisted && sv) netRef.current.resume(sv); };
    window.addEventListener("pagehide", away); window.addEventListener("pageshow", back);
    return () => { window.removeEventListener("pagehide", away); window.removeEventListener("pageshow", back); away(); };
  }, []);
  useEffect(() => { if (!net.away) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [net.away]);

  // the room pairs up: a live match, starting with the Get Ready card; the room ends: back to the computer
  const roomS = rui?.s, roomCode = rui?.code, roomRole = rui?.role, roomFriend = rui?.friend;
  useEffect(() => {
    if (roomS === "paired" && roomCode && roomRole) {
      const me = roomRole === "host" ? 0 : 1, nm = [nameRef.current, roomFriend || "Guest"];
      setReady({ me: false, them: false }); setAgain({ me: false, them: false }); setLiveOn(false); setRaceEnd(null); setWins([0, 0]); setMenu(null);
      const mine = picksRef.current.car;
      setLivePick(p => { const cars = p.cars.slice(); cars[me] = mine; return { ci: me === 0 ? picksRef.current.ci : p.ci, cars }; });
      setPlay({ kind: "live", code: roomCode, me: me as 0 | 1, names: me === 0 ? nm : [nm[1], nm[0]] });
    } else if (roomS === "left" || roomS === "lost") { setRaceEnd(null); setLiveOn(false); setPlay({ kind: "cpu" }); }
  }, [roomS, roomCode, roomRole, roomFriend]);
  // tell the friend our picks once the pipe is up (and whenever they change before the race)
  const isLive = play.kind === "live", liveMe = play.kind === "live" ? play.me : 0;
  useEffect(() => {
    if (!isLive || net.mode === "connecting") return;
    net.send({ t: "pick", car: livePick.cars[liveMe], ...(liveMe === 0 ? { ci: livePick.ci } : {}) }, true);
  }, [isLive, liveMe, net.mode, livePick.ci, livePick.cars[liveMe]]);   // eslint-disable-line react-hooks/exhaustive-deps

  // the host starts the race when both have tapped I'm Ready (or both asked for a rematch) and the pipe is up
  const isHost = isLive && liveMe === 0;
  useEffect(() => {
    if (!isHost || net.mode === "connecting") return;
    if ((!liveOn && ready.me && ready.them) || (raceEnd && again.me && again.them)) engineRef.current?.startMatch();
  }, [isHost, net.mode, liveOn, ready, again, raceEnd]);

  const playKey = play.kind === "cpu" ? "cpu" : play.kind === "live" ? `live-${play.code}-${play.me}` : `local-${play.m}`;
  useEffect(() => {
    const P = playRef.current, cpu = P.kind === "cpu", live = P.kind === "live", local = P.kind === "local";
    const me = P.kind === "live" ? P.me : 0, host = live && me === 0, guest = live && me === 1;
    const TW = AW, TH = local ? AH + 2 * CHL : AH + CH, trackY = local ? CHL : 0;
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const { ctx, stop } = fitCanvas(canvas, wrap, TW, TH, setBoard, 0);
    const imgs = loadImages(IMG);
    const daily = mode === "daily", dbg = isDebug();
    const pnames = cpu ? ["You", "Computer", "Computer", "Computer"] : P.kind === "live" ? P.names.map((v, i) => (i === me ? "You" : v === "Guest" ? "Your Friend" : v)) : P.names;
    const said = (i: number) => pnames[i];
    const carCol = (i: number) => (cpu ? (i === 0 ? BLUE : CPU_COL[(i - 1) % 3]) : live ? (i === me ? BLUE : RED) : i === 0 ? BLUE : RED);

    // ── race state ──
    let phase: Phase = cpu ? "idle" : live ? "lobby" : "count", phaseT = COUNT_MS, goT = 0, labelT = LABEL_MS, finT = 0, matchNo = 0, firstFin = -1;
    let ci = 0, specs: number[] = [0], w: World = newWorld(0, [0]), brains: Brain[] = [], idleKey = "";
    const mw = local ? winsRef.current.slice() : [0, 0];
    let realStart = performance.now(), startedNow = !cpu, lastHud = "";
    // effects
    const floats: Float[] = [], seenEv = new Set<number>(), flash: number[] = [0, 0, 0, 0];
    let cache: HTMLCanvasElement | null = null, cacheKey = "";
    // Today's ghost: your best run today, a position every 3 steps
    let ghost: number[][] | null = null; const rec: number[][] = [];
    // live: host side
    const inBuf = new Map<number, Input>(); let lastApplied = 0, maxSeen = 0, flowing = false, lastGuestIn: Input = NO_INPUT, starve = 0;
    const recentEv: { tick: number; e: number[] }[] = [];
    // live: guest side
    const snaps: Snap[] = []; let clockOff: number | null = null, seq = 0, pred: Car | null = null, predOn = false, lastSnap: Snap | null = null, sendT = 0;
    const hist = new Map<number, Input>(); const off = { x: 0, y: 0, h: 0 }; let gClouds: Cloud[] = [];
    const visGuest = { x: 0, y: 0, h: 0, ok: false };
    const ctl: Ctl[] = [newCtl(), newCtl()];

    const sendNet = (m: object, reliable: boolean) => { if (live) netRef.current.send(m, reliable); };
    setOver(false); setResult(null); setRaceEnd(null); setFact(null); setStarted(!cpu); resetScores();
    if (!live) setWins(mw.slice());

    function build(nci: number, nspecs: number[], slots?: number[]) {
      ci = nci; specs = nspecs; w = newWorld(ci, specs, slots); cache = null;
      floats.length = 0; seenEv.clear(); recentEv.length = 0; visGuest.ok = false; firstFin = -1; finT = 0;
    }
    /** The computer field for Free Play: different cars from yours where possible, you at the back of the grid. */
    function cpuField(p: Picks) {
      const r = mulberry32(Math.floor(Math.random() * 1e9)), pool = [0, 1, 2, 3, 4].filter(c => c !== p.car);
      for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [pool[k], pool[j]] = [pool[j], pool[k]]; }
      const sp = [p.car, ...pool.slice(0, p.n)], slots = [p.n, ...Array.from({ length: p.n }, (_, k) => k)];
      brains = freeBrains(p.ci, p.n, Math.floor(r() * 1e9));
      return { sp, slots };
    }
    function idleWorld() {   // the course and cars on the grid behind the start card
      const p = picksRef.current, t = todayPick();
      const key = daily ? `d${t.ci}-${t.car}` : `f${p.ci}-${p.car}-${p.n}`;
      if (key === idleKey) return; idleKey = key;
      if (daily) build(t.ci, [t.car]); else { const f = cpuField(p); build(p.ci, f.sp, f.slots); }
    }
    function beginRace() {
      phase = "count"; phaseT = COUNT_MS; labelT = LABEL_MS; goT = 0; finT = 0; firstFin = -1;
      floats.length = 0; seenEv.clear(); rec.length = 0; lastHud = "";
      pushHud();
    }
    function pushHud() {
      const order = standings(w), mine = live ? me : 0, L = w.c.L;
      const h: Hud = { lap: lapOf(w.cars[mine], L), place: order.indexOf(mine) + 1, of: w.cars.length, laps: w.cars.slice(0, 2).map(c => lapOf(c, L)) };
      const key = `${h.lap}-${h.place}-${h.of}-${h.laps.join()}`;
      if (key !== lastHud) { lastHud = key; setHud(h); }
    }
    startRef.current = () => {
      if (startedNow) return;
      startedNow = true; realStart = performance.now(); setStarted(true);
      idleKey = ""; idleWorld();
      if (daily) { try { const g = JSON.parse(localStorage.getItem(ghostKey()) || "null"); ghost = g && g.ci === ci && g.car === specs[0] ? g.p : null; } catch { ghost = null; } }
      beginRace();
    };
    if (cpu) idleWorld();
    if (local) {
      const L = P as Extract<Play, { kind: "local" }>;
      matchNo = 1; build(L.ci, L.cars); beginRace();
    }

    // ── the end of a race ──
    function cpuFinished() {
      const car = w.cars[0], secs = car.fin, place = standings(w).indexOf(0), laps = lapTimes(car);
      const points = daily ? trialPoints(ci, secs) : racePoints(ci, place, secs);
      let newBest = false;
      if (daily) {   // keep the ghost of the best run today
        try { const g = JSON.parse(localStorage.getItem(ghostKey()) || "null"); if (!g || g.ci !== ci || secs < g.secs) { localStorage.setItem(ghostKey(), JSON.stringify({ ci, car: specs[0], secs, p: rec })); newBest = !!g; } } catch {}
      }
      setFact(FACTS[specs[0]]);
      setResult({ place, of: w.cars.length, secs, laps, ci, car: specs[0], points, bestLap: Math.min(...laps), newBest });
      setOver(true);
      if (points > readBest(bestKey)) { saveBest(bestKey, points); setBest(points); }
      shell.finishRef.current({ score: points, drops: LAPS, ms: performance.now() - realStart });
    }
    function endRace() {   // live (host) and same phone: everyone's in, or the wait ran out
      phase = "over";
      const order = standings(w), fin = w.cars.map(c => c.fin), laps = w.cars.map(c => lapTimes(c)), dnf = w.cars.map(c => c.fin < 0);
      const winner = order[0];
      if (local) { mw[winner]++; winsRef.current = mw.slice(); setWins(mw.slice()); }
      const end: RaceEnd = { order, fin, laps, dnf };
      setRaceEnd(end);
      if (host) { hostSnap(); sendNet({ t: "rend", m: matchNo, ...end }, true); }
    }

    // ── live: messages ──
    function startMatch() {
      if (!host) return;
      const lp = livePickRef.current;
      matchNo++; build(lp.ci, lp.cars.slice()); setRaceEnd(null); setAgain({ me: false, them: false }); setLiveOn(true);
      inBuf.clear(); flowing = false; lastGuestIn = NO_INPUT; lastApplied = maxSeen = 0;
      beginRace();
      sendNet({ t: "race", m: matchNo, ci, cars: specs }, true);
    }
    function guestRace(m: NetMsg) {
      matchNo = m.m as number; build(m.ci as number, (m.cars as number[]).slice());
      setRaceEnd(null); setAgain({ me: false, them: false }); setLiveOn(true);
      snaps.length = 0; lastSnap = null; predOn = false; pred = null; hist.clear(); off.x = off.y = off.h = 0; gClouds = [];
      beginRace();
    }
    function onMsg(m: NetMsg) {
      if (host) {
        if (m.t === "have") { if (matchNo === 0) fromHave(m); else sendSync(); return; }
        if (m.t === "i" && m.m === matchNo && (phase === "race" || phase === "fin")) {
          const runs = m.n as number[][], top = m.s as number;
          const low = top - runs.reduce((a, r) => a + r[0], 0) + 1;
          if (lastApplied === 0) lastApplied = low - 1;
          if (top - lastApplied > 90) { lastApplied = low - 1; inBuf.clear(); flowing = false; }   // fell far behind (a stall): skip ahead
          let sq = top;
          for (const [cnt, s, b, ax, ay] of runs) for (let j = 0; j < cnt; j++, sq--) if (sq > lastApplied && !inBuf.has(sq)) inBuf.set(sq, ax === -999 || ax === undefined ? { s: s / 100, b: !!b, q: sq } : { s: s / 100, b: !!b, ax: ax / 100, ay: ay / 100, q: sq });
          if (top > maxSeen) maxSeen = top;
        }
        return;
      }
      if (m.t === "sync") { onSync(m); return; }
      if (m.t === "need") { have(); return; }
      if (m.t === "race") { if ((m.m as number) > matchNo || phase === "lobby") guestRace(m); return; }
      if (m.t === "rend" && m.m === matchNo) {
        phase = "over"; predOn = false;
        (m.fin as number[]).forEach((f, i) => { if (w.cars[i]) w.cars[i].fin = f; });
        setRaceEnd({ order: m.order as number[], fin: m.fin as number[], laps: m.laps as number[][], dnf: m.dnf as boolean[] });
      } else if (m.t === "s" && m.m === matchNo) onSnap(m);
    }
    const phCode = () => (phase === "count" ? 0 : phase === "race" ? 1 : phase === "fin" ? 2 : phase === "over" ? 3 : 4);
    const fromCode = (n: number): Phase => (n === 0 ? "count" : n === 1 ? "race" : n === 2 ? "fin" : n === 3 ? "over" : "lobby");
    function fullState() {
      return { m: matchNo, ci, cars: specs, ph: phCode(), cl: Math.max(0, Math.round(phaseT)), k: w.tick, tm: q3(w.time), ft: q3(finT), C: w.cars.map(packCar),
        L: w.cars.map(c => c.laps), O: w.order.slice(), F: w.clouds.map(c => [c.id, Math.round(c.x), Math.round(c.y), q1(c.t)]), B: w.bagCd.map(q1) };
    }
    function loadState(m: NetMsg) {
      matchNo = m.m as number; build(m.ci as number, (m.cars as number[]).slice());
      const C = m.C as number[][], Ls = m.L as number[][];
      for (let i = 0; i < w.cars.length; i++) { Object.assign(w.cars[i], unpackCar(C[i], specs[i])); if (Ls) w.cars[i].laps = Ls[i].slice(); }
      w.time = (m.tm as number) / 1000; w.tick = m.k as number; w.order = ((m.O as number[]) ?? []).slice();
      w.clouds = ((m.F as number[][]) ?? []).map(f => ({ id: f[0], x: f[1], y: f[2], t: f[3] / 10 }));
      w.bagCd = ((m.B as number[]) ?? w.bagCd).map(v => v / 10);
      finT = ((m.ft as number) ?? 0) / 1000; firstFin = w.order.length ? w.order[0] : -1;
      phase = fromCode(m.ph as number); phaseT = (m.cl as number) || 0;
    }
    function sendSync() {
      lastApplied = maxSeen = 0; inBuf.clear(); flowing = false;
      sendNet({ t: "sync", ...fullState() }, true);
    }
    function onBack() {
      if (!host) return;
      if (matchNo > 0) sendSync(); else sendNet({ t: "need" }, true);   // a fresh page (reloaded): ask the guest where the race was
    }
    function fromHave(m: NetMsg) {   // host, after a reload: rebuild the race from the guest's last picture of it
      if ((m.m as number) <= 0) return;
      loadState(m); setLiveOn(true);
      if (phase === "over") endRace(); else pushHud();
      sendSync();
    }
    function onSync(m: NetMsg) {   // guest: the host's full picture after someone stepped away
      loadState(m);
      snaps.length = 0; lastSnap = null; clockOff = null; hist.clear(); off.x = off.y = off.h = 0; gClouds = w.clouds.slice();
      pred = { ...w.cars[me], laps: w.cars[me].laps.slice() }; predOn = phase === "race" || phase === "fin";
      if (phase === "lobby") return;
      setLiveOn(true);
      if (phase === "over") setRaceEnd({ order: standings(w), fin: w.cars.map(c => c.fin), laps: w.cars.map(c => lapTimes(c)), dnf: w.cars.map(c => c.fin < 0) });
      pushHud();
    }
    function have() {   // guest: answer the host's "need"
      const st = fullState();
      if (lastSnap) { st.C = lastSnap.C.map(a => a.slice()); if (pred) st.C[me] = packCar(pred); st.tm = lastSnap.tm; }
      sendNet({ t: "have", ...st }, true);
    }
    if (live) { engineRef.current = { onMsg, startMatch, onBack }; const q = inbox.current.splice(0); q.forEach(onMsg); }
    else engineRef.current = null;

    function onSnap(m: NetMsg) {
      const now = performance.now();
      const s: Snap = { k: m.k as number, at: now, ph: m.ph as number, cl: m.cl as number, a: m.a as number, C: m.C as number[][], tm: m.tm as number };
      if (lastSnap && s.k <= lastSnap.k) return;
      const sample = s.k - now / STEP_MS;
      clockOff = clockOff === null || Math.abs(sample - clockOff) > 40 ? sample : clockOff + (sample - clockOff) * 0.08;
      snaps.push(s); while (snaps.length > 40) snaps.shift();
      lastSnap = s;
      if (s.ph === 0 && phase === "count") phaseT = Math.min(phaseT, s.cl);
      if ((s.ph === 1 || s.ph === 2) && phase === "count") { phase = "race"; goT = GO_MS; }
      if (s.ph === 2 && phase === "race") phase = "fin";
      if (s.ph === 1 || s.ph === 2) predOn = true;
      w.time = s.tm / 1000; finT = ((m.ft as number) ?? 0) / 1000;
      gClouds = ((m.F as number[][]) ?? []).map(f => ({ id: f[0], x: f[1], y: f[2], t: f[3] / 10 }));
      for (let i = 0; i < w.cars.length; i++) {   // the host's word on laps and finishing
        const t = unpackCar(s.C[i], specs[i]), car = w.cars[i];
        car.best = t.best; car.prog = t.prog; car.pi = t.pi; car.fin = t.fin; car.laps = t.laps; car.boostT = t.boostT; car.surf = t.surf; car.bump = t.bump;
        if (t.fin >= 0 && firstFin < 0) firstFin = i;
      }
      for (const e of (m.E as number[][]) ?? []) { if (seenEv.has(e[0])) continue; seenEv.add(e[0]); showEvent(e[1], e[2], e[3]); }
      if (predOn) {   // reconcile my car: start from the host's copy and replay the inputs it hasn't used yet
        const server = unpackCar(s.C[me], specs[me]), other = unpackCar(s.C[1 - me], specs[1 - me]);
        for (const k of [...hist.keys()]) if (k <= s.a) hist.delete(k);
        const st = { ...server }, t0 = w.time;
        let k2 = 0;
        for (let k = s.a + 1; k <= seq; k++) { const inp = hist.get(k); if (inp) { driveCar(st, inp, w.c, t0 + k2 * STEP_MS / 1000, st.fin >= 0); bump(st, other, true); k2++; } }
        if (pred) {
          const ex = pred.x + off.x - st.x, ey = pred.y + off.y - st.y;
          if (ex * ex + ey * ey > 50 * 50) { off.x = off.y = off.h = 0; }
          else { off.x = ex; off.y = ey; off.h = wrapAngle(pred.h + off.h - st.h); }
        }
        pred = st;
      }
      pushHud();
    }
    function showEvent(k: number, car: number, n: number) {
      if (k === 1) flash[car] = 300;   // a bump
      else if (k === 2) {              // a lap
        const watch = local || car === me;
        if (watch) floats.push({ text: n === LAPS - 1 ? "Final Lap!" : `Lap ${n + 1}`, car, color: carCol(car), age: 0, life: 1400 });
      } else if (k === 3) {            // finished
        if (firstFin < 0) firstFin = car;
      }
    }

    // ── input ──
    const toLocal = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * TW, y: ((e.clientY - r.top) / r.height) * TH }; };
    const humans = cpu || live ? 1 : 2;
    function zone(c: number) {   // the strip for control set c (flipped for player 2 on Same Phone)
      if (!local) return { y0: AH, y1: AH + CH, flip: false };
      return c === 0 ? { y0: CHL + AH, y1: TH, flip: false } : { y0: 0, y1: CHL, flip: true };
    }
    const stickR = local ? 34 : 40;
    const isStick = () => controlsRef.current === "stick";
    /** Which button a point is on, as that player sees it: 0 left, 1 brake, 2 right (joystick mode: 3 the stick, 1 brake). */
    function btnAt(c: number, x: number) {
      const z = zone(c), vx = z.flip ? AW - x : x;
      if (isStick()) return vx < STICK_AREA ? 3 : 1;
      return vx < 136 ? 0 : vx > AW - 136 ? 2 : 1;
    }
    const clearPtr = (cl: Ctl, id: number) => { cl.left.delete(id); cl.right.delete(id); cl.brake.delete(id); if (cl.stick?.id === id) cl.stick = null; };
    function moveStick(st: Stick, p: { x: number; y: number }) {
      const dx = p.x - st.bx, dy = p.y - st.by, d = Math.hypot(dx, dy);
      st.kx = d > stickR ? (dx / d) * stickR : dx; st.ky = d > stickR ? (dy / d) * stickR : dy;
    }
    const onDown = (e: PointerEvent) => {
      const p = toLocal(e);
      for (let c = 0; c < humans; c++) {
        const z = zone(c);
        if (p.y < z.y0 - 6 || p.y > z.y1 + 6) continue;
        try { canvas.setPointerCapture(e.pointerId); } catch {}
        const b = btnAt(c, p.x), cl = ctl[c];
        if (b === 3) {   // the stick's base goes where the thumb lands
          if (cl.stick) return;
          const m = stickR * 0.8;
          cl.stick = { id: e.pointerId, bx: Math.max(m, Math.min(AW - m, p.x)), by: Math.max(z.y0 + m, Math.min(z.y1 - m, p.y)), kx: 0, ky: 0 };
          moveStick(cl.stick, p);
        } else (b === 0 ? cl.left : b === 2 ? cl.right : cl.brake).add(e.pointerId);
        e.preventDefault();
        return;
      }
    };
    const onMove = (e: PointerEvent) => {   // the stick follows the thumb; sliding from one button to the next works
      for (let c = 0; c < humans; c++) {
        const cl = ctl[c], p = toLocal(e);
        if (cl.stick?.id === e.pointerId) { moveStick(cl.stick, p); continue; }
        if (!cl.left.has(e.pointerId) && !cl.right.has(e.pointerId) && !cl.brake.has(e.pointerId)) continue;
        const z = zone(c);
        if (p.y < z.y0 - 30 || p.y > z.y1 + 30) continue;
        const b = btnAt(c, p.x); if (b === 3) continue;
        cl.left.delete(e.pointerId); cl.right.delete(e.pointerId); cl.brake.delete(e.pointerId);
        (b === 0 ? cl.left : b === 2 ? cl.right : cl.brake).add(e.pointerId);
      }
    };
    const onUp = (e: PointerEvent) => { for (const cl of ctl) clearPtr(cl, e.pointerId); };
    const KEYMAP: Record<string, [number, string]> = local
      ? { KeyA: [0, "l"], KeyD: [0, "r"], KeyS: [0, "b"], KeyW: [0, "x"], ArrowLeft: [1, "l"], ArrowRight: [1, "r"], ArrowDown: [1, "b"], ArrowUp: [1, "x"] }
      : { KeyA: [0, "l"], KeyD: [0, "r"], KeyS: [0, "b"], ArrowLeft: [0, "l"], ArrowRight: [0, "r"], ArrowDown: [0, "b"], Space: [0, "b"], KeyW: [0, "x"], ArrowUp: [0, "x"] };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const k = KEYMAP[e.code]; if (!k) return;
      e.preventDefault();
      ctl[k[0]].keys[k[1]] = e.type === "keydown";
    };
    /** The buttons, keys or stick for control set c. The stick is a direction on the screen (the same for everyone:
     *  player 2's strip is drawn upside down, but a push away from them is down the screen, and that's where they mean). */
    function readCtl(c: number): Input {
      const cl = ctl[c], l = cl.left.size > 0 || !!cl.keys.l, r = cl.right.size > 0 || !!cl.keys.r;
      const b = cl.brake.size > 0 || !!cl.keys.b || (l && r);
      if (cl.stick && Math.hypot(cl.stick.kx, cl.stick.ky) > 2 && !l && !r) return { s: 0, b, ax: Math.round((cl.stick.kx / stickR) * 100) / 100, ay: Math.round((cl.stick.ky / stickR) * 100) / 100 };
      return { s: l && r ? 0 : l ? -1 : r ? 1 : 0, b };
    }
    // the browser test (?debug=1) can hold a control set, or hand it to a computer driver
    const testIn: (Input | null)[] = [null, null], testAuto: (Brain | null)[] = [null, null], testStick = [false, false];
    function inputFor(c: number): Input {
      const auto = testAuto[c];
      if (auto) {
        const mine = live ? me : c, view = guest ? (pred ? { ...w, cars: w.cars.map((car, i) => (i === me ? pred! : car)) } : null) : w;
        if (!view) return NO_INPUT;
        const a = aiInput(view, auto, mine);
        if (!testStick[c]) return a;
        // as a joystick: point at a spot a little way up the track (what a thumb on the stick does)
        const car = view.cars[mine], cc = view.c, j = (car.pi + Math.round((22 + Math.hypot(car.vx, car.vy) * 0.35) / (cc.L / cc.n))) % cc.n;
        const an = Math.atan2(cc.cy[j] - car.y, cc.cx[j] - car.x);
        return { s: 0, b: a.b, ax: Math.round(Math.cos(an) * 100) / 100, ay: Math.round(Math.sin(an) * 100) / 100 };
      }
      return testIn[c] ?? readCtl(c);
    }
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey);

    // ── simulation ──
    function collectEvents() {
      for (const e of w.events) {
        const code = e.k === "boost" ? 0 : e.k === "bump" ? 1 : e.k === "lap" ? 2 : e.k === "finish" ? 3 : 4;
        if (code === 1) { flash[e.car] = 300; flash[e.n] = 300; } else showEvent(code, e.car, e.n);
        if (host && code !== 0 && code !== 4) recentEv.push({ tick: w.tick, e: [e.id, code, e.car, e.n] });
        if (host && code === 1) recentEv.push({ tick: w.tick, e: [e.id + 0.5, 1, e.n, 0] });
      }
      w.events.length = 0;
      while (recentEv.length && recentEv[0].tick < w.tick - 60) recentEv.shift();
    }
    function guestInputForHost(): Input[] {
      const target = netRef.current.netMode() === "relay" ? 7 : 2, avail = maxSeen - lastApplied, out: Input[] = [];
      if (!flowing && avail >= target) flowing = true;
      if (flowing) {
        const take = avail > target * 2 + 2 ? 2 : avail >= 1 ? 1 : 0;
        for (let j = 0; j < take; j++) { lastApplied++; const inp = inBuf.get(lastApplied); inBuf.delete(lastApplied); if (inp) lastGuestIn = inp; out.push(inp ?? { ...lastGuestIn, q: -1 }); }
        if (take === 0) flowing = false;
      }
      starve = out.length ? 0 : starve + 1;
      return out;
    }
    function tick() {
      if (phase === "idle") { idleWorld(); return; }
      if (phase === "count") {
        phaseT -= STEP_MS;
        if (phaseT <= 0 && !guest) { phase = "race"; goT = GO_MS; }
        if (host && w.tick % (netRef.current.netMode() === "relay" ? 6 : 3) === 0) hostSnap();
        if (host) w.tick++;
        return;
      }
      if (phase === "done") {   // vs computer: you've finished; the others keep going for a moment
        phaseT -= STEP_MS;
        stepWorld(w, w.cars.map((_, i) => (i === 0 ? NO_INPUT : aiInput(w, brains[i - 1], i, w.cars[0].best))));
        w.events.length = 0;
        if (phaseT <= 0) { phase = "over"; cpuFinished(); }
        return;
      }
      if (phase !== "race" && phase !== "fin") return;
      if (guest) { guestTick(); return; }
      let inputs: Input[];
      if (cpu) inputs = w.cars.map((_, i) => (i === 0 ? inputFor(0) : aiInput(w, brains[i - 1], i, w.cars[0].best)));   // they ease off when well ahead of you
      else if (local) inputs = [inputFor(0), inputFor(1)];
      else {
        const g = guestInputForHost();
        if (!g.length && starve > 60) return;   // a second with nothing from the guest: hold the race (the away card follows)
        while (g.length > 1) { const extra = g.shift()!; driveCar(w.cars[1], extra, w.c, w.time, w.cars[1].fin >= 0); }   // catching up on a backlog
        inputs = [inputFor(0), g[0] ?? (starve <= 8 ? { ...lastGuestIn, q: -1 } : { ...NO_INPUT, q: -1 })];
      }
      stepWorld(w, inputs);
      if (cpu && daily && w.tick % 3 === 0) rec.push([Math.round(w.cars[0].x), Math.round(w.cars[0].y), Math.round(w.cars[0].h * 100)]);
      collectEvents();
      pushHud();
      if (cpu) {
        if (w.cars[0].fin >= 0) { phase = "done"; phaseT = DONE_MS; }
      } else {
        if (firstFin < 0 && w.order.length) firstFin = w.order[0];
        if (firstFin >= 0) {
          if (phase === "race") phase = "fin";
          finT += STEP_MS / 1000;
          if (w.order.length >= w.cars.length || finT >= FINISH_WAIT) endRace();
        }
      }
      if (host && (phase as Phase) !== "over") { const relay = netRef.current.netMode() === "relay"; if (w.tick % (relay ? 6 : 3) === 0) hostSnap(); }
    }
    function hostSnap() {
      sendNet({ t: "s", m: matchNo, k: w.tick, ph: phCode(), cl: Math.max(0, Math.round(phaseT)), a: lastApplied, tm: q3(w.time), ft: q3(finT),
        C: w.cars.map(packCar), F: w.clouds.map(c => [c.id, Math.round(c.x), Math.round(c.y), q1(c.t)]), E: recentEv.map(r => r.e) }, false);
    }
    function guestTick() {
      if (!predOn || !pred) { if (predOn && lastSnap) pred = unpackCar(lastSnap.C[me], specs[me]); return; }
      if (lastSnap && performance.now() - lastSnap.at > 1000) return;   // nothing from the host for a second: hold still
      seq++;
      const inp = { ...inputFor(0), q: seq };
      hist.set(seq, inp);
      w.time += STEP_MS / 1000;
      driveCar(pred, inp, w.c, w.time, pred.fin >= 0 || w.cars[me].fin >= 0);
      const other = interpCar(1 - me); if (other) bump(pred, other, true);
      const relay = netRef.current.netMode() === "relay";
      if (++sendT >= (relay ? 6 : 2)) {
        sendT = 0;
        const n: number[][] = []; const span = relay ? 20 : 8;
        for (let k = seq; k > Math.max(0, seq - span); k--) {
          const v = hist.get(k); if (!v) break;
          const row = [Math.round(v.s * 100), v.b ? 1 : 0, v.ax === undefined ? -999 : Math.round(v.ax * 100), v.ay === undefined ? -999 : Math.round(v.ay * 100)], lr = n[n.length - 1];
          if (lr && lr[1] === row[0] && lr[2] === row[1] && lr[3] === row[2] && lr[4] === row[3]) lr[0]++; else n.push([1, ...row]);
        }
        sendNet({ t: "i", m: matchNo, s: seq, n }, false);
      }
    }
    function renderTick() {
      if (clockOff === null) return 0;
      return performance.now() / STEP_MS + clockOff - (netRef.current.netMode() === "relay" ? 14 : 7);
    }
    function bracket() {
      const rt = renderTick();
      let a: Snap | null = null, b: Snap | null = null;
      for (let k = snaps.length - 1; k >= 0; k--) { if (snaps[k].k <= rt) { a = snaps[k]; b = snaps[k + 1] ?? null; break; } }
      if (!a) { a = snaps[0] ?? null; b = null; }
      const f = a && b ? Math.max(0, Math.min(1, (rt - a.k) / (b.k - a.k))) : 0;
      return { a, b, f };
    }
    function interpCar(i: number): Car | null {
      const { a, b, f } = bracket();
      if (!a) return null;
      const ca = unpackCar(a.C[i], specs[i]); if (!b) return ca;
      const cb = unpackCar(b.C[i], specs[i]);
      return { ...cb, x: ca.x + (cb.x - ca.x) * f, y: ca.y + (cb.y - ca.y) * f, h: ca.h + wrapAngle(cb.h - ca.h) * f };
    }

    // ── loop ──
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (t: number) => {
      const dt = Math.max(0, Math.min(250, t - last)); last = t;
      const frozen = live ? netRef.current.isAway() : pausedRef.current || (!startedNow && phase !== "idle");
      if (!frozen) {
        acc += dt; let n = 0;
        while (acc >= STEP_MS && n < 12) { acc -= STEP_MS; n++; tick(); }
        if (n >= 12) acc = 0;
        if (goT > 0) goT -= dt;
        if (phase === "race" || phase === "count") labelT -= dt;
        for (let k = floats.length - 1; k >= 0; k--) { floats[k].age += dt; if (floats[k].age > floats[k].life) floats.splice(k, 1); }
        for (let i = 0; i < flash.length; i++) flash[i] = Math.max(0, flash[i] - dt);
        const decay = Math.exp(-dt / 110); off.x *= decay; off.y *= decay; off.h *= decay;
      } else ctl.forEach(c => { c.left.clear(); c.right.clear(); c.brake.clear(); c.stick = null; });
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    // ── drawing ──
    const rr = (x: number, y: number, ww: number, hh: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, ww, hh, r); };
    const text = (s: string, x: number, y: number, size: number, color: string, weight = 700, align: CanvasTextAlign = "center") => {
      ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "alphabetic"; ctx.fillText(s, x, y);
    };
    const img = (code: string) => { const im = imgs[II[code]]; return im?.complete && im.naturalWidth ? im : null; };
    function buildCourse(c: Course): HTMLCanvasElement {
      const k = canvas.width / TW, cv = document.createElement("canvas");
      cv.width = Math.round(AW * k); cv.height = Math.round(AH * k);
      const g = cv.getContext("2d")!; g.scale(k, k);
      drawScene(g, c, (code: string) => img(code));
      return cv;
    }
    function drawCar(car: Car, col: string, alpha: number, i: number, mine: boolean) {
      const sp = CARS[car.spec];
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(car.x, car.y);
      if (mine && alpha === 1) { ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 19, 0, 7); ctx.stroke(); }
      ctx.rotate(car.h);
      ctx.fillStyle = "rgba(40,30,20,0.22)"; rr(-13, -8, 29, 19, 7); ctx.fill();   // shadow
      if (car.boostT > 0 && alpha === 1) {   // a hot sauce flame out the back
        const f = car.boostT / BOOST_T;
        ctx.fillStyle = "rgba(255,120,30,0.85)"; ctx.beginPath(); ctx.moveTo(-14, -6); ctx.lineTo(-14 - 15 * f - 4, 0); ctx.lineTo(-14, 6); ctx.fill();
        ctx.fillStyle = "rgba(255,220,80,0.95)"; ctx.beginPath(); ctx.moveTo(-14, -3.5); ctx.lineTo(-14 - 9 * f - 2, 0); ctx.lineTo(-14, 3.5); ctx.fill();
      }
      ctx.fillStyle = "#2f3747";   // wheels
      for (const [wx, wy] of [[-11, -10.5], [5, -10.5], [-11, 6.5], [5, 6.5]]) { rr(wx, wy, 7, 4, 1.6); ctx.fill(); }
      ctx.fillStyle = col; rr(-14, -8, 28, 16, 6); ctx.fill();   // the kart
      ctx.fillStyle = "rgba(255,255,255,0.5)"; rr(9, -5.5, 4, 11, 2); ctx.fill();   // nose
      if (flash[i] > 0) { ctx.globalAlpha = alpha * Math.min(1, flash[i] / 300) * 0.6; ctx.fillStyle = "#fff"; rr(-14, -8, 28, 16, 6); ctx.fill(); ctx.globalAlpha = alpha; }
      const im = img(sp.emoji);
      if (im) { ctx.rotate(Math.PI / 2); ctx.drawImage(im, -10.5, -12, 21, 21); }
      ctx.restore();
    }
    function drawGhost() {
      if (!ghost || !cpu || !daily || (phase !== "race" && phase !== "done")) return;
      const g = ghost[Math.min(ghost.length - 1, Math.floor(w.tick / 3))]; if (!g) return;
      const car: Car = { ...w.cars[0], x: g[0], y: g[1], h: g[2] / 100, boostT: 0 };
      drawCar(car, "#9aa6b8", 0.35, 3, false);
      if (w.time < 4) { ctx.globalAlpha = Math.min(1, (4 - w.time) / 0.6); text("Ghost", car.x, car.y - 20, 10, GREY, 800); ctx.globalAlpha = 1; }
    }
    function drawStrip(c: number) {
      const z = zone(c), cy = (z.y0 + z.y1) / 2, hh = z.y1 - z.y0, cl = ctl[c], inp = readCtl(c);
      ctx.save();
      if (z.flip) { ctx.translate(AW / 2, cy); ctx.rotate(Math.PI); ctx.translate(-AW / 2, -cy); }
      const y0 = cy - hh / 2, top = y0 + (local ? 20 : 12), bh = hh - (local ? 26 : 22);
      const stickMode = isStick();
      const pressed = [cl.left.size > 0 || !!cl.keys.l, inp.b, cl.right.size > 0 || !!cl.keys.r];
      const boxes = stickMode ? [[AW - 116, 112]] : [[4, 128], [140, AW - 280], [AW - 132, 128]];
      if (stickMode) {   // the stick's pad, and its label
        ctx.fillStyle = "rgba(63,127,214,0.12)"; rr(4, top, STICK_AREA - 12, bh, 20); ctx.fill();
        text("Steer", 16, top + 17, 11, GREY, 800, "left");
      }
      boxes.forEach(([x, wd], bi) => {
        const b = stickMode ? 1 : bi;
        ctx.fillStyle = b === 1 ? (pressed[1] ? "#d24b55" : "#e8505b") : pressed[b] ? "#2f68b8" : BLUE;
        rr(x, top, wd, bh, 20); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.18)"; rr(x + 4, top + 4, wd - 8, bh * 0.4, 16); ctx.fill();
        const mx = x + wd / 2, my = top + bh / 2 - 6;
        if (b === 1) {   // brake: an octagon, the stop-sign shape
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 3.5; ctx.lineJoin = "round"; ctx.beginPath();
          for (let k = 0; k < 8; k++) { const an = Math.PI / 8 + (k * Math.PI) / 4; ctx.lineTo(mx + Math.cos(an) * 13, my + Math.sin(an) * 13); }
          ctx.closePath(); ctx.stroke();
          ctx.fillStyle = "#fff"; rr(mx - 6.5, my - 2, 13, 4, 2); ctx.fill();
          text("Brake", mx, top + bh - 9, 11, "#fff", 800);
        } else {   // a curved arrow over the top: anticlockwise for left, clockwise for right
          const left = b === 0, cx0 = mx, cy0 = my + 9, R = 16;
          const a0 = left ? -Math.PI / 6 : -Math.PI * 5 / 6, a1 = left ? -Math.PI * 5 / 6 : -Math.PI / 6;
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.lineCap = "round";
          ctx.beginPath(); ctx.arc(cx0, cy0, R, a0, a1, left); ctx.stroke();
          const ex = cx0 + Math.cos(a1) * R, ey = cy0 + Math.sin(a1) * R;
          const tx = left ? Math.sin(a1) : -Math.sin(a1), ty = left ? -Math.cos(a1) : Math.cos(a1);   // the way the arrow travels
          ctx.fillStyle = "#fff"; ctx.beginPath();
          ctx.moveTo(ex + tx * 9, ey + ty * 9); ctx.lineTo(ex - ty * 7 - tx * 2, ey + tx * 7 - ty * 2); ctx.lineTo(ex + ty * 7 - tx * 2, ey - tx * 7 - ty * 2); ctx.closePath(); ctx.fill();
          text(left ? "Turn Left" : "Turn Right", mx, top + bh - 9, 12, "#fff", 800);
        }
      });
      if (stickMode) {   // the stick itself, drawn where the thumb is (or resting in the middle of its pad)
        const st = cl.stick, restX = (STICK_AREA - 8) / 2 + 2, restY = top + bh / 2 - 5;
        const bx = st ? (z.flip ? AW - st.bx : st.bx) : restX, by = st ? (z.flip ? 2 * cy - st.by : st.by) : restY;
        const kx = st ? (z.flip ? -st.kx : st.kx) : 0, ky = st ? (z.flip ? -st.ky : st.ky) : 0;
        ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.beginPath(); ctx.arc(bx, by, stickR, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(63,127,214,0.4)"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = st ? "#2f68b8" : BLUE; ctx.beginPath(); ctx.arc(bx + kx, by + ky, stickR * 0.45, 0, 7); ctx.fill();
        if (!st) {
          ctx.fillStyle = "rgba(63,127,214,0.8)";
          for (let k = 0; k < 4; k++) { const an = (k * Math.PI) / 2, r1 = stickR * 0.86, r2 = stickR * 0.66; ctx.beginPath(); ctx.moveTo(bx + Math.cos(an) * r1, by + Math.sin(an) * r1); ctx.lineTo(bx + Math.cos(an + 0.28) * r2, by + Math.sin(an + 0.28) * r2); ctx.lineTo(bx + Math.cos(an - 0.28) * r2, by + Math.sin(an - 0.28) * r2); ctx.fill(); }
        }
      }
      if (local) {   // whose buttons these are, and their lap
        const car = w.cars[c], L = w.c.L, lap = car ? lapOf(car, L) : 1;
        text(`${pnames[c]} · ${car && car.fin >= 0 ? "Finished" : `Lap ${lap} Of ${LAPS}`}${P.kind === "local" && P.bo3 ? ` · ${mw[c]} ${mw[c] === 1 ? "Win" : "Wins"}` : ""}`, AW / 2, y0 + 14, 12, carCol(c), 800);
      } else if (live && netRef.current.netMode() === "relay") text("Slow Connection Mode", AW / 2, y0 + 9, 10, GREY, 700);
      ctx.restore();
    }
    function draw(t: number) {
      ctx.save(); ctx.clearRect(0, 0, TW, TH);
      for (let c = 0; c < humans; c++) drawStrip(c);
      // the course
      ctx.save(); rr(0, trackY, AW, AH, 18); ctx.clip(); ctx.translate(0, trackY);
      const key = `${canvas.width}-${ci}-${imgs.every(i => i.complete)}`;
      if (!cache || key !== cacheKey) { cache = buildCourse(w.c); cacheKey = key; }
      ctx.drawImage(cache, 0, 0, AW, AH);
      const c = w.c;
      for (const b of c.burners) {   // burners glow while they're hot (and warm up just before)
        const on = burnerOn(b, w.time), soon = !on && burnerOn(b, w.time + 0.7);
        if (on || soon) {
          const pulse = 0.75 + 0.25 * Math.sin(t / 140);
          ctx.strokeStyle = on ? `rgba(255,70,30,${0.85 * pulse})` : "rgba(255,150,60,0.45)"; ctx.lineWidth = 3;
          for (const r of [b.r * 0.45, b.r * 0.75, b.r]) { ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 7); ctx.stroke(); }
          if (on) { ctx.fillStyle = `rgba(255,90,40,${0.18 * pulse})`; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 3, 0, 7); ctx.fill(); }
        }
      }
      // the cars (the guest sees its own car straight away and the host's a moment in the past)
      const shown: (Car | null)[] = w.cars.map((car, i) => {
        if (!guest) {
          if (host && i === 1) {   // the guest's car moves in little bursts as its buttons arrive: smooth it a touch
            if (!visGuest.ok || Math.hypot(visGuest.x - car.x, visGuest.y - car.y) > 40) { visGuest.x = car.x; visGuest.y = car.y; visGuest.h = car.h; visGuest.ok = true; }
            else { visGuest.x += (car.x - visGuest.x) * 0.35; visGuest.y += (car.y - visGuest.y) * 0.35; visGuest.h += wrapAngle(car.h - visGuest.h) * 0.35; }
            return { ...car, x: visGuest.x, y: visGuest.y, h: visGuest.h };
          }
          return car;
        }
        if (i === me && pred && predOn) return { ...pred, x: pred.x + off.x, y: pred.y + off.y, h: pred.h + off.h, boostT: car.boostT };
        if (i === me && lastSnap) return unpackCar(lastSnap.C[i], specs[i]);
        if (i === me) return car;
        return interpCar(i) ?? car;
      });
      drawGhost();
      const mine = cpu ? 0 : live ? me : -1;
      const orderDraw = shown.map((_, i) => i).sort((a, b) => (a === mine ? 1 : b === mine ? -1 : 0));
      for (const i of orderDraw) { const s = shown[i]; if (s) drawCar(s, carCol(i), 1, i, i === mine); }
      // flour clouds hide the track nearby for a moment
      for (const cl of guest ? gClouds : w.clouds) {
        const a = Math.min(1, cl.t / 0.6, (CLOUD_T - cl.t) / 0.25 + 0.2);
        ctx.globalAlpha = 0.9 * a; ctx.fillStyle = "#fffdf8";
        for (let j = 0; j < 7; j++) { const an = j * 0.9 + cl.id, rr2 = CLOUD_R * (0.55 + 0.12 * Math.sin(j * 2.1 + cl.id)); ctx.beginPath(); ctx.arc(cl.x + Math.cos(an) * CLOUD_R * 0.45, cl.y + Math.sin(an) * CLOUD_R * 0.4, rr2, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      // names over the cars for the first few seconds (upright for whoever is looking)
      if (labelT > 0 && phase !== "idle") {
        for (let i = 0; i < shown.length; i++) {
          const s = shown[i]; if (!s) continue;
          if (cpu && i > 0) continue;   // the computer cars go by their colour
          const flip = local && i === 1, ly = flip ? s.y + 32 : s.y - 24;
          ctx.save(); ctx.globalAlpha = Math.min(1, labelT / 600);
          if (flip) { ctx.translate(s.x, ly); ctx.rotate(Math.PI); ctx.translate(-s.x, -ly); }
          text(pnames[i], s.x, ly, 11, carCol(i), 800); ctx.restore();
        }
        if (ghost && cpu && daily) text("Ghost: Your Best Today", AW / 2, AH - 6, 10, GREY, 700);
      }
      for (const f of floats) {
        const s = shown[f.car]; if (!s) continue;
        const flip = local && f.car === 1, fy = flip ? s.y + 30 + f.age * 0.015 : s.y - 22 - f.age * 0.015;
        ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, (1 - f.age / f.life) * 1.8));
        if (flip) { ctx.translate(s.x, fy); ctx.rotate(Math.PI); ctx.translate(-s.x, -fy); }
        ctx.fillStyle = "rgba(255,255,255,0.9)"; const tw = f.text.length * 7 + 14; rr(s.x - tw / 2, fy - 13, tw, 18, 9); ctx.fill();
        text(f.text, s.x, fy, 12, f.color, 800); ctx.restore();
      }
      // the race clock (not on Same Phone, where there's no one way up)
      if (!local && phase !== "idle" && phase !== "lobby") {
        const tt = phase === "count" ? 0 : cpu && w.cars[0].fin >= 0 ? w.cars[0].fin : live && (guest ? w.cars[me].fin : w.cars[me].fin) >= 0 ? w.cars[me].fin : w.time;
        ctx.fillStyle = "rgba(255,255,255,0.85)"; rr(AW / 2 - 34, 6, 68, 22, 11); ctx.fill();
        text(fmt(tt), AW / 2, 22, 14, INK, 800);
      }
      ctx.restore();

      // middle-of-track messages: countdown, Go!, finished (twice on Same Phone, one each way)
      let big = "", small = "";
      if (phase === "count") { big = String(Math.max(1, Math.ceil(phaseT / 1000))); small = `${c.name} · ${LAPS} Laps`; }
      else if (phase === "race" && goT > 0) big = "Go!";
      else if (phase === "done") { const pl = standings(w).indexOf(0) + 1; big = daily ? "Finished!" : pl === 1 ? "You Won!" : `You Finished ${ord(pl)}`; small = fmt2(w.cars[0].fin) + "s"; }
      else if (phase === "fin" && firstFin >= 0) {
        big = live ? (firstFin === me ? "You Won!" : `${said(firstFin)} Won`) : `${pnames[firstFin]} Wins!`;
        const left = Math.max(0, Math.ceil(FINISH_WAIT - finT));
        const other = w.cars.findIndex(cc => cc.fin < 0);
        small = other >= 0 ? `${live ? (other === me ? "Finish Your Laps" : `${said(other)} Is Finishing`) : `${pnames[other]}, Finish Your Laps`} · ${left}s` : "";
      }
      if (big) {
        const spots = local ? [[AH * 0.66, 0], [AH * 0.34, 1]] : [[AH * 0.42, 0]];
        for (const [yy, flip] of spots) {
          ctx.save(); const cy = trackY + yy;
          if (flip) { ctx.translate(AW / 2, cy); ctx.rotate(Math.PI); ctx.translate(-AW / 2, -cy); }
          const isNum = /^\d$/.test(big), bh = isNum ? 64 : 44;
          ctx.font = `800 13px ${FONT}`; const sw = small ? ctx.measureText(small).width + 28 : 0;
          const bwid = Math.min(AW - 24, Math.max(isNum ? 84 : 40 + big.length * 12.5, sw));
          ctx.fillStyle = "rgba(255,255,255,0.94)"; rr(AW / 2 - bwid / 2, cy - bh / 2 - (small ? 8 : 0), bwid, bh + (small ? 18 : 0), 18); ctx.fill();
          text(big, AW / 2, cy + (isNum ? 14 : 8) - (small ? 8 : 0), isNum ? 40 : 22, INK, 800);
          if (small) text(small, AW / 2, cy + bh / 2 + 4, 12, GREY, 700);
          ctx.restore();
        }
      }
      ctx.restore();
    }

    // the browser test peeks at the race and can hold a control set
    if (dbg) (window as unknown as { __fr: unknown }).__fr = {
      state: () => {
        const cars = w.cars.map((car, i) => { const s = guest && i === me && pred ? pred : guest && i !== me ? interpCar(i) ?? car : car;
          return { x: Math.round(s.x), y: Math.round(s.y), lap: lapOf(car, w.c.L), laps: car.laps.length, fin: car.fin >= 0 ? Math.round(car.fin * 100) / 100 : -1, best: Math.round(car.best) }; });
        return { phase, kind: P.kind, me, matchNo, tick: w.tick, time: Math.round(w.time * 100) / 100, ci, specs, cars, order: standings(w), wins: mw.slice(), firstFin,
          ghost: !!ghost, net: live ? netRef.current.netMode() : null, rtt: live ? Math.round(netRef.current.rtt()) : 0, off: Math.round(Math.hypot(off.x, off.y) * 10) / 10, seq, lastApplied };
      },
      hold: (c: number, inp: Input | null) => { testIn[c] = inp; },
      auto: (c: number, skill: number | null, stick = false) => { testAuto[c] = skill === null ? null : newBrain(Math.floor(Math.random() * 1e9), skill); testStick[c] = stick; },
      input: (c: number) => inputFor(c),
      stats: () => (live ? netRef.current.stats() : null),
      cut: (on: boolean) => netRef.current.cut(on),
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); stop();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey);
      engineRef.current = null;
    };
  }, [mode, run, playKey, bestKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  const n = dailyNumber(LAUNCH);
  const isCpu = play.kind === "cpu", isLocal = play.kind === "local";
  const me = liveMe;
  const pn = play.kind === "local" ? play.names : ["You", "Computer"];
  const friendRaw = play.kind === "live" ? play.names[1 - me] : "Guest";
  const friend = friendRaw === "Guest" ? "Your Friend" : friendRaw, friendLabel = friend;
  const curCi = mode === "daily" ? today.ci : picks.ci, curCar = mode === "daily" ? today.car : picks.car;
  const headline = !result ? "" : mode === "daily"
    ? `${fmt2(result.secs)}s on ${COURSES[result.ci].name}`
    : result.place === 0 ? "You Won The Race! 🎉" : `You Finished ${ord(result.place + 1)} Of ${result.of}`;
  const squares = (r: Result) => { const parLap = COURSES[r.ci].par / LAPS; return r.laps.map(l => (l <= parLap * 0.78 ? "🟩" : l <= parLap * 0.9 ? "🟨" : "🟥")).join(""); };
  const share = () => {
    if (!result) return;
    const label = mode === "daily" ? `${TITLE} #${n} (Today's Time Trial)` : `${TITLE} (Free Play)`;
    const p = shell.scores.posted;
    const rank = p?.rank ? `\n🏆 #${p.rank} of ${p.total} ${mode === "daily" ? "today" : "this week"}` : "";
    const place = mode === "daily" ? "" : ` · ${["🥇", "🥈", "🥉", "4th"][result.place]} of ${result.of}`;
    shell.share(`${label}\n${CAR_EMOJI[result.car]} ${CARS[result.car].name} on ${COURSES[result.ci].name}\n⏱️ ${fmt2(result.secs)}s · ${result.points.toLocaleString()} pts${place}${rank}\n${squares(result)} best lap ${fmt2(result.bestLap)}s\nCan you beat it? whatyouate.app/games/${GAME}`);
  };
  const toCpu = () => { if (isLive || rui) net.leave(); setRaceEnd(null); setMenu(null); setLiveOn(false); setPlay({ kind: "cpu" }); setRun(r => r + 1); };
  const openRoom = () => { setMenu(null); net.create(); };
  const joinRoom = () => { if (code.length === 4) { setMenu(null); net.join(code); } };
  const startLocal = () => {
    const nm = names.map((v, i) => v.trim().slice(0, 12) || `Player ${i + 1}`);
    setMenu(null); setRaceEnd(null); winsRef.current = [0, 0];
    setPlay({ kind: "local", m: (play.kind === "local" ? play.m : 0) + 1, names: nm, cars: localCars.slice(), ci: localCi, bo3 });
  };
  const localNext = (fresh: boolean) => { if (play.kind !== "local") return; setRaceEnd(null); if (fresh) { winsRef.current = [0, 0]; setWins([0, 0]); } setPlay({ ...play, m: play.m + 1 }); };
  const liveRematch = () => { setAgain(a => ({ ...a, me: true })); net.send({ t: "again" }, true); };
  const imReady = () => { setReady(r => ({ ...r, me: true })); net.send({ t: "ready" }, true); };
  const shareRoom = (c: string) => shell.share(`Race me in ${TITLE}! Room ${c}: ${window.location.origin}/games/${GAME}?room=${c}`);
  const setLiveCar = (car: number) => setLivePick(p => { const cars = p.cars.slice(); cars[me] = car; return { ...p, cars }; });
  const playing = isCpu ? started && !over : isLocal ? !raceEnd : false;
  const paired = rui?.s === "paired";
  const showRoomCard = rui && rui.s !== "paired";
  const awaySecs = net.away ? Math.max(0, Math.ceil((AWAY_MS - (Date.now() - net.away.since)) / 1000)) : 0;
  const localSeries = play.kind === "local" && play.bo3;
  const seriesOver = localSeries && (wins[0] >= 2 || wins[1] >= 2);

  return (
    <GameScreen>
      <GameHeader title={TITLE} mode={mode} onMode={m => { toCpu(); setMode(m); }} onBoard={() => shell.setBoardOpen(true)} onHelp={shell.help.show} />

      <div className="mt-2 flex items-center justify-between gap-2">
        {isCpu ? (<>
          <div><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Lap</div><div className="text-2xl font-bold leading-none tabular-nums">{Math.min(hud.lap, LAPS)}<span className="text-base text-[#5a6b85]">/{LAPS}</span></div></div>
          <div className="min-w-0 truncate rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold text-[#3f7fd6]">
            {mode === "daily" ? `Time Trial · ${CARS[curCar].name}` : started ? `${ord(hud.place)} Of ${hud.of}` : COURSES[curCi].name}
          </div>
        </>) : (<>
          <div className="min-w-0"><div className="truncate text-[10px] uppercase tracking-wide text-[#5a6b85]">{isLive ? "You" : pn[0]}</div><div className="text-2xl font-bold leading-none tabular-nums text-[#3f7fd6]">{isLocal && localSeries ? wins[0] : <>{Math.min(LAPS, hud.laps[isLive ? me : 0] ?? 1)}<span className="text-base text-[#5a6b85]">/{LAPS}</span></>}</div></div>
          <div className="min-w-0 truncate rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold text-[#3f7fd6]">{play.kind === "live" ? `Live · Room ${play.code}` : localSeries ? "Same Phone · Best Of 3" : "Same Phone"}</div>
        </>)}
        <div className="flex items-center gap-2">
          {isCpu ? <div className="text-right"><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Best</div><div className="text-lg font-semibold leading-none tabular-nums">{best.toLocaleString()}</div></div>
            : <div className="min-w-0 text-right"><div className="max-w-[110px] truncate text-[10px] uppercase tracking-wide text-[#5a6b85]">{isLive ? friendLabel : pn[1]}</div><div className="text-2xl font-bold leading-none tabular-nums text-[#e8505b]">{isLocal && localSeries ? wins[1] : <>{Math.min(LAPS, hud.laps[isLive ? 1 - me : 1] ?? 1)}<span className="text-base text-[#5a6b85]">/{LAPS}</span></>}</div></div>}
          <PauseButton shell={shell} active={playing} />
        </div>
      </div>

      <BoardArea wrapRef={wrapRef} size={board} reserve={0}>
        <canvas ref={canvasRef} className="block touch-none" />
        <PrizeLogo shell={shell} active={isCpu && started && !over && !shell.paused && !menu && !rui} />
        <PausedCard shell={shell} active={playing} />

        {isCpu && !started && !over && !menu && !rui && !rejoin && (
          <Card>
            {mode === "daily" ? (<>
              <div className="text-lg font-bold">Today&apos;s Time Trial #{n}</div>
              <p className="mt-1 text-sm text-[#5a6b85]">Three laps, same course and car for everyone. Beat your own ghost.</p>
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#f0f6fe] p-2 text-left">
                <CourseThumb ci={today.ci} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{COURSES[today.ci].name}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={foodPng(CARS[today.car].emoji)} alt="" className="h-6 w-6" />{CARS[today.car].name}
                  </div>
                  <Stats car={today.car} />
                </div>
              </div>
              <ControlsToggle value={controls} onChange={setControls} />
              <button onClick={() => startRef.current()} className="mt-3 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Start The Time Trial</button>
            </>) : (<>
              <div className="text-lg font-bold">Free Play</div>
              <CoursePick ci={picks.ci} onChange={ci => choose({ ci })} />
              <CarPick car={picks.car} onChange={car => choose({ car })} />
              <div className="mt-3 flex items-center justify-between gap-2 text-sm font-semibold">
                <span className="text-[#5a6b85]">Computer Cars</span>
                <div className="flex rounded-full bg-[#f0f6fe] p-0.5 text-xs">
                  {[1, 2, 3].map(k => <button key={k} onClick={() => choose({ n: k })} className={`rounded-full px-3 py-1.5 font-bold ${picks.n === k ? "bg-[#3f7fd6] text-white" : "text-[#3f7fd6]"}`}>{k}</button>)}
                </div>
              </div>
              <ControlsToggle value={controls} onChange={setControls} />
              <button onClick={() => startRef.current()} className="mt-3 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Race</button>
            </>)}
            <div className="mt-2 flex gap-2">
              <button onClick={() => setMenu("friend")} className="flex-1 rounded-full bg-[#e3effe] py-3 text-sm font-semibold text-[#3f7fd6]">Play A Friend</button>
              <button onClick={() => setMenu("local")} className="flex-1 rounded-full bg-[#e3effe] py-3 text-sm font-semibold text-[#3f7fd6]">Same Phone</button>
            </div>
          </Card>
        )}

        {menu === "pick" && isCpu && (
          <Card>
            <div className="text-lg font-bold">Change Car Or Course</div>
            <CoursePick ci={picks.ci} onChange={ci => choose({ ci })} />
            <CarPick car={picks.car} onChange={car => choose({ car })} />
            <button onClick={() => { setMenu(null); setRun(r => r + 1); }} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Done</button>
          </Card>
        )}

        {menu === "friend" && !rui && (
          <Card>
            <div className="text-xl font-bold">Play A Friend</div>
            <p className="mt-1 text-sm text-[#5a6b85]">Race live on two phones. Make a room and send your friend the link.</p>
            <button onClick={openRoom} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Make A Room</button>
            <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#5a6b85]">Got A Code?</div>
            <div className="mt-1 flex gap-2">
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))} placeholder="ABCD" autoCapitalize="characters" autoComplete="off" spellCheck={false}
                onKeyDown={e => { if (e.key === "Enter") joinRoom(); }}
                className="w-0 min-w-0 flex-1 rounded-xl border border-[#d6e2f5] px-3 py-2.5 text-center font-mono text-lg font-bold tracking-[0.3em] outline-none focus:border-[#3f7fd6]" />
              <button onClick={joinRoom} disabled={code.length !== 4} className="rounded-full bg-[#e3effe] px-5 font-semibold text-[#3f7fd6] disabled:opacity-50">Join</button>
            </div>
            <button onClick={() => setMenu(null)} className="mt-3 w-full py-2 text-sm font-semibold text-[#5a6b85]">Back</button>
          </Card>
        )}

        {menu === "local" && (
          <Card>
            <div className="text-xl font-bold">Same Phone</div>
            <p className="mt-1 text-[13px] leading-snug text-[#5a6b85]">Lay the phone flat between you. Player 2 plays from the top end. First to finish {LAPS} laps wins.</p>
            {[0, 1].map(i => (
              <div key={i} className="mt-2.5">
                <input value={names[i]} maxLength={12} placeholder={i === 0 ? "Player 1 (Bottom)" : "Player 2 (Top)"} autoComplete="off"
                  onChange={e => setNames(v => v.map((x, j) => (j === i ? e.target.value : x)))}
                  className="w-full rounded-xl border border-[#d6e2f5] px-3 py-2 text-base outline-none focus:border-[#3f7fd6]" />
                <CarRow car={localCars[i]} color={i === 0 ? BLUE : RED} onChange={car => setLocalCars(v => v.map((x, j) => (j === i ? car : x)))} />
              </div>
            ))}
            <CoursePick ci={localCi} onChange={setLocalCi} compact />
            <div className="mt-2.5 flex rounded-full bg-[#f0f6fe] p-0.5 text-xs font-bold">
              {[false, true].map(v => <button key={String(v)} onClick={() => setBo3(v)} className={`flex-1 rounded-full py-1.5 ${bo3 === v ? "bg-[#3f7fd6] text-white" : "text-[#3f7fd6]"}`}>{v ? "Best Of 3" : "One Race"}</button>)}
            </div>
            <ControlsToggle value={controls} onChange={setControls} />
            <button onClick={startLocal} className="mt-3 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Start</button>
            <button onClick={() => setMenu(null)} className="mt-1 w-full py-2 text-sm font-semibold text-[#5a6b85]">Back</button>
          </Card>
        )}

        {showRoomCard && rui && <RoomCard rui={rui} copied={shell.copied} onShare={() => shareRoom(rui.code)} onCancel={toCpu} onBack={() => { net.dismiss(); setMenu("friend"); }} onNew={openRoom} />}

        {rejoin && !rui && !menu && (
          <Card>
            <div className="text-xl font-bold">Rejoin Your Game?</div>
            <p className="mt-2 text-sm text-[#5a6b85]">You were racing {rejoin.friendName === "Guest" ? "your friend" : rejoin.friendName} in room {rejoin.code}.</p>
            <button onClick={() => { const r = rejoin; setRejoin(null); if (savedSession(GAME)) net.resume(r); }} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Rejoin Your Game</button>
            <button onClick={() => { setRejoin(null); try { localStorage.removeItem(`${GAME}-live`); sessionStorage.removeItem(`${GAME}-live`); } catch {} }} className="mt-2 w-full py-2 text-sm font-semibold text-[#5a6b85]">Not Now</button>
          </Card>
        )}

        {isLive && paired && net.away && (
          <Card>
            <div className="text-xl font-bold">{net.away.who === "friend" ? `${friend} Stepped Away...` : "Reconnecting..."}</div>
            <p className="mt-2 text-sm text-[#5a6b85]">{net.away.who === "friend" ? "The race is paused. It carries on as soon as they're back." : "The race is paused while we get you back in."}</p>
            <div className="mt-3 text-4xl font-bold tabular-nums text-[#3f7fd6]">{awaySecs}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[#5a6b85]">Seconds Left To Come Back</div>
            <button onClick={toCpu} className="mt-4 w-full rounded-full bg-[#e3effe] py-3 font-semibold text-[#3f7fd6]">Leave</button>
          </Card>
        )}

        {isLive && paired && !liveOn && !net.away && (
          <Card>
            <div className="text-xl font-bold">Get Ready</div>
            <p className="mt-1 text-[13px] leading-snug text-[#5a6b85]">Your car speeds up by itself. {controls === "stick" ? "Push the joystick where you want to go" : "Turn Left and Turn Right steer it"}; Brake slows it for tight bends. First to finish {LAPS} laps wins.</p>
            {me === 0 ? <CoursePick ci={livePick.ci} onChange={ci => setLivePick(p => ({ ...p, ci }))} compact disabled={ready.me} />
              : <div className="mt-2 flex items-center gap-2 rounded-2xl bg-[#f0f6fe] p-1.5 text-left"><CourseThumb ci={livePick.ci} small /><div className="text-sm"><div className="font-bold">{COURSES[livePick.ci].name}</div><div className="text-xs text-[#5a6b85]">{friend} picks the course</div></div></div>}
            <div className="mt-2 text-left text-xs font-semibold uppercase tracking-wide text-[#5a6b85]">Your Car</div>
            <CarRow car={livePick.cars[me]} color={BLUE} onChange={setLiveCar} disabled={ready.me} />
            <ControlsToggle value={controls} onChange={setControls} />
            <div className="mt-2.5 space-y-1 rounded-2xl bg-[#f0f6fe] px-3 py-2 text-sm">
              <div className="flex justify-between"><span className="font-semibold text-[#3f7fd6]">You · {CARS[livePick.cars[me]].name}</span><span className={ready.me ? "font-bold text-[#2eaa6e]" : "text-[#5a6b85]"}>{ready.me ? "Ready ✓" : "Not Yet"}</span></div>
              <div className="flex justify-between"><span className="max-w-[170px] truncate font-semibold text-[#e8505b]">{friendLabel} · {CARS[livePick.cars[1 - me]].name}</span><span className={ready.them ? "font-bold text-[#2eaa6e]" : "text-[#5a6b85]"}>{ready.them ? "Ready ✓" : "Picking..."}</span></div>
            </div>
            <button onClick={imReady} disabled={ready.me} className="mt-3 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white disabled:opacity-70">
              {!ready.me ? "I'm Ready" : !ready.them ? `Waiting For ${friend}...` : net.mode === "connecting" ? "Connecting..." : "Starting..."}
            </button>
            <button onClick={toCpu} className="mt-1 w-full py-2 text-sm font-semibold text-[#5a6b85]">Leave</button>
          </Card>
        )}

        {raceEnd && !showRoomCard && !(isLive && net.away) && (isLive || isLocal) && (() => {
          const w0 = raceEnd.order[0];
          const title = isLive ? (w0 === me ? "You Won! 🎉" : `${friend} Won`) : seriesOver ? `${pn[wins[0] >= 2 ? 0 : 1]} Wins The Series! 🎉` : `${pn[w0]} Wins! 🎉`;
          const who = (i: number) => (isLive ? (i === me ? "You" : friendLabel) : pn[i]);
          return (
            <Card>
              <div className="text-sm font-semibold text-[#5a6b85]">{play.kind === "live" ? `Room ${play.code}` : localSeries ? `Same Phone · ${pn[0]} ${wins[0]} · ${pn[1]} ${wins[1]}` : "Same Phone"}</div>
              <div className="mt-1 text-2xl font-bold">{title}</div>
              <div className="mt-2 space-y-1 rounded-2xl bg-[#f0f6fe] px-3 py-2 text-left text-sm">
                {raceEnd.order.map((i, k) => (
                  <div key={i} className="flex items-baseline justify-between gap-2">
                    <span className={`min-w-0 truncate font-semibold ${(isLive ? i === me : i === 0) ? "text-[#3f7fd6]" : "text-[#e8505b]"}`}>{ord(k + 1)} · {who(i)}</span>
                    <span className="shrink-0 tabular-nums text-[#5a6b85]">{raceEnd.dnf[i] ? `Lap ${raceEnd.laps[i].length + 1}` : `${fmt2(raceEnd.fin[i])}s`}</span>
                  </div>
                ))}
              </div>
              {isLive && again.them && !again.me && <div className="mt-2 text-sm font-semibold text-[#2eaa6e]">{friend} Wants A Rematch!</div>}
              {isLive ? (
                <button onClick={liveRematch} disabled={again.me} className="mt-3 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white disabled:opacity-70">{again.me ? `Waiting For ${friend}...` : "Rematch"}</button>
              ) : (
                <button onClick={() => localNext(!localSeries || !!seriesOver)} className="mt-3 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">{localSeries && !seriesOver ? "Next Race" : "Rematch"}</button>
              )}
              <button onClick={toCpu} className="mt-2 w-full rounded-full bg-[#e3effe] py-3 font-semibold text-[#3f7fd6]">{isLive ? "Leave" : "Done"}</button>
              <a href={appStoreLink(GAME)} className="mt-3 inline-block text-xs font-semibold text-[#5a6b85] underline">Get WhatYouAte For iPhone</a>
            </Card>
          );
        })()}

        {over && isCpu && !menu && !rui && result && <GameOver label={mode === "daily" ? `Today's Time Trial #${n}` : `Free Play · ${COURSES[result.ci].name}`} headline={headline} score={result.points} best={best} mode={mode}
          posted={shell.scores.posted} joined={!!shell.player} campaign={GAME} copied={shell.copied} fact={fact}
          pitch="Good fuel makes for a better race, and a better day. WhatYouAte shows you which foods keep your energy steady."
          extra={mode === "daily" ? duel.button : <div className="mt-2 flex justify-center gap-5 whitespace-nowrap text-sm font-semibold text-[#3f7fd6]">
            <button onClick={() => setMenu("pick")}>Change Car</button>
            <button onClick={() => setMenu("friend")}>Play A Friend →</button>
          </div>}
          onBoard={() => shell.setBoardOpen(true)} onJoin={() => shell.setJoinOpen(true)} onAgain={() => setRun(r => r + 1)} onShare={share} />}
      </BoardArea>

      {duel.popup}
      <ShellPopups shell={shell} game={GAME} todayNote="Today's Time Trial: same course and car for everyone. Resets at midnight." />

      {shell.help.open && (
        <HelpModal onClose={shell.help.close} steps={[
          "Your car speeds up by itself. Push the joystick (under the track) the way you want to go on the screen, and your car steers that way.",
          "Hold Brake, or pull the stick back behind your car, to slow down for tight bends. Off the track you're much slower. Prefer buttons? Switch Controls on the start card.",
          "Red hot sauce pads give a burst of speed. Syrup puddles and glowing burners slow you down. Flour puffs into a cloud.",
          `Finish ${LAPS} laps first. On a computer: arrow keys or A and D turn the car left or right, down arrow or S brakes.`,
        ]}>
          <ModesHelp today="the same course and car for everyone: a 3-lap time trial against a ghost of your best run. Faster means more points."
            free="pick a course and a car, then race up to 3 computer cars. Play A Friend and Same Phone: race each other." />
        </HelpModal>
      )}
    </GameScreen>
  );
}

// ── the course scene (drawn once per course and cached) ─────────────────────
type Im = (code: string) => HTMLImageElement | null;
const THEMES: Record<string, { bg: string; bg2: string; track: string; edge: string; line: string }> = {
  counter: { bg: "#dcc39b", bg2: "#d2b78c", track: "#f7f2e8", edge: "#a8875a", line: "rgba(168,135,90,0.28)" },
  sink: { bg: "#d5dee6", bg2: "#c9d4de", track: "#fbfcfd", edge: "#8d9fb2", line: "rgba(120,140,160,0.25)" },
  stove: { bg: "#30353b", bg2: "#383e45", track: "#ebe7e0", edge: "#8a9099", line: "rgba(120,120,120,0.25)" },
  fridge: { bg: "#dcebf6", bg2: "#d0e3f1", track: "#ffffff", edge: "#9dbbd2", line: "rgba(120,160,190,0.25)" },
  pantry: { bg: "#cfa874", bg2: "#c49c66", track: "#f6ead2", edge: "#9b7646", line: "rgba(155,118,70,0.28)" },
  table: { bg: "#f6e3e3", bg2: "#efcfcf", track: "#fffaf0", edge: "#d39c9c", line: "rgba(211,156,156,0.3)" },
};
function drawScene(g: CanvasRenderingContext2D, c: Course, img: Im) {
  const th = THEMES[c.theme];
  // the surface
  g.fillStyle = th.bg; g.fillRect(0, 0, AW, AH);
  if (c.theme === "counter" || c.theme === "pantry") {   // wood
    for (let x = 0; x < AW; x += 40) { g.fillStyle = (x / 40) % 2 ? th.bg2 : th.bg; g.fillRect(x, 0, 40, AH); g.strokeStyle = "rgba(90,60,30,0.12)"; g.lineWidth = 1; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, AH); g.stroke(); }
  } else if (c.theme === "sink") {   // tiles
    g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 2;
    for (let x = 0; x <= AW; x += 30) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, AH); g.stroke(); }
    for (let y = 0; y <= AH; y += 30) { g.beginPath(); g.moveTo(0, y); g.lineTo(AW, y); g.stroke(); }
  } else if (c.theme === "stove") {   // black glass with a soft shine
    const gr = g.createLinearGradient(0, 0, AW, AH); gr.addColorStop(0, "#3a4047"); gr.addColorStop(0.5, "#2b3035"); gr.addColorStop(1, "#353b42"); g.fillStyle = gr; g.fillRect(0, 0, AW, AH);
  } else if (c.theme === "fridge") {   // cool white inside
    g.fillStyle = "rgba(255,255,255,0.45)"; for (let y = 0; y < AH; y += 120) g.fillRect(0, y, AW, 60);
  } else if (c.theme === "table") {   // a soft gingham cloth
    for (let x = 0; x < AW; x += 24) { g.fillStyle = "rgba(232,140,140,0.16)"; g.fillRect(x, 0, 12, AH); }
    for (let y = 0; y < AH; y += 24) { g.fillStyle = "rgba(232,140,140,0.16)"; g.fillRect(0, y, AW, 12); }
  }
  // props underneath the track's shadow: drawn after the track only if they're solid (so they sit on top)
  const path = () => { g.beginPath(); g.moveTo(c.cx[0], c.cy[0]); for (let i = 1; i < c.n; i++) g.lineTo(c.cx[i], c.cy[i]); g.closePath(); };
  g.lineJoin = "round"; g.lineCap = "round";
  g.strokeStyle = "rgba(40,25,10,0.16)"; g.lineWidth = c.width + 10; g.save(); g.translate(0, 3); path(); g.stroke(); g.restore();   // shadow
  g.strokeStyle = th.edge; g.lineWidth = c.width + 6; path(); g.stroke();
  g.strokeStyle = th.track; g.lineWidth = c.width; path(); g.stroke();
  // kerbs on the bends: red and white along both edges
  for (let i = 0; i < c.n; i += 2) {
    if (c.kap[i] < 0.011) continue;
    const nx = -Math.sin(c.th[i]), ny = Math.cos(c.th[i]), hw = c.width / 2 - 2;
    g.strokeStyle = (i >> 1) % 2 ? "#e8505b" : "#ffffff"; g.lineWidth = 4; g.lineCap = "butt";
    for (const sd of [-1, 1]) {
      const j = (i + 2) % c.n, mx = -Math.sin(c.th[j]), my = Math.cos(c.th[j]);
      g.beginPath(); g.moveTo(c.cx[i] + nx * hw * sd, c.cy[i] + ny * hw * sd); g.lineTo(c.cx[j] + mx * hw * sd, c.cy[j] + my * hw * sd); g.stroke();
    }
  }
  g.lineCap = "round";
  // the dashed centre line
  g.setLineDash([8, 12]); g.strokeStyle = th.line; g.lineWidth = 2; path(); g.stroke(); g.setLineDash([]);
  // start / finish: a chequered band across the track
  {
    const a = c.th[0], nx = -Math.sin(a), ny = Math.cos(a), fx = Math.cos(a), fy = Math.sin(a), cells = 8, cw = c.width / cells;
    for (let r = 0; r < 2; r++) for (let k = 0; k < cells; k++) {
      g.fillStyle = (k + r) % 2 ? "#101b2e" : "#ffffff";
      const s0 = -c.width / 2 + k * cw, f0 = (r - 1) * 5;
      g.beginPath();
      g.moveTo(c.cx[0] + nx * s0 + fx * f0, c.cy[0] + ny * s0 + fy * f0);
      g.lineTo(c.cx[0] + nx * (s0 + cw) + fx * f0, c.cy[0] + ny * (s0 + cw) + fy * f0);
      g.lineTo(c.cx[0] + nx * (s0 + cw) + fx * (f0 + 5), c.cy[0] + ny * (s0 + cw) + fy * (f0 + 5));
      g.lineTo(c.cx[0] + nx * s0 + fx * (f0 + 5), c.cy[0] + ny * s0 + fy * (f0 + 5));
      g.fill();
    }
  }
  // hot sauce pads: red with yellow arrows and a pepper
  for (const p of c.padsAt) {
    g.save(); g.translate(p.x, p.y); g.rotate(p.a);
    g.fillStyle = "#e8433b"; g.beginPath(); g.roundRect(-13, -15, 26, 30, 6); g.fill();
    g.strokeStyle = "#ffd23f"; g.lineWidth = 3.5; g.lineJoin = "round";
    for (const ox of [-6, 3]) { g.beginPath(); g.moveTo(ox - 3, -8); g.lineTo(ox + 4, 0); g.lineTo(ox - 3, 8); g.stroke(); }
    g.restore();
    const im = img("1f336"); if (im) g.drawImage(im, p.x - 7 - Math.sin(p.a) * 22, p.y - 7 + Math.cos(p.a) * 22, 14, 14);
  }
  // syrup puddles
  for (const s of c.syrup) {
    g.fillStyle = "#c27a1e"; g.beginPath();
    for (let k = 0; k <= 12; k++) { const an = (k / 12) * Math.PI * 2, r = s.r * (1 + 0.16 * Math.sin(k * 2.3 + s.x)); g.lineTo(s.x + Math.cos(an) * r * 1.15, s.y + Math.sin(an) * r * 0.95); }
    g.fill();
    g.fillStyle = "rgba(255,226,150,0.65)"; g.beginPath(); g.ellipse(s.x - s.r * 0.35, s.y - s.r * 0.3, s.r * 0.35, s.r * 0.2, -0.4, 0, 7); g.fill();
  }
  // burners (cold rings; the game draws the glow)
  for (const b of c.burners) { g.strokeStyle = "rgba(70,70,70,0.55)"; g.lineWidth = 3; for (const r of [b.r * 0.45, b.r * 0.75, b.r]) { g.beginPath(); g.arc(b.x, b.y, r, 0, 7); g.stroke(); } }
  // flour bags
  for (const f of c.flour) {
    g.fillStyle = "#f5efe2"; g.strokeStyle = "#c9b996"; g.lineWidth = 1.5;
    g.beginPath(); g.roundRect(f.x - 9, f.y - 11, 18, 22, 4); g.fill(); g.stroke();
    g.fillStyle = "#c9b996"; g.fillRect(f.x - 9, f.y - 11, 18, 5);
    g.fillStyle = "rgba(255,255,255,0.9)"; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(f.x - 8 + k * 4, f.y + 13 + (k % 2) * 2, 2.2, 0, 7); g.fill(); }
  }
  // the props
  for (const p of c.props) drawProp(g, p, img);
  for (const d of c.decor ?? []) { const im = img(d[0]); if (im) g.drawImage(im, d[1] - d[3] / 2, d[2] - d[3] / 2, d[3], d[3]); }
}
function drawProp(g: CanvasRenderingContext2D, p: Course["props"][number], img: Im) {
  const shadow = () => { g.fillStyle = "rgba(40,25,10,0.2)"; if (p.k === "c") { g.beginPath(); g.arc(p.x + 3, p.y + 5, p.r, 0, 7); g.fill(); } else { g.beginPath(); g.roundRect(p.x - p.w / 2 + 3, p.y - p.h / 2 + 5, p.w, p.h, p.rad ?? 4); g.fill(); } };
  const pic = (code: string, x: number, y: number, s: number) => { const im = img(code); if (im) g.drawImage(im, x - s / 2, y - s / 2, s, s); };
  if (p.k === "r") {
    const x0 = p.x - p.w / 2, y0 = p.y - p.h / 2;
    if (p.art === "board") {   // a wooden cutting board with some veg
      shadow(); g.fillStyle = "#b7834a"; g.beginPath(); g.roundRect(x0, y0, p.w, p.h, p.rad ?? 14); g.fill();
      g.fillStyle = "#c99459"; g.beginPath(); g.roundRect(x0 + 8, y0 + 8, p.w - 16, p.h - 16, 10); g.fill();
      g.strokeStyle = "rgba(90,55,20,0.18)"; g.lineWidth = 1.5; for (let y = y0 + 20; y < y0 + p.h - 12; y += 16) { g.beginPath(); g.moveTo(x0 + 14, y); g.lineTo(x0 + p.w - 14, y); g.stroke(); }
      pic("1f952", p.x - 30, p.y - 50, 46); pic("1f345", p.x + 30, p.y - 10, 40); pic("1f9c5", p.x - 22, p.y + 40, 40); pic("1f9c2", p.x + 34, p.y + 62, 30);
    } else if (p.art === "sink") {   // a steel basin, a drain and a tap
      shadow(); g.fillStyle = "#aeb9c4"; g.beginPath(); g.roundRect(x0, y0, p.w, p.h, p.rad ?? 20); g.fill();
      const gr = g.createLinearGradient(x0, y0, x0 + p.w, y0 + p.h); gr.addColorStop(0, "#e3e9ef"); gr.addColorStop(1, "#c3ccd5");
      g.fillStyle = gr; g.beginPath(); g.roundRect(x0 + 10, y0 + 10, p.w - 20, p.h - 20, 16); g.fill();
      g.fillStyle = "#8d99a6"; g.beginPath(); g.arc(p.x, p.y + 20, 10, 0, 7); g.fill(); g.fillStyle = "#6b7784"; g.beginPath(); g.arc(p.x, p.y + 20, 5, 0, 7); g.fill();
      g.fillStyle = "#9aa6b3"; g.beginPath(); g.roundRect(p.x - 6, y0 - 2, 12, 46, 6); g.fill(); g.beginPath(); g.arc(p.x, y0 + 4, 11, 0, 7); g.fill();
      g.fillStyle = "rgba(120,180,240,0.35)"; g.beginPath(); g.ellipse(p.x + 20, p.y + 60, 30, 14, 0.3, 0, 7); g.fill();
      pic("1f9fd", p.x - 38, p.y - 60, 34);
    } else if (p.art === "shelf" || p.art === "rail") {   // glass fridge shelves / the door rail
      g.fillStyle = "rgba(120,170,205,0.55)"; g.beginPath(); g.roundRect(x0, y0, p.w, p.h, 3); g.fill();
      g.fillStyle = "rgba(255,255,255,0.8)"; g.fillRect(x0 + 2, y0 + 1, p.w - 4, Math.min(2, p.h / 3));
    } else if (p.art === "box" || p.art === "boxes") {   // cereal boxes
      shadow();
      const cols = ["#f2994a", "#e8505b", "#8e6bd6", "#2eaa6e"], n = p.art === "boxes" ? Math.max(1, Math.round(p.h / 50)) : Math.max(1, Math.round(p.w / 50));
      for (let k = 0; k < n; k++) {
        const bx = p.art === "boxes" ? x0 : x0 + (k * p.w) / n, by = p.art === "boxes" ? y0 + (k * p.h) / n : y0, bw = p.art === "boxes" ? p.w : p.w / n - 2, bh = p.art === "boxes" ? p.h / n - 2 : p.h;
        g.fillStyle = cols[k % 4]; g.beginPath(); g.roundRect(bx, by, bw, bh, 3); g.fill();
        g.fillStyle = "rgba(255,255,255,0.85)"; const s = Math.min(bw, bh) * 0.6; g.beginPath(); g.roundRect(bx + bw / 2 - s / 2, by + bh / 2 - s / 2, s, s, 4); g.fill();
      }
    } else if (p.art === "can") {
      shadow(); g.fillStyle = "#c6ced8"; g.beginPath(); g.roundRect(x0, y0, p.w, p.h, 6); g.fill(); pic("1f96b", p.x, p.y, Math.min(p.w, p.h) * 0.9);
    } else { shadow(); g.fillStyle = "#c8b89a"; g.beginPath(); g.roundRect(x0, y0, p.w, p.h, 4); g.fill(); }
    return;
  }
  // round props
  shadow();
  if (p.art === "pot") {   // a big pot of soup from above
    g.fillStyle = "#8f9aa6"; g.fillRect(p.x - p.r - 14, p.y - 6, p.r * 2 + 28, 12);
    g.fillStyle = "#b9c3cd"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
    g.fillStyle = "#e9a24a"; g.beginPath(); g.arc(p.x, p.y, p.r * 0.84, 0, 7); g.fill();
    g.fillStyle = "rgba(255,255,255,0.25)"; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(p.x + Math.cos(k * 1.7) * p.r * 0.45, p.y + Math.sin(k * 2.3) * p.r * 0.45, 5 + (k % 3) * 2, 0, 7); g.fill(); }
    pic("1f944", p.x + p.r * 0.35, p.y - p.r * 0.3, 44);
  } else if (p.art === "pan") {
    g.fillStyle = "#2a2d31"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
    pic("1f373", p.x, p.y, p.r * 1.9);
  } else if (p.art === "jar" || p.art === "jar2") {
    g.fillStyle = "rgba(255,255,255,0.7)"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
    g.strokeStyle = p.art === "jar" ? "#d9a441" : "#c0563b"; g.lineWidth = 5; g.stroke();
    pic(p.art === "jar" ? "1f36f" : "1f95c", p.x, p.y, p.r * 1.3);
  } else if (p.art === "plate" || p.art === "plate2") {
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
    g.strokeStyle = "#e3e7ee"; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, p.r * 0.72, 0, 7); g.stroke();
    pic(p.art === "plate" ? "1f957" : "1f35d", p.x, p.y, p.r * 1.15);
  } else if (p.art === "glass") {
    g.fillStyle = "rgba(190,225,250,0.85)"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = 3; g.stroke();
    g.fillStyle = "rgba(255,255,255,0.7)"; g.beginPath(); g.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.25, 0, 7); g.fill();
  } else { g.fillStyle = "#ddd"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); }
}

// ── pickers ────────────────────────────────────────────────────────────────
/** A small drawing of a course's shape (for the pickers). */
function CourseThumb({ ci, small = false }: { ci: number; small?: boolean }) {
  const c = course(ci), th = THEMES[c.theme];
  let d = "";
  for (let i = 0; i < c.n; i += 3) d += `${i ? "L" : "M"}${c.cx[i].toFixed(0)} ${c.cy[i].toFixed(0)}`;
  return (
    <svg viewBox={`0 0 ${AW} ${AH}`} className={`${small ? "h-11 w-[30px]" : "h-[62px] w-[43px]"} shrink-0 rounded-md`} style={{ background: th.bg }}>
      <path d={d + "Z"} fill="none" stroke={th.edge} strokeWidth={c.width + 14} strokeLinejoin="round" />
      <path d={d + "Z"} fill="none" stroke={th.track} strokeWidth={c.width} strokeLinejoin="round" />
      <circle cx={c.cx[0]} cy={c.cy[0]} r={18} fill="#101b2e" />
    </svg>
  );
}
function CoursePick({ ci, onChange, compact = false, disabled = false }: { ci: number; onChange: (ci: number) => void; compact?: boolean; disabled?: boolean }) {
  const go = (d: number) => onChange((ci + d + COURSES.length) % COURSES.length);
  const arrow = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e3effe] text-lg font-bold text-[#3f7fd6] disabled:opacity-40";
  return (
    <div className={`${compact ? "mt-2.5" : "mt-3"} flex items-center gap-2 rounded-2xl bg-[#f0f6fe] p-1.5`}>
      <button onClick={() => go(-1)} disabled={disabled} aria-label="Previous course" className={arrow}>‹</button>
      <CourseThumb ci={ci} small={compact} />
      <div className="min-w-0 flex-1 text-left">
        <div className="text-sm font-bold leading-tight">{COURSES[ci].name}</div>
        <div className="text-xs text-[#5a6b85]">Course {ci + 1} Of {COURSES.length}{ci === 0 ? " · Easy" : ci >= 4 ? " · Tricky" : ""}</div>
      </div>
      <button onClick={() => go(1)} disabled={disabled} aria-label="Next course" className={arrow}>›</button>
    </div>
  );
}
function CarRow({ car, onChange, color = BLUE, disabled = false }: { car: number; onChange: (car: number) => void; color?: string; disabled?: boolean }) {
  return (
    <div className="mt-1.5 flex justify-between gap-1">
      {CARS.map((c, i) => (
        <button key={c.id} onClick={() => onChange(i)} disabled={disabled} aria-label={c.name}
          className="flex h-11 flex-1 items-center justify-center rounded-xl border-2 bg-white disabled:opacity-60"
          style={{ borderColor: i === car ? color : "#e3effe", background: i === car ? "#f0f6fe" : "#fff" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foodPng(c.emoji)} alt="" className="h-7 w-7" />
        </button>
      ))}
    </div>
  );
}
function ControlsToggle({ value, onChange }: { value: Controls; onChange: (v: Controls) => void }) {
  return (
    <div className="mt-2.5 flex items-center justify-between gap-2 text-sm font-semibold">
      <span className="text-[#5a6b85]">Controls</span>
      <div className="flex rounded-full bg-[#f0f6fe] p-0.5 text-xs">
        {([["stick", "Joystick"], ["buttons", "Buttons"]] as [Controls, string][]).map(([v, l]) => (
          <button key={v} onClick={() => onChange(v)} className={`rounded-full px-3 py-1.5 font-bold ${value === v ? "bg-[#3f7fd6] text-white" : "text-[#3f7fd6]"}`}>{l}</button>
        ))}
      </div>
    </div>
  );
}
function Stats({ car }: { car: number }) {
  const s = CARS[car].stats;
  return (
    <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-semibold uppercase tracking-wide text-[#5a6b85]">
      {["Speed", "Grip", "Accel", "Weight"].map((l, k) => (
        <div key={l} className="flex items-center gap-1.5"><span className="w-10 shrink-0 text-left">{l}</span>
          <span className="flex flex-1 gap-0.5">{[1, 2, 3, 4, 5].map(v => <span key={v} className={`h-1.5 flex-1 rounded-full ${v <= s[k] ? "bg-[#3f7fd6]" : "bg-[#d6e2f5]"}`} />)}</span></div>
      ))}
    </div>
  );
}
function CarPick({ car, onChange }: { car: number; onChange: (car: number) => void }) {
  return (
    <div className="mt-3 text-left">
      <div className="text-xs font-semibold uppercase tracking-wide text-[#5a6b85]">Your Car</div>
      <CarRow car={car} onChange={onChange} />
      <div className="mt-1.5 rounded-2xl bg-[#f0f6fe] px-3 py-2">
        <div className="text-sm font-bold">{CARS[car].name} <span className="font-normal text-[#5a6b85]">· {CARS[car].blurb}</span></div>
        <Stats car={car} />
      </div>
    </div>
  );
}

function RoomCard({ rui, copied, onShare, onCancel, onBack, onNew }: { rui: RoomState; copied: boolean; onShare: () => void; onCancel: () => void; onBack: () => void; onNew: () => void }) {
  return (
    <Card>
      {rui.s === "waiting" && (<>
        <div className="text-sm font-semibold text-[#5a6b85]">Your Room Code</div>
        <div className="mt-1 font-mono text-4xl font-bold tracking-[0.2em]">{rui.code}</div>
        <p className="mt-2 text-sm text-[#5a6b85]">Send your friend the link. You&apos;ll both pick a car, then the race starts.</p>
        <button onClick={onShare} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">{copied ? "Link Copied!" : "Share Link"}</button>
        <p className="mt-3 text-sm font-semibold text-[#3f7fd6]">Waiting For Your Friend...</p>
        <button onClick={onCancel} className="mt-1 w-full py-2 text-sm font-semibold text-[#5a6b85]">Cancel</button>
      </>)}
      {rui.s === "joining" && (<>
        <div className="text-xl font-bold">Joining Room {rui.code}</div>
        <p className="mt-2 text-sm font-semibold text-[#3f7fd6]">Connecting...</p>
        <button onClick={onCancel} className="mt-3 w-full py-2 text-sm font-semibold text-[#5a6b85]">Cancel</button>
      </>)}
      {(rui.s === "full" || rui.s === "empty" || rui.s === "error") && (<>
        <div className="text-xl font-bold">{rui.s === "full" ? "Room Full" : rui.s === "empty" ? "No One's Here" : "Can't Connect"}</div>
        <p className="mt-2 text-sm text-[#5a6b85]">{rui.s === "full" ? `Room ${rui.code} already has two players.` : rui.s === "empty" ? `Nobody is in room ${rui.code} right now. Ask your friend to make a room and send you the link.` : "We couldn't reach the game. Check your connection and try again."}</p>
        <button onClick={onBack} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Back</button>
        <button onClick={onCancel} className="mt-2 w-full py-2 text-sm font-semibold text-[#5a6b85]">Race The Computer</button>
      </>)}
      {rui.s === "lost" && (<>
        <div className="text-xl font-bold">Connection Lost</div>
        <p className="mt-2 text-sm text-[#5a6b85]">We couldn&apos;t get you back into room {rui.code} in time.</p>
        <button onClick={onNew} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Make A New Room</button>
        <button onClick={onCancel} className="mt-2 w-full rounded-full bg-[#e3effe] py-3 font-semibold text-[#3f7fd6]">Race The Computer</button>
      </>)}
      {rui.s === "left" && (<>
        <div className="text-xl font-bold">Your Friend Left</div>
        <p className="mt-2 text-sm text-[#5a6b85]">That race is over.</p>
        <button onClick={onNew} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Make A New Room</button>
        <button onClick={onCancel} className="mt-2 w-full rounded-full bg-[#e3effe] py-3 font-semibold text-[#3f7fd6]">Race The Computer</button>
      </>)}
    </Card>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[22px] bg-[#101b2e]/35 p-3">
      <div className="max-h-full w-full max-w-[310px] overflow-y-auto rounded-3xl bg-white p-4 text-center shadow-2xl">{children}</div>
    </div>
  );
}
