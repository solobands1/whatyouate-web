import Image from "next/image";
import Link from "next/link";
import Menu from "../Menu";
import Social from "../Social";
import { BODY } from "../site";

export const CREATOR_EMAIL = "contact@whatyouate.app";

/** Header and footer shared by every creator page, matching the About page. */
export default function Shell({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="min-h-screen overflow-x-clip">
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-[68rem] items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/icon-512.png" alt="" width={30} height={30} className="rounded-[8px] ring-1 ring-black/5" priority />
            <span className="text-[16px] font-semibold tracking-[-0.015em]">WhatYouAte</span>
          </Link>
          <Menu />
        </div>
      </header>

      <main className="px-6 pt-28 sm:pt-36">
        <div className={`mx-auto ${narrow ? "max-w-[30rem]" : "max-w-[44rem]"}`}>{children}</div>
      </main>

      <footer className="px-6 pb-14 pt-24">
        <div className="mx-auto flex max-w-[64rem] flex-col items-center gap-5 text-center">
          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[14px]" style={{ color: BODY }}>
            <Link href="/" className="transition hover:opacity-70">Home</Link>
            <Link href="/creators" className="transition hover:opacity-70">Creators</Link>
            <Link href="/privacy" className="transition hover:opacity-70">Privacy Policy</Link>
            <Link href="/terms" className="transition hover:opacity-70">Terms of Use</Link>
            <a href={`mailto:${CREATOR_EMAIL}`} className="transition hover:opacity-70">Contact</a>
          </nav>
          <div style={{ color: BODY }}>
            <Social />
          </div>
          <span className="text-[13px]" style={{ color: "#9CADC6" }}>
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
        <span className="mt-1.5 block text-[13px] font-medium text-[#C2410C]">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[13px]" style={{ color: BODY }}>{hint}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-2xl bg-white px-4 py-3.5 text-[16px] text-[#101B2E] ring-1 ring-[#16233B]/[0.1] outline-none transition placeholder:text-[#9CADC6] focus:ring-2 focus:ring-[#6FA8FF]";
