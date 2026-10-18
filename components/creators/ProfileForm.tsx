"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Field, PrimaryButton, SecondaryButton, inputClass } from "./Shell";
import { CodeInput, PayoutFields } from "./JoinForm";
import { checkCode, type Country, type PayoutMethod } from "./sample";
import { loadCreator, saveCreator, clearCreator } from "./store";
import { BODY, INK } from "../site";

const handle = (s: string) => s.replace(/^@+/, "").replace(/\s/g, "");

export default function ProfileForm() {
  const [savedCode, setSavedCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [code, setCode] = useState("");
  const [country, setCountry] = useState<Country>("CA");
  const [method, setMethod] = useState<PayoutMethod>("etransfer");
  const [payoutEmail, setPayoutEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [left, setLeft] = useState(false);

  useEffect(() => {
    const c = loadCreator();
    setSavedCode(c.code);
    setName(c.name);
    setEmail(c.email);
    setInstagram(c.instagram);
    setTiktok(c.tiktok);
    setCode(c.code);
    setCountry(c.country);
    setMethod(c.payoutMethod);
    setPayoutEmail(c.payoutEmail);
  }, []);

  const codeOk = code.length > 0 && checkCode(code, savedCode).ok;
  const codeChanged = savedCode !== "" && code !== savedCode;

  if (left) {
    return (
      <Card className="px-7 py-9 text-center">
        <h2 className="text-[24px] font-bold tracking-[-0.03em]" style={{ color: INK }}>You&apos;ve Left the Program</h2>
        <p className="mt-3 text-[16px] leading-[1.65]" style={{ color: BODY }}>
          Your code no longer works for new signups. Everything you earned is paid out on the regular payout dates,
          once refunds have cleared. We&apos;ll email you when it&apos;s sent. Thanks for sharing WhatYouAte.
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
        onSubmit={(e) => {
          e.preventDefault();
          if (!codeOk) return;
          saveCreator({ name: name.trim(), email, instagram, tiktok, code, country, payoutMethod: method, payoutEmail });
          setSavedCode(code);
          setSaved(true);
        }}
      >
        <Field label="Name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Field label="Email" hint="Changing this sends a confirmation link to the new address.">
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
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

        <div className="flex items-center gap-5 pt-2">
          <PrimaryButton type="submit" disabled={!codeOk}>Save changes</PrimaryButton>
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
              Your code stops working for new signups and you stop earning from that day. Everything you&apos;ve earned
              is still paid out once refunds have cleared, even if it&apos;s under $10.
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
                onClick={() => {
                  clearCreator();
                  setLeft(true);
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
