import Image from "next/image";
import Link from "next/link";
import Reveal from "../components/Reveal";

const APP_STORE_URL = "#";

function DownloadButton({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <a
      href={APP_STORE_URL}
      className={`inline-flex items-center justify-center gap-2.5 rounded-full font-semibold tracking-[-0.01em] transition-opacity hover:opacity-80 active:opacity-60 border-2`}
      style={{
        background: "#FFFFFF",
        color: "#0c0c0c",
        borderColor: "#6FA8FF",
        fontSize: size === "lg" ? 11 : 11,
        paddingLeft: size === "lg" ? 30 : 24,
        paddingRight: size === "lg" ? 30 : 24,
        paddingTop: size === "lg" ? 10 : 9,
        paddingBottom: size === "lg" ? 10 : 9,
        minWidth: size === "lg" ? 165 : 150,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#0c0c0c" className="shrink-0">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
      Download Free
    </a>
  );
}

function PhoneFrame({ src, alt, tilt }: { src: string; alt: string; tilt: string }) {
  const btnL: React.CSSProperties = {
    position: "absolute", left: -3.5, width: 3,
    background: "linear-gradient(to right, #0e0e10, #2a2a2c)",
    borderRadius: "2px 0 0 2px",
  };
  const btnR: React.CSSProperties = {
    position: "absolute", right: -3.5, width: 3,
    background: "linear-gradient(to left, #0e0e10, #2a2a2c)",
    borderRadius: "0 2px 2px 0",
  };
  return (
    <div style={{ perspective: "1200px" }}>
      <div style={{ transform: tilt, position: "relative" }}>
        <div style={{ ...btnL, top: "11%", height: 16 }} />
        <div style={{ ...btnL, top: "18%", height: 26 }} />
        <div style={{ ...btnL, top: "26%", height: 26 }} />
        <div style={{ ...btnR, top: "20%", height: 48 }} />
        <div
          style={{
            borderRadius: 46,
            padding: "7px 6px",
            background: "linear-gradient(150deg, #3d3d3f 0%, #1c1c1e 30%, #38383a 58%, #1c1c1e 82%, #2c2c2e 100%)",
            boxShadow: [
              "inset 0 0 0 0.5px rgba(255,255,255,0.14)",
              "inset 0 0.5px 0 rgba(255,255,255,0.07)",
              "0 0 0 0.75px rgba(0,0,0,0.9)",
              "0 24px 60px rgba(0,0,0,0.18)",
            ].join(", "),
          }}
        >
          <div style={{ borderRadius: 39, overflow: "hidden", background: "#000" }}>
            <Image src={src} alt={alt} width={640} height={1390} className="w-full block" />
          </div>
        </div>
      </div>
    </div>
  );
}

const features = [
  "Log a photo, scan a barcode, or just type it. AI figures out the rest in seconds.",
  "See exactly what you ate today, in plain language.",
  "Go beyond calories. See the vitamins and nutrients behind your meals.",
  "Log how you feel. Your AI coach connects it back to what you ate.",
  "Daily nudges from your AI Coach that learns your habits over time.",
  "Syncs with Apple Health automatically.",
];

export default function Home() {
  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: "#F8FAFC", color: "#1F2937", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
    >

      {/* ── NAV ──────────────────────────────────────────────── */}
      <header className="flex flex-col items-center" style={{ paddingLeft: 40, paddingRight: 40, paddingTop: 36, paddingBottom: 12 }}>
        <Image src="/icon.png" alt="WhatYouAte" width={60} height={60} className="rounded-[16px]" priority style={{ marginBottom: 10 }} />
        <span className="font-semibold tracking-[-0.01em]" style={{ fontSize: 19, color: "#1F2937" }}>
          WhatYouAt<span className="relative inline-block">e
            <span className="absolute right-0 translate-x-[10px] font-semibold" style={{ top: -1, fontSize: 10, color: "#9CA3AF" }}>AI</span>
          </span>
        </span>
      </header>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section
        className="flex flex-col md:flex-row items-center justify-center gap-12 md:gap-16 md:min-h-[82vh]"
        style={{ paddingLeft: 40, paddingRight: 40, paddingTop: 0, paddingBottom: 40 }}
      >
        <div className="flex flex-col items-center md:items-start text-center md:text-left max-w-[440px]">

          {/* Headline */}
          <Reveal>
            <h1
              className="font-bold leading-[1.06] tracking-[-0.03em]"
              style={{ fontSize: "clamp(40px, 6vw, 56px)", marginBottom: 20 }}
            >
              <span style={{ color: "#1F2937" }}>Eat Confidently</span><br />
              <span style={{ color: "#1F2937" }}>Feel </span><span style={{ color: "#6FA8FF" }}>Better</span>
            </h1>
          </Reveal>

          {/* Subline */}
          <Reveal delay={0.08}>
            <p
              className="text-[18px] leading-[1.7]"
              style={{ marginBottom: 36, color: "#374151", maxWidth: 360 }}
            >
              The AI food coach that tracks what you eat, connects it to how you feel, and helps you improve without the complexity.
            </p>
          </Reveal>

          {/* CTA */}
          <Reveal delay={0.14}>
            <div className="flex flex-col items-center md:items-start" style={{ gap: 12 }}>
              <DownloadButton size="lg" />
              <p className="text-[12px] font-medium" style={{ color: "#6B7280" }}>
                7-day Pro trial included · iOS only
              </p>
            </div>
          </Reveal>
        </div>

        {/* Phone */}
        <Reveal delay={0.1}>
          <div className="w-full max-w-[210px] md:max-w-[230px] flex-shrink-0">
            <PhoneFrame src="/screenshots/home.webp" alt="WhatYouAte home screen" tilt="rotateY(18deg) rotateX(5deg)" />
          </div>
        </Reveal>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────── */}
      <section
        style={{ paddingLeft: 40, paddingRight: 40, paddingTop: 40, paddingBottom: 40, borderTop: "1px solid rgba(31,41,55,0.08)" }}
      >
        <Reveal>
          <div
            className="mx-auto"
            style={{
              maxWidth: 560,
              background: "#FFFFFF",
              border: "1px solid rgba(31,41,55,0.08)",
              borderRadius: 20,
              padding: "24px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {features.map((f) => (
              <div key={f} className="flex items-start" style={{ gap: 16 }}>
                <span
                  className="flex-shrink-0 flex items-center justify-center rounded-full"
                  style={{
                    marginTop: 3,
                    width: 20, height: 20,
                    background: "rgba(111,168,255,0.12)",
                    border: "1px solid rgba(111,168,255,0.3)",
                  }}
                >
                  <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="#6FA8FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                </span>
                <p className="text-[15px] leading-[1.6]" style={{ color: "#1F2937" }}>{f}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── NO FLUFF ─────────────────────────────────────────── */}
      <section
        style={{ paddingLeft: 40, paddingRight: 40, paddingTop: 40, paddingBottom: 40, borderTop: "1px solid rgba(31,41,55,0.08)" }}
      >
        <Reveal>
          <p
            className="mx-auto text-center text-[18px] leading-[1.85]"
            style={{ maxWidth: 580, color: "#374151" }}
          >
            Understanding your food and feeling better shouldn't be complicated. So we uncomplicated both the app, and this page. No endless features, no unnecessary noise. Just easy improvement.
          </p>
        </Reveal>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section
        className="text-center"
        style={{ paddingLeft: 40, paddingRight: 40, paddingTop: 40, paddingBottom: 40, borderTop: "1px solid rgba(31,41,55,0.08)" }}
      >
        <Reveal>
          <div className="mx-auto flex flex-col items-center" style={{ maxWidth: 440, gap: 16 }}>
            <h2
              className="font-bold tracking-[-0.03em] leading-[1.1]"
              style={{ fontSize: "clamp(32px, 5vw, 46px)", color: "#1F2937" }}
            >
              Give it a week<br />See how you feel
            </h2>
            <p className="text-[16px]" style={{ color: "#374151", marginBottom: 8 }}>
              Download free. 7-day Pro trial. No commitment.
            </p>
            <DownloadButton size="lg" />
          </div>
        </Reveal>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer
        style={{ paddingLeft: 40, paddingRight: 40, paddingTop: 24, paddingBottom: 24, borderTop: "1px solid rgba(31,41,55,0.08)" }}
      >
        <div className="mx-auto max-w-4xl flex flex-col items-center text-center" style={{ gap: 10 }}>
          <div className="flex items-center gap-2">
            <Image src="/icon.png" alt="WhatYouAte" width={20} height={20} className="rounded-[5px]" style={{ opacity: 0.5 }} />
            <span className="text-[13px] font-semibold tracking-[-0.01em]" style={{ color: "#6B7280" }}>
              WhatYouAt<span className="relative inline-block">e
                <span className="absolute right-0 translate-x-[10px] text-[9px] font-semibold" style={{ top: 0, color: "#6B7280" }}>AI</span>
              </span>
            </span>
          </div>
          <div className="flex gap-8 text-[13px]" style={{ color: "#6B7280" }}>
            <Link href="/privacy" className="hover:text-[#374151] transition-colors">Privacy Policy</Link>
            <a href="mailto:support@whatyouate.app" className="hover:text-[#374151] transition-colors">Support</a>
          </div>
          <span className="text-[12px]" style={{ color: "#6B7280" }}>© {new Date().getFullYear()} WhatYouAte. All rights reserved.</span>
        </div>
      </footer>

    </div>
  );
}
