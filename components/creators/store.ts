"use client";

import { useEffect, useState } from "react";
import { SAMPLE_CREATOR } from "./sample";

// Preview-only stand-in for the creator's account. Whatever someone enters on Join or Profile is
// kept in this browser so the dashboard, kit and share page show their own name and code.
// Replaced by the Supabase creators table once the backend is wired.

export type Creator = typeof SAMPLE_CREATOR;
const KEY = "wya_creator_preview";

export function loadCreator(): Creator {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...SAMPLE_CREATOR, ...JSON.parse(raw) };
  } catch {}
  return SAMPLE_CREATOR;
}

export function saveCreator(patch: Partial<Creator>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadCreator(), ...patch }));
  } catch {}
}

export function clearCreator() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/** The current creator. Starts as the sample so the first paint matches the server render. */
export function useCreator(): Creator {
  const [c, setC] = useState<Creator>(SAMPLE_CREATOR);
  useEffect(() => setC(loadCreator()), []);
  return c;
}

export function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function longDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-CA", { month: "long", day: "numeric" });
}
