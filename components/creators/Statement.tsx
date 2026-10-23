"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Logo from "../Logo";
import { Card } from "./Shell";
import { useRouter } from "next/navigation";
import { loadStatements, sb, type IssuedStatement } from "./api";
import { PAYOUT_LABEL, longDate, money } from "./shared";
import { BODY, INK } from "../site";

// A creator's statements: one per payout, issued (and frozen) when the payout is marked paid on the
// owner page. The list is at /creators/statements, one statement at ?id=<payout id>.

const FAINT = "#8FA3C0";
const LINE = "#16233B14";

const monthName = (ym: string) => new Date(`${ym}-01T12:00:00`).toLocaleDateString("en-CA", { month: "long", year: "numeric" });
const fullDate = (iso: string) => `${longDate(iso)}, ${iso.slice(0, 4)}`;

function facts(s: IssuedStatement) {
  const from = monthName(s.period.from.slice(0, 7));
  const to = monthName(s.period.to.slice(0, 7));
  const totals = s.months.reduce(
    (t, r) => ({ codeUses: t.codeUses + r.codeUses, signups: t.signups + r.signups, newPaid: t.newPaid + r.newPaid, bonus: t.bonus + r.bonus, commission: t.commission + r.commission }),
    { codeUses: 0, signups: 0, newPaid: 0, bonus: 0, commission: 0 },
  );
  return {
    period: from === to ? to : `${from} to ${to}`,
    method: s.payout.method === "wise" ? "Bank deposit through Wise" : PAYOUT_LABEL[s.payout.method],
    totals,
    earnedInPeriod: totals.bonus + totals.commission,
  };
}

const NOTE = (cur: string) =>
  `You earn 30% of each subscription you bring in for its first 12 months, after Apple's fee, plus $1 for each signup that counts in your first month (up to $100). Earnings are fixed in ${cur} on the day each subscriber pays, and refunds come off in the month they happen. Payouts go out in the first week of each month and cover earnings up to the end of the month before last, so refunds can clear. Balances under $10 roll over to the next payout.`;

/**
 * The statement as a formatted Excel file (opens in Excel, Numbers and Google Sheets): the icon and
 * title, the creator's details, a summary, and the month-by-month table with totals.
 * The spreadsheet library only loads when someone asks for the file.
 */
export async function downloadStatementSheet(s: IssuedStatement) {
  const { default: ExcelJS } = await import("exceljs");
  const C = s.creator;
  const cur = s.payout.currency;
  const { period, method, totals, earnedInPeriod } = facts(s);
  const MONEY = `"$"#,##0.00`;
  const INK_ARGB = "FF101B2E";
  const BODY_ARGB = "FF5A6B85";
  const FAINT_ARGB = "FF8FA3C0";
  const TINT = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEEF5FE" } };
  const RULE = { style: "thin" as const, color: { argb: "FFDCE4EF" } };

  const wb = new ExcelJS.Workbook();
  wb.creator = "WhatYouAte";
  const ws = wb.addWorksheet("Statement", { views: [{ showGridLines: false }], pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [{ width: 22 }, { width: 13 }, { width: 19 }, { width: 17 }, { width: 15 }, { width: 16 }, { width: 14 }];
  const font = (o: Partial<{ bold: boolean; size: number; color: string }> = {}) => ({
    name: "Helvetica Neue",
    size: o.size ?? 11,
    bold: o.bold ?? false,
    color: { argb: o.color ?? INK_ARGB },
  });

  // Letterhead: the app icon beside the title.
  try {
    const blob = await (await fetch("/icon-512.png")).blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    ws.addImage(wb.addImage({ base64, extension: "png" }), { tl: { col: 0.15, row: 0.2 }, ext: { width: 44, height: 44 } });
  } catch {}
  ws.getRow(1).height = 22;
  ws.getRow(2).height = 18;
  ws.getCell("B1").value = "WhatYouAte Creator Statement";
  ws.getCell("B1").font = font({ bold: true, size: 16 });
  ws.getCell("B2").value = `${period} · Paid ${fullDate(s.payout.paidOn)}`;
  ws.getCell("B2").font = font({ color: BODY_ARGB });

  let row = 4;
  const info: [string, string][] = [
    ["Creator", C.name],
    ["Email", C.email],
    ...(C.instagram ? ([["Instagram", `@${C.instagram}`]] as [string, string][]) : []),
    ...(C.tiktok ? ([["TikTok", `@${C.tiktok}`]] as [string, string][]) : []),
    ["Creator Code", C.code],
    ["Your Link", `whatyouate.app/c/${C.code}`],
    ["Joined", fullDate(C.joined)],
    ["Paid By", method],
    ["Paid To", s.payout.payoutEmail],
    ...(s.payout.reference ? ([["Reference", s.payout.reference]] as [string, string][]) : []),
    ["Currency", `${cur === "CAD" ? "Canadian" : "US"} dollars (${cur})`],
  ];
  for (const [k, v] of info) {
    ws.getCell(row, 1).value = k;
    ws.getCell(row, 1).font = font({ color: BODY_ARGB });
    ws.getCell(row, 2).value = v;
    ws.getCell(row, 2).font = font({ bold: k === "Creator" || k === "Creator Code" });
    row++;
  }

  // Summary
  row++;
  const summary: [string, number][] = [
    ["This Payout", s.payout.amount],
    ["Earned This Period", earnedInPeriod],
    ["Earned All Time", s.allTime.earned],
    ["Paid Out All Time", s.allTime.paidOut],
  ];
  summary.forEach(([k, v], i) => {
    const col = 1 + i * 2;
    ws.getCell(row, col).value = k;
    ws.getCell(row, col).font = font({ color: BODY_ARGB, size: 10 });
    const val = ws.getCell(row + 1, col);
    val.value = v;
    val.numFmt = MONEY;
    val.font = font({ bold: true, size: 14 });
    val.alignment = { horizontal: "left" };
  });
  row += 3;

  // Earnings by month
  ws.getCell(row, 1).value = `Earnings By Month (${cur})`;
  ws.getCell(row, 1).font = font({ bold: true, size: 13 });
  row++;
  ["Month", "Code Uses", "Signups That Count", "New Subscribers", "Signup Bonus", "Subscriptions", "Earned"].forEach((h, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = h;
    c.font = font({ bold: true, size: 10, color: BODY_ARGB });
    c.fill = TINT;
    c.border = { bottom: RULE };
    c.alignment = { horizontal: i === 0 ? "left" : "right", vertical: "middle", wrapText: true };
  });
  ws.getRow(row).height = 30;
  row++;
  for (const r of s.months) {
    [monthName(r.month), r.codeUses, r.signups, r.newPaid, r.bonus, r.commission, r.bonus + r.commission].forEach((v, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = v;
      c.font = font({ bold: i === 6 });
      c.border = { bottom: RULE };
      c.alignment = { horizontal: i === 0 ? "left" : "right" };
      if (i >= 4) c.numFmt = MONEY;
    });
    row++;
  }
  ["Total", totals.codeUses, totals.signups, totals.newPaid, totals.bonus, totals.commission, earnedInPeriod].forEach((v, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = v;
    c.font = font({ bold: true });
    c.alignment = { horizontal: i === 0 ? "left" : "right" };
    if (i >= 4) c.numFmt = MONEY;
  });
  row += 2;

  ws.mergeCells(row, 1, row, 7);
  const note = ws.getCell(row, 1);
  note.value = `How these numbers work: ${NOTE(cur)}`;
  note.font = font({ size: 10, color: BODY_ARGB });
  note.alignment = { wrapText: true, vertical: "top" };
  ws.getRow(row).height = 70;
  row += 2;
  ws.getCell(row, 1).value = "Questions about this statement? support@whatyouate.app";
  ws.getCell(row, 1).font = font({ size: 10, color: FAINT_ARGB });

  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  a.download = `whatyouate-statement-${C.code}-${s.payout.paidOn}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

// ---- Pages ------------------------------------------------------------------------------

/**
 * Loads the statements once, then moves between the list and a statement without reloading: the
 * address changes (so links, Back and refresh work) but the page swaps in place. It skips the
 * dashboard's data, which it doesn't need, so it opens quickly.
 */
export default function Statements() {
  const router = useRouter();
  const [list, setList] = useState<IssuedStatement[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const fromAddress = () => setId(new URLSearchParams(window.location.search).get("id"));
    fromAddress();
    window.addEventListener("popstate", fromAddress);
    sb()
      .auth.getSession()
      .then(({ data }) => {
        if (!data.session) {
          router.replace(`/creators/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          return;
        }
        return loadStatements().then(setList);
      })
      .catch(() => setFailed(true));
    return () => window.removeEventListener("popstate", fromAddress);
  }, [router]);
  const show = (next: string | null) => {
    window.history.pushState(null, "", next ? `/creators/statements?id=${next}` : "/creators/statements");
    setId(next);
    window.scrollTo(0, 0);
  };
  if (failed) return <p className="py-24 text-center text-[15px]" style={{ color: BODY }}>Couldn&apos;t load your statements. Try again in a moment.</p>;
  if (!list) return <p className="py-24 text-center text-[15px]" style={{ color: BODY }}>Loading…</p>;
  const one = id ? list.find((s) => s.payout.id === id) : null;
  return one ? <StatementView s={one} onBack={() => show(null)} /> : <StatementList list={list} onOpen={show} />;
}

const BackLink = ({ href, onClick, children }: { href: string; onClick?: () => void; children: React.ReactNode }) => (
  <Link
    href={href}
    onClick={
      onClick &&
      ((e) => {
        e.preventDefault();
        onClick();
      })
    }
    className="inline-flex items-center gap-1.5 text-[14px] font-semibold transition hover:opacity-70"
    style={{ color: BODY }}
  >
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 12L6 8l4-4" />
    </svg>
    {children}
  </Link>
);

/** Every issued statement, newest first. */
export function StatementList({ list, onOpen }: { list: IssuedStatement[]; onOpen?: (id: string) => void }) {
  return (
    <div className="-mt-6 sm:-mt-10">
      <BackLink href="/creators/dashboard">Back To Dashboard</BackLink>
      <h1 className="mt-5 text-[clamp(28px,4.4vw,40px)] font-bold leading-[1.1] tracking-[-0.04em]">Your Statements</h1>
      <p className="mt-3 text-[16px] leading-[1.65]" style={{ color: BODY }}>
        A statement is issued with each payout. Open one to download it as a PDF or an Excel file.
      </p>
      {list.length ? (
        // Grouped by the year each was paid, with that year's total (handy at tax time).
        [...new Set(list.map((s) => s.payout.paidOn.slice(0, 4)))].map((year) => {
          const inYear = list.filter((s) => s.payout.paidOn.startsWith(year));
          const cur = inYear[0].payout.currency;
          return (
            <section key={year} className="mt-7">
              <div className="mb-2.5 flex items-baseline justify-between px-1">
                <h2 className="text-[17px] font-bold tracking-[-0.02em]" style={{ color: INK }}>{year}</h2>
                <p className="text-[13.5px]" style={{ color: BODY }}>
                  Paid in {year}: <span className="font-semibold" style={{ color: INK }}>{money(inYear.reduce((t, s) => t + s.payout.amount, 0), cur)}</span>
                </p>
              </div>
              <Card className="divide-y divide-[#16233B]/[0.06]">
                {inYear.map((s) => {
                  const f = facts(s);
                  return (
                    <Link
                      key={s.payout.id}
                      href={`/creators/statements?id=${s.payout.id}`}
                      onClick={
                        onOpen &&
                        ((e) => {
                          e.preventDefault();
                          onOpen(s.payout.id);
                        })
                      }
                      className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-white/60"
                    >
                      <div className="min-w-0">
                        <p className="text-[15.5px] font-semibold" style={{ color: INK }}>{f.period}</p>
                        <p className="text-[13px]" style={{ color: BODY }}>Paid {fullDate(s.payout.paidOn)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-[15.5px] font-semibold tabular-nums" style={{ color: INK }}>{money(s.payout.amount, s.payout.currency)}</span>
                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke={FAINT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M6 4l4 4-4 4" />
                        </svg>
                      </div>
                    </Link>
                  );
                })}
              </Card>
            </section>
          );
        })
      ) : (
        <Card className="mt-7 px-6 py-6">
          <p className="text-[17px] font-bold tracking-[-0.02em]" style={{ color: INK }}>No Statements Yet</p>
          <p className="mt-1.5 text-[14.5px] leading-[1.6]" style={{ color: BODY }}>
            Your first statement is issued with your first payout. Payouts go out in the first week of each month, once you have $10 or more to be paid.
          </p>
        </Card>
      )}
    </div>
  );
}

/** One issued statement. Download PDF prints it (Save as PDF); the site's header and footer stay off the page. */
export function StatementView({ s, onBack }: { s: IssuedStatement; onBack?: () => void }) {
  const [saving, setSaving] = useState(false);
  const C = s.creator;
  const cur = s.payout.currency;
  const amt = (n: number) => money(n, cur).replace(` ${cur}`, "");
  const { period, method, totals, earnedInPeriod } = facts(s);
  const socials = [C.instagram && `Instagram @${C.instagram}`, C.tiktok && `TikTok @${C.tiktok}`].filter(Boolean) as string[];

  return (
    <div className="-mt-6 sm:-mt-10 print:mt-0">
      {/* Tools, left out of the printout */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink href="/creators/statements" onClick={onBack}>
          All Statements
        </BackLink>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={async () => {
              setSaving(true);
              await downloadStatementSheet(s).catch(() => {});
              setSaving(false);
            }}
            className="text-[14px] font-semibold"
            style={{ color: "#2F6FC4" }}
          >
            {saving ? "Preparing…" : "Download Excel"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full px-5 py-2.5 text-[14px] font-semibold text-white transition hover:opacity-90"
            style={{ background: INK }}
          >
            Download PDF
          </button>
        </div>
      </div>

      <article
        className="statement rounded-3xl bg-white px-6 py-7 ring-1 ring-[#16233B]/[0.06] sm:px-10 sm:py-10 print:rounded-none print:p-0 print:shadow-none print:ring-0"
        style={{ boxShadow: "0 18px 40px -26px rgba(16,42,86,0.28)" }}
      >
        {/* Letterhead */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6 print:pb-4" style={{ borderColor: LINE }}>
          <Logo />
          <div className="sm:text-right print:text-right">
            <h1 className="text-[22px] font-bold tracking-[-0.03em]" style={{ color: INK }}>Creator Statement</h1>
            <p className="mt-1 text-[13px]" style={{ color: BODY }}>{period}</p>
            <p className="text-[13px]" style={{ color: BODY }}>Paid {fullDate(s.payout.paidOn)}</p>
          </div>
        </header>

        {/* Who */}
        <section className="grid gap-5 border-b py-6 sm:grid-cols-3 print:grid-cols-3 print:py-4" style={{ borderColor: LINE }}>
          <Info label="Creator">
            <p className="font-semibold" style={{ color: INK }}>{C.name}</p>
            <p>{C.email}</p>
            {socials.map((x) => (
              <p key={x}>{x}</p>
            ))}
          </Info>
          <Info label="Creator Code">
            <p className="font-semibold tracking-[0.04em]" style={{ color: INK }}>{C.code}</p>
            <p>whatyouate.app/c/{C.code}</p>
            <p>Joined {fullDate(C.joined)}</p>
          </Info>
          <Info label="Payment">
            <p className="font-semibold" style={{ color: INK }}>{method}</p>
            <p>{s.payout.payoutEmail}</p>
            {s.payout.reference && <p>Reference {s.payout.reference}</p>}
            <p>
              {cur === "CAD" ? "Paid in Canadian dollars (CAD)" : C.country === "US" ? "Paid in US dollars (USD)" : "Earned in US dollars (USD), deposited in your own currency"}
            </p>
          </Info>
        </section>

        {/* Summary */}
        <section className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-4 print:grid-cols-4 print:py-4">
          <Total label="This Payout" value={amt(s.payout.amount)} strong />
          <Total label="Earned This Period" value={amt(earnedInPeriod)} />
          <Total label="Earned All Time" value={amt(s.allTime.earned)} />
          <Total label="Paid Out All Time" value={amt(s.allTime.paidOut)} />
        </section>

        {/* Month by month */}
        <h2 className="text-[15px] font-bold tracking-[-0.01em]" style={{ color: INK }}>Earnings By Month</h2>
        <div className="-mx-6 mt-3 overflow-x-auto px-6 sm:mx-0 sm:px-0 print:mx-0 print:overflow-visible print:px-0">
          <table className="w-full min-w-[600px] border-collapse text-[13px] print:min-w-0 print:text-[11px]">
            <thead>
              <tr style={{ color: FAINT }}>
                {["Month", "Code Uses", "Signups That Count", "New Subscribers", "Signup Bonus", "Subscriptions", "Earned"].map((h, i) => (
                  <th key={h} className={`border-b pb-2 align-bottom font-semibold ${i === 0 ? "text-left" : "pl-4 text-right"}`} style={{ borderColor: LINE }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ color: INK }}>
              {s.months.map((r) => (
                <tr key={r.month}>
                  <td className="whitespace-nowrap border-b py-2.5 text-left" style={{ borderColor: LINE }}>{monthName(r.month)}</td>
                  <Num>{r.codeUses}</Num>
                  <Num>{r.signups}</Num>
                  <Num>{r.newPaid}</Num>
                  <Num>{amt(r.bonus)}</Num>
                  <Num>{amt(r.commission)}</Num>
                  <Num strong>{amt(r.bonus + r.commission)}</Num>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="pt-3 text-left">Total</td>
                <Num bare>{totals.codeUses}</Num>
                <Num bare>{totals.signups}</Num>
                <Num bare>{totals.newPaid}</Num>
                <Num bare>{amt(totals.bonus)}</Num>
                <Num bare>{amt(totals.commission)}</Num>
                <Num bare>{amt(earnedInPeriod)}</Num>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px]" style={{ color: FAINT }}>All amounts in {cur}.</p>

        {/* How it works */}
        <section className="mt-8 rounded-2xl px-5 py-4 text-[12.5px] leading-[1.6] print:mt-5 print:break-inside-avoid print:text-[11px]" style={{ background: "#F4F8FE", color: BODY }}>
          <p className="font-semibold" style={{ color: INK }}>How These Numbers Work</p>
          <p className="mt-1">{NOTE(cur)}</p>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t pt-5 text-[12px] print:mt-5 print:pt-3" style={{ borderColor: LINE, color: FAINT }}>
          <span>WhatYouAte Creator Program · whatyouate.app/creators</span>
          <span>Questions about this statement? support@whatyouate.app</span>
        </footer>
      </article>

      <style>{`
        @media print {
          @page { margin: 0.5in; }
          html, body { background: #fff !important; }
          .statement { box-shadow: none !important; }
          .statement * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-[13.5px] leading-[1.55]" style={{ color: BODY }}>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: FAINT }}>{label}</p>
      {children}
    </div>
  );
}

function Total({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl px-4 py-3.5 ring-1" style={{ background: strong ? "#EEF5FE" : "#F7FAFE", ["--tw-ring-color" as string]: strong ? "#B9D4FA" : LINE }}>
      <p className="text-[12px] font-medium" style={{ color: BODY }}>{label}</p>
      <p className="mt-1 text-[19px] font-bold tracking-[-0.02em] tabular-nums" style={{ color: INK }}>{value}</p>
    </div>
  );
}

function Num({ children, strong = false, bare = false }: { children: React.ReactNode; strong?: boolean; bare?: boolean }) {
  return (
    <td className={`${bare ? "pt-3" : "border-b py-2.5"} whitespace-nowrap pl-4 text-right tabular-nums ${strong ? "font-semibold" : ""}`} style={bare ? undefined : { borderColor: LINE }}>
      {children}
    </td>
  );
}
