"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./Shell";
import {
  errorText,
  ownerExport,
  ownerOverview,
  ownerReopenPayout,
  ownerSetCreatorStatus,
  ownerSetPayout,
  ownerUpdateCreator,
  sb,
  sendPayoutEmail,
  type OwnerCreator,
  type OwnerOverview,
} from "./api";
import { PAYOUT_LABEL, longDate, money } from "./shared";
import { BODY, INK } from "../site";

// The program owner's page (/creators/owner): totals, one row per creator, each payout's status, a
// month filter, private notes, and a spreadsheet for the accountant. Everything shown comes from the
// owner_* functions in creators.sql, which refuse anyone not in creator_owners, so the page itself
// holds nothing private.

const FAINT = "#8FA3C0";
const RED = "#C2410C";
type Status = "due" | "paid" | "withheld";
type Action = { c: OwnerCreator; kind: "paid" | "withheld" | "returned" | "remove" | "restore" };

const fullDate = (iso: string) => `${longDate(iso)}, ${iso.slice(0, 4)}`;
const monthName = (ym: string) => new Date(`${ym}-01T12:00:00`).toLocaleDateString("en-CA", { month: "long", year: "numeric" });
const methodLabel = (c: { payoutMethod: OwnerCreator["payoutMethod"] }) => (c.payoutMethod === "wise" ? "Wise" : PAYOUT_LABEL[c.payoutMethod]);
const firstName = (name: string) => name.split(" ")[0];

// Pill dropdowns draw their own arrow, inset from the rounded end: the browser's arrow sits at the
// very edge and pokes out past the curve in Safari.
const chevron = (color: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='${color}' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M3 4.5l3 3 3-3'/></svg>`)}")`;
const pillSelect = (color: string, inset: number) => ({
  appearance: "none" as const,
  WebkitAppearance: "none" as const,
  backgroundImage: chevron(color),
  backgroundRepeat: "no-repeat",
  backgroundPosition: `right ${inset}px center`,
  backgroundSize: "12px 12px",
});

/** Sums by currency, shown as "$12.00 CAD" and "$3.00 USD" lines (or $0.00 when there's nothing). */
function byCurrency(rows: OwnerCreator[], pick: (c: OwnerCreator) => number) {
  const sums: Record<string, number> = {};
  for (const c of rows) sums[c.currency] = (sums[c.currency] ?? 0) + pick(c);
  const lines = Object.entries(sums).filter(([, v]) => Math.abs(v) >= 0.005).map(([cur, v]) => money(v, cur));
  return lines.length ? lines : ["$0.00"];
}

export default function Owner() {
  const router = useRouter();
  const [data, setData] = useState<OwnerOverview | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notOwner" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [managing, setManaging] = useState<OwnerCreator | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(
    async (m: string | null) => {
      const { data: session } = await sb().auth.getSession();
      if (!session.session) {
        router.replace(`/creators/login?next=${encodeURIComponent("/creators/owner")}`);
        return;
      }
      try {
        setData(await ownerOverview(m));
        setState("ready");
      } catch (e) {
        setState(/not_owner/.test(String((e as { message?: string })?.message)) ? "notOwner" : "error");
      }
    },
    [router],
  );
  // The month lives in the address (?month=2026-11), so a refresh or Back keeps it.
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("month");
    const valid = m && /^\d{4}-\d{2}$/.test(m) ? m : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMonth(valid);
    load(valid);
  }, [load]);
  const chooseMonth = (m: string | null) => {
    setMonth(m);
    const url = new URL(window.location.href);
    if (m) url.searchParams.set("month", m);
    else url.searchParams.delete("month");
    window.history.replaceState(null, "", url);
    load(m);
  };

  // Work to do first: due payouts, then withheld ones, then creators with no payout, then paid ones.
  // Within each group, the most owed first.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = data?.creators ?? [];
    const found = q ? all.filter((c) => [c.name, c.email, c.code, c.payoutEmail, c.notes].some((v) => v.toLowerCase().includes(q))) : all;
    const rank = (c: OwnerCreator) => (!c.payout ? 2 : { due: 0, withheld: 1, paid: 3 }[c.payout.status]);
    return [...found].sort((a, b) => rank(a) - rank(b) || b.owed - a.owed || a.name.localeCompare(b.name));
  }, [data, query]);

  if (state === "loading") return <p className="py-24 text-center text-[15px]" style={{ color: BODY }}>Loading…</p>;
  if (state !== "ready" || !data) {
    return (
      <Card className="px-7 py-9 text-center">
        <h1 className="text-[22px] font-bold tracking-[-0.03em]" style={{ color: INK }}>{state === "notOwner" ? "Not Allowed" : "Couldn't Load"}</h1>
        <p className="mt-3 text-[15.5px] leading-[1.6]" style={{ color: BODY }}>
          {state === "notOwner" ? "This page is only for the program's owners." : "Something went wrong loading the owner page. Try again in a moment."}
        </p>
      </Card>
    );
  }

  const all = data.creators;
  const label = month ? monthName(month) : null;
  const withPayout = all.filter((c) => c.payout);
  const due = all.filter((c) => c.payout?.status === "due");
  const totals: { label: string; lines: string[]; note?: string; strong?: boolean }[] = [
    { label: "Creators", lines: [String(all.filter((c) => c.status === "active").length)], note: `${all.length} joined in total` },
    { label: month ? `Users Brought In, ${label}` : "Users Brought In", lines: [String(all.reduce((t, c) => t + c.codeUses, 0))], note: `${all.reduce((t, c) => t + c.signups, 0)} signups that count` },
    { label: month ? `New Paying Subscribers, ${label}` : "Paying Subscribers", lines: [String(all.reduce((t, c) => t + c.paying, 0))] },
    { label: month ? `Earned In ${label}` : "Earned All Time", lines: byCurrency(all, (c) => c.earned) },
    { label: month ? `Paid Out In ${label}` : "Paid Out", lines: byCurrency(all, (c) => c.paidOut) },
    { label: "Owed Now", lines: byCurrency(all, (c) => c.owed), note: "Includes earnings not yet due" },
    month
      ? {
          label: `Payouts Worked Out In ${label}`,
          lines: byCurrency(withPayout, (c) => c.payout?.amount ?? 0),
          note: `${withPayout.filter((c) => c.payout?.status === "paid").length} paid, ${withPayout.filter((c) => c.payout?.status !== "paid").length} not sent`,
        }
      : { label: "To Send Now", lines: byCurrency(due, (c) => c.payout?.amount ?? 0), note: `${due.length} payout${due.length === 1 ? "" : "s"} due`, strong: due.length > 0 },
    { label: "Free Pro Codes Left", lines: [`${data.proCodes.threeMonths} three-month`, `${data.proCodes.year} one-year`] },
  ];
  const onStatus = (c: OwnerCreator, to: Status) => (to === "due" ? run({ c, kind: "withheld" }, "", "due") : setAction({ c, kind: to }));

  return (
    <div className="-mt-6 sm:-mt-10">
      {/* The title and totals keep the site's usual width; only the creators table uses the full page. */}
      <div className="mx-auto max-w-[65rem]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[clamp(28px,4.4vw,40px)] font-bold leading-[1.1] tracking-[-0.04em]">Owner</h1>
          <p className="mt-1 text-[14px]" style={{ color: BODY }}>
            Payouts are worked out on the 1st. Send them in the first week, then mark each one paid.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={month ?? ""}
            onChange={(e) => chooseMonth(e.target.value || null)}
            className="rounded-full bg-white py-2 pl-4 pr-10 text-[14px] font-semibold ring-1 ring-[#16233B]/[0.1] outline-none focus:ring-2 focus:ring-[#6FA8FF]"
            style={{ color: INK, ...pillSelect(INK, 16) }}
            aria-label="Month"
          >
            <option value="">All Time</option>
            {data.months.map((m) => (
              <option key={m} value={m}>{monthName(m)}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={async () => {
              setExporting(true);
              try {
                const [payouts, everything] = await Promise.all([ownerExport(), month ? ownerOverview(null) : Promise.resolve(data)]);
                await downloadOwnerSheet(everything.creators, payouts);
              } catch (e) {
                setMessage(errorText(e));
              }
              setExporting(false);
            }}
            className="text-[14px] font-semibold"
            style={{ color: "#2F6FC4" }}
          >
            {exporting ? "Preparing…" : "Download Spreadsheet"}
          </button>
          <button type="button" onClick={() => load(month)} className="text-[14px] font-semibold" style={{ color: "#2F6FC4" }}>
            Refresh
          </button>
        </div>
      </div>
      {month && (
        <p className="mt-2 text-[13px]" style={{ color: FAINT }}>
          Showing {label}: users, signups, new paying subscribers and earnings in that month, and the payout worked out on its 1st. Owed is as of today.
        </p>
      )}

      {message && (
        <div className="mt-5 rounded-2xl px-5 py-3.5 text-[14px] font-medium" style={{ background: "#EEF5FE", color: INK }}>
          {message}
        </div>
      )}

      {/* Totals */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {totals.map((t) => (
          <div
            key={t.label}
            className="rounded-2xl bg-white/80 px-4 py-3.5 ring-1"
            style={{ ["--tw-ring-color" as string]: t.strong ? "#B9D4FA" : "#16233B10", background: t.strong ? "#EEF5FE" : undefined }}
          >
            <p className="text-[12px] font-medium" style={{ color: BODY }}>{t.label}</p>
            {t.lines.map((l) => (
              <p key={l} className="text-[18px] font-bold leading-[1.3] tracking-[-0.02em] tabular-nums" style={{ color: INK }}>{l}</p>
            ))}
            {t.note && <p className="mt-0.5 text-[12px]" style={{ color: FAINT }}>{t.note}</p>}
          </div>
        ))}
      </div>
      </div>

      {/* Creators */}
      <div className="mt-9 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[19px] font-bold tracking-[-0.02em]" style={{ color: INK }}>Creators</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, code or notes"
          className="w-full rounded-full bg-white px-4 py-2 text-[14px] ring-1 ring-[#16233B]/[0.1] outline-none focus:ring-2 focus:ring-[#6FA8FF] sm:w-72"
          style={{ color: INK }}
        />
      </div>

      {/* Phones get stacked cards, so the payout dropdown is always in reach. */}
      <Card className="mt-3 divide-y divide-[#16233B]/[0.06] xl:hidden">
        {rows.map((c) => (
          <PhoneCard key={c.id} c={c} month={month} onStatus={(to) => onStatus(c, to)} onReturned={() => setAction({ c, kind: "returned" })} onManage={() => setManaging(c)} />
        ))}
        {!rows.length && <p className="px-5 py-6 text-center text-[14px]" style={{ color: BODY }}>{all.length ? "No creators match that search." : "No creators yet."}</p>}
      </Card>
      {/* The full table only where it fits without scrolling sideways; narrower screens get the cards. */}
      <Card className="mt-3 hidden xl:block">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr style={{ color: FAINT }}>
              {["Creator", "Code", "Users", "Signups", month ? "New Paying" : "Paying", "Earned", "Paid Out", "Owed", "Payout"].map((h, i) => (
                <th key={h} className={`border-b border-[#16233B]/[0.06] px-3 pb-2.5 pt-4 font-semibold first:pl-5 last:pr-5 ${i >= 2 && i <= 7 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ color: INK }}>
            {rows.map((c) => (
              <Row key={c.id} c={c} month={month} onStatus={(to) => onStatus(c, to)} onReturned={() => setAction({ c, kind: "returned" })} onManage={() => setManaging(c)} />
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center" style={{ color: BODY }}>
                  {all.length ? "No creators match that search." : "No creators yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {action && <Confirm a={action} onCancel={() => setAction(null)} onConfirm={(ref, withhold) => run(action, ref, undefined, withhold)} />}
      {managing && (
        <Manage
          c={managing}
          onClose={() => setManaging(null)}
          onSave={async (notes, posted) => {
            setManaging(null);
            try {
              await ownerUpdateCreator(managing.id, notes, posted);
              setMessage(`Saved ${firstName(managing.name)}'s notes.`);
            } catch (e) {
              setMessage(errorText(e));
            }
            await load(month);
          }}
          onRemove={() => {
            setManaging(null);
            setAction({ c: managing, kind: managing.status === "removed" ? "restore" : "remove" });
          }}
        />
      )}
    </div>
  );

  async function run(a: Action, reference: string, payoutTo?: "due", withhold = true) {
    setAction(null);
    setMessage(null);
    const first = firstName(a.c.name);
    try {
      if (payoutTo === "due" && a.c.payout) {
        await ownerSetPayout(a.c.payout.id, "due", "");
        setMessage(`${first}'s payout is back to due.`);
      } else if (a.kind === "paid" && a.c.payout) {
        await ownerSetPayout(a.c.payout.id, "paid", reference);
        const emailed = await sendPayoutEmail(a.c.payout.id);
        setMessage(emailed ? `Marked paid. ${first} has been emailed their statement.` : "Marked paid. The statement email didn't go out just now, so tomorrow morning's run will send it.");
      } else if (a.kind === "withheld" && a.c.payout) {
        await ownerSetPayout(a.c.payout.id, "withheld", reference);
        setMessage(`${first}'s payout is withheld.`);
      } else if (a.kind === "returned" && a.c.payout) {
        await ownerReopenPayout(a.c.payout.id);
        setMessage(`${first}'s payout is back to due. Resend it, then mark it paid again.`);
      } else if (a.kind === "remove") {
        await ownerSetCreatorStatus(a.c.id, "removed", withhold);
        setMessage(`${a.c.name} is removed from the program. Their code no longer works.`);
      } else if (a.kind === "restore") {
        await ownerSetCreatorStatus(a.c.id, "active");
        setMessage(`${a.c.name} is back in the program.`);
      }
    } catch (e) {
      setMessage(errorText(e));
    }
    await load(month);
  }
}

// ---- Rows ------------------------------------------------------------------------------

type RowProps = { c: OwnerCreator; month: string | null; onStatus: (to: Status) => void; onReturned: () => void; onManage: () => void };

function Badges({ c }: { c: OwnerCreator }) {
  return (
    <>
      {c.status !== "active" && <span className="ml-1.5 text-[12px] font-semibold" style={{ color: RED }}>{c.status === "left" ? "Left" : "Removed"}</span>}
      {c.posted && <span className="ml-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#E7F6EC", color: "#15803D" }}>Posted</span>}
    </>
  );
}

function Row({ c, month, onStatus, onReturned, onManage }: RowProps) {
  // The currency shows once, under the code, so the amounts stay narrow.
  const amt = (n: number) => money(n, c.currency).replace(` ${c.currency}`, "");
  const cell = "border-b border-[#16233B]/[0.06] px-3 py-3 align-top first:pl-5 last:pr-5";
  return (
    <tr>
      <td className={`${cell} min-w-[190px]`}>
        <p className="font-semibold">
          {c.name}
          <Badges c={c} />
        </p>
        <p className="break-all text-[12.5px]" style={{ color: BODY }}>{c.email}</p>
        <p className="text-[12px]" style={{ color: FAINT }}>{c.country === "OTHER" ? "Outside CA/US" : c.country} · joined {fullDate(c.joined)}</p>
        {c.notes && <p className="mt-1 line-clamp-2 text-[12.5px] italic" style={{ color: BODY }}>{c.notes}</p>}
        <button type="button" onClick={onManage} className="mt-1 text-[12.5px] font-semibold" style={{ color: "#2F6FC4" }}>
          Notes &amp; Manage
        </button>
      </td>
      <td className={cell}>
        <p className="font-semibold tracking-[0.03em]">{c.code}</p>
        <p className="text-[12px]" style={{ color: FAINT }}>{c.currency}</p>
      </td>
      <td className={`${cell} text-right tabular-nums`}>{c.codeUses}</td>
      <td className={`${cell} text-right tabular-nums`}>{c.signups}</td>
      <td className={`${cell} text-right tabular-nums`}>{c.paying}</td>
      <td className={`${cell} whitespace-nowrap text-right tabular-nums`}>{amt(c.earned)}</td>
      <td className={`${cell} whitespace-nowrap text-right tabular-nums`}>{amt(c.paidOut)}</td>
      <td className={`${cell} whitespace-nowrap text-right font-semibold tabular-nums`}>{amt(c.owed)}</td>
      <td className={`${cell} w-[260px]`}>
        <PayoutCell c={c} month={month} onStatus={onStatus} onReturned={onReturned} />
      </td>
    </tr>
  );
}

/** One creator on a phone: the same facts as a table row, stacked. */
function PhoneCard({ c, month, onStatus, onReturned, onManage }: RowProps) {
  const amt = (n: number) => money(n, c.currency);
  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold" style={{ color: INK }}>
            {c.name}
            <Badges c={c} />
          </p>
          <p className="truncate text-[12.5px]" style={{ color: BODY }}>{c.email}</p>
        </div>
        <span className="shrink-0 text-[13px] font-semibold tracking-[0.03em]" style={{ color: INK }}>{c.code}</span>
      </div>
      <p className="mt-2 text-[12.5px]" style={{ color: BODY }}>
        {c.codeUses} users · {c.signups} signups · {c.paying} {month ? "new paying" : "paying"}
      </p>
      <p className="text-[12.5px]" style={{ color: BODY }}>
        Earned {amt(c.earned)} · Paid {amt(c.paidOut)} · <span className="font-semibold" style={{ color: INK }}>Owed {amt(c.owed)}</span>
      </p>
      {c.notes && <p className="mt-1 line-clamp-2 text-[12.5px] italic" style={{ color: BODY }}>{c.notes}</p>}
      <div className="mt-3 text-[13.5px]" style={{ color: INK }}>
        <PayoutCell c={c} month={month} onStatus={onStatus} onReturned={onReturned} />
      </div>
      <button type="button" onClick={onManage} className="mt-2 text-[12.5px] font-semibold" style={{ color: "#2F6FC4" }}>
        Notes &amp; Manage
      </button>
    </div>
  );
}

/** The payout's amount and status: a dropdown while it's due or withheld, the paid date after. */
function PayoutCell({ c, month, onStatus, onReturned }: { c: OwnerCreator; month: string | null; onStatus: (to: Status) => void; onReturned: () => void }) {
  const [copied, setCopied] = useState(false);
  const amt = (n: number) => money(n, c.currency);
  const p = c.payout;
  if (!p) return <span style={{ color: FAINT }}>{month ? "No payout this month" : "No payout yet"}</span>;
  if (p.status === "paid") {
    return (
      <>
        <p className="font-semibold">{amt(p.amount)}</p>
        <p className="text-[12.5px]" style={{ color: "#15803D" }}>
          Paid {p.paidOn ? fullDate(p.paidOn) : ""}
          <button type="button" onClick={onReturned} className="ml-2 font-semibold transition hover:opacity-70" style={{ color: RED }} title="The money came back: reopen this payout">
            Returned
          </button>
        </p>
        {p.reference && <p className="text-[12px]" style={{ color: FAINT }}>Ref {p.reference}</p>}
      </>
    );
  }
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="font-semibold">{amt(p.amount)}</span>
        <select
          value={p.status}
          onChange={(e) => onStatus(e.target.value as Status)}
          className="rounded-full bg-white py-1 pl-3 pr-8 text-[13px] font-semibold ring-1 outline-none"
          style={{ color: p.status === "due" ? "#2F6FC4" : RED, ["--tw-ring-color" as string]: "#16233B1F", ...pillSelect(p.status === "due" ? "#2F6FC4" : RED, 11) }}
        >
          <option value="due">Due</option>
          <option value="paid">Paid</option>
          <option value="withheld">Withheld</option>
        </select>
      </div>
      {p.returned && <p className="mt-1 text-[12px] font-semibold" style={{ color: RED }}>Came back once: check the payout email before resending</p>}
      <p className="mt-1 text-[12.5px]" style={{ color: BODY }}>
        {methodLabel(c)} to {c.payoutEmail}{" "}
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(c.payoutEmail);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {}
          }}
          className="font-semibold"
          style={{ color: copied ? "#15803D" : "#2F6FC4" }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </p>
      <p className="text-[12px]" style={{ color: FAINT }}>Worked out {fullDate(p.dueOn)}</p>
    </>
  );
}

// ---- Dialogs -----------------------------------------------------------------------------

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#101B2E]/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-[440px] rounded-3xl bg-white px-6 py-6" style={{ boxShadow: "0 24px 60px -20px rgba(16,42,86,0.45)" }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Buttons({ onCancel, onOk, ok, danger = false }: { onCancel: () => void; onOk: () => void; ok: string; danger?: boolean }) {
  return (
    <div className="mt-5 flex justify-end gap-3">
      <button type="button" onClick={onCancel} className="rounded-full px-5 py-2.5 text-[14px] font-semibold" style={{ color: BODY }}>
        Cancel
      </button>
      <button type="button" onClick={onOk} className="rounded-full px-5 py-2.5 text-[14px] font-semibold text-white" style={{ background: danger ? RED : INK }}>
        {ok}
      </button>
    </div>
  );
}

function Confirm({ a, onCancel, onConfirm }: { a: Action; onCancel: () => void; onConfirm: (reference: string, withhold: boolean) => void }) {
  const [reference, setReference] = useState("");
  const [withhold, setWithhold] = useState(true);
  const { c, kind } = a;
  const first = firstName(c.name);
  const pay = c.payout;
  const what = pay ? (
    <p className="mt-2 text-[14.5px] leading-[1.6]" style={{ color: BODY }}>
      <span className="font-semibold" style={{ color: INK }}>{money(pay.amount, c.currency)}</span> to {c.name}, by {methodLabel(c)} to {c.payoutEmail}.
    </p>
  ) : null;
  const small = (t: React.ReactNode) => <p className="mt-3 text-[13px] leading-[1.55]" style={{ color: BODY }}>{t}</p>;

  if (kind === "paid") {
    return (
      <Sheet onClose={onCancel}>
        <h3 className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: INK }}>Mark As Paid?</h3>
        {what}
        <label className="mt-4 block">
          <span className="text-[13px] font-semibold" style={{ color: INK }}>Reference (optional)</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e-Transfer or Wise reference"
            className="mt-1.5 w-full rounded-2xl bg-white px-4 py-3 text-[15px] ring-1 ring-[#16233B]/[0.1] outline-none focus:ring-2 focus:ring-[#6FA8FF]"
            style={{ color: INK }}
          />
        </label>
        {small(<>This issues {first}&apos;s statement and emails it to them. Only mark it once the money is sent.</>)}
        <Buttons onCancel={onCancel} onOk={() => onConfirm(reference, true)} ok="Mark Paid" />
      </Sheet>
    );
  }
  if (kind === "withheld") {
    return (
      <Sheet onClose={onCancel}>
        <h3 className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: INK }}>Withhold This Payout?</h3>
        {what}
        {small(<>Nothing is sent to {first}. You can set it back to Due later.</>)}
        <Buttons onCancel={onCancel} onOk={() => onConfirm("", true)} ok="Withhold" danger />
      </Sheet>
    );
  }
  if (kind === "returned") {
    return (
      <Sheet onClose={onCancel}>
        <h3 className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: INK }}>Payout Came Back?</h3>
        {what}
        {small(
          <>
            Use this if the e-Transfer expired or bounced, or the deposit failed. It goes back to Due so you can resend it, and {first}&apos;s
            statement for it is withdrawn until you mark it paid again (which emails them again). Check their payout email with them first.
          </>,
        )}
        <Buttons onCancel={onCancel} onOk={() => onConfirm("", true)} ok="Mark Returned" danger />
      </Sheet>
    );
  }
  if (kind === "remove") {
    return (
      <Sheet onClose={onCancel}>
        <h3 className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: INK }}>Remove {c.name}?</h3>
        {small(
          <>
            For breaking the program terms. Their code stops working for new signups and nothing new is paid to them. They aren&apos;t emailed, so let
            them know yourself. You can restore them later.
          </>,
        )}
        <label className="mt-3 flex items-center gap-2.5 text-[14px]" style={{ color: INK }}>
          <input type="checkbox" checked={withhold} onChange={(e) => setWithhold(e.target.checked)} className="h-4 w-4" />
          Withhold any payout waiting to be sent
        </label>
        <Buttons onCancel={onCancel} onOk={() => onConfirm("", withhold)} ok="Remove" danger />
      </Sheet>
    );
  }
  return (
    <Sheet onClose={onCancel}>
      <h3 className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: INK }}>Restore {c.name}?</h3>
      {small(<>Their code works again and they earn as before. A withheld payout stays withheld until you set it back to Due.</>)}
      <Buttons onCancel={onCancel} onOk={() => onConfirm("", true)} ok="Restore" />
    </Sheet>
  );
}

function Manage({ c, onClose, onSave, onRemove }: { c: OwnerCreator; onClose: () => void; onSave: (notes: string, posted: boolean) => void; onRemove: () => void }) {
  const [notes, setNotes] = useState(c.notes);
  const [posted, setPosted] = useState(c.posted);
  const handles = [c.instagram && `Instagram @${c.instagram}`, c.tiktok && `TikTok @${c.tiktok}`].filter(Boolean).join(" · ");
  return (
    <Sheet onClose={onClose}>
      <h3 className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: INK }}>{c.name}</h3>
      <p className="mt-1 text-[13px]" style={{ color: BODY }}>
        {c.email} · {c.code}
        {handles && <> · {handles}</>}
      </p>
      <label className="mt-4 block">
        <span className="text-[13px] font-semibold" style={{ color: INK }}>Notes (only owners see these)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="How you met, what they agreed to, when they plan to post…"
          className="mt-1.5 w-full rounded-2xl bg-white px-4 py-3 text-[14.5px] ring-1 ring-[#16233B]/[0.1] outline-none focus:ring-2 focus:ring-[#6FA8FF]"
          style={{ color: INK }}
        />
      </label>
      <label className="mt-2 flex items-center gap-2.5 text-[14px]" style={{ color: INK }}>
        <input type="checkbox" checked={posted} onChange={(e) => setPosted(e.target.checked)} className="h-4 w-4" />
        They&apos;ve posted about WhatYouAte
      </label>
      <div className="mt-5 flex items-center justify-between gap-3">
        <button type="button" onClick={onRemove} className="text-[13.5px] font-semibold" style={{ color: c.status === "removed" ? "#2F6FC4" : RED }}>
          {c.status === "removed" ? "Restore To Program" : "Remove From Program"}
        </button>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2.5 text-[14px] font-semibold" style={{ color: BODY }}>
            Cancel
          </button>
          <button type="button" onClick={() => onSave(notes, posted)} className="rounded-full px-5 py-2.5 text-[14px] font-semibold text-white" style={{ background: INK }}>
            Save
          </button>
        </div>
      </div>
    </Sheet>
  );
}

// ---- Spreadsheet ---------------------------------------------------------------------------

/**
 * The owner's spreadsheet: every creator, every payout, and what was paid to each creator in each
 * calendar year (what an accountant needs for T4As). The library only loads when asked for.
 */
async function downloadOwnerSheet(creators: OwnerCreator[], payouts: Awaited<ReturnType<typeof ownerExport>>) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "WhatYouAte";
  const MONEY = `"$"#,##0.00`;
  const head = { name: "Helvetica Neue", size: 10, bold: true, color: { argb: "FF5A6B85" } };
  const body = { name: "Helvetica Neue", size: 11, color: { argb: "FF101B2E" } };
  const tint = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEEF5FE" } };

  const sheet = (title: string, cols: { header: string; width: number; money?: boolean }[], rows: (string | number | null)[][]) => {
    const ws = wb.addWorksheet(title, { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
    ws.columns = cols.map((c) => ({ header: c.header, width: c.width }));
    ws.getRow(1).eachCell((cell) => {
      cell.font = head;
      cell.fill = tint;
      cell.alignment = { vertical: "middle" };
    });
    ws.getRow(1).height = 22;
    for (const r of rows) ws.addRow(r).eachCell((cell) => (cell.font = body));
    cols.forEach((c, i) => {
      if (c.money) ws.getColumn(i + 1).numFmt = MONEY;
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  };

  const country = (c: string) => (c === "OTHER" ? "Outside CA/US" : c);
  sheet(
    "Creators",
    [
      { header: "Name", width: 22 }, { header: "Email", width: 28 }, { header: "Code", width: 14 }, { header: "Status", width: 10 },
      { header: "Country", width: 13 }, { header: "Currency", width: 10 }, { header: "Joined", width: 12 }, { header: "Instagram", width: 16 },
      { header: "TikTok", width: 16 }, { header: "Payout Method", width: 18 }, { header: "Payout Email", width: 28 }, { header: "Users Brought In", width: 15 },
      { header: "Signups That Count", width: 17 }, { header: "Paying Subscribers", width: 17 }, { header: "Earned", width: 12, money: true },
      { header: "Paid Out", width: 12, money: true }, { header: "Owed", width: 12, money: true }, { header: "Posted", width: 9 }, { header: "Notes", width: 40 },
    ],
    creators.map((c) => [
      c.name, c.email, c.code, c.status, country(c.country), c.currency, c.joined, c.instagram ? `@${c.instagram}` : "", c.tiktok ? `@${c.tiktok}` : "",
      PAYOUT_LABEL[c.payoutMethod], c.payoutEmail, c.codeUses, c.signups, c.paying, c.earned, c.paidOut, c.owed, c.posted ? "Yes" : "", c.notes,
    ]),
  );
  sheet(
    "Payouts",
    [
      { header: "Worked Out", width: 12 }, { header: "Covers Earnings Before", width: 20 }, { header: "Name", width: 22 }, { header: "Code", width: 14 },
      { header: "Amount", width: 12, money: true }, { header: "Currency", width: 10 }, { header: "Status", width: 10 }, { header: "Paid On", width: 12 },
      { header: "Method", width: 18 }, { header: "Payout Email", width: 28 }, { header: "Reference", width: 22 }, { header: "Returned Before", width: 15 },
    ],
    payouts.map((p) => [
      p.dueOn, p.coversBefore, p.name, p.code, p.amount, p.currency, p.status, p.paidOn ?? "", PAYOUT_LABEL[p.payoutMethod], p.payoutEmail, p.reference, p.returned ? "Yes" : "",
    ]),
  );
  // Paid in each calendar year, per creator and currency.
  const years = new Map<string, { name: string; email: string; country: string; currency: string; year: string; total: number; count: number }>();
  for (const p of payouts) {
    if (p.status !== "paid" || !p.paidOn) continue;
    const key = `${p.email}|${p.currency}|${p.paidOn.slice(0, 4)}`;
    const y = years.get(key) ?? { name: p.name, email: p.email, country: country(p.country), currency: p.currency, year: p.paidOn.slice(0, 4), total: 0, count: 0 };
    y.total += p.amount;
    y.count += 1;
    years.set(key, y);
  }
  sheet(
    "Paid By Year",
    [
      { header: "Year", width: 8 }, { header: "Name", width: 22 }, { header: "Email", width: 28 }, { header: "Country", width: 13 },
      { header: "Currency", width: 10 }, { header: "Total Paid", width: 13, money: true }, { header: "Payouts", width: 9 },
    ],
    [...years.values()].sort((a, b) => b.year.localeCompare(a.year) || a.name.localeCompare(b.name)).map((y) => [y.year, y.name, y.email, y.country, y.currency, y.total, y.count]),
  );

  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  a.download = `whatyouate-creators-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
