// Preview data for the creator pages. Replaced by real Supabase data once the backend is wired.

export const SAMPLE_CREATOR = {
  name: "Sarah Chen",
  email: "sarah@example.com",
  instagram: "sarahs.gut.kitchen",
  tiktok: "sarahsgutkitchen",
  country: "CA" as Country,
  payoutMethod: "etransfer" as PayoutMethod,
  payoutEmail: "sarah@example.com",
  code: "SARAH",
  joined: "2026-10-02",
  bonusEnds: "2026-11-02",
};

export const SAMPLE_STATS = {
  month: { label: "October", codeUses: 41, qualified: 23, newPaid: 6, bonus: 23, commission: 31.4 },
  allTime: { paidSubs: 6, earned: 54.4, paidOut: 0 },
  nextPayout: { date: "December 1", estimate: 54.4 },
  // What current subscribers are on track to earn each month (yearly plans spread over 12 months).
  recurring: { monthly: 22.4, active: 6 },
  // Month-by-month statement rows for the CSV download.
  statement: [
    { month: "2026-10", codeUses: 41, signups: 23, newPaid: 6, bonus: 23, commission: 31.4, paid: 0, paidOn: "" },
  ],
  // Code uses per week, oldest first.
  weekly: [
    { week: "Sep 21", uses: 0 },
    { week: "Sep 28", uses: 0 },
    { week: "Oct 5", uses: 9 },
    { week: "Oct 12", uses: 26 },
    { week: "Oct 19", uses: 6 },
  ],
};

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
]);

// Small starter list. The real check runs server-side against a fuller list.
const BLOCKED_FRAGMENTS = ["FUCK", "SHIT", "BITCH", "CUNT", "DICK", "NAZI", "PORN", "SEX"];

// Every code ever issued stays taken, including codes a creator has since changed away from.
const SAMPLE_TAKEN = new Set(["SARAH", "JESS", "GUTHEALTH", "LOWFODMAP", "MIKE"]);

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
  if (SAMPLE_TAKEN.has(code)) return { ok: false, reason: "That code is already taken. Try another." };
  return { ok: true };
}
