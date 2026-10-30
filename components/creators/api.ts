"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Country, PayoutMethod } from "./shared";

// The publishable key is meant to ship in browser code. What anyone can read or change is
// decided in the database: row-level security plus the creator_* functions in the app repo's
// supabase/creators.sql.
const SUPABASE_URL = "https://dopwptglzsfpdqmbeayw.supabase.co";
const SUPABASE_KEY = "sb_publishable_nYhmn0_Ivtx51pT5LmmRPA_UFj7VsSP";

// App Store id, for the free Pro redemption link.
const APPLE_APP_ID = "6762287393";

let client: SupabaseClient | null = null;
export function sb() {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "wya-creators-auth" },
    });
  }
  return client;
}

export type Dash = {
  creator: {
    name: string;
    email: string;
    instagram: string;
    tiktok: string;
    country: Country;
    currency: "CAD" | "USD";
    payoutMethod: PayoutMethod;
    payoutEmail: string;
    code: string;
    status: "active" | "left" | "removed";
    joined: string;
    bonusEnds: string;
    oldCodes: string[];
  };
  pro: { threeMonths: string | null; year: string | null; unlocked: boolean; paying: number };
  month: { label: string; codeUses: number; qualified: number; newPaid: number; bonus: number; commission: number };
  allTime: { paidSubs: number; earned: number; paidOut: number };
  nextPayout: { date: string; covers: string; estimate: number };
  recurring: { monthly: number; active: number };
  freeMonth: number;
  statement: { month: string; codeUses: number; signups: number; newPaid: number; bonus: number; commission: number; paid: number; paidOn: string }[];
  weekly: { week: string; uses: number }[];
};

/** One statement, frozen when its payout was marked paid (creator_statement_snapshot in creators.sql). */
export type IssuedStatement = {
  payout: { id: string; amount: number; currency: "CAD" | "USD"; paidOn: string; reference: string; method: PayoutMethod; payoutEmail: string };
  period: { from: string; to: string };
  creator: {
    name: string;
    email: string;
    instagram: string;
    tiktok: string;
    country: Country;
    currency: "CAD" | "USD";
    payoutMethod: PayoutMethod;
    payoutEmail: string;
    code: string;
    joined: string;
  };
  months: { month: string; codeUses: number; signups: number; newPaid: number; bonus: number; commission: number }[];
  allTime: { earned: number; paidOut: number };
};

export type OwnerCreator = {
  id: string;
  name: string;
  email: string;
  code: string;
  country: Country;
  currency: "CAD" | "USD";
  status: "active" | "left" | "removed";
  instagram: string;
  tiktok: string;
  payoutMethod: PayoutMethod;
  payoutEmail: string;
  joined: string;
  codeUses: number;
  signups: number;
  paying: number;
  earned: number;
  paidOut: number;
  /** All time, whatever month is shown. */
  owed: number;
  /** Earned before the latest payout cutoff but under $10, so carried into the next payout. */
  rolledOver: number;
  notes: string;
  posted: boolean;
  payout: { id: string; amount: number; status: "due" | "paid" | "withheld"; dueOn: string; paidOn: string | null; reference: string; returned: boolean; holdReason: string } | null;
};
export type OwnerOverview = {
  /** "2026-11", or null for all time. */
  month: string | null;
  months: string[];
  creators: OwnerCreator[];
  proCodes: { threeMonths: number; year: number };
};
export type OwnerPayoutRow = {
  name: string;
  email: string;
  code: string;
  country: Country;
  payoutMethod: PayoutMethod;
  payoutEmail: string;
  dueOn: string;
  coversBefore: string;
  amount: number;
  currency: "CAD" | "USD";
  status: "due" | "paid" | "withheld";
  paidOn: string | null;
  reference: string;
  returned: boolean;
  holdReason: string;
};

export function redeemLink(code: string) {
  return `https://apps.apple.com/redeem?ctx=offercodes&id=${APPLE_APP_ID}&code=${encodeURIComponent(code)}`;
}

// ---- Errors ----------------------------------------------------------------------------

const MESSAGES: Record<string, string> = {
  code_short: "Use at least 3 letters or numbers.",
  code_long: "Keep it to 15 characters or fewer.",
  code_reserved: "That code is reserved. Try another.",
  code_blocked: "That code isn't allowed. Try another.",
  code_taken: "That code is already taken. Try another.",
  already_joined: "This email already has a creator account. Log in instead.",
  country_locked: `You can't change your country once you've earned something, because earnings are kept in your currency. Email us and we'll sort it out.`,
  not_a_creator: "Your creator account isn't active.",
  not_signed_in: "Your session ended. Log in again.",
  not_owner: "This page is only for the program's owners.",
  already_paid: "That payout is already marked paid.",
  not_paid: "Only a paid payout can be marked returned.",
  not_removed: "Only a removed creator can be restored.",
  no_account: "We couldn't find a creator account with that email.",
  bad_code: "That code didn't work. Check the email and try again, or send a new one.",
  rate_limited: "Too many tries. Wait a minute and try again.",
};

/** A plain-language message for anything the database or Supabase Auth throws. */
export function errorText(e: unknown): string {
  const raw = typeof e === "string" ? e : (e as { message?: string })?.message ?? "";
  const key = Object.keys(MESSAGES).find((k) => raw.includes(k));
  if (key) return MESSAGES[key];
  if (/rate limit|too many|security purposes/i.test(raw)) return MESSAGES.rate_limited;
  if (/expired|invalid/i.test(raw)) return MESSAGES.bad_code;
  if (/signups not allowed|user not found/i.test(raw)) return MESSAGES.no_account;
  return "Something went wrong. Try again in a moment.";
}

/** The reason a code can't be used, as the CodeInput shows it, or null when it's free. */
export function codeProblemText(problem: string | null) {
  return problem ? MESSAGES[`code_${problem}`] ?? MESSAGES.code_taken : null;
}

// ---- Auth ------------------------------------------------------------------------------

/** Emails a 6-digit sign-in code. `create` allows a brand new email (joining). */
export async function sendSignInCode(email: string, create: boolean) {
  const { error } = await sb().auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: create } });
  if (error) throw error;
}

export async function verifySignInCode(email: string, token: string) {
  const { error } = await sb().auth.verifyOtp({ email: email.trim().toLowerCase(), token: token.trim(), type: "email" });
  if (error) throw error;
}

export async function signedInEmail(): Promise<string | null> {
  const { data } = await sb().auth.getSession();
  return data.session?.user.email ?? null;
}

export async function signOut() {
  await sb().auth.signOut();
}

// ---- Creator data ----------------------------------------------------------------------

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const checkCodeRemote = (code: string) => rpc<string | null>("creator_check_code", { p_code: code });
export const publicName = (code: string) => rpc<string | null>("creator_public_name", { p_code: code });
export const loadDashboard = () => rpc<Dash | null>("creator_dashboard");
export const leaveProgram = () => rpc<null>("creator_leave");
export const changeCode = (code: string) => rpc("creator_change_code", { p_code: code });
export const loadStatements = () => rpc<IssuedStatement[]>("creator_statements");

// ---- Owner -------------------------------------------------------------------------------

export const isOwner = () => rpc<boolean>("creator_is_owner").catch(() => false);
export const ownerOverview = (month?: string | null) => rpc<OwnerOverview>("owner_overview", month ? { p_month: `${month}-01` } : {});
export const ownerReopenPayout = (id: string) => rpc("owner_reopen_payout", { p_payout: id });
export const ownerUpdateCreator = (id: string, notes: string, posted: boolean) =>
  rpc("owner_update_creator", { p_creator: id, p_notes: notes, p_posted: posted });
export const ownerSetCreatorStatus = (id: string, status: "removed" | "active", withhold = true) =>
  rpc("owner_set_creator_status", { p_creator: id, p_status: status, p_withhold: withhold });
export const ownerExport = () => rpc<OwnerPayoutRow[]>("owner_export");
export const ownerSetPayout = (id: string, status: "paid" | "due" | "withheld", reference: string, feeCad?: number | null) =>
  rpc<{ id: string; status: string }>("owner_set_payout", { p_payout: id, p_status: status, p_reference: reference, p_fee_cad: feeCad ?? null });

export type OwnerReport = {
  from: string | null;
  to: string | null;
  creatorsJoined: number;
  creatorsActive: number;
  codeUses: number;
  signups: number;
  newPaying: number;
  earned: { currency: "CAD" | "USD"; amount: number }[];
  creators: { name: string; code: string; currency: "CAD" | "USD"; country: Country; codeUses: number; signups: number; newPaying: number; earned: number; paid: number }[];
  payouts: {
    paidOn: string;
    name: string;
    code: string;
    country: Country;
    method: PayoutMethod;
    payoutEmail: string;
    amount: number;
    currency: "CAD" | "USD";
    reference: string;
    usdCad: number | null;
    feeCad: number | null;
    coversBefore: string;
  }[];
  withheld: { name: string; amount: number; currency: "CAD" | "USD"; dueOn: string; reason: string }[];
  owedNow: { currency: "CAD" | "USD"; amount: number }[];
};
/** The owner's report for [from, to) (dates as YYYY-MM-DD), or all time with no dates. */
export const ownerReport = (from?: string | null, to?: string | null) =>
  rpc<OwnerReport>("owner_report", from && to ? { p_from: from, p_to: to } : {});

/** After a payout is marked paid: asks the app server to email the creator their statement now. */
export async function sendPayoutEmail(payoutId: string) {
  const { data } = await sb().auth.getSession();
  const res = await fetch("https://whatyouate.vercel.app/api/creators/payout-paid", {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}`, "Content-Type": "application/json" },
    body: JSON.stringify({ payoutId }),
  }).catch(() => null);
  return !!res?.ok;
}

export type ProfileFields = {
  name: string;
  instagram: string;
  tiktok: string;
  country: Country;
  payoutMethod: PayoutMethod;
  payoutEmail: string;
};

export const joinProgram = (f: ProfileFields & { code: string }) =>
  rpc("creator_join", {
    p_name: f.name, p_instagram: f.instagram, p_tiktok: f.tiktok, p_code: f.code,
    p_country: f.country, p_payout_method: f.payoutMethod, p_payout_email: f.payoutEmail,
  });

/** Asks the app server to send the welcome email. It sends once per creator, and the daily job catches any miss. */
export async function requestWelcomeEmail() {
  const { data } = await sb().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  await fetch("https://whatyouate.vercel.app/api/creators/welcome", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    keepalive: true,
  }).catch(() => {});
}

export const updateProfile = (f: ProfileFields) =>
  rpc("creator_update_profile", {
    p_name: f.name, p_instagram: f.instagram, p_tiktok: f.tiktok,
    p_country: f.country, p_payout_method: f.payoutMethod, p_payout_email: f.payoutEmail,
  });

// ---- Session hook for the signed-in pages ------------------------------------------------

export type CreatorState =
  | { phase: "loading" }
  | { phase: "signedOut" }
  | { phase: "notCreator"; email: string }
  | { phase: "error"; message: string }
  | { phase: "ready"; dash: Dash };

/**
 * The signed-in creator's dashboard data. Pages send signed-out visitors to Log In and
 * signed-in people without a creator account to Join.
 */
export function useCreatorState(): [CreatorState, () => Promise<void>] {
  const [state, setState] = useState<CreatorState>({ phase: "loading" });
  const load = useCallback(async () => {
    try {
      const email = await signedInEmail();
      if (!email) return setState({ phase: "signedOut" });
      const dash = await loadDashboard();
      setState(dash ? { phase: "ready", dash } : { phase: "notCreator", email });
    } catch (e) {
      setState({ phase: "error", message: errorText(e) });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return [state, load];
}

// ---- Creator outreach (owner only; see outreach.sql in the app repo) ----------------------------
export type OutreachSent = { step: number; id: string; ts: number };
export type OutreachContact = {
  id: string; block: number; firstName: string; fullName: string; email: string; instagram: string; tiktok: string;
  website: string; currency: "USD" | "CAD"; hook: string; decision: "pending" | "approve" | "skip";
  status: "queued" | "sent" | "done" | "replied" | "joined" | "opted_out" | "bounced"; sent: OutreachSent[];
  repliedAt: string | null; statusAt: string | null;
};
export type OutreachData = {
  settings: { live: boolean; paused: boolean; last_send: string | null; last_sync: string | null };
  stats: { sent: number; contacted: number; replied: number; joined: number; optedOut: number; bounced: number };
  contacts: OutreachContact[];
};
export const outreachList = () => rpc<OutreachData>("owner_outreach_list");
export const outreachDecide = (id: string, decision: "pending" | "approve" | "skip") => rpc("owner_outreach_decide", { p_id: id, p_decision: decision });
export const outreachDecideBlock = (block: number, decision: "approve" | "skip") => rpc("owner_outreach_decide_block", { p_block: block, p_decision: decision });
export const outreachUpdateHook = (id: string, hook: string) => rpc("owner_outreach_update_hook", { p_id: id, p_hook: hook });
export const outreachSettings = (live: boolean | null, paused: boolean | null) => rpc("owner_outreach_settings", { p_live: live, p_paused: paused });
