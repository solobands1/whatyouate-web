import Image from "next/image";

export const APP_STORE_URL = "https://apps.apple.com/app/id6762287393";

/* Light and airy by default. Colour is an accent, not a slab. */
export const SKY = "linear-gradient(180deg, #E4F0FE 0%, #EFF6FD 42%, #F7FAFD 100%)";
export const TINT = "linear-gradient(180deg, #F7FAFD 0%, #EAF3FD 50%, #F7FAFD 100%)";
export const DEEP = "linear-gradient(165deg, #74ACFF 0%, #3A72C4 52%, #24509A 100%)";

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
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  tilt?: number;
  lift?: "sm" | "md" | "lg";
  priority?: boolean;
}) {
  const shadow = {
    sm: "0 18px 40px -18px rgba(16,42,86,0.28)",
    md: "0 34px 70px -26px rgba(16,42,86,0.42)",
    lg: "0 54px 100px -34px rgba(16,42,86,0.55)",
  }[lift];
  return (
    <div
      className={`overflow-hidden rounded-[22px] bg-white ring-1 ring-[#16233B]/[0.06] ${className}`}
      style={{ boxShadow: shadow, transform: tilt ? `rotate(${tilt}deg)` : undefined }}
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
