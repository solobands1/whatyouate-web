"use client";

import { useEffect, useState } from "react";
import { Card } from "./Shell";
import { BODY, INK } from "../site";

type Currency = "USD" | "CAD";

// 30% of the price after Apple's 15%: yearly $109.99 USD / $149.99 CAD, monthly $12.99 USD / $17.99 CAD.
// Keep in step with the dashboard tips (Dashboard.tsx) and the welcome email (app repo).
const AMOUNTS: Record<Currency, { yearly: string; monthly: string }> = {
  USD: { yearly: "about $28", monthly: "about $3.30" },
  CAD: { yearly: "about $38", monthly: "about $4.50" },
};

/** Visitors whose device is set to a Canadian time zone (or Canadian English or French) start on CAD. */
function looksCanadian() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    const canadianZone =
      /^America\/(Toronto|Montreal|Vancouver|Edmonton|Calgary|Winnipeg|Regina|Swift_Current|Halifax|Glace_Bay|Moncton|Goose_Bay|St_Johns|Whitehorse|Dawson|Dawson_Creek|Creston|Fort_Nelson|Iqaluit|Rankin_Inlet|Resolute|Cambridge_Bay|Inuvik|Yellowknife|Atikokan|Nipigon|Thunder_Bay|Rainy_River|Pangnirtung|Blanc-Sablon)$/.test(zone) ||
      zone.startsWith("Canada/");
    const canadianLanguage = (navigator.languages ?? [navigator.language]).some((l) => /-CA$/i.test(l));
    return canadianZone || canadianLanguage;
  } catch {
    return false;
  }
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 px-6 py-5">
      <span className="text-[16px]" style={{ color: INK }}>{label}</span>
      <span className="text-right">
        <span className="block text-[20px] font-bold tracking-[-0.02em]" style={{ color: INK }}>{value}</span>
        {sub && <span className="block whitespace-nowrap text-[13px]" style={{ color: BODY }}>{sub}</span>}
      </span>
    </div>
  );
}

export default function EarnTable() {
  const [cur, setCur] = useState<Currency>("USD");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setCur(looksCanadian() ? "CAD" : "USD"), []);
  const a = AMOUNTS[cur];

  return (
    <>
      <div className="mt-6 flex justify-end">
        {/* A segmented switch, like the dashboard's: a white thumb slides behind the selected side. */}
        <div role="tablist" aria-label="Currency" className="relative grid w-[148px] grid-cols-2 rounded-full bg-[#16233B]/[0.07] p-1">
          <span
            aria-hidden="true"
            className="absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-full bg-white transition-transform duration-300 ease-out"
            style={{
              transform: cur === "CAD" ? "translateX(100%)" : "translateX(0)",
              boxShadow: "0 1px 2px rgba(16,42,86,0.12), 0 4px 12px -4px rgba(16,42,86,0.18)",
            }}
          />
          {(["USD", "CAD"] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={cur === c}
              onClick={() => setCur(c)}
              className="relative z-10 rounded-full py-1.5 text-[13px] font-semibold tracking-[0.02em] transition-colors"
              style={{ color: cur === c ? INK : BODY }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <Card className="mt-3 divide-y divide-[#16233B]/[0.06]">
        <Row label="Each Yearly Subscriber" value={a.yearly} />
        <Row label="Each Monthly Subscriber" value={a.monthly} sub="a month, up to a year" />
        <Row label="Each Signup In Your First Month" value="$1" />
        <Row label="WhatYouAte Pro For You" value="Free" sub="up to a year" />
      </Card>
      <p className="mt-3 text-[13px] leading-[1.6]" style={{ color: "#8FA3C0" }}>
        {`Estimates in ${cur === "CAD" ? "Canadian" : "US"} dollars, based on current prices. You earn 30% of each subscription for its first 12 months, after Apple's fee. Creators in Canada earn and are paid in Canadian dollars, and everyone else in US dollars.`}
      </p>
    </>
  );
}
