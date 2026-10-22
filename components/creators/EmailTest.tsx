"use client";

import { useEffect, useState } from "react";
import { Card, PrimaryButton, SecondaryButton } from "./Shell";
import { sb } from "./api";
import { BODY, INK } from "../site";

// Owner-only page: sends every creator email to the signed-in account, to check them in a real inbox.
// The app server decides who's allowed (OWNER_EMAILS), so this page is safe for anyone to open.
export default function EmailTest() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    sb().auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
  }, []);

  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { data } = await sb().auth.getSession();
      const res = await fetch("https://whatyouate.vercel.app/api/creators/test-emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      });
      const body = await res.json().catch(() => ({}));
      if (body.ok) setMessage(`Sent ${body.sent} test emails to ${body.to}. They can take a minute to arrive.`);
      else setMessage(body.errors?.[0] ?? body.error ?? "Couldn't send them.");
    } catch {
      setMessage("Couldn't reach the server. Try again in a moment.");
    }
    setBusy(false);
  };

  return (
    <Card className="px-7 py-8">
      <h1 className="text-[24px] font-bold tracking-[-0.03em]" style={{ color: INK }}>Test Emails</h1>
      {email === undefined ? (
        <p className="mt-3 text-[15px]" style={{ color: BODY }}>Loading…</p>
      ) : email === null ? (
        <>
          <p className="mt-3 text-[15.5px] leading-[1.6]" style={{ color: BODY }}>
            Log in first, then come back to this page.
          </p>
          <SecondaryButton href="/creators/login" className="mt-6">Log In</SecondaryButton>
        </>
      ) : (
        <>
          <p className="mt-3 text-[15.5px] leading-[1.6]" style={{ color: BODY }}>
            Sends the welcome, 3 months of Pro, free year and payout emails to{" "}
            <span className="font-semibold" style={{ color: INK }}>{email}</span>, marked [Test]. The codes and amounts in
            them are samples.
          </p>
          <PrimaryButton onClick={send} disabled={busy} className="mt-6">
            {busy ? "Sending…" : "Send Test Emails"}
          </PrimaryButton>
          {message && <p className="mt-4 text-[14.5px] leading-[1.6]" style={{ color: INK }}>{message}</p>}
        </>
      )}
    </Card>
  );
}
