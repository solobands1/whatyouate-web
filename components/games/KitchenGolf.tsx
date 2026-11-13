"use client";

// Kitchen Golf: mini putt round a real kitchen, with a meatball. A round is a 9-hole tour from a bank of 12: on the
// counter, at the table, in the fridge, in the sink, on the floor, on the stove, at the island, in the cupboard, and
// harder takes on a few of them (behind the toaster with a paper towel tube, the crisper drawers, a rolling pin run,
// under the table past the sleeping dog). Drag back anywhere on the board (relative drag, so your finger never covers
// the ball), watch the short dotted line and the power meter, and let go to putt. Fewest strokes over 9 holes wins;
// 6 strokes a hole at most, then you pick up and take a 7. Water (the dog's bowl) sends you back with a stroke added.
// Both balls play the same hole and take turns (they don't hit each other); whoever has holed out waits for the other.
// "Today" is 9 holes against the computer, the same holes and computer for everyone; points per hole for strokes
// under 7, under par, holes in one and beating the computer. Free Play keeps going round after round while you
// beat (or tie) a computer that gets a little sharper.
// "Play A Friend" is a live match over a Supabase Realtime channel (no tables): whoever putts runs the roll and then
// sends where it stopped, so the two screens can't drift. Minimise or lose signal and the other phone shows
// "Stepped Away" for 60 seconds; a snapshot exchange on return catches you up. "Same Phone" is pass and play.
// Rules, holes, physics and the computer are in ./golf/sim (pure, the same answer in every browser); the drawings in
// ./golf/art; sounds in ./golf/sound (off until turned on). No facts mid-game; one on the game-over card.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sb } from "@/components/creators/api";
import { appStoreLink } from "@/components/site";
import { type Mode, type Toast, GameScreen, GameHeader, BoardArea, PrizeLogo, GameOver, PauseButton, PausedCard, ReadyCard, HelpModal, ModesHelp, ShellPopups,
  useGameShell, fitCanvas, loadImages, dailySeed, dailyNumber, torontoDate, mulberry32, readBest, saveBest, SoundButton } from "./kit";
import { type Course, type Roll, type Brain, W, BALL_R, CUP_R, MAX_PULL, MIN_PULL, MAX_STROKES, PICKUP, ROUND_HOLES, STEP, HOLES,
  compile, pickHoles, startRoll, stepRoll, tubePos, partsAt, aiPlan, sharpFor, holePoints, segDist2, WIN_BONUS, TIE_BONUS } from "./golf/sim";
import { FOOD_IMGS, paintHole, drawLive, drawFlag, drawMeatball, rollQuat, quatIdentity } from "./golf/art";
import { type Band, type Tab, type Tone, NAVY, Layer, TAB_W, TAB_H, bandKey, tabKey, paintBand, paintTab, makeBanner, makeFloat, drawRays, drawSparkle, drawHint, makeVignette } from "./golf/hud";
import { KG_CSS } from "./golf/skin";
import { GAME_FONT, loadGameFont } from "./gameFont";
import { Sound } from "./golf/sound";

const GAME = "kitchen-golf";
const LAUNCH = "2026-11-08";   // Today's Challenge #1
const SOUND = typeof window !== "undefined" ? new Sound() : null;   // plays through the shared games sound (./sfx)

const VW = 400, VH = 600;                                // the board on screen; holes are 400 wide and can be taller (the camera pans)
const GAIN = 1, TURN_MS = 30000, THINK_MS = 1000, THINK_STEPS = 60, SETTLE_MS = 650, HOLE_MS = 3200, INTRO_MS = 1900;
const BANNER_MS = 1700;                                  // how long a score banner ("Birdie!") stays up
const TOP = 58;                                          // the band at the top of the board: hole, par, strokes, whose turn
const FACTS: Toast[] = [
  { title: "Kitchen Fact", body: "It takes about 40 litres of maple sap to make 1 litre of maple syrup.", img: "1f95e" },
  { title: "Kitchen Fact", body: "Butter sold in Canada and the US has to be at least 80% milk fat.", img: "1f35e" },
  { title: "Kitchen Fact", body: "Ground beef is cooked safely once the inside reaches 71°C (160°F). A food thermometer is the sure way to tell.", img: "1f356" },
  { title: "Kitchen Fact", body: "To a botanist, a tomato is a fruit: it grows from the flower and holds the seeds.", img: "1f345" },
];
const sum = (v: number[]) => v.reduce((s, x) => s + x, 0);
const versus = (s: number, par: number) => (s >= PICKUP ? "🟥" : s === 1 ? "🌟" : s < par ? "🟦" : s === par ? "🟩" : s === par + 1 ? "🟨" : s === par + 2 ? "🟧" : "🟥");
const KEYCAP = ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣"];
function scoreName(s: number, par: number) {
  if (s >= PICKUP) return "Picked Up";
  if (s === 1) return "Hole In One!";
  const d = s - par;
  return d <= -2 ? "Eagle!" : d === -1 ? "Birdie!" : d === 0 ? "Par" : d === 1 ? "Bogey" : d === 2 ? "Double Bogey" : `${d} Over`;
}
const BLUE = "#3f7fd6", RED = "#e8505b";

type St = { hole: number; balls: number[][]; strokes: number[]; done: boolean[]; cards: number[][]; lead: number; shooter: number; n: number; clock: number };
const clone = (s: St): St => JSON.parse(JSON.stringify(s));
type Msg =
  | { t: "hello"; id: string; name: string }
  | { t: "lobby"; id: string; name: string; to: string; ready: boolean }   // host to guest: you're paired, here's my name and whether I'm ready
  | { t: "ready"; id: string; ready: boolean }                             // I tapped I'm Ready on the Get Ready card
  | { t: "start"; m: number; seed: number; first: 0 | 1; names: string[]; ids: string[] }
  | { t: "putt"; m: number; n: number; x: number; y: number; px: number; py: number; c: number }   // the putter let go: ball, pull and hole clock
  | { t: "done"; m: number; n: number; x: number; y: number; r: number; c: number }             // where it stopped (r: 1 stopped, 2 holed, 3 water)
  | { t: "pass"; m: number; n: number }                                    // the putter's 30 seconds ran out: a stroke, the ball stays
  | { t: "aim"; m: number; n: number; px: number; py: number }             // the putter's pull while dragging (whole numbers, about 6 a second)
  | { t: "aimEnd"; m: number; n: number }                                  // they let go without putting
  | { t: "again" }
  | { t: "resume"; id: string; host: boolean; snap: unknown }              // back from a break: here is what I have
  | { t: "state"; host: boolean; snap: unknown }                           // and here is what I have
  | { t: "ping"; id: string; p: number }                                   // every 3 seconds mid-match: still here, and how far the match has got
  | { t: "away"; id: string }                                              // I'm switching apps or locking the phone
  | { t: "bye" };
type GameMsg = Extract<Msg, { n: number }>;
type LivePlay = { kind: "live"; code: string; m: number; seed: number; me: 0 | 1; first: 0 | 1; names: string[] };
type LocalPlay = { kind: "local"; m: number; seed: number; first: 0 | 1; names: string[] };
type Play = { kind: "cpu" } | LivePlay | LocalPlay;
type Phase = "intro" | "aim" | "think" | "roll" | "await" | "settle" | "pass" | "holeEnd" | "between" | "over";
type Result = { kind: "won" | "lost" | "tie"; you: number; cpu: number; par: number; card: number[]; cpuCard: number[]; pars: number[]; rounds: number };
type Hud = { score: number; hole: number; round: number; tot: number[] };
type Row = { name: string; card: number[]; color: string };
type HoleCard = { hole: number; name: string; par: number; results: { name: string; strokes: number; color: string }[]; pts: number | null; pars: number[]; rows: Row[] };
type Intro = { n: number; name: string; par: number };
type RoundCard = { round: number; won: boolean; tie: boolean; points: number; you: number; cpu: number };
type MatchEnd = { winner: number; tot: number[]; cards: number[][]; pars: number[] };

// ── live rooms ─────────────────────────────────────────────────────────────
// One Realtime channel per room, "kitchen-golf:CODE". Presence says who's in (2 at most; a third is told it's full).
// The guest says hello and the host answers with "lobby": both see the Get Ready card, and each "ready" is broadcast (and
// kept in presence). Only when both are ready does the host pick the seed and send start; then each stroke is a "putt"
// from the putter (both screens roll it) and a "done" with where it stopped, which the other screen takes as final.
// "pass" when a putt's 30 seconds run out, "again" for a rematch, "bye" on leaving.
// Each player keeps a seat id for the room (sessionStorage, with a localStorage copy), so a reload or a dropped connection
// comes back as the same player. Gone from presence mid-match means "Stepped Away" for 60 seconds, not gone: on return,
// "resume" and "state" swap snapshots of the match and each side keeps the newer one. Presence can take a while to notice
// a phone that lost signal, so each side also pings every 3 seconds: 12 seconds of silence counts as stepped away, a phone
// going to the background says "away" on its way out, and a ping that shows the friend further ahead asks for a catch-up.
const ALPHA = "ACDEFHJKMNPRTWXY";   // no I/L/1, O/Q/0, S/5, Z/2, B/8, G/6, U/V
const newCode = () => Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");
type Member = { id: string; name: string; role: "host" | "guest"; at: number; ready?: boolean };
type RoomUi = { s: "waiting" | "joining" | "lobby" | "full" | "empty" | "left" | "error"; code: string };
type Snap = { m: number; p: number; [k: string]: unknown };
type RoomHandlers = { start: (p: LivePlay) => void; game: (m: GameMsg) => void; left: () => void; snapshot: () => Snap | null; apply: (snap: Snap) => void; resumed: () => void };
type Saved = { code: string; role: Member["role"]; id: string; at: number; friendId: string; friendName: string; m: number; first: 0 | 1; loser: 0 | 1; t: number };
const ROOM_KEY = "kitchen-golf-room", LIVE_KEY = "kitchen-golf-live", AWAY_MS = 60000;
type SavedLive = { code: string; play: LivePlay; snap: Snap | null; t: number };
function readSaved(code?: string): Saved | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(ROOM_KEY) ?? localStorage.getItem(ROOM_KEY) ?? "null") as Saved | null;
    if (!v || (code && v.code !== code) || Date.now() - v.t > 3 * 3600 * 1000) return null;
    return v;
  } catch { return null; }
}
function readLive(): SavedLive | null {
  try { const v = JSON.parse(localStorage.getItem(LIVE_KEY) ?? "null") as SavedLive | null; return v && Date.now() - v.t < 3 * 3600 * 1000 ? v : null; } catch { return null; }
}
const forgetLive = () => { try { localStorage.removeItem(LIVE_KEY); } catch {} };

function useRoom(nameRef: { current: string }, handlers: { current: RoomHandlers }) {
  const [ui, setUi] = useState<RoomUi | null>(null);
  const [again, setAgainState] = useState({ me: false, them: false });
  const [ready, setReadyState] = useState({ me: false, them: false });   // the Get Ready card, before the first game
  const [friendName, setFriendName] = useState("Guest");
  const [away, setAwayState] = useState<number | null>(null);            // the friend stepped away: when their 60 seconds run out
  const [reconnecting, setReconnecting] = useState(false);               // we're catching up after our own break
  const s = useRef({ ch: null as RealtimeChannel | null, code: "", role: "host" as Member["role"], id: "", at: 0, friendId: "", friendName: "Guest",
    seen: false, m: 0, first: 0 as 0 | 1, loser: 1 as 0 | 1, last: null as Msg | null, again: { me: false, them: false }, ready: { me: false, them: false },
    timers: [] as ReturnType<typeof setTimeout>[], away: 0, awayT: null as ReturnType<typeof setTimeout> | null, heard: 0, ahead: 0 }).current;
  const setAgain = (a: { me: boolean; them: boolean }) => { s.again = a; setAgainState(a); };
  const setReady = (r: { me: boolean; them: boolean }) => { s.ready = r; setReadyState(r); };
  const current = (): Saved => ({ code: s.code, role: s.role, id: s.id, at: s.at, friendId: s.friendId, friendName: s.friendName, m: s.m, first: s.first, loser: s.loser, t: Date.now() });
  const save = () => { if (!s.code) return; const v = JSON.stringify(current()); try { sessionStorage.setItem(ROOM_KEY, v); localStorage.setItem(ROOM_KEY, v); } catch {} };
  const forget = () => { try { sessionStorage.removeItem(ROOM_KEY); localStorage.removeItem(ROOM_KEY); } catch {} };
  const members = (ch: RealtimeChannel) => {
    const st = ch.presenceState() as unknown as Record<string, Member[]>, seen = new Set<string>(), out: Member[] = [];
    for (const k in st) for (const m of st[k]) if (m.id && !seen.has(m.id)) { seen.add(m.id); out.push(m); }
    return out.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  };
  const setFriend = (id: string, name: string) => {
    s.friendId = id; s.friendName = name || "Guest"; setFriendName(s.friendName);
    s.seen = !!id && !!s.ch && members(s.ch).some(m => m.id === id);    // already in presence? then a later absence means they left
    save();
  };
  // only over a joined channel: otherwise supabase falls back to a REST call that fails in the browser; anything missed
  // while we're not joined is caught up by the resume / ping exchange
  const send = (msg: Msg) => { const ch = s.ch as (RealtimeChannel & { state?: string }) | null; if (ch && ch.state === "joined" && sb().realtime.isConnected()) void ch.send({ type: "broadcast", event: "m", payload: msg }); };
  const track = () => { if ((s.ch as unknown as { state?: string } | null)?.state === "joined") void s.ch?.track({ id: s.id, name: nameRef.current, role: s.role, at: s.at, ready: s.ready.me }); };   // presence keeps "ready" too
  const clearAway = () => {
    if (s.awayT) clearTimeout(s.awayT); s.awayT = null;
    if (s.away) { s.away = 0; setAwayState(null); }
  };
  const close = (bye: boolean, keep = false) => {
    s.timers.forEach(t => { clearTimeout(t); clearInterval(t); }); s.timers = [];
    const ch = s.ch; s.ch = null;
    if (ch) {
      if (bye && (ch as unknown as { state?: string }).state === "joined") void ch.send({ type: "broadcast", event: "m", payload: { t: "bye" } });
      void ch.untrack().catch(() => {}); void sb().removeChannel(ch);
    }
    if (keep) return;                                                  // reconnecting: the match carries on
    clearAway(); setReconnecting(false);
    setFriend("", "Guest"); s.seen = false; s.m = 0; s.last = null; setAgain({ me: false, them: false }); setReady({ me: false, them: false });
  };
  // gone from presence mid-match: give them 60 seconds (they may have just answered a text); "bye" or the 60s ending is final
  const friendGone = (final = false) => {
    if (!s.ch && !s.away) return;
    if (s.role === "host" && !s.m) {                                     // left from the Get Ready card: keep the room open for them
      setFriend("", "Guest"); s.seen = false; setReady({ me: false, them: false }); track(); setUi({ s: "waiting", code: s.code }); return;
    }
    if (!final && s.m) {
      if (s.away) return;
      s.away = Date.now() + AWAY_MS; setAwayState(s.away);
      s.awayT = setTimeout(() => friendGone(true), AWAY_MS); return;
    }
    const code = s.code; close(false); forget(); setUi({ s: "left", code }); handlers.current.left();
  };
  // the host starts the first game only when both have tapped I'm Ready and the friend is still here
  const hostCheck = () => {
    if (s.role !== "host" || s.m || !s.ch || !s.friendId || !s.ready.me || !s.ready.them) return;
    if (!members(s.ch).some(m => m.id === s.friendId)) return;          // presence will call back when they show up
    begin(0);
  };
  const onPresence = (ch: RealtimeChannel) => {
    const list = members(ch), mine = list.findIndex(m => m.id === s.id);
    if (mine < 0) return;                                              // our own entry hasn't landed yet
    if (s.role === "host" && !s.friendId && list.some((m, i) => i < mine && m.role === "host")) { open(newCode(), "host"); return; }   // code already taken
    if (s.role === "guest" && !s.m && !s.friendId && mine >= 2) { const code = s.code; close(false); setUi({ s: "full", code }); return; }
    if (s.friendId) {
      const f = list.find(m => m.id === s.friendId);
      if (f) { s.seen = true; clearAway(); if (!s.m && f.ready && !s.ready.them) setReady({ ...s.ready, them: true }); hostCheck(); }
      else if (s.seen) friendGone();
    }
  };
  const begin = (first: 0 | 1) => {
    s.m++; s.first = first; s.heard = Date.now(); setAgain({ me: false, them: false });
    const msg: Msg = { t: "start", m: s.m, seed: Math.floor(Math.random() * 1e9), first, names: [nameRef.current, s.friendName], ids: [s.id, s.friendId] };
    s.last = msg; send(msg); setUi(null); save();
    handlers.current.start({ kind: "live", code: s.code, m: s.m, seed: msg.seed, me: 0, first, names: msg.names });
  };
  const lobbyMsg = (): Msg => ({ t: "lobby", id: s.id, name: nameRef.current, to: s.friendId, ready: s.ready.me });
  // catching up: whoever comes back says "resume" with its snapshot; the other answers with its own; each keeps the newer
  const sendResume = () => { send({ t: "resume", id: s.id, host: s.role === "host", snap: handlers.current.snapshot() }); s.timers.push(setTimeout(() => setReconnecting(false), 4000)); };
  const consider = (snap: Snap | null, fromHost: boolean) => {
    if (!snap) return;
    const mine = handlers.current.snapshot();
    if (!mine || snap.m > mine.m || (snap.m === mine.m && (snap.p > mine.p || (snap.p === mine.p && fromHost && s.role !== "host")))) {
      if (snap.m > s.m) { s.m = snap.m; save(); }
      handlers.current.apply(snap);
    }
  };
  // catch up with the friend: send ours, they answer with theirs, each keeps the newer
  const resync = () => { if (s.ch && s.m) send({ t: "resume", id: s.id, host: s.role === "host", snap: handlers.current.snapshot() }); };
  const onMsg = (msg: Msg) => {
    if (s.m && msg.t !== "hello" && msg.t !== "lobby" && (!("id" in msg) || msg.id === s.friendId)) {
      s.heard = Date.now();
      if (s.away && msg.t !== "away" && msg.t !== "bye" && msg.t !== "resume") { clearAway(); resync(); }   // back after going quiet
    }
    if (msg.t === "ping") {
      if (!s.m && s.role === "guest" && msg.id === s.friendId) { send({ t: "hello", id: s.id, name: nameRef.current }); return; }   // the host has started and we missed it: ask again
      const mine = handlers.current.snapshot();
      s.ahead = mine && msg.p > mine.p ? s.ahead + 1 : 0;
      if (s.ahead >= 3) { s.ahead = 0; resync(); }                     // they've been ahead of us for a while: we missed something
      return;
    }
    if (msg.t === "away") { if (msg.id === s.friendId) friendGone(); return; }
    if (msg.t === "hello") {
      if (s.role !== "host") return;
      if (!s.friendId) { setFriend(msg.id, msg.name); setReady({ me: false, them: false }); track(); setUi({ s: "lobby", code: s.code }); }
      if (msg.id === s.friendId) send(s.m && s.last ? s.last : lobbyMsg());   // in the lobby, or they missed the start
    } else if (msg.t === "lobby") {
      if (s.role !== "guest" || msg.to !== s.id || s.m) return;
      if (!s.friendId) { setFriend(msg.id, msg.name); setUi({ s: "lobby", code: s.code }); }
      if (msg.ready !== s.ready.them) setReady({ ...s.ready, them: msg.ready });
    } else if (msg.t === "ready") {
      if (msg.id !== s.friendId || s.m) return;
      setReady({ ...s.ready, them: msg.ready }); hostCheck();
    } else if (msg.t === "start") {
      if (s.role !== "guest" || msg.ids[1] !== s.id || msg.m <= s.m) return;
      s.m = msg.m; s.first = msg.first; s.heard = Date.now(); setFriend(msg.ids[0], msg.names[0]); setAgain({ me: false, them: false }); setUi(null);
      handlers.current.start({ kind: "live", code: s.code, m: msg.m, seed: msg.seed, me: 1, first: msg.first, names: msg.names });
    } else if (msg.t === "again") {
      setAgain({ ...s.again, them: true });
      if (s.role === "host" && s.again.me) begin(s.loser);
    } else if (msg.t === "resume") {
      if (msg.id !== s.friendId) return;
      clearAway(); send({ t: "state", host: s.role === "host", snap: handlers.current.snapshot() });
      consider(msg.snap as Snap | null, msg.host); handlers.current.resumed();
    } else if (msg.t === "state") {
      consider(msg.snap as Snap | null, msg.host); setReconnecting(false); handlers.current.resumed();
    } else if (msg.t === "bye") friendGone(true);
    else handlers.current.game(msg);
  };
  function open(code: string, role: Member["role"], resume?: Saved) {
    close(false, !!resume);
    const prior = resume ?? readSaved(code);                           // same room as before: same seat
    s.code = code; s.role = role; s.id = prior?.id ?? Math.random().toString(36).slice(2, 10); s.at = prior?.at ?? Date.now();
    if (resume) { s.friendId = resume.friendId; s.friendName = resume.friendName || "Guest"; setFriendName(s.friendName); s.m = resume.m; s.first = resume.first; s.loser = resume.loser; s.seen = false; }
    const ch = sb().channel(`kitchen-golf:${code}`, { config: { broadcast: { self: false }, presence: { key: s.id } } });
    s.ch = ch; s.heard = Date.now(); save();
    ch.on("broadcast", { event: "m" }, ({ payload }) => { if (s.ch === ch) onMsg(payload as Msg); });
    ch.on("presence", { event: "sync" }, () => { if (s.ch === ch) onPresence(ch); });
    ch.subscribe(status => {
      if (s.ch !== ch) return;
      if (status === "SUBSCRIBED") {
        track();
        if (s.m) sendResume();
        else if (role === "guest" && !s.friendId) {
          const hello = () => { if (!s.m && !s.friendId) send({ t: "hello", id: s.id, name: nameRef.current }); };
          hello(); s.timers.push(setInterval(hello, 1500));
          s.timers.push(setTimeout(() => {                             // nobody answering: no host, or the host is busy with someone else
            if (s.m || s.friendId || s.ch !== ch) return;
            const list = members(ch), host = list.some(m => m.role === "host"), others = list.filter(m => m.role === "guest" && m.id !== s.id).length;
            if (!host || others > 0) { close(false); setUi({ s: host ? "full" : "empty", code }); }
          }, 8000));
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (s.m || s.friendId) { setReconnecting(true); s.timers.push(setTimeout(() => { if (s.ch === ch || !s.ch) open(s.code, s.role, current()); }, 1500)); }   // try again, same seat
        else { close(false); setUi({ s: "error", code }); }
      }
    });
    if (resume && resume.m) { setUi(null); setReconnecting(true); }
    else setUi({ s: role === "host" ? "waiting" : "joining", code });
  }
  // mid-match heartbeat: say we're here; a friend silent for 12 seconds has stepped away (or we've lost signal)
  useEffect(() => {
    const t = setInterval(() => {
      if (!s.ch || !s.m || !s.friendId || document.visibilityState !== "visible") return;
      const sn = handlers.current.snapshot();
      send({ t: "ping", id: s.id, p: sn ? sn.p : 0 });
      if (!s.away && s.heard && Date.now() - s.heard > 12000) {
        if (typeof navigator !== "undefined" && navigator.onLine === false) setReconnecting(true);
        else friendGone();
      }
    }, 3000);
    const hide = () => { if (document.visibilityState === "hidden" && s.ch && s.m) send({ t: "away", id: s.id }); };
    const gone = () => { if (s.ch && s.m) send({ t: "away", id: s.id }); };   // reloads and closed tabs count as away, not leaving
    document.addEventListener("visibilitychange", hide); window.addEventListener("pagehide", gone);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", gone); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  // back from another app (or the network): make sure we're still in the room, and catch up
  useEffect(() => {
    const back = () => {
      if (document.visibilityState !== "visible" || !s.code || !(s.m || s.friendId)) return;
      try { const rt = sb().realtime; if (!rt.isConnected()) rt.connect(); } catch {}   // don't sit out the socket's reconnect backoff
      const ch = s.ch as unknown as { state?: string } | null;
      if (!ch || ch.state !== "joined") { setReconnecting(true); open(s.code, s.role, current()); }
      else { track(); if (s.m) { setReconnecting(true); sendResume(); } }
    };
    document.addEventListener("visibilitychange", back); window.addEventListener("pageshow", back); window.addEventListener("online", back);
    return () => { document.removeEventListener("visibilitychange", back); window.removeEventListener("pageshow", back); window.removeEventListener("online", back); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  return {
    ui, again, ready, friendName, away, reconnecting,
    debug: () => ({ ch: (s.ch as unknown as { state?: string } | null)?.state ?? null, m: s.m, away: s.away, heard: Date.now() - s.heard, friend: s.friendId, id: s.id }),
    ended: (winner: number) => { s.loser = (winner < 0 ? 1 - s.first : 1 - winner) as 0 | 1; save(); },
    isHost: () => s.role === "host",
    code: () => s.code,
    saved: () => { const v = readSaved(); return v && v.m ? v : null; },
    rejoin: (v: Saved) => open(v.code, v.role, v),
    forget,
    create: () => open(newCode(), "host"),
    join: (code: string) => { const v = readSaved(code); if (v && v.m) open(code, v.role, v); else open(code, "guest"); },
    leave: () => { close(true); forget(); setUi(null); },
    resync,
    dismiss: () => setUi(null),
    // tapping I'm Ready: tell them straight away, keep it in presence too, and let the host check
    markReady: () => { if (s.ready.me || s.m) return; setReady({ ...s.ready, me: true }); send({ t: "ready", id: s.id, ready: true }); track(); hostCheck(); },
    rematch: () => { setAgain({ ...s.again, me: true }); send({ t: "again" }); if (s.role === "host" && s.again.them) begin(s.loser); },
    send,
  };
}


// ── the game ───────────────────────────────────────────────────────────────
export default function KitchenGolf() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("daily");
  const [run, setRun] = useState(0);                 // bump to restart
  const [play, setPlay] = useState<Play>({ kind: "cpu" });
  const [started, setStarted] = useState(false);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [roundCard, setRoundCard] = useState<RoundCard | null>(null);
  const [holeCard, setHoleCard] = useState<HoleCard | null>(null);
  const [intro, setIntro] = useState<Intro | null>(null);
  const [matchEnd, setMatchEnd] = useState<MatchEnd | null>(null);   // live and same-phone matches; winner -1 is a tie
  const [passTo, setPassTo] = useState<string | null>(null);
  const [wins, setWins] = useState([0, 0]);
  const [hud, setHud] = useState<Hud>({ score: 0, hole: 1, round: 1, tot: [0, 0] });
  const [best, setBest] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [board, setBoard] = useState({ w: 0, h: 0 });
  const [menu, setMenu] = useState<null | "friend" | "local">(null);
  const [code, setCode] = useState("");
  const [names, setNames] = useState(["", ""]);
  const [tour, setTour] = useState<string[]>([]);              // today's holes, for the start card
  const shell = useGameShell(GAME, mode);
  const { reset: resetScores } = shell.scores;
  const pausedRef = useRef(false); pausedRef.current = shell.paused;
  const playRef = useRef(play); playRef.current = play;
  const startRef = useRef<() => void>(() => {});
  const nextRef = useRef<() => void>(() => {});
  const passRef = useRef<() => void>(() => {});
  const skipRef = useRef<() => void>(() => {});
  const engineRef = useRef<{ m: number; remote: (msg: GameMsg) => void; snap: () => Snap | null; apply: (sn: Snap) => void; resumed: () => void } | null>(null);
  const pendingSnap = useRef<Snap | null>(null);           // a snapshot to load once the live match it belongs to is set up
  const inbox = useRef<GameMsg[]>([]);
  const nameRef = useRef("Guest"); nameRef.current = shell.player?.name || "Guest";
  const handlers = useRef<RoomHandlers>({ start: () => {}, game: () => {}, left: () => {}, snapshot: () => null, apply: () => {}, resumed: () => {} });
  handlers.current = {
    start: p => { inbox.current = inbox.current.filter(q => q.m >= p.m); pendingSnap.current = null; setMatchEnd(null); setMenu(null); setPlay(p); },
    game: msg => { const e = engineRef.current; if (e && e.m === msg.m) e.remote(msg); else inbox.current.push(msg); },
    left: () => { setMatchEnd(null); setPlay({ kind: "cpu" }); forgetLive(); },
    snapshot: () => engineRef.current?.snap() ?? null,
    apply: sn => {
      const P = playRef.current;
      if (P.kind === "live" && P.m === sn.m && engineRef.current) { engineRef.current.apply(sn); return; }
      pendingSnap.current = sn; setMatchEnd(null); setMenu(null);
      setPlay({ kind: "live", code: roomRef.current.code(), m: sn.m, seed: sn.seed as number, me: roomRef.current.isHost() ? 0 : 1, first: sn.first as 0 | 1, names: sn.names as string[] });
    },
    resumed: () => engineRef.current?.resumed(),
  };
  const room = useRoom(nameRef, handlers);
  const roomRef = useRef(room); roomRef.current = room;
  const awayRef = useRef(false); awayRef.current = !!room.away || room.reconnecting;      // live turn timers stop while either of you is away
  const reconRef = useRef(false); reconRef.current = room.reconnecting;                   // no putting while we catch up
  const [offer, setOffer] = useState<{ saved: Saved; live: SavedLive } | null>(null);     // a match from before a reload
  const [now, setNow] = useState(0);
  useEffect(() => { if (!room.away) return; setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [room.away]);
  const bestKey = mode === "daily" ? `kitchengolf-daily-${torontoDate()}` : "kitchengolf-endless";
  useEffect(() => { setBest(readBest(bestKey)); }, [bestKey]);

  // a shared link (?room=ABCD) joins that room straight away, or picks a saved match back up. Minimising or reloading the
  // page doesn't leave the room (the friend sees "Stepped Away"); only Leave, or leaving the game for another page, does.
  const rejoinNow = (saved: Saved, live: SavedLive) => {
    pendingSnap.current = live.snap; setWins([0, 0]); setMenu(null); setOffer(null); setPlay(live.play); roomRef.current.rejoin(saved);
  };
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? "";
    const saved = roomRef.current.saved(), live = readLive();
    const resumable = !!saved && !!live && live.code === saved.code && live.play.m === saved.m && !(live.snap && live.snap.end != null);
    if (resumable && (!c || c === saved!.code)) { if (c) rejoinNow(saved!, live!); else setOffer({ saved: saved!, live: live! }); }
    else if (/^[A-Z]{4}$/.test(c)) { setWins([0, 0]); roomRef.current.join(c); }
    return () => { roomRef.current.leave(); };
  }, []);

  const playKey = play.kind === "cpu" ? "cpu" : play.kind === "live" ? `live-${play.code}-${play.m}` : `local-${play.m}`;
  useEffect(() => {
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    let scale = 1;
    const { ctx, stop } = fitCanvas(canvas, wrap, VW, VH, s => { setBoard(s); scale = s.w / VW; }, 0);   // no fact strip: the board gets the room
    const imgList = loadImages(FOOD_IMGS), imgs: Record<string, HTMLImageElement> = {};
    FOOD_IMGS.forEach((c, i) => { imgs[c] = imgList[i]; });
    const paints = new Map<string, ReturnType<typeof paintHole>>();
    imgList.forEach(im => im.addEventListener("load", () => paints.clear()));   // redraw the holes once the food pictures arrive
    const paint = (c: Course) => {
      const px = Math.min(3, Math.max(1, scale * (window.devicePixelRatio || 1))), key = `${c.id}${c.mirror ? "m" : ""}@${px.toFixed(2)}`;
      let p = paints.get(key);
      if (!p) { if (paints.size > 2) paints.clear(); p = paintHole(c, px, imgs); paints.set(key, p); }
      return p;
    };
    const P = playRef.current, cpu = P.kind === "cpu", live = P.kind === "live", local = P.kind === "local";
    const me = P.kind === "live" ? P.me : 0, other = 1 - me;
    const pnames = P.kind === "cpu" ? ["You", "Computer"] : P.kind === "live" ? P.names.map((v, i) => (i !== me && v === "Guest" ? "Friend" : v)) : P.names;   // an unnamed friend is "Friend", not "Guest"
    const seed = P.kind === "cpu" ? (mode === "daily" ? dailySeed(0x6017f) : Math.floor(Math.random() * 1e9)) : P.seed;
    const human = (i: number) => (cpu ? i === 0 : live ? i === me : true);
    const label = (i: number) => (cpu || live ? (i === me ? "You" : pnames[i]) : pnames[i]);
    const colorOf = (i: number) => (cpu || live ? (i === me ? BLUE : RED) : i === 0 ? BLUE : RED);
    const mnum = P.kind === "live" ? P.m : 0;
    const brain: Brain = { rnd: mulberry32(seed ^ 0x5eed1), sharp: sharpFor(mode, 1), k: 0 };
    const roundSeed = (r: number) => (seed ^ Math.imul(r, 0x9e3779b1)) | 0;
    let round = 1, holes = pickHoles(roundSeed(1));
    const first = P.kind === "cpu" ? 0 : P.first;
    let course = compile(holes[0].id, holes[0].mirror);
    let st: St = { hole: 0, balls: [], strokes: [0, 0], done: [false, false], cards: [[], []], lead: first, shooter: first, n: 0, clock: 0 };
    let needIntro = true, introHole = -1;   // each hole is introduced once
    function setupHole(i: number, lead: number) {
      course = compile(holes[i].id, holes[i].mirror);
      Object.assign(st, { hole: i, balls: [course.tee.slice(), course.tee.slice()], strokes: [0, 0], done: [false, false], lead, shooter: lead, clock: 0 });
      needIntro = true;
    }
    setupHole(0, first);
    if (cpu) setTour(holes.map(h => HOLES[h.id].name));
    let turnStart = clone(st), ended: number | null = null, counted = false;

    let phase: Phase = "aim", started = !cpu, wait = 0, turnLeft = TURN_MS, acc = 0, clockAcc = 0, pendingAge = 0, lastPass = -1;
    let total = 0, roundPts = 0, allStrokes = 0, realStart = performance.now(), raf = 0, last = performance.now();
    let roll: Roll | null = null, pending: Extract<GameMsg, { t: "done" }> | null = null;
    let plan: Generator<void, { px: number; py: number }> | null = null, planned: { px: number; py: number } | null = null, planClock = 0;
    let shown: { course: Course; balls: number[][]; done: boolean[]; hole: number; strokes: number[] } | null = null;   // the hole just finished, under its scorecard
    let drag: { sx: number; sy: number; px: number; py: number; id: number } | null = null;
    const seen = { x: 0, y: 0, tx: 0, ty: 0, on: false };   // the other player's pull, as last heard (live) or planned (computer)
    let aimSent = "", aimAt = 0, bumpAt = 0, sizzleAt = 0;
    const firstPutt = [true, true];
    const floats: { x: number; y: number; text: string; color: string; age: number; img?: ReturnType<typeof makeFloat> }[] = [];
    const ripples: { x: number; y: number; age: number }[] = [];
    const confetti: { x: number; y: number; vx: number; vy: number; c: string; age: number; r: number; star: boolean }[] = [];
    const puffs: { x: number; y: number; vx: number; vy: number; age: number; r: number }[] = [];   // dust off a wall the ball hits
    const rings: { x: number; y: number; age: number }[] = [];                                      // the plop as a ball drops in
    let banner: { text: string; tone: Tone; age: number; rays: boolean; img: ReturnType<typeof makeBanner> | null } | null = null;   // "Birdie!"
    // the HUD: the band and the turn tab are painted into small canvases only when they change (see ./golf/hud)
    const bandL = new Layer(VW, TOP + 12), tabL = new Layer(TAB_W, TAB_H);
    let tabShape = "", tabAt = -1e9, vignette: HTMLCanvasElement | null = null, ballIcon: { cv: HTMLCanvasElement; px: number } | null = null;
    const pxNow = () => Math.min(3, Math.max(1, scale * (window.devicePixelRatio || 1)));
    let fontOn = false;
    void loadGameFont().then(() => { fontOn = true; bandL.reset(); tabL.reset(); floats.forEach(f => { f.img = undefined; }); });
    let drop: { x: number; y: number; age: number; who: number } | null = null;
    const trail: { x: number; y: number }[] = [];
    // each meatball's turn (for drawing) and where it was last frame
    const quats = [quatIdentity(), rollQuat(quatIdentity(), 3, 5)], lastAt: (number[] | null)[] = [null, null];
    let camY = 0, view = { s: 1, tx: 0, ty: 0 };
    const pushHud = () => setHud({ score: total, hole: shown ? shown.hole : st.hole + 1, round, tot: [sum(st.cards[0]), sum(st.cards[1])] });
    setOver(false); setResult(null); setRoundCard(null); setHoleCard(null); setIntro(null); setToast(null); setPassTo(null); setStarted(!cpu); resetScores(); pushHud();

    const myTurn = () => phase === "aim" && ended === null && human(st.shooter) && (live ? st.shooter === me : true);
    const canAim = () => started && myTurn() && !(pausedRef.current && !live) && !(live && reconRef.current);
    const float = (x: number, y: number, text: string, color: string) => floats.push({ x, y, text, color, age: 0 });
    // a score banner, a moment after the ball drops (so you see it go in first)
    const showBanner = (text: string, tone: Tone, rays: boolean) => { banner = { text, tone, age: -260, rays, img: null }; };
    const send = (msg: Msg) => { if (live) roomRef.current.send(msg); };
    function persist() {
      if (P.kind !== "live") return;
      try { localStorage.setItem(LIVE_KEY, JSON.stringify({ code: P.code, play: P, snap: takeSnap(), t: Date.now() })); } catch {}
    }
    function snapNow() { turnStart = clone(st); persist(); }
    const focusY = () => { const b = roll ? [roll.x, roll.y] : st.balls[st.shooter]; return roll ? b[1] : b[1] * 0.62 + course.cup[1] * 0.38; };
    const camFor = (c: Course, fy: number) => Math.max(0, Math.min(Math.max(0, c.h - VH), fy - (TOP + (VH - TOP) / 2)));

    // a new turn on screen: show the hole first if it's new, pass the phone, let the computer think, or wait for a putt
    function beginTurn() {
      turnLeft = TURN_MS; drag = null; aimSent = ""; Object.assign(seen, { x: 0, y: 0, tx: 0, ty: 0, on: false });
      planned = null; plan = null;
      if (ended !== null) return;
      if (needIntro) {
        needIntro = false; introHole = st.hole; phase = "intro"; wait = INTRO_MS; camY = camFor(course, focusY());
        setIntro({ n: st.hole + 1, name: course.name, par: course.par }); pushHud(); return;
      }
      const s = st.shooter;
      if (local && s !== lastPass) { phase = "pass"; lastPass = s; setPassTo(pnames[s]); }
      else if (cpu && s === 1) { phase = "think"; wait = THINK_MS; planClock = st.clock + THINK_STEPS; plan = aiPlan(course, st.balls[1][0], st.balls[1][1], planClock, brain); seen.on = true; }
      else phase = "aim";
      pushHud();
    }
    passRef.current = () => { if (phase !== "pass") return; SOUND?.unlock(); phase = "aim"; setPassTo(null); };

    function fire(px: number, py: number, c: number) {
      const s = st.shooter, [x, y] = st.balls[s];
      st.clock = c; roll = startRoll(x, y, px, py, c); trail.length = 0; seen.on = false; drag = null;
      if (human(s)) firstPutt[s] = false;
      if (live && s === me) send({ t: "putt", m: mnum, n: st.n, x, y, px, py, c });
      SOUND?.putt(Math.min(1, Math.hypot(px, py) / MAX_PULL));
      phase = "roll"; acc = 0; pending = null; pendingAge = 0;
    }
    function rollEnded() {
      const r = roll!;
      if (r.done === 3) { ripples.push({ x: r.x, y: r.y, age: 0 }); SOUND?.splash(); }
      if (r.done === 2) { drop = { x: r.x, y: r.y, age: 0, who: st.shooter }; SOUND?.cup(); }
      if (live && st.shooter !== me) { if (pending) applyDone(pending); else phase = "await"; return; }
      const res = { x: r.x, y: r.y, r: r.done, c: r.clock };
      if (live) send({ t: "done", m: mnum, n: st.n, ...res });
      applyResult(res);
    }
    function applyDone(msg: Extract<GameMsg, { t: "done" }>) {
      if (msg.r === 2 && !drop && (!roll || roll.done !== 2)) { drop = { x: course.cup[0], y: course.cup[1], age: 0, who: st.shooter }; SOUND?.cup(); }
      applyResult({ x: msg.x, y: msg.y, r: msg.r, c: msg.c });
    }
    function celebrate(s: number, strokes: number, par: number) {
      const [x, y] = course.cup, d = strokes - par;
      showBanner(scoreName(strokes, par), strokes === 1 || d < 0 ? "gold" : d === 0 ? "blue" : "plain", strokes === 1 || d <= -2);
      if (strokes === 1 || d < 0) {
        const cols = ["#e8505b", "#FFD93D", "#3f7fd6", "#2eaa6e", "#FF9A2E", "#ffffff"], n = strokes === 1 ? 56 : 28;
        for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * (strokes === 1 ? 4.5 : 3.2); confetti.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2.5, c: cols[i % cols.length], age: 0, r: 2 + Math.random() * 2.5, star: i % 5 === 0 }); }
        SOUND?.cheer(strokes === 1 || d <= -2);
      } else if (d >= 2 && human(s)) SOUND?.meh();
    }
    // a stroke counts: where the ball ended, the water's extra stroke, picking up after 6
    function applyResult(res: { x: number; y: number; r: number; c: number }) {
      const s = st.shooter; roll = null; pending = null;
      const [bx, by] = st.balls[s];
      if (res.r === 3) { st.strokes[s] += 2; float(bx, by - 26, "Splash! +1 Stroke", "#cfe6ff"); }
      else {
        st.strokes[s] += 1;
        if (res.r === 2) { st.done[s] = true; st.balls[s] = course.cup.slice(); celebrate(s, st.strokes[s], course.par); }
        else st.balls[s] = [res.x, res.y];
      }
      if (!st.done[s] && st.strokes[s] >= MAX_STROKES) { st.done[s] = true; st.strokes[s] = PICKUP; float(st.balls[s][0], st.balls[s][1] - 26, "Picked Up", "#ffffff"); }
      st.clock = res.c;
      advance(s);
    }
    function doPass() {
      const s = st.shooter; st.strokes[s] += 1; drag = null;
      float(st.balls[s][0], st.balls[s][1] - 26, "Time's Up! +1", "#FFE65C");
      if (st.strokes[s] >= MAX_STROKES) { st.done[s] = true; st.strokes[s] = PICKUP; }
      advance(s);
    }
    const cardRows = (): Row[] => (cpu || live ? [me, other] : [0, 1]).map(i => ({ name: label(i), card: st.cards[i].slice(), color: colorOf(i) }));
    function advance(s: number) {
      st.n++;
      if (!(st.done[0] && st.done[1])) {
        st.shooter = st.done[1 - s] ? s : 1 - s;
        snapNow(); phase = "settle"; wait = SETTLE_MS; pushHud(); return;
      }
      // the hole is over: the scorecard shows it while the next hole is set up underneath
      const sc = st.strokes.slice(), par = course.par;
      st.cards[0].push(sc[0]); st.cards[1].push(sc[1]);
      shown = { course, balls: st.balls.map(b => b.slice()), done: [true, true], hole: st.hole + 1, strokes: sc };
      let pts: number | null = null;
      if (cpu) { pts = holePoints(sc[0], par, sc[1]); total += pts; roundPts += pts; }
      const order = cpu || live ? [me, other] : [0, 1];
      setHoleCard({ hole: st.hole + 1, name: course.name, par, results: order.map(i => ({ name: label(i), strokes: sc[i], color: colorOf(i) })), pts, pars: holes.map(h => HOLES[h.id].par), rows: cardRows() });
      if (st.hole < ROUND_HOLES - 1) setupHole(st.hole + 1, sc[0] < sc[1] ? 0 : sc[1] < sc[0] ? 1 : 1 - st.lead);   // lower score putts first; a tie swaps
      else if (!cpu) { const a = sum(st.cards[0]), b = sum(st.cards[1]); ended = a < b ? 0 : b < a ? 1 : -1; }
      snapNow(); phase = "holeEnd"; wait = HOLE_MS; pushHud();
    }
    skipRef.current = () => { if ((phase === "holeEnd" || phase === "intro") && !live) wait = Math.min(wait, phase === "intro" ? 350 : 0); };
    function afterHoleCard() {
      setHoleCard(null); shown = null; pushHud();
      if (ended !== null) { finishMatch(); return; }
      if (cpu && st.cards[0].length >= ROUND_HOLES) { endRound(); return; }
      beginTurn();
    }
    function finishMatch() {
      phase = "over"; drag = null;
      if (counted) return; counted = true;
      const w = ended!;
      if (live) roomRef.current.ended(w);
      setWins(v => (w < 0 ? v : v.map((x, i) => (i === w ? x + 1 : x))));
      setMatchEnd({ winner: w, tot: [sum(st.cards[0]), sum(st.cards[1])], cards: st.cards.map(c => c.slice()), pars: holes.map(h => HOLES[h.id].par) });
      persist();
    }
    function endRound() {
      const a = sum(st.cards[0]), b = sum(st.cards[1]), bonus = a < b ? WIN_BONUS : a === b ? TIE_BONUS : 0;
      total += bonus; roundPts += bonus; pushHud();
      if (mode === "daily") finish(a < b ? "won" : a === b ? "tie" : "lost");
      else if (a <= b) { phase = "between"; setRoundCard({ round, won: a < b, tie: a === b, points: roundPts, you: a, cpu: b }); }
      else finish("lost");
    }
    function nextRound() {
      if (phase !== "between") return;
      allStrokes += sum(st.cards[0]); round++; holes = pickHoles(roundSeed(round)); brain.sharp = sharpFor(mode, round); roundPts = 0;
      st.cards = [[], []]; setupHole(0, 0); floats.length = 0; banner = null; setRoundCard(null); beginTurn(); pushHud();
    }
    nextRef.current = nextRound;
    function finish(kind: Result["kind"]) {
      phase = "over";
      const pars = holes.map(h => HOLES[h.id].par);
      setToast(FACTS[Math.floor(Math.random() * FACTS.length)]);
      setResult({ kind, you: sum(st.cards[0]), cpu: sum(st.cards[1]), par: sum(pars), card: st.cards[0].slice(), cpuCard: st.cards[1].slice(), pars, rounds: round });
      pushHud(); setOver(true);
      if (total > readBest(bestKey)) { saveBest(bestKey, total); setBest(total); }
      shell.finishRef.current({ score: total, drops: allStrokes + sum(st.cards[0]), ms: performance.now() - realStart });
    }
    startRef.current = () => { if (started) return; SOUND?.unlock(); started = true; realStart = performance.now(); setStarted(true); beginTurn(); };

    // ── live: messages from the friend, held until the game is ready for them; snapshots for catching up ──
    const mail: GameMsg[] = [];
    let loaded = false;
    function pump() {
      for (let k = 0; k < mail.length; k++) {
        const msg = mail[k];
        if (msg.n < st.n) { mail.splice(k--, 1); continue; }
        if (msg.n !== st.n || st.shooter === me || ended !== null) continue;
        if (msg.t === "putt" && phase === "aim") { mail.splice(k--, 1); st.balls[st.shooter] = [msg.x, msg.y]; fire(msg.px, msg.py, msg.c); }
        else if (msg.t === "pass" && phase === "aim") { mail.splice(k--, 1); doPass(); }
        else if (msg.t === "done" && phase === "roll") { mail.splice(k--, 1); pending = msg; pendingAge = 0; }
        else if (msg.t === "done" && (phase === "await" || phase === "aim")) { mail.splice(k--, 1); applyDone(msg); }
      }
    }
    function takeSnap(): Snap | null {
      if (P.kind !== "live") return null;
      return { m: P.m, p: ended !== null ? 1e5 : turnStart.n, seed: P.seed, first: P.first, names: P.names, st: turnStart, end: ended };
    }
    function loadSnap(sn: Snap) {
      const s2 = sn.st as St;
      if (sn.end == null && ended === null && s2.n === st.n && st.shooter === me && phase === "roll") return;   // my putt is rolling: I finish it and send where it stopped
      const prevHole = st.hole;
      st = clone(s2); course = compile(holes[st.hole].id, holes[st.hole].mirror);
      roll = null; pending = null; drag = null; shown = null; drop = null; setHoleCard(null); setIntro(null);
      for (let k = mail.length - 1; k >= 0; k--) if (mail[k].n < st.n) mail.splice(k, 1);
      turnStart = clone(st);
      needIntro = st.hole !== introHole; void prevHole;
      if (sn.end != null) { ended = sn.end as number; finishMatch(); }
      else { ended = null; counted = false; setMatchEnd(null); beginTurn(); persist(); }
      pushHud();
    }
    // after a break: if we were watching the friend's putt roll, it may never finish here; their "done" (or snapshot) settles it
    function resumed() { if (live && ended === null && st.shooter !== me && (phase === "roll" || phase === "await")) { roll = null; pending = null; phase = "aim"; } }
    if (P.kind === "live") {
      engineRef.current = { m: P.m, snap: takeSnap, apply: loadSnap, resumed, remote: msg => {
        if (msg.t !== "aim" && msg.t !== "aimEnd") { mail.push(msg); if (msg.n > st.n + (phase === "settle" || phase === "holeEnd" ? 1 : 0)) roomRef.current.resync(); return; }
        if (msg.n !== st.n || st.shooter === me || phase !== "aim") return;   // aim is just for show: drop anything stale
        if (msg.t === "aim") Object.assign(seen, { tx: msg.px, ty: msg.py, on: true }); else Object.assign(seen, { tx: 0, ty: 0 });
      } };
      inbox.current = inbox.current.filter(q => { if (q.m === P.m) { mail.push(q); return false; } return q.m > P.m; });
      if (pendingSnap.current && pendingSnap.current.m === P.m) { const sn = pendingSnap.current; pendingSnap.current = null; loadSnap(sn); loaded = true; }
      else persist();
    } else engineRef.current = null;

    // ── input: drag back anywhere on the board ──
    const onDown = (e: PointerEvent) => {
      SOUND?.unlock();
      if (drag || !canAim()) return;
      const r = canvas.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * VW, y = ((e.clientY - r.top) / r.height) * VH;
      drag = { sx: x, sy: y, px: 0, py: 0, id: e.pointerId };
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const r = canvas.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * VW, y = ((e.clientY - r.top) / r.height) * VH;
      let px = (x - drag.sx) * GAIN, py = (y - drag.sy) * GAIN;
      const l = Math.hypot(px, py); if (l > MAX_PULL) { px = (px / l) * MAX_PULL; py = (py / l) * MAX_PULL; }
      drag.px = px; drag.py = py;
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      onMove(e); const d = drag; drag = null;
      if (!canAim() || Math.hypot(d.px, d.py) < MIN_PULL) { aimEnd(); return; }
      fire(Math.round(d.px * 100) / 100, Math.round(d.py * 100) / 100, st.clock);
    };
    const onCancel = () => { if (drag) aimEnd(); drag = null; };
    function aimEnd() { if (live && st.shooter === me && phase === "aim") { send({ t: "aimEnd", m: mnum, n: st.n }); aimSent = "0,0"; } }
    function sendAim(t: number) {
      if (!live || st.shooter !== me || phase !== "aim" || !drag || t - aimAt < 160) return;
      const k = `${Math.round(drag.px)},${Math.round(drag.py)}`; if (k === aimSent) return;
      const [px, py] = k.split(",").map(Number); aimSent = k; aimAt = t;
      send({ t: "aim", m: mnum, n: st.n, px, py });
    }
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onCancel);
    if (!loaded && !cpu) beginTurn();
    camY = camFor(course, focusY());

    /* TEST-HOOK-START */ if (new URLSearchParams(window.location.search).has("debug")) (window as unknown as { __golf: unknown }).__golf = {
      room: () => roomRef.current.debug(),
      state: () => ({ phase, n: st.n, hole: st.hole, holeId: holes[st.hole].id, shooter: st.shooter, me, balls: st.balls, strokes: st.strokes, done: st.done, cards: st.cards, ended, total,
        clock: st.clock, turnLeft, seen: seen.on ? [Math.round(seen.x), Math.round(seen.y)] : null, dragging: !!drag, holes: holes.map(h => h.id), camY: Math.round(camY), roll: roll ? [Math.round(roll.x), Math.round(roll.y)] : null }),
      show: (id: number, mirror = false) => { holes[st.hole] = { id, mirror }; setupHole(st.hole, st.shooter); needIntro = false; snapNow(); beginTurn(); camY = camFor(course, focusY()); },
      aim: () => { const s = st.shooter, g = aiPlan(course, st.balls[s][0], st.balls[s][1], st.clock + 30, null); let r; while (!(r = g.next()).done); return r.value; },
      screen: (i: number) => { const b = roll && i === st.shooter ? [roll.x, roll.y] : st.balls[i]; return [(b[0] * view.s + view.tx) * scale, (b[1] * view.s + view.ty) * scale, BALL_R * view.s * scale]; },
    }; /* TEST-HOOK-END */

    const loop = (t: number) => {
      const dt = Math.max(0, Math.min(100, t - last)); last = t;
      const frozen = !started || (!live && pausedRef.current);
      if (!live && pausedRef.current) drag = null;
      if (!frozen) {
        if (live) pump();
        if (phase === "roll" && roll) {
          acc += dt; let n = 0;
          while (acc >= STEP && n < 8 && roll && !roll.done) {
            acc -= STEP; n++; stepRoll(course, roll); st.clock = roll.clock;
            if (roll.ev & 1 && t - bumpAt > 70) { SOUND?.bump(roll.hit); bumpAt = t; if (roll.hit > 1.1) puff(roll); }
            if (roll.ev & 2) SOUND?.tube();
            if (roll.ev & 8 && t - sizzleAt > 500) { SOUND?.sizzle(); sizzleAt = t; }
            if (!roll.tube && roll.steps % 2 === 0) { trail.push({ x: roll.x, y: roll.y }); if (trail.length > 12) trail.shift(); }
          }
          if (n >= 8) acc = 0;
          if (roll && roll.done) rollEnded();
          else if (pending && (pendingAge += dt) > 2500) applyDone(pending);   // way behind: catch up
        } else {
          clockAcc += dt; while (clockAcc >= STEP) { clockAcc -= STEP; st.clock++; }   // the mixer, rolling pin, doors and burners keep going
          if (phase === "intro") { wait -= dt; if (wait <= 0) { setIntro(null); beginTurn(); } }
          else if (phase === "think") {
            wait -= dt;
            if (plan) { const t0 = performance.now(); while (plan && performance.now() - t0 < 8) { const r = plan.next(); if (r.done) { planned = r.value; plan = null; } } }
            const tgt = planned ?? { px: 0, py: 0 }, k = planned ? Math.min(1, Math.max(0, 1.6 * (1 - wait / THINK_MS) - 0.3)) : 0, e = k * k * (3 - 2 * k);
            seen.tx = tgt.px * e + Math.sin(t / 160) * 10 * (1 - e) + (1 - e) * 20; seen.ty = tgt.py * e + Math.cos(t / 200) * 8 * (1 - e) + (1 - e) * 20;
            if (wait <= 0 && planned) fire(planned.px, planned.py, planClock);
          } else if (phase === "settle") { wait -= dt; if (wait <= 0) beginTurn(); }
          else if (phase === "holeEnd") { wait -= dt; if (wait <= 0) afterHoleCard(); }
          else if (phase === "aim" && live) {
            sendAim(t);
            if (!awayRef.current) turnLeft -= dt;                       // paused while either of you is away
            if (turnLeft <= 0 && st.shooter === me && !reconRef.current) { send({ t: "pass", m: mnum, n: st.n }); doPass(); }
          } else if (phase === "await") pendingAge += dt;
        }
        const ease = Math.min(1, dt / 110); seen.x += (seen.tx - seen.x) * ease; seen.y += (seen.ty - seen.y) * ease;
        for (let k = floats.length - 1; k >= 0; k--) { floats[k].age += dt; if (floats[k].age > 1300) floats.splice(k, 1); }
        for (let k = ripples.length - 1; k >= 0; k--) { ripples[k].age += dt; if (ripples[k].age > 800) ripples.splice(k, 1); }
        for (let k = confetti.length - 1; k >= 0; k--) { const p = confetti[k]; p.age += dt; p.x += p.vx * dt / 16; p.y += p.vy * dt / 16; p.vy += 0.12 * dt / 16; p.vx *= 0.985; if (p.age > 1600) confetti.splice(k, 1); }
        for (let k = puffs.length - 1; k >= 0; k--) { const p = puffs[k]; p.age += dt; p.x += p.vx * dt / 16; p.y += p.vy * dt / 16; p.vx *= 0.9; p.vy *= 0.9; if (p.age > 380) puffs.splice(k, 1); }
        for (let k = rings.length - 1; k >= 0; k--) { rings[k].age += dt; if (rings[k].age > 480) rings.splice(k, 1); }
        if (banner) { banner.age += dt; if (banner.age > BANNER_MS) banner = null; }
        if (drop) { drop.age += dt; if (drop.age > 420) { rings.push({ x: drop.x, y: drop.y, age: 0 }); drop = null; } }
      }
      // the camera: the whole hole while it's introduced, then following the play (only tall holes move)
      const c = shown ? shown.course : course;
      if (!shown) camY += (camFor(course, focusY()) - camY) * Math.min(1, dt / 260);
      if (phase === "intro") { const k = Math.max(0, Math.min(1, (1 - wait / INTRO_MS - 0.35) / 0.6)), e = k * k * (3 - 2 * k); view = { s: 1, tx: 0, ty: -camY * e }; }   // from the cup down to the tee
      else view = { s: 1, tx: 0, ty: -camY };
      // each meatball turns by how far it moved since last frame
      for (let i = 0; i < 2; i++) {
        const b = roll && i === st.shooter && !shown ? (roll.tube ? null : [roll.x, roll.y]) : st.balls[i];
        if (!b) continue;
        const l = lastAt[i]; if (l) { const dx = b[0] - l[0], dy = b[1] - l[1]; if (Math.abs(dx) + Math.abs(dy) < 40) quats[i] = rollQuat(quats[i], dx, dy); }
        lastAt[i] = [b[0], b[1]];
      }
      draw(t, c);
      raf = requestAnimationFrame(loop);
    };

    // ── drawing ──
    const rr = (x: number, y: number, ww: number, hh: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, ww, hh, r); };
    // a little dust where the ball meets a wall (it has already bounced, so it's heading away from the wall)
    function puff(r: Roll) {
      if (puffs.length > 36) return;
      const sp = Math.hypot(r.vx, r.vy) || 1, ux = r.vx / sp, uy = r.vy / sp, cx = r.x - ux * BALL_R, cy = r.y - uy * BALL_R, base = Math.atan2(uy, ux), n = r.hit > 4 ? 6 : 4;
      for (let j = 0; j < n; j++) { const a = base + (Math.random() - 0.5) * 2.6, v = 0.35 + Math.random() * 0.9 * Math.min(1, r.hit / 5); puffs.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, r: 1.8 + Math.random() * 2 }); }
    }
    function drawPutter(x: number, y: number, px: number, py: number, alpha: number) {
      const l = Math.hypot(px, py); if (l < 2) return;
      const dx = -px / l, dy = -py / l, pw = Math.min(1, l / MAX_PULL), back = BALL_R + 6 + 26 * pw, hx = x - dx * back, hy = y - dy * back, k = pxNow();
      ctx.globalAlpha = alpha; ctx.lineCap = "round";
      ctx.shadowColor = "rgba(30,20,10,0.32)"; ctx.shadowBlur = 4 * k; ctx.shadowOffsetX = 3 * k; ctx.shadowOffsetY = 4 * k;
      ctx.strokeStyle = "#c9d0d8"; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - dx * 34 - dy * 14, hy - dy * 34 + dx * 14); ctx.stroke();
      ctx.strokeStyle = NAVY; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.moveTo(hx - dx * 25 - dy * 10.5, hy - dy * 25 + dx * 10.5); ctx.lineTo(hx - dx * 34 - dy * 14, hy - dy * 34 + dx * 14); ctx.stroke();
      ctx.strokeStyle = "#3a4250"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(hx - dy * 10, hy + dx * 10); ctx.lineTo(hx + dy * 10, hy - dx * 10); ctx.stroke();
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      ctx.strokeStyle = "#8d97a6"; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(hx - dy * 8.5 - dx * 1.6, hy + dx * 8.5 - dy * 1.6); ctx.lineTo(hx + dy * 8.5 - dx * 1.6, hy - dx * 8.5 - dy * 1.6); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // the aim guide: dots that shrink as they go, stopping at the first wall
    function aimDots(c: Course, x: number, y: number, px: number, py: number) {
      const l = Math.hypot(px, py); if (l < MIN_PULL) return;
      const dx = -px / l, dy = -py / l, len = 30 + 92 * Math.min(1, l / MAX_PULL), s0 = BALL_R + 8;
      ctx.strokeStyle = "rgba(14,31,69,0.55)"; ctx.lineWidth = 1.3; ctx.fillStyle = "#ffffff";
      for (let s = s0; s < len; s += 9) {
        const qx = x + dx * s, qy = y + dy * s;
        if (c.segs.some(g => segDist2(qx, qy, g) < 12) || c.bumps.some(u => (qx - u.x) * (qx - u.x) + (qy - u.y) * (qy - u.y) < u.r * u.r)) break;   // stops at the first wall
        const u = (s - s0) / Math.max(1, len - s0);
        ctx.globalAlpha = 1 - 0.55 * u; ctx.beginPath(); ctx.arc(qx, qy, 4.3 - 2.5 * u, 0, 7); ctx.fill(); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    const backOut = (k: number) => { const c1 = 1.4, c3 = c1 + 1, q = k - 1; return 1 + c3 * q * q * q + c1 * q * q; };

    function draw(t: number, c: Course) {
      const px = pxNow();
      ctx.save(); ctx.clearRect(0, 0, VW, VH);
      rr(0, 0, VW, VH, 22); ctx.clip();
      ctx.fillStyle = "#2b2f35"; ctx.fillRect(0, 0, VW, VH);
      const view0 = view, viewB = shown ? { course: shown.course, balls: shown.balls, done: shown.done, hole: shown.hole, strokes: shown.strokes } : { course, balls: st.balls, done: st.done, hole: st.hole + 1, strokes: st.strokes };
      const p = paint(c), clock = roll ? roll.clock : st.clock;
      ctx.save(); ctx.translate(view0.tx, view0.ty); ctx.scale(view0.s, view0.s);
      ctx.drawImage(p.under, 0, 0, W, c.h);
      drawLive(ctx, c, partsAt(c, clock), clock, t);
      for (const r of ripples) { const k = r.age / 800; ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 2.5; for (const f of [1, 0.6]) { ctx.beginPath(); ctx.arc(r.x, r.y, 4 + k * 30 * f, 0, 7); ctx.stroke(); } }
      for (const r of rings) { const k = r.age / 480; ctx.strokeStyle = `rgba(255,255,255,${0.85 * (1 - k)})`; ctx.lineWidth = 3 * (1 - k) + 0.5; ctx.beginPath(); ctx.arc(r.x, r.y, CUP_R + 2 + k * 16, 0, 7); ctx.stroke(); }
      for (const q of puffs) { const k = q.age / 380; ctx.fillStyle = `rgba(255,250,238,${0.7 * (1 - k)})`; ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1 + k * 1.6), 0, 7); ctx.fill(); }
      const ballAt = (i: number) => (roll && i === st.shooter && !shown ? [roll.x, roll.y] : viewB.balls[i]);
      const near = [0, 1].some(i => !viewB.done[i] && Math.hypot(ballAt(i)[0] - c.cup[0], ballAt(i)[1] - c.cup[1] + 20) < 32);
      if (drop) {   // dropping into the cup: shrinking and going dark, inside the hole
        const k = Math.min(1, drop.age / 420), e = k * k;
        ctx.save(); ctx.beginPath(); ctx.arc(c.cup[0], c.cup[1], CUP_R - 0.6, 0, 7); ctx.clip();
        drawMeatball(ctx, c.cup[0] + (drop.x - c.cup[0]) * (1 - k), c.cup[1] + (drop.y - c.cup[1]) * (1 - k) + e * 1.5, BALL_R * (1 - e * 0.45), quats[drop.who], 1);
        ctx.fillStyle = `rgba(0,0,0,${0.8 * e})`; ctx.fillRect(c.cup[0] - CUP_R, c.cup[1] - CUP_R, CUP_R * 2, CUP_R * 2);
        ctx.restore();
      }
      // the waiting ball first, faded; the one putting on top
      const active = shown ? -1 : st.shooter, order = active === 0 ? [1, 0] : [0, 1];
      for (const i of order) {
        if (viewB.done[i] && !(roll && i === active)) continue;
        if (roll && i === active && roll.done === 2) continue;
        const mine = i === active;
        if (mine && roll && roll.tube) {                                // inside the paper towel tube: a little bump moving along it
          const [tx, ty] = tubePos(c, roll); ctx.fillStyle = "rgba(255,240,215,0.45)"; ctx.beginPath(); ctx.ellipse(tx, ty, 9, 9, 0, 0, 7); ctx.fill(); continue;
        }
        const [x, y] = ballAt(i);
        if (mine && roll && trail.length > 1) {                         // a short streak behind it when it's going fast
          const sp = Math.hypot(roll.vx, roll.vy), f = Math.min(1, (sp - 3) / 4);
          if (f > 0) {                                                  // one tapered shape from the tail up to the ball, fading out behind
            const pts = [...trail.slice(-5), { x, y }], n = pts.length, L: number[][] = [], R: number[][] = [];
            pts.forEach((q, j) => {
              const a = pts[Math.max(0, j - 1)], b = pts[Math.min(n - 1, j + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, w = BALL_R * 0.92 * (j / (n - 1));
              L.push([q.x - (dy / d) * w, q.y + (dx / d) * w]); R.push([q.x + (dy / d) * w, q.y - (dx / d) * w]);
            });
            const g = ctx.createLinearGradient(pts[0].x, pts[0].y, x, y); g.addColorStop(0, "rgba(255,243,223,0)"); g.addColorStop(1, `rgba(255,243,223,${0.42 * f})`);
            ctx.fillStyle = g; ctx.beginPath(); L.forEach(([px2, py2], j) => (j ? ctx.lineTo(px2, py2) : ctx.moveTo(px2, py2))); for (let j = n - 1; j >= 0; j--) ctx.lineTo(R[j][0], R[j][1]); ctx.closePath(); ctx.fill();
          }
        }
        drawMeatball(ctx, x, y, BALL_R, quats[i], mine || shown ? 1 : 0.55, colorOf(i));
      }
      // aiming: yours (dots, putter and power), or theirs (putter only, never the line)
      if (!shown && phase !== "over" && phase !== "intro") {
        const [bx, by] = st.balls[st.shooter];
        if (drag && canAim()) { drawPutter(bx, by, drag.px, drag.py, 1); aimDots(c, bx, by, drag.px, drag.py); }
        else if (!local && seen.on && st.shooter !== me && (phase === "aim" || phase === "think")) drawPutter(bx, by, seen.x, seen.y, 0.9);
      }
      if (p.over) ctx.drawImage(p.over, 0, 0, W, c.h);
      drawFlag(ctx, c, near, t, viewB.hole, GAME_FONT);
      for (const q of confetti) {
        const a = Math.max(0, 1 - q.age / 1600);
        if (q.star) { drawSparkle(ctx, q.x, q.y, q.r * 1.6, a, "#FFF3A0"); continue; }
        ctx.globalAlpha = a; ctx.fillStyle = q.c; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.age / 120 + q.r); rr(-q.r, -q.r * 0.5, q.r * 2, q.r, q.r * 0.3); ctx.fill(); ctx.restore();
      }
      ctx.globalAlpha = 1;
      for (const f of floats) {                                         // little words float up and fade
        if (!f.img) f.img = makeFloat(f.text, f.color, px);
        const a = Math.max(0, Math.min(1, (1 - f.age / 1300) * 1.6)), pop = Math.min(1, f.age / 140), s = 0.7 + 0.3 * backOut(pop);
        const fx = Math.max(f.img.w / 2 + 6, Math.min(VW - f.img.w / 2 - 6, f.x)), fy = f.y - f.age * 0.025;
        ctx.globalAlpha = a; ctx.save(); ctx.translate(fx, fy); ctx.scale(s, s); ctx.drawImage(f.img.cv, -f.img.w / 2, -f.img.h * 0.68, f.img.w, f.img.h); ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // the vignette, so the course pops
      if (!vignette) vignette = makeVignette(VW, VH);
      ctx.drawImage(vignette, 0, 0, VW, VH);

      // the score banner: pops in under the band, calmly, then fades (below the scorecard when that's showing)
      if (banner && banner.age >= 0) {
        if (!banner.img) banner.img = makeBanner(banner.text, banner.tone, px);
        const a = banner.age, k = Math.min(1, a / 240), s = a < 240 ? 0.3 + 0.7 * backOut(k) : 1, fade = a > BANNER_MS - 380 ? Math.max(0, (BANNER_MS - a) / 380) : 1;
        const cy = c.cup[1] * view.s + view.ty, y = shown ? VH * 0.8 : Math.max(TOP + 92, Math.min(VH - 96, cy + 78));
        if (banner.rays) drawRays(ctx, VW / 2, y - 14, 160, a / 2400, 0.45 * fade * k);
        if (banner.tone === "gold") for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + 0.4, d = (banner.img.w * 0.42 + 14) * (0.6 + 0.4 * k), tw = 0.5 + 0.5 * Math.sin(a / 140 + i * 1.7);
          drawSparkle(ctx, VW / 2 + Math.cos(ang) * d, y - 14 + Math.sin(ang) * d * 0.45, (4 + 3 * tw) * k, fade * (0.5 + 0.5 * tw));
        }
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(VW / 2, y - (1 - fade) * 10); ctx.scale(s, s);
        ctx.drawImage(banner.img.cv, -banner.img.w / 2, -banner.img.h * 0.66, banner.img.w, banner.img.h); ctx.restore();
      }

      // the band at the top: hole and par, each player's chip and strokes, and the tab underneath for whose turn it is
      // (or your power while you drag)
      const sides = cpu || live ? [me, other] : [0, 1], vs = viewB.strokes;
      const inPlay = started && !shown && phase !== "over" && phase !== "between" && phase !== "intro";
      const band: Band = { hole: viewB.hole, par: c.par, place: c.name, chips: sides.map(i => ({
        name: label(i), strokes: vs[i], done: viewB.done[i], picked: viewB.done[i] && vs[i] >= PICKUP, color: colorOf(i), active: inPlay && st.shooter === i && !st.done[i] })) };
      ctx.drawImage(bandL.get(px, bandKey(band) + (fontOn ? "" : "~"), g => paintBand(g, band, TOP, VW, px, ballSprite(px))), 0, 0, VW, TOP + 12);
      let tab: Tab | null = null;
      if (drag && canAim()) tab = { kind: "power", text: "", color: "", power: Math.min(1, Math.hypot(drag.px, drag.py) / MAX_PULL) };
      else if (inPlay) {
        const s = st.shooter, aiming = !local && s !== me && (phase === "think" || (seen.on && Math.hypot(seen.tx, seen.ty) >= MIN_PULL && phase === "aim"));
        const nm = (cpu ? "Computer" : pnames[s]).slice(0, 9);
        const yours = human(s) && !local, waiting = st.done[me] && !local && s !== me;
        const whose = aiming ? `${nm} Aiming...` : waiting ? `Waiting For ${nm}` : yours ? "Your Turn" : `${nm}'s Turn`;
        tab = { kind: !aiming && !waiting && yours ? "you" : waiting && !aiming ? "wait" : "them", text: whose, color: colorOf(s),
          ...(live && phase === "aim" ? { secs: Math.max(0, Math.ceil(turnLeft / 1000)), frac: Math.max(0, turnLeft) / TURN_MS } : {}) };
      }
      if (tab) {
        const shape = tab.kind === "power" ? "power" : `${tab.kind}|${tab.text}`;
        if (shape !== tabShape) { if (shape !== "power" && tabShape !== "power") tabAt = t; tabShape = shape; }
        const k = Math.min(1, (t - tabAt) / 280), s = k < 1 ? 0.55 + 0.45 * backOut(k) : 1, tb = tab;
        const img = tabL.get(px, tabKey(tb) + (fontOn ? "" : "~"), g => paintTab(g, tb, px));
        ctx.save(); ctx.translate(VW / 2, TOP + 10); ctx.scale(s, s); ctx.drawImage(img, -TAB_W / 2, -19, TAB_W, TAB_H); ctx.restore();
      } else tabShape = "";
      // the first putt: show what to do
      if (myTurn() && started && !drag && firstPutt[local ? st.shooter : me] && st.hole === 0 && (!cpu || round === 1)) {
        const by = st.balls[st.shooter][1] * view.s + view.ty, y0 = by > 400 ? by - 175 : Math.min(VH - 100, by + 50);
        drawHint(ctx, VW / 2, y0, t);
      }
      ctx.restore();
      // a navy edge round the whole board, the same as the band
      ctx.strokeStyle = NAVY; ctx.lineWidth = 3; rr(1.5, 1.5, VW - 3, VH - 3, 20.5); ctx.stroke();
    }
    // the players' little meatball, for their chips in the band (drawn once)
    function ballSprite(px: number) {
      if (!ballIcon || ballIcon.px !== px) {
        const cv = document.createElement("canvas"); cv.width = Math.ceil(22 * px); cv.height = Math.ceil(22 * px);
        const g = cv.getContext("2d")!; g.scale(px, px); drawMeatball(g, 10.5, 10.5, 8.4, rollQuat(quatIdentity(), 4, 7), 1);
        ballIcon = { cv, px };
      }
      return ballIcon.cv;
    }

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); stop();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onCancel);
      engineRef.current = null;
    };
  }, [mode, run, playKey, bestKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  const n = dailyNumber(LAUNCH);
  const isCpu = play.kind === "cpu", isLive = play.kind === "live", isLocal = play.kind === "local";
  const me = play.kind === "live" ? play.me : 0;
  const pn = play.kind === "cpu" ? ["You", "Computer"] : play.names;
  const friend = play.kind === "live" ? (play.names[1 - me] === "Guest" ? "Your Friend" : play.names[1 - me]) : "";
  const headline = !result ? "" : mode === "daily"
    ? (result.kind === "won" ? `You Beat The Computer By ${result.cpu - result.you}!` : result.kind === "tie" ? "Tied With The Computer" : `The Computer Won By ${result.you - result.cpu}`)
    : `${result.rounds - 1} Round${result.rounds === 2 ? "" : "s"} Won, Lost Round ${result.rounds}`;
  const toPar = (s: number, par: number) => (s === par ? "Even Par" : s < par ? `${par - s} Under Par` : `${s - par} Over Par`);
  const share = () => {
    if (!result) return;
    const label = mode === "daily" ? `Kitchen Golf #${n} (Today's Challenge)` : "Kitchen Golf (Free Play)";
    const p = shell.scores.posted;
    const rank = p?.rank ? `\n🏆 #${p.rank} of ${p.total} ${mode === "daily" ? "today" : "this week"}` : "";
    const how = mode === "daily" ? (result.kind === "won" ? `Beat the computer ${result.you} to ${result.cpu}` : result.kind === "tie" ? `Tied the computer at ${result.you}` : `Lost to the computer ${result.you} to ${result.cpu}`)
      : `${result.rounds - 1} rounds won`;
    const sq = result.card.map((s, i) => versus(s, result.pars[i])).join(""), keys = result.card.map(s => KEYCAP[s]).join("");
    shell.share(`${label}\n${hud.score.toLocaleString()} pts · ${result.you} strokes (par ${result.par})\n${how}${rank}\n${sq}\n${keys}\nCan you beat it? whatyouate.app/games/kitchen-golf`);
  };
  const toCpu = () => { if (isLive || room.ui) room.leave(); forgetLive(); setOffer(null); setMatchEnd(null); setMenu(null); setPlay({ kind: "cpu" }); setRun(r => r + 1); };
  const openRoom = () => { setWins([0, 0]); setMenu(null); room.create(); };
  const joinRoom = () => { if (code.length === 4) { setWins([0, 0]); setMenu(null); room.join(code); } };
  const startLocal = () => {
    const nm = names.map((v, i) => v.trim().slice(0, 12) || `Player ${i + 1}`);
    SOUND?.unlock(); setWins([0, 0]); setMenu(null); setMatchEnd(null);
    setPlay({ kind: "local", m: 1, seed: Math.floor(Math.random() * 1e9), first: 0, names: nm });
  };
  const localRematch = () => {
    if (play.kind !== "local" || !matchEnd) return;
    const first = (matchEnd.winner < 0 ? 1 - play.first : 1 - matchEnd.winner) as 0 | 1;   // the loser putts first
    setMatchEnd(null); setPlay({ ...play, m: play.m + 1, seed: Math.floor(Math.random() * 1e9), first });
  };
  const shareRoom = (c: string) => shell.share(`Play Kitchen Golf with me! Room ${c}: ${window.location.origin}/games/kitchen-golf?room=${c}`);
  const rui = room.ui;
  const playing = isCpu ? started && !over && !roundCard : isLocal ? !matchEnd : false;
  const awayLeft = room.away ? Math.max(0, Math.ceil((room.away - (now || Date.now())) / 1000)) : 0;
  // whose putt it is right now in a live match, for the Stepped Away card (we can keep putting on our own turn)
  const liveState = () => (engineRef.current?.snap()?.st as St | undefined);
  const theirTurn = isLive && (() => { const s2 = liveState(); return !s2 || s2.shooter !== me || matchEnd !== null; })();
  const cardNames = (i: number) => (isLive ? (i === me ? "You" : friend) : pn[i]);

  return (
    <GameScreen>
      <style>{KG_CSS}</style>
      <GameHeader title="Kitchen Golf" mode={mode} onMode={m => { toCpu(); setMode(m); }} onBoard={() => shell.setBoardOpen(true)} onHelp={shell.help.show} />

      {/* the kit's score row height, so the sound button sits where it does in every game */}
      <div className="mt-2 flex h-[40px] shrink-0 items-center justify-between">
        {isCpu ? (<>
          <div><div className="text-[10px] font-semibold uppercase tracking-wide text-[#5a6b85]">Score</div><div className="kg-f text-[28px] leading-none tabular-nums text-[#101B2E]">{hud.score.toLocaleString()}</div></div>
          <div className="kg-f kg-ribbon rounded-full px-3 py-1 text-[13px] text-white">
            {mode === "daily" ? `Hole ${hud.hole} Of 9` : `Round ${hud.round} · Hole ${hud.hole}`} <span className="text-white/80">· {hud.tot[0]}-{hud.tot[1]}</span>
          </div>
        </>) : (<>
          <div className="min-w-0"><div className="truncate text-[10px] font-semibold uppercase tracking-wide text-[#5a6b85]">{isLive ? "You" : pn[0]}</div><div className="kg-f text-[28px] leading-none tabular-nums text-[#101B2E]">{hud.tot[isLive ? me : 0]}</div></div>
          <div className="kg-f kg-ribbon rounded-full px-3 py-1 text-[13px] text-white">{play.kind === "live" ? <>Live <span className="text-white/80">· Room {play.code}</span></> : "Same Phone"}</div>
        </>)}
        <div className="flex items-center gap-1.5">
          {isCpu ? <div className="mr-1 text-right"><div className="text-[10px] font-semibold uppercase tracking-wide text-[#5a6b85]">Best</div><div className="kg-f text-[20px] leading-none tabular-nums text-[#101B2E]">{best.toLocaleString()}</div></div>
            : <div className="mr-1 min-w-0 text-right"><div className="max-w-[96px] truncate text-[10px] font-semibold uppercase tracking-wide text-[#5a6b85]">{isLive ? friend : pn[1]}</div><div className="kg-f text-[28px] leading-none tabular-nums text-[#101B2E]">{hud.tot[isLive ? 1 - me : 1]}</div></div>}
          <PauseButton shell={shell} active={playing} />
          <SoundButton />
        </div>
      </div>

      <BoardArea wrapRef={wrapRef} size={board} reserve={0}>
        <canvas ref={canvasRef} className="block rounded-[22px] shadow-[0_16px_40px_rgba(14,31,69,0.32)]" />
        <PrizeLogo shell={shell} active={isCpu && started && !over && !roundCard && !shell.paused && !menu && !rui} />
        <div className="kg-skin contents"><PausedCard shell={shell} active={playing} /></div>

        {intro && !holeCard && (
          <button onClick={() => skipRef.current()} className="kg-intro absolute inset-x-0 top-[24%] z-[6] mx-auto flex w-[80%] max-w-[296px] flex-col items-stretch">
            <style>{`@keyframes kg-in { 0% { opacity: 0; transform: translateY(-14px) scale(0.9) } 12% { opacity: 1; transform: scale(1.04) } 20% { transform: none } 62% { opacity: 1; transform: none } 85%, 100% { opacity: 0; transform: translateY(8px) scale(0.97) } } .kg-intro { animation: kg-in ${INTRO_MS}ms ease-out forwards }`}</style>
            <span className="kg-panel relative flex w-full flex-col items-center px-4 pb-4 pt-7 text-center">
              <span className="kg-f kg-ribbon absolute -top-4 rounded-full px-4 py-1 text-[16px] text-white/80">Hole {intro.n} Of 9</span>
              <span className="kg-f text-[31px] leading-[1.05] text-[#101B2E]">{intro.name}</span>
              <span className="kg-f mt-2.5 rounded-full bg-[#EAF2FF] px-4 py-0.5 text-[18px] text-[#101B2E]">Par {intro.par}</span>
            </span>
          </button>
        )}

        {holeCard && !matchEnd && (
          <button onClick={() => skipRef.current()} className="kg-pop absolute inset-x-0 top-[13%] z-[6] mx-auto flex w-[90%] max-w-[330px] flex-col items-stretch">
            <span className="kg-panel relative flex w-full flex-col items-center px-3 pb-3 pt-7 text-center">
              <span className="kg-f kg-ribbon absolute -top-4 max-w-[92%] truncate rounded-full px-4 py-1 text-[15px] text-white">Hole {holeCard.hole} <span className="text-white/80">·</span> {holeCard.name}</span>
              <span className="flex w-full flex-col gap-1.5">
                {holeCard.results.map((r, i) => (
                  <span key={i} className="flex w-full items-center justify-between px-1">
                    <span className="kg-f flex min-w-0 items-center gap-2 text-[19px] text-[#101B2E]"><span className="h-3.5 w-3.5 shrink-0 rounded-full shadow-[0_0_0_2px_#fff,0_1px_3px_rgba(14,31,69,0.4)]" style={{ background: r.color }} /><span className="truncate">{r.name}</span></span>
                    <span className={`kg-f shrink-0 rounded-full px-3 py-0.5 text-[15px] ${chipTone(r.strokes, holeCard.par)}`}>{scoreName(r.strokes, holeCard.par)}</span>
                  </span>
                ))}
              </span>
              <Scorecard pars={holeCard.pars} rows={holeCard.rows} cur={holeCard.hole - 1} />
              {holeCard.pts !== null && <span className="kg-f mt-2.5 text-[24px] leading-none text-[#22a861]">+{holeCard.pts.toLocaleString()} Points</span>}
            </span>
          </button>
        )}

        {isCpu && !started && !over && !menu && !rui && !offer && (
          <Card>
            <div className="flex items-center justify-center gap-2.5">
              <MeatballIcon size={52} />
              <div className="text-left">
                <div className="kg-f text-[32px] leading-none text-[#101B2E]">Kitchen Golf</div>
                <div className="kg-f kg-ribbon mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[12px] text-white/80">{mode === "daily" ? `Today's Challenge #${n}` : "Free Play"}</div>
              </div>
            </div>
            <p className="mt-3 text-sm leading-snug text-[#4a5b77]">{mode === "daily" ? "A 9-hole tour of the kitchen against the computer. Fewest strokes wins." : "Beat the computer round after round. New holes every round."}</p>
            {mode === "daily" && tour.length > 0 && (
              <div className="mt-2.5 flex flex-wrap justify-center gap-1">
                {tour.map((t, i) => (
                  <span key={i} className="kg-f flex items-center gap-1 rounded-full bg-[#eef3fb] py-[2px] pl-[2px] pr-2 text-[11.5px] text-[#2c4470] shadow-[inset_0_0_0_1px_#d5e1f5]">
                    <span className="flex h-[17px] w-[17px] items-center justify-center rounded-full bg-[#EAF2FF] text-[10px] text-[#4F88E8]">{i + 1}</span>{t}
                  </span>
                ))}
              </div>
            )}
            <button onClick={() => startRef.current()} className="kg-btn mt-4 w-full py-3.5 text-[20px]">Play The Computer</button>
            <div className="mt-3 flex gap-2.5">
              <button onClick={() => setMenu("friend")} className="kg-btn-2 flex-1 py-3 text-[16px]">Play A Friend</button>
              <button onClick={() => setMenu("local")} className="kg-btn-2 flex-1 py-3 text-[16px]">Same Phone</button>
            </div>
          </Card>
        )}

        {menu === "friend" && !rui && (
          <Card>
            <div className="kg-f text-[27px] leading-tight text-[#101B2E]">Play A Friend</div>
            <p className="mt-1 text-sm leading-snug text-[#4a5b77]">Play live on two phones. Make a room and send your friend the link.</p>
            <button onClick={openRoom} className="kg-btn mt-4 w-full py-3 text-[19px]">Make A Room</button>
            <div className="kg-f mt-4 text-[14px] text-[#5a6b85]">Got A Code?</div>
            <div className="mt-1.5 flex gap-2">
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))} placeholder="ABCD" autoCapitalize="characters" autoComplete="off" spellCheck={false}
                onKeyDown={e => { if (e.key === "Enter") joinRoom(); }}
                className="kg-input w-0 min-w-0 flex-1 px-3 py-2.5 text-center font-mono text-lg font-bold tracking-[0.3em] text-[#101B2E]" />
              <button onClick={joinRoom} disabled={code.length !== 4} className="kg-btn-2 px-5 text-[17px]">Join</button>
            </div>
            <button onClick={() => setMenu(null)} className="kg-link mt-3 w-full py-2 text-[15px]">Back</button>
          </Card>
        )}

        {menu === "local" && (
          <Card>
            <div className="kg-f text-[27px] leading-tight text-[#101B2E]">Same Phone</div>
            <p className="mt-1 text-sm leading-snug text-[#4a5b77]">Two players, one phone. Pass it over when it&apos;s the other player&apos;s putt.</p>
            {[0, 1].map(i => (
              <div key={i} className="relative mt-3">
                <span className="absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full" style={{ background: i === 0 ? BLUE : RED }} />
                <input value={names[i]} maxLength={12} placeholder={`Player ${i + 1}`} autoComplete="off"
                  onChange={e => setNames(v => v.map((x, j) => (j === i ? e.target.value : x)))}
                  className="kg-input w-full py-2.5 pl-8 pr-3 text-base text-[#101B2E]" />
              </div>
            ))}
            <button onClick={startLocal} className="kg-btn mt-4 w-full py-3 text-[19px]">Start</button>
            <button onClick={() => setMenu(null)} className="kg-link mt-2 w-full py-2 text-[15px]">Back</button>
          </Card>
        )}

        {offer && !rui && !isLive && (
          <Card>
            <div className="kg-f text-[26px] leading-tight text-[#101B2E]">Rejoin Your Game</div>
            <p className="mt-1 text-sm leading-snug text-[#4a5b77]">You were in the middle of a match in room {offer.saved.code}.</p>
            <button onClick={() => rejoinNow(offer.saved, offer.live)} className="kg-btn mt-4 w-full py-3 text-[19px]">Rejoin</button>
            <button onClick={() => { room.forget(); forgetLive(); setOffer(null); }} className="kg-link mt-2 w-full py-2 text-[15px]">No Thanks</button>
          </Card>
        )}

        {isLive && room.away && !rui && (theirTurn ? (
          <Card>
            <div className="kg-f text-[24px] leading-tight text-[#101B2E]">{friend} Stepped Away...</div>
            <div className="kg-f mx-auto mt-3 flex h-[76px] w-[76px] items-center justify-center rounded-full bg-gradient-to-b from-[#66A6FF] to-[#3170DC] text-[34px] tabular-nums text-white shadow-[0_5px_0_#19429A,inset_0_2px_0_rgba(255,255,255,0.35)]">{awayLeft}s</div>
            <p className="mt-3 text-sm leading-snug text-[#4a5b77]">It&apos;s their putt, so the game waits. It picks up right where you left off when they&apos;re back.</p>
            <button onClick={toCpu} className="kg-link mt-3 w-full py-2 text-[15px]">Leave</button>
          </Card>
        ) : (
          <div className="pointer-events-none absolute inset-x-0 top-[66px] z-10 flex justify-center px-3">
            <div className="kg-f truncate rounded-full bg-[#EAF2FF] px-3.5 py-1 text-[13px] text-[#101B2E]">{friend} Stepped Away · {awayLeft}s · Your Putt</div>
          </div>
        ))}
        {isLive && room.reconnecting && !room.away && !rui && (
          <div className="pointer-events-none absolute inset-x-0 top-[66px] z-10 flex justify-center">
            <div className="kg-f kg-ribbon rounded-full px-3.5 py-1 text-[13px] text-white">Reconnecting...</div>
          </div>
        )}

        {rui?.s === "lobby" && (
          <div className="kg-skin contents">
            <ReadyCard me={nameRef.current === "Guest" ? "You" : nameRef.current} friend={room.friendName === "Guest" ? "Your Friend" : room.friendName}
              ready={[room.ready.me, room.ready.them]} onReady={() => { SOUND?.unlock(); room.markReady(); }} onLeave={toCpu} steps={[
                "Drag back anywhere on the board and let go to putt. The dots show the way.",
                "Pull further for more power. Walls bounce, rugs and suds slow you, ice is slippery.",
                "You take turns. Water costs a stroke. After 6 strokes you pick up and take a 7.",
                "30 seconds a putt. Fewest strokes over 9 holes wins.",
              ]} />
          </div>
        )}

        {rui && rui.s !== "lobby" && (
          <Card>
            {rui.s === "waiting" && (<>
              <div className="kg-f text-[16px] text-[#5a6b85]">Your Room Code</div>
              <div className="mt-1.5 flex justify-center gap-1.5">
                {rui.code.split("").map((ch, i) => <span key={i} className="kg-f flex h-[52px] w-[44px] items-center justify-center rounded-xl bg-gradient-to-b from-[#2A3852] to-[#101B2E] text-[30px] text-white/80 shadow-[0_4px_0_#050a14,inset_0_1px_0_rgba(255,255,255,0.12)]">{ch}</span>)}
              </div>
              <p className="mt-3 text-sm leading-snug text-[#4a5b77]">Send your friend the link. The game starts when you&apos;re both ready.</p>
              <button onClick={() => shareRoom(rui.code)} className="kg-btn mt-4 w-full py-3 text-[19px]">{shell.copied ? "Link Copied!" : "Share Link"}</button>
              <p className="kg-f mt-3 animate-pulse text-[15px] text-[#4F88E8]">Waiting For Your Friend...</p>
              <button onClick={toCpu} className="kg-link mt-1 w-full py-2 text-[15px]">Cancel</button>
            </>)}
            {rui.s === "joining" && (<>
              <div className="kg-f text-[26px] leading-tight text-[#101B2E]">Joining Room {rui.code}</div>
              <p className="kg-f mt-2 animate-pulse text-[15px] text-[#4F88E8]">Connecting...</p>
              <button onClick={toCpu} className="kg-link mt-3 w-full py-2 text-[15px]">Cancel</button>
            </>)}
            {(rui.s === "full" || rui.s === "empty" || rui.s === "error") && (<>
              <div className="kg-f text-[26px] leading-tight text-[#101B2E]">{rui.s === "full" ? "Room Full" : rui.s === "empty" ? "No One's Here" : "Can't Connect"}</div>
              <p className="mt-2 text-sm leading-snug text-[#4a5b77]">{rui.s === "full" ? `Room ${rui.code} already has two players.` : rui.s === "empty" ? `Nobody is in room ${rui.code} right now. Ask your friend to make a room and send you the link.` : "We couldn't reach the game. Check your connection and try again."}</p>
              <button onClick={() => { room.dismiss(); setMenu("friend"); }} className="kg-btn mt-4 w-full py-3 text-[19px]">Back</button>
              <button onClick={toCpu} className="kg-link mt-2 w-full py-2 text-[15px]">Play The Computer</button>
            </>)}
            {rui.s === "left" && (<>
              <div className="kg-f text-[26px] leading-tight text-[#101B2E]">Your Friend Left</div>
              <p className="mt-2 text-sm leading-snug text-[#4a5b77]">That match is over.</p>
              <button onClick={openRoom} className="kg-btn mt-4 w-full py-3 text-[19px]">Make A New Room</button>
              <button onClick={toCpu} className="kg-btn-2 mt-3 w-full py-3 text-[17px]">Play The Computer</button>
            </>)}
          </Card>
        )}

        {isLocal && passTo && !matchEnd && !shell.held && !intro && !holeCard && (
          <button onClick={() => passRef.current()} className="kg-backdrop wk-raise absolute inset-0 z-10 flex items-center justify-center rounded-[22px] p-6">
            <span className="kg-panel kg-pop w-full max-w-[264px] px-6 pb-5 pt-5 text-center">
              <span className="kg-f block text-[15px] text-[#5a6b85]">Pass To {passTo}</span>
              <span className="kg-f mt-0.5 block text-[28px] leading-tight text-[#101B2E]">{passTo}&apos;s Putt</span>
              <span className="kg-btn mt-4 block py-3 text-[19px]">Tap To Start</span>
            </span>
          </button>
        )}

        {matchEnd && !rui && (isLive || isLocal) && (
          <Card>
            <div className="kg-f text-[14px] text-[#4F88E8]">{play.kind === "live" ? `Room ${play.code}` : "Same Phone"}</div>
            <div className="kg-f mt-0.5 text-[28px] leading-tight text-[#101B2E]">
              {matchEnd.winner < 0 ? "It's A Tie" : isLive ? (matchEnd.winner === me ? "You Won!" : `${friend} Won`) : `${pn[matchEnd.winner]} Wins!`}
            </div>
            <Scorecard pars={matchEnd.pars} rows={(isLive ? [me, 1 - me] : [0, 1]).map(i => ({ name: cardNames(i), card: matchEnd.cards[i], color: (isLive ? i === me : i === 0) ? BLUE : RED }))} />
            {(wins[0] + wins[1] > 1) && <div className="kg-f mt-2 text-[13px] text-[#5a6b85]">{isLive ? `Matches: You ${wins[me]} · ${friend} ${wins[1 - me]}` : `Matches: ${pn[0]} ${wins[0]} · ${pn[1]} ${wins[1]}`}</div>}
            {isLive && room.again.them && !room.again.me && <div className="kg-f mt-2 text-[15px] text-[#22a861]">{friend} Wants A Rematch!</div>}
            <button onClick={isLive ? room.rematch : localRematch} disabled={isLive && room.again.me} className="kg-btn mt-4 w-full py-3 text-[19px]">
              {isLive && room.again.me ? `Waiting For ${friend}...` : "Rematch"}
            </button>
            <button onClick={toCpu} className="kg-btn-2 mt-3 w-full py-3 text-[17px]">{isLive ? "Leave" : "Done"}</button>
            <a href={appStoreLink(GAME)} className="mt-3 inline-block text-xs font-semibold text-[#5a6b85] underline">Get WhatYouAte For iPhone</a>
          </Card>
        )}

        {roundCard && !over && (
          <Card>
            <div className="kg-f text-[15px] text-[#4F88E8]">Round {roundCard.round} {roundCard.tie ? "Tied" : "Won"} · {roundCard.you} To {roundCard.cpu}</div>
            <div className="kg-f mt-1 text-[44px] leading-none tabular-nums text-[#22a861]">+{roundCard.points.toLocaleString()}</div>
            <div className="kg-f mt-1 text-[16px] text-[#5a6b85]">{roundCard.tie ? "A Tie Keeps You Going" : "Nice Putting!"}</div>
            <button onClick={() => nextRef.current()} className="kg-btn mt-4 w-full py-3 text-[19px]">Next Round</button>
          </Card>
        )}

        {over && isCpu && !menu && !rui && result && <div className="kg-skin contents"><GameOver label={mode === "daily" ? `Today's Challenge #${n}` : "Free Play"} headline={headline} score={hud.score} best={best} mode={mode}
          posted={shell.scores.posted} joined={!!shell.player} campaign={GAME} copied={shell.copied} fact={toast}
          pitch="Good putting takes practice. So do good habits. WhatYouAte helps with the second one."
          extra={<>
            <div className="kg-f mt-2.5 text-[15px] leading-tight text-[#5a6b85]">{result.you} Strokes · {toPar(result.you, result.par)}</div>
            <div className="[@media(max-height:760px)]:hidden"><Scorecard pars={result.pars} rows={[{ name: "You", card: result.card, color: BLUE }]} compact /></div>
            <button onClick={() => setMenu("friend")} className="kg-f mt-1.5 text-[15px] text-[#4F88E8]">Play A Friend Instead →</button>
          </>}
          onBoard={() => shell.setBoardOpen(true)} onJoin={() => shell.setJoinOpen(true)} onAgain={() => setRun(r => r + 1)} onShare={share} /></div>}
      </BoardArea>

      <ShellPopups shell={shell} game={GAME} todayNote="Today's Challenge: same 9 holes and computer for everyone. Resets at midnight." />

      {shell.help.open && (
        <HelpModal onClose={shell.help.close} steps={[
          "Drag back anywhere on the board and let go to putt. The dots show which way the meatball goes.",
          "Pull further for more power. Walls bounce, rugs and suds slow you, ice is slippery, ramps roll you back.",
          "Time your putt past the mixer, the rolling pin and the cupboard doors. Stay off hot burners and out of the dog's water.",
          "Fewest strokes over 9 holes wins. After 6 strokes you pick up and take a 7.",
        ]}>
          <ModesHelp today="the same 9 holes and computer for everyone. Fewer strokes, holes in one and beating the computer score more." free="new holes every round against a computer that gets a little sharper. Win or tie to keep going." />
          <p className="mt-1.5 text-sm"><b>With a friend:</b> live on two phones, or pass one phone.</p>
        </HelpModal>
      )}
    </GameScreen>
  );
}

// how a hole went, as a chip colour: gold for a hole in one, green under par, blue for par, orange for a bogey, grey
// for worse, red for picking up
function chipTone(s: number, par: number) {
  return s >= PICKUP ? "bg-[#e8505b] text-white shadow-[0_2px_0_#a8262f]"
    : s === 1 ? "bg-[#EAF2FF] text-[#101B2E]"
    : s < par ? "bg-[#2eaa6e] text-white shadow-[0_2px_0_#1d7a4c]"
    : s === par ? "bg-[#3f7fd6] text-white shadow-[0_2px_0_#19429A]"
    : s === par + 1 ? "bg-[#ff9a2e] text-white shadow-[0_2px_0_#b8620a]"
    : "bg-[#8a97ab] text-white shadow-[0_2px_0_#5d6a7e]";
}
// the same, for a score in the scorecard: only the ones worth noticing stand out
function cellTone(s: number, par: number) {
  return s >= PICKUP ? "bg-[#e8505b] text-white"
    : s === 1 ? "bg-[#EAF2FF] text-[#101B2E]"
    : s < par ? "bg-[#2eaa6e] text-white"
    : s === par ? "text-[#101B2E]"
    : s === par + 1 ? "text-[#e07800]"
    : "text-[#c8463c]";
}

/** The scorecard: holes across the top on a navy strip (this hole in yellow), par, then a row per player; birdies and
 *  better in green, holes in one gold, bogeys orange, picking up red. */
function Scorecard({ pars, rows, cur, compact }: { pars: number[]; rows: Row[]; cur?: number; compact?: boolean }) {
  const cols = Array.from({ length: ROUND_HOLES }, (_, i) => i);
  return (
    <div className={`w-full overflow-hidden rounded-2xl bg-white text-[#101B2E] shadow-[0_0_0_1.5px_#DDEBFF,0_8px_18px_-10px_rgba(16,27,46,0.35)] ${compact ? "mb-1 mt-1.5" : "mb-0.5 mt-3"}`}>
      <div className={`kg-f kg-ribbon flex items-center px-1.5 text-white ${compact ? "py-[2px] text-[11px]" : "py-[4px] text-[13px]"}`}>
        <span className="w-[68px] shrink-0 text-left">Hole</span>
        {cols.map(i => <span key={i} className="flex flex-1 justify-center"><span className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 ${cur === i ? "bg-[#6FA8FF] text-white" : ""}`}>{i + 1}</span></span>)}
        <span className="w-7 shrink-0 text-right">Tot</span>
      </div>
      <div className={`kg-f flex items-center bg-[#eef3fb] px-1.5 text-[#6a7b96] ${compact ? "py-0 text-[11px]" : "py-[2px] text-[12px]"}`}>
        <span className="w-[68px] shrink-0 text-left">Par</span>{cols.map(i => <span key={i} className="flex-1 text-center">{pars[i] ?? ""}</span>)}<span className="w-7 shrink-0 text-right">{sum(pars)}</span>
      </div>
      {rows.map((r, k) => (
        <div key={k} className={`flex items-center border-t border-[#e3eaf6] px-1.5 ${compact ? "py-[1px]" : "py-[3px]"}`}>
          <span className="kg-f flex w-[68px] shrink-0 items-center gap-[3px] text-left text-[12px]" style={{ letterSpacing: 0 }}><span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: r.color }} /><span className="truncate">{r.name}</span></span>
          {cols.map(i => {
            const s = r.card[i];
            return <span key={i} className="flex flex-1 justify-center"><span className={`kg-f flex items-center justify-center rounded-full ${compact ? "h-[17px] w-[17px] text-[11px]" : "h-[19px] w-[19px] text-[12px]"} ${s === undefined ? "" : cellTone(s, pars[i])}`}>{s === undefined ? "" : s}</span></span>;
          })}
          <span className={`kg-f w-7 shrink-0 text-right ${compact ? "text-[13px]" : "text-[15px]"}`}>{r.card.length ? sum(r.card) : ""}</span>
        </div>
      ))}
    </div>
  );
}

/** A meatball turning slowly, for the start card. */
function MeatballIcon({ size }: { size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!, dpr = window.devicePixelRatio || 1, c = cv.getContext("2d")!;
    cv.width = size * dpr; cv.height = size * dpr; c.scale(dpr, dpr);
    let q = quatIdentity(), raf = 0;
    const tick = () => { q = rollQuat(q, 0.5, 0.2, 1); c.clearRect(0, 0, size, size); drawMeatball(c, size / 2 - 4, size / 2 - 5, size * 0.32, q, 1); raf = requestAnimationFrame(tick); };
    tick(); return () => cancelAnimationFrame(raf);
  }, [size]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}

/** A game panel over the board: a light card with a navy edge and a chunky lip, on a soft navy backdrop. */
function Card({ children }: { children: ReactNode }) {
  return (
    <div className="kg-backdrop wk-raise absolute inset-0 z-10 flex items-center justify-center rounded-[22px] p-5">
      <div className="kg-panel kg-pop max-h-full w-full max-w-[310px] overflow-y-auto p-5 text-center">{children}</div>
    </div>
  );
}
