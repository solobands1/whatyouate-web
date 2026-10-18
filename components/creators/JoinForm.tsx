"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, Field, PrimaryButton, SecondaryButton, inputClass } from "./Shell";
import { checkCode, normalizeCode, type Country, type PayoutMethod } from "./sample";
import { BODY, INK } from "../site";

export function CodeInput({ value, onChange, current }: { value: string; onChange: (v: string) => void; current?: string }) {
  const code = normalizeCode(value);
  const check = useMemo(() => (code ? checkCode(code, current) : null), [code, current]);
  return (
    <Field
      label="Your code"
      error={check && !check.ok ? check.reason : null}
      hint={
        check?.ok ? (
          <span className="font-medium text-[#15803D]">
            {code === current ? "This is your current code." : `${code} is available.`}
          </span>
        ) : (
          "3 to 15 letters or numbers. Your followers type this in the app."
        )
      }
    >
      <input
        className={`${inputClass} font-semibold uppercase tracking-[0.06em]`}
        value={code}
        onChange={(e) => onChange(normalizeCode(e.target.value).slice(0, 15))}
        placeholder="SARAH"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
      />
    </Field>
  );
}

export function PayoutFields({
  country,
  setCountry,
  method,
  setMethod,
  payoutEmail,
  setPayoutEmail,
}: {
  country: Country;
  setCountry: (c: Country) => void;
  method: PayoutMethod;
  setMethod: (m: PayoutMethod) => void;
  payoutEmail: string;
  setPayoutEmail: (s: string) => void;
}) {
  const canada = country === "CA";
  return (
    <>
      <Field label="Where do you live?">
        <select
          className={inputClass}
          value={country}
          onChange={(e) => {
            const c = e.target.value as Country;
            setCountry(c);
            setMethod(c === "CA" ? "etransfer" : "paypal");
          }}
        >
          <option value="CA">Canada</option>
          <option value="US">United States</option>
          <option value="OTHER">Somewhere else</option>
        </select>
      </Field>

      {canada ? (
        <p className="-mt-1 text-[14px] leading-[1.6]" style={{ color: BODY }}>
          You&apos;ll be paid in CAD by Interac e-Transfer.
        </p>
      ) : (
        <Field label="How should we pay you?" hint="Paid in USD.">
          <div className="grid grid-cols-2 gap-2.5">
            {(["paypal", "wise"] as PayoutMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className="rounded-2xl px-4 py-3.5 text-[15px] font-semibold transition"
                style={
                  method === m
                    ? { background: INK, color: "#fff" }
                    : { background: "#fff", color: INK, boxShadow: "inset 0 0 0 1px rgba(22,35,59,0.1)" }
                }
              >
                {m === "paypal" ? "PayPal" : "Wise"}
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field
        label={canada ? "e-Transfer email" : method === "paypal" ? "PayPal email" : "Wise email"}
        hint="Where your payouts are sent."
      >
        <input
          className={inputClass}
          type="email"
          value={payoutEmail}
          onChange={(e) => setPayoutEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </Field>
    </>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-[1.55]" style={{ color: INK }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-[3px] h-[18px] w-[18px] shrink-0 accent-[#101B2E]"
      />
      <span>{children}</span>
    </label>
  );
}

const handle = (s: string) => s.replace(/^@+/, "").replace(/\s/g, "");

export default function JoinForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [country, setCountry] = useState<Country>("CA");
  const [method, setMethod] = useState<PayoutMethod>("etransfer");
  const [payoutEmail, setPayoutEmail] = useState("");
  const [code, setCode] = useState("");
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [done, setDone] = useState(false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const payoutOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payoutEmail || email);
  const codeOk = code.length > 0 && checkCode(code).ok;
  const ready = name.trim().length > 1 && emailOk && (instagram || tiktok) && payoutOk && codeOk && adult && terms;

  if (done) {
    return (
      <Card className="px-7 py-9 text-center">
        <p className="text-[15px] font-semibold" style={{ color: "#2F6FC4" }}>You&apos;re in</p>
        <h2 className="mt-3 text-[28px] font-bold tracking-[-0.03em]" style={{ color: INK }}>Your code is {code}</h2>
        <p className="mt-3 text-[16px] leading-[1.65]" style={{ color: BODY }}>
          We sent a sign-in link to <strong style={{ color: INK }}>{email}</strong>. Your dashboard has your share link,
          your numbers, and everything you need to post.
        </p>
        <PrimaryButton href="/creators/dashboard" className="mt-7">Go to your dashboard</PrimaryButton>
      </Card>
    );
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) setDone(true);
      }}
    >
      <Field label="Name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
      </Field>
      <Field label="Email" hint="Used to sign in. No password needed.">
        <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Instagram">
          <input className={inputClass} value={instagram} onChange={(e) => setInstagram(handle(e.target.value))} placeholder="@yourhandle" autoCapitalize="none" autoComplete="off" />
        </Field>
        <Field label="TikTok">
          <input className={inputClass} value={tiktok} onChange={(e) => setTiktok(handle(e.target.value))} placeholder="@yourhandle" autoCapitalize="none" autoComplete="off" />
        </Field>
      </div>
      <p className="-mt-3 text-[13px]" style={{ color: BODY }}>Add at least one.</p>

      <CodeInput value={code} onChange={setCode} />

      <PayoutFields
        country={country}
        setCountry={setCountry}
        method={method}
        setMethod={setMethod}
        payoutEmail={payoutEmail}
        setPayoutEmail={setPayoutEmail}
      />

      <div className="flex flex-col gap-3.5 pt-1">
        <Check checked={adult} onChange={setAdult}>I&apos;m 18 or older.</Check>
        <Check checked={terms} onChange={setTerms}>
          I agree to the{" "}
          <Link href="/creators/terms" className="font-semibold underline underline-offset-2" target="_blank">
            program terms
          </Link>
          , including labelling sponsored posts and making no health claims.
        </Check>
      </div>

      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <PrimaryButton type="submit" disabled={!ready}>Create my code</PrimaryButton>
        <SecondaryButton href="/creators/login">I already have an account</SecondaryButton>
      </div>
    </form>
  );
}
