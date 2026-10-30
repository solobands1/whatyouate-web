"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./Shell";
import {
  errorText,
  outreachCommented,
  outreachDecide,
  outreachDecideBlock,
  outreachList,
  outreachSettings,
  outreachUpdateHook,
  sb,
  type OutreachContact,
  type OutreachData,
} from "./api";
import { BODY, INK } from "../site";

// The owner's creator outreach queue (/creators/owner/outreach): totals, sending on/off and pause, then creators in
// blocks of 15 to approve or skip. The app server's cron sends the approved ones (email 1, then day 4 and day 10) and
// stops for anyone who replies, signs up, says no thanks or bounces. Everything comes from owner_outreach_* in
// outreach.sql, which refuses anyone who isn't an owner, so the page itself holds nothing private.

const FAINT = "#8FA3C0";
const BLUE = "#2F6FC4";
const GREEN = "#2E9E6A";
const RED = "#C2410C";

const STATUS: Record<OutreachContact["status"], { label: string; color: string; bg: string }> = {
  queued: { label: "Waiting", color: BODY, bg: "#EEF2F8" },
  sent: { label: "", color: BLUE, bg: "#EEF5FE" },
  done: { label: "No Reply", color: FAINT, bg: "#F3F5F9" },
  replied: { label: "Replied", color: "#B45309", bg: "#FFF4E0" },
  joined: { label: "Signed Up", color: GREEN, bg: "#E8F6EF" },
  opted_out: { label: "No Thanks", color: FAINT, bg: "#F3F5F9" },
  bounced: { label: "Bounced", color: RED, bg: "#FDECE6" },
};

function statusOf(c: OutreachContact) {
  if (c.decision === "skip") return { label: "Not Sending", color: FAINT, bg: "#F3F5F9" };
  if (c.status === "sent") return { label: c.sent.length === 1 ? "Email 1 Sent" : `Follow-up ${c.sent.length - 1} Sent`, color: BLUE, bg: "#EEF5FE" };
  if (c.status === "queued") return c.decision === "approve" ? { label: "Approved", color: GREEN, bg: "#E8F6EF" } : { label: "Needs Review", color: BODY, bg: "#EEF2F8" };
  return STATUS[c.status];
}

const shortDate = (ts: number) => new Date(ts).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

function Pill({ s }: { s: { label: string; color: string; bg: string } }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

export default function OwnerOutreach() {
  const router = useRouter();
  const [data, setData] = useState<OutreachData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notOwner" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<OutreachContact | null>(null);
  const [confirmLive, setConfirmLive] = useState(false);

  const load = useCallback(async () => {
    const { data: session } = await sb().auth.getSession();
    if (!session.session) {
      router.replace(`/creators/login?next=${encodeURIComponent("/creators/owner/outreach")}`);
      return;
    }
    try {
      setData(await outreachList());
      setState("ready");
    } catch (e) {
      setState(/not_owner/.test(String((e as { message?: string })?.message)) ? "notOwner" : "error");
    }
  }, [router]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      if (done) setMessage(done);
    } catch (e) {
      setMessage(errorText(e));
    }
    await load();
  };

  // Three places, so nobody already emailed ever shows up as someone new to review:
  //   To Review: creators not emailed yet (needs review or approved and waiting), grouped by block.
  //   In Progress: emailed and still in the sequence (follow-ups to come).
  //   Finished: replied, signed up, no thanks, bounced, finished with no reply, or skipped.
  const groups = useMemo(() => {
    const all = data?.contacts ?? [];
    const notSent = all.filter((c) => !c.sent.length && c.decision !== "skip" && c.status === "queued");
    const by = new Map<number, OutreachContact[]>();
    for (const c of notSent) by.set(c.block, [...(by.get(c.block) ?? []), c]);
    return {
      review: [...by.entries()].sort((a, b) => a[0] - b[0]).map(([block, rows]) => ({ block, rows })),
      inProgress: all.filter((c) => c.sent.length && c.status === "sent"),
      finished: all.filter((c) => c.decision === "skip" || !["queued", "sent"].includes(c.status)),
    };
  }, [data]);

  if (state === "loading") return <p className="py-24 text-center text-[15px]" style={{ color: BODY }}>Loading…</p>;
  if (state !== "ready" || !data) {
    return (
      <Card className="px-7 py-9 text-center">
        <h1 className="text-[22px] font-bold tracking-[-0.03em]" style={{ color: INK }}>{state === "notOwner" ? "Not Allowed" : "Couldn't Load"}</h1>
        <p className="mt-3 text-[15.5px] leading-[1.6]" style={{ color: BODY }}>
          {state === "notOwner" ? "This page is only for the program's owners." : "Something went wrong loading outreach. Try again in a moment."}
        </p>
      </Card>
    );
  }

  const { settings, stats } = data;
  const waiting = data.contacts.filter((c) => c.decision === "pending").length;
  const approvedQueued = data.contacts.filter((c) => c.decision === "approve" && c.status === "queued").length;
  const totals = [
    { label: "Emails Sent", value: stats.sent, note: `${stats.contacted} creators contacted` },
    { label: "Replies", value: stats.replied },
    { label: "Signed Up", value: stats.joined },
    { label: "No Thanks", value: stats.optedOut, note: stats.bounced ? `${stats.bounced} bounced` : undefined },
  ];

  return (
    <div className="-mt-6 sm:-mt-10">
      <div className="mx-auto max-w-[65rem]">
        <a href="/creators/owner" className="text-[14px] font-semibold" style={{ color: BLUE }}>
          ‹ Owner
        </a>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[clamp(28px,4.4vw,40px)] font-bold leading-[1.1] tracking-[-0.04em]">Outreach</h1>
            <p className="mt-1 text-[14px]" style={{ color: BODY }}>
              Approve creators in blocks. Approved ones get email 1, then a follow-up on day 4 and day 10, Monday to Thursday.
            </p>
          </div>
          <button type="button" onClick={() => load()} className="text-[14px] font-semibold" style={{ color: BLUE }}>
            Refresh
          </button>
        </div>

        {message && (
          <div className="mt-5 rounded-2xl px-5 py-3.5 text-[14px] font-medium" style={{ background: "#EEF5FE", color: INK }}>
            {message}
          </div>
        )}

        {/* Sending switch and pause */}
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-[15px] font-semibold" style={{ color: INK }}>
              {!settings.live ? "Sending Is Off" : settings.paused ? "Paused" : "Sending"}
            </p>
            <p className="text-[13px]" style={{ color: BODY }}>
              {!settings.live
                ? "Nothing goes out until you turn sending on."
                : settings.paused
                  ? "Nothing is going out, follow-ups included, until you resume."
                  : `About 8 new creators a day, Monday to Thursday, 10:30 to 2:00 in their time zone. ${approvedQueued} approved and waiting.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!settings.live ? (
              <button type="button" onClick={() => setConfirmLive(true)} className="rounded-full px-4 py-2 text-[14px] font-semibold text-white" style={{ background: INK }}>
                Turn On Sending
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => act(() => outreachSettings(null, !settings.paused), settings.paused ? "Resumed." : "Paused. Nothing will send until you resume.")}
                  className="rounded-full px-4 py-2 text-[14px] font-semibold text-white"
                  style={{ background: settings.paused ? GREEN : RED }}
                >
                  {settings.paused ? "Resume" : "Pause"}
                </button>
                <button type="button" onClick={() => act(() => outreachSettings(false, null), "Sending is off.")} className="rounded-full px-4 py-2 text-[14px] font-semibold ring-1 ring-[#16233B]/[0.12]" style={{ color: INK }}>
                  Turn Off
                </button>
              </>
            )}
          </div>
        </Card>

        {/* Totals */}
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {totals.map((t) => (
            <div key={t.label} className="rounded-2xl bg-white/80 px-4 py-3.5 ring-1" style={{ ["--tw-ring-color" as string]: "#16233B10" }}>
              <p className="text-[12px] font-medium" style={{ color: BODY }}>{t.label}</p>
              <p className="text-[22px] font-bold leading-[1.3] tracking-[-0.02em] tabular-nums" style={{ color: INK }}>{t.value}</p>
              {t.note && <p className="mt-0.5 text-[12px]" style={{ color: FAINT }}>{t.note}</p>}
            </div>
          ))}
        </div>
        {waiting > 0 && (
          <p className="mt-4 text-[14px] font-medium" style={{ color: INK }}>
            {waiting} creator{waiting === 1 ? "" : "s"} waiting for your review.
          </p>
        )}
      </div>

      {/* To review: never includes anyone already emailed */}
      <div className="mx-auto max-w-[65rem]">
        {groups.review.map((b) => (
          <Block key={b.block} block={b.block} rows={b.rows} act={act} onEdit={setEditing} />
        ))}
        {!groups.review.length && (
          <Card className="mt-8 px-6 py-8 text-center text-[14.5px]">
            <span style={{ color: BODY }}>Nobody new to review. Next week&apos;s block is added on Friday.</span>
          </Card>
        )}
        {groups.inProgress.length > 0 && (
          <List title="In Progress" note="Emailed, follow-ups still to come" rows={groups.inProgress} act={act} onEdit={setEditing} />
        )}
        {groups.finished.length > 0 && (
          <details className="mt-8">
            <summary className="cursor-pointer text-[15px] font-semibold" style={{ color: INK }}>
              Finished ({groups.finished.length})
            </summary>
            <List title="" note="" rows={groups.finished} act={act} onEdit={setEditing} />
          </details>
        )}
      </div>

      {editing && (
        <EditLine
          c={editing}
          onClose={() => setEditing(null)}
          onSave={(hook) => {
            const c = editing;
            setEditing(null);
            act(() => outreachUpdateHook(c.id, hook), `Saved ${c.firstName}'s line.`);
          }}
        />
      )}
      {confirmLive && (
        <Modal onClose={() => setConfirmLive(false)}>
          <h2 className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: INK }}>Turn On Sending?</h2>
          <p className="mt-2 text-[14.5px] leading-[1.6]" style={{ color: BODY }}>
            Approved creators start getting email 1 at the next send window (Monday to Thursday, 10:30 to 2:00 their time). You&apos;ll get a preview email each morning, and you can pause anytime here.
          </p>
          <p className="mt-2 text-[14px] font-medium" style={{ color: RED }}>Check the App Store shows Integrity Stack Inc. as the seller first.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmLive(false)} className="rounded-full px-4 py-2 text-[14px] font-semibold" style={{ color: INK }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmLive(false);
                act(() => outreachSettings(true, false), "Sending is on.");
              }}
              className="rounded-full px-4 py-2 text-[14px] font-semibold text-white"
              style={{ background: INK }}
            >
              Turn On
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function handleLinks(c: OutreachContact) {
  const links: { label: string; href: string }[] = [];
  if (c.instagram) links.push({ label: `@${c.instagram}`, href: `https://www.instagram.com/${c.instagram}/` });
  if (c.tiktok) links.push({ label: `TikTok @${c.tiktok}`, href: `https://www.tiktok.com/@${c.tiktok}` });
  if (!links.length && c.website) links.push({ label: c.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), href: c.website });
  return links;
}

function List({ title, note, rows, act, onEdit }: { title: string; note: string; rows: OutreachContact[]; act: (fn: () => Promise<unknown>, done?: string) => Promise<void>; onEdit: (c: OutreachContact) => void }) {
  return <Block block={0} title={title} note={note} rows={rows} act={act} onEdit={onEdit} />;
}

function Block({
  block,
  title,
  note,
  rows,
  act,
  onEdit,
}: {
  block: number;
  title?: string;
  note?: string;
  rows: OutreachContact[];
  act: (fn: () => Promise<unknown>, done?: string) => Promise<void>;
  onEdit: (c: OutreachContact) => void;
}) {
  const pending = rows.filter((c) => c.decision === "pending").length;
  const approved = rows.filter((c) => c.decision === "approve").length;
  const warmable = rows.filter((c) => c.warmPostUrl && c.decision !== "skip");
  const warmed = warmable.filter((c) => c.commentedAt).length;
  return (
    <section className="mt-8">
      {title !== undefined ? (
        title && (
          <h2 className="text-[19px] font-bold tracking-[-0.02em]" style={{ color: INK }}>
            {title}
            <span className="ml-2 text-[14px] font-medium" style={{ color: BODY }}>{rows.length}{note ? ` · ${note}` : ""}</span>
          </h2>
        )
      ) : (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[19px] font-bold tracking-[-0.02em]" style={{ color: INK }}>
          Block {block}
          <span className="ml-2 text-[14px] font-medium" style={{ color: BODY }}>
            {approved} of {rows.length} approved{pending ? `, ${pending} to review` : ""}
            {warmable.length > 0 && `, ${warmed} of ${warmable.length} warmed up`}
          </span>
        </h2>
        {pending > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => act(() => outreachDecideBlock(block, "approve"), `Approved the rest of block ${block}.`)}
              className="rounded-full px-4 py-2 text-[14px] font-semibold text-white"
              style={{ background: GREEN }}
            >
              Approve All {pending}
            </button>
          </div>
        )}
      </div>
      )}
      <Card className="mt-3 divide-y divide-[#16233B]/[0.06]">
        {rows.map((c) => {
          const locked = c.sent.length > 0;
          return (
            <div key={c.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-start md:gap-5">
              <div className="md:w-[15rem] md:shrink-0">
                <p className="text-[15px] font-semibold" style={{ color: INK }}>
                  {c.fullName || c.firstName}
                  <span className="ml-1.5 text-[12px] font-medium" style={{ color: FAINT }}>{c.currency}</span>
                </p>
                <p className="break-all text-[13px]" style={{ color: BODY }}>{c.email}</p>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] font-semibold">
                  {handleLinks(c).map((l) => (
                    <a key={l.href} href={l.href} target="_blank" rel="noreferrer" style={{ color: BLUE }}>
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] leading-[1.55]" style={{ color: INK }}>{c.hook}</p>
                {!locked && (
                  <button type="button" onClick={() => onEdit(c)} className="mt-1 text-[13px] font-semibold" style={{ color: BLUE }}>
                    Edit Line
                  </button>
                )}
                {locked && (
                  <p className="mt-1 text-[12.5px]" style={{ color: FAINT }}>
                    {c.sent.map((s) => `Email ${s.step}: ${shortDate(s.ts)}`).join(" · ")}
                  </p>
                )}
                {c.warmPostUrl && c.decision !== "skip" && <WarmUp c={c} act={act} />}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 md:w-[15rem] md:justify-end">
                <Pill s={statusOf(c)} />
                {!locked && (
                  <>
                    {c.decision !== "approve" && (
                      <button
                        type="button"
                        onClick={() => act(() => outreachDecide(c.id, "approve"))}
                        className="rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1"
                        style={{ color: GREEN, ["--tw-ring-color" as string]: "#2E9E6A55" }}
                      >
                        Approve
                      </button>
                    )}
                    {c.decision !== "skip" && (
                      <button
                        type="button"
                        onClick={() => act(() => outreachDecide(c.id, "skip"))}
                        className="rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1"
                        style={{ color: RED, ["--tw-ring-color" as string]: "#C2410C40" }}
                      >
                        Don&apos;t Send
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </Card>
    </section>
  );
}

function WarmUp({ c, act }: { c: OutreachContact; act: (fn: () => Promise<unknown>, done?: string) => Promise<void> }) {
  const [copied, setCopied] = useState(false);
  const done = !!c.commentedAt;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(c.warmComment);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="mt-3 rounded-2xl px-3.5 py-3" style={{ background: done ? "#F1F8F4" : "#F5F8FD" }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: FAINT }}>Warm-Up</span>
        <a href={c.warmPostUrl} target="_blank" rel="noreferrer" className="text-[13px] font-semibold" style={{ color: BLUE }}>
          Open Latest Post ›
        </a>
      </div>
      {c.warmComment && (
        <p className="mt-1.5 text-[13.5px] leading-[1.5]" style={{ color: INK }}>
          &ldquo;{c.warmComment}&rdquo;
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {c.warmComment && (
          <button type="button" onClick={copy} className="rounded-full bg-white px-3 py-1 text-[12.5px] font-semibold ring-1 ring-[#16233B]/[0.1]" style={{ color: INK }}>
            {copied ? "Copied" : "Copy Comment"}
          </button>
        )}
        <button
          type="button"
          onClick={() => act(() => outreachCommented(c.id, !done))}
          className="rounded-full px-3 py-1 text-[12.5px] font-semibold"
          style={done ? { color: GREEN, background: "#E2F3EA" } : { color: "#FFFFFF", background: GREEN }}
        >
          {done ? "✓ Commented" : "Mark Commented"}
        </button>
      </div>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0B1424]/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-[34rem] rounded-3xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function EditLine({ c, onClose, onSave }: { c: OutreachContact; onClose: () => void; onSave: (hook: string) => void }) {
  const [hook, setHook] = useState(c.hook);
  const ok = hook.trim().length >= 10 && hook.length <= 400;
  return (
    <Modal onClose={onClose}>
      <h2 className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: INK }}>{c.firstName}&apos;s Line</h2>
      <p className="mt-1 text-[13.5px]" style={{ color: BODY }}>
        The one sentence that&apos;s different for each creator. Name one specific thing of theirs, then the overlap.
      </p>
      <textarea
        id="outreach-hook"
        value={hook}
        onChange={(e) => setHook(e.target.value)}
        rows={4}
        className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-[14.5px] leading-[1.55] ring-1 ring-[#16233B]/[0.12] outline-none focus:ring-2 focus:ring-[#6FA8FF]"
        style={{ color: INK }}
      />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-[14px] font-semibold" style={{ color: INK }}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!ok}
          onClick={() => onSave(hook)}
          className="rounded-full px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-40"
          style={{ background: INK }}
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
