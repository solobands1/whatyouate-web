"use client";

// Sugar Showdown: two foods, one question. Which has more sugar? Tap it. After each answer both foods show their
// grams of sugar for the stated serving, then the next pair comes up. The food list and pairing rules live in
// ./sugarData (pairs always differ clearly, so answers are never debatable).
// "Today" is the same 10 questions for everyone (seeded); every question is played, and a right answer scores 500
// plus up to 500 for speed, so scores spread out. Free Play keeps going until 3 wrong answers, with a slightly
// shorter timer each question. Both post to the scoreboard.
// "Play A Friend" is a live duel over a Supabase Realtime channel (no tables), same approach as Food Fight: presence
// for who's in (2 at most), broadcast for the game. The host picks the seed, both phones build the same 10 questions,
// each phone times its own answer from when the question appeared on it, and the HOST decides every round (faster
// right answer wins) and sends the result, so the two screens never disagree. "Same Phone" splits the screen in two
// for a couple across the table: the top half is flipped, first right tap wins, a wrong tap locks you out that round.
// Duels never post scores. Everything around the board comes from ./kit.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sb } from "@/components/creators/api";
import { appStoreLink } from "@/components/site";
import { type Mode, type Toast, type Shell, GameScreen, GameHeader, BoardArea, PrizeLogo, GameOver, PauseButton, PausedCard, ReadyCard, HelpModal, ModesHelp,
  ShellPopups, useGameShell, dailySeed, dailyNumber, torontoDate, mulberry32, readBest, saveBest, foodPng } from "./kit";
import { SUGAR_FOODS, type Question, answerOf, buildRound, nextFree, points, ROUND, TODAY_MS, DUEL_MS, COUCH_MS, HEARTS, freeMs } from "./sugarData";

const GAME = "sugar-showdown";
const LAUNCH = "2026-11-08";   // Today's Challenge #1
const SALT = 0x5e6a2;          // keeps Today's questions apart from the other games' daily seeds
const REVEAL_RIGHT = 1700, REVEAL_WRONG = 2300, REVEAL_DUEL = 2600;   // how long the grams stay up before the next pair
const food = (i: number) => SUGAR_FOODS[i];
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

// ── question clock ─────────────────────────────────────────────────────────
// Each phone times its own answers from the moment the question shows. Paused time doesn't count.
type Clock = { ms: number; running: boolean; limit: number; tick: number; paused: boolean };
const newClock = (): Clock => ({ ms: 0, running: false, limit: TODAY_MS, tick: 0, paused: false });
const readMs = (c: Clock) => Math.min(c.limit, c.ms + (c.running && !c.paused ? performance.now() - c.tick : 0));

function TimerBar({ clock, paused, onTimeout }: { clock: { current: Clock }; paused: boolean; onTimeout: () => void }) {
  const bar = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const cb = useRef(onTimeout); cb.current = onTimeout;
  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      const c = clock.current;
      if (c.running && !c.paused) c.ms += Math.min(250, Math.max(0, t - c.tick));
      c.tick = t; c.paused = pausedRef.current;
      if (c.running && c.ms >= c.limit) { c.ms = c.limit; c.running = false; cb.current(); }
      const left = c.limit ? Math.max(0, 1 - c.ms / c.limit) : 1;
      if (bar.current) { bar.current.style.width = `${left * 100}%`; bar.current.style.background = left < 0.3 ? "#e8505b" : "#3f7fd6"; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [clock]);
  return <div className="h-2 w-full shrink-0 overflow-hidden rounded-full bg-[#dbe6f7]"><div ref={bar} className="h-full w-full rounded-full bg-[#3f7fd6]" /></div>;
}

// ── a food to tap ──────────────────────────────────────────────────────────
type Look = "idle" | "picked" | "right" | "wrong" | "dim";
function FoodCard({ i, look, grams, onPick, disabled, compact = false, hidden = false }: {
  i: number; look: Look; grams: boolean; onPick: () => void; disabled: boolean; compact?: boolean; hidden?: boolean;
}) {
  const f = food(i);
  const tone = look === "right" ? "border-[#2eaa6e] bg-[#eefaf3]" : look === "wrong" ? "border-[#e8505b] bg-[#fdf0f1]" : look === "picked" ? "border-[#3f7fd6] bg-white" : "border-transparent bg-white";
  return (
    <button type="button" disabled={disabled} aria-label={`${f.name}, ${f.serving}`}
      onPointerDown={e => { if (disabled) return; e.preventDefault(); onPick(); }}
      onClick={e => { if (!disabled && e.detail === 0) onPick(); }}   // keyboard only; taps go through pointerdown, which is quicker
      className={`relative flex min-h-0 min-w-0 flex-1 touch-manipulation select-none flex-col items-center justify-center overflow-hidden rounded-3xl border-[3px] px-2 py-1 text-center shadow-[0_6px_18px_rgba(16,42,86,0.10)] transition ${tone} ${look === "dim" ? "opacity-55" : ""} ${disabled ? "" : "active:scale-[0.98]"}`}>
      <span className={`flex min-h-0 flex-col items-center ${hidden ? "invisible" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foodPng(f.code)} alt="" draggable={false} className={compact ? "h-[clamp(32px,6.5vh,56px)] w-auto shrink" : "h-[clamp(44px,9vh,84px)] w-auto shrink"} />
        <span className={`mt-1 font-bold leading-tight ${compact ? "text-[15px]" : "text-[clamp(17px,2.7vh,22px)]"}`}>{f.name}</span>
        <span className={`leading-tight text-[#5a6b85] ${compact ? "text-xs" : "text-sm"}`}>{f.serving}</span>
        <span className={`mt-1 font-bold leading-none tabular-nums ${compact ? "text-lg" : "text-2xl"} ${grams ? "" : "invisible"} ${look === "right" ? "text-[#2eaa6e]" : "text-[#101b2e]"}`}>
          {f.sugar} g sugar
        </span>
      </span>
    </button>
  );
}

/** How each card looks: before an answer, after you picked, and on the reveal. */
function looks(q: Question, pick: number | null, reveal: boolean): [Look, Look] {
  const ans = answerOf(q);
  return [0, 1].map((s): Look => reveal ? (s === ans ? "right" : s === pick ? "wrong" : "idle") : pick === null || pick < 0 ? "idle" : s === pick ? "picked" : "dim") as [Look, Look];
}

function Hearts({ left }: { left: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${left} hearts left`}>
      {Array.from({ length: HEARTS }, (_, k) => (
        <svg key={k} width="15" height="14" viewBox="0 0 24 22"><path d="M12 21s-9-5.6-9-12.2C3 5.3 5.6 3 8.4 3c1.6 0 2.9.8 3.6 2 .7-1.2 2-2 3.6-2C18.4 3 21 5.3 21 8.8 21 15.4 12 21 12 21z"
          fill={k < left ? "#e8505b" : "rgba(255,255,255,0.8)"} stroke={k < left ? "#e8505b" : "rgba(16,27,46,0.25)"} strokeWidth="1.6" /></svg>
      ))}
    </span>
  );
}

/** The board's room on screen. `away` is true while the board isn't drawn (same-phone mode), so it re-measures on return. */
function useBoardSize(ref: React.RefObject<HTMLDivElement | null>, away: boolean) {
  const [s, setS] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const f = () => setS({ w: el.clientWidth, h: el.clientHeight });
    f(); const ro = new ResizeObserver(f); ro.observe(el);
    return () => ro.disconnect();
  }, [ref, away]);
  return s;
}

// ── live rooms ─────────────────────────────────────────────────────────────
// One Realtime channel per room, "sugar-showdown:CODE". Presence says who's in (2 at most; a third is told it's full).
// The guest says hello and the host answers with "lobby": both see the Get Ready card, and each "ready" is broadcast (and kept
// in presence). Only when both are ready does the host send start (with the seed). Then: q (host shows question i on both phones),
// ans (the guest's pick and time), res (the host's ruling and the score), again (rematch), bye (leaving).
const ALPHA = "ACDEFHJKMNPRTWXY";   // no I/L/1, O/Q/0, S/5, Z/2, B/8, G/6, U/V
const newCode = () => Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");
type Msg =
  | { t: "hello"; id: string; name: string }
  | { t: "lobby"; id: string; name: string; to: string; ready: boolean }   // host to guest: you're paired, here's my name and whether I'm ready
  | { t: "ready"; id: string; ready: boolean }                             // I tapped I'm Ready on the Get Ready card
  | { t: "start"; m: number; seed: number; names: string[]; ids: string[] }
  | { t: "q"; m: number; i: number; k: number }                            // k: which time this question was asked (re-asked after a break)
  | { t: "ans"; m: number; i: number; k: number; pick: number; ms: number }
  | { t: "res"; m: number; i: number; picks: number[]; ms: number[]; winner: number; scores: number[] }
  | { t: "again" }
  | { t: "resume"; id: string; host: boolean; snap: unknown }   // back from a break: here is what I have
  | { t: "state"; host: boolean; snap: unknown }               // and here is what I have
  | { t: "bye" };
type GameMsg = Extract<Msg, { i: number }>;
type Member = { id: string; name: string; role: "host" | "guest"; at: number; ready?: boolean };
type RoomUi = { s: "waiting" | "joining" | "lobby" | "full" | "empty" | "left" | "error"; code: string };
type StartInfo = { code: string; m: number; seed: number; me: 0 | 1; names: string[] };
type RoomHandlers = { start: (p: StartInfo) => void; game: (m: GameMsg) => void; left: () => void; snapshot: () => Snap | null; apply: (snap: Snap) => void; resumed: (asked: boolean) => void; away: (on: boolean) => void };

// A saved seat in a room: the same id comes back after a reload or a dropped connection, so it rejoins as the same player.
type Saved = { code: string; role: Member["role"]; id: string; at: number; friendId: string; friendName: string; m: number; t: number };
// A snapshot of the shared match, for catching up after someone stepped away. Newer wins: a later match (m), then more
// progress (p). Equal progress means the same state, so nothing changes.
type Snap = { m: number; p: number; [k: string]: unknown };
const ROOM_KEY = "sugar-showdown-room", AWAY_MS = 60000;
function readSaved(code?: string): Saved | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(ROOM_KEY) ?? localStorage.getItem(ROOM_KEY) ?? "null") as Saved | null;
    if (!v || (code && v.code !== code) || Date.now() - v.t > 3 * 3600 * 1000) return null;
    return v;
  } catch { return null; }
}

function useRoom(nameRef: { current: string }, handlers: { current: RoomHandlers }) {
  const [ui, setUi] = useState<RoomUi | null>(null);
  const [again, setAgainState] = useState({ me: false, them: false });
  const [ready, setReadyState] = useState({ me: false, them: false });   // the Get Ready card, before the first game
  const [friendName, setFriendName] = useState("Guest");
  const [away, setAwayState] = useState<number | null>(null);            // the friend stepped away: when their 60 seconds run out
  const [reconnecting, setReconnecting] = useState(false);               // we're catching up after our own break
  const s = useRef({ ch: null as RealtimeChannel | null, code: "", role: "host" as Member["role"], id: "", at: 0, friendId: "", friendName: "Guest",
    seen: false, m: 0, last: null as Msg | null, again: { me: false, them: false }, ready: { me: false, them: false }, timers: [] as ReturnType<typeof setTimeout>[],
    away: 0, awayT: null as ReturnType<typeof setTimeout> | null }).current;
  const setAgain = (a: { me: boolean; them: boolean }) => { s.again = a; setAgainState(a); };
  const setReady = (r: { me: boolean; them: boolean }) => { s.ready = r; setReadyState(r); };
  const current = (): Saved => ({ code: s.code, role: s.role, id: s.id, at: s.at, friendId: s.friendId, friendName: s.friendName, m: s.m, t: Date.now() });
  const save = () => { if (!s.code) return; const v = JSON.stringify(current()); try { sessionStorage.setItem(ROOM_KEY, v); localStorage.setItem(ROOM_KEY, v); } catch {} };
  const forget = () => { try { sessionStorage.removeItem(ROOM_KEY); localStorage.removeItem(ROOM_KEY); } catch {} };
  const setFriend = (id: string, name: string) => {
    s.friendId = id; s.friendName = name || "Guest"; setFriendName(s.friendName);
    s.seen = !!id && !!s.ch && members(s.ch).some(m => m.id === id);    // already in presence? then a later absence means they left
    save();
  };
  const send = (msg: Msg) => { void s.ch?.send({ type: "broadcast", event: "m", payload: msg }); };
  const track = () => { void s.ch?.track({ id: s.id, name: nameRef.current, role: s.role, at: s.at, ready: s.ready.me }); };   // presence keeps "ready" too
  const clearAway = () => {
    if (s.awayT) clearTimeout(s.awayT); s.awayT = null;
    if (s.away) { s.away = 0; setAwayState(null); handlers.current.away(false); }
  };
  const close = (bye: boolean, keep = false) => {
    s.timers.forEach(t => { clearTimeout(t); clearInterval(t); }); s.timers = [];
    const ch = s.ch; s.ch = null;
    if (ch) {
      if (bye) void ch.send({ type: "broadcast", event: "m", payload: { t: "bye" } });
      void ch.untrack().catch(() => {}); void sb().removeChannel(ch);
    }
    if (keep) return;                                                  // reconnecting: the match carries on
    clearAway(); setReconnecting(false);
    setFriend("", "Guest"); s.seen = false; s.m = 0; s.last = null; setAgain({ me: false, them: false }); setReady({ me: false, them: false });
  };
  const members = (ch: RealtimeChannel) => {
    const st = ch.presenceState() as unknown as Record<string, Member[]>, seen = new Set<string>(), out: Member[] = [];
    for (const k in st) for (const m of st[k]) if (m.id && !seen.has(m.id)) { seen.add(m.id); out.push(m); }
    return out.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  };
  // gone from presence mid-match: give them 60 seconds (they may have just answered a text); "bye" or the 60s ending is final
  const friendGone = (final = false) => {
    if (!s.ch && !s.away) return;
    if (s.role === "host" && !s.m) {                                     // left from the Get Ready card: keep the room open for them
      setFriend("", "Guest"); s.seen = false; setReady({ me: false, them: false }); track(); setUi({ s: "waiting", code: s.code }); return;
    }
    if (!final && s.m) {
      if (s.away) return;
      s.away = Date.now() + AWAY_MS; setAwayState(s.away); handlers.current.away(true);
      s.awayT = setTimeout(() => friendGone(true), AWAY_MS); return;
    }
    const code = s.code; close(false); forget(); setUi({ s: "left", code }); handlers.current.left();
  };
  // the host starts the first game only when both have tapped I'm Ready and the friend is still here
  const hostCheck = () => {
    if (s.role !== "host" || s.m || !s.ch || !s.friendId || !s.ready.me || !s.ready.them) return;
    if (!members(s.ch).some(m => m.id === s.friendId)) return;          // presence will call back when they show up
    begin();
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
  const begin = () => {
    s.m++;  setAgain({ me: false, them: false });
    const msg: Msg = { t: "start", m: s.m, seed: Math.floor(Math.random() * 1e9), names: [nameRef.current, s.friendName], ids: [s.id, s.friendId] };
    s.last = msg; send(msg); setUi(null); save();
    handlers.current.start({ code: s.code, m: s.m, seed: msg.seed, me: 0, names: msg.names });
  };
  const lobbyMsg = (): Msg => ({ t: "lobby", id: s.id, name: nameRef.current, to: s.friendId, ready: s.ready.me });
  // catching up: whoever comes back says "resume" with its snapshot; the other answers with its own; each keeps the newer
  const sendResume = () => { send({ t: "resume", id: s.id, host: s.role === "host", snap: handlers.current.snapshot() }); s.timers.push(setTimeout(() => setReconnecting(false), 4000)); };
  const consider = (snap: Snap | null, fromHost: boolean) => {
    if (!snap) return;
    const mine = handlers.current.snapshot();
    if (!mine || snap.m > mine.m || (snap.m === mine.m && snap.p > mine.p)) {
      if (snap.m > s.m) { s.m = snap.m; save(); }
      handlers.current.apply(snap);
    }
  };
  const onMsg = (msg: Msg) => {
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
      s.m = msg.m;  setFriend(msg.ids[0], msg.names[0]); setAgain({ me: false, them: false }); setUi(null);
      handlers.current.start({ code: s.code, m: msg.m, seed: msg.seed, me: 1, names: msg.names });
    } else if (msg.t === "again") {
      setAgain({ ...s.again, them: true });
      if (s.role === "host" && s.again.me) begin();
    } else if (msg.t === "resume") {
      if (msg.id !== s.friendId) return;
      clearAway(); send({ t: "state", host: s.role === "host", snap: handlers.current.snapshot() });
      consider(msg.snap as Snap | null, msg.host); handlers.current.resumed(true);
    } else if (msg.t === "state") {
      consider(msg.snap as Snap | null, msg.host); setReconnecting(false); handlers.current.resumed(false);
    } else if (msg.t === "bye") friendGone(true);
    else handlers.current.game(msg);
  };
  function open(code: string, role: Member["role"], resume?: Saved) {
    close(false, !!resume);
    const prior = resume ?? readSaved(code);                           // same room as before: same seat
    s.code = code; s.role = role; s.id = prior?.id ?? Math.random().toString(36).slice(2, 10); s.at = prior?.at ?? Date.now();
    if (resume) { s.friendId = resume.friendId; s.friendName = resume.friendName || "Guest"; setFriendName(s.friendName); s.m = resume.m;  s.seen = false; }
    const ch = sb().channel(`sugar-showdown:${code}`, { config: { broadcast: { self: false }, presence: { key: s.id } } });
    s.ch = ch; save();
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
  // back from another app (or the network): make sure we're still in the room, and catch up
  useEffect(() => {
    const back = () => {
      if (document.visibilityState !== "visible" || !s.code || !(s.m || s.friendId)) return;
      const ch = s.ch as unknown as { state?: string } | null, rt = sb().realtime;
      if (!rt.isConnected() || !ch || ch.state !== "joined") { setReconnecting(true); open(s.code, s.role, current()); if (!rt.isConnected()) void rt.disconnect().catch(() => {}).then(() => rt.connect()); }   // the socket may have died while we were away; connect() does nothing while a dead one is still attached
      else { track(); if (s.m) { setReconnecting(true); sendResume(); } }
    };
    document.addEventListener("visibilitychange", back); window.addEventListener("pageshow", back); window.addEventListener("online", back);
    return () => { document.removeEventListener("visibilitychange", back); window.removeEventListener("pageshow", back); window.removeEventListener("online", back); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  return {
    ui, again, ready, friendName, away, reconnecting,
    
    isHost: () => s.role === "host",
    code: () => s.code,
    saved: () => { const v = readSaved(); return v && v.m ? v : null; },
    isAway: () => !!s.away,
    pushState: () => send({ t: "state", host: s.role === "host", snap: handlers.current.snapshot() }),   // after a break: here's the latest, in case they missed it
    rejoin: (v: Saved) => open(v.code, v.role, v),
    forget,
    create: () => open(newCode(), "host"),
    join: (code: string) => { const v = readSaved(code); if (v && v.m) open(code, v.role, v); else open(code, "guest"); },
    leave: () => { close(true); forget(); setUi(null); },
    dismiss: () => setUi(null),
    // tapping I'm Ready: tell them straight away, keep it in presence too, and let the host check
    markReady: () => { if (s.ready.me || s.m) return; setReady({ ...s.ready, me: true }); send({ t: "ready", id: s.id, ready: true }); track(); hostCheck(); },
    rematch: () => { setAgain({ ...s.again, me: true }); send({ t: "again" }); if (s.role === "host" && s.again.them) begin(); },
    send,
  };
}

// ── live match state ───────────────────────────────────────────────────────
// Players are [host, guest]; `me` is which one this phone is.
type LiveRes = { i: number; picks: number[]; ms: number[]; winner: number };
type Live = { code: string; m: number; me: 0 | 1; names: string[]; qs: Question[]; seed: number; i: number; k: number;
  phase: "count" | "hold" | "ask" | "wait" | "reveal" | "done"; pick: number | null; scores: number[]; res: LiveRes | null };   // hold: catching up after a break
const LIVE_KEY = "sugar-showdown-live";   // the live match in progress, for picking it back up after a reload
type SavedLive = { code: string; m: number; seed: number; me: 0 | 1; names: string[]; i: number; scores: number[]; done: boolean; t: number };
function readLive(): SavedLive | null {
  try { const v = JSON.parse(localStorage.getItem(LIVE_KEY) ?? "null") as SavedLive | null; return v && Date.now() - v.t < 3 * 3600 * 1000 ? v : null; } catch { return null; }
}
type Ans = { pick: number; ms: number };

// ── solo ───────────────────────────────────────────────────────────────────
type Phase = "ready" | "ask" | "reveal" | "over";
type Cur = { q: Question; n: number };

export default function SugarShowdown() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [couch, setCouch] = useState<string[] | null>(null);   // same-phone names [bottom, top] while a couch duel is on
  const board = useBoardSize(wrapRef, !!couch);
  const [mode, setMode] = useState<Mode>("daily");
  const [run, setRun] = useState(0);                 // bump to restart
  const shell = useGameShell(GAME, mode);
  const { reset: resetScores } = shell.scores;
  const [menu, setMenu] = useState<null | "friend" | "local">(null);
  const [code, setCode] = useState("");
  const [names, setNames] = useState(["", ""]);

  // solo state: the ref is the truth (timers read it), the state is what's drawn
  const [phase, setPhaseState] = useState<Phase>("ready");
  const [cur, setCur] = useState<Cur | null>(null);
  const [pick, setPick] = useState<number | null>(null);   // 0 or 1, or -1 when time ran out
  const [gain, setGain] = useState(0);
  const [score, setScore] = useState(0);
  const [marks, setMarks] = useState<boolean[]>([]);
  const [best, setBest] = useState(0);
  const [missed, setMissed] = useState<Question | null>(null);   // the last one you got wrong, for the game-over card
  const S = useRef({ phase: "ready" as Phase, qs: [] as Question[], rnd: Math.random, recent: [] as number[], score: 0, marks: [] as boolean[], wrong: 0,
    answerMs: 0, started: 0, cur: null as Cur | null, timer: undefined as ReturnType<typeof setTimeout> | undefined });
  const clock = useRef<Clock>(newClock());
  const setPhase = (p: Phase) => { S.current.phase = p; setPhaseState(p); };
  const bestKey = mode === "daily" ? `sugarshowdown-daily-${torontoDate()}` : "sugarshowdown-endless";
  useEffect(() => { setBest(readBest(bestKey)); }, [bestKey]);
  // Today is one go a day: once you've seen today's 10, a replay would just be memory, so the board stays fair.
  const playedKey = `sugarshowdown-played-${torontoDate()}`;
  const [playedToday, setPlayedToday] = useState(false);
  useEffect(() => { try { setPlayedToday(!!localStorage.getItem(playedKey)); } catch {} }, [playedKey]);

  useEffect(() => {
    const s = S.current;
    clearTimeout(s.timer); clock.current.running = false;
    Object.assign(s, { phase: "ready", qs: [], recent: [], score: 0, marks: [], wrong: 0, answerMs: 0, cur: null });
    clock.current.ms = 0;
    setPhaseState("ready"); setCur(null); setPick(null); setScore(0); setMarks([]); setGain(0); setMissed(null); resetScores();
    return () => clearTimeout(s.timer);
  }, [mode, run]);   // eslint-disable-line react-hooks/exhaustive-deps

  const ask = (n: number) => {
    const s = S.current;
    const q = mode === "daily" ? s.qs[n] : nextFree(s.rnd, n, s.recent);
    s.recent.push(q.a, q.b); while (s.recent.length > 30) s.recent.shift();
    s.cur = { q, n }; setCur(s.cur); setPick(null); setPhase("ask");
    Object.assign(clock.current, { ms: 0, running: true, limit: mode === "daily" ? TODAY_MS : freeMs(n), tick: performance.now() });
  };
  const start = () => {
    const s = S.current;
    if (s.phase !== "ready") return;
    if (mode === "daily") { if (playedToday) return; try { localStorage.setItem(playedKey, "1"); } catch {} }
    s.qs = mode === "daily" ? buildRound(mulberry32(dailySeed(SALT))) : [];
    s.rnd = mulberry32(Math.floor(Math.random() * 1e9)); s.started = performance.now();
    ask(0);
  };
  const finish = () => {
    const s = S.current;
    setPhase("over");
    if (s.score > readBest(bestKey)) { saveBest(bestKey, s.score); setBest(s.score); }
    shell.finishRef.current({ score: s.score, drops: s.marks.length, ms: performance.now() - s.started });
  };
  const answer = (p: number) => {
    const s = S.current, c = clock.current;
    if (s.phase !== "ask" || !s.cur) return;
    const ms = p < 0 ? c.limit : readMs(c); c.running = false;
    const right = p === answerOf(s.cur.q), pts = points(right, ms, c.limit);
    s.score += pts; s.marks = [...s.marks, right]; s.answerMs += ms;
    if (!right) { s.wrong++; setMissed(s.cur.q); }
    setScore(s.score); setMarks(s.marks); setGain(pts); setPick(p); setPhase("reveal");
    const n = s.cur.n;
    s.timer = setTimeout(() => {
      if (mode === "daily" ? n + 1 >= ROUND : s.wrong >= HEARTS) finish(); else ask(n + 1);
    }, right ? REVEAL_RIGHT : REVEAL_WRONG);
  };

  // ── live ──
  const [live, setLiveState] = useState<Live | null>(null);
  const L = useRef({ live: null as Live | null, ans: [[], []] as (Ans | null)[][], timers: [] as ReturnType<typeof setTimeout>[], resumedAt: 0 });
  const setLive = (v: Live | null) => {
    L.current.live = v; setLiveState(v);
    if (v) try { localStorage.setItem(LIVE_KEY, JSON.stringify({ code: v.code, m: v.m, seed: v.seed, me: v.me, names: v.names, i: v.i, scores: v.scores, done: v.phase === "done", t: Date.now() })); } catch {}
  };
  const liveClock = useRef<Clock>(newClock());
  const clearLive = () => { L.current.timers.forEach(clearTimeout); L.current.timers = []; liveClock.current.running = false; };
  const later = (f: () => void, ms: number) => { L.current.timers.push(setTimeout(f, ms)); };
  const nameRef = useRef("Guest"); nameRef.current = shell.player?.name || "Guest";
  const handlers = useRef<RoomHandlers>({ start: () => {}, game: () => {}, left: () => {}, snapshot: () => null, apply: () => {}, resumed: () => {}, away: () => {} });
  const room = useRoom(nameRef, handlers);
  const roomRef = useRef(room); roomRef.current = room;
  const awayRef = useRef(false); awayRef.current = !!room.away || room.reconnecting;   // question timers stop while either of you is away
  const [offer, setOffer] = useState<{ saved: Saved; live: SavedLive } | null>(null);   // a match from before a reload
  const [tick, setTick] = useState(0);
  useEffect(() => { if (!room.away) return; const t = setInterval(() => setTick(x => x + 1), 500); return () => clearInterval(t); }, [room.away]);

  const showQ = (i: number, k: number) => {
    const v = L.current.live; if (!v) return;
    setLive({ ...v, i, k, phase: "ask", pick: null, res: null });
    Object.assign(liveClock.current, { ms: 0, running: true, limit: DUEL_MS, tick: performance.now() });
  };
  const applyRes = (r: Extract<Msg, { t: "res" }>) => {
    const v = L.current.live; if (!v || r.m !== v.m) return;
    liveClock.current.running = false;
    setLive({ ...v, i: r.i, phase: "reveal", scores: r.scores, pick: r.picks[v.me], res: { i: r.i, picks: r.picks, ms: r.ms, winner: r.winner } });
    later(() => {
      const w = L.current.live; if (!w || w.m !== r.m) return;
      if (r.i >= ROUND - 1) setLive({ ...w, phase: "done" });
      else if (w.me === 0) hostAsk(r.i + 1);
    }, REVEAL_DUEL);
  };
  // the host rules on round i once both answers are in (a missing answer counts as out of time)
  const hostTry = (i: number) => {
    const v = L.current.live, [mine, theirs] = [L.current.ans[0][i], L.current.ans[1][i]];
    if (!v || v.me !== 0 || v.i !== i || v.res?.i === i || !mine || !theirs) return;
    const ok = [mine, theirs].map(a => a.pick === answerOf(v.qs[i]));
    const ms = [mine.ms, theirs.ms];
    const winner = ok[0] && ok[1] ? (ms[0] < ms[1] ? 0 : ms[1] < ms[0] ? 1 : -1) : ok[0] ? 0 : ok[1] ? 1 : -1;
    const scores = v.scores.map((x, k) => x + (winner === k ? 1 : 0));
    const msg: Extract<Msg, { t: "res" }> = { t: "res", m: v.m, i, picks: [mine.pick, theirs.pick], ms, winner, scores };
    roomRef.current.send(msg); applyRes(msg);
  };
  const hostAsk = (i: number) => {
    const v = L.current.live; if (!v || v.me !== 0) return;
    L.current.ans[0][i] = null; L.current.ans[1][i] = null;
    const k = v.k + 1;
    roomRef.current.send({ t: "q", m: v.m, i, k }); showQ(i, k);
    later(() => {                                       // their answer never came: count it as out of time (not while they're away)
      const w = L.current.live; if (!w || w.m !== v.m || w.k !== k || awayRef.current) return;
      if (!L.current.ans[1][i]) { L.current.ans[1][i] = { pick: -1, ms: DUEL_MS }; hostTry(i); }
    }, DUEL_MS + 3000);
  };
  const liveAnswer = (p: number) => {
    const v = L.current.live, c = liveClock.current;
    if (!v || v.phase !== "ask") return;
    const ms = Math.round(p < 0 ? DUEL_MS : readMs(c)); c.running = false;
    setLive({ ...v, phase: "wait", pick: p });
    if (v.me === 0) { L.current.ans[0][v.i] = { pick: p, ms }; hostTry(v.i); }
    else roomRef.current.send({ t: "ans", m: v.m, i: v.i, k: v.k, pick: p, ms });
  };
  handlers.current = {
    start: p => {
      clearLive(); L.current.ans = [[], []];
      setMenu(null); liveClock.current.ms = 0;
      setLive({ code: p.code, m: p.m, me: p.me, names: p.names, qs: buildRound(mulberry32(p.seed)), seed: p.seed, i: -1, k: 0, phase: "count", pick: null, scores: [0, 0], res: null });
      if (p.me === 0) later(() => hostAsk(0), 3000);
    },
    game: msg => {
      const v = L.current.live; if (!v || msg.m !== v.m) return;
      if (msg.t === "q" && v.me === 1 && (msg.i > v.i || (msg.i === v.i && msg.k !== v.k))) showQ(msg.i, msg.k);
      else if (msg.t === "ans" && v.me === 0 && msg.k === v.k) { L.current.ans[1][msg.i] = { pick: msg.pick, ms: msg.ms }; hostTry(msg.i); }
      else if (msg.t === "res" && v.me === 1) applyRes(msg);
    },
    left: () => { clearLive(); setLive(null); try { localStorage.removeItem(LIVE_KEY); } catch {} },
    // catching up after a break: the match so far (the host rules, so its copy wins a tie), then the host asks the question again
    snapshot: () => {
      const v = L.current.live; if (!v) return null;
      const step = { count: 0, hold: 0, ask: 1, wait: 1, reveal: 2, done: 3 }[v.phase];
      return { m: v.m, p: v.phase === "done" ? 1e5 : Math.max(0, v.i) * 4 + step, seed: v.seed, names: v.names, i: v.i, scores: v.scores, done: v.phase === "done" };
    },
    apply: sn => {
      clearLive();
      const v = L.current.live, base = v && v.m === sn.m ? v : { code: roomRef.current.code(), m: sn.m, me: (roomRef.current.isHost() ? 0 : 1) as 0 | 1, names: sn.names as string[],
        qs: buildRound(mulberry32(sn.seed as number)), seed: sn.seed as number, k: 0 };
      setMenu(null); setOffer(null);
      setLive({ ...base, i: sn.i as number, scores: sn.scores as number[], phase: sn.done ? "done" : "hold", pick: null, res: null });
    },
    resumed: () => {
      const v = L.current.live; if (!v || v.me !== 0 || v.phase === "done") return;
      if (Date.now() - L.current.resumedAt < 1500) return; L.current.resumedAt = Date.now();
      clearLive();
      if (v.phase === "reveal" && v.i >= ROUND - 1) { setLive({ ...v, phase: "done" }); return; }
      const next = v.phase === "reveal" ? v.i + 1 : Math.max(0, v.i);
      setLive({ ...v, phase: "hold" }); later(() => hostAsk(next), 1200);
    },
    away: () => {},
  };

  // a shared link (?room=ABCD) joins that room straight away, or picks a saved match back up. Minimising or reloading the
  // page doesn't leave the room (the friend sees "Stepped Away"); only Leave, or leaving the game for another page, does.
  const rejoinNow = (saved: Saved, sl: SavedLive) => {
    clearLive(); setMenu(null); setOffer(null);
    setLive({ code: sl.code, m: sl.m, me: sl.me, names: sl.names, qs: buildRound(mulberry32(sl.seed)), seed: sl.seed, i: sl.i, k: 0, phase: "hold", pick: null, scores: sl.scores, res: null });
    roomRef.current.rejoin(saved);
  };
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? "";
    const saved = roomRef.current.saved(), sl = readLive();
    const resumable = !!saved && !!sl && sl.code === saved.code && sl.m === saved.m && !sl.done;
    if (resumable && (!c || c === saved!.code)) { if (c) rejoinNow(saved!, sl!); else setOffer({ saved: saved!, live: sl! }); }
    else if (/^[A-Z]{4}$/.test(c)) roomRef.current.join(c);
    return () => { roomRef.current.leave(); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { L.current.timers.forEach(clearTimeout); }, []);

  const dropRoomParam = () => { try { const u = new URL(window.location.href); if (u.searchParams.has("room")) { u.searchParams.delete("room"); history.replaceState(null, "", u.pathname + u.search); } } catch {} };
  const toSolo = () => { if (live || room.ui) room.leave(); try { localStorage.removeItem(LIVE_KEY); } catch {} setOffer(null); clearLive(); setLive(null); setMenu(null); setCouch(null); dropRoomParam(); setRun(r => r + 1); };
  const openRoom = () => { setMenu(null); room.create(); };
  const joinRoom = () => { if (code.length === 4) { setMenu(null); room.join(code); } };
  const shareRoom = (c: string) => shell.share(`Which has more sugar? Play Sugar Showdown with me! Room ${c}: ${window.location.origin}/games/sugar-showdown?room=${c}`);
  const startCouch = () => { setNames(v => v.map(x => x.trim().slice(0, 12))); setCouch(names.map((v, i) => v.trim().slice(0, 12) || (i === 0 ? (shell.player?.name.slice(0, 12) || "Player 1") : "Player 2"))); setMenu(null); };

  // keyboard: ↑/1 picks the top food, ↓/2 the bottom one
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = e => {
    const k = e.key === "ArrowUp" || e.key === "1" ? 0 : e.key === "ArrowDown" || e.key === "2" ? 1 : -1;
    if (k < 0 || couch) return;
    if (live?.phase === "ask") { e.preventDefault(); liveAnswer(k); }
    else if (!live && phase === "ask" && !shell.paused) { e.preventDefault(); answer(k); }
  };
  useEffect(() => { const f = (e: KeyboardEvent) => keyRef.current(e); window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, []);

  if (couch) return (
    <GameScreen>
      <Couch names={couch} onExit={toSolo} onNames={() => { setCouch(null); setMenu("local"); }} />
    </GameScreen>
  );

  const n = dailyNumber(LAUNCH);
  const rui = room.ui;
  const solo = !live && !rui;
  const playing = solo && (phase === "ask" || phase === "reveal");
  const right = marks.filter(Boolean).length;
  const me = live?.me ?? 0, friendName = live ? live.names[1 - me] || "Guest" : "";
  const friend = friendName === "Guest" ? "Your Friend" : friendName;
  const factQ = missed ?? cur?.q ?? null;   // the last one you missed, or (a perfect run) the last question
  const fact: Toast | null = factQ ? (() => {
    const [hi, lo] = [factQ.a, factQ.b].map(food).sort((x, y) => y.sugar - x.sugar);
    return { title: "Worth Remembering", body: `${hi.name}: ${hi.sugar} g of sugar in ${hi.serving}. ${lo.name}: ${lo.sugar} g in ${lo.serving}.`, img: hi.code };
  })() : null;
  const share = () => {
    // Wordle-style: a square per question, plus the total answer time
    const label = mode === "daily" ? `Sugar Showdown #${n} (Today's Challenge)` : "Sugar Showdown (Free Play)";
    const p = shell.scores.posted;
    const rank = p?.rank ? `\n🏆 #${p.rank} of ${p.total} ${mode === "daily" ? "today" : "this week"}` : "";
    const rows = marks.map(m => (m ? "🟩" : "🟥")).join("").match(/.{1,10}/gu)?.join("\n") ?? "";   // 10 squares a line
    const how = mode === "daily" ? `${right}/${ROUND}` : `${right} right`;
    shell.share(`${label}\n${how} · ${score.toLocaleString()} pts · ⏱ ${secs(S.current.answerMs)}${rank}\n${rows}\nCan you beat it? whatyouate.app/games/sugar-showdown`);
  };

  // what the board shows: a solo question, or the live one
  const q = live ? (live.i >= 0 ? live.qs[live.i] : null) : cur?.q ?? null;
  const reveal = live ? live.phase === "reveal" : phase === "reveal";
  const myPick = live ? live.pick : pick;
  const canTap = live ? live.phase === "ask" && !room.away && !room.reconnecting : phase === "ask" && !shell.paused;
  const hideCards = (solo && phase === "ask" && shell.paused) || (!!live && live.phase === "ask" && !!room.away);   // no reading the question while paused
  let line: ReactNode = "Which Has More Sugar?", lineColor = "text-[#101b2e]", times = "";
  if (live) {
    const r = live.res;
    if (live.phase === "wait") { line = `Waiting For ${friend}...`; lineColor = "text-[#3f7fd6]"; }
    else if (live.phase === "reveal" && r) {
      const mine = r.picks[me] === answerOf(live.qs[r.i]), theirs = r.picks[1 - me] === answerOf(live.qs[r.i]);
      if (mine && theirs) times = `You ${secs(r.ms[me])} · ${friendName} ${secs(r.ms[1 - me])}`;
      if (r.winner === me) { line = mine && theirs ? "You Were Faster!" : "You Got It!"; lineColor = "text-[#2eaa6e]"; }
      else if (r.winner === 1 - me) { line = mine && theirs ? `${friend} Was Faster` : `${friend} Got It`; lineColor = "text-[#e8505b]"; }
      else { line = mine && theirs ? "Dead Heat!" : "Nobody Got That One"; lineColor = "text-[#5a6b85]"; }
    }
  } else if (phase === "reveal") {
    if (gain > 0) { line = `Right! +${gain}`; lineColor = "text-[#2eaa6e]"; }
    else { line = pick === -1 ? "Time's Up" : "Not Quite"; lineColor = "text-[#e8505b]"; }
  }
  const qNum = live ? live.i + 1 : (cur?.n ?? 0) + 1;

  return (
    <GameScreen>
      <GameHeader title="Sugar Showdown" mode={mode} onMode={m => { toSolo(); setMode(m); }} onBoard={() => shell.setBoardOpen(true)} onHelp={shell.help.show} />

      <div className="mt-2 flex items-center justify-between">
        {live ? (<>
          <div className="min-w-0"><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">You</div><div className="text-2xl font-bold leading-none tabular-nums">{live.scores[me]}</div></div>
          <div className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold text-[#3f7fd6]">Live · Room {live.code}</div>
          <div className="min-w-0 text-right"><div className="max-w-[120px] truncate text-[10px] uppercase tracking-wide text-[#5a6b85]">{friendName}</div><div className="text-2xl font-bold leading-none tabular-nums">{live.scores[1 - me]}</div></div>
        </>) : (<>
          <div><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Score</div><div className="text-2xl font-bold leading-none tabular-nums">{score.toLocaleString()}</div></div>
          <div className="h-6">{phase === "reveal" && gain > 0 && <div className="rounded-full bg-[#2eaa6e] px-2.5 py-0.5 text-xs font-bold text-white">+{gain}</div>}</div>
          <div className="flex items-center gap-2">
            <div className="text-right"><div className="text-[10px] uppercase tracking-wide text-[#5a6b85]">Best</div><div className="text-lg font-semibold leading-none tabular-nums">{best.toLocaleString()}</div></div>
            <PauseButton shell={shell} active={playing} />
          </div>
        </>)}
      </div>

      <BoardArea wrapRef={wrapRef} size={board} reserve={0}>
        <div className="absolute inset-0 flex flex-col rounded-[22px] bg-white/45 p-3 shadow-[0_14px_40px_rgba(16,42,86,0.12)]">
          <div className="flex h-5 shrink-0 items-center justify-between text-xs font-semibold text-[#5a6b85]">
            <span>{q ? (mode === "daily" || live ? `Question ${qNum} Of ${ROUND}` : `Question ${qNum}`) : ""}</span>
            {live && times && <span className="truncate pl-2 tabular-nums">{times}</span>}
            {solo && mode === "endless" && q && <Hearts left={HEARTS - (marks.length - right)} />}
            {solo && mode === "daily" && q && (
              <span className="flex gap-[3px]">{Array.from({ length: ROUND }, (_, k) => (
                <span key={k} className={`h-2.5 w-2.5 rounded-[3px] ${k < marks.length ? (marks[k] ? "bg-[#2eaa6e]" : "bg-[#e8505b]") : "bg-white/80"}`} />))}</span>
            )}
          </div>
          <div className="mt-1.5 shrink-0">
            {live ? <TimerBar clock={liveClock} paused={!!room.away || room.reconnecting} onTimeout={() => liveAnswer(-1)} />
              : <TimerBar clock={clock} paused={shell.paused} onTimeout={() => answer(-1)} />}
          </div>
          <div className={`mt-2 shrink-0 truncate text-center text-lg font-bold ${lineColor}`}>{q ? line : " "}</div>
          <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
            {q ? (() => {
              const lk = looks(q, myPick, reveal);
              return [q.a, q.b].map((fi, side) => (
                <FoodCard key={`${side}-${fi}`} i={fi} look={lk[side]} grams={reveal} disabled={!canTap} hidden={hideCards}
                  onPick={() => (live ? liveAnswer(side) : answer(side))} />
              ));
            })() : [0, 1].map(k => <div key={k} className="flex-1 rounded-3xl bg-white/60" />)}
          </div>
        </div>

        <PrizeLogo shell={shell} active={playing && !shell.paused && !menu} />
        <PausedCard shell={shell} active={playing} />

        {solo && phase === "ready" && !menu && (
          <Card>
            <div className="text-lg font-bold">{mode === "daily" ? `Today's Challenge #${n}` : "Free Play"}</div>
            {mode === "daily" && playedToday ? (<>
              <p className="mt-1 text-sm text-[#5a6b85]">You&apos;ve played today&apos;s 10{best > 0 ? ` and scored ${best.toLocaleString()}` : ""}. New questions tomorrow.</p>
              <button onClick={() => { toSolo(); setMode("endless"); }} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Play Free Play</button>
            </>) : (<>
              <p className="mt-1 text-sm text-[#5a6b85]">{mode === "daily" ? "10 quick questions. Same ones for everyone today, one go each." : "Keep going until 3 wrong answers. The timer gets quicker."}</p>
              <button onClick={start} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Start</button>
            </>)}
            <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#5a6b85]">Or Go Head To Head</div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => setMenu("friend")} className="flex-1 rounded-full bg-[#e3effe] py-3 text-sm font-semibold text-[#3f7fd6]">Play A Friend</button>
              <button onClick={() => setMenu("local")} className="flex-1 rounded-full bg-[#e3effe] py-3 text-sm font-semibold text-[#3f7fd6]">Same Phone</button>
            </div>
          </Card>
        )}

        {menu === "friend" && !rui && (
          <Card>
            <div className="text-xl font-bold">Play A Friend</div>
            <p className="mt-1 text-sm text-[#5a6b85]">Race each other live on two phones. Make a room and send your friend the link.</p>
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
            <p className="mt-1 text-sm text-[#5a6b85]">Sit across from each other with the phone flat between you. The top half flips to face the other person.</p>
            {[0, 1].map(i => (
              <input key={i} value={names[i]} maxLength={12} placeholder={i === 0 ? (shell.player?.name.slice(0, 12) || "Player 1") : "Player 2"} autoComplete="off"
                aria-label={i === 0 ? "Your name" : "Their name"}
                onChange={e => setNames(v => v.map((x, j) => (j === i ? e.target.value : x)))}
                className="mt-3 w-full rounded-xl border border-[#d6e2f5] px-3 py-2.5 text-base outline-none focus:border-[#3f7fd6]" />
            ))}
            <button onClick={startCouch} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Start</button>
            <button onClick={() => setMenu(null)} className="mt-2 w-full py-2 text-sm font-semibold text-[#5a6b85]">Back</button>
          </Card>
        )}

        {offer && !rui && !live && (
          <Card>
            <div className="text-xl font-bold">Rejoin Your Game</div>
            <p className="mt-1 text-sm text-[#5a6b85]">You were in the middle of a match in room {offer.saved.code}.</p>
            <button onClick={() => rejoinNow(offer.saved, offer.live)} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Rejoin</button>
            <button onClick={() => { room.forget(); try { localStorage.removeItem(LIVE_KEY); } catch {} setOffer(null); }} className="mt-2 w-full py-2 text-sm font-semibold text-[#5a6b85]">No Thanks</button>
          </Card>
        )}

        {live && room.away && !rui && (
          <Card>
            <div className="text-xl font-bold">{friend} Stepped Away...</div>
            <div className="mt-2 text-4xl font-bold tabular-nums text-[#3f7fd6]">{Math.max(0, Math.ceil((room.away - Date.now()) / 1000) + tick * 0)}s</div>
            <p className="mt-2 text-sm text-[#5a6b85]">The game is paused. It picks up right where you left off when they&apos;re back.</p>
            <button onClick={toSolo} className="mt-3 w-full py-2 text-sm font-semibold text-[#5a6b85]">Leave</button>
          </Card>
        )}
        {live && (room.reconnecting || live.phase === "hold") && !room.away && !rui && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
            <div className="rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-[#3f7fd6] shadow-md">Reconnecting...</div>
          </div>
        )}

        {rui?.s === "lobby" && (
          <ReadyCard me={nameRef.current === "Guest" ? "You" : nameRef.current} friend={room.friendName === "Guest" ? "Your Friend" : room.friendName}
            ready={[room.ready.me, room.ready.them]} onReady={room.markReady} onLeave={toSolo} steps={[
              "Two foods pop up. Tap the one with more sugar.",
              "The faster right answer wins the round. A wrong tap or running out of time gets nothing.",
              "10 questions. Win the most rounds to take the match.",
            ]} />
        )}

        {rui && rui.s !== "lobby" && (
          <Card>
            {rui.s === "waiting" && (<>
              <div className="text-sm font-semibold text-[#5a6b85]">Your Room Code</div>
              <div className="mt-1 font-mono text-4xl font-bold tracking-[0.2em]">{rui.code}</div>
              <p className="mt-2 text-sm text-[#5a6b85]">Send your friend the link. The game starts as soon as they join.</p>
              <button onClick={() => shareRoom(rui.code)} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">{shell.copied ? "Link Copied!" : "Share Link"}</button>
              <p className="mt-3 text-sm font-semibold text-[#3f7fd6]">Waiting For Your Friend...</p>
              <button onClick={toSolo} className="mt-1 w-full py-2 text-sm font-semibold text-[#5a6b85]">Cancel</button>
            </>)}
            {rui.s === "joining" && (<>
              <div className="text-xl font-bold">Joining Room {rui.code}</div>
              <p className="mt-2 text-sm font-semibold text-[#3f7fd6]">Connecting...</p>
              <button onClick={toSolo} className="mt-3 w-full py-2 text-sm font-semibold text-[#5a6b85]">Cancel</button>
            </>)}
            {(rui.s === "full" || rui.s === "empty" || rui.s === "error") && (<>
              <div className="text-xl font-bold">{rui.s === "full" ? "Room Full" : rui.s === "empty" ? "No One's Here" : "Can't Connect"}</div>
              <p className="mt-2 text-sm text-[#5a6b85]">{rui.s === "full" ? `Room ${rui.code} already has two players.` : rui.s === "empty" ? `Nobody is in room ${rui.code} right now. Ask your friend to make a room and send you the link.` : "We couldn't reach the game. Check your connection and try again."}</p>
              <button onClick={() => { room.dismiss(); dropRoomParam(); setMenu("friend"); }} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Back</button>
              <button onClick={toSolo} className="mt-2 w-full py-2 text-sm font-semibold text-[#5a6b85]">Play Solo</button>
            </>)}
            {rui.s === "left" && (<>
              <div className="text-xl font-bold">Your Friend Left</div>
              <p className="mt-2 text-sm text-[#5a6b85]">That match is over.</p>
              <button onClick={openRoom} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white">Make A New Room</button>
              <button onClick={toSolo} className="mt-2 w-full rounded-full bg-[#e3effe] py-3 font-semibold text-[#3f7fd6]">Play Solo</button>
            </>)}
          </Card>
        )}

        {live && live.phase === "count" && !rui && (
          <Card>
            <div className="text-sm font-semibold text-[#5a6b85]">You Vs {friendName}</div>
            <div className="mt-1 text-2xl font-bold">Here We Go</div>
            <p className="mt-1 text-sm text-[#5a6b85]">10 questions. Faster right answer wins each one.</p>
            <Countdown key={live.m} />
          </Card>
        )}

        {live && live.phase === "done" && !rui && (
          <Card>
            <div className="text-sm font-semibold text-[#5a6b85]">Room {live.code}</div>
            <div className="mt-1 text-2xl font-bold">
              {live.scores[me] === live.scores[1 - me] ? "It's A Tie" : live.scores[me] > live.scores[1 - me] ? "You Won! 🎉" : `${friend} Won`}
            </div>
            <div className="mt-1 text-sm text-[#5a6b85]">You {live.scores[me]} · {friend} {live.scores[1 - me]}</div>
            {room.again.them && !room.again.me && <div className="mt-2 text-sm font-semibold text-[#2eaa6e]">{friend} Wants A Rematch!</div>}
            <button onClick={room.rematch} disabled={room.again.me} className="mt-4 w-full rounded-full bg-[#3f7fd6] py-3 font-semibold text-white disabled:opacity-70">
              {room.again.me ? `Waiting For ${friend}...` : "Rematch"}
            </button>
            <button onClick={toSolo} className="mt-2 w-full rounded-full bg-[#e3effe] py-3 font-semibold text-[#3f7fd6]">Leave</button>
            <a href={appStoreLink(GAME)} className="mt-3 inline-block text-xs font-semibold text-[#5a6b85] underline">Get WhatYouAte For iPhone</a>
          </Card>
        )}

        {solo && phase === "over" && !menu && <GameOver label={mode === "daily" ? `Today's Challenge #${n}` : "Free Play"}
          headline={mode === "daily" ? `${right} Of ${ROUND} Right` : `${right} Right`} score={score} best={best} mode={mode}
          posted={shell.scores.posted} joined={!!shell.player} campaign={GAME} copied={shell.copied} fact={fact}
          pitch="Sugar turns up in surprising places. WhatYouAte shows you how your meals affect your energy."
          onBoard={() => shell.setBoardOpen(true)} onJoin={() => shell.setJoinOpen(true)} onAgain={() => { if (mode === "daily") { setPlayedToday(true); toSolo(); setMode("endless"); } else setRun(r => r + 1); }} onShare={share} />}
      </BoardArea>

      <ShellPopups shell={shell} game={GAME} todayNote="Today's Challenge: same 10 questions for everyone. Resets at midnight." />

      {shell.help.open && <Help shell={shell} />}
    </GameScreen>
  );
}

function Help({ shell }: { shell: Shell }) {
  return (
    <HelpModal onClose={shell.help.close} steps={[
      "Two foods pop up. Tap the one with more sugar.",
      "Right answers score points, and faster ones score more.",
      "After each answer you'll see the grams of sugar in each, for the serving shown.",
      "Play solo, race a friend on their phone, or face off on one phone.",
    ]}>
      <ModesHelp today="the same 10 questions for everyone today. Every question gets played." free="keep going until 3 wrong answers. The timer gets a little shorter each time." />
      <div className="mt-1.5 space-y-1.5 text-sm">
        <p><b>Play A Friend:</b> share a room code and race on your own phones. Faster right answer wins the round.</p>
        <p><b>Same Phone:</b> the screen splits in two. First right tap wins; a wrong tap sits you out that round.</p>
      </div>
    </HelpModal>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[22px] bg-[#101b2e]/35 p-5">
      <div className="max-h-full w-full max-w-[300px] overflow-y-auto rounded-3xl bg-white p-5 text-center shadow-2xl">{children}</div>
    </div>
  );
}

function Countdown() {
  const [n, setN] = useState(3);
  useEffect(() => { const t = setInterval(() => setN(v => Math.max(1, v - 1)), 1000); return () => clearInterval(t); }, []);
  return <div className="mt-3 text-5xl font-bold tabular-nums text-[#3f7fd6]">{n}</div>;
}

// ── same phone ─────────────────────────────────────────────────────────────
// Player 0 sits at the bottom, player 1 across the table (their half is turned 180°). Both see the same pair.
// First right tap wins the round; a wrong tap locks that player out until the next one.
type CouchState = { qs: Question[]; i: number; phase: "count" | "ask" | "reveal" | "done"; locked: boolean[]; picks: (number | null)[]; winner: number; scores: number[] };

function Couch({ names, onExit, onNames }: { names: string[]; onExit: () => void; onNames: () => void }) {
  const [st, setSt] = useState<CouchState | null>(null);
  const ref = useRef<CouchState | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clock = useRef<Clock>(newClock());
  const put = (v: CouchState) => { ref.current = v; setSt(v); };
  const later = (f: () => void, ms: number) => { timers.current.push(setTimeout(f, ms)); };
  const ask = (i: number) => {
    const v = ref.current; if (!v) return;
    put({ ...v, i, phase: "ask", locked: [false, false], picks: [null, null], winner: -1 });
    Object.assign(clock.current, { ms: 0, running: true, limit: COUCH_MS, tick: performance.now() });
  };
  const begin = () => {
    timers.current.forEach(clearTimeout); timers.current = []; clock.current.running = false;
    put({ qs: buildRound(mulberry32(Math.floor(Math.random() * 1e9))), i: 0, phase: "count", locked: [false, false], picks: [null, null], winner: -1, scores: [0, 0] });
    later(() => ask(0), 1800);
  };
  const settle = (v: CouchState) => {
    clock.current.running = false; put({ ...v, phase: "reveal" });
    later(() => { const w = ref.current; if (!w) return; if (w.i + 1 >= ROUND) put({ ...w, phase: "done" }); else ask(w.i + 1); }, REVEAL_DUEL);
  };
  const tap = (p: number, side: number) => {
    const v = ref.current;
    if (!v || v.phase !== "ask" || v.locked[p]) return;
    const picks = v.picks.map((x, k) => (k === p ? side : x));
    if (side === answerOf(v.qs[v.i])) { settle({ ...v, picks, winner: p, scores: v.scores.map((x, k) => x + (k === p ? 1 : 0)) }); return; }
    const locked = v.locked.map((x, k) => x || k === p);
    if (locked[0] && locked[1]) settle({ ...v, picks, locked, winner: -1 });
    else put({ ...v, picks, locked });
  };
  const timeout = () => { const v = ref.current; if (v && v.phase === "ask") settle({ ...v, winner: -1 }); };
  useEffect(() => {
    begin();
    return () => timers.current.forEach(clearTimeout);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!st) return null;
  return (
    <div className="flex h-full touch-manipulation select-none flex-col">
      <CouchHalf flip p={1} st={st} names={names} onTap={tap} />
      <div className="my-1.5 flex shrink-0 items-center gap-2">
        {st.phase === "done" ? (<>
          <button onClick={begin} className="flex-1 rounded-full bg-[#3f7fd6] py-2.5 text-sm font-semibold text-white">Rematch</button>
          <button onClick={onNames} className="flex-1 rounded-full bg-white/80 py-2.5 text-sm font-semibold text-[#3f7fd6]">Change Names</button>
          <button onClick={onExit} className="flex-1 rounded-full bg-white/80 py-2.5 text-sm font-semibold text-[#3f7fd6]">Done</button>
        </>) : (<>
          <button onClick={onExit} aria-label="Stop the duel" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-lg leading-none text-[#3f7fd6]">×</button>
          <div className="shrink-0 text-xs font-bold text-[#3f7fd6]">Round {Math.min(st.i + 1, ROUND)} Of {ROUND}</div>
          <div className="min-w-0 flex-1"><TimerBar clock={clock} paused={false} onTimeout={timeout} /></div>
        </>)}
      </div>
      <CouchHalf p={0} st={st} names={names} onTap={tap} />
    </div>
  );
}

function CouchHalf({ p, st, names, onTap, flip = false }: { p: number; st: CouchState; names: string[]; onTap: (p: number, side: number) => void; flip?: boolean }) {
  const o = 1 - p, q = st.qs[st.i], reveal = st.phase === "reveal";
  let line = "Which Has More Sugar?", color = "text-[#101b2e]";
  if (st.phase === "count") line = "Get Ready...";
  else if (reveal) {
    if (st.winner === p) { line = "You Got It! 🎉"; color = "text-[#2eaa6e]"; }
    else if (st.winner === o) { line = `${names[o]} Got It`; color = "text-[#e8505b]"; }
    else { line = "Nobody Got That One"; color = "text-[#5a6b85]"; }
  } else if (st.phase === "ask" && st.locked[p]) { line = "Wrong One. Sit This Round Out"; color = "text-[#e8505b]"; }
  const ans = answerOf(q), mine = st.picks[p];
  const look = (side: number): Look => reveal ? (side === ans ? "right" : side === mine ? "wrong" : "idle") : mine === null ? "idle" : side === mine ? "wrong" : "dim";
  const won = st.scores[p] > st.scores[o], tie = st.scores[p] === st.scores[o];
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-[22px] bg-white/45 p-2.5 shadow-[0_10px_30px_rgba(16,42,86,0.12)]" style={flip ? { transform: "rotate(180deg)" } : undefined}>
      <div className="flex shrink-0 items-center justify-between">
        <div className="min-w-0 truncate text-sm font-bold">{names[p]}</div>
        <div className="shrink-0 text-xs font-semibold text-[#5a6b85]">{names[o]} <b className="text-[#101b2e] tabular-nums">{st.scores[o]}</b> · You <b className="text-xl leading-none text-[#101b2e] tabular-nums">{st.scores[p]}</b></div>
      </div>
      {st.phase === "done" ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
          <div className="text-3xl font-bold">{tie ? "It's A Tie" : won ? "You Win! 🎉" : `${names[o]} Wins`}</div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-[#5a6b85]">{st.scores[p]}-{st.scores[o]}</div>
        </div>
      ) : (<>
        <div className={`mt-1 shrink-0 truncate text-center text-base font-bold ${color}`}>{line}</div>
        <div className="mt-1.5 flex min-h-0 flex-1 gap-2">
          {[q.a, q.b].map((fi, side) => (
            <FoodCard key={`${st.i}-${side}`} compact i={fi} look={look(side)} grams={reveal} hidden={st.phase === "count"}
              disabled={st.phase !== "ask" || st.locked[p]} onPick={() => onTap(p, side)} />
          ))}
        </div>
      </>)}
    </div>
  );
}
