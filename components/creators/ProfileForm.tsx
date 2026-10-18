"use client";

import Link from "next/link";
import { useState } from "react";
import { Field, PrimaryButton, inputClass } from "./Shell";
import { CodeInput, PayoutFields } from "./JoinForm";
import { SAMPLE_CREATOR as C, checkCode, type Country, type PayoutMethod } from "./sample";
import { BODY } from "../site";

const handle = (s: string) => s.replace(/^@+/, "").replace(/\s/g, "");

export default function ProfileForm() {
  const [name, setName] = useState(C.name);
  const [email, setEmail] = useState(C.email);
  const [instagram, setInstagram] = useState(C.instagram);
  const [tiktok, setTiktok] = useState(C.tiktok);
  const [code, setCode] = useState(C.code);
  const [country, setCountry] = useState<Country>(C.country);
  const [method, setMethod] = useState<PayoutMethod>(C.payoutMethod);
  const [payoutEmail, setPayoutEmail] = useState(C.payoutEmail);
  const [saved, setSaved] = useState(false);

  const codeOk = checkCode(code, C.code).ok;
  const codeChanged = code !== C.code;

  return (
    <form
      className="flex flex-col gap-6"
      onChange={() => setSaved(false)}
      onSubmit={(e) => {
        e.preventDefault();
        if (codeOk) setSaved(true);
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
        <CodeInput value={code} onChange={setCode} current={C.code} />
        {codeChanged && codeOk && (
          <p className="mt-2 rounded-xl px-4 py-3 text-[13.5px] leading-[1.55]" style={{ background: "#E6F0FE", color: "#1E4E8C" }}>
            Your old code, {C.code}, will keep working, so anything you&apos;ve already posted still counts.
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
  );
}
