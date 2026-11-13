"use client";

// Blenders & Bacon: a two-player food race up a pantry shelving unit. Roll the die and your food hops square by square
// along the shelves (left to right on shelf 1, right to left on shelf 2, and so on up to 96). Blenders whirl you up their
// tubes, bacon strips slide you down, and gold Pantry Card squares hand you a card (Double Roll, Swap Places, or the
// Oven Mitt that saves you from the next bacon by itself). First to reach or pass 96 wins. The rules live in
// bacon/rules.ts, the drawn art in bacon/art.tsx, and the balance check in bacon/sim.ts.
// Three ways to play:
//  - Computer: Today (everyone gets the same dice today, for both sides; fewer turns scores more, a win scores most) or
//    Free Play (new dice every game). Scores go on the scoreboard (game_score_problem's "blenders-bacon" limits:
//    drops = your turns, at least 1.5 s each, and the score has to match scoreFor in bacon/rules.ts).
//  - Same Phone: two names, one phone. The board and the cards are public, so there's no pass card: the banner says
//    whose turn it is.
//  - Play A Friend: a 4-letter room over Supabase Realtime (channel "blenders-bacon:ABCD", presence for who's in). The
//    player whose turn it is rolls on their own phone and sends the roll; both phones apply it with the same rules and
//    animate it the same way. A match is just the list of actions so far, so catching up after a reload or a dropped
//    connection is sending that list: the longer one wins, and the host's wins a tie. Get Ready card first, 60 seconds of
//    "Stepped Away" with the clock stopped, and a 30 second turn timer that rolls for you.
/* eslint-disable react-hooks/refs, react-hooks/purity, react-hooks/immutability, react-hooks/set-state-in-effect --
   Turn-based like Fridge Raid: the match lives in mutable refs (g, vw, log) that handlers, timers, the animation queue
   and Realtime callbacks all update, then bump() re-renders. */
import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sb } from "@/components/creators/api";
import { type Mode, GameScreen, GameHeader, BoardArea, PrizeLogo, GameOver, PauseButton, PausedCard, ReadyCard, HelpModal, ModesHelp, ShellPopups,
  OverlayCard, UI, useGameShell, dailySeed, dailyNumber, torontoDate, mulberry32, readBest, saveBest, foodPng } from "./kit";
import { BB_CSS } from "./bacon/skin";
import { CloseIcon, PlayIcon, ReplayIcon, ShareIcon } from "./icons";
import { BoardArt, BlenderArt, BW, BH, spotOf, blenderGeo, tubeAt, tubeD, tubeLen, baconAt, baconD, baconLen, CARD_INFO, CardIcon, DieIcon, SoundIcon, type Pt } from "./bacon/art";
import { apply, cpuCard, newState, cloneState, canPlay, scoreFor, other, LAST, type State, type Action, type Ev, type Side, type Card } from "./bacon/rules";
import { Particles } from "./bacon/fx";
import { Sound } from "./bacon/sound";

const GAME = "blenders-bacon";
const LAUNCH = "2026-11-13";                 // Today's Challenge #1 (move to launch day)
const DICE_SALT = 0x5b1e7, CPU_SALT = 0x3ac0d, PICK_SALT = 0x7e11a;
const FOODS = [
  { code: "1fad0", name: "Blueberry" }, { code: "1f353", name: "Strawberry" }, { code: "1f95a", name: "Egg" },
  { code: "1f345", name: "Tomato" }, { code: "1f951", name: "Avocado" }, { code: "1f34a", name: "Orange" },
];
// you're always blue and they're always red (Same Phone: player 1 blue, player 2 red)
const COL = [{ hi: "#9CC4FF", lo: "#6FA8FF", lip: "#4F88E8", ink: "#2F5FB0" }, { hi: "#FFA8B8", lo: "#FF7A93", lip: "#E0577A", ink: "#8F2440" }];   // the WhatYouAte blue, and the soft pink the other games use for the other player
const TOK = 74;                              // a token's box, in board units
const HOP_MS = 235;
const GAP = 8;

type Opp = "cpu" | "phone" | "live";
type Phase = "start" | "names" | "idle" | "gate" | "play" | "rematch" | "over" | "doneToday";
type Final = { score: number; won: boolean; turns: number; square: number; blenders: number; bacon: number; mitts: number };
type View = State & { die: number | null };
type Stats = { blenders: [number, number]; bacon: [number, number]; mitts: [number, number] };
const newStats = (): Stats => ({ blenders: [0, 0], bacon: [0, 0], mitts: [0, 0] });
const viewOf = (s: State, die: number | null = null): View => ({ ...cloneState(s), die });

// live play
const CODE_LETTERS = "BCDFGHJKMNPQRSTVWXZ";   // no vowels (no accidental words), no I, L or O
const TURN_MS = 30000, GRACE_MS = 8000, AWAY_MS = 60000;
type Meta = { id: string; name: string; at: number; round: number; seq: number; ok: boolean; stage: "gate" | "game"; food: string };
type Room = { status: "idle" | "connecting" | "waiting" | "paired" | "away" | "full" | "error"; code?: string; opp?: Meta | null; host?: boolean; until?: number };
type Snap = { round: number; log: Action[]; from: string };
type SavedLive = { code: string; id: string; at: number; host: boolean; friendId: string; round: number; food: string; snap: Snap; t: number };
type Msg =
  | { t: "act"; round: number; i: number; a: Action }   // action number i of this round (the roller's die, or a card)
  | { t: "meta"; round: number; meta: Meta }            // the same seat info as presence, sent straight away
  | { t: "resume"; round: number; snap: Snap }          // back from a break: here's what I have
  | { t: "state"; round: number; snap: Snap }           // and here's what I have (each keeps the longer; host wins a tie)
  | { t: "bye"; round: number };                        // tapped Leave: gone for good
const LIVE_KEY = "blenders-bacon-live";
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

// motion
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeBack = (t: number) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const raf = () => new Promise<void>(r => requestAnimationFrame(() => r()));
const PIPS: Record<number, number[]> = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export default function BlendersBacon() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [mode, setMode] = useState<Mode>("daily");
  const [opp, setOpp] = useState<Opp>("cpu");
  const [run, setRun] = useState(0);
  const [phase, setPhaseState] = useState<Phase>("start");
  const phaseRef = useRef<Phase>("start");
  const go = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const g = useRef<State>(newState(0));                 // the match, applied the moment an action happens
  const vw = useRef<View>(viewOf(g.current));           // what the board shows; catches up as the animations play
  const log = useRef<Action[]>([]);
  const stats = useRef<Stats>(newStats());
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [msg, setMsg] = useState("");
  const [busy, setBusyState] = useState(false);
  const busyRef = useRef(false);
  const setBusy = (v: boolean) => { busyRef.current = v; setBusyState(v); };
  const [foods, setFoods] = useState<[string, string]>([FOODS[0].code, FOODS[1].code]);   // by side
  const [myFood, setMyFood] = useState(FOODS[0].code);
  const [names, setNames] = useState<[string, string]>(["", ""]);
  const [sel, setSel] = useState<Card | null>(null);   // a card picked, waiting for Play
  const [final, setFinal] = useState<Final | null>(null);
  const [best, setBest] = useState(0);
  const [round, setRound] = useState(1);
  const [turnPop, setTurnPop] = useState<{ id: number; side: Side } | null>(null);
  const [dieFx, setDieFx] = useState<{ id: number; v: number; side: Side; out: boolean } | null>(null);
  const [cardFx, setCardFx] = useState<{ id: number; card: Card; side: Side; kind: "got" | "play" | "full" | "mitt"; at: Pt } | null>(null);
  const [fx, setFx] = useState<{ whirl?: number; tube?: number; sheen?: number }>({});
  const [word, setWord] = useState<{ id: number; text: string; at: Pt; col: string } | null>(null);
  const runStart = useRef(0);                         // when this match against the computer began, for the scoreboard's time check
  const [soundOn, setSoundOn] = useState(false);
  const sound = useRef<Sound | null>(null);
  const parts = useRef(new Particles());
  const tokEl = useRef<(HTMLDivElement | null)[]>([null, null]);
  const tokIn = useRef<(HTMLDivElement | null)[]>([null, null]);
  const tokSh = useRef<(HTMLDivElement | null)[]>([null, null]);
  const cubeRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const genRef = useRef(0);                             // bumps on every reset, so an old animation stops where it is
  const chain = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const rngs = useRef<{ dice: [() => number, () => number]; pick: () => number }>({ dice: [Math.random, Math.random], pick: Math.random });
  const autoStart = useRef(false);
  const shell = useGameShell(GAME, mode);
  const bestKey = mode === "daily" ? `blendersbacon-daily-${torontoDate()}` : "blendersbacon-endless";
  const todayKey = `blendersbacon-today-${torontoDate()}`;
  useEffect(() => { setBest(readBest(bestKey)); }, [bestKey]);
  useEffect(() => { sound.current = new Sound(); setSoundOn(!sound.current.muted); }, []);
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
  const [reconnecting, setReconnecting] = useState(false);
  const [offer, setOffer] = useState<SavedLive | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [now, setNow] = useState(0);
  const turnAt = useRef(0);
  const autoRoll = useRef<"mine" | "theirs" | null>(null);   // the clock ran out and rolled for this turn

  // the board fills the space, with the tray (cards and the Roll button) right under it
  useEffect(() => {
    const el = wrapRef.current!; const f = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect();
  }, []);
  const [short, setShort] = useState(false);          // a short phone (iPhone SE): a slimmer banner and tray, so the board gets the room
  useEffect(() => { const f = () => setShort(window.innerHeight < 720); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const TRAY = short ? 76 : 84;
  const S = area.w > 0 ? Math.max(0.2, Math.min(area.w / BW, (area.h - TRAY - GAP) / BH)) : 0;
  const sRef = useRef(0); sRef.current = S;
  const boardW = BW * S, boardH = BH * S;
  const rowW = Math.min(area.w, Math.max(boardW, 336));
  useEffect(() => { if (S > 0) parts.current.attach(canvasRef.current, BW, BH, S); }, [S]);
  useEffect(() => () => parts.current.stop(), []);

  // ── who's who ──────────────────────────────────────────────────────────
  const mySide: Side = opp === "live" ? (hostRef.current ? 0 : 1) : 0;
  const friendMeta = room.opp ?? lastOpp.current;
  const nameOf = (s: Side) => opp === "cpu" ? (s === 0 ? "You" : "The Computer")
    : opp === "phone" ? (names[s] || `Player ${s + 1}`)
    : s === mySide ? (myName === "Guest" ? "You" : myName) : (friendMeta?.name && friendMeta.name !== "Guest" ? friendMeta.name : "Your Friend");
  /** "You" or the other side's name, for messages. */
  const who = (s: Side) => (opp === "phone" ? nameOf(s) : s === mySide ? "You" : opp === "cpu" ? "The Computer" : nameOf(s));
  const colOf = (s: Side) => (opp === "phone" ? COL[s] : COL[s === mySide ? 0 : 1]);
  const foodOf = (s: Side) => (opp === "live" ? (s === mySide ? myFood : friendMeta?.food ?? FOODS[1].code) : foods[s]);
  const isMe = (s: Side) => opp === "phone" || s === mySide;   // a side this phone plays
  const turnLabel = (s: Side) => (opp === "phone" ? `${nameOf(s)}'s Turn` : s === mySide ? "Your Turn" : opp === "cpu" ? "Computer's Turn" : `${nameOf(s)}'s Turn`);

  // ── tokens ─────────────────────────────────────────────────────────────
  /** Where a token rests: its square, nudged aside (and a touch smaller) when both share one. */
  const restOf = (side: Side, pos: [number, number]) => {
    const n = pos[side], p = spotOf(n, side);
    if (n > 0 && n === pos[other(side)]) return { x: p.x + (side === 0 ? -15 : 15), y: p.y + (side === 0 ? -1 : 1), k: 0.84 };
    return { ...p, k: 1 };
  };
  const tokTransform = (x: number, y: number, k: number) => {
    const s = sRef.current, size = TOK * s;
    return `translate3d(${(x * s - size / 2).toFixed(2)}px, ${(y * s - size * 0.8).toFixed(2)}px, 0) scale(${k.toFixed(3)})`;
  };
  /** Moves a token straight on the page (no re-render): `lift` raises the food off its shadow, `sq` squashes it. */
  const place = (side: Side, x: number, y: number, k = 1, lift = 0, rot = 0, sq = 1) => {
    const el = tokEl.current[side], inn = tokIn.current[side], sh = tokSh.current[side], s = sRef.current;
    if (!el || !inn) return;
    el.style.transform = tokTransform(x, y, k);
    inn.style.transform = `translateY(${(-lift * s).toFixed(2)}px) rotate(${rot.toFixed(1)}deg) scale(${(1 / Math.sqrt(sq)).toFixed(3)}, ${sq.toFixed(3)})`;
    if (sh) { sh.style.transform = `scale(${Math.max(0.45, 1 - lift / 70).toFixed(3)})`; sh.style.opacity = Math.max(0.25, 1 - lift / 80).toFixed(2); }
  };
  const moving = (side: Side, on: boolean) => {
    const el = tokEl.current[side]; if (!el) return;
    el.style.transition = on ? "none" : ""; el.style.zIndex = on ? "6" : "";
    if (!on) { const inn = tokIn.current[side]; if (inn) inn.style.transform = ""; const sh = tokSh.current[side]; if (sh) { sh.style.transform = ""; sh.style.opacity = ""; } }
  };
  /** Puts both tokens where the view says (the CSS transition glides them there). */
  const settle = () => {
    for (const side of [0, 1] as Side[]) {
      moving(side, false);
      const r = restOf(side, vw.current.pos), el = tokEl.current[side];
      if (el) el.style.transform = tokTransform(r.x, r.y, r.k);
    }
  };
  useEffect(() => { settle(); }, [S]);   // eslint-disable-line react-hooks/exhaustive-deps

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
  const floatWord = (text: string, at: Pt, col: string) => setWord({ id: Date.now() + Math.random(), text, at, col });

  const rollDie = async (v: number, side: Side, gen: number) => {
    // the faces it shows on the way: quick flips at first, slowing down, ending on the roll
    const seq: number[] = []; let last = 0;
    for (let k = 0; k < 8; k++) { let f = 1 + Math.floor(Math.random() * 6); if (f === last || (k === 7 && f === v)) f = (f % 6) + 1; seq.push(f); last = f; }
    seq.push(v);
    const id = Date.now(), dir = Math.random() < 0.5 ? -1 : 1;
    setDieFx({ id, v: seq[0], side, out: false }); setTurnPop(null); sound.current?.roll();
    setMsg(autoRoll.current === "mine" ? "Time's Up! Rolling For You..." : autoRoll.current === "theirs" ? `${who(side)} Ran Out Of Time. Rolling For Them...` : isMe(side) && opp !== "phone" ? "Rolling..." : `${who(side)} ${opp === "phone" ? "Rolls" : "Is Rolling"}...`);
    autoRoll.current = null;
    await raf();
    let shown = 0;
    await tween(920, t => {
      const el = cubeRef.current; if (!el) return;
      const p = Math.pow(t, 0.62) * (seq.length - 0.001), k = Math.floor(p), edge = p - k;
      if (k !== shown) { shown = k; setDieFx(d => (d && d.id === id ? { ...d, v: seq[k] } : d)); }
      const e = easeOut(t), spin = (1 - e) * 600 * dir + Math.sin(edge * Math.PI) * 14 * (1 - t) * dir;
      const hop = t < 0.5 ? -Math.sin((t / 0.5) * Math.PI) * 46 : t < 0.8 ? -Math.sin(((t - 0.5) / 0.3) * Math.PI) * 11 : -Math.sin(((t - 0.8) / 0.2) * Math.PI) * 3;
      const roll = 1 - Math.sin(edge * Math.PI) * 0.22 * (1 - t), land = t > 0.47 && t < 0.55 ? 0.9 : 1;
      el.style.transform = `translateY(${hop.toFixed(1)}px) rotate(${spin.toFixed(1)}deg) scale(${(roll * (2 - land)).toFixed(3)}, ${(land * (2 - roll)).toFixed(3)})`;
    }, gen);
    if (genRef.current !== gen) return;
    setDieFx(d => (d && d.id === id ? { ...d, v } : d));
    setMsg(side === mySide || opp === "phone" ? `${opp === "phone" ? nameOf(side) + " Rolled" : "You Rolled"} A ${v}!` : `${who(side)} Rolled A ${v}.`);
    await wait(380);
    setDieFx(d => (d && d.id === id ? { ...d, out: true } : d));
    setTimeout(() => setDieFx(d => (d && d.id === id ? null : d)), 240);
  };

  const hop = async (side: Side, from: number, to: number, gen: number) => {
    moving(side, true);
    const start = restOf(side, vw.current.pos);
    for (let k = from; k < to; k++) {
      const a = k === from ? start : { ...spotOf(k, side), k: 1 }, b = spotOf(k + 1, side), up = b.y < a.y - 20;
      sound.current?.hop(k - from);
      await tween(HOP_MS, t => {
        const e = easeInOut(t), lift = Math.sin(Math.PI * t) * (up ? 30 : 22);
        place(side, lerp(a.x, b.x, e), lerp(a.y, b.y, e), lerp(a.k, 1, t), lift, 0, t > 0.9 ? 0.9 : 1);
      }, gen);
      if (genRef.current !== gen) return;
    }
    const b = spotOf(to, side);
    await tween(150, t => place(side, b.x, b.y, 1, 0, 0, 1 - Math.sin(Math.PI * t) * 0.16), gen);
  };

  const whirl = async (e: Extract<Ev, { e: "blender" }>, gen: number) => {
    const { i, side } = e, geo = blenderGeo(i), from = spotOf(e.from, side), lift = (k: number) => TOK * k * 0.32;
    moving(side, true);
    setMsg(isMe(side) && opp !== "phone" ? "Blender! Hold On Tight..." : `Blender! ${who(side)} Whirls Up...`);
    await tween(300, t => { const e2 = easeInOut(t), k = lerp(1, 0.68, t); place(side, lerp(from.x, geo.jug.x, e2), lerp(from.y, geo.jug.y + lift(k), e2), k, Math.sin(Math.PI * t) * 34, 0); }, gen);
    if (genRef.current !== gen) return;
    setFx(f => ({ ...f, whirl: i })); sound.current?.whirl();
    parts.current.bits(geo.lid.x, geo.lid.y + 6, 12);
    await tween(760, t => place(side, geo.jug.x + Math.sin(t * 40) * 1.6, geo.jug.y + lift(0.68) + 4, 0.68, 0, t * 1100), gen);
    if (genRef.current !== gen) return;
    setFx(f => ({ ...f, tube: i })); sound.current?.whoosh();
    parts.current.bits(geo.lid.x, geo.lid.y, 8);
    const dur = 650 + tubeLen(i) * 1.15; let trail = 0;
    await tween(dur, t => {
      const e2 = easeInOut(t), p = tubeAt(i, e2), k = lerp(0.68, 0.82, e2);
      place(side, p.x, p.y + lift(k), k, 0, 1100 + e2 * 1080);
      if (t - trail > 0.035) { trail = t; parts.current.trail(p.x, p.y); }
    }, gen);
    if (genRef.current !== gen) return;
    setFx(f => ({ ...f, whirl: undefined, tube: undefined }));
    const to = spotOf(e.to, side), end = tubeAt(i, 1);
    sound.current?.pop(); parts.current.sparks(to.x, to.y - 18, 12);
    floatWord(`+${e.to - e.from}`, { x: to.x, y: to.y - 78 }, "#1f9e5a");
    await tween(360, t => { const k = lerp(0.82, 1, easeBack(t)); place(side, lerp(end.x, to.x, t), lerp(end.y + lift(0.82), to.y, easeOut(t)), k, Math.sin(Math.PI * t) * 26, (1 - t) * 40); }, gen);
    setMsg(isMe(side) && opp !== "phone" ? `Whirled Up To ${e.to}!` : `${who(side)} Whirled Up To ${e.to}.`);
  };

  const slide = async (e: Extract<Ev, { e: "bacon" }>, gen: number) => {
    const { i, side } = e, head = baconAt(i, 0);
    moving(side, true);
    setMsg(isMe(side) && opp !== "phone" ? "Bacon! Down You Go..." : `Bacon! ${who(side)} Slides Down...`);
    sound.current?.sizzle(); parts.current.drops(head.x, head.y - 6, 9);
    const here = spotOf(e.from, side);
    await tween(460, t => place(side, lerp(here.x, head.x, t) + Math.sin(t * 46) * 2.2 * (1 - t), lerp(here.y, head.y, t), 1, Math.abs(Math.sin(t * 9)) * 4, Math.sin(t * 38) * 7), gen);
    if (genRef.current !== gen) return;
    setFx(f => ({ ...f, sheen: i })); sound.current?.slide();
    const dur = 620 + baconLen(i) * 1.0; let drip = 0;
    await tween(dur, t => {
      const e2 = t < 0.75 ? Math.pow(t / 0.75, 1.7) * 0.86 : 0.86 + easeOut((t - 0.75) / 0.25) * 0.14;
      const p = baconAt(i, e2), lean = Math.max(-22, Math.min(22, Math.cos(p.a) * 26));
      place(side, p.x, p.y, 1, 2, lean);
      if (t - drip > 0.12) { drip = t; parts.current.drops(p.x, p.y, 2); }
    }, gen);
    if (genRef.current !== gen) return;
    setFx(f => ({ ...f, sheen: undefined }));
    const tail = baconAt(i, 1), to = spotOf(e.to, side);
    floatWord(`-${e.from - e.to}`, { x: to.x, y: to.y - 78 }, "#d64545");
    await tween(300, t => place(side, lerp(tail.x, to.x, t), lerp(tail.y, to.y, t), 1, Math.sin(Math.PI * t) * 14, 0, t > 0.8 ? 0.86 : 1), gen);
    setMsg(isMe(side) && opp !== "phone" ? `Slid Down To ${e.to}.` : `${who(side)} Slid Down To ${e.to}.`);
  };

  const mitt = async (e: Extract<Ev, { e: "mitt" }>, gen: number) => {
    const at = spotOf(e.at, e.side);
    sound.current?.mitt(); parts.current.sparks(at.x, at.y - 20, 12, "#3ccfb4");
    setCardFx({ id: Date.now(), card: "mitt", side: e.side, kind: "mitt", at });
    setMsg(isMe(e.side) && opp !== "phone" ? `Oven Mitt! You Stay On ${e.at}.` : `Oven Mitt! ${who(e.side)} Stays On ${e.at}.`);
    moving(e.side, true);
    await tween(520, t => place(e.side, at.x, at.y, 1, Math.abs(Math.sin(t * Math.PI * 2)) * 18, 0), gen);
    await wait(700);
  };

  const gotCard = async (side: Side, card: Card, gen: number) => {
    const at = spotOf(vw.current.pos[side], side);
    sound.current?.card(); parts.current.sparks(at.x, at.y - 20, 10);
    setCardFx({ id: Date.now(), card, side, kind: "got", at });
    setMsg(isMe(side) && opp !== "phone" ? `You Got ${CARD_INFO[card].name}!` : `${who(side)} Got ${CARD_INFO[card].name}.`);
    await wait(1300);
    if (genRef.current !== gen) return;
  };

  const swap = async (gen: number) => {
    const p = vw.current.pos, a = restOf(0, p), b = restOf(1, p), swapped: [number, number] = [p[1], p[0]];
    const a2 = restOf(0, swapped), b2 = restOf(1, swapped);
    moving(0, true); moving(1, true); sound.current?.whoosh();
    await tween(760, t => {
      const e2 = easeInOut(t), lift = Math.sin(Math.PI * t) * 60;
      place(0, lerp(a.x, a2.x, e2), lerp(a.y, a2.y, e2), lerp(a.k, a2.k, t), lift, t * 360);
      place(1, lerp(b.x, b2.x, e2), lerp(b.y, b2.y, e2), lerp(b.k, b2.k, t), lift, -t * 360);
    }, gen);
    parts.current.sparks(a2.x, a2.y - 20, 8); parts.current.sparks(b2.x, b2.y - 20, 8);
  };

  const celebrate = async (side: Side, gen: number) => {
    const at = spotOf(LAST, side);
    const good = opp === "phone" || side === mySide;
    if (good) sound.current?.win(); else sound.current?.lose();
    parts.current.confetti(good ? 80 : 30); parts.current.sparks(at.x, at.y - 20, 16);
    moving(side, true);
    await tween(1300, t => place(side, at.x, at.y, 1, Math.abs(Math.sin(t * Math.PI * 3)) * 30 * (1 - t * 0.5), Math.sin(t * Math.PI * 6) * 8), gen);
  };

  const play = async (evs: Ev[], after: State, gen: number) => {
    const V = vw.current, alive = () => genRef.current === gen;
    for (const e of evs) {
      if (!alive()) return;
      if (e.e === "play") {
        const h = V.hand[e.side], k = h.indexOf(e.card); if (k >= 0) h.splice(k, 1);
        V.played = true; if (e.card === "double") V.double = true;
        setTurnPop(null); sound.current?.play();
        setCardFx({ id: Date.now(), card: e.card, side: e.side, kind: "play", at: { x: BW / 2, y: BH } });
        setMsg(isMe(e.side) && opp !== "phone" ? `You Played ${CARD_INFO[e.card].name}!` : `${who(e.side)} Played ${CARD_INFO[e.card].name}!`);
        bump(); await wait(e.card === "double" ? 1250 : 1050);
      } else if (e.e === "swap") {
        await swap(gen); V.pos = [V.pos[1], V.pos[0]];
        const by = V.turn;   // the side whose turn it is played the card
        setMsg(opp === "phone" ? `${who(by)} Swapped Places!` : isMe(by) ? `Swapped! You're On ${V.pos[by]} Now.` : `${who(by)} Swapped Places With You!`);
      } else if (e.e === "die") {
        V.sub = e.sub; await rollDie(e.v, e.side, gen); V.die = e.v; bump();
      } else if (e.e === "hop") {
        await hop(e.side, e.from, e.to, gen); V.pos[e.side] = e.to;
      } else if (e.e === "blender") {
        await whirl(e, gen); V.pos[e.side] = e.to;
      } else if (e.e === "bacon") {
        await slide(e, gen); V.pos[e.side] = e.to;
      } else if (e.e === "mitt") {
        const h = V.hand[e.side], k = h.indexOf("mitt"); if (k >= 0) h.splice(k, 1); bump();
        await mitt(e, gen);
      } else if (e.e === "card") {
        await gotCard(e.side, e.card, gen); V.hand[e.side] = [...V.hand[e.side], e.card]; bump();
      } else if (e.e === "full") {
        const at = spotOf(V.pos[e.side], e.side);
        setCardFx({ id: Date.now(), card: e.card, side: e.side, kind: "full", at });
        setMsg(isMe(e.side) && opp !== "phone" ? "Your Hands Are Full. No Card This Time." : `${who(e.side)} Has 2 Cards Already.`);
        await wait(1150);
      } else if (e.e === "again") {
        V.sub = 1; setMsg(isMe(e.side) && opp !== "phone" ? "Double Roll! Roll Again." : `Double Roll! ${who(e.side)} Rolls Again.`);
        await wait(350);
      } else if (e.e === "win") {
        V.winner = e.side; await celebrate(e.side, gen);
      } else if (e.e === "turn") {
        V.turn = e.side; V.sub = 0; V.double = false; V.played = false;
        settle(); bump(); await wait(260);
        if (!alive()) return;
        showTurn(e.side);
      }
    }
    if (!alive()) return;
    vw.current = viewOf(after, V.die); settle(); bump();
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
    setDieFx(null); setCardFx(null); setFx({}); setWord(null); setTurnPop(null); parts.current.clear();
  };
  const showTurn = (side: Side) => {
    setTurnPop({ id: Date.now(), side });
    if (isMe(side)) sound.current?.turn();
    setMsg(isMe(side) ? (g.current.hand[side].some(c => c !== "mitt") ? "Tap To Roll, Or Pick A Card First." : "Tap To Roll.") : opp === "cpu" ? "The Computer Is Thinking..." : `Waiting For ${nameOf(side)} To Roll...`);
  };
  useEffect(() => { if (!turnPop) return; const t = setTimeout(() => setTurnPop(p => (p && p.id === turnPop.id ? null : p)), 1150); return () => clearTimeout(t); }, [turnPop]);
  useEffect(() => { if (!cardFx) return; const t = setTimeout(() => setCardFx(c => (c && c.id === cardFx.id ? null : c)), 1350); return () => clearTimeout(t); }, [cardFx]);
  useEffect(() => { if (!word) return; const t = setTimeout(() => setWord(w => (w && w.id === word.id ? null : w)), 1150); return () => clearTimeout(t); }, [word]);

  // when the queue runs dry: the game may be over, or it's someone's turn (the live clock starts now)
  const idleRef = useRef(() => {});
  idleRef.current = () => {
    turnAt.current = Date.now();
    const G = g.current;
    if (G.winner !== null && phaseRef.current === "play") finishMatch(G.winner);
  };

  /** Applies an action (yours, the computer's, or one from your friend's phone) and queues its animation. */
  const act = (a: Action, from: "local" | "remote" = "local") => {
    const out = apply(g.current, a); if (!out) return false;
    g.current = out.s; log.current.push(a);
    for (const e of out.ev) {
      if (e.e === "blender") stats.current.blenders[e.side]++;
      else if (e.e === "bacon") stats.current.bacon[e.side]++;
      else if (e.e === "mitt") stats.current.mitts[e.side]++;
    }
    if (opp === "live" && from === "local") send({ t: "act", round: meRef.current?.round ?? round, i: log.current.length - 1, a });
    setSel(null);
    enqueue(out.ev, out.s);
    return true;
  };
  const rollFor = (side: Side): Action => opp === "cpu"
    ? { k: "roll", v: 1 + Math.floor(rngs.current.dice[side]() * 6), pick: rngs.current.pick() }
    : { k: "roll", v: 1 + Math.floor(Math.random() * 6), pick: Math.random() };

  // ── starting things ────────────────────────────────────────────────────
  const resetBoard = (first: Side = 0) => {
    halt();
    g.current = newState(first); vw.current = viewOf(g.current); log.current = []; stats.current = newStats();
    setSel(null); setFinal(null); settle(); bump();
  };
  const todayRecord = (): Final | null => { try { const v = localStorage.getItem(todayKey); return v ? JSON.parse(v) : null; } catch { return null; } };
  const startCpu = () => {
    const daily = mode === "daily";
    if (daily && todayRecord()) { setFinal(todayRecord()); go("doneToday"); return; }
    const seed = (salt: number) => (daily ? dailySeed(salt) : Math.floor(Math.random() * 1e9));
    rngs.current = { dice: [mulberry32(seed(DICE_SALT)), mulberry32(seed(CPU_SALT))], pick: mulberry32(seed(PICK_SALT)) };
    const mine = foods[0], cpu = FOODS.find(f => f.code !== mine && f.code !== "1f95a")!.code;
    setFoods([mine, cpu]);
    resetBoard(0); runStart.current = performance.now(); go("play"); showTurn(0);
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
  const { held, setHeld } = shell;
  useEffect(() => { if (opp !== "cpu" && held) setHeld(false); }, [opp, held, setHeld]);
  const paused = opp === "cpu" && shell.paused;

  // ── the end ────────────────────────────────────────────────────────────
  const finishMatch = (winner: Side) => {
    if (phaseRef.current !== "play") return;
    if (opp === "cpu") {
      const G = g.current, won = winner === 0, score = scoreFor(won, G.turns[0], G.pos[0]);
      const f: Final = { score, won, turns: G.turns[0], square: G.pos[0], blenders: stats.current.blenders[0], bacon: stats.current.bacon[0], mitts: stats.current.mitts[0] };
      setFinal(f); go("over");
      if (score > readBest(bestKey)) { saveBest(bestKey, score); setBest(score); }
      if (mode === "daily") try { localStorage.setItem(todayKey, JSON.stringify(f)); } catch {}
      shell.finishRef.current({ score, drops: G.turns[0], ms: performance.now() - runStart.current });
      return;
    }
    if (opp === "live") forgetLive();
    go("over");
  };

  // the computer's turn: think a moment, maybe play a card, then roll (and roll again after a Double Roll)
  useEffect(() => {
    if (opp !== "cpu" || phase !== "play" || busy || paused) return;
    const G = g.current; if (G.winner !== null || G.turn !== 1) return;
    const t = setTimeout(() => {
      const H = g.current;
      if (phaseRef.current !== "play" || busyRef.current || H.turn !== 1 || H.winner !== null) return;
      const c = cpuCard(H, 1);
      if (c) act({ k: "card", card: c }); else act(rollFor(1));
    }, G.sub === 1 ? 700 : G.played ? 550 : 1250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp, phase, busy, paused, g.current.seq]);

  // ── your turn ──────────────────────────────────────────────────────────
  const G = g.current, V = vw.current;
  const turnSide = V.turn;
  const live = opp === "live";
  const linkOk = !live || (room.status === "paired" && !reconnecting);
  const canAct = phase === "play" && !busy && G.winner === null && G.turn === V.turn && isMe(G.turn) && !paused && linkOk;
  const onRoll = () => {
    sound.current?.unlock();
    if (!canAct) return;
    if (sel && canPlay(g.current, g.current.turn, sel)) { act({ k: "card", card: sel as "double" | "swap" }); return; }
    act(rollFor(g.current.turn));
  };
  const onCard = (side: Side, card: Card) => {
    sound.current?.unlock();
    if (!canAct || side !== G.turn) return;
    if (card === "mitt") { setMsg("The Oven Mitt Plays Itself When You Hit Bacon."); return; }
    if (!canPlay(G, side, card)) { setMsg(G.sub === 1 ? "Cards Go Before Your First Roll." : G.played ? "One Card A Turn." : "You're On The Same Square. Nothing To Swap."); return; }
    sound.current?.click(); setTurnPop(null);
    if (sel === card) { setSel(null); setMsg("Tap To Roll, Or Pick A Card First."); return; }
    setSel(card); setMsg(card === "double" ? "Double Roll: Roll Twice This Turn." : "Swap Places: Trade Squares With Them.");
  };

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
    round: meRef.current?.round ?? round, food: myFood, snap: takeSnap(), t: Date.now() });
  const liveNowRef = useRef(liveNow); liveNowRef.current = liveNow;

  const joinRoom = (code: string, resume?: SavedLive | null) => {
    if (chRef.current) sb().removeChannel(chRef.current);
    const prior = resume ?? readLive(code);
    if (!resume) { pairedWith.current = null; heard.current = null; }
    const me: Meta = { id: prior?.id ?? Math.random().toString(36).slice(2, 10), name: storedName(), at: prior?.at ?? Date.now(), round: resume ? resume.round : 1,
      seq: Date.now(), ok: !!resume, stage: resume ? "game" : "gate", food: resume?.food ?? myFood };
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
      const host = seats[0].id === me.id;
      // seats stay put for the whole match: while the friend is away, this phone doesn't become the host
      if (o || !pairedWith.current) hostRef.current = host;
      if (o) lastOpp.current = o;
      if (!o && pairedWith.current && ["play", "over", "rematch"].includes(phaseRef.current)) {   // gone mid-match: give them 60 seconds
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
  /** Takes the friend's list of actions: plays the last few if they just carry on from ours, otherwise jumps to it. */
  const adoptLog = (nl: Action[], animate = true) => {
    const L = log.current, carriesOn = nl.length > L.length && L.every((a, k) => same(a, nl[k]));
    if (animate && carriesOn && nl.length - L.length <= 3 && phaseRef.current === "play") { for (const a of nl.slice(L.length)) act(a, "remote"); return; }
    const s = replay(firstOf(meRef.current?.round ?? round), nl); if (!s) return;
    halt();
    g.current = s; log.current = [...nl]; vw.current = viewOf(s); settle(); bump();
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
    resuming.current = opp !== "live"; setOffer(null); setOpp("live"); setMyFood(sv.food);
    meRef.current = { id: sv.id, name: storedName(), at: sv.at, round: sv.round, seq: Date.now(), ok: true, stage: "game", food: sv.food };
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
  const pickMyFood = (code: string) => { setMyFood(code); if (meRef.current) setMeta({ food: code }); };
  const askRematch = () => { const r = (meRef.current?.round ?? round) + 1; setMeta({ round: r }); go("rematch"); };

  const onMsg = (m: Msg) => {
    if (m?.t === "bye") {
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
  // the turn clock: 30 seconds, then it rolls for you (your friend's phone steps in if yours has gone quiet)
  useEffect(() => {
    if (opp !== "live" || phase !== "play") return;
    const t = setInterval(() => {
      if (room.status === "away" || reconnecting || busyRef.current) { turnAt.current += 250; setNow(Date.now()); return; }
      const H = g.current; if (H.winner !== null) return;
      const el = Date.now() - turnAt.current;
      if (room.status === "paired") {
        if (H.turn === mySide && el > TURN_MS) { autoRoll.current = "mine"; act(rollFor(H.turn)); }
        else if (H.turn !== mySide && el > TURN_MS + (hostRef.current ? GRACE_MS : GRACE_MS * 2)) { autoRoll.current = "theirs"; act(rollFor(H.turn)); }
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
    const label = mode === "daily" ? `Blenders & Bacon #${n} (Today's Challenge)` : "Blenders & Bacon (Free Play)";
    const how = f.won ? `Beat the computer in ${f.turns} turns 🎉` : `The computer won. I got to ${f.square}.`;
    shell.share(`${label}\n${how}\n${f.score.toLocaleString()} pts · ${f.blenders} ${f.blenders === 1 ? "blender" : "blenders"} · ${f.bacon} bacon ${f.bacon === 1 ? "slide" : "slides"}\nCan you beat it? whatyouate.app/games/${GAME}`);
  };
  const shareDuel = (winner: Side) => {
    const head = opp === "phone" ? `${nameOf(winner)} beat ${nameOf(other(winner))} in ${G.turns[winner]} turns 🎉` : winner === mySide ? `I beat ${nameOf(other(mySide))} in ${G.turns[winner]} turns 🎉` : `${nameOf(winner)} beat me this time`;
    shell.share(`Blenders & Bacon (${opp === "phone" ? "Same Phone" : "Play A Friend"})\n${head}\nPlay a friend: whatyouate.app/games/${GAME}`);
  };

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
      <div className="wk-f mt-3 text-[15px] text-[#101B2E]">Pick Your Food</div>
      <FoodPicker value={myFood} onPick={c => { sound.current?.click(); setMyFood(c); }} size={40} />
      <button onClick={() => { sound.current?.unlock(); joinRoom(newCode()); }} className={`${UI.btn} mt-4 h-[50px] w-full text-[19px]`}>Make A Room</button>
      <div className="mt-4 flex gap-2">
        <input value={joinInput} onChange={e => setJoinInput(cleanCode(e.target.value))} placeholder="CODE" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
          className="wk-input min-w-0 flex-1 px-4 py-2.5 text-center font-mono text-lg font-bold uppercase tracking-[0.3em]" />
        <button disabled={!validCode(joinInput)} onClick={() => { sound.current?.unlock(); joinRoom(joinInput); }} className={`${UI.navy} px-5 text-[17px]`}>Join</button>
      </div>
      {joinInput.length === 4 && !validCode(joinInput) && <p className="mt-2 text-xs font-semibold text-[#d64545]">That code doesn&apos;t look right. Check it again.</p>}
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
    const left = !!pairedWith.current;
    return card(<>
      <div className="wk-f text-[26px] leading-tight">{left ? "Your Friend Left" : "Your Room"}</div>
      <p className="mt-1 text-sm text-[#5a6b85]">{left ? "Waiting for them to come back. If they rejoin, you'll start a fresh game." : "Send your friend the link, or have them type this code."}</p>
      <div className="wk-f mt-3 text-[46px] leading-none tracking-[0.2em] text-[#0E1F45]">{code}</div>
      <button onClick={() => shell.share(`Play Blenders & Bacon with me! Room ${code}\n${roomLink(code)}`)} className={`${UI.btn} mt-4 h-[50px] w-full text-[19px]`}>{shell.copied ? "Link Copied!" : "Share The Link"}</button>
      <p className="mt-3 text-xs font-semibold text-[#5a6b85]">Waiting For Your Friend To Join...</p>
      <button onClick={() => { leaveRoom(); setJoinInput(""); }} className={`${UI.link} mt-1 w-full py-2 text-[15px]`}>Leave Room</button>
    </>);
  };

  const winner = G.winner;
  const overlay = (): ReactNode => {
    const lc = liveCard(); if (lc) return lc;
    if (live && phase === "gate" && room.status === "paired") return (
        <ReadyCard me={myName === "Guest" ? "You" : myName} friend={nameOf(other(mySide))} ready={[myOk, oppOk]} onReady={markOk}
          onLeave={() => { leaveRoom(); setJoinInput(""); go("idle"); }} steps={[
            <span key="f" className="block">Pick your food:<FoodPicker value={myFood} onPick={c => { sound.current?.click(); pickMyFood(c); }} size={34} /></span>,
            `Take turns tapping Roll. Your food hops up the shelves from 1 to ${LAST}.`,
            "Blenders whirl you up. Bacon slides you down. Gold squares give you a card.",
            `First to ${LAST} wins. You get 30 seconds a turn.`,
          ]} />
    );
    if (opp === "cpu" && phase === "start") return card(<>
      <div className="wk-f text-[32px] leading-none text-[#0E1F45] [text-shadow:0_3px_0_#d6e4fa]">Blenders &amp; Bacon</div>
      <p className="mt-2 text-[14px] leading-snug text-[#5a6b85]">Race the computer up the pantry. Blenders whirl you up. Bacon slides you down.</p>
      <div className="wk-f mt-3 text-[15px] text-[#101B2E]">Pick Your Food</div>
      <FoodPicker value={foods[0]} onPick={c => { sound.current?.click(); setFoods([c, foods[1]]); }} />
      <button onClick={() => { sound.current?.unlock(); startCpu(); }} className={`${UI.go} wk-pulse mt-5 h-[56px] w-full text-[24px]`}><PlayIcon size={20} />Play</button>
    </>, mode === "daily" ? `Today's Challenge #${n}` : "Free Play");
    if (opp === "cpu" && phase === "over" && final) {
      const headline = final.won ? `You Won In ${final.turns} Turns!` : "The Computer Got There First";
      return (
          <GameOver label={mode === "daily" ? `Today's Challenge #${n}` : "Free Play"} headline={headline} score={final.score} best={best} mode={mode}
            posted={shell.scores.posted} joined={!!shell.player} campaign={GAME} copied={shell.copied}
            extra={<p className="mt-3 text-[13px] font-semibold text-[#5a6b85]">{final.blenders} {final.blenders === 1 ? "Blender" : "Blenders"} · {final.bacon} Bacon {final.bacon === 1 ? "Slide" : "Slides"}{final.mitts ? ` · ${final.mitts} Oven Mitt ${final.mitts === 1 ? "Save" : "Saves"}` : ""}</p>}
            pitch="What you eat changes how you feel. WhatYouAte shows you how your meals affect your energy."
            onBoard={() => shell.setBoardOpen(true)} onJoin={() => shell.setJoinOpen(true)}
            onAgain={() => { autoStart.current = true; if (mode === "daily") pickMode("endless"); else setRun(r => r + 1); }} onShare={() => shareCpu(final)} />
      );
    }
    if (opp === "cpu" && phase === "doneToday" && final) return card(<>
      <div className="wk-f text-[15px] tracking-wide text-[#3F7FD6]">Today&apos;s Challenge #{n}</div>
      <div className="wk-f mt-1 text-[26px] leading-tight">Today&apos;s Race Is Run</div>
      <div className="wk-f mt-1 text-[44px] leading-none tabular-nums">{final.score.toLocaleString()}</div>
      <p className="mt-1 text-sm text-[#5a6b85]">{final.won ? `You won in ${final.turns} turns.` : "The computer won this one."} New dice at midnight.</p>
      <div className="mt-4 flex gap-2">
        <button onClick={() => { autoStart.current = true; pickMode("endless"); }} className={`${UI.btn} h-[48px] flex-1 text-[18px]`}>Free Play</button>
        <button onClick={() => shareCpu(final)} className={`${UI.btn2} h-[48px] flex-1 text-[18px]`}><ShareIcon size={17} className="shrink-0" />{shell.copied ? "Copied!" : "Share"}</button>
      </div>
    </>);
    if (opp === "phone" && phase === "names") return card(<>
      <div className="wk-f text-[28px] leading-tight">Same Phone</div>
      <p className="mt-1 text-sm text-[#5a6b85]">Take turns on this phone. Who&apos;s playing?</p>
      {([0, 1] as Side[]).map(k => (
        <div key={k} className="mt-3 rounded-2xl p-2.5" style={{ background: k === 0 ? "#eaf2ff" : "#ffeef0" }}>
          <input value={names[k]} maxLength={14} placeholder={k === 0 ? (shell.player?.name || "Player 1") : "Player 2"}
            onChange={e => setNames(nm => (k === 0 ? [e.target.value, nm[1]] : [nm[0], e.target.value]))}
            className="wk-input w-full px-3 py-2 text-base" style={{ borderColor: COL[k].hi }} />
          <FoodPicker value={foods[k]} onPick={c => { sound.current?.click(); setFoods(f => (k === 0 ? [c, f[1]] : [f[0], c])); }} col={COL[k]} size={34} />
        </div>
      ))}
      <button onClick={() => { sound.current?.unlock(); startPhone(); }} className={`${UI.go} mt-4 w-full rounded-full py-3 text-[20px]`}>Start</button>
    </>);
    if (opp !== "cpu" && (phase === "over" || phase === "rematch") && winner !== null) {
      const w = nameOf(winner), mine = opp === "live" && winner === mySide;
      const head = opp === "live" ? (mine ? "You Win!" : `${w} Wins`) : `${w} Wins!`;
      const theyWant = live && phase === "over" && oppRound > (meRef.current?.round ?? round);
      return card(<>
        <div className="wk-f text-[15px] tracking-wide text-[#3F7FD6]">{opp === "phone" ? "Same Phone" : "Play A Friend"}</div>
        <div className="mt-2 flex justify-center"><TokenBadge col={colOf(winner)} food={foodOf(winner)} size={64} /></div>
        <div className="wk-f mt-2 text-[32px] leading-tight">{head}</div>
        <p className="mt-1 text-sm text-[#5a6b85]">Reached {LAST} in {G.turns[winner]} turns.</p>
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
      </>);
    }
    return null;
  };

  // ── the board ──────────────────────────────────────────────────────────
  const dieSize = Math.round(Math.max(58, Math.min(96, boardW * 0.24)));
  const token = (side: Side) => {
    const r = restOf(side, V.pos), col = colOf(side), size = TOK * S, active = phase === "play" && V.turn === side && !busy && G.winner === null;
    return (
      <div key={side} ref={el => { tokEl.current[side] = el; }} className="bb-tok pointer-events-none absolute left-0 top-0" data-token={side}
        style={{ width: size, height: size, transform: tokTransform(r.x, r.y, r.k), transformOrigin: "50% 80%", zIndex: V.turn === side ? 5 : 4 }}>
        <div ref={el => { tokSh.current[side] = el; }} className="absolute rounded-[50%]" style={{ left: "16%", right: "16%", top: "72%", height: "18%", background: "radial-gradient(closest-side, rgba(40,22,6,0.42), rgba(40,22,6,0))" }} />
        {active && <div className="bb-ring absolute rounded-[50%]" style={{ left: "10%", right: "10%", top: "64%", height: "30%", border: `${Math.max(2, size * 0.05)}px solid ${col.lo}` }} />}
        <div ref={el => { tokIn.current[side] = el; }} className="bb-tok-in absolute inset-0" style={{ transformOrigin: "50% 80%" }}>
          <div className={`absolute inset-0 ${active ? "bb-bob" : ""}`}>
            <div className="absolute rounded-[50%]" style={{ left: "13%", right: "13%", top: "62%", height: "26%", background: col.lip }} />
            <div className="absolute rounded-[50%]" style={{ left: "13%", right: "13%", top: "56%", height: "26%", background: `radial-gradient(ellipse at 40% 30%, ${col.hi}, ${col.lo} 75%)`, boxShadow: `inset 0 0 0 ${Math.max(1.5, size * 0.035)}px rgba(255,255,255,0.9)` }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foodPng(foodOf(side))} alt="" draggable={false} className="absolute" style={{ left: "17%", top: "4%", width: "66%", height: "66%", filter: "drop-shadow(0 2px 1.5px rgba(30,15,5,0.35))" }} />
          </div>
        </div>
      </div>
    );
  };
  const turnPopText = turnPop ? turnLabel(turnPop.side) + (isMe(turnPop.side) && opp !== "phone" ? "!" : "") : "";
  const popInk = turnPop ? (opp === "phone" ? COL[turnPop.side].ink : isMe(turnPop.side) ? "#2F5FB0" : "#101B2E") : "";

  const board = () => (
    <div className="relative shrink-0" data-board data-phase={phase} data-busy={busy ? 1 : 0} data-turn={V.turn} data-pos={V.pos.join(",")}
      data-can={canAct ? 1 : 0} data-winner={G.winner ?? ""} data-seq={G.seq} style={{ width: boardW, height: boardH }}>
      {/* the clipped part: the art, the tokens and the particles (the die and the cards sit outside it: Safari flattens 3D under a rounded clip) */}
      <div className="absolute inset-0 overflow-hidden rounded-[14px]" style={{ boxShadow: "0 12px 28px -12px rgba(16,42,86,0.55), 0 0 0 2px rgba(110,66,25,0.55)" }}>
      {S > 0 && <BoardArt />}
      {S > 0 && (
        <svg viewBox={`0 0 ${BW} ${BH}`} width="100%" height="100%" className="pointer-events-none absolute inset-0" aria-hidden>
          {fx.whirl !== undefined && <g className="bb-shake"><BlenderArt i={fx.whirl} swirl /></g>}
          {fx.tube !== undefined && <path d={tubeD(fx.tube)} className="bb-dash" stroke="#fff" strokeOpacity={0.9} strokeWidth={7} strokeDasharray="20 12" strokeLinecap="round" fill="none" />}
          {fx.sheen !== undefined && (
            <g style={{ "--len": `${-Math.round(baconLen(fx.sheen) + 60)}px`, "--d": `${(620 + baconLen(fx.sheen)) / 1000}s` } as CSSProperties}>
              <path d={baconD(fx.sheen)} className="bb-sheen" stroke="#fff6dc" strokeOpacity={0.55} strokeWidth={22} strokeLinecap="round" fill="none" filter="url(#bbSoft)"
                strokeDasharray={`60 ${Math.round(baconLen(fx.sheen) + 80)}`} />
              <path d={baconD(fx.sheen)} className="bb-sheen" stroke="#fff" strokeOpacity={0.85} strokeWidth={6} strokeLinecap="round" fill="none"
                strokeDasharray={`60 ${Math.round(baconLen(fx.sheen) + 80)}`} />
            </g>
          )}
        </svg>
      )}
      {S > 0 && token(0)}
      {S > 0 && token(1)}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[7]" style={{ width: boardW, height: boardH }} />
      </div>
      {word && (
        <div key={word.id} className="bb-float wk-f pointer-events-none absolute z-[8] whitespace-nowrap text-white" style={{ left: word.at.x * S, top: word.at.y * S, fontSize: Math.max(18, 30 * S * 1.4), textShadow: outline(word.col, 2.2) }}>{word.text}</div>
      )}
      {dieFx && (
        <div key={dieFx.id} className={`pointer-events-none absolute inset-0 z-[9] flex items-center justify-center ${dieFx.out ? "bb-dieout" : "bb-diein"}`}>
          <div className="absolute rounded-full" style={{ width: dieSize * 2.6, height: dieSize * 2.6, background: "radial-gradient(closest-side, rgba(255,255,255,0.75), rgba(255,255,255,0))" }} />
          <div ref={cubeRef} style={{ width: dieSize, height: dieSize }}><DieArt v={dieFx.v} col={colOf(dieFx.side)} size={dieSize} /></div>
        </div>
      )}
      {cardFx && (() => {
        const info = CARD_INFO[cardFx.card], cw = Math.max(74, Math.min(120, boardW * 0.27)), ch = cw * 1.36;
        const fromX = (cardFx.at.x - BW / 2) * S, fromY = (cardFx.at.y - BH / 2) * S;
        const toX = cardFx.kind === "got" ? (cardFx.side === (opp === "phone" ? 0 : mySide) ? -boardW * 0.36 : boardW * 0.36) : 0;
        const toY = cardFx.kind === "got" ? boardH * 0.56 : cardFx.kind === "play" ? -boardH * 0.12 : -boardH * 0.05;
        const label = cardFx.kind === "got" ? `${info.name}!` : cardFx.kind === "play" ? `${info.name}!` : cardFx.kind === "mitt" ? "Oven Mitt!" : "Hands Full";
        const sub = cardFx.kind === "got" ? info.tip : cardFx.kind === "play" ? (cardFx.card === "double" ? "Roll twice this turn" : "Trading places") : cardFx.kind === "mitt" ? "Saved from the bacon" : "Hold up to 2 cards";
        return (
          <div key={cardFx.id} className="pointer-events-none absolute inset-0 z-[10] flex flex-col items-center justify-center">
            <div className="bb-cardfx" style={{ "--fx": `${fromX}px`, "--fy": `${fromY}px`, "--tx": `${toX}px`, "--ty": `${toY}px`, "--d": "1.3s", opacity: cardFx.kind === "full" ? 0.6 : 1 } as CSSProperties}>
              <CardFace card={cardFx.card} w={cw} h={ch} big />
            </div>
            <div className="bb-cardlabel mt-2 text-center" style={{ "--d": "1.3s" } as CSSProperties}>
              <div className="wk-f whitespace-nowrap text-white" style={{ fontSize: Math.max(22, Math.min(34, boardW * 0.085)), textShadow: outline(info.lip, 2.6) }}>{label}</div>
              <div className="wk-f mt-0.5 inline-block rounded-full bg-white/95 px-3 py-0.5 text-[13px] text-[#101B2E] shadow">{sub}</div>
            </div>
          </div>
        );
      })()}
      {turnPop && turnPopText && (
        <div key={turnPop.id} className="pointer-events-none absolute inset-0 z-[11] flex items-center justify-center">
          <span className="bb-turnpop wk-f whitespace-nowrap text-white" style={{ fontSize: Math.min(50, (boardW * 1.5) / Math.max(8, turnPopText.length)), textShadow: outline(popInk) }}>{turnPopText}</span>
        </div>
      )}
      <button onClick={() => { const m = !sound.current?.muted; sound.current?.setMuted(m); setSoundOn(!m); }} aria-label={soundOn ? "Sound off" : "Sound on"}
        className="absolute z-[12] flex items-center justify-center rounded-full text-[#8a5527]" style={{ right: 200 * S, bottom: 12 * S, width: Math.max(24, 40 * S), height: Math.max(24, 40 * S), background: "#fff4dc", boxShadow: "0 2px 0 #8d5526" }}>
        <SoundIcon on={soundOn} size={Math.max(15, 20 * S * 1.2)} />
      </button>
    </div>
  );

  // the tray under the board: each side's cards, and the big Roll button between them
  const hand = (side: Side) => {
    const cards = V.hand[side], col = colOf(side), mine = canAct && G.turn === side;
    const label = opp === "phone" ? nameOf(side) : side === mySide ? "Your Cards" : opp === "cpu" ? "Computer" : nameOf(side);
    const sw = Math.max(40, Math.min(50, (rowW - 170) / 4 - 4)), sh = Math.round(sw * 1.32);
    return (
      <div className="flex shrink-0 flex-col items-center" data-hand={side}>
        <div className="wk-f mb-1 max-w-[110px] truncate text-[11px] uppercase leading-none" style={{ color: col.lo }}>{label}</div>
        <div className="flex gap-1.5">
          {[0, 1].map(k => {
            const c = cards[k];
            if (!c) return (
              <div key={k} className="flex items-center justify-center rounded-[10px]" style={{ width: sw, height: sh, background: "rgba(255,255,255,0.42)", border: `1.5px dashed ${col.lo}66` }}>
                <svg viewBox="0 0 20 26" width={sw * 0.36} height={sw * 0.47} aria-hidden><rect x="1.5" y="1.5" width="17" height="23" rx="3.5" fill="none" stroke={col.lo} strokeOpacity="0.35" strokeWidth="2" /><path d="M10 8.5v9M5.5 13h9" stroke={col.lo} strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" /></svg>
              </div>
            );
            const playable = mine && c !== "mitt" && canPlay(G, side, c);
            return (
              <button key={`${k}${c}`} onClick={() => onCard(side, c)} aria-label={CARD_INFO[c].name} data-card={c}
                className={`bb-slotpop relative transition-transform duration-150 ${sel === c && mine ? "bb-lift" : ""}`} style={{ opacity: !mine && G.turn === side && phase === "play" ? 1 : playable || c === "mitt" || !isMe(side) ? 1 : 0.92 }}>
                <CardFace card={c} w={sw} h={sh} glow={sel === c && mine} ready={playable && !sel} />
                {sel === c && mine && (
                  <span className="absolute -right-2 -top-2 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white text-[#5a6b85] shadow-[0_2px_0_#9db6df]" aria-hidden><CloseIcon size={10} /></span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };
  const rollLabel = (): ReactNode => {
    if (phase !== "play") return "Roll";
    if (sel && canAct) return `Play ${CARD_INFO[sel].short}`;
    if (!isMe(turnSide)) return "Wait";
    if (V.sub === 1 || (G.sub === 1 && !busy)) return "Roll Again";
    return "Roll";
  };
  const tray = () => {
    const leftSide: Side = opp === "phone" ? 0 : mySide, rightSide = other(leftSide);
    const waiting = phase === "play" && !isMe(turnSide);
    const selInfo = sel && canAct ? CARD_INFO[sel] : null;
    return (
      <div className="flex shrink-0 items-end justify-between gap-2" style={{ width: rowW, height: TRAY }}>
        {hand(leftSide)}
        <button onClick={onRoll} disabled={!canAct} data-roll
          className={`wk-btn min-w-0 flex-1 rounded-full ${waiting ? "" : "wk-go"} ${canAct ? "wk-pulse" : ""}`}
          style={{ height: short ? 58 : 66, fontSize: 26, ...(waiting ? { background: "#101B2E", boxShadow: "0 12px 26px -12px rgba(16,27,46,0.6)", color: "#fff", opacity: 1 } : {}),
            ...(selInfo ? { background: selInfo.col, boxShadow: `0 0 0 3px #fff, 0 12px 26px -10px ${selInfo.col}` } : {}),
            ...(!canAct && !waiting ? { opacity: 0.55 } : {}) }}>
          {selInfo ? <CardIcon card={sel!} size={30} /> : waiting ? <TokenBadge col={colOf(turnSide)} food={foodOf(turnSide)} size={30} /> : <DieIcon size={32} />}
          <span className="wk-f truncate text-[26px] leading-none" style={{ fontSize: rowLabelSize(rollLabel()) }}>{rollLabel()}</span>
          {waiting && <span className="wk-f text-[24px] leading-none">{[0, 1, 2].map(k => <span key={k} className="bb-dot" style={{ animationDelay: `${k * 0.2}s` }}>.</span>)}</span>}
        </button>
        {hand(rightSide)}
      </div>
    );
  };

  // the turn banner: solid blue when it's yours, plain white when it's theirs (Same Phone: the player's own colour)
  const myTurnNow = phase === "play" && isMe(turnSide) && opp !== "phone";
  const lit = opp === "phone" || myTurnNow;
  const bannerBg = opp === "phone" ? COL[turnSide].lo : myTurnNow ? "#6FA8FF" : "#ffffff";
  const bannerShadow = lit ? `0 14px 28px -14px ${opp === "phone" ? COL[turnSide].lip : "rgba(79,136,232,0.9)"}` : "0 0 0 1px #E3EDFB, 0 8px 20px -14px rgba(31,70,140,0.35)";
  const secsLeft = live && phase === "play" ? Math.max(0, Math.min(30, Math.ceil((TURN_MS - (now - turnAt.current)) / 1000))) : 0;
  const inGame = phase === "play" || phase === "over" || phase === "rematch";

  return (
    <GameScreen>
      <GameHeader title="Blenders & Bacon" mode={mode} onMode={pickMode} onBoard={() => shell.setBoardOpen(true)} onHelp={shell.help.show} />

      <div className="mt-2 flex h-[34px] shrink-0 rounded-full bg-white p-[3px] shadow-[0_0_0_1px_#E3EDFB,0_6px_16px_-12px_rgba(31,70,140,0.3)]">
        {([["cpu", "Computer"], ["phone", "Same Phone"], ["live", "Play A Friend"]] as [Opp, string][]).map(([o, label]) => (
          <button key={o} onClick={() => pickOpp(o)} aria-pressed={opp === o}
            className={`wk-f flex-1 rounded-full text-[14.5px] transition-colors ${opp === o ? "bg-[#101B2E] text-white" : "text-[#4F88E8]"}`}>{label}</button>
        ))}
      </div>

      {inGame ? (
        <div className="mt-2 flex shrink-0 items-center gap-2 rounded-2xl px-3 transition-colors duration-300" data-banner={myTurnNow ? "mine" : "theirs"}
          style={{ height: short ? 48 : 54, background: bannerBg, boxShadow: bannerShadow }}>
          {opp === "phone" && <TokenBadge col={colOf(turnSide)} food={foodOf(turnSide)} size={34} />}
          <div className="min-w-0 flex-1">
            <div className={`wk-f flex items-baseline gap-1 truncate text-[21px] leading-none ${lit ? "text-white" : "text-[#101B2E]"}`}>
              <span className="truncate">{phase === "play" ? turnLabel(turnSide) : winner !== null ? (opp === "phone" ? `${nameOf(winner)} Wins!` : winner === mySide ? "You Win!" : opp === "cpu" ? "Computer Wins" : `${nameOf(winner)} Wins`) : ""}</span>
              {phase === "play" && !isMe(turnSide) && <span className="shrink-0">{[0, 1, 2].map(k => <span key={k} className="bb-dot" style={{ animationDelay: `${k * 0.2}s` }}>.</span>)}</span>}
            </div>
            <div className={`mt-1 truncate text-[12px] font-medium leading-tight ${lit ? "text-white/90" : "text-[#5A6B85]"}`}>{phase === "play" ? msg : "Good Game!"}</div>
          </div>
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
          {opp === "cpu" ? (phase === "doneToday" ? "See You Tomorrow" : `Race To ${LAST}`) : opp === "phone" ? "Two Players, One Phone" : "Play Live On Two Phones"}
        </div>
      )}

      <BoardArea wrapRef={wrapRef} size={area} reserve={0}>
        <div className="flex h-full w-full flex-col items-center" style={{ gap: GAP }}>
          {board()}
          {tray()}
        </div>
        {opp === "cpu" && <PrizeLogo shell={shell} active={phase === "play" && !shell.paused} />}
        {opp === "cpu" && <PausedCard shell={shell} active={phase === "play"} />}
        {overlay()}
        {live && reconnecting && room.status !== "away" && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center">
            <div className="wk-f rounded-full bg-white/95 px-4 py-2 text-[15px] text-[#4F88E8] shadow-md">Reconnecting...</div>
          </div>
        )}
        <style>{BB_CSS}</style>
      </BoardArea>

      <ShellPopups shell={shell} game={GAME} todayNote="Today's Challenge: the same dice for everyone. Resets at midnight." />


      {shell.help.open && (
          <HelpModal onClose={shell.help.close} steps={[
            `Tap Roll. Your food hops along the shelves from 1 up to ${LAST}.`,
            <span key="b">A <b>blender</b> whirls you up its tube. Land on the top end of a <b>bacon</b> strip and you slide down it.</span>,
            <span key="c">Gold squares give you a card (hold up to 2). Play <b>Double Roll</b> or <b>Swap Places</b> before you roll. The <b>Oven Mitt</b> saves you from bacon by itself.</span>,
            `First to ${LAST} wins. No exact roll needed.`,
          ]}>
            <div className="mt-3 flex justify-center gap-2">
              {(["double", "swap", "mitt"] as Card[]).map(c => <CardFace key={c} card={c} w={48} h={63} />)}
            </div>
            <ModesHelp today="everyone gets the same dice today. Win in fewer turns for more points." free="new dice every game. Play as many as you like." />
          </HelpModal>
      )}
    </GameScreen>
  );
}

/** A row of foods to pick a token from. */
function FoodPicker({ value, onPick, col = COL[0], size = 40 }: { value: string; onPick: (c: string) => void; col?: (typeof COL)[number]; size?: number }) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-[7px]" data-foods>
      {FOODS.map(f => {
        const on = f.code === value;
        return (
          <button key={f.code} onClick={() => onPick(f.code)} aria-label={f.name} aria-pressed={on}
            className="relative flex items-center justify-center rounded-full transition-transform"
            style={{ width: size, height: size, transform: on ? "scale(1.1)" : undefined,
              background: on ? `radial-gradient(circle at 35% 30%, ${col.hi}, ${col.lo})` : "#eef3fb",
              boxShadow: on ? `0 3px 0 ${col.lip}, 0 0 0 3px #fff, 0 0 0 5px ${col.lo}` : "inset 0 0 0 1.5px rgba(22,51,108,0.12), 0 2px 0 rgba(22,51,108,0.12)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foodPng(f.code)} alt="" draggable={false} style={{ width: size * 0.66, height: size * 0.66 }} />
          </button>
        );
      })}
    </div>
  );
}

/** A player's food on their coloured disc, small (banners, the Roll button, the winner card). */
function TokenBadge({ col, food, size }: { col: (typeof COL)[number]; food: string; size: number }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, background: `radial-gradient(circle at 35% 30%, ${col.hi}, ${col.lo})`, boxShadow: `0 2px 0 ${col.lip}, 0 0 0 2px #fff` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={foodPng(food)} alt="" style={{ width: size * 0.7, height: size * 0.7 }} />
    </span>
  );
}

/** The die: a chunky rounded face in the roller's colour with a darker lip under it and white pips. */
function DieArt({ v, col, size }: { v: number; col: (typeof COL)[number]; size: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className="block overflow-visible" data-die={v}>
      <defs>
        <linearGradient id={`bbDie${col.lo.slice(1)}`} x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stopColor={col.hi} /><stop offset="1" stopColor={col.lo} /></linearGradient>
      </defs>
      <ellipse cx="50" cy="104" rx="38" ry="7" fill="#1a1006" opacity="0.18" />
      <rect x="4" y="11" width="92" height="88" rx="24" fill={col.lip} />
      <rect x="4" y="2" width="92" height="88" rx="24" fill={`url(#bbDie${col.lo.slice(1)})`} />
      <rect x="7.5" y="5.5" width="85" height="81" rx="21" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="3" />
      <path d="M16 12 h68 a14 14 0 0 1 10 6 q-38 -6 -86 6 a14 14 0 0 1 8 -12z" fill="#fff" opacity="0.35" />
      {PIPS[v].map(p => {
        const cx = [27, 50, 73][p % 3], cy = [24, 46, 68][Math.floor(p / 3)];
        return <g key={p}><circle cx={cx} cy={cy + 1.6} r="8.6" fill={col.lip} opacity="0.55" /><circle cx={cx} cy={cy} r="8.6" fill="#fff" /><circle cx={cx - 2.4} cy={cy - 2.6} r="2.6" fill="#fff" opacity="0.9" /></g>;
      })}
    </svg>
  );
}

const rowLabelSize = (label: ReactNode) => (typeof label === "string" && label.length > 8 ? 20 : 26);

/** A Pantry Card: its colour, its drawn picture and its name. */
function CardFace({ card, w, h, big, glow, ready }: { card: Card; w: number; h: number; big?: boolean; glow?: boolean; ready?: boolean }) {
  const info = CARD_INFO[card];
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden" data-cardface={card}
      style={{ width: w, height: h, borderRadius: w * 0.18, background: `linear-gradient(170deg, ${info.col} 0%, ${info.lo} 100%)`,
        boxShadow: `0 ${big ? 5 : 3}px 0 ${info.lip}, inset 0 0 0 ${big ? 4 : 2.5}px #fff, ${glow ? `0 0 0 3px #fff, 0 0 16px 4px ${info.col}` : ready ? `0 0 0 2px ${info.col}88` : "0 0 0 0 transparent"}` }}>
      <div className="absolute inset-x-0 top-0 h-[42%]" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0))" }} />
      <div className="relative" style={{ marginTop: -h * 0.06 }}><CardIcon card={card} size={w * 0.66} /></div>
      <div className="wk-f absolute inset-x-0 text-center leading-none text-white" style={{ bottom: h * 0.08, fontSize: big ? w * 0.15 : Math.max(9, w * 0.2), textShadow: `0 1.5px 0 ${info.lip}` }}>{big ? info.name : info.short}</div>
      {card === "mitt" && !big && <div className="wk-f absolute right-1 top-1 rounded-full bg-white px-1 text-[8px] leading-[12px]" style={{ color: info.lo }}>AUTO</div>}
    </div>
  );
}

/** A chunky outline for display text (text-shadow in eight directions, plus a drop). */
function outline(c: string, o = 2.5) {
  const d = o * 0.7;
  return [`${o}px 0 0 ${c}`, `-${o}px 0 0 ${c}`, `0 ${o}px 0 ${c}`, `0 -${o}px 0 ${c}`, `${d}px ${d}px 0 ${c}`, `-${d}px ${d}px 0 ${c}`, `${d}px -${d}px 0 ${c}`, `-${d}px -${d}px 0 ${c}`, `0 ${o + 3}px 0 ${c}`].join(", ");
}
