import Link from "next/link";
import Menu from "../Menu";
import CreatorMenu from "./CreatorMenu";
import Social from "../Social";
import { BODY } from "../site";
import Logo from "../Logo";

export const CREATOR_EMAIL = "contact@whatyouate.app";

/**
 * Header and footer shared by every creator page, matching the About page. Signed-in pages (dashboard,
 * kit, profile) leave out the public site: the logo goes to the dashboard, the menu only has Support
 * and Log Out, and the footer only the creator terms and privacy policy.
 */
export default function Shell({ children, narrow = false, wide = false, full = false, signedIn = false }: { children: React.ReactNode; narrow?: boolean; wide?: boolean; full?: boolean; signedIn?: boolean }) {
  return (
    <div className="min-h-screen overflow-x-clip">
      <header className="absolute inset-x-0 top-0 z-30 print:hidden">
        <div className="mx-auto flex max-w-[68rem] items-center justify-between px-6 py-6">
          <Link href={signedIn ? "/creators/dashboard" : "/"}>
            <Logo priority />
          </Link>
          {signedIn ? <CreatorMenu /> : <Menu />}
        </div>
      </header>

      {/* Signed-in pages open on the tab row rather than a page title, so they sit closer to the header. */}
      <main className={`px-6 print:px-0 print:pt-0 ${signedIn ? "pt-24 sm:pt-28" : "pt-28 sm:pt-36"}`}>
        <div className={`mx-auto ${narrow ? "max-w-[30rem]" : full ? "max-w-[83rem]" : wide ? "max-w-[54rem] print:max-w-none" : "max-w-[44rem]"}`}>{children}</div>
      </main>

      {/* The footer carries its own fade into the deep blue, so the white text stays readable even on
          short pages where the body wash hasn't darkened yet. */}
      <footer
        className="mt-10 px-6 pb-14 pt-32 print:hidden"
        style={{ background: "linear-gradient(180deg, rgba(91,143,210,0) 0%, rgba(91,143,210,0.9) 38%, #4C82C7 100%)" }}
      >
        <div className="mx-auto flex max-w-[64rem] flex-col items-center gap-5 text-center">
          {signedIn ? (
            <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[14px] text-white/85">
              <Link href="/creators/terms" className="transition hover:opacity-70">Creator Terms</Link>
              <Link href="/privacy" className="transition hover:opacity-70">Privacy Policy</Link>
            </nav>
          ) : (
            <>
              <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[14px] text-white/85">
                <Link href="/" className="transition hover:opacity-70">Home</Link>
                <Link href="/creators" className="transition hover:opacity-70">Creators</Link>
                <Link href="/privacy" className="transition hover:opacity-70">Privacy Policy</Link>
                <Link href="/terms" className="transition hover:opacity-70">Terms of Use</Link>
                <a href={`mailto:${CREATOR_EMAIL}`} className="transition hover:opacity-70">Contact</a>
              </nav>
              <Social className="text-white/85" />
            </>
          )}
          <span className="text-[13px] text-white/65">
            © {new Date().getFullYear()} WhatYouAte. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}

/** Frosted card used across the creator pages. */
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl bg-white/75 ring-1 ring-[#16233B]/[0.06] backdrop-blur-sm ${className}`}
      style={{ boxShadow: "0 18px 40px -26px rgba(16,42,86,0.28)" }}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#8FA3C0" }}>
      {children}
    </p>
  );
}

/** Dark pill button, same as the site's Download button. Renders a link or a submit button. */
export function PrimaryButton({
  children,
  href,
  type = "button",
  disabled = false,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-full px-7 py-[15px] text-[15px] font-semibold tracking-[-0.01em] text-white transition duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 disabled:pointer-events-none disabled:opacity-40 ${className}`;
  const style = { background: "#101B2E", boxShadow: "0 14px 32px -12px rgba(16,27,46,0.55)" };
  if (href) return <Link href={href} className={cls} style={style}>{children}</Link>;
  return <button type={type} disabled={disabled} onClick={onClick} className={cls} style={style}>{children}</button>;
}

export function SecondaryButton({ children, href, onClick, className = "" }: { children: React.ReactNode; href?: string; onClick?: () => void; className?: string }) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-[15px] text-[15px] font-semibold tracking-[-0.01em] text-[#101B2E] ring-1 ring-[#16233B]/[0.08] transition duration-200 hover:-translate-y-0.5 active:translate-y-0 ${className}`;
  const style = { boxShadow: "0 14px 32px -16px rgba(10,32,74,0.35)" };
  if (href) return <Link href={href} className={cls} style={style}>{children}</Link>;
  return <button type="button" onClick={onClick} className={cls} style={style}>{children}</button>;
}

/** Label plus input styled for the creator forms. 16px text stops iOS zooming in on focus. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[14px] font-semibold tracking-[-0.01em] text-[#101B2E]">{label}</span>
      <div className="mt-2">{children}</div>
      {error ? (
        <span data-field-error="" className="mt-1.5 block text-[13px] font-medium text-[#C2410C]">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[13px]" style={{ color: BODY }}>{hint}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-2xl bg-white px-4 py-3.5 text-[16px] text-[#101B2E] ring-1 ring-[#16233B]/[0.1] outline-none transition placeholder:text-[#9CADC6] focus:ring-2 focus:ring-[#6FA8FF]";

/** What a code gives followers, shown beside the code wherever it appears. */
export function TrialTag({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-[#EEF5FE] font-semibold text-[#2F6FC4] ring-1 ring-[#B9D4FA] ${
        small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]"
      }`}
    >
      1-Month Free Trial
    </span>
  );
}
