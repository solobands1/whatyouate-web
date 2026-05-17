"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

const APP_STORE_URL = "#";
const ease = [0.22, 1, 0.36, 1] as const;

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
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

const features = [
  {
    screenshot: "/screenshots/home.webp",
    alt: "WhatYouAte home screen",
    headline: "Just say what you ate.",
    body: "Type it or snap a photo. WhatYouAte figures out the rest — no barcode scanner, no measuring cups, no database to scroll through. Ten seconds and you're done.",
  },
  {
    screenshot: "/screenshots/insights.webp",
    alt: "Daily nutrition insights",
    headline: "See how your day actually looks.",
    body: "A clean breakdown of what you ate, updated every time you log. No jargon, no complicated charts — just an honest picture of your day.",
  },
  {
    screenshot: "/screenshots/patterns.webp",
    alt: "Weekly patterns and trends",
    headline: "Start noticing what works for you.",
    body: "Over time, WhatYouAte surfaces the patterns you never thought to look for — the meals that leave you feeling great and the habits quietly shaping how you feel.",
  },
  {
    screenshot: "/screenshots/micronutrients.webp",
    alt: "Micronutrient signals",
    headline: "More than just what you eat.",
    body: "See the vitamins and nutrients behind your meals, explained in plain language. Small signals that help you make slightly better choices — no expertise needed.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white overflow-x-hidden" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>

      {/* ── Nav ── */}
      <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-5 py-3 bg-[#0c0c0c]/80 backdrop-blur-xl border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <Image src="/icon.png" alt="WhatYouAte" width={26} height={26} className="rounded-[7px]" priority />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">WhatYouAte</span>
        </div>
        <a
          href={APP_STORE_URL}
          className="flex items-center gap-1.5 rounded-full bg-white text-[#0c0c0c] px-4 py-2 text-[13px] font-semibold tracking-[-0.01em] transition-opacity hover:opacity-80 active:opacity-60"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          Download
        </a>
      </header>

      {/* ── Hero ── */}
      <section className="relative min-h-[100svh] flex flex-col md:flex-row items-center justify-center gap-12 px-6 pt-24 pb-16 md:pt-0 md:pb-0 overflow-hidden">
        {/* Glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 80% 60% at 60% 40%, rgba(111,168,255,0.12) 0%, transparent 65%)" }}
        />

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
            className="text-[40px] sm:text-[52px] font-bold leading-[1.08] tracking-[-0.03em] mb-5"
          >
            Know what you ate.<br />
            <span className="text-[#6FA8FF]">Feel the difference.</span>
          </motion.h1>

          <motion.p
            variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}
            className="text-[17px] leading-[1.6] text-white/45 mb-8 max-w-[340px]"
          >
            Food affects how you feel every day. WhatYouAte helps you understand it — without the obsessing.
          </motion.p>

          <motion.div
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}
            className="flex flex-col items-center md:items-start gap-2"
          >
            <a
              href={APP_STORE_URL}
              className="inline-flex items-center gap-2.5 rounded-full bg-[#6FA8FF] px-7 py-4 text-[15px] font-semibold text-[#0c0c0c] tracking-[-0.01em] transition-all hover:bg-[#90bcff] active:scale-95 shadow-[0_8px_32px_rgba(111,168,255,0.35)]"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Download Free
            </a>
            <p className="text-[12px] text-white/25">7-day Pro trial included · iPhone only</p>
          </motion.div>
        </motion.div>

        {/* Phone */}
        <motion.div
          className="relative z-10 w-full max-w-[220px] md:max-w-[240px] flex-shrink-0"
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, ease, delay: 0.2 }}
        >
          <div
            className="absolute -inset-6 rounded-[50%] blur-3xl"
            style={{ background: "rgba(111,168,255,0.18)", transform: "scaleY(0.5) translateY(30%)" }}
          />
          <Image
            src="/screenshots/home.webp"
            alt="WhatYouAte home screen"
            width={640}
            height={1386}
            className="relative w-full rounded-[36px] shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
            priority
          />
        </motion.div>
      </section>

      {/* ── "Not like other apps" ── */}
      <section className="bg-[#F7F8FA] py-20 px-6">
        <Reveal className="mx-auto max-w-[520px] text-center">
          <h2 className="text-[28px] sm:text-[36px] font-bold text-[#0c0c0c] tracking-[-0.02em] leading-tight mb-4">
            Most nutrition apps feel like homework.
          </h2>
          <p className="text-[16px] text-[#6b7280] leading-[1.65]">
            Barcode scanning, meal databases, daily logs, weekly reports — it&apos;s overwhelming. WhatYouAte is built for people who just want to eat a little better and actually feel it. Not people who want a second job.
          </p>
        </Reveal>
      </section>

      {/* ── Features ── */}
      <section className="py-4 px-6">
        {features.map((f, i) => {
          const isEven = i % 2 === 0;
          return (
            <div
              key={f.headline}
              className={`mx-auto max-w-4xl flex flex-col md:flex-row items-center gap-10 md:gap-16 py-16 md:py-20 ${i > 0 ? "border-t border-white/[0.06]" : ""} ${isEven ? "" : "md:flex-row-reverse"}`}
            >
              <Reveal className="flex-shrink-0 w-full max-w-[185px] md:max-w-[200px] mx-auto md:mx-0">
                <div className="relative">
                  <div
                    className="absolute -inset-4 rounded-[50%] blur-2xl opacity-60"
                    style={{ background: "rgba(111,168,255,0.15)" }}
                  />
                  <Image
                    src={f.screenshot}
                    alt={f.alt}
                    width={640}
                    height={1386}
                    className="relative w-full rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
                  />
                </div>
              </Reveal>

              <Reveal delay={0.08} className="flex flex-col gap-3 text-center md:text-left max-w-[320px] mx-auto md:mx-0">
                <h3 className="text-[24px] sm:text-[28px] font-bold tracking-[-0.02em] leading-[1.2]">
                  {f.headline}
                </h3>
                <p className="text-[15px] text-white/45 leading-[1.7]">{f.body}</p>
              </Reveal>
            </div>
          );
        })}
      </section>

      {/* ── Apple Health ── */}
      <section className="bg-[#F7F8FA] py-16 px-6">
        <Reveal className="mx-auto max-w-lg flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-[#FF3B5C]/10 flex items-center justify-center border border-[#FF3B5C]/15">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#FF3B5C">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#0c0c0c] mb-1">Connects to Apple Health</p>
            <p className="text-[14px] text-[#6b7280] leading-relaxed">
              Your nutrition data lives right alongside your steps and sleep — exactly where it belongs.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── CTA ── */}
      <section className="py-28 px-6 text-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(111,168,255,0.12) 0%, transparent 70%)" }}
        />
        <Reveal className="relative mx-auto max-w-[400px]">
          <h2 className="text-[32px] sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.1] mb-4">
            Give it a week.<br />See how you feel.
          </h2>
          <p className="text-[15px] text-white/40 leading-relaxed mb-8">
            Download free. 7-day Pro trial. No commitment.
          </p>
          <a
            href={APP_STORE_URL}
            className="inline-flex items-center gap-2.5 rounded-full bg-[#6FA8FF] px-7 py-4 text-[15px] font-semibold text-[#0c0c0c] tracking-[-0.01em] transition-all hover:bg-[#90bcff] active:scale-95 shadow-[0_8px_32px_rgba(111,168,255,0.35)]"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            Download Free
          </a>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.07] py-8 px-6">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-white/25">
          <span>© {new Date().getFullYear()} WhatYouAte</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white/50 transition-colors">Privacy Policy</Link>
            <a href="mailto:support@whatyouate.app" className="hover:text-white/50 transition-colors">Support</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
