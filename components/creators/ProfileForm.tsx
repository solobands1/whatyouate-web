"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CREATOR_EMAIL, Field, PrimaryButton, SecondaryButton, inputClass } from "./Shell";
import { CodeInput, PayoutFields, useCodeCheck } from "./JoinForm";
import Gate from "./Gate";
import { changeCode, errorText, leaveProgram, updateProfile, type Dash } from "./api";
import { type Country, type PayoutMethod } from "./shared";
import { BODY, INK } from "../site";

const handle = (s: string) => s.replace(/^@+/, "").replace(/\s/g, "");

export default function ProfileForm() {
  return <Gate>{(d) => <ProfileView C={d.creator} />}</Gate>;
}

function ProfileView({ C }: { C: Dash["creator"] }) {
  const [savedCode, setSavedCode] = useState(C.code);
  const [name, setName] = useState(C.name);
  const [instagram, setInstagram] = useState(C.instagram);
  const [tiktok, setTiktok] = useState(C.tiktok);
  const [code, setCode] = useState(C.code);
  const [country, setCountry] = useState<Country>(C.country);
  const [method, setMethod] = useState<PayoutMethod>(C.payoutMethod);
  const [payoutEmail, setPayoutEmail] = useState(C.payoutEmail);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [left, setLeft] = useState(false);

  const check = useCodeCheck(code, savedCode);
  const codeOk = check.state === "ok" || check.state === "current";
  const codeChanged = code !== savedCode;
  const ready = codeOk && name.trim().length > 1 && (instagram || tiktok) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payoutEmail.trim());

  if (left) {
    return (
      <Card className="px-7 py-9 text-center">
        <h2 className="text-[24px] font-bold tracking-[-0.03em]" style={{ color: INK }}>You&apos;ve Left the Program</h2>
        <p className="mt-3 text-[16px] leading-[1.65]" style={{ color: BODY }}>
          Your code no longer works for new signups. You&apos;ll keep earning from the subscribers you already brought
          in until each one&apos;s 12 months are up, paid on the regular dates. Thanks for sharing WhatYouAte.
        </p>
        <PrimaryButton href="/creators" className="mt-7">Back to Creators</PrimaryButton>
      </Card>
    );
  }

  return (
    <>
      <form
        className="flex flex-col gap-6"
        onChange={() => setSaved(false)}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ready || busy) return;
          setBusy(true);
          setError(null);
          try {
            await updateProfile({ name: name.trim(), instagram, tiktok, country, payoutMethod: method, payoutEmail: payoutEmail.trim() });
            if (codeChanged) await changeCode(code);
            setSavedCode(code);
            setSaved(true);
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Field label="Email" hint={<>The email you log in with. To change it, email {CREATOR_EMAIL}.</>}>
          <input className={inputClass} type="email" value={C.email} readOnly />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Instagram">
            <input className={inputClass} value={instagram} onChange={(e) => setInstagram(handle(e.target.value))} autoCapitalize="none" />
          </Field>
          <Field label="TikTok">
            <input className={inputClass} value={tiktok} onChange={(e) => setTiktok(handle(e.target.value))} autoCapitalize="none" />
          </Field>
        </div>

        <div>
          <CodeInput value={code} onChange={setCode} current={savedCode} />
          {codeChanged && codeOk && (
            <p className="mt-2 rounded-xl px-4 py-3 text-[13.5px] leading-[1.55]" style={{ background: "#E6F0FE", color: "#1E4E8C" }}>
              Your old code, {savedCode}, will keep working, so anything you&apos;ve already posted still counts.
            </p>
          )}
        </div>

        <PayoutFields
          country={country}
          setCountry={setCountry}
          method={method}
          setMethod={setMethod}
          payoutEmail={payoutEmail}
          setPayoutEmail={setPayoutEmail}
        />

        {error && <p className="text-[14.5px] font-medium text-[#C2410C]">{error}</p>}

        <div className="flex items-center gap-5 pt-2">
          <PrimaryButton type="submit" disabled={!ready || busy}>{busy ? "Saving…" : "Save changes"}</PrimaryButton>
          {saved ? (
            <span className="text-[15px] font-semibold text-[#15803D]">Saved</span>
          ) : (
            <Link href="/creators/dashboard" className="text-[15px] font-semibold" style={{ color: BODY }}>
              Back to dashboard
            </Link>
          )}
        </div>
      </form>

      {/* Leaving */}
      <Card className="mt-14 px-6 py-6">
        <h2 className="text-[17px] font-bold tracking-[-0.02em]" style={{ color: INK }}>Leave the Program</h2>
        {!leaving ? (
          <>
            <p className="mt-2 text-[14.5px] leading-[1.6]" style={{ color: BODY }}>
              Your code stops working for new signups. You keep earning from the subscribers you&apos;ve already
              brought in until each one&apos;s 12 months are up, and even small amounts are paid.
            </p>
            <button
              type="button"
              onClick={() => setLeaving(true)}
              className="mt-4 text-[15px] font-semibold"
              style={{ color: "#C2410C" }}
            >
              Leave the program
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-[14.5px] leading-[1.6]" style={{ color: INK }}>
              Are you sure? This can&apos;t be undone, and your code can&apos;t be reused.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await leaveProgram();
                    setLeft(true);
                  } catch (err) {
                    setError(errorText(err));
                    setLeaving(false);
                  }
                }}
                className="rounded-full px-6 py-3.5 text-[15px] font-semibold text-white"
                style={{ background: "#C2410C" }}
              >
                Yes, leave the program
              </button>
              <SecondaryButton onClick={() => setLeaving(false)}>Stay</SecondaryButton>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
