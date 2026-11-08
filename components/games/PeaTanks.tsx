"use client";

// Pea Tanks: two lunchboxes drive around a kitchen table and fire peas at each other. Fruit bowls and cereal boxes
// are cover; a water drop gives a few seconds of speed, a strawberry a few seconds of rapid fire. Five hits knocks a
// lunchbox out and wins the round.
// Controls: a joystick bottom left (the lunchbox turns to face where you push, then rolls; a small push just turns it
// on the spot to aim) and a fire button bottom right, both under the table so thumbs never cover it. Keyboard: WASD or
// arrows and space.
// "Today" is best of 3 rounds against the computer, with the same tables and computer for everyone; score rewards
// winning, health left, accuracy and speed. Free Play keeps going round after round with a sharper computer.
// "Same Phone": the phone lies flat between two players, the table in the middle, player 2's controls at the top
// (upside down for them), first to 3 rounds. "Play A Friend": live on two phones, first to 3 rounds. The host phone
// runs the match (60 steps a second) and sends the state 20 times a second; the guest sends its stick and button,
// shows its own lunchbox straight away (prediction, gently corrected) and the host's slightly in the past
// (interpolation). Hits are decided by the host, which looks back at where its own lunchbox was on the guest's screen
// when a guest pea arrives, so a fair shot counts. Transport (WebRTC, with a Supabase fallback) lives in ./tankNet;
// rules, tables and the computer in ./tankSim. No facts mid-game; one fact on the game-over card.
// Everything around the board comes from ./kit.
/* eslint-disable react-hooks/set-state-in-effect --
   A real-time canvas game: the match lives in the effect's closure and the room hook's refs, and React state only
   mirrors it for the cards around the board (same approach as the other canvas games). */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { appStoreLink } from "@/components/site";
import { type Mode, type Toast, GameScreen, GameHeader, BoardArea, PrizeLogo, GameOver, PauseButton, PausedCard, HelpModal, ModesHelp, ShellPopups,
  useGameShell, fitCanvas, loadImages, dailySeed, dailyNumber, torontoDate, readBest, saveBest, foodPng } from "./kit";
import { AW, AH, TANK_R, PEA_R, HP, ROUND_T, TODAY_ROUNDS, DAY_BONUS, BOOST_T, type TableMap, type Tank, type Pea, type Pick, type Input, type World, type Brain,
  makeMap, newWorld, newTank, newBrain, aiInput, stepWorld, stepOneTank, stepTank, stepPea, peaFrom, roundWinner, roundPoints, sharpFor, wrapAngle, NO_INPUT } from "./tankSim";
import { useTankRoom, savedSession, AWAY_MS, type RoomState, type Saved } from "./tankNet";

const GAME = "pea-tanks";
const LAUNCH = "2026-11-08";   // Today's Challenge #1
const SALT = 0x7a4c5;          // keeps Today's tables apart from the other games' daily seeds
const WINS_TO = 3;             // Same Phone and live matches: first to 3 rounds
const STEP_MS = 1000 / 60, COUNT_MS = 3000, KO_MS = 1500, GO_MS = 700, LABEL_MS = 3500;
const CH = 132, CHL = 112;     // the control strip under the table (one strip, or one each end on Same Phone)
const FONT = "system-ui, -apple-system, sans-serif";
const BLUE = "#3f7fd6", RED = "#e8505b", INK = "#101b2e", GREY = "#5a6b85";
// art: fruit for the bowls, a cereal bowl on the cereal boxes, the two boosts
const IMG = ["1f34e", "1f34a", "1f34c", "1f347", "1f350", "1f34b", "1f963", "1f4a7", "1f353"];
const BOWL_FRUIT = [[0, 1, 2], [3, 4, 0], [1, 5, 2]], BOX_COL = [["#f2994a", "#d97a2b"], ["#e8505b", "#c73d48"], ["#8e6bd6", "#7353b8"]];
const FACTS: Toast[] = [
  { title: "About Peas", body: "A cup of cooked green peas has about 8 grams of protein and about 8 grams of fibre.", img: "1fadb" },
  { title: "About Strawberries", body: "A cup of strawberries has more vitamin C than a medium orange.", img: "1f353" },
  { title: "About Water", body: "Water makes up about 50 to 60% of an adult's body weight.", img: "1f4a7" },
];

type Play = { kind: "cpu" } | { kind: "local"; m: number; names: string[] } | { kind: "live"; code: string; me: 0 | 1; names: string[] };
type Phase = "idle" | "count" | "play" | "ko" | "between" | "over" | "lobby";
type Result = { kind: "won" | "lost"; won: number; lost: number; round: number; squares: string; acc: number };
type Hud = { score: number; round: number; won: number; lost: number };
type RoundCard = { round: number; won: boolean; tie: boolean; points: number; hp: number; acc: number; secs: number };
type Stick = { id: number; bx: number; by: number; kx: number; ky: number };
type Ctl = { stick: Stick | null; fireId: number; fireHeld: boolean; fc: number; keys: Record<string, boolean>; keyFire: boolean };
type Snap = { k: number; at: number; ph: number; cl: number; a: number; T: number[][]; P: number[][]; K: number[][]; tm: number };
type Float = { text: string; x: number; y: number; color: string; age: number; life: number; tank: number };
type Splat = { x: number; y: number; age: number; color: string };
type NetMsg = { t: string; [k: string]: unknown };
type Engine = { onMsg: (m: NetMsg) => void; startMatch: () => void; onBack: () => void };

const newCtl = (): Ctl => ({ stick: null, fireId: -1, fireHeld: false, fc: 0, keys: {}, keyFire: false });
const q1 = (v: number) => Math.round(v * 10), q3 = (v: number) => Math.round(v * 1000);
function packTank(t: Tank) { return [q1(t.x), q1(t.y), q3(t.a), t.hp, Math.round(t.cd * 100), q1(t.speedT), q1(t.rapidT), t.fc]; }
function unpackTank(a: number[]): Tank { return { x: a[0] / 10, y: a[1] / 10, a: a[2] / 1000, hp: a[3], cd: a[4] / 100, speedT: a[5] / 10, rapidT: a[6] / 10, fc: a[7], vx: 0, vy: 0 }; }
const isDebug = () => { try { return new URLSearchParams(window.location.search).get("debug") === "1"; } catch { return false; } };

export default function PeaTanks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("daily");
  const [run, setRun] = useState(0);
  const [play, setPlay] = useState<Play>({ kind: "cpu" });
  const [started, setStarted] = useState(false);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [roundCard, setRoundCard] = useState<RoundCard | null>(null);
  const [matchEnd, setMatchEnd] = useState<{ winner: number } | null>(null);
  const [wins, setWins] = useState([0, 0]);
  const [hud, setHud] = useState<Hud>({ score: 0, round: 1, won: 0, lost: 0 });
  const [best, setBest] = useState(0);
  const [fact, setFact] = useState<Toast | null>(null);
  const [board, setBoard] = useState({ w: 0, h: 0 });
  const [menu, setMenu] = useState<null | "friend" | "local">(null);
  const [code, setCode] = useState("");
  const [names, setNames] = useState(["", ""]);
  const [ready, setReady] = useState({ me: false, them: false });
  const [again, setAgain] = useState({ me: false, them: false });
  const [liveOn, setLiveOn] = useState(false);   // a live match has started (the Get Ready card is done)
  const [rejoin, setRejoin] = useState<Saved | null>(null);   // a live game this browser can get back into
  const [, setNow] = useState(0);                              // ticks the "Stepped Away" countdown
  const shell = useGameShell(GAME, mode);
  const { reset: resetScores } = shell.scores;
  const pausedRef = useRef(false); pausedRef.current = shell.paused;
  const playRef = useRef(play); playRef.current = play;
  const startRef = useRef<() => void>(() => {});
  const nextRef = useRef<() => void>(() => {});
  const engineRef = useRef<Engine | null>(null);
  const inbox = useRef<NetMsg[]>([]);
  const nameRef = useRef("Guest"); nameRef.current = shell.player?.name || "Guest";
  const onGame = useRef<(m: NetMsg) => void>(() => {});
  const net = useTankRoom(GAME, nameRef, onGame);
  const netRef = useRef(net); netRef.current = net;
  const rui = net.room;
  const flags = useRef({ ready, again, liveOn, matchEnd }); flags.current = { ready, again, liveOn, matchEnd };
  onGame.current = (m: NetMsg) => {
    if (m.t === "ready") setReady(r => ({ ...r, them: true }));
    else if (m.t === "again") setAgain(a => ({ ...a, them: true }));
    else if (m.t === "_back") {   // both phones are here again: say where we were, and the host resyncs the match
      const f = flags.current;
      if (f.ready.me && !f.liveOn) netRef.current.send({ t: "ready" }, true);
      if (f.again.me && f.matchEnd) netRef.current.send({ t: "again" }, true);
      engineRef.current?.onBack();
    }
    else if (engineRef.current) engineRef.current.onMsg(m);
    else inbox.current.push(m);
  };
  const bestKey = mode === "daily" ? `peatanks-daily-${torontoDate()}` : "peatanks-endless";
  useEffect(() => { setBest(readBest(bestKey)); }, [bestKey]);

  // a shared link (?room=ABCD) joins that room straight away (or rejoins it, after a reload); a game saved by this
  // browser in the last minute offers "Rejoin Your Game". Closing the page only steps away: the friend waits 60 seconds.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? "", saved = savedSession(GAME);
    if (/^[A-Z]{4}$/.test(c)) { if (saved && saved.code === c) netRef.current.resume(saved); else netRef.current.join(c); }
    else if (saved) setRejoin(saved);
    const away = () => netRef.current.suspend();
    const back = (e: PageTransitionEvent) => { const sv = savedSession(GAME); if (e.persisted && sv) netRef.current.resume(sv); };   // back from the back-forward cache
    window.addEventListener("pagehide", away); window.addEventListener("pageshow", back);
    return () => { window.removeEventListener("pagehide", away); window.removeEventListener("pageshow", back); away(); };
  }, []);
  useEffect(() => { if (!net.away) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [net.away]);

  // the room pairs up: a live match, starting with the Get Ready card; the room ends: back to the computer
  const roomS = rui?.s, roomCode = rui?.code, roomRole = rui?.role, roomFriend = rui?.friend;
  useEffect(() => {
    if (roomS === "paired" && roomCode && roomRole) {
      const me = roomRole === "host" ? 0 : 1, nm = [nameRef.current, roomFriend || "Guest"];
      setReady({ me: false, them: false }); setAgain({ me: false, them: false }); setLiveOn(false); setMatchEnd(null); setWins([0, 0]); setMenu(null);
      setPlay({ kind: "live", code: roomCode, me: me as 0 | 1, names: me === 0 ? nm : [nm[1], nm[0]] });
    } else if (roomS === "left" || roomS === "lost") { setMatchEnd(null); setLiveOn(false); setPlay({ kind: "cpu" }); }
  }, [roomS, roomCode, roomRole, roomFriend]);

  // the host starts a match when both have tapped I'm Ready (or both asked for a rematch) and the pipe is up
  const isHost = play.kind === "live" && play.me === 0;
  useEffect(() => {
    if (!isHost || net.mode === "connecting") return;
    if ((!liveOn && ready.me && ready.them) || (matchEnd && again.me && again.them)) engineRef.current?.startMatch();
  }, [isHost, net.mode, liveOn, ready, again, matchEnd]);

  const playKey = play.kind === "cpu" ? "cpu" : play.kind === "live" ? `live-${play.code}-${play.me}` : `local-${play.m}`;
  useEffect(() => {
    const P = playRef.current, cpu = P.kind === "cpu", live = P.kind === "live", local = P.kind === "local";
    const me = P.kind === "live" ? P.me : 0, host = live && me === 0, guest = live && me === 1, rot = guest;
    const TW = AW, TH = local ? AH + 2 * CHL : AH + CH, arenaY = local ? CHL : 0;
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const { ctx, stop } = fitCanvas(canvas, wrap, TW, TH, setBoard, 0);
    const imgs = loadImages(IMG);
    const daily = mode === "daily", dbg = isDebug();
    const pnames = cpu ? ["You", "Computer"] : P.kind === "live" ? P.names.map((v, i) => (i === me ? "You" : v)) : P.names;   // labels ("Guest")
    const said = (i: number) => (pnames[i] === "Guest" ? "Your Friend" : pnames[i]);                                             // in sentences
    const tankCol = (i: number) => (live ? (i === me ? BLUE : RED) : i === 0 ? BLUE : RED);
    const daySeed = dailySeed(SALT), freeSeed = Math.floor(Math.random() * 1e9);

    // ── match state ──
    let phase: Phase = cpu ? "idle" : live ? "lobby" : "count", phaseT = COUNT_MS, round = 1, matchNo = 0, goT = 0, labelT = LABEL_MS;
    let map: TableMap = makeMap(cpu ? (daily ? (daySeed ^ Math.imul(1, 0x9e3779b1)) | 0 : freeSeed) : Math.floor(Math.random() * 1e9));
    let w: World = newWorld(map, 1), brain: Brain = newBrain(1, 0.3), koText = "";
    const mw = [0, 0]; let matchWinner = -1;
    // cpu scoring
    let total = 0, won = 0, lost = 0, drops = 0, allShots = 0, allHits = 0, realStart = performance.now();
    const squares: string[] = [], grabs = [0, 0];
    let startedNow = !cpu;
    // effects
    const floats: Float[] = [], splats: Splat[] = [], flash = [0, 0], seenEv = new Set<number>();
    let tableCache: HTMLCanvasElement | null = null, cacheKey = "";
    // live: host side
    const inBuf = new Map<number, Input>(); let lastApplied = 0, maxSeen = 0, flowing = false, lastGuestIn: Input = NO_INPUT, starve = 0;
    const hostHist: { x: number; y: number }[] = []; const recentEv: { tick: number; e: number[] }[] = [];
    // live: guest side
    const snaps: Snap[] = []; let clockOff: number | null = null, seq = 0, pred: Tank = newTank(me), predOn = false;
    const hist = new Map<number, Input>(); const off = { x: 0, y: 0, a: 0 }; let predPeas: Pea[] = []; const predSet = new Set<number>();
    let gPicks: Pick[] = [], sendT = 0, lastSnap: Snap | null = null, gMap: TableMap | null = null;
    const visGuest = { x: 0, y: 0, a: 0, ok: false };
    const ctl: Ctl[] = [newCtl(), newCtl()];

    const sendNet = (m: object, reliable: boolean) => { if (live) netRef.current.send(m, reliable); };
    const pushHud = () => setHud({ score: total, round, won, lost });
    setOver(false); setResult(null); setRoundCard(null); setFact(null); setStarted(!cpu); resetScores(); pushHud();
    if (!live) setWins([0, 0]);

    // ── rounds ──
    function beginRound(r: number) {
      round = r;
      let seed: number;
      if (cpu) seed = ((daily ? daySeed : freeSeed) ^ Math.imul(r, 0x9e3779b1)) | 0;
      else seed = Math.floor(Math.random() * 1e9);
      map = makeMap(seed); w = newWorld(map, seed);
      if (cpu) brain = newBrain(seed ^ 0x5eed1, sharpFor(daily, r));
      phase = "count"; phaseT = COUNT_MS; labelT = LABEL_MS; goT = 0;
      floats.length = 0; splats.length = 0; seenEv.clear(); recentEv.length = 0; hostHist.length = 0; visGuest.ok = false;
      ctl.forEach(c => { c.fc = 0; });
      if (host) {
        inBuf.clear(); flowing = false; lastGuestIn = NO_INPUT; lastApplied = maxSeen = 0;
        sendNet({ t: "round", m: matchNo, r, map, wins: mw.slice() }, true);
      }
      pushHud();
    }
    function endRound(win: number) {
      phase = "ko"; phaseT = KO_MS;
      const tie = win === 2;
      if (cpu) {
        const youWon = win === 0, secs = w.time;   // a tie on time goes to the computer (no points for hiding all round)
        const pts = roundPoints(youWon, w.dealt[0], w.tanks[0].hp, w.shots[0], w.hits[0], secs);
        total += pts; squares.push(youWon ? "🟩" : "🟥"); if (youWon) won++; else lost++;
        drops += w.shots[0]; allShots += w.shots[0]; allHits += w.hits[0]; grabs[0] += w.grabs[0][0]; grabs[1] += w.grabs[0][1];
        koText = w.time >= ROUND_T ? "Time's Up!" : youWon ? "Knocked Out!" : "You're Out!";
        const card: RoundCard = { round, won: youWon, tie, points: pts, hp: w.tanks[0].hp, acc: w.shots[0] ? Math.round((100 * w.hits[0]) / w.shots[0]) : 0, secs: Math.round(secs) };
        pendingCard = card; pushHud();
      } else {
        if (!tie) mw[win]++;
        koText = tie ? "Tie Round" : live ? (win === me ? "You Win The Round!" : `${said(win)} Wins The Round`) : `${pnames[win]} Wins The Round!`;
        setWins(mw.slice());
        if (host) sendNet({ t: "rend", m: matchNo, r: round, win, wins: mw.slice() }, true);
      }
    }
    let pendingCard: RoundCard | null = null;
    function afterKo() {
      if (cpu) {
        const card = pendingCard!; pendingCard = null;
        if (daily ? won >= 2 : false) { total += DAY_BONUS; finish("won"); }
        else if (daily ? lost >= 2 : !card.won) finish("lost");
        else { phase = "between"; setRoundCard(card); }
        return;
      }
      if (mw[0] >= WINS_TO || mw[1] >= WINS_TO) {
        phase = "over"; const winner = mw[0] >= WINS_TO ? 0 : 1; matchWinner = winner;
        if (host) sendNet({ t: "mend", m: matchNo, wins: mw.slice(), win: winner }, true);
        setMatchEnd({ winner });
        return;
      }
      if (guest) { phase = "ko"; phaseT = 1e9; return; }   // wait for the host's next round
      beginRound(round + 1);
    }
    nextRef.current = () => { if (phase !== "between") return; setRoundCard(null); beginRound(round + 1); };
    function finish(kind: Result["kind"]) {
      phase = "over";
      const f = grabs[1] > grabs[0] ? FACTS[1] : grabs[0] > 0 ? FACTS[2] : FACTS[0];   // the boost you grabbed most, or the peas
      setFact(f);
      setResult({ kind, won, lost, round, squares: squares.join(""), acc: allShots ? Math.round((100 * allHits) / allShots) : 0 });
      pushHud(); setOver(true);
      if (total > readBest(bestKey)) { saveBest(bestKey, total); setBest(total); }
      shell.finishRef.current({ score: total, drops, ms: performance.now() - realStart });
    }
    startRef.current = () => { if (startedNow) return; startedNow = true; realStart = performance.now(); setStarted(true); beginRound(1); };
    if (local) { matchNo = 1; beginRound(1); }

    // ── live: messages ──
    function startMatch() {
      if (!host) return;
      matchNo++; mw[0] = mw[1] = 0; setWins([0, 0]); setMatchEnd(null); setAgain({ me: false, them: false }); setLiveOn(true);
      beginRound(1);
    }
    function onMsg(m: NetMsg) {
      if (host) {
        if (m.t === "have") { if (matchNo === 0) fromHave(m); else sendSync(); return; }
        if (m.t === "i" && m.r === round && phase === "play") {
          const runs = m.n as number[][], top = m.s as number;
          const low = top - runs.reduce((a, r) => a + r[0], 0) + 1;
          if (lastApplied === 0) lastApplied = low - 1;                                            // the guest's first inputs this round
          if (top - lastApplied > 90) { lastApplied = low - 1; inBuf.clear(); flowing = false; }   // fell far behind (a stall): skip ahead
          let sq = top;
          for (const [cnt, ax, ay, fire, fc] of runs) for (let j = 0; j < cnt; j++, sq--) if (sq > lastApplied && !inBuf.has(sq)) inBuf.set(sq, { ax: ax / 100, ay: ay / 100, fire: !!fire, fc, s: sq });
          if (top > maxSeen) maxSeen = top;
        }
        return;
      }
      // guest
      if (m.t === "sync") { onSync(m); return; }
      if (m.t === "need") { have(); return; }
      if (m.t === "round") {
        const mm = m.m as number;
        if (mm < matchNo || (mm === matchNo && (m.r as number) <= round && phase !== "lobby" && phase !== "over")) return;
        if (mm !== matchNo) { setMatchEnd(null); setAgain({ me: false, them: false }); }
        matchNo = mm; round = m.r as number; gMap = m.map as TableMap; map = gMap;
        const wv = m.wins as number[]; mw[0] = wv[0]; mw[1] = wv[1]; setWins(mw.slice()); setLiveOn(true);
        phase = "count"; phaseT = COUNT_MS; labelT = LABEL_MS; goT = 0; snaps.length = 0; lastSnap = null; predOn = false;
        pred = newTank(me); off.x = off.y = off.a = 0; predPeas = []; predSet.clear(); hist.clear(); gPicks = [];
        floats.length = 0; splats.length = 0; seenEv.clear(); tableCache = null;
        w = newWorld(map, 1);
      } else if (m.t === "rend" && m.m === matchNo && m.r === round) {
        const wv = m.wins as number[]; mw[0] = wv[0]; mw[1] = wv[1];
        const win = m.win as number;
        phase = "ko"; phaseT = KO_MS;
        koText = win === 2 ? "Tie Round" : win === me ? "You Win The Round!" : `${said(win)} Wins The Round`;
        setWins(mw.slice()); predOn = false;
      } else if (m.t === "mend" && m.m === matchNo) {
        const wv = m.wins as number[]; mw[0] = wv[0]; mw[1] = wv[1]; setWins(mw.slice());
        phase = "over"; setMatchEnd({ winner: m.win as number });
      } else if (m.t === "s" && m.m === matchNo && m.r === round) onSnap(m);
    }
    // ── live: stepping away and coming back ──
    const phCode = () => (phase === "count" ? 0 : phase === "play" ? 1 : phase === "ko" ? 2 : phase === "over" ? 3 : 4);
    function sendSync() {
      lastApplied = maxSeen = 0; inBuf.clear(); flowing = false;   // line up with the guest's inputs again
      sendNet({ t: "sync", m: matchNo, r: round, map, wins: mw.slice(), ph: phCode(), cl: Math.max(0, Math.round(phaseT)), win: matchWinner, k: w.tick,
        tm: Math.max(0, ROUND_T - w.time), T: w.tanks.map(packTank), P: [], K: w.picks.map(k => [k.id, k.k, k.x, k.y, q1(k.life)]) }, true);
    }
    function onBack() {
      if (!host) return;
      if (matchNo > 0) sendSync();
      else sendNet({ t: "need" }, true);   // a fresh page (reloaded): ask the guest where the match was
    }
    /** host, after a reload: rebuild the match from the guest's last picture of it */
    function fromHave(m: NetMsg) {
      if ((m.m as number) <= 0) return;
      matchNo = m.m as number; round = m.r as number; map = m.map as TableMap; w = newWorld(map, Math.floor(Math.random() * 1e9));
      const wv = m.wins as number[]; mw[0] = wv[0]; mw[1] = wv[1]; setWins(mw.slice()); setLiveOn(true); tableCache = null;
      const T = m.T as number[][] | null;
      if (T) for (let i = 0; i < 2; i++) { const t = unpackTank(T[i]); Object.assign(w.tanks[i], t); }
      w.picks = ((m.K as number[][]) ?? []).map(k => ({ id: w.nextId++, k: k[1], x: k[2], y: k[3], life: k[4] / 10 }));
      w.time = ROUND_T - ((m.tm as number) ?? ROUND_T);
      const ph = m.ph as number;
      if (ph === 0) { phase = "count"; phaseT = (m.cl as number) || COUNT_MS; }
      else if (ph === 1) phase = "play";
      else if (ph === 3 || mw[0] >= WINS_TO || mw[1] >= WINS_TO) { phase = "over"; matchWinner = mw[0] >= WINS_TO ? 0 : 1; setMatchEnd({ winner: matchWinner }); }
      else { beginRound(round + 1); return; }
      pushHud(); sendSync();
    }
    /** guest: the host's full picture after someone stepped away */
    function onSync(m: NetMsg) {
      matchNo = m.m as number; round = m.r as number; map = m.map as TableMap; gMap = map;
      const wv = m.wins as number[]; mw[0] = wv[0]; mw[1] = wv[1]; setWins(mw.slice());
      snaps.length = 0; lastSnap = null; clockOff = null; hist.clear(); predPeas = []; predSet.clear(); off.x = off.y = off.a = 0;
      floats.length = 0; splats.length = 0; tableCache = null; predOn = false;
      w = newWorld(map, 1);
      const T = m.T as number[][];
      for (let i = 0; i < 2; i++) Object.assign(w.tanks[i], unpackTank(T[i]));
      pred = unpackTank(T[me]); w.time = ROUND_T - (m.tm as number);
      gPicks = (m.K as number[][]).map(k => ({ id: k[0], k: k[1], x: k[2], y: k[3], life: k[4] / 10 }));
      const ph = m.ph as number;
      if (ph === 4) { phase = "lobby"; return; }
      setLiveOn(true);
      if (ph === 0) { phase = "count"; phaseT = m.cl as number; }
      else if (ph === 1) { phase = "play"; predOn = true; }
      else if (ph === 2) { phase = "ko"; phaseT = 1e9; }
      else { phase = "over"; setMatchEnd({ winner: m.win as number }); }
    }
    function have() {   // guest: answer the host's "need"
      const lp = lastSnap;
      sendNet({ t: "have", m: matchNo, r: round, map, wins: mw.slice(), ph: phCode(), cl: Math.max(0, Math.round(phaseT)),
        T: lp ? lp.T : predOn ? [packTank(w.tanks[0]), packTank(pred)] : null, K: lp ? lp.K : [], tm: lp ? lp.tm : ROUND_T }, true);
    }
    if (live) {
      engineRef.current = { onMsg, startMatch, onBack };
      const q = inbox.current.splice(0); q.forEach(onMsg);
    } else engineRef.current = null;

    // guest: a snapshot from the host
    function onSnap(m: NetMsg) {
      const now = performance.now();
      const s: Snap = { k: m.k as number, at: now, ph: m.ph as number, cl: m.cl as number, a: m.a as number, T: m.T as number[][], P: m.P as number[][], K: m.K as number[][], tm: m.tm as number };
      if (lastSnap && s.k <= lastSnap.k) return;   // late and out of order
      const sample = s.k - now / STEP_MS;
      clockOff = clockOff === null || Math.abs(sample - clockOff) > 40 ? sample : clockOff + (sample - clockOff) * 0.08;
      snaps.push(s); while (snaps.length > 40) snaps.shift();
      lastSnap = s;
      // the host's phase: countdown and play
      if (s.ph === 0 && phase === "count") phaseT = Math.min(phaseT, s.cl);
      if (s.ph === 1 && phase === "count") { phase = "play"; goT = GO_MS; }
      if (s.ph === 1 && phase === "play") predOn = true;
      w.time = ROUND_T - s.tm;
      gPicks = s.K.map(k => ({ id: k[0], k: k[1], x: k[2], y: k[3], life: k[4] / 10 }));
      for (let i = 0; i < 2; i++) { const t = unpackTank(s.T[i]); w.tanks[i].hp = t.hp; w.tanks[i].speedT = t.speedT; w.tanks[i].rapidT = t.rapidT; }
      // events (each one comes in several snapshots; show it once)
      for (const e of (m.E as number[][]) ?? []) {
        if (seenEv.has(e[0])) continue; seenEv.add(e[0]);
        showEvent(e[1], e[2], e[3], e[4], e[5]);
      }
      // reconcile my lunchbox: start from the host's copy and replay the inputs it hasn't seen yet
      if (predOn) {
        const server = unpackTank(s.T[me]), other = unpackTank(s.T[1 - me]);
        for (const k of [...hist.keys()]) if (k <= s.a) hist.delete(k);
        const st = { ...server };
        for (let k = s.a + 1; k <= seq; k++) { const inp = hist.get(k); if (inp) stepTank(st, inp, map, other, 0); }
        const ex = pred.x + off.x - st.x, ey = pred.y + off.y - st.y;
        if (ex * ex + ey * ey > 60 * 60) { off.x = off.y = off.a = 0; }
        else { off.x = ex; off.y = ey; off.a = wrapAngle(pred.a + off.a - st.a); }
        st.fc = pred.fc; pred = st;
      }
    }
    function showEvent(k: number, x: number, y: number, v: number, n: number) {
      if (k === 0) {   // hit: v = victim
        flash[v] = 220;
        floats.push({ text: `-${n}`, x, y, color: RED, age: 0, life: 900, tank: v });
        const sh = 1 - v; if (guest && sh === me) { const pp = predPeas.findIndex(p => Math.hypot(p.x - x, p.y - y) < 40); if (pp >= 0) predPeas.splice(pp, 1); }
      } else if (k === 1) floats.push({ text: n === 0 ? "Speed Up!" : "Rapid Fire!", x, y, color: n === 0 ? BLUE : "#2eaa6e", age: 0, life: 1200, tank: v });
      else if (k === 2) splats.push({ x, y, age: 0, color: "#6cbf3c" });
    }

    // ── input ──
    const toLocal = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * TW, y: ((e.clientY - r.top) / r.height) * TH }; };
    const humans = cpu || live ? 1 : 2;
    function zones(c: number) {   // the strip for control set c: its box, where the stick rests, where the fire button is
      if (!local) return { y0: AH, y1: AH + CH, stickLeft: true, sx: 74, sy: AH + CH / 2 + 2, fx: AW - 74, fy: AH + CH / 2 + 2, r: 42, flip: false };
      if (c === 0) return { y0: CHL + AH, y1: TH, stickLeft: true, sx: 70, sy: CHL + AH + CHL / 2 + 2, fx: AW - 70, fy: CHL + AH + CHL / 2 + 2, r: 38, flip: false };
      return { y0: 0, y1: CHL, stickLeft: false, sx: AW - 70, sy: CHL / 2 - 2, fx: 70, fy: CHL / 2 - 2, r: 38, flip: true };
    }
    const onDown = (e: PointerEvent) => {
      const p = toLocal(e);
      for (let c = 0; c < humans; c++) {
        const z = zones(c);
        if (p.y < z.y0 - 4 || p.y > z.y1 + 4) continue;
        const left = p.x < AW / 2, isStick = z.stickLeft ? left : !left, cl = ctl[c];
        try { canvas.setPointerCapture(e.pointerId); } catch {}
        if (isStick) {
          if (cl.stick) return;
          const m = z.r * 0.75;
          cl.stick = { id: e.pointerId, bx: Math.max(m, Math.min(AW - m, p.x)), by: Math.max(z.y0 + m, Math.min(z.y1 - m, p.y)), kx: 0, ky: 0 };
          onMove(e);
        } else { if (cl.fireId >= 0) return; cl.fireId = e.pointerId; cl.fireHeld = true; cl.fc++; }
        e.preventDefault();
        return;
      }
    };
    const onMove = (e: PointerEvent) => {
      for (let c = 0; c < humans; c++) {
        const st = ctl[c].stick; if (!st || st.id !== e.pointerId) continue;
        const p = toLocal(e), r = zones(c).r, dx = p.x - st.bx, dy = p.y - st.by, d = Math.hypot(dx, dy);
        st.kx = d > r ? (dx / d) * r : dx; st.ky = d > r ? (dy / d) * r : dy;
      }
    };
    const onUp = (e: PointerEvent) => {
      for (let c = 0; c < humans; c++) {
        const cl = ctl[c];
        if (cl.stick?.id === e.pointerId) cl.stick = null;
        if (cl.fireId === e.pointerId) { cl.fireId = -1; cl.fireHeld = false; }
      }
    };
    const KEYMAP: Record<string, [number, string]> = local
      ? { KeyW: [0, "u"], KeyS: [0, "d"], KeyA: [0, "l"], KeyD: [0, "r"], Space: [0, "f"], ArrowUp: [1, "u"], ArrowDown: [1, "d"], ArrowLeft: [1, "l"], ArrowRight: [1, "r"], Enter: [1, "f"], NumpadEnter: [1, "f"] }
      : { KeyW: [0, "u"], KeyS: [0, "d"], KeyA: [0, "l"], KeyD: [0, "r"], ArrowUp: [0, "u"], ArrowDown: [0, "d"], ArrowLeft: [0, "l"], ArrowRight: [0, "r"], Space: [0, "f"], Enter: [0, "f"] };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const k = KEYMAP[e.code]; if (!k) return;
      e.preventDefault();
      const down = e.type === "keydown", cl = ctl[k[0]];
      if (k[1] === "f") { if (down && !e.repeat) cl.fc++; cl.keyFire = down; } else cl.keys[k[1]] = down;
    };
    /** The stick (or keys) for control set c, turned into the table's directions. */
    function readCtl(c: number): Input {
      const cl = ctl[c]; let ax = 0, ay = 0;
      if (cl.stick) { const r = zones(c).r; ax = cl.stick.kx / r; ay = cl.stick.ky / r; }
      else {
        ax = (cl.keys.r ? 1 : 0) - (cl.keys.l ? 1 : 0); ay = (cl.keys.d ? 1 : 0) - (cl.keys.u ? 1 : 0);
        const d = Math.hypot(ax, ay); if (d > 0) { ax /= d; ay /= d; }
      }
      if (rot) { ax = -ax; ay = -ay; }
      return { ax: Math.round(ax * 100) / 100, ay: Math.round(ay * 100) / 100, fire: cl.fireHeld || cl.keyFire, fc: cl.fc };
    }
    // the browser test (?debug=1) can hold a control set (in that player's own view), or hand it to the computer driver
    const testIn: (Input | null)[] = [null, null], testAuto: (Brain | null)[] = [null, null];
    function inputFor(c: number): Input {
      const auto = testAuto[c];
      if (auto) {
        const mine = live ? me : c;
        if (!guest) return aiInput(w, auto, mine);
        const foe = interpTank(0) ?? newTank(0), tanks = [foe, pred];   // the guest (always lunchbox 1) drives from what it sees
        return aiInput({ ...w, map, tanks, picks: gPicks }, auto, me);
      }
      const t = testIn[c];
      if (t) return rot ? { ...t, ax: -t.ax, ay: -t.ay } : t;
      return readCtl(c);
    }
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey);

    // ── simulation ──
    function collectEvents() {
      for (const e of w.events) {
        const code = e.k === "hit" ? 0 : e.k === "pick" ? 1 : 2;
        showEvent(code, e.x, e.y, e.v, e.n);
        if (host) recentEv.push({ tick: w.tick, e: [e.id, code, Math.round(e.x), Math.round(e.y), e.v, e.n] });
      }
      w.events.length = 0;
      while (recentEv.length && recentEv[0].tick < w.tick - 60) recentEv.shift();
    }
    function guestInputForHost(): Input[] {
      // the guest's inputs, one per step, from a small buffer that soaks up network jitter
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
      if (phase === "count") {
        phaseT -= STEP_MS;
        if (phaseT <= 0 && !guest) { phase = "play"; goT = GO_MS; }
        if (host && w.tick % (netRef.current.netMode() === "relay" ? 6 : 3) === 0) hostSnap();
        if (host) w.tick++;
        return;
      }
      if (phase === "ko") {
        phaseT -= STEP_MS;
        if (host && w.tick % 6 === 0) hostSnap();
        if (host) w.tick++;
        if (phaseT <= 0) afterKo();
        return;
      }
      if (phase !== "play") return;
      if (guest) { guestTick(); return; }
      let inputs: Input[];
      if (cpu) inputs = [inputFor(0), aiInput(w, brain, 1)];
      else if (local) inputs = [inputFor(0), inputFor(1)];
      else {
        const g = guestInputForHost();
        if (!g.length && starve > 60) return;   // a second with nothing from the guest: hold the round (the away card follows)
        while (g.length > 1) stepOneTank(w, 1, g.shift()!);   // catching up on a backlog
        // nothing from the guest this step: keep its last stick and button for a moment, then let go (never keep firing blind)
        inputs = [inputFor(0), g[0] ?? (starve <= 8 ? { ...lastGuestIn, s: -1 } : { ...NO_INPUT, fc: lastGuestIn.fc, s: -1 })];
        // lag compensation: a guest pea is tested against where the host's lunchbox was on the guest's screen
        const rtt = netRef.current.rtt(), relay = netRef.current.netMode() === "relay";
        const back = Math.min(15, Math.round((rtt + (relay ? 14 : 7) * STEP_MS + (relay ? 7 : 2) * STEP_MS) / STEP_MS));
        w.lagPos = (v, p) => (p.o === 1 && v === 0 && hostHist.length > back ? hostHist[hostHist.length - 1 - back] : w.tanks[v]);
      }
      stepWorld(w, inputs);
      if (host) { hostHist.push({ x: w.tanks[0].x, y: w.tanks[0].y }); if (hostHist.length > 40) hostHist.shift(); }
      collectEvents();
      const win = roundWinner(w);
      if (host) { const relay = netRef.current.netMode() === "relay"; if (w.tick % (relay ? 6 : 3) === 0 || win >= 0) hostSnap(); }
      if (win >= 0) endRound(win);
    }
    function hostSnap() {
      const ph = phase === "count" ? 0 : phase === "play" ? 1 : 2;
      sendNet({
        t: "s", m: matchNo, r: round, k: w.tick, ph, cl: Math.max(0, Math.round(phaseT)), a: lastApplied, tm: Math.max(0, Math.round((ROUND_T - w.time) * 10) / 10),
        T: w.tanks.map(packTank), P: w.peas.map(p => [p.id, p.o, q1(p.x), q1(p.y), Math.round(p.vx), Math.round(p.vy), p.cs]),
        K: w.picks.map(k => [k.id, k.k, k.x, k.y, q1(k.life)]), E: recentEv.map(r => r.e),
      }, false);
    }
    function guestTick() {
      if (!predOn) return;
      if (lastSnap && performance.now() - lastSnap.at > 1000) return;   // nothing from the host for a second: hold still
      seq++;
      const inp = { ...inputFor(0), s: seq };
      hist.set(seq, inp);
      const other = lastSnap ? unpackTank(lastSnap.T[1 - me]) : null;
      if (stepTank(pred, inp, map, other, predPeas.length)) { predPeas.push(peaFrom(pred, -seq, me, seq)); predSet.add(seq); }
      // my peas fly on my screen straight away; the host decides what they hit
      const foe = interpTank(1 - me);
      for (let k = predPeas.length - 1; k >= 0; k--) {
        const p = predPeas[k], r = stepPea(p, map, null);
        const hitFoe = foe && Math.hypot(p.x - foe.x, p.y - foe.y) < TANK_R + PEA_R;
        if (r !== null || hitFoe) { predPeas.splice(k, 1); if (r !== null) splats.push({ x: p.x, y: p.y, age: 0, color: "#6cbf3c" }); }
      }
      // send my stick and button: the last several steps, run-length packed, so a lost packet costs nothing
      const relay = netRef.current.netMode() === "relay";
      if (++sendT >= (relay ? 6 : 2)) {
        sendT = 0;
        const n: number[][] = []; const span = relay ? 20 : 8;
        for (let k = seq; k > Math.max(0, seq - span); k--) {
          const v = hist.get(k); if (!v) break;
          const row = [Math.round(v.ax * 100), Math.round(v.ay * 100), v.fire ? 1 : 0, v.fc], lastRow = n[n.length - 1];
          if (lastRow && lastRow[1] === row[0] && lastRow[2] === row[1] && lastRow[3] === row[2] && lastRow[4] === row[3]) lastRow[0]++;
          else n.push([1, ...row]);
        }
        sendNet({ t: "i", r: round, s: seq, n }, false);
      }
    }
    // guest: where a tank was at the render time (a little in the past), between two snapshots
    function renderTick() {
      if (clockOff === null) return 0;
      const relay = netRef.current.netMode() === "relay";
      return performance.now() / STEP_MS + clockOff - (relay ? 14 : 7);
    }
    function bracket() {
      const rt = renderTick();
      let a: Snap | null = null, b: Snap | null = null;
      for (let k = snaps.length - 1; k >= 0; k--) { if (snaps[k].k <= rt) { a = snaps[k]; b = snaps[k + 1] ?? null; break; } }
      if (!a) { a = snaps[0] ?? null; b = null; }
      const f = a && b ? Math.max(0, Math.min(1, (rt - a.k) / (b.k - a.k))) : 0;
      return { a, b, f, rt };
    }
    function interpTank(i: number) {
      const { a, b, f } = bracket();
      if (!a) return null;
      const ta = unpackTank(a.T[i]); if (!b) return ta;
      const tb = unpackTank(b.T[i]);
      return { ...tb, x: ta.x + (tb.x - ta.x) * f, y: ta.y + (tb.y - ta.y) * f, a: ta.a + wrapAngle(tb.a - ta.a) * f };
    }

    // ── loop ──
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (t: number) => {
      const dt = Math.max(0, Math.min(250, t - last)); last = t;
      const frozen = live ? netRef.current.isAway() : pausedRef.current || !startedNow;   // a live match freezes while someone's away
      if (!frozen) {
        acc += dt; let n = 0;
        while (acc >= STEP_MS && n < 12) { acc -= STEP_MS; n++; tick(); }
        if (n >= 12) acc = 0;
        if (goT > 0) goT -= dt;
        if (phase === "play" || phase === "count") labelT -= dt;
        for (let k = floats.length - 1; k >= 0; k--) { floats[k].age += dt; if (floats[k].age > floats[k].life) floats.splice(k, 1); }
        for (let k = splats.length - 1; k >= 0; k--) { splats[k].age += dt; if (splats[k].age > 450) splats.splice(k, 1); }
        for (let i = 0; i < 2; i++) flash[i] = Math.max(0, flash[i] - dt);
        const decay = Math.exp(-dt / 110); off.x *= decay; off.y *= decay; off.a *= decay;
      } else { ctl.forEach(c => { c.stick = null; c.fireHeld = false; }); }
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    // ── drawing ──
    const rr = (x: number, y: number, ww: number, hh: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, ww, hh, r); };
    const text = (s: string, x: number, y: number, size: number, color: string, weight = 700, align: CanvasTextAlign = "center") => {
      ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "alphabetic"; ctx.fillText(s, x, y);
    };
    const scr = (x: number, y: number) => ({ x: rot ? AW - x : x, y: (rot ? AH - y : y) + arenaY });   // table point to canvas point
    const img = (i: number) => imgs[i]?.complete && imgs[i].naturalWidth ? imgs[i] : null;
    function buildTable(): HTMLCanvasElement {
      const k = canvas.width / TW, c = document.createElement("canvas");
      c.width = Math.round(AW * k); c.height = Math.round(AH * k);
      const g = c.getContext("2d")!; g.scale(k, k);
      // the table top: warm wood planks
      g.fillStyle = "#e9c99b"; g.fillRect(0, 0, AW, AH);
      for (let y = 0; y < AH; y += 44) {
        g.fillStyle = (y / 44) % 2 ? "rgba(160,110,60,0.07)" : "rgba(255,255,255,0.06)"; g.fillRect(0, y, AW, 44);
        g.strokeStyle = "rgba(140,92,48,0.22)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, y); g.lineTo(AW, y); g.stroke();
        g.strokeStyle = "rgba(140,92,48,0.08)"; g.lineWidth = 1;
        for (let x = (y * 7) % 90; x < AW; x += 130) { g.beginPath(); g.ellipse(x + 30, y + 22, 26, 5, 0, 0, 7); g.stroke(); }
      }
      // a placemat at each end, where the lunchboxes start
      for (const [cx, cy, col] of [[AW / 2, AH - 34, tankCol(0)], [AW / 2, 34, tankCol(1)]] as [number, number, string][]) {
        g.fillStyle = "rgba(255,255,255,0.55)"; g.beginPath(); g.roundRect(cx - 44, cy - 24, 88, 48, 10); g.fill();
        g.strokeStyle = col; g.globalAlpha = 0.25; g.lineWidth = 2; g.stroke(); g.globalAlpha = 1;
      }
      for (const o of map.obs) {
        g.fillStyle = "rgba(90,55,20,0.22)";   // shadow
        if (o.k === 1) { g.beginPath(); g.arc(o.x + 3, o.y + 5, o.r, 0, 7); g.fill(); }
        else { g.beginPath(); g.roundRect(o.x - o.w / 2 + 3, o.y - o.h / 2 + 5, o.w, o.h, 4); g.fill(); }
        if (o.k === 1) {   // a fruit bowl
          g.fillStyle = "#ffffff"; g.beginPath(); g.arc(o.x, o.y, o.r, 0, 7); g.fill();
          g.strokeStyle = "#cfd8e6"; g.lineWidth = 2; g.stroke();
          g.fillStyle = "#eef3fa"; g.beginPath(); g.arc(o.x, o.y, o.r * 0.78, 0, 7); g.fill();
          const fr = BOWL_FRUIT[o.c % 3], s = o.r * 0.95;
          const spots = [[-0.3, -0.25], [0.32, -0.12], [-0.05, 0.32]];
          fr.forEach((f, j) => { const im = img(f); if (im) g.drawImage(im, o.x + spots[j][0] * o.r - s / 2, o.y + spots[j][1] * o.r - s / 2, s, s); });
        } else {   // a cereal box seen from above
          const [c1, c2] = BOX_COL[o.c % 3];
          g.fillStyle = c1; g.beginPath(); g.roundRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h, 4); g.fill();
          g.strokeStyle = c2; g.lineWidth = 2; g.stroke();
          const lw = Math.min(o.w, o.h) * 0.7;
          g.fillStyle = "rgba(255,255,255,0.9)"; g.beginPath(); g.roundRect(o.x - lw / 2, o.y - lw / 2, lw, lw, 5); g.fill();
          const im = img(6); if (im) g.drawImage(im, o.x - lw * 0.38, o.y - lw * 0.38, lw * 0.76, lw * 0.76);
        }
      }
      return c;
    }
    function drawTank(x: number, y: number, a: number, col: string, hit: number, t: Tank) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      if (t.speedT > 0 || t.rapidT > 0) {   // boost glow
        ctx.strokeStyle = t.speedT > 0 ? "rgba(63,127,214,0.55)" : "rgba(46,170,110,0.6)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, TANK_R + 6, 0, Math.PI * 2 * Math.max(t.speedT, t.rapidT) / BOOST_T); ctx.stroke();
      }
      ctx.fillStyle = "#3b4252"; rr(-13, -13, 26, 6, 2); ctx.fill(); rr(-13, 7, 26, 6, 2); ctx.fill();   // treads
      ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let k = -10; k <= 10; k += 5) { ctx.moveTo(k, -13); ctx.lineTo(k, -7); ctx.moveTo(k, 7); ctx.lineTo(k, 13); }
      ctx.stroke();
      ctx.fillStyle = "#fff"; rr(9, -2.5, 13, 5, 2); ctx.fill();   // the straw
      ctx.fillStyle = col; ctx.fillRect(12, -2.5, 2.5, 5); ctx.fillRect(17, -2.5, 2.5, 5);
      ctx.fillStyle = col; rr(-12, -9, 23, 18, 4); ctx.fill();   // the lunchbox
      ctx.fillStyle = "rgba(255,255,255,0.28)"; rr(-9, -6, 14, 12, 3); ctx.fill();   // lid
      ctx.strokeStyle = "rgba(16,27,46,0.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, -3); ctx.lineTo(-6, 3); ctx.stroke();   // handle
      ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(8, -2, 3, 4);   // latch
      if (hit > 0) { ctx.globalAlpha = hit / 220 * 0.7; ctx.fillStyle = "#fff"; rr(-13, -13, 26, 26, 4); ctx.fill(); ctx.globalAlpha = 1; }
      ctx.restore();
    }
    function drawPea(x: number, y: number) {
      ctx.fillStyle = "#5fae34"; ctx.beginPath(); ctx.arc(x, y, PEA_R, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.beginPath(); ctx.arc(x - 1, y - 1.2, 1.2, 0, 7); ctx.fill();
    }
    function drawStrip(c: number, t: number) {
      const z = zones(c), cl = ctl[c], cx = AW / 2, cy = (z.y0 + z.y1) / 2;
      ctx.save();
      if (z.flip) { ctx.translate(cx, cy); ctx.rotate(Math.PI); ctx.translate(-cx, -cy); }
      // drawn as player 1's strip; flipped for player 2 at the top
      const sx = z.flip ? AW - z.sx : z.sx, sy = z.flip ? 2 * cy - z.sy : z.sy, fx = z.flip ? AW - z.fx : z.fx, fy = z.flip ? 2 * cy - z.fy : z.fy;
      const st = cl.stick, bx = st ? (z.flip ? AW - st.bx : st.bx) : sx, by = st ? (z.flip ? 2 * cy - st.by : st.by) : sy;
      const kx = st ? (z.flip ? -st.kx : st.kx) : 0, ky = st ? (z.flip ? -st.ky : st.ky) : 0;
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.arc(bx, by, z.r, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(63,127,214,0.35)"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = st ? BLUE : "rgba(63,127,214,0.85)"; ctx.beginPath(); ctx.arc(bx + kx, by + ky, z.r * 0.45, 0, 7); ctx.fill();
      if (!st) { ctx.fillStyle = "rgba(255,255,255,0.9)"; for (let k = 0; k < 4; k++) { const an = (k * Math.PI) / 2; ctx.beginPath(); ctx.moveTo(sx + Math.cos(an) * z.r * 0.8, sy + Math.sin(an) * z.r * 0.8); ctx.lineTo(sx + Math.cos(an + 0.25) * z.r * 0.62, sy + Math.sin(an + 0.25) * z.r * 0.62); ctx.lineTo(sx + Math.cos(an - 0.25) * z.r * 0.62, sy + Math.sin(an - 0.25) * z.r * 0.62); ctx.fill(); } }
      const rapid = w.tanks[live ? me : c].rapidT;
      const pressed = cl.fireHeld || cl.keyFire;
      ctx.fillStyle = pressed ? "#4f9a2a" : "#66b53b"; ctx.beginPath(); ctx.arc(fx, fy, z.r * 0.92, 0, 7); ctx.fill();
      ctx.strokeStyle = rapid > 0 ? "#2eaa6e" : "rgba(255,255,255,0.7)"; ctx.lineWidth = rapid > 0 ? 4 : 2.5; ctx.stroke();
      ctx.fillStyle = "#9fe07a"; ctx.beginPath(); ctx.arc(fx, fy - 2, z.r * 0.3, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.arc(fx - z.r * 0.1, fy - 2 - z.r * 0.1, z.r * 0.09, 0, 7); ctx.fill();
      text("Fire", fx, fy + z.r * 0.62, 11, "#fff", 800);
      text("Drive", sx, z.y1 - (local ? 6 : 10) - (z.flip ? 0 : 0), 11, GREY, 700);
      // the middle of the strip: whose controls these are, and a quiet note when the connection is slow
      if (local) {
        text(pnames[c], cx, cy - 2, 14, tankCol(c), 800);
        text(`${mw[c]} ${mw[c] === 1 ? "Win" : "Wins"}`, cx, cy + 15, 12, GREY, 700);
      } else if (live && netRef.current.netMode() === "relay") { text("Slow Connection", cx, cy - 3, 11, GREY, 700); text("Mode", cx, cy + 11, 11, GREY, 700); }
      else if (cpu && phase === "play" && w.time > 0) { const left = Math.max(0, Math.ceil(ROUND_T - w.time)); if (left <= 15) text(`${left}s Left`, cx, cy + 4, 12, left <= 5 ? RED : GREY, 700); }
      void t;
      ctx.restore();
    }
    function draw(t: number) {
      ctx.save(); ctx.clearRect(0, 0, TW, TH);
      // the strips
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      if (local) { rr(0, 0, AW, CHL - 6, 18); ctx.fill(); rr(0, CHL + AH + 6, AW, CHL - 6, 18); ctx.fill(); }
      else { rr(0, AH + 8, AW, CH - 8, 18); ctx.fill(); }
      for (let c = 0; c < humans; c++) drawStrip(c, t);

      // the table
      ctx.save(); rr(0, arenaY, AW, AH, 18); ctx.clip();
      ctx.translate(0, arenaY); if (rot) { ctx.translate(AW, AH); ctx.rotate(Math.PI); }
      const key = `${canvas.width}-${map.obs.length}-${map.obs[0]?.x}-${map.obs[1]?.y}-${imgs.every(i => i.complete)}`;
      if (!tableCache || key !== cacheKey) { tableCache = buildTable(); cacheKey = key; }
      ctx.drawImage(tableCache, 0, 0, AW, AH);
      // boosts
      const picks = guest ? gPicks : w.picks;
      for (const p of picks) {
        const pulse = 1 + 0.08 * Math.sin(t / 220 + p.id), fade = p.life < 2 ? 0.4 + 0.6 * Math.abs(Math.sin(t / 120)) : 1;
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.k === 0 ? "rgba(63,127,214,0.22)" : "rgba(232,80,91,0.2)"; ctx.beginPath(); ctx.arc(p.x, p.y, 13 * pulse, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, 7); ctx.fill();
        const im = img(p.k === 0 ? 7 : 8);
        if (im) { ctx.save(); ctx.translate(p.x, p.y); if (rot) ctx.rotate(Math.PI); ctx.drawImage(im, -8, -8, 16, 16); ctx.restore(); }
        ctx.globalAlpha = 1;
      }
      for (const s of splats) { const k = s.age / 450; ctx.globalAlpha = 1 - k; ctx.fillStyle = s.color; for (let j = 0; j < 5; j++) { const an = j * 1.26; ctx.beginPath(); ctx.arc(s.x + Math.cos(an) * (2 + 6 * k), s.y + Math.sin(an) * (2 + 6 * k), 1.8, 0, 7); ctx.fill(); } }
      ctx.globalAlpha = 1;
      // the lunchboxes and peas
      const shown: (Tank | null)[] = [null, null];
      if (guest) {
        const { a, b, f, rt } = bracket();
        for (let i = 0; i < 2; i++) {
          if (i === me && predOn && phase === "play") shown[i] = { ...pred, x: pred.x + off.x, y: pred.y + off.y, a: pred.a + off.a, hp: w.tanks[me].hp, speedT: w.tanks[me].speedT, rapidT: w.tanks[me].rapidT };
          else if (i === me && lastSnap) shown[i] = unpackTank(lastSnap.T[i]);
          else shown[i] = interpTank(i);
          if (shown[i]) { shown[i]!.hp = w.tanks[i].hp; shown[i]!.speedT = w.tanks[i].speedT; shown[i]!.rapidT = w.tanks[i].rapidT; }
        }
        if (a) {
          for (const p of a.P) {
            if (p[1] === me && predSet.has(p[6])) continue;   // my own pea is already flying on my screen
            const q = b ? b.P.find(v => v[0] === p[0]) : null;
            if (q) drawPea(p[2] / 10 + (q[2] - p[2]) / 10 * f, p[3] / 10 + (q[3] - p[3]) / 10 * f);
            else if (!b && rt - a.k < 8) { const dtk = (rt - a.k) / 60; drawPea(p[2] / 10 + p[4] * dtk, p[3] / 10 + p[5] * dtk); }   // no newer snapshot yet
          }
        }
        for (const p of predPeas) drawPea(p.x, p.y);
      } else {
        for (let i = 0; i < 2; i++) shown[i] = w.tanks[i];
        if (host) {   // the guest's lunchbox moves in little bursts as its inputs arrive: smooth it a touch
          const g = w.tanks[1];
          if (!visGuest.ok || Math.hypot(visGuest.x - g.x, visGuest.y - g.y) > 40) { visGuest.x = g.x; visGuest.y = g.y; visGuest.a = g.a; visGuest.ok = true; }
          else { visGuest.x += (g.x - visGuest.x) * 0.35; visGuest.y += (g.y - visGuest.y) * 0.35; visGuest.a += wrapAngle(g.a - visGuest.a) * 0.35; }
          shown[1] = { ...g, x: visGuest.x, y: visGuest.y, a: visGuest.a };
        }
        for (const p of w.peas) drawPea(p.x, p.y);
      }
      for (let i = 0; i < 2; i++) { const s = shown[i]; if (s && s.hp > 0) drawTank(s.x, s.y, s.a, tankCol(i), flash[i], s); else if (s) { ctx.globalAlpha = 0.35; drawTank(s.x, s.y, s.a, "#9aa6b8", 0, s); ctx.globalAlpha = 1; } }
      ctx.restore();

      // health, small, right above each lunchbox (always upright for whoever is looking)
      for (let i = 0; i < 2; i++) {
        const s = shown[i]; if (!s) continue;
        const p = scr(s.x, s.y), flipLabel = local && i === 1, hy = flipLabel ? p.y + 22 : p.y - 24, bw = 28;
        ctx.save();
        if (flipLabel) { ctx.translate(p.x, hy); ctx.rotate(Math.PI); ctx.translate(-p.x, -hy); }
        ctx.fillStyle = "rgba(255,255,255,0.85)"; rr(p.x - bw / 2 - 2, hy - 2, bw + 4, 8, 4); ctx.fill();
        ctx.fillStyle = s.hp > 50 ? "#2eaa6e" : s.hp > 25 ? "#e09a00" : RED; rr(p.x - bw / 2, hy, (bw * Math.max(0, s.hp)) / HP, 4, 2); ctx.fill();
        if (labelT > 0 && phase !== "over") { ctx.globalAlpha = Math.min(1, labelT / 600); text(pnames[i], p.x, hy - 5, 11, tankCol(i), 800); ctx.globalAlpha = 1; }
        ctx.restore();
      }
      for (const f of floats) {
        const s = shown[f.tank] ?? { x: f.x, y: f.y }, p = scr(s.x, s.y), a = 1 - f.age / f.life, flipT = local && f.tank === 1;
        ctx.save(); const fy = flipT ? p.y + 34 + f.age * 0.02 : p.y - 34 - f.age * 0.02;
        if (flipT) { ctx.translate(p.x, fy); ctx.rotate(Math.PI); ctx.translate(-p.x, -fy); }
        ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.6)); text(f.text, p.x, fy, 15, f.color, 800); ctx.restore();
      }
      ctx.globalAlpha = 1;

      // middle-of-table messages: countdown, Go!, round over (twice on Same Phone, one each way)
      let big = "", small = "";
      if (phase === "count") { big = String(Math.max(1, Math.ceil(phaseT / 1000))); small = cpu ? (daily ? `Round ${round} Of ${TODAY_ROUNDS}` : `Round ${round}`) : `Round ${round}`; }
      else if (phase === "play" && goT > 0) big = "Go!";
      else if (phase === "ko") { big = koText; small = cpu ? "" : live ? `You ${mw[me]} · ${pnames[1 - me]} ${mw[1 - me]}` : `${pnames[0]} ${mw[0]} · ${pnames[1]} ${mw[1]}`; }
      else if (phase === "lobby" || (phase === "over" && live)) { /* cards cover it */ }
      if (big) {
        const spots = local ? [[AH * 0.72, 0], [AH * 0.28, 1]] : [[AH / 2, 0]];
        for (const [yy, flip] of spots) {
          ctx.save(); const cy = arenaY + yy;
          if (flip) { ctx.translate(AW / 2, cy); ctx.rotate(Math.PI); ctx.translate(-AW / 2, -cy); }
          const isNum = /^\d$/.test(big), bh = isNum ? 64 : 44, bwid = isNum ? 84 : Math.min(AW - 30, 40 + big.length * 13);
          ctx.fillStyle = "rgba(255,255,255,0.92)"; rr(AW / 2 - bwid / 2, cy - bh / 2 - (small ? 8 : 0), bwid, bh + (small ? 18 : 0), 18); ctx.fill();
          text(big, AW / 2, cy + (isNum ? 14 : 8) - (small ? 8 : 0), isNum ? 40 : 22, INK, 800);
          if (small) text(small, AW / 2, cy + bh / 2 + 4, 12, GREY, 700);
          ctx.restore();
        }
      }
      ctx.restore();
    }

    // the browser test peeks at the match and can hold a control set
    if (dbg) (window as unknown as { __tt: unknown }).__tt = {
      state: () => ({ phase, round, wins: mw.slice(), hp: (guest ? w.tanks : w.tanks).map(t => t.hp), me, kind: P.kind, matchNo, tick: w.tick, time: Math.round(w.time * 10) / 10,
        tanks: guest ? [0, 1].map(i => { const s = i === me && predOn ? pred : interpTank(i); return s ? { x: Math.round(s.x), y: Math.round(s.y), a: Math.round(s.a * 100) / 100 } : null; }) : w.tanks.map(t => ({ x: Math.round(t.x), y: Math.round(t.y), a: Math.round(t.a * 100) / 100 })),
        shots: w.shots.slice(), hits: w.hits.slice(), peas: guest ? predPeas.length : w.peas.length, total, won, lost, net: live ? netRef.current.netMode() : null, rtt: live ? Math.round(netRef.current.rtt()) : 0,
        off: Math.round(Math.hypot(off.x, off.y) * 10) / 10, lastApplied, seq, map: map.obs.length }),
      hold: (c: number, inp: Input | null) => { testIn[c] = inp; },
      auto: (c: number, sharp: number | null) => { testAuto[c] = sharp === null ? null : newBrain(Math.floor(Math.random() * 1e9), sharp); },
      stats: () => (live ? netRef.current.stats() : null),
      cut: (on: boolean) => netRef.current.cut(on),
      aim: (c: number) => {   // the stick direction (in the player's own view) that points at the other lunchbox
        const mine = live ? me : c, a = guest ? (predOn ? pred : unpackTank(lastSnap!.T[me])) : w.tanks[mine], b = guest ? interpTank(1 - me)! : w.tanks[1 - mine];
        let ax = b.x - a.x, ay = b.y - a.y; const d = Math.hypot(ax, ay); ax /= d; ay /= d; if (rot) { ax = -ax; ay = -ay; }
        return { ax, ay, d };
      },
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
  const isCpu = play.kind === "cpu", isLive = play.kind === "live", isLocal = play.kind === "local";
  const me = play.kind === "live" ? play.me : 0;
  const pn = play.kind === "local" ? play.names : ["You", "Computer"];
  const friendRaw = play.kind === "live" ? play.names[1 - me] : "Guest";
  const friend = friendRaw === "Guest" ? "Your Friend" : friendRaw, friendLabel = friendRaw;
  const headline = !result ? "" : mode === "daily"
    ? (result.kind === "won" ? `You Won The Day ${result.won}-${result.lost}! 🎉` : `The Computer Took It ${result.lost}-${result.won}`)
    : `${result.won} Round${result.won === 1 ? "" : "s"} Won, Out In Round ${result.round}`;
  const share = () => {
    if (!result) return;
    const label = mode === "daily" ? `Pea Tanks #${n} (Today's Challenge)` : "Pea Tanks (Free Play)";
    const p = shell.scores.posted;
    const rank = p?.rank ? `\n🏆 #${p.rank} of ${p.total} ${mode === "daily" ? "today" : "this week"}` : "";
    const how = mode === "daily" ? (result.kind === "won" ? `Won ${result.won}-${result.lost}` : `Lost ${result.won}-${result.lost}`) : `${result.won} rounds won`;
    shell.share(`${label}\n${hud.score.toLocaleString()} pts · ${how} · ${result.acc}% aim${rank}\n${result.squares}\nCan you beat it? whatyouate.app/games/pea-tanks`);
  };
  const toCpu = () => { if (isLive || rui) net.leave(); setMatchEnd(null); setMenu(null); setLiveOn(false); setPlay({ kind: "cpu" }); setRun(r => r + 1); };
  const openRoom = () => { setMenu(null); net.create(); };
  const joinRoom = () => { if (code.length === 4) { setMenu(null); net.join(code); } };
  const startLocal = () => {
    const nm = names.map((v, i) => v.trim().slice(0, 12) || `Player ${i + 1}`);
    setMenu(null); setMatchEnd(null);
    setPlay({ kind: "local", m: (play.kind === "local" ? play.m : 0) + 1, names: nm });
  };
  const localRematch = () => { if (play.kind !== "local") return; setMatchEnd(null); setPlay({ ...play, m: play.m + 1 }); };
  const liveRematch = () => { setAgain(a => ({ ...a, me: true })); net.send({ t: "again" }, true); };
  const imReady = () => { setReady(r => ({ ...r, me: true })); net.send({ t: "ready" }, true); };
  const shareRoom = (c: string) => shell.share(`Play Pea Tanks with me! Room ${c}: ${window.location.origin}/games/pea-tanks?room=${c}`);
  const playing = isCpu ? started && !over && !roundCard : isLocal ? !matchEnd : false;
  const paired = rui?.s === "paired";
  const showRoomCard = rui && rui.s !== "paired";
  const awaySecs = net.away ? Math.max(0, Math.ceil((AWAY_MS - (Date.now() - net.away.since)) / 1000)) : 0;

  return (
    <GameScreen>
      <GameHeader title="Pea Tanks" mode={mode} onMode={m => { toCpu(); setMode(m); }} onBoard={() => shell.setBoardOpen(true)} onHelp={shell.help.show} />

      <div className="mt-2 flex items-center justify-between">
        {isCpu ? (<>
          <div><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Score</div><div className="text-2xl font-bold leading-none tabular-nums">{hud.score.toLocaleString()}</div></div>
          <div className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold text-[#3f7fd6]">
            Round {hud.round}{mode === "daily" ? ` of ${TODAY_ROUNDS}` : ""} · {hud.won}-{hud.lost}
          </div>
        </>) : (<>
          <div className="min-w-0"><div className="truncate text-[10px] uppercase tracking-wide text-[#5a6b85]">{isLive ? "You" : pn[0]}</div><div className="text-2xl font-bold leading-none tabular-nums text-[#3f7fd6]">{wins[isLive ? me : 0]}</div></div>
          <div className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold text-[#3f7fd6]">{play.kind === "live" ? `Live · Room ${play.code}` : `Same Phone · First To ${WINS_TO}`}</div>
        </>)}
        <div className="flex items-center gap-2">
          {isCpu ? <div className="text-right"><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Best</div><div className="text-lg font-semibold leading-none tabular-nums">{best.toLocaleString()}</div></div>
            : <div className="min-w-0 text-right"><div className="max-w-[110px] truncate text-[10px] uppercase tracking-wide text-[#5a6b85]">{isLive ? friendLabel : pn[1]}</div><div className="text-2xl font-bold leading-none tabular-nums text-[#e8505b]">{wins[isLive ? 1 - me : 1]}</div></div>}
          <PauseButton shell={shell} active={playing} />
        </div>
      </div>

      <BoardArea wrapRef={wrapRef} size={board} reserve={0}>
        <canvas ref={canvasRef} className="block touch-none" />
        <PrizeLogo shell={shell} active={isCpu && started && !over && !roundCard && !shell.paused && !menu && !rui} />
        <PausedCard shell={shell} active={playing} />

        {isCpu && !started && !over && !menu && !rui && !rejoin && (
          <Card>
            <div className="text-lg font-bold">{mode === "daily" ? `Today's Challenge #${n}` : "Free Play"}</div>
            <p className="mt-1 text-sm text-[#5a6b85]">{mode === "daily" ? "Best of 3 rounds against the computer's lunchbox." : "Win round after round. The computer gets sharper."}</p>
            <button onClick={() => startRef.current()} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Play The Computer</button>
            <div className="mt-2 flex gap-2">
              <button onClick={() => setMenu("friend")} className="flex-1 rounded-full bg-[#e3effe] py-3 text-sm font-semibold text-[#3f7fd6]">Play A Friend</button>
              <button onClick={() => setMenu("local")} className="flex-1 rounded-full bg-[#e3effe] py-3 text-sm font-semibold text-[#3f7fd6]">Same Phone</button>
            </div>
          </Card>
        )}

        {menu === "friend" && !rui && (
          <Card>
            <div className="text-xl font-bold">Play A Friend</div>
            <p className="mt-1 text-sm text-[#5a6b85]">Play live on two phones. Make a room and send your friend the link.</p>
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
            <p className="mt-1 text-sm text-[#5a6b85]">Lay the phone flat between you. Player 2 plays from the top end. First to {WINS_TO} rounds.</p>
            {[0, 1].map(i => (
              <input key={i} value={names[i]} maxLength={12} placeholder={i === 0 ? "Player 1 (Bottom)" : "Player 2 (Top)"} autoComplete="off"
                onChange={e => setNames(v => v.map((x, j) => (j === i ? e.target.value : x)))}
                className="mt-3 w-full rounded-xl border border-[#d6e2f5] px-3 py-2.5 text-base outline-none focus:border-[#3f7fd6]" />
            ))}
            <button onClick={startLocal} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Start</button>
            <button onClick={() => setMenu(null)} className="mt-2 w-full py-2 text-sm font-semibold text-[#5a6b85]">Back</button>
          </Card>
        )}

        {showRoomCard && rui && <RoomCard rui={rui} copied={shell.copied} onShare={() => shareRoom(rui.code)} onCancel={toCpu} onBack={() => { net.dismiss(); setMenu("friend"); }} onNew={openRoom} />}

        {rejoin && !rui && !menu && (
          <Card>
            <div className="text-xl font-bold">Rejoin Your Game?</div>
            <p className="mt-2 text-sm text-[#5a6b85]">You were playing {rejoin.friendName === "Guest" ? "your friend" : rejoin.friendName} in room {rejoin.code}.</p>
            <button onClick={() => { const r = rejoin; setRejoin(null); if (savedSession(GAME)) net.resume(r); }} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Rejoin Your Game</button>
            <button onClick={() => { setRejoin(null); try { localStorage.removeItem(`${GAME}-live`); sessionStorage.removeItem(`${GAME}-live`); } catch {} }} className="mt-2 w-full py-2 text-sm font-semibold text-[#5a6b85]">Not Now</button>
          </Card>
        )}

        {isLive && paired && net.away && (
          <Card>
            <div className="text-xl font-bold">{net.away.who === "friend" ? `${friend} Stepped Away...` : "Reconnecting..."}</div>
            <p className="mt-2 text-sm text-[#5a6b85]">{net.away.who === "friend" ? "The match is paused. It carries on as soon as they're back." : "The match is paused while we get you back in."}</p>
            <div className="mt-3 text-4xl font-bold tabular-nums text-[#3f7fd6]">{awaySecs}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[#5a6b85]">Seconds Left To Come Back</div>
            <button onClick={toCpu} className="mt-4 w-full rounded-full bg-[#e3effe] py-3 font-semibold text-[#3f7fd6]">Leave</button>
          </Card>
        )}

        {isLive && paired && !liveOn && !net.away && (
          <Card>
            <div className="text-xl font-bold">Get Ready</div>
            <ul className="mt-3 space-y-1.5 text-left text-sm">
              <li className="flex items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e3effe] text-xs">🕹️</span>Bottom left: push to drive. A small push just aims.</li>
              <li className="flex items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e3f5e9]"><span className="h-2.5 w-2.5 rounded-full bg-[#5fae34]" /></span>Bottom right: fire peas straight ahead.</li>
              <li className="flex items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center gap-0.5 rounded-full bg-[#fff4d6]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={foodPng("1f4a7")} alt="" className="h-3.5 w-3.5" /></span>Water drop: speed. Strawberry: rapid fire.</li>
            </ul>
            <p className="mt-2 text-sm font-semibold">Five hits knocks a lunchbox out. First to {WINS_TO} rounds wins.</p>
            <div className="mt-3 space-y-1 rounded-2xl bg-[#f0f6fe] px-3 py-2 text-sm">
              <div className="flex justify-between"><span className="font-semibold text-[#3f7fd6]">You</span><span className={ready.me ? "font-bold text-[#2eaa6e]" : "text-[#5a6b85]"}>{ready.me ? "Ready ✓" : "Not Yet"}</span></div>
              <div className="flex justify-between"><span className="max-w-[140px] truncate font-semibold text-[#e8505b]">{friendLabel}</span><span className={ready.them ? "font-bold text-[#2eaa6e]" : "text-[#5a6b85]"}>{ready.them ? "Ready ✓" : "Reading..."}</span></div>
            </div>
            <button onClick={imReady} disabled={ready.me} className="mt-3 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white disabled:opacity-70">
              {!ready.me ? "I'm Ready" : !ready.them ? `Waiting For ${friend}...` : net.mode === "connecting" ? "Connecting..." : "Starting..."}
            </button>
            <button onClick={toCpu} className="mt-1 w-full py-2 text-sm font-semibold text-[#5a6b85]">Leave</button>
          </Card>
        )}

        {matchEnd && !showRoomCard && !(isLive && net.away) && (isLive || isLocal) && (
          <Card>
            <div className="text-sm font-semibold text-[#5a6b85]">{play.kind === "live" ? `Room ${play.code}` : "Same Phone"}</div>
            <div className="mt-1 text-2xl font-bold">
              {isLive ? (matchEnd.winner === me ? "You Won! 🎉" : `${friend} Won`) : `${pn[matchEnd.winner]} Wins! 🎉`}
            </div>
            <div className="mt-1 text-sm text-[#5a6b85]">
              {isLive ? `You ${wins[me]} · ${friendLabel} ${wins[1 - me]}` : `${pn[0]} ${wins[0]} · ${pn[1]} ${wins[1]}`}
            </div>
            {isLive && again.them && !again.me && <div className="mt-2 text-sm font-semibold text-[#2eaa6e]">{friend} Wants A Rematch!</div>}
            <button onClick={isLive ? liveRematch : localRematch} disabled={isLive && again.me} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white disabled:opacity-70">
              {isLive && again.me ? `Waiting For ${friend}...` : "Rematch"}
            </button>
            <button onClick={toCpu} className="mt-2 w-full rounded-full bg-[#e3effe] py-3 font-semibold text-[#3f7fd6]">{isLive ? "Leave" : "Done"}</button>
            <a href={appStoreLink(GAME)} className="mt-3 inline-block text-xs font-semibold text-[#5a6b85] underline">Get WhatYouAte For iPhone</a>
          </Card>
        )}

        {roundCard && !over && (
          <Card>
            <div className="text-sm font-semibold text-[#5a6b85]">Round {roundCard.round} {roundCard.won ? "Won" : "Lost"}</div>
            <div className="mt-0.5 text-3xl font-bold leading-tight tabular-nums">+{roundCard.points.toLocaleString()}</div>
            <div className="text-sm text-[#5a6b85]">{roundCard.tie ? "Tied on health when time ran out, so the computer takes it" : roundCard.won ? `${roundCard.hp} health left · ${roundCard.acc}% aim · ${roundCard.secs}s` : "The computer took this one"}</div>
            <button onClick={() => nextRef.current()} className="mt-3 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Next Round</button>
          </Card>
        )}

        {over && isCpu && !menu && !rui && <GameOver label={mode === "daily" ? `Today's Challenge #${n}` : "Free Play"} headline={headline} score={hud.score} best={best} mode={mode}
          posted={shell.scores.posted} joined={!!shell.player} campaign={GAME} copied={shell.copied} fact={fact}
          pitch="Quick reflexes are fun. Steady energy is better. WhatYouAte helps with the second one."
          extra={<button onClick={() => setMenu("friend")} className="mt-2 text-sm font-semibold text-[#3f7fd6]">Play A Friend Instead →</button>}
          onBoard={() => shell.setBoardOpen(true)} onJoin={() => shell.setJoinOpen(true)} onAgain={() => setRun(r => r + 1)} onShare={share} />}
      </BoardArea>

      <ShellPopups shell={shell} game={GAME} todayNote="Today's Challenge: same tables and computer for everyone. Resets at midnight." />

      {shell.help.open && (
        <HelpModal onClose={shell.help.close} steps={[
          "Push the joystick (bottom left) to drive. Your lunchbox turns to face that way, then rolls. A small push just aims.",
          "Tap the green button (bottom right) to fire peas straight ahead. Hold it to keep firing.",
          "Hide behind fruit bowls and cereal boxes. Grab a water drop for speed or a strawberry for rapid fire.",
          "Five hits knocks a lunchbox out and wins the round. On a computer: WASD or arrows, and space.",
        ]}>
          <ModesHelp today="same tables and computer for everyone. Best of 3. Win with more health, better aim and less time to score higher."
            free="win round after round against a computer that gets a little sharper. Play A Friend and Same Phone: first to 3 rounds." />
        </HelpModal>
      )}
    </GameScreen>
  );
}

function RoomCard({ rui, copied, onShare, onCancel, onBack, onNew }: { rui: RoomState; copied: boolean; onShare: () => void; onCancel: () => void; onBack: () => void; onNew: () => void }) {
  return (
    <Card>
      {rui.s === "waiting" && (<>
        <div className="text-sm font-semibold text-[#5a6b85]">Your Room Code</div>
        <div className="mt-1 font-mono text-4xl font-bold tracking-[0.2em]">{rui.code}</div>
        <p className="mt-2 text-sm text-[#5a6b85]">Send your friend the link. You&apos;ll both get a quick how-to, then the match starts.</p>
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
        <button onClick={onCancel} className="mt-2 w-full py-2 text-sm font-semibold text-[#5a6b85]">Play The Computer</button>
      </>)}
      {rui.s === "lost" && (<>
        <div className="text-xl font-bold">Connection Lost</div>
        <p className="mt-2 text-sm text-[#5a6b85]">We couldn&apos;t get you back into room {rui.code} in time.</p>
        <button onClick={onNew} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Make A New Room</button>
        <button onClick={onCancel} className="mt-2 w-full rounded-full bg-[#e3effe] py-3 font-semibold text-[#3f7fd6]">Play The Computer</button>
      </>)}
      {rui.s === "left" && (<>
        <div className="text-xl font-bold">Your Friend Left</div>
        <p className="mt-2 text-sm text-[#5a6b85]">That match is over.</p>
        <button onClick={onNew} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Make A New Room</button>
        <button onClick={onCancel} className="mt-2 w-full rounded-full bg-[#e3effe] py-3 font-semibold text-[#3f7fd6]">Play The Computer</button>
      </>)}
    </Card>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[22px] bg-[#101b2e]/35 p-4">
      <div className="max-h-full w-full max-w-[300px] overflow-y-auto rounded-3xl bg-white p-5 text-center shadow-2xl [@media(max-height:700px)]:p-4">{children}</div>
    </div>
  );
}
