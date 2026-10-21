"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, PrimaryButton, SecondaryButton, inputClass } from "./Shell";
import CodeStep from "./CodeStep";
import { errorText, sendSignInCode } from "./api";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  if (sent) {
    return (
      <CodeStep
        email={email.trim().toLowerCase()}
        create={false}
        onVerified={() => router.push("/creators/dashboard")}
        onBack={() => setSent(false)}
      />
    );
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok || busy) return;
        setBusy(true);
        setError(null);
        try {
          await sendSignInCode(email, false);
          setSent(true);
        } catch (err) {
          setError(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Email" hint="The email you joined with. We'll email you a code, no password needed." error={error}>
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
        <PrimaryButton type="submit" disabled={!ok || busy}>{busy ? "Sending…" : "Email Me A Code"}</PrimaryButton>
        <SecondaryButton href="/creators/join">Join Instead</SecondaryButton>
      </div>
    </form>
  );
}
