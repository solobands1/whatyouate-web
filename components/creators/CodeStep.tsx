"use client";

import { useState } from "react";
import { Card, Field, PrimaryButton, inputClass } from "./Shell";
import { errorText, sendSignInCode, verifySignInCode } from "./api";
import { BODY, INK } from "../site";

// Supabase is set to 8-digit codes for this project (Auth > Email > OTP length).
const CODE_LENGTH = 8;

/** "Enter the code we emailed you", shared by Log In and Join. */
export default function CodeStep({
  email,
  create,
  onVerified,
  onBack,
}: {
  email: string;
  create: boolean;
  onVerified: () => Promise<void> | void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const ok = code.length === CODE_LENGTH;

  return (
    <Card className="px-7 py-8">
      <h2 className="text-[24px] font-bold tracking-[-0.03em]" style={{ color: INK }}>Check Your Email</h2>
      <p className="mt-3 text-[16px] leading-[1.65]" style={{ color: BODY }}>
        We sent an {CODE_LENGTH}-digit code to <strong style={{ color: INK }}>{email}</strong>. It may take a minute, and it&apos;s worth
        checking spam.
      </p>
      <form
        className="mt-6 flex flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ok || busy) return;
          setBusy(true);
          setError(null);
          try {
            await verifySignInCode(email, code);
            await onVerified();
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Code" error={error}>
          <input
            className={`${inputClass} text-center text-[22px] font-semibold tracking-[0.22em]`}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="12345678"
            autoFocus
          />
        </Field>
        <PrimaryButton type="submit" disabled={!ok || busy}>{busy ? "Checking…" : "Continue"}</PrimaryButton>
      </form>
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        <button
          type="button"
          onClick={async () => {
            setError(null);
            try {
              await sendSignInCode(email, create);
              setResent(true);
            } catch (err) {
              setError(errorText(err));
            }
          }}
          className="text-[15px] font-semibold"
          style={{ color: "#2F6FC4" }}
        >
          {resent ? "New Code Sent" : "Send A New Code"}
        </button>
        <button type="button" onClick={onBack} className="text-[15px] font-semibold" style={{ color: BODY }}>
          Use A Different Email
        </button>
      </div>
    </Card>
  );
}
