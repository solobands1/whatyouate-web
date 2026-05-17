import Image from "next/image";
import Link from "next/link";
import Reveal from "../components/Reveal";
import PillarGrid from "../components/PillarGrid";

const APP_STORE_URL = "#";

// Seamless gradient transitions — tall + multi-stop so the eye never sees a hard edge
const toLight = { background: "linear-gradient(to bottom, #0c0c0c 0%, #0c0c0c 20%, #c8cdd4 65%, #F0F2F5 100%)", height: 200 } as React.CSSProperties;
const toDark  = { background: "linear-gradient(to bottom, #F0F2F5 0%, #c8cdd4 35%, #0c0c0c 80%, #0c0c0c 100%)", height: 200 } as React.CSSProperties;

function DownloadButton({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <a
      href={APP_STORE_URL}
      className={`inline-flex items-center justify-center gap-2.5 rounded-full bg-white text-[#0c0c0c] font-semibold tracking-[-0.01em] border-2 border-[#6FA8FF] transition-opacity hover:opacity-80 active:opacity-60 ${
        size === "lg" ? "px-10 py-3.5 text-[15px] min-w-[210px]" : "px-8 py-3 text-[14px] min-w-[190px]"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#0c0c0c" className="shrink-0">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
      Download Free
    </a>
  );
}

// iPhone-like frame with 3D perspective tilt
function PhoneFrame({ src, alt, tilt }: { src: string; alt: string; tilt: string }) {
  return (
    <div style={{ perspective: "1100px" }}>
      <div style={{ transform: tilt }}>
        {/* Bezel */}
        <div
          style={{
            borderRadius: 48,
            padding: 10,
            background: "linear-gradient(145deg, #2c2c2e, #1a1a1c)",
            boxShadow:
              "inset 0 0 0 1px rgba(255,255,255,0.12), 0 32px 64px rgba(0,0,0,0.65), 4px 4px 0 rgba(0,0,0,0.3)",
          }}
        >
          {/* Screen */}
          <div style={{ borderRadius: 38, overflow: "hidden", background: "#000" }}>
            <Image src={src} alt={alt} width={640} height={1390} className="w-full block" />
          </div>
        </div>
      </div>
    </div>
  );
}

const features = [
  {
    screenshot: "/screenshots/home.webp",
    tilt: "rotateY(-16deg) rotateX(4deg)",
    headline: "Just say what you ate.",
    body: "Type it, snap a photo, or describe it however feels natural. WhatYouAte handles the rest. No barcode scanner, no measuring cups, no database to dig through.",
  },
  {
    screenshot: "/screenshots/insights.webp",
    tilt: "rotateY(16deg) rotateX(4deg)",
    headline: "See how your day actually looks.",
    body: "A clean breakdown of what you ate, updated every time you log. No complicated charts. Just an honest picture of your day.",
  },
  {
    screenshot: "/screenshots/patterns.webp",
    tilt: "rotateY(-16deg) rotateX(4deg)",
    headline: "Start noticing what works for you.",
    body: "Over time, WhatYouAte surfaces the patterns you never thought to look for. The meals that leave you feeling great and the habits quietly shaping how you feel.",
  },
  {
    screenshot: "/screenshots/micronutrients.webp",
    tilt: "rotateY(16deg) rotateX(4deg)",
    headline: "More than just what you eat.",
    body: "See the vitamins and nutrients behind your meals, explained in plain language. Small signals that help you make slightly better choices every day.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white overflow-x-hidden" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>

      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 flex items-center px-7 py-5">
        <div className="flex items-center gap-2.5">
          <Image src="/icon.png" alt="WhatYouAte" width={26} height={26} className="rounded-[7px]" priority />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">WhatYouAte</span>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative min-h-[100svh] flex flex-col md:flex-row items-center justify-center gap-16 px-8 pt-40 pb-28 md:pt-0 md:pb-0"
        style={{ background: "radial-gradient(ellipse 80% 60% at 65% 40%, rgba(111,168,255,0.13) 0%, #0c0c0c 65%)" }}
      >
        <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left max-w-[440px]">
          <div className="hero-1 mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[11px] font-medium text-white/50">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6FA8FF]" />
            Free on the App Store
          </div>

          <h1 className="hero-2 text-[44px] sm:text-[56px] font-bold leading-[1.06] tracking-[-0.03em] mb-6">
            Know what you ate.<br />
            <span className="text-[#6FA8FF]">Feel the difference.</span>
          </h1>

          <p className="hero-3 text-[18px] leading-[1.7] text-white/45 mb-10 max-w-[360px]">
            Food affects how you feel every day. WhatYouAte helps you understand it without the obsessing.
          </p>

          <div className="hero-4 flex flex-col items-center md:items-start gap-3">
            <DownloadButton size="lg" />
            <p className="text-[12px] text-white/40">7-day Pro trial included · iPhone only</p>
          </div>
        </div>

        <div className="hero-phone relative z-10 w-full max-w-[220px] md:max-w-[240px] flex-shrink-0">
          <PhoneFrame
            src="/screenshots/home.webp"
            alt="WhatYouAte home screen"
            tilt="rotateY(14deg) rotateX(3deg)"
          />
        </div>
      </section>

      {/* Dark → Light */}
      <div style={toLight} />

      {/* "Not like other apps" + pillars */}
      <section className="bg-[#F0F2F5] px-8 pt-6 pb-28">
        <Reveal className="mx-auto max-w-[560px] text-center mb-20">
          <h2 className="text-[30px] sm:text-[38px] font-bold text-[#0c0c0c] tracking-[-0.02em] leading-tight mb-5">
            Most nutrition apps feel like homework.
          </h2>
          <p className="text-[17px] text-[#6b7280] leading-[1.7]">
            Barcode scanning, meal databases, daily logs, weekly reports. It is overwhelming. WhatYouAte is built for people who just want to eat a little better and actually feel it.
          </p>
        </Reveal>
        <PillarGrid />
      </section>

      {/* Light → Dark */}
      <div style={toDark} />

      {/* Features */}
      <section
        className="bg-[#0c0c0c] px-8 pt-4 pb-8"
        style={{ background: "radial-gradient(ellipse 70% 40% at 30% 20%, rgba(111,168,255,0.07) 0%, #0c0c0c 60%)" }}
      >
        {features.map((f, i) => {
          const isEven = i % 2 === 0;
          return (
            <div
              key={f.headline}
              className={`mx-auto max-w-5xl flex flex-col md:flex-row items-center gap-12 md:gap-20 py-20 md:py-24 ${i > 0 ? "border-t border-white/[0.06]" : ""} ${isEven ? "" : "md:flex-row-reverse"}`}
            >
              <Reveal className="flex-shrink-0 w-full max-w-[180px] md:max-w-[200px] mx-auto md:mx-0">
                <PhoneFrame src={f.screenshot} alt={f.headline} tilt={f.tilt} />
              </Reveal>

              <Reveal delay={0.12} className="flex flex-col gap-4 text-center md:text-left max-w-[320px] mx-auto md:mx-0">
                <h3 className="text-[26px] sm:text-[30px] font-bold tracking-[-0.02em] leading-[1.2]">{f.headline}</h3>
                <p className="text-[16px] text-white/45 leading-[1.8]">{f.body}</p>
              </Reveal>
            </div>
          );
        })}
      </section>

      {/* Dark → Light: Apple Health */}
      <div style={toLight} />
      <section className="bg-[#F0F2F5] py-20 px-8">
        <Reveal className="mx-auto max-w-lg flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-[#FF3B5C]/10 flex items-center justify-center border border-[#FF3B5C]/15">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#FF3B5C">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#0c0c0c] mb-1.5">Connects to Apple Health</p>
            <p className="text-[15px] text-[#6b7280] leading-relaxed">
              Your nutrition data lives right alongside your steps and sleep, exactly where it belongs.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Light → Dark: CTA */}
      <div style={toDark} />
      <section
        className="py-36 px-8 text-center"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(111,168,255,0.09) 0%, #0c0c0c 65%)" }}
      >
        <Reveal className="mx-auto max-w-[440px]">
          <h2 className="text-[36px] sm:text-[44px] font-bold tracking-[-0.03em] leading-[1.1] mb-5">
            Give it a week.<br />See how you feel.
          </h2>
          <p className="text-[16px] text-white/40 leading-relaxed mb-10">
            Download free. 7-day Pro trial. No commitment.
          </p>
          <DownloadButton size="lg" />
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="bg-[#0c0c0c] border-t border-white/[0.07] py-12 px-8">
        <div className="mx-auto max-w-4xl flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-2">
            <Image src="/icon.png" alt="WhatYouAte" width={20} height={20} className="rounded-[5px] opacity-50" />
            <span className="text-[13px] font-semibold text-white/35">WhatYouAte</span>
          </div>
          <div className="flex gap-8 text-[13px] text-white/30">
            <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
            <a href="mailto:support@whatyouate.app" className="hover:text-white/60 transition-colors">Support</a>
          </div>
          <span className="text-[12px] text-white/18">© {new Date().getFullYear()} WhatYouAte. All rights reserved.</span>
        </div>
      </footer>

    </div>
  );
}
