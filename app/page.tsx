import Image from "next/image";
import Link from "next/link";
import Reveal from "../components/Reveal";
import PillarGrid from "../components/PillarGrid";

const APP_STORE_URL = "#";

function DownloadButton({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <a
      href={APP_STORE_URL}
      className={`inline-flex items-center gap-2.5 rounded-full bg-[#6FA8FF] text-white font-semibold tracking-[-0.01em] transition-opacity hover:opacity-85 active:opacity-70 shadow-[0_4px_20px_rgba(111,168,255,0.45)] ${
        size === "lg" ? "px-8 py-3.5 text-[15px]" : "px-6 py-3 text-[14px]"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white" className="shrink-0">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
      Download Free
    </a>
  );
}

const features = [
  {
    screenshot: "/screenshots/home.webp",
    rotate: "-2deg",
    headline: "Just say what you ate.",
    body: "Type it, snap a photo, or describe it however feels natural. WhatYouAte handles the rest. No barcode scanner, no measuring cups, no database to dig through.",
  },
  {
    screenshot: "/screenshots/insights.webp",
    rotate: "2.5deg",
    headline: "See how your day actually looks.",
    body: "A clean breakdown of what you ate, updated every time you log. No complicated charts. Just an honest picture of your day.",
  },
  {
    screenshot: "/screenshots/patterns.webp",
    rotate: "-1.5deg",
    headline: "Start noticing what works for you.",
    body: "Over time, WhatYouAte surfaces the patterns you never thought to look for. The meals that leave you feeling great and the habits quietly shaping how you feel.",
  },
  {
    screenshot: "/screenshots/micronutrients.webp",
    rotate: "3deg",
    headline: "More than just what you eat.",
    body: "See the vitamins and nutrients behind your meals, explained in plain language. Small signals that help you make slightly better choices every day.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white overflow-x-hidden" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>

      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 flex items-center px-6 py-4">
        <div className="flex items-center gap-2">
          <Image src="/icon.png" alt="WhatYouAte" width={26} height={26} className="rounded-[7px]" priority />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">WhatYouAte</span>
        </div>
      </header>

      {/* Hero — radial gradient baked into bg, no blur divs */}
      <section
        className="relative min-h-[100svh] flex flex-col md:flex-row items-center justify-center gap-14 px-6 pt-32 pb-20 md:pt-0 md:pb-0"
        style={{ background: "radial-gradient(ellipse 80% 60% at 65% 40%, rgba(111,168,255,0.13) 0%, #0c0c0c 65%)" }}
      >
        <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left max-w-[420px]">
          <div className="hero-1 mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/50">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6FA8FF]" />
            Free on the App Store
          </div>

          <h1 className="hero-2 text-[42px] sm:text-[54px] font-bold leading-[1.06] tracking-[-0.03em] mb-5">
            Know what you ate.<br />
            <span className="text-[#6FA8FF]">Feel the difference.</span>
          </h1>

          <p className="hero-3 text-[17px] leading-[1.65] text-white/45 mb-8 max-w-[340px]">
            Food affects how you feel every day. WhatYouAte helps you understand it without the obsessing.
          </p>

          <div className="hero-4 flex flex-col items-center md:items-start gap-2.5">
            <DownloadButton size="lg" />
            <p className="text-[12px] text-white/40">7-day Pro trial included · iPhone only</p>
          </div>
        </div>

        <div className="hero-phone relative z-10 w-full max-w-[210px] md:max-w-[230px] flex-shrink-0">
          <Image
            src="/screenshots/home.webp"
            alt="WhatYouAte home screen"
            width={640}
            height={1390}
            className="w-full rounded-[36px] shadow-[0_24px_60px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.06)]"
            priority
          />
        </div>
      </section>

      {/* Dark to light */}
      <div className="h-20 bg-gradient-to-b from-[#0c0c0c] to-[#F0F2F5]" />

      {/* "Not like other apps" + pillars */}
      <section className="bg-[#F0F2F5] px-6 pt-4 pb-20">
        <Reveal className="mx-auto max-w-[540px] text-center mb-16">
          <h2 className="text-[28px] sm:text-[36px] font-bold text-[#0c0c0c] tracking-[-0.02em] leading-tight mb-4">
            Most nutrition apps feel like homework.
          </h2>
          <p className="text-[16px] text-[#6b7280] leading-[1.65]">
            Barcode scanning, meal databases, daily logs, weekly reports. It is overwhelming. WhatYouAte is built for people who just want to eat a little better and actually feel it.
          </p>
        </Reveal>
        <PillarGrid />
      </section>

      {/* Light to dark */}
      <div className="h-20 bg-gradient-to-b from-[#F0F2F5] to-[#0c0c0c]" />

      {/* Features — single bg gradient, no per-section blur divs */}
      <section
        className="bg-[#0c0c0c] px-6 py-8"
        style={{ background: "radial-gradient(ellipse 70% 40% at 30% 20%, rgba(111,168,255,0.08) 0%, #0c0c0c 60%)" }}
      >
        {features.map((f, i) => {
          const isEven = i % 2 === 0;
          return (
            <div
              key={f.headline}
              className={`mx-auto max-w-4xl flex flex-col md:flex-row items-center gap-10 md:gap-16 py-16 md:py-20 ${i > 0 ? "border-t border-white/[0.06]" : ""} ${isEven ? "" : "md:flex-row-reverse"}`}
            >
              <Reveal className="flex-shrink-0 w-full max-w-[175px] md:max-w-[195px] mx-auto md:mx-0">
                <div style={{ transform: `rotate(${f.rotate})` }}>
                  <Image
                    src={f.screenshot}
                    alt={f.headline}
                    width={640}
                    height={1390}
                    className="w-full rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)]"
                  />
                </div>
              </Reveal>

              <Reveal delay={0.1} className="flex flex-col gap-3 text-center md:text-left max-w-[300px] mx-auto md:mx-0">
                <h3 className="text-[24px] sm:text-[28px] font-bold tracking-[-0.02em] leading-[1.2]">{f.headline}</h3>
                <p className="text-[15px] text-white/45 leading-[1.75]">{f.body}</p>
              </Reveal>
            </div>
          );
        })}
      </section>

      {/* Dark to light: Apple Health */}
      <div className="h-20 bg-gradient-to-b from-[#0c0c0c] to-[#F0F2F5]" />
      <section className="bg-[#F0F2F5] py-16 px-6">
        <Reveal className="mx-auto max-w-lg flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-[#FF3B5C]/10 flex items-center justify-center border border-[#FF3B5C]/15">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#FF3B5C">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#0c0c0c] mb-1">Connects to Apple Health</p>
            <p className="text-[14px] text-[#6b7280] leading-relaxed">
              Your nutrition data lives right alongside your steps and sleep, exactly where it belongs.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Light to dark: CTA */}
      <div className="h-20 bg-gradient-to-b from-[#F0F2F5] to-[#0c0c0c]" />
      <section
        className="py-28 px-6 text-center"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(111,168,255,0.1) 0%, #0c0c0c 65%)" }}
      >
        <Reveal className="mx-auto max-w-[420px]">
          <h2 className="text-[34px] sm:text-[42px] font-bold tracking-[-0.03em] leading-[1.1] mb-4">
            Give it a week.<br />See how you feel.
          </h2>
          <p className="text-[15px] text-white/40 leading-relaxed mb-8">
            Download free. 7-day Pro trial. No commitment.
          </p>
          <DownloadButton size="lg" />
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="bg-[#0c0c0c] border-t border-white/[0.07] py-10 px-6">
        <div className="mx-auto max-w-4xl flex flex-col items-center gap-5 text-center">
          <div className="flex items-center gap-2">
            <Image src="/icon.png" alt="WhatYouAte" width={20} height={20} className="rounded-[5px] opacity-60" />
            <span className="text-[13px] font-semibold text-white/40">WhatYouAte</span>
          </div>
          <div className="flex gap-6 text-[12px] text-white/30">
            <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
            <a href="mailto:support@whatyouate.app" className="hover:text-white/60 transition-colors">Support</a>
          </div>
          <span className="text-[11px] text-white/20">© {new Date().getFullYear()} WhatYouAte. All rights reserved.</span>
        </div>
      </footer>

    </div>
  );
}
