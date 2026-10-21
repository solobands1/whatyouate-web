"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Field, PrimaryButton, SecondaryButton, inputClass } from "./Shell";
import CodeStep from "./CodeStep";
import { checkCode, normalizeCode, type Country, type PayoutMethod } from "./shared";
import { checkCodeRemote, codeProblemText, errorText, joinProgram, sendSignInCode, signedInEmail } from "./api";
import { BODY, INK } from "../site";

/** Whether a code can be used: instant local rules, then the database after a short pause. */
export function useCodeCheck(code: string, current?: string) {
  const local = useMemo(() => (code ? checkCode(code, current) : null), [code, current]);
  const [remote, setRemote] = useState<{ code: string; problem: string | null } | null>(null);
  useEffect(() => {
    if (!local?.ok || code === current) return;
    let live = true;
    const t = setTimeout(() => {
      checkCodeRemote(code)
        .then((problem) => live && setRemote({ code, problem }))
        .catch(() => live && setRemote({ code, problem: null }));
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [code, current, local?.ok]);

  if (!code || !local) return { state: "empty" as const };
  if (!local.ok) return { state: "bad" as const, message: local.reason };
  if (code === current) return { state: "current" as const };
  if (!remote || remote.code !== code) return { state: "checking" as const };
  return remote.problem
    ? { state: "bad" as const, message: codeProblemText(remote.problem) ?? "" }
    : { state: "ok" as const };
}

export function CodeInput({ value, onChange, current }: { value: string; onChange: (v: string) => void; current?: string }) {
  const code = normalizeCode(value);
  const check = useCodeCheck(code, current);
  return (
    <Field
      label="Your Code"
      error={check.state === "bad" ? check.message : null}
      hint={
        check.state === "ok" ? (
          <span className="font-medium text-[#15803D]">{code} is available.</span>
        ) : check.state === "current" ? (
          <span className="font-medium text-[#15803D]">This is your current code.</span>
        ) : check.state === "checking" ? (
          "Checking…"
        ) : (
          "3 to 15 letters or numbers. Your followers type this in the app."
        )
      }
    >
      <input
        className={`${inputClass} font-semibold uppercase tracking-[0.06em]`}
        value={code}
        onChange={(e) => onChange(normalizeCode(e.target.value).slice(0, 15))}
        placeholder="YOURCODE"
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
      <Field label="Where Do You Live?">
        <select
          className={inputClass}
          value={country}
          onChange={(e) => {
            const c = e.target.value as Country;
            setCountry(c);
            setMethod(c === "CA" ? "etransfer" : "wise");
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
        <Field label="How Should We Pay You?" hint="Paid in USD.">
          <div className="grid grid-cols-2 gap-2.5">
            {(["wise", "paypal"] as PayoutMethod[]).map((m) => (
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
                {m === "paypal" ? "PayPal" : "Bank Deposit"}
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field
        label={canada ? "e-Transfer Email" : method === "paypal" ? "PayPal Email" : "Email for Your Bank Deposit"}
        hint={
          canada
            ? "Where your e-Transfers are sent."
            : method === "paypal"
              ? "Payments go to the PayPal account with this email."
              : "Payments are sent through Wise. They email you a secure link to add your bank details, no Wise account needed."
        }
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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function JoinForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [signedIn, setSignedIn] = useState<string | null>(null);
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [country, setCountry] = useState<Country>("CA");
  const [method, setMethod] = useState<PayoutMethod>("etransfer");
  const [payoutEmail, setPayoutEmail] = useState("");
  const [code, setCode] = useState("");
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [step, setStep] = useState<"form" | "verify" | "done">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Someone already signed in (say, they logged in before joining) joins with that email.
  useEffect(() => {
    signedInEmail().then((e) => {
      if (e) {
        setSignedIn(e);
        setEmail(e);
      }
    });
  }, []);

  const check = useCodeCheck(code);
  const payout = (payoutEmail || email).trim();
  const ready =
    name.trim().length > 1 && EMAIL.test(email.trim()) && (instagram || tiktok) && EMAIL.test(payout) &&
    check.state === "ok" && adult && terms;

  const join = async () => {
    await joinProgram({ name: name.trim(), instagram, tiktok, code, country, payoutMethod: method, payoutEmail: payout });
    setStep("done");
  };

  if (step === "verify") {
    return (
      <CodeStep
        email={email.trim().toLowerCase()}
        create
        onVerified={async () => {
          try {
            await join();
          } catch (err) {
            // Most likely the code was taken while they were checking their email.
            setSignedIn(email.trim().toLowerCase());
            setError(errorText(err));
            setStep("form");
          }
        }}
        onBack={() => setStep("form")}
      />
    );
  }

  if (step === "done") {
    return (
      <Card className="px-7 py-9 text-center">
        <p className="text-[15px] font-semibold" style={{ color: "#2F6FC4" }}>You&apos;re In</p>
        <h2 className="mt-3 text-[28px] font-bold tracking-[-0.03em]" style={{ color: INK }}>Your Code Is {code}</h2>
        <p className="mt-3 text-[16px] leading-[1.65]" style={{ color: BODY }}>
          Your dashboard has your share link, your free Pro code, your numbers, and everything you need to post.
        </p>
        <PrimaryButton onClick={() => router.push("/creators/dashboard")} className="mt-7">Go To Your Dashboard</PrimaryButton>
      </Card>
    );
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready || busy) return;
        setBusy(true);
        setError(null);
        try {
          if (signedIn) {
            await join();
          } else {
            await sendSignInCode(email, true);
            setStep("verify");
          }
        } catch (err) {
          setError(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
      </Field>
      <Field
        label="Email"
        hint={signedIn ? "You're signed in with this email." : "Used to sign in. We'll email you a code to confirm it, no password needed."}
      >
        <input
          className={inputClass}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          readOnly={!!signedIn}
        />
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

      {error && <p className="text-[14.5px] font-medium text-[#C2410C]">{error}</p>}

      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <PrimaryButton type="submit" disabled={!ready || busy}>{busy ? "Just A Moment…" : "Create My Code"}</PrimaryButton>
        <SecondaryButton href="/creators/login">I Already Have An Account</SecondaryButton>
      </div>
    </form>
  );
}
