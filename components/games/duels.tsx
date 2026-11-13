"use client";

// Friend Duels: after today's challenge, "Challenge Someone" saves your name and score under a short code and shares a
// link (?duel=CODE). Whoever opens it plays the same board that day; their first finished Today run is their answer, and
// both of you see who won. The challenger's browser keeps its codes and shows the result next time they open the game.
// No sign-up needed (a name is enough). Server side: supabase/games_duels.sql (app repo), which checks scores with the
// same per-game limits as the scoreboard. Used by the solo daily games through useDuel().
import { useEffect, useRef, useState, type ReactNode } from "react";
import { sb } from "@/components/creators/api";
import { Modal, type Mode, type Shell } from "./kit";
import { SwordsIcon } from "./icons";

type Duel = { code: string; game: string; day: string; today: boolean; a_name: string; a_score: number; b_name: string | null; b_score: number | null };
type Mine = { code: string; game: string; seen?: boolean };
const MINE_KEY = "wya-duels", NAME_KEY = "wya-duel-name";   // codes you sent; the name you last used, if you haven't joined
const readName = () => { try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; } };
const saveName = (n: string) => { try { localStorage.setItem(NAME_KEY, n); } catch {} };
const readMine = (): Mine[] => { try { return JSON.parse(localStorage.getItem(MINE_KEY) || "[]"); } catch { return []; } };
const writeMine = (m: Mine[]) => { try { localStorage.setItem(MINE_KEY, JSON.stringify(m.slice(-30))); } catch {} };
const NAME_ERRORS: Record<string, string> = {
  name_short: "Your name needs at least 2 characters.", name_long: "Keep your name to 20 characters.",
  name_characters: "Use letters, numbers, spaces, dots, dashes or underscores.", name_blocked: "Pick a different name.", name_reserved: "That name is reserved. Pick another.",
};

type View =
  | { kind: "invite"; duel: Duel }                     // someone challenged you (opened a ?duel= link)
  | { kind: "over"; duel: Duel | null; why: string }   // that challenge can't be answered (taken, expired, not found)
  | { kind: "name"; then: "create" | "answer" }        // we need a name first
  | { kind: "share"; code: string }                    // your challenge is ready to send
  | { kind: "result"; duel: Duel; me: "a" | "b" };     // who won

/** `title` is the game's name for messages; `onAccept` switches the game to Today. */
export function useDuel(shell: Shell, game: string, title: string, mode: Mode, onAccept: () => void) {
  const [view, setView] = useState<View | null>(null);
  const [incoming, setIncoming] = useState<Duel | null>(null);   // accepted and not yet answered
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const answered = useRef(false);

  // a ?duel= link, and results of challenges you sent from this browser
  useEffect(() => {
    const code = new URLSearchParams(location.search).get("duel")?.toUpperCase();
    const mine = readMine().filter(m => m.game === game && !m.seen).map(m => m.code);
    const codes = [...new Set([...(code ? [code] : []), ...mine])];
    if (!codes.length) return;
    sb().rpc("game_duel_get", { p_codes: codes }).then(({ data }) => {
      const list = (data as Duel[]) ?? [];
      const theirs = code && !mine.includes(code) ? list.find(d => d.code === code) : null;
      if (code && !mine.includes(code)) {
        if (!theirs) setView({ kind: "over", duel: null, why: "not_found" });
        else if (theirs.game !== game) setView({ kind: "over", duel: theirs, why: "wrong_game" });
        else if (theirs.b_score !== null) setView({ kind: "over", duel: theirs, why: "taken" });
        else if (!theirs.today) setView({ kind: "over", duel: theirs, why: "expired" });
        else setView({ kind: "invite", duel: theirs });
        return;
      }
      const done = list.find(d => d.b_score !== null);   // one of yours got an answer
      if (done) {
        writeMine(readMine().map(m => (m.code === done.code ? { ...m, seen: true } : m)));
        setView({ kind: "result", duel: done, me: "a" });
      }
    });
  }, [game]);

  const [savedName, setSavedName] = useState("");
  useEffect(() => { setSavedName(readName()); }, []);
  const name = shell.player?.name || savedName || undefined;
  const create = async (nm: string) => {
    const f = shell.scores.final; if (!f) return;
    setBusy(true); setErr("");
    const { data } = await sb().rpc("game_duel_create", { p_game: game, p_score: f.score, p_drops: f.drops, p_duration_ms: Math.round(f.ms), p_name: nm });
    setBusy(false);
    if (!data?.ok) { setErr(NAME_ERRORS[data?.error] ?? "We couldn't save your challenge. Try again."); setView({ kind: "name", then: "create" }); return; }
    writeMine([...readMine(), { code: data.code, game }]); saveName(nm); setSavedName(nm);
    setView({ kind: "share", code: data.code });
  };
  const answer = async (nm: string) => {
    const f = shell.scores.final, d = incoming; if (!f || !d) return;
    setBusy(true); setErr("");
    const { data } = await sb().rpc("game_duel_answer", { p_code: d.code, p_score: f.score, p_drops: f.drops, p_duration_ms: Math.round(f.ms), p_name: nm });
    setBusy(false);
    if (data?.ok) { saveName(nm); setSavedName(nm); answered.current = true; setIncoming(null); setView({ kind: "result", duel: { ...d, b_name: data.b_name, b_score: data.b_score }, me: "b" }); return; }
    if (data?.error?.startsWith("name_")) { setErr(NAME_ERRORS[data.error]); setView({ kind: "name", then: "answer" }); return; }
    answered.current = true; setIncoming(null);
    setView({ kind: "over", duel: d, why: data?.error === "expired" ? "expired" : data?.error === "taken" ? "taken" : "error" });
  };

  // your first finished Today run after accepting is your answer
  const final = shell.scores.final;
  useEffect(() => {
    if (!final || !incoming || answered.current || mode !== "daily") return;
    if (name) answer(name); else setView({ kind: "name", then: "answer" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [final]);

  const challenge = () => { if (name) create(name); else setView({ kind: "name", then: "create" }); };
  const button: ReactNode = mode === "daily" && final && final.score > 0 && !incoming ? (
    <button onClick={challenge} disabled={busy} className="wk-btn wk-yellow mt-2.5 h-[42px] w-full text-[16px]">
      {!busy && <SwordsIcon size={18} />}{busy ? "Saving..." : "Challenge Someone"}
    </button>
  ) : null;

  const shareLink = (code: string) => `${location.origin}/games/${game}?duel=${code}`;
  const popup: ReactNode = view ? (
    <DuelCard view={view} title={title} busy={busy} err={err} defaultName={name ?? ""} close={() => { setView(null); setErr(""); }}
      accept={(d) => { setIncoming(d); setView(null); onAccept(); }}
      submitName={(nm) => (view.kind === "name" && view.then === "create" ? create(nm) : answer(nm))}
      share={async (code) => {
        const f = shell.scores.final;
        await shell.share(`I scored ${f?.score.toLocaleString() ?? ""} on today's ${title}. Think you can beat me? ${shareLink(code)}`);
      }}
      challengeBack={challenge} copied={shell.copied} />
  ) : null;
  return { button, popup, playingDuel: incoming };
}

function DuelCard({ view, title, busy, err, defaultName, close, accept, submitName, share, challengeBack, copied }: {
  view: View; title: string; busy: boolean; err: string; defaultName: string; close: () => void; accept: (d: Duel) => void;
  submitName: (n: string) => void; share: (code: string) => void; challengeBack: () => void; copied: boolean;
}) {
  const [nm, setNm] = useState(defaultName);
  const btn = "wk-btn wk-blue mt-4 h-[50px] w-full shrink-0 text-[19px]", quiet = "wk-link mt-2 w-full py-2 text-[15px]";
  return (
    <Modal onClose={close} z="z-30">
      <div className="flex justify-center"><span className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#EAF2FF] text-[#4F88E8]"><SwordsIcon size={30} /></span></div>
      {view.kind === "invite" && (<>
        <div className="wk-f mt-2 text-center text-[24px] leading-tight text-[#0E1F45]">{view.duel.a_name} Challenged You</div>
        <p className="mt-2 text-center text-sm text-[#5a6b85]">Play today&apos;s {title} and beat <b className="text-[#101b2e]">{view.duel.a_score.toLocaleString()}</b>. Same board, one go. Your first finished game counts.</p>
        <button onClick={() => accept(view.duel)} className={btn}>Accept The Challenge</button>
        <button onClick={close} className={quiet}>Not Now</button>
      </>)}
      {view.kind === "over" && (<>
        <div className="wk-f mt-2 text-center text-[24px] leading-tight text-[#0E1F45]">{view.why === "taken" ? "Challenge Already Taken" : view.why === "expired" ? "This Challenge Has Ended" : "Challenge Not Found"}</div>
        <p className="mt-2 text-center text-sm text-[#5a6b85]">
          {view.why === "taken" && view.duel ? `${view.duel.b_name} already took ${view.duel.a_name}'s challenge (${view.duel.b_score?.toLocaleString()} vs ${view.duel.a_score.toLocaleString()}).`
            : view.why === "expired" ? "Challenges only last for the day they were made, since the board changes at midnight."
            : view.why === "wrong_game" ? "That challenge is for a different game." : "We couldn't find that challenge."} You can still play today&apos;s board and send your own.
        </p>
        <button onClick={close} className={btn}>Play Today&apos;s {title}</button>
      </>)}
      {view.kind === "name" && (<>
        <div className="wk-f mt-2 text-center text-[24px] leading-tight text-[#0E1F45]">{view.then === "create" ? "Your Name For The Challenge" : "Your Name"}</div>
        <p className="mt-1 text-center text-sm text-[#5a6b85]">{view.then === "create" ? "So your friend knows who to beat." : "So they know who took them on."}</p>
        <input value={nm} onChange={e => setNm(e.target.value)} maxLength={20} placeholder="e.g. SnackKing" autoFocus
          className="wk-input mt-4 w-full px-3 py-2.5 text-base" />
        {err && <p className="mt-2 text-sm font-semibold text-[#d64545]">{err}</p>}
        <button disabled={busy || nm.trim().length < 2} onClick={() => submitName(nm.trim())} className={btn}>{busy ? "Saving..." : view.then === "create" ? "Make My Challenge" : "See Who Won"}</button>
      </>)}
      {view.kind === "share" && (<>
        <div className="wk-f mt-2 text-center text-[24px] leading-tight text-[#0E1F45]">Your Challenge Is Ready</div>
        <p className="mt-2 text-center text-sm text-[#5a6b85]">Send the link to a friend. They play today&apos;s board, and you&apos;ll see who won next time you open {title}.</p>
        <button onClick={() => share(view.code)} className={btn}>{copied ? "Link Copied!" : "Send The Challenge"}</button>
        <button onClick={close} className={quiet}>Done</button>
      </>)}
      {view.kind === "result" && (() => {
        const d = view.duel, a = d.a_score, b = d.b_score ?? 0, meWon = view.me === "a" ? a > b : b > a, tie = a === b;
        const other = view.me === "a" ? d.b_name : d.a_name;
        return (<>
          <div className="wk-f mt-2 text-center text-[24px] leading-tight text-[#0E1F45]">{tie ? "It's A Tie!" : meWon ? "You Won The Duel! 🎉" : `${other} Won This One`}</div>
          <p className="mt-1 text-center text-sm text-[#5a6b85]">{view.me === "a" ? `${other} took your ${title} challenge.` : `Today's ${title}, same board.`}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            {[[d.a_name, a, view.me === "a"], [d.b_name ?? "", b, view.me === "b"]].map(([n, sc, me], i) => (
              <div key={i} className={`rounded-2xl px-2 py-3 ${(i === 0 ? a > b : b > a) ? "bg-[#e3f6ea]" : "bg-[#f0f6fe]"}`}>
                <div className="wk-f truncate text-[13px] text-[#5a6b85]">{me ? "You" : String(n)}</div>
                <div className="wk-f text-[26px] leading-tight tabular-nums text-[#0E1F45]">{Number(sc).toLocaleString()}</div>
              </div>
            ))}
          </div>
          {view.me === "b" && <button onClick={challengeBack} className={btn}>Challenge Someone Else</button>}
          <button onClick={close} className={view.me === "b" ? quiet : btn}>{view.me === "b" ? "Done" : "Nice"}</button>
        </>);
      })()}
    </Modal>
  );
}
