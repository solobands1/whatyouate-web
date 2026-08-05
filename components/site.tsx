import Image from "next/image";

export const APP_STORE_URL = "https://apps.apple.com/app/id6762287393";

/* The same blue the app and the App Store panels use, as a gradient pair. */
export const DEEP = "linear-gradient(160deg, #6FA8FF 0%, #2E62B4 55%, #234E96 100%)";
export const LIGHT = "linear-gradient(170deg, #EEF6FE 0%, #D5E8FA 100%)";

export function DownloadButton({
  tone = "light",
  className = "",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const onDark = tone === "light";
  return (
    <a
      href={APP_STORE_URL}
      className={`inline-flex items-center justify-center gap-2.5 rounded-full px-7 py-3.5 text-[15px] font-semibold tracking-[-0.01em] transition hover:-translate-y-px hover:shadow-lg active:translate-y-0 ${className}`}
      style={{
        background: onDark ? "#FFFFFF" : "#1B3E77",
        color: onDark ? "#173B72" : "#FFFFFF",
        boxShadow: onDark
          ? "0 10px 30px rgba(12,36,80,0.22)"
          : "0 10px 30px rgba(27,62,119,0.25)",
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
      Download free
    </a>
  );
}

/* A real screenshot inside a titanium iPhone shell, matching the App Store art. */
export function Phone({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative ${className}`}>
      <div
        className="rounded-[13%] p-[1.6%]"
        style={{
          background: "linear-gradient(150deg,#4a4d52 0%,#1c1c1e 32%,#3a3d42 60%,#1c1c1e 84%,#2c2c2e 100%)",
          boxShadow:
            "inset 0 0 0 0.5px rgba(255,255,255,0.16), 0 0 0 0.75px rgba(0,0,0,0.85), 0 40px 80px -20px rgba(9,26,56,0.45)",
        }}
      >
        <div className="overflow-hidden rounded-[11.5%] bg-black">
          <Image src={src} alt={alt} width={760} height={1651} priority={priority} className="block w-full" />
        </div>
      </div>
    </div>
  );
}

/* A single piece of app UI lifted out of a screenshot and floated on the page. */
export function UiCard({
  src,
  alt,
  width,
  height,
  className = "",
  lift = "md",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  lift?: "sm" | "md" | "lg";
}) {
  const shadow = {
    sm: "0 10px 26px -8px rgba(12,36,80,0.22)",
    md: "0 22px 50px -14px rgba(12,36,80,0.30)",
    lg: "0 34px 70px -18px rgba(12,36,80,0.38)",
  }[lift];
  return (
    <div
      className={`overflow-hidden rounded-[18px] bg-white ring-1 ring-black/[0.04] ${className}`}
      style={{ boxShadow: shadow }}
    >
      <Image src={src} alt={alt} width={width} height={height} className="block w-full" />
    </div>
  );
}

export function Eyebrow({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <p
      className="text-[12px] font-semibold uppercase tracking-[0.14em]"
      style={{ color: onDark ? "rgba(255,255,255,0.72)" : "#7C93B4" }}
    >
      {children}
    </p>
  );
}
