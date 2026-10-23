"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./Shell";
import { errorText, ownerOverview, ownerSetPayout, sb, sendPayoutEmail, type OwnerCreator, type OwnerOverview } from "./api";
import { PAYOUT_LABEL, longDate, money } from "./shared";
import { BODY, INK } from "../site";

// The program owner's page (/creators/owner): totals, one row per creator, and each payout's status.
// Everything shown comes from owner_overview in creators.sql, which refuses anyone not in
// creator_owners, so the page itself holds nothing private.

const FAINT = "#8FA3C0";
type Status = "due" | "paid" | "withheld";
type Pending = { c: OwnerCreator; to: Status };

const fullDate = (iso: string) => `${longDate(iso)}, ${iso.slice(0, 4)}`;
const methodLabel = (c: OwnerCreator) => (c.payoutMethod === "wise" ? "Wise" : PAYOUT_LABEL[c.payoutMethod]);

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
  const [state, setState] = useState<"loading" | "ready" | "notOwner" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);

  const load = useCallback(async () => {
    const { data: session } = await sb().auth.getSession();
    if (!session.session) {
      router.replace(`/creators/login?next=${encodeURIComponent("/creators/owner")}`);
      return;
    }
    try {
      setData(await ownerOverview());
      setState("ready");
    } catch (e) {
      setState(/not_owner/.test(String((e as { message?: string })?.message)) ? "notOwner" : "error");
    }
  }, [router]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = data?.creators ?? [];
    return q ? all.filter((c) => [c.name, c.email, c.code, c.payoutEmail].some((v) => v.toLowerCase().includes(q))) : all;
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
  const due = all.filter((c) => c.payout?.status === "due");
  const totals = [
    { label: "Creators", lines: [String(all.filter((c) => c.status === "active").length)], note: `${all.length} joined in total` },
    { label: "Users Brought In", lines: [String(all.reduce((t, c) => t + c.codeUses, 0))], note: `${all.reduce((t, c) => t + c.signups, 0)} signups that count` },
    { label: "Paying Subscribers", lines: [String(all.reduce((t, c) => t + c.paying, 0))] },
    { label: "Earned All Time", lines: byCurrency(all, (c) => c.earned) },
    { label: "Paid Out", lines: byCurrency(all, (c) => c.paidOut) },
    { label: "Owed Now", lines: byCurrency(all, (c) => c.earned - c.paidOut), note: "Includes earnings not yet due" },
    { label: "To Send Now", lines: byCurrency(due, (c) => c.payout?.amount ?? 0), note: `${due.length} payout${due.length === 1 ? "" : "s"} due`, strong: due.length > 0 },
    { label: "Free Pro Codes Left", lines: [`${data.proCodes.threeMonths} three-month`, `${data.proCodes.year} one-year`] },
  ];

  return (
    <div className="-mt-6 sm:-mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[clamp(28px,4.4vw,40px)] font-bold leading-[1.1] tracking-[-0.04em]">Owner</h1>
          <p className="mt-1 text-[14px]" style={{ color: BODY }}>
            Payouts are worked out on the 1st. Send them in the first week, then mark each one paid.
          </p>
        </div>
        <button type="button" onClick={load} className="text-[14px] font-semibold" style={{ color: "#2F6FC4" }}>
          Refresh
        </button>
      </div>

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

      {/* Creators */}
      <div className="mt-9 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[19px] font-bold tracking-[-0.02em]" style={{ color: INK }}>Creators</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email or code"
          className="w-full rounded-full bg-white px-4 py-2 text-[14px] ring-1 ring-[#16233B]/[0.1] outline-none focus:ring-2 focus:ring-[#6FA8FF] sm:w-72"
          style={{ color: INK }}
        />
      </div>
      {/* Phones get stacked cards, so the payout dropdown is always in reach. */}
      <Card className="mt-3 divide-y divide-[#16233B]/[0.06] md:hidden">
        {rows.map((c) => (
          <PhoneCard key={c.id} c={c} onChange={(to) => (to === "due" ? apply({ c, to }, "") : setPending({ c, to }))} />
        ))}
        {!rows.length && <p className="px-5 py-6 text-center text-[14px]" style={{ color: BODY }}>{all.length ? "No creators match that search." : "No creators yet."}</p>}
      </Card>
      <Card className="mt-3 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[980px] border-collapse text-[13.5px]">
          <thead>
            <tr style={{ color: FAINT }}>
              {["Creator", "Code", "Users", "Signups", "Paying", "Earned", "Paid Out", "Owed", "Payout"].map((h, i) => (
                <th key={h} className={`border-b border-[#16233B]/[0.06] px-4 pb-2.5 pt-4 font-semibold ${i >= 2 && i <= 7 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ color: INK }}>
            {rows.map((c) => (
              <Row key={c.id} c={c} onChange={(to) => (to === "due" ? apply({ c, to }, "") : setPending({ c, to }))} />
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

      {pending && <Confirm p={pending} onCancel={() => setPending(null)} onConfirm={(ref) => apply(pending, ref)} />}
    </div>
  );

  async function apply(p: Pending, reference: string) {
    if (!p.c.payout) return;
    setPending(null);
    setMessage(null);
    try {
      await ownerSetPayout(p.c.payout.id, p.to, reference);
      if (p.to === "paid") {
        const emailed = await sendPayoutEmail(p.c.payout.id);
        setMessage(
          emailed
            ? `Marked paid. ${p.c.name.split(" ")[0]} has been emailed their statement.`
            : `Marked paid. The statement email didn't go out just now, so tomorrow morning's run will send it.`,
        );
      } else {
        setMessage(p.to === "withheld" ? `${p.c.name}'s payout is withheld.` : `${p.c.name}'s payout is back to due.`);
      }
    } catch (e) {
      setMessage(errorText(e));
    }
    await load();
  }
}

function Row({ c, onChange }: { c: OwnerCreator; onChange: (to: Status) => void }) {
  const amt = (n: number) => money(n, c.currency);
  const cell = "border-b border-[#16233B]/[0.06] px-4 py-3 align-top";
  return (
    <tr>
      <td className={cell}>
        <p className="font-semibold">{c.name}</p>
        <p className="text-[12.5px]" style={{ color: BODY }}>{c.email}</p>
        <p className="text-[12px]" style={{ color: FAINT }}>
          {c.country === "OTHER" ? "Outside CA/US" : c.country} · joined {fullDate(c.joined)}
          {c.status !== "active" && <span className="ml-1.5 font-semibold" style={{ color: "#C2410C" }}>{c.status === "left" ? "Left" : "Removed"}</span>}
        </p>
      </td>
      <td className={`${cell} font-semibold tracking-[0.03em]`}>{c.code}</td>
      <td className={`${cell} text-right tabular-nums`}>{c.codeUses}</td>
      <td className={`${cell} text-right tabular-nums`}>{c.signups}</td>
      <td className={`${cell} text-right tabular-nums`}>{c.paying}</td>
      <td className={`${cell} whitespace-nowrap text-right tabular-nums`}>{amt(c.earned)}</td>
      <td className={`${cell} whitespace-nowrap text-right tabular-nums`}>{amt(c.paidOut)}</td>
      <td className={`${cell} whitespace-nowrap text-right font-semibold tabular-nums`}>{amt(c.earned - c.paidOut)}</td>
      <td className={`${cell} min-w-[220px]`}>
        <PayoutCell c={c} onChange={onChange} />
      </td>
    </tr>
  );
}

/** The payout's amount and status: a dropdown while it's due or withheld, the paid date after. */
function PayoutCell({ c, onChange }: { c: OwnerCreator; onChange: (to: Status) => void }) {
  const [copied, setCopied] = useState(false);
  const amt = (n: number) => money(n, c.currency);
  const p = c.payout;
  return (
    <>
      {!p ? (
        <span style={{ color: FAINT }}>No payout yet</span>
      ) : p.status === "paid" ? (
        <>
          <p className="font-semibold">{amt(p.amount)}</p>
          <p className="text-[12.5px]" style={{ color: "#15803D" }}>Paid {p.paidOn ? fullDate(p.paidOn) : ""}</p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{amt(p.amount)}</span>
            <select
              value={p.status}
              onChange={(e) => onChange(e.target.value as Status)}
              className="rounded-full bg-white px-3 py-1 text-[13px] font-semibold ring-1 outline-none"
              style={{ color: p.status === "due" ? "#2F6FC4" : "#C2410C", ["--tw-ring-color" as string]: "#16233B1F" }}
            >
              <option value="due">Due</option>
              <option value="paid">Paid</option>
              <option value="withheld">Withheld</option>
            </select>
          </div>
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
      )}
    </>
  );
}

/** One creator on a phone: the same facts as a table row, stacked. */
function PhoneCard({ c, onChange }: { c: OwnerCreator; onChange: (to: Status) => void }) {
  const amt = (n: number) => money(n, c.currency);
  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold" style={{ color: INK }}>
            {c.name}
            {c.status !== "active" && <span className="ml-1.5 text-[12px] font-semibold" style={{ color: "#C2410C" }}>{c.status === "left" ? "Left" : "Removed"}</span>}
          </p>
          <p className="truncate text-[12.5px]" style={{ color: BODY }}>{c.email}</p>
        </div>
        <span className="shrink-0 text-[13px] font-semibold tracking-[0.03em]" style={{ color: INK }}>{c.code}</span>
      </div>
      <p className="mt-2 text-[12.5px]" style={{ color: BODY }}>
        {c.codeUses} users · {c.signups} signups · {c.paying} paying
      </p>
      <p className="text-[12.5px]" style={{ color: BODY }}>
        Earned {amt(c.earned)} · Paid {amt(c.paidOut)} · <span className="font-semibold" style={{ color: INK }}>Owed {amt(c.earned - c.paidOut)}</span>
      </p>
      <div className="mt-3 text-[13.5px]" style={{ color: INK }}>
        <PayoutCell c={c} onChange={onChange} />
      </div>
    </div>
  );
}

function Confirm({ p, onCancel, onConfirm }: { p: Pending; onCancel: () => void; onConfirm: (reference: string) => void }) {
  const [reference, setReference] = useState("");
  const pay = p.c.payout!;
  const first = p.c.name.split(" ")[0];
  const paid = p.to === "paid";
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#101B2E]/40 p-4 sm:items-center" onClick={onCancel}>
      <div className="w-full max-w-[420px] rounded-3xl bg-white px-6 py-6" style={{ boxShadow: "0 24px 60px -20px rgba(16,42,86,0.45)" }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: INK }}>{paid ? "Mark As Paid?" : "Withhold This Payout?"}</h3>
        <p className="mt-2 text-[14.5px] leading-[1.6]" style={{ color: BODY }}>
          <span className="font-semibold" style={{ color: INK }}>{money(pay.amount, p.c.currency)}</span> to {p.c.name}, by {methodLabel(p.c)} to {p.c.payoutEmail}.
        </p>
        {paid ? (
          <>
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
            <p className="mt-3 text-[13px] leading-[1.55]" style={{ color: BODY }}>
              This issues {first}&apos;s statement and emails it to them. It can&apos;t be undone here, so only mark it once the money is sent.
            </p>
          </>
        ) : (
          <p className="mt-3 text-[13px] leading-[1.55]" style={{ color: BODY }}>Nothing is sent to {first}. You can set it back to Due later.</p>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-full px-5 py-2.5 text-[14px] font-semibold" style={{ color: BODY }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reference)}
            className="rounded-full px-5 py-2.5 text-[14px] font-semibold text-white"
            style={{ background: paid ? INK : "#C2410C" }}
          >
            {paid ? "Mark Paid" : "Withhold"}
          </button>
        </div>
      </div>
    </div>
  );
}
