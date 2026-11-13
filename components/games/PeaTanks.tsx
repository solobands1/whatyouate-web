"use client";

// Pea Tanks: lunchboxes on the kitchen table firing peas. Twin sticks: the left stick drives the lunchbox, the right
// stick turns its straw anywhere (let go to fire; a dotted line shows the shot and its first bounce). A small button
// between them drops a jelly mine. Peas bounce once off the edge and the cover, and can come back at you.
// Three ways to play, all from ./tankSim:
//  - Missions: 20 tables against computer lunchboxes, new enemy kinds and kitchen spills introduced one at a time,
//    3 lives and a bonus life every 5 missions. Solo, co-op on one phone, or co-op live. "Today" is 5 missions that are
//    the same for everyone, scored for the leaderboard (missions cleared, time, aim, lives left). Free Play's solo
//    campaign scores go on the weekly board; progress is saved so you can pick up from any mission you've reached.
//  - Guard The Lunch: waves of lunchboxes go for your picnic basket. Solo or co-op. A local best, no leaderboard.
//  - Versus: one on one, first to 3 rounds, on one phone (player 2 at the top, upside down) or live.
// Desktop: WASD drives, the mouse aims, click fires, right-click (or E) drops a mine; arrows and space work too.
// Live play: the host runs everything at 60 steps a second and sends the state 20 times a second over WebRTC
// (Supabase only for finding each other, or as a slow fallback); the guest sends its sticks, sees its own lunchbox
// straight away (prediction) and everything else a moment in the past (interpolation). See ./tankNet.
// No facts during play; one fact on the game-over card.
/* eslint-disable react-hooks/set-state-in-effect --
   A real-time canvas game: the match lives in the effect's closure and the room hook's refs, and React state only
   mirrors it for the cards around the board (same approach as the other canvas games). */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { appStoreLink } from "@/components/site";
import { type Mode, type Toast, GameScreen, GameHeader, BoardArea, PrizeLogo, GameOver, PauseButton, PausedCard, ReadyCard, HelpModal, ModesHelp, ShellPopups,
  useGameShell, fitCanvas, dailySeed, dailyNumber, torontoDate, readBest, saveBest, foodPng, HUD_ROW, HudStat, HudTag, OverlayCard, UI } from "./kit";
import { HeartIcon } from "./icons";
import { AW, AH, TANK_R, PEA_R, DUEL_HP, LIVES, MISSIONS, TODAY_MISSIONS, DAY_BONUS, LIFE_BONUS, WAVE_POINTS, KILL_POINTS, MINE_CAP, KINDS, POWERS, ZONES, SPAWNS,
  type Kind, type TableMap, type Tank, type Pea, type Mine, type Pick, type Input, type World, type Brain, type Level, type Waves, type Ob,
  makeMap, missionLevel, dailyLevels, newDuel, newMission, newGuard, newWaves, stepWaves, guardRespawn, newTank, newBrain, aiInput, stepWorld, stepOneTank, stepTank,
  stepPea, peaFrom, duelWinner, missionState, missionPoints, sharpFor, waveSharp, wrapAngle, tracePath, zoneAt, NO_INPUT, mulberry32 } from "./tankSim";
import { drawFloor, drawTableLight, drawZone, drawHerbs, drawShadow, drawCover, drawLunchbox, previewLunchbox, drawPea, drawMine, drawPick, drawBasket, drawFx, drawMarks,
  LOOKS, PLAYER_LOOKS, FX_LIFE, type Imgs, type Fx, type Mark, type Look } from "./tankArt";
import { useTankRoom, savedSession, AWAY_MS, type RoomState, type Saved } from "./tankNet";
import { GAME_FONT, loadGameFont } from "./gameFont";
import { textStamps } from "./art2/paint";

const GAME = "pea-tanks";
const LAUNCH = "2026-11-08";   // Today's Challenge #1
const SALT = 0x7a4c5;          // keeps Today's tables apart from the other games' daily seeds
const WINS_TO = 3;
const STEP_MS = 1000 / 60, COUNT_MS = 1800, VS_COUNT_MS = 3000, END_MS = 1400, GO_MS = 700, LABEL_MS = 3000, LIVE_CARD_MS = 3500;
const CH = 132, CHL = 112;     // the control strip under the table (one strip, or one at each end on Same Phone)
const FONT = "system-ui, -apple-system, sans-serif";
const BLUE = "#3f7fd6", RED = "#e8505b", GREEN = "#2eaa6e", GREY = "#5a6b85";
const ICONS = ["1f34e", "1f34a", "1f34c", "1f347", "1f350", "1f34b", "1f963", ...POWERS.map(p => p.icon)];
const FRUIT = [["1f34e", "1f34a", "1f34c"], ["1f347", "1f350", "1f34e"], ["1f34a", "1f34b", "1f34c"]];
const KIND_LIST: Kind[] = ["player", "crouton", "meatball", "chili", "jelly", "popcorn", "bagel", "pretzel", "coconut"];
const REACHED_KEY = "peatanks-reached", PICK_KEY = "peatanks-room-pick";
const FACTS: Toast[] = [
  { title: "About Peas", body: "A cup of cooked green peas has about 8 grams of protein and about 8 grams of fibre.", img: "1fadb" },
  { title: "About Lettuce", body: "Lettuce is about 95% water.", img: "1f96c" },
  { title: "About Chili Peppers", body: "The heat in chili peppers comes from capsaicin, which is mostly in the pale ribs inside, not the seeds.", img: "1f336" },
];

type Game = "missions" | "guard" | "versus";
type Play =
  | { kind: "none" }
  | { kind: "solo"; game: "missions" | "guard"; daily: boolean; start: number; key: number }
  | { kind: "local"; game: Game; names: string[]; start: number; key: number }
  | { kind: "live"; game: Game; code: string; me: 0 | 1; names: string[]; start: number; key: number };
type Phase = "idle" | "lobby" | "card" | "count" | "play" | "end" | "over";
type CardInfo =
  | { k: "intro"; n: number; of: number; name: string; foes: Kind[]; isNew: Kind | null; newZone: number | null; lives: number; coop: boolean }
  | { k: "result"; n: number; secs: number; acc: number; pts: number; total: number; bonus: boolean; last: boolean }
  | { k: "retry"; n: number; lives: number }
  | { k: "guardOver"; waves: number; kills: number; score: number; best: number }
  | { k: "coopOver"; n: number; cleared: number; score: number; won: boolean };
type Result = { kind: "won" | "lost"; cleared: number; of: number; lives: number; acc: number; squares: string };
type Hud = { score: number; label: string; left: string; right: string; lives: number };
type Stick = { id: number; bx: number; by: number; kx: number; ky: number; moved: boolean };
type Ctl = { drive: Stick | null; aim: Stick | null; aimAngle: number | null; fc: number; mc: number; keys: Record<string, boolean>; keyFire: boolean; mouse: { x: number; y: number } | null };
type Snap = { k: number; at: number; ph: number; cl: number; a: number; T: number[][]; P: number[][] };
type Float = { text: string; x: number; y: number; color: string; age: number; life: number };
type NetMsg = { t: string; [k: string]: unknown };
type Engine = { onMsg: (m: NetMsg) => void; begin: () => void; onBack: () => void; next: () => void; again: () => void };

const newCtl = (): Ctl => ({ drive: null, aim: null, aimAngle: null, fc: 0, mc: 0, keys: {}, keyFire: false, mouse: null });
const q1 = (v: number) => Math.round(v * 10), q3 = (v: number) => Math.round(v * 1000);
function packTank(t: Tank) {
  return [q1(t.x), q1(t.y), q3(t.a), q3(t.ta), t.hp, Math.round(t.cd * 100), Math.round(t.vx), Math.round(t.vy), q1(t.inv), t.power, q1(t.powerT), t.shield ? 1 : 0, t.hidden ? 1 : 0,
    q1(t.out), KIND_LIST.indexOf(t.kind), t.team, t.fc, t.mc, q3(t.aimT)];
}
function unpackTank(a: number[]): Tank {
  return { x: a[0] / 10, y: a[1] / 10, a: a[2] / 1000, ta: a[3] / 1000, hp: a[4], cd: a[5] / 100, vx: a[6], vy: a[7], inv: a[8] / 10, power: a[9], powerT: a[10] / 10,
    shield: !!a[11], hidden: !!a[12], out: a[13] / 10, kind: KIND_LIST[a[14]], team: a[15], fc: a[16], mc: a[17], aimT: a[18] / 1000, pend: 0 };
}
const readBestSafe = (k: string) => (typeof window === "undefined" ? 0 : readBest(k));
const isDebug = () => { try { return new URLSearchParams(window.location.search).get("debug") === "1"; } catch { return false; } };
const readReached = () => { try { return Math.max(1, Math.min(MISSIONS, Number(localStorage.getItem(REACHED_KEY)) || 1)); } catch { return 1; } };
const saveReached = (n: number) => { try { if (n > readReached()) localStorage.setItem(REACHED_KEY, String(Math.min(MISSIONS, n))); } catch {} };
const lookFor = (kind: Kind, i: number, game: Game | null) => (kind === "player" ? PLAYER_LOOKS[i === 0 ? 0 : game === "versus" ? 1 : 2] : LOOKS[kind]);

export default function PeaTanks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("daily");
  const [play, setPlay] = useState<Play>({ kind: "none" });
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [card, setCard] = useState<CardInfo | null>(null);
  const [matchEnd, setMatchEnd] = useState<{ winner: number } | null>(null);
  const [wins, setWins] = useState([0, 0]);
  const [hud, setHud] = useState<Hud>({ score: 0, label: "", left: "", right: "", lives: LIVES });
  const [best, setBest] = useState(0);
  const [fact, setFact] = useState<Toast | null>(null);
  const [board, setBoard] = useState({ w: 0, h: 0 });
  const [menu, setMenu] = useState<null | "missions" | "friend" | "local">(null);
  const [menuGame, setMenuGame] = useState<Game>("missions");
  const [startAt, setStartAt] = useState(1);
  const [reached, setReached] = useState(1);
  const [code, setCode] = useState("");
  const [names, setNames] = useState(["", ""]);
  const [ready, setReady] = useState({ me: false, them: false });
  const [again, setAgain] = useState({ me: false, them: false });
  const [liveOn, setLiveOn] = useState(false);
  const [liveGame, setLiveGame] = useState<{ game: Game; start: number } | null>(null);   // guest: what the host picked
  const [rejoin, setRejoin] = useState<Saved | null>(null);
  const [pendingHow, setPendingHow] = useState<"solo" | "local" | "friend">("solo");
  const [, setNow] = useState(0);
  const shell = useGameShell(GAME, mode);
  const { reset: resetScores } = shell.scores;
  const pausedRef = useRef(false); pausedRef.current = shell.paused;
  const playRef = useRef(play); playRef.current = play;
  const engineRef = useRef<Engine | null>(null);
  const inbox = useRef<NetMsg[]>([]);
  const nameRef = useRef("Guest"); nameRef.current = shell.player?.name || "Guest";
  const hostPick = useRef<{ game: Game; start: number }>({ game: "versus", start: 1 });   // host: what this room plays
  const onGame = useRef<(m: NetMsg) => void>(() => {});
  const net = useTankRoom(GAME, nameRef, onGame);
  const netRef = useRef(net); netRef.current = net;
  const rui = net.room;
  const flags = useRef({ ready, again, liveOn, matchEnd }); flags.current = { ready, again, liveOn, matchEnd };
  onGame.current = (m: NetMsg) => {
    if (m.t === "ready") setReady(r => ({ ...r, them: true }));
    else if (m.t === "again") setAgain(a => ({ ...a, them: true }));
    else if (m.t === "setup") setLiveGame({ game: m.game as Game, start: m.start as number });
    else if (m.t === "_back") {
      const f = flags.current, n = netRef.current;
      if (n.room?.role === "host") n.send({ t: "setup", ...hostPick.current }, true);
      if (f.ready.me && !f.liveOn) n.send({ t: "ready" }, true);
      if (f.again.me && f.matchEnd) n.send({ t: "again" }, true);
      engineRef.current?.onBack();
    }
    else if (engineRef.current) engineRef.current.onMsg(m);
    else inbox.current.push(m);
  };
  const bestKey = mode === "daily" ? `peatanks2-daily-${torontoDate()}` : "peatanks2-free";
  useEffect(() => { setBest(readBest(bestKey)); setReached(readReached()); }, [bestKey]);

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? "", saved = savedSession(GAME);
    if (saved && saved.role === "host") { try { const pk = JSON.parse(localStorage.getItem(PICK_KEY) || "null"); if (pk) hostPick.current = pk; } catch {} }   // what the reloaded host was playing
    if (/^[A-Z]{4}$/.test(c)) { if (saved && saved.code === c) netRef.current.resume(saved); else netRef.current.join(c); }
    else if (saved) setRejoin(saved);
    const away = () => netRef.current.suspend();
    const back = (e: PageTransitionEvent) => { const sv = savedSession(GAME); if (e.persisted && sv) netRef.current.resume(sv); };
    window.addEventListener("pagehide", away); window.addEventListener("pageshow", back);
    return () => { window.removeEventListener("pagehide", away); window.removeEventListener("pageshow", back); away(); };
  }, []);
  useEffect(() => { if (!net.away) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [net.away]);

  // the room pairs up: the host says what you're playing, then the Get Ready card; the room ends: back to the menu
  const roomS = rui?.s, roomCode = rui?.code, roomRole = rui?.role, roomFriend = rui?.friend;
  useEffect(() => {
    if (roomS === "paired" && roomCode && roomRole) {
      const me = roomRole === "host" ? 0 : 1, nm = [nameRef.current, roomFriend || "Guest"];
      setReady({ me: false, them: false }); setAgain({ me: false, them: false }); setLiveOn(false); setMatchEnd(null); setWins([0, 0]); setMenu(null); setCard(null);
      if (me === 0) netRef.current.send({ t: "setup", ...hostPick.current }, true);
      const g = me === 0 ? hostPick.current : null;
      setPlay({ kind: "live", game: g?.game ?? "versus", code: roomCode, me: me as 0 | 1, names: me === 0 ? nm : [nm[1], nm[0]], start: g?.start ?? 1, key: Date.now() });
    } else if (roomS === "left" || roomS === "lost") { setMatchEnd(null); setLiveOn(false); setCard(null); setPlay({ kind: "none" }); }
  }, [roomS, roomCode, roomRole, roomFriend]);
  // the guest learns the game from the host
  useEffect(() => {
    if (!liveGame) return;
    setPlay(p => (p.kind === "live" && p.me === 1 && (p.game !== liveGame.game || p.start !== liveGame.start) ? { ...p, game: liveGame.game, start: liveGame.start, key: Date.now() } : p));
  }, [liveGame]);

  const isHost = play.kind === "live" && play.me === 0;
  useEffect(() => {
    if (!isHost || net.mode === "connecting") return;
    if ((!liveOn && ready.me && ready.them) || ((matchEnd || card?.k === "coopOver" || card?.k === "guardOver") && again.me && again.them)) engineRef.current?.begin();
  }, [isHost, net.mode, liveOn, ready, again, matchEnd, card]);

  const playKey = play.kind === "none" ? "none" : `${play.kind}-${play.game}-${play.key}`;
  useEffect(() => {
    const P = playRef.current, solo = P.kind === "solo", live = P.kind === "live", local = P.kind === "local", none = P.kind === "none";
    const game: Game | null = P.kind === "none" ? null : P.game;
    const me = P.kind === "live" ? P.me : 0, host = live && me === 0, guest = live && me === 1, rot = guest && game === "versus";
    const humans = game === null ? 1 : solo ? 1 : 2, controls = local ? 2 : 1;
    const mine = (c: number) => (live ? me : c);   // which tank control set c drives
    const TW = AW, TH = local ? AH + 2 * CHL : AH + CH, arenaY = local ? CHL : 0;
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const { ctx, stop } = fitCanvas(canvas, wrap, TW, TH, setBoard, 0);
    void loadGameFont();   // the display face for the banners on the table
    const imgs: Imgs = {}; for (const c of ICONS) { const i = new Image(); i.src = foodPng(c); imgs[c] = i; }
    const daily = solo && P.daily, dbg = isDebug();
    const pnames = P.kind === "live" ? P.names.map((v, i) => (i === me ? "You" : v)) : P.kind === "local" ? P.names : ["You", "Partner"];
    const said = (i: number) => (pnames[i] === "Guest" ? "Your Friend" : pnames[i]);
    const daySeed = dailySeed(SALT), dayLevels: Level[] = daily ? dailyLevels(daySeed) : [];

    // ── session state ──
    let phase: Phase = none ? "idle" : live ? "lobby" : "card", phaseT = 0, goT = 0, labelT = LABEL_MS, matchNo = 0, stage = 0;
    let w: World = none || game === "versus" ? newDuel(makeMap(12345), 1) : game === "guard" ? newGuard(1, humans) : newMission(missionLevel(1), 1, humans, LIVES);
    if (none) { w.tanks[1].hp = 0; }
    let brains: (Brain | null)[] = [], waves: Waves = newWaves(1), level: Level | null = null, mission = P.kind === "none" ? 1 : P.start, lives = LIVES;
    let endText = "", endSub = "", matchWinner = -1, cleared = 0;
    const mw = [0, 0];
    let total = 0, drops = 0, shotsAll = 0, hitsAll = 0, realStart = performance.now(), grabs = 0, kills = 0;
    const squares: string[] = [];
    // effects
    const floats: Float[] = [], fx: Fx[] = [], marks: Mark[] = [], flash: number[] = [], seenEv = new Set<number>(), trails = new Map<number, { x: number; y: number }[]>();
    const odo: { x: number; y: number; a: number; l: number; r: number; m: number }[] = [];
    let shake = 0, basketFlash = 0, tableCache: HTMLCanvasElement | null = null, cacheKey = "";
    // live host
    const inBuf = new Map<number, Input>(); let lastApplied = 0, maxSeen = 0, flowing = false, lastGuestIn: Input = NO_INPUT, starve = 0, sentOv = -1, obsT = 0;
    const hostHist: { x: number; y: number }[][] = []; const recentEv: { tick: number; e: number[] }[] = [];
    // live guest
    const snaps: Snap[] = []; let clockOff: number | null = null, seq = 0, pred: Tank = newTank("player", 0, SPAWNS[0].x, SPAWNS[0].y, -Math.PI / 2), predOn = false, lastSnap: Snap | null = null;
    const hist = new Map<number, Input>(); const off = { x: 0, y: 0, a: 0 }; let predPeas: Pea[] = []; const predSet = new Set<number>(); let sendT = 0;
    let gMines: Mine[] = [], gPicks: Pick[] = [], gOv = -1;
    const ctl: Ctl[] = [newCtl(), newCtl()];
    const testIn: (Input | null)[] = [null, null], testAuto: (Brain | null)[] = [null, null];

    const sendNet = (m: object, reliable: boolean) => { if (live) netRef.current.send(m, reliable); };
    const showCard = (c: CardInfo | null) => { setCard(c); if (host) sendNet({ t: "card", m: matchNo, card: c }, true); };
    const pushHud = () => {
      const left = w.tanks.slice(w.humans).filter(t => t.hp > 0).length;
      if (game === "missions") setHud({ score: total, label: daily ? `Mission ${mission} Of ${TODAY_MISSIONS} · ${left} Left` : `Mission ${mission} · ${left} Left`, left: String(lives), right: total.toLocaleString(), lives });
      else if (game === "guard") setHud({ score: guest ? total : waves.cleared * WAVE_POINTS + kills * KILL_POINTS, label: `Wave ${Math.max(1, waves.wave)} · Basket ${w.basket?.hp ?? 0}/${w.basket?.max ?? 0}`, left: String(Math.max(1, waves.wave)), right: total.toLocaleString(), lives: 0 });
    };
    setOver(false); setResult(null); setFact(null); setCard(null); resetScores();
    if (!live) { setWins([0, 0]); setMatchEnd(null); }

    // ── stages: a versus round, a mission, a Guard The Lunch game ──
    function setBrains() {
      brains = w.tanks.map((t, i) => (i < w.humans ? null : newBrain(((stage * 7919) ^ (i * 104729) ^ (daily ? daySeed : 99)) >>> 0,
        game === "guard" ? waveSharp(waves.wave) : sharpFor(daily ? mission : mission, daily))));
    }
    function resetFx() { floats.length = 0; fx.length = 0; marks.length = 0; seenEv.clear(); trails.clear(); odo.length = 0; recentEv.length = 0; hostHist.length = 0; tableCache = null; labelT = LABEL_MS; }
    function startStage() {
      stage++; resetFx();
      const seed = daily ? (daySeed ^ Math.imul(mission, 0x9e3779b1)) | 0 : Math.floor(Math.random() * 1e9);
      if (game === "versus") w = newDuel(makeMap(seed, 0, mulberry32(seed)() < 0.6 ? [Math.floor(mulberry32(seed ^ 7)() * 4)] : []), seed);
      else if (game === "guard") { w = newGuard(seed, humans); waves = newWaves(seed); }
      else { level = daily ? dayLevels[mission - 1] : missionLevel(mission); w = newMission(level, seed, humans, lives); }
      setBrains();
      ctl.forEach(c => { c.fc = 0; c.mc = 0; });
      phase = "count"; phaseT = game === "versus" ? VS_COUNT_MS : COUNT_MS; goT = 0;
      if (host) { inBuf.clear(); flowing = false; lastGuestIn = NO_INPUT; lastApplied = maxSeen = 0; sentOv = w.ov; sendFull(); }
      pushHud();
    }
    function introMission() {
      level = daily ? dayLevels[mission - 1] : missionLevel(mission);
      const c: CardInfo = { k: "intro", n: mission, of: daily ? TODAY_MISSIONS : MISSIONS, name: level.name, foes: level.foes.map(f => f.kind), isNew: level.isNew, newZone: level.newZone, lives, coop: humans > 1 };
      w = newMission(level, 1, humans, lives); setBrains(); tableCache = null; resetFx();
      if (host) { phase = "card"; sendFull(); }
      card2(c); pushHud();
    }
    function next() {   // the button on a card (solo and Same Phone), or the host's card timer in a live game
      if (phase !== "card") return;
      const c = cardNow;
      showCard(null); cardNow = null;
      if (!c) return;
      if (c.k === "intro" || c.k === "retry") startStage();
      else if (c.k === "result") { if (c.last) endRun(true); else { mission++; introMission(); } }
    }
    let cardNow: CardInfo | null = null;
    const card2 = (c: CardInfo) => { cardNow = c; phase = "card"; phaseT = live ? LIVE_CARD_MS : 1e9; showCard(c); };
    function beginSession() {   // a fresh game (also a rematch / play again)
      matchNo++; mw[0] = mw[1] = 0; setWins([0, 0]); setMatchEnd(null); setAgain({ me: false, them: false });
      total = 0; drops = 0; shotsAll = 0; hitsAll = 0; kills = 0; grabs = 0; squares.length = 0; cleared = 0; realStart = performance.now(); lives = LIVES;
      mission = P.kind === "none" ? 1 : P.start; setOver(false); setResult(null); setFact(null); resetScores();
      if (live) setLiveOn(true);
      if (game === "missions") introMission(); else startStage();
    }
    function endStage(kind: "versus" | "cleared" | "down" | "basket", win = -1) {
      phase = "end"; phaseT = END_MS;
      if (kind === "versus") {
        if (win !== 2) mw[win]++;
        endText = win === 2 ? "Tie Round" : live ? (win === me ? "You Win The Round!" : `${said(win)} Wins The Round`) : `${pnames[win]} Wins The Round!`;
        endSub = live ? `You ${mw[me]} · ${pnames[1 - me]} ${mw[1 - me]}` : `${pnames[0]} ${mw[0]} · ${pnames[1]} ${mw[1]}`;
        setWins(mw.slice());
        if (host) sendNet({ t: "rend", m: matchNo, st: stage, win, wins: mw.slice(), text: endText }, true);
      } else if (kind === "cleared") { endText = "Mission Cleared!"; endSub = ""; }
      else if (kind === "down") { endText = lives > 0 ? "Knocked Out" : "Out Of Lives"; endSub = ""; }
      else { endText = "The Lunch Is Gone!"; endSub = `Wave ${waves.wave}`; }
      if (host && kind !== "versus") sendNet({ t: "rend", m: matchNo, st: stage, win: -1, text: endText, sub: endSub }, true);
      pendingEnd = kind;
    }
    let pendingEnd: "versus" | "cleared" | "down" | "basket" | null = null;
    function afterEnd() {
      const kind = pendingEnd; pendingEnd = null;
      if (kind === "versus") {
        if (mw[0] >= WINS_TO || mw[1] >= WINS_TO) {
          phase = "over"; matchWinner = mw[0] >= WINS_TO ? 0 : 1;
          if (host) sendNet({ t: "mend", m: matchNo, wins: mw.slice(), win: matchWinner }, true);
          setMatchEnd({ winner: matchWinner });
        } else startStage();
        return;
      }
      if (kind === "basket") {
        const sc = waves.cleared * WAVE_POINTS + kills * KILL_POINTS, key = humans > 1 ? "peatanks2-guard-coop" : "peatanks2-guard", b = Math.max(readBest(key), sc);
        saveBest(key, b); phase = "card"; cardNow = null; phaseT = 1e9;
        showCard({ k: "guardOver", waves: waves.cleared, kills, score: sc, best: b }); return;
      }
      if (kind === "cleared") {
        const secs = w.time, sh = w.shots.slice(0, w.humans).reduce((a, b) => a + b, 0), hi = w.hits.slice(0, w.humans).reduce((a, b) => a + b, 0);
        const pts = missionPoints(secs, sh, hi, w.kills.slice(0, w.humans).reduce((a, b) => a + b, 0));
        total += pts; drops += sh; shotsAll += sh; hitsAll += hi; cleared++; squares.push("🟩"); grabs += w.grabs.slice(0, w.humans).reduce((a, b) => a + b, 0);
        if (!daily) { saveReached(mission + 1); setReached(readReached()); }
        const bonus = !daily && mission % 5 === 0 && mission < MISSIONS; if (bonus) lives++;
        const last = daily ? mission >= TODAY_MISSIONS : mission >= MISSIONS;
        pushHud();
        card2({ k: "result", n: mission, secs: Math.round(secs), acc: sh ? Math.round((100 * hi) / sh) : 0, pts, total, bonus, last });
        return;
      }
      // knocked out (every player down)
      drops += w.shots.slice(0, w.humans).reduce((a, b) => a + b, 0); squares.push("🟥");
      lives = w.lives; pushHud();
      if (lives > 0) card2({ k: "retry", n: mission, lives });
      else endRun(false);
    }
    function endRun(won: boolean) {
      if (won) total += DAY_BONUS + lives * LIFE_BONUS;
      pushHud();
      if (humans > 1) { phase = "card"; cardNow = null; phaseT = 1e9; showCard({ k: "coopOver", n: mission, cleared, score: total, won }); return; }
      phase = "over";
      setFact(grabs > 0 ? FACTS[1 + (cleared % 2)] : FACTS[0]);
      setResult({ kind: won ? "won" : "lost", cleared, of: daily ? TODAY_MISSIONS : MISSIONS - (P.kind === "solo" ? P.start - 1 : 0), lives, acc: shotsAll ? Math.round((100 * hitsAll) / shotsAll) : 0, squares: squares.join("") });
      setOver(true);
      if (total > readBest(bestKey)) { saveBest(bestKey, total); setBest(total); }
      shell.finishRef.current({ score: total, drops, ms: performance.now() - realStart });
    }
    function again() { beginSession(); }

    // ── live: the host's messages to the guest ──
    function fullState(): object {
      return { t: "full", m: matchNo, st: stage, game, ph: phCode(), cl: Math.max(0, Math.round(phaseT)), map: w.map, ov: w.ov, humans: w.humans, T: w.tanks.map(packTank),
        lives, basket: w.basket, wins: mw.slice(), n: mission, wave: waves.wave, win: matchWinner, time: Math.round(w.time * 10) / 10, total };
    }
    const phCode = () => (phase === "count" ? 0 : phase === "play" ? 1 : phase === "end" ? 2 : phase === "over" ? 3 : phase === "card" ? 5 : 4);
    function sendFull() { if (host) { lastApplied = maxSeen = 0; inBuf.clear(); flowing = false; sendNet(fullState(), true); } }
    function onBack() {
      if (!host) return;
      if (matchNo > 0) { sendFull(); sendNet({ t: "card", m: matchNo, card: cardNow ?? (phase === "card" ? null : null) }, true); }
      else sendNet({ t: "need" }, true);
    }
    function fromFull(m: NetMsg, asHost: boolean) {   // guest: the host's full picture (a new stage, or after someone stepped away); host: after a reload
      matchNo = m.m as number; stage = m.st as number; mission = m.n as number; lives = m.lives as number;
      const map = m.map as TableMap, T = m.T as number[][];
      w = { ...newDuel(map, 1), mode: m.game as Game, humans: m.humans as number, tanks: T.map(unpackTank), basket: m.basket as World["basket"], lives };
      w.map = map; w.ov = m.ov as number; gOv = w.ov; w.time = m.time as number;
      w.shots = w.tanks.map(() => 0); w.hits = w.tanks.map(() => 0); w.kills = w.tanks.map(() => 0); w.grabs = w.tanks.map(() => 0);
      const wv = m.wins as number[]; mw[0] = wv[0]; mw[1] = wv[1]; setWins(mw.slice()); total = (m.total as number) ?? 0;
      waves = { ...waves, wave: m.wave as number };
      snaps.length = 0; lastSnap = null; clockOff = null; hist.clear(); predPeas = []; predSet.clear(); off.x = off.y = off.a = 0; predOn = false; gMines = []; gPicks = [];
      resetFx(); pred = { ...w.tanks[me] };
      const ph = m.ph as number;
      if (ph !== 4) setLiveOn(true);
      phase = ph === 0 ? "count" : ph === 1 ? "play" : ph === 2 ? "end" : ph === 3 ? "over" : ph === 5 ? "card" : "lobby";
      phaseT = ph === 0 ? (m.cl as number) : 1e9; if (ph === 1) predOn = !asHost;
      if (ph === 3 && game === "versus") setMatchEnd({ winner: m.win as number });
      if (asHost) {   // a reloaded host picks up where the guest's picture left off
        setBrains(); pushHud();
        if (ph === 5 || ph === 2) { if (game === "missions") introMission(); else startStage(); return; }
        sendFull();
      }
      pushHud();
    }
    function have() {   // guest: answer a reloaded host's "need" with our last picture of the game
      if (matchNo === 0) { sendNet({ t: "have", m: 0 }, true); return; }
      const st = fullState() as Record<string, unknown>;
      if (lastSnap) st.T = lastSnap.T;
      sendNet({ ...st, t: "have" }, true);
    }
    function onMsg(m: NetMsg) {
      if (host) {
        if (m.t === "have") { if (matchNo === 0 && (m.m as number) > 0) fromFull(m, true); else sendFull(); return; }
        if (m.t === "needObs") { sentOv = w.ov; sendNet({ t: "obs", st: stage, ov: w.ov, obs: w.map.obs }, true); return; }
        if (m.t === "i" && m.st === stage && phase === "play") {
          const runs = m.n as number[][], top = m.s as number, low = top - runs.reduce((a, r) => a + r[0], 0) + 1;
          if (lastApplied === 0) lastApplied = low - 1;
          if (top - lastApplied > 90) { lastApplied = low - 1; inBuf.clear(); flowing = false; }
          let sq = top;
          for (const [cnt, ax, ay, aim, fire, fc, mc] of runs) for (let j = 0; j < cnt; j++, sq--) if (sq > lastApplied && !inBuf.has(sq)) inBuf.set(sq, { ax: ax / 100, ay: ay / 100, aim: aim === 9999 ? null : aim / 1000, fire: !!fire, fc, mc, s: sq });
          if (top > maxSeen) maxSeen = top;
        }
        return;
      }
      if (m.t === "full") { if ((m.m as number) >= matchNo) fromFull(m, false); return; }
      if (m.t === "need") { have(); return; }
      if (m.t === "card") { if ((m.m as number) === matchNo || m.card === null) { setCard((m.card as CardInfo) ?? null); if (m.card) { phase = "card"; predOn = false; } } return; }
      if (m.t === "obs") { if (m.st === stage && (m.ov as number) > gOv) { gOv = m.ov as number; w.map = { ...w.map, obs: m.obs as Ob[] }; tableCache = null; } return; }
      if (m.t === "rend" && m.m === matchNo && m.st === stage) {
        phase = "end"; phaseT = 1e9; predOn = false; endText = m.text as string; endSub = (m.sub as string) ?? "";
        if (m.wins) {   // a versus round: word the banner from this phone's side (the host's text says "You" for the host)
          const wv = m.wins as number[], win = m.win as number; mw[0] = wv[0]; mw[1] = wv[1]; setWins(mw.slice());
          endText = win === 2 ? "Tie Round" : win === me ? "You Win The Round!" : `${said(win)} Wins The Round`;
          endSub = `You ${mw[me]} · ${pnames[1 - me]} ${mw[1 - me]}`;
        }
        return;
      }
      if (m.t === "mend" && m.m === matchNo) { const wv = m.wins as number[]; mw[0] = wv[0]; mw[1] = wv[1]; setWins(mw.slice()); phase = "over"; setMatchEnd({ winner: m.win as number }); return; }
      if (m.t === "s" && m.m === matchNo && m.st === stage) onSnap(m);
    }
    function onSnap(m: NetMsg) {
      const now = performance.now();
      const s: Snap = { k: m.k as number, at: now, ph: m.ph as number, cl: m.cl as number, a: m.a as number, T: m.T as number[][], P: m.P as number[][] };
      if (lastSnap && s.k <= lastSnap.k) return;
      const sample = s.k - now / STEP_MS;
      clockOff = clockOff === null || Math.abs(sample - clockOff) > 40 ? sample : clockOff + (sample - clockOff) * 0.08;
      snaps.push(s); while (snaps.length > 40) snaps.shift();
      lastSnap = s;
      if (s.ph === 0 && phase === "count") phaseT = Math.min(phaseT, s.cl);
      if (s.ph === 1 && (phase === "count" || phase === "lobby")) { phase = "play"; goT = GO_MS; }
      if (s.ph === 1 && phase === "play") predOn = true;
      // tanks that joined (Guard The Lunch waves)
      while (w.tanks.length < s.T.length) { const t = unpackTank(s.T[w.tanks.length]); w.tanks.push(t); w.shots.push(0); w.hits.push(0); w.kills.push(0); w.grabs.push(0); }
      for (let i = 0; i < s.T.length; i++) {
        const t = unpackTank(s.T[i]);
        if (i === me && predOn) { const p = w.tanks[i]; Object.assign(p, { hp: t.hp, power: t.power, powerT: t.powerT, shield: t.shield, inv: t.inv, hidden: t.hidden, out: t.out }); }
        else w.tanks[i] = t;
      }
      gMines = ((m.M as number[][]) ?? []).map(a => ({ id: a[0], o: a[1], team: a[2], x: a[3], y: a[4], t: a[5] / 10, fuse: a[6] / 100 }));
      gPicks = ((m.K as number[][]) ?? []).map(a => ({ id: a[0], k: a[1], x: a[2], y: a[3], life: a[4] / 10 }));
      lives = m.L as number; w.lives = lives; w.freezeT = (m.F as number) / 10; w.time = m.tm as number; total = (m.S as number) ?? total;
      if (w.basket && m.B !== undefined) w.basket.hp = m.B as number;
      if (m.W !== undefined) waves = { ...waves, wave: m.W as number };
      if ((m.ov as number) > gOv) netRef.current.send({ t: "needObs" }, true);
      for (const e of (m.E as number[][]) ?? []) { if (seenEv.has(e[0])) continue; seenEv.add(e[0]); showEvent(e[1], e[2], e[3], e[4], e[5]); }
      if (predOn) {
        const server = unpackTank(s.T[me]), others = s.T.map(unpackTank).filter((_, i) => i !== me);
        for (const k of [...hist.keys()]) if (k <= s.a) hist.delete(k);
        const st = { ...server };
        const out = predPeas.length;
        for (let k = s.a + 1; k <= seq; k++) { const inp = hist.get(k); if (inp) stepTank(st, inp, w.map, others, out, false, w.basket); }
        const ex = pred.x + off.x - st.x, ey = pred.y + off.y - st.y;
        if (ex * ex + ey * ey > 60 * 60) { off.x = off.y = off.a = 0; }
        else { off.x = ex; off.y = ey; off.a = wrapAngle(pred.ta + off.a - st.ta); }
        st.fc = pred.fc; st.mc = pred.mc; st.pend = pred.pend; pred = st;
      }
      pushHud();
    }
    const EVK = ["hit", "pick", "splat", "spark", "fire", "ko", "boom", "crumble", "block", "basket", "mine"];
    const evc: Record<string, number> = {};   // events seen, by kind (the browser test compares the two screens)
    function showEvent(k: number, x: number, y: number, v: number, n: number) {
      const kind = EVK[k]; evc[kind] = (evc[kind] ?? 0) + 1;
      if (kind === "hit") {
        flash[v] = 1; shake = Math.max(shake, 1);
        fx.push({ k: "splat", x, y, age: 0, a: Math.random() * 6, col: "#6cbf3c" });
        if (guest && n === me) { const pp = predPeas.findIndex(p => Math.hypot(p.x - x, p.y - y) < 40); if (pp >= 0) predPeas.splice(pp, 1); }
      } else if (kind === "ko") {
        fx.push({ k: "boom", x, y, age: 0, a: 0, col: "#6cbf3c" }); shake = Math.max(shake, 2);
        const t = w.tanks[v];
        if (t && t.kind === "player" && game === "missions") floats.push({ text: "Knocked Out", x, y, color: RED, age: 0, life: 1400 });
      } else if (kind === "pick") floats.push({ text: POWERS[n]?.short ?? "", x, y, color: GREEN, age: 0, life: 1300 });
      else if (kind === "splat") fx.push({ k: "splat", x, y, age: 0, a: Math.random() * 6, col: "#7fc04f" });
      else if (kind === "spark") fx.push({ k: "spark", x, y, age: 0, a: Math.random() * 6, col: "" });
      else if (kind === "fire") { fx.push({ k: "puff", x, y, age: 0, a: n / 1000, col: "" }); }
      else if (kind === "boom") { fx.push({ k: "boom", x, y, age: 0, a: 0, col: "" }); shake = Math.max(shake, 3); }
      else if (kind === "crumble") { fx.push({ k: "crumble", x, y, age: 0, a: Math.random() * 6, col: ["#f2994a", "#e8505b", "#4f9ad8"][n % 3] }); tableCache = null; }
      else if (kind === "block") fx.push({ k: "block", x, y, age: 0, a: 0, col: "" });
      else if (kind === "basket") { basketFlash = 1; shake = Math.max(shake, 2); floats.push({ text: `Basket ${n}`, x, y: y - 26, color: RED, age: 0, life: 1100 }); }
    }

    // ── input ──
    const toLocal = (e: PointerEvent | MouseEvent) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * TW, y: ((e.clientY - r.top) / r.height) * TH }; };
    function zones(c: number) {   // control set c's strip: drive stick, mine button, aim stick
      if (!local) { const cy = AH + CH / 2 + 4; return { y0: AH, y1: AH + CH, sx: 66, sy: cy, ax: AW - 70, ay: cy, mx: AW / 2 + 8, my: cy + 26, r: 42, mr: 17, flip: false }; }
      if (c === 0) { const cy = CHL + AH + CHL / 2 + 2; return { y0: CHL + AH, y1: TH, sx: 62, sy: cy, ax: AW - 64, ay: cy, mx: AW / 2 + 6, my: cy + 22, r: 36, mr: 15, flip: false }; }
      const cy = CHL / 2 - 2; return { y0: 0, y1: CHL, sx: AW - 62, sy: cy, ax: 64, ay: cy, mx: AW / 2 - 6, my: cy - 22, r: 36, mr: 15, flip: true };
    }
    function screenToWorld(p: { x: number; y: number }) { const ly = p.y - arenaY; return rot ? { x: AW - p.x, y: AH - ly } : { x: p.x, y: ly }; }
    const onDown = (e: PointerEvent) => {
      const p = toLocal(e);
      if (e.pointerType === "mouse" && p.y >= arenaY && p.y <= arenaY + AH) {   // desktop: click fires, right-click drops a mine
        if (e.button === 2) ctl[0].mc++; else ctl[0].fc++;
        e.preventDefault(); return;
      }
      for (let c = 0; c < controls; c++) {
        const z = zones(c);
        if (p.y < z.y0 - 4 || p.y > z.y1 + 4) continue;
        const cl = ctl[c];
        try { canvas.setPointerCapture(e.pointerId); } catch {}
        e.preventDefault();
        if (Math.hypot(p.x - z.mx, p.y - z.my) < z.mr + 8) { cl.mc++; return; }
        const driveSide = z.flip ? p.x > AW / 2 + 10 : p.x < AW / 2 - 10;
        const m = z.r * 0.75;
        const st: Stick = { id: e.pointerId, bx: Math.max(m, Math.min(AW - m, p.x)), by: Math.max(z.y0 + m, Math.min(z.y1 - m, p.y)), kx: 0, ky: 0, moved: false };
        if (driveSide) { if (!cl.drive) cl.drive = st; }
        else if (!cl.aim) { st.bx = z.ax; st.by = z.ay; cl.aim = st; onMove(e); }   // the aim stick doesn't float: you drag out from its middle
        return;
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = toLocal(e);
      if (e.pointerType === "mouse" && p.y >= arenaY && p.y <= arenaY + AH && !ctl[0].aim) { ctl[0].mouse = screenToWorld(p); }
      for (let c = 0; c < controls; c++) {
        const z = zones(c), cl = ctl[c];
        for (const st of [cl.drive, cl.aim]) {
          if (!st || st.id !== e.pointerId) continue;
          const dx = p.x - st.bx, dy = p.y - st.by, d = Math.hypot(dx, dy);
          st.kx = d > z.r ? (dx / d) * z.r : dx; st.ky = d > z.r ? (dy / d) * z.r : dy;
          if (d > 9) st.moved = true;
          if (st === cl.aim && d > 9) { const v = rot ? { x: -dx, y: -dy } : { x: dx, y: dy }; cl.aimAngle = Math.atan2(v.y, v.x); }
        }
      }
    };
    const onUp = (e: PointerEvent) => {
      for (let c = 0; c < controls; c++) {
        const cl = ctl[c];
        if (cl.drive?.id === e.pointerId) cl.drive = null;
        if (cl.aim?.id === e.pointerId) { cl.fc++; cl.aim = null; }   // let go to fire (a tap fires where the straw points)
      }
    };
    const onLeave = () => { ctl[0].mouse = null; };
    const onCtx = (e: MouseEvent) => e.preventDefault();
    const KEYS: Record<string, [number, string]> = local
      ? { KeyW: [0, "u"], KeyS: [0, "d"], KeyA: [0, "l"], KeyD: [0, "r"], KeyQ: [0, "tl"], KeyE: [0, "tr"], Space: [0, "f"], KeyF: [0, "m"],
        ArrowUp: [1, "u"], ArrowDown: [1, "d"], ArrowLeft: [1, "l"], ArrowRight: [1, "r"], Comma: [1, "tl"], Period: [1, "tr"], Enter: [1, "f"], Slash: [1, "m"] }
      : { KeyW: [0, "u"], KeyS: [0, "d"], KeyA: [0, "l"], KeyD: [0, "r"], ArrowLeft: [0, "tl"], ArrowRight: [0, "tr"], Space: [0, "f"], Enter: [0, "f"], KeyE: [0, "m"], ShiftLeft: [0, "m"], ShiftRight: [0, "m"] };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const k = KEYS[e.code]; if (!k) return;
      e.preventDefault();
      const down = e.type === "keydown", cl = ctl[k[0]];
      if (k[1] === "f") { if (down && !e.repeat) cl.fc++; cl.keyFire = down; }
      else if (k[1] === "m") { if (down && !e.repeat) cl.mc++; }
      else cl.keys[k[1]] = down;
    };
    /** Control set c as table directions: drive vector, aim angle, presses. */
    function readCtl(c: number): Input {
      const cl = ctl[c], t = guest ? pred : w.tanks[mine(c)]; let ax = 0, ay = 0;
      if (cl.drive) { const r = zones(c).r; ax = cl.drive.kx / r; ay = cl.drive.ky / r; if (rot) { ax = -ax; ay = -ay; } }
      else {
        ax = (cl.keys.r ? 1 : 0) - (cl.keys.l ? 1 : 0); ay = (cl.keys.d ? 1 : 0) - (cl.keys.u ? 1 : 0);
        const d = Math.hypot(ax, ay); if (d > 0) { ax /= d; ay /= d; }
        if (rot) { ax = -ax; ay = -ay; }
      }
      let aim: number | null = null;
      if (cl.aim && cl.aimAngle !== null) aim = cl.aimAngle;
      else if (cl.keys.tl || cl.keys.tr) aim = (t?.ta ?? 0) + (cl.keys.tr ? 0.35 : -0.35) * (rot ? -1 : 1);
      else if (cl.mouse && t) aim = Math.atan2(cl.mouse.y - t.y, cl.mouse.x - t.x);
      return { ax: Math.round(ax * 100) / 100, ay: Math.round(ay * 100) / 100, aim: aim === null ? null : Math.round(aim * 1000) / 1000, fire: cl.keyFire, fc: cl.fc, mc: cl.mc };
    }
    function inputFor(c: number): Input {
      const auto = testAuto[c];
      if (auto) {
        if (!guest) return aiInput(w, auto, mine(c));
        const tanks = w.tanks.map((t, i) => (i === me ? pred : interpTank(i) ?? t));
        return aiInput({ ...w, tanks, peas: [], mines: gMines, picks: gPicks }, auto, me);
      }
      const t = testIn[c];
      if (t) return rot ? { ...t, ax: -t.ax, ay: -t.ay } : t;
      return readCtl(c);
    }
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp); canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("contextmenu", onCtx);
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey);

    // ── simulation ──
    function collectEvents() {
      const codes: Record<string, number> = { hit: 0, pick: 1, splat: 2, spark: 3, fire: 4, ko: 5, boom: 6, crumble: 7, block: 8, basket: 9, mine: 10 };
      for (const e of w.events) {
        showEvent(codes[e.k], e.x, e.y, e.v, e.n);
        if (e.k === "ko" && e.v >= w.humans && e.n >= 0 && e.n < w.humans) kills++;
        if (host) recentEv.push({ tick: w.tick, e: [e.id, codes[e.k], Math.round(e.x), Math.round(e.y), e.v, e.n] });
      }
      w.events.length = 0;
      while (recentEv.length && recentEv[0].tick < w.tick - 60) recentEv.shift();
    }
    function guestInputForHost(): Input[] {
      const target = netRef.current.netMode() === "relay" ? 7 : 2, avail = maxSeen - lastApplied, out: Input[] = [];
      if (!flowing && avail >= target) flowing = true;
      if (flowing) {
        const take = avail > target * 2 + 2 ? 2 : avail >= 1 ? 1 : 0;
        for (let j = 0; j < take; j++) { lastApplied++; const inp = inBuf.get(lastApplied); inBuf.delete(lastApplied); if (inp) lastGuestIn = inp; out.push(inp ?? { ...lastGuestIn, s: -1 }); }
        if (take === 0) flowing = false;
      }
      starve = out.length ? 0 : starve + 1;
      return out;
    }
    function tick() {
      if (phase === "card") {
        phaseT -= STEP_MS;
        if (live && host && phaseT <= 0 && cardNow) next();
        if (host && w.tick % 30 === 0) hostSnap();
        if (host) w.tick++;
        return;
      }
      if (phase === "count") {
        phaseT -= STEP_MS;
        if (phaseT <= 0 && !guest) { phase = "play"; goT = GO_MS; }
        if (host && w.tick % (netRef.current.netMode() === "relay" ? 6 : 3) === 0) hostSnap();
        if (host) w.tick++;
        return;
      }
      if (phase === "end") {
        phaseT -= STEP_MS;
        if (host && w.tick % 6 === 0) hostSnap();
        if (host) w.tick++;
        if (phaseT <= 0 && !guest) afterEnd();
        return;
      }
      if (phase !== "play") return;
      if (guest) { guestTick(); return; }
      const inputs: Input[] = w.tanks.map((t, i) => {
        if (i >= w.humans) { const b = brains[i]; return b ? aiInput(w, b, i) : NO_INPUT; }
        if (live && i !== me) return NO_INPUT;   // filled in below
        return inputFor(live ? 0 : i);
      });
      if (host) {
        const g = guestInputForHost();
        if (!g.length && starve > 60 && w.tanks[1].hp > 0) return;   // a second with nothing from the guest: hold the game (the away card follows)
        while (g.length > 1) stepOneTank(w, 1, g.shift()!);
        inputs[1] = g[0] ?? (starve <= 8 ? { ...lastGuestIn, s: -1 } : { ...NO_INPUT, fc: lastGuestIn.fc, mc: lastGuestIn.mc, s: -1 });
        const rtt = netRef.current.rtt(), relay = netRef.current.netMode() === "relay";
        const back = Math.min(15, Math.round((rtt + (relay ? 14 : 7) * STEP_MS + (relay ? 7 : 2) * STEP_MS) / STEP_MS));
        w.lagPos = (v, p) => (p.o === 1 && v !== 1 && hostHist.length > back ? hostHist[hostHist.length - 1 - back][v] ?? w.tanks[v] : w.tanks[v]);
      }
      stepWorld(w, inputs);
      if (game === "guard") {
        const ni = stepWaves(w, waves);
        if (ni >= 0) brains[ni] = newBrain((stage * 31 + ni * 7) >>> 0, waveSharp(waves.wave));
        guardRespawn(w);
      }
      if (host) { hostHist.push(w.tanks.map(t => ({ x: t.x, y: t.y }))); if (hostHist.length > 40) hostHist.shift(); }
      collectEvents();
      let endKind: "versus" | "cleared" | "down" | "basket" | null = null, win = -1;
      if (game === "versus") { win = duelWinner(w); if (win >= 0) endKind = "versus"; }
      else if (game === "missions") { lives = w.lives; const st = missionState(w); if (st === "cleared") endKind = "cleared"; else if (st === "down") endKind = "down"; }
      else if (game === "guard" && w.basket && w.basket.hp <= 0) endKind = "basket";
      if (host) {
        const relay = netRef.current.netMode() === "relay";
        if (w.tick % (relay ? 6 : 3) === 0 || endKind) hostSnap();
        obsT -= STEP_MS;
        if (w.ov !== sentOv && obsT <= 0) { sentOv = w.ov; obsT = 100; sendNet({ t: "obs", st: stage, ov: w.ov, obs: w.map.obs }, true); }
      }
      if (w.tick % 15 === 0) pushHud();
      if (endKind) endStage(endKind, win);
    }
    function hostSnap() {
      sendNet({
        t: "s", m: matchNo, st: stage, k: w.tick, ph: phase === "count" ? 0 : phase === "play" ? 1 : phase === "end" ? 2 : 5, cl: Math.max(0, Math.round(phaseT)), a: lastApplied,
        tm: Math.round(w.time * 10) / 10, T: w.tanks.map(packTank), P: w.peas.map(p => [p.id, p.o, q1(p.x), q1(p.y), Math.round(p.vx), Math.round(p.vy), p.b, p.hops, p.cs]),
        M: w.mines.map(m => [m.id, m.o, m.team, Math.round(m.x), Math.round(m.y), q1(m.t), Math.round(m.fuse * 100)]), K: w.picks.map(k => [k.id, k.k, k.x, k.y, q1(k.life)]),
        E: recentEv.map(r => r.e), ov: w.ov, L: lives, F: q1(w.freezeT), B: w.basket?.hp, W: waves.wave, S: game === "guard" ? waves.cleared * WAVE_POINTS + kills * KILL_POINTS : total,
      }, false);
    }
    function guestTick() {
      if (!predOn) return;
      if (lastSnap && performance.now() - lastSnap.at > 1000) return;   // nothing from the host for a second: hold still
      if (pred.hp <= 0 && w.tanks[me]?.hp <= 0) return;
      seq++;
      const inp = { ...inputFor(0), s: seq };
      hist.set(seq, inp);
      const others = w.tanks.filter((_, i) => i !== me).map((t, j) => interpTank(j >= me ? j + 1 : j) ?? t);
      if (stepTank(pred, inp, w.map, others, predPeas.length, false, w.basket)) {
        const spreads = pred.power === 2 ? [-0.2, 0, 0.2] : [0];
        for (const sa of spreads) predPeas.push(peaFrom(pred, -seq * 10 - predPeas.length, me, seq, sa));
        predSet.add(seq);
        fx.push({ k: "puff", x: pred.x + Math.cos(pred.ta) * (TANK_R + 8), y: pred.y + Math.sin(pred.ta) * (TANK_R + 8), age: 0, a: pred.ta, col: "" });
      }
      // my peas fly on my screen straight away (bounces too); the host decides what they hit
      for (let k = predPeas.length - 1; k >= 0; k--) {
        const p = predPeas[k], r = stepPea(p, w.map, null);
        let hit = false;
        for (let i = 0; i < w.tanks.length && !hit; i++) {
          const t = i === me ? pred : interpTank(i); if (!t || t.hp <= 0) continue;
          if (i === me ? p.hops === 0 : w.tanks[i].team === w.tanks[me].team) continue;
          if (Math.hypot(p.x - t.x, p.y - t.y) < TANK_R + PEA_R) hit = true;
        }
        if (r === "spark") fx.push({ k: "spark", x: p.x, y: p.y, age: 0, a: 0, col: "" });
        if (r === "splat" || hit) { predPeas.splice(k, 1); if (r === "splat") fx.push({ k: "splat", x: p.x, y: p.y, age: 0, a: 0, col: "#7fc04f" }); }
      }
      const relay = netRef.current.netMode() === "relay";
      if (++sendT >= (relay ? 6 : 2)) {
        sendT = 0;
        const n: number[][] = []; const span = relay ? 20 : 8;
        for (let k = seq; k > Math.max(0, seq - span); k--) {
          const v = hist.get(k); if (!v) break;
          const row = [Math.round(v.ax * 100), Math.round(v.ay * 100), v.aim === null ? 9999 : Math.round(v.aim * 1000), v.fire ? 1 : 0, v.fc, v.mc], last = n[n.length - 1];
          if (last && row.every((x, j) => last[j + 1] === x)) last[0]++; else n.push([1, ...row]);
        }
        sendNet({ t: "i", st: stage, s: seq, n }, false);
      }
    }
    function renderTick() { if (clockOff === null) return 0; return performance.now() / STEP_MS + clockOff - (netRef.current.netMode() === "relay" ? 14 : 7); }
    function bracket() {
      const rt = renderTick();
      let a: Snap | null = null, b: Snap | null = null;
      for (let k = snaps.length - 1; k >= 0; k--) { if (snaps[k].k <= rt) { a = snaps[k]; b = snaps[k + 1] ?? null; break; } }
      if (!a) { a = snaps[0] ?? null; b = null; }
      const f = a && b ? Math.max(0, Math.min(1, (rt - a.k) / (b.k - a.k))) : 0;
      return { a, b, f, rt };
    }
    function interpTank(i: number): Tank | null {
      const { a, b, f } = bracket();
      if (!a || !a.T[i]) return w.tanks[i] ?? null;
      const ta = unpackTank(a.T[i]); if (!b || !b.T[i]) return ta;
      const tb = unpackTank(b.T[i]);
      if (ta.hp <= 0 && tb.hp > 0) return tb;   // a new tank in a reused slot: no sliding across the table
      return { ...tb, x: ta.x + (tb.x - ta.x) * f, y: ta.y + (tb.y - ta.y) * f, a: ta.a + wrapAngle(tb.a - ta.a) * f, ta: ta.ta + wrapAngle(tb.ta - ta.ta) * f };
    }

    // ── loop ──
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (t: number) => {
      const dt = Math.max(0, Math.min(250, t - last)); last = t;
      const frozen = live ? netRef.current.isAway() : pausedRef.current || phase === "idle";
      if (!frozen) {
        acc += dt; let n = 0;
        while (acc >= STEP_MS && n < 12) { acc -= STEP_MS; n++; tick(); }
        if (n >= 12) acc = 0;
        if (goT > 0) goT -= dt;
        if (phase === "play" || phase === "count") labelT -= dt;
        for (let k = floats.length - 1; k >= 0; k--) { floats[k].age += dt; if (floats[k].age > floats[k].life) floats.splice(k, 1); }
        for (let k = fx.length - 1; k >= 0; k--) { fx[k].age += dt; if (fx[k].age > FX_LIFE[fx[k].k]) fx.splice(k, 1); }
        for (let k = marks.length - 1; k >= 0; k--) { marks[k].age += dt; if (marks[k].age > 4000) marks.splice(k, 1); }
        for (let i = 0; i < flash.length; i++) flash[i] = Math.max(0, (flash[i] ?? 0) - dt / 220);
        basketFlash = Math.max(0, basketFlash - dt / 300); shake = Math.max(0, shake - dt / 120);
        const decay = Math.exp(-dt / 110); off.x *= decay; off.y *= decay; off.a *= decay;
      } else { ctl.forEach(c => { c.drive = null; c.aim = null; c.keyFire = false; }); }
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    // ── drawing ──
    const rr = (x: number, y: number, ww: number, hh: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, ww, hh, r); };
    const text = (s: string, x: number, y: number, size: number, color: string, weight = 700, align: CanvasTextAlign = "center") => {
      ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "alphabetic"; ctx.fillText(s, x, y);
    };
    const scr = (x: number, y: number) => ({ x: rot ? AW - x : x, y: (rot ? AH - y : y) + arenaY });
    const stamp = textStamps();
    function buildTable(): HTMLCanvasElement {
      const k = canvas.width / TW, c = document.createElement("canvas");
      c.width = Math.round(AW * k); c.height = Math.round(AH * k);
      const g = c.getContext("2d")!; g.scale(k, k);
      drawFloor(g);
      for (const z of w.map.zones) drawZone(g, z);
      for (const o of w.map.obs) if (o.ttl === undefined) drawShadow(g, o);
      for (const o of w.map.obs) if (o.ttl === undefined) drawCover(g, o, imgs, FRUIT);
      drawTableLight(g);
      return c;
    }
    function tankShown(i: number): Tank | null {
      if (guest) {
        if (i === me && predOn && phase === "play") return { ...pred, x: pred.x + off.x, y: pred.y + off.y, ta: pred.ta + off.a, hp: w.tanks[me].hp, shield: w.tanks[me].shield, power: w.tanks[me].power, inv: w.tanks[me].inv };
        if (i === me && lastSnap) return unpackTank(lastSnap.T[i]);
        return interpTank(i);
      }
      return w.tanks[i] ?? null;
    }
    function aimLine(c: number) {   // the dotted aim line with the first bounce, for whoever's aiming on this screen
      const cl = ctl[c], t = guest ? pred : w.tanks[mine(c)];
      if (!t || t.hp <= 0 || phase !== "play") return;
      const showing = (cl.aim && cl.aim.moved && cl.aimAngle !== null) || (cl.mouse && !local);
      if (!showing) return;
      const a = cl.aim && cl.aimAngle !== null ? cl.aimAngle : t.ta;
      const pts = tracePath(w.map, t.x + Math.cos(a) * (TANK_R + 6), t.y + Math.sin(a) * (TANK_R + 6), a, KINDS.player.bounce, 300);
      ctx.fillStyle = "rgba(16,27,46,0.42)";
      let dist = 0;
      for (let j = 0; j < pts.length - 1; j++) {
        const p = pts[j], q = pts[j + 1], seg = Math.hypot(q.x - p.x, q.y - p.y);
        for (let d = (j === 0 ? 0 : 7 - (dist % 7)); d < seg; d += 7) {
          const u = d / seg, al = Math.max(0.15, 1 - (dist + d) / 300);
          ctx.globalAlpha = al; ctx.beginPath(); ctx.arc(p.x + (q.x - p.x) * u, p.y + (q.y - p.y) * u, j === 0 ? 1.8 : 1.5, 0, 7); ctx.fill();
        }
        dist += seg;
        if (j === 0 && pts.length > 2) { ctx.globalAlpha = 0.6; ctx.strokeStyle = "rgba(16,27,46,0.5)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, 7); ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
    }
    function drawStrip(c: number) {
      const z = zones(c), cl = ctl[c], cx = AW / 2, cy = (z.y0 + z.y1) / 2, t = guest ? (w.tanks[me] ?? pred) : w.tanks[mine(c)];
      ctx.save();
      if (z.flip) { ctx.translate(cx, cy); ctx.rotate(Math.PI); ctx.translate(-cx, -cy); }
      const F = (x: number, y: number) => (z.flip ? { x: AW - x, y: 2 * cy - y } : { x, y });
      // drive stick (floating)
      const ds = F(z.sx, z.sy), dst = cl.drive, db = dst ? F(dst.bx, dst.by) : ds, dk = dst ? (z.flip ? { x: -dst.kx, y: -dst.ky } : { x: dst.kx, y: dst.ky }) : { x: 0, y: 0 };
      well(db.x, db.y, z.r, "rgba(63,127,214,0.32)", 2);
      knob(db.x + dk.x, db.y + dk.y, z.r * 0.44, dst ? "#3a78d0" : BLUE);
      text("Drive", ds.x, z.flip ? 2 * cy - z.y0 - 8 : z.y1 - 8, 11, GREY, 700);
      // aim stick: a ring with a straw; drag to aim, let go to fire
      const as = F(z.ax, z.ay), ast = cl.aim, ak = ast ? (z.flip ? { x: -ast.kx, y: -ast.ky } : { x: ast.kx, y: ast.ky }) : { x: 0, y: 0 };
      const ready = !t || t.cd <= 0;
      well(as.x, as.y, z.r, t && t.power === 1 ? "#d64545" : t && t.power === 2 ? GREEN : "rgba(95,174,52,0.55)", t && t.power > 0 ? 3.5 : 2);
      if (t && t.cd > 0) { ctx.strokeStyle = "rgba(95,174,52,0.9)"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(as.x, as.y, z.r - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - t.cd / KINDS.player.cd)); ctx.stroke(); }
      knob(as.x + ak.x, as.y + ak.y, z.r * 0.46, ast ? "#4f9a2a" : ready ? "#5fb434" : "#93c27a");
      text(ast ? "Let Go To Fire" : "Aim + Fire", as.x, z.flip ? 2 * cy - z.y0 - 8 : z.y1 - 8, 11, GREY, 700);
      // mine button
      const mb = F(z.mx, z.my), mineOut = t ? (guest ? gMines : w.mines).filter(m => m.o === (guest ? me : mine(c))).length : 0, left = MINE_CAP - mineOut;
      ctx.globalAlpha = left > 0 ? 1 : 0.45;
      ctx.fillStyle = "rgba(14,31,69,0.22)"; ctx.beginPath(); ctx.arc(mb.x + 0.6, mb.y + 2, z.mr, 0, 7); ctx.fill();
      const mg = ctx.createLinearGradient(0, mb.y - z.mr, 0, mb.y + z.mr); mg.addColorStop(0, "#ffffff"); mg.addColorStop(1, "#ffe3ea");
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mb.x, mb.y, z.mr, 0, 7); ctx.fill(); ctx.strokeStyle = "#e2456b"; ctx.lineWidth = 2; ctx.stroke();
      const bg2 = ctx.createRadialGradient(mb.x - 2.5, mb.y - 3, 0.5, mb.x, mb.y - 1, z.mr * 0.5); bg2.addColorStop(0, "#ff9fb4"); bg2.addColorStop(1, "#c92f56");
      ctx.fillStyle = bg2; ctx.beginPath(); ctx.ellipse(mb.x, mb.y - 1, z.mr * 0.45, z.mr * 0.34, 0.4, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.beginPath(); ctx.ellipse(mb.x - 2, mb.y - 3, 2.5, 1.2, -0.5, 0, 7); ctx.fill();
      text(`Mine ${left}`, mb.x, mb.y + z.mr + 11, 10, GREY, 700);
      ctx.globalAlpha = 1;
      // the middle of the strip: whose controls (Same Phone), or a quiet note when the connection is slow
      if (local) { text(pnames[c], cx - 6, cy - 14, 13, c === 0 ? BLUE : game === "versus" ? RED : GREEN, 800); if (game === "versus") text(`${mw[c]} ${mw[c] === 1 ? "Win" : "Wins"}`, cx - 6, cy + 1, 11, GREY, 700); }
      else if (live && netRef.current.netMode() === "relay") { text("Slow Connection", cx, cy - 22, 10, GREY, 700); text("Mode", cx, cy - 10, 10, GREY, 700); }
      ctx.restore();
    }
    // the control strip's pieces: a soft recessed well, and a glossy knob that sits in it
    function well(x: number, y: number, r: number, ring: string, rw: number) {
      const g = ctx.createLinearGradient(0, y - r, 0, y + r); g.addColorStop(0, "rgba(176,196,230,0.55)"); g.addColorStop(1, "rgba(255,255,255,0.8)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(14,31,69,0.1)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y + 1, r - 2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.strokeStyle = ring; ctx.lineWidth = rw; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
    }
    function knob(x: number, y: number, r: number, col: string) {
      ctx.fillStyle = "rgba(14,31,69,0.25)"; ctx.beginPath(); ctx.ellipse(x + 1, y + 3, r, r * 0.92, 0, 0, 7); ctx.fill();
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, "rgba(255,255,255,0.55)"); g.addColorStop(0.35, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(0,0,0,0.22)");
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.beginPath(); ctx.ellipse(x - r * 0.32, y - r * 0.4, r * 0.28, r * 0.15, -0.6, 0, 7); ctx.fill();
    }
    function panel(x: number, y: number, w2: number, h2: number) {
      const g = ctx.createLinearGradient(0, y, 0, y + h2); g.addColorStop(0, "rgba(255,255,255,0.62)"); g.addColorStop(1, "rgba(226,236,252,0.42)");
      ctx.fillStyle = "rgba(14,31,69,0.08)"; rr(x, y + 3, w2, h2, 18); ctx.fill();
      ctx.fillStyle = g; rr(x, y, w2, h2, 18); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.2; ctx.stroke();
    }
    function draw(t: number) {
      ctx.save(); ctx.clearRect(0, 0, TW, TH);
      if (local) { panel(0, 0, AW, CHL - 6); panel(0, CHL + AH + 6, AW, CHL - 6); }
      else panel(0, AH + 8, AW, CH - 8);
      if (!none) for (let c = 0; c < controls; c++) drawStrip(c);

      // the table
      const sx = shake > 0 ? (Math.random() - 0.5) * shake * 2.4 : 0, sy = shake > 0 ? (Math.random() - 0.5) * shake * 2.4 : 0;
      ctx.save(); rr(0, arenaY, AW, AH, 18); ctx.clip();
      ctx.translate(sx, arenaY + sy); if (rot) { ctx.translate(AW, AH); ctx.rotate(Math.PI); }
      const key = `${canvas.width}-${stage}-${matchNo}-${w.map.obs.length}-${w.ov}-${gOv}-${ICONS.every(c => imgs[c].complete)}`;
      if (!tableCache || key !== cacheKey) { tableCache = buildTable(); cacheKey = key; }
      ctx.drawImage(tableCache, 0, 0, AW, AH);
      for (const o of w.map.obs) if (o.ttl !== undefined) { drawShadow(ctx, o); drawCover(ctx, o, imgs, FRUIT); }   // bread walls, while they last
      // tread marks, under everything that moves
      drawMarks(ctx, marks);
      const tanks: (Tank | null)[] = w.tanks.map((_, i) => tankShown(i));
      for (let i = 0; i < tanks.length; i++) {   // roll the treads and leave marks
        const s = tanks[i]; if (!s || s.hp <= 0) continue;
        const o = odo[i] ?? (odo[i] = { x: s.x, y: s.y, a: s.a, l: 0, r: 0, m: 0 });
        const d = Math.hypot(s.x - o.x, s.y - o.y), da = wrapAngle(s.a - o.a), fwd = (s.x - o.x) * Math.cos(s.a) + (s.y - o.y) * Math.sin(s.a);
        if (d < 30) { o.l += fwd - da * 9.5; o.r += fwd + da * 9.5; o.m += d; if (o.m > 7) { o.m = 0; marks.push({ x: s.x, y: s.y, a: s.a, age: 0 }); if (marks.length > 260) marks.shift(); } }
        o.x = s.x; o.y = s.y; o.a = s.a;
      }
      const mines = guest ? gMines : w.mines, picks = guest ? gPicks : w.picks;
      for (const m of mines) drawMine(ctx, m, t);
      for (const p of picks) drawPick(ctx, p.x, p.y, POWERS[p.k].icon, p.life, t, imgs, rot);
      if (w.basket) drawBasket(ctx, w.basket, basketFlash);
      for (let i = 0; i < tanks.length; i++) {
        const s = tanks[i]; if (!s) continue;
        const look = lookFor(s.kind, i, game), o = odo[i];
        if (s.hp <= 0) { if ((s.kind !== "player" && game === "missions") || game === "versus") { ctx.globalAlpha = 0.28; drawLunchbox(ctx, s.x, s.y, s.a, s.ta, { ...look, body: "#9aa6b8" }, { treadL: 0, treadR: 0, flash: 0, shield: false, hard: false, ghost: 0, alpha: 0.3, frozen: false }); ctx.globalAlpha = 1; } continue; }
        const blink = s.inv > 0 && Math.sin(t / 60) > 0 ? 0.45 : 1;
        drawLunchbox(ctx, s.x, s.y, s.a, s.ta, look, { treadL: o?.l ?? 0, treadR: o?.r ?? 0, flash: flash[i] ?? 0, shield: s.shield, hard: s.kind === "coconut" && s.hp >= 2, ghost: 0, alpha: blink, frozen: w.freezeT > 0 && s.team === 1 && game !== "versus" });
      }
      // peas with a short trail
      const peaList: { id: number; x: number; y: number }[] = [];
      if (guest) {
        const { a, b, f, rt } = bracket();
        if (a) for (const p of a.P) {
          if (p[1] === me && predSet.has(p[8])) continue;
          const q = b ? b.P.find(v => v[0] === p[0]) : null;
          if (q) { const x0 = p[2] / 10, y0 = p[3] / 10, x1 = q[2] / 10, y1 = q[3] / 10; if (Math.hypot(x1 - x0, y1 - y0) < 40) peaList.push({ id: p[0], x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f }); else peaList.push({ id: p[0], x: x1, y: y1 }); }
          else if (!b && rt - a.k < 8) { const dtk = (rt - a.k) / 60; peaList.push({ id: p[0], x: p[2] / 10 + p[4] * dtk, y: p[3] / 10 + p[5] * dtk }); }
        }
        for (const p of predPeas) peaList.push({ id: p.id, x: p.x, y: p.y });
      } else for (const p of w.peas) peaList.push({ id: p.id, x: p.x, y: p.y });
      const live2 = new Set<number>();
      for (const p of peaList) {
        live2.add(p.id);
        const tr = trails.get(p.id) ?? []; drawPea(ctx, p.x, p.y, tr);
        tr.push({ x: p.x, y: p.y }); if (tr.length > 5) tr.shift(); trails.set(p.id, tr);
      }
      for (const id of [...trails.keys()]) if (!live2.has(id)) trails.delete(id);
      for (const z of w.map.zones) drawHerbs(ctx, z, t);
      for (let i = 0; i < tanks.length; i++) {   // you can always find yourself in the herbs
        const s = tanks[i]; if (!s || s.hp <= 0 || !s.hidden || i >= w.humans) continue;
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(s.x, s.y, TANK_R + 3, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      }
      for (const f of fx) drawFx(ctx, f);
      for (let c = 0; c < controls; c++) aimLine(c);
      if (w.freezeT > 0 && game !== "versus") { ctx.fillStyle = `rgba(160,215,245,${0.12 * Math.min(1, w.freezeT)})`; ctx.fillRect(0, 0, AW, AH); }
      ctx.restore();

      // health and lives, small, right by each lunchbox (always upright for whoever is looking)
      for (let i = 0; i < tanks.length; i++) {
        const s = tanks[i]; if (!s || s.hp <= 0) continue;
        const p = scr(s.x, s.y), flipLabel = local && i === 1, hy = flipLabel ? p.y + 22 : p.y - 24;
        ctx.save();
        if (flipLabel) { ctx.translate(p.x, hy); ctx.rotate(Math.PI); ctx.translate(-p.x, -hy); }
        if (game === "versus") {   // three health pips
          for (let k = 0; k < DUEL_HP; k++) { ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.beginPath(); ctx.arc(p.x - 8 + k * 8, hy, 4.1, 0, 7); ctx.fill(); ctx.fillStyle = k < s.hp ? (s.hp === 1 ? RED : GREEN) : "rgba(16,27,46,0.18)"; ctx.beginPath(); ctx.arc(p.x - 8 + k * 8, hy, 3, 0, 7); ctx.fill(); }
        } else if (i < w.humans && game === "missions") {   // lives as little hearts
          for (let k = 0; k < Math.min(lives, 6); k++) { heart(p.x - (Math.min(lives, 6) - 1) * 4.5 + k * 9, hy, 4.5, "rgba(255,255,255,0.92)", 0.5); heart(p.x - (Math.min(lives, 6) - 1) * 4.5 + k * 9, hy, 3.4, RED); }
        } else if (s.kind === "coconut" && s.hp > 1) { ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.beginPath(); ctx.arc(p.x, hy, 3, 0, 7); ctx.fill(); }
        if (labelT > 0 && i < w.humans && (humans > 1 || game === "versus")) { ctx.globalAlpha = Math.min(1, labelT / 600); stamp(ctx, pnames[i], p.x, hy - 7, `800 11px ${FONT}`, i === 0 ? BLUE : game === "versus" ? RED : GREEN, "rgba(255,255,255,0.92)", 3); ctx.globalAlpha = 1; }
        ctx.restore();
      }
      if (w.basket) { const p = scr(w.basket.x, w.basket.y); for (let k = 0; k < w.basket.max; k++) { ctx.fillStyle = "rgba(255,255,255,0.9)"; rr(p.x - w.basket.max * 4 + k * 8 - 1, p.y - 35, 8, 7, 3); ctx.fill(); ctx.fillStyle = k < w.basket.hp ? "#e8963a" : "rgba(16,27,46,0.18)"; rr(p.x - w.basket.max * 4 + k * 8, p.y - 34, 6, 5, 2); ctx.fill(); } }
      for (const f of floats) {
        const p = scr(f.x, f.y), a = 1 - f.age / f.life;
        ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.6));
        stamp(ctx, f.text, p.x, p.y - 30 - f.age * 0.02, `15px ${GAME_FONT}`, f.color, "#ffffff", 3.6, "rgba(14,31,69,0.22)");
      }
      ctx.globalAlpha = 1;

      // middle-of-table messages (twice on Same Phone, one each way)
      let big = "", small = "";
      if (phase === "count") { big = game === "versus" ? String(Math.max(1, Math.ceil(phaseT / 1000))) : "Ready..."; small = game === "versus" ? `Round ${mw[0] + mw[1] + 1}` : game === "guard" ? "Guard The Lunch" : `Mission ${mission}`; }
      else if (phase === "play" && goT > 0) big = "Go!";
      else if (phase === "end") { big = endText; small = endSub; }
      else if (phase === "play" && game === "guard" && !guest && waves.queue.length === 0 && w.tanks.slice(w.humans).every(x => x.hp <= 0) && waves.wave > 0) { big = `Wave ${waves.wave} Cleared`; small = "Next Wave Coming..."; }
      if (big && !none) {
        const spots = local ? [[AH * 0.72, 0], [AH * 0.28, 1]] : [[AH / 2, 0]];
        for (const [yy, flip] of spots) {
          ctx.save(); const cy = arenaY + yy;
          if (flip) { ctx.translate(AW / 2, cy); ctx.rotate(Math.PI); ctx.translate(-AW / 2, -cy); }
          const isNum = /^\d$/.test(big), bh = isNum ? 64 : 44;
          ctx.font = `${isNum ? 44 : 23}px ${GAME_FONT}`; const bwid = isNum ? 84 : Math.min(AW - 30, Math.max(40 + big.length * 11, ctx.measureText(big).width + 44));
          const bx = AW / 2 - bwid / 2, by = cy - bh / 2 - (small ? 8 : 0), bhh = bh + (small ? 18 : 0);   // a panel like the kit's cards: white, a pale blue edge, a soft shadow
          ctx.fillStyle = "rgba(16,27,46,0.18)"; rr(bx - 2, by + 6, bwid + 4, bhh, 20); ctx.fill();
          ctx.fillStyle = "#D3E2F8"; rr(bx - 1.5, by + 1.5, bwid + 3, bhh + 2, 19.5); ctx.fill();
          ctx.fillStyle = "#DDEBFF"; rr(bx - 1.5, by - 1.5, bwid + 3, bhh + 3, 19.5); ctx.fill();
          const pg = ctx.createLinearGradient(0, by, 0, by + bhh); pg.addColorStop(0, "#ffffff"); pg.addColorStop(1, "#eaf1fe");
          ctx.fillStyle = pg; rr(bx, by, bwid, bhh, 18); ctx.fill();
          ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
          ctx.fillStyle = "#d6e4fa"; ctx.fillText(big, AW / 2, cy + (isNum ? 16 : 10) - (small ? 8 : 0) + 2.5);
          ctx.fillStyle = "#0E1F45"; ctx.fillText(big, AW / 2, cy + (isNum ? 16 : 10) - (small ? 8 : 0));
          if (small) text(small, AW / 2, cy + bh / 2 + 4, 12, GREY, 700);
          ctx.restore();
        }
      }
      ctx.restore();
    }
    function heart(x: number, y: number, s: number, col: string, dy = 0) {
      y += dy; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y + s * 0.9);
      ctx.bezierCurveTo(x - s * 1.6, y - s * 0.3, x - s * 0.7, y - s * 1.5, x, y - s * 0.5);
      ctx.bezierCurveTo(x + s * 0.7, y - s * 1.5, x + s * 1.6, y - s * 0.3, x, y + s * 0.9); ctx.fill();
    }

    if (live) { engineRef.current = { onMsg, begin: beginSession, onBack, next, again }; const q = inbox.current.splice(0); q.forEach(onMsg); }
    else engineRef.current = { onMsg: () => {}, begin: beginSession, onBack: () => {}, next, again };
    if (local) beginSession();
    if (solo) beginSession();

    if (dbg) (window as unknown as { __tt: unknown }).__tt = {
      state: () => ({ phase, stage, mission, lives, wins: mw.slice(), me, kind: P.kind, game, matchNo, tick: w.tick, time: Math.round(w.time * 10) / 10, total, net: live ? netRef.current.netMode() : null,
        rtt: live ? Math.round(netRef.current.rtt()) : 0, off: Math.round(Math.hypot(off.x, off.y) * 10) / 10, seq, lastApplied, ov: w.ov, obs: w.map.obs.length, wave: waves.wave, cleared: waves.cleared,
        basket: w.basket?.hp ?? null, card: cardNow?.k ?? null, mines: (guest ? gMines : w.mines).length, peas: guest ? predPeas.length : w.peas.length, freeze: w.freezeT,
        tanks: w.tanks.map((_, i) => { const s = guest ? (i === me && predOn ? pred : interpTank(i)) : w.tanks[i]; return s ? { x: Math.round(s.x), y: Math.round(s.y), ta: Math.round(s.ta * 100) / 100, hp: s.hp, kind: s.kind } : null; }),
        hp: w.tanks.map(t => t.hp), shots: w.shots.slice(), hits: w.hits.slice(), ev: { ...evc } }),
      hold: (c: number, inp: Input | null) => { testIn[c] = inp; },
      auto: (c: number, sharp: number | null) => { testAuto[c] = sharp === null ? null : newBrain(Math.floor(Math.random() * 1e9), sharp); },
      stats: () => (live ? netRef.current.stats() : null),
      cut: (on: boolean) => netRef.current.cut(on),
      zone: (x: number, y: number) => zoneAt(w.map, x, y),
      obsList: () => w.map.obs.map(o => [o.id, o.hp ?? -1]),
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); stop();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp); canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey);
      engineRef.current = null;
    };
  }, [playKey, bestKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── around the board ──
  const n = dailyNumber(LAUNCH);
  const isLive = play.kind === "live", isLocal = play.kind === "local", isSolo = play.kind === "solo";
  const guardBest = card?.k === "guardOver" ? card.best : readBestSafe("peatanks2-guard");
  const game: Game | null = play.kind === "none" ? null : play.game;
  const me = play.kind === "live" ? play.me : 0;
  const pn = play.kind === "local" ? play.names : ["You", "Partner"];
  const friendRaw = play.kind === "live" ? play.names[1 - me] : "Guest";
  const friend = friendRaw === "Guest" ? "Your Friend" : friendRaw, friendLabel = friendRaw;
  const headline = !result ? "" : mode === "daily"
    ? (result.kind === "won" ? `All 5 Missions Cleared! 🎉` : `${result.cleared} Of 5 Missions Cleared`)
    : result.kind === "won" ? "Campaign Complete! 🎉" : `${result.cleared} Mission${result.cleared === 1 ? "" : "s"} Cleared`;
  const share = () => {
    if (!result) return;
    const label = mode === "daily" ? `Pea Tanks #${n} (Today's Challenge)` : "Pea Tanks (Free Play)";
    const p = shell.scores.posted;
    const rank = p?.rank ? `\n🏆 #${p.rank} of ${p.total} ${mode === "daily" ? "today" : "this week"}` : "";
    const how = mode === "daily" ? `${result.cleared}/5 missions` : `${result.cleared} missions`;
    shell.share(`${label}\n${hud.score.toLocaleString()} pts · ${how} · ${result.acc}% aim${result.kind === "won" ? ` · ${result.lives} ❤️ left` : ""}${rank}\n${result.squares}\nCan you beat it? whatyouate.app/games/pea-tanks`);
  };
  const toMenu = () => { if (isLive || rui) net.leave(); setMatchEnd(null); setMenu(null); setLiveOn(false); setCard(null); setLiveGame(null); setPlay({ kind: "none" }); };
  const startSolo = (g: "missions" | "guard", daily: boolean, start = 1) => { setMenu(null); setCard(null); setPlay({ kind: "solo", game: g, daily, start, key: Date.now() }); };
  const startLocal = () => {
    const nm = names.map((v, i) => v.trim().slice(0, 12) || `Player ${i + 1}`);
    setMenu(null); setMatchEnd(null); setCard(null);
    setPlay({ kind: "local", game: menuGame, names: nm, start: menuGame === "missions" ? startAt : 1, key: Date.now() });
  };
  const openRoom = () => {
    hostPick.current = { game: menuGame, start: menuGame === "missions" ? startAt : 1 };
    try { localStorage.setItem(PICK_KEY, JSON.stringify(hostPick.current)); } catch {}
    setMenu(null); net.create();
  };
  const joinRoom = () => { if (code.length === 4) { setMenu(null); net.join(code); } };
  const localRematch = () => { if (play.kind !== "local") return; setMatchEnd(null); setCard(null); setPlay({ ...play, key: Date.now() }); };
  const liveRematch = () => { setAgain(a => ({ ...a, me: true })); net.send({ t: "again" }, true); };
  const imReady = () => { setReady(r => ({ ...r, me: true })); net.send({ t: "ready" }, true); };
  const shareRoom = (c: string) => shell.share(`Play Pea Tanks with me! Room ${c}: ${window.location.origin}/games/pea-tanks?room=${c}`);
  const playing = (isSolo || isLocal) && !over && !card && !matchEnd;
  const paired = rui?.s === "paired";
  const showRoomCard = rui && rui.s !== "paired";
  const awaySecs = net.away ? Math.max(0, Math.ceil((AWAY_MS - (Date.now() - net.away.since)) / 1000)) : 0;
  const liveGameNow = isLive ? (me === 0 ? play.game : liveGame?.game ?? null) : null;
  const pickGame = (g: Game, how: "solo" | "local" | "friend") => {
    setMenuGame(g);
    if (how === "solo") { if (g === "missions") { setStartAt(readReached()); setMenu("missions"); } else startSolo("guard", false); }
    else if (g === "missions") { setStartAt(readReached()); setMenu("missions"); setPendingHow(how); }
    else { setMenu(how === "local" ? "local" : "friend"); }
  };
  const readySteps = liveGameNow === "versus" ? [
    "Left stick drives. Right stick aims your straw: let go to fire.",
    "Peas bounce once, and can come back at you. The dotted line shows the bounce.",
    "The pink button drops a jelly mine. Three hits wins the round; first to 3 rounds.",
  ] : liveGameNow === "guard" ? [
    "Left stick drives. Right stick aims: let go to fire. The pink button drops a mine.",
    "Lunchboxes roll in from the top and go for your picnic basket. Stop them together.",
    "Grab power-ups. The game ends when the basket's been hit too many times.",
  ] : [
    "Left stick drives. Right stick aims: let go to fire. The pink button drops a mine.",
    "Clear every enemy lunchbox to finish a mission. Peas bounce once.",
    "You share 3 lives. If you're knocked out, you're back next mission.",
  ];

  return (
    <GameScreen>
      <GameHeader title="Pea Tanks" mode={mode} onMode={m => { toMenu(); setMode(m); }} onBoard={() => shell.setBoardOpen(true)} onHelp={shell.help.show} />

      <div className={HUD_ROW}>
        {game === "versus" ? (<>
          <HudStat label={isLive ? "You" : pn[0]} value={wins[isLive ? me : 0]} tone="blue" />
          <HudTag light>{isLive ? `Live · Room ${play.kind === "live" ? play.code : ""}` : `Versus · First To ${WINS_TO}`}</HudTag>
          <div className="flex shrink-0 items-center gap-1.5">
            <HudStat label={isLive ? friendLabel : pn[1]} value={wins[isLive ? 1 - me : 1]} align="right" tone="red" />
            <PauseButton shell={shell} active={playing} />
          </div>
        </>) : game ? (<>
          <HudStat label="Score" value={hud.score.toLocaleString()} />
          <HudTag light>{hud.label || (game === "guard" ? "Guard The Lunch" : "Missions")}</HudTag>
          <div className="flex shrink-0 items-center gap-1.5">
            {isSolo ? <HudStat label="Best" value={(game === "guard" ? guardBest : best).toLocaleString()} align="right" />
              : <HudStat label={isLive ? `Room ${play.kind === "live" ? play.code : ""}` : "Co-op"} value={game === "missions" ? <>{hud.lives}<HeartIcon size={15} /></> : "Team"} align="right" />}
            <PauseButton shell={shell} active={playing} />
          </div>
        </>) : (<>
          <HudStat label="Best" value={best.toLocaleString()} />
          <HudTag light>{mode === "daily" ? `Today's Challenge #${n}` : `Missions Reached: ${reached}`}</HudTag>
          <div className="w-[58px] shrink-0" />
        </>)}
      </div>

      <BoardArea wrapRef={wrapRef} size={board} reserve={0}>
        <canvas ref={canvasRef} className="block touch-none" />
        <PrizeLogo shell={shell} active={isSolo && !over && !card && !shell.paused && !menu && !rui} />
        <PausedCard shell={shell} active={playing} />

        {play.kind === "none" && !over && !menu && !rui && !rejoin && (mode === "daily" ? (
          <OverlayCard soft title={<>Today&apos;s Challenge #{n}</>} max="max-w-[300px]">
            <div className="wk-f text-[32px] leading-none text-[#0E1F45] tracking-[-0.03em]">Pea Tanks</div>
            <p className="mt-2 text-sm text-[#5a6b85]">5 missions, 3 lives. The same tables and enemies for everyone today.</p>
            <button onClick={() => startSolo("missions", true)} className={`${UI.go} mt-4 h-[54px] w-full text-[20px]`}>Play Today&apos;s Missions</button>
            <button onClick={() => { setMode("endless"); }} className={`${UI.btn2} mt-3 h-[46px] w-full text-[17px]`}>More Ways To Play</button>
            <p className="mt-2.5 text-xs text-[#5a6b85]">Free Play has the 20-mission campaign, Guard The Lunch, co-op and versus.</p>
          </OverlayCard>
        ) : (
          <OverlayCard soft title="Free Play" max="max-w-[340px]" className="pt-3!">
            {([["missions", "Missions", "20 kitchen tables. New enemies as you go."], ["guard", "Guard The Lunch", "Keep the waves off your picnic basket."], ["versus", "Versus", "One on one. First to 3 rounds."]] as [Game, string, string][]).map(([g, title, blurb], i) => (
              <div key={g} className={`${i ? "mt-2.5" : ""} rounded-2xl bg-[#e6eefc] p-2.5 text-left shadow-[inset_0_-2px_0_#d0ddf3]`}>
                <div className="wk-f text-[18px] leading-tight text-[#0E1F45]">{title}</div>
                <div className="text-xs text-[#5a6b85]">{blurb}</div>
                <div className="mt-2 flex gap-1.5">
                  {g !== "versus" && <button onClick={() => pickGame(g, "solo")} className={`${UI.go} h-[36px] flex-1 rounded-xl text-[14px]`}>Solo</button>}
                  <button onClick={() => pickGame(g, "local")} className={`${UI.btn2} h-[36px] flex-1 rounded-xl text-[14px]`}>Same Phone</button>
                  <button onClick={() => pickGame(g, "friend")} className={`${UI.btn2} h-[36px] flex-1 rounded-xl text-[14px]`}>Play A Friend</button>
                </div>
              </div>
            ))}
          </OverlayCard>
        ))}

        {menu === "missions" && (
          <Card wide>
            <div className="wk-f text-[25px] leading-tight text-[#0E1F45]">Pick A Mission</div>
            <p className="mt-1 text-xs text-[#5a6b85]">{pendingHow === "solo" || menuGame !== "missions" ? "3 lives, and a bonus life every 5 missions." : "Co-op: you share 3 lives."} Clear a mission to unlock the next.</p>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {Array.from({ length: MISSIONS }, (_, i) => i + 1).map(k => (
                <button key={k} disabled={k > reached} onClick={() => setStartAt(k)}
                  className={`wk-f h-[40px] rounded-xl text-[17px] leading-none tabular-nums transition active:translate-y-[2px] ${k === startAt ? "bg-[linear-gradient(180deg,#84B6FF,#5A95F5)] text-white shadow-[0_3px_0_#3F78DB]" : k <= reached ? "bg-white text-[#4F88E8] shadow-[0_0_0_1.5px_#DDEBFF,0_3px_0_#D3E2F8]" : "bg-[#e9edf3] text-[#b6bfcc]"}`}>{k}</button>
              ))}
            </div>
            <button onClick={() => { if (pendingHow === "local") { setMenu("local"); } else if (pendingHow === "friend") { setMenu("friend"); } else startSolo("missions", false, startAt); }}
              className="mt-4 w-full wk-btn wk-go h-[52px] text-[20px]">{pendingHow === "solo" ? `Start Mission ${startAt}` : "Next"}</button>
            <button onClick={() => { setMenu(null); setPendingHow("solo"); }} className="mt-1 w-full py-2 wk-link text-[15px]">Back</button>
          </Card>
        )}

        {menu === "friend" && !rui && (
          <Card>
            <div className="wk-f text-[25px] leading-tight text-[#0E1F45]">Play A Friend</div>
            <p className="mt-1 text-sm text-[#5a6b85]">{menuGame === "versus" ? "Versus, live on two phones." : menuGame === "guard" ? "Guard The Lunch together, live on two phones." : `Co-op missions from mission ${startAt}, live on two phones.`} Make a room and send your friend the link.</p>
            <button onClick={openRoom} className="mt-4 w-full wk-btn wk-blue h-[50px] text-[19px]">Make A Room</button>
            <div className="wk-f mt-4 text-[14px] tracking-[0.03em] text-[#16336C]">Got A Code?</div>
            <div className="mt-1 flex gap-2">
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))} placeholder="ABCD" autoCapitalize="characters" autoComplete="off" spellCheck={false}
                onKeyDown={e => { if (e.key === "Enter") joinRoom(); }}
                className="wk-input wk-f w-0 min-w-0 flex-1 px-3 py-2 text-center text-[22px] tracking-[0.3em]" />
              <button onClick={joinRoom} disabled={code.length !== 4} className="wk-btn wk-light px-5 text-[18px]">Join</button>
            </div>
            <button onClick={() => { setMenu(null); setPendingHow("solo"); }} className="mt-3 w-full py-2 wk-link text-[15px]">Back</button>
          </Card>
        )}

        {menu === "local" && (
          <Card>
            <div className="wk-f text-[25px] leading-tight text-[#0E1F45]">Same Phone</div>
            <p className="mt-1 text-sm text-[#5a6b85]">Lay the phone flat between you. Player 2 plays from the top end. {menuGame === "versus" ? `First to ${WINS_TO} rounds.` : menuGame === "guard" ? "Guard the basket together." : `Co-op from mission ${startAt}.`}</p>
            {[0, 1].map(i => (
              <input key={i} value={names[i]} maxLength={12} placeholder={i === 0 ? "Player 1 (Bottom)" : "Player 2 (Top)"} autoComplete="off"
                onChange={e => setNames(v => v.map((x, j) => (j === i ? e.target.value : x)))}
                className="wk-input mt-3 w-full px-3 py-2.5 text-base" />
            ))}
            <button onClick={startLocal} className="mt-4 w-full wk-btn wk-blue h-[50px] text-[19px]">Start</button>
            <button onClick={() => { setMenu(null); setPendingHow("solo"); }} className="mt-2 w-full py-2 wk-link text-[15px]">Back</button>
          </Card>
        )}

        {showRoomCard && rui && <RoomCard rui={rui} copied={shell.copied} onShare={() => shareRoom(rui.code)} onCancel={toMenu} onBack={() => { net.dismiss(); setMenu("friend"); }} onNew={openRoom} />}

        {rejoin && !rui && !menu && (
          <Card>
            <div className="wk-f text-[25px] leading-tight text-[#0E1F45]">Rejoin Your Game?</div>
            <p className="mt-2 text-sm text-[#5a6b85]">You were playing {rejoin.friendName === "Guest" ? "your friend" : rejoin.friendName} in room {rejoin.code}.</p>
            <button onClick={() => { const r = rejoin; setRejoin(null); if (savedSession(GAME)) net.resume(r); }} className="mt-4 w-full wk-btn wk-blue h-[50px] text-[19px]">Rejoin Your Game</button>
            <button onClick={() => { setRejoin(null); try { localStorage.removeItem(`${GAME}-live`); sessionStorage.removeItem(`${GAME}-live`); } catch {} }} className="mt-2 w-full py-2 wk-link text-[15px]">Not Now</button>
          </Card>
        )}

        {isLive && paired && net.away && (
          <Card>
            <div className="wk-f text-[25px] leading-tight text-[#0E1F45]">{net.away.who === "friend" ? `${friend} Stepped Away...` : "Reconnecting..."}</div>
            <p className="mt-2 text-sm text-[#5a6b85]">{net.away.who === "friend" ? "The game is paused. It carries on as soon as they're back." : "The game is paused while we get you back in."}</p>
            <div className="wk-f mt-3 text-[46px] leading-none tabular-nums text-[#3f7fd6]">{awaySecs}</div>
            <div className="wk-f text-[13px] tracking-[0.03em] text-[#5a6b85]">Seconds Left To Come Back</div>
            <button onClick={toMenu} className="mt-4 w-full wk-btn wk-light h-[48px] text-[18px]">Leave</button>
          </Card>
        )}

        {isLive && paired && !liveOn && !net.away && (liveGameNow ? (
          <ReadyCard title={liveGameNow === "versus" ? "Get Ready: Versus" : liveGameNow === "guard" ? "Get Ready: Guard The Lunch" : "Get Ready: Co-op Missions"}
            me={nameRef.current === "Guest" ? "You" : nameRef.current} friend={friend} ready={[ready.me, ready.them]} onReady={imReady} onLeave={toMenu} steps={readySteps} />
        ) : (
          <Card><div className="wk-f text-[25px] leading-tight text-[#0E1F45]">Joining...</div><p className="mt-2 text-sm text-[#5a6b85]">Finding out what {friend} wants to play.</p></Card>
        ))}

        {card && !over && !(isLive && net.away) && <MissionCard card={card} live={isLive} host={me === 0} friend={friend} again={again}
          onNext={() => engineRef.current?.next()} onAgain={() => { if (isLive) liveRematch(); else if (play.kind === "local") localRematch(); else engineRef.current?.again(); }} onMenu={toMenu} />}

        {matchEnd && !showRoomCard && !(isLive && net.away) && (
          <Card>
            <div className="wk-f text-[15px] tracking-[0.03em] text-[#3F7FD6]">{play.kind === "live" ? `Room ${play.code}` : "Same Phone"}</div>
            <div className="wk-f mt-1 text-[30px] leading-tight text-[#0E1F45]">{isLive ? (matchEnd.winner === me ? "You Won! 🎉" : `${friend} Won`) : `${pn[matchEnd.winner]} Wins! 🎉`}</div>
            <div className="mt-1 text-sm text-[#5a6b85]">{isLive ? `You ${wins[me]} · ${friendLabel} ${wins[1 - me]}` : `${pn[0]} ${wins[0]} · ${pn[1]} ${wins[1]}`}</div>
            {isLive && again.them && !again.me && <div className="wk-f mt-2 text-[16px] text-[#22A964]">{friend} Wants A Rematch!</div>}
            <button onClick={isLive ? liveRematch : localRematch} disabled={isLive && again.me} className="mt-4 w-full wk-btn wk-blue h-[50px] text-[19px] disabled:opacity-70">
              {isLive && again.me ? `Waiting For ${friend}...` : "Rematch"}
            </button>
            <button onClick={toMenu} className="mt-2 w-full wk-btn wk-light h-[48px] text-[18px]">{isLive ? "Leave" : "Done"}</button>
            <a href={appStoreLink(GAME)} className="wk-link mt-3 inline-block text-[14px] underline">Get WhatYouAte For iPhone</a>
          </Card>
        )}

        {over && isSolo && !menu && !rui && <GameOver label={mode === "daily" ? `Today's Challenge #${n}` : "Free Play Missions"} headline={headline} score={hud.score} best={best} mode={mode}
          posted={shell.scores.posted} joined={!!shell.player} campaign={GAME} copied={shell.copied} fact={fact}
          pitch="Quick reflexes are fun. Steady energy is better. WhatYouAte helps with the second one."
          extra={<button onClick={() => { setOver(false); setMenuGame("missions"); setPendingHow("friend"); setPlay({ kind: "none" }); setMode("endless"); setMenu("friend"); }} className="wk-link mt-3 text-[16px] text-[#3F7FD6]">Play A Friend Instead</button>}
          onBoard={() => shell.setBoardOpen(true)} onJoin={() => shell.setJoinOpen(true)} onAgain={() => { setOver(false); setPlay(p => (p.kind === "solo" ? { ...p, key: Date.now() } : p)); }} onShare={share} />}
      </BoardArea>

      <ShellPopups shell={shell} game={GAME} todayNote="Today's Challenge: the same 5 missions for everyone. Resets at midnight." />

      {shell.help.open && (
        <HelpModal onClose={shell.help.close} steps={[
          "Left stick drives your lunchbox. Right stick turns your straw anywhere: let go to fire.",
          "Peas bounce once off the edge and cover, and can hit you on the way back. The dotted line shows the bounce.",
          "The pink button drops a jelly mine. It goes off when anyone drives near, and breaks cereal boxes.",
          "Grab power-ups like the lettuce shield. On a computer: WASD, mouse to aim, click to fire, E for a mine.",
        ]}>
          <ModesHelp today="the same 5 missions for everyone, 3 lives. Missions cleared, speed, aim and lives left all score."
            free="the 20-mission campaign (solo or co-op), Guard The Lunch, and one-on-one Versus on one phone or live." />
        </HelpModal>
      )}
    </GameScreen>
  );
}

function KindPreview({ look }: { look: Look }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) previewLunchbox(ref.current, look); }, [look]);
  return <canvas ref={ref} className="h-12 w-12 shrink-0" />;
}

function MissionCard({ card, live, host, friend, again, onNext, onAgain, onMenu }: {
  card: CardInfo; live: boolean; host: boolean; friend: string; again: { me: boolean; them: boolean }; onNext: () => void; onAgain: () => void; onMenu: () => void;
}) {
  const auto = live;   // live: cards move on by themselves after a few seconds (the host's timer)
  if (card.k === "intro") {
    const counts = new Map<Kind, number>(); for (const k of card.foes) counts.set(k, (counts.get(k) ?? 0) + 1);
    return (
      <Card>
        <div className="wk-f text-[15px] tracking-[0.03em] text-[#3F7FD6]">Mission {card.n}{card.of ? ` Of ${card.of}` : ""} · {card.foes.length} {card.foes.length === 1 ? "Enemy" : "Enemies"}</div>
        <div className="wk-f mt-0.5 text-[25px] leading-tight text-[#0E1F45]">{card.name}</div>
        {card.isNew && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-[#fff4d6] p-2 text-left">
            <KindPreview look={LOOKS[card.isNew as Exclude<Kind, "player">]} />
            <div><div className="wk-f text-[14px] leading-tight text-[#8a5a00]">New Enemy: {KINDS[card.isNew].name}</div><div className="text-sm leading-snug">{KINDS[card.isNew].blurb}</div></div>
          </div>
        )}
        {card.newZone !== null && (
          <div className="mt-2 rounded-2xl bg-[#e3f5e9] p-2 text-left"><div className="wk-f text-[14px] leading-tight text-[#1f7a4c]">New: {ZONES[card.newZone].name}</div><div className="text-sm">{ZONES[card.newZone].blurb}</div></div>
        )}
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {[...counts.entries()].map(([k, c]) => (<span key={k} className="wk-f rounded-full bg-[#e6eefc] px-2.5 py-1 text-[13px] text-[#16336C] shadow-[inset_0_-2px_0_#d0ddf3]">{c > 1 ? `${c} × ` : ""}{KINDS[k].name}</span>))}
        </div>
        <div className="mt-2 text-sm text-[#5a6b85]">{card.lives} {card.lives === 1 ? "Life" : "Lives"} {card.coop ? "(Shared)" : "Left"}</div>
        {auto ? <div className="wk-f mt-3 text-[16px] text-[#3f7fd6]">Starting...</div> : <button onClick={onNext} className="mt-4 w-full wk-btn wk-go h-[52px] text-[20px]">Start Mission</button>}
      </Card>
    );
  }
  if (card.k === "result") return (
    <Card>
      <div className="wk-f text-[15px] tracking-[0.03em] text-[#3F7FD6]">Mission {card.n} Cleared</div>
      <div className="wk-f mt-1 text-[44px] leading-none tabular-nums text-[#0E1F45] tracking-[-0.03em]">+{card.pts.toLocaleString()}</div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div className="wk-hud py-2"><div className="wk-hud-label">Time</div><div className="wk-f mt-1 text-[20px] leading-none tabular-nums">{card.secs}s</div></div>
        <div className="wk-hud py-2"><div className="wk-hud-label">Aim</div><div className="wk-f mt-1 text-[20px] leading-none tabular-nums">{card.acc}%</div></div>
      </div>
      {card.bonus && <div className="wk-f mt-2 flex items-center justify-center gap-1 text-[16px] text-[#22A964]">Bonus Life!<HeartIcon size={16} /></div>}
      <div className="mt-2 text-sm text-[#5a6b85]">Total {card.total.toLocaleString()}</div>
      {auto ? <div className="wk-f mt-3 text-[16px] text-[#3f7fd6]">Next Mission Coming...</div> : <button onClick={onNext} className="mt-4 w-full wk-btn wk-go h-[52px] text-[20px]">{card.last ? "See Results" : "Next Mission"}</button>}
    </Card>
  );
  if (card.k === "retry") return (
    <Card>
      <div className="wk-f text-[25px] leading-tight text-[#0E1F45]">Knocked Out</div>
      <p className="mt-1 text-sm text-[#5a6b85]">Mission {card.n} starts again. {card.lives} {card.lives === 1 ? "life" : "lives"} left.</p>
      {auto ? <div className="wk-f mt-3 text-[16px] text-[#3f7fd6]">Trying Again...</div> : <button onClick={onNext} className="mt-4 w-full wk-btn wk-go h-[52px] text-[20px]">Try Again</button>}
    </Card>
  );
  const isGuard = card.k === "guardOver";
  return (
    <Card>
      <div className="wk-f text-[15px] tracking-[0.03em] text-[#3F7FD6]">{isGuard ? "Guard The Lunch" : "Co-op Missions"}</div>
      <div className="wk-f mt-1 text-[30px] leading-tight text-[#0E1F45]">{isGuard ? `${card.waves} ${card.waves === 1 ? "Wave" : "Waves"} Held` : card.won ? "Campaign Complete! 🎉" : `${card.cleared} ${card.cleared === 1 ? "Mission" : "Missions"} Cleared`}</div>
      <div className="wk-f mt-1 text-[44px] leading-none tabular-nums text-[#0E1F45] tracking-[-0.03em]">{card.score.toLocaleString()}</div>
      {isGuard && <div className="text-sm text-[#5a6b85]">{card.score >= card.best ? "New Best!" : `Best: ${card.best.toLocaleString()}`} · {card.kills} knocked out</div>}
      {live && again.them && !again.me && <div className="wk-f mt-2 text-[16px] text-[#22A964]">{friend} Wants To Go Again!</div>}
      <button onClick={onAgain} disabled={live && again.me} className="mt-4 w-full wk-btn wk-blue h-[50px] text-[19px] disabled:opacity-70">{live && again.me ? `Waiting For ${friend}...` : "Play Again"}</button>
      <button onClick={onMenu} className="mt-2 w-full wk-btn wk-light h-[48px] text-[18px]">{live ? "Leave" : "Done"}</button>
      {!host && null}
    </Card>
  );
}

function RoomCard({ rui, copied, onShare, onCancel, onBack, onNew }: { rui: RoomState; copied: boolean; onShare: () => void; onCancel: () => void; onBack: () => void; onNew: () => void }) {
  return (
    <Card>
      {rui.s === "waiting" && (<>
        <div className="wk-f text-[15px] tracking-[0.03em] text-[#3F7FD6]">Your Room Code</div>
        <div className="wk-f mt-1 text-[46px] leading-none tracking-[0.14em] text-[#0E1F45]">{rui.code}</div>
        <p className="mt-2 text-sm text-[#5a6b85]">Send your friend the link. You&apos;ll both get a quick how-to, then the game starts.</p>
        <button onClick={onShare} className="mt-4 w-full wk-btn wk-blue h-[50px] text-[19px]">{copied ? "Link Copied!" : "Share Link"}</button>
        <p className="wk-f mt-3 text-[16px] text-[#3f7fd6]">Waiting For Your Friend...</p>
        <button onClick={onCancel} className="mt-1 w-full py-2 wk-link text-[15px]">Cancel</button>
      </>)}
      {rui.s === "joining" && (<>
        <div className="wk-f text-[25px] leading-tight text-[#0E1F45]">Joining Room {rui.code}</div>
        <p className="wk-f mt-2 text-[16px] text-[#3f7fd6]">Connecting...</p>
        <button onClick={onCancel} className="mt-3 w-full py-2 wk-link text-[15px]">Cancel</button>
      </>)}
      {(rui.s === "full" || rui.s === "empty" || rui.s === "error") && (<>
        <div className="wk-f text-[25px] leading-tight text-[#0E1F45]">{rui.s === "full" ? "Room Full" : rui.s === "empty" ? "No One's Here" : "Can't Connect"}</div>
        <p className="mt-2 text-sm text-[#5a6b85]">{rui.s === "full" ? `Room ${rui.code} already has two players.` : rui.s === "empty" ? `Nobody is in room ${rui.code} right now. Ask your friend to make a room and send you the link.` : "We couldn't reach the game. Check your connection and try again."}</p>
        <button onClick={onBack} className="mt-4 w-full wk-btn wk-blue h-[50px] text-[19px]">Back</button>
        <button onClick={onCancel} className="mt-2 w-full py-2 wk-link text-[15px]">Back To Menu</button>
      </>)}
      {rui.s === "lost" && (<>
        <div className="wk-f text-[25px] leading-tight text-[#0E1F45]">Connection Lost</div>
        <p className="mt-2 text-sm text-[#5a6b85]">We couldn&apos;t get you back into room {rui.code} in time.</p>
        <button onClick={onNew} className="mt-4 w-full wk-btn wk-blue h-[50px] text-[19px]">Make A New Room</button>
        <button onClick={onCancel} className="mt-2 w-full wk-btn wk-light h-[48px] text-[18px]">Back To Menu</button>
      </>)}
      {rui.s === "left" && (<>
        <div className="wk-f text-[25px] leading-tight text-[#0E1F45]">Your Friend Left</div>
        <p className="mt-2 text-sm text-[#5a6b85]">That game is over.</p>
        <button onClick={onNew} className="mt-4 w-full wk-btn wk-blue h-[50px] text-[19px]">Make A New Room</button>
        <button onClick={onCancel} className="mt-2 w-full wk-btn wk-light h-[48px] text-[18px]">Back To Menu</button>
      </>)}
    </Card>
  );
}

function Card({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <OverlayCard max={wide ? "max-w-[340px]" : "max-w-[300px]"}>{children}</OverlayCard>;
}
