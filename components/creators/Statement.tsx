"use client";

import Link from "next/link";
import { useState } from "react";
import Logo from "../Logo";
import Gate from "./Gate";
import type { Dash } from "./api";
import { PAYOUT_LABEL, longDate, money } from "./shared";
import { BODY, INK } from "../site";

const FAINT = "#8FA3C0";
const LINE = "#16233B14";

const monthName = (ym: string) => new Date(`${ym}-01T12:00:00`).toLocaleDateString("en-CA", { month: "long", year: "numeric" });

function details(d: Dash) {
  const C = d.creator;
  return {
    method: C.payoutMethod === "wise" ? "Bank deposit through Wise" : PAYOUT_LABEL[C.payoutMethod],
    unpaid: Math.max(0, d.allTime.earned - d.allTime.paidOut),
    issued: new Date().toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" }),
    period: d.statement.length
      ? `${monthName(d.statement[0].month)} to ${monthName(d.statement[d.statement.length - 1].month)}`
      : monthName(new Date().toISOString().slice(0, 7)),
  };
}

/**
 * The statement as a formatted Excel file (opens in Excel, Numbers and Google Sheets): the icon and
 * title, the creator's details, a summary, the month-by-month table with totals, and payouts.
 * The spreadsheet library only loads when someone asks for the file.
 */
export async function downloadStatementSheet(d: Dash) {
  const { default: ExcelJS } = await import("exceljs");
  const C = d.creator;
  const cur = C.currency;
  const { method, unpaid, issued, period } = details(d);
  const MONEY = `"$"#,##0.00`;
  const INK_ARGB = "FF101B2E";
  const BODY_ARGB = "FF5A6B85";
  const FAINT_ARGB = "FF8FA3C0";
  const TINT = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEEF5FE" } };
  const LINE = { style: "thin" as const, color: { argb: "FFDCE4EF" } };

  const wb = new ExcelJS.Workbook();
  wb.creator = "WhatYouAte";
  const ws = wb.addWorksheet("Statement", { views: [{ showGridLines: false }], pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [{ width: 22 }, { width: 13 }, { width: 19 }, { width: 17 }, { width: 15 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 16 }];
  const font = (o: Partial<{ bold: boolean; size: number; color: string; italic: boolean }> = {}) => ({
    name: "Helvetica Neue",
    size: o.size ?? 11,
    bold: o.bold ?? false,
    italic: o.italic ?? false,
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
    const img = wb.addImage({ base64, extension: "png" });
    ws.addImage(img, { tl: { col: 0.15, row: 0.2 }, ext: { width: 44, height: 44 } });
  } catch {}
  ws.getRow(1).height = 22;
  ws.getRow(2).height = 18;
  ws.getCell("B1").value = "WhatYouAte Creator Statement";
  ws.getCell("B1").font = font({ bold: true, size: 16 });
  ws.getCell("B2").value = `Issued ${issued} · ${period}`;
  ws.getCell("B2").font = font({ color: BODY_ARGB });

  let row = 4;
  const label = (text: string) => {
    const c = ws.getCell(row, 1);
    c.value = text;
    c.font = font({ color: BODY_ARGB });
  };
  const info: [string, string][] = [
    ["Creator", C.name],
    ["Email", C.email],
    ...(C.instagram ? ([["Instagram", `@${C.instagram}`]] as [string, string][]) : []),
    ...(C.tiktok ? ([["TikTok", `@${C.tiktok}`]] as [string, string][]) : []),
    ["Creator Code", C.code],
    ["Your Link", `whatyouate.app/c/${C.code}`],
    ["Joined", `${longDate(C.joined)}, ${C.joined.slice(0, 4)}`],
    ["Payout Method", method],
    ["Payout Email", C.payoutEmail],
    ["Currency", `${cur === "CAD" ? "Canadian" : "US"} dollars (${cur})`],
  ];
  for (const [k, v] of info) {
    label(k);
    const c = ws.getCell(row, 2);
    c.value = v;
    c.font = font({ bold: k === "Creator" || k === "Creator Code" });
    row++;
  }

  // Summary
  row++;
  const summary: [string, number, string?][] = [
    ["Earned All Time", d.allTime.earned],
    ["Paid Out", d.allTime.paidOut],
    ["Not Yet Paid", unpaid],
    ["Next Payout", d.nextPayout.estimate, d.nextPayout.estimate > 0 ? d.nextPayout.date : "Sent once you reach $10"],
  ];
  summary.forEach(([k, v, note], i) => {
    const col = 1 + i * 2;
    const head = ws.getCell(row, col);
    head.value = k;
    head.font = font({ color: BODY_ARGB, size: 10 });
    const val = ws.getCell(row + 1, col);
    val.value = v;
    val.numFmt = MONEY;
    val.font = font({ bold: true, size: 14 });
    val.alignment = { horizontal: "left" };
    if (note) {
      const n = ws.getCell(row + 2, col);
      n.value = note;
      n.font = font({ color: FAINT_ARGB, size: 10 });
    }
  });
  row += 4;

  // Earnings by month
  const section = (text: string) => {
    const c = ws.getCell(row, 1);
    c.value = text;
    c.font = font({ bold: true, size: 13 });
    row++;
  };
  section(`Earnings By Month (${cur})`);
  const heads = ["Month", "Code Uses", "Signups That Count", "New Subscribers", "Signup Bonus", "Subscriptions", "Earned", "Paid", "Paid On"];
  heads.forEach((h, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = h;
    c.font = font({ bold: true, size: 10, color: BODY_ARGB });
    c.fill = TINT;
    c.border = { bottom: LINE };
    c.alignment = { horizontal: i === 0 ? "left" : "right", vertical: "middle", wrapText: true };
  });
  ws.getRow(row).height = 30;
  row++;
  const t = { codeUses: 0, signups: 0, newPaid: 0, bonus: 0, commission: 0, paid: 0 };
  for (const r of d.statement) {
    const vals = [monthName(r.month), r.codeUses, r.signups, r.newPaid, r.bonus, r.commission, r.bonus + r.commission, r.paid, r.paidOn ? `${longDate(r.paidOn)}, ${r.paidOn.slice(0, 4)}` : ""];
    vals.forEach((v, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = v;
      c.font = font({ bold: i === 6 });
      c.border = { bottom: LINE };
      c.alignment = { horizontal: i === 0 ? "left" : "right" };
      if (i >= 4 && i <= 7) c.numFmt = MONEY;
    });
    t.codeUses += r.codeUses;
    t.signups += r.signups;
    t.newPaid += r.newPaid;
    t.bonus += r.bonus;
    t.commission += r.commission;
    t.paid += r.paid;
    row++;
  }
  ["Total", t.codeUses, t.signups, t.newPaid, t.bonus, t.commission, t.bonus + t.commission, t.paid].forEach((v, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = v;
    c.font = font({ bold: true });
    c.alignment = { horizontal: i === 0 ? "left" : "right" };
    if (i >= 4) c.numFmt = MONEY;
  });
  row += 2;

  // Payouts
  section(`Payouts (${cur})`);
  const payouts = d.statement.filter((r) => r.paid > 0).reverse();
  if (payouts.length) {
    ["Paid On", "Method", "", "", "Amount"].forEach((h, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = h;
      c.font = font({ bold: true, size: 10, color: BODY_ARGB });
      c.fill = TINT;
      c.border = { bottom: LINE };
      c.alignment = { horizontal: i === 4 ? "right" : "left" };
    });
    row++;
    for (const r of payouts) {
      ws.getCell(row, 1).value = `${longDate(r.paidOn)}, ${r.paidOn.slice(0, 4)}`;
      ws.getCell(row, 2).value = method;
      const a = ws.getCell(row, 5);
      a.value = r.paid;
      a.numFmt = MONEY;
      a.font = font({ bold: true });
      for (let i = 1; i <= 5; i++) ws.getCell(row, i).border = { bottom: LINE };
      [1, 2].forEach((i) => (ws.getCell(row, i).font = font()));
      row++;
    }
  } else {
    ws.getCell(row, 1).value = "Your payouts will be listed here once they're sent.";
    ws.getCell(row, 1).font = font({ color: BODY_ARGB });
    row++;
  }
  row++;

  // Notes and contact
  ws.mergeCells(row, 1, row, 9);
  const note = ws.getCell(row, 1);
  note.value = `How these numbers work: you earn 30% of each subscription you bring in for its first 12 months, after Apple's fee, plus $1 for each signup that counts in your first month (up to $100). Earnings are fixed in ${cur} on the day each subscriber pays. Refunds come off in the month they happen. Payouts go out on the 1st of each month and cover earnings from the month before last, so refunds can clear. Balances under $10 roll over to the next month.`;
  note.font = font({ size: 10, color: BODY_ARGB });
  note.alignment = { wrapText: true, vertical: "top" };
  ws.getRow(row).height = 58;
  row += 2;
  ws.getCell(row, 1).value = "Questions about this statement? support@whatyouate.app";
  ws.getCell(row, 1).font = font({ size: 10, color: FAINT_ARGB });

  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  a.download = `whatyouate-statement-${C.code}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}


export default function Statement() {
  return <Gate>{(d) => <StatementView d={d} />}</Gate>;
}

/** A printable statement: who, what they've earned each month, and what's been paid. Save As PDF prints it. */
export function StatementView({ d }: { d: Dash }) {
  const [saving, setSaving] = useState(false);
  const C = d.creator;
  const cur = C.currency;
  const amt = (n: number) => money(n, cur).replace(` ${cur}`, "");
  const rows = d.statement;
  const total = rows.reduce(
    (t, r) => ({ codeUses: t.codeUses + r.codeUses, signups: t.signups + r.signups, newPaid: t.newPaid + r.newPaid, bonus: t.bonus + r.bonus, commission: t.commission + r.commission, paid: t.paid + r.paid }),
    { codeUses: 0, signups: 0, newPaid: 0, bonus: 0, commission: 0, paid: 0 },
  );
  const payouts = rows.filter((r) => r.paid > 0);
  const { method, unpaid, issued, period } = details(d);
  const socials = [C.instagram && `Instagram @${C.instagram}`, C.tiktok && `TikTok @${C.tiktok}`].filter(Boolean) as string[];

  return (
    <div className="-mt-6 sm:-mt-10 print:mt-0">
      {/* Tools, left out of the printout */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/creators/dashboard" className="inline-flex items-center gap-1.5 text-[14px] font-semibold transition hover:opacity-70" style={{ color: BODY }}>
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back To Dashboard
        </Link>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={async () => {
              setSaving(true);
              await downloadStatementSheet(d).catch(() => {});
              setSaving(false);
            }}
            className="text-[14px] font-semibold"
            style={{ color: "#2F6FC4" }}
          >
            {saving ? "Preparing…" : "Download Spreadsheet"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full px-5 py-2.5 text-[14px] font-semibold text-white transition hover:opacity-90"
            style={{ background: INK }}
          >
            Save As PDF
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
            <p className="mt-1 text-[13px]" style={{ color: BODY }}>Issued {issued}</p>
            <p className="text-[13px]" style={{ color: BODY }}>{period}</p>
          </div>
        </header>

        {/* Who */}
        <section className="grid gap-5 border-b py-6 sm:grid-cols-3 print:grid-cols-3 print:py-4" style={{ borderColor: LINE }}>
          <Info label="Creator">
            <p className="font-semibold" style={{ color: INK }}>{C.name}</p>
            <p>{C.email}</p>
            {socials.map((s) => (
              <p key={s}>{s}</p>
            ))}
          </Info>
          <Info label="Creator Code">
            <p className="font-semibold tracking-[0.04em]" style={{ color: INK }}>{C.code}</p>
            <p>whatyouate.app/c/{C.code}</p>
            <p>Joined {longDate(C.joined)}, {C.joined.slice(0, 4)}</p>
          </Info>
          <Info label="Payouts">
            <p className="font-semibold" style={{ color: INK }}>{method}</p>
            <p>{C.payoutEmail}</p>
            <p>Paid in {cur === "CAD" ? "Canadian" : "US"} dollars ({cur})</p>
          </Info>
        </section>

        {/* Summary */}
        <section className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-4 print:grid-cols-4 print:py-4">
          <Total label="Earned All Time" value={amt(d.allTime.earned)} />
          <Total label="Paid Out" value={amt(d.allTime.paidOut)} />
          <Total label="Not Yet Paid" value={amt(unpaid)} />
          <Total
            label="Next Payout"
            value={amt(d.nextPayout.estimate)}
            note={d.nextPayout.estimate > 0 ? d.nextPayout.date : "Sent once you reach $10"}
          />
        </section>

        {/* Month by month */}
        <h2 className="text-[15px] font-bold tracking-[-0.01em]" style={{ color: INK }}>Earnings By Month</h2>
        <div className="-mx-6 mt-3 overflow-x-auto px-6 sm:mx-0 sm:px-0 print:mx-0 print:overflow-visible print:px-0">
          <table className="w-full min-w-[680px] border-collapse text-[13px] print:min-w-0 print:text-[11px]">
            <thead>
              <tr style={{ color: FAINT }}>
                {["Month", "Code Uses", "Signups That Count", "New Subscribers", "Signup Bonus", "Subscriptions", "Earned", "Paid"].map((h, i) => (
                  <th key={h} className={`border-b pb-2 align-bottom font-semibold ${i === 0 ? "text-left" : "pl-4 text-right"}`} style={{ borderColor: LINE }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ color: INK }}>
              {rows.map((r) => (
                <tr key={r.month}>
                  <td className="whitespace-nowrap border-b py-2.5 text-left" style={{ borderColor: LINE }}>{monthName(r.month)}</td>
                  <Num>{r.codeUses}</Num>
                  <Num>{r.signups}</Num>
                  <Num>{r.newPaid}</Num>
                  <Num>{amt(r.bonus)}</Num>
                  <Num>{amt(r.commission)}</Num>
                  <Num strong>{amt(r.bonus + r.commission)}</Num>
                  <Num>{amt(r.paid)}</Num>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="pt-3 text-left">Total</td>
                <Num bare>{total.codeUses}</Num>
                <Num bare>{total.signups}</Num>
                <Num bare>{total.newPaid}</Num>
                <Num bare>{amt(total.bonus)}</Num>
                <Num bare>{amt(total.commission)}</Num>
                <Num bare>{amt(total.bonus + total.commission)}</Num>
                <Num bare>{amt(total.paid)}</Num>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px]" style={{ color: FAINT }}>All amounts in {cur}.</p>

        {/* Payouts */}
        <h2 className="mt-8 text-[15px] font-bold tracking-[-0.01em] print:mt-5" style={{ color: INK }}>Payouts</h2>
        {payouts.length ? (
          <table className="mt-3 w-full border-collapse text-[13px] print:text-[11px]">
            <thead>
              <tr style={{ color: FAINT }}>
                <th className="border-b pb-2 text-left font-semibold" style={{ borderColor: LINE }}>Paid On</th>
                <th className="border-b pb-2 text-left font-semibold" style={{ borderColor: LINE }}>Method</th>
                <th className="border-b pb-2 text-right font-semibold" style={{ borderColor: LINE }}>Amount</th>
              </tr>
            </thead>
            <tbody style={{ color: INK }}>
              {[...payouts].reverse().map((r) => (
                <tr key={r.month}>
                  <td className="border-b py-2.5" style={{ borderColor: LINE }}>{longDate(r.paidOn)}, {r.paidOn.slice(0, 4)}</td>
                  <td className="border-b py-2.5" style={{ borderColor: LINE }}>{method}</td>
                  <td className="whitespace-nowrap border-b py-2.5 pl-4 text-right font-semibold tabular-nums" style={{ borderColor: LINE }}>{money(r.paid, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-2 text-[13.5px]" style={{ color: BODY }}>
            Your payouts will be listed here once they&apos;re sent.
            {d.nextPayout.estimate > 0 ? ` Your first one is planned for ${d.nextPayout.date}.` : ""}
          </p>
        )}

        {/* How it works */}
        <section className="mt-8 rounded-2xl px-5 py-4 text-[12.5px] leading-[1.6] print:mt-5 print:break-inside-avoid print:text-[11px]" style={{ background: "#F4F8FE", color: BODY }}>
          <p className="font-semibold" style={{ color: INK }}>How These Numbers Work</p>
          <p className="mt-1">
            You earn 30% of each subscription you bring in for its first 12 months, after Apple&apos;s fee, plus $1 for each signup that
            counts in your first month (up to $100). Earnings are fixed in {cur} on the day each subscriber pays. Refunds come off in the
            month they happen. Payouts go out on the 1st of each month and cover earnings from the month before last, so refunds can
            clear. Balances under $10 roll over to the next month.
          </p>
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

function Total({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl px-4 py-3.5 ring-1" style={{ background: "#F7FAFE", ["--tw-ring-color" as string]: LINE }}>
      <p className="text-[12px] font-medium" style={{ color: BODY }}>{label}</p>
      <p className="mt-1 text-[19px] font-bold tracking-[-0.02em] tabular-nums" style={{ color: INK }}>{value}</p>
      {note && <p className="text-[12px]" style={{ color: FAINT }}>{note}</p>}
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
