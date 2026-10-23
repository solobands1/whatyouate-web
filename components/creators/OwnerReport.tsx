"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "../Logo";
import { Card } from "./Shell";
import { ownerReport, sb, type OwnerReport as Report } from "./api";
import { PAYOUT_LABEL, longDate, money } from "./shared";
import { BODY, INK } from "../site";

// The owner's report (/creators/owner/report?period=2026-11 | 2026 | all): what the creator program did
// in a month, a year or all time, and every payout made, with US-dollar payouts valued in CAD at the
// Bank of Canada rate on the day each was paid (saved by the app server). Download PDF prints it;
// Download Excel saves the same as a spreadsheet. The data comes from owner_report in creators.sql,
// which only owners can call.

const FAINT = "#8FA3C0";
const LINE = "#16233B14";
const FIRST_MONTH = "2026-10"; // the program's first month

const monthName = (ym: string) => new Date(`${ym}-01T12:00:00`).toLocaleDateString("en-CA", { month: "long", year: "numeric" });
const fullDate = (iso: string) => `${longDate(iso)}, ${iso.slice(0, 4)}`;
const methodLabel = (m: Report["payouts"][number]["method"]) => (m === "wise" ? "Wise" : PAYOUT_LABEL[m]);

/** "all", "2026" or "2026-11" as the report's [from, to) dates and a label. */
function periodRange(period: string): { from: string | null; to: string | null; label: string } {
  if (/^\d{4}$/.test(period)) return { from: `${period}-01-01`, to: `${Number(period) + 1}-01-01`, label: period };
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    return { from: `${period}-01`, to: `${next}-01`, label: monthName(period) };
  }
  return { from: null, to: null, label: "All Time" };
}

/** Every month from the program's start to now, newest first, and the years they cover. */
function periods() {
  const months: string[] = [];
  const now = new Date();
  for (let d = new Date(`${FIRST_MONTH}-01T12:00:00`); d <= now; d.setMonth(d.getMonth() + 1)) {
    months.unshift(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return { months, years: [...new Set(months.map((m) => m.slice(0, 4)))] };
}

const cadValue = (p: Report["payouts"][number]) => (p.currency === "CAD" ? p.amount : p.usdCad ? p.amount * p.usdCad : null);

function totals(r: Report) {
  const paid: Record<string, number> = {};
  for (const p of r.payouts) paid[p.currency] = (paid[p.currency] ?? 0) + p.amount;
  const byMethod: Record<string, { count: number; amounts: Record<string, number> }> = {};
  for (const p of r.payouts) {
    const m = (byMethod[p.method] ??= { count: 0, amounts: {} });
    m.count += 1;
    m.amounts[p.currency] = (m.amounts[p.currency] ?? 0) + p.amount;
  }
  const values = r.payouts.map(cadValue);
  return {
    paid,
    byMethod,
    cadTotal: values.reduce<number>((a, v) => a + (v ?? 0), 0),
    missingRates: values.filter((v) => v === null).length,
    fees: r.payouts.reduce((a, p) => a + (p.feeCad ?? 0), 0),
  };
}

const lines = (rows: { currency: string; amount: number }[] | Record<string, number>) => {
  const list = Array.isArray(rows) ? rows.map((r) => money(r.amount, r.currency)) : Object.entries(rows).map(([c, v]) => money(v, c));
  return list.length ? list : ["$0.00"];
};

export default function OwnerReport() {
  const router = useRouter();
  const [period, setPeriod] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notOwner" | "error">("loading");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("period") ?? "all";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPeriod(p);
  }, []);
  useEffect(() => {
    if (period === null) return;
    let live = true;
    (async () => {
      const { data } = await sb().auth.getSession();
      if (!data.session) {
        router.replace(`/creators/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }
      setState("loading");
      const { from, to } = periodRange(period);
      try {
        const r = await ownerReport(from, to);
        if (live) {
          setReport(r);
          setState("ready");
        }
      } catch (e) {
        if (live) setState(/not_owner/.test(String((e as { message?: string })?.message)) ? "notOwner" : "error");
      }
    })();
    return () => {
      live = false;
    };
  }, [period, router]);

  const choose = (p: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("period", p);
    window.history.replaceState(null, "", url);
    setPeriod(p);
  };

  if (state === "notOwner" || state === "error") {
    return (
      <Card className="px-7 py-9 text-center">
        <h1 className="text-[22px] font-bold tracking-[-0.03em]" style={{ color: INK }}>{state === "notOwner" ? "Not Allowed" : "Couldn't Load"}</h1>
        <p className="mt-3 text-[15.5px] leading-[1.6]" style={{ color: BODY }}>
          {state === "notOwner" ? "This page is only for the program's owners." : "Something went wrong loading the report. Try again in a moment."}
        </p>
      </Card>
    );
  }

  const { months, years } = periods();
  const { label } = periodRange(period ?? "all");
  const t = report ? totals(report) : null;
  const issued = new Date().toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="-mt-6 sm:-mt-10 print:mt-0">
      {/* Tools, left out of the printout */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/creators/owner" className="inline-flex items-center gap-1.5 text-[14px] font-semibold transition hover:opacity-70" style={{ color: BODY }}>
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back To Owner
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={period ?? "all"}
            onChange={(e) => choose(e.target.value)}
            aria-label="Period"
            className="appearance-none rounded-full bg-white py-2 pl-4 pr-10 text-[14px] font-semibold ring-1 ring-[#16233B]/[0.1] outline-none focus:ring-2 focus:ring-[#6FA8FF]"
            style={{
              color: INK,
              WebkitAppearance: "none",
              backgroundImage: `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='#101B2E' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M3 4.5l3 3 3-3'/></svg>")}")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 16px center",
              backgroundSize: "12px 12px",
            }}
          >
            <option value="all">All Time</option>
            <optgroup label="Years">
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </optgroup>
            <optgroup label="Months">
              {months.map((m) => (
                <option key={m} value={m}>{monthName(m)}</option>
              ))}
            </optgroup>
          </select>
          <button
            type="button"
            disabled={!report}
            onClick={async () => {
              if (!report) return;
              setSaving(true);
              await downloadReportSheet(report, label).catch(() => {});
              setSaving(false);
            }}
            className="text-[14px] font-semibold disabled:opacity-50"
            style={{ color: "#2F6FC4" }}
          >
            {saving ? "Preparing…" : "Download Excel"}
          </button>
          <button
            type="button"
            disabled={!report}
            onClick={() => window.print()}
            className="rounded-full px-5 py-2.5 text-[14px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: INK }}
          >
            Download PDF
          </button>
        </div>
      </div>

      {!report || !t || state === "loading" ? (
        <p className="py-24 text-center text-[15px]" style={{ color: BODY }}>Loading…</p>
      ) : (
        <article
          className="report rounded-3xl bg-white px-6 py-7 ring-1 ring-[#16233B]/[0.06] sm:px-10 sm:py-10 print:rounded-none print:p-0 print:shadow-none print:ring-0"
          style={{ boxShadow: "0 18px 40px -26px rgba(16,42,86,0.28)" }}
        >
          <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6 print:pb-4" style={{ borderColor: LINE }}>
            <Logo />
            <div className="sm:text-right print:text-right">
              <h1 className="text-[22px] font-bold tracking-[-0.03em]" style={{ color: INK }}>Creator Program Report</h1>
              <p className="mt-1 text-[13px]" style={{ color: BODY }}>{label}</p>
              <p className="text-[13px]" style={{ color: BODY }}>Issued {issued}</p>
            </div>
          </header>

          {/* Summary */}
          <section className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-4 print:grid-cols-4 print:py-4">
            <Box label="Creators Joined" lines={[String(report.creatorsJoined)]} note={`${report.creatorsActive} active now`} />
            <Box label="Users Brought In" lines={[String(report.codeUses)]} note={`${report.signups} signups that count`} />
            <Box label="New Paying Subscribers" lines={[String(report.newPaying)]} />
            <Box label="Creator Earnings" lines={lines(report.earned)} />
            <Box label="Paid To Creators" lines={lines(t.paid)} note={`${report.payouts.length} payout${report.payouts.length === 1 ? "" : "s"}`} strong />
            <Box label="Paid, In CAD" lines={[money(t.cadTotal, "CAD")]} note={t.missingRates ? `${t.missingRates} rate${t.missingRates === 1 ? "" : "s"} still to be saved` : "USD at the rate on the day paid"} />
            <Box label="Transfer Fees Entered" lines={[money(t.fees, "CAD")]} />
            <Box label="Owed Now" lines={lines(report.owedNow)} note="As of today" />
          </section>

          {/* Payouts */}
          <h2 className="text-[15px] font-bold tracking-[-0.01em]" style={{ color: INK }}>Payouts Paid</h2>
          {report.payouts.length ? (
            <div className="-mx-6 mt-3 overflow-x-auto px-6 sm:mx-0 sm:px-0 print:mx-0 print:overflow-visible print:px-0">
              <table className="w-full min-w-[700px] border-collapse text-[13px] print:min-w-0 print:text-[10.5px]">
                <thead>
                  <tr style={{ color: FAINT }}>
                    {["Paid On", "Creator", "Method", "Amount", "In CAD", "Rate", "Fee", "Reference"].map((h, i) => (
                      <th key={h} className={`border-b pb-2 align-bottom font-semibold ${i >= 3 && i <= 6 ? "pl-4 text-right" : i === 7 ? "pl-5 text-left" : "pr-2 text-left"}`} style={{ borderColor: LINE }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ color: INK }}>
                  {report.payouts.map((p, i) => {
                    const cad = cadValue(p);
                    return (
                      <tr key={i}>
                        <Td>{fullDate(p.paidOn)}</Td>
                        <Td>
                          {p.name} <span style={{ color: FAINT }}>{p.code}</span>
                        </Td>
                        <Td>{methodLabel(p.method)}</Td>
                        <Td num strong>{money(p.amount, p.currency)}</Td>
                        <Td num>{cad === null ? "Pending" : money(cad, "CAD").replace(" CAD", "")}</Td>
                        <Td num>{p.currency === "USD" && p.usdCad ? p.usdCad.toFixed(4) : ""}</Td>
                        <Td num>{p.feeCad ? money(p.feeCad, "CAD").replace(" CAD", "") : ""}</Td>
                        <Td gap>{p.reference}</Td>
                      </tr>
                    );
                  })}
                  <tr className="font-bold">
                    <td className="pt-3" colSpan={3}>Total</td>
                    <td className="whitespace-nowrap pl-4 pt-3 text-right tabular-nums">{lines(t.paid).join(" + ")}</td>
                    <td className="whitespace-nowrap pl-4 pt-3 text-right tabular-nums">{money(t.cadTotal, "CAD").replace(" CAD", "")}</td>
                    <td />
                    <td className="whitespace-nowrap pl-4 pt-3 text-right tabular-nums">{t.fees ? money(t.fees, "CAD").replace(" CAD", "") : ""}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-[13.5px]" style={{ color: BODY }}>No payouts were paid in this period.</p>
          )}
          {report.payouts.length > 0 && (
            <p className="mt-3 text-[12.5px]" style={{ color: BODY }}>
              {Object.entries(t.byMethod)
                .map(([m, v]) => `${m === "wise" ? "Wise" : PAYOUT_LABEL[m as keyof typeof PAYOUT_LABEL]}: ${lines(v.amounts).join(" + ")} to ${v.count} creator${v.count === 1 ? "" : "s"}`)
                .join(" · ")}
            </p>
          )}

          {/* Creators */}
          <h2 className="mt-8 text-[15px] font-bold tracking-[-0.01em] print:mt-5" style={{ color: INK }}>Creators</h2>
          {report.creators.length ? (
            <div className="-mx-6 mt-3 overflow-x-auto px-6 sm:mx-0 sm:px-0 print:mx-0 print:overflow-visible print:px-0">
              <table className="w-full min-w-[620px] border-collapse text-[13px] print:min-w-0 print:text-[10.5px]">
                <thead>
                  <tr style={{ color: FAINT }}>
                    {["Creator", "Users", "Signups", "New Paying", "Earned", "Paid"].map((h, i) => (
                      <th key={h} className={`border-b pb-2 align-bottom font-semibold ${i ? "pl-4 text-right" : "text-left"}`} style={{ borderColor: LINE }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ color: INK }}>
                  {report.creators.map((c) => (
                    <tr key={c.code}>
                      <Td>
                        {c.name} <span style={{ color: FAINT }}>{c.code}</span>
                      </Td>
                      <Td num>{c.codeUses}</Td>
                      <Td num>{c.signups}</Td>
                      <Td num>{c.newPaying}</Td>
                      <Td num>{money(c.earned, c.currency)}</Td>
                      <Td num>{money(c.paid, c.currency)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-[13.5px]" style={{ color: BODY }}>No creator activity in this period.</p>
          )}

          {/* Withheld */}
          {report.withheld.length > 0 && (
            <>
              <h2 className="mt-8 text-[15px] font-bold tracking-[-0.01em] print:mt-5" style={{ color: INK }}>Withheld Now</h2>
              <div className="mt-2 divide-y text-[13px]" style={{ borderColor: LINE, color: INK }}>
                {report.withheld.map((w, i) => (
                  <p key={i} className="py-2">
                    <span className="font-semibold">{w.name}</span>: {money(w.amount, w.currency)}, worked out {fullDate(w.dueOn)}
                    {w.reason && <span style={{ color: BODY }}>. {w.reason}</span>}
                  </p>
                ))}
              </div>
            </>
          )}

          <section className="mt-8 rounded-2xl px-5 py-4 text-[12.5px] leading-[1.6] print:mt-5 print:break-inside-avoid print:text-[10.5px]" style={{ background: "#F4F8FE", color: BODY }}>
            <p className="font-semibold" style={{ color: INK }}>About These Numbers</p>
            <p className="mt-1">
              Payouts are listed by the day they were paid. Values in CAD use the Bank of Canada&apos;s exchange rate for the day each US-dollar payout was
              paid. Transfer fees are only included where they were entered when the payout was marked paid. Creator earnings are listed by the day they
              were earned, so a payout can cover earnings from an earlier period. Ask your accountant how to report these.
            </p>
          </section>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t pt-5 text-[12px] print:mt-5 print:pt-3" style={{ borderColor: LINE, color: FAINT }}>
            <span>WhatYouAte Creator Program · {label}</span>
            <span>Issued {issued}</span>
          </footer>
        </article>
      )}

      <style>{`
        @media print {
          @page { margin: 0.5in; }
          html, body { background: #fff !important; }
          .report { box-shadow: none !important; }
          .report * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}

function Box({ label, lines, note, strong = false }: { label: string; lines: string[]; note?: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl px-4 py-3.5 ring-1" style={{ background: strong ? "#EEF5FE" : "#F7FAFE", ["--tw-ring-color" as string]: strong ? "#B9D4FA" : LINE }}>
      <p className="text-[12px] font-medium" style={{ color: BODY }}>{label}</p>
      {lines.map((l) => (
        <p key={l} className="mt-0.5 text-[17px] font-bold leading-[1.3] tracking-[-0.02em] tabular-nums" style={{ color: INK }}>{l}</p>
      ))}
      {note && <p className="mt-0.5 text-[11.5px]" style={{ color: FAINT }}>{note}</p>}
    </div>
  );
}

function Td({ children, num = false, strong = false, gap = false }: { children: React.ReactNode; num?: boolean; strong?: boolean; gap?: boolean }) {
  return (
    <td
      className={`border-b py-2.5 ${num ? "whitespace-nowrap pl-4 text-right tabular-nums" : gap ? "pl-5" : "pr-2"} ${strong ? "font-semibold" : ""}`}
      style={{ borderColor: LINE }}
    >
      {children}
    </td>
  );
}

/** The same report as a formatted Excel file: Summary, Payouts, Creators and Withheld tabs. */
async function downloadReportSheet(r: Report, label: string) {
  const { default: ExcelJS } = await import("exceljs");
  const t = totals(r);
  const wb = new ExcelJS.Workbook();
  wb.creator = "WhatYouAte";
  const MONEY = `"$"#,##0.00`;
  const head = { name: "Helvetica Neue", size: 10, bold: true, color: { argb: "FF5A6B85" } };
  const body = { name: "Helvetica Neue", size: 11, color: { argb: "FF101B2E" } };
  const tint = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEEF5FE" } };

  const sum = wb.addWorksheet("Summary", { views: [{ showGridLines: false }] });
  sum.columns = [{ width: 34 }, { width: 26 }];
  sum.getCell("A1").value = "WhatYouAte Creator Program Report";
  sum.getCell("A1").font = { ...body, size: 16, bold: true };
  sum.getCell("A2").value = `${label} · issued ${new Date().toISOString().slice(0, 10)}`;
  sum.getCell("A2").font = { ...body, color: { argb: "FF5A6B85" } };
  const rows: [string, string | number][] = [
    ["Creators Joined", r.creatorsJoined],
    ["Creators Active Now", r.creatorsActive],
    ["Users Brought In", r.codeUses],
    ["Signups That Count", r.signups],
    ["New Paying Subscribers", r.newPaying],
    ...r.earned.map((e) => [`Creator Earnings (${e.currency})`, e.amount] as [string, number]),
    ...Object.entries(t.paid).map(([c, v]) => [`Paid To Creators (${c})`, v] as [string, number]),
    ["Paid To Creators, In CAD", t.cadTotal],
    ["Transfer Fees Entered (CAD)", t.fees],
    ...r.owedNow.map((o) => [`Owed Now (${o.currency})`, o.amount] as [string, number]),
  ];
  rows.forEach(([k, v], i) => {
    const row = sum.getRow(i + 4);
    row.getCell(1).value = k;
    row.getCell(1).font = { ...body, color: { argb: "FF5A6B85" } };
    row.getCell(2).value = v;
    row.getCell(2).font = { ...body, bold: true };
    if (typeof v === "number" && !/^(Creators|Users|Signups|New Paying)/.test(k)) row.getCell(2).numFmt = MONEY;
  });

  const sheet = (title: string, cols: { header: string; width: number; money?: boolean }[], data: (string | number | null)[][]) => {
    const ws = wb.addWorksheet(title, { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
    ws.columns = cols.map((c) => ({ header: c.header, width: c.width }));
    ws.getRow(1).eachCell((cell) => {
      cell.font = head;
      cell.fill = tint;
    });
    for (const d of data) ws.addRow(d).eachCell((cell) => (cell.font = body));
    cols.forEach((c, i) => {
      if (c.money) ws.getColumn(i + 1).numFmt = MONEY;
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  };
  sheet(
    "Payouts",
    [
      { header: "Paid On", width: 12 }, { header: "Creator", width: 22 }, { header: "Code", width: 12 }, { header: "Country", width: 12 },
      { header: "Method", width: 18 }, { header: "Payout Email", width: 28 }, { header: "Amount", width: 12, money: true }, { header: "Currency", width: 10 },
      { header: "Rate (CAD per USD)", width: 17 }, { header: "In CAD", width: 12, money: true }, { header: "Fee (CAD)", width: 11, money: true },
      { header: "Reference", width: 22 }, { header: "Covers Earnings Before", width: 20 },
    ],
    r.payouts.map((p) => [
      p.paidOn, p.name, p.code, p.country === "OTHER" ? "Outside CA/US" : p.country, PAYOUT_LABEL[p.method], p.payoutEmail, p.amount, p.currency,
      p.currency === "USD" ? p.usdCad : null, cadValue(p), p.feeCad, p.reference, p.coversBefore,
    ]),
  );
  sheet(
    "Creators",
    [
      { header: "Creator", width: 22 }, { header: "Code", width: 12 }, { header: "Currency", width: 10 }, { header: "Users Brought In", width: 15 },
      { header: "Signups That Count", width: 17 }, { header: "New Paying", width: 11 }, { header: "Earned", width: 12, money: true }, { header: "Paid", width: 12, money: true },
    ],
    r.creators.map((c) => [c.name, c.code, c.currency, c.codeUses, c.signups, c.newPaying, c.earned, c.paid]),
  );
  sheet(
    "Withheld Now",
    [{ header: "Creator", width: 22 }, { header: "Amount", width: 12, money: true }, { header: "Currency", width: 10 }, { header: "Worked Out", width: 12 }, { header: "Reason", width: 40 }],
    r.withheld.map((w) => [w.name, w.amount, w.currency, w.dueOn, w.reason]),
  );

  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  a.download = `whatyouate-creator-report-${label.toLowerCase().replace(/\s+/g, "-")}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
