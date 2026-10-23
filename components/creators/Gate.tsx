"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./Shell";
import { useCreatorState, type Dash } from "./api";
import { BODY, INK } from "../site";

/**
 * Wraps the signed-in creator pages: shows a quiet loading state, sends signed-out visitors
 * to Log In and people without a creator account to Join, then renders the page.
 */
export default function Gate({ children }: { children: (dash: Dash, reload: () => Promise<void>) => React.ReactNode }) {
  const [state, reload] = useCreatorState();
  const router = useRouter();

  useEffect(() => {
    if (state.phase === "signedOut") {
      const here = window.location.pathname + window.location.search + window.location.hash;
      router.replace(`/creators/login?next=${encodeURIComponent(here)}`);
    }
    if (state.phase === "notCreator") router.replace("/creators/join");
  }, [state.phase, router]);

  if (state.phase === "ready") return <>{children(state.dash, reload)}</>;
  if (state.phase === "error") {
    return (
      <Card className="px-7 py-9 text-center">
        <h2 className="text-[22px] font-bold tracking-[-0.03em]" style={{ color: INK }}>Couldn&apos;t Load Your Account</h2>
        <p className="mt-3 text-[15.5px] leading-[1.6]" style={{ color: BODY }}>{state.message}</p>
        <button type="button" onClick={reload} className="mt-6 text-[15px] font-semibold" style={{ color: "#2F6FC4" }}>
          Try Again
        </button>
      </Card>
    );
  }
  return <p className="py-24 text-center text-[15px]" style={{ color: BODY }}>Loading…</p>;
}
