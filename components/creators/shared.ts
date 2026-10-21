// Shared creator types, payout labels, money formatting and the quick code check.

export type Country = "CA" | "US" | "OTHER";
export type PayoutMethod = "etransfer" | "paypal" | "wise";

export const PAYOUT_LABEL: Record<PayoutMethod, string> = {
  etransfer: "Interac e-Transfer",
  paypal: "PayPal",
  wise: "bank deposit",
};

export function currencyFor(country: Country) {
  return country === "CA" ? "CAD" : "USD";
}

export function money(n: number, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(n) + (currency === "CAD" ? " CAD" : " USD");
}

// ---- Codes -------------------------------------------------------------------------------

const RESERVED = new Set([
  "WHATYOUATE", "WYA", "ADMIN", "SUPPORT", "HELP", "FREE", "TEST", "APPLE", "APPSTORE", "PROMO",
  "CODE", "CREATOR", "CREATORS", "OFFICIAL", "STAFF", "TEAM", "INTEGRITYSTACK",
  "YOURCODE", "YOURNAME", "EXAMPLE", "SAMPLE",
]);

// Instant feedback while typing. The database repeats these checks with a fuller list and
// also knows which codes are taken (creator_code_problem in supabase/creators.sql).
const BLOCKED_FRAGMENTS = ["FUCK", "SHIT", "BITCH", "CUNT", "DICK", "NAZI", "PORN", "SEX"];

export type CodeCheck = { ok: true } | { ok: false; reason: string };

export function normalizeCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function checkCode(raw: string, current?: string): CodeCheck {
  const code = normalizeCode(raw);
  if (code.length < 3) return { ok: false, reason: "Use at least 3 letters or numbers." };
  if (code.length > 15) return { ok: false, reason: "Keep it to 15 characters or fewer." };
  if (current && code === current) return { ok: true };
  if (RESERVED.has(code)) return { ok: false, reason: "That code is reserved. Try another." };
  if (BLOCKED_FRAGMENTS.some((f) => code.includes(f))) return { ok: false, reason: "That code isn't allowed. Try another." };
  return { ok: true };
}

/** "2026-11-02" as "November 2". */
export function longDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-CA", { month: "long", day: "numeric" });
}
