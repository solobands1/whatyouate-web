import type { Metadata } from "next";
import Shell, { Eyebrow, CREATOR_EMAIL } from "../../../components/creators/Shell";
import { BODY, INK } from "../../../components/site";

export const metadata: Metadata = {
  title: "Program terms | WhatYouAte Creators",
  description: "The terms of the WhatYouAte creator program.",
};

function S({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-[18px] font-bold tracking-[-0.02em]" style={{ color: INK }}>
        {n}. {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-[15.5px] leading-[1.7]" style={{ color: BODY }}>
        {children}
      </div>
    </section>
  );
}

export default function CreatorTerms() {
  return (
    <Shell>
      <Eyebrow>Creators</Eyebrow>
      <h1 className="mt-5 text-[clamp(30px,4.6vw,44px)] font-bold leading-[1.08] tracking-[-0.04em]">Program terms</h1>
      <p className="mt-4 text-[14px]" style={{ color: "#8FA3C0" }}>Last updated: October 18, 2026</p>
      <p className="mt-6 text-[16px] leading-[1.7]" style={{ color: BODY }}>
        The WhatYouAte creator program is run by Integrity Stack Inc., the company behind WhatYouAte (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;). By joining, you agree to these terms.
      </p>

      <S n={1} title="Who can join">
        <p>You must be 18 or older and able to receive payments by Interac e-Transfer (in Canada), PayPal or Wise. There is no follower minimum. We may decline or remove anyone who doesn&apos;t follow these terms.</p>
      </S>

      <S n={2} title="Your code and link">
        <p>You choose a code of 3 to 15 letters or numbers. Codes are first come, first served, and we may refuse codes that are reserved, misleading or offensive. You can change your code at any time. Your previous codes keep working and stay linked to you.</p>
        <p>Your followers get their first month of WhatYouAte free when they enter your code in the app or open your link before signing up.</p>
      </S>

      <S n={3} title="What you earn">
        <p><strong style={{ color: INK }}>Subscriptions.</strong> You earn 30% of what we receive for each subscriber you refer, for the first 12 months after their first payment. &ldquo;What we receive&rdquo; means the amount Apple pays us after its fee, before tax. If a payment is refunded, the matching earnings are removed.</p>
        <p><strong style={{ color: INK }}>First-month signup bonus.</strong> During the first 30 days after you join, you also earn $1 for each qualifying signup. A signup qualifies when a new account uses your code and logs meals on at least 3 separate days within its first 7 days. The signup bonus is capped at $100 per creator.</p>
        <p>A signup is credited to the first code it uses. People who already had a WhatYouAte account don&apos;t count.</p>
      </S>

      <S n={4} title="Getting paid">
        <p>Earnings for each month are paid at the start of the month after next, so refunds have time to clear. For example, October&apos;s earnings are paid on December 1. Balances under $10 roll over to the next month.</p>
        <p>Amounts are tracked in US dollars. Creators in Canada are paid in Canadian dollars by Interac e-Transfer, converted on the day of payment. Everyone else is paid in US dollars by PayPal or Wise. You&apos;re responsible for any taxes on what you earn, and for any fees your payment provider charges you.</p>
      </S>

      <S n={5} title="How you post">
        <p>Every post, video or story that mentions WhatYouAte must clearly say it&apos;s sponsored, for example with #ad or the platform&apos;s paid partnership label.</p>
        <p>WhatYouAte is a wellness and food journal, not a medical product. Never say or suggest that it diagnoses, treats, cures or prevents any condition, or give medical advice. Share your own experience, honestly.</p>
      </S>

      <S n={6} title="What isn't allowed">
        <p>Using your own code, creating accounts, paying for signups, misleading people to get signups, spam, or running ads that bid on the WhatYouAte name. Signups we find to be fake or self-made aren&apos;t paid, and we may withhold earnings or end your participation.</p>
      </S>

      <S n={7} title="Your content">
        <p>You keep ownership of what you create. You allow us to share and reuse your posts about WhatYouAte, including in ads, with credit to you, for as long as the program runs and 12 months after.</p>
      </S>

      <S n={8} title="Privacy">
        <p>Your dashboard shows totals only. We never share the identity of anyone who used your code. We use your details to run the program and pay you, as described in our privacy policy.</p>
      </S>

      <S n={9} title="Changes and leaving">
        <p>We may change these terms or end the program with 30 days&apos; notice by email. You can leave at any time. Earnings you&apos;ve already earned under these terms will still be paid.</p>
        <p>You take part as an independent creator, not as an employee or agent of Integrity Stack Inc. These terms are governed by the laws of Ontario, Canada.</p>
      </S>

      <p className="mt-12 text-[15px]" style={{ color: INK }}>
        Questions? <a href={`mailto:${CREATOR_EMAIL}`} className="font-semibold underline underline-offset-2" style={{ color: INK }}>{CREATOR_EMAIL}</a>
      </p>
    </Shell>
  );
}
