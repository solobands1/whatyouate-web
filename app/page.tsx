"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

const APP_STORE_URL = "#";

const ease = [0.25, 0.1, 0.25, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease, delay }}
    >
      {children}
    </motion.div>
  );
}

function AppStoreButton({ variant = "blue" }: { variant?: "blue" | "ghost" }) {
  return (
    <a
      href={APP_STORE_URL}
      className={`group inline-flex items-center justify-center gap-2 rounded-full px-7 py-4 text-[14px] font-semibold tracking-tight transition-all active:scale-95 min-h-[52px] ${
        variant === "blue"
          ? "bg-[#6FA8FF] text-[#0a0a0a] shadow-[0_0_0_1px_rgba(111,168,255,0.4),0_4px_20px_rgba(111,168,255,0.3)] hover:bg-[#89bbff] hover:shadow-[0_0_0_1px_rgba(111,168,255,0.6),0_6px_28px_rgba(111,168,255,0.4)]"
          : "bg-white/8 text-white border border-white/12 backdrop-blur-sm hover:bg-white/14 hover:border-white/20"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
      Download Free
    </a>
  );
}

const problems = [
  { icon: "⚖️", text: "Weighing every gram of food" },
  { icon: "📊", text: "Filling out complicated logs" },
  { icon: "🔍", text: "Scanning barcodes for everything" },
  { icon: "😵", text: "Feeling like you need a degree to use it" },
];

const features = [
  {
    screenshot: "/screenshots/home.webp",
    alt: "WhatYouAte home screen",
    badge: "Log in seconds",
    headline: "Just say what you ate.",
    body: "Type it, snap a photo, or describe it however feels natural. WhatYouAte handles the rest — no barcode scanner, no measuring cups, no database to dig through.",
  },
  {
    screenshot: "/screenshots/insights.webp",
    alt: "Daily nutrition insights",
    badge: "Your daily picture",
    headline: "See how your day actually looks.",
    body: "A clean, simple breakdown of what you ate — updated every time you log. No complicated charts. Just an honest picture of your day, in plain language.",
  },
  {
    screenshot: "/screenshots/patterns.webp",
    alt: "Weekly patterns and trends",
    badge: "Start to notice things",
    headline: "Learn what works for you.",
    body: "Over time, WhatYouAte helps you spot your own patterns — the days you felt great, the meals that left you sluggish, and the habits quietly shaping how you feel.",
  },
  {
    screenshot: "/screenshots/micronutrients.webp",
    alt: "Micronutrient signals",
    badge: "The stuff that matters",
    headline: "More than just food.",
    body: "See the vitamins and nutrients hidden in what you eat, explained simply. No expertise needed — just small, useful nudges that help you make slightly better choices every day.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0f0f0f] font-sans text-white overflow-x-hidden">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-3.5 bg-[#0f0f0f]/85 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Image src="/icon.png" alt="WhatYouAte" width={26} height={26} className="rounded-[6px]" />
          <span className="font-semibold text-[14px] tracking-tight">WhatYouAte</span>
        </div>
        <a
          href={APP_STORE_URL}
          className="inline-flex items-center rounded-full bg-[#6FA8FF] px-4 py-2 text-[12px] font-bold text-[#0a0a0a] min-h-[36px] transition-all active:scale-95 hover:bg-[#89bbff] shadow-[0_0_0_1px_rgba(111,168,255,0.35)]"
        >
          Get the App
        </a>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center px-5 pt-28 pb-14 text-center overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 100% 55% at 50% 0%, rgba(111,168,255,0.18) 0%, transparent 65%)" }}
        />

        <motion.div
          className="relative z-10 flex flex-col items-center w-full max-w-lg"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.span variants={fadeUp} className="mb-4 inline-flex items-center rounded-full border border-[#6FA8FF]/25 bg-[#6FA8FF]/8 px-3.5 py-1.5 text-[10px] font-bold tracking-widest uppercase text-[#6FA8FF]">
            For iPhone · Free to Try
          </motion.span>

          <motion.h1 variants={fadeUp} className="text-[38px] sm:text-5xl font-bold tracking-tight leading-[1.1] mb-4">
            Know what you ate.<br />
            <span className="text-[#6FA8FF]">Feel the difference.</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="text-[16px] text-white/48 leading-relaxed mb-7 max-w-[300px]">
            Food affects how you feel every day. WhatYouAte helps you understand it — simply, quickly, and without the obsessing.
          </motion.p>

          <motion.div variants={fadeUp}>
            <AppStoreButton variant="blue" />
            <p className="mt-2.5 text-[11px] text-white/22">7-day free trial · iPhone only</p>
          </motion.div>
        </motion.div>

        {/* Hero phone */}
        <motion.div
          className="relative mt-12 w-full max-w-[230px]"
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease, delay: 0.3 }}
        >
          <div
            className="absolute inset-0 rounded-[44px] blur-3xl"
            style={{ background: "rgba(111,168,255,0.22)", transform: "scaleY(0.55) translateY(40%)" }}
          />
          <Image
            src="/screenshots/home.webp"
            alt="WhatYouAte home screen"
            width={640}
            height={1386}
            className="relative rounded-[32px] shadow-2xl w-full"
            priority
          />
        </motion.div>
      </section>

      {/* "Most apps are overwhelming" contrast section */}
      <section className="bg-[#F8FAFC] py-20 px-5">
        <div className="mx-auto max-w-xl text-center">
          <Reveal>
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#6FA8FF] mb-3">A different kind of app</p>
            <h2 className="text-[28px] sm:text-[34px] font-bold text-[#0f0f0f] leading-tight mb-4">
              Most nutrition apps feel like homework.
            </h2>
            <p className="text-[15px] text-[#6b7280] leading-relaxed mb-10">
              Complicated logs, barcode scanning, meal presets, spreadsheets — it&apos;s exhausting. WhatYouAte is built for people who just want to eat a little better, not people who want a second job.
            </p>
          </Reveal>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-40px" }}
            variants={stagger}
          >
            {problems.map((p) => (
              <motion.div
                key={p.text}
                variants={fadeUp}
                className="flex items-center gap-3 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
              >
                <span className="text-xl opacity-40">{p.icon}</span>
                <span className="text-[13px] font-medium text-[#6b7280] line-through decoration-[#6FA8FF]/60">{p.text}</span>
              </motion.div>
            ))}
          </motion.div>

          <Reveal delay={0.15}>
            <p className="mt-6 text-[14px] font-semibold text-[#0f0f0f]">
              WhatYouAte replaces all of that with one thing: just say what you ate.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section className="bg-[#F8FAFC] pb-24 px-5 border-t border-[#e5e7eb]">
        <div className="mx-auto max-w-4xl space-y-20 sm:space-y-28 pt-20">
          {features.map((f, i) => (
            <div
              key={f.badge}
              className={`flex flex-col gap-10 items-center sm:flex-row ${i % 2 === 1 ? "sm:flex-row-reverse" : ""}`}
            >
              <Reveal className="flex-shrink-0 w-full max-w-[190px] sm:max-w-[210px] mx-auto sm:mx-0">
                <div className="relative">
                  <div
                    className="absolute inset-0 rounded-[40px] blur-2xl"
                    style={{ background: "rgba(111,168,255,0.1)", transform: "scaleY(0.7) translateY(25%)" }}
                  />
                  <Image
                    src={f.screenshot}
                    alt={f.alt}
                    width={640}
                    height={1386}
                    className="relative rounded-[28px] shadow-xl w-full"
                  />
                </div>
              </Reveal>

              <Reveal delay={0.1} className="flex flex-col gap-3 text-center sm:text-left max-w-xs mx-auto sm:mx-0">
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#6FA8FF]">{f.badge}</span>
                <h2 className="text-[24px] sm:text-[26px] font-bold text-[#0f0f0f] leading-tight">{f.headline}</h2>
                <p className="text-[#6b7280] leading-relaxed text-[15px]">{f.body}</p>
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* Apple Health strip */}
      <section className="bg-[#0f0f0f] py-14 px-5 border-t border-white/5">
        <Reveal className="mx-auto max-w-xl flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-[#FF3B5C]/10 border border-[#FF3B5C]/18">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#FF3B5C">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#6FA8FF] mb-1">Connects to Apple Health</p>
            <p className="text-white/48 text-[15px] leading-relaxed">
              Your nutrition data lives where it belongs — right alongside your steps and sleep in Apple Health.
            </p>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section
        className="py-24 px-5 text-center"
        style={{ background: "radial-gradient(ellipse 100% 65% at 50% 50%, rgba(111,168,255,0.08) 0%, transparent 70%)" }}
      >
        <Reveal className="mx-auto max-w-sm">
          <h2 className="text-[30px] sm:text-[36px] font-bold tracking-tight leading-tight mb-4">
            Give it a week.<br />See how you feel.
          </h2>
          <p className="text-white/38 mb-7 text-[15px] leading-relaxed">
            No commitment. Download free and try Pro for 7 days.
          </p>
          <AppStoreButton variant="blue" />
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-7 px-5">
        <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-white/22">
          <span>© {new Date().getFullYear()} WhatYouAte. All rights reserved.</span>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-white/50 transition-colors">Privacy Policy</Link>
            <a href="mailto:support@whatyouate.app" className="hover:text-white/50 transition-colors">Support</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
