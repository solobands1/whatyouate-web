"use client";

import { useState } from "react";
import { Card, Field, PrimaryButton, SecondaryButton, inputClass } from "./Shell";
import { BODY, INK } from "../site";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (sent) {
    return (
      <Card className="px-7 py-9 text-center">
        <h2 className="text-[24px] font-bold tracking-[-0.03em]" style={{ color: INK }}>Check Your Email</h2>
        <p className="mt-3 text-[16px] leading-[1.65]" style={{ color: BODY }}>
          We sent a sign-in link to <strong style={{ color: INK }}>{email}</strong>. Tap it on this device to open
          your dashboard. It may take a minute, and it&apos;s worth checking spam.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-6 text-[15px] font-semibold"
          style={{ color: "#2F6FC4" }}
        >
          Use a different email
        </button>
      </Card>
    );
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) setSent(true);
      }}
    >
      <Field label="Email" hint="The email you joined with. We'll send you a sign-in link, no password needed.">
        <input
          className={inputClass}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
        />
      </Field>
      <div className="flex flex-col gap-3 sm:flex-row">
        <PrimaryButton type="submit" disabled={!ok}>Send sign-in link</PrimaryButton>
        <SecondaryButton href="/creators/join">Join instead</SecondaryButton>
      </div>
    </form>
  );
}
