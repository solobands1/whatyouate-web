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
