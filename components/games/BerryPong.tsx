"use client";

// Berry Pong: two players face each other across a kitchen table, each with a 3-2-1 triangle of cereal bowls at their
// end. On your turn you flick 2 blueberries at the other player's bowls: drag back anywhere under your berry (your
// finger stays below it, so it never covers the berry or the aim dots) and let go. A berry that drops into a bowl sinks
// it and that bowl lifts off the table. Sink 2 in a row and you're On Fire (a flame trail and a slightly bigger sweet
// spot until you miss); sink both berries of a turn and you get Berries Back, another turn. First to clear all 6 of the
// other player's bowls wins. The rules and the berry's flight live in pong/rules.ts, the art in pong/art.ts, the balance
// check in pong/sim.ts.
// Three ways to play:
//  - Computer: Today (one match; the computer's throws come from today's seed, so they're the same for everyone) or Free
//    Play (beat the computer to move on to the next round; its hand gets a little steadier each round).
//  - Same Phone: two names, one phone. The table turns round to whoever is throwing, and the banner says whose turn.
//  - Play A Friend: a 4-letter room over Supabase Realtime (channel "berry-pong:ABCD", presence for who's in). The thrower's
//    phone flies the berry from the flick and sends the launch speed plus the result (which bowl, if any); the friend's
//    phone flies the same berry from the same numbers (the flight only uses + - * / and sqrt, so it lands the same) and
//    takes the sender's result as final. A match is the list of flicks so far, so catching up after a reload or a dropped
//    connection is sending that list: the longer one wins, and the host's wins a tie. Get Ready card first, 60 seconds of
//    "Stepped Away" with the clock stopped, and 30 seconds a flick (run out and that berry is a miss).
//
// Scoreboard (against the computer only; Same Phone and Play A Friend post nothing), as rules.matchScore:
//   one match = 100 x sinks + floor(400 x sinks / flicks) + (won ? 500 + 100 x your own bowls still standing : 0)
//   Today is one match. Free Play is a run of matches (win and the next round starts; a loss, or Stop And Save, ends the
//   run) and posts the run's total.
//   drops = your flicks in the run (every berry you flicked, in every match of the run).
//   Bounds for game_score_problem's "berry-pong" check:
//     drops >= 2            you always flick first and get your whole first turn (2 berries) before the computer throws
//     score <= 350 x drops  a win needs at least 6 flicks: 100f + 400 + 500 + 600 <= 350f when f >= 6; a loss sinks at
//                           most 5: 100f + 400 <= 350f when f >= 2; a run is a sum of matches, so the bound holds for it
//     daily score <= 2100   the best possible match: 6 sinks from 6 flicks, none of your bowls lost (600 + 400 + 500 + 600)
//     ms >= 1000 x drops    a flick isn't taken until 1 second after your last one (MIN_FLICK_MS), every flick's flight
//                           plays before the next, and the match ends with a landing and a celebration of over a second,
//                           so a server check of ms >= drops x 900 has room to spare
//     daily drops           one match; in 12,000 simulated matches nobody needed more than 45, so <= 120 is generous
/* eslint-disable react-hooks/refs, react-hooks/purity, react-hooks/immutability, react-hooks/set-state-in-effect --
   Turn-based like Blenders & Bacon: the match lives in mutable refs (g, vw, log) that handlers, timers, the animation
   queue, the canvas loop and Realtime callbacks all update, then bump() re-renders. */
import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sb } from "@/components/creators/api";
import { type Mode, type Toast, GameScreen, GameHeader, BoardArea, PrizeLogo, GameOver, PauseButton, PausedCard, ReadyCard, HelpModal, ModesHelp, ShellPopups,
  OverlayCard, UI, useGameShell, dailySeed, dailyNumber, torontoDate, mulberry32, readBest, saveBest, foodPng, ModeRow, PlayChoices, LeaveCard, ChangeModeLink } from "./kit";
import { GAME_FONT, loadGameFont } from "./gameFont";
import { PlayIcon, ReplayIcon, ShareIcon } from "./icons";
import { BP_CSS } from "./pong/skin";
import { FlameIcon, RackIcon, BerryDot } from "./pong/icons";
import { BW, type Cam, type BowlArt, makeCam, P, flat, toWorld, bowlAt, GLAZE, paintScene, paintLight, bowlArt, berrySprite, flameSprite, drawHint, tablePath } from "./pong/art";
import { apply, newState, flight, pullAim, pullV, freeAt, cpuFlick, cpuWobble, matchScore, left, other, FLICKS, N_BOWLS, BR, H, TL, TW, Y0, Z0,
  BOWLS, type State, type Action, type Ev, type Side, type V3, type Flight } from "./pong/rules";
import { Sound } from "./pong/sound";

const GAME = "berry-pong";
const LAUNCH = "2026-11-13";                 // Today's Challenge #1 (move to launch day)
const CPU_SALT = 0xbe44e, FACT_SALT = 0xfac75;
// you're always blue and they're always pink (Same Phone: player 1 blue, player 2 pink)
const COL = [{ hi: "#9CC4FF", lo: "#6FA8FF", lip: "#4F88E8", ink: "#2F5FB0" }, { hi: "#FFA8B8", lo: "#FF7A93", lip: "#E0577A", ink: "#8F2440" }];
const MIN_FLICK_MS = 1000;                   // a flick isn't taken sooner than this after your last one (see the bounds above)
const MISS_MS = 1500;                        // a miss that's still rolling fades out by here
const VIS = 1.15;                            // the berry is drawn a touch bigger than its size in the flight, so it reads
const GAP = 8;
const FACTS: Toast[] = [
  { title: "Blueberries", body: "Blueberries are pale green inside. All that blue is in the skin.", img: "1fad0" },
  { title: "Blueberries", body: "A cup of blueberries has almost 4 grams of fibre.", img: "1fad0" },
  { title: "Blueberries", body: "Canada grows more wild blueberries than any other country.", img: "1fad0" },
  { title: "Milk", body: "A cup of milk has about 8 grams of protein.", img: "1f95b" },
];

type Opp = "cpu" | "phone" | "live";
type Phase = "start" | "names" | "idle" | "gate" | "play" | "between" | "rematch" | "over" | "doneToday";
type Final = { score: number; won: boolean; round: number; sinks: number; flicks: number; fires: number; backs: number; left: number };
type View = { bowls: [boolean[], boolean[]]; turn: Side; flick: number; fire: [boolean, boolean] };
const viewOf = (s: State): View => ({ bowls: [[...s.bowls[0]], [...s.bowls[1]]], turn: s.turn, flick: s.flick, fire: [...s.fire] as [boolean, boolean] });

// live play
const CODE_LETTERS = "BCDFGHJKMNPQRSTVWXZ";   // no vowels (no accidental words), no I, L or O
const TURN_MS = 30000, GRACE_MS = 8000, AWAY_MS = 60000, BYE_MS = 8000;   // BYE_MS: after a "bye", how long their lingering presence is ignored
type Meta = { id: string; name: string; at: number; round: number; seq: number; ok: boolean; stage: "gate" | "game" };
type Room = { status: "idle" | "connecting" | "waiting" | "paired" | "away" | "full" | "error"; code?: string; opp?: Meta | null; host?: boolean; until?: number };
type Snap = { round: number; log: Action[]; from: string };
type SavedLive = { code: string; id: string; at: number; host: boolean; friendId: string; round: number; snap: Snap; t: number };
type Msg =
  | { t: "act"; round: number; i: number; a: Action }   // flick number i of this round: the launch speed and the bowl it sank
  | { t: "meta"; round: number; meta: Meta }            // the same seat info as presence, sent straight away
  | { t: "resume"; round: number; snap: Snap }          // back from a break: here's what I have
  | { t: "state"; round: number; snap: Snap }           // and here's what I have (each keeps the longer; host wins a tie)
  | { t: "bye"; round: number };                        // tapped Leave: gone for good
const LIVE_KEY = "berry-pong-live";
function readLive(code?: string): SavedLive | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(LIVE_KEY) ?? localStorage.getItem(LIVE_KEY) ?? "null") as SavedLive | null;
    return v && (!code || v.code === code) && Date.now() - v.t < 3 * 3600 * 1000 ? v : null;
  } catch { return null; }
}
const newCode = () => Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join("");
const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
const validCode = (s: string) => s.length === 4 && [...s].every(ch => CODE_LETTERS.includes(ch));
function storedName() {
  try { const v = localStorage.getItem("wya-games-player") ?? localStorage.getItem("snackmerge-player"); return v ? (JSON.parse(v).name as string) || "Guest" : "Guest"; } catch { return "Guest"; }
}
const firstOf = (round: number): Side => (round % 2 === 1 ? 0 : 1);   // the host goes first in round 1, then take turns
const same = (a: Action, b: Action) => JSON.stringify(a) === JSON.stringify(b);
function replay(first: Side, actions: Action[]): State | null {
  let s = newState(first);
  for (const a of actions) { const o = apply(s, a); if (!o) return null; s = o.s; }
  return s;
}

// motion and the board's moving parts (all in board units)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
type Fly = { pts: number[]; dt: number; dur: number; t0: number; thrower: Side; fire: boolean; fade: number; hits: Flight["hits"]; fired: number; gone: boolean };
type SinkFx = { side: Side; i: number; t0: number; x: number; y: number; size: number };
type Part = { kind: "drop" | "star" | "flame" | "confetti"; x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; r: number; col: string; rot: number; vr: number; hot?: boolean };
const CONFETTI = ["#6FA8FF", "#FF7A93", "#FFD25C", "#9CC4FF", "#FFB0BF", "#4F88E8"];

export default function BerryPong() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [mode, setMode] = useState<Mode>("daily");
  const [opp, setOpp] = useState<Opp>("cpu");
  const [run, setRun] = useState(0);
  const [phase, setPhaseState] = useState<Phase>("start");
  const phaseRef = useRef<Phase>("start");
  const go = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const g = useRef<State>(newState(0));                 // the match, applied the moment a flick happens
  const vw = useRef<View>(viewOf(g.current));           // what the board shows; catches up as the animations play
  const log = useRef<Action[]>([]);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [msg, setMsg] = useState("");
  const [busy, setBusyState] = useState(false);
  const busyRef = useRef(false);
  const setBusy = (v: boolean) => { busyRef.current = v; setBusyState(v); };
  const [names, setNames] = useState<[string, string]>(["", ""]);
  const [final, setFinal] = useState<Final | null>(null);
  const [best, setBest] = useState(0);
  const [round, setRound] = useState(1);
  const [turnPop, setTurnPop] = useState<{ id: number; side: Side } | null>(null);
  const [word, setWord] = useState<{ id: number; text: string; x: number; y: number; col: string } | null>(null);
  const [big, setBig] = useState<{ id: number; kind: "fire" | "back" | "win"; text: string; col: string } | null>(null);
  const [flip, setFlip] = useState(0);                  // Same Phone: the table turning round (a quick fade)
  const [aiming, setAiming] = useState(false);          // the computer is lining up a flick
  const runStart = useRef(0);
  const runRef = useRef({ round: 1, score: 0, flicks: 0, sinks: 0, fires: 0, backs: 0, last: 0 });
  const sound = useRef<Sound | null>(null);         // plays through the shared games sound (./sfx)
  const genRef = useRef(0);                             // bumps on every reset, so an old animation stops where it is
  const chain = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const cpuRng = useRef<() => number>(Math.random);
  const autoStart = useRef(false);
  const lastFlickAt = useRef(0);
  const shell = useGameShell(GAME, mode);
  const bestKey = mode === "daily" ? `berrypong-daily-${torontoDate()}` : "berrypong-endless";
  const todayKey = `berrypong-today-${torontoDate()}`;
  useEffect(() => { setBest(readBest(bestKey)); }, [bestKey]);
  useEffect(() => { sound.current = new Sound(); void loadGameFont(); }, []);
  const myName = shell.player?.name || "Guest";

  // live
  const [room, setRoom] = useState<Room>({ status: "idle" });
  const chRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef<Meta | null>(null);
  const hostRef = useRef(false);
  const pairedWith = useRef<string | null>(null);
  const [myOk, setMyOk] = useState(false);
  const heard = useRef<Meta | null>(null);
  const awayT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOpp = useRef<Meta | null>(null);
  const byeAt = useRef(0);                               // when the friend last tapped Leave (their "bye"), so presence doesn't call it stepping away
  const [reconnecting, setReconnecting] = useState(false);
  const [offer, setOffer] = useState<SavedLive | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [now, setNow] = useState(0);
  const turnAt = useRef(0);
  const autoFlick = useRef<"mine" | "theirs" | null>(null);

  // ── sizes: the board fills the width; its height follows the phone (440 to 640 board units) ──
  useEffect(() => {
    const el = wrapRef.current!; const f = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect();
  }, []);
  const [short, setShort] = useState(false);          // a short phone (iPhone SE): a slimmer banner and tray
  useEffect(() => { const f = () => setShort(window.innerHeight < 720); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const TRAY = short ? 46 : 54;
  const roomH = Math.max(0, area.h - TRAY - GAP);
  let S = area.w > 0 ? area.w / BW : 0, BH = S > 0 ? roomH / S : 560;
  if (S > 0 && BH < 440) { BH = 440; S = roomH / 440; }
  if (BH > 640) BH = 640;
  BH = Math.round(BH);
  const boardW = BW * S, boardH = BH * S;
  const sRef = useRef(0); sRef.current = S;

  // ── who's who ──────────────────────────────────────────────────────────
  const mySide: Side = opp === "live" ? (hostRef.current ? 0 : 1) : 0;
  const friendMeta = room.opp ?? lastOpp.current;
  const nameOf = (s: Side) => opp === "cpu" ? (s === 0 ? "You" : "The Computer")
    : opp === "phone" ? (names[s] || `Player ${s + 1}`)
    : s === mySide ? (myName === "Guest" ? "You" : myName) : (friendMeta?.name && friendMeta.name !== "Guest" ? friendMeta.name : "Your Friend");
  const who = (s: Side) => (opp === "phone" ? nameOf(s) : s === mySide ? "You" : opp === "cpu" ? "The Computer" : nameOf(s));
  const tint = (s: Side) => (opp === "phone" ? s : s === mySide ? 0 : 1);   // 0 blue, 1 pink
  const colOf = (s: Side) => COL[tint(s)];
  const isMe = (s: Side) => opp === "phone" || s === mySide;   // a side this phone plays
  const turnLabel = (s: Side) => (opp === "phone" ? `${nameOf(s)}'s Turn` : s === mySide ? "Your Turn" : opp === "cpu" ? "Computer's Turn" : `${nameOf(s)}'s Turn`);
  /** Whose end of the table the board is drawn from: yours, or in Same Phone whoever is throwing. */
  const viewer = (): Side => (opp === "phone" ? vw.current.turn : mySide);
  const viewerRef = useRef<() => Side>(viewer); viewerRef.current = viewer;
  const tintRef = useRef(tint); tintRef.current = tint;

  // ── the canvas: layers painted once per size, then a loop that stamps them ──
  const camRef = useRef<Cam>(makeCam(560));
  const layers = useRef<{ scene: HTMLCanvasElement | null; light: HTMLCanvasElement | null; berry: HTMLCanvasElement | null; hot: HTMLCanvasElement | null; warm: HTMLCanvasElement | null; k: number }>({ scene: null, light: null, berry: null, hot: null, warm: null, k: 0 });
  const bowlsArt = useRef(new Map<string, BowlArt>());
  const berryImg = useRef<HTMLImageElement | null>(null);
  const fly = useRef<Fly | null>(null);
  const sinks = useRef<SinkFx[]>([]);
  const lifts = useRef(new Map<string, number>());     // bowl key -> when it started lifting off
  const wobble = useRef(new Map<string, { t0: number; amp: number }>());
  const parts = useRef<Part[]>([]);
  const drag = useRef<{ sx: number; sy: number; px: number; py: number; id: number } | null>(null);
  const lastPull = useRef<({ px: number; py: number } | null)[]>([null, null]);
  const canActRef = useRef(false);
  const shake = useRef(0);

  useEffect(() => {
    const im = new Image(); im.src = foodPng("1fad0");
    im.onload = () => { berryImg.current = im; layers.current.berry = null; };
  }, []);
  useEffect(() => {
    const cv = canvasRef.current; if (!cv || S <= 0) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1), k = S * dpr;
    cv.width = Math.round(BW * k); cv.height = Math.round(BH * k);
    camRef.current = makeCam(BH);
    layers.current = { scene: paintScene(camRef.current, k), light: paintLight(camRef.current, k), berry: null, hot: flameSprite(k, true), warm: flameSprite(k, false), k };
    bowlsArt.current.clear();
  }, [S, BH]);

  const keyOf = (side: Side, i: number) => `${side}-${i}`;
  const artOf = (side: Side, i: number, view: Side): BowlArt => {
    const key = `${side}-${i}-${view}-${tintRef.current(side)}`;
    let a = bowlsArt.current.get(key);
    if (!a) {
      const [wx, wy] = bowlAt(side, i, view);
      a = bowlArt(camRef.current, layers.current.k, wx, wy, GLAZE[tintRef.current(side)], 0x5eed + side * 17 + i * 101);
      bowlsArt.current.set(key, a);
    }
    return a;
  };
  /** The launch spot on the board (where your berry waits). */
  const launchPt = () => P(camRef.current, 0, Y0, Z0);
  const flyPos = (f: Fly, t: number): [number, number, number] => {
    const n = f.pts.length / 3 - 1, u = Math.max(0, Math.min(n, t / f.dt)), i = Math.min(n - 1, Math.floor(u)), k = u - i, p = f.pts;
    if (n <= 0) return [p[0], p[1], p[2]];
    return [p[i * 3] + (p[i * 3 + 3] - p[i * 3]) * k, p[i * 3 + 1] + (p[i * 3 + 4] - p[i * 3 + 1]) * k, p[i * 3 + 2] + (p[i * 3 + 5] - p[i * 3 + 2]) * k];
  };
  const addPart = (p: Partial<Part> & Pick<Part, "kind" | "x" | "y">) => { parts.current.push({ vx: 0, vy: 0, g: 0, life: 0, max: 0.6, r: 2, col: "#fff", rot: 0, vr: 0, ...p }); };

  const drawRef = useRef<(t: number, dt: number) => void>(() => {});
  drawRef.current = (now: number, dt: number) => {
    const cv = canvasRef.current, L = layers.current, cam = camRef.current; if (!cv || !L.scene) return;
    const c = cv.getContext("2d")!; const k = L.k, view = viewerRef.current(), V = vw.current;
    if (!L.berry && berryImg.current) L.berry = berrySprite(berryImg.current, k, 48);
    c.setTransform(k, 0, 0, k, 0, 0);
    const sk = shake.current > 0 ? (shake.current -= dt) / 260 : 0;
    if (sk > 0) c.translate(Math.sin(now / 22) * 1.6 * sk, Math.cos(now / 27) * 1.2 * sk);
    c.drawImage(L.scene, 0, 0, BW, cam.BH);
    // the flying berry, in the viewer's world
    const f = fly.current;
    if (cv.dataset.fly !== (f && !f.gone ? String(f.thrower) : "")) cv.dataset.fly = f && !f.gone ? String(f.thrower) : "";   // for the tests: whose berry is in the air
    let berry: { x: number; y: number; z: number; t: number } | null = null;
    if (f && !f.gone) {
      const t = (now - f.t0) / 1000, [x, y, z] = flyPos(f, t), [wx, wy, wz] = toWorld(x, y, z, f.thrower, view);
      berry = { x: wx, y: wy, z: wz, t };
    }
    // shadows: standing bowls (fading as they lift away), then the berry's on the table
    const bowlList: { side: Side; i: number; wy: number; lift: number; art: BowlArt }[] = [];
    for (const side of [0, 1] as Side[]) for (let i = 0; i < N_BOWLS; i++) {
      const key = keyOf(side, i), lt = lifts.current.get(key);
      if (!V.bowls[side][i] && lt === undefined) continue;
      const lift = lt === undefined ? 0 : Math.min(1, (now - lt) / 700);
      if (lift >= 1) continue;
      bowlList.push({ side, i, wy: bowlAt(side, i, view)[1], lift, art: artOf(side, i, view) });
    }
    for (const b of bowlList) { const s = b.art.shadow; c.globalAlpha = 1 - easeOut(b.lift); c.drawImage(s.cv, s.x, s.y, s.w, s.h); }
    c.globalAlpha = 1;
    if (berry && berry.x > -TW / 2 && berry.x < TW / 2 && berry.y > 0 && berry.y < TL && berry.z > -1) {
      // softer, wider and fainter the higher the berry is
      const sp = P(cam, berry.x, berry.y, 0), h = Math.max(0, berry.z - BR), rx = BR * sp.s * (1.1 + h * 0.025), a = 0.42 * Math.max(0, 1 - h / 70) * Math.min(1, f!.fade);
      if (a > 0.01) {
        const gx = sp.x + rx * 0.15, gy = sp.y + rx * 0.08, gr = c.createRadialGradient(gx, gy, 0, gx, gy, rx);
        gr.addColorStop(0, `rgba(30,12,2,${a.toFixed(3)})`); gr.addColorStop(h < 3 ? 0.6 : 0.2, `rgba(30,12,2,${(a * 0.6).toFixed(3)})`); gr.addColorStop(1, "rgba(30,12,2,0)");
        c.fillStyle = gr; c.save(); c.translate(gx, gy); c.scale(1, flat(berry.y, 0)); c.translate(-gx, -gy); c.beginPath(); c.arc(gx, gy, rx, 0, Math.PI * 2); c.fill(); c.restore();
      }
    }
    // bowls far to near, with the berry slotted in at its depth (above the rims, it's in front of every bowl)
    bowlList.sort((a, b) => b.wy - a.wy);
    const berryKey = berry ? (berry.z > H + 0.3 ? -1e9 : berry.y) : -1e9;
    let berryDrawn = !berry;
    const drawBerryNow = () => {
      if (!berry || !L.berry || !f) return;
      const p = P(cam, berry.x, berry.y, berry.z), size = Math.min(70, 2 * BR * VIS * p.s), a = f.fade;
      c.save(); c.globalAlpha = Math.max(0, Math.min(1, a));
      if (berry.z < 0 && !(berry.x > -TW / 2 && berry.x < TW / 2 && berry.y > 0 && berry.y < TL)) {   // dropped off the edge: hide what's under the table
        c.beginPath(); c.rect(0, 0, BW, cam.BH); tablePath(c, cam); c.clip("evenodd");
      }
      c.translate(p.x, p.y); c.rotate(berry.t * 7 * (f.thrower === view ? 1 : -1));
      c.drawImage(L.berry, -size / 2, -size / 2, size, size); c.restore();
      if (f.fire && !f.gone && a > 0.5) for (let n = 0; n < 2; n++) addPart({ kind: "flame", x: p.x + (Math.random() - 0.5) * size * 0.4, y: p.y + (Math.random() - 0.5) * size * 0.4, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 20, max: 0.32 + Math.random() * 0.2, r: size * (0.75 + Math.random() * 0.4), hot: n === 0 });
    };
    for (const b of bowlList) {
      if (!berryDrawn && berryKey > b.wy) { drawBerryNow(); berryDrawn = true; }
      const a = b.art, w = wobble.current.get(keyOf(b.side, b.i));
      let rot = 0;
      if (w) { const tt = (now - w.t0) / 1000; if (tt > 1.2) wobble.current.delete(keyOf(b.side, b.i)); else rot = w.amp * Math.exp(-tt * 6) * Math.sin(tt * 34); }
      const e = easeOut(b.lift), up = e * 12 * P(cam, 0, b.wy, 0).s;
      c.save(); c.globalAlpha = 1 - Math.max(0, (b.lift - 0.35) / 0.65);
      c.translate(a.ax, a.ay - up); if (rot || b.lift) c.rotate(rot + (b.side === view ? -1 : 1) * e * 0.18); if (b.lift) c.scale(1 + e * 0.08, 1 + e * 0.08);
      c.drawImage(a.body.cv, a.body.x - a.ax, a.body.y - a.ay, a.body.w, a.body.h);
      c.restore();
      // a berry that's just dropped in: sinking into the milk, with rings spreading
      for (const s of sinks.current) {
        if (s.side !== b.side || s.i !== b.i) continue;
        const tt = (now - s.t0) / 1000, m = a.milk;
        c.save(); c.beginPath(); c.ellipse(m.x, m.y - up, m.rx, m.ry, 0, 0, Math.PI * 2); c.clip();
        c.beginPath(); c.ellipse(a.rim.x, a.rim.y - up, a.rx * 0.92, a.ry * 0.92, 0, 0, Math.PI * 2); c.clip();   // only where the milk shows inside the rim
        if (tt < 0.5 && L.berry) { const d = easeOut(tt / 0.5), sz = s.size; c.globalAlpha = 1 - d * 0.75; c.drawImage(L.berry, s.x - sz / 2, s.y - sz / 2 + d * sz * 0.55 - up, sz, sz); }
        for (let r = 0; r < 3; r++) {
          const q = (tt - r * 0.12) / 0.8; if (q <= 0 || q >= 1) continue;
          c.globalAlpha = (1 - q) * 0.7; c.strokeStyle = "#ffffff"; c.lineWidth = 1.4 * (1 - q) + 0.4;
          c.beginPath(); c.ellipse(s.x, s.y - up, m.rx * 0.95 * q + 1, (m.ry * 0.95 * q + 1), 0, 0, Math.PI * 2); c.stroke();
          c.globalAlpha = (1 - q) * 0.35; c.strokeStyle = "rgba(120,130,150,1)"; c.lineWidth = 0.8;
          c.beginPath(); c.ellipse(s.x, s.y - up + 1, m.rx * 0.95 * q + 1, (m.ry * 0.95 * q + 1), 0, 0, Math.PI * 2); c.stroke();
        }
        c.restore();
      }
    }
    if (!berryDrawn) drawBerryNow();
    sinks.current = sinks.current.filter(s => now - s.t0 < 1200);
    // your berry, waiting at the launch spot (pulled back toward you while you drag)
    const myTurn = canActRef.current;
    const lp = launchPt();
    if (myTurn && !f && L.berry) {
      const d = drag.current, aim = d ? pullAim(d.px, d.py) : null, pull = aim && aim.ok ? aim.p : 0;
      const bob = d ? 0 : Math.sin(now / 420) * 2.2, size = 2 * BR * VIS * lp.s * (1 + pull * 0.12), bx = lp.x + (d ? Math.max(-14, Math.min(14, d.px * 0.12)) : 0), by = lp.y + bob + pull * 16;
      const halo = c.createRadialGradient(bx, by, size * 0.25, bx, by, size * 1.1); halo.addColorStop(0, "rgba(255,255,255,0.55)"); halo.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = halo; c.beginPath(); c.ellipse(bx, by, size * 1.1, size * 1.1, 0, 0, Math.PI * 2); c.fill();
      c.drawImage(L.berry, bx - size / 2, by - size / 2, size, size);
      if (V.fire[view] && Math.random() < 0.7) addPart({ kind: "flame", x: bx + (Math.random() - 0.5) * size * 0.7, y: by + size * 0.15, vx: (Math.random() - 0.5) * 14, vy: -26 - Math.random() * 24, max: 0.45 + Math.random() * 0.25, r: size * (0.55 + Math.random() * 0.35), hot: Math.random() < 0.5 });
    }
    // particles: flames glow (added light), milk drops, rim sparks, confetti
    const dts = Math.min(0.05, dt / 1000);
    parts.current = parts.current.filter(p => (p.life += dts) < p.max);
    for (const p of parts.current) { p.vy += p.g * dts; p.x += p.vx * dts; p.y += p.vy * dts; p.rot += p.vr * dts; }
    c.save(); c.globalCompositeOperation = "lighter";
    for (const p of parts.current) {
      if (p.kind !== "flame" || !L.hot || !L.warm) continue;
      const q = p.life / p.max, r = p.r * (1 - q * 0.6);
      c.globalAlpha = (1 - q) * 0.85; c.drawImage(q < 0.4 && p.hot ? L.hot : L.warm, p.x - r / 2, p.y - r / 2 - q * 6, r, r);
    }
    c.restore();
    for (const p of parts.current) {
      if (p.kind === "flame") continue;
      const q = p.life / p.max; c.globalAlpha = p.kind === "confetti" ? Math.min(1, (1 - q) * 4) : 1 - q * q;
      if (p.kind === "drop") { c.fillStyle = "rgba(150,160,180,0.6)"; c.beginPath(); c.arc(p.x + 0.4, p.y + 0.5, p.r, 0, Math.PI * 2); c.fill(); c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill(); }
      else if (p.kind === "star") {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.col; c.beginPath();
        for (let i = 0; i < 8; i++) { const rr = i % 2 ? p.r * 0.3 : p.r * (1 - q * 0.5), an = (i / 8) * Math.PI * 2; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
        c.closePath(); c.fill(); c.restore();
      } else { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(1, Math.cos(p.rot * 1.7)); c.fillStyle = p.col; c.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9); c.restore(); }
    }
    c.globalAlpha = 1;
    if (L.light) c.drawImage(L.light, 0, 0, BW, cam.BH);
    // the aim: dots along the first part of the flight (longer for more power), and last flick's dots faintly
    const dots = (px: number, py: number, alpha: number, r0: number) => {
      const a = pullAim(px, py); if (!a.ok) return;
      const v = pullV(px, py), T = 0.02 + 0.05 * a.p, n = Math.max(3, Math.round(T / 0.009));
      for (let j = 1; j <= n; j++) {
        const tt = (j / n) * T, [x, y, z] = freeAt(v, tt), p = P(cam, x, y, z), q = j / n, r = r0 * (1 - q * 0.45);
        c.globalAlpha = alpha * (1 - q * 0.55);
        c.fillStyle = "#ffffff"; c.strokeStyle = "#4F88E8"; c.lineWidth = 1.3; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill(); c.stroke();
      }
      c.globalAlpha = 1;
    };
    if (myTurn && !f) {
      const lastP = lastPull.current[view];
      if (lastP) dots(lastP.px, lastP.py, drag.current ? 0.22 : 0.3, 2.4);
      if (drag.current) dots(drag.current.px, drag.current.py, 1, 4.2);
      else if (g.current.flicks[view] === 0) drawHint(c, BW / 2, lp.y + (cam.BH - lp.y) * 0.46, "Drag Back Anywhere Here", now, GAME_FONT);
    }
  };
  useEffect(() => {
    let raf = 0, last = performance.now();
    const loop = (t: number) => { const dt = Math.max(0, Math.min(100, t - last)); last = t; drawRef.current(t, dt); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── the animation queue ────────────────────────────────────────────────
  const tween = (ms: number, f: (t: number) => void, gen: number) => new Promise<void>(res => {
    const t0 = performance.now();
    const step = (nw: number) => {
      if (genRef.current !== gen) { res(); return; }
      const t = Math.min(1, (nw - t0) / ms); f(t);
      if (t < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
  const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
  const floatWord = (text: string, x: number, y: number, col: string) => setWord({ id: Date.now() + Math.random(), text, x, y, col });
  const bigWord = (kind: "fire" | "back" | "win", text: string, col: string) => setBig({ id: Date.now() + Math.random(), kind, text, col });
  useEffect(() => { if (!word) return; const t = setTimeout(() => setWord(w => (w && w.id === word.id ? null : w)), 1250); return () => clearTimeout(t); }, [word]);
  useEffect(() => { if (!big) return; const t = setTimeout(() => setBig(b => (b && b.id === big.id ? null : b)), 1400); return () => clearTimeout(t); }, [big]);
  useEffect(() => { if (!turnPop) return; const t = setTimeout(() => setTurnPop(p => (p && p.id === turnPop.id ? null : p)), 1150); return () => clearTimeout(t); }, [turnPop]);

  /** Plays a flick's flight on the board: the berry along its path, rim wobbles and taps as it hits things, and the
   *  plop and splash if it drops in. Resolves when the berry has landed (or rolled away). */
  const playFlight = async (e: Extract<Ev, { e: "flick" }>, gen: number): Promise<Flight | null> => {
    if (!e.v) return null;
    let f = flight(e.v, e.standing, e.fire);
    if (f.bowl !== e.bowl) { console.warn("Berry Pong: this phone's flight disagreed with the thrower's; showing theirs"); f = fakeFlight(e.v, e.bowl, f); }   // can't happen with the same numbers
    const view = viewerRef.current(), target = other(e.side), sinking = f.bowl >= 0;
    const dur = sinking ? f.t * 1000 : Math.min(MISS_MS, f.t * 1000);
    const F: Fly = { pts: f.pts, dt: f.dt, dur, t0: performance.now(), thrower: e.side, fire: e.fire, fade: 1, hits: f.hits, fired: 0, gone: false };
    fly.current = F; sound.current?.flick();
    await tween(dur, t => {
      const tt = (t * dur) / 1000;
      F.fade = !sinking && f.t * 1000 > MISS_MS ? Math.min(1, (1 - t) / 0.2) : 1;
      while (F.fired < F.hits.length && F.hits[F.fired].t <= tt) {
        const h = F.hits[F.fired++];
        if (h.k === "rim" || h.k === "wall") {
          const key = keyOf(target, h.bowl), [x, y, z] = flyPos(F, h.t), [wx, wy, wz] = toWorld(x, y, z, e.side, view), p = P(camRef.current, wx, wy, wz);
          wobble.current.set(key, { t0: performance.now(), amp: h.k === "rim" ? 0.075 : 0.04 });
          if (h.k === "rim") { sound.current?.rim(); for (let n = 0; n < 5; n++) addPart({ kind: "star", x: p.x, y: p.y, vx: (Math.random() - 0.5) * 90, vy: -30 - Math.random() * 60, g: 120, max: 0.35, r: 2.6 + Math.random() * 1.6, col: "#ffffff", vr: 6 }); }
          else sound.current?.tap(0.6);
        } else if (h.k === "table") sound.current?.tap(1);
      }
    }, gen);
    if (genRef.current !== gen) return f;
    F.gone = true;
    if (sinking) {
      const a = artOf(target, f.bowl, view), [x, y, z] = toWorld(f.x, f.y, H - 1.5, e.side, view), p = P(camRef.current, x, y, z);
      const m = a.milk, sx = Math.max(m.x - m.rx * 0.6, Math.min(m.x + m.rx * 0.6, p.x)), sy = Math.max(m.y - m.ry * 0.5, Math.min(m.y + m.ry * 0.5, p.y));
      sinks.current.push({ side: target, i: f.bowl, t0: performance.now(), x: sx, y: sy, size: 2 * BR * VIS * p.s });
      sound.current?.plop(); shake.current = 160;
      const spread = a.rx * 0.9;
      for (let n = 0; n < 16; n++) {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = (60 + Math.random() * 110) * (spread / 40);
        addPart({ kind: "drop", x: sx + (Math.random() - 0.5) * 6, y: sy, vx: Math.cos(ang) * sp * 0.8, vy: Math.sin(ang) * sp, g: 520 * (spread / 40), max: 0.5 + Math.random() * 0.25, r: (1.1 + Math.random() * 1.6) * (spread / 40) + 0.6, col: "#FFFDF7" });
      }
    }
    fly.current = null;
    return f;
  };
  /** A stand-in flight into (or past) the bowl the sender said, for the rare case the two phones disagree. */
  const fakeFlight = (v: V3, bowl: number, real: Flight): Flight => {
    if (bowl < 0) return { ...real, bowl: -1, end: "stop", hits: real.hits.filter(h => h.k !== "sink"), t: Math.min(real.t, 1.2) };
    const [bx, by] = BOWLS[bowl], T = 0.8, pts: number[] = [];
    for (let i = 0; i <= 96; i++) { const t = (i / 96) * T, k = t / T; pts.push(bx * k, Y0 + (by - Y0) * k, Z0 + (H - Z0) * k + 40 * k * (1 - k)); }
    return { pts, dt: T / 96, hits: [{ t: T, k: "sink", bowl }], bowl, end: "sink", rims: 0, x: bx, y: by, t: T };
  };

  const whyMissed = (f: Flight | null) => {
    if (!f) return "Time's Up";
    if (f.rims > 0) return "Rim Out!";
    if (f.end === "off") return f.y > TL ? "Too Long" : "Off The Table";
    return f.y < BOWLS[5][1] - 9 ? "Too Short" : "Just Missed";
  };
  const sinkWord = (f: Flight | null) => (!f ? "Sunk!" : f.hits.some(h => h.k === "table") ? "Bounce Shot!" : f.rims > 0 ? "Off The Rim And In!" : "Sunk It!");

  const play = async (evs: Ev[], after: State, gen: number) => {
    const V = vw.current, alive = () => genRef.current === gen;
    let lastFlight: Flight | null = null;
    for (const e of evs) {
      if (!alive()) return;
      if (e.e === "flick") {
        V.flick = e.n + 1; setTurnPop(null); bump();
        if (!e.v) {
          const lp = launchPt(), them = autoFlick.current === "theirs"; autoFlick.current = null;
          floatWord(them ? `${who(e.side)} Ran Out Of Time` : "Time's Up", lp.x, them ? 60 : lp.y - 40, "#5A6B85"); await wait(700); lastFlight = null; continue;
        }
        lastFlight = await playFlight(e, gen);
      } else if (e.e === "sink") {
        const view = viewerRef.current(), target = other(e.side), a = artOf(target, e.bowl, view);
        const top = Math.min(...BOWLS.map((_, j) => { const b = artOf(target, j, view); return b.rim.y - b.ry; }));   // above the whole triangle
        floatWord(sinkWord(lastFlight), BW / 2, Math.max(24, top - 34), isMe(e.side) ? "#2F5FB0" : "#B9486A");
        setMsg(isMe(e.side) && opp !== "phone" ? (e.left === 1 ? "One Bowl Left!" : `Sunk One! ${e.left} To Go.`) : `${who(e.side)} Sank One. ${e.left} Left.`);
        await wait(330);
        if (!alive()) return;
        lifts.current.set(keyOf(target, e.bowl), performance.now()); sound.current?.lift();
        for (let n = 0; n < 10; n++) addPart({ kind: "star", x: a.rim.x + (Math.random() - 0.5) * a.rx * 2, y: a.rim.y + (Math.random() - 0.5) * a.ry * 2, vx: (Math.random() - 0.5) * 50, vy: -40 - Math.random() * 50, max: 0.7, r: 2.4 + Math.random() * 2.4, col: n % 2 ? "#FFFFFF" : COL[tint(e.side)].hi, vr: 4 });
        await wait(780);
        V.bowls[target][e.bowl] = false; lifts.current.delete(keyOf(target, e.bowl)); bump();
      } else if (e.e === "miss") {
        if (lastFlight) { const [x, y] = [lastFlight.x, lastFlight.y], view = viewerRef.current(), [wx, wy] = toWorld(x, y, 0, e.side, view), p = P(camRef.current, Math.max(-TW / 2, Math.min(TW / 2, wx)), Math.max(8, Math.min(TL - 4, wy)), 4); floatWord(whyMissed(lastFlight), Math.max(60, Math.min(BW - 60, p.x)), Math.max(40, Math.min(camRef.current.BH - 40, p.y - 26)), "#5A6B85"); sound.current?.out(); }
        setMsg(isMe(e.side) && opp !== "phone" ? "Missed." : `${who(e.side)} Missed.`);
        await wait(lastFlight ? 480 : 200);
      } else if (e.e === "fire") {
        V.fire[e.side] = e.on; bump();
        if (e.on) { sound.current?.fire(); bigWord("fire", "On Fire!", "#E8572A"); setMsg(isMe(e.side) && opp !== "phone" ? "On Fire! The Bowls Are Easier To Hit." : `${who(e.side)} Is On Fire!`); await wait(1000); }
        else { const lp = launchPt(); if (isMe(e.side)) floatWord("Fire's Out", lp.x, lp.y - 52, "#8A6A5A"); await wait(250); }
      } else if (e.e === "back") {
        sound.current?.back(); bigWord("back", "Berries Back!", "#4F88E8");
        setMsg(isMe(e.side) && opp !== "phone" ? "Both In! You Go Again." : `Both In! ${who(e.side)} Goes Again.`);
        V.flick = 0; bump(); await wait(1300);
      } else if (e.e === "win") {
        const good = opp === "phone" || e.side === mySide;
        if (good) sound.current?.win(); else sound.current?.lose();
        for (let n = 0; n < (good ? 90 : 34); n++) addPart({ kind: "confetti", x: Math.random() * BW, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 160, g: 60, max: 2.6 + Math.random() * 1.2, r: 4 + Math.random() * 3, col: CONFETTI[n % CONFETTI.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10 });
        bigWord("win", opp === "phone" ? `${nameOf(e.side)} Wins!` : e.side === mySide ? "You Win!" : opp === "cpu" ? "The Computer Wins" : `${nameOf(e.side)} Wins`, good ? "#4F88E8" : "#5A6B85");
        await wait(1500);
      } else if (e.e === "turn") {
        V.turn = e.side; V.flick = 0;
        if (opp === "phone") { setFlip(x => x + 1); await wait(260); }
        bump(); await wait(opp === "phone" ? 120 : 260);
        if (!alive()) return;
        showTurn(e.side);
      }
    }
    if (!alive()) return;
    vw.current = viewOf(after); bump();
  };

  const enqueue = (evs: Ev[], after: State) => {
    const gen = genRef.current; pending.current++; setBusy(true);
    chain.current = chain.current.then(() => play(evs, after, gen)).catch(err => console.error(err)).then(() => {
      if (genRef.current !== gen) return;
      pending.current = Math.max(0, pending.current - 1);
      if (pending.current === 0) { setBusy(false); idleRef.current(); }
    });
  };
  /** Stops every animation and clears the board's effects (a new game, or catching up to a snapshot). */
  const halt = () => {
    genRef.current++; pending.current = 0; chain.current = Promise.resolve(); setBusy(false);
    fly.current = null; sinks.current = []; lifts.current.clear(); wobble.current.clear(); parts.current = []; drag.current = null;
    setWord(null); setBig(null); setTurnPop(null); setAiming(false);
  };
  const showTurn = (side: Side) => {
    setTurnPop({ id: Date.now(), side });
    if (isMe(side)) sound.current?.turn();
    const fire = g.current.fire[side];
    setMsg(isMe(side) ? (fire ? "You're On Fire. Drag Back And Let Go." : "Drag Back Under Your Berry And Let Go.") : opp === "cpu" ? "The Computer Is Lining Up..." : `Waiting For ${nameOf(side)} To Flick...`);
  };

  // when the queue runs dry: the game may be over, or it's someone's flick (the live clock starts now)
  const idleRef = useRef(() => {});
  idleRef.current = () => {
    turnAt.current = Date.now();
    const G = g.current;
    if (G.winner !== null && phaseRef.current === "play") { finishMatch(G.winner); return; }
    if (phaseRef.current === "play" && isMe(G.turn) && G.winner === null) {
      const n = FLICKS - G.flick;
      setMsg(G.fire[G.turn] ? `On Fire! ${n === 1 ? "Last Berry This Turn." : "2 Berries This Turn."}` : n === 1 ? "Last Berry This Turn." : opp === "phone" ? `${nameOf(G.turn)}: Drag Back And Let Go.` : "Drag Back Under Your Berry And Let Go.");
    }
  };

  /** Applies a flick (yours, the computer's, or one from your friend's phone) and queues its animation. */
  const act = (a: Action, from: "local" | "remote" = "local") => {
    const out = apply(g.current, a); if (!out) return false;
    g.current = out.s; log.current.push(a);
    if (opp === "live" && from === "local") send({ t: "act", round: meRef.current?.round ?? round, i: log.current.length - 1, a });
    enqueue(out.ev, out.s);
    return true;
  };
  /** A flick from a pull (yours, on this phone): fly it here, then share the launch and the result. */
  const flickFrom = (px: number, py: number) => {
    const G = g.current, t = G.turn, v = pullV(px, py), f = flight(v, G.bowls[other(t)], G.fire[t]);
    lastPull.current[t] = { px, py }; lastFlickAt.current = performance.now();
    act({ k: "flick", v, bowl: f.bowl });
  };

  // ── starting things ────────────────────────────────────────────────────
  const resetBoard = (first: Side = 0) => {
    halt();
    g.current = newState(first); vw.current = viewOf(g.current); log.current = []; lastPull.current = [null, null];
    setFinal(null); bump();
  };
  const todayRecord = (): Final | null => { try { const v = localStorage.getItem(todayKey); return v ? JSON.parse(v) : null; } catch { return null; } };
  const startCpu = () => {
    const daily = mode === "daily";
    if (daily && todayRecord()) { setFinal(todayRecord()); go("doneToday"); return; }
    cpuRng.current = mulberry32(daily ? dailySeed(CPU_SALT) : Math.floor(Math.random() * 1e9));
    runRef.current = { round: 1, score: 0, flicks: 0, sinks: 0, fires: 0, backs: 0, last: 0 };
    resetBoard(0); runStart.current = performance.now(); setRound(1); go("play"); showTurn(0);
  };
  const nextRound = () => {
    const r = runRef.current.round + 1; runRef.current.round = r;
    resetBoard(0); setRound(r); go("play"); showTurn(0);
  };
  const startPhone = () => {
    const a = names[0].trim() || shell.player?.name || "Player 1", b = names[1].trim() || "Player 2";
    setNames([a, b]); resetBoard(0); go("play"); showTurn(0);
  };
  useEffect(() => {
    if (opp === "cpu") {
      resetBoard(0);
      if (mode === "daily" && todayRecord()) { setFinal(todayRecord()); go("doneToday"); }
      else if (autoStart.current) { autoStart.current = false; startCpu(); }
      else go("start");
    } else if (opp === "phone") { resetBoard(0); go("names"); }
    else if (resuming.current) resuming.current = false;               // picking a saved live match back up: keep it
    else { resetBoard(0); go("idle"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, opp, run]);

  const forgetLive = () => { try { sessionStorage.removeItem(LIVE_KEY); localStorage.removeItem(LIVE_KEY); } catch {} };
  const leaveRoom = () => {
    const ch = chRef.current;
    if (ch) { ch.send({ type: "broadcast", event: "m", payload: { t: "bye", round: meRef.current?.round ?? 0 } }); setTimeout(() => sb().removeChannel(ch), 200); }
    chRef.current = null; pairedWith.current = null; lastOpp.current = null;
    if (awayT.current) clearTimeout(awayT.current); awayT.current = null;
    forgetLive(); setReconnecting(false); setRoom({ status: "idle" });
  };
  const leaveRef = useRef(leaveRoom); leaveRef.current = leaveRoom;
  useEffect(() => () => leaveRef.current(), []);
  const pickOpp = (o: Opp) => { if (o === opp) return; if (opp === "live") leaveRoom(); setOpp(o); };
  const pickMode = (m: Mode) => { if (opp === "live") leaveRoom(); setMode(m); if (opp !== "cpu") setOpp("cpu"); else setRun(r => r + 1); };
  // the ways to play live on the start card; Change (the row under the header), Back and Change Game Mode come back to it,
  // asking first if a game is going, and a live room is left cleanly
  const [leaving, setLeaving] = useState(false);
  const toStart = () => { setLeaving(false); setJoinInput(""); if (opp === "live") leaveRoom(); if (opp !== "cpu") setOpp("cpu"); else setRun(r => r + 1); };
  const change = () => (phase === "play" || phase === "between" ? setLeaving(true) : toStart());
  const choosing = opp === "cpu" && (phase === "start" || phase === "doneToday");
  const { held, setHeld } = shell;
  useEffect(() => { if (opp !== "cpu" && held) setHeld(false); }, [opp, held, setHeld]);
  const paused = opp === "cpu" && (shell.paused || leaving);

  // ── the end ────────────────────────────────────────────────────────────
  const finishMatch = (winner: Side) => {
    if (phaseRef.current !== "play") return;
    if (opp === "cpu") {
      const G = g.current, won = winner === 0, R0 = runRef.current;
      const pts = matchScore(won, G.sinks[0], G.flicks[0], left(G, 0));
      R0.score += pts; R0.flicks += G.flicks[0]; R0.sinks += G.sinks[0]; R0.fires += G.fires[0]; R0.backs += G.backs[0]; R0.last = pts;
      if (won && mode === "endless") { go("between"); bump(); return; }
      endRun(won, left(G, 0));
      return;
    }
    if (opp === "live") forgetLive();
    go("over");
  };
  /** Ends a run against the computer: the game-over card, and the score to the scoreboard. */
  const endRun = (won: boolean, bowlsLeft: number) => {
    const R0 = runRef.current;
    const f: Final = { score: R0.score, won, round: R0.round, sinks: R0.sinks, flicks: R0.flicks, fires: R0.fires, backs: R0.backs, left: bowlsLeft };
    setFinal(f); go("over");
    if (R0.score > readBest(bestKey)) { saveBest(bestKey, R0.score); setBest(R0.score); }
    if (mode === "daily") try { localStorage.setItem(todayKey, JSON.stringify(f)); } catch {}
    shell.finishRef.current({ score: R0.score, drops: R0.flicks, ms: performance.now() - runStart.current });
  };

  // the computer's flick: line it up a moment, then let go
  useEffect(() => {
    if (opp !== "cpu" || phase !== "play" || busy || paused) { setAiming(false); return; }
    const G = g.current; if (G.winner !== null || G.turn !== 1) return;
    setAiming(true);
    const t = setTimeout(() => {
      const H2 = g.current;
      if (phaseRef.current !== "play" || busyRef.current || H2.turn !== 1 || H2.winner !== null) return;
      setAiming(false);
      const standing = H2.bowls[0], v = cpuFlick(standing, cpuRng.current, cpuWobble(mode === "daily" ? 1 : runRef.current.round, H2.flicks[1]));
      act({ k: "flick", v, bowl: flight(v, standing, H2.fire[1]).bowl });
    }, G.flick === 1 ? 950 : 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp, phase, busy, paused, g.current.seq]);

  // ── your flick ─────────────────────────────────────────────────────────
  const G = g.current, V = vw.current;
  const turnSide = V.turn;
  const live = opp === "live";
  const linkOk = !live || (room.status === "paired" && !reconnecting);
  const canAct = phase === "play" && !busy && G.winner === null && G.turn === V.turn && isMe(G.turn) && !paused && linkOk;
  canActRef.current = canAct;
  const toBoard = (e: React.PointerEvent) => { const r = canvasRef.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * BW, y: ((e.clientY - r.top) / r.height) * camRef.current.BH }; };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    sound.current?.unlock();
    if (!canActRef.current || drag.current) return;
    const p = toBoard(e), lp = launchPt();
    if (p.y < lp.y + 2 * BR * VIS * lp.s * 0.5 + 10) { setMsg("Drag Back From Below Your Berry."); return; }   // below the berry, so your finger never covers it
    drag.current = { sx: p.x, sy: p.y, px: 0, py: 0, id: e.pointerId };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current; if (!d || e.pointerId !== d.id) return;
    const p = toBoard(e); let px = p.x - d.sx, py = p.y - d.sy;
    const l = Math.hypot(px, py), max = 132; if (l > max) { px = (px / l) * max; py = (py / l) * max; }
    d.px = px; d.py = py;
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current; if (!d || e.pointerId !== d.id) return;
    onMove(e); drag.current = null;
    if (!canActRef.current) return;
    const a = pullAim(d.px, d.py);
    if (!a.ok) { if (Math.hypot(d.px, d.py) > 4) setMsg(d.py <= 4 ? "Drag Down, Toward You, To Flick." : "Pull A Little Further."); return; }
    if (performance.now() - lastFlickAt.current < MIN_FLICK_MS) return;
    flickFrom(d.px, d.py);
  };
  const onCancel = () => { drag.current = null; };
  useEffect(() => { if (!canAct) drag.current = null; }, [canAct]);

  // ── live ───────────────────────────────────────────────────────────────
  const send = (m: Msg) => { chRef.current?.send({ type: "broadcast", event: "m", payload: m }); };
  const trackSoon = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setMeta = (p: Partial<Meta>) => {
    if (!meRef.current) return; meRef.current = { ...meRef.current, ...p, seq: Math.max(Date.now(), meRef.current.seq + 1) };
    send({ t: "meta", round: meRef.current.round, meta: meRef.current });
    if (!trackSoon.current) trackSoon.current = setTimeout(() => { trackSoon.current = null; if (meRef.current) chRef.current?.track(meRef.current); }, 250);
  };
  const takeSnap = (): Snap => ({ round: meRef.current?.round ?? round, log: [...log.current], from: meRef.current?.id ?? "" });
  const takeSnapRef = useRef(takeSnap); takeSnapRef.current = takeSnap;
  const sendResume = () => { const sn = takeSnapRef.current(); send({ t: "resume", round: sn.round, snap: sn }); setReconnecting(true); setTimeout(() => setReconnecting(false), 4000); };
  const liveNow = (): SavedLive => ({ code: room.code ?? "", id: meRef.current?.id ?? "", at: meRef.current?.at ?? 0, host: hostRef.current, friendId: pairedWith.current ?? "",
    round: meRef.current?.round ?? round, snap: takeSnap(), t: Date.now() });
  const liveNowRef = useRef(liveNow); liveNowRef.current = liveNow;

  const joinRoom = (code: string, resume?: SavedLive | null) => {
    if (chRef.current) sb().removeChannel(chRef.current);
    const prior = resume ?? readLive(code);
    if (!resume) { pairedWith.current = null; heard.current = null; }
    const me: Meta = { id: prior?.id ?? Math.random().toString(36).slice(2, 10), name: storedName(), at: prior?.at ?? Date.now(), round: resume ? resume.round : 1,
      seq: Date.now(), ok: !!resume, stage: resume ? "game" : "gate" };
    setMyOk(!!resume);
    meRef.current = me;
    if (resume) { setReconnecting(true); setRoom(v => ({ ...v, status: v.status === "away" ? "away" : "paired", code })); } else setRoom({ status: "connecting", code });
    const ch = sb().channel(`${GAME}:${code}`, { config: { broadcast: { self: false }, presence: { key: me.id } } });
    chRef.current = ch;
    let tracked = false;
    const track = () => { if (tracked || chRef.current !== ch) return; tracked = true; ch.track(meRef.current!); };
    const full = () => { setRoom({ status: "full", code }); sb().removeChannel(ch); if (chRef.current === ch) chRef.current = null; };
    ch.on("presence", { event: "sync" }, () => {
      if (chRef.current !== ch) return;
      const metas = Object.values(ch.presenceState<Meta>()).map(a => a[a.length - 1] as unknown as Meta).filter(m => m && typeof m.id === "string");
      if (!tracked) { if (metas.filter(m => m.id !== me.id).length >= 2) full(); else track(); return; }
      if (!metas.some(m => m.id === me.id)) return;
      const seats = metas.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1)).slice(0, 2);
      if (!seats.some(m => m.id === me.id)) { full(); return; }
      let o = seats.find(m => m.id !== me.id) ?? null;
      if (o && heard.current?.id === o.id && heard.current.seq > (o.seq ?? 0)) o = heard.current;   // presence hasn't caught up yet
      const bye = Date.now() - byeAt.current < BYE_MS;
      if (bye && o && o.id === pairedWith.current) o = null;            // they tapped Leave: gone, even if presence lags the "bye"
      const host = seats[0].id === me.id;
      // seats stay put for the whole match: while the friend is away, this phone doesn't become the host
      if (o || !pairedWith.current) hostRef.current = host;
      if (o) lastOpp.current = o;
      if (!o && !bye && pairedWith.current && ["play", "over", "rematch"].includes(phaseRef.current)) {   // gone mid-match: give them 60 seconds
        if (!awayT.current) {
          const until = Date.now() + AWAY_MS;
          awayT.current = setTimeout(() => { awayT.current = null; setRoom(v => (v.status === "away" ? { ...v, status: "waiting", opp: null, until: undefined } : v)); }, AWAY_MS);
          setRoom({ status: "away", code, opp: null, host: hostRef.current, until });
        }
        return;
      }
      if (o && awayT.current) { clearTimeout(awayT.current); awayT.current = null; }
      setRoom({ status: o ? "paired" : "waiting", code, opp: o, host });
    });
    ch.on("broadcast", { event: "m" }, ({ payload }) => onMsgRef.current(payload as Msg));
    ch.subscribe(status => {
      if (chRef.current !== ch) return;
      if (status === "SUBSCRIBED") {
        setTimeout(track, resume ? 0 : 1500);
        if (pairedWith.current) setTimeout(() => sendResume(), 500);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (pairedWith.current) { setReconnecting(true); setTimeout(() => { if (chRef.current === ch) joinRoom(code, liveNowRef.current()); }, 1500); }
        else setRoom({ status: "error", code });
      }
    });
  };

  /** Starts round r of a live match on this phone (both phones do the same, so they agree). */
  const beginLive = (r: number) => {
    setRound(r); resetBoard(firstOf(r)); go("play"); turnAt.current = Date.now(); showTurn(firstOf(r));
  };
  /** Takes the friend's list of flicks: plays the last few if they just carry on from ours, otherwise jumps to it. */
  const adoptLog = (nl: Action[], animate = true) => {
    const L = log.current, carriesOn = nl.length > L.length && L.every((a, k) => same(a, nl[k]));
    if (animate && carriesOn && nl.length - L.length <= 3 && phaseRef.current === "play") { for (const a of nl.slice(L.length)) act(a, "remote"); return; }
    const s = replay(firstOf(meRef.current?.round ?? round), nl); if (!s) return;
    halt();
    g.current = s; log.current = [...nl]; vw.current = viewOf(s); bump();
    if (s.winner !== null) { if (phaseRef.current === "play") finishMatch(s.winner); else go("over"); }
    else { if (phaseRef.current !== "play") go("play"); setMsg(s.turn === (hostRef.current ? 0 : 1) ? "Back In The Game. Your Turn." : "Back In The Game. Their Turn."); }   // live only: this phone's seat
    turnAt.current = Date.now();
  };
  // keep the live match saved (cleared when it ends or you leave), so a reload can pick it back up
  useEffect(() => {
    if (opp !== "live" || !pairedWith.current || !room.code) return;
    if (phase === "play") { const v = JSON.stringify(liveNow()); try { sessionStorage.setItem(LIVE_KEY, v); localStorage.setItem(LIVE_KEY, v); } catch {} }
    else if (phase === "over") forgetLive();
  });
  const backRef = useRef(() => {});
  backRef.current = () => {
    if (document.visibilityState !== "visible" || opp !== "live" || !pairedWith.current || !room.code) return;
    const ch = chRef.current as unknown as { state?: string } | null, rt = sb().realtime;
    if (!rt.isConnected() || !ch || ch.state !== "joined") { joinRoom(room.code, liveNow()); if (!rt.isConnected()) void rt.disconnect().catch(() => {}).then(() => rt.connect()); }
    else { chRef.current?.track(meRef.current!); sendResume(); }
  };
  useEffect(() => {
    const f = () => backRef.current();
    document.addEventListener("visibilitychange", f); window.addEventListener("pageshow", f); window.addEventListener("online", f);
    return () => { document.removeEventListener("visibilitychange", f); window.removeEventListener("pageshow", f); window.removeEventListener("online", f); };
  }, []);
  const resuming = useRef(false);
  const rejoining = useRef<SavedLive | null>(null);
  const rejoinNow = (sv: SavedLive) => {
    resuming.current = opp !== "live"; setOffer(null); setOpp("live");
    meRef.current = { id: sv.id, name: storedName(), at: sv.at, round: sv.round, seq: Date.now(), ok: true, stage: "game" };
    pairedWith.current = sv.friendId; heard.current = null; hostRef.current = sv.host;
    rejoining.current = sv; bump();   // the rest happens once the page has switched to Play A Friend (see below)
  };
  useEffect(() => {
    const sv = rejoining.current; if (opp !== "live" || !sv) return;
    rejoining.current = null;
    beginLive(sv.round); adoptLog(sv.snap.log, false);
    joinRoom(sv.code, sv);
  });
  // a shared link (?room=ABCD) joins that room straight away, or picks a saved match back up
  useEffect(() => {
    const code = cleanCode(new URLSearchParams(window.location.search).get("room") ?? "");
    const sv = readLive();
    if (sv && (!validCode(code) || code === sv.code)) { if (validCode(code)) rejoinNow(sv); else setOffer(sv); return; }
    if (validCode(code)) { setOpp("live"); joinRoom(code); }
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const roomLink = (code: string) => `${typeof window === "undefined" ? "https://whatyouate.app" : window.location.origin}/games/${GAME}?room=${code}`;

  // a friend arrived: both see the Get Ready card, then round 1
  const oppId = room.status === "paired" ? room.opp?.id ?? null : null;
  useEffect(() => {
    if (opp !== "live" || !oppId || pairedWith.current === oppId) return;
    pairedWith.current = oppId; setMyOk(false); setMeta({ ok: false, stage: "gate", round: 1 });
    resetBoard(0); go("gate"); bump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oppId, opp]);
  useEffect(() => {
    if (opp === "live" && room.status === "waiting" && meRef.current && (meRef.current.ok || meRef.current.stage === "game")) { setMyOk(false); setMeta({ ok: false, stage: "gate" }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp, room.status]);
  const oppOk = !!room.opp?.ok, oppStage = room.opp?.stage, oppRound = room.opp?.round ?? 0;
  useEffect(() => {
    if (opp !== "live" || phase !== "gate" || room.status !== "paired" || !myOk || !oppOk) return;
    if (room.host) { setMeta({ stage: "game" }); beginLive(1); }
    else if (oppStage === "game") beginLive(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp, phase, room.status, room.host, myOk, oppOk, oppStage]);
  // a rematch starts once both have asked for the same round
  useEffect(() => {
    if (opp === "live" && phase === "rematch" && room.status === "paired" && oppRound === (meRef.current?.round ?? 0)) beginLive(oppRound);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp, phase, room.status, oppRound]);
  const markOk = () => { if (myOk) return; sound.current?.unlock(); setMyOk(true); setMeta({ ok: true }); };
  const askRematch = () => { const r = (meRef.current?.round ?? round) + 1; setMeta({ round: r }); go("rematch"); };

  const onMsg = (m: Msg) => {
    if (m?.t === "bye") {
      byeAt.current = Date.now();
      if (awayT.current) clearTimeout(awayT.current); awayT.current = null;
      setRoom(v => ({ ...v, status: "waiting", opp: null, until: undefined })); return;
    }
    if (m?.t === "meta") {
      if (heard.current?.id === m.meta.id && heard.current.seq >= m.meta.seq) return;
      heard.current = m.meta;
      setRoom(v => (v.status === "paired" && v.opp?.id === m.meta.id ? { ...v, opp: m.meta } : v)); return;
    }
    const myRound = meRef.current?.round ?? 0;
    if (m?.t === "resume" || m?.t === "state") {
      if (!pairedWith.current || m.snap.from !== pairedWith.current) return;
      if (m.t === "resume") { const mine = takeSnap(); send({ t: "state", round: mine.round, snap: mine }); }
      else setReconnecting(false);
      if (m.snap.round > myRound && ["over", "rematch"].includes(phaseRef.current)) { setMeta({ round: m.snap.round }); beginLive(m.snap.round); }
      else if (m.snap.round !== myRound || !["play", "over"].includes(phaseRef.current)) return;
      const theirs = m.snap.log, mine = log.current;
      if (theirs.length > mine.length || (theirs.length === mine.length && !hostRef.current && !theirs.every((a, k) => same(a, mine[k])))) adoptLog(theirs);
      return;
    }
    if (m?.t !== "act" || m.round !== myRound || phaseRef.current !== "play") return;
    const L = log.current;
    if (m.i === L.length) { if (!act(m.a, "remote")) sendResume(); return; }
    if (m.i < L.length) {
      if (same(L[m.i], m.a)) return;                                   // heard it already
      if (!hostRef.current) adoptLog([...L.slice(0, m.i), m.a]);       // we both acted at once: the host's version stands
      else { const mine = takeSnap(); send({ t: "state", round: mine.round, snap: mine }); }
      return;
    }
    sendResume();                                                       // we missed one: catch up
  };
  const onMsgRef = useRef(onMsg); onMsgRef.current = onMsg;
  // the flick clock: 30 seconds, then that berry is a miss (your friend's phone steps in if yours has gone quiet)
  useEffect(() => {
    if (opp !== "live" || phase !== "play") return;
    const t = setInterval(() => {
      if (room.status === "away" || reconnecting || busyRef.current) { turnAt.current += 250; setNow(Date.now()); return; }
      const H2 = g.current; if (H2.winner !== null) return;
      const el = Date.now() - turnAt.current;
      if (room.status === "paired") {
        if (H2.turn === mySide && el > TURN_MS) { autoFlick.current = "mine"; drag.current = null; act({ k: "flick", v: null, bowl: -1 }); }
        else if (H2.turn !== mySide && el > TURN_MS + (hostRef.current ? GRACE_MS : GRACE_MS * 2)) { autoFlick.current = "theirs"; act({ k: "flick", v: null, bowl: -1 }); }
      }
      setNow(Date.now());
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp, phase, room.status, reconnecting, mySide]);
  useEffect(() => { if (room.status !== "away") return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [room.status]);

  // ── share ──────────────────────────────────────────────────────────────
  const n = dailyNumber(LAUNCH);
  const shareCpu = (f: Final) => {
    const label = mode === "daily" ? `Berry Pong #${n} (Today's Challenge)` : "Berry Pong (Free Play)";
    const how = mode === "daily" ? (f.won ? `Beat the computer with ${f.left} ${f.left === 1 ? "bowl" : "bowls"} left 🎉` : "The computer cleared my bowls this time.")
      : f.won ? `Beat ${f.round} rounds 🎉` : `Made it to round ${f.round}.`;
    shell.share(`${label}\n${how}\n${f.score.toLocaleString()} pts · ${f.sinks} of ${f.flicks} berries in\nCan you beat it? whatyouate.app/games/${GAME}`);
  };
  const shareDuel = (winner: Side) => {
    const L0 = left(G, other(winner)) === 0 ? left(G, winner) : 0;
    const head = opp === "phone" ? `${nameOf(winner)} beat ${nameOf(other(winner))} with ${L0} ${L0 === 1 ? "bowl" : "bowls"} left 🎉` : winner === mySide ? `I beat ${nameOf(other(mySide))} with ${L0} ${L0 === 1 ? "bowl" : "bowls"} left 🎉` : `${nameOf(winner)} beat me this time`;
    shell.share(`Berry Pong (${opp === "phone" ? "Same Phone" : "Play A Friend"})\n${head}\nPlay a friend: whatyouate.app/games/${GAME}`);
  };
  const factFor = (f: Final): Toast => FACTS[(mode === "daily" ? dailySeed(FACT_SALT) : f.score + f.flicks) % FACTS.length];

  // ── drawing ────────────────────────────────────────────────────────────
  const card = (children: ReactNode, title?: ReactNode) => <OverlayCard title={title} max="max-w-[340px]" z="z-20">{children}</OverlayCard>;
  const liveCard = (): ReactNode => {
    if (opp !== "live" && offer) return card(<>
      <div className="wk-f text-[26px] leading-tight">Rejoin Your Game</div>
      <p className="mt-1 text-sm text-[#5a6b85]">You were in the middle of a live match in room {offer.code}.</p>
      <button onClick={() => rejoinNow(offer)} className={`${UI.btn} mt-4 h-[50px] w-full text-[19px]`}>Rejoin</button>
      <button onClick={() => { forgetLive(); setOffer(null); }} className={`${UI.link} mt-2 w-full py-2 text-[15px]`}>No Thanks</button>
    </>);
    if (opp === "live" && room.status === "away") return card(<>
      <div className="wk-f text-[26px] leading-tight">{nameOf(other(mySide))} Stepped Away...</div>
      <div className="mt-1 text-sm font-semibold text-[#4F88E8]">Waiting For Them To Come Back</div>
      <div className="wk-f mt-2 text-[44px] leading-none tabular-nums text-[#4F88E8]">{Math.max(0, Math.ceil(((room.until ?? 0) - now) / 1000))}s</div>
      <p className="mt-2 text-sm text-[#5a6b85]">The game is paused. It picks up right where you left off when they&apos;re back.</p>
      <button onClick={() => { leaveRoom(); setJoinInput(""); go("idle"); }} className={`${UI.link} mt-3 w-full py-2 text-[15px]`}>Leave Room</button>
    </>);
    if (opp !== "live" || (room.status === "paired" && phase !== "idle")) return null;
    const code = room.code ?? "";
    if (room.status === "idle") return card(<>
      <div className="wk-f text-[28px] leading-tight">Play A Friend</div>
      <p className="mt-1 text-sm text-[#5a6b85]">Make a room and send your friend the link, or type their code.</p>
      <button onClick={() => { sound.current?.unlock(); joinRoom(newCode()); }} className={`${UI.btn} mt-4 h-[50px] w-full text-[19px]`}>Make A Room</button>
      <div className="mt-4 flex gap-2">
        <input value={joinInput} onChange={e => setJoinInput(cleanCode(e.target.value))} placeholder="CODE" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
          className="wk-input min-w-0 flex-1 px-4 py-2.5 text-center font-mono text-lg font-bold uppercase tracking-[0.3em]" />
        <button disabled={!validCode(joinInput)} onClick={() => { sound.current?.unlock(); joinRoom(joinInput); }} className={`${UI.navy} px-5 text-[17px]`}>Join</button>
      </div>
      {joinInput.length === 4 && !validCode(joinInput) && <p className="mt-2 text-xs font-semibold text-[#d64545]">That code doesn&apos;t look right. Check it again.</p>}
      <button onClick={toStart} className={`${UI.link} mt-3 w-full py-2 text-[15px]`}>Back</button>
    </>);
    if (room.status === "connecting") return card(<><div className="wk-f text-[26px] leading-tight">Joining Room {code}</div><p className="mt-2 text-sm text-[#5a6b85]">One moment...</p></>);
    if (room.status === "full") return card(<>
      <div className="wk-f text-[26px] leading-tight">Room Full</div>
      <p className="mt-1 text-sm text-[#5a6b85]">Room {code} already has two players. Make your own room instead.</p>
      <button onClick={() => { setRoom({ status: "idle" }); setJoinInput(""); }} className={`${UI.btn} mt-4 h-[50px] w-full text-[19px]`}>Back</button>
    </>);
    if (room.status === "error") return card(<>
      <div className="wk-f text-[26px] leading-tight">Couldn&apos;t Connect</div>
      <p className="mt-1 text-sm text-[#5a6b85]">Check your connection and try again.</p>
      <button onClick={() => joinRoom(code)} className={`${UI.btn} mt-4 h-[50px] w-full text-[19px]`}>Try Again</button>
      <button onClick={leaveRoom} className={`${UI.link} mt-2 w-full py-2 text-[15px]`}>Back</button>
    </>);
    const gone = !!pairedWith.current;
    return card(<>
      <div className="wk-f text-[26px] leading-tight">{gone ? "Your Friend Left" : "Your Room"}</div>
      <p className="mt-1 text-sm text-[#5a6b85]">{gone ? "Waiting for them to come back. If they rejoin, you'll start a fresh game." : "Send your friend the link, or have them type this code."}</p>
      <div className="wk-f mt-3 text-[46px] leading-none tracking-[0.2em] text-[#0E1F45]">{code}</div>
      <button onClick={() => shell.share(`Play Berry Pong with me! Room ${code}\n${roomLink(code)}`)} className={`${UI.btn} mt-4 h-[50px] w-full text-[19px]`}>{shell.copied ? "Link Copied!" : "Share The Link"}</button>
      <p className="mt-3 text-xs font-semibold text-[#5a6b85]">Waiting For Your Friend To Join...</p>
      <button onClick={() => { leaveRoom(); setJoinInput(""); }} className={`${UI.link} mt-1 w-full py-2 text-[15px]`}>Leave Room</button>
    </>);
  };

  const winner = G.winner;
  const statLine = (f: Final) => `${f.sinks} Of ${f.flicks} Berries In${f.fires ? ` · On Fire ${f.fires}x` : ""}${f.backs ? ` · Berries Back ${f.backs}x` : ""}`;
  const overlay = (): ReactNode => {
    if (leaving) return <LeaveCard live={live} onLeave={toStart} onStay={() => setLeaving(false)} />;
    const lc = liveCard(); if (lc) return lc;
    if (live && phase === "gate" && room.status === "paired") return (
      <ReadyCard me={myName === "Guest" ? "You" : myName} friend={nameOf(other(mySide))} ready={[myOk, oppOk]} onReady={markOk}
        onLeave={() => { leaveRoom(); setJoinInput(""); go("idle"); }} steps={[
          "Drag back under your berry and let go to flick it at your friend's bowls.",
          "You get 2 berries a turn. Sink both for Berries Back, another turn.",
          "Sink 2 in a row and you're On Fire until you miss.",
          "Clear all 6 of their bowls to win. You get 30 seconds a flick.",
        ]} />
    );
    if (opp === "cpu" && phase === "start") return card(<>
      <div className="wk-f text-[32px] leading-none text-[#0E1F45]">Berry Pong</div>
      <p className="mt-2 text-[14px] leading-snug text-[#5a6b85]">Flick blueberries into the computer&apos;s cereal bowls. Sink all six before it sinks yours.</p>
      <div className="mt-3 flex items-center justify-center gap-3">
        <RackIcon standing={Array(6).fill(true)} color={COL[0].lo} edge={COL[0].lip} near size={44} />
        <span className="wk-f text-[13px] uppercase tracking-[0.12em] text-[#8A9AB5]">vs</span>
        <RackIcon standing={Array(6).fill(true)} color={COL[1].lo} edge={COL[1].lip} near={false} size={44} />
      </div>
      <PlayChoices onCpu={() => { sound.current?.unlock(); startCpu(); }} onFriend={() => pickOpp("live")} onPhone={() => pickOpp("phone")} />
    </>, mode === "daily" ? `Today's Challenge #${n}` : "Free Play");
    if (opp === "cpu" && phase === "between") {
      const R0 = runRef.current;
      return card(<>
        <div className="wk-f text-[30px] leading-tight text-[#0E1F45]">Round {R0.round} Won!</div>
        <div className="wk-f mt-1 text-[18px] text-[#4F88E8]">+{R0.last.toLocaleString()} Points</div>
        <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-[#EAF2FF] px-3 py-2">
          <span className="wk-hud-label">Total</span><span className="wk-f text-[22px] leading-none tabular-nums">{R0.score.toLocaleString()}</span>
        </div>
        <p className="mt-3 text-[14px] leading-snug text-[#5a6b85]">Round {R0.round + 1} next. The computer&apos;s hand gets a little steadier.</p>
        <button onClick={() => { sound.current?.unlock(); nextRound(); }} className={`${UI.go} wk-pulse mt-4 h-[54px] w-full text-[22px]`}><PlayIcon size={18} />Next Round</button>
        <button onClick={() => endRun(true, left(g.current, 0))} className={`${UI.link} mt-2 w-full py-2 text-[15px]`}>Stop And Save My Score</button>
      </>, "Free Play");
    }
    if (opp === "cpu" && phase === "over" && final) {
      const headline = mode === "daily" ? (final.won ? (final.left === 6 ? "A Clean Sweep!" : `You Won With ${final.left} ${final.left === 1 ? "Bowl" : "Bowls"} Left!`) : "The Computer Cleared Your Bowls")
        : final.won ? `You Banked ${final.round} ${final.round === 1 ? "Round" : "Rounds"}` : final.round === 1 ? "The Computer Took Round 1" : `You Reached Round ${final.round}`;
      return (
        <GameOver label={mode === "daily" ? `Today's Challenge #${n}` : "Free Play"} headline={headline} score={final.score} best={best} mode={mode}
          posted={shell.scores.posted} joined={!!shell.player} campaign={GAME} copied={shell.copied} fact={factFor(final)}
          extra={<><p className="mt-3 text-[13px] font-semibold text-[#5a6b85]">{statLine(final)}</p><ChangeModeLink onClick={toStart} className="mt-1" /></>}
          pitch="What you eat changes how you feel. WhatYouAte shows you how your meals affect your energy."
          onBoard={() => shell.setBoardOpen(true)} onJoin={() => shell.setJoinOpen(true)}
          onAgain={() => { autoStart.current = true; if (mode === "daily") pickMode("endless"); else setRun(r => r + 1); }} onShare={() => shareCpu(final)} />
      );
    }
    if (opp === "cpu" && phase === "doneToday" && final) return card(<>
      <div className="wk-f text-[15px] tracking-wide text-[#3F7FD6]">Today&apos;s Challenge #{n}</div>
      <div className="wk-f mt-1 text-[26px] leading-tight">Today&apos;s Match Is Played</div>
      <div className="wk-f mt-1 text-[44px] leading-none tabular-nums">{final.score.toLocaleString()}</div>
      <p className="mt-1 text-sm text-[#5a6b85]">{final.won ? `You won with ${final.left} ${final.left === 1 ? "bowl" : "bowls"} left.` : "The computer won this one."} A new match at midnight.</p>
      <div className="mt-4 flex gap-2">
        <button onClick={() => { autoStart.current = true; pickMode("endless"); }} className={`${UI.btn} h-[48px] flex-1 text-[18px]`}>Free Play</button>
        <button onClick={() => shareCpu(final)} className={`${UI.btn2} h-[48px] flex-1 text-[18px]`}><ShareIcon size={17} className="shrink-0" />{shell.copied ? "Copied!" : "Share"}</button>
      </div>
      <PlayChoices onFriend={() => pickOpp("live")} onPhone={() => pickOpp("phone")} />
    </>);
    if (opp === "phone" && phase === "names") return card(<>
      <div className="wk-f text-[28px] leading-tight">Same Phone</div>
      <p className="mt-1 text-sm text-[#5a6b85]">Take turns on this phone. The table turns round to whoever is flicking. Who&apos;s playing?</p>
      {([0, 1] as Side[]).map(k => (
        <div key={k} className="mt-3 flex items-center gap-2.5 rounded-2xl p-2.5" style={{ background: k === 0 ? "#eaf2ff" : "#ffeef0" }}>
          <RackIcon standing={Array(6).fill(true)} color={COL[k].lo} edge={COL[k].lip} near size={34} />
          <input value={names[k]} maxLength={14} placeholder={k === 0 ? (shell.player?.name || "Player 1") : "Player 2"}
            onChange={e => setNames(nm => (k === 0 ? [e.target.value, nm[1]] : [nm[0], e.target.value]))}
            className="wk-input min-w-0 flex-1 px-3 py-2 text-base" style={{ borderColor: COL[k].hi }} />
        </div>
      ))}
      <button onClick={() => { sound.current?.unlock(); startPhone(); }} className={`${UI.go} mt-4 h-[52px] w-full text-[20px]`}>Start</button>
      <button onClick={toStart} className={`${UI.link} mt-2 w-full py-2 text-[15px]`}>Back</button>
    </>);
    if (opp !== "cpu" && (phase === "over" || phase === "rematch") && winner !== null) {
      const w = nameOf(winner), mine = opp === "live" && winner === mySide;
      const head = opp === "live" ? (mine ? "You Win!" : `${w} Wins`) : `${w} Wins!`;
      const theyWant = live && phase === "over" && oppRound > (meRef.current?.round ?? round);
      const kept = left(G, winner);
      return card(<>
        <div className="wk-f text-[15px] tracking-wide text-[#3F7FD6]">{opp === "phone" ? "Same Phone" : "Play A Friend"}</div>
        <div className="mt-2 flex justify-center"><RackIcon standing={G.bowls[winner]} color={colOf(winner).lo} edge={colOf(winner).lip} near size={60} /></div>
        <div className="wk-f mt-2 text-[32px] leading-tight">{head}</div>
        <p className="mt-1 text-sm text-[#5a6b85]">{opp === "live" && winner === mySide ? "You" : w} cleared all 6 with {kept} of {opp === "live" && winner === mySide ? "your" : "their"} own {kept === 1 ? "bowl" : "bowls"} still standing.</p>
        {theyWant && <p className="wk-f mt-2 rounded-2xl bg-[#e3effe] px-3 py-2 text-[15px] text-[#4F88E8]">{nameOf(other(mySide))} Wants A Rematch!</p>}
        {phase === "rematch" ? (
          <p className="wk-f mt-4 text-[16px] text-[#4F88E8]">Waiting For {nameOf(other(mySide))} To Say Rematch...</p>
        ) : (
          <div className="mt-4 flex gap-2">
            <button onClick={() => (opp === "phone" ? startPhone() : askRematch())} className={`${UI.btn} h-[48px] flex-1 text-[18px]`}><ReplayIcon size={17} className="shrink-0" />Rematch</button>
            <button onClick={() => shareDuel(winner)} className={`${UI.btn2} h-[48px] flex-1 text-[18px]`}><ShareIcon size={17} className="shrink-0" />{shell.copied ? "Copied!" : "Share"}</button>
          </div>
        )}
        <button onClick={() => { if (opp === "phone") go("names"); else { leaveRoom(); setJoinInput(""); go("idle"); } }} className={`${UI.link} mt-2 w-full py-2 text-[15px]`}>
          {opp === "phone" ? "Change Players" : "Leave Room"}</button>
        <ChangeModeLink onClick={toStart} />
      </>);
    }
    return null;
  };

  // ── the board ──────────────────────────────────────────────────────────
  const view = viewer();
  const turnPopText = turnPop ? turnLabel(turnPop.side) + (isMe(turnPop.side) && opp !== "phone" ? "!" : "") : "";
  const popInk = turnPop ? (opp === "phone" ? COL[turnPop.side].ink : isMe(turnPop.side) ? "#2F5FB0" : "#101B2E") : "";
  const theirAim = phase === "play" && !isMe(V.turn) && !busy && G.winner === null && (opp === "cpu" ? aiming : true);

  const board = () => (
    <div className="relative shrink-0" data-board data-phase={phase} data-busy={busy ? 1 : 0} data-turn={V.turn} data-flick={V.flick} data-can={canAct ? 1 : 0}
      data-winner={G.winner ?? ""} data-seq={G.seq} data-left={`${left(G, 0)},${left(G, 1)}`} data-bowls={`${G.bowls[0].map(Number).join("")},${G.bowls[1].map(Number).join("")}`} data-view={view} data-fire={`${G.fire[0] ? 1 : 0}${G.fire[1] ? 1 : 0}`}
      data-bh={BH} style={{ width: boardW, height: boardH }}>
      <div className="absolute inset-0 overflow-hidden rounded-[14px]" style={{ boxShadow: "0 12px 28px -12px rgba(16,42,86,0.55), 0 0 0 1px rgba(60,35,15,0.35)" }}>
        <canvas ref={canvasRef} className="absolute inset-0 touch-none" style={{ width: boardW, height: boardH }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel} onLostPointerCapture={onCancel} />
        {flip > 0 && <div key={flip} className="bp-flip pointer-events-none absolute inset-0 bg-white" />}
      </div>
      {theirAim && (
        <div className="bp-chip wk-f pointer-events-none absolute left-1/2 top-2 z-[6] flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/95 py-1 pl-1 pr-3 text-[13px] text-[#101B2E] shadow-[0_6px_16px_-8px_rgba(16,27,46,0.5)]" data-aiming>
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full" style={{ background: COL[1].lo }}><BerryDot size={16} /></span>
          {opp === "cpu" ? "Computer Is Aiming" : `${nameOf(V.turn)} Is Aiming`}
          <span>{[0, 1, 2].map(k => <span key={k} className="bp-dot" style={{ animationDelay: `${k * 0.2}s` }}>.</span>)}</span>
        </div>
      )}
      {word && (
        <div key={word.id} className="bp-float wk-f pointer-events-none absolute z-[8] whitespace-nowrap rounded-full bg-white/95 px-3 py-1 text-[15px] shadow-[0_6px_16px_-8px_rgba(16,27,46,0.55)]"
          style={{ left: word.x * S, top: word.y * S, color: word.col }} data-word>{word.text}</div>
      )}
      {big && (
        <div key={big.id} className="pointer-events-none absolute inset-0 z-[9] flex items-center justify-center" style={{ paddingBottom: boardH * 0.18 }} data-big={big.kind}>
          <span className="bp-big wk-f flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-5 py-2.5 shadow-[0_18px_40px_-16px_rgba(16,27,46,0.6)]"
            style={{ fontSize: Math.max(24, Math.min(34, boardW * 0.085)), color: big.col }}>
            {big.kind === "fire" && <span className="bp-flame inline-flex"><FlameIcon size={34} /></span>}
            {big.kind === "back" && <span className="flex gap-0.5"><BerryDot size={26} /><BerryDot size={26} /></span>}
            {big.text}
          </span>
        </div>
      )}
      {turnPop && turnPopText && !big && (
        <div key={turnPop.id} className="pointer-events-none absolute inset-0 z-[10] flex items-center justify-center" style={{ paddingBottom: boardH * 0.12 }}>
          <span className="bp-turnpop wk-f whitespace-nowrap text-white" style={{ fontSize: Math.min(48, (boardW * 1.5) / Math.max(8, turnPopText.length)), textShadow: outline(popInk) }}>{turnPopText}</span>
        </div>
      )}
    </div>
  );

  // the tray under the board: each side's rack, and the berries left this turn between them
  const rack = (side: Side, near: boolean) => {
    const col = colOf(side), label = opp === "phone" ? nameOf(side) : side === mySide ? "You" : opp === "cpu" ? "Computer" : nameOf(side);
    return (
      <div className={`flex min-w-0 items-center gap-2 ${near ? "" : "flex-row-reverse text-right"}`} data-rack={side}>
        <RackIcon standing={V.bowls[side]} color={col.lo} edge={col.lip} near={near} size={short ? 34 : 38} />
        <div className="min-w-0">
          <div className="wk-f max-w-[96px] truncate text-[11px] uppercase leading-none tracking-[0.06em]" style={{ color: col.lip }}>{label}</div>
          <div className="wk-f mt-0.5 text-[15px] leading-none tabular-nums text-[#101B2E]">{V.bowls[side].filter(Boolean).length} Left</div>
        </div>
      </div>
    );
  };
  const tray = () => {
    const near: Side = opp === "phone" ? view : mySide, far = other(near);
    const thrower = V.turn, used = phase === "play" ? V.flick : 0, fire = phase === "play" && V.fire[thrower];
    return (
      <div className="flex shrink-0 items-center justify-between gap-2 rounded-2xl bg-white px-2.5 shadow-[0_0_0_1px_#E3EDFB,0_8px_20px_-14px_rgba(31,70,140,0.35)]" style={{ width: boardW, height: TRAY }} data-tray>
        {rack(near, true)}
        <div className="flex shrink-0 flex-col items-center gap-1" data-pips={FLICKS - used}>
          <div className="flex items-center gap-1">{Array.from({ length: FLICKS }, (_, k) => <BerryDot key={k} size={short ? 18 : 20} dim={k < used} />)}</div>
          {fire ? <span className="wk-f flex items-center gap-0.5 text-[11px] leading-none text-[#E8572A]"><FlameIcon size={12} />On Fire</span>
            : <span className="wk-hud-label">{phase === "play" ? (isMe(thrower) && opp !== "phone" ? "Your Berries" : opp === "phone" ? "Berries" : "Their Berries") : "Berries"}</span>}
        </div>
        {rack(far, false)}
      </div>
    );
  };

  // the turn banner: solid blue when it's yours, plain white when it's theirs (Same Phone: the player's own colour)
  const myTurnNow = phase === "play" && isMe(turnSide) && opp !== "phone";
  const lit = opp === "phone" || myTurnNow;
  const bannerBg = opp === "phone" ? COL[turnSide].lo : myTurnNow ? "#6FA8FF" : "#ffffff";
  const bannerShadow = lit ? `0 14px 28px -14px ${opp === "phone" ? COL[turnSide].lip : "rgba(79,136,232,0.9)"}` : "0 0 0 1px #E3EDFB, 0 8px 20px -14px rgba(31,70,140,0.35)";
  const secsLeft = live && phase === "play" ? Math.max(0, Math.min(30, Math.ceil((TURN_MS - (now - turnAt.current)) / 1000))) : 0;
  const inGame = phase === "play" || phase === "over" || phase === "rematch" || phase === "between";

  return (
    <GameScreen>
      <GameHeader title="Berry Pong" mode={mode} onMode={pickMode} onBoard={() => shell.setBoardOpen(true)} onHelp={shell.help.show} />

      <ModeRow label={choosing ? "Choose How To Play" : opp === "cpu" ? "Vs The Computer" : opp === "phone" ? "Same Phone" : "Live With A Friend"}
        onChange={choosing ? undefined : change} />

      {inGame ? (
        <div className="mt-2 flex shrink-0 items-center gap-2 rounded-2xl px-3 transition-colors duration-300" data-banner={myTurnNow ? "mine" : "theirs"}
          style={{ height: short ? 48 : 54, background: bannerBg, boxShadow: bannerShadow }}>
          <div className="min-w-0 flex-1">
            <div className={`wk-f flex items-baseline gap-1 truncate text-[21px] leading-none ${lit ? "text-white" : "text-[#101B2E]"}`}>
              <span className="truncate">{phase === "play" ? turnLabel(turnSide) : phase === "between" ? `Round ${runRef.current.round} Won` : winner !== null ? (opp === "phone" ? `${nameOf(winner)} Wins!` : winner === mySide ? "You Win!" : opp === "cpu" ? "Computer Wins" : `${nameOf(winner)} Wins`) : ""}</span>
              {phase === "play" && !isMe(turnSide) && <span className="shrink-0">{[0, 1, 2].map(k => <span key={k} className="bp-dot" style={{ animationDelay: `${k * 0.2}s` }}>.</span>)}</span>}
              {phase === "play" && V.fire[turnSide] && <span className="bp-flame ml-0.5 inline-flex shrink-0 self-center"><FlameIcon size={18} /></span>}
            </div>
            <div className={`mt-1 truncate text-[12px] font-medium leading-tight ${lit ? "text-white/90" : "text-[#5A6B85]"}`}>{phase === "play" ? msg : phase === "between" ? "On To The Next Round." : "Good Game!"}</div>
          </div>
          {opp === "cpu" && mode === "endless" && phase === "play" && <span className={`wk-f shrink-0 rounded-full px-2.5 py-1 text-[12px] ${lit ? "bg-white/25 text-white" : "bg-[#EAF2FF] text-[#4F88E8]"}`}>Round {round}</span>}
          {opp === "cpu" && <PauseButton shell={shell} active={phase === "play"} />}
          {live && phase === "play" && (
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full" aria-label={`${secsLeft} seconds left`} data-timer={secsLeft}
              style={{ background: `conic-gradient(${secsLeft <= 10 ? "#FF7A93" : lit ? "#ffffff" : "#6FA8FF"} ${(secsLeft / 30) * 360}deg, ${lit ? "rgba(255,255,255,0.28)" : "#E3EDFB"} 0)` }}>
              <div className="wk-f flex h-[32px] w-[32px] items-center justify-center rounded-full text-[15px] tabular-nums text-white" style={{ background: lit ? "#4F88E8" : "#101B2E" }}>{secsLeft}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="wk-f mt-2 flex shrink-0 items-center justify-center rounded-2xl bg-white px-3 text-center text-[18px] text-[#101B2E] shadow-[0_0_0_1px_#E3EDFB,0_8px_20px_-14px_rgba(31,70,140,0.35)]" style={{ height: short ? 48 : 54 }}>
          {opp === "cpu" ? (phase === "doneToday" ? "See You Tomorrow" : "Clear Their Bowls") : opp === "phone" ? "Two Players, One Phone" : "Play Live On Two Phones"}
        </div>
      )}

      <BoardArea wrapRef={wrapRef} size={area} reserve={0}>
        <div className="flex h-full w-full flex-col items-center" style={{ gap: GAP }}>
          {S > 0 && board()}
          {S > 0 && tray()}
        </div>
        {opp === "cpu" && <PrizeLogo shell={shell} active={phase === "play" && !shell.paused} />}
        {opp === "cpu" && <PausedCard shell={shell} active={phase === "play"} />}
        {overlay()}
        {live && reconnecting && room.status !== "away" && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center">
            <div className="wk-f rounded-full bg-white/95 px-4 py-2 text-[15px] text-[#4F88E8] shadow-md">Reconnecting...</div>
          </div>
        )}
        <style>{BP_CSS}</style>
      </BoardArea>

      <ShellPopups shell={shell} game={GAME} todayNote="Today's Challenge: the same computer for everyone. Resets at midnight." />

      {shell.help.open && (
        <HelpModal onClose={shell.help.close} steps={[
          "Drag back anywhere under your berry and let go to flick it. The dots show your aim and power.",
          "Land it in one of the other side's cereal bowls to sink it. That bowl comes off the table.",
          <span key="b">You get 2 berries a turn. Sink both and you get <b>Berries Back</b>: another turn.</span>,
          <span key="f">Sink 2 in a row and you&apos;re <b>On Fire</b>: the bowls are a little easier to hit until you miss. Clear all 6 to win.</span>,
        ]}>
          <ModesHelp today="everyone faces the same computer today. One match: win with more of your bowls left and fewer misses for more points." free="beat the computer to move on to the next round. It gets a little sharper each round." />
        </HelpModal>
      )}
    </GameScreen>
  );
}

/** A chunky outline for display text (text-shadow in eight directions, plus a drop). */
function outline(c: string, o = 2.5) {
  const d = o * 0.7;
  return [`${o}px 0 0 ${c}`, `-${o}px 0 0 ${c}`, `0 ${o}px 0 ${c}`, `0 -${o}px 0 ${c}`, `${d}px ${d}px 0 ${c}`, `-${d}px ${d}px 0 ${c}`, `${d}px -${d}px 0 ${c}`, `-${d}px -${d}px 0 ${c}`, `0 ${o + 3}px 0 ${c}`].join(", ");
}
