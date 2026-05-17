"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

const APP_STORE_URL = "#";
const ease = [0.22, 1, 0.36, 1] as const;

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7, ease, delay }}
    >
      {children}
    </motion.div>
  );
}

function DownloadButton({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <a
      href={APP_STORE_URL}
      className={`inline-flex items-center gap-2.5 rounded-full bg-[#6FA8FF] text-white font-semibold tracking-[-0.01em] transition-all hover:bg-[#88b8ff] active:scale-95 shadow-[0_8px_30px_rgba(111,168,255,0.4)] ${
        size === "lg" ? "px-8 py-3.5 text-[15px]" : "px-6 py-3 text-[14px]"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
      Download Free
    </a>
  );
}

function AnimatedBlobs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="blob1 absolute rounded-full blur-[120px]" style={{ width: 500, height: 500, background: "rgba(111,168,255,0.16)", top: "5%", left: "15%" }} />
      <div className="blob2 absolute rounded-full blur-[100px]" style={{ width: 350, height: 350, background: "rgba(140,100,255,0.1)", top: "40%", right: "8%" }} />
      <div className="blob3 absolute rounded-full blur-[140px]" style={{ width: 400, height: 300, background: "rgba(111,168,255,0.09)", bottom: "10%", left: "40%" }} />
    </div>
  );
}

const pillars = [
  {
    label: "Snap or type",
    sub: "Describe your meal however feels natural. Photo, text, or voice.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
  {
    label: "AI does the rest",
    sub: "No barcodes. No measuring. No databases. Just results in seconds.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    label: "See your day",
    sub: "A clear breakdown of what you ate, in plain language. No jargon.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    label: "Spot patterns",
    sub: "Over time, understand what makes you feel good and what does not.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
];

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
      <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Image src="/icon.png" alt="WhatYouAte" width={26} height={26} className="rounded-[7px]" priority />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">WhatYouAte</span>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[100svh] flex flex-col md:flex-row items-center justify-center gap-14 px-6 pt-32 pb-20 md:pt-24 md:pb-16 overflow-hidden">
        <AnimatedBlobs />

        {/* Text */}
        <motion.div
          className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left max-w-[420px]"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.div
            variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}
            className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/50"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#6FA8FF]" />
            Free on the App Store
          </motion.div>

          <motion.h1
            variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } } }}
            className="text-[42px] sm:text-[54px] font-bold leading-[1.06] tracking-[-0.03em] mb-5"
          >
            Know what you ate.<br />
            <span className="text-[#6FA8FF]">Feel the difference.</span>
          </motion.h1>

          <motion.p
            variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}
            className="text-[17px] leading-[1.65] text-white/45 mb-8 max-w-[340px]"
          >
            Food affects how you feel every day. WhatYouAte helps you understand it without the obsessing.
          </motion.p>

          <motion.div
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}
            className="flex flex-col items-center md:items-start gap-2.5"
          >
            <DownloadButton size="lg" />
            <p className="text-[12px] text-white/40">7-day Pro trial included · iPhone only</p>
          </motion.div>
        </motion.div>

        {/* Phone */}
        <motion.div
          className="relative z-10 w-full max-w-[210px] md:max-w-[230px] flex-shrink-0"
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.1, ease, delay: 0.25 }}
        >
          <div className="absolute -inset-8 rounded-full blur-3xl" style={{ background: "rgba(111,168,255,0.18)", transform: "scaleY(0.5) translateY(35%)" }} />
          <Image
            src="/screenshots/home.webp"
            alt="WhatYouAte home screen"
            width={640}
            height={1390}
            className="relative w-full rounded-[36px] shadow-[0_32px_80px_rgba(0,0,0,0.7)]"
            priority
          />
        </motion.div>
      </section>

      {/* Dark to light transition */}
      <div className="h-24 bg-gradient-to-b from-[#0c0c0c] to-[#F0F2F5]" />

      {/* "Not like other apps" + pillars */}
      <section className="relative bg-[#F0F2F5] px-6 pt-4 pb-20">
        <Reveal className="mx-auto max-w-[540px] text-center mb-16">
          <h2 className="text-[28px] sm:text-[36px] font-bold text-[#0c0c0c] tracking-[-0.02em] leading-tight mb-4">
            Most nutrition apps feel like homework.
          </h2>
          <p className="text-[16px] text-[#6b7280] leading-[1.65]">
            Barcode scanning, meal databases, daily logs, weekly reports. It is overwhelming. WhatYouAte is built for people who just want to eat a little better and actually feel it.
          </p>
        </Reveal>

        <motion.div
          className="mx-auto max-w-3xl grid grid-cols-2 md:grid-cols-4 gap-4"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
        >
          {pillars.map((p) => (
            <motion.div
              key={p.label}
              variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}
              className="flex flex-col items-center text-center gap-3 px-3 py-5"
            >
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#6FA8FF]/12 border border-[#6FA8FF]/20 text-[#6FA8FF]">
                {p.icon}
              </div>
              <p className="text-[13px] font-semibold text-[#0c0c0c] leading-tight">{p.label}</p>
              <p className="text-[12px] text-[#6b7280] leading-relaxed">{p.sub}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Light to dark transition */}
      <div className="h-24 bg-gradient-to-b from-[#F0F2F5] to-[#0c0c0c]" />

      {/* Features */}
      <section className="relative bg-[#0c0c0c] px-6 py-8">
        <AnimatedBlobs />
        {features.map((f, i) => {
          const isEven = i % 2 === 0;
          return (
            <div
              key={f.headline}
              className={`relative z-10 mx-auto max-w-4xl flex flex-col md:flex-row items-center gap-10 md:gap-16 py-16 md:py-20 ${
                i > 0 ? "border-t border-white/[0.06]" : ""
              } ${isEven ? "" : "md:flex-row-reverse"}`}
            >
              <Reveal
                delay={0}
                className="flex-shrink-0 w-full max-w-[175px] md:max-w-[195px] mx-auto md:mx-0"
              >
                <div className="relative" style={{ transform: `rotate(${f.rotate})` }}>
                  <div className="absolute -inset-4 rounded-full blur-2xl opacity-50" style={{ background: "rgba(111,168,255,0.2)" }} />
                  <Image
                    src={f.screenshot}
                    alt={f.headline}
                    width={640}
                    height={1390}
                    className="relative w-full rounded-[28px] shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
                  />
                </div>
              </Reveal>

              <Reveal delay={0.1} className="flex flex-col gap-3 text-center md:text-left max-w-[300px] mx-auto md:mx-0">
                <h3 className="text-[24px] sm:text-[28px] font-bold tracking-[-0.02em] leading-[1.2]">
                  {f.headline}
                </h3>
                <p className="text-[15px] text-white/45 leading-[1.75]">{f.body}</p>
              </Reveal>
            </div>
          );
        })}
      </section>

      {/* Dark to light: Apple Health */}
      <div className="h-24 bg-gradient-to-b from-[#0c0c0c] to-[#F0F2F5]" />
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
      <div className="h-24 bg-gradient-to-b from-[#F0F2F5] to-[#0c0c0c]" />
      <section className="relative bg-[#0c0c0c] py-28 px-6 text-center overflow-hidden">
        <AnimatedBlobs />
        <Reveal className="relative z-10 mx-auto max-w-[420px]">
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
          <div className="flex items-center gap-2 mb-1">
            <Image src="/icon.png" alt="WhatYouAte" width={20} height={20} className="rounded-[5px] opacity-60" />
            <span className="text-[13px] font-semibold text-white/40">WhatYouAte</span>
          </div>
          <div className="flex gap-6 text-[12px] text-white/30">
            <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
            <a href="mailto:support@whatyouate.app" className="hover:text-white/60 transition-colors">Support</a>
          </div>
          <span className="text-[11px] text-white/18">© {new Date().getFullYear()} WhatYouAte. All rights reserved.</span>
        </div>
      </footer>

    </div>
  );
}
