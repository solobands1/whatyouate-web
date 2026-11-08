// Pea Tanks live rooms: who's in, and a fast pipe between the two phones.
// Supabase Realtime (channel "pea-tanks:CODE") only finds the other phone: presence says who's in (two at most), and
// a handful of broadcasts carry hello / welcome, the WebRTC offer and answer, and the ICE candidates. Then the phones
// talk directly over two WebRTC data channels: "s" (unordered, no resends) for the 20-a-second game state and inputs,
// "e" (reliable, in order) for events like ready, round start and rematch. Nothing in a game goes through Supabase
// while the direct pipe is up, which keeps the whole site well under the free plan's Realtime limit.
// If the direct pipe isn't open 6 seconds after the two phones meet (some networks block it), the game falls back to
// Supabase broadcast ("relay"); the game then sends about 10 small updates a second per phone. If the direct pipe
// opens later, it switches over by itself.
// Stepping away doesn't end a match. Each phone keeps the same player id for the room (sessionStorage, with a
// localStorage copy so a reload or a new tab can rejoin). When the other phone goes quiet, hides the page or loses its
// connection, `away` is set and the game freezes; it has 60 seconds to come back before the room closes ("left" when
// it's the friend who's gone, "lost" when it's us). Coming back (page visible again, network back, channel error
// recovered, or a reload with a saved session) re-subscribes with the same presence key, says hello, and the host
// makes a fresh WebRTC offer (the relay carries the game until it opens). The game then gets "_back" and resyncs.
// Only an explicit Leave says goodbye; closing or hiding the page counts as stepping away.
// Debug (with ?debug=1 on the page): ?nodirect=1 skips WebRTC to force the relay, ?lag=150 adds 150 ms of round trip
// (half each way) to everything this phone sends and receives in a game.
import { useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sb } from "@/components/creators/api";

export type NetMode = "connecting" | "direct" | "relay";
export type RoomState = { s: "waiting" | "joining" | "paired" | "full" | "empty" | "left" | "lost" | "error"; code: string; role: "host" | "guest"; friend: string };
export type Away = { who: "friend" | "me"; since: number } | null;
export type Saved = { code: string; role: "host" | "guest"; id: string; at: number; friendId: string; friendName: string; ts: number };
type Member = { id: string; name: string; role: "host" | "guest"; at: number };
type Sig =
  | { t: "hello"; id: string; name: string; role: "host" | "guest" }
  | { t: "welcome"; id: string; name: string; to: string }
  | { t: "sdp"; to: string; n: number; d: RTCSessionDescriptionInit }
  | { t: "ice"; to: string; n: number; c: RTCIceCandidateInit[] }
  | { t: "bye"; id: string }
  | { t: "g"; id: string; d: unknown };
export type NetStats = { sbSent: number; sbRecv: number; sbGame: number; dcSent: number; dcRecv: number; since: number; log: [number, string][] };
type GameMsg = { t: string; [k: string]: unknown };
const ALPHA = "ACDEFHJKMNPRTWXY";   // no I/L/1, O/Q/0, S/5, Z/2, B/8, G/6, U/V
const newCode = () => Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");
export const AWAY_MS = 60000;
const FALLBACK_MS = 6000, QUIET_DIRECT = 3500, QUIET_RELAY = 3500, SAVE_FRESH = AWAY_MS + 15000;

function urlFlags() {
  try {
    const q = new URLSearchParams(window.location.search), dbg = q.get("debug") === "1";
    return { nodirect: dbg && q.get("nodirect") === "1", lag: dbg ? Math.max(0, Math.min(1000, Number(q.get("lag")) || 0)) : 0 };
  } catch { return { nodirect: false, lag: 0 }; }
}
/** A live session saved by this browser that can still be rejoined (this tab's first, then any tab's). */
export function savedSession(game: string): Saved | null {
  for (const store of [() => sessionStorage, () => localStorage]) {
    try {
      const v = store().getItem(`${game}-live`); if (!v) continue;
      const s = JSON.parse(v) as Saved;
      if (s && s.code && s.id && Date.now() - s.ts < SAVE_FRESH) return s;
    } catch {}
  }
  return null;
}

export function useTankRoom(game: string, nameRef: { current: string }, onGame: { current: (msg: GameMsg) => void }) {
  const [room, setRoomState] = useState<RoomState | null>(null);
  const [mode, setModeState] = useState<NetMode>("connecting");
  const [away, setAwayState] = useState<Away>(null);
  const s = useRef({
    ch: null as RealtimeChannel | null, code: "", role: "host" as Member["role"], id: "", at: 0, friendId: "", friendName: "Guest", seen: false,
    pc: null as RTCPeerConnection | null, dcS: null as RTCDataChannel | null, dcE: null as RTCDataChannel | null, iceOut: [] as RTCIceCandidateInit[], iceIn: [] as { n: number; c: RTCIceCandidateInit }[],
    iceTimer: 0 as unknown as ReturnType<typeof setTimeout>, offerN: 0, offer: null as RTCSessionDescriptionInit | null,
    mode: "connecting" as NetMode, timers: [] as ReturnType<typeof setTimeout>[], live: false, subscribed: false, everSubscribed: false, retry: 0 as unknown as ReturnType<typeof setTimeout>,
    rtt: 0, lastHeard: 0, lastOut: 0, friendHidden: false, cut: false, away: null as Away, flags: { nodirect: false, lag: 0 }, room: null as RoomState | null, unhook: () => {},
    stats: { sbSent: 0, sbRecv: 0, sbGame: 0, dcSent: 0, dcRecv: 0, since: 0, log: [] } as NetStats,
  }).current;
  const setRoom = (r: RoomState | null) => { s.room = r; setRoomState(r); };
  const setMode = (m: NetMode) => { if (s.mode !== m) s.stats.log.push([Math.round(performance.now()), m]); s.mode = m; setModeState(m); };
  const setAway = (a: Away) => { if (a) s.stats.log.push([Math.round(performance.now()), `away:${a.who}`]); else if (s.away) s.stats.log.push([Math.round(performance.now()), "back"]); s.away = a; setAwayState(a); };

  const save = () => {
    if (!s.live || !s.friendId) return;
    const v: Saved = { code: s.code, role: s.role, id: s.id, at: s.at, friendId: s.friendId, friendName: s.friendName, ts: Date.now() };
    try { sessionStorage.setItem(`${game}-live`, JSON.stringify(v)); } catch {}
    try { localStorage.setItem(`${game}-live`, JSON.stringify(v)); } catch {}
  };
  const forget = () => { try { sessionStorage.removeItem(`${game}-live`); } catch {} try { localStorage.removeItem(`${game}-live`); } catch {} };

  const sbSend = (msg: Sig) => { if (!s.ch || !s.subscribed || s.cut) return; s.stats.sbSent++; if (msg.t === "g") s.stats.sbGame++; void s.ch.send({ type: "broadcast", event: "m", payload: msg }); };
  const heard = () => { s.lastHeard = performance.now(); };
  const deliver = (msg: GameMsg) => {
    heard();
    if (msg.t === "_p") { send({ t: "_q", k: msg.k }, false); return; }
    if (msg.t === "_q") { const r = performance.now() - (msg.k as number); s.rtt = s.rtt ? s.rtt * 0.8 + r * 0.2 : r; return; }
    if (msg.t === "_away") { s.friendHidden = true; if (!s.away) setAway({ who: "friend", since: Date.now() }); return; }
    if (msg.t === "_back") { s.friendHidden = false; return; }
    onGame.current(msg);
  };
  const receive = (msg: GameMsg) => { if (s.cut) return; if (s.flags.lag) setTimeout(() => deliver(msg), s.flags.lag / 2); else deliver(msg); };

  /** Game messages: `reliable` ones always arrive (direct "e" channel, or Supabase while the direct pipe is down);
   *  the rest go over the direct "s" channel, or Supabase in relay mode, and are dropped while still connecting. */
  function send(msg: object, reliable: boolean) {
    const go = () => {
      if (!s.live) return;
      if (s.cut) return;
      if (s.mode === "direct") {
        const dc = reliable ? s.dcE : s.dcS;
        if (dc && dc.readyState === "open") { try { dc.send(JSON.stringify(msg)); s.stats.dcSent++; s.lastOut = performance.now(); return; } catch {} }
      }
      if (reliable || s.mode === "relay") { sbSend({ t: "g", id: s.id, d: msg }); s.lastOut = performance.now(); }
    };
    if (s.flags.lag) setTimeout(go, s.flags.lag / 2); else go();
  }
  /** Tell the friend right away, every way we can (stepping away, coming back). */
  const shout = (msg: GameMsg) => {
    const raw = JSON.stringify(msg);
    for (const dc of [s.dcE]) if (dc && dc.readyState === "open" && !s.cut) { try { dc.send(raw); s.stats.dcSent++; } catch {} }
    sbSend({ t: "g", id: s.id, d: msg });
  };

  // ── WebRTC ──
  const closeRtc = () => {
    clearTimeout(s.iceTimer); s.iceTimer = 0 as unknown as ReturnType<typeof setTimeout>;
    try { s.dcS?.close(); s.dcE?.close(); s.pc?.close(); } catch {}
    s.pc = null; s.dcS = null; s.dcE = null; s.iceOut = []; s.offer = null;
  };
  const directLost = (pc: RTCPeerConnection) => { if (s.pc === pc && s.mode === "direct") setMode("relay"); };   // keep playing over Supabase
  const wire = (pc: RTCPeerConnection, dc: RTCDataChannel) => {
    if (dc.label === "s") s.dcS = dc; else s.dcE = dc;
    dc.onopen = () => { if (s.pc === pc && s.dcS?.readyState === "open" && s.dcE?.readyState === "open") setMode("direct"); };
    dc.onmessage = e => { if (s.pc !== pc) return; s.stats.dcRecv++; try { receive(JSON.parse(e.data)); } catch {} };
    dc.onclose = () => directLost(pc);
  };
  const flushIce = () => {
    s.iceTimer = 0 as unknown as ReturnType<typeof setTimeout>;
    if (s.iceOut.length && s.friendId) { sbSend({ t: "ice", to: s.friendId, n: s.offerN, c: s.iceOut }); s.iceOut = []; }
  };
  const startRtc = (offerer: boolean, n: number) => {
    closeRtc();
    if (s.mode === "direct") setMode("relay");   // the game rides the relay until the new pipe opens
    if (s.flags.nodirect || typeof RTCPeerConnection === "undefined") return;
    let pc: RTCPeerConnection;
    try { pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }); } catch { return; }
    s.pc = pc; s.offerN = n; s.iceIn = s.iceIn.filter(x => x.n === n);
    pc.onicecandidate = e => {
      if (s.pc !== pc || !e.candidate) return;
      s.iceOut.push(e.candidate.toJSON());
      if (!s.iceTimer) s.iceTimer = setTimeout(flushIce, 200);   // a few candidates per broadcast
    };
    pc.onconnectionstatechange = () => { if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") directLost(pc); };
    if (offerer) {
      wire(pc, pc.createDataChannel("s", { ordered: false, maxRetransmits: 0 }));
      wire(pc, pc.createDataChannel("e", { ordered: true }));
      void (async () => {
        try {
          const o = await pc.createOffer(); await pc.setLocalDescription(o);
          if (s.pc !== pc || !pc.localDescription) return;
          s.offer = pc.localDescription.toJSON(); sbSend({ t: "sdp", to: s.friendId, n, d: s.offer });
        } catch {}
      })();
    } else pc.ondatachannel = e => { if (s.pc === pc) wire(pc, e.channel); };
  };
  const hostOffer = () => startRtc(true, Math.max(s.offerN + 1, Date.now()));   // numbered by time, so a reloaded host never repeats one
  const onSdp = async (n: number, d: RTCSessionDescriptionInit) => {
    try {
      if (d.type === "offer") {
        if (s.role !== "guest") return;
        if (s.pc && n === s.offerN && s.pc.remoteDescription) return;   // a repeat of an offer we already answered
        if (!s.pc || n !== s.offerN) startRtc(false, n);
        const pc = s.pc; if (!pc) return;
        await pc.setRemoteDescription(d);
        for (const x of s.iceIn.splice(0)) if (x.n === n) await pc.addIceCandidate(x.c).catch(() => {});
        const a = await pc.createAnswer(); await pc.setLocalDescription(a);
        if (s.pc === pc && pc.localDescription) sbSend({ t: "sdp", to: s.friendId, n, d: pc.localDescription.toJSON() });
      } else if (d.type === "answer") {
        const pc = s.pc; if (!pc || s.role !== "host" || n !== s.offerN || pc.remoteDescription) return;
        await pc.setRemoteDescription(d);
        for (const x of s.iceIn.splice(0)) if (x.n === n) await pc.addIceCandidate(x.c).catch(() => {});
      }
    } catch {}
  };
  const onIce = (n: number, cs: RTCIceCandidateInit[]) => {
    if (n < s.offerN) return;   // for an old pipe
    const pc = s.pc;
    if (!pc || !pc.remoteDescription || n !== s.offerN) { for (const c of cs) s.iceIn.push({ n, c }); return; }
    for (const c of cs) void pc.addIceCandidate(c).catch(() => {});
  };

  // ── the room ──
  const dropChannel = () => {
    clearTimeout(s.retry);
    const ch = s.ch; s.ch = null; s.subscribed = false;
    if (ch) { void ch.untrack().catch(() => {}); void sb().removeChannel(ch); }
  };
  /** Ends the session for good. `bye` tells the friend we left on purpose. */
  const close = (bye: boolean) => {
    if (bye && s.ch && s.subscribed) { s.stats.sbSent++; void s.ch.send({ type: "broadcast", event: "m", payload: { t: "bye", id: s.id } }); }
    s.timers.forEach(t => { clearTimeout(t); clearInterval(t); }); s.timers = [];
    s.unhook(); s.unhook = () => {};
    closeRtc(); dropChannel(); forget();
    s.live = false; s.friendId = ""; s.seen = false; s.friendHidden = false; setMode("connecting"); setAway(null);
  };
  const members = (ch: RealtimeChannel) => {
    const st = ch.presenceState() as unknown as Record<string, Member[]>, seen = new Set<string>(), out: Member[] = [];
    for (const k in st) for (const m of st[k]) if (m.id && !seen.has(m.id)) { seen.add(m.id); out.push(m); }
    return out.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  };
  const end = (why: "left" | "lost") => { const r = s.room; close(false); setRoom(r ? { ...r, s: why } : null); };
  const offline = () => typeof navigator !== "undefined" && navigator.onLine === false;
  const friendQuiet = () => { if (s.live && s.friendId && !s.away) setAway({ who: s.subscribed && !offline() ? "friend" : "me", since: Date.now() }); };
  const paired = (resumed: boolean) => {
    heard(); save();
    setRoom({ s: "paired", code: s.code, role: s.role, friend: s.friendName });
    if (!resumed) s.timers.push(setTimeout(() => { if (s.mode === "connecting" && s.live) setMode("relay"); }, FALLBACK_MS));
    let n = 0;
    s.timers.push(setInterval(() => {
      n++;
      if (n % 4 === 0) save();
      const now = performance.now(), quiet = now - s.lastHeard;
      // pings: twice a second over the direct pipe; on the relay only when nothing else has gone out for a second (the
      // game's own traffic already proves we're here, and Supabase messages are the scarce thing)
      if (s.mode === "direct" || (s.mode === "relay" && now - s.lastOut > 900)) send({ t: "_p", k: now }, false);
      if (s.mode !== "connecting" && !s.away && quiet > (s.mode === "direct" ? QUIET_DIRECT : QUIET_RELAY)) friendQuiet();
      if (s.away) {
        if (s.subscribed && quiet < 1500 && !s.friendHidden && !document.hidden && !offline()) { setAway(null); onGame.current({ t: "_back" }); }   // both here again
        else if (Date.now() - s.away.since > AWAY_MS) end(s.away.who === "friend" ? "left" : "lost");
        else if (s.away.who === "friend" && (!s.subscribed || offline())) setAway({ who: "me", since: s.away.since });   // turns out it's our connection
      }
    }, 500));
  };
  const onPresence = (ch: RealtimeChannel) => {
    const list = members(ch), mine = list.findIndex(m => m.id === s.id);
    if (mine < 0) return;
    if (s.role === "host" && !s.friendId && list.some((m, i) => i < mine && m.role === "host")) { open(newCode(), "host"); return; }   // code already taken
    if (s.role === "guest" && !s.friendId && mine >= 2) { const code = s.code; close(false); setRoom({ s: "full", code, role: "guest", friend: "" }); return; }
    if (s.friendId) {
      if (list.some(m => m.id === s.friendId)) s.seen = true;
      else if (s.seen) { s.seen = false; friendQuiet(); }   // gone from the room: stepped away (60 seconds to come back)
    }
  };
  const onSig = (msg: Sig) => {
    if (s.cut) return;
    s.stats.sbRecv++;
    if (msg.t === "hello") {
      if (s.role === "host") {
        if (!s.friendId) {
          s.friendId = msg.id; s.friendName = msg.name || "Guest";
          sbSend({ t: "welcome", id: s.id, name: nameRef.current, to: msg.id });
          paired(false); hostOffer();
        } else if (msg.id === s.friendId) {   // the guest is back (or missed the welcome): welcome again and make a fresh pipe
          heard(); s.friendHidden = false;
          sbSend({ t: "welcome", id: s.id, name: nameRef.current, to: msg.id });
          if (s.mode !== "direct" || s.away) hostOffer();
        }
      } else if (msg.id === s.friendId && msg.role === "host") { heard(); s.friendHidden = false; sbSend({ t: "hello", id: s.id, name: nameRef.current, role: "guest" }); }   // the host is back
    } else if (msg.t === "welcome") {
      if (s.role !== "guest" || msg.to !== s.id) return;
      heard(); s.friendHidden = false;
      if (!s.friendId) { s.friendId = msg.id; s.friendName = msg.name || "Guest"; paired(false); }
      else if (msg.id !== s.friendId) return;
    } else if (msg.t === "sdp") { if (msg.to === s.id) { heard(); void onSdp(msg.n, msg.d); } }
    else if (msg.t === "ice") { if (msg.to === s.id) onIce(msg.n, msg.c); }
    else if (msg.t === "bye") { if (msg.id === s.friendId) end("left"); }
    else if (msg.t === "g") { if (s.friendId && msg.id === s.friendId) receive(msg.d as GameMsg); }
  };
  /** (Re)joins the channel for the current session, with the same presence key. */
  function connect() {
    dropChannel();
    const ch = sb().channel(`${game}:${s.code}`, { config: { broadcast: { self: false }, presence: { key: s.id } } });
    s.ch = ch;
    ch.on("broadcast", { event: "m" }, ({ payload }) => { if (s.ch === ch) onSig(payload as Sig); });
    ch.on("presence", { event: "sync" }, () => { if (s.ch === ch) onPresence(ch); });
    ch.subscribe(status => {
      if (s.ch !== ch) return;
      if (status === "SUBSCRIBED") {
        s.subscribed = true; s.everSubscribed = true;
        s.stats.sbSent++; void ch.track({ id: s.id, name: nameRef.current, role: s.role, at: s.at });
        if (s.friendId) sbSend({ t: "hello", id: s.id, name: nameRef.current, role: s.role });   // back in the room: the hellos lead to a fresh pipe
        else if (s.role === "guest") {
          const hello = () => { if (!s.friendId && s.ch === ch) sbSend({ t: "hello", id: s.id, name: nameRef.current, role: "guest" }); };
          hello(); s.timers.push(setInterval(hello, 1500));
          s.timers.push(setTimeout(() => {   // nobody answering: no host, or the host is busy with someone else
            if (s.friendId || s.ch !== ch) return;
            const list = members(ch), host = list.some(m => m.role === "host"), others = list.filter(m => m.role === "guest" && m.id !== s.id).length;
            if (!host || others > 0) { const code = s.code, role = s.role; close(false); setRoom({ s: host ? "full" : "empty", code, role, friend: "" }); }
          }, 8000));
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        s.subscribed = false;
        if (!s.live) return;
        if (!s.everSubscribed && !s.friendId) { const code = s.code, role = s.role; close(false); setRoom({ s: "error", code, role, friend: "" }); return; }
        if (s.friendId && !s.away) setAway({ who: "me", since: Date.now() });
        clearTimeout(s.retry); s.retry = setTimeout(() => { if (s.live && !s.subscribed) connect(); }, 2000);   // try again
      }
    });
  }
  /** Coming back to the page or the network: make sure we're in the channel and tell the friend. */
  const comeBack = () => {
    if (!s.live) return;
    if (!s.subscribed) { connect(); return; }
    shout({ t: "_back" });
    sbSend({ t: "hello", id: s.id, name: nameRef.current, role: s.role });
  };
  const goAway = () => { if (s.live && s.friendId) { save(); shout({ t: "_away" }); if (!s.away) setAway({ who: "me", since: Date.now() }); } };
  function open(code: string, role: Member["role"], resume?: Saved) {
    close(false);
    s.flags = urlFlags(); s.live = true; s.everSubscribed = false;
    s.code = code; s.role = role; s.rtt = 0; s.offerN = 0;
    s.id = resume?.id ?? Math.random().toString(36).slice(2, 10); s.at = resume?.at ?? Date.now();
    s.friendId = resume?.friendId ?? ""; s.friendName = resume?.friendName ?? "Guest";
    s.stats = { sbSent: 0, sbRecv: 0, sbGame: 0, dcSent: 0, dcRecv: 0, since: performance.now(), log: [] };
    const vis = () => { if (document.hidden) goAway(); else comeBack(); };
    const online = () => comeBack();
    document.addEventListener("visibilitychange", vis); window.addEventListener("online", online);
    s.unhook = () => { document.removeEventListener("visibilitychange", vis); window.removeEventListener("online", online); };
    connect();
    if (resume) {   // a reload or a new tab: straight back into the paired room, waiting to hear from the friend
      setMode("relay"); paired(true); setAway({ who: "me", since: Date.now() }); s.lastHeard = 0;
    } else setRoom({ s: role === "host" ? "waiting" : "joining", code, role, friend: "Guest" });
  }
  return {
    room, mode, away,
    create: () => open(newCode(), "host"),
    join: (code: string) => open(code, "guest"),
    resume: (saved: Saved) => open(saved.code, saved.role, saved),
    leave: () => { close(true); setRoom(null); },
    /** Closing the page: not leaving, just stepping away (the saved session can rejoin within 60 seconds). */
    suspend: () => {
      if (!s.live) return;
      goAway(); save();
      s.timers.forEach(t => { clearTimeout(t); clearInterval(t); }); s.timers = [];
      s.unhook(); s.unhook = () => {}; closeRtc(); dropChannel(); s.live = false;
    },
    dismiss: () => setRoom(null),
    send,
    rtt: () => s.rtt,
    netMode: () => s.mode,
    isAway: () => s.away !== null,
    stats: () => s.stats,
    /** debug only: drop everything this phone sends and receives, like a dead network (WebRTC included) */
    cut: (on: boolean) => { s.cut = on; if (!on) comeBack(); },
  };
}
