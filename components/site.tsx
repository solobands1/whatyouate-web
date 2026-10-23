import Image from "next/image";

export const APP_STORE_URL = "https://apps.apple.com/app/id6762287393";

/* Light and airy by default. Colour is an accent, not a slab. */
/* Section colour now comes from one continuous wash on <body>, so nothing
   here paints its own background and no two sections meet at a hard edge. */

export const INK = "#101B2E";
export const BODY = "#5A6B85";
export const FAINT = "#8FA3C0";

export function DownloadButton({
  tone = "dark",
  className = "",
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <a
      href={APP_STORE_URL}
      className={`inline-flex items-center justify-center gap-2.5 rounded-full px-7 py-[15px] text-[15px] font-semibold tracking-[-0.01em] transition duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 ${className}`}
      style={{
        background: dark ? INK : "#FFFFFF",
        color: dark ? "#FFFFFF" : INK,
        boxShadow: dark
          ? "0 14px 32px -12px rgba(16,27,46,0.55)"
          : "0 14px 32px -12px rgba(10,32,74,0.45)",
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
      Download free
    </a>
  );
}

/**
 * Real app UI lifted out of a screenshot and floated on the page. A slight tilt
 * plus a soft, wide shadow reads as depth without resorting to a phone mockup.
 */
export function UiCard({
  src,
  alt,
  width,
  height,
  className = "",
  tilt = 0,
  lift = "md",
  priority = false,
  bare = false,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  tilt?: number;
  lift?: "sm" | "md" | "lg";
  priority?: boolean;
  /**
   * For PNGs that already carry their own rounded silhouette. The default
   * wrapper is a white rounded-[22px] box, and a card whose real corner is
   * nearer 70px pokes its wrapper out past its own border at every corner.
   * Bare drops the box and casts the shadow off the alpha instead.
   */
  bare?: boolean;
}) {
  const shadow = {
    sm: "0 18px 40px -18px rgba(16,42,86,0.28)",
    md: "0 34px 70px -26px rgba(16,42,86,0.42)",
    lg: "0 54px 100px -34px rgba(16,42,86,0.55)",
  }[lift];
  const drop = {
    sm: "drop-shadow(0 10px 18px rgba(16,42,86,0.16))",
    md: "drop-shadow(0 18px 30px rgba(16,42,86,0.20))",
    lg: "drop-shadow(0 26px 44px rgba(16,42,86,0.24))",
  }[lift];
  return (
    <div
      className={
        bare
          ? className
          : `overflow-hidden rounded-[22px] bg-white ring-1 ring-[#16233B]/[0.06] ${className}`
      }
      style={{
        boxShadow: bare ? undefined : shadow,
        filter: bare ? drop : undefined,
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
      }}
    >
      <Image src={src} alt={alt} width={width} height={height} priority={priority} className="block w-full" />
    </div>
  );
}

export function Eyebrow({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <p
      className="text-[12px] font-semibold uppercase tracking-[0.18em]"
      style={{ color: onDark ? "rgba(255,255,255,0.72)" : FAINT }}
    >
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  onDark = false,
  center = true,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  onDark?: boolean;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-[42rem] text-center" : "max-w-[36rem]"}>
      <Eyebrow onDark={onDark}>{eyebrow}</Eyebrow>
      <h2
        className="mt-5 text-[clamp(30px,4.2vw,46px)] font-bold leading-[1.1] tracking-[-0.035em] text-balance"
        style={{ color: onDark ? "#FFFFFF" : INK }}
      >
        {title}
      </h2>
      {body && (
        <p
          className={`mt-5 text-[17px] leading-[1.72] ${center ? "mx-auto" : ""} max-w-[48ch]`}
          style={{ color: onDark ? "rgba(255,255,255,0.84)" : BODY }}
        >
          {body}
        </p>
      )}
    </div>
  );
}

/* Apple Health mark, lifted verbatim from the app's onboarding so the heart's
   scale and offset on the tile match what is already shipped. */
export function AppleHealthMark({ size = 44 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label="Apple Health" className="shrink-0">
      <defs>
        <linearGradient id="wya-ah-heart" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#F41F3F" />
          <stop offset="1" stopColor="#FF5488" />
        </linearGradient>
      </defs>
      <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="11" fill="#fff" stroke="rgba(0,0,0,0.1)" strokeWidth="1.2" />
      <path
        fill="url(#wya-ah-heart)"
        transform="translate(16.7 5.65) scale(0.95)"
        d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z"
      />
    </svg>
  );
}
