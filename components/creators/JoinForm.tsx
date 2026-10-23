"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Field, PrimaryButton, SecondaryButton, inputClass } from "./Shell";
import CodeStep from "./CodeStep";
import { checkCode, normalizeCode, type Country, type PayoutMethod } from "./shared";
import { checkCodeRemote, codeProblemText, errorText, joinProgram, requestWelcomeEmail, sendSignInCode, signedInEmail, signOut } from "./api";
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
      label="Your Creator Code"
      error={check.state === "bad" ? check.message : null}
      hint={
        check.state === "ok" ? (
          <span className="font-medium text-[#15803D]">{code} is available.</span>
        ) : check.state === "current" ? (
          <span className="font-medium text-[#15803D]">This is your current code.</span>
        ) : check.state === "checking" ? (
          "Checking…"
        ) : (
          "3 to 15 letters or numbers. New users type this in the app when they sign up."
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
  emailFields,
  error,
}: {
  country: Country;
  setCountry: (c: Country) => void;
  method: PayoutMethod;
  setMethod: (m: PayoutMethod) => void;
  payoutEmail: string;
  setPayoutEmail: (s: string) => void;
  /** Replaces the single payout email field (the join form asks whether to use the login email). */
  emailFields?: React.ReactNode;
  error?: string | null;
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

      <p className="-mt-1 text-[14px] leading-[1.6]" style={{ color: BODY }}>
        {canada
          ? "You'll be paid in CAD by Interac e-Transfer."
          : "You'll be paid in USD by bank deposit, sent through Wise. You don't need a Wise account."}
      </p>

      {emailFields ?? (
        <Field
          label={canada ? "e-Transfer Email" : "Email For Your Bank Deposit"}
          error={error}
          hint={canada ? "Where your e-Transfers are sent." : "Wise emails you a secure link to add your bank details."}
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
      )}
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

/** The email already has a creator account. Whoever got this far has signed in with it, so it's theirs. */
const alreadyJoined = (e: unknown) => String((e as { message?: string })?.message ?? e).includes("already_joined");

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
  const [sameEmail, setSameEmail] = useState(true);
  const [confirmPayout, setConfirmPayout] = useState("");
  const [showErrors, setShowErrors] = useState(false);
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
  const payout = (sameEmail ? email : payoutEmail).trim();

  // Everything a creator must get right, with the message shown under each field. Payouts depend on
  // the name and the payout email, so both are deliberate: a full name, and a payout email that's
  // either the verified login email or typed twice.
  const problems = {
    name: /\S+\s+\S+/.test(name.trim()) ? null : "Enter your first and last name.",
    email: EMAIL.test(email.trim()) ? null : "Enter a valid email address.",
    code:
      check.state === "ok" ? null : check.state === "bad" ? check.message : check.state === "checking" ? "Checking your code…" : "Choose your creator code.",
    payout: sameEmail || EMAIL.test(payoutEmail.trim()) ? null : "Enter the email for your payouts.",
    confirm:
      sameEmail || payoutEmail.trim().toLowerCase() === confirmPayout.trim().toLowerCase() ? null : "The payout emails don't match.",
    adult: adult ? null : "Please confirm you're 18 or older.",
    terms: terms ? null : "Please agree to the program terms.",
  };
  const ready = Object.values(problems).every((p) => !p);
  const err = (k: keyof typeof problems) => (showErrors ? problems[k] : null);

  const join = async () => {
    await joinProgram({ name: name.trim(), instagram, tiktok, code, country, payoutMethod: method, payoutEmail: payout });
    void requestWelcomeEmail();
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
            if (alreadyJoined(err)) {
              router.push("/creators/dashboard");
              return;
            }
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
        <h2 className="mt-3 text-[28px] font-bold tracking-[-0.03em]" style={{ color: INK }}>Your Creator Code Is {code}</h2>
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
        if (busy) return;
        if (!ready) {
          setShowErrors(true);
          // Scroll to the first problem once the messages have rendered.
          setTimeout(() => document.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
          return;
        }
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
          if (alreadyJoined(err)) {
            router.push("/creators/dashboard");
            return;
          }
          setError(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Full Name" error={err("name")} hint="Use the name on your bank account, so payouts go through.">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="First and last name" autoComplete="name" />
      </Field>
      <Field
        label="Email"
        error={err("email")}
        hint={
          signedIn ? (
            <>
              You&apos;re signed in with this email.{" "}
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  await signOut().catch(() => {});
                  setSignedIn(null);
                  setEmail("");
                  setError(null);
                }}
                className="font-semibold underline-offset-2 hover:underline"
                style={{ color: "#2F6FC4" }}
              >
                Use a different email
              </button>
            </>
          ) : (
            "Used to sign in. We'll email you a code to confirm it, no password needed."
          )
        }
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
      <p className="-mt-3 text-[13px]" style={{ color: BODY }}>
        Optional. Add them if you&apos;ll share your code online. Sharing in person or with clients works too.
      </p>

      <div>
        <CodeInput value={code} onChange={setCode} />
        {showErrors && check.state !== "ok" && check.state !== "bad" && (
          <p data-field-error="" className="mt-1.5 text-[13px] font-medium text-[#C2410C]">{problems.code}</p>
        )}
      </div>

      <PayoutFields
        country={country}
        setCountry={setCountry}
        method={method}
        setMethod={setMethod}
        payoutEmail={payoutEmail}
        setPayoutEmail={setPayoutEmail}
        emailFields={
          <div className="flex flex-col gap-4">
            <Check checked={sameEmail} onChange={setSameEmail}>
              Send my payouts to the email above{email.trim() ? ` (${email.trim()})` : ""}.
            </Check>
            {!sameEmail && (
              <>
                <Field
                  label={country === "CA" ? "e-Transfer Email" : "Email For Your Bank Deposit"}
                  error={err("payout")}
                  hint={country === "CA" ? "Where your e-Transfers are sent." : "Wise emails you a secure link to add your bank details."}
                >
                  <input className={inputClass} type="email" value={payoutEmail} onChange={(e) => setPayoutEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
                </Field>
                <Field label="Confirm Payout Email" error={err("confirm")}>
                  <input className={inputClass} type="email" value={confirmPayout} onChange={(e) => setConfirmPayout(e.target.value)} placeholder="Type it again" autoComplete="off" onPaste={(e) => e.preventDefault()} />
                </Field>
              </>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-3.5 pt-1">
        <Check checked={adult} onChange={setAdult}>I&apos;m 18 or older.</Check>
        <Check checked={terms} onChange={setTerms}>
          I agree to the{" "}
          <Link href="/creators/terms" className="font-semibold underline underline-offset-2" target="_blank">
            program terms
          </Link>
          , including making it clear you earn from your code and making no health claims.
        </Check>
        {(err("adult") || err("terms")) && (
          <p data-field-error="" className="text-[13px] font-medium text-[#C2410C]">{err("adult") ?? err("terms")}</p>
        )}
      </div>

      {showErrors && !ready && (
        <p className="text-[14px] font-medium text-[#C2410C]">Please fix the highlighted fields above.</p>
      )}

      {error && <p className="text-[14.5px] font-medium text-[#C2410C]">{error}</p>}

      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <PrimaryButton type="submit" disabled={busy}>{busy ? "Just A Moment…" : "Create My Code"}</PrimaryButton>
        <SecondaryButton href="/creators/login">I Already Have An Account</SecondaryButton>
      </div>
    </form>
  );
}
