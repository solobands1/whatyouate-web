import type { Metadata } from "next";
import Link from "next/link";

// Rules for the daily logo prize in the website games (kit.tsx PrizeLogo / PrizeCard, supabase/games_prize.sql).
// Linked from the prize card. Plain-language rules; have them checked before the prize is switched on.
export const metadata: Metadata = {
  title: "Daily Logo Prize Rules | WhatYouAte",
  description: "How the daily WhatYouAte logo prize in the website games works.",
  robots: { index: false, follow: true },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", marginBottom: 8 }}>{title}</h2>
      <div style={{ fontSize: 14, color: "#4B5563", lineHeight: 1.75, display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </section>
  );
}

export default function PrizeRulesPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
      <div style={{ margin: "0 auto", maxWidth: 640, padding: "56px 32px 80px" }}>
        <Link href="/games" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#9CA3AF", textDecoration: "none", marginBottom: 32 }}>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8l4-4" /></svg>
          Games
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#0F172A", letterSpacing: "-0.02em", marginBottom: 8 }}>Daily Logo Prize Rules</h1>
        <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 40 }}>Run by WhatYouAte. Governing law: Province of Ontario, Canada.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <Section title="1. No purchase necessary">
            <p>The games on whatyouate.app/games are free. You never have to buy anything to play or to win.</p>
          </Section>
          <Section title="2. How it works">
            <p>Once a day, a gold WhatYouAte logo may float across the board while you play one of the games. You get one chance a day on each device. Tap the logo before it leaves the screen to catch it.</p>
            <p>To claim the prize you need to join the scoreboard with your name and a valid email address, then correctly answer a short math question. Prizes go to the first eligible players to claim them each day.</p>
          </Section>
          <Section title="3. Prizes">
            <p>Up to 3 prizes are given each day (days run midnight to midnight, Toronto time). Each prize is a one-time App Store code for 30 days of WhatYouAte Pro on iPhone, approximate retail value CA$17.99 (US$12.99).</p>
            <p>Codes are shown on screen when you claim them. They can only be redeemed through the Apple App Store and are subject to Apple&apos;s terms for offer codes. Prizes can&apos;t be exchanged for cash or transferred. If the subscription renews after the free period, it renews at the normal price unless you cancel it in your Apple account settings.</p>
          </Section>
          <Section title="4. Who can win">
            <p>One prize per person and per email address, ever. You must be 13 or older and able to redeem App Store codes. Residents of Quebec are not eligible. Void where prohibited.</p>
          </Section>
          <Section title="5. Odds">
            <p>Your chance of winning depends on whether the logo appears in your game, whether you catch it, and how many other players claim a prize that day before you.</p>
          </Section>
          <Section title="6. Fair play">
            <p>We may refuse or take back a prize that was won by cheating, by using more than one email, or by interfering with the games. We may change or end the prize at any time by updating this page.</p>
          </Section>
          <Section title="7. Privacy and contact">
            <p>We record which player won so we can apply these rules. See our <Link href="/privacy" style={{ color: "#3f7fd6" }}>privacy policy</Link>. Questions: support@whatyouate.app.</p>
          </Section>
        </div>
      </div>
    </div>
  );
}
